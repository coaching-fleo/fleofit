import { describe, it, expect } from 'vitest'
import { eLinkDelTimer, eLinkDellaTV, rottaDaLinkTV, LINK_TIMER } from '../linkTimer'

describe('eLinkDelTimer — il tocco sulla Live Activity non deve ricaricare l\'app', () => {
  it('riconosce il link della Live Activity', () => {
    expect(eLinkDelTimer(LINK_TIMER)).toBe(true)
    expect(eLinkDelTimer('fleofit://timer?x=1')).toBe(true)
  })

  it('non scambia per timer i link di login, recupero e Garmin', () => {
    expect(eLinkDelTimer('fleofit://')).toBe(false)
    expect(eLinkDelTimer('fleofit://login-callback#access_token=a&refresh_token=b')).toBe(false)
    expect(eLinkDelTimer('fleofit://garmin?esito=ok')).toBe(false)
    expect(eLinkDelTimer('https://fleofit.vercel.app/timer')).toBe(false)
  })

  it('un indirizzo illeggibile non è il timer', () => {
    expect(eLinkDelTimer('non è un url')).toBe(false)
    expect(eLinkDelTimer(undefined)).toBe(false)
  })
})

describe('eLinkDellaTV — il QR della TV letto dalla fotocamera di sistema', () => {
  it('riconosce il link della TV, con o senza codice', () => {
    expect(eLinkDellaTV('fleofit://tv/1234')).toBe(true)
    expect(eLinkDellaTV('fleofit://tv')).toBe(true)
    expect(eLinkDellaTV('fleofit://tv/')).toBe(true)
    expect(eLinkDellaTV('fleofit://tv/abc?x=1')).toBe(true)
  })

  it('non scambia per TV gli altri link fleofit://', () => {
    expect(eLinkDellaTV('fleofit://')).toBe(false)
    expect(eLinkDellaTV('fleofit://timer')).toBe(false)
    expect(eLinkDellaTV('fleofit://login-callback#access_token=a&refresh_token=b')).toBe(false)
    expect(eLinkDellaTV('fleofit://garmin?esito=ok')).toBe(false)
    expect(eLinkDellaTV('fleofit://tvx/1234')).toBe(false)
    expect(eLinkDellaTV('https://fleofit.vercel.app/tv')).toBe(false)
  })

  it('un indirizzo illeggibile non è la TV', () => {
    expect(eLinkDellaTV('non è un url')).toBe(false)
    expect(eLinkDellaTV(undefined)).toBe(false)
    expect(eLinkDellaTV(null)).toBe(false)
  })
})

describe('rottaDaLinkTV — dove porta il QR della TV', () => {
  const casa = { pathname: '/', search: '' }
  it('dal resto dell\'app va alla pagina del codice', () => {
    expect(rottaDaLinkTV('fleofit://tv/1234', casa)).toBe('/collega-tv/1234')
  })
  // 🔴 Da una scheda NON si esce (ruling 7): la scheda resta montata, timer
  // compreso, e chiede lei «Vuoi mandare in TV questo?».
  it('da una scheda resta sulla scheda, con la sua query più tv e chiedi', () => {
    expect(rottaDaLinkTV('fleofit://tv/1234', { pathname: '/workout/w1', search: '?athlete_id=u1' }))
      .toBe('/workout/w1?athlete_id=u1&tv=1234&chiedi=1')
    expect(rottaDaLinkTV('fleofit://tv/1234', { pathname: '/workout/w1', search: '' }))
      .toBe('/workout/w1?tv=1234&chiedi=1')
  })
  it('da una scheda già con un tv vecchio lo sostituisce, senza doppioni', () => {
    expect(rottaDaLinkTV('fleofit://tv/1234', { pathname: '/workout/w1', search: '?tv=5555&chiedi=1&athlete_id=u1' }))
      .toBe('/workout/w1?athlete_id=u1&tv=1234&chiedi=1')
  })
  it('da un\'altra pagina di collegamento non ricorda niente', () => {
    expect(rottaDaLinkTV('fleofit://tv/1234', { pathname: '/collega-tv/5555', search: '' }))
      .toBe('/collega-tv/1234')
  })
  it('senza un codice valido non porta da nessuna parte', () => {
    for (const l of ['fleofit://tv', 'fleofit://tv/12', 'fleofit://tv/abcd', 'fleofit://timer'])
      expect(rottaDaLinkTV(l, casa)).toBeNull()
  })
})
