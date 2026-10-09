// Il dialogo fra la ricerca del coach e l'IA: cosa le si dice, quali
// strumenti può chiamare, e il giro «l'IA chiede → l'app esegue → l'IA scrive».
//
// La Edge Function `ricerca-coach` è un passacarte: riceve la conversazione,
// la gira a Gemini con questi strumenti e restituisce la mossa successiva.
// 🔴 Le istruzioni e gli strumenti stanno QUI, non nella funzione, di
// proposito: cambiare una descrizione o aggiungere un filtro è una modifica
// all'app, non un deploy su un backend condiviso con la web app (CLAUDE.md §1.1).
// La funzione aggiunge per conto suo solo le regole che non devono dipendere
// dal client (rispondere in italiano, non inventare).
//
// Gli strumenti veri — cosa fanno sui dati — sono in `ricercaCoach.js`.

import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { eseguiStrumento, nomeAtleta, SCHERMATE } from './ricercaCoach'

/** Quanti giri «strumento → risposta» al massimo per una domanda. */
export const MASSIMO_GIRI = 4
/** Quante voci di conversazione si tengono per le domande di seguito. */
export const MASSIMO_STORIA = 16

const DATA = { type: 'string', description: 'Data nel formato yyyy-MM-dd.' }
// Gli atleti si passano per NOME, scritto come nell'elenco del contesto. Fino
// al 09/10/2026 c'era anche `atleta_id`, con l'elenco che portava gli id: 36
// caratteri per atleta in ogni richiesta, che con il ripiego su Groq (8.000
// token al minuto) facevano la differenza fra una risposta e un errore.
const ATLETA = {
  atleta: { type: 'string', description: "Nome e cognome dell'atleta, scritti come nell'elenco del contesto." },
}

/** Le dichiarazioni nel formato `functionDeclarations` di Gemini. */
export const DICHIARAZIONI = [
  {
    name: 'cercaWorkout',
    description: 'Cerca gli allenamenti: quelli assegnati agli atleti (un risultato per atleta + workout + data) e, se non filtri per atleta né per stato di esecuzione, anche i workout mai assegnati. Tutti i filtri sono facoltativi e si combinano.',
    parameters: {
      type: 'object',
      properties: {
        ...ATLETA,
        dal: DATA,
        al: DATA,
        stato: { type: 'string', enum: ['completato', 'da_fare', 'scaduto', 'non_assegnato'], description: 'scaduto = non completato con data passata; non_assegnato = workout creati e mai dati a nessun atleta.' },
        categoria: { type: 'string', enum: ['Hyrox', 'Running', 'Custom', 'Event'], description: 'Running = corsa, Custom = allenamento libero, Event = gara.' },
        tipo_blocco: { type: 'string', description: 'Tipo di blocco esatto: WarmUp, Cash In, ON/OFF, EMOM, AMRAP, For Time, Interval, Rest, Cash Out; per la corsa: warmup, run, recover, cooldown, repeat.' },
        esercizio: { type: 'array', items: { type: 'string' }, description: "Nomi o pezzi di nome di esercizi, ne basta uno (es. ['wall ball', 'sled push'])." },
        testo: { type: 'array', items: { type: 'string' }, description: 'Parole da cercare in titolo, note del coach, esercizi e distanze (es. ["400m"]). Ne basta una.' },
        durata_min: { type: 'integer', description: 'Durata stimata minima in minuti.' },
        durata_max: { type: 'integer', description: 'Durata stimata massima in minuti.' },
        distinti: { type: 'boolean', description: 'true = un risultato per workout anche se assegnato a più atleti. Usalo per trovare workout da riusare.' },
        ordine: { type: 'string', enum: ['recenti', 'vecchi'] },
      },
    },
  },
  {
    name: 'cercaAtleti',
    description: "Trova gli atleti che rispondono a TUTTE le condizioni date. Chi è in pausa è escluso da 'inattivi' e 'senza programma'. Usa SOLO i filtri che la domanda chiede.",
    parameters: {
      type: 'object',
      properties: {
        inattivi_da_giorni: { type: 'integer', description: "Atleti FERMI: non completano un allenamento da almeno N giorni. È il filtro per 'chi non si allena', 'chi è fermo', 'chi è inattivo', 'chi non fa niente da'." },
        senza_programma_giorni: { type: 'integer', description: "Atleti a cui il COACH non ha ancora assegnato nessun allenamento nei PROSSIMI N giorni (oggi compreso). Riguarda la programmazione futura, NON dice se l'atleta si allena: usalo solo per 'chi non ha niente in programma', 'chi devo ancora programmare', 'chi è scoperto'." },
        gara_entro_giorni: { type: 'integer', description: 'Ha una gara (Event) entro questi giorni da oggi.' },
        rpe_minimo: { type: 'integer', description: 'Ha dichiarato un RPE almeno di questo valore (1-10)...' },
        rpe_ultimi_giorni: { type: 'integer', description: '...negli ultimi N giorni (default 7).' },
        in_pausa: { type: 'boolean', description: 'true = solo gli atleti in pausa; false = escludili.' },
      },
    },
  },
  {
    name: 'statisticheAtleta',
    description: "I numeri di UN atleta su un periodo (default ultimi 30 giorni): assegnati, completati, scaduti, percentuale, RPE medio e massimo, minuti stimati, ultimo allenamento completato.",
    parameters: {
      type: 'object',
      properties: { ...ATLETA, dal: DATA, al: DATA },
    },
  },
  {
    name: 'cercaNelleNote',
    description: "Cerca nelle note SCRITTE dagli atleti alla chiusura degli allenamenti (dolori, sensazioni, problemi). Le note vocali non sono incluse.",
    parameters: {
      type: 'object',
      properties: {
        parole: { type: 'array', items: { type: 'string' }, description: 'Parole o radici da cercare, con sinonimi; ne basta una (es. ["ginocch", "menisco"]).' },
        ...ATLETA,
        dal: DATA,
        al: DATA,
      },
      required: ['parole'],
    },
  },
  {
    name: 'apri',
    description: "Apre una schermata dell'app. Usalo quando il coach chiede di aprire, mostrare, andare a, o creare/programmare un workout.",
    parameters: {
      type: 'object',
      properties: {
        schermata: { type: 'string', enum: SCHERMATE },
        ...ATLETA,
        workout_id: { type: 'string', description: 'Per schermata=workout: il workoutId di un risultato di cercaWorkout.' },
        data: { ...DATA, description: 'Per crea_workout: il giorno del workout (yyyy-MM-dd).' },
      },
      required: ['schermata'],
    },
  },
]

