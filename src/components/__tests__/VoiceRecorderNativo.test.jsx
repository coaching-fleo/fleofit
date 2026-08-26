import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Perché questo test esiste
// ──────────────────────────
// 🔴 Un guasto vero, misurato sul database il 26/08/2026: le note vocali
// registrate dall'app uscivano VUOTE — un contenitore MP4 di 557 byte, solo
// intestazione e nessun campione audio. L'utente vedeva la forma d'onda
// muoversi e poi non sentiva niente.
//
// La causa: sul ramo nativo l'app apriva il microfono DUE VOLTE — getUserMedia
// per disegnare l'onda, e NativeVoiceRecorder per registrare davvero. Su iOS
// si contendono la sessione audio, e a perdere è la registrazione.
//
// Era intermittente e preesistente: il 22/08 il bucket conteneva un file pieno
// (619 KB) e uno da zero byte a un secondo di distanza.
//
// Questo test tiene chiusa la porta: su nativo getUserMedia NON si chiama.

const nativo = vi.hoisted(() => ({ valore: true }))
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => nativo.valore, getPlatform: () => 'ios' },
  registerPlugin: () => new Proxy({}, { get: () => vi.fn(() => Promise.resolve({ value: null })) }),
}))

const registratoreNativo = vi.hoisted(() => ({
  hasAudioRecordingPermission: vi.fn(() => Promise.resolve({ value: true })),
  requestAudioRecordingPermission: vi.fn(() => Promise.resolve({ value: true })),
  startRecording: vi.fn(() => Promise.resolve()),
  stopRecording: vi.fn(() => Promise.resolve({ value: null })),
}))
vi.mock('@independo/capacitor-voice-recorder', () => ({ VoiceRecorder: registratoreNativo }))

const VoiceRecorder = (await import('../VoiceRecorder')).default

const getUserMedia = vi.fn(() => Promise.resolve({ getTracks: () => [] }))

beforeEach(() => {
  nativo.valore = true
  vi.clearAllMocks()
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true })
})

describe('su iOS il microfono si apre una volta sola', () => {
  it('NON chiama getUserMedia: lo vuole NativeVoiceRecorder in esclusiva', async () => {
    render(<VoiceRecorder onSave={vi.fn()} onCancel={vi.fn()} />)
    await userEvent.click(screen.getByText(/Tocca per registrare/i))

    await waitFor(() => expect(registratoreNativo.startRecording).toHaveBeenCalled())
    expect(getUserMedia).not.toHaveBeenCalled()
  })

  it('e mostra comunque un\'animazione mentre registra', async () => {
    // Il contraltare: rinunciare all'onda vera non deve lasciare la barra vuota,
    // o l'utente non sa se sta registrando.
    render(<VoiceRecorder onSave={vi.fn()} onCancel={vi.fn()} />)
    await userEvent.click(screen.getByText(/Tocca per registrare/i))

    await waitFor(() => expect(screen.getByLabelText(/Ferma e salva/i)).toBeInTheDocument())
    expect(document.querySelectorAll('.animate-bounce').length).toBeGreaterThan(0)
  })
})

describe('sul web invece serve, ed è l unico modo di registrare', () => {
  it('chiama getUserMedia', async () => {
    nativo.valore = false
    window.MediaRecorder = vi.fn(() => ({ start: vi.fn(), stop: vi.fn(), state: 'recording' }))

    render(<VoiceRecorder onSave={vi.fn()} onCancel={vi.fn()} />)
    await userEvent.click(screen.getByText(/Tocca per registrare/i))

    await waitFor(() => expect(getUserMedia).toHaveBeenCalled())
    expect(registratoreNativo.startRecording).not.toHaveBeenCalled()
  })
})
