import { useState } from 'react'
import { createPortal } from 'react-dom'
import { FileText, X } from 'lucide-react'
import {
  BOLLA_MODALE, BOTTONE_BRAND, BOTTONE_QUIETO, CARTA_MODALE, LABEL, TESTO_MODALE, TITOLO_MODALE, TONO_BOLLA,
} from '../lib/stiliCard'
import { LIMITI_PDF } from '../lib/templatePdf'
import { chiudiTastieraSuInvio } from '../useTastiera'

/**
 * «PDF delle schede» (Impostazioni → Solo coach): il nome che va in testa ai
 * PDF del coach e le note aggiuntive in fondo a tutti (src/lib/templatePdf.js).
 *
 * Sola presentazione, come gli altri Fogli: niente `supabase` qui. Salva chi
 * lo apre (`onSalva({ nome, note })` → `{ errore }`); con un errore il foglio
 * resta aperto, con il testo scritto, e lo mostra.
 *
 * ⚠️ Il tasto indietro di Android lo chiude perché ha la X «Chiudi» e il
 * bottone «Annulla» (src/lib/indietroAndroid.js).
 */
export function FoglioPdf({ valori, nomeAccount, onSalva, onChiudi }) {
  const [nome, setNome] = useState(valori?.nome || '')
  const [note, setNote] = useState(valori?.note || '')
  const [salvando, setSalvando] = useState(false)
  const [errore, setErrore] = useState(null)

  const salva = async () => {
    if (salvando) return
    setSalvando(true)
    setErrore(null)
    const esito = await onSalva({ nome, note })
    if (esito?.errore) {
      setErrore(esito.errore)
      setSalvando(false)
      return
    }
    onChiudi()
  }

  const CAMPO = 'w-full bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-[15px] text-white ' +
    'placeholder-[#5b6070] focus:outline-none focus:border-brand'

  return createPortal(
    <div className="fixed inset-0 bg-black/85 z-[110] flex items-center justify-center p-4 velo-in" onClick={onChiudi}>
      <div role="dialog" aria-modal="true" aria-label="PDF delle schede"
        className={`${CARTA_MODALE} relative`} onClick={e => e.stopPropagation()}>
        <button type="button" aria-label="Chiudi" onClick={onChiudi}
          className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center text-gray-400 hover:text-white">
          <X size={18} />
        </button>
        <div className={`${BOLLA_MODALE} ${TONO_BOLLA.avviso}`}><FileText size={26} aria-hidden="true" /></div>
        <h2 className={TITOLO_MODALE}>PDF delle schede</h2>
        <p className={TESTO_MODALE}>Il tuo nome in testa e le tue note in fondo a tutti i PDF dei workout che crei.</p>

        <label className="flex flex-col gap-1.5 text-left">
          <span className={LABEL}>Nome in intestazione</span>
          <input
            aria-label="Nome in intestazione"
            enterKeyHint="done"
            onKeyDown={chiudiTastieraSuInvio}
            maxLength={LIMITI_PDF.nome}
            placeholder={nomeAccount || ''}
            value={nome}
            onChange={e => setNome(e.target.value)}
            className={`${CAMPO} font-bold`}
          />
        </label>

        <label className="flex flex-col gap-1.5 text-left">
          <span className={LABEL}>Note aggiuntive</span>
          <textarea
            aria-label="Note aggiuntive"
            rows={5}
            maxLength={LIMITI_PDF.note}
            placeholder="Contatti, regole, un saluto…"
            value={note}
            onChange={e => setNote(e.target.value)}
            className={`${CAMPO} resize-none leading-relaxed`}
          />
          <span className="self-end text-[11.5px] text-gray-500 tabular-nums">{note.length} / {LIMITI_PDF.note}</span>
        </label>

        {errore && <p role="alert" className="text-[13px] text-red-400 text-left">{errore}</p>}

        <div className="flex gap-3 mt-1">
          <button type="button" onClick={onChiudi} className={BOTTONE_QUIETO}>Annulla</button>
          <button type="button" onClick={salva} disabled={salvando} className={BOTTONE_BRAND}>
            {salvando ? 'Salvo…' : 'Salva'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
