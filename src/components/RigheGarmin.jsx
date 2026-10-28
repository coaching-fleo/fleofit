import { righeDaGarmin } from '../lib/attivitaGarmin'

// I numeri di un'attività Garmin in griglia: la card «Da Garmin» della scheda
// e il foglio di un'attività libera (FoglioAttivitaGarmin) li mostrano uguali.
// Sta in un file suo perché CardDaGarmin importa WorkoutDetailUI, e il
// calendario non deve tirarselo dietro.
export default function RigheGarmin({ attivita }) {
  const righe = righeDaGarmin(attivita)
  if (righe.length === 0) return null
  return (
    <dl className="grid grid-cols-3 gap-x-3 gap-y-2">
      {righe.map(r => (
        <div key={r.etichetta} className="min-w-0">
          <dt className="text-[10.5px] text-gray-500">{r.etichetta}</dt>
          <dd className="text-[14px] font-bold text-white tabular-nums truncate">{r.valore}</dd>
        </div>
      ))}
    </dl>
  )
}
