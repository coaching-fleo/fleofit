// riscontroAtleta.js — cosa ha lasciato UN atleta su un'assegnazione (26/11/2026).
//
// Lo legge `FoglioAtletaAssegnato`, il foglio che si apre toccando un atleta in
// «Assegnato a» della scheda workout. Logica pura, separata dal foglio, perché
// le note portano tre marcatori (RPE, gradimento, risultato gara) che non
// devono mai finire a schermo come se l'atleta li avesse scritti a mano.

import { rpeDichiarato, testoNota } from './rpe'
import { gradimentoDi } from './gradimento'
import { senzaRisultato } from './risultatoGara'

/**
 * @param {object} a una riga di `athlete_workouts` con `athletes(id, name, surname, photo_url)`
 * @returns {{ atletaId, nome, foto, fatto, data, rpe, gradimento, testo, vocale }}
 *   `rpe` e `gradimento` sono `null` quando l'atleta non li ha dati: mai un 5 di ripiego.
 */
export function riscontroAssegnazione(a) {
  const note = a?.notes || ''
  return {
    atletaId: a?.athletes?.id ?? null,
    nome: `${a?.athletes?.name || ''} ${a?.athletes?.surname || ''}`.trim() || 'Atleta',
    foto: a?.athletes?.photo_url || null,
    fatto: a?.status === 'completed',
    data: a?.completed_date || null,
    rpe: rpeDichiarato(note),
    gradimento: gradimentoDi(note),
    testo: senzaRisultato(testoNota(note)).trim(),
    vocale: a?.voice_note_url || null,
  }
}

/** Il colore dell'RPE, la stessa scala della scheda: ≤3 verde · ≤6 giallo · ≤8 arancione · >8 rosso. */
export function tonoRpe(rpe) {
  if (rpe == null) return 'text-gray-400'
  if (rpe <= 3) return 'text-green-400'
  if (rpe <= 6) return 'text-yellow-400'
  if (rpe <= 8) return 'text-orange-400'
  return 'text-red-400'
}
