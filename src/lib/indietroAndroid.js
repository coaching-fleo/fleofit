/**
 * Il tasto «indietro» di sistema su Android (tasto o gesto dal bordo).
 *
 * 🔴 SENZA QUESTO CAMBIAVA PAGINA CON UNA MODALE APERTA (02/10/2026).
 * Capacitor, se nessuno ascolta `backButton`, fa `history.back()` nella
 * WebView: con un foglio o una modale sopra, la pagina sotto se ne andava e la
 * modale restava appesa sopra la pagina precedente. Su Android il gesto che
 * tutti si aspettano è il contrario: indietro chiude prima ciò che sta sopra.
 *
 * ⚠️ PERCHÉ NON SI REGISTRA OGNI MODALE A MANO. Sono una quarantina, in tredici
 * file, e ognuna ha già il proprio modo di chiudersi toccando il velo. Una
 * registrazione per modale sarebbe la quarantunesima cosa da ricordare a ogni
 * modale nuova — e quella dimenticata tornerebbe a cambiare pagina senza un
 * errore. Qui invece si guarda lo SCHERMO: tutte le modali sono `createPortal`
 * su `document.body` (CLAUDE.md §8), quindi fuori da `#root`, e coprono lo
 * schermo con il loro velo. Se il punto in cima allo schermo appartiene a
 * qualcosa fuori da `#root`, c'è una modale aperta, e il tasto indietro fa ciò
 * che farebbe il dito su quel velo.
 *
 * ⚠️ Una modale che il velo non chiude (perché sta salvando, o perché chiede
 * una conferma esplicita) resta aperta: il tasto viene assorbito e la pagina
 * NON cambia. Meglio un indietro che non fa niente di un indietro che lascia
 * una modale orfana sopra un'altra pagina.
 *
 * 🔴 `puoTornare` NON è il `canGoBack` di Capacitor. Misurato sull'emulatore:
 * con tre pagine nella cronologia (React Router `idx: 2`) Android rispondeva
 * `canGoBack: false`, e il tasto chiudeva l'app invece di tornare indietro.
 * Le pagine le apre React Router con `pushState`, e la cronologia che conta è
 * la sua: si legge `history.state.idx`, come fa `useIndietro` con
 * `location.key` (CLAUDE.md §9-tervicies).
 */

/** C'è una pagina dell'app dietro questa? (la cronologia di React Router) */
export const puoTornareIndietro = (stato = window.history.state) => (stato?.idx ?? 0) > 0

/** Ciò che non va mai «cliccato» per conto dell'utente. */
const INTERATTIVO = 'button, a, input, textarea, select, label, [role="button"], [contenteditable="true"]'

/** Le parole con cui una modale dice «chiudimi», e solo quelle, esatte. */
const PAROLE_CHIUSURA = ['annulla', 'chiudi', 'indietro', 'no']

/** Il gestore di clic che React ha attaccato a un nodo, se c'è. */
const clicReact = (el) => {
  const chiave = Object.keys(el).find(k => k.startsWith('__reactProps$'))
  return chiave ? el[chiave]?.onClick : undefined
}

const usabile = (b) => !b.disabled && b.getAttribute('aria-disabled') !== 'true'

/**
 * 🔴 IL VELO NON BASTA (02/10/2026). La prima stesura toccava il velo e
 * basta, e chiudeva solo il menu delle tre puntine: delle quaranta modali
 * dell'app UNA sola si chiude dal velo. «Assegna workout» e quasi tutte le
 * altre si chiudono con la X o con «Annulla». Quindi si cerca, nella modale
 * aperta e mentre è aperta, il suo modo di chiudersi — nell'ordine in cui lo
 * cercherebbe un dito.
 * @returns {boolean} se ha trovato qualcosa da toccare
 */
function chiudiModale(portale, sopra) {
  // 1. Il velo, ma solo se React gli ha dato davvero un gestore di clic.
  for (let el = sopra; el && el !== portale.parentElement; el = el.parentElement) {
    if (el.matches?.(INTERATTIVO)) break
    if (clicReact(el)) { el.click(); return true }
  }
  const bottoni = [...portale.querySelectorAll('button, [role="button"]')].filter(usabile)
  // 2. La X: per nome, o per icona quando il bottone non ha né nome né testo.
  const x = bottoni.find(b => /^chiudi/i.test(b.getAttribute('aria-label') || ''))
    || bottoni.find(b => !b.textContent.trim() && b.querySelector('svg.lucide-x'))
  if (x) { x.click(); return true }
  // 3. Le parole, esatte: «No, esci» o «Annulla assegnazione» NON sono un'uscita.
  const parola = bottoni.find(b => PAROLE_CHIUSURA.includes(b.textContent.trim().toLowerCase()))
  if (parola) { parola.click(); return true }
  return false
}

/**
 * Decide cosa fare. Pura rispetto ai suoi argomenti, per poterla provare.
 * @returns {'modale' | 'indietro' | 'esci'}
 */
export function gestisciIndietro({ puoTornare, documento = document, finestra = window, torna, esci }) {
  const radice = documento.getElementById('root')
  // In cima e al centro: è velo per le modali centrate e per i fogli dal
  // basso, ed è la fascia della barra di stato per le schermate a tutta
  // altezza — dove non c'è mai un comando da premere per sbaglio.
  const sopra = documento.elementFromPoint?.(finestra.innerWidth / 2, 4)
  if (sopra && radice && !radice.contains(sopra) && sopra !== documento.body && sopra !== documento.documentElement) {
    // Il portale è il figlio diretto di <body> che contiene il punto toccato:
    // se ce ne sono due impilati (un avviso sopra una modale), è quello sopra.
    let portale = sopra
    while (portale.parentElement && portale.parentElement !== documento.body) portale = portale.parentElement
    chiudiModale(portale, sopra)
    // ⚠️ Anche se non ha trovato niente, la pagina NON cambia: vedi in testa.
    return 'modale'
  }
  if (puoTornare) { torna(); return 'indietro' }
  esci()
  return 'esci'
}
