import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { addDays, format } from 'date-fns'

// Perché questi test esistono (26/11/2026)
// ────────────────────────────────────────
// Il coach sposta la data dalla scheda (docs/memoria/calendario.md
// §9-sposta-coach). Da prendere:
//  1. la data in testa è un bottone per il coach, testo per l'atleta;
//  2. «Tutti» scrive `workouts.date` e SOLO le assegnazioni non svolte rimaste
//     sulla data del workout;
//  3. «Sposta» su una riga di «Assegnato a» non tocca mai `workouts.date`.

const ctrl = await vi.hoisted(async () => ({ stato: {} }))

const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  return fintoSupabase(() => ({
    workouts: [{ id: 'w1', title: 'Hyrox Strength', date: '2026-09-01', coach_notes: '',
      sections: { category: 'Custom', isAutonomous: false } }],
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
const { dataBreve, giornoBreve } = await import('../../lib/spostaAllenamento')

const riga = (i, name, status, completed_date) => ({
  id: `aw${i}`, workout_id: 'w1', athlete_id: `a${i}`, status, notes: '', voice_note_url: null, completed_date,
  athletes: { id: `a${i}`, name, surname: 'Test', photo_url: null },
})
const TRE = [riga(0, 'Marco', 'pending', '2026-09-01'), riga(1, 'Luca', 'completed', '2026-09-01'), riga(2, 'Sara', 'pending', '2026-09-03')]

function apri(role = 'admin', indirizzo = '/workout/w1') {
  return render(
    <MemoryRouter initialEntries={[indirizzo]}>
      <AuthContext.Provider value={{ user: { id: 'coach', email: 'c@f.it', user_metadata: {} }, role }}>
        <Routes><Route path="/workout/:id" element={<WorkoutDetail />} /></Routes>
      </AuthContext.Provider>
    </MemoryRouter>
  )
}

const dopodomani = format(addDays(new Date(), 2), 'yyyy-MM-dd')

beforeEach(() => { ctrl.stato = {}; finto.chiamate.length = 0 })

describe('Il coach sposta la data dalla scheda workout', () => {
  it('la data in testa apre il foglio per il coach', async () => {
    ctrl.stato.assegnazioni = TRE
    apri()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Cambia data' }))
    expect(screen.getByRole('dialog', { name: "Sposta l'allenamento" })).toBeInTheDocument()
  })

  it('per l\'atleta la data non è un bottone', async () => {
    apri('athlete')
    await screen.findAllByText('Hyrox Strength')
    expect(screen.queryByRole('button', { name: 'Cambia data' })).toBeNull()
  })

  it('«Tutti» scrive il workout e solo le assegnazioni rimaste sulla data', async () => {
    ctrl.stato.assegnazioni = TRE
    apri()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Cambia data' }))
    await user.click(screen.getByRole('button', { name: dataBreve(dopodomani) }))
    await user.click(screen.getByRole('button', { name: `Sposta tutti a ${giornoBreve(dopodomani)}` }))
    await waitFor(() => expect(finto.chiamateA('athlete_workouts', 'in')).toHaveLength(1))
    expect(finto.chiamateA('workouts', 'update')[0].args[0]).toEqual({ date: dopodomani })
    expect(finto.chiamateA('athlete_workouts', 'update')[0].args[0]).toEqual({ completed_date: dopodomani })
    expect(finto.chiamateA('athlete_workouts', 'in')[0].args).toEqual(['id', ['aw0']])
  })

  it('«Sposta» su una riga non tocca workouts.date', async () => {
    ctrl.stato.assegnazioni = TRE
    apri()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Sposta la data di Marco' }))
    await user.click(screen.getByRole('button', { name: dataBreve(dopodomani) }))
    await user.click(screen.getByRole('button', { name: `Sposta a ${giornoBreve(dopodomani)}` }))
    await waitFor(() => expect(finto.chiamateA('athlete_workouts', 'update')).toHaveLength(1))
    expect(finto.chiamateA('athlete_workouts', 'update')[0].args[0]).toEqual({ completed_date: dopodomani })
    expect(finto.chiamateA('workouts', 'update')).toHaveLength(0)
  })
})
