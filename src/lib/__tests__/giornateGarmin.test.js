import { describe, it, expect } from 'vitest'
import { leggiGiornate, CHIAVI_GIORNATE } from '../../../supabase/functions/_shared/giornateGarmin.ts'
import fixture from './fixtures/garminGiornate.json'

describe('leggiGiornate', () => {
  const r = leggiGiornate(fixture)
  const di = (colonna) => r.filter((v) => v.colonna === colonna)

  it('le chiavi del lotto: bodyComps non c\'è', () => {
    expect(CHIAVI_GIORNATE).toEqual({ dailies: 'giornata', sleeps: 'sonno', hrv: 'hrv' })
  })
  it('una voce per riepilogo valido, con la colonna giusta; chiavi sconosciute ignorate', () => {
    expect(di('giornata')).toHaveLength(2)
    expect(di('sonno')).toHaveLength(2)
    expect(di('hrv')).toHaveLength(1)
    expect(r).toHaveLength(5)
  })
  it('scarta il riepilogo senza userId o con calendarDate non valida', () => {
    expect(di('giornata').map((v) => v.giorno)).toEqual(['2026-10-28', '2026-10-27'])
  })
  it('giornata: i campi, con gli intensi (moderati + 2 x vigorosi) in minuti', () => {
    expect(di('giornata')[0]).toEqual({
      garmin_user_id: 'utente-garmin-finto-1',
      giorno: '2026-10-28',
      colonna: 'giornata',
      valore: {
        passi: 9120, calorie: 610, minuti_intensi: 60, fc_riposo: 52,
        stress_medio: 31, body_battery_carica: 74, body_battery_scarica: 61,
      },
    })
  })
  it('giornata: stress −1 (non misurato) e campi assenti non compaiono', () => {
    expect(di('giornata')[1].valore).toEqual({ passi: 4000 })
  })
  it('sonno: ore = profondo + leggero + rem (lo sveglio non conta), più fasi e punteggio', () => {
    expect(di('sonno')[0].valore).toEqual({
      ore: 7.5, profondo_min: 90, leggero_min: 240, rem_min: 120, sveglio_min: 60,
      punteggio: 81, qualita: 'GOOD',
    })
  })
  it('sonno senza fasi: ore dalla durata totale', () => {
    expect(di('sonno')[1].valore).toEqual({ ore: 7 })
  })
  it('hrv: media della notte e picco', () => {
    expect(di('hrv')[0].valore).toEqual({ media_notte: 58, picco_5min: 94 })
  })
  it('nessun campo estraneo (campioni, livelli) nel valore', () => {
    const chiavi = r.flatMap((v) => Object.keys(v.valore))
    for (const vietata of ['timeOffsetHeartRateSamples', 'sleepLevelsMap', 'hrvValues', 'weightInGrams', 'validation']) {
      expect(chiavi).not.toContain(vietata)
    }
  })
  it('un corpo che non è un oggetto dà una lista vuota', () => {
    for (const x of [null, undefined, 'x', 3, [], { dailies: 'no' }, { dailies: [null, 4] }]) {
      expect(leggiGiornate(x)).toEqual([])
    }
  })
})
