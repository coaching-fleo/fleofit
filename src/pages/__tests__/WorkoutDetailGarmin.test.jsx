import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'

// «Da Garmin» nella scheda: la card con i numeri dell'orologio, «Non era
// questo allenamento», il link `?rpe=1` della push e la durata vera nel recap
// (src/lib/attivitaGarmin.js).

const ctrl = await vi.hoisted(async () => ({ stato: {} }))

const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  return fintoSupabase(() => ({
    workouts: [{ id: 'w1', title: 'Hyrox Strength #1', date: '2026-08-28', coach_notes: '', sections: ctrl.stato.sections }],
    athlete_workouts: ctrl.stato.assegnazioni,
    athletes: [{ id: 'u1', name: 'Marco', surname: 'Rinaldi' }],
    garmin_attivita: ctrl.stato.garmin,
  }), { erroreSu: () => ctrl.stato.erroreSu || [] })
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

const assegnazione = (notes = null, status = 'completed') => ([{
  id: 'aw1', athlete_id: 'u1', workout_id: 'w1', completed_date: '2026-08-28',
  status, notes, voice_note_url: null,
  athletes: { id: 'u1', name: 'Marco', surname: 'Rinaldi', photo_url: null },
}])

const ATTIVITA = {
  garmin_id: 'g1', tipo: 'STRENGTH_TRAINING', durata_s: 2520, distanza_m: null,
  athlete_workout_id: 'aw1', abbinamento: 'auto',
  dati: { fc_media: 141, fc_max: 172, calorie: 410, dispositivo: 'Forerunner 265' },
}

let ultimoUrl = ''
function Url() {
  const l = useLocation()
  ultimoUrl = l.pathname + l.search
  return null
}

function apri({ ruolo = 'athlete', utente = 'u1', url = '/workout/w1?athlete_id=u1' } = {}) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <AuthContext.Provider value={{ user: { id: utente, email: 'a@b.it', user_metadata: {} }, role: ruolo }}>
        <Routes><Route path="/workout/:id" element={<><WorkoutDetail /><Url /></>} /></Routes>
      </AuthContext.Provider>
    </MemoryRouter>
  )
}

const attendi = () => waitFor(() =>
  expect(screen.getByRole('heading', { name: 'Hyrox Strength #1' })).toBeInTheDocument())

