import { describe, it, expect } from 'vitest'
import {
  durataEsercizio, durataBlocco, rpeAtteso, riepilogoWorkout,
  minutiStimati, mmss, decimale, SECONDI_ESERCIZIO_IGNOTO,
  MINUTI_GIRO_FOR_TIME, MINUTI_GIRO_CASH,
} from '../stimaWorkout'

// Perché questi test esistono
// ────────────────────────────
// Il riepilogo in cima allo step 2 è l'unica cosa che il builder afferma da sé:
// «questo allenamento dura 52 minuti». Un numero plausibile e sbagliato è il
// caso peggiore — il coach lo legge come un dato, non come una stima — ed è
// esattamente il difetto che i test sulla Home atleta hanno scoperto due volte
// (CLAUDE.md §9-octies). Qui si fissa cosa il numero significa.

describe('la durata di un singolo esercizio', () => {
  it('l esercizio Rest tiene la durata in `meters`, non in `exTime`', () => {
    // ⚠️ È così che ExercisePicker lo salva: REST_TIME_OPTIONS finisce dentro
    // `meters`. Chi lo legge come una distanza ottiene 0:30 → 7 secondi e mezzo
    // di corsa invece di trenta secondi di riposo.
    expect(durataEsercizio({ name: 'Rest', meters: '0:30' })).toBe(30)
    expect(durataEsercizio({ name: 'Rest', meters: '2:00' })).toBe(120)
  })

  it('un blocco Interval usa exTime', () => {
    expect(durataEsercizio({ name: 'Wall Balls', exTime: '1:30', reps: '20' })).toBe(90)
  })

  it('i metri diventano secondi, le ripetizioni no', () => {
    expect(durataEsercizio({ name: 'Rowing', meters: '500m' })).toBe(125)
    expect(durataEsercizio({ name: 'Wall Balls', reps: '20' })).toBe(60)
  })

  it('«Max» e «-» non sono una misura, e non valgono zero', () => {
    // Zero vorrebbe dire «questo esercizio non occupa tempo», che è falso e
    // farebbe scendere la stima proprio sui blocchi più duri.
    expect(durataEsercizio({ name: 'Burpees', reps: 'Max' })).toBe(SECONDI_ESERCIZIO_IGNOTO)
    expect(durataEsercizio({ name: 'Burpees', reps: '-', meters: '-' })).toBe(SECONDI_ESERCIZIO_IGNOTO)
  })
})

describe('la durata di un blocco', () => {
  const casi = [
    ['WarmUp con durata', { type: 'WarmUp', params: { duration: '8:00' } }, 480],
    ['Rest con durata', { type: 'Rest', params: { duration: '2:30' } }, 150],
    ['AMRAP', { type: 'AMRAP', params: { duration: '15:00' } }, 900],
    ['EMOM: intervallo per round', { type: 'EMOM', params: { interval: '1:00', rounds: '24' } }, 1440],
    ['ON/OFF: lavoro più recupero, per round', { type: 'ON/OFF', params: { on: '0:40', off: '0:20', rounds: '8' } }, 480],
  ]
  it.each(casi)('%s', (_, block, atteso) => {
    expect(durataBlocco(block)).toBe(atteso)
  })

  // I default contano: un blocco appena aggiunto e mai aperto non ha params, e
  // deve pesare quanto la riga di riepilogo sotto di esso dichiara.
  const default_ = [
    ['WarmUp', { type: 'WarmUp' }, 180],
    ['AMRAP', { type: 'AMRAP' }, 600],
    ['EMOM', { type: 'EMOM' }, 600],
    ['ON/OFF', { type: 'ON/OFF' }, 1200],
  ]
  it.each(default_)('%s senza params ricade sul proprio default', (_, block, atteso) => {
    expect(durataBlocco(block)).toBe(atteso)
  })

  // 🔴 Riscritto il 09/09/2026 con la chiusura di BACKLOG #40. Prima diceva
  // «moltiplica gli ESERCIZI per i round»: ora un «For Time» è un forfait per
  // giro, perché sommare gli esercizi misura il tempo in cui l'atleta si sta
  // muovendo e non quello che passa nel box (stimaWorkout.js, MINUTI_GIRO_*).
  // ⚠️ Le due asserzioni servono entrambe: la cifra, e il fatto che il
  // contenuto del blocco NON la cambi — che è tutta la differenza fra le due
  // formule, e l'unica cosa che una mutazione «rimetti la somma» fa cadere.
  it('For Time è un forfait per giro, qualunque cosa contenga', () => {
    const tre = { type: 'For Time', params: { rounds: '3' }, exercises: [{ reps: '10' }, { reps: '20' }] }
    expect(durataBlocco(tre)).toBe(MINUTI_GIRO_FOR_TIME * 60 * 3)

    const stessiGiriPiuLavoro = { ...tre, exercises: [...tre.exercises, { meters: '2000m' }] }
    expect(durataBlocco(stessiGiriPiuLavoro)).toBe(durataBlocco(tre))
  })

  it('Cash In conta il rest FRA i round, quindi round − 1 volte', () => {
    // Con tre round i riposi sono due. Contarne tre gonfia ogni Cash In del
    // progetto, ed è la stessa regola della riga di riepilogo del blocco.
    const b = { type: 'Cash In', params: { rounds: '3', rest: '1:00' }, exercises: [{ reps: '10' }] }
    expect(durataBlocco(b)).toBe(MINUTI_GIRO_CASH * 60 * 3 + 60 * 2)
  })

  it('con un round solo il rest non esiste, anche se è scritto', () => {
    const b = { type: 'Cash In', params: { rounds: '1', rest: '5:00' }, exercises: [{ reps: '10' }] }
    expect(durataBlocco(b)).toBe(MINUTI_GIRO_CASH * 60)
  })

  // 🔴 Questo test ha preso una svista vera il 09/09/2026: introducendo il
  // forfait per giro, un Cash Out vuoto da due giri dichiarava 10 minuti. Il
  // blocco ancora vuoto non è «lungo zero», è **non stimabile**, e la scheda
  // deve poterci scrivere «—» invece di «0:00» (§9-undecies punto 2).
  it('un blocco senza esercizi non inventa una durata, nemmeno col forfait', () => {
    expect(durataBlocco({ type: 'Cash Out', params: { rounds: '2' }, exercises: [] })).toBe(0)
    expect(durataBlocco({ type: 'For Time', params: { rounds: '5' }, exercises: [] })).toBe(0)
  })
})

