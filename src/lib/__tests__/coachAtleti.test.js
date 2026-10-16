import { describe, it, expect, vi } from 'vitest'
import { normalizzaEmail, aggiungiCoach, togliCoach, assegnaAtleta } from '../coachAtleti'
import { COACHING_ID, escludiDallaRubrica } from '../constants'

// Un finto client che registra le chiamate e risponde con quello che gli si dice.
function finto({ righeCoachAtleti = [], errore = null } = {}) {
  const log = []
  const catena = (tabella) => {
    const q = {
      select: (...a) => { log.push([tabella, 'select', ...a]); return q },
      insert: (v) => { log.push([tabella, 'insert', v]); return Promise.resolve({ error: errore }) },
      delete: () => { log.push([tabella, 'delete']); return q },
      eq: (c, v) => { log.push([tabella, 'eq', c, v]); return q },
      then: (ok, ko) => Promise.resolve({ data: righeCoachAtleti, error: null }).then(ok, ko),
    }
    return q
  }
  return { log, supabase: { from: vi.fn(catena) } }
}

describe('normalizzaEmail', () => {
  it('toglie spazi e maiuscole', () => expect(normalizzaEmail(' Mario@X.it ')).toBe('mario@x.it'))
  it('non è un indirizzo: null', () => {
    expect(normalizzaEmail('mario')).toBeNull()
    expect(normalizzaEmail('mario@x')).toBeNull()
    expect(normalizzaEmail('')).toBeNull()
    expect(normalizzaEmail(null)).toBeNull()
  })
})

describe('aggiungiCoach', () => {
  it('scrive in staff con ruolo coach', async () => {
    const { supabase, log } = finto()
    const r = await aggiungiCoach(supabase, ' Mario@X.it ')
    expect(r.error).toBeNull()
    expect(log).toContainEqual(['staff', 'insert', { email: 'mario@x.it', ruolo: 'coach' }])
  })
  it('con un indirizzo non valido non chiama il database', async () => {
    const { supabase } = finto()
    const r = await aggiungiCoach(supabase, 'mario')
    expect(r.error).toBeTruthy()
    expect(supabase.from).not.toHaveBeenCalled()
  })
})

describe('togliCoach', () => {
  it('rifiuta se ha ancora atleti, senza cancellare', async () => {
    const { supabase, log } = finto({ righeCoachAtleti: [{ athlete_id: 'a1' }] })
    const r = await togliCoach(supabase, 'c@x.it', 'c1')
    expect(r).toEqual({ error: 'Ha ancora atleti' })
    expect(log.some(l => l[1] === 'delete')).toBe(false)
  })
  it('senza atleti cancella la riga di staff', async () => {
    const { supabase, log } = finto()
    const r = await togliCoach(supabase, 'C@x.it', 'c1')
    expect(r.error).toBeNull()
    expect(log).toContainEqual(['staff', 'delete'])
    expect(log).toContainEqual(['staff', 'eq', 'email', 'c@x.it'])
  })
  it('un coach che non ha ancora un account (nessun id) si toglie senza guardare gli atleti', async () => {
    const { supabase, log } = finto()
    const r = await togliCoach(supabase, 'c@x.it', null)
    expect(r.error).toBeNull()
    expect(log.some(l => l[0] === 'coach_atleti')).toBe(false)
  })
})

describe('assegnaAtleta', () => {
  it('sposta: cancella la coppia vecchia, poi inserisce la nuova', async () => {
    const { supabase, log } = finto()
    const r = await assegnaAtleta(supabase, 'a1', 'c2', 'c1')
    expect(r.error).toBeNull()
    const iDel = log.findIndex(l => l[0] === 'coach_atleti' && l[1] === 'delete')
    const iIns = log.findIndex(l => l[0] === 'coach_atleti' && l[1] === 'insert')
    expect(iDel).toBeGreaterThanOrEqual(0)
    expect(iIns).toBeGreaterThan(iDel)
    expect(log).toContainEqual(['coach_atleti', 'eq', 'athlete_id', 'a1'])
    expect(log).toContainEqual(['coach_atleti', 'eq', 'coach_id', 'c1'])
    expect(log[iIns][2]).toEqual({ athlete_id: 'a1', coach_id: 'c2' })
  })
  it('senza vecchio coach inserisce soltanto', async () => {
    const { supabase, log } = finto()
    await assegnaAtleta(supabase, 'a1', 'c2')
    expect(log.some(l => l[1] === 'delete')).toBe(false)
    expect(log.some(l => l[1] === 'insert')).toBe(true)
  })
  it('se l\'inserimento fallisce dopo lo spostamento, il vecchio coach viene rimesso', async () => {
    const { supabase, log } = finto({ errore: { message: 'no' } })
    const r = await assegnaAtleta(supabase, 'a1', 'c2', 'c1')
    expect(r.error).toBeTruthy()
    const inserti = log.filter(l => l[1] === 'insert')
    expect(inserti.at(-1)[2]).toEqual({ athlete_id: 'a1', coach_id: 'c1' })
  })
})

describe('escludiDallaRubrica', () => {
  it('toglie il profilo del coach storico e quello di chi guarda', () => {
    const righe = [{ id: COACHING_ID }, { id: 'me' }, { id: 'a1' }, null, { id: 'a2' }]
    expect(escludiDallaRubrica(righe, 'me').map(r => r.id)).toEqual(['a1', 'a2'])
  })
  it('senza utente toglie solo il coach storico', () => {
    expect(escludiDallaRubrica([{ id: COACHING_ID }, { id: 'a1' }], undefined).map(r => r.id)).toEqual(['a1'])
  })
  it('lista vuota o assente: lista vuota', () => {
    expect(escludiDallaRubrica(null, 'me')).toEqual([])
  })
})
