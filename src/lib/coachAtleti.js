// Gestione dei coach (solo admin): chi è nello staff e di chi sono gli atleti.
// Le tabelle `staff` e `coach_atleti` le scrivono solo gli admin (RLS): qui
// non si controlla il ruolo, lo fa il database. Il congelamento dello schema
// (CLAUDE.md §0-bis) vale finché la migrazione multi-coach non è applicata.

/** Minuscolo e senza spazi; `null` se non è un indirizzo (serve `@` e un punto dopo). */
export function normalizzaEmail(s) {
  const e = String(s ?? '').trim().toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null
}

/** Mette un indirizzo nello staff come coach (potrà registrarsi dopo). */
export async function aggiungiCoach(supabase, email) {
  const e = normalizzaEmail(email)
  if (!e) return { error: 'Indirizzo non valido' }
  const { error } = await supabase.from('staff').insert({ email: e, ruolo: 'coach' })
  return { error: error ?? null }
}

/**
 * Toglie un coach dallo staff. Se ha ancora atleti rifiuta: sarebbero atleti
 * di nessuno. `coachId` è null quando non ha ancora creato l'account.
 */
export async function togliCoach(supabase, email, coachId) {
  if (coachId) {
    const { data, error } = await supabase.from('coach_atleti').select('athlete_id').eq('coach_id', coachId)
    if (error) return { error }
    if ((data || []).length > 0) return { error: 'Ha ancora atleti' }
  }
  const { error } = await supabase.from('staff').delete().eq('email', String(email).trim().toLowerCase())
  return { error: error ?? null }
}

/**
 * Assegna un atleta a un coach. Con `vecchioCoachId` è uno spostamento: la
 * coppia vecchia sparisce prima. La chiave è (athlete_id, coach_id), non
 * l'atleta solo: niente `onConflict` su una colonna sola.
 */
export async function assegnaAtleta(supabase, athleteId, coachId, vecchioCoachId) {
  if (vecchioCoachId) {
    const { error } = await supabase.from('coach_atleti').delete()
      .eq('athlete_id', athleteId).eq('coach_id', vecchioCoachId)
    if (error) return { error }
  }
  const { error } = await supabase.from('coach_atleti').insert({ athlete_id: athleteId, coach_id: coachId })
  if (error && vecchioCoachId) {
    // Lo spostamento non è riuscito: l'atleta non resta senza coach.
    await supabase.from('coach_atleti').insert({ athlete_id: athleteId, coach_id: vecchioCoachId })
  }
  return { error: error ?? null }
}
