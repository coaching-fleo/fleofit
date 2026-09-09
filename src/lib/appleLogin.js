/**
 * Sign in with Apple — le due parti che si sbagliano in silenzio.
 *
 * Il resto del flusso (aprire il foglio di sistema, scambiare il token con
 * Supabase) vive in `Login.jsx`, perché tocca la rete. Qui c'è solo ciò che si
 * può verificare senza un iPhone.
 */

/**
 * 🔴 IL NONCE VA HASHATO DA UN LATO E NO DALL'ALTRO, ED È LA TRAPPOLA DI TUTTA
 * L'INTEGRAZIONE.
 *
 * Il plugin nativo fa `request.nonce = call.getString("nonce")`, cioè scrive nel
 * token di Apple **esattamente** la stringa che gli passiamo. Supabase invece
 * documenta il contratto opposto (`@supabase/auth-js`, SignInWithIdTokenCredentials):
 * «If the ID token contains a nonce claim, then **the hash of this value** is
 * compared to the value in the ID token».
 *
 * Quindi: al plugin va `hash`, a `signInWithIdToken` va `chiaro`. Passare lo
 * stesso valore ai due lati non dà nessun errore leggibile — dà un 400 che
 * sembra un problema di configurazione su Apple, e ci si perdono ore.
 *
 * Torna `null` quando la WebView non espone `crypto.subtle` (contesto non
 * sicuro). NON è un caso da far fallire: senza nonce il token non porta il
 * claim, Supabase non ha niente da confrontare e il login funziona lo stesso —
 * si perde la sola protezione dal riutilizzo di un token già speso, che è
 * esattamente il compromesso che accettano gli esempi nativi di Supabase.
 * Meglio un login che entra senza nonce di un login che non entra affatto.
 */
export async function generaNonce(cripto = globalThis.crypto) {
  if (!cripto?.getRandomValues || !cripto?.subtle?.digest) return null

  const byte = new Uint8Array(32)
  cripto.getRandomValues(byte)
  const chiaro = esadecimale(byte)

  const digest = await cripto.subtle.digest('SHA-256', new TextEncoder().encode(chiaro))
  return { chiaro, hash: esadecimale(new Uint8Array(digest)) }
}

function esadecimale(byte) {
  return Array.from(byte, (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * 🔴 APPLE DÀ IL NOME UNA VOLTA SOLA, ALLA PRIMISSIMA AUTORIZZAZIONE.
 *
 * Non è nel token e non torna più a nessun accesso successivo: se non lo si
 * scrive subito in `user_metadata`, è perso per sempre. Il sintomo non è un
 * errore — è l'onboarding con i campi vuoti e la Home che saluta un pezzo di
 * indirizzo email (`ProtectedRoute` ripiega su `email.split('@')[0]`, che con
 * «Nascondi la mia email» è una stringa di caratteri casuali).
 *
 * Torna `null` quando non c'è niente da salvare, così chi chiama non scrive
 * metadati vuoti sopra quelli buoni di un accesso precedente.
 */
export function nomeDaApple(response) {
  const nome = (response?.givenName || '').trim()
  const cognome = (response?.familyName || '').trim()
  if (!nome && !cognome) return null

  return {
    first_name: nome,
    last_name: cognome,
    full_name: [nome, cognome].filter(Boolean).join(' '),
  }
}

/**
 * ⚠️ CHIUDERE IL FOGLIO DI APPLE NON È UN ERRORE DA MOSTRARE.
 *
 * Il plugin rigetta con `error.localizedDescription`, quindi l'annullamento
 * arriva come un guasto qualunque: «The operation couldn't be completed.
 * (com.apple.AuthenticationServices.AuthorizationError error 1001.)». Mostrarlo
 * vuol dire rispondere con un allarme rosso a chi ha appena deciso di non
 * entrare — e quel testo, per giunta, non spiega niente a nessuno.
 *
 * 1001 è `ASAuthorizationError.canceled`. Gli altri codici (1000 unknown,
 * 1002 invalidResponse, 1003 notHandled, 1004 failed) sono guasti veri e vanno
 * detti.
 */
export function annullatoDallUtente(messaggio) {
  const testo = String(messaggio || '').toLowerCase()
  return testo.includes('error 1001') || testo.includes('cancel') || testo.includes('annull')
}
