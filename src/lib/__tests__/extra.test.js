import { describe, it, expect, vi, beforeEach } from 'vitest'
import app from '../../App.jsx?raw'
import semi from '../../demoSemi.js?raw'

vi.mock('../scarpeDb', () => ({
  leggiScarpeAtleta: vi.fn(),
  elencoCatalogo: vi.fn(),
}))

import { EXTRA, ruoloExtra } from '../extra'
import { leggiScarpeAtleta, elencoCatalogo } from '../scarpeDb'
import { stato, avviso } from '../extra/scarpe'

// Un extra nuovo non entra a metà: senza rotta protetta dal suo interruttore, o
// senza la riga nel seme della demo, questo test fallisce (spec 2026-11-12 §2).
describe('ogni extra del registro è completo', () => {
  it('il registro non è vuoto', () => {
    expect(EXTRA.map(e => e.id)).toContain('scarpe')
  })
  it.each(EXTRA)('$id ha la rotta in App.jsx dentro SoloSeAccesa', (e) => {
    expect(app).toContain(`path="${e.rotta}" element={<SoloSeAccesa nome="${e.interruttore}">`)
  })
  it.each(EXTRA)('$id ha la riga nel seme della demo', (e) => {
    expect(semi).toContain(`{ nome: '${e.interruttore}', stato: 'tutti'`)
  })
  it.each(EXTRA)('$id ha una descrizione per ogni ruolo in cui compare', (e) => {
    for (const r of e.ruoli) expect(e.descrizione[r]).toBeTruthy()
  })
})

describe('ruoloExtra', () => {
  it('admin e coach contano come coach', () => {
    expect(ruoloExtra('admin')).toBe('coach')
    expect(ruoloExtra('coach')).toBe('coach')
    expect(ruoloExtra('athlete')).toBe('athlete')
  })
})

const scarpa = (id, modello, statoKm = 'ok', extra = {}) => ({ id, modello, stato: statoKm, ritirata_at: null, ...extra })

describe('Scarpe: avviso', () => {
  beforeEach(() => vi.clearAllMocks())
  it('una scarpa oltre la soglia: alta', async () => {
    leggiScarpeAtleta.mockResolvedValue({ disponibile: true, scarpe: [scarpa('s0', 'Ride'), scarpa('s1', 'Pegasus', 'oltre')] })
    expect(await avviso('u1', 'athlete')).toEqual({ chiave: 'cambia:s1', testo: 'Pegasus è da cambiare', priorita: 'alta' })
  })
  it('nessuna scarpa attiva: invito normale', async () => {
    leggiScarpeAtleta.mockResolvedValue({ disponibile: true, scarpe: [scarpa('s1', 'Vecchia', 'oltre', { ritirata_at: '2026-01-01' })] })
    expect(await avviso('u1', 'athlete')).toEqual({ chiave: 'aggiungi', testo: 'Tieni il conto dei km delle tue scarpe', priorita: 'normale' })
  })
  it('scarpe in regola: niente', async () => {
    leggiScarpeAtleta.mockResolvedValue({ disponibile: true, scarpe: [scarpa('s1', 'Pegasus')] })
    expect(await avviso('u1', 'athlete')).toBeNull()
  })
  it('coach, funzione non disponibile o errore: niente', async () => {
    expect(await avviso('u1', 'coach')).toBeNull()
    leggiScarpeAtleta.mockResolvedValue({ disponibile: false, scarpe: [] })
    expect(await avviso('u1', 'athlete')).toBeNull()
    leggiScarpeAtleta.mockRejectedValue(new Error('rete'))
    expect(await avviso('u1', 'athlete')).toBeNull()
  })
})

describe('Scarpe: stato', () => {
  beforeEach(() => vi.clearAllMocks())
  it('atleta', async () => {
    leggiScarpeAtleta.mockResolvedValue({ disponibile: true, scarpe: [scarpa('a', 'A'), scarpa('b', 'B', 'oltre'), scarpa('c', 'C')] })
    expect(await stato('u1', 'athlete')).toBe('3 scarpe · una da cambiare')
    leggiScarpeAtleta.mockResolvedValue({ disponibile: true, scarpe: [scarpa('a', 'A')] })
    expect(await stato('u1', 'athlete')).toBe('1 scarpa')
    leggiScarpeAtleta.mockResolvedValue({ disponibile: true, scarpe: [] })
    expect(await stato('u1', 'athlete')).toBeNull()
  })
  it('coach', async () => {
    elencoCatalogo.mockResolvedValue(Array.from({ length: 12 }, (_, i) => ({ id: i })))
    expect(await stato('u1', 'coach')).toBe('12 modelli')
    elencoCatalogo.mockResolvedValue([])
    expect(await stato('u1', 'coach')).toBeNull()
    elencoCatalogo.mockRejectedValue(new Error('spenta'))
    expect(await stato('u1', 'coach')).toBeNull()
  })
})
