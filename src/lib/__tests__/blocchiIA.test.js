import { describe, it, expect } from 'vitest'
import { preparaBlocchiIA, intensitaValida, INTENSITA_PREDEFINITA } from '../blocchiIA'

describe('intensitaValida', () => {
  it('legge i formati che un modello può restituire', () => {
    expect(intensitaValida(7)).toBe('7')
    expect(intensitaValida('7')).toBe('7')
    expect(intensitaValida('7/10')).toBe('7')
    expect(intensitaValida('8.5')).toBe('9')
    expect(intensitaValida('6,4')).toBe('6')
  })

  it('tiene la scala fra 1 e 10', () => {
    expect(intensitaValida(14)).toBe('10')
    expect(intensitaValida(0)).toBeNull()
  })

  it('torna null quando non c’è un numero', () => {
    expect(intensitaValida(undefined)).toBeNull()
    expect(intensitaValida(null)).toBeNull()
    expect(intensitaValida('')).toBeNull()
    expect(intensitaValida('alta')).toBeNull()
  })
})

describe('preparaBlocchiIA', () => {
  it('dà un’intensità a ogni esercizio che non l’ha dettata', () => {
    const [b] = preparaBlocchiIA([{ type: 'EMOM', params: {}, exercises: [{ name: 'Burpees', reps: '15' }] }])
    expect(b.exercises[0].intensity).toBe(INTENSITA_PREDEFINITA)
  })

  it('tiene quella scritta da Gemini, normalizzata', () => {
    const [b] = preparaBlocchiIA([{ type: 'AMRAP', exercises: [{ name: 'Wall Balls', reps: '20', intensity: 8 }] }])
    expect(b.exercises[0].intensity).toBe('8')
  })

  it('non mette intensità su Rest, come il picker', () => {
    const [b] = preparaBlocchiIA([{ type: 'Interval', exercises: [{ name: 'Rest', exTime: '1:00', intensity: '3' }] }])
    expect(b.exercises[0]).not.toHaveProperty('intensity')
  })

  it('aggiunge gli id e lascia il resto com’è', () => {
    const [b] = preparaBlocchiIA([{ type: 'Rest', params: { duration: '2:00' } }])
    expect(typeof b.id).toBe('number')
    expect(b.params).toEqual({ duration: '2:00' })
    expect(b.exercises).toEqual([])
  })

  it('regge una risposta che non è un array', () => {
    expect(preparaBlocchiIA(null)).toEqual([])
    expect(preparaBlocchiIA({ blocks: [] })).toEqual([])
    expect(preparaBlocchiIA([null, 3])).toEqual([])
  })
})
