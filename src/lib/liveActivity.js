// La Live Activity del timer guidato: il blocco schermo e la Dynamic Island.
//
// Solo iPhone. La parte nativa è il plugin dell'app `LiveActivity`
// (ios/App/App/LiveActivityPlugin.swift) più l'estensione widget
// `FleoTimer` (ios/App/FleoTimer/), col design A «Anello» scelto il 29/10/2026.
// Su Android, sul web e su un'app vecchia senza plugin non fa niente.
//
// ⚠️ Col telefono bloccato la webview è sospesa e il JS non gira. Per questo:
// - lo stato porta DATE ASSOLUTE (fine del passo, fine dell'allenamento) e il
//   conto alla rovescia lo fa iOS da solo;
// - insieme allo stato parte il PROGRAMMA dei passi successivi, ognuno con
//   l'ora in cui comincia (`programmaLiveActivity`): il plugin nativo, che resta
//   sveglio in background, cambia passo e suona i beep da solo
//   (docs/memoria/scheda-workout.md, 9-live-activity).
import { Capacitor, registerPlugin } from '@capacitor/core'
import { leggiJson, scriviJson } from './offlineQueue'

export const CHIAVE_LIVE_ACTIVITY = 'fleofit_live_activity'

const LiveActivity = registerPlugin('LiveActivity')

const RIPOSO = '#4ade80'
const FATTO = '#22c55e'
const PREP = '#ffffff'

/** C'è la parte nativa? Solo su iPhone, e solo da un'app che porta il plugin. */
export const liveActivityPossibile = () =>
  Capacitor.getPlatform() === 'ios' && Capacitor.isPluginAvailable('LiveActivity')

/** true / false se l'atleta ha scelto, null se non gliel'abbiamo ancora chiesto. */
export function preferenzaLiveActivity(storage = globalThis.localStorage) {
  const v = leggiJson(CHIAVE_LIVE_ACTIVITY, null, storage)
  return typeof v === 'boolean' ? v : null
}

export function salvaPreferenzaLiveActivity(attiva, storage = globalThis.localStorage) {
  scriviJson(CHIAVE_LIVE_ACTIVITY, !!attiva, storage)
}

/** La domanda si fa una volta sola: poi decide lo switch nelle Impostazioni. */
export const liveActivityDaChiedere = () => liveActivityPossibile() && preferenzaLiveActivity() === null
export const liveActivityAttiva = () => liveActivityPossibile() && preferenzaLiveActivity() === true

