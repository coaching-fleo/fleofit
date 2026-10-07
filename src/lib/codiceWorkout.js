// Il codice che segue ogni titolo.
//
//     Falco Implacabile · EM+FT 55′ @8
//     Gambe dure        · RIP 50′ @8
//     Tempesta Gialla   · CL 12K @5
//
// Il nome davanti è quello scritto dal coach o, se manca, uno casuale
// (`nomeCasuale.js`). Fino al 07/10/2026 nasceva dagli esercizi: si ripeteva
// a ogni workout ricreato con gli stessi esercizi.
//
// Il codice dice tre cose, sempre nello stesso ordine: COSA (la struttura del
// lavoro centrale), QUANTO DURA, QUANTO È DURO. Serve al coach a colpo d'occhio,
// nell'archivio e ovunque si legga un titolo.
//
// 🔴 Il codice si SALVA dentro `workouts.title` (decisione del committente,
// 05/10/2026): il titolo è letto in decine di punti — archivio, PDF, storia, TV,
// testo delle push, la web app su `main` — e così il codice compare ovunque
// senza toccare quelle schermate. Il prezzo: chi modifica i blocchi dalla web
// app lascia il codice vecchio finché non si risalva dall'app.
//
// ⚠️ La forma del codice è un CONTRATTO: `separaCodice` lo riconosce in coda al
// titolo per toglierlo prima di rigenerarlo. Chi cambia le sigle o il
// separatore deve cambiare anche `CODICE_IN_CODA`, o i titoli si ritroveranno
// con due codici in fila.

import { durataBlocco, rpeAtteso } from './stimaWorkout'
import { riepilogoCorsa } from './rigaArchivio'
import { durataWorkout } from './statistiche'

/** Le sigle dei blocchi di lavoro. Cash In/Out, WarmUp e Rest non hanno sigla: sono la cornice di quasi ogni seduta. */
export const SIGLA_BLOCCO = {
  'EMOM': 'EM',
  'AMRAP': 'AM',
  'For Time': 'FT',
  'ON/OFF': 'OO',
  'Interval': 'IN',
}

/** Le sigle della corsa. */
export const SIGLA_CORSA = { continua: 'CL', ripetute: 'RIP', progressivo: 'PR' }

/** Oltre questo numero di blocchi di lavoro il codice smette di leggersi: si scrive «+N». */
export const MASSIMO_SIGLE = 3

export const SEPARATORE_CODICE = ' · '

const SIGLE = [...Object.values(SIGLA_BLOCCO), ...Object.values(SIGLA_CORSA)].join('|')
// struttura? durata? intensità? — ma almeno un pezzo, sempre in coda al titolo.
const STRUTTURA = `(?:${SIGLE})(?:\\+(?:${SIGLE}|\\d+))*`
const DURATA = '\\d+(?:,\\d)?(?:′|K)'
const INTENSITA = '@\\d+'
const CODICE_IN_CODA = new RegExp(
  ` · (?:${STRUTTURA}(?: ${DURATA})?(?: ${INTENSITA})?|${DURATA}(?: ${INTENSITA})?|${INTENSITA})$`
)

/** I minuti come si leggono in un codice: esatti sotto i 10, arrotondati a 5 sopra. */
export const minutiCodice = (minuti) => {
  if (!Number.isFinite(minuti) || minuti <= 0) return null
  if (minuti < 10) return Math.max(1, Math.round(minuti))
  return Math.round(minuti / 5) * 5
}

const intensitaValida = (v) => {
  const n = parseFloat(v)
  return Number.isFinite(n) && n >= 1 && n <= 10 ? Math.round(n) : null
}

const componi = (pezzi) => pezzi.filter(Boolean).join(' ')

// ── Hyrox ───────────────────────────────────────────────────────────────────

const struttureHyrox = (blocks) => {
  const sigle = blocks.filter(b => SIGLA_BLOCCO[b?.type]).map(b => SIGLA_BLOCCO[b.type])
  if (sigle.length <= MASSIMO_SIGLE) return sigle.join('+')
  return `${sigle.slice(0, MASSIMO_SIGLE).join('+')}+${sigle.length - MASSIMO_SIGLE}`
}

