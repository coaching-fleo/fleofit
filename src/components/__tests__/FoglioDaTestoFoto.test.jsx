import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// Il foglio «Da un'immagine» da solo (12/10/2026): si monta con l'immagine già
// scelta nel builder e la legge subito. L'OCR vero è nativo (LettoreTesto.swift
// su iOS, LettoreTestoPlugin.java su Android) e qui non gira: si simula.

let mockLetto = () => Promise.resolve('')

vi.mock('../../lib/lettoreTesto', () => ({
  fotoDisponibile: () => true,
  leggiFoto: (...a) => mockLetto(...a),
}))
// jsdom non ha un canvas vero: la riduzione si salta.
vi.mock('../../lib/immagineRidotta', () => ({
  riduciImmagine: () => Promise.resolve({ nome: 'foto.jpg', base64: 'AAAA' }),
}))

const FoglioDaTesto = (await import('../FoglioDaTesto')).default

const immagine = () => new File(['x'], 'lavagna.jpg', { type: 'image/jpeg' })
const monta = () => render(<FoglioDaTesto categoria="Hyrox" file={immagine()} onUsa={() => {}} onClose={() => {}} />)

beforeEach(() => {
  mockLetto = () => Promise.resolve('')
})

describe('il foglio legge l’immagine scelta', () => {
  it('appena si apre, e intanto lo dice', async () => {
    let risolvi
    mockLetto = vi.fn(() => new Promise(r => { risolvi = r }))
    monta()
    expect(screen.getByRole('status')).toHaveTextContent("Leggo l'immagine…")
    await waitFor(() => expect(mockLetto).toHaveBeenCalledWith('AAAA'))
    risolvi("EMOM 12'\n12 burpees")
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('1 blocco · 1 esercizio'))
  })

  it('un’altra immagine si aggiunge in coda, non cancella la prima', async () => {
    mockLetto = () => Promise.resolve("EMOM 12'\n12 burpees")
    monta()
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('1 blocco · 1 esercizio'))
    mockLetto = () => Promise.resolve('AMRAP 10\n20 wall balls')
    fireEvent.change(screen.getByLabelText("Un'altra immagine"), { target: { files: [immagine()] } })
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('2 blocchi · 2 esercizi'))
  })

  it('un’immagine senza testo lo dice', async () => {
    mockLetto = () => Promise.resolve('   ')
    monta()
    expect(await screen.findByRole('alert')).toHaveTextContent(/non ho trovato testo/)
    expect(screen.getByRole('button', { name: /Scegli un'altra immagine/ })).toBeInTheDocument()
  })

  it('se il plugin fallisce lo dice, senza il messaggio grezzo', async () => {
    mockLetto = () => Promise.reject(new Error('VNErrorDomain 9'))
    monta()
    const avviso = await screen.findByRole('alert')
    expect(avviso).toHaveTextContent(/Non sono riuscito a leggere l'immagine/)
    expect(avviso).not.toHaveTextContent('VNError')
  })
})
