// Perché questi test esistono: la foto di un modello può mancare o non caricarsi
// (rete, file cancellato). In quel caso l'atleta deve vedere un disegno del TIPO
// di scarpa, mai un'icona rotta. E una foto non scontornata (#sfondo) va in un
// riquadro chiaro, o il suo fondo bianco stonerebbe sulla card scura.
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import FotoScarpa from '../FotoScarpa'

describe('FotoScarpa', () => {
  it('senza url mostra il disegno del tipo', () => {
    render(<FotoScarpa tipo="gara" alt="Vaporfly" />)
    const img = screen.getByAltText('Vaporfly')
    expect(img.getAttribute('data-disegno')).toBe('gara')
  })

  it('con url mostra la foto, lazy', () => {
    render(<FotoScarpa url="https://x/y.webp" tipo="gara" alt="Foto" />)
    const img = screen.getByAltText('Foto')
    expect(img.getAttribute('src')).toBe('https://x/y.webp')
    expect(img.getAttribute('loading')).toBe('lazy')
    expect(img.getAttribute('decoding')).toBe('async')
  })

  it('se la foto non carica passa al disegno', () => {
    render(<FotoScarpa url="https://x/y.webp" tipo="trail" alt="Foto" />)
    fireEvent.error(screen.getByAltText('Foto'))
    expect(screen.getByAltText('Foto').getAttribute('data-disegno')).toBe('trail')
  })

  it('tipo sconosciuto o nullo: il disegno allenamento', () => {
    const { unmount } = render(<FotoScarpa tipo="boh" alt="A" />)
    expect(screen.getByAltText('A').getAttribute('data-disegno')).toBe('allenamento')
    unmount()
    render(<FotoScarpa tipo={null} alt="B" />)
    expect(screen.getByAltText('B').getAttribute('data-disegno')).toBe('allenamento')
  })

  it('url con #sfondo: riquadro chiaro con data-sfondo', () => {
    const { container } = render(<FotoScarpa url="https://x/y.webp#sfondo" tipo="gara" alt="F" />)
    const riquadro = container.querySelector('[data-sfondo="si"]')
    expect(riquadro).toBeTruthy()
    expect(riquadro.className).toContain('bg-white')
    expect(riquadro.querySelector('img')).toBeTruthy()
  })

  it('url senza #sfondo: nessun riquadro chiaro', () => {
    const { container } = render(<FotoScarpa url="https://x/y.webp" tipo="gara" alt="F" />)
    expect(container.querySelector('[data-sfondo]')).toBeNull()
  })
})
