import { Trophy } from 'lucide-react'
import { LABEL } from '../lib/stiliCard'
import { chiudiTastieraSuInvio } from '../useTastiera'

// Team, la riga «Il tuo tempo» del foglio «Com'è andata?» (spec §4). Sola
// presentazione, caricata pigra da RpeModal: entra solo per chi è in una sfida.
// ⚠️ Volutamente piccola e senza TeamUI: sta nei chunk di Home e WorkoutDetail.

const ETICHETTA = { tempo: 'Il tuo tempo', ripetizioni: 'Ripetizioni', kg: 'Kg totali', distanza: 'Metri' }

/**
 * @param metrica  'tempo' | 'ripetizioni' | 'kg' | 'distanza'
 * @param testo    il valore scritto
 * @param valido   false = il testo non si legge (Salva resta spento)
 * @param classificaVisibile  true = «Lo vedono i compagni»
 * @param onCambia (testo) => void
 */
export default function RigaRisultatoSfida({ metrica, testo, valido, classificaVisibile, onCambia }) {
  const etichetta = ETICHETTA[metrica] || 'Risultato'
  return (
    <label className="block rounded-2xl bg-[#111] border border-[#333] px-4 py-3">
      <span className="flex items-center gap-2">
        <Trophy size={15} className="shrink-0 text-brand" aria-hidden="true" />
        <span className={`flex-1 min-w-0 truncate ${LABEL}`}>Sfida del team</span>
      </span>
      <input aria-label={etichetta} value={testo} onChange={e => onCambia(e.target.value)}
        inputMode={metrica === 'tempo' || metrica === 'ripetizioni' ? 'numeric' : 'decimal'}
        enterKeyHint="done" onKeyDown={chiudiTastieraSuInvio}
        placeholder={metrica === 'tempo' ? `${etichetta} (m:ss) · facoltativo` : `${etichetta} · facoltativo`}
        aria-invalid={valido ? undefined : true}
        className={`mt-1.5 w-full bg-transparent text-[18px] font-black placeholder-[#5b6070] focus:outline-none ${valido ? 'text-white' : 'text-red-500'}`} />
      {!valido ? (
        <span className="block mt-1 text-[12.5px] font-medium text-red-500">
          {metrica === 'tempo' ? 'Scrivilo come 4:07 o 1:02:30' : 'Scrivi solo il numero'}
        </span>
      ) : classificaVisibile && (
        <span className="block mt-1 text-[12px] font-medium text-gray-500">Lo vedono i compagni</span>
      )}
    </label>
  )
}
