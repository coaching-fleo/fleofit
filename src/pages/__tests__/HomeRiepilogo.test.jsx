import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom'
import { montaPagina, UTENTE } from '../../test/montaPagina'
import { AuthContext } from '../../App'

// La Home coach «Riepilogo» (10/11/2026) e l'interruttore «Home classica».
// Senza interruttore il coach vede i numeri che aprono liste; acceso, il
// cruscotto di prima. La Riepilogo riceve le liste INTERE: la classica taglia
// i fermi a 4, qui il contatore deve dire quanti sono davvero.

const OGGI = new Date()
const giorno = (scarto) => new Date(OGGI.getTime() + scarto * 86400000).toISOString().split('T')[0]

const ctrl = await vi.hoisted(async () => ({ atleti: { valore: [] }, assegnazioni: { valore: [] }, comeStai: { valore: [] } }))

const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  return fintoSupabase(() => ({
    athletes: ctrl.atleti.valore,
    athlete_workouts: ctrl.assegnazioni.valore,
    workouts: [{ id: 'w1' }, { id: 'w2' }],
    notifications: [],
    come_stai: ctrl.comeStai.valore,
    note_estratte: [],
  }))
})

vi.mock('../../supabaseClient', () => ({ supabase: finto.supabase }))
vi.mock('@capacitor/network', () => ({
  Network: {
    getStatus: vi.fn(() => Promise.resolve({ connected: true })),
    addListener: vi.fn(() => Promise.resolve({ remove: vi.fn() })),
  },
}))

const Home = (await import('../Home')).default

const atleta = (id, name) => ({ id, name, surname: 'Rossi', photo_url: null })
const riga = (id, athlete_id, scarto, extra = {}) => ({
  id, athlete_id, completed_date: giorno(scarto), status: 'pending',
  notes: null, voice_note_url: null,
  athletes: { id: athlete_id, name: nomeDi(athlete_id), surname: 'Rossi', photo_url: null },
  workouts: { id: `w-${id}`, title: `Scheda ${id}`, sections: { category: 'Hyrox' } },
  ...extra,
})
const fatta = (id, athlete_id, scarto, extra = {}) => riga(id, athlete_id, scarto, { status: 'completed', ...extra })
/** Il nome dell'atleta nella rubrica corrente, così il join non contraddice la lista. */
const nomeDi = (id) => ctrl.atleti.valore.find(a => a.id === id)?.name || 'Nome'

const montaCoach = () => montaPagina(<Home />, { role: 'coach' })
const attendi = (testo) => waitFor(() => expect(screen.getByText(testo)).toBeInTheDocument())

beforeEach(() => {
  window.localStorage.clear()
  ctrl.atleti.valore = [atleta('a1', 'Luca'), atleta('a2', 'Giulia'), atleta('a3', 'Marco')]
  ctrl.assegnazioni.valore = []
  ctrl.comeStai.valore = []
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})


