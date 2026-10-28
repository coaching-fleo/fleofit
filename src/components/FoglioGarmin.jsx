// FoglioGarmin.jsx — il foglio del collegamento Garmin Connect (Impostazioni,
// solo l'atleta vero). docs/superpowers/specs/2026-10-27-garmin-design.md §2.
//
//  • Non collegato (o da ricollegare): cosa riceviamo, la casella del consenso
//    SEPARATO, l'informativa e «Collega». «Collega» resta spento finché la
//    casella è vuota: è la spunta a rendere il consenso esplicito.
//  • Collegato: da quando, cosa è autorizzato, cosa manca, «Scollega».
//
// SOLA PRESENTAZIONE: le chiamate a `garmin-auth` le fa la pagina.
// ⚠️ La X ha aria-label «Chiudi»: è così che il tasto indietro di Android
// trova il foglio (src/lib/indietroAndroid.js).
// L'interruttore «Manda i workout all'orologio» (Fase 3) c'è solo da collegato;
// la pagina lo salva chiamando `garmin-training`.

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Check, Activity, Moon } from 'lucide-react'
import { useBottomSheet } from '../useBottomSheet'
import { VETRO } from '../lib/stiliCard'
import { Interruttore } from './ImpostazioniUI'
import { TESTO_CONSENSO_GARMIN, dataCollegamento, etichettePermessi, permessiMancanti } from '../lib/garmin'