/**
 * Il codice di un workout Hyrox.
 *
 * ⚠️ L'intensità è l'RPE ATTESO del builder — lo stesso numero che il coach
 * legge nel riepilogo, dagli esercizi — e solo se manca si ripiega
 * sull'intensità dichiarata. Non il contrario: il cursore dell'intensità
 * dichiarata nasce a 5, quindi messo davanti scriverebbe «@5» su qualunque
 * workout in cui il coach non l'ha toccato.
 */
export const codiceHyrox = (blocks = [], intensitaDichiarata) => {
  if (!blocks.length) return ''
  const secondi = blocks.reduce((t, b) => t + durataBlocco(b), 0)
  const minuti = minutiCodice(secondi / 60)
  const rpe = intensitaValida(rpeAtteso(blocks)) ?? intensitaValida(intensitaDichiarata)
  return componi([struttureHyrox(blocks), minuti && `${minuti}′`, rpe && `@${rpe}`])
}

// ── Corsa ───────────────────────────────────────────────────────────────────

const fasiCorsa = (steps = []) => steps.filter(s => s && (s.type === 'run'))

export const strutturaCorsa = (steps = []) => {
  if (steps.some(s => s?.type === 'repeat')) return 'ripetute'
  const intensita = fasiCorsa(steps).map(s => intensitaValida(s.intensity))
  if (intensita.length >= 2 && intensita.every((v, i) => v !== null && (i === 0 || v > intensita[i - 1]))) {
    return 'progressivo'
  }
  return 'continua'
}

const intensitaCorsa = (steps = []) => {
  const valori = steps
    .filter(s => s?.type === 'run' || s?.type === 'repeat')
    .map(s => intensitaValida(s.type === 'repeat' ? s.runIntensity : s.intensity))
    .filter(v => v !== null)
  if (!valori.length) return null
  return Math.max(...valori)
}

const chilometriCodice = (metri) => {
  const km = metri / 1000
  return km >= 10 ? Math.round(km) : Math.round(km * 10) / 10
}

/**
 * Il codice di una corsa.
 *
 * ⚠️ Su una corsa tutta a DISTANZA si dichiarano i km («12K»), non dei minuti
 * dedotti da un passo che nessuno ha scritto. Una corsa a tempo dice i suoi
 * minuti; una mista (400m di corsa, 1 min di recupero) dice la stima di
 * `durataWorkout`, la stessa della Home.
 * ⚠️ L'intensità è quella della fase più dura: su un lavoro a ripetute la media
 * con il riscaldamento direbbe un allenamento facile che non lo è.
 */
export const codiceCorsa = (steps = [], intensitaDichiarata) => {
  if (!steps.length) return ''
  const r = riepilogoCorsa(steps)
  let durata = null
  if (r.puroDistanza && r.metri > 0) durata = `${String(chilometriCodice(r.metri)).replace('.', ',')}K`
  else if (r.metri > 0 || r.minuti > 0) {
    const m = minutiCodice(r.puroTempo ? r.minuti : durataWorkout({ category: 'Running', steps }))
    durata = m && `${m}′`
  }
  const rpe = intensitaCorsa(steps) ?? intensitaValida(intensitaDichiarata)
  return componi([SIGLA_CORSA[strutturaCorsa(steps)], durata, rpe && `@${rpe}`])
}

// ── Il titolo intero ────────────────────────────────────────────────────────

/** Il codice di un workout in costruzione. Custom ed Evento non ne hanno. */
export const codiceWorkout = ({ category, blocks = [], steps = [], intensity } = {}) => {
  if (category === 'Hyrox') return codiceHyrox(blocks, intensity)
  if (category === 'Running') return codiceCorsa(steps, intensity)
  return ''
}

/** Toglie il codice dalla coda di un titolo: «Sled · EM 24′ @8» → { nome: 'Sled', codice: 'EM 24′ @8' }. */
export const separaCodice = (titolo) => {
  const t = String(titolo ?? '')
  const m = t.match(CODICE_IN_CODA)
  if (!m || m.index === 0) return { nome: t.trim(), codice: '' }
  return { nome: t.slice(0, m.index).trim(), codice: m[0].slice(SEPARATORE_CODICE.length) }
}

/** «Nome · CODICE», o il solo nome quando il codice non c'è. */
export const unisciCodice = (nome, codice) =>
  [String(nome ?? '').trim(), codice].filter(Boolean).join(SEPARATORE_CODICE)
