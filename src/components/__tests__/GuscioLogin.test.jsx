import { describe, it, expect, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Guscio } from '../LoginUI'

// Il login sul computer (13/10/2026): su schermo largo la pagina si divide in
// due, sul telefono resta esattamente com'era.

const originale = window.matchMedia
const finestra = (larga) => {
  window.matchMedia = (query) => ({
    matches: query.includes('min-width: 1024px') ? larga : /prefers-reduced-motion/.test(query),
    media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })
}

afterEach(() => { window.matchMedia = originale })

describe('Guscio del login', () => {
  it('su schermo largo mette il marchio a sinistra e il modulo a destra', () => {
    finestra(true)
    render(<Guscio><p>modulo</p></Guscio>)
    expect(screen.getByText(/Programma, segui e correggi/)).toBeTruthy()
    expect(screen.getByText('modulo')).toBeTruthy()
  })

  it('sul telefono non aggiunge niente', () => {
    finestra(false)
    render(<Guscio><p>modulo</p></Guscio>)
    expect(screen.queryByText(/Programma, segui e correggi/)).toBeNull()
    expect(screen.getByText('modulo')).toBeTruthy()
  })
})
