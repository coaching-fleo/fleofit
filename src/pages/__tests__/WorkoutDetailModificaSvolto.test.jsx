import { it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'

// Richiesto il 07/10/2026: un workout che un atleta ha già svolto non si
// modifica. «Modifica» apre un avviso che propone Annulla o Duplica; senza
// nessun atleta che l'ha finito, porta dritto al builder come prima.

const BLOCCHI = vi.hoisted(() => ({ category: 'Hyrox', blocks: [{ id: 'b1', type: 'AMRAP', params: { duration: '10:00' }, exercises: [] }] }))

// Il finto client non filtra: ogni test sceglie lo stato dell'unica assegnazione.
const scenario = vi.hoisted(() => ({ stato: 'completed' }))

const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  return fintoSupabase(() => ({
    workouts: [{ id: 'w1', title: 'Hyrox #1', date: '2026-10-01', coach_notes: '', sections: BLOCCHI }],
    athlete_workouts: [
      { id: 'aw1', athlete_id: 'a1', status: scenario.stato, completed_date: '2026-10-01', athletes: { id: 'a1', name: 'Marco', surname: 'Rossi' } },
    ],
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

function Builder() {
  const { search } = useLocation()
  return <p>Builder {search}</p>
}

const monta = (url) => render(
  <MemoryRouter initialEntries={[url]}>
    <AuthContext.Provider value={{ user: { id: 'c1', email: 'a@b.it', user_metadata: {} }, role: 'admin' }}>
      <Routes>
        <Route path="/workout/:id" element={<WorkoutDetail />} />
        <Route path="/create" element={<Builder />} />
      </Routes>
    </AuthContext.Provider>
  </MemoryRouter>
)

async function premiModifica() {
  await screen.findByText('Assegnato a')
  await userEvent.click(await screen.findByRole('button', { name: /Altre azioni/i }))
  await userEvent.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: /Modifica/ }))
}

it('svolto da un atleta: avviso generico senza nome, e Duplica apre la copia', async () => {
  monta('/workout/w1')
  await premiModifica()
  const avviso = screen.getByRole('dialog', { name: 'Non si può modificare' })
  expect(avviso).toHaveTextContent("Un atleta l'ha già svolto")
  expect(avviso).not.toHaveTextContent('Marco')
  await userEvent.click(within(avviso).getByRole('button', { name: 'Duplica' }))
  expect(await screen.findByText('Builder ?duplicate=w1')).toBeInTheDocument()
})

it('svolto da un atleta: Annulla chiude e resta sulla scheda', async () => {
  monta('/workout/w1')
  await premiModifica()
  await userEvent.click(within(screen.getByRole('dialog', { name: 'Non si può modificare' })).getByRole('button', { name: 'Annulla' }))
  expect(screen.queryByRole('dialog', { name: 'Non si può modificare' })).not.toBeInTheDocument()
  expect(screen.queryByText(/^Builder/)).not.toBeInTheDocument()
})

it('nessuno l ha svolto: Modifica porta dritto al builder', async () => {
  scenario.stato = 'pending'
  monta('/workout/w1')
  await premiModifica()
  expect(await screen.findByText('Builder ?edit=w1')).toBeInTheDocument()
})
