import { describe, it, expect } from 'vitest'
import { semi } from '../demoSemi'
import { righeDaGarmin, vociLibere } from '../lib/attivitaGarmin'

// Le attività Garmin della demo (INVENTATE) servono a vedere, in
// `npm run demo:atleta`, la card «Da Garmin» e la voce grigia del calendario.
describe('le attività Garmin della demo', () => {
  const db = semi()
  const attivita = db.garmin_attivita

  it('una è abbinata da sola a una corsa completata di Sara', () => {
    const abbinata = attivita.find(a => a.athlete_workout_id)
    expect(abbinata.abbinamento).toBe('auto')
    const aw = db.athlete_workouts.find(x => x.id === abbinata.athlete_workout_id)
    expect(aw).toMatchObject({ athlete_id: 'at-sara', status: 'completed', workout_id: 'w-corsa' })
    expect(righeDaGarmin(abbinata).map(r => r.etichetta)).toContain('Passo')
  })

  it('una è libera, in un giorno senza allenamenti di Sara', () => {
    const libera = attivita.find(a => !a.athlete_workout_id)
    expect(libera.abbinamento).toBeNull()
    expect(db.athlete_workouts.filter(a => a.athlete_id === 'at-sara' && a.completed_date === libera.giorno)).toHaveLength(0)
    expect(vociLibere(attivita.filter(a => !a.athlete_workout_id), libera.giorno)).toHaveLength(1)
  })
})
