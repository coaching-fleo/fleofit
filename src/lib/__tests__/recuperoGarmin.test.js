import { describe, it, expect, vi } from 'vitest'
import {
  serieRecupero, segnaliRecupero, segnaliTeam, leggiGiornate, leggiGiornateFra, METRICHE,
} from '../recuperoGarmin'
import { fintoSupabase } from '../../test/fintoSupabase'

const OGGI = new Date('2026-10-29T10:00:00Z')
const giorno = (indietro) => {
  const d = new Date(Date.UTC(2026, 9, 29 - indietro))
  return d.toISOString().slice(0, 10)
}
// valori[0] = il più vecchio; l'ultimo cade `fineIndietro` giorni fa (1 = ieri)
function righe(chiave, valori, fineIndietro = 1, athlete_id = 'a1') {
  return valori.map((v, i) => {
    const g = giorno(fineIndietro + (valori.length - 1 - i))
    if (chiave === 'hrv') return { athlete_id, giorno: g, hrv: { media_notte: v } }
    if (chiave === 'fc') return { athlete_id, giorno: g, giornata: { fc_riposo: v } }
    return { athlete_id, giorno: g, sonno: { ore: v } }
  })
}
const ripeti = (v, n) => Array(n).fill(v)
const tipi = (r) => segnaliRecupero(r, OGGI).map(s => s.tipo)

describe('segnaliRecupero', () => {
  it('HRV: tre notti a 53 dopo 28 a 60 -> segnale; a 54,5 no', () => {
    const s = segnaliRecupero(righe('hrv', [...ripeti(60, 28), 53, 53, 53]), OGGI)
    expect(s).toEqual([{ tipo: 'hrv', giorni: 3, testo: 'HRV sotto la sua media da 3 notti' }])
    expect(tipi(righe('hrv', [...ripeti(60, 28), 54.5, 54.5, 54.5]))).toEqual([])
  })
  it('FC: oltre 5 sopra la media, non 5 esatti', () => {
    const s = segnaliRecupero(righe('fc', [...ripeti(50, 28), 56, 56, 56]), OGGI)
    expect(s[0]).toMatchObject({ tipo: 'fc', giorni: 3, testo: 'FC a riposo sopra la sua media da 3 giorni' })
    expect(tipi(righe('fc', [...ripeti(50, 28), 55, 55, 55]))).toEqual([])
  })
  it('con 10 giorni di dati niente HRV/FC e media null, ma i punti ci sono', () => {
    const r = righe('hrv', [...ripeti(60, 7), 40, 40, 40])
    expect(tipi(r)).toEqual([])
    const serie = serieRecupero(r, OGGI)
    expect(serie.hrv.media).toBeNull()
    expect(serie.hrv.punti).toHaveLength(28)
    expect(serie.hrv.punti.filter(p => p.valore != null)).toHaveLength(10)
    expect(serie.hrv.punti[27]).toEqual({ giorno: giorno(0), valore: null })
    expect(serie.hrv.punti[26]).toEqual({ giorno: giorno(1), valore: 40 })
  })
  it('sonno sotto 6 ore per 3 notti senza storico -> segnale; 5,5/7/5,5 no', () => {
    expect(segnaliRecupero(righe('sonno', [5.5, 5.5, 5.5]), OGGI)[0])
      .toMatchObject({ tipo: 'sonno', giorni: 3, testo: 'Dorme meno di 6 ore da 3 notti' })
    expect(tipi(righe('sonno', [5.5, 7, 5.5]))).toEqual([])
    expect(tipi(righe('sonno', [5.5, 5.5, 6]))).toEqual([])
  })
  it('una fila che finisce l\'altro ieri non conta; oggi sì', () => {
    expect(tipi(righe('sonno', [5, 5, 5], 2))).toEqual([])
    expect(tipi(righe('sonno', [5, 5, 5], 0))).toEqual(['sonno'])
  })
  it('una fila di 5 dice 5', () => {
    const s = segnaliRecupero(righe('sonno', [7, 5, 5, 5, 5, 5]), OGGI)
    expect(s[0].giorni).toBe(5)
    expect(s[0].testo).toBe('Dorme meno di 6 ore da 5 notti')
  })
  it('la fila è al massimo 14', () => {
    expect(segnaliRecupero(righe('sonno', ripeti(5, 20)), OGGI)[0].giorni).toBe(14)
  })
  it('il riferimento esclude la fila: 6 notti basse dopo 28 normali', () => {
    const r = righe('hrv', [...ripeti(60, 28), ...ripeti(53, 6)])
    expect(segnaliRecupero(r, OGGI)[0].giorni).toBe(6)
  })
  it('il riferimento non include i giorni della fila (14 normali, poi 14 bassi)', () => {
    const r = righe('hrv', [...ripeti(60, 14), ...ripeti(50, 14)])
    expect(segnaliRecupero(r, OGGI)[0].giorni).toBe(14)
  })
  it('un giorno mancante rompe la fila', () => {
    const r = righe('sonno', [5, 5, 5])
    expect(tipi(r.filter((_, i) => i !== 1))).toEqual([])
  })
})

