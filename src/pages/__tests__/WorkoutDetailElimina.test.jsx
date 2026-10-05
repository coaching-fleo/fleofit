import { it, expect, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

// Segnalato il 05/10/2026: duplicato un workout, salvata la copia e subito
// eliminata, la finestra «Sei sicuro?» restava aperta. La pagina precedente era
// il workout ORIGINALE, cioè la stessa rotta, e React riusava la scheda con il
// suo stato. Qui la rotta è montata SENZA la chiave che App.jsx le dà adesso:
// è proprio la condizione del difetto, e la finestra deve chiudersi lo stesso.

const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  return fintoSupabase(() => ({
    workouts: [{ id: 'w1', title: 'Hyrox Strength #1', date: '2026-08-28', coach_notes: '',
      sections: { category: 'Hyrox', blocks: [{ id: 'b1', type: 'AMRAP', params: { duration: '10:00' }, exercises: [] }] } }],
    athlete_workouts: [],
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

const monta = (voci, indice) => render(
  <MemoryRouter initialEntries={voci} initialIndex={indice}>
    <AuthContext.Provider value={{ user: { id: 'c1', email: 'a@b.it', user_metadata: {} }, role: 'admin' }}>
      <Routes>
        <Route path="/workout/:id" element={<WorkoutDetail />} />
        <Route path="/" element={<p>Home</p>} />
      </Routes>
    </AuthContext.Provider>
  </MemoryRouter>
)

async function elimina() {
  await userEvent.click(await screen.findByRole('button', { name: /Altre azioni/i }))
  await userEvent.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: /Elimina/ }))
  const conferma = screen.getByRole('dialog', { name: 'Sei sicuro?' })
  await userEvent.click(within(conferma).getByRole('button', { name: 'Elimina' }))
  await waitFor(() => expect(finto.chiamateA('workouts', 'delete')).toHaveLength(1))
}

it('eliminata la copia, tornando all originale la conferma NON resta aperta', async () => {
  monta(['/workout/w1', '/workout/copia'], 1)
  await elimina()
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Sei sicuro?' })).not.toBeInTheDocument())
})

it('se la scheda era la prima pagina della sessione, eliminare porta alla Home', async () => {
  finto.chiamate.length = 0
  monta(['/workout/w1'], 0)
  await elimina()
  expect(await screen.findByText('Home')).toBeInTheDocument()
})
