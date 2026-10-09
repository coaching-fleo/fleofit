import { describe, it, expect } from 'vitest'
import {
  FINESTRE, FINESTRA_INIZIALE, estrattiValidi, copertura, nellaFinestra, serieRisultati,
  settimaneSensazioni, modificheFrequenti, righeStato, formattaValore,
} from '../dalleNote'
import { impronta, testoPulito, VERSIONE } from '../../../supabase/functions/estrai-note/regole.ts'

// Perché questi test esistono
// ────────────────────────────
// I grafici «Dalle note» sono la prima schermata dove il coach legge dati che
// NON ha scritto nessuno: li ha ricavati un'IA. Le regole che li tengono
// onesti sono quelle di tutta l'app (CLAUDE.md §9): nessuno zero inventato,
// nessuna linea tracciata da un punto solo, e niente che l'atleta non dica
// più — un estratto di una nota poi modificata è un dato vecchio.

const OGGI = new Date(2026, 9, 9) // ven 9 ottobre 2026

const aw = (id, data, notes, extra = {}) => ({ id, completed_date: data, status: 'completed', notes, workouts: { id: `w-${id}`, title: 'W' }, ...extra })
const est = (w, estrazione = {}) => ({
  athlete_workout_id: w.id, data: w.completed_date, versione: VERSIONE,
  impronta: impronta(testoPulito(w.notes)),
  estrazione: { stato: [], risultati: [], sensazioni: { difficolta: null, citazione: null, modifiche: [] }, ...estrazione },
})
const tempo = (valore, citazione = 'wb in x') => ({ esercizio: 'Wall Balls', misura: 'tempo', grezzo: 'x', valore, unita: 's', citazione })

describe('le finestre', () => {
  it('30, 90, 365, di partenza 90', () => {
    expect(FINESTRE).toEqual([30, 90, 365])
    expect(FINESTRA_INIZIALE).toBe(90)
  })
})

describe('estrattiValidi e copertura', () => {
  const a = aw('a', '2026-10-01', '[RPE: 7/10]\nwall balls in 6:40')
  const b = aw('b', '2026-10-02', 'nota b')
  const soloRpe = aw('c', '2026-10-03', '[RPE: 7/10]\n[GRADIMENTO: si]')
  const daFare = aw('d', '2026-10-04', 'nota d', { status: 'pending' })

  it('una nota modificata dopo l\'estrazione fa sparire l\'estratto', () => {
    const modificata = { ...b, notes: 'nota b, corretta' }
    expect(estrattiValidi([est(a), est(b)], [a, modificata]).map(e => e.athlete_workout_id)).toEqual(['a'])
  })
  it('una versione vecchia non vale', () => {
    expect(estrattiValidi([{ ...est(a), versione: 0 }], [a])).toEqual([])
  })
  it('le note solo-RPE non contano, quelle sugli allenamenti da fare sì', () => {
    expect(copertura([a, b, soloRpe, daFare], [est(a), est(daFare)])).toEqual({ totali: 3, analizzate: 2, inAttesa: 1 })
  })
})

describe('nellaFinestra', () => {
  it('30 giorni: dentro oggi e 29 giorni fa, fuori 31 giorni fa', () => {
    const dentro = est(aw('x', '2026-09-10', 't'))
    const fuori = est(aw('y', '2026-09-08', 't'))
    const oggi = est(aw('z', '2026-10-09', 't'))
    expect(nellaFinestra([dentro, fuori, oggi], 30, OGGI).map(e => e.athlete_workout_id)).toEqual(['x', 'z'])
  })
})

describe('serieRisultati', () => {
  it('un punto solo: niente scarto, niente verso', () => {
    const [s] = serieRisultati([est(aw('a', '2026-10-01', 't'), { risultati: [tempo(400)] })])
    expect(s).toMatchObject({ esercizio: 'Wall Balls', misura: 'tempo', etichetta: 'Wall Balls · tempo', scarto: null, migliorato: null })
    expect(s.punti).toHaveLength(1)
  })
  it('tempo che scende è un miglioramento, in ordine di data', () => {
    const [s] = serieRisultati([
      est(aw('b', '2026-10-05', 't'), { risultati: [tempo(400)] }),
      est(aw('a', '2026-10-01', 't'), { risultati: [tempo(420)] }),
    ])
    expect(s.punti.map(p => p.valore)).toEqual([420, 400])
    expect(s.punti[1]).toMatchObject({ data: '2026-10-05', awId: 'b' })
    expect(s.scarto).toBe(-20)
    expect(s.migliorato).toBe(true)
  })
  it('kg che scendono non sono un miglioramento', () => {
    const kg = (v) => ({ esercizio: 'Wall Balls', misura: 'kg', grezzo: 'x', valore: v, unita: 'kg', citazione: 'c' })
    const [s] = serieRisultati([est(aw('a', '2026-10-01', 't'), { risultati: [kg(9)] }), est(aw('b', '2026-10-02', 't'), { risultati: [kg(8)] })])
    expect(s.migliorato).toBe(false)
  })
  it('senza esercizio l\'etichetta è la misura', () => {
    const [s] = serieRisultati([est(aw('a', '2026-10-01', 't'), { risultati: [{ ...tempo(400), esercizio: null }] })])
    expect(s.etichetta).toBe('Tempo')
  })
})

