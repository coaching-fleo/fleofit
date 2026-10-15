import { describe, it, expect } from 'vitest'
import {
  CHIAVE_BOZZA, CHIAVE_VISTO, MAX_CARATTERI, visibiliPer, ordina, daMostrareInHome, testoValido,
  anteprima, routeMessaggio, puoInviareBroadcast, esitoProva, nuovaProva, proveValide, CHIAVE_PROVE,
} from '../messaggiCoach'

// Perché questi test esistono
// ────────────────────────────
// La bacheca «Dal coach» decide cosa vede un atleta. Due errori sono gravi:
// mostrare a un atleta nuovo l'archivio di messaggi scritti prima di lui, e
// far sparire un messaggio fissato perché è «vecchio».

const vecchio = { id: 'v', testo: 'a', fissato: false, creato_at: '2026-09-01T10:00:00Z' }
const vecchioFissato = { id: 'vf', testo: 'b', fissato: true, creato_at: '2026-09-05T10:00:00Z' }
const medio = { id: 'm', testo: 'c', fissato: false, creato_at: '2026-10-02T10:00:00Z' }
const nuovo = { id: 'n', testo: 'd', fissato: false, creato_at: '2026-10-10T10:00:00Z' }
const nuovoFissato = { id: 'nf', testo: 'e', fissato: true, creato_at: '2026-10-11T10:00:00Z' }

describe('visibiliPer', () => {
  const iscrittoIl = '2026-10-01T10:00:00Z'
  it('esclude il vecchio non fissato, tiene fissati e nuovi', () => {
    const ids = visibiliPer([vecchio, vecchioFissato, nuovo], { iscrittoIl, coach: false }).map((m) => m.id)
    expect(ids).toEqual(['vf', 'n'])
  })
  it('il coach vede tutto', () => {
    expect(visibiliPer([vecchio, nuovo], { iscrittoIl, coach: true })).toHaveLength(2)
  })
  it('senza data di iscrizione si vede tutto', () => {
    expect(visibiliPer([vecchio, nuovo], { iscrittoIl: null, coach: false })).toHaveLength(2)
    expect(visibiliPer([vecchio, nuovo], { iscrittoIl: undefined, coach: false })).toHaveLength(2)
  })
  it('confronta le date come istanti, non come stringhe', () => {
    const m = { id: 'x', fissato: false, creato_at: '2026-10-01T10:00:00.000+00:00' }
    expect(visibiliPer([m], { iscrittoIl: '2026-10-01T10:00:00Z', coach: false })).toHaveLength(1)
    const prima = { id: 'y', fissato: false, creato_at: '2026-10-01T11:30:00+02:00' } // 09:30Z
    expect(visibiliPer([prima], { iscrittoIl: '2026-10-01T10:00:00Z', coach: false })).toHaveLength(0)
  })
})

describe('ordina', () => {
  it('fissati prima, poi il più recente; non muta l\'input', () => {
    const input = [nuovo, vecchioFissato, medio, nuovoFissato]
    const copia = [...input]
    expect(ordina(input).map((m) => m.id)).toEqual(['nf', 'vf', 'n', 'm'])
    expect(input).toEqual(copia)
  })
})

describe('daMostrareInHome', () => {
  it('vuoto -> null', () => expect(daMostrareInHome([], null)).toBeNull())
  it('già visto -> null', () => {
    expect(daMostrareInHome([nuovo, medio], nuovo.creato_at)).toBeNull()
  })
  it('più vecchio del più recente -> il più recente', () => {
    expect(daMostrareInHome([medio, nuovo], medio.creato_at).id).toBe('n')
  })
  it('null -> il più recente', () => expect(daMostrareInHome([medio, nuovo], null).id).toBe('n'))
  it('un fissato vecchio già visto non ricompare', () => {
    expect(daMostrareInHome([vecchioFissato], '2026-10-01T00:00:00Z')).toBeNull()
  })
})

describe('testoValido', () => {
  it('rifiuta vuoto e soli spazi', () => {
    expect(testoValido('')).toBe(false)
    expect(testoValido('   \n  ')).toBe(false)
  })
  it('accetta fino al massimo', () => {
    expect(testoValido('Ciao')).toBe(true)
    expect(testoValido('a'.repeat(MAX_CARATTERI))).toBe(true)
    expect(testoValido('a'.repeat(MAX_CARATTERI + 1))).toBe(false)
  })
})

describe('costanti e riesportazioni', () => {
  it('ci sono', () => {
    expect(CHIAVE_BOZZA).toBe('fleofit_messaggio_bozza')
    expect(CHIAVE_VISTO).toBe('fleofit_messaggi_visto_fino')
    expect(MAX_CARATTERI).toBe(2000)
    expect(typeof anteprima).toBe('function')
    expect(typeof routeMessaggio).toBe('function')
    expect(typeof puoInviareBroadcast).toBe('function')
  })
})

describe('esitoProva', () => {
  it('chiamata fallita o nessun dispositivo: errore', () => {
    expect(esitoProva(null)).toEqual({ errore: true, testo: 'La prova non è partita. Controlla la connessione e riprova.' })
    expect(esitoProva({ success: true, sent: 0 })).toEqual({ errore: true, testo: 'Nessun tuo dispositivo ha le notifiche attive' })
  })
  it('«mandata» solo se Firebase l\'ha accettata', () => {
    expect(esitoProva({ sent: 1, consegnate: 1, motivi: [] })).toEqual({ errore: false, testo: 'Prova mandata ai tuoi dispositivi (1)' })
    expect(esitoProva({ sent: 2, consegnate: 1, motivi: ['HTTP_500'] })).toEqual({ errore: false, testo: 'Prova mandata a 1 dei tuoi 2 dispositivi' })
  })
  it('rifiutata per la build di sviluppo: lo dice in chiaro', () => {
    const e = esitoProva({ sent: 1, consegnate: 0, motivi: ['THIRD_PARTY_AUTH_ERROR'] })
    expect(e.errore).toBe(true)
    expect(e.testo).toMatch(/Xcode in modalità sviluppo/)
  })
  it('rifiutata per altro: riporta il motivo', () => {
    expect(esitoProva({ sent: 1, consegnate: 0, motivi: ['INVALID_ARGUMENT'] })).toEqual({ errore: true, testo: 'Firebase ha rifiutato la notifica (INVALID_ARGUMENT)' })
  })
  it('un server di prima senza `consegnate`: conta i dispositivi', () => {
    expect(esitoProva({ success: true, sent: 2 })).toEqual({ errore: false, testo: 'Prova mandata ai tuoi dispositivi (2)' })
  })
})

describe('prove in bacheca (temporaneo)', () => {
  it('nuovaProva ha la forma di un messaggio, segnata come prova', () => {
    const p = nuovaProva({ testo: '  Ciao  ', fissato: true }, new Date('2026-10-15T10:00:00Z'))
    expect(p.id).toMatch(/^prova-[a-z0-9]+$/)
    expect(p).toMatchObject({ testo: 'Ciao', fissato: true, creato_at: '2026-10-15T10:00:00.000Z', modificato_at: null, prova: true })
  })
  it('proveValide scarta ciò che non è una prova', () => {
    const buona = nuovaProva({ testo: 'x', fissato: false })
    expect(proveValide([buona, { id: 'm1', testo: 'vero' }, null, 'x'])).toEqual([buona])
    expect(proveValide(null)).toEqual([])
    expect(CHIAVE_PROVE).toBe('fleofit_messaggi_prova')
  })
})
