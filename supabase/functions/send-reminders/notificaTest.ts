// «Notifica di prova» (20/11/2026): la parte pura del modo `notifica_test` di
// send-reminders. Niente Deno e niente URL esterni: è importata anche dai test.
//
// Solo un admin, e solo il telefono da cui parte la richiesta: l'app manda il
// SUO token, e la push va a quella riga di push_subscriptions, se è sua. Parte
// dopo 5 secondi, così c'è il tempo di chiudere l'app o bloccare il telefono e
// vedere la notifica come la vede un atleta (icona e nome compresi).
// Non scrive in `notifications`: non è una notifica vera, il centro notifiche
// resta pulito. Se Firebase la rifiuta, invece, lo scrive lì (il telefono è
// già chiuso e il perché va letto da qualche parte).
export const ATTESA_TEST_MS = 5000
export const TITOLO_TEST = 'Notifica di prova'
export const TESTO_TEST = 'Se la vedi, le notifiche arrivano su questo telefono.'
export const ROUTE_TEST = '/'
export const TITOLO_TEST_FALLITA = 'Notifica di prova non consegnata'

export function puoProvareNotifica(chiamante: { admin: boolean; id?: string | null }): boolean {
  return !!chiamante?.admin && !!chiamante?.id
}

/** La riga di push_subscriptions di QUESTO telefono, se è di chi chiede; se no null. */
// deno-lint-ignore no-explicit-any
export function dispositivoDi(iscrizioni: any[] | null, userId: string, endpoint: unknown): any | null {
  if (typeof endpoint !== 'string' || !endpoint) return null
  return (iscrizioni ?? []).find((s) => s?.user_id === userId && s?.endpoint === endpoint) ?? null
}
