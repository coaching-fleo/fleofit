import { describe, it, expect } from 'vitest'
import { ultimoAllenamento, quandoFa } from '../tabellaAtleti'

describe('tabellaAtleti', () => {
  it("tiene l'ultimo allenamento completato, non l'ultimo assegnato", () => {
    const m = ultimoAllenamento([
      { athlete_id: 'a', status: 'completed', completed_date: '2026-10-05' },
      { athlete_id: 'a', status: 'completed', completed_date: '2026-10-09' },
      { athlete_id: 'a', status: 'pending', completed_date: '2026-10-12' },
      { athlete_id: 'b', status: 'pending', completed_date: '2026-10-12' },
    ])
    expect(m.get('a')).toBe('2026-10-09')
    expect(m.has('b')).toBe(false)
  })

  it('dice quanto tempo fa in parole', () => {
    const oggi = new Date(2026, 9, 13)
    expect(quandoFa('2026-10-13', oggi)).toBe('oggi')
    expect(quandoFa('2026-10-12', oggi)).toBe('ieri')
    expect(quandoFa('2026-10-08', oggi)).toBe('5 giorni fa')
    expect(quandoFa(null, oggi)).toBeNull()
  })
})
