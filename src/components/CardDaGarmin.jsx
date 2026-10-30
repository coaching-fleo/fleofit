import { Watch } from 'lucide-react'
import { CardNota } from './WorkoutDetailUI'
import RigheGarmin from './RigheGarmin'
import { fonteGarmin } from '../lib/attivitaGarmin'

// Grigia: sono dati dell'orologio, non una categoria (spec Garmin §6).
const GRIGIO = '#9ca3af'

// «Da Garmin»: i numeri veri dell'attività che ha completato (o è stata
// abbinata a) questa assegnazione, e «Non era questo allenamento».
// Il titolo è «Garmin [modello]»: le linee guida di marchio Garmin vogliono la
// fonte accanto al titolo della vista, non in una riga piccola in fondo.
// La lettura e la scrittura stanno in WorkoutDetail: il recap ha bisogno della
// stessa attività per la durata vera.
export default function CardDaGarmin({ attivita, onNonEraQuesto, inCorso = false }) {
  return (
    <CardNota etichetta={fonteGarmin(attivita)} icona={Watch} colore={GRIGIO}>
      <RigheGarmin attivita={attivita} />
      {onNonEraQuesto && (
        <div className="flex justify-end">
          <button type="button" onClick={onNonEraQuesto} disabled={inCorso}
            className="shrink-0 text-[12px] font-bold text-gray-300 disabled:opacity-50">
            Non era questo allenamento
          </button>
        </div>
      )}
    </CardNota>
  )
}
