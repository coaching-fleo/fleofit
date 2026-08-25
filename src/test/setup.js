import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// jsdom non implementa queste due, e i picker in stile iOS le chiamano a ogni
// render: senza, il test fallisce per un motivo che non c'entra con il test.
window.HTMLElement.prototype.scrollIntoView = vi.fn()
window.HTMLElement.prototype.scrollTo = vi.fn()

// L'app decide fra ramo nativo e ramo web con Capacitor.isNativePlatform().
// Nei test siamo sempre "web": è il ramo che jsdom sa eseguire.
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => false, getPlatform: () => 'web' },
}))
