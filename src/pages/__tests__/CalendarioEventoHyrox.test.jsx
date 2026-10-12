import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { montaPagina } from '../../test/montaPagina'

// Perché questi test esistono
// ────────────────────────────
// «Nuovo evento» ora sceglie la gara dal calendario HYROX. Quello che conta:
//  · la gara scelta diventa un evento NORMALE (`category: 'Event'`), con la
//    gara in `sections.hyrox` — è ciò che la fase 2 userà per il risultato;
//  · il giorno salvato è quello scelto dentro la gara, non il primo per forza;
//  · se la lista non arriva, l'evento si crea comunque a mano.

const dati = await vi.hoisted(async () => ({ workouts: [], assegnazioni: [] }))
const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  return fintoSupabase(() => ({ workouts: dati.workouts, athlete_workouts: dati.assegnazioni }))
})
vi.mock('../../supabaseClient', () => ({ supabase: finto.supabase }))

const Calendar = (await import('../Calendar')).default

// 12 ottobre 2026: Valencia (15–18) e Budapest (17) sono future, Monaco no.
const OGGI = new Date(2026, 9, 12, 10, 0, 0)
const GARE = [
  { id: '10', nome: 'HYROX Monaco', codice: 'MUC', dal: '2026-10-01', al: '2026-10-04', url: 'u' },
  { id: '11', nome: 'HYROX Valencia', codice: 'VLC', dal: '2026-10-15', al: '2026-10-18', url: 'https://hyrox.com/event/hyrox-valencia/' },
  { id: '12', nome: 'HYROX Budapest', codice: 'BUD', dal: '2026-10-17', al: '2026-10-17', url: 'u' },
]

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(OGGI)
  localStorage.clear()
  finto.chiamate.length = 0
  dati.workouts = [{ id: 'w-nuovo' }]
  dati.assegnazioni = []
  finto.supabase.functions.invoke.mockReset()
})
afterEach(() => vi.useRealTimers())

const utente = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

async function apri() {
  montaPagina(<Calendar />, { role: 'athlete' })
  const u = utente()
  await u.click(await screen.findByRole('button', { name: 'Aggiungi un evento o una gara' }))
  return u
}

describe('Nuovo evento — gara HYROX', () => {
  it('mostra solo le gare non ancora finite, e la ricerca le filtra', async () => {
    finto.supabase.functions.invoke.mockResolvedValue({ data: { gare: GARE }, error: null })
    const u = await apri()
    expect(await screen.findByText('HYROX Valencia')).toBeInTheDocument()
    expect(screen.getByText('HYROX Budapest')).toBeInTheDocument()
    expect(screen.queryByText('HYROX Monaco')).not.toBeInTheDocument()

    await u.type(screen.getByRole('searchbox', { name: 'Cerca gara HYROX' }), 'bud')
    expect(screen.queryByText('HYROX Valencia')).not.toBeInTheDocument()
    expect(screen.getByText('HYROX Budapest')).toBeInTheDocument()
  })

  it('salva un evento con la gara dentro e il giorno scelto', async () => {
    finto.supabase.functions.invoke.mockResolvedValue({ data: { gare: GARE }, error: null })
    const u = await apri()
    await u.click(await screen.findByText('HYROX Valencia'))
    await u.click(screen.getByRole('button', { name: 'sab 17' }))
    await u.click(screen.getByRole('button', { name: 'Aggiungi al Calendario' }))

    await waitFor(() => expect(finto.chiamateA('athlete_workouts', 'insert')).toHaveLength(1))
    const [workout] = finto.chiamateA('workouts', 'insert')[0].args
    expect(workout).toEqual({
      title: 'HYROX Valencia',
      date: '2026-10-17',
      sections: {
        category: 'Event', isEvent: true, isAutonomous: true,
        hyrox: { id: '11', codice: 'VLC', url: 'https://hyrox.com/event/hyrox-valencia/', dal: '2026-10-15', al: '2026-10-18' },
      },
    })
    expect(finto.chiamateA('athlete_workouts', 'insert')[0].args[0]).toMatchObject({
      athlete_id: 'u1', workout_id: 'w-nuovo', completed_date: '2026-10-17', status: 'pending',
    })
  })

  it('senza lista porta al campo libero, e l\'evento resta senza gara', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    finto.supabase.functions.invoke.mockResolvedValue({ data: null, error: new Error('502') })
    const u = await apri()
    await u.click(await screen.findByRole('button', { name: "Scrivi l'evento a mano" }))
    await u.type(screen.getByPlaceholderText('Es. Maratona di Roma'), 'Maratona di Roma')
    await u.click(screen.getByRole('button', { name: 'Aggiungi al Calendario' }))

    await waitFor(() => expect(finto.chiamateA('workouts', 'insert')).toHaveLength(1))
    expect(finto.chiamateA('workouts', 'insert')[0].args[0].sections)
      .toEqual({ category: 'Event', isEvent: true, isAutonomous: true })
  })
})
