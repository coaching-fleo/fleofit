import { describe, it, expect, vi, beforeEach } from 'vitest'
import { semi, VERSIONE_SEME } from '../demoSemi'
import { kmAllenamento, kmScarpa, statoScarpa } from '../lib/kmScarpe'

// Le scarpe della demo (INVENTATE) servono a vedere, in `npm run demo:atleta`
// (Sara, di default), la pagina «Scarpe» piena: una principale `ok`, una `quasi`
// e una ritirata. Sofia, l'atleta nuova, ne ha una scritta a mano e nessun uso.
describe('le scarpe della demo', () => {
  const db = semi()
  const sara = db.scarpe_atleta.filter(s => s.athlete_id === 'at-sara')

  // I km di una scarpa come li calcola l'app: partenza + usi (orologio se c'è, altrimenti stima).
  const kmDi = (scarpa) => {
    const km = db.scarpe_uso.filter(u => u.scarpa_id === scarpa.id).map((u) => {
      const aw = db.athlete_workouts.find(a => a.id === u.athlete_workout_id)
      const w = db.workouts.find(x => x.id === aw.workout_id)
      const att = db.garmin_attivita.find(g => g.athlete_workout_id === aw.id)
      return kmAllenamento(w.sections, att)?.km ?? null
    })
    return kmScarpa(scarpa, km)
  }

  it('la versione dei semi è almeno 17', () => {
    expect(VERSIONE_SEME).toBeGreaterThanOrEqual(17)
  })

  it('il catalogo ha circa dodici modelli, con marca e modello', () => {
    expect(db.scarpe_catalogo.length).toBeGreaterThanOrEqual(10)
    for (const c of db.scarpe_catalogo) {
      expect(c.id && c.marca && c.modello).toBeTruthy()
    }
  })

  it('ogni scarpa ha marca e modello copiati, anche se viene dal catalogo', () => {
    for (const s of db.scarpe_atleta) {
      expect(s.marca && s.modello).toBeTruthy()
      if (s.catalogo_id) {
        const c = db.scarpe_catalogo.find(x => x.id === s.catalogo_id)
        expect(c).toBeTruthy()
        expect([s.marca, s.modello]).toEqual([c.marca, c.modello])
      }
    }
  })

  it('Sara ha tre scarpe: principale ok, una quasi, una ritirata', () => {
    expect(sara).toHaveLength(3)
    const attive = sara.filter(s => !s.ritirata_at)
    const principale = attive.find(s => s.principale)
    const quasi = attive.find(s => !s.principale)
    const ritirata = sara.find(s => s.ritirata_at)
    expect(statoScarpa(kmDi(principale), principale.soglia_km)).toBe('ok')
    expect(statoScarpa(kmDi(quasi), quasi.soglia_km)).toBe('quasi')
    expect(ritirata.principale).toBe(false)
    expect(Number.isNaN(Date.parse(ritirata.ritirata_at))).toBe(false)
  })

  it('c\'è una sola principale attiva per atleta', () => {
    const perAtleta = {}
    for (const s of db.scarpe_atleta.filter(s => s.principale && !s.ritirata_at)) {
      perAtleta[s.athlete_id] = (perAtleta[s.athlete_id] || 0) + 1
    }
    expect(Object.values(perAtleta).every(n => n === 1)).toBe(true)
  })

  it('gli usi puntano a allenamenti completati dello stesso atleta della scarpa, con km misurabili', () => {
    expect(db.scarpe_uso.length).toBeGreaterThanOrEqual(3)
    for (const u of db.scarpe_uso) {
      const scarpa = db.scarpe_atleta.find(s => s.id === u.scarpa_id)
      const aw = db.athlete_workouts.find(a => a.id === u.athlete_workout_id)
      expect(scarpa).toBeTruthy()
      expect(aw).toBeTruthy()
      expect(aw.athlete_id).toBe(scarpa.athlete_id)
      expect(aw.status).toBe('completed')
      const w = db.workouts.find(x => x.id === aw.workout_id)
      const att = db.garmin_attivita.find(g => g.athlete_workout_id === aw.id)
      expect(kmAllenamento(w.sections, att)).not.toBeNull()
    }
  })

  it('un allenamento ha una scarpa sola', () => {
    const ids = db.scarpe_uso.map(u => u.athlete_workout_id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('Sofia ha una scarpa scritta a mano e nessun uso', () => {
    const sofia = db.scarpe_atleta.filter(s => s.athlete_id === 'at-sofia')
    expect(sofia).toHaveLength(1)
    expect(sofia[0].catalogo_id).toBeNull()
    expect(db.scarpe_uso.filter(u => u.scarpa_id === sofia[0].id)).toHaveLength(0)
  })
})

describe('la demo legge le scarpe con scarpeDb', () => {
  beforeEach(() => { vi.resetModules() })

  it('leggiScarpeAtleta(Sara) torna le tre scarpe con gli stati attesi', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
    const { clientDemo, azzeraDemo } = await import('../supabaseDemo')
    azzeraDemo()
    vi.doMock('../supabaseClient', () => ({ supabase: clientDemo() }))
    const { leggiScarpeAtleta } = await import('../lib/scarpeDb')
    const { disponibile, scarpe } = await leggiScarpeAtleta('at-sara')
    expect(disponibile).toBe(true)
    expect(scarpe).toHaveLength(3)
    expect(scarpe.find(s => s.principale && !s.ritirata_at).stato).toBe('ok')
    expect(scarpe.filter(s => s.stato === 'quasi')).toHaveLength(1)
    expect(scarpe.filter(s => s.stato === 'oltre' && s.ritirata_at)).toHaveLength(1)
    expect(scarpe.every(s => s.usi.every(u => u.km === null || u.km > 0))).toBe(true)
    vi.doUnmock('../supabaseClient')
  })
})
