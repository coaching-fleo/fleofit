import { describe, it, expect } from 'vitest'
import { eLinkDelTimer, LINK_TIMER } from '../linkTimer'

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
