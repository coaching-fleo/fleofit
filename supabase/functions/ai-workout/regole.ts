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

/** La richiesta a Groq per i blocchi Hyrox (`richiestaGroq` per le altre categorie). */
export const richiestaBlocchiGroq = (prompt: string, modello: string) => richiestaGroq(prompt, modello, 'Hyrox')

/** I blocchi da un testo JSON: un array, oppure un oggetto con `blocks`. Altrimenti null. */
export const blocchiDaTesto = (testo: string) => risultatoDaTesto(testo, 'Hyrox') as unknown[] | null

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
export function istruzioniModifica(attuali: unknown, categoria = 'Hyrox'): string | null {
  const c = CATEGORIE_IA[categoria] ?? CATEGORIE_IA.Hyrox
  if (c.testo) {
    // Custom: l'allenamento è una descrizione, non una lista.
    if (typeof attuali !== 'string' || !attuali.trim() || attuali.length > LUNGHEZZA_MASSIMA_BLOCCHI) return null
    return `
MODALITÀ MODIFICA. Il coach ha GIÀ scritto questa descrizione:
"""
${attuali}
"""

La sua richiesta è una MODIFICA di questa descrizione (cambiare, togliere, aggiungere parti).
- Restituisci la descrizione COMPLETA dopo la modifica.
- Tutto ciò che la richiesta non tocca resta IDENTICO, parola per parola.
`
  }
  if (!Array.isArray(attuali) || attuali.length === 0) return null
  const json = JSON.stringify(attuali)
  if (json.length > LUNGHEZZA_MASSIMA_BLOCCHI) return null
  const parti = c.parti
  return `
MODALITÀ MODIFICA. Il coach ha GIÀ questo allenamento nel builder (JSON):
${json}

La sua richiesta è una MODIFICA di questo allenamento (cambiare, togliere, aggiungere,
spostare, sostituire ${parti} o esercizi), oppure un'aggiunta.
- Restituisci l'allenamento COMPLETO dopo la modifica: l'intero elenco di ${parti}, comprese le parti che non cambiano.
- Tutto ciò che la richiesta non tocca resta IDENTICO: stesso elenco di ${parti} nello stesso ordine,
  stessi esercizi, stessi campi e valori (reps, meters, kg, ergoPace, speed, exTime, intensity,
  intervals, notes, params, duration, pace). Non aggiungere, togliere o riscrivere campi di tua iniziativa.
- Se la richiesta aggiunge qualcosa senza dire dove, mettilo in fondo.
- Se la richiesta indica una parte per posizione ("il secondo", "l'ultimo") contali nell'ordine dell'array.
`
}

// ─── LE CATEGORIE (12/10/2026) ─────────────────────────────────────────────
//
// Richiesta del committente: «Genera con IA» su TUTTE le categorie del
// builder, comprese quelle che verranno. Fino ad allora la funzione sapeva
// scrivere solo blocchi Hyrox.
//
// 🔴 Una categoria nuova in `CATEGORIE` di CreateWorkout.jsx va aggiunta QUI
// (e in src/lib/iaCategorie.js): src/lib/__tests__/iaCategorie.test.js
// fallisce finché una delle due manca.
//
// `chiave` è dove sta il risultato nel JSON del modello e nella risposta
// all'app; `testo` vuol dire che il risultato è una stringa e non un array.

type CategoriaIA = {
  chiave: string
  testo?: boolean
  /** Come si chiamano le parti dell'allenamento, per il prompt di modifica. */
  parti: string
  istruzioni: string
}

