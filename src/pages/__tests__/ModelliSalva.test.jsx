import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { nomeProposto } from '../../lib/modelliBlocco'
import { MESSAGGIO_SENZA_RETE } from '../../lib/modelliBloccoDb'

// Perché questi test esistono
// ────────────────────────────
// «Salva come modello» scrive in `modelli_blocco` (16/10/2026). Due cose si
// romperebbero in silenzio: un `contenuto` salvato con gli `id` del workout
// (un modello inserito due volte darebbe due blocchi con lo stesso id), e un
// errore di rete che chiude il foglio come se il modello fosse salvato.

const inseriti = []
let erroreInsert = null

vi.mock('../../supabaseClient', () => {
  const catena = {
    select: () => catena,
    eq: () => catena,
    order: () => catena,
    limit: () => Promise.resolve({ data: [], error: null }),
    insert: (riga) => { inseriti.push(riga); return catena },
    single: () => Promise.resolve(erroreInsert
      ? { data: null, error: erroreInsert }
      : { data: { id: 'm1', ...inseriti.at(-1) }, error: null }),
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
  }
  return {
    supabase: {
      from: () => catena,
      auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u1' } } }) },
      functions: { invoke: () => Promise.resolve({ data: null, error: null }) },
    },
  }
})

vi.mock('../../lib/alert', () => ({ mostraErrore: vi.fn(), mostraSuccesso: vi.fn() }))

const alert = await import('../../lib/alert')
const { AuthContext } = await import('../../App')
const CreateWorkout = (await import('../CreateWorkout')).default

const EMOM = {
  id: 0.11, type: 'EMOM', params: { interval: '1:00', rounds: '10' }, notes: '',
  exercises: [{ id: 0.12, name: 'Wall Balls', reps: '15', kg: '9', intensity: '7' }],
}
const FASE = { id: 0.21, type: 'run', duration: '5 km', pace: '5:00 /km', intensity: '6', notes: '' }
const GRUPPO = {
  id: 0.31, fase: 'principale', serie: '4', recupero: '1:30', note: '',
  esercizi: [{ id: 0.32, name: 'Panca piana con bilanciere', reps: '10', kg: '60 kg' }],
}

/** Il builder al passo 2, con il workout ripreso dalla bozza. */
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

const foglio = () => screen.findByRole('dialog', { name: 'Salva come modello' })

/** Vero se da qualche parte, a qualunque livello, c'è una chiave `id`. */
const haId = (v) => Array.isArray(v) ? v.some(haId)
  : v && typeof v === 'object' ? Object.entries(v).some(([k, x]) => k === 'id' || haId(x))
  : false

beforeEach(() => {
  inseriti.length = 0
  erroreInsert = null
  alert.mostraErrore.mockClear()
  alert.mostraSuccesso.mockClear()
  localStorage.clear()
})

describe('«Salva come modello» dai blocchi del workout', () => {
  it('un blocco Hyrox: il foglio propone il nome e salva senza id', async () => {
    await conBozza({ category: 'Hyrox', blocks: [EMOM] })
    await userEvent.click(screen.getByRole('button', { name: 'Salva il blocco come modello' }))
    const f = await foglio()
    expect(within(f).getByLabelText('Nome del modello')).toHaveValue(nomeProposto('Hyrox', EMOM))

    await userEvent.click(within(f).getByRole('button', { name: 'Salva modello' }))
    await waitFor(() => expect(inseriti).toHaveLength(1))
    expect(inseriti[0]).toMatchObject({ coach: 'u1', categoria: 'Hyrox', nome: nomeProposto('Hyrox', EMOM) })
    expect(inseriti[0].contenuto).toMatchObject({ type: 'EMOM', exercises: [{ name: 'Wall Balls' }] })
    expect(haId(inseriti[0].contenuto)).toBe(false)
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Salva come modello' })).toBeNull())
    expect(alert.mostraSuccesso).toHaveBeenCalledWith('Lo trovi in «Aggiungi» e in Modelli.', 'Modello salvato')
  })

  it('una fase di corsa', async () => {
    await conBozza({ category: 'Running', runningSteps: [FASE] })
    await userEvent.click(screen.getByRole('button', { name: 'Salva la fase come modello' }))
    const f = await foglio()
    expect(within(f).getByLabelText('Nome del modello')).toHaveValue(nomeProposto('Running', FASE))

    await userEvent.click(within(f).getByRole('button', { name: 'Salva modello' }))
    await waitFor(() => expect(inseriti).toHaveLength(1))
    expect(inseriti[0]).toMatchObject({ categoria: 'Running', contenuto: { type: 'run', duration: '5 km' } })
    expect(haId(inseriti[0].contenuto)).toBe(false)
  })

  it('un gruppo Gym', async () => {
    await conBozza({ category: 'Gym', gymGroups: [GRUPPO] })
    await userEvent.click(await screen.findByRole('button', { name: 'Salva come modello' }))
    const f = await foglio()
    expect(within(f).getByLabelText('Nome del modello')).toHaveValue(nomeProposto('Gym', GRUPPO))

    await userEvent.click(within(f).getByRole('button', { name: 'Salva modello' }))
    await waitFor(() => expect(inseriti).toHaveLength(1))
    expect(inseriti[0]).toMatchObject({ categoria: 'Gym', contenuto: { serie: '4', esercizi: [{ name: 'Panca piana con bilanciere' }] } })
    expect(haId(inseriti[0].contenuto)).toBe(false)
    expect(inseriti[0].contenuto.fase).toBeUndefined()
  })

  it('senza nome il bottone è spento', async () => {
    await conBozza({ category: 'Hyrox', blocks: [EMOM] })
    await userEvent.click(screen.getByRole('button', { name: 'Salva il blocco come modello' }))
    const f = await foglio()
    await userEvent.clear(within(f).getByLabelText('Nome del modello'))
    expect(within(f).getByRole('button', { name: 'Salva modello' })).toBeDisabled()
  })

  it('se il salvataggio non riesce il foglio resta aperto e lo dice', async () => {
    erroreInsert = { message: 'Failed to fetch' }
    await conBozza({ category: 'Hyrox', blocks: [EMOM] })
    await userEvent.click(screen.getByRole('button', { name: 'Salva il blocco come modello' }))
    const f = await foglio()
    await userEvent.click(within(f).getByRole('button', { name: 'Salva modello' }))
    await waitFor(() => expect(alert.mostraErrore).toHaveBeenCalledWith(MESSAGGIO_SENZA_RETE))
    expect(screen.getByRole('dialog', { name: 'Salva come modello' })).toBeInTheDocument()
    expect(alert.mostraSuccesso).not.toHaveBeenCalled()
  })

  it('salvare non cambia il blocco nel workout', async () => {
    await conBozza({ category: 'Hyrox', blocks: [EMOM] })
    await userEvent.click(screen.getByRole('button', { name: 'Salva il blocco come modello' }))
    const f = await foglio()
    await userEvent.click(within(f).getByRole('button', { name: 'Salva modello' }))
    await waitFor(() => expect(inseriti).toHaveLength(1))
    expect(document.querySelectorAll('[data-blocco-id]')).toHaveLength(1)
  })
})
