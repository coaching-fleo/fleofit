import { useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarClock, X } from 'lucide-react'
import { format } from 'date-fns'
import CustomDatePicker from './CustomDatePicker'
import {
  BOLLA_MODALE, BOTTONE_BRAND, BOTTONE_QUIETO, CARTA_MODALE, TESTO_MODALE, TITOLO_MODALE, TONO_BOLLA,
} from '../lib/stiliCard'
import { separaCodice } from '../lib/codiceWorkout'
import { giorniProposti, nomeGiorno, dataBreve, giornoBreve, eNelPassato, chiSiSposta } from '../lib/spostaAllenamento'

/** «1 resta dove sta: 1 già svolto» / «3 restano dove sono: 2 già svolti, 1 spostato da sé». */
function testoRestano({ svolti, spostatiDaSe }) {
  const k = svolti + spostatiDaSe
  if (k === 0) return null
  const pezzi = [
    svolti > 0 && `${svolti} già svolt${svolti === 1 ? 'o' : 'i'}`,
    spostatiDaSe > 0 && `${spostatiDaSe} spostat${spostatiDaSe === 1 ? 'o' : 'i'} da sé`,
  ].filter(Boolean)
  return `${k} ${k === 1 ? 'resta dove sta' : 'restano dove sono'}: ${pezzi.join(', ')}`
}

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
 *
 * `modo="coach"` (26/11/2026, docs/memoria/calendario.md §9-sposta-coach):
 * - il passato si può scegliere (il coach corregge un giorno registrato male);
 * - con `nomeAtleta` e più di un'assegnazione compare «Solo X · Tutti (n)»;
 * - con «Tutti» il foglio dice chi resta dov'è (`chiSiSposta`).
 * `onConferma(data, portata)` in modo coach (`portata`: 'solo' | 'tutti'); l'atleta riceve solo la data.
 */
export default function FoglioSposta({
  titolo, dataAttuale, onChiudi, onConferma,
  modo = 'atleta', nomeAtleta = null, assegnazioni = [], dataWorkout = null, portataIniziale = null,
}) {
  const coach = modo === 'coach'
  const [scelta, setScelta] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [portata, setPortata] = useState(portataIniziale || (coach && !nomeAtleta ? 'tutti' : 'solo'))
  const conScelta = coach && !!nomeAtleta && assegnazioni.length > 1
  const tutti = coach && portata === 'tutti'
  // Con «Tutti» il giorno di partenza è quello della seduta, non quello dell'atleta.
  const partenza = tutti && dataWorkout ? dataWorkout : dataAttuale
  const giorni = giorniProposti(partenza)
  const valida = scelta && scelta !== partenza && (coach || !eNelPassato(scelta))
  const restano = tutti ? testoRestano(chiSiSposta(assegnazioni, dataWorkout || dataAttuale).restano) : null
  const nome = separaCodice(titolo || '').nome || 'Allenamento'

  const conferma = async () => {
    if (!valida || salvando) return
    setSalvando(true)
    const ok = coach ? await onConferma(scelta, portata) : await onConferma(scelta)
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
        {conScelta && (
          <div role="radiogroup" aria-label="Chi sposti" className="relative grid grid-cols-2 bg-[#111] p-1.5 rounded-2xl border border-[#333]">
            <span aria-hidden="true" className={`absolute top-1.5 bottom-1.5 left-1.5 w-[calc(50%-0.375rem)] rounded-xl bg-[#2a2a2a] transition-transform duration-300 ease-out ${tutti ? 'translate-x-full' : ''}`} />
            {[['solo', `Solo ${nomeAtleta}`], ['tutti', `Tutti (${assegnazioni.length})`]].map(([valore, etichetta]) => (
              <button key={valore} type="button" role="radio" aria-checked={portata === valore}
                onClick={() => { setPortata(valore); setScelta(null) }}
                className={`relative z-10 py-2 text-[13px] font-bold truncate px-2 ${portata === valore ? 'text-white' : 'text-muted'}`}>
                {etichetta}
              </button>
            ))}
          </div>
        )}
        <p className={TESTO_MODALE}>
          {coach && !tutti && nomeAtleta ? (
            <><span className="text-white font-bold">{nomeAtleta}</span> ha <span className="text-white font-bold">{nome}</span>
              {partenza && <> in programma {dataBreve(partenza)}</>}. In che giorno lo sposti?</>
          ) : (
            <><span className="text-white font-bold">{nome}</span>
              {partenza && <> è in programma {dataBreve(partenza)}.</>} {coach ? 'In che giorno lo sposti?' : 'In che giorno lo fai?'}</>
          )}
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
          meseIniziale={partenza}
          placeholder="Un altro giorno…"
          className="bg-[#111] border border-[#333] rounded-xl px-4 py-3 hover:border-brand text-[14px]"
        />
        {restano && <p className="text-[12.5px] text-muted -mt-1">{restano}</p>}
        {!coach && scelta && eNelPassato(scelta) && (
          <p className="text-[12.5px] text-red-400 -mt-1">Scegli oggi o un giorno che deve ancora venire.</p>
        )}

        <div className="flex gap-3 mt-2">
          <button type="button" onClick={onChiudi} className={BOTTONE_QUIETO}>Annulla</button>
          <button type="button" onClick={conferma} disabled={!valida || salvando} className={BOTTONE_BRAND}>
            {salvando ? 'Sposto…' : valida ? `${tutti ? 'Sposta tutti a' : 'Sposta a'} ${giornoBreve(scelta)}` : 'Sposta'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
