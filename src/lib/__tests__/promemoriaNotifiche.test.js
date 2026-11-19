import { describe, it, expect } from 'vitest'
import {
  CHIAVE_PROMEMORIA_NOTIFICHE, PAUSE_GIORNI, STATO_INIZIALE,
  normalizza, deveChiedere, mostraMai, dopoNonOra, dopoMai,
  leggiStato, scriviStato, azzera,
} from '../promemoriaNotifiche'

const giorno = (s) => new Date(`${s}T10:00:00`)

const memoria = () => {
  const m = new Map()
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  }
}

describe('promemoriaNotifiche', () => {
  it('le pause sono quelle decise', () => {
    expect(PAUSE_GIORNI).toEqual([3, 7, 14, 30, 60])
    expect(CHIAVE_PROMEMORIA_NOTIFICHE).toBe('pushfit_promemoria_notifiche')
  })

  it('la prima volta chiede', () => {
    expect(deveChiedere(STATO_INIZIALE, giorno('2026-11-19'))).toBe(true)
  })

  it('dopo il primo «Non ora» aspetta 3 giorni', () => {
    const s = { rifiuti: 1, ultimo: '2026-11-19', mai: false }
    expect(deveChiedere(s, giorno('2026-11-21'))).toBe(false)
    expect(deveChiedere(s, giorno('2026-11-22'))).toBe(true)
  })

  it('dopo il quinto aspetta 60 giorni', () => {
    const s = { rifiuti: 5, ultimo: '2026-01-01', mai: false }
    expect(deveChiedere(s, giorno('2026-03-01'))).toBe(false) // 59 giorni
    expect(deveChiedere(s, giorno('2026-03-02'))).toBe(true)  // 60
  })

  it('al sesto non chiede più', () => {
    const s = { rifiuti: 6, ultimo: '2020-01-01', mai: false }
    expect(deveChiedere(s, giorno('2026-11-19'))).toBe(false)
  })

  it('«Non chiedermelo più» vale per sempre', () => {
    expect(deveChiedere({ ...STATO_INIZIALE, mai: true }, giorno('2026-11-19'))).toBe(false)
  })

  it('con l\'ultimo rifiuto nel futuro non chiede', () => {
    const s = { rifiuti: 1, ultimo: '2026-12-31', mai: false }
    expect(deveChiedere(s, giorno('2026-11-19'))).toBe(false)
  })

  it('i valori rotti tornano allo stato iniziale', () => {
    expect(normalizza('x')).toEqual(STATO_INIZIALE)
    expect(normalizza({ rifiuti: 'a' })).toEqual(STATO_INIZIALE)
    expect(normalizza(null)).toEqual(STATO_INIZIALE)
    expect(normalizza({ rifiuti: 2, ultimo: 'boh', mai: false })).toEqual(STATO_INIZIALE)
  })

  it('«Non chiedermelo più» compare dalla seconda volta', () => {
    expect(mostraMai(STATO_INIZIALE)).toBe(false)
    expect(mostraMai({ rifiuti: 1, ultimo: '2026-11-19', mai: false })).toBe(true)
  })

  it('«Non ora» conta e segna il giorno; «Mai» spegne', () => {
    expect(dopoNonOra(STATO_INIZIALE, giorno('2026-11-19'))).toEqual({ rifiuti: 1, ultimo: '2026-11-19', mai: false })
    expect(dopoMai(STATO_INIZIALE).mai).toBe(true)
  })

  it('legge, scrive e azzera sul telefono', () => {
    const st = memoria()
    st.setItem(CHIAVE_PROMEMORIA_NOTIFICHE, '{rotto')
    expect(leggiStato(st)).toEqual(STATO_INIZIALE)
    const s = { rifiuti: 2, ultimo: '2026-11-19', mai: false }
    scriviStato(s, st)
    expect(leggiStato(st)).toEqual(s)
    azzera(st)
    expect(leggiStato(st)).toEqual(STATO_INIZIALE)
  })
})
