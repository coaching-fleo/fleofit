import { describe, it, expect } from 'vitest'
import { messaggioErroreIA, attesaDa, LUNGHEZZA_MASSIMA } from '../erroreIA'
import { blocchiDaTesto, daRipiegare, messaggioErrore, richiestaBlocchiGroq } from '../../../supabase/functions/ai-workout/regole.ts'

// Perché questi test esistono
// ────────────────────────────
// Il 09/10/2026, finita la quota gratuita di Gemini (20 richieste al giorno),
// il builder mostrava il JSON d'errore di Google intero — mille caratteri che
// uscivano dall'avviso — e restava senza IA per undici ore. Due rimedi:
// un messaggio breve, e la riserva su Groq in `ai-workout`.

// L'errore vero, come arrivava all'app.
const QUOTA_GOOGLE = '{"error":{"code":429,"message":"You exceeded your current quota, please check your plan and billing details. * Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 20, model: gemini-2.5-flash\\nPlease retry in 11h20m35.120223731s.","status":"RESOURCE_EXHAUSTED"}}'

describe('messaggioErroreIA', () => {
  it('la quota finita diventa una frase breve, con l\'attesa', () => {
    const m = messaggioErroreIA(QUOTA_GOOGLE)
    expect(m).toBe("Le richieste gratuite all'IA per oggi sono finite: si riprova fra circa 11 ore. Intanto puoi comporre i blocchi a mano.")
    expect(m).not.toContain('{')
  })
  it('anche il messaggio breve del server si riconosce', () => {
    expect(messaggioErroreIA(messaggioErrore(429))).toMatch(/^Le richieste gratuite/)
    expect(messaggioErroreIA(messaggioErrore(503))).toMatch(/sovraccarichi/)
  })
  it('un errore sconosciuto lungo si taglia', () => {
    const m = messaggioErroreIA('x'.repeat(1000))
    expect(m.length).toBeLessThanOrEqual(LUNGHEZZA_MASSIMA + 1)
    expect(m.endsWith('…')).toBe(true)
  })
  it('attesaDa legge ore e minuti', () => {
    expect(attesaDa('retry in 11h20m35.1s')).toBe('fra circa 11 ore')
    expect(attesaDa('Please retry in 42m10s')).toBe('fra circa 42 minuti')
    expect(attesaDa('niente')).toBeNull()
  })
})

describe('ai-workout: la riserva', () => {
  it('scatta su quota, server pieno e modello ritirato, non su richiesta sbagliata', () => {
    expect([429, 404, 503, 500].every(daRipiegare)).toBe(true)
    expect(daRipiegare(400)).toBe(false)
  })
  it('i blocchi si leggono sia come array sia dentro "blocks"', () => {
    const b = [{ type: 'EMOM', exercises: [] }]
    expect(blocchiDaTesto(JSON.stringify(b))).toEqual(b)
    expect(blocchiDaTesto(JSON.stringify({ blocks: b }))).toEqual(b)
    expect(blocchiDaTesto('```json\n' + JSON.stringify(b) + '\n```')).toEqual(b)
    expect(blocchiDaTesto('{"altro": 1}')).toBeNull()
    expect(blocchiDaTesto('non json')).toBeNull()
  })
  it('la richiesta a Groq chiede un oggetto JSON con lo stesso prompt', () => {
    const r = richiestaBlocchiGroq('PROMPT', 'openai/gpt-oss-120b')
    expect(r.response_format).toEqual({ type: 'json_object' })
    expect(r.messages[0].content.startsWith('PROMPT')).toBe(true)
  })
})
