// ─── LE PARTI DI UNA RIPETUTA DI CORSA ────────────────────────────────────
// Fino al 26/10/2026 una ripetuta era sempre DUE tratti, corsa e recupero
// (`runDuration`/`runPace`/… e `recDuration`/`recPace`/…). Il committente
// voleva scrivere «3 × (4′ Z3 + 3′ Z2)», dove il secondo tratto non è un
// recupero, o tre tratti di fila: ora le parti stanno in `parti`, quante
// se ne vogliono, ognuna con il suo tipo (corsa o recupero).
//
// 🔴 Chi salva scrive ANCHE i vecchi campi (`campiVecchiRipetuta`), dalle
// prime due parti: le app già sugli Store leggono solo quelli, e il database
// è uno solo. Chi legge passa SEMPRE da `partiRipetuta`, che capisce tutti e
// due i formati: leggere `runDuration` a mano perderebbe la terza parte.

export const MAX_PARTI = 6

const testo = (v) => (v === null || v === undefined ? '' : String(v))

/** Una parte nella forma salvata, con i campi che mancano vuoti. */
const parte = (p = {}) => ({
  id: p.id ?? Math.random(),
  tipo: p.tipo === 'recover' ? 'recover' : 'run',
  duration: testo(p.duration),
  pace: testo(p.pace),
  paceMin: testo(p.paceMin),
  paceMax: testo(p.paceMax),
  intensity: testo(p.intensity),
})

/**
 * Le parti di una ripetuta, in ordine, in qualunque formato sia salvata.
 *
 * ⚠️ Nel formato vecchio un recupero senza durata non è una parte: era il
 * caso «6×400m» letto da un testo senza recupero scritto (leggiWorkout lascia
 * `recDuration` vuoto apposta). Mostrarlo direbbe «Recupero: » sul niente.
 */
export const partiRipetuta = (step) => {
  if (Array.isArray(step?.parti) && step.parti.length > 0) {
    return step.parti.filter(p => p && typeof p === 'object').map(parte)
  }
  const parti = [parte({
    id: 'corsa', tipo: 'run', duration: step?.runDuration, pace: step?.runPace,
    paceMin: step?.runPaceMin, paceMax: step?.runPaceMax, intensity: step?.runIntensity,
  })]
  if (testo(step?.recDuration).trim()) {
    parti.push(parte({
      id: 'recupero', tipo: 'recover', duration: step?.recDuration, pace: step?.recPace,
      paceMin: step?.recPaceMin, paceMax: step?.recPaceMax, intensity: step?.recIntensity,
    }))
  }
  return parti
}

/**
 * I campi di prima, ricavati dalle parti per posizione: la prima è il «tratto
 * veloce», la seconda il «recupero». Una terza parte un'app vecchia non la
 * vede: è il prezzo di non toccare il formato che già legge.
 */
export const campiVecchiRipetuta = (parti = []) => {
  const [a = parte(), b] = parti
  return {
    runDuration: a.duration, runPace: a.pace, runPaceMin: a.paceMin, runPaceMax: a.paceMax, runIntensity: a.intensity,
    recDuration: b ? b.duration : '', recPace: b ? b.pace : '', recPaceMin: b ? b.paceMin : '',
    recPaceMax: b ? b.paceMax : '', recIntensity: b ? b.intensity : '',
  }
}

/** «Corsa» o «Recupero»: il nome di una parte a schermo. */
export const etichettaParte = (p) => (p?.tipo === 'recover' ? 'Recupero' : 'Corsa')

/** L'intensità di una ripetuta: quella della parte più dura, o null se nessuna la dice. */
export const intensitaRipetuta = (step) => {
  const valori = partiRipetuta(step).map(p => parseFloat(p.intensity)).filter(Number.isFinite)
  return valori.length ? Math.max(...valori) : null
}
