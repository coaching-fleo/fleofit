import { describe, it, expect } from 'vitest'
import { modoFoto, larghezzaAncorata } from '../testataFoto'

describe('modoFoto', () => {
  it('telefono: una foto verticale nel foglio da 375×252 resta piena', () => {
    expect(modoFoto(900, 1200, 375, 252)).toBe('piena')     // si vede il 50%
  })
  it('desktop: la stessa foto nella finestra da 440×236 si ancora a destra', () => {
    expect(modoFoto(900, 1200, 440, 236)).toBe('ancorata')  // si vedrebbe il 40%
  })
  it('una testata larghissima (scheda atleta sul desktop) ancora anche una foto quadrata', () => {
    expect(modoFoto(1000, 1000, 1240, 260)).toBe('ancorata')
  })
  it('una foto orizzontale resta piena', () => {
    expect(modoFoto(1600, 900, 440, 236)).toBe('piena')
  })
  it('senza misure è piena', () => {
    expect(modoFoto(0, 0, 375, 252)).toBe('piena')
    expect(modoFoto(900, 1200, undefined, 252)).toBe('piena')
  })
})

describe('larghezzaAncorata', () => {
  it('sulla scheda desktop (1240×300) una foto 3:4 si allarga a 375px, se ne vede il 60%', () => {
    expect(larghezzaAncorata(900, 1200, 1240, 300)).toBe(375)
  })
  it('nella finestra del foglio (440×236) non supera l\'82%', () => {
    expect(larghezzaAncorata(900, 1200, 440, 236)).toBe(295)
    expect(larghezzaAncorata(1000, 1000, 440, 236)).toBe(361)
  })
  it('senza misure null', () => {
    expect(larghezzaAncorata(0, 0, 440, 236)).toBeNull()
  })
})
