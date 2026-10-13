// La griglia «atleti × giorni» del calendario desktop (src/pages/CalendarioTeam.jsx).
//
// Logica PURA: riceve atleti e assegnazioni già caricati, restituisce righe e
// celle pronte da disegnare. Bozza «2 · Calendario» approvata il 13/10/2026.

import { addDays, format, startOfWeek } from 'date-fns'
import { categoriaDi } from './categorie'
import { separaCodice } from './codiceWorkout'
import { rpeDichiarato } from './rpe'
import { inPausa } from './pausa'
import { COACHING_ID } from './constants'

/** I sette giorni della settimana che contiene `giorno`. Comincia di lunedì (CLAUDE.md §9). */
export const giorniSettimana = (giorno) => {
  const lunedi = startOfWeek(giorno, { weekStartsOn: 1 })
  return Array.from({ length: 7 }, (_, i) => addDays(lunedi, i))
}

export const chiave = (d) => format(d, 'yyyy-MM-dd')

const nomeCompleto = (a) => [a?.name, a?.surname].filter(Boolean).join(' ').trim() || 'Atleta'

/** Una sessione nella cella: quanto basta per la chip. */
export const chipDi = (ass) => {
  const categoria = categoriaDi(ass.workouts?.sections)
  const { nome, codice } = separaCodice(ass.workouts?.title || 'Allenamento')
  const completato = ass.status === 'completed'
  return {
    id: ass.id,
    workoutId: ass.workouts?.id || ass.workout_id,
    atletaId: ass.athlete_id,
    data: ass.completed_date,
    categoria,
    titolo: nome || 'Allenamento',
    codice,
    completato,
    // 🔴 `rpeDichiarato`, mai `parseNotesAndRpe`: il secondo inventa un 5 (CLAUDE.md §9).
    rpe: completato ? rpeDichiarato(ass.notes) : null,
  }
}

/**
 * Le righe della griglia: un atleta per riga, sette celle per riga.
 *
 * - Il profilo del coach (COACHING_ID) non è un atleta: fuori.
 * - Chi è in pausa va in fondo, segnato: non sparisce, perché un allenamento
 *   assegnato per sbaglio a chi è in pausa deve restare visibile.
 * - `filtro` è una categoria (`Hyrox`, `Running`, `Custom`, `Event`) o null.
 */
export function grigliaTeam(atleti = [], assegnazioni = [], giorni = [], { filtro = null } = {}) {
  const chiavi = giorni.map(chiave)
  const perAtleta = new Map()
  for (const ass of assegnazioni) {
    if (!ass?.athlete_id || !chiavi.includes(ass.completed_date)) continue
    const chip = chipDi(ass)
    if (filtro && chip.categoria !== filtro) continue
    if (!perAtleta.has(ass.athlete_id)) perAtleta.set(ass.athlete_id, new Map())
    const celle = perAtleta.get(ass.athlete_id)
    if (!celle.has(ass.completed_date)) celle.set(ass.completed_date, [])
    celle.get(ass.completed_date).push(chip)
  }

  const righe = atleti
    .filter(a => a && a.id !== COACHING_ID)
    .map(a => {
      const celle = perAtleta.get(a.id) || new Map()
      return {
        id: a.id,
        nome: nomeCompleto(a),
        foto: a.photo_url || null,
        inPausa: inPausa(a),
        celle: chiavi.map(k => ({ data: k, chips: celle.get(k) || [] })),
      }
    })

  righe.sort((x, y) => Number(x.inPausa) - Number(y.inPausa) || x.nome.localeCompare(y.nome))
  return righe
}

/** Sotto ogni colonna: quante sessioni quel giorno e quante già fatte. */
export function caricoGiorni(righe = []) {
  if (!righe.length) return []
  return righe[0].celle.map((_, i) => {
    const chips = righe.flatMap(r => r.celle[i].chips).filter(c => c.categoria !== 'Event')
    return { sessioni: chips.length, fatte: chips.filter(c => c.completato).length }
  })
}

/**
 * Si può spostare una sessione trascinandola? Solo se non è già fatta e se
 * resta sullo STESSO atleta: cambiare atleta trascinando è un gesto troppo
 * facile da fare per sbaglio, e toglierebbe l'allenamento a qualcuno.
 */
export const spostamentoValido = (chip, atletaId, data) =>
  !!chip && !chip.completato && chip.atletaId === atletaId && chip.data !== data
