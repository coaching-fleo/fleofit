import { describe, it, expect } from 'vitest'
import {
  TITOLO_BROADCAST, EMAIL_DEMO, puoInviareBroadcast, anteprima, routeMessaggio, destinatariBroadcast,
  TITOLO_PROVA, ROUTE_BACHECA, testoAccettabile, motivoFcm, routeProva, puoInviareQuestoMessaggio,
} from '../../../supabase/functions/send-reminders/broadcast.ts'
import { COACHING_ID } from '../constants'

// «Messaggio a tutti»: la parte pura del modo `broadcast` di send-reminders.
// Due garanzie contano: l'account demo (che è admin per l'App Store) non deve
// poter far partire push a tutti, e nessun atleta riceve lo stesso messaggio due volte.

describe('puoInviareBroadcast', () => {
  it('ammette admin e coach (il ruolo viene dallo staff), anche con email in maiuscolo', () => {
    expect(puoInviareBroadcast('coaching@federicoleo.it', 'admin')).toBe(true)
    expect(puoInviareBroadcast(' Federico.Leo88@gmail.com ', 'admin')).toBe(true)
    expect(puoInviareBroadcast('x@y.it', 'coach')).toBe(true)
  })
  it('esclude il demo, gli atleti (ruolo null) e chi non ha email', () => {
    expect(EMAIL_DEMO).toBe('demo@fleofit.it')
    expect(puoInviareBroadcast('demo@fleofit.it', 'admin')).toBe(false)
    expect(puoInviareBroadcast('x@y.it', null)).toBe(false)
    expect(puoInviareBroadcast('coaching@federicoleo.it', null)).toBe(false)
    expect(puoInviareBroadcast(null, 'admin')).toBe(false)
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
  it('toglie anche gli account admin passati in escludi', () => {
    const atleti = [
      { id: 'a1', deleted_at: null },
      { id: 'adm', deleted_at: null }, // un coach che ha anche una riga athletes
      { id: 'a2', deleted_at: null },
    ]
    expect(destinatariBroadcast(atleti, { mittenteId: 'm1', coachingId: COACHING_ID, giaNotificati: [], escludi: ['adm'] }))
      .toEqual(['a1', 'a2'])
  })
  it('con ammessi limita agli id elencati (i miei atleti)', () => {
    const atleti = ['a1', 'a2', 'a3'].map((id) => ({ id, deleted_at: null }))
    const base = { mittenteId: 'm1', coachingId: COACHING_ID, giaNotificati: [] }
    expect(destinatariBroadcast(atleti, { ...base, ammessi: ['a1', 'a2'] })).toEqual(['a1', 'a2'])
    expect(destinatariBroadcast(atleti, { ...base, ammessi: [] })).toEqual([])
    expect(destinatariBroadcast(atleti, { ...base, ammessi: 'tutti' })).toEqual(['a1', 'a2', 'a3'])
  })
  it('ammessi non toglie le altre esclusioni (già notificati, mittente, eliminati)', () => {
    const atleti = [{ id: 'a1', deleted_at: null }, { id: 'a2', deleted_at: 1 }, { id: 'm1', deleted_at: null }, { id: 'a3', deleted_at: null }]
    expect(destinatariBroadcast(atleti, { mittenteId: 'm1', coachingId: COACHING_ID, giaNotificati: ['a3'], ammessi: ['a1', 'a2', 'm1', 'a3'] }))
      .toEqual(['a1'])
  })
  it('senza escludi si comporta come prima', () => {
    expect(destinatariBroadcast([{ id: 'a1', deleted_at: null }], { mittenteId: 'm1', coachingId: COACHING_ID, giaNotificati: [] }))
      .toEqual(['a1'])
  })
})

// «Prova su di me»: la push parte solo verso i dispositivi del coach, e il
// messaggio non entra in bacheca. Il titolo dice che è una prova.
describe('prova su di me', () => {
  it('il titolo dice che è una prova, e porta alla bacheca senza un messaggio', () => {
    expect(TITOLO_PROVA).toBe('Messaggio dal coach (prova)')
    expect(TITOLO_PROVA).not.toBe(TITOLO_BROADCAST)
    expect(ROUTE_BACHECA).toBe('/messaggi')
  })
  it('testoAccettabile torna il testo pulito, o null se vuoto o troppo lungo', () => {
    expect(testoAccettabile('  Ciao a tutti \n')).toBe('Ciao a tutti')
    expect(testoAccettabile('   \n\t ')).toBeNull()
    expect(testoAccettabile('x'.repeat(2000))).toBe('x'.repeat(2000))
    expect(testoAccettabile('x'.repeat(2001))).toBeNull()
    expect(testoAccettabile(undefined)).toBeNull()
    expect(testoAccettabile(42)).toBeNull()
  })
})

describe('motivoFcm', () => {
  it('prende errorCode dai dettagli di FCM, poi status, poi il codice HTTP', () => {
    const apns = '{"error":{"code":401,"message":"Auth error from APNS or Web Push Service","status":"UNAUTHENTICATED","details":[{"@type":"type.googleapis.com/google.firebase.fcm.v1.FcmError","errorCode":"THIRD_PARTY_AUTH_ERROR"}]}}'
    expect(motivoFcm(401, apns)).toBe('THIRD_PARTY_AUTH_ERROR')
    expect(motivoFcm(400, '{"error":{"code":400,"status":"INVALID_ARGUMENT"}}')).toBe('INVALID_ARGUMENT')
    expect(motivoFcm(503, 'Service Unavailable')).toBe('HTTP_503')
  })
})

describe('routeProva (temporaneo)', () => {
  it('un id di prova porta a quella prova; il resto alla bacheca', () => {
    expect(routeProva('prova-abc123')).toBe('/messaggi?m=prova-abc123')
    expect(routeProva(undefined)).toBe('/messaggi')
    expect(routeProva('xyz')).toBe('/messaggi')
    expect(routeProva('prova-../../admin')).toBe('/messaggi')
    expect(routeProva('prova-' + 'a'.repeat(41))).toBe('/messaggi')
  })
})

describe('puoInviareQuestoMessaggio', () => {
  // Il broadcast parte da un `record_id`: senza questo controllo un coach
  // potrebbe far ripartire le push di un messaggio scritto da un altro coach.
  it('l\'autore sì', () => {
    expect(puoInviareQuestoMessaggio('c1', { id: 'c1', ruoloStaff: 'coach' })).toBe(true)
  })
  it('un altro coach no', () => {
    expect(puoInviareQuestoMessaggio('c1', { id: 'c2', ruoloStaff: 'coach' })).toBe(false)
  })
  it('un admin sempre', () => {
    expect(puoInviareQuestoMessaggio('c1', { id: 'a1', ruoloStaff: 'admin' })).toBe(true)
  })
  it('senza id né ruolo, no', () => {
    expect(puoInviareQuestoMessaggio('c1', { id: null, ruoloStaff: null })).toBe(false)
    expect(puoInviareQuestoMessaggio(null, { id: null, ruoloStaff: null })).toBe(false)
  })
})
