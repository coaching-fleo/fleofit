import { describe, it, expect, vi, beforeEach } from 'vitest'

// Accesso ai dati delle scarpe (02/11/2026): quante letture si fanno, che i km
// si calcolino, che le tabelle assenti non siano un errore, e che un numero
// scritto male non arrivi mai a una insert o a un update.

// Due finti: il `codiceErrore` si fissa alla costruzione, quindi uno per
// l'errore generico e uno per «tabella assente» (42P01); `ctrl.codice` sceglie.
const ctrl = await vi.hoisted(async () => ({ tabelle: {}, guasti: [], codice: undefined, storage: null }))
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
vi.mock('../../supabaseClient', () => ({ supabase: {
  from: (t) => attivo().supabase.from(t),
  storage: { from: (b) => ctrl.storage.from(b) },
} }))

const db = await import('../scarpeDb')
const { numeroKm, leggiScarpeAtleta, aggiungiScarpa, aggiornaScarpa, rendiPrincipale, scritteDagliAtleti, tabelleAssenti,
  salvaModelloCatalogo, aggiornaModelloCatalogo, leggiModello, caricaFotoModello, fotoConSfondo } = db

const corsa = { steps: [{ type: 'run', duration: '5 km' }] }

beforeEach(() => {
  ctrl.tabelle = {}
  ctrl.guasti = []
  ctrl.codice = undefined
  ctrl.storage = {
    upload: vi.fn(() => Promise.resolve({ error: null })),
    getPublicUrl: vi.fn((percorso) => ({ data: { publicUrl: `https://esempio/scarpe/${percorso}` } })),
    from: vi.fn(() => ctrl.storage),
  }
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
        { id: 'a1', status: 'completed', completed_date: '2026-10-01', workouts: { title: 'Lento · AB12', sections: corsa } },
        { id: 'a2', status: 'completed', completed_date: '2026-10-02', workouts: { title: 'Fondo', sections: corsa } },
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
  it('un allenamento tornato «da fare» non conta: né negli usi né nei km', async () => {
    // L'uso resta se l'annulla offline o del coach non l'ha tolto: lo stato vince.
    ctrl.tabelle = {
      scarpe_atleta: [{ id: 's1', km_iniziali: 100, soglia_km: 700 }],
      scarpe_uso: [
        { athlete_workout_id: 'a1', scarpa_id: 's1' },
        { athlete_workout_id: 'a2', scarpa_id: 's1' },
        { athlete_workout_id: 'a3', scarpa_id: 's1' },
      ],
      athlete_workouts: [
        { id: 'a1', status: 'completed', completed_date: '2026-10-01', workouts: { title: 'Lento', sections: corsa } },
        { id: 'a2', status: 'pending', completed_date: null, workouts: { title: 'Fondo', sections: corsa } },
      ],
      garmin_attivita: [],
    }
    const r = await leggiScarpeAtleta('at1')
    const select = finto.chiamateA('athlete_workouts', 'select')[0].args[0]
    expect(select).toMatch(/\bstatus\b/)
    const s = r.scarpe[0]
    expect(s.usi.map(u => u.athlete_workout_id)).toEqual(['a1'])
    expect(s.km).toBe(105)
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
  it('se la nuova non si scrive, rimette la vecchia e poi lancia', async () => {
    // La prima update torna la vecchia principale (s1); la seconda fallisce.
    ctrl.tabelle = { scarpe_atleta: [{ id: 's1' }] }
    let volte = 0
    ctrl.guasti = []
    Object.defineProperty(ctrl, 'guasti', {
      configurable: true,
      get: () => (++volte === 2 ? ['scarpe_atleta'] : []),
      set: () => {},
    })
    try {
      await expect(rendiPrincipale('at1', 's2')).rejects.toBeTruthy()
    } finally {
      Object.defineProperty(ctrl, 'guasti', { configurable: true, writable: true, value: [] })
    }
    const updates = finto.chiamateA('scarpe_atleta', 'update').map(c => c.args[0])
    expect(updates).toEqual([{ principale: false }, { principale: true }, { principale: true }])
    const eq = finto.chiamateA('scarpe_atleta').filter(c => c.metodo === 'eq' || c.metodo === 'in').map(c => c.args)
    expect(eq.at(-1)).toEqual(['id', 's1'])
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

describe('soglia dal catalogo', () => {
  it('usa la vita stimata del modello, altrimenti 700', async () => {
    ctrl.tabelle = { scarpe_atleta: [{ id: 'n' }] }
    await aggiungiScarpa({ athleteId: 'at1', catalogo: { id: 'c1', marca: 'A', modello: 'B', vita_km: 900 }, kmIniziali: 0 })
    await aggiungiScarpa({ athleteId: 'at1', catalogo: { id: 'c2', marca: 'A', modello: 'C' }, kmIniziali: 0 })
    const ins = finto.chiamateA('scarpe_atleta', 'insert').map(c => c.args[0].soglia_km)
    expect(ins).toEqual([900, 700])
  })
})

describe('catalogo: validazione', () => {
  it('salvaModelloCatalogo rifiuta un peso fuori limite senza chiamare insert', async () => {
    await expect(salvaModelloCatalogo({ marca: 'X', modello: 'Y', peso_g: '50' })).rejects.toThrow(/peso/i)
    expect(finto.chiamateA('scarpe_catalogo', 'insert')).toHaveLength(0)
  })
  it('salvaModelloCatalogo inserisce i dati normalizzati', async () => {
    ctrl.tabelle = { scarpe_catalogo: [{ id: 'm1' }] }
    await salvaModelloCatalogo({ marca: ' X ', modello: 'Y', peso_g: '250', altro: 1 })
    const dati = finto.chiamateA('scarpe_catalogo', 'insert')[0].args[0]
    expect(dati).toMatchObject({ marca: 'X', modello: 'Y', peso_g: 250 })
    expect(dati.altro).toBeUndefined()
  })
  it('aggiornaModelloCatalogo valida in modo parziale', async () => {
    await expect(aggiornaModelloCatalogo('m1', { drop_mm: 40 })).rejects.toThrow(/drop/i)
    expect(finto.chiamateA('scarpe_catalogo', 'update')).toHaveLength(0)
    ctrl.tabelle = { scarpe_catalogo: [{ id: 'm1' }] }
    await aggiornaModelloCatalogo('m1', { foto_url: 'https://esempio/x.png' })
    expect(finto.chiamateA('scarpe_catalogo', 'update')[0].args[0]).toEqual({ foto_url: 'https://esempio/x.png' })
  })
})

describe('leggiModello', () => {
  it('torna il modello', async () => {
    ctrl.tabelle = { scarpe_catalogo: [{ id: 'm1', marca: 'Nike' }] }
    expect(await leggiModello('m1')).toMatchObject({ id: 'm1' })
    expect(finto.chiamateA('scarpe_catalogo', 'maybeSingle')).toHaveLength(1)
  })
  it('non trovato o tabelle assenti → null', async () => {
    expect(await leggiModello('x')).toBeNull()
    ctrl.guasti = ['scarpe_catalogo']
    ctrl.codice = '42P01'
    expect(await leggiModello('x')).toBeNull()
  })
  it('un altro errore lancia', async () => {
    ctrl.guasti = ['scarpe_catalogo']
    await expect(leggiModello('x')).rejects.toBeTruthy()
  })
})

describe('caricaFotoModello', () => {
  it('carica su <id>.<est>, e salva un URL con #sfondo se la foto ha lo sfondo', async () => {
    ctrl.tabelle = { scarpe_catalogo: [{ id: 'm1' }] }
    const blob = new Blob(['x'])
    const url = await caricaFotoModello('m1', { blob, est: 'webp', trasparente: false })
    expect(ctrl.storage.from).toHaveBeenCalledWith('scarpe')
    expect(ctrl.storage.upload).toHaveBeenCalledWith('m1.webp', blob, { upsert: true, contentType: 'image/webp' })
    expect(url).toMatch(/^https:\/\/esempio\/scarpe\/m1\.webp\?v=\d+#sfondo$/)
    expect(finto.chiamateA('scarpe_catalogo', 'update')[0].args[0]).toEqual({ foto_url: url })
    expect(fotoConSfondo(url)).toBe(true)
  })
  it('trasparente: niente #sfondo; png ha il suo contentType', async () => {
    ctrl.tabelle = { scarpe_catalogo: [{ id: 'm1' }] }
    const url = await caricaFotoModello('m1', { blob: new Blob(['x']), est: 'png', trasparente: true })
    expect(ctrl.storage.upload.mock.calls[0][2]).toEqual({ upsert: true, contentType: 'image/png' })
    expect(url).not.toMatch(/#/)
    expect(fotoConSfondo(url)).toBe(false)
  })
  it('se upload fallisce lancia e non aggiorna foto_url', async () => {
    ctrl.storage.upload.mockResolvedValueOnce({ error: new Error('no') })
    await expect(caricaFotoModello('m1', { blob: new Blob(['x']), est: 'png', trasparente: true })).rejects.toThrow('no')
    expect(finto.chiamateA('scarpe_catalogo', 'update')).toHaveLength(0)
  })
})

describe('fotoConSfondo', () => {
  it('true solo con #sfondo in coda', () => {
    expect(fotoConSfondo('https://x/a.webp?v=1#sfondo')).toBe(true)
    expect(fotoConSfondo('https://x/a.png?v=1')).toBe(false)
    expect(fotoConSfondo(null)).toBe(false)
  })
})
