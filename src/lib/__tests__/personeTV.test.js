import { describe, it, expect } from 'vitest'
import { aggiungiPersona, personePerEsercizio, eserciziMassimi, bloccoAScaglioni, MAX_PERSONE } from '../personeTV'

const nomi = (righe) => righe.map(r => r.map(p => p.nome).join(''))

describe('personePerEsercizio', () => {
  const persone = [
    { nome: 'A', partenza: 1 },
    { nome: 'B', partenza: 2 },
    { nome: 'C', partenza: 4 },
  ]

  it('al primo esercizio ognuno sta su quello da cui parte', () => {
    expect(nomi(personePerEsercizio(0, 4, persone))).toEqual(['A', 'B', '', 'C'])
  })

  it('avanzano tutti insieme e il giro ricomincia dal primo', () => {
    expect(nomi(personePerEsercizio(1, 4, persone))).toEqual(['C', 'A', 'B', ''])
    expect(nomi(personePerEsercizio(3, 4, persone))).toEqual(['B', '', 'C', 'A'])
  })

  it('due persone sulla stessa partenza stanno sullo stesso esercizio', () => {
    expect(nomi(personePerEsercizio(0, 3, [{ nome: 'A', partenza: 2 }, { nome: 'B', partenza: 2 }]))).toEqual(['', 'AB', ''])
  })

  it('una partenza oltre gli esercizi del blocco fa il giro', () => {
    expect(nomi(personePerEsercizio(0, 3, [{ nome: 'A', partenza: 5 }]))).toEqual(['', 'A', ''])
  })

  it('nessun esercizio acceso: nessuno è da nessuna parte', () => {
    expect(nomi(personePerEsercizio(null, 3, persone))).toEqual(['', '', ''])
  })
})

describe('aggiungiPersona', () => {
  it('dà A, B… colori diversi e parte dall\'esercizio dopo', () => {
    let p = aggiungiPersona([], 3)
    p = aggiungiPersona(p, 3)
    p = aggiungiPersona(p, 3)
    p = aggiungiPersona(p, 3)
    expect(p.map(x => x.nome)).toEqual(['A', 'B', 'C', 'D'])
    expect(p.map(x => x.partenza)).toEqual([1, 2, 3, 1])
    expect(new Set(p.map(x => x.colore)).size).toBe(4)
  })

  it('dà la lettera del posto, saltando quelle già usate', () => {
    expect(aggiungiPersona([{ nome: 'Marco', colore: '#38bdf8' }], 4)[1].nome).toBe('B')
    expect(aggiungiPersona([{ nome: 'Marco' }, { nome: 'B' }], 4)[2].nome).toBe('C')
    expect(aggiungiPersona([{ nome: 'C' }, { nome: 'B' }], 4)[2].nome).toBe('D')
  })

  it('non va oltre il numero di colori', () => {
    let p = []
    for (let i = 0; i < MAX_PERSONE + 3; i++) p = aggiungiPersona(p, 4)
    expect(p).toHaveLength(MAX_PERSONE)
  })
})

describe('eserciziMassimi', () => {
  it('conta solo EMOM e ON/OFF con più di un esercizio', () => {
    const ex = (n) => Array.from({ length: n }, (_, i) => ({ name: `E${i}` }))
    const blocchi = [
      { type: 'For Time', exercises: ex(6) },
      { type: 'EMOM', exercises: ex(3) },
      { type: 'ON/OFF', exercises: ex(4) },
      { type: 'EMOM', exercises: ex(1) },
    ]
    expect(eserciziMassimi(blocchi)).toBe(4)
    expect(bloccoAScaglioni(blocchi[3])).toBe(false)
    expect(eserciziMassimi([{ type: 'AMRAP', exercises: ex(5) }])).toBe(0)
  })
})

describe('memoria delle persone', () => {
  it('ricorda per workout finché l\'app è aperta, e dimentica una lista vuota', async () => {
    const { personeRicordate, ricordaPersone } = await import('../personeTV')
    ricordaPersone('w1', [{ nome: 'A' }])
    expect(personeRicordate('w1')).toEqual([{ nome: 'A' }])
    expect(personeRicordate('w2')).toEqual([])
    ricordaPersone('w1', [])
    expect(personeRicordate('w1')).toEqual([])
  })
})

describe('bloccoPerPersone', () => {
  it('sceglie l\'EMOM o l\'ON/OFF con più esercizi', async () => {
    const { bloccoPerPersone } = await import('../personeTV')
    const a = { type: 'EMOM', exercises: [{}, {}] }
    const b = { type: 'ON/OFF', exercises: [{}, {}, {}] }
    expect(bloccoPerPersone([{ type: 'AMRAP', exercises: [{}, {}, {}, {}] }, a, b])).toBe(b)
    expect(bloccoPerPersone([{ type: 'AMRAP', exercises: [{}, {}] }])).toBe(null)
  })
})
