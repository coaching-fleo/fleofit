import { describe, it, expect } from 'vitest'
import { testoNotificaCoach, testoGarminRegistrato, testoSpostatoDalCoach, daAvvisareSpostamento } from '../../../supabase/functions/send-reminders/testi.ts'

describe('testoNotificaCoach', () => {
  const base = { athleteName: 'Sara', workoutTitle: 'Sled' }
  it('registered: il nome dell\'atleta nuovo, senza genere', () => {
    expect(testoNotificaCoach({ athleteName: 'Sara Neri', action: 'registered' })).toEqual({
      title: '👋 Nuovo atleta',
      bodyMsg: 'Sara Neri ha usato il tuo codice invito: da oggi è tra i tuoi atleti.',
    })
  })
  it('completed resta identico senza daGarmin', () => {
    expect(testoNotificaCoach({ ...base, action: 'completed' })).toEqual({ title: '✅ Workout completato!', bodyMsg: 'Sara ha completato: Sled' })
  })
  it('completed con daGarmin aggiunge il suffisso', () => {
    expect(testoNotificaCoach({ ...base, action: 'completed', daGarmin: true }).bodyMsg).toBe('Sara ha completato: Sled · da Garmin')
  })
  it('daGarmin non tocca le altre azioni', () => {
    expect(testoNotificaCoach({ ...base, action: 'custom_workout', daGarmin: true }).bodyMsg).toBe('Sara ha aggiunto: Sled')
  })
  it('note e moved invariati', () => {
    expect(testoNotificaCoach({ ...base, action: 'note', noteText: 'ok' })).toEqual({ title: '📝 Nota da Sara', bodyMsg: 'Sled: "ok"' })
    expect(testoNotificaCoach({ ...base, action: 'moved', newDate: 'mer 28 ott' }).bodyMsg).toBe('Sara ha spostato Sled a mer 28 ott')
    expect(testoNotificaCoach({ ...base, action: 'moved' }).bodyMsg).toBe('Sara ha spostato Sled')
  })
})

describe('testoGarminRegistrato', () => {
  it('titolo, corpo e rotta', () => {
    expect(testoGarminRegistrato('Sled', 'w1', 'a1')).toEqual({
      title: '🎉 Allenamento completato!',
      bodyMsg: "Complimenti! Sled · registrato da Garmin. Com'è andata?",
      route: '/workout/w1?athlete_id=a1&rpe=1',
    })
  })
})

// Il coach sposta un allenamento (26/11/2026): l'atleta lo sa.
describe('testoSpostatoDalCoach', () => {
  it('titolo e data nuova', () => {
    expect(testoSpostatoDalCoach({ workoutTitle: 'Sled', newDate: 'gio 4 dic' })).toEqual({
      title: '📅 Allenamento spostato', bodyMsg: 'Sled ora è gio 4 dic',
    })
  })
})

describe('daAvvisareSpostamento', () => {
  const righe = [
    { id: 'a', athlete_id: 'x', status: 'pending' },
    { id: 'b', athlete_id: 'y', status: 'pending' },
    { id: 'c', athlete_id: 'x', status: 'completed' },
  ]
  it('l\'admin avvisa tutti i non svolti', () => {
    expect(daAvvisareSpostamento(righe, { ruoloStaff: 'admin', mieiAtleti: [] }).map(r => r.id)).toEqual(['a', 'b'])
  })
  it('il coach solo i suoi atleti', () => {
    expect(daAvvisareSpostamento(righe, { ruoloStaff: 'coach', mieiAtleti: ['x'] }).map(r => r.id)).toEqual(['a'])
  })
  it('il servizio come l\'admin, nessun ruolo nessuno', () => {
    expect(daAvvisareSpostamento(righe, { ruoloStaff: null, servizio: true, mieiAtleti: [] })).toHaveLength(2)
    expect(daAvvisareSpostamento(righe, { ruoloStaff: null, mieiAtleti: ['x'] })).toEqual([])
  })
})
