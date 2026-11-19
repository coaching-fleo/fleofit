/**
 * Il permesso delle notifiche visto dal promemoria (src/lib/promemoriaNotifiche.js).
 *
 * Su iPhone la richiesta del sistema si può fare UNA volta: dopo un «no» l'unica
 * strada sono le Impostazioni del telefono, e per aprirle si riusa il plugin del
 * lettore QR (esiste su iOS e Android). Il token lo salva `rinfrescaTokenPush`,
 * lo stesso che gira a ogni avvio: un solo posto che scrive push_subscriptions.
 */
import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { rinfrescaTokenPush } from './pushToken'
import { apriImpostazioni } from './lettoreQR'

/** @returns {Promise<'attive' | 'da-chiedere' | 'negate' | 'non-disponibile'>} */
export async function statoPermesso() {
  if (!Capacitor.isNativePlatform()) return 'non-disponibile'
  try {
    const { receive } = await PushNotifications.checkPermissions()
    if (receive === 'granted') return 'attive'
    if (receive === 'denied') return 'negate'
    if (receive === 'prompt' || receive === 'prompt-with-rationale') return 'da-chiedere'
    return 'non-disponibile'
  } catch {
    return 'non-disponibile'
  }
}

/** Fa partire la richiesta del sistema; se concesso salva il token. */
export async function chiediPermesso(userId) {
  try {
    const { receive } = await PushNotifications.requestPermissions()
    if (receive !== 'granted') return false
    await rinfrescaTokenPush(userId)
    return true
  } catch {
    return false
  }
}

/** Un'app vecchia senza il plugin non deve rompersi: non succede niente. */
export async function apriImpostazioniTelefono() {
  await Promise.resolve(apriImpostazioni()).catch(() => {})
}

export const EVENTO_MOMENTO = 'pushfit:momento-notifiche'

/** «Adesso le notifiche avrebbero senso»: lo dicono la Home e le assegnazioni. */
export function segnalaMomentoNotifiche(ruolo) {
  window.dispatchEvent(new CustomEvent(EVENTO_MOMENTO, { detail: { ruolo } }))
}
