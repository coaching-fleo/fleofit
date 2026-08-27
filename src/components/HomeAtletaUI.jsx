// HomeAtletaUI.jsx — i pezzi visivi della Home dell'atleta.
//
// Sono componenti di SOLA PRESENTAZIONE: ricevono i dati che Home.jsx già
// calcola (todayWorkouts, weeklyStatus, weeklyStats, upcomingWorkouts,
// nextEventHome) e i callback che esistono già. Nessun fetch, nessuno stato,
// nessuna regola di dominio: se qui dentro compare una `supabase` o un
// `useEffect`, è finito nel file sbagliato.
//
// Perché esistono: il ramo atleta di Home.jsx era ~200 righe di JSX inline con
// le stesse quattro classi ripetute in sette punti. Estrarle qui rende la
// pagina leggibile e — soprattutto — rende CARD e LABEL modificabili in un
// punto solo.
//
// Token: brand / running / custom / muted arrivano da @theme in index.css.
// I VALORI dei colori non cambiano (CLAUDE.md regola 3).

import { CalendarDays, CheckCircle2, ChevronRight, Plus, Activity } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
// CARD, LABEL e la tabella delle corsie vivono in lib/ perché HomeCoachUI.jsx
// usa le stesse: esportarle da QUESTO file costerebbe il Fast Refresh
// dell'intero modulo (react-refresh/only-export-components).
import { CARD, LABEL, RIGA } from '../lib/stiliCard'
import { corsia } from '../lib/categorie'


