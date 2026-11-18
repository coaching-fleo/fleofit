import { describe, it, expect } from 'vitest'
import { scegliMioAllenamento } from '../mioAllenamento'

const riga = (id, data, status = 'pending', w = {}) => ({
  id, completed_date: data, status,
  workouts: { id: `w${id}`, title: `Titolo ${id}`, sections: { category: 'Running' }, ...w },
})

describe('scegliMioAllenamento', () => {
  const oggi = '2026-11-18'

  it('niente righe: niente card', () => {
    expect(scegliMioAllenamento([], oggi)).toBeNull()
    expect(scegliMioAllenamento(null, oggi)).toBeNull()
  })

  it('oggi già fatto e uno domani: quello di oggi, con la spunta', () => {
    const r = scegliMioAllenamento([riga(1, oggi, 'completed'), riga(2, '2026-11-19')], oggi)
    expect(r).toEqual({ awId: 1, workoutId: 'w1', titolo: 'Titolo 1', data: oggi, fatto: true, oggi: true, categoria: 'Running' })
  })

  it('oggi uno fatto e uno no: quello da fare', () => {
    const r = scegliMioAllenamento([riga(1, oggi, 'completed'), riga(2, oggi)], oggi)
    expect(r.awId).toBe(2)
    expect(r.fatto).toBe(false)
  })

  it('niente oggi: il prossimo da fare, in ordine di data', () => {
    const r = scegliMioAllenamento([riga(3, '2026-11-25'), riga(2, '2026-11-20', 'completed'), riga(4, '2026-11-21')], oggi)
    expect(r.awId).toBe(4)
    expect(r.oggi).toBe(false)
  })

  it('solo futuri già completati: niente card', () => {
    expect(scegliMioAllenamento([riga(2, '2026-11-20', 'completed')], oggi)).toBeNull()
  })

  it('le righe passate non contano', () => {
    expect(scegliMioAllenamento([riga(1, '2026-11-17')], oggi)).toBeNull()
  })

  it('una riga senza workout si ignora; senza categoria è Hyrox', () => {
    const r = scegliMioAllenamento([{ id: 9, completed_date: oggi, status: 'pending', workouts: null }, riga(5, '2026-11-19', 'pending', { sections: null })], oggi)
    expect(r.awId).toBe(5)
    expect(r.categoria).toBe('Hyrox')
  })
})
