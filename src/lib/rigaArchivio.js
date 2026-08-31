// Come si legge una riga dell'archivio: il meta compresso, i gruppi per mese,
// i conteggi per corsia e il testo su cui la ricerca lavora.
//
// Perché esiste: l'archivio era una lista piatta ordinata per data di
// CREAZIONE, senza raggruppamenti e senza un solo numero. Con dieci workout
// funzionava; con i 171 in produzione è uno scroll cieco, e l'unico strumento
// di riduzione era un campo di testo — se non ricordi il titolo esatto, non
// hai una strada.
//
// ⚠️ Le durate qui dentro sono STIME e arrivano da `stimaWorkout.js`, cioè
// dalla stessa funzione che alimenta il riepilogo del builder e quello della
// scheda. Non è pigrizia: se l'archivio dicesse «52′» dove la scheda dice
// «48′», nessuna delle due sarebbe sbagliata da sola e non ci sarebbe modo di
// accorgersene. Una sorgente sola, o i due numeri divergono al primo ritocco.

import { format, parseISO, isValid } from 'date-fns'
import { it } from 'date-fns/locale'
import { getNormalizedBlocks } from './timerSequence'
import { riepilogoWorkout, minutiStimati, decimale } from './stimaWorkout'
import { categoriaDi, corsia } from './categorie'

/** L'ordine in cui le corsie compaiono nei filtri. Hyrox prima: è la specialità. */
export const ORDINE_CORSIE = ['Hyrox', 'Running', 'Custom', 'Event']

/** La data di un workout, o `null` se manca o è illeggibile. */
export const dataValida = (iso) => {
  if (!iso) return null
  const d = parseISO(String(iso))
  return isValid(d) ? d : null
}

/**
 * Il giorno in forma breve: «Ven 22».
 *
 * ⚠️ NON è brevità per gusto. «venerdì 22 agosto 2026» era la stringa più larga
 * della riga e la meno utile in una lista già ordinata per data e già divisa
 * per mese: l'anno e il mese li dice l'intestazione del gruppo, qui serve
 * sapere che giorno della settimana era.
 */
