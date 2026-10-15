// «Messaggio a tutti»: la parte pura del modo `broadcast` di send-reminders.
// Niente Deno e niente URL esterni: è importata anche dai test (vitest).
import { isAdminEmail } from "../_shared/admin.ts"

export const TITOLO_BROADCAST = 'Messaggio dal coach'
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
// del coach, senza il mittente e senza chi l'ha già ricevuto (rinvio dopo un
// errore a metà: nessuno vede due volte lo stesso messaggio).
export function destinatariBroadcast(
  atleti: { id: string; deleted_at: number | null }[],
  opz: { mittenteId: string; coachingId: string; giaNotificati: string[] },
): string[] {
  const gia = new Set(opz.giaNotificati)
  return atleti
    .filter((a) => !a.deleted_at && a.id !== opz.coachingId && a.id !== opz.mittenteId && !gia.has(a.id))
    .map((a) => a.id)
}
