// Quattro programmi base INVENTATI per il banco di prova. Non sono i
// programmi del team (quelli arrivano con la fase 1): servono solo a
// provare scelta, adattamento e validatore su sedute realistiche.

import { durataStimataReale } from '../../src/lib/statistiche.js'

const hyroxStazioni = {
  category: 'Hyrox', intensity: '7', blocks: [
    { type: 'WarmUp', params: { duration: '10:00' }, exercises: [{ name: 'Run', meters: '1000m', intensity: '4' }, { name: 'Burpees', reps: '10', intensity: '5' }] },
    { type: 'EMOM', params: { interval: '1:00', rounds: '16' }, exercises: [
      { name: 'SkiErg', meters: '200m', intensity: '7' }, { name: 'Wall Balls', reps: '15', kg: '6', intensity: '7' },
      { name: 'Sled Push', meters: '25m', kg: '102', intensity: '8' }, { name: 'Rowing', meters: '200m', intensity: '7' },
    ] },
    { type: 'For Time', params: { timecap: '20:00' }, exercises: [
      { name: 'Run', meters: '1000m', intensity: '8' }, { name: 'Sandbag Lunges', meters: '50m', kg: '20', intensity: '8' },
      { name: 'Farmers Carry', meters: '200m', kg: '24', intensity: '7' },
    ] },
    { type: 'Rest', params: { duration: '4:00' }, exercises: [] },
  ],
}

const hyroxSimulazione = {
  category: 'Hyrox', intensity: '8', blocks: [
    { type: 'WarmUp', params: { duration: '10:00' }, exercises: [{ name: 'Run', meters: '1000m', intensity: '4' }] },
    { type: 'For Time', params: { timecap: '40:00' }, exercises: [
      { name: 'Run', meters: '1000m', intensity: '8' }, { name: 'Sled Pull', meters: '50m', kg: '78', intensity: '8' },
      { name: 'Run', meters: '1000m', intensity: '8' }, { name: 'Burpees Broad Jumps', meters: '80m', intensity: '8' },
      { name: 'Run', meters: '1000m', intensity: '8' }, { name: 'Wall Balls', reps: '100', kg: '6', intensity: '9' },
    ] },
    { type: 'Rest', params: { duration: '10:00' }, exercises: [] },
  ],
}

const corsaRipetute = {
  category: 'Running', intensity: '7', steps: [
    { type: 'warmup', duration: '15 min', pace: 'Z2' },
    { type: 'repeat', rounds: '6', runDuration: '3 min', runPace: 'Z4', recDuration: '2 min', recPace: 'Z1' },
    { type: 'cooldown', duration: '10 min', pace: 'Z1' },
  ],
}

const corsaFacile = {
  category: 'Running', intensity: '4', steps: [
    { type: 'run', duration: '45 min', pace: 'Z2' },
  ],
}

const testUnKm = {
  category: 'Hyrox', intensity: '9', blocks: [
    { type: 'WarmUp', params: { duration: '15:00' }, exercises: [{ name: 'Run', meters: '2000m', intensity: '4' }] },
    { type: 'For Time', params: { timecap: '12:00' }, exercises: [{ name: 'Run', meters: '1000m', intensity: '10' }, { name: 'SkiErg', meters: '1000m', intensity: '10' }] },
    { type: 'Rest', params: { duration: '8:00' }, exercises: [] },
  ],
}

const seduta = (posto, sections, focus, dura, test = false) =>
  ({ posto, focus, dura, minuti: durataStimataReale(sections), ...(test ? { test: true } : {}), sections })

/** Le sedute di una settimana con n sedute; la 4ª settimana di ogni blocco è il test. */
function settimana(n, sedute, conTest) {
  const giro = [
    seduta(0, hyroxStazioni, 'stazioni', true),
    seduta(1, corsaFacile, 'corsa', false),
    seduta(2, conTest ? testUnKm : hyroxSimulazione, conTest ? 'test' : 'simulazione', true, conTest),
    seduta(3, corsaRipetute, 'corsa', true),
  ]
  return giro.slice(0, sedute).map((s, i) => ({ ...s, posto: i }))
}

const FASI_12 = ['base', 'base', 'costruzione', 'scarico', 'costruzione', 'costruzione', 'specifico', 'scarico', 'specifico', 'specifico', 'specifico', 'gara']
const FASI_8 = ['base', 'base', 'costruzione', 'scarico', 'costruzione', 'costruzione', 'specifico', 'scarico']

function programma(id, famiglia, livello, sedute, fasi) {
  return {
    id, nome: id, famiglia, livello, sedute,
    settimane: fasi.map((fase, i) => {
      const s = settimana(i, sedute, (i + 1) % 4 === 0)
      return { n: i + 1, fase, minuti: s.reduce((t, x) => t + x.minuti, 0), sedute: s }
    }),
  }
}

export const PROGRAMMI = [
  programma('migliorare-12x4', 'migliorare', 'intermedio', 4, FASI_12),
  programma('migliorare-12x3', 'migliorare', 'intermedio', 3, FASI_12),
  programma('senza-gara-8x3', 'senza_gara', 'intermedio', 3, FASI_8),
  programma('prima-gara-12x3', 'prima_gara', 'principiante', 3, FASI_12),
]
