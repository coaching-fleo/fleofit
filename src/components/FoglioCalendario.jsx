// FoglioCalendario.jsx — il calendario intero dei prossimi giorni (11/11/2026).
//
// Oltre 20 atleti la Home mostra solo i primi 20 (prima chi è scoperto,
// `righeCalendario` di src/lib/riepilogoCoach.js); «Mostra tutti» apre questo
// foglio con tutte le righe, nello stesso ordine (`primaGliScoperti`), e la
// ricerca per nome. X con aria-label="Chiudi" per il tasto indietro di Android.
//
// Telefono: foglio dal basso, come FoglioListaCoach (trascinamento, Esc).
// Desktop: una FINESTRA al centro, non un pannello laterale — la griglia ha
// quattordici colonne e vuole la larghezza; in testa titolo, ricerca e legenda
// su due righe, e la riga dei giorni resta ferma mentre si scorrono gli atleti.

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Search } from 'lucide-react'
import { useBottomSheet } from '../useBottomSheet'
import { battito } from '../lib/aptica'
import { filtraPerNome, primaGliScoperti } from '../lib/riepilogoCoach'
import { CalendarioProssimi, LegendaCalendario } from './RiepilogoCoachUI'

function Ricerca({ testo, onTesto, classe = '' }) {
  return (
    <label className={`h-11 px-3.5 rounded-[14px] bg-[#0f0f10] border border-white/[.07] shadow-[inset_0_1px_3px_rgba(0,0,0,.6)]
                       flex items-center gap-2.5 focus-within:border-brand transition-colors ${classe}`}>
      <Search size={17} className="text-gray-500 shrink-0" aria-hidden="true" />
      <input type="search" value={testo} onChange={(e) => onTesto(e.target.value)}
        placeholder="Cerca per nome" aria-label="Cerca per nome"
        className="flex-1 min-w-0 bg-transparent text-[15px] text-white placeholder:text-gray-500 outline-none" />
    </label>
  )
}

function Chiudi({ onClick }) {
  return (
    <button type="button" onClick={onClick} aria-label="Chiudi"
      className="shrink-0 w-9 h-9 rounded-full bg-white/[.07] shadow-[inset_0_1px_0_rgba(255,255,255,.08)] text-gray-300 flex items-center justify-center hover:text-white">
      <X size={18} aria-hidden="true" />
    </button>
  )
}

export default function FoglioCalendario({ piano, laterale = false, onApri, onProgramma, onChiudi }) {
  const { chiudi, maniglia, stileFoglio, stileVelo, classeFoglio, classeVelo } = useBottomSheet(onChiudi)
  const [testo, setTesto] = useState('')
  useEffect(() => { battito() }, [])

  const ordinate = useMemo(() => primaGliScoperti(piano?.righe || []), [piano])
  const filtrato = useMemo(() => ({ ...piano, righe: filtraPerNome(ordinate, testo) }), [piano, ordinate, testo])
  const n = filtrato.righe.length
  const sottotitolo = `${n} ${n === 1 ? 'atleta' : 'atleti'}${testo.trim() ? ` per «${testo.trim()}»` : ' · prima chi è da programmare'}`
  const griglia = (
    <CalendarioProssimi nudo desktop={laterale} piano={filtrato} massimo={Infinity} onApri={onApri} onProgramma={onProgramma} />
  )

  if (laterale) return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-8">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px] velo-in" onClick={chiudi} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-label="Prossimi giorni"
        className="modal-transition relative w-full max-w-[1180px] max-h-[86vh] flex flex-col rounded-[28px] overflow-hidden
                   bg-gradient-to-b from-[#1b1b1e] to-[#141416] border border-white/[.08]
                   shadow-[0_40px_90px_-20px_rgba(0,0,0,.95),inset_0_1px_0_rgba(255,255,255,.07)]">
        <div className="px-6 pt-6 pb-4 border-b border-white/[.06] flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <div className="min-w-0 flex-1">
              <h2 className="text-[22px] font-black tracking-[-.025em] text-white">Prossimi giorni</h2>
              <p className="mt-0.5 text-[13px] font-semibold text-gray-400">{sottotitolo}</p>
            </div>
            <Ricerca testo={testo} onTesto={setTesto} classe="w-[300px]" />
            <Chiudi onClick={chiudi} />
          </div>
          <LegendaCalendario />
        </div>
        <div className="flex-1 overflow-y-auto">{griglia}</div>
      </div>
    </div>,
    document.body,
  )

  return createPortal(
    <div className="fixed inset-0 z-[100]">
      <div className={`absolute inset-0 bg-black/60 ${classeVelo}`} style={stileVelo} onClick={chiudi} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-label="Prossimi giorni"
        className={`absolute left-0 right-0 bottom-0 max-h-[88vh] rounded-t-3xl border-t pb-[env(safe-area-inset-bottom)]
                    bg-gradient-to-b from-[#1b1b1e] to-[#141416] border-white/[.08] flex flex-col
                    shadow-[0_-24px_60px_-12px_rgba(0,0,0,.8),inset_0_1px_0_rgba(255,255,255,.07)] ${classeFoglio}`}
        style={stileFoglio}>
        <div {...maniglia} className="pt-2.5 pb-1 flex justify-center cursor-grab" aria-hidden="true">
          <span className="w-10 h-1.5 rounded-full bg-white/[.16]" />
        </div>
        <div className="px-4 pt-2 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[19px] font-black tracking-[-.02em] text-white">Prossimi giorni</h2>
            <p className="mt-0.5 text-[13px] font-semibold text-gray-400">{sottotitolo}</p>
          </div>
          <Chiudi onClick={chiudi} />
        </div>
        <Ricerca testo={testo} onTesto={setTesto} classe="mx-4 mt-3.5 mb-3" />
        <div className="flex-1 overflow-y-auto">{griglia}</div>
      </div>
    </div>,
    document.body,
  )
}
