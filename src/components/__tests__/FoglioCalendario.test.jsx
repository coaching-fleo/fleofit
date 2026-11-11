import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import FoglioCalendario from '../FoglioCalendario'

// Il foglio «Mostra tutti» del calendario: tutte le righe, e la ricerca per nome.

const piano = {
  giorni: [{ data: '2026-11-11', oggi: true }],
  righe: Array.from({ length: 30 }, (_, i) => ({ id: `a${i}`, nome: i === 7 ? 'Luca Rossi' : `Atleta ${i}`,
    celle: [{ data: '2026-11-11', quando: 'oggi', chips: [] }] })),
}

describe('FoglioCalendario', () => {
  it('mostra tutti gli atleti, senza tetto', () => {
    render(<FoglioCalendario piano={piano} onApri={vi.fn()} onChiudi={vi.fn()} />)
    const foglio = screen.getByRole('dialog', { name: 'Prossimi giorni' })
    expect(within(foglio).getAllByText(/^Atleta \d+\.$|^Luca R\.$/)).toHaveLength(30)
  })

  it('la ricerca trova anche per cognome', () => {
    render(<FoglioCalendario piano={piano} onApri={vi.fn()} onChiudi={vi.fn()} />)
    fireEvent.change(screen.getByRole('searchbox', { name: 'Cerca per nome' }), { target: { value: 'rossi' } })
    expect(screen.getByText('Luca R.')).toBeInTheDocument()
    expect(screen.queryByText('Atleta 1.')).not.toBeInTheDocument()
  })

  it('anche sotto i 20 atleti mette prima chi è da programmare', () => {
    const cella = (data, quando, vuota) => ({ data, quando, chips: vuota ? [] : [{ id: `${data}`, titolo: 'Fondo', categoria: 'Running' }] })
    const pochi = {
      giorni: [{ data: '2026-11-11', oggi: true }, { data: '2026-11-12', oggi: false }],
      righe: [
        { id: 'a', nome: 'Anna Bianchi', celle: [cella('2026-11-11', 'oggi', false), cella('2026-11-12', 'futuro', false)] },
        { id: 'b', nome: 'Bruno Verdi', celle: [cella('2026-11-11', 'oggi', false), cella('2026-11-12', 'futuro', true)] },
      ],
    }
    render(<FoglioCalendario piano={pochi} laterale onApri={vi.fn()} onChiudi={vi.fn()} />)
    const nomi = screen.getAllByText(/^(Anna Bianchi|Bruno Verdi)$/).map(n => n.textContent)
    expect(nomi).toEqual(['Bruno Verdi', 'Anna Bianchi'])
  })
})
