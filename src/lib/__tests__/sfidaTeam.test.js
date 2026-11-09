import { describe, it, expect } from 'vitest'
import {
  METRICHE, GIORNI_REINVITO, TETTI, versoDi, leggiValore, scriviValore,
  ordinaSfida, vittorie, testaATesta, puoReinvitare,
} from '../sfidaTeam'

describe('sfidaTeam', () => {
  it('le costanti della spec', () => {
    expect(METRICHE).toEqual(['tempo', 'ripetizioni', 'kg', 'distanza'])
    expect(GIORNI_REINVITO).toBe(3)
    expect(TETTI).toEqual({ tempo: 86400, ripetizioni: 10000, kg: 100000, distanza: 1000000 })
    expect(versoDi('tempo')).toBe('minore')
    expect(versoDi('kg')).toBe('maggiore')
  })

  it('il tempo minore vince, pari valore = pari posto, chi manca va in coda', () => {
    const r = ordinaSfida([{ atleta_id: 'a', valore: 300 }, { atleta_id: 'b', valore: 280 }, { atleta_id: 'c', valore: 280 }], ['a', 'b', 'c', 'd'], 'tempo')
    expect(r.map(x => [x.atleta_id, x.posto, x.distacco])).toEqual([['b', 1, 0], ['c', 1, 0], ['a', 3, 20], ['d', null, null]])
  })

  it('le ripetizioni maggiori vincono', () => {
    expect(ordinaSfida([{ atleta_id: 'a', valore: 90 }, { atleta_id: 'b', valore: 120 }], ['a', 'b'], 'ripetizioni')[0])
      .toMatchObject({ atleta_id: 'b', posto: 1, distacco: 0 })
  })

  it('un risultato di chi non è più fra i membri resta in classifica', () => {
    const r = ordinaSfida([{ atleta_id: 'ex', valore: 100 }, { atleta_id: 'a', valore: 120 }], ['a'], 'tempo')
    expect(r.map(x => x.atleta_id)).toEqual(['ex', 'a'])
  })

  // Revisione 09/11: su iPhone il tastierino numerico non ha i due punti. Come
  // leggiTempoScritto dei risultati di gara, «4.07» e «4,07» valgono «4:07».
  it('leggiValore: il tempo si scrive anche con punto o virgola', () => {
    expect(leggiValore('4.07', 'tempo')).toBe(247)
    expect(leggiValore('4,07', 'tempo')).toBe(247)
    expect(leggiValore('1.02.30', 'tempo')).toBe(3750)
    expect(leggiValore('4.75', 'tempo')).toBeNull()
  })

  it('leggiValore', () => {
    expect(leggiValore('4:07', 'tempo')).toBe(247)
    expect(leggiValore('1:05:03', 'tempo')).toBe(3903)
    expect(leggiValore('90', 'tempo')).toBe(90)
    expect(leggiValore('1:75', 'tempo')).toBeNull()
    expect(leggiValore('', 'kg')).toBeNull()
    expect(leggiValore('0', 'ripetizioni')).toBeNull()
    expect(leggiValore('86401', 'tempo')).toBeNull()
    expect(leggiValore('62,5', 'kg')).toBe(62.5)
    expect(leggiValore('abc', 'distanza')).toBeNull()
  })

  it('scriviValore non scrive mai zero per un dato assente', () => {
    expect(scriviValore(null, 'tempo')).toBe('—')
    expect(scriviValore(247, 'tempo')).toBe('4:07')
    expect(scriviValore(3903, 'tempo')).toBe('1:05:03')
    expect(scriviValore(5200, 'distanza')).toBe('5,2 km')
    expect(scriviValore(800, 'distanza')).toBe('800 m')
    expect(scriviValore(1250, 'kg')).toBe('1.250 kg')
    expect(scriviValore(120, 'ripetizioni')).toBe('120')
  })

  it('vittorie: ogni primo posto vale 1, anche a pari merito', () => {
    const v = vittorie([
      { metrica: 'tempo', risultati: [{ atleta_id: 'a', valore: 300 }, { atleta_id: 'b', valore: 310 }] },
      { metrica: 'kg', risultati: [{ atleta_id: 'a', valore: 100 }, { atleta_id: 'b', valore: 100 }] },
    ])
    expect(v.get('a')).toBe(2)
    expect(v.get('b')).toBe(1)
  })

  it('testa a testa conta 1 a testa e lascia null i pari', () => {
    const s = [
      { data: '2026-11-01', metrica: 'tempo', risultati: [{ atleta_id: 'a', valore: 300 }, { atleta_id: 'b', valore: 310 }] },
      { data: '2026-11-03', metrica: 'ripetizioni', risultati: [{ atleta_id: 'a', valore: 80 }, { atleta_id: 'b', valore: 95 }] },
      { data: '2026-11-05', metrica: 'kg', risultati: [{ atleta_id: 'a', valore: 100 }, { atleta_id: 'b', valore: 100 }] },
    ]
    const t = testaATesta(s, 'a', 'b')
    expect([t.a, t.b]).toEqual([1, 1])
    expect(t.sedute.map(x => x.vincitore)).toEqual(['a', 'b', null])
    expect(t.sedute[0].distacco).toBe(10)
  })

  it('testa a testa: se uno dei due manca la seduta non ha vincitore', () => {
    const t = testaATesta([{ data: 'x', metrica: 'tempo', risultati: [{ atleta_id: 'a', valore: 300 }] }], 'a', 'b')
    expect([t.a, t.b]).toEqual([0, 0])
    expect(t.sedute[0].vincitore).toBeNull()
  })

  it('reinvito dopo 3 giorni, non prima', () => {
    const adesso = new Date('2026-11-06T12:00:00Z')
    expect(puoReinvitare('2026-11-04T12:00:00Z', adesso)).toBe(false)
    expect(puoReinvitare('2026-11-03T12:00:00Z', adesso)).toBe(true)
    expect(puoReinvitare(null, adesso)).toBe(true)
  })
})
