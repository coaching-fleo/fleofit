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

/** L'orologio che l'ha registrata, per «Garmin · Forerunner 265»; vuoto se manca. */
export function dispositivoGarmin(attivita) {
  const d = attivita?.dati?.dispositivo
  return typeof d === 'string' ? d.trim() : ''
}

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

/**
 * «Abbina a…»: l'attività va su quel workout, che si completa (se lo era già,
 * resta com'è: lo stato non si riscrive).
 * ⚠️ Si prende solo un'attività ANCORA LIBERA (`athlete_workout_id` nullo): un
 * foglio rimasto aperto, o un altro dispositivo, non deve spostare un
 * abbinamento fatto nel frattempo. Se non si aggiorna nessuna riga: errore.
 */
export async function abbinaA(supabase, attivita, athleteWorkoutId) {
  const { data, error } = await supabase.from('garmin_attivita')
    .update({ athlete_workout_id: athleteWorkoutId, abbinamento: 'atleta' })
    .eq('garmin_id', attivita.garmin_id)
    .is('athlete_workout_id', null)
    .select('garmin_id')
  if (error) return { error }
  if (!data || data.length === 0) return { error: { message: 'attività già abbinata' } }
  // Solo lo stato, come «Segna come completato»: RPE e note restano all'atleta.
  // `.neq`: su un workout già completato non si scrive niente.
  const { error: eAw } = await supabase.from('athlete_workouts')
    .update({ status: 'completed' }).eq('id', athleteWorkoutId).neq('status', 'completed')
  return { error: eAw || null }
}

// ── Le attività libere nel calendario ───────────────────────────────────────

/**
 * Le attività dell'orologio di un atleta e di un periodo, abbinate o no: UNA
 * lettura per il mese mostrato. Le libere diventano le voci grigie
 * (`vociLibere`), le abbinate dicono a `candidatiAbbina` quali workout hanno
 * già la loro attività. La RLS le fa
 * leggere all'atleta e al suo coach. Un errore (rete, tabella che non c'è,
 * un'app senza Garmin) vale come «nessuna attività»: il calendario resta
 * quello di sempre, mai una pagina rotta per un dato in più.
 */
export async function leggiAttivitaPeriodo(supabase, athleteId, da, a) {
  if (!supabase || !athleteId) return []
  try {
    const { data, error } = await supabase.from('garmin_attivita')
      .select('garmin_id, giorno, tipo, durata_s, distanza_m, dati, athlete_workout_id, abbinamento')
      .eq('athlete_id', athleteId)
      .gte('giorno', da)
      .lte('giorno', a)
    return error ? [] : (data || [])
  } catch {
    return []
  }
}

/**
 * Le voci grigie di un giorno (`yyyy-MM-dd`): «Garmin · Corsa 42′». Solo le
 * attività libere: quelle abbinate stanno già nel loro allenamento.
 */
export function vociLibere(attivita, giorno) {
  return (attivita || [])
    .filter(a => a && !a.athlete_workout_id && String(a.giorno || '').slice(0, 10) === giorno)
    .map(a => {
      const durata = durataGarmin(a.durata_s)
      return { id: a.garmin_id, testo: `Garmin · ${nomeTipoAttivita(a.tipo)}${durata ? ` ${durata}` : ''}`, attivita: a }
    })
}

// I giorni fra due date `yyyy-MM-dd`, a mezzogiorno UTC: niente ora legale.
const giorniFra = (da, a) => Math.round(
  (Date.parse(`${a.slice(0, 10)}T12:00:00Z`) - Date.parse(`${da.slice(0, 10)}T12:00:00Z`)) / 86400000)

/**
 * «Abbina a…»: le assegnazioni del giorno dell'attività e dei due vicini (spec
 * Garmin §3), quello stesso giorno per primo, le da fare prima delle fatte.
 * Anche quelle già completate (l'atleta ha spuntato «fatto» prima che
 * l'orologio sincronizzasse), purché non abbiano già un'attività: `attivita`
 * sono le righe lette del periodo, abbinate comprese. Le righe sono nella
 * forma del calendario (il workout più `aw_id`, `status`, `date`).
 */
export function candidatiAbbina(assegnazioni, giorno, attivita = []) {
  const occupate = new Set((attivita || []).map(a => a?.athlete_workout_id).filter(Boolean))
  const fatto = (w) => w.status === 'completed'
  return (assegnazioni || [])
    .filter(w => w?.aw_id && typeof w.date === 'string' && !(fatto(w) && occupate.has(w.aw_id)))
    .map(w => ({ w, scarto: giorniFra(giorno, w.date) }))
    .filter(({ scarto }) => Math.abs(scarto) <= 1)
    .sort((x, y) => (fatto(x.w) - fatto(y.w)) || Math.abs(x.scarto) - Math.abs(y.scarto) || x.scarto - y.scarto)
    .map(({ w }) => w)
}
