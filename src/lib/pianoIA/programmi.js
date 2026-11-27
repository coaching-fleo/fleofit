// I programmi base del team PUSHFIT e la scelta del programma più vicino
// all'utente (spec 2026-11-27-pushfit-ai-design.md §5.1–§5.2).
//
// Il CODICE sceglie, l'IA poi adatta. Il punteggio è 0–100 in tre parti
// (sedute 40, livello 30, settimane 30); una parte a zero esclude il
// programma. Sotto SOGLIA_PROGRAMMA si passa alla rete di sicurezza.

export const SOGLIA_PROGRAMMA = 60

const LIVELLI = ['principiante', 'intermedio', 'avanzato']
const FAMIGLIE_CON_GARA = ['prima_gara', 'migliorare']
// Quante settimane si possono aggiungere o togliere a un programma.
const SETTIMANE_IN_PIU = 4
const SETTIMANE_IN_MENO = 3
// Le ultime settimane (specifico + gara) non si tolgono mai.
const ULTIME_INTOCCABILI = 2

/** Errori di forma di un programma base; vuoto = valido. */
export function validaProgramma(p) {
  const errori = []
  const settimane = Array.isArray(p?.settimane) ? p.settimane : []
  if (settimane.length === 0) return ['nessuna settimana']
  settimane.forEach((s, i) => {
    const n = (s.sedute || []).length
    if (n !== p.sedute) errori.push(`settimana ${i + 1}: ${n} sedute invece di ${p.sedute}`)
    if (!(typeof s.minuti === 'number' && s.minuti > 0)) errori.push(`settimana ${i + 1}: minuti non validi`)
  })
  if (FAMIGLIE_CON_GARA.includes(p.famiglia) && settimane[settimane.length - 1].fase !== 'gara') {
    errori.push('ultima settimana non è gara')
  }
  return errori
}

/** La famiglia che serve all'utente: con la gara passata (o assente) è «senza gara». */
const famigliaPer = (profilo) =>
  profilo.obiettivo !== 'senza_gara' && profilo.settimaneAllaGara == null ? 'senza_gara' : profilo.obiettivo

function puntiSettimane(p, profilo) {
  if (famigliaPer(profilo) === 'senza_gara') return 30
  const L = p.settimane.length
  const D = profilo.settimaneAllaGara
  if (D >= L && D <= L + SETTIMANE_IN_PIU) return 30
  if (D >= L - SETTIMANE_IN_MENO && D < L) return 15
  return 0
}

export function punteggioProgramma(p, profilo) {
  if (p.famiglia !== famigliaPer(profilo)) return 0
  const scarto = Math.abs(p.sedute - profilo.sedute)
  const sedute = scarto === 0 ? 40 : scarto === 1 ? 20 : 0
  const dl = Math.abs(LIVELLI.indexOf(p.livello) - LIVELLI.indexOf(profilo.livello))
  const livello = dl === 0 ? 30 : dl === 1 ? 10 : 0
  const settimane = puntiSettimane(p, profilo)
  if (sedute === 0 || livello === 0 || settimane === 0) return 0
  return sedute + livello + settimane
}

/** Gli indici delle settimane del programma, allungati o accorciati per arrivare alla gara. */
function settimaneUsate(p, profilo) {
  const tutte = p.settimane.map((_, i) => i)
  if (famigliaPer(profilo) === 'senza_gara') return tutte
  const scarto = profilo.settimaneAllaGara - tutte.length
  if (scarto > 0) {
    const base = tutte.filter(i => p.settimane[i].fase === 'base')
    const giro = base.length ? base : [0]
    const prima = Array.from({ length: scarto }, (_, k) => giro[k % giro.length])
    return [...prima, ...tutte]
  }
  if (scarto < 0) {
    const limite = tutte.length - ULTIME_INTOCCABILI
    const togli = tutte.filter(i => i < limite && p.settimane[i].fase !== 'scarico').slice(0, -scarto)
    return tutte.filter(i => !togli.includes(i))
  }
  return tutte
}

const giro = (p, profilo) => Math.abs(settimaneUsate(p, profilo).length - p.settimane.length)

export function scegliProgramma(programmi, profilo) {
  let migliore = null
  for (const p of programmi || []) {
    const punteggio = punteggioProgramma(p, profilo)
    if (punteggio < SOGLIA_PROGRAMMA) continue
    if (!migliore || punteggio > migliore.punteggio ||
        (punteggio === migliore.punteggio && giro(p, profilo) < giro(migliore.programma, profilo))) {
      migliore = { programma: p, punteggio }
    }
  }
  return migliore ? { ...migliore, settimaneUsate: settimaneUsate(migliore.programma, profilo) } : null
}
