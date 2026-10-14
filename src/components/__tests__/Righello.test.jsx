import { describe, it, expect, vi } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import Righello, { PASSO_TACCA } from '../Righello'

const voci = Array.from({ length: 30 }, (_, i) => ({ valore: String(i + 1), etichetta: String(i + 1), tacca: null }))

/** Lo scrollLeft di jsdom vale sempre 0: qui lo si rende un numero vero. */
const pistaVera = (el) => {
  let x = 0
  Object.defineProperty(el, 'scrollLeft', { get: () => x, set: (v) => { x = v }, configurable: true })
  return el
}

/** Lo scorrimento nativo (dito o inerzia) porta il righello alla tacca `i`. */
const scorriA = (el, i) => {
  el.scrollLeft = i * PASSO_TACCA
  fireEvent.scroll(el)
}

const aspetta = (ms) => act(() => new Promise(r => setTimeout(r, ms)))

/** Il righello col suo valore in uno stato, come in FoglioMisure. */
function Prova({ onScelta, partenza = 0, esterno }) {
  const [i, setI] = useState(partenza)
  esterno.imposta = setI
  return <Righello voci={voci} indice={i} etichetta="Durata" testoValore={String(i + 1)}
    onScelta={(j) => { onScelta(j); setI(j) }} />
}

const monta = (partenza = 0) => {
  const onScelta = vi.fn()
  const esterno = {}
  render(<Prova onScelta={onScelta} partenza={partenza} esterno={esterno} />)
  const el = pistaVera(screen.getByRole('slider', { name: 'Durata' }))
  return { el, onScelta, esterno }
}

describe('il righello: chi lo muove', () => {
  // 🔴 Segnalato più volte dal committente il 14/10/2026: «lancio il righello,
  // interrompo l'animazione col dito, e il numero si blocca». Il righello
  // cercava di capire quando c'era il dito da touchstart/touchend e un timer;
  // sul telefono quei segnali non arrivano sempre, e senza di loro smetteva di
  // scrivere. Ora è marcato lo scorrimento del CODICE, e tutto il resto scrive.

  it('l\'inerzia scrive anche senza nessun segnale del dito', async () => {
    const { el, onScelta } = monta()
    scorriA(el, 5)
    await aspetta(300)          // una pausa lunga, come un'inerzia che rallenta
    scorriA(el, 9)
    expect(onScelta).toHaveBeenLastCalledWith(9)
  })

  it('fermarsi e ripartire col dito giù continua a cambiare il valore', async () => {
    const { el, onScelta } = monta()
    fireEvent.touchStart(el, { touches: [{ clientX: 200, clientY: 10 }] })
    scorriA(el, 5)
    fireEvent.pointerCancel(el)     // Android: lo scorrimento nativo si prende il gesto
    await aspetta(300)
    scorriA(el, 8)
    expect(onScelta).toHaveBeenLastCalledWith(8)
  })

  it('un valore cambiato da fuori porta il righello, e quello scorrimento non scrive', () => {
    const { el, onScelta, esterno } = monta()
    act(() => esterno.imposta(12))  // una scorciatoia toccata
    expect(el.scrollLeft).toBe(12 * PASSO_TACCA)
    fireEvent.scroll(el)            // l'evento che lo scorrimento del codice genera
    expect(onScelta).not.toHaveBeenCalled()
  })

  it('il dito a metà di uno scorrimento del codice se lo prende', () => {
    const { el, onScelta, esterno } = monta()
    el.scrollTo = vi.fn()           // uno scorrimento morbido, che non arriva subito
    act(() => esterno.imposta(20))
    scorriA(el, 6)                  // ancora in viaggio: non scrive
    expect(onScelta).not.toHaveBeenCalled()
    fireEvent.touchStart(el, { touches: [{ clientX: 200, clientY: 10 }] })
    scorriA(el, 4)
    expect(onScelta).toHaveBeenLastCalledWith(4)
  })

  it('uno scorrimento del codice interrotto senza segnali non rende il righello sordo', async () => {
    const { el, onScelta, esterno } = monta()
    el.scrollTo = vi.fn()
    act(() => esterno.imposta(20))
    await aspetta(450)              // nessun evento: lo scorrimento si è fermato
    scorriA(el, 4)
    expect(onScelta).toHaveBeenLastCalledWith(4)
  })

  it('il righello non si riposiziona sul valore che ha appena scelto lui', () => {
    const { el } = monta()
    el.scrollTo = vi.fn()
    scorriA(el, 7)
    // Il genitore ha riletto il valore e ridato l'indice: niente scorrimento
    // del codice sopra l'inerzia del dito.
    expect(el.scrollTo).not.toHaveBeenCalled()
  })
})
