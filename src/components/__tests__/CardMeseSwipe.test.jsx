import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CardMese } from '../CalendarioUI'

// Lo swipe sulla carta del mese cambia mese (27/10/2026), nei due calendari:
// la pagina Calendario e quello della scheda atleta. I casi che contano sono
// quelli in cui il gesto NON deve scattare: un dito che scorre la pagina in
// verticale, o un tocco che si sposta di poco, non devono cambiare mese.

const monta = () => {
  const onPrecedente = vi.fn()
  const onSuccessivo = vi.fn()
  render(<CardMese onPrecedente={onPrecedente} onSuccessivo={onSuccessivo}><p>griglia</p></CardMese>)
  return { carta: screen.getByText('griglia').parentElement, onPrecedente, onSuccessivo }
}
const trascina = (el, [x0, y0], [x1, y1]) => {
  fireEvent.touchStart(el, { touches: [{ clientX: x0, clientY: y0 }] })
  fireEvent.touchEnd(el, { changedTouches: [{ clientX: x1, clientY: y1 }] })
}

describe('Lo swipe sulla carta del mese', () => {
  it('verso sinistra va al mese dopo', () => {
    const { carta, onPrecedente, onSuccessivo } = monta()
    trascina(carta, [300, 200], [180, 210])
    expect(onSuccessivo).toHaveBeenCalledTimes(1)
    expect(onPrecedente).not.toHaveBeenCalled()
  })

  it('verso destra va al mese prima', () => {
    const { carta, onPrecedente, onSuccessivo } = monta()
    trascina(carta, [100, 200], [220, 190])
    expect(onPrecedente).toHaveBeenCalledTimes(1)
    expect(onSuccessivo).not.toHaveBeenCalled()
  })

  it('uno scorrimento verticale della pagina non cambia mese', () => {
    const { carta, onPrecedente, onSuccessivo } = monta()
    trascina(carta, [200, 400], [140, 200])
    expect(onPrecedente).not.toHaveBeenCalled()
    expect(onSuccessivo).not.toHaveBeenCalled()
  })

  it('un tocco che si sposta di poco resta un tocco', () => {
    const { carta, onPrecedente, onSuccessivo } = monta()
    trascina(carta, [200, 200], [180, 200])
    expect(onPrecedente).not.toHaveBeenCalled()
    expect(onSuccessivo).not.toHaveBeenCalled()
  })

  it('senza i comandi la carta resta una carta', () => {
    render(<CardMese><p>solo</p></CardMese>)
    trascina(screen.getByText('solo').parentElement, [300, 200], [100, 200])
    expect(screen.getByText('solo')).toBeInTheDocument()
  })
})
