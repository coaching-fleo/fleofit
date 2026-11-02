import { describe, it, expect } from 'vitest'
import { sceltaTV } from '../sceltaTV'

// Cosa propone la TV quando l'atleta scansiona il QR: conferma di un workout,
// lista di quelli di oggi, o solo gli ultimi giorni. «Oggi» arriva da fuori
// (mai Date.now qui dentro), così i test non dipendono dall'orologio.

const OGGI = '2026-11-02'
const w = (id, date, category = 'Hyrox') => ({ id, title: `W${id}`, date, sections: { category } })

describe('sceltaTV', () => {
  it('atleta con un solo workout oggi: conferma', () => {
    const r = sceltaTV({ ruolo: 'athlete', oggi: OGGI, workouts: [w(1, OGGI)] })
    expect(r.tipo).toBe('conferma')
    expect(r.workout.id).toBe(1)
  })

  it('atleta con due workout oggi: lista', () => {
    const r = sceltaTV({ ruolo: 'athlete', oggi: OGGI, workouts: [w(1, OGGI), w(2, OGGI)] })
    expect(r.tipo).toBe('lista')
    expect(r.oggi).toHaveLength(2)
  })

  it('zero oggi e due ieri: vuoto con i recenti', () => {
    const r = sceltaTV({ ruolo: 'athlete', oggi: OGGI, workouts: [w(1, '2026-11-01'), w(2, '2026-10-31')] })
    expect(r.tipo).toBe('vuoto')
    expect(r.recenti.map((x) => x.id)).toEqual([1, 2])
  })

  it('un Event oggi più un workout: conferma sul workout', () => {
    const r = sceltaTV({ ruolo: 'athlete', oggi: OGGI, workouts: [w('e', OGGI, 'Event'), w(1, OGGI)] })
    expect(r.tipo).toBe('conferma')
    expect(r.workout.id).toBe(1)
  })

  it('gli Event sono esclusi anche dai recenti', () => {
    const r = sceltaTV({ ruolo: 'athlete', oggi: OGGI, workouts: [w('e', '2026-11-01', 'Event')] })
    expect(r).toEqual({ tipo: 'vuoto', recenti: [] })
  })

  it('admin con un solo workout oggi: lista, mai conferma senza aperto', () => {
    const r = sceltaTV({ ruolo: 'admin', oggi: OGGI, workouts: [w(1, OGGI)] })
    expect(r.tipo).toBe('lista')
  })

  it('coach con un solo workout oggi: lista', () => {
    expect(sceltaTV({ ruolo: 'coach', oggi: OGGI, workouts: [w(1, OGGI)] }).tipo).toBe('lista')
  })

  it('forzaLista con un solo workout oggi: lista', () => {
    const r = sceltaTV({ ruolo: 'athlete', oggi: OGGI, workouts: [w(1, OGGI)], forzaLista: true })
    expect(r.tipo).toBe('lista')
  })

  it('staff senza niente oggi: vuoto, con i recenti', () => {
    for (const ruolo of ['coach', 'admin']) {
      const r = sceltaTV({ ruolo, oggi: OGGI, workouts: [w(1, '2026-11-01')] })
      expect(r.tipo).toBe('vuoto')
      expect(r.recenti.map((x) => x.id)).toEqual([1])
    }
  })

  it('lista porta anche i recenti', () => {
    const r = sceltaTV({ ruolo: 'athlete', oggi: OGGI, workouts: [w(1, OGGI), w(2, OGGI), w(3, '2026-11-01')] })
    expect(r.recenti.map((x) => x.id)).toEqual([3])
  })

  it('esclude i workout di 8 giorni fa, include quelli di 7', () => {
    const r = sceltaTV({ ruolo: 'athlete', oggi: OGGI, workouts: [w(1, '2026-10-25'), w(2, '2026-10-26')] })
    expect(r.recenti.map((x) => x.id)).toEqual([2])
  })

  it('25 recenti: al massimo 20, il primo è il più recente', () => {
    const ws = Array.from({ length: 25 }, (_, i) => w(i, '2026-10-30'))
    ws.push(w('top', '2026-11-01'))
    const r = sceltaTV({ ruolo: 'athlete', oggi: OGGI, workouts: ws })
    expect(r.recenti).toHaveLength(20)
    expect(r.recenti[0].id).toBe('top')
  })

  it('esclude i workout futuri', () => {
    const r = sceltaTV({ ruolo: 'athlete', oggi: OGGI, workouts: [w(1, '2026-11-03')] })
    expect(r).toEqual({ tipo: 'vuoto', recenti: [] })
  })
})
