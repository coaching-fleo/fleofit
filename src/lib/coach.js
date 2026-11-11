// Chi segue l'atleta: il nome del SUO coach, per «Mario Rossi ti segue da oggi».
//
// Fino all'11/11/2026 qui c'era una costante, 'Federico Leo': uno studio con un
// coach solo. Col multi-coach era sbagliata per chiunque entrasse col codice di
// un altro coach.
//
// 🔴 Il nome non si legge dal database dal lato atleta: la riga `athletes` del
// coach è protetta (policy «athletes proprio, del coach, admin»), e una
// funzione SQL sarebbe una migrazione (schema congelato, CLAUDE.md §0). Lo dà
// la Edge Function `mio-coach`, che risponde solo per chi chiama.
//
// La risposta si tiene sul dispositivo (`fleofit_coach_<uid>`): senza rete, o
// prima che la funzione sia pubblicata, `BenvenutoCoach` usa l'ultima, e senza
// nemmeno quella scrive «Il tuo coach ti segue da oggi». Mai un nome inventato.
import { leggiJson, scriviJson } from './offlineQueue'

const chiave = (uid) => `fleofit_coach_${uid}`

/** L'ultimo nome salvato su questo dispositivo, o `null`. */
export function coachSalvato(uid) {
  if (!uid) return null
  const nome = leggiJson(chiave(uid), null)
  return typeof nome === 'string' && nome.trim() ? nome : null
}

/**
 * Chiede il nome alla funzione e lo salva. Torna il nome, o quello salvato se
 * la risposta non serve (errore, rete, funzione non ancora pubblicata).
 */
export async function leggiMioCoach(supabase, uid) {
  try {
    const { data, error } = await supabase.functions.invoke('mio-coach', { body: {} })
    if (error) return coachSalvato(uid)
    const nome = typeof data?.nome === 'string' ? data.nome.trim() : ''
    if (!nome) return coachSalvato(uid)
    scriviJson(chiave(uid), nome)
    return nome
  } catch {
    return coachSalvato(uid)
  }
}
