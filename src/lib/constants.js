// Ergometri: esercizi misurati in metri anziché in ripetizioni.
export const ERGOMETERS = ['SkiErg', 'Rowing', 'Assault Bike', 'Echo Bike', 'TrueForm Runner', 'Curve Treadmill']

// L'account del coach, nascosto dalla rubrica atleti.
export const COACHING_ID = '0118e43f-8791-4fd6-8032-bee028334c99'

/**
 * Le rubriche degli atleti (Athletes, Home, Analisi, report, messaggi…) non
 * mostrano chi sta guardando. Con più coach la RLS lascia a ognuno la propria
 * riga in `athletes` (auth.uid() = id), che non è un atleta da seguire: fuori
 * insieme al profilo storico del coach (`COACHING_ID`).
 */
export function escludiDallaRubrica(righe, idUtente) {
  return (righe || []).filter(a => a && a.id !== COACHING_ID && (!idUtente || a.id !== idUtente))
}
