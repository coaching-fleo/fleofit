import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route } from 'react-router-dom'
import { Footprints } from 'lucide-react'
import { montaPagina } from '../../test/montaPagina'

// La card «Dagli Extra» in Home (spec 2026-11-12 §3): un avviso solo, il più
// importante; «+N» porta alla sezione; la X lo chiude.

const scarpe = { id: 'scarpe', nome: 'Scarpe da corsa', icona: Footprints, rotta: '/scarpe' }
const dati = await vi.hoisted(async () => ({ stato: null, chiudi: null }))
vi.mock('../../useAvvisiExtra', () => ({ useAvvisiExtra: () => dati.stato }))

const DagliExtra = (await import('../DagliExtra')).default

const monta = (role = 'athlete') => montaPagina(
  <Routes>
    <Route path="/" element={<DagliExtra />} />
    <Route path="/scarpe" element={<p>pagina scarpe</p>} />
    <Route path="/extra" element={<p>sezione extra</p>} />
    <Route path="/archive" element={<p>libreria</p>} />
  </Routes>,
  { role, percorso: '/', rotta: '*' },
)

describe('DagliExtra', () => {
  beforeEach(() => {
    dati.chiudi = vi.fn()
    dati.stato = {
      primo: { extra: scarpe, avviso: { chiave: 'cambia:s1', testo: 'Pegasus è da cambiare', priorita: 'alta' } },
      altri: 1, aperti: new Set(['scarpe']), chiudi: dati.chiudi,
    }
  })

  it('mostra l\'avviso e «+1 negli Extra»', () => {
    monta()
    expect(screen.getByText('Pegasus è da cambiare')).toBeInTheDocument()
    expect(screen.getByText('+1 negli Extra')).toBeInTheDocument()
  })
  it('«+1» porta a /extra per l\'atleta', async () => {
    monta()
    await userEvent.click(screen.getByText('+1 negli Extra'))
    expect(screen.getByText('sezione extra')).toBeInTheDocument()
  })
  it('«+1» porta alla Libreria su Extra per il coach', async () => {
    monta('coach')
    await userEvent.click(screen.getByText('+1 negli Extra'))
    expect(screen.getByText('libreria')).toBeInTheDocument()
  })
  it('il tocco apre l\'extra', async () => {
    monta()
    await userEvent.click(screen.getByText('Pegasus è da cambiare'))
    expect(screen.getByText('pagina scarpe')).toBeInTheDocument()
  })
  it('la X chiude quell\'avviso', async () => {
    monta()
    await userEvent.click(screen.getByRole('button', { name: "Chiudi l'avviso" }))
    expect(dati.chiudi).toHaveBeenCalledWith('scarpe', 'cambia:s1')
  })
  it('nessun avviso: niente nel DOM', () => {
    dati.stato = { primo: null, altri: 0, aperti: new Set(), chiudi: dati.chiudi }
    const { container } = monta()
    expect(container).toBeEmptyDOMElement()
  })
})