const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`

function faseDi(tipo) {
  if (tipo === 'rest' || tipo === 'done' || tipo === 'prep' || tipo === 'stopwatch') return tipo
  return 'work'
}

function etichettaDi(passo) {
  if (passo.type === 'rest') return passo.title?.match(/\(([^)]+)\)/)?.[1] || 'RIPOSO'
  if (passo.type === 'prep') return 'PRONTI'
  if (passo.type === 'done') return 'FATTO'
  return (passo.title?.match(/\(([^)]+)\)/)?.[1] || passo.title || '').toUpperCase()
}

/**
 * Lo stato del timer, tradotto per la Live Activity. Le date sono in
 * millisecondi (il plugin le trasforma in `Date`); `null` dove non esistono.
 */
export function statoLiveActivity({ sequence, idx, timeLeft, isRunning, colore, adesso = Date.now() }) {
  const passo = sequence[idx]
  const dopo = sequence[idx + 1]
  const fase = faseDi(passo.type)
  const cronometro = fase === 'stopwatch'
  const inCorso = isRunning && fase !== 'done'

  const [, primo, giri] = passo.subtitle?.match(/Round (\d+)(?:–\d+)?\/(\d+)/) || []

  const totale = sequence.reduce((a, p) => a + (p.duration || 0), 0)
  const fattoPrima = sequence.slice(0, idx).reduce((a, p) => a + (p.duration || 0), 0)
  const fattoQui = cronometro ? 0 : (passo.duration || 0) - timeLeft
  const fatti = fase === 'done' ? totale : fattoPrima + fattoQui
  const cronometroAvanti = sequence.slice(idx).some(p => p.type === 'stopwatch')

  return {
    fase,
    etichetta: etichettaDi(passo),
    titolo: passo.title || '',
    compito: passo.task || '',
    poi: !dopo ? '' : dopo.type === 'done' ? 'Poi: fine allenamento'
      : `Poi: ${dopo.task}${dopo.duration ? ` · ${mmss(dopo.duration)}` : ''}`,
    giro: primo ? Number(primo) : 0,
    giri: giri ? Number(giri) : 0,
    colore: fase === 'rest' ? RIPOSO : fase === 'done' ? FATTO : fase === 'prep' ? PREP : colore,
    inizio: inCorso ? adesso - (cronometro ? timeLeft : fattoQui) * 1000 : null,
    fine: inCorso && !cronometro ? adesso + timeLeft * 1000 : null,
    restante: timeLeft,
    frazione: cronometro || fase === 'done' ? 1 : passo.duration ? timeLeft / passo.duration : 0,
    inPausa: !isRunning && fase !== 'done',
    cronometro,
    inizioAllenamento: inCorso ? adesso - fatti * 1000 : null,
    fineAllenamento: inCorso && !cronometroAvanti ? adesso + (totale - fatti) * 1000 : null,
    avanzamento: totale ? fatti / totale : 0,
    totale,
  }
}

const PASSI_MASSIMI = 300

/**
 * Lo stato di adesso più quello di ogni passo che verrà, ognuno con `quando`
 * (ms) comincia, se il timer va avanti senza pause. Lo segue il plugin nativo
 * col telefono bloccato.
 *
 * Il ritmo è quello di `avanzaSequenza`: un passo a tempo mostra duration … 0
 * e lo zero resta un secondo, quindi il passo dopo comincia a fine + 1 s. Se
 * qui si sbaglia di un secondo, al risveglio l'app e il blocco schermo non
 * coincidono più.
 *
 * In pausa, a cronometro (sale e non finisce da solo) e a «Completato» il
 * programma si ferma: dopo non c'è niente da prevedere.
 */
export function programmaLiveActivity({ sequence, idx, timeLeft, isRunning, colore, adesso = Date.now() }) {
  const programma = [{ quando: adesso, stato: statoLiveActivity({ sequence, idx, timeLeft, isRunning, colore, adesso }) }]
  if (!isRunning) return programma

  let quando = adesso
  let restano = timeLeft
  for (let i = idx; i < sequence.length - 1 && programma.length < PASSI_MASSIMI; i++) {
    const tipo = sequence[i].type
    if (tipo === 'stopwatch' || tipo === 'done') break
    quando += (restano + 1) * 1000
    const prossimo = sequence[i + 1]
    restano = prossimo.duration || 0
    programma.push({
      quando,
      stato: statoLiveActivity({ sequence, idx: i + 1, timeLeft: restano, isRunning: true, colore, adesso: quando }),
    })
  }
  return programma
}

// I tre comandi. Non lanciano mai: una Live Activity che non parte non deve
// fermare il timer.
// `programma` è quello di `programmaLiveActivity`: il primo elemento è lo
// stato di adesso, gli altri i passi che verranno. `beep: false` quando
// l'atleta ha tolto l'audio al timer: il plugin col telefono bloccato tace.
export const avviaLiveActivity = (attributi, programma, { beep = true } = {}) =>
  LiveActivity.avvia({ ...attributi, stato: programma[0].stato, programma, beep }).catch(() => {})
export const aggiornaLiveActivity = (programma, { beep = true } = {}) =>
  LiveActivity.aggiorna({ stato: programma[0].stato, programma, beep }).catch(() => {})
export const chiudiLiveActivity = (stato) =>
  LiveActivity.termina({ stato }).catch(() => {})

/** Le Live Activity spente da iOS (Impostazioni → FLEOFIT): false, o null se non si sa. */
export const liveActivityConsentite = () =>
  LiveActivity.disponibile().then(r => !!r?.valore).catch(() => null)
