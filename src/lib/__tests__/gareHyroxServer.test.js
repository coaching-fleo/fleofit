import { describe, it, expect } from 'vitest'
import html from './fixtures/find-my-race.html?raw'
import { leggiGare, leggiData, decodifica } from '../../../supabase/functions/gare-hyrox/regole.ts'

// Perché questi test esistono
// ────────────────────────────
// `gare-hyrox` legge una pagina HTML che non è nostra. Il test gira su una
// copia VERA di https://hyrox.com/find-my-race/ (sei riquadri del 12/10/2026):
// se un giorno la lettura si rompe, si salva la pagina nuova al posto di
// questa e si vede subito cosa è cambiato. I casi che contano:
//  · una gara di più giorni porta inizio E fine (l'atleta sceglie il suo giorno);
//  · le Youngstars, i partner e una gara senza data non entrano in lista.

describe('leggiGare sulla pagina vera', () => {
  const gare = leggiGare(html)

  it('tiene solo le gare adulte con una data', () => {
    expect(gare.map(g => g.nome)).toEqual(['HYROX Valencia', 'HYROX São Paulo', 'HYROX Budapest'])
  })

  it('una gara di più giorni porta inizio e fine', () => {
    expect(gare[0]).toMatchObject({
      codice: 'VLC', dal: '2026-10-15', al: '2026-10-18',
      url: 'https://hyrox.com/event/hyrox-valencia/', continente: 'europe',
    })
    expect(gare[0].id).toMatch(/^\d+$/)
  })

  it('una gara di un giorno ha fine uguale all\'inizio', () => {
    expect(gare[2]).toMatchObject({ codice: 'BUD', dal: '2026-10-17', al: '2026-10-17' })
  })

  it('una pagina che non riconosce torna una lista vuota, senza lanciare', () => {
    expect(leggiGare('<html><body>Manutenzione</body></html>')).toEqual([])
    expect(leggiGare('')).toEqual([])
  })
})

describe('leggiData', () => {
  it('legge il formato del sito', () => {
    expect(leggiData('17. Oct. 2026')).toBe('2026-10-17')
    expect(leggiData('3. Jun. 2027')).toBe('2027-06-03')
    expect(leggiData('1. Sept. 2027')).toBe('2027-09-01')
  })
  it('un formato sconosciuto è null, non una data inventata', () => {
    expect(leggiData('TBA')).toBeNull()
    expect(leggiData('17. Okt. 2026')).toBeNull()
  })
})

describe('decodifica', () => {
  it('scioglie le entità dei titoli WordPress', () => {
    expect(decodifica('HYROX &amp; Friends &#8211; Roma')).toBe('HYROX & Friends – Roma')
  })
})
