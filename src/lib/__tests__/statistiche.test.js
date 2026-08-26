import { describe, it, expect } from 'vitest'
import { calcolaStatistiche, durataWorkout, parseTime } from '../statistiche'

// Perché questi test esistono
// ────────────────────────────
// BACKLOG #19. Queste sono le statistiche su cui il coach decide se caricare o
// scaricare la settimana successiva. Se sbagliano non danno errore: cambiano
// solo le decisioni, e nessuno se ne accorge.
//
// Scriverli ha fatto emergere un difetto che c'era da sempre — vedi il primo
// describe.

const OGGI = new Date('2026-08-26T12:00:00Z')       // mercoledì
const giorno = (scarto) => new Date(OGGI.getTime() + scarto * 86400000).toISOString().split('T')[0]

const fatto = (data, rpe, sections) => ({
  completed_date: data, status: 'completed',
  notes: rpe == null ? null : `[RPE: ${rpe}/10]\nnota`,
  workouts: { sections },
})

describe('parseTime — le distanze non sono minuti', () => {
  // 🔴 Difetto corretto il 26/08/2026. Il ripiego che stimava le distanze
  // esisteva già, ma era CODICE MORTO: veniva provato solo se parseTime tornava
  // 0, e per "400m" tornava 400 — la stringa non contiene né "sec" né "min", e
  // parseInt si ferma alla lettera. Una sessione di 6×400m contava come 40 ORE.
  it('i metri diventano minuti stimati, non minuti letterali', () => {
    expect(parseTime('400m')).toBeCloseTo(2.4)      // 400 m a 6 min/km
    expect(parseTime('800m')).toBeCloseTo(4.8)
    expect(parseTime('400 m')).toBeCloseTo(2.4)
  })

  it('i chilometri pure', () => {
    expect(parseTime('5 km')).toBe(30)
    expect(parseTime('2km')).toBe(12)
  })

  it('e i tempi veri restano tempi', () => {
    // ⚠️ "10 min" contiene una `m`, ma è il ramo `min` più sopra a proteggerlo,
    // non la strettezza del controllo sui metri: verificato per mutazione, un
    // `includes('m')` al suo posto darebbe lo stesso risultato OGGI. Il controllo
    // resta stretto perché smetterebbe di essere equivalente se un domani
    // qualcuno riordinasse i rami.
    expect(parseTime('10 min')).toBe(10)
    expect(parseTime('1:30 min')).toBeCloseTo(1.5)
    expect(parseTime('3:00')).toBe(3)
    expect(parseTime('30 sec')).toBeCloseTo(0.5)
    expect(parseTime('5')).toBe(5)
    expect(parseTime('-')).toBe(0)
    expect(parseTime(null)).toBe(0)
  })

  it('6×400m non vale più quaranta ore', () => {
    const minuti = durataWorkout({ category: 'Running', steps: [
      { type: 'repeat', rounds: '6', runDuration: '400m', recDuration: '90 sec' },
    ] })
    expect(minuti).toBeLessThan(30)     // prima erano 2409
    expect(minuti).toBeGreaterThan(20)
  })
})

describe('durataWorkout', () => {
  it('ON/OFF conta lavoro e recupero per ogni round', () => {
    expect(durataWorkout({ category: 'Hyrox', blocks: [
      { type: 'ON/OFF', params: { on: '1:00', off: '0:30', rounds: '10' } },
    ] })).toBe(15)
  })

  it('EMOM conta l intervallo per ogni round', () => {
    expect(durataWorkout({ category: 'Hyrox', blocks: [
      { type: 'EMOM', params: { interval: '1:00', rounds: '12' } },
    ] })).toBe(12)
  })

  it('For Time e Cash In hanno una stima fissa, perché non hanno durata', () => {
    expect(durataWorkout({ category: 'Hyrox', blocks: [{ type: 'For Time', params: { rounds: '2' } }] })).toBe(30)
    expect(durataWorkout({ category: 'Hyrox', blocks: [{ type: 'Cash In', params: { rounds: '3' } }] })).toBe(15)
  })

  it('un workout senza durate vale 45 minuti, non zero', () => {
    // Zero falserebbe le medie verso il basso e nasconderebbe il carico.
    expect(durataWorkout({ category: 'Hyrox', blocks: [] })).toBe(45)
    expect(durataWorkout(undefined)).toBe(45)
  })

  it('legge anche i workout in formato legacy', () => {
    // CLAUDE.md §5: quei workout esistono ancora nel database condiviso.
    expect(durataWorkout({
      warmup: { duration: '10 min' },
      main: { type: 'AMRAP', params: { duration: '20 min' } },
    })).toBe(30)
  })
})

