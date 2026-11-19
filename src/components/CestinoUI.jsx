// CestinoUI — la lista del cestino dei workout (19/11/2026, docs/memoria/cestino.md).
// Sola presentazione: i dati e il ripristino stanno in pages/Cestino.jsx.
import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import { ChevronRight, Trash2 } from 'lucide-react'
import { CARTA_RIGA, META } from '../lib/stiliCard'
import { GIORNI_CESTINO, rigaCestino } from '../lib/cestino'

const dataBreve = (d) => {
  try { return format(parseISO(d), 'EEE d MMM', { locale: it }) } catch { return '' }
}

export function CestinoVuoto() {
  return (
    <div className="rounded-3xl border border-dashed border-[#333] px-6 py-10 flex flex-col items-center gap-3 text-center">
      <span className="w-14 h-14 rounded-full bg-[#1e1e1e] flex items-center justify-center text-gray-500">
        <Trash2 size={24} aria-hidden="true" />
      </span>
      <p className="text-[15px] font-bold text-white">Il cestino è vuoto</p>
      <p className="text-[13.5px] text-gray-400 leading-relaxed max-w-xs">
        I workout eliminati restano qui {GIORNI_CESTINO} giorni
      </p>
    </div>
  )
}

/** Una riga del cestino: il tocco apre il foglio di ripristino. */
export function RigaCestino({ riga, onApri }) {
  const r = rigaCestino(riga)
  const data = r.dataWorkout ? dataBreve(r.dataWorkout) : ''
  return (
    <button type="button" onClick={() => onApri(riga)}
      aria-label={`${r.titolo}, ${r.scade}`}
      className={`${CARTA_RIGA} w-full text-left flex items-center gap-3 p-4 transition active:scale-[.98]`}>
      <span className="flex-1 min-w-0">
        <span className="block text-[16px] font-extrabold tracking-tight text-white truncate">{r.titolo}</span>
        {(r.codice || data) && (
          <span className={`block mt-0.5 ${META} truncate`}>{[data, r.codice].filter(Boolean).join(' · ')}</span>
        )}
        <span className="block mt-1.5 text-[12.5px] text-gray-400 truncate">{r.eliminato}</span>
        <span className="block mt-0.5 text-[12.5px] font-bold text-brand">{r.scade}</span>
      </span>
      <ChevronRight size={18} className="text-gray-500 shrink-0" aria-hidden="true" />
    </button>
  )
}
