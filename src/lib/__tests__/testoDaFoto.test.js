import { describe, it, expect } from 'vitest'
import { testoDaRighe, senzaInterfaccia } from '../testoDaFoto'
import { leggiHyrox } from '../leggiWorkout'
import screenshotNote from './fixtures/screenshot-note-ios.json'

/** Un pezzo di testo come lo restituisce l'OCR: posizione in frazioni, origine in alto. */
const p = (testo, x, y, w = 0.25, h = 0.04) => ({ testo, x, y, w, h })

describe('testoDaRighe', () => {
  it('un foglio a una colonna si legge dall’alto in basso, qualunque sia l’ordine di arrivo', () => {
    expect(testoDaRighe([
      p('12 burpees', 0.1, 0.2),
      p("EMOM 12'", 0.1, 0.1),
      p('20 wall balls', 0.12, 0.3),
    ])).toBe("EMOM 12'\n12 burpees\n20 wall balls")
  })

  it('i pezzi sulla stessa riga si uniscono da sinistra a destra', () => {
    expect(testoDaRighe([
      p('9kg', 0.42, 0.105, 0.08),
      p('20 wall balls', 0.1, 0.1),
    ])).toBe('20 wall balls 9kg')
  })

  it('🔴 una lavagna su due colonne non mescola i due workout', () => {
    const testo = testoDaRighe([
      p("EMOM 12'", 0.05, 0.1), p('AMRAP 20', 0.55, 0.1),
      p('12 burpees', 0.05, 0.2), p('10 wall balls', 0.55, 0.2),
      p('15 cal ski', 0.05, 0.3), p('200m run', 0.55, 0.3),
    ])
    expect(testo).toBe("EMOM 12'\n12 burpees\n15 cal ski\nAMRAP 20\n10 wall balls\n200m run")
  })

  it('un titolo largo sopra le colonne viene prima', () => {
    const testo = testoDaRighe([
      p('HYROX SIMULATION — SABATO', 0.1, 0.02, 0.8),
      p('A', 0.05, 0.1), p('B', 0.55, 0.1),
      p('a1', 0.05, 0.2), p('b1', 0.55, 0.2),
      p('a2', 0.05, 0.3), p('b2', 0.55, 0.3),
    ])
    expect(testo.split('\n')).toEqual(['HYROX SIMULATION — SABATO', 'A', 'a1', 'a2', 'B', 'b1', 'b2'])
  })

  it('un numero scritto in disparte resta sulla sua riga, non diventa una colonna', () => {
    const testo = testoDaRighe([
      p("EMOM 12'", 0.05, 0.1), p('AMRAP 20', 0.6, 0.1),
      p('12 burpees', 0.05, 0.2), p('10 wall balls', 0.6, 0.2),
      p('15 cal ski', 0.05, 0.3), p('200m run', 0.6, 0.3),
      // «x2» scritto fra le due colonne, sulla riga dei burpees.
      p('x2', 0.36, 0.205, 0.05),
    ])
    expect(testo.split('\n')).toContain('12 burpees x2')
    expect(testo.split('\n')).toHaveLength(6)
  })

  it('🔴 un titolo stretto al centro non fonde le due colonne (trovato sul simulatore)', () => {
    // Le posizioni lette da Apple Vision sulla lavagna di prova del 12/10/2026:
    // «HYROX SATURDAY» non è largo, ma scavalca lo spazio fra le colonne.
    const testo = testoDaRighe([
      p('HYROX SATURDAY', 0.30, 0.03, 0.34, 0.05),
      p("Warm up 10'", 0.044, 0.16, 0.19), p('4 RFT', 0.55, 0.16, 0.11),
      p('500m row', 0.044, 0.29, 0.17), p('1000m ski', 0.55, 0.29, 0.17),
      p("EMOM 12'", 0.044, 0.41, 0.17), p('50m sled push 150kg', 0.55, 0.41, 0.34),
      p('min 1: 15 cal ski', 0.044, 0.54, 0.23), p('20 wall balls 9kg', 0.55, 0.54, 0.27),
      p('min 2: 12 burpees', 0.044, 0.66, 0.27), p("rest 3'", 0.55, 0.66, 0.1),
      p('min 3: rest', 0.044, 0.79, 0.17),
    ])
    expect(testo.split('\n')).toEqual([
      'HYROX SATURDAY',
      "Warm up 10'", '500m row', "EMOM 12'", 'min 1: 15 cal ski', 'min 2: 12 burpees', 'min 3: rest',
      '4 RFT', '1000m ski', '50m sled push 150kg', '20 wall balls 9kg', "rest 3'",
    ])
  })

  it('un titolo che attraversa le colonne più in basso viene dopo entrambe', () => {
    const testo = testoDaRighe([
      p('A', 0.05, 0.1), p('B', 0.55, 0.1),
      p('a1', 0.05, 0.2), p('b1', 0.55, 0.2),
      p('a2', 0.05, 0.3), p('b2', 0.55, 0.3),
      p('FINISHER: 50 burpees', 0.2, 0.45, 0.5),
    ])
    expect(testo.split('\n')).toEqual(['A', 'a1', 'a2', 'B', 'b1', 'b2', 'FINISHER: 50 burpees'])
  })

  it('un rientro non è una seconda colonna', () => {
    const testo = testoDaRighe([
      p("EMOM 12'", 0.05, 0.1, 0.3), p('12 burpees', 0.15, 0.2), p('15 cal ski', 0.15, 0.3),
      p('AMRAP 10', 0.05, 0.4, 0.3), p('10 wall balls', 0.15, 0.5), p('200m run', 0.15, 0.6),
      p('Rest 2', 0.05, 0.7, 0.3),
    ])
    expect(testo.split('\n')).toEqual(["EMOM 12'", '12 burpees', '15 cal ski', 'AMRAP 10', '10 wall balls', '200m run', 'Rest 2'])
  })

  it('ignora quello che non è testo con una posizione', () => {
    expect(testoDaRighe(null)).toBe('')
    expect(testoDaRighe([])).toBe('')
    expect(testoDaRighe([{ testo: '  ' , x: 0, y: 0, w: 1, h: 1 }, { testo: 'ok', x: NaN, y: 0, w: 1, h: 1 }])).toBe('')
  })
})

