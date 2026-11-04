// Il calendario delle gare di corsa italiane nel telefono: la copia locale, i
// filtri e il workout «Evento» che nasce da una gara scelta.
//
// La lista arriva dalla Edge Function `gare-corsa` (che legge il calendario
// FIDAL): qui non c'è niente che parli con la rete se non `caricaGareCorsa`,
// e tutto il resto è puro e provato in src/lib/__tests__/gareCorsa.test.js.

import { leggiJson, scriviJson } from './offlineQueue'
import { normalizza } from './gare'

export const CHIAVE_CACHE_GARE_CORSA = 'fleofit_cache_gare_corsa'
export const CHIAVE_REGIONE = 'fleofit_corsa_regione'

const DURATA_CACHE = 12 * 3_600_000
// Sale quando cambia la forma di una gara: una copia di forma vecchia si butta.
const VERSIONE_CACHE = 1

/** Gli slug sono quelli di `PROVINCE` in supabase/functions/gare-corsa/regole.ts. */
export const REGIONI = {
  'piemonte': 'Piemonte',
  'valle-d-aosta': "Valle d'Aosta",
  'lombardia': 'Lombardia',
  'trentino-alto-adige': 'Trentino-Alto Adige',
  'veneto': 'Veneto',
  'friuli-venezia-giulia': 'Friuli-Venezia Giulia',
  'liguria': 'Liguria',
  'emilia-romagna': 'Emilia-Romagna',
  'toscana': 'Toscana',
  'umbria': 'Umbria',
  'marche': 'Marche',
  'lazio': 'Lazio',
  'abruzzo': 'Abruzzo',
  'molise': 'Molise',
  'campania': 'Campania',
  'puglia': 'Puglia',
  'basilicata': 'Basilicata',
  'calabria': 'Calabria',
  'sicilia': 'Sicilia',
  'sardegna': 'Sardegna',
}

/** In ordine di filtro; `filigrana` è la scritta grande della gara scelta. */
export const DISTANZE = [
  { id: '5k', etichetta: '5 km', filigrana: '5K' },
  { id: '10k', etichetta: '10 km', filigrana: '10K' },
  { id: 'mezza', etichetta: 'Mezza', filigrana: '21K' },
  { id: 'maratona', etichetta: 'Maratona', filigrana: '42K' },
  { id: 'trail', etichetta: 'Trail', filigrana: 'TRAIL' },
  { id: 'altre', etichetta: 'Altre', filigrana: '' },
]

/**
 * Una lista arrivata dal server nella forma attuale. Come per le gare HYROX,
 * un'app nuova davanti a una funzione non ancora ripubblicata si mostra ma
 * non si salva.
 */
export function formaAttuale(gare) {
  return Array.isArray(gare) && gare.length > 0 && gare.every(g =>
    g && g.id && g.dal && g.al && typeof g.nome === 'string' && g.nome && g.distanza && typeof g.regione === 'string')
}

/**
 * La lista: dalla copia se è fresca, altrimenti dal server; se il server non
 * risponde, dalla copia anche vecchia. `errore` è valorizzato solo quando non
 * c'è niente da mostrare.
 */
export async function caricaGareCorsa(supabase, { adesso = Date.now(), storage = globalThis.localStorage } = {}) {
  const copia = leggiJson(CHIAVE_CACHE_GARE_CORSA, null, storage)
  const valida = copia?.versione === VERSIONE_CACHE && formaAttuale(copia.gare)
  if (valida && adesso - (copia.salvate || 0) < DURATA_CACHE) return { gare: copia.gare, errore: null }

  try {
    const { data, error } = await supabase.functions.invoke('gare-corsa', { body: {} })
    if (error || !Array.isArray(data?.gare) || data.gare.length === 0) throw error || new Error('lista vuota')
    // Una lista incompleta (qualche pagina FIDAL non ha risposto) si mostra ma non si tiene
    // 12 ore nel telefono: alla prossima apertura si riprova.
    if (data.completa !== false && formaAttuale(data.gare)) {
      scriviJson(CHIAVE_CACHE_GARE_CORSA, { versione: VERSIONE_CACHE, salvate: adesso, gare: data.gare }, storage)
    }
    return { gare: data.gare, errore: null }
  } catch (e) {
    console.warn('gare-corsa non disponibile:', e)
    if (valida) return { gare: copia.gare, errore: null }
    return { gare: [], errore: 'Calendario FIDAL non disponibile in questo momento.' }
  }
}

/**
 * Le gare che passano i filtri. `regione` e `distanza` vuoti = tutte; con una
 * regione scelta, una gara senza regione (`''`) è esclusa. La ricerca vale su
 * nome e città, tutte le parole, senza accenti.
 */
export function filtraCorsa(gare, { regione = '', distanza = '', ricerca = '' } = {}) {
  const parole = normalizza(ricerca).split(/\s+/).filter(Boolean)
  return (gare || []).filter(g => {
    if (regione && g.regione !== regione) return false
    if (distanza && g.distanza !== distanza) return false
    if (parole.length === 0) return true
    const dove = normalizza(`${g.nome} ${g.citta}`)
    return parole.every(p => dove.includes(p))
  })
}

/** Le regioni che compaiono nella lista, per nome; la gara senza regione non conta. */
export function regioniPresenti(gare) {
  const presenti = new Set((gare || []).map(g => g.regione).filter(Boolean))
  return [...presenti].sort((a, b) => (REGIONI[a] || a).localeCompare(REGIONI[b] || b, 'it'))
}

/** Le distanze che compaiono nella lista, nell'ordine di `DISTANZE`. */
export function distanzePresenti(gare) {
  const presenti = new Set((gare || []).map(g => g.distanza))
  return DISTANZE.map(d => d.id).filter(id => presenti.has(id))
}

/** `''` = Tutta Italia. */
export function leggiRegione(storage = globalThis.localStorage) {
  const r = leggiJson(CHIAVE_REGIONE, '', storage)
  return typeof r === 'string' ? r : ''
}

export function scriviRegione(slug, storage = globalThis.localStorage) {
  return scriviJson(CHIAVE_REGIONE, slug || '', storage)
}

// Sta in gare.js (già nel chunk d'ingresso): NuovoEvento la usa senza portarsi dietro questo file.
export { sectionsEventoCorsa } from './gare'
