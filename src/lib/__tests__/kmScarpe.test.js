import { describe, it, expect } from 'vitest'
import { kmAllenamento, haCorsa, kmScarpa, statoScarpa, testoKm, SOGLIA_PREDEFINITA } from '../kmScarpe'

const run = (steps) => ({ category: 'Running', steps })
const hyrox = (blocks) => ({ category: 'Hyrox', blocks })

describe('kmAllenamento', () => {
  it('Garmin vince sulla stima', () =>
    expect(kmAllenamento(run([{ type: 'run', duration: '5 km' }]), { distanza_m: 8240 }))
      .toEqual({ km: 8.24, fonte: 'orologio' }))
  it('fasi a distanza sommate', () =>
    expect(kmAllenamento(run([{ type: 'warmup', duration: '2 km' }, { type: 'run', duration: '800m' }])))
      .toEqual({ km: 2.8, fonte: 'stima' }))
  it("fase a tempo col ritmo m:ss /km (media dell'intervallo)", () =>
    expect(kmAllenamento(run([{ type: 'run', duration: '30 min', paceMin: '4:30 /km', paceMax: '5:30 /km' }])).km).toBe(6))
  it('fase a tempo con zona usa 6 min/km', () =>
    expect(kmAllenamento(run([{ type: 'run', duration: '12 min', pace: 'Z2' }])).km).toBe(2))
  it('ripetute formato vecchio', () =>
    expect(kmAllenamento(run([{ type: 'repeat', rounds: '8', runDuration: '400m', recDuration: '1 min', recPace: 'Camminata' }])).km)
      .toBeCloseTo(3.2 + 8 * (1 / 12), 2))
  it('«Da fermo» a tempo vale 0 km: 8 × (400m + 1′ Da fermo) = 3,2', () => {
    expect(kmAllenamento(run([{ type: 'repeat', rounds: '8', runDuration: '400m', recDuration: '1 min', recPace: 'Da fermo' }])).km).toBe(3.2)
    expect(kmAllenamento(run([{ type: 'repeat', rounds: '8', parti: [
      { tipo: 'run', duration: '400m' }, { tipo: 'recover', duration: '1 min', paceMin: 'da fermo', paceMax: '-' }] }])).km).toBe(3.2)
  })
  it('«Da fermo» da solo: nessuna corsa, null', () =>
    expect(kmAllenamento(run([{ type: 'recover', duration: '3 min', pace: 'DA FERMO' }]))).toBeNull())
  it('«Camminata» a tempo va a 12 min/km', () =>
    expect(kmAllenamento(run([{ type: 'recover', duration: '24 min', paceMin: 'Camminata' }])).km).toBe(2))
  it('ripetute con parti', () =>
    expect(kmAllenamento(run([{ type: 'repeat', rounds: '3', parti: [
      { tipo: 'run', duration: '1 km' }, { tipo: 'recover', duration: '500m' }] }])).km).toBe(4.5))
  it('Hyrox: Run x round, ergometri esclusi', () =>
    expect(kmAllenamento(hyrox([{ type: 'For Time', params: { rounds: '4' }, exercises: [
      { name: 'Run', meters: '1000m' }, { name: 'SkiErg', meters: '1000m' }] }])).km).toBe(4))
  it('Hyrox: Max e - non contano', () =>
    expect(kmAllenamento(hyrox([{ type: 'AMRAP', params: {}, exercises: [{ name: 'Run', meters: 'Max' }] }]))).toBeNull())
  it('Custom senza corsa: null, mai 0', () =>
    expect(kmAllenamento({ category: 'Custom', isAutonomous: true })).toBeNull())
  it('Hyrox legacy (sections.main) passa da getNormalizedBlocks', () =>
    expect(kmAllenamento({ category: 'Hyrox', main: { type: 'For Time', exercises: [{ name: 'Run', meters: '500m' }] } }).km).toBe(0.5))
})

describe('haCorsa', () => {
  it('vero con una corsa, falso senza', () => {
    expect(haCorsa(run([{ type: 'run', duration: '5 km' }]))).toBe(true)
    expect(haCorsa({ category: 'Custom' })).toBe(false)
  })
})

describe('kmScarpa', () => {
  it('somma i noti e salta i null', () =>
    expect(kmScarpa({ km_iniziali: 100 }, [5, null, 2.5])).toBe(107.5))
})

describe('statoScarpa', () => {
  it('la soglia predefinita e 700', () => expect(SOGLIA_PREDEFINITA).toBe(700))
  it.each([[559, 'ok'], [560, 'quasi'], [700, 'oltre']])('statoScarpa(%i, 700) = %s', (km, s) =>
    expect(statoScarpa(km, 700)).toBe(s))
})

describe('testoKm', () => {
  it('interi, col punto delle migliaia; sconosciuto è «—», mai 0', () => {
    expect(testoKm(412.4)).toBe('412')
    expect(testoKm(1200)).toBe('1.200')
    expect(testoKm(0)).toBe('0')
    expect(testoKm(null)).toBe('—')
    expect(testoKm(undefined)).toBe('—')
  })
})
