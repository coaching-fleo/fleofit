import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

/**
 * Il gesto «torna indietro», uno per tutta l'app.
 *
 * 🔴 **Non è `navigate(-1)` e non è una destinazione fissa: sono i due modi
 * sbagliati, e l'app li aveva entrambi.**
 *
 * - Una **destinazione fissa** (`navigate('/athletes')`) ignora da dove si
 *   viene: si apre un atleta dai feedback della Home coach e il tasto indietro
 *   porta nella rubrica, cioè in una schermata in cui non si è mai stati.
 *   Era il caso di `AthleteDetail`, `AthleteReport` e `WeeklyReport`.
 * - `navigate(-1)` **nudo** è giusto quasi sempre, e non fa niente nell'unico
 *   caso in cui il tasto è indispensabile: quando la pagina è la **prima**
 *   della sessione — aperta da una notifica push (`notifications.route`), da un
 *   deep link `fleofit://` o da una ricarica della webview. Lì dietro non c'è
 *   nessuna pagina dell'app: sul web si esce dal sito, nella webview il tocco
 *   non produce niente e si legge come un tasto rotto.
 *
 * Quindi: si torna alla pagina precedente **quando esiste**, e al ripiego
 * dichiarato dalla pagina quando non esiste.
 *
 * ⚠️ **`key === 'default'` è il modo di saperlo, e non ce n'è un altro.**
 * React Router marca così la prima voce della propria history — quella con cui
 * l'app si è avviata. `window.history.length` non serve: conta anche le pagine
 * di altri siti visitate prima nella stessa scheda, quindi direbbe «c'è
 * qualcosa dietro» proprio quando quel qualcosa non è nostro.
 *
 * ⚠️ Il ripiego usa `replace`: è una pagina in cui non si è entrati, e
 * lasciarla nella pila vorrebbe dire che un secondo indietro ci riporta dentro.
 *
 * @param {string} ripiego dove andare quando dietro non c'è niente dell'app.
 */
export function useIndietro(ripiego = '/') {
  const navigate = useNavigate()
  const { key } = useLocation()

  return useCallback(() => {
    if (key === 'default') navigate(ripiego, { replace: true })
    else navigate(-1)
  }, [key, navigate, ripiego])
}
