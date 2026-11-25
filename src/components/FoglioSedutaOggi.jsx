// FoglioSedutaOggi.jsx — lo sguardo veloce su una seduta di oggi (25/11/2026).
//
// Dalla fila «In allenamento oggi» della Home coach, e dalla sua lista «Tutti»:
// chi è, come sta oggi, cosa c'è nell'allenamento (src/lib/anteprimaSeduta.js),
// e se l'ha già fatto RPE e nota. Due destinazioni: la testata (la foto) porta
// alla scheda atleta, il bottone in fondo alla scheda allenamento. Tornando
// indietro la Home lo riapre dov'era (useRiepilogoCoach).
//
// Il ridisegno (25/11/2026, «troppo spoglio, poco d'impatto»): il foglio usa le
// mosse forti che la Home già possiede, invece di righe grigie — la FOTO a tutta
// larghezza delle card di «In allenamento oggi», i NUMERI grandi, il COLORE
// DELLA CORSIA (puntini, tacche dell'intensità, bottone col suo glow di stato).
// Senza foto, le iniziali enormi in filigrana su un velo del colore della corsia.
//
// Telefono: foglio dal basso (useBottomSheet: trascinamento, Esc).
// Desktop: una finestra al centro. X con aria-label="Chiudi" per il tasto
// indietro di Android.

import { useEffect, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, ChevronRight, ArrowRight, Quote } from 'lucide-react'
import { useBottomSheet } from '../useBottomSheet'
import { battito } from '../lib/aptica'
import { corsia } from '../lib/categorie'
import { coloreCategoria, conVelo } from '../lib/colori'
import { separaCodice } from '../lib/codiceWorkout'
import TestataFoto from './TestataFoto'
import { NumeriSeduta, SequenzaSeduta } from './SedutaUI'
import { BOTTONE_SU_FOTO, PILLOLA_SU_FOTO } from '../lib/testataFoto'
import { DOMANDE, TONI_RISPOSTA, parolaRisposta, punteggio, fasciaComeStai } from '../lib/comeStai'

/** Quante righe del riassunto si mostrano prima del «+N». */
const RIGHE_MAX = 6

const STATO = (s) => (
  s.allarme ? ['bg-red-500 text-white', 'Sta male']
    : s.stato === 'in corso' ? ['bg-white text-black', 'In corso']
      : s.stato === 'completato' ? ['bg-green-500 text-black', 'Fatto']
        : ['bg-black/55 text-white backdrop-blur', 'Da fare']
)
/** Il colore della fascia di «Come sta», dalla stessa scala delle risposte. */
const TONO_FASCIA = { bene: 'text-green-400', cosi: 'text-brand', male: 'text-red-400' }


/** La testata: la foto (TestataFoto), il nome grande, «Scheda». Tutta la testata apre la scheda atleta. */
function Testata({ s, colore, onAtleta, desktop }) {
  const c = corsia(s.categoria)
  const [tonoStato, testoStato] = STATO(s)
  return (
    <TestataFoto foto={s.foto} nome={s.nomeIntero} colore={colore} classe={desktop ? 'h-[236px]' : 'h-[252px]'}
      onClick={onAtleta} etichettaClick={`Scheda di ${s.nomeIntero}`}
      sopraSinistra={<span className={`px-2.5 py-1 rounded-full text-xs font-extrabold ${tonoStato}`}>{testoStato}</span>}
      etichetta={
        <span className="flex items-center gap-1.5 text-[13px] font-extrabold text-white/85">
          <i className={`w-2 h-2 rounded-full ${c.dot}`} style={{ boxShadow: `0 0 8px ${conVelo(colore, 0.6)}` }} aria-hidden="true" />{c.etichetta}
        </span>
      }
      titolo={<b className="mt-1 block text-[30px] leading-[1.05] font-black tracking-[-.03em] text-white break-words [text-wrap:balance]">{s.nomeIntero}</b>}
      azione={<span className={`${PILLOLA_SU_FOTO} pr-2.5`}>Scheda <ChevronRight size={16} aria-hidden="true" /></span>} />
  )
}

