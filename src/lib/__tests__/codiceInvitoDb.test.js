import { describe, it, expect, vi } from 'vitest'
import { verificaCodiceInvito, riscattaCodiceInvito } from '../codiceInvitoDb'

// Un Supabase minimo: `rpc` risponde come gli si dice, `from` registra le
// chiamate e restituisce `tabella` come risposta di ogni catena.
const finto = ({ rpc, tabella = { data: null, error: null } }) => {
  const chiamate = []
  const catena = new Proxy({}, {
    get(_, prop) {
      if (prop === 'then') return (ok, ko) => Promise.resolve(tabella).then(ok, ko)
      return (...args) => { chiamate.push([prop, ...args]); return catena }
    },
  })
  return {
    chiamate,
    rpc: vi.fn((nome, argomenti) => Promise.resolve(rpc(nome, argomenti))),
    from: vi.fn((t) => { chiamate.push(['from', t]); return catena }),
  }
}

const SENZA_FUNZIONE = { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } }

describe('verificaCodiceInvito', () => {
  it('🔴 con la funzione nel database NON legge la tabella', async () => {
    const sb = finto({ rpc: () => ({ data: true, error: null }) })
    expect(await verificaCodiceInvito(sb, 'AAA11111')).toBe('valido')
    expect(sb.rpc).toHaveBeenCalledWith('codice_invito_valido', { p_codice: 'AAA11111' })
    expect(sb.from).not.toHaveBeenCalled()
  })

  it('un no della funzione è un codice rifiutato', async () => {
    const sb = finto({ rpc: () => ({ data: false, error: null }) })
    expect(await verificaCodiceInvito(sb, 'AAA11111')).toBe('rifiutato')
  })

  it('senza la funzione (migrazione non ancora applicata) torna a leggere la tabella', async () => {
    const sb = finto({ rpc: () => SENZA_FUNZIONE, tabella: { data: { code: 'AAA11111' }, error: null } })
    expect(await verificaCodiceInvito(sb, 'AAA11111')).toBe('valido')
    expect(sb.from).toHaveBeenCalledWith('invitation_codes')
  })

  it('un guasto di rete resta un guasto di rete, non un codice rifiutato', async () => {
    const sb = finto({ rpc: () => ({ data: null, error: { message: 'Failed to fetch' } }) })
    expect(await verificaCodiceInvito(sb, 'AAA11111')).toBe('offline')
  })
})

describe('riscattaCodiceInvito', () => {
  it('🔴 con la funzione nel database riscatta senza UPDATE diretto', async () => {
    const sb = finto({ rpc: () => ({ data: true, error: null }) })
    expect(await riscattaCodiceInvito(sb, 'AAA11111', { id: 'u1', email: 'a@b.it' })).toBe(true)
    expect(sb.rpc).toHaveBeenCalledWith('riscatta_codice_invito', { p_codice: 'AAA11111' })
    expect(sb.from).not.toHaveBeenCalled()
  })

  it('un no della funzione vuol dire codice già preso da altri', async () => {
    const sb = finto({ rpc: () => ({ data: false, error: null }) })
    expect(await riscattaCodiceInvito(sb, 'AAA11111', { id: 'u1' })).toBe(false)
  })

  it('senza la funzione fa l\'UPDATE di prima', async () => {
    const sb = finto({ rpc: () => SENZA_FUNZIONE, tabella: { data: [{ id: 'c1' }], error: null } })
    expect(await riscattaCodiceInvito(sb, 'AAA11111', { id: 'u1', email: 'a@b.it' })).toBe(true)
    expect(sb.chiamate.some(c => c[0] === 'update')).toBe(true)
  })
})
