import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { AuthRetryableFetchError } from '@supabase/supabase-js'

// Perché questi test esistono
// ────────────────────────────
// Segnalazione del 04/11/2026: senza Internet l'app restava sulla schermata
// iniziale. `getSession()` con il token scaduto riprova il rinnovo in rete per
// ~25 secondi (due volte); e con il token buono la riga atleta, non letta,
// sembrava mancare e il cancello disconnetteva l'atleta. src/lib/avvioSenzaRete.js.

const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../test/fintoSupabase')
  // Senza rete falliscono tutte le letture.
  const f = fintoSupabase({}, { erroreSu: () => ['athletes', 'staff', 'athlete_workouts', 'notifications', 'workouts', 'messaggi_coach', 'come_stai', 'invitation_codes'] })
  f.supabase.auth.storageKey = 'sb-prova-auth-token'
  f.supabase.auth.onAuthStateChange = () => ({ data: { subscription: { unsubscribe() {} } } })
  return f
})

vi.mock('../supabaseClient', () => ({ supabase: finto.supabase }))
vi.mock('@capacitor/network', () => ({
  Network: {
    getStatus: vi.fn(() => Promise.resolve({ connected: false })),
    addListener: vi.fn(() => Promise.resolve({ remove: vi.fn() })),
  },
}))

const App = (await import('../App')).default

const utente = {
  id: 'u7', email: 'atleta@fleofit.it',
  user_metadata: { role: 'athlete', first_name: 'Sara', consenso: { versione: 1, il: '2026-11-01T10:00:00.000Z' } },
}
const salvata = { access_token: 'a', refresh_token: 'r', expires_at: 1, user: utente }

let onLine
beforeEach(() => {
  window.history.pushState({}, '', '/')
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  localStorage.setItem('sb-prova-auth-token', JSON.stringify(salvata))
  localStorage.setItem('fleofit_name_u7', 'Sara')
  onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
  finto.supabase.auth.signOut.mockClear()
})
afterEach(() => {
  onLine.mockRestore()
  localStorage.clear()
})

const entrata = () => waitFor(() => expect(document.querySelector('nav')).toBeInTheDocument(), { timeout: 3000 })

describe("L'avvio senza rete", () => {
  it('🔴 entra con la sessione salvata, senza aspettare il rinnovo del token', async () => {
    // Il rinnovo che riprova all'infinito: non risponde mai.
    finto.supabase.auth.getSession = vi.fn(() => new Promise(() => {}))
    render(<App />)
    await entrata()
    expect(finto.supabase.auth.signOut).not.toHaveBeenCalled()
  })

  it('entra anche se il rinnovo finisce in un errore di rete', async () => {
    onLine.mockReturnValue(true)
    finto.supabase.auth.getSession = vi.fn(() => Promise.resolve({
      data: { session: null }, error: new AuthRetryableFetchError('Failed to fetch', 0),
    }))
    render(<App />)
    await entrata()
  })

  it('🔴 con il token buono, la riga atleta non letta NON disconnette', async () => {
    onLine.mockReturnValue(true)
    finto.supabase.auth.getSession = vi.fn(() => Promise.resolve({ data: { session: salvata }, error: null }))
    render(<App />)
    await entrata()
    expect(finto.supabase.auth.signOut).not.toHaveBeenCalled()
  })

  it('senza sessione salvata si va al login come prima', async () => {
    localStorage.removeItem('sb-prova-auth-token')
    finto.supabase.auth.getSession = vi.fn(() => Promise.resolve({ data: { session: null }, error: null }))
    render(<App />)
    await waitFor(() => expect(window.location.pathname).toBe('/login'))
  })
})
