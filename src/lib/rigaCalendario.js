// Come si legge un mese di calendario: la griglia, il segno di ogni giorno, i
// tre numeri della fascia di sintesi e la riga di una sessione.
//
// Perché esiste: la griglia del mese occupava metà schermo e trasmetteva UN
// bit per giorno — ci sono pallini o non ci sono. Non distingueva il fatto dal
// programmato, non diceva il carico, e i tre pallini da 6px si perdevano. La
// cosa per cui si apre il calendario — cosa devo fare, cosa ho saltato — stava
// tutta sotto la piega.
//
// ⚠️ Le durate qui dentro sono STIME e arrivano da `stimaWorkout.js`, cioè
// dalla stessa funzione che alimenta il riepilogo del builder, quello della
// scheda e il meta dell'archivio. Se il calendario dicesse «52′» dove la
// scheda dice «48′», nessuno dei due numeri sarebbe sbagliato da solo e non ci
// sarebbe modo di accorgersene.

import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth } from 'date-fns'
import { it } from 'date-fns/locale'
import { getNormalizedBlocks } from './timerSequence'
import { riepilogoWorkout, minutiStimati, decimale } from './stimaWorkout'
import { categoriaDi, corsia } from './categorie'
import { dataValida, riepilogoCorsa } from './rigaArchivio'

/**
 * Quanti segni entrano in una cella da 43px prima che diventino schegge.
 *
 * ⚠️ È un tetto, non un conteggio: il numero VERO di sessioni finisce
 * nell'`aria-label` della cella, altrimenti un giorno con cinque allenamenti e
 * uno con tre sarebbero indistinguibili anche per chi legge con VoiceOver.
 */
export const MASSIMO_SEGMENTI = 3

/** La chiave con cui si indicizza un giorno. */
export const chiaveGiorno = (data) => format(data, 'yyyy-MM-dd')

/**
 * La griglia del mese: i giorni e quante celle vuote li precedono.
 *
 * ⚠️ La settimana comincia di LUNEDÌ, come ovunque nell'app (§9-septdecies
 * punto 4): `getDay()` torna 0 per la domenica, che va in fondo e non in testa.
 */
export const griglia = (mese) => {
  const primo = startOfMonth(mese)
  const giornoSettimana = primo.getDay()
  return {
    giorni: eachDayOfInterval({ start: primo, end: endOfMonth(mese) }),
    vuote: giornoSettimana === 0 ? 6 : giornoSettimana - 1,
  }
}

/**
 * I workout del mese indicizzati per giorno.
 *
 * Prima ogni cella filtrava l'intera lista con `isSameDay`: trentuno scansioni
 * complete a ogni render, e una `parseISO` per workout per cella.
 */
export const indicizzaPerGiorno = (workouts = []) => {
  const per = new Map()
  for (const w of workouts) {
    const d = dataValida(w?.date)
    if (!d) continue
    const chiave = chiaveGiorno(d)
    if (!per.has(chiave)) per.set(chiave, [])
    per.get(chiave).push(w)
  }
  return per
}

/** Un workout è chiuso solo se il dato lo dice: il coach quel dato non ce l'ha. */
const fatto = (w) => w?.status === 'completed'

/**
 * Il segno di una cella: i segmenti della barra-corsia, e se il giorno è chiuso.
 *
 * ⚠️ Qui NON si sceglie un colore. Il segmento porta la categoria e lo stato, e
 * a tradurli in un tono è il componente: è aspetto, non aritmetica — la stessa
 * divisione che `riepilogoWorkout` fa con i segmenti della barra del builder.
 */
export const segnoGiorno = (lista = []) => ({
  n: lista.length,
  segmenti: lista.slice(0, MASSIMO_SEGMENTI).map(w => ({
    categoria: categoriaDi(w?.sections),
    fatto: fatto(w),
  })),
  // Il velo verde vale per il giorno INTERO, quindi pretende che sia tutto
  // chiuso: con una sessione su due fatta il giorno non è andato, e tingerlo
  // di verde direbbe il contrario. Il singolo segmento resta verde da sé.
  tuttiFatti: lista.length > 0 && lista.every(fatto),
})

/**
 * I minuti stimati di un workout, oppure `null` quando non si possono stimare.
 *
 * 🔴 `null` NON è zero, ed è la ragione per cui questa funzione non torna un
 * numero e basta. Custom ed Evento non hanno blocchi; una corsa definita a
 * DISTANZA («18 km») non ha minuti finché non si assume un passo, e assumerlo
 * qui vorrebbe dire inventarlo. Chi somma questi valori deve poter dire quante
 * sessioni ha dovuto lasciare fuori — vedi `riepilogoMese`.
 */
export const minutiWorkout = (workout) => {
  const categoria = categoriaDi(workout?.sections)

  if (categoria === 'Custom' || categoria === 'Event') return null

  if (categoria === 'Running') {
    const r = riepilogoCorsa(workout?.sections?.steps || [])
    return r.puroTempo && r.minuti > 0 ? Math.round(r.minuti) : null
  }

  const blocchi = getNormalizedBlocks(workout || {})
  if (blocchi.length === 0) return null
  const minuti = minutiStimati(riepilogoWorkout(blocchi).secondi)
  return minuti > 0 ? minuti : null
}

