// «Dal coach» — la parte che si può testare senza un telefono.
//
// Chi vede quale messaggio, in che ordine, e quale ne mostra la Home. Qui non
// entra né una `supabase` né un componente.
//
// ⚠️ Le date si confrontano come istanti (`getTime`), mai come stringhe: Supabase
// e `auth` le scrivono in formati diversi (`Z` contro `+00:00`).
// ⚠️ Anteprima, route e permesso d'invio vivono lato server in `broadcast.ts`:
// qui si riesportano, non si riscrivono.

import { testoAccettabile } from '../../supabase/functions/send-reminders/broadcast.ts'

export { anteprima, routeMessaggio, puoInviareBroadcast, MAX_CARATTERI } from '../../supabase/functions/send-reminders/broadcast.ts'

export const CHIAVE_BOZZA = 'fleofit_messaggio_bozza'
export const CHIAVE_VISTO = 'fleofit_messaggi_visto_fino'

const istante = (x) => new Date(x).getTime()

/** Il coach vede tutto; l'atleta i fissati e quelli scritti da quando è iscritto. */
export function visibiliPer(messaggi, { iscrittoIl, coach }) {
  if (coach) return messaggi
  const dal = iscrittoIl ? istante(iscrittoIl) : NaN
  if (Number.isNaN(dal)) return messaggi // senza data non si nasconde nulla
  return messaggi.filter((m) => m.fissato || istante(m.creato_at) >= dal)
}

/** Fissati prima; in ogni gruppo il più recente in alto. Non muta l'input. */
export function ordina(messaggi) {
  return [...messaggi].sort((a, b) =>
    (b.fissato ? 1 : 0) - (a.fissato ? 1 : 0) || istante(b.creato_at) - istante(a.creato_at))
}

/** Il più recente arrivato dopo l'ultima volta che l'atleta ha guardato; altrimenti null. */
export function daMostrareInHome(messaggi, vistoFino) {
  const soglia = vistoFino ? istante(vistoFino) : -Infinity
  let migliore = null
  for (const m of messaggi) {
    const t = istante(m.creato_at)
    if (t > soglia && (!migliore || t > istante(migliore.creato_at))) migliore = m
  }
  return migliore
}

export function testoValido(testo) {
  return testoAccettabile(testo) !== null
}

/**
 * Il testo da mostrare dopo «Prova su di me», dalla risposta di `broadcast_prova`
 * (`{ sent, consegnate, motivi }`; `null` = chiamata fallita). «Mandata» solo se
 * Firebase l'ha accettata: contare i dispositivi non basta (15/10/2026, la prima
 * prova diceva «mandata» e sul telefono non arrivava niente).
 * @returns {{ errore: boolean, testo: string }}
 */
export function esitoProva(risposta) {
  if (!risposta) return { errore: true, testo: 'La prova non è partita. Controlla la connessione e riprova.' }
  const iscritti = Number(risposta.sent) || 0
  if (!iscritti) return { errore: true, testo: 'Nessun tuo dispositivo ha le notifiche attive' }
  // Un server di prima non manda `consegnate`: si torna a contare i dispositivi.
  const consegnate = risposta.consegnate == null ? iscritti : Number(risposta.consegnate) || 0
  const motivi = Array.isArray(risposta.motivi) ? risposta.motivi : []
  if (!consegnate) {
    if (motivi.includes('THIRD_PARTY_AUTH_ERROR')) {
      return { errore: true, testo: 'Firebase ha rifiutato la notifica: con l\'app lanciata da Xcode in modalità sviluppo le push non arrivano. Prova con la build Release o con TestFlight.' }
    }
    return { errore: true, testo: `Firebase ha rifiutato la notifica${motivi.length ? ` (${motivi.join(', ')})` : ''}` }
  }
  if (consegnate < iscritti) return { errore: false, testo: `Prova mandata a ${consegnate} dei tuoi ${iscritti} dispositivi` }
  return { errore: false, testo: `Prova mandata ai tuoi dispositivi (${consegnate})` }
}
