import { describe, it, expect } from 'vitest'
import { REGOLE_PREDEFINITE, verificaScheletro, verificaSettimana } from '../regole.js'

const sch = (righe) => righe.map(([fase, minuti], i) => ({ n: i + 1, fase, minuti }))
const regole = (errori) => errori.map(e => `${e.settimana}:${e.regola}`)

describe('REGOLE_PREDEFINITE', () => {
  it('ha i valori della spec', () =>
    expect(REGOLE_PREDEFINITE).toEqual({ progressioneMax: 0.10, scaricoOgni: 4, scaricoRiduzione: 0.30, taperingGiorni: 10, maiDuriConsecutivi: true }))
})

describe('verificaScheletro', () => {
  it('uno scheletro corretto non ha errori', () =>
    expect(verificaScheletro(sch([['base', 200], ['base', 220], ['costruzione', 240], ['scarico', 160], ['costruzione', 250], ['gara', 150]]))).toEqual([]))

  it('progressione: +10% passa, +11% no', () => {
    expect(verificaScheletro(sch([['base', 200], ['base', 220]]))).toEqual([])
    expect(regole(verificaScheletro(sch([['base', 200], ['base', 222]])))).toEqual(['2:progressione'])
  })

  it('dopo uno scarico si confronta con la settimana prima dello scarico', () => {
    expect(verificaScheletro(sch([['base', 200], ['scarico', 140], ['costruzione', 220]]))).toEqual([])
    expect(regole(verificaScheletro(sch([['base', 200], ['scarico', 140], ['costruzione', 230]])))).toEqual(['3:progressione'])
  })

  it('scarico: più di 4 settimane di carico di fila → errore sulla 5ª', () =>
    expect(regole(verificaScheletro(sch([['base', 200], ['base', 200], ['base', 200], ['base', 200], ['base', 200]])))).toEqual(['5:scarico']))

  it('scarico: deve essere almeno −30% rispetto alla settimana prima', () =>
    expect(regole(verificaScheletro(sch([['base', 200], ['scarico', 150]])))).toEqual(['2:scarico']))

  it('tapering: la settimana della gara sotto la penultima', () =>
    expect(regole(verificaScheletro(sch([['base', 200], ['specifico', 210], ['gara', 210]])))).toEqual(['3:tapering']))

  it('i parametri del team sovrascrivono i predefiniti', () =>
    expect(verificaScheletro(sch([['base', 200], ['base', 230]]), { progressioneMax: 0.15 })).toEqual([]))
})

describe('verificaSettimana', () => {
  it('due sedute dure in giorni consecutivi → errore', () =>
    expect(verificaSettimana([{ giorno: 2, dura: true }, { giorno: 3, dura: true }], REGOLE_PREDEFINITE)).toHaveLength(1))

  it('domenica e lunedì contano come consecutivi', () =>
    expect(verificaSettimana([{ giorno: 7, dura: true }, { giorno: 1, dura: true }], REGOLE_PREDEFINITE)).toHaveLength(1))

  it('dure separate da un giorno, o dura vicino a facile: nessun errore', () => {
    expect(verificaSettimana([{ giorno: 1, dura: true }, { giorno: 3, dura: true }, { giorno: 4, dura: false }], REGOLE_PREDEFINITE)).toEqual([])
  })

  it('con maiDuriConsecutivi spento non controlla', () =>
    expect(verificaSettimana([{ giorno: 2, dura: true }, { giorno: 3, dura: true }], { maiDuriConsecutivi: false })).toEqual([]))
})
