import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { AuthContext } from '../../App'
import { leggiJson } from '../offlineQueue'
import { chiaveVisto, ordinaAvvisi, CHIAVE_VISTI } from '../avvisiExtra'

// Due extra finti: le loro funzioni `avviso` le decide ogni test.
const avvisi = { a: null, b: null }
const finto = (id) => ({ id, avviso: () => Promise.resolve(() => avvisi[id]()) })
let extra = [finto('a'), finto('b')]
vi.mock('../../useExtra', () => ({ useExtra: () => extra }))

import { useAvvisiExtra } from '../../useAvvisiExtra'

const monta = () => renderHook(() => useAvvisiExtra(), {
  wrapper: ({ children }) => <AuthContext.Provider value={{ user: { id: 'u1' }, role: 'athlete' }}>{children}</AuthContext.Provider>,
})

const alta = { chiave: 'x', testo: 'Alta', priorita: 'alta' }
const normale = { chiave: 'y', testo: 'Normale', priorita: 'normale' }

describe('ordinaAvvisi', () => {
  it('l\'alta passa davanti alla normale', () => {
    const r = ordinaAvvisi([{ extra: { id: 'a' }, avviso: normale }, { extra: { id: 'b' }, avviso: alta }], [])
    expect(r.primo.avviso).toBe(alta)
    expect(r.altri).toBe(1)
  })
  it('a parità, l\'ordine del registro', () => {
    const r = ordinaAvvisi([{ extra: { id: 'a' }, avviso: normale }, { extra: { id: 'b' }, avviso: { ...normale, chiave: 'z' } }], [])
    expect(r.primo.extra.id).toBe('a')
  })
  it('i già visti escono; tutti visti = niente', () => {
    const voci = [{ extra: { id: 'a' }, avviso: alta }]
    expect(ordinaAvvisi(voci, [chiaveVisto('a', 'x')])).toEqual({ primo: null, altri: 0 })
  })
})

describe('useAvvisiExtra', () => {
  beforeEach(() => {
    localStorage.clear()
    extra = [finto('a'), finto('b')]
    avvisi.a = async () => null
    avvisi.b = async () => null
  })

  it('un avviso che lancia è ignorato, l\'altro resta', async () => {
    avvisi.a = async () => { throw new Error('rete') }
    avvisi.b = async () => normale
    const { result } = monta()
    await waitFor(() => expect(result.current.primo?.avviso).toEqual(normale))
    expect(result.current.aperti.has('b')).toBe(true)
    expect(result.current.aperti.has('a')).toBe(false)
  })

  it('chiudere lo nasconde e lo ricorda; una chiave nuova lo fa tornare', async () => {
    avvisi.a = async () => ({ chiave: 'cambia:s1', testo: 'Pegasus', priorita: 'alta' })
    const uno = monta()
    await waitFor(() => expect(uno.result.current.primo).not.toBeNull())
    act(() => uno.result.current.chiudi('a', 'cambia:s1'))
    expect(uno.result.current.primo).toBeNull()
    expect(leggiJson(CHIAVE_VISTI, [])).toContain('a:cambia:s1')

    avvisi.a = async () => ({ chiave: 'cambia:s2', testo: 'Ride', priorita: 'alta' })
    const due = monta()
    await waitFor(() => expect(due.result.current.primo?.avviso.testo).toBe('Ride'))
  })

  it('nessun extra acceso: niente', async () => {
    extra = []
    const { result } = monta()
    expect(result.current.primo).toBeNull()
    expect(result.current.altri).toBe(0)
  })
})
