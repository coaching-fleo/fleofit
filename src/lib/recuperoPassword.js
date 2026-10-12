/**
 * 🔴 Il link «reimposta password» è anche un LOGIN.
 *
 * Supabase lo trasforma in una sessione vera, come un magic link. Se nessuno
 * ricorda che quella sessione è nata per cambiare la password, l'app la tratta
 * come un accesso qualunque e porta alla Home: è il guasto segnalato il
 * 12/10/2026 («mi fa entrare senza farmi reimpostare la password»).
 *
 * Questo modulo è quel ricordo. Finché il recupero è in corso:
 *  - `ProtectedRoute` non mostra l'app e rimanda a /login;
 *  - `Login` resta sulla vista «Nuova password» invece di andare alla Home.
 *
 * ⚠️ Sul web va letto PRIMA che nasca il client Supabase: `createClient` legge
 * il `#access_token=…&type=recovery` dall'indirizzo e lo CANCELLA subito, prima
 * ancora che React monti qualcosa. Per questo `supabaseClient.js` importa
 * questo file per primo, e lo stato iniziale si calcola qui al caricamento.
 *
 * Sull'app nativa il link arriva invece da `appUrlOpen` (DeeplinkHandler), che
 * chiama `avviaRecupero()` prima di aprire la sessione.
 *
 * È in memoria e non in localStorage, apposta: se l'app viene chiusa a metà,
 * il recupero non deve sopravvivere e bloccare per sempre l'accesso.
 */

export const eUnLinkDiRecupero = (hash) =>
  new URLSearchParams(String(hash || '').replace(/^#/, '')).get('type') === 'recovery'

let inCorso = typeof window !== 'undefined' && eUnLinkDiRecupero(window.location.hash)

export const recuperoInCorso = () => inCorso
export const avviaRecupero = () => { inCorso = true }
export const chiudiRecupero = () => { inCorso = false }
