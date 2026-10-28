import { Watch } from 'lucide-react'
import { CardNota } from './WorkoutDetailUI'
import { righeDaGarmin } from '../lib/attivitaGarmin'

// Grigia: sono dati dell'orologio, non una categoria (spec Garmin §6).
const GRIGIO = '#9ca3af'

// «Da Garmin»: i numeri veri dell'attività che ha completato (o è stata
// abbinata a) questa assegnazione, e «Non era questo allenamento».
// La lettura e la scrittura stanno in WorkoutDetail: il recap ha bisogno della
// stessa attività per la durata vera.
export default function CardDaGarmin({ attivita, onNonEraQuesto, inCorso = false }) {
  const righe = righeDaGarmin(attivita)
  const dispositivo = typeof attivita?.dati?.dispositivo === 'string' ? attivita.dati.dispositivo.trim() : ''
  return (
    <CardNota etichetta="Da Garmin" icona={Watch} colore={GRIGIO}>
      {righe.length > 0 && (
        <dl className="grid grid-cols-3 gap-x-3 gap-y-2">
          {righe.map(r => (
            <div key={r.etichetta} className="min-w-0">
              <dt className="text-[10.5px] text-gray-500">{r.etichetta}</dt>
              <dd className="text-[14px] font-bold text-white tabular-nums truncate">{r.valore}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] text-gray-500 truncate">
          Garmin{dispositivo ? ` · ${dispositivo}` : ''}
        </span>
        {onNonEraQuesto && (
          <button type="button" onClick={onNonEraQuesto} disabled={inCorso}
            className="shrink-0 text-[12px] font-bold text-gray-300 disabled:opacity-50">
            Non era questo allenamento
          </button>
        )}
      </div>
    </CardNota>
  )
}
