import { describe, it, expect } from 'vitest'
import { buildTimerSequence, pausePrima } from '../timerSequence'
import {
  giriTV, giroInCorso, vociLocandina, doveSiamo, tappeCarosello, tappaCorrente, nomeFase, statoCarosello,
} from '../schermoTV'

const ex = (name, extra = {}) => ({ id: name, name, reps: '10', ...extra })
const BLOCCHI = [
  { id: 'w', type: 'WarmUp', params: { duration: '5:00' } },
  { id: 'ci', type: 'Cash In', params: { rounds: '1' }, exercises: [ex('SkiErg', { meters: '500m', reps: '-' })] },
  { id: 'oo', type: 'ON/OFF', params: { on: '0:10', off: '0:05', rounds: '2' }, exercises: [ex('Burpees'), ex('Wall Balls'), ex('Lunges')] },
  { id: 'co', type: 'Cash Out', params: { rounds: '2' }, exercises: [ex('Row', { meters: '500m', reps: '-' })] },
]
const workout = { title: 'Prova', sections: { category: 'Hyrox', blocks: BLOCCHI } }
const PERSONE = [
  { id: 1, nome: 'A', colore: '#38bdf8', partenza: 1 },
  { id: 2, nome: 'B', colore: '#f472b6', partenza: 2 },
]

describe('pausePrima', () => {
  it('mette la pausa dopo il Cash In e prima del Cash Out', () => {
    expect([...pausePrima(BLOCCHI)]).toEqual([2, 3])
  })
  it('niente pausa davanti a un Rest, né prima di un Cash Out che segue un Rest', () => {
    const b = [{ type: 'Cash In' }, { type: 'Rest' }, { type: 'Cash Out' }]
    expect([...pausePrima(b)]).toEqual([])
  })
  it('Cash In seguito da Cash Out: una pausa sola', () => {
    expect([...pausePrima([{ type: 'Cash In' }, { type: 'Cash Out' }])]).toEqual([1])
  })
})

describe('le pause nella sequenza del timer', () => {
  it('sono cronometri che finiscono con Avanti, e portano il blocco che viene dopo', () => {
    const seq = buildTimerSequence(workout)
    const pause = seq.filter(p => p.pausa)
    expect(pause.map(p => p.id)).toEqual(['pausa-2', 'pausa-3'])
    expect(pause.every(p => p.type === 'stopwatch' && p.duration === 0 && p.theme === 'rest')).toBe(true)
    expect(pause[0].task).toBe("Pronti per l'ON/OFF")
    expect(pause[1].task).toBe('Pronti per il Cash Out')
    // L'ultimo OFF prima della pausa non si fa: niente due riposi di fila.
    const iPausa = seq.findIndex(p => p.id === 'pausa-3')
    expect(seq[iPausa - 1].id).toBe('blk-2-2-2-on')
  })
  it('con `pause: false` la sequenza è quella di prima (le app vecchie)', () => {
    const seq = buildTimerSequence(workout, { pause: false })
    expect(seq.some(p => p.pausa)).toBe(false)
    expect(seq.some(p => p.id === 'blk-2-2-2-off')).toBe(true)
  })
})

describe('giri', () => {
  it('la linguetta: ON/OFF e Cash a più giri sì, EMOM no', () => {
    expect(giriTV(BLOCCHI[2])).toBe(2)
    expect(giriTV(BLOCCHI[3])).toBe(2)
    expect(giriTV(BLOCCHI[1])).toBe(null)
    expect(giriTV({ type: 'EMOM', params: { rounds: '12' } })).toBe(null)
  })
  it('il giro in corso si legge dall’id solo dove c’è', () => {
    expect(giroInCorso(BLOCCHI[2], 'blk-2-2-1-on')).toBe(2)
    expect(giroInCorso({ type: 'EMOM' }, 'blk-2-5')).toBe(null)
    expect(giroInCorso(BLOCCHI[3], 'blk-3')).toBe(null)
  })
})

describe('vociLocandina', () => {
  it('i blocchi Hyrox, con la pausa dove il timer la mette', () => {
    const voci = vociLocandina({ categoria: 'Hyrox', blocks: BLOCCHI })
    expect(voci.map(v => v.titolo)).toEqual(['WarmUp', 'Cash In', 'ON/OFF', 'Cash Out'])
    expect(voci.map(v => v.pausaPrima)).toEqual([false, false, true, true])
    expect(voci[2].righe.map(r => r.numero)).toEqual(['1', '2', '3'])
    expect(voci[2].hint).toBe('0:10 lavoro · 0:05 riposo')
  })
  it('la corsa: le ripetute con i giri e le parti come righe', () => {
    const voci = vociLocandina({ categoria: 'Running', sections: { steps: [
      { id: 1, type: 'warmup', duration: '10 min', pace: 'Z2' },
      { id: 2, type: 'repeat', rounds: '6', runDuration: '800m', runPace: '4:00 /km', recDuration: '1 min', recPace: 'Camminata' },
    ] } })
    expect(voci[0].righe[0]).toMatchObject({ nome: '10 min', specifiche: '@Z2' })
    expect(voci[1].giri).toBe(6)
    expect(voci[1].righe.map(r => r.nome)).toEqual(['Corsa 800m', 'Recupero 1 min'])
  })
  it('Custom ed Evento non hanno voci: il contenuto sono le note', () => {
    expect(vociLocandina({ categoria: 'Custom' })).toEqual([])
  })
})

