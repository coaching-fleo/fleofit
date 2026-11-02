import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Perché questi test esistono
// ────────────────────────────
// Segnalazione del 02/11/2026: confermato «Completiamo il profilo!», l'app
// tornava indietro sulla stessa schermata. Era una gara: `updateUser` fa
// partire USER_UPDATED, e `ProtectedRoute` rileggeva la riga atleta PRIMA che
// l'upsert del profilo fosse arrivato — la trovava vuota e rimetteva
// l'onboarding, dopo che la conferma l'aveva già tolto. Qui il finto client si
// comporta come supabase-js: avvisa gli ascoltatori dentro `updateUser`.

const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../test/fintoSupabase')
  const { vi: v } = await import('vitest')
  // La riga atleta esiste solo DOPO l'upsert del profilo, come nel database vero.
  const f = fintoSupabase(() => ({
    athletes: f.chiamateA('athletes', 'upsert').map((c) => c.args[0]).slice(-1),
    // Il riscatto del codice torna una riga: l'invito è valido.
    invitation_codes: [{ id: 'c1', code: 'ABCD1234' }],
    athlete_workouts: [],
    notifications: [],
  }))
  // Il riscatto del codice è lento come la rete vera (due giri in più della
  // conferma): senza, tutto risponde nello stesso istante e la gara non si vede.
  const lento = (catena) => new Proxy(catena, {
    get(t, prop) {
      if (prop === 'then') return (ok, ko) => new Promise((r) => setTimeout(r, 20)).then(() => t.then(ok, ko))
      return (...args) => lento(t[prop](...args))
    },
  })
  const fromVero = f.supabase.from
  f.supabase.from = (tabella) => tabella === 'invitation_codes' ? lento(fromVero(tabella)) : fromVero(tabella)
  const utente = {
    id: 'u9', email: 'nuovo@fleofit.it',
    user_metadata: { consenso: { versione: 1, il: '2026-11-02T10:00:00.000Z' } },
  }
  const ascoltatori = []
  f.supabase.auth.getSession = v.fn(() => Promise.resolve({ data: { session: { user: utente } } }))
  f.supabase.auth.onAuthStateChange = v.fn((cb) => {
    ascoltatori.push(cb)
    return { data: { subscription: { unsubscribe: v.fn() } } }
  })
  f.supabase.auth.updateUser = v.fn(async ({ data }) => {
    utente.user_metadata = { ...utente.user_metadata, ...data }
    ascoltatori.forEach((cb) => cb('USER_UPDATED', { user: { ...utente } }))
    return { data: { user: { ...utente } }, error: null }
  })
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

beforeEach(() => {
  window.history.pushState({}, '', '/')
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  localStorage.setItem('fleofit_invite_code', 'ABCD1234')
})

describe("L'onboarding dell'atleta nuovo", () => {
  it('chiede nome, cognome e data di nascita prima di salvare', async () => {
    const utente = userEvent.setup()
    render(<App />)
    const conferma = await screen.findByRole('button', { name: /inizia ad usare/i })

    await utente.click(conferma)
    expect(await screen.findByRole('alert')).toHaveTextContent(/nome/i)
    expect(finto.chiamateA('athletes', 'upsert')).toHaveLength(0)

    await utente.type(screen.getByLabelText('Nome'), '   ')
    await utente.type(screen.getByLabelText('Cognome'), 'Bianchi')
    await utente.click(conferma)
    expect(screen.getByRole('alert')).toHaveTextContent(/nome/i)

    await utente.clear(screen.getByLabelText('Nome'))
    await utente.type(screen.getByLabelText('Nome'), 'Luca')
    await utente.click(conferma)
    expect(screen.getByRole('alert')).toHaveTextContent(/data di nascita/i)
    expect(finto.chiamateA('athletes', 'upsert')).toHaveLength(0)
  })

  it('🔴 dopo la conferma entra nell\'app e NON torna al profilo', async () => {
    const utente = userEvent.setup()
    render(<App />)
    await screen.findByRole('button', { name: /inizia ad usare/i })

    await utente.type(screen.getByLabelText('Nome'), 'Luca')
    await utente.type(screen.getByLabelText('Cognome'), 'Bianchi')
    fireEvent.change(screen.getByLabelText('Data di nascita'), { target: { value: '1995-04-12' } })

    await utente.click(screen.getByRole('button', { name: /inizia ad usare/i }))

    await waitFor(() => expect(document.querySelector('nav')).toBeInTheDocument())
    // Si lascia finire ogni lettura in volo: se una rimette l'onboarding, si vede qui.
    await new Promise((r) => setTimeout(r, 150))
    expect(screen.queryByText('Completiamo il profilo!')).not.toBeInTheDocument()
    expect(document.querySelector('nav')).toBeInTheDocument()
  })
})
