// La riga sotto il nome del blocco, nella scheda del workout.
//
// Perché esiste: `getBlockTitle` (WorkoutDetail) impacchetta TUTTO in una
// stringa sola — «EMOM · 1:00 min x 24 rounds · 24 min» — che a 393px va a
// capo due volte e mette sullo stesso piano il nome del blocco, i suoi
// parametri e la durata. Il redesign li separa: il nome in testa, la
// didascalia di BLOCK_HINT accanto, la durata a destra (calcolata da
// `stimaWorkout`), e QUI restano i soli parametri.
//
// ⚠️ È una didascalia, non un dato: non torna mai un numero che qualcuno possa
// sommare. Chi vuole la durata usa `durataBlocco` di src/lib/stimaWorkout.js,
// che è l'unico punto che sa stimarla.

/** «1 esercizio» / «3 esercizi». Zero non si scrive: un blocco vuoto lo dice da sé. */
const esercizi = (n) => (n === 1 ? '1 esercizio' : `${n} esercizi`)

/** In italiano «round» non prende la esse, né al singolare né al plurale. */
const round = (n) => `${n} round`

const intero = (v, ripiego) => {
  const n = parseInt(v, 10)
  return Number.isFinite(n) && n > 0 ? n : ripiego
}

/** Un parametro assente o azzerato dal picker: «-» è il modo in cui si cancella. */
const pieno = (v) => v != null && v !== '' && v !== '-'

/**
 * I soli parametri di un blocco: «ogni 1:00 × 24», «3 round · 1:30 rest».
 *
 * Torna **`null`** — e non stringa vuota — su un tipo di blocco che non
 * conosciamo: chi chiama deve poter distinguere «questo blocco non ha
 * parametri da dire» da «non so nemmeno che blocco sia», e le due cose
 * portano a due righe diverse.
 *
 * ⚠️ È qui che vivono i **ripieghi** — 1:00 per l'intervallo, 10:00 per
 * l'AMRAP, 10 / 3 / 1 giri — e devono restare gli stessi che `durataBlocco`
 * usa per stimare, o un blocco appena creato peserebbe una cosa e ne
 * dichiarerebbe un'altra. `sottotitoloBlocco` ci aggiunge il conteggio degli
 * esercizi; la grafica da condividere (src/lib/recapStoria.js) NON lo vuole,
 * perché gli esercizi li elenca subito sotto — ed è la ragione per cui questa
 * funzione è separata invece di essere il corpo di quella.
 */
export const parametriBlocco = (block) => {
  if (!block) return null
  const p = block.params || {}

  switch (block.type) {
    // ⚠️ Per WarmUp e Rest la durata è l'unico parametro, e `sottotitoloBlocco`
    // non arriva mai fin qui: nella scheda quel numero sta già a destra del
    // nome. Sulla grafica invece è tutto ciò che c'è da dire.
    case 'WarmUp':
    case 'Rest':
      return pieno(p.duration) ? p.duration : ''
    case 'EMOM':
      return `ogni ${p.interval || '1:00'} × ${intero(p.rounds, 10)}`
    case 'ON/OFF':
      return `${p.on || '1:00'} on / ${p.off || '1:00'} off × ${intero(p.rounds, 10)}`
    case 'AMRAP':
      return `in ${p.duration || '10:00'}`
    case 'For Time':
      return round(intero(p.rounds, 3))
    case 'Interval':
      return round(intero(p.rounds, 1))
    case 'Cash In':
    case 'Cash Out': {
      const r = intero(p.rounds, 1)
      // Il rest esiste solo FRA i round: su un round solo non si nomina, che è
      // anche la regola con cui `durataBlocco` lo conta (round − 1 volte).
      const rest = r > 1 && pieno(p.rest) ? `${p.rest} rest` : ''
      return [r > 1 ? round(r) : '', rest].filter(Boolean).join(' · ')
    }
    default:
      return null
  }
}

/**
 * I parametri di un blocco preceduti dal conteggio degli esercizi, o stringa
 * vuota se non c'è niente da dire.
 *
 * WarmUp e Rest tornano '' di proposito: la loro unica informazione è la
 * durata, che nella scheda sta già a destra del nome. Ripeterla qui darebbe
 * due volte lo stesso numero sulla stessa riga.
 */
export const sottotitoloBlocco = (block) => {
  if (!block) return ''
  if (block.type === 'WarmUp' || block.type === 'Rest') return ''

  const n = (block.exercises || []).length
  const parametri = parametriBlocco(block)
  // Di un blocco che non conosciamo resta il solo conteggio — e su zero non si
  // scrive niente, perché un blocco vuoto e sconosciuto non ha una riga.
  if (parametri === null) return n > 0 ? esercizi(n) : ''
  return [esercizi(n), parametri].filter(Boolean).join(' · ')
}

/**
 * Le specifiche di un esercizio, in monospazio sotto il nome: «500 m · @1:48»,
 * «20 reps · 9 kg».
 *
 * Riproduce quello che `ExList` mostrava sparso su una riga sola, con lo stesso
 * ordine di priorità: il tempo vince sulla distanza, la distanza sulle
 * ripetizioni. `isErgo` arriva da fuori perché la tassonomia degli ergometri
 * vive in src/lib/constants.js e non va ricopiata.
 */
export const specificheEsercizio = (ex, isErgo = () => false) => {
  if (!ex) return ''
  const misura = pieno(ex.exTime)
    ? ex.exTime
    : pieno(ex.meters)
      ? ex.meters
      : (pieno(ex.reps) ? `${ex.reps} reps` : '')

  const passo = isErgo(ex.name) && pieno(ex.ergoPace) && ex.ergoPace !== 'Libero' ? `@${ex.ergoPace}` : ''
  const velocita = pieno(ex.speed) ? ex.speed : ''
  const carico = pieno(ex.kg) ? `${ex.kg} kg` : ''

  return [misura, passo, velocita, carico].filter(Boolean).join(' · ')
}
