// «Notifica di prova» (20/11/2026, solo admin, Impostazioni → Strumenti sviluppo):
// una push vera a QUESTO telefono dopo 5 secondi. Il server è il modo
// `notifica_test` di send-reminders (supabase/functions/send-reminders/notificaTest.ts).
import { Capacitor } from '@capacitor/core'
import { FCM } from '@capacitor-community/fcm'

/**
 * Il token con cui questo dispositivo sta in push_subscriptions: quello FCM
 * nell'app, l'endpoint Web Push nel browser. null = notifiche non attive qui.
 */
export async function tokenDiQuestoDispositivo() {
  try {
    if (Capacitor.isNativePlatform()) {
      const r = await FCM.getToken()
      return r?.token || null
    }
    if (!('serviceWorker' in navigator)) return null
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = await reg?.pushManager?.getSubscription()
    return sub?.endpoint || null
  } catch {
    return null
  }
}

/**
 * Il testo da mostrare dopo il tocco. `risposta` = data della funzione (null =
 * chiamata fallita); `senzaToken` = questo dispositivo non ha un token.
 * @returns {{ errore: boolean, testo: string }}
 */
export function esitoNotificaTest(risposta, { senzaToken = false } = {}) {
  if (senzaToken) return { errore: true, testo: 'Su questo dispositivo le notifiche non sono attive: accendile qui sopra e riprova.' }
  if (risposta?.error === 'dispositivo_sconosciuto') {
    return { errore: true, testo: 'Questo dispositivo non risulta iscritto alle notifiche: spegnile e riaccendile qui sopra, poi riprova.' }
  }
  if (!risposta?.success) return { errore: true, testo: 'La prova non è partita. Controlla la connessione e riprova.' }
  return { errore: false, testo: 'Arriva fra 5 secondi: chiudi l\'app o blocca il telefono per vederla come un atleta.' }
}
