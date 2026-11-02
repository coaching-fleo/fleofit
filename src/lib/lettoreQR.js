/**
 * Il plugin nativo che legge un codice QR con la fotocamera: AVFoundation su
 * iPhone (`ios/App/App/LettoreQR.swift`), lo scanner di Google Play Services su
 * Android (`android/app/src/main/java/it/federicoleo/fleofit/LettoreQRPlugin.java`).
 * Serve a collegare la TV: sul web non c'è, `qrDisponibile()` lo dice e la
 * scelta «Inquadra il QR» non compare.
 */

import { Capacitor, registerPlugin } from '@capacitor/core'

const LettoreQR = registerPlugin('LettoreQR')

const errore = (code, message) => Object.assign(new Error(message), { code })

/** Il telefono sa leggere un QR? (solo app nativa con il plugin registrato) */
export const qrDisponibile = () => {
  try {
    return Capacitor.isPluginAvailable('LettoreQR')
  } catch {
    return false
  }
}

/**
 * Apre la fotocamera e aspetta un QR.
 * @returns {Promise<{ valore: string } | { annullato: true }>}
 * Rifiuta con un Error di `code` `'permesso'` (fotocamera negata) o
 * `'non_disponibile'` (niente plugin, o lo scanner non parte).
 */
export async function leggiQR() {
  if (!qrDisponibile()) throw errore('non_disponibile', 'Lettore QR non disponibile')
  try {
    return await LettoreQR.leggi()
  } catch (e) {
    const msg = String(e?.message || e || '')
    if (msg === 'permesso') throw errore('permesso', 'Permesso fotocamera negato')
    throw errore('non_disponibile', msg || 'Lettore QR non disponibile')
  }
}

/** Apre le Impostazioni dell'app (iPhone); altrove non fa niente. */
export async function apriImpostazioni() {
  if (!qrDisponibile()) return
  await LettoreQR.impostazioni().catch(() => {})
}
