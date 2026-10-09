import { describe, it, expect, vi, beforeEach } from 'vitest'

// Perché questi test esistono
// ────────────────────────────
// La scheda atleta non deve mai rompersi per colpa dell'IA o della tabella:
// una lettura fallita e un'estrazione fallita hanno ognuna uno stato suo, e
// la sezione lo dice invece di mostrare grafici vuoti come se fossero veri.

const finto = vi.hoisted(() => ({ select: null, invoke: null, chiamate: [] }))
vi.mock('../../supabaseClient', () => ({
  supabase: {
    from: (tabella) => ({
      select: (campi) => ({
        eq: (col, val) => { finto.chiamate.push({ tabella, campi, col, val }); return finto.select() },
      }),
    }),
    functions: { invoke: (...a) => finto.invoke(...a) },
  },
}))

const { leggiEstratti, estraiMancanti } = await import('../noteEstratte')

beforeEach(() => { finto.chiamate = [] })

describe('leggiEstratti', () => {
  it('legge la tabella per atleta', async () => {
    finto.select = () => Promise.resolve({ data: [{ athlete_workout_id: 'a' }], error: null })
    expect(await leggiEstratti('at-1')).toEqual({ dati: [{ athlete_workout_id: 'a' }], errore: false })
    expect(finto.chiamate[0]).toMatchObject({ tabella: 'note_estratte', col: 'athlete_id', val: 'at-1' })
  })
  it('una lettura fallita ha uno stato suo', async () => {
    finto.select = () => Promise.resolve({ data: null, error: { message: 'x' } })
    expect(await leggiEstratti('at-1')).toEqual({ dati: [], errore: true })
  })
})

describe('estraiMancanti', () => {
  it('passa la risposta della funzione', async () => {
    finto.invoke = vi.fn(() => Promise.resolve({ data: { estratte: 3, restano: 0, sospesa: false }, error: null }))
    expect(await estraiMancanti('at-1')).toEqual({ estratte: 3, restano: 0, sospesa: false })
    expect(finto.invoke).toHaveBeenCalledWith('estrai-note', { body: { athlete_id: 'at-1' } })
  })
  it('un errore della funzione è un\'analisi sospesa', async () => {
    finto.invoke = () => Promise.resolve({ data: null, error: {} })
    expect(await estraiMancanti('at-1')).toEqual({ estratte: 0, restano: null, sospesa: true })
  })
  it('anche un errore di rete', async () => {
    finto.invoke = () => Promise.reject(new Error('rete'))
    expect(await estraiMancanti('at-1')).toEqual({ estratte: 0, restano: null, sospesa: true })
  })
})
