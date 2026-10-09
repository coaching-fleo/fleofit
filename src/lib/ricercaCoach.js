// La ricerca del coach: gli STRUMENTI che l'IA può chiamare.
//
// 🔴 L'IA NON LEGGE IL DATABASE. Legge la domanda e risponde con «usa questo
// strumento con questi parametri»; lo strumento gira QUI, nel telefono del
// coach, sui dati che il coach può già vedere (le policy RLS valgono come
// sempre). All'IA torna solo il risultato, ridotto a quello che serve per
// rispondere. Così ogni numero detto in risposta l'ha calcolato questo file,
// non il modello: la regola «nessun numero si inventa» (CLAUDE.md §9) vale
// anche per le risposte scritte da Gemini.
//
// Sono funzioni PURE su dati già caricati, come `statisticheCoach.js`: `oggi`
// si passa sempre, così i test non dipendono dal calendario di chi li esegue.
// Il caricamento sta in fondo (`caricaDatiRicerca`), con il client iniettato.
//
// ⚠️ Schema congelato (CLAUDE.md regola 0-bis): niente indici, niente viste,
// niente funzioni SQL. Si carica una finestra di un anno e si filtra qui.

import { format, parseISO, differenceInCalendarDays, startOfDay, addDays } from 'date-fns'
import { it } from 'date-fns/locale'
import { rpeDichiarato, testoNota } from './rpe'
import { categoriaDi } from './categorie'
import { inPausa, parseNotePausa } from './pausa'
import { atletiFermi } from './statisticheCoach'
import { getNormalizedBlocks } from './timerSequence'
import { durataWorkout } from './statistiche'
import { separaCodice } from './codiceWorkout'
import { COACHING_ID } from './constants'

/** Quanto indietro si carica. Oltre, una domanda riceve «non ho dati così vecchi». */
export const GIORNI_INDIETRO = 365
/** Quanto avanti: le gare e la programmazione futura. */
export const GIORNI_AVANTI = 120
/** Righe per pagina: PostgREST ne consegna al massimo mille per richiesta. */
const PAGINA = 1000
/** Pagine al massimo. Cinquemila assegnazioni in un anno sono già molte. */
const MASSIMO_PAGINE = 5
/**
 * Quante righe di un risultato arrivano all'IA. Il totale arriva sempre: la
 * lista serve a nominarne qualcuna, non a contarle (contare lo fa il codice).
 * ⚠️ Era 25: con il ripiego su Groq (8.000 token al MINUTO sul piano gratuito)
 * una domanda sola con due giri lo superava (09/10/2026).
 */
export const MASSIMO_PER_IA = 12
/** Quanto è lungo, al massimo, un estratto di nota mandato all'IA. */
export const LUNGHEZZA_ESTRATTO = 160

const giorno = (d) => format(d, 'yyyy-MM-dd')
const dataBreve = (s) => (s ? format(parseISO(s), 'EEE d MMM', { locale: it }) : null)

/** Minuscole e senza accenti: «Nicolò» si trova scrivendo «nicolo». */
export const normalizza = (s) =>
  String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

export const nomeAtleta = (a) => [a?.name, a?.surname].filter(Boolean).join(' ').trim() || 'Atleta'

/** Una data 'yyyy-MM-dd' valida, oppure null. L'IA a volte scrive «2026-9-3». */
export function dataValida(s) {
  if (typeof s !== 'string') return null
  const m = s.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (!m) return null
  const iso = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  const d = parseISO(iso)
  return Number.isNaN(d.getTime()) ? null : iso
}

/** Un intero positivo, oppure null. */
const intero = (v) => {
  const n = typeof v === 'number' ? v : parseInt(v, 10)
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null
}

// ── Gli atleti per nome ─────────────────────────────────────────────────────

/**
 * Trova gli atleti che corrispondono a un id o a un nome.
 *
 * Torna una LISTA, non un atleta: «Marco» può essere due persone, e scegliere
 * a caso vorrebbe dire rispondere su quella sbagliata con sicurezza. Chi
 * chiama decide cosa fare di più corrispondenze — lo strumento le restituisce
 * all'IA, che chiede quale.
 */
