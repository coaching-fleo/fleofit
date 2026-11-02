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
  const anni = (oggi - nascita) / (365.25 * 24 * 3600 * 1000)
  if (Number.isNaN(anni) || anni < 5 || anni > 110) return 'Controlla la data di nascita.'
  const peso = weight === '' ? null : Number(String(weight).replace(',', '.'))
  if (peso !== null && !(peso >= 25 && peso <= 300)) return 'Il peso va scritto in kg, fra 25 e 300.'
  const altezza = height === '' ? null : Number(String(height).replace(',', '.'))
  if (altezza !== null && !(altezza >= 100 && altezza <= 250)) return "L'altezza va scritta in cm, fra 100 e 250."
  return null
}
