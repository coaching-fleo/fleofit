import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

// Perché questi test esistono
// ────────────────────────────
// Team, al completamento (spec §4): quando l'allenamento fa parte di una sfida,
// il foglio RPE chiede il risultato. Gli errori che non danno errore a schermo:
// la riga nel foglio di chi non è in una sfida, un tempo scritto male («4:75»)
// salvato come numero, un campo lasciato vuoto che scrive uno zero, un errore
// di rete che si porta via il completamento.

const dati = await vi.hoisted(async () => ({ sfida: null, attiva: true }))

vi.mock('../lib/teamDb', () => ({
  sfidaDiAssegnazione: vi.fn(async () => dati.sfida),
  salvaRisultato: vi.fn(async () => {}),
}))
vi.mock('../lib/funzioniApp', () => ({
  funzioneAttiva: vi.fn(async () => dati.attiva),
}))

const db = await import('../lib/teamDb')
const { useSfidaCompletamento } = await import('../useSfidaCompletamento')

const SFIDA = { id: 'ts-1', metrica: 'tempo', chiusa_il: null, classifica_visibile: true, valore: null }

const monta = async (setAlertInfo = vi.fn()) => {
  const r = renderHook(() => useSfidaCompletamento('a1', 'w1', '2026-11-06', { setAlertInfo }))
  await waitFor(() => expect(r.result.current.riga).not.toBeNull(), { timeout: 5000 })
  return { ...r, setAlertInfo }
}

beforeEach(() => {
  vi.clearAllMocks()
  dati.sfida = { ...SFIDA }
  dati.attiva = true
})

describe('useSfidaCompletamento', () => {
  it('senza atleta (il coach che completa per conto di qualcuno): nessuna lettura, nessuna riga', async () => {
    const { result } = renderHook(() => useSfidaCompletamento(null, 'w1', '2026-11-06'))
    await new Promise(r => setTimeout(r, 50))
    expect(db.sfidaDiAssegnazione).not.toHaveBeenCalled()
    expect(result.current.riga).toBeNull()
  })

  it('con la funzione spenta: nessuna lettura', async () => {
    dati.attiva = false
    const { result } = renderHook(() => useSfidaCompletamento('a1', 'w1', '2026-11-06'))
    await new Promise(r => setTimeout(r, 50))
    expect(db.sfidaDiAssegnazione).not.toHaveBeenCalled()
    expect(result.current.riga).toBeNull()
  })

  it('allenamento senza sfida: nessuna riga', async () => {
    dati.sfida = null
    const { result } = renderHook(() => useSfidaCompletamento('a1', 'w1', '2026-11-06'))
    await waitFor(() => expect(db.sfidaDiAssegnazione).toHaveBeenCalledWith('w1', 'a1', '2026-11-06'))
    await new Promise(r => setTimeout(r, 20))
    expect(result.current.riga).toBeNull()
  })

  it('sfida chiusa: nessuna riga (non si scrive più)', async () => {
    dati.sfida = { ...SFIDA, chiusa_il: '2026-11-06T20:00:00Z' }
    const { result } = renderHook(() => useSfidaCompletamento('a1', 'w1', '2026-11-06'))
    await waitFor(() => expect(db.sfidaDiAssegnazione).toHaveBeenCalled())
    await new Promise(r => setTimeout(r, 20))
    expect(result.current.riga).toBeNull()
  })

  it('sfida a tempo: «4:07» è valido, «4:75» no, vuoto sì', async () => {
    const { result } = await monta()
    expect(result.current.riga.metrica).toBe('tempo')
    expect(result.current.riga.classificaVisibile).toBe(true)
    act(() => result.current.riga.onCambia('4:07'))
    expect(result.current.riga.valido).toBe(true)
    act(() => result.current.riga.onCambia('4:75'))
    expect(result.current.riga.valido).toBe(false)
    act(() => result.current.riga.onCambia(''))
    expect(result.current.riga.valido).toBe(true)
  })

  it('registra salva il valore in secondi', async () => {
    const { result } = await monta()
    act(() => result.current.riga.onCambia('4:07'))
    await act(() => result.current.registra())
    expect(db.salvaRisultato).toHaveBeenCalledWith('ts-1', 'a1', 247)
  })

  it('campo vuoto: registra non scrive niente', async () => {
    const { result } = await monta()
    await act(() => result.current.registra())
    expect(db.salvaRisultato).not.toHaveBeenCalled()
  })

  it('il valore già inserito torna nel campo', async () => {
    dati.sfida = { ...SFIDA, valore: 247 }
    const { result } = await monta()
    expect(result.current.riga.testo).toBe('4:07')
  })

  it('errore di scrittura: un avviso, nessun rilancio', async () => {
    db.salvaRisultato.mockRejectedValueOnce(new Error('rete'))
    const { result, setAlertInfo } = await monta()
    act(() => result.current.riga.onCambia('4:07'))
    await act(() => result.current.registra())
    expect(setAlertInfo).toHaveBeenCalledWith(expect.objectContaining({
      message: "L'allenamento è salvato: il risultato si inserisce dalla scheda del team.",
    }))
  })
})
