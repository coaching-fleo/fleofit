// RiepilogoCoachUI.jsx — i pezzi della Home coach «Riepilogo» (10/11/2026).
//
// Proposta B3 (tools/design-home/proposta-b3.html, spec in
// docs/superpowers/specs/2026-11-10-home-coach-riepilogo-design.md): la Home
// mostra NUMERI e ogni numero apre la lista delle persone (FoglioListaCoach).
// Stessa lunghezza con 11 o con 500 atleti.
//
// SOLA PRESENTAZIONE: i conti arrivano da src/lib/riepilogoCoach.js e dal
// cruscotto. Mai uno «0» in pagina: al suo posto ✓ verde (CLAUDE.md §9).
// `compatto` = telefono.

import { useRef, useState } from 'react'
import { ArrowRight, ChevronRight, CalendarPlus, MessageCircle, ChartNoAxesColumn, BookOpen } from 'lucide-react'
import { corsia } from '../lib/categorie'
import { Volto, PolsoTeam, Cella } from './CruscottoCoachUI'
import { CARD } from '../lib/stiliCard'
import { righeCalendario, MASSIMO_CALENDARIO } from '../lib/riepilogoCoach'
import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'

/** Quante card della fila di oggi si disegnano alla volta. */
export const BLOCCO_FILA = 20

// La profondità (11/11/2026, «manca il premium feel»): ogni card di primo
// livello è la CARTA SOLLEVATA di DESIGN.md (ombra neutra + luce sul bordo alto,
// src/lib/stiliCard.js), come la Home atleta. Le righe dentro restano piatte.
// Il colore nelle ombre c'è solo dove c'è uno stato: la card di oggi, l'azione
// primaria, l'allarme.
const CARTA = CARD
// Il colore (11/11/2026). Prima troppo («troppa colorazione»), poi tutto grigio
// («così è veramente troppo»). La via di mezzo: le SUPERFICI sono neutre (card,
// bottoni secondari, quadratini) e il colore sta solo nei segni piccoli — una
// cifra, un'icona, un pallino, una barra sottile. Le superfici piene di colore
// restano due: la card gialla di oggi e il rosso di chi sta male.
/** La pastiglia di un'icona: vetro con la luce in alto, come i controlli. */
const PASTIGLIA = 'w-11 h-11 rounded-[14px] grid place-items-center shrink-0 shadow-[inset_0_1px_0_rgba(255,255,255,.08)]'

export function TitoloSezione({ children, azione, onAzione, nota }) {
  return (
    <div className="flex items-baseline justify-between gap-3 mb-3 px-0.5">
      <h2 className="text-[19px] font-black tracking-[-.025em] text-white">{children}</h2>
      {nota && <span className="text-[12.5px] font-bold text-gray-400">{nota}</span>}
      {azione && (
        <button type="button" onClick={onAzione} className="text-[13px] font-bold text-brand shrink-0">{azione}</button>
      )}
    </div>
  )
}

// ── La card gialla ─────────────────────────────────────────────────────────

/** Sul giallo il giallo non si vede: Hyrox diventa nero, le altre restano col loro colore. */
const SU_GIALLO = { Hyrox: 'bg-[#0B0B0B]', Running: 'bg-running', Gym: 'bg-gym', Custom: 'bg-custom' }

