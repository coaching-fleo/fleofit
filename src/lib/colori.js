// I colori del marchio, per i punti che NON sono classi Tailwind.
//
// Perché esiste: canvas, jsPDF, `style={{ }}` inline e gli attributi SVG
// vogliono un valore, non una classe — e una variabile CSS lì non funziona.
// Senza questo file quei punti resterebbero l'unico posto dove il colore è
// scritto a mano, e un rebranding li dimenticherebbe.
//
// ⚠️ DEVONO restare uguali ai token di `src/index.css` (`--color-brand`,
// `--color-running`, `--color-custom`, `--color-ia`). Sono due elenchi perché
// vivono in due mondi diversi, non perché siano indipendenti: cambiarne uno
// solo produce un'app di due colori. CLAUDE.md §6.
export const BRAND = '#f1ba17'
export const RUNNING = '#0094C6'
export const CUSTOM = '#D11149'
export const IA = '#a855f7'
export const EVENTO = '#ffffff'

/** Il colore di una categoria di workout, con il giallo come ripiego. */
export const coloreCategoria = (categoria) => {
  if (categoria === 'Running') return RUNNING
  if (categoria === 'Custom' || categoria === 'Autonomo') return CUSTOM
  if (categoria === 'Event') return EVENTO
  return BRAND
}

/**
 * Lo stesso colore con un velo di trasparenza, in `rgba()`.
 *
 * Serve dove il colore finisce in uno `style` inline rasterizzato da
 * html-to-image (la story Instagram): lì una variabile CSS non viene risolta,
 * e la forma `rgba(...)` era scritta a mano — con i canali copiati a occhio,
 * quindi invisibile a qualunque ricerca di `#f1ba17`.
 */
export const conVelo = (hex, opacita) => {
  const n = parseInt(hex.replace('#', ''), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${opacita})`
}

/**
 * Il colore corrispondente a una classe Tailwind del marchio.
 *
 * ⚠️ Serve dove un componente riceve la classe come prop (`activeColor="bg-running"`)
 * e deve ricavarne anche un valore, per esempio per un'ombra inline.
 * Prima quel codice faceva `activeColor.includes('f1ba17')`, cioè confrontava il
 * nome della classe con un codice esadecimale: ha smesso di funzionare in
 * silenzio nel momento in cui la classe è diventata `bg-brand` (26/08/2026), e
 * TUTTI gli slider di intensità hanno cominciato a brillare di rosso.
 * Confrontare il nome del token invece del valore rende il legame esplicito.
 */
export const coloreDaClasse = (classe = '') => {
  // ⚠️ Si cerca il token DOPO un trattino, non come sottostringa qualsiasi:
  // `ia` è un ago troppo corto, e la classe Tailwind `via-brand` (gradienti) lo
  // contiene. Con un semplice includes() un gradiente giallo diventava viola.
  // Trovato per mutazione il 26/08/2026, subito dopo aver scritto la funzione.
  const trovato = String(classe).match(/-(brand|running|custom|ia)(?![a-z])/)
  if (!trovato) return BRAND
  return { brand: BRAND, running: RUNNING, custom: CUSTOM, ia: IA }[trovato[1]]
}

