import { describe, it, expect } from 'vitest'
import { durataGarmin, obiettivoGarmin, corsaVersoGarmin } from '../../../supabase/functions/_shared/workoutGarmin.ts'

// La Corsa tradotta per l'orologio: la traduzione è pura, quindi si prova qui.
// ⚠️ Le unità (m/s per PACE, zona come targetValue, 100 caratteri) vanno
// verificate alla prima prova vera con Garmin.

describe('durataGarmin', () => {
  it('tempo', () => {
    expect(durataGarmin('10 min')).toEqual({ durationType: 'TIME', durationValue: 600 })
    expect(durataGarmin('30 sec')).toEqual({ durationType: 'TIME', durationValue: 30 })
    expect(durataGarmin('12:30')).toEqual({ durationType: 'TIME', durationValue: 750 })
  })
  it('distanza', () => {
    expect(durataGarmin('400m')).toEqual({ durationType: 'DISTANCE', durationValue: 400, durationValueType: 'METER' })
    expect(durataGarmin('5 km')).toEqual({ durationType: 'DISTANCE', durationValue: 5000, durationValueType: 'METER' })
    expect(durataGarmin('1.5 km')).toEqual({ durationType: 'DISTANCE', durationValue: 1500, durationValueType: 'METER' })
    expect(durataGarmin('1,5 km')).toEqual({ durationType: 'DISTANCE', durationValue: 1500, durationValueType: 'METER' })
  })
  it('aperta se non si capisce', () => {
    expect(durataGarmin('')).toEqual({ durationType: 'OPEN' })
    expect(durataGarmin('q.b.')).toEqual({ durationType: 'OPEN' })
  })
})

describe('obiettivoGarmin', () => {
  it('due ritmi: più lento in Low, più veloce in High, in m/s', () => {
    expect(obiettivoGarmin('5:00 /km', '5:30 /km')).toMatchObject({
      targetType: 'PACE', targetValueLow: 3.03, targetValueHigh: 3.333, testo: '5:00–5:30 /km',
    })
    expect(obiettivoGarmin('5:30 /km', '5:00 /km')).toMatchObject({ targetValueLow: 3.03, targetValueHigh: 3.333 })
  })
  it('un ritmo solo: ±5 s/km', () => {
    const o = obiettivoGarmin('5:00 /km', '-')
    expect(o).toMatchObject({ targetType: 'PACE', targetValueLow: 3.279, targetValueHigh: 3.390, testo: '5:00 /km' })
    expect(obiettivoGarmin('5:00 /km', '')).toMatchObject({ targetType: 'PACE', targetValueLow: 3.279 })
    expect(o).not.toHaveProperty('targetValue')
  })
  it('zone', () => {
    expect(obiettivoGarmin('Z3', '-')).toMatchObject({ targetType: 'HEART_RATE', targetValue: 3, testo: 'Z3' })
  })
  it('il resto è aperto', () => {
    expect(obiettivoGarmin('Gara', '-')).toMatchObject({ targetType: 'OPEN', testo: 'Gara' })
    expect(obiettivoGarmin('Libero', '-')).toMatchObject({ targetType: 'OPEN', testo: 'Libero' })
    expect(obiettivoGarmin('', '')).toMatchObject({ targetType: 'OPEN', testo: '' })
  })
})

