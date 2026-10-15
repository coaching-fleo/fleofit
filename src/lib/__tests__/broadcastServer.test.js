import { describe, it, expect } from 'vitest'
import {
  TITOLO_BROADCAST, EMAIL_DEMO, puoInviareBroadcast, anteprima, routeMessaggio, destinatariBroadcast,
} from '../../../supabase/functions/send-reminders/broadcast.ts'
import { COACHING_ID } from '../constants'

// «Messaggio a tutti»: la parte pura del modo `broadcast` di send-reminders.
// Due garanzie contano: l'account demo (che è admin per l'App Store) non deve
// poter far partire push a tutti, e nessun atleta riceve lo stesso messaggio due volte.

describe('puoInviareBroadcast', () => {
  it('ammette gli admin, anche con spazi e maiuscole', () => {
    expect(puoInviareBroadcast('coaching@federicoleo.it')).toBe(true)
    expect(puoInviareBroadcast(' Federico.Leo88@gmail.com ')).toBe(true)
  })
  it('esclude il demo, gli atleti e chi non ha email', () => {
    expect(EMAIL_DEMO).toBe('demo@fleofit.it')
    expect(puoInviareBroadcast('demo@fleofit.it')).toBe(false)
    expect(puoInviareBroadcast('atleta@x.it')).toBe(false)
    expect(puoInviareBroadcast(null)).toBe(false)
  })
})

describe('anteprima', () => {
  it('lascia intatto un testo corto', () => {
    expect(anteprima('Ciao a tutti')).toBe('Ciao a tutti')
  })
  it('taglia all\'ultimo spazio e aggiunge i puntini', () => {
    const parole = ['a', 'casa', 'cammino', 'straordinariamente', 'sì', 'montagna']
    const lungo = Array.from({ length: 60 }, (_, i) => parole[i % parole.length]).join(' ')
    const a = anteprima(lungo)
    expect(a.length).toBeLessThanOrEqual(121)
    expect(a.endsWith('…')).toBe(true)
    expect(a.slice(0, -1).split(' ').every((p) => parole.includes(p))).toBe(true)
  })
  it('senza spazi taglia a 120 e aggiunge i puntini', () => {
    expect(anteprima('x'.repeat(200))).toBe('x'.repeat(120) + '…')
  })
  it('comprime gli spazi e gli a capo', () => {
    expect(anteprima('riga uno\n\nriga  due')).toBe('riga uno riga due')
  })
})

describe('routeMessaggio', () => {
  it('porta alla bacheca col messaggio', () => {
    expect(routeMessaggio('abc')).toBe('/messaggi?m=abc')
    expect(TITOLO_BROADCAST).toBe('Messaggio dal coach')
  })
})

describe('destinatariBroadcast', () => {
  it('toglie eliminati, account nascosto, mittente e già notificati', () => {
    const atleti = [
      { id: 'a1', deleted_at: null },
      { id: 'a2', deleted_at: 1700000000000 },
      { id: COACHING_ID, deleted_at: null },
      { id: 'm1', deleted_at: null },
      { id: 'a3', deleted_at: null },
      { id: 'a4', deleted_at: null },
    ]
    expect(destinatariBroadcast(atleti, { mittenteId: 'm1', coachingId: COACHING_ID, giaNotificati: ['a3'] }))
      .toEqual(['a1', 'a4'])
  })
})
