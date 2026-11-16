// I gruppi di atleti nel foglio «Assegna Workout» (16/11/2026, docs/memoria/atleti.md):
// la riga di chip e la piccola modale «Salva come gruppo».
// ⚠️ Questo file entra nel chunk di WorkoutDetail: niente librerie, niente logica
// che non sia di presentazione (quella sta in src/lib/gruppiAtleti.js).
// ⚠️ La modale ha la X «Chiudi» e «Annulla»: il tasto indietro di Android le trova.
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { NOME_MAX, membriVisibili, statoGruppo } from '../lib/gruppiAtleti'
import { BOTTONE_BRAND, BOTTONE_QUIETO, CARTA_MODALE, TITOLO_MODALE, TESTO_MODALE } from '../lib/stiliCard'

/** La riga dei gruppi: un tocco spunta (o toglie) tutti i membri visibili. */
export function ChipGruppi({ gruppi, scelti, atleti, onAlterna }) {
  if (!gruppi?.length) return null
  return (
    <div>
      <p className="text-gray-400 text-sm mb-2 px-1">Gruppi</p>
      <div className="flex gap-2 overflow-x-auto hide-scrollbar -mx-1 px-1 pb-1">
        {gruppi.map(g => {
          const stato = statoGruppo(g, scelti, atleti)
          const quanti = membriVisibili(g, atleti).length
          const pieno = stato === 'tutti'
          return (
            <button key={g.id} type="button" disabled={stato === 'vuoto'}
              aria-pressed={pieno}
              aria-label={`Gruppo ${g.nome}, ${quanti === 1 ? '1 atleta' : `${quanti} atleti`}`}
              onClick={() => onAlterna(g)}
              className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-bold border transition disabled:opacity-40 ${
                pieno ? 'bg-brand border-brand text-black' : 'bg-[#2a2a2a] border-[#333] text-white hover:border-brand'}`}>
              <span className="max-w-[12rem] truncate">{g.nome}</span>
              <span className={pieno ? 'text-black/60' : 'text-gray-400'}>{quanti}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Il nome del gruppo nuovo. `onSalva(nome)` torna un messaggio d'errore da
 * mostrare qui, o `null` se è andata (e allora chi apre chiude la modale).
 */
export function FoglioNomeGruppo({ conteggio, onSalva, onChiudi }) {
  const [nome, setNome] = useState('')
  const [errore, setErrore] = useState(null)
  const [invio, setInvio] = useState(false)

  const salva = async () => {
    if (invio) return
    setInvio(true)
    const e = await onSalva(nome)
    setInvio(false)
    if (e) setErrore(e)
  }

  return createPortal(
    <div className="fixed inset-0 bg-black/85 z-[150] flex items-center justify-center p-4 velo-in">
      <div role="dialog" aria-modal="true" aria-label="Salva come gruppo" className={`${CARTA_MODALE} relative`}>
        <button type="button" aria-label="Chiudi" onClick={onChiudi}
          className="absolute top-4 right-4 text-muted hover:text-white"><X size={20} /></button>
        <h2 className={TITOLO_MODALE}>Salva come gruppo</h2>
        <p className={TESTO_MODALE}>
          {conteggio === 1 ? '1 atleta' : `${conteggio} atleti`}. La prossima volta li scegli con un tocco; loro non lo vedono.
        </p>
        <label className="text-left">
          <span className="sr-only">Nome del gruppo</span>
          <input type="text" value={nome} maxLength={NOME_MAX} autoFocus
            onChange={(e) => { setNome(e.target.value); setErrore(null) }}
            onKeyDown={(e) => { if (e.key === 'Enter') salva() }}
            placeholder="Es. Hyrox martedì"
            className="w-full bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-base text-white placeholder:text-gray-600 focus:border-brand outline-none" />
        </label>
        {errore && <p role="alert" className="text-red-400 text-sm text-left">{errore}</p>}
        <div className="flex gap-3 mt-2">
          <button type="button" onClick={onChiudi} className={BOTTONE_QUIETO}>Annulla</button>
          <button type="button" onClick={salva} disabled={invio} className={`${BOTTONE_BRAND} disabled:opacity-50`}>
            {invio ? 'Salvo…' : 'Salva'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
