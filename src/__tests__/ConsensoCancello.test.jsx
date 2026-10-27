import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Perché questi test esistono
// ────────────────────────────
// La schermata del consenso è un cancello: se `ProtectedRoute` la salta, un
// atleta entra e i suoi dati di salute vanno all'IA senza permesso (Apple
// 5.1.2(i), GDPR art. 9). Qui si monta l'app intera, come in
// NavigazioneApp.test.jsx, perché è il cancello a essere sotto prova, non la
// schermata.

const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../test/fintoSupabase')
  const { vi: v } = await import('vitest')
  const f = fintoSupabase({
    athletes: [{ id: 'u1', name: 'Marco', surname: 'Rossi' }],
    athlete_workouts: [],
    notifications: [],
  })
  // Un atleta con profilo, ruolo e codice già a posto, ma SENZA consenso:
  // è il caso di ogni atleta già iscritto alla prima apertura dopo l'aggiornamento.
  const sessione = {
    user: { id: 'u1', email: 'atleta@fleofit.it', user_metadata: { first_name: 'Marco', role: 'athlete' } },
  }
  f.supabase.auth.getSession = v.fn(() => Promise.resolve({ data: { session: sessione } }))
  f.supabase.auth.onAuthStateChange = v.fn(() => ({ data: { subscription: { unsubscribe: v.fn() } } }))
  return f
})

vi.mock('../supabaseClient', () => ({ supabase: finto.supabase }))
vi.mock('@capacitor/network', () => ({
  Network: {
    getStatus: vi.fn(() => Promise.resolve({ connected: true })),
    addListener: vi.fn(() => Promise.resolve({ remove: vi.fn() })),
  },
}))

const App = (await import('../App')).default
const { VERSIONE_CONSENSO } = await import('../lib/consenso')

beforeEach(() => {
  window.history.pushState({}, '', '/')
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})

const bottoneAccetta = () => screen.findByRole('button', { name: 'Accetto ed entra' })

describe('Il cancello del consenso', () => {
  it('🔴 un atleta senza consenso vede la schermata e NON la Home', async () => {
    render(<App />)
    expect(await bottoneAccetta()).toBeInTheDocument()
    expect(document.querySelector('nav')).not.toBeInTheDocument()
    expect(screen.queryByText(/ti segue da oggi/i)).not.toBeInTheDocument()
  })

  it('il bottone si accende solo con TUTTE e due le caselle', async () => {
    const utente = userEvent.setup()
    render(<App />)
    const accetta = await bottoneAccetta()
    const [letto, acconsento] = screen.getAllByRole('checkbox')

    expect(letto).not.toBeChecked()
    expect(acconsento).not.toBeChecked()
    expect(accetta).toBeDisabled()

    await utente.click(letto)
    expect(accetta).toBeDisabled()

    await utente.click(acconsento)
    expect(accetta).toBeEnabled()
  })

  it('accettando salva versione e data nei metadati ed entra', async () => {
    const utente = userEvent.setup()
    render(<App />)
    await bottoneAccetta()
    for (const c of screen.getAllByRole('checkbox')) await utente.click(c)
    await utente.click(screen.getByRole('button', { name: 'Accetto ed entra' }))

    expect(finto.supabase.auth.updateUser).toHaveBeenCalledWith({
      data: { consenso: { versione: VERSIONE_CONSENSO, il: expect.any(String) } },
    })
    await waitFor(() => expect(document.querySelector('nav')).toBeInTheDocument())
  })

  it('«Non accetto» esce dall\'account', async () => {
    const utente = userEvent.setup()
    render(<App />)
    await bottoneAccetta()
    await utente.click(screen.getByRole('button', { name: 'Non accetto' }))
    expect(finto.supabase.auth.signOut).toHaveBeenCalled()
  })
})