describe('segnaliTeam', () => {
  it('le righe degli altri atleti non si mescolano', () => {
    const r = [
      ...righe('sonno', [5, 5, 5], 1, 'a1'),
      ...righe('sonno', [5, 7, 5], 1, 'a2'),
    ]
    const atleti = [
      { id: 'a1', name: 'Anna', surname: 'Rossi', photo_url: 'x.jpg' },
      { id: 'a2', name: 'Bruno' },
    ]
    const out = segnaliTeam(atleti, r, OGGI)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ id: 'a1', nome: 'Anna Rossi', foto: 'x.jpg' })
    expect(out[0].segnali[0].tipo).toBe('sonno')
  })
})

describe('METRICHE', () => {
  it('leggono i campi giusti e tollerano righe vuote', () => {
    const r = { sonno: { ore: 7 }, hrv: { media_notte: 50 }, giornata: { fc_riposo: 48 } }
    expect(METRICHE.map(m => m.leggi(r))).toEqual([7, 50, 48])
    expect(METRICHE.map(m => m.leggi({}))).toEqual([undefined, undefined, undefined])
  })
})

describe('letture', () => {
  it('leggiGiornate torna le righe e interroga garmin_giornate', async () => {
    const f = fintoSupabase({ garmin_giornate: [{ athlete_id: 'a1', giorno: '2026-10-28' }] })
    const out = await leggiGiornate(f.supabase, 'a1', '2026-10-01', '2026-10-29')
    expect(out).toHaveLength(1)
    expect(f.chiamateA('garmin_giornate', 'eq')[0].args).toEqual(['athlete_id', 'a1'])
    expect(f.chiamateA('garmin_giornate', 'select')[0].args[0]).toBe('athlete_id, giorno, giornata, sonno, hrv')
    expect(await leggiGiornateFra(f.supabase, '2026-10-01', '2026-10-29')).toHaveLength(1)
  })
  it('errore o tabella assente -> []', async () => {
    const f = fintoSupabase({}, { erroreSu: ['garmin_giornate'], codiceErrore: 'PGRST205' })
    expect(await leggiGiornateFra(f.supabase, 'a', 'b')).toEqual([])
    const g = fintoSupabase({}, { erroreSu: ['garmin_giornate'] })
    const spia = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await leggiGiornate(g.supabase, 'a1', 'a', 'b')).toEqual([])
    expect(spia).toHaveBeenCalled()
    spia.mockRestore()
  })
  it('legge a pagine da mille', async () => {
    const pagine = [Array(1000).fill({ athlete_id: 'a' }), Array(5).fill({ athlete_id: 'a' })]
    const ranges = []
    let n = 0
    const catena = { select: () => catena, gte: () => catena, lte: () => catena, order: () => catena,
      range: (da, a) => { ranges.push([da, a]); return Promise.resolve({ data: pagine[n++], error: null }) } }
    const out = await leggiGiornateFra({ from: () => catena }, 'a', 'b')
    expect(out).toHaveLength(1005)
    expect(ranges).toEqual([[0, 999], [1000, 1999]])
  })
})
