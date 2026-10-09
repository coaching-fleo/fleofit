import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { montaPagina } from '../../test/montaPagina'
import { impronta, testoPulito, VERSIONE } from '../../../supabase/functions/estrai-note/regole.ts'

// Perché questi test esistono
// ────────────────────────────
// La sezione «Dalle note» vive in una pagina che è ANCHE `/profile`, la
// scheda che l'atleta vede di sé. Lì non deve comparire, e non deve nemmeno
// partire niente: né la lettura della tabella né l'analisi con l'IA. Per il
// coach, l'IA si chiama solo se c'è davvero qualcosa da analizzare, e un'IA
// che non risponde non deve rompere la scheda.

const dati = await vi.hoisted(async () => ({ atleta: null, workouts: [], estratti: [], tabellaAssente: false }))
const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  return fintoSupabase(() => ({
    athletes: [dati.atleta], athlete_workouts: dati.workouts, personal_records: [], note_estratte: dati.estratti,
  }), { erroreSu: () => (dati.tabellaAssente ? ['note_estratte'] : []), codiceErrore: 'PGRST205' })
})
vi.mock('../../supabaseClient', () => ({ supabase: finto.supabase }))

const AthleteDetail = (await import('../AthleteDetail')).default

const ATLETA = { id: 'a1', name: 'Sofia', surname: 'Neri', photo_url: null, weight: 60, height: 168, birth_date: '1995-01-01', instagram_url: null, strava_url: null, notes: null }
const giorno = (scarto) => new Date(Date.now() + scarto * 86400000).toISOString().split('T')[0]
const riga = (id, notes) => ({ id, completed_date: giorno(-2), status: 'completed', notes, voice_note_url: null, workouts: { id: `w-${id}`, title: 'Hyrox', sections: { category: 'Hyrox', blocks: [] } } })
const estratto = (w) => ({ athlete_workout_id: w.id, data: w.completed_date, versione: VERSIONE, impronta: impronta(testoPulito(w.notes)),
  estrazione: { stato: [], risultati: [], sensazioni: { seduta: { difficolta: null, citazioni: [] }, parti: [], modifiche: [] } } })

const comeCoach = () => montaPagina(<AthleteDetail />, {
  role: 'admin', user: { id: 'coach', email: 'c@f.it' }, percorso: '/athletes/a1', rotta: '/athletes/:id',
})
const comeAtleta = () => montaPagina(<AthleteDetail />, { role: 'athlete', user: { id: 'a1', email: 'a@f.it' } })
const attendi = () => waitFor(() => expect(screen.getByRole('heading', { name: /Sofia Neri/ })).toBeInTheDocument())
const chiamateIA = () => finto.supabase.functions.invoke.mock.calls.filter(c => c[0] === 'estrai-note')

beforeEach(() => {
  dati.atleta = { ...ATLETA }
  dati.workouts = []
  dati.estratti = []
  dati.tabellaAssente = false
  finto.chiamate.length = 0
  finto.supabase.functions.invoke.mockReset()
  finto.supabase.functions.invoke.mockImplementation(() => Promise.resolve({ data: { estratte: 0, restano: 0, sospesa: false }, error: null }))
})

describe('«Dalle note» nella scheda atleta', () => {
  it('il coach la vede', async () => {
    dati.workouts = [riga('x', 'wall balls in 6:40')]
    comeCoach()
    await attendi()
    expect(await screen.findByRole('heading', { name: 'Dalle note' })).toBeInTheDocument()
  })

  it('l\'atleta sul proprio profilo no: niente sezione, niente lettura, niente IA', async () => {
    dati.workouts = [riga('x', 'wall balls in 6:40')]
    comeAtleta()
    await attendi()
    await new Promise(r => setTimeout(r, 50))
    expect(screen.queryByRole('heading', { name: 'Dalle note' })).not.toBeInTheDocument()
    expect(finto.chiamateA('note_estratte')).toHaveLength(0)
    expect(chiamateIA()).toHaveLength(0)
  })

  it('con note da analizzare chiama l\'IA una volta e poi rilegge la tabella', async () => {
    dati.workouts = [riga('x', 'wall balls in 6:40')]
    comeCoach()
    await attendi()
    await waitFor(() => expect(chiamateIA()).toHaveLength(1))
    expect(chiamateIA()[0][1]).toEqual({ body: { athlete_id: 'a1' } })
    await waitFor(() => expect(finto.chiamateA('note_estratte', 'select')).toHaveLength(2))
  })

  it('senza note da analizzare non chiama l\'IA', async () => {
    const w = riga('x', 'wall balls in 6:40')
    dati.workouts = [w]
    dati.estratti = [estratto(w)]
    comeCoach()
    await attendi()
    await waitFor(() => expect(finto.chiamateA('note_estratte', 'select')).toHaveLength(1))
    await new Promise(r => setTimeout(r, 50))
    expect(chiamateIA()).toHaveLength(0)
  })

  it('un\'IA che non risponde lascia la scheda intera e lo dice', async () => {
    finto.supabase.functions.invoke.mockImplementation(() => Promise.resolve({ data: { estratte: 0, restano: 1, sospesa: true }, error: null }))
    dati.workouts = [riga('x', 'wall balls in 6:40')]
    comeCoach()
    await attendi()
    expect(await screen.findByText(/analisi sospesa/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Sofia Neri/ })).toBeInTheDocument()
  })

  it('finché la tabella non esiste la sezione non c\'è, e l\'IA non parte', async () => {
    dati.tabellaAssente = true
    dati.workouts = [riga('x', 'wall balls in 6:40')]
    comeCoach()
    await attendi()
    await waitFor(() => expect(finto.chiamateA('note_estratte', 'select')).toHaveLength(1))
    await new Promise(r => setTimeout(r, 50))
    expect(screen.queryByRole('heading', { name: 'Dalle note' })).not.toBeInTheDocument()
    expect(screen.queryByText(/Non è stato possibile leggere/)).not.toBeInTheDocument()
    expect(chiamateIA()).toHaveLength(0)
  })
})
