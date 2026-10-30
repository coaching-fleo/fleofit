import { describe, it, expect } from 'vitest'
import { testoNotificaCoach, testoGarminRegistrato } from '../../../supabase/functions/send-reminders/testi.ts'

describe('testoNotificaCoach', () => {
  const base = { athleteName: 'Sara', workoutTitle: 'Sled' }
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
