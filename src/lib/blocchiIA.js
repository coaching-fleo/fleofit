/**
 * I blocchi che `ai-workout` restituisce, resi uguali a quelli composti a mano.
 *
 * Il motivo per cui esiste: Gemini scriveva l'intensità solo quando il coach la
 * dettava, e un esercizio senza `intensity` nel builder non mostra niente — né
 * il «n/10» sulla riga né il suo peso nell'RPE atteso. Un esercizio aggiunto a
 * mano invece nasce sempre con il cursore a 5 (`INTENSITA_PREDEFINITA`).
 *
 * Il prompt ora chiede a Gemini di stimarla sempre; questa è la rete sotto: un
 * valore illeggibile o mancante diventa quello che il picker avrebbe proposto.
 */

/** Lo stesso valore da cui parte il cursore nel picker dell'esercizio. */
export const INTENSITA_PREDEFINITA = '5'

/**
 * L'intensità come la scrive il builder: una stringa intera da «1» a «10».
 * Accetta quello che un modello può restituire — 7, "7", "7/10", "8.5" — e
 * torna `null` per tutto il resto.
 */
export function intensitaValida(valore) {
  if (valore === null || valore === undefined) return null
  const m = String(valore).replace(',', '.').match(/\d+(\.\d+)?/)
  if (!m) return null
  const n = Math.round(Number(m[0]))
  if (!Number.isFinite(n) || n < 1) return null
  return String(Math.min(n, 10))
}

/** Rest come esercizio non ha intensità, come nel picker. */
const senzaIntensita = (ex) => ex?.name === 'Rest'

/**
 * Aggiunge gli `id` client-side e completa l'intensità di ogni esercizio.
 * Non tocca nient'altro: quello che Gemini ha scritto resta com'è.
 */
export function preparaBlocchiIA(blocchi) {
  if (!Array.isArray(blocchi)) return []
  return blocchi
    .filter(b => b && typeof b === 'object')
    .map(b => ({
      ...b,
      id: Math.random(),
      exercises: (Array.isArray(b.exercises) ? b.exercises : []).map(ex => {
        const { intensity, ...resto } = ex || {}
        const valore = senzaIntensita(ex) ? undefined : (intensitaValida(intensity) ?? INTENSITA_PREDEFINITA)
        return { ...resto, ...(valore ? { intensity: valore } : {}), id: Math.random() }
      }),
    }))
}
