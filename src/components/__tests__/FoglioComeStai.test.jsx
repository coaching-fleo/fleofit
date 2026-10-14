import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FoglioComeStai from '../FoglioComeStai'

// Il foglio di «Come stai oggi». I casi: «Fatto» non parte senza almeno una
// risposta, le risposte arrivano col loro numero, e chiudere vuol dire saltare.

describe('FoglioComeStai', () => {
  it('quattro domande, cinque scelte l\'una, e «Fatto» manda solo ciò che si è scelto', async () => {
    const onSalva = vi.fn(() => Promise.resolve(true))
    render(<FoglioComeStai onSalva={onSalva} onSalta={vi.fn()} />)
    expect(screen.getAllByRole('radiogroup')).toHaveLength(4)
    const fatto = screen.getByRole('button', { name: 'Fatto' })
    expect(fatto).toBeDisabled()

    const user = userEvent.setup()
    await user.click(screen.getByRole('radio', { name: 'Sonno: Buono' }))
    await user.click(screen.getByRole('radio', { name: 'Stress: Alto' }))
    expect(screen.getByRole('radio', { name: 'Sonno: Buono' })).toHaveAttribute('aria-checked', 'true')
    await user.click(fatto)
    expect(onSalva).toHaveBeenCalledWith({ sonno: 4, stress: 2 })
  })

  it('i bottoni dicono parole, non numeri, e la risposta buona è a destra', () => {
    render(<FoglioComeStai onSalva={vi.fn()} onSalta={vi.fn()} />)
    const dolori = screen.getByRole('radiogroup', { name: 'Dolori muscolari' })
    const voci = [...dolori.querySelectorAll('[role="radio"]')].map(b => b.textContent)
    expect(voci).toEqual(['Molti', 'Parecchi', 'Qualcuno', 'Pochi', 'Nessuno'])
    expect(screen.queryByRole('radio', { name: /su 5/ })).toBeNull()
  })

  it('«Salta» salta, la X chiude: due gesti diversi, nessuno dei due salva', async () => {
    const onSalva = vi.fn()
    const onSalta = vi.fn()
    const onChiudi = vi.fn()
    render(<FoglioComeStai onSalva={onSalva} onSalta={onSalta} onChiudi={onChiudi} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Salta' }))
    await user.click(screen.getByRole('button', { name: 'Chiudi' }))
    expect(onSalta).toHaveBeenCalledTimes(1)
    expect(onChiudi).toHaveBeenCalledTimes(1)
    expect(onSalva).not.toHaveBeenCalled()
  })
})