describe('settimaneSensazioni', () => {
  it('per settimana da lunedì, solo settimane con una difficoltà', () => {
    const s = (id, data, difficolta) => est(aw(id, data, 't'), { sensazioni: { difficolta, citazione: 'c', modifiche: [] } })
    expect(settimaneSensazioni([
      s('a', '2026-10-06', 'troppo_dura'), s('b', '2026-10-09', 'giusta'), s('c', '2026-09-29', 'troppo_facile'), s('d', '2026-09-30', null),
    ], 90, OGGI)).toEqual([
      { settimana: '2026-09-28', troppo_facile: 1, giusta: 0, troppo_dura: 0 },
      { settimana: '2026-10-05', troppo_facile: 0, giusta: 1, troppo_dura: 1 },
    ])
  })
})

describe('modificheFrequenti', () => {
  it('per esercizio e tipo, le più frequenti prima, senza esercizio escluse', () => {
    const m = (id, data, modifiche) => est(aw(id, data, 't'), { sensazioni: { difficolta: null, citazione: null, modifiche } })
    const r = modificheFrequenti([
      m('a', '2026-10-01', [{ tipo: 'saltato', esercizio: 'Burpees', citazione: 'burpees no' }, { tipo: 'ridotto', esercizio: null, citazione: 'meno' }]),
      m('b', '2026-10-03', [{ tipo: 'saltato', esercizio: 'Burpees', citazione: 'saltati i burpees' }]),
      m('c', '2026-10-04', [{ tipo: 'sostituito', esercizio: 'Row', citazione: 'bike al posto del row' }]),
    ])
    expect(r.map(x => [x.esercizio, x.tipo, x.volte])).toEqual([['Burpees', 'saltato', 2], ['Row', 'sostituito', 1]])
    expect(r[0].citazioni[1]).toEqual({ data: '2026-10-03', testo: 'saltati i burpees', awId: 'b' })
  })
})

describe('righeStato', () => {
  it('nessuna voce → nessuna riga (niente fattori a zero)', () => {
    expect(righeStato([est(aw('a', '2026-10-01', 't'))], [], 90, OGGI)).toEqual([])
  })
  it('solo i fattori citati, nell\'ordine dello standard, con i giorni a RPE ≥ 8', () => {
    const w1 = aw('a', '2026-10-01', '[RPE: 9/10]\nstanco morto')
    const w2 = aw('b', '2026-10-02', '[RPE: 5/10]\nlavoro pesante')
    const w3 = aw('c', '2026-05-01', '[RPE: 10/10]\nfuori finestra')
    const r = righeStato([
      est(w2, { stato: [{ fattore: 'lavoro', segno: -1, citazione: 'lavoro pesante' }] }),
      est(w1, { stato: [{ fattore: 'stanchezza', segno: -1, citazione: 'stanco morto' }] }),
    ], [w1, w2, w3], 90, OGGI)
    expect(r.map(x => x.fattore)).toEqual(['stanchezza', 'lavoro'])
    expect(r[0].giorni).toEqual([{ data: '2026-10-01', segno: -1, citazione: 'stanco morto' }])
    expect(r[0].durissime).toEqual(['2026-10-01'])
  })
})

describe('formattaValore', () => {
  it.each([
    [400, 's', '6:40'], [3750, 's', '1:02:30'], [45, 's', '0:45'], [295, 's/km', '4:55 /km'],
    [1200, 'm', '1,2 km'], [400, 'm', '400 m'], [9.5, 'kg', '9,5 kg'], [15, 'reps', '15'], [5, 'round', '5 round'],
  ])('%s %s → %s', (v, u, atteso) => {
    expect(formattaValore(v, u)).toBe(atteso)
  })
})
