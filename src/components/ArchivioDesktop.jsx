// ArchivioDesktop.jsx — l'archivio dei workout sulla versione desktop.
//
// I filtri in una colonna fissa a sinistra (sono gli stessi componenti del
// telefono) e i workout in una griglia di schede, raggruppati per mese.
// Dati, filtri e azioni li prepara WorkoutsArchive.jsx; qui c'è solo il disegno.
// Si carica pigra: il telefono non la scarica mai.

import { Users, Check, ChevronLeft } from 'lucide-react'
import { corsia } from '../lib/categorie'
import { separaCodice } from '../lib/codiceWorkout'

function Scheda({ categoria, titolo, meta, assegnati, completato, onApri }) {
  const c = corsia(categoria)
  const { nome, codice } = separaCodice(titolo)
  return (
    <button type="button" onClick={onApri}
      className="text-left rounded-[20px] bg-[#1e1e1e] border border-[#2a2a2a] p-4 flex flex-col gap-3 min-h-[132px]
                 transition hover:border-[#444] hover:-translate-y-px">
      <span className="flex items-center justify-between gap-2">
        <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${c.txt}`}>
          <span aria-hidden="true" className={`w-2 h-2 rounded-full ${c.dot}`} />{c.etichetta}
        </span>
        {codice && (
          <span className="text-[11px] font-extrabold text-brand bg-brand/10 border border-brand/30 rounded-full px-2 py-0.5 tabular-nums truncate max-w-[60%]">
            {codice}
          </span>
        )}
      </span>
      <span className="text-[15px] font-extrabold text-white leading-snug line-clamp-2">{nome || 'Senza titolo'}</span>
      <span className="mt-auto flex items-center justify-between gap-2 text-[12.5px] text-gray-400">
        <span className="truncate">{meta}</span>
        {assegnati !== undefined && (
          <span className="shrink-0 inline-flex items-center gap-1 text-gray-200" title={`Assegnato a ${assegnati} ${assegnati === 1 ? 'atleta' : 'atleti'}`}>
            <Users size={13} className="text-gray-500" aria-hidden="true" />
            <span className="font-black">{assegnati}</span>
          </span>
        )}
        {completato && (
          <span className="shrink-0 w-[22px] h-[22px] rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center text-green-500">
            <Check size={13} strokeWidth={3} aria-label="completato" />
          </span>
        )}
      </span>
    </button>
  )
}

export default function ArchivioDesktop({ dettaglio, onIndietro, filtri, loading, gruppi, vuoto, schede }) {
  return (
    <div className="px-10 pt-8 pb-[var(--fondo-pagina)] max-w-[1400px] mx-auto flex gap-8 items-start cascata">
      <aside aria-label="Filtri dell'archivio"
        className="filtri-archivio w-[300px] shrink-0 sticky top-6 max-h-[calc(100vh-48px)] overflow-y-auto pb-4">
        <div className="flex items-center gap-2">
          {onIndietro && (
            <button type="button" onClick={onIndietro} aria-label="Indietro"
              className="w-9 h-9 rounded-full bg-[#1e1e1e] border border-[#2a2a2a] text-gray-300 flex items-center justify-center hover:text-white">
              <ChevronLeft size={17} />
            </button>
          )}
          <h1 className="text-[30px] font-black tracking-[-.03em] text-white">Archivio</h1>
        </div>
        {dettaglio && <p className="mt-1 text-sm font-semibold text-gray-400">{dettaglio}</p>}
        <div className="mt-2 flex flex-col gap-2">{filtri}</div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col gap-8">
        {loading ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
            {Array.from({ length: 9 }, (_, i) => <div key={i} className="h-[132px] rounded-[20px] bg-[#1e1e1e] border border-[#2a2a2a] animate-pulse" />)}
          </div>
        ) : gruppi.length === 0 ? vuoto : gruppi.map(g => (
          <section key={g.chiave} aria-label={g.etichetta}>
            <div className="flex items-baseline gap-3 mb-3">
              <h2 className="text-lg font-extrabold text-white first-letter:uppercase">{g.etichetta}</h2>
              <span className="text-sm text-gray-400">{g.workouts.length}</span>
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
              {g.workouts.map(w => <Scheda key={w.aw_id || w.id} {...schede(w)} />)}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
