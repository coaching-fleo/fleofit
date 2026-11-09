import { describe, it, expect } from 'vitest'
import { nomeBreve } from '../membriTeam'

// Il nome breve sta sotto gli avatar del podio e della fila dei membri, dove
// c'è posto per una decina di lettere. L'errore che non si vede: due «Luca»
// nello stesso team, indistinguibili, o un nome vuoto che lascia un buco.
describe('nomeBreve', () => {
  it('nome e iniziale del cognome', () => {
    expect(nomeBreve('Luca', 'Bianchi')).toBe('Luca B.')
  })
  it('il cognome minuscolo prende l’iniziale maiuscola', () => {
    expect(nomeBreve('Sara', 'de luca')).toBe('Sara D.')
  })
  it('senza cognome resta il nome; senza niente un trattino', () => {
    expect(nomeBreve('Giulia', '')).toBe('Giulia')
    expect(nomeBreve('', null)).toBe('—')
  })
})
