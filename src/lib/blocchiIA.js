/**
 * I blocchi che `ai-workout` restituisce, resi uguali a quelli composti a mano.
 *
 * Il motivo per cui esiste: Gemini scriveva l'intensità solo quando il coach la
 * dettava, e un esercizio senza `intensity` nel builder non mostra niente — né
 * il «n/10» sulla riga né il suo peso nell'RPE atteso. Un esercizio aggiunto a
 * mano invece nasce sempre con il cursore a 5 (`INTENSITA_PREDEFINITA`).
 *
 * Il prompt ora chiede a Gemini di stimarla sempre; questa è la rete sotto: un
 * valore illeggibile o mancante diventa quello che il picker avrebbe proposto.
 */

import { intervalliDi } from './stazioniEmom'
import { TIPI_CON_INCREMENTO, TIME_CAP_PREDEFINITO } from './incremento'
import { basso, passoCorsa, quantoCorsa, trovaEsercizio } from './leggiWorkout'
import { campiVecchiRipetuta, intensitaRipetuta, MAX_PARTI } from './ripetute'

/** Lo stesso valore da cui parte il cursore nel picker dell'esercizio. */
export const INTENSITA_PREDEFINITA = '5'

/**
 * L'intensità come la scrive il builder: una stringa intera da «1» a «10».
 * Accetta quello che un modello può restituire — 7, "7", "7/10", "8.5" — e
 * torna `null` per tutto il resto.
 */
export function intensitaValida(valore) {
  if (valore === null || valore === undefined) return null
  const m = String(valore).replace(',', '.').match(/\d+(\.\d+)?/)
  if (!m) return null
  const n = Math.round(Number(m[0]))
  if (!Number.isFinite(n) || n < 1) return null
  return String(Math.min(n, 10))
}

/**
 * La durata di una stazione EMOM (src/lib/stazioniEmom.js) come la scrive il
 * picker: una stringa da «2» in su, e solo dentro un EMOM. Gemini può
 * scriverla come numero, o metterla dove non vale niente: lì sparisce.
 */
const intervalliValidi = (tipo, ex) => {
  if (tipo !== 'EMOM') return null
  const n = intervalliDi(ex)
  return n > 1 ? String(n) : null
}

/**
 * Il nome dell'esercizio come lo scrive il picker (13/10/2026). Il modello
 * scriveva «Ski Erg» al posto di «SkiErg»: il builder riconosce un ergometro
 * dal nome ESATTO (`isErgo` di src/lib/esercizi.js), e con un nome diverso
 * l'esercizio diventava un custom con i campi sbagliati — niente metri né
 * passo /500m in modifica. Si usa la stessa lettura di `FoglioDaTesto`; un
 * nome che non si riconosce resta com'è.
 */
const nomeCanonico = (nome) => (typeof nome === 'string' ? trovaEsercizio(nome) ?? nome : nome)

/** Rest come esercizio non ha intensità, come nel picker. */
const senzaIntensita = (ex) => ex?.name === 'Rest'

/**
 * Aggiunge gli `id` client-side, completa l'intensità di ogni esercizio,
 * riporta i nomi a quelli del picker e normalizza la durata delle stazioni EMOM. Non tocca nient'altro: quello che
 * Gemini ha scritto resta com'è.
 */
export function preparaBlocchiIA(blocchi) {
  if (!Array.isArray(blocchi)) return []
  return blocchi
    .filter(b => b && typeof b === 'object')
    .map(b => {
      // L'incremento a ogni giro (src/lib/incremento.js) esiste solo in For
      // Time e AMRAP; altrove la spia e gli aumenti si tolgono.
      const conIncremento = b.incremento === true && TIPI_CON_INCREMENTO.includes(b.type)
      const blocco = {
        ...b,
        id: Math.random(),
        exercises: (Array.isArray(b.exercises) ? b.exercises : []).map(ex => {
          const { intensity, intervals: _intervals, aumento, ...resto } = ex || {}
          const valore = senzaIntensita(ex) ? undefined : (intensitaValida(intensity) ?? INTENSITA_PREDEFINITA)
          const intervalli = intervalliValidi(b.type, ex)
          const n = parseInt(aumento, 10)
          return {
            ...resto,
            ...(resto.name !== undefined ? { name: nomeCanonico(resto.name) } : {}),
            ...(valore ? { intensity: valore } : {}),
            ...(intervalli ? { intervals: intervalli } : {}),
            ...(conIncremento && Number.isFinite(n) && n !== 0 ? { aumento: String(n) } : {}),
            id: Math.random(),
          }
        }),
      }
      delete blocco.incremento
      // Il For Time è a time cap (dal 15/10/2026); i giri restano se ce ne
      // sono più d'uno e non c'è l'incremento, dove li decide il tempo
      // (dal 28/10/2026).
      if (b.type === 'For Time') {
        const params = { ...(b.params || {}), timecap: b.params?.timecap || TIME_CAP_PREDEFINITO }
        const giri = parseInt(params.rounds, 10)
        if (conIncremento || !(giri > 1)) delete params.rounds
        else params.rounds = String(giri)
        blocco.params = params
      }
      return conIncremento ? { ...blocco, incremento: true } : blocco
    })
}

