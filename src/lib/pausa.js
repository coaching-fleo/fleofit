// «Atleta in pausa»: chi ha chiesto una sosta e non deve comparire fra quelli
// che richiedono attenzione, restando però nella rubrica.
//
// 🔴 PERCHÉ NON È UNA COLONNA. Lo schema del database è congelato fino
// all'approvazione su App Store (CLAUDE.md regola 0-bis): `athletes.is_paused`
// sarebbe una migrazione, e il database è lo stesso che serve la web app in
// produzione, senza staging. Lo stato vive quindi dentro `athletes.notes` — la
// nota che il coach scrive per l'atleta — con lo stesso meccanismo già usato
// per l'RPE dentro `athlete_workouts.notes` (CLAUDE.md §4).
//
// ⚠️ Le tre conseguenze da conoscere PRIMA di dire che è un bug:
// 1. La web app su `main` non conosce il marcatore. Se il coach modifica la
//    nota da lì, il prefisso può sparire e l'atleta torna fra quelli da
//    chiamare. È lo stesso rischio dell'RPE, e si comporta bene: il guasto è
//    VISIBILE (l'atleta ricompare) e si ripara con un tocco, non perde dati.
// 2. Chiunque scriva `athletes.notes` deve passare da qui. `formatNotePausa`
//    esiste perché la modale «Modifica profilo» faceva `.update({ notes })`
//    con il testo grezzo, e senza round-trip avrebbe cancellato la pausa a ogni
//    salvataggio.
// 3. Quella nota la LEGGE anche l'atleta, ed è voluto (§4): è scritta per lui.
//    Quindi il marcatore non va mai mostrato grezzo — si rende sempre `.testo` —
//    e il round-trip del punto 2 deve valere anche quando è l'atleta a salvare
//    il proprio profilo, non solo il coach.
//
// La forma definitiva — una colonna booleana — è in BACKLOG, da fare dopo
// l'approvazione.

/** `[PAUSA]` oppure `[PAUSA: 2026-08-27]`, sempre in testa alla nota. */
const MARCATORE = /^\[PAUSA(?::\s*(\d{4}-\d{2}-\d{2}))?\]\s*\n?/

/**
 * Separa lo stato di pausa dal testo della nota.
 *
 * Torna sempre un oggetto completo, anche su `null`: il chiamante non deve mai
 * chiedersi se il dato c'è.
 */
export const parseNotePausa = (notes) => {
  const grezzo = notes == null ? '' : String(notes)
  const trovato = grezzo.match(MARCATORE)
  if (!trovato) return { inPausa: false, dal: null, testo: grezzo }
  return { inPausa: true, dal: trovato[1] || null, testo: grezzo.slice(trovato[0].length) }
}

/**
 * Ricompone la nota con il marcatore in testa.
 *
 * ⚠️ Il testo viene ripulito di un eventuale marcatore residuo: senza, salvare
 * due volte di seguito produrrebbe `[PAUSA: …]\n[PAUSA: …]\n…` e la seconda
 * copia diventerebbe testo visibile.
 */
export const formatNotePausa = (dal, testo) => {
  const pulito = parseNotePausa(testo).testo
  return `[PAUSA${dal ? `: ${dal}` : ''}]\n${pulito}`
}

/** Vero se questo atleta è in pausa. Accetta la riga `athletes` intera. */
export const inPausa = (atleta) => parseNotePausa(atleta?.notes).inPausa
