import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

// La scheda di una Corsa: l'interruttore «Outdoor | Tapis roulant» e i ritmi
// in km/h (src/lib/tapisRoulant.js, spec 2026-11-26-tapis-roulant-design.md).

const ctrl = await vi.hoisted(async () => ({ stato: {} }))

const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  return fintoSupabase(() => ({
    workouts: [{ id: 'w1', title: 'Lungo del sabato', date: '2026-08-28', coach_notes: '', sections: ctrl.stato.sections }],
    athlete_workouts: ctrl.stato.assegnazioni,
    athletes: [{ id: 'u1', name: 'Marco', surname: 'Rinaldi' }],
    garmin_attivita: ctrl.stato.garmin,
  }), { erroreSu: () => ctrl.stato.erroreSu || [] })
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

const CORSA = {
  category: 'Running', intensity: '6',
  steps: [
    { id: 1, type: 'run', duration: '5 km', pace: '5:00 - 5:30 /km' },
    { id: 2, type: 'cooldown', duration: '10 min', pace: 'Z1' },
  ],
}

const HYROX = {
  category: 'Hyrox', intensity: '8',
  blocks: [{ id: 'b1', type: 'WarmUp', params: { duration: '8:00' }, exercises: [] }],
}

const assegnazione = () => ([{
  id: 'aw1', athlete_id: 'u1', workout_id: 'w1', completed_date: null,
  status: 'pending', notes: null, voice_note_url: null,
  athletes: { id: 'u1', name: 'Marco', surname: 'Rinaldi', photo_url: null },
}])

function apri({ ruolo = 'athlete', utente = 'u1', url = '/workout/w1?athlete_id=u1' } = {}) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <AuthContext.Provider value={{ user: { id: utente, email: 'a@b.it', user_metadata: {} }, role: ruolo }}>
        <Routes><Route path="/workout/:id" element={<WorkoutDetail />} /></Routes>
      </AuthContext.Provider>
    </MemoryRouter>
  )
}

const attendi = () => waitFor(() =>
  expect(screen.getByRole('heading', { name: 'Lungo del sabato' })).toBeInTheDocument())

beforeEach(() => {
  ctrl.stato = { sections: CORSA, assegnazioni: assegnazione(), garmin: [] }
  finto.chiamate.length = 0
  window.localStorage.setItem('pushfit_come_stai_saltato', JSON.stringify(new Date().toLocaleDateString('sv-SE')))
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('Outdoor | Tapis roulant', () => {
  it('parte da Outdoor con i ritmi del coach', async () => {
    apri()
    await attendi()
    expect(screen.getByRole('button', { name: 'Outdoor' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('@5:00 - 5:30 /km')).toBeInTheDocument()
  })

  it('Tapis roulant mostra i km/h, le zone restano', async () => {
    apri()
    await attendi()
    await userEvent.click(screen.getByRole('button', { name: 'Tapis roulant' }))
    expect(screen.getByRole('button', { name: 'Tapis roulant' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('@10,9 – 12,0 km/h')).toBeInTheDocument()
    expect(screen.getByText('@Z1')).toBeInTheDocument()
    expect(screen.queryByText('@5:00 - 5:30 /km')).not.toBeInTheDocument()
  })

  it('si torna a Outdoor', async () => {
    apri()
    await attendi()
    await userEvent.click(screen.getByRole('button', { name: 'Tapis roulant' }))
    await userEvent.click(screen.getByRole('button', { name: 'Outdoor' }))
    expect(screen.getByText('@5:00 - 5:30 /km')).toBeInTheDocument()
  })

  it('con sole zone l\'interruttore non c\'è', async () => {
    ctrl.stato.sections = { category: 'Running', steps: [{ id: 1, type: 'run', duration: '40 min', pace: 'Z2' }] }
    apri()
    await attendi()
    expect(screen.queryByRole('button', { name: 'Tapis roulant' })).not.toBeInTheDocument()
  })

  it('lo vede anche il coach', async () => {
    apri({ ruolo: 'admin', utente: 'coach1' })
    await attendi()
    expect(screen.getByRole('button', { name: 'Tapis roulant' })).toBeInTheDocument()
  })

  it('Hyrox non ha l\'interruttore', async () => {
    ctrl.stato.sections = HYROX
    apri()
    await attendi()
    expect(screen.queryByRole('button', { name: 'Tapis roulant' })).not.toBeInTheDocument()
  })
})
