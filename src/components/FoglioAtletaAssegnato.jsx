// FoglioAtletaAssegnato.jsx — un atleta di «Assegnato a», toccato (26/11/2026).
//
// Richiesta del committente: toccando un atleta nella scheda workout il coach
// vuole, senza uscire dalla scheda, leggere la sua nota se l'ha completato,
// ascoltare il vocale, o aprire la sua scheda atleta. Prima il tocco cambiava
// subito la scheda sull'atleta (`?athlete_id=`): resta come seconda azione.
//
// La cornice è la stessa del foglio dei feedback della Home (FoglioListaCoach):
// dal basso sul telefono con useBottomSheet (trascinamento, Esc, pagina sotto
// ferma), a destra sul desktop.
// ⚠️ La X ha aria-label="Chiudi": è ciò che il tasto indietro di Android cerca.
// ⚠️ z-[145]: sopra FoglioAssegnati (140), da cui si può aprire, e sotto il
// CustomConfirm (150).

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, ChevronRight, Check, ThumbsUp, ThumbsDown, Quote, Mic, ArrowRight } from 'lucide-react'
import { format, isValid, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import { useBottomSheet } from '../useBottomSheet'
import { battito } from '../lib/aptica'
import { tonoRpe } from '../lib/riscontroAtleta'
import { Volto } from './CruscottoCoachUI'
import CustomAudioPlayer from './CustomAudioPlayer'

const GRADIMENTO = {
  si: { icona: ThumbsUp, testo: 'Gli è piaciuto', tono: 'text-green-400' },
  no: { icona: ThumbsDown, testo: 'Non gli è piaciuto', tono: 'text-red-400' },
  nessuna: { icona: null, testo: 'Senza parere', tono: 'text-gray-400' },
}

const giorno = (d) => (d && isValid(parseISO(d)) ? format(parseISO(d), 'EEE d MMM', { locale: it }) : null)

function Etichetta({ children }) {
  return <h3 className="text-[12px] font-extrabold tracking-[.08em] uppercase text-gray-500">{children}</h3>
}

/**
 * @param {object} r            da `riscontroAssegnazione` (src/lib/riscontroAtleta.js)
 * @param {boolean} laterale    desktop: pannello a destra invece del foglio dal basso
 * @param {boolean} selezionato la scheda mostra già questo atleta: «Vedi il suo allenamento» non serve
 */
export default function FoglioAtletaAssegnato({ r, laterale = false, selezionato = false, onScheda, onAllenamento, onChiudi }) {
  const { chiudi, maniglia, stileFoglio, stileVelo, classeFoglio, classeVelo } = useBottomSheet(onChiudi)
  useEffect(() => { battito() }, [])

  const quando = giorno(r.data)
  const sotto = r.fatto ? (quando ? `Completato ${quando}` : 'Completato') : (quando ? `In programma ${quando}` : 'Da fare')
  const parere = r.gradimento ? GRADIMENTO[r.gradimento] : null
  const haRiscontro = r.rpe !== null || parere || r.testo

  const posizione = laterale
    ? 'right-0 top-0 bottom-0 w-[440px] max-w-full rounded-l-3xl border-l'
    : 'left-0 right-0 bottom-0 max-h-[88vh] rounded-t-3xl border-t pb-[calc(env(safe-area-inset-bottom)+1rem)]'

  return createPortal(
    <div className="fixed inset-0 z-[145]">
      <div className={`absolute inset-0 bg-black/60 ${classeVelo}`} style={stileVelo} onClick={chiudi} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-label={r.nome}
        className={`absolute ${posizione} bg-gradient-to-b from-[#1b1b1e] to-[#141416] border-white/[.08] flex flex-col
                    shadow-[0_-24px_60px_-12px_rgba(0,0,0,.8),inset_0_1px_0_rgba(255,255,255,.07)] ${laterale ? '' : classeFoglio}`}
        style={laterale ? undefined : stileFoglio}>
        {!laterale && (
          <div {...maniglia} className="pt-2.5 pb-1 flex justify-center cursor-grab" aria-hidden="true">
            <span className="w-10 h-1.5 rounded-full bg-white/[.16]" />
          </div>
        )}

        {/* Testata: il volto e il nome portano alla scheda atleta, come nella Home. */}
        <div className={`px-4 ${laterale ? 'pt-6' : 'pt-2'} flex items-start justify-between gap-3`}>
          <button type="button" onClick={onScheda} aria-label={`Scheda di ${r.nome}`}
            className="min-w-0 flex items-center gap-3 text-left rounded-2xl -m-1 p-1 hover:bg-white/[.04] transition">
            <Volto foto={r.foto} nome={r.nome} />
            <span className="min-w-0">
              <span className="block text-[19px] font-black tracking-[-.02em] text-white truncate">{r.nome}</span>
              <span className="block mt-0.5 text-[13px] font-semibold text-gray-400 truncate">{sotto}</span>
            </span>
          </button>
          <div className="shrink-0 flex items-center gap-2">
            <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 border text-[11px] font-extrabold tracking-[.05em] ${
              r.fatto ? 'bg-green-500/[.13] border-green-500/30 text-green-400' : 'bg-white/[.06] border-white/[.12] text-gray-400'}`}>
              {r.fatto && <Check size={11} strokeWidth={3} aria-hidden="true" />}
              {r.fatto ? 'Fatto' : 'Da fare'}
            </span>
            <button type="button" onClick={chiudi} aria-label="Chiudi"
              className="w-9 h-9 rounded-full bg-white/[.07] shadow-[inset_0_1px_0_rgba(255,255,255,.08)] text-gray-300 flex items-center justify-center hover:text-white">
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="mt-4 px-4 pb-2 flex-1 min-h-0 overflow-y-auto overscroll-contain flex flex-col gap-4">
          {/* La sua nota: RPE, gradimento e le parole dell'atleta. */}
          <section className="flex flex-col gap-2" aria-label="La sua nota">
            <Etichetta>La sua nota</Etichetta>
            {haRiscontro ? (
              <div className="rounded-[18px] p-4 bg-white/[.04] border border-white/[.08] flex flex-col gap-3">
                {(r.rpe !== null || parere) && (
                  <div className="flex items-center gap-4">
                    {r.rpe !== null && (
                      <span className="flex items-baseline gap-1">
                        <span className={`text-[28px] leading-none font-black tabular-nums ${tonoRpe(r.rpe)}`}>{r.rpe}</span>
                        <span className="text-[13px] font-bold text-gray-400">/10 RPE</span>
                      </span>
                    )}
                    {parere && (
                      <span className={`flex items-center gap-1.5 text-[13px] font-bold ${parere.tono}`}>
                        {parere.icona && <parere.icona size={15} aria-hidden="true" />}{parere.testo}
                      </span>
                    )}
                  </div>
                )}
                {r.testo ? (
                  <p className="flex gap-2 text-[15px] leading-relaxed text-gray-200 whitespace-pre-wrap break-words">
                    <Quote size={15} className="shrink-0 mt-1 text-brand" aria-hidden="true" />
                    <span className="min-w-0">{r.testo}</span>
                  </p>
                ) : (
                  <p className="text-[13px] text-gray-500">Nessuna nota scritta.</p>
                )}
              </div>
            ) : (
              <p className="rounded-[18px] px-4 py-3.5 bg-white/[.03] border border-dashed border-white/[.1] text-[13.5px] text-gray-400">
                {r.fatto ? 'Ha completato l\'allenamento senza lasciare una nota.' : 'Non l\'ha ancora completato.'}
              </p>
            )}
          </section>

          {r.vocale && (
            <section className="flex flex-col gap-2" aria-label="Il suo vocale">
              <Etichetta><span className="inline-flex items-center gap-1.5"><Mic size={12} aria-hidden="true" />Vocale</span></Etichetta>
              {/* Niente onDelete: qui si ascolta. Il vocale si elimina dalla scheda dell'atleta. */}
              <CustomAudioPlayer src={r.vocale} />
            </section>
          )}
        </div>

        <div className={`px-4 pt-3 flex flex-col gap-2 ${laterale ? 'pb-6' : ''}`}>
          <button type="button" onClick={onScheda}
            className="h-12 rounded-2xl bg-brand text-black text-[15px] font-black flex items-center justify-center gap-1.5 hover:brightness-110 transition active:scale-[.99]">
            Apri la scheda atleta <ArrowRight size={17} aria-hidden="true" />
          </button>
          {!selezionato && (
            <button type="button" onClick={onAllenamento}
              className="h-11 rounded-2xl bg-white/[.06] border border-white/[.1] text-sm font-bold text-white flex items-center justify-center gap-1.5 hover:bg-white/[.09] transition">
              Vedi il suo allenamento <ChevronRight size={16} className="text-gray-400" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
