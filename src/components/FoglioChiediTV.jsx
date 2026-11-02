import { createPortal } from 'react-dom'
import { X, MonitorUp } from 'lucide-react'
import { separaCodice } from '../lib/codiceWorkout'

// «Vuoi mandare in TV questo?» — la domanda della scheda workout quando il QR
// della TV è stato inquadrato con la fotocamera di sistema MENTRE la scheda era
// aperta (`?tv=<codice>&chiedi=1`, rottaDaLinkTV in src/lib/linkTimer.js).
// Ruling 7 della spec 2026-11-02-tv-qr-scelta-workout: prima si andava a
// /collega-tv, che smontava la scheda e azzerava il timer in corso.
//
// 🔴 z-[250]: sta sopra il timer a tutto schermo (z-[200] in WorkoutDetail),
// sotto la reazione del timer (z-[300]).
//
// La X (`aria-label="Chiudi"`) chiude e basta: il tasto indietro di Android la
// usa (src/lib/indietroAndroid.js).

export default function FoglioChiediTV({ titolo, onSi, onAltro, onChiudi }) {
  const nome = separaCodice(titolo).nome || 'Senza titolo'
  const bottoneGrande = 'w-full min-h-[56px] flex items-center justify-center gap-2.5 rounded-2xl font-bold text-[16px] transition active:scale-[.98]'

  return createPortal(
    <div className="fixed inset-0 z-[250] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/70 velo-in" onClick={onChiudi} />
      <div role="dialog" aria-modal="true" aria-labelledby="chiedi-tv-titolo"
        className="relative bg-[#1e1e1e] border-t border-[#2a2a2a] rounded-t-3xl px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] max-h-[85dvh] overflow-y-auto sheet-in">
        <div className="w-10 h-1 rounded-full bg-[#383838] mx-auto mb-4" aria-hidden="true" />
        <div className="flex items-start justify-between gap-4">
          <h3 id="chiedi-tv-titolo" className="text-xl font-black tracking-tight text-white flex items-center gap-2 min-w-0">
            <MonitorUp size={22} className="text-brand shrink-0" aria-hidden="true" /> Vuoi mandare in TV questo?
          </h3>
          <button aria-label="Chiudi" onClick={onChiudi}
            className="shrink-0 w-11 h-11 -mr-1 rounded-full bg-[#2a2a2a] flex items-center justify-center text-gray-300 hover:text-white">
            <X size={20} />
          </button>
        </div>
        <div className="mt-4 rounded-2xl bg-[#111111] border border-[#333] px-4 py-3.5">
          <span className="block text-lg font-black tracking-tight text-white truncate">{nome}</span>
        </div>
        <div className="mt-4 flex flex-col gap-3">
          <button onClick={onSi} className={`${bottoneGrande} bg-brand text-black hover:brightness-110`}>Sì</button>
          <button onClick={onAltro} className={`${bottoneGrande} bg-[#2a2a2a] text-white hover:bg-[#333]`}>No, un altro</button>
        </div>
      </div>
    </div>,
    document.body
  )
}
