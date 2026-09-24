import { gradimentoDi, senzaGradimento, conGradimento } from './gradimento'

// L'RPE è codificato dentro athlete_workouts.notes come "[RPE: 7/10]\ntesto".
// ⚠️ La web app su main NON conosce questo formato: se l'atleta modifica la nota
// da lì, il prefisso può essere cancellato e l'RPE va perso. Vedi CLAUDE.md §1.1.
//
// ⚠️ Dal 24/09/2026 dopo l'RPE può esserci anche `[GRADIMENTO: …]`
// (src/lib/gradimento.js). `text` lo toglie sempre — è il testo che l'atleta
// ha scritto, e il marcatore non si deve vedere in nessuna nota — e
// `gradimento` lo riporta, perché chi riscrive la nota lo rimetta: senza il
// round-trip, correggere una virgola cancellerebbe il parere in silenzio. È
// la stessa trappola di `formatNotePausa` (§9-decies punto 2).
export const parseNotesAndRpe = (fullNote) => {
  if (!fullNote) return { rpe: 5, text: '', gradimento: null }
  const gradimento = gradimentoDi(fullNote)
  const match = fullNote.match(/^\[RPE:\s*(\d+)\/10\]\s*\n?/)
  if (match) return { rpe: parseInt(match[1], 10), text: senzaGradimento(fullNote.substring(match[0].length)), gradimento }
  return { rpe: 5, text: senzaGradimento(fullNote), gradimento }
}

export const formatNotesWithRpe = (rpe, text, gradimento = null) =>
  conGradimento(`[RPE: ${rpe}/10]\n${senzaGradimento(text)}`, gradimento)

/**
 * Il testo libero dell'atleta, senza RPE e senza gradimento. È ciò che si
 * cita nei feedback del coach e nei report: un marcatore lì dentro si
 * leggerebbe come una nota scritta a mano.
 */
export const testoNota = (fullNote) =>
  senzaGradimento(String(fullNote || '').replace(/^\[RPE:\s*\d+\/10\]\s*/, '')).trim()

/**
 * L'RPE che l'atleta ha DAVVERO segnato, oppure `null` se non l'ha segnato.
 *
 * ⚠️ Serve perché `parseNotesAndRpe` torna 5 quando il marcatore non c'è, e
 * quel 5 è il valore giusto per il cursore della modale — ma è un valore
 * inventato per chiunque faccia una media. Il guardiano `Number.isFinite(rpe)`
 * non protegge da niente: 5 è finito. Chi calcola statistiche deve sapere se
 * il dato esiste, non ricevere un ripiego travestito da misura.
 */
export const rpeDichiarato = (fullNote) => {
  if (!fullNote) return null
  const match = String(fullNote).match(/^\[RPE:\s*(\d+)\/10\]/)
  return match ? parseInt(match[1], 10) : null
}
