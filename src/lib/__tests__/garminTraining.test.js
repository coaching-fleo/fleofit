import { describe, it, expect } from 'vitest'
import {
  GARMIN_TRAINING, oggiItalia, firmaWorkout, decidiInvio, idDaRisposta, invioInCorso,
} from '../../../supabase/functions/_shared/garminTraining.ts'

// Perché questi test esistono
// ────────────────────────────
// `decidiInvio` decide se un workout va creato, rifatto, spostato o tolto
// dall'orologio. Gli errori qui costano caro e in silenzio: un doppione sul
// Garmin, un allenamento passato cancellato dallo storico, un workout che
// resta sull'orologio dopo che il coach l'ha tolto.

const OGGI = '2026-10-28'
const W = { workoutName: 'Corsa', sport: 'RUNNING', steps: [{ type: 'WorkoutStep', durationValue: 600 }] }
const COLL = { stato: 'attivo', invia_workout: true, permessi: ['WORKOUT_IMPORT', 'ACTIVITY_EXPORT'] }
const ASS = { data: '2026-10-30', completata: false }
const INV = { data: '2026-10-30', stato: 'inviato', firma: 'abc', inCorso: false }

const base = (extra = {}) => ({
  assegnazione: ASS, workout: W, collegamento: COLL, invio: INV, firma: 'abc', oggi: OGGI, ...extra,
})

describe('decidiInvio', () => {
  it('non idoneo e nessun invio: niente', () => {
    expect(decidiInvio(base({ invio: null, collegamento: { ...COLL, invia_workout: false } }))).toBe('niente')
  })
  it('non idoneo, invio con data passata: niente (resta nello storico)', () => {
    expect(decidiInvio(base({ invio: { ...INV, data: '2026-10-20' }, collegamento: null }))).toBe('niente')
  })
  it('assegnazione con data passata, invio futuro: niente', () => {
    expect(decidiInvio(base({ assegnazione: { ...ASS, data: '2026-10-20' } }))).toBe('niente')
  })
  it('non idoneo, invio futuro: cancella', () => {
    expect(decidiInvio(base({ collegamento: null }))).toBe('cancella')
  })
  it('idoneo e nessun invio: crea', () => {
    expect(decidiInvio(base({ invio: null }))).toBe('crea')
  })
  it('oggi stesso è ancora idoneo', () => {
    expect(decidiInvio(base({ invio: null, assegnazione: { ...ASS, data: OGGI } }))).toBe('crea')
  })
  it('idoneo, invio non inviato: rifai', () => {
    expect(decidiInvio(base({ invio: { ...INV, stato: 'da_rifare' } }))).toBe('rifai')
  })
  it('idoneo, firma diversa: rifai', () => {
    expect(decidiInvio(base({ firma: 'xyz' }))).toBe('rifai')
  })
  it('idoneo, data diversa: sposta', () => {
    expect(decidiInvio(base({ assegnazione: { ...ASS, data: '2026-11-02' } }))).toBe('sposta')
  })
  it('tutto uguale: niente', () => {
    expect(decidiInvio(base())).toBe('niente')
  })
  it('completata con invio futuro identico: niente', () => {
    expect(decidiInvio(base({ assegnazione: { ...ASS, completata: true } }))).toBe('niente')
  })
  it('invio in corso con firma diversa: niente (nessun doppione)', () => {
    expect(decidiInvio(base({ firma: 'xyz', invio: { ...INV, inCorso: true } }))).toBe('niente')
  })
  it('workout null (categoria diventata Hyrox) con invio futuro: cancella', () => {
    expect(decidiInvio(base({ workout: null }))).toBe('cancella')
  })
  it('assegnazione cancellata con invio futuro: cancella', () => {
    expect(decidiInvio(base({ assegnazione: null }))).toBe('cancella')
  })
  it('invia_workout spento: cancella', () => {
    expect(decidiInvio(base({ collegamento: { ...COLL, invia_workout: false } }))).toBe('cancella')
  })
  it('senza WORKOUT_IMPORT: cancella', () => {
    expect(decidiInvio(base({ collegamento: { ...COLL, permessi: ['ACTIVITY_EXPORT'] } }))).toBe('cancella')
  })
  it('collegamento non attivo: cancella', () => {
    expect(decidiInvio(base({ collegamento: { ...COLL, stato: 'scaduto' } }))).toBe('cancella')
  })
})

describe('invioInCorso', () => {
  const adesso = new Date('2026-10-28T10:00:00Z')
  it('da_rifare, senza id, aggiornato un minuto fa: in corso', () => {
    expect(invioInCorso({ stato: 'da_rifare', garmin_workout_id: null, aggiornato_at: '2026-10-28T09:59:00Z' }, adesso)).toBe(true)
  })
  it('più vecchio di 2 minuti: non in corso', () => {
    expect(invioInCorso({ stato: 'da_rifare', garmin_workout_id: null, aggiornato_at: '2026-10-28T09:57:00Z' }, adesso)).toBe(false)
  })
  it('con un id già dato: non in corso', () => {
    expect(invioInCorso({ stato: 'da_rifare', garmin_workout_id: '5', aggiornato_at: '2026-10-28T09:59:30Z' }, adesso)).toBe(false)
  })
  it('stato inviato: non in corso', () => {
    expect(invioInCorso({ stato: 'inviato', garmin_workout_id: null, aggiornato_at: '2026-10-28T09:59:30Z' }, adesso)).toBe(false)
  })
})

describe('oggiItalia', () => {
  it('a 23:30 UTC in Italia è già il giorno dopo', () => {
    expect(oggiItalia(new Date('2026-10-28T23:30:00Z'))).toBe('2026-10-29')
  })
})

describe('firmaWorkout', () => {
  it('uguale per due oggetti uguali, diversa se cambia un durationValue', async () => {
    const copia = JSON.parse(JSON.stringify(W))
    const diverso = JSON.parse(JSON.stringify(W))
    diverso.steps[0].durationValue = 601
    const a = await firmaWorkout(W)
    expect(a).toMatch(/^[0-9a-f]{64}$/)
    expect(await firmaWorkout(copia)).toBe(a)
    expect(await firmaWorkout(diverso)).not.toBe(a)
  })
})

describe('idDaRisposta', () => {
  it('numero nudo, stringa, oggetto, vuoto', () => {
    expect(idDaRisposta(123, 'scheduleId')).toBe('123')
    expect(idDaRisposta('77', 'scheduleId')).toBe('77')
    expect(idDaRisposta({ workoutId: 9 }, 'workoutId')).toBe('9')
    expect(idDaRisposta({}, 'workoutId')).toBeNull()
    expect(idDaRisposta(null, 'workoutId')).toBeNull()
  })
})

describe('GARMIN_TRAINING', () => {
  it('ha i due indirizzi', () => {
    expect(GARMIN_TRAINING.workout).toBe('https://apis.garmin.com/training-api/workout')
    expect(GARMIN_TRAINING.schedule).toBe('https://apis.garmin.com/training-api/schedule')
  })
})
