// FoglioMisure.jsx — il modo unico di scrivere i numeri del builder.
//
// In alto le schede delle misure di quella cosa (Ripetizioni · Peso, Ogni ·
// Round, Volte · Distanza · Passo · Recupero), ognuna con il proprio valore già
// scritto: si legge tutto senza aprire niente. Sotto, la misura scelta: il
// numero grande, il righello, e tre o quattro scorciatoie.
//
// Ha sostituito tre controlli diversi — lo Stepper (meno/più dentro liste da
// trecento voci: 80 kg erano 80 tocchi), la ruota orizzontale del passo e le
// rotelle verticali della corsa — con uno solo. Storia e ragioni in
// docs/memoria/crea-workout.md, «Il righello».
//
// ⚠️ SOLA PRESENTAZIONE, come CreaWorkoutUI: riceve i valori e chi li cambia.
// Quali misure ha un esercizio lo decide chi lo usa.
// ⚠️ Si importa solo da CreateWorkout: il chunk di CreaWorkoutUI è condiviso con
// la scheda workout (CLAUDE.md §2), e questo file porta con sé il righello.
//
// Una `vista` (una scheda) è:
//   { chiave, etichetta, valore, onChange,
//     scala?   — il nome di una scala di src/lib/scaleMisura.js, oppure
//     scelte?  — [{ valore, etichetta }] per le misure che NON sono una scala
//                (le zone, «a sensazione»): lì il righello non ha senso;
//     rapidi?  — i valori delle scorciatoie sotto il righello;
//     pillole? — [{ id, titolo, attiva, onClick }]: i modi e i casi speciali
//                (Max, Doppio, Corpo libero, Ritmo/Zona), sopra il numero;
//     secondo? — { valore, onChange, etichetta }: il secondo estremo di un
//                intervallo («3:50–4:00»), facoltativo ("-" = assente). }

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Keyboard, Plus, X } from 'lucide-react'
import Righello from './Righello'
import { CARD, LABEL, VETRO } from '../lib/stiliCard'
import { SCALE, indiceVicino, valoreDaTesto, testoDaValore, etichettaDi, unitaDi, testoMisura } from '../lib/scaleMisura'
import { vibraScelta } from '../lib/aptica'
import { useBottomSheet } from '../useBottomSheet'

const ACCENTI = {
  brand: 'var(--color-brand)',
  running: 'var(--color-running)',
}

const riassuntoDi = (vista) => {
  const primo = testoMisura(vista)
  return vista.secondo && vista.secondo.valore && vista.secondo.valore !== '-'
    ? `${primo}–${testoMisura(vista, vista.secondo.valore)}`
    : primo
}

const AIUTO_TASTIERA = {
  tempo: 'Scrivi 130 per 1:30',
}

// ── Le schede delle misure ────────────────────────────────────────────────
function Schede({ misure, attiva, onAttiva }) {
  return (
    <div className="flex gap-1.5 p-1 rounded-2xl bg-black/40 border border-white/[.06]">
      {misure.map(m => {
        const on = m.chiave === attiva
        return (
          <button key={m.chiave} type="button" aria-pressed={on}
            aria-label={`${m.etichetta}: ${riassuntoDi(m)}`}
            onClick={() => { if (!on) vibraScelta(); onAttiva(m.chiave) }}
            className={`flex-1 min-w-0 min-h-[52px] rounded-xl px-3 py-2 text-left transition ${
              on ? 'bg-white/[.09] shadow-[inset_0_1px_0_rgba(255,255,255,.08)]' : 'hover:bg-white/[.04]'
            }`}>
            <span className={`${LABEL} block truncate`}>{m.etichetta}</span>
            <span className={`block mt-[3px] text-[15px] font-extrabold tracking-[-.01em] truncate tabular-nums ${
              on ? 'text-white' : 'text-[#c9ccd4]'}`}>{riassuntoDi(m)}</span>
          </button>
        )
      })}
    </div>
  )
}

/** Un pulsante a pillola: i modi e i casi speciali, e le scorciatoie. */
function Pillola({ attiva, onClick, children, accento, piccola = false, etichetta }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={attiva} aria-label={etichetta}
      className={`shrink-0 ${piccola ? 'min-h-9 px-3.5 text-[12.5px]' : 'min-h-11 px-4 text-[13px]'} rounded-full font-extrabold
                  tabular-nums border transition active:scale-95 ${
        attiva ? '' : 'bg-white/[.055] border-white/10 text-[#c9ccd4] hover:border-white/20'
      }`}
      style={attiva ? {
        background: `color-mix(in srgb, ${accento} 15%, transparent)`,
        borderColor: `color-mix(in srgb, ${accento} 45%, transparent)`,
        color: accento,
      } : undefined}>
      {children}
    </button>
  )
}

