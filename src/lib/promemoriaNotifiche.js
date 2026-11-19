/**
 * Quando riproporre le notifiche a chi non le ha (19/11/2026, progetto in
 * docs/superpowers/specs/2026-11-19-promemoria-notifiche-design.md).
 *
 * Dopo ogni «Non ora» si aspetta sempre di più: 3, 7, 14, 30, 60 giorni. Al
 * sesto «Non ora» non si chiede più; «Non chiedermelo più» chiude subito.
 * Lo stato sta sul telefono, non nel database: è una cortesia di questo
 * dispositivo, e lo schema è congelato.
 */
import { differenceInCalendarDays, format, isValid, parseISO } from 'date-fns'
import { leggiJson, scriviJson } from './offlineQueue'

export const CHIAVE_PROMEMORIA_NOTIFICHE = 'pushfit_promemoria_notifiche'
export const PAUSE_GIORNI = [3, 7, 14, 30, 60]
export const STATO_INIZIALE = Object.freeze({ rifiuti: 0, ultimo: null, mai: false })

const iniziale = () => ({ ...STATO_INIZIALE })

/** Qualunque cosa non sia uno stato sensato torna all'inizio. */
export function normalizza(valore) {
  if (!valore || typeof valore !== 'object') return iniziale()
  const { rifiuti, ultimo, mai } = valore
  if (!Number.isInteger(rifiuti) || rifiuti < 0) return iniziale()
  if (typeof mai !== 'boolean') return iniziale()
  if (rifiuti === 0) return { rifiuti: 0, ultimo: null, mai }
  if (typeof ultimo !== 'string' || !isValid(parseISO(ultimo))) return iniziale()
  return { rifiuti, ultimo, mai }
}

export function deveChiedere(stato, oggi) {
  const s = normalizza(stato)
  if (s.mai) return false
  if (s.rifiuti === 0) return true
  if (s.rifiuti > PAUSE_GIORNI.length) return false
  // Con l'ultimo rifiuto «nel futuro» (orologio spostato) i giorni sono
  // negativi: non si chiede finché la pausa non passa davvero.
  return differenceInCalendarDays(oggi, parseISO(s.ultimo)) >= PAUSE_GIORNI[s.rifiuti - 1]
}

export const mostraMai = (stato) => normalizza(stato).rifiuti >= 1

export function dopoNonOra(stato, oggi) {
  const s = normalizza(stato)
  return { ...s, rifiuti: s.rifiuti + 1, ultimo: format(oggi, 'yyyy-MM-dd') }
}

export const dopoMai = (stato) => ({ ...normalizza(stato), mai: true })

export const leggiStato = (storage = globalThis.localStorage) =>
  normalizza(leggiJson(CHIAVE_PROMEMORIA_NOTIFICHE, null, storage))

export const scriviStato = (stato, storage = globalThis.localStorage) =>
  scriviJson(CHIAVE_PROMEMORIA_NOTIFICHE, normalizza(stato), storage)

export const azzera = (storage = globalThis.localStorage) => scriviStato(iniziale(), storage)

/**
 * L'atleta ha qualcosa da fare da oggi in poi? È il «momento giusto» per lui:
 * le notifiche servono a non perdersi proprio quelli.
 * @param {Array<{status: string, completed_date: string}>|null} righe  athlete_workouts
 * @param {string} oggiStr 'yyyy-MM-dd'
 */
export const haAllenamentiDaFare = (righe, oggiStr) =>
  (righe || []).some(r => r?.status === 'pending' && typeof r.completed_date === 'string' && r.completed_date >= oggiStr)

// Al massimo una volta per apertura dell'app: un flag del modulo, non di un
// componente, così un rimontaggio non lo azzera.
let aperturaUsata = false
/** Prende il turno di questa apertura: true solo la prima volta. */
export function usaApertura() {
  if (aperturaUsata) return false
  aperturaUsata = true
  return true
}
/** Solo per i test. */
export const _azzeraApertura = () => { aperturaUsata = false }
