import { describe, it, expect } from 'vitest'
import { numeroBlocchi, rpeAtteso, mediaRpeCategoria, serieGiorni, barreUltimiGiorni } from '../statistiche'

// Perché questi test esistono
// ────────────────────────────
// Sono i quattro numeri che la nuova Home atleta mette in primo piano: i tre
// metadati dell'eroe, la serie di giorni e lo sparkline. Nessuno di loro può
// dare errore — sbagliano in silenzio, e l'atleta legge un dato falso credendolo
// vero. È la stessa ragione per cui esistono i test su calcolaStatistiche.
//
// Il caso che conta davvero è la serie: le due regole che la rendono un dato
// onesto invece di un premio regalato (il rest programmato che non spezza,
// l'assegnato saltato che spezza) sono due righe che si tolgono per sbaglio
// "semplificando", e senza test nessuno se ne accorgerebbe.

const OGGI = new Date('2026-08-26T12:00:00Z')       // mercoledì
const giorno = (scarto) => new Date(OGGI.getTime() + scarto * 86400000).toISOString().split('T')[0]

const AMRAP20 = { blocks: [{ type: 'AMRAP', params: { duration: '20 min' } }] }

const fatto = (scarto, sections = AMRAP20, rpe = null) => ({
  completed_date: giorno(scarto), status: 'completed',
  notes: rpe == null ? null : `[RPE: ${rpe}/10]\nnota`,
  workouts: { sections },
})
const daFare = (scarto, sections = AMRAP20) => ({ ...fatto(scarto, sections), status: 'pending' })

describe('numeroBlocchi', () => {
  it('conta i blocchi del formato attuale', () => {
    expect(numeroBlocchi({ blocks: [{ type: 'WarmUp' }, { type: 'AMRAP' }] })).toBe(2)
  })

  it('conta anche i blocchi ricostruiti dal formato legacy', () => {
    // CLAUDE.md §5: i workout vecchi hanno warmup/cashIn/main/cashOut e non
    // `blocks`. Contarli come zero direbbe "allenamento vuoto" su una scheda
    // che invece è piena.
    expect(numeroBlocchi({ warmup: { duration: '10 min' }, main: { type: 'EMOM', params: {} } })).toBe(2)
  })

  it('per la corsa conta le fasi', () => {
    expect(numeroBlocchi({ category: 'Running', steps: [{ type: 'run' }, { type: 'repeat' }, { type: 'cooldown' }] })).toBe(3)
  })

  it('non esplode su sections mancanti', () => {
    expect(numeroBlocchi(undefined)).toBe(0)
    expect(numeroBlocchi({})).toBe(0)
  })
})

describe('rpeAtteso', () => {
  it('preferisce l\'intensità dichiarata dal coach a qualunque stima', () => {
    // È un dato vero (sections.intensity), non una deduzione: se c'è, vince.
    // Qui la stima dai blocchi darebbe 8, l'intensità dichiarata dice 4.
    expect(rpeAtteso({ intensity: '4', ...AMRAP20 })).toBe(4)
  })

  it('ignora un\'intensità fuori scala invece di mostrarla', () => {
    expect(rpeAtteso({ intensity: '42', ...AMRAP20 })).toBe(8)
    expect(rpeAtteso({ intensity: '', ...AMRAP20 })).toBe(8)
  })

  it('senza intensità dichiarata resta nella scala 1-10', () => {
    const v = rpeAtteso({ blocks: [{ type: 'WarmUp' }, { type: 'AMRAP' }] })
    expect(v).toBeGreaterThanOrEqual(1)
    expect(v).toBeLessThanOrEqual(10)
  })

  it('non lascia che riscaldamento e rest addolciscano un allenamento duro', () => {
    // Un For Time con due minuti di rest in fondo non è un allenamento facile.
    const soloDuro = rpeAtteso({ blocks: [{ type: 'For Time' }] })
    const conRecuperi = rpeAtteso({ blocks: [{ type: 'WarmUp' }, { type: 'For Time' }, { type: 'Rest' }] })
    expect(conRecuperi).toBe(soloDuro)
  })

  it('per la corsa media le intensità delle fasi, e sulle ripetute usa quella del lavoro', () => {
    expect(rpeAtteso({ category: 'Running', steps: [{ type: 'run', intensity: '6' }] })).toBe(6)
    expect(rpeAtteso({ category: 'Running', steps: [{ type: 'repeat', runIntensity: '9', recIntensity: '2' }] })).toBe(9)
  })

  it('è null quando non c\'è niente su cui basarsi', () => {
    // La voce sparisce dall\'eroe invece di mostrare un numero inventato.
    expect(rpeAtteso({})).toBe(null)
    expect(rpeAtteso({ category: 'Running', steps: [{ type: 'run' }] })).toBe(null)
  })
})

