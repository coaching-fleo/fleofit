// homeClassica.js — l'interruttore «Home classica» (10/11/2026).
//
// Dal 10/11/2026 la Home coach è la «Riepilogo» (numeri che aprono liste). Il
// cruscotto di prima resta nell'app: chi lo preferisce lo riaccende da
// Impostazioni. È una preferenza DEL DISPOSITIVO, come le notifiche.
// Assente, rotta o non booleana = Riepilogo.

import { leggiJson, scriviJson } from './offlineQueue'

export const CHIAVE_HOME_CLASSICA = 'fleofit_home_classica'

export function leggiHomeClassica(storage = globalThis.localStorage) {
  return leggiJson(CHIAVE_HOME_CLASSICA, false, storage) === true
}

export function scriviHomeClassica(valore, storage = globalThis.localStorage) {
  scriviJson(CHIAVE_HOME_CLASSICA, valore === true, storage)
}
