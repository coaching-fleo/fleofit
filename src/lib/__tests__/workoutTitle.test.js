import { describe, it, expect } from 'vitest'
import { generaTitolo, titoloOppureGenerato, ETICHETTA_AUTOMATICA } from '../workoutTitle'

// Perché questi test esistono: `workouts.title` è letto in 66 punti (scheda,
// archivio, PDF, story IG, TV, testo delle push) e il database è condiviso con
// la web app. Un titolo vuoto o duplicato non è un difetto estetico: è una
// scheda senza nome dentro l'altra applicazione.
describe('generaTitolo', () => {
  it('usa il giorno abbreviato in italiano', () => {
    expect(generaTitolo('2026-08-25')).toBe('Allenamento libero · mar 25 ago')
  })

  it('numera i duplicati dello stesso giorno invece di ripetersi', () => {
    const primo = generaTitolo('2026-08-25')
    expect(generaTitolo('2026-08-25', [primo])).toBe(`${primo} (2)`)
    expect(generaTitolo('2026-08-25', [primo, `${primo} (2)`])).toBe(`${primo} (3)`)
  })

  it('regge una data mancante o non valida senza produrre "Invalid Date"', () => {
    for (const brutta of [null, undefined, '', 'non-una-data', {}]) {
      const t = generaTitolo(brutta)
      expect(t).toBe(ETICHETTA_AUTOMATICA)
      expect(t).not.toMatch(/Invalid/i)
    }
  })

  it('accetta sia una stringa ISO sia un oggetto Date', () => {
    expect(generaTitolo(new Date('2026-12-31'))).toBe(generaTitolo('2026-12-31'))
  })
})

describe('titoloOppureGenerato', () => {
  it('non tocca il titolo scritto dall utente', () => {
    expect(titoloOppureGenerato('Corsa 10k', '2026-08-25')).toBe('Corsa 10k')
  })

  it('non restituisce MAI una stringa vuota', () => {
    for (const vuoto of ['', '   ', '\n', null, undefined]) {
      expect(titoloOppureGenerato(vuoto, '2026-08-25').trim().length).toBeGreaterThan(0)
    }
  })
})