describe('RPE atteso', () => {
  it('torna null, non 5, quando nessuno dichiara un intensità', () => {
    // ⚠️ La lezione di rpeDichiarato() in src/lib/rpe.js: un ripiego travestito
    // da misura è peggio di un trattino, perché il coach lo legge come un dato.
    expect(rpeAtteso([{ type: 'AMRAP', params: { duration: '10:00' }, exercises: [{ reps: '10' }] }])).toBeNull()
    expect(rpeAtteso([])).toBeNull()
  })

  it('su un allenamento a intensità uniforme torna esattamente quel valore', () => {
    // È la garanzia che la media di potenza non riscrive i workout già corretti:
    // dove non c'è variazione, non c'è niente da correggere. Se l'esponente e la
    // radice smettessero di corrispondersi, questo numero esploderebbe.
    const blocchi = [
      { type: 'Cash In', params: {}, exercises: [{ name: 'Row', meters: '1000m', intensity: '8' }] },
      { type: 'AMRAP', params: { duration: '20:00' }, exercises: [{ reps: '10', intensity: '8' }] },
    ]
    expect(rpeAtteso(blocchi)).toBe(8)
  })

  it('un Cash In leggero davanti a un blocco duro non spegne la seduta', () => {
    // È la ragione per cui questa funzione non fa una media aritmetica. Quindici
    // minuti a 3 davanti a dieci minuti a 10: la media direbbe 5,8, cioè un
    // allenamento medio — e in quel workout non esiste un solo minuto a 5,8.
    const blocchi = [
      { type: 'AMRAP', params: { duration: '15:00' }, exercises: [{ reps: '10', intensity: '3' }] },
      { type: 'ON/OFF', params: { on: '1:00', off: '1:00', rounds: '5' }, exercises: [{ reps: '10', intensity: '10' }] },
    ]
    expect(rpeAtteso(blocchi)).toBe(7.5)
    // Il contratto, più della cifra: sempre sopra la media aritmetica…
    expect(rpeAtteso(blocchi)).toBeGreaterThan(5.8)
  })

  it('…e mai sopra l intensità più alta dichiarata', () => {
    // L'altra metà del contratto, e il motivo per cui non si usa il massimo:
    // trenta secondi a 10 in fondo a un quarto d'ora tranquillo non fanno una
    // seduta massimale. Alza il numero da 3,2 a 3,9, non a 10.
    const blocchi = [
      { type: 'AMRAP', params: { duration: '15:00' }, exercises: [{ reps: '10', intensity: '3' }] },
      { type: 'AMRAP', params: { duration: '0:30' }, exercises: [{ reps: '10', intensity: '10' }] },
    ]
    expect(rpeAtteso(blocchi)).toBe(3.9)
    expect(rpeAtteso(blocchi)).toBeLessThan(10)
  })

  it('è pesato sulla durata del blocco, non sul numero di esercizi', () => {
    // Venti minuti a 9 e due minuti a 3: la media semplice direbbe 6, che è
    // falsa — l'atleta passa dieci volte più tempo a nove.
    const blocchi = [
      { type: 'AMRAP', params: { duration: '20:00' }, exercises: [{ intensity: '9' }] },
      { type: 'Rest', params: { duration: '2:00' }, exercises: [{ intensity: '3' }] },
    ]
    expect(rpeAtteso(blocchi)).toBeCloseTo(8.7, 1)
  })

  it('dentro il blocco pesa gli esercizi per quanto durano', () => {
    // Mille metri di ski sono quattro minuti, dieci burpees mezzo: con il peso
    // piatto il blocco leggerebbe 7,5, cioè il valore di un lavoro che lì dentro
    // nessuno fa. È la stessa regola del livello sopra, applicata un piano sotto.
    const blocchi = [{
      type: 'For Time',
      params: { rounds: '1' },
      exercises: [
        { name: 'Ski', meters: '1000m', intensity: '9' },
        { name: 'Burpees', reps: '10', intensity: '5' },
      ],
    }]
    expect(rpeAtteso(blocchi)).toBe(8.7)
  })

  it('se nessun esercizio dichiarato ha una durata leggibile il peso è piatto', () => {
    // Un Rest tiene la durata in `meters`: senza, non dura niente. Meglio
    // dividere in parti uguali che perdere il blocco con una divisione per zero.
    const blocchi = [{
      type: 'AMRAP',
      params: { duration: '10:00' },
      exercises: [{ name: 'Rest', intensity: '9' }, { name: 'Rest', intensity: '5' }],
    }]
    expect(rpeAtteso(blocchi)).toBe(7.5)
  })

  it('un blocco stimato a zero pesa comunque uno, invece di sparire', () => {
    // Un riscaldamento a durata zero è una durata che il coach non ha ancora
    // scritto, non un blocco che non esiste: se pesasse zero, l'unica intensità
    // dichiarata dell'allenamento non arriverebbe mai al numero in cima.
    const blocchi = [{ type: 'WarmUp', params: { duration: '0:00' }, exercises: [{ reps: '10', intensity: '7' }] }]
    expect(rpeAtteso(blocchi)).toBe(7)
  })

  it('ignora le intensità fuori scala invece di lasciarle pesare', () => {
    const blocchi = [{ type: 'AMRAP', params: { duration: '10:00' }, exercises: [{ intensity: '8' }, { intensity: '99' }, { intensity: 'boh' }] }]
    expect(rpeAtteso(blocchi)).toBe(8)
  })
})

