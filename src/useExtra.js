import { useEffect, useMemo, useState } from 'react'
import { useAuth } from './App'
import { statoFunzione, funzioneVisibile } from './lib/funzioniApp'
import { EXTRA, ruoloExtra } from './lib/extra'

/**
 * Gli extra accesi per chi usa l'app, nell'ordine del registro (src/lib/extra.js).
 * `null` finché gli interruttori non sono letti: chi lo usa non mostra niente nel
 * frattempo, così una voce non compare per poi sparire. Il ruolo è quello
 * dell'interfaccia: un admin che simula l'atleta vede da atleta.
 */
export function useExtra() {
  const { role } = useAuth() || {}
  const [stati, setStati] = useState(null)
  useEffect(() => {
    let vivo = true
    Promise.all(EXTRA.map(e => statoFunzione(e.interruttore)))
      .then(s => { if (vivo) setStati(s) })
    return () => { vivo = false }
  }, [])
  // Memorizzato: chi lo mette fra le dipendenze di un effetto non deve ripartire a ogni render.
  return useMemo(() => {
    if (stati === null) return null
    const r = ruoloExtra(role)
    return EXTRA.filter((e, i) => e.ruoli.includes(r) && funzioneVisibile(stati[i], role))
  }, [stati, role])
}