export const giornoBreve = (iso) => {
  const d = dataValida(iso)
  if (!d) return ''
  const s = format(d, 'EEE d', { locale: it })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// Una misura di una fase di corsa: metri oppure minuti, mai entrambi.
// Accetta "5 km", "400m", "10 min". Tutto il resto è ignoto, e l'ignoto conta
// (vedi `riepilogoCorsa`).
const misuraDi = (v) => {
  const m = String(v ?? '').trim().match(/^(\d+(?:[.,]\d+)?)\s*(km|m|min)$/i)
  if (!m) return null
  const n = parseFloat(m[1].replace(',', '.'))
  if (!Number.isFinite(n) || n <= 0) return null
  const unita = m[2].toLowerCase()
  if (unita === 'km') return { metri: n * 1000 }
  if (unita === 'm') return { metri: n }
  return { minuti: n }
}

/**
 * Quanto dice di sé un allenamento di corsa.
 *
 * 🔴 Qui NON si usa `parseDuration` di timerSequence, ed è deliberato:
 * quella funzione toglie le lettere e legge il numero come minuti, quindi
 * «400m» diventa 24.000 secondi, cioè 6h40m (BACKLOG #29). Su una scheda si
 * nota; in una riga di archivio larga 200px diventa un «400′» che nessuno
 * mette in dubbio.
 *
 * ⚠️ Il totale si dichiara solo se TUTTE le fasi parlano la stessa unità.
 * Un allenamento misto — 400m di corsa e 1 min di recupero — ha due totali
 * veri e nessuno dei due è «la lunghezza dell'allenamento»: sommarli darebbe
 * un numero plausibile e inventato, che è il caso peggiore. Lì si dice solo
 * quante fasi sono.
 */
export const riepilogoCorsa = (steps = []) => {
  let metri = 0
  let minuti = 0
  let haDistanza = false
  let haTempo = false
  let haIgnoti = false

  for (const step of steps) {
    const ripetuta = step?.type === 'repeat'
    const giriGrezzi = parseInt(step?.rounds, 10)
    const giri = ripetuta && Number.isFinite(giriGrezzi) && giriGrezzi > 0 ? giriGrezzi : 1
    const gambe = ripetuta ? [step?.runDuration, step?.recDuration] : [step?.duration]

    for (const gamba of gambe) {
      if (gamba === undefined || gamba === null || String(gamba).trim() === '') continue
      const misura = misuraDi(gamba)
      if (!misura) { haIgnoti = true; continue }
      if (misura.metri) { metri += misura.metri * giri; haDistanza = true }
      else { minuti += misura.minuti * giri; haTempo = true }
    }
  }

  return {
    fasi: steps.length,
    metri,
    minuti,
    puroDistanza: haDistanza && !haTempo && !haIgnoti,
    puroTempo: haTempo && !haDistanza && !haIgnoti,
  }
}

// I chilometri come si scrivono in italiano: «18 km», «1,2 km».
const chilometri = (metri) => {
  const km = metri / 1000
  return `${decimale(km >= 10 ? Math.round(km) : Math.round(km * 10) / 10)} km`
}

/**
 * La riga sotto il titolo: «Ven 22 · 6 blocchi · 52′».
 *
 * ⚠️ Custom ed Evento non hanno blocchi da contare né una durata da stimare:
 * lì la riga è il solo giorno. «0 blocchi · 0′» sarebbe una bugia con l'aria
 * di un dato — la stessa ragione per cui `DurataBlocco` scrive «—» invece di
 * «0:00» (CLAUDE.md §9-undecies punto 2).
 *
 * ⚠️ `giorno: false` serve al calendario, dove ogni riga sta già sotto
 * l'intestazione della data che la contiene: ripeterla lì dentro toglierebbe
 * larghezza — su 393px — proprio ai blocchi e ai minuti, che sono l'unica
 * cosa per cui si guarda quella riga. È un'opzione e non una seconda funzione
 * perché «come un workout descrive sé stesso» deve restare un punto solo: due
 * copie divergerebbero al primo ritocco (§9 punto 1).
 */
export const metaWorkout = (workout, { giorno = true } = {}) => {
  const parti = []
  if (giorno) {
    const etichetta = giornoBreve(workout?.date)
    if (etichetta) parti.push(etichetta)
  }

  const categoria = categoriaDi(workout?.sections)

  if (categoria === 'Running') {
    const r = riepilogoCorsa(workout?.sections?.steps || [])
    if (r.fasi > 0) parti.push(`${r.fasi} ${r.fasi === 1 ? 'fase' : 'fasi'}`)
    if (r.puroDistanza && r.metri > 0) parti.push(chilometri(r.metri))
    else if (r.puroTempo && r.minuti > 0) parti.push(`${Math.round(r.minuti)}′`)
  } else if (categoria !== 'Custom' && categoria !== 'Event') {
    const blocchi = getNormalizedBlocks(workout || {})
    if (blocchi.length > 0) {
      parti.push(`${blocchi.length} ${blocchi.length === 1 ? 'blocco' : 'blocchi'}`)
      const minuti = minutiStimati(riepilogoWorkout(blocchi).secondi)
      if (minuti > 0) parti.push(`${minuti}′`)
    }
  }

  return parti.join(' · ')
}

/**
 * Il testo su cui la ricerca lavora: titolo, corsia, tipi di blocco, nomi
 * degli esercizi, note e ritmi.
 *
 * Il campo prometteva già «Cerca per nome o categoria» e cercava solo quelli;
 * il placeholder ora dice «titolo, blocco, esercizio» e questa funzione è la
 * ragione per cui non è una promessa a vuoto.
 *
 * ⚠️ Nessun `.toLowerCase()` su un valore non protetto: `w.title` può essere
 * `null` sui workout anteriori al titolo automatico del 24/08/2026, e la
 * vecchia riga di filtro ci si schiantava sopra portandosi via la pagina.
 */
export const testoCercabile = (workout) => {
  const sezioni = workout?.sections || {}
  const parti = [workout?.title, categoriaDi(sezioni), corsia(categoriaDi(sezioni)).etichetta]

  for (const blocco of getNormalizedBlocks(workout || {})) {
    parti.push(blocco?.type, blocco?.notes)
    for (const esercizio of blocco?.exercises || []) parti.push(esercizio?.name, esercizio?.notes)
  }
  for (const step of sezioni.steps || []) {
    parti.push(step?.type, step?.notes, step?.pace, step?.runPace)
  }

  return parti.filter(Boolean).join(' ').toLowerCase()
}

/**
 * L'ordine dell'archivio: per data del workout, dal più recente.
 *
 * ⚠️ Prima l'ordine era `created_at` e la data MOSTRATA era un'altra: finché
 * la lista era piatta la differenza non si vedeva, ma i gruppi per mese
 * pretendono che le date siano monotone — con l'ordine di creazione lo stesso
 * mese ricomparirebbe più volte nello scroll. `created_at` resta come
 * spareggio: due workout dello stesso giorno tornano nell'ordine in cui sono
 * stati creati, il più recente in cima.
 */
export const ordinaPerData = (workouts = []) => [...workouts].sort((a, b) => {
  const da = dataValida(a?.date)
  const db = dataValida(b?.date)
  if (da && db && da.getTime() !== db.getTime()) return db - da
  // I workout senza data valida finiscono in fondo: non hanno un posto nella
  // linea del tempo, e in cima sembrerebbero i più recenti.
  if (!da && db) return 1
  if (da && !db) return -1
  return String(b?.created_at || '').localeCompare(String(a?.created_at || ''))
})

/**
 * I workout divisi per mese, già ordinati.
 *
 * L'ordinamento lo fa questa funzione, non il chiamante: chi se lo dimentica
 * non ottiene un errore, ottiene lo stesso mese stampato tre volte in punti
 * diversi dello scroll.
 */
export const raggruppaPerMese = (workouts = []) => {
  const gruppi = new Map()
  for (const w of ordinaPerData(workouts)) {
    const d = dataValida(w?.date)
    const chiave = d ? format(d, 'yyyy-MM') : 'senza-data'
    if (!gruppi.has(chiave)) {
      const etichetta = d ? format(d, 'LLLL yyyy', { locale: it }) : 'Senza data'
      gruppi.set(chiave, {
        chiave,
        etichetta: etichetta.charAt(0).toUpperCase() + etichetta.slice(1),
        workouts: [],
      })
    }
    gruppi.get(chiave).workouts.push(w)
  }
  return [...gruppi.values()]
}

/**
 * Quante corsie ci sono davvero, e con quanti workout.
 *
 * ⚠️ I chip si DERIVANO dai dati, non si scrivono a mano. La query del coach
 * esclude Custom ed Evento (`fetchWorkouts`), quindi un chip «Custom» fisso
 * sarebbe sempre a zero: un filtro che non filtra niente e che, premuto,
 * svuota la pagina. Così il chip esiste solo se c'è qualcosa dietro.
 */
export const conteggiPerCorsia = (workouts = []) => {
  const conteggi = new Map()
  for (const w of workouts) {
    const c = categoriaDi(w?.sections)
    conteggi.set(c, (conteggi.get(c) || 0) + 1)
  }
  return ORDINE_CORSIE.filter(c => conteggi.has(c)).map(c => ({ categoria: c, n: conteggi.get(c) }))
}
