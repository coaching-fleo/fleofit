import { describe, it, expect } from 'vitest'
import {
  aderenzaTeam, rpeTeam, comeStaTeam, gareInArrivo, oggiConComeSta, segnaliProgramma,
  pianoGiorni, prossimiGiorni, SOGLIA_DURO,
} from '../cruscottoCoach'
import { giorniSettimana } from '../calendarioTeam'
import { impronta, testoPulito, VERSIONE } from '../../../supabase/functions/estrai-note/regole.ts'

// Perché questi test esistono
// ────────────────────────────
// Il cruscotto della Home coach dice al coach COSA CAMBIARE: alleggerire un
// allenamento, rivedere un programma. Un segnale falso costa una telefonata
// inutile o un allenamento tolto a chi stava bene; uno mancato costa un
// atleta che arriva a pezzi a un Hyrox da 9. Ogni regola qui sotto è una
// soglia che decide fra i due.

const OGGI = new Date(2026, 9, 14) // mer 14 ottobre 2026
const g = (scarto) => {
  const d = new Date(OGGI)
  d.setDate(d.getDate() + scarto)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const LUCA = { id: 'luca', name: 'Luca', surname: 'Bianchi', notes: '' }
const SARA = { id: 'sara', name: 'Sara', surname: 'Rossi', notes: '' }
const FERMA = { id: 'ferma', name: 'Anna', surname: 'Verdi', notes: `[PAUSA: ${g(-3)}]` }
const ATLETI = [LUCA, SARA, FERMA]

let n = 0
const hyrox = (intensity = '6') => ({ category: 'Hyrox', intensity, blocks: [{ type: 'AMRAP', params: { duration: '20:00' }, exercises: [] }] })
const ass = (atleta, scarto, { stato = 'completed', rpe = null, intensita = '6', sections, note = '' } = {}) => ({
  id: `aw-${++n}`,
  athlete_id: atleta.id,
  completed_date: g(scarto),
  status: stato,
  notes: [rpe != null ? `[RPE: ${rpe}/10]` : null, note || null].filter(Boolean).join('\n'),
  athletes: atleta,
  workouts: { id: `w-${n}`, title: `Allenamento ${n}`, sections: sections || hyrox(intensita) },
})
const gara = (atleta, scarto, titolo = 'HYROX Milano') => ({
  id: `aw-${++n}`, athlete_id: atleta.id, completed_date: g(scarto), status: 'pending', notes: '',
  athletes: atleta, workouts: { id: `gara-${titolo}`, title: titolo, sections: { category: 'Event', isEvent: true, isAutonomous: true } },
})
const risposta = (atleta, valori, scarto = 0) => ({ athlete_id: atleta.id, giorno: g(scarto), sonno: 4, energia: 4, dolori: 4, stress: 4, ...valori })

describe("l'aderenza del team", () => {
  it('lascia fuori OGGI: la mattina nessuno ha ancora fatto niente', () => {
    const r = aderenzaTeam(ATLETI, [
      ass(LUCA, -1), ass(SARA, -2, { stato: 'pending' }),
      ass(LUCA, 0, { stato: 'pending' }), ass(SARA, 0, { stato: 'pending' }),
    ], { oggi: OGGI })
    expect(r).toMatchObject({ fatti: 1, assegnati: 2, percentuale: 50 })
  })

  it('non conta le gare, né chi è in pausa', () => {
    const r = aderenzaTeam(ATLETI, [ass(LUCA, -1), gara(LUCA, -2), ass(FERMA, -1, { stato: 'pending' })], { oggi: OGGI })
    expect(r).toMatchObject({ fatti: 1, assegnati: 1, percentuale: 100 })
  })

  it('il confronto è in punti, e senza la settimana prima non c\'è', () => {
    const solo = aderenzaTeam(ATLETI, [ass(LUCA, -1)], { oggi: OGGI })
    expect(solo.delta).toBeNull()
    const due = aderenzaTeam(ATLETI, [ass(LUCA, -1), ass(LUCA, -9), ass(SARA, -10, { stato: 'pending' })], { oggi: OGGI })
    expect(due.delta).toBe(50)
  })

  it('senza assegnazioni non dice 0%', () => {
    expect(aderenzaTeam(ATLETI, [], { oggi: OGGI }).percentuale).toBeNull()
  })
})

describe("l'RPE del team", () => {
  it('mette accanto all\'RPE dichiarato l\'intensità programmata', () => {
    const r = rpeTeam(ATLETI, [ass(LUCA, 0, { rpe: 8, intensita: '6' }), ass(SARA, -2, { rpe: 6, intensita: '6' })], { oggi: OGGI })
    expect(r).toMatchObject({ medio: 7, prevista: 6, quanti: 2 })
  })

  it('non inventa un 5 per chi non l\'ha dichiarato, e con un dato solo non fa una media', () => {
    const r = rpeTeam(ATLETI, [ass(LUCA, 0, { rpe: 8 }), ass(SARA, -1)], { oggi: OGGI })
    expect(r.medio).toBeNull()
  })
})

describe('come sta il team', () => {
  it('fa la media di chi ha risposto oggi e conta le risposte basse', () => {
    const r = comeStaTeam(ATLETI, [], [risposta(LUCA, { sonno: 1 }), risposta(SARA, {}), risposta(SARA, { sonno: 1 }, -1)], { oggi: OGGI })
    expect(r.risposte).toBe(2)
    expect(r.giornateStorte).toBe(1)
    expect(r.tacche).toHaveLength(2)
  })

  it('«senza risposta» conta solo chi si allena oggi, non chi è a riposo', () => {
    const r = comeStaTeam(ATLETI, [ass(LUCA, 0, { stato: 'pending' })], [], { oggi: OGGI })
    expect(r.senzaRisposta).toBe(1)
    expect(r.medio).toBeNull()
    expect(r.fascia).toBeNull()
  })

  it('chi è in pausa non entra nella media', () => {
    const r = comeStaTeam(ATLETI, [], [risposta(FERMA, { sonno: 1, energia: 1, dolori: 1, stress: 1 })], { oggi: OGGI })
    expect(r.risposte).toBe(0)
  })
})

describe('le gare in arrivo', () => {
  it('la stessa gara di più atleti è UNA gara con più nomi, in ordine di data', () => {
    const r = gareInArrivo(ATLETI, [gara(LUCA, 24), gara(SARA, 24), gara(SARA, 46, 'Maratona'), gara(LUCA, -3)], { oggi: OGGI })
    expect(r.map(x => x.nome)).toEqual(['HYROX Milano', 'Maratona'])
    expect(r[0].atleti.map(a => a.nome)).toEqual(['Luca', 'Sara'])
    expect(r[0].giorni).toBe(24)
  })

  it('una gara di chi è in pausa non c\'è', () => {
    expect(gareInArrivo(ATLETI, [gara(FERMA, 10)], { oggi: OGGI })).toEqual([])
  })
})

describe('oggi, con lo stato in cui arriva ciascuno', () => {
  const riga = (atleta, extra) => ({ id: atleta.id, nome: atleta.name, stato: 'da fare', intensita: 9, ...extra })

  it('suona per un allenamento duro con una risposta storta', () => {
    const [r] = oggiConComeSta([riga(LUCA)], [risposta(LUCA, { sonno: 1, dolori: 2 })], { oggi: OGGI })
    expect(r.allarme).toBe(true)
    expect(r.motivi).toEqual(['Sonno: pessimo', 'Dolori muscolari: parecchi'])
  })

  it('con un allenamento leggero è solo un avviso', () => {
    const [r] = oggiConComeSta([riga(LUCA, { intensita: SOGLIA_DURO - 1 })], [risposta(LUCA, { sonno: 1 })], { oggi: OGGI })
    expect(r).toMatchObject({ allarme: false, avviso: true })
  })

  it('a cose fatte non suona più, e la risposta di ieri non conta', () => {
    const [fatto] = oggiConComeSta([riga(LUCA, { stato: 'completato' })], [risposta(LUCA, { sonno: 1 })], { oggi: OGGI })
    expect(fatto.allarme).toBe(false)
    const [ieri] = oggiConComeSta([riga(LUCA)], [risposta(LUCA, { sonno: 1 }, -1)], { oggi: OGGI })
    expect(ieri).toMatchObject({ allarme: false, comeSta: null })
  })

  it('chi suona va in cima', () => {
    const r = oggiConComeSta([riga(SARA), riga(LUCA)], [risposta(LUCA, { sonno: 1 })], { oggi: OGGI })
    expect(r.map(x => x.id)).toEqual(['luca', 'sara'])
  })
})

describe('i segnali sul programma', () => {
  it('più faticosi del previsto solo se lo sono in media su almeno tre sedute', () => {
    const due = [ass(SARA, -1, { rpe: 9, intensita: '6' }), ass(SARA, -3, { rpe: 9, intensita: '6' })]
    expect(segnaliProgramma(ATLETI, due, [], { oggi: OGGI })).toEqual([])
    const tre = [...due, ass(SARA, -5, { rpe: 8, intensita: '6' })]
    const [s] = segnaliProgramma(ATLETI, tre, [], { oggi: OGGI })
    expect(s).toMatchObject({ tipo: 'piu-duro', atletaId: 'sara' })
    expect(s.frase).toBe('Sara Rossi: allenamenti più faticosi del previsto')
    expect(s.prova).toBe('Fatica segnata più alta di quella prevista nelle ultime 3 sedute')
  })

  it('una seduta durissima fra tante normali non è un segnale', () => {
    const r = segnaliProgramma(ATLETI, [
      ass(SARA, -1, { rpe: 10, intensita: '6' }), ass(SARA, -3, { rpe: 6, intensita: '6' }),
      ass(SARA, -5, { rpe: 6, intensita: '6' }), ass(SARA, -7, { rpe: 6, intensita: '6' }),
    ], [], { oggi: OGGI })
    expect(r).toEqual([])
  })

  it('il carico sale quando la settimana supera la media delle quattro prima', () => {
    const prima = [-8, -15, -22, -29].map(s => ass(LUCA, s, { rpe: 6, intensita: '6' }))
    const settimana = [-1, -2, -3].map(s => ass(LUCA, s, { rpe: 6, intensita: '6' }))
    const [s] = segnaliProgramma(ATLETI, [...prima, ...settimana], [], { oggi: OGGI })
    expect(s).toMatchObject({ tipo: 'carico', atletaId: 'luca' })
    expect(s.frase).toContain('200%')
  })

  it('senza almeno due settimane di storico il carico non si confronta', () => {
    const r = segnaliProgramma(ATLETI, [ass(LUCA, -8, { rpe: 6 }), ...[-1, -2, -3].map(s => ass(LUCA, s, { rpe: 6 }))], [], { oggi: OGGI })
    expect(r.filter(s => s.tipo === 'carico')).toEqual([])
  })

  it('dalle note: un esercizio saltato due volte, con la citazione', () => {
    const a = ass(LUCA, -2, { note: 'wall ball saltate' })
    const b = ass(LUCA, -9, { note: 'niente wall ball oggi' })
    const est = (w, citazione) => ({
      athlete_id: LUCA.id, athlete_workout_id: w.id, data: w.completed_date, versione: VERSIONE,
      impronta: impronta(testoPulito(w.notes)),
      estrazione: { sensazioni: { modifiche: [{ tipo: 'saltato', esercizio: 'Wall Balls', citazione }] } },
    })
    const [s] = segnaliProgramma(ATLETI, [a, b], [est(a, 'wall ball saltate'), est(b, 'niente wall ball')], { oggi: OGGI })
    expect(s).toMatchObject({ tipo: 'note', frase: 'Luca Bianchi ha saltato Wall Balls 2 volte in 4 settimane', prova: '«wall ball saltate»' })
  })

  it('un estratto di una nota poi corretta non parla più', () => {
    const a = ass(LUCA, -2, { note: 'wall ball saltate' })
    const b = ass(LUCA, -9, { note: 'niente wall ball oggi' })
    const vecchio = (w) => ({
      athlete_id: LUCA.id, athlete_workout_id: w.id, data: w.completed_date, versione: VERSIONE,
      impronta: impronta('un altro testo'),
      estrazione: { sensazioni: { modifiche: [{ tipo: 'saltato', esercizio: 'Wall Balls', citazione: 'x' }] } },
    })
    expect(segnaliProgramma(ATLETI, [a, b], [vecchio(a), vecchio(b)], { oggi: OGGI })).toEqual([])
  })

  it('chi è in pausa non genera segnali', () => {
    const r = segnaliProgramma(ATLETI, [-1, -3, -5].map(s => ass(FERMA, s, { rpe: 10, intensita: '5' })), [], { oggi: OGGI })
    expect(r).toEqual([])
  })
})

describe('la griglia dei giorni', () => {
  it('distingue passato, oggi e futuro, e segna saltato solo ciò che è passato', () => {
    const r = pianoGiorni(ATLETI, [ass(LUCA, -1, { stato: 'pending' }), ass(LUCA, 1, { stato: 'pending' })], giorniSettimana(OGGI), { oggi: OGGI })
    expect(r.giorni).toHaveLength(7)
    expect(r.giorni[2]).toMatchObject({ etichetta: 'oggi', oggi: true })
    const luca = r.righe.find(x => x.id === 'luca')
    expect(luca.celle[1]).toMatchObject({ quando: 'passato' })
    expect(luca.celle[1].chips[0].saltato).toBe(true)
    expect(luca.celle[3].chips[0].saltato).toBe(false)
    expect(luca.celle[4]).toMatchObject({ quando: 'futuro', chips: [] })
  })

  it('chi è in pausa non è nella griglia', () => {
    const r = pianoGiorni(ATLETI, [], prossimiGiorni(OGGI), { oggi: OGGI })
    expect(r.righe.map(x => x.id).sort()).toEqual(['luca', 'sara'])
    expect(r.giorni[0].etichetta).toBe('oggi')
  })
})
