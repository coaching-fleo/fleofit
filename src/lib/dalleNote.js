// I conti dei grafici «Dalle note» della scheda atleta (09/10/2026).
//
// Partono dagli estratti che `estrai-note` ha salvato in `note_estratte` e
// dalle assegnazioni che la scheda ha già caricato. Funzioni pure: la grafica
// sta in `src/components/DalleNoteUI.jsx`.
//
// ⚠️ Un estratto vale solo finché la nota è quella da cui è nato:
// `estrattiValidi` confronta l'impronta con la nota di ADESSO, con la stessa
// regola del server (importata, non copiata). Una nota corretta dall'atleta
// dopo l'analisi non deve continuare a parlare con le parole di prima.
//
// ⚠️ Nessuno zero inventato (CLAUDE.md §9): un fattore mai citato non ha una
// riga, una serie di un solo punto non ha una linea né un confronto.

import { differenceInCalendarDays, format, parseISO, startOfWeek } from 'date-fns'
import { testoNota, rpeDichiarato } from './rpe'
import { FATTORI, VERSIONE, impronta, testoPulito } from '../../supabase/functions/estrai-note/regole.ts'

export const FINESTRE = [30, 90, 365]
export const FINESTRA_INIZIALE = 90

// Per il tempo e il passo, meno è meglio.
const MENO_E_MEGLIO = ['tempo', 'passo']
const NOME_MISURA = { tempo: 'Tempo', kg: 'Carico', reps: 'Ripetizioni', round: 'Round', distanza: 'Distanza', passo: 'Passo' }

// Qualunque stato: la stessa regola di `daAnalizzare` nel server (una nota
// salvata su un allenamento non chiuso è comunque una nota dell'atleta).
const conTesto = (w) => Boolean(w) && testoNota(w.notes) !== ''

/** Gli estratti la cui nota è ancora quella analizzata, con lo standard di oggi. */
export function estrattiValidi(estratti = [], workouts = []) {
  const per = new Map(workouts.map(w => [w.id, w]))
  return estratti.filter(e => {
    const w = per.get(e.athlete_workout_id)
    return conTesto(w) && e.versione === VERSIONE && e.impronta === impronta(testoPulito(w.notes))
  })
}

/** Quante note scritte ci sono, quante hanno un estratto valido, quante aspettano. */
export function copertura(workouts = [], estratti = []) {
  const totali = workouts.filter(conTesto).length
  const analizzate = estrattiValidi(estratti, workouts).length
  return { totali, analizzate, inAttesa: Math.max(0, totali - analizzate) }
}

const giorniFa = (data, oggi) => differenceInCalendarDays(oggi, parseISO(data))
const dentro = (data, giorni, oggi) => {
  if (!data) return false
  const d = giorniFa(data, oggi)
  return d >= 0 && d < giorni
}

/** Gli estratti degli ultimi `giorni` giorni, oggi compreso. */
export const nellaFinestra = (estratti = [], giorni = FINESTRA_INIZIALE, oggi = new Date()) =>
  estratti.filter(e => dentro(e.data, giorni, oggi))

/** Una serie per esercizio + misura, i punti in ordine di data. */
export function serieRisultati(estratti = []) {
  const serie = new Map()
  for (const e of estratti) {
    for (const r of e.estrazione?.risultati ?? []) {
      const chiave = `${r.esercizio ?? ''}|${r.misura}`
      if (!serie.has(chiave)) {
        serie.set(chiave, {
          chiave, esercizio: r.esercizio, misura: r.misura, unita: r.unita,
          etichetta: r.esercizio ? `${r.esercizio} · ${r.misura}` : NOME_MISURA[r.misura],
          punti: [],
        })
      }
      serie.get(chiave).punti.push({ data: e.data, valore: r.valore, citazione: r.citazione, awId: e.athlete_workout_id })
    }
  }
  return [...serie.values()].map(s => {
    const punti = [...s.punti].sort((a, b) => a.data.localeCompare(b.data))
    const n = punti.length
    const scarto = n >= 2 ? punti[n - 1].valore - punti[n - 2].valore : null
    const migliorato = scarto === null ? null : MENO_E_MEGLIO.includes(s.misura) ? scarto < 0 : scarto > 0
    return { ...s, punti, scarto, migliorato }
  }).sort((a, b) => b.punti.length - a.punti.length
    || b.punti[b.punti.length - 1].data.localeCompare(a.punti[a.punti.length - 1].data))
}

