import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { addDays, format, subMonths, startOfMonth, setDate } from 'date-fns'
import FoglioSposta from '../FoglioSposta'
import { dataBreve, giornoBreve } from '../../lib/spostaAllenamento'

// Il foglio «Sposta l'allenamento»: niente conferma senza un giorno nuovo, la
// data scelta arriva a chi l'ha aperto, e su un errore il foglio resta aperto.

const domani = format(addDays(new Date(), 1), 'yyyy-MM-dd')
const dopodomani = format(addDays(new Date(), 2), 'yyyy-MM-dd')

describe('FoglioSposta', () => {
  it('«Sposta» parte solo dopo aver scelto, e manda la data', async () => {
    const onConferma = vi.fn(() => Promise.resolve(true))
    render(<FoglioSposta titolo="Sled · EM 24′ @8" dataAttuale={domani} onChiudi={vi.fn()} onConferma={onConferma} />)
    // Il nome senza il codice in coda.
    expect(screen.getByText('Sled')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sposta' })).toBeDisabled()
    // Il giorno in cui sta già non si propone.
    expect(screen.queryByRole('button', { name: dataBreve(domani) })).toBeNull()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: dataBreve(dopodomani) }))
    const conferma = screen.getByRole('button', { name: `Sposta a ${giornoBreve(dopodomani)}` })
    await user.click(conferma)
    expect(onConferma).toHaveBeenCalledWith(dopodomani)
  })

  it('se lo spostamento non riesce si può riprovare', async () => {
    const onConferma = vi.fn(() => Promise.resolve(false))
    render(<FoglioSposta titolo="Corsa" dataAttuale={domani} onChiudi={vi.fn()} onConferma={onConferma} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: dataBreve(dopodomani) }))
    await user.click(screen.getByRole('button', { name: `Sposta a ${giornoBreve(dopodomani)}` }))
    expect(await screen.findByRole('button', { name: `Sposta a ${giornoBreve(dopodomani)}` })).toBeEnabled()
  })

  it('si chiude con la X e con Annulla (anche il tasto indietro di Android)', async () => {
    const onChiudi = vi.fn()
    render(<FoglioSposta titolo="Corsa" dataAttuale={domani} onChiudi={onChiudi} onConferma={vi.fn()} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Chiudi' }))
    await user.click(screen.getByRole('button', { name: 'Annulla' }))
    expect(onChiudi).toHaveBeenCalledTimes(2)
  })
})

// Il coach (26/11/2026): può correggere anche un giorno passato, e con più
// atleti sceglie se spostare solo quello che guarda o tutta la seduta.
describe('FoglioSposta · coach', () => {
  const ass = [
    { id: 'a', status: 'pending', completed_date: domani },
    { id: 'b', status: 'completed', completed_date: domani },
    { id: 'c', status: 'pending', completed_date: domani },
  ]

  it('il coach conferma anche una data passata', async () => {
    const meseFa = startOfMonth(subMonths(new Date(), 2))
    const quindici = format(setDate(meseFa, 15), 'yyyy-MM-dd')
    const onConferma = vi.fn(() => Promise.resolve(true))
    render(<FoglioSposta modo="coach" nomeAtleta="Marco" titolo="Corsa" dataAttuale={format(meseFa, 'yyyy-MM-dd')}
      onChiudi={vi.fn()} onConferma={onConferma} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Scegli una data' }))
    await user.click(screen.getByRole('button', { name: '15' }))
    await user.click(screen.getByRole('button', { name: `Sposta a ${giornoBreve(quindici)}` }))
    expect(onConferma).toHaveBeenCalledWith(quindici, 'solo')
  })

  it('toggle «Solo · Tutti» e «Sposta tutti a …»', async () => {
    const onConferma = vi.fn(() => Promise.resolve(true))
    render(<FoglioSposta modo="coach" nomeAtleta="Marco" titolo="Corsa" dataAttuale={domani}
      assegnazioni={ass} dataWorkout={domani} onChiudi={vi.fn()} onConferma={onConferma} />)
    expect(screen.getByRole('radio', { name: 'Solo Marco' })).toHaveAttribute('aria-checked', 'true')
    const user = userEvent.setup()
    await user.click(screen.getByRole('radio', { name: 'Tutti (3)' }))
    expect(screen.getByText('1 resta dove sta: già svolto')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: dataBreve(dopodomani) }))
    await user.click(screen.getByRole('button', { name: `Sposta tutti a ${giornoBreve(dopodomani)}` }))
    expect(onConferma).toHaveBeenCalledWith(dopodomani, 'tutti')
  })

  it('con una sola assegnazione niente scelta', () => {
    render(<FoglioSposta modo="coach" nomeAtleta="Marco" titolo="Corsa" dataAttuale={domani}
      assegnazioni={[ass[0]]} dataWorkout={domani} onChiudi={vi.fn()} onConferma={vi.fn()} />)
    expect(screen.queryByRole('radiogroup')).toBeNull()
  })

  it('senza atleta parte da «Tutti»', () => {
    render(<FoglioSposta modo="coach" titolo="Corsa" dataAttuale={domani}
      assegnazioni={ass} dataWorkout={domani} onChiudi={vi.fn()} onConferma={vi.fn()} />)
    expect(screen.getByText(/In che giorno lo sposti\?/)).toBeInTheDocument()
    expect(screen.queryByRole('radiogroup')).toBeNull()
    expect(screen.getByText('1 resta dove sta: già svolto')).toBeInTheDocument()
  })

  it('«Tutti» conta solo chi ha la seduta quel giorno', () => {
    const altri = [...ass, { id: 'x', status: 'pending', completed_date: dopodomani }]
    render(<FoglioSposta modo="coach" nomeAtleta="Marco" titolo="Corsa" dataAttuale={domani}
      assegnazioni={altri} onChiudi={vi.fn()} onConferma={vi.fn()} />)
    expect(screen.getByRole('radio', { name: 'Tutti (3)' })).toBeInTheDocument()
  })

  it('niente scelta se quel giorno ce l\'ha solo lui', () => {
    const soli = [ass[0], { id: 'x', status: 'pending', completed_date: dopodomani }]
    render(<FoglioSposta modo="coach" nomeAtleta="Marco" titolo="Corsa" dataAttuale={domani}
      assegnazioni={soli} onChiudi={vi.fn()} onConferma={vi.fn()} />)
    expect(screen.queryByRole('radiogroup')).toBeNull()
  })
})
