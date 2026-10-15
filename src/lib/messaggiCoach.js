// «Dal coach» — la parte che si può testare senza un telefono.
//
// Chi vede quale messaggio, in che ordine, e quale ne mostra la Home. Qui non
// entra né una `supabase` né un componente.
//
// ⚠️ Le date si confrontano come istanti (`getTime`), mai come stringhe: Supabase
// e `auth` le scrivono in formati diversi (`Z` contro `+00:00`).
// ⚠️ Anteprima, route e permesso d'invio vivono lato server in `broadcast.ts`:
// qui si riesportano, non si riscrivono.

export { anteprima, routeMessaggio, puoInviareBroadcast } from '../../supabase/functions/send-reminders/broadcast.ts'

export const CHIAVE_BOZZA = 'fleofit_messaggio_bozza'
export const CHIAVE_VISTO = 'fleofit_messaggi_visto_fino'
export const MAX_CARATTERI = 2000

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
  const n = String(testo ?? '').trim().length
  return n >= 1 && n <= MAX_CARATTERI
}
