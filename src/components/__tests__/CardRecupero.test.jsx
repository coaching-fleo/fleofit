import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import CardRecupero from '../CardRecupero'
import { riepilogoRecupero } from '../../lib/recuperoGarmin'

// La sezione «Recupero» a tessere (26/11/2026): la card riceve il riepilogo
// già calcolato e lo disegna.
const OGGI = new Date('2026-10-29T10:00:00Z')
const giorno = (i) => new Date(Date.UTC(2026, 9, 29 - i)).toISOString().slice(0, 10)
const completa = (i, storta = false) => ({
  athlete_id: 'a', giorno: giorno(i),
  hrv: { media_notte: storta ? 51 : 60 },
  giornata: { fc_riposo: storta ? 58 : 52, body_battery_carica: 62, stress_medio: 30 },
  sonno: { ore: storta ? 5.5 : 7.4, punteggio: storta ? 57 : 80, profondo_min: 45, rem_min: 50, leggero_min: 220, sveglio_min: 25 },
})
const storto = () => [
  ...Array.from({ length: 28 }, (_, i) => completa(30 - i)),
  ...[2, 1, 0].map(i => completa(i, true)),
]
const disegna = (righe, opzioni = {}) =>
  render(<CardRecupero riepilogo={riepilogoRecupero(righe, { oggi: OGGI, ...opzioni })} oggi={OGGI} />)

describe('CardRecupero', () => {
  it('riepilogo null → niente nel DOM', () => {
    const { container } = render(<CardRecupero riepilogo={null} oggi={OGGI} />)
    expect(container.innerHTML).toBe('')
  })

  it('scenario storto: frase, tessere tinte, colonnine arancioni', () => {
    disegna(storto())
    const sezione = screen.getByRole('region', { name: 'Recupero' })
    expect(within(sezione).getByRole('heading', { name: 'Recupero' })).toBeTruthy()
    const frase = sezione.querySelector('[data-stato="segnali"]')
    expect(within(frase).getByText('Da guardare')).toBeTruthy()
    expect(within(frase).getByText('da 3 notti')).toBeTruthy()
    expect(frase.textContent).toContain('HRV −15%, FC a riposo +6, sotto le 6 ore di sonno.')
    const hrv = sezione.querySelector('[data-tessera="hrv"]')
    expect(hrv.hasAttribute('data-fuori')).toBe(true)
    expect(sezione.querySelector('[data-tessera="bb"]').hasAttribute('data-fuori')).toBe(false)
    expect(hrv.querySelectorAll('[data-notte]')).toHaveLength(7)
    expect(hrv.querySelectorAll('[data-notte][data-fila]')).toHaveLength(3)
    expect(within(hrv).getByText('−15% sulla media')).toBeTruthy()
    expect(within(sezione.querySelector('[data-tessera="fc"]')).getByText('+6 sulla media')).toBeTruthy()
    expect(within(sezione.querySelector('[data-tessera="sonno"]')).getByText('−1h 54m dalla media')).toBeTruthy()
    expect(sezione.querySelector('[data-tessera="sonno"]').hasAttribute('data-fuori')).toBe(true)
  })

  it('pochi: niente pillole né riga della media', () => {
    disegna([0, 1, 2, 3, 4].map(i => completa(i)))
    expect(document.querySelector('[data-stato="pochi"]').textContent).toContain('ne ha 5')
    expect(document.body.textContent).not.toMatch(/sulla media|dalla media/)
    expect(document.querySelector('[data-media-riga]')).toBeNull()
  })

  it('nella norma: pillola «come la media», nessuna tessera tinta', () => {
    disegna(Array.from({ length: 20 }, (_, i) => completa(i)))
    expect(document.querySelector('[data-stato="norma"]')).toBeTruthy()
    expect(document.querySelector('[data-fuori]')).toBeNull()
    expect(within(document.querySelector('[data-tessera="hrv"]')).getByText('come la media')).toBeTruthy()
  })

  it('una notte vuota è uno spazio, non una colonnina', () => {
    disegna(Array.from({ length: 20 }, (_, i) => completa(i)).filter(r => r.giorno !== giorno(2)))
    const vuota = document.querySelector('[data-tessera="hrv"] [data-notte][data-vuota]')
    expect(vuota).toBeTruthy()
    expect(vuota.style.height).toBe('')
  })

  it('sonno senza dato: nessuna tessera e nessun zero', () => {
    const { container } = disegna(Array.from({ length: 20 }, (_, i) => ({ athlete_id: 'a', giorno: giorno(i), hrv: { media_notte: 60 }, sonno: {} })))
    expect(container.querySelector('[data-tessera="sonno"]')).toBeNull()
    expect(container.textContent).not.toMatch(/\b0 ?h/)
  })

  it('come stai: assente → nessuna tessera; presente → le parole, mai il numero', () => {
    disegna(storto())
    expect(document.querySelector('[data-tessera="come-stai"]')).toBeNull()
    document.body.innerHTML = ''
    disegna(storto(), { comeStai: { sonno: 1, energia: 2, dolori: 4, stress: 3 } })
    const tessera = document.querySelector('[data-tessera="come-stai"]')
    for (const parola of ['Pessimo', 'Poca', 'Pochi', 'Normale']) expect(within(tessera).getByText(parola)).toBeTruthy()
    expect(tessera.textContent).not.toMatch(/\d\s*\/\s*5/)
  })

  it('ultimo dato vecchio → il giorno al posto di stanotte', () => {
    disegna(Array.from({ length: 20 }, (_, i) => completa(i + 3)))
    expect(screen.getByText(/Ultimo dato: lun 26/)).toBeTruthy()
    expect(screen.queryByText(/stanotte/)).toBeNull()
  })
})
