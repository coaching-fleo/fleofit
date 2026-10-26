import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

// Perché questi test esistono
// ────────────────────────────
// «I miei modelli» (16/10/2026) sta dentro fogli che servono ad altro: se si
// vede dove non deve («Cambia tipo di blocco», la modifica di una fase, una
// superserie) o con un errore, rovina un foglio che oggi funziona. E un
// modello inserito deve avere id suoi: con gli id del modello, due
// inserimenti darebbero due blocchi legati fra loro.

let modelli = []
let modelliInErrore = false

const MOD = (id, categoria, nome, contenuto) => ({
  id, coach: 'u1', categoria, nome, contenuto, creato_at: `2026-10-2${id.length}T10:00:00Z`, modificato_at: null,
})

vi.mock('../../supabaseClient', () => {
  const catena = {
    select: () => catena,
    eq: () => catena,
    order: () => catena,
    limit: () => Promise.resolve({ data: [], error: null }),
    single: () => Promise.resolve({ data: null, error: null }),
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
  }
  // `modelli_blocco` si legge con `await` dopo `.eq('categoria', …)`.
  const catenaModelli = () => {
    let categoria = null
    const c = {
      select: () => c,
      eq: (col, v) => { if (col === 'categoria') categoria = v; return c },
      then: (ok, ko) => Promise.resolve(modelliInErrore
        ? { data: null, error: { message: 'rete assente' } }
        : { data: modelli.filter(m => !categoria || m.categoria === categoria), error: null }).then(ok, ko),
    }
    return c
  }
  return {
    supabase: {
      from: (t) => (t === 'modelli_blocco' ? catenaModelli() : catena),
      auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u1' } } }) },
      functions: { invoke: () => Promise.resolve({ data: null, error: null }) },
    },
  }
})

const { AuthContext } = await import('../../App')
const CreateWorkout = (await import('../CreateWorkout')).default

const HYROX_A = MOD('a', 'Hyrox', 'EMOM gambe', {
  type: 'EMOM', params: { interval: '1:00', rounds: '12' }, notes: '',
  exercises: [{ id: 0.77, name: 'Wall Balls', reps: '15', kg: '9' }],
})
const HYROX_B = MOD('bb', 'Hyrox', 'AMRAP corto', {
  type: 'AMRAP', params: { duration: '8:00' }, notes: '', exercises: [{ name: 'Burpees', reps: '10' }],
})
const CORSA = MOD('ccc', 'Running', 'Ripetute 400', {
  type: 'repeat', rounds: '8', runDuration: '400m', runPace: 'Z4', recDuration: '1 min', recPace: 'Z1',
})
const GYM = MOD('dddd', 'Gym', 'Panca 4×8', {
  serie: '4', recupero: '2:00', note: '', esercizi: [{ name: 'Panca piana con bilanciere', reps: '8', kg: '70 kg' }],
})
const ROTTO = MOD('eeeee', 'Hyrox', 'Senza tipo', { exercises: [] })

async function conBozza(bozza) {
  localStorage.setItem('fleofit_workout_draft', JSON.stringify({
    sourceId: null, modo: 'nuovo', title: 'Prova', date: '2026-10-26', workoutIntensity: '7',
    blocks: [], runningSteps: [], gymGroups: [], coachNotes: '', ...bozza,
  }))
  render(
    <AuthContext.Provider value={{ user: { id: 'u1' }, role: 'admin' }}>
      <MemoryRouter><CreateWorkout /></MemoryRouter>
    </AuthContext.Provider>
  )
  const bozzaTrovata = await screen.findByRole('dialog', { name: 'Bozza Trovata' })
  await userEvent.click(within(bozzaTrovata).getByRole('button', { name: 'Conferma' }))
}

const EMOM_NEL_WORKOUT = {
  id: 0.11, type: 'EMOM', params: { interval: '1:00', rounds: '10' }, notes: '',
  exercises: [{ id: 0.12, name: 'Row', meters: '200m' }],
}

/** Aspetta che i modelli abbiano avuto il tempo di arrivare. */
const dopoIlCaricamento = () => new Promise(r => setTimeout(r, 30))

beforeEach(() => {
  modelli = [HYROX_A, HYROX_B, CORSA, GYM, ROTTO]
  modelliInErrore = false
  localStorage.clear()
})