describe('il carosello', () => {
  const seq = buildTimerSequence(workout)
  const stato = (id, persone = null) => statoCarosello({ blocks: BLOCCHI, sequenza: seq, step: seq.find(p => p.id === id), persone })

  it('tappe: i blocchi, le pause davanti, la fine', () => {
    expect(tappeCarosello(BLOCCHI, seq).map(t => `${t.tipo}${t.k ?? ''}`))
      .toEqual(['blocco0', 'blocco1', 'pausa2', 'blocco2', 'pausa3', 'blocco3', 'fine'])
    // Un telefono vecchio, senza pause: nessuna carta di pausa.
    expect(tappeCarosello(BLOCCHI, buildTimerSequence(workout, { pause: false })).some(t => t.tipo === 'pausa')).toBe(false)
  })
  it('dove siamo, dall’id dello step', () => {
    expect(doveSiamo('prep')).toEqual({ tipo: 'prep' })
    expect(doveSiamo('pausa-3')).toEqual({ tipo: 'pausa', k: 3 })
    expect(doveSiamo('blk-2-1-0-off')).toEqual({ tipo: 'blocco', k: 2 })
    const tappe = tappeCarosello(BLOCCHI, seq)
    expect(tappaCorrente(tappe, doveSiamo('pausa-2'))).toBe(2)
    expect(tappaCorrente(tappe, doveSiamo('done'))).toBe(tappe.length - 1)
  })
  it('nel riposo di un ON/OFF il prossimo esercizio è «poi», e la carta è in riposo', () => {
    const s = stato('blk-2-1-0-off')
    const carta = s.carte[s.corrente]
    expect(carta).toMatchObject({ ora: true, riposo: true, poi: 1, adesso: null, giro: 1 })
  })
  it('al lavoro la riga accesa è «adesso»', () => {
    const s = stato('blk-2-2-1-on')
    expect(s.carte[s.corrente]).toMatchObject({ riposo: false, adesso: 1, poi: null, giro: 2 })
  })
  it('nella preparazione la prima riga della prima carta è «poi»', () => {
    const w = { sections: { category: 'Hyrox', blocks: BLOCCHI.slice(2) } }
    const sq = buildTimerSequence(w)
    const s = statoCarosello({ blocks: BLOCCHI.slice(2), sequenza: sq, step: sq[0] })
    expect(s.carte[0]).toMatchObject({ ora: true, prep: true, poi: 0 })
  })
  it('con più persone: nella preparazione e nella pausa dicono già dove partirà ognuno', () => {
    const w = { sections: { category: 'Hyrox', blocks: BLOCCHI.slice(2) } }
    const sq = buildTimerSequence(w)
    const prep = statoCarosello({ blocks: BLOCCHI.slice(2), sequenza: sq, step: sq[0], persone: PERSONE })
    expect(prep.carte[0].inArrivo).toBe(true)
    expect(prep.carte[0].chi.map(r => r.map(p => p.nome))).toEqual([['A'], ['B'], []])
    expect(prep.carte[0].poi).toBe(null)

    const pausa = stato('pausa-2', PERSONE)
    expect(pausa.carte[pausa.corrente]).toMatchObject({ ora: true, inArrivo: true })
    expect(pausa.carte[pausa.corrente].chi.map(r => r.map(p => p.nome))).toEqual([['A'], ['B'], []])
  })
  it('con più persone, al lavoro ognuno sta pieno sul suo esercizio e il timer dice «al tuo colore»', () => {
    const s = stato('blk-2-1-1-on', PERSONE)
    expect(s.inGruppo).toBe(true)
    expect(s.carte[s.corrente].inArrivo).toBe(false)
    expect(s.carte[s.corrente].chi.map(r => r.map(p => p.nome))).toEqual([[], ['A'], ['B']])
  })
})

describe('nomeFase', () => {
  it('rende leggibili i titoli del timer', () => {
    expect(nomeFase({ title: 'WORK (ON)' })).toBe('Lavoro')
    expect(nomeFase({ title: 'REST (OFF)' })).toBe('Riposo')
    expect(nomeFase({ title: 'CASH IN' })).toBe('Cash In')
    expect(nomeFase({ title: 'EMOM' })).toBe('EMOM')
    expect(nomeFase({ title: 'Preparazione' })).toBe('Preparazione')
  })
})
