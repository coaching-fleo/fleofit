import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import VoiceRecorder from '../VoiceRecorder'
import { registraAlertHost } from '../../lib/alert'

// Perché questi test esistono
// ────────────────────────────
// CLAUDE.md §9 punto 1. Questo componente esisteva in TRE copie, e il 25/08 un
// guasto è stato corretto in due su tre: se l'avvio della registrazione
// falliva, l'utente premeva registra e non succedeva NIENTE — nessun messaggio,
// nessuno stato. Home era la copia rimasta indietro.
//
// Ora la copia è una sola, e questi test valgono per tutte e tre le pagine.

const alert = vi.fn()

beforeEach(() => {
  registraAlertHost(alert)
  alert.mockClear()
  delete window.MediaRecorder
  Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true })
})

describe('quando il microfono non è disponibile', () => {
  it('lo dice, invece di non fare niente', async () => {
    render(<VoiceRecorder onSave={vi.fn()} onCancel={vi.fn()} />)
    await userEvent.click(screen.getByText(/Tocca per registrare/i))

    await waitFor(() => expect(alert).toHaveBeenCalled())
    expect(alert.mock.calls[0][0]).toMatchObject({ type: 'error' })
    expect(alert.mock.calls[0][0].message).toMatch(/registrazione vocale|microfono/i)
  })

  it('e non entra in stato "sto registrando"', async () => {
    // Se ci entrasse, l'utente vedrebbe il timer partire senza che si registri
    // niente: il peggiore dei due modi di fallire.
    render(<VoiceRecorder onSave={vi.fn()} onCancel={vi.fn()} />)
    await userEvent.click(screen.getByText(/Tocca per registrare/i))

    await waitFor(() => expect(alert).toHaveBeenCalled())
    expect(screen.getByText(/Tocca per registrare/i)).toBeInTheDocument()
  })
})

describe('lo stato iniziale', () => {
  it('invita a registrare e non mostra i comandi di stop', () => {
    render(<VoiceRecorder onSave={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText(/Tocca per registrare/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/Ferma e salva/i)).not.toBeInTheDocument()
  })
})
