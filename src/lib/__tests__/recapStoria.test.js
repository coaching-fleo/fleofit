import { describe, it, expect } from 'vitest'
import { righeAllenamento, celleStoria, recapStoria, MASSIMO_RIGHE } from '../recapStoria'
import { parametriBlocco } from '../rigaBlocco'

// Perché questo test esiste
// ─────────────────────────
// Questa grafica ESCE dall'app: finisce in una storia, sotto gli occhi di
// gente che non ha modo di verificarne un solo numero. È l'ultimo posto in cui
// un ripiego travestito da misura può passare inosservato — e il progetto ne
// ha già trovati tre (l'RPE che vale 5 quando non c'è, la media aritmetica
// dell'RPE atteso, «400m» letto come 400 minuti). I casi qui sotto sono
// scritti per cadere su quelli, non per contare le proprietà.

const blocco = (tipo, params, esercizi) => ({ id: tipo, type: tipo, params, exercises: esercizi })
const ex = (nome, campi) => ({ id: nome, name: nome, ...campi })

const HYROX = {
  title: 'Hyrox Strength #4',
  date: '2026-08-28',
  sections: {
    category: 'Hyrox',
    intensity: '7',
    blocks: [
      blocco('WarmUp', { duration: '8:00' }, []),
      blocco('Cash In', { rounds: '1' }, [ex('Ski Erg', { meters: '500m', intensity: '4' })]),
      blocco('EMOM', { interval: '1:00', rounds: '24' }, [ex('Wall Balls', { reps: '20', kg: '9', intensity: '9' })]),
      blocco('Rest', { duration: '2:00' }, []),
    ],
  },
}

const CORSA = (steps) => ({ title: 'Lungo', date: '2026-08-28', sections: { category: 'Running', steps } })

