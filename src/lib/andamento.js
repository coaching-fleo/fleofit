import { format } from 'date-fns'
import { calcolaStatistiche, fasciaRpe, durataWorkout } from './statistiche'
import { rpeDichiarato } from './rpe'

// I numeri dell'eroe della scheda atleta (CLAUDE.md §9-terdecies).
//
// Il dato per cui il coach apre la scheda di un atleta è uno solo: sta
// seguendo il programma, e con quanto carico? Prima stava nella terza tab,
// dietro due tocchi e quattro grafici che non si parlavano — uno per
// l'aderenza, uno per il volume, uno per il carico, uno per l'RPE. Qui i
// quattro diventano tre numeri e una frase, calcolati sulla STESSA finestra
// così che si possano leggere insieme.
//
// ⚠️ La finestra è la ragione per cui questo file esiste invece di essere due
// righe nella pagina. `calcolaStatistiche` misura le settimane sulle ultime
// quattro e la distribuzione RPE su TUTTO lo storico: due orizzonti diversi
// sotto un'intestazione sola («30 giorni») sarebbero la bugia peggiore della
// pagina, perché nessuno dei due numeri è sbagliato preso da solo.

/** La finestra dell'anello e delle due celle del bento. */
export const GIORNI_ADERENZA = 30

/**
 * Scarto percentuale sotto il quale il carico si dice «stabile».
 *
 * Non è arrotondamento: il carico è minuti × RPE, e i minuti sono a loro volta
 * una stima (`durataWorkout`). Chiamare «in salita» un +4% vorrebbe dire far
 * decidere al coach su rumore.
 */
export const SOGLIA_STABILE = 10

/** Da quanti RPE dichiarati in poi una media ha senso di essere mostrata. */
const MINIMO_RPE = 2

/** Le righe che cadono nella finestra, già filtrate per stato completato. */
const nellaFinestra = (workouts, giorni, oggi) => {
  const dal = format(new Date(oggi.getTime() - giorni * 86400000), 'yyyy-MM-dd')
  const al = format(oggi, 'yyyy-MM-dd')
  return (workouts || []).filter(w => w?.completed_date >= dal && w.completed_date <= al)
}

/**
 * Lo sforzo percepito nella finestra: media, quanti l'hanno dichiarato, e come
 * si distribuisce sulle quattro fasce.
 *
 * ⚠️ `rpeDichiarato` e non `parseNotesAndRpe`: il secondo torna **5** quando il
 * marcatore manca, ed è il valore giusto per il cursore della modale — ma è un
 * ripiego travestito da misura per chiunque lo mostri come un dato. Un atleta
 * che non compila mai l'RPE leggerebbe «5,0» come la propria media. È la stessa
 * lezione di `mediaRpeCategoria` (CLAUDE.md §9-octies).
 */
export function sforzoNellaFinestra(workouts = [], giorni = GIORNI_ADERENZA, oggi = new Date()) {
  const distribuzione = { light: 0, moderate: 0, hard: 0, extreme: 0, total: 0 }
  let somma = 0

  for (const w of nellaFinestra(workouts, giorni, oggi)) {
    if (w.status !== 'completed') continue
    const rpe = rpeDichiarato(w.notes)
    if (rpe == null) continue
    somma += rpe
    distribuzione.total++
    distribuzione[fasciaRpe(rpe)]++
  }

  const quanti = distribuzione.total
  return {
    // `null`, non 0: zero direbbe «fatica nulla», e con un solo dato la media
    // è quel giorno, non una media.
    medio: quanti >= MINIMO_RPE ? Math.round((somma / quanti) * 10) / 10 : null,
    quanti,
    distribuzione,
    // Quanti allenamenti sono stati da 7 in su: è il numero su cui si decide se
    // la settimana successiva va scaricata.
    duri: distribuzione.hard + distribuzione.extreme,
  }
}

/** I minuti allenati nella finestra. */
export function minutiNellaFinestra(workouts = [], giorni = GIORNI_ADERENZA, oggi = new Date()) {
  let minuti = 0
  for (const w of nellaFinestra(workouts, giorni, oggi)) {
    if (w.status !== 'completed') continue
    minuti += durataWorkout(w.workouts?.sections)
  }
  return Math.round(minuti)
}

