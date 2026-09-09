// Il segnale dell'ambiente di prova.
//
// ⚠️ Non è decorazione: l'app di prova e quella vera sono IDENTICHE a schermo, e
// confondersi vuol dire credere di aver assegnato qualcosa a un atleta vero (o
// il contrario). Sta sopra tutto, anche sopra le modali (che salgono a z-150).
//
// ⚠️ Si apre largo e dopo qualche secondo si ritira in una pillola: a schermo
// intero coprirebbe la prima riga dell'intestazione — la data e il conteggio
// atleti — e questo ambiente serve anche a GUARDARE le schermate, non solo a
// cliccarle. Un nastro che nasconde ciò che si è venuti a vedere è un nastro
// che si finisce per togliere.
//
// Si monta solo con VITE_DEMO=1 (src/main.jsx): in una build normale il ramo è
// morto e questo file non entra nel bundle.

import { useEffect, useState } from 'react'
import { azzeraDemo } from './supabaseDemo'

const SECONDI_APERTO = 4

export default function DemoBadge() {
  const [aperto, setAperto] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setAperto(false), SECONDI_APERTO * 1000)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="fixed top-0 left-0 z-[200] pointer-events-none"
         style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div
        onClick={() => setAperto(a => !a)}
        className={`pointer-events-auto flex items-center gap-2 cursor-pointer select-none
                    bg-brand text-black shadow-lg transition-all duration-300 ease-out
                    ${aperto ? 'px-3 py-1 rounded-br-xl' : 'px-1.5 py-0.5 rounded-br-lg'}`}>
        <span className={`font-black uppercase tracking-[.09em] whitespace-nowrap
                          ${aperto ? 'text-[10px]' : 'text-[8px]'}`}>
          {aperto ? 'Ambiente di prova · dati finti' : 'Prova'}
        </span>
        {aperto && (
          <button
            onClick={(e) => { e.stopPropagation(); azzeraDemo(); location.href = '/' }}
            className="text-[10px] font-black uppercase tracking-[.06em] underline underline-offset-2">
            Azzera
          </button>
        )}
      </div>
    </div>
  )
}
