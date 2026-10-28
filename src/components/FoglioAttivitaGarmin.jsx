import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, ChevronRight } from 'lucide-react'
import { useBottomSheet } from '../useBottomSheet'
import { VETRO } from '../lib/stiliCard'
import RigheGarmin from './RigheGarmin'
import { nomeTipoAttivita, dispositivoGarmin } from '../lib/attivitaGarmin'
import { separaCodice } from '../lib/codiceWorkout'
import { dataBreve } from '../lib/spostaAllenamento'

/**
 * Un'attività dell'orologio che non è abbinata a niente: i suoi numeri (le
 * stesse righe della card «Da Garmin») e «Abbina a…», con le assegnazioni non
 * completate di quel giorno e dei due vicini (`candidatiAbbina`).
 *
 * Non scrive niente da sé: `onAbbina(awId)` lo riceve la pagina, che sa cosa
 * ricaricare, e risponde `true` se è andata — allora il foglio si chiude. Se
 * no si resta qui, con la lista ancora in mano, per riprovare (l'errore lo
 * mostra la pagina con il CustomAlert).
 *
 * ⚠️ Il tasto indietro di Android la chiude perché ha la X «Chiudi»
 * (src/lib/indietroAndroid.js).
 */
export default function FoglioAttivitaGarmin({ attivita, candidati = [], onAbbina, onChiudi }) {
  const { chiudi, maniglia, stileFoglio, stileVelo, classeFoglio, classeVelo } = useBottomSheet(onChiudi)
  const [inCorso, setInCorso] = useState(null)
  const dispositivo = dispositivoGarmin(attivita)
  const titolo = nomeTipoAttivita(attivita?.tipo)
  const giorno = dataBreve(String(attivita?.giorno || '').slice(0, 10))

  const abbina = async (awId) => {
    if (inCorso) return
    setInCorso(awId)
    const ok = await onAbbina(awId)
    if (ok) chiudi()
    else setInCorso(null)
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col justify-end">
      <div aria-hidden="true" onClick={chiudi} className={`absolute inset-0 bg-black/85 ${classeVelo}`} style={stileVelo} />
      <div role="dialog" aria-modal="true" aria-label={`Garmin · ${titolo}`}
        className={`relative w-full max-w-2xl mx-auto bg-[#1e1e1e] border-t border-[#2a2a2a] rounded-t-3xl px-4
                    pb-[calc(1rem+env(safe-area-inset-bottom))] max-h-[85dvh] flex flex-col
                    shadow-[0_-20px_50px_-12px_rgba(0,0,0,.85)] ${classeFoglio}`}
        style={stileFoglio}>
        <button type="button" aria-label="Trascina giù per chiudere" {...maniglia}
          className="w-full pt-3 pb-2.5 flex justify-center touch-none cursor-grab group shrink-0">
          <span aria-hidden="true" className="w-10 h-1 rounded-full bg-white/20 group-hover:bg-white/35" />
        </button>

        <div className="flex items-center gap-3 pb-3 shrink-0">
          <div className="flex-1 min-w-0">
            <h2 className="text-[17px] font-extrabold tracking-[-.015em] text-white truncate">{titolo}</h2>
            <p className="text-[12px] text-gray-500 truncate">
              Garmin{dispositivo ? ` · ${dispositivo}` : ''}{giorno ? ` · ${giorno}` : ''}
            </p>
          </div>
          <button type="button" aria-label="Chiudi" onClick={chiudi}
            className={`shrink-0 w-10 h-10 rounded-full ${VETRO} flex items-center justify-center text-gray-200 hover:text-white transition`}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="overflow-y-auto overscroll-contain hide-scrollbar flex flex-col gap-4 pb-2">
          <div className="rounded-2xl bg-white/[.05] border border-white/[.08] p-3.5">
            <RigheGarmin attivita={attivita} />
          </div>

          <section aria-label="Abbina a…" className="flex flex-col gap-2">
            <h3 className="text-[11px] font-bold uppercase tracking-[.1em] text-muted">Abbina a…</h3>
            {candidati.length === 0 ? (
              <p className="text-sm text-gray-400">Nessun allenamento da abbinare in questi giorni</p>
            ) : candidati.map(w => (
              <button key={w.aw_id} type="button" onClick={() => abbina(w.aw_id)} disabled={!!inCorso}
                className="w-full text-left rounded-2xl bg-white/[.05] border border-white/[.08] px-3.5 py-3
                           flex items-center gap-3 hover:bg-white/[.08] transition disabled:opacity-50">
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] font-bold text-white truncate">
                    {separaCodice(w.title || '').nome || 'Allenamento'}
                  </span>
                  <span className="block text-[12px] text-muted truncate">
                    {inCorso === w.aw_id ? 'Un attimo…' : dataBreve(String(w.date).slice(0, 10))}
                  </span>
                </span>
                <ChevronRight size={17} className="text-[#5b6070] shrink-0" aria-hidden="true" />
              </button>
            ))}
          </section>
        </div>
      </div>
    </div>,
    document.body
  )
}
