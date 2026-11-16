import { describe, it, expect } from 'vitest'
import {
  NOME_MAX, nomeGruppoValido, membriVisibili, statoGruppo, alternaGruppo, gruppoUguale,
} from '../gruppiAtleti'

// Gruppi di atleti (16/11/2026): una scorciatoia del coach per spuntare più
// atleti in un tocco. Conta solo chi il coach vede ancora.

const A = (id) => ({ id, name: id, surname: '' })
const atleti = [A('a'), A('b'), A('c'), A('d')]
const g = (id, nome, ids) => ({ id, nome, atleti: ids })

describe('membriVisibili', () => {
  it('tiene solo gli atleti che il coach vede, nell\'ordine della lista', () => {
    expect(membriVisibili(g('1', 'x', ['c', 'sparito', 'a']), atleti).map(x => x.id)).toEqual(['a', 'c'])
  })
  it('regge un gruppo senza array', () => {
    expect(membriVisibili({ id: '1', nome: 'x' }, atleti)).toEqual([])
  })
})

describe('statoGruppo', () => {
  const gr = g('1', 'x', ['a', 'b', 'c'])
  it('vuoto se nessun membro è visibile', () => {
    expect(statoGruppo(g('1', 'x', ['sparito']), [], atleti)).toBe('vuoto')
  })
  it('nessuno, alcuni, tutti', () => {
    expect(statoGruppo(gr, [], atleti)).toBe('nessuno')
    expect(statoGruppo(gr, [A('b')], atleti)).toBe('alcuni')
    expect(statoGruppo(gr, [A('a'), A('b'), A('c'), A('d')], atleti)).toBe('tutti')
  })
  it('un id sparito non impedisce «tutti»', () => {
    expect(statoGruppo(g('1', 'x', ['a', 'sparito']), [A('a')], atleti)).toBe('tutti')
  })
})

describe('alternaGruppo', () => {
  const gr = g('1', 'x', ['a', 'b', 'c'])
  it('con alcuni già scelti aggiunge i mancanti e non toglie nessuno', () => {
    const r = alternaGruppo(gr, [A('d'), A('b')], atleti)
    expect(r.map(x => x.id)).toEqual(['d', 'b', 'a', 'c'])
  })
  it('con tutti già scelti toglie solo i membri', () => {
    const r = alternaGruppo(gr, [A('a'), A('d'), A('b'), A('c')], atleti)
    expect(r.map(x => x.id)).toEqual(['d'])
  })
  it('un gruppo vuoto non cambia niente', () => {
    const scelti = [A('d')]
    expect(alternaGruppo(g('1', 'x', ['sparito']), scelti, atleti)).toBe(scelti)
  })
})

describe('nomeGruppoValido', () => {
  const gruppi = [g('1', 'Hyrox', [])]
  it('vuoto o solo spazi', () => {
    expect(nomeGruppoValido('   ', gruppi)).toBe('Scrivi un nome.')
    expect(nomeGruppoValido(undefined, gruppi)).toBe('Scrivi un nome.')
  })
  it('massimo 40 caratteri dopo il trim', () => {
    expect(NOME_MAX).toBe(40)
    expect(nomeGruppoValido('x'.repeat(41), gruppi)).toBe('Massimo 40 caratteri.')
    expect(nomeGruppoValido(`  ${'x'.repeat(40)}  `, gruppi)).toBeNull()
  })
  it('doppio, maiuscole e spazi ignorati, tranne il gruppo che si sta modificando', () => {
    expect(nomeGruppoValido(' hyrox ', gruppi)).toBe('Hai già un gruppo con questo nome.')
    expect(nomeGruppoValido('hyrox', gruppi, '1')).toBeNull()
    expect(nomeGruppoValido('Corsa', gruppi)).toBeNull()
  })
})

describe('gruppoUguale', () => {
  const gruppi = [g('1', 'x', ['a', 'b', 'sparito']), g('2', 'y', ['c'])]
  it('stesso insieme di membri visibili, in qualunque ordine', () => {
    expect(gruppoUguale(gruppi, ['b', 'a'], atleti)?.id).toBe('1')
  })
  it('null se nessun gruppo coincide', () => {
    expect(gruppoUguale(gruppi, ['a'], atleti)).toBeNull()
    expect(gruppoUguale(gruppi, ['a', 'b', 'c'], atleti)).toBeNull()
  })
})