describe('«I miei modelli» nel foglio dei blocchi Hyrox', () => {
  it('mostra solo i modelli Hyrox validi', async () => {
    await conBozza({ category: 'Hyrox' })
    await userEvent.click(screen.getByRole('button', { name: /Aggiungi blocco/i }))
    expect(await screen.findByText('I miei modelli')).toBeInTheDocument()
    expect(screen.getByText('EMOM gambe')).toBeInTheDocument()
    expect(screen.getByText('AMRAP corto')).toBeInTheDocument()
    expect(screen.queryByText('Ripetute 400')).toBeNull()
    expect(screen.queryByText('Senza tipo')).toBeNull()
    expect(screen.getByRole('link', { name: /Gestisci i modelli/ })).toHaveAttribute('href', '/modelli?categoria=Hyrox')
  })

  it('toccarne uno aggiunge il blocco in fondo, aperto, con id nuovi e senza chiedere i numeri', async () => {
    await conBozza({ category: 'Hyrox', blocks: [EMOM_NEL_WORKOUT] })
    await userEvent.click(screen.getByRole('button', { name: /Aggiungi blocco/i }))
    await userEvent.click(await screen.findByText('EMOM gambe'))

    await waitFor(() => expect(document.querySelectorAll('[data-blocco-id]')).toHaveLength(2))
    const nuovo = document.querySelectorAll('[data-blocco-id]')[1]
    expect(nuovo.querySelector('[data-tipo-blocco]')).toHaveTextContent('EMOM')
    expect(nuovo.getAttribute('data-blocco-id')).not.toBe(String(EMOM_NEL_WORKOUT.id))
    // Aperto: dentro c'è il suo esercizio, con un id che non è quello del modello.
    expect(within(nuovo).getByText('Wall Balls')).toBeInTheDocument()
    expect(within(nuovo).getByText('Cambia tipo di blocco')).toBeInTheDocument()
    // Nessun foglio dei numeri: il modello li ha già.
    expect(screen.queryByRole('dialog', { name: 'EMOM' })).toBeNull()
    expect(screen.queryByText('Aggiungi Blocco')).toBeNull()
  })

  it('«Cambia tipo di blocco» non mostra i modelli', async () => {
    await conBozza({ category: 'Hyrox', blocks: [EMOM_NEL_WORKOUT] })
    await userEvent.click(document.querySelector('[data-blocco-id] [data-tipo-blocco]'))
    await userEvent.click(screen.getByText('Cambia tipo di blocco'))
    expect(await screen.findByText('Cambia tipo di blocco', { selector: 'h3' })).toBeInTheDocument()
    await dopoIlCaricamento()
    expect(screen.queryByText('I miei modelli')).toBeNull()
  })

  it('senza modelli il foglio è quello di sempre', async () => {
    modelli = [CORSA]
    await conBozza({ category: 'Hyrox' })
    await userEvent.click(screen.getByRole('button', { name: /Aggiungi blocco/i }))
    await dopoIlCaricamento()
    expect(screen.queryByText('I miei modelli')).toBeNull()
  })

  it('con la lettura in errore il foglio è quello di sempre', async () => {
    modelliInErrore = true
    await conBozza({ category: 'Hyrox' })
    await userEvent.click(screen.getByRole('button', { name: /Aggiungi blocco/i }))
    await dopoIlCaricamento()
    expect(screen.queryByText('I miei modelli')).toBeNull()
  })
})

describe('«I miei modelli» nel foglio delle fasi di corsa', () => {
  it('in aggiunta mostra i modelli Running, e toccarne uno aggiunge la fase', async () => {
    await conBozza({ category: 'Running', runningSteps: [{ id: 0.21, type: 'run', duration: '5 km', pace: 'Z2', intensity: '5' }] })
    await userEvent.click(screen.getByRole('button', { name: /Aggiungi fase/ }))
    const foglio = await screen.findByRole('dialog', { name: 'Nuova fase' })
    await userEvent.click(await within(foglio).findByText('Ripetute 400'))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Nuova fase' })).toBeNull())
    expect(screen.getAllByRole('button', { name: 'Salva la fase come modello' })).toHaveLength(2)
  })

  it('in modifica di una fase non mostra i modelli', async () => {
    await conBozza({ category: 'Running', runningSteps: [{ id: 0.21, type: 'run', duration: '5 km', pace: 'Z2', intensity: '5' }] })
    await userEvent.click(screen.getByText('5 km'))
    const foglio = await screen.findByRole('dialog', { name: 'Modifica fase' })
    await dopoIlCaricamento()
    expect(within(foglio).queryByText('I miei modelli')).toBeNull()
  })
})

