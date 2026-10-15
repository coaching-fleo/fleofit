import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'

// Perché questo test esiste
// ──────────────────────────
// «Nuovo messaggio» su iPhone (15/10/2026, segnalato dal committente): la barra
// Prova · Invia restava in fondo mentre la tastiera saliva, e poi «si
// teletrasportava» sopra. La risposta è smettere di far ridimensionare la
// webview su quella pagina e alzare il fondo con l'altezza di keyboardWillShow.
// Il ramo che conta è nativo iOS: qui Capacitor e la tastiera sono finti apposta.

const ascoltatori = new Map()
const setResizeMode = vi.fn(() => Promise.resolve())

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true, getPlatform: () => 'ios' },
  registerPlugin: () => new Proxy({}, { get: () => vi.fn(() => Promise.resolve({ value: null })) }),
  WebPlugin: class {},
}))

vi.mock('@capacitor/keyboard', () => ({
  Keyboard: {
    setResizeMode: (o) => setResizeMode(o),
    addListener: (evento, callback) => {
      ascoltatori.set(evento, callback)
      return Promise.resolve({ remove: () => ascoltatori.delete(evento) })
    },
  },
}))

const { useTastieraIOS } = await import('../useTastiera')

function Prova() {
  const h = useTastieraIOS()
  return <p data-testid="h">{h}</p>
}

beforeEach(() => { ascoltatori.clear(); setResizeMode.mockClear() })

describe('useTastieraIOS', () => {
  it('ferma il ridimensionamento, segue keyboardWillShow/WillHide, e all\'uscita lo rimette', async () => {
    const { unmount } = render(<Prova />)
    await act(async () => { await Promise.resolve() })
    expect(setResizeMode).toHaveBeenCalledWith({ mode: 'none' })
    expect(screen.getByTestId('h').textContent).toBe('0')

    await act(async () => { ascoltatori.get('keyboardWillShow')?.({ keyboardHeight: 336.4 }) })
    expect(screen.getByTestId('h').textContent).toBe('336')
    await act(async () => { ascoltatori.get('keyboardWillHide')?.() })
    expect(screen.getByTestId('h').textContent).toBe('0')

    unmount()
    expect(setResizeMode).toHaveBeenLastCalledWith({ mode: 'native' })
    expect(ascoltatori.size).toBe(0)
  })
})
