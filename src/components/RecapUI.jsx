// I pezzi visivi del recap post-allenamento (22/09/2026) — sola presentazione.
//
// La forma è quella delle storie: schede a tutto schermo, una barra segmentata
// in cima che dice a che punto si è, e il tocco che avanza. Le decisioni su
// QUALI schede esistano stanno in `src/lib/recapAllenamento.js`: qui si disegna
// quello che quella funzione ha deciso.
//
// 🔴 LE SCHEDE NON AVANZANO DA SOLE, ed è l'unica cosa in cui questo recap si
// scosta dal riferimento. In una storia di Instagram il contenuto è un'immagine
// e tre secondi bastano; qui ogni scheda porta numeri che l'atleta deve poter
// rileggere — un timer che scorre mentre si guarda un grafico fa correre gli
// occhi invece degli occhi. La barra segmentata resta, perché è quella a dire
// «ce ne sono altre»: cambia solo che a muoverla è il dito.
//
// ⚠️ NESSUN import di `html-to-image` o `jspdf` in questo file, né in chi lo
// monta. Il recap si apre da Home, scheda workout e scheda atleta: una libreria
// di export qui dentro finirebbe nel chunk di tutte e tre, che è esattamente il
// mezzo megabyte tolto dalla scheda il 31/08 (CLAUDE.md §9-noviesdecies). La
// grafica da condividere esiste già, e sta nel menu della scheda.

import { useEffect, useRef, useState } from 'react'
import { Check, X, ArrowRight, Flame, Plus, Trophy, Clock, Lock, ThumbsUp, ThumbsDown } from 'lucide-react'
import { CARD, LABEL, VETRO, BOTTONE_BRAND, BOTTONE_QUIETO, TONO_VERDETTO } from '../lib/stiliCard'
import { corsia } from '../lib/categorie'
import { coloreCategoria } from '../lib/colori'
import { useNumeroCheSale } from '../useNumeroCheSale'
import { useBottomSheet } from '../useBottomSheet'
import { menoMovimento } from '../useNumeroCheSale'