describe('Home coach: Riepilogo o classica', () => {
  it('senza interruttore c\'è la Riepilogo', async () => {
    montaCoach()
    await attendi('In allenamento oggi')
    expect(screen.queryByText('Da smaltire')).not.toBeInTheDocument()
  })

  it('con «Home classica» acceso torna il cruscotto', async () => {
    window.localStorage.setItem('fleofit_home_classica', 'true')
    montaCoach()
    await attendi('Da smaltire')
    expect(screen.queryByText('In allenamento oggi')).not.toBeInTheDocument()
  })

  it('il contatore dei fermi conta tutti, non i 4 della classica', async () => {
    ctrl.atleti.valore = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'].map(id => atleta(id, `Nome ${id}`))
    ctrl.assegnazioni.valore = ctrl.atleti.valore.map(a => riga(`v-${a.id}`, a.id, -10))
    montaCoach()
    expect(await screen.findByRole('button', { name: 'Fermi da 5+ giorni: 6' })).toBeInTheDocument()
  })

  it('il tocco su «Leggi» apre la lista con la ricerca', async () => {
    const utente = userEvent.setup()
    ctrl.assegnazioni.valore = [fatta('f1', 'a1', -1, { notes: '[RPE: 9/10]\nGambe pesanti' })]
    montaCoach()
    await utente.click(await screen.findByRole('button', { name: /^Leggi/ }))
    expect(await screen.findByRole('searchbox', { name: 'Cerca per nome' })).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Feedback da leggere' })).toBeInTheDocument()
  })

  it('l\'atleta non vede nessuna delle due', async () => {
    montaPagina(<Home />, { role: 'athlete' })
    await new Promise(r => setTimeout(r, 50))
    expect(screen.queryByText('In allenamento oggi')).not.toBeInTheDocument()
    expect(screen.queryByText('Da smaltire')).not.toBeInTheDocument()
  })

  it('nella lista di oggi si cerca anche per cognome', async () => {
    const utente = userEvent.setup()
    ctrl.assegnazioni.valore = [riga('o1', 'a1', 0)]
    montaCoach()
    await utente.click(await screen.findByRole('button', { name: 'Tutti' }))
    await utente.type(await screen.findByRole('searchbox', { name: 'Cerca per nome' }), 'rossi')
    // Dentro il foglio: il calendario dei prossimi giorni ha anche lui il nome intero.
    expect(within(screen.getByRole('dialog')).getByText('Luca Rossi')).toBeInTheDocument()
  })

  /** Home e una scheda finta con «Torna» (navigate(-1)), nello stesso router. */
  const montaConScheda = () => {
    const Scheda = () => {
      const navigate = useNavigate()
      return <>
        <button type="button" onClick={() => navigate(-1)}>Torna</button>
        <button type="button" onClick={() => navigate('/')}>Home</button>
      </>
    }
    render(
      <MemoryRouter initialEntries={['/']}>
        <AuthContext.Provider value={{ user: UTENTE, role: 'coach' }}>
          <Routes><Route path="/" element={<Home />} /><Route path="/workout/:id" element={<Scheda />} /></Routes>
        </AuthContext.Provider>
      </MemoryRouter>
    )
  }

  it('tornando indietro da un feedback la lista dei feedback si riapre', async () => {
    const utente = userEvent.setup()
    ctrl.assegnazioni.valore = [
      fatta('f1', 'a1', -1, { notes: '[RPE: 9/10]\nGambe pesanti' }),
      fatta('f2', 'a2', -1, { notes: '[RPE: 6/10]\nTutto bene' }),
    ]
    montaConScheda()
    await utente.click(await screen.findByRole('button', { name: /^Leggi/ }))
    const foglio = await screen.findByRole('dialog', { name: 'Feedback da leggere' })
    await utente.click(within(foglio).getByText(/Luca/))
    await utente.click(await screen.findByRole('button', { name: 'Torna' }))
    const riaperto = await screen.findByRole('dialog', { name: 'Feedback da leggere' })
    // Quello aperto è letto: resta l'altro.
    expect(within(riaperto).getByText(/Giulia/)).toBeInTheDocument()
  })

  it('tornando indietro la lista di oggi si riapre col filtro scelto', async () => {
    const utente = userEvent.setup()
    ctrl.assegnazioni.valore = [riga('o1', 'a1', 0), fatta('o2', 'a2', 0)]
    montaConScheda()
    await utente.click(await screen.findByRole('button', { name: 'Tutti' }))
    const foglio = await screen.findByRole('dialog', { name: 'In allenamento oggi' })
    await utente.click(within(foglio).getByRole('button', { name: /^Da fare/ }))
    await utente.click(within(foglio).getByText('Luca Rossi'))
    await utente.click(await screen.findByRole('button', { name: 'Torna' }))
    const riaperto = await screen.findByRole('dialog', { name: 'In allenamento oggi' })
    expect(within(riaperto).getByRole('button', { name: /^Da fare/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('una Home aperta dalla barra (non un ritorno) parte con la lista chiusa', async () => {
    const utente = userEvent.setup()
    ctrl.assegnazioni.valore = [riga('o1', 'a1', 0)]
    montaConScheda()
    await utente.click(await screen.findByRole('button', { name: 'Tutti' }))
    await utente.click(within(await screen.findByRole('dialog')).getByText('Luca Rossi'))
    await utente.click(await screen.findByRole('button', { name: 'Home' }))
    await attendi('In allenamento oggi')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('tornando indietro anche la Home sotto il foglio resta dov\'era', async () => {
    const utente = userEvent.setup()
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    Object.defineProperty(window, 'scrollY', { value: 640, configurable: true })
    ctrl.assegnazioni.valore = [riga('o1', 'a1', 0)]
    montaConScheda()
    await utente.click(await screen.findByRole('button', { name: 'Tutti' }))
    await utente.click(within(await screen.findByRole('dialog')).getByText('Luca Rossi'))
    // Sulla scheda la finestra è in cima; il ritorno non deve ripartire da qui.
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true })
    await utente.click(await screen.findByRole('button', { name: 'Torna' }))
    const riaperto = await screen.findByRole('dialog', { name: 'In allenamento oggi' })
    await waitFor(() => expect(document.body.style.top).toBe('-640px'))
    // Chiuso il foglio, la pagina va lì.
    scrollTo.mockClear()
    await utente.click(within(riaperto).getByRole('button', { name: 'Chiudi' }))
    await waitFor(() => expect(scrollTo).toHaveBeenCalledWith(0, 640))
    delete window.scrollY
    scrollTo.mockRestore()
  })
})

