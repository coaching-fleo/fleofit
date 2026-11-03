// Perché questo test esiste: tools/scarpe/schede.json è la fonte dei dati dei
// 12 modelli del catalogo. Se una scheda esce dai limiti, o il catalogo
// demo e le schede divergono, l'app mostrerebbe numeri sbagliati.
import { describe, it, expect } from 'vitest'
import schede from '../../../tools/scarpe/schede.json'
import { validaModello } from '../caratteristicheScarpa'

const CATALOGO_DEMO = [
  'Nike Pegasus 41', 'Nike Vaporfly 3', 'Adidas Adizero Boston 12', 'Asics Novablast 4',
  'Asics Gel-Nimbus 26', 'Hoka Clifton 10', 'Hoka Speedgoat 6', 'Saucony Endorphin Speed 4',
  'Brooks Ghost 17', 'New Balance Fresh Foam X 1080v14', 'On Cloudmonster 2', 'Puma Deviate Nitro 3',
]

describe('schede.json', () => {
  it('12 voci, quelle del catalogo demo', () => {
    expect(schede).toHaveLength(12)
    expect(schede.map(s => `${s.marca} ${s.modello}`).sort()).toEqual([...CATALOGO_DEMO].sort())
  })
  it.each(schede.map(s => [`${s.marca} ${s.modello}`, s]))('%s è valida e ha il livello', (_n, s) => {
    expect(validaModello(s).errori).toEqual({})
    expect(s.livello).not.toBeNull()
  })
})
