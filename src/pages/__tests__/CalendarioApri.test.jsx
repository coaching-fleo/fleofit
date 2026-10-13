import { it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { montaPagina } from '../../test/montaPagina'

// Perché questo test esiste
// ──────────────────────────
// Fino al 13/10/2026 il calendario apriva ogni allenamento con `/workout/<id>`,
// senza dire di chi: la scheda non caricava l'assegnazione dell'atleta (nota,
// stato, RPE, tempo di gara) e mostrava il workout nudo. Se n'è accorto il
// committente aprendo una gara appena salvata col suo tempo: niente tempo.

const dati = await vi.hoisted(async () => ({ assegnazioni: [], workouts: [] }))
const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  return fintoSupabase(() => ({ workouts: dati.workouts, athlete_workouts: dati.assegnazioni }))
})
vi.mock('../../supabaseClient', () => ({ supabase: finto.supabase }))
const naviga = vi.hoisted(() => vi.fn())
vi.mock('react-router-dom', async (originale) => ({ ...(await originale()), useNavigate: () => naviga }))

const Calendar = (await import('../Calendar')).default

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date(2026, 9, 13, 10))
  naviga.mockReset()
})
afterEach(() => vi.useRealTimers())

it('l\'atleta apre la SUA assegnazione', async () => {
  dati.assegnazioni = [{
    id: 'aw1', completed_date: '2026-10-13', status: 'completed', notes: '🏁 Tempo HYROX: 1:12:38',
    workouts: { id: 'w1', title: 'HYROX Turin', date: '2026-10-13', sections: { category: 'Event', isEvent: true, isAutonomous: true } },
  }]
  montaPagina(<Calendar />, { role: 'athlete' })
  await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(await screen.findByText('HYROX Turin'))
  expect(naviga).toHaveBeenCalledWith('/workout/w1?athlete_id=u1')
})

it('il coach apre la programmazione, senza atleta', async () => {
  dati.workouts = [{ id: 'w2', title: 'EMOM 30', date: '2026-10-13', sections: { category: 'Custom', isAutonomous: true } }]
  montaPagina(<Calendar />, { role: 'admin' })
  await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(await screen.findByText('EMOM 30'))
  expect(naviga).toHaveBeenCalledWith('/workout/w2')
})
