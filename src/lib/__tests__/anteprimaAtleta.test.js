import { describe, it, expect, beforeEach } from 'vitest'
import { CHIAVE_ANTEPRIMA, chiudiAnteprimaSeNonAdmin, chiudiAnteprima } from '../anteprimaAtleta'

// Segnalazione del 18/11/2026: sullo stesso telefono un admin attiva
// «Visualizza come atleta», esce, ed entra con un atleta vero. La spunta era
// rimasta: le Impostazioni lo trattavano da admin in anteprima (righe admin
// visibili, niente Garmin né consenso).
describe('anteprima atleta', () => {
  beforeEach(() => localStorage.clear())

  it('chi entra senza essere admin la trova spenta', () => {
    localStorage.setItem(CHIAVE_ANTEPRIMA, 'athlete')
    chiudiAnteprimaSeNonAdmin(null)
    expect(localStorage.getItem(CHIAVE_ANTEPRIMA)).toBeNull()
    localStorage.setItem(CHIAVE_ANTEPRIMA, 'athlete')
    chiudiAnteprimaSeNonAdmin('coach')
    expect(localStorage.getItem(CHIAVE_ANTEPRIMA)).toBeNull()
  })

  it("l'admin la ritrova accesa", () => {
    localStorage.setItem(CHIAVE_ANTEPRIMA, 'athlete')
    chiudiAnteprimaSeNonAdmin('admin')
    expect(localStorage.getItem(CHIAVE_ANTEPRIMA)).toBe('athlete')
  })

  it("uscendo dall'account si spegne", () => {
    localStorage.setItem(CHIAVE_ANTEPRIMA, 'athlete')
    chiudiAnteprima()
    expect(localStorage.getItem(CHIAVE_ANTEPRIMA)).toBeNull()
  })
})
