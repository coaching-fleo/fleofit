// Garmin · la sezione «Recupero» della scheda atleta (26/11/2026): tutto quello
// che `CardRecupero` mostra, già calcolato. Logica pura.
// Spec: docs/superpowers/specs/2026-11-26-recupero-garmin-scheda-design.md
//
// ⚠️ Sta in un file suo e non in `recuperoGarmin.js` apposta: quello è importato
// in modo statico dalla Home e finisce nel chunk `index` (CLAUDE.md §2); questo
// lo usano solo la scheda atleta e la card, che sono pigre.
import {
  segnaliRecupero, oggiItalia, aggiungiGiorni, valoriPer, riferimentoPrima, numero, metrica,
  GIORNI_RIFERIMENTO, FILA_MASSIMA, MINIMO_GIORNI, ORE_SONNO,
} from './recuperoGarmin'
import { DOMANDE, parolaRisposta } from './comeStai'


/** Quanti giorni legge la scheda: 28 di riferimento più la fila più lunga (14). */
export const GIORNI_LETTURA = GIORNI_RIFERIMENTO + FILA_MASSIMA
const NOTTI_COLONNINE = 7

// Le quattro tessere piccole. Solo hrv e fc hanno un segnale: bb e stress non
// si tingono mai (nessuna soglia inventata).
const TESSERE = [
  { chiave: 'hrv', leggi: r => r.hrv?.media_notte },
  { chiave: 'fc', leggi: r => r.giornata?.fc_riposo },
  // Una ricarica di 0 è l'orologio tolto: un dato che manca, non uno zero da mostrare.
  { chiave: 'bb', leggi: r => (r.giornata?.body_battery_carica > 0 ? r.giornata.body_battery_carica : null) },
  { chiave: 'stress', leggi: r => r.giornata?.stress_medio },
]
const FASI = [['profondo', 'profondo_min'], ['rem', 'rem_min'], ['leggero', 'leggero_min'], ['sveglio', 'sveglio_min']]
const GIORNI_SETTIMANA = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab']

/** «stanotte» per oggi o ieri, se no il giorno breve: «lun 26». */
export function etichettaGiorno(giorno, oggi = new Date()) {
  const fine = oggiItalia(oggi)
  if (giorno >= aggiungiGiorni(fine, -1)) return 'stanotte'
  const [a, m, g] = giorno.split('-').map(Number)
  return `${GIORNI_SETTIMANA[new Date(Date.UTC(a, m - 1, g)).getUTCDay()]} ${g}`
}

/** Quanti valori ci sono nei 28 giorni prima di `inizio`: il progresso verso la media. */
function quantiPrima(valori, inizio) {
  let n = 0
  for (let i = 1; i <= GIORNI_RIFERIMENTO; i++) if (valori.has(aggiungiGiorni(inizio, -i))) n++
  return n
}

const ultimoGiorno = (valori, fine) => [...valori.keys()].filter(g => g <= fine).sort().pop() || null

/** Media, scarto e fila di una metrica. `giorni` = la fila del suo segnale (0 se non c'è). */
function confronto(valori, fine, giorni) {
  const ultimo = ultimoGiorno(valori, fine)
  if (!ultimo) return null
  const inizio = giorni ? aggiungiGiorni(ultimo, -(giorni - 1)) : ultimo
  const media = riferimentoPrima(valori, inizio) ?? null
  const prima = quantiPrima(valori, inizio)
  const fila = new Set(giorni ? Array.from({ length: giorni }, (_, i) => aggiungiGiorni(inizio, i)) : [])
  return { ultimo, valore: valori.get(ultimo), media, fila, prima }
}

function fraseRecupero({ stato, segnali, tessere, notti, ultimo, oggi, comeStai, proprio }) {
  const tu = (lui, te) => (proprio ? te : lui)
  let forte = null, testo
  if (stato === 'segnali') {
    const ha = (tipo) => segnali.some(s => s.tipo === tipo)
    const recupera = ha('hrv') || ha('fc')
    forte = ha('sonno') && recupera ? tu('Dorme poco e recupera meno del solito:', 'Dormi poco e recuperi meno del solito:')
      : recupera ? tu('Recupera meno del solito:', 'Recuperi meno del solito:')
        : tu('Dorme poco:', 'Dormi poco:')
    const parti = []
    const scarto = (chiave) => tessere.find(t => t.chiave === chiave)?.scarto
    if (ha('hrv')) parti.push(`HRV ${segno(scarto('hrv'))}%`)
    if (ha('fc')) parti.push(`FC a riposo ${segno(scarto('fc'))}`)
    if (ha('sonno')) parti.push(`sotto le ${ORE_SONNO} ore di sonno`)
    const unite = parti.join(', ')
    testo = `${unite.charAt(0).toUpperCase()}${unite.slice(1)}.`
  } else if (stato === 'fermo') {
    testo = `Nessun dato dall'orologio dopo ${etichettaGiorno(ultimo, oggi)}.`
  } else if (stato === 'pochi') {
    // La media vuole 14 valori PRIMA dell'ultima notte: in tutto ne servono 15.
    testo = `Servono ${MINIMO_GIORNI + 1} notti per conoscere ${tu('la sua', 'la tua')} media: ${tu('ne ha', 'ne hai')} ${notti}.`
  } else {
    testo = `Tutto nella ${tu('sua', 'tua')} norma nelle ultime notti.`
  }
  const basse = comeStai
    ? DOMANDE.filter(d => Number.isInteger(comeStai[d.chiave]) && comeStai[d.chiave] <= 2)
      .map(d => `${d.titolo.toLowerCase()} «${parolaRisposta(d, comeStai[d.chiave])}»`)
    : []
  const nota = basse.length ? `Stamattina ${tu('ha detto', 'hai detto')}: ${basse.join(', ')}.` : null
  return { forte, testo, nota }
}

