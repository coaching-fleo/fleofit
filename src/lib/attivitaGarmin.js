// «Da Garmin»: come si leggono e si correggono, dall'app, le attività
// dell'orologio salvate in `garmin_attivita` (docs/memoria/garmin.md).
// Logica pura più le due scritture permesse dalla policy «abbinamento»:
// l'app può cambiare SOLO `athlete_workout_id` e `abbinamento`.

// I tipi di attività di Garmin, in italiano. ⚠️ DA VERIFICARE: Garmin non
// pubblica l'elenco dei valori di `activityType` (piano, Task 1).
export const TIPI_ATTIVITA = {
  RUNNING: 'Corsa',
  TREADMILL_RUNNING: 'Tapis roulant',
  TRAIL_RUNNING: 'Trail',
  TRACK_RUNNING: 'Pista',
  STRENGTH_TRAINING: 'Forza',
  INDOOR_CARDIO: 'Cardio indoor',
  HIIT: 'HIIT',
  INDOOR_ROWING: 'Vogatore',
  OTHER: 'Altro',
}

export const nomeTipoAttivita = (tipo) => TIPI_ATTIVITA[tipo] || 'Attività'

// Gli stessi tipi di corsa di `_shared/abbinaGarmin.ts`: solo per questi il
// passo al km ha senso.
const CORSA = new Set(['RUNNING', 'TREADMILL_RUNNING', 'TRAIL_RUNNING', 'TRACK_RUNNING'])

const positivo = (n) => Number.isFinite(n) && n > 0

/** `42′`, oppure `1 h 05′` oltre l'ora. */
export function durataGarmin(secondi) {
  if (!positivo(secondi)) return null
  const minuti = Math.round(secondi / 60)
  if (minuti < 60) return `${minuti}′`
  return `${Math.floor(minuti / 60)} h ${String(minuti % 60).padStart(2, '0')}′`
}

/** I minuti veri dell'attività, per il recap al posto della stima. */
export function minutiVeri(attivita) {
  return positivo(attivita?.durata_s) ? Math.round(attivita.durata_s / 60) : null
}

const chilometri = (metri) => `${(Math.round(metri / 100) / 10).toFixed(1).replace('.', ',')} km`

function passo(velocitaMs) {
  const sec = Math.round(1000 / velocitaMs)
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')} /km`
}

/**
 * Le righe della card «Da Garmin». Un dato che manca (o è zero) non compare:
 * mai «0» al posto di un numero che l'orologio non ha mandato.
 */
export function righeDaGarmin(attivita) {
  if (!attivita) return []
  const d = attivita.dati || {}
  const righe = []
  const durata = durataGarmin(attivita.durata_s)
  if (durata) righe.push({ etichetta: 'Durata', valore: durata })
  if (positivo(attivita.distanza_m)) righe.push({ etichetta: 'Distanza', valore: chilometri(attivita.distanza_m) })
  if (CORSA.has(attivita.tipo) && positivo(d.velocita_media_ms)) righe.push({ etichetta: 'Passo', valore: passo(d.velocita_media_ms) })
  if (positivo(d.fc_media)) righe.push({ etichetta: 'FC media', valore: `${Math.round(d.fc_media)} bpm` })
  if (positivo(d.fc_max)) righe.push({ etichetta: 'FC max', valore: `${Math.round(d.fc_max)} bpm` })
  if (positivo(d.dislivello_m)) righe.push({ etichetta: 'Dislivello', valore: `${Math.round(d.dislivello_m)} m` })
  if (positivo(d.calorie)) righe.push({ etichetta: 'Calorie', valore: `${Math.round(d.calorie)} kcal` })
  return righe
}

/**
 * «Non era questo allenamento»: l'attività si libera con `abbinamento: 'atleta'`
 * — ⚠️ il webhook non riabbina MAI una riga con `abbinamento` non nullo, ed è
 * questa scrittura a garantirlo. Il workout torna da fare solo se l'aveva
 * completato Garmin (`'auto'`): se l'atleta l'aveva abbinata a mano, il
 * completamento è suo e resta.
 * Prima l'attività, poi il workout: se la seconda scrittura fallisce resta un
 * workout completato da rimettere a mano, mai un'attività legata a un workout
 * da fare.
 */
export async function annullaAbbinamento(supabase, attivita) {
  const { error } = await supabase.from('garmin_attivita')
    .update({ athlete_workout_id: null, abbinamento: 'atleta' })
    .eq('garmin_id', attivita.garmin_id)
  // `fallito`: quale scrittura non è andata ('attivita' o 'workout'), così la
  // pagina dice il vero quando l'attività è staccata ma il workout no.
  if (error) return { error, tornaDaFare: false, fallito: 'attivita' }

  const tornaDaFare = attivita.abbinamento === 'auto' && !!attivita.athlete_workout_id
  if (!tornaDaFare) return { error: null, tornaDaFare: false, fallito: null }

  // Gli stessi campi di «Segna come da fare» (`toggleStatus` in WorkoutDetail).
  const { error: eAw } = await supabase.from('athlete_workouts')
    .update({ status: 'pending' }).eq('id', attivita.athlete_workout_id)
  return { error: eAw || null, tornaDaFare: !eAw, fallito: eAw ? 'workout' : null }
}

/** «Abbina a…»: l'attività va su quel workout, che si completa. */
export async function abbinaA(supabase, attivita, athleteWorkoutId) {
  const { error } = await supabase.from('garmin_attivita')
    .update({ athlete_workout_id: athleteWorkoutId, abbinamento: 'atleta' })
    .eq('garmin_id', attivita.garmin_id)
  if (error) return { error }
  // Solo lo stato, come «Segna come completato»: RPE e note restano all'atleta.
  const { error: eAw } = await supabase.from('athlete_workouts')
    .update({ status: 'completed' }).eq('id', athleteWorkoutId)
  return { error: eAw || null }
}
