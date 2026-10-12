// Le regole pure di `ai-workout`: niente import Deno, si provano con vitest
// (src/lib/__tests__/aiWorkoutServer.test.js).

/** Vero se un fallimento di Gemini merita la riserva: quota, server pieno, modello ritirato. */
export const daRipiegare = (stato: number) => stato === 429 || stato === 404 || stato >= 500

/**
 * Il messaggio per l'app, dallo stato di Gemini.
 * ⚠️ Fino al 09/10/2026 l'app riceveva il corpo dell'errore di Google così
 * com'era: a quota finita un JSON di mille caratteri che usciva dall'avviso.
 */
export function messaggioErrore(stato: number): string {
  if (stato === 429) return "Le richieste gratuite all'IA per oggi sono finite (429)."
  if (stato >= 500) return "I server dell'IA sono sovraccarichi (503). Riprova fra qualche istante."
  return `L'IA non ha risposto (${stato}).`
}

/** La richiesta a Groq per i blocchi: stesso prompt, risposta in JSON. */
export function richiestaBlocchiGroq(prompt: string, modello: string) {
  return {
    model: modello,
    temperature: 0.2,
    // La modalità JSON di Groq vuole un OGGETTO, non un array: i blocchi
    // vanno dentro "blocks", e `blocchiDaTesto` accetta tutte e due le forme.
    response_format: { type: 'json_object' },
    messages: [{
      role: 'user',
      content: `${prompt}\n\nRestituisci un oggetto JSON della forma {"blocks": [ ... ]}, con l'array dei blocchi dentro "blocks".`,
    }],
  }
}

/** I blocchi da un testo JSON: un array, oppure un oggetto con `blocks`. Altrimenti null. */
export function blocchiDaTesto(testo: string): unknown[] | null {
  try {
    const pulito = String(testo || '').replace(/```json/gi, '').replace(/```/g, '').trim()
    const dati = JSON.parse(pulito)
    if (Array.isArray(dati)) return dati
    if (dati && Array.isArray(dati.blocks)) return dati.blocks
    return null
  } catch {
    return null
  }
}

/**
 * Oltre questa lunghezza i blocchi attuali non si mandano all'IA: un workout
 * vero ne occupa qualche migliaio di caratteri, e un corpo enorme vuol dire
 * una richiesta lenta che brucia la quota gratuita.
 */
export const LUNGHEZZA_MASSIMA_BLOCCHI = 30000

/**
 * La parte del prompt che trasforma la generazione in una MODIFICA (12/10/2026).
 *
 * Senza blocchi attuali torna `null` e la funzione genera come prima, in coda.
 * Con i blocchi, l'IA riceve l'allenamento intero e deve restituirlo INTERO,
 * cambiato solo dove la richiesta lo chiede: il client sostituisce la lista.
 * 🔴 «Intero» non è pedanteria: se l'IA restituisse solo il blocco toccato, il
 * client cancellerebbe tutti gli altri.
 */
export function istruzioniModifica(blocchiAttuali: unknown): string | null {
  if (!Array.isArray(blocchiAttuali) || blocchiAttuali.length === 0) return null
  const json = JSON.stringify(blocchiAttuali)
  if (json.length > LUNGHEZZA_MASSIMA_BLOCCHI) return null
  return `
MODALITÀ MODIFICA. Il coach ha GIÀ questo allenamento nel builder (JSON):
${json}

La sua richiesta è una MODIFICA di questo allenamento (cambiare, togliere, aggiungere,
spostare, sostituire blocchi o esercizi), oppure un'aggiunta di blocchi nuovi.
- Restituisci l'allenamento COMPLETO dopo la modifica: TUTTI i blocchi, anche quelli che non cambiano.
- Tutto ciò che la richiesta non tocca resta IDENTICO: stessi blocchi nello stesso ordine,
  stessi esercizi, stessi campi e valori (reps, meters, kg, ergoPace, speed, exTime, intensity,
  intervals, notes, params). Non aggiungere, togliere o riscrivere campi di tua iniziativa.
- Se la richiesta aggiunge blocchi senza dire dove, mettili in fondo.
- Se la richiesta indica un blocco per posizione ("il secondo blocco", "l'ultimo") contali nell'ordine dell'array.
`
}
