import { useState, useEffect } from 'react'
import { elencoModelli } from './lib/modelliBloccoDb'

// I modelli di una categoria, letti all'apertura e quando la categoria cambia.
// Con `categoria === null` non legge niente (`caricato` resta false). Un
// risultato che arriva dopo lo smontaggio o dopo un cambio di categoria si
// ignora. Lo stato ricorda per quale categoria è stato letto: cambiando
// categoria non si mostra, nemmeno per un attimo, la lista di quella di prima.
const VUOTO = { modelli: [], caricato: false, errore: false }

export function useModelliBlocco(categoria) {
  const [stato, setStato] = useState({ ...VUOTO, per: null })

  useEffect(() => {
    if (categoria === null) return undefined
    let vivo = true
    elencoModelli(categoria)
      .then(modelli => { if (vivo) setStato({ modelli, caricato: true, errore: false, per: categoria }) })
      .catch(() => { if (vivo) setStato({ modelli: [], caricato: true, errore: true, per: categoria }) })
    return () => { vivo = false }
  }, [categoria])

  if (categoria === null || stato.per !== categoria) return VUOTO
  const { modelli, caricato, errore } = stato
  return { modelli, caricato, errore }
}
