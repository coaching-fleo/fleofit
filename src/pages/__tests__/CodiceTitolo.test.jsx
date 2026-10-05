import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

// Perché questi test esistono (05/10/2026): il codice in coda al titolo si
// SALVA dentro `workouts.title`, che è letto da tutta l'app e dalla web app.
// Le due regressioni che non danno nessun errore sono un codice che si accoda
// a quello vecchio a ogni salvataggio («· EM 30′ @8 · EM 30′ @8») e un nome
// generato che, riaperto, diventa testo fisso e smette di seguire i blocchi.

const EMOM = {
  category: 'Hyrox', intensity: '5',
  blocks: [{
    id: 'b1', type: 'EMOM', params: { interval: '1:00', rounds: '30' },
    exercises: [{ id: 'e1', name: 'Wall Balls', reps: '20', intensity: '8' }],
  }],
}

const ctrl = await vi.hoisted(async () => ({ stato: {} }))
const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  return fintoSupabase(() => ({ workouts: ctrl.stato.workouts }))
})
vi.mock('../../supabaseClient', () => ({ supabase: finto.supabase }))

const CreateWorkout = (await import('../CreateWorkout')).default

async function duplica(title) {
  ctrl.stato.workouts = [{ id: 'w1', title, date: '2026-10-01', sections: EMOM, coach_notes: '' }]
  finto.chiamate.length = 0
  render(<MemoryRouter initialEntries={['/create?duplicate=w1']}><CreateWorkout /></MemoryRouter>)
  await waitFor(() => expect(document.querySelector('[data-codice]')).toHaveTextContent('EM 30′ @8'))
}

const titoloSalvato = async () => {
  await userEvent.click(screen.getByRole('button', { name: /Salva workout/ }))
  await waitFor(() => expect(finto.chiamateA('workouts', 'insert')).toHaveLength(1))
  return finto.chiamateA('workouts', 'insert')[0].args[0].title
}

describe('il codice nel titolo salvato', () => {
  // ⚠️ Il finto Supabase non filtra per data: l'originale risulta già presente
  // «quel giorno», ed è proprio il caso della numerazione. Il «(2)» va sul
  // NOME, prima del codice — accodato al titolo intero romperebbe `separaCodice`.
  it('un nome generato riaperto resta generato, si numera, e il codice non si raddoppia', async () => {
    await duplica('Wall Balls · EM 30′ @8')
    expect(screen.getByRole('button', { name: 'Modifica nome e data' })).toHaveTextContent('Wall Balls')
    expect(await titoloSalvato()).toBe('Wall Balls (2) · EM 30′ @8')
  })

  it('un nome scritto si tiene, perde il codice vecchio e prende quello nuovo', async () => {
    await duplica('Gambe dure · AM 10′ @3')
    expect(await titoloSalvato()).toBe('Gambe dure (Copia) · EM 30′ @8')
  })
})
