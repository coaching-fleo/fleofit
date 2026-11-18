import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route, useLocation } from 'react-router-dom'
import { montaPagina, UTENTE, oggi } from '../../test/montaPagina'

// Il coach si allena anche lui (18/11/2026): la card «Il tuo allenamento»
// in testa alla sua Home. La scelta della riga è in mioAllenamento.test.js;
// qui si verifica che Home.jsx la mostri al coach, la tenga nascosta
// quando non c'è niente e porti alla scheda giusta.

const ctrl = await vi.hoisted(async () => ({ assegnazioni: { valore: [] } }))

const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  return fintoSupabase(() => ({
    athletes: [{ id: 'u1', name: 'Marco', surname: 'Coach', photo_url: null }],
    athlete_workouts: ctrl.assegnazioni.valore,
    workouts: [],
    notifications: [],
    come_stai: [],
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

function Dove() {
  const l = useLocation()
  return <p>dove:{l.pathname}{l.search}</p>
}

const mia = (extra = {}) => ({
  id: 'aw1', athlete_id: UTENTE.id, completed_date: oggi(), status: 'pending', notes: null,
  athletes: { id: UTENTE.id, name: 'Marco', surname: 'Coach', photo_url: null },
  workouts: { id: 'w9', title: 'Lungo lento · CL 12K @5', sections: { category: 'Running' } },
  ...extra,
})

const monta = () => montaPagina(
  <Routes><Route path="/" element={<Home />} /><Route path="/workout/:id" element={<Dove />} /></Routes>,
  { role: 'coach' })

beforeEach(() => {
  window.localStorage.clear()
  ctrl.assegnazioni.valore = []
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('Il tuo allenamento, nella Home del coach', () => {
  it('con un allenamento di oggi la card c’è, con il nome senza codice', async () => {
    ctrl.assegnazioni.valore = [mia()]
    monta()
    expect(await screen.findByText('Il tuo allenamento')).toBeInTheDocument()
    expect(screen.getByText('Lungo lento')).toBeInTheDocument()
  })

  it('il tocco apre la scheda sul proprio profilo', async () => {
    ctrl.assegnazioni.valore = [mia()]
    monta()
    await userEvent.click(await screen.findByRole('button', { name: /Il tuo allenamento/ }))
    expect(await screen.findByText(`dove:/workout/w9?athlete_id=${UTENTE.id}`)).toBeInTheDocument()
  })

  it('le righe di un altro atleta non fanno nascere la card', async () => {
    ctrl.assegnazioni.valore = [mia({ athlete_id: 'altro' })]
    monta()
    await waitFor(() => expect(finto.chiamateA('athlete_workouts').length).toBeGreaterThan(0))
    await new Promise(r => setTimeout(r, 50))
    expect(screen.queryByText('Il tuo allenamento')).toBeNull()
  })

  it('la lettura chiede le righe del coach stesso', async () => {
    monta()
    await waitFor(() => expect(
      finto.chiamateA('athlete_workouts', 'eq').some(c => c.args[0] === 'athlete_id' && c.args[1] === UTENTE.id)
    ).toBe(true))
  })
})
