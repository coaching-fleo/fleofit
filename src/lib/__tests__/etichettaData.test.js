import { describe, it, expect } from 'vitest'
import { etichettaData } from '../etichettaData'

// La pillola della data al passo 2 di Crea workout: oggi, domani e ieri si
// dicono a parole, gli altri giorni con il giorno della settimana.
const oggi = new Date(2026, 10, 26) // giovedì 26 novembre 2026

describe('etichettaData', () => {
  it('oggi, domani e ieri hanno il nome davanti', () => {
    expect(etichettaData('2026-11-26', oggi)).toBe('Oggi, gio 26 nov')
    expect(etichettaData('2026-11-27', oggi)).toBe('Domani, ven 27 nov')
    expect(etichettaData('2026-11-25', oggi)).toBe('Ieri, mer 25 nov')
  })

  it('gli altri giorni partono con la maiuscola', () => {
    expect(etichettaData('2026-12-01', oggi)).toBe('Mar 1 dic')
  })

  it('una data vuota o rotta chiede di sceglierla', () => {
    expect(etichettaData('', oggi)).toBe('Scegli la data')
    expect(etichettaData('ciao', oggi)).toBe('Scegli la data')
    expect(etichettaData(null, oggi)).toBe('Scegli la data')
  })
})