describe('«I miei modelli» nel foglio degli esercizi Gym', () => {
  const SUPERSERIE = {
    id: 0.41, fase: 'principale', serie: '3', recupero: '1:30', note: '',
    esercizi: [{ id: 0.42, name: 'Trazioni', reps: '8' }, { id: 0.43, name: 'Dip', reps: '10' }],
  }

  it('aggiungendo alla fase principale mostra i modelli Gym, e toccarne uno aggiunge il gruppo', async () => {
    await conBozza({ category: 'Gym' })
    await userEvent.click(await screen.findByRole('button', { name: /Aggiungi il primo esercizio/ }))
    const foglio = await screen.findByRole('dialog', { name: 'Aggiungi esercizi' })
    await userEvent.click(await within(foglio).findByText('Panca 4×8'))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Aggiungi esercizi' })).toBeNull())
    const gruppo = document.querySelector('[data-gruppo-gym]')
    expect(gruppo).not.toBeNull()
    expect(within(gruppo).getByText(/Panca piana con bilanciere/)).toBeInTheDocument()
    // È nella fase principale: la barra della card è piena (4px), non quella delle altre fasi.
    expect(gruppo.querySelector('.bg-gym').style.width).toBe('4px')
  })

  it('dentro una superserie non mostra i modelli', async () => {
    await conBozza({ category: 'Gym', gymGroups: [SUPERSERIE] })
    await userEvent.click(await screen.findByRole('button', { name: /Aggiungi un esercizio qui/ }))
    const foglio = await screen.findByRole('dialog', { name: /Aggiungi alla/ })
    await dopoIlCaricamento()
    expect(within(foglio).queryByText('I miei modelli')).toBeNull()
  })
})

describe('l\'icona «Modelli» nella testata del builder', () => {
  it('porta alla pagina dei modelli', async () => {
    render(
      <AuthContext.Provider value={{ user: { id: 'u1' }, role: 'admin' }}>
        <MemoryRouter initialEntries={['/create']}>
          <Routes>
            <Route path="/create" element={<CreateWorkout />} />
            <Route path="/modelli" element={<p>pagina dei modelli</p>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    )
    await userEvent.click(await screen.findByRole('button', { name: 'Modelli' }))
    expect(await screen.findByText('pagina dei modelli')).toBeInTheDocument()
  })
})

describe('andare ai modelli dal builder', () => {
  // La spec: «se il workout ha modifiche non salvate, la bozza le conserva già».
  // Il collegamento del foglio chiedeva «Sei sicuro?» e, confermando, cancellava
  // la bozza; l'icona della testata invece usciva e la teneva. Ora tutti e due
  // escono senza chiedere e la bozza resta.
  const montaConModelli = () => render(
    <AuthContext.Provider value={{ user: { id: 'u1' }, role: 'admin' }}>
      <MemoryRouter initialEntries={['/create']}>
        <Routes>
          <Route path="/create" element={<CreateWorkout />} />
          <Route path="/modelli" element={<p>pagina dei modelli</p>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  )
  const conBozzaRipresa = async () => {
    localStorage.setItem('fleofit_workout_draft', JSON.stringify({
      sourceId: null, modo: 'nuovo', title: 'A metà', date: '2026-10-26', workoutIntensity: '7',
      category: 'Hyrox', blocks: [EMOM_NEL_WORKOUT], runningSteps: [], gymGroups: [], coachNotes: '',
    }))
    montaConModelli()
    const d = await screen.findByRole('dialog', { name: 'Bozza Trovata' })
    await userEvent.click(within(d).getByRole('button', { name: 'Conferma' }))
  }

  it('«Gestisci i modelli» esce senza chiedere e la bozza resta', async () => {
    await conBozzaRipresa()
    await userEvent.click(screen.getByRole('button', { name: /Aggiungi blocco/i }))
    await userEvent.click(await screen.findByRole('link', { name: /Gestisci i modelli/ }))
    expect(await screen.findByText('pagina dei modelli')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Sei sicuro?' })).toBeNull()
    expect(JSON.parse(localStorage.getItem('fleofit_workout_draft')).blocks).toHaveLength(1)
  })

  it('l\'icona «Modelli» fa lo stesso', async () => {
    await conBozzaRipresa()
    await userEvent.click(screen.getByRole('button', { name: 'Modelli' }))
    expect(await screen.findByText('pagina dei modelli')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('fleofit_workout_draft')).blocks).toHaveLength(1)
  })
})

