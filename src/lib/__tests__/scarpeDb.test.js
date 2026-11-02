import { describe, it, expect, vi, beforeEach } from 'vitest'

// Accesso ai dati delle scarpe (02/11/2026): quante letture si fanno, che i km
// si calcolino, che le tabelle assenti non siano un errore, e che un numero
// scritto male non arrivi mai a una insert o a un update.

// Due finti: il `codiceErrore` si fissa alla costruzione, quindi uno per
// l'errore generico e uno per «tabella assente» (42P01); `ctrl.codice` sceglie.
const ctrl = await vi.hoisted(async () => ({ tabelle: {}, guasti: [], codice: undefined }))
const finti = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  const crea = (codiceErrore) => fintoSupabase(() => ctrl.tabelle, { erroreSu: () => ctrl.guasti, codiceErrore })
  return { generico: crea(undefined), assente: crea('42P01') }
})
const attivo = () => (ctrl.codice ? finti.assente : finti.generico)
const finto = {
  get chiamate() { return attivo().chiamate },
  chiamateA: (t, m) => attivo().chiamateA(t, m),
}
vi.mock('../../supabaseClient', () => ({ supabase: { from: (t) => attivo().supabase.from(t) } }))

const db = await import('../scarpeDb')
const { numeroKm, leggiScarpeAtleta, aggiungiScarpa, aggiornaScarpa, rendiPrincipale, scritteDagliAtleti, tabelleAssenti } = db

const corsa = { steps: [{ type: 'run', duration: '5 km' }] }

beforeEach(() => {
  ctrl.tabelle = {}
  ctrl.guasti = []
  ctrl.codice = undefined
  finti.generico.chiamate.length = 0
  finti.assente.chiamate.length = 0
})

describe('numeroKm', () => {
  it('normalizza virgola e migliaia, rifiuta il resto', () => {
    expect(numeroKm('350')).toBe(350)
    expect(numeroKm('350,5')).toBe(350.5)
    expect(numeroKm('1.200')).toBe(1200)
    expect(numeroKm('-5')).toBeNull()
    expect(numeroKm('abc')).toBeNull()
    expect(numeroKm('')).toBe(0)
  })
})

describe('tabelleAssenti', () => {
  it('riconosce i due codici', () => {
    expect(tabelleAssenti({ code: '42P01' })).toBe(true)
    expect(tabelleAssenti({ code: 'PGRST205' })).toBe(true)
    expect(tabelleAssenti({ code: 'altro' })).toBe(false)
    expect(tabelleAssenti(null)).toBe(false)
  })
})

describe('leggiScarpeAtleta', () => {
  it('fa esattamente 4 letture e somma iniziali + usi, con l\'orologio che vince', async () => {
    ctrl.tabelle = {
      scarpe_atleta: [{ id: 's1', km_iniziali: 100, soglia_km: 700, catalogo_id: 'c1', marca: 'Nike', modello: 'Pegasus 41' }],
      scarpe_uso: [
        { athlete_workout_id: 'a1', scarpa_id: 's1' },
        { athlete_workout_id: 'a2', scarpa_id: 's1' },
      ],
      athlete_workouts: [
        { id: 'a1', completed_date: '2026-10-01', workouts: { title: 'Lento · AB12', sections: corsa } },
        { id: 'a2', completed_date: '2026-10-02', workouts: { title: 'Fondo', sections: corsa } },
      ],
      garmin_attivita: [{ athlete_workout_id: 'a2', distanza_m: 10000 }],
    }
    const r = await leggiScarpeAtleta('at1')
    expect(finto.chiamate.filter(c => c.metodo === 'select').map(c => c.tabella))
      .toEqual(['scarpe_atleta', 'scarpe_uso', 'athlete_workouts', 'garmin_attivita'])
    expect(r.disponibile).toBe(true)
    const s = r.scarpe[0]
    expect(s.km).toBe(115)
    expect(s.stato).toBe('ok')
    expect(s.usi.find(u => u.athlete_workout_id === 'a1')).toMatchObject({ km: 5, fonte: 'stima', titolo: 'Lento · AB12', data: '2026-10-01' })
    expect(s.usi.find(u => u.athlete_workout_id === 'a2')).toMatchObject({ km: 10, fonte: 'orologio' })
  })
  it('con tabelle assenti torna non disponibile senza lanciare', async () => {
    ctrl.guasti = ['scarpe_atleta']
    ctrl.codice = '42P01'
    expect(await leggiScarpeAtleta('at1')).toEqual({ disponibile: false, scarpe: [] })
  })
  it('con un errore qualsiasi lancia', async () => {
    ctrl.guasti = ['scarpe_atleta']
    await expect(leggiScarpeAtleta('at1')).rejects.toBeTruthy()
  })
  it('una scarpa senza catalogo_id con marca e modello copiati si legge uguale', async () => {
    ctrl.tabelle = { scarpe_atleta: [{ id: 's2', km_iniziali: 0, soglia_km: 700, catalogo_id: null, marca: 'Hoka', modello: 'Clifton 9' }] }
    const r = await leggiScarpeAtleta('at1')
    expect(r.scarpe[0]).toMatchObject({ marca: 'Hoka', modello: 'Clifton 9', catalogo_id: null, km: 0, usi: [] })
  })
})

