/**
 * La "cancellazione" di una nota vocale è SOFT: non si tocca lo storage, si
 * appende `#deleted=<timestamp>` all'URL salvato in
 * `athlete_workouts.voice_note_url` (CLAUDE.md §4). Chi legge quel campo deve
 * quindi filtrare, sempre.
 *
 * Era copiata identica in WorkoutDetail.jsx e AthleteDetail.jsx; la Home coach
 * ne aveva bisogno come terzo chiamante, e una terza copia di una regola di
 * dominio è il modo in cui una correzione ne raggiunge due su tre (§9 punto 1).
 */
export const isVoiceNoteValid = (url) => {
  if (!url) return false
  if (String(url).includes('#deleted=')) return false
  return true
}
