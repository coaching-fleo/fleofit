import { describe, it, expect } from 'vitest'
import { erroreProfilo } from '../profiloAtleta'

// Perché questi test esistono
// ────────────────────────────
// L'informativa (§15, «Minori») dice che sotto i 14 anni non ci si iscrive.
// Fino al 09/11/2026 il profilo accettava chiunque avesse 5 anni: la regola
// era scritta ma non applicata. Il confine si conta sul calendario, non in
// millisecondi: con 365,25 giorni all'anno il giorno del compleanno veniva
// ancora rifiutato (14 anni = 5113 giorni, non 5113,5).

const profilo = (dob) => ({ name: 'Sara', surname: 'Rossi', dob, weight: '', height: '' })
const oggi = new Date('2026-11-09T10:00:00')
const MINORE = 'Per iscriverti a FLEOFIT devi avere almeno 14 anni.'

describe('erroreProfilo — età minima', () => {
  it('rifiuta chi compie 14 anni domani', () => {
    expect(erroreProfilo(profilo('2012-11-10'), oggi)).toBe(MINORE)
  })

  it('accetta chi compie 14 anni oggi', () => {
    expect(erroreProfilo(profilo('2012-11-09'), oggi)).toBeNull()
  })

  it('accetta un adulto', () => {
    expect(erroreProfilo(profilo('1995-04-12'), oggi)).toBeNull()
  })

  it('rifiuta un bambino', () => {
    expect(erroreProfilo(profilo('2020-01-01'), oggi)).toBe(MINORE)
  })

  it('una data nel futuro resta «Controlla la data di nascita»', () => {
    expect(erroreProfilo(profilo('2027-01-01'), oggi)).toBe('Controlla la data di nascita.')
  })

  it('oltre 110 anni resta «Controlla la data di nascita»', () => {
    expect(erroreProfilo(profilo('1900-01-01'), oggi)).toBe('Controlla la data di nascita.')
  })
})
