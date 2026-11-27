import { describe, it, expect } from 'vitest'
import { PREZZI, costoChiamata, costoMensileUtente, IPOTESI_SPEC } from '../costi.js'

describe('costi', () => {
  it('i prezzi Anthropic sono quelli della spec', () => {
    expect(PREZZI['claude-haiku-5-5']).toMatchObject({ in: 0.10, out: 0.50 })
    expect(PREZZI['claude-sonnet-5-5']).toEqual({ in: 2, out: 10, cache: 0.10 })
    expect(PREZZI['claude-opus-5-5']).toEqual({ in: 4, out: 20, cache: 0.20 })
  })

  it('adattamento della spec: 10k + 20k in cache + 12k in uscita su Sonnet ≈ 0,142 $', () =>
    expect(costoChiamata({ modello: 'claude-sonnet-5-5', tokenIn: 10_000, tokenInCache: 20_000, tokenOut: 12_000 })).toBeCloseTo(0.142, 3))

  it('batch dimezza', () =>
    expect(costoChiamata({ modello: 'claude-sonnet-5-5', tokenIn: 10_000, tokenInCache: 15_000, tokenOut: 8_000, batch: true })).toBeCloseTo(0.0508, 3))

  it('analisi Haiku 6k/1,5k ≈ 0,00135 $', () =>
    expect(costoChiamata({ modello: 'claude-haiku-5-5', tokenIn: 6_000, tokenOut: 1_500 })).toBeCloseTo(0.00135, 5))

  it('costoMensileUtente(IPOTESI_SPEC) torna il totale della spec, fra 0,40 e 0,46 $', () => {
    const { voci, totale } = costoMensileUtente(IPOTESI_SPEC)
    expect(Object.keys(voci)).toEqual(['adattamento', 'revisione', 'rete', 'analisi'])
    expect(voci.revisione).toBeCloseTo(0.262, 2)
    expect(totale).toBeGreaterThan(0.40)
    expect(totale).toBeLessThan(0.46)
  })

  it('modello sconosciuto → eccezione con il nome', () =>
    expect(() => costoChiamata({ modello: 'x', tokenIn: 1, tokenOut: 1 })).toThrow('x'))
})
