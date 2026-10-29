import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import RigaNotifica from '../RigaNotifica'

// Una notifica si segna come letta senza aprirla (29/10/2026): trascinandola a
// sinistra o con la spunta. I casi che contano sono quelli in cui NON deve
// succedere: uno scorrimento della lista, un trascinamento corto, una già letta.

const NOTIFICA = { id: 7, title: 'Nuovo workout', message: 'Domani alle 8', created_at: '2026-10-29T08:00:00Z', is_read: false }

const monta = (notifica = NOTIFICA) => {
  const onApri = vi.fn()
  const onLetta = vi.fn()
  const onDaLeggere = vi.fn()
  const { container } = render(<RigaNotifica notifica={notifica} onApri={onApri} onLetta={onLetta} onDaLeggere={onDaLeggere} />)
  return { riga: container.querySelector('[data-riga-notifica]'), onApri, onLetta, onDaLeggere }
}
const trascina = (el, [x0, y0], [x1, y1]) => {
  fireEvent.touchStart(el, { touches: [{ clientX: x0, clientY: y0 }] })
  fireEvent.touchMove(el, { touches: [{ clientX: (x0 + x1) / 2, clientY: (y0 + y1) / 2 }] })
  fireEvent.touchMove(el, { touches: [{ clientX: x1, clientY: y1 }] })
  fireEvent.touchEnd(el, { changedTouches: [{ clientX: x1, clientY: y1 }] })
  fireEvent.click(el)
}

describe('La riga di una notifica', () => {
  it('trascinata a sinistra oltre la soglia diventa letta, senza aprirsi', () => {
    const { riga, onApri, onLetta } = monta()
    trascina(riga, [300, 100], [180, 105])
    expect(onLetta).toHaveBeenCalledTimes(1)
    expect(onApri).not.toHaveBeenCalled()
  })

  it('un trascinamento corto torna indietro e non segna niente', () => {
    const { riga, onApri, onLetta } = monta()
    trascina(riga, [300, 100], [250, 100])
    expect(onLetta).not.toHaveBeenCalled()
    expect(onApri).not.toHaveBeenCalled()
  })

  it('uno scorrimento verticale della lista non segna niente', () => {
    const { riga, onLetta } = monta()
    trascina(riga, [300, 300], [200, 100])
    expect(onLetta).not.toHaveBeenCalled()
  })

  it('la spunta la segna letta senza aprirla', () => {
    const { onApri, onLetta } = monta()
    fireEvent.click(screen.getByRole('button', { name: 'Segna come letta' }))
    expect(onLetta).toHaveBeenCalledTimes(1)
    expect(onApri).not.toHaveBeenCalled()
  })

  it('il tocco sulla riga la apre, come prima', () => {
    const { riga, onApri } = monta()
    fireEvent.click(riga)
    expect(onApri).toHaveBeenCalledTimes(1)
  })

  it('una già letta non ha la spunta e verso sinistra non si muove', () => {
    const { riga, onLetta, onDaLeggere } = monta({ ...NOTIFICA, is_read: true })
    expect(screen.queryByRole('button', { name: 'Segna come letta' })).toBeNull()
    trascina(riga, [300, 100], [150, 100])
    expect(onLetta).not.toHaveBeenCalled()
    expect(onDaLeggere).not.toHaveBeenCalled()
  })

  it('una già letta trascinata a DESTRA torna da leggere, senza aprirsi', () => {
    const { riga, onApri, onLetta, onDaLeggere } = monta({ ...NOTIFICA, is_read: true })
    trascina(riga, [100, 100], [220, 105])
    expect(onDaLeggere).toHaveBeenCalledTimes(1)
    expect(onLetta).not.toHaveBeenCalled()
    expect(onApri).not.toHaveBeenCalled()
  })

  it('una non letta trascinata a destra non cambia', () => {
    const { riga, onLetta, onDaLeggere } = monta()
    trascina(riga, [100, 100], [250, 100])
    expect(onLetta).not.toHaveBeenCalled()
    expect(onDaLeggere).not.toHaveBeenCalled()
  })

  it('sul desktop il bottone rimette da leggere una già letta', () => {
    const { onApri, onDaLeggere } = monta({ ...NOTIFICA, is_read: true })
    fireEvent.click(screen.getByRole('button', { name: 'Segna come da leggere' }))
    expect(onDaLeggere).toHaveBeenCalledTimes(1)
    expect(onApri).not.toHaveBeenCalled()
  })
})
