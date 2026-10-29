// I beep del timer suonano SOPRA la musica dell'atleta, non al posto suo.
//
// Su iPhone ogni <audio> della webview apre una sessione audio «da lettore
// multimediale», che ferma Spotify o qualunque altra musica, anche quando esce
// da una cassa Bluetooth (segnalato dal committente il 29/10/2026). L'API Audio
// Session di WebKit (`navigator.audioSession`, iOS 16.4+) permette di chiedere
// il tipo «ambient»: si mescola con gli altri suoni invece di interromperli.
//
// Il prezzo, scelto: in «ambient» iOS rispetta il tasto Silenzioso. Con il
// telefono in silenzioso i beep non si sentono (la vibrazione resta, e la TV
// suona per conto suo).
//
// Su Android e nei browser senza l'API non fa niente: lì basta che i beep siano
// brevi (Chromium per i suoni sotto i 5 secondi chiede solo di abbassare la
// musica un istante), ed è per questo che l'audio muto in loop è stato tolto.
export function suonaSopraLaMusica() {
  try {
    if (typeof navigator !== 'undefined' && navigator.audioSession) {
      navigator.audioSession.type = 'ambient'
    }
  } catch { /* API assente o rifiutata: i beep suonano come prima */ }
}

// Alla chiusura del timer si torna al comportamento di sempre, così le note
// vocali e il resto dell'app non ereditano «ambient».
export function ripristinaSessioneAudio() {
  try {
    if (typeof navigator !== 'undefined' && navigator.audioSession) {
      navigator.audioSession.type = 'auto'
    }
  } catch { /* niente da ripristinare */ }
}
