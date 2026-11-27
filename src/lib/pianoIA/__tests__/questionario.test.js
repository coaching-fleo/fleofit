import { describe, it, expect } from 'vitest'
import {
  validaRisposte, controlloSicurezza, livelloStimato, settimaneAllaGara, profiloPerIA,
  DOMANDE_SICUREZZA, ETA_MINIMA,
} from '../questionario.js'

const noSicurezza = { petto: false, svenimenti: false, cuore: false, gravidanza: false, intervento: false }
const base = {
  obiettivo: 'migliorare',
  gara: { data: '2027-02-26', nome: 'HYROX Milano' },
  categoria: { divisione: 'open', formato: 'singolo', sesso: 'uomo' },
  tempoObiettivoMin: 85, ultimoTempoHyroxMin: 95, tempo5kSec: 1500,
  anniAllenamento: 2, stazioniDeboli: ['Wall Balls'],
  sedute: 4, giorni: [1, 2, 4, 6], minutiSeduta: 60,
  attrezzatura: { luogo: 'palestra', skierg: true, rower: true, slitta: false, wallBall: true },
  eta: 30, pesoKg: 78, sicurezza: noSicurezza, esclusioni: [], salute: null,
}

describe('questionario', () => {
  it('ha cinque domande di sicurezza ed età minima 18', () => {
    expect(DOMANDE_SICUREZZA.map(d => d.id)).toEqual(['petto', 'svenimenti', 'cuore', 'gravidanza', 'intervento'])
    expect(ETA_MINIMA).toBe(18)
  })

  it('validaRisposte rifiuta sedute fuori 2–6, giorni meno delle sedute, minuti < 20', () => {
    expect(validaRisposte({ ...base, sedute: 7 }).errori).toContain('sedute')
    expect(validaRisposte({ ...base, sedute: 1 }).errori).toContain('sedute')
    expect(validaRisposte({ ...base, sedute: 4, giorni: [1, 3, 5] }).errori).toContain('giorni')
    expect(validaRisposte({ ...base, minutiSeduta: 15 }).errori).toContain('minutiSeduta')
    expect(validaRisposte(base)).toEqual({ ok: true, errori: [] })
  })

  it('obiettivo diverso da senza_gara richiede la gara', () => {
    expect(validaRisposte({ ...base, obiettivo: 'prima_gara', gara: null }).errori).toContain('gara')
    expect(validaRisposte({ ...base, obiettivo: 'senza_gara', gara: null }).ok).toBe(true)
  })

  it('controlloSicurezza ferma sotto 18 anni e con un sì alle domande di sicurezza', () => {
    expect(controlloSicurezza({ ...base, eta: 17 })).toEqual({ stop: true, motivo: 'eta' })
    expect(controlloSicurezza({ ...base, eta: 18 })).toEqual({ stop: false, motivo: null })
    expect(controlloSicurezza({ ...base, sicurezza: { ...noSicurezza, cuore: true } })).toEqual({ stop: true, motivo: 'sicurezza' })
    expect(controlloSicurezza(base)).toEqual({ stop: false, motivo: null })
  })

  it('livelloStimato', () => {
    expect(livelloStimato({ ...base, anniAllenamento: 0.5, ultimoTempoHyroxMin: null })).toBe('principiante')
    expect(livelloStimato({ ...base, anniAllenamento: 1, ultimoTempoHyroxMin: 74 })).toBe('avanzato')
    expect(livelloStimato({ ...base, anniAllenamento: 3, ultimoTempoHyroxMin: null })).toBe('avanzato')
    expect(livelloStimato({ ...base, anniAllenamento: 2, ultimoTempoHyroxMin: 95 })).toBe('intermedio')
    expect(livelloStimato({ ...base, anniAllenamento: null, ultimoTempoHyroxMin: null })).toBe('principiante')
  })

  it('settimaneAllaGara arrotonda per difetto, null senza gara o se la gara è passata', () => {
    const oggi = new Date('2026-11-27')
    expect(settimaneAllaGara(base, oggi)).toBe(13)
    expect(settimaneAllaGara({ ...base, gara: { data: '2026-11-01', nome: 'X' } }, oggi)).toBeNull()
    expect(settimaneAllaGara({ ...base, gara: null }, oggi)).toBeNull()
  })

  it('profiloPerIA pseudonimizza e lascia null i dati mancanti', () => {
    const p = profiloPerIA({ ...base, eta: 34, tempo5kSec: null, pesoKg: null, salute: 'ginocchio dx' }, new Date('2026-11-27'))
    expect(p.fasciaEta).toBe('30-39')
    expect(p.tempo5kSec).toBeNull()
    expect(p.livello).toBe('intermedio')
    expect(p.settimaneAllaGara).toBe(13)
    expect(JSON.stringify(p)).not.toMatch(/ginocchio|Milano|nome|email/)
    expect(Object.values(p).some(v => Number.isNaN(v))).toBe(false)
  })

  it('profiloPerIA: fascia null senza età, 60+ dai 60 anni', () => {
    expect(profiloPerIA({ ...base, eta: null }, new Date('2026-11-27')).fasciaEta).toBeNull()
    expect(profiloPerIA({ ...base, eta: 64 }, new Date('2026-11-27')).fasciaEta).toBe('60+')
  })
})

describe('revisione finale: zero e negativi', () => {
  it('un tempo Hyrox 0 (campo vuoto passato da Number) non fa un avanzato', () => {
    expect(livelloStimato({ anniAllenamento: null, ultimoTempoHyroxMin: 0 })).toBe('principiante')
  })

  it('tempi e peso a 0 o negativi arrivano all’IA come null', () => {
    const p = profiloPerIA({ ...base, tempo5kSec: 0, ultimoTempoHyroxMin: -5, tempoObiettivoMin: 0 }, new Date('2026-11-27T12:00:00Z'))
    expect(p.tempo5kSec).toBeNull()
    expect(p.ultimoTempoHyroxMin).toBeNull()
    expect(p.tempoObiettivoMin).toBeNull()
  })
})
