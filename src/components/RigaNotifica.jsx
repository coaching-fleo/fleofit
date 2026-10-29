import { useRef, useState } from 'react'
import { Check, ChevronsLeft, ChevronsRight, Dot } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import { battito } from '../lib/aptica'

/** Quanto va trascinata una notifica perché cambi stato, nei due sensi. */
export const SOGLIA_LETTA = 80
/** Sotto questo spostamento il dito non ha ancora deciso la direzione. */
const DECISIONE = 8
/** Oltre la soglia la riga segue il dito sempre meno: si sente il fondo. */
const elastico = (dx) => {
  const sx = Math.abs(dx)
  if (sx <= SOGLIA_LETTA) return dx
  return Math.sign(dx) * (SOGLIA_LETTA + (sx - SOGLIA_LETTA) * 0.35)
}

/**
 * RigaNotifica — una voce del centro notifiche (29/10/2026).
 *
 * Una notifica non letta si segna come letta SENZA aprirla, in due modi:
 * - trascinandola verso sinistra oltre `SOGLIA_LETTA`: sotto compare la
 *   fascia gialla «Letta», che si riempie quando la soglia è passata;
 * - col bottone tondo con la spunta, a destra (l'unico modo sul desktop).
 * Il tocco sulla riga resta quello di sempre: segna letta e apre la rotta.
 *
 * Nell'altro senso, una LETTA trascinata a DESTRA torna da leggere (fascia
 * «Da leggere» a sinistra). Sul desktop lo fa il bottone che compare al
 * passaggio del mouse. Ogni riga va in un senso solo, quello che cambia il
 * suo stato: una non letta a destra non si muove, una letta a sinistra nemmeno.
 *
 * ⚠️ `touch-action: pan-y`: lo scorrimento verticale della lista resta al
 * browser, quello orizzontale arriva qui. Senza, il primo spostamento
 * orizzontale farebbe scorrere la pagina invece della riga.
 * ⚠️ Dopo un trascinamento il `click` che il browser manda al dito alzato
 * viene ignorato: altrimenti lo swipe aprirebbe anche la notifica.
 *
 * `accenna`: la riga fa da sola un mezzo swipe e torna, per far vedere che
 * si può fare (`.notifica-accenno` in index.css). Home lo accende sulla prima
 * non letta, una volta per avvio dell'app.
 */
