import { describe, it, expect } from 'vitest'
import {
  andamentoAtleta, fraseAndamento, normalizza, scarto,
  sforzoNellaFinestra, minutiNellaFinestra, GIORNI_ADERENZA, SOGLIA_STABILE,
} from '../andamento'

// Perché questi test esistono
// ────────────────────────────
// Sono i numeri dell'eroe della scheda atleta: aderenza, carico, volume,
// sforzo. Prima erano quattro grafici in fondo alla terza tab, e nessuno li
// guardava; ora sono la prima cosa in pagina, e su di essi il coach decide se
// caricare o scaricare la settimana dopo.
//
// I due modi in cui possono fare danno senza dare errore, ed è quello che
// questi test prendono:
//  1. un RPE **inventato** che entra nella media come se fosse una misura
//     (`parseNotesAndRpe` torna 5 quando il marcatore manca);
//  2. una **finestra** diversa da quella dichiarata nell'intestazione — «30
//     giorni» sopra un numero che ne conta 90 non è sbagliato, è peggio.

const OGGI = new Date('2026-08-26T12:00:00Z')       // mercoledì, settimana ISO 35
const giorno = (scarto) => new Date(OGGI.getTime() + scarto * 86400000).toISOString().split('T')[0]

/** Un AMRAP dura esattamente i minuti dichiarati: la durata resta prevedibile. */
const amrap = (minuti) => ({ category: 'Hyrox', blocks: [{ type: 'AMRAP', params: { duration: `${minuti} min` } }] })

const fatto = (data, rpe, minuti = 30) => ({
  completed_date: data, status: 'completed',
  notes: rpe == null ? null : `[RPE: ${rpe}/10]\nnota`,
  workouts: { sections: amrap(minuti) },
})
const assegnato = (data, minuti = 30) => ({
  completed_date: data, status: 'pending', notes: null, workouts: { sections: amrap(minuti) },
})

describe('scarto', () => {
  it('è la variazione percentuale arrotondata', () => {
    expect(scarto(310, 245)).toBe(27)
    expect(scarto(200, 250)).toBe(-20)
  })

  it('è null quando il precedente è zero, non Infinity', () => {
    // `(5-0)/0` è la strada più breve per stampare «+Infinity%» in pagina, e
    // una card che dice Infinity si legge come un guasto dell'app.
    expect(scarto(5, 0)).toBe(null)
    expect(scarto(0, 0)).toBe(null)
  })
})

describe('normalizza', () => {
  it('porta il massimo a 100 e gli altri in proporzione', () => {
    expect(normalizza([25, 50, 0, 100])).toEqual([25, 50, 0, 100])
    expect(normalizza([10, 20])).toEqual([50, 100])
  })

  it('con tutti zero torna zero, non NaN', () => {
    // È il primo giorno di un atleta nuovo: dividere per zero qui riempirebbe
    // lo sparkline di NaN, e uno sparkline con NaN non disegna niente.
    expect(normalizza([0, 0, 0, 0])).toEqual([0, 0, 0, 0])
    expect(normalizza([])).toEqual([])
  })
})

describe('lo sforzo nella finestra', () => {
  it('IGNORA gli allenamenti senza RPE dichiarato', () => {
    // 🔴 Il caso per cui questa funzione non usa `parseNotesAndRpe`: quello
    // torna 5 quando il marcatore manca — giusto per il cursore della modale,
    // un numero inventato per chiunque lo mostri come un dato. Un atleta che
    // non compila mai l'RPE leggerebbe «5,0» come la propria media.
    const s = sforzoNellaFinestra([fatto(giorno(-1), 9), fatto(giorno(-2), null)], GIORNI_ADERENZA, OGGI)
    expect(s.quanti).toBe(1)
    expect(s.medio).toBe(null)          // uno solo non è ancora una media
  })

  it('fa la media a un decimale', () => {
    const s = sforzoNellaFinestra([fatto(giorno(-1), 8), fatto(giorno(-2), 7)], GIORNI_ADERENZA, OGGI)
    expect(s.medio).toBe(7.5)
    expect(s.quanti).toBe(2)
  })

  it('conta solo dentro la finestra dichiarata', () => {
    // «30 giorni» nell'intestazione sopra un numero che ne conta 90 non è
    // sbagliato preso da solo: è peggio, perché non si può accorgersene.
    const s = sforzoNellaFinestra([fatto(giorno(-1), 9), fatto(giorno(-40), 3)], GIORNI_ADERENZA, OGGI)
    expect(s.quanti).toBe(1)
  })

  it('non conta gli assegnati non completati', () => {
    expect(sforzoNellaFinestra([assegnato(giorno(-1))], GIORNI_ADERENZA, OGGI).quanti).toBe(0)
  })

  it('distribuisce sulle quattro fasce e conta quelli da 7 in su', () => {
    const s = sforzoNellaFinestra(
      [fatto(giorno(-1), 3), fatto(giorno(-2), 6), fatto(giorno(-3), 8), fatto(giorno(-4), 10)],
      GIORNI_ADERENZA, OGGI)
    expect(s.distribuzione).toMatchObject({ light: 1, moderate: 1, hard: 1, extreme: 1, total: 4 })
    expect(s.duri).toBe(2)
  })
})

