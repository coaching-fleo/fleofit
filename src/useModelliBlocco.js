import { useState, useEffect } from 'react'
import { elencoModelli } from './lib/modelliBloccoDb'

// I modelli di una categoria, letti all'apertura e quando la categoria cambia.
// Con `categoria === null` non legge niente (`caricato` resta false). Un
// risultato che arriva dopo lo smontaggio o dopo un cambio di categoria si
// ignora.
export function useModelliBlocco(categoria) {
  const [stato, setStato] = useState({ modelli: [], caricato: false, errore: false })

  useEffect(() => {
    if (categoria === null) return undefined
    let vivo = true
    elencoModelli(categoria)
      .then(modelli => { if (vivo) setStato({ modelli, caricato: true, errore: false }) })
      .catch(() => { if (vivo) setStato({ modelli: [], caricato: true, errore: true }) })
    return () => { vivo = false }
  }, [categoria])

  return categoria === null ? { modelli: [], caricato: false, errore: false } : stato
}
