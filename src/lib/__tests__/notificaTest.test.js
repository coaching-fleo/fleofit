import { describe, it, expect } from 'vitest'
import {
  ATTESA_TEST_MS, TITOLO_TEST, TESTO_TEST, ROUTE_TEST, puoProvareNotifica, dispositivoDi,
} from '../../../supabase/functions/send-reminders/notificaTest.ts'
import { esitoNotificaTest } from '../notificaTest'

// «Notifica di prova» (20/11/2026): solo un admin, solo il telefono da cui parte.

describe('notifica di prova, server', () => {
  it('parte dopo 5 secondi, con un testo fisso e la Home', () => {
    expect(ATTESA_TEST_MS).toBe(5000)
    expect(TITOLO_TEST).toMatch(/prova/i)
    expect(TESTO_TEST.length).toBeGreaterThan(0)
    expect(ROUTE_TEST).toBe('/')
  })

  it('la può chiedere solo un admin con un id', () => {
    expect(puoProvareNotifica({ admin: true, id: 'u1' })).toBe(true)
    expect(puoProvareNotifica({ admin: false, id: 'u1' })).toBe(false)
    expect(puoProvareNotifica({ admin: true, id: null })).toBe(false)
  })

  it('va SOLO al dispositivo indicato, e solo se è di chi la chiede', () => {
    const iscrizioni = [
      { id: 1, user_id: 'u1', endpoint: 'tok-a' },
      { id: 2, user_id: 'u1', endpoint: 'tok-b' },
      { id: 3, user_id: 'u2', endpoint: 'tok-c' },
    ]
    expect(dispositivoDi(iscrizioni, 'u1', 'tok-b')?.id).toBe(2)
    expect(dispositivoDi(iscrizioni, 'u1', 'tok-c')).toBeNull()
    expect(dispositivoDi(iscrizioni, 'u1', '')).toBeNull()
    expect(dispositivoDi(iscrizioni, 'u1', null)).toBeNull()
    expect(dispositivoDi(null, 'u1', 'tok-a')).toBeNull()
  })
})

describe('esitoNotificaTest', () => {
  it('dice di aspettare 5 secondi se è partita', () => {
    expect(esitoNotificaTest({ success: true })).toEqual({ errore: false, testo: expect.stringMatching(/5 secondi/) })
  })
  it('senza token su questo telefono', () => {
    expect(esitoNotificaTest(null, { senzaToken: true }).errore).toBe(true)
  })
  it('dispositivo non iscritto', () => {
    const e = esitoNotificaTest({ error: 'dispositivo_sconosciuto' })
    expect(e.errore).toBe(true)
    expect(e.testo).toMatch(/notifiche/i)
  })
  it('chiamata fallita', () => {
    expect(esitoNotificaTest(null).errore).toBe(true)
  })
})
