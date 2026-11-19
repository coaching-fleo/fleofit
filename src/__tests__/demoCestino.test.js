import { describe, it, expect, beforeEach, vi } from 'vitest'
import { clientDemo, azzeraDemo } from '../supabaseDemo'

// Il cestino dei workout nell'ambiente di prova (19/11/2026, docs/memoria/cestino.md).
// Nel database vero la copia la fa il trigger `cestino_copia` e le cascate
// tolgono assegnazioni e sfide; la demo non ha trigger, quindi eliminare
// cancellava solo il workout e il cestino restava vuoto. Qui la demo fa come
// il database: copia, cascata, `cestino_voci` e `ripristina_workout`.

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {})
  azzeraDemo()
})

async function workoutConDueAtleti(db, sections = { category: 'Hyrox', blocks: [] }, creato_da = 'coach-demo') {
  const { data: [w] } = await db.from('workouts').insert({ title: 'Prova cestino', date: '2030-01-01', sections, creato_da }).select()
  await db.from('athlete_workouts').insert([
    { athlete_id: 'at-sofia', workout_id: w.id, status: 'completed', notes: '[RPE: 7/10] bene' },
    { athlete_id: 'at-sara', workout_id: w.id, status: 'pending', notes: null },
  ])
  return w
}

describe('demo: cestino dei workout', () => {
  it('eliminare un workout lo mette nel cestino e toglie le sue assegnazioni', async () => {
    const db = clientDemo()
    const w = await workoutConDueAtleti(db)
    await db.from('workouts').delete().eq('id', w.id)

    const { data: righe } = await db.from('cestino_workout').select('id, workout_id, titolo')
    expect(righe).toEqual([expect.objectContaining({ workout_id: w.id, titolo: 'Prova cestino' })])
    const { data: aw } = await db.from('athlete_workouts').select('id').eq('workout_id', w.id)
    expect(aw).toEqual([])
  })

  it('l\'allenamento libero di un atleta non entra nel cestino', async () => {
    const db = clientDemo()
    const w = await workoutConDueAtleti(db, { category: 'Custom', isAutonomous: true }, 'at-sofia')
    await db.from('workouts').delete().eq('id', w.id)
    const { data: righe } = await db.from('cestino_workout').select('id').eq('workout_id', w.id)
    expect(righe).toEqual([])
  })

  it('cestino_voci dà le assegnazioni a spunte, con il nome dell\'atleta', async () => {
    const db = clientDemo()
    const w = await workoutConDueAtleti(db)
    await db.from('workouts').delete().eq('id', w.id)
    const { data: [riga] } = await db.from('cestino_workout').select('id')
    const { data: voci, error } = await db.rpc('cestino_voci', { c: riga.id })
    expect(error).toBeNull()
    expect(voci).toHaveLength(2)
    expect(voci.every(v => v.tipo === 'assegnazione' && v.ripristinabile && v.atleta)).toBe(true)
  })

  it('ripristina_workout rimette il workout e SOLO le assegnazioni spuntate', async () => {
    const db = clientDemo()
    const w = await workoutConDueAtleti(db)
    const { data: prima } = await db.from('athlete_workouts').select('id, athlete_id').eq('workout_id', w.id)
    const sofia = prima.find(a => a.athlete_id === 'at-sofia')
    await db.from('workouts').delete().eq('id', w.id)
    const { data: [riga] } = await db.from('cestino_workout').select('id')

    const { data: id, error } = await db.rpc('ripristina_workout', { c: riga.id, assegnazioni: [sofia.id], sfide: [] })
    expect(error).toBeNull()
    expect(id).toBe(w.id)
    const { data: tornato } = await db.from('workouts').select('id').eq('id', w.id)
    expect(tornato).toHaveLength(1)
    const { data: aw } = await db.from('athlete_workouts').select('id, notes').eq('workout_id', w.id)
    expect(aw).toEqual([{ id: sofia.id, notes: '[RPE: 7/10] bene' }])
    const { data: cestino } = await db.from('cestino_workout').select('id')
    expect(cestino).toEqual([])
  })

  it('una riga già ripristinata dà l\'errore «non trovato», come la funzione vera', async () => {
    const db = clientDemo()
    const { error } = await db.rpc('ripristina_workout', { c: 'nessuna', assegnazioni: [], sfide: [] })
    expect(error?.message).toContain('cestino: non trovato')
  })
})