export function risolviAtleta(atleti = [], { atleta_id, atleta } = {}) {
  if (atleta_id) {
    const perId = atleti.filter(a => a.id === atleta_id)
    if (perId.length) return perId
  }
  const cercato = normalizza(atleta)
  if (!cercato) return []
  const completi = atleti.filter(a => normalizza(nomeAtleta(a)) === cercato)
  if (completi.length) return completi
  const parole = cercato.split(/\s+/)
  return atleti.filter(a => {
    const nome = normalizza(a.name)
    const cognome = normalizza(a.surname)
    return parole.every(p => nome.startsWith(p) || cognome.startsWith(p))
  })
}

// ── Lo stato di un'assegnazione ─────────────────────────────────────────────

/**
 * «completato», «scaduto» o «da fare».
 *
 * ⚠️ Lo stato «scaduto» non esiste nel database: è un pending con la data
 * passata, la stessa lettura della Home coach. Oggi stesso NON è scaduto.
 */
export function statoAssegnazione(aw, oggi = new Date()) {
  if (aw?.status === 'completed') return 'completato'
  if (aw?.completed_date && aw.completed_date < giorno(oggi)) return 'scaduto'
  return 'da_fare'
}

// ── Il contenuto di un workout, reso cercabile ──────────────────────────────

/** I tipi di blocco (Hyrox) o di fase (corsa) di un workout. */
export function tipiDi(workout) {
  const s = workout?.sections || {}
  if (categoriaDi(s) === 'Running') return [...new Set((s.steps || []).map(st => st?.type).filter(Boolean))]
  return [...new Set(getNormalizedBlocks(workout || {}).map(b => b?.type).filter(Boolean))]
}

/** I nomi degli esercizi di un workout, nell'ordine e senza doppioni. */
export function eserciziDi(workout) {
  const nomi = []
  for (const b of getNormalizedBlocks(workout || {})) {
    for (const ex of b?.exercises || []) if (ex?.name) nomi.push(ex.name)
  }
  return [...new Set(nomi)]
}

/** Tutto il testo di un workout in cui ha senso cercare una parola. */
function testoCercabile(workout) {
  const s = workout?.sections || {}
  const pezzi = [workout?.title, workout?.coach_notes, ...tipiDi(workout), ...eserciziDi(workout)]
  for (const b of getNormalizedBlocks(workout || {})) {
    pezzi.push(b?.notes)
    for (const ex of b?.exercises || []) pezzi.push(ex?.notes)
  }
  for (const st of s.steps || []) {
    pezzi.push(st?.notes, st?.duration, st?.runDuration, st?.pace, st?.runPace)
  }
  return normalizza(pezzi.filter(Boolean).join(' '))
}

/** Vero se il testo contiene ALMENO UNA delle parole (l'IA passa anche i sinonimi). */
const contieneUna = (testo, parole) => parole.some(p => testo.includes(p))

/** Le parole cercate, normalizzate, da stringa o lista. */
const paroleDa = (v) =>
  (Array.isArray(v) ? v : String(v ?? '').split(/[,|]/)).map(normalizza).filter(p => p.length >= 2)

/** Una riga di risultato «workout», uguale per tutti gli strumenti che ne restituiscono. */
function rigaWorkout(aw, atletiPerId, oggi) {
  const w = aw.workouts || {}
  return {
    id: aw.id,
    workoutId: w.id || aw.workout_id || null,
    atletaId: aw.athlete_id,
    atleta: nomeAtleta(atletiPerId.get(aw.athlete_id) || aw.athletes),
    data: aw.completed_date || w.date || null,
    quando: dataBreve(aw.completed_date || w.date),
    titolo: separaCodice(w.title || '').nome || 'Allenamento',
    categoria: categoriaDi(w.sections),
    stato: statoAssegnazione(aw, oggi),
    rpe: rpeDichiarato(aw.notes),
    minuti: categoriaDi(w.sections) === 'Custom' || categoriaDi(w.sections) === 'Event' ? null : durataWorkout(w.sections),
  }
}

