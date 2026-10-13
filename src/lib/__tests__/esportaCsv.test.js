import { describe, it, expect } from 'vitest'
import { csvDa, nomeFileAnalisi } from '../esportaCsv'

// Il CSV si apre quasi sempre in Excel italiano: punto e virgola come
// separatore, virgola decimale, BOM perché gli accenti non diventino «Ã¨».

const colonne = [
  { titolo: 'Atleta', valore: r => r.nome },
  { titolo: 'Ore', valore: r => r.ore },
]

describe('csvDa', () => {
  it('BOM, intestazione, separatore «;», righe in CRLF', () => {
    const csv = csvDa(colonne, [{ nome: 'Anna', ore: 2 }])
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv.slice(1)).toBe('Atleta;Ore\r\nAnna;2')
  })

  it('virgola decimale, e un dato mancante è un campo vuoto', () => {
    expect(csvDa(colonne, [{ nome: 'Anna', ore: 1.5 }, { nome: 'Bruno', ore: null }]).slice(1))
      .toBe('Atleta;Ore\r\nAnna;1,5\r\nBruno;')
  })

  it('quota i campi con «;», virgolette o a capo', () => {
    const csv = csvDa(colonne, [{ nome: 'Rossi; Anna', ore: 1 }, { nome: 'Il "capo"', ore: 1 }, { nome: 'a\nb', ore: 1 }])
    expect(csv.slice(1).split('\r\n').slice(1)).toEqual(['"Rossi; Anna";1', '"Il ""capo""";1', '"a\nb";1'])
  })
})

describe('nomeFileAnalisi', () => {
  const OGGI = new Date('2026-10-14T10:00:00')
  it('periodo e data, e il nome dell\'atleta se c\'è', () => {
    expect(nomeFileAnalisi(8, null, OGGI)).toBe('fleofit-analisi-8sett-2026-10-14.csv')
    expect(nomeFileAnalisi(12, 'Giulia Neri', OGGI)).toBe('fleofit-analisi-giulia-neri-12sett-2026-10-14.csv')
  })
})

describe('csvDa: formule', () => {
  it('un testo che comincia con = + - @ non diventa una formula in Excel; i numeri negativi restano numeri', () => {
    const csv = csvDa(colonne, [{ nome: '=HYPERLINK("x")', ore: -1.5 }, { nome: '@Anna', ore: 1 }])
    expect(csv.slice(1).split('\r\n').slice(1)).toEqual(['"\'=HYPERLINK(""x"")";-1,5', "'@Anna;1"])
  })
})
