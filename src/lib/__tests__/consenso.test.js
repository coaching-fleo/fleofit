import { describe, it, expect } from 'vitest'
import { VERSIONE_CONSENSO, serveConsenso, datiConsenso, dataConsenso } from '../consenso'

// Perché questi test esistono
// ────────────────────────────
// `serveConsenso` decide chi entra nell'app: se dice «no» a torto, un atleta
// usa l'app (e i suoi dati di salute vanno all'IA) senza aver mai acconsentito;
// se dice «sì» a torto, la schermata ricompare a ogni avvio.

const atleta = (consenso) => ({ id: 'u1', user_metadata: consenso === undefined ? {} : { consenso } })

describe('serveConsenso', () => {
  it('lo chiede a un atleta che non l\'ha mai dato', () => {
    expect(serveConsenso(atleta(), false)).toBe(true)
  })

  it('lo chiede di nuovo se la versione è cambiata', () => {
    expect(serveConsenso(atleta({ versione: VERSIONE_CONSENSO - 1, il: '2026-10-01T10:00:00Z' }), false)).toBe(true)
  })

  it('non lo chiede a chi ha dato la versione in vigore', () => {
    expect(serveConsenso(atleta({ versione: VERSIONE_CONSENSO, il: '2026-10-27T10:00:00Z' }), false)).toBe(false)
  })

  it('lo chiede a chi l\'ha ritirato (consenso azzerato)', () => {
    expect(serveConsenso(atleta(null), false)).toBe(true)
  })

  it('non lo chiede allo staff: i coach non sono interessati del coaching', () => {
    expect(serveConsenso(atleta(), true)).toBe(false)
  })

  it('regge un utente senza metadati', () => {
    expect(serveConsenso({ id: 'u1' }, false)).toBe(true)
    expect(serveConsenso(null, false)).toBe(false)
  })
})

describe('datiConsenso e dataConsenso', () => {
  it('registra versione e istante', () => {
    const adesso = new Date('2026-10-27T09:30:00Z')
    expect(datiConsenso(adesso)).toEqual({ versione: VERSIONE_CONSENSO, il: '2026-10-27T09:30:00.000Z' })
  })

  it('legge la data del consenso in italiano', () => {
    expect(dataConsenso(atleta({ versione: VERSIONE_CONSENSO, il: '2026-10-27T09:30:00Z' }))).toBe('27 ott 2026')
  })

  it('non inventa una data che non c\'è', () => {
    expect(dataConsenso(atleta())).toBeNull()
    expect(dataConsenso(atleta({ versione: VERSIONE_CONSENSO, il: 'non-una-data' }))).toBeNull()
  })
})
