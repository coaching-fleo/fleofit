import { describe, it, expect } from 'vitest'
import sorgente from '../../pages/CreateWorkout.jsx?raw'
import { semi } from '../../demoSemi'
import {
  CATEGORIE_MODELLI, MAX_NOME, contenutoDaBlocco, bloccoDaModello, nomeProposto,
  anteprimaModello, modelloValido, nomeValido,
} from '../modelliBlocco'

// Tutte le chiavi `id` a qualunque profondità.
const idDi = (o, acc = []) => {
  if (Array.isArray(o)) o.forEach(x => idDi(x, acc))
  else if (o && typeof o === 'object') {
    for (const [k, v] of Object.entries(o)) { if (k === 'id') acc.push(v); else idDi(v, acc) }
  }
  return acc
}

const hyrox = () => ({
  id: 0.1, type: 'EMOM', params: { interval: '1:00', rounds: '10' }, notes: '',
  exercises: [
    { id: 0.2, name: 'Wall Balls', reps: '12', kg: '9' },
    { id: 0.3, name: 'Burpees', reps: '8' },
    { id: 0.31, name: 'Row', meters: '200m' },
  ],
})
const corsa = () => ({ id: 0.4, type: 'repeat', rounds: '8', runDuration: '400m', runPace: 'Z4', recDuration: '1 min', recPace: 'Camminata' })
const gymDettaglio = () => ({
  id: 0.5, fase: 'riscaldamento', serie: '3', recupero: '1:30', note: '',
  esercizi: [{ id: 0.6, name: 'Squat con bilanciere', reps: '8', kg: '80 kg',
    dettaglio: [{ id: 0.7, tipo: 'normale', reps: '8', kg: '80 kg' }, { id: 0.8, tipo: 'drop', reps: '8', kg: '60 kg' }] }],
})
const superserie = () => ({
  id: 0.9, fase: 'principale', serie: '3', recupero: '1:30', note: '',
  esercizi: [
    { id: 0.91, name: 'Panca piana con bilanciere', reps: '10' },
    { id: 0.92, name: 'Rematore con bilanciere', reps: '10' },
  ],
})

describe('contenutoDaBlocco', () => {
  it.each([['Hyrox', hyrox], ['Running', corsa], ['Gym', gymDettaglio]])('%s: nessun id e l\'originale non cambia', (cat, fab) => {
    const originale = fab()
    const prima = JSON.parse(JSON.stringify(originale))
    const c = contenutoDaBlocco(cat, originale)
    expect(idDi(c)).toEqual([])
    expect(originale).toEqual(prima)
  })
  it('Gym toglie la fase dal gruppo e dagli esercizi', () => {
    const g = gymDettaglio()
    g.esercizi[0].fase = 'riscaldamento'
    const c = contenutoDaBlocco('Gym', g)
    expect('fase' in c).toBe(false)
    expect('fase' in c.esercizi[0]).toBe(false)
    expect(c.esercizi[0].dettaglio).toHaveLength(2)
  })
})

describe('bloccoDaModello', () => {
  const modello = { categoria: 'Hyrox', contenuto: contenutoDaBlocco('Hyrox', hyrox()) }
  it('id nuovi a ogni livello, tutti diversi fra due inserimenti', () => {
    const a = bloccoDaModello(modello)
    const b = bloccoDaModello(modello)
    const ia = idDi(a); const ib = idDi(b)
    expect(ia).toHaveLength(4)
    expect(new Set([...ia, ...ib]).size).toBe(8)
  })
  it('la copia è indipendente da un\'altra e dal modello', () => {
    const a = bloccoDaModello(modello)
    const b = bloccoDaModello(modello)
    a.exercises[0].name = 'Altro'
    a.params.rounds = '99'
    expect(b.exercises[0].name).toBe('Wall Balls')
    expect(modello.contenuto.exercises[0].name).toBe('Wall Balls')
    expect(modello.contenuto.params.rounds).toBe('10')
  })
  it('Running: id nuovo sulla fase', () => {
    const m = { categoria: 'Running', contenuto: contenutoDaBlocco('Running', corsa()) }
    expect(idDi(bloccoDaModello(m))).toHaveLength(1)
  })
  it('Gym: la fase chiesta vince, altrimenti principale; id anche nel dettaglio', () => {
    const m = { categoria: 'Gym', contenuto: contenutoDaBlocco('Gym', gymDettaglio()) }
    expect(bloccoDaModello(m, { fase: 'defaticamento' }).fase).toBe('defaticamento')
    const g = bloccoDaModello(m, { fase: 'principale' })
    expect(g.fase).toBe('principale')
    expect(bloccoDaModello(m).fase).toBe('principale')
    expect(idDi(g)).toHaveLength(4)
    expect(g.esercizi[0].dettaglio[0].tipo).toBe('normale')
  })
})

