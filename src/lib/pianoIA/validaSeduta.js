// Il validatore di una seduta del piano IA (spec §5.4). È CODICE, non IA:
// riporta la seduta al formato del builder con le funzioni che l'app usa già
// per «Genera con IA», e la rifiuta se non rispetta formato, nomi del
// picker, durata, attrezzatura dell'utente o esclusioni.
//
// La durata passa da `durataStimataReale` (statistiche.js), che per Hyrox
// somma `durataBlocco`: uno stimatore solo (CLAUDE.md §9).

import { preparaBlocchiIA, preparaFasiIA } from '../blocchiIA.js'
import { preparaGymIA } from '../gym.js'
import { trovaEsercizioGym, voceGym } from '../eserciziGym.js'
import { HYROX_EXERCISES } from '../esercizi.js'
import { durataStimataReale } from '../statistiche.js'
import { disponibile } from './attrezzatura.js'

export const TOLLERANZA_DURATA = 0.15

const NOMI_HYROX = new Set(HYROX_EXERCISES)
const minuscolo = (s) => String(s ?? '').trim().toLowerCase()

function categoriaDi(s) {
  if (s.category) return s.category
  if (Array.isArray(s.steps)) return 'Running'
  if (Array.isArray(s.gym)) return 'Gym'
  return 'Hyrox'
}

/** Le sections normalizzate, o null se la forma non è quella della categoria. */
function normalizza(s) {
  const categoria = categoriaDi(s)
  if (categoria === 'Running') {
    const steps = preparaFasiIA(s.steps)
    return steps.length ? { ...s, category: 'Running', steps } : null
  }
  if (categoria === 'Gym') {
    const gym = preparaGymIA(s.gym)
    return gym.length ? { ...s, category: 'Gym', gym } : null
  }
  if (categoria !== 'Hyrox') return null
  const blocks = preparaBlocchiIA(s.blocks)
  return blocks.length ? { ...s, category: 'Hyrox', blocks } : null
}

/** I nomi degli esercizi di una seduta normalizzata. */
function esercizi(s) {
  if (s.category === 'Hyrox') return s.blocks.flatMap(b => b.exercises || []).map(e => e.name)
  if (s.category === 'Gym') return s.gym.flatMap(g => g.esercizi || []).map(e => e.name)
  return []
}

export function validaSeduta(sections, { minutiPrevisti, attrezzatura, esclusioni = [] } = {}) {
  if (!sections || typeof sections !== 'object') {
    return { ok: false, errori: [{ tipo: 'formato', dettaglio: 'seduta mancante' }], sections: null }
  }
  const s = normalizza(sections)
  if (!s) return { ok: false, errori: [{ tipo: 'formato', dettaglio: 'nessun blocco o fase' }], sections: null }

  const errori = []
  const esclusi = new Set(esclusioni.map(minuscolo))
  for (const nome of esercizi(s)) {
    const valido = s.category === 'Gym' ? Boolean(trovaEsercizioGym(nome)) : NOMI_HYROX.has(nome)
    if (!valido) errori.push({ tipo: 'nome', dettaglio: String(nome) })
    if (esclusi.has(minuscolo(nome))) errori.push({ tipo: 'esclusione', dettaglio: nome })
    const ok = s.category === 'Gym'
      ? attrezzatura?.luogo !== 'casa' || voceGym(nome).carico === false
      : disponibile(nome, attrezzatura)
    if (!ok) errori.push({ tipo: 'attrezzatura', dettaglio: nome })
  }

  const minuti = durataStimataReale(s)
  if (typeof minutiPrevisti === 'number' && minutiPrevisti > 0 && minuti !== null &&
      Math.abs(minuti - minutiPrevisti) / minutiPrevisti > TOLLERANZA_DURATA) {
    errori.push({ tipo: 'durata', dettaglio: `${minuti} minuti invece di ${minutiPrevisti}` })
  }
  return { ok: errori.length === 0, errori, sections: s }
}
