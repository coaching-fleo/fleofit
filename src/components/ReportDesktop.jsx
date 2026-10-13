// La testata dei due report sulla versione desktop (solo coach, src/useDesktop.js).
//
// Sul telefono la testata è una barra `sticky` con la freccia «indietro» e
// quattro bottoni tondi stretti in 375px. Sul desktop c'è la barra laterale:
// la freccia non serve, e la settimana sta accanto al titolo invece che sotto.
// Il resto della pagina usa gli stessi componenti del telefono, disposti su
// colonne dalla pagina stessa.

import { ChevronLeft, ChevronRight, User, Plus } from 'lucide-react'

const TONDO = 'w-10 h-10 rounded-full bg-[#1e1e1e] border border-[#2a2a2a] flex items-center justify-center text-white transition hover:border-[#444] disabled:opacity-30 disabled:pointer-events-none'

export function TestataReportDesktop({
  sopratitolo = 'Report', titolo, foto, settimana, avanti, onPrecedente, onSuccessiva, onScheda, onCrea,
}) {
  return (
    <header className="pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-2 flex flex-wrap items-end justify-between gap-4">
      <div className="flex items-center gap-4 min-w-0">
        {foto !== undefined && (
          <span className="w-14 h-14 rounded-full bg-[#2a2a2a] overflow-hidden shrink-0 flex items-center justify-center text-gray-400">
            {foto
              ? <img src={foto} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.style.opacity = 0 }} />
              : <User size={22} aria-hidden="true" />}
          </span>
        )}
        <div className="min-w-0">
          {sopratitolo !== titolo && <p className="text-xs font-bold uppercase tracking-wider text-gray-500">{sopratitolo}</p>}
          <h1 className="text-3xl font-black tracking-tight text-white truncate">{titolo}</h1>
          <p className="text-sm text-gray-400 mt-1">{settimana}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {onScheda && (
          <button type="button" onClick={onScheda}
            className="h-10 px-4 rounded-xl border border-[#333] text-sm font-bold text-gray-300 hover:text-white flex items-center gap-2">
            <User size={15} aria-hidden="true" /> Scheda atleta
          </button>
        )}
        {onCrea && (
          <button type="button" onClick={onCrea}
            className="h-10 px-4 rounded-xl bg-brand text-black text-sm font-bold hover:brightness-110 flex items-center gap-2">
            <Plus size={16} strokeWidth={2.6} aria-hidden="true" /> Crea workout
          </button>
        )}
        <span className="w-px h-6 bg-[#2a2a2a] mx-1" aria-hidden="true" />
        <button type="button" onClick={onPrecedente} aria-label="Settimana precedente" className={TONDO}>
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <button type="button" onClick={onSuccessiva} disabled={!avanti} aria-label="Settimana successiva" className={TONDO}>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>
    </header>
  )
}
