// ─── LE CARATTERISTICHE DI UN MODELLO DI SCARPA ────────────────────────────
// Un posto solo per ciò che descrive un modello (ammortizzamento, drop, peso…):
// le etichette, i limiti, la lettura per la scheda e la validazione per
// l'editor del catalogo. Logica pura: niente Supabase (per questo `numeroKm`
// sta in kmScarpe.js).
//
// Un dato mancante è «—», mai 0 e mai riga nascosta; lo zero (drop 0 mm) è un dato.

import { numeroKm, SOGLIA_PREDEFINITA, TIPI_SCARPA } from './kmScarpe'

export const LIVELLI = [
  { valore: 'principiante', etichetta: 'Principiante', classe: 'text-green-500 border-green-500/30 bg-green-500/10' },
  { valore: 'intermedio', etichetta: 'Intermedio', classe: 'text-brand border-brand/30 bg-brand/10' },
  { valore: 'avanzato', etichetta: 'Avanzato', classe: 'text-red-500 border-red-500/30 bg-red-500/10' },
]

export const OPZIONI = {
  ammortizzamento: [
    { valore: 'basso', etichetta: 'Basso' }, { valore: 'medio', etichetta: 'Medio' },
    { valore: 'alto', etichetta: 'Alto' }, { valore: 'massimo', etichetta: 'Massimo' },
  ],
  stabilita: [{ valore: 'neutra', etichetta: 'Neutra' }, { valore: 'sostegno', etichetta: 'Sostegno' }],
  piastra: [
    { valore: 'nessuna', etichetta: 'Nessuna' }, { valore: 'nylon_tpu', etichetta: 'Nylon/TPU' },
    { valore: 'carbonio', etichetta: 'Carbonio' },
  ],
  uso: [
    { valore: 'lento', etichetta: 'Lento' }, { valore: 'ritmo', etichetta: 'Ritmo' },
    { valore: 'ripetute', etichetta: 'Ripetute' }, { valore: 'gara', etichetta: 'Gara' },
    { valore: 'trail', etichetta: 'Trail' },
  ],
}

export const LIMITI = { drop_mm: [0, 16], peso_g: [100, 500], stack_mm: [10, 60], vita_km: [200, 2000] }

const NUMERICI = ['drop_mm', 'peso_g', 'stack_mm', 'vita_km']
const INTERI = ['peso_g', 'vita_km']
const ELENCHI = ['tipo', 'livello', 'ammortizzamento', 'stabilita', 'piastra']
const URL = ['url_ufficiale', 'foto_url']
const ETICHETTA_NUM = { drop_mm: 'Il drop', peso_g: 'Il peso', stack_mm: "L'altezza al tallone", vita_km: 'La vita stimata' }

const valoriDi = (chiave) => (chiave === 'tipo' ? TIPI_SCARPA : chiave === 'livello' ? LIVELLI : OPZIONI[chiave]).map(o => o.valore)
const etichettaDi = (chiave, valore) =>
  (chiave === 'livello' ? LIVELLI : OPZIONI[chiave]).find(o => o.valore === valore)?.etichetta ?? null

const vuoto = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '')
const dentro = (n, [min, max]) => Number.isFinite(n) && n >= min && n <= max

const trovaUso = (uso) =>
  (Array.isArray(uso) ? uso : []).map(u => etichettaDi('uso', u)).filter(Boolean)

/** Le 8 righe della scheda, sempre nello stesso ordine; il valore è già testo. */
export function righeCaratteristiche(modello) {
  const m = modello || {}
  const num = (chiave, unita) => (m[chiave] === null || m[chiave] === undefined || m[chiave] === '' ? '—' : `${String(m[chiave]).replace('.', ',')} ${unita}`)
  const uso = trovaUso(m.uso)
  return [
    { chiave: 'ammortizzamento', etichetta: 'Ammortizzamento', valore: etichettaDi('ammortizzamento', m.ammortizzamento) ?? '—' },
    { chiave: 'stabilita', etichetta: 'Stabilità', valore: etichettaDi('stabilita', m.stabilita) ?? '—' },
    { chiave: 'piastra', etichetta: 'Piastra', valore: etichettaDi('piastra', m.piastra) ?? '—' },
    { chiave: 'drop_mm', etichetta: 'Drop', valore: num('drop_mm', 'mm') },
    { chiave: 'peso_g', etichetta: 'Peso', valore: num('peso_g', 'g') },
    { chiave: 'stack_mm', etichetta: 'Altezza al tallone', valore: num('stack_mm', 'mm') },
    { chiave: 'uso', etichetta: 'Uso ideale', valore: uso.length ? uso.join(' · ') : '—' },
    { chiave: 'vita_km', etichetta: 'Vita stimata', valore: num('vita_km', 'km') },
  ]
}

/**
 * Normalizza e controlla i campi di un modello.
 * `dati` contiene solo le colonne note del catalogo (le altre chiavi si ignorano).
 * Con `{ parziale: true }` si guardano soltanto le chiavi presenti in `campi`.
 */
export function validaModello(campi, { parziale = false } = {}) {
  const c = campi || {}
  const dati = {}
  const errori = {}
  const presente = (k) => !parziale || Object.prototype.hasOwnProperty.call(c, k)

  for (const k of ['marca', 'modello']) {
    if (!presente(k)) continue
    const t = String(c[k] ?? '').trim()
    if (!t) errori[k] = k === 'marca' ? 'Scrivi la marca.' : 'Scrivi il modello.'
    else dati[k] = t
  }
  for (const k of ELENCHI) {
    if (!presente(k)) continue
    if (vuoto(c[k])) { dati[k] = null; continue }
    if (!valoriDi(k).includes(c[k])) { errori[k] = 'Valore non ammesso.'; continue }
    dati[k] = c[k]
  }
  for (const k of NUMERICI) {
    if (!presente(k)) continue
    if (vuoto(c[k])) { dati[k] = null; continue }
    const n = numeroKm(c[k])
    if (n === null || !dentro(n, LIMITI[k])) {
      errori[k] = `${ETICHETTA_NUM[k]} deve stare fra ${LIMITI[k][0]} e ${LIMITI[k][1]}.`
      continue
    }
    dati[k] = INTERI.includes(k) ? Math.round(n) : n
  }
  if (presente('uso')) {
    const valori = valoriDi('uso')
    const uso = (Array.isArray(c.uso) ? c.uso : []).filter(u => valori.includes(u))
    dati.uso = uso.length ? uso : null
  }
  for (const k of URL) {
    if (!presente(k)) continue
    if (vuoto(c[k])) { dati[k] = null; continue }
    const u = String(c[k]).trim()
    if (!u.startsWith('https://')) { errori[k] = "L'indirizzo deve cominciare con https://"; continue }
    dati[k] = u
  }
  return { dati, errori }
}

/** La soglia da proporre per una scarpa: la vita stimata del modello, se valida. */
export function sogliaProposta(modello) {
  const v = Number(modello?.vita_km)
  return dentro(v, LIMITI.vita_km) ? v : SOGLIA_PREDEFINITA
}
