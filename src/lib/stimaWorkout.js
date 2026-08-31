// Quanto dura, quanto pesa e quanti blocchi ha un workout Hyrox in costruzione.
//
// Perché esiste: il builder era cieco. Si aggiungevano blocchi senza sapere se
// il riscaldamento stava mangiando metà seduta, e il coach se ne accorgeva solo
// leggendo la scheda finita. Il riepilogo in cima allo step 2 risponde a quelle
// tre domande, e la risposta va calcolata in un punto solo.
//
// ⚠️ È una STIMA, e l'interfaccia deve dirlo. Il timer guidato
// (`buildTimerSequence`) sa esattamente quanto dura un EMOM, ma per «For Time»,
// «Interval», «Cash In» e «Cash Out» non esiste una durata: sono cronometri
// liberi, il tempo lo fa l'atleta. Qui quei blocchi vengono stimati dagli
// esercizi, con le tre costanti dichiarate sotto. Nessun altro punto dell'app
// deve dedurne un dato "vero".
//
// `parseDuration` arriva da timerSequence e non viene ricopiata: interpreta le
// durate scritte a mano dal coach ("3:00", "30 sec", "5") ed è già coperta da
// test lì.

import { parseDuration } from './timerSequence'

/** Un'esecuzione tranquilla di una ripetizione a corpo libero o con carico. */
export const SECONDI_PER_REP = 3
/** Cento metri di ergometro, sled o corsa dentro un blocco. */
export const SECONDI_PER_100M = 25
/** Un esercizio senza reps né metri ("Max", "-"): non è zero, ma non è misurabile. */
export const SECONDI_ESERCIZIO_IGNOTO = 60

/** I blocchi che portano il lavoro centrale — quelli che meritano il tratto pieno. */
export const BLOCCHI_DI_LAVORO = new Set(['ON/OFF', 'EMOM', 'AMRAP', 'For Time', 'Interval'])

const interoPositivo = (v, ripiego) => {
  const n = parseInt(v, 10)
  return Number.isFinite(n) && n > 0 ? n : ripiego
}

/** I metri di un valore come "500m". "Max" e "-" non sono una distanza. */
const metriDi = (v) => {
  const m = String(v ?? '').trim().match(/^(\d+(?:[.,]\d+)?)\s*m$/i)
  return m ? parseFloat(m[1].replace(',', '.')) : null
}

/**
 * I secondi stimati di un esercizio, una volta sola.
 *
 * ⚠️ L'esercizio "Rest" tiene la propria durata in `meters`, non in `exTime`:
 * è così che ExercisePicker lo salva (REST_TIME_OPTIONS finisce lì dentro).
 * Chi legge `meters` come una distanza su un Rest ottiene un numero enorme.
 */
export const durataEsercizio = (ex) => {
  if (!ex) return 0
  if (ex.name === 'Rest') return parseDuration(ex.meters)
  if (ex.exTime && ex.exTime !== '-') return parseDuration(ex.exTime)

  const metri = metriDi(ex.meters)
  if (metri !== null) return Math.round((metri / 100) * SECONDI_PER_100M)

  const reps = parseInt(ex.reps, 10)
  if (Number.isFinite(reps) && reps > 0) return reps * SECONDI_PER_REP

  return SECONDI_ESERCIZIO_IGNOTO
}

const sommaEsercizi = (esercizi = []) =>
  esercizi.reduce((totale, ex) => totale + durataEsercizio(ex), 0)

/**
 * I secondi stimati di un blocco.
 *
 * I default coincidono con quelli che BlockPickerModal assegna alla creazione e
 * con quelli del riepilogo testuale in HyroxBlock: un blocco appena aggiunto e
 * mai aperto deve pesare quanto la riga sotto di esso dichiara.
 */
export const durataBlocco = (block) => {
  if (!block) return 0
  const p = block.params || {}
  const esercizi = block.exercises || []

  switch (block.type) {
    case 'WarmUp':
    case 'Rest':
      return parseDuration(p.duration || '3:00')
    case 'AMRAP':
      return parseDuration(p.duration || '10:00')
    case 'EMOM':
      return parseDuration(p.interval || '1:00') * interoPositivo(p.rounds, 10)
    case 'ON/OFF':
      return (parseDuration(p.on || '1:00') + parseDuration(p.off || '1:00')) * interoPositivo(p.rounds, 10)
    case 'For Time':
      return sommaEsercizi(esercizi) * interoPositivo(p.rounds, 3)
    case 'Interval':
      return sommaEsercizi(esercizi) * interoPositivo(p.rounds, 1)
    case 'Cash In':
    case 'Cash Out': {
      const round = interoPositivo(p.rounds, 1)
      // Il rest esiste solo FRA i round, quindi se ne contano round − 1: la
      // stessa regola che governa la riga di riepilogo del blocco chiuso.
      const rest = round > 1 ? parseDuration(p.rest) * (round - 1) : 0
      return sommaEsercizi(esercizi) * round + rest
    }
    default:
      return sommaEsercizi(esercizi)
  }
}

