// La presentazione della sezione Extra (spec docs/superpowers/specs/2026-11-12-sezione-extra-design.md):
// la griglia della pagina e la card «Dagli Extra» della Home. Niente dati qui:
// li passano Extra.jsx e DagliExtra.jsx.

import { X, ChevronRight } from 'lucide-react'
import { vibraScelta } from '../lib/aptica'

/** Il pallino giallo di «c'è qualcosa di nuovo». */
export const Pallino = ({ className = '' }) => (
  <span aria-hidden="true" className={`w-2 h-2 rounded-full bg-brand ${className}`} />
)

/** `voci`: [{ extra, riga, avviso }] — `riga` è la riga viva o la descrizione. */
export function GrigliaExtra({ voci, onApri }) {
  return (
    <div className="cascata grid grid-cols-2 gap-3">
      {voci.map(({ extra, riga, avviso }) => {
        const Icona = extra.icona
        return (
          <button key={extra.id} type="button"
            aria-label={avviso ? `${extra.nome}, novità` : extra.nome}
            onClick={() => { vibraScelta(); onApri(extra) }}
            className="relative text-left bg-[#1e1e1e] border border-[#2a2a2a] rounded-3xl p-4 min-h-[132px]
                       flex flex-col gap-3 hover:border-white/20 active:scale-[.98] transition">
            {avviso && <Pallino className="absolute top-4 right-4" />}
            <span className="w-11 h-11 rounded-full bg-[#2a2a2a] flex items-center justify-center text-white">
              <Icona size={21} aria-hidden="true" />
            </span>
            <span className="mt-auto">
              <span className="block text-[15px] font-extrabold text-white leading-tight">{extra.nome}</span>
              <span className="block mt-1 text-[13px] font-medium text-gray-400 leading-snug">{riga}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

/**
 * La card della Home: un avviso solo, il più importante. Il tasto indietro di
 * Android non la tocca: `indietroAndroid.js` cerca la X «Chiudi…» solo nelle
 * modali in portale (fuori da `#root`), e questa card sta dentro la pagina.
 * ⚠️ Se un giorno finisse in un foglio con `createPortal`, il tasto indietro
 * premerebbe questa X (l'espressione è `/^chiudi/i`, che vale anche per
 * «Chiudi l'avviso») invece di chiudere il foglio.
 */
export function CartaDagliExtra({ extra, avviso, altri, onApri, onChiudi, onApriTutti, className = '' }) {
  const Icona = extra.icona
  return (
    <section aria-label="Dagli Extra" className={`${className} bg-[#1e1e1e] border border-[#2a2a2a] rounded-3xl overflow-hidden`}>
      <div className="flex items-center gap-3 p-4">
        <button type="button" onClick={() => { vibraScelta(); onApri(extra) }}
          className="flex-1 min-w-0 flex items-center gap-3 text-left">
          <span className="w-11 h-11 shrink-0 rounded-full bg-brand/[.16] text-brand flex items-center justify-center">
            <Icona size={21} aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-[12px] font-bold uppercase tracking-wide text-gray-500">{extra.nome}</span>
            <span className="block text-[15px] font-extrabold text-white leading-snug">{avviso.testo}</span>
          </span>
        </button>
        <button type="button" aria-label="Chiudi l'avviso" onClick={() => onChiudi(extra, avviso)}
          className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-gray-500 hover:text-white transition">
          <X size={18} />
        </button>
      </div>
      {altri > 0 && (
        <button type="button" onClick={() => { vibraScelta(); onApriTutti() }}
          className="w-full flex items-center justify-between px-4 py-3 border-t border-[#2a2a2a] text-[13px] font-bold text-gray-300 hover:text-white transition">
          <span>+{altri} negli Extra</span>
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      )}
    </section>
  )
}
