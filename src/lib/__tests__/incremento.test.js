import { describe, it, expect } from 'vitest'

import {
  haIncremento, campoIncremento, testoAumento, esercizioAlGiro, giriDiEsempio,
  attivaIncremento, disattivaIncremento, testoTimeCap, giriForTime, testoForTime,
} from '../incremento'

// L'incremento a ogni giro: un For Time a tempo (o un AMRAP) in cui il giro
// ricomincia con le quantità aumentate. La lista resta il PRIMO giro.

const ski = { id: 1, name: 'SkiErg', meters: '200m', reps: '', aumento: '100' }
const wb = { id: 2, name: 'Wall Balls', reps: '20', kg: '6', aumento: '10' }
const sled = { id: 3, name: 'Sled Push', meters: '50m', kg: '100' }

describe('haIncremento', () => {
  it('solo For Time e AMRAP con la spia accesa', () => {
    expect(haIncremento({ type: 'For Time', incremento: true })).toBe(true)
    expect(haIncremento({ type: 'AMRAP', incremento: true })).toBe(true)
    expect(haIncremento({ type: 'EMOM', incremento: true })).toBe(false)
    expect(haIncremento({ type: 'For Time' })).toBe(false)
    expect(haIncremento(null)).toBe(false)
  })
})

describe('campoIncremento — che cosa sale', () => {
  it('i metri a distanza, le ripetizioni altrimenti', () => {
    expect(campoIncremento(ski)).toBe('meters')
    expect(campoIncremento(wb)).toBe('reps')
  })
  it('niente da far salire su Max, tempi e campi vuoti', () => {
    expect(campoIncremento({ reps: 'Max' })).toBe(null)
    expect(campoIncremento({ meters: '-', reps: '-' })).toBe(null)
    expect(campoIncremento({ meters: '1:00' })).toBe(null)
  })
})

describe('esercizioAlGiro e testoAumento', () => {
  it('il primo giro è l esercizio com è', () => {
    expect(esercizioAlGiro(ski, 1)).toBe(ski)
  })
  it('sale del suo passo a ogni giro', () => {
    expect(esercizioAlGiro(ski, 3).meters).toBe('400m')
    expect(esercizioAlGiro(wb, 2).reps).toBe('30')
    expect(esercizioAlGiro(sled, 4).meters).toBe('50m')
  })
  it('a scendere non va sotto 1', () => {
    expect(esercizioAlGiro({ reps: '5', aumento: '-10' }, 2).reps).toBe('1')
  })
  it('dice passo e unità', () => {
    expect(testoAumento(ski)).toBe('+100m ogni giro')
    expect(testoAumento(wb)).toBe('+10 ogni giro')
    expect(testoAumento({ reps: '21', aumento: '-6' })).toBe('−6 ogni giro')
    expect(testoAumento(sled)).toBe('')
  })
})

describe('giriDiEsempio — l esempio del committente', () => {
  it('mostra i primi giri: 200/20 → 300/30 → 400/40', () => {
    const giri = giriDiEsempio({ type: 'For Time', incremento: true, exercises: [ski, wb] })
    expect(giri.map(g => g.esercizi.map(e => e.meters || e.reps))).toEqual([['200m', '20'], ['300m', '30'], ['400m', '40']])
  })
  it('niente esempio senza aumenti o senza la spia', () => {
    expect(giriDiEsempio({ type: 'For Time', incremento: true, exercises: [sled] })).toBe(null)
    expect(giriDiEsempio({ type: 'For Time', exercises: [ski] })).toBe(null)
  })
})

describe('attivaIncremento / disattivaIncremento', () => {
  it('un For Time vecchio, a round, diventa a tempo', () => {
    const b = attivaIncremento({ id: 1, type: 'For Time', params: { rounds: '4' }, exercises: [wb] })
    expect(b.incremento).toBe(true)
    expect(b.params).toEqual({ timecap: '20:00' })
    expect(b.exercises).toEqual([wb])
    expect(testoTimeCap(b)).toBe('time cap 20:00')
  })
  it('un time cap già scritto resta', () => {
    expect(attivaIncremento({ type: 'For Time', params: { timecap: '15:00' } }).params.timecap).toBe('15:00')
  })
  it('nell AMRAP la durata non si tocca', () => {
    expect(attivaIncremento({ type: 'AMRAP', params: { duration: '12:00' } }).params).toEqual({ duration: '12:00' })
  })
  it('spento: via la spia, ma aumenti e time cap restano', () => {
    const b = disattivaIncremento({ type: 'For Time', incremento: true, params: { timecap: '15:00' }, exercises: [ski, wb] })
    expect(b).not.toHaveProperty('incremento')
    expect(b.params).toEqual({ timecap: '15:00' })
    expect(b.exercises).toEqual([ski, wb])
    // Spenti non contano: nessun esempio, nessun «ogni giro».
    expect(giriDiEsempio(b)).toBe(null)
  })

  it('spento e riacceso per sbaglio, gli aumenti sono ancora lì', () => {
    const prima = { type: 'For Time', incremento: true, params: { timecap: '15:00' }, exercises: [ski, wb] }
    expect(attivaIncremento(disattivaIncremento(prima))).toEqual(prima)
  })
})

// I giri di un For Time a time cap (28/10/2026): «4 giri entro 20:00».
describe('giriForTime e testoForTime', () => {
  it('quattro giri entro il time cap', () => {
    const b = { type: 'For Time', params: { timecap: '20:00', rounds: '4' }, exercises: [ski] }
    expect(giriForTime(b)).toBe(4)
    expect(testoForTime(b)).toBe('4 giri · time cap 20:00')
  })

  it('un giro solo non si nomina', () => {
    const b = { type: 'For Time', params: { timecap: '20:00', rounds: '1' } }
    expect(giriForTime(b)).toBeNull()
    expect(testoForTime(b)).toBe('time cap 20:00')
  })

  it('con l incremento i giri li decide il tempo', () => {
    expect(giriForTime({ type: 'For Time', incremento: true, params: { timecap: '20:00', rounds: '4' } })).toBeNull()
  })

  it('un For Time vecchio, senza time cap, non ha giri «dentro» un tempo', () => {
    expect(giriForTime({ type: 'For Time', params: { rounds: '3' } })).toBeNull()
  })

  it('accendere l incremento toglie i giri e tiene il time cap', () => {
    const b = attivaIncremento({ type: 'For Time', params: { timecap: '18:00', rounds: '4' }, exercises: [] })
    expect(b.params).toEqual({ timecap: '18:00' })
  })
})
