import { useEffect, useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { Check, Smartphone } from 'lucide-react'
import { Guscio, Marchio, CtaGialla } from '../components/LoginUI'
import { normalizzaCodice, codiceCompleto } from '../lib/codiceInvito'
import {
  dispositivo, loginConCodice, intentAndroid, linkApp, urlAppStore, urlPlayStore, SITO,
} from '../lib/linkInvito'

/**
 * La pagina ponte del link d'invito: `/invito/<codice>` (dal 16/11/2026).
 *
 * - PC → prosegue sul sito, sulla card dell'invito (come il vecchio `?invite=`).
 * - Android → prova SUBITO ad aprire l'app con l'intent di Chrome; senza app
 *   Chrome va al Play Store (con il codice nel referrer) o, finché l'app non è
 *   pubblicata, al sito.
 * - iPhone → con l'app installata e l'universal link attivo questa pagina non
 *   si vede nemmeno. Altrimenti: «Scarica l'app» copia il codice e apre App
 *   Store; al primo avvio basta «Incolla dagli appunti».
 *
 * ⚠️ Su iPhone niente `fleofit://` automatico: senza app Safari mostra un
 * errore «indirizzo non valido». Si offre solo come bottone «Ho già l'app».
 *
 * Design: docs/superpowers/specs/2026-11-16-link-invito-design.md.
 */
export default function Invito() {
  const { codice: grezzo } = useParams()
  const codice = normalizzaCodice(grezzo || '')
  const [copiato, setCopiato] = useState(false)

  const dove = useMemo(() => (
    typeof navigator === 'undefined' ? 'desktop' : dispositivo(navigator.userAgent, navigator.maxTouchPoints || 0)
  ), [])
  const nativa = Capacitor.isNativePlatform()
  const sito = `${SITO}${loginConCodice(codice)}`

  // Android: l'intent parte da solo, la pagina resta come rete di sicurezza
  // (per esempio dentro un browser che non capisce gli intent).
  useEffect(() => {
    if (nativa || dove !== 'android' || !codiceCompleto(codice)) return
    window.location.href = intentAndroid(codice, urlPlayStore(codice) || sito)
  }, [nativa, dove, codice, sito])

  // Nell'app o dal PC, e con un codice monco: la pagina di sempre.
  if (nativa || dove === 'desktop' || !codiceCompleto(codice)) {
    return <Navigate to={loginConCodice(codice)} replace />
  }

  const store = dove === 'ios' ? urlAppStore() : urlPlayStore(codice)

  const scarica = async () => {
    // Gli appunti si scrivono solo dentro il tocco: per questo è un bottone.
    try { await navigator.clipboard.writeText(codice); setCopiato(true) } catch { /* resta il codice a schermo */ }
    window.location.href = store
  }

  const apriApp = () => {
    window.location.href = dove === 'android' ? intentAndroid(codice, sito) : linkApp(codice)
  }

  return (
    <Guscio>
      <div className="flex-1 flex flex-col justify-center gap-8 max-w-[420px] w-full mx-auto">
        <Marchio />

        <div className="rounded-3xl bg-[#1e1e1e] border border-[#2a2a2a] p-6 flex flex-col items-center gap-3 text-center">
          <p className="text-[19px] font-black tracking-tight text-white">Il tuo coach ti ha invitato</p>
          <p className="text-[13px] font-bold uppercase tracking-[.16em] text-gray-500">Il tuo codice</p>
          <p className="text-[30px] font-black tracking-[.18em] text-brand select-text">{codice.slice(0, 4)}-{codice.slice(4)}</p>
          {store && (
            <p className="text-[13.5px] text-gray-400 leading-snug">
              Scarica l'app: il codice viene copiato, e alla prima apertura basta toccare
              <b className="text-gray-300"> «Incolla dagli appunti»</b>.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3">
          {store && (
            <CtaGialla
              etichetta={copiato ? <><Check size={18} /> Codice copiato</> : (dove === 'ios' ? "Scarica l'app da App Store" : "Scarica l'app da Google Play")}
              onClick={scarica} />
          )}
          <button
            type="button" onClick={apriApp}
            className="w-full rounded-2xl p-4 flex items-center justify-center gap-2.5 bg-surface2 border border-[#383838] text-white font-bold text-[15.5px] hover:bg-[#333] transition"
          >
            <Smartphone size={18} className="text-gray-400" />
            Ho già l'app: aprila
          </button>
          <a href={loginConCodice(codice)} className="text-center text-[14px] font-bold text-gray-400 underline underline-offset-4 py-2">
            Continua sul sito
          </a>
        </div>
      </div>
    </Guscio>
  )
}
