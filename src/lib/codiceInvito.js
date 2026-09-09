/**
 * Il codice invito: come si legge, come si disegna, e cosa si dice quando il
 * database lo rifiuta.
 *
 * Sta in `lib/` e non dentro `Login.jsx` per la ragione di sempre: è logica
 * pura, quindi è l'unica parte di questo schermo che si può provare senza
 * montare una pagina — e i due punti che la usano (le caselle e l'arrivo dal
 * link del coach) devono normalizzare allo stesso modo o il link entra in un
 * modo e la digitazione in un altro.
 */

/**
 * Otto caratteri, e non è un numero scelto qui: è la lunghezza che
 * `generaCodice` produce in `Settings.jsx`
 * (`[...Array(8)].map(() => Math.random().toString(36)[2]).join('').toUpperCase()`),
 * cioè cifre e lettere maiuscole. Le caselle a schermo sono otto perché i
 * codici sono lunghi otto: se un giorno il generatore cambia, cambia qui.
 */
export const LUNGHEZZA_CODICE = 8

/** Dove va la stanghetta fra i due gruppi di caselle. */
export const GRUPPO_CODICE = 4

/**
 * Riporta un testo qualsiasi alla forma con cui il codice sta nel database.
 *
 * 🔴 Accetta anche il LINK, e non è una comodità: è come il codice arriva
 * davvero. Impostazioni → Codici invito offre «Copia codice» **e** «Copia
 * link», e il link (`https://fleofit.vercel.app/?invite=7KQ2M4XB`) è quello
 * che si manda su WhatsApp, perché apre l'app da solo. Chi lo incolla in un
 * campo che tiene solo lettere e numeri si ritrova dentro `HTTPSFLEOFI` — un
 * codice sbagliato, otto caratteri come quello giusto, e nessun errore che
 * spieghi perché non funziona.
 *
 * ⚠️ La stessa espressione riconosce sia `?invite=` (il link del coach) sia
 * `?inviteCode=` (il ritorno di OAuth, che `App.jsx` costruisce così): sono
 * due nomi per lo stesso parametro e nessuno dei due è negoziabile — il primo
 * è già stato mandato agli atleti, il secondo lo legge `ProtectedRoute`.
 */
export function normalizzaCodice(testo) {
  if (typeof testo !== 'string') return ''
  const daLink = testo.match(/[?&]invite(?:code)?=([^&\s]+)/i)
  const grezzo = daLink ? daLink[1] : testo
  return grezzo.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, LUNGHEZZA_CODICE)
}

/** Il codice è arrivato all'ottavo carattere: da qui la verifica parte da sola. */
export const codiceCompleto = (testo) => normalizzaCodice(testo).length === LUNGHEZZA_CODICE

/**
 * Le otto celle da disegnare.
 *
 * `attiva` è la casella in cui finirà il prossimo carattere, cioè il cursore:
 * a codice pieno **nessuna** è attiva, altrimenti la nona casella — che non
 * esiste — si prenderebbe il bordo ambra e a schermo sembrerebbe che manchi
 * ancora qualcosa proprio mentre la verifica sta partendo.
 */
export function celleCodice(testo) {
  const pulito = normalizzaCodice(testo)
  return Array.from({ length: LUNGHEZZA_CODICE }, (_, i) => ({
    carattere: pulito[i] || '',
    attiva: i === pulito.length,
  }))
}

/**
 * 🔴 «Non esiste» e «già usato» NON sono distinguibili dal client, e non è una
 * pigrizia di copy: è la RLS.
 *
 * La policy che serve chi non è ancora dentro è
 * `select ... using (is_active = true and used_by is null)`: un codice già
 * riscattato non torna dalla query **esattamente come** uno che non è mai
 * esistito. Dal client le due condizioni sono la stessa risposta vuota.
 * Separarle vorrebbe dire una policy nuova o una funzione `security definer`,
 * e lo schema è congelato fino all'approvazione su App Store (CLAUDE.md
 * regola 0-bis).
 *
 * Quindi il messaggio porta **entrambi** i rimedi in una frase sola — ricopia
 * il codice, o fattene dare uno nuovo — invece di sceglierne uno a caso.
 * Indovinare il rimedio sbagliato manda l'utente a rifare una cosa che ha già
 * fatto, ed è peggio che dargliene due.
 */
export const AVVISO_CODICE_RIFIUTATO = {
  titolo: 'Questo codice non è valido, o è già stato usato.',
  corpo: 'Ogni invito vale per un solo profilo. Controlla di averlo copiato per intero, oppure chiedi al tuo coach di generarne uno nuovo.',
}

/** Il database non ha risposto: è un guasto della linea, non un codice sbagliato. */
export const AVVISO_CODICE_OFFLINE = {
  titolo: 'Non riusciamo a verificare il codice.',
  corpo: 'Controlla la connessione e riprova fra un momento: il codice che hai scritto va bene così com\'è.',
}