describe('nomeProposto', () => {
  it('Hyrox: tipo, parametri e al massimo due esercizi poi «…»', () => {
    const n = nomeProposto('Hyrox', hyrox())
    expect(n).toContain('EMOM')
    expect(n).toContain('Wall Balls')
    expect(n).toContain('Burpees')
    expect(n).not.toContain('Row')
    expect(n).toContain('…')
  })
  it('Running ripetute', () => {
    expect(nomeProposto('Running', corsa())).toContain('8 × 400m')
  })
  it('Running fase semplice', () => {
    const n = nomeProposto('Running', { type: 'warmup', duration: '15 min', pace: 'Z2' })
    expect(n).toContain('15 min')
    expect(n).toContain('Z2')
  })
  it('Gym: nomi uniti da " + "', () => {
    const n = nomeProposto('Gym', superserie())
    expect(n).toContain('Panca piana con bilanciere + Rematore con bilanciere')
    expect(n).toContain('3 × 10')
  })
  it('un nome lungo esce di MAX_NOME caratteri e finisce con «…»', () => {
    const b = { type: 'EMOM', params: {}, exercises: [{ name: 'x'.repeat(60) }, { name: 'y'.repeat(60) }] }
    const n = nomeProposto('Hyrox', b)
    expect(n).toHaveLength(MAX_NOME)
    expect(n.endsWith('…')).toBe(true)
  })
})

describe('anteprimaModello', () => {
  it('non è mai vuota per i modelli di prova', () => {
    for (const m of semi().modelli_blocco) expect(anteprimaModello(m).length).toBeGreaterThan(0)
  })
  it('Gym dice serie × ripetizioni', () => {
    expect(anteprimaModello({ categoria: 'Gym', contenuto: contenutoDaBlocco('Gym', superserie()) })).toContain('3 × 10')
  })
})

describe('modelloValido', () => {
  it('rifiuta categoria Custom e contenuti incompleti', () => {
    expect(modelloValido({ categoria: 'Custom', contenuto: { type: 'x' } })).toBe(false)
    expect(modelloValido({ categoria: 'Hyrox', contenuto: { exercises: [] } })).toBe(false)
    expect(modelloValido({ categoria: 'Running', contenuto: { duration: '5 min' } })).toBe(false)
    expect(modelloValido({ categoria: 'Gym', contenuto: { serie: '3' } })).toBe(false)
    expect(modelloValido({ categoria: 'Hyrox', contenuto: null })).toBe(false)
    expect(modelloValido(null)).toBe(false)
  })
  it('accetta i sei modelli dei semi di prova', () => {
    const m = semi().modelli_blocco
    expect(m).toHaveLength(6)
    for (const x of m) expect(modelloValido(x)).toBe(true)
  })
})

describe('nomeValido', () => {
  it('da 1 a 80 caratteri dopo il trim', () => {
    expect(nomeValido('  ')).toBe(false)
    expect(nomeValido('x'.repeat(81))).toBe(false)
    expect(nomeValido('x'.repeat(80))).toBe(true)
    expect(nomeValido('Riscaldamento')).toBe(true)
  })
})

describe('regola delle categorie', () => {
  it('ogni categoria del builder con blocchi ha i modelli', () => {
    const blocco = sorgente.match(/const CATEGORIE = \[([\s\S]*?)\n\]/)[1]
    const categorie = [...blocco.matchAll(/id:\s*'([^']+)'/g)].map(m => m[1])
    expect(categorie).toEqual(expect.arrayContaining(['Hyrox', 'Running', 'Custom']))
    for (const c of categorie.filter(c => c !== 'Custom')) {
      expect(CATEGORIE_MODELLI, 'una categoria con blocchi ha i modelli (spec modelli di blocco, decisione 3)').toContain(c)
    }
  })
})

describe('blocchi mancanti', () => {
  // Chi chiama passa da modelloValido, ma un null non deve far cadere la pagina.
  it('contenutoDaBlocco e bloccoDaModello tornano null invece di lanciare', () => {
    expect(contenutoDaBlocco('Gym', null)).toBeNull()
    expect(contenutoDaBlocco('Hyrox', undefined)).toBeNull()
    expect(bloccoDaModello({ categoria: 'Gym', contenuto: null })).toBeNull()
    expect(bloccoDaModello(null)).toBeNull()
  })
})

