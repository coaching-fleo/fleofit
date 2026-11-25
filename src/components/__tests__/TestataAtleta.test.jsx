import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TestataAtleta } from '../SchedaAtletaUI'

describe('TestataAtleta', () => {
  it('senza foto: monogramma con le iniziali e «Aggiungi foto» che apre la modifica', () => {
    const onAggiungiFoto = vi.fn()
    const { container } = render(<TestataAtleta nome="Laura Serra" onMenu={() => {}} onAggiungiFoto={onAggiungiFoto} />)
    expect(container.querySelector('[data-modo-foto]').dataset.modoFoto).toBe('monogramma')
    expect(container.textContent).toContain('LS')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Laura Serra')
    fireEvent.click(screen.getByRole('button', { name: /Aggiungi foto/ }))
    expect(onAggiungiFoto).toHaveBeenCalledTimes(1)
  })

  it('con la foto: niente monogramma né «Aggiungi foto»', () => {
    const { container } = render(<TestataAtleta nome="Sara Bianchi" foto="https://x/f.jpg" onMenu={() => {}} onAggiungiFoto={() => {}} />)
    expect(container.querySelector('[data-modo-foto]').dataset.modoFoto).not.toBe('monogramma')
    expect(screen.queryByRole('button', { name: /Aggiungi foto/ })).toBeNull()
  })

  it('una foto rotta torna al monogramma', () => {
    const onErroreFoto = vi.fn()
    const { container } = render(<TestataAtleta nome="Sara Bianchi" foto="https://x/rotta.jpg" onMenu={() => {}} onErroreFoto={onErroreFoto} />)
    fireEvent.error(container.querySelector('img'))
    expect(onErroreFoto).toHaveBeenCalled()
    expect(container.querySelector('[data-modo-foto]').dataset.modoFoto).toBe('monogramma')
  })
})
