// FoglioListaCoach.jsx — la lista dietro ogni numero della Home «Riepilogo» (10/11/2026).
//
// La Home mostra numeri; le persone stanno qui. Dal basso sul telefono
// (useBottomSheet: trascinamento, Esc, pagina sotto ferma), a destra sul
// desktop. Ricerca per nome, filtri a pillola con il conteggio, righe a
// blocchi di BLOCCO_LISTA: con 500 atleti la lista non si disegna tutta.
// La X ha aria-label="Chiudi": è quella che il tasto indietro di Android
// cerca (src/lib/indietroAndroid.js).

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Search, ChevronRight } from 'lucide-react'
import { useBottomSheet } from '../useBottomSheet'
import { battito } from '../lib/aptica'
import { corsia } from '../lib/categorie'
import { filtraPerNome } from '../lib/riepilogoCoach'
import { Volto } from './CruscottoCoachUI'

/** Quante righe si disegnano alla volta. */
export const BLOCCO_LISTA = 60

const TONI_PILLOLA = {
  ok: 'bg-green-500/10 text-green-400 border-green-500/30',
  vivo: 'bg-brand/10 text-brand border-brand/30',
  male: 'bg-red-500 text-white border-red-500',
  neutro: 'bg-white/5 text-gray-300 border-white/10',
}

const atleti = (n) => `${n} ${n === 1 ? 'atleta' : 'atleti'}`

