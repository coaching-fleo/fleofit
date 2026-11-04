// Il calendario delle gare HYROX nel telefono: la copia locale, la ricerca e
// il workout «Evento» che nasce da una gara scelta.
//
// La lista arriva dalla Edge Function `gare-hyrox` (che legge hyrox.com): qui
// non c'è niente che parli con la rete se non `caricaGare`, e tutto il resto
// è puro e provato in src/lib/__tests__/gareHyrox.test.js.

import { leggiJson, scriviJson } from './offlineQueue'
import { normalizza } from './gare'

export { normalizza, gareFuture, giorniGara, periodoGara, blocchettoData, quandoGara, perMese, giornoProposto } from './gare'

export const CHIAVE_CACHE_GARE = 'fleofit_cache_gare_hyrox'

// Più corta della copia del server (6 ore) non serve: il calendario HYROX non
// cambia nell'arco di una giornata in un modo che conti per chi si iscrive.
const DURATA_CACHE = 12 * 3_600_000
// Sale quando cambia la forma di una gara: una copia di forma vecchia (senza
// foto né paese, prima del 12/10/2026) si butta invece di mostrarla a metà.
// 3: la 2 poteva contenere una lista di forma vecchia, ricevuta da una
// funzione non ancora ripubblicata (vedi `formaAttuale`).
const VERSIONE_CACHE = 3

/**
 * Una lista arrivata dal server nella forma attuale. ⚠️ Il telefono e la
 * funzione si aggiornano in momenti diversi: un'app nuova davanti a una
 * `gare-hyrox` non ancora ripubblicata riceve gare senza `immagine` né
 * `paese`. Si mostrano lo stesso (meglio di niente) ma NON si salvano,
 * così appena la funzione è aggiornata le foto arrivano subito e non dopo
 * 12 ore (successo il 12/10/2026).
 */
export function formaAttuale(gare) {
  return Array.isArray(gare) && gare.length > 0 && 'immagine' in gare[0] && 'paese' in gare[0]
}

/** I continenti del sito, nell'ordine del filtro, con il nome in italiano. */
export const CONTINENTI = {
  'europe': 'Europa',
  'north-america': 'Nord America',
  'south-america': 'Sud America',
  'asia-pacific': 'Asia e Pacifico',
  'middle-east': 'Medio Oriente',
  'africa': 'Africa',
}

/** Il nome di un continente; uno che il sito aggiunge esce con lo slug ripulito. */
export function nomeContinente(slug) {
  if (!slug) return ''
  return CONTINENTI[slug] || slug.split('-').map(p => p[0].toUpperCase() + p.slice(1)).join(' ')
}

/** I continenti che compaiono nella lista, nell'ordine di `CONTINENTI`. */
export function continentiPresenti(gare) {
  const presenti = new Set((gare || []).map(g => g.continente).filter(Boolean))
  const noti = Object.keys(CONTINENTI).filter(c => presenti.has(c))
  return [...noti, ...[...presenti].filter(c => !CONTINENTI[c]).sort()]
}

/** `''` = tutti i continenti. */
export function filtraContinente(gare, continente) {
  return continente ? (gare || []).filter(g => g.continente === continente) : (gare || [])
}

/** «ES» → 🇪🇸. Un codice che non è di due lettere non dà bandiera. */
export function bandiera(iso) {
  if (!/^[A-Za-z]{2}$/.test(iso || '')) return ''
  return String.fromCodePoint(...iso.toUpperCase().split('').map(c => 0x1F1E6 + c.charCodeAt(0) - 65))
}

let nomiPaesi = null
/** Il paese in italiano («Spagna»); senza codice, l'etichetta inglese del sito. */
export function nomePaese(gara) {
  if (gara?.paese) {
    try {
      nomiPaesi = nomiPaesi || new Intl.DisplayNames(['it'], { type: 'region' })
      const nome = nomiPaesi.of(gara.paese.toUpperCase())
      if (nome && nome !== gara.paese.toUpperCase()) return nome
    } catch { /* Intl senza DisplayNames: si ricade sull'etichetta del sito */ }
  }
  return gara?.paeseNome || ''
}

/**
 * Le gare che contengono tutte le parole cercate, nel nome o nel codice città.
 * «hamb» trova «INTERSPORT HYROX Hamburg», «vlc» trova Valencia.
 */
export function cercaGare(gare, testo) {
  const parole = normalizza(testo).split(/\s+/).filter(Boolean)
  if (parole.length === 0) return gare || []
  return (gare || []).filter(g => {
    const dove = normalizza(`${g.nome} ${g.codice} ${nomePaese(g)} ${g.paeseNome || ''}`)
    return parole.every(p => dove.includes(p))
  })
}

/**
 * Il campo `sections` di un evento nato da una gara HYROX. Resta un evento
 * normale (`category: 'Event'`) — ogni schermata e la web app lo trattano
 * com'è oggi — con in più `hyrox`, che `main` ignora e che servirà a
 * ritrovare la gara per il risultato (BACKLOG, fase 2).
 */
export function sectionsEvento(gara) {
  const base = { category: 'Event', isEvent: true, isAutonomous: true }
  if (!gara) return base
  return {
    ...base,
    hyrox: {
      id: gara.id, codice: gara.codice || '', url: gara.url || '', dal: gara.dal, al: gara.al,
      paese: gara.paese || '', immagine: gara.immagine || '', citta: gara.citta || '',
    },
  }
}

/**
 * La lista delle gare: dalla copia nel telefono se è fresca, altrimenti dal
 * server; se il server non risponde, dalla copia anche vecchia. Torna
 * `{ gare, errore }`: `errore` è valorizzato solo quando non c'è niente da
 * mostrare, e allora la modale ripiega sul campo libero.
 */
export async function caricaGare(supabase, { adesso = Date.now(), storage = globalThis.localStorage } = {}) {
  const copia = leggiJson(CHIAVE_CACHE_GARE, null, storage)
  const valida = copia?.versione === VERSIONE_CACHE && formaAttuale(copia.gare)
  if (valida && adesso - (copia.salvate || 0) < DURATA_CACHE) return { gare: copia.gare, errore: null }

  try {
    const { data, error } = await supabase.functions.invoke('gare-hyrox', { body: {} })
    if (error || !Array.isArray(data?.gare) || data.gare.length === 0) throw error || new Error('lista vuota')
    if (formaAttuale(data.gare)) {
      scriviJson(CHIAVE_CACHE_GARE, { versione: VERSIONE_CACHE, salvate: adesso, gare: data.gare }, storage)
    }
    return { gare: data.gare, errore: null }
  } catch (e) {
    console.warn('gare-hyrox non disponibile:', e)
    if (valida) return { gare: copia.gare, errore: null }
    return { gare: [], errore: 'Calendario HYROX non disponibile in questo momento.' }
  }
}
