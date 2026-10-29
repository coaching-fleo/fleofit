// Ergometri: esercizi misurati in metri anziché in ripetizioni.
export const ERGOMETERS = ['SkiErg', 'Rowing', 'Assault Bike', 'Echo Bike', 'TrueForm Runner', 'Curve Treadmill']

// L'account del coach, nascosto dalla rubrica atleti.
export const COACHING_ID = '0118e43f-8791-4fd6-8032-bee028334c99'

/**
 * Le rubriche degli atleti (Athletes, Home, Analisi, report, calendario team…)
 * tolgono solo il profilo storico del coach (`COACHING_ID`).
 * ⚠️ Chi sta guardando RESTA: un coach può allenarsi anche lui
 * (federico_leo@hotmail.it si assegna i suoi workout). Dal 16 al 28/10/2026
 * questa funzione toglieva anche lui, e la sua scheda era sparita ovunque.
 */
export function escludiDallaRubrica(righe) {
  return (righe || []).filter(a => a && a.id !== COACHING_ID)
}
