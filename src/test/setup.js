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
//
// Serve anche registerPlugin: ogni plugin Capacitor lo invoca al caricamento del
// modulo, quindi senza di lui nessuna pagina che ne importi uno si monta.
// Restituisce un oggetto che risponde a qualunque metodo con una promise
// risolta: nei test il ramo nativo non viene mai preso, ma i moduli devono
// comunque caricarsi.
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => false, getPlatform: () => 'web' },
  registerPlugin: () => new Proxy({}, {
    get: () => vi.fn(() => Promise.resolve({ value: null })),
  }),
  WebPlugin: class {},
}))

// jsdom, in questa versione di Node, espone un localStorage inutilizzabile:
// `localStorage.getItem is not a function` (è l'origine del warning
// `--localstorage-file` a ogni run). Senza questo rimpiazzo NESSUNA pagina si
// monta, perché quasi tutte leggono localStorage in un effetto — ed era il vero
// ostacolo ai test sulle pagine, non i finti supabase e router (BACKLOG #19).
// Scoperto il 26/08/2026.
function localStorageInMemoria() {
  let dati = new Map()
  return {
    get length() { return dati.size },
    key: (i) => [...dati.keys()][i] ?? null,
    getItem: (k) => (dati.has(String(k)) ? dati.get(String(k)) : null),
    setItem: (k, v) => { dati.set(String(k), String(v)) },
    removeItem: (k) => { dati.delete(String(k)) },
    clear: () => { dati = new Map() },
  }
}
for (const nome of ['localStorage', 'sessionStorage']) {
  Object.defineProperty(window, nome, { value: localStorageInMemoria(), writable: true, configurable: true })
}
afterEach(() => { window.localStorage.clear(); window.sessionStorage.clear() })
