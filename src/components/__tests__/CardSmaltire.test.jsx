import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CardSmaltire } from '../CruscottoCoachUI'
import { cosaGuardare } from '../../lib/cosaGuardare'

const voci = cosaGuardare({
  recupero: [{ id: 'a1', nome: 'Sara Rossi', foto: null, segnali: [{ tipo: 'hrv', giorni: 3, testo: 'HRV sotto la sua media da 3 notti' }] }],
  fermi: [{ id: 'a2', nome: 'Luca Bianchi', foto: null, giorni: 9 }],
})

describe('CardSmaltire con un segnale di recupero', () => {
  it.each([[true, 'telefono'], [false, 'desktop']])('compatto=%s (%s): non si rompe e mostra la pillola grigia', (compatto) => {
    render(<CardSmaltire voci={voci} compatto={compatto} onApri={() => {}} />)
    expect(screen.getByText('Garmin · HRV sotto la sua media da 3 notti')).toBeTruthy()
    const pillola = screen.getByText('Recupero')
    expect(pillola.className).toContain('text-gray-300')
  })

  it('un tipo sconosciuto non butta giù la Home: pillola neutra', () => {
    const strano = [{ chiave: 'x', tipo: 'mai-visto', dato: {}, nome: 'Anna', foto: null, riga: 'boh', azione: 'Apri' }]
    render(<CardSmaltire voci={strano} compatto onApri={() => {}} />)
    expect(screen.getByText('Anna')).toBeTruthy()
  })
})