/**
 * Quanto la scala RPE va "decompressa" prima di poterla mediare.
 *
 * ⚠️ Non è una costante di comodo. Una media aritmetica sottostima sempre uno
 * sforzo variabile: un Cash In tranquillo davanti a un AMRAP durissimo produce
 * un numero che nessuno dei due blocchi ha mai visto, e la scheda dichiara un
 * allenamento più leggero di quello che sarà. È lo stesso problema per cui nel
 * ciclismo esiste la Normalized Power invece della potenza media.
 *
 * Il rimedio è mediare le intensità elevate a potenza e poi tornare indietro
 * con la radice: i tratti duri pesano più di quanto durano, che è esattamente
 * come li ricorda chi si allena.
 *
 * Perché 3 e non 4 (l'esponente di Coggan): 4 è calibrato sui **watt**, una
 * grandezza fisica. L'RPE è già una scala percettiva compressa, quindi 4
 * sovracorregge — una seduta con metà lavoro davvero facile finirebbe per
 * leggersi quasi massimale. Con 3 i casi onesti salgono di mezzo punto o poco
 * più, e quelli sbagliati davvero (5,8 su un ON/OFF a 10) salgono di due.
 */
export const ESPONENTE_SFORZO = 3

/**
 * L'RPE che ci si aspetta dal workout: la media di potenza delle intensità
 * dichiarate, pesata sul tempo che l'atleta ci passa dentro.
 *
 *     RPE = ( Σ dᵢ·rᵢ³ / Σ dᵢ ) ^ (1/3)
 *
 * Tre proprietà che valgono la formula, e che vanno mantenute se un giorno la
 * si cambia:
 *  - non è mai sotto la media aritmetica né sopra il massimo dichiarato, e su
 *    un workout a intensità uniforme torna **esattamente** quel valore: i
 *    workout già corretti non cambiano di un decimo;
 *  - non ha bisogno di sapere quali tipi di blocco "contano". Un Cash In fatto
 *    duro — in Hyrox capita — continua a pesare duro, perché a decidere è
 *    l'intensità che il coach ha dichiarato, non l'etichetta del blocco;
 *  - è continua e monotona: nessuna soglia che fa saltare il numero quando si
 *    sposta un round.
 *
 * Il peso è la durata stimata del blocco, distribuita fra i suoi esercizi in
 * proporzione a quanto durano: dentro lo stesso blocco 1000m di ski e 10
 * burpees non valgono uguale.
 *
 * ⚠️ Torna `null`, non 5, quando nessun esercizio dichiara un'intensità. È la
 * lezione di `rpeDichiarato()` in src/lib/rpe.js (CLAUDE.md §9-octies): un
 * ripiego travestito da misura è peggio di un trattino, perché il coach lo
 * legge come un dato.
 */
export const rpeAtteso = (blocks = []) => {
  let peso = 0
  let somma = 0

  for (const b of blocks) {
    // Solo gli esercizi che un'intensità la dichiarano davvero. Gli altri non
    // hanno un valore da mediare, e gli si darebbe un numero inventato.
    const dichiarati = (b?.exercises || [])
      .map(ex => ({ rpe: parseInt(ex?.intensity, 10), secondi: durataEsercizio(ex) }))
      .filter(e => Number.isFinite(e.rpe) && e.rpe >= 1 && e.rpe <= 10)
    if (dichiarati.length === 0) continue

    // Un blocco stimato a zero pesa comunque uno: esiste, e la sua intensità è
    // stata dichiarata. Escluderlo lo renderebbe invisibile alla media.
    const durata = Math.max(durataBlocco(b), 1)
    const lavoro = dichiarati.reduce((t, e) => t + e.secondi, 0)

    for (const e of dichiarati) {
      // Se nessuno degli esercizi dichiarati ha una durata leggibile si divide
      // in parti uguali: meglio un peso piatto che perdere il blocco.
      const quota = lavoro > 0 ? e.secondi / lavoro : 1 / dichiarati.length
      const suo = durata * quota
      somma += Math.pow(e.rpe, ESPONENTE_SFORZO) * suo
      peso += suo
    }
  }

  if (peso === 0) return null
  return Math.round(Math.pow(somma / peso, 1 / ESPONENTE_SFORZO) * 10) / 10
}

/**
 * Il riepilogo completo dello step 2: i tre numeri in cima e i segmenti della
 * barra proporzionale sotto di essi.
 *
 * I segmenti conservano il tipo del blocco perché la barra li colora per tipo
 * (la tabella dei toni sta nel componente, non qui: è aspetto, non aritmetica).
 */
export const riepilogoWorkout = (blocks = []) => {
  const segmenti = blocks.map(b => ({
    id: b.id,
    tipo: b.type,
    secondi: durataBlocco(b),
    lavoro: BLOCCHI_DI_LAVORO.has(b.type),
  }))
  return {
    secondi: segmenti.reduce((t, s) => t + s.secondi, 0),
    blocchi: blocks.length,
    rpe: rpeAtteso(blocks),
    segmenti,
  }
}

/** I minuti da mostrare nel riepilogo: interi, perché è una stima. */
export const minutiStimati = (secondi) => Math.round((secondi || 0) / 60)

/** La durata di un blocco, nel formato con cui il coach scrive i tempi. */
export const mmss = (secondi) => {
  const s = Math.max(0, Math.round(secondi || 0))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Il numero con la virgola, come si scrive in italiano. */
export const decimale = (n) => String(n).replace('.', ',')
