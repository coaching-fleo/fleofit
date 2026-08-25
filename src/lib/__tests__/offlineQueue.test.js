import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  CHIAVE_CODA, leggiJson, scriviJson, leggiCoda, accoda, accodaSuStorage, chiaveCacheWorkout,
} from '../offlineQueue'

// Perché questi test esistono
// ────────────────────────────
// La coda offline è l'unico punto dell'app dove un guasto costa DATI: un workout
// completato senza rete vive solo in localStorage finché la linea non torna.
// Il 25/08/2026 ci sono stati trovati due difetti, entrambi invisibili:
// un valore corrotto che bloccava la sincronizzazione per sempre, e un
// JSON.parse senza rete di protezione che lasciava la modale RPE a girare a
// vuoto perdendo il completamento appena inserito. Questi test tengono chiuse
// entrambe le porte.

// localStorage finto: permette di simulare corruzione e quota piena, cose che
// il localStorage vero di jsdom non lascia fare.
function finto(iniziale = {}) {
  const dati = { ...iniziale }
  return {
    dati,
    getItem: vi.fn(k => (k in dati ? dati[k] : null)),
    setItem: vi.fn((k, v) => { dati[k] = String(v) }),
    removeItem: vi.fn(k => { delete dati[k] }),
  }
}

beforeEach(() => { vi.spyOn(console, 'warn').mockImplementation(() => {}) })

describe('leggiJson — la lettura si ripara da sola', () => {
  it('legge un valore valido', () => {
    const s = finto({ x: '{"a":1}' })
    expect(leggiJson('x', null, s)).toEqual({ a: 1 })
  })

  it('torna il fallback se la chiave non esiste, senza rimuovere niente', () => {
    const s = finto()
    expect(leggiJson('assente', 'default', s)).toBe('default')
    expect(s.removeItem).not.toHaveBeenCalled()
  })

  it('RIMUOVE il valore corrotto invece di lasciarlo lì', () => {
    // È il cuore della correzione: senza removeItem, la lettura successiva
    // ritrova lo stesso valore rotto e fallisce di nuovo, all'infinito.
    const s = finto({ x: '{rotto' })
    expect(leggiJson('x', [], s)).toEqual([])
    expect(s.removeItem).toHaveBeenCalledWith('x')
    expect(leggiJson('x', [], s)).toEqual([])
  })

  it('tratta il null salvato come assente', () => {
    expect(leggiJson('x', 'fb', finto({ x: 'null' }))).toBe('fb')
  })

  it('non lancia se localStorage stesso è negato', () => {
    // Safari in navigazione privata: getItem lancia SecurityError.
    const s = finto()
    s.getItem = vi.fn(() => { throw new Error('SecurityError') })
    expect(() => leggiJson('x', 'fb', s)).not.toThrow()
    expect(leggiJson('x', 'fb', s)).toBe('fb')
  })

  it('non lancia se manca del tutto lo storage', () => {
    expect(leggiJson('x', 'fb', undefined)).toBe('fb')
  })
})

describe('scriviJson — una quota piena non rompe il flusso', () => {
  it('scrive e conferma', () => {
    const s = finto()
    expect(scriviJson('x', { a: 1 }, s)).toBe(true)
    expect(s.dati.x).toBe('{"a":1}')
  })

  it('torna false invece di lanciare quando lo storage è pieno', () => {
    // Se lanciasse, il chiamante resterebbe a metà: è la dinamica che teneva
    // bloccata la modale RPE.
    const s = finto()
    s.setItem = vi.fn(() => { throw new Error('QuotaExceededError') })
    expect(() => scriviJson('x', { a: 1 }, s)).not.toThrow()
    expect(scriviJson('x', { a: 1 }, s)).toBe(false)
  })
})

