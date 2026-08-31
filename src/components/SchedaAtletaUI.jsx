// SchedaAtletaUI.jsx — i pezzi visivi della scheda di un atleta.
//
// Stesso patto di HomeAtletaUI, HomeCoachUI, CreaWorkoutUI e WorkoutDetailUI:
// SOLA PRESENTAZIONE. Ricevono numeri già calcolati (src/lib/andamento.js) e
// callback già esistenti. Se qui dentro compare una `supabase`, un `useEffect`
// di rete o una regola su come si misura il carico, è finito nel file sbagliato.
//
// Il rework in una riga: la pagina apriva con il logo, poi una foto da 96px con
// quattro celle di anagrafica, poi tre celle di settimana, poi tre tab — e il
// dato per cui il coach entra qui, se questo atleta sta seguendo il programma e
// con quanto carico, era nella terza tab, dietro due tocchi e quattro grafici
// che non si parlavano. Ora è la prima cosa in pagina, e le tab non ci sono più.

import { ChevronDown, ChevronRight, User } from 'lucide-react'
import { CARD, LABEL, RIGA, VETRO } from '../lib/stiliCard'
import { BRAND, RUNNING } from '../lib/colori'

// ── L'identità ────────────────────────────────────────────────────────────
// Erano una foto da 96px, un nome, e quattro celle da 22px con età, altezza,
// peso e numero di workout: mezzo schermo per dati che si inseriscono una
// volta e non si consultano mai. Diventano una riga sotto il nome.

export function IdentitaAtleta({ foto, nome, anagrafica, onErroreFoto, social, pillola, nota }) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-[13px]">
        <span className={`shrink-0 w-14 h-14 rounded-full overflow-hidden flex items-center justify-center
                          ${VETRO} text-muted`}>
          {foto
            ? <img src={foto} alt="" className="w-full h-full object-cover" onError={onErroreFoto} />
            : <User size={28} aria-hidden="true" />}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-[22px] font-black tracking-[-.02em] text-white leading-[1.1] text-balance">{nome}</h1>
            {social}
          </div>
          {anagrafica && (
            <p className="mt-[5px] text-xs text-muted tracking-[.01em]">{anagrafica}</p>
          )}
        </div>
      </div>
      {pillola}
      {/* ⚠️ È `pausaAtleta.testo`, mai `athlete.notes` grezzo: il marcatore
          `[PAUSA: …]` è uno stato, e mostrarlo qui lo farebbe leggere come
          testo scritto dal coach (CLAUDE.md §9-decies). */}
      {nota && <p className="text-sm text-muted whitespace-pre-wrap text-pretty">{nota}</p>}
    </div>
  )
}

/**
 * Un social accanto al nome: 15px, grigio.
 *
 * Erano due bottoni tondi da 40px sotto il nome, cioè due bersagli grandi
 * quanto una CTA per un collegamento che si apre una volta l'anno. `href`
 * quando il profilo c'è, `onClick` quando va ancora inserito.
 */
export function IconaSocial({ etichetta, icona: Icona, href, colore, onClick }) {
  const classe = `shrink-0 w-7 h-7 -m-1 rounded-full flex items-center justify-center transition
                  hover:bg-white/[.07]`
  const stile = colore ? { color: colore } : undefined
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" title={etichetta} aria-label={etichetta}
        className={`${classe} text-gray-300`} style={stile}>
        <Icona size={15} aria-hidden="true" />
      </a>
    )
  }
  return (
    <button type="button" onClick={onClick} title={etichetta} aria-label={etichetta}
      className={`${classe} text-[#5b6070] hover:text-gray-300`}>
      <Icona size={15} aria-hidden="true" />
    </button>
  )
}

// ── L'eroe ────────────────────────────────────────────────────────────────
// Aderenza a 30 giorni nell'anello, e accanto il carico delle ultime quattro
// settimane. Una riga sotto dice a parole cosa dicono i due numeri insieme: è
// la frase su cui si decide se caricare o scaricare, ed è l'unica ragione per
// cui i due grafici stanno nella stessa card invece che uno sotto l'altro.

