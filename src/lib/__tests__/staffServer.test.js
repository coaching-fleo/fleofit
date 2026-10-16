import { describe, it, expect } from 'vitest'
import {
  ruoloStaff, atletiDi, coachDi, destinatariNotificaCoach, idStaff, atletaNotificaCoach,
} from '../../../supabase/functions/_shared/staff.ts'

// Parte pura di «chi è staff» per le Edge Function: il client del database
// viene passato da fuori, così qui basta un finto con la stessa forma.

// Finto client: tabelle → righe; supporta select/eq/maybeSingle e `await`.
function fintoDb(tabelle, { errore = {} } = {}) {
  return {
    from(nome) {
      let righe = tabelle[nome] || []
      const q = {
        select() { return q },
        eq(col, val) { righe = righe.filter(r => r[col] === val); return q },
        maybeSingle() {
          return Promise.resolve(errore[nome]
            ? { data: null, error: errore[nome] }
            : { data: righe[0] ?? null, error: null })
        },
        then(ok, ko) {
          return Promise.resolve(errore[nome]
            ? { data: null, error: errore[nome] }
            : { data: righe, error: null }).then(ok, ko)
        },
      }
      return q
    },
    auth: {
      admin: {
        listUsers: async () => ({ data: { users: tabelle.utenti || [] }, error: null }),
      },
    },
  }
}

describe('ruoloStaff', () => {
  const db = fintoDb({ staff: [{ email: 'c@x.it', ruolo: 'coach' }, { email: 'a@x.it', ruolo: 'admin' }] })
  it('legge il ruolo dalla tabella staff', async () => {
    expect(await ruoloStaff(db, 'c@x.it')).toBe('coach')
    expect(await ruoloStaff(db, ' A@X.it ')).toBe('admin')
  })
  it('un atleta o un\'email assente è null', async () => {
    expect(await ruoloStaff(db, 'atleta@x.it')).toBe(null)
    expect(await ruoloStaff(db, null)).toBe(null)
  })
  it('se la tabella non risponde ripiega sulla lista admin', async () => {
    const rotto = fintoDb({}, { errore: { staff: { message: 'relation "staff" does not exist' } } })
    expect(await ruoloStaff(rotto, 'coaching@federicoleo.it')).toBe('admin')
    expect(await ruoloStaff(rotto, 'atleta@x.it')).toBe(null)
  })
})

describe('coachDi e atletiDi', () => {
  const db = fintoDb({
    coach_atleti: [
      { athlete_id: 'at1', coach_id: 'c1' },
      { athlete_id: 'at1', coach_id: 'c2' },
      { athlete_id: 'at2', coach_id: 'c1' },
    ],
  })
  it('un atleta può avere più coach', async () => {
    expect(await coachDi(db, 'at1')).toEqual(['c1', 'c2'])
    expect(await coachDi(db, 'nessuno')).toEqual([])
  })
  it('gli atleti di un coach', async () => {
    expect(await atletiDi(db, 'c1')).toEqual(['at1', 'at2'])
    expect(await atletiDi(db, 'c2')).toEqual(['at1'])
  })
  // Una lettura fallita NON è «nessun atleta»: per il broadcast vorrebbe dire
  // rispondere «nessun destinatario» come se fosse andata bene. Si lancia, e chi
  // chiama decide (broadcast: errore e si riprova; estrai-note: rifiuta).
  it('se la lettura fallisce lancia', async () => {
    const rotto = fintoDb({}, { errore: { coach_atleti: { message: 'rete', code: '08006' } } })
    await expect(coachDi(rotto, 'at1')).rejects.toThrow()
    await expect(atletiDi(rotto, 'c1')).rejects.toThrow()
  })
  it('la tabella che non esiste ancora (migrazione non applicata) vale nessuno', async () => {
    for (const code of ['42P01', 'PGRST205']) {
      const assente = fintoDb({}, { errore: { coach_atleti: { message: 'non esiste', code } } })
      expect(await coachDi(assente, 'at1')).toEqual([])
      expect(await atletiDi(assente, 'c1')).toEqual([])
    }
  })
})

describe('destinatariNotificaCoach', () => {
  it('ai coach dell\'atleta, se ne ha', () => {
    expect(destinatariNotificaCoach(['c1', 'c2'], ['a1'])).toEqual(['c1', 'c2'])
  })
  it('senza coach, agli admin', () => {
    expect(destinatariNotificaCoach([], ['a1'])).toEqual(['a1'])
  })
})

describe('idStaff', () => {
  const utenti = [
    { id: 'u1', email: 'A@x.it' }, { id: 'u2', email: 'c@x.it' }, { id: 'u3', email: 'atleta@x.it' }, { id: 'u4' },
  ]
  it('separa tutti i membri dagli admin', async () => {
    const db = fintoDb({ utenti, staff: [{ email: 'a@x.it', ruolo: 'admin' }, { email: 'c@x.it', ruolo: 'coach' }] })
    expect(await idStaff(db)).toEqual({ tutti: ['u1', 'u2'], admin: ['u1'] })
  })
  it('senza tabella staff ripiega sulla lista admin', async () => {
    const db = fintoDb({ utenti: [{ id: 'u9', email: 'coaching@federicoleo.it' }, { id: 'u3', email: 'atleta@x.it' }] },
      { errore: { staff: { message: 'x' } } })
    expect(await idStaff(db)).toEqual({ tutti: ['u9'], admin: ['u9'] })
  })
})

describe('atletaNotificaCoach', () => {
  // Un atleta notifica SOLO per sé: se potesse scegliere athleteId (o la rotta)
  // manderebbe ai coach di un altro atleta una notifica a nome suo.
  const ATLETA = { id: 'at1', ruoloStaff: null, servizio: false }
  it('per un atleta conta solo chi chiama: athleteId e rotta del corpo si ignorano', () => {
    expect(atletaNotificaCoach({ athleteId: 'at2' }, ATLETA)).toBe('at1')
    expect(atletaNotificaCoach({ route: '/workout/w1?athlete_id=at2' }, ATLETA)).toBe('at1')
    expect(atletaNotificaCoach({}, ATLETA)).toBe('at1')
  })
  it('per lo staff vale il corpo: athleteId, poi la rotta', () => {
    const coach = { id: 'c1', ruoloStaff: 'coach', servizio: false }
    expect(atletaNotificaCoach({ athleteId: 'at2' }, coach)).toBe('at2')
    expect(atletaNotificaCoach({ route: '/workout/w1?athlete_id=at3' }, coach)).toBe('at3')
    expect(atletaNotificaCoach({}, coach)).toBeNull()
  })
  it('per il servizio vale il corpo', () => {
    expect(atletaNotificaCoach({ athleteId: 'at2' }, { id: null, ruoloStaff: null, servizio: true })).toBe('at2')
  })
  it('un atleta senza id: nessuno', () => {
    expect(atletaNotificaCoach({ athleteId: 'at2' }, { id: null, ruoloStaff: null, servizio: false })).toBeNull()
  })
})
