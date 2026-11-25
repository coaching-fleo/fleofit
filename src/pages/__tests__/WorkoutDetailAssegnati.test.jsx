import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

// Perché questi test esistono (25/11/2026)
// ────────────────────────────────────────
// «Assegnato a» con trenta atleti era una colonna lunga quanto la scheda.
// Oltre sei righe l'elenco scorre dentro la sua card e sopra compare la
// ricerca per nome. Le regressioni da prendere:
//  1. fino a sei la ricerca NON c'è (sarebbe rumore su una lista corta);
//  2. oltre sei c'è, e filtra davvero, anche a parole invertite;
//  3. una ricerca senza risultati lo dice, invece di lasciare una card vuota.

const ctrl = await vi.hoisted(async () => ({ stato: {} }))

const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  return fintoSupabase(() => ({
    workouts: [{ id: 'w1', title: 'Hyrox Strength', date: '2026-09-01', coach_notes: '',
      sections: { category: 'Custom', isAutonomous: true } }],
    athlete_workouts: ctrl.stato.assegnazioni ?? [],
    athletes: [],
  }))
})

vi.mock('../../supabaseClient', () => ({ supabase: finto.supabase }))
vi.mock('jspdf', () => ({ default: class {}, jsPDF: class {} }))
vi.mock('html-to-image', () => ({ toPng: vi.fn(), toBlob: vi.fn() }))
vi.mock('@capacitor/network', () => ({ Network: {
  getStatus: vi.fn(() => Promise.resolve({ connected: true })),
  addListener: vi.fn(() => Promise.resolve({ remove: vi.fn() })),
} }))

const { AuthContext } = await import('../../App')
const WorkoutDetail = (await import('../WorkoutDetail')).default

const NOMI = [['Marco', 'Rossi'], ['Luca', 'Bianchi'], ['Chiara', 'Donati'], ['Sara', 'Verdi'],
  ['Paolo', 'Neri'], ['Anna', 'Gallo'], ['Elena', 'Conti'], ['Giulia', 'Ricci']]

const assegnazioni = (n) => NOMI.slice(0, n).map(([name, surname], i) => ({
  id: `aw${i}`, workout_id: 'w1', athlete_id: `a${i}`, status: 'pending', notes: '',
  voice_note_url: null, completed_date: null,
  athletes: { id: `a${i}`, name, surname, photo_url: null },
}))

function apri() {
  return render(
    <MemoryRouter initialEntries={['/workout/w1']}>
      <AuthContext.Provider value={{ user: { id: 'coach', email: 'c@f.it', user_metadata: {} }, role: 'admin' }}>
        <Routes><Route path="/workout/:id" element={<WorkoutDetail />} /></Routes>
      </AuthContext.Provider>
    </MemoryRouter>
  )
}

const campo = () => screen.queryByRole('searchbox', { name: 'Cerca fra gli assegnati' })

beforeEach(() => { ctrl.stato = {} })

describe('«Assegnato a» nella scheda workout', () => {
  it('fino a sei atleti non mostra la ricerca', async () => {
    ctrl.stato.assegnazioni = assegnazioni(6)
    apri()
    await waitFor(() => expect(screen.getByText('6 atleti')).toBeInTheDocument())
    expect(campo()).toBeNull()
  })

  it('oltre sei mostra la ricerca, e la ricerca filtra', async () => {
    ctrl.stato.assegnazioni = assegnazioni(8)
    apri()
    await waitFor(() => expect(campo()).toBeInTheDocument())
    expect(screen.getByText('Giulia Ricci')).toBeInTheDocument()

    await userEvent.type(campo(), 'rossi marco')
    expect(screen.getByText('Marco Rossi')).toBeInTheDocument()
    expect(screen.queryByText('Giulia Ricci')).toBeNull()
  })

  it('una ricerca senza risultati lo dice', async () => {
    ctrl.stato.assegnazioni = assegnazioni(8)
    apri()
    await waitFor(() => expect(campo()).toBeInTheDocument())
    await userEvent.type(campo(), 'zzz')
    expect(screen.getByText('Nessun atleta con questo nome.')).toBeInTheDocument()
  })
})
