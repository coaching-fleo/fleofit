import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

// Perché questi test esistono
// ────────────────────────────
// «Scarpe da corsa», al completamento (spec §2 e §5): quando l'atleta chiude
// una corsa, la scarpa scelta si lega all'allenamento e i suoi km salgono. Gli
// errori che non danno errore a schermo: una riga «Scarpa» nel foglio RPE di
// chi non ha scarpe (o con la migrazione non applicata, con in più un alert
// che non c'entra), una scarpa scritta da sola quando la principale non c'è
// più, un errore di rete che si porta via il completamento.

const dati = await vi.hoisted(async () => ({ lettura: { disponibile: true, scarpe: [] } }))

vi.mock('../lib/scarpeDb', () => ({
  leggiScarpeAtleta: vi.fn(async () => dati.lettura),
  assegnaScarpa: vi.fn(async () => {}),
  togliScarpa: vi.fn(async () => {}),
}))

const db = await import('../lib/scarpeDb')
const { useScarpaCompletamento } = await import('../useScarpaCompletamento')

const CORSA = { category: 'Running', steps: [{ id: 1, type: 'run', duration: '5 km', pace: '5:00 /km' }] }
const CUSTOM = { category: 'Custom', isAutonomous: true }

const scarpa = (id, campi = {}) => ({
  id, marca: 'Nike', modello: 'Pegasus 41', principale: false, ritirata_at: null,
  km: 100, soglia_km: 700, stato: 'ok', usi: [], ...campi,
})

const monta = async (setAlertInfo = vi.fn()) => {
  const r = renderHook(() => useScarpaCompletamento('a1', { setAlertInfo }))
  await waitFor(() => expect(db.leggiScarpeAtleta).toHaveBeenCalledWith('a1'), { timeout: 5000 })
  // Aspetta che la lettura (e kmScarpe, caricato pigro) sia arrivata allo stato del hook.
  await waitFor(() => expect(r.result.current.conCorsa(CORSA)).toBe(true), { timeout: 5000 })
  return { ...r, setAlertInfo }
}

beforeEach(() => {
  vi.clearAllMocks()
  dati.lettura = { disponibile: true, scarpe: [] }
})

