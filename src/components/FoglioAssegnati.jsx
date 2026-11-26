import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { CARD } from '../lib/stiliCard'
import { CampoRicerca } from './ArchivioUI'
import { filtraAssegnazioniPerNome } from '../lib/rigaAtleta'

// «Vedi tutti gli atleti» di «Assegnato a» (26/11/2026, richiesta del committente).
//
// Nella scheda l'elenco si ferma a poche righe e non scorre più: con trenta atleti
// era uno scorrimento senza fine, anche dentro la sua card. L'elenco intero sta
// qui, con la ricerca per nome. Le righe le disegna la pagina (`rigaDi`), così
// sono identiche a quelle della scheda, cestino compreso.
// ⚠️ La X ha `aria-label="Chiudi"`: è ciò che il tasto indietro di Android cerca.
// z-[140], sotto il CustomConfirm (150): il cestino di una riga chiede conferma sopra il foglio.
export default function FoglioAssegnati({ assegnati, rigaDi, onChiudi }) {
  const [cerca, setCerca] = useState('')
  const visibili = filtraAssegnazioniPerNome(assegnati, cerca)

  return createPortal(
    <div className="fixed inset-0 z-[140] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/70 velo-in" onClick={onChiudi} />
      <div role="dialog" aria-modal="true" aria-label="Tutti gli assegnati"
        className="relative bg-[#1e1e1e] border-t border-[#2a2a2a] rounded-t-3xl px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] h-[85dvh] flex flex-col sheet-in">
        <div className="w-10 h-1 rounded-full bg-[#383838] mx-auto mb-4" aria-hidden="true" />

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-xl font-black tracking-tight text-white">Assegnato a</h3>
            <p className="mt-1 text-sm text-muted">{assegnati.length} atleti</p>
          </div>
          <button aria-label="Chiudi" onClick={onChiudi}
            className="shrink-0 w-11 h-11 -mr-1 rounded-full bg-[#2a2a2a] flex items-center justify-center text-gray-300 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <CampoRicerca valore={cerca} onCambia={setCerca}
          etichetta="Cerca fra gli assegnati" placeholder="Cerca nome o cognome" />

        <div className="mt-3 flex-1 min-h-0 overflow-y-auto overscroll-contain">
          {visibili.length === 0 ? (
            <p className="px-1 pt-2 text-[13px] font-semibold text-muted">Nessun atleta con questo nome.</p>
          ) : (
            <div className={`${CARD} px-1.5 py-1 divide-y divide-white/[.07]`}>
              {visibili.map(rigaDi)}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
