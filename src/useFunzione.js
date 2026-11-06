import { useEffect, useState } from 'react'
import { useAuth } from './App'
import { statoFunzione, funzioneVisibile } from './lib/funzioniApp'

/**
 * La funzione `nome` è accesa per chi usa l'app? `null` finché non si sa
 * (chi la usa non mostra niente nel frattempo), poi `true` o `false`.
 * Lo stato viene da `funzioni_app` (src/lib/funzioniApp.js).
 */
export function useFunzione(nome) {
  const { role } = useAuth() || {}
  const [stato, setStato] = useState(null)
  useEffect(() => {
    let vivo = true
    statoFunzione(nome).then(s => { if (vivo) setStato(s) })
    return () => { vivo = false }
  }, [nome])
  return stato === null ? null : funzioneVisibile(stato, role)
}
