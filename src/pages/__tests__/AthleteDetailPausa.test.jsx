import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { montaPagina } from '../../test/montaPagina'
import { formatNotePausa, parseNotePausa } from '../../lib/pausa'

// Perché questi test esistono
// ────────────────────────────
// La pausa è un marcatore dentro `athletes.notes`, perché lo schema è congelato
// (CLAUDE.md §9-decies). Tutta la fragilità è lì: la nota è un campo che il
// coach modifica a mano, e la stessa pagina serve DUE ruoli — è anche
// `/profile`, la scheda che l'atleta vede di sé.
//
// ⚠️ E quella nota la legge anche l'atleta: è scritta PER lui, non su di lui
// (CLAUDE.md §4, confermato dal committente). Quindi il marcatore non va mai
// mostrato grezzo, e l'atleta — che può salvare il proprio profilo — non deve
// poter annullare senza saperlo una pausa decisa dal coach.
//
// I casi che non danno errore e fanno danno: la modale «Modifica profilo» che
// risalva la nota e cancella la pausa (da entrambi i ruoli), e la pillola
// arancione che dice all'atleta «ti ho messo in disparte» invece di lasciarlo
// dire al coach.

const dati = await vi.hoisted(async () => ({ atleta: null }))
const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  return fintoSupabase(() => ({
    athletes: [dati.atleta], athlete_workouts: [], personal_records: [],
  }))
})
vi.mock('../../supabaseClient', () => ({ supabase: finto.supabase }))

const AthleteDetail = (await import('../AthleteDetail')).default

const BASE = { id: 'a5', name: 'Andrea', surname: 'Vitali', photo_url: null, weight: 74, height: 181, birth_date: '1992-04-03', instagram_url: null, strava_url: null, notes: null }
const montaComeCoach = () => montaPagina(<AthleteDetail />, { role: 'coach', user: { id: 'coach', email: 'c@f.it' } })
const attendiScheda = () => waitFor(() => expect(screen.getByRole('heading', { name: /Andrea Vitali/ })).toBeInTheDocument())
const noteScritte = () => finto.chiamateA('athletes', 'update').map(c => c.args[0]).filter(a => 'notes' in a)

beforeEach(() => {
  dati.atleta = { ...BASE }
  finto.chiamate.length = 0
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('Il bottone «metti in pausa»', () => {
  it('chiede conferma e poi scrive il marcatore conservando la nota', async () => {
    dati.atleta = { ...BASE, notes: 'Preferisce allenarsi la sera' }
    montaComeCoach()
    await attendiScheda()
    await userEvent.click(screen.getByLabelText(/Metti Andrea in pausa/))
    // Spegnere un allarme per errore non si nota: qui la conferma serve.
    await waitFor(() => expect(screen.getByText(/Mettere in pausa\?/)).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /Conferma/ }))
    await waitFor(() => expect(noteScritte()).toHaveLength(1))
    const scritta = parseNotePausa(noteScritte()[0].notes)
    expect(scritta.inPausa).toBe(true)
    expect(scritta.testo).toBe('Preferisce allenarsi la sera')
  })

  it('togliere la pausa non chiede conferma e ripulisce il marcatore', async () => {
    // Riaccendere un allarme è innocuo: un allarme di troppo si vede da solo.
    dati.atleta = { ...BASE, notes: formatNotePausa('2026-08-20', 'Infortunio') }
    montaComeCoach()
    await attendiScheda()
    await userEvent.click(screen.getByLabelText(/Riattiva Andrea/))
    await waitFor(() => expect(noteScritte()).toHaveLength(1))
    expect(noteScritte()[0].notes).toBe('Infortunio')
  })

  it('mostra da quando la pausa è attiva', async () => {
    dati.atleta = { ...BASE, notes: formatNotePausa('2026-08-20', '') }
    montaComeCoach()
    await attendiScheda()
    expect(screen.getByText(/In pausa dal 20 ago/i)).toBeInTheDocument()
  })

  it('il marcatore non compare come testo della nota', async () => {
    dati.atleta = { ...BASE, notes: formatNotePausa('2026-08-20', 'Riprende a settembre') }
    montaComeCoach()
    await attendiScheda()
    expect(screen.getByText('Riprende a settembre')).toBeInTheDocument()
    expect(screen.queryByText(/\[PAUSA/)).not.toBeInTheDocument()
  })
})

describe('Quello che l\'atleta NON deve vedere', () => {
  it('la pillola «in pausa» non compare sul proprio profilo', async () => {
    // È uno stato interno della programmazione del coach. Comunicarlo con una
    // pillola arancione al posto di una telefonata è il modo sbagliato.
    dati.atleta = { ...BASE, notes: formatNotePausa('2026-08-20', 'Infortunio') }
    montaPagina(<AthleteDetail />, { role: 'athlete', user: { id: 'a5', email: 'a@f.it' } })
    await attendiScheda()
    expect(screen.queryByText(/In pausa dal/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/in pausa/i)).not.toBeInTheDocument()
  })
})

describe('La modale «Modifica profilo»', () => {
  const salvaNoteDa = async (ruolo, utente) => {
    dati.atleta = { ...BASE, notes: formatNotePausa('2026-08-20', 'Infortunio') }
    montaPagina(<AthleteDetail />, { role: ruolo, user: utente })
    await attendiScheda()
    await userEvent.click(screen.getByLabelText(/Modifica la scheda atleta/))
    const campo = await screen.findByPlaceholderText(/Note biografiche/)
    expect(campo).toHaveValue('Infortunio')          // niente marcatore nel campo
    await userEvent.click(screen.getByRole('button', { name: /^Salva/ }))
    await waitFor(() => expect(noteScritte()).toHaveLength(1))
    return parseNotePausa(noteScritte()[0].notes)
  }

  it('nemmeno l\'atleta annulla la pausa salvando il proprio profilo', async () => {
    // La nota è scritta per lui e lui la modifica: senza il round-trip, un
    // «Salva» sul proprio profilo cancellerebbe una decisione del coach, e
    // nessuno dei due se ne accorgerebbe.
    expect((await salvaNoteDa('athlete', { id: 'a5', email: 'a@f.it' })).inPausa).toBe(true)
  })

  it('non cancella la pausa quando si risalva la scheda', async () => {
    // Il campo note della modale leggeva `athlete.notes` grezzo e lo riscriveva
    // verbatim: ogni «Salva» avrebbe cancellato la pausa in silenzio. È lo
    // stesso difetto che sulla web app fa perdere l'RPE (CLAUDE.md §1.1).
    dati.atleta = { ...BASE, notes: formatNotePausa('2026-08-20', 'Infortunio') }
    montaComeCoach()
    await attendiScheda()
    await userEvent.click(screen.getByLabelText(/Modifica la scheda atleta/))
    const campo = await screen.findByPlaceholderText(/Note biografiche/)
    expect(campo).toHaveValue('Infortunio')          // niente marcatore nel campo
    await userEvent.click(screen.getByRole('button', { name: /^Salva/ }))
    await waitFor(() => expect(noteScritte()).toHaveLength(1))
    expect(parseNotePausa(noteScritte()[0].notes).inPausa).toBe(true)
  })
})
