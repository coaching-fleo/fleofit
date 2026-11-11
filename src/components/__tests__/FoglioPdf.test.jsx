import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FoglioPdf } from '../FoglioPdf'

const apri = (props = {}) => {
  const onSalva = props.onSalva || vi.fn(() => Promise.resolve({ errore: null }))
  const onChiudi = vi.fn()
  render(<FoglioPdf valori={{ nome: '', note: '' }} nomeAccount="Mario Rossi" onSalva={onSalva} onChiudi={onChiudi} {...props} />)
  return { onSalva, onChiudi }
}

describe('FoglioPdf', () => {
  it('conta i caratteri delle note e ha i limiti del database', async () => {
    apri()
    const note = screen.getByLabelText('Note aggiuntive')
    expect(note).toHaveAttribute('maxLength', '600')
    expect(screen.getByLabelText('Nome in intestazione')).toHaveAttribute('maxLength', '60')
    await userEvent.type(note, '0123456789')
    expect(screen.getByText('10 / 600')).toBeInTheDocument()
  })

  it('il placeholder del nome è il nome dell’account', () => {
    apri()
    expect(screen.getByLabelText('Nome in intestazione')).toHaveAttribute('placeholder', 'Mario Rossi')
  })

  it('parte dai valori già salvati', () => {
    apri({ valori: { nome: 'Coach Mario', note: 'Ciao' } })
    expect(screen.getByLabelText('Nome in intestazione')).toHaveValue('Coach Mario')
    expect(screen.getByLabelText('Note aggiuntive')).toHaveValue('Ciao')
  })

  it('salva e chiude', async () => {
    const { onSalva, onChiudi } = apri()
    await userEvent.type(screen.getByLabelText('Nome in intestazione'), 'Mario')
    await userEvent.type(screen.getByLabelText('Note aggiuntive'), 'Scrivimi')
    await userEvent.click(screen.getByRole('button', { name: 'Salva' }))
    expect(onSalva).toHaveBeenCalledWith({ nome: 'Mario', note: 'Scrivimi' })
    await waitFor(() => expect(onChiudi).toHaveBeenCalled())
  })

  it('con un errore resta aperto e lo mostra', async () => {
    const onSalva = vi.fn(() => Promise.resolve({ errore: 'Funzione non ancora attiva: manca la tabella nel database.' }))
    const { onChiudi } = apri({ onSalva })
    await userEvent.click(screen.getByRole('button', { name: 'Salva' }))
    expect(await screen.findByText('Funzione non ancora attiva: manca la tabella nel database.')).toBeInTheDocument()
    expect(onChiudi).not.toHaveBeenCalled()
  })

  it('si chiude con «Annulla»', async () => {
    const { onChiudi, onSalva } = apri()
    await userEvent.click(screen.getByRole('button', { name: 'Annulla' }))
    expect(onChiudi).toHaveBeenCalled()
    expect(onSalva).not.toHaveBeenCalled()
  })
})
