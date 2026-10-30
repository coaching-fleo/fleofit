import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Plus, Trash2, ChevronRight, ChevronLeft, Check, Pencil } from 'lucide-react'
import { aggiungiPersona, COLORI_PERSONE, MAX_PERSONE } from '../lib/personeTV'
import { vibraScelta } from '../lib/aptica'

// Il foglio delle persone del telecomando TV (30/10/2026).
//
// Due passi, nell'ordine in cui li pensa il coach (sua richiesta, dopo due disegni
// scartati): PRIMA le persone — si aggiungono, si chiamano, si colorano — POI,
// toccando una persona, l'esercizio da cui parte. Scartati: la lista con «dal 2°»
// e −/+ (numeri al posto degli esercizi) e «tocca l'esercizio per metterci una
// persona» (partiva dagli esercizi invece che dalle persone). Non tornarci.
// Ogni modifica vale subito, sulla TV: niente «Salva».
export default function FoglioPersoneTV({ persone, esercizi, piuBlocchi, onCambia, onChiudi }) {
  const [apertaId, setApertaId] = useState(null)
  const aperta = persone.find(p => p.id === apertaId) || null
  const piene = persone.length >= MAX_PERSONE

  const cambia = (id, campi) => onCambia(persone.map(p => (p.id === id ? { ...p, ...campi } : p)))

  // Una persona nuova parte dal primo esercizio ancora libero, e si apre subito:
  // è lì che le si dà il nome e la partenza.
  const aggiungi = () => {
    if (piene) return
    vibraScelta()
    const libero = esercizi.findIndex((_, i) => !persone.some(p => p.partenza === i + 1))
    const nuove = aggiungiPersona(persone)
    const nuova = { ...nuove[nuove.length - 1], partenza: libero >= 0 ? libero + 1 : 1 }
    onCambia([...persone, nuova])
    setApertaId(nuova.id)
  }

  const togli = (id) => {
    onCambia(persone.filter(p => p.id !== id))
    setApertaId(null)
  }

  const nomeEsercizio = (partenza) => esercizi[(partenza - 1) % esercizi.length] || 'Esercizio'

  return createPortal(
    <div className="fixed inset-0 z-[260] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/70 velo-in" onClick={onChiudi} />
      <div className="relative bg-[#1e1e1e] border-t border-[#2a2a2a] rounded-t-3xl px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] max-h-[85dvh] overflow-y-auto sheet-in">
        <div className="w-10 h-1 rounded-full bg-[#383838] mx-auto mb-4" aria-hidden="true" />

        {aperta ? (
          <SchedaPersona
            persona={aperta}
            persone={persone}
            esercizi={esercizi}
            piuBlocchi={piuBlocchi}
            onCambia={campi => cambia(aperta.id, campi)}
            onTogli={() => togli(aperta.id)}
            onIndietro={() => setApertaId(null)}
            onChiudi={onChiudi} />
        ) : (
          <>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="text-xl font-black tracking-tight text-white">Persone sulla TV</h3>
                <p className="mt-1 text-sm text-muted text-pretty">
                  {persone.length === 0
                    ? 'Aggiungi chi si allena insieme. Ognuno ha il suo colore sulla TV.'
                    : 'Tocca una persona per cambiarla o scegliere da dove parte.'}
                </p>
              </div>
              <button aria-label="Chiudi" onClick={onChiudi}
                className="shrink-0 w-11 h-11 -mr-1 rounded-full bg-[#2a2a2a] flex items-center justify-center text-gray-300 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <ul className="mt-5 rounded-2xl bg-[#111] border border-[#2a2a2a] overflow-hidden divide-y divide-[#2a2a2a]">
              {persone.map(p => (
                <li key={p.id}>
                  <button onClick={() => setApertaId(p.id)}
                    className="w-full min-h-[64px] flex items-center gap-3.5 pl-3.5 pr-3 py-2.5 text-left active:bg-white/[.04]">
                    <span aria-hidden="true"
                      className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-black font-black text-base"
                      style={{ background: p.colore }}>
                      {(p.nome || '·').slice(0, 1).toUpperCase()}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-bold text-[15px] text-white truncate">{p.nome || 'Senza nome'}</span>
                      <span className="block text-[13px] text-muted truncate">Parte da {nomeEsercizio(p.partenza)}</span>
                    </span>
                    <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden="true" />
                  </button>
                </li>
              ))}
              <li>
                <button onClick={aggiungi} disabled={piene}
                  className="w-full min-h-[60px] flex items-center gap-3.5 pl-3.5 pr-3 py-2.5 text-left text-white font-bold text-[15px] active:bg-white/[.04] disabled:opacity-40">
                  <span aria-hidden="true" className="shrink-0 w-10 h-10 rounded-full border border-dashed border-[#444] flex items-center justify-center text-gray-300">
                    <Plus size={18} />
                  </span>
                  {piene ? `Al massimo ${MAX_PERSONE} persone` : 'Aggiungi persona'}
                </button>
              </li>
            </ul>

            {persone.length > 1 && (
              <div className="mt-2 flex justify-end">
                <button onClick={() => onCambia([])}
                  className="h-11 px-2 text-sm font-semibold text-muted hover:text-white">
                  Togli tutti
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>,
    document.body
  )
}

/** Il secondo passo: nome, colore e l'esercizio da cui parte una persona. */
function SchedaPersona({ persona, persone, esercizi, piuBlocchi, onCambia, onTogli, onIndietro, onChiudi }) {
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <button onClick={onIndietro}
          className="h-11 -ml-2 pl-1 pr-3 rounded-full flex items-center gap-0.5 text-[15px] font-semibold text-gray-300 hover:text-white">
          <ChevronLeft size={22} aria-hidden="true" /> Indietro
        </button>
        <button aria-label="Chiudi" onClick={onChiudi}
          className="shrink-0 w-11 h-11 -mr-1 rounded-full bg-[#2a2a2a] flex items-center justify-center text-gray-300 hover:text-white">
          <X size={20} />
        </button>
      </div>

      {/* Nome e colore: la persona come la vedrà la TV. */}
      <div className="mt-3 flex items-center gap-3.5 rounded-2xl bg-[#111] border p-3 transition-colors duration-300"
        style={{ borderColor: persona.colore }}>
        <span aria-hidden="true"
          className="shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-black font-black text-lg transition-colors duration-300"
          style={{ background: persona.colore }}>
          {(persona.nome || '·').slice(0, 1).toUpperCase()}
        </span>
        <input
          aria-label="Nome"
          value={persona.nome}
          maxLength={10}
          placeholder="Nome"
          onChange={e => onCambia({ nome: e.target.value })}
          className="flex-1 min-w-0 bg-transparent text-white text-lg font-black tracking-tight outline-none placeholder:text-muted" />
        <Pencil size={16} aria-hidden="true" className="shrink-0 mr-1 text-muted" />
      </div>

      <div className="mt-3 grid grid-cols-8 gap-1.5" role="radiogroup" aria-label="Colore">
        {COLORI_PERSONE.map(c => {
          const mio = c === persona.colore
          const preso = !mio && persone.some(p => p.colore === c)
          return (
            <button key={c} role="radio" aria-checked={mio} aria-label={preso ? 'Colore già usato' : 'Colore'}
              disabled={preso}
              onClick={() => { if (!mio) { vibraScelta(); onCambia({ colore: c }) } }}
              className={`w-full aspect-square max-w-[40px] mx-auto rounded-full flex items-center justify-center transition-transform duration-200 disabled:opacity-20 ${
                mio ? 'ring-2 ring-white ring-offset-[3px] ring-offset-[#1e1e1e]' : ''}`}
              style={{ background: c }}>
              {mio && <Check size={18} strokeWidth={3} className="text-black" aria-hidden="true" />}
            </button>
          )
        })}
      </div>

      {/* Da dove parte: un esercizio solo, scelto per nome. */}
      <p className="mt-6 mb-2 px-1 text-sm font-bold text-white">Parte da</p>
      <ul role="radiogroup" aria-label="Parte da"
        className="rounded-2xl bg-[#111] border border-[#2a2a2a] overflow-hidden divide-y divide-[#2a2a2a]">
        {esercizi.map((nome, i) => {
          const scelto = persona.partenza === i + 1
          const altri = persone.filter(p => p.id !== persona.id && p.partenza === i + 1)
          return (
            <li key={i}>
              <button role="radio" aria-checked={scelto}
                onClick={() => { if (!scelto) { vibraScelta(); onCambia({ partenza: i + 1 }) } }}
                className="w-full min-h-[56px] flex items-center gap-3.5 pl-4 pr-3.5 py-2.5 text-left active:bg-white/[.04] transition-colors duration-300"
                style={scelto ? { background: `${persona.colore}1a` } : undefined}>
                <span aria-hidden="true"
                  className="shrink-0 w-7 h-7 rounded-full bg-[#2a2a2a] flex items-center justify-center text-xs font-bold text-gray-300 tabular-nums">
                  {i + 1}
                </span>
                <span className="flex-1 min-w-0 font-bold text-[15px] text-white truncate">{nome || 'Esercizio'}</span>
                {/* Chi altro parte da qui: si vede subito se due finiscono insieme. */}
                {altri.length > 0 && (
                  <span className="shrink-0 flex items-center -space-x-1.5" aria-label={`Ci parte anche ${altri.map(a => a.nome).join(', ')}`}>
                    {altri.map(a => (
                      <span key={a.id} className="w-6 h-6 rounded-full ring-2 ring-[#111] flex items-center justify-center text-[11px] font-black text-black"
                        style={{ background: a.colore }}>
                        {(a.nome || '·').slice(0, 1).toUpperCase()}
                      </span>
                    ))}
                  </span>
                )}
                <span aria-hidden="true"
                  className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-colors duration-200 ${scelto ? '' : 'border-2 border-[#444]'}`}
                  style={scelto ? { background: persona.colore } : undefined}>
                  {scelto && <Check size={14} strokeWidth={3} className="text-black" />}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      {piuBlocchi && (
        <p className="mt-2.5 px-1 text-xs text-muted text-pretty">
          Vale per ogni EMOM e ON/OFF del workout: conta la posizione dell'esercizio.
        </p>
      )}

      {/* «Fatto» conferma e torna all'elenco (le modifiche sono già sulla TV):
          senza, per chiudere una persona appena creata bisognava cercare «Indietro». */}
      <div className="mt-5 flex gap-2.5">
        <button onClick={onTogli} aria-label={`Togli ${persona.nome || 'questa persona'}`}
          className="shrink-0 h-12 px-4 rounded-xl bg-[#2a2a2a] text-red-400 font-semibold flex items-center justify-center gap-2 hover:bg-[#333]">
          <Trash2 size={17} aria-hidden="true" /> Togli
        </button>
        <button onClick={onIndietro}
          className="flex-1 h-12 rounded-xl bg-brand text-black font-bold hover:brightness-110">
          Fatto
        </button>
      </div>
    </>
  )
}
