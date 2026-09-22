import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'

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

// ⚠️ E la barra NON ancorata fa l'opposto, che è il difetto del 22/09/2026: al
// passo 1 del builder quella barra porta «Costruisci l'allenamento», cioè
// l'unica via d'uscita della schermata. Nascondendola, toccare il campo «Nome»
// chiudeva la strada: bisognava prima premere invio per far scendere la
// tastiera. Una barra in flusso non può «salire in cima» — `mt-auto` la porta
// al fondo della viewport rimpicciolita, cioè sopra i tasti, dove iOS mette le
// proprie barre accessorie.
describe('la barra NON ancorata resta premibile con la tastiera aperta', () => {
  it('non sparisce quando la tastiera sale', async () => {
    render(<BarraAzioni ancorata={false}><button>Costruisci</button></BarraAzioni>)
    await act(async () => { await Promise.resolve() })

    await tastiera('keyboardWillShow')
    expect(screen.getByRole('button', { name: 'Costruisci' })).toBeInTheDocument()
  })

  // ⚠️ Questo è ciò che rende il tocco UNO e non due. Senza, iOS chiude la
  // tastiera al mousedown, la webview si riallarga e la barra scende di ~300px
  // prima che il click arrivi: il primo tocco cade nel vuoto. Non si vede in
  // jsdom, dove niente si muove, e nessun'altra asserzione ci casca.
  it('il tocco non toglie il fuoco al campo che si sta scrivendo', async () => {
    render(<BarraAzioni ancorata={false}><button>Costruisci</button></BarraAzioni>)
    await act(async () => { await Promise.resolve() })

    const annullato = !fireEvent.mouseDown(screen.getByRole('button', { name: 'Costruisci' }))
    expect(annullato).toBe(true)
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
