// RicercaCoach — «Cerca con l'IA», il foglio da cui il coach chiede, a voce o
// scritto, di atleti, allenamenti, note e numeri.
//
// Come funziona, in breve (il dettaglio è in src/lib/dialogoRicerca.js):
// l'IA non legge il database. Legge la domanda, sceglie uno strumento, e lo
// strumento gira QUI sui dati già caricati; all'IA torna il risultato e lei
// scrive una frase. Sotto la frase il coach vede la lista vera, toccabile:
// è la lista, non la frase, la fonte dei fatti.
//
// ⚠️ Si importa SOLO in modo pigro (`lazy`) da Home: è un pezzo che la Home
// atleta non usa mai, e il chunk d'ingresso deve restare intorno ai 594 KB
// (CLAUDE.md §2).
// ⚠️ Il tasto indietro di Android chiude il foglio perché c'è la X con
// `aria-label="Chiudi"` (src/lib/indietroAndroid.js): non toglierla.

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Sparkles, Mic, Square, ArrowUp, X, ChevronRight, RotateCcw } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { useBottomSheet } from '../useBottomSheet'
import { useDettatura } from '../useDettatura'
import AudioVisualizer from './AudioVisualizer'
import { Puntini } from './Puntini'
import { battito } from '../lib/aptica'
import { IA } from '../lib/colori'
import { CARD, LABEL, VETRO } from '../lib/stiliCard'
import { caricaDatiRicerca } from '../lib/ricercaCoach'
import { rispondi } from '../lib/dialogoRicerca'
import { ESEMPI, dettaglioAtleta, descriviFiltro, mostraDettaglio } from '../lib/rigaRicerca'
import { datiSospesi, dimenticaRicerca, riaperta, ricercaSospesa, sospendiRicerca } from '../lib/ricercaSospesa'


/** Dopo quante righe una lista si chiude dietro «Mostra tutti». */
const RIGHE_VISIBILI = 6
/** Dopo quanti secondi di microfono muto si avvisa (come in CreateWorkout). */
const SECONDI_MUTO = 6

const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

/**
 * Un errore con il suo dettaglio tecnico. Il messaggio è per il coach; il
 * dettaglio (modello, stato HTTP, motivo di Gemini) va in piccolo sotto, ed è
 * quello che serve a capire un «non ha risposto» senza aprire i log.
 */
function erroreCon(messaggio, dettaglio) {
  const e = new Error(messaggio)
  if (dettaglio) e.dettaglio = dettaglio
  return e
}

/** L'errore dentro una risposta fallita di `functions.invoke`. */
async function erroreDi(error) {
  let msg = error?.message || 'Errore di rete.'
  let dettaglio = error?.context?.status ? `HTTP ${error.context.status}` : null
  if (error?.context && typeof error.context.json === 'function') {
    try {
      const corpo = await error.context.json()
      if (corpo?.error) msg = corpo.error
      if (corpo?.dettaglio) dettaglio = corpo.dettaglio
    } catch { /* resta il messaggio */ }
  }
  return erroreCon(msg, dettaglio)
}

/** I tre servizi di rete, iniettabili: i test non vanno in rete. */
const serviziVeri = {
  caricaDati: () => caricaDatiRicerca(supabase),
  invoca: async (body) => {
    const { data, error } = await supabase.functions.invoke('ricerca-coach', { body })
    if (error) throw await erroreDi(error)
    if (data?.error) throw erroreCon(data.error, data.dettaglio)
    return data
  },
  trascrivi: async (audioBase64, mimeType) => {
    const { data, error } = await supabase.functions.invoke('ricerca-coach', { body: { audioBase64, mimeType } })
    if (error) throw await erroreDi(error)
    if (data?.error) throw erroreCon(data.error, data.dettaglio)
    return data?.testo || ''
  },
}

// ── I risultati ──────────────────────────────────────────────────────────────

const STATO = {
  completato: { etichetta: 'Fatto', classe: 'text-green-400 bg-green-500/10 border-green-500/25' },
  scaduto: { etichetta: 'Scaduto', classe: 'text-orange-400 bg-orange-500/10 border-orange-500/25' },
  da_fare: { etichetta: 'Da fare', classe: 'text-gray-300 bg-white/[.06] border-white/[.12]' },
  non_assegnato: { etichetta: 'Non assegnato', classe: 'text-gray-400 bg-transparent border-white/[.12] border-dashed' },
}

