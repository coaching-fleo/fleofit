import { describe, it, expect, vi } from 'vitest'
import { leggiErroreLink, messaggioErroreLink, segnalaLinkFallito, ascoltaErroreLink } from '../esitoLink'

describe('leggiErroreLink', () => {
  it('legge l\'errore di Supabase dall\'hash (il ritorno del link della mail)', () => {
    expect(leggiErroreLink('?inviteCode=ABCD1234', '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'))
      .toEqual({ codice: 'otp_expired', descrizione: 'Email link is invalid or has expired' })
  })

  it('lo legge anche dalla query', () => {
    expect(leggiErroreLink('?error=server_error&error_description=Boom', '')).toEqual({ codice: 'server_error', descrizione: 'Boom' })
  })

  it('basta il codice, anche senza descrizione', () => {
    expect(leggiErroreLink('', '#error_code=otp_expired')).toEqual({ codice: 'otp_expired', descrizione: '' })
  })

  it('un ritorno con i token non è un errore', () => {
    expect(leggiErroreLink('?inviteCode=X', '#access_token=a&refresh_token=b&type=signup')).toBeNull()
  })

  it('il nostro ?error=unauthorized non è un errore di Supabase', () => {
    expect(leggiErroreLink('?error=unauthorized', '')).toBeNull()
  })
})

describe('messaggioErroreLink', () => {
  it('link scaduto o già usato: dice di entrare con email e password', () => {
    const m = messaggioErroreLink({ codice: 'otp_expired', descrizione: '' })
    expect(m.title).toBe('Link scaduto o già usato')
    expect(m.message).toMatch(/email e password/)
  })

  it('senza dettagli dà comunque un avviso, mai il silenzio', () => {
    const m = messaggioErroreLink({ codice: '', descrizione: '' })
    expect(m.type).toBe('error')
    expect(m.message).toMatch(/email e password/)
    expect(m.message).not.toMatch(/Dettaglio/)
  })
})

describe('segnalaLinkFallito / ascoltaErroreLink', () => {
  it('consegna al login un errore arrivato mentre era già aperto', () => {
    const cb = vi.fn()
    const smetti = ascoltaErroreLink(cb)
    segnalaLinkFallito(null)
    expect(cb).toHaveBeenCalledTimes(1)
    smetti()
  })

  it('consegna l\'errore arrivato PRIMA che il login si aprisse, una volta sola', () => {
    segnalaLinkFallito({ codice: 'otp_expired', descrizione: '' })
    const cb = vi.fn()
    const smetti = ascoltaErroreLink(cb)
    expect(cb).toHaveBeenCalledWith({ codice: 'otp_expired', descrizione: '' })
    smetti()
    const altro = vi.fn()
    ascoltaErroreLink(altro)()
    expect(altro).not.toHaveBeenCalled()
  })
})
