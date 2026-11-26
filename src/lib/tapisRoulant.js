// ─── CORSA SUL TAPIS ROULANT ───────────────────────────────────────────────
// Il coach scrive la corsa in min/km come sempre; nella scheda l'atleta passa
// a «Tapis roulant» e vede i km/h da impostare sulla macchina (26/11/2026,
// docs/superpowers/specs/2026-11-26-tapis-roulant-design.md).
//
// Si converte SOLO un ritmo numerico: zone, «Libero», «Gara», «All out»…
// restano scritti come sono — una velocità inventata sarebbe peggio di niente.
// Il formato salvato non cambia: si lavora su una copia degli steps.

import { partiRipetuta } from './ripetute'

// «5:00 /km», «5:00 - 5:30 /km», anche con la lineetta lunga o senza spazi.
const RITMO = /^\s*(\d{1,2}):([0-5]\d)\s*(?:[-–]\s*(\d{1,2}):([0-5]\d)\s*)?\/km\s*$/

const kmh = (secondi) => `${(3600 / secondi).toFixed(1).replace('.', ',')}`

/** «12,0 km/h», «10,9 – 12,0 km/h» (dal più lento al più veloce), o null. */
export function velocitaDaPasso(passo) {
  if (typeof passo !== 'string') return null
  const m = passo.match(RITMO)
  if (!m) return null
  const secondi = [[m[1], m[2]], [m[3], m[4]]]
    .filter(([min]) => min !== undefined)
    .map(([min, sec]) => Number(min) * 60 + Number(sec))
  if (secondi.some(s => s <= 0)) return null
  // Più secondi al km = più lento = meno km/h: il ritmo più lento va per primo.
  const velocita = secondi.sort((a, b) => b - a).map(kmh)
  const [lenta, veloce] = velocita
  return `${!veloce || veloce === lenta ? lenta : `${lenta} – ${veloce}`} km/h`
}

const passoTapis = (passo) => velocitaDaPasso(passo) ?? passo

/** Una copia degli steps con i ritmi in km/h dove si può; le ripetute con `parti`. */
export function stepsTapis(steps) {
  return (steps || []).map(step => {
    if (step?.type === 'repeat') {
      return { ...step, parti: partiRipetuta(step).map(p => ({ ...p, pace: passoTapis(p.pace) })) }
    }
    return step?.pace ? { ...step, pace: passoTapis(step.pace) } : { ...step }
  })
}

/** C'è almeno un ritmo che diventa una velocità? Senza, l'interruttore non serve. */
export function haRitmiConvertibili(steps) {
  return (steps || []).some(step => (step?.type === 'repeat'
    ? partiRipetuta(step).some(p => velocitaDaPasso(p.pace))
    : !!velocitaDaPasso(step?.pace)))
}
