import { describe, it, expect } from 'vitest'
import { sottotitoloBlocco, specificheEsercizio } from '../rigaBlocco'

// Perché questi test esistono
// ───────────────────────────
// `getBlockTitle` impacchettava nome, parametri e durata in una stringa sola:
// nessuno poteva verificare un pezzo senza verificarli tutti, e a 393px quella
// riga andava a capo due volte. Separati, i parametri sono verificabili — e
// vale la pena farlo, perché una didascalia sbagliata non dà nessun errore:
// dà una scheda che dice il numero di round di un altro blocco.

const isErgo = (n) => n === 'Rowing'

describe('il sottotitolo di un blocco', () => {
  it('su WarmUp e Rest non dice niente', () => {
    // La loro unica informazione è la durata, che nella scheda sta già a
    // destra del nome: qui la ripeterebbe sulla stessa riga.
    expect(sottotitoloBlocco({ type: 'WarmUp', params: { duration: '8:00' } })).toBe('')
    expect(sottotitoloBlocco({ type: 'Rest', params: { duration: '2:00' } })).toBe('')
  })

  it('conta gli esercizi al singolare e al plurale', () => {
    expect(sottotitoloBlocco({ type: 'For Time', params: { rounds: '3' }, exercises: [{}] }))
      .toBe('1 esercizio · 3 round')
    expect(sottotitoloBlocco({ type: 'For Time', params: { rounds: '3' }, exercises: [{}, {}] }))
      .toBe('2 esercizi · 3 round')
  })

  it('su EMOM dice ogni quanto e per quante volte', () => {
    expect(sottotitoloBlocco({ type: 'EMOM', params: { interval: '1:00', rounds: '24' }, exercises: [{}, {}, {}] }))
      .toBe('3 esercizi · ogni 1:00 × 24')
  })

  it('su ON/OFF dice il lavoro e il recupero, non solo i round', () => {
    expect(sottotitoloBlocco({ type: 'ON/OFF', params: { on: '0:40', off: '0:20', rounds: '12' }, exercises: [{}] }))
      .toBe('1 esercizio · 0:40 on / 0:20 off × 12')
  })

  it('su AMRAP dice la finestra di tempo', () => {
    expect(sottotitoloBlocco({ type: 'AMRAP', params: { duration: '12:00' }, exercises: [{}, {}] }))
      .toBe('2 esercizi · in 12:00')
  })

  it('usa gli stessi ripieghi del builder quando un parametro manca', () => {
    // Un blocco appena creato e mai aperto deve dire quello che vale davvero:
    // sono gli stessi default di BlockPickerModal e di `durataBlocco`. Se qui
    // si scrivesse «10 round» dove il timer ne conta 3, la scheda mentirebbe.
    expect(sottotitoloBlocco({ type: 'EMOM', exercises: [{}] })).toBe('1 esercizio · ogni 1:00 × 10')
    expect(sottotitoloBlocco({ type: 'For Time', exercises: [{}] })).toBe('1 esercizio · 3 round')
    expect(sottotitoloBlocco({ type: 'Interval', exercises: [{}] })).toBe('1 esercizio · 1 round')
  })

  describe('su Cash In e Cash Out', () => {
    it('su un round solo non nomina né i round né il rest', () => {
      // «1 round» è rumore, e il rest esiste solo FRA i round: nominarlo qui
      // farebbe contare all'occhio un recupero che non viene mai eseguito —
      // ed è la stessa regola con cui `durataBlocco` lo conta round − 1 volte.
      expect(sottotitoloBlocco({ type: 'Cash In', params: { rounds: '1', rest: '2:00' }, exercises: [{}, {}] }))
        .toBe('2 esercizi')
    })

    it('da due round in su li nomina entrambi', () => {
      expect(sottotitoloBlocco({ type: 'Cash Out', params: { rounds: '3', rest: '1:30' }, exercises: [{}] }))
        .toBe('1 esercizio · 3 round · 1:30 rest')
    })

    it('e ignora il rest cancellato dal picker', () => {
      // «-» è il modo in cui ExercisePicker azzera un parametro: stamparlo
      // darebbe «3 round · - rest».
      expect(sottotitoloBlocco({ type: 'Cash In', params: { rounds: '3', rest: '-' }, exercises: [{}] }))
        .toBe('1 esercizio · 3 round')
    })
  })

  it('non lancia su un blocco vuoto o assente', () => {
    expect(sottotitoloBlocco(null)).toBe('')
    expect(sottotitoloBlocco({ type: 'Cash In' })).toBe('0 esercizi')
  })
})

describe('le specifiche di un esercizio', () => {
  it('mettono il tempo davanti alla distanza e la distanza davanti alle reps', () => {
    // È l'ordine di priorità che ExList aveva, e che PDF e story Instagram
    // ripetono: cambiarlo qui farebbe divergere la scheda dai suoi export.
    expect(specificheEsercizio({ exTime: '1:30', meters: '500m', reps: '20' })).toBe('1:30')
    expect(specificheEsercizio({ meters: '500m', reps: '20' })).toBe('500m')
    expect(specificheEsercizio({ reps: '20' })).toBe('20 reps')
  })

  it('scrivono il passo solo sugli ergometri', () => {
    expect(specificheEsercizio({ name: 'Rowing', meters: '250m', ergoPace: '1:52 /500m' }, isErgo))
      .toBe('250m · @1:52 /500m')
    // Su un esercizio a corpo libero `ergoPace` non vuol dire niente.
    expect(specificheEsercizio({ name: 'Wall Balls', reps: '20', ergoPace: '1:52 /500m' }, isErgo))
      .toBe('20 reps')
  })

  it('tacciono su «Libero», che è l’assenza di un passo', () => {
    expect(specificheEsercizio({ name: 'Rowing', meters: '250m', ergoPace: 'Libero' }, isErgo)).toBe('250m')
  })

  it('scrivono il carico con l’unità staccata', () => {
    expect(specificheEsercizio({ reps: '20', kg: '9' })).toBe('20 reps · 9 kg')
  })

  it('saltano i valori cancellati invece di stamparli', () => {
    // «-» è un valore vero dentro workouts.sections, non un buco: stamparlo
    // darebbe «- · - kg».
    expect(specificheEsercizio({ exTime: '-', meters: '-', reps: '-', kg: '-' })).toBe('')
  })
})
