import { describe, it, expect } from 'vitest'
import { mostraLandingAllaRadice } from '../landingRadice'

describe('mostraLandingAllaRadice', () => {
  it('sul web, alla radice nuda, mostra la landing', () => {
    expect(mostraLandingAllaRadice({ pathname: '/' }, false)).toBe(true)
  })
  it('nell\'app nativa mai: si va al login', () => {
    expect(mostraLandingAllaRadice({ pathname: '/' }, true)).toBe(false)
  })
  it('con un ? o un # (ritorno del login, invito, errore) si va al login come prima', () => {
    expect(mostraLandingAllaRadice({ pathname: '/', hash: '#access_token=x' }, false)).toBe(false)
    expect(mostraLandingAllaRadice({ pathname: '/', search: '?inviteCode=ABC' }, false)).toBe(false)
  })
  it('le altre pagine private portano al login', () => {
    expect(mostraLandingAllaRadice({ pathname: '/calendar' }, false)).toBe(false)
  })
})
