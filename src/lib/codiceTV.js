// Il codice a quattro cifre che la TV mostra, e il link che il suo QR porta.
//
//     fleofit://tv/1234
//
// Il link ha lo stesso schema degli altri deep link dell'app (`fleofit://`,
// vedi CLAUDE.md §1). La fotocamera legge il testo intero del QR: qui si
// controlla che sia proprio un link della TV e si tira fuori il codice.

const PREFISSO = 'fleofit://tv/'

// Anchored: nessun testo prima o dopo, e esattamente quattro cifre.
const LINK_TV = /^fleofit:\/\/tv\/(\d{4})$/

/** Il testo che la TV mostra nel QR, per un codice a quattro cifre. */
export const contenutoQR = (codice) => `${PREFISSO}${codice}`

/**
 * Il codice di una TV dal testo letto da un QR, o `null` se non è un link della TV.
 * @param {string} testo
 * @returns {string | null}
 */
export const codiceDaQR = (testo) => {
  if (typeof testo !== 'string') return null
  const trovato = testo.trim().match(LINK_TV)
  return trovato ? trovato[1] : null
}

// La TV collegata vive solo in memoria, come le persone di `personeTV.js`:
// chiusa l'app, la scheda riparte scollegata (04/11/2026, segnalato dal
// committente). Prima stava in localStorage (`fleofit_tv_code`) e alla
// riapertura la scheda si diceva «collegata» a una TV che magari era spenta
// da giorni, e su QUALUNQUE workout, non solo su quello mandato in TV.
let collegata = null

/** Il codice della TV collegata a questo workout, o `null`. */
export const tvCollegata = (workoutId) =>
  collegata && collegata.workoutId === workoutId ? collegata.codice : null

export const ricordaTV = (workoutId, codice) => { collegata = { workoutId, codice } }

export const dimenticaTV = () => { collegata = null }