export default function FoglioListaCoach({ titolo, persone = [], filtri = [], filtroIniziale = 0, laterale = false, onScegli, onChiudi }) {
  const { chiudi, maniglia, stileFoglio, stileVelo, classeFoglio, classeVelo } = useBottomSheet(onChiudi)
  const [testo, setTesto] = useState('')
  const [filtro, setFiltro] = useState(filtroIniziale)
  const [quante, setQuante] = useState(BLOCCO_LISTA)

  useEffect(() => { battito() }, [])
  // Un filtro o una ricerca nuovi ripartono dal primo blocco.
  const cerca = (t) => { setTesto(t); setQuante(BLOCCO_LISTA) }
  const filtra = (i) => { setFiltro(i); setQuante(BLOCCO_LISTA) }

  const conti = useMemo(() => filtri.map(f => (f.prova ? persone.filter(f.prova).length : persone.length)), [filtri, persone])
  const visibili = useMemo(() => {
    const prova = filtri[filtro]?.prova
    return filtraPerNome(prova ? persone.filter(prova) : persone, testo)
  }, [persone, filtri, filtro, testo])
  const mostrate = visibili.slice(0, quante)
  const restano = visibili.length - mostrate.length

  const sottotitolo = testo.trim()
    ? `${atleti(visibili.length)} per «${testo.trim()}»`
    : atleti(visibili.length)

  const posizione = laterale
    ? 'right-0 top-0 bottom-0 w-[440px] max-w-full rounded-l-3xl border-l'
    : 'left-0 right-0 bottom-0 max-h-[88vh] rounded-t-3xl border-t pb-[env(safe-area-inset-bottom)]'

  return createPortal(
    <div className="fixed inset-0 z-[100]">
      <div className={`absolute inset-0 bg-black/60 ${classeVelo}`} style={stileVelo} onClick={chiudi} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-label={titolo}
        className={`absolute ${posizione} bg-gradient-to-b from-[#1b1b1e] to-[#141416] border-white/[.08] flex flex-col
                    shadow-[0_-24px_60px_-12px_rgba(0,0,0,.8),inset_0_1px_0_rgba(255,255,255,.07)] ${laterale ? '' : classeFoglio}`}
        style={laterale ? undefined : stileFoglio}>
        {!laterale && (
          <div {...maniglia} className="pt-2.5 pb-1 flex justify-center cursor-grab" aria-hidden="true">
            <span className="w-10 h-1.5 rounded-full bg-white/[.16]" />
          </div>
        )}
        <div className={`px-4 ${laterale ? 'pt-6' : 'pt-2'} flex items-start justify-between gap-3`}>
          <div className="min-w-0">
            <h2 className="text-[19px] font-black tracking-[-.02em] text-white">{titolo}</h2>
            <p className="mt-0.5 text-[13px] font-semibold text-gray-400">{sottotitolo}</p>
          </div>
          <button type="button" onClick={chiudi} aria-label="Chiudi"
            className="shrink-0 w-9 h-9 rounded-full bg-white/[.07] shadow-[inset_0_1px_0_rgba(255,255,255,.08)] text-gray-300 flex items-center justify-center hover:text-white">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <label className="mx-4 mt-3.5 h-11 px-3.5 rounded-[14px] bg-[#0f0f10] border border-white/[.07] shadow-[inset_0_1px_3px_rgba(0,0,0,.6)] flex items-center gap-2.5
                          focus-within:border-brand transition-colors">
          <Search size={17} className="text-gray-500 shrink-0" aria-hidden="true" />
          <input type="search" value={testo} onChange={(e) => cerca(e.target.value)}
            placeholder="Cerca per nome" aria-label="Cerca per nome"
            className="flex-1 min-w-0 bg-transparent text-[15px] text-white placeholder:text-gray-500 outline-none" />
        </label>

        {filtri.length > 1 && (
          <div className="mt-3 px-4 flex gap-2 overflow-x-auto hide-scrollbar">
            {filtri.map((f, i) => (
              <button key={f.etichetta} type="button" onClick={() => filtra(i)} aria-pressed={filtro === i}
                className={`shrink-0 h-8 px-3 rounded-full text-[13px] font-bold border transition ${
                  filtro === i ? 'bg-white text-black border-white shadow-[0_6px_14px_-6px_rgba(255,255,255,.35)]' : 'bg-white/[.04] text-gray-300 border-white/[.08]'}`}>
                {f.etichetta}{conti[i] > 0 && <> <span className={filtro === i ? 'text-black/60' : 'text-gray-500'}>{conti[i]}</span></>}
              </button>
            ))}
          </div>
        )}

        <ul className="mt-2 px-2 pb-4 flex-1 overflow-y-auto">
          {mostrate.map(p => {
            const c = p.categoria ? corsia(p.categoria) : null
            return (
              <li key={p.chiave}>
                <button type="button" onClick={() => onScegli?.(p)}
                  className="w-full px-2 py-2.5 rounded-2xl flex items-center gap-3 text-left transition hover:bg-white/[.04] active:scale-[.99]">
                  <span className={`w-1 self-stretch rounded-full ${c ? c.dot : 'bg-transparent'}`} aria-hidden="true" />
                  <Volto foto={p.foto} nome={p.nome} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[15px] font-bold text-white truncate">{p.nome}</span>
                    {p.sotto && <span className="block text-[13px] text-gray-400 truncate">{p.sotto}</span>}
                  </span>
                  {p.pillola
                    ? <span className={`shrink-0 px-2.5 py-1 rounded-full border text-xs font-bold ${TONI_PILLOLA[p.pillola.tono] || TONI_PILLOLA.neutro}`}>{p.pillola.testo}</span>
                    : <ChevronRight size={18} className="shrink-0 text-gray-500" aria-hidden="true" />}
                </button>
              </li>
            )
          })}
          {visibili.length === 0 && (
            <li className="px-3 py-8 text-center text-sm text-gray-400">
              {testo.trim() ? 'Nessuno con questo nome.' : 'Nessuno qui.'}
            </li>
          )}
          {restano > 0 && (
            <li className="px-2 pt-2">
              <button type="button" onClick={() => setQuante(q => q + BLOCCO_LISTA)}
                className="w-full h-11 rounded-xl bg-[#1e1e1e] border border-[#2a2a2a] text-sm font-bold text-gray-200 hover:text-white">
                Mostra altri {Math.min(BLOCCO_LISTA, restano)} di {restano}
              </button>
            </li>
          )}
        </ul>
      </div>
    </div>,
    document.body,
  )
}
