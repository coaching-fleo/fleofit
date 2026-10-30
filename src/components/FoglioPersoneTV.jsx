import { createPortal } from 'react-dom'
import { X, Plus, Minus, Trash2, Users } from 'lucide-react'
import { aggiungiPersona, MAX_PERSONE } from '../lib/personeTV'
import { vibraScelta } from '../lib/aptica'

// Il foglio «Persone» del telecomando TV (30/10/2026): chi fa l'allenamento
// insieme e da quale esercizio parte ognuno. Sulla TV ogni riga dell'EMOM o
// dell'ON/OFF in corso prende il colore di chi ci sta sopra (src/lib/personeTV.js).
export default function FoglioPersoneTV({ persone, maxEsercizi, onCambia, onChiudi }) {
  const cambia = (id, campi) => onCambia(persone.map(p => (p.id === id ? { ...p, ...campi } : p)))
  const sposta = (p, verso) => {
    vibraScelta()
    const n = Math.max(1, maxEsercizi)
    cambia(p.id, { partenza: ((p.partenza - 1 + verso + n) % n) + 1 })
  }

  return createPortal(
    <div className="fixed inset-0 z-[260] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/70 velo-in" onClick={onChiudi} />
      <div className="relative bg-[#1e1e1e] border-t border-[#2a2a2a] rounded-t-3xl px-5 pt-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] max-h-[85dvh] overflow-y-auto sheet-in">
        <div className="flex items-start justify-between gap-4 mb-1">
          <div>
            <h3 className="text-xl font-black tracking-tight text-white">Persone sulla TV</h3>
            <p className="mt-1 text-sm text-gray-400 text-pretty">
              Ognuno ha un colore. Negli EMOM e negli ON/OFF la TV colora l'esercizio di chi ci sta sopra,
              e a ogni cambio tutti avanzano di uno.
            </p>
          </div>
          <button aria-label="Chiudi" onClick={onChiudi}
            className="shrink-0 w-10 h-10 rounded-full bg-[#2a2a2a] flex items-center justify-center text-gray-300">
            <X size={20} />
          </button>
        </div>

        {persone.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-[#383838] py-8 flex flex-col items-center gap-2 text-gray-500">
            <Users size={28} />
            <p className="text-sm">Nessuna persona: la TV accende l'esercizio in giallo, come sempre.</p>
          </div>
        ) : (
          <div className="mt-5 flex flex-col gap-2.5">
            {persone.map(p => (
              <div key={p.id} className="flex items-center gap-3 rounded-2xl bg-[#111] border border-[#2a2a2a] p-2.5">
                <span aria-hidden="true" className="shrink-0 w-4 h-4 rounded-full ml-1" style={{ background: p.colore }} />
                <input
                  aria-label="Nome"
                  value={p.nome}
                  maxLength={12}
                  onChange={e => cambia(p.id, { nome: e.target.value })}
                  className="flex-1 min-w-0 bg-transparent text-white font-bold text-base outline-none" />
                <div className="shrink-0 flex items-center gap-1">
                  <button aria-label="Parte da un esercizio prima" onClick={() => sposta(p, -1)}
                    className="w-9 h-9 rounded-full bg-[#2a2a2a] flex items-center justify-center text-gray-300">
                    <Minus size={16} />
                  </button>
                  <span className="w-[64px] text-center text-sm font-bold text-gray-200 tabular-nums">dal {p.partenza}°</span>
                  <button aria-label="Parte da un esercizio dopo" onClick={() => sposta(p, 1)}
                    className="w-9 h-9 rounded-full bg-[#2a2a2a] flex items-center justify-center text-gray-300">
                    <Plus size={16} />
                  </button>
                </div>
                <button aria-label={`Togli ${p.nome}`} onClick={() => onCambia(persone.filter(x => x.id !== p.id))}
                  className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:text-red-500">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex gap-2.5">
          <button
            onClick={() => { vibraScelta(); onCambia(aggiungiPersona(persone, maxEsercizi)) }}
            disabled={persone.length >= MAX_PERSONE}
            className="flex-1 h-12 rounded-xl bg-[#2a2a2a] text-white font-bold flex items-center justify-center gap-2 disabled:opacity-40">
            <Plus size={18} /> Aggiungi persona
          </button>
          <button onClick={onChiudi}
            className="flex-1 h-12 rounded-xl bg-brand text-black font-bold hover:brightness-110">
            Fatto
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
