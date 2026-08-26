import { startOfWeek, format } from 'date-fns'
import { parseNotesAndRpe } from './rpe'

// Statistiche della scheda atleta, estratte da AthleteDetail.jsx il 26/08/2026.
//
// Perché sono qui: erano un blocco di calcolo dentro un useEffect che chiamava
// tre setState — quindi non testabili, e uno dei pattern che ESLint segnala
// (BACKLOG #17). Sono numeri su cui il coach decide la programmazione: se
// sbagliano non danno errore, cambiano solo le decisioni.

/** Durata di un allenamento senza tempo dichiarato. */
const MINUTI_PREDEFINITI = 45
/** Minuti stimati per chilometro, per le fasi di corsa definite a distanza. */
const MINUTI_PER_KM = 6

/**
 * Interpreta una durata scritta a mano, in MINUTI.
 *
 * 🔴 Correzione del 26/08/2026. Le fasi di corsa si possono definire a distanza,
 * e il ripiego che le stimava esisteva già — ma era **codice morto**: veniva
 * provato solo se questa funzione tornava 0, e per "400m" tornava 400, perché
 * la stringa non contiene né "sec" né "min" e parseInt si ferma alla lettera.
 * Risultato: una sessione di 6×400m contava come 40 ORE di allenamento, e il
 * grafico del carico settimanale ne usciva schiacciato dalla barra sbagliata.
 * "5 km" faceva il danno opposto: 5 minuti invece di 30.
 * Ora le distanze si riconoscono PRIMA, così la stima viene davvero usata.
 */
export const parseTime = (val) => {
  if (!val || val === '-') return 0
  const s = String(val).toLowerCase().trim()

  if (s.includes('sec')) return (parseInt(s) || 0) / 60
  if (s.includes('min')) {
    const parts = s.replace('min', '').trim().split(':')
    if (parts.length === 2) return parseInt(parts[0]) + parseInt(parts[1]) / 60
    return parseInt(s) || 0
  }
  // Distanze. Il controllo sui metri è volutamente stretto (`400m`, `400 m`) per
  // non catturare "10 min", che arriva qui solo se il ramo sopra non l'ha preso.
  if (s.includes('km')) return (parseFloat(s) || 0) * MINUTI_PER_KM
  if (/^\d+(\.\d+)?\s*m$/.test(s)) return ((parseFloat(s) || 0) / 1000) * MINUTI_PER_KM

  const parts = s.split(':')
  if (parts.length === 2) return parseInt(parts[0]) + parseInt(parts[1]) / 60
  return parseInt(s) || 0
}

/** Blocchi di un workout, con la migrazione del formato legacy (CLAUDE.md §5). */
const blocchiDi = (s) => {
  if (s.blocks?.length) return s.blocks
  const blocks = []
  if (s.warmup) blocks.push({ type: 'WarmUp', params: { duration: s.warmup.duration } })
  if (s.cashIn?.length > 0) blocks.push({ type: 'Cash In', exercises: s.cashIn })
  if (s.main) blocks.push({
    type: s.main.type === 'EMOM' && s.main.params?.on ? 'ON/OFF' : s.main.type,
    params: s.main.params || {},
    exercises: s.main.exercises || [],
  })
  if (s.cashOut?.length > 0) blocks.push({ type: 'Cash Out', exercises: s.cashOut })
  return blocks
}

/** Durata stimata di un allenamento, in minuti. */
export const durataWorkout = (sections) => {
  const s = sections || {}
  const cat = s.category || (s.steps ? 'Running' : 'Hyrox')
  let minuti = 0

  if (cat === 'Running') {
    for (const step of s.steps || s.main?.steps || []) {
      if (step.type === 'repeat') {
        const rounds = parseInt(step.rounds) || 1
        minuti += (parseTime(step.runDuration) + parseTime(step.recDuration)) * rounds
      } else {
        minuti += parseTime(step.duration)
      }
    }
  } else {
    for (const b of blocchiDi(s)) {
      const rounds = parseInt(b.params?.rounds) || 1
      if (b.type === 'ON/OFF') minuti += (parseTime(b.params?.on) + parseTime(b.params?.off)) * rounds
      else if (b.type === 'EMOM') minuti += parseTime(b.params?.interval) * rounds
      else if (['AMRAP', 'WarmUp', 'Rest'].includes(b.type)) minuti += parseTime(b.params?.duration)
      else if (b.type === 'For Time') minuti += 15 * rounds
      else if (b.type === 'Cash In' || b.type === 'Cash Out') minuti += 5 * rounds
      else if (b.type === 'Interval') {
        for (const ex of b.exercises || []) minuti += parseTime(ex.exTime) * rounds
      }
    }
  }

  // Un allenamento senza tempo dichiarato non vale zero: falserebbe le medie.
  return minuti === 0 ? MINUTI_PREDEFINITI : Math.round(minuti)
}

