import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

// Perché questi test esistono (25/11/2026, rivisti il 26/11/2026)
// ────────────────────────────────────────
// «Assegnato a» con trenta atleti era una colonna lunga quanto la scheda.
// Oltre sei atleti la scheda ne mostra cinque e sotto c'è «Vedi tutti gli N
// atleti», che apre il foglio con l'elenco intero e la ricerca. Da prendere:
//  1. fino a sei si vedono tutti, senza tasto né ricerca;
//  2. oltre sei se ne vedono cinque, e il tasto c'è;
//  3. il tasto apre il foglio con tutti, e la ricerca lì filtra (anche a
//     parole invertite) o dice che non c'è nessuno;
//  4. l'atleta aperto in quel momento resta visibile anche se è oltre i cinque.

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

function apri(indirizzo = '/workout/w1') {
  return render(
    <MemoryRouter initialEntries={[indirizzo]}>
      <AuthContext.Provider value={{ user: { id: 'coach', email: 'c@f.it', user_metadata: {} }, role: 'admin' }}>
        <Routes>
          <Route path="/workout/:id" element={<WorkoutDetail />} />
          <Route path="/athletes/:id" element={<p>Scheda atleta aperta</p>} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>
  )
}

const campo = () => screen.queryByRole('searchbox', { name: 'Cerca fra gli assegnati' })
const tasto = () => screen.queryByRole('button', { name: /Vedi tutti/ })

beforeEach(() => { ctrl.stato = {} })

describe('«Assegnato a» nella scheda workout', () => {
  it('fino a sei atleti li mostra tutti, senza tasto né ricerca', async () => {
    ctrl.stato.assegnazioni = assegnazioni(6)
    apri()
    await waitFor(() => expect(screen.getByText('6 atleti')).toBeInTheDocument())
    expect(screen.getByText('Anna Gallo')).toBeInTheDocument()
    expect(tasto()).toBeNull()
    expect(campo()).toBeNull()
  })

  it('oltre sei ne mostra cinque e il tasto «Vedi tutti»', async () => {
    ctrl.stato.assegnazioni = assegnazioni(8)
    apri()
    await waitFor(() => expect(tasto()).toBeInTheDocument())
    expect(tasto()).toHaveTextContent('Vedi tutti gli atleti (8)')
    expect(screen.getByText('Paolo Neri')).toBeInTheDocument()
    expect(screen.queryByText('Anna Gallo')).toBeNull()
    expect(screen.queryByText('Giulia Ricci')).toBeNull()
    expect(campo()).toBeNull()
  })

  it('il tasto apre il foglio con tutti, e la ricerca filtra', async () => {
    ctrl.stato.assegnazioni = assegnazioni(8)
    apri()
    await waitFor(() => expect(tasto()).toBeInTheDocument())
    await userEvent.click(tasto())
    const foglio = screen.getByRole('dialog', { name: 'Tutti gli assegnati' })
    expect(within(foglio).getByText('Giulia Ricci')).toBeInTheDocument()

    await userEvent.type(campo(), 'rossi marco')
    expect(within(foglio).getByText('Marco Rossi')).toBeInTheDocument()
    expect(within(foglio).queryByText('Giulia Ricci')).toBeNull()
  })

  it('una ricerca senza risultati lo dice', async () => {
    ctrl.stato.assegnazioni = assegnazioni(8)
    apri()
    await waitFor(() => expect(tasto()).toBeInTheDocument())
    await userEvent.click(tasto())
    await userEvent.type(campo(), 'zzz')
    expect(screen.getByText('Nessun atleta con questo nome.')).toBeInTheDocument()
  })

  it('l\'atleta aperto resta visibile anche oltre i primi cinque', async () => {
    ctrl.stato.assegnazioni = assegnazioni(8)
    apri('/workout/w1?athlete_id=a7')
    await waitFor(() => expect(tasto()).toBeInTheDocument())
    expect(screen.getAllByText('Giulia Ricci').length).toBeGreaterThan(0)
    expect(screen.queryByText('Paolo Neri')).toBeNull()
  })
})

// Toccare un atleta (26/11/2026, richiesta del committente): si apre il suo
// foglio con la nota, il vocale e il passaggio alla scheda atleta. Prima il
// tocco cambiava subito la scheda: ora è «Vedi il suo allenamento».
describe('il foglio dell\'atleta toccato in «Assegnato a»', () => {
  const fatto = () => {
    const [primo, ...resto] = assegnazioni(3)
    return [{ ...primo, status: 'completed', completed_date: '2026-09-01',
      notes: '[RPE: 8/10]\n[GRADIMENTO: si]\nGambe pesanti', voice_note_url: 'https://x/v.m4a' }, ...resto]
  }
  const tocca = async (nome) => {
    await waitFor(() => expect(screen.getByText(nome)).toBeInTheDocument())
    await userEvent.click(screen.getByText(nome))
    return screen.getByRole('dialog', { name: nome })
  }

  it('mostra la nota senza marcatori, l\'RPE, il gradimento e il vocale', async () => {
    ctrl.stato.assegnazioni = fatto()
    apri()
    const foglio = await tocca('Marco Rossi')
    expect(within(foglio).getByText('Gambe pesanti')).toBeInTheDocument()
    expect(within(foglio).getByText('8')).toBeInTheDocument()
    expect(within(foglio).getByText('Gli è piaciuto')).toBeInTheDocument()
    expect(within(foglio).getByRole('button', { name: 'Riproduci la nota vocale' })).toBeInTheDocument()
    // Qui si ascolta e basta: il cestino del vocale non c'è.
    expect(within(foglio).queryByRole('button', { name: 'Elimina la nota vocale' })).toBeNull()
    expect(foglio.textContent).not.toContain('GRADIMENTO')
  })

  it('a chi non l\'ha fatto dice che non l\'ha ancora completato, senza vocale', async () => {
    ctrl.stato.assegnazioni = fatto()
    apri()
    const foglio = await tocca('Luca Bianchi')
    expect(within(foglio).getByText('Non l\'ha ancora completato.')).toBeInTheDocument()
    expect(within(foglio).queryByRole('button', { name: 'Riproduci la nota vocale' })).toBeNull()
  })

  it('«Apri la scheda atleta» porta alla scheda atleta', async () => {
    ctrl.stato.assegnazioni = fatto()
    apri()
    const foglio = await tocca('Marco Rossi')
    await userEvent.click(within(foglio).getByRole('button', { name: /Apri la scheda atleta/ }))
    expect(await screen.findByText('Scheda atleta aperta')).toBeInTheDocument()
  })

  it('«Vedi il suo allenamento» chiude il foglio e apre la scheda su di lui', async () => {
    ctrl.stato.assegnazioni = fatto()
    apri()
    const foglio = await tocca('Luca Bianchi')
    await userEvent.click(within(foglio).getByRole('button', { name: /Vedi il suo allenamento/ }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Luca Bianchi' })).toBeNull())
  })

  it('aperto dal foglio «Vedi tutti», ci si apre sopra', async () => {
    ctrl.stato.assegnazioni = assegnazioni(8)
    apri()
    await waitFor(() => expect(tasto()).toBeInTheDocument())
    await userEvent.click(tasto())
    const tutti = screen.getByRole('dialog', { name: 'Tutti gli assegnati' })
    await userEvent.click(within(tutti).getByText('Giulia Ricci'))
    expect(screen.getByRole('dialog', { name: 'Giulia Ricci' })).toBeInTheDocument()
  })
})
