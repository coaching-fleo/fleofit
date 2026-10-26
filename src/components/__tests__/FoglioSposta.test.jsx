import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { addDays, format } from 'date-fns'
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
