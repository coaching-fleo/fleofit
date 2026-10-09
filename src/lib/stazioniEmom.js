// Le stazioni di un EMOM che durano più di un minuto.
//
// In un EMOM ogni esercizio vale un intervallo («ogni 1:00»), nell'ordine della
// lista, e la lista ricomincia quando i round sono più degli esercizi. Il
// coach però programma anche stazioni CONTINUE — «minuti 2 e 3: 500 m di
// vogatore» — che non sono lo stesso esercizio ripetuto due volte: è un lavoro
// solo, e il timer non deve ripartire a metà.
//
// Il dato è un campo dell'esercizio, `intervals` («2» = due intervalli di
// fila), e vale SOLO dentro un EMOM. Assente o «1» è il comportamento di
// sempre, quindi i workout già salvati non cambiano.
//
// ⚠️ «Round» resta il numero di INTERVALLI totali, come prima: la durata del
// blocco è sempre `interval × rounds` (`durataBlocco` non cambia). Se i round
// finiscono a metà di una stazione, l'ultima fase si accorcia.
//
// ⚠️ Stesso file sul branch `app` (le app iOS e Android), dove c'è anche il
// timer guidato che usa `fasiEmom`. Il database è condiviso: le due copie
// devono leggere il campo allo stesso modo.

/** Quanti intervalli può durare al massimo una stazione. */
export const MASSIMO_INTERVALLI = 5

/** Quanti intervalli dura un esercizio di un EMOM: 1 se il campo manca. */
export const intervalliDi = (ex) => {
  const n = parseInt(ex?.intervals, 10)
  return Number.isFinite(n) && n > 1 ? Math.min(n, MASSIMO_INTERVALLI) : 1
}

/** Quanti intervalli dura un giro intero della lista. */
export const intervalliDelGiro = (esercizi = []) =>
  esercizi.reduce((t, ex) => t + intervalliDi(ex), 0)

/**
 * Il numero da mostrare accanto a ogni esercizio: «1», «2–3», «4»… — i minuti
 * (o gli intervalli) del primo giro. Fuori da un EMOM è l'ordine, 1, 2, 3.
 */
export const etichetteStazioni = (esercizi = [], tipo = 'EMOM') => {
  if (tipo !== 'EMOM') return esercizi.map((_, i) => String(i + 1))
  let primo = 1
  return esercizi.map(ex => {
    const n = intervalliDi(ex)
    const etichetta = n > 1 ? `${primo}–${primo + n - 1}` : String(primo)
    primo += n
    return etichetta
  })
}

/**
 * Le fasi del timer di un EMOM: una per stazione, lunga quanto i suoi
 * intervalli, ripetendo la lista finché ci sono round.
 *
 * Ogni fase è `{ esercizio, primo, ultimo }` (round in base 1, estremi inclusi);
 * `esercizio` è `null` se il blocco non ha esercizi, e allora ogni round è una
 * fase da un intervallo, come prima.
 */
export const fasiEmom = (esercizi = [], rounds = 10) => {
  const fasi = []
  let r = 1
  let i = 0
  while (r <= rounds) {
    const esercizio = esercizi.length ? esercizi[i % esercizi.length] : null
    const n = Math.min(esercizio ? intervalliDi(esercizio) : 1, rounds - r + 1)
    fasi.push({ esercizio, primo: r, ultimo: r + n - 1 })
    r += n
    i++
  }
  return fasi
}
