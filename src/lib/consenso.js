import { format, isValid, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'

/**
 * Il consenso al trattamento dei dati di allenamento e salute, anche con l'IA
 * (docs/superpowers/specs/2026-10-14-consenso-privacy-design.md).
 *
 * Si registra nei metadati dell'utente (`user_metadata.consenso`), non in una
 * tabella: lo schema è congelato (CLAUDE.md §0, 0-bis), e il consenso serve
 * solo a dimostrarlo e a sapere quando richiederlo — nessuno deve leggerlo per
 * escludere qualcuno, perché senza consenso nell'app non si entra.
 *
 * 🔴 VERSIONE_CONSENSO cambia SOLO se cambia ciò che l'atleta accetta (il testo
 * delle caselle: un dato di salute nuovo, uno scopo nuovo). Alzarla rifà
 * comparire la schermata a tutti gli atleti alla prossima apertura. Una
 * modifica della sola informativa NON la cambia: per quella c'è la versione in
 * `public/privacy-policy.html` (meta `versione-policy`).
 */
export const VERSIONE_CONSENSO = 1

/** L'informativa pubblicata: assoluta, perché dentro l'app nativa `/privacy` non esiste. */
export const URL_INFORMATIVA = 'https://fleofit.vercel.app/privacy'

/**
 * `true` se all'utente va chiesto il consenso prima di entrare.
 * Lo staff (admin e coach) non lo vede: i coach usano l'app per lavoro, non
 * sono le persone di cui il coaching tratta i dati di salute.
 */
export function serveConsenso(user, eStaff) {
  if (!user || eStaff) return false
  return user.user_metadata?.consenso?.versione !== VERSIONE_CONSENSO
}

/** Ciò che si scrive nei metadati accettando. */
export function datiConsenso(adesso = new Date()) {
  return { versione: VERSIONE_CONSENSO, il: adesso.toISOString() }
}

/** «27 ott 2026», o `null` se il consenso (o la sua data) non c'è. */
export function dataConsenso(user) {
  const il = user?.user_metadata?.consenso?.il
  if (!il) return null
  const data = parseISO(il)
  return isValid(data) ? format(data, 'd MMM yyyy', { locale: it }) : null
}
