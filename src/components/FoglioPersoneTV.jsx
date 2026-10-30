import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Plus, Trash2, Pencil } from 'lucide-react'
import { aggiungiPersona, personePerEsercizio, MAX_PERSONE } from '../lib/personeTV'
import { vibraScelta } from '../lib/aptica'

// «Chi parte da dove» — il foglio delle persone del telecomando TV (30/10/2026).
//
// Si lavora sugli esercizi, come li vede la TV: si tocca un esercizio e ci
// compare una persona (A, B, C…), si tocca una persona per spostarla, darle un
// nome o toglierla. Il primo disegno (lista di persone con «dal 2°» e −/+) è
// stato scartato dal committente: costringeva a tradurre posizioni in numeri.
// Le modifiche valgono subito, sulla TV: niente «Salva».
export default function FoglioPersoneTV({ persone, esercizi, piuBlocchi, onCambia, onChiudi }) {
  const [sceltaId, setSceltaId] = useState(null)
  const scelta = persone.find(p => p.id === sceltaId) || null
  // Chi sta su quale esercizio PRIMA del via: è il punto di partenza.
  const righe = personePerEsercizio(0, esercizi.length, persone)
  const piene = persone.length >= MAX_PERSONE

  const tocca = (i) => {
    if (scelta) {
      if (scelta.partenza !== i + 1) {
        vibraScelta()
        onCambia(persone.map(p => (p.id === scelta.id ? { ...p, partenza: i + 1 } : p)))
      }
      setSceltaId(null)
      return
    }
    if (piene) return
    vibraScelta()
    const nuove = aggiungiPersona(persone)
    nuove[nuove.length - 1] = { ...nuove[nuove.length - 1], partenza: i + 1 }
    onCambia(nuove)
  }

  const togli = (id) => {
    onCambia(persone.filter(p => p.id !== id))
    setSceltaId(null)
  }

  const guida = scelta
    ? `Tocca l'esercizio dove spostare ${scelta.nome || 'questa persona'}.`
    : persone.length === 0
      ? "Tocca l'esercizio da cui parte ognuno."
      : 'A ogni cambio tutti avanzano di un esercizio.'

  return createPortal(
    <div className="fixed inset-0 z-[260] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/70 velo-in" onClick={onChiudi} />
      <div className="relative bg-[#1e1e1e] border-t border-[#2a2a2a] rounded-t-3xl px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] max-h-[85dvh] overflow-y-auto sheet-in">
        <div className="w-10 h-1 rounded-full bg-[#383838] mx-auto mb-4" aria-hidden="true" />

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-xl font-black tracking-tight text-white">Chi parte da dove</h3>
            <p className="mt-1 text-sm text-muted text-pretty" aria-live="polite">{guida}</p>
          </div>
          <button aria-label="Chiudi" onClick={onChiudi}
            className="shrink-0 w-11 h-11 -mr-1 rounded-full bg-[#2a2a2a] flex items-center justify-center text-gray-300 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <ol className="mt-5 rounded-2xl bg-[#111] border border-[#2a2a2a] overflow-hidden divide-y divide-[#2a2a2a]">
          {esercizi.map((nome, i) => {
            const qui = righe[i] || []
            const colore = qui[0]?.colore
            const destinazione = scelta && scelta.partenza !== i + 1
            return (
              <li key={i} className="relative">
                <button
                  onClick={() => tocca(i)}
                  disabled={!scelta && piene}
                  className="w-full min-h-[60px] flex items-center gap-3.5 pl-4 pr-3 py-2.5 text-left transition-colors duration-300 active:bg-white/[.04] disabled:active:bg-transparent"
                  style={colore ? { background: `${colore}17` } : undefined}>
                  <span aria-hidden="true"
                    className="shrink-0 w-7 h-7 rounded-full bg-[#2a2a2a] flex items-center justify-center text-xs font-bold text-gray-300 tabular-nums">
                    {i + 1}
                  </span>
                  <span className="flex-1 min-w-0 font-bold text-[15px] text-white truncate">{nome || 'Esercizio'}</span>
                  {/* Lo spazio delle persone: vuoto mostra cosa succede toccando. */}
                  {qui.length === 0 && !scelta && !piene && (
                    <span aria-hidden="true" className="shrink-0 w-8 h-8 rounded-full border border-dashed border-[#444] flex items-center justify-center text-muted">
                      <Plus size={14} />
                    </span>
                  )}
                  {destinazione && (
                    <span aria-hidden="true" className="shrink-0 w-8 h-8 rounded-full border-2 border-dashed opacity-70"
                      style={{ borderColor: scelta.colore }} />
                  )}
                </button>
                {/* Le persone stanno sopra il bottone della riga: toccarle le sceglie. */}
                {qui.length > 0 && (
                  <div className={`absolute inset-y-0 flex items-center gap-1.5 ${destinazione ? 'right-[52px]' : 'right-3'}`}>
                    {qui.map(p => {
                      const attiva = p.id === sceltaId
                      return (
                        <button key={p.id}
                          aria-label={attiva ? `Deseleziona ${p.nome}` : `Scegli ${p.nome}`}
                          aria-pressed={attiva}
                          onClick={() => { vibraScelta(); setSceltaId(attiva ? null : p.id) }}
                          className={`min-w-[34px] h-[34px] max-w-[96px] px-2.5 rounded-full text-sm font-black text-black truncate transition-transform duration-200 ${
                            attiva ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-[#111]' : ''} ${scelta && !attiva ? 'opacity-40' : ''}`}
                          style={{ background: p.colore }}>
                          {p.nome || '·'}
                        </button>
                      )
                    })}
                  </div>
                )}
              </li>
            )
          })}
        </ol>

        {piuBlocchi && (
          <p className="mt-2.5 px-1 text-xs text-muted text-pretty">
            Vale per ogni EMOM e ON/OFF del workout: conta la posizione dell'esercizio.
          </p>
        )}

        {scelta ? (
          // La persona scelta: nome e «Togli». Spostarla è toccare un'altra riga.
          <div className="mt-4 flex items-center gap-2.5 rounded-2xl bg-[#111] border p-2 pl-4"
            style={{ borderColor: scelta.colore }}>
            <span aria-hidden="true" className="shrink-0 w-3.5 h-3.5 rounded-full" style={{ background: scelta.colore }} />
            <input
              aria-label="Nome"
              value={scelta.nome}
              maxLength={10}
              placeholder="Nome"
              onChange={e => onCambia(persone.map(p => (p.id === scelta.id ? { ...p, nome: e.target.value } : p)))}
              className="flex-1 min-w-0 bg-transparent text-white font-bold outline-none placeholder:text-muted" />
            <Pencil size={15} aria-hidden="true" className="shrink-0 text-muted" />
            <button onClick={() => togli(scelta.id)}
              className="shrink-0 h-11 px-4 rounded-xl bg-[#2a2a2a] text-red-400 font-semibold text-sm flex items-center gap-1.5 hover:bg-[#333]">
              <Trash2 size={16} /> Togli
            </button>
          </div>
        ) : persone.length > 0 && (
          <div className="mt-3 flex items-center justify-between gap-3 px-1">
            <p className="text-xs text-muted">
              {piene ? `Al massimo ${MAX_PERSONE} persone.` : 'Tocca una persona per spostarla o darle un nome.'}
            </p>
            <button onClick={() => onCambia([])}
              className="shrink-0 h-11 px-2 text-sm font-semibold text-muted hover:text-white">
              Togli tutti
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
