import { describe, it, expect } from 'vitest'
import { angoliTrasparenti, estDelBlob } from '../fotoScarpa'

// Gli unici pezzi puri di fotoScarpa.js: riduciFoto usa il canvas, che jsdom non ha.

const px = (...alpha) => {
  const d = new Uint8ClampedArray(alpha.length * 4)
  alpha.forEach((a, i) => { d[i * 4 + 3] = a })
  return d
}

describe('angoliTrasparenti', () => {
  it('2×2 tutta trasparente → true', () => {
    expect(angoliTrasparenti(px(0, 0, 0, 0), 2, 2)).toBe(true)
  })
  it('un angolo opaco → false', () => {
    expect(angoliTrasparenti(px(0, 0, 0, 255), 2, 2)).toBe(false)
  })
  it('guarda solo gli angoli di una 3×3', () => {
    expect(angoliTrasparenti(px(0, 255, 0, 255, 255, 255, 0, 255, 0), 3, 3)).toBe(true)
  })
  it('soglia: alpha 16 non è trasparente', () => {
    expect(angoliTrasparenti(px(15, 15, 15, 16), 2, 2)).toBe(false)
  })
})

describe('estDelBlob', () => {
  it('webp se il blob è webp, altrimenti png', () => {
    expect(estDelBlob({ type: 'image/webp' })).toBe('webp')
    expect(estDelBlob({ type: 'image/png' })).toBe('png')
    expect(estDelBlob({ type: '' })).toBe('png')
    expect(estDelBlob(null)).toBe('png')
  })
})
