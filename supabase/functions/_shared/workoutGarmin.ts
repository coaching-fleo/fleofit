// La Corsa di FLEOFIT tradotta nel formato Garmin Training API (v1, POST /workout).
//
// Pura: niente rete, niente import Deno (solo `./ripetute.ts`), così si prova con
// Vitest da `src/lib/__tests__/workoutGarmin.test.js`.
// ⚠️ DA VERIFICARE alla prima prova vera: unità m/s per `PACE`, la zona come
// `targetValue` per `HEART_RATE`, il limite di 100 caratteri.

import { partiRipetuta } from './ripetute.ts'

export type Intensita = 'WARMUP' | 'ACTIVE' | 'RECOVERY' | 'COOLDOWN' | 'INTERVAL'

export type Durata = {
  durationType: 'TIME' | 'DISTANCE' | 'OPEN'
  durationValue?: number
  durationValueType?: 'METER'
}

export type Obiettivo = {
  targetType: 'PACE' | 'HEART_RATE' | 'OPEN'
  targetValue?: number
  targetValueLow?: number
  targetValueHigh?: number
  testo: string
}

export type GarminWorkoutStep = {
  type: 'WorkoutStep'
  stepOrder: number
  intensity: Intensita
  description?: string
} & Durata & Omit<Obiettivo, 'testo'>

export type GarminRepeatStep = {
  type: 'WorkoutRepeatStep'
  stepOrder: number
  repeatType: 'REPEAT_UNTIL_STEPS_CMPLT'
  repeatValue: number
  skipLastRestStep: boolean
  steps: GarminWorkoutStep[]
}

export type GarminStep = GarminWorkoutStep | GarminRepeatStep

export type GarminWorkout = {
  workoutName: string
  sport: 'RUNNING'
  workoutProvider: 'FLEOFIT'
  workoutSourceId: 'FLEOFIT'
  steps: GarminStep[]
}

const MAX_TESTO = 100
const testo = (v: unknown): string => (v === null || v === undefined ? '' : String(v).trim())
const arrotonda = (n: number): number => Math.round(n * 1000) / 1000

