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
 * I parametri di un blocco in una riga, o stringa vuota se non ne ha.
 *
 * WarmUp e Rest tornano '' di proposito: la loro unica informazione è la
 * durata, che nella scheda sta già a destra del nome. Ripeterla qui darebbe
 * due volte lo stesso numero sulla stessa riga.
 */
export const sottotitoloBlocco = (block) => {
  if (!block) return ''
  const p = block.params || {}
  const n = (block.exercises || []).length
  const conEsercizi = (...pezzi) => [esercizi(n), ...pezzi.filter(Boolean)].join(' · ')

  switch (block.type) {
    case 'WarmUp':
    case 'Rest':
      return ''
    case 'EMOM':
      return conEsercizi(`ogni ${p.interval || '1:00'} × ${intero(p.rounds, 10)}`)
    case 'ON/OFF':
      return conEsercizi(`${p.on || '1:00'} on / ${p.off || '1:00'} off × ${intero(p.rounds, 10)}`)
    case 'AMRAP':
      return conEsercizi(`in ${p.duration || '10:00'}`)
    case 'For Time':
      return conEsercizi(round(intero(p.rounds, 3)))
    case 'Interval':
      return conEsercizi(round(intero(p.rounds, 1)))
    case 'Cash In':
    case 'Cash Out': {
      const r = intero(p.rounds, 1)
      // Il rest esiste solo FRA i round: su un round solo non si nomina, che è
      // anche la regola con cui `durataBlocco` lo conta (round − 1 volte).
      const rest = r > 1 && pieno(p.rest) ? `${p.rest} rest` : ''
      return conEsercizi(r > 1 ? round(r) : '', rest)
    }
    default:
      return n > 0 ? esercizi(n) : ''
  }
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
