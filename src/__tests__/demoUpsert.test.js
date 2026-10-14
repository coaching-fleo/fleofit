import { describe, it, expect, beforeEach, vi } from 'vitest'
import { clientDemo, azzeraDemo } from '../supabaseDemo'

// L'upsert del finto Supabase dell'ambiente di prova (13/10/2026).
// 🔴 Con una chiave composta — `onConflict: 'athlete_id,giorno'`, quella di
// `come_stai` — confrontava la colonna «athlete_id,giorno», che non esiste:
// undefined === undefined, e la PRIMA riga della tabella veniva sovrascritta.
// Il database vero non lo fa; la demo deve comportarsi come lui.

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {})
  azzeraDemo()
})

describe('demo: upsert', () => {
  it('con una chiave composta aggiunge una riga nuova invece di sovrascriverne un\'altra', async () => {
    const db = clientDemo()
    const { data: prima } = await db.from('come_stai').select('*')
    const n = prima.length
    const vecchia = prima[0]
    await db.from('come_stai').upsert({ athlete_id: 'at-sofia', giorno: '2030-01-01', sonno: 3 }, { onConflict: 'athlete_id,giorno' })
    const { data: dopo } = await db.from('come_stai').select('*')
    expect(dopo).toHaveLength(n + 1)
    expect(dopo.find(r => r.id === vecchia.id)).toEqual(vecchia)
  })

  it('con una chiave composta già presente aggiorna QUELLA riga', async () => {
    const db = clientDemo()
    await db.from('come_stai').upsert({ athlete_id: 'at-sofia', giorno: '2030-01-01', sonno: 3 }, { onConflict: 'athlete_id,giorno' })
    await db.from('come_stai').upsert({ athlete_id: 'at-sofia', giorno: '2030-01-01', sonno: 5 }, { onConflict: 'athlete_id,giorno' })
    const { data } = await db.from('come_stai').select('*').eq('athlete_id', 'at-sofia').eq('giorno', '2030-01-01')
    expect(data).toHaveLength(1)
    expect(data[0].sonno).toBe(5)
  })
})
