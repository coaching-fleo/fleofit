import { useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarClock, X } from 'lucide-react'
import { format } from 'date-fns'
import CustomDatePicker from './CustomDatePicker'
import {
  BOLLA_MODALE, BOTTONE_BRAND, BOTTONE_QUIETO, CARTA_MODALE, TESTO_MODALE, TITOLO_MODALE, TONO_BOLLA,
} from '../lib/stiliCard'
import { separaCodice } from '../lib/codiceWorkout'
import { giorniProposti, nomeGiorno, dataBreve, giornoBreve, eNelPassato } from '../lib/spostaAllenamento'

/**
 * «Sposta l'allenamento»: l'atleta sceglie un altro giorno. Lo aprono il
 * calendario e la scheda del workout, con lo stesso foglio.
 *
 * Non scrive niente da sé: `onConferma(data)` la riceve chi lo apre, che sa
 * quale assegnazione spostare e cosa ricaricare dopo.
 *
 * ⚠️ z-[110]: sotto il calendario di CustomDatePicker (z-[120]), che si apre
 * da qui dentro, e sotto gli alert (z-[150]) che seguono un errore.
 * ⚠️ Il tasto indietro di Android la chiude perché ha la X «Chiudi» e il
 * bottone «Annulla» (src/lib/indietroAndroid.js).
 */
export default function FoglioSposta({ titolo, dataAttuale, onChiudi, onConferma }) {
  const [scelta, setScelta] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const giorni = giorniProposti(dataAttuale)
  const valida = scelta && scelta !== dataAttuale && !eNelPassato(scelta)

  const conferma = async () => {
    if (!valida || salvando) return
    setSalvando(true)
    const ok = await onConferma(scelta)
    // Se è andata a buon fine chi l'ha aperto chiude il foglio; se no si resta
    // qui, con la scelta ancora in mano, per riprovare.
    if (!ok) setSalvando(false)
  }

  return createPortal(
    <div className="fixed inset-0 bg-black/85 z-[110] flex items-center justify-center p-4 velo-in" onClick={onChiudi}>
      <div role="dialog" aria-modal="true" aria-label="Sposta l'allenamento"
        className={`${CARTA_MODALE} relative`} onClick={e => e.stopPropagation()}>
        <button type="button" aria-label="Chiudi" onClick={onChiudi}
          className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center text-gray-400 hover:text-white">
          <X size={18} />
        </button>
        <div className={`${BOLLA_MODALE} ${TONO_BOLLA.avviso}`}><CalendarClock size={26} aria-hidden="true" /></div>
        <h2 className={TITOLO_MODALE}>Sposta l'allenamento</h2>
        <p className={TESTO_MODALE}>
          <span className="text-white font-bold">{separaCodice(titolo || '').nome || 'Allenamento'}</span>
          {dataAttuale && <> è in programma {dataBreve(dataAttuale)}.</>} In che giorno lo fai?
        </p>

        <div className="grid grid-cols-7 gap-1.5 mt-1">
          {giorni.map(g => {
            const valore = format(g, 'yyyy-MM-dd')
            const attivo = scelta === valore
            return (
              <button key={valore} type="button" onClick={() => setScelta(valore)}
                aria-pressed={attivo}
                aria-label={dataBreve(valore)}
                className={`flex flex-col items-center py-2 rounded-xl border transition active:scale-95 ${
                  attivo ? 'bg-brand border-brand text-black' : 'bg-[#111] border-[#333] text-white hover:border-brand/50'}`}>
                <span className={`text-[9.5px] font-bold uppercase tracking-wide truncate max-w-full ${attivo ? 'text-black/70' : 'text-muted'}`}>
                  {nomeGiorno(g)}
                </span>
                <span className="text-[16px] font-black leading-tight">{format(g, 'd')}</span>
              </button>
            )
          })}
        </div>

        <CustomDatePicker
          date={scelta}
          onChange={setScelta}
          meseIniziale={dataAttuale}
          placeholder="Un altro giorno…"
          className="bg-[#111] border border-[#333] rounded-xl px-4 py-3 hover:border-brand text-[14px]"
        />
        {scelta && eNelPassato(scelta) && (
          <p className="text-[12.5px] text-red-400 -mt-1">Scegli oggi o un giorno che deve ancora venire.</p>
        )}

        <div className="flex gap-3 mt-2">
          <button type="button" onClick={onChiudi} className={BOTTONE_QUIETO}>Annulla</button>
          <button type="button" onClick={conferma} disabled={!valida || salvando} className={BOTTONE_BRAND}>
            {salvando ? 'Sposto…' : valida ? `Sposta a ${giornoBreve(scelta)}` : 'Sposta'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
