// Il messaggio da mostrare quando l'IA del builder non risponde.
//
// 🔴 Nasce il 09/10/2026: finita la quota gratuita di Gemini, `ai-workout`
// girava all'app il corpo dell'errore di Google così com'era — un JSON di
// mille caratteri con link, dettagli e «retry in 11h20m35.120223731s» — e
// l'avviso cresceva fino a uscire dalla finestra. Chi crea un workout deve
// sapere tre cose: che non è colpa sua, se riprovare serve, e che può
// scrivere i blocchi a mano. Il resto è per i log.

/** Oltre questa lunghezza un messaggio sconosciuto si taglia. */
export const LUNGHEZZA_MASSIMA = 160

const QUOTA = /429|RESOURCE_EXHAUSTED|quota|rate.?limit|limite di richieste/i
const PIENO = /503|overloaded|high demand|UNAVAILABLE|sovraccaric/i

/** «retry in 11h20m35.1s» → «fra circa 11 ore», se il messaggio lo dice. */
export function attesaDa(grezzo) {
  const m = String(grezzo || '').match(/retry in (?:(\d+)h)?(?:(\d+)m)?(?:([\d.]+)s)?/i)
  if (!m || (!m[1] && !m[2] && !m[3])) return null
  const ore = parseInt(m[1] || '0', 10)
  const minuti = parseInt(m[2] || '0', 10)
  if (ore >= 1) return `fra circa ${ore} ${ore === 1 ? 'ora' : 'ore'}`
  if (minuti >= 1) return `fra circa ${minuti} minut${minuti === 1 ? 'o' : 'i'}`
  return 'fra pochi secondi'
}

export function messaggioErroreIA(grezzo) {
  const testo = String(grezzo || '')
  if (QUOTA.test(testo)) {
    const quando = attesaDa(testo)
    return `Le richieste gratuite all'IA per oggi sono finite${quando ? `: si riprova ${quando}` : ''}. Intanto puoi comporre i blocchi a mano.`
  }
  if (PIENO.test(testo)) return "I server dell'IA sono sovraccarichi. Riprova fra qualche istante."
  const pulito = testo.replace(/\s+/g, ' ').trim()
  if (!pulito) return "L'IA non ha risposto. Riprova fra poco."
  return pulito.length > LUNGHEZZA_MASSIMA ? `${pulito.slice(0, LUNGHEZZA_MASSIMA).trim()}…` : pulito
}