const perId = (atleti) => new Map(atleti.map(a => [a.id, a]))

/** Un errore che l'IA può leggere e girare al coach con parole sue. */
const errore = (messaggio, extra = {}) => ({ errore: messaggio, ...extra })

/** Più atleti per lo stesso nome: si restituiscono, e l'IA chiede quale. */
const ambiguo = (trovati) => errore('Più atleti corrispondono al nome: chiedi quale.', {
  // Solo i nomi: l'IA richiama lo strumento con il nome completo, che risolve
  // senza ambiguità (`risolviAtleta` prova prima la corrispondenza esatta).
  candidati: trovati.map(a => nomeAtleta(a)),
})

/** Filtra le assegnazioni per atleta, se richiesto. Torna { lista } o { errore }. */
function perAtleta(dati, args) {
  if (!args.atleta_id && !args.atleta) return { lista: dati.assegnazioni }
  const trovati = risolviAtleta(dati.atleti, args)
  if (trovati.length === 0) return { errore: errore(`Nessun atleta si chiama «${args.atleta || args.atleta_id}».`) }
  if (trovati.length > 1) return { errore: ambiguo(trovati) }
  return { atleta: trovati[0], lista: dati.assegnazioni.filter(aw => aw.athlete_id === trovati[0].id) }
}

/** Filtra per intervallo di date sulla data dell'assegnazione. */
function nelPeriodo(lista, dal, al) {
  const da = dataValida(dal)
  const a = dataValida(al)
  return lista.filter(aw => {
    const d = aw.completed_date
    if (!d) return !da && !a
    return (!da || d >= da) && (!a || d <= a)
  })
}

// ── Strumento 1: cercaWorkout ───────────────────────────────────────────────

const STATI = new Set(['completato', 'da_fare', 'scaduto'])
const CATEGORIE = new Set(['Hyrox', 'Running', 'Custom', 'Event'])

/**
 * I filtri sul CONTENUTO di un workout, uguali per le assegnazioni e per i
 * workout mai assegnati: due copie avrebbero dato risposte diverse alla
 * stessa domanda a seconda che il workout fosse assegnato o no.
 */
function filtroContenuto(args) {
  const tipo = normalizza(args.tipo_blocco)
  const esercizi = paroleDa(args.esercizio)
  const parole = paroleDa(args.testo)
  const min = intero(args.durata_min)
  const max = intero(args.durata_max)
  return (w) => {
    if (CATEGORIE.has(args.categoria) && categoriaDi(w?.sections) !== args.categoria) return false
    if (tipo && !tipiDi(w).some(t => normalizza(t) === tipo)) return false
    if (esercizi.length && !contieneUna(normalizza(eserciziDi(w).join(' | ')), esercizi)) return false
    if (parole.length && !contieneUna(testoCercabile(w), parole)) return false
    if (min != null || max != null) {
      const cat = categoriaDi(w?.sections)
      if (cat === 'Custom' || cat === 'Event') return false
      const m = durataWorkout(w?.sections)
      if ((min != null && m < min) || (max != null && m > max)) return false
    }
    return true
  }
}

/** Una riga «workout» per un workout che nessun atleta ha mai ricevuto. */
function rigaNonAssegnato(w) {
  const cat = categoriaDi(w.sections)
  return {
    id: `w-${w.id}`,
    workoutId: w.id,
    atletaId: null,
    atleta: null,
    data: w.date || null,
    quando: dataBreve(w.date),
    titolo: separaCodice(w.title || '').nome || 'Allenamento',
    categoria: cat,
    stato: 'non_assegnato',
    rpe: null,
    minuti: cat === 'Custom' || cat === 'Event' ? null : durataWorkout(w.sections),
  }
}

