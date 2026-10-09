// Groq: la riserva delle IA quando Gemini è senza quota (09/10/2026).
//
// Il piano gratuito di Gemini 2.5 Flash dà 20 richieste al giorno; finite
// quelle, senza riserva il builder restava senza «Genera con IA» fino al
// giorno dopo. Groq ha un piano gratuito più largo (~1.000 al giorno), API
// compatibile con OpenAI e condizioni che non addestrano sui dati.
// Lo usano `ricerca-coach` (come prima scelta) e `ai-workout` (come riserva).
//
// Secret: GROQ_API_KEY. Facoltativo: GROQ_MODELLO.
// ⚠️ Nessun import Deno qui: il file si prova anche con vitest.

export const GROQ_URL = 'https://api.groq.com/openai/v1'
export const MODELLO_WHISPER = 'whisper-large-v3-turbo'
export const MODELLO_GROQ_PREDEFINITO = 'openai/gpt-oss-120b'

/** Il nome del file per Whisper, dal formato: Groq lo riconosce dall'estensione. */
export function nomeFileAudio(mimeType: string): string {
  if (mimeType.includes('mpeg')) return 'audio.mp3'
  if (mimeType.includes('wav')) return 'audio.wav'
  if (mimeType.includes('aac')) return 'audio.aac'
  return 'audio.m4a'
}

/** Trascrive un audio in base64 con Whisper. Torna lo stato e, se riesce, il testo. */
export async function trascriviConWhisper(audioBase64: string, mimeType: string, chiave: string) {
  const byte = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0))
  const form = new FormData()
  form.append('file', new Blob([byte], { type: mimeType }), nomeFileAudio(mimeType))
  form.append('model', MODELLO_WHISPER)
  form.append('language', 'it')
  const res = await fetch(`${GROQ_URL}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${chiave}` },
    body: form,
  })
  const dati = await res.json().catch(() => ({}))
  const testo = res.ok && typeof dati?.text === 'string' ? dati.text.trim() : null
  return { stato: res.status, testo, dati }
}

/** Una chiamata a `chat/completions` di Groq. */
export async function chatGroq(corpo: unknown, chiave: string) {
  const res = await fetch(`${GROQ_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${chiave}` },
    body: JSON.stringify(corpo),
  })
  const dati = await res.json().catch(() => ({}))
  return { stato: res.status, ok: res.ok, dati }
}
