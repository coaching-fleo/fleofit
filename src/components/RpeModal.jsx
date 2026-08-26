// RpeModal, estratto il 26/08/2026 (BACKLOG #19 / CLAUDE.md §9 punto 1).
//
// Era ricopiato in Home, WorkoutDetail e AthleteDetail. Non era un problema estetico:
// è la modale che raccoglie l'RPE, cioè il dato su cui si
// reggono tutte le statistiche dell'atleta. Tre copie sono tre modi di
// perderlo.


import { useState, useEffect, useRef } from 'react'
import { mostraErrore } from '../lib/alert'

export default function RpeModal({ score, onScoreChange, notes, onNotesChange, onSave, onCancel, saving }) {
  const [isFocused, setIsFocused] = useState(false);
  const containerRef = useRef(null);
  const isDragging = useRef(false);
  const blurTimeoutRef = useRef(null);
  const [syncingHealth, setSyncingHealth] = useState(false);

  const handleHealthSync = async () => {
    try {
      setSyncingHealth(true);
      // ⚠️ Import dinamico: il percorso era './health', relativo a src/pages/.
      // Spostando il componente in src/components/ va corretto, o Apple Health
      // smette di funzionare senza errori a compilazione.
      const { HealthService } = await import('../pages/health');
      const data = await HealthService.syncLatestWorkout();
      const textToAppend = `\n\n🍏 [Apple Health] Durata: ${data.duration || '--'} min | Calorie: ${data.calories || '--'} kcal | Battiti Medi: ${data.avgHeartRate || '--'} bpm`;
      onNotesChange(notes ? notes + textToAppend : textToAppend.trim());
    } catch (e) {
      mostraErrore(e.message);
    } finally {
      setSyncingHealth(false);
    }
  };

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
    <div className="fixed inset-0 bg-black/85 z-[150] flex items-center justify-center p-4">
      <div className={`bg-[#1e1e1e] border border-[#2a2a2a] rounded-3xl w-full max-w-sm p-6 flex flex-col shadow-2xl animate-in fade-in zoom-in-[0.96] duration-300 ease-out transition-transform ${isFocused ? '-translate-y-36' : ''}`}>
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
          <div className="flex items-center justify-between mb-2">
            <label className="text-white font-bold text-sm">Note sull'allenamento</label>
            <button 
              onClick={handleHealthSync} 
              disabled={syncingHealth}
              className="text-[11px] flex items-center gap-1 bg-[#2a2a2a] hover:bg-[#333] text-gray-300 px-2 py-1 rounded-lg border border-[#444] transition disabled:opacity-50"
            >
              {syncingHealth ? 'Sincro in corso...' : '🍏 Apple Health'}
            </button>
          </div>
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
          <button onClick={onSave} disabled={saving} className="flex-1 py-3.5 bg-brand text-black font-black rounded-xl hover:brightness-110 transition disabled:opacity-50 shadow-lg shadow-brand/20">{saving ? '...' : 'Fatto! 🎉'}</button>
        </div>
      </div>
    </div>
  )
}
