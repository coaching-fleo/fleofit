// ─── I KM CHE UN ALLENAMENTO HA FATTO FARE ALLE SCARPE ────────────────────
// Le scarpe sommano i km degli allenamenti per cui l'atleta le ha scelte
// (docs/superpowers/specs/2026-11-02-scarpe-design.md §4). Qui si decide
// quanti km vale UN allenamento: se c'è l'orologio (Garmin) vince lui, altrimenti
// si stima dalla scheda. Se la scheda non ha corsa il risultato è `null`,
// MAI 0: un numero inventato finirebbe nel totale della scarpa.
//
// Una fase senza unità di distanza si stima dai minuti (`parseTime`) divisi
// per il ritmo; se il ritmo non è un `m:ss /km` vale `MINUTI_PER_KM`, tranne
// «Da fermo» (0 km) e «Camminata» (12 min/km).
// Ripetute solo via `partiRipetuta`, blocchi Hyrox solo via `getNormalizedBlocks`.

import { partiRipetuta } from './ripetute'
import { getNormalizedBlocks } from './timerSequence'
import { parseTime, MINUTI_PER_KM } from './statistiche'

export const SOGLIA_PREDEFINITA = 700
/** Da questa quota della soglia la scarpa è «quasi» da cambiare. */
const QUOTA_QUASI = 0.8

const arrotonda = (km) => Math.round(km * 100) / 100

/** I km di una distanza scritta («5 km», «800m»), o null se non è una distanza. */
const kmDaDistanza = (testo) => {
  const s = String(testo ?? '').toLowerCase().trim()
  const km = s.match(/^(\d+(?:[.,]\d+)?)\s*km$/)
  if (km) return parseFloat(km[1].replace(',', '.'))
  const m = s.match(/^(\d+(?:[.,]\d+)?)\s*m$/)
  if (m) return parseFloat(m[1].replace(',', '.')) / 1000
  return null
}

/** Minuti per km di un ritmo scritto: la media dei `m:ss` presenti, altrimenti il ritmo di base. */
const minutiPerKmDa = (...ritmi) => {
  for (const r of ritmi) {
    const tempi = [...String(r ?? '').matchAll(/(\d+):(\d{2})/g)].map(t => Number(t[1]) + Number(t[2]) / 60)
    if (tempi.length) return tempi.reduce((a, b) => a + b, 0) / tempi.length
  }
  return MINUTI_PER_KM
}

/** Camminare, a tempo: 12 min/km (il doppio del ritmo di base). */
const MINUTI_PER_KM_CAMMINATA = 12

/** Vero se uno dei ritmi scritti dice `parola` (senza badare alle maiuscole). */
const ritmoE = (ritmi, parola) => ritmi.some(r => String(r ?? '').toLowerCase().includes(parola))

/**
 * I km di un tratto: a distanza si leggono, a tempo si stimano. A tempo,
 * «Da fermo» non consuma la scarpa (0 km) e «Camminata» va a 12 min/km.
 */
const kmTratto = (duration, ...ritmi) => {
  const daDistanza = kmDaDistanza(duration)
  if (daDistanza !== null) return daDistanza
  const minuti = parseTime(duration)
  if (!(minuti > 0)) return 0
  if (ritmoE(ritmi, 'da fermo')) return 0
  if (ritmoE(ritmi, 'camminata')) return minuti / MINUTI_PER_KM_CAMMINATA
  // «paceMin paceMax» insieme sono un intervallo: la media dei due estremi.
  const intervallo = ritmi.slice(0, 2).join(' ')
  return minuti / minutiPerKmDa(intervallo, ritmi[2])
}

const kmFasi = (steps) => steps.reduce((tot, step) => {
  if (step?.type === 'repeat') {
    const giri = parseInt(step.rounds) || 1
    return tot + giri * partiRipetuta(step)
      .reduce((t, p) => t + kmTratto(p.duration, p.paceMin, p.paceMax, p.pace), 0)
  }
  return tot + kmTratto(step?.duration, step?.paceMin, step?.paceMax, step?.pace)
}, 0)

const ESERCIZI_CORSA = ['run', 'shuttle run']

const kmBlocchi = (blocchi) => blocchi.reduce((tot, b) => {
  const giri = parseInt(b?.params?.rounds) || 1
  const metriGiro = (b?.exercises || [])
    .filter(e => ESERCIZI_CORSA.includes(String(e?.name ?? '').toLowerCase().trim()))
    .reduce((t, e) => t + (kmDaDistanza(e.meters) ?? 0), 0)
  return tot + metriGiro * giri
}, 0)

const kmStima = (sections) => {
  if (!sections) return 0
  if (Array.isArray(sections.steps) && sections.steps.length) return kmFasi(sections.steps)
  return kmBlocchi(getNormalizedBlocks({ sections }))
}

/** Vero se la scheda ha una corsa da cui ricavare dei km. */
export const haCorsa = (sections) => kmStima(sections) > 0

/**
 * I km di un allenamento: l'orologio se c'è (`distanza_m`), altrimenti la stima
 * dalla scheda; `null` se non si sa niente.
 */
export const kmAllenamento = (sections, attivita) => {
  const metri = Number(attivita?.distanza_m)
  if (metri > 0) return { km: arrotonda(metri / 1000), fonte: 'orologio' }
  const km = arrotonda(kmStima(sections))
  return km > 0 ? { km, fonte: 'stima' } : null
}

/** I km di una scarpa: quelli di partenza più gli usi noti (i `null` non contano). */
export const kmScarpa = (scarpa, kmUsi = []) =>
  arrotonda((Number(scarpa?.km_iniziali) || 0)
    + kmUsi.reduce((t, k) => t + (Number.isFinite(k) ? k : 0), 0))

/** `ok` sotto l'80% della soglia, `quasi` da lì, `oltre` dal 100%. */
export const statoScarpa = (km, soglia) => {
  if (km >= soglia) return 'oltre'
  return km >= soglia * QUOTA_QUASI ? 'quasi' : 'ok'
}

/** I tipi del catalogo, nell'ordine dei filtri (il `check` della colonna `tipo`). */
export const TIPI_SCARPA = [
  { valore: 'allenamento', etichetta: 'Allenamento' },
  { valore: 'gara', etichetta: 'Gara' },
  { valore: 'trail', etichetta: 'Trail' },
  { valore: 'ammortizzata', etichetta: 'Ammortizzata' },
]

/** «412», «1.200»: i km si mostrano interi. Sconosciuti → «—», mai 0. */
export const testoKm = (km) => (km == null || !Number.isFinite(Number(km))
  ? '—'
  // A mano e non con toLocaleString: in italiano «1200» resterebbe senza punto.
  : String(Math.round(Number(km))).replace(/\B(?=(\d{3})+(?!\d))/g, '.'))
