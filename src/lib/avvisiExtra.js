// Gli avvisi degli extra per la card «Dagli Extra» in Home (spec 2026-11-12 §3).
// Logica pura: quale avviso mostrare e quanti altri ce ne sono.
//
// Un avviso chiuso con la X si ricorda su QUESTO dispositivo e per QUESTO utente
// (due persone sullo stesso telefono non si nascondono gli avvisi a vicenda), con
// la sua chiave: se l'avviso cambia (un'altra scarpa da cambiare) torna.

/** La chiave localStorage degli avvisi chiusi da un utente. */
export const chiaveVistiDi = (uid) => `pushfit_extra_visti_${uid}`
/** Quante chiavi si ricordano al massimo: le più vecchie escono. */
export const MASSIMO_VISTI = 50

export const chiaveVisto = (idExtra, chiave) => `${idExtra}:${chiave}`

const PESO = { alta: 0, normale: 1 }

/**
 * `voci`: [{ extra, avviso }] nell'ordine del registro. Toglie i già visti,
 * mette le `alta` davanti (a parità resta l'ordine del registro).
 */
export function ordinaAvvisi(voci, visti) {
  const aperte = voci
    .filter(v => v.avviso && !visti.includes(chiaveVisto(v.extra.id, v.avviso.chiave)))
    .map((v, i) => ({ v, i }))
    .sort((a, b) => (PESO[a.v.avviso.priorita] ?? 1) - (PESO[b.v.avviso.priorita] ?? 1) || a.i - b.i)
    .map(x => x.v)
  return { primo: aperte[0] || null, altri: Math.max(aperte.length - 1, 0) }
}

/** La lista dei visti con una chiave in più, senza doppioni e al massimo MASSIMO_VISTI. */
export const aggiungiVisto = (visti, chiave) =>
  [...visti.filter(k => k !== chiave), chiave].slice(-MASSIMO_VISTI)