/**
 * Le assegnazioni, e anche i workout MAI assegnati.
 *
 * ⚠️ Fino al 09/10/2026 la ricerca partiva solo dalle assegnazioni, e un
 * workout creato e mai dato a nessuno — una bozza, un modello da riusare —
 * non esisteva per lei. Ora entra con `stato: 'non_assegnato'`, ma solo
 * quando la domanda non parla di un atleta o di uno stato di esecuzione:
 * «i workout di Sofia» o «quelli scaduti» non possono contenerlo.
 */
export function cercaWorkout(dati, args = {}, oggi = new Date()) {
  const base = perAtleta(dati, args)
  if (base.errore) return base.errore
  const passa = filtroContenuto(args)
  const atletiPerId = perId(dati.atleti)

  let righe = []
  if (args.stato !== 'non_assegnato') {
    let lista = nelPeriodo(base.lista, args.dal, args.al)
    if (STATI.has(args.stato)) lista = lista.filter(aw => statoAssegnazione(aw, oggi) === args.stato)
    lista = lista.filter(aw => passa(aw.workouts))

    // Un workout assegnato a sei atleti è un workout solo, se si cerca cosa
    // RIUSARE: `distinti` tiene la prima assegnazione di ognuno.
    if (args.distinti) {
      const visti = new Set()
      lista = lista.filter(aw => {
        const id = aw.workouts?.id || aw.workout_id
        if (!id || visti.has(id)) return false
        visti.add(id)
        return true
      })
    }
    righe = lista.map(aw => rigaWorkout(aw, atletiPerId, oggi))
  }

  const conNonAssegnati = !base.atleta && (!args.stato || args.stato === 'non_assegnato')
  if (conNonAssegnati) {
    const da = dataValida(args.dal)
    const a = dataValida(args.al)
    const assegnati = dati.assegnati || new Set()
    for (const w of dati.workouts || []) {
      if (!w?.id || assegnati.has(w.id)) continue
      if ((da || a) && (!w.date || (da && w.date < da) || (a && w.date > a))) continue
      if (passa(w)) righe.push(rigaNonAssegnato(w))
    }
  }

  const vecchiPrima = args.ordine === 'vecchi'
  righe.sort((x, y) => {
    const c = String(x.data || '').localeCompare(String(y.data || ''))
    return vecchiPrima ? c : -c
  })
  return { totale: righe.length, risultati: righe }
}

// ── Strumento 2: cercaAtleti ────────────────────────────────────────────────

/**
 * Gli atleti che rispondono a una o più condizioni, tutte insieme (AND).
 *
 * ⚠️ Chi è in pausa è ESCLUSO da «inattivi» e da «senza programma», come in
 * Home: è la stessa decisione (§9-decies), e qui sbagliarla vorrebbe dire
 * suggerire di chiamare chi ha chiesto di non essere chiamato. Si chiede
 * esplicitamente con `in_pausa: true`.
 */
