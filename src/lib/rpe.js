// L'RPE è codificato dentro athlete_workouts.notes come "[RPE: 7/10]\ntesto".
// ⚠️ La web app su main NON conosce questo formato: se l'atleta modifica la nota
// da lì, il prefisso può essere cancellato e l'RPE va perso. Vedi CLAUDE.md §1.1.
export const parseNotesAndRpe = (fullNote) => {
  if (!fullNote) return { rpe: 5, text: '' }
  const match = fullNote.match(/^\[RPE:\s*(\d+)\/10\]\s*\n?/)
  if (match) return { rpe: parseInt(match[1], 10), text: fullNote.substring(match[0].length) }
  return { rpe: 5, text: fullNote }
}

export const formatNotesWithRpe = (rpe, text) => `[RPE: ${rpe}/10]\n${text || ''}`

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