describe('mediaRpeCategoria', () => {
  it('media solo i completati della categoria richiesta', () => {
    const storico = [
      fatto(-1, AMRAP20, 8), fatto(-2, AMRAP20, 6), fatto(-3, AMRAP20, 7),
      fatto(-4, { category: 'Running', steps: [] }, 2),   // altra categoria
      daFare(-5),                                          // non completato
    ]
    expect(mediaRpeCategoria(storico, 'Hyrox')).toBe(7)
  })

  it('sotto tre precedenti non risponde: una "media" di due giorni non è una media', () => {
    expect(mediaRpeCategoria([fatto(-1, AMRAP20, 9), fatto(-2, AMRAP20, 9)], 'Hyrox')).toBe(null)
  })

  it('riconduce l\'allenamento autonomo alla corsia Custom', () => {
    const libero = { category: 'Custom', isAutonomous: true }
    const storico = [fatto(-1, libero, 5), fatto(-2, libero, 5), fatto(-3, libero, 5)]
    expect(mediaRpeCategoria(storico, 'Custom')).toBe(5)
    expect(mediaRpeCategoria(storico, 'Hyrox')).toBe(null)
  })

  it('ignora le note senza RPE invece di contarle come zero', () => {
    const storico = [fatto(-1, AMRAP20, 8), fatto(-2, AMRAP20, 8), fatto(-3, AMRAP20, null)]
    expect(mediaRpeCategoria(storico, 'Hyrox')).toBe(null)   // solo due utilizzabili
  })
})

describe('serieGiorni', () => {
  it('conta i giorni consecutivi fino a oggi', () => {
    expect(serieGiorni([fatto(0), fatto(-1), fatto(-2)], OGGI)).toBe(3)
  })

  it('un giorno di rest programmato non la spezza, ma non la allunga', () => {
    // -1 non esiste affatto nei dati: nessun workout era assegnato. La
    // programmazione prevede i giorni di scarico, e una serie che si azzera
    // il lunedì di scarico misura il calendario, non la costanza.
    expect(serieGiorni([fatto(0), fatto(-2), fatto(-3)], OGGI)).toBe(3)
  })

  it('un assegnato non completato la spezza: è il caso che deve saper dire', () => {
    expect(serieGiorni([fatto(0), daFare(-1), fatto(-2)], OGGI)).toBe(1)
  })

  it('oggi assegnato e non ancora fatto non spezza niente: la giornata non è finita', () => {
    // Senza questa eccezione la serie leggerebbe zero ogni mattina fino
    // all'allenamento, e si legge come un guasto dell'app.
    expect(serieGiorni([daFare(0), fatto(-1), fatto(-2)], OGGI)).toBe(2)
  })

  it('è zero senza allenamenti recenti', () => {
    expect(serieGiorni([fatto(-40)], OGGI)).toBe(0)
    expect(serieGiorni([], OGGI)).toBe(0)
  })

  it('due allenamenti nello stesso giorno valgono un giorno solo', () => {
    expect(serieGiorni([fatto(0), fatto(0), fatto(-1)], OGGI)).toBe(2)
  })
})

describe('barreUltimiGiorni', () => {
  it('rende una barra per giorno richiesto, la più recente per ultima', () => {
    const barre = barreUltimiGiorni([fatto(0)], 6, OGGI)
    expect(barre).toHaveLength(6)
    expect(barre[5]).toBe(100)
    expect(barre.slice(0, 5)).toEqual([0, 0, 0, 0, 0])
  })

  it('normalizza sul massimo del periodo: racconta l\'andamento, non i minuti', () => {
    const corto = { blocks: [{ type: 'AMRAP', params: { duration: '10 min' } }] }
    const barre = barreUltimiGiorni([fatto(0, corto), fatto(-1, AMRAP20)], 6, OGGI)
    expect(barre[5]).toBe(50)     // 10 min sul massimo di 20
    expect(barre[4]).toBe(100)
  })

  it('senza dati torna zeri invece di dividere per zero', () => {
    // È il primo giorno di un atleta nuovo: sbagliarlo riempiva la Home di NaN.
    expect(barreUltimiGiorni([], 6, OGGI)).toEqual([0, 0, 0, 0, 0, 0])
  })

  it('somma più allenamenti dello stesso giorno e ignora i non completati', () => {
    const barre = barreUltimiGiorni([fatto(0), fatto(0), daFare(-1)], 2, OGGI)
    expect(barre).toEqual([0, 100])
  })
})
