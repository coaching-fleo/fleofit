import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { AuthContext } from '../../App'

// Qui lo stato degli interruttori lo decide ogni test (il setup li accende tutti).
const stati = { scarpe: 'tutti' }
let pendente = false
vi.mock('../funzioniApp', async (importOriginal) => {
  const vero = await importOriginal()
  return {
    ...vero,
    statoFunzione: (nome) => (pendente ? new Promise(() => {}) : Promise.resolve(stati[nome] ?? 'spenta')),
  }
})

import { useExtra } from '../../useExtra'

const monta = (role) => renderHook(() => useExtra(), {
  wrapper: ({ children }) => <AuthContext.Provider value={{ user: { id: 'u1' }, role }}>{children}</AuthContext.Provider>,
})
const ids = (r) => r.current?.map(e => e.id)

describe('useExtra', () => {
  beforeEach(() => { pendente = false; stati.scarpe = 'tutti' })

  it('finché non si sa, nessun extra (null)', () => {
    pendente = true
    expect(monta('athlete').result.current).toBeNull()
  })
  it('acceso per tutti: l\'atleta lo vede', async () => {
    const { result } = monta('athlete')
    await waitFor(() => expect(ids(result)).toEqual(['scarpe']))
  })
  it('acceso per gli admin: l\'admin sì, l\'admin che simula l\'atleta no', async () => {
    stati.scarpe = 'admin'
    const a = monta('admin')
    await waitFor(() => expect(ids(a.result)).toEqual(['scarpe']))
    const s = monta('athlete')
    await waitFor(() => expect(ids(s.result)).toEqual([]))
  })
  it('spento: lista vuota', async () => {
    stati.scarpe = 'spenta'
    const { result } = monta('coach')
    await waitFor(() => expect(ids(result)).toEqual([]))
  })
})
