import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route } from 'react-router-dom'
import { Footprints } from 'lucide-react'
import { montaPagina } from '../../test/montaPagina'

// La Libreria del coach (12/11/2026, richiesta del committente): la voce della
// barra apre un MENÙ, non l'archivio. Voci fisse Archivio e Modelli, poi un
// extra per ogni interruttore acceso (dal registro src/lib/extra.js).

const dati = await vi.hoisted(async () => ({ extra: [], aperti: new Set(), riga: null }))
const scarpe = {
  id: 'scarpe', nome: 'Scarpe da corsa', icona: Footprints, interruttore: 'scarpe', rotta: '/scarpe',
  ruoli: ['athlete', 'coach'], descrizione: { athlete: 'I km delle tue scarpe', coach: 'Il catalogo dei modelli' },
  stato: () => Promise.resolve(async () => dati.riga),
}
vi.mock('../../useExtra', () => ({ useExtra: () => dati.extra }))
vi.mock('../../useAvvisiExtra', () => ({
  useAvvisiExtra: () => ({ primo: null, altri: 0, aperti: dati.aperti, chiudi: () => {} }),
}))

const Libreria = (await import('../Libreria')).default

const monta = (role = 'coach') => montaPagina(
  <Routes>
    <Route path="/libreria" element={<Libreria />} />
    <Route path="/archive" element={<p>pagina archivio</p>} />
    <Route path="/modelli" element={<p>pagina modelli</p>} />
    <Route path="/scarpe" element={<p>pagina scarpe</p>} />
    <Route path="/" element={<p>home</p>} />
  </Routes>,
  { role, percorso: '/libreria', rotta: '*' },
)
const voci = () => screen.getAllByRole('button').map(b => b.getAttribute('aria-label') || b.querySelector('p')?.textContent)

describe('Libreria', () => {
  beforeEach(() => { dati.extra = [scarpe]; dati.aperti = new Set(); dati.riga = null })

  it('il menù: Archivio, Modelli, poi gli extra accesi', () => {
    monta()
    expect(screen.getByRole('heading', { name: 'Libreria' })).toBeInTheDocument()
    expect(voci()).toEqual(['Archivio', 'Modelli', 'Scarpe da corsa'])
  })
  it('tutti gli extra spenti: restano Archivio e Modelli', () => {
    dati.extra = []
    monta()
    expect(voci()).toEqual(['Archivio', 'Modelli'])
  })
  it('mentre si leggono gli interruttori: le voci fisse ci sono già', () => {
    dati.extra = null
    monta()
    expect(voci()).toEqual(['Archivio', 'Modelli'])
  })
  it('ogni voce apre la sua pagina', async () => {
    monta()
    await userEvent.click(screen.getByText('Archivio'))
    expect(screen.getByText('pagina archivio')).toBeInTheDocument()
  })
  it('Modelli apre i modelli', async () => {
    monta()
    await userEvent.click(screen.getByText('Modelli'))
    expect(screen.getByText('pagina modelli')).toBeInTheDocument()
  })
  it('l\'extra: riga viva, pallino con un avviso, tocco alla sua pagina', async () => {
    dati.riga = '12 modelli'
    dati.aperti = new Set(['scarpe'])
    monta()
    expect(await screen.findByText('12 modelli')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Scarpe da corsa, novità' }))
    expect(screen.getByText('pagina scarpe')).toBeInTheDocument()
  })
  it('senza riga viva: la descrizione del coach', () => {
    monta()
    expect(screen.getByText('Il catalogo dei modelli')).toBeInTheDocument()
  })
  it('l\'atleta non ha la Libreria: torna alla Home', () => {
    monta('athlete')
    expect(screen.getByText('home')).toBeInTheDocument()
  })
})
