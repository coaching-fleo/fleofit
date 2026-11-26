import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RigaCartaTV } from '../TVDashboardUI'

// Con più persone sulla TV la riga cambia disegno (colori e nomi):
// l'intensità del coach deve restare, al lavoro e «in arrivo» (16/11/2026).
// E il prossimo esercizio porta l'etichetta «Poi» (26/11/2026).
describe('RigaCartaTV', () => {
  const persone = [{ id: 'a', nome: 'Marco', colore: '#f97316' }]
  const riga = (extra = {}) => ({ id: 1, numero: '1', nome: 'SkiErg', specifiche: '500m', intensita: '8', ...extra })
  const classe = () => ''
  const monta = (props) => render(<ul><RigaCartaTV classeIntensita={classe} {...props} /></ul>)

  it('mostra l\'intensità mentre la persona lavora', () => {
    monta({ riga: riga(), chi: persone })
    expect(screen.getByText('8/10')).toBeTruthy()
    expect(screen.getByText('Marco')).toBeTruthy()
  })

  it('mostra l\'intensità anche nel riposo, quando dice dove si andrà', () => {
    monta({ riga: riga({ intensita: '6' }), chi: persone, inArrivo: true })
    expect(screen.getByText('6/10')).toBeTruthy()
  })

  it('mostra l\'intensità su una riga senza nessuno sopra', () => {
    monta({ riga: riga({ nome: 'Burpees', intensita: '7' }), chi: [] })
    expect(screen.getByText('7/10')).toBeTruthy()
  })

  it('il prossimo esercizio porta «Poi»', () => {
    monta({ riga: riga(), poi: true })
    expect(screen.getByText('Poi')).toBeTruthy()
  })
})
