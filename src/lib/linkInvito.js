/**
 * Il link d'invito che il coach manda su WhatsApp, e dove porta.
 *
 * Il link è `https://fleofit.vercel.app/invito/<codice>` (dal 16/11/2026; prima
 * era `/?invite=<codice>`, che resta valido perché è già nelle chat degli
 * atleti). La pagina `/invito/:codice` (src/pages/Invito.jsx) sceglie per
 * dispositivo: dal PC prosegue sul sito, dal telefono apre l'app o lo Store.
 * Design: docs/superpowers/specs/2026-11-16-link-invito-design.md.
 *
 * Logica pura: niente `window`, il chiamante passa user agent e indirizzi.
 */
import { normalizzaCodice } from './codiceInvito'

/** L'indirizzo del sito: il link si copia uguale dall'app e dal browser. */
export const SITO = 'https://fleofit.vercel.app'

/** Il pacchetto Android (`applicationId` in android/app/build.gradle). */
export const PACCHETTO_ANDROID = 'it.federicoleo.fleofit'

/**
 * L'ID numerico dell'app su App Store (`apps.apple.com/it/app/fleofit/id6769451686`).
 * Con `null` l'iPhone senza app non vede il bottone dello Store.
 */
export const APP_STORE_ID = '6769451686'

/**
 * ⏳ L'app Android non è ancora sul Play Store (CLAUDE.md §A): finché è
 * `false`, l'Android senza app prosegue sul sito invece di finire su una
 * pagina dello Store che non esiste.
 */
export const PLAY_STORE_PUBBLICATO = false

/** Il link da copiare per un codice. */
export const linkInvito = (codice) => `${SITO}/invito/${normalizzaCodice(codice)}`

/** La pagina del sito che riceve il codice (la stessa di sempre). */
export const loginConCodice = (codice) => `/login?invite=${normalizzaCodice(codice)}`

/**
 * 'ios' | 'android' | 'desktop'.
 * ⚠️ L'iPad da iPadOS 13 si presenta come un Mac: lo tradiscono solo i punti
 * di tocco, che un Mac vero non ha.
 */
export function dispositivo(userAgent = '', puntiDiTocco = 0) {
  const ua = String(userAgent)
  if (/android/i.test(ua)) return 'android'
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios'
  if (/macintosh/i.test(ua) && puntiDiTocco > 1) return 'ios'
  return 'desktop'
}

/** App Store, o `null` finché l'ID non c'è. */
export const urlAppStore = () => (APP_STORE_ID ? `https://apps.apple.com/app/id${APP_STORE_ID}` : null)

/**
 * Play Store con il codice nel `referrer`: il Play Store lo consegna all'app al
 * primo avvio (Install Referrer), ed è così che il codice sopravvive
 * all'installazione. `null` finché l'app non è pubblicata.
 */
export function urlPlayStore(codice) {
  if (!PLAY_STORE_PUBBLICATO) return null
  const referrer = encodeURIComponent(`invite=${normalizzaCodice(codice)}`)
  return `https://play.google.com/store/apps/details?id=${PACCHETTO_ANDROID}&referrer=${referrer}`
}

/** Il deep link dell'app (schema già dichiarato su iOS e Android). */
export const linkApp = (codice) => `fleofit://invito/${normalizzaCodice(codice)}`

/**
 * L'intent di Chrome per Android: app installata = si apre con
 * `fleofit://invito/<codice>`; se no Chrome va da solo a `fallback`. Niente
 * finestra d'errore, a differenza di un `fleofit://` nudo.
 */
export function intentAndroid(codice, fallback) {
  const pulito = normalizzaCodice(codice)
  return `intent://invito/${pulito}#Intent;scheme=fleofit;package=${PACCHETTO_ANDROID};` +
    `S.browser_fallback_url=${encodeURIComponent(fallback)};end`
}

/**
 * Il codice da un indirizzo con cui l'app è stata aperta:
 * `fleofit://invito/<codice>` o l'universal link `https://…/invito/<codice>`.
 * `null` per tutto il resto (OAuth, TV, Garmin…: li gestisce chi li gestiva).
 */
export function codiceDaLinkApp(indirizzo) {
  let url
  try { url = new URL(indirizzo) } catch { return null }
  let percorso
  if (url.protocol === 'fleofit:') percorso = `/${url.host}${url.pathname}`
  else if (url.protocol === 'https:' && url.host === new URL(SITO).host) percorso = url.pathname
  else return null
  const m = percorso.match(/^\/invito\/([^/?#]+)\/?$/i)
  if (!m) return null
  const codice = normalizzaCodice(decodeURIComponent(m[1]))
  return codice || null
}

/** Il codice dal referrer del Play Store (`invite=<codice>`), o `null`. */
export function codiceDaReferrer(referrer) {
  if (typeof referrer !== 'string' || !referrer) return null
  const valore = new URLSearchParams(referrer).get('invite')
  const codice = normalizzaCodice(valore || '')
  return codice || null
}
