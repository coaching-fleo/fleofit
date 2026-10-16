import { describe, it, expect, vi, beforeEach } from 'vitest'
import { clientDemo, azzeraDemo } from '../supabaseDemo'
import { semi, VERSIONE_SEME } from '../demoSemi'
import { visibiliPer, ordina } from '../lib/messaggiCoach'

// La bacheca «Dal coach» si guarda nell'ambiente di prova. I semi devono
// mostrare tutti i casi della regola d'iscrizione: un fissato, uno recente e
// un avviso vecchio che l'utente demo (iscritto 20 giorni fa) NON deve vedere.
const GIORNI_ISCRIZIONE = 20
const iscrittoIl = new Date(Date.now() - GIORNI_ISCRIZIONE * 86400000).toISOString()

describe('i messaggi della demo', () => {
  const messaggi = semi().messaggi_coach

  it('sono quattro, di cui uno fissato', () => {
    expect(messaggi).toHaveLength(4)
    expect(messaggi.filter(m => m.fissato)).toHaveLength(1)
  })

  it('uno è precedente all\'iscrizione e non fissato', () => {
    const vecchi = messaggi.filter(m => !m.fissato && new Date(m.creato_at) < new Date(iscrittoIl))
    expect(vecchi).toHaveLength(1)
  })

  it('per un atleta iscritto 20 giorni fa ne restano tre, il fissato in cima', () => {
    const v = ordina(visibiliPer(messaggi, { iscrittoIl, coach: false }))
    expect(v).toHaveLength(3)
    expect(v[0].fissato).toBe(true)
  })

  it('la versione dei semi è salita a 12', () => {
    expect(VERSIONE_SEME).toBe(12)
  })
})

describe('demo: insert su messaggi_coach', () => {
  beforeEach(() => { vi.spyOn(console, 'info').mockImplementation(() => {}); azzeraDemo() })

  it('applica i default del database: creato_at, fissato, modificato_at', async () => {
    const { data } = await clientDemo().from('messaggi_coach').insert({ testo: 'Prova', autore: 'c' }).select().single()
    expect(new Date(data.creato_at).getTime()).not.toBeNaN()
    expect(data.fissato).toBe(false)
    expect(data.modificato_at).toBeNull()
  })

  it('i valori passati vincono sui default', async () => {
    const { data } = await clientDemo().from('messaggi_coach').insert({ testo: 'x', fissato: true }).select().single()
    expect(data.fissato).toBe(true)
  })
})
