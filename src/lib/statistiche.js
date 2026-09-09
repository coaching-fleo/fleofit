import { startOfWeek, format, getISOWeek } from 'date-fns'
import { parseNotesAndRpe, rpeDichiarato } from './rpe'
import { categoriaDi } from './categorie'
// 🔴 UNO stimatore solo per i blocchi Hyrox (BACKLOG #40, chiuso il 09/09/2026).
// Prima ce n'erano due e dicevano 58 e 24 minuti sullo stesso allenamento.
import { durataBlocco } from './stimaWorkout'

// Statistiche della scheda atleta, estratte da AthleteDetail.jsx il 26/08/2026.
//
// Perché sono qui: erano un blocco di calcolo dentro un useEffect che chiamava
// tre setState — quindi non testabili, e uno dei pattern che ESLint segnala
// (BACKLOG #17). Sono numeri su cui il coach decide la programmazione: se
// sbagliano non danno errore, cambiano solo le decisioni.

/** Durata di un allenamento senza tempo dichiarato. */
const MINUTI_PREDEFINITI = 45
/** Minuti stimati per chilometro, per le fasi di corsa definite a distanza. */
const MINUTI_PER_KM = 6

/**
 * Interpreta una durata scritta a mano, in MINUTI.
 *
 * 🔴 Correzione del 26/08/2026. Le fasi di corsa si possono definire a distanza,
 * e il ripiego che le stimava esisteva già — ma era **codice morto**: veniva
 * provato solo se questa funzione tornava 0, e per "400m" tornava 400, perché
 * la stringa non contiene né "sec" né "min" e parseInt si ferma alla lettera.
 * Risultato: una sessione di 6×400m contava come 40 ORE di allenamento, e il
 * grafico del carico settimanale ne usciva schiacciato dalla barra sbagliata.
 * "5 km" faceva il danno opposto: 5 minuti invece di 30.
 * Ora le distanze si riconoscono PRIMA, così la stima viene davvero usata.
 */
export const parseTime = (val) => {
  if (!val || val === '-') return 0
  const s = String(val).toLowerCase().trim()

  if (s.includes('sec')) return (parseInt(s) || 0) / 60
  if (s.includes('min')) {
    const parts = s.replace('min', '').trim().split(':')
    if (parts.length === 2) return parseInt(parts[0]) + parseInt(parts[1]) / 60
    return parseInt(s) || 0
  }
  // Distanze. Il controllo sui metri è volutamente stretto (`400m`, `400 m`) per
  // non catturare "10 min", che arriva qui solo se il ramo sopra non l'ha preso.
  if (s.includes('km')) return (parseFloat(s) || 0) * MINUTI_PER_KM
  if (/^\d+(\.\d+)?\s*m$/.test(s)) return ((parseFloat(s) || 0) / 1000) * MINUTI_PER_KM

  const parts = s.split(':')
  if (parts.length === 2) return parseInt(parts[0]) + parseInt(parts[1]) / 60
  return parseInt(s) || 0
}

/** Blocchi di un workout, con la migrazione del formato legacy (CLAUDE.md §5). */
const blocchiDi = (s) => {
  if (s.blocks?.length) return s.blocks
  const blocks = []
  if (s.warmup) blocks.push({ type: 'WarmUp', params: { duration: s.warmup.duration } })
  if (s.cashIn?.length > 0) blocks.push({ type: 'Cash In', exercises: s.cashIn })
  if (s.main) blocks.push({
    type: s.main.type === 'EMOM' && s.main.params?.on ? 'ON/OFF' : s.main.type,
    params: s.main.params || {},
    exercises: s.main.exercises || [],
  })
  if (s.cashOut?.length > 0) blocks.push({ type: 'Cash Out', exercises: s.cashOut })
  return blocks
}

/**
 * Durata stimata di un allenamento, in minuti.
 *
 * 🔴 **Dal 09/09/2026 la parte Hyrox NON ha più una formula propria: chiama
 * `durataBlocco`.** È la chiusura di BACKLOG #40, ed è la cosa da sapere prima
 * di rimetterci mano. Fino a quel giorno esistevano due stimatori — questo e
 * quello di `stimaWorkout.js` — che sullo stesso allenamento dicevano **58** e
 * **24** minuti: la Home leggeva il primo, la scheda, l'archivio, il calendario
 * e la grafica da storia il secondo. Nessuno dei due era sbagliato preso da
 * solo, ed è per questo che il difetto è sopravvissuto: si vedeva solo mettendo
 * due schermate una accanto all'altra.
 *
 * Ora il totale è **la somma dei blocchi che la scheda stampa uno per uno**,
 * quindi un coach che li somma a mente ritrova il numero in cima. Era la
 * proprietà che mancava, e non c'è modo di riottenerla con due formule.
 *
 * ⚠️ La corsa resta qui: `stimaWorkout.js` conosce solo i blocchi Hyrox, e le
 * fasi di corsa hanno un formato tutto loro (`sections.steps`).
 */