export function CartaOggi({ stati, perCategoria = [], onApri, compatto = false }) {
  const { daFare, inCorso, fatti, totale } = stati
  const pct = totale ? Math.round((fatti / totale) * 100) : 0
  const r = 24, giro = 2 * Math.PI * r
  return (
    <section aria-label="Oggi"
      className={`relative overflow-hidden rounded-[28px] bg-gradient-to-b from-[#f8c83a] via-brand to-[#e6aa0e] text-[#111] ${compatto ? 'p-5' : 'p-6'}
                  shadow-[0_30px_56px_-26px_rgba(241,186,23,.7),0_2px_6px_rgba(0,0,0,.35),inset_0_1px_0_rgba(255,255,255,.55),inset_0_-1px_0_rgba(0,0,0,.14)]`}>
      <span aria-hidden="true" className="absolute -right-[60px] -top-[50px] w-[240px] h-[240px] rounded-full
        bg-[repeating-radial-gradient(circle,transparent_0_18px,rgba(0,0,0,.07)_18px_30px)]" />
      {totale === 0 ? (
        <div className="relative">
          <p className="text-[13px] font-bold opacity-70">Oggi</p>
          <h2 className="mt-1 text-[26px] leading-[1.08] font-black tracking-[-.03em]">Nessun allenamento oggi</h2>
        </div>
      ) : (<>
        <div className="relative pr-16">
          <p className="text-[13px] font-bold opacity-70">Oggi · {totale} in programma</p>
          <h2 className="mt-1 text-[28px] leading-[1.04] font-black tracking-[-.035em] max-w-[260px] tabular-nums">
            {fatti ? `${fatti} di ${totale} ${fatti === 1 ? 'ha' : 'hanno'} già finito` : 'Nessuno ha ancora finito'}
          </h2>
        </div>
        <span className="absolute right-[18px] top-[18px] w-[58px] h-[58px]" role="img" aria-label={fatti ? `${pct}% fatto` : 'Ancora niente di fatto'}>
          <svg viewBox="0 0 58 58" className="w-[58px] h-[58px] -rotate-90" aria-hidden="true">
            <circle cx="29" cy="29" r={r} fill="none" stroke="rgba(0,0,0,.12)" strokeWidth="5" />
            <circle cx="29" cy="29" r={r} fill="none" stroke="#0B0B0B" strokeWidth="5" strokeLinecap="round"
              strokeDasharray={`${(giro * pct) / 100} ${giro}`} />
          </svg>
          <b className="absolute inset-0 grid place-items-center text-sm font-black">{fatti ? `${pct}%` : '—'}</b>
        </span>
        <div className="relative mt-4 grid grid-cols-3 gap-2">
          {[['da fare', daFare, 'bg-[#0B0B0B]/50'], ['in corso', inCorso, 'bg-[#0B0B0B]/75'], ['fatti', fatti, 'bg-[#0B0B0B]']].map(([nome, n, pallino]) => (
            <button key={nome} type="button" onClick={() => onApri(nome === 'fatti' ? 'fatto' : nome)}
              aria-label={`${n} ${nome}`}
              className="rounded-2xl bg-black/[.07] hover:bg-black/[.12] border border-black/[.06] shadow-[inset_0_1px_0_rgba(255,255,255,.28)]
                         px-2.5 pt-2.5 pb-2 text-left transition active:scale-[.98]">
              {/* Zero: «da fare» finiti è ✓, «in corso» e «fatti» non ancora è «—». Mai «0». */}
              <b className="block text-[24px] leading-none font-black tracking-[-.035em] tabular-nums">{n || (nome === 'da fare' ? '✓' : '—')}</b>
              <span className="mt-1 flex items-center gap-1.5 text-xs font-extrabold opacity-75">
                <i className={`w-[7px] h-[7px] rounded-full ${pallino}`} aria-hidden="true" />{nome}
              </span>
            </button>
          ))}
        </div>
        {perCategoria.length > 0 && (<>
          <div className="relative mt-4 flex h-2 rounded-full gap-0.5 overflow-hidden bg-black/[.08] shadow-[inset_0_1px_2px_rgba(0,0,0,.18)]" aria-hidden="true">
            {perCategoria.map(([c, n]) => <span key={c} style={{ flex: n }} className={`h-full ${SU_GIALLO[c] || 'bg-[#0B0B0B]'}`} />)}
          </div>
          <div className="relative mt-2 flex flex-wrap gap-3 text-[11.5px] font-extrabold">
            {perCategoria.map(([c, n]) => (
              <span key={c} className="inline-flex items-center gap-1.5 opacity-80">
                <i className={`w-2 h-2 rounded-[2px] ${SU_GIALLO[c] || 'bg-[#0B0B0B]'}`} aria-hidden="true" />{corsia(c).etichetta} <b>{n}</b>
              </span>
            ))}
          </div>
        </>)}
      </>)}
    </section>
  )
}

// ── Chi sta male ───────────────────────────────────────────────────────────

