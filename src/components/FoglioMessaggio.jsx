// FoglioMessaggio.jsx — «Messaggio a tutti»: il coach scrive, invia, corregge
// (15/10/2026). E il menu di un messaggio già mandato (Fissa · Modifica · Elimina).
//
// Il viaggio di un invio (spec, «Il viaggio»):
//   1. `insert` in `messaggi_coach` — da qui il messaggio è in bacheca;
//   2. `send-reminders` con `{ mode: 'broadcast', record_id }`, che manda le push.
// Se il passo 2 fallisce il foglio resta aperto con «Riprova», che rifà SOLO il
// passo 2 con lo stesso id: la funzione salta chi l'ha già ricevuta.
//
// ⚠️ Mentre una chiamata è in volo Invia e Riprova sono spenti, e il ref lo
// garantisce anche per due tocchi nello stesso fotogramma: due chiamate
// parallele passerebbero entrambe il controllo dei doppioni lato server.
// ⚠️ Si salva `testo.trim()`: il check del database è su `btrim`, e 2.000
// caratteri più due a capo finali verrebbero rifiutati.
// ⚠️ In modifica (`iniziale`) niente push e niente bozza: la bozza è di chi
// scrive un messaggio NUOVO, e una correzione non deve sovrascriverla.
// ⚠️ La X ha aria-label «Chiudi» e il menu un «Annulla»: è così che il tasto
// indietro di Android li trova (src/lib/indietroAndroid.js). La conferma vive
// nel SUO portale, sopra il foglio.

import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Pin, PinOff, Pencil, Trash2 } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { useBottomSheet } from '../useBottomSheet'
import { CustomConfirm } from './CustomModals'
import { leggiJson, scriviJson } from '../lib/offlineQueue'
import { vibraScelta, vibraSuccesso, vibraErrore } from '../lib/aptica'
import { VETRO } from '../lib/stiliCard'
import { testoValido, MAX_CARATTERI, CHIAVE_BOZZA } from '../lib/messaggiCoach'

const atleti = (n) => `${n} ${n === 1 ? 'atleta' : 'atleti'}`

function bozzaIniziale() {
  const b = leggiJson(CHIAVE_BOZZA, null)
  return {
    testo: typeof b?.testo === 'string' ? b.testo : '',
    fissato: b?.fissato === true,
  }
}

function cancellaBozza() {
  try { localStorage.removeItem(CHIAVE_BOZZA) } catch { /* niente da fare */ }
}

/** Il guscio comune dei due fogli: velo, maniglia, testata con la X. */
function Foglio({ titolo, chiudi, maniglia, stileFoglio, stileVelo, classeFoglio, classeVelo, children }) {
  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col justify-end">
      <div aria-hidden="true" onClick={chiudi} className={`absolute inset-0 bg-black/85 ${classeVelo}`} style={stileVelo} />
      <div role="dialog" aria-modal="true" aria-label={titolo}
        className={`relative w-full max-w-2xl mx-auto bg-[#1e1e1e] border-t border-[#2a2a2a] rounded-t-3xl px-4
                    pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-20px_50px_-12px_rgba(0,0,0,.85)] ${classeFoglio}`}
        style={stileFoglio}>
        <button type="button" aria-label="Trascina giù per chiudere" {...maniglia}
          className="w-full pt-3 pb-2.5 flex justify-center touch-none cursor-grab group">
          <span aria-hidden="true" className="w-10 h-1 rounded-full bg-white/20 group-hover:bg-white/35" />
        </button>
        <div className="flex items-center gap-3 pb-3">
          <p className="flex-1 min-w-0 text-[17px] font-extrabold tracking-[-.015em] text-white truncate">{titolo}</p>
          <button type="button" aria-label="Chiudi" onClick={chiudi}
            className={`shrink-0 w-10 h-10 rounded-full ${VETRO} flex items-center justify-center text-gray-200 hover:text-white transition`}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  )
}

const CTA = 'w-full min-h-[52px] rounded-2xl bg-brand text-black text-[16px] font-black hover:brightness-110 ' +
  'active:scale-[.99] transition disabled:opacity-40 disabled:pointer-events-none'