/** Con il segno: «+6», «−15» (il meno tipografico), «0». */
export const segno = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0')

/**
 * Tutto quello che la sezione «Recupero» mostra, già calcolato. `null` se
 * nessuna riga ha un dato. Vedi la spec per le regole.
 */
export function riepilogoRecupero(righe, { comeStai = null, oggi = new Date(), proprio = false } = {}) {
  const fine = oggiItalia(oggi)
  const segnali = segnaliRecupero(righe, oggi)
  const giorniDi = (tipo) => segnali.find(s => s.tipo === tipo)?.giorni || 0
  const settimana = Array.from({ length: NOTTI_COLONNINE }, (_, i) => aggiungiGiorni(fine, i - (NOTTI_COLONNINE - 1)))

  const tessere = []
  for (const t of TESSERE) {
    const valori = valoriPer(righe, t)
    const c = confronto(valori, fine, t.chiave === 'hrv' || t.chiave === 'fc' ? giorniDi(t.chiave) : 0)
    if (!c) continue
    const scarto = c.media == null ? null
      : t.chiave === 'hrv' ? Math.round((c.valore / c.media - 1) * 100) : Math.round(c.valore - c.media)
    tessere.push({
      prima: c.prima, chiave: t.chiave, giorno: c.ultimo, valore: c.valore, media: c.media, scarto, fuori: c.fila.size > 0,
      notti: settimana.map(g => ({ giorno: g, valore: valori.has(g) ? valori.get(g) : null, fila: c.fila.has(g) })),
    })
  }

  let sonno = null
  const ore = valoriPer(righe, metrica('sonno'))
  const cs = confronto(ore, fine, giorniDi('sonno'))
  if (cs) {
    const riga = (righe || []).filter(r => r.giorno === cs.ultimo && numero(r.sonno?.ore) != null).pop()
    const punteggi = valoriPer(righe, { leggi: r => r.sonno?.punteggio })
    const fasi = {}
    for (const [k, campo] of FASI) { const v = numero(riga?.sonno?.[campo]); if (v > 0) fasi[k] = v }
    sonno = {
      giorno: cs.ultimo, ore: cs.valore, mediaOre: cs.media, fuori: cs.fila.size > 0, fasi, prima: cs.prima,
      punteggio: numero(riga?.sonno?.punteggio),
      mediaPunteggio: riferimentoPrima(punteggi, cs.fila.size ? [...cs.fila].sort()[0] : cs.ultimo) ?? null,
    }
  }

  if (!tessere.length && !sonno) return null
  const conMedia = tessere.some(t => t.media != null) || sonno?.mediaOre != null
  // L'ultimo dato di tutta la sezione: se è più vecchio di ieri, i dati sono fermi
  // e niente si può dire «delle ultime notti».
  const ultimo = [sonno?.giorno, ...tessere.map(t => t.giorno)].filter(Boolean).sort().pop()
  const stato = segnali.length ? 'segnali'
    : ultimo < aggiungiGiorni(fine, -1) ? 'fermo'
      : conMedia ? 'norma' : 'pochi'
  // Il progresso verso la media: la metrica più avanti, contata come la conta la media.
  const notti = Math.max(...tessere.map(t => t.prima), sonno ? sonno.prima : 0) + 1
  const TITOLI = { segnali: 'Da guardare', norma: 'Nella norma', pochi: 'Si sta facendo un\'idea', fermo: 'Dati fermi' }
  return {
    stato,
    titolo: TITOLI[stato],
    giorni: stato === 'segnali' ? Math.max(...segnali.map(s => s.giorni)) : null,
    frase: fraseRecupero({ stato, segnali, tessere, notti, ultimo, oggi, comeStai, proprio }),
    sonno, tessere, comeStai: comeStai || null,
  }
}

