// MessaggiUI.jsx — la bacheca «Dal coach» (15/10/2026). SOLA PRESENTAZIONE.
// Entra in Home: niente librerie pesanti.
import { Pin, MoreHorizontal, Megaphone } from 'lucide-react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { anteprima } from '../lib/messaggiCoach'

// Una data mancante o illeggibile non deve mai far cadere la pagina: si omette.
const quando = (d) => {
  const data = d ? new Date(d) : null
  return data && !Number.isNaN(data.getTime()) ? format(data, 'd MMM · HH:mm', { locale: it }) : ''
}

export function RigaMessaggio({ messaggio, evidenziato = false, coach = false, onMenu }) {
  const { id, testo, fissato, creato_at, modificato_at } = messaggio
  return (
    <div
      id={'messaggio-' + id}
      data-evidenziato={evidenziato ? 'true' : 'false'}
      className={`bg-[#1e1e1e] border rounded-3xl p-5 transition-colors ${evidenziato ? 'border-brand' : 'border-[#2a2a2a]'}`}
    >
      <div className="flex items-center gap-2 mb-2 text-xs text-gray-500">
        {fissato && <Pin size={14} className="text-brand shrink-0" aria-label="Fissato" />}
        <span>{quando(creato_at)}</span>
        {modificato_at && <span>· modificato</span>}
        {/* ⏳ TEMPORANEO: una «Prova su di me», solo su questo telefono. */}
        {messaggio.prova && (
          <span className="ml-auto shrink-0 rounded-full border border-[#444] px-2 py-0.5 text-[11px] font-bold text-gray-300">
            Prova · la vedi solo tu
          </span>
        )}
        {coach && (
          <button
            type="button"
            aria-label="Azioni messaggio"
            onClick={() => onMenu?.(messaggio)}
            className="ml-auto w-11 h-11 -mr-3.5 -my-1.5 flex items-center justify-center rounded-full text-gray-400 hover:text-white"
          >
            <MoreHorizontal size={18} />
          </button>
        )}
      </div>
      <p className="text-sm text-gray-200 whitespace-pre-line break-words">{testo}</p>
    </div>
  )
}

export function ListaMessaggi({ messaggi = [], evidenziatoId, coach = false, onMenu }) {
  if (!messaggi.length) {
    return (
      <div className="border border-dashed border-[#333] rounded-3xl p-8 text-center">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#2a2a2a] flex items-center justify-center text-gray-500">
          <Megaphone size={20} />
        </div>
        <p className="text-sm text-gray-400">Qui troverai i messaggi del coach</p>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-3">
      {messaggi.map(m => (
        <RigaMessaggio key={m.id} messaggio={m} evidenziato={m.id === evidenziatoId} coach={coach} onMenu={onMenu} />
      ))}
    </div>
  )
}

export function CardDalCoach({ messaggio, onApri }) {
  return (
    <button
      type="button"
      onClick={() => onApri?.(messaggio)}
      className="w-full text-left bg-[#1e1e1e] border border-[#2a2a2a] hover:border-brand rounded-3xl p-5 transition-colors"
    >
      <div className="flex items-center gap-2 mb-1 text-xs font-bold text-brand">
        <Megaphone size={14} />
        <span>Dal coach</span>
      </div>
      <p className="text-sm text-gray-200 whitespace-pre-line break-words">{anteprima(messaggio.testo)}</p>
    </button>
  )
}