const ISTRUZIONI_HYROX = `
Traduci questo workout dettato a voce in un array JSON compatibile con l'app di fitness.
Tipi di blocco ammessi: "WarmUp", "Cash In", "ON/OFF", "EMOM", "AMRAP", "For Time", "Interval", "Rest", "Cash Out".
Devi restituire ESCLUSIVAMENTE la struttura JSON.

INTENSITÀ: ogni esercizio DEVE avere il campo "intensity", una stringa con un intero da "1" a "10" (scala RPE).
- Se l'utente la dice (es. "a intensità 8", "RPE 7", "al massimo", "facile"), usa quella.
- Se non la dice, stimala tu dal contesto: riscaldamento e Cash In leggeri 3-5, lavoro centrale 6-8,
  For Time / AMRAP brevi o "all out" 8-10, defaticamento e Cash Out 3-5.
- Non mettere mai "intensity" sull'esercizio "Rest".

NOMI DEGLI ESERCIZI: gli ergometri si scrivono ESATTAMENTE così, senza spazi o varianti:
"SkiErg", "Rowing", "Assault Bike", "Echo Bike", "TrueForm Runner", "Curve Treadmill"
(mai "Ski Erg", "Ski", "Row", "Rower", "Air Bike"). Per un ergometro usa "meters" (es. "500m")
e, se c'è un passo, "ergoPace" (es. "2:00 /500m"); le calorie vanno nelle "notes" (es. "15 cal").
Le stazioni Hyrox si scrivono "Sled Push", "Sled Pull", "Burpees Broad Jumps", "Farmers Carry",
"Sandbag Lunges", "Wall Balls", "Run".

STAZIONI CONTINUE NEGLI EMOM: in un EMOM ogni esercizio vale UN intervallo, nell'ordine.
Se l'utente dice che un esercizio occupa più intervalli di fila (es. "minuti 2-3 sled push",
"dal minuto 4 al 6 rowing", "sled push per due minuti"), scrivi quell'esercizio UNA SOLA VOLTA
con il campo "intervals" = quanti intervalli dura, come stringa ("2", "3"…, massimo "5").
- NON ripetere l'esercizio in più righe: due righe uguali sono due esercizi separati.
- Senza indicazioni di più minuti non mettere "intervals" (vale 1).
- "intervals" esiste solo nei blocchi "EMOM".
- "rounds" dell'EMOM resta il numero TOTALE di intervalli (minuti), stazioni lunghe comprese.

ON/OFF: "rounds" sono i GIRI DEL CIRCUITO, non gli intervalli. Ogni giro fa TUTTI gli esercizi
del blocco, un ON + un OFF ciascuno: con 7 esercizi e "rounds": "4" sono 28 intervalli.
Esempio: "50 on 10 off, 4 giri di 7 esercizi" → "params": { "on": "0:50", "off": "0:10", "rounds": "4" }.

Esempio di struttura richiesta:
[
  {
    "type": "EMOM",
    "params": { "interval": "1:00", "rounds": "12" },
    "exercises": [
      { "name": "Burpees", "reps": "15", "intensity": "8" },
      { "name": "Sled Push", "meters": "50m", "kg": "100", "intensity": "8", "intervals": "2" },
      { "name": "Rowing", "meters": "250m", "intensity": "7" }
    ]
  }
]
`

const ISTRUZIONI_CORSA = `
Traduci questo allenamento di CORSA dettato a voce in un array JSON di FASI, compatibile con l'app di fitness.
Devi restituire ESCLUSIVAMENTE la struttura JSON.

Tipi di fase ammessi ("type"): "warmup" (riscaldamento), "run" (corsa), "recover" (recupero),
"cooldown" (defaticamento), "repeat" (ripetute).

FASE SEMPLICE (warmup, run, recover, cooldown):
- "duration": un tempo ("10 min", "30 sec") OPPURE una distanza ("400m", "5 km", "1.5 km").
- "pace": un ritmo "m:ss /km" (da "2:00 /km" a "10:00 /km") oppure una zona fra
  "Libero", "Camminata", "Z1", "Z2", "Z3", "Z4", "Z5", "All out", "Gara".
- "paceMax": solo se il ritmo è una forbice (es. 4:30-4:40 → "pace": "4:30 /km", "paceMax": "4:40 /km").
- "intensity": stringa con un intero da "1" a "10".
- "notes": facoltativo.

RIPETUTE ("type": "repeat"), es. "8 x 400 metri a 3:45 recupero 1 minuto":
- "rounds": quante volte ("8").
- "runDuration", "runPace", "runPaceMax", "runIntensity": il tratto veloce, stesse regole di sopra.
- "recDuration", "recPace", "recPaceMax", "recIntensity": il recupero. Se l'utente non dice il
  recupero, "recDuration" resta "" (non inventarlo).

INTENSITÀ: se l'utente non la dice, stimala: riscaldamento e defaticamento 3-4, corsa lenta/Z2 4-5,
medio/soglia 6-7, ripetute veloci 8-9, all out 10, recuperi 2-3.
Non inventare fasi che l'utente non ha chiesto, salvo riscaldamento e defaticamento quando chiede
un allenamento completo senza dettagliarlo.

Esempio di struttura richiesta:
[
  { "type": "warmup", "duration": "15 min", "pace": "Z1", "intensity": "3" },
  { "type": "repeat", "rounds": "8", "runDuration": "400m", "runPace": "3:45 /km", "runIntensity": "8",
    "recDuration": "1 min", "recPace": "Camminata", "recIntensity": "2" },
  { "type": "run", "duration": "5 km", "pace": "4:30 /km", "paceMax": "4:40 /km", "intensity": "6" },
  { "type": "cooldown", "duration": "10 min", "pace": "Libero", "intensity": "3" }
]
`

