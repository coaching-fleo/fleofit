import { describe, it, expect } from 'vitest'
import { SCHEMA, eNostroProtocollo } from '../schema'
import { codiceDaQR, contenutoQR } from '../codiceTV'
import { rottaDaDeepLinkGarmin } from '../garmin'
import { codiceDaLinkApp, linkApp } from '../linkInvito'
import { eLinkDelTimer, eLinkDellaTV } from '../linkTimer'

describe('schema dei deep link: fleofit:// e pushfit://', () => {
  it('nel tempo 1 l\'app scrive ancora fleofit://', () => {
    expect(SCHEMA).toBe('fleofit')
    expect(contenutoQR('1234')).toBe('fleofit://tv/1234')
    expect(linkApp('abc')).toMatch(/^fleofit:\/\/invito\//)
  })

  it('riconosce tutti e due i protocolli, e nient\'altro', () => {
    expect(eNostroProtocollo('pushfit:')).toBe(true)
    expect(eNostroProtocollo('fleofit:')).toBe(true)
    expect(eNostroProtocollo('pushfitx:')).toBe(false)
    expect(eNostroProtocollo('https:')).toBe(false)
    expect(eNostroProtocollo(undefined)).toBe(false)
  })

  it('il QR della TV si legge con tutti e due gli schemi', () => {
    expect(codiceDaQR('pushfit://tv/1234')).toBe('1234')
    expect(codiceDaQR('fleofit://tv/1234')).toBe('1234')
    expect(codiceDaQR('pushfit://tvx/1234')).toBeNull()
    expect(codiceDaQR('xpushfit://tv/1234')).toBeNull()
  })

  it('il ritorno da Garmin si legge con tutti e due gli schemi', () => {
    expect(rottaDaDeepLinkGarmin('pushfit://garmin?esito=ok')).toBe('/settings?garmin=ok')
    expect(rottaDaDeepLinkGarmin('fleofit://garmin?esito=ok')).toBe('/settings?garmin=ok')
    expect(rottaDaDeepLinkGarmin('pushfit://garminx?esito=ok')).toBeNull()
  })

  it('il timer e la TV si riconoscono con tutti e due gli schemi', () => {
    expect(eLinkDelTimer('pushfit://timer')).toBe(true)
    expect(eLinkDelTimer('fleofit://timer')).toBe(true)
    expect(eLinkDellaTV('pushfit://tv/1234')).toBe(true)
  })

  it('il link d\'invito si legge con tutti e due gli schemi', () => {
    expect(codiceDaLinkApp('pushfit://invito/ABC123')).toBe(codiceDaLinkApp('fleofit://invito/ABC123'))
    expect(codiceDaLinkApp('pushfit://invito/ABC123')).toBeTruthy()
  })
})