export const durataWorkout = (sections) => {
  const s = sections || {}
  const cat = s.category || (s.steps ? 'Running' : 'Hyrox')
  let minuti = 0

  if (cat === 'Running') {
    for (const step of s.steps || s.main?.steps || []) {
      if (step.type === 'repeat') {
        const rounds = parseInt(step.rounds) || 1
        minuti += (parseTime(step.runDuration) + parseTime(step.recDuration)) * rounds
      } else {
        minuti += parseTime(step.duration)
      }
    }
  } else {
    for (const b of blocchiDi(s)) minuti += durataBlocco(b) / 60
  }

  // Un allenamento senza tempo dichiarato non vale zero: falserebbe le medie.
  return minuti === 0 ? MINUTI_PREDEFINITI : Math.round(minuti)
}

/**
 * In quale fascia cade un RPE.
 *
 * È esportata perché la stessa scala serve in due punti — qui e in
 * `src/lib/andamento.js`, che la ricalcola sulla finestra di 30 giorni della
 * scheda atleta. Due copie di questi confini vorrebbero dire due grafici che
 * dicono cose diverse dello stesso allenamento, senza dare nessun errore.
 */
export const fasciaRpe = (valore) => {
  if (valore <= 4) return 'light'
  if (valore <= 6) return 'moderate'
  if (valore <= 8) return 'hard'
  return 'extreme'
}

/**
 * Le quattro settimane, il tasso di completamento a 30 giorni e la
 * distribuzione degli RPE.
 *
 * @param workouts  righe di athlete_workouts con `workouts.sections` incluso
 * @param oggi      iniettabile, così i test non dipendono dal calendario
 */
