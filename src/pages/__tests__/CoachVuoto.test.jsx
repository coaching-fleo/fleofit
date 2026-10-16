import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { montaPagina } from '../../test/montaPagina'

// Perché questi test esistono
// ────────────────────────────
// Un coach appena aggiunto non ha atleti, workout né messaggi: la RLS gli
// restituisce liste vuote ovunque. Le pagine coach sono state scritte per
// l'admin, che ha sempre dati; qui si verifica che col ruolo `coach` e tutto
// vuoto non lancino e mostrino lo stato vuoto invece di una pagina rotta.

const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  return fintoSupabase(() => ({}))
})
vi.mock('../../supabaseClient', () => ({ supabase: finto.supabase }))
vi.mock('@capacitor/network', () => ({
  Network: {
    getStatus: vi.fn(() => Promise.resolve({ connected: true })),
    addListener: vi.fn(() => Promise.resolve({ remove: vi.fn() })),
  },
}))

const Home = (await import('../Home')).default
const Athletes = (await import('../Athletes')).default
const Messaggi = (await import('../Messaggi')).default

beforeEach(() => { window.localStorage.clear() })

describe('un coach senza dati', () => {
  it('Atleti: mostra «Nessun atleta ancora»', async () => {
    montaPagina(<Athletes />, { role: 'coach' })
    expect(await screen.findByText('Nessun atleta ancora')).toBeTruthy()
  })

  it('Home: la testata dell\'atleta non c\'è, c\'è il cruscotto coach vuoto', async () => {
    montaPagina(<Home />, { role: 'coach' })
    expect(await screen.findByText('Nessun atleta da programmare.')).toBeTruthy()
    expect(screen.queryByText(/Buongiorno|Buon pomeriggio|Buonasera/)).toBeNull()
  })

  it('Messaggi: bacheca vuota, stato vuoto', async () => {
    montaPagina(<Messaggi />, { role: 'coach' })
    expect(await screen.findByText('Qui troverai i messaggi del coach')).toBeTruthy()
  })
})
