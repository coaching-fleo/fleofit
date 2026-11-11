import { describe, it, expect } from 'vitest'
import { HYROX_EXERCISES, STAZIONI_HYROX, FAMIGLIE_HYROX, misuraEsercizio, conBox, ALTEZZE_BOX, testoBox } from '../esercizi'

describe('le famiglie della lista esercizi', () => {
  const messi = FAMIGLIE_HYROX.flatMap(f => f.voci)

  it('ogni esercizio ha una famiglia', () => {
    expect(HYROX_EXERCISES.filter(n => !messi.includes(n))).toEqual([])
  })

  it('nelle famiglie ci sono solo esercizi veri, una volta per famiglia', () => {
    expect(messi.filter(n => !HYROX_EXERCISES.includes(n))).toEqual([])
    for (const f of FAMIGLIE_HYROX) expect(new Set(f.voci).size).toBe(f.voci.length)
  })

  it('le otto stazioni sono esercizi della lista', () => {
    expect(STAZIONI_HYROX).toHaveLength(8)
    expect(STAZIONI_HYROX.filter(n => !HYROX_EXERCISES.includes(n))).toEqual([])
  })
})

describe('misuraEsercizio', () => {
  it('segue le schede del foglio misure', () => {
    expect(misuraEsercizio('SkiErg')).toBe('metri · ritmo')
    expect(misuraEsercizio('Run')).toBe('metri · ritmo')
    expect(misuraEsercizio('Sled Push')).toBe('metri · kg')
    expect(misuraEsercizio('Farmers Carry')).toBe('metri · kg')
    expect(misuraEsercizio('Sandbag Lunges')).toBe('reps o metri · kg')
    expect(misuraEsercizio('Wall Balls')).toBe('reps · kg')
    expect(misuraEsercizio('Rest')).toBe('tempo')
    expect(misuraEsercizio('Un esercizio inventato')).toBe('reps · kg')
  })
})

describe('l altezza della box (Burpees Box Jump)', () => {
  it('solo gli esercizi con la box la chiedono, con 50, 60 e 75 cm come standard', () => {
    expect(conBox('Burpees Box Jump')).toBe(true)
    expect(conBox('Box Jump')).toBe(true)
    expect(conBox('Burpees Broad Jumps')).toBe(false)
    expect(ALTEZZE_BOX).toEqual(['50 cm', '60 cm', '75 cm'])
    expect(misuraEsercizio('Burpees Box Jump')).toBe('reps · box')
  })
  it('si scrive «box 60 cm», e niente se manca', () => {
    expect(testoBox({ box: '60' })).toBe('box 60 cm')
    expect(testoBox({ box: '' })).toBe('')
    expect(testoBox({ box: '-' })).toBe('')
    expect(testoBox({})).toBe('')
  })
})
