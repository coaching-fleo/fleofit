// CreaGym.jsx — il passo 2 della categoria Gym nel builder (13/10/2026).
//
// La scheda da palestra: tre fasi (riscaldamento, parte principale,
// defaticamento) e dentro esercizi singoli o superserie. Il formato dei dati e
// la logica stanno in `src/lib/gym.js`; qui c'è solo il modo di comporli.
//
// Le scelte, e da dove vengono:
// - **Il picker aggiunge più esercizi in un colpo** (come Hevy e Strong): una
//   scheda ne ha sei-dieci, e un giro picker → foglio → picker per ognuno è
//   il difetto che quelle app hanno tolto. Gli esercizi entrano con valori di
//   partenza sensati (3 × 10, rec 1:30) e si ritoccano dopo.
// - **La superserie si fa unendo**: «Unisci al successivo» lega due esercizi
//   vicini, «Scollega» li separa. È il gesto delle app per coach; una scelta
//   «tipo di blocco» in anticipo obbligherebbe a sapere la struttura prima di
//   aver scelto gli esercizi.
// - **I numeri si scrivono con il righello** del builder (`FoglioMisure`),
//   lo stesso di Hyrox: un gesto solo in tutta l'app.
// - **Serie per serie** solo su richiesta, nel foglio dell'esercizio: la
//   maggior parte delle schede è «4 × 10», e una tabella sempre aperta
//   chiederebbe quattro righe dove ne basta una.
//
// ⚠️ Ogni foglio ha la X con `aria-label="Chiudi"`: è così che il tasto
// indietro di Android lo chiude (src/lib/indietroAndroid.js).
// ⚠️ Niente librerie di effetti qui: questo file lo importa solo CreateWorkout.

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Plus, X, Copy, ChevronUp, ChevronDown, Trash2, Link2, Unlink, Search, Check, ListOrdered, Repeat2, BookmarkPlus } from 'lucide-react'
import { CARD, LABEL, VETRO } from '../lib/stiliCard'
import { useBottomSheet } from '../useBottomSheet'
import { vibraScelta, battito } from '../lib/aptica'
import { chiudiTastieraSuInvio } from '../useTastiera'
import { FoglioMisure } from './FoglioMisure'
import { FoglioSalvaModello } from './FoglioModello'
import { MUSCOLI, cercaEserciziGym, voceGym } from '../lib/eserciziGym'
import {
  FASI_GYM, faseDi, nuovoGruppoGym, nuovoEsercizioGym, tipoGruppo, conDettaglio, serieDi,
  riassuntoEsercizio, riassuntoGruppo, testoTempo, etichetteGym, dettaglioDaSemplice,
  sempliceDaDettaglio, tipoSerie, tipoSerieDopo, caricoGym, repsGym, NOME_TIPO_GRUPPO, cambiaEsercizioGym, spostaInFase,
} from '../lib/gym'

const nuovoId = () => Math.random()

/** Una copia del gruppo con id nuovi, per «Duplica». */
const copiaGruppo = (g) => ({
  ...JSON.parse(JSON.stringify(g)),
  id: nuovoId(),
  esercizi: g.esercizi.map(ex => ({ ...JSON.parse(JSON.stringify(ex)), id: nuovoId() })),
})

// ── Il builder ───────────────────────────────────────────────────────────

/**
 * @param {object} p
 * @param {object[]} p.gruppi     `sections.gym`
 * @param {Function} p.setGruppi  il setState di React (accetta anche una funzione)
 */