export default function FoglioGarmin({ stato, permessi, dal, inviaWorkout = true, inviaOccupato = false, occupato = false, onInviaWorkout, onCollega, onScollega, onInformativa, onChiudi }) {
  const { chiudi, maniglia, stileFoglio, stileVelo, classeFoglio, classeVelo } = useBottomSheet(onChiudi)
  const [acconsento, setAcconsento] = useState(false)
  const collegato = stato === 'attivo'

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col justify-end">
      <div aria-hidden="true" onClick={chiudi} className={`absolute inset-0 bg-black/85 ${classeVelo}`} style={stileVelo} />
      <div role="dialog" aria-modal="true" aria-label="Garmin Connect"
        className={`relative w-full max-w-2xl mx-auto bg-[#1e1e1e] border-t border-[#2a2a2a] rounded-t-3xl px-4
                    pb-[calc(1rem+env(safe-area-inset-bottom))] max-h-[85dvh] flex flex-col
                    shadow-[0_-20px_50px_-12px_rgba(0,0,0,.85)] ${classeFoglio}`}
        style={stileFoglio}>
        <button type="button" aria-label="Trascina giù per chiudere" {...maniglia}
          className="w-full pt-3 pb-2.5 flex justify-center touch-none cursor-grab group shrink-0">
          <span aria-hidden="true" className="w-10 h-1 rounded-full bg-white/20 group-hover:bg-white/35" />
        </button>

        <div className="flex items-center gap-3 pb-3 shrink-0">
          <h2 className="flex-1 min-w-0 text-[17px] font-extrabold tracking-[-.015em] text-white truncate">Garmin Connect</h2>
          <button type="button" aria-label="Chiudi" onClick={chiudi}
            className={`shrink-0 w-10 h-10 rounded-full ${VETRO} flex items-center justify-center text-gray-200 hover:text-white transition`}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="overflow-y-auto overscroll-contain hide-scrollbar flex flex-col gap-3 pb-2">
          {collegato ? (
            <Collegato dal={dal} permessi={permessi} inviaWorkout={inviaWorkout} inviaOccupato={inviaOccupato} occupato={occupato}
              onInviaWorkout={onInviaWorkout} onScollega={onScollega} />
          ) : (
            <>
              {stato === 'da_ricollegare' && (
                <p className="text-sm text-gray-300 leading-relaxed">
                  Garmin non ci manda più i tuoi dati: il collegamento è scaduto o è stato revocato. Collegalo di nuovo per riprendere.
                </p>
              )}

              {/* Cosa riceviamo: le due voci della policy, sezione 3. */}
              <ul className="flex flex-col gap-2.5">
                <Voce icona={Activity} titolo="Le tue attività">
                  Tipo, durata, distanza, passo, frequenza cardiaca. Non le tracce GPS dei percorsi.
                </Voce>
                <Voce icona={Moon} titolo="Il tuo recupero">
                  Sonno, variabilità della frequenza cardiaca (HRV), frequenza cardiaca a riposo, stress.
                </Voce>
              </ul>

              <Casella spuntata={acconsento} onCambia={setAcconsento}>{TESTO_CONSENSO_GARMIN}</Casella>

              <button type="button" onClick={onInformativa}
                className="self-start text-sm font-semibold text-brand underline underline-offset-4 hover:brightness-110">
                Leggi l'informativa
              </button>

              <button type="button" onClick={onCollega} disabled={!acconsento || occupato}
                className="w-full mt-1 py-3.5 bg-brand text-black font-bold rounded-xl hover:brightness-110 transition
                           disabled:opacity-40 flex justify-center items-center">
                {occupato ? 'Un attimo…' : stato === 'da_ricollegare' ? 'Collega di nuovo' : 'Collega'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

function Collegato({ dal, permessi, inviaWorkout, inviaOccupato, occupato, onInviaWorkout, onScollega }) {
  const data = dataCollegamento(dal)
  const concessi = etichettePermessi(permessi)
  const mancanti = permessiMancanti(permessi)
  return (
    <>
      <div className="rounded-2xl bg-white/[.05] border border-white/[.08] p-3.5 flex flex-col gap-1.5">
        <p className="text-[15px] font-bold text-white">{data ? `Collegato dal ${data}` : 'Collegato'}</p>
        <p className="text-sm text-gray-300">
          {concessi.length ? `Hai autorizzato: ${concessi.join(', ')}` : 'Non hai autorizzato nessun dato.'}
        </p>
        {mancanti.length > 0 && (
          <p className="text-xs text-muted">
            Non autorizzato: {mancanti.join(', ')}. Puoi cambiarlo dalle impostazioni di Garmin Connect.
          </p>
        )}
      </div>
      <div className="rounded-2xl bg-white/[.05] border border-white/[.08] p-3.5 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-bold text-white">Manda i workout all'orologio</p>
          <p className="mt-0.5 text-xs text-muted leading-relaxed">
            {inviaWorkout
              ? 'Le corse che ti assegna il coach compaiono nel calendario di Garmin'
              : 'Quelle già mandate per i prossimi giorni vengono tolte'}
          </p>
        </div>
        <Interruttore attivo={inviaWorkout} etichetta="Manda i workout all'orologio" occupato={inviaOccupato}
          onCambia={() => onInviaWorkout?.(!inviaWorkout)} />
      </div>
      <button type="button" onClick={onScollega} disabled={occupato}
        className="w-full py-3 rounded-xl bg-white/[.06] border border-white/[.1] text-[15px] font-bold text-red-500
                   hover:bg-white/[.1] transition disabled:opacity-50">
        {occupato ? 'In corso…' : 'Scollega'}
      </button>
    </>
  )
}

function Voce({ icona: Icona, titolo, children }) {
  return (
    <li className="flex items-start gap-3">
      <span aria-hidden="true" className="mt-0.5 w-8 h-8 shrink-0 rounded-[10px] border bg-white/[.07] border-white/[.11] text-gray-200 flex items-center justify-center">
        <Icona size={16} />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-bold text-white">{titolo}</p>
        <p className="text-xs text-muted leading-relaxed">{children}</p>
      </div>
    </li>
  )
}

/** La casella del consenso, come quelle di `Consenso.jsx`. */
function Casella({ spuntata, onCambia, children }) {
  return (
    <label className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition
                       ${spuntata ? 'bg-brand/10 border-brand/40' : 'bg-[#111] border-[#333]'}`}>
      <input type="checkbox" checked={spuntata} onChange={(e) => onCambia(e.target.checked)} className="sr-only peer" />
      <span aria-hidden="true"
        className={`mt-0.5 w-5 h-5 shrink-0 rounded-md border flex items-center justify-center transition
                    peer-focus-visible:ring-2 peer-focus-visible:ring-brand
                    ${spuntata ? 'bg-brand border-brand' : 'border-[#555]'}`}>
        {spuntata && <Check size={14} strokeWidth={3} className="text-black" />}
      </span>
      <span className="text-sm text-gray-200 leading-relaxed">{children}</span>
    </label>
  )
}