export function calcolaStatistiche(workouts = [], oggi = new Date()) {
  const settimane = []
  for (let i = 3; i >= 0; i--) {
    const inizio = startOfWeek(new Date(oggi.getTime() - i * 7 * 24 * 60 * 60 * 1000), { weekStartsOn: 1 })
    const fine = new Date(inizio)
    fine.setDate(inizio.getDate() + 6)
    settimane.push({
      label: i === 0 ? 'Questa sett.' : `${format(inizio, 'd MMM')} - ${format(fine, 'd MMM')}`,
      // L'etichetta corta per il grafico a barre della scheda atleta: su 393px,
      // accanto all'anello, «11 ago - 17 ago» non ci sta in nessun modo.
      breve: `S${getISOWeek(inizio)}`,
      startStr: format(inizio, 'yyyy-MM-dd'),
      endStr: format(fine, 'yyyy-MM-dd'),
      time: 0,
      load: 0,
    })
  }

  let assegnati = 0, completati = 0
  const rpe = { light: 0, moderate: 0, hard: 0, extreme: 0, total: 0 }
  const trentaGiorniFa = format(new Date(oggi.getTime() - 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')
  const oggiStr = format(oggi, 'yyyy-MM-dd')

  for (const w of workouts) {
    if (w.completed_date >= trentaGiorniFa && w.completed_date <= oggiStr) {
      assegnati++
      if (w.status === 'completed') completati++
    }
    if (w.status !== 'completed') continue

    const { rpe: valore } = parseNotesAndRpe(w.notes)
    const settimana = settimane.find(k => w.completed_date >= k.startStr && w.completed_date <= k.endStr)
    if (settimana) {
      const minuti = durataWorkout(w.workouts?.sections)
      settimana.time += minuti
      // Carico = tempo × sforzo percepito. È la misura che il coach guarda per
      // decidere se caricare o scaricare la settimana successiva.
      settimana.load += minuti * (Number.isFinite(valore) ? valore : 5)
    }

    if (Number.isFinite(valore)) {
      rpe.total++
      rpe[fasciaRpe(valore)]++
    }
  }

  return {
    settimane,
    completamento: { assigned: assegnati, done: completati },
    distribuzioneRpe: rpe,
    percentualeCompletamento: assegnati > 0 ? Math.round((completati / assegnati) * 100) : 0,
  }
}

// ─── Helper della Home atleta (26/08/2026) ────────────────────────────────
//
// Alimentano l'eroe di oggi e le due celle del bento. Sono qui e non nella
// pagina per la stessa ragione delle funzioni sopra: sono numeri che, se
// sbagliano, non danno errore — cambiano solo quello che l'atleta legge.
// Riusano `durataWorkout` e `blocchiDi`, così il calcolo della durata resta
// in un punto solo (era già stato duplicato tre volte, BACKLOG #30).

/** Quanti blocchi ha un allenamento; per la corsa, quante fasi. */
export const numeroBlocchi = (sections) => {
  const s = sections || {}
  const cat = s.category || (s.steps ? 'Running' : 'Hyrox')
  if (cat === 'Running') return (s.steps || s.main?.steps || []).length
  return blocchiDi(s).length
}

/** Quanto pesa, sulla scala 1-10, un blocco di un certo tipo. */
const SFORZO_BLOCCO = {
  'WarmUp': 3,
  'Rest': 1,
  'Cash In': 6,
  'Cash Out': 7,
  'ON/OFF': 7,
  'EMOM': 7,
  'AMRAP': 8,
  'For Time': 9,
  'Interval': 8,
}

/**
 * L'RPE che ci si aspetta da un allenamento, prima di farlo.
 *
 * Due fonti, in ordine: l'intensità dichiarata dal coach in `sections.intensity`
 * (CLAUDE.md §5 — è un dato vero, non una stima) e, se manca, la media dei tipi
 * di blocco. Il riscaldamento e il rest sono esclusi dalla media: un allenamento
 * duro con due minuti di rest in fondo non diventa facile per quello.
 *
 * Torna `null` quando non c'è niente su cui basarsi: la voce sparisce dalla
 * riga invece di mostrare un numero inventato.
 */
export const rpeAtteso = (sections) => {
  const s = sections || {}

  const dichiarata = parseFloat(s.intensity)
  if (Number.isFinite(dichiarata) && dichiarata >= 1 && dichiarata <= 10) return Math.round(dichiarata)

  const cat = s.category || (s.steps ? 'Running' : 'Hyrox')
  if (cat === 'Running') {
    const fasi = (s.steps || s.main?.steps || [])
      .map(p => parseFloat(p.type === 'repeat' ? p.runIntensity : p.intensity))
      .filter(v => Number.isFinite(v) && v >= 1 && v <= 10)
    if (fasi.length === 0) return null
    return Math.round(fasi.reduce((a, b) => a + b, 0) / fasi.length)
  }

  const pesi = blocchiDi(s)
    .filter(b => b.type !== 'WarmUp' && b.type !== 'Rest')
    .map(b => SFORZO_BLOCCO[b.type])
    .filter(Number.isFinite)
  if (pesi.length === 0) return null
  return Math.round(pesi.reduce((a, b) => a + b, 0) / pesi.length)
}

/**
 * Sotto questo numero di precedenti, una media non dice ancora niente.
 *
 * ⚠️ Esportata dal 09/09/2026: è la stessa soglia con cui la Home decide se
 * mostrare «Media RPE» o la cella che dichiara quanto manca per accenderla
 * (`CellaBloccata`). Due numeri scritti a mano in due punti direbbero all'atleta
 * «si accende dopo 3 allenamenti» e poi la accenderebbero al quarto, senza dare
 * nessun errore.
 */
export const MINIMO_PRECEDENTI = 3

/**
 * L'RPE medio che questo atleta ha davvero segnato su questa categoria.
 *
 * È più onesto di qualunque stima — ma solo con abbastanza precedenti: sotto
 * MINIMO_PRECEDENTI torna `null` e il chiamante ripiega su `rpeAtteso`. Con un
 * solo precedente la "media" sarebbe quell'unico giorno, buono o storto che sia.
 */
export const mediaRpeCategoria = (workouts = [], categoria) => {
  let somma = 0, quanti = 0
  for (const w of workouts) {
    if (w?.status !== 'completed') continue
    if (categoriaDi(w.workouts?.sections) !== categoria) continue
    // ⚠️ `rpeDichiarato` e non `parseNotesAndRpe`: il secondo torna 5 quando
    // l'atleta non ha segnato niente, e quel 5 entrerebbe nella media come se
    // fosse una misura. Chi non compila mai l'RPE vedrebbe "5" presentato come
    // la propria media storica — un numero inventato, esattamente ciò che
    // questa funzione esiste per evitare.
    const rpe = rpeDichiarato(w.notes)
    if (rpe == null) continue
    somma += rpe
    quanti++
  }
  if (quanti < MINIMO_PRECEDENTI) return null
  return Math.round((somma / quanti) * 10) / 10
}

/** Quante volte una data compare come giorno di allenamento, per stato. */
const perGiorno = (workouts) => {
  const mappa = new Map()
  for (const w of workouts) {
    const data = w?.completed_date
    if (!data) continue
    const riga = mappa.get(data) || { assegnati: 0, completati: 0, minuti: 0 }
    riga.assegnati++
    if (w.status === 'completed') {
      riga.completati++
      riga.minuti += durataWorkout(w.workouts?.sections)
    }
    mappa.set(data, riga)
  }
  return mappa
}

/** Il muro oltre cui non si cammina all'indietro, per non ciclare all'infinito. */
const MASSIMO_GIORNI_SERIE = 365

/**
 * Quanti giorni di rest programmato di fila la serie riesce ad attraversare.
 *
 * Senza questo tetto la regola "il rest non spezza" non spezza MAI: un atleta
 * che si è allenato una volta quaranta giorni fa e mai più leggeva «Serie:
 * 1 giorno», perché i trentanove giorni vuoti in mezzo erano tutti rest
 * programmato. Tre è la lunghezza oltre la quale una pausa non è più un
 * micro-ciclo di scarico: è aver smesso.
 */
const MASSIMO_REST_CONSECUTIVI = 3

/**
 * I giorni consecutivi di allenamento, camminando all'indietro da oggi.
 *
 * ⚠️ Le due regole che rendono questo numero onesto invece di un premio
 * regalato, e che sono l'unica ragione per cui la funzione non è una riga:
 *
 * 1. Un giorno di **rest programmato** (nessun workout assegnato) NON spezza la
 *    serie, ma non la allunga: si attraversa. La programmazione prevede i giorni
 *    di scarico, e una serie che si azzera il lunedì di scarico misurerebbe la
 *    disponibilità del calendario, non la costanza dell'atleta.
 *    Si attraversano però al massimo MASSIMO_REST_CONSECUTIVI giorni di fila:
 *    oltre, non è più uno scarico.
 * 2. Un **assegnato non completato** la spezza. È il caso che il numero deve
 *    saper dire, altrimenti non sta misurando niente.
 *
 * Unica eccezione: **oggi**, se assegnato e non ancora completato, non spezza
 * niente — la giornata non è finita. Senza questa eccezione la serie leggerebbe
 * zero ogni mattina fino all'allenamento, che si legge come un guasto.
 */
export const serieGiorni = (workouts = [], oggi = new Date()) => {
  const giorni = perGiorno(workouts)
  let serie = 0
  let restDiFila = 0

  for (let i = 0; i < MASSIMO_GIORNI_SERIE; i++) {
    const data = format(new Date(oggi.getTime() - i * 86400000), 'yyyy-MM-dd')
    const riga = giorni.get(data)

    if (riga?.completati > 0) { serie++; restDiFila = 0; continue }
    if (!riga) {
      // Rest programmato: si attraversa, ma non all'infinito.
      if (++restDiFila > MASSIMO_REST_CONSECUTIVI) break
      continue
    }
    if (i === 0) continue               // oggi non è ancora finito
    break                               // assegnato e saltato: la serie finisce qui
  }

  return serie
}

/**
 * I minuti degli ultimi `quanti` giorni, normalizzati a 0-100 per lo sparkline.
 *
 * Il valore più alto del periodo vale 100 e gli altri stanno in proporzione: la
 * barra racconta l'andamento, non una quantità assoluta. Con nessun dato torna
 * tutti zero invece di dividere per zero — è il caso del primo giorno di un
 * atleta nuovo, e sbagliarlo qui riempiva la Home di NaN.
 *
 * L'array è in ordine cronologico: l'ultimo elemento è oggi.
 */
export const barreUltimiGiorni = (workouts = [], quanti = 6, oggi = new Date()) => {
  const giorni = perGiorno(workouts)
  const minuti = []

  for (let i = quanti - 1; i >= 0; i--) {
    const data = format(new Date(oggi.getTime() - i * 86400000), 'yyyy-MM-dd')
    minuti.push(giorni.get(data)?.minuti || 0)
  }

  const massimo = Math.max(...minuti)
  if (massimo <= 0) return minuti.map(() => 0)
  return minuti.map(m => Math.round((m / massimo) * 100))
}

// ─── Gli stati senza storico (09/09/2026) ─────────────────────────────────
//
// Alimentano i tre stati della Home atleta quando i numeri non ci sono ancora:
// giorno 1, prima settimana, giorno di riposo. La regola del rework è una sola
// — *nessuna cella mostra uno zero: al posto di un dato che non esiste va la
// cosa che lo farà esistere* — e queste funzioni sono il modo di sapere QUANDO
// un dato non esiste, invece di stamparlo a zero e sperare.
//
// ⚠️ Usano `durataWorkout`, la stessa che alimenta `weeklyStats.time` in
// `Home.jsx`. NON `durataBlocco` di `stimaWorkout.js`: i due stimatori
// divergono fino all'89% su un «For Time» (CLAUDE.md §9-quatervicies, BACKLOG
// #40), e qui i due numeri finiscono sullo STESSO schermo — i minuti della
// settimana e lo scarto sulla precedente. Misurarli in due modi darebbe una
// differenza costruita fra due scale diverse, che è aritmetica giusta e
// informazione falsa.

/**
 * Vero quando l'atleta non ha NIENTE: nessun completato, nessun assegnato in
 * settimana, niente nei prossimi giorni. È la condizione del giorno 1.
 *
 * ⚠️ Guarda tutte e tre le fonti anche se oggi derivano tutte dallo stesso
 * `storicoAtleta`: un atleta con la settimana vuota ma un assegnato fra dieci
 * giorni **non** è al giorno 1, e mandargli la schermata di benvenuto vorrebbe
 * dire nascondergli il programma che il coach gli ha già scritto. Il giorno in
 * cui una delle tre arriva da un'altra query, questa funzione regge lo stesso.
 */
export function senzaStorico({ storico = [], weeklyStatus = [], upcoming = [] } = {}) {
  const assegnatiInSettimana = weeklyStatus.reduce((a, g) => a + (g?.workouts?.length || 0), 0)
  return storico.length === 0 && assegnatiInSettimana === 0 && upcoming.length === 0
}

/**
 * I minuti completati nella settimana di CALENDARIO che contiene `giorno`.
 *
 * 🔴 Settimana lunedì-domenica, non una finestra mobile di sette giorni. È la
 * correzione che questa funzione ha ricevuto rispetto al disegno: il numero
 * accanto a cui vive — `weeklyStats.time` — è calcolato su `startOfWeek(...,
 * { weekStartsOn: 1 })`, e una finestra mobile avrebbe prodotto uno scarto che
 * non corrisponde al totale sopra di esso. È la stessa regola del LUNEDÌ che
 * tiene allineati la rubrica, l'anello della Home e il report (CLAUDE.md
 * §9-septdecies punto 4): due settimane diverse danno due numeri che non
 * coincidono, e nessuno dei due è sbagliato preso da solo.
 *
 * Conta solo i `completed`: un assegnato non fatto non è volume.
 */
export function minutiSettimana(workouts = [], giorno = new Date()) {
  const inizio = startOfWeek(giorno, { weekStartsOn: 1 })
  const fine = new Date(inizio)
  fine.setDate(inizio.getDate() + 6)
  const inizioStr = format(inizio, 'yyyy-MM-dd')
  const fineStr = format(fine, 'yyyy-MM-dd')

  return workouts.reduce((tot, w) => {
    if (w?.status !== 'completed' || !w.completed_date) return tot
    if (w.completed_date < inizioStr || w.completed_date > fineStr) return tot
    return tot + (durataWorkout(w.workouts?.sections) || 0)
  }, 0)
}

/**
 * Differenza in minuti fra la settimana corrente e quella precedente.
 *
 * Torna `null` — non `0`, non `+214` — quando la settimana precedente è vuota:
 * «+214 min sulla scorsa» su una settimana in cui non esistevi è un dato finto,
 * ed è la sesta comparsa della regola di `rpeAtteso` (CLAUDE.md §9-octies). La
 * card lo omette da sé.
 */
export function scartoMinutiSettimana(workouts = [], oggi = new Date()) {
  const settimanaScorsa = new Date(oggi)
  settimanaScorsa.setDate(settimanaScorsa.getDate() - 7)
  const prima = minutiSettimana(workouts, settimanaScorsa)
  if (prima === 0) return null
  return minutiSettimana(workouts, oggi) - prima
}
