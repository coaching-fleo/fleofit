import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

// Perché questo test esiste
// ─────────────────────────
// La scheda del workout è il posto da cui un atleta chiude davvero
// l'allenamento: ci arriva dal timer, non dalla Home. Il recap deve aprirsi
// anche di qui, e con i dati di QUESTA scheda — il titolo, la data e l'RPE
// appena dichiarato — non con quelli dell'ultima riga che la pagina aveva in
// mano.
//
// ⚠️ Il caso del coach che chiude per conto di un atleta NON è qui: su questa
// pagina il comando non esiste per lui (`eAtleta` in WorkoutDetail.jsx). Sta
// in `SchedaAtletaRecap.test.jsx`, che è l'unica superficie in cui esiste.

const ctrl = await vi.hoisted(async () => ({ stato: {} }))

const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  return fintoSupabase(() => ({
    workouts: [{ id: 'w1', title: 'Hyrox Strength #1', date: '2026-08-28', coach_notes: '', sections: ctrl.stato.sections }],
    athlete_workouts: ctrl.stato.assegnazioni,
    athletes: [{ id: 'u1', name: 'Marco', surname: 'Rinaldi' }],
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

const HYROX = {
  category: 'Hyrox', intensity: '8',
  blocks: [
    { id: 'b1', type: 'WarmUp', params: { duration: '8:00' }, exercises: [] },
    { id: 'b2', type: 'EMOM', params: { interval: '1:00', rounds: '24' }, exercises: [
      { id: 'e3', name: 'Wall Balls', reps: '20', kg: '9', intensity: '8' },
    ] },
  ],
}

const assegnazione = () => ([{
  id: 'aw1', athlete_id: 'u1', workout_id: 'w1', completed_date: '2026-08-28',
  status: 'pending', notes: null, voice_note_url: null,
  athletes: { id: 'u1', name: 'Marco', surname: 'Rinaldi', photo_url: null },
}])

function apri({ ruolo = 'athlete', utente = 'u1' } = {}) {
  return render(
    <MemoryRouter initialEntries={['/workout/w1?athlete_id=u1']}>
      <AuthContext.Provider value={{ user: { id: utente, email: 'a@b.it', user_metadata: {} }, role: ruolo }}>
        <Routes><Route path="/workout/:id" element={<WorkoutDetail />} /></Routes>
      </AuthContext.Provider>
    </MemoryRouter>
  )
}

const attendi = () => waitFor(() =>
  expect(screen.getByRole('heading', { name: 'Hyrox Strength #1' })).toBeInTheDocument())

/** Chiude l'allenamento: il comando, poi il «Fatto!» della modale RPE. */
const chiudiAllenamento = async (utente) => {
  await utente.click(screen.getByRole('button', { name: /Segna come completato/ }))
  // ⚠️ La data del workout è nel passato, quindi non scatta la conferma
  // «programmato per una data futura»: si arriva dritti alla modale.
  await utente.click(await screen.findByRole('button', { name: /Fatto!/ }))
}

beforeEach(() => {
  ctrl.stato = { sections: HYROX, assegnazioni: assegnazione() }
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('il recap dalla scheda del workout', () => {
  it("si apre all'atleta che ha appena chiuso l'allenamento", async () => {
    const utente = userEvent.setup()
    apri({ ruolo: 'athlete' })
    await attendi()
    await chiudiAllenamento(utente)

    const recap = await screen.findByRole('dialog', { name: /Recap/ })
    expect(within(recap).getByText('Hyrox Strength #1')).toBeInTheDocument()
  })
})
