import { describe, it, expect } from 'vitest'
import { leggiLinkConferma, ritornoSicuro, ritornoConSessione, ritornoConErrore, testiConferma } from '../confermaLink'

const ORIGINE = 'https://fleofit.vercel.app'
const SESSIONE = { access_token: 'AT', refresh_token: 'RT', expires_in: 3600, expires_at: 1900000000, token_type: 'bearer' }

describe('leggiLinkConferma', () => {
  it('legge codice, tipo e ritorno codificato', () => {
    const r = leggiLinkConferma('?token_hash=abc&type=recovery&torna=fleofit%3A%2F%2Flogin-callback')
    expect(r).toEqual({ tokenHash: 'abc', tipo: 'recovery', torna: 'fleofit://login-callback' })
  })
  it('un ritorno NON codificato con la sua query resta intero', () => {
    const r = leggiLinkConferma('?token_hash=abc&type=email&torna=fleofit://login-callback?inviteCode=AB12&x=1')
    expect(r.torna).toBe('fleofit://login-callback?inviteCode=AB12&x=1')
  })
  it('un ritorno codificato tutto in minuscolo (come lo scrive Supabase) si decodifica', () => {
    const r = leggiLinkConferma('?token_hash=abc&type=email&torna=fleofit%3a%2f%2flogin-callback%3finviteCode%3dAB12')
    expect(r.torna).toBe('fleofit://login-callback?inviteCode=AB12')
  })
  it('un tipo sconosciuto non passa', () => {
    expect(leggiLinkConferma('?token_hash=abc&type=boh').tipo).toBeNull()
  })
})

describe('ritornoSicuro', () => {
  it('ammette il ritorno dell\'app, con tutti e due gli schemi', () => {
    expect(ritornoSicuro('fleofit://login-callback?inviteCode=AB', ORIGINE)).toBe('fleofit://login-callback?inviteCode=AB')
    expect(ritornoSicuro('pushfit://login-callback', ORIGINE)).toBe('pushfit://login-callback')
  })
  it('ammette il nostro sito e pushfit.it', () => {
    expect(ritornoSicuro('https://fleofit.vercel.app/?inviteCode=AB', ORIGINE)).toBe('https://fleofit.vercel.app/?inviteCode=AB')
    expect(ritornoSicuro('https://pushfit.it', ORIGINE)).toBe('https://pushfit.it')
  })
  it('mai verso un sito estraneo o un altro deep link: si torna all\'origine', () => {
    expect(ritornoSicuro('https://cattivo.example/rubo', ORIGINE)).toBe(ORIGINE)
    expect(ritornoSicuro('https://fleofit.vercel.app.cattivo.example', ORIGINE)).toBe(ORIGINE)
    expect(ritornoSicuro('fleofit://garmin', ORIGINE)).toBe(ORIGINE)
    expect(ritornoSicuro('javascript:alert(1)', ORIGINE)).toBe(ORIGINE)
    expect(ritornoSicuro('', ORIGINE)).toBe(ORIGINE)
  })
  it('un hash già presente nel ritorno si toglie', () => {
    expect(ritornoSicuro('https://fleofit.vercel.app/#x=1', ORIGINE)).toBe('https://fleofit.vercel.app/')
  })
})

describe('ritornoConSessione / ritornoConErrore', () => {
  it('mette la sessione nell\'hash come faceva Supabase, con il tipo', () => {
    const u = new URL(ritornoConSessione('https://fleofit.vercel.app/', SESSIONE, 'recovery'))
    const h = new URLSearchParams(u.hash.slice(1))
    expect(h.get('access_token')).toBe('AT')
    expect(h.get('refresh_token')).toBe('RT')
    expect(h.get('type')).toBe('recovery')
  })
  it('un codice scaduto diventa otp_expired, che esitoLink.js sa spiegare', () => {
    const u = ritornoConErrore('fleofit://login-callback', { message: 'Email link is invalid or has expired' })
    expect(new URLSearchParams(u.split('#')[1]).get('error_code')).toBe('otp_expired')
  })
})

describe('testiConferma', () => {
  it('reset e conferma hanno testi diversi', () => {
    expect(testiConferma('recovery').bottone).toMatch(/password/)
    expect(testiConferma('email').bottone).toMatch(/email/)
  })
})
