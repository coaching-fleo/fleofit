// SchedaGymUI.jsx — la scheda da palestra nella pagina del workout (13/10/2026).
//
// Il coach la legge; l'atleta la usa in sala: spunta le serie una per una e,
// a ogni spunta, parte il recupero del gruppo (scelta del committente: «vedere
// la scheda + timer di recupero»). È il gesto dei diari da palestra (Hevy,
// Strong): il timer non si avvia a mano fra una serie e l'altra, lo avvia la
// serie appena chiusa.
//
// ⚠️ Le spunte vivono SOLO nella pagina: niente database (lo schema è
// congelato, CLAUDE.md §0) e niente localStorage. Servono a tenere il conto
// durante la seduta, non sono un registro: il completamento resta quello di
// sempre, con RPE e note.
// ⚠️ Il timer conta sull'ORA, non sui tick: con il telefono in tasca o
// l'app in background gli intervalli rallentano, l'orologio no.

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Timer as IconaTimer, X, Plus, Minus } from 'lucide-react'
import { CARD, LABEL, VETRO } from '../lib/stiliCard'
import { vibraScelta, vibraRichiamo } from '../lib/aptica'
import { voceGym } from '../lib/eserciziGym'
import {
  FASI_GYM, faseDi, etichetteGym, tipoGruppo, conDettaglio, serieDi, riassuntoEsercizio,
  riassuntoGruppo, testoTempo, secondiGym, quantoEsercizio, testoCarico, tipoSerie, NOME_TIPO_GRUPPO,
} from '../lib/gym'

const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

/** Che cosa dice la pillola di una serie: «10 × 60 kg», «R 12 × 40 kg», «Giro 2». */
const testoSerie = (gruppo, i) => {
  if (tipoGruppo(gruppo) !== 'singolo') return `Giro ${i + 1}`
  const ex = gruppo.esercizi[0]
  if (conDettaglio(gruppo)) {
    const r = ex.dettaglio[i]
    const sigla = tipoSerie(r.tipo).sigla
    const quanto = [r.reps && String(r.reps).replace('-', '–'), testoCarico(r.kg)].filter(Boolean).join(' × ')
    return [sigla, quanto || `Serie ${i + 1}`].filter(Boolean).join(' ')
  }
  const quanto = [quantoEsercizio(ex), testoCarico(ex.kg)].filter(Boolean).join(' × ')
  return quanto || `Serie ${i + 1}`
}

function Lettera({ testo }) {
  return (
    <span aria-hidden="true"
      className="shrink-0 min-w-7 h-7 px-1.5 rounded-full bg-gym/[.13] border border-gym/30 flex items-center justify-center
                 text-[11.5px] font-extrabold text-gym tabular-nums">
      {testo}
    </span>
  )
}

function RigaEsercizio({ lettera, ex, gruppo, conRecupero }) {
  const rec = conRecupero ? testoTempo(gruppo.recupero) : ''
  const muscolo = voceGym(ex.name).muscolo
  return (
    <div className="flex items-start gap-2.5">
      <Lettera testo={lettera} />
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-extrabold tracking-[-.01em] text-white leading-snug">{ex.name}</p>
        <p className="mt-[2px] text-[12.5px] font-semibold text-gray-300">
          {[riassuntoEsercizio(gruppo, ex), rec && `rec ${rec}`].filter(Boolean).join(' · ')}
        </p>
        {muscolo && muscolo !== 'Cardio' && muscolo !== 'Mobilità' && (
          <p className="mt-[2px] text-[11.5px] font-bold text-[#5b6070]">{muscolo}</p>
        )}
        {ex.notes && <p className="mt-1 text-[12.5px] leading-snug text-gray-400 whitespace-pre-wrap">{ex.notes}</p>}
      </div>
    </div>
  )
}

/**
 * @param {object} p
 * @param {object[]} p.gruppi       `sections.gym`
 * @param {boolean}  p.interattiva  l'atleta che la sta facendo: spunte e timer
 */