describe('il riepilogo dello step 2', () => {
  const blocchi = [
    { id: 1, type: 'WarmUp', params: { duration: '8:00' } },
    { id: 2, type: 'EMOM', params: { interval: '1:00', rounds: '24' }, exercises: [{ intensity: '8' }] },
    { id: 3, type: 'Cash Out', params: { rounds: '1' }, exercises: [{ reps: '20' }, { intensity: '6', reps: '20' }] },
  ]

  it('somma le durate e conta i blocchi', () => {
    const r = riepilogoWorkout(blocchi)
    expect(r.blocchi).toBe(3)
    expect(r.secondi).toBe(480 + 1440 + MINUTI_GIRO_CASH * 60)
  })

  it('marca come «lavoro» solo i blocchi centrali: è la barra a dover distinguere', () => {
    const r = riepilogoWorkout(blocchi)
    expect(r.segmenti.map(s => s.lavoro)).toEqual([false, true, false])
    expect(r.segmenti.map(s => s.tipo)).toEqual(['WarmUp', 'EMOM', 'Cash Out'])
  })

  it('un builder vuoto non mostra numeri inventati', () => {
    expect(riepilogoWorkout([])).toEqual({ secondi: 0, blocchi: 0, rpe: null, segmenti: [] })
  })
})

describe('le tre formattazioni', () => {
  it('i minuti sono arrotondati, perché è una stima', () => {
    expect(minutiStimati(3120)).toBe(52)
    expect(minutiStimati(0)).toBe(0)
  })

  it('mmss riempie i secondi a due cifre', () => {
    expect(mmss(480)).toBe('8:00')
    expect(mmss(150)).toBe('2:30')
    expect(mmss(5)).toBe('0:05')
  })

  it('i decimali si scrivono con la virgola', () => {
    expect(decimale(8.2)).toBe('8,2')
  })
})
