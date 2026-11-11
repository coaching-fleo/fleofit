import { describe, it, expect } from 'vitest'
import { leggiHomeClassica, scriviHomeClassica, CHIAVE_HOME_CLASSICA } from '../homeClassica'

const memoria = () => {
  const m = new Map()
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }
}

describe('homeClassica', () => {
  it('assente vuol dire Riepilogo', () => {
    expect(leggiHomeClassica(memoria())).toBe(false)
  })
  it('si accende e si spegne', () => {
    const s = memoria()
    scriviHomeClassica(true, s)
    expect(leggiHomeClassica(s)).toBe(true)
    scriviHomeClassica(false, s)
    expect(leggiHomeClassica(s)).toBe(false)
  })
  it('un valore strano non accende niente', () => {
    const s = memoria()
    s.setItem(CHIAVE_HOME_CLASSICA, '"si"')
    expect(leggiHomeClassica(s)).toBe(false)
  })
  it('uno storage che lancia non rompe', () => {
    const rotto = { getItem: () => { throw new Error('no') } }
    expect(leggiHomeClassica(rotto)).toBe(false)
  })
})
