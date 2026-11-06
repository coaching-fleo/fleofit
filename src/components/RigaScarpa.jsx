import { useState } from 'react'
import { ChevronRight, Check, Footprints } from 'lucide-react'
import { LABEL } from '../lib/stiliCard'
import { vibraScelta } from '../lib/aptica'

// «Scarpe da corsa», la riga «Scarpa: <modello> ›» (spec §2): sta nel foglio
// «Com'è andata?» e nella scheda di un allenamento completato. Sola
// presentazione: chi la monta decide cosa vuol dire scegliere.
//
// ⚠️ L'elenco si apre DENTRO la riga, non in un foglio: il foglio RPE è già una
// modale, e un secondo foglio sopra avrebbe due «Annulla» e due tasti indietro.
// ⚠️ Volutamente piccola e senza ScarpeUI: entra nei chunk di Home e
// WorkoutDetail, che non devono portarsi dietro la pagina /scarpe.

/**
 * @param attive    le scarpe attive dell'atleta ({ id, marca, modello })
 * @param sceltaId  l'id scelto, o `null` («Nessuna»)
 * @param scelta    facoltativa: la scarpa scelta quando non è fra le attive
 *                  (un allenamento vecchio con una scarpa ora ritirata)
 * @param vuoto     cosa dire senza scelta: «Nessuna» nel foglio RPE,
 *                  «Aggiungi scarpa» nella scheda
 * @param onCambia  (id | null) => void
 */
export default function RigaScarpa({ attive = [], sceltaId = null, scelta, vuoto = 'Nessuna', onCambia }) {
  const [aperta, setAperta] = useState(false)
  const corrente = scelta ?? attive.find(s => s.id === sceltaId) ?? null
  const testo = corrente ? `Scarpa: ${corrente.modello}` : (vuoto === 'Nessuna' ? 'Scarpa: Nessuna' : vuoto)

  const scegli = (id) => {
    setAperta(false)
    if (id !== sceltaId) { vibraScelta(); onCambia?.(id) }
  }

  const voce = (id, marca, modello) => {
    const attiva = id === sceltaId
    return (
      <button key={id ?? 'nessuna'} type="button" role="option" aria-selected={attiva}
        onClick={() => scegli(id)}
        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition ${
          attiva ? 'bg-brand/[.08]' : 'hover:bg-white/[.04]'}`}>
        <span className="flex-1 min-w-0">
          {marca && <span className={`block ${LABEL}`}>{marca}</span>}
          <span className="block text-[14.5px] font-bold text-white truncate">{modello}</span>
        </span>
        {attiva && <Check size={16} strokeWidth={3} className="shrink-0 text-brand" aria-hidden="true" />}
      </button>
    )
  }

  return (
    <div className="rounded-2xl bg-[#111] border border-[#333]">
      <button type="button" onClick={() => setAperta(v => !v)} aria-expanded={aperta}
        className="w-full flex items-center gap-2.5 px-4 py-3 text-left">
        <Footprints size={17} className="shrink-0 text-running" aria-hidden="true" />
        <span className="flex-1 min-w-0 text-[14.5px] font-bold text-white truncate">{testo}</span>
        <ChevronRight size={17} aria-hidden="true"
          className={`shrink-0 text-muted transition-transform duration-200 ${aperta ? 'rotate-90' : ''}`} />
      </button>
      {aperta && (
        <div role="listbox" aria-label="Scegli la scarpa" className="px-1.5 pb-1.5 flex flex-col gap-0.5 border-t border-[#2a2a2a] pt-1.5">
          {attive.map(s => voce(s.id, s.marca, s.modello))}
          {voce(null, null, 'Nessuna')}
        </div>
      )}
    </div>
  )
}
