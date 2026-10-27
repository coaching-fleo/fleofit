import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

// Perché questo test esiste
// ─────────────────────────
// Alcuni atleti scrivono la nota sull'allenamento e non lo segnano come fatto:
// il coach si ritrovava un workout «da fare» con dentro il racconto di come era
// andato. La regola: su un allenamento NON completato la nota non si salva da
// sola, si salva insieme al completamento. «Conferma note» chiede prima se
// l'allenamento è stato fatto; il sì passa dal flusso di sempre (RPE → recap),
// il «no» (che su Android è anche il tasto indietro) non scrive niente ma lascia il testo nel riquadro.

const ctrl = await vi.hoisted(async () => ({ stato: {} }))

const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  return fintoSupabase(() => ({
    workouts: [{ id: 'w1', title: 'Hyrox Strength #1', date: ctrl.stato.data, coach_notes: '', sections: ctrl.stato.sections }],
    athlete_workouts: ctrl.stato.assegnazioni,
    athletes: [{ id: 'u1', name: 'Marco', surname: 'Rinaldi' }],
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

const HYROX = {
  category: 'Hyrox', intensity: '8',
  blocks: [{ id: 'b1', type: 'WarmUp', params: { duration: '8:00' }, exercises: [] }],
}

const assegnazione = (status, data = '2026-08-28') => ([{
  id: 'aw1', athlete_id: 'u1', workout_id: 'w1', completed_date: data,
  status, notes: null, voice_note_url: null,
  athletes: { id: 'u1', name: 'Marco', surname: 'Rinaldi', photo_url: null },
}])

function apri() {
  return render(
    <MemoryRouter initialEntries={['/workout/w1?athlete_id=u1']}>
      <AuthContext.Provider value={{ user: { id: 'u1', email: 'a@b.it', user_metadata: {} }, role: 'athlete' }}>
        <Routes><Route path="/workout/:id" element={<WorkoutDetail />} /></Routes>
      </AuthContext.Provider>
    </MemoryRouter>
  )
}

const attendi = () => waitFor(() =>
  expect(screen.getByRole('heading', { name: 'Hyrox Strength #1' })).toBeInTheDocument())

const scriviEConferma = async (utente, testo) => {
  await utente.type(screen.getByLabelText('Le tue note'), testo)
  await utente.click(screen.getByRole('button', { name: 'Conferma note' }))
}

/** Le scritture su athlete_workouts: le `update` col loro argomento. */
const scritture = () => finto.chiamateA('athlete_workouts', 'update').map(c => c.args[0])

beforeEach(() => {
  finto.chiamate.length = 0
  // «Come stai oggi» si chiede segnando come completato, prima dell'RPE: qui
  // non è il soggetto, quindi oggi risulta già saltato.
  window.localStorage.setItem('fleofit_come_stai_saltato', JSON.stringify(new Date().toLocaleDateString('sv-SE')))
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('la nota su un allenamento non completato', () => {
  beforeEach(() => { ctrl.stato = { data: '2026-08-28', sections: HYROX, assegnazioni: assegnazione('pending') } })

  it('non si salva: prima chiede se l’allenamento è stato fatto', async () => {
    const utente = userEvent.setup()
    apri()
    await attendi()
    await scriviEConferma(utente, 'Wall balls pesanti')

    expect(await screen.findByRole('dialog', { name: /Hai completato l.allenamento/ })).toBeInTheDocument()
    expect(scritture()).toEqual([])
  })

  it('con il sì apre l’RPE con la nota dentro, e salva nota e completamento insieme', async () => {
    const utente = userEvent.setup()
    apri()
    await attendi()
    await scriviEConferma(utente, 'Wall balls pesanti')

    const domanda = await screen.findByRole('dialog', { name: /Hai completato l.allenamento/ })
    await utente.click(within(domanda).getByRole('button', { name: /Sì, l.ho fatto/ }))

    // Il testo è in due posti: il riquadro della scheda e la modale RPE.
    await waitFor(() => expect(screen.getAllByDisplayValue('Wall balls pesanti')).toHaveLength(2))
    await utente.click(screen.getByRole('button', { name: /Fatto!/ }))

    await waitFor(() => expect(scritture()).toHaveLength(1))
    expect(scritture()[0].status).toBe('completed')
    expect(scritture()[0].notes).toContain('Wall balls pesanti')
  })

  it('con il «no» non salva niente e lascia il testo nel riquadro', async () => {
    const utente = userEvent.setup()
    apri()
    await attendi()
    await scriviEConferma(utente, 'Wall balls pesanti')

    const domanda = await screen.findByRole('dialog', { name: /Hai completato l.allenamento/ })
    await utente.click(within(domanda).getByRole('button', { name: 'No' }))

    expect(screen.queryByRole('dialog', { name: /Hai completato l.allenamento/ })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Le tue note')).toHaveValue('Wall balls pesanti')
    expect(scritture()).toEqual([])
  })
})

describe('la nota su un allenamento programmato più avanti', () => {
  beforeEach(() => { ctrl.stato = { data: '2099-01-01', sections: HYROX, assegnazioni: assegnazione('pending', '2099-01-01') } })

  it('con il sì mostra l’avviso della data futura, e non lo chiude subito', async () => {
    const utente = userEvent.setup()
    apri()
    await attendi()
    await scriviEConferma(utente, 'Fatto in anticipo')

    const domanda = await screen.findByRole('dialog', { name: /Hai completato l.allenamento/ })
    await utente.click(within(domanda).getByRole('button', { name: /Sì, l.ho fatto/ }))

    expect(await screen.findByRole('dialog', { name: 'Attenzione' })).toBeInTheDocument()
    expect(scritture()).toEqual([])
  })
})

describe('la nota su un allenamento già completato', () => {
  beforeEach(() => { ctrl.stato = { data: '2026-08-28', sections: HYROX, assegnazioni: assegnazione('completed') } })

  it('si salva subito, senza domande', async () => {
    const utente = userEvent.setup()
    apri()
    await attendi()
    await scriviEConferma(utente, 'Correzione: 9 kg')

    await waitFor(() => expect(scritture()).toHaveLength(1))
    expect(scritture()[0].notes).toContain('Correzione: 9 kg')
    expect(screen.queryByRole('dialog', { name: /Hai completato l.allenamento/ })).not.toBeInTheDocument()
  })
})
