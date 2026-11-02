import { codiceDaQR } from './codiceTV'

// Il link che apre l'app dal tocco sulla Live Activity del timer
// (ios/App/FleoTimer/TimerLiveActivity.swift, `widgetURL`).
//
// 🔴 Deve avere un suo indirizzo. Fino al 29/10/2026 era `fleofit://` e basta:
// DeeplinkHandler lo prendeva per il ritorno da un login, non trovava i token e
// mandava a /login, che ricaricava tutto e chiudeva il timer in corso. Con
// questo link l'app non fa niente: resta sulla pagina dove l'atleta l'aveva
// lasciata, timer compreso.
//
// File a parte, e non dentro liveActivity.js, perché lo importa App.jsx: tutto
// ciò che sta qui finisce nel chunk d'ingresso.
export const LINK_TIMER = 'fleofit://timer'

export function eLinkDelTimer(indirizzo) {
  try {
    const url = new URL(indirizzo)
    return url.protocol === 'fleofit:' && (url.host === 'timer' || url.pathname.replace(/^\/+/, '') === 'timer')
  } catch {
    return false
  }
}

// Il QR della TV (`fleofit://tv/<codice>`, src/lib/codiceTV.js) letto con la
// fotocamera di SISTEMA invece che dal foglio «Collega TV»: il telefono apre
// l'app con quell'indirizzo. 🔴 Stessa trappola del timer: senza token,
// DeeplinkHandler lo prendeva per un login fallito e mandava a /login con un
// errore falso, chiudendo il timer in corso. Qui l'app torna davanti e basta;
// il codice si collega dal foglio «Collega TV» della scheda.
//
// Sta qui, e non in codiceTV.js, perché questo file è già nel chunk d'ingresso
// (lo importa App.jsx): codiceTV.js resta nei chunk di WorkoutDetail e TV.
export function eLinkDellaTV(indirizzo) {
  try {
    const url = new URL(indirizzo)
    return url.protocol === 'fleofit:' && url.host === 'tv'
  } catch {
    return false
  }
}

// Dove porta il link della TV. Dal resto dell'app: la pagina
// `/collega-tv/<codice>`, che fa scegliere il workout. 🔴 Da una scheda workout
// invece si RESTA sulla scheda (stesso percorso, stessa query, `athlete_id`
// compreso) con in più `tv=<codice>&chiedi=1`: la scheda chiede «Vuoi mandare in
// TV questo?» sopra di sé. Andare altrove la smontava, e un timer in corso
// ripartiva da zero (ruling 7 della spec 2026-11-02-tv-qr-scelta-workout).
// Chi naviga lo fa con `replace` quando il percorso è lo stesso (DeeplinkHandler).
// Senza codice valido: `null`, e l'app torna davanti e basta.
export function rottaDaLinkTV(indirizzo, { pathname, search }) {
  const codice = codiceDaQR(indirizzo)
  if (!codice) return null
  if (!/^\/workout\/[^/]+\/?$/.test(pathname || '')) return `/collega-tv/${codice}`
  const parametri = new URLSearchParams(search || '')
  parametri.delete('tv')
  parametri.delete('chiedi')
  parametri.set('tv', codice)
  parametri.set('chiedi', '1')
  return `${pathname}?${parametri}`
}
