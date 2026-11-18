// CartaMioAllenamento.jsx — «Il tuo allenamento» in testa alla Home del coach
// (18/11/2026). Il coach si allena anche lui: questa card gli porta in un tocco
// l'allenamento di oggi, o il prossimo. Quale riga mostrare lo decide
// `scegliMioAllenamento` (src/lib/mioAllenamento.js); senza riga non c'è card.

import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import { Check, ChevronRight } from 'lucide-react'
import { CARD } from '../lib/stiliCard'
import { coloreCategoria } from '../lib/colori'
import { separaCodice } from '../lib/codiceWorkout'

export default function CartaMioAllenamento({ mio, onApri }) {
  if (!mio) return null
  const titolo = mio.oggi ? 'Il tuo allenamento' : 'Il tuo prossimo allenamento'
  const nome = separaCodice(mio.titolo).nome || 'Allenamento'
  const quando = mio.oggi ? 'Oggi' : format(parseISO(mio.data), 'EEE d MMM', { locale: it })

  return (
    <button type="button" onClick={onApri} aria-label={`${titolo}: ${nome}, ${quando}${mio.fatto ? ', fatto' : ''}`}
      className={`${CARD} w-full flex items-center gap-3.5 px-4 py-3.5 text-left transition hover:border-white/[.16]`}>
      <span aria-hidden="true" className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ backgroundColor: coloreCategoria(mio.categoria) }} />
      <span className="flex-1 min-w-0">
        <span className="block text-[11px] font-bold uppercase tracking-[.1em] text-muted">{titolo}</span>
        <span className="block mt-0.5 text-[15px] font-bold text-white truncate">{nome}</span>
        <span className="block text-[13px] font-medium text-muted first-letter:uppercase">{quando}</span>
      </span>
      {mio.fatto
        ? <span className="w-7 h-7 rounded-full bg-green-500/15 text-green-500 flex items-center justify-center shrink-0"><Check size={16} aria-hidden="true" /></span>
        : <ChevronRight size={18} className="text-muted shrink-0" aria-hidden="true" />}
    </button>
  )
}
