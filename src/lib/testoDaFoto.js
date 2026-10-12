/**
 * Le righe che l'OCR del telefono ha letto in una foto, rimesse in ordine di
 * lettura (12/10/2026, fase 2 di «Da un testo scritto»).
 *
 * L'OCR (Apple Vision, `ios/App/App/LettoreTesto.swift`) restituisce pezzi di
 * testo con la loro posizione, NON un testo. Leggerli dall'alto in basso e
 * basta va bene per un foglio o uno screenshot, ma su una lavagna scritta su
 * due colonne mescolerebbe i due workout riga per riga:
 *
 *     EMOM 12'          AMRAP 20         →  «EMOM 12' AMRAP 20»
 *     12 burpees        10 wall balls    →  «12 burpees 10 wall balls»
 *
 * Quindi: prima le colonne, poi le righe dentro ogni colonna.
 *
 * Coordinate: frazioni dell'immagine (0–1), origine in ALTO a sinistra.
 */

/** Due inizi di riga più vicini di così sono lo stesso allineamento (un rientro). */
const ALLINEAMENTO = 0.08
/** Quante righe devono partire allineate perché sia una colonna e non un numero in disparte. */
const MINIMO_COLONNA = 3
/** Quanti pezzi di una colonna devono stare sulle stesse righe della precedente. */
const AFFIANCATE = 0.5
/** Margine per dire che un pezzo «attraversa» l'inizio di una colonna. */
const MARGINE = 0.02

const centroY = (p) => p.y + p.h / 2

/** Due pezzi stanno sulla stessa riga se si sovrappongono per metà altezza. */
const stessaRiga = (a, b) => {
  const sopra = Math.max(a.y, b.y)
  const sotto = Math.min(a.y + a.h, b.y + b.h)
  return sotto - sopra > Math.min(a.h, b.h) * 0.5
}

/** I pezzi di UNA colonna, raggruppati in righe e letti da sinistra a destra. */
const righeDi = (pezzi) => {
  const righe = []
  for (const p of [...pezzi].sort((a, b) => centroY(a) - centroY(b))) {
    const riga = righe.find(r => r.some(q => stessaRiga(p, q)))
    if (riga) riga.push(p)
    else righe.push([p])
  }
  return righe
    .sort((a, b) => Math.min(...a.map(p => p.y)) - Math.min(...b.map(p => p.y)))
    .map(r => r.sort((a, b) => a.x - b.x).map(p => p.testo.trim()).join(' '))
}

/**
 * Dove cominciano le colonne: gli allineamenti a sinistra condivisi da almeno
 * `MINIMO_COLONNA` pezzi. Due allineamenti sono colonne diverse solo se i
 * loro pezzi stanno sulle STESSE RIGHE, uno accanto all'altro: un rientro (gli
 * esercizi sotto «EMOM 12'») ha righe sue, e resta una colonna sola.
 * ⚠️ Non «i pezzi del primo finiscono prima del secondo»: un titolo largo
 * allineato a sinistra scavalca la colonna accanto e falsava il conto.
 */
const inizioColonne = (pezzi) => {
  const gruppi = []
  for (const p of [...pezzi].sort((a, b) => a.x - b.x)) {
    const ultimo = gruppi[gruppi.length - 1]
    if (ultimo && p.x - ultimo.ultimaX < ALLINEAMENTO) { ultimo.pezzi.push(p); ultimo.ultimaX = p.x }
    else gruppi.push({ inizio: p.x, ultimaX: p.x, pezzi: [p] })
  }
  const candidati = gruppi.filter(g => g.pezzi.length >= MINIMO_COLONNA)
  const inizi = []
  for (const g of candidati) {
    const prima = inizi[inizi.length - 1]
    if (!prima) { inizi.push(g); continue }
    const affiancati = g.pezzi.filter(p => prima.pezzi.some(q => stessaRiga(p, q))).length
    if (affiancati / g.pezzi.length >= AFFIANCATE) inizi.push(g)
    else prima.pezzi.push(...g.pezzi)
  }
  return inizi.map(g => g.inizio)
}

/**
 * Il testo della foto, una riga per riga di lettura.
 * @param {{ testo: string, x: number, y: number, w: number, h: number }[]} pezzi
 */
export function testoDaRighe(pezzi) {
  const validi = (Array.isArray(pezzi) ? pezzi : [])
    .filter(p => p && typeof p.testo === 'string' && p.testo.trim()
      && [p.x, p.y, p.w, p.h].every(Number.isFinite))
  if (validi.length === 0) return ''

  const inizi = inizioColonne(validi)
  // Una colonna sola (il caso normale: un foglio, uno screenshot delle Note):
  // tutto insieme, dall'alto in basso.
  if (inizi.length <= 1) return righeDi(validi).join('\n')

  // 🔴 Un pezzo che scavalca l'inizio di una colonna è un TITOLO, non sta in
  // nessuna delle due. Trovato sul simulatore il 12/10/2026: «HYROX SATURDAY»
  // al centro della lavagna copriva lo spazio fra le colonne e le fondeva.
  const scavalca = (p) => inizi.slice(1).some(x => p.x < x - MARGINE && p.x + p.w > x + MARGINE)
  const titoli = validi.filter(scavalca)
  const colonne = inizi.map(() => [])
  for (const p of validi.filter(q => !scavalca(q))) {
    // La colonna è l'ultima cominciata prima del pezzo: anche un numero
    // scritto in disparte resta così nella sua colonna, sulla sua riga.
    let k = 0
    inizi.forEach((x, i) => { if (p.x >= x - MARGINE) k = i })
    colonne[k].push(p)
  }

  // I titoli sopra tutte le colonne vengono prima; gli altri, dopo.
  const primoY = Math.min(...colonne.flat().map(p => p.y))
  return [
    ...righeDi(titoli.filter(p => p.y < primoY)),
    ...colonne.flatMap(c => righeDi(c)),
    ...righeDi(titoli.filter(p => p.y >= primoY)),
  ].join('\n')
}
