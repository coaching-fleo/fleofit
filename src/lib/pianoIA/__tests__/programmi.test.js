import { describe, it, expect } from 'vitest'
import { validaProgramma, punteggioProgramma, scegliProgramma, SOGLIA_PROGRAMMA } from '../programmi.js'
import { p12x4, p12x3, p8senza, profiloMigliorare, profiloSenzaGara } from './fixtureProgrammi.js'

describe('punteggioProgramma', () => {
  it('famiglia diversa = escluso', () =>
    expect(punteggioProgramma({ ...p12x4, famiglia: 'prima_gara' }, profiloMigliorare)).toBe(0))

  it('sedute: uguali +40, ±1 +20, ±2 escluso', () => {
    expect(punteggioProgramma(p12x4, { ...profiloMigliorare, sedute: 4 })).toBe(100)
    expect(punteggioProgramma(p12x4, { ...profiloMigliorare, sedute: 5 })).toBe(80)
    expect(punteggioProgramma(p12x4, { ...profiloMigliorare, sedute: 6 })).toBe(0)
  })

  it('livello: uguale +30, adiacente +10, opposto escluso', () => {
    expect(punteggioProgramma(p12x4, { ...profiloMigliorare, livello: 'avanzato' })).toBe(80)
    expect(punteggioProgramma({ ...p12x4, livello: 'principiante' }, { ...profiloMigliorare, livello: 'avanzato' })).toBe(0)
  })

  it('settimane alla gara: da L a L+4 +30, da L-3 a L-1 +15, fuori escluso', () => {
    expect(punteggioProgramma(p12x4, { ...profiloMigliorare, settimaneAllaGara: 16 })).toBe(100)
    expect(punteggioProgramma(p12x4, { ...profiloMigliorare, settimaneAllaGara: 17 })).toBe(0)
    expect(punteggioProgramma(p12x4, { ...profiloMigliorare, settimaneAllaGara: 9 })).toBe(85)
    expect(punteggioProgramma(p12x4, { ...profiloMigliorare, settimaneAllaGara: 8 })).toBe(0)
  })

  it('senza gara: famiglia senza_gara vale +30 per le settimane', () =>
    expect(punteggioProgramma(p8senza, profiloSenzaGara)).toBe(100))

  it('gara già passata (settimane null) = trattata come senza gara', () => {
    const passata = { ...profiloMigliorare, settimaneAllaGara: null, sedute: 3 }
    expect(punteggioProgramma(p12x3, passata)).toBe(0)
    expect(punteggioProgramma(p8senza, passata)).toBe(100)
  })
})

describe('scegliProgramma', () => {
  it('il migliore sopra soglia, null sotto', () => {
    expect(SOGLIA_PROGRAMMA).toBe(60)
    expect(scegliProgramma([p12x4, p12x3], { ...profiloMigliorare, sedute: 3 }).programma.id).toBe(p12x3.id)
    expect(scegliProgramma([p12x4], { ...profiloMigliorare, sedute: 6 })).toBeNull()
    expect(scegliProgramma([], profiloMigliorare)).toBeNull()
  })

  it('settimaneUsate: allunga ripetendo le settimane di base, accorcia togliendo le prime di base, mai lo scarico né le ultime 2', () => {
    expect(scegliProgramma([p12x4], { ...profiloMigliorare, settimaneAllaGara: 14 }).settimaneUsate)
      .toEqual([0, 1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
    expect(scegliProgramma([p12x4], { ...profiloMigliorare, settimaneAllaGara: 10 }).settimaneUsate)
      .toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
    const tre = scegliProgramma([p12x4], { ...profiloMigliorare, settimaneAllaGara: 9 }).settimaneUsate
    expect(tre).toHaveLength(9)
    expect(tre).toContain(3)
    expect(tre.slice(-2)).toEqual([10, 11])
  })

  it('senza gara usa tutte le settimane del programma', () =>
    expect(scegliProgramma([p8senza], profiloSenzaGara).settimaneUsate).toEqual([0, 1, 2, 3, 4, 5, 6, 7]))
})

describe('validaProgramma', () => {
  it('un programma corretto non ha errori', () => expect(validaProgramma(p12x4)).toEqual([]))

  it('ultima settimana fase gara se la famiglia ha una gara', () =>
    expect(validaProgramma({ ...p12x4, settimane: p12x4.settimane.slice(0, -1) })).toContain('ultima settimana non è gara'))

  it('sedute per settimana diverse da quelle del programma, minuti non positivi', () => {
    const settimane = p12x4.settimane.map((s, i) => (i === 2 ? { ...s, sedute: s.sedute.slice(1), minuti: 0 } : s))
    const errori = validaProgramma({ ...p12x4, settimane })
    expect(errori).toContain('settimana 3: 3 sedute invece di 4')
    expect(errori).toContain('settimana 3: minuti non validi')
  })
})
