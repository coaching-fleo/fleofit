import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Il hook dei fogli «Aggiungi»: cambiando categoria non deve mostrare, nemmeno
// per un attimo, i modelli della categoria di prima mentre arrivano i nuovi.

const attese = await vi.hoisted(async () => ({ risolvi: {} }))
vi.mock('../lib/modelliBloccoDb', () => ({
  elencoModelli: (categoria) => new Promise(r => { attese.risolvi[categoria] = r }),
}))

const { useModelliBlocco } = await import('../useModelliBlocco')

const modello = (id, categoria) => ({ id, categoria, nome: id, contenuto: {} })

describe('useModelliBlocco', () => {
  it('cambiando categoria non tiene la lista di prima', async () => {
    const { result, rerender } = renderHook(({ c }) => useModelliBlocco(c), { initialProps: { c: 'Hyrox' } })
    await act(async () => { attese.risolvi.Hyrox([modello('h1', 'Hyrox')]) })
    expect(result.current.modelli.map(m => m.id)).toEqual(['h1'])

    rerender({ c: 'Gym' })
    expect(result.current.caricato).toBe(false)
    expect(result.current.modelli).toEqual([])

    await act(async () => { attese.risolvi.Gym([modello('g1', 'Gym')]) })
    expect(result.current.modelli.map(m => m.id)).toEqual(['g1'])
  })
})
