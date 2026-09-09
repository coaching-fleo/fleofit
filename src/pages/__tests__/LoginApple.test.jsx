import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { webcrypto } from 'node:crypto'
import { montaPagina } from '../../test/montaPagina'
import Login from '../Login'

// Perché questi test esistono
// ────────────────────────────
// Sign in with Apple è arrivato il 03/09/2026 per la linea guida 4.8 di App
// Store, e non sostituisce Google: gli sta accanto. Nessuno di questi test si
// può sostituire con una prova a mano, perché il percorso vero passa dal foglio
// di sistema di Apple e da un iPhone.
//
// Il primo è quello che conta più di tutti. Il plugin scrive nel token la
// stringa che gli passiamo; Supabase confronta l'HASH di quella che passiamo a
// lui. Chi "semplifica" usando lo stesso valore ai due lati non rompe nessun
// altro test, non vede nessun errore in locale, e scopre in produzione un 400
// che sembra un problema di configurazione su Apple Developer.

const ctrl = { risposta: null, errore: null, opzioni: null }

const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  const { vi: v } = await import('vitest')
  const f = fintoSupabase({ invitation_codes: [] })
  f.supabase.auth.getSession = v.fn(() => Promise.resolve({ data: { session: null } }))
  f.supabase.auth.onAuthStateChange = v.fn(() => ({ data: { subscription: { unsubscribe: v.fn() } } }))
  f.supabase.auth.signInWithIdToken = v.fn(() => Promise.resolve({ data: {}, error: null }))
  return f
})

vi.mock('../../supabaseClient', () => ({ supabase: finto.supabase }))
vi.mock('@capacitor/browser', () => ({ Browser: { open: vi.fn(), close: vi.fn(() => Promise.resolve()) } }))
vi.mock('@capacitor-community/apple-sign-in', () => ({
  SignInWithApple: {
    authorize: (opzioni) => {
      ctrl.opzioni = opzioni
      return ctrl.errore
        ? Promise.reject(new Error(ctrl.errore))
        : Promise.resolve({ response: ctrl.risposta })
    },
  },
}))

const RISPOSTA_BASE = {
  user: 'apple-001',
  email: 'ab12cd@privaterelay.appleid.com',
  givenName: null,
  familyName: null,
  identityToken: 'token.di.apple',
  authorizationCode: 'codice',
}

async function sha256(testo) {
  const digest = await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(testo))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Tocca «Continua con Apple».
 *
 * ⚠️ Dal 04/09/2026 non c'è più nessun passaggio prima: i tre modi di entrare
 * stanno sul benvenuto, e il bivio «Accedi / Nuovo Utente» che questi test
 * attraversavano non esiste (CLAUDE.md §9-quinvicies-bis).
 */
async function accediConApple() {
  const utente = userEvent.setup()
  montaPagina(<Login />)
  await utente.click(await screen.findByRole('button', { name: /Continua con Apple/i }))
}

beforeEach(() => {
  ctrl.risposta = { ...RISPOSTA_BASE }
  ctrl.errore = null
  ctrl.opzioni = null
  // Il bottone Apple esiste solo sul nativo, e `Login.jsx` lo decide da
  // window.Capacitor — non dal modulo @capacitor/core, che il setup finge web.
  window.Capacitor = { isNativePlatform: () => true }
})
afterEach(() => { delete window.Capacitor })

describe('Sign in with Apple', () => {
  it('🔴 al plugin va l’HASH del nonce, a Supabase il valore in chiaro', async () => {
    await accediConApple()

    await waitFor(() => expect(finto.supabase.auth.signInWithIdToken).toHaveBeenCalled())
    const inviatoASupabase = finto.supabase.auth.signInWithIdToken.mock.calls[0][0].nonce
    const inviatoAlPlugin = ctrl.opzioni.nonce

    expect(inviatoASupabase).toBeTruthy()
    expect(inviatoAlPlugin).not.toBe(inviatoASupabase)
    expect(inviatoAlPlugin).toBe(await sha256(inviatoASupabase))
  })

  it('il token di Apple arriva a Supabase come identità apple', async () => {
    await accediConApple()

    await waitFor(() => expect(finto.supabase.auth.signInWithIdToken).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'apple', token: 'token.di.apple' })
    ))
    expect(ctrl.opzioni.clientId).toBe('it.federicoleo.fleofit')
    expect(ctrl.opzioni.scopes).toContain('name')
  })

  // Apple manda il nome SOLO alla primissima autorizzazione. Se non si salva
  // adesso è perso per sempre: l'onboarding parte vuoto e la Home saluta un
  // pezzo di indirizzo relay, che è una stringa di caratteri casuali.
  it('il nome della prima autorizzazione viene salvato subito', async () => {
    ctrl.risposta = { ...RISPOSTA_BASE, givenName: 'Marco', familyName: 'Rossi' }
    await accediConApple()

    await waitFor(() => expect(finto.supabase.auth.updateUser).toHaveBeenCalledWith(
      { data: { first_name: 'Marco', last_name: 'Rossi', full_name: 'Marco Rossi' } }
    ))
  })

  it('agli accessi successivi non sovrascrive il nome con dei campi vuoti', async () => {
    await accediConApple()

    await waitFor(() => expect(finto.supabase.auth.signInWithIdToken).toHaveBeenCalled())
    expect(finto.supabase.auth.updateUser).not.toHaveBeenCalled()
  })

  // Chiudere il foglio è una decisione, non un guasto: rispondere con un alert
  // rosso contraddice chi ha appena scelto di non entrare.
  it('chiudere il foglio di Apple non mostra nessun errore', async () => {
    ctrl.errore = 'The operation couldn’t be completed. (com.apple.AuthenticationServices.AuthorizationError error 1001.)'
    await accediConApple()

    await waitFor(() => expect(ctrl.opzioni).not.toBeNull())
    expect(screen.queryByText(/Errore Sign in with Apple/i)).not.toBeInTheDocument()
  })

  it('un guasto vero invece si dice', async () => {
    ctrl.errore = 'AuthorizationError error 1004.'
    await accediConApple()

    expect(await screen.findByText(/Errore Sign in with Apple/i)).toBeInTheDocument()
  })

  // La 4.8 chiede che l'alternativa non sia «meno in vista» delle altre, ed è
  // la prima cosa che il revisore guarda dopo un rilievo su quella linea guida.
  it('il bottone Apple sta SOPRA quello Google', async () => {
    montaPagina(<Login />)

    const social = (await screen.findAllByRole('button')).filter((b) =>
      /Apple|Google/i.test(b.textContent))
    expect(social.map((b) => b.textContent.trim())).toEqual(['Continua con Apple', 'Continua con Google'])
  })

  // Il flusso web richiederebbe un Services ID e una chiave su Apple Developer
  // che il progetto non ha: un bottone che non può funzionare è peggio che non
  // averlo (CLAUDE.md §9-quaterdecies).
  it('sul web il bottone Apple non esiste', async () => {
    delete window.Capacitor
    montaPagina(<Login />)

    expect(await screen.findByRole('button', { name: /Continua con Google/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Continua con Apple/i })).not.toBeInTheDocument()
  })
})
