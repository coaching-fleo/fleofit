import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

// «Come stai oggi» nella scheda workout (13/10/2026).
// I casi: all'atleta la domanda arriva quando segna l'allenamento come
// completato, prima del «Com'è andata?», e non lo blocca mai (saltare apre
// l'RPE lo stesso), una volta al giorno. Mai all'avvio del timer o del
// telecomando TV (27/10/2026). Al coach si mostra la risposta del giorno della seduta.

const ctrl = await vi.hoisted(async () => ({ comeStai: [], salva: null }))

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
// `ctrl.salva` permette di simulare un salvataggio lento (rete scarsa).
vi.mock('../../lib/comeStai', async (originale) => {
  const vero = await originale()
  return { ...vero, salvaComeStai: (...a) => (ctrl.salva ? ctrl.salva(...a) : vero.salvaComeStai(...a)) }
})
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
  ctrl.salva = null
  finto.chiamate.length = 0
  window.localStorage.clear()
})

const completa = async (user) =>
  user.click((await screen.findAllByRole('button', { name: /Segna come completato/i }))[0])

describe('Come stai oggi — atleta', () => {
  it('«Avvia allenamento» fa partire il timer senza chiedere niente', async () => {
    apri()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /Avvia allenamento/i }))
    expect(await screen.findByRole('button', { name: /Minimizza timer/i })).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Come stai oggi?' })).toBeNull()
  })

  it('la domanda arriva segnando come completato, e «Salta» apre l\'RPE lo stesso', async () => {
    apri()
    const user = userEvent.setup()
    await completa(user)
    expect(await screen.findByRole('dialog', { name: 'Come stai oggi?' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Salta' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Come stai oggi?' })).toBeNull())
    expect(await screen.findByText("Com'è andata?")).toBeInTheDocument()
    // Saltato oggi: non si richiede, né col bottone né con l'invito.
    expect(screen.queryByText('Come stai oggi?')).toBeNull()
  })

  it('rispondere salva il giorno con le risposte date', async () => {
    apri()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /Rispondi/ }))
    await user.click(screen.getByRole('radio', { name: 'Energia: Al top' }))
    await user.click(screen.getByRole('button', { name: 'Fatto' }))
    await waitFor(() => expect(finto.chiamateA('come_stai', 'upsert')).toHaveLength(1))
    const [riga, opzioni] = finto.chiamateA('come_stai', 'upsert')[0].args
    expect(riga).toMatchObject({ athlete_id: 'u1', energia: 5, sonno: null })
    expect(opzioni).toEqual({ onConflict: 'athlete_id,giorno' })
    // Dall'invito, non dal completamento: dopo la risposta non si apre l'RPE.
    expect(screen.queryByText("Com'è andata?")).toBeNull()
  })

  it('con la rete lenta l\'RPE si apre subito, senza aspettare il salvataggio', async () => {
    ctrl.salva = () => new Promise(() => {}) // non risponde mai
    apri()
    const user = userEvent.setup()
    await completa(user)
    await user.click(await screen.findByRole('radio', { name: 'Sonno: Così così' }))
    await user.click(screen.getByRole('button', { name: 'Fatto' }))
    expect(await screen.findByText("Com'è andata?")).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Come stai oggi?' })).toBeNull()
  })

  it('la X (e il tasto indietro di Android) chiude senza aprire l\'RPE, e si richiede', async () => {
    apri()
    const user = userEvent.setup()
    await completa(user)
    await user.click(await screen.findByRole('button', { name: 'Chiudi' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Come stai oggi?' })).toBeNull())
    expect(screen.queryByText("Com'è andata?")).toBeNull()
    // Chiudere non è saltare: l'invito resta.
    expect(screen.getByText('Come stai oggi?')).toBeInTheDocument()
  })

  it('se oggi ha già risposto non si chiede', async () => {
    ctrl.comeStai = [{ id: 'c1', athlete_id: 'u1', giorno: '2026-08-26', sonno: 4, energia: 4, dolori: 4, stress: 4 }]
    apri()
    const user = userEvent.setup()
    await completa(user)
    expect(await screen.findByText("Com'è andata?")).toBeInTheDocument()
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
    // Le risposte a parole, non col numero: «Stress 4» si leggerebbe «stressato».
    expect(screen.getByText('Scarso')).toBeInTheDocument()
    expect(screen.getByText('Basso')).toBeInTheDocument()
  })
})