export default function CreaGym({ gruppi, setGruppi }) {
  // Dove aggiunge il picker: in una fase (un gruppo per esercizio) o dentro
  // una superserie esistente.
  const [picker, setPicker] = useState(null)
  const [editor, setEditor] = useState(null)        // { gruppoId, esercizioId }
  const [editorGruppo, setEditorGruppo] = useState(null) // id di un gruppo con più esercizi
  // Il picker a scelta singola sopra il foglio dell'esercizio: «Cambia».
  const [cambio, setCambio] = useState(false)
  const [daSalvare, setDaSalvare] = useState(null) // il gruppo di «Salva come modello»
  const etichette = useMemo(() => etichetteGym(gruppi), [gruppi])

  const aggiorna = (id, fn) => setGruppi(prev => prev.map(g => (g.id === id ? fn(g) : g)))

  const aggiungi = (nomi) => {
    if (!nomi.length || !picker) return
    if (picker.gruppoId) {
      const fase = faseDi(gruppi.find(g => g.id === picker.gruppoId))
      aggiorna(picker.gruppoId, g => {
        const base = conDettaglio(g) ? sempliceDaDettaglio(g) : g
        return { ...base, esercizi: [...base.esercizi, ...nomi.map(n => nuovoEsercizioGym(n, fase))] }
      })
    } else {
      setGruppi(prev => [...prev, ...nomi.map(n => nuovoGruppoGym(picker.fase, n))])
    }
  }

  /** Sposta un gruppo di un posto, restando nella sua fase. */
  const sposta = (id, verso) => setGruppi(prev => {
    const i = prev.findIndex(g => g.id === id)
    if (i === -1) return prev
    const fase = faseDi(prev[i])
    let j = i + verso
    while (j >= 0 && j < prev.length && faseDi(prev[j]) !== fase) j += verso
    if (j < 0 || j >= prev.length) return prev
    const fuori = [...prev]
    ;[fuori[i], fuori[j]] = [fuori[j], fuori[i]]
    return fuori
  })

  const duplica = (id) => setGruppi(prev => {
    const i = prev.findIndex(g => g.id === id)
    if (i === -1) return prev
    const fuori = [...prev]
    fuori.splice(i + 1, 0, copiaGruppo(prev[i]))
    return fuori
  })

  const elimina = (id) => setGruppi(prev => prev.filter(g => g.id !== id))

  /** Lega il gruppo al successivo della stessa fase: nasce (o cresce) una superserie. */
  const unisci = (id) => setGruppi(prev => {
    const i = prev.findIndex(g => g.id === id)
    if (i === -1) return prev
    const fase = faseDi(prev[i])
    const j = prev.findIndex((g, k) => k > i && faseDi(g) === fase)
    if (j === -1) return prev
    const a = conDettaglio(prev[i]) ? sempliceDaDettaglio(prev[i]) : prev[i]
    const b = conDettaglio(prev[j]) ? sempliceDaDettaglio(prev[j]) : prev[j]
    const unito = { ...a, esercizi: [...a.esercizi, ...b.esercizi] }
    return prev.filter((_, k) => k !== j).map(g => (g.id === id ? unito : g))
  })

  /** Porta un esercizio fuori dalla superserie, subito dopo di essa. */
  const scollega = (gruppoId, esercizioId) => setGruppi(prev => {
    const i = prev.findIndex(g => g.id === gruppoId)
    if (i === -1) return prev
    const g = prev[i]
    const ex = g.esercizi.find(e => e.id === esercizioId)
    if (!ex || g.esercizi.length < 2) return prev
    const resto = { ...g, esercizi: g.esercizi.filter(e => e.id !== esercizioId) }
    const solo = { ...g, id: nuovoId(), note: '', esercizi: [ex] }
    const fuori = [...prev]
    fuori.splice(i, 1, resto, solo)
    return fuori
  })

  const rimuoviEsercizio = (gruppoId, esercizioId) => setGruppi(prev => prev
    .map(g => (g.id === gruppoId ? { ...g, esercizi: g.esercizi.filter(e => e.id !== esercizioId) } : g))
    .filter(g => g.esercizi.length > 0))

  const gruppoInEditor = editor && gruppi.find(g => g.id === editor.gruppoId)
  const esercizioInEditor = gruppoInEditor?.esercizi.find(e => e.id === editor.esercizioId)
  const gruppoMulti = editorGruppo && gruppi.find(g => g.id === editorGruppo)

  return (
    <div className="flex flex-col gap-[18px]" data-builder-gym>
      {FASI_GYM.map(f => {
        const della = gruppi.filter(g => faseDi(g) === f.id)
        const principale = f.id === 'principale'
        return (
          <section key={f.id} className="flex flex-col gap-[11px]" aria-label={f.nome} data-fase-gym={f.id}>
            <div className="flex items-baseline justify-between px-1">
              <h2 className={principale ? LABEL.replace('text-muted', 'text-gym') : LABEL}>{f.nome}</h2>
              {della.length > 0 && (
                <span className="text-[11.5px] font-bold text-[#5b6070]">
                  {della.reduce((n, g) => n + g.esercizi.length, 0)} eserciz{della.reduce((n, g) => n + g.esercizi.length, 0) === 1 ? 'io' : 'i'}
                </span>
              )}
            </div>

            {della.map((g, k) => (
              <CardGruppo
                key={g.id}
                gruppo={g}
                etichette={etichette.get(g.id) || []}
                primo={k === 0}
                ultimo={k === della.length - 1}
                onApri={(esercizioId) => { battito(); setEditor({ gruppoId: g.id, esercizioId }) }}
                onApriGruppo={() => { battito(); setEditorGruppo(g.id) }}
                onSu={() => sposta(g.id, -1)}
                onGiu={() => sposta(g.id, 1)}
                onDuplica={() => duplica(g.id)}
                onSalvaModello={() => setDaSalvare(g)}
                onElimina={() => elimina(g.id)}
                onUnisci={() => { vibraScelta(); unisci(g.id) }}
                onScollega={(esercizioId) => { vibraScelta(); scollega(g.id, esercizioId) }}
                onAggiungiQui={() => setPicker({ gruppoId: g.id, titolo: `Aggiungi alla ${NOME_TIPO_GRUPPO[tipoGruppo(g)].toLowerCase()}` })}
              />
            ))}

            <button type="button"
              onClick={() => setPicker({ fase: f.id, titolo: principale ? 'Aggiungi esercizi' : `Aggiungi al ${f.nome.toLowerCase()}` })}
              className={`min-h-12 rounded-[16px] border border-dashed text-[13.5px] font-extrabold flex items-center justify-center gap-2 transition
                ${principale ? 'border-gym/40 text-gym hover:bg-gym/10' : 'border-white/15 text-[#9aa0ad] hover:bg-white/[.04]'}`}>
              <Plus size={16} aria-hidden="true" />
              {principale ? (della.length ? 'Aggiungi esercizi' : 'Aggiungi il primo esercizio') : `Aggiungi al ${f.nome.toLowerCase()}`}
            </button>
          </section>
        )
      })}

      {picker && (
        <PickerGym titolo={picker.titolo} onAggiungi={aggiungi} onChiudi={() => setPicker(null)} />
      )}

      {gruppoInEditor && esercizioInEditor && (
        <FoglioEsercizioGym
          gruppo={gruppoInEditor}
          esercizio={esercizioInEditor}
          etichetta={(etichette.get(gruppoInEditor.id) || [])[gruppoInEditor.esercizi.indexOf(esercizioInEditor)]}
          onGruppo={(nuovo) => aggiorna(gruppoInEditor.id, () => nuovo)}
          onRimuovi={() => { rimuoviEsercizio(gruppoInEditor.id, esercizioInEditor.id) }}
          onCambia={() => setCambio(true)}
          onFase={(fase) => setGruppi(prev => spostaInFase(prev, gruppoInEditor.id, fase))}
          onChiudi={() => setEditor(null)}
        />
      )}

      {cambio && gruppoInEditor && esercizioInEditor && (
        <PickerGym titolo="Cambia esercizio" unico
          onAggiungi={([nome]) => {
            if (!nome) return
            aggiorna(gruppoInEditor.id, g => ({
              ...g,
              esercizi: g.esercizi.map(e => (e.id === esercizioInEditor.id ? cambiaEsercizioGym(e, nome, faseDi(g)) : e)),
            }))
          }}
          onChiudi={() => setCambio(false)}
        />
      )}

      {gruppoMulti && gruppoMulti.esercizi.length > 1 && (
        <FoglioGruppoGym
          gruppo={gruppoMulti}
          onGruppo={(nuovo) => aggiorna(gruppoMulti.id, () => nuovo)}
          onFase={(fase) => setGruppi(prev => spostaInFase(prev, gruppoMulti.id, fase))}
          onChiudi={() => setEditorGruppo(null)}
        />
      )}

      {daSalvare && (
        <FoglioSalvaModello categoria="Gym" blocco={daSalvare} onChiudi={() => setDaSalvare(null)} />
      )}
    </div>
  )
}