beforeEach(() => {
  ctrl.stato = { sections: HYROX, assegnazioni: assegnazione(), garmin: [ATTIVITA] }
  finto.chiamate.length = 0
  window.localStorage.setItem('fleofit_come_stai_saltato', JSON.stringify(new Date().toLocaleDateString('sv-SE')))
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('la card «Da Garmin»', () => {
  it('mostra i numeri dell\'orologio e chi li ha misurati, anche per Hyrox', async () => {
    apri()
    await attendi()
    // 🔴 Linee guida di marchio Garmin: «Garmin [modello]» È il titolo della card.
    expect(await screen.findByText('Garmin Forerunner 265')).toBeInTheDocument()
    expect(screen.getByText('42′')).toBeInTheDocument()
    expect(screen.getByText('141 bpm')).toBeInTheDocument()
    // Niente distanza né passo: non ci sono.
    expect(screen.queryByText('Distanza')).not.toBeInTheDocument()
  })

  it('senza attività, o con la lettura che fallisce, non c\'è', async () => {
    ctrl.stato.erroreSu = ['garmin_attivita']
    apri()
    await attendi()
    await waitFor(() => expect(finto.chiamateA('garmin_attivita', 'limit')).toHaveLength(1))
    expect(screen.queryByText('Garmin Forerunner 265')).not.toBeInTheDocument()
  })

  it('«Non era questo allenamento»: chiede, stacca l\'attività e il workout torna da fare', async () => {
    const utente = userEvent.setup()
    apri()
    await attendi()
    await utente.click(await screen.findByRole('button', { name: 'Non era questo allenamento' }))
    await utente.click(await screen.findByRole('button', { name: 'Stacca' }))
    await waitFor(() => expect(finto.chiamateA('garmin_attivita', 'update')).toHaveLength(1))
    expect(finto.chiamateA('garmin_attivita', 'update')[0].args[0]).toEqual({ athlete_workout_id: null, abbinamento: 'atleta' })
    await waitFor(() => expect(finto.chiamateA('athlete_workouts', 'update')).toHaveLength(1))
    expect(finto.chiamateA('athlete_workouts', 'update')[0].args[0]).toEqual({ status: 'pending' })
    expect(await screen.findByRole('button', { name: /Segna come completato/ })).toBeInTheDocument()
  })
})

describe('«Non era questo» che non riesce', () => {
  const stacca = async () => {
    const utente = userEvent.setup()
    apri()
    await attendi()
    await utente.click(await screen.findByRole('button', { name: 'Non era questo allenamento' }))
    return utente
  }

  it('se si stacca a metà, lo dice', async () => {
    const utente = await stacca()
    ctrl.stato.erroreSu = ['athlete_workouts']
    await utente.click(await screen.findByRole('button', { name: 'Stacca' }))
    expect(await screen.findByText(/L’attività è staccata, ma l’allenamento non è tornato da fare/)).toBeInTheDocument()
  })

  it('se non si stacca affatto, il messaggio di sempre', async () => {
    const utente = await stacca()
    ctrl.stato.erroreSu = ['garmin_attivita']
    await utente.click(await screen.findByRole('button', { name: 'Stacca' }))
    expect(await screen.findByText('Impossibile staccare l’attività di Garmin')).toBeInTheDocument()
    expect(finto.chiamateA('athlete_workouts', 'update')).toHaveLength(0)
  })
})

describe('due attività sulla stessa assegnazione', () => {
  it('una card sola, la più recente', async () => {
    ctrl.stato.garmin = [ATTIVITA, { ...ATTIVITA, garmin_id: 'g0', durata_s: 600 }]
    apri()
    await attendi()
    expect(await screen.findByText('Garmin Forerunner 265')).toBeInTheDocument()
    expect(screen.getAllByText('Garmin Forerunner 265')).toHaveLength(1)
    expect(screen.getByText('42′')).toBeInTheDocument()
    const ordine = finto.chiamateA('garmin_attivita', 'order')
    expect(ordine[0].args).toEqual(['ricevuto_at', { ascending: false }])
  })
})

describe('il link «Com\'è andata?» (?rpe=1)', () => {
  it('all\'atleta senza RPE apre il foglio una volta, e il parametro se ne va', async () => {
    apri({ url: '/workout/w1?athlete_id=u1&rpe=1' })
    await attendi()
    expect(await screen.findByRole('button', { name: /Fatto!/ })).toBeInTheDocument()
    await waitFor(() => expect(ultimoUrl).toBe('/workout/w1?athlete_id=u1'))
  })

  it('🔴 con l\'RPE già dichiarato salta il foglio e apre subito il recap', async () => {
    ctrl.stato.assegnazioni = assegnazione('[RPE: 7/10]\n')
    apri({ url: '/workout/w1?athlete_id=u1&rpe=1' })
    await attendi()
    await waitFor(() => expect(ultimoUrl).toBe('/workout/w1?athlete_id=u1'))
    expect(await screen.findByRole('dialog', { name: /Recap/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Fatto!/ })).not.toBeInTheDocument()
  })

  it('🔴 «Annulla» sul foglio arrivato dalla push apre comunque il recap', async () => {
    const utente = userEvent.setup()
    apri({ url: '/workout/w1?athlete_id=u1&rpe=1' })
    await attendi()
    await screen.findByRole('button', { name: /Fatto!/ })
    await utente.click(screen.getByRole('button', { name: 'Annulla' }))
    expect(await screen.findByRole('dialog', { name: /Recap/ })).toBeInTheDocument()
  })

  it('senza la push, «Annulla» chiude e basta', async () => {
    const utente = userEvent.setup()
    ctrl.stato.assegnazioni = assegnazione(null, 'pending')
    apri()
    await attendi()
    await utente.click(await screen.findByRole('button', { name: /Segna come completato/ }))
    await utente.click(await screen.findByRole('button', { name: 'Annulla' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: /Fatto!/ })).not.toBeInTheDocument())
    expect(screen.queryByRole('dialog', { name: /Recap/ })).not.toBeInTheDocument()
  })

  it('al coach non si apre', async () => {
    apri({ ruolo: 'admin', utente: 'coach1', url: '/workout/w1?athlete_id=u1&rpe=1' })
    await attendi()
    await waitFor(() => expect(ultimoUrl).toBe('/workout/w1?athlete_id=u1'))
    expect(screen.queryByRole('button', { name: /Fatto!/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: /Recap/ })).not.toBeInTheDocument()
  })
})

describe('il recap con l\'attività di Garmin', () => {
  it('la durata è quella vera, senza ≈', async () => {
    const utente = userEvent.setup()
    apri({ url: '/workout/w1?athlete_id=u1&rpe=1' })
    await attendi()
    await screen.findByText('Garmin Forerunner 265')
    await utente.click(await screen.findByRole('button', { name: /Fatto!/ }))
    const recap = await screen.findByRole('dialog', { name: /Recap/ })
    await waitFor(() => expect(within(recap).getByText('42')).toBeInTheDocument())
  })
})
