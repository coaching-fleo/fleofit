// «Ultime sedute chiuse» della Home coach desktop (piano desktop fase 2, #4).
//
// ⚠️ Il piano parlava di un «flusso attività in tempo reale». Non lo è, e non
// può esserlo senza toccare il database: `athlete_workouts` non ha un orario
// (nessun `created_at`, `completed_date` è un giorno) e metterla in Realtime è
// una modifica alla configurazione del database condiviso. Quindi l'elenco è
// PER GIORNO, e dentro un giorno l'ordine non dice chi ha finito prima.
//
// Logica pura sulle righe che la Home ha già caricato: nessuna lettura nuova.

import { differenceInCalendarDays, format, parseISO, startOfDay } from 'date-fns'
import { it } from 'date-fns/locale'
import { rpeDichiarato, testoNota } from './rpe'
import { gradimentoDi } from './gradimento'
import { isVoiceNoteValid } from './notaVocale'
import { separaCodice } from './codiceWorkout'
import { COACHING_ID } from './constants'

const nomeAtleta = (a) => [a?.name, a?.surname].filter(Boolean).join(' ').trim() || 'Atleta'

/** «oggi», «ieri», «lun 12». */
const etichettaGiorno = (data, oggi) => {
  const giorni = differenceInCalendarDays(startOfDay(oggi), parseISO(data))
  if (giorni <= 0) return 'oggi'
  if (giorni === 1) return 'ieri'
  return format(parseISO(data), 'EEE d', { locale: it })
}

export function ultimeSedute(assegnazioni = [], atleti = [], { giorni = 7, limite = 20, oggi = new Date() } = {}) {
  const rubrica = new Map(atleti.filter(a => a?.id && a.id !== COACHING_ID).map(a => [a.id, a]))
  const da = format(new Date(startOfDay(oggi).getTime() - (giorni - 1) * 86400000), 'yyyy-MM-dd')
  const fino = format(oggi, 'yyyy-MM-dd')

  return assegnazioni
    .filter(r => r?.status === 'completed' && rubrica.has(r.athlete_id)
      && r.completed_date >= da && r.completed_date <= fino)
    .sort((a, b) => b.completed_date.localeCompare(a.completed_date))
    .slice(0, limite)
    .map(r => {
      const atleta = rubrica.get(r.athlete_id)
      return {
        id: r.id,
        atletaId: r.athlete_id,
        nome: nomeAtleta(atleta),
        foto: atleta.photo_url || null,
        titolo: separaCodice(r.workouts?.title || 'Allenamento').nome || 'Allenamento',
        workoutId: r.workouts?.id || r.workout_id,
        data: r.completed_date,
        giorno: etichettaGiorno(r.completed_date, oggi),
        rpe: rpeDichiarato(r.notes),
        gradimento: gradimentoDi(r.notes),
        haNota: !!testoNota(r.notes),
        haVocale: isVoiceNoteValid(r.voice_note_url),
      }
    })
}