describe('leggiCoda — è sempre un array', () => {
  it('coda vuota se la chiave non c è', () => {
    expect(leggiCoda(finto())).toEqual([])
  })

  it('scarta un valore che non è un array', () => {
    // Una coda che fosse un oggetto manderebbe in errore il for...of della
    // sincronizzazione, di nuovo bloccando tutto.
    expect(leggiCoda(finto({ [CHIAVE_CODA]: '{"non":"un array"}' }))).toEqual([])
    expect(leggiCoda(finto({ [CHIAVE_CODA]: '"stringa"' }))).toEqual([])
    expect(leggiCoda(finto({ [CHIAVE_CODA]: '42' }))).toEqual([])
  })

  it('una coda corrotta non blocca per sempre la sincronizzazione', () => {
    const s = finto({ [CHIAVE_CODA]: '[{rotto' })
    expect(leggiCoda(s)).toEqual([])
    expect(s.removeItem).toHaveBeenCalledWith(CHIAVE_CODA)
  })
})

describe('accoda — una sola azione per allenamento', () => {
  it('aggiunge in fondo con tipo e timestamp', () => {
    expect(accoda([], { id: 'a', status: 'completed' }, 1000)).toEqual([
      { type: 'UPDATE_WORKOUT', payload: { id: 'a', status: 'completed' }, ts: 1000 },
    ])
  })

  it('SOSTITUISCE l azione precedente sullo stesso workout', () => {
    // Senza questo, due tocchi offline sullo stesso allenamento producevano due
    // UPDATE che si sovrascrivevano in ordine imprevedibile al ritorno della rete.
    const prima = accoda([], { id: 'a', status: 'completed' }, 1000)
    const dopo = accoda(prima, { id: 'a', status: 'pending' }, 2000)
    expect(dopo).toHaveLength(1)
    expect(dopo[0].payload.status).toBe('pending')
    expect(dopo[0].ts).toBe(2000)
  })

  it('non tocca le azioni di altri allenamenti', () => {
    const coda = accoda(accoda([], { id: 'a' }, 1), { id: 'b' }, 2)
    const dopo = accoda(coda, { id: 'a', status: 'pending' }, 3)
    expect(dopo.map(x => x.payload.id)).toEqual(['b', 'a'])
  })

  it('è pura: non modifica l array ricevuto', () => {
    // Serve a react-hooks/immutability e agli aggiornamenti ottimistici: se
    // mutasse in posto, un rollback riporterebbe uno stato già corrotto.
    const originale = accoda([], { id: 'a' }, 1)
    const copia = structuredClone(originale)
    accoda(originale, { id: 'a', status: 'pending' }, 2)
    expect(originale).toEqual(copia)
  })

  it('regge una coda che non è un array', () => {
    expect(accoda(null, { id: 'a' }, 1)).toHaveLength(1)
    expect(accoda(undefined, { id: 'a' }, 1)).toHaveLength(1)
  })

  it('regge voci malformate già in coda senza lanciare', () => {
    const sporca = [null, { senzaPayload: true }, { type: 'UPDATE_WORKOUT' }]
    expect(() => accoda(sporca, { id: 'a' }, 1)).not.toThrow()
    expect(accoda(sporca, { id: 'a' }, 1)).toHaveLength(4)
  })
})

describe('accodaSuStorage — il giro completo', () => {
  it('legge, accoda e riscrive', () => {
    const s = finto()
    accodaSuStorage({ id: 'a', status: 'completed' }, s, 1000)
    expect(JSON.parse(s.dati[CHIAVE_CODA])).toEqual([
      { type: 'UPDATE_WORKOUT', payload: { id: 'a', status: 'completed' }, ts: 1000 },
    ])
  })

  it('riparte da zero se trova una coda corrotta, invece di perdere l azione', () => {
    // Il caso peggiore: l'atleta completa un workout offline e la coda è rotta.
    // Meglio ripartire da capo con la sua azione che non salvarla affatto.
    const s = finto({ [CHIAVE_CODA]: 'non json' })
    accodaSuStorage({ id: 'a', status: 'completed' }, s, 1000)
    const coda = JSON.parse(s.dati[CHIAVE_CODA])
    expect(coda).toHaveLength(1)
    expect(coda[0].payload.id).toBe('a')
  })
})

describe('chiaveCacheWorkout', () => {
  it('è per atleta: due utenti non condividono la cache', () => {
    expect(chiaveCacheWorkout('uid-1')).toBe('fleofit_cache_workouts_uid-1')
    expect(chiaveCacheWorkout('uid-1')).not.toBe(chiaveCacheWorkout('uid-2'))
  })
})
