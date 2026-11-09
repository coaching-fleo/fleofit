// TeamUI — sola presentazione delle pagine del Team (06/11/2026, spec
// docs/superpowers/specs/2026-11-06-team-design.md §6). Nessuna lettura, nessuno
// stato: le pagine (InvitoTeam, MieiTeam, Team, SchedaTeam, DettaglioSfida)
// passano i dati già pronti.
import { ChevronLeft, ChevronRight, Users } from 'lucide-react'
import { CARD, LABEL, META, RIGA, VETRO } from '../lib/stiliCard'
import { vibraScelta } from '../lib/aptica'
import { chiudiTastieraSuInvio } from '../useTastiera'

/**
 * L'interruttore, `role="switch"` con `aria-checked`. Copia di quello delle
 * Impostazioni e delle Scarpe: importarlo porterebbe un altro chunk intero.
 */
export function Interruttore({ attivo, onCambia, etichetta, occupato = false }) {
  return (
    <button type="button" role="switch" aria-checked={attivo} aria-label={etichetta} disabled={occupato}
      onClick={() => { vibraScelta(); onCambia() }}
      className={`shrink-0 w-[51px] h-[31px] rounded-full flex items-center p-0.5 transition-colors duration-200 disabled:opacity-50 ${
        attivo ? 'justify-end bg-brand shadow-[0_6px_12px_-4px_rgba(241,186,23,.5)]' : 'justify-start bg-white/10 border border-white/[.12]'}`}>
      <span aria-hidden="true"
        className={`w-[27px] h-[27px] rounded-full transition-colors ${attivo ? 'bg-white shadow-[0_1px_3px_rgba(0,0,0,.4)]' : 'bg-[#8b8f9c]'}`} />
    </button>
  )
}

export const CAMPO_TEAM = 'w-full bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-[15px] font-bold text-white ' +
  'placeholder-[#5b6070] focus:outline-none focus:border-brand'

/** Un campo di testo con etichetta, e l'errore sotto quando c'è. */
export function CampoTeam({ etichetta, valore, onChange, errore, ...resto }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={LABEL}>{etichetta}</span>
      <input aria-label={etichetta} enterKeyHint="done" onKeyDown={chiudiTastieraSuInvio}
        value={valore} onChange={e => onChange(e.target.value)}
        aria-invalid={errore ? true : undefined}
        className={`${CAMPO_TEAM} ${errore ? 'border-red-500' : ''}`} {...resto} />
      {errore && <span className="text-[12.5px] font-medium text-red-500">{errore}</span>}
    </label>
  )
}

/** Una pillola da scegliere (metrica, filtro). */
// `radio` = una scelta fra alternative (aria-checked), altrimenti un interruttore (aria-pressed).
export function Pillola({ attivo, onClick, radio = false, children }) {
  const stato = radio ? { role: 'radio', 'aria-checked': attivo } : { 'aria-pressed': attivo }
  return (
    <button type="button" {...stato} onClick={onClick}
      className={`shrink-0 min-h-9 px-3.5 rounded-full text-[13px] font-bold border transition ${
        attivo ? 'bg-brand text-black border-brand' : 'bg-white/[.04] text-gray-300 border-white/[.1] hover:border-white/25'}`}>
      {children}
    </button>
  )
}

