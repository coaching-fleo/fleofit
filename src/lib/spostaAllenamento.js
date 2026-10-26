import { addDays, format, parseISO, isValid, isSameDay, isBefore, startOfDay } from 'date-fns'
import { it } from 'date-fns/locale'

/**
 * L'atleta sposta da solo un allenamento a un altro giorno (26/10/2026:
 * «un giorno non può fare l'allenamento, sceglie una nuova data»).
 *
 * ⚠️ Si sposta l'ASSEGNAZIONE, non il workout: la data vera per l'atleta sta
 * in `athlete_workouts.completed_date` (docs/memoria/database.md). Toccare
 * `workouts.date` sposterebbe la seduta a tutti gli atleti a cui è assegnata
 * — e la policy di `athlete_workouts` lo lascia già scrivere all'atleta sulle
 * righe sue: nessuna migrazione.
 */

/** Si sposta solo ciò che è ancora da fare, e mai una gara: la data della gara non è sua. */
export function puoSpostare({ status, evento }) {
  return status !== 'completed' && !evento
}

/**
 * I giorni proposti a colpo d'occhio: da oggi in avanti, `quanti` in tutto,
 * senza quello in cui l'allenamento sta già. Una seduta saltata ieri si
 * recupera da oggi in poi: nel passato non la si fa più.
 */
export function giorniProposti(dataAttuale, oggi = new Date(), quanti = 7) {
  const attuale = dataAttuale && isValid(parseISO(dataAttuale)) ? parseISO(dataAttuale) : null
  const giorni = []
  for (let i = 0; giorni.length < quanti; i++) {
    const g = addDays(startOfDay(oggi), i)
    if (attuale && isSameDay(g, attuale)) continue
    giorni.push(g)
  }
  return giorni
}

/**
 * «Oggi», altrimenti il giorno della settimana. Sotto va il numero.
 * ⚠️ Niente «Domani»: su sette colonne in 375px si tronca in «DOM…», che si
 * legge domenica.
 */
export function nomeGiorno(giorno, oggi = new Date()) {
  if (isSameDay(giorno, oggi)) return 'Oggi'
  return format(giorno, 'EEE', { locale: it })
}

/** La data scelta, per il bottone di conferma: «mer 28 ott». */
export function dataBreve(data) {
  if (!data || !isValid(parseISO(data))) return ''
  return format(parseISO(data), 'EEE d MMM', { locale: it })
}

/** Per il bottone, dove il mese non ci sta: «gio 29». Il mese lo dice la data sopra. */
export function giornoBreve(data) {
  if (!data || !isValid(parseISO(data))) return ''
  return format(parseISO(data), 'EEE d', { locale: it })
}

/** Una data nel passato non è un recupero: il foglio non la conferma. */
export function eNelPassato(data, oggi = new Date()) {
  if (!data || !isValid(parseISO(data))) return false
  return isBefore(startOfDay(parseISO(data)), startOfDay(oggi))
}

/** Si scrive SOLO `completed_date`: stato, nota, RPE e vocale restano dove sono. */
export async function spostaAssegnazione(supabase, awId, data) {
  const { error } = await supabase.from('athlete_workouts')
    .update({ completed_date: data })
    .eq('id', awId)
  return { error }
}

/**
 * Il nome con cui la push presenta l'atleta: lo stesso ripiego della Home
 * (`fleofit_name_<uid>`, poi i metadati dell'accesso). È una stringa nuda,
 * non JSON: per questo non passa da `leggiJson`.
 */
export function nomeAtleta(user) {
  let salvato = null
  try { salvato = localStorage.getItem(`fleofit_name_${user?.id}`) } catch { /* storage non disponibile */ }
  const meta = user?.user_metadata || {}
  return salvato || meta.first_name || meta.full_name?.split(' ')[0] || 'Atleta'
}

/**
 * Il coach lo viene a sapere: ha programmato martedì, la seduta ora è
 * giovedì. Come il completamento, la push non blocca niente: se non parte lo
 * spostamento resta fatto.
 */
export function avvisaCoachSpostamento(supabase, { athleteName, workoutTitle, data, route }) {
  return supabase.functions.invoke('send-reminders', {
    body: { mode: 'coach_notification', action: 'moved', athleteName, workoutTitle, newDate: dataBreve(data), route },
  }).catch(console.error)
}