export function cercaAtleti(dati, args = {}, oggi = new Date()) {
  const oggiStr = giorno(oggi)
  let atleti = [...dati.atleti]
  const dettagli = new Map(atleti.map(a => [a.id, {}]))
  const nota = (id, chiave, valore) => { dettagli.get(id)[chiave] = valore }

  if (args.in_pausa === true) {
    atleti = atleti.filter(inPausa)
    for (const a of atleti) nota(a.id, 'inPausaDal', parseNotePausa(a.notes).dal)
  } else if (args.in_pausa === false) {
    atleti = atleti.filter(a => !inPausa(a))
  }

  const soglia = intero(args.inattivi_da_giorni)
  if (soglia != null) {
    const fermi = new Map(atletiFermi(atleti, dati.assegnazioni, { soglia, finestra: GIORNI_INDIETRO, oggi }).map(f => [f.id, f]))
    atleti = atleti.filter(a => fermi.has(a.id))
    for (const a of atleti) {
      const f = fermi.get(a.id)
      // ⚠️ `oltre` = nessun completamento nell'anno caricato: NON «fermo da
      // 365 giorni», che sarebbe un numero preciso e falso (stessa trappola
      // di `atletiFermi`). Si dice com'è, con un campo a parte.
      if (f.oltre) nota(a.id, 'nessunCompletatoNellAnno', true)
      else {
        nota(a.id, 'ultimoCompletato', f.ultimo)
        nota(a.id, 'giorniFermo', f.giorni)
      }
    }
  }

  const senza = intero(args.senza_programma_giorni)
  if (senza != null && senza > 0) {
    const fine = giorno(addDays(startOfDay(oggi), senza - 1))
    const coperti = new Set(dati.assegnazioni
      .filter(aw => aw.completed_date >= oggiStr && aw.completed_date <= fine)
      .map(aw => aw.athlete_id))
    atleti = atleti.filter(a => !inPausa(a) && !coperti.has(a.id))
    // Il motivo va scritto sulla riga: senza, «niente in programma» e «fermo»
    // si leggono uguali — ed è esattamente lo scambio che l'IA ha fatto il
    // 09/10/2026, rispondendo «non si allenano» con questo filtro.
    for (const a of atleti) nota(a.id, 'senzaProgrammaGiorni', senza)
  }

  const garaEntro = intero(args.gara_entro_giorni)
  if (garaEntro != null) {
    const fine = giorno(addDays(startOfDay(oggi), garaEntro))
    const gare = new Map()
    for (const aw of dati.assegnazioni) {
      if (categoriaDi(aw.workouts?.sections) !== 'Event') continue
      if (!aw.completed_date || aw.completed_date < oggiStr || aw.completed_date > fine) continue
      const prima = gare.get(aw.athlete_id)
      if (!prima || aw.completed_date < prima.completed_date) gare.set(aw.athlete_id, aw)
    }
    atleti = atleti.filter(a => gare.has(a.id))
    for (const a of atleti) {
      const g = gare.get(a.id)
      nota(a.id, 'gara', separaCodice(g.workouts?.title || '').nome || 'Gara')
      nota(a.id, 'dataGara', g.completed_date)
      nota(a.id, 'fraGiorni', differenceInCalendarDays(parseISO(g.completed_date), startOfDay(oggi)))
    }
  }

  const rpeMin = intero(args.rpe_minimo)
  if (rpeMin != null) {
    const giorni = intero(args.rpe_ultimi_giorni) || 7
    const da = giorno(addDays(startOfDay(oggi), -giorni))
    const massimi = new Map()
    for (const aw of dati.assegnazioni) {
      if (aw.status !== 'completed' || !aw.completed_date || aw.completed_date < da || aw.completed_date > oggiStr) continue
      const r = rpeDichiarato(aw.notes)
      if (r == null || r < rpeMin) continue
      const prima = massimi.get(aw.athlete_id)
      if (!prima || r > prima.rpe) massimi.set(aw.athlete_id, { rpe: r, data: aw.completed_date })
    }
    atleti = atleti.filter(a => massimi.has(a.id))
    for (const a of atleti) {
      nota(a.id, 'rpeMassimo', massimi.get(a.id).rpe)
      nota(a.id, 'dataRpe', massimi.get(a.id).data)
    }
  }

  const risultati = atleti
    .map(a => ({ atletaId: a.id, atleta: nomeAtleta(a), foto: a.photo_url || null, inPausa: inPausa(a), ...dettagli.get(a.id) }))
    .sort((x, y) => x.atleta.localeCompare(y.atleta))
  return { totale: risultati.length, risultati }
}

// ── Strumento 3: statisticheAtleta ──────────────────────────────────────────

/**
 * I numeri di un atleta su un periodo. Default: gli ultimi 30 giorni.
 *
 * 🔴 L'RPE medio si fa SOLO sugli RPE dichiarati (`rpeDichiarato`), e quanti
 * sono lo si dice: una media di due valori non è una media di venti.
 */
