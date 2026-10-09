// Le regole della Edge Function `estrai-note`, senza Deno né rete.
//
// Stanno in un file a parte e PURO, come quelle di `segnalazione`, perché così
// Vitest le prova da `src/lib/__tests__/estraiNoteServer.test.js`, e l'app le
// importa per le stesse due regole che usa anche lei (`testoPulito`,
// `impronta`): una copia sola fra telefono e server.
//
// 🔴 L'IA NON È UNA FONTE. Quello che torna da Groq è una proposta: qui si
// decide cosa diventa un dato. Una voce vale solo se la sua citazione sta
// DAVVERO nella nota, e un numero vale solo se lo si ricava da come l'atleta
// l'ha scritto (`grezzo`) — il valore lo calcola questa funzione, mai l'IA.
// Una voce che non passa si scarta da sola; la nota no.
//
// Standard v1 (spec: docs/superpowers/specs/2026-10-09-dati-dalle-note-design.md):
// niente dolori, sonno, stress, malattia, ciclo, alimentazione. Sono dati
// relativi alla salute e restano fuori finché il committente non ha chiuso le
// verifiche di privacy (§7.2 della spec).

export const VERSIONE = 1
export const GRUPPO = 15
export const MAX_GRUPPI = 3

export const FATTORI = ['stanchezza', 'motivazione', 'viaggio', 'lavoro']
export const MISURE = ['tempo', 'kg', 'reps', 'round', 'distanza', 'passo']
export const DIFFICOLTA = ['troppo_facile', 'giusta', 'troppo_dura']
export const TIPI_MODIFICA = ['saltato', 'ridotto', 'sostituito', 'aggiunto']
const SEGNI = [-1, 0, 1]

// ── Il testo che si analizza ────────────────────────────────────────────────
// ⚠️ Copia delle regole di `src/lib/rpe.js` (`testoNota`) e
// `src/lib/gradimento.js`: Deno non può importare `src/lib`. Un test verifica
// che diano lo stesso risultato; se un marcatore cambia lì, cambia qui.
const RPE = /^\[RPE:\s*\d+\/10\]\s*/
const GRADIMENTO = /^\[GRADIMENTO:\s*(si|no|nessuna)\]\s*\n?/

/** Il testo libero dell'atleta, senza RPE e gradimento: l'unica cosa che va all'IA. */
export const testoPulito = (note: string | null | undefined): string =>
  String(note || '').replace(RPE, '').replace(GRADIMENTO, '').trim()

/**
 * FNV-1a a 32 bit, in esadecimale. Serve a sapere se una nota è cambiata
 * dopo l'estrazione, non a proteggere niente: per questo basta, ed è
 * sincrona (la SHA di WebCrypto non lo è).
 */
