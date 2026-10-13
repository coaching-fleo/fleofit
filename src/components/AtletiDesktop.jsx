// AtletiDesktop.jsx — la rubrica degli atleti sulla versione desktop.
//
// Sul telefono è una lista di righe; sul computer è una TABELLA, perché le
// colonne si confrontano a colpo d'occhio: chi ha fatto la settimana, chi è
// fermo da quanto, chi è in pausa. Stessi dati e stesse azioni della pagina
// mobile (Athletes.jsx), che li prepara; qui c'è solo il disegno.
// Si carica pigra: il telefono non la scarica mai.

import { Plus, User, ChevronRight, RotateCcw, AlertTriangle } from 'lucide-react'
import { CampoRicerca } from './ArchivioUI'
import { FiltriStato } from './AtletiUI'

function Avatar({ foto, sigla }) {
  return (
    <span className="w-10 h-10 rounded-full bg-[#2a2a2a] shrink-0 overflow-hidden flex items-center justify-center text-gray-300 text-[13px] font-extrabold">
      {foto
        ? <img src={foto} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.style.opacity = 0 }} />
        : (sigla || <User size={16} aria-hidden="true" />)}
    </span>
  )
}

/** Completati su assegnati della settimana, con la barra. «—» se non c'è niente in programma. */
function Settimana({ assegnati, completati, quota }) {
  if (!assegnati) return <span className="text-sm font-bold text-[#4f5462]">—</span>
  const colore = quota >= 1 ? 'bg-green-500' : quota >= 0.5 ? 'bg-brand' : 'bg-orange-400'
  return (
    <span className="flex items-center gap-3">
      <span className="text-sm font-extrabold text-white tabular-nums w-10">{completati}<span className="text-gray-500">/{assegnati}</span></span>
      <span aria-hidden="true" className="w-24 h-1.5 rounded-full bg-[#2a2a2a] overflow-hidden">
        <span className={`block h-1.5 rounded-full ${colore}`} style={{ width: `${Math.round(quota * 100)}%` }} />
      </span>
    </span>
  )
}

function Stato({ riga }) {
  if (riga.stato === 'eliminato') return <span className="text-[13px] font-bold text-red-400">Eliminato · {riga.giorniCestino} gg</span>
  if (riga.stato === 'pausa') return <span className="text-[13px] font-bold text-orange-400">In pausa{riga.pausaTesto ? ` · ${riga.pausaTesto}` : ''}</span>
  if (riga.fermo) return <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-orange-400"><AlertTriangle size={14} aria-hidden="true" />Da richiamare</span>
  return <span className="text-[13px] font-bold text-green-400">Attivo</span>
}

export default function AtletiDesktop({
  dettaglio, search, onSearch, conteggi, vista, onVista, onNuovo,
  loading, righe, fermi, onRichiamo, vuoto, notaCestino,
}) {
  return (
    <div className="px-10 pt-8 pb-[var(--fondo-pagina)] max-w-[1280px] mx-auto flex flex-col gap-6 cascata">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[34px] font-black tracking-[-.03em] text-white">Atleti</h1>
          {dettaglio && <p className="mt-1 text-sm font-semibold text-gray-400">{dettaglio}</p>}
        </div>
        <button type="button" onClick={onNuovo}
          className="inline-flex items-center gap-2 h-11 px-[18px] rounded-xl bg-brand text-black text-sm font-extrabold hover:brightness-110">
          <Plus size={18} strokeWidth={2.5} aria-hidden="true" />Nuovo atleta
        </button>
      </header>

      <div className="flex flex-wrap items-center gap-4">
        <div className="w-[360px] max-w-full -mt-3.5">
          <CampoRicerca valore={search} onCambia={onSearch} etichetta="Cerca un atleta" placeholder="Cerca nome o cognome" />
        </div>
        <div className="-mt-3">
          <FiltriStato conteggi={conteggi} vista={vista} onCambia={onVista} />
        </div>
        {fermi > 0 && (vista === 'attivi' || vista === 'fermi') && (
          <button type="button" onClick={onRichiamo} aria-pressed={vista === 'fermi'}
            className={`ml-auto inline-flex items-center gap-2 h-9 px-3.5 rounded-full text-[13px] font-bold border transition ${
              vista === 'fermi' ? 'bg-orange-400 text-black border-orange-400' : 'border-orange-400/40 text-orange-400 hover:bg-orange-400/10'}`}>
            <AlertTriangle size={14} aria-hidden="true" />{fermi} da richiamare
          </button>
        )}
      </div>

      <div className="rounded-3xl bg-[#1e1e1e] border border-[#2a2a2a] overflow-hidden">
        <div className="grid grid-cols-[minmax(0,2.2fr)_minmax(0,1.2fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.2fr)_40px] gap-4 px-6 py-3 border-b border-[#2a2a2a]
                        text-[11px] font-bold uppercase tracking-[.08em] text-gray-400">
          <span>Atleta</span><span>Dati</span><span>Questa settimana</span><span>Ultimo</span><span>Stato</span><span />
        </div>
        {loading ? (
          [0, 1, 2, 3, 4].map(i => <div key={i} className="h-16 border-b border-[#262626] animate-pulse" />)
        ) : righe.length === 0 ? (
          <div className="px-6 py-14 text-center text-sm text-gray-400">{vuoto}</div>
        ) : righe.map(r => {
          const contenuto = (
            <>
              <span className="flex items-center gap-3 min-w-0">
                <Avatar foto={r.foto} sigla={r.sigla} />
                <span className="text-[15px] font-bold text-white truncate group-hover:text-brand transition">{r.nome}</span>
              </span>
              <span className="text-[13px] text-gray-400 truncate">{r.meta || '—'}</span>
              <Settimana {...r.aderenza} />
              <span className={`text-[13px] ${r.fermo ? 'text-orange-400 font-bold' : 'text-gray-300'}`}>{r.ultimo || '—'}</span>
              <Stato riga={r} />
            </>
          )
          const griglia = 'grid grid-cols-[minmax(0,2.2fr)_minmax(0,1.2fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.2fr)_40px] gap-4 items-center px-6 py-3 border-b border-[#262626] last:border-b-0'
          return r.stato === 'eliminato' ? (
            <div key={r.id} className={`${griglia} opacity-80`}>
              {contenuto}
              <button type="button" onClick={r.onRipristina} aria-label={`Ripristina ${r.nome}`} title="Ripristina"
                className="w-9 h-9 rounded-full flex items-center justify-center text-gray-300 hover:text-white hover:bg-white/[.06]">
                <RotateCcw size={16} />
              </button>
            </div>
          ) : (
            <button key={r.id} type="button" onClick={r.onApri} aria-label={`Apri la scheda di ${r.nome}`}
              className={`${griglia} w-full text-left group transition hover:bg-white/[.03]`}>
              {contenuto}
              <ChevronRight size={16} className="text-[#4f5462] group-hover:text-white" aria-hidden="true" />
            </button>
          )
        })}
      </div>

      {notaCestino && <p className="text-xs leading-relaxed text-gray-400">{notaCestino}</p>}
    </div>
  )
}
