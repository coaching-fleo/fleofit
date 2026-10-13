import { describe, it, expect } from 'vitest'
import { eserciziDi, storicoEsercizio } from '../storicoEsercizio'

// Lo storico di un esercizio (piano desktop fase 2, #2). I casi: i kg scritti
// a mano in modi diversi, due righe dello stesso esercizio nella stessa seduta,
// la corsa che non ha movimenti nominati, e il risultato dichiarato nelle note
// che deve finire sulla seduta giusta.

let n = 0
const seduta = (data, esercizi, { status = 'completed', categoria = 'Hyrox' } = {}) => ({
  id: `aw-${++n}`, athlete_id: 'a1', completed_date: data, status, notes: null,
  workouts: {
    id: `w-${n}`, title: 'Allenamento',
    sections: categoria === 'Running'
      ? { category: 'Running', steps: [{ type: 'run', duration: '30 min' }] }
      : { category: 'Hyrox', blocks: [{ type: 'For Time', params: { rounds: '1' }, exercises: esercizi }] },
  },
})
const ex = (name, extra = {}) => ({ id: Math.random(), name, reps: '15', ...extra })

describe('storicoEsercizio', () => {
  it('legge i kg scritti in modi diversi, e «-» non è un numero', () => {
    const righe = [
      seduta('2026-10-01', [ex('Wall Balls', { kg: '9' })]),
      seduta('2026-10-03', [ex('Wall Balls', { kg: '9kg' })]),
      seduta('2026-10-05', [ex('Wall Balls', { kg: '9 kg' })]),
      seduta('2026-10-07', [ex('Wall Balls', { kg: '-' })]),
    ]
    expect(storicoEsercizio(righe, 'Wall Balls').map(s => s.kg)).toEqual([9, 9, 9, null])
  })

  it('due righe dello stesso esercizio nella stessa seduta: vale il carico più alto', () => {
    const [s] = storicoEsercizio([seduta('2026-10-01', [ex('Sled Push', { kg: '16', meters: '50m' }), ex('Sled Push', { kg: '12' })])], 'Sled Push')
    expect(s).toMatchObject({ data: '2026-10-01', kg: 16, metri: 50 })
  })

  it('solo sedute completate, in ordine di data, e la corsa non c\'è', () => {
    const righe = [
      seduta('2026-10-05', [ex('Burpees')]),
      seduta('2026-10-01', [ex('Burpees')]),
      seduta('2026-10-03', [ex('Burpees')], { status: 'pending' }),
      seduta('2026-10-04', [], { categoria: 'Running' }),
    ]
    expect(storicoEsercizio(righe, 'Burpees').map(s => s.data)).toEqual(['2026-10-01', '2026-10-05'])
  })

  it('il risultato dichiarato nelle note finisce sulla sua seduta', () => {
    const righe = [seduta('2026-10-01', [ex('Wall Balls')]), seduta('2026-10-05', [ex('Wall Balls')])]
    const estratti = [{
      athlete_workout_id: righe[1].id, data: '2026-10-05',
      estrazione: { risultati: [
        { esercizio: 'Wall Balls', misura: 'tempo', valore: 400, unita: 's', citazione: 'wall balls in 6:40' },
        { esercizio: 'Burpees', misura: 'reps', valore: 30, unita: 'reps', citazione: '30 burpees' },
      ] },
    }]
    const storico = storicoEsercizio(righe, 'Wall Balls', estratti)
    expect(storico[0].risultati).toEqual([])
    expect(storico[1].risultati).toEqual([{ misura: 'tempo', valore: 400, unita: 's', citazione: 'wall balls in 6:40' }])
  })
})

describe('eserciziDi', () => {
  it('gli esercizi delle sedute fatte, i più frequenti prima', () => {
    const righe = [
      seduta('2026-10-01', [ex('Burpees'), ex('Wall Balls')]),
      seduta('2026-10-02', [ex('Wall Balls')]),
      seduta('2026-10-03', [ex('Row')], { status: 'pending' }),
    ]
    expect(eserciziDi(righe)).toEqual([{ nome: 'Wall Balls', sedute: 2 }, { nome: 'Burpees', sedute: 1 }])
  })
})
