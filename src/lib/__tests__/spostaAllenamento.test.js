import { describe, it, expect, vi } from 'vitest'
import { format } from 'date-fns'
import {
  puoSpostare, giorniProposti, nomeGiorno, dataBreve, eNelPassato, spostaAssegnazione, avvisaCoachSpostamento,
  chiSiSposta, spostaPerTutti, daAvvisare, avvisaAtletiSpostamento,
} from '../spostaAllenamento'

// L'atleta sposta da solo un allenamento. Si sposta l'ASSEGNAZIONE, mai il
// workout (condiviso con gli altri atleti), e solo ciò che è ancora da fare.

const OGGI = new Date(2026, 9, 26) // lunedì 26 ottobre 2026
const chiavi = (giorni) => giorni.map(g => format(g, 'yyyy-MM-dd'))

describe('puoSpostare', () => {
  it('da fare sì; fatto e gara no', () => {
    expect(puoSpostare({ status: 'pending', evento: false })).toBe(true)
    expect(puoSpostare({ status: 'completed', evento: false })).toBe(false)
    expect(puoSpostare({ status: 'pending', evento: true })).toBe(false)
  })
})

describe('giorniProposti', () => {
  it('sette giorni da oggi, senza quello in cui sta già', () => {
    expect(chiavi(giorniProposti('2026-10-27', OGGI))).toEqual([
      '2026-10-26', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02',
    ])
  })

  it('un allenamento saltato ieri si recupera da oggi in poi', () => {
    expect(chiavi(giorniProposti('2026-10-25', OGGI))[0]).toBe('2026-10-26')
    expect(giorniProposti('2026-10-25', OGGI)).toHaveLength(7)
  })
})

describe('le parole', () => {
  it('Oggi, poi il giorno della settimana (mai «Domani», che troncato diventa «dom»)', () => {
    expect(nomeGiorno(new Date(2026, 9, 26), OGGI)).toBe('Oggi')
    expect(nomeGiorno(new Date(2026, 9, 27), OGGI)).toBe('mar')
    expect(nomeGiorno(new Date(2026, 9, 28), OGGI)).toBe('mer')
    expect(dataBreve('2026-10-28')).toBe('mer 28 ott')
    expect(dataBreve(null)).toBe('')
  })

  it('il passato non è un recupero; oggi sì', () => {
    expect(eNelPassato('2026-10-25', OGGI)).toBe(true)
    expect(eNelPassato('2026-10-26', OGGI)).toBe(false)
  })
})

describe('spostaAssegnazione', () => {
  it('scrive SOLO completed_date, sulla riga dell\'assegnazione', async () => {
    const eq = vi.fn(() => Promise.resolve({ error: null }))
    const update = vi.fn(() => ({ eq }))
    const from = vi.fn(() => ({ update }))
    const { error } = await spostaAssegnazione({ from }, 'aw-1', '2026-10-29')
    expect(error).toBeNull()
    expect(from).toHaveBeenCalledWith('athlete_workouts')
    expect(update).toHaveBeenCalledWith({ completed_date: '2026-10-29' })
    expect(eq).toHaveBeenCalledWith('id', 'aw-1')
  })

  it('l\'avviso al coach porta la data già scritta', async () => {
    const invoke = vi.fn(() => Promise.resolve({}))
    await avvisaCoachSpostamento({ functions: { invoke } },
      { athleteName: 'Sara', workoutTitle: 'Sled', data: '2026-10-29', route: '/workout/w1?athlete_id=a1' })
    expect(invoke).toHaveBeenCalledWith('send-reminders', {
      body: { mode: 'coach_notification', action: 'moved', athleteName: 'Sara', workoutTitle: 'Sled', newDate: 'gio 29 ott', route: '/workout/w1?athlete_id=a1' },
    })
  })
})

// ── Il coach sposta (26/11/2026) ─────────────────────────────────────────────

