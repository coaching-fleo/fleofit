import { describe, it, expect, vi, beforeEach } from 'vitest'

// Lettura e ripristino del cestino dei workout (19/11/2026): tabella assente =
// funzione nascosta senza errori, la copia jsonb non viaggia mai nella lista,
// gli errori della RPC arrivano in italiano.

const ctrl = await vi.hoisted(async () => ({ righe: [], guasti: [], rpc: {} }))
const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  return { crea: fintoSupabase }
})
let f
vi.mock('../../supabaseClient', () => ({
  get supabase() { return f.supabase },
}))

const { elencoCestino, vociCestino, ripristinaWorkout } = await import('../cestinoDb')

const R = (id, eliminato_il) => ({ id, workout_id: 'w' + id, titolo: 'T' + id, data_workout: '2026-11-16', eliminato_il })

function monta(codice) {
  f = finto.crea(() => ({ cestino_workout: ctrl.righe, ...ctrl.rpc }), { erroreSu: () => ctrl.guasti, codiceErrore: codice })
}

beforeEach(() => {
  ctrl.righe = []
  ctrl.guasti = []
  ctrl.rpc = {}
  monta()
})

describe('elencoCestino', () => {
  it('tabella assente: disponibile false, nessun errore', async () => {
    ctrl.guasti = ['cestino_workout']
    monta('PGRST205')
    await expect(elencoCestino()).resolves.toEqual({ disponibile: false, righe: [] })
  })

  it('un altro errore passa', async () => {
    ctrl.guasti = ['cestino_workout']
    monta('500')
    await expect(elencoCestino()).rejects.toBeTruthy()
  })

  it('i più recenti in alto', async () => {
    ctrl.righe = [R('a', '2026-11-10T10:00:00Z'), R('b', '2026-11-18T16:29:00Z'), R('c', '2026-11-12T10:00:00Z')]
    const { disponibile, righe } = await elencoCestino()
    expect(disponibile).toBe(true)
    expect(righe.map(r => r.id)).toEqual(['b', 'c', 'a'])
  })

  it('non chiede la copia', async () => {
    await elencoCestino()
    const select = f.chiamateA('cestino_workout', 'select')[0]
    expect(select.args[0]).toContain('eliminato_da_nome')
    expect(select.args[0]).not.toContain('copia')
  })
})

describe('vociCestino', () => {
  it('chiede le voci alla RPC', async () => {
    ctrl.rpc = { 'rpc:cestino_voci': [{ tipo: 'assegnazione', id: 'aw1' }] }
    await expect(vociCestino('c1')).resolves.toEqual([{ tipo: 'assegnazione', id: 'aw1' }])
    expect(f.supabase.rpc).toHaveBeenCalledWith('cestino_voci', { c: 'c1' })
  })
})

describe('ripristinaWorkout', () => {
  it('passa le spunte così come sono, anche vuote', async () => {
    ctrl.rpc = { 'rpc:ripristina_workout': 'w1' }
    await expect(ripristinaWorkout('c1', { assegnazioni: [], sfide: [] })).resolves.toBe('w1')
    expect(f.supabase.rpc).toHaveBeenCalledWith('ripristina_workout', { c: 'c1', assegnazioni: [], sfide: [] })
  })

  it('riga già ripristinata: messaggio in italiano', async () => {
    ctrl.rpc = { 'rpc:ripristina_workout': { error: { code: 'P0002', message: 'cestino: non trovato' } } }
    await expect(ripristinaWorkout('c1', { assegnazioni: [], sfide: [] }))
      .rejects.toThrow('Questo workout è già stato ripristinato o non è più nel cestino.')
  })

  it('id occupato: messaggio in italiano', async () => {
    ctrl.rpc = { 'rpc:ripristina_workout': { error: { message: 'cestino: id occupato' } } }
    await expect(ripristinaWorkout('c1', { assegnazioni: [], sfide: [] }))
      .rejects.toThrow('Esiste già un workout con questo identificativo.')
  })
})
