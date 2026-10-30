import { describe, it, expect } from 'vitest'
import {
  TIPI_PER_CATEGORIA, MINUTI_MINIMI, FRAZIONE_STIMA, GIORNI_MASSIMI, scegliAbbinamento, minutiMinimi,
} from '../../../supabase/functions/_shared/abbinaGarmin.ts'

const COLLEGATO = '2026-10-01T00:00:00Z'
const attivita = (o = {}) => ({
  giorno: '2026-10-28', tipo: 'RUNNING', durata_s: 40 * 60,
  inizio: '2026-10-28T07:00:00Z', abbinamento: null, athlete_workout_id: null, ...o,
})
const cand = (o = {}) => ({
  id: 'aw1', giorno: '2026-10-28', categoria: 'Running', completato: false, durataStimataMin: null, ...o,
})
const scegli = (a, c = [cand()]) => scegliAbbinamento({ attivita: attivita(a), candidati: c, collegatoAt: COLLEGATO })

describe('tabella dei tipi', () => {
  it('ha i valori attesi e niente Custom/Event', () => {
    expect(Object.keys(TIPI_PER_CATEGORIA).sort()).toEqual(['Gym', 'Hyrox', 'Running'])
    expect(MINUTI_MINIMI).toBe(10)
    expect(FRAZIONE_STIMA).toBe(0.5)
  })
  const TUTTI = [...new Set(Object.values(TIPI_PER_CATEGORIA).flat()), 'CYCLING', 'YOGA']
  for (const [cat, tipi] of Object.entries(TIPI_PER_CATEGORIA)) {
    for (const t of TUTTI) {
      const ok = tipi.includes(t)
      it(`${cat} + ${t} -> ${ok ? 'completa' : 'no'}`, () => {
        expect(scegli({ tipo: t }, [cand({ categoria: cat })])).toBe(ok ? 'aw1' : null)
      })
    }
  }
  it('Custom, Event, null e sconosciute mai', () => {
    for (const categoria of ['Custom', 'Event', null, 'Altro']) {
      expect(scegli({ tipo: 'RUNNING' }, [cand({ categoria })])).toBeNull()
    }
  })
})

describe('durata', () => {
  it('9:59 no, 10:00 si', () => {
    expect(scegli({ durata_s: 599 })).toBeNull()
    expect(scegli({ durata_s: 600 })).toBe('aw1')
  })
  it('durata null no', () => expect(scegli({ durata_s: null })).toBeNull())
  it('stima 60: 29 no, 30 si', () => {
    const c = [cand({ durataStimataMin: 60 })]
    expect(scegli({ durata_s: 29 * 60 }, c)).toBeNull()
    expect(scegli({ durata_s: 30 * 60 }, c)).toBe('aw1')
  })
  it('stima assente, 12 minuti si', () => expect(scegli({ durata_s: 12 * 60 })).toBe('aw1'))
})

describe('esclusioni', () => {
  it('due candidati -> null', () => {
    expect(scegli({}, [cand(), cand({ id: 'aw2' })])).toBeNull()
  })
  it('nessun candidato -> null', () => expect(scegli({}, [])).toBeNull())
  it('già completato escluso (resta l\'altro)', () => {
    expect(scegli({}, [cand({ completato: true }), cand({ id: 'aw2' })])).toBe('aw2')
  })
  it('giorno diverso -> null', () => {
    expect(scegli({}, [cand({ giorno: '2026-10-27' })])).toBeNull()
  })
  it('prima del collegamento -> null (confronto come istanti)', () => {
    expect(scegli({ inizio: '2026-09-30T23:59:59Z' })).toBeNull()
    expect(scegli({ inizio: '2026-10-01T01:59:59+02:00' })).toBeNull()
    expect(scegli({ inizio: '2026-10-01T00:00:00Z' })).toBe('aw1')
  })
  it('già abbinata -> null', () => expect(scegli({ athlete_workout_id: 'x', abbinamento: 'auto' })).toBeNull())
  it('«Non era questo» (abbinamento atleta, id nullo) -> null', () => {
    expect(scegli({ abbinamento: 'atleta', athlete_workout_id: null })).toBeNull()
  })
})

describe('attività arrivata tardi (backfill di un ricollegamento)', () => {
  const conAdesso = (adesso) => scegliAbbinamento({ attivita: attivita(), candidati: [cand()], collegatoAt: COLLEGATO, adesso })
  it('una settimana è il limite', () => expect(GIORNI_MASSIMI).toBe(7))
  it('arrivata il giorno dopo completa', () => expect(conAdesso('2026-10-29T07:00:00Z')).toBe('aw1'))
  it('arrivata 7 giorni dopo, esatti, completa', () => expect(conAdesso('2026-11-04T07:00:00Z')).toBe('aw1'))
  it('arrivata più di 7 giorni dopo non completa', () => expect(conAdesso('2026-11-04T07:00:01Z')).toBe(null))
})

describe('soglia regolabile (GARMIN_MINUTI_MINIMI, solo per le prove)', () => {
  it('🔴 senza secret, o con un valore sbagliato, resta 10', () => {
    for (const v of [undefined, '', 'abc', '0', '-3', '2.5', '61']) expect(minutiMinimi(v)).toBe(MINUTI_MINIMI)
  })

  it('un intero da 1 a 60 vale', () => {
    expect(minutiMinimi('1')).toBe(1)
    expect(minutiMinimi(' 5 ')).toBe(5)
    expect(minutiMinimi('60')).toBe(60)
  })

  it('con la soglia a 1, una corsa da 1:06 completa; da 0:59 no', () => {
    const con1 = (durata_s) => scegliAbbinamento({ attivita: attivita({ durata_s }), candidati: [cand()], collegatoAt: COLLEGATO, minutiMinimi: 1 })
    expect(con1(66)).toBe('aw1')
    expect(con1(59)).toBeNull()
  })

  it('senza minutiMinimi la regola è quella di sempre', () => {
    expect(scegli({ durata_s: 66 })).toBeNull()
  })
})