export function AvvisoStannoMale({ righe = [], onApri, onApriUno }) {
  if (!righe.length) return null
  const uno = righe.length === 1
  return (
    <button type="button" onClick={() => (uno ? onApriUno(righe[0]) : onApri())}
      className="w-full p-3.5 rounded-[22px] bg-gradient-to-b from-red-500/[.17] to-red-500/[.06] border border-red-500/30 flex items-center gap-3.5 text-left
                 shadow-[0_18px_34px_-20px_rgba(239,68,68,.5),inset_0_1px_0_rgba(255,255,255,.07)] transition active:scale-[.99]">
      {uno
        ? <Volto foto={righe[0].foto} nome={righe[0].nome} anello="ring-2 ring-red-500" />
        : <span className="min-w-[34px] text-center text-[30px] font-black text-red-400 tracking-[-.03em]">{righe.length}</span>}
      <span className="flex-1 min-w-0">
        <b className="block text-[14.5px] font-extrabold leading-snug text-white">
          {uno ? `${righe[0].nome} sta male e oggi ha un allenamento intenso`
            : `${righe.length} atleti stanno male e oggi hanno un allenamento intenso`}
        </b>
        <span className="block mt-0.5 text-[12.5px] text-red-300 leading-snug">
          {uno ? 'Ha dormito poco o ha poca energia.' : 'Hanno dormito poco o hanno poca energia.'}
        </span>
      </span>
      <span className="shrink-0 px-3.5 py-2 rounded-full bg-red-500 text-white text-[13px] font-extrabold shadow-[0_8px_16px_-6px_rgba(239,68,68,.7),inset_0_1px_0_rgba(255,255,255,.3)]">{uno ? 'Apri' : 'Vedi chi'}</span>
    </button>
  )
}

// ── Feedback e da programmare ──────────────────────────────────────────────

function Tessera({ etichetta, icona: Icona, tonoIcona, numero, unita, meta, metaZero, bottone, tonoBottone, tonoFreccia = 'bg-white text-black', onClick }) {
  return (
    <div className={`${CARTA} p-3.5 flex flex-col gap-0.5 min-h-[158px]`}>
      <span className="flex items-start justify-between gap-2">
        <span className="text-xs font-bold text-gray-400 leading-tight pt-0.5">{etichetta}</span>
        <span className={`w-7 h-7 rounded-[10px] grid place-items-center shrink-0 shadow-[inset_0_1px_0_rgba(255,255,255,.08)] ${tonoIcona}`}><Icona size={15} aria-hidden="true" /></span>
      </span>
      <b className={`mt-1 text-[32px] leading-[1.02] font-black tracking-[-.04em] tabular-nums ${numero ? 'text-white' : 'text-gray-400'}`}>
        {numero ? <>{numero}{unita && <span className="ml-1 text-[15px] font-bold text-gray-300">{unita}</span>}</> : '✓'}
      </b>
      <span className="text-xs font-semibold text-gray-400">{numero ? meta : metaZero}</span>
      <button type="button" onClick={onClick}
        className={`mt-auto rounded-[18px] py-2.5 pl-3 pr-2 flex items-center justify-between gap-1 text-[13.5px] font-extrabold transition active:scale-[.98] ${tonoBottone}`}>
        {bottone}
        <i className={`w-[30px] h-[30px] shrink-0 rounded-full grid place-items-center ${tonoFreccia}`} aria-hidden="true"><ArrowRight size={16} strokeWidth={2.6} /></i>
      </button>
    </div>
  )
}

/** Vetro chiaro: si vede che è un bottone senza accendere un colore accanto al giallo di oggi. */
const BOTTONE_NEUTRO = 'bg-gradient-to-b from-white/[.13] to-white/[.07] border border-white/[.1] text-white ' +
  'shadow-[0_10px_20px_-12px_rgba(0,0,0,.9),inset_0_1px_0_rgba(255,255,255,.14)] hover:from-white/[.17]'

