import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle } from '@capacitor/haptics'

/**
 * Il colpetto secco a ogni scatto di un picker o di uno slider.
 *
 * Era copiato identico in `ScrollPicker` e `IntensityPicker`, e la ruota dei
 * passi ne sarebbe stata la **terza** copia: è il modo in cui una correzione
 * ne raggiunge due su tre (CLAUDE.md §9 punto 1).
 *
 * ⚠️ Il `try/catch` non è pigrizia ed è deliberatamente muto: l'azione che
 * l'aptica accompagna è **già stata applicata**: se la vibrazione non parte —
 * plugin assente, telefono in silenzioso, browser senza `vibrate` — non c'è
 * niente da riparare e niente da dire all'utente.
 */
export const battito = () => {
  try {
    if (Capacitor.isNativePlatform()) {
      Haptics.impact({ style: ImpactStyle.Light }).catch(() => {})
    } else if (navigator.vibrate) {
      navigator.vibrate(10)
    }
  } catch { /* feedback opzionale: l'azione è già stata applicata */ }
}
