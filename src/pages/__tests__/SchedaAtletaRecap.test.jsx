import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { montaPagina } from '../../test/montaPagina'

// Perché questo test esiste
// ─────────────────────────
// 🔴 La scheda atleta è l'UNICA superficie in cui un coach può chiudere
// l'allenamento di qualcun altro: nella Home il ramo atleta non esiste per lui,
// e nella scheda del workout il comando è riservato a `eAtleta`. Qui no — il
// bottone «Cambia lo stato dell'allenamento» non guarda il ruolo.
//
// Il recap post-allenamento (CLAUDE.md §9-quadragies) racconta una settimana,
// una serie e un andamento PERSONALI. Aperto al coach gli mostrerebbe la
// storia di quell'atleta sotto la cornice «il tuo 14° allenamento», e non
// darebbe nessun errore: sarebbero numeri plausibili della persona sbagliata.

const dati = await vi.hoisted(async () => ({ atleta: null, assegnazioni: [] }))
const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  return fintoSupabase(() => ({
    athletes: [dati.atleta],
    athlete_workouts: dati.assegnazioni,
    personal_records: [],
  }))
})
vi.mock('../../supabaseClient', () => ({ supabase: finto.supabase }))

const AthleteDetail = (await import('../AthleteDetail')).default

const ATLETA = {
  id: 'a1', name: 'Marco', surname: 'Ferrero', photo_url: null,
  weight: 74, height: 178, birth_date: '1997-04-03',
  instagram_url: null, strava_url: null, notes: null,
}

const giorno = (scarto) => new Date(Date.now() + scarto * 86400000).toISOString().split('T')[0]

/** Ieri, così non scatta la conferma «programmato per una data futura». */
const daFare = () => ([{
  id: 'aw1', completed_date: giorno(-1), status: 'pending', notes: null, voice_note_url: null,
  workouts: { id: 'w1', title: 'Hyrox Strength', sections: { category: 'Hyrox', intensity: '8', blocks: [{ type: 'AMRAP', params: { duration: '40 min' } }] } },
}])

const comeCoach = () => montaPagina(<AthleteDetail />, {
  role: 'admin', user: { id: 'coach', email: 'c@f.it' },
  percorso: '/athletes/a1', rotta: '/athletes/:id',
})
const comeAtleta = () => montaPagina(<AthleteDetail />, { role: 'athlete', user: { id: 'a1', email: 'a@f.it' } })

const attendi = () => waitFor(() =>
  expect(screen.getByRole('heading', { name: /Marco Ferrero/ })).toBeInTheDocument())

const chiudiAllenamento = async (utente) => {
  // Lo storico nasce chiuso: va aperto per arrivare alla riga.
  const storico = screen.queryByRole('button', { name: /Storico allenamenti/i })
  if (storico) await utente.click(storico)
  await utente.click((await screen.findAllByLabelText(/Cambia lo stato dell'allenamento/))[0])
  await utente.click(await screen.findByRole('button', { name: /Fatto!/ }))
}

beforeEach(() => {
  dati.atleta = { ...ATLETA }
  dati.assegnazioni = daFare()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('il recap dalla scheda atleta', () => {
  it("si apre all'atleta che chiude un allenamento sul proprio profilo", async () => {
    const utente = userEvent.setup()
    comeAtleta()
    await attendi()
    await chiudiAllenamento(utente)
    expect(await screen.findByRole('dialog', { name: /Recap/ })).toBeInTheDocument()
  })

  it('NON si apre al coach che chiude per conto di un atleta', async () => {
    const utente = userEvent.setup()
    comeCoach()
    await attendi()
    await chiudiAllenamento(utente)

    // L'allenamento si chiude lo stesso: quello che non deve comparire è il
    // recap, non il completamento.
    await waitFor(() => expect(finto.chiamateA('athlete_workouts', 'update').length).toBeGreaterThan(0))
    expect(screen.queryByRole('dialog', { name: /Recap/ })).not.toBeInTheDocument()
  })
})
