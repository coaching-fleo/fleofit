import { describe, it, expect } from 'vitest'
import { validaSeduta, TOLLERANZA_DURATA } from '../validaSeduta.js'
import { richiede, disponibile } from '../attrezzatura.js'
import { sedutaHyrox } from './fixtureProgrammi.js'

const hyrox = { luogo: 'hyrox', skierg: false, rower: false, slitta: false, wallBall: false }
const casa = { luogo: 'casa', skierg: false, rower: false, slitta: false, wallBall: false }
const opz = { minutiPrevisti: 60, attrezzatura: hyrox, esclusioni: [] }
const tipi = (r) => [...new Set(r.errori.map(e => e.tipo))]

/** La seduta di prova con il secondo esercizio dell'AMRAP sostituito. */
const conEsercizio = (name) => {
  const s = structuredClone(sedutaHyrox.sections)
  s.blocks[1].exercises[1] = { name, reps: '10', intensity: '7' }
  return s
}

describe('attrezzatura', () => {
  it('richiede', () => {
    expect(richiede('Sled Push')).toEqual(['slitta'])
    expect(richiede('SkiErg')).toEqual(['skierg'])
    expect(richiede('Rowing')).toEqual(['rower'])
    expect(richiede('Wall Balls')).toEqual(['wallBall'])
    expect(richiede('Kettlebell Swing')).toEqual(['palestra'])
    expect(richiede('Burpees')).toEqual([])
    expect(richiede('Run')).toEqual([])
  })
  it('disponibile: hyrox tutto, palestra senza le spunte, casa solo corpo libero e spunte', () => {
    expect(disponibile('Sled Push', hyrox)).toBe(true)
    expect(disponibile('Sled Push', { ...casa, luogo: 'palestra' })).toBe(false)
    expect(disponibile('Kettlebell Swing', { ...casa, luogo: 'palestra' })).toBe(true)
    expect(disponibile('Kettlebell Swing', casa)).toBe(false)
    expect(disponibile('Rowing', { ...casa, rower: true })).toBe(true)
    expect(disponibile('Burpees', casa)).toBe(true)
  })
})

describe('validaSeduta', () => {
  it('tolleranza 15%', () => expect(TOLLERANZA_DURATA).toBe(0.15))

  it('una seduta Hyrox del team valida passa e torna con gli id', () => {
    const r = validaSeduta(sedutaHyrox.sections, opz)
    expect(r.errori).toEqual([])
    expect(r.ok).toBe(true)
    expect(r.sections.blocks[0].id).toBeTypeOf('number')
  })

  it('nome fuori dal picker → errore nome', () =>
    expect(tipi(validaSeduta(conEsercizio('Salto quantico del gatto'), opz))).toContain('nome'))

  it('un nome scritto male ma riconoscibile si corregge e passa', () => {
    const r = validaSeduta(conEsercizio('wall balls'), opz)
    expect(r.ok).toBe(true)
    expect(r.sections.blocks[1].exercises[1].name).toBe('Wall Balls')
  })

  it('durata oltre ±15% dei minuti previsti → errore durata', () => {
    expect(tipi(validaSeduta(sedutaHyrox.sections, { ...opz, minutiPrevisti: 50 }))).toContain('durata')
    expect(tipi(validaSeduta(sedutaHyrox.sections, { ...opz, minutiPrevisti: 75 }))).toContain('durata')
    expect(validaSeduta(sedutaHyrox.sections, { ...opz, minutiPrevisti: 53 }).ok).toBe(true)
  })

  it('Sled Push con luogo casa → errore attrezzatura', () =>
    expect(tipi(validaSeduta(sedutaHyrox.sections, { ...opz, attrezzatura: casa }))).toContain('attrezzatura'))

  it('esercizio escluso dall’utente → errore esclusione (anche scritto in minuscolo)', () =>
    expect(tipi(validaSeduta(sedutaHyrox.sections, { ...opz, esclusioni: ['wall balls'] }))).toContain('esclusione'))

  it('sections non oggetto o senza blocchi → errore formato, nessuna eccezione', () => {
    expect(tipi(validaSeduta(null, opz))).toEqual(['formato'])
    expect(tipi(validaSeduta({ category: 'Hyrox', blocks: [] }, opz))).toEqual(['formato'])
    expect(tipi(validaSeduta({ category: 'Running' }, opz))).toEqual(['formato'])
  })

  it('una seduta di corsa usa la durata delle fasi e non controlla l’attrezzatura', () => {
    const corsa = { category: 'Running', steps: [
      { type: 'warmup', duration: '10 min', pace: 'Z2' },
      { type: 'run', duration: '40 min', pace: 'Z3' },
      { type: 'cooldown', duration: '10 min', pace: 'Z1' },
    ] }
    const r = validaSeduta(corsa, { ...opz, attrezzatura: casa })
    expect(r.errori).toEqual([])
    expect(r.sections.steps[0].id).toBeTypeOf('number')
  })

  it('una seduta Gym con carichi a casa → errore attrezzatura', () => {
    const gym = { category: 'Gym', gym: [{ fase: 'principale', serie: '4', recupero: '1:30', esercizi: [{ name: 'Panca piana con bilanciere', reps: '10', kg: '60 kg' }] }] }
    expect(tipi(validaSeduta(gym, { ...opz, minutiPrevisti: null, attrezzatura: casa }))).toContain('attrezzatura')
  })

  it('minutiPrevisti null = durata non controllata', () =>
    expect(validaSeduta(sedutaHyrox.sections, { ...opz, minutiPrevisti: null }).ok).toBe(true))
})