const ISTRUZIONI_CUSTOM = `
Scrivi la DESCRIZIONE di un allenamento a partire da quello che il coach detta a voce.
La descrizione la legge l'atleta: italiano chiaro, in seconda persona, una riga per esercizio o parte
(riscaldamento, parte centrale, defaticamento), con serie, ripetizioni, tempi, carichi e recuperi
quando il coach li dice. Niente markdown (niente asterischi né cancelletti), niente saluti né
introduzioni. Non inventare numeri che il coach non ha detto.
Restituisci ESCLUSIVAMENTE un oggetto JSON della forma {"testo": "..."}, con gli a capo come \\n.
`

export const CATEGORIE_IA: Record<string, CategoriaIA> = {
  Hyrox: { chiave: 'blocks', parti: 'blocchi', istruzioni: ISTRUZIONI_HYROX },
  Running: { chiave: 'steps', parti: 'fasi', istruzioni: ISTRUZIONI_CORSA },
  Custom: { chiave: 'testo', testo: true, parti: 'descrizione', istruzioni: ISTRUZIONI_CUSTOM },
}

/**
 * La categoria di una richiesta. Senza `categoria` è Hyrox: è quello che
 * mandava l'app fino al 12/10/2026, e un'app vecchia deve continuare a
 * ricevere blocchi. Una categoria sconosciuta torna `null`: meglio un errore
 * che dei blocchi Hyrox dentro un allenamento che non li sa mostrare.
 */
export function categoriaIA(nome: unknown): string | null {
  if (nome === undefined || nome === null || nome === '') return 'Hyrox'
  return typeof nome === 'string' && Object.hasOwn(CATEGORIE_IA, nome) ? nome : null
}

/** Il prompt intero: le istruzioni della categoria, l'eventuale modifica e il testo del coach. */
export function promptCategoria(categoria: string, prompt: string, attuali?: unknown): string {
  const c = CATEGORIE_IA[categoria]
  const modifica = istruzioniModifica(attuali, categoria)
  return `${c.istruzioni}
${modifica ?? ''}
Testo dettato dall'utente: "${prompt}"
`
}

/** Il risultato di una categoria da un testo JSON. Altrimenti null. */
export function risultatoDaTesto(testo: string, categoria: string): unknown[] | string | null {
  const c = CATEGORIE_IA[categoria]
  try {
    const pulito = String(testo || '').replace(/```json/gi, '').replace(/```/g, '').trim()
    const dati = JSON.parse(pulito)
    if (c.testo) {
      const t = typeof dati === 'string' ? dati : dati?.[c.chiave]
      return typeof t === 'string' && t.trim() ? t.trim() : null
    }
    if (Array.isArray(dati)) return dati
    if (dati && Array.isArray(dati[c.chiave])) return dati[c.chiave]
    return null
  } catch {
    return null
  }
}

/** La richiesta a Groq per una categoria: stesso prompt, risposta in JSON. */
export function richiestaGroq(prompt: string, modello: string, categoria: string) {
  const c = CATEGORIE_IA[categoria]
  const forma = c.testo
    ? `{"${c.chiave}": "..."}, con il testo dentro "${c.chiave}"`
    : `{"${c.chiave}": [ ... ]}, con l'array dentro "${c.chiave}"`
  return {
    model: modello,
    temperature: 0.2,
    // La modalità JSON di Groq vuole un OGGETTO, non un array.
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: `${prompt}\n\nRestituisci un oggetto JSON della forma ${forma}.` }],
  }
}
