import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

// «Come stai oggi» nella scheda workout (13/10/2026).
// I casi: all'atleta la domanda arriva PRIMA del timer e non lo blocca mai
// (saltare fa partire il timer lo stesso), una volta al giorno; al coach si
// mostra la risposta del giorno della seduta.

const ctrl = await vi.hoisted(async () => ({ comeStai: [] }))

const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  return fintoSupabase(() => ({
    workouts: [{
      id: 'w1', title: 'Scheda di prova', date: '2026-08-26', coach_notes: '',
      sections: { category: 'Hyrox', blocks: [{ id: 1, type: 'AMRAP', params: { duration: '12:00' }, exercises: [{ name: 'Burpees' }] }] },
    }],
    athlete_workouts: [{ id: 'aw1', athlete_id: 'u1', workout_id: 'w1', completed_date: '2026-08-26', status: 'pending', notes: null,
      athletes: { id: 'u1', name: 'Marco', surname: 'R', photo_url: null } }],
    athletes: [{ id: 'u1', name: 'Marco', surname: 'R' }],
    come_stai: ctrl.comeStai,
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

function apri({ ruolo = 'athlete', utente = 'u1' } = {}) {
  return render(
    <MemoryRouter initialEntries={['/workout/w1?athlete_id=u1']}>
      <AuthContext.Provider value={{ user: { id: utente, email: 'a@b.it', user_metadata: {} }, role: ruolo }}>
        <Routes><Route path="/workout/:id" element={<WorkoutDetail />} /></Routes>
      </AuthContext.Provider>
    </MemoryRouter>
  )
}

beforeEach(() => {
  ctrl.comeStai = []
  finto.chiamate.length = 0
  window.localStorage.clear()
})

describe('Come stai oggi — atleta', () => {
  it('la domanda arriva prima del timer, e «Salta» lo fa partire lo stesso', async () => {
    apri()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /Avvia allenamento/i }))
    expect(await screen.findByRole('dialog', { name: 'Come stai oggi?' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Salta' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Come stai oggi?' })).toBeNull())
    expect(await screen.findByRole('button', { name: /Minimizza timer/i })).toBeInTheDocument()
    // Saltato oggi: non si richiede, né col bottone né con l'invito.
    expect(screen.queryByText('Come stai oggi?')).toBeNull()
  })

  it('rispondere salva il giorno con le risposte date, e poi parte il timer', async () => {
    apri()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /Rispondi/ }))
    await user.click(screen.getByRole('radio', { name: 'Energia: 5 su 5' }))
    await user.click(screen.getByRole('button', { name: 'Fatto' }))
    await waitFor(() => expect(finto.chiamateA('come_stai', 'upsert')).toHaveLength(1))
    const [riga, opzioni] = finto.chiamateA('come_stai', 'upsert')[0].args
    expect(riga).toMatchObject({ athlete_id: 'u1', energia: 5, sonno: null })
    expect(opzioni).toEqual({ onConflict: 'athlete_id,giorno' })
    // Dall'invito, non dal timer: dopo la risposta non parte niente.
    expect(screen.queryByRole('button', { name: /Minimizza timer/i })).toBeNull()
  })

  it('se oggi ha già risposto non si chiede', async () => {
    ctrl.comeStai = [{ id: 'c1', athlete_id: 'u1', giorno: '2026-08-26', sonno: 4, energia: 4, dolori: 4, stress: 4 }]
    apri()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /Avvia allenamento/i }))
    expect(await screen.findByRole('button', { name: /Minimizza timer/i })).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Come stai oggi?' })).toBeNull()
  })
})

describe('Come stai oggi — coach', () => {
  it('vede come stava l\'atleta il giorno della seduta', async () => {
    ctrl.comeStai = [{ id: 'c1', athlete_id: 'u1', giorno: '2026-08-26', sonno: 2, energia: 3, dolori: null, stress: 4 }]
    apri({ ruolo: 'admin', utente: 'coach' })
    expect(await screen.findByText(/Come stava/)).toBeInTheDocument()
    // La media di 2, 3 e 4: il «—» dei dolori non conta come zero.
    const fascia = screen.getByText(/\/5 · Così così/)
    expect(fascia.previousElementSibling.textContent).toBe('3')
  })
})