/** Il triplo `r g b` che `.alone` vuole nella sua variabile. */
const rgbDi = (hex) => {
  const n = parseInt(String(hex).replace('#', ''), 16)
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`
}

/**
 * Quanto sta a schermo una scheda prima di passare alla successiva.
 *
 * Sei secondi e non i cinque di una storia fotografica: qui la scheda più
 * densa porta un grafico a otto barre e tre totali, e cinque secondi bastano a
 * guardarla ma non a leggerla. Chi ne vuole di più tiene premuto.
 */
const DURATA_SCHEDA = 6000

/** Oltre questo tempo il dito non ha toccato: ha TENUTO, e voleva la pausa. */
const MS_TENUTA = 220

// ── i mattoni comuni ───────────────────────────────────────────────────────

/** Il numero grande, con la sua unità e la sua etichetta sotto. */
function Cella({ valore, unita, etichetta, circa = false, colore }) {
  const numerico = Number.parseFloat(valore)
  const sale = useNumeroCheSale(Number.isFinite(numerico) && String(numerico) === String(valore) ? numerico : null)
  const mostrato = sale === null ? valore : sale

  return (
    <div className="flex-1 min-w-0 text-center">
      <p className="text-[30px] font-black tracking-[-.04em] text-white leading-none whitespace-nowrap">
        {circa && <span className="text-[17px] text-muted font-bold">≈</span>}
        {mostrato}
        {unita && <span className="text-[14px] font-semibold text-muted tracking-normal">{unita}</span>}
      </p>
      <p className={`${LABEL} mt-1.5 truncate`} style={colore ? { color: colore } : undefined}>{etichetta}</p>
    </div>
  )
}

/** Il titolo di una scheda: occhiello piccolo, titolo grande. */
function Testata({ occhiello, titolo, colore }) {
  return (
    <div>
      {occhiello && (
        <p className={LABEL} style={colore ? { color: colore } : undefined}>{occhiello}</p>
      )}
      <h2 className="mt-2 text-[27px] font-black tracking-[-.035em] text-white leading-[1.08]">{titolo}</h2>
    </div>
  )
}

/** I pallini che dicono quanto manca perché una cosa si accenda. */
function Progresso({ fatti, soglia }) {
  return (
    <div className="flex items-center gap-2" aria-label={`${fatti} allenamenti su ${soglia}`}>
      {Array.from({ length: soglia }, (_, i) => (
        <span key={i} aria-hidden="true"
          className={`h-2 flex-1 rounded-full ${i < fatti ? 'bg-brand' : 'bg-white/[.13]'}`} />
      ))}
      <span className="text-[13px] font-bold text-muted tabular-nums ml-1">{fatti}/{soglia}</span>
    </div>
  )
}

// ── le schede ──────────────────────────────────────────────────────────────

function SchedaFatto({ dati, colore }) {
  const c = corsia(dati.categoria)
  return (
    <div className="cascata flex flex-col gap-6">
      <div className="w-16 h-16 rounded-full border flex items-center justify-center"
        style={{ borderColor: `${colore}55`, background: `${colore}1f`, color: colore }}>
        <Check size={32} strokeWidth={3} aria-hidden="true" />
      </div>

      <Testata
        occhiello={dati.ordinale ? `${c.etichetta} · il tuo ${dati.ordinale}° allenamento` : c.etichetta}
        titolo={dati.titolo}
        colore={colore} />

      <p className="text-[14px] text-gray-400 first-letter:uppercase -mt-3">{dati.data}</p>

      {dati.celle.length > 0 && (
        <div className={`${CARD} px-4 py-5 flex items-start gap-2`}>
          {dati.celle.map(cella => (
            <Cella key={cella.chiave} valore={cella.valore} unita={cella.unita}
              etichetta={cella.etichetta} circa={cella.circa} />
          ))}
        </div>
      )}
    </div>
  )
}

function SchedaSettimana({ dati, colore }) {
  const CIRCONFERENZA = 2 * Math.PI * 54
  const offset = dati.totale ? CIRCONFERENZA * (1 - dati.fatti / dati.totale) : 0
  const fattiCheSalgono = useNumeroCheSale(dati.fatti)
  const minutiCheSalgono = useNumeroCheSale(dati.minuti)

  return (
    <div className="cascata flex flex-col gap-5">
      <Testata occhiello="Questa settimana" titolo={dati.totale > 0 ? 'A che punto sei' : 'Il conto della settimana'} colore={colore} />

      <div className={`${CARD} p-5 flex items-center gap-5`}>
        <div className="relative w-[104px] h-[104px] shrink-0">
          <svg viewBox="0 0 120 120" className="w-[104px] h-[104px] -rotate-90" role="img"
            aria-label={`${dati.fatti} allenamenti completati su ${dati.totale} questa settimana`}>
            <circle cx="60" cy="60" r="54" fill="none" strokeWidth="11" className="stroke-white/[.07]" />
            {dati.totale > 0 && (
              // ⚠️ Il `filter` inline sovrascrive quello di `.anello-progresso`,
              // che è ambra scritto a mano in index.css: su un anello azzurro
              // (Running) l'alone giallo lo circonderebbe di un colore che in
              // questa app vuol dire un'altra categoria.
              <circle cx="60" cy="60" r="54" fill="none" strokeWidth="11" strokeLinecap="round"
                className="anello-progresso" stroke={colore}
                style={{ filter: `drop-shadow(0 0 8px ${colore}73)` }}
                strokeDasharray={CIRCONFERENZA} strokeDashoffset={offset} />
            )}
          </svg>
          <div aria-hidden="true" className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[30px] font-black tracking-[-.04em] text-white leading-none">
              {fattiCheSalgono}{dati.totale > 0 && <span className="text-[17px] text-muted">/{dati.totale}</span>}
            </span>
            {/* ⚠️ NON `LABEL`: il suo `tracking-[.1em]` porta «COMPLETATI» a
                oltre 104px, cioè più largo dell'anello che la contiene, e la
                parola esce dai due lati del cerchio. Qui la spaziatura è
                stretta e il corpo un punto più piccolo. */}
            <span className="text-[10px] font-bold uppercase tracking-[.02em] text-muted mt-1">
              {dati.totale > 0 ? 'completati' : 'fatti'}
            </span>
          </div>
        </div>

        <div className="min-w-0 flex-1 flex flex-col gap-3">
          <div>
            <p className={LABEL}>Volume</p>
            <p className="text-[26px] font-black tracking-[-.03em] text-white leading-none mt-1">
              {minutiCheSalgono}<span className="text-[13px] font-semibold text-muted tracking-normal"> min</span>
            </p>
            {/* ⚠️ Lo scarto compare solo se esiste: `scartoMinutiSettimana`
                torna `null` con la settimana precedente vuota, e «+214 min
                sulla scorsa» su una settimana in cui non ti allenavi è un dato
                finto (CLAUDE.md §9-duodetricies punto 7). */}
            {dati.scarto != null && (
              <p className="text-[12.5px] font-semibold text-muted mt-1">
                {dati.scarto >= 0 ? '+' : '−'}{Math.abs(dati.scarto)} min sulla scorsa
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Flame size={15} style={{ color: colore }} aria-hidden="true" />
            <span className="text-[14px] font-bold text-white">{dati.serie}</span>
            <span className="text-[12.5px] text-muted">{dati.serie === 1 ? 'giorno di serie' : 'giorni di serie'}</span>
          </div>
        </div>
      </div>

      <div className={`${CARD} px-4 py-4 flex justify-between`}>
        {dati.giorni.map(g => {
          const pieno = g.fatti > 0
          const previsto = g.assegnati > 0
          return (
            <div key={g.chiave} className="flex flex-col items-center gap-2">
              <span className={`text-[11px] font-bold ${g.oggi ? 'text-white' : 'text-muted'}`}>{g.lettera}</span>
              <span aria-hidden="true"
                className={`block rounded-full ${g.oggi ? 'w-2.5 h-2.5' : 'w-[7px] h-[7px]'}
                            ${pieno ? 'bg-green-500' : previsto ? 'bg-white/40' : 'bg-white/[.13]'}`} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SchedaAndamento({ dati, colore }) {
  const { totali, verdetto } = dati
  return (
    <div className="cascata flex flex-col gap-5">
      <Testata
        occhiello={dati.daSempre ? 'Da quando hai iniziato' : 'Ultimi 3 mesi'}
        titolo="Come stai andando"
        colore={colore} />

      <div className={`${CARD} p-5 flex flex-col gap-4`}>
        <div className="flex items-end justify-between gap-1.5 h-[112px]" role="img"
          aria-label={`Minuti per settimana: ${dati.barre.map(b => `${b.breve} ${b.minuti} minuti`).join(', ')}`}>
          {dati.barre.map(b => (
            <div key={b.chiave} aria-hidden="true" className="flex-1 flex flex-col justify-end items-center gap-1.5 h-full">
              <span className="w-full rounded-[4px] transition-[height]"
                style={{
                  height: `${Math.max(3, b.quota)}%`,
                  background: b.corrente ? colore : `${colore}4d`,
                  boxShadow: b.corrente ? `0 0 12px ${colore}66` : undefined,
                }} />
              <span className={`text-[10px] font-bold ${b.corrente ? 'text-white' : 'text-muted'}`}>{b.breve}</span>
            </div>
          ))}
        </div>
        {/* ⚠️ L'ultima barra è la settimana in corso, quindi è parziale per
            definizione: senza questa riga un mercoledì si legge come un crollo. */}
        <p className="text-[11.5px] text-muted text-center">Minuti per settimana · l'ultima è ancora in corso</p>
      </div>

      {verdetto && (
        <div className={`rounded-2xl border px-4 py-3 flex items-center justify-between gap-3 ${TONO_VERDETTO[verdetto.tono]}`}>
          <span className="text-[14px] font-bold">{verdetto.testo}</span>
          <span className="text-[14px] font-black tabular-nums">
            {verdetto.delta >= 0 ? '+' : '−'}{Math.abs(verdetto.delta)}%
          </span>
        </div>
      )}

      <div className={`${CARD} px-4 py-5 flex items-start gap-2`}>
        <Cella valore={String(totali.sedute)} etichetta={totali.sedute === 1 ? 'Allenamento' : 'Allenamenti'} />
        <Cella valore={String(totali.ore)} unita=" h" etichetta="Di lavoro" circa />
        {/* L'RPE medio sparisce quando nessuno l'ha dichiarato: la cella in meno
            è più onesta di un 5 che nessuno ha mai segnato. */}
        {totali.rpeMedio != null && (
          <Cella valore={String(totali.rpeMedio).replace('.', ',')} unita="/10" etichetta="RPE medio" />
        )}
      </div>
    </div>
  )
}

function SchedaPrimo({ dati, colore }) {
  return (
    <div className="cascata flex flex-col gap-5">
      <Testata occhiello="Il primo è fatto" titolo="Da qui in poi c'è una storia da raccontare" colore={colore} />

      <p className="text-[14.5px] leading-relaxed text-gray-400 -mt-2">
        I numeri di questa schermata nascono adesso: ogni allenamento che chiudi ne aggiunge uno.
      </p>

      <div className={`${CARD} p-5 flex flex-col gap-4`}>
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
            style={{ background: `${colore}1f`, color: colore }}>
            <Flame size={17} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-[14.5px] font-bold text-white">Serie: 1 giorno</p>
            <p className="text-[12.5px] text-muted">Torna domani e diventa due.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-white/[.07] text-gray-300">
            <Clock size={17} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-[14.5px] font-bold text-white">{dati.minuti} minuti di lavoro</p>
            <p className="text-[12.5px] text-muted">È il primo mattone del volume settimanale.</p>
          </div>
        </div>
      </div>

      <div className={`${CARD} p-5 flex flex-col gap-3`}>
        <div className="flex items-center gap-2">
          <Lock size={14} className="text-muted" aria-hidden="true" />
          <p className={LABEL}>Andamento</p>
        </div>
        <p className="text-[13.5px] leading-relaxed text-gray-400">
          Il grafico delle settimane si accende dopo {dati.soglia} allenamenti.
        </p>
        <Progresso fatti={1} soglia={dati.soglia} />
      </div>
    </div>
  )
}

function SchedaInArrivo({ dati, colore }) {
  return (
    <div className="cascata flex flex-col gap-5">
      <Testata occhiello="Quasi" titolo="L'andamento sta per accendersi" colore={colore} />
      <div className={`${CARD} p-5 flex flex-col gap-3.5`}>
        <div className="flex items-center gap-2">
          <Lock size={14} className="text-muted" aria-hidden="true" />
          <p className={LABEL}>{dati.etichetta}</p>
        </div>
        <p className="text-[13.5px] leading-relaxed text-gray-400">{dati.testo}</p>
        <Progresso fatti={dati.fatti} soglia={dati.soglia} />
      </div>
    </div>
  )
}

function SchedaProssimo({ dati, colore, onApri, onLibero }) {
  if (dati.forma === 'assegnato') {
    const c = corsia(dati.categoria)
    const colProssimo = coloreCategoria(dati.categoria)
    return (
      <div className="cascata flex flex-col gap-5">
        <Testata occhiello="Il prossimo" titolo={dati.quando} colore={colProssimo} />

        <button onClick={onApri ? () => onApri(dati) : undefined} disabled={!onApri}
          className={`${CARD} w-full text-left p-5 flex items-center gap-4 transition active:scale-[.99] disabled:active:scale-100`}>
          <span className="w-1 self-stretch rounded-full shrink-0" style={{ background: colProssimo }} aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block text-[12px] font-bold uppercase tracking-[.08em]" style={{ color: colProssimo }}>{c.etichetta}</span>
            <span className="block text-[17px] font-black tracking-tight text-white mt-1 truncate">{dati.titolo}</span>
            <span className="block text-[12.5px] text-muted mt-1 first-letter:uppercase">
              {dati.data}
              {dati.minuti != null && ` · ≈${dati.minuti} min`}
              {dati.blocchi != null && ` · ${dati.blocchi} ${dati.blocchi === 1 ? 'blocco' : 'blocchi'}`}
            </span>
          </span>
          {onApri && <ArrowRight size={18} className="text-muted shrink-0" aria-hidden="true" />}
        </button>

        {dati.gara && <RigaGara gara={dati.gara} />}
      </div>
    )
  }

  if (dati.forma === 'evento') {
    return (
      <div className="cascata flex flex-col gap-5">
        <Testata occhiello="Il prossimo" titolo={`Mancano ${dati.gara.giorni} giorni`} colore={colore} />
        <div className={`${CARD} p-5 flex items-center gap-4`}>
          <span className="w-11 h-11 rounded-full bg-white/[.09] text-white flex items-center justify-center shrink-0">
            <Trophy size={20} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className={LABEL}>Gara</p>
            <p className="text-[17px] font-black tracking-tight text-white mt-1 truncate">{dati.gara.titolo}</p>
          </div>
        </div>
        <p className="text-[14.5px] leading-relaxed text-gray-400">
          Non c'è ancora un allenamento in programma. Nel frattempo la serie è di {dati.serie} {dati.serie === 1 ? 'giorno' : 'giorni'}.
        </p>
      </div>
    )
  }

  // ⚠️ Niente «il coach sta preparando il prossimo»: è una promessa fatta a
  // nome di qualcun altro, e nessun dato la sostiene. Si offre l'unica cosa che
  // l'atleta può fare da solo, e si dice la serie, che è un dato vero.
  return (
    <div className="cascata flex flex-col gap-5">
      <Testata occhiello="Il prossimo" titolo="Lo decidi tu" colore={colore} />
      <div className={`${CARD} p-5 flex items-center gap-4`}>
        <span className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
          style={{ background: `${colore}1f`, color: colore }}>
          <Flame size={20} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-[26px] font-black tracking-[-.03em] text-white leading-none">
            {dati.serie}<span className="text-[13px] font-semibold text-muted tracking-normal"> {dati.serie === 1 ? 'giorno' : 'giorni'}</span>
          </p>
          <p className="text-[12.5px] text-muted mt-1">di serie da difendere</p>
        </div>
      </div>
      <p className="text-[14.5px] leading-relaxed text-gray-400">
        In calendario non c'è ancora niente. Se ti alleni comunque, registralo: entra nel volume della settimana come tutti gli altri.
      </p>
      {onLibero && (
        <button onClick={onLibero} className={`${VETRO} rounded-2xl px-4 py-3.5 flex items-center justify-center gap-2 text-[15px] font-bold text-white transition active:scale-[.99]`}>
          <Plus size={17} aria-hidden="true" /> Aggiungi un allenamento
        </button>
      )}
      {dati.gara && <RigaGara gara={dati.gara} />}
    </div>
  )
}

function RigaGara({ gara }) {
  return (
    <div className="rounded-2xl border border-white/[.09] px-4 py-3 flex items-center gap-3">
      <Trophy size={16} className="text-white shrink-0" aria-hidden="true" />
      <span className="text-[13.5px] text-gray-300 min-w-0 truncate">
        <span className="font-bold text-white">{gara.titolo}</span> fra {gara.giorni} giorni
      </span>
    </div>
  )
}

/**
 * Il parere sull'allenamento (src/lib/gradimento.js).
 *
 * 🔴 NON SI FORZA NESSUNO. Sotto c'è «Salta», e saltare è una risposta vera —
 * «nessuna preferenza» — che il coach vede come tale. Per la stessa ragione
 * questa scheda NON avanza da sola: passarla allo scadere del tempo vorrebbe
 * dire registrare «nessuna preferenza» a nome di chi stava ancora leggendo la
 * domanda.
 *
 * ⚠️ La riga sotto il titolo dice CHI legge la risposta, ed è la ragione per
 * cui qualcuno risponde sinceramente: un «non mi è piaciuto» si dà più
 * volentieri sapendo che serve a cambiare il programma, non a finire in pubblico.
 */
function SchedaGradimento({ colore, scelta, onScegli }) {
  // ⚠️ Si parte SEMPRE da nessuna selezione, anche se un completamento
  // precedente aveva già una risposta: una scelta già accesa è una risposta
  // suggerita, e chi ha fretta la conferma senza averla data.
  const mostrata = scelta
  const voce = (valore, Icona, etichetta) => {
    const attiva = mostrata === valore
    return (
      <button type="button" onClick={() => onScegli?.(valore)} aria-pressed={attiva}
        className={`${CARD} min-h-[136px] rounded-3xl flex flex-col items-center justify-center gap-3 px-3
                    transition active:scale-[.97]`}
        style={attiva ? { borderColor: colore, background: `${colore}2e`, boxShadow: `0 0 0 1px ${colore}` } : undefined}>
        <Icona size={34} strokeWidth={2.2} aria-hidden="true"
          style={{ color: attiva ? colore : '#fff' }} />
        <span className={`text-[14px] font-extrabold tracking-[-.01em] ${attiva ? 'text-white' : 'text-gray-300'}`}>
          {etichetta}
        </span>
      </button>
    )
  }

  return (
    <div className="cascata flex flex-col gap-6">
      <Testata occhiello="Il tuo parere" titolo="Ti è piaciuto questo allenamento?" colore={colore} />
      <p className="text-[14px] text-gray-400 leading-relaxed -mt-3">
        Lo vede solo il tuo coach: gli serve a capire quali allenamenti riproporre e quali cambiare.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {voce('si', ThumbsUp, 'Mi è piaciuto')}
        {voce('no', ThumbsDown, 'Non mi è piaciuto')}
      </div>
    </div>
  )
}

const SCHEDE = {
  fatto: SchedaFatto,
  gradimento: SchedaGradimento,
  settimana: SchedaSettimana,
  andamento: SchedaAndamento,
  primo: SchedaPrimo,
  inArrivo: SchedaInArrivo,
  prossimo: SchedaProssimo,
}

// ── la cornice ─────────────────────────────────────────────────────────────

/**
 * Il foglio a tutto schermo: la barra che avanza, le due metà da toccare, e
 * sull'ultima scheda l'azione.
 *
 * 🔴 **LE SCHEDE AVANZANO DA SOLE, come in una storia** (22/09/2026, su
 * richiesta del committente — la prima stesura le lasciava ferme). Ogni scheda
 * dura `DURATA_SCHEDA`, il segmento in cima si riempie in quel tempo e alla
 * fine passa alla successiva. Le due conseguenze che rendono la cosa
 * praticabile su una schermata di numeri invece che di fotografie:
 *
 * 1. **TENERE PREMUTO METTE IN PAUSA**, come su Instagram. Senza, un grafico a
 *    otto barre e tre totali passerebbe sotto gli occhi in sei secondi e chi
 *    vuole leggerlo non avrebbe nessun modo di fermarlo — e il modo che
 *    proverebbe per primo è proprio tenere il dito premuto.
 * 2. **L'ULTIMA SCHEDA NON SI CHIUDE DA SOLA.** In una storia l'ultimo
 *    segmento pieno chiude tutto; qui l'ultima scheda porta «Apri la scheda»,
 *    che è l'unica azione per cui questo recap esiste. Chiuderla allo scadere
 *    vorrebbe dire portare via il bottone a chi lo stava per premere. Il
 *    segmento resta pieno e il tempo si ferma lì.
 *
 * ⚠️ Con `prefers-reduced-motion` l'avanzamento automatico **non parte**: i
 * segmenti dicono solo dove si è e si avanza toccando. Chi chiede meno
 * movimento quasi sempre chiede anche più tempo, e una barra che scorre da
 * sola è tutte e due le cose insieme. È la stessa scelta di
 * `useNumeroCheSale`.
 *
 * ⚠️ Le zone di tocco stanno SOTTO il contenuto (`z-0`) e il contenuto è
 * `pointer-events-none` con i soli comandi riattivati. Messe sopra,
 * coprirebbero «Apri la scheda» e il tocco la avanzerebbe invece di aprirla.
 */
export function FoglioRecap({ recap, onChiudi, onApri, onLibero, onGradimento, caricamento = false }) {
  const [indice, setIndice] = useState(0)
  const [progresso, setProgresso] = useState(0)
  const premuto = useRef(null)
  const inPausa = useRef(false)
  const tenuta = useRef(false)
  const [scelta, setScelta] = useState(null)
  const [risposto, setRisposto] = useState(false)
  const dopoScelta = useRef(null)

  const schede = recap?.slide || []
  const corrente = schede[Math.min(indice, Math.max(0, schede.length - 1))]

  /**
   * Si lascia la domanda senza aver risposto: è «nessuna preferenza».
   *
   * Vale per «Salta», per il tocco a destra, per un segmento più avanti e per
   * la chiusura del recap MENTRE la domanda è a schermo. Tornare indietro non
   * conta — non è andarsene — e chi chiude il recap PRIMA di arrivarci non ha
   * mai visto la domanda: per lui non si registra niente (`null` in
   * `gradimento.js`, che è un'altra cosa).
   *
   * ⚠️ Può scattare due volte per la stessa uscita (la X chiama `chiudi`, e
   * la chiusura passa di nuovo di qui): è innocuo, `salvaGradimento` non
   * riscrive una nota identica.
   */
  const lasciaGradimento = () => {
    if (corrente?.tipo !== 'gradimento' || risposto) return
    setRisposto(true)
    onGradimento?.(null)
  }

  const { chiudi, maniglia, stileFoglio, classeFoglio } = useBottomSheet(() => { lasciaGradimento(); onChiudi?.() })

  useEffect(() => () => clearTimeout(dopoScelta.current), [])
  const ultima = indice >= schede.length - 1
  const apribile = !!onApri && corrente?.tipo === 'prossimo' && corrente.forma === 'assegnato' && !!corrente.workoutId
  const colore = coloreCategoria(recap?.categoria)
  const Scheda = corrente ? SCHEDE[corrente.tipo] : null

  /**
   * Va a una scheda e RIAZZERA il suo tempo.
   *
   * ⚠️ L'azzeramento sta qui e non dentro l'effetto dell'orologio: lì sarebbe
   * un `setState` sincrono in un effetto (che il linter prende, giustamente) e
   * soprattutto arriverebbe un fotogramma DOPO il cambio di scheda — quel
   * fotogramma la barra nuova lo passa piena, ed è esattamente lo sfarfallio
   * che si nota a ogni avanzamento.
   */
  const mostra = (n) => { setIndice(n); setProgresso(0) }

  const vaiA = (n) => {
    if (n < 0) return
    if (n > indice) lasciaGradimento()
    if (n >= schede.length) {
      // ⚠️ Mentre la lettura è in corso il recap ha una scheda sola: un tocco
      // sulla metà destra chiuderebbe proprio ciò che sta per arrivare.
      if (caricamento) return
      chiudi()
      return
    }
    mostra(n)
  }

  // Il tempo della scheda.
  //
  // ⚠️ Non parte finché la lettura è in corso, e non è una cautela generica:
  // durante il caricamento il recap ha UNA scheda, quindi il tempo scadrebbe
  // sull'ultima e si fermerebbe lì — e quando le altre arrivano nessuno lo
  // farebbe ripartire. Aspettando `caricamento`, il numero di schede è già
  // quello definitivo quando l'orologio si accende.
  const attivo = !caricamento && !menoMovimento() && schede.length > 0 && corrente?.tipo !== 'gradimento'
  useEffect(() => {
    if (!attivo) return
    let frame
    let trascorso = 0
    let ultimoIstante = performance.now()

    const passo = (ora) => {
      const dt = ora - ultimoIstante
      ultimoIstante = ora
      if (!inPausa.current) trascorso += dt

      const quota = Math.min(1, trascorso / DURATA_SCHEDA)
      setProgresso(quota)

      if (quota >= 1) {
        // Sull'ultima il segmento resta pieno e l'orologio si ferma: chiudere
        // da soli porterebbe via l'azione (vedi la nota in testa).
        if (indice + 1 < schede.length) mostra(indice + 1)
        return
      }
      frame = requestAnimationFrame(passo)
    }

    frame = requestAnimationFrame(passo)
    return () => cancelAnimationFrame(frame)
  }, [indice, attivo, schede.length])

  /**
   * Una risposta vera. Si salva subito e si passa alla scheda dopo con un
   * attimo di ritardo: quanto basta a vedere la scelta accendersi, che è la
   * conferma che il tocco è arrivato.
   * ⚠️ Cambiare idea è permesso — si torna indietro e si tocca l'altra — e
   * ogni tocco scrive: vale l'ultimo.
   */
  const scegli = (valore) => {
    setRisposto(true)
    setScelta(valore)
    onGradimento?.(valore)
    clearTimeout(dopoScelta.current)
    const da = indice
    dopoScelta.current = setTimeout(() => { if (da + 1 < schede.length) mostra(da + 1) }, 420)
  }

  /**
   * Il tocco sulle due metà.
   *
   * ⚠️ La navigazione sta in `onClick` e NON in `onPointerUp`: le due metà sono
   * bottoni veri — raggiungibili da tastiera e da VoiceOver — e un `Invio` non
   * produce nessun evento di puntatore. I gestori del puntatore servono solo a
   * mettere in pausa e a distinguere il tocco dalla TENUTA, che `onClick`
   * legge in `tenuta` e da cui si ferma.
   */
  const zona = (delta) => ({
    onPointerDown: () => {
      premuto.current = performance.now()
      tenuta.current = false
      inPausa.current = true
    },
    onPointerUp: () => {
      inPausa.current = false
      if (premuto.current != null) tenuta.current = performance.now() - premuto.current > MS_TENUTA
      premuto.current = null
    },
    onPointerCancel: () => { inPausa.current = false; premuto.current = null; tenuta.current = true },
    onPointerLeave: () => { inPausa.current = false },
    onClick: () => {
      if (tenuta.current) { tenuta.current = false; return }
      vaiA(indice + delta)
    },
  })

  return (
    <div className={`fixed inset-0 z-[160] bg-[#0B0B0B] flex flex-col ${classeFoglio}`}
      style={stileFoglio} role="dialog" aria-modal="true" aria-label="Recap dell'allenamento">

      <div aria-hidden="true" className="alone"
        style={{ '--alone-rgb': rgbDi(colore), '--alone-alfa': .2, top: -260, left: '50%', marginLeft: -220, width: 440, height: 440 }} />

      <div className="relative shrink-0 pt-[calc(env(safe-area-inset-top)+0.5rem)] px-4">
        {/* ⚠️ La maniglia è una striscia SUA, non tutta la testata. Con
            `{...maniglia}` sul contenitore, il suo `onClick` — che chiude —
            riceverebbe anche i clic dei segmenti e della X saliti per
            bolla: toccare un segmento chiuderebbe il recap invece di
            portarcisi. */}
        <div {...maniglia} role="button" tabIndex={-1} aria-label="Trascina giù per chiudere"
          className="py-2.5 flex justify-center cursor-grab">
          <span aria-hidden="true" className="block w-10 h-1 rounded-full bg-white/25" />
        </div>
        <div className="flex items-center gap-1.5">
          {schede.map((s, i) => {
            // Le passate sono piene, la corrente si riempie, le altre vuote.
            // ⚠️ Senza avanzamento automatico la corrente è piena e basta: una
            // barra ferma a metà per sempre si legge come un caricamento
            // bloccato.
            const quota = i < indice ? 1 : i > indice ? 0 : (attivo ? progresso : 1)
            return (
              <button key={s.tipo + i} type="button" onClick={() => { if (i > indice) lasciaGradimento(); mostra(i) }}
                aria-label={`Scheda ${i + 1} di ${schede.length}`} aria-current={i === indice || undefined}
                className="flex-1 py-2">
                <span className="block h-[3px] rounded-full bg-white/25 overflow-hidden">
                  {/* ⚠️ Nessuna `transition` sulla larghezza: la anima già il
                      ciclo di fotogrammi, e una transizione sopra le due cose
                      farebbe strisciare il segmento OLTRE il cambio di scheda,
                      cioè riempirsi mentre quello dopo è già partito. */}
                  <span aria-hidden="true" className="block h-full rounded-full bg-white"
                    style={{ width: `${quota * 100}%` }} />
                </span>
              </button>
            )
          })}
          <button type="button" onClick={chiudi} aria-label="Chiudi il recap"
            className={`${VETRO} w-9 h-9 rounded-full flex items-center justify-center text-white shrink-0 ml-1.5`}>
            <X size={17} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="relative flex-1 min-h-0 overflow-hidden">
        {/* Le due metà: a sinistra si torna, a destra si avanza. Stanno sotto
            il contenuto, e sono bottoni veri perché la tastiera possa
            raggiungerle. */}
        <button type="button" {...zona(-1)} aria-label="Scheda precedente"
          className="absolute inset-y-0 left-0 w-[32%] z-0" />
        <button type="button" {...zona(+1)} aria-label="Scheda successiva"
          className="absolute inset-y-0 right-0 w-[68%] z-0" />

        <div className="relative z-10 h-full overflow-y-auto hide-scrollbar pointer-events-none
                        [&_button]:pointer-events-auto [&_a]:pointer-events-auto">
          {/* ⚠️ `min-h-full` + `justify-center` e non `justify-center` sul
              contenitore che scorre: una scheda corta si centra, una lunga fa
              crescere il wrapper oltre l'altezza minima e il centraggio smette
              da sé — mentre `justify-center` su un contenitore in overflow
              taglia la CIMA del contenuto, che qui è il titolo. */}
          <div className="min-h-full flex flex-col justify-center px-5 py-7">
            {/* ⚠️ `key` sull'indice: rimonta la scheda, quindi la cascata riparte.
                Senza, solo la prima entra e le altre compaiono secche. */}
            {Scheda && <div key={indice}><Scheda dati={corrente} colore={colore} onApri={onApri} onLibero={onLibero}
              scelta={scelta} onScegli={scegli} /></div>}
            {caricamento && indice === 0 && (
              <p className="mt-6 text-[12.5px] text-muted text-center">Sto raccogliendo i tuoi numeri…</p>
            )}
          </div>
        </div>
      </div>

      {/* ⚠️ Il piede c'è SEMPRE e ha sempre la stessa altezza, anche quando non
          porta un bottone: le schede si centrano nello spazio che resta, e un
          piede che compare solo in fondo le farebbe saltare su e giù a ogni
          avanzamento. Sulle schede di passaggio ci sta la riga che insegna il
          gesto — i due bottoni «Avanti» e «Salta» sono usciti il 22/09, e senza
          una riga che lo dica il tocco a destra non lo scopre nessuno. */}
      <div className="shrink-0 px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-2 flex items-center gap-3 min-h-[68px]">
        {corrente?.tipo === 'gradimento' ? (
          // «Salta» è una scritta e non un bottone pieno, di proposito: le due
          // risposte sopra sono la domanda, questa è l'uscita. Ha comunque un
          // bersaglio alto quanto il piede, o su un pollice non la si prende.
          <button type="button" onClick={() => vaiA(indice + 1)}
            className="flex-1 min-h-[48px] text-center text-[15px] font-bold text-muted hover:text-white transition">
            Salta
          </button>
        ) : ultima && apribile ? (
          <>
            <button type="button" onClick={chiudi} className={`${BOTTONE_QUIETO} max-w-[38%]`}>Chiudi</button>
            <button type="button" onClick={() => onApri(corrente)} className={BOTTONE_BRAND}>Apri la scheda</button>
          </>
        ) : ultima ? (
          <button type="button" onClick={chiudi} className={BOTTONE_BRAND}>Chiudi</button>
        ) : (
          <p className="flex-1 text-center text-[12px] text-muted">
            Tocca a destra per continuare · tieni premuto per fermare
          </p>
        )}
      </div>
    </div>
  )
}
