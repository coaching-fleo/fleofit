/**
 * Lo schema dei deep link dell'app: `fleofit://` diventa `pushfit://`.
 *
 * Il passaggio va in tre tempi (docs/superpowers/plans/2026-11-17-rinomina-pushfit.md,
 * Task 1-ter), perché le app già installate conoscono solo `fleofit://`:
 *
 *   1. (ora) l'app RICONOSCE tutti e due, ma i link che produce dicono ancora
 *      `fleofit://`, così li apre anche chi non ha aggiornato;
 *   2. quando quasi tutti hanno la versione che riconosce `pushfit://`, si
 *      cambia `SCHEMA` qui sotto (e prima si aggiunge `pushfit://` su Supabase
 *      Auth e sul portale Garmin, senza togliere il vecchio);
 *   3. togliere `fleofit` da `SCHEMI`: facoltativo, e sconsigliato.
 */

/** Lo schema che l'app SCRIVE nei link. ⚠️ Tempo 1: resta il vecchio. */
export const SCHEMA = 'fleofit'

/** Gli schemi che l'app RICONOSCE. */
export const SCHEMI = ['pushfit', 'fleofit']

/** `true` se `protocol` (com'è in `new URL(...).protocol`, con i due punti) è nostro. */
export const eNostroProtocollo = (protocol) =>
  typeof protocol === 'string' && SCHEMI.some(s => protocol.toLowerCase() === `${s}:`)

/** Il pezzo di espressione regolare che riconosce i nostri schemi: `(?:pushfit|fleofit)`. */
export const SCHEMI_RE = `(?:${SCHEMI.join('|')})`