export function statisticheAtleta(dati, args = {}, oggi = new Date()) {
  if (!args.atleta_id && !args.atleta) return errore('Serve il nome di un atleta.')
  const base = perAtleta(dati, args)
  if (base.errore) return base.errore
  const al = dataValida(args.al) || giorno(oggi)
  const dal = dataValida(args.dal) || giorno(addDays(parseISO(al), -29))
  const lista = nelPeriodo(base.lista, dal, al)

  const completati = lista.filter(aw => aw.status === 'completed')
  const rpe = completati.map(aw => rpeDichiarato(aw.notes)).filter(r => r != null)
  const perCategoria = {}
  for (const aw of completati) {
    const c = categoriaDi(aw.workouts?.sections)
    perCategoria[c] = (perCategoria[c] || 0) + 1
  }
  const minuti = completati.reduce((tot, aw) => {
    const c = categoriaDi(aw.workouts?.sections)
    return c === 'Custom' || c === 'Event' ? tot : tot + durataWorkout(aw.workouts?.sections)
  }, 0)
  const ultimo = base.lista
    .filter(aw => aw.status === 'completed' && aw.completed_date && aw.completed_date <= giorno(oggi))
    .reduce((m, aw) => (!m || aw.completed_date > m ? aw.completed_date : m), null)

  return {
    atletaId: base.atleta.id,
    atleta: nomeAtleta(base.atleta),
    dal, al,
    inPausa: inPausa(base.atleta),
    assegnati: lista.length,
    completati: completati.length,
    scaduti: lista.filter(aw => statoAssegnazione(aw, oggi) === 'scaduto').length,
    daFare: lista.filter(aw => statoAssegnazione(aw, oggi) === 'da_fare').length,
    percentuale: lista.length ? Math.round((completati.length / lista.length) * 100) : null,
    rpeMedio: rpe.length ? Math.round((rpe.reduce((a, b) => a + b, 0) / rpe.length) * 10) / 10 : null,
    rpeDichiarati: rpe.length,
    rpeMassimo: rpe.length ? Math.max(...rpe) : null,
    minutiStimati: completati.length ? minuti : null,
    perCategoria,
    ultimoCompletato: ultimo,
  }
}

// ── Strumento 4: cercaNelleNote ─────────────────────────────────────────────

/** Il pezzo di testo intorno alla prima parola trovata. */
export function estratto(testo, parole, lunghezza = LUNGHEZZA_ESTRATTO) {
  const pulito = String(testo || '').replace(/\s+/g, ' ').trim()
  if (pulito.length <= lunghezza) return pulito
  // ⚠️ `normalizza` tiene la stessa lunghezza del testo (in NFC): un accento
  // tolto è un carattere che resta, quindi le posizioni coincidono.
  const norm = normalizza(pulito)
  const trovate = parole.map(p => norm.indexOf(p)).filter(i => i >= 0)
  const pos = trovate.length ? Math.min(...trovate) : 0
  const inizio = Math.max(0, Math.min(pos - Math.floor(lunghezza / 3), pulito.length - lunghezza))
  return `${inizio > 0 ? '…' : ''}${pulito.slice(inizio, inizio + lunghezza).trim()}${inizio + lunghezza < pulito.length ? '…' : ''}`
}

/**
 * Le note scritte dagli atleti alla chiusura di un allenamento che contengono
 * almeno una delle parole.
 *
 * ⚠️ Solo le note SCRITTE. Le note vocali sono file audio, e senza una colonna
 * dove salvare la trascrizione (schema congelato) bisognerebbe trascriverle
 * tutte a ogni domanda. Lo strumento lo dice nel risultato, così l'IA non
 * risponde «nessuno ne ha parlato» quando non ha ascoltato.
 */
export function cercaNelleNote(dati, args = {}, oggi = new Date()) {
  const parole = paroleDa(args.parole ?? args.testo)
  if (!parole.length) return errore('Servono una o più parole da cercare.')
  const base = perAtleta(dati, args)
  if (base.errore) return base.errore
  const lista = nelPeriodo(base.lista, args.dal, args.al)
  const atletiPerId = perId(dati.atleti)

  const risultati = lista
    .map(aw => ({ aw, testo: testoNota(aw.notes) }))
    .filter(({ testo }) => testo && contieneUna(normalizza(testo), parole))
    .sort((x, y) => String(y.aw.completed_date || '').localeCompare(String(x.aw.completed_date || '')))
    .map(({ aw, testo }) => ({ ...rigaWorkout(aw, atletiPerId, oggi), nota: estratto(testo, parole) }))

  const vocali = lista.filter(aw => aw.voice_note_url && !String(aw.voice_note_url).includes('#deleted=')).length
  return {
    totale: risultati.length,
    risultati,
    avviso: vocali ? `Ci sono anche ${vocali} note vocali nel periodo: non sono state ascoltate.` : undefined,
  }
}