// ── Header: data e saluto, azioni in vetro ────────────────────────────────
// Il logo FLEOFIT esce dalla Home: è già nella splash e nell'icona dell'app, e
// qui occupava la riga più importante dello schermo per dire una cosa che
// l'utente sa già.
export function HeaderHome({ saluto, nome, dataOggi, settimana, motivazione, azioni }) {
  return (
    <div className="flex items-start justify-between gap-3 px-0.5 pt-1.5 pb-0.5">
      <div className="min-w-0">
        <p className={`${LABEL} mb-[3px] tracking-[.12em]`}>
          {dataOggi}{settimana ? ` · Settimana ${settimana}` : ''}
        </p>
        <h1 className="text-[26px] font-black tracking-[-.03em] leading-[1.12] text-white text-balance">{saluto}, {nome}</h1>
        {motivazione && <p className="mt-1 text-[12.5px] font-medium text-brand/80 line-clamp-2">{motivazione}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">{azioni}</div>
    </div>
  )
}

/**
 * Bottone-azione in vetro, al posto del cerchio pieno su #1e1e1e.
 *
 * ⚠️ `label` finisce in aria-label ed è l'unico testo che un lettore di schermo
 * annuncia: il pallino del badge è decorativo, quindi il conteggio va DENTRO
 * l'etichetta o sparisce per chi non vede.
 */
export function BottoneVetro({ label, onClick, children, badge = false, title }) {
  return (
    <button aria-label={label} title={title || label} onClick={onClick}
      className="relative w-11 h-11 rounded-full bg-white/[.06] border border-white/10 backdrop-blur-xl
                 text-gray-200 flex items-center justify-center transition active:scale-95 shrink-0
                 shadow-[inset_0_1px_0_rgba(255,255,255,.08)] hover:border-brand/50 hover:text-white">
      {children}
      {badge && <span aria-hidden="true" className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full bg-brand border-2 border-[#0f0f0f]" />}
    </button>
  )
}

// ── L'eroe: l'allenamento di oggi ─────────────────────────────────────────
//
// Occupa il primo schermo da solo. È l'unica informazione per cui l'atleta
// apre l'app, e prima arrivava dopo due schermate di scroll con lo stesso peso
// visivo della card "Calendario".
//
// meta = [{ etichetta, valore, unita?, evidenza? }] — durata, blocchi, RPE.
// Se un valore manca, il chiamante passa meno voci: la riga si adatta.
//
// ⚠️ Nessuna animazione CSS su QUESTO nodo. È l'elemento su cui lo swipe di
// completamento scrive `style.transform` a ogni movimento del dito, e
// un'animazione con `fill: both` sullo stesso nodo vince sullo stile inline:
// la card resterebbe immobile sotto il dito. L'entrata `hero-transition` la
// mette Home.jsx sul contenitore, che invece non viene mai trasformato.
export function HeroOggi({ titolo, categoria, stato, meta = [], completato, onOpen, onToggle, azioni, swipe = {} }) {
  const c = corsia(categoria)
  const Icona = completato ? CheckCircle2 : c.icona
  return (
    <div {...swipe}
      className={`relative overflow-hidden rounded-[26px] p-[22px] border ${completato
        ? 'border-green-500/25 bg-gradient-to-br from-[#16231a] via-[#181a18] to-[#161618]'
        : 'border-brand/20 bg-gradient-to-br from-[#232019] via-[#1b1b1d] to-[#161618]'
        } shadow-[0_24px_48px_-20px_rgba(0,0,0,.9),inset_0_1px_0_rgba(255,255,255,.07)]`}>
      {/* Alone di categoria: profondità atmosferica, non un gradiente saturo. */}
      <div aria-hidden="true" className={`pointer-events-none absolute -top-32 -right-24 w-64 h-64 rounded-full blur-2xl
        ${completato ? 'bg-green-500/10' : 'bg-brand/[.14]'}`} />
      <div aria-hidden="true" className="pointer-events-none absolute top-0 right-0 p-[18px] opacity-[.09] -rotate-12">
        <Icona size={104} className={completato ? 'text-green-500' : c.txt} />
      </div>

      <div className="relative flex flex-col gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-[.08em]
            ${completato ? 'bg-green-500 text-black' : `${c.bg} ${c.testoSuBg}`}`}>
            {c.etichetta}
          </span>
          <span className={LABEL}>{stato}</span>
        </div>

        <button onClick={onOpen} aria-label={`Apri ${titolo}`} className="text-left rounded-xl -mx-1 px-1 transition hover:opacity-80">
          <h2 className="text-[29px] font-black leading-[1.04] tracking-[-.03em] text-white text-pretty">{titolo}</h2>
        </button>

        {meta.length > 0 && (
          <div className="flex gap-2">
            {meta.map(m => (
              <div key={m.etichetta} className="flex-1 min-w-0 rounded-2xl bg-black/40 border border-white/[.07] px-3 py-2.5">
                <p className={`${LABEL} truncate`}>{m.etichetta}</p>
                <p className={`mt-1.5 text-[19px] font-black tracking-[-.02em] ${m.evidenza && !completato ? c.txt : 'text-white'}`}>
                  {m.valore}{m.unita && <span className="text-xs font-semibold text-muted">{m.unita}</span>}
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2.5">
          <button onClick={onToggle}
            className={`flex-1 min-h-[50px] rounded-[15px] font-black text-[15px] inline-flex items-center justify-center gap-2 transition active:scale-[.98]
              ${completato
                ? 'bg-green-500/15 text-green-400 border border-green-500/30 hover:bg-green-500/25'
                : 'bg-brand text-black shadow-[0_12px_24px_-8px_rgba(241,186,23,.45),inset_0_1px_0_rgba(255,255,255,.35)] hover:brightness-110'}`}>
            <CheckCircle2 size={18} /> {completato ? 'Fatto' : 'Completa'}
          </button>
          <button onClick={onOpen}
            className="w-[118px] min-h-[50px] rounded-[15px] bg-white/[.07] border border-white/[.12] text-white text-sm font-bold
                       shadow-[inset_0_1px_0_rgba(255,255,255,.08)] transition active:scale-[.98] hover:border-white/25">
            Apri scheda
          </button>
        </div>

        {azioni && <div className="flex items-center gap-2">{azioni}</div>}
      </div>
    </div>
  )
}

/** Giorno di rest: stessa gerarchia dell'eroe, tratteggio invariato. */
export function HeroRest() {
  return (
    <div className="rounded-[26px] border border-dashed border-white/[.13] p-6 flex items-center gap-4 hero-transition">
      <div className="w-12 h-12 rounded-full bg-white/[.06] border border-white/10 flex items-center justify-center text-muted shrink-0">
        <CalendarDays size={22} />
      </div>
      <div>
        <h3 className="text-white font-bold">Giorno di rest</h3>
        <p className="text-muted text-sm">Recupera le energie per il prossimo allenamento.</p>
      </div>
    </div>
  )
}

// ── L'anello della settimana ──────────────────────────────────────────────
//
// Sostituisce lo slider a due slide. Lo slider nascondeva le statistiche
// dietro un gesto che niente segnalava: chi non scorreva non sapeva che
// esistessero. I sette giorni restano, ma come traccia sotto il dato, non
// come contenuto principale.
export function AnelloSettimana({ weeklyStatus = [], onGiorno }) {
  const totale = weeklyStatus.reduce((a, d) => a + d.workouts.length, 0)
  const fatti = weeklyStatus.reduce((a, d) => a + d.workouts.filter(w => w.status === 'completed').length, 0)
  const CIRCONFERENZA = 2 * Math.PI * 54          // 339.29 — vedi ringIn in index.css
  const offset = totale ? CIRCONFERENZA * (1 - fatti / totale) : CIRCONFERENZA

  return (
    <div className={`${CARD} p-[18px] flex flex-col gap-3.5`}>
      <p className={LABEL}>Settimana</p>
      <div className="relative w-28 h-28 mx-auto">
        <svg viewBox="0 0 120 120" className="w-28 h-28 -rotate-90" role="img"
          aria-label={`${fatti} allenamenti completati su ${totale} questa settimana`}>
          <circle cx="60" cy="60" r="54" fill="none" strokeWidth="11" className="stroke-white/[.07]" />
          <circle cx="60" cy="60" r="54" fill="none" strokeWidth="11" strokeLinecap="round"
            className="stroke-brand anello-progresso"
            strokeDasharray={CIRCONFERENZA} strokeDashoffset={offset} />
        </svg>
        <div aria-hidden="true" className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-black tracking-[-.04em] text-white leading-none">
            {fatti}<span className="text-lg text-muted">/{totale}</span>
          </span>
          <span className="text-[11px] font-bold uppercase tracking-[.02em] text-muted mt-1">completati</span>
        </div>
      </div>
      <div className="flex justify-between items-center">
        {weeklyStatus.map((d, i) => {
          const fatto = d.workouts.some(w => w.status === 'completed')
          const previsto = d.workouts[0]
          const colore = fatto ? 'bg-green-500' : previsto ? corsia(categoriaGiorno(previsto)).dot : 'bg-white/[.13]'
          const apribile = previsto?.workoutId && onGiorno
          const Punto = apribile ? 'button' : 'span'
          return (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <span className={`text-[11px] font-bold ${d.isToday ? 'text-white' : 'text-muted'}`}>{d.dayName.charAt(0)}</span>
              <Punto
                {...(apribile ? { onClick: () => onGiorno(previsto), 'aria-label': `Apri ${previsto.title}`, type: 'button' } : { 'aria-hidden': 'true' })}
                className={`block rounded-full ${colore} ${d.isToday ? 'w-2.5 h-2.5 shadow-[0_0_8px_rgba(241,186,23,.6)]' : 'w-[7px] h-[7px]'}`} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// weeklyStatus porta già la categoria appiattita da Home.jsx, ma 'Autonomo'
// non è una corsia: va ricondotto a Custom come ovunque nel resto della Home.
const categoriaGiorno = (w) => (w.category === 'Autonomo' ? 'Custom' : w.category)

// ── Le due celle piccole del bento ────────────────────────────────────────

/** `ultime` = percentuali 0-100, le dà barreUltimiGiorni in lib/statistiche.js */
export function CellaSerie({ giorni, ultime = [] }) {
  return (
    <div className={`${CARD} p-4 flex-1`}>
      <p className={LABEL}>Serie</p>
      <p className="mt-2.5 text-[34px] font-black tracking-[-.04em] text-white leading-none">
        {giorni}<span className="text-[13px] font-semibold text-muted tracking-normal"> {giorni === 1 ? 'giorno' : 'giorni'}</span>
      </p>
      <div aria-hidden="true" className="flex items-end gap-1 h-[34px] mt-3">
        {ultime.map((v, i) => (
          <span key={i} style={{ height: `${Math.max(12, v)}%` }}
            className={`flex-1 rounded-[3px] ${i === ultime.length - 1 ? 'bg-brand shadow-[0_0_10px_rgba(241,186,23,.5)]' : 'bg-brand/30'}`} />
        ))}
      </div>
    </div>
  )
}

export function CellaVolume({ minuti, rpe }) {
  return (
    <div className={`${CARD} p-4 flex-1`}>
      <p className={LABEL}>Volume · RPE</p>
      <p className="mt-2.5 text-[26px] font-black tracking-[-.03em] text-white leading-none">
        {minuti}<span className="text-[13px] font-semibold text-muted tracking-normal"> min</span>
      </p>
      <div className="flex items-center gap-2 mt-2.5">
        <Activity size={14} className="text-brand" aria-hidden="true" />
        <span className="text-[13px] font-bold text-gray-200">{rpe}</span>
        <span className="text-[11px] text-muted">medio</span>
      </div>
    </div>
  )
}

// ── Prossimo obiettivo: il countdown come numero, non come pillola gialla ──
// Scende sotto il bento: è importante, non urgente. L'urgente è oggi.
export function BannerObiettivo({ evento, giorni, onOpen }) {
  return (
    <button onClick={onOpen}
      className={`${CARD} w-full text-left px-[18px] py-4 flex items-center justify-between gap-3.5 transition hover:border-brand/40 active:scale-[.99]`}>
      <div className="min-w-0">
        <p className={LABEL}>Prossimo obiettivo</p>
        <p className="mt-1.5 text-[17px] font-black tracking-[-.02em] text-white truncate">{evento.workouts.title}</p>
        <p className="mt-0.5 text-[12.5px] font-medium text-muted capitalize">
          {format(parseISO(evento.completed_date), 'EEEE d MMMM', { locale: it })}
        </p>
      </div>
      <div className="text-right shrink-0">
        <span className="block text-[38px] font-black tracking-[-.05em] text-white leading-[.9]">{giorni}</span>
        <span className={`${LABEL} text-brand tracking-[.14em]`}>{giorni === 1 ? 'giorno' : 'giorni'}</span>
      </div>
    </button>
  )
}

// ── In arrivo ─────────────────────────────────────────────────────────────
// Il bottone "Aggiungi allenamento libero" è l'ultima riga della lista, dove
// serve: prima era una barra a sé stante fra Oggi e i prossimi allenamenti.
export function ListaInArrivo({ items = [], onOpen, onAggiungiLibero, azioniRiga }) {
  // Un'intestazione sopra il nulla non è un empty state, è un difetto. Per
  // l'atleta la sezione resta comunque, perché ci vive il bottone
  // "Aggiungi allenamento libero"; per il coach, che non ce l'ha, sparisce.
  if (items.length === 0 && !onAggiungiLibero) return null

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between mt-1.5">
        <h3 className="text-[15px] font-extrabold tracking-[-.01em] text-white">In arrivo</h3>
        <span className={LABEL}>Prossimi giorni</span>
      </div>
      {items.map(w => {
        const s = w.workouts?.sections || {}
        const grezza = s.category || (s.steps ? 'Running' : 'Hyrox')
        const cat = grezza === 'Autonomo' || s.isAutonomous === true ? 'Custom' : grezza
        return (
          <div key={w.id} onClick={() => onOpen(w)}
            className={`${RIGA} px-4 py-3.5 flex items-center gap-3 cursor-pointer transition hover:bg-white/[.06]`}>
            <span aria-hidden="true" className={`w-[3px] self-stretch rounded-full ${corsia(cat).dot}`} />
            <div className="flex-1 min-w-0">
              <p className="text-[14.5px] font-bold text-white truncate">{w.workouts.title}</p>
              <p className="mt-0.5 text-xs font-medium text-muted capitalize">
                {format(parseISO(w.completed_date), 'EEEE d MMMM', { locale: it })}
              </p>
            </div>
            {azioniRiga?.(w)}
            <ChevronRight size={17} className="text-[#5b6070] shrink-0" aria-hidden="true" />
          </div>
        )
      })}
      {onAggiungiLibero && (
        <button onClick={onAggiungiLibero}
          className="rounded-[18px] px-4 py-3 min-h-11 border border-dashed border-white/[.13] text-gray-400 text-[13.5px] font-bold
                     inline-flex items-center justify-center gap-2 transition hover:border-brand/50 hover:text-brand">
          <Plus size={16} className="text-brand" aria-hidden="true" /> Aggiungi allenamento libero
        </button>
      )}
    </div>
  )
}