// ── La card di un gruppo ─────────────────────────────────────────────────

function Lettera({ testo }) {
  return (
    <span aria-hidden="true"
      className="shrink-0 min-w-7 h-7 px-1.5 rounded-full bg-gym/[.13] border border-gym/30 flex items-center justify-center
                 text-[11.5px] font-extrabold text-gym tabular-nums">
      {testo}
    </span>
  )
}

function Azione({ etichetta, onClick, disabled, children, pericolo }) {
  return (
    <button type="button" aria-label={etichetta} title={etichetta} onClick={onClick} disabled={disabled}
      className={`p-1.5 text-[#5b6070] transition disabled:opacity-25 ${pericolo ? 'hover:text-red-400' : 'hover:text-white'}`}>
      {children}
    </button>
  )
}

function CardGruppo({ gruppo, etichette, primo, ultimo, onApri, onApriGruppo, onSu, onGiu, onDuplica, onSalvaModello, onElimina, onUnisci, onScollega, onAggiungiQui }) {
  const multi = gruppo.esercizi.length > 1
  const principale = faseDi(gruppo) === 'principale'
  const rec = testoTempo(gruppo.recupero)

  const azioni = (
    <div className="flex items-center shrink-0 -mr-1">
      <Azione etichetta="Sposta su" onClick={onSu} disabled={primo}><ChevronUp size={15} /></Azione>
      <Azione etichetta="Sposta giù" onClick={onGiu} disabled={ultimo}><ChevronDown size={15} /></Azione>
      <Azione etichetta="Duplica" onClick={onDuplica}><Copy size={15} /></Azione>
      <Azione etichetta="Salva come modello" onClick={onSalvaModello}><BookmarkPlus size={15} /></Azione>
      <Azione etichetta="Elimina" onClick={onElimina} pericolo><Trash2 size={15} /></Azione>
    </div>
  )

  return (
    <div data-gruppo-gym={gruppo.id}
      className="relative overflow-hidden rounded-[20px] border border-white/[.07] bg-gradient-to-b from-[#1c1c1f] to-[#171719]
                 shadow-[0_16px_30px_-18px_rgba(0,0,0,.85),inset_0_1px_0_rgba(255,255,255,.05)]">
      <span aria-hidden="true" className="absolute left-0 inset-y-0 bg-gym"
        style={{ width: principale ? 4 : 3, opacity: principale ? 1 : 0.5 }} />

      {multi ? (
        <>
          <div className="pl-4 pr-2.5 pt-3 pb-1 flex items-center gap-2">
            <button type="button" onClick={onApriGruppo}
              aria-label={`${riassuntoGruppo(gruppo)}: modifica giri e recupero`}
              className="flex-1 min-w-0 text-left">
              <span className="block text-[15px] font-extrabold tracking-[-.015em] text-gym truncate">
                {NOME_TIPO_GRUPPO[tipoGruppo(gruppo)]}
              </span>
              <span className="block mt-[2px] text-[11.5px] font-bold tracking-[.03em] text-muted truncate">
                {riassuntoGruppo(gruppo).split(' · ').slice(1).join(' · ')} · senza pausa fra gli esercizi
              </span>
            </button>
            {azioni}
          </div>
          <div className="pl-4 pr-2.5 pb-2 flex flex-col">
            {gruppo.esercizi.map((ex, j) => (
              <div key={ex.id} className="flex items-center gap-2.5 py-1.5 border-t border-white/[.05] first:border-t-0">
                <Lettera testo={etichette[j]} />
                <button type="button" onClick={() => onApri(ex.id)} className="flex-1 min-w-0 text-left py-1">
                  <span className="block text-[14.5px] font-extrabold text-white leading-snug line-clamp-2">{ex.name}</span>
                  <span className="block text-[12px] font-semibold text-gray-400 truncate">{riassuntoEsercizio(gruppo, ex) || 'Tocca per i numeri'}</span>
                </button>
                <Azione etichetta={`Scollega ${ex.name}`} onClick={() => onScollega(ex.id)}><Unlink size={15} /></Azione>
              </div>
            ))}
            <button type="button" onClick={onAggiungiQui}
              className="mt-1 self-start min-h-9 px-2 -mx-1 text-[12.5px] font-extrabold text-gym flex items-center gap-1.5 hover:brightness-125">
              <Plus size={14} aria-hidden="true" /> Aggiungi un esercizio qui
            </button>
          </div>
        </>
      ) : (
        <div className="pl-4 pr-2.5 py-3 flex items-center gap-2.5">
          <Lettera testo={etichette[0]} />
          <button type="button" onClick={() => onApri(gruppo.esercizi[0].id)} className="flex-1 min-w-0 text-left">
            <span className="block text-[15px] font-extrabold tracking-[-.015em] text-white leading-snug line-clamp-2">{gruppo.esercizi[0].name}</span>
            <span className="block mt-[2px] text-[12px] font-semibold text-gray-400 truncate">
              {[riassuntoEsercizio(gruppo, gruppo.esercizi[0]), rec && `rec ${rec}`].filter(Boolean).join(' · ')}
            </span>
          </button>
          {azioni}
        </div>
      )}

      {/* Unire al successivo: è così che nasce una superserie. Non c'è
          sull'ultimo della fase, che non ha un «successivo». */}
      {!ultimo && (
        <button type="button" onClick={onUnisci}
          className="w-full border-t border-white/[.05] min-h-9 px-4 text-[12px] font-bold text-[#7c818d] hover:text-gym
                     flex items-center gap-1.5 transition">
          <Link2 size={14} aria-hidden="true" /> {multi ? 'Aggiungi il successivo a questa superserie' : 'Superserie con il successivo'}
        </button>
      )}
    </div>
  )
}

