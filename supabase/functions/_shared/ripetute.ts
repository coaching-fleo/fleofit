// Le parti di una ripetuta di corsa, lato server.
//
// 🔴 È una COPIA di `partiRipetuta` di `src/lib/ripetute.js`: le Edge Function non
// importano da `src/` (il deploy non lo garantisce). Il test di parità
// (`src/lib/__tests__/ripetuteServer.test.js`) la tiene allineata: se si cambia
// una delle due letture, va cambiata anche l'altra, e il test deve restare verde.
// Qui sta solo ciò che serve a leggere le parti, niente altro di quel file.

export type Parte = {
  id: number | string
  tipo: 'run' | 'recover'
  duration: string
  pace: string
  paceMin: string
  paceMax: string
  intensity: string
}

const testo = (v: unknown): string => (v === null || v === undefined ? '' : String(v))

/** Una parte nella forma salvata, con i campi che mancano vuoti. */
const parte = (p: Record<string, unknown> = {}): Parte => ({
  id: (p.id as number | string | undefined) ?? Math.random(),
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
export function partiRipetuta(step: unknown): Parte[] {
  const s = (step && typeof step === 'object' ? step : {}) as Record<string, unknown>
  if (Array.isArray(s.parti) && s.parti.length > 0) {
    return s.parti
      .filter((p): p is Record<string, unknown> => !!p && typeof p === 'object')
      .map(parte)
  }
  const parti: Parte[] = [parte({
    id: 'corsa', tipo: 'run', duration: s.runDuration, pace: s.runPace,
    paceMin: s.runPaceMin, paceMax: s.runPaceMax, intensity: s.runIntensity,
  })]
  if (testo(s.recDuration).trim()) {
    parti.push(parte({
      id: 'recupero', tipo: 'recover', duration: s.recDuration, pace: s.recPace,
      paceMin: s.recPaceMin, paceMax: s.recPaceMax, intensity: s.recIntensity,
    }))
  }
  return parti
}
