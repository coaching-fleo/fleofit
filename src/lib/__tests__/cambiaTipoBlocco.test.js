import { describe, it, expect } from 'vitest'
import { cambiaTipoBlocco } from '../cambiaTipoBlocco'

const ex = (name, campi = {}) => ({ id: Math.random(), name, reps: '15', ...campi })

describe('«Cambia tipo di blocco»', () => {
  it('tiene id, esercizi e note, e i numeri che il tipo nuovo usa', () => {
    const prima = { id: 1, type: 'For Time', params: { rounds: '3' }, notes: 'a coppie', exercises: [ex('Wall Balls')] }
    expect(cambiaTipoBlocco(prima, 'Cash In')).toEqual({ ...prima, type: 'Cash In', params: { rounds: '3' } })
  })

  it('toglie i parametri che il tipo nuovo non legge', () => {
    const prima = { id: 1, type: 'ON/OFF', params: { on: '0:40', off: '0:20', rounds: '8' }, exercises: [] }
    expect(cambiaTipoBlocco(prima, 'AMRAP').params).toEqual({})
    expect(cambiaTipoBlocco(prima, 'EMOM').params).toEqual({ rounds: '8' })
  })

  it('uscendo da un EMOM le stazioni su più minuti tornano da un intervallo', () => {
    const prima = { id: 1, type: 'EMOM', params: { interval: '1:00', rounds: '9' }, exercises: [ex('SkiErg', { intervals: '2' })] }
    const dopo = cambiaTipoBlocco(prima, 'ON/OFF')
    expect(dopo.exercises[0].intervals).toBeUndefined()
    expect(dopo.exercises[0].name).toBe('SkiErg')
  })

  it('in WarmUp gli esercizi diventano righe del testo, e tornano esercizi', () => {
    const prima = { id: 1, type: 'Cash In', params: { rounds: '1' }, notes: '', exercises: [
      ex('SkiErg', { reps: '', meters: '500m', ergoPace: '2:00 /500m', notes: 'tecnica' }),
      ex('Wall Balls', { reps: '20', kg: '6' }),
    ] }
    const warmup = cambiaTipoBlocco(prima, 'WarmUp')
    expect(warmup.exercises).toEqual([])
    expect(warmup.notes).toBe('SkiErg · 500m · @2:00 /500m — tecnica; Wall Balls · 20 reps · 6 kg')

    const indietro = cambiaTipoBlocco(warmup, 'Cash In')
    expect(indietro.notes).toBe('')
    expect(indietro.exercises).toMatchObject([
      { name: 'SkiErg', meters: '500m', ergoPace: '2:00 /500m', notes: 'tecnica', intensity: '5' },
      { name: 'Wall Balls', reps: '20', kg: '6' },
    ])
  })

  it('una riga del riscaldamento che non è un esercizio resta, come esercizio col suo testo', () => {
    const warmup = { id: 1, type: 'WarmUp', params: { duration: '10:00' }, notes: 'Mobilità anche; 10 Burpees', exercises: [] }
    const dopo = cambiaTipoBlocco(warmup, 'For Time')
    expect(dopo.exercises.map(e => e.name)).toEqual(['Mobilità anche', 'Burpees'])
    expect(dopo.exercises[1].reps).toBe('10')
    expect(dopo.params).toEqual({})
  })
})
