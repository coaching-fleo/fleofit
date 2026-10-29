// La griglia «atleti × giorni» del calendario desktop (src/pages/CalendarioTeam.jsx).
//
// Logica PURA: riceve atleti e assegnazioni già caricati, restituisce righe e
// celle pronte da disegnare. Bozza «2 · Calendario» approvata il 13/10/2026.

import { addDays, format, parseISO, startOfWeek } from 'date-fns'
import { categoriaDi } from './categorie'
import { separaCodice } from './codiceWorkout'
import { rpeDichiarato } from './rpe'
import { inPausa } from './pausa'
import { escludiDallaRubrica } from './constants'

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

  const righe = escludiDallaRubrica(atleti)
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

/**
 * «Copia settimana» (piano desktop fase 2, #5): le sedute di un atleta nella
 * settimana mostrata, da riassegnare a lui la settimana dopo (`scartoGiorni`
 * 7) o a un altro atleta negli stessi giorni (`scartoGiorni` 0).
 *
 * - Le copie nascono SEMPRE `pending`: copiare una settimana fatta non vuol
 *   dire che il destinatario l'abbia fatta.
 * - Si salta ciò che il destinatario ha già (stesso workout, stessa data), e
 *   `saltate` lo dice: un secondo clic non raddoppia la settimana.
 * - Il workout resta lo stesso (`workout_id`): è un'assegnazione nuova, non una
 *   copia del programma, come quando lo si trascina dalla libreria.
 *
 * `assegnazioni` deve contenere anche le righe del destinatario nei giorni di
 * arrivo, altrimenti i doppioni non si vedono: è il chiamante a leggerle.
 */
/**
 * Un «allenamento libero» scritto dall'atleta (CLAUDE.md §5): un workout Custom
 * autonomo SENZA note del coach, perché il contenuto sta in
 * `athlete_workouts.notes`. Copiarlo vorrebbe dire assegnare a qualcuno un
 * allenamento vuoto, con tanto di push. Un Custom scritto dal coach ha il suo
 * testo in `coach_notes` e si copia come gli altri.
 */
export const liberoDellAtleta = (ass) => {
  const s = ass?.workouts?.sections
  return !!s && s.isAutonomous === true && categoriaDi(s) === 'Custom' && !String(ass.workouts?.coach_notes ?? '').trim()
}

export function copiaSettimana(assegnazioni = [], { daAtleta, aAtleta, giorni = [], scartoGiorni = 0 } = {}) {
  const dentro = new Set(giorni)
  const esistenti = new Set(assegnazioni
    .filter(r => r?.athlete_id === aAtleta)
    .map(r => `${r.workout_id || r.workouts?.id}|${r.completed_date}`))

  const nuove = []
  let saltate = 0, liberi = 0
  const origine = assegnazioni
    .filter(r => r?.athlete_id === daAtleta && dentro.has(r.completed_date))
    .sort((x, y) => x.completed_date.localeCompare(y.completed_date))

  for (const r of origine) {
    if (liberoDellAtleta(r)) { liberi++; continue }
    const workout_id = r.workout_id || r.workouts?.id
    if (!workout_id) continue
    const completed_date = format(addDays(parseISO(r.completed_date), scartoGiorni), 'yyyy-MM-dd')
    const k = `${workout_id}|${completed_date}`
    if (esistenti.has(k)) { saltate++; continue }
    esistenti.add(k)
    nuove.push({ athlete_id: aAtleta, workout_id, completed_date, status: 'pending' })
  }
  return { nuove, saltate, liberi }
}
