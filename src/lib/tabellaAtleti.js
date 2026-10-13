// La tabella degli atleti della versione desktop (src/components/AtletiDesktop.jsx).
// Logica pura, coperta da test.

import { differenceInCalendarDays, parseISO } from 'date-fns'

/**
 * L'ultimo allenamento COMPLETATO di ogni atleta, fra le assegnazioni caricate.
 * Restituisce una Map athlete_id → 'yyyy-MM-dd'. Chi non ne ha non compare:
 * la cella mostrerà «—», non una data inventata (CLAUDE.md §9).
 */
export function ultimoAllenamento(assegnazioni = []) {
  const ultimo = new Map()
  for (const a of assegnazioni) {
    if (a?.status !== 'completed' || !a.athlete_id || !a.completed_date) continue
    const prima = ultimo.get(a.athlete_id)
    if (!prima || a.completed_date > prima) ultimo.set(a.athlete_id, a.completed_date)
  }
  return ultimo
}

/** «oggi», «ieri», «3 giorni fa». `null` se la data manca. */
export function quandoFa(data, oggi = new Date()) {
  if (!data) return null
  const giorni = differenceInCalendarDays(oggi, parseISO(data))
  if (giorni <= 0) return 'oggi'
  if (giorni === 1) return 'ieri'
  return `${giorni} giorni fa`
}
