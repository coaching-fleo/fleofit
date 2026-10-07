import { describe, it, expect } from 'vitest'
import { dimensioniRidotte } from '../immagineRidotta'

// Uno screenshot di un iPhone recente è 1290×2796: spedito intero sono 3–4 MB
// per immagine, oltre il limite del server. Si riduce il LATO LUNGO a 1280,
// senza deformare, e un'immagine già piccola non si ingrandisce mai.

describe('dimensioniRidotte', () => {
  it('riduce il lato lungo a 1280 mantenendo le proporzioni', () => {
    expect(dimensioniRidotte(4000, 3000)).toEqual({ larghezza: 1280, altezza: 960 })
  })

  it('vale anche per un\'immagine verticale', () => {
    expect(dimensioniRidotte(1290, 2796)).toEqual({ larghezza: 591, altezza: 1280 })
  })

  it('non ingrandisce un\'immagine già piccola', () => {
    expect(dimensioniRidotte(800, 600)).toEqual({ larghezza: 800, altezza: 600 })
  })
})
