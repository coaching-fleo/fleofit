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