describe('corsaVersoGarmin', () => {
  const w = corsaVersoGarmin({ title: 'Ripetute · AB12', sections: { category: 'Running', steps: [
    { type: 'warmup', duration: '10 min', paceMin: 'Z2', paceMax: '-' },
    { type: 'repeat', rounds: '3', parti: [
      { tipo: 'run', duration: '4 min', paceMin: 'Z4', paceMax: '-' },
      { tipo: 'recover', duration: '3 min', paceMin: 'Z2', paceMax: '-' }] },
    { type: 'cooldown', duration: '1 km', paceMin: 'Libero', paceMax: '-' }] } })

  it('struttura e ordine dei passi', () => {
    expect(w.sport).toBe('RUNNING')
    expect(w.workoutProvider).toBe('FLEOFIT')
    expect(w.workoutSourceId).toBe('FLEOFIT')
    expect(w.workoutName).toBe('Ripetute · AB12')
    expect(w.steps.map(s => s.type)).toEqual(['WorkoutStep', 'WorkoutRepeatStep', 'WorkoutStep'])
    expect(w.steps[1]).toMatchObject({ repeatValue: 3, repeatType: 'REPEAT_UNTIL_STEPS_CMPLT', skipLastRestStep: false })
    expect(w.steps[1].steps.map(s => s.intensity)).toEqual(['INTERVAL', 'RECOVERY'])
    expect([w.steps[0], w.steps[1], ...w.steps[1].steps, w.steps[2]].map(s => s.stepOrder)).toEqual([1, 2, 3, 4, 5])
    expect(w.steps.filter(s => s.type === 'WorkoutStep').map(s => s.intensity)).toEqual(['WARMUP', 'COOLDOWN'])
  })
  it('un passo porta durata, obiettivo e descrizione', () => {
    expect(w.steps[0]).toEqual({
      type: 'WorkoutStep', stepOrder: 1, intensity: 'WARMUP', description: 'Z2',
      durationType: 'TIME', durationValue: 600, targetType: 'HEART_RATE', targetValue: 2,
    })
  })
  it('le note finiscono nella descrizione, tagliata a 100', () => {
    const r = corsaVersoGarmin({ title: 'x', sections: { steps: [
      { type: 'run', duration: '5 km', paceMin: 'Z3', paceMax: '-', notes: 'tieni il passo' },
      { type: 'run', duration: '5 km', paceMin: 'Z3', paceMax: '-', notes: 'a'.repeat(200) }] } })
    expect(r.steps[0].description).toBe('Z3 · tieni il passo')
    expect(r.steps[1].description).toHaveLength(100)
  })
  it('descrizione omessa se non c\'è niente da dire', () => {
    const r = corsaVersoGarmin({ title: 'x', sections: { steps: [{ type: 'run', duration: '', paceMin: '', paceMax: '' }] } })
    expect(r.steps[0]).not.toHaveProperty('description')
    expect(r.steps[0]).toEqual({ type: 'WorkoutStep', stepOrder: 1, intensity: 'ACTIVE', durationType: 'OPEN', targetType: 'OPEN' })
  })
  it('ripetuta nel formato vecchio: due figli', () => {
    const r = corsaVersoGarmin({ title: 'x', sections: { steps: [
      { type: 'repeat', rounds: '6', runDuration: '400m', runPaceMin: 'Z4', recDuration: '1 min', recPaceMin: 'Z1' }] } })
    expect(r.steps[0].steps).toHaveLength(2)
    expect(r.steps[0].steps[0]).toMatchObject({ durationType: 'DISTANCE', durationValue: 400 })
    expect(r.steps[0].steps[1]).toMatchObject({ durationType: 'TIME', durationValue: 60, intensity: 'RECOVERY' })
  })
  it('rounds mancante o 0 vale 1', () => {
    const parti = [{ tipo: 'run', duration: '1 min' }]
    expect(corsaVersoGarmin({ title: 'x', sections: { steps: [{ type: 'repeat', parti }] } }).steps[0].repeatValue).toBe(1)
    expect(corsaVersoGarmin({ title: 'x', sections: { steps: [{ type: 'repeat', rounds: '0', parti }] } }).steps[0].repeatValue).toBe(1)
  })
  it('ripetuta senza parti saltata, senza buchi nella numerazione', () => {
    const r = corsaVersoGarmin({ title: 'x', sections: { steps: [
      { type: 'warmup', duration: '10 min' },
      { type: 'repeat', rounds: '3', parti: [null, 3] },
      { type: 'cooldown', duration: '5 min' }] } })
    expect(r.steps.map(s => s.type)).toEqual(['WorkoutStep', 'WorkoutStep'])
    expect(r.steps.map(s => s.stepOrder)).toEqual([1, 2])
  })
  it('passi di tipo sconosciuto saltati', () => {
    const r = corsaVersoGarmin({ title: 'x', sections: { steps: [{ type: 'boh' }, { type: 'run', duration: '1 km' }] } })
    expect(r.steps).toHaveLength(1)
    expect(r.steps[0].stepOrder).toBe(1)
  })
  it('titolo lungo tagliato a 100', () => {
    expect(corsaVersoGarmin({ title: 'T'.repeat(150), sections: { steps: [{ type: 'run' }] } }).workoutName).toHaveLength(100)
  })
  it('null se non è Corsa o non ha passi', () => {
    expect(corsaVersoGarmin({ title: 'x', sections: { category: 'Hyrox', blocks: [] } })).toBeNull()
    expect(corsaVersoGarmin({ title: 'x', sections: { category: 'Running', steps: [] } })).toBeNull()
    expect(corsaVersoGarmin({ title: 'x', sections: null })).toBeNull()
    expect(corsaVersoGarmin({ title: 'x', sections: { steps: [{ type: 'boh' }] } })).toBeNull()
  })
})
