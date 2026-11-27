// Le richieste all'IA del piano (spec 2026-11-27-pushfit-ai-design.md §5.2,
// §6.1, §8). ⚠️ Nessun import qui: il file si prova con vitest
// (src/lib/pianoIA/__tests__/richieste.test.js) e si usa da Deno.
//
// Regole di costruzione:
// - il `system` è IDENTICO per tutti gli utenti (istruzioni + regole del team),
//   e porta `cache_control`: si legge dalla cache a un decimo del prezzo.
//   Niente date, niente dati dell'utente lì dentro;
// - la risposta è JSON con schema (`output_config.format`): su Sonnet/Opus 5.5
//   il `tool_choice` forzato e il `thinking: disabled` danno 400;
// - l'IA risponde con DIFFERENZE rispetto alle sedute del team, non con
//   sedute intere (src/lib/pianoIA/differenze.js);
// - con `betas` la chiamata va su `client.beta.messages.create`.

// ── Quale modello per quale compito ─────────────────────────────────────────
// Scelta del committente (27/11/2026): Sonnet 5.5 + Haiku 5.5. Si cambia con
// il secret PIANO_IA_MODELLO_<COMPITO>, senza aggiornare l'app (spec §8.4).

export const COMPITI = ['adattamento', 'revisione', 'rete', 'analisi']

export const MODELLI_PREDEFINITI: Record<string, string> = {
  adattamento: 'claude-sonnet-5-5',
  revisione: 'claude-sonnet-5-5',
  rete: 'claude-sonnet-5-5',
  analisi: 'claude-haiku-5-5',
}

export function modelloPer(compito: string, env: Record<string, string | undefined>): string {
  if (!COMPITI.includes(compito)) throw new Error(`Compito sconosciuto: ${compito}`)
  const scelto = env[`PIANO_IA_MODELLO_${compito.toUpperCase()}`]?.trim()
  return scelto || MODELLI_PREDEFINITI[compito]
}

/** Il fornitore di un modello. Un fornitore nuovo = un ramo qui + la sua richiesta. */
export function fornitoreDi(modello: string): 'anthropic' | 'groq' {
  if (modello.startsWith('claude-')) return 'anthropic'
  if (modello.startsWith('openai/gpt-oss')) return 'groq'
  throw new Error(`Fornitore sconosciuto per il modello ${modello}`)
}

// Solo Sonnet e Opus 5.5 hanno il fallback lato server; Haiku 5.5 no, e il
// Batch lo rifiuta.
const conFallback = (modello: string, batch: boolean) =>
  !batch && (modello.startsWith('claude-sonnet-') || modello.startsWith('claude-opus-'))

// ── Schemi ──────────────────────────────────────────────────────────────────
// ⚠️ Copia di SCHEMA_DIFFERENZE di src/lib/pianoIA/differenze.js: un test
// controlla che coincidano (come colori.test.js per i colori).

const intero = { type: 'integer' }
const testo = { type: 'string' }
const CAMPI = ['reps', 'meters', 'kg', 'exTime', 'rounds', 'duration', 'timecap', 'on', 'off', 'interval', 'pace', 'runDuration', 'recDuration', 'runPace', 'recPace']

export const SCHEMA_DIFFERENZE = {
  type: 'object',
  additionalProperties: false,
  required: ['differenze', 'perche'],
  properties: {
    differenze: {
      type: 'array',
      items: {
        anyOf: [
          {
            type: 'object', additionalProperties: false, required: ['op', 'blocco', 'esercizio', 'con'],
            properties: { op: { type: 'string', enum: ['sostituisci'] }, blocco: intero, esercizio: intero, con: testo },
          },
          {
            type: 'object', additionalProperties: false, required: ['op', 'blocco', 'esercizio', 'campo', 'valore'],
            properties: {
              op: { type: 'string', enum: ['numero'] }, blocco: intero, esercizio: { type: ['integer', 'null'] },
              campo: { type: 'string', enum: CAMPI }, valore: testo,
            },
          },
          {
            type: 'object', additionalProperties: false, required: ['op', 'blocco', 'esercizio'],
            properties: { op: { type: 'string', enum: ['togli'] }, blocco: intero, esercizio: intero },
          },
        ],
      },
    },
    perche: testo,
  },
}

const sedutaConDifferenze = {
  type: 'object', additionalProperties: false, required: ['posto', 'differenze', 'perche'],
  properties: { posto: intero, differenze: SCHEMA_DIFFERENZE.properties.differenze, perche: testo },
}

const SCHEMA_ADATTAMENTO = {
  type: 'object', additionalProperties: false, required: ['sedute'],
  properties: { sedute: { type: 'array', items: sedutaConDifferenze } },
}

const SCHEMA_ANALISI = {
  type: 'object', additionalProperties: false, required: ['prossime', 'frase'],
  properties: {
    prossime: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['posto', 'differenze'],
        properties: { posto: intero, differenze: SCHEMA_DIFFERENZE.properties.differenze },
      },
    },
    frase: testo,
  },
}

// ── Istruzioni ──────────────────────────────────────────────────────────────

