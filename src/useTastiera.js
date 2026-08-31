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
