import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Perché questo test esiste
// ──────────────────────────
// 🔴 BACKLOG #31. Le note vocali registrate dall'app uscivano VUOTE: un
// contenitore M4A di 557 byte, intestazione e zero campioni. I log dal
// dispositivo (26/08/2026) hanno chiuso la diagnosi:
//
//   VoiceRecorder.hasAudioRecordingPermission → {"value":true}
//   VoiceRecorder.startRecording              → {"value":true}
//   VoiceRecorder.stopRecording               → {"msDuration":0,"uri":"", ...}
//
// Il plugin diceva che era andato tutto bene e restituiva il nulla. WebView e
// recorder nativo si contendono AVAudioSession: togliendo getUserMedia il
// plugin non parte proprio, tenendolo registra vuoto.
//
// Ma getUserMedia FUNZIONA (la forma d'onda si muove), e MediaRecorder è
// disponibile nel WKWebView da iOS 14.5. Da qui la scelta: su iOS si registra
// con MediaRecorder, e il plugin nativo resta solo come ripiego.

const nativo = vi.hoisted(() => ({ valore: true }))
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => nativo.valore, getPlatform: () => 'ios' },
  registerPlugin: () => new Proxy({}, { get: () => vi.fn(() => Promise.resolve({ value: null })) }),
}))

const plugin = vi.hoisted(() => ({
  hasAudioRecordingPermission: vi.fn(() => Promise.resolve({ value: true })),
  requestAudioRecordingPermission: vi.fn(() => Promise.resolve({ value: true })),
  startRecording: vi.fn(() => Promise.resolve({ value: true })),
  stopRecording: vi.fn(() => Promise.resolve({ value: { msDuration: 0, uri: '', recordDataBase64: 'AAAA' } })),
}))
vi.mock('@independo/capacitor-voice-recorder', () => ({ VoiceRecorder: plugin }))

// AudioVisualizer disegna su un <canvas>, e in jsdom getContext('2d') torna null:
// il componente esplode e porta giù tutto il render. Qui si testa il
// REGISTRATORE, non il visualizzatore, quindi lo si sostituisce con un segnaposto.
vi.mock('../AudioVisualizer', () => ({ default: () => null }))

const VoiceRecorder = (await import('../VoiceRecorder')).default

const getUserMedia = vi.fn(() => Promise.resolve({ getTracks: () => [{ stop: vi.fn() }] }))
const registratoreWeb = { start: vi.fn(), stop: vi.fn(), state: 'recording', mimeType: 'audio/mp4' }

beforeEach(() => {
  nativo.valore = true
  vi.clearAllMocks()
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true })
  window.MediaRecorder = vi.fn(() => registratoreWeb)
})

describe('su iOS si registra con MediaRecorder, non col plugin nativo', () => {
  it('non chiama startRecording del plugin', async () => {
    render(<VoiceRecorder onSave={vi.fn()} onCancel={vi.fn()} />)
    await userEvent.click(screen.getByText(/Tocca per registrare/i))

    await waitFor(() => expect(window.MediaRecorder).toHaveBeenCalled())
    expect(plugin.startRecording).not.toHaveBeenCalled()
  })

  it('ma il microfono lo apre lo stesso, che serve anche alla forma d onda', async () => {
    render(<VoiceRecorder onSave={vi.fn()} onCancel={vi.fn()} />)
    await userEvent.click(screen.getByText(/Tocca per registrare/i))
    await waitFor(() => expect(getUserMedia).toHaveBeenCalled())
  })

  it('ripiega sul plugin nativo solo se MediaRecorder non esiste', async () => {
    // WebView troppo vecchio: il plugin è meglio di niente.
    delete window.MediaRecorder
    render(<VoiceRecorder onSave={vi.fn()} onCancel={vi.fn()} />)
    await userEvent.click(screen.getByText(/Tocca per registrare/i))
    await waitFor(() => expect(plugin.startRecording).toHaveBeenCalled())
  })
})

describe('una registrazione vuota non si carica in silenzio', () => {
  it('lo dice, invece di dare all atleta una nota muta', async () => {
    // È il caso misurato sul dispositivo: msDuration 0 e "tutto ok".
    delete window.MediaRecorder            // forza il ramo nativo
    const onSave = vi.fn(), onCancel = vi.fn()
    render(<VoiceRecorder onSave={onSave} onCancel={onCancel} />)

    await userEvent.click(screen.getByText(/Tocca per registrare/i))
    // Aspettare la chiamata al plugin non basta: React deve aver applicato lo
    // stato "sto registrando" perché il bottone di stop esista.
    const stop = await screen.findByLabelText(/Ferma e salva/i)
    await userEvent.click(stop)

    await waitFor(() => expect(plugin.stopRecording).toHaveBeenCalled())
    expect(onSave).not.toHaveBeenCalled()   // niente file muto caricato
    await waitFor(() => expect(onCancel).toHaveBeenCalled())
  })
})
