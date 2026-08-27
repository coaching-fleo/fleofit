// Le quattro "corsie" di categoria, in un punto solo.
//
// DESIGN.md → La Regola della Corsia: ogni categoria ha un colore e uno solo,
// e quel colore si propaga ovunque quella categoria compaia. Farlo davvero
// richiede che la tabella esista una volta: era in HomeAtletaUI.jsx e la
// normalizzazione della categoria era, separatamente, dentro statistiche.js.
//
// ⚠️ Le classi sono stringhe INTERE e statiche: Tailwind non le troverebbe se
// fossero composte a runtime (`text-${x}`).

import { CalendarDays, Dumbbell, Timer, Flame } from 'lucide-react'

export const CORSIA = {
  Hyrox: { etichetta: 'Hyrox', txt: 'text-brand', bg: 'bg-brand', dot: 'bg-brand', bordo: 'hover:border-brand', testoSuBg: 'text-black', icona: Flame },
  Running: { etichetta: 'Running', txt: 'text-running', bg: 'bg-running', dot: 'bg-running', bordo: 'hover:border-running', testoSuBg: 'text-white', icona: Timer },
  Custom: { etichetta: 'Libero', txt: 'text-custom', bg: 'bg-custom', dot: 'bg-custom', bordo: 'hover:border-custom', testoSuBg: 'text-white', icona: Dumbbell },
  Event: { etichetta: 'Gara', txt: 'text-white', bg: 'bg-white', dot: 'bg-white', bordo: 'hover:border-white', testoSuBg: 'text-black', icona: CalendarDays },
}

/** La corsia di una categoria già normalizzata; Hyrox è il ripiego. */
export const corsia = (categoria) => CORSIA[categoria] || CORSIA.Hyrox

/**
 * La categoria di un workout a partire dalle sue `sections`.
 *
 * `Autonomo` e `isAutonomous` sono due modi diversi di dire "Custom" che
 * convivono nei dati (CLAUDE.md §5): riconoscerli qui evita che ogni pagina
 * ripeta il proprio ripiego, con esiti diversi.
 */
export const categoriaDi = (sections) => {
  const s = sections || {}
  const grezza = s.category || (s.steps ? 'Running' : 'Hyrox')
  if (grezza === 'Event') return 'Event'
  if (grezza === 'Custom' || grezza === 'Autonomo' || s.isAutonomous === true) return 'Custom'
  return grezza
}