describe('i minuti nella finestra', () => {
  it('somma solo i completati, e solo dentro la finestra', () => {
    const righe = [fatto(giorno(-1), 7, 40), assegnato(giorno(-2), 60), fatto(giorno(-40), 7, 90)]
    expect(minutiNellaFinestra(righe, GIORNI_ADERENZA, OGGI)).toBe(40)
  })
})

describe('la frase sotto i due numeri', () => {
  const frase = (percentuale, corrente, precedente, assegnati = 10) => fraseAndamento({
    aderenza: { percentuale, assegnati },
    carico: { corrente, precedente, delta: scarto(corrente, precedente) },
  })

  it('dice che non c\'è niente da leggere quando non c\'è niente di assegnato', () => {
    expect(frase(0, 0, 0, 0).testo).toMatch(/Nessun allenamento assegnato/)
    expect(frase(0, 0, 0, 0).dettaglio).toBe(null)
  })

  it('chiama «stabile» uno scarto sotto soglia, e non lo chiama salita', () => {
    // Il carico è minuti × RPE, e i minuti sono a loro volta una stima: sotto
    // SOGLIA_STABILE si farebbe decidere il coach su rumore.
    const sotto = frase(90, 100 + SOGLIA_STABILE - 1, 100)
    expect(sotto.testo).toMatch(/Carico stabile/)
    expect(frase(90, 100 + SOGLIA_STABILE, 100).testo).toMatch(/Carico in salita/)
    expect(frase(90, 100 - SOGLIA_STABILE, 100).testo).toMatch(/Carico in calo/)
  })

  it('non inventa un confronto quando la settimana prima è vuota', () => {
    const f = frase(80, 300, 0)
    expect(f.testo).toMatch(/Prima settimana con carico registrato/)
    expect(f.dettaglio).toBe(null)         // «300 pt contro 0» non dice niente
  })

  it('porta il numero grezzo accanto alla frase', () => {
    // Senza, «in salita» non si può verificare — e una frase che non si può
    // verificare si smette di leggere.
    expect(frase(90, 310, 245).dettaglio).toBe('310 pt contro 245.')
  })

  it('cambia il giudizio sull\'aderenza al cambiare della percentuale', () => {
    expect(frase(90, 100, 100).testo).toMatch(/programma seguito/)
    expect(frase(70, 100, 100).testo).toMatch(/aderenza nella norma/)
    expect(frase(40, 100, 100).testo).toMatch(/aderenza in calo/)
    expect(frase(10, 100, 100).testo).toMatch(/due allenamenti su tre saltati/)
  })
})

describe('andamentoAtleta', () => {
  const righe = [
    // Questa settimana (lun 24 → dom 30): 40 min a RPE 8 = 320 pt
    fatto(giorno(-2), 8, 40),
    // La settimana prima: 50 min a RPE 5 = 250 pt
    fatto(giorno(-9), 5, 50),
    // Assegnato e saltato, dentro i 30 giorni: pesa sull'aderenza, non sul carico
    assegnato(giorno(-5)),
  ]

  it('l\'aderenza è il completamento a 30 giorni', () => {
    const { aderenza } = andamentoAtleta(righe, OGGI)
    expect(aderenza).toEqual({ fatti: 2, assegnati: 3, percentuale: 67 })
  })

  it('il carico confronta la settimana corrente con quella prima', () => {
    const { carico } = andamentoAtleta(righe, OGGI)
    expect(carico.corrente).toBe(320)
    expect(carico.precedente).toBe(250)
    expect(carico.delta).toBe(28)
  })

  it('il volume è in MINUTI, e così il suo scarto', () => {
    // In minuti e non in percentuale: «−10 min» si confronta con la propria
    // settimana, «−20%» va prima ritradotto in minuti per farci qualcosa.
    const { volume } = andamentoAtleta(righe, OGGI)
    expect(volume.minuti).toBe(40)
    expect(volume.delta).toBe(-10)
    expect(volume.barre).toHaveLength(4)
  })

  it('le quattro settimane portano l\'etichetta corta', () => {
    const { settimane } = andamentoAtleta(righe, OGGI)
    expect(settimane).toHaveLength(4)
    expect(settimane.at(-1).breve).toBe('S35')
  })

  it('regge una lista vuota senza inventare niente', () => {
    // È la scheda di un atleta appena inserito, ed è lo stato in cui la pagina
    // si apre più spesso di quanto sembri.
    const a = andamentoAtleta([], OGGI)
    expect(a.aderenza).toEqual({ fatti: 0, assegnati: 0, percentuale: 0 })
    expect(a.carico.delta).toBe(null)
    expect(a.sforzo.medio).toBe(null)
    expect(a.volume.barre).toEqual([0, 0, 0, 0])
    expect(a.frase.testo).toMatch(/Nessun allenamento assegnato/)
  })
})