// Lo screenshot vero delle Note mandato dal committente il 12/10/2026, letto da
// Apple Vision con le impostazioni dell'app: orario in cima, icone, barra degli
// strumenti, suggerimenti e tastiera in basso. Prima ogni gruppo di tasti
// («QWERT», «A S», «× C») finiva nelle note del workout.
describe('screenshot delle Note', () => {
  const RIGHE = ['200m ski', '10 burpees', '300m', '15 burpees', '400m', '20 burpees',
    '300m ski', '15 burpees', '200 ski', '10 burpees']

  it('🔴 legge solo il workout: niente tastiera, orario, icone o suggerimenti', () => {
    expect(testoDaRighe(screenshotNote).split('\n')).toEqual(RIGHE)
  })

  it('🔴 le righe con solo i metri prendono l’esercizio di prima', () => {
    const { blocchi, righe } = leggiHyrox(testoDaRighe(screenshotNote))
    expect(blocchi).toHaveLength(1)
    expect(blocchi[0].exercises.map(e => `${e.name} ${e.meters || e.reps}`)).toEqual([
      'SkiErg 200m', 'Burpees 10', 'SkiErg 300m', 'Burpees 15', 'SkiErg 400m',
      'Burpees 20', 'SkiErg 300m', 'Burpees 15', 'SkiErg 200m', 'Burpees 10',
    ])
    expect(righe.filter(r => r.esito === 'dedotto').map(r => r.testo)).toEqual(['300m', '400m'])
    expect(righe.some(r => r.esito === 'nota')).toBe(false)
  })
})

describe('senzaInterfaccia', () => {
  it('una tastiera con i tasti letti uno per uno sparisce, e così quello che ha sotto', () => {
    const tasti = 'QWERTYUIOP'.split('').map((l, i) => p(l, 0.02 + i * 0.1, 0.7, 0.05, 0.02))
    const resto = senzaInterfaccia([p('20 wall balls', 0.1, 0.3), ...tasti, p('123', 0.03, 0.88)])
    expect(resto.map(x => x.testo)).toEqual(['20 wall balls'])
  })

  it('una riga di workout appena sopra la tastiera resta, se ha dei numeri', () => {
    const tasti = 'ASDFG'.split('').map((l, i) => p(l, 0.02 + i * 0.1, 0.7, 0.05, 0.02))
    const resto = senzaInterfaccia([p('Aa', 0.06, 0.62), p('15 burpees', 0.06, 0.6), ...tasti])
    expect(resto.map(x => x.testo)).toEqual(['15 burpees'])
  })

  it('una riga di tasti letta in due soli pezzi è comunque una tastiera', () => {
    const resto = senzaInterfaccia([p('20 wall balls', 0.1, 0.3), p('QWERT', 0.04, 0.7, 0.44), p('UIOP', 0.6, 0.7, 0.34)])
    expect(resto.map(x => x.testo)).toEqual(['20 wall balls'])
  })

  it('le sigle di un workout non sono una tastiera', () => {
    const lavagna = [p('EMOM', 0.05, 0.1), p('AMRAP', 0.3, 0.1), p('RFT', 0.55, 0.1)]
    expect(senzaInterfaccia(lavagna)).toHaveLength(3)
  })

  it('l’orario si toglie solo in cima', () => {
    expect(senzaInterfaccia([p('9:41', 0.1, 0.02), p('EMOM 12', 0.1, 0.2)]).map(x => x.testo)).toEqual(['EMOM 12'])
    expect(senzaInterfaccia([p('1:30', 0.1, 0.3)])).toHaveLength(1)
  })
})

