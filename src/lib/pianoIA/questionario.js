// Il questionario del piano IA (spec 2026-11-27-pushfit-ai-design.md §4).
//
// Logica pura: valida le risposte, ferma chi non può ricevere un piano
// automatico (età, domande di sicurezza) e prepara il profilo che arriva
// all'IA, PSEUDONIMIZZATO — niente nome, email, nome della gara, testo
// sulla salute. Un dato mancante resta `null`: mai uno zero inventato.

export const ETA_MINIMA = 18

export const DOMANDE_SICUREZZA = [
  { id: 'petto', testo: 'Hai mai avuto dolore al petto durante uno sforzo?' },
  { id: 'svenimenti', testo: 'Ti è capitato di svenire o di avere forti capogiri?' },
  { id: 'cuore', testo: 'Un medico ti ha mai detto che hai un problema al cuore?' },
  { id: 'gravidanza', testo: 'Sei in gravidanza o hai partorito da meno di 6 mesi?' },
  { id: 'intervento', testo: 'Hai avuto un intervento o un infortunio serio negli ultimi 6 mesi?' },
]

const numero = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
// Tempi e anni: 0 o meno è un campo vuoto (Number('') === 0), non un dato.
// Senza, «non so» diventerebbe un 5 km in 0:00 e un livello avanzato.
const positivo = (v) => { const n = numero(v); return n !== null && n > 0 ? n : null }

/** Controlla la forma delle risposte. Gli errori sono i nomi dei campi. */
export function validaRisposte(r) {
  const errori = []
  const sedute = numero(r?.sedute)
  if (sedute === null || sedute < 2 || sedute > 6) errori.push('sedute')
  const giorni = Array.isArray(r?.giorni) ? new Set(r.giorni.filter(g => g >= 1 && g <= 7)) : new Set()
  if (sedute !== null && giorni.size < sedute) errori.push('giorni')
  const minuti = numero(r?.minutiSeduta)
  if (minuti === null || minuti < 20) errori.push('minutiSeduta')
  if (r?.obiettivo !== 'senza_gara' && !r?.gara?.data) errori.push('gara')
  if (!['prima_gara', 'migliorare', 'senza_gara'].includes(r?.obiettivo)) errori.push('obiettivo')
  return { ok: errori.length === 0, errori }
}

/** Chi non riceve un piano automatico: sotto i 18 anni, o un sì alla sicurezza. */
export function controlloSicurezza(r) {
  const eta = numero(r?.eta)
  if (eta !== null && eta < ETA_MINIMA) return { stop: true, motivo: 'eta' }
  const s = r?.sicurezza || {}
  if (DOMANDE_SICUREZZA.some(d => s[d.id] === true)) return { stop: true, motivo: 'sicurezza' }
  return { stop: false, motivo: null }
}

export function livelloStimato(r) {
  const anni = numero(r?.anniAllenamento)
  const hyrox = positivo(r?.ultimoTempoHyroxMin)
  if ((hyrox !== null && hyrox < 75) || (anni !== null && anni >= 3)) return 'avanzato'
  if ((anni === null || anni < 1) && hyrox === null) return 'principiante'
  return 'intermedio'
}

const GIORNO_MS = 24 * 60 * 60 * 1000

/** Settimane intere da oggi alla gara; null senza gara o con la gara passata. */
export function settimaneAllaGara(r, oggi) {
  const data = r?.gara?.data
  if (!data) return null
  const gara = new Date(`${data}T00:00:00Z`)
  const inizio = new Date(Date.UTC(oggi.getUTCFullYear(), oggi.getUTCMonth(), oggi.getUTCDate()))
  const giorni = Math.round((gara - inizio) / GIORNO_MS)
  if (!Number.isFinite(giorni) || giorni <= 0) return null
  return Math.floor(giorni / 7)
}

function fasciaEta(eta) {
  const n = numero(eta)
  if (n === null) return null
  if (n >= 60) return '60+'
  if (n < 30) return '18-29'
  const da = Math.floor(n / 10) * 10
  return `${da}-${da + 9}`
}

/** Il profilo come lo legge l'IA: solo dati di allenamento, nessun dato che identifica. */
export function profiloPerIA(r, oggi) {
  return {
    obiettivo: r.obiettivo,
    settimaneAllaGara: settimaneAllaGara(r, oggi),
    categoria: { ...r.categoria },
    livello: livelloStimato(r),
    fasciaEta: fasciaEta(r.eta),
    sedute: r.sedute,
    giorni: [...(r.giorni || [])],
    minutiSeduta: r.minutiSeduta,
    attrezzatura: { ...r.attrezzatura },
    stazioniDeboli: [...(r.stazioniDeboli || [])],
    tempo5kSec: positivo(r.tempo5kSec),
    ultimoTempoHyroxMin: positivo(r.ultimoTempoHyroxMin),
    tempoObiettivoMin: positivo(r.tempoObiettivoMin),
    esclusioni: [...(r.esclusioni || [])],
  }
}