describe('righeAllenamento — che cosa si è fatto', () => {
  it('elenca i blocchi con dentro i loro esercizi', () => {
    const righe = righeAllenamento(HYROX)
    expect(righe.map(r => r.genere)).toEqual([
      'blocco', 'blocco', 'esercizio', 'blocco', 'esercizio', 'blocco',
    ])
    expect(righe[0]).toMatchObject({ titolo: 'WarmUp', dettaglio: '8:00' })
    expect(righe[2]).toMatchObject({ nome: 'Ski Erg', specifiche: '500m' })
    expect(righe[4]).toMatchObject({ nome: 'Wall Balls' })
    expect(righe[4].specifiche).toContain('20 reps')
    expect(righe[4].specifiche).toContain('9 kg')
  })

  it('il dettaglio del blocco viene da parametriBlocco, non da una formula qui', () => {
    // 🔴 Un EMOM senza `rounds` vale 10 giri per `durataBlocco`, che è la
    // durata scritta nella cella accanto. Un secondo elenco di ripieghi
    // darebbe un'intestazione che contraddice quel numero, senza alcun errore.
    const b = blocco('EMOM', { interval: '1:00' }, [ex('Wall Balls', { reps: '20' })])
    const righe = righeAllenamento({ sections: { category: 'Hyrox', blocks: [b] } })
    expect(righe[0].dettaglio).toBe(parametriBlocco(b))
    expect(righe[0].dettaglio).toContain('10')
  })

  it('non elenca niente su una gara', () => {
    // ⚠️ Array vuoto, non una riga vuota: il chiamante deve poter togliere
    // l'intero blocco invece di disegnare una cornice attorno al nulla.
    expect(righeAllenamento({ sections: { category: 'Event', isEvent: true } })).toEqual([])
  })

  it('su un allenamento libero legge le note del COACH, mai quelle dell’atleta', () => {
    // 🔴 `coach_notes` è il contenuto dell'allenamento; `athlete_workouts.notes`
    // è il riscontro che l'atleta ha lasciato al coach, e può contenere
    // qualunque cosa. Pubblicarlo su una storia — magari esportata dal coach,
    // dalla scheda di qualcun altro — non è una decisione di questa funzione.
    const libero = {
      sections: { category: 'Custom', isAutonomous: true },
      coach_notes: '3 giri di:\n10 trazioni\n20 piegamenti',
      notes: '[RPE: 9/10] mi girava la testa',
    }
    const righe = righeAllenamento(libero)
    expect(righe.map(r => r.testo)).toEqual(['3 giri di:', '10 trazioni', '20 piegamenti'])
    expect(righe.every(r => r.genere === 'testo')).toBe(true)
    expect(JSON.stringify(righe)).not.toContain('girava la testa')
  })

  it('una corsa: le fasi semplici sono righe, le ripetute un gruppo', () => {
    const righe = righeAllenamento(CORSA([
      { id: 'a', type: 'warmup', duration: '12 min', pace: 'Z2' },
      { id: 'b', type: 'repeat', rounds: '12', runDuration: '400m', runPace: '3:40 /km', recDuration: '1 min', recPace: 'Libero' },
      { id: 'c', type: 'cooldown', duration: '8 min' },
    ]))
    expect(righe.map(r => r.genere)).toEqual(['esercizio', 'blocco', 'esercizio', 'esercizio', 'esercizio'])
    expect(righe[0]).toMatchObject({ nome: 'Riscaldamento', specifiche: '12 min · Z2' })
    expect(righe[1]).toMatchObject({ titolo: 'Ripetute', dettaglio: '12×' })
    expect(righe[2]).toMatchObject({ nome: 'Corsa', specifiche: '400m · 3:40 /km' })
    // «Libero» non è un ritmo da scrivere: è l'assenza di un ritmo.
    expect(righe[3]).toMatchObject({ nome: 'Recupero', specifiche: '1 min' })
  })

  it('si ferma a MASSIMO_RIGHE e dichiara quanti esercizi restano fuori', () => {
    // 🔴 L'immagine verrà guardata piccola: poche righe in corpo grande, non
    // tutte le righe in corpo 9. Una lista troncata che lo dice è leggibile.
    const tanti = Array.from({ length: 12 }, (_, i) => ex(`Esercizio ${i}`, { reps: '10' }))
    const righe = righeAllenamento({ sections: { category: 'Hyrox', blocks: [
      blocco('For Time', { rounds: '2' }, tanti),
      blocco('Cash Out', { rounds: '1' }, [ex('Rowing', { meters: '1000m' })]),
    ] } })

    expect(righe.length).toBe(MASSIMO_RIGHE)
    const coda = righe[righe.length - 1]
    expect(coda.genere).toBe('altri')
    // 13 esercizi in tutto: quelli che non ci stanno si dichiarano, non
    // spariscono in silenzio.
    const mostrati = righe.filter(r => r.genere === 'esercizio').length
    expect(mostrati).toBeGreaterThan(0)
    expect(coda.testo).toBe(`+${13 - mostrati} esercizi`)
  })

  it('non chiude mai l’elenco con un’intestazione orfana', () => {
    // Un blocco nominato e poi tagliato promette un contenuto che non c'è: è
    // peggio che non nominarlo affatto.
    //
    // ⚠️ Con blocchi da UN esercizio le righe si alternano b,e,b,e… quindi
    // l'ultima riga che ci starebbe (indice MASSIMO_RIGHE − 2) è
    // un'intestazione — ma solo se MASSIMO_RIGHE è pari. Con blocchi tutti
    // uguali e più grandi il taglio cade su un esercizio e il test passa anche
    // senza la potatura: verificato, la mutazione non cadeva. L'assunzione è
    // scritta qui sotto perché se un giorno decade il test lo dica, invece di
    // tornare verde per il motivo sbagliato.
    expect(MASSIMO_RIGHE % 2).toBe(0)

    const blocchi = Array.from({ length: MASSIMO_RIGHE }, (_, i) =>
      blocco('For Time', { rounds: '1' }, [ex(`Ex ${i}`, { reps: '10' })]))
    const righe = righeAllenamento({ sections: { category: 'Hyrox', blocks: blocchi } })

    const vere = righe.filter(r => r.genere !== 'altri')
    expect(vere[vere.length - 1].genere).toBe('esercizio')
    const mostrati = vere.filter(r => r.genere === 'esercizio').length
    expect(righe[righe.length - 1]).toMatchObject({
      genere: 'altri', testo: `+${MASSIMO_RIGHE - mostrati} esercizi`,
    })
  })

  it('il «+N» conta gli ESERCIZI rimasti fuori, non le righe', () => {
    // Le intestazioni non sono cose che si fanno: sommarle darebbe un numero
    // che non corrisponde a niente di contabile nella scheda.
    const blocchi = Array.from({ length: 8 }, (_, i) =>
      blocco('For Time', { rounds: '1' }, [ex(`Ex ${i}`, { reps: '10' }), ex(`Ex ${i}b`, { reps: '10' })]))
    const righe = righeAllenamento({ sections: { category: 'Hyrox', blocks: blocchi } })
    const mostrati = righe.filter(r => r.genere === 'esercizio').length
    expect(righe[righe.length - 1].testo).toBe(`+${16 - mostrati} esercizi`)
  })
})