/** Come l'IA deve comportarsi. La funzione ci aggiunge le sue regole fisse. */
export const ISTRUZIONI = `Sei l'assistente di ricerca di un coach di Hyrox e corsa, dentro la sua app.
Il coach ti chiede di atleti, allenamenti, note e numeri. Per rispondere usi SOLO gli strumenti.

Regole:
- Chiama sempre uno strumento prima di rispondere su dati: non sai niente degli atleti se non da lì.
- Ogni numero che scrivi deve venire da un risultato. Non stimare, non arrotondare in modo diverso, non dedurre.
- Se uno strumento torna un errore o zero risultati, dillo semplicemente.
- Se più atleti corrispondono a un nome, chiedi quale intendeva, elencandoli.
- Il coach vede già sotto la tua risposta la lista dei risultati, toccabile: NON elencarli tutti.
  Scrivi una risposta breve (una o due frasi) che riassume, con al massimo tre nomi: con più risultati
  scrivi il numero e i primi tre nomi («9 atleti, fra cui …»).
- Esempi di scelta del filtro:
  «chi non si allena da 5 giorni?» / «chi è fermo?» → cercaAtleti { inattivi_da_giorni: 5 }
  «chi non ha niente in programma?» / «chi devo programmare?» → cercaAtleti { senza_programma_giorni: 3 }
  «chi ha una gara a novembre?» → cercaAtleti { gara_entro_giorni: … }
  «workout non fatti questa settimana» → cercaWorkout { stato: "scaduto", dal, al }
  «come va Marco?» → statisticheAtleta { atleta: "Marco …" }
- Date relative: calcola dal/al partendo da oggi. La settimana va da lunedì a domenica.
  «questa settimana» = da lunedì a oggi; «la settimana scorsa» = lunedì-domenica precedenti.
- Se c'è un campo "avviso" nel risultato, riportalo.
- Per aprire una schermata o creare un workout usa lo strumento apri, senza chiedere conferma.
- Se la domanda non riguarda atleti, allenamenti, note o schermate dell'app, rispondi che puoi
  aiutare solo con quelli.
- Non scrivere mai gli id. Niente markdown, niente elenchi puntati: è testo che si legge su un telefono.`

