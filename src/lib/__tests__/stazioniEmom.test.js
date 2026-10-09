import { describe, it, expect } from 'vitest'

import { intervalliDi, intervalliDelGiro, etichetteStazioni, fasiEmom, MASSIMO_INTERVALLI } from '../stazioniEmom'

// Le stazioni EMOM su più minuti: un campo nuovo dentro `workouts.sections`,
// letto da timer, builder, scheda, PDF e TV. Se l'etichetta e le fasi non
// coincidono, l'atleta legge «Min. 2–3» e il timer gli cambia esercizio al 2.

describe('intervalliDi — un campo che i workout vecchi non hanno', () => {
  it('assente, vuoto o illeggibile vale 1: i workout già salvati non cambiano', () => {
    expect(intervalliDi({ name: 'Row' })).toBe(1)
    expect(intervalliDi({ intervals: '' })).toBe(1)
    expect(intervalliDi({ intervals: 'abc' })).toBe(1)
    expect(intervalliDi({ intervals: '0' })).toBe(1)
    expect(intervalliDi(null)).toBe(1)
  })

  it('legge stringhe e numeri, con un tetto', () => {
    expect(intervalliDi({ intervals: '2' })).toBe(2)
    expect(intervalliDi({ intervals: 3 })).toBe(3)
    expect(intervalliDi({ intervals: '99' })).toBe(MASSIMO_INTERVALLI)
  })
})

describe('etichetteStazioni — il numero accanto all esercizio', () => {
  const lista = [{ name: 'Burpees' }, { name: 'Row', intervals: '2' }, { name: 'Wall Balls' }]

  it('in un EMOM dice i minuti: 1, 2–3, 4', () => {
    expect(etichetteStazioni(lista, 'EMOM')).toEqual(['1', '2–3', '4'])
  })

  it('fuori da un EMOM resta l ordine', () => {
    expect(etichetteStazioni(lista, 'ON/OFF')).toEqual(['1', '2', '3'])
  })

  it('il giro intero dura la somma degli intervalli', () => {
    expect(intervalliDelGiro(lista)).toBe(4)
  })
})

describe('fasiEmom — le fasi del timer', () => {
  it('ripete la lista finché ci sono round, senza mai spezzare una stazione', () => {
    const fasi = fasiEmom([{ name: 'A' }, { name: 'B', intervals: '2' }], 6)
    expect(fasi.map(f => [f.esercizio.name, f.primo, f.ultimo])).toEqual([
      ['A', 1, 1], ['B', 2, 3], ['A', 4, 4], ['B', 5, 6],
    ])
  })

  it('accorcia l ultima stazione se i round finiscono prima', () => {
    const fasi = fasiEmom([{ name: 'A', intervals: '3' }], 4)
    expect(fasi.map(f => [f.primo, f.ultimo])).toEqual([[1, 3], [4, 4]])
  })

  it('senza esercizi una fase per round, come prima', () => {
    const fasi = fasiEmom([], 3)
    expect(fasi).toHaveLength(3)
    expect(fasi.every(f => f.esercizio === null)).toBe(true)
  })
})