// ── La cornice dei fogli ─────────────────────────────────────────────────

function Foglio({ titolo, sottotitolo, onChiudi, children, alto = false, piede, onPronto }) {
  const { chiudi, maniglia, stileFoglio, stileVelo, classeFoglio, classeVelo } = useBottomSheet(onChiudi)
  // Chi deve chiudere il foglio da un tocco nel contenuto (il picker «unico»)
  // riceve la chiusura animata, non solo quella del piede.
  useEffect(() => { onPronto?.(() => chiudi) }, [onPronto, chiudi])
  return createPortal(
    <div className="fixed inset-0 z-[70] flex flex-col justify-end">
      <div aria-hidden="true" onClick={chiudi} className={`absolute inset-0 bg-black/70 ${classeVelo}`} style={stileVelo} />
      <div role="dialog" aria-label={titolo}
        className={`relative bg-[#141416] border-t border-white/[.08] rounded-t-3xl flex flex-col
                    ${alto ? 'h-[88dvh]' : 'max-h-[92dvh]'}
                    shadow-[0_-20px_50px_-12px_rgba(0,0,0,.85)] ${classeFoglio}`}
        style={stileFoglio}>
        <div className="px-4 shrink-0">
          <button type="button" aria-label="Trascina giù per chiudere" {...maniglia}
            className="w-full pt-3 pb-2.5 flex justify-center touch-none cursor-grab active:cursor-grabbing group">
            <span aria-hidden="true" className="w-10 h-1 rounded-full bg-white/20 group-hover:bg-white/35" />
          </button>
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
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-3 hide-scrollbar">{children}</div>
        {piede && (
          <div className="shrink-0 px-4 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))] border-t border-white/[.06]">
            {piede(chiudi)}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

const BOTTONE_FATTO = 'w-full min-h-[52px] rounded-2xl bg-gym text-black text-[16.5px] font-black tracking-[-.01em] ' +
  'flex items-center justify-center gap-2.5 hover:brightness-110 active:scale-[.99] transition disabled:opacity-40'

// ── Il picker ────────────────────────────────────────────────────────────

/**
 * La libreria, filtrabile per muscolo e per testo, con selezione multipla.
 * Un nome che non c'è si aggiunge com'è scritto: diventa un esercizio custom.
 * Con `unico` (il «Cambia» del foglio) il primo tocco sceglie e chiude.
 */
export function PickerGym({ titolo, onAggiungi, onChiudi, unico = false }) {
  const [testo, setTesto] = useState('')
  const [muscolo, setMuscolo] = useState(null)
  const [scelti, setScelti] = useState([])
  const risultati = useMemo(() => cercaEserciziGym(testo, muscolo), [testo, muscolo])
  const scritto = testo.trim()
  const nuovo = scritto && !risultati.some(e => e.nome.toLowerCase() === scritto.toLowerCase())
    && !scelti.some(n => n.toLowerCase() === scritto.toLowerCase())

  const [chiusura, setChiusura] = useState(null)
  const alterna = (nome) => {
    vibraScelta()
    if (unico) { onAggiungi([nome]); chiusura?.(); return }
    setScelti(prev => (prev.includes(nome) ? prev.filter(n => n !== nome) : [...prev, nome]))
  }

  // Raggruppati per muscolo, nell'ordine di MUSCOLI.
  const perMuscolo = MUSCOLI
    .map(m => ({ muscolo: m, voci: risultati.filter(e => e.muscolo === m) }))
    .filter(g => g.voci.length > 0)

  return (
    <Foglio titolo={titolo} sottotitolo={unico ? 'Tocca il movimento giusto' : 'Tocca per scegliere, anche più di uno'}
      onChiudi={onChiudi} alto onPronto={setChiusura}
      piede={unico ? null : (chiudi) => (
        <button type="button" disabled={!scelti.length} className={BOTTONE_FATTO}
          onClick={() => { onAggiungi(scelti); chiudi() }}>
          <Plus size={19} aria-hidden="true" />
          {scelti.length === 0 ? 'Scegli gli esercizi' : scelti.length === 1 ? 'Aggiungi 1 esercizio' : `Aggiungi ${scelti.length} esercizi`}
        </button>
      )}>
      <div className="sticky top-0 z-10 bg-[#141416] pb-2.5 flex flex-col gap-2.5">
        <label className={`flex items-center gap-2.5 rounded-2xl px-3.5 min-h-12 ${VETRO}`}>
          <Search size={17} className="text-muted shrink-0" aria-hidden="true" />
          {/* ⚠️ Niente autoFocus: la tastiera coprirebbe la lista che si è venuti a guardare (crea-workout.md, trappola 11). */}
          <input type="search" value={testo} onChange={e => setTesto(e.target.value)}
            aria-label="Cerca un esercizio" placeholder="Cerca o scrivi un esercizio"
            enterKeyHint="done" onKeyDown={chiudiTastieraSuInvio}
            className="flex-1 min-w-0 bg-transparent text-[15px] font-semibold text-white placeholder-[#5b6070] focus:outline-none" />
        </label>
        <div className="flex gap-2 overflow-x-auto hide-scrollbar -mx-4 px-4" role="group" aria-label="Gruppo muscolare">
          {[null, ...MUSCOLI].map(m => {
            const attivo = muscolo === m
            return (
              <button key={m || 'tutti'} type="button" aria-pressed={attivo}
                onClick={() => { vibraScelta(); setMuscolo(m) }}
                className={`shrink-0 min-h-9 px-3.5 rounded-full text-[12.5px] font-extrabold transition border
                  ${attivo ? 'bg-gym text-black border-gym' : 'bg-white/[.06] border-white/[.1] text-[#c9ccd4] hover:border-white/25'}`}>
                {m || 'Tutti'}
              </button>
            )
          })}
        </div>
      </div>

      {nuovo && (
        <button type="button" onClick={() => { alterna(scritto); setTesto('') }}
          className="w-full min-h-12 mb-2 rounded-2xl border border-dashed border-gym/40 text-gym text-[13.5px] font-extrabold
                     flex items-center justify-center gap-2 hover:bg-gym/10">
          <Plus size={16} aria-hidden="true" /> Aggiungi «{scritto}»
        </button>
      )}

      {scelti.filter(n => !voceGym(n).muscolo).map(n => (
        <RigaPicker key={n} nome={n} muscolo="Custom" scelto onClick={() => alterna(n)} />
      ))}

      {perMuscolo.map(g => (
        <div key={g.muscolo} className="mb-3">
          {!muscolo && <p className={`${LABEL} px-1 pt-2 pb-1.5`}>{g.muscolo}</p>}
          {g.voci.map(e => (
            <RigaPicker key={e.nome} nome={e.nome} scelto={scelti.includes(e.nome)} onClick={() => alterna(e.nome)} />
          ))}
        </div>
      ))}

      {perMuscolo.length === 0 && !nuovo && (
        <p className="text-center text-[13px] text-muted py-8">Nessun esercizio trovato.</p>
      )}
    </Foglio>
  )
}

function RigaPicker({ nome, muscolo, scelto, onClick }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={scelto}
      className={`w-full min-h-12 px-3 rounded-[14px] flex items-center gap-3 text-left transition
        ${scelto ? 'bg-gym/[.12]' : 'hover:bg-white/[.04]'}`}>
      <span className={`shrink-0 w-6 h-6 rounded-full border flex items-center justify-center transition
        ${scelto ? 'bg-gym border-gym text-black' : 'border-white/20'}`}>
        {scelto && <Check size={14} strokeWidth={3} aria-hidden="true" />}
      </span>
      <span className="flex-1 min-w-0 text-[14.5px] font-bold text-white truncate">{nome}</span>
      {muscolo && <span className="shrink-0 text-[11.5px] font-bold text-muted">{muscolo}</span>}
    </button>
  )
}

// ── Il foglio di un esercizio ────────────────────────────────────────────

const RIR = ['', '0', '1', '2', '3', '4']

/** «8-12» → ['8', '12']; «10» → ['10', '-']; «Max» → ['Max', '-']. */
const estremiReps = (r) => {
  const m = String(r ?? '').match(/^(\d+)-(\d+)$/)
  return m ? [m[1], m[2]] : [r || '-', '-']
}

export function FoglioEsercizioGym({ gruppo, esercizio, etichetta, onGruppo, onRimuovi, onCambia, onFase, onChiudi }) {
  const singolo = tipoGruppo(gruppo) === 'singolo'
  const dettaglio = conDettaglio(gruppo)
  const voce = voceGym(esercizio.name)
  const aTempo = voce.misura === 'tempo'
  const [scheda, setScheda] = useState(singolo ? 'serie' : 'quanto')

  const conEsercizio = (campi) => onGruppo({
    ...gruppo,
    esercizi: gruppo.esercizi.map(e => (e.id === esercizio.id ? { ...e, ...campi } : e)),
  })
  const conGruppo = (campi) => onGruppo({ ...gruppo, ...campi })

  const [da, a] = estremiReps(esercizio.reps)
  const misure = []
  if (!dettaglio) {
    misure.push({
      chiave: 'serie', etichetta: singolo ? 'Serie' : 'Giri', scala: 'serie', rapidi: ['2', '3', '4', '5'],
      valore: String(serieDi(gruppo)), onChange: (v) => conGruppo({ serie: v }),
    })
    if (aTempo) {
      misure.push({
        chiave: 'quanto', etichetta: 'Durata', scala: 'tempo', rapidi: ['0:30', '1:00', '5:00', '10:00'],
        valore: esercizio.durata || '-', onChange: (v) => conEsercizio({ durata: v }),
      })
    } else {
      misure.push({
        chiave: 'quanto', etichetta: 'Reps', scala: 'ripetizioni', rapidi: ['6', '8', '10', '12', '15'],
        valore: da === 'Max' ? 'Max' : da,
        onChange: (v) => conEsercizio({ reps: a !== '-' && v !== 'Max' ? `${v}-${a}` : v }),
        secondo: da === 'Max' ? undefined : {
          etichetta: 'Reps fino a', valore: a,
          onChange: (v) => conEsercizio({ reps: v === '-' ? da : `${da}-${v}` }),
        },
        pillole: [
          { id: 'n', titolo: 'Numero', attiva: da !== 'Max', onClick: () => conEsercizio({ reps: '10' }) },
          { id: 'max', titolo: 'Max (a cedimento)', attiva: da === 'Max', onClick: () => conEsercizio({ reps: 'Max' }) },
        ],
      })
    }
    misure.push({
      chiave: 'kg', etichetta: 'Carico', scala: 'peso',
      valore: esercizio.kg || '-', onChange: (v) => conEsercizio({ kg: v }),
      pillole: [
        { id: 'peso', titolo: 'Con carico', attiva: !!esercizio.kg, onClick: () => conEsercizio({ kg: esercizio.kg || '20 kg' }) },
        { id: 'libero', titolo: 'Corpo libero', attiva: !esercizio.kg, onClick: () => conEsercizio({ kg: '' }) },
      ],
    })
  }
  misure.push({
    chiave: 'recupero', etichetta: 'Rec.', scala: 'recupero', rapidi: ['0:45', '1:00', '1:30', '2:00', '3:00'],
    valore: gruppo.recupero || '-', onChange: (v) => conGruppo({ recupero: v === '-' ? '' : v }),
  })
  const attiva = misure.some(m => m.chiave === scheda) ? scheda : misure[0].chiave

  const sottotitolo = [etichetta, voce.muscolo || 'Esercizio custom', riassuntoEsercizio(gruppo, esercizio)].filter(Boolean).join(' · ')

  return (
    <Foglio titolo={esercizio.name} sottotitolo={sottotitolo} onChiudi={onChiudi}
      piede={(chiudi) => (
        <div className="flex gap-2.5">
          <button type="button" aria-label="Elimina l'esercizio" onClick={() => { onRimuovi(); chiudi() }}
            className={`shrink-0 w-[52px] h-[52px] rounded-2xl ${VETRO} flex items-center justify-center text-red-400 hover:border-red-400/50`}>
            <Trash2 size={19} aria-hidden="true" />
          </button>
          <button type="button" onClick={chiudi} className={BOTTONE_FATTO}>
            <Check size={19} aria-hidden="true" /> Fatto
          </button>
        </div>
      )}>
      <div className="flex flex-col gap-3.5">
        {onCambia && (
          <button type="button" onClick={() => { battito(); onCambia() }}
            className={`min-h-11 rounded-2xl px-4 flex items-center gap-3 text-left ${VETRO} hover:border-white/25 transition`}>
            <Repeat2 size={18} className="text-gym shrink-0" aria-hidden="true" />
            <span className="flex-1 min-w-0 text-[14px] font-extrabold text-white">Cambia esercizio</span>
          </button>
        )}

        <FoglioMisure misure={misure} attiva={attiva} onAttiva={setScheda} accento="gym" senzaCarta />

        {onFase && <SceltaFase fase={faseDi(gruppo)} onFase={onFase} />}

        {singolo && (
          <button type="button"
            onClick={() => { vibraScelta(); onGruppo(dettaglio ? sempliceDaDettaglio(gruppo) : { ...gruppo, esercizi: [{ ...esercizio, dettaglio: dettaglioDaSemplice(gruppo) }] }) }}
            aria-pressed={dettaglio}
            className={`min-h-12 rounded-2xl px-4 flex items-center gap-3 text-left ${VETRO} hover:border-white/25 transition`}>
            <ListOrdered size={18} className={dettaglio ? 'text-gym' : 'text-muted'} aria-hidden="true" />
            <span className="flex-1 min-w-0">
              <span className="block text-[14px] font-extrabold text-white">Serie una per una</span>
              <span className="block text-[12px] font-medium text-muted">Piramidale, riscaldamento, drop set, cedimento</span>
            </span>
            <span className={`shrink-0 w-10 h-6 rounded-full p-0.5 transition ${dettaglio ? 'bg-gym' : 'bg-white/15'}`} aria-hidden="true">
              <span className={`block w-5 h-5 rounded-full bg-white transition ${dettaglio ? 'translate-x-4' : ''}`} />
            </span>
          </button>
        )}

        {dettaglio && (
          <TabellaSerie righe={esercizio.dettaglio} aTempo={aTempo}
            onRighe={(righe) => conEsercizio({ dettaglio: righe })} />
        )}

        {!aTempo && (
          <div className="flex flex-col gap-2">
            <p className={`${LABEL} px-1`}>RIR · ripetizioni in riserva</p>
            <div className="grid grid-cols-6 gap-1.5" role="group" aria-label="RIR">
              {RIR.map(r => {
                const scelto = (esercizio.rir || '') === r
                return (
                  <button key={r || 'nessuno'} type="button" aria-pressed={scelto}
                    onClick={() => { vibraScelta(); conEsercizio({ rir: r }) }}
                    className={`min-h-10 rounded-xl text-[13.5px] font-extrabold border transition
                      ${scelto ? 'bg-gym text-black border-gym' : 'bg-white/[.06] border-white/[.1] text-[#c9ccd4]'}`}>
                    {r === '' ? '—' : r}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-2">
          {!aTempo && (
            <CampoTesto etichetta="Cadenza" placeholder="Es. 3-1-1-0"
              valore={esercizio.cadenza || ''} onChange={(v) => conEsercizio({ cadenza: v })} />
          )}
          <CampoTesto etichetta="Note per l'atleta" placeholder="Es. presa larga, gomiti stretti, fermo di 1″ in basso…"
            valore={esercizio.notes || ''} onChange={(v) => conEsercizio({ notes: v })} />
        </div>
      </div>
    </Foglio>
  )
}

/**
 * In che fase sta il gruppo: tre pillole, come il tipo di una fase di corsa.
 * Cambiarla porta il gruppo (superserie intera) in fondo alla fase nuova.
 */
function SceltaFase({ fase, onFase }) {
  return (
    <div className="flex flex-col gap-2">
      <p className={`${LABEL} px-1`}>Fase</p>
      <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Fase">
        {FASI_GYM.map(f => {
          const scelta = fase === f.id
          return (
            <button key={f.id} type="button" aria-pressed={scelta}
              onClick={() => { if (!scelta) { vibraScelta(); onFase(f.id) } }}
              className={`min-h-10 px-1 rounded-xl text-[12.5px] font-extrabold border transition
                ${scelta ? 'bg-gym text-black border-gym' : 'bg-white/[.06] border-white/[.1] text-[#c9ccd4] hover:border-white/25'}`}>
              {f.id === 'principale' ? 'Principale' : f.nome}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function CampoTesto({ etichetta, placeholder, valore, onChange }) {
  return (
    <label className={`block rounded-2xl px-4 py-2.5 ${VETRO}`}>
      <span className={`${LABEL} block`}>{etichetta}</span>
      <input value={valore} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        enterKeyHint="done" onKeyDown={chiudiTastieraSuInvio}
        className="mt-1 w-full bg-transparent text-[14.5px] font-semibold text-white placeholder-[#5b6070] focus:outline-none" />
    </label>
  )
}

/**
 * Le serie scritte una per una. La sigla in testa alla riga cambia tipo a ogni
 * tocco (normale → R → D → C), come nei diari da palestra: quattro bottoni per
 * riga non ci starebbero su un telefono.
 */
function TabellaSerie({ righe, aTempo, onRighe }) {
  const cambia = (i, campi) => onRighe(righe.map((r, k) => (k === i ? { ...r, ...campi } : r)))
  // Le serie di riscaldamento non contano: la «1» è la prima serie di lavoro.
  const numeri = righe.map((_, i) => righe.slice(0, i + 1).filter(r => r.tipo !== 'riscaldamento').length)
  return (
    <div className={`${CARD} px-3 py-2.5 flex flex-col gap-1`} data-tabella-serie>
      <div className="grid grid-cols-[44px_1fr_1fr_32px] gap-2 px-1 pb-1">
        <span className={LABEL}>Serie</span>
        <span className={LABEL}>{aTempo ? 'Durata' : 'Reps'}</span>
        <span className={LABEL}>Kg</span>
        <span />
      </div>
      {righe.map((r, i) => {
        const t = tipoSerie(r.tipo)
        return (
          <div key={i} className="grid grid-cols-[44px_1fr_1fr_32px] gap-2 items-center">
            <button type="button" aria-label={`Serie ${i + 1}: ${t.nome}. Tocca per cambiare tipo`}
              onClick={() => { vibraScelta(); cambia(i, { tipo: tipoSerieDopo(r.tipo) }) }}
              className={`h-10 rounded-xl text-[13.5px] font-black border transition
                ${t.sigla ? 'bg-gym/[.13] border-gym/40 text-gym' : 'bg-white/[.06] border-white/[.1] text-white'}`}>
              {t.sigla || numeri[i]}
            </button>
            <input aria-label={`Ripetizioni serie ${i + 1}`} inputMode="numeric" value={r.reps || ''}
              onChange={e => cambia(i, { reps: e.target.value })}
              onBlur={e => cambia(i, { reps: repsGym(e.target.value) })}
              placeholder="10"
              className="h-10 min-w-0 rounded-xl bg-[#111] border border-white/[.08] px-3 text-[15px] font-bold text-white text-center focus:outline-none focus:border-gym/60" />
            <input aria-label={`Carico serie ${i + 1}`} inputMode="decimal"
              value={String(r.kg || '').replace(/\s*kg$/i, '').replace('.', ',')}
              onChange={e => cambia(i, { kg: caricoGym(e.target.value) })}
              placeholder="—"
              className="h-10 min-w-0 rounded-xl bg-[#111] border border-white/[.08] px-3 text-[15px] font-bold text-white text-center focus:outline-none focus:border-gym/60" />
            <button type="button" aria-label={`Togli la serie ${i + 1}`} disabled={righe.length <= 1}
              onClick={() => onRighe(righe.filter((_, k) => k !== i))}
              className="h-10 flex items-center justify-center text-[#5b6070] hover:text-red-400 disabled:opacity-25">
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        )
      })}
      <button type="button" onClick={() => { vibraScelta(); onRighe([...righe, { ...(righe[righe.length - 1] || { tipo: 'normale', reps: '10', kg: '' }) }]) }}
        className="mt-1 min-h-10 rounded-xl text-[13px] font-extrabold text-gym flex items-center justify-center gap-1.5 hover:bg-gym/10">
        <Plus size={15} aria-hidden="true" /> Aggiungi serie
      </button>
      <p className="px-1 pt-1 text-[11.5px] leading-snug text-muted">
        Tocca il numero per cambiare tipo: R riscaldamento · D drop set · C a cedimento.
      </p>
    </div>
  )
}

// ── Il foglio di una superserie ──────────────────────────────────────────

export function FoglioGruppoGym({ gruppo, onGruppo, onFase, onChiudi }) {
  const [scheda, setScheda] = useState('serie')
  const misure = [
    { chiave: 'serie', etichetta: 'Giri', scala: 'serie', rapidi: ['2', '3', '4', '5'],
      valore: String(serieDi(gruppo)), onChange: (v) => onGruppo({ ...gruppo, serie: v }) },
    { chiave: 'recupero', etichetta: 'Recupero dopo il giro', scala: 'recupero', rapidi: ['1:00', '1:30', '2:00', '3:00'],
      valore: gruppo.recupero || '-', onChange: (v) => onGruppo({ ...gruppo, recupero: v === '-' ? '' : v }) },
  ]
  return (
    <Foglio titolo={NOME_TIPO_GRUPPO[tipoGruppo(gruppo)]} sottotitolo={gruppo.esercizi.map(e => e.name).join(' + ')} onChiudi={onChiudi}
      piede={(chiudi) => (
        <button type="button" onClick={chiudi} className={BOTTONE_FATTO}><Check size={19} aria-hidden="true" /> Fatto</button>
      )}>
      <div className="flex flex-col gap-3.5">
        <FoglioMisure misure={misure} attiva={scheda} onAttiva={setScheda} accento="gym" senzaCarta />
        {onFase && <SceltaFase fase={faseDi(gruppo)} onFase={onFase} />}
        <CampoTesto etichetta="Note della superserie" placeholder="Es. nessuna pausa fra A1 e A2"
          valore={gruppo.note || ''} onChange={(v) => onGruppo({ ...gruppo, note: v })} />
      </div>
    </Foglio>
  )
}
