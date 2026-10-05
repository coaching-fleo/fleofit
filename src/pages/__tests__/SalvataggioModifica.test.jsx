import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { BOTTONE_BRAND } from '../../lib/stiliCard'

// Perché questi test esistono (05/10/2026): segnalato che «salvare una copia»
// a volte cambiava il workout vero, quindi anche agli atleti che l'avevano
// assegnato. Il salvataggio come nuovo non ha mai sovrascritto niente; le
// strade per arrivarci erano tre, e ognuna ha qui il suo test:
//  1. la bozza di un «Duplica» riproposta dentro «Modifica» dello stesso
//     workout — con un tocco si caricava la copia su una schermata che salva
//     SOPRA l'originale;
//  2. il giallo della scelta era «Sovrascrivi», senza dire a chi cambiava;
//  3. sovrascrivendo da un atleta, la SUA data finiva sul workout di tutti.

const EMOM = {
  category: 'Hyrox', intensity: '5',
  blocks: [{
    id: 'b1', type: 'EMOM', params: { interval: '1:00', rounds: '30' },
    exercises: [{ id: 'e1', name: 'Wall Balls', reps: '20', intensity: '8' }],
  }],
}

const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  return fintoSupabase(() => ({
    workouts: [{ id: 'w1', title: 'Originale', date: '2026-10-01', sections: EMOM, coach_notes: '' }],
    athlete_workouts: [
      { id: 'aw1', athlete_id: 'a1', completed_date: '2026-10-09', athletes: { name: 'Marco', surname: 'Rossi' } },
      { id: 'aw2', athlete_id: 'a2', completed_date: '2026-10-01', athletes: { name: 'Giulia', surname: 'Bianchi' } },
    ],
  }))
})
vi.mock('../../supabaseClient', () => ({ supabase: finto.supabase }))

const CreateWorkout = (await import('../CreateWorkout')).default

const apri = async (url) => {
  render(<MemoryRouter initialEntries={[url]}><CreateWorkout /></MemoryRouter>)
  await waitFor(() => expect(document.querySelector('[data-codice]')).toBeInTheDocument())
}
const bozza = () => localStorage.getItem('fleofit_workout_draft')
const semina = (extra) => localStorage.setItem('fleofit_workout_draft', JSON.stringify({
  sourceId: 'w1', title: 'Originale (Copia)', date: '2026-10-05', workoutIntensity: '9',
  category: 'Hyrox', blocks: EMOM.blocks, runningSteps: [], coachNotes: '', ...extra,
}))
const finestra = () => screen.getByRole('heading', { name: 'Salvataggio' }).closest('div').parentElement

beforeEach(() => {
  localStorage.clear()
  finto.chiamate.length = 0
})

describe('la bozza', () => {
  it('una bozza di «Duplica» NON si propone dentro «Modifica» dello stesso workout', async () => {
    semina({ modo: 'copia' })
    await apri('/create?edit=w1')
    expect(screen.queryByText('Bozza Trovata')).not.toBeInTheDocument()
    expect(bozza()).toBeNull()
  })

  it('una bozza di «Modifica» si propone ancora in «Modifica»', async () => {
    semina({ modo: 'modifica' })
    render(<MemoryRouter initialEntries={['/create?edit=w1']}><CreateWorkout /></MemoryRouter>)
    expect(await screen.findByText('Bozza Trovata')).toBeInTheDocument()
  })

  it('una bozza di prima della correzione (senza modo) si scarta', async () => {
    semina({})
    await apri('/create?edit=w1')
    expect(screen.queryByText('Bozza Trovata')).not.toBeInTheDocument()
  })

  it('aprire un workout senza cambiare niente non lascia una bozza', async () => {
    await apri('/create?duplicate=w1')
    await new Promise(r => setTimeout(r, 50))
    expect(bozza()).toBeNull()
  })

  it('un cambiamento vero la scrive, con il suo modo', async () => {
    await apri('/create?duplicate=w1')
    await userEvent.click(screen.getByRole('button', { name: 'Modifica nome e data' }))
    await userEvent.type(screen.getByLabelText('Nome del workout'), 'X')
    await waitFor(() => expect(bozza()).not.toBeNull())
    expect(JSON.parse(bozza()).modo).toBe('copia')
  })
})

describe('la scelta al salvataggio', () => {
  it('il bottone pieno è «Salva come nuovo», e «Sovrascrivi» dice a quanti atleti cambia', async () => {
    await apri('/create?edit=w1')
    await userEvent.click(screen.getByRole('button', { name: /Salva workout/ }))
    const f = finestra()
    const [primo, secondo] = within(f).getAllByRole('button').filter(b => /Salva come nuovo|Sovrascrivi/.test(b.textContent))
    expect(primo).toHaveTextContent('Salva come nuovo')
    expect(primo.className).toBe(`w-full ${BOTTONE_BRAND}`)
    expect(secondo).toHaveTextContent('Sovrascrivi esistente')
    expect(await within(f).findByText(/cambia il workout per 2 atleti/)).toBeInTheDocument()
  })
})

describe('entrando da un atleta', () => {
  it('sovrascrivere NON sposta la data del workout per tutti', async () => {
    await apri('/create?edit=w1&aw_id=aw1')
    await userEvent.click(screen.getByRole('button', { name: /Salva workout/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Sovrascrivi esistente' }))
    await waitFor(() => expect(finto.chiamateA('workouts', 'update')).toHaveLength(1))
    expect(finto.chiamateA('workouts', 'update')[0].args[0]).not.toHaveProperty('date')
    // La data dell'atleta si aggiorna sulla SUA assegnazione.
    expect(finto.chiamateA('athlete_workouts', 'update')[0].args[0]).toEqual({ completed_date: '2026-10-09' })
  })

  it('senza atleta la data del workout si salva come sempre', async () => {
    await apri('/create?edit=w1')
    await userEvent.click(screen.getByRole('button', { name: /Salva workout/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Sovrascrivi esistente' }))
    await waitFor(() => expect(finto.chiamateA('workouts', 'update')).toHaveLength(1))
    expect(finto.chiamateA('workouts', 'update')[0].args[0].date).toBe('2026-10-01')
  })

  it('«Salva come nuovo» dice che quell atleta riceverà la versione nuova', async () => {
    await apri('/create?edit=w1&aw_id=aw1')
    await userEvent.click(screen.getByRole('button', { name: /Salva workout/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Salva come nuovo' }))
    expect(screen.getByText(/Marco riceverà questa versione; gli altri atleti tengono l'originale/)).toBeInTheDocument()
  })
})
