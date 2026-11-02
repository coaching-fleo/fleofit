import { describe, it, expect } from 'vitest'
import { codiceDaQR, contenutoQR } from '../codiceTV'

describe('contenutoQR', () => {
  it('scrive il link della TV con il codice a quattro cifre', () => {
    expect(contenutoQR('1234')).toBe('fleofit://tv/1234')
  })
})

describe('codiceDaQR', () => {
  it('legge il codice da un link ben formato', () => {
    expect(codiceDaQR('fleofit://tv/1234')).toBe('1234')
  })

  it('tollera spazi attorno al testo letto dalla fotocamera', () => {
    expect(codiceDaQR(' fleofit://tv/5678 ')).toBe('5678')
  })

  it('rifiuta tutto ciò che non è un link della TV', () => {
    expect(codiceDaQR('https://example.com')).toBeNull()
    expect(codiceDaQR('fleofit://tv/123')).toBeNull()
    expect(codiceDaQR('fleofit://tv/12345')).toBeNull()
    expect(codiceDaQR('fleofit://tv/abcd')).toBeNull()
    expect(codiceDaQR('')).toBeNull()
    expect(codiceDaQR(undefined)).toBeNull()
  })

  it('torna indietro da contenutoQR', () => {
    expect(codiceDaQR(contenutoQR('4321'))).toBe('4321')
  })
})
