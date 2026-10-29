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
