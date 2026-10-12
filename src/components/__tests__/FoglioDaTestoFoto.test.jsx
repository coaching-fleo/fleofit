import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// La foto in «Da un testo scritto» (fasi 2 e 3, 12/10/2026). L'OCR vero è nativo
// (LettoreTesto.swift su iOS, LettoreTestoPlugin.java su Android) e qui non gira: si simula il plugin e si
// verifica quello che il foglio ne fa — il testo letto finisce nel campo,
// modificabile, e da lì nella stessa anteprima del testo incollato.

let mockDisponibile = true
let mockPiattaforma = 'ios'

vi.mock('@capacitor/core', async (originale) => ({
  ...(await originale()),
  Capacitor: { isNativePlatform: () => true, getPlatform: () => mockPiattaforma },
}))
let mockLetto = () => Promise.resolve('')

vi.mock('../../lib/lettoreTesto', () => ({
  fotoDisponibile: () => mockDisponibile,
  leggiFoto: (...a) => mockLetto(...a),
}))
// jsdom non ha un canvas vero: la riduzione si salta.
vi.mock('../../lib/immagineRidotta', () => ({
  riduciImmagine: () => Promise.resolve({ nome: 'foto.jpg', base64: 'AAAA' }),
}))

const FoglioDaTesto = (await import('../FoglioDaTesto')).default

const monta = () => render(<FoglioDaTesto categoria="Hyrox" onUsa={() => {}} onClose={() => {}} />)
const scatta = () => fireEvent.change(screen.getByLabelText('Foto del workout'), {
  target: { files: [new File(['x'], 'lavagna.jpg', { type: 'image/jpeg' })] },
})

beforeEach(() => {
  mockDisponibile = true
  mockPiattaforma = 'ios'
  mockLetto = () => Promise.resolve('')
})

describe('la foto del workout', () => {
  it('senza il plugin (web, o un\'app vecchia) il bottone non c’è', () => {
    mockDisponibile = false
    monta()
    expect(screen.queryByRole('button', { name: /Fotografa/ })).toBeNull()
    expect(screen.queryByLabelText('Foto del workout')).toBeNull()
  })

  it('su iOS un bottone solo: il sistema offre da sé scatto e galleria', () => {
    monta()
    expect(screen.getByRole('button', { name: /Fotografa o scegli una foto/ })).toBeInTheDocument()
    expect(screen.queryByLabelText('Scatto del workout')).toBeNull()
  })

  it('🔴 su Android due bottoni: senza `capture` la webview apre solo la galleria', () => {
    mockPiattaforma = 'android'
    monta()
    expect(screen.getByRole('button', { name: /Scatta una foto/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Dalla galleria/ })).toBeInTheDocument()
    expect(screen.getByLabelText('Scatto del workout')).toHaveAttribute('capture', 'environment')
    expect(screen.getByLabelText('Foto del workout')).not.toHaveAttribute('capture')
  })

  it('il testo letto entra nel campo e diventa blocchi', async () => {
    mockLetto = vi.fn(() => Promise.resolve("EMOM 12'\n12 burpees"))
    monta()
    scatta()
    await waitFor(() => expect(screen.getByLabelText('Il workout scritto')).toHaveValue("EMOM 12'\n12 burpees"))
    expect(mockLetto).toHaveBeenCalledWith('AAAA')
    expect(screen.getByText(/controlla e correggi/)).toBeInTheDocument()
    expect(screen.getByText('1 blocco · 1 esercizio')).toBeInTheDocument()
  })

  it('una seconda foto si aggiunge in coda, non cancella la prima', async () => {
    mockLetto = () => Promise.resolve('AMRAP 10')
    monta()
    fireEvent.change(screen.getByLabelText('Il workout scritto'), { target: { value: "EMOM 12'" } })
    scatta()
    await waitFor(() => expect(screen.getByLabelText('Il workout scritto')).toHaveValue("EMOM 12'\nAMRAP 10"))
  })

  it('una foto senza testo lo dice, e il campo resta com’era', async () => {
    mockLetto = () => Promise.resolve('   ')
    monta()
    scatta()
    expect(await screen.findByRole('alert')).toHaveTextContent(/non ho trovato testo/)
    expect(screen.getByLabelText('Il workout scritto')).toHaveValue('')
  })

  it('se il plugin fallisce lo dice, senza il messaggio grezzo', async () => {
    mockLetto = () => Promise.reject(new Error('VNErrorDomain 9'))
    monta()
    scatta()
    const avviso = await screen.findByRole('alert')
    expect(avviso).toHaveTextContent(/Non sono riuscito a leggere la foto/)
    expect(avviso).not.toHaveTextContent('VNError')
  })
})