/**
 * Lo scarto fra due numeri, in percentuale.
 *
 * Torna `null` quando il precedente è zero: «+∞%» non è un'informazione, e
 * `(5-0)/0` è la strada più breve per stampare `Infinity` in pagina.
 */
export const scarto = (corrente, precedente) =>
  precedente > 0 ? Math.round(((corrente - precedente) / precedente) * 100) : null

/**
 * La frase sotto i due numeri — quella su cui il coach decide se caricare o
 * scaricare la settimana dopo.
 *
 * È volutamente IMPERSONALE («Carico in salita», non «stai andando forte»):
 * questa pagina è anche `/profile`, cioè la scheda che l'atleta vede di sé, e
 * una frase rivolta a qualcuno andrebbe scritta due volte — a quel punto le due
 * versioni divergono al primo ritocco.
 */
export function fraseAndamento({ aderenza, carico }) {
  if (aderenza.assegnati === 0) {
    return { testo: 'Nessun allenamento assegnato negli ultimi 30 giorni.', dettaglio: null }
  }

  const { corrente, precedente, delta } = carico
  let tendenza
  if (corrente === 0 && precedente === 0) tendenza = 'Nessun carico registrato nelle ultime due settimane'
  else if (precedente === 0) tendenza = 'Prima settimana con carico registrato'
  else if (delta >= SOGLIA_STABILE) tendenza = 'Carico in salita'
  else if (delta <= -SOGLIA_STABILE) tendenza = 'Carico in calo'
  else tendenza = 'Carico stabile'

  const p = aderenza.percentuale
  let costanza
  if (p >= 85) costanza = 'programma seguito'
  else if (p >= 60) costanza = 'aderenza nella norma'
  else if (p >= 30) costanza = 'aderenza in calo'
  else costanza = 'più di due allenamenti su tre saltati'

  return {
    testo: `${tendenza}, ${costanza}.`,
    // Il numero grezzo accanto alla frase: senza, «in salita» non si può
    // verificare, e una frase che non si può verificare si smette di leggere.
    dettaglio: precedente > 0 ? `${corrente} pt contro ${precedente}.` : null,
  }
}

/**
 * Tutto ciò che serve all'eroe della scheda atleta, da una lista sola.
 *
 * @param workouts righe di athlete_workouts con `workouts.sections` incluso
 * @param oggi     iniettabile, così i test non dipendono dal calendario
 */
export function andamentoAtleta(workouts = [], oggi = new Date()) {
  const { settimane, completamento, percentualeCompletamento } = calcolaStatistiche(workouts, oggi)

  const corrente = settimane.at(-1)
  const precedente = settimane.at(-2)

  const carico = {
    corrente: Math.round(corrente.load),
    precedente: Math.round(precedente.load),
    delta: scarto(corrente.load, precedente.load),
  }

  const aderenza = {
    fatti: completamento.done,
    assegnati: completamento.assigned,
    percentuale: percentualeCompletamento,
  }

  return {
    aderenza,
    settimane,
    carico,
    volume: {
      minuti: corrente.time,
      // In MINUTI e non in percentuale: «+50 min» si confronta con la propria
      // settimana, «+24%» va prima ritradotto in minuti per farci qualcosa.
      delta: corrente.time - precedente.time,
      // Lo sparkline: le quattro settimane normalizzate, la più alta a 100.
      barre: normalizza(settimane.map(s => s.time)),
    },
    sforzo: sforzoNellaFinestra(workouts, GIORNI_ADERENZA, oggi),
    totaleMinuti: minutiNellaFinestra(workouts, GIORNI_ADERENZA, oggi),
    frase: fraseAndamento({ aderenza, carico }),
  }
}

/**
 * Porta una serie a 0-100 sul proprio massimo.
 *
 * Con tutti zero torna tutti zero invece di dividere per zero: è il caso del
 * primo giorno di un atleta nuovo, e sbagliarlo qui riempie la pagina di NaN.
 */
export function normalizza(valori = []) {
  const massimo = Math.max(...valori, 0)
  if (massimo <= 0) return valori.map(() => 0)
  return valori.map(v => Math.round((v / massimo) * 100))
}
