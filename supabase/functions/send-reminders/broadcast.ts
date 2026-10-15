// «Messaggio a tutti»: la parte pura del modo `broadcast` di send-reminders.
// Niente Deno e niente URL esterni: è importata anche dai test (vitest).
import { isAdminEmail } from "../_shared/admin.ts"

export const TITOLO_BROADCAST = 'Messaggio dal coach'
// «Prova su di me»: la push va solo ai dispositivi del coach che la chiede, e il
// messaggio NON entra in bacheca (nessun atleta vede niente). Per questo apre la
// bacheca senza puntare a un messaggio.
export const TITOLO_PROVA = 'Messaggio dal coach (prova)'
export const ROUTE_BACHECA = '/messaggi'
// Lo stesso limite del check della tabella (btrim, 1–2000).
export const MAX_CARATTERI = 2000
// L'account demo è admin (serve al revisore App Store) ma non deve far partire
// notifiche vere a tutti gli atleti.
export const EMAIL_DEMO = 'demo@fleofit.it'

export function puoInviareBroadcast(email: string | null): boolean {
  if (!email) return false
  if (email.trim().toLowerCase() === EMAIL_DEMO) return false
  return isAdminEmail(email)
}

// Il testo della push: spazi compressi; se supera `max`, tagliato all'ultimo
// spazio entro `max` (senza spezzare una parola) più «…».
export function anteprima(testo: string, max = 120): string {
  const t = String(testo ?? '').replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  const taglio = t.slice(0, max)
  const spazio = taglio.lastIndexOf(' ')
  return (spazio > 0 ? taglio.slice(0, spazio) : taglio).trimEnd() + '…'
}

export function routeMessaggio(id: string): string {
  return `/messaggi?m=${id}`
}

// Chi riceve il messaggio: gli atleti non eliminati, senza l'account nascosto
// del coach, senza il mittente, senza chi l'ha già ricevuto (rinvio dopo un
// errore a metà: nessuno vede due volte lo stesso messaggio) e senza `escludi`
// (gli account admin che hanno anche una riga athletes: il messaggio è per gli atleti).
export function destinatariBroadcast(
  atleti: { id: string; deleted_at: number | null }[],
  opz: { mittenteId: string; coachingId: string; giaNotificati: string[]; escludi?: string[] },
): string[] {
  const fuori = new Set([...opz.giaNotificati, ...(opz.escludi ?? [])])
  return atleti
    .filter((a) => !a.deleted_at && a.id !== opz.coachingId && a.id !== opz.mittenteId && !fuori.has(a.id))
    .map((a) => a.id)
}

// Il testo pulito se si può mandare (da 1 a MAX_CARATTERI dopo il trim), altrimenti null.
// Il server non si fida del client: la prova non passa dalla tabella e dal suo check.
export function testoAccettabile(testo: unknown): string | null {
  if (typeof testo !== 'string') return null
  const t = testo.trim()
  return t.length >= 1 && t.length <= MAX_CARATTERI ? t : null
}

// Il motivo di un rifiuto FCM, corto e riconoscibile: lo `status` del corpo JSON
// di Google (THIRD_PARTY_AUTH_ERROR, INVALID_ARGUMENT, …) o, se manca, il codice HTTP.
export function motivoFcm(stato: number, corpo: string): string {
  const m = String(corpo ?? '').match(/"errorCode"\s*:\s*"([A-Z_]+)"/) || String(corpo ?? '').match(/"status"\s*:\s*"([A-Z_]+)"/)
  return m ? m[1] : `HTTP_${stato}`
}

// ⏳ TEMPORANEO (15/10/2026, finché il committente non ha verificato la funzione):
// la prova compare nella bacheca del coach, solo sul suo telefono, con un id
// `prova-…`. La notifica di prova punta lì, così si prova anche l'evidenza.
// Un id che non ha quella forma porta alla bacheca e basta.
export function routeProva(id: unknown): string {
  return typeof id === 'string' && /^prova-[a-z0-9]{1,40}$/.test(id) ? `${ROUTE_BACHECA}?m=${id}` : ROUTE_BACHECA
}
