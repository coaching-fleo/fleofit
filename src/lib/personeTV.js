// Più persone sullo stesso timer, sfasate di qualche esercizio (30/10/2026).
//
// Il coach fa girare un EMOM o un ON/OFF a più persone insieme, ognuna partita
// da un esercizio diverso. Il timer resta UNO: a ogni minuto (EMOM) o a ogni ON
// tutti avanzano di un esercizio. Qui si calcola solo chi è dove, partendo
// dall'esercizio che `esercizioInCorso` accende per il timer.
//
// Le persone vivono solo nella sessione TV (viaggiano nel `timer_state`): nessuna
// tabella, nessuna colonna.

/** I colori delle persone: lontani fra loro e leggibili sul nero della TV. */
export const COLORI_PERSONE = ['#38bdf8', '#f472b6', '#4ade80', '#fb923c', '#a78bfa', '#facc15', '#f87171', '#2dd4bf']

export const MAX_PERSONE = COLORI_PERSONE.length

/** Il primo colore non ancora usato, o il giro ricomincia. */
const coloreLibero = (persone) =>
  COLORI_PERSONE.find(c => !persone.some(p => p.colore === c)) || COLORI_PERSONE[persone.length % COLORI_PERSONE.length]

/**
 * Aggiunge una persona in coda: nome «A», «B»… e il primo colore libero. Parte
 * dall'esercizio dopo quello dell'ultima, così la scelta più comune (uno per
 * stazione) è già fatta. `partenza` è in base 1: «dal 2° esercizio».
 */
export const aggiungiPersona = (persone, maxEsercizi = 1) => {
  if (persone.length >= MAX_PERSONE) return persone
  const ultima = persone[persone.length - 1]
  const partenza = ultima ? (ultima.partenza % Math.max(1, maxEsercizi)) + 1 : 1
  return [...persone, {
    id: Math.random(),
    nome: String.fromCharCode(65 + persone.length),
    colore: coloreLibero(persone),
    partenza,
  }]
}

/**
 * Per ogni esercizio del blocco, le persone che ci stanno sopra adesso.
 * `corrente` è l'indice che il timer accende (null = nessuno: blocco fermo,
 * OFF di un ON/OFF). Una persona partita dal 3° è due esercizi avanti a chi è
 * partito dal 1°, e il giro ricomincia dal primo.
 */
export const personePerEsercizio = (corrente, numeroEsercizi, persone) => {
  const righe = Array.from({ length: Math.max(0, numeroEsercizi) }, () => [])
  if (corrente == null || !numeroEsercizi || !Array.isArray(persone)) return righe
  for (const p of persone) {
    const scarto = (parseInt(p.partenza, 10) || 1) - 1
    righe[(((corrente + scarto) % numeroEsercizi) + numeroEsercizi) % numeroEsercizi].push(p)
  }
  return righe
}

/** I blocchi in cui le persone hanno senso: quelli che accendono un esercizio. */
export const bloccoAScaglioni = (block) =>
  (block?.type === 'EMOM' || block?.type === 'ON/OFF') && (block.exercises || []).length > 1

/** Quanti esercizi ha il blocco a scaglioni più lungo: il limite di «Parte dal». */
export const eserciziMassimi = (blocks) =>
  (blocks || []).filter(bloccoAScaglioni).reduce((m, b) => Math.max(m, b.exercises.length), 0)
