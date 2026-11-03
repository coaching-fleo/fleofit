import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

const mocks = vi.hoisted(() => ({ leggiScarpeAtleta: vi.fn(), elencoCatalogo: vi.fn() }))
vi.mock('../../lib/scarpeDb', () => ({
  leggiScarpeAtleta: mocks.leggiScarpeAtleta,
  elencoCatalogo: mocks.elencoCatalogo,
  tabelleAssenti: (e) => !!e && (e.code === '42P01' || e.code === 'PGRST205'),
}))
vi.mock('../../lib/aptica', () => ({ vibraScelta: vi.fn() }))

import BannerScarpe from '../BannerScarpe'

const scarpa = { id: 's', catalogo_id: 'm', marca: 'Nike', modello: 'Pegasus', principale: true, ritirata_at: null, km: 50, stato: 'ok' }
beforeEach(() => {
  mocks.leggiScarpeAtleta.mockReset(); mocks.elencoCatalogo.mockReset()
  mocks.elencoCatalogo.mockResolvedValue([{ id: 'm', marca: 'Nike', modello: 'Pegasus', foto_url: 'http://x/f.png', tipo: 'gara' }])
})

describe('BannerScarpe', () => {
  it('tabelle assenti: non rende niente', async () => {
    mocks.leggiScarpeAtleta.mockRejectedValue({ code: '42P01' })
    const { container } = render(<BannerScarpe ruolo="atleta" uid="u" onApri={() => {}} />)
    await waitFor(() => expect(mocks.leggiScarpeAtleta).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 10))
    expect(container.innerHTML).toBe('')
  })
  it('senza uid (atleta) non legge e non rende', () => {
    const { container } = render(<BannerScarpe ruolo="atleta" onApri={() => {}} />)
    expect(container.innerHTML).toBe('')
    expect(mocks.leggiScarpeAtleta).not.toHaveBeenCalled()
  })
  it('con dati: titolo come intestazione, il tocco chiama onApri', async () => {
    mocks.leggiScarpeAtleta.mockResolvedValue({ disponibile: true, scarpe: [scarpa] })
    const onApri = vi.fn()
    render(<BannerScarpe ruolo="atleta" uid="u" onApri={onApri} />)
    expect(await screen.findByRole('heading', { name: 'Pegasus · 50 km' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Pegasus · 50 km' }))
    expect(onApri).toHaveBeenCalled()
    expect(screen.getByText('Le mie scarpe')).toBeTruthy()
  })
  it('catalogo che fallisce: il banner c\'è comunque, col disegno', async () => {
    mocks.leggiScarpeAtleta.mockResolvedValue({ disponibile: true, scarpe: [scarpa] })
    mocks.elencoCatalogo.mockRejectedValue(new Error('boom'))
    const { container } = render(<BannerScarpe ruolo="atleta" uid="u" onApri={() => {}} />)
    await screen.findByRole('heading')
    expect(container.querySelector('img[data-disegno]')).toBeTruthy()
  })
  it('foto rotta: resta il disegno', async () => {
    mocks.leggiScarpeAtleta.mockResolvedValue({ disponibile: true, scarpe: [scarpa] })
    const { container } = render(<BannerScarpe ruolo="atleta" uid="u" onApri={() => {}} />)
    await screen.findByRole('heading')
    fireEvent.error(container.querySelector('img'))
    expect(container.querySelector('img[data-disegno]')).toBeTruthy()
  })
  it('coach: legge solo il catalogo', async () => {
    mocks.elencoCatalogo.mockResolvedValue([{ id: 'm', marca: 'Nike', modello: 'P', foto_url: 'u', tipo: 'gara' }])
    render(<BannerScarpe ruolo="coach" onApri={() => {}} />)
    expect(await screen.findByRole('heading', { name: 'Il catalogo scarpe · 1 modelli' })).toBeTruthy()
    expect(mocks.leggiScarpeAtleta).not.toHaveBeenCalled()
  })
})
