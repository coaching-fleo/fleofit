import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, waitFor, act } from '@testing-library/react'

// Perché questo test esiste
// ──────────────────────────
// Fino al 04/11/2026 la TV, smontandosi, cancellava la sua riga di `tv_sessions`
// con il `code` letto dallo state della PRIMA esecuzione dell'effetto, cioè
// `null`: la cancellazione non partiva mai, e le righe restavano nel database.

const db = await vi.hoisted(async () => {
  const stato = { upsert: [], cancellati: [], canali: [], cancello: null }
  const catena = () => {
    const q = { op: null, riga: null, codice: null }
    const proxy = new Proxy({}, {
      get(_, prop) {
        if (prop === 'then') {
          if (q.op === 'upsert') stato.upsert.push(q.riga.code)
          if (q.op === 'delete') stato.cancellati.push(q.codice)
          const attesa = q.op === 'upsert' ? stato.cancello : null
          return (ok, ko) => Promise.resolve(attesa).then(() => ({ data: null, error: null })).then(ok, ko)
        }
        return (...args) => {
          if (prop === 'upsert') { q.op = 'upsert'; q.riga = args[0] }
          if (prop === 'delete') q.op = 'delete'
          if (prop === 'eq' && args[0] === 'code') q.codice = args[1]
          return proxy
        }
      },
    })
    return proxy
  }
  const canale = (nome) => {
    const c = { nome, on: () => c, subscribe: () => { stato.canali.push(nome); return c } }
    return c
  }
  return { stato, catena, canale }
})

vi.mock('../../supabaseClient', () => ({
  supabase: { from: () => db.catena(), channel: (n) => db.canale(n), removeChannel: () => {} },
}))
vi.mock('qrcode', () => ({ default: { toDataURL: () => Promise.resolve('data:image/png;base64,xx') } }))

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} }
  globalThis.Audio = class { play() { return Promise.resolve() } pause() {} }
})

const TVDashboard = (await import('../TVDashboard')).default

beforeEach(() => {
  db.stato.upsert.length = 0
  db.stato.cancellati.length = 0
  db.stato.canali.length = 0
  db.stato.cancello = null
})

describe('TV: la sessione si cancella alla chiusura', () => {
  it('chiusa la TV, la sua riga va via con il suo codice', async () => {
    const { unmount } = render(<TVDashboard />)
    await waitFor(() => expect(db.stato.canali).toHaveLength(1))
    const codice = db.stato.upsert[0]
    expect(codice).toMatch(/^\d{4}$/)

    unmount()
    expect(db.stato.cancellati).toEqual([codice])
  })

  it('chiusa prima che la riga sia scritta, la riga va via appena scritta e nessun canale si apre', async () => {
    let apri
    db.stato.cancello = new Promise(r => { apri = r })
    const { unmount } = render(<TVDashboard />)
    await waitFor(() => expect(db.stato.upsert).toHaveLength(1))
    const codice = db.stato.upsert[0]

    unmount()
    await act(async () => { apri() })
    await waitFor(() => expect(db.stato.cancellati).toEqual([codice]))
    expect(db.stato.canali).toHaveLength(0)
  })
})
