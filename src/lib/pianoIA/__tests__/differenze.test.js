import { describe, it, expect } from 'vitest'
import { applicaDifferenze, adattaSeduta, SCHEMA_DIFFERENZE } from '../differenze.js'
import { sedutaHyrox } from './fixtureProgrammi.js'

const s = sedutaHyrox.sections
const casa = { luogo: 'casa', skierg: false, rower: false, slitta: false, wallBall: false }
const opzCasa = { minutiPrevisti: 60, attrezzatura: casa, esclusioni: [] }

describe('applicaDifferenze', () => {
  it('sostituisci cambia il nome e tiene numeri e posizione', () => {
    const r = applicaDifferenze(s, [{ op: 'sostituisci', blocco: 1, esercizio: 1, con: 'Rowing' }])
    expect(r.ignorate).toEqual([])
    expect(r.sections.blocks[1].exercises[1]).toMatchObject({ name: 'Rowing', meters: '500m', intensity: '7' })
    expect(r.sections.blocks[1].exercises).toHaveLength(2)
  })

  it('numero cambia solo quel campo, dell’esercizio o del blocco', () => {
    const r = applicaDifferenze(s, [
      { op: 'numero', blocco: 1, esercizio: 0, campo: 'reps', valore: '15' },
      { op: 'numero', blocco: 1, esercizio: null, campo: 'duration', valore: '18:00' },
    ])
    expect(r.sections.blocks[1].exercises[0]).toMatchObject({ name: 'Wall Balls', reps: '15', kg: '6' })
    expect(r.sections.blocks[1].params.duration).toBe('18:00')
  })

  it('togli toglie un esercizio', () => {
    const r = applicaDifferenze(s, [{ op: 'togli', blocco: 2, esercizio: 0 }])
    expect(r.sections.blocks[2].exercises.map(e => e.name)).toEqual(['Run'])
  })

  it('indici inesistenti, op sconosciute o campi non ammessi finiscono in ignorate, senza eccezioni', () => {
    const r = applicaDifferenze(s, [
      { op: 'togli', blocco: 9, esercizio: 0 },
      { op: 'esplodi' },
      { op: 'numero', blocco: 0, esercizio: 0, campo: 'id', valore: '1' },
      { op: 'numero', blocco: 1, esercizio: null, campo: 'reps', valore: '1' },
      { op: 'sostituisci', blocco: 1, esercizio: 0, con: '' },
      null,
    ])
    expect(r.ignorate).toHaveLength(6)
    expect(r.sections).toEqual(s)
  })

  it('differenze non array = nessuna modifica', () =>
    expect(applicaDifferenze(s, 'boh')).toEqual({ sections: s, ignorate: [] }))

  it('non muta l’oggetto in ingresso', () => {
    const prima = structuredClone(s)
    applicaDifferenze(s, [{ op: 'sostituisci', blocco: 1, esercizio: 1, con: 'Rowing' }])
    expect(s).toEqual(prima)
  })

  it('su una seduta di corsa cambia durata e passo di una fase', () => {
    const corsa = { category: 'Running', steps: [{ type: 'run', duration: '40 min', pace: 'Z3' }] }
    const r = applicaDifferenze(corsa, [
      { op: 'numero', blocco: 0, esercizio: null, campo: 'duration', valore: '35 min' },
      { op: 'numero', blocco: 0, esercizio: null, campo: 'pace', valore: 'Z2' },
    ])
    expect(r.sections.steps[0]).toMatchObject({ duration: '35 min', pace: 'Z2' })
  })
})

describe('adattaSeduta', () => {
  const daCasa = [
    { op: 'sostituisci', blocco: 1, esercizio: 0, con: 'Squat' },
    { op: 'sostituisci', blocco: 1, esercizio: 1, con: 'Burpees' },
    { op: 'sostituisci', blocco: 2, esercizio: 0, con: 'Burpees Broad Jumps' },
  ]

  it('Sled Push e stazioni sostituite con esercizi da casa → adattata', () => {
    const r = adattaSeduta(s, daCasa, opzCasa)
    expect(r.origine).toBe('adattata')
    expect(r.errori).toEqual([])
    expect(r.sections.blocks[2].exercises[0].name).toBe('Burpees Broad Jumps')
  })

  it('differenze che lasciano la slitta a casa → torna la seduta del team, con gli errori', () => {
    const r = adattaSeduta(s, daCasa.slice(0, 2), opzCasa)
    expect(r.origine).toBe('team')
    expect(r.sections.blocks[2].exercises[0].name).toBe('Sled Push')
    expect(r.errori.length).toBeGreaterThan(0)
  })

  it('senza differenze e con la seduta del team valida → origine team, nessun errore', () => {
    const r = adattaSeduta(s, [], { ...opzCasa, attrezzatura: { luogo: 'hyrox' } })
    expect(r).toMatchObject({ origine: 'team', errori: [] })
  })
})

describe('SCHEMA_DIFFERENZE', () => {
  it('vieta campi extra e richiede differenze e perché', () => {
    expect(SCHEMA_DIFFERENZE.additionalProperties).toBe(false)
    expect(SCHEMA_DIFFERENZE.required).toEqual(['differenze', 'perche'])
    for (const v of SCHEMA_DIFFERENZE.properties.differenze.items.anyOf) expect(v.additionalProperties).toBe(false)
  })
})
