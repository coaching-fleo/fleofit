import { describe, it, expect } from 'vitest'
import { perCaso } from '../../../../tools/prova-piano-ia/perCaso.mjs'

describe('banco: perCaso', () => {
  it('un errore a metà (429, 5xx) non perde i casi già pagati e il giro continua', async () => {
    const salvati = []
    const casi = [{ id: 'caso-01' }, { id: 'caso-02' }, { id: 'caso-03' }]
    const righe = await perCaso(casi, async (c) => {
      if (c.id === 'caso-02') throw new Error('429 rate_limit_error')
      return { caso: c.id, motivo: null }
    }, (r) => salvati.push(r.length))
    expect(righe).toEqual([
      { caso: 'caso-01', motivo: null },
      { caso: 'caso-02', motivo: 'errore', errore: '429 rate_limit_error' },
      { caso: 'caso-03', motivo: null },
    ])
    expect(salvati).toEqual([1, 2, 3])
  })

  it('un caso che non produce riga (saltato a monte) non scrive niente', async () => {
    const righe = await perCaso([{ id: 'a' }], async () => null, () => {})
    expect(righe).toEqual([])
  })
})
