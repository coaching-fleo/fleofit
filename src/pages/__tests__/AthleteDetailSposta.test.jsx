import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { addDays, format } from 'date-fns'
import { montaPagina } from '../../test/montaPagina'

// Perché questi test esistono (26/11/2026)
// ────────────────────────────────────────
// Il coach sposta un allenamento dalla scheda dell'atleta
// (docs/memoria/calendario.md §9-sposta-coach). Da prendere:
//  1. «Sposta» su un prossimo allenamento apre il foglio col nome dell'atleta;
//  2. «Solo» scrive SOLO la sua assegnazione, mai `workouts.date`;
//  3. se la seduta ha altri atleti compare «Tutti (n)».

const dati = await vi.hoisted(async () => ({ assegnazioni: [] }))
const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  return fintoSupabase(() => ({
    athletes: [{ id: 'a1', name: 'Marco', surname: 'Ferrero', photo_url: null, notes: null }],
    athlete_workouts: dati.assegnazioni,
    workouts: [{ id: 'w1', date: dati.assegnazioni[0]?.completed_date }],
    personal_records: [],
  }))
})
vi.mock('../../supabaseClient', () => ({ supabase: finto.supabase }))

const AthleteDetail = (await import('../AthleteDetail')).default
const { dataBreve, giornoBreve } = await import('../../lib/spostaAllenamento')

const domani = format(addDays(new Date(), 1), 'yyyy-MM-dd')
const dopodomani = format(addDays(new Date(), 2), 'yyyy-MM-dd')
const riga = (id) => ({
  id, completed_date: domani, status: 'pending', notes: null, voice_note_url: null, athlete_id: 'a1',
  workouts: { id: 'w1', title: 'Hyrox Strength', sections: { category: 'Hyrox', blocks: [] } },
})

const comeCoach = () => montaPagina(<AthleteDetail />, {
  role: 'admin', user: { id: 'coach', email: 'c@f.it' }, percorso: '/athletes/a1', rotta: '/athletes/:id',
})

beforeEach(() => { dati.assegnazioni = []; finto.chiamate.length = 0 })

describe('Il coach sposta dalla scheda atleta', () => {
  it('«Sposta» su un prossimo allenamento apre il foglio col nome', async () => {
    dati.assegnazioni = [riga('aw1')]
    comeCoach()
    const user = userEvent.setup()
    await user.click((await screen.findAllByRole('button', { name: "Sposta l'allenamento" }))[0])
    const foglio = screen.getByRole('dialog', { name: "Sposta l'allenamento" })
    expect(foglio).toHaveTextContent('Marco ha Hyrox Strength in programma')
  })

  it('«Solo» scrive solo la sua assegnazione', async () => {
    dati.assegnazioni = [riga('aw1')]
    comeCoach()
    const user = userEvent.setup()
    await user.click((await screen.findAllByRole('button', { name: "Sposta l'allenamento" }))[0])
    await user.click(screen.getByRole('button', { name: dataBreve(dopodomani) }))
    await user.click(screen.getByRole('button', { name: `Sposta a ${giornoBreve(dopodomani)}` }))
    await waitFor(() => expect(finto.chiamateA('athlete_workouts', 'update')).toHaveLength(1))
    expect(finto.chiamateA('athlete_workouts', 'update')[0].args[0]).toEqual({ completed_date: dopodomani })
    expect(finto.chiamateA('workouts', 'update')).toHaveLength(0)
  })

  it('con altri atleti sulla seduta compare «Tutti (2)»', async () => {
    dati.assegnazioni = [riga('aw1'), riga('aw2')]
    comeCoach()
    const user = userEvent.setup()
    await user.click((await screen.findAllByRole('button', { name: "Sposta l'allenamento" }))[0])
    expect(await screen.findByRole('radio', { name: 'Tutti (2)' })).toBeInTheDocument()
  })
})