const FORMATO_DIFFERENZE = `Rispondi SOLO con differenze rispetto alle sedute ricevute, mai con sedute intere.
Le differenze possibili:
- {"op":"sostituisci","blocco":i,"esercizio":j,"con":"Nome"}: cambia l'esercizio j del blocco i (indici da 0) tenendo i suoi numeri;
- {"op":"numero","blocco":i,"esercizio":j,"campo":"reps|meters|kg|exTime","valore":"…"}: cambia un numero dell'esercizio;
- {"op":"numero","blocco":i,"esercizio":null,"campo":"rounds|duration|timecap|on|off|interval","valore":"…"}: cambia un parametro del blocco;
- per una seduta di corsa il "blocco" è la fase e i campi sono duration, pace, rounds, runDuration, recDuration, runPace, recPace;
- {"op":"togli","blocco":i,"esercizio":j}: toglie un esercizio.
I valori si scrivono come nel builder: "15", "500m", "20" (kg senza unità), "1:30", "40 min", "Z2", "5:00 /km".
I nomi degli esercizi si scelgono solo fra quelli del picker Hyrox (es. "SkiErg", "Rowing", "Sled Push", "Sled Pull", "Burpees Broad Jumps", "Farmers Carry", "Sandbag Lunges", "Wall Balls", "Run", "Burpees", "Squat", "Back Lunge", "Kettlebell Swing").`

export const ISTRUZIONI_ADATTAMENTO = `Sei il sistema di programmazione di PUSHFIT, un'app di allenamento Hyrox.
Ricevi le sedute di una settimana scritte da un coach del team PUSHFIT e il profilo di un utente.
Il tuo compito è ADATTARE le sedute all'utente, rispettando la struttura e lo stile del coach:
- sostituisci gli esercizi che l'utente non può fare con la sua attrezzatura o che ha escluso, con l'alternativa più vicina per stimolo;
- adatta i carichi alla categoria e al sesso (pesi ufficiali Hyrox Open/Pro), e prudenti se il livello è principiante;
- adatta il volume al livello (meno giri o meno metri per un principiante, non di più per un avanzato senza motivo);
- se ci sono stazioni deboli, insisti su quelle senza aumentare la durata della seduta;
- non cambiare quello che va già bene: nessuna differenza è una risposta valida.
Mai diagnosi mediche, mai consigli su farmaci o alimentazione.
Per ogni seduta scrivi "perche": una frase breve, in italiano, rivolta all'utente, che spiega cosa hai cambiato.

${FORMATO_DIFFERENZE}`

export const ISTRUZIONI_ANALISI = `Sei il sistema di programmazione di PUSHFIT, un'app di allenamento Hyrox.
Ricevi il riassunto dei feedback di un utente (numeri calcolati dall'app), la seduta appena fatta e le prossime sedute.
Ritocca SOLO le prossime sedute, e solo se i feedback lo giustificano:
- RPE molto sopra l'atteso, carichi «meno», «Come stai» basso o dolore: alleggerisci (meno giri, meno metri, carichi più bassi);
- RPE molto sotto l'atteso e carichi «più»: aumenta di poco (al massimo +10%);
- dolore: togli o sostituisci gli esercizi che caricano la zona, e mai una diagnosi.
Scrivi "frase": una frase per l'utente, in italiano, al massimo 140 caratteri, che dice cosa cambia e perché (o che va tutto bene).

${FORMATO_DIFFERENZE}`

// ── Le richieste ────────────────────────────────────────────────────────────

const sistema = (istruzioni: string) => [{ type: 'text', text: istruzioni, cache_control: { type: 'ephemeral' } }]

export function richiestaAdattamento(
  { modello, regole, sedute, profilo, batch = false }:
  { modello: string, regole: string[], sedute: unknown[], profilo: unknown, batch?: boolean },
) {
  const istruzioni = `${ISTRUZIONI_ADATTAMENTO}\n\nREGOLE DEL METODO DEL TEAM:\n${regole.map(r => `- ${r}`).join('\n')}`
  return {
    model: modello,
    max_tokens: 16000,
    system: sistema(istruzioni),
    messages: [{ role: 'user', content: JSON.stringify({ profilo, sedute }) }],
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA_ADATTAMENTO } },
    ...(conFallback(modello, batch) ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } : {}),
  }
}

export function richiestaAnalisi(
  { modello, riassunto, seduta, prossime, batch = false }:
  { modello: string, riassunto: unknown, seduta: unknown, prossime: unknown[], batch?: boolean },
) {
  return {
    model: modello,
    max_tokens: 4000,
    system: sistema(ISTRUZIONI_ANALISI),
    messages: [{ role: 'user', content: JSON.stringify({ riassunto, seduta, prossime }) }],
    output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA_ANALISI } },
    ...(conFallback(modello, batch) ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } : {}),
  }
}

/** La stessa analisi nel formato di `chatGroq` (_shared/groq.ts), per la gara fra modelli. */
export function richiestaGroqAnalisi(
  { modello, riassunto, seduta, prossime }: { modello: string, riassunto: unknown, seduta: unknown, prossime: unknown[] },
) {
  return {
    model: modello,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: `${ISTRUZIONI_ANALISI}\n\nRispondi con un oggetto JSON con questa forma: ${JSON.stringify(SCHEMA_ANALISI)}` },
      { role: 'user', content: JSON.stringify({ riassunto, seduta, prossime }) },
    ],
  }
}

/** Legge la risposta di Claude: controlla lo stop_reason PRIMA del contenuto. */
type Messaggio = { stop_reason?: string, content?: { type?: string, text?: string }[] } | null | undefined

export function leggiRisposta(message: Messaggio): { ok: boolean, dati: Record<string, unknown> | null, motivo: 'refusal' | 'max_tokens' | 'json' | null } {
  if (message?.stop_reason === 'refusal') return { ok: false, dati: null, motivo: 'refusal' }
  if (message?.stop_reason === 'max_tokens') return { ok: false, dati: null, motivo: 'max_tokens' }
  const blocco = Array.isArray(message?.content) ? message.content.find(b => b?.type === 'text') : null
  try {
    const dati = JSON.parse(blocco?.text ?? '')
    return dati && typeof dati === 'object' ? { ok: true, dati, motivo: null } : { ok: false, dati: null, motivo: 'json' }
  } catch {
    return { ok: false, dati: null, motivo: 'json' }
  }
}