// La somma dei minuti stimabili di una lista, con quante sessioni sono rimaste
// fuori. Le due cose viaggiano insieme di proposito: un totale senza il numero
// degli esclusi è un totale che si legge come completo.
const sommaMinuti = (lista = []) => {
  let minuti = 0
  let ignote = 0
  for (const w of lista) {
    const m = minutiWorkout(w)
    if (m === null) ignote += 1
    else minuti += m
  }
  return { minuti, ignote }
}

// La prima gara del mese, nel formato corto della fascia: «22 ago».
const primaGara = (gare) => {
  if (gare.length === 0) return null
  const d = dataValida(gare[0].date)
  return { giorno: format(d, 'd MMM', { locale: it }), titolo: gare[0].title || 'Gara', n: gare.length }
}

/**
 * I tre numeri sopra la griglia.
 *
 * ⚠️ `soloCompletati` non è un'opzione di comodo: tiene le prime due celle
 * sullo STESSO orizzonte. Per l'atleta la coppia dice «14 di 18 fatti, 11 ore
 * di lavoro» — e le ore sono quelle dei 14. Per il coach non esiste nessun
 * «fatto» nei suoi dati (la sua query legge `workouts`, che non ha uno stato),
 * quindi la coppia dice «18 programmati, 15 ore di carico» e misura gli stessi
 * 18. Due orizzonti sotto un'intestazione sola sarebbero la bugia peggiore
 * della fascia, perché nessuno dei due numeri sarebbe sbagliato da solo
 * (è la lezione di `andamento.js`, §9-terdecies punto 1).
 */
export const riepilogoMese = (workouts = [], { soloCompletati = false } = {}) => {
  const completati = workouts.filter(fatto)
  const misurati = soloCompletati ? completati : workouts
  const { minuti, ignote } = sommaMinuti(misurati)

  const gare = workouts
    .filter(w => categoriaDi(w?.sections) === 'Event' && dataValida(w?.date))
    .sort((a, b) => dataValida(a.date) - dataValida(b.date))

  return {
    totale: workouts.length,
    completati: completati.length,
    minuti,
    // Quante sessioni il volume ha dovuto lasciare fuori, e quante ne ha
    // davvero misurate: servono al chiamante per non spacciare una somma
    // parziale per il totale del mese.
    ignote,
    misurate: misurati.length - ignote,
    gara: primaGara(gare),
  }
}

/**
 * Il volume come si scrive nella fascia.
 *
 * ⚠️ Il `≈` non è vezzo tipografico: compare SOLO quando la somma ha dovuto
 * lasciare fuori qualcosa, ed è l'unico modo di dire «questo totale è
 * parziale» in una cella larga quanto un numero. Senza, una corsa di 18 km e
 * quattro allenamenti liberi sparirebbero dentro un «11 h» che ha tutta
 * l'aria di essere completo. Quando NIENTE è misurabile è `—`, non «0 h»:
 * zero ore è una bugia con l'aria di un dato (§9-undecies punto 2).
 */
export const formattaVolume = (minuti, ignote = 0, misurate = 1) => {
  if (misurate <= 0 || minuti <= 0) return { valore: '—', unita: '', parziale: false }
  const parziale = ignote > 0
  const prefisso = parziale ? '≈' : ''
  if (minuti < 60) return { valore: `${prefisso}${minuti}`, unita: '′', parziale }
  const ore = minuti / 60
  const arrotondate = ore >= 10 ? Math.round(ore) : Math.round(ore * 10) / 10
  return { valore: `${prefisso}${decimale(arrotondate)}`, unita: ' h', parziale }
}

/** La riga sotto la data del giorno scelto: «2 sessioni · 68′». */
export const riepilogoGiorno = (lista = []) => {
  if (lista.length === 0) return ''
  const { minuti, ignote } = sommaMinuti(lista)
  const parti = [`${lista.length} ${lista.length === 1 ? 'sessione' : 'sessioni'}`]
  if (minuti > 0) parti.push(`${ignote > 0 ? '≈' : ''}${minuti}′`)
  return parti.join(' · ')
}

/**
 * L'etichetta della pillola di una sessione.
 *
 * Per un Hyrox è il blocco che porta il lavoro — «EMOM», «AMRAP» — perché è
 * quello che distingue una seduta dall'altra dentro la stessa corsia. Per le
 * altre categorie la corsia È la risposta, e ripeterne il nome due volte non
 * aggiunge niente.
 */
export const etichettaSessione = (workout) => {
  const categoria = categoriaDi(workout?.sections)
  if (categoria !== 'Hyrox') return corsia(categoria).etichetta
  const principale = getNormalizedBlocks(workout || {})
    .find(b => ['EMOM', 'ON/OFF', 'AMRAP', 'For Time', 'Interval'].includes(b?.type))
  return principale ? principale.type : corsia(categoria).etichetta
}

/** «Venerdì 22 agosto», con l'iniziale maiuscola come si scrive in italiano. */
export const etichettaGiorno = (data) => {
  const s = format(data, 'EEEE d MMMM', { locale: it })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Il titolo del mese, per la testata: «Agosto». */
export const etichettaMese = (mese) => {
  const s = format(mese, 'MMMM', { locale: it })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Il mese mostrato è quello corrente? Decide se «Oggi» serve a qualcosa. */
export const eMeseCorrente = (mese, adesso = new Date()) => isSameMonth(mese, adesso)
