import { describe, it, expect } from 'vitest'
import { teamPerAtleta } from '../membriTeam'
import { conAtleta, gruppiDi } from '../gruppiAtleti'

// «Team e gruppi» dalla scheda di un atleta (16/11/2026). Gli errori che a
// schermo non si vedono: un bottone «Invita» su un team in cui il database
// rifiuterà l'invito (team chiuso, coach diverso, reinvito prima di 3 giorni,
// atleta in pausa), un «Togli» sul team di un coach che non è il suo, e un
// gruppo che salvando perde gli altri atleti o raddoppia questo.

const ADESSO = new Date('2026-11-16T12:00:00Z')
const giorniFa = (n) => new Date(ADESSO.getTime() - n * 86400000).toISOString()
const T = (id, extra) => ({ id, nome: `Team ${id}`, coach_id: 'c1', chiuso_il: null, ...extra })

describe('teamPerAtleta', () => {
  const base = { coachDi: ['c1'], inPausa: false, adesso: ADESSO }

  it('senza riga: si può invitare', () => {
    const [r] = teamPerAtleta([T('a')], [], base)
    expect(r).toMatchObject({ id: 'a', stato: 'fuori', azione: 'invita' })
  })

  it('dentro: il coach lo può togliere', () => {
    const [r] = teamPerAtleta([T('a')], [{ team_id: 'a', stato: 'dentro' }], base)
    expect(r).toMatchObject({ stato: 'dentro', azione: 'togli', testo: 'Dentro' })
  })

  it('invitato: si annulla, con da quanto aspetta', () => {
    const [r] = teamPerAtleta([T('a')], [{ team_id: 'a', stato: 'invitato', invitato_il: giorniFa(2) }], base)
    expect(r).toMatchObject({ stato: 'invitato', azione: 'annulla', testo: 'In attesa da 2 giorni' })
  })

  it('rifiutato da un giorno: niente reinvito, e dice fra quanto', () => {
    const [r] = teamPerAtleta([T('a')], [{ team_id: 'a', stato: 'rifiutato', risposto_il: giorniFa(1) }], base)
    expect(r).toMatchObject({ azione: null, testo: 'Non ha accettato · fra 2 giorni' })
  })

  it('uscito da più di 3 giorni: si reinvita', () => {
    const [r] = teamPerAtleta([T('a')], [{ team_id: 'a', stato: 'uscito', risposto_il: giorniFa(4) }], base)
    expect(r).toMatchObject({ azione: 'invita', testo: 'È uscito' })
  })

  it('in pausa: non si invita (come nel foglio Invita del team)', () => {
    const [r] = teamPerAtleta([T('a')], [], { ...base, inPausa: true })
    expect(r).toMatchObject({ azione: null, testo: 'In pausa' })
  })

  it('i team chiusi e quelli di un coach che non lo segue non compaiono', () => {
    const lista = teamPerAtleta(
      [T('a'), T('b', { chiuso_il: giorniFa(1) }), T('c', { coach_id: 'altro' })], [], base)
    expect(lista.map(t => t.id)).toEqual(['a'])
  })

  it('ma un team di un altro coach in cui è già dentro resta, senza azione', () => {
    const lista = teamPerAtleta([T('c', { coach_id: 'altro' })], [{ team_id: 'c', stato: 'dentro' }], base)
    expect(lista).toHaveLength(1)
    expect(lista[0].azione).toBeNull()
  })
})

describe('gruppi di un atleta', () => {
  const g = (id, atleti) => ({ id, nome: `G${id}`, atleti })

  it('gruppiDi: quelli che lo contengono', () => {
    expect(gruppiDi([g(1, ['x', 'y']), g(2, ['y']), g(3, null)], 'x').map(x => x.id)).toEqual([1])
  })

  it('conAtleta aggiunge in coda una volta sola, e tiene gli altri', () => {
    expect(conAtleta(g(1, ['y']), 'x', true)).toEqual(['y', 'x'])
    expect(conAtleta(g(1, ['y', 'x']), 'x', true)).toEqual(['y', 'x'])
  })

  it('conAtleta toglie solo lui', () => {
    expect(conAtleta(g(1, ['y', 'x', 'z']), 'x', false)).toEqual(['y', 'z'])
    expect(conAtleta(g(1, null), 'x', false)).toEqual([])
  })
})