// ── Il numero grande, o il campo per scriverlo ────────────────────────────
function NumeroGrande({ vista, valore, onChange, attivo = true, onTocca, piccolo = false, senzaUnita = false }) {
  const [testo, setTesto] = useState(null)   // null = non si sta scrivendo
  const [errore, setErrore] = useState(null)
  const scala = vista.scala ? SCALE[vista.scala] : null

  const vuoto = valore === '-' || valore == null || valore === ''
  // ⚠️ Un valore che non c'è ancora NON si scrive «—» a 64px: un trattino
  // gigante si legge come un difetto di disegno. Si mostra spento il valore
  // che sta sotto l'ago — quello che il primo movimento scriverà — e la
  // scheda in alto continua a dire «—», che è la verità.
  const sottoAgo = vuoto && scala ? scala.voci[indiceVicino(scala, valore)].valore : null
  const mostrato = sottoAgo ?? valore
  const numero = vuoto && !scala ? '—' : mostrato === 'Max' || !scala ? (vista.scelte ? testoMisura(vista, mostrato) : String(mostrato)) : etichettaDi(scala, mostrato)
  const unita = senzaUnita || mostrato === 'Max' || !scala || (vuoto && !scala) ? '' : unitaDi(vista.scala, mostrato)

  const conferma = (chiudiComunque) => {
    const t = (testo ?? '').trim()
    if (!t) { setTesto(null); setErrore(null); return }
    const v = valoreDaTesto(vista.scala, t)
    if (v) { onChange(v); setTesto(null); setErrore(null); return }
    if (chiudiComunque) { setTesto(null); setErrore(null); return }
    setErrore(scala?.tastiera === 'tempo' ? 'Scrivi un tempo, per esempio 130 per 1:30' : 'Scrivi solo il numero')
  }

  const dimensione = piccolo ? 'text-[46px]' : 'text-[64px]'

  if (testo !== null) {
    return (
      <div className="flex flex-col items-center gap-1.5">
        <div className="flex items-baseline justify-center gap-1.5">
          <input
            autoFocus
            aria-label={`Scrivi ${vista.etichetta}`}
            inputMode={scala?.tastiera === 'decimal' ? 'decimal' : 'numeric'}
            enterKeyHint="done"
            value={testo}
            onChange={e => { setTesto(e.target.value); setErrore(null) }}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); conferma(false) }
              if (e.key === 'Escape') { e.stopPropagation(); setTesto(null); setErrore(null) }
            }}
            onBlur={() => conferma(true)}
            style={{ width: `${Math.max(2, testo.length) + 0.4}ch` }}
            className={`max-w-[6ch] bg-transparent text-center ${dimensione} font-black leading-none tracking-[-.035em] tabular-nums
                        text-white caret-brand focus:outline-none border-b-2 border-white/15 focus:border-brand pb-1`} />
          {unita && <span className="text-[16px] font-bold text-muted">{unita}</span>}
        </div>
        {/* ⚠️ «Fatto» non è un doppione dell'invio: la tastiera numerica di
            iOS NON HA il tasto invio, e senza questo bottone l'unico modo di
            confermare sarebbe toccare a caso fuori dal campo. Il mouseDown
            evita che il campo perda il fuoco (e si chiuda) prima del clic. */}
        <div className="flex items-center gap-3">
          <p className={`text-[12px] font-semibold ${errore ? 'text-red-400' : 'text-muted'}`} role={errore ? 'alert' : undefined}>
            {errore || AIUTO_TASTIERA[scala?.tastiera] || 'Scrivi il valore esatto'}
          </p>
          <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => conferma(false)}
            className="shrink-0 min-h-9 px-3.5 rounded-full bg-brand/15 border border-brand/40 text-brand text-[12.5px] font-extrabold">
            Fatto
          </button>
        </div>
      </div>
    )
  }

  // Senza una scala (le zone, «a sensazione») il numero grande non si scrive:
  // è solo la scelta fatta con le pillole qui sotto, e non deve fingersi un bottone.
  if (!scala) {
    return (
      <span data-valore-di={vista.etichetta}
        className={`${dimensione} font-black leading-none tracking-[-.035em] ${vuoto ? 'text-[#4a4f5c]' : 'text-white'}
                    ${String(numero).length > 5 ? 'text-[40px]' : ''}`}>{numero}</span>
    )
  }

  return (
    <button type="button"
      onClick={() => {
        if (onTocca && !attivo) { onTocca(); return }
        if (!scala) return
        setTesto(testoDaValore(valore))
      }}
      aria-label={attivo && scala ? `Scrivi ${vista.etichetta}: ${testoMisura(vista, valore)}` : `${vista.etichetta}: ${testoMisura(vista, valore)}`}
      className="group inline-flex items-baseline justify-center gap-1.5 rounded-2xl px-2 -mx-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30">
      <span data-valore-di={vista.etichetta}
        className={`${dimensione} font-black leading-none tracking-[-.035em] tabular-nums transition-colors ${
          attivo && !vuoto ? 'text-white' : 'text-[#4a4f5c]'}`}>{numero}</span>
      {unita && <span className={`text-[16px] font-bold ${attivo && !vuoto ? 'text-muted' : 'text-[#3a3f4a]'}`}>{unita}</span>}
      {attivo && scala && !piccolo && (
        <Keyboard size={15} aria-hidden="true" className="self-center ml-0.5 text-[#4a4f5c] group-hover:text-muted transition-colors" />
      )}
    </button>
  )
}

