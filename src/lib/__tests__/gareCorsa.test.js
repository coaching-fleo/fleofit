import { describe, it, expect, vi } from 'vitest'
import {
  caricaGareCorsa, filtraCorsa, regioniPresenti, distanzePresenti, sectionsEventoCorsa, formaAttuale,
  leggiRegione, scriviRegione, REGIONI, DISTANZE, CHIAVE_CACHE_GARE_CORSA, CHIAVE_REGIONE,
} from '../gareCorsa'
import { PROVINCE } from '../../../supabase/functions/gare-corsa/regole.ts'

// Perché questi test esistono
// ────────────────────────────
// Il calendario FIDAL arriva da una pagina che non controlliamo, via la Edge
// Function `gare-corsa`. Conta cosa succede quando NON arriva (la copia nel
// telefono deve bastare, anche vecchia), cosa succede quando arriva una lista
// di forma sbagliata (non si salva), e che l'evento nato da una gara di corsa
// non porti MAI la chiave `hyrox`: le schermate del risultato la leggono per
// cercare un tempo su results.hyrox.com.

const base = { tipo: 'strada', provincia: 'MI', livello: 'nazionale', url: 'u', al: null }
const MILANO = { ...base, id: '1', nome: 'Milano Marathon', dal: '2026-11-20', al: '2026-11-20', citta: 'Milano', regione: 'lombardia', distanza: 'maratona' }
const CREMA = { ...base, id: '2', nome: 'Mezza di Crema', dal: '2026-11-22', al: '2026-11-22', citta: 'Crema', provincia: 'CR', regione: 'lombardia', distanza: 'mezza' }
const ROMA = { ...base, id: '3', nome: 'Metà Mezza Roma', dal: '2026-11-29', al: '2026-11-29', citta: 'Roma', provincia: 'RM', regione: 'lazio', distanza: 'mezza' }
const TRAIL = { ...base, id: '4', nome: 'Trail del Monte', tipo: 'trail', dal: '2026-12-01', al: '2026-12-01', citta: 'Aosta', provincia: 'AO', regione: 'valle-d-aosta', distanza: 'trail' }
const SANMARINO = { ...base, id: '5', nome: 'Corsa San Marino', dal: '2026-12-05', al: '2026-12-05', citta: 'San Marino', provincia: 'RSM', regione: '', distanza: '10k' }
const GARE = [MILANO, CREMA, ROMA, TRAIL, SANMARINO]

function memoria(iniziale = {}) {
  const dati = { ...iniziale }
  return {
    getItem: k => (k in dati ? dati[k] : null),
    setItem: (k, v) => { dati[k] = String(v) },
    removeItem: k => { delete dati[k] },
    dati,
  }
}

describe('caricaGareCorsa', () => {
  const ADESSO = 1_800_000_000_000
  const supa = (risposta) => ({ functions: { invoke: vi.fn(() => Promise.resolve(risposta)) } })
  const ERRORE = 'Calendario FIDAL non disponibile in questo momento.'

  it('una copia fresca non chiama il server', async () => {
    const storage = memoria({ [CHIAVE_CACHE_GARE_CORSA]: JSON.stringify({ versione: 1, salvate: ADESSO - 1000, gare: GARE }) })
    const s = supa({ data: null, error: null })
    expect(await caricaGareCorsa(s, { adesso: ADESSO, storage })).toEqual({ gare: GARE, errore: null })
    expect(s.functions.invoke).not.toHaveBeenCalled()
  })

  it('una copia scaduta si rinnova dal server e si salva', async () => {
    const storage = memoria({ [CHIAVE_CACHE_GARE_CORSA]: JSON.stringify({ versione: 1, salvate: ADESSO - 13 * 3_600_000, gare: [MILANO] }) })
    const s = supa({ data: { gare: GARE, aggiornate: 'x' }, error: null })
    expect((await caricaGareCorsa(s, { adesso: ADESSO, storage })).gare).toEqual(GARE)
    expect(s.functions.invoke).toHaveBeenCalledWith('gare-corsa', { body: {} })
    const salvata = JSON.parse(storage.dati[CHIAVE_CACHE_GARE_CORSA])
    expect(salvata.salvate).toBe(ADESSO)
    expect(salvata.gare).toEqual(GARE)
  })

  it('una lista incompleta (completa: false) si mostra ma non si salva nel telefono', async () => {
    const storage = memoria()
    const s = supa({ data: { gare: GARE, completa: false }, error: null })
    expect((await caricaGareCorsa(s, { adesso: ADESSO, storage })).gare).toEqual(GARE)
    expect(storage.dati[CHIAVE_CACHE_GARE_CORSA]).toBeUndefined()
  })

  it('server in errore: usa la copia anche vecchia', async () => {
    const storage = memoria({ [CHIAVE_CACHE_GARE_CORSA]: JSON.stringify({ versione: 1, salvate: ADESSO - 30 * 86_400_000, gare: GARE }) })
    const s = supa({ data: null, error: new Error('502') })
    expect(await caricaGareCorsa(s, { adesso: ADESSO, storage })).toEqual({ gare: GARE, errore: null })
  })

  it('server in errore e nessuna copia: lista vuota con il messaggio', async () => {
    const s = supa({ data: null, error: new Error('502') })
    expect(await caricaGareCorsa(s, { adesso: ADESSO, storage: memoria() })).toEqual({ gare: [], errore: ERRORE })
  })

  it('una lista vuota dal server non si salva e senza copia è un errore', async () => {
    const storage = memoria()
    const r = await caricaGareCorsa(supa({ data: { gare: [] }, error: null }), { adesso: ADESSO, storage })
    expect(r).toEqual({ gare: [], errore: ERRORE })
    expect(storage.dati[CHIAVE_CACHE_GARE_CORSA]).toBeUndefined()
  })

  it('una lista di forma vecchia dal server si mostra ma non si salva', async () => {
    const vecchie = GARE.map(({ id, nome, dal }) => ({ id, nome, dal }))
    const storage = memoria()
    const r = await caricaGareCorsa(supa({ data: { gare: vecchie }, error: null }), { adesso: ADESSO, storage })
    expect(r).toEqual({ gare: vecchie, errore: null })
    expect(storage.dati[CHIAVE_CACHE_GARE_CORSA]).toBeUndefined()
  })

  it('una copia di forma vecchia (senza versione) si richiede al server', async () => {
    const storage = memoria({ [CHIAVE_CACHE_GARE_CORSA]: JSON.stringify({ salvate: ADESSO - 1000, gare: GARE }) })
    const s = supa({ data: { gare: GARE }, error: null })
    await caricaGareCorsa(s, { adesso: ADESSO, storage })
    expect(s.functions.invoke).toHaveBeenCalled()
  })
})

