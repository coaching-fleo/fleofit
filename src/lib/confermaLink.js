/**
 * La pagina dei link delle mail, `/conferma` (dal 18/11/2026).
 *
 * Prima il link della mail (conferma dell'iscrizione, reset della password)
 * portava a `https://<progetto>.supabase.co/auth/v1/verify`: l'indirizzo brutto
 * che la persona vedeva, e un codice monouso che l'antivirus della posta poteva
 * consumare aprendo il link prima di lei (`esitoLink.js`, «otp_expired»).
 *
 * Ora il modello della mail (supabase/mail/) porta qui, con il codice
 * (`token_hash`), il tipo e `torna`: dove Supabase avrebbe rimandato, cioè
 * `fleofit://login-callback…` se la richiesta veniva dall'app, il sito se
 * veniva dal browser. Al TOCCO del bottone la pagina verifica il codice e
 * rimanda a `torna` con la sessione nell'hash, IDENTICA a quella che produceva
 * Supabase: il resto dell'app (DeeplinkHandler, recuperoPassword.js,
 * esitoLink.js) non si accorge di niente.
 */
import { SCHEMI } from './schema'

/** I tipi che le nostre mail usano. `email` è la conferma dell'iscrizione. */
export const TIPI = ['recovery', 'email', 'signup']

/** Gli indirizzi del sito a cui si può tornare, oltre all'origine della pagina. */
export const SITI = ['https://fleofit.vercel.app', 'https://pushfit.it', 'https://www.pushfit.it']

/**
 * Codice, tipo e ritorno dalla query della pagina.
 * ⚠️ `torna` va per ULTIMO nel modello e si legge fino in fondo: se Supabase
 * lo scrive senza codificarlo, i suoi `?` e `&` (`?inviteCode=…`) non devono
 * spezzarlo.
 */
export function leggiLinkConferma(search) {
  const s = String(search || '').replace(/^\?/, '')
  const p = new URLSearchParams(s)
  const tokenHash = p.get('token_hash') || ''
  const tipo = TIPI.includes(p.get('type')) ? p.get('type') : null
  let torna = ''
  const i = s.indexOf('torna=')
  if (i !== -1) {
    const grezzo = s.slice(i + 'torna='.length)
    torna = /^[a-z]+%3A/i.test(grezzo) || /^https?%3A/i.test(grezzo) ? safeDecode(grezzo) : grezzo
  }
  return { tokenHash, tipo, torna }
}

function safeDecode(t) {
  try { return decodeURIComponent(t) } catch { return t }
}

/**
 * Dove si può davvero tornare. La sessione finisce nell'hash di questo
 * indirizzo: mai verso un sito che non è il nostro. Ammessi solo il ritorno
 * dell'app (`<schema>://login-callback`), l'origine della pagina e i SITI.
 * Tutto il resto, o niente, diventa l'origine della pagina.
 */
export function ritornoSicuro(torna, origine) {
  let url
  try { url = new URL(torna) } catch { return origine }
  const protocollo = url.protocol.replace(/:$/, '').toLowerCase()
  if (SCHEMI.includes(protocollo)) {
    // `fleofit://login-callback` (host) o, su qualche WebView, il percorso.
    const dove = url.host || url.pathname.replace(/^\/+/, '')
    return dove.startsWith('login-callback') ? torna.split('#')[0] : origine
  }
  if (url.protocol === 'https:' || url.origin === origine) {
    return url.origin === origine || SITI.includes(url.origin) ? torna.split('#')[0] : origine
  }
  return origine
}

/** L'indirizzo di ritorno con la sessione nell'hash, nel formato di Supabase. */
export function ritornoConSessione(ritorno, sessione, tipo) {
  const h = new URLSearchParams({
    access_token: sessione.access_token,
    expires_at: String(sessione.expires_at ?? ''),
    expires_in: String(sessione.expires_in ?? ''),
    refresh_token: sessione.refresh_token,
    token_type: sessione.token_type || 'bearer',
    type: tipo,
  })
  return `${ritorno}#${h.toString()}`
}

/** L'indirizzo di ritorno con l'errore nell'hash, come lo mandava Supabase (esitoLink.js). */
export function ritornoConErrore(ritorno, errore) {
  const scaduto = /expired|invalid|not found/i.test(errore?.message || '') || errore?.code === 'otp_expired'
  const h = new URLSearchParams({
    error: 'access_denied',
    error_code: scaduto ? 'otp_expired' : (errore?.code || 'unexpected_failure'),
    error_description: errore?.message || 'Link non valido',
  })
  return `${ritorno}#${h.toString()}`
}

/** I testi della pagina per ogni tipo di link. */
export function testiConferma(tipo) {
  if (tipo === 'recovery') {
    return { titolo: 'Reimposta la password', testo: 'Tocca il bottone per scegliere la password nuova.', bottone: 'Scegli la password nuova' }
  }
  return { titolo: 'Conferma la tua email', testo: 'Tocca il bottone per confermare l\'indirizzo e continuare l\'iscrizione.', bottone: 'Conferma la tua email' }
}
