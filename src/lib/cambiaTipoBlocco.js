// cambiaTipoBlocco.js — «Cambia tipo di blocco» nel builder Hyrox (14/10/2026).
//
// Richiesta del committente: l'IA a volte fa un For Time dove andava un AMRAP
// (o un EMOM dove andava un ON/OFF), e cambiarlo voleva dire rifare il blocco
// ed esercizio per esercizio. Qui il blocco cambia tipo e tiene quello che
// ha ancora senso: gli esercizi, le note, e i numeri che il tipo nuovo usa.
//
// ⚠️ I parametri sono quelli di `parametriDelBlocco` in CreateWorkout.jsx:
// un parametro che il tipo nuovo non legge si toglie, invece di restare nel
// jsonb a dire una cosa che nessuno mostra (il «1:00» di rest di un For Time).
// Quelli che mancano li ripiega il builder, come per un blocco nuovo.
//
// WarmUp e Rest NON hanno esercizi nel builder: il riscaldamento si scrive
// nelle note del blocco (come fa `leggiWorkout`). Passando di lì gli esercizi
// diventano righe di testo («Wall Balls · 20 reps · 6 kg»), e tornando a un
// blocco di lavoro le righe tornano esercizi con lo stesso lettore di «Da un
// testo scritto». Una riga che non è un esercizio conosciuto diventa un
// esercizio col suo testo come nome: nessuna riga sparisce dalla vista.
//
// 🔴 Le righe si separano con «; » e NON con un a-capo: il campo delle note
// del blocco è un <input> (RigaTesto), e un input toglie gli a-capo dal valore
// — le righe si sarebbero incollate una all'altra. «·» no: separa già i pezzi
// dentro una riga.

import { leggiEsercizio } from './leggiWorkout'
import { HYROX_EXERCISES } from './esercizi'
import { INTENSITA_PREDEFINITA } from './blocchiIA'
import { TIPI_CON_INCREMENTO, TIME_CAP_PREDEFINITO, haIncremento } from './incremento'

const PARAMETRI = {
  WarmUp: ['duration'],
  Rest: ['duration'],
  'ON/OFF': ['on', 'off', 'rounds'],
  EMOM: ['interval', 'rounds'],
  AMRAP: ['duration'],
  'For Time': ['timecap', 'rounds'],
  Interval: ['rounds'],
  'Cash In': ['rounds', 'rest'],
  'Cash Out': ['rounds', 'rest'],
}

/** WarmUp e Rest non hanno esercizi nel builder (`conEsercizi` di HyroxBlock). */
export const SENZA_ESERCIZI = new Set(['WarmUp', 'Rest'])

const pieno = (v) => v != null && v !== '' && v !== '-'
// L'ordine e la forma sono quelli che `leggiEsercizio` rilegge.
const SEP_NOTA = ' — '
const SEP_RIGHE = '; '

/** Un esercizio in una riga di testo: «SkiErg · 500m · @2:00 /500m — tecnica». */
export const rigaDaEsercizio = (ex) => {
  const misura = pieno(ex.exTime) ? ex.exTime : pieno(ex.meters) ? ex.meters : pieno(ex.reps) ? `${ex.reps} reps` : ''
  const passo = pieno(ex.ergoPace) && ex.ergoPace !== 'Libero' ? `@${ex.ergoPace}` : ''
  const carico = pieno(ex.kg) ? `${ex.kg} kg` : ''
  const riga = [ex.name, misura, passo, pieno(ex.speed) ? ex.speed : '', carico].filter(Boolean).join(' · ')
  return pieno(ex.notes) ? `${riga}${SEP_NOTA}${String(ex.notes).trim()}` : riga
}

/** Una riga di testo in un esercizio del builder. */
export const esercizioDaRiga = (riga) => {
  const [testo, ...nota] = riga.split(SEP_NOTA)
  const letto = leggiEsercizio(testo)
  const base = letto && HYROX_EXERCISES.includes(letto.name)
    ? Object.fromEntries(Object.entries(letto).filter(([k]) => k !== 'riconosciuto'))
    : { name: testo.trim(), reps: '', meters: '', kg: '' }
  return {
    ...base,
    ...(base.name === 'Rest' ? {} : { intensity: base.intensity || INTENSITA_PREDEFINITA }),
    notes: nota.join(SEP_NOTA).trim(),
    id: Math.random(),
  }
}


/** Il blocco con un altro tipo. Stesso id: resta al suo posto e aperto. */
export const cambiaTipoBlocco = (block, tipo) => {
  if (!block || block.type === tipo || !PARAMETRI[tipo]) return block
  const params = {}
  for (const k of PARAMETRI[tipo]) {
    if (block.params?.[k] != null && block.params[k] !== '') params[k] = block.params[k]
  }
  const fuori = { ...block, type: tipo, params }
  // For Time e AMRAP sono entrambi a tempo: il time cap diventa la durata e
  // viceversa. Un For Time senza un tempo da cui partire prende quello di un
  // blocco nuovo (src/lib/incremento.js).
  if (tipo === 'AMRAP' && block.params?.timecap) params.duration = block.params.timecap
  if (tipo === 'For Time' && !params.timecap) {
    params.timecap = (block.type === 'AMRAP' && block.params?.duration) || TIME_CAP_PREDEFINITO
  }
  // I giri del For Time (28/10/2026) sono giri della lista, come quelli di un
  // ON/OFF o di un Cash In; i round di un EMOM sono MINUTI, e 10 minuti non
  // diventano 10 giri. Con l'incremento i giri li decide il tempo.
  if (tipo === 'For Time' && (block.type === 'EMOM' || haIncremento(block))) delete params.rounds
  // L'incremento a ogni giro passa fra For Time e AMRAP; negli altri blocchi
  // non esiste: via la spia e gli aumenti.
  if (haIncremento(block) && TIPI_CON_INCREMENTO.includes(tipo)) {
    // resta com'è
  } else if ('incremento' in block) {
    delete fuori.incremento
    if (Array.isArray(block.exercises)) {
      fuori.exercises = block.exercises.map(ex => {
        const senza = { ...ex }
        delete senza.aumento
        return senza
      })
    }
  }
  const daTesto = SENZA_ESERCIZI.has(block.type)
  const aTesto = SENZA_ESERCIZI.has(tipo)
  if (aTesto && !daTesto && (block.exercises || []).length > 0) {
    const righe = block.exercises.map(rigaDaEsercizio)
    fuori.notes = [String(block.notes || '').trim(), ...righe].filter(Boolean).join(SEP_RIGHE)
    fuori.exercises = []
    return fuori
  }
  if (daTesto && !aTesto && String(block.notes || '').trim()) {
    const righe = String(block.notes).split(/[;\n]/).map(r => r.trim()).filter(Boolean)
    fuori.exercises = [...(block.exercises || []), ...righe.map(esercizioDaRiga)]
    fuori.notes = ''
    return fuori
  }
  // `intervals` (una stazione su più minuti) esiste solo in un EMOM:
  // src/lib/stazioniEmom.js. Fuori di lì conterebbe round che non ci sono.
  if (Array.isArray(block.exercises) && block.type === 'EMOM') {
    fuori.exercises = block.exercises.map(ex => {
      const senza = { ...ex }
      delete senza.intervals
      return senza
    })
  }
  return fuori
}
