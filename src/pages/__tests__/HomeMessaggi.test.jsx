import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { render } from '@testing-library/react'
import { AuthContext } from '../../App'
import { CHIAVE_VISTO } from '../../lib/messaggiCoach'

// «Dal coach» in Home: la card compare solo per un messaggio arrivato dopo
// l'ultima volta che l'atleta ha guardato, visibile per la sua data d'iscrizione,
// e un errore di lettura lascia la Home com'era.
const ctrl = vi.hoisted(() => ({ messaggi: [], errore: false, vuota: false }))

const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  const oggi = new Date().toISOString().split('T')[0]
  return fintoSupabase(() => ({
    athlete_workouts: ctrl.vuota ? [] : [{
      id: 'aw1', completed_date: oggi, status: 'pending', notes: null,
      workouts: { id: 'w1', title: 'Hyrox Forza', sections: { category: 'Hyrox', blocks: [] } },
    }],
    notifications: [],
    messaggi_coach: ctrl.messaggi,
  }), { erroreSu: () => (ctrl.errore ? ['messaggi_coach'] : []) })
})

vi.mock('../../supabaseClient', () => ({ supabase: finto.supabase }))
vi.mock('@capacitor/network', () => ({
  Network: {
    getStatus: vi.fn(() => Promise.resolve({ connected: true })),
    addListener: vi.fn(() => Promise.resolve({ remove: vi.fn() })),
  },
}))

const Home = (await import('../Home')).default

const Dove = () => <div data-testid="dove">{useLocation().pathname + useLocation().search}</div>

const monta = ({ role = 'athlete', iscritto = '2026-01-01T00:00:00Z' } = {}) => {
  const user = { id: 'u1', email: 'a@fleofit.it', created_at: iscritto, user_metadata: { first_name: 'Marco' } }
  return render(
    <MemoryRouter initialEntries={['/']}>
      <AuthContext.Provider value={{ user, role }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="*" element={<Dove />} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>
  )
}

const msg = (id, creato_at, testo = 'Domani niente sessione') => ({ id, testo, fissato: false, autore: 'c', creato_at, modificato_at: null })

beforeEach(() => {
  window.localStorage.clear()
  ctrl.messaggi = []
  ctrl.errore = false
  ctrl.vuota = false
})

describe('Dal coach in Home atleta', () => {
  it('mostra il messaggio non visto e il tocco porta a /messaggi', async () => {
    ctrl.messaggi = [msg('m1', '2026-10-10T10:00:00Z')]
    monta()
    await userEvent.click(await screen.findByText('Domani niente sessione'))
    expect(await screen.findByTestId('dove')).toHaveTextContent('/messaggi')
  })

  it('niente card se il più recente è già stato visto', async () => {
    ctrl.messaggi = [msg('m1', '2026-10-10T10:00:00Z')]
    window.localStorage.setItem(CHIAVE_VISTO, JSON.stringify('2026-10-10T10:00:00Z'))
    monta()
    await screen.findByText('Hyrox Forza')
    await waitFor(() => expect(finto.chiamate.some(c => c.tabella === 'messaggi_coach')).toBe(true))
    expect(screen.queryByText('Dal coach')).not.toBeInTheDocument()
  })

  it('al giorno 1, senza workout, la card c\'è comunque', async () => {
    ctrl.vuota = true
    ctrl.messaggi = [msg('m1', '2026-10-10T10:00:00Z')]
    monta()
    await userEvent.click(await screen.findByText('Domani niente sessione'))
    expect(await screen.findByTestId('dove')).toHaveTextContent('/messaggi')
  })

  it('senza messaggi non c\'è card', async () => {
    monta()
    await screen.findByText('Hyrox Forza')
    expect(screen.queryByText('Dal coach')).not.toBeInTheDocument()
  })

  it('un avviso precedente all\'iscrizione non compare', async () => {
    ctrl.messaggi = [msg('m1', '2025-12-01T10:00:00Z')]
    monta({ iscritto: '2026-01-01T00:00:00Z' })
    await screen.findByText('Hyrox Forza')
    await waitFor(() => expect(finto.chiamate.some(c => c.tabella === 'messaggi_coach')).toBe(true))
    expect(screen.queryByText('Dal coach')).not.toBeInTheDocument()
  })

  it('un errore di lettura lascia la Home com\'è', async () => {
    ctrl.messaggi = [msg('m1', '2026-10-10T10:00:00Z')]
    ctrl.errore = true
    monta()
    expect(await screen.findByText('Hyrox Forza')).toBeInTheDocument()
    expect(screen.queryByText('Dal coach')).not.toBeInTheDocument()
  })
})

describe('La bacheca dalla Home coach', () => {
  it('il megafono in testata porta alla bacheca', async () => {
    monta({ role: 'coach' })
    await userEvent.click(await screen.findByLabelText('Apri la bacheca dei messaggi'))
    expect(await screen.findByTestId('dove')).toHaveTextContent('/messaggi')
    expect(screen.getByTestId('dove')).not.toHaveTextContent('scrivi')
  })

  it('l\'atleta non ha il megafono in testata', async () => {
    monta()
    expect(await screen.findByText('Hyrox Forza')).toBeInTheDocument()
    expect(screen.queryByLabelText('Apri la bacheca dei messaggi')).not.toBeInTheDocument()
  })
})
