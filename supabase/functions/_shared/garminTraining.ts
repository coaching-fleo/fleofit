// Le regole dell'invio dei workout all'orologio Garmin, senza Deno né rete.
//
// Puro come `garminRegole.ts`: lo provano i test
// (`src/lib/__tests__/garminTraining.test.js`) e lo usa l'Edge Function che
// parla con la Training API. Solo API web standard: crypto.subtle, Intl.
import type { GarminWorkout } from './workoutGarmin.ts'

// ── Indirizzi della Training API ──────────────────────────────────────────
export const GARMIN_TRAINING = {
  // ⚠️ DA VERIFICARE alla prima prova (28/10/2026)
  workout: 'https://apis.garmin.com/training-api/workout',
  // ⚠️ DA VERIFICARE alla prima prova (28/10/2026)
  schedule: 'https://apis.garmin.com/training-api/schedule',
}

/** La data di oggi in Italia, `YYYY-MM-DD` (la data di un workout è «del giorno in Italia», non UTC). */
export function oggiItalia(adesso: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(adesso)
}

/** SHA-256 esadecimale del workout tradotto: se cambia, il workout sull'orologio va rifatto. */
export async function firmaWorkout(w: GarminWorkout): Promise<string> {
  const byte = new TextEncoder().encode(JSON.stringify(w))
  const hash = await crypto.subtle.digest('SHA-256', byte)
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Legge un id dalla risposta di Garmin: numero nudo, stringa, oppure oggetto con quel campo. */
export function idDaRisposta(j: unknown, campo: 'workoutId' | 'scheduleId'): string | null {
  if (typeof j === 'number' || (typeof j === 'string' && j !== '')) return String(j)
  if (j && typeof j === 'object') {
    const v = (j as Record<string, unknown>)[campo]
    if (typeof v === 'number' || (typeof v === 'string' && v !== '')) return String(v)
  }
  return null
}

const MINUTI_IN_CORSO = 2

/**
 * Un'altra esecuzione sta creando questo invio: è `da_rifare`, non ha ancora un
 * `garmin_workout_id` ed è stato toccato meno di 2 minuti fa.
 */
export function invioInCorso(
  r: { stato: string, garmin_workout_id: string | null, aggiornato_at: string },
  adesso: Date,
): boolean {
  if (r.stato !== 'da_rifare' || r.garmin_workout_id) return false
  return adesso.getTime() - new Date(r.aggiornato_at).getTime() < MINUTI_IN_CORSO * 60_000
}

export type DecisioneInvio = 'crea' | 'rifai' | 'sposta' | 'cancella' | 'niente'

/** Cosa fare, per UNA assegnazione, del workout sull'orologio. Le righe sono in ordine di precedenza. */
export function decidiInvio(x: {
  assegnazione: { data: string, completata: boolean } | null
  workout: GarminWorkout | null
  collegamento: { stato: string, invia_workout: boolean, permessi: string[] } | null
  invio: { data: string, stato: string, firma: string | null, inCorso: boolean } | null
  firma: string | null
  oggi: string
}): DecisioneInvio {
  const { assegnazione, workout, collegamento, invio, firma, oggi } = x
  const idoneo = !!assegnazione && !assegnazione.completata && assegnazione.data >= oggi
    && !!workout
    && !!collegamento && collegamento.stato === 'attivo' && collegamento.invia_workout
    && collegamento.permessi.includes('WORKOUT_IMPORT')

  if (!idoneo) {
    if (!invio) return 'niente'
    // Un allenamento passato o fatto resta nello storico dell'orologio.
    if (invio.data < oggi || (assegnazione && assegnazione.data < oggi) || assegnazione?.completata) return 'niente'
    return 'cancella'
  }
  if (!invio) return 'crea'
  // Chi arriva secondo non crea un doppione.
  if (invio.inCorso) return 'niente'
  if (invio.stato !== 'inviato' || invio.firma !== firma) return 'rifai'
  if (invio.data !== assegnazione!.data) return 'sposta'
  return 'niente'
}