describe('aggiungiScarpa', () => {
  it('con km non validi non chiama insert', async () => {
    await expect(aggiungiScarpa({ athleteId: 'at1', marca: 'A', modello: 'B', kmIniziali: 'abc' })).rejects.toBeTruthy()
    expect(finto.chiamateA('scarpe_atleta', 'insert')).toHaveLength(0)
  })
  it('copia marca e modello dal catalogo', async () => {
    ctrl.tabelle = { scarpe_atleta: [{ id: 'nuova' }] }
    await aggiungiScarpa({ athleteId: 'at1', catalogo: { id: 'c1', marca: 'Nike', modello: 'Pegasus 41' }, kmIniziali: '1.200', principale: false })
    expect(finto.chiamateA('scarpe_atleta', 'insert')[0].args[0]).toMatchObject({
      athlete_id: 'at1', catalogo_id: 'c1', marca: 'Nike', modello: 'Pegasus 41', km_iniziali: 1200,
    })
  })
})

describe('aggiornaScarpa', () => {
  it('rifiuta una soglia non positiva o non numerica senza chiamare update', async () => {
    for (const s of [0, '0', '-10', 'abc', '']) {
      await expect(aggiornaScarpa('s1', { soglia_km: s })).rejects.toBeTruthy()
    }
    expect(finto.chiamateA('scarpe_atleta', 'update')).toHaveLength(0)
  })
  it('accetta una soglia valida', async () => {
    ctrl.tabelle = { scarpe_atleta: [{ id: 's1' }] }
    await aggiornaScarpa('s1', { soglia_km: '800' })
    expect(finto.chiamateA('scarpe_atleta', 'update')[0].args[0]).toEqual({ soglia_km: 800 })
  })
})

describe('rendiPrincipale', () => {
  it('toglie la vecchia PRIMA di mettere la nuova', async () => {
    await rendiPrincipale('at1', 's2')
    const updates = finto.chiamateA('scarpe_atleta', 'update').map(c => c.args[0])
    expect(updates).toEqual([{ principale: false }, { principale: true }])
  })
})

describe('scritteDagliAtleti', () => {
  it('unisce voci uguali senza badare a maiuscole e spazi', async () => {
    ctrl.tabelle = { scarpe_atleta: [
      { marca: 'Nike', modello: ' pegasus 41' },
      { marca: 'nike ', modello: 'Pegasus 41' },
      { marca: 'Hoka', modello: 'Bondi 8' },
    ] }
    const r = await scritteDagliAtleti()
    expect(finto.chiamateA('scarpe_atleta', 'is')[0].args).toEqual(['catalogo_id', null])
    expect(r).toHaveLength(2)
    expect(r[0]).toMatchObject({ quante: 2 })
    expect(r[0].modello.toLowerCase()).toBe('pegasus 41')
  })
})
