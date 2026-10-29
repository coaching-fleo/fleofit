import { describe, it, expect } from 'vitest'
import { semi } from '../demoSemi'
import { segnaliRecupero, serieRecupero } from '../lib/recuperoGarmin'
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

// Le giornate Garmin della demo (INVENTATE): 35 giorni normali e 3 notti storte
// fino a ieri, così card «Recupero» e segnali si vedono in `npm run demo`.
describe('le giornate Garmin della demo', () => {
  const righe = semi().garmin_giornate

  it('sono tutte di Sara e hanno le tre colonne', () => {
    expect(righe.length).toBeGreaterThanOrEqual(35)
    for (const r of righe) {
      expect(r.athlete_id).toBe('at-sara')
      expect(r.giornata).toBeTruthy()
      expect(r.sonno.ore).toBeGreaterThan(0)
      expect(r.hrv.media_notte).toBeGreaterThan(0)
    }
  })

  it('le ultime 3 notti accendono i tre segnali, con un riferimento valido', () => {
    const tipi = segnaliRecupero(righe).map(s => s.tipo).sort()
    expect(tipi).toEqual(['fc', 'hrv', 'sonno'])
    expect(serieRecupero(righe).hrv.media).not.toBeNull()
  })
})

