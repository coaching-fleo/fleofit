import { describe, it, expect, vi } from 'vitest'
import {
  gareFuture, cercaGare, periodoGara, giorniGara, giornoProposto, sectionsEvento, caricaGare, CHIAVE_CACHE_GARE,
} from '../gareHyrox'

// Perché questi test esistono
// ────────────────────────────
// La lista delle gare arriva da un sito che non controlliamo, quindi conta
// soprattutto cosa succede quando NON arriva: la copia del telefono deve
// bastare, anche vecchia, e senza copia la modale deve sapere che non c'è
// niente (e ripiegare sul campo libero) invece di mostrare una lista vuota.

const VALENCIA = { id: '1', nome: 'HYROX Valencia', codice: 'VLC', dal: '2026-10-15', al: '2026-10-18', url: 'https://hyrox.com/event/hyrox-valencia/' }
const SAO_PAULO = { id: '2', nome: 'HYROX São Paulo', codice: 'SPO', dal: '2026-10-17', al: '2026-10-18', url: 'u' }
const AMBURGO = { id: '3', nome: 'INTERSPORT HYROX Hamburg', codice: 'HAM', dal: '2026-10-28', al: '2026-11-01', url: 'u' }
const GARE = [VALENCIA, SAO_PAULO, AMBURGO]

function memoria(iniziale = {}) {
  const dati = { ...iniziale }
  return {
    getItem: k => (k in dati ? dati[k] : null),
    setItem: (k, v) => { dati[k] = String(v) },
    removeItem: k => { delete dati[k] },
    dati,
  }
}

describe('gareFuture', () => {
  it('una gara iniziata ma non finita si può ancora scegliere', () => {
    expect(gareFuture(GARE, '2026-10-18').map(g => g.id)).toEqual(['1', '2', '3'])
    expect(gareFuture(GARE, '2026-10-19').map(g => g.id)).toEqual(['3'])
  })
})

describe('cercaGare', () => {
  it('cerca nel nome e nel codice, senza accenti e senza maiuscole', () => {
    expect(cercaGare(GARE, 'sao').map(g => g.id)).toEqual(['2'])
    expect(cercaGare(GARE, 'vlc').map(g => g.id)).toEqual(['1'])
    expect(cercaGare(GARE, 'hyrox hamb').map(g => g.id)).toEqual(['3'])
  })
  it('una ricerca vuota tiene tutto', () => {
    expect(cercaGare(GARE, '  ')).toHaveLength(3)
  })
})

describe('giorniGara e giornoProposto', () => {
  it('elenca i giorni, anche a cavallo di due mesi', () => {
    expect(giorniGara(VALENCIA)).toEqual(['2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18'])
    expect(giorniGara(AMBURGO)).toEqual(['2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'])
  })
  it('una gara di un giorno ha un giorno solo', () => {
    expect(giorniGara({ dal: '2026-10-17', al: '2026-10-17' })).toEqual(['2026-10-17'])
  })
  it('propone il giorno selezionato nel calendario se cade nella gara, altrimenti il primo', () => {
    expect(giornoProposto(VALENCIA, '2026-10-17')).toBe('2026-10-17')
    expect(giornoProposto(VALENCIA, '2026-10-12')).toBe('2026-10-15')
  })
})

describe('periodoGara', () => {
  it('un giorno, più giorni nello stesso mese, a cavallo di due mesi e di due anni', () => {
    expect(periodoGara({ dal: '2026-10-17', al: '2026-10-17' })).toBe('17 ott 2026')
    expect(periodoGara(VALENCIA)).toBe('15–18 ott 2026')
    expect(periodoGara(AMBURGO)).toBe('28 ott – 1 nov 2026')
    expect(periodoGara({ dal: '2026-12-31', al: '2027-01-02' })).toBe('31 dic 2026 – 2 gen 2027')
  })
})

describe('sectionsEvento', () => {
  it('resta un evento normale, con la gara in più', () => {
    expect(sectionsEvento(VALENCIA)).toEqual({
      category: 'Event', isEvent: true, isAutonomous: true,
      hyrox: { id: '1', codice: 'VLC', url: 'https://hyrox.com/event/hyrox-valencia/', dal: '2026-10-15', al: '2026-10-18' },
    })
  })
  it('senza gara è l\'evento di sempre', () => {
    expect(sectionsEvento(null)).toEqual({ category: 'Event', isEvent: true, isAutonomous: true })
  })
})

describe('caricaGare', () => {
  const ADESSO = 1_800_000_000_000
  const supa = (risposta) => ({ functions: { invoke: vi.fn(() => Promise.resolve(risposta)) } })

  it('una copia fresca non chiama il server', async () => {
    const storage = memoria({ [CHIAVE_CACHE_GARE]: JSON.stringify({ salvate: ADESSO - 1000, gare: GARE }) })
    const s = supa({ data: null, error: null })
    expect(await caricaGare(s, { adesso: ADESSO, storage })).toEqual({ gare: GARE, errore: null })
    expect(s.functions.invoke).not.toHaveBeenCalled()
  })

  it('senza copia chiede al server e salva', async () => {
    const storage = memoria()
    const s = supa({ data: { gare: GARE }, error: null })
    expect((await caricaGare(s, { adesso: ADESSO, storage })).gare).toEqual(GARE)
    expect(s.functions.invoke).toHaveBeenCalledWith('gare-hyrox', { body: {} })
    expect(JSON.parse(storage.dati[CHIAVE_CACHE_GARE]).salvate).toBe(ADESSO)
  })

  it('server giù: usa la copia anche vecchia', async () => {
    const storage = memoria({ [CHIAVE_CACHE_GARE]: JSON.stringify({ salvate: ADESSO - 30 * 86_400_000, gare: GARE }) })
    const s = supa({ data: null, error: new Error('502') })
    expect(await caricaGare(s, { adesso: ADESSO, storage })).toEqual({ gare: GARE, errore: null })
  })

  it('server giù e nessuna copia: un errore, non una lista vuota spacciata per vera', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const r = await caricaGare(supa({ data: { gare: [] }, error: null }), { adesso: ADESSO, storage: memoria() })
    expect(r.gare).toEqual([])
    expect(r.errore).toMatch(/non disponibile/)
  })
})
