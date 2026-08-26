import { Capacitor } from '@capacitor/core'
import { Badge } from '@capawesome/capacitor-badge'

// Il badge sull'icona dell'app, in un posto solo.
//
// Perché esiste questo file
// ──────────────────────────
// La stessa coppia di operazioni era ricopiata in SETTE punti fra Home.jsx,
// App.jsx e WorkoutDetail.jsx: aggiorna il badge nativo, e scrivi lo stesso
// numero in push_subscriptions.badge_count. Il rischio non era che sbagliasse —
// funzionava — ma che una modifica futura ne aggiornasse sei su sette, e la
// divergenza fosse invisibile finché qualcuno non guarda il telefono.
//
// ⚠️ Le due scritture NON sono equivalenti. Il badge nativo è cosmetico: se
// fallisce, l'utente vede un numero sbagliato sull'icona. `badge_count` no:
// send-reminders lo RILEGGE per calcolare il badge della push successiva, quindi
// se quella scrittura salta il contatore resta disallineato per sempre, e ogni
// notifica futura porta il numero sbagliato. Per questo l'errore si logga invece
// di sparire (CLAUDE.md §9-quater).

/**
 * Allinea il badge dell'icona e `push_subscriptions.badge_count`.
 *
 * Non lancia mai: il badge non deve poter interrompere il flusso che lo chiama.
 * Fuori da iOS non fa niente — su web il badge non esiste.
 *
 * @param conteggio  notifiche non lette
 * @param userId     proprietario delle subscription da aggiornare
 * @param supabase   il client, passato invece che importato per poterlo sostituire nei test
 * @returns true se è stato fatto qualcosa, false se saltato o fallito
 */
export async function sincronizzaBadge(conteggio, userId, supabase) {
  if (!Capacitor.isNativePlatform()) return false
  // Number.isInteger e non `typeof === 'number'`: NaN è un number e NaN < 0 è
  // falso, quindi passava la guardia e finiva dentro Badge.set({ count: NaN }).
  if (!userId || !Number.isInteger(conteggio) || conteggio < 0) return false

  try {
    if (conteggio === 0) await Badge.clear()
    else await Badge.set({ count: conteggio })

    await supabase.from('push_subscriptions')
      .update({ badge_count: conteggio })
      .eq('user_id', userId)
      .eq('auth', 'capacitor_ios')
    return true
  } catch (e) {
    console.warn('Badge non aggiornato:', e)
    return false
  }
}