// ── Strumento 5: apri ───────────────────────────────────────────────────────

/** Le schermate che il coach può chiedere di aprire, e dove portano. */
export const SCHERMATE = [
  'scheda_atleta', 'report_atleta', 'report_settimanale', 'workout', 'crea_workout',
  'calendario', 'archivio', 'atleti', 'impostazioni',
]

export function apri(dati, args = {}) {
  const s = args.schermata
  if (!SCHERMATE.includes(s)) return errore(`Schermata sconosciuta: ${s}`)

  let atleta = null
  if (args.atleta_id || args.atleta) {
    const trovati = risolviAtleta(dati.atleti, args)
    if (trovati.length === 0) return errore(`Nessun atleta si chiama «${args.atleta || args.atleta_id}».`)
    if (trovati.length > 1) return ambiguo(trovati)
    atleta = trovati[0]
  }
  const serveAtleta = ['scheda_atleta', 'report_atleta'].includes(s)
  if (serveAtleta && !atleta) return errore('Serve il nome dell\'atleta.')

  let percorso
  switch (s) {
    case 'scheda_atleta': percorso = `/athletes/${atleta.id}`; break
    case 'report_atleta': percorso = `/report/${atleta.id}`; break
    case 'report_settimanale': percorso = '/report'; break
    case 'calendario': percorso = '/calendar'; break
    case 'archivio': percorso = '/archive'; break
    case 'atleti': percorso = '/athletes'; break
    case 'impostazioni': percorso = '/settings'; break
    case 'workout': {
      const wid = args.workout_id
      if (!wid) return errore('Serve il workout_id, preso da un risultato di cercaWorkout.')
      const aw = dati.assegnazioni.find(x => (x.workouts?.id || x.workout_id) === wid && (!atleta || x.athlete_id === atleta.id))
      const aid = atleta?.id || aw?.athlete_id
      percorso = `/workout/${wid}${aid ? `?athlete_id=${aid}` : ''}`
      break
    }
    case 'crea_workout': {
      const q = new URLSearchParams()
      if (atleta) q.set('athlete_id', atleta.id)
      const d = dataValida(args.data)
      if (d) q.set('date', d)
      percorso = `/create${q.toString() ? `?${q}` : ''}`
      break
    }
  }
  return { percorso, atleta: atleta ? nomeAtleta(atleta) : undefined }
}

// ── Il dispatcher ───────────────────────────────────────────────────────────

/** Una riga di risultato senza quello che all'IA non serve. */
/**
 * Quello che all'IA non serve per scrivere una frase, e che costa token: la
 * foto, l'id dell'assegnazione, l'id dell'atleta (36 caratteri che l'IA non
 * usa: gli atleti li nomina e lo strumento li ritrova dal nome) e la data in
 * forma leggibile, che è un doppione di `data`. Resta `workoutId`, che serve
 * ad `apri` per aprire un workout trovato.
 */
const CAMPI_SOLO_APP = ['foto', 'id', 'atletaId', 'quando']
const perLIA = (riga) => {
  const copia = { ...riga }
  for (const c of CAMPI_SOLO_APP) delete copia[c]
  return copia
}

const STRUMENTI = { cercaWorkout, cercaAtleti, statisticheAtleta, cercaNelleNote, apri }

/**
 * Esegue uno strumento chiesto dall'IA.
 *
 * Torna `{ completo, perIA }`: il primo va all'interfaccia (tutte le righe,
 * per la lista toccabile), il secondo all'IA (le prime `MASSIMO_PER_IA`,
 * senza foto, con il totale). Uno strumento che esplode non fa esplodere la
 * ricerca: diventa un errore che l'IA può raccontare.
 */
