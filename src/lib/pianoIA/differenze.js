// Le DIFFERENZE che l'IA propone rispetto a una seduta del team (spec §5.2).
//
// L'IA non riscrive la seduta: dice cosa cambiare («al posto del Sled Push
// fai Burpees Broad Jumps», «Wall Balls da 20 a 15»). Così lo stile del
// coach resta, i token sono pochi, e una differenza sbagliata si scarta da
// sola invece di rompere tutta la seduta. Se dopo le differenze la seduta
// non passa il validatore, l'utente riceve la seduta del team (`origine:
// 'team'`): sempre qualcosa di firmato da un coach.

import { validaSeduta } from './validaSeduta.js'

// I campi che l'IA può cambiare. Blocco Hyrox → `params`; fase di corsa →
// la fase stessa (non ha esercizi); esercizio → l'esercizio.
const CAMPI_ESERCIZIO = ['reps', 'meters', 'kg', 'exTime']
const CAMPI_BLOCCO = ['rounds', 'duration', 'timecap', 'on', 'off', 'interval']
const CAMPI_FASE = ['duration', 'pace', 'rounds', 'runDuration', 'recDuration', 'runPace', 'recPace']

const intero = { type: 'integer' }
const testo = { type: 'string' }

export const SCHEMA_DIFFERENZE = {
  type: 'object',
  additionalProperties: false,
  required: ['differenze', 'perche'],
  properties: {
    differenze: {
      type: 'array',
      items: {
        anyOf: [
          {
            type: 'object', additionalProperties: false, required: ['op', 'blocco', 'esercizio', 'con'],
            properties: { op: { type: 'string', enum: ['sostituisci'] }, blocco: intero, esercizio: intero, con: testo },
          },
          {
            type: 'object', additionalProperties: false, required: ['op', 'blocco', 'esercizio', 'campo', 'valore'],
            properties: {
              op: { type: 'string', enum: ['numero'] }, blocco: intero, esercizio: { type: ['integer', 'null'] },
              campo: { type: 'string', enum: [...new Set([...CAMPI_ESERCIZIO, ...CAMPI_BLOCCO, ...CAMPI_FASE])] },
              valore: testo,
            },
          },
          {
            type: 'object', additionalProperties: false, required: ['op', 'blocco', 'esercizio'],
            properties: { op: { type: 'string', enum: ['togli'] }, blocco: intero, esercizio: intero },
          },
        ],
      },
    },
    perche: testo,
  },
}

const indice = (v) => (Number.isInteger(v) && v >= 0 ? v : null)

/** Applica una differenza a una copia; torna false se non è applicabile. */
function applica(s, d) {
  if (!d || typeof d !== 'object') return false
  const b = indice(d.blocco)
  if (b === null) return false
  if (Array.isArray(s.steps)) {
    const fase = s.steps[b]
    if (!fase || d.op !== 'numero' || d.esercizio != null || !CAMPI_FASE.includes(d.campo)) return false
    if (typeof d.valore !== 'string' || !d.valore.trim()) return false
    fase[d.campo] = d.valore.trim()
    return true
  }
  const blocco = Array.isArray(s.blocks) ? s.blocks[b] : null
  if (!blocco) return false

  if (d.op === 'numero' && d.esercizio == null) {
    if (!CAMPI_BLOCCO.includes(d.campo) || typeof d.valore !== 'string' || !d.valore.trim()) return false
    blocco.params = { ...(blocco.params || {}), [d.campo]: d.valore.trim() }
    return true
  }
  const e = indice(d.esercizio)
  const esercizi = blocco.exercises || []
  if (e === null || !esercizi[e]) return false

  switch (d.op) {
    case 'sostituisci':
      if (typeof d.con !== 'string' || !d.con.trim()) return false
      esercizi[e] = { ...esercizi[e], name: d.con.trim() }
      return true
    case 'numero':
      if (!CAMPI_ESERCIZIO.includes(d.campo) || typeof d.valore !== 'string' || !d.valore.trim()) return false
      esercizi[e] = { ...esercizi[e], [d.campo]: d.valore.trim() }
      return true
    case 'togli':
      esercizi.splice(e, 1)
      return true
    default:
      return false
  }
}

export function applicaDifferenze(sections, differenze) {
  if (!Array.isArray(differenze)) return { sections, ignorate: [] }
  const s = structuredClone(sections)
  // I «togli» per ultimi e dall'indice più alto: togliere un esercizio non
  // deve spostare quelli a cui puntano le altre differenze.
  const ordine = [...differenze].sort((a, b) => {
    const ta = a?.op === 'togli', tb = b?.op === 'togli'
    if (ta !== tb) return ta ? 1 : -1
    return ta ? (b.blocco - a.blocco) || (b.esercizio - a.esercizio) : 0
  })
  const ignorate = ordine.filter(d => !applica(s, d))
  return { sections: ignorate.length === differenze.length ? sections : s, ignorate }
}

export function adattaSeduta(sedutaTeam, differenze, opzioniValidazione) {
  const { sections } = applicaDifferenze(sedutaTeam, differenze)
  const adattata = validaSeduta(sections, opzioniValidazione)
  const cambiata = sections !== sedutaTeam
  if (cambiata && adattata.ok) return { sections: adattata.sections, origine: 'adattata', errori: [] }
  const team = validaSeduta(sedutaTeam, opzioniValidazione)
  return { sections: team.sections ?? sedutaTeam, origine: 'team', errori: team.errori }
}
