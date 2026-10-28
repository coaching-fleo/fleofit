import { describe, it, expect } from 'vitest'
import { leggiAttivita, giornoLocale } from '../../../supabase/functions/_shared/attivitaGarmin.ts'
import fixture from './fixtures/garminAttivita.json'

describe('giornoLocale', () => {
  // 23:30 del 28/10/2026 ora italiana (CET, +1h) = 22:30 UTC
  const sera = Date.UTC(2026, 9, 28, 22, 30) / 1000
  it('con l\'offset locale resta il 28', () => {
    expect(giornoLocale(sera, 3600)).toBe('2026-10-28')
  })
  it('con offset 0 è ancora il 28 (22:30 UTC)', () => {
    expect(giornoLocale(sera, 0)).toBe('2026-10-28')
  })
  it('il caso che cambia giorno: 23:30 UTC con +1h diventa il 29', () => {
    const t = Date.UTC(2026, 9, 28, 23, 30) / 1000
    expect(giornoLocale(t, 0)).toBe('2026-10-28')
    expect(giornoLocale(t, 3600)).toBe('2026-10-29')
  })
})

describe('giornoLocale con l\'ora legale', () => {
  it('23:30 CEST del 15/07 (21:30 UTC, +7200) resta il 15', () => {
    expect(giornoLocale(Date.UTC(2026, 6, 15, 21, 30) / 1000, 7200)).toBe('2026-07-15')
  })
  it('00:30 CEST del 16/07 (22:30 UTC del 15, +7200) è il 16', () => {
    expect(giornoLocale(Date.UTC(2026, 6, 15, 22, 30) / 1000, 7200)).toBe('2026-07-16')
  })
})

describe('leggiAttivita', () => {
  const r = leggiAttivita(fixture)
  it('legge entrambe le chiavi di lotto e scarta la voce senza userId', () => {
    expect(r.map((a) => a.garmin_id)).toEqual(['1000000001', '1000000002', '1000000004'])
  })
  it('mappa i campi della corsa', () => {
    expect(r[0]).toEqual({
      garminUserId: 'utente-garmin-finto-1',
      garmin_id: '1000000001',
      inizio: '2026-10-28T18:30:00.000Z',
      giorno: '2026-10-28',
      tipo: 'RUNNING',
      durata_s: 2520,
      distanza_m: 8190.5,
      dati: { fc_media: 152, fc_max: 171, velocita_media_ms: 3.25, dislivello_m: 42, calorie: 540, dispositivo: 'forerunner 265' },
    })
  })
  it('omette le chiavi assenti, durata/distanza null se mancano', () => {
    expect(r[1].distanza_m).toBeNull()
    expect(r[1].dati).toEqual({ fc_media: 118, calorie: 310, dispositivo: 'forerunner 265' })
  })
  it('manuale: true solo se manual === true', () => {
    expect(r[2].dati).toEqual({ manuale: true })
    expect(r[2].giorno).toBe('2026-10-29') // 23:26 UTC + 1h
  })
  it('non porta posizione né nome', () => {
    const j = JSON.stringify(r)
    expect(j).not.toMatch(/atitude|ongitude|Corsa finta|activityName/)
  })
  it('corpo non oggetto → []', () => {
    for (const c of [null, undefined, 'x', 5, [], { activities: 'no' }]) expect(leggiAttivita(c)).toEqual([])
  })
  it('scarta voci senza id, senza activityType o senza startTimeInSeconds', () => {
    const base = { userId: 'u', summaryId: '1', activityType: 'RUNNING', startTimeInSeconds: 1793212200 }
    const corpo = { activities: [base, { ...base, summaryId: undefined }, { ...base, activityType: undefined }, { ...base, startTimeInSeconds: undefined }, null] }
    expect(leggiAttivita(corpo)).toHaveLength(1)
  })
  it('senza offset il giorno è quello UTC', () => {
    const t = Date.UTC(2026, 9, 28, 23, 30) / 1000
    const [a] = leggiAttivita({ activities: [{ userId: 'u', summaryId: '1', activityType: 'X', startTimeInSeconds: t }] })
    expect(a.giorno).toBe('2026-10-28')
  })
})
