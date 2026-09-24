// Il gradimento di un allenamento: «mi è piaciuto», «non mi è piaciuto» o
// «nessuna preferenza», chiesto dal recap post-allenamento (24/09/2026).
//
// 🔴 NON È UNA COLONNA, ED È LA STESSA SCELTA DELL'RPE E DELLA PAUSA. Lo schema
// è congelato fino all'approvazione su App Store (CLAUDE.md regola 0-bis), e
// il dato sta dentro `athlete_workouts.notes` come marcatore, subito dopo
// quello dell'RPE:
//
//     [RPE: 7/10]
//     [GRADIMENTO: si]
//     testo libero dell'atleta
//
// Tre valori veri più l'assenza, e sono QUATTRO risposte diverse:
//   'si'      → gli è piaciuto
//   'no'      → non gli è piaciuto
//   'nessuna' → ha visto la domanda e ha scelto di non rispondere («Salta»)
//   null      → la domanda non gli è mai stata fatta (recap chiuso prima,
//               allenamenti di prima del 24/09, completamento dal coach)
// ⚠️ `nessuna` e `null` NON si fondono: il primo è una risposta — «non ho
// un'opinione» — e il committente l'ha chiesta esplicitamente per il coach;
// il secondo è l'assenza della domanda. Contarli insieme farebbe sembrare
// indifferenti gli atleti a cui non si è mai chiesto niente.
//
// ⚠️ È VISIBILE SOLO AL COACH NELL'INTERFACCIA, non nel dato: la riga è
// dell'atleta, e un atleta che chiamasse l'API la leggerebbe. Il marcatore
// nasconde, non cifra — la stessa nota di `pausa.js` (§9-decies).
//
// ⚠️ La web app su `main` non conosce il marcatore: lì compare come testo
// grezzo dentro la nota, esattamente come `[RPE: 7/10]` (CLAUDE.md §1.1).

export const GRADIMENTI = ['si', 'no', 'nessuna']

// Il marcatore, dovunque sia in testa al testo che segue l'RPE.
const MARCATORE = /^\[GRADIMENTO:\s*(si|no|nessuna)\]\s*\n?/
const RPE = /^\[RPE:\s*\d+\/10\]\s*\n?/

/** Separa il prefisso dell'RPE (se c'è) dal resto della nota. */
function dividi(note) {
  const s = String(note || '')
  const m = s.match(RPE)
  return m ? [m[0], s.slice(m[0].length)] : ['', s]
}

/** Il gradimento registrato, o `null` se la domanda non è mai stata fatta. */
export function gradimentoDi(note) {
  if (!note) return null
  const [, resto] = dividi(note)
  const m = resto.match(MARCATORE)
  return m ? m[1] : null
}

/** Il testo che segue l'RPE, senza il marcatore del gradimento. */
export function senzaGradimento(testo) {
  return String(testo || '').replace(MARCATORE, '')
}

/**
 * La nota con il gradimento impostato (o tolto, con `null`).
 *
 * ⚠️ Il marcatore va DOPO l'RPE e mai prima: `rpeDichiarato` e le tre copie
 * del suo regex in `statisticheCoach`, `reportSettimanale` e `reportAtleta`
 * leggono `^\[RPE:` ancorato all'inizio. Messo davanti, ogni RPE del progetto
 * tornerebbe `null` senza un solo errore.
 */
export function conGradimento(note, valore) {
  const [rpe, resto] = dividi(note)
  const testo = senzaGradimento(resto)
  if (!GRADIMENTI.includes(valore)) return `${rpe}${testo}`
  return `${rpe}[GRADIMENTO: ${valore}]\n${testo}`
}

/**
 * Il gradimento che il recap deve scrivere quando l'atleta preme «Salta».
 *
 * ⚠️ «Salta» non cancella un parere già dato. Chi aveva messo «mi è piaciuto»
 * e rifà il completamento (segna da fare, poi di nuovo fatto) si vede
 * rifare la domanda: saltarla vuol dire «non ho niente da aggiungere», non
 * «ritiro quello che avevo detto».
 */
export function gradimentoDopoSalta(note) {
  const attuale = gradimentoDi(note)
  return attuale === 'si' || attuale === 'no' ? attuale : 'nessuna'
}

/**
 * Il conteggio per il coach, su un insieme di assegnazioni.
 *
 * Torna `null` quando nessuno ha ancora risposto — nemmeno «nessuna
 * preferenza»: è la regola di tutta l'app, nessuna cella mostra uno zero al
 * posto di un dato che non esiste ancora. Chi non è mai stato interpellato
 * non entra in nessuno dei tre numeri (vedi la nota in testa).
 */
export function riepilogoGradimento(assegnazioni = []) {
  const conteggio = { si: 0, no: 0, nessuna: 0 }
  for (const a of assegnazioni) {
    const g = gradimentoDi(a?.notes)
    if (g) conteggio[g]++
  }
  const risposte = conteggio.si + conteggio.no + conteggio.nessuna
  return risposte > 0 ? { ...conteggio, risposte } : null
}
