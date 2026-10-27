import { describe, it, expect, vi } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { format, startOfMonth, addDays, addMonths } from 'date-fns'
import { it as itLocale } from 'date-fns/locale'
import CalendarioAtleta from '../CalendarioAtleta'

// Perché questi test esistono
// ────────────────────────────
// Il calendario della scheda atleta (27/10/2026) riceve le assegnazioni che
// la pagina ha già caricato, nella forma di `athlete_workouts` con il workout
// annidato: non è la forma della pagina Calendario, e una traduzione sbagliata
// non darebbe errore — darebbe un mese vuoto. Qui si prende:
//  · che le assegnazioni finiscano nel giorno giusto, con lo stato e l'RPE;
//  · che la fascia conti i FATTI su quelli del mese (qui lo stato c'è);
//  · che «Assegna il …» porti la data del giorno scelto, non quella di oggi;
//  · che una riga apra QUEL workout.

const inizio = startOfMonth(new Date())
const chiave = (d) => format(d, 'yyyy-MM-dd')
const cella = (d) => screen.getByRole('button', { name: new RegExp(`^${format(d, 'd MMMM', { locale: itLocale })},`) })
const amrap = { category: 'Hyrox', blocks: [{ type: 'AMRAP', params: { duration: '20:00' } }] }

const assegnazioni = [
  { id: 'aw1', completed_date: chiave(inizio), status: 'completed', notes: '[RPE: 8/10]\nok',
    workouts: { id: 'w1', title: 'Hyrox Strength', sections: amrap } },
  { id: 'aw2', completed_date: chiave(addDays(inizio, 1)), status: 'pending', notes: null,
    workouts: { id: 'w2', title: 'Long Run', sections: { category: 'Running', steps: [] } } },
  { id: 'aw3', completed_date: chiave(addMonths(inizio, 1)), status: 'pending', notes: null,
    workouts: { id: 'w3', title: 'Mese dopo', sections: amrap } },
  // Un'assegnazione col workout cancellato: non deve rompere niente.
  { id: 'aw4', completed_date: chiave(inizio), status: 'pending', notes: null, workouts: null },
]

// Il calendario parte chiuso (27/10/2026): quasi tutti i casi lo aprono prima.
const apri = () => userEvent.click(screen.getByRole('button', { name: /^Calendario/ }))
const monta = async (props = {}) => {
  render(<CalendarioAtleta assegnazioni={assegnazioni} onApri={vi.fn()} onAssegna={vi.fn()} {...props} />)
  await apri()
}

describe('CalendarioAtleta', () => {
  it('parte chiuso: la riga dice il mese, la griglia non c\'è', async () => {
    render(<CalendarioAtleta assegnazioni={assegnazioni} onApri={vi.fn()} onAssegna={vi.fn()} />)
    const riga = screen.getByRole('button', { name: /^Calendario/ })
    expect(riga).toHaveAttribute('aria-expanded', 'false')
    expect(riga).toHaveTextContent(format(inizio, 'yyyy'))
    expect(screen.queryByRole('group', { name: 'Riepilogo del mese' })).not.toBeInTheDocument()
    await userEvent.click(riga)
    expect(riga).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('group', { name: 'Riepilogo del mese' })).toBeInTheDocument()
  })

  it('richiuso e riaperto, resta sul mese scelto', async () => {
    await monta()
    await userEvent.click(screen.getByRole('button', { name: 'Mese successivo' }))
    await apri()
    await apri()
    expect(screen.getByRole('button', { name: 'Oggi' })).toBeInTheDocument()
  })

  it('mette ogni assegnazione nel suo giorno, con stato e RPE', async () => {
    await monta()
    expect(cella(inizio)).toHaveAccessibleName(/1 allenamento, 1 completato/)
    await userEvent.click(cella(inizio))
    const riga = screen.getByRole('button', { name: /Hyrox Strength/ })
    expect(within(riga).getByText('Fatto')).toBeInTheDocument()
    expect(within(riga).getByText(/RPE 8/)).toBeInTheDocument()

    await userEvent.click(cella(addDays(inizio, 1)))
    const corsa = screen.getByRole('button', { name: /Long Run/ })
    expect(within(corsa).getByText('Da fare')).toBeInTheDocument()
  })

  it('la fascia conta i fatti su quelli del mese, senza il mese dopo', async () => {
    await monta()
    const fascia = screen.getByRole('group', { name: 'Riepilogo del mese' })
    expect(within(fascia).getByText('Completati')).toBeInTheDocument()
    expect(within(fascia).getByText('/2')).toBeInTheDocument()
  })

  it('«Assegna il …» porta la data del giorno scelto', async () => {
    const onAssegna = vi.fn()
    await monta({ onAssegna })
    const giorno = addDays(inizio, 1)
    await userEvent.click(cella(giorno))
    await userEvent.click(screen.getByRole('button', { name: `Assegna il ${format(giorno, 'd MMMM', { locale: itLocale })}` }))
    expect(onAssegna).toHaveBeenCalledWith(chiave(giorno))
  })

  it('una riga apre quel workout', async () => {
    const onApri = vi.fn()
    await monta({ onApri })
    await userEvent.click(cella(inizio))
    await userEvent.click(screen.getByRole('button', { name: /Hyrox Strength/ }))
    expect(onApri).toHaveBeenCalledWith('w1')
  })

  it('lo swipe a sinistra porta al mese dopo', async () => {
    await monta()
    const carta = screen.getByRole('group', { name: 'Riepilogo del mese' }).parentElement
    fireEvent.touchStart(carta, { touches: [{ clientX: 300, clientY: 300 }] })
    fireEvent.touchEnd(carta, { changedTouches: [{ clientX: 150, clientY: 300 }] })
    const dopo = format(addMonths(inizio, 1), 'MMMM', { locale: itLocale })
    expect(screen.getByRole('button', { name: /^Calendario/ })).toHaveTextContent(new RegExp(dopo, 'i'))
  })

  it('cambia mese, e allora compare «Oggi»', async () => {
    await monta()
    expect(screen.queryByRole('button', { name: 'Oggi' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Mese successivo' }))
    expect(screen.getByRole('button', { name: 'Oggi' })).toBeInTheDocument()
    await userEvent.click(cella(addMonths(inizio, 1)))
    expect(screen.getByRole('button', { name: /Mese dopo/ })).toBeInTheDocument()
  })
})
