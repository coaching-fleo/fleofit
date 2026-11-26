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
 * (`pushfit_name_<uid>`, poi i metadati dell'accesso). È una stringa nuda,
 * non JSON: per questo non passa da `leggiJson`.
 */
export function nomeAtleta(user) {
  let salvato = null
  try { salvato = localStorage.getItem(`pushfit_name_${user?.id}`) } catch { /* storage non disponibile */ }
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

// ── Il coach sposta (26/11/2026, docs/superpowers/specs/2026-11-26-coach-sposta-data-design.md) ──

/**
 * «Sposta per tutti»: la seduta di QUEL giorno (`giorno`), non tutte le
 * assegnazioni del workout. ⚠️ Il coach riusa lo stesso workout in giorni
 * diversi: chi ce l'ha un altro giorno è un'altra seduta e non si tocca
 * (trovato in prova il 26/11/2026: in demo un workout ne aveva 124).
 * Di quel giorno si spostano i NON svolti; chi l'ha già fatto resta, perché
 * riscrivergli la data cambierebbe la sua storia senza che se ne accorga.
 * `totale` = quanti hanno la seduta quel giorno, svolti compresi.
 */
export function chiSiSposta(assegnazioni, giorno) {
  const delGiorno = (assegnazioni || []).filter(a => a.completed_date === giorno)
  const svolti = delGiorno.filter(a => a.status === 'completed').length
  const siSpostano = delGiorno.filter(a => a.status !== 'completed').map(a => a.id)
  return { siSpostano, svolti, totale: delGiorno.length }
}

/**
 * Sposta la seduta: prima `workouts.date`, poi le assegnazioni scelte.
 * Se la seconda scrittura fallisce si rimette la data del workout com'era,
 * così non resta un workout spostato con gli atleti fermi al giorno vecchio.
 */
export async function spostaPerTutti(supabase, { workoutId, dataOriginale, ids, nuovaData, aggiornaWorkout = true }) {
  if (aggiornaWorkout) {
    const { error: errWorkout } = await supabase.from('workouts').update({ date: nuovaData }).eq('id', workoutId)
    if (errWorkout) return { error: errWorkout }
  }
  if (!ids?.length) return { error: null }
  const { error } = await supabase.from('athlete_workouts').update({ completed_date: nuovaData }).in('id', ids)
  if (error) {
    if (aggiornaWorkout) await supabase.from('workouts').update({ date: dataOriginale }).eq('id', workoutId)
    return { error }
  }
  return { error: null }
}

/** Una data nel passato è una correzione del coach, non un avviso: niente push. */
export function daAvvisare({ nuovaData, oggi = new Date() }) {
  return !eNelPassato(nuovaData, oggi)
}

/**
 * L'atleta lo viene a sapere (`send-reminders`, modo `athlete_moved`). Come
 * l'avviso al coach, la push non blocca niente: se non parte lo spostamento resta.
 */
export function avvisaAtletiSpostamento(supabase, { awIds, data }) {
  if (!awIds?.length) return Promise.resolve()
  return supabase.functions.invoke('send-reminders', {
    body: { mode: 'athlete_moved', record_ids: awIds, newDate: dataBreve(data) },
  }).catch(console.error)
}

/**
 * Lo spostamento del coach, uguale dalla scheda workout e dalla scheda atleta:
 * `solo` scrive solo l'assegnazione `aw` (mai `workouts.date`); `tutti` sposta
 * la seduta del giorno di `aw` (o di `dataWorkout` senza atleta) e tocca
 * `workouts.date` solo se era proprio quel giorno. `spostati` = chi avvisare
 * (mai chi l'ha già svolto).
 */
export async function spostaDalCoach(supabase, { portata, aw, assegnazioni, dataWorkout, workoutId, nuovaData }) {
  if (portata === 'solo' && aw) {
    const { error } = await spostaAssegnazione(supabase, aw.id, nuovaData)
    return { error, spostati: error || aw.status === 'completed' ? [] : [aw.id] }
  }
  const giorno = aw?.completed_date || dataWorkout
  const { siSpostano } = chiSiSposta(assegnazioni, giorno)
  const { error } = await spostaPerTutti(supabase, {
    workoutId, dataOriginale: dataWorkout, ids: siSpostano, nuovaData, aggiornaWorkout: giorno === dataWorkout,
  })
  return { error, spostati: error ? [] : siSpostano }
}