export function CoppiaAzioni({ feedback = 0, scoperti = 0, onFeedback, onProgramma }) {
  return (<>
    <Tessera etichetta="Feedback da leggere" numero={feedback} meta="dall'ultima volta" metaZero="tutti letti"
      icona={MessageCircle} tonoIcona="bg-white/[.06] text-brand"
      bottone="Leggi" onClick={onFeedback} tonoBottone={BOTTONE_NEUTRO} tonoFreccia="bg-brand text-black" />
    <Tessera etichetta="Da programmare" numero={scoperti} unita={scoperti === 1 ? 'atleta' : 'atleti'}
      meta="nei prossimi 3 giorni" metaZero="tutti programmati"
      icona={CalendarPlus} tonoIcona="bg-white/[.06] text-sky-300"
      bottone="Programma" onClick={onProgramma} tonoBottone={BOTTONE_NEUTRO} tonoFreccia="bg-running text-white" />
  </>)
}

// ── In allenamento oggi ────────────────────────────────────────────────────

const PILLOLA_STATO = (r) => (
  r.allarme ? ['bg-red-500/85 text-white', 'Sta male']
    : r.stato === 'in corso' ? ['bg-white text-black', 'In corso']
      : r.stato === 'completato' ? ['bg-black/45 text-green-400', r.rpe != null ? `RPE ${r.rpe}` : 'Fatto']
        : ['bg-black/45 text-gray-200', 'Da fare']
)

