import { Capacitor } from '@capacitor/core'
import { format, isValid, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'

/**
 * Il collegamento Garmin Connect, lato app (Fase 0: collegare e scollegare).
 * docs/superpowers/specs/2026-10-27-garmin-design.md §2.
 *
 * L'app non vede mai i token: legge lo stato con la funzione SQL
 * `stato_garmin` e chiede a `garmin-auth` di iniziare o scollegare.
 *
 * ⚠️ Le regole del server stanno in `supabase/functions/_shared/garminRegole.ts`.
 * Quel file NON si importa da qui (finirebbe nel bundle): i permessi noti sono
 * ricopiati sotto, e il test `garmin.test.js` controlla che ogni motivo
 * d'errore del server abbia un messaggio in `MESSAGGI_ESITO`.
 */

/** Cambia solo se cambia ciò che l'atleta accetta con la casella. */
export const VERSIONE_CONSENSO_GARMIN = 1

/** Il testo esatto della casella del consenso. */
export const TESTO_CONSENSO_GARMIN =
  'Acconsento che FLEOFIT riceva i dati del mio account Garmin e li usi, anche con l\'IA, come descritto nell\'informativa'

// Nello stesso ordine di `PERMESSI_NOTI` del server.
const ETICHETTE_PERMESSI = [
  ['ACTIVITY_EXPORT', 'attività'],
  ['HEALTH_EXPORT', 'salute e recupero'],
  ['WORKOUT_IMPORT', 'workout all\'orologio'],
]

const NON_DISPONIBILE = { disponibile: false, stato: null, dal: null, permessi: [] }

/**
 * Lo stato del collegamento di un atleta.
 *
 * 🔴 `disponibile: false` quando la funzione SQL manca (`PGRST202`, prima della
 * migrazione) o la lettura fallisce: chi lo usa nasconde la riga, invece di
 * mostrare un errore che l'atleta non può risolvere.
 * `stato: null` = non collegato (la funzione non torna righe).
 */
export async function leggiStatoGarmin(supabase, atletaId) {
  try {
    const { data, error } = await supabase.rpc('stato_garmin', { atleta: atletaId })
    if (error) return NON_DISPONIBILE
    const riga = Array.isArray(data) ? data[0] : data
    if (!riga) return { disponibile: true, stato: null, dal: null, permessi: [] }
    return {
      disponibile: true,
      stato: riga.stato ?? null,
      dal: riga.collegato_at ?? null,
      permessi: Array.isArray(riga.permessi) ? riga.permessi : [],
    }
  } catch {
    return NON_DISPONIBILE
  }
}

/** Le etichette dei permessi concessi, nell'ordine dei noti; gli sconosciuti si ignorano. */
export function etichettePermessi(permessi) {
  const dati = Array.isArray(permessi) ? permessi : []
  return ETICHETTE_PERMESSI.filter(([p]) => dati.includes(p)).map(([, e]) => e)
}

/** Le etichette dei permessi noti che l'atleta NON ha concesso. */
export function permessiMancanti(permessi) {
  const dati = Array.isArray(permessi) ? permessi : []
  return ETICHETTE_PERMESSI.filter(([p]) => !dati.includes(p)).map(([, e]) => e)
}

/** Dove `garmin-auth` deve rimandare: `'app'` (deep link) sul nativo, l'origine sul web. */
export function ritornoGarmin() {
  return Capacitor.isNativePlatform() ? 'app' : window.location.origin
}

/**
 * `fleofit://garmin?esito=ok&motivo=x` → `/settings?garmin=ok&motivo=x`.
 * Qualunque altro indirizzo → `null`: tocca al resto di `DeeplinkHandler`.
 */
export function rottaDaDeepLinkGarmin(url) {
  let u
  try { u = new URL(url) } catch { return null }
  if (u.protocol !== 'fleofit:' || u.hostname !== 'garmin') return null
  const parametri = new URLSearchParams()
  parametri.set('garmin', u.searchParams.get('esito') === 'ok' ? 'ok' : 'errore')
  const motivo = u.searchParams.get('motivo')
  if (motivo) parametri.set('motivo', motivo)
  return `/settings?${parametri.toString()}`
}

/** I testi dell'esito del ritorno da Garmin. Un motivo per ogni `MOTIVI_ERRORE` del server. */
export const MESSAGGI_ESITO = {
  ok: {
    titolo: 'Garmin collegato',
    testo: 'I dati del tuo Garmin arriveranno a FLEOFIT dalla prossima sincronizzazione.',
  },
  errore: {
    titolo: 'Garmin non collegato',
    testo: 'Il collegamento con Garmin non è riuscito: riprova.',
  },
  motivi: {
    annullato: 'Hai annullato il collegamento: il tuo account Garmin non è stato collegato.',
    scaduto: 'Il collegamento è rimasto aperto troppo a lungo: riprova.',
    altro_account: 'Questo account Garmin è già collegato a un altro atleta.',
    garmin: 'Garmin non ha risposto: riprova fra qualche minuto.',
  },
}

/** L'esito come `alertInfo` di `CustomAlert`. */
export function messaggioEsito(esito, motivo) {
  if (esito === 'ok') {
    return { title: MESSAGGI_ESITO.ok.titolo, message: MESSAGGI_ESITO.ok.testo, type: 'success' }
  }
  const testo = Object.hasOwn(MESSAGGI_ESITO.motivi, motivo ?? '') ? MESSAGGI_ESITO.motivi[motivo] : MESSAGGI_ESITO.errore.testo
  return { title: MESSAGGI_ESITO.errore.titolo, message: testo, type: 'error' }
}

/** «3 nov 2026», come `dataConsenso`; `null` se manca o non si legge. */
export function dataCollegamento(iso) {
  if (!iso) return null
  const data = parseISO(iso)
  return isValid(data) ? format(data, 'd MMM yyyy', { locale: it }) : null
}
