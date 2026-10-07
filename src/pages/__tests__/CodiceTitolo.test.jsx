import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { candidatiNome, eNomeGenerato } from '../../lib/nomeCasuale'
import { separaCodice } from '../../lib/codiceWorkout'

// Perché questi test esistono (05/10/2026): il codice in coda al titolo si
// SALVA dentro `workouts.title`, che è letto da tutta l'app e dalla web app.
// Le regressioni che non danno nessun errore sono un codice che si accoda a
// quello vecchio a ogni salvataggio («· EM 30′ @8 · EM 30′ @8») e, dal
// 07/10/2026, un nome generato che passa uguale da un workout all'altro (la
// copia che si chiama come l'originale) o che cambia a ogni modifica.

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

async function apri(title, modo = 'duplicate') {
  ctrl.stato.workouts = [{ id: 'w1', title, date: '2026-10-01', sections: EMOM, coach_notes: '' }]
  finto.chiamate.length = 0
  render(<MemoryRouter initialEntries={[`/create?${modo}=w1`]}><CreateWorkout /></MemoryRouter>)
  await waitFor(() => expect(document.querySelector('[data-codice]')).toHaveTextContent('EM 30′ @8'))
}
const duplica = (title) => apri(title)
const testata = () => screen.getByRole('button', { name: 'Modifica nome e data' })

const titoloSalvato = async () => {
  await userEvent.click(screen.getByRole('button', { name: /Salva workout/ }))
  await waitFor(() => expect(finto.chiamateA('workouts', 'insert')).toHaveLength(1))
  return finto.chiamateA('workouts', 'insert')[0].args[0].title
}

const salvaComeNuovo = async () => {
  await userEvent.click(screen.getByRole('button', { name: /Salva workout/ }))
  await userEvent.click(await screen.findByRole('button', { name: 'Salva come nuovo' }))
  await userEvent.click(screen.getByRole('button', { name: 'Conferma' }))
  await waitFor(() => expect(finto.chiamateA('workouts', 'insert')).toHaveLength(1))
  return finto.chiamateA('workouts', 'insert')[0].args[0].title
}

const CANDIDATI = candidatiNome(EMOM)
const GENERATO = 'Wall Ball Burner'

describe('il nome generato dai blocchi', () => {
  it('il nome di prova è davvero un candidato di questo workout', () => {
    expect(CANDIDATI).toContain(GENERATO)
  })

  it('una copia ne prende uno NUOVO, e il codice non si raddoppia', async () => {
    await duplica('Wall Ball Burner · EM 30′ @8')
    // La testata può anche proporre lo stesso nome (il seme è casuale): conta
    // che al salvataggio, già preso dall'originale, se ne scelga un altro.
    const { nome, codice } = separaCodice(await titoloSalvato())
    expect(eNomeGenerato(nome, CANDIDATI)).toBe(true)
    expect(nome).not.toBe('Wall Ball Burner')
    expect(codice).toBe('EM 30′ @8')
  })

  it('in modifica resta quello già salvato, anche se il workout stesso «lo usa»', async () => {
    await apri('Wall Ball Burner · EM 30′ @8', 'edit')
    expect(testata()).toHaveTextContent('Wall Ball Burner')
    await userEvent.click(screen.getByRole('button', { name: /Salva workout/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Sovrascrivi esistente' }))
    await waitFor(() => expect(finto.chiamateA('workouts', 'update')).toHaveLength(1))
    expect(finto.chiamateA('workouts', 'update')[0].args[0].title).toBe('Wall Ball Burner · EM 30′ @8')
  })

  it('«Salva come nuovo» da una modifica non riusa il nome dell originale', async () => {
    await apri('Wall Ball Burner · EM 30′ @8', 'edit')
    const { nome } = separaCodice(await salvaComeNuovo())
    expect(eNomeGenerato(nome, CANDIDATI)).toBe(true)
    expect(nome).not.toBe('Wall Ball Burner')
  })
})

describe('il codice nel titolo salvato', () => {
  it('un nome scritto si tiene, perde il codice vecchio e prende quello nuovo', async () => {
    await duplica('Gambe dure · AM 10′ @3')
    expect(await titoloSalvato()).toBe('Gambe dure (Copia) · EM 30′ @8')
  })
})
