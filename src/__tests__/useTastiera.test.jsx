import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'

// Perché questo test esiste
// ──────────────────────────
// Il difetto, segnalato dal committente il 27/08/2026: scrivendo il nome del
// workout, la barra «Costruisci l'allenamento» «saliva in cima». Non era un bug
// di layout — con `Keyboard.resize: 'native'` (capacitor.config.ts) la webview
// si **rimpicciolisce** quando la tastiera sale, e tutto ciò che è ancorato in
// basso si ritrova incollato sopra la tastiera. Il fondo si è alzato, non la barra.
//
// Non si può «tenerla ferma dov'era»: quel punto dello schermo, mentre si
// digita, non esiste più. La risposta è la stessa della navbar — sparire.
//
// ⚠️ Il ramo che conta è quello NATIVO, e `src/test/setup.js` finge il web per
// tutta la suite. Qui i due moduli Capacitor sono rimpiazzati apposta, ed è
// l'unico modo di esercitare la riga che ha risolto il difetto.

const ascoltatori = new Map()

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true, getPlatform: () => 'ios' },
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

const { BarraAzioni } = await import('../components/CreaWorkoutUI')
const { chiudiTastieraSuInvio } = await import('../useTastiera')

/** Fa scattare l'evento come lo manderebbe iOS. */
const tastiera = async (evento) => {
  await act(async () => {
    ascoltatori.get(evento)?.()
    await Promise.resolve()
  })
}

beforeEach(() => ascoltatori.clear())

describe('la barra delle azioni e la tastiera', () => {
  it('sparisce quando la tastiera sale e torna quando scende', async () => {
    render(<BarraAzioni><button>Costruisci</button></BarraAzioni>)
    // Gli ascoltatori si registrano in un effetto, che è già stato eseguito da
    // render(): se non ci sono, l'hook non si è agganciato a niente.
    await act(async () => { await Promise.resolve() })
    expect(ascoltatori.has('keyboardWillShow')).toBe(true)
    expect(screen.getByRole('button', { name: 'Costruisci' })).toBeInTheDocument()

    await tastiera('keyboardWillShow')
    expect(screen.queryByRole('button', { name: 'Costruisci' })).not.toBeInTheDocument()

    await tastiera('keyboardWillHide')
    expect(screen.getByRole('button', { name: 'Costruisci' })).toBeInTheDocument()
  })
})

describe('invio chiude la tastiera', () => {
  // Su un campo singolo senza <form>, il tasto invio di iOS non fa niente:
  // l'utente lo preme, lo schermo resta coperto, e deve toccare fuori dal campo.
  it('toglie il fuoco al campo e annulla l evento', () => {
    const campo = document.createElement('input')
    document.body.appendChild(campo)
    campo.focus()
    const preventDefault = vi.fn()

    chiudiTastieraSuInvio({ key: 'Enter', preventDefault, currentTarget: campo })

    expect(preventDefault).toHaveBeenCalled()
    expect(document.activeElement).not.toBe(campo)
  })

  it('non tocca gli altri tasti', () => {
    const campo = document.createElement('input')
    document.body.appendChild(campo)
    campo.focus()
    const preventDefault = vi.fn()

    chiudiTastieraSuInvio({ key: 'a', preventDefault, currentTarget: campo })

    expect(preventDefault).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(campo)
  })
})