describe('celleStoria — i numeri grandi', () => {
  it('la durata di un workout a blocchi si dichiara come STIMA', () => {
    const durata = celleStoria(HYROX, { rpe: 8 }).find(c => c.chiave === 'durata')
    // 🔴 Senza `circa`, su una storia quel numero si legge come un cronometro.
    // «For Time» e «Cash In» non hanno una durata: il tempo lo fa l'atleta.
    expect(durata.circa).toBe(true)
    expect(durata.unita).toBe('min')
    expect(parseInt(durata.valore, 10)).toBeGreaterThan(30)
  })

  it('l\'RPE dichiarato vince, ed è quello dell\'atleta', () => {
    const celle = celleStoria(HYROX, { rpe: 9 })
    const rpe = celle.find(c => c.chiave === 'rpe')
    expect(rpe.valore).toBe('9')
    expect(rpe.etichetta).toBe('RPE')
    // L'intensità del coach (7) non compare: sarebbe un secondo numero sulla
    // stessa scala, e il lettore non avrebbe modo di sapere quale credere.
    expect(celle.some(c => c.chiave === 'intensita')).toBe(false)
  })

  it('senza RPE dichiarato NON scrive 5, e cambia etichetta', () => {
    const celle = celleStoria(HYROX, { rpe: null })
    expect(celle.some(c => c.chiave === 'rpe')).toBe(false)
    const ripiego = celle.find(c => c.chiave === 'intensita')
    // 🔴 Il ripiego di `parseNotesAndRpe` è 5. Stamparlo qui vorrebbe dire
    // pubblicare un numero che nessuno ha mai dichiarato — sotto l'etichetta
    // «RPE», cioè attribuendolo all'atleta.
    expect(ripiego.valore).toBe('7')
    expect(ripiego.etichetta).toBe('Intensità')
    expect(celle.some(c => c.valore === '5')).toBe(false)
  })

  it('senza nessuno dei due, le celle diventano due', () => {
    const nudo = { sections: { category: 'Hyrox', blocks: HYROX.sections.blocks } }
    const celle = celleStoria(nudo, { rpe: null })
    expect(celle.map(c => c.chiave)).toEqual(['durata', 'blocchi'])
  })

  it('la corsa a distanza dichiara i chilometri, non i minuti', () => {
    const celle = celleStoria(CORSA([
      { id: 'a', type: 'run', duration: '12 km' },
      { id: 'b', type: 'cooldown', duration: '1 km' },
    ]), {})
    const distanza = celle.find(c => c.chiave === 'distanza')
    expect(distanza.valore).toBe('13')
    expect(distanza.unita).toBe('km')
    expect(celle.some(c => c.chiave === 'durata')).toBe(false)
  })

  it('la corsa MISTA non dichiara nessun totale', () => {
    const celle = celleStoria(CORSA([
      { id: 'a', type: 'run', duration: '400m' },
      { id: 'b', type: 'recover', duration: '1 min' },
    ]), {})
    // 🔴 400 metri e 1 minuto hanno due totali veri e nessuno dei due è «la
    // lunghezza dell'allenamento». Sommarli darebbe un numero plausibile e
    // inventato — il caso peggiore (§9-sedecies punto 3).
    expect(celle.map(c => c.chiave)).toEqual(['fasi'])
    expect(celle[0].valore).toBe('2')
  })

  it('Custom ed Evento non inventano né durata né blocchi', () => {
    const celle = celleStoria({ sections: { category: 'Custom', isAutonomous: true } }, { rpe: 6 })
    expect(celle.map(c => c.chiave)).toEqual(['rpe'])
  })

  it('non mostra mai più di tre celle', () => {
    expect(celleStoria(HYROX, { rpe: 8 }).length).toBeLessThanOrEqual(3)
  })
})

describe('recapStoria — il modello completo', () => {
  it('la data è quella in cui l\'allenamento è stato FATTO', () => {
    const recap = recapStoria(HYROX, { rpe: 8, fatto: true, data: '2026-08-30' })
    // Il coach che condivide la scheda di un altro ha `workout.date` sul giorno
    // in programma: il recap deve dire il giorno del completamento.
    expect(recap.data).toBe('30 agosto 2026')
    expect(recap.giornoBreve).toContain('30')
    expect(recap.fatto).toBe(true)
  })

  it('ripiega su workout.date quando non gli si passa niente', () => {
    expect(recapStoria(HYROX, {}).data).toBe('28 agosto 2026')
    expect(recapStoria({ sections: {} }, {}).data).toBe('')
  })

  it('un titolo mancante non lascia un buco nella grafica', () => {
    expect(recapStoria({ title: null, sections: {} }, {}).titolo).toBe('Senza titolo')
    expect(recapStoria({ title: '   ', sections: {} }, {}).titolo).toBe('Senza titolo')
  })

  it('porta la corsia della categoria, non una tabella propria', () => {
    expect(recapStoria(HYROX, {}).etichettaCategoria).toBe('Hyrox')
    expect(recapStoria({ sections: { category: 'Custom' } }, {}).etichettaCategoria).toBe('Libero')
    expect(recapStoria({ sections: { steps: [] } }, {}).etichettaCategoria).toBe('Running')
  })
})
