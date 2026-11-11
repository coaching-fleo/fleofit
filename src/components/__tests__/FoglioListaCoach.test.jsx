import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FoglioListaCoach from '../FoglioListaCoach'

// Il foglio dietro ogni numero della Home «Riepilogo»: con centinaia di atleti
// deve restare usabile (blocchi da 60, ricerca, filtri).

const molti = (n) => Array.from({ length: n }, (_, i) => ({
  chiave: `p${i}`, nome: i === 7 ? 'Nicolò Rossi' : `Atleta ${i}`, sotto: 'x',
  categoria: i % 2 ? 'Hyrox' : 'Running',
}))

const monta = (props = {}) => render(
  <FoglioListaCoach titolo="Oggi" persone={molti(150)} onScegli={vi.fn()} onChiudi={vi.fn()} {...props} />,
)

const righe = () => screen.getAllByRole('listitem').filter(li => li.querySelector('button')?.textContent.includes('x'))

describe('FoglioListaCoach', () => {
  it('disegna 60 righe alla volta, poi le altre a richiesta', async () => {
    const utente = userEvent.setup()
    monta()
    expect(righe()).toHaveLength(60)
    await utente.click(screen.getByRole('button', { name: 'Mostra altri 60 di 90' }))
    expect(righe()).toHaveLength(120)
    await utente.click(screen.getByRole('button', { name: 'Mostra altri 30 di 30' }))
    expect(righe()).toHaveLength(150)
    expect(screen.queryByRole('button', { name: /Mostra altri/ })).not.toBeInTheDocument()
  })

  it('cerca senza accenti', async () => {
    const utente = userEvent.setup()
    monta()
    await utente.type(screen.getByRole('searchbox', { name: 'Cerca per nome' }), 'nicolo')
    expect(righe()).toHaveLength(1)
    expect(screen.getByText('Nicolò Rossi')).toBeInTheDocument()
    expect(screen.getByText('1 atleta per «nicolo»')).toBeInTheDocument()
  })

  it('una ricerca senza risultati lo dice', async () => {
    const utente = userEvent.setup()
    monta()
    await utente.type(screen.getByRole('searchbox', { name: 'Cerca per nome' }), 'zzz')
    expect(screen.getByText('Nessuno con questo nome.')).toBeInTheDocument()
  })

  it('i filtri mostrano il conteggio e restringono', async () => {
    const utente = userEvent.setup()
    monta({ filtri: [{ etichetta: 'Tutti', prova: null }, { etichetta: 'Hyrox', prova: p => p.categoria === 'Hyrox' }] })
    expect(screen.getByRole('button', { name: 'Tutti 150' })).toBeInTheDocument()
    await utente.click(screen.getByRole('button', { name: 'Hyrox 75' }))
    expect(screen.getByText('75 atleti')).toBeInTheDocument()
  })

  it('il tocco sceglie, la X chiude', async () => {
    const utente = userEvent.setup()
    const onScegli = vi.fn(); const onChiudi = vi.fn()
    monta({ persone: molti(2), onScegli, onChiudi })
    await utente.click(screen.getByText('Atleta 0'))
    expect(onScegli).toHaveBeenCalledWith(expect.objectContaining({ chiave: 'p0' }))
    await utente.click(screen.getByRole('button', { name: 'Chiudi' }))
    await vi.waitFor(() => expect(onChiudi).toHaveBeenCalled())
  })

  it('una pillola senza nessuno non scrive 0', () => {
    monta({ filtri: [{ etichetta: 'Tutti', prova: null }, { etichetta: 'Gym', prova: p => p.categoria === 'Gym' }] })
    expect(screen.getByRole('button', { name: 'Gym' })).toBeInTheDocument()
  })
})