/** Le difficoltà dichiarate, per settimana (da lunedì), solo le settimane che ne hanno. */
export function settimaneSensazioni(estratti = [], giorni = FINESTRA_INIZIALE, oggi = new Date()) {
  const settimane = new Map()
  for (const e of nellaFinestra(estratti, giorni, oggi)) {
    const d = e.estrazione?.sensazioni?.difficolta
    if (!d) continue
    const settimana = format(startOfWeek(parseISO(e.data), { weekStartsOn: 1 }), 'yyyy-MM-dd')
    if (!settimane.has(settimana)) settimane.set(settimana, { settimana, troppo_facile: 0, giusta: 0, troppo_dura: 0 })
    settimane.get(settimana)[d] += 1
  }
  return [...settimane.values()].sort((a, b) => a.settimana.localeCompare(b.settimana))
}

/** Gli esercizi che l'atleta salta, riduce o cambia più spesso. */
export function modificheFrequenti(estratti = []) {
  const per = new Map()
  for (const e of estratti) {
    for (const m of e.estrazione?.sensazioni?.modifiche ?? []) {
      if (!m.esercizio) continue
      const chiave = `${m.esercizio}|${m.tipo}`
      if (!per.has(chiave)) per.set(chiave, { esercizio: m.esercizio, tipo: m.tipo, volte: 0, citazioni: [] })
      const voce = per.get(chiave)
      voce.volte += 1
      voce.citazioni.push({ data: e.data, testo: m.citazione, awId: e.athlete_workout_id })
    }
  }
  return [...per.values()]
    .map(v => ({ ...v, citazioni: v.citazioni.sort((a, b) => a.data.localeCompare(b.data)) }))
    .sort((a, b) => b.volte - a.volte)
}

/**
 * Una riga per fattore citato almeno una volta nella finestra, nell'ordine
 * dello standard. `durissime` sono i giorni con RPE ≥ 8 nella stessa
 * finestra: mettono accanto «stanco morto» e la seduta che l'ha preceduto.
 */
export function righeStato(estratti = [], workouts = [], giorni = FINESTRA_INIZIALE, oggi = new Date()) {
  const finestra = nellaFinestra(estratti, giorni, oggi)
  const durissime = [...new Set(workouts
    .filter(w => w.status === 'completed' && dentro(w.completed_date, giorni, oggi) && (rpeDichiarato(w.notes) ?? 0) >= 8)
    .map(w => w.completed_date))].sort()
  return FATTORI.map(fattore => ({
    fattore,
    giorni: finestra.flatMap(e => (e.estrazione?.stato ?? [])
      .filter(s => s.fattore === fattore)
      .map(s => ({ data: e.data, segno: s.segno, citazione: s.citazione })))
      .sort((a, b) => a.data.localeCompare(b.data)),
    durissime,
  })).filter(r => r.giorni.length > 0)
}

const due = (n) => String(n).padStart(2, '0')
const virgola = (n) => String(Math.round(n * 100) / 100).replace('.', ',')

/** Un valore normalizzato come lo leggerebbe un atleta. */
export function formattaValore(valore, unita) {
  switch (unita) {
    case 's': {
      const h = Math.floor(valore / 3600), m = Math.floor((valore % 3600) / 60), s = Math.round(valore % 60)
      return h ? `${h}:${due(m)}:${due(s)}` : `${m}:${due(s)}`
    }
    case 's/km': return `${Math.floor(valore / 60)}:${due(Math.round(valore % 60))} /km`
    case 'm': return valore >= 1000 ? `${virgola(valore / 1000)} km` : `${valore} m`
    case 'kg': return `${virgola(valore)} kg`
    case 'round': return `${valore} round`
    default: return String(valore)
  }
}