/** Il contesto della domanda: che giorno è, che dati ci sono, chi sono gli atleti. */
export function contestoPer(dati, oggi = new Date()) {
  const elenco = (dati?.atleti || []).map(nomeAtleta).join(', ')
  return `Oggi è ${format(oggi, 'EEEE d MMMM yyyy', { locale: it })} (${format(oggi, 'yyyy-MM-dd')}).
I dati disponibili vanno dal ${dati?.dal || '?'} al ${dati?.al || '?'}.
Atleti: ${elenco || '(nessuno)'}`
}

/** Vero se questa voce è una domanda scritta dal coach (e non una risposta di strumento). */
const eDomanda = (c) => c?.role === 'user' && (c.parts || []).some(p => typeof p.text === 'string')

/**
 * Accorcia la conversazione SENZA spezzare una coppia «chiamata → risposta»:
 * si taglia solo davanti a una domanda del coach. Gemini rifiuta una storia
 * che comincia con la risposta a una chiamata che non c'è più.
 */
export function tagliaStoria(contents = [], massimo = MASSIMO_STORIA) {
  if (contents.length <= massimo) return contents
  for (let i = contents.length - massimo; i < contents.length; i++) {
    if (eDomanda(contents[i])) return contents.slice(i)
  }
  // Una sola domanda lunghissima: si tiene dall'ultima domanda in poi.
  for (let i = contents.length - 1; i >= 0; i--) if (eDomanda(contents[i])) return contents.slice(i)
  return []
}

/** Il testo scritto dal modello, senza le parti di ragionamento. */
const testoDi = (contenuto) =>
  (contenuto?.parts || []).filter(p => typeof p.text === 'string' && !p.thought).map(p => p.text).join('').trim()

/**
 * Una domanda, fino alla risposta.
 *
 * @param invoca  async ({ contents, strumenti, istruzioni, contesto }) → { contenuto }
 *                — chiama la Edge Function. Iniettata, così i test non vanno in rete.
 * @returns { testo, risultati: [{ strumento, args, completo }], percorso, storia }
 *          `percorso` c'è quando l'IA ha chiesto di aprire una schermata: in quel
 *          caso si esce SUBITO, senza un altro giro, perché il coach sta andando via.
 */
export async function rispondi({ domanda, storia = [], dati, invoca, oggi = new Date(), massimoGiri = MASSIMO_GIRI }) {
  const contents = [...tagliaStoria(storia), { role: 'user', parts: [{ text: domanda }] }]
  const contesto = contestoPer(dati, oggi)
  const risultati = []

  for (let giro = 0; giro < massimoGiri; giro++) {
    // Una COPIA: `contents` cresce dopo la chiamata, e chi la riceve (la rete,
    // un test) deve vedere la conversazione com'era quando è partita.
    const { contenuto } = await invoca({ contents: [...contents], strumenti: DICHIARAZIONI, istruzioni: ISTRUZIONI, contesto })
    if (!contenuto || !Array.isArray(contenuto.parts)) throw new Error("L'IA non ha risposto.")
    contents.push({ role: 'model', parts: contenuto.parts })

    const chiamate = contenuto.parts.filter(p => p.functionCall)
    if (!chiamate.length) return { testo: testoDi(contenuto), risultati, percorso: null, storia: contents }

    const risposte = []
    for (const { functionCall } of chiamate) {
      const { completo, perIA } = eseguiStrumento(functionCall.name, functionCall.args, dati, oggi)
      risultati.push({ strumento: functionCall.name, args: functionCall.args || {}, completo })
      if (functionCall.name === 'apri' && completo?.percorso) {
        // ⚠️ La storia torna quella di PRIMA: questa finisce con una chiamata
        // senza risposta, e Gemini rifiuterebbe la domanda successiva.
        return { testo: testoDi(contenuto), risultati, percorso: completo.percorso, storia }
      }
      risposte.push({ functionResponse: { name: functionCall.name, response: perIA } })
    }
    contents.push({ role: 'user', parts: risposte })
  }

  // Troppi giri: si mostrano i risultati trovati, senza una frase inventata.
  // La storia torna quella di prima, per la stessa ragione di `apri`.
  return { testo: '', risultati, percorso: null, storia }
}
