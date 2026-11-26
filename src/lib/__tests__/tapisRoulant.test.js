import { describe, it, expect } from 'vitest'
import { velocitaDaPasso, stepsTapis, haRitmiConvertibili } from '../tapisRoulant'

describe('velocitaDaPasso', () => {
  it('un ritmo', () => {
    expect(velocitaDaPasso('5:00 /km')).toBe('12,0 km/h')
    expect(velocitaDaPasso('4:10 /km')).toBe('14,4 km/h')
    expect(velocitaDaPasso('6:40 /km')).toBe('9,0 km/h')
  })

  it('un intervallo, dal più lento al più veloce, in ogni verso e scrittura', () => {
    for (const p of ['5:00 - 5:30 /km', '5:30 - 5:00 /km', '5:00–5:30 /km', '5:00-5:30 /km']) {
      expect(velocitaDaPasso(p)).toBe('10,9 – 12,0 km/h')
    }
  })

  it('non inventa niente', () => {
    for (const p of ['Libero', 'Camminata', 'Da fermo', 'Z3', 'All out', 'Gara', '', null, undefined, '0:00 /km', '5:00 - Z3']) {
      expect(velocitaDaPasso(p)).toBeNull()
    }
  })
})

describe('stepsTapis', () => {
  it('converte i ritmi e lascia il resto', () => {
    const steps = [
      { id: 1, type: 'run', duration: '5 km', pace: '5:00 /km', notes: 'tranquillo' },
      { id: 2, type: 'warmup', duration: '10 min', pace: 'Z2' },
    ]
    const [a, b] = stepsTapis(steps)
    expect(a).toMatchObject({ id: 1, type: 'run', duration: '5 km', pace: '12,0 km/h', notes: 'tranquillo' })
    expect(b.pace).toBe('Z2')
  })

  it('una ripetuta nel formato vecchio converte le due parti', () => {
    const [r] = stepsTapis([{ id: 3, type: 'repeat', rounds: '6', runDuration: '400m', runPace: '4:00 /km', recDuration: '1 min', recPace: 'Libero' }])
    expect(r.parti).toHaveLength(2)
    expect(r.parti[0]).toMatchObject({ duration: '400m', pace: '15,0 km/h' })
    expect(r.parti[1].pace).toBe('Libero')
    expect(r.rounds).toBe('6')
  })

  it('una ripetuta con tre parti le converte tutte dove si può', () => {
    const [r] = stepsTapis([{ id: 4, type: 'repeat', rounds: '3', parti: [
      { id: 'a', tipo: 'run', duration: '4 min', pace: '4:30 /km' },
      { id: 'b', tipo: 'run', duration: '3 min', pace: '5:00 - 5:30 /km' },
      { id: 'c', tipo: 'recover', duration: '1 min', pace: 'Camminata' },
    ] }])
    expect(r.parti.map(p => p.pace)).toEqual(['13,3 km/h', '10,9 – 12,0 km/h', 'Camminata'])
  })

  it('non tocca gli originali', () => {
    const steps = [
      { id: 1, type: 'run', pace: '5:00 /km' },
      { id: 2, type: 'repeat', parti: [{ id: 'a', tipo: 'run', duration: '1 km', pace: '4:00 /km' }] },
    ]
    const copia = JSON.parse(JSON.stringify(steps))
    stepsTapis(steps)
    expect(steps).toEqual(copia)
  })
})

describe('haRitmiConvertibili', () => {
  it('basta un ritmo, anche dentro una ripetuta', () => {
    expect(haRitmiConvertibili([{ type: 'run', pace: '5:00 /km' }])).toBe(true)
    expect(haRitmiConvertibili([{ type: 'warmup', pace: 'Z1' }, { type: 'repeat', runDuration: '400m', runPace: '3:50 /km' }])).toBe(true)
  })

  it('con sole zone o senza passi no', () => {
    expect(haRitmiConvertibili([{ type: 'run', pace: 'Z3' }, { type: 'repeat', runDuration: '1 km', runPace: 'Gara' }])).toBe(false)
    expect(haRitmiConvertibili([])).toBe(false)
    expect(haRitmiConvertibili(undefined)).toBe(false)
  })
})
