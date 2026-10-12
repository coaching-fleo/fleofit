import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'

// «Correggi il testo letto» finiva sotto la tastiera (12/10/2026). Il foglio
// si solleva di quanta tastiera COPRE ancora la pagina — e quanta ne copre
// dipende dalla piattaforma: su iOS la webview si rimpicciolisce da sé
// (`Keyboard.resize: 'native'`), su Android a tutta altezza no. Qui si
// simulano tutte e due, perché `src/test/setup.js` finge il web.

const ascoltatori = new Map()
let mockPiattaforma = 'android'

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true, getPlatform: () => mockPiattaforma },
  registerPlugin: () => new Proxy({}, { get: () => vi.fn(() => Promise.resolve({ value: null })) }),
  WebPlugin: class {},
}))

vi.mock('@capacitor/keyboard', () => ({
  Keyboard: {
    addListener: (evento, callback) => {
      ascoltatori.set(evento, callback)
      return Promise.resolve({ remove: () => ascoltatori.delete(evento) })
    },
  },
}))

const { useTastieraCheCopre } = await import('../useTastiera')

function Sonda() {
  return <p data-testid="copre">{useTastieraCheCopre()}</p>
}

const altezza = (h) => Object.defineProperty(window, 'innerHeight', { value: h, configurable: true })
const evento = async (nome, info) => {
  await act(async () => {
    ascoltatori.get(nome)?.(info)
    await Promise.resolve()
  })
}
const copre = () => Number(screen.getByTestId('copre').textContent)

beforeEach(() => {
  ascoltatori.clear()
  mockPiattaforma = 'android'
  altezza(874)
})

describe('useTastieraCheCopre', () => {
  it('🔴 iOS: zero, anche se la finestra non si è ancora rimpicciolita', async () => {
    // Il caso vero del simulatore: `keyboardDidShow` arriva con `innerHeight`
    // ancora intero. Misurare lì faceva salire il foglio due volte.
    mockPiattaforma = 'ios'
    render(<Sonda />)
    await act(async () => { await Promise.resolve() })
    await evento('keyboardDidShow', { keyboardHeight: 336 })
    expect(copre()).toBe(0)
    expect(ascoltatori.has('keyboardDidShow')).toBe(false)
  })

  it('Android che si rimpicciolisce da sé: non solleva due volte', async () => {
    render(<Sonda />)
    await act(async () => { await Promise.resolve() })
    altezza(874 - 300)
    await evento('keyboardDidShow', { keyboardHeight: 310 })
    expect(copre()).toBe(0)
  })

  it('🔴 Android a tutta altezza: la webview resta piena, la tastiera copre tutta', async () => {
    render(<Sonda />)
    await act(async () => { await Promise.resolve() })
    await evento('keyboardDidShow', { keyboardHeight: 310 })
    expect(copre()).toBe(310)
    await evento('keyboardWillHide')
    expect(copre()).toBe(0)
  })
})
