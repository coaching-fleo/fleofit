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

// ── L'interfaccia del telefono, da non leggere ────────────────────────────
// Uno SCREENSHOT delle Note porta con sé l'orario, le icone, la barra degli
// strumenti e soprattutto la TASTIERA: Vision la legge a gruppi di tasti
// («QWERT», «A S», «× C») e ognuno diventava una riga nelle note del workout.
// Segnalato dal committente il 12/10/2026 con uno screenshot vero; le posizioni
// lette da Vision su quello screenshot sono il test `screenshot delle Note`.

/** Un gruppo di tasti: da 1 a 5 lettere maiuscole, al netto di spazi e simboli. */
const eTasto = (p) => /^[A-Z]{1,5}$/.test(p.testo.replace(/[\s×+⇧⌫]/g, ''))
/** Quanti tasti sulla stessa riga fanno una tastiera, e non una sigla («EMOM»). */
const TASTI_PER_RIGA = 4
/** Le righe delle tastiere latine: QWERTY, QWERTZ, AZERTY. */
const RIGHE_TASTIERA = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM', 'QWERTZUIOP', 'YXCVBNM', 'AZERTYUIOP', 'QSDFGHJKLM', 'WXCVBN']
/** Le lettere `a` compaiono, nello stesso ordine, dentro `b`? */
const inOrdine = (a, b) => {
  let i = 0
  for (const c of b) if (c === a[i]) i++
  return i === a.length
}
/** Sopra la tastiera stanno i suggerimenti e la barra degli strumenti. */
const SOPRA_TASTIERA = 0.15
/** L'orario della barra di stato sta qui dentro, in alto. */
const BARRA_STATO = 0.06

/**
 * I pezzi senza l'interfaccia del telefono:
 * - la TASTIERA (righe con almeno quattro gruppi di tasti) e tutto quello che
 *   sta sotto la sua prima riga; nella fascia appena sopra (suggerimenti,
 *   «Aa») cade solo quello che non ha cifre — una riga di workout ne ha quasi
 *   sempre, e così una che finisce attaccata alla tastiera non si perde;
 * - la BARRA DI STATO: un orario in cima e quello che gli sta accanto;
 * - le ICONE lette come testo («<», «•••»): niente lettere né cifre.
 */
export function senzaInterfaccia(pezzi) {
  let resto = pezzi.filter(p => /[\p{L}\d]/u.test(p.testo))

  const tasti = resto.filter(eTasto)
  // Una riga di tasti è tastiera se i gruppi sono tanti, o se le loro lettere,
  // da sinistra a destra, seguono l'ordine di una tastiera: Vision a volte ne
  // legge una riga intera in due soli pezzi («QWERT» + «UIOP»).
  const tastiera = (t) => {
    const riga = tasti.filter(q => stessaRiga(t, q)).sort((a, b) => a.x - b.x)
    if (riga.length >= TASTI_PER_RIGA) return true
    const lettere = riga.map(q => q.testo.replace(/[^A-Z]/g, '')).join('')
    return lettere.length >= 5 && RIGHE_TASTIERA.some(r => inOrdine(lettere, r))
  }
  const righeTastiera = tasti.filter(tastiera)
  if (righeTastiera.length > 0) {
    const cima = Math.min(...righeTastiera.map(p => p.y))
    resto = resto.filter(p => p.y < cima - SOPRA_TASTIERA || (p.y < cima && /\d/.test(p.testo)))
  }

  const orario = resto.find(p => p.y < BARRA_STATO && /^\d{1,2}[:.]\d{2}/.test(p.testo.trim()))
  if (orario) resto = resto.filter(p => p.y > orario.y + orario.h)

  return resto
}

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
  const validi = senzaInterfaccia((Array.isArray(pezzi) ? pezzi : [])
    .filter(p => p && typeof p.testo === 'string' && p.testo.trim()
      && [p.x, p.y, p.w, p.h].every(Number.isFinite)))
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
