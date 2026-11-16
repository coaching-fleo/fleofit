import { describe, it, expect, vi, beforeEach } from 'vitest'

// Lettura e scrittura dei gruppi di atleti (16/11/2026): tabella assente =
// funzione nascosta senza errori, un nome non valido non arriva mai al database.

const ctrl = await vi.hoisted(async () => ({ righe: [], guasti: [], codice: undefined }))
const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  return { f: null, crea: fintoSupabase }
})
let f
vi.mock('../../supabaseClient', () => ({
  get supabase() { return f.supabase },
}))

const { elencoGruppi, creaGruppo, aggiornaGruppo, eliminaGruppo } = await import('../gruppiAtletiDb')

const G = (id, nome, atleti = []) => ({ id, coach: 'c1', nome, atleti, creato_at: '2026-11-01T00:00:00Z', modificato_at: null })

function monta(codice) {
  f = finto.crea(() => ({ gruppi_atleti: ctrl.righe }), { erroreSu: () => ctrl.guasti, codiceErrore: codice })
}

beforeEach(() => {
  ctrl.righe = []
  ctrl.guasti = []
  monta()
})

describe('elencoGruppi', () => {
  it('ordina per nome, alla italiana', async () => {
    ctrl.righe = [G('1', 'Zeta'), G('2', 'àncora'), G('3', 'Beta')]
    const r = await elencoGruppi()
    expect(r.disponibile).toBe(true)
    expect(r.gruppi.map(g => g.nome)).toEqual(['àncora', 'Beta', 'Zeta'])
  })
  it('tabella assente: non disponibile, senza lanciare', async () => {
    monta('PGRST205'); ctrl.guasti = ['gruppi_atleti']
    expect(await elencoGruppi()).toEqual({ disponibile: false, gruppi: [] })
    monta('42P01')
    expect(await elencoGruppi()).toEqual({ disponibile: false, gruppi: [] })
  })
  it('un altro errore si lancia', async () => {
    ctrl.guasti = ['gruppi_atleti']
    await expect(elencoGruppi()).rejects.toBeTruthy()
  })
})

describe('creaGruppo', () => {
  it('manda coach, nome trimmato e atleti', async () => {
    ctrl.righe = [G('n', 'Hyrox')]
    await creaGruppo({ coach: 'c1', nome: '  Hyrox  ', atleti: ['a', 'b'] }, [])
    expect(f.chiamateA('gruppi_atleti', 'insert')[0].args[0]).toEqual({ coach: 'c1', nome: 'Hyrox', atleti: ['a', 'b'] })
  })
  it('nome doppio o vuoto: rifiuta col messaggio, senza insert', async () => {
    await expect(creaGruppo({ coach: 'c1', nome: 'hyrox', atleti: [] }, [G('1', 'Hyrox')]))
      .rejects.toThrow('Hai già un gruppo con questo nome.')
    await expect(creaGruppo({ coach: 'c1', nome: ' ', atleti: [] }, [])).rejects.toThrow('Scrivi un nome.')
    expect(f.chiamateA('gruppi_atleti', 'insert')).toHaveLength(0)
  })
})

describe('aggiornaGruppo, eliminaGruppo', () => {
  it('aggiorna nome, atleti e modificato_at, per id', async () => {
    ctrl.righe = [G('1', 'Hyrox')]
    await aggiornaGruppo('1', { nome: ' Hyrox ', atleti: ['a'] }, [G('1', 'Hyrox'), G('2', 'Corsa')])
    const dati = f.chiamateA('gruppi_atleti', 'update')[0].args[0]
    expect(dati).toMatchObject({ nome: 'Hyrox', atleti: ['a'] })
    expect(typeof dati.modificato_at).toBe('string')
    expect(f.chiamateA('gruppi_atleti', 'eq')[0].args).toEqual(['id', '1'])
  })
  it('aggiorna con il nome di un altro gruppo: rifiuta senza update', async () => {
    await expect(aggiornaGruppo('1', { nome: 'corsa', atleti: [] }, [G('1', 'Hyrox'), G('2', 'Corsa')])).rejects.toBeTruthy()
    expect(f.chiamateA('gruppi_atleti', 'update')).toHaveLength(0)
  })
  it('elimina per id, e rifiuta se il database sbaglia', async () => {
    await eliminaGruppo('1')
    expect(f.chiamateA('gruppi_atleti', 'delete')).toHaveLength(1)
    expect(f.chiamateA('gruppi_atleti', 'eq')[0].args).toEqual(['id', '1'])
    ctrl.guasti = ['gruppi_atleti']
    await expect(eliminaGruppo('1')).rejects.toBeTruthy()
  })
})
