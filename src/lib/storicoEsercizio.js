// Lo storico di un esercizio per un atleta (piano desktop fase 2, #2): con che
// carico e che distanza l'ha fatto ogni volta, e cosa ha dichiarato nelle note.
//
// Due fonti, e restano distinte a schermo:
//  · la PRESCRIZIONE, cioè ciò che il coach ha scritto nel workout (kg, metri,
//    ripetizioni). È ciò che `movimentiDi` riassume nel report atleta;
//  · il DICHIARATO, cioè i risultati che `estrai-note` ha letto nelle note
//    dell'atleta («wall balls in 6:40»). Possono mancare: sono un di più.
//
// Logica pura. I parser dei numeri scritti a mano sono quelli del report
// atleta, così «9kg» vale 9 in entrambe le pagine.

import { categoriaDi } from './categorie'
import { getNormalizedBlocks } from './timerSequence'
import { metriDi } from './stimaWorkout'
import { movimentiDi, numero } from './reportAtleta'

const completata = (r) => r?.status === 'completed' && !!r.completed_date

/** Gli esercizi delle sedute completate, più frequenti prima. */
export function eserciziDi(righe = []) {
  return movimentiDi(righe).map(m => ({ nome: m.nome, sedute: m.sedute }))
}

/** Il massimo fra due valori che possono mancare. */
const massimo = (a, b) => (a == null ? b : b == null ? a : Math.max(a, b))

/**
 * Una voce per seduta completata che contiene l'esercizio, in ordine di data.
 * Se l'esercizio compare più volte nella stessa seduta vale il carico più alto
 * (e così metri e ripetizioni): è il dato che il coach cerca, «fin dove è arrivato».
 */
export function storicoEsercizio(righe = [], nome, estratti = []) {
  const risultatiPer = new Map()
  for (const e of estratti) {
    const propri = (e?.estrazione?.risultati ?? [])
      .filter(r => r?.esercizio === nome)
      .map(({ misura, valore, unita, citazione }) => ({ misura, valore, unita, citazione }))
    if (propri.length) risultatiPer.set(e.athlete_workout_id, propri)
  }

  const storico = []
  for (const r of righe) {
    if (!completata(r)) continue
    const sections = r.workouts?.sections
    if (categoriaDi(sections) === 'Running') continue
    let trovato = false, kg = null, metri = null, reps = null
    for (const blocco of getNormalizedBlocks({ sections })) {
      for (const ex of blocco.exercises || []) {
        if (String(ex?.name || '').trim() !== nome) continue
        trovato = true
        kg = massimo(kg, numero(ex.kg))
        metri = massimo(metri, metriDi(ex.meters) || null)
        reps = massimo(reps, numero(ex.reps))
      }
    }
    if (!trovato) continue
    storico.push({
      id: r.id,
      data: r.completed_date,
      workoutId: r.workouts?.id || r.workout_id,
      kg, metri, reps,
      risultati: risultatiPer.get(r.id) || [],
    })
  }
  return storico.sort((a, b) => a.data.localeCompare(b.data))
}