/**
 * Le quattro settimane, il tasso di completamento a 30 giorni e la
 * distribuzione degli RPE.
 *
 * @param workouts  righe di athlete_workouts con `workouts.sections` incluso
 * @param oggi      iniettabile, così i test non dipendono dal calendario
 */
export function calcolaStatistiche(workouts = [], oggi = new Date()) {
  const settimane = []
  for (let i = 3; i >= 0; i--) {
    const inizio = startOfWeek(new Date(oggi.getTime() - i * 7 * 24 * 60 * 60 * 1000), { weekStartsOn: 1 })
    const fine = new Date(inizio)
    fine.setDate(inizio.getDate() + 6)
    settimane.push({
      label: i === 0 ? 'Questa sett.' : `${format(inizio, 'd MMM')} - ${format(fine, 'd MMM')}`,
      startStr: format(inizio, 'yyyy-MM-dd'),
      endStr: format(fine, 'yyyy-MM-dd'),
      time: 0,
      load: 0,
    })
  }

  let assegnati = 0, completati = 0
  const rpe = { light: 0, moderate: 0, hard: 0, extreme: 0, total: 0 }
  const trentaGiorniFa = format(new Date(oggi.getTime() - 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')
  const oggiStr = format(oggi, 'yyyy-MM-dd')

  for (const w of workouts) {
    if (w.completed_date >= trentaGiorniFa && w.completed_date <= oggiStr) {
      assegnati++
      if (w.status === 'completed') completati++
    }
    if (w.status !== 'completed') continue

    const { rpe: valore } = parseNotesAndRpe(w.notes)
    const settimana = settimane.find(k => w.completed_date >= k.startStr && w.completed_date <= k.endStr)
    if (settimana) {
      const minuti = durataWorkout(w.workouts?.sections)
      settimana.time += minuti
      // Carico = tempo × sforzo percepito. È la misura che il coach guarda per
      // decidere se caricare o scaricare la settimana successiva.
      settimana.load += minuti * (Number.isFinite(valore) ? valore : 5)
    }

    if (Number.isFinite(valore)) {
      rpe.total++
      if (valore <= 4) rpe.light++
      else if (valore <= 6) rpe.moderate++
      else if (valore <= 8) rpe.hard++
      else rpe.extreme++
    }
  }

  return {
    settimane,
    completamento: { assigned: assegnati, done: completati },
    distribuzioneRpe: rpe,
    percentualeCompletamento: assegnati > 0 ? Math.round((completati / assegnati) * 100) : 0,
  }
}

/**
 * Il riepilogo della settimana corrente, mostrato in cima alla scheda atleta:
 * minuti totali, allenamenti completati, RPE medio.
 *
 * ⚠️ Era una TERZA copia del calcolo della durata, dentro un useEffect in
 * AthleteDetail — e quindi portava con sé lo stesso difetto delle distanze
 * (BACKLOG #30): `400m` contato come 400 minuti. Riusando durataWorkout il
 * difetto sparisce anche da qui.
 */
export function statisticheSettimana(workouts = [], oggi = new Date()) {
  const inizio = startOfWeek(oggi, { weekStartsOn: 1 })
  const fine = new Date(inizio)
  fine.setDate(inizio.getDate() + 6)
  const dal = format(inizio, 'yyyy-MM-dd')
  const al = format(fine, 'yyyy-MM-dd')

  let minuti = 0, completati = 0, sommaRpe = 0, conRpe = 0

  for (const w of workouts) {
    if (w.completed_date < dal || w.completed_date > al) continue
    if (w.status !== 'completed') continue

    completati++
    const { rpe } = parseNotesAndRpe(w.notes)
    if (Number.isFinite(rpe)) { sommaRpe += rpe; conRpe++ }
    minuti += durataWorkout(w.workouts?.sections)
  }

  return {
    time: Math.round(minuti),
    completed: completati,
    // '-' e non 0: zero direbbe "fatica nulla", il trattino dice "non lo sappiamo".
    avgRpe: conRpe > 0 ? (sommaRpe / conRpe).toFixed(1) : '-',
  }
}

