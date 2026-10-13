/**
 * «Genera con IA» per ogni categoria del builder (12/10/2026).
 *
 * Richiesta del committente: la generazione con IA su TUTTE le categorie —
 * Hyrox, Corsa, Custom — e su tutte quelle che verranno. Fino ad allora il
 * foglio sapeva scrivere solo blocchi Hyrox.
 *
 * 🔴 UNA CATEGORIA NUOVA IN `CATEGORIE` (src/pages/CreateWorkout.jsx) VA
 * AGGIUNTA QUI E IN `CATEGORIE_IA` di supabase/functions/ai-workout/regole.ts.
 * src/lib/__tests__/iaCategorie.test.js fallisce finché ne manca una, e
 * CreaWorkoutIA.test.jsx controlla che il passo 2 di ogni categoria mostri la
 * card. Non è facoltativo: è una regola del committente (CLAUDE.md §0).
 *
 * Ogni voce dice tre cose:
 * - `chiave`: dove sta il risultato nella risposta di `ai-workout` (`blocks`,
 *   `steps`, `testo`) — la stessa chiave del server;
 * - `perIA` / `prepara`: come l'allenamento del builder va all'IA in una
 *   modifica, e come la risposta torna uguale a una cosa fatta a mano;
 * - le parole del foglio, che dicono COSA verrà scritto («i blocchi», «le
 *   fasi», «la descrizione»).
 */

import { blocchiPerIA, fasiPerIA, preparaBlocchiIA, preparaFasiIA } from './blocchiIA'

const descrizione = (t) => (typeof t === 'string' ? t.trim() : '')

export const IA_PER_CATEGORIA = {
  Hyrox: {
    chiave: 'blocks',
    perIA: blocchiPerIA,
    prepara: preparaBlocchiIA,
    card: { genera: 'Descrivi l\'obiettivo, ti scrivo i blocchi', modifica: 'Chiedi una modifica ai blocchi che hai' },
    foglio: { genera: 'Descrivi l\'obiettivo, ti scrivo i blocchi', modifica: 'Chiedi una modifica, riscrivo i blocchi' },
    esempio: {
      genera: 'Es: EMOM da 12 minuti, 15 burpees e 10 box jump a minuti alterni…',
      modifica: 'Es: porta l\'EMOM a 16 minuti, togli il Cash Out, 20 wall balls al posto dei burpees…',
    },
    nota: {
      genera: 'I blocchi generati si aggiungono a quelli che hai già: puoi correggerli uno per uno.',
      modifica: 'Lavoro sui blocchi che hai già, anche quelli fatti a mano: cambio solo quello che chiedi, e puoi annullare.',
    },
    scrivo: 'Scrivo i blocchi',
    attesa: { voce: 'Ascolto la registrazione e la traduco in blocchi.', testo: 'Leggo la descrizione e scrivo i blocchi.' },
    modificati: 'Blocchi modificati con l\'IA',
    vuoto: 'L\'IA non ha restituito nessun blocco: l\'allenamento è rimasto com\'era.',
  },
  Running: {
    chiave: 'steps',
    perIA: fasiPerIA,
    prepara: preparaFasiIA,
    card: { genera: 'Descrivi la seduta, ti scrivo le fasi', modifica: 'Chiedi una modifica alle fasi che hai' },
    foglio: { genera: 'Descrivi la seduta, ti scrivo le fasi', modifica: 'Chiedi una modifica, riscrivo le fasi' },
    esempio: {
      genera: 'Es: 15 minuti di riscaldamento, 8 × 400 a 3:45 con 1 minuto di recupero, 10 minuti di defaticamento…',
      modifica: 'Es: porta le ripetute a 10, recupero 90 secondi, togli il defaticamento…',
    },
    nota: {
      genera: 'Le fasi generate si aggiungono a quelle che hai già: puoi correggerle una per una.',
      modifica: 'Lavoro sulle fasi che hai già, anche quelle fatte a mano: cambio solo quello che chiedi, e puoi annullare.',
    },
    scrivo: 'Scrivo le fasi',
    attesa: { voce: 'Ascolto la registrazione e la traduco in fasi.', testo: 'Leggo la descrizione e scrivo le fasi.' },
    modificati: 'Fasi modificate con l\'IA',
    vuoto: 'L\'IA non ha restituito nessuna fase: l\'allenamento è rimasto com\'era.',
  },
  Custom: {
    chiave: 'testo',
    perIA: descrizione,
    prepara: descrizione,
    card: { genera: 'Detta l\'allenamento, ti scrivo la descrizione', modifica: 'Chiedi una modifica alla descrizione' },
    foglio: { genera: 'Detta l\'allenamento, ti scrivo la descrizione', modifica: 'Chiedi una modifica, riscrivo la descrizione' },
    esempio: {
      genera: 'Es: 4 giri di 10 affondi per gamba, 15 push up e 30 secondi di plank, 1 minuto di pausa…',
      modifica: 'Es: aggiungi un riscaldamento di 10 minuti, porta i giri a 5…',
    },
    nota: {
      genera: 'La descrizione va nel campo qui sotto: puoi correggerla a mano.',
      modifica: 'Lavoro sulla descrizione che hai già: cambio solo quello che chiedi, e puoi annullare.',
    },
    scrivo: 'Scrivo la descrizione',
    attesa: { voce: 'Ascolto la registrazione e scrivo la descrizione.', testo: 'Leggo quello che hai scritto e preparo la descrizione.' },
    modificati: 'Descrizione modificata con l\'IA',
    vuoto: 'L\'IA non ha restituito nessuna descrizione: l\'allenamento è rimasto com\'era.',
  },
}

/** La voce di una categoria, o `null` se la categoria non ce l'ha. */
export const iaDellaCategoria = (categoria) =>
  (Object.hasOwn(IA_PER_CATEGORIA, categoria) ? IA_PER_CATEGORIA[categoria] : null)

/** Vero se l'allenamento del builder c'è già: allora il foglio MODIFICA. */
export const haGiaContenuto = (attuali) =>
  (Array.isArray(attuali) ? attuali.length > 0 : typeof attuali === 'string' && attuali.trim() !== '')
