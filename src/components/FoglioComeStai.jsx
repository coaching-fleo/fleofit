// Il foglio di «Come stai oggi» (13/10/2026): quattro domande da 1 a 5 prima
// di allenarsi. Logica e rete in `src/lib/comeStai.js`.
//
// ⚠️ Deve costare cinque secondi: quattro righe di cinque bottoni, nessun
// campo di testo, nessuna risposta obbligatoria. «Fatto» parte con una sola
// risposta, «Salta» non salva niente e non lo richiede fino a domani.
// La X ha `aria-label="Chiudi"`: è ciò che fa funzionare il tasto indietro di
// Android su questa modale (src/lib/indietroAndroid.js). ⚠️ Chiudere NON è
// saltare: chi preme indietro vuole annullare, quindi niente timer e niente
// «saltato oggi» — la domanda si ripresenterà.

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { DOMANDE } from '../lib/comeStai'
import { vibraScelta } from '../lib/aptica'
import { CARD, BOTTONE_BRAND, BOTTONE_QUIETO, TITOLO_MODALE, TESTO_MODALE } from '../lib/stiliCard'

export default function FoglioComeStai({ onSalva, onSalta, onChiudi }) {
  const [risposte, setRisposte] = useState({})
  const qualcosa = Object.keys(risposte).length > 0

  const scegli = (chiave, valore) => {
    vibraScelta()
    setRisposte(r => ({ ...r, [chiave]: valore }))
  }

  // Non si aspetta la rete: chi la chiama chiude il foglio e fa partire il
  // timer subito, e salva in sottofondo. Con il segnale scarso «non blocca mai»
  // deve restare vero.
  const conferma = () => onSalva(risposte)

  return createPortal(
    <div className="fixed inset-0 bg-black/85 z-[150] flex items-center justify-center p-4 velo-in">
      <div role="dialog" aria-modal="true" aria-label="Come stai oggi?"
        className={`${CARD} w-full max-w-sm p-6 flex flex-col gap-5 modal-transition max-h-[calc(100dvh-2rem)] overflow-y-auto hide-scrollbar`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className={TITOLO_MODALE}>Come stai oggi?</h2>
            <p className={`${TESTO_MODALE} mt-1`}>Cinque secondi, prima di cominciare. Serve al coach per dosare il carico.</p>
          </div>
          <button type="button" aria-label="Chiudi" onClick={onChiudi}
            className="w-9 h-9 rounded-full bg-white/[.06] flex items-center justify-center text-gray-400 hover:text-white shrink-0">
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {DOMANDE.map(d => (
          <div key={d.chiave} role="radiogroup" aria-label={d.titolo} className="flex flex-col gap-2">
            <p className="text-sm font-bold text-white">{d.titolo}</p>
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map(v => {
                const scelto = risposte[d.chiave] === v
                return (
                  <button key={v} type="button" role="radio" aria-checked={scelto}
                    aria-label={`${d.titolo}: ${v} su 5`}
                    onClick={() => scegli(d.chiave, v)}
                    className={`h-11 rounded-xl text-[15px] font-extrabold transition active:scale-95 ${
                      scelto ? 'bg-brand text-black' : 'bg-white/[.06] text-gray-300 hover:bg-white/[.1]'}`}>
                    {v}
                  </button>
                )
              })}
            </div>
            <div className="flex justify-between text-[11px] text-gray-500">
              <span>{d.basso}</span><span>{d.alto}</span>
            </div>
          </div>
        ))}

        <div className="flex gap-3">
          <button type="button" onClick={onSalta} className={BOTTONE_QUIETO}>Salta</button>
          <button type="button" onClick={conferma} disabled={!qualcosa} className={BOTTONE_BRAND}>Fatto</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
