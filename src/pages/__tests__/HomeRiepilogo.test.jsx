import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { montaPagina } from '../../test/montaPagina'

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
})
