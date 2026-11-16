import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EsercizioTV } from '../TVDashboardUI'

// Con più persone sulla TV la riga cambia disegno (colori e nomi):
// l'intensità del coach deve restare, al lavoro e «in arrivo».
describe('EsercizioTV con le persone', () => {
  const persone = [{ id: 'a', nome: 'Marco', colore: '#f97316' }]

  it('mostra l\'intensità mentre la persona lavora', () => {
    render(<EsercizioTV nome="SkiErg" specifiche="500m" intensita="8" classeIntensita="" persone={persone} />)
    expect(screen.getByText('8/10')).toBeTruthy()
    expect(screen.getByText('Marco')).toBeTruthy()
  })

  it('mostra l\'intensità anche nel riposo («Poi»)', () => {
    render(<EsercizioTV nome="SkiErg" intensita="6" classeIntensita="" persone={persone} inArrivo />)
    expect(screen.getByText('6/10')).toBeTruthy()
  })

  it('mostra l\'intensità su una riga senza nessuno sopra', () => {
    render(<EsercizioTV nome="Burpees" intensita="7" classeIntensita="" persone={[]} />)
    expect(screen.getByText('7/10')).toBeTruthy()
  })
})
