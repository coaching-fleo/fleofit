// TeamUI — sola presentazione delle pagine del Team (06/11/2026, spec
// docs/superpowers/specs/2026-11-06-team-design.md §6). Nessuna lettura, nessuno
// stato: le pagine (InvitoTeam, MieiTeam, Team, SchedaTeam, DettaglioSfida)
// passano i dati già pronti.
import { ChevronLeft, ChevronRight, Crown, Dumbbell, Plus, Repeat, Route, Timer, Trophy, Users } from 'lucide-react'
import { CARD, LABEL, META, RIGA, VETRO } from '../lib/stiliCard'
import { vibraScelta } from '../lib/aptica'
import { nomeBreve } from '../lib/membriTeam'
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

/** `anello`: 'brand' per il primo, 'tenue' per gli altri posti, niente altrove. */
export function Avatar({ foto, nome, cognome, dimensione = 40, anello = null }) {
  const lato = { width: dimensione, height: dimensione }
  const cerchio = anello === 'brand'
    ? 'ring-2 ring-brand ring-offset-[3px] ring-offset-[#1a1a1c]'
    : anello === 'tenue' ? 'ring-1 ring-white/20 ring-offset-[3px] ring-offset-[#1a1a1c]' : ''
  return foto
    ? <img src={foto} alt="" style={lato} className={`rounded-full object-cover shrink-0 ${cerchio}`} />
    : (
      <span aria-hidden="true" style={{ ...lato, fontSize: Math.max(13, Math.round(dimensione * 0.32)) }}
        className={`rounded-full bg-gradient-to-b from-[#34343a] to-[#26262a] text-gray-200 font-black tracking-tight flex items-center justify-center shrink-0 ${cerchio}`}>
        {sigla(nome, cognome)}
      </span>
    )
}

/** «3 vittorie», «1 vittoria», e mai uno zero. */
const testoVittorie = (n) => (!n ? 'Nessuna vittoria' : n === 1 ? '1 vittoria' : `${n} vittorie`)

/**
 * I membri in fila, come una rubrica rapida: avatar grande e nome breve.
 * Il primo cerchio è «Invita» quando c'è `onInvita`.
 * @param membri [{ atleta_id, nome, cognome, foto }]
 */
export function StrisciaMembri({ membri, ioId, onInvita }) {
  return (
    <ul className="flex gap-3.5 overflow-x-auto hide-scrollbar -mx-5 px-5 pb-0.5">
      {onInvita && (
        <li className="shrink-0">
          <button type="button" onClick={onInvita} className="group w-[64px] flex flex-col items-center gap-2">
            <span className="w-[60px] h-[60px] rounded-full border border-dashed border-white/25 bg-white/[.03] text-gray-200 flex items-center justify-center transition group-hover:border-brand group-hover:text-brand">
              <Plus size={22} aria-hidden="true" />
            </span>
            <span className="text-[12.5px] font-bold text-gray-300">Invita</span>
          </button>
        </li>
      )}
      {membri.map(m => (
        <li key={m.atleta_id} className="shrink-0 w-[64px] flex flex-col items-center gap-2">
          <Avatar foto={m.foto} nome={m.nome} cognome={m.cognome} dimensione={60} />
          <span className="max-w-full text-[12.5px] font-bold text-white truncate">
            {m.atleta_id === ioId ? 'Tu' : nomeBreve(m.nome, m.cognome)}
          </span>
        </li>
      ))}
    </ul>
  )
}

// Altezze delle pedane: il primo sta più in alto. L'altezza segue la colonna,
// il giallo segue il POSTO: a pari merito due pedane sono gialle.
const PEDANA = { 1: 'h-[92px]', 2: 'h-[66px]', 3: 'h-[50px]' }

/**
 * Il podio dei primi tre (ordine a schermo 2-1-3). `classifica` è già ordinata
 * e porta `posto` (pari merito = stesso posto) e `n` (le vittorie).
 */
