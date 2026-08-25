// Coda delle azioni fatte senza rete, e lettura tollerante di localStorage.
//
// Perché sta qui e non dentro Home.jsx
// ─────────────────────────────────────
// È l'unico punto dell'app dove un guasto costa DATI: un workout completato
// offline vive solo in localStorage finché la rete non torna. Il 25/08/2026 ci
// sono stati trovati due difetti della stessa famiglia, entrambi invisibili:
//
//  1. Un valore JSON corrotto veniva ignorato in silenzio e lasciato lì. Da quel
//     momento ogni sincronizzazione ripartiva, ritrovava lo stesso valore
//     illeggibile e usciva: la coda non si svuotava MAI più.
//  2. I chiamanti facevano JSON.parse sulla cache senza try/catch, dopo aver già
//     messo l'interfaccia in stato "sto salvando". Un'eccezione lì dentro
//     lasciava la modale RPE bloccata a girare e perdeva il completamento.
//
// La regola che ne è uscita: **una lettura che fallisce si ripara da sola**.
// Meglio ripartire da zero che restare bloccati per sempre su un valore rotto.

export const CHIAVE_CODA = 'fleofit_offline_queue'

/**
 * Legge un JSON da localStorage senza mai lanciare.
 * Se il valore è illeggibile lo RIMUOVE e torna il fallback: è la parte che
 * evita il blocco permanente. Un valore assente non è un errore e non logga.
 */
export function leggiJson(chiave, fallback, storage = globalThis.localStorage) {
  if (!storage) return fallback
  let grezzo
  try {
    grezzo = storage.getItem(chiave)
  } catch {
    // Safari in navigazione privata può negare l'accesso a localStorage.
    return fallback
  }
  if (grezzo === null || grezzo === undefined) return fallback
  try {
    const valore = JSON.parse(grezzo)
    return valore === null ? fallback : valore
  } catch (e) {
    console.warn(`Valore illeggibile in ${chiave}, lo rimuovo:`, e)
    try { storage.removeItem(chiave) } catch { /* niente da fare */ }
    return fallback
  }
}

/** Scrive un JSON senza lanciare: una quota piena non deve rompere il flusso. */
export function scriviJson(chiave, valore, storage = globalThis.localStorage) {
  if (!storage) return false
  try {
    storage.setItem(chiave, JSON.stringify(valore))
    return true
  } catch (e) {
    console.warn(`Impossibile scrivere ${chiave}:`, e)
    return false
  }
}

/** La coda è sempre un array: qualunque altra cosa trovata viene scartata. */
export function leggiCoda(storage = globalThis.localStorage) {
  const coda = leggiJson(CHIAVE_CODA, [], storage)
  return Array.isArray(coda) ? coda : []
}

/**
 * Aggiunge un'azione, tenendone UNA SOLA per allenamento.
 *
 * Senza la deduplica, toccando due volte lo stesso workout offline si
 * accodavano due UPDATE che al ritorno della rete si sovrascrivevano in ordine
 * imprevedibile. Vince l'ultima, che è l'intenzione dell'utente.
 *
 * Funzione pura: non tocca localStorage e non modifica l'array ricevuto.
 */
export function accoda(coda, payload, ora = Date.now()) {
  const precedenti = (Array.isArray(coda) ? coda : [])
    .filter(a => !(a?.type === 'UPDATE_WORKOUT' && a?.payload?.id === payload.id))
  return [...precedenti, { type: 'UPDATE_WORKOUT', payload, ts: ora }]
}

/** Legge, accoda e riscrive. È quello che chiama Home. */
export function accodaSuStorage(payload, storage = globalThis.localStorage, ora = Date.now()) {
  const nuova = accoda(leggiCoda(storage), payload, ora)
  scriviJson(CHIAVE_CODA, nuova, storage)
  return nuova
}

/** Chiave della cache dei workout, che è per atleta. */
export const chiaveCacheWorkout = (uid) => `fleofit_cache_workouts_${uid}`