/**
 * I blocchi del builder come li legge `ai-workout` quando si chiede una
 * MODIFICA (12/10/2026): gli stessi dati, senza gli `id` client-side.
 *
 * Gli `id` sono `Math.random()`: all'IA non dicono niente, e un modello che
 * li ricopia (o li inventa) produrrebbe chiavi doppie nella lista. Si
 * rimettono nuovi con `preparaBlocchiIA` al ritorno.
 */
const senzaId = (o) => Object.fromEntries(Object.entries(o).filter(([k]) => k !== 'id'))

export function blocchiPerIA(blocchi) {
  if (!Array.isArray(blocchi)) return []
  return blocchi
    .filter(b => b && typeof b === 'object')
    .map(b => ({
      ...senzaId(b),
      exercises: (Array.isArray(b.exercises) ? b.exercises : [])
        .filter(ex => ex && typeof ex === 'object')
        .map(senzaId),
    }))
}

// ─── LE FASI DI CORSA (12/10/2026) ─────────────────────────────────────────
//
// «Genera con IA» anche sulla Corsa (src/lib/iaCategorie.js). Il modello
// scrive le fasi nella forma di `RunningStepPicker`, ma con la libertà di un
// modello: «15 minuti», «4:30-4:40», un `type` che non esiste. Qui diventano
// quello che il picker avrebbe salvato — le stesse letture di
// `FoglioDaTesto` (`quantoCorsa`, `passoCorsa` di src/lib/leggiWorkout.js).

const TIPI_FASE = new Set(['warmup', 'run', 'recover', 'cooldown', 'repeat'])

const testo = (v) => (v === null || v === undefined ? '' : String(v).trim())

/**
 * Una durata di corsa come la scrive il picker («10 min», «400m», «5 km»).
 * 🔴 Una durata che non si legge resta com'è, e una che manca resta vuota:
 * inventare «10 min» cambierebbe la seduta senza che il coach lo veda.
 */
const quanto = (v) => {
  const t = testo(v)
  return t ? (quantoCorsa(` ${basso(t)} `) ?? t) : ''
}

/** Passo, `paceMin` e `paceMax` di un tratto, da un passo e un eventuale secondo estremo. */
const passo = (min, max) => {
  const a = testo(min)
  const b = testo(max)
  const forbice = b && b !== '-' ? `${a.replace(/\s*\/\s*km$/i, '')} - ${b}` : a
  return passoCorsa(` ${basso(forbice)} `)
}

/** Le fasi che `ai-workout` restituisce, rese uguali a quelle composte a mano. */
export function preparaFasiIA(fasi) {
  if (!Array.isArray(fasi)) return []
  return fasi
    .filter(f => f && typeof f === 'object')
    .map(f => {
      const type = TIPI_FASE.has(f.type) ? f.type : 'run'
      const note = testo(f.notes)
      if (type === 'repeat' && Array.isArray(f.parti) && f.parti.some(p => p && typeof p === 'object')) {
        // Una sequenza di tratti (26/10/2026): «3 × (4′ Z3 + 3′ Z2)». I campi
        // di prima si riscrivono dalle parti, per le app già sugli Store.
        const parti = f.parti.filter(p => p && typeof p === 'object').slice(0, MAX_PARTI).map(p => {
          const tipo = p.tipo === 'recover' ? 'recover' : 'run'
          return {
            id: Math.random(), tipo, duration: quanto(p.duration), ...passo(p.pace ?? p.paceMin, p.paceMax),
            intensity: intensitaValida(p.intensity) ?? (tipo === 'recover' ? '3' : '8'),
          }
        })
        const ripetuta = {
          id: Math.random(), type,
          rounds: String(parseInt(f.rounds, 10) > 0 ? parseInt(f.rounds, 10) : 1),
          parti, ...campiVecchiRipetuta(parti), notes: note,
        }
        return { ...ripetuta, intensity: String(intensitaRipetuta(ripetuta) ?? 8) }
      }
      if (type === 'repeat') {
        const veloce = passo(f.runPace ?? f.runPaceMin, f.runPaceMax)
        const recupero = passo(f.recPace ?? f.recPaceMin, f.recPaceMax)
        return {
          id: Math.random(), type,
          rounds: String(parseInt(f.rounds, 10) > 0 ? parseInt(f.rounds, 10) : 1),
          runDuration: quanto(f.runDuration),
          runPace: veloce.pace, runPaceMin: veloce.paceMin, runPaceMax: veloce.paceMax,
          runIntensity: intensitaValida(f.runIntensity) ?? '8',
          recDuration: quanto(f.recDuration),
          recPace: recupero.pace, recPaceMin: recupero.paceMin, recPaceMax: recupero.paceMax,
          recIntensity: intensitaValida(f.recIntensity) ?? '3',
          notes: note,
        }
      }
      const p = passo(f.pace ?? f.paceMin, f.paceMax)
      return {
        id: Math.random(), type, duration: quanto(f.duration),
        ...p, intensity: intensitaValida(f.intensity) ?? INTENSITA_PREDEFINITA, notes: note,
      }
    })
}

/** Le fasi del builder come le legge `ai-workout` in una MODIFICA: senza `id`. */
export function fasiPerIA(fasi) {
  if (!Array.isArray(fasi)) return []
  return fasi.filter(f => f && typeof f === 'object').map(senzaId)
}
