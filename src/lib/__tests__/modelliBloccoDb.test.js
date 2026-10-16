import { describe, it, expect, vi, beforeEach } from 'vitest'

// Lettura e scrittura dei modelli di blocco (16/10/2026): cosa si chiede al
// database, cosa si scarta di ciò che torna, e che un nome non valido non
// arrivi mai a una insert.

const ctrl = await vi.hoisted(async () => ({ righe: [], guasti: [] }))
const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  return fintoSupabase(() => ({ modelli_blocco: ctrl.righe }), { erroreSu: () => ctrl.guasti })
})
vi.mock('../../supabaseClient', () => ({ supabase: finto.supabase }))

const { elencoModelli, salvaModello, aggiornaModello, eliminaModello, leggiModello } =
  await import('../modelliBloccoDb')

const gym = (id, extra = {}) => ({ id, categoria: 'Gym', nome: id, contenuto: { esercizi: [] }, creato_at: '2026-10-01T10:00:00Z', modificato_at: null, ...extra })

beforeEach(() => {
  ctrl.righe = []
  ctrl.guasti = []
  finto.chiamate.length = 0
})

describe('elencoModelli', () => {
  it('filtra per categoria e scarta le righe non valide', async () => {
    ctrl.righe = [gym('a'), gym('rotto', { contenuto: null })]
    const r = await elencoModelli('Gym')
    expect(finto.chiamateA('modelli_blocco', 'eq')[0].args).toEqual(['categoria', 'Gym'])
    expect(r.map(m => m.id)).toEqual(['a'])
  })
  it('ordina per modificato_at ?? creato_at, dal più recente', async () => {
    ctrl.righe = [
      gym('vecchio', { creato_at: '2026-10-01T00:00:00Z' }),
      gym('ritoccato', { creato_at: '2026-09-01T00:00:00Z', modificato_at: '2026-10-10T00:00:00Z' }),
      gym('nuovo', { creato_at: '2026-10-05T00:00:00Z' }),
    ]
    expect((await elencoModelli()).map(m => m.id)).toEqual(['ritoccato', 'nuovo', 'vecchio'])
  })
  it('rifiuta se c\'è un errore', async () => {
    ctrl.guasti = ['modelli_blocco']
    await expect(elencoModelli('Gym')).rejects.toBeTruthy()
  })
})

describe('salvaModello', () => {
  it('manda coach, categoria, nome trimmato e contenuto', async () => {
    ctrl.righe = [gym('x')]
    await salvaModello({ coach: 'c1', categoria: 'Gym', nome: '  Spinta  ', contenuto: { esercizi: [] } })
    expect(finto.chiamateA('modelli_blocco', 'insert')[0].args[0]).toEqual({
      coach: 'c1', categoria: 'Gym', nome: 'Spinta', contenuto: { esercizi: [] },
    })
  })
  it('con nome vuoto rifiuta senza chiamare insert', async () => {
    await expect(salvaModello({ coach: 'c1', categoria: 'Gym', nome: '   ', contenuto: {} })).rejects.toBeTruthy()
    expect(finto.chiamateA('modelli_blocco', 'insert')).toHaveLength(0)
  })
})

describe('aggiornaModello, eliminaModello, leggiModello', () => {
  it('aggiornaModello scrive modificato_at', async () => {
    ctrl.righe = [gym('x')]
    await aggiornaModello('x', { nome: ' Nuovo ' })
    const dati = finto.chiamateA('modelli_blocco', 'update')[0].args[0]
    expect(dati.nome).toBe('Nuovo')
    expect(typeof dati.modificato_at).toBe('string')
  })
  it('eliminaModello cancella per id', async () => {
    await eliminaModello('x')
    expect(finto.chiamateA('modelli_blocco', 'delete')).toHaveLength(1)
    expect(finto.chiamateA('modelli_blocco', 'eq')[0].args).toEqual(['id', 'x'])
  })
  it('leggiModello torna null se non valido o assente', async () => {
    ctrl.righe = [gym('x', { contenuto: null })]
    expect(await leggiModello('x')).toBeNull()
    ctrl.righe = []
    expect(await leggiModello('y')).toBeNull()
    ctrl.righe = [gym('z')]
    expect((await leggiModello('z')).id).toBe('z')
  })
})
