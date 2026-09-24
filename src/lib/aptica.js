import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'

/**
 * Il vocabolario aptico dell'app: SEI verbi, e ognuno vuol dire una cosa sola.
 *
 * Il criterio con cui si sceglie dove vibrare, prima dei verbi:
 * **il dito sente ciò che l'occhio potrebbe perdersi, o ciò che non si può più
 * disfare.** Un gradino passato mentre si trascina, una scelta cambiata, un
 * esito — riuscito o fallito — e un oggetto afferrato. NON si vibra sulla
 * navigazione (la tab bar di iOS non vibra, e un'app che ronza a ogni tocco
 * insegna a non badarci più), né sull'apertura di un foglio o di una conferma.
 *
 * | verbo           | generatore iOS               | quando                                              |
 * |-----------------|------------------------------|-----------------------------------------------------|
 * | `battito`       | impatto Light                | un gradino: picker, slider, ±, soglia di un gesto   |
 * | `vibraScelta`   | selezione                    | una voce fra pari: chip, segmenti, interruttori     |
 * | `vibraPresa`    | impatto Medium               | qualcosa si afferra o parte: drag, microfono, swipe |
 * | `vibraSuccesso` | notifica Success             | è andato a buon fine: salvato, assegnato, completato|
 * | `vibraErrore`   | notifica Error               | non è andato: un rifiuto, un guasto                 |
 * | `vibraRichiamo` | notifica Warning (due colpi) | qualcuno ti chiama durante l'allenamento            |
 *
 * ⚠️ **Il prefisso `vibra` non è ornamento.** `scelta`, `errore` e `successo`
 * sono nomi che questo progetto usa già ovunque — una prop del recap, una
 * funzione locale di `CreateWorkout`, una costante di `CustomAlert` — e un
 * import che si chiama come una variabile locale viene ombreggiato in
 * silenzio: il tocco chiama la cosa sbagliata, o una stringa. È successo
 * scrivendo questo file. `battito` resta com'è: è più vecchio e non collide.
 *
 * ⚠️ **`vibraSuccesso` non si accompagna a un alert «Fatto»**: quello vibra già da
 * sé (`CustomAlert`). Chiamarla anche prima vorrebbe dire due notifiche in fila
 * per lo stesso esito, che al polso si leggono come un errore.
 *
 * ⚠️ **`navigator.vibrate` su iPhone NON ESISTE** — né in Safari né nel
 * WKWebView. È un ripiego per il web su Android e basta: due punti dell'app
 * (la presa del drag&drop e le reazioni della Live Coach Cam) lo usavano come
 * UNICA vibrazione, e su iOS non avevano mai vibrato.
 *
 * ⚠️ Il `try/catch` non è pigrizia ed è deliberatamente muto: l'azione che
 * l'aptica accompagna è **già stata applicata**. Se la vibrazione non parte —
 * plugin assente, «Feedback aptico di sistema» spento nelle Impostazioni di
 * iOS, browser senza `vibrate` — non c'è niente da riparare e niente da dire.
 * Quell'interruttore di sistema, del resto, iOS lo rispetta da solo: non serve
 * una preferenza nostra.
 */
const esegui = (nativo, webMs) => {
  try {
    if (Capacitor.isNativePlatform()) {
      const p = nativo()
      if (p && typeof p.catch === 'function') p.catch(() => {})
    } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(webMs)
    }
  } catch { /* feedback opzionale: l'azione è già stata applicata */ }
}

/** Un gradino: ogni scatto di un picker, di uno slider o di un ±. */
export const battito = () => esegui(() => Haptics.impact({ style: ImpactStyle.Light }), 10)

/** Qualcosa si afferra o parte: la presa del drag, il microfono che si accende. */
export const vibraPresa = () => esegui(() => Haptics.impact({ style: ImpactStyle.Medium }), 25)

/** Un lavoro è andato a buon fine. */
export const vibraSuccesso = () => esegui(() => Haptics.notification({ type: NotificationType.Success }), [15, 60, 25])

/** Non è andato. */
export const vibraErrore = () => esegui(() => Haptics.notification({ type: NotificationType.Error }), [30, 50, 30, 50, 30])

/**
 * Qualcuno ti chiama mentre ti alleni: una reazione o un vocale del coach.
 * È il generatore «Warning» per il suo DISEGNO — due colpi netti, che si
 * sentono col telefono in tasca — non per il significato: non avvisa di
 * nessun problema.
 */
export const vibraRichiamo = () => esegui(() => Haptics.notification({ type: NotificationType.Warning }), [100, 50, 100])

// 🔴 Sul plugin iOS `selectionChanged()` NON FA NIENTE se prima non c'è stato
// un `selectionStart()`: il generatore nasce lì, e senza resta `nil`
// (node_modules/@capacitor/haptics/ios/.../Haptics.swift). Nessun errore, e
// nessuna vibrazione. Lo si prepara una volta e lo si tiene: `selectionEnd`
// servirebbe solo a liberarlo, e qui lo si usa per tutta la sessione.
let selezionePronta = false

/** Una voce fra pari è cambiata: chip, segmenti, interruttori, il giorno. */
export const vibraScelta = () => esegui(() => {
  if (!selezionePronta) {
    selezionePronta = true
    Haptics.selectionStart().catch(() => { selezionePronta = false })
  }
  return Haptics.selectionChanged()
}, 8)

/** Solo per i test: il generatore di selezione torna da preparare. */
export const _azzeraSelezione = () => { selezionePronta = false }