/** La durata di un passo («10 min», «400m», «1,5 km», «12:30»). Quel che non si capisce è aperto. */
export function durataGarmin(t: string): Durata {
  const s = testo(t).toLowerCase()
  let m = s.match(/^(\d+(?:[.,]\d+)?)\s*km$/)
  if (m) return { durationType: 'DISTANCE', durationValue: Math.round(parseFloat(m[1].replace(',', '.')) * 1000), durationValueType: 'METER' }
  m = s.match(/^(\d+(?:[.,]\d+)?)\s*(?:m|metri)$/)
  if (m) return { durationType: 'DISTANCE', durationValue: Math.round(parseFloat(m[1].replace(',', '.'))), durationValueType: 'METER' }
  m = s.match(/^(\d+(?:[.,]\d+)?)\s*(?:min|m')$/)
  if (m) return { durationType: 'TIME', durationValue: Math.round(parseFloat(m[1].replace(',', '.')) * 60) }
  m = s.match(/^(\d+)\s*(?:sec|s)$/)
  if (m) return { durationType: 'TIME', durationValue: parseInt(m[1], 10) }
  m = s.match(/^(\d+):(\d{2})$/)
  if (m) return { durationType: 'TIME', durationValue: parseInt(m[1], 10) * 60 + parseInt(m[2], 10) }
  return { durationType: 'OPEN' }
}

/** «5:30 /km» → 330 secondi al km, o null se non è un ritmo. */
function secondiAlKm(t: string): number | null {
  const m = testo(t).match(/^(\d+):(\d{2})/)
  if (!m) return null
  const sec = parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
  return sec > 0 ? sec : null
}

const mmss = (sec: number): string => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
const velocita = (secAlKm: number): number => arrotonda(1000 / secAlKm)

/** L'obiettivo di un passo: ritmo (m/s), zona cardiaca o niente. */
export function obiettivoGarmin(paceMin: string, paceMax: string): Obiettivo {
  const a = testo(paceMin)
  const b = testo(paceMax)
  const primo = a && a !== '-' ? a : ''
  const zona = primo.match(/^Z([1-5])$/i)
  if (zona) return { targetType: 'HEART_RATE', targetValue: parseInt(zona[1], 10), testo: `Z${zona[1]}` }
  const s1 = secondiAlKm(primo)
  if (s1 === null) return { targetType: 'OPEN', testo: primo }
  const s2 = b && b !== '-' ? secondiAlKm(b) : null
  if (s2 === null) {
    return {
      targetType: 'PACE',
      targetValueLow: velocita(s1 + 5),
      targetValueHigh: velocita(Math.max(1, s1 - 5)),
      testo: `${mmss(s1)} /km`,
    }
  }
  const lento = Math.max(s1, s2)
  const veloce = Math.min(s1, s2)
  return {
    targetType: 'PACE',
    targetValueLow: velocita(lento),
    targetValueHigh: velocita(veloce),
    testo: `${mmss(s1)}–${mmss(s2)} /km`,
  }
}

type Sorgente = { duration?: unknown; pace?: unknown; paceMin?: unknown; paceMax?: unknown; notes?: unknown }

function passoSemplice(s: Sorgente, intensity: Intensita, stepOrder: number): GarminWorkoutStep {
  const { testo: etichetta, ...obiettivo } = obiettivoGarmin(testo(s.paceMin) || testo(s.pace), testo(s.paceMax))
  const note = testo(s.notes)
  const description = [etichetta, note].filter(Boolean).join(' · ').slice(0, MAX_TESTO)
  return {
    type: 'WorkoutStep',
    stepOrder,
    intensity,
    ...(description ? { description } : {}),
    ...durataGarmin(testo(s.duration)),
    ...obiettivo,
  }
}

const INTENSITA_PASSO: Record<string, Intensita> = {
  warmup: 'WARMUP', run: 'ACTIVE', recover: 'RECOVERY', cooldown: 'COOLDOWN',
}

/** La Corsa di un workout nel formato Garmin; `null` se non è Corsa o non ha passi traducibili. */
export function corsaVersoGarmin(w: { title: string; sections: unknown }): GarminWorkout | null {
  const sezioni = (w && w.sections && typeof w.sections === 'object' ? w.sections : {}) as Record<string, unknown>
  if (sezioni.category && sezioni.category !== 'Running') return null
  if (!Array.isArray(sezioni.steps)) return null

  let ordine = 0
  const steps: GarminStep[] = []
  for (const raw of sezioni.steps) {
    if (!raw || typeof raw !== 'object') continue
    const s = raw as Record<string, unknown>
    if (s.type === 'repeat') {
      const passoRipetuta = ++ordine
      const figli = partiRipetuta(s).map((p) =>
        passoSemplice(p, p.tipo === 'recover' ? 'RECOVERY' : 'INTERVAL', ++ordine))
      const giri = parseInt(testo(s.rounds), 10)
      steps.push({
        type: 'WorkoutRepeatStep',
        stepOrder: passoRipetuta,
        repeatType: 'REPEAT_UNTIL_STEPS_CMPLT',
        repeatValue: giri >= 1 ? giri : 1,
        skipLastRestStep: false,
        steps: figli,
      })
    } else if (typeof s.type === 'string' && INTENSITA_PASSO[s.type]) {
      steps.push(passoSemplice(s, INTENSITA_PASSO[s.type], ++ordine))
    }
  }
  if (steps.length === 0) return null
  return {
    workoutName: testo(w.title).slice(0, MAX_TESTO),
    sport: 'RUNNING',
    workoutProvider: 'FLEOFIT',
    workoutSourceId: 'FLEOFIT',
    steps,
  }
}
