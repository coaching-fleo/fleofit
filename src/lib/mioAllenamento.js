// mioAllenamento.js — quale allenamento del coach mostra la card «Il tuo
// allenamento» nella sua Home (18/11/2026, docs/memoria/home-coach.md).
//
// Il coach si allena anche lui: si assegna i workout come a un atleta, e
// `athlete_workouts.completed_date` è il giorno dell'assegnazione.
// Regola: l'allenamento di oggi (quello ancora da fare, se ce ne sono due;
// fatto, con la spunta, se sono tutti fatti), altrimenti il prossimo da fare.
// Niente da mostrare → null, e la card non c'è.

/**
 * @param {Array} righe  `athlete_workouts` con `id, completed_date, status, workouts(id, title, sections)`
 * @param {string} oggi  'yyyy-MM-dd'
 */
export function scegliMioAllenamento(righe, oggi) {
  const valide = (righe || []).filter(r => r?.workouts?.id && r.completed_date && r.completed_date >= oggi)
  const daFare = r => r.status !== 'completed'

  const diOggi = valide.filter(r => r.completed_date === oggi)
  const scelta = diOggi.find(daFare) || diOggi[0]
    || valide.filter(daFare).sort((a, b) => a.completed_date.localeCompare(b.completed_date))[0]
  if (!scelta) return null

  return {
    awId: scelta.id,
    workoutId: scelta.workouts.id,
    titolo: scelta.workouts.title || '',
    data: scelta.completed_date,
    fatto: scelta.status === 'completed',
    oggi: scelta.completed_date === oggi,
    categoria: scelta.workouts.sections?.category || 'Hyrox',
  }
}
