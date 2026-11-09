import { differenceInYears } from 'date-fns'

/** L'età minima per iscriversi, la stessa dell'informativa (§15 «Minori»). */
export const ETA_MINIMA = 14

/**
 * Cosa manca al profilo, o `null` se si può salvare. Lo controlla il codice e
 * non `required`: nella WebView il fumetto del browser non sempre compare, e
 * un tocco su «Inizia» senza nessuna risposta sembra un'app rotta.
 */
export function erroreProfilo({ name, surname, dob, weight, height }, oggi = new Date()) {
  if (!name.trim()) return 'Scrivi il tuo nome.'
  if (!surname.trim()) return 'Scrivi il tuo cognome.'
  if (!dob) return 'Manca la data di nascita.'
  const nascita = new Date(dob + 'T00:00:00')
  if (Number.isNaN(nascita.getTime()) || nascita > oggi) return 'Controlla la data di nascita.'
  const anni = differenceInYears(oggi, nascita)
  if (anni > 110) return 'Controlla la data di nascita.'
  // Informativa §15: sotto i 14 anni non ci si iscrive (09/11/2026,
  // docs/memoria/accesso.md). Anni di CALENDARIO: il giorno del compleanno vale.
  if (anni < ETA_MINIMA) return `Per iscriverti a FLEOFIT devi avere almeno ${ETA_MINIMA} anni.`
  const peso = weight === '' ? null : Number(String(weight).replace(',', '.'))
  if (peso !== null && !(peso >= 25 && peso <= 300)) return 'Il peso va scritto in kg, fra 25 e 300.'
  const altezza = height === '' ? null : Number(String(height).replace(',', '.'))
  if (altezza !== null && !(altezza >= 100 && altezza <= 250)) return "L'altezza va scritta in cm, fra 100 e 250."
  return null
}