function CardFoto({ r, onApri, compatto }) {
  const c = corsia(r.categoria)
  const [tono, testo] = PILLOLA_STATO(r)
  const nome = (r.nome || '').split(' ')[0]
  return (
    <button type="button" onClick={() => onApri(r)} aria-label={`${r.nome}, ${testo}`}
      className={`${compatto ? 'w-[148px] h-[196px] rounded-3xl' : 'w-[124px] h-[160px] rounded-[20px]'} shrink-0 snap-start relative overflow-hidden bg-[#1e1e1e] text-left
                  shadow-[0_18px_30px_-18px_rgba(0,0,0,.95)] ${r.stato === 'completato' ? 'opacity-55 saturate-50' : ''} transition active:scale-[.98]`}>
      {r.foto
        ? <img src={r.foto} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" onError={(e) => { e.target.style.opacity = 0 }} />
        : <span className="absolute inset-0 grid place-items-center pb-8 [&>span]:w-16 [&>span]:h-16 [&>span]:text-xl"><Volto nome={r.nome} /></span>}
      <span className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent via-30% to-black/90" aria-hidden="true" />
      {/* Il bordo di luce: una hairline chiara sopra la foto, come la carta sollevata. */}
      <span className="absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,.14)]" aria-hidden="true" />
      {/* In alto solo lo stato; la categoria scende sopra il nome. Due pillole su 148px
          si tagliavano («Run…»), 11/11/2026. */}
      <span className={`absolute top-2.5 right-2.5 px-2 py-1 rounded-full text-[11px] font-extrabold whitespace-nowrap backdrop-blur ${tono}`}>{testo}</span>
      <span className="absolute left-3 right-3 bottom-3">
        <span className="mb-1 flex items-center gap-1.5 text-[11px] font-extrabold text-gray-200">
          <i className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.dot}`} aria-hidden="true" />{c.etichetta}
        </span>
        <b className="block text-[16px] font-black tracking-[-.02em] text-white truncate">{nome}</b>
        <span className="block text-xs font-semibold text-gray-300 truncate">{r.titolo}</span>
      </span>
    </button>
  )
}

/** La fila delle foto: 20 alla volta, le altre arrivano scorrendo. Nessuno resta fuori. */
export function FilaOggi({ righe = [], onApri, onTutti, compatto = false }) {
  const [quante, setQuante] = useState(BLOCCO_FILA)
  const fila = useRef(null)
  const suScorri = () => {
    const f = fila.current
    if (!f || quante >= righe.length) return
    if (f.scrollLeft + f.clientWidth >= f.scrollWidth - 400) setQuante(q => q + BLOCCO_FILA)
  }
  if (!righe.length) return (
    <p className={`${CARTA} px-4 py-5 text-sm text-gray-400`}>Nessuno si allena oggi.</p>
  )
  const restano = righe.length - Math.min(quante, righe.length)
  return (
    <div ref={fila} onScroll={suScorri}
      className={`flex gap-2.5 overflow-x-auto hide-scrollbar snap-x snap-mandatory pb-1 ${compatto ? '-mx-4 px-4' : ''}`}>
      {righe.slice(0, quante).map(r => <CardFoto key={`${r.id}-${r.workoutId}`} r={r} onApri={onApri} compatto={compatto} />)}
      {restano > 0 && (
        <button type="button" onClick={onTutti}
          className={`${compatto ? 'w-[148px] h-[196px] rounded-3xl' : 'w-[124px] h-[160px] rounded-[20px]'} shrink-0 snap-start bg-white/[.025] border-[1.5px] border-dashed border-white/[.12]
                      flex flex-col items-center justify-center gap-1.5 text-gray-300 text-sm font-extrabold`}>
          <b className="text-[26px] font-black text-white">+{restano}</b>Vedi tutti
        </button>
      )}
    </div>
  )
}

// ── Prossimi giorni ────────────────────────────────────────────────────────

/** Oggi è il giorno «selezionato» della fila: è stato, quindi porta il glow del brand. */
const GIORNO_OGGI = 'rounded-[22px] bg-gradient-to-b from-[#26220f] to-[#171610] border border-brand/35 ' +
  'shadow-[0_18px_34px_-20px_rgba(241,186,23,.4),inset_0_1px_0_rgba(255,255,255,.08)]'

export function GiorniProssimi({ giorni = [], onApri, compatto = false }) {
  return (
    <div className={`flex gap-2 overflow-x-auto hide-scrollbar snap-x pb-1 ${compatto ? '-mx-4 px-4' : ''}`}>
      {giorni.map(g => {
        const [parola, numero] = g.oggi ? ['oggi', g.data.slice(8).replace(/^0/, '')] : g.etichetta.split(' ')
        const buchi = g.daProgrammare.length
        const totaleChip = g.perCategoria.reduce((s, [, n]) => s + n, 0)
        return (
          <button key={g.data} type="button" onClick={() => onApri(g)}
            className={`${g.oggi ? GIORNO_OGGI : CARTA} shrink-0 ${compatto ? 'w-[118px]' : 'w-[124px]'} snap-start p-3 pb-3 flex flex-col gap-0.5 text-left
                        transition active:scale-[.98]`}>
            <span className={`text-xs font-bold ${g.oggi ? 'text-brand' : 'text-gray-400'}`}>
              {parola}<b className={`ml-1 text-[15px] ${g.oggi ? 'text-brand' : 'text-gray-200'}`}>{numero}</b>
            </span>
            {g.oggi ? (<>
              <span className="mt-2.5 text-[28px] leading-none font-black tracking-[-.04em] tabular-nums text-white">{g.programmati.length || '✓'}</span>
              <small className="text-[11px] font-bold text-gray-400 whitespace-nowrap">{g.programmati.length ? 'si allenano' : 'nessuno oggi'}</small>
            </>) : (<>
              <span className={`mt-2.5 text-[28px] leading-none font-black tracking-[-.04em] tabular-nums ${buchi ? 'text-white' : 'text-green-400/80'}`}>{buchi || '✓'}</span>
              <small className="text-[11px] font-bold text-gray-400 whitespace-nowrap">{buchi ? 'da programmare' : 'tutti programmati'}</small>
              <small className="text-[11px] font-semibold text-gray-500 whitespace-nowrap">{g.programmati.length ? `${g.programmati.length} già ${g.programmati.length === 1 ? 'programmato' : 'programmati'}` : 'nessuno ancora'}</small>
            </>)}
            <span className="mt-2.5 flex h-[5px] rounded-full overflow-hidden gap-px bg-white/[.06]" aria-hidden="true">
              {g.perCategoria.map(([c, n]) => <span key={c} style={{ flex: n }} className={`h-full ${corsia(c).dot} opacity-80`} />)}
              {buchi > 0 && totaleChip > 0 && <span style={{ flex: buchi }} />}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ── Da guardare ────────────────────────────────────────────────────────────

// «Da guardare» (11/11/2026). Primo giro: icona decorativa nel quadratino,
// lo schema di ogni lista generica («AI slop»). Secondo giro: solo numeri
// grandi, ma non si capiva più che erano bottoni. Ora: il quadratino resta,
// perché dice «toccami», ma dentro c'è il NUMERO, non un'icona; e la freccia
// in un cerchio a destra dice dove porta. Zero = ✓ verde e riga attenuata.
const TONO_CONTATORE = 'bg-white/[.06] border-white/[.1]'
const CONTATORI = [
  { tipo: 'feedback', titolo: 'Feedback da leggere', cifra: 'text-brand', sotto: 'note e vocali dopo l\'allenamento', tono: TONO_CONTATORE },
  { tipo: 'fermi', titolo: 'Fermi da 5+ giorni', cifra: 'text-orange-400', sotto: 'nessun allenamento completato', tono: TONO_CONTATORE },
  { tipo: 'scaduti', titolo: 'Allenamenti scaduti', cifra: 'text-gray-200', sotto: 'non segnati entro il giorno', tono: TONO_CONTATORE },
  { tipo: 'segnali', titolo: 'Da rivedere nel programma', cifra: 'text-sky-300', sotto: 'RPE o carico fuori dal previsto', tono: TONO_CONTATORE },
]

export function ContatoriDaGuardare({ feedback = 0, fermi = 0, scaduti = 0, segnali = 0, onApri }) {
  const valori = { feedback, fermi, scaduti, segnali }
  return (
    <div className={`${CARTA} p-1.5 flex flex-col`}>
      {CONTATORI.map(({ tipo, titolo, sotto, tono, cifra }) => {
        const n = valori[tipo]
        return (
          <button key={tipo} type="button" onClick={() => onApri(tipo)} aria-label={`${titolo}: ${n || 'nessuno'}`}
            className="group relative w-full rounded-[16px] py-2.5 pl-2.5 pr-2.5 flex items-center gap-3 text-left transition hover:bg-white/[.04] active:bg-white/[.06] active:scale-[.99]
                       [&+&]:before:content-[''] [&+&]:before:absolute [&+&]:before:top-0 [&+&]:before:left-[66px] [&+&]:before:right-3 [&+&]:before:h-px [&+&]:before:bg-white/[.06]">
            <span className={`w-11 h-11 shrink-0 rounded-[14px] border grid place-items-center text-[20px] font-black tracking-[-.04em] tabular-nums
                              shadow-[inset_0_1px_0_rgba(255,255,255,.08)] ${n ? `${tono} ${cifra}` : 'bg-white/[.03] text-green-400/80 border-white/[.06]'}`}>{n || '✓'}</span>
            <span className={`flex-1 min-w-0 ${n ? '' : 'opacity-50'}`}>
              <b className="block text-[15px] leading-tight font-extrabold tracking-[-.01em] text-white">{titolo}</b>
              <span className="block mt-0.5 text-[12.5px] font-medium text-gray-400 truncate">{sotto}</span>
            </span>
            <span className="w-8 h-8 shrink-0 rounded-full bg-white/[.06] grid place-items-center text-gray-300 transition group-hover:bg-white/[.12] group-hover:text-white" aria-hidden="true">
              <ChevronRight size={17} />
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ── Il team, le gare, le destinazioni ──────────────────────────────────────

/** Le quattro tessere del polso, in 2×2: stessi numeri e stesse frasi della Home classica. */
export function TeamQuattro({ polso }) {
  return <PolsoTeam {...polso} griglia />
}

export function GareRighe({ gare = [], onApri }) {
  if (!gare.length) return null
  return (
    <div className={`${CARTA} p-1.5 flex flex-col`}>
      {gare.slice(0, 3).map(g => (
        <button key={g.chiave} type="button" onClick={() => onApri(g)}
          className="relative w-full rounded-[16px] p-2.5 flex items-center gap-3 text-left transition hover:bg-white/[.035] active:bg-white/[.05] [&+&]:before:content-[''] [&+&]:before:absolute [&+&]:before:top-0 [&+&]:before:right-3 [&+&]:before:h-px [&+&]:before:bg-white/[.06] [&+&]:before:left-[72px]">
          <span className="w-[52px] h-[52px] rounded-2xl bg-gradient-to-b from-white/[.14] to-white/[.06] text-white flex flex-col items-center justify-center shrink-0 shadow-[inset_0_1px_0_rgba(255,255,255,.12)]">
            {g.giorni > 1 ? (<>
              <b className="text-xl leading-none font-black tabular-nums">{g.giorni}</b>
              <small className="text-[10px] font-extrabold">giorni</small>
            </>) : <b className="text-[13px] font-black">{g.giorni === 1 ? 'domani' : 'oggi'}</b>}
          </span>
          <span className="flex-1 min-w-0">
            <b className="block text-[14.5px] font-extrabold text-white truncate">{g.nome}</b>
            <span className="block text-xs font-semibold text-gray-400">{g.giorno} {g.mese.toLowerCase()}</span>
          </span>
          <span className="text-[13px] font-extrabold text-gray-300 whitespace-nowrap">{g.atleti.length} {g.atleti.length === 1 ? 'atleta' : 'atleti'}</span>
          <ChevronRight size={18} className="text-[#55555c] shrink-0" aria-hidden="true" />
        </button>
      ))}
    </div>
  )
}

function Destinazione({ icona: Icona, tono, titolo, sotto, onClick }) {
  return (
    <button type="button" onClick={onClick}
      className={`${CARTA} w-full p-3.5 flex items-center gap-3 text-left transition hover:border-white/[.14] active:scale-[.99]`}>
      <span className={`${PASTIGLIA} ${tono}`}><Icona size={20} aria-hidden="true" /></span>
      <span className="flex-1 min-w-0">
        <b className="block text-[15px] font-extrabold text-white">{titolo}</b>
        <span className="block text-xs font-semibold text-gray-400 truncate">{sotto}</span>
      </span>
      <ChevronRight size={18} className="text-[#55555c] shrink-0" aria-hidden="true" />
    </button>
  )
}

/** In fondo: Report sempre, Analisi solo sul desktop (sul telefono rimanda al Report). */
export function Destinazioni({ analisi = false, onReport, onAnalisi }) {
  return (
    <div className={analisi ? 'grid grid-cols-2 gap-2.5' : 'flex flex-col gap-2'}>
      {analisi && <Destinazione icona={ChartNoAxesColumn} tono="bg-white/[.06] text-brand" titolo="Analisi"
        sotto="Come sta andando, settimana per settimana" onClick={onAnalisi} />}
      <Destinazione icona={BookOpen} tono="bg-white/[.06] text-sky-300" titolo="Report settimanale"
        sotto="Aderenza, carico e chi richiede un'azione" onClick={onReport} />
    </div>
  )
}

// ── Prossimi giorni: il calendario (proposta B2, 11/11/2026) ────────────────

const LEGENDA_CAL = [['Hyrox', 'bg-brand'], ['Corsa', 'bg-running'], ['Gym', 'bg-gym'], ['Libero', 'bg-custom']]

/**
 * Il calendario della Home classica nella Riepilogo: due settimane da oggi, i
 * nomi fermi a sinistra e i giorni che si scorrono di lato. Il «+» tratteggiato
 * è un giorno da programmare e porta al builder per quell'atleta e quel giorno.
 * Sul desktop c'è la legenda; le colonne restano larghe 68px e si scorre.
 */
/** Cosa vuol dire ogni colore del calendario: sul desktop, dove c'è posto. */
export function LegendaCalendario() {
  return (
    <div className="flex flex-wrap items-center gap-3.5 text-xs font-semibold text-gray-400">
      {LEGENDA_CAL.map(([t, cl]) => <span key={t} className="flex items-center gap-1.5"><span className={`w-2.5 h-2.5 rounded-[3px] ${cl}`} />{t}</span>)}
      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px] border-[1.5px] border-dashed border-[#555]" />Da programmare</span>
      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px] bg-white" />Gara</span>
    </div>
  )
}

/** «Andrea Conti» → «Andrea C.»: nella colonna ferma il cognome intero non ci sta. */
const nomeCorto = (n = '') => { const [p, ...r] = n.trim().split(/\s+/); return r.length ? `${p} ${r[0][0]}.` : p }

export function CalendarioProssimi({ piano, nota, desktop = false, massimo = MASSIMO_CALENDARIO, nudo = false, onApri, onProgramma, onTutti }) {
  if (!piano?.righe?.length) return <p className={`${nudo ? '' : CARTA} px-4 py-5 text-sm text-gray-400`}>{nudo ? 'Nessuno con questo nome.' : 'Nessun atleta da programmare.'}</p>
  // Oltre `massimo` atleti: prima chi è scoperto nei prossimi 3 giorni, solo i
  // primi `massimo`, e «Mostra tutti» apre il foglio col calendario intero.
  const { righe, nascoste } = righeCalendario(piano, { massimo })
  // Telefono: colonne fisse che si scorrono. Desktop: le due settimane si dividono la riga.
  const colonne = { gridTemplateColumns: desktop
    ? `176px repeat(${piano.giorni.length}, minmax(56px, 1fr))`
    : `128px repeat(${piano.giorni.length}, 64px)` }
  const nomeFisso = 'sticky left-0 z-10 bg-[#1a1a1d] self-stretch flex items-center gap-2 pl-4 pr-2 min-w-0 shadow-[8px_0_10px_-8px_rgba(0,0,0,.8)]'
  // Nel foglio desktop la griglia sta tutta in larghezza: niente scorrimento di
  // lato, così la riga dei giorni può restare ferma in alto (sticky) mentre il
  // foglio scorre in verticale. Uno scorrimento orizzontale la intrappolerebbe.
  const testaFerma = nudo && desktop
  return (
    <section className={nudo ? 'pb-4' : `${CARTA} pt-4 pb-4`}>
      {(nota || (desktop && !nudo)) && <div className="px-4 pb-3 flex flex-wrap items-start justify-between gap-3">
        {nota && <p className={`text-[13px] font-semibold ${nota.avviso ? 'text-orange-400' : 'text-green-400'}`}>{nota.testo}</p>}
        {desktop && <LegendaCalendario />}
      </div>}
      <div className={testaFerma ? 'pr-5' : 'overflow-x-auto hide-scrollbar snap-x snap-proximity overscroll-x-contain pr-4'}>
        <div className={`${desktop ? 'min-w-full' : 'w-max'} flex flex-col gap-1.5`}>
          <div className={`grid gap-1.5 ${testaFerma ? 'sticky top-0 z-20 py-2 bg-[#18181b] shadow-[0_8px_12px_-10px_rgba(0,0,0,.9)]' : ''}`} style={colonne}>
            <span className={nomeFisso} />
            {piano.giorni.map(d => {
              const g = parseISO(d.data)
              const fine = [0, 6].includes(g.getDay())
              return (
                <span key={d.data} className={`snap-start text-center text-[11.5px] font-bold leading-tight ${d.oggi ? 'text-brand' : 'text-gray-500'}`}>
                  {d.oggi ? 'oggi' : format(g, 'EEE', { locale: it })}
                  <b className={`block text-[13px] ${d.oggi ? 'text-brand' : fine ? 'text-gray-400' : 'text-gray-200'}`}>{format(g, 'd')}</b>
                </span>
              )
            })}
          </div>
          {righe.map(r => (
            <div key={r.id} className="grid gap-1.5 items-center" style={colonne}>
              <span className={`${nomeFisso} text-[13px] font-bold text-white`}>
                <span className="shrink-0 [&>span]:w-6 [&>span]:h-6 [&>span]:text-[9px]"><Volto foto={r.foto} nome={r.nome} piccolo /></span><span className="truncate" title={r.nome}>{desktop ? r.nome : nomeCorto(r.nome)}</span>
              </span>
              {r.celle.map(c => <Cella key={c.data} cella={c} compatto onApri={onApri}
                onProgramma={onProgramma ? (cella) => onProgramma({ atletaId: r.id, data: cella.data }) : undefined} />)}
            </div>
          ))}
        </div>
      </div>
      {nascoste > 0 && onTutti && (
        <div className="px-4 pt-3">
          <button type="button" onClick={onTutti}
            className="w-full h-11 rounded-[14px] bg-white/[.05] border border-white/[.08] text-sm font-bold text-gray-200 transition hover:text-white hover:bg-white/[.08]">
            Mostra tutti i {piano.righe.length} atleti
          </button>
        </div>
      )}
    </section>
  )
}
