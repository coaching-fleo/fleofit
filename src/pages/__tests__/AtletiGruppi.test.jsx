import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { montaPagina, UTENTE } from '../../test/montaPagina'

// Gruppi di atleti dalla pagina Atleti (16/11/2026): il bottone «Gruppi» c'è
// solo con la tabella, e il foglio crea, modifica ed elimina scrivendo gli id
// giusti — un gruppo con un id sbagliato assegnerebbe il workout alla persona
// sbagliata senza nessun errore.

const dati = await vi.hoisted(async () => ({ atleti: [], gruppi: [], guasti: [] }))
const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  return fintoSupabase(() => ({
    athletes: dati.atleti,
    athlete_workouts: [],
    gruppi_atleti: dati.gruppi,
  }), { erroreSu: () => dati.guasti, codiceErrore: 'PGRST205' })
})
vi.mock('../../supabaseClient', () => ({ supabase: finto.supabase }))

const Athletes = (await import('../Athletes')).default

const A = (id, name, surname) => ({ id, name, surname, notes: '', deleted_at: null })
const G = (id, nome, atleti) => ({ id, coach: UTENTE.id, nome, atleti, creato_at: '2026-11-01T00:00:00Z' })

beforeEach(() => {
  finto.chiamate.length = 0
  dati.atleti = [A('u1', 'Marco', 'Rossi'), A('u2', 'Sara', 'Villa'), A('u3', 'Luca', 'Bianchi')]
  dati.gruppi = [G('g1', 'Hyrox martedì', ['u1', 'u2', 'sparito'])]
  dati.guasti = []
})

const monta = () => montaPagina(<Athletes />, { role: 'admin' })
const apriFoglio = async () => {
  monta()
  await userEvent.click(await screen.findByRole('button', { name: 'Gruppi' }))
  return within(await screen.findByRole('dialog', { name: 'I tuoi gruppi' }))
}

describe('il bottone «Gruppi»', () => {
  it('c\'è per il coach con la tabella', async () => {
    monta()
    expect(await screen.findByRole('button', { name: 'Gruppi' })).toBeInTheDocument()
  })
  it('non c\'è con la tabella assente, e nessun alert', async () => {
    dati.guasti = ['gruppi_atleti']
    monta()
    await screen.findByText('Marco Rossi')
    expect(screen.queryByRole('button', { name: 'Gruppi' })).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('il foglio «I tuoi gruppi»', () => {
  it('elenca i gruppi contando solo gli atleti visibili', async () => {
    const f = await apriFoglio()
    expect(f.getByRole('button', { name: 'Hyrox martedì, 2 atleti' })).toBeInTheDocument()
  })

  it('«Nuovo gruppo» crea con nome trimmato e gli id scelti', async () => {
    const f = await apriFoglio()
    await userEvent.click(f.getByRole('button', { name: /Nuovo gruppo/ }))
    const d = within(await screen.findByRole('dialog', { name: 'Nuovo gruppo' }))
    await userEvent.type(d.getByRole('textbox', { name: 'Nome del gruppo' }), '  Corsa  ')
    await userEvent.click(d.getByRole('button', { name: /Luca Bianchi/ }))
    await userEvent.click(d.getByRole('button', { name: /Marco Rossi/ }))
    await userEvent.click(d.getByRole('button', { name: 'Salva' }))
    await waitFor(() => expect(finto.chiamateA('gruppi_atleti', 'insert')).toHaveLength(1))
    // l'ordine è quello della lista della pagina, non quello dei tocchi
    expect(finto.chiamateA('gruppi_atleti', 'insert')[0].args[0]).toEqual({ coach: UTENTE.id, nome: 'Corsa', atleti: ['u1', 'u3'] })
  })

  it('nome doppio: l\'errore resta nel foglio, nessuna insert', async () => {
    const f = await apriFoglio()
    await userEvent.click(f.getByRole('button', { name: /Nuovo gruppo/ }))
    const d = within(await screen.findByRole('dialog', { name: 'Nuovo gruppo' }))
    await userEvent.type(d.getByRole('textbox', { name: 'Nome del gruppo' }), 'HYROX MARTEDÌ')
    await userEvent.click(d.getByRole('button', { name: 'Salva' }))
    expect(d.getByRole('alert')).toHaveTextContent('Hai già un gruppo con questo nome.')
    expect(finto.chiamateA('gruppi_atleti', 'insert')).toHaveLength(0)
  })

  it('modifica: togliere un atleta e salvare manda gli id rimasti (e fa uscire chi non si vede più)', async () => {
    const f = await apriFoglio()
    await userEvent.click(f.getByRole('button', { name: /^Hyrox martedì/ }))
    const d = within(await screen.findByRole('dialog', { name: 'Modifica gruppo' }))
    expect(d.getByRole('textbox', { name: 'Nome del gruppo' })).toHaveValue('Hyrox martedì')
    await userEvent.click(d.getByRole('button', { name: /Sara Villa/ }))
    await userEvent.click(d.getByRole('button', { name: 'Salva' }))
    await waitFor(() => expect(finto.chiamateA('gruppi_atleti', 'update')).toHaveLength(1))
    expect(finto.chiamateA('gruppi_atleti', 'update')[0].args[0]).toMatchObject({ nome: 'Hyrox martedì', atleti: ['u1'] })
  })

  it('«Elimina gruppo» chiede conferma, poi cancella', async () => {
    const f = await apriFoglio()
    await userEvent.click(f.getByRole('button', { name: /^Hyrox martedì/ }))
    const d = within(await screen.findByRole('dialog', { name: 'Modifica gruppo' }))
    await userEvent.click(d.getByRole('button', { name: 'Elimina gruppo' }))
    expect(finto.chiamateA('gruppi_atleti', 'delete')).toHaveLength(0)
    const conferma = within(screen.getByRole('dialog', { name: 'Elimina gruppo' }))
    await userEvent.click(conferma.getByRole('button', { name: 'Elimina' }))
    await waitFor(() => expect(finto.chiamateA('gruppi_atleti', 'delete')).toHaveLength(1))
    expect(finto.chiamateA('gruppi_atleti', 'eq').at(-1).args).toEqual(['id', 'g1'])
  })
})
