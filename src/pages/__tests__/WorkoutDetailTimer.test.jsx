import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

// Perché questo test esiste
// ──────────────────────────
// Il 26/08/2026 il committente ha deciso che gli allenamenti di CORSA non hanno
// il timer guidato: le fasi si seguono con l'orologio o a sensazione, non con un
// conto alla rovescia sul telefono.
//
// I test in src/lib/__tests__/timerSequence.test.js coprono la regola
// (haTimerGuidato) e la costruzione della sequenza. Questo copre l'altra metà,
// che quei test non vedono: che il BOTTONE sparisca davvero dalla pagina, e che
// sparisca solo lui — TV, PDF, note e completamento devono restare.

const ctrl = await vi.hoisted(async () => ({ categoria: { valore: 'Running' } }))

const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  return fintoSupabase(() => ({
    workouts: [{
      id: 'w1', title: 'Scheda di prova', date: '2026-08-26', coach_notes: '',
      sections: ctrl.categoria.valore === 'Running'
        ? { category: 'Running', steps: [{ id: 1, type: 'repeat', rounds: '6', runDuration: '400m', recDuration: '90 sec' }] }
        : { category: 'Hyrox', blocks: [{ id: 1, type: 'AMRAP', params: { duration: '12:00' }, exercises: [{ name: 'Burpees' }] }] },
    }],
    athlete_workouts: [{ id: 'aw1', athlete_id: 'u1', workout_id: 'w1', completed_date: '2026-08-26', status: 'pending', notes: null }],
    athletes: [{ id: 'u1', name: 'Marco', surname: 'R' }],
  }))
})

vi.mock('../../supabaseClient', () => ({ supabase: finto.supabase }))
// jspdf e html-to-image servono solo all'export: non vanno caricate per davvero.
vi.mock('jspdf', () => ({ default: class {}, jsPDF: class {} }))
vi.mock('html-to-image', () => ({ toPng: vi.fn(), toBlob: vi.fn() }))
vi.mock('@capacitor/network', () => ({ Network: {
  getStatus: vi.fn(() => Promise.resolve({ connected: true })),
  addListener: vi.fn(() => Promise.resolve({ remove: vi.fn() })),
} }))

const { AuthContext } = await import('../../App')
const WorkoutDetail = (await import('../WorkoutDetail')).default

function apriScheda() {
  return render(
    <MemoryRouter initialEntries={['/workout/w1?athlete_id=u1']}>
      <AuthContext.Provider value={{ user: { id: 'u1', email: 'a@b.it', user_metadata: {} }, role: 'athlete' }}>
        <Routes><Route path="/workout/:id" element={<WorkoutDetail />} /></Routes>
      </AuthContext.Provider>
    </MemoryRouter>
  )
}

const attendi = () => waitFor(() =>
  expect(screen.getByRole('heading', { name: 'Scheda di prova' })).toBeInTheDocument())

beforeEach(() => { ctrl.categoria.valore = 'Running' })

describe('la scheda di un allenamento di corsa', () => {
  it('non mostra il bottone del timer', async () => {
    apriScheda()
    await attendi()
    expect(screen.queryByRole('button', { name: /Avvia Allenamento/i })).not.toBeInTheDocument()
  })

  it('ma conserva tutto il resto', async () => {
    // Il contraltare: senza, il test sopra passerebbe anche se la pagina non
    // rendesse più niente.
    apriScheda()
    await attendi()
    expect(screen.getByRole('button', { name: /Segna come completato/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^TV$/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Esporta PDF/i })).toBeInTheDocument()
  })
})

describe('la scheda di un allenamento Hyrox', () => {
  it('il timer c è ancora', async () => {
    // La prova che la guardia non ha spento il timer per tutti.
    ctrl.categoria.valore = 'Hyrox'
    apriScheda()
    await attendi()
    expect(await screen.findByRole('button', { name: /Avvia Allenamento/i })).toBeInTheDocument()
  })
})
