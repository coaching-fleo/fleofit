// Il riassunto dei feedback che arriva all'IA, e gli allarmi (spec §6.2–§6.3).
//
// Lo fa il CODICE: all'IA arrivano numeri, non le note intere (meno token,
// meno dati personali). Un dato che non c'è resta `null`, mai zero: un
// utente appena iscritto non ha «aderenza 0%», non ha ancora un'aderenza.
// L'RPE si legge SOLO con `rpeDichiarato` (CLAUDE.md §9).

import { rpeDichiarato, testoNota } from '../rpe.js'
import { rpeAtteso } from '../stimaWorkout.js'
import { punteggio } from '../comeStai.js'

export const PAROLE_DOLORE = ['dolore', 'male', 'fitta', 'infortun', 'strappo', 'tendin', 'gonfio']

// Si cerca la PAROLA, non le lettere: «normale» e «animale» contengono «male».
// Ogni voce vale come inizio di parola senza l'ultima vocale («dolori», «fitte»,
// «gonfiore»); «male» solo intera («male», «mali»). E una negazione subito
// prima la spegne: «nessun dolore», «senza fitte», «non ho male», «non mi fa male».
// Nel dubbio si avvisa: perdersi un dolore vero costa più di una domanda in più.
const NEGAZIONI = ['nessun', 'nessuno', 'nessuna', 'niente', 'senza', 'zero']
const eDolore = (parola) => PAROLE_DOLORE.some(p => (p === 'male'
  ? /^mal[ei]$/.test(parola)
  : parola.startsWith(/[aeiou]$/.test(p) ? p.slice(0, -1) : p)))
const negata = (t, i) => NEGAZIONI.includes(t[i - 1]) || NEGAZIONI.includes(t[i - 2]) ||
  (t[i - 2] === 'non' && t[i - 1] === 'ho') || (t[i - 3] === 'non' && t[i - 2] === 'mi' && t[i - 1] === 'fa')

/** C'è una parola di dolore non negata nella nota? */
export function parlaDiDolore(testo) {
  const t = (testo || '').toLowerCase().split(/[^a-zàèéìòù]+/).filter(Boolean)
  return t.some((parola, i) => eDolore(parola) && !negata(t, i))
}

const GIORNO_MS = 24 * 60 * 60 * 1000
const giornoDi = (oggi, meno = 0) => new Date(Date.UTC(oggi.getUTCFullYear(), oggi.getUTCMonth(), oggi.getUTCDate()) - meno * GIORNO_MS)
  .toISOString().slice(0, 10)
const media = (valori) => (valori.length ? valori.reduce((t, v) => t + v, 0) / valori.length : null)
const unDecimale = (n) => (n === null ? null : Math.round(n * 10) / 10)
const fatta = (s) => s.status === 'completed'

/** Le sedute passate (prima di oggi), dalla più vecchia alla più recente. */
const passate = (sedute, oggi) => {
  const oggiStr = giornoDi(oggi)
  return (sedute || []).filter(s => s.data < oggiStr).sort((a, b) => a.data.localeCompare(b.data))
}

function aderenza(sedute, oggi, giorni) {
  const da = giornoDi(oggi, giorni)
  const finestra = passate(sedute, oggi).filter(s => s.data >= da)
  return finestra.length ? finestra.filter(fatta).length / finestra.length : null
}

// Una risposta saltata è null e resta fuori dalla media (come in comeStai.js):
// contarla 0 farebbe «stare male» chi ha solo saltato una domanda.
const mediaComeStai = (c) => punteggio(c)

export function riassuntoFeedback({ sedute = [], comeStai = [], oggi }) {
  const prima = passate(sedute, oggi)
  const scarti = prima.filter(fatta)
    .map(s => ({ dich: rpeDichiarato(s.notes), atteso: rpeAtteso(s.blocks || []) }))
    .filter(x => x.dich !== null && x.atteso !== null)
    .slice(-4)
    .map(x => x.dich - x.atteso)
  const da28 = giornoDi(oggi, 28)
  const recenti = prima.filter(s => fatta(s) && s.data >= da28)
  const da7 = giornoDi(oggi, 7)
  return {
    aderenza7: aderenza(sedute, oggi, 7),
    aderenza28: aderenza(sedute, oggi, 28),
    rpeScarto: unDecimale(media(scarti)),
    carichi: { meno: recenti.filter(s => s.carichi === 'meno').length, piu: recenti.filter(s => s.carichi === 'piu').length },
    comeStaiMedia: unDecimale(media((comeStai || []).filter(c => c.data >= da7).map(mediaComeStai).filter(v => v !== null))),
    sedutePassate: prima.length,
  }
}

export function allarmi({ sedute = [], comeStai = [], oggi }) {
  const fuori = []
  const cs = [...(comeStai || [])].sort((a, b) => b.data.localeCompare(a.data))
  if (cs.length >= 2 && cs[0].data >= giornoDi(oggi, 2)) {
    const consecutivi = (new Date(cs[0].data) - new Date(cs[1].data)) === GIORNO_MS
    const basso = (c) => { const v = mediaComeStai(c); return v !== null && v <= 2 }
    if (consecutivi && basso(cs[0]) && basso(cs[1])) fuori.push('come_stai_basso')
  }

  const prima = passate(sedute, oggi)
  const ultime2 = prima.slice(-2)
  if (ultime2.length === 2 && ultime2.every(s => !fatta(s))) fuori.push('due_saltate')

  const ultima = prima.filter(fatta).at(-1)
  if (ultima) {
    const dich = rpeDichiarato(ultima.notes)
    const atteso = rpeAtteso(ultima.blocks || [])
    if (dich !== null && atteso !== null && dich >= 9 && atteso <= 7) fuori.push('rpe_alto')
    if (parlaDiDolore(testoNota(ultima.notes))) fuori.push('dolore')
  }
  return fuori
}