export function impronta(testo: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < testo.length; i++) {
    h ^= testo.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

// ── Gli esercizi del workout ────────────────────────────────────────────────
// L'IA può agganciare un risultato solo a uno di questi nomi. Il formato
// legacy (warmup/cashIn/main/cashOut) esiste ancora nei workout vecchi
// (CLAUDE.md §5): si legge anche quello.
const LEGACY = ['warmup', 'cashIn', 'main', 'cashOut']

export function eserciziDelWorkout(sections: any): string[] {
  if (!sections || typeof sections !== 'object') return []
  if (sections.category === 'Running') return ['Corsa']
  const blocchi = [
    ...(Array.isArray(sections.blocks) ? sections.blocks : []),
    ...LEGACY.flatMap(k => (Array.isArray(sections[k]) ? sections[k] : [])),
  ]
  const nomi = blocchi.flatMap((b: any) => (Array.isArray(b?.exercises) ? b.exercises : []))
    .map((e: any) => String(e?.name || '').trim())
    .filter(Boolean)
  return [...new Set(nomi)]
}

// ── I numeri ────────────────────────────────────────────────────────────────
const numero = (s: string) => Number(s.replace(',', '.'))

/**
 * Il valore normalizzato (secondi, metri, secondi/km, kg) da come l'atleta
 * l'ha scritto, o `null`. Nessuna lettura «a parole»: «circa sei minuti» non
 * è un tempo, è una frase.
 */
export function valoreDaGrezzo(misura: string, grezzo: string): { valore: number, unita: string } | null {
  // iOS trasforma ' e " in apici tipografici mentre si scrive (Smart
  // Punctuation, attiva di serie): 4'55" arriva come 4’55”. Senza questa
  // riga i tempi e i passi scritti su iPhone sparivano senza lasciare traccia.
  const g = String(grezzo || '').trim().toLowerCase()
    .replace(/[’‘′]/g, "'").replace(/[”“″]/g, '"')
  if (!g) return null
  let m: RegExpMatchArray | null
  switch (misura) {
    case 'tempo': {
      if ((m = g.match(/^(\d{1,2}):(\d{2}):(\d{2})$/))) {
        if (+m[2] > 59 || +m[3] > 59) return null
        return { valore: +m[1] * 3600 + +m[2] * 60 + +m[3], unita: 's' }
      }
      if ((m = g.match(/^(\d{1,3})[:'](\d{2})"?$/))) {
        if (+m[2] > 59) return null
        return { valore: +m[1] * 60 + +m[2], unita: 's' }
      }
      if ((m = g.match(/^(\d+(?:[.,]\d+)?)\s*(?:s|sec|secondi|")$/))) return { valore: numero(m[1]), unita: 's' }
      if ((m = g.match(/^(\d+(?:[.,]\d+)?)\s*(?:min|minuti|')$/))) return { valore: Math.round(numero(m[1]) * 60), unita: 's' }
      return null
    }
    case 'kg':
      return (m = g.match(/^(\d+(?:[.,]\d+)?)\s*(?:kg|chili|kili)?$/)) ? { valore: numero(m[1]), unita: 'kg' } : null
    case 'reps':
      return (m = g.match(/^(\d+)\s*(?:reps?|ripetizioni|rip)?$/)) ? { valore: +m[1], unita: 'reps' } : null
    case 'round':
      return (m = g.match(/^(\d+)\s*(?:round|rounds|giri)?$/)) ? { valore: +m[1], unita: 'round' } : null
    case 'distanza': {
      if ((m = g.match(/^(\d+(?:[.,]\d+)?)\s*(?:km|k)$/))) return { valore: Math.round(numero(m[1]) * 1000), unita: 'm' }
      if ((m = g.match(/^(\d+(?:[.,]\d+)?)\s*(?:m|mt|metri)$/))) return { valore: Math.round(numero(m[1])), unita: 'm' }
      return null
    }
    case 'passo': {
      m = g.match(/^(\d{1,2})[:'](\d{2})"?\s*(?:\/\s*km|al km)?$/)
      if (!m || +m[2] > 59) return null
      return { valore: +m[1] * 60 + +m[2], unita: 's/km' }
    }
    default:
      return null
  }
}

// ── La validazione ──────────────────────────────────────────────────────────
// Confronto «a occhio umano»: senza maiuscole, accenti e spazi doppi. L'IA
// riporta spesso la citazione con una maiuscola in più, e non è un'invenzione.
const piana = (s: unknown) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/\s+/g, ' ').trim()

const citazioneVera = (c: unknown, testo: string) =>
  typeof c === 'string' && piana(c).length >= 3 && piana(testo).includes(piana(c))

const canonico = (nome: unknown, esercizi: string[]) =>
  esercizi.find(e => piana(e) === piana(nome) && piana(nome) !== '') ?? null

const lista = (v: unknown): any[] => (Array.isArray(v) ? v : [])

export type Estrazione = {
  stato: { fattore: string, segno: number, citazione: string }[],
  risultati: { esercizio: string | null, misura: string, grezzo: string, valore: number, unita: string, citazione: string }[],
  sensazioni: {
    difficolta: string | null, citazione: string | null,
    modifiche: { tipo: string, esercizio: string | null, citazione: string }[],
  },
}

export function validaEstrazione(grezza: unknown, testo: string, esercizi: string[]): Estrazione {
  const g: any = grezza && typeof grezza === 'object' ? grezza : {}

  const stato = lista(g.stato)
    .filter(s => FATTORI.includes(s?.fattore) && SEGNI.includes(s?.segno) && citazioneVera(s?.citazione, testo))
    .map(s => ({ fattore: s.fattore, segno: s.segno, citazione: s.citazione }))

  const risultati = lista(g.risultati).flatMap(r => {
    if (!MISURE.includes(r?.misura) || !citazioneVera(r?.citazione, testo)) return []
    if (typeof r.grezzo !== 'string' || !piana(r.citazione).includes(piana(r.grezzo))) return []
    const v = valoreDaGrezzo(r.misura, r.grezzo)
    if (!v) return []
    return [{ esercizio: canonico(r.esercizio, esercizi), misura: r.misura, grezzo: r.grezzo, valore: v.valore, unita: v.unita, citazione: r.citazione }]
  })

  const s: any = g.sensazioni && typeof g.sensazioni === 'object' ? g.sensazioni : {}
  const conDifficolta = DIFFICOLTA.includes(s.difficolta) && citazioneVera(s.citazione, testo)
  const modifiche = lista(s.modifiche)
    .filter(m => TIPI_MODIFICA.includes(m?.tipo) && citazioneVera(m?.citazione, testo))
    .map(m => ({ tipo: m.tipo, esercizio: canonico(m.esercizio, esercizi), citazione: m.citazione }))

  return {
    stato,
    risultati,
    sensazioni: {
      difficolta: conDifficolta ? s.difficolta : null,
      citazione: conDifficolta ? s.citazione : null,
      modifiche,
    },
  }
}

// ── Cosa fare, nota per nota ────────────────────────────────────────────────
type Riga = { id: string, status: string, notes: string | null, [k: string]: unknown }
type Esistente = { athlete_workout_id: string, impronta: string, versione: number }

const daAnalizzare = (r: Riga) => r.status === 'completed' && testoPulito(r.notes) !== ''

/** Le assegnazioni completate con testo che non hanno un estratto attuale. */
export function daEstrarre<T extends Riga>(righe: T[], esistenti: Esistente[]): T[] {
  const per = new Map(esistenti.map(e => [e.athlete_workout_id, e]))
  return righe.filter(r => {
    if (!daAnalizzare(r)) return false
    const e = per.get(r.id)
    return !e || e.versione !== VERSIONE || e.impronta !== impronta(testoPulito(r.notes))
  })
}

/**
 * Gli estratti da togliere: l'assegnazione è tornata «da fare», la nota è
 * stata svuotata, o la riga non c'è più. Un estratto orfano nei grafici
 * direbbe una cosa che l'atleta non dice più.
 */
export function daCancellare(righe: Riga[], esistenti: Esistente[]): string[] {
  const vive = new Set(righe.filter(daAnalizzare).map(r => r.id))
  return esistenti.map(e => e.athlete_workout_id).filter(id => !vive.has(id))
}

// ── Il giro con Groq ────────────────────────────────────────────────────────
const ISTRUZIONI = `Sei un assistente che legge le note scritte da atleti di Hyrox e corsa dopo un allenamento, in italiano.
Per ogni nota estrai SOLO ciò che è scritto, in JSON, con questa forma:
{"note":[{"i":<indice della nota>,
  "stato":[{"fattore":"stanchezza|motivazione|viaggio|lavoro","segno":-1|0|1,"citazione":"<parole esatte della nota>"}],
  "risultati":[{"esercizio":"<uno dei nomi in esercizi, o null>","misura":"tempo|kg|reps|round|distanza|passo","grezzo":"<il numero come è scritto, es. 6:40, 9kg, 1,2 km>","citazione":"<parole esatte della nota>"}],
  "sensazioni":{"difficolta":"troppo_facile|giusta|troppo_dura|null","citazione":"<parole esatte o null>",
    "modifiche":[{"tipo":"saltato|ridotto|sostituito|aggiunto","esercizio":"<uno dei nomi in esercizi, o null>","citazione":"<parole esatte della nota>"}]}}]}
Regole:
- "citazione" copia le parole ESATTE della nota, senza riassumere.
- "grezzo" copia il numero come l'atleta l'ha scritto; non fare conversioni.
- segno: -1 peggio del normale, 0 normale, 1 meglio del normale.
- Se la nota non parla di un fattore, NON aggiungerlo. Liste vuote se non c'è niente.
- Non estrarre dolori, infortuni, sonno, stress, malattie, ciclo, alimentazione o altri dati di salute.
- Rispondi solo con il JSON, una voce per ogni nota ricevuta.`

/** Il corpo per Groq (formato OpenAI). Solo testo ed esercizi: niente che dica chi è l'atleta. */
export function richiestaGroq(note: { i: number, testo: string, esercizi: string[] }[], modello: string) {
  return {
    model: modello,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: ISTRUZIONI },
      { role: 'user', content: JSON.stringify({ note: note.map(n => ({ i: n.i, testo: n.testo, esercizi: n.esercizi })) }) },
    ],
  }
}

/** La risposta di Groq per indice di nota, o `null` se non è il JSON atteso. */
export function rispostaDaGroq(contenuto: string): Map<number, unknown> | null {
  let dati: any
  try { dati = JSON.parse(contenuto) } catch { return null }
  if (!dati || !Array.isArray(dati.note)) return null
  // `Number`: i modelli scrivono spesso l'indice come stringa ("0").
  return new Map(dati.note
    .filter((n: any) => Number.isInteger(Number(n?.i)) && String(n?.i).trim() !== '')
    .map((n: any) => [Number(n.i), n]))
}

/**
 * Vero se la risposta parla di almeno una nota del gruppo (indici 0..n-1).
 * ⚠️ Una risposta «valida» ma vuota farebbe salvare tutte le note del gruppo
 * come estratti VUOTI, cioè «già lette» per sempre: va trattata come un
 * fallimento, e il gruppo riprova alla prossima apertura.
 */
export function rispostaUtile(mappa: Map<number, unknown>, n: number): boolean {
  for (let i = 0; i < n; i++) if (mappa.has(i)) return true
  return false
}

/**
 * La riga di log di un errore di Groq: stato, codice e tipo, NIENT'ALTRO.
 * 🔴 In modalità JSON Groq risponde 400 con `error.failed_generation`, che è
 * l'uscita del modello — cioè le parole delle note. Non deve finire nei log.
 */
export function rigaLogErrore(stato: number, dati: any): string {
  const e = dati?.error
  return [`estrai-note: Groq ${stato}`, e?.code, e?.type].filter(Boolean).join(' · ')
}
