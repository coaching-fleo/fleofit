import { describe, it, expect } from 'vitest'

import { buildTimerSequence, getNormalizedBlocks, parseDuration } from '../timerSequence'

// Perché questi test esistono
// ────────────────────────────
// BACKLOG #19. `buildTimerSequence` è il cuore del timer guidato: linearizza un
// workout in una sequenza di step espandendo round e ripetute. Se sbaglia,
// l'atleta si allena con i tempi sbagliati e non c'è modo di accorgersene
// guardando il codice.
// `getNormalizedBlocks` è la migrazione RUNTIME dei workout in formato legacy:
// CLAUDE.md §5 dice esplicitamente di non rimuoverla, perché quei workout
// esistono ancora nel database — che è condiviso con la web app in produzione.

const hyrox = (blocks) => ({ title: 'T', sections: { category: 'Hyrox', blocks } })

describe('parseDuration — le durate le scrive il coach a mano', () => {
  const casi = [
    ['3:00', 180],
    ['0:45', 45],
    ['1:30:00', 5400],
    ['30 sec', 30],
    ['10 min', 600],   // senza ':' il numero è in MINUTI
    ['5', 300],
    ['2.5', 150],      // mezzo minuto
    ['', 0],
    [null, 0],
    [undefined, 0],
    ['-', 0],
  ]
  it.each(casi)('%s → %i secondi', (dato, atteso) => {
    expect(parseDuration(dato)).toBe(atteso)
  })
})

describe('la sequenza ha sempre una testa e una coda', () => {
  it('comincia con la preparazione da 10 secondi', () => {
    const seq = buildTimerSequence(hyrox([]))
    expect(seq[0]).toMatchObject({ id: 'prep', type: 'prep', duration: 10 })
  })

  it('finisce con il passo di chiusura', () => {
    const seq = buildTimerSequence(hyrox([]))
    expect(seq.at(-1)).toMatchObject({ id: 'done', type: 'done' })
  })

  it('ogni passo annuncia il compito del successivo', () => {
    // nextTask è ciò che la TV e il timer mostrano come "poi:". Se si sfasa,
    // l'atleta legge l'esercizio sbagliato mentre sta ancora facendo l altro.
    const seq = buildTimerSequence(hyrox([
      { id: 1, type: 'WarmUp', params: { duration: '5:00' } },
      { id: 2, type: 'AMRAP', params: { duration: '10:00' }, exercises: [{ name: 'Burpees' }] },
    ]))
    for (let i = 0; i < seq.length - 1; i++) {
      expect(seq[i].nextTask).toBe(seq[i + 1].task)
    }
    expect(seq.at(-1).nextTask).toBeUndefined()
  })
})

describe('espansione dei round', () => {
  it('ON/OFF genera due passi per round, lavoro e riposo', () => {
    const seq = buildTimerSequence(hyrox([
      { id: 1, type: 'ON/OFF', params: { on: '0:40', off: '0:20', rounds: '3' }, exercises: [{ name: 'Wall Balls', reps: '15' }] },
    ]))
    const lavoro = seq.filter(s => s.title === 'WORK (ON)')
    const riposo = seq.filter(s => s.title === 'REST (OFF)')
    expect(lavoro).toHaveLength(3)
    expect(riposo).toHaveLength(3)
    expect(lavoro[0].duration).toBe(40)
    expect(riposo[0].duration).toBe(20)
    expect(lavoro[2].subtitle).toBe('Round 3/3')
  })

  it('EMOM genera un passo per round, della durata dell intervallo', () => {
    const seq = buildTimerSequence(hyrox([
      { id: 1, type: 'EMOM', params: { interval: '1:30', rounds: '4' }, exercises: [{ name: 'Row', meters: '250m' }] },
    ]))
    const passi = seq.filter(s => s.title === 'EMOM')
    expect(passi).toHaveLength(4)
    expect(passi.every(p => p.duration === 90)).toBe(true)
  })

  it('senza round espliciti EMOM e ON/OFF ne fanno 10', () => {
    // È il default del builder: cambiarlo silenziosamente allungherebbe o
    // accorcerebbe l'allenamento di chiunque non abbia compilato il campo.
    expect(buildTimerSequence(hyrox([{ id: 1, type: 'EMOM', params: {} }]))
      .filter(s => s.title === 'EMOM')).toHaveLength(10)
    expect(buildTimerSequence(hyrox([{ id: 1, type: 'ON/OFF', params: {} }]))
      .filter(s => s.title === 'WORK (ON)')).toHaveLength(10)
  })

  it('gli esercizi ruotano round dopo round', () => {
    // Con 2 esercizi e 4 round, il terzo round torna al primo esercizio.
    const seq = buildTimerSequence(hyrox([
      { id: 1, type: 'EMOM', params: { interval: '1:00', rounds: '4' },
        exercises: [{ name: 'Burpees', reps: '10' }, { name: 'Row', meters: '200m' }] },
    ]))
    const compiti = seq.filter(s => s.title === 'EMOM').map(s => s.task)
    expect(compiti[0]).toContain('Burpees')
    expect(compiti[1]).toContain('Row')
    expect(compiti[2]).toContain('Burpees')
    expect(compiti[3]).toContain('Row')
  })
})

describe('blocchi senza durata diventano cronometro', () => {
  it('For Time senza timecap è a cronometro, non a tempo zero', () => {
    // Un blocco "a tempo" con duration 0 partirebbe e finirebbe subito.
    const seq = buildTimerSequence(hyrox([
      { id: 1, type: 'For Time', params: { rounds: '2' }, exercises: [{ name: 'Run' }] },
    ]))
    const passi = seq.filter(s => s.title === 'FOR TIME')
    expect(passi).toHaveLength(2)
    expect(passi.every(p => p.type === 'stopwatch')).toBe(true)
  })

  it('un workout Custom è un solo cronometro libero', () => {
    const seq = buildTimerSequence({ title: 'Libero', sections: { category: 'Custom', isAutonomous: true } })
    expect(seq.filter(s => s.type === 'stopwatch')).toHaveLength(1)
    expect(seq).toHaveLength(3)   // prep + cronometro + done
  })
})

