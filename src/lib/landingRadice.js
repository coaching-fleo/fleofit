/**
 * La landing è la pagina principale del SITO (dal 18/11/2026, richiesta del
 * committente): chi apre `/` dal browser senza essere entrato la vede al posto
 * del login. `/benvenuto` resta valida per i link già in giro.
 *
 * Solo sulla radice nuda: un `?` o un `#` possono portare il ritorno di un
 * login (token nell'hash, codice d'invito, errore) e devono arrivare dove
 * arrivavano prima. Mai nell'app nativa: lì nessuno cerca una pagina di
 * presentazione, si apre per entrare (docs/memoria/landing.md).
 */
export function mostraLandingAllaRadice({ pathname, search = '', hash = '' }, nativa) {
  if (nativa) return false
  return pathname === '/' && !search && !hash
}
