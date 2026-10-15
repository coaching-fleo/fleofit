import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ListaMessaggi, CardDalCoach } from '../MessaggiUI'

const msg = (o = {}) => ({
  id: 'm1', testo: 'Ciao a tutti', fissato: false, autore: 'c', creato_at: '2026-10-14T09:30:00', modificato_at: null, ...o,
})

describe('MessaggiUI', () => {
  it('lista vuota: la frase dell\'empty state', () => {
    render(<ListaMessaggi messaggi={[]} coach={false} />)
    expect(screen.getByText('Qui troverai i messaggi del coach')).toBeInTheDocument()
  })

  it('un fissato mostra la puntina', () => {
    const { container } = render(<ListaMessaggi messaggi={[msg({ fissato: true })]} coach={false} />)
    expect(container.querySelector('svg.lucide-pin')).not.toBeNull()
  })

  it('un non fissato non mostra la puntina', () => {
    const { container } = render(<ListaMessaggi messaggi={[msg()]} coach={false} />)
    expect(container.querySelector('svg.lucide-pin')).toBeNull()
  })

  it('coach false: nessun bottone azioni', () => {
    render(<ListaMessaggi messaggi={[msg()]} coach={false} />)
    expect(screen.queryByRole('button', { name: 'Azioni messaggio' })).not.toBeInTheDocument()
  })

  it('coach true: il bottone c\'è e chiama onMenu col messaggio', async () => {
    const onMenu = vi.fn()
    const m = msg()
    render(<ListaMessaggi messaggi={[m]} coach onMenu={onMenu} />)
    await userEvent.click(screen.getByRole('button', { name: 'Azioni messaggio' }))
    expect(onMenu).toHaveBeenCalledWith(m)
  })

  it('modificato_at mostra «modificato»', () => {
    render(<ListaMessaggi messaggi={[msg({ modificato_at: '2026-10-14T10:00:00' })]} coach={false} />)
    expect(screen.getByText(/modificato/)).toBeInTheDocument()
  })

  it('senza modificato_at niente «modificato»', () => {
    render(<ListaMessaggi messaggi={[msg()]} coach={false} />)
    expect(screen.queryByText(/modificato/)).not.toBeInTheDocument()
  })

  it('data formattata e id/evidenziato sulla radice', () => {
    render(<ListaMessaggi messaggi={[msg()]} evidenziatoId="m1" coach={false} />)
    expect(screen.getByText(/14 ott · 09:30/)).toBeInTheDocument()
    const riga = document.getElementById('messaggio-m1')
    expect(riga).toHaveAttribute('data-evidenziato', 'true')
  })

  it('CardDalCoach: etichetta, anteprima troncata, onApri al tocco', async () => {
    const onApri = vi.fn()
    render(<CardDalCoach messaggio={msg({ testo: 'x'.repeat(300) })} onApri={onApri} />)
    expect(screen.getByText('Dal coach')).toBeInTheDocument()
    expect(screen.queryByText('x'.repeat(300))).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button'))
    expect(onApri).toHaveBeenCalled()
  })
})