// ── Il foglio ─────────────────────────────────────────────────────────────
/**
 * @param {object} p
 * @param {object[]} p.misure   le viste, una per scheda
 * @param {string}   p.attiva   la chiave della scheda aperta
 * @param {(k:string)=>void} p.onAttiva
 * @param {'brand'|'running'} [p.accento]
 * @param {boolean} [p.senzaCarta]  dentro un foglio dal basso la carta c'è già
 */
export function FoglioMisure({ misure, attiva, onAttiva, accento = 'brand', senzaCarta = false }) {
  const colore = ACCENTI[accento] || ACCENTI.brand
  const vista = misure.find(m => m.chiave === attiva) || misure[0]
  // Quale estremo di un intervallo muove il righello. Torna sul primo quando
  // si cambia scheda: il secondo è un'aggiunta, non il punto di partenza.
  const [estremo, setEstremo] = useState({ chiave: vista.chiave, quale: 'da' })
  const quale = estremo.chiave === vista.chiave ? estremo.quale : 'da'

  const conSecondo = vista.secondo && vista.secondo.valore && vista.secondo.valore !== '-'
  const corrente = quale === 'a' && conSecondo
    ? { valore: vista.secondo.valore, onChange: vista.secondo.onChange }
    : { valore: vista.valore, onChange: vista.onChange }

  const scala = vista.scala ? SCALE[vista.scala] : null
  const indice = scala ? indiceVicino(scala, corrente.valore) : 0

  const aggiungiSecondo = () => {
    // Il secondo estremo parte due tacche più in là del primo: un intervallo
    // di passo tipico è 5–10 secondi, non zero.
    const i = Math.min(scala.voci.length - 1, indiceVicino(scala, vista.valore) + 2)
    vista.secondo.onChange(scala.voci[i].valore)
    setEstremo({ chiave: vista.chiave, quale: 'a' })
    vibraScelta()
  }

  return (
    <div className="flex flex-col gap-3">
      {misure.length > 1 && <Schede misure={misure} attiva={vista.chiave} onAttiva={onAttiva} />}

      <div className={`${senzaCarta ? '' : `${CARD} px-4`} pt-4 pb-4 flex flex-col gap-3.5`}>
        {vista.pillole?.length > 0 && (
          <div className="flex gap-2 justify-center flex-wrap">
            {vista.pillole.map(p => (
              <Pillola key={p.id} piccola attiva={p.attiva} accento={colore}
                onClick={() => { if (!p.attiva) vibraScelta(); p.onClick() }}>
                {p.titolo}
              </Pillola>
            ))}
          </div>
        )}

        {/* Il numero grande. Con un intervallo sono due, e quello che il
            righello muove è quello acceso. */}
        <div className="min-h-[76px] flex items-center justify-center gap-2" key={vista.chiave}>
          {conSecondo ? (
            <>
              {/* L'unità solo dopo il secondo: «5:00 – 5:10 /km», come si scrive. */}
              <NumeroGrande vista={vista} valore={vista.valore} onChange={vista.onChange} piccolo senzaUnita
                attivo={quale === 'da'} onTocca={() => { vibraScelta(); setEstremo({ chiave: vista.chiave, quale: 'da' }) }} />
              <span aria-hidden="true" className="text-[30px] font-black" style={{ color: colore }}>–</span>
              <NumeroGrande vista={{ ...vista, etichetta: vista.secondo.etichetta || `${vista.etichetta} fino a` }}
                valore={vista.secondo.valore} onChange={vista.secondo.onChange} piccolo
                attivo={quale === 'a'} onTocca={() => { vibraScelta(); setEstremo({ chiave: vista.chiave, quale: 'a' }) }} />
              <button type="button" aria-label="Togli il secondo estremo"
                onClick={() => { vista.secondo.onChange('-'); setEstremo({ chiave: vista.chiave, quale: 'da' }) }}
                className={`shrink-0 w-9 h-9 rounded-full ${VETRO} flex items-center justify-center text-muted hover:text-white transition`}>
                <X size={15} aria-hidden="true" />
              </button>
            </>
          ) : (
            <NumeroGrande vista={vista} valore={vista.valore} onChange={vista.onChange} />
          )}
        </div>

        {scala && (
          <Righello
            voci={scala.voci}
            indice={indice}
            onScelta={(i) => corrente.onChange(scala.voci[i].valore)}
            etichetta={quale === 'a' && conSecondo ? (vista.secondo.etichetta || `${vista.etichetta} fino a`) : vista.etichetta}
            testoValore={corrente.valore === '-' || !corrente.valore ? 'Non ancora scelto' : testoMisura(vista, corrente.valore)}
            colore={colore}
          />
        )}

        {vista.scelte && (
          <div className="grid grid-cols-3 gap-2" role="group" aria-label={vista.etichetta}>
            {vista.scelte.map(s => (
              <Pillola key={s.valore} attiva={s.valore === vista.valore} accento={colore}
                onClick={() => { if (s.valore !== vista.valore) vibraScelta(); vista.onChange(s.valore) }}>
                {s.etichetta}
              </Pillola>
            ))}
          </div>
        )}

        {(vista.rapidi?.length > 0 || (vista.secondo && !conSecondo && scala)) && (
          <div className="flex gap-2 justify-center flex-wrap">
            {scala && vista.rapidi?.map(r => (
              <Pillola key={r} attiva={r === corrente.valore} accento={colore} piccola
                etichetta={testoMisura(vista, r)}
                onClick={() => { if (r !== corrente.valore) vibraScelta(); corrente.onChange(r) }}>
                {/* Solo il numero: l'unità è già scritta grande sopra, e
                    ripeterla in ogni pillola mandava la riga a capo. */}
                {etichettaDi(scala, r)}
              </Pillola>
            ))}
            {vista.secondo && !conSecondo && scala && vista.valore && vista.valore !== '-' && (
              <button type="button" onClick={aggiungiSecondo}
                className={`shrink-0 min-h-9 px-3.5 rounded-full ${VETRO} text-[12.5px] font-extrabold text-[#c9ccd4]
                            hover:border-white/25 inline-flex items-center gap-1.5 transition`}>
                <Plus size={14} aria-hidden="true" /> Intervallo
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Il foglio dal basso ───────────────────────────────────────────────────
/**
 * Le misure di un BLOCCO (Ogni · Round, Durata, Rest…) in un foglio che sale
 * dal basso: la card del blocco resta corta, con il riepilogo in pillole, e i
 * numeri si scrivono solo quando servono. Prima erano due card piene da 170px
 * sempre aperte sopra gli esercizi.
 *
 * ⚠️ La X ha `aria-label="Chiudi"`: è così che il tasto indietro di Android
 * trova il modo di chiudere una modale (src/lib/indietroAndroid.js).
 */
export function FoglioParametri({ titolo, sottotitolo, misure, attiva, onAttiva, onChiudi, accento = 'brand' }) {
  const { chiudi, maniglia, stileFoglio, stileVelo, classeFoglio, classeVelo } = useBottomSheet(onChiudi)

  return createPortal(
    <div className="fixed inset-0 z-[70] flex flex-col justify-end">
      <div aria-hidden="true" onClick={chiudi} className={`absolute inset-0 bg-black/70 ${classeVelo}`} style={stileVelo} />
      <div role="dialog" aria-label={titolo}
        className={`relative bg-[#141416] border-t border-white/[.08] rounded-t-3xl px-4
                    pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-20px_50px_-12px_rgba(0,0,0,.85)] ${classeFoglio}`}
        style={stileFoglio}>
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Trascina giù per chiudere" {...maniglia}
            className="flex-1 pt-3 pb-2.5 flex justify-center touch-none cursor-grab active:cursor-grabbing group">
            <span aria-hidden="true" className="w-10 h-1 rounded-full bg-white/20 group-hover:bg-white/35" />
          </button>
        </div>

        <div className="flex items-center gap-3 pb-3">
          <div className="flex-1 min-w-0">
            <p className="text-[17px] font-extrabold tracking-[-.015em] text-white truncate">{titolo}</p>
            {sottotitolo && <p className="mt-[2px] text-[12.5px] font-medium text-muted truncate">{sottotitolo}</p>}
          </div>
          <button type="button" aria-label="Chiudi" onClick={chiudi}
            className={`shrink-0 w-10 h-10 rounded-full ${VETRO} flex items-center justify-center text-gray-200 hover:text-white transition`}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <FoglioMisure misure={misure} attiva={attiva} onAttiva={onAttiva} accento={accento} senzaCarta />
      </div>
    </div>,
    document.body
  )
}
