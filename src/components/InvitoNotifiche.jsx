import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { App } from '@capacitor/app'
// Pigro: il foglio serve a pochi e di rado, e InvitoNotifiche sta nel chunk
// d'ingresso (CLAUDE.md §2, il peso di `index`).
const FoglioNotifiche = lazy(() => import('./FoglioNotifiche'))
import {
  EVENTO_MOMENTO, statoPermesso, chiediPermesso, apriImpostazioniTelefono,
} from '../lib/permessoNotifiche'
import { rinfrescaTokenPush } from '../lib/pushToken'
import {
  azzera, deveChiedere, dopoMai, dopoNonOra, leggiStato, mostraMai, scriviStato, usaApertura,
} from '../lib/promemoriaNotifiche'

// Chi propone le notifiche a chi non le ha (19/11/2026, progetto in
// docs/superpowers/specs/2026-11-19-promemoria-notifiche-design.md).
//
// Montato UNA volta in ProtectedRoute. Non decide il momento: aspetta
// l'evento `pushfit:momento-notifiche`, che lanciano la Home dell'atleta (ha un
// workout assegnato) e le assegnazioni del coach. Al massimo una volta per
// apertura dell'app (`usaApertura`).

export default function InvitoNotifiche({ userId }) {
  const [foglio, setFoglio] = useState(null) // { ruolo, negate, mai }
  const ritorno = useRef(null)

  useEffect(() => {
    // L'atleta lo riceve solo sulla Home: la risposta della rete può arrivare
    // quando è già entrato nell'allenamento, e «mai durante il timer» vale.
    const fuoriPosto = (ruolo) => ruolo !== 'coach' && window.location.pathname !== '/'
    const momento = async (e) => {
      const ruolo = e.detail?.ruolo === 'coach' ? 'coach' : 'athlete'
      if (fuoriPosto(ruolo)) return
      // Il turno si prende PRIMA di aspettare il permesso: due momenti di fila
      // (assegnazione multipla, Home rimontata) devono dare un foglio solo.
      if (!usaApertura()) return
      const permesso = await statoPermesso()
      if (permesso === 'attive') { azzera(); return }
      if (permesso === 'non-disponibile') return
      const stato = leggiStato()
      if (!deveChiedere(stato, new Date()) || fuoriPosto(ruolo)) return
      setFoglio({ ruolo, negate: permesso === 'negate', mai: mostraMai(stato) })
    }
    window.addEventListener(EVENTO_MOMENTO, momento)
    return () => {
      window.removeEventListener(EVENTO_MOMENTO, momento)
      ritorno.current?.remove?.()
    }
  }, [])

  if (!foglio) return null

  const nonOra = () => { scriviStato(dopoNonOra(leggiStato(), new Date())); setFoglio(null) }
  const mai = () => { scriviStato(dopoMai(leggiStato())); setFoglio(null) }

  const attiva = async () => {
    setFoglio(null)
    if (!foglio.negate) {
      if (await chiediPermesso(userId)) azzera()
      else scriviStato(dopoNonOra(leggiStato(), new Date()))
      return
    }
    // Negate: si va nelle Impostazioni del telefono e si guarda al ritorno.
    const handle = await App.addListener('appStateChange', async ({ isActive }) => {
      if (!isActive) return
      handle.remove?.()
      ritorno.current = null
      if (await statoPermesso() === 'attive') {
        await rinfrescaTokenPush(userId)
        azzera()
      } else {
        scriviStato(dopoNonOra(leggiStato(), new Date()))
      }
    }).catch(() => null)
    ritorno.current = handle
    await apriImpostazioniTelefono()
  }

  return (
    <Suspense fallback={null}>
      <FoglioNotifiche ruolo={foglio.ruolo} negate={foglio.negate} mostraMai={foglio.mai}
        onAttiva={attiva} onNonOra={nonOra} onMai={mai} />
    </Suspense>
  )
}