describe('useScarpaCompletamento', () => {
  it('atleta senza scarpe: nessuna riga nel foglio RPE', async () => {
    const { result } = await monta()
    expect(result.current.propRiga(CORSA)).toBeNull()
  })

  it('tutte ritirate: nessuna riga', async () => {
    dati.lettura = { disponibile: true, scarpe: [scarpa('s1', { ritirata_at: '2026-10-01T00:00:00Z' })] }
    const { result } = await monta()
    expect(result.current.propRiga(CORSA)).toBeNull()
  })

  it('con la principale attiva: riga preimpostata su di lei, registra la lega', async () => {
    dati.lettura = { disponibile: true, scarpe: [scarpa('s1'), scarpa('s2', { modello: 'Clifton 10', principale: true })] }
    const { result } = await monta()
    const riga = result.current.propRiga(CORSA)
    expect(riga).not.toBeNull()
    expect(riga.sceltaId).toBe('s2')
    expect(riga.attive.map(s => s.id)).toEqual(['s1', 's2'])
    await act(async () => { await result.current.registra('aw1', CORSA) })
    expect(db.assegnaScarpa).toHaveBeenCalledWith('aw1', 's2')
  })

  it('cambiando la scelta si registra quella', async () => {
    dati.lettura = { disponibile: true, scarpe: [scarpa('s1'), scarpa('s2', { principale: true })] }
    const { result } = await monta()
    act(() => { result.current.propRiga(CORSA).onCambia('s1') })
    expect(result.current.sceltaId).toBe('s1')
    await act(async () => { await result.current.registra('aw1', CORSA) })
    expect(db.assegnaScarpa).toHaveBeenCalledWith('aw1', 's1')
  })

  it('scarpe attive ma nessuna principale: «Nessuna» preselezionata e nessuna scrittura', async () => {
    dati.lettura = { disponibile: true, scarpe: [scarpa('s1'), scarpa('s2', { principale: true, ritirata_at: '2026-10-01T00:00:00Z' })] }
    const { result } = await monta()
    const riga = result.current.propRiga(CORSA)
    expect(riga).not.toBeNull()
    expect(riga.sceltaId).toBeNull()
    expect(riga.attive.map(s => s.id)).toEqual(['s1'])
    await act(async () => { await result.current.registra('aw1', CORSA) })
    expect(db.assegnaScarpa).not.toHaveBeenCalled()
  })

  it('workout Custom: nessuna riga e nessuna scrittura', async () => {
    dati.lettura = { disponibile: true, scarpe: [scarpa('s1', { principale: true })] }
    const { result } = await monta()
    expect(result.current.propRiga(CUSTOM)).toBeNull()
    await act(async () => { await result.current.registra('aw1', CUSTOM) })
    expect(db.assegnaScarpa).not.toHaveBeenCalled()
  })

  it('assegnaScarpa che fallisce: alert, e la promessa si risolve', async () => {
    dati.lettura = { disponibile: true, scarpe: [scarpa('s1', { principale: true })] }
    db.assegnaScarpa.mockRejectedValueOnce(new Error('rete assente'))
    const { result, setAlertInfo } = await monta()
    await act(async () => { await expect(result.current.registra('aw1', CORSA)).resolves.toBeUndefined() })
    expect(setAlertInfo).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }))
  })

  it('tabelle assenti: nessuna riga e nessun alert', async () => {
    dati.lettura = { disponibile: false, scarpe: [] }
    const { result, setAlertInfo } = await monta()
    expect(result.current.propRiga(CORSA)).toBeNull()
    await act(async () => { await result.current.registra('aw1', CORSA) })
    await act(async () => { await result.current.annulla('aw1') })
    expect(db.assegnaScarpa).not.toHaveBeenCalled()
    expect(db.togliScarpa).not.toHaveBeenCalled()
    expect(setAlertInfo).not.toHaveBeenCalled()
  })

  it('lettura che fallisce: come le tabelle assenti, senza alert', async () => {
    db.leggiScarpeAtleta.mockRejectedValueOnce(new Error('rete assente'))
    const { result, setAlertInfo } = await monta()
    expect(result.current.propRiga(CORSA)).toBeNull()
    expect(setAlertInfo).not.toHaveBeenCalled()
  })

  it('senza atleta (coach che guarda) non legge niente', async () => {
    const { result } = renderHook(() => useScarpaCompletamento(null, { setAlertInfo: vi.fn() }))
    await act(async () => {})
    expect(db.leggiScarpeAtleta).not.toHaveBeenCalled()
    expect(result.current.propRiga(CORSA)).toBeNull()
  })

  it('ritorno a «da fare»: toglie l\'uso dell\'allenamento', async () => {
    dati.lettura = { disponibile: true, scarpe: [scarpa('s1', { principale: true, usi: [{ athlete_workout_id: 'aw1' }] })] }
    const { result } = await monta()
    await act(async () => { await result.current.annulla('aw1') })
    expect(db.togliScarpa).toHaveBeenCalledWith('aw1')
  })

  it('scarpaDiUso dice quale scarpa ha l\'allenamento, cambiaUso la cambia', async () => {
    dati.lettura = { disponibile: true, scarpe: [scarpa('s1', { usi: [{ athlete_workout_id: 'aw1' }] }), scarpa('s2', { principale: true })] }
    const { result } = await monta()
    expect(result.current.scarpaDiUso('aw1')?.id).toBe('s1')
    expect(result.current.scarpaDiUso('aw9')).toBeNull()
    await act(async () => { await result.current.cambiaUso('aw1', 's2') })
    expect(db.assegnaScarpa).toHaveBeenCalledWith('aw1', 's2')
    await act(async () => { await result.current.cambiaUso('aw1', null) })
    expect(db.togliScarpa).toHaveBeenCalledWith('aw1')
  })
})