export default function SchedaGymUI({ gruppi = [], interattiva = false }) {
  const etichette = useMemo(() => etichetteGym(gruppi), [gruppi])
  const [fatte, setFatte] = useState(() => new Set())
  // { secondi, n }: `n` cambia a ogni avvio, così il timer riparte da capo
  // anche con lo stesso recupero di prima (è la sua `key`).
  const [recupero, setRecupero] = useState(null)

  const avviaRecupero = (secondi) => {
    if (!secondi) return
    setRecupero(prev => ({ secondi, n: (prev?.n || 0) + 1 }))
  }

  const spunta = (gruppo, i) => {
    const chiave = `${gruppo.id}:${i}`
    const gia = fatte.has(chiave)
    setFatte(prev => {
      const n = new Set(prev)
      if (gia) n.delete(chiave)
      else n.add(chiave)
      return n
    })
    vibraScelta()
    // Il recupero parte solo chiudendo una serie, non togliendo una spunta, e
    // non dopo l'ultima serie del gruppo: lì si cambia esercizio.
    if (!gia && i < serieDi(gruppo) - 1) avviaRecupero(secondiGym(gruppo.recupero))
  }

  if (!gruppi.length) {
    return <div className={`${CARD} px-4 py-[15px] text-[13.5px] text-gray-400`}>Nessun esercizio in questa scheda.</div>
  }

  return (
    <div className="flex flex-col gap-[18px]" data-scheda-gym>
      {FASI_GYM.map(f => {
        const della = gruppi.filter(g => faseDi(g) === f.id)
        if (!della.length) return null
        return (
          <section key={f.id} className="flex flex-col gap-[9px]" aria-label={f.nome}>
            <h2 className={`${f.id === 'principale' ? LABEL.replace('text-muted', 'text-gym') : LABEL} px-1`}>{f.nome}</h2>
            {della.map(g => {
              const multi = g.esercizi.length > 1
              const lettere = etichette.get(g.id) || []
              const n = serieDi(g)
              const rec = secondiGym(g.recupero)
              return (
                <div key={g.id} data-gruppo-scheda={g.id}
                  className={`${CARD} relative overflow-hidden pl-4 pr-3.5 py-3.5 flex flex-col gap-3`}>
                  <span aria-hidden="true" className="absolute left-0 inset-y-0 bg-gym"
                    style={{ width: f.id === 'principale' ? 4 : 3, opacity: f.id === 'principale' ? 1 : 0.5 }} />

                  {multi && (
                    <div>
                      <p className="text-[13px] font-extrabold uppercase tracking-[.06em] text-gym">{NOME_TIPO_GRUPPO[tipoGruppo(g)]}</p>
                      <p className="text-[12px] font-bold text-muted">
                        {riassuntoGruppo(g).split(' · ').slice(1).join(' · ')} · senza pausa fra gli esercizi
                      </p>
                    </div>
                  )}

                  {g.esercizi.map((ex, j) => (
                    <RigaEsercizio key={ex.id || j} lettera={lettere[j]} ex={ex} gruppo={g} conRecupero={!multi} />
                  ))}

                  {g.note && <p className="text-[12.5px] leading-snug text-gray-400 whitespace-pre-wrap">{g.note}</p>}

                  {/* Le serie: pillole da spuntare per l'atleta; per il coach
                      compaiono solo se le serie sono diverse fra loro, dove
                      dicono qualcosa che il riassunto non dice. */}
                  {(interattiva || conDettaglio(g)) && n > 0 && (
                    <div className="flex flex-wrap gap-2" role={interattiva ? 'group' : undefined}
                      aria-label={interattiva ? `Serie di ${g.esercizi.map(e => e.name).join(' + ')}` : undefined}>
                      {Array.from({ length: n }, (_, i) => {
                        const fatta = fatte.has(`${g.id}:${i}`)
                        const testo = testoSerie(g, i)
                        if (!interattiva) {
                          return (
                            <span key={i} className={`min-h-9 px-3 rounded-full ${VETRO} text-[12.5px] font-bold text-gray-200 inline-flex items-center`}>
                              {testo}
                            </span>
                          )
                        }
                        return (
                          <button key={i} type="button" aria-pressed={fatta}
                            aria-label={`${multi ? '' : `Serie ${i + 1}: `}${testo}${fatta ? ', fatta' : ''}`}
                            onClick={() => spunta(g, i)}
                            className={`min-h-10 px-3.5 rounded-full text-[13px] font-extrabold inline-flex items-center gap-1.5 border transition active:scale-95
                              ${fatta ? 'bg-gym text-black border-gym' : 'bg-white/[.06] border-white/[.12] text-white hover:border-gym/50'}`}>
                            {fatta && <Check size={14} strokeWidth={3} aria-hidden="true" />}
                            {testo}
                          </button>
                        )
                      })}
                      {interattiva && rec > 0 && (
                        <button type="button" onClick={() => { vibraScelta(); avviaRecupero(rec) }}
                          aria-label={`Avvia il recupero di ${testoTempo(g.recupero)}`}
                          className="min-h-10 px-3 rounded-full text-[12.5px] font-extrabold inline-flex items-center gap-1.5 text-gym hover:bg-gym/10">
                          <IconaTimer size={14} aria-hidden="true" /> {testoTempo(g.recupero)}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </section>
        )
      })}

      {recupero && <TimerRecupero key={recupero.n} secondi={recupero.secondi} onFine={() => setRecupero(null)} />}
    </div>
  )
}

// ── Il timer di recupero ─────────────────────────────────────────────────

/**
 * La capsula in alto, sopra la scheda. In alto e non in basso perché in basso
 * c'è già la barra delle azioni («Segna come completato»), e due cose
 * ancorate al fondo si coprono a vicenda.
 */
function TimerRecupero({ secondi, onFine }) {
  const [ora, setOra] = useState(() => Date.now())
  const [recupero, setRecuperoLocale] = useState(() => ({ fine: Date.now() + secondi * 1000, totale: secondi }))
  const restanti = Math.max(0, Math.ceil((recupero.fine - ora) / 1000))

  useEffect(() => {
    const id = setInterval(() => setOra(Date.now()), 250)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (restanti > 0) return undefined
    vibraRichiamo()
    const id = setTimeout(onFine, 1500)
    return () => clearTimeout(id)
  }, [restanti, onFine])

  const sposta = (s) => {
    vibraScelta()
    setRecuperoLocale(r => ({ fine: Math.max(ora + 1000, r.fine + s * 1000), totale: Math.max(r.totale + s, 1) }))
  }
  const pieno = Math.min(1, Math.max(0, restanti / recupero.totale))

  return createPortal(
    <div role="timer" aria-live="polite" aria-label={restanti > 0 ? `Recupero: ${mmss(restanti)}` : 'Recupero finito'}
      className="fixed left-4 right-4 top-[calc(env(safe-area-inset-top)+.5rem)] z-[55] mx-auto max-w-md
                 rounded-[22px] bg-[#16231f]/95 backdrop-blur-xl border border-gym/40
                 shadow-[0_18px_40px_-12px_rgba(0,0,0,.9)] overflow-hidden velo-in" data-timer-recupero>
      <div className="px-4 py-3 flex items-center gap-3">
        <IconaTimer size={20} className="text-gym shrink-0" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[.1em] text-gym">{restanti > 0 ? 'Recupero' : 'Si riparte'}</p>
          <p className="text-[28px] font-black leading-none tracking-[-.02em] text-white tabular-nums">{mmss(restanti)}</p>
        </div>
        <button type="button" aria-label="Togli 15 secondi" onClick={() => sposta(-15)}
          className={`w-10 h-10 rounded-full ${VETRO} flex items-center justify-center text-white`}><Minus size={16} aria-hidden="true" /></button>
        <button type="button" aria-label="Aggiungi 15 secondi" onClick={() => sposta(15)}
          className={`w-10 h-10 rounded-full ${VETRO} flex items-center justify-center text-white`}><Plus size={16} aria-hidden="true" /></button>
        <button type="button" aria-label="Salta il recupero" onClick={() => { vibraScelta(); onFine() }}
          className={`w-10 h-10 rounded-full ${VETRO} flex items-center justify-center text-gray-300`}><X size={16} aria-hidden="true" /></button>
      </div>
      <div className="h-1 bg-white/[.06]" aria-hidden="true">
        <div className="h-full bg-gym transition-[width] duration-300 ease-linear" style={{ width: `${pieno * 100}%` }} />
      </div>
    </div>,
    document.body
  )
}
