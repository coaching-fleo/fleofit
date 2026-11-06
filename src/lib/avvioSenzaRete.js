// L'avvio dell'app senza rete (segnalazione del 04/11/2026: «senza Internet
// l'app rimane sulla schermata iniziale»).
//
// Due trappole, una dietro l'altra:
// 1. `supabase.auth.getSession()` con il token scaduto (dopo un'ora) prova a
//    rinnovarlo in rete e RIPROVA per ~25 secondi; e lo fa due volte, una
//    nell'inizializzazione e una nella chiamata. Quasi un minuto di apertura,
//    poi la sessione torna `null` e si finisce sul login.
// 2. Con il token ancora buono, le letture di `staff` e `athletes` falliscono:
//    la riga atleta «manca», e il cancello mandava l'atleta a riscattare un
//    codice invito, cioè lo disconnetteva.
//
// Qui: la sessione salvata sul dispositivo, letta senza rete, e il ruolo
// dell'ultimo accesso riuscito, per entrare comunque e mostrare le copie in
// cache delle pagine.

import { leggiJson, scriviJson } from './offlineQueue'

/** Quanto si aspetta `getSession()` prima di entrare con la sessione salvata. */
export const ATTESA_SESSIONE_MS = 5000

export const senzaRete = () =>
  typeof navigator !== 'undefined' && navigator.onLine === false

/** La sessione che supabase-js tiene in localStorage, o `null`. Nessuna rete. */
export function sessioneSalvata(auth, storage = globalThis.localStorage) {
  const chiave = auth?.storageKey
  if (!chiave) return null
  const s = leggiJson(chiave, null, storage)
  return s?.user?.id && s?.refresh_token ? s : null
}

/** `{ scaduto: true }` se la promessa non risponde entro `ms`. */
export function entro(promessa, ms) {
  let t
  const timeout = new Promise((r) => { t = setTimeout(() => r({ scaduto: true }), ms) })
  return Promise.race([promessa.then((valore) => ({ valore })), timeout])
    .finally(() => clearTimeout(t))
}

const chiaveRuolo = (uid) => `fleofit_ruolo_${uid}`

/** Il ruolo deciso all'ultimo accesso riuscito con la rete: 'admin', 'coach', 'athlete' o null. */
export const ruoloSalvato = (uid, storage = globalThis.localStorage) =>
  leggiJson(chiaveRuolo(uid), null, storage)

export const salvaRuolo = (uid, ruolo, storage = globalThis.localStorage) =>
  scriviJson(chiaveRuolo(uid), ruolo, storage)
