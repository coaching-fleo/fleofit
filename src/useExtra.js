import { useEffect, useMemo, useState } from 'react'
import { useAuth } from './App'
import { statoFunzione, statoNoto, funzioneVisibile } from './lib/funzioniApp'
import { EXTRA, ruoloExtra } from './lib/extra'

/**
 * Gli extra accesi per chi usa l'app, nell'ordine del registro (src/lib/extra.js).
 * `null` finché gli interruttori non sono letti: chi lo usa non mostra niente nel
 * frattempo, così una voce non compare per poi sparire. Il ruolo è quello
 * dell'interfaccia: un admin che simula l'atleta vede da atleta.
 */
export function useExtra() {
  const { role } = useAuth() || {}
  // Se gli interruttori sono già stati letti in questo avvio si parte da lì:
  // senza, ogni rimontaggio passava un fotogramma da `null` (la Libreria tornando
  // da un extra mostrava i Workout e poi saltava su Extra).
  const [stati, setStati] = useState(() => {
    const s = EXTRA.map(e => statoNoto(e.interruttore))
    return s.every(x => x !== null) ? s : null
  })
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
