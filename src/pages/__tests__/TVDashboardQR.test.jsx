import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import QRCode from 'qrcode'
import { AttesaTV } from '../../components/TVDashboardUI'
import { contenutoQR } from '../../lib/codiceTV'

describe('AttesaTV: il QR', () => {
  it('con un QR mostra immagine e didascalia', () => {
    render(<AttesaTV codice="1234" audioAttivo ruotato={false} onRuota={() => {}} qr="data:image/png;base64,xx" />)
    const img = screen.getByAltText('Codice QR per collegare il telefono')
    expect(img.getAttribute('src')).toBe('data:image/png;base64,xx')
    expect(screen.getByText("oppure inquadralo con l'app FLEOFIT")).toBeTruthy()
  })
  it('senza QR non mostra né immagine né didascalia', () => {
    render(<AttesaTV codice="1234" audioAttivo ruotato={false} onRuota={() => {}} qr={null} />)
    expect(screen.queryByAltText('Codice QR per collegare il telefono')).toBeNull()
    expect(screen.queryByText("oppure inquadralo con l'app FLEOFIT")).toBeNull()
  })

  // Leggibilità da lontano: il margine bianco (zona di rispetto) lo dà la
  // carta, di almeno 4 moduli, e il raggio sta sulla carta, non sul QR — sul
  // QR tagliava gli angoli vicino ai tre riquadri di posizione.
  it('il QR sta in una carta bianca con il margine, senza angoli tagliati, e a pixel netti', () => {
    render(<AttesaTV codice="1234" audioAttivo ruotato={false} onRuota={() => {}} qr="data:image/png;base64,xx" />)
    const img = screen.getByAltText('Codice QR per collegare il telefono')
    expect(img.className).not.toMatch(/rounded/)
    expect(img.className).toContain('w-[200px]')
    expect(img.className).toContain('h-[200px]')
    expect(img.className).toContain('[image-rendering:pixelated]')
    const carta = img.parentElement
    expect(carta.className).toContain('bg-white')
    expect(carta.className).toContain('rounded-[24px]')
    // 200px per 25 moduli = 8px a modulo: 4 moduli = 32px = p-8.
    expect(carta.className).toContain('p-8')
  })

  it('il link della TV è sempre un QR da 25 moduli: 400px (generati) e 200px (mostrati) sono multipli interi', async () => {
    for (const c of ['0000', '1234', '9999']) {
      const q = QRCode.create(contenutoQR(c))
      expect(q.modules.size).toBe(25)
      expect(400 % q.modules.size).toBe(0)
      expect(200 % q.modules.size).toBe(0)
    }
  })
})