// Un finto Supabase che registra ogni update: [tabella, valori, filtro].
// `errori[tabella]` fa fallire gli update di quella tabella.
function fintoDb(errori = {}) {
  const chiamate = []
  return {
    chiamate,
    from(tabella) {
      return {
        update(valori) {
          const esito = (filtro) => {
            chiamate.push([tabella, valori, filtro])
            return Promise.resolve({ error: errori[tabella] || null })
          }
          return { eq: (c, v) => esito({ eq: [c, v] }), in: (c, v) => esito({ in: [c, v] }) }
        },
      }
    },
  }
}

describe('chiSiSposta', () => {
  const ass = [
    { id: 'a', status: 'pending', completed_date: '2026-12-02' },
    { id: 'b', status: 'completed', completed_date: '2026-12-02' },
    { id: 'c', status: 'pending', completed_date: '2026-12-03' },
    { id: 'd', status: 'pending', completed_date: '2026-12-02' },
  ]
  it('sposta solo i non svolti rimasti sulla data del workout', () => {
    expect(chiSiSposta(ass, '2026-12-02')).toEqual({ siSpostano: ['a', 'd'], restano: { svolti: 1, spostatiDaSe: 1 } })
  })
  it('lista vuota', () => {
    expect(chiSiSposta([], '2026-12-02')).toEqual({ siSpostano: [], restano: { svolti: 0, spostatiDaSe: 0 } })
  })
})

describe('spostaPerTutti', () => {
  it('scrive prima il workout, poi le assegnazioni scelte', async () => {
    const db = fintoDb()
    const { error } = await spostaPerTutti(db, { workoutId: 'w1', dataOriginale: '2026-12-02', ids: ['a', 'd'], nuovaData: '2026-12-04' })
    expect(error).toBeFalsy()
    expect(db.chiamate).toEqual([
      ['workouts', { date: '2026-12-04' }, { eq: ['id', 'w1'] }],
      ['athlete_workouts', { completed_date: '2026-12-04' }, { in: ['id', ['a', 'd']] }],
    ])
  })
  it('se le assegnazioni falliscono rimette la data del workout', async () => {
    const db = fintoDb({ athlete_workouts: { message: 'x' } })
    const { error } = await spostaPerTutti(db, { workoutId: 'w1', dataOriginale: '2026-12-02', ids: ['a'], nuovaData: '2026-12-04' })
    expect(error).toBeTruthy()
    expect(db.chiamate[2]).toEqual(['workouts', { date: '2026-12-02' }, { eq: ['id', 'w1'] }])
  })
  it('se il workout fallisce non tocca le assegnazioni', async () => {
    const db = fintoDb({ workouts: { message: 'x' } })
    const { error } = await spostaPerTutti(db, { workoutId: 'w1', dataOriginale: '2026-12-02', ids: ['a'], nuovaData: '2026-12-04' })
    expect(error).toBeTruthy()
    expect(db.chiamate).toHaveLength(1)
  })
})

describe('daAvvisare', () => {
  it('niente push per una data passata', () => {
    expect(daAvvisare({ nuovaData: '2026-11-20', oggi: new Date(2026, 10, 26) })).toBe(false)
    expect(daAvvisare({ nuovaData: '2026-11-27', oggi: new Date(2026, 10, 26) })).toBe(true)
  })
})

describe('avvisaAtletiSpostamento', () => {
  it('chiama athlete_moved con le assegnazioni e la data scritta', async () => {
    const invoke = vi.fn(() => Promise.resolve({}))
    await avvisaAtletiSpostamento({ functions: { invoke } }, { awIds: ['a', 'd'], data: '2026-10-29' })
    expect(invoke).toHaveBeenCalledWith('send-reminders', {
      body: { mode: 'athlete_moved', record_ids: ['a', 'd'], newDate: 'gio 29 ott' },
    })
  })
  it('senza assegnazioni non chiama niente', async () => {
    const invoke = vi.fn(() => Promise.resolve({}))
    await avvisaAtletiSpostamento({ functions: { invoke } }, { awIds: [], data: '2026-10-29' })
    expect(invoke).not.toHaveBeenCalled()
  })
})
