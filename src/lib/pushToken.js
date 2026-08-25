// Ri-registrazione silenziosa del token push a ogni avvio.
//
// Prima il token veniva salvato SOLO quando l'utente entrava in Impostazioni e
// attivava le notifiche. Ma i token cambiano da soli: reinstallazione, cambio di
// bundle id, aggiornamento dell'app, rotazione decisa da FCM. Quando cambiavano,
// in push_subscriptions restava quello vecchio e l'utente smetteva di ricevere
// le push PER SEMPRE, senza che nessuno se ne accorgesse — la notifica in-app
// continuava ad arrivare, quindi il difetto era invisibile.
//
// Qui non si chiede mai il permesso: se non è già concesso non si fa nulla.
// L'utente decide in Impostazioni, questo si limita a tenere il token fresco.
import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { FCM } from '@capacitor-community/fcm'
import { supabase } from '../supabaseClient'

export async function rinfrescaTokenPush(userId) {
  if (!Capacitor.isNativePlatform() || !userId) return

  try {
    const permesso = await PushNotifications.checkPermissions()
    if (permesso.receive !== 'granted') return

    const token = await new Promise((resolve) => {
      let risolto = false
      const chiudi = (v) => { if (!risolto) { risolto = true; resolve(v) } }
      PushNotifications.addListener('registration', async (t) => {
        let valore = t.value
        try {
          const fcm = await FCM.getToken()
          if (fcm?.token) valore = fcm.token
        } catch { /* su web o senza FCM si tiene il token APNs */ }
        chiudi(valore)
      }).catch(() => chiudi(null))
      PushNotifications.addListener('registrationError', () => chiudi(null)).catch(() => chiudi(null))
      PushNotifications.register().catch(() => chiudi(null))
      setTimeout(() => chiudi(null), 10000)
    })

    if (!token) return

    await supabase.from('push_subscriptions').upsert({
      user_id: userId,
      endpoint: token,
      auth: 'capacitor_ios',
      p256dh: 'capacitor_ios',
    }, { onConflict: 'endpoint' })

    // Le righe iOS precedenti dello stesso utente puntano a installazioni che
    // non esistono più: lasciarle significa che ogni notifica tenta un invio
    // destinato a fallire, e che i log si riempiono di errori inutili.
    await supabase.from('push_subscriptions')
      .delete()
      .eq('user_id', userId)
      .eq('auth', 'capacitor_ios')
      .neq('endpoint', token)
  } catch {
    // Il token push non è mai un motivo per far fallire l'avvio dell'app.
  }
}
