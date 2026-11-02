import { describe, it, expect } from 'vitest'
import { eLinkDelTimer, eLinkDellaTV, LINK_TIMER } from '../linkTimer'

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
