// FoglioMessaggio.jsx — il menu di un messaggio già mandato, nella bacheca
// «Dal coach» (15/10/2026): Fissa · Modifica · Manda la notifica · Elimina.
// La scrittura non sta più qui: è la pagina NuovoMessaggio (`/messaggi/nuovo`).
//
// ⚠️ Il menu ha un «Annulla» e la X ha aria-label «Chiudi»: è così che il tasto
// indietro di Android li trova (src/lib/indietroAndroid.js).

import { useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, Pin, PinOff, Pencil, Trash2, BellRing } from 'lucide-react'
import { useBottomSheet } from '../useBottomSheet'
import { VETRO } from '../lib/stiliCard'

/** Il guscio del foglio: velo, maniglia, testata con la X. */
function Foglio({ titolo, chiudi, maniglia, stileFoglio, stileVelo, classeFoglio, classeVelo, children }) {
  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col justify-end">
      <div aria-hidden="true" onClick={chiudi} className={`absolute inset-0 bg-black/85 ${classeVelo}`} style={stileVelo} />
      <div role="dialog" aria-modal="true" aria-label={titolo}
        className={`relative w-full max-w-2xl mx-auto bg-[#1e1e1e] border-t border-[#2a2a2a] rounded-t-3xl px-4
                    pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-20px_50px_-12px_rgba(0,0,0,.85)] ${classeFoglio}`}
        style={stileFoglio}>
        <button type="button" aria-label="Trascina giù per chiudere" {...maniglia}
          className="w-full pt-3 pb-2.5 flex justify-center touch-none cursor-grab group">
          <span aria-hidden="true" className="w-10 h-1 rounded-full bg-white/20 group-hover:bg-white/35" />
        </button>
        <div className="flex items-center gap-3 pb-3">
          <p className="flex-1 min-w-0 text-[17px] font-extrabold tracking-[-.015em] text-white truncate">{titolo}</p>
          <button type="button" aria-label="Chiudi" onClick={chiudi}
            className={`shrink-0 w-10 h-10 rounded-full ${VETRO} flex items-center justify-center text-gray-200 hover:text-white transition`}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  )
}

/**
 * Il menu di un messaggio. `onChiudi(scelta)` arriva a uscita FINITA, con
 * 'fissa' | 'modifica' | 'notifica' | 'elimina' | null: un foglio che si apre mentre questo
 * sta ancora uscendo si troverebbe lo scorrimento della pagina già bloccato, e
 * alla fine lo lascerebbe bloccato per sempre (useScorrimentoBloccato).
 *
 * «Manda la notifica» rifà il passo 2 dell'invio quando la push non era
 * partita (Riprova non c'è più): il server salta chi l'ha già ricevuta.
 * @param notificaInVolo  una notifica di questo menu sta già partendo: voce spenta.
 */
export function MenuMessaggio({ messaggio, onChiudi, demo = false, notificaInVolo = false }) {
  const scelta = useRef(null)
  const sheet = useBottomSheet(() => onChiudi(scelta.current))
  // Il demo non scrive (RLS): le voci si vedono, spente, con il perché.
  const scegli = (s) => { if (demo) return; scelta.current = s; sheet.chiudi() }
  const voce = 'w-full min-h-[52px] flex items-center gap-3 px-4 rounded-2xl bg-[#222] border border-[#333] text-left text-[15px] font-bold transition hover:border-[#444] disabled:opacity-40 disabled:pointer-events-none'
  return (
    <Foglio titolo="Messaggio" {...sheet}>
      <div className="flex flex-col gap-2">
        {demo && <p className="text-xs text-gray-400 pb-1">Nell'account di prova i messaggi non partono</p>}
        <button type="button" onClick={() => scegli('fissa')} disabled={demo} className={`${voce} text-white`}>
          {messaggio.fissato ? <PinOff size={18} aria-hidden="true" /> : <Pin size={18} aria-hidden="true" />}
          {messaggio.fissato ? 'Togli dai fissati' : 'Fissa'}
        </button>
        <button type="button" onClick={() => scegli('modifica')} disabled={demo} className={`${voce} text-white`}>
          <Pencil size={18} aria-hidden="true" />Modifica
        </button>
        <button type="button" onClick={() => { if (!notificaInVolo) scegli('notifica') }} disabled={demo || notificaInVolo} className={`${voce} text-white`}>
          <BellRing size={18} aria-hidden="true" />{notificaInVolo ? 'Invio…' : 'Manda la notifica'}
        </button>
        <button type="button" onClick={() => scegli('elimina')} disabled={demo} className={`${voce} text-red-500`}>
          <Trash2 size={18} aria-hidden="true" />Elimina
        </button>
        <button type="button" onClick={sheet.chiudi} className="w-full min-h-[48px] text-[15px] font-bold text-gray-400 hover:text-white">
          Annulla
        </button>
      </div>
    </Foglio>
  )
}
