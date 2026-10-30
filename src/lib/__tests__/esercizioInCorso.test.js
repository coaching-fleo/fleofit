import { describe, it, expect } from 'vitest'
import { esercizioInCorso, esercizioInArrivo } from '../esercizioInCorso'
import { buildTimerSequence } from '../timerSequence'

const emom = {
  type: 'EMOM', params: { interval: '1:00', rounds: '7' },
  exercises: [{ id: 'a', name: 'Wall Balls' }, { id: 'b', name: 'SkiErg', intervals: '2' }, { id: 'c', name: 'Burpees' }],
}
const onoff = {
  type: 'ON/OFF', params: { on: '0:40', off: '0:20', rounds: '2' },
  exercises: [{ id: 'a', name: 'Row' }, { id: 'b', name: 'Lunges' }],
}

describe('esercizioInCorso', () => {
  it('EMOM: il round diventa l’esercizio, anche con una stazione su due minuti', () => {
    expect(esercizioInCorso(emom, 1, 'blk-1-1')).toBe(0)
    expect(esercizioInCorso(emom, 1, 'blk-1-2')).toBe(1) // SkiErg, minuti 2–3
    expect(esercizioInCorso(emom, 1, 'blk-1-4')).toBe(2)
    expect(esercizioInCorso(emom, 1, 'blk-1-5')).toBe(0) // la lista ricomincia
  })

  it('ON/OFF: acceso nell’ON, spento nell’OFF', () => {
    expect(esercizioInCorso(onoff, 0, 'blk-0-2-1-on')).toBe(1)
    expect(esercizioInCorso(onoff, 0, 'blk-0-2-1-off')).toBe(null)
  })

  it('niente su un altro blocco, su altri tipi e su id estranei', () => {
    expect(esercizioInCorso(emom, 1, 'blk-2-1')).toBe(null)
    expect(esercizioInCorso({ ...emom, type: 'AMRAP' }, 1, 'blk-1')).toBe(null)
    expect(esercizioInCorso(emom, 1, 'prep')).toBe(null)
    expect(esercizioInCorso(emom, 1, undefined)).toBe(null)
  })

  it('segue gli id che il timer scrive davvero', () => {
    const workout = { sections: { category: 'Hyrox', blocks: [{ type: 'WarmUp', params: { duration: '1:00' } }, emom, onoff] } }
    const seq = buildTimerSequence(workout)
    const emomSteps = seq.filter(s => s.title === 'EMOM').map(s => esercizioInCorso(emom, 1, s.id))
    expect(emomSteps).toEqual([0, 1, 2, 0, 1]) // 7 round: a · b b · c · a · b b
    const onSteps = seq.filter(s => s.title === 'WORK (ON)').map(s => esercizioInCorso(onoff, 2, s.id))
    expect(onSteps).toEqual([0, 1, 0, 1])
  })
})

describe('esercizioInArrivo', () => {
  const tre = { ...onoff, exercises: [{ name: 'Row' }, { name: 'Lunges' }, { name: 'Burpees' }] }

  it('nell’OFF dice l’esercizio dopo, e a fine giro riparte dal primo', () => {
    expect(esercizioInArrivo(tre, 0, 'blk-0-1-0-off')).toBe(1)
    expect(esercizioInArrivo(tre, 0, 'blk-0-1-2-off')).toBe(0)
  })

  it('dopo l’ultimo OFF dell’ultimo giro non c’è niente', () => {
    expect(esercizioInArrivo(tre, 0, 'blk-0-2-2-off')).toBe(null)
  })

  it('nell’ON, su un altro blocco o su un EMOM non risponde', () => {
    expect(esercizioInArrivo(tre, 0, 'blk-0-1-0-on')).toBe(null)
    expect(esercizioInArrivo(tre, 1, 'blk-0-1-0-off')).toBe(null)
    expect(esercizioInArrivo(emom, 1, 'blk-1-1')).toBe(null)
  })

  it('segue gli id veri del timer', () => {
    const seq = buildTimerSequence({ sections: { blocks: [tre] } }).filter(s => s.id.endsWith('-off'))
    expect(seq.map(s => esercizioInArrivo(tre, 0, s.id))).toEqual([1, 2, 0, 1, 2, null])
  })
})