describe('formaAttuale', () => {
  it('chiede id, dal, distanza e regione come stringa', () => {
    expect(formaAttuale(GARE)).toBe(true)
    expect(formaAttuale([])).toBe(false)
    expect(formaAttuale(null)).toBe(false)
    expect(formaAttuale([{ id: '1', dal: 'x', distanza: 'mezza' }])).toBe(false)
  })
  it('chiede anche al e nome come stringa', () => {
    expect(formaAttuale([{ ...MILANO, al: undefined }])).toBe(false)
    expect(formaAttuale([{ ...MILANO, nome: undefined }])).toBe(false)
    expect(formaAttuale([{ ...MILANO, nome: 5 }])).toBe(false)
  })
})

describe('filtraCorsa', () => {
  it('regione + distanza + ricerca insieme', () => {
    expect(filtraCorsa(GARE, { regione: 'lombardia', distanza: 'mezza', ricerca: 'crema' }).map(g => g.id)).toEqual(['2'])
  })
  it('la ricerca è senza accenti e vale su nome e città', () => {
    expect(filtraCorsa(GARE, { ricerca: 'meta' }).map(g => g.id)).toEqual(['3'])
    expect(filtraCorsa(GARE, { ricerca: 'aosta trail' }).map(g => g.id)).toEqual(['4'])
  })
  it('filtri vuoti: tutte, anche quella senza regione', () => {
    expect(filtraCorsa(GARE, {})).toHaveLength(5)
  })
  it('con una regione scelta, la gara senza regione è esclusa', () => {
    expect(filtraCorsa(GARE, { regione: 'lombardia' }).map(g => g.id)).toEqual(['1', '2'])
  })
})

describe('regioniPresenti e distanzePresenti', () => {
  it('le regioni, per nome, senza il vuoto', () => {
    expect(regioniPresenti(GARE)).toEqual(['lazio', 'lombardia', 'valle-d-aosta'])
  })
  it('le distanze nell\'ordine di DISTANZE', () => {
    expect(distanzePresenti(GARE)).toEqual(['10k', 'mezza', 'maratona', 'trail'])
  })
})

describe('REGIONI e DISTANZE', () => {
  it('REGIONI ha le 20 regioni di PROVINCE, con lo stesso slug', () => {
    expect(Object.keys(REGIONI)).toHaveLength(20)
    for (const slug of new Set(Object.values(PROVINCE))) expect(REGIONI[slug]).toBeTruthy()
    expect(REGIONI['valle-d-aosta']).toBe("Valle d'Aosta")
  })
  it('DISTANZE in ordine', () => {
    expect(DISTANZE.map(d => d.id)).toEqual(['5k', '10k', 'mezza', 'maratona', 'trail', 'altre'])
  })
})

describe('regione ricordata', () => {
  it('assente = Tutta Italia, e si ricorda anche il vuoto', () => {
    const storage = memoria()
    expect(leggiRegione(storage)).toBe('')
    scriviRegione('lazio', storage)
    expect(leggiRegione(storage)).toBe('lazio')
    scriviRegione('', storage)
    expect(leggiRegione(storage)).toBe('')
    expect(storage.dati[CHIAVE_REGIONE]).toBe('""')
  })
})

describe('sectionsEventoCorsa', () => {
  // 🔴 Mai `hyrox`: le schermate del risultato lo leggono per cercare un tempo su results.hyrox.com.
  it('è un evento normale con i dati della gara sotto `corsa`, e mai `hyrox`', () => {
    const s = sectionsEventoCorsa(CREMA)
    expect(s).toEqual({
      category: 'Event', isEvent: true, isAutonomous: true,
      corsa: { id: '2', distanza: 'mezza', tipo: 'strada', citta: 'Crema', provincia: 'CR', regione: 'lombardia', url: 'u', dal: '2026-11-22', al: '2026-11-22' },
    })
    expect(s).not.toHaveProperty('hyrox')
  })
})
