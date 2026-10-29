import { describe, it, expect, vi, beforeEach } from 'vitest'

// scollegaAtleta parla con Garmin e col database: qui basta sapere se è stato chiamato.
const scollega = vi.fn(async () => {})
vi.mock('../../../supabase/functions/_shared/garmin.ts', () => ({ scollegaAtleta: (...a) => scollega(...a) }))

// Percorso non letterale: tsc non deve seguirlo fino al file Deno.
const PERCORSO = '../../../supabase/functions/garmin-webhook/giornate.ts'
const { gestisciGiornate } = await import(/* @vite-ignore */ PERCORSO)

// Un finto admin: collegamenti per garmin_user_id, atleti per id, e il registro degli upsert.
function finto({ collegamenti = {}, atleti = {}, erroreUpsertSu = null } = {}) {
  const upserts = []
  const admin = {
    from(tabella) {
      const filtri = {}
      const q = {
        select: () => q,
        eq: (c, v) => { filtri[c] = v; return q },
        maybeSingle: async () => {
          if (tabella === 'garmin_collegamenti') return { data: collegamenti[filtri.garmin_user_id] ?? null, error: null }
          if (tabella === 'athletes') return { data: atleti[filtri.id] ?? null, error: null }
          return { data: null, error: null }
        },
        upsert: async (righe, opzioni) => {
          upserts.push({ tabella, righe, opzioni })
          const sbagliata = erroreUpsertSu && righe[0].giorno === erroreUpsertSu
          return { error: sbagliata ? { message: 'rotto' } : null }
        },
      }
      return q
    },
  }
  return { admin, upserts }
}

const attivo = (id, permessi = ['ACTIVITY_EXPORT', 'HEALTH_EXPORT'], stato = 'attivo') =>
  ({ athlete_id: id, stato, permessi })
const voce = (colonna, valore, extra = {}) =>
  ({ garmin_user_id: 'g1', giorno: '2026-10-28', colonna, valore, ...extra })

beforeEach(() => { scollega.mockClear(); vi.spyOn(console, 'warn').mockImplementation(() => {}); vi.spyOn(console, 'log').mockImplementation(() => {}); vi.spyOn(console, 'error').mockImplementation(() => {}) })

describe('gestisciGiornate', () => {
  it('sonno, giornata, hrv dello stesso giorno: tre upsert, ognuno con UNA sola colonna', async () => {
    const { admin, upserts } = finto({ collegamenti: { g1: attivo('a1') }, atleti: { a1: { deleted_at: null } } })
    await gestisciGiornate(admin, [voce('sonno', { ore: 7 }), voce('giornata', { passi: 9000 }), voce('hrv', { media_notte: 58 })])
    expect(upserts).toHaveLength(3)
    const colonne = (r) => Object.keys(r).filter((k) => !['athlete_id', 'giorno', 'aggiornato_at'].includes(k))
    expect(upserts.map((u) => colonne(u.righe[0]))).toEqual([['sonno'], ['giornata'], ['hrv']])
    expect(upserts[0].righe[0]).toMatchObject({ athlete_id: 'a1', giorno: '2026-10-28', sonno: { ore: 7 } })
    expect(typeof upserts[0].righe[0].aggiornato_at).toBe('string')
    for (const u of upserts) {
      expect(u.tabella).toBe('garmin_giornate')
      expect(u.opzioni).toEqual({ onConflict: 'athlete_id,giorno' })
    }
  })

  it.each([
    ['collegamento sospeso', attivo('a1', ['HEALTH_EXPORT'], 'sospeso')],
    ['senza HEALTH_EXPORT', attivo('a1', ['ACTIVITY_EXPORT'])],
    ['permessi assenti', { athlete_id: 'a1', stato: 'attivo', permessi: null }],
  ])('%s: niente si salva', async (_n, coll) => {
    const { admin, upserts } = finto({ collegamenti: { g1: coll }, atleti: { a1: { deleted_at: null } } })
    await gestisciGiornate(admin, [voce('sonno', { ore: 7 })])
    expect(upserts).toHaveLength(0)
    expect(scollega).not.toHaveBeenCalled()
  })

  it('utente Garmin sconosciuto: niente si salva', async () => {
    const { admin, upserts } = finto()
    await gestisciGiornate(admin, [voce('hrv', { media_notte: 1 })])
    expect(upserts).toHaveLength(0)
  })

  it('atleta eliminato: scollegaAtleta, nessun upsert', async () => {
    const { admin, upserts } = finto({ collegamenti: { g1: attivo('a1') }, atleti: { a1: { deleted_at: 1730000000000 } } })
    await gestisciGiornate(admin, [voce('sonno', { ore: 7 })])
    expect(scollega).toHaveBeenCalledWith(admin, 'a1', 'eliminato')
    expect(upserts).toHaveLength(0)
  })

  it('un errore su una voce non ferma le altre', async () => {
    const { admin, upserts } = finto({ collegamenti: { g1: attivo('a1') }, atleti: { a1: { deleted_at: null } }, erroreUpsertSu: '2026-10-27' })
    await gestisciGiornate(admin, [voce('sonno', { ore: 6 }, { giorno: '2026-10-27' }), voce('sonno', { ore: 7 })])
    expect(upserts).toHaveLength(2)
    expect(upserts[1].righe[0].sonno).toEqual({ ore: 7 })
  })
})