/** Le quattro risposte di oggi, ognuna con le sue cinque tacche nella scala rosso → verde. */
function ComeSta({ riga }) {
  const fascia = fasciaComeStai(punteggio(riga))
  return (
    <section aria-label="Come sta oggi">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[15px] font-black tracking-[-.01em] text-white">Come sta oggi</h3>
        {fascia && <span className={`text-[13px] font-extrabold ${TONO_FASCIA[fascia.chiave]}`}>{fascia.etichetta}</span>}
      </div>
      <div className="mt-2.5 flex flex-col gap-2">
        {DOMANDE.map(d => {
          const v = riga[d.chiave]
          const parola = parolaRisposta(d, v)
          const tono = parola ? TONI_RISPOSTA[v - 1].sfondo : ''
          return (
            <div key={d.chiave} className="grid grid-cols-[96px_1fr_88px] items-center gap-3">
              <span className="text-[13px] font-semibold text-gray-300 truncate">{d.titolo === 'Dolori muscolari' ? 'Dolori' : d.titolo}</span>
              <span className="flex gap-[3px]" aria-hidden="true">
                {[1, 2, 3, 4, 5].map(n => <i key={n} className={`h-2 flex-1 rounded-full ${parola && n <= v ? tono : 'bg-white/[.08]'}`} />)}
              </span>
              <span className="text-[13px] font-extrabold text-white text-right truncate">{parola || '—'}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function Corpo({ s, colore, onAllenamento }) {
  const c = corsia(s.categoria)
  const { nome: titolo } = separaCodice(s.titolo)
  const righe = s.anteprima?.righe || []
  return (
    <div className="px-5 pt-1 pb-5 flex flex-col gap-6">
      <NumeriSeduta minuti={s.anteprima?.minuti} intensita={s.intensita} rpe={s.rpe} colore={colore} />
      {s.comeSta && <ComeSta riga={s.comeSta} />}

      <section aria-label="L'allenamento" className="flex flex-col gap-3.5">
        <h3 className="text-[20px] leading-tight font-black tracking-[-.02em] text-white [text-wrap:balance]">{titolo}</h3>
        {righe.length > 0 && <SequenzaSeduta righe={righe} colore={colore} massimo={RIGHE_MAX} />}
        {s.stato === 'completato' && s.nota && (
          <figure className="rounded-2xl bg-[#111] border border-white/[.06] p-4 flex gap-3">
            <Quote size={18} className={`shrink-0 mt-0.5 ${c.txt}`} aria-hidden="true" />
            <blockquote className="text-[15px] leading-snug text-gray-200 line-clamp-5">{s.nota}</blockquote>
          </figure>
        )}
      </section>

      <button type="button" onClick={onAllenamento}
        className={`h-14 rounded-2xl ${c.bg} ${c.testoSuBg} text-[16px] font-black tracking-[-.01em] flex items-center justify-center gap-2
                    transition hover:brightness-110 active:scale-[.98]`}
        style={{ boxShadow: `0 14px 28px -12px ${conVelo(colore, 0.55)}` }}>
        Apri allenamento <ArrowRight size={18} aria-hidden="true" />
      </button>
    </div>
  )
}

function Chiudi({ onClick }) {
  return (
    <button type="button" onClick={onClick} aria-label="Chiudi"
      className={`absolute top-3 right-3 z-10 ${BOTTONE_SU_FOTO}`}>
      <X size={19} aria-hidden="true" />
    </button>
  )
}

export default function FoglioSedutaOggi({ seduta, laterale = false, ripreso = null, onAtleta, onAllenamento, onChiudi }) {
  const { chiudi, maniglia, stileFoglio, stileVelo, classeFoglio, classeVelo } = useBottomSheet(onChiudi)
  const corpo = useRef(null)
  useEffect(() => { if (ripreso == null) battito() }, [ripreso])
  // Al ritorno (indietro) il corpo riparte da dov'era.
  useLayoutEffect(() => {
    if (ripreso && corpo.current) corpo.current.scrollTop = ripreso.top || 0
  }, [ripreso])
  const annota = () => ({ top: corpo.current?.scrollTop || 0 })
  const colore = coloreCategoria(seduta.categoria)
  const contenuto = (<>
    <Testata s={seduta} colore={colore} desktop={laterale} onAtleta={() => onAtleta(annota())} />
    <Corpo s={seduta} colore={colore} onAllenamento={() => onAllenamento(annota())} />
  </>)
  const pelle = 'bg-[#18181b] border-white/[.08] overflow-hidden flex flex-col'

  if (laterale) return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-8">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px] velo-in" onClick={chiudi} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-label={`Oggi: ${seduta.nomeIntero}`}
        className={`modal-transition relative w-full max-w-[440px] max-h-[88vh] rounded-[28px] border ${pelle}
                    shadow-[0_40px_90px_-20px_rgba(0,0,0,.95),inset_0_1px_0_rgba(255,255,255,.07)]`}>
        <Chiudi onClick={chiudi} />
        <div ref={corpo} data-corpo-seduta className="overflow-y-auto hide-scrollbar">{contenuto}</div>
      </div>
    </div>,
    document.body,
  )

  return createPortal(
    <div className="fixed inset-0 z-[100]">
      <div className={`absolute inset-0 bg-black/60 ${classeVelo}`} style={stileVelo} onClick={chiudi} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-label={`Oggi: ${seduta.nomeIntero}`}
        className={`absolute left-0 right-0 bottom-0 max-h-[90vh] rounded-t-3xl border-t pb-[env(safe-area-inset-bottom)] ${pelle}
                    shadow-[0_-24px_60px_-12px_rgba(0,0,0,.8)] ${classeFoglio}`}
        style={stileFoglio}>
        {/* La maniglia sta sopra la foto: è lei che si trascina per chiudere. */}
        <div {...maniglia} className="absolute top-0 inset-x-0 z-10 h-7 flex justify-center pt-2.5 cursor-grab" aria-hidden="true">
          <span className="w-10 h-1.5 rounded-full bg-white/50 shadow-[0_1px_4px_rgba(0,0,0,.5)]" />
        </div>
        <Chiudi onClick={chiudi} />
        <div ref={corpo} data-corpo-seduta className="overflow-y-auto hide-scrollbar">{contenuto}</div>
      </div>
    </div>,
    document.body,
  )
}
