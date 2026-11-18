/**
 * «Visualizza come atleta» degli admin (Impostazioni): una spunta del
 * DISPOSITIVO, `adminRoleOverride` = 'athlete' (CLAUDE.md §1.2).
 *
 * 🔴 Segnalazione del 18/11/2026: la spunta sopravviveva all'uscita. Sullo
 * stesso telefono, un atleta vero entrato dopo un admin in anteprima veniva
 * trattato dalle Impostazioni come admin (righe admin visibili, niente Garmin
 * né consenso), perché lì `role === 'athlete'` più la spunta vuol dire
 * «admin in anteprima». Ora la spunta si spegne uscendo, e all'accesso di
 * chiunque non sia admin.
 */
export const CHIAVE_ANTEPRIMA = 'adminRoleOverride'

const togli = () => {
  try { localStorage.removeItem(CHIAVE_ANTEPRIMA) } catch { /* storage non disponibile */ }
}

/** All'accesso: la spunta vale solo per un admin vero. */
export function chiudiAnteprimaSeNonAdmin(ruoloVero) {
  if (ruoloVero !== 'admin') togli()
}

/** All'uscita dall'account. */
export function chiudiAnteprima() {
  togli()
}