/** La testata appiccicata: è cornice, sta fuori dalla cascata. */
export function TestataTeam({ titolo, dettaglio, onIndietro, azione }) {
  return (
    <div className="sticky top-0 z-20 -mx-4 px-4 pb-3 pt-1 bg-[#0B0B0B]/95 backdrop-blur max-w-2xl md:mx-auto">
      <div className="flex items-center gap-3">
        {onIndietro && (
          <button type="button" aria-label="Torna indietro" onClick={onIndietro}
            className={`w-10 h-10 rounded-full flex items-center justify-center text-gray-200 hover:text-white transition shrink-0 ${VETRO}`}>
            <ChevronLeft size={19} />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-black tracking-tight truncate">{titolo}</h1>
          {dettaglio && <p className={`${META} truncate`}>{dettaglio}</p>}
        </div>
        {azione}
      </div>
    </div>
  )
}

/** Le iniziali, per chi non ha la foto. */
const sigla = (nome = '', cognome = '') =>
  `${String(nome).trim()[0] || ''}${String(cognome).trim()[0] || ''}`.toUpperCase() || '·'

export function Avatar({ foto, nome, cognome, dimensione = 40 }) {
  const lato = { width: dimensione, height: dimensione }
  return foto
    ? <img src={foto} alt="" style={lato} className="rounded-full object-cover shrink-0" />
    : (
      <span aria-hidden="true" style={lato}
        className="rounded-full bg-[#2a2a2a] text-gray-300 text-[13px] font-bold flex items-center justify-center shrink-0">
        {sigla(nome, cognome)}
      </span>
    )
}

/** Un membro: nome, stato in parole, e un'azione facoltativa (Reinvita, Annulla). */
export function RigaMembro({ nome, cognome, foto, dettaglio, azione }) {
  return (
    <li className={`${RIGA} flex items-center gap-3 px-3.5 py-3`}>
      <Avatar foto={foto} nome={nome} cognome={cognome} />
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-bold text-white truncate">{`${nome || ''} ${cognome || ''}`.trim()}</p>
        {dettaglio && <p className={`${META} truncate`}>{dettaglio}</p>}
      </div>
      {azione}
    </li>
  )
}

/** Un team in una lista: tutta la riga è un bottone. */
export function RigaTeam({ nome, dettaglio, onApri }) {
  return (
    <li>
      <button type="button" onClick={onApri}
        className={`${RIGA} w-full flex items-center gap-3 px-3.5 py-3.5 text-left hover:border-white/20 transition`}>
        <span className="w-10 h-10 rounded-full bg-brand/10 border border-brand/30 text-brand flex items-center justify-center shrink-0">
          <Users size={18} aria-hidden="true" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[15px] font-bold text-white truncate">{nome}</span>
          {dettaglio && <span className={`block ${META} truncate`}>{dettaglio}</span>}
        </span>
        <ChevronRight size={18} aria-hidden="true" className="text-gray-500 shrink-0" />
      </button>
    </li>
  )
}

/** Una sfida in lista: data, allenamento, metrica, e com'è finita. */
export function RigaSfida({ data, titolo, metrica, esito, onApri }) {
  return (
    <li>
      <button type="button" onClick={onApri}
        className={`${RIGA} w-full flex items-center gap-3 px-3.5 py-3.5 text-left hover:border-white/20 transition`}>
        <span className="flex-1 min-w-0">
          <span className="block text-[15px] font-bold text-white truncate">{titolo}</span>
          <span className={`block ${META} truncate`}>{[data, metrica].filter(Boolean).join(' · ')}</span>
        </span>
        {esito && <span className="text-[13px] font-bold text-gray-300 shrink-0 max-w-[45%] truncate">{esito}</span>}
        <ChevronRight size={18} aria-hidden="true" className="text-gray-500 shrink-0" />
      </button>
    </li>
  )
}

/** Una sezione con l'etichetta e una lista. */
export function SezioneTeam({ etichetta, children, azione }) {
  return (
    <section aria-label={etichetta} className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-3 px-1">
        <h2 className={LABEL}>{etichetta}</h2>
        {azione}
      </div>
      {children}
    </section>
  )
}

/** Lo stato vuoto: bordo tratteggiato, icona in cerchio, testo grigio. */
export function VuotoTeam({ titolo, dettaglio, azione, onAzione }) {
  return (
    <div className="rounded-3xl border border-dashed border-[#333] px-6 py-10 flex flex-col items-center gap-3 text-center">
      <span className="w-14 h-14 rounded-full bg-[#1e1e1e] flex items-center justify-center text-gray-500">
        <Users size={24} aria-hidden="true" />
      </span>
      <p className="text-[15px] font-bold text-white">{titolo}</p>
      {dettaglio && <p className="text-[14px] text-gray-400 leading-relaxed max-w-xs">{dettaglio}</p>}
      {azione && (
        <button type="button" onClick={onAzione}
          className="mt-1 min-h-[44px] px-5 rounded-full bg-brand text-black text-[14px] font-extrabold hover:brightness-110 transition">
          {azione}
        </button>
      )}
    </div>
  )
}

/** Una carta semplice, per i blocchi della scheda. */
export function CartaTeam({ children, className = '' }) {
  return <div className={`${CARD} p-5 ${className}`}>{children}</div>
}
