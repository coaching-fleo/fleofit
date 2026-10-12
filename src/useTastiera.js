import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { Keyboard } from '@capacitor/keyboard'

/**
 * Se la tastiera di sistema è aperta.
 *
 * Perché serve, e perché è un hook condiviso: `Keyboard.resize` vale `'native'`
 * (capacitor.config.ts), quindi quando la tastiera sale **la webview si
 * rimpicciolisce**. Tutto ciò che è ancorato in basso — la navbar, la barra
 * «Salva workout» — si ritrova incollato sopra la tastiera, e a schermo sembra
 * che sia «salito in cima»: in realtà è il fondo che si è alzato.
 *
 * Su iOS la tab bar sparisce mentre si scrive, e questa è la stessa risposta:
 * chi usa questo hook si nasconde invece di saltare. Non si può «tenerlo fermo»
 * dov'era, perché quel punto dello schermo, mentre si digita, non esiste più.
 *
 * ⚠️ Sul web torna sempre `false`: là la tastiera non esiste come evento, e la
 * viewport non cambia.
 */
export function useTastieraAperta() {
  const [aperta, setAperta] = useState(false)

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    const handles = []
    const registra = (evento, valore) => {
      const r = Keyboard.addListener(evento, () => setAperta(valore))
      Promise.resolve(r).then(h => h && handles.push(h)).catch(() => {})
    }
    registra('keyboardWillShow', true)
    registra('keyboardWillHide', false)
    return () => { handles.forEach(h => h.remove && h.remove()) }
  }, [])

  return aperta
}

/** Sotto questa misura il «resto» è solo l'area sicura in basso, non tastiera. */
const RESTO_TRASCURABILE = 80

/**
 * Quanti px di tastiera COPRONO ancora la pagina: quelli che la webview non ha
 * già tolto rimpicciolendosi. Nato il 12/10/2026 per il foglio «Da
 * un'immagine», dove «Correggi il testo letto» finiva sotto la tastiera.
 *
 * - 🔴 su iOS è SEMPRE 0: `Keyboard.resize: 'native'` rimpicciolisce già la
 *   webview fino al bordo della tastiera. La prima versione misurava anche lì,
 *   ma `keyboardDidShow` arriva PRIMA che `innerHeight` si aggiorni: la misura
 *   vedeva la finestra intera, e il foglio saliva due volte — a metà schermo,
 *   tagliato (visto sul simulatore il 12/10/2026, segnalato dal committente);
 * - su Android, con lo schermo a tutta altezza (targetSdk 36, edge-to-edge) la
 *   webview NON si rimpicciolisce — `resize` è un'opzione solo iOS, e
 *   `resizeOnFullScreen` non è attiva (docs/memoria/android.md A.4) — e la
 *   tastiera copre tutto il fondo.
 * Su Android si confronta l'altezza della finestra a tastiera chiusa con quella
 * a tastiera aperta: se la webview si è rimpicciolita da sé (Android vecchi, o
 * `resizeOnFullScreen` attivata un giorno), la differenza la sottrae.
 * L'altezza del plugin è in px CSS su tutte e due (su Android: dp).
 *
 * ⚠️ Sul web torna sempre 0.
 */
export function useTastieraCheCopre() {
  const [copre, setCopre] = useState(0)

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() === 'ios') return
    let aChiusa = window.innerHeight
    const handles = []
    const registra = (evento, fn) => {
      const r = Keyboard.addListener(evento, fn)
      Promise.resolve(r).then(h => h && handles.push(h)).catch(() => {})
    }
    registra('keyboardDidShow', (info) => {
      const giaTolta = Math.max(0, aChiusa - window.innerHeight)
      const resto = Math.round((info?.keyboardHeight || 0) - giaTolta)
      setCopre(resto > RESTO_TRASCURABILE ? resto : 0)
    })
    registra('keyboardWillHide', () => setCopre(0))
    registra('keyboardDidHide', () => { aChiusa = window.innerHeight })
    return () => { handles.forEach(h => h.remove && h.remove()) }
  }, [])

  return copre
}

/**
 * Invio chiude la tastiera invece di non fare niente.
 *
 * Su un campo singolo dentro una pagina senza `<form>`, il tasto invio della
 * tastiera iOS non ha nessun effetto: l'utente lo preme, non succede niente, e
 * deve toccare fuori dal campo per riavere lo schermo. Va messo insieme a
 * `enterKeyHint="done"`, che cambia anche l'etichetta del tasto.
 */
export const chiudiTastieraSuInvio = (e) => {
  if (e.key === 'Enter') {
    e.preventDefault()
    e.currentTarget.blur()
  }
}
