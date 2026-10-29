// Dove si trova il timer guidato dopo `secondi` secondi, partendo dal passo
// `idx` con `timeLeft` secondi sul quadrante.
//
// Serve in due posti, che devono arrivare allo stesso punto:
// - il telefono, al risveglio dopo il blocco schermo (iOS sospende la webview e
//   il timer JS si ferma): prima saltava solo al passo successivo, ripartendo
//   dalla sua durata piena, e perdeva tutto il resto del tempo passato;
// - la TV, che mentre il telefono tace va avanti da sola sulla stessa sequenza.
//
// Un passo a tempo mostra duration … 0, e lo zero resta a schermo un secondo
// prima di passare oltre: è il ritmo del tick del telefono, e va rispettato o
// telefono e TV al risveglio non coincidono. Un cronometro non finisce mai da
// solo (sale), «Completato» ferma tutto.
export function avanzaSequenza(sequence, idx, timeLeft, secondi) {
  let i = idx
  let t = timeLeft
  let resto = Math.max(0, Math.floor(secondi || 0))

  for (;;) {
    const passo = sequence[i]
    if (!passo) return { idx: i, timeLeft: 0, finito: true }
    if (passo.type === 'done') return { idx: i, timeLeft: t, finito: true }
    if (passo.type === 'stopwatch') return { idx: i, timeLeft: t + resto, finito: false }
    if (resto <= t) return { idx: i, timeLeft: t - resto, finito: false }

    resto -= t + 1
    if (i >= sequence.length - 1) return { idx: i, timeLeft: 0, finito: true }
    i += 1
    t = sequence[i].duration || 0
  }
}

// Cosa mostra la TV ADESSO, dall'ultimo stato ricevuto dal telefono.
//
// Fino al 29/10/2026 la TV mostrava solo i numeri che arrivavano: col telefono
// bloccato non arrivava più niente e il timer sulla TV si fermava. Ora conta da
// sola a partire da `ricevuto` (l'ora della TV in cui il messaggio è arrivato:
// gli orologi dei due dispositivi non vanno confrontati fra loro), e quando il
// telefono torna a parlare si riallinea al suo stato.
//
// Per scavalcare un passo la TV deve avere la stessa sequenza del telefono
// (la costruisce con `buildTimerSequence` dallo stesso workout); se il passo
// all'indice ricevuto non è quello del telefono — workout modificato, app
// vecchia — scende fino a zero sul passo corrente e lì aspetta.
export function statoTV(ricevuto, sequence, adesso) {
  if (!ricevuto) return null
  const { currentIdx, timeLeft, isRunning, step } = ricevuto
  if (!isRunning) return ricevuto

  const secondi = Math.floor((adesso - (ricevuto.ricevuto ?? adesso)) / 1000)
  if (secondi <= 0) return ricevuto

  const coincide = step && sequence?.[currentIdx]?.id === step.id
  if (coincide) {
    const dopo = avanzaSequenza(sequence, currentIdx, timeLeft, secondi)
    return {
      ...ricevuto,
      currentIdx: dopo.idx,
      timeLeft: dopo.timeLeft,
      isRunning: !dopo.finito,
      step: dopo.idx === currentIdx ? step : sequence[dopo.idx],
    }
  }

  const sale = step?.type === 'stopwatch' || step?.type === 'done'
  return { ...ricevuto, timeLeft: sale ? timeLeft + secondi : Math.max(0, timeLeft - secondi) }
}

// Quale beep suona la TV passando da `prima` a `adesso`: 'corto' sugli ultimi
// tre secondi, 'lungo' sullo zero, 'finale' sullo zero dell'ultimo passo.
// Solo quando il tempo scende di UN secondo nello stesso passo, come sul
// telefono: una correzione del telefono che fa saltare il numero non suona.
export function beepTV(prima, adesso) {
  if (!prima || !adesso || !adesso.isRunning) return null
  if (prima.currentIdx !== adesso.currentIdx) return null
  const tipo = adesso.step?.type
  if (tipo === 'stopwatch' || tipo === 'done') return null
  if (prima.timeLeft - adesso.timeLeft !== 1) return null
  if (adesso.timeLeft === 0) return adesso.step?.nextTask === 'Workout terminato 🎉' ? 'finale' : 'lungo'
  if (adesso.timeLeft <= 3) return 'corto'
  return null
}
