// Alert applicativo, richiamabile da qualunque componente senza passare props.
//
// CLAUDE.md §8 vieta alert()/confirm() nativi: su iOS aprono un dialogo di
// sistema che mostra l'origine del WebView ("capacitor://localhost"), e per
// l'utente sembra un errore dell'app. Ma quasi tutte le chiamate residue erano
// dentro sotto-componenti (VoiceRecorder, RpeModal, NewAthleteModal,
// AiGenerationModal, Onboarding) che non hanno setAlertInfo in scope: filtrarlo
// come prop avrebbe toccato decine di punti. Qui c'è un solo host, montato in
// App.jsx, e chiunque può chiamarlo.
let ascoltatore = null

export function registraAlertHost(fn) {
  ascoltatore = fn
  return () => { if (ascoltatore === fn) ascoltatore = null }
}

export function mostraAlert(info) {
  if (ascoltatore) ascoltatore(info)
  else console.warn('AlertHost non montato:', info)
}

/** Scorciatoia per gli errori: mostraErrore('testo') oppure mostraErrore(err.message). */
export function mostraErrore(message, title = 'Errore') {
  mostraAlert({ title, message: String(message ?? 'Si è verificato un errore.'), type: 'error' })
}

/** Scorciatoia per le conferme positive. */
export function mostraSuccesso(message, title = 'Fatto') {
  mostraAlert({ title, message: String(message ?? ''), type: 'success' })
}
