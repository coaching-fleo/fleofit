// anteprimaSeduta.js — il riassunto di una seduta in poche righe (25/11/2026).
//
// Serve al foglio veloce di «In allenamento oggi» nella Home coach
// (FoglioSedutaOggi): il coach tocca una foto e vede in un colpo d'occhio cosa
// c'è nell'allenamento, senza aprire la scheda. Una riga per blocco (Hyrox),
// per tratto (Corsa) o per gruppo (Gym). Logica pura, coperta da test.
//
// ⚠️ La durata è quella VERA (`durataStimataReale`): `null` per Custom, Gara e
// allenamenti senza tempi. Il ripiego di `durataWorkout` sarebbe un numero
// inventato (CLAUDE.md §9, «nessun numero si inventa»).

import { getNormalizedBlocks } from './timerSequence'
import { sottotitoloBlocco } from './rigaBlocco'
import { gruppiInOrdine, serieDi } from './gym'
import { partiRipetuta } from './ripetute'
import { durataStimataReale } from './statistiche'

/** Quanti nomi di esercizi si scrivono sotto un blocco prima del «+N». */
export const ESERCIZI_IN_ANTEPRIMA = 3

const NOMI_BLOCCO = { WarmUp: 'Riscaldamento', Rest: 'Recupero' }
const NOMI_TRATTO = { warmup: 'Riscaldamento', run: 'Corsa', recover: 'Recupero', cooldown: 'Defaticamento' }

const pieno = (v) => v != null && String(v).trim() !== '' && String(v).trim() !== '-'
const unisci = (...parti) => parti.filter(pieno).join(' · ')

/** «Wall Balls · Sled Push · Burpees +2». */
export const nomiEsercizi = (nomi = [], quanti = ESERCIZI_IN_ANTEPRIMA) => {
  const veri = nomi.map(n => String(n ?? '').trim()).filter(Boolean)
  if (!veri.length) return ''
  const resto = veri.length - quanti
  return veri.slice(0, quanti).join(' · ') + (resto > 0 ? ` +${resto}` : '')
}

function righeHyrox(sections) {
  return getNormalizedBlocks({ sections }).map(b => ({
    titolo: NOMI_BLOCCO[b.type] || b.type,
    sotto: b.type === 'WarmUp' || b.type === 'Rest' ? (b.params?.duration || '') : sottotitoloBlocco(b),
    esercizi: nomiEsercizi((b.exercises || []).map(e => e?.name)),
  }))
}

function righeCorsa(steps = []) {
  return steps.filter(Boolean).map(s => {
    if (s.type === 'repeat') {
      const parti = partiRipetuta(s).map(p => [p.duration, p.pace].filter(pieno).join(' ')).filter(Boolean)
      return { titolo: `${parseInt(s.rounds, 10) || 1} × ripetute`, sotto: parti.join(' + '), esercizi: '' }
    }
    return { titolo: NOMI_TRATTO[s.type] || 'Corsa', sotto: unisci(s.duration, s.pace), esercizi: '' }
  })
}

function righeGym(gruppi = []) {
  return gruppiInOrdine(gruppi).map(g => {
    const esercizi = (g.esercizi || []).filter(Boolean)
    const reps = esercizi[0]?.reps
    return {
      titolo: esercizi.map(e => e.name).filter(Boolean).join(' + ') || 'Esercizi',
      sotto: unisci(`${serieDi(g)} serie${pieno(reps) ? ` × ${reps}` : ''}`, pieno(g.recupero) ? `rec ${g.recupero}` : ''),
      esercizi: '',
    }
  })
}

/**
 * Le righe del riassunto e la durata stimata.
 * @returns {{ righe: {titolo:string, sotto:string, esercizi:string}[], minuti: number|null }}
 */
export function anteprimaSeduta(sections) {
  const s = sections || {}
  const minuti = durataStimataReale(s)
  if (s.category === 'Event' || s.isEvent) return { righe: [], minuti: null }
  if (s.category === 'Running') return { righe: righeCorsa(s.steps), minuti }
  if (s.category === 'Gym') return { righe: righeGym(s.gym), minuti }
  if (s.category === 'Custom' || s.isAutonomous) return { righe: [], minuti: null }
  return { righe: righeHyrox(s), minuti }
}
