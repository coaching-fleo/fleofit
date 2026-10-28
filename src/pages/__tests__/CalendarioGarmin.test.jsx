import { it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { montaPagina } from '../../test/montaPagina'

// Perché questo test esiste
// ──────────────────────────
// Garmin Fase 1 (28/10/2026): nel calendario dell'atleta un'attività
// dell'orologio non abbinata è una voce grigia «Garmin · Corsa 42′», letta con
// le assegnazioni del mese; dal suo foglio «Abbina a…» la mette su
// un'assegnazione vicina e il mese si ricarica. Il coach qui vede la
// programmazione: niente voci, e niente lettura.

const dati = await vi.hoisted(async () => ({ assegnazioni: [], attivita: [] }))
const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  return fintoSupabase(() => ({ workouts: [], athlete_workouts: dati.assegnazioni, garmin_attivita: dati.attivita }))
})
vi.mock('../../supabaseClient', () => ({ supabase: finto.supabase }))
vi.mock('react-router-dom', async (originale) => ({ ...(await originale()), useNavigate: () => vi.fn() }))

const Calendar = (await import('../Calendar')).default

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date(2026, 9, 13, 10))
  finto.chiamate.length = 0
  dati.assegnazioni = [{
    id: 'aw1', completed_date: '2026-10-12', status: 'pending', notes: null,
    workouts: { id: 'w1', title: 'Lungo lento', date: '2026-10-12', sections: { category: 'Running', steps: [] } },
  }]
  dati.attivita = [{ garmin_id: 'g1', giorno: '2026-10-13', tipo: 'RUNNING', durata_s: 2520, athlete_workout_id: null, dati: {} }]
})
afterEach(() => vi.useRealTimers())

it('l\'atleta vede la voce grigia e la abbina all\'allenamento del giorno prima', async () => {
  montaPagina(<Calendar />, { role: 'athlete' })
  const utente = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  await utente.click(await screen.findByRole('button', { name: /Garmin · Corsa 42′/ }))
  const foglio = await screen.findByRole('dialog', { name: 'Garmin · Corsa' })
  await utente.click(within(foglio).getByRole('button', { name: /Lungo lento/ }))
  await waitFor(() => expect(finto.chiamateA('athlete_workouts', 'update')).toHaveLength(1))
  expect(finto.chiamateA('garmin_attivita', 'update')[0].args[0]).toEqual({ athlete_workout_id: 'aw1', abbinamento: 'atleta' })
  // Il mese si rilegge: due letture di attività, una all'apertura e una dopo.
  await waitFor(() => expect(finto.chiamateA('garmin_attivita', 'select')).toHaveLength(2))
})

it('il coach non vede voci Garmin, e non le legge', async () => {
  montaPagina(<Calendar />, { role: 'admin' })
  await screen.findByText(/Niente in programma/)
  expect(screen.queryByRole('button', { name: /Garmin ·/ })).not.toBeInTheDocument()
  expect(finto.chiamateA('garmin_attivita')).toHaveLength(0)
})