describe('Running', () => {
  it('le ripetute si espandono in corsa e recupero alternati', () => {
    const seq = buildTimerSequence({ title: 'R', sections: { category: 'Running', steps: [
      { id: 1, type: 'repeat', rounds: '3', runDuration: '2:00', recDuration: '1 min' },
    ] } })
    expect(seq.filter(s => s.title === 'Corsa')).toHaveLength(3)
    expect(seq.filter(s => s.title === 'Recupero')).toHaveLength(3)
    expect(seq.filter(s => s.title === 'Corsa')[0].duration).toBe(120)
    expect(seq.filter(s => s.title === 'Recupero')[0].duration).toBe(60)
  })

  // 🔴 BUG REGISTRATO, NON APPROVATO — BACKLOG #29.
  // Le fasi di corsa si possono definire a DISTANZA (il picker ha "📏 Distanza"),
  // ma parseDuration toglie le lettere e interpreta il numero rimasto come
  // minuti. Conseguenza: una sessione di 6×400m produce ripetute da SEI ORE E
  // QUARANTA l'una — il timer non avanza mai. E "5 km" fa il danno opposto,
  // diventa 5 minuti e chiude la fase troppo presto.
  //
  // Questi due test fissano il comportamento ATTUALE, che è sbagliato. Servono
  // a far fallire la suite quando qualcuno lo corregge, così la correzione è
  // una scelta esplicita e non un effetto collaterale.
  it('🔴 una distanza in metri viene letta come minuti (difetto noto)', () => {
    expect(parseDuration('400m')).toBe(24000)   // 6h 40m, dovrebbe essere ~90s
    expect(parseDuration('800m')).toBe(48000)   // 13h 20m
  })

  it('🔴 una distanza in chilometri viene letta come minuti (difetto noto)', () => {
    expect(parseDuration('5 km')).toBe(300)     // 5 minuti per 5 km
    expect(parseDuration('2km')).toBe(120)
  })

  it('i tipi di passo diventano titoli in italiano', () => {
    const seq = buildTimerSequence({ title: 'R', sections: { category: 'Running', steps: [
      { id: 1, type: 'warmup', duration: '10 min' },
      { id: 2, type: 'run', duration: '5:00', pace: '5:00 /km' },
      { id: 3, type: 'cooldown', duration: '5 min' },
    ] } })
    expect(seq.map(s => s.title)).toEqual(
      ['Preparazione', 'Riscaldamento', 'Corsa', 'Defaticamento', 'Completato!'])
    expect(seq[2].task).toBe('Corsa @ 5:00 /km')
  })
})

describe('getNormalizedBlocks — i workout vecchi devono ancora aprirsi', () => {
  // ⚠️ CLAUDE.md §5: esistono workout salvati con sections.warmup/cashIn/main/
  // cashOut invece di blocks. Il database è CONDIVISO con la web app in
  // produzione, quindi quei dati non spariranno. Questa logica non si rimuove.
  it('il formato nuovo passa invariato', () => {
    const blocks = [{ id: 1, type: 'AMRAP' }]
    expect(getNormalizedBlocks({ sections: { blocks } })).toBe(blocks)
  })

  it('il formato legacy diventa blocchi, nell ordine giusto', () => {
    const blocchi = getNormalizedBlocks({ sections: {
      warmup: { duration: '5:00', notes: 'sciolto' },
      cashIn: [{ name: 'Row', meters: '500m' }],
      main: { type: 'AMRAP', params: { duration: '12:00' }, exercises: [{ name: 'Burpees' }] },
      cashOut: [{ name: 'Ski', meters: '250m' }],
    } })
    expect(blocchi.map(b => b.type)).toEqual(['WarmUp', 'Cash In', 'AMRAP', 'Cash Out'])
    expect(blocchi[0].params.duration).toBe('5:00')
    expect(blocchi[1].exercises).toHaveLength(1)
  })

  it('un EMOM legacy con parametro "on" era in realtà un ON/OFF', () => {
    // Conversione storica: prima della separazione dei tipi, un EMOM con `on`
    // significava lavoro/recupero. Perderla trasformerebbe l'allenamento.
    const blocchi = getNormalizedBlocks({ sections: {
      main: { type: 'EMOM', params: { on: '0:40', off: '0:20' } },
    } })
    expect(blocchi[0].type).toBe('ON/OFF')
  })

  it('un main di tipo Running non diventa un blocco', () => {
    const blocchi = getNormalizedBlocks({ sections: { main: { type: 'Running', steps: [] } } })
    expect(blocchi).toEqual([])
  })

  it('le sezioni vuote non producono blocchi fantasma', () => {
    expect(getNormalizedBlocks({ sections: { cashIn: [], cashOut: [] } })).toEqual([])
    expect(getNormalizedBlocks({})).toEqual([])
  })

  it('un workout legacy arriva fino al timer', () => {
    // La prova che le due funzioni si parlano: senza normalizzazione il timer
    // di un workout vecchio conterrebbe solo prep e done.
    const seq = buildTimerSequence({ title: 'Vecchio', sections: {
      warmup: { duration: '5:00' },
      main: { type: 'EMOM', params: { interval: '1:00', rounds: '3' }, exercises: [{ name: 'Row' }] },
    } })
    expect(seq.filter(s => s.title === 'EMOM')).toHaveLength(3)
    expect(seq.length).toBeGreaterThan(2)
  })
})
