import { describe, it, expect } from 'vitest'
import { parseNotesAndRpe, formatNotesWithRpe } from '../rpe'

// L'RPE vive dentro athlete_workouts.notes come "[RPE: 7/10]\ntesto". La web app
// su main NON conosce questo formato: se distruggiamo noi il prefisso, il dato è
// perso e le statistiche ricadono in silenzio sul default 5.
describe('parseNotesAndRpe', () => {
  it('separa il valore dal testo', () => {
    expect(parseNotesAndRpe('[RPE: 7/10]\nGambe pesanti')).toEqual({ rpe: 7, text: 'Gambe pesanti' })
  })

  it('accetta una nota senza prefisso e non inventa un valore diverso da 5', () => {
    expect(parseNotesAndRpe('Solo testo')).toEqual({ rpe: 5, text: 'Solo testo' })
  })

  it('regge nota assente o vuota', () => {
    expect(parseNotesAndRpe(null)).toEqual({ rpe: 5, text: '' })
    expect(parseNotesAndRpe('')).toEqual({ rpe: 5, text: '' })
  })

  it('non confonde un [RPE:] che compare a metà testo', () => {
    const nota = 'ieri avevo [RPE: 9/10] oggi meglio'
    expect(parseNotesAndRpe(nota)).toEqual({ rpe: 5, text: nota })
  })
})

describe('andata e ritorno', () => {
  it('conserva valore e testo attraverso format → parse', () => {
    for (const rpe of [1, 5, 10]) {
      for (const testo of ['', 'una riga', 'due\nrighe']) {
        expect(parseNotesAndRpe(formatNotesWithRpe(rpe, testo))).toEqual({ rpe, text: testo })
      }
    }
  })

  it('non perde l RPE rileggendo una nota già formattata', () => {
    const prima = formatNotesWithRpe(8, 'ok')
    const { rpe, text } = parseNotesAndRpe(prima)
    expect(formatNotesWithRpe(rpe, text)).toBe(prima)
  })
})
