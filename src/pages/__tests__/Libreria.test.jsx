import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route, useLocation } from 'react-router-dom'
import { montaPagina } from '../../test/montaPagina'

// La Libreria del coach (spec 2026-11-12 §1): l'Archivio col selettore
// «Workout · Extra», che parte su Workout e si ricorda nell'indirizzo
// (`?vista=extra`), così tornando da un extra si torna su Extra.

const dati = await vi.hoisted(async () => ({ extra: [{ id: 'scarpe' }] }))
const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  return fintoSupabase(() => ({ workouts: [], athlete_workouts: [] }))
})
vi.mock('../../supabaseClient', () => ({ supabase: finto.supabase }))
vi.mock('../../useExtra', () => ({ useExtra: () => dati.extra }))
vi.mock('../../useAvvisiExtra', () => ({
  useAvvisiExtra: () => ({ primo: null, altri: 0, aperti: new Set(), chiudi: () => {} }),
}))
vi.mock('../Extra', () => ({ default: ({ incorporata }) => <p>griglia extra{incorporata ? ' incorporata' : ''}</p> }))

const WorkoutsArchive = (await import('../WorkoutsArchive')).default

function Indirizzo() {
  const l = useLocation()
  return <output data-testid="indirizzo">{l.pathname + l.search}</output>
}

const monta = (percorso = '/archive', role = 'coach', storico = false) => montaPagina(
  <Routes>
    <Route path="*" element={<><WorkoutsArchive storico={storico} /><Indirizzo /></>} />
  </Routes>,
  { role, percorso, rotta: '*' },
)

describe('Libreria', () => {
  beforeEach(() => { dati.extra = [{ id: 'scarpe' }] })

  it('titolo «Libreria», selettore che parte su Workout', async () => {
    monta()
    expect(screen.getByRole('heading', { name: 'Libreria' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Workout' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByText(/griglia extra/)).toBeNull()
  })
  it('?vista=extra apre la griglia incorporata', async () => {
    monta('/archive?vista=extra')
    expect(await screen.findByText('griglia extra incorporata')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Extra' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByRole('searchbox')).toBeNull()
  })
  it('il tocco su Extra scrive la vista nell\'indirizzo', async () => {
    monta()
    await userEvent.click(screen.getByRole('tab', { name: 'Extra' }))
    expect(screen.getByTestId('indirizzo')).toHaveTextContent('/archive?vista=extra')
    expect(await screen.findByText('griglia extra incorporata')).toBeInTheDocument()
  })
  it('arrivati dalla barra, cambiare vista non fa comparire «indietro» né il conteggio dei workout', async () => {
    monta({ pathname: '/archive', state: { daBarra: true } })
    expect(screen.queryByRole('button', { name: 'Torna indietro' })).toBeNull()
    await userEvent.click(screen.getByRole('tab', { name: 'Extra' }))
    expect(await screen.findByText('griglia extra incorporata')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Torna indietro' })).toBeNull()
    expect(screen.queryByText(/workout ·|corsie/)).toBeNull()
  })
  it('ogni tab porta al suo pannello (accessibilità)', async () => {
    monta('/archive?vista=extra')
    const tab = screen.getByRole('tab', { name: 'Extra' })
    const pannello = await screen.findByRole('tabpanel')
    expect(tab.getAttribute('aria-controls')).toBe(pannello.id)
    expect(pannello).toHaveAttribute('aria-labelledby', tab.id)
    expect(pannello).toHaveTextContent('griglia extra')
  })
  it('tutto spento: niente selettore, titolo «Libreria»', () => {
    dati.extra = []
    monta('/archive?vista=extra')
    expect(screen.getByRole('heading', { name: 'Libreria' })).toBeInTheDocument()
    expect(screen.queryByRole('tab')).toBeNull()
    expect(screen.queryByText(/griglia extra/)).toBeNull()
  })
  it('atleta su /storico: niente selettore, titolo invariato', () => {
    monta('/storico', 'athlete', true)
    expect(screen.getByRole('heading', { name: 'Storico' })).toBeInTheDocument()
    expect(screen.queryByRole('tab')).toBeNull()
  })
  it('in modalità TV niente selettore', () => {
    monta('/archive?tv=1234')
    expect(screen.queryByRole('tab')).toBeNull()
  })
})
