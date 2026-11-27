// Fixture inventate per i test del piano IA: mai workout veri dell'archivio.

/** Una seduta Hyrox di circa 60 minuti (10 + 20 + 25 + 5). */
export const sedutaHyrox = {
  sections: {
    category: 'Hyrox',
    intensity: '7',
    blocks: [
      { type: 'WarmUp', params: { duration: '10:00' }, exercises: [{ name: 'Run', meters: '1000m', intensity: '4' }] },
      {
        type: 'AMRAP', params: { duration: '20:00' }, exercises: [
          { name: 'Wall Balls', reps: '20', kg: '6', intensity: '7' },
          { name: 'SkiErg', meters: '500m', intensity: '7' },
        ],
      },
      {
        type: 'For Time', params: { timecap: '25:00' }, exercises: [
          { name: 'Sled Push', meters: '50m', kg: '100', intensity: '8' },
          { name: 'Run', meters: '1000m', intensity: '8' },
        ],
      },
      { type: 'Rest', params: { duration: '5:00' }, exercises: [] },
    ],
  },
}

const FASI_12 = ['base', 'base', 'costruzione', 'scarico', 'costruzione', 'costruzione', 'specifico', 'scarico', 'specifico', 'specifico', 'specifico', 'gara']
const MINUTI_12 = [200, 210, 230, 160, 240, 250, 260, 180, 270, 280, 280, 150]
const FASI_8 = ['base', 'base', 'costruzione', 'scarico', 'costruzione', 'costruzione', 'specifico', 'scarico']
const MINUTI_8 = [150, 160, 170, 120, 180, 190, 200, 140]

function programma({ id, famiglia, livello, sedute, fasi, minuti }) {
  return {
    id, nome: id, famiglia, livello, sedute,
    settimane: fasi.map((fase, i) => ({
      n: i + 1, fase, minuti: minuti[i],
      sedute: Array.from({ length: sedute }, (_, posto) => ({
        posto, focus: posto === 0 ? 'stazioni' : 'corsa', dura: posto % 2 === 0, minuti: 60, sections: sedutaHyrox.sections,
      })),
    })),
  }
}

export const p12x4 = programma({ id: 'migliorare-12x4', famiglia: 'migliorare', livello: 'intermedio', sedute: 4, fasi: FASI_12, minuti: MINUTI_12 })
export const p12x3 = programma({ id: 'migliorare-12x3', famiglia: 'migliorare', livello: 'intermedio', sedute: 3, fasi: FASI_12, minuti: MINUTI_12 })
export const p8senza = programma({ id: 'senza-gara-8x3', famiglia: 'senza_gara', livello: 'intermedio', sedute: 3, fasi: FASI_8, minuti: MINUTI_8 })

export const profiloMigliorare = {
  obiettivo: 'migliorare', settimaneAllaGara: 12, livello: 'intermedio', sedute: 4,
  giorni: [1, 2, 4, 6], minutiSeduta: 60, attrezzatura: { luogo: 'hyrox' }, esclusioni: [],
}
export const profiloSenzaGara = { ...profiloMigliorare, obiettivo: 'senza_gara', settimaneAllaGara: null, sedute: 3 }