describe('le quattro settimane', () => {
  it('sono quattro, e l ultima è quella corrente', () => {
    const { settimane } = calcolaStatistiche([], OGGI)
    expect(settimane).toHaveLength(4)
    expect(settimane.at(-1).label).toBe('Questa sett.')
  })

  it('il carico è tempo per RPE', () => {
    const { settimane } = calcolaStatistiche(
      [fatto(giorno(0), 8, { category: 'Hyrox', blocks: [{ type: 'AMRAP', params: { duration: '20 min' } }] })],
      OGGI)
    const corrente = settimane.at(-1)
    expect(corrente.time).toBe(20)
    expect(corrente.load).toBe(160)
  })

  it('senza RPE il carico usa 5, non zero', () => {
    // Un allenamento senza RPE non è un allenamento senza fatica: contarlo zero
    // farebbe sparire dal grafico settimane intere.
    const { settimane } = calcolaStatistiche(
      [fatto(giorno(0), null, { category: 'Hyrox', blocks: [{ type: 'AMRAP', params: { duration: '20 min' } }] })],
      OGGI)
    expect(settimane.at(-1).load).toBe(100)
  })

  it('gli allenamenti NON completati non contano nel carico', () => {
    const { settimane } = calcolaStatistiche([{
      completed_date: giorno(0), status: 'pending', notes: null,
      workouts: { sections: { category: 'Hyrox', blocks: [{ type: 'AMRAP', params: { duration: '60 min' } }] } },
    }], OGGI)
    expect(settimane.at(-1).time).toBe(0)
  })

  it('quello di cinque settimane fa cade fuori da tutte e quattro', () => {
    const { settimane } = calcolaStatistiche(
      [fatto(giorno(-35), 8, { category: 'Hyrox', blocks: [{ type: 'AMRAP', params: { duration: '30 min' } }] })],
      OGGI)
    expect(settimane.every(s => s.time === 0)).toBe(true)
  })
})

describe('tasso di completamento a 30 giorni', () => {
  it('conta assegnati e completati nella finestra', () => {
    const s = calcolaStatistiche([
      fatto(giorno(-1), 7, {}), fatto(giorno(-10), 7, {}),
      { completed_date: giorno(-5), status: 'pending', notes: null, workouts: { sections: {} } },
    ], OGGI)
    expect(s.completamento).toEqual({ assigned: 3, done: 2 })
    expect(s.percentualeCompletamento).toBe(67)
  })

  it('ignora quello che sta fuori dalla finestra', () => {
    const s = calcolaStatistiche([fatto(giorno(-40), 7, {}), fatto(giorno(5), 7, {})], OGGI)
    expect(s.completamento.assigned).toBe(0)
  })

  it('senza assegnazioni la percentuale è 0, non NaN', () => {
    expect(calcolaStatistiche([], OGGI).percentualeCompletamento).toBe(0)
  })
})

describe('distribuzione degli RPE', () => {
  it('divide in leggero, moderato, duro ed estremo', () => {
    const { distribuzioneRpe } = calcolaStatistiche([
      fatto(giorno(0), 3, {}), fatto(giorno(0), 4, {}),
      fatto(giorno(0), 6, {}), fatto(giorno(0), 8, {}), fatto(giorno(0), 10, {}),
    ], OGGI)
    expect(distribuzioneRpe).toEqual({ light: 2, moderate: 1, hard: 1, extreme: 1, total: 5 })
  })

  it('i valori sulle SOGLIE cadono dalla parte giusta', () => {
    // ⚠️ Senza il 9 questo test non prova le soglie: 3-4-6-8-10 passano anche
    // spostando `<= 8` a `<= 9`. Trovato per mutazione il 26/08/2026.
    // Le soglie sono 4 / 6 / 8: il 5 è moderato, il 7 duro, il 9 estremo.
    const conta = (v) => calcolaStatistiche([fatto(giorno(0), v, {})], OGGI).distribuzioneRpe
    expect(conta(4)).toMatchObject({ light: 1, moderate: 0 })
    expect(conta(5)).toMatchObject({ light: 0, moderate: 1 })
    expect(conta(6)).toMatchObject({ moderate: 1, hard: 0 })
    expect(conta(7)).toMatchObject({ moderate: 0, hard: 1 })
    expect(conta(8)).toMatchObject({ hard: 1, extreme: 0 })
    expect(conta(9)).toMatchObject({ hard: 0, extreme: 1 })
  })

  it('una nota senza RPE conta come 5, cioè moderato', () => {
    // parseNotesAndRpe torna 5 quando il prefisso non c'è: è il default
    // documentato, e va tenuto perché la web app su main non scrive l'RPE.
    const { distribuzioneRpe } = calcolaStatistiche([fatto(giorno(0), null, {})], OGGI)
    expect(distribuzioneRpe.moderate).toBe(1)
  })
})