export function eseguiStrumento(nome, args, dati, oggi = new Date()) {
  const fn = STRUMENTI[nome]
  if (!fn) {
    const r = errore(`Strumento sconosciuto: ${nome}`)
    return { completo: r, perIA: r }
  }
  let completo
  try {
    completo = fn(dati, args && typeof args === 'object' ? args : {}, oggi)
  } catch (e) {
    completo = errore(`Lo strumento ${nome} non è riuscito: ${e?.message || e}`)
  }
  const perIA = Array.isArray(completo?.risultati)
    ? {
        ...completo,
        // Foto e id dell'assegnazione non servono a scrivere una frase.
        risultati: completo.risultati.slice(0, MASSIMO_PER_IA).map(perLIA),
        ...(completo.risultati.length > MASSIMO_PER_IA ? { mostrati: MASSIMO_PER_IA } : {}),
      }
    : completo && typeof completo === 'object' ? perLIA(completo) : completo
  return { completo, perIA }
}

// ── Il caricamento ──────────────────────────────────────────────────────────

/**
 * Atleti e assegnazioni di un anno, una volta sola all'apertura della ricerca.
 *
 * ⚠️ L'account del coach si toglie come in Home e in Athletes.jsx
 * (`COACHING_ID`): altrimenti comparirebbe fra i propri atleti fermi.
 */
export async function caricaDatiRicerca(supabase, oggi = new Date()) {
  const dal = giorno(addDays(startOfDay(oggi), -GIORNI_INDIETRO))
  const al = giorno(addDays(startOfDay(oggi), GIORNI_AVANTI))

  const atletiRes = await supabase.from('athletes')
    .select('id, name, surname, photo_url, notes')
    .is('deleted_at', null)
  if (atletiRes.error) throw new Error(atletiRes.error.message)

  // Tre letture a pagine, in parallelo:
  //  • i workout, TUTTI: anche quelli mai assegnati (le bozze, i modelli);
  //  • le assegnazioni dell'anno, senza il join su `sections` — il workout lo
  //    si attacca qui dalla mappa, invece di scaricarlo una volta per atleta;
  //  • gli id di TUTTI i workout mai assegnati, senza finestra: senza, un
  //    workout dato a qualcuno due anni fa risulterebbe «non assegnato».
  const [workouts, assegnazioni, usati] = await Promise.all([
    aPagine(() => supabase.from('workouts')
      .select('id, title, date, sections, coach_notes')
      .order('date', { ascending: false })),
    aPagine(() => supabase.from('athlete_workouts')
      .select('id, athlete_id, workout_id, completed_date, status, notes, voice_note_url')
      .gte('completed_date', dal)
      .lte('completed_date', al)
      .order('completed_date', { ascending: false })),
    aPagine(() => supabase.from('athlete_workouts').select('workout_id'), MASSIMO_PAGINE * 4),
  ])

  const perIdWorkout = new Map(workouts.map(w => [w.id, w]))
  const atleti = (atletiRes.data || []).filter(a => a.id !== COACHING_ID)
  const ammessi = new Set(atleti.map(a => a.id))
  return {
    atleti,
    workouts,
    assegnati: new Set(usati.map(r => r.workout_id).filter(Boolean)),
    assegnazioni: assegnazioni
      .filter(aw => ammessi.has(aw.athlete_id))
      .map(aw => ({ ...aw, workouts: perIdWorkout.get(aw.workout_id) || aw.workouts || null })),
    dal,
    al,
  }
}

/** Legge una query a pagine da `PAGINA` righe, fino a `massimo` pagine. */
async function aPagine(query, massimo = MASSIMO_PAGINE) {
  const righe = []
  for (let p = 0; p < massimo; p++) {
    const { data, error } = await query().range(p * PAGINA, (p + 1) * PAGINA - 1)
    if (error) throw new Error(error.message)
    righe.push(...(data || []))
    if (!data || data.length < PAGINA) break
  }
  return righe
}
