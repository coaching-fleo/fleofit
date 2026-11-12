import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route } from 'react-router-dom'
import { Footprints } from 'lucide-react'
import { montaPagina } from '../../test/montaPagina'

// La pagina Extra (spec 2026-11-12 §2): una card per extra acceso, con la riga
// viva o la descrizione del ruolo, il pallino se c'è un avviso aperto.

const dati = await vi.hoisted(async () => ({ extra: null, aperti: new Set(), riga: null }))
const scarpe = {
  id: 'scarpe', nome: 'Scarpe da corsa', icona: Footprints, interruttore: 'scarpe', rotta: '/scarpe',
  ruoli: ['athlete', 'coach'], descrizione: { athlete: 'I km delle tue scarpe', coach: 'Il catalogo dei modelli' },
  stato: () => Promise.resolve(async () => dati.riga),
}
vi.mock('../../useExtra', () => ({ useExtra: () => dati.extra }))
vi.mock('../../useAvvisiExtra', () => ({
  useAvvisiExtra: () => ({ primo: null, altri: 0, aperti: dati.aperti, chiudi: () => {} }),
}))

const Extra = (await import('../Extra')).default

const monta = (role = 'athlete') => montaPagina(
  <Routes>
    <Route path="/extra" element={<Extra />} />
    <Route path="/scarpe" element={<p>pagina scarpe</p>} />
    <Route path="/" element={<p>home</p>} />
  </Routes>,
  { role, percorso: '/extra', rotta: '*' },
)

describe('pagina Extra', () => {
  beforeEach(() => { dati.extra = [scarpe]; dati.aperti = new Set(); dati.riga = null })

  it('atleta: la card con la riga viva', async () => {
    dati.riga = '1 scarpa'
    monta()
    expect(await screen.findByText('1 scarpa')).toBeInTheDocument()
    expect(screen.getByText('Scarpe da corsa')).toBeInTheDocument()
  })
  it('senza riga viva: la descrizione del ruolo', async () => {
    monta()
    expect(await screen.findByText('I km delle tue scarpe')).toBeInTheDocument()
  })
  it('coach: la descrizione del coach', async () => {
    monta('coach')
    expect(await screen.findByText('Il catalogo dei modelli')).toBeInTheDocument()
  })
  it('il tocco apre l\'extra', async () => {
    monta()
    await userEvent.click(await screen.findByRole('button', { name: /Scarpe da corsa/ }))
    expect(await screen.findByText('pagina scarpe')).toBeInTheDocument()
  })
  it('con un avviso aperto la card ha il pallino', async () => {
    dati.aperti = new Set(['scarpe'])
    monta()
    expect(await screen.findByRole('button', { name: /Scarpe da corsa, novità/ })).toBeInTheDocument()
  })
  it('tutto spento: torna alla Home', async () => {
    dati.extra = []
    monta()
    await waitFor(() => expect(screen.getByText('home')).toBeInTheDocument())
  })
})
