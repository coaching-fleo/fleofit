import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { montaPagina, oggi, UTENTE } from '../../test/montaPagina'

// Perché questo test esiste
// ─────────────────────────
// La regola di WorkoutDetailNotaCompletamento.test.jsx (su un allenamento non
// completato la nota non si salva da sola) vale anche per le card del
// PROFILO dell'atleta (`/profile`), che hanno un loro campo nota e un loro
// «Conferma note». Il 12/10/2026 il committente l'ha provata da lì e la nota si
// è salvata senza domande: la regola c'era solo nella scheda del workout.

const dati = await vi.hoisted(async () => ({ assegnazioni: [] }))
const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  return fintoSupabase(() => ({
    athletes: [{ id: 'u1', name: 'Marco', surname: 'Rinaldi', photo_url: null, notes: null }],
    athlete_workouts: dati.assegnazioni,
    personal_records: [],
  }))
})
vi.mock('../../supabaseClient', () => ({ supabase: finto.supabase }))

const AthleteDetail = (await import('../AthleteDetail')).default

const assegnazione = (status, data = oggi()) => ([{
  id: 'aw1', completed_date: data, status, notes: null, voice_note_url: null,
  workouts: { id: 'w1', title: 'Hyrox Strength #1', sections: { category: 'Hyrox', blocks: [] } },
}])

const apri = () => montaPagina(<AthleteDetail />, { role: 'athlete', user: UTENTE })
// Le card di oggi e quelle dei prossimi giorni hanno due placeholder diversi.
const campoNota = () => screen.findByPlaceholderText(/note dell'atleta su questo workout/i)
const scriviEConferma = async (utente, testo) => {
  await utente.type(await campoNota(), testo)
  // «Conferma note» sulla card di oggi, «Conferma» su quelle dei prossimi giorni.
  await utente.click(screen.getByRole('button', { name: /^Conferma( note)?$/ }))
}
const scritture = () => finto.chiamateA('athlete_workouts', 'update').map(c => c.args[0])
const domanda = () => screen.findByRole('dialog', { name: /Hai completato l.allenamento/ })

beforeEach(() => {
  finto.chiamate.length = 0
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('la nota dal profilo, su un allenamento di oggi non completato', () => {
  beforeEach(() => { dati.assegnazioni = assegnazione('pending') })

  it('non si salva: prima chiede se l’allenamento è stato fatto', async () => {
    const utente = userEvent.setup()
    apri()
    await scriviEConferma(utente, 'Wall balls pesanti')

    expect(await domanda()).toBeInTheDocument()
    expect(scritture()).toEqual([])
  })

  it('con il sì apre l’RPE con la nota dentro, e salva nota e completamento insieme', async () => {
    const utente = userEvent.setup()
    apri()
    await scriviEConferma(utente, 'Wall balls pesanti')
    await utente.click(within(await domanda()).getByRole('button', { name: /Sì, l.ho fatto/ }))

    // Il testo è in due posti: la card e la modale RPE.
    await waitFor(() => expect(screen.getAllByDisplayValue('Wall balls pesanti')).toHaveLength(2))
    await utente.click(screen.getByRole('button', { name: /Fatto!/ }))

    await waitFor(() => expect(scritture()).toHaveLength(1))
    expect(scritture()[0].status).toBe('completed')
    expect(scritture()[0].notes).toContain('Wall balls pesanti')
  })

  it('con il «no» non salva niente e lascia il testo nella card', async () => {
    const utente = userEvent.setup()
    apri()
    await scriviEConferma(utente, 'Wall balls pesanti')
    await utente.click(within(await domanda()).getByRole('button', { name: 'No' }))

    expect(screen.queryByRole('dialog', { name: /Hai completato l.allenamento/ })).not.toBeInTheDocument()
    expect(await campoNota()).toHaveValue('Wall balls pesanti')
    expect(scritture()).toEqual([])
  })
})

describe('la nota dal profilo, su un allenamento programmato più avanti', () => {
  beforeEach(() => { dati.assegnazioni = assegnazione('pending', '2099-01-01') })

  it('con il sì mostra l’avviso della data futura, e non lo chiude subito', async () => {
    const utente = userEvent.setup()
    apri()
    await scriviEConferma(utente, 'Fatto in anticipo')
    await utente.click(within(await domanda()).getByRole('button', { name: /Sì, l.ho fatto/ }))

    expect(await screen.findByRole('dialog', { name: 'Attenzione' })).toBeInTheDocument()
    expect(scritture()).toEqual([])
  })
})

describe('la nota dal profilo, su un allenamento già completato', () => {
  beforeEach(() => { dati.assegnazioni = assegnazione('completed') })

  it('si salva subito, senza domande', async () => {
    const utente = userEvent.setup()
    apri()
    await scriviEConferma(utente, 'Correzione: 9 kg')

    await waitFor(() => expect(scritture()).toHaveLength(1))
    expect(scritture()[0].notes).toContain('Correzione: 9 kg')
    expect(screen.queryByRole('dialog', { name: /Hai completato l.allenamento/ })).not.toBeInTheDocument()
  })
})
