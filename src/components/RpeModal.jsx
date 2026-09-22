// RpeModal, estratto il 26/08/2026 (BACKLOG #19 / CLAUDE.md §9 punto 1).
//
// Era ricopiato in Home, WorkoutDetail e AthleteDetail. Non era un problema estetico:
// è la modale che raccoglie l'RPE, cioè il dato su cui si
// reggono tutte le statistiche dell'atleta. Tre copie sono tre modi di
// perderlo.


import { useState, useEffect, useRef } from 'react'
import { Puntini } from './Puntini'
import { CARD } from '../lib/stiliCard'

export default function RpeModal({ score, onScoreChange, notes, onNotesChange, onSave, onCancel, saving }) {
  const [isFocused, setIsFocused] = useState(false);
  const containerRef = useRef(null);
  const isDragging = useRef(false);
  const blurTimeoutRef = useRef(null);

  const calculateValue = (clientX) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    let x = clientX - rect.left;
    if (x < 0) x = 0;
    if (x > rect.width) x = rect.width;
    
    let newValue = Math.ceil((x / rect.width) * 10);
    if (newValue < 1) newValue = 1;
    if (newValue > 10) newValue = 10;
    
    if (String(newValue) !== String(score)) {
      onScoreChange(String(newValue));
    }
  };

  const handlePointerDown = (e) => {
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }
    isDragging.current = true;
    const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
    calculateValue(clientX);
  };

  const handlePointerMove = (e) => {
    if (!isDragging.current) return;
    const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
    calculateValue(clientX);
  };

  useEffect(() => {
    const handlePointerUp = () => { isDragging.current = false; };
    document.addEventListener('mouseup', handlePointerUp);
    document.addEventListener('touchend', handlePointerUp);
    return () => {
      document.removeEventListener('mouseup', handlePointerUp);
      document.removeEventListener('touchend', handlePointerUp);
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    };
  }, []);

  const getRpeColor = (val) => {
    if (val <= 3) return 'bg-green-500';
    if (val <= 6) return 'bg-yellow-400';
    if (val <= 8) return 'bg-orange-500';
    return 'bg-red-500';
  }
  const getRpeLabel = (val) => {
    if (val <= 3) return 'Molto leggero 🟢';
    if (val <= 6) return 'Moderato 🟡';
    if (val <= 8) return 'Impegnativo 🟠';
    return 'Massimale 🔴';
  }
  return (
    <div className="fixed inset-0 bg-black/85 z-[150] flex items-center justify-center p-4 velo-in">
      <div className={`${CARD} w-full max-w-sm p-6 flex flex-col modal-transition transition-transform ${isFocused ? '-translate-y-36' : ''}`}>
        <h2 className="text-2xl font-black text-white mb-2 tracking-tight">Com'è andata?</h2>
        <p className="text-gray-400 text-sm mb-6">Valuta lo sforzo percepito (RPE) e aggiungi eventuali note per il coach.</p>
        <div className="flex flex-col gap-2 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-white font-bold">Sforzo: {score}/10</span>
            <span className={`text-xs font-bold px-2 py-1 rounded-lg text-black ${getRpeColor(parseInt(score))}`}>
              {getRpeLabel(parseInt(score))}
            </span>
          </div>
          <div 
            ref={containerRef}
            className="flex items-center gap-1 w-full cursor-pointer touch-none select-none"
            onMouseDown={handlePointerDown}
            onMouseMove={handlePointerMove}
            onTouchStart={handlePointerDown}
            onTouchMove={handlePointerMove}
          >
            {Array.from({ length: 10 }, (_, i) => i + 1).map(s => {
              const isActive = s <= parseInt(score);
              let color = 'bg-[#333]';
              if (isActive) color = getRpeColor(parseInt(score));
              return (
                <div
                  key={s}
                  className={`flex-1 h-10 rounded-lg transition-all duration-75 ${color} ${isActive ? 'shadow-md scale-105' : ''}`}
                  style={{ pointerEvents: 'none' }}
                />
              )
            })}
          </div>
          <div className="flex justify-between items-center text-[11px] font-bold uppercase tracking-wider text-muted mt-1">
            <span>Leggero</span>
            <span>Estremo</span>
          </div>
        </div>
        <div className="mb-6">
          <label className="block text-white font-bold text-sm mb-2">Note sull'allenamento</label>
          <textarea
            className="w-full bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-brand resize-none text-base transition-colors"
            rows={3}
            placeholder="Sensazioni, pesi usati, dolori..."
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            onFocus={() => {
              if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
              setIsFocused(true);
            }}
            onBlur={() => {
              blurTimeoutRef.current = setTimeout(() => {
                setIsFocused(false);
              }, 250);
            }}
          />
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={saving} className="flex-1 py-3.5 bg-[#2a2a2a] text-white font-semibold rounded-xl hover:bg-[#333] transition disabled:opacity-50">Annulla</button>
          {/* ⚠️ Si contrae invece di spegnersi: il salvataggio passa per la rete
              e, offline, per la coda. Un bottone spento con «...» dentro si
              legge come «non ha funzionato», e il gesto che ne segue è premere
              di nuovo — che qui vuol dire accodare due volte lo stesso
              completamento. Il perché della forma sta in src/index.css.
              ⚠️ `max-w-[100vw]`: da `none` il CSS non sa interpolare e il
              bottone salterebbe alla pillola invece di contrarsi. */}
          <button onClick={onSave} disabled={saving} aria-busy={saving || undefined}
            className={`relative flex-1 max-w-[100vw] py-3.5 bg-brand text-black font-black rounded-xl
                        hover:brightness-110 overflow-hidden shadow-lg shadow-brand/20
                        transition-[max-width,border-radius,filter] duration-[570ms] ease-[cubic-bezier(.33,1,.68,1)]
                        ${saving ? 'cta-contratta' : 'disabled:opacity-50'}`}>
            <span className={`block whitespace-nowrap transition-opacity duration-150 ${saving ? 'opacity-0' : 'opacity-100'}`}>Fatto! 🎉</span>
            {saving && <span className="absolute inset-0 flex items-center justify-center"><Puntini /></span>}
          </button>
        </div>
      </div>
    </div>
  )
}
