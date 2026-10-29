import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import CardRecupero from '../CardRecupero'

const OGGI = new Date('2026-10-29T10:00:00Z')
const giorno = (i) => new Date(Date.UTC(2026, 9, 29 - i)).toISOString().slice(0, 10)
const righe = (n, f) => Array.from({ length: n }, (_, i) => f(giorno(i)))
const completa = (g) => ({ athlete_id: 'a', giorno: g, sonno: { ore: 7.5 }, hrv: { media_notte: 60 }, giornata: { fc_riposo: 50 } })

describe('CardRecupero', () => {
  it('con 20 giorni: tre righe e la media in numero', () => {
    render(<CardRecupero righe={righe(20, completa)} oggi={OGGI} />)
    expect(screen.getByText('Recupero · da Garmin')).toBeTruthy()
    for (const k of ['sonno', 'hrv', 'fc']) expect(document.querySelector(`[data-metrica="${k}"]`)).toBeTruthy()
    const fc = document.querySelector('[data-metrica="fc"]')
    expect(within(fc).getByText('50 bpm')).toBeTruthy()
    expect(fc.querySelector('[data-media-testo]').textContent).toBe('50')
    expect(document.querySelector('[data-metrica="sonno"] [data-media-testo]').textContent).toBe('7 h 30′')
  })

  it('con 10 giorni: i valori ci sono, la media è «—»', () => {
    render(<CardRecupero righe={righe(10, completa)} oggi={OGGI} />)
    const hrv = document.querySelector('[data-metrica="hrv"]')
    expect(within(hrv).getByText('60 ms')).toBeTruthy()
    expect(hrv.querySelector('[data-media-testo]').textContent).toBe('—')
    expect(document.querySelector('[data-media]')).toBeNull()
  })

  it('senza righe non c\'è niente nel DOM', () => {
    const { container } = render(<CardRecupero righe={[]} oggi={OGGI} />)
    expect(container.innerHTML).toBe('')
  })

  it('solo sonno: una riga sola, e nessuno zero', () => {
    const { container } = render(<CardRecupero righe={righe(5, g => ({ athlete_id: 'a', giorno: g, sonno: { ore: 6 } }))} oggi={OGGI} />)
    expect(container.querySelectorAll('[data-metrica]')).toHaveLength(1)
    expect(screen.getByText('6 h 00′')).toBeTruthy()
    expect(container.textContent).not.toMatch(/\b0 (ms|bpm)/)
  })

  it('il sonno si scrive come 7 h 20′', () => {
    const { container } = render(<CardRecupero righe={[{ athlete_id: 'a', giorno: '2026-10-29', sonno: { ore: 7 + 20 / 60 } }]} oggi={OGGI} />)
    expect(container.textContent).toContain('7 h 20′')
  })
})
