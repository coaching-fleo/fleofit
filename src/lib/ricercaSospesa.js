// La ricerca del coach messa in pausa mentre il coach guarda un risultato.
//
// Il foglio vive dentro la Home: toccare un atleta della lista porta alla sua
// scheda, la Home si smonta e con lei la conversazione. Tornando indietro il
// coach ritrovava la Home vuota, e doveva rifare la domanda per vedere il
// secondo nome della lista (09/10/2026).
//
// Sta in MEMORIA, non in localStorage, di proposito: deve sopravvivere a un
// giro fra le pagine, non a una chiusura dell'app — riaprire l'app con un
// foglio di ricerca di ieri spalancato sarebbe un altro difetto.
//
// ⚠️ `riapri` si consuma: il foglio si riapre UNA volta, al ritorno con il
// tasto indietro. Senza, ogni ritorno alla Home da qualunque pagina
// spalancherebbe la ricerca.

/** Dopo quanto i dati caricati non si riusano più e si rileggono. */
export const DATI_VALIDI_MS = 10 * 60 * 1000

let sospesa = null

/** Mette da parte la conversazione: `{ turni, storia, dati }`. */
export function sospendiRicerca(stato) {
  sospesa = { ...stato, riapri: true, quando: Date.now() }
}

/** La conversazione messa da parte, se c'è. Non la consuma. */
export const ricercaSospesa = () => sospesa

/**
 * Vero se la Home deve riaprire il foglio. NON lo consuma: la Home lo legge
 * nell'inizializzatore di uno stato, che React in sviluppo chiama due volte —
 * un valore che si consuma lì direbbe «sì» alla prima e «no» alla seconda.
 * Lo consuma il foglio, montandosi (`riaperta`).
 */
export const daRiaprire = () => !!sospesa?.riapri

/** Il foglio si è riaperto: il prossimo ritorno in Home non lo riapre più. */
export function riaperta() {
  if (sospesa) sospesa = { ...sospesa, riapri: false }
}

/** I dati messi da parte, se non sono troppo vecchi. */
export function datiSospesi(ora = Date.now()) {
  if (!sospesa?.dati || ora - sospesa.quando > DATI_VALIDI_MS) return null
  return sospesa.dati
}

/** Il coach ha chiuso il foglio: la conversazione è finita. */
export function dimenticaRicerca() {
  sospesa = null
}
