import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import Login from '../Login'
import {
  eUnLinkDiRecupero, recuperoInCorso, avviaRecupero, chiudiRecupero,
} from '../../lib/recuperoPassword'

// Perché questi test esistono
// ────────────────────────────
// Il 12/10/2026: «se faccio reimposta password mi fa entrare direttamente
// nell'app senza farmi reimpostare la password». Il link di recupero crea una
// sessione vera, e il login la scambiava per un accesso qualunque: vedeva una
// sessione e andava alla Home. Il primo test è quello che lo riprende.

const ctrl = { sessione: null, ascolta: null }

const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  const { vi: v } = await import('vitest')
  const f = fintoSupabase({ invitation_codes: [] })
  f.supabase.auth.getSession = v.fn(() => Promise.resolve({ data: { session: ctrl.sessione } }))
  f.supabase.auth.onAuthStateChange = v.fn((cb) => {
    ctrl.ascolta = cb
    return { data: { subscription: { unsubscribe: v.fn() } } }
  })
  return f
})

vi.mock('../../supabaseClient', () => ({ supabase: finto.supabase }))
vi.mock('@capacitor/browser', () => ({ Browser: { open: vi.fn(), close: vi.fn(() => Promise.resolve()) } }))
vi.mock('@capacitor-community/apple-sign-in', () => ({ SignInWithApple: { authorize: vi.fn() } }))

const SESSIONE = { user: { id: 'u1', email: 'atleta@fleofit.it' } }

function montaLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<div>HOME DELL'APP</div>} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  chiudiRecupero()
  ctrl.sessione = null
  ctrl.ascolta = null
  finto.supabase.auth.signOut.mockClear()
})

describe('il link «reimposta password»', () => {
  it('con una sessione di recupero chiede la password nuova, NON apre la Home', async () => {
    avviaRecupero()
    ctrl.sessione = SESSIONE
    montaLogin()

    expect(await screen.findByLabelText('Nuova password')).toBeTruthy()
    // getSession risolve dopo il montaggio: se il login scappasse verso la
    // Home lo farebbe lì. Si aspetta che sia passato.
    await waitFor(() => expect(finto.supabase.auth.getSession).toHaveBeenCalled())
    await act(() => Promise.resolve())
    expect(screen.queryByText("HOME DELL'APP")).toBeNull()
  })

  it('un SIGNED_IN arrivato a recupero in corso non porta alla Home', async () => {
    avviaRecupero()
    montaLogin()
    await screen.findByLabelText('Nuova password')

    act(() => ctrl.ascolta('SIGNED_IN', SESSIONE))
    expect(screen.queryByText("HOME DELL'APP")).toBeNull()
    expect(screen.getByLabelText('Nuova password')).toBeTruthy()
  })

  it('l\'evento PASSWORD_RECOVERY arrivato dopo il montaggio apre la password nuova', async () => {
    montaLogin()
    await waitFor(() => expect(ctrl.ascolta).toBeTypeOf('function'))

    act(() => ctrl.ascolta('PASSWORD_RECOVERY', SESSIONE))
    expect(await screen.findByLabelText('Nuova password')).toBeTruthy()
    expect(recuperoInCorso()).toBe(true)
    expect(screen.queryByText("HOME DELL'APP")).toBeNull()
  })

  it('chi torna indietro senza cambiarla viene fatto uscire', async () => {
    avviaRecupero()
    ctrl.sessione = SESSIONE
    montaLogin()
    await screen.findByLabelText('Nuova password')

    await userEvent.setup().click(screen.getByRole('button', { name: /indietro/i }))
    expect(finto.supabase.auth.signOut).toHaveBeenCalled()
    expect(recuperoInCorso()).toBe(false)
  })

  it('controllo: una sessione normale va alla Home come prima', async () => {
    ctrl.sessione = SESSIONE
    montaLogin()
    expect(await screen.findByText("HOME DELL'APP")).toBeTruthy()
  })
})

describe('eUnLinkDiRecupero', () => {
  it('riconosce solo type=recovery', () => {
    expect(eUnLinkDiRecupero('#access_token=a&refresh_token=b&type=recovery')).toBe(true)
    expect(eUnLinkDiRecupero('access_token=a&type=recovery')).toBe(true)
    expect(eUnLinkDiRecupero('#access_token=a&refresh_token=b&type=signup')).toBe(false)
    expect(eUnLinkDiRecupero('#access_token=a&type=magiclink')).toBe(false)
    expect(eUnLinkDiRecupero('')).toBe(false)
    expect(eUnLinkDiRecupero(undefined)).toBe(false)
  })
})
