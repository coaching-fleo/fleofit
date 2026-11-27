import { describe, it, expect } from 'vitest'
import { riassuntoFeedback, allarmi, PAROLE_DOLORE } from '../riassunto.js'

const oggi = new Date('2026-11-27T12:00:00Z')
// Una seduta con intensità dichiarata 6 ovunque: RPE atteso 6.
const blocchi6 = [{ type: 'AMRAP', params: { duration: '20:00' }, exercises: [{ name: 'Burpees', reps: '10', intensity: '6' }] }]
const blocchi7 = [{ type: 'AMRAP', params: { duration: '20:00' }, exercises: [{ name: 'Burpees', reps: '10', intensity: '7' }] }]
const seduta = (data, status, notes = null, extra = {}) => ({ data, status, notes, blocks: blocchi6, carichi: null, ...extra })
const cs = (data, v) => ({ data, sonno: v, energia: v, dolori: v, stress: v })

describe('riassuntoFeedback', () => {
  it('nessuna seduta passata → tutti null, sedutePassate 0, nessun allarme', () => {
    const r = riassuntoFeedback({ sedute: [], comeStai: [], oggi })
    expect(r).toEqual({ aderenza7: null, aderenza28: null, rpeScarto: null, carichi: { meno: 0, piu: 0 }, comeStaiMedia: null, sedutePassate: 0 })
    expect(allarmi({ riassunto: r, sedute: [], comeStai: [], oggi })).toEqual([])
  })

  it('aderenza = completate / passate nella finestra; le future e quella di oggi non contano', () => {
    const sedute = [
      seduta('2026-11-21', 'completed'), seduta('2026-11-23', 'completed'), seduta('2026-11-24', 'pending'),
      seduta('2026-11-26', 'completed'), seduta('2026-11-27', 'pending'), seduta('2026-11-29', 'pending'),
      seduta('2026-11-05', 'pending'),
    ]
    const r = riassuntoFeedback({ sedute, comeStai: [], oggi })
    expect(r.aderenza7).toBe(0.75)
    expect(r.aderenza28).toBe(0.6)
    expect(r.sedutePassate).toBe(5)
  })

  it('rpeScarto usa rpeDichiarato: una nota senza RPE non vale 5', () => {
    const sedute = [
      seduta('2026-11-24', 'completed', '[RPE: 8/10]\nok'),
      seduta('2026-11-26', 'completed', 'senza rpe'),
    ]
    expect(riassuntoFeedback({ sedute, comeStai: [], oggi }).rpeScarto).toBe(2)
  })

  it('rpeScarto: media delle ultime 4 completate con RPE', () => {
    const sedute = ['2026-11-20', '2026-11-22', '2026-11-23', '2026-11-25', '2026-11-26']
      .map((d, i) => seduta(d, 'completed', `[RPE: ${i === 0 ? 10 : 7}/10]`))
    expect(riassuntoFeedback({ sedute, comeStai: [], oggi }).rpeScarto).toBe(1)
  })

  it('conta i carichi meno/più e la media di Come stai degli ultimi 7 giorni', () => {
    const sedute = [seduta('2026-11-25', 'completed', null, { carichi: 'meno' }), seduta('2026-11-26', 'completed', null, { carichi: 'piu' }), seduta('2026-11-24', 'completed', null, { carichi: 'meno' })]
    const r = riassuntoFeedback({ sedute, comeStai: [cs('2026-11-26', 4), cs('2026-11-25', 2), cs('2026-11-01', 1)], oggi })
    expect(r.carichi).toEqual({ meno: 2, piu: 1 })
    expect(r.comeStaiMedia).toBe(3)
  })
})

describe('allarmi', () => {
  const con = (sedute, comeStai = []) => allarmi({ riassunto: riassuntoFeedback({ sedute, comeStai, oggi }), sedute, comeStai, oggi })

  it('come_stai_basso: media ≤ 2 per due giorni di fila, recenti', () => {
    expect(con([], [cs('2026-11-26', 2), cs('2026-11-25', 1)])).toEqual(['come_stai_basso'])
    expect(con([], [cs('2026-11-26', 2), cs('2026-11-24', 1)])).toEqual([])
    expect(con([], [cs('2026-11-20', 1), cs('2026-11-19', 1)])).toEqual([])
  })

  it('due_saltate: le ultime due passate non completate', () => {
    expect(con([seduta('2026-11-22', 'completed'), seduta('2026-11-24', 'pending'), seduta('2026-11-26', 'pending')])).toEqual(['due_saltate'])
    expect(con([seduta('2026-11-24', 'pending'), seduta('2026-11-26', 'completed')])).toEqual([])
  })

  it('rpe_alto: RPE ≥ 9 dove l’atteso è ≤ 7, sull’ultima completata', () => {
    expect(con([seduta('2026-11-26', 'completed', '[RPE: 9/10]', { blocks: blocchi7 })])).toEqual(['rpe_alto'])
    expect(con([seduta('2026-11-26', 'completed', '[RPE: 8/10]', { blocks: blocchi7 })])).toEqual([])
  })

  it('dolore: parola di dolore nell’ultima nota, senza distinguere maiuscole', () => {
    expect(PAROLE_DOLORE).toEqual(['dolore', 'male', 'fitta', 'infortun', 'strappo', 'tendin', 'gonfio'])
    expect(con([seduta('2026-11-26', 'completed', '[RPE: 6/10]\nUna FITTA al polpaccio')])).toEqual(['dolore'])
    expect(con([seduta('2026-11-26', 'completed', '[RPE: 6/10]\ntutto bene')])).toEqual([])
  })
})

describe('revisione finale: falsi allarmi', () => {
  it('«Come stai» con una risposta saltata: la media ignora il vuoto, non lo conta 0', () => {
    const r = riassuntoFeedback({ sedute: [], comeStai: [{ data: '2026-11-26', sonno: null, energia: 2, dolori: 2, stress: 2 }], oggi })
    expect(r.comeStaiMedia).toBe(2)
  })

  it('ha dormito benissimo e saltato il resto per due giorni: nessun come_stai_basso', () => {
    const riga = (data) => ({ data, sonno: 5, energia: null, dolori: null, stress: null })
    expect(allarmi({ sedute: [], comeStai: [riga('2026-11-26'), riga('2026-11-27')], oggi })).not.toContain('come_stai_basso')
  })

  it('«normale», «animale», «nessun dolore»: nessun allarme dolore', () => {
    for (const nota of ['[RPE: 6/10]\nSessione normale, tutto ok', 'forte come un animale', 'nessun dolore oggi', 'senza fitte, tutto bene']) {
      expect(allarmi({ sedute: [seduta('2026-11-26', 'completed', nota)], oggi })).not.toContain('dolore')
    }
  })

  it('«mi fa male il ginocchio» e «dolore alla spalla» restano allarmi', () => {
    for (const nota of ['mi fa male il ginocchio', 'Dolore alla spalla', 'credo di avere una tendinite']) {
      expect(allarmi({ sedute: [seduta('2026-11-26', 'completed', nota)], oggi })).toContain('dolore')
    }
  })
})