export function CardAndamento({ titolo, percentuale, fatti, assegnati, settimane, delta, frase, dettaglio }) {
  const massimo = Math.max(...settimane.map(s => s.load), 1)
  const suGiu = delta == null ? null : delta >= 0

  return (
    <div className={`${CARD} p-[18px] hero-transition`}>
      <p className={`${LABEL} mb-3.5`}>{titolo}</p>

      <div className="flex items-center gap-[18px]">
        <Anello percentuale={percentuale} sotto={`${fatti}/${assegnati}`} />

        <div className="flex-1 min-w-0">
          <p className={`${LABEL} tracking-[.08em] mb-2`}>Carico · min × RPE</p>
          {/* 62 = 44 di barra + 5 di gap + 13 di etichetta. Alla prima prova a
              393px erano 34, e con quattro colonne larghe 52px le barre si
              leggevano come fasce orizzontali tutte uguali: la differenza fra
              una settimana e l'altra, che è l'unica cosa che il grafico deve
              dire, spariva nell'aspetto. */}
          <div className="flex items-end gap-[7px] h-[62px]" role="img"
            aria-label={settimane.map(s => `${s.breve}: ${Math.round(s.load)} punti`).join(', ')}>
            {settimane.map((s, i) => {
              const ultima = i === settimane.length - 1
              return (
                <div key={s.startStr} className="flex-1 flex flex-col items-center gap-[5px]">
                  <div className="w-full rounded-md transition-[height] duration-700 ease-out"
                    style={{
                      // Il minimo di 3px non è estetica: una settimana a zero
                      // e una settimana senza dati diventerebbero lo stesso
                      // nulla, e sono due cose diverse.
                      height: `${Math.max((s.load / massimo) * 44, s.load > 0 ? 3 : 0)}px`,
                      background: ultima ? BRAND : '#2f2f33',
                    }} />
                  <span className={`font-mono text-[11px] font-bold ${ultima ? 'text-brand' : 'text-muted'}`}>
                    {s.breve}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2.5 mt-4 pt-3.5 border-t border-white/[.07]">
        {suGiu !== null && (
          <span className={`shrink-0 font-mono text-[11px] font-extrabold rounded-full px-2 py-1 ${
            suGiu ? 'bg-green-500/[.12] text-green-400' : 'bg-orange-500/[.12] text-orange-400'}`}>
            {suGiu ? '+' : ''}{delta}%
          </span>
        )}
        <p className="text-[12.5px] leading-[1.45] text-gray-300 text-pretty">
          {frase}{dettaglio && <span className="text-muted"> {dettaglio}</span>}
        </p>
      </div>
    </div>
  )
}

/** L'anello dell'aderenza. r=40 → circonferenza 251, da cui il `251` sotto. */
function Anello({ percentuale, sotto }) {
  return (
    // ⚠️ L'etichetta non è ridondante: letti da VoiceOver i due numeri dentro
    // l'anello suonano «33 percento 1 barra 3», che non dice di cosa. Ed è
    // l'unico appiglio che il grafico offre a chi non lo vede.
    <div className="shrink-0 relative w-24 h-24" role="img"
      aria-label={`Aderenza ${percentuale}%, ${sotto} allenamenti`}>
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90" aria-hidden="true">
        <circle cx="50" cy="50" r="40" fill="none" stroke="#333" strokeWidth="8" />
        <circle cx="50" cy="50" r="40" fill="none" stroke={BRAND} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={`${(percentuale / 100) * 251} 251`}
          className="transition-all duration-1000 ease-out" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden="true">
        <span className="text-[23px] font-black text-white leading-none">
          {percentuale}<span className="text-[13px]">%</span>
        </span>
        <span className="mt-0.5 font-mono text-[11px] font-bold text-muted">{sotto}</span>
      </div>
    </div>
  )
}

// ── Il bento ──────────────────────────────────────────────────────────────
// Il grafico del volume e quello della distribuzione RPE erano due card intere
// dentro una tab. Sono due numeri con la loro forma sotto.

export function CellaBento({ etichetta, valore, unita, nota, notaColore = 'text-muted', children, coda }) {
  return (
    <div className={`${CARD} p-[15px] flex flex-col`}>
      <p className={`${LABEL} tracking-[.08em]`}>{etichetta}</p>
      <p className="mt-1.5 text-[26px] font-black text-white leading-none">
        {valore}
        {unita && <span className="pl-[3px] text-[13px] font-semibold text-muted">{unita}</span>}
      </p>
      {nota && <p className={`mt-[3px] text-[11px] font-bold ${notaColore}`}>{nota}</p>}
      {children}
      {coda && <p className="mt-2 text-[11px] font-bold text-muted">{coda}</p>}
    </div>
  )
}

/** Lo sparkline del volume: valori già normalizzati a 0-100, in ordine. */
export function Sparkline({ valori }) {
  if (valori.length < 2) return null
  const punti = valori.map((v, i) => `${(i / (valori.length - 1)) * 100},${34 - (v / 100) * 32}`)
  return (
    <svg viewBox="0 0 100 34" preserveAspectRatio="none" width="100%" height="34" aria-hidden="true"
      className="mt-[9px] block overflow-visible">
      <defs>
        <linearGradient id="sparkVolume" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(0,148,198,.45)" />
          <stop offset="100%" stopColor="rgba(0,148,198,0)" />
        </linearGradient>
      </defs>
      <polygon points={`0,34 ${punti.join(' ')} 100,34`} fill="url(#sparkVolume)" />
      <polyline points={punti.join(' ')} fill="none" stroke={RUNNING} strokeWidth="2.5"
        vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Le quattro fasce di RPE come una barra sola. */
export function BarraFasce({ distribuzione }) {
  const { light, moderate, hard, extreme, total } = distribuzione
  if (!total) return <div className="mt-[13px] h-2 rounded-full bg-white/[.06]" />
  const fasce = [
    ['Leggero 1-4', light, '#22c55e'],
    ['Moderato 5-6', moderate, '#f1ba17'],
    ['Impegnativo 7-8', hard, '#f97316'],
    ['Massimale 9-10', extreme, '#ef4444'],
  ]
  return (
    <div className="mt-[13px] flex h-2 rounded-full overflow-hidden" role="img"
      aria-label={fasce.filter(([, n]) => n > 0).map(([e, n]) => `${e}: ${n}`).join(', ')}>
      {fasce.map(([etichetta, n, colore]) => n > 0 && (
        <div key={etichetta} style={{ width: `${(n / total) * 100}%`, background: colore }} />
      ))}
    </div>
  )
}

// ── Le righe ──────────────────────────────────────────────────────────────

/** Il prossimo evento, in una riga invece che in un banner alto quanto una card. */
export function RigaObiettivo({ titolo, giorni, onClick }) {
  return (
    <button type="button" onClick={onClick}
      className={`${CARD} w-full px-4 py-3.5 flex items-center gap-[13px] text-left
                  border-white/[.14] hover:border-white/25 transition`}>
      <span className={`shrink-0 w-[38px] h-[38px] rounded-full ${VETRO} flex items-center justify-center text-white`}>
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="3" /><path d="M3 10h18M8 2v4M16 2v4" />
        </svg>
      </span>
      <span className="flex-1 min-w-0">
        <span className={`block ${LABEL} tracking-[.09em]`}>Prossimo obiettivo</span>
        <span className="block mt-[3px] text-[15px] font-bold text-white leading-tight truncate">{titolo}</span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-[22px] font-black text-white leading-none">{giorni}</span>
        <span className="block mt-px font-mono text-[11px] font-bold text-muted">
          {giorni === 1 ? 'giorno' : 'giorni'}
        </span>
      </span>
    </button>
  )
}

/**
 * Una sezione che si apre in pagina.
 *
 * Sostituisce due delle tre tab. La differenza che conta non è estetica: una
 * tab nasconde il contenuto E l'esistenza del contenuto, mentre la riga dice
 * quanto c'è dentro prima di aprirla — 34 allenamenti, 6 record.
 */
export function RigaApribile({ icona: Icona, titolo, conteggio, aperta, onToggle }) {
  return (
    <button type="button" onClick={onToggle} aria-expanded={aperta}
      className={`${RIGA} w-full px-[15px] py-[13px] flex items-center gap-3 text-left
                  hover:bg-white/[.055] transition`}>
      <Icona size={18} className={aperta ? 'text-brand shrink-0' : 'text-muted shrink-0'} aria-hidden="true" />
      <span className="flex-1 min-w-0 text-sm font-bold text-white truncate">{titolo}</span>
      {conteggio != null && (
        <span className="shrink-0 font-mono text-[11px] font-bold text-muted">{conteggio}</span>
      )}
      <ChevronDown size={17} aria-hidden="true"
        className={`shrink-0 transition-transform ${aperta ? 'rotate-180 text-brand' : 'text-muted'}`} />
    </button>
  )
}

/** Una riga che è un comando e basta: nessun conteggio, nessuna apertura. */
export function RigaAzione({ icona: Icona, titolo, onClick }) {
  return (
    <button type="button" onClick={onClick}
      className={`${RIGA} w-full px-[15px] py-[13px] flex items-center gap-3 text-left
                  hover:bg-white/[.055] transition`}>
      <Icona size={18} className="shrink-0 text-muted" aria-hidden="true" />
      <span className="flex-1 min-w-0 text-sm font-bold text-white truncate">{titolo}</span>
      <ChevronRight size={17} className="shrink-0 text-muted" aria-hidden="true" />
    </button>
  )
}

/** La pillola «In pausa». ⚠️ Il chiamante la nasconde all'atleta (§9-decies). */
export function PillolaPausa({ dal }) {
  return (
    <p className="inline-flex w-fit items-center gap-1.5 px-2.5 py-1 rounded-full whitespace-nowrap
                  bg-orange-500/10 border border-orange-500/30 text-orange-400
                  font-mono text-[11px] font-bold uppercase tracking-[.06em]">
      <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-orange-400" />
      In pausa{dal ? ` dal ${dal}` : ''}
    </p>
  )
}
