import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import { montaPagina } from '../../test/montaPagina'
import { oggiItalia } from '../../lib/recuperoGarmin'

// Perché questi test esistono
// ────────────────────────────
// La sezione «Recupero» a tessere (26/11/2026, spec
// 2026-11-26-recupero-garmin-scheda-design.md): la scheda deve leggere
// abbastanza giorni da avere la media PRIMA delle notti storte, e la risposta
// di oggi a «Come stai». Senza, la frase dice «nella norma» a un atleta che
// dorme cinque ore da tre notti, senza nessun errore a schermo.

const giorno = (indietro) => {
  const [a, m, g] = oggiItalia().split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, g - indietro)).toISOString().slice(0, 10)
}
const giornata = (i, storta) => ({
  athlete_id: 'a5', giorno: giorno(i),
  hrv: { media_notte: storta ? 51 : 60 },
  giornata: { fc_riposo: storta ? 58 : 52, body_battery_carica: 62, stress_medio: 30 },
  sonno: { ore: storta ? 5.5 : 7.4, punteggio: storta ? 57 : 80 },
})
const dati = await vi.hoisted(async () => ({ giornate: [], comeStai: [] }))
const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  return fintoSupabase(() => ({
    athletes: [{ id: 'a5', name: 'Andrea', surname: 'Vitali', photo_url: null, weight: 74, height: 181, birth_date: '1992-04-03', instagram_url: null, strava_url: null, notes: null }],
    athlete_workouts: [], personal_records: [],
    garmin_giornate: dati.giornate, come_stai: dati.comeStai,
  }))
})
vi.mock('../../supabaseClient', () => ({ supabase: finto.supabase }))

const AthleteDetail = (await import('../AthleteDetail')).default

const monta = (proprio = false) => montaPagina(<AthleteDetail />, proprio
  ? { role: 'athlete', user: { id: 'a5', email: 'a@f.it' }, percorso: '/profile', rotta: '/profile' }
  : { role: 'coach', user: { id: 'coach', email: 'c@f.it' }, percorso: '/athletes/a5', rotta: '/athletes/:id' })

beforeEach(() => {
  // 35 notti normali (da 37 a 3 giorni fa) e 3 storte: serve leggerne più di 28.
  dati.giornate = [...Array.from({ length: 35 }, (_, i) => giornata(37 - i, false)), ...[2, 1, 0].map(i => giornata(i, true))]
  dati.comeStai = [{ id: 'cs', athlete_id: 'a5', giorno: giorno(0), sonno: 1, energia: 2, dolori: 4, stress: 3 }]
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('La sezione Recupero nella scheda atleta', () => {
  it('il coach vede la frase, le tessere tinte e come ha detto di stare', async () => {
    monta()
    const sezione = await screen.findByRole('region', { name: 'Recupero' })
    expect(within(sezione).getByText('Da guardare')).toBeInTheDocument()
    expect(sezione.textContent).toContain('Dorme poco e recupera meno del solito:')
    expect(sezione.textContent).toContain('Stamattina ha detto: sonno «Pessimo», energia «Poca».')
    expect(sezione.querySelector('[data-tessera="hrv"][data-fuori]')).toBeTruthy()
    expect(sezione.querySelector('[data-tessera="come-stai"]')).toBeTruthy()
    expect(finto.chiamateA('garmin_giornate', 'gte')[0].args[1]).toBe(giorno(41))
  })

  it('sul proprio profilo la frase è in seconda persona', async () => {
    monta(true)
    const sezione = await screen.findByRole('region', { name: 'Recupero' })
    expect(sezione.textContent).toContain('Dormi poco e recuperi meno del solito:')
    expect(within(sezione).getByText('Come hai detto di stare')).toBeInTheDocument()
  })

  it('senza giornate la sezione non c\'è', async () => {
    dati.giornate = []
    monta()
    await waitFor(() => expect(screen.getByRole('heading', { name: /Andrea Vitali/ })).toBeInTheDocument())
    expect(screen.queryByRole('region', { name: 'Recupero' })).not.toBeInTheDocument()
  })
})
