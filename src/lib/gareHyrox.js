// Il calendario delle gare HYROX nel telefono: la copia locale, la ricerca e
// il workout «Evento» che nasce da una gara scelta.
//
// La lista arriva dalla Edge Function `gare-hyrox` (che legge hyrox.com): qui
// non c'è niente che parli con la rete se non `caricaGare`, e tutto il resto
// è puro e provato in src/lib/__tests__/gareHyrox.test.js.

import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import { leggiJson, scriviJson } from './offlineQueue'

export const CHIAVE_CACHE_GARE = 'fleofit_cache_gare_hyrox'

// Più corta della copia del server (6 ore) non serve: il calendario HYROX non
// cambia nell'arco di una giornata in un modo che conti per chi si iscrive.
const DURATA_CACHE = 12 * 3_600_000

/** «São Paulo» e «sao paulo» devono trovarsi a vicenda. */
function normalizza(testo) {
  return String(testo || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

/** Le gare non ancora FINITE: una gara di quattro giorni iniziata ieri si può ancora scegliere. */
export function gareFuture(gare, oggi) {
  return (gare || []).filter(g => g.al >= oggi)
}

/**
 * Le gare che contengono tutte le parole cercate, nel nome o nel codice città.
 * «hamb» trova «INTERSPORT HYROX Hamburg», «vlc» trova Valencia.
 */
export function cercaGare(gare, testo) {
  const parole = normalizza(testo).split(/\s+/).filter(Boolean)
  if (parole.length === 0) return gare || []
  return (gare || []).filter(g => {
    const dove = normalizza(`${g.nome} ${g.codice}`)
    return parole.every(p => dove.includes(p))
  })
}

/** Ogni giorno della gara, da `dal` ad `al` compresi, come yyyy-MM-dd. */
export function giorniGara(gara) {
  if (!gara?.dal) return []
  const giorni = []
  const [a, m, g] = gara.dal.split('-').map(Number)
  const d = new Date(Date.UTC(a, m - 1, g))
  const fine = gara.al && gara.al >= gara.dal ? gara.al : gara.dal
  // Il tetto evita un ciclo lungo su un dato sbagliato: nessuna gara dura un mese.
  for (let i = 0; i < 31; i++) {
    const giorno = d.toISOString().slice(0, 10)
    giorni.push(giorno)
    if (giorno >= fine) break
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return giorni
}

/**
 * Il periodo di una gara in una riga: «17 ott 2026», «15–18 ott 2026»,
 * «28 ott – 1 nov 2026». L'anno compare una volta sola, alla fine.
 */
export function periodoGara(gara) {
  if (!gara?.dal) return ''
  const dal = parseISO(gara.dal)
  const al = parseISO(gara.al && gara.al > gara.dal ? gara.al : gara.dal)
  const f = (d, schema) => format(d, schema, { locale: it })
  if (gara.al <= gara.dal || !gara.al) return f(dal, 'd MMM yyyy')
  if (f(dal, 'yyyy-MM') === f(al, 'yyyy-MM')) return `${f(dal, 'd')}–${f(al, 'd MMM yyyy')}`
  if (f(dal, 'yyyy') === f(al, 'yyyy')) return `${f(dal, 'd MMM')} – ${f(al, 'd MMM yyyy')}`
  return `${f(dal, 'd MMM yyyy')} – ${f(al, 'd MMM yyyy')}`
}

/**
 * Il giorno proposto per una gara appena scelta: quello selezionato nel
 * calendario se cade dentro la gara (chi ha toccato il 17 e poi sceglie
 * Valencia 15–18 intende il 17), altrimenti il primo giorno.
 */
export function giornoProposto(gara, selezionato) {
  const giorni = giorniGara(gara)
  return giorni.includes(selezionato) ? selezionato : giorni[0] || selezionato
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
    hyrox: { id: gara.id, codice: gara.codice || '', url: gara.url || '', dal: gara.dal, al: gara.al },
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
  const valida = copia && Array.isArray(copia.gare) && copia.gare.length > 0
  if (valida && adesso - (copia.salvate || 0) < DURATA_CACHE) return { gare: copia.gare, errore: null }

  try {
    const { data, error } = await supabase.functions.invoke('gare-hyrox', { body: {} })
    if (error || !Array.isArray(data?.gare) || data.gare.length === 0) throw error || new Error('lista vuota')
    scriviJson(CHIAVE_CACHE_GARE, { salvate: adesso, gare: data.gare }, storage)
    return { gare: data.gare, errore: null }
  } catch (e) {
    console.warn('gare-hyrox non disponibile:', e)
    if (valida) return { gare: copia.gare, errore: null }
    return { gare: [], errore: 'Calendario HYROX non disponibile in questo momento.' }
  }
}
