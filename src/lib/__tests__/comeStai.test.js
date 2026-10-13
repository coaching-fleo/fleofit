import { describe, it, expect } from 'vitest'
import {
  DOMANDE, punteggio, fasciaComeStai, comeStaiPerSettimana, mediaComeStaiPer, daChiedereOggi,
} from '../comeStai'
import { settimaneDelPeriodo } from '../analisi'

// «Come stai oggi»: quattro risposte da 1 a 5, sempre con 5 = la cosa buona.
// I casi: una risposta saltata non vale zero, e una settimana senza risposte
// non è una settimana «male».

const OGGI = new Date('2026-10-14T10:00:00')
const riga = (athlete_id, giorno, v = {}) => ({ athlete_id, giorno, sonno: null, energia: null, dolori: null, stress: null, ...v })

describe('comeStai', () => {
  it('quattro domande, nell\'ordine in cui si fanno', () => {
    expect(DOMANDE.map(d => d.chiave)).toEqual(['sonno', 'energia', 'dolori', 'stress'])
  })

  it('il punteggio è la media delle risposte date, con un decimale', () => {
    expect(punteggio(riga('a', '2026-10-14', { sonno: 4, energia: 5, dolori: 3, stress: 4 }))).toBe(4)
    expect(punteggio(riga('a', '2026-10-14', { sonno: 2, energia: 3 }))).toBe(2.5)
    expect(punteggio(riga('a', '2026-10-14'))).toBeNull()
    expect(punteggio(null)).toBeNull()
  })

  it('tre fasce, e niente fascia senza un numero', () => {
    expect(fasciaComeStai(4.2).chiave).toBe('bene')
    expect(fasciaComeStai(3).chiave).toBe('cosi')
    expect(fasciaComeStai(2.5).chiave).toBe('male')
    expect(fasciaComeStai(null)).toBeNull()
  })

  it('media per settimana, e una settimana senza risposte è null', () => {
    const settimane = settimaneDelPeriodo(4, OGGI)
    const serie = comeStaiPerSettimana([
      riga('a', '2026-10-12', { sonno: 4, energia: 4 }),
      riga('b', '2026-10-13', { sonno: 2, energia: 2 }),
      riga('a', '2026-10-06', { sonno: 5 }),
    ], settimane)
    expect(serie.map(s => s.valore)).toEqual([null, null, 5, 3])
  })

  it('la media di un atleta nel periodo, null se non ha mai risposto', () => {
    const settimane = settimaneDelPeriodo(4, OGGI)
    const righe = [riga('a', '2026-10-12', { sonno: 4 }), riga('a', '2026-10-06', { sonno: 2 }), riga('a', '2026-08-01', { sonno: 1 })]
    expect(mediaComeStaiPer(righe, 'a', settimane)).toBe(3)
    expect(mediaComeStaiPer(righe, 'b', settimane)).toBeNull()
  })

  it('si chiede una volta al giorno: non se ha già risposto, non se ha saltato oggi', () => {
    expect(daChiedereOggi({ risposta: null, saltato: null, oggi: '2026-10-14' })).toBe(true)
    expect(daChiedereOggi({ risposta: riga('a', '2026-10-14', { sonno: 3 }), saltato: null, oggi: '2026-10-14' })).toBe(false)
    expect(daChiedereOggi({ risposta: null, saltato: '2026-10-14', oggi: '2026-10-14' })).toBe(false)
    expect(daChiedereOggi({ risposta: null, saltato: '2026-10-13', oggi: '2026-10-14' })).toBe(true)
    // Ancora in lettura, o tabella non disponibile: non si chiede.
    expect(daChiedereOggi({ risposta: undefined, saltato: null, oggi: '2026-10-14' })).toBe(false)
  })
})