export default function RigaNotifica({ notifica, onApri, onLetta, onDaLeggere, accenna = false }) {
  const [dx, setDx] = useState(0)
  const [trascina, setTrascina] = useState(false)
  // ⚠️ Finito l'accenno la classe va tolta: un'animazione CSS vince sullo
  // `style` in linea, e col suo `both` terrebbe la riga ferma a 0 sotto il dito.
  const [accennoFinito, setAccennoFinito] = useState(false)
  const gesto = useRef(null)
  const mosso = useRef(false)
  const letta = notifica.is_read
  // Il senso in cui la riga si può trascinare: -1 a sinistra, +1 a destra.
  const senso = letta ? 1 : -1
  const oltre = dx * senso >= SOGLIA_LETTA

  const inizio = (e) => {
    if (letta && !onDaLeggere) return
    setAccennoFinito(true)
    const t = e.touches?.[0]
    if (!t) return
    gesto.current = { x: t.clientX, y: t.clientY, direzione: null, oltre: false }
    mosso.current = false
  }
  const movimento = (e) => {
    const g = gesto.current
    const t = e.touches?.[0]
    if (!g || !t) return
    const mx = t.clientX - g.x
    const my = t.clientY - g.y
    if (!g.direzione) {
      if (Math.abs(mx) < DECISIONE && Math.abs(my) < DECISIONE) return
      g.direzione = Math.abs(mx) > Math.abs(my) ? 'orizzontale' : 'verticale'
      if (g.direzione === 'orizzontale') setTrascina(true)
    }
    if (g.direzione !== 'orizzontale') return
    mosso.current = true
    const nuovo = elastico(senso < 0 ? Math.min(0, mx) : Math.max(0, mx))
    const passata = nuovo * senso >= SOGLIA_LETTA
    if (passata !== g.oltre) { g.oltre = passata; battito() }
    setDx(nuovo)
  }
  const fine = () => {
    const g = gesto.current
    gesto.current = null
    setTrascina(false)
    if (g?.direzione === 'orizzontale' && g.oltre) (letta ? onDaLeggere : onLetta)()
    setDx(0)
  }

  return (
    // ⚠️ `shrink-0`: la lista è una colonna flex che scorre, e un figlio con
    // `overflow-hidden` perde l'altezza minima del contenuto. Senza, con tante
    // notifiche il browser schiaccia le righe invece di scorrere, e i testi si
    // accavallano (successo il 29/10/2026 sul telefono).
    <div className="group relative shrink-0 rounded-2xl overflow-hidden">
      {letta && onDaLeggere && (
        <div aria-hidden="true"
          className={`absolute inset-0 flex items-center justify-start pl-4 gap-1 rounded-2xl transition-colors duration-150 ${oltre ? 'bg-brand text-black' : 'bg-brand/15 text-brand'}`}>
          <Dot size={28} strokeWidth={6} className={`transition-transform duration-150 ${oltre ? 'scale-110' : 'scale-90'}`} />
          <span className="text-sm font-bold">Da leggere</span>
        </div>
      )}
      {!letta && (
        <div aria-hidden="true"
          className={`absolute inset-0 flex items-center justify-end pr-5 gap-2 rounded-2xl transition-colors duration-150 ${oltre ? 'bg-brand text-black' : 'bg-brand/15 text-brand'}`}>
          <Check size={20} strokeWidth={3} className={`transition-transform duration-150 ${oltre ? 'scale-110' : 'scale-90'}`} />
          <span className="text-sm font-bold">Letta</span>
        </div>
      )}
      <div
        data-riga-notifica
        onTouchStart={inizio}
        onTouchMove={movimento}
        onTouchEnd={fine}
        onTouchCancel={fine}
        onAnimationEnd={() => setAccennoFinito(true)}
        onClick={() => {
          if (mosso.current) { mosso.current = false; return }
          onApri()
        }}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined, touchAction: 'pan-y' }}
        className={`relative p-4 rounded-2xl cursor-pointer border ${trascina ? '' : 'transition-[transform,border-color] duration-300 ease-out'} ${accenna && !letta && !accennoFinito ? 'notifica-accenno' : ''} ${letta ? 'bg-[#111] border-[#333]' : 'bg-[#2a2a2a] border-brand/30 hover:border-brand'}`}
      >
        <div className={`flex items-start gap-3 ${letta ? 'opacity-70' : ''}`}>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-start gap-2 mb-1">
              <p className={`font-bold text-base ${letta ? 'text-gray-300' : 'text-white'}`}>{notifica.title}</p>
              <p className="text-[11px] text-muted whitespace-nowrap pt-1">{format(parseISO(notifica.created_at), 'd MMM HH:mm', { locale: it })}</p>
            </div>
            <p className={`text-sm leading-snug line-clamp-2 break-words ${letta ? 'text-gray-400' : 'text-gray-200'}`}>{notifica.message}</p>
          </div>
          {!letta && (
            <button type="button" aria-label="Segna come letta" title="Segna come letta"
              onClick={(e) => { e.stopPropagation(); onLetta() }}
              className="shrink-0 -mr-1 -mt-1 w-9 h-9 rounded-full border border-brand/40 bg-brand/10 text-brand flex items-center justify-center hover:bg-brand hover:text-black active:scale-90 transition">
              <Check size={16} strokeWidth={3} />
            </button>
          )}
          {/* Solo per chi ha un mouse: `group-hover` vale dove il passaggio
              esiste, e sul telefono il bottone non c'è e non si tocca per sbaglio. */}
          {letta && onDaLeggere && (
            <button type="button" aria-label="Segna come da leggere" title="Segna come da leggere"
              onClick={(e) => { e.stopPropagation(); onDaLeggere() }}
              className="shrink-0 -mr-1 -mt-1 w-9 h-9 rounded-full border border-[#444] text-gray-400 flex items-center justify-center opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto focus-visible:opacity-100 focus-visible:pointer-events-auto hover:border-brand hover:text-brand transition">
              <Dot size={22} strokeWidth={6} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * La riga d'istruzioni sopra la lista. Dice il gesto che serve adesso: finché
 * c'è qualcosa da leggere quello verso sinistra, poi quello che torna indietro.
 */
export function SuggerimentoSwipe({ desktop, daLeggere }) {
  let testo
  if (desktop) testo = daLeggere
    ? <><Check size={12} strokeWidth={3} className="text-brand" /> Tocca la spunta per segnare una notifica come letta</>
    : null
  else testo = daLeggere
    ? <><ChevronsLeft size={14} className="text-brand" /> Scorri a sinistra una notifica per segnarla come letta</>
    : <><ChevronsRight size={14} className="text-brand" /> Scorri a destra una notifica per rimetterla da leggere</>
  if (!testo) return null
  return <p className="flex items-center gap-1.5 text-[11px] text-muted px-1 pb-1">{testo}</p>
}