/**
 * @param numeroAtleti  null finché non è letto: allora la riga non compare.
 * @param demo          l'account di prova: Invia spento (il blocco vero è nel database).
 * @param iniziale      il messaggio da correggere; assente = messaggio nuovo.
 * @param onInviato     (riga) => void — la riga nuova o corretta, per la bacheca.
 *                      In modifica arriva DUE volte se il salvataggio fallisce:
 *                      prima la correzione (ottimismo), poi `iniziale` (rollback).
 */
export default function FoglioMessaggio({ aperto, ...resto }) {
  if (!aperto) return null
  return <Contenuto {...resto} />
}

function Contenuto({ onChiudi, numeroAtleti = null, demo = false, iniziale = null, onInviato }) {
  const sheet = useBottomSheet(onChiudi)
  const modifica = !!iniziale
  const [testo, setTesto] = useState(() => (modifica ? iniziale.testo : bozzaIniziale().testo))
  const [fissato, setFissato] = useState(() => (modifica ? !!iniziale.fissato : bozzaIniziale().fissato))
  const [conferma, setConferma] = useState(null)
  const [inVolo, setInVolo] = useState(false)
  const [errore, setErrore] = useState(null)
  const [daRiprovare, setDaRiprovare] = useState(null) // id del messaggio già in bacheca
  const inVoloRef = useRef(false)

  const lunghezza = testo.trim().length
  const troppo = lunghezza > MAX_CARATTERI
  const valido = testoValido(testo)

  const salvaBozza = (b) => { if (!modifica) scriviJson(CHIAVE_BOZZA, b) }
  const cambiaTesto = (t) => { setTesto(t); setErrore(null); salvaBozza({ testo: t, fissato }) }
  const cambiaFissato = () => { vibraScelta(); setFissato(!fissato); salvaBozza({ testo, fissato: !fissato }) }

  /** Una sola chiamata alla volta: il ref chiude anche i tocchi nello stesso fotogramma. */
  const inEsclusiva = async (lavoro) => {
    if (inVoloRef.current) return
    inVoloRef.current = true
    setInVolo(true)
    try { await lavoro() } finally { inVoloRef.current = false; setInVolo(false) }
  }

  const mandaPush = async (id) => {
    let fallita
    try {
      const { data, error } = await supabase.functions.invoke('send-reminders', { body: { mode: 'broadcast', record_id: id } })
      fallita = !!error || data?.success === false
    } catch {
      fallita = true
    }
    if (fallita) { vibraErrore(); setDaRiprovare(id); return }
    vibraSuccesso()
    sheet.chiudi()
  }

  const inviaDavvero = () => inEsclusiva(async () => {
    setErrore(null)
    const { data: riga, error } = await supabase.from('messaggi_coach')
      .insert({ testo: testo.trim(), fissato }).select().single()
    if (error || !riga) {
      vibraErrore()
      setErrore('Messaggio non salvato. Controlla la connessione e riprova.')
      return
    }
    cancellaBozza()
    onInviato?.(riga)
    await mandaPush(riga.id)
  })

  const riprova = () => inEsclusiva(() => mandaPush(daRiprovare))

  const salvaModifica = () => inEsclusiva(async () => {
    const nuovo = testo.trim()
    if (nuovo === iniziale.testo) { sheet.chiudi(); return }
    setErrore(null)
    const valori = { testo: nuovo, modificato_at: new Date().toISOString() }
    onInviato?.({ ...iniziale, ...valori })
    const { error } = await supabase.from('messaggi_coach').update(valori).eq('id', iniziale.id)
    if (error) {
      onInviato?.(iniziale)
      vibraErrore()
      setErrore('Modifica non salvata. Controlla la connessione e riprova.')
      return
    }
    vibraSuccesso()
    sheet.chiudi()
  })

  const chiediConferma = () => {
    if (!valido || demo || inVolo) return
    setConferma({
      title: numeroAtleti == null ? 'Mandarlo a tutti gli atleti?' : `Mandare a ${atleti(numeroAtleti)}?`,
      message: 'Ognuno riceverà una notifica.',
      confirmLabel: 'Manda',
      onConfirm: inviaDavvero,
    })
  }

  return (
    <Foglio titolo={modifica ? 'Modifica messaggio' : 'Messaggio a tutti'} {...sheet}>
      {daRiprovare ? (
        <div className="flex flex-col gap-3 pb-1">
          <p className="text-sm text-gray-200">Il messaggio è in bacheca, ma la notifica non è partita</p>
          <button type="button" onClick={riprova} disabled={inVolo} className={CTA}>
            {inVolo ? 'Riprovo…' : 'Riprova'}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <textarea
            aria-label="Testo del messaggio"
            value={testo}
            onChange={e => cambiaTesto(e.target.value)}
            rows={6}
            autoFocus
            placeholder="Scrivi a tutti gli atleti…"
            className="w-full bg-[#111] border border-[#333] rounded-xl p-3 text-[15px] text-white placeholder:text-gray-600
                       resize-none focus:outline-none focus:border-brand"
          />
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">{!modifica && numeroAtleti != null && `Arriverà a ${atleti(numeroAtleti)}`}</span>
            <span data-testid="contatore" data-errore={troppo ? 'true' : 'false'}
              className={`tabular-nums ${troppo ? 'text-red-500 font-bold' : 'text-gray-500'}`}>
              {lunghezza}/{MAX_CARATTERI}
            </span>
          </div>
          {!modifica && (
            <button type="button" role="switch" aria-checked={fissato} onClick={cambiaFissato}
              className="flex items-center justify-between gap-3 bg-[#222] border border-[#333] rounded-2xl px-4 py-3 text-left">
              <span className="text-sm font-bold text-white">Fissa in cima</span>
              <span aria-hidden="true" className={`relative w-11 h-6 rounded-full transition-colors ${fissato ? 'bg-brand' : 'bg-[#444]'}`}>
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-300 ease-out ${fissato ? 'translate-x-5' : ''}`} />
              </span>
            </button>
          )}
          {demo && !modifica && <p className="text-xs text-gray-400">Nell'account di prova i messaggi non partono</p>}
          {errore && <p role="alert" className="text-xs text-red-500">{errore}</p>}
          {modifica ? (
            <button type="button" onClick={salvaModifica} disabled={!valido || inVolo} className={CTA}>
              {inVolo ? 'Salvo…' : 'Salva'}
            </button>
          ) : (
            <button type="button" onClick={chiediConferma} disabled={!valido || demo || inVolo} className={CTA}>
              {inVolo ? 'Invio…' : 'Invia'}
            </button>
          )}
        </div>
      )}
      {createPortal(<CustomConfirm info={conferma} onClose={() => setConferma(null)} />, document.body)}
    </Foglio>
  )
}

/**
 * Il menu di un messaggio. `onChiudi(scelta)` arriva a uscita FINITA, con
 * 'fissa' | 'modifica' | 'elimina' | null: un foglio che si apre mentre questo
 * sta ancora uscendo si troverebbe lo scorrimento della pagina già bloccato, e
 * alla fine lo lascerebbe bloccato per sempre (useScorrimentoBloccato).
 */
export function MenuMessaggio({ messaggio, onChiudi }) {
  const scelta = useRef(null)
  const sheet = useBottomSheet(() => onChiudi(scelta.current))
  const scegli = (s) => { scelta.current = s; sheet.chiudi() }
  const voce = 'w-full min-h-[52px] flex items-center gap-3 px-4 rounded-2xl bg-[#222] border border-[#333] text-left text-[15px] font-bold transition hover:border-[#444]'
  return (
    <Foglio titolo="Messaggio" {...sheet}>
      <div className="flex flex-col gap-2">
        <button type="button" onClick={() => scegli('fissa')} className={`${voce} text-white`}>
          {messaggio.fissato ? <PinOff size={18} aria-hidden="true" /> : <Pin size={18} aria-hidden="true" />}
          {messaggio.fissato ? 'Togli dai fissati' : 'Fissa'}
        </button>
        <button type="button" onClick={() => scegli('modifica')} className={`${voce} text-white`}>
          <Pencil size={18} aria-hidden="true" />Modifica
        </button>
        <button type="button" onClick={() => scegli('elimina')} className={`${voce} text-red-500`}>
          <Trash2 size={18} aria-hidden="true" />Elimina
        </button>
        <button type="button" onClick={sheet.chiudi} className="w-full min-h-[48px] text-[15px] font-bold text-gray-400 hover:text-white">
          Annulla
        </button>
      </div>
    </Foglio>
  )
}
