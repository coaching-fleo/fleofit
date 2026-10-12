import { Flag, ChevronRight } from 'lucide-react'
import { CARD, LABEL } from '../lib/stiliCard'

/**
 * In Home, dopo una gara HYROX senza un tempo salvato: porta alla scheda
 * della gara, dove `RisultatoGara` cerca il tempo da solo. Qui non si cerca
 * niente — ogni ricerca costa una ventina di richieste a results.hyrox.com, e
 * la Home si apre molte volte al giorno.
 */
export function InvitoRisultato({ titolo, onOpen }) {
  return (
    <button onClick={onOpen}
      className={`${CARD} w-full text-left px-[18px] py-4 flex items-center gap-3.5 border-brand/40 transition hover:border-brand active:scale-[.99]`}>
      <span className="w-11 h-11 rounded-full bg-brand text-black flex items-center justify-center shrink-0">
        <Flag size={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block ${LABEL}`}>Com'è andata?</span>
        <span className="mt-1 block text-[16px] font-black tracking-[-.02em] text-white truncate">{titolo}</span>
        <span className="block text-[12.5px] font-medium text-muted">Trova il tuo tempo ufficiale</span>
      </span>
      <ChevronRight size={18} className="text-[#5b6070] shrink-0" aria-hidden="true" />
    </button>
  )
}