function Riga({ titolo, sotto, destra, nota, onClick }) {
  return (
    <button type="button" onClick={onClick}
      className="w-full text-left px-3 py-2.5 rounded-2xl bg-white/[.035] border border-white/[.06]
                 hover:border-ia/40 transition active:scale-[.99] flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-bold text-white truncate">{titolo}</p>
        {sotto && <p className="mt-0.5 text-[12.5px] text-muted truncate first-letter:uppercase">{sotto}</p>}
        {nota && <p className="mt-1.5 text-[13px] text-gray-300 leading-snug line-clamp-3">«{nota}»</p>}
      </div>
      {destra}
      <ChevronRight size={16} className="text-gray-600 shrink-0" aria-hidden="true" />
    </button>
  )
}


function ListaEspandibile({ righe, render }) {
  const [tutte, setTutte] = useState(false)
  const visibili = tutte ? righe : righe.slice(0, RIGHE_VISIBILI)
  return (
    <div className="flex flex-col gap-1.5">
      {visibili.map(render)}
      {righe.length > RIGHE_VISIBILI && !tutte && (
        <button type="button" onClick={() => setTutte(true)}
          className="self-start mt-0.5 px-3 py-1.5 rounded-full text-[12.5px] font-bold text-ia bg-ia/10 border border-ia/25">
          Mostra tutti ({righe.length})
        </button>
      )}
    </div>
  )
}

function Numero({ etichetta, valore, sotto }) {
  return (
    <div className="rounded-2xl bg-white/[.035] border border-white/[.06] px-3 py-2.5">
      <p className={LABEL}>{etichetta}</p>
      <p className="mt-1 text-[20px] font-black tracking-tight text-white leading-none">{valore ?? '—'}</p>
      {sotto && <p className="mt-1 text-[11.5px] text-muted">{sotto}</p>}
    </div>
  )
}

function Risultato({ r, vai }) {
  const c = r.completo
  if (!c || c.errore || r.strumento === 'apri') return null

  if (r.strumento === 'statisticheAtleta') {
    return (
      <button type="button" onClick={() => vai(`/athletes/${c.atletaId}`)}
        className="w-full text-left rounded-2xl bg-white/[.02] border border-white/[.06] p-2.5 hover:border-ia/40 transition">
        <p className="px-1 pb-2 text-[13px] font-bold text-white">{c.atleta}{c.inPausa ? ' · in pausa' : ''}</p>
        <div className="grid grid-cols-2 gap-1.5">
          <Numero etichetta="Completati" valore={`${c.completati}/${c.assegnati}`}
            sotto={c.percentuale != null ? `${c.percentuale}%` : null} />
          <Numero etichetta="RPE medio" valore={c.rpeMedio != null ? String(c.rpeMedio).replace('.', ',') : null}
            sotto={c.rpeDichiarati ? `su ${c.rpeDichiarati} dichiarati` : 'nessuno dichiarato'} />
          <Numero etichetta="Minuti stimati" valore={c.minutiStimati} />
          <Numero etichetta="Scaduti" valore={c.scaduti} />
        </div>
      </button>
    )
  }

  if (!Array.isArray(c.risultati) || c.risultati.length === 0) return null

  if (r.strumento === 'cercaAtleti') {
    return (
      <ListaEspandibile righe={c.risultati} render={(a) => (
        <Riga key={a.atletaId} titolo={a.atleta} sotto={dettaglioAtleta(a)} onClick={() => vai(`/athletes/${a.atletaId}`)} />
      )} />
    )
  }

  // cercaWorkout e cercaNelleNote: righe di allenamento.
  return (
    <ListaEspandibile righe={c.risultati} render={(w) => {
      const stato = STATO[w.stato] || STATO.da_fare
      return (
        <Riga key={w.id} titolo={w.titolo}
          sotto={[w.atleta, w.quando, w.rpe != null ? `RPE ${w.rpe}` : null].filter(Boolean).join(' · ')}
          nota={w.nota}
          destra={<span className={`shrink-0 text-[11px] font-bold px-2 py-1 rounded-full border ${stato.classe}`}>{stato.etichetta}</span>}
          onClick={() => w.workoutId && vai(`/workout/${w.workoutId}${w.atletaId ? `?athlete_id=${w.atletaId}` : ''}`)} />
      )
    }} />
  )
}

