import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { AuthContext } from '../../App'
import { leggiJson } from '../offlineQueue'
import { chiaveVisto, ordinaAvvisi, chiaveVistiDi } from '../avvisiExtra'

// Due extra finti: le loro funzioni `avviso` le decide ogni test.
const avvisi = { a: null, b: null }
const finto = (id) => ({ id, avviso: () => Promise.resolve(() => avvisi[id]()) })
let extra = [finto('a'), finto('b')]
vi.mock('../../useExtra', () => ({ useExtra: () => extra }))

import { useAvvisiExtra, dimenticaVisti } from '../../useAvvisiExtra'

const monta = (uid = 'u1') => renderHook(() => useAvvisiExtra(), {
  wrapper: ({ children }) => <AuthContext.Provider value={{ user: { id: uid }, role: 'athlete' }}>{children}</AuthContext.Provider>,
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
    dimenticaVisti()
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
    expect(leggiJson(chiaveVistiDi('u1'), [])).toContain('a:cambia:s1')

    avvisi.a = async () => ({ chiave: 'cambia:s2', testo: 'Ride', priorita: 'alta' })
    const due = monta()
    await waitFor(() => expect(due.result.current.primo?.avviso.testo).toBe('Ride'))
  })

  it('chiuso in un punto, sparisce anche negli altri (la card in Home e il pallino della barra)', async () => {
    avvisi.a = async () => ({ chiave: 'cambia:s1', testo: 'Pegasus', priorita: 'alta' })
    const home = monta()
    const barra = monta()
    await waitFor(() => expect(barra.result.current.aperti.has('a')).toBe(true))
    await waitFor(() => expect(home.result.current.primo).not.toBeNull())
    act(() => home.result.current.chiudi('a', 'cambia:s1'))
    expect(barra.result.current.aperti.has('a')).toBe(false)
  })

  it('chiuso da un utente, lo vede ancora un altro sullo stesso telefono', async () => {
    avvisi.a = async () => ({ chiave: 'aggiungi', testo: 'Tieni il conto', priorita: 'normale' })
    const uno = monta('u1')
    await waitFor(() => expect(uno.result.current.primo).not.toBeNull())
    act(() => uno.result.current.chiudi('a', 'aggiungi'))
    uno.unmount()
    const due = monta('u2')
    await waitFor(() => expect(due.result.current.primo?.avviso.chiave).toBe('aggiungi'))
  })

  it('nessun extra acceso: niente', async () => {
    extra = []
    const { result } = monta()
    expect(result.current.primo).toBeNull()
    expect(result.current.altri).toBe(0)
  })
})
