import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import { montaPagina } from '../../test/montaPagina'

// La barra e gli Extra (spec 2026-11-12 §1): l'atleta ha la voce Extra solo con
// almeno un extra acceso, prima di Profilo; il coach ha «Libreria» al posto di
// «Archivio», senza pallino.

const dati = await vi.hoisted(async () => ({ extra: [], aperti: new Set() }))
vi.mock('../../useExtra', () => ({ useExtra: () => dati.extra }))
const avvisi = vi.hoisted(() => ({ chiamate: 0 }))
vi.mock('../../useAvvisiExtra', () => ({
  useAvvisiExtra: () => { avvisi.chiamate += 1; return { primo: null, altri: 0, aperti: dati.aperti, chiudi: () => {} } },
}))

const Navbar = (await import('../Navbar')).default

const voci = () => within(screen.getByRole('navigation', { name: 'Navigazione principale' }))
  .getAllByRole('link').map(l => l.getAttribute('aria-label') || l.textContent)

describe('Navbar ed Extra', () => {
  beforeEach(() => { dati.extra = []; dati.aperti = new Set(); avvisi.chiamate = 0 })

  it('atleta, tutto spento: quattro voci', () => {
    montaPagina(<Navbar />)
    expect(voci()).toEqual(['Home', 'Storico', 'Calendario', 'Profilo'])
  })
  it('atleta, mentre si legge: niente voce Extra', () => {
    dati.extra = null
    montaPagina(<Navbar />)
    expect(voci()).toEqual(['Home', 'Storico', 'Calendario', 'Profilo'])
  })
  it('atleta, un extra acceso: Extra prima di Profilo', () => {
    dati.extra = [{ id: 'scarpe' }]
    montaPagina(<Navbar />)
    expect(voci()).toEqual(['Home', 'Storico', 'Calendario', 'Extra', 'Profilo'])
    expect(screen.getByRole('link', { name: 'Extra' })).toHaveAttribute('href', '/extra')
  })
  it('atleta con un avviso aperto: la voce ha il pallino', () => {
    dati.extra = [{ id: 'scarpe' }]
    dati.aperti = new Set(['scarpe'])
    montaPagina(<Navbar />)
    expect(screen.getByRole('link', { name: 'Extra, novità' })).toHaveAttribute('href', '/extra')
  })
  it('coach: «Libreria» su /archive, senza pallino anche con avvisi', () => {
    dati.extra = [{ id: 'scarpe' }]
    dati.aperti = new Set(['scarpe'])
    montaPagina(<Navbar />, { role: 'coach' })
    expect(screen.getByRole('link', { name: 'Libreria' })).toHaveAttribute('href', '/libreria')
    expect(screen.queryByText('Archivio')).toBeNull()
    expect(screen.queryByRole('link', { name: /novità/ })).toBeNull()
  })
  it('coach: «Libreria» resta accesa dentro le sue voci (archivio, modelli, un extra)', () => {
    dati.extra = [{ id: 'scarpe', rotta: '/scarpe' }]
    for (const percorso of ['/archive', '/modelli', '/scarpe/modello/3']) {
      const { unmount } = montaPagina(<Navbar />, { role: 'coach', percorso })
      expect(screen.getByRole('link', { name: 'Libreria' })).toHaveClass('text-brand')
      unmount()
    }
    montaPagina(<Navbar />, { role: 'coach', percorso: '/calendar' })
    expect(screen.getByRole('link', { name: 'Libreria' })).not.toHaveClass('text-brand')
  })
  it('coach: la barra non legge gli avvisi (non li mostra)', () => {
    dati.extra = [{ id: 'scarpe' }]
    montaPagina(<Navbar />, { role: 'coach' })
    expect(avvisi.chiamate).toBe(0)
  })
})