// ── Il foglio ────────────────────────────────────────────────────────────────

export default function RicercaCoach({ onChiudi, servizi = serviziVeri }) {
  const navigate = useNavigate()
  // Chiudere il foglio (X, velo, maniglia, Esc) chiude anche la conversazione;
  // andare a un risultato no: lì la si mette da parte (`vai`, più sotto).
  const alChiudere = useCallback(() => { dimenticaRicerca(); onChiudi() }, [onChiudi])
  const { chiudi, maniglia, stileFoglio, stileVelo, classeFoglio, classeVelo } = useBottomSheet(alChiudere)

  // Se si torna da un risultato, si riparte da dov'eravamo.
  const [ripresa] = useState(ricercaSospesa)
  useEffect(() => { riaperta() }, [])
  const [dati, setDati] = useState(() => datiSospesi())
  const [erroreDati, setErroreDati] = useState(null)
  const [turni, setTurni] = useState(() => (ripresa?.turni || []).filter(t => t.stato !== 'attesa'))
  const [testo, setTesto] = useState('')
  const [avviso, setAvviso] = useState(null)
  const storia = useRef(ripresa?.storia || [])
  const occupato = turni.some(t => t.stato === 'attesa')
  const fondo = useRef(null)

  const carica = useCallback(() => {
    setErroreDati(null)
    setDati(null)
    servizi.caricaDati()
      .then(setDati)
      .catch(e => setErroreDati(e?.message || 'Dati non caricati.'))
  }, [servizi])
  // I dati messi da parte con la conversazione si riusano: rileggerli a ogni
  // ritorno vorrebbe dire aspettare per rivedere una lista che si aveva già.
  const giaCaricati = useRef(!!dati)
  useEffect(() => { if (!giaCaricati.current) carica() }, [carica])

  useEffect(() => {
    fondo.current?.scrollIntoView?.({ block: 'end', behavior: 'smooth' })
  }, [turni])

  // `turni` cambia a ogni risposta: lo si legge da un ref, così `vai` resta
  // stabile e non ricrea `chiedi` a ogni render.
  const turniRef = useRef(turni)
  useEffect(() => { turniRef.current = turni })

  const vai = useCallback((percorso) => {
    sospendiRicerca({ turni: turniRef.current, storia: storia.current, dati })
    onChiudi()
    navigate(percorso)
  }, [onChiudi, navigate, dati])

  const chiedi = useCallback(async (domanda) => {
    const d = String(domanda || '').trim()
    if (!d || !dati || occupato) return
    setTesto('')
    setAvviso(null)
    battito()
    const id = Date.now()
    setTurni(t => [...t, { id, domanda: d, stato: 'attesa' }])
    try {
      const esito = await rispondi({ domanda: d, storia: storia.current, dati, invoca: servizi.invoca })
      storia.current = esito.storia
      if (esito.percorso) { vai(esito.percorso); return }
      setTurni(t => t.map(x => x.id === id ? { ...x, stato: 'fatto', testo: esito.testo, risultati: esito.risultati } : x))
    } catch (e) {
      setTurni(t => t.map(x => x.id === id ? { ...x, stato: 'errore', testo: e?.message || 'Qualcosa è andato storto.', dettaglio: e?.dettaglio || null } : x))
    }
  }, [dati, occupato, servizi, vai])

  const dettatura = useDettatura({
    trascrivi: servizi.trascrivi,
    onTesto: (t) => chiedi(t),
    onErrore: setAvviso,
  })

  const nuova = () => {
    dimenticaRicerca()
    storia.current = []
    setTurni([])
    setAvviso(null)
  }

  const inviaTesto = (e) => {
    e?.preventDefault?.()
    chiedi(testo)
  }

  const microfonoMuto = dettatura.inAscolto && !dettatura.haSentito && dettatura.secondi >= SECONDI_MUTO

  return createPortal(
    <div className={`fixed inset-0 z-[100] flex flex-col justify-end bg-black/85 touch-none ${classeVelo}`}
      style={stileVelo} onClick={chiudi}>
      <div role="dialog" aria-modal="true" aria-label="Cerca con l'IA" onClick={(e) => e.stopPropagation()}
        style={stileFoglio}
        className={`bg-[#141416] border-t border-ia/20 rounded-t-3xl flex flex-col h-[88dvh] touch-auto
                    shadow-[0_-20px_50px_-12px_rgba(0,0,0,.85)] ${classeFoglio}`}>

        <button type="button" aria-label="Trascina per chiudere" {...maniglia}
          className="w-full pt-3 pb-2 flex justify-center shrink-0 touch-none cursor-grab">
          <span aria-hidden="true" className="w-10 h-1 rounded-full bg-white/20" />
        </button>

        <div className="flex items-center gap-3 px-4 pb-3 shrink-0 border-b border-white/[.06]">
          <span aria-hidden="true"
            className="w-10 h-10 rounded-[13px] bg-ia text-white flex items-center justify-center shrink-0
                       shadow-[0_10px_20px_-8px_rgba(168,85,247,.6)]">
            <Sparkles size={19} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[16px] font-extrabold tracking-[-.015em] text-white">Cerca con l'IA</p>
            <p className="mt-[1px] text-[12.5px] font-medium text-[#c4a6e8] truncate">Atleti, allenamenti, note: scrivi o parla</p>
          </div>
          {turni.length > 0 && (
            <button type="button" onClick={nuova} disabled={occupato} aria-label="Nuova ricerca"
              className={`w-9 h-9 rounded-full ${VETRO} text-gray-300 flex items-center justify-center disabled:opacity-40`}>
              <RotateCcw size={16} />
            </button>
          )}
          <button type="button" onClick={chiudi} aria-label="Chiudi"
            className={`w-9 h-9 rounded-full ${VETRO} text-gray-300 flex items-center justify-center`}>
            <X size={17} />
          </button>
        </div>

        {/* ── La conversazione ── */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 flex flex-col gap-4">
          {erroreDati ? (
            <div className={`${CARD} p-4 text-center flex flex-col items-center gap-3`}>
              <p className="text-[14px] text-gray-300">Non riesco a caricare i dati: {erroreDati}</p>
              <button type="button" onClick={carica}
                className="px-4 py-2 rounded-xl bg-ia text-white text-[13.5px] font-bold">Riprova</button>
            </div>
          ) : !dati ? (
            <div className="flex items-center gap-3 text-muted text-[13.5px] py-2" role="status">
              <Puntini colore="bg-ia" /> Carico atleti e allenamenti…
            </div>
          ) : turni.length === 0 ? (
            <div className="flex flex-col gap-2.5">
              <p className={LABEL}>Prova a chiedere</p>
              <div className="flex flex-wrap gap-2">
                {ESEMPI.map(e => (
                  <button key={e} type="button" onClick={() => chiedi(e)}
                    className={`px-3 py-2 rounded-2xl ${VETRO} text-[13px] font-semibold text-gray-200 text-left
                                hover:border-ia/45 transition active:scale-[.98]`}>
                    {e}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            turni.map(t => (
              <div key={t.id} className="flex flex-col gap-2.5">
                <p className="self-end max-w-[85%] px-3.5 py-2 rounded-2xl rounded-br-md bg-white/[.08] text-[14px] text-white">
                  {t.domanda}
                </p>
                {t.stato === 'attesa' ? (
                  <div className="flex items-center gap-3 text-muted text-[13.5px]" role="status">
                    <Puntini colore="bg-ia" /> Cerco…
                  </div>
                ) : t.stato === 'errore' ? (
                  <div>
                    <p className="text-[14px] text-orange-400 leading-snug">{t.testo}</p>
                    {mostraDettaglio(t.testo, t.dettaglio) && <p className="mt-1 text-[11.5px] text-gray-600 font-mono break-all">{t.dettaglio}</p>}
                  </div>
                ) : (
                  <>
                    {t.testo
                      ? <p className="text-[14.5px] text-gray-100 leading-relaxed">{t.testo}</p>
                      : !t.risultati?.length && <p className="text-[14px] text-muted">Non ho trovato una risposta: prova a dirlo in un altro modo.</p>}
                    {(t.risultati || []).map((r, i) => {
                      const filtro = descriviFiltro(r.strumento, r.args)
                      return (
                        <div key={i} className="flex flex-col gap-1.5">
                          {/* Il filtro VERO, sopra la lista: se l'IA ha capito male
                              la domanda, è qui che si vede (rigaRicerca.js). */}
                          {filtro && (
                            <p className="text-[11.5px] text-muted leading-snug">
                              <span className="font-bold uppercase tracking-[.08em]">Filtro</span> · {filtro}
                            </p>
                          )}
                          <Risultato r={r} vai={vai} />
                        </div>
                      )
                    })}
                  </>
                )}
              </div>
            ))
          )}
          <div ref={fondo} />
        </div>

        {/* ── La barra in basso ── */}
        <div className="shrink-0 border-t border-white/[.06] px-4 pt-3 pb-[calc(.75rem+env(safe-area-inset-bottom))]">
          {avviso && <p className="pb-2 text-[13px] text-orange-400 leading-snug" role="alert">{avviso}</p>}

          {dettatura.inAscolto ? (
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-3">
                <span className={`${LABEL} ${dettatura.livello > 0.22 ? 'text-ia' : ''}`}>
                  {dettatura.livello > 0.22 ? 'Ti sento' : 'Parla pure…'}
                </span>
                <span className="ml-auto text-[12px] font-extrabold text-gray-300">{mmss(dettatura.secondi)}</span>
              </div>
              <div className="h-10 flex items-center">
                {dettatura.stream
                  ? <AudioVisualizer stream={dettatura.stream} colore={IA} altezza={40} classe="w-full h-10" onLivello={dettatura.suLivello} />
                  : <p className="text-[13px] text-muted">{dettatura.provvisorio || 'In ascolto…'}</p>}
              </div>
              {dettatura.stream && dettatura.provvisorio && (
                <p className="text-[14px] text-white leading-snug">{dettatura.provvisorio}</p>
              )}
              {microfonoMuto && (
                <p className="text-[13px] text-orange-400 leading-snug">
                  Non arriva nessun suono. Parla più vicino al microfono, o controlla il permesso nelle impostazioni.
                </p>
              )}
              <button type="button" onClick={dettatura.ferma}
                className="min-h-12 rounded-2xl bg-ia text-white text-[15px] font-black flex items-center justify-center gap-2.5
                           shadow-[0_14px_26px_-10px_rgba(168,85,247,.6)] active:scale-[.99]">
                <Square size={16} fill="currentColor" aria-hidden="true" /> Ho finito, cerca
              </button>
            </div>
          ) : dettatura.trascrivendo ? (
            <div className="min-h-12 flex items-center justify-center gap-3 text-[13.5px] text-muted" role="status">
              <Puntini colore="bg-ia" /> Ascolto la registrazione…
            </div>
          ) : (
            <form onSubmit={inviaTesto} className="flex items-center gap-2">
              <input
                type="text" value={testo} onChange={e => setTesto(e.target.value)}
                placeholder={turni.length ? 'Chiedi ancora…' : 'Chiedi qualcosa sui tuoi atleti'}
                aria-label="Domanda" enterKeyHint="search" disabled={!dati}
                className="flex-1 min-w-0 h-12 px-4 rounded-2xl bg-[#111] border border-[#333] text-[15px] text-white
                           placeholder-gray-600 focus:outline-none focus:border-ia/60 disabled:opacity-50" />
              {testo.trim() ? (
                <button type="submit" aria-label="Cerca" disabled={!dati || occupato}
                  className="w-12 h-12 rounded-full bg-ia text-white flex items-center justify-center shrink-0 disabled:opacity-40
                             shadow-[0_10px_20px_-8px_rgba(168,85,247,.6)]">
                  <ArrowUp size={20} />
                </button>
              ) : (
                <button type="button" onClick={dettatura.avvia} aria-label="Detta la domanda" disabled={!dati || occupato}
                  className="w-12 h-12 rounded-full bg-ia text-white flex items-center justify-center shrink-0 disabled:opacity-40
                             shadow-[0_10px_20px_-8px_rgba(168,85,247,.6)]">
                  <Mic size={20} />
                </button>
              )}
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