export function Podio({ classifica, ioId }) {
  const [primo, secondo, terzo] = classifica
  const slot = (m, gradino) => {
    if (!m) return <div />
    const alto = m.posto === 1 && m.n > 0
    return (
      <div className="min-w-0 flex flex-col items-center">
        <div className="relative flex flex-col items-center">
          {alto && <Crown size={22} aria-hidden="true" className="text-brand fill-brand/25 -mb-1 relative z-10 drop-shadow-[0_4px_8px_rgba(241,186,23,.35)]" />}
          <Avatar foto={m.foto} nome={m.nome} cognome={m.cognome} dimensione={gradino === 1 ? 72 : 56}
            anello={alto ? 'brand' : 'tenue'} />
        </div>
        <p className="mt-2.5 max-w-full px-1 text-[13.5px] font-bold text-white truncate">
          {m.atleta_id === ioId ? 'Tu' : nomeBreve(m.nome, m.cognome)}
        </p>
        {/* Sul podio lo spazio è un terzo di riga: «—» invece di «Nessuna vittoria». */}
        <p className={`text-[12.5px] font-black tabular-nums whitespace-nowrap ${alto ? 'text-brand' : 'text-gray-300'}`}>{m.n ? testoVittorie(m.n) : '—'}</p>
        <div className={`mt-3 w-full ${PEDANA[gradino]} rounded-t-2xl border border-b-0 flex items-start justify-center pt-2 ${
          alto
            ? 'bg-gradient-to-b from-brand/[.16] to-brand/[.03] border-brand/40'
            : 'bg-gradient-to-b from-white/[.07] to-white/[.015] border-white/[.09]'}`}>
          <span className={`text-[30px] leading-none font-black tracking-tight tabular-nums ${alto ? 'text-brand' : 'text-white/75'}`}>
            {m.posto}
          </span>
        </div>
      </div>
    )
  }
  return (
    <div className={`${CARD} px-4 pt-5 overflow-hidden`}>
      <div className="grid grid-cols-3 items-end gap-2.5">
        {slot(secondo, 2)}
        {slot(primo, 1)}
        {slot(terzo, 3)}
      </div>
    </div>
  )
}

/** Dal quarto posto in giù: posizione, avatar, nome, vittorie. */
export function RigaClassifica({ posto, nome, cognome, foto, n, tu }) {
  return (
    <li className={`${RIGA} flex items-center gap-3 px-3.5 py-2.5`}>
      <span className="w-8 h-8 rounded-full bg-white/[.06] text-[14px] font-black tabular-nums text-gray-200 flex items-center justify-center shrink-0">
        {posto}
      </span>
      <Avatar foto={foto} nome={nome} cognome={cognome} />
      <p className="flex-1 min-w-0 text-[15px] font-bold text-white truncate">{tu ? 'Tu' : `${nome || ''} ${cognome || ''}`.trim()}</p>
      <span className="shrink-0 text-[13px] font-black tabular-nums text-gray-300">{testoVittorie(n)}</span>
    </li>
  )
}

/**
 * Il testa a testa: due avatar e il punteggio in mezzo. Chi è avanti prende la
 * corona e l'anello giallo; a pari nessuno.
 */
export function Duello({ x, y, a, b, ioId, children }) {
  const lato = (m, mie, loro) => {
    const avanti = mie > loro
    return (
      <div className="min-w-0 flex flex-col items-center">
        <div className="h-[22px] flex items-end">
          {avanti && <Crown size={20} aria-hidden="true" className="text-brand fill-brand/25 drop-shadow-[0_4px_8px_rgba(241,186,23,.35)]" />}
        </div>
        <Avatar foto={m.foto} nome={m.nome} cognome={m.cognome} dimensione={64} anello={avanti ? 'brand' : 'tenue'} />
        <p className="mt-2.5 max-w-full text-[14px] font-bold text-white truncate">
          {m.atleta_id === ioId ? 'Tu' : nomeBreve(m.nome, m.cognome)}
        </p>
      </div>
    )
  }
  return (
    <div className={`${CARD} p-5 flex flex-col gap-4`}>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        {lato(x, a, b)}
        <span className="pt-4 text-[40px] leading-none font-black tracking-tight tabular-nums text-white">{`${a}–${b}`}</span>
        {lato(y, b, a)}
      </div>
      {children}
    </div>
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

const ICONA_METRICA = { tempo: Timer, ripetizioni: Repeat, kg: Dumbbell, distanza: Route }

/**
 * Una sfida in lista: l'icona di cosa si misura, allenamento, giorno, e lo stato
 * a destra («In corso» in giallo, oppure com'è finita).
 */
export function RigaSfida({ data, titolo, metrica, chiave, aperta, esito, onApri }) {
  const Icona = ICONA_METRICA[chiave] || Trophy
  return (
    <li>
      <button type="button" onClick={onApri}
        className={`${RIGA} w-full flex items-center gap-3 px-3.5 py-3 text-left hover:border-white/20 transition`}>
        <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
          aperta ? 'bg-brand/10 text-brand border border-brand/25' : 'bg-white/[.05] text-gray-300 border border-white/[.07]'}`}>
          <Icona size={18} aria-hidden="true" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[15px] font-bold text-white truncate">{titolo}</span>
          <span className="mt-1 flex items-center gap-2 min-w-0">
            <span className={`${META} truncate`}>{[data, metrica].filter(Boolean).join(' · ')}</span>
            {aperta ? (
              <span className="ml-auto shrink-0 inline-flex items-center gap-1.5 rounded-full bg-brand/10 border border-brand/30 px-2 py-0.5 text-[11.5px] font-bold text-brand">
                <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
                In corso
              </span>
            ) : esito && (
              <span className="ml-auto shrink-0 max-w-[55%] inline-flex items-center gap-1 text-[12px] font-bold text-gray-300">
                <Trophy size={12} aria-hidden="true" className="shrink-0 text-gray-400" />
                <span className="truncate">{esito}</span>
              </span>
            )}
          </span>
        </span>
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
