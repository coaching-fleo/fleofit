import { createPortal } from 'react-dom'
import { BOTTONE_BRAND, BOTTONE_QUIETO, CARTA_MODALE, TESTO_MODALE, TITOLO_MODALE } from '../lib/stiliCard'

/**
 * La domanda sulla Live Activity, la prima volta che si apre il timer o il
 * telecomando TV (richiesta del committente, 29/10/2026). Una volta sola: poi
 * decide lo switch nelle Impostazioni (src/lib/liveActivity.js).
 *
 * In testa, in piccolo, la Live Activity com'è davvero (design A «Anello»):
 * si capisce cosa si sta attivando prima di leggere il testo.
 */
export default function FoglioLiveActivity({ onAttiva, onNonOra }) {
  return createPortal(
    <div className="fixed inset-0 bg-black/85 z-[150] flex items-center justify-center p-4 velo-in">
      <div role="dialog" aria-modal="true" aria-label="Il timer sul blocco schermo" className={CARTA_MODALE}>
        <Anteprima />
        <h2 className={TITOLO_MODALE}>Il timer sul blocco schermo</h2>
        <p className={TESTO_MODALE}>
          Il tempo che resta e il prossimo esercizio sul blocco schermo e nella Dynamic Island,
          senza sbloccare il telefono. Puoi cambiare idea nelle Impostazioni.
        </p>
        <div className="flex gap-3 mt-2">
          <button onClick={onNonOra} className={BOTTONE_QUIETO}>Non ora</button>
          <button onClick={onAttiva} className={BOTTONE_BRAND}>Attiva</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// Un disegno, non dati: il primo passo di un ON/OFF qualunque.
function Anteprima() {
  return (
    <div aria-hidden="true" className="w-full mb-4 rounded-2xl bg-black/60 border border-white/10 p-3 flex items-center gap-3 text-left">
      <svg width="40" height="40" viewBox="0 0 36 36" className="-rotate-90 shrink-0">
        <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="3" className="text-brand/25" />
        <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"
          strokeDasharray="97.4" strokeDashoffset="30" className="text-brand" />
      </svg>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-black tracking-wider text-white/50">FLEO<span className="text-brand">FIT</span> · HYROX</div>
        <div className="text-sm font-bold text-white truncate">Wall Balls · 20 reps</div>
        <div className="text-[11px] font-semibold text-white/50">Giro 1 di 8</div>
      </div>
      <div className="text-2xl font-bold text-brand tabular-nums">0:28</div>
    </div>
  )
}
