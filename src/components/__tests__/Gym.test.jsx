import { describe, it, expect } from 'vitest'
import { useEffect, useState } from 'react'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CreaGym from '../CreaGym'
import SchedaGymUI from '../SchedaGymUI'

// La categoria Gym (13/10/2026): il builder e la scheda dell'atleta.

// Lo stato del builder, letto dopo ogni gesto.
const visto = { gruppi: null }
function Banco({ iniziali = [] }) {
  const [gruppi, setGruppi] = useState(iniziali)
  useEffect(() => { visto.gruppi = gruppi }, [gruppi])
  return <CreaGym gruppi={gruppi} setGruppi={setGruppi} />
}

describe('il builder Gym', () => {
  it('il picker aggiunge più esercizi in un colpo, ognuno con 3 × 10', async () => {
    const user = userEvent.setup()
    render(<Banco />)
    await user.click(screen.getByRole('button', { name: /Aggiungi il primo esercizio/ }))
    const foglio = screen.getByRole('dialog', { name: 'Aggiungi esercizi' })
    await user.type(within(foglio).getByRole('searchbox', { name: 'Cerca un esercizio' }), 'panca piana')
    await user.click(within(foglio).getByRole('button', { name: /Panca piana con bilanciere/ }))
    await user.clear(within(foglio).getByRole('searchbox'))
    await user.type(within(foglio).getByRole('searchbox'), 'push down con corda')
    await user.click(within(foglio).getByRole('button', { name: /Push down con corda/ }))
    await user.click(within(foglio).getByRole('button', { name: 'Aggiungi 2 esercizi' }))

    await waitFor(() => expect(visto.gruppi).toHaveLength(2))
    expect(visto.gruppi.map(g => g.esercizi[0].name)).toEqual(['Panca piana con bilanciere', 'Push down con corda'])
    expect(visto.gruppi[0]).toMatchObject({ fase: 'principale', serie: '3', recupero: '1:30' })
    expect(screen.getAllByText('3 × 10 · rec 1:30')).toHaveLength(2)
  })

  it('un esercizio scritto a mano diventa un custom', async () => {
    const user = userEvent.setup()
    render(<Banco />)
    await user.click(screen.getByRole('button', { name: /Aggiungi al riscaldamento/ }))
    const foglio = screen.getByRole('dialog')
    await user.type(within(foglio).getByRole('searchbox'), 'Corda con i pesi')
    await user.click(within(foglio).getByRole('button', { name: /Aggiungi «Corda con i pesi»/ }))
    await user.click(within(foglio).getByRole('button', { name: 'Aggiungi 1 esercizio' }))
    await waitFor(() => expect(visto.gruppi).toHaveLength(1))
    expect(visto.gruppi[0]).toMatchObject({ fase: 'riscaldamento', serie: '1', esercizi: [{ name: 'Corda con i pesi' }] })
  })

  it('«Superserie con il successivo» unisce, «Scollega» separa', async () => {
    const user = userEvent.setup()
    const g = (id, name) => ({ id, fase: 'principale', serie: '3', recupero: '1:00', note: '', esercizi: [{ id: id + 10, name, reps: '10', kg: '' }] })
    render(<Banco iniziali={[g(1, 'Curl con manubri'), g(2, 'Push down ai cavi')]} />)
    await user.click(screen.getByRole('button', { name: /Superserie con il successivo/ }))
    expect(visto.gruppi).toHaveLength(1)
    expect(visto.gruppi[0].esercizi.map(e => e.name)).toEqual(['Curl con manubri', 'Push down ai cavi'])
    expect(screen.getByText('Superserie')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Scollega Push down ai cavi' }))
    expect(visto.gruppi.map(x => x.esercizi.length)).toEqual([1, 1])
    expect(visto.gruppi[1].esercizi[0].name).toBe('Push down ai cavi')
  })
})

describe('la scheda Gym dell\'atleta', () => {
  const scheda = [{ id: 'g', fase: 'principale', serie: '3', recupero: '1:30', note: '',
    esercizi: [{ id: 'e', name: 'Squat con bilanciere', reps: '8', kg: '80 kg' }] }]

  it('spuntare una serie fa partire il recupero; l\'ultima no', async () => {
    const user = userEvent.setup()
    render(<SchedaGymUI gruppi={scheda} interattiva />)
    const serie = screen.getAllByRole('button', { name: /8 × 80 kg/ })
    expect(serie).toHaveLength(3)
    expect(screen.queryByRole('timer')).toBeNull()

    await user.click(serie[0])
    expect(serie[0]).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('timer')).toHaveAccessibleName(/Recupero: 1:(30|29)/)

    await user.click(screen.getByRole('button', { name: 'Salta il recupero' }))
    expect(screen.queryByRole('timer')).toBeNull()
    await user.click(serie[2])
    expect(screen.queryByRole('timer')).toBeNull()
  })

  it('il coach la legge senza spunte', () => {
    render(<SchedaGymUI gruppi={scheda} />)
    expect(screen.getByText('Squat con bilanciere')).toBeInTheDocument()
    expect(screen.getByText('3 × 8 · 80 kg · rec 1:30')).toBeInTheDocument()
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })
})
