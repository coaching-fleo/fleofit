import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Linea from '../grafici/Linea'
import BarreImpilate from '../grafici/BarreImpilate'
import Mappa from '../grafici/Mappa'
import Striscia from '../grafici/Striscia'

// I grafici della pagina Analisi. Il caso che conta è il dato che MANCA: una
// settimana senza dati disegnata come zero è una squadra ferma che non c'è.

describe('Linea', () => {
  it('un valore mancante interrompe la linea invece di scendere a zero', () => {
    const { container } = render(
      <Linea titolo="Aderenza" colore="#f1ba17" punti={[
        { etichetta: 'a', valore: 50 }, { etichetta: 'b', valore: 60 },
        { etichetta: 'c', valore: null },
        { etichetta: 'd', valore: 70 }, { etichetta: 'e', valore: 80 },
      ]} />
    )
    expect(container.querySelectorAll('path[data-linea]')).toHaveLength(2)
    expect(container.querySelector('svg title').textContent).toBe('Aderenza')
  })

  it('senza nessun valore dice che non ci sono dati', () => {
    render(<Linea titolo="Aderenza" colore="#f1ba17" punti={[{ etichetta: 'a', valore: null }]} />)
    expect(screen.getByText(/nessun dato/i)).toBeInTheDocument()
  })
})

describe('BarreImpilate', () => {
  it('una barra per parte non vuota, con il valore nel titolo', () => {
    const { container } = render(
      <BarreImpilate titolo="Minuti" colonne={[
        { etichetta: '12 ott', parti: [{ nome: 'Hyrox', valore: 60, colore: '#f1ba17' }, { nome: 'Running', valore: 0, colore: '#0094C6' }] },
        { etichetta: '19 ott', parti: [{ nome: 'Hyrox', valore: 30, colore: '#f1ba17' }, { nome: 'Running', valore: 45, colore: '#0094C6' }] },
      ]} />
    )
    expect(container.querySelectorAll('rect[data-parte]')).toHaveLength(3)
    expect(container.querySelector('rect[data-parte] title').textContent).toMatch(/Hyrox.*60/)
  })
})

describe('Mappa', () => {
  it('una cella per atleta e settimana; quelle senza dati lo dicono', () => {
    const celle = (stati) => stati.map((stato, i) => ({ valore: stato === 'ok' ? 25 * i : null, stato }))
    const { container } = render(
      <Mappa colonne={['1', '2', '3', '4']} righe={[
        { nome: 'Anna', celle: celle(['prima', 'ok', 'ok', 'ok']) },
        { nome: 'Bruno', celle: celle(['ok', 'vuota', 'ok', 'pausa']) },
        { nome: 'Carla', celle: celle(['ok', 'ok', 'ok', 'ok']) },
      ]} />
    )
    const rect = container.querySelectorAll('rect[data-cella]')
    expect(rect).toHaveLength(12)
    expect(rect[0].getAttribute('aria-label')).toMatch(/nessun dato/)
    expect(rect[7].getAttribute('aria-label')).toMatch(/pausa/)
    expect(rect[2].getAttribute('aria-label')).toMatch(/50%/)
  })
})

describe('Striscia', () => {
  it('un punto per chi ha un valore, «—» per chi no', () => {
    const { container } = render(
      <Striscia titolo="ACWR" fascia={[0.8, 1.5]} voci={[
        { nome: 'Anna', valore: 1.1 }, { nome: 'Bruno', valore: null }, { nome: 'Carla', valore: 1.9 },
      ]} />
    )
    expect(container.querySelectorAll('circle[data-punto]')).toHaveLength(2)
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(container.querySelector('rect[data-fascia]')).not.toBeNull()
  })
})
