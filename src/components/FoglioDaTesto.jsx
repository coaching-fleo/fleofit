// FoglioDaTesto — «Da un'immagine»: la foto o lo screenshot di un workout (una
// lavagna, le Note, un messaggio) diviso nei blocchi del builder.
//
// Senza IA (12/10/2026): il testo lo legge l'OCR del telefono
// (src/lib/lettoreTesto.js: Apple Vision su iOS, ML Kit su Android), le regole
// che lo dividono in blocchi stanno in src/lib/leggiWorkout.js. Qui si mostra
// quello che hanno capito, riga per riga: il coach vede PRIMA di confermare
// cosa diventa blocco, cosa esercizio e cosa finisce nelle note.
//
// ⚠️ Dal 12/10/2026 (richiesta del committente) si parte SOLO da un'immagine:
// il bottone del builder apre subito il selettore, e questo foglio si monta a
// immagine scelta (`file`). Il campo `<input type="file">` di partenza sta in
// `CreateWorkout` e non qui, per forza: questo foglio è PIGRO, e un tocco può
// aprire il selettore solo su un campo che esiste già nel momento del tocco.
// Il testo letto resta correggibile, ma chiuso: l'OCR sbaglia, e correggere
// una parola costa meno che sistemare un blocco dopo.
//
// ⚠️ Il tasto indietro di Android trova la maniglia: è un bottone con
// `aria-label="Chiudi"` (src/lib/indietroAndroid.js).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ScanText, ArrowRight, StickyNote, CirclePlus, Check, ImagePlus, ChevronDown } from 'lucide-react'
import { useBottomSheet } from '../useBottomSheet'
import { useTastieraAperta, useTastieraCheCopre } from '../useTastiera'
import { leggiHyrox, leggiCorsa } from '../lib/leggiWorkout'
import { CARD, LABEL, VETRO } from '../lib/stiliCard'
import { vibraSuccesso, vibraErrore } from '../lib/aptica'
import { leggiFoto } from '../lib/lettoreTesto'
import { riduciImmagine } from '../lib/immagineRidotta'

// La foto per l'OCR: più grande e più nitida di quella di una segnalazione,
// o la scritta di una lavagna fotografata da lontano diventa illeggibile.
const FOTO_OCR = { max: 2400, qualita: 0.9 }

// Le classi per categoria scritte per intero: Tailwind non vede le classi
// composte a runtime (`bg-${colore}`).
const ACCENTI = {
  Hyrox: { pieno: 'bg-brand text-black', testo: 'text-brand', bordo: 'border-brand/30', velo: 'bg-brand/10' },
  Running: { pieno: 'bg-running text-white', testo: 'text-running', bordo: 'border-running/30', velo: 'bg-running/10' },
}

const plurale = (n, uno, tanti) => `${n} ${n === 1 ? uno : tanti}`

/** Una riga del testo, con quello che il lettore ne ha fatto. */
function RigaLetta({ riga, accento }) {
  if (riga.esito === 'blocco') {
    return (
      <li className="flex items-center gap-2 pt-2 first:pt-0">
        <span className={`rounded-full border px-2 py-[1px] text-[11.5px] font-extrabold ${accento.testo} ${accento.bordo} ${accento.velo}`}>
          {riga.tipo}
        </span>
        <span className="text-[12.5px] text-muted truncate">{riga.testo}</span>
      </li>
    )
  }
  const icona = riga.esito === 'nota'
    ? <StickyNote size={14} className="text-orange-400 shrink-0 mt-[2px]" aria-hidden="true" />
    : riga.esito === 'nuovo' || riga.esito === 'dedotto'
      ? <CirclePlus size={14} className={`${accento.testo} shrink-0 mt-[2px]`} aria-hidden="true" />
      : <Check size={14} className="text-gray-400 shrink-0 mt-[2px]" aria-hidden="true" />
  return (
    <li className="flex items-start gap-2 pl-1">
      {icona}
      <span className="min-w-0 text-[13px] leading-snug">
        <span className={riga.esito === 'nota' ? 'text-gray-400' : 'text-white font-semibold'}>
          {riga.esito === 'nota' ? riga.testo : riga.nome}
        </span>
        {riga.esito === 'nota' && <span className="text-orange-400/90"> · nelle note</span>}
        {riga.esito === 'nuovo' && <span className={accento.testo}> · esercizio nuovo</span>}
        {riga.esito === 'dedotto' && <span className={accento.testo}> · dedotto dalle righe sopra</span>}
        {riga.esito !== 'nota' && <span className="block text-[11.5px] text-muted truncate">{riga.testo}</span>}
      </span>
    </li>
  )
}

/**
 * @param categoria  'Hyrox' | 'Running'
 * @param file       l'immagine scelta nel builder: si legge appena il foglio si monta
 * @param haGia      ci sono già blocchi/fasi nel builder: si sceglie se
 *                   aggiungere in coda o sostituire
 * @param onUsa      ({ blocchi | fasi, note, sostituisci }) — a foglio sceso
 */
export default function FoglioDaTesto({ categoria = 'Hyrox', file, haGia = false, onUsa, onClose }) {
  const [testo, setTesto] = useState('')
  // La lettura: 'leggo' durante l'OCR, `{ errore }` se non è andata, `null` fatta.
  const [stato, setStato] = useState(file ? 'leggo' : null)
  const [correggi, setCorreggi] = useState(false)
  const inputAltra = useRef(null)
  const campoTesto = useRef(null)
  // 🔴 «Correggi il testo letto» apriva la tastiera SOPRA il campo (segnalato
  // dal committente il 12/10/2026). Il foglio si solleva di quanta tastiera
  // copre ancora la pagina, e il campo torna sotto gli occhi quando la
  // tastiera ha finito di salire: prima, lo spazio dove portarlo non c'è.
  const tastieraAperta = useTastieraAperta()
  const copre = useTastieraCheCopre()
  // ⚠️ Il campo si porta in vista scorrendo il FOGLIO a mano. Visto sul simulatore (12/10/2026):
  // su iOS la webview passa da 874 a 546 punti DOPO `keyboardWillShow`, e uno
  // `scrollIntoView({ behavior: 'smooth' })` partito prima si interrompe a metà
  // — il foglio restava a 198 punti di scorrimento su 500, col campo sotto la
  // tastiera. Qui si scrive `scrollTop` direttamente, e si ripete.
  const portaInVista = useCallback(() => {
    const campo = campoTesto.current
    if (!campo || document.activeElement !== campo) return
    const foglio = campo.closest('[role="dialog"]')
    if (!foglio) return
    const r = campo.getBoundingClientRect()
    const f = foglio.getBoundingClientRect()
    const margine = 16
    // Il fondo del campo sopra il fondo del foglio; se il campo è più alto
    // dello spazio, vince la sua cima: si legge da dove comincia.
    let sposta = r.bottom - (f.bottom - margine)
    if (r.top - sposta < f.top + margine) sposta = r.top - (f.top + margine)
    if (sposta > 0) foglio.scrollTop += sposta
  }, [])
  useEffect(() => {
    const vv = window.visualViewport
    window.addEventListener('resize', portaInVista)
    vv?.addEventListener?.('resize', portaInVista)
    return () => {
      window.removeEventListener('resize', portaInVista)
      vv?.removeEventListener?.('resize', portaInVista)
    }
  }, [portaInVista])
  // 🔴 E soprattutto a tastiera salita, ricontrollando per poco più di un
  // secondo: nella webview di Capacitor l'evento `resize` NON arriva quando la
  // webview si rimpicciolisce (misurato sul simulatore), e la nuova misura si
  // assesta in un momento che non si può prevedere. Un tentativo a tempo fisso
  // cadeva con la finestra ancora intera e scorreva di pochi punti. Su Android
  // il segnale è il foglio che si solleva (`copre`).
  useEffect(() => {
    if (!tastieraAperta) return
    let volte = 0
    const giro = setInterval(() => {
      portaInVista()
      if (++volte >= 12) clearInterval(giro)
    }, 100)
    return () => clearInterval(giro)
  }, [tastieraAperta, copre, portaInVista])
  // ⚠️ Un ref e non uno stato: `chiudi` chiama questa funzione a uscita
  // finita, con la chiusura catturata quando è partita — uno stato appena
  // scritto lì sarebbe ancora `null`.
  const scelta = useRef(null)
  const { chiudi, maniglia, stileFoglio, stileVelo, classeFoglio, classeVelo } = useBottomSheet(() => {
    if (scelta.current) onUsa(scelta.current)
    onClose()
  })

  const corsa = categoria === 'Running'
  const accento = ACCENTI[corsa ? 'Running' : 'Hyrox']
  const letto = useMemo(() => (corsa ? leggiCorsa(testo) : leggiHyrox(testo)), [testo, corsa])
  const pezzi = corsa ? letto.fasi : letto.blocchi
  const esercizi = corsa ? 0 : letto.blocchi.reduce((n, b) => n + b.exercises.length, 0)
  const nelleNote = letto.righe.filter(r => r.esito === 'nota').length

  /** Legge un'immagine e ne mette il testo IN CODA: una lavagna si fotografa anche in due scatti. */
  const leggi = useCallback(async (immagine) => {
    setStato('leggo')
    try {
      const { base64 } = await riduciImmagine(immagine, FOTO_OCR)
      const trovato = await leggiFoto(base64)
      if (!trovato.trim()) {
        vibraErrore()
        setStato({ errore: 'Nell\'immagine non ho trovato testo. Riprova più vicino, con più luce e il foglio dritto.' })
        return
      }
      setTesto(prima => (prima.trim() ? `${prima.trimEnd()}\n${trovato}` : trovato))
      setStato(null)
    } catch (err) {
      console.error('Lettura immagine:', err?.message)
      vibraErrore()
      setStato({ errore: 'Non sono riuscito a leggere l\'immagine. Riprova con un\'altra.' })
    }
  }, [])

  // L'immagine scelta nel builder, una volta sola.
  const iniziale = useRef(file)
  useEffect(() => {
    if (iniziale.current) leggi(iniziale.current)
  }, [leggi])

  const daAltra = (e) => {
    const altra = e.target.files?.[0]
    e.target.value = ''
    if (altra) leggi(altra)
  }

  const usa = (sostituisci) => {
    vibraSuccesso()
    scelta.current = ({ ...(corsa ? { fasi: letto.fasi } : { blocchi: letto.blocchi }), note: letto.note, sostituisci })
    chiudi()
  }

  const riepilogo = [
    corsa ? plurale(pezzi.length, 'fase', 'fasi') : plurale(pezzi.length, 'blocco', 'blocchi'),
    !corsa && plurale(esercizi, 'esercizio', 'esercizi'),
    nelleNote > 0 && `${plurale(nelleNote, 'riga', 'righe')} nelle note`,
  ].filter(Boolean).join(' · ')

  return createPortal(
    <div className={`fixed inset-0 z-[60] flex flex-col justify-end bg-black/85 touch-none ${classeVelo}`}
      style={{ ...stileVelo, paddingBottom: copre || undefined }} onClick={chiudi}>
      <div role="dialog" aria-label="Da un'immagine" onClick={(e) => e.stopPropagation()}
        className={`bg-[#141416] border-t border-white/10 rounded-t-3xl px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]
                    flex flex-col max-h-[92dvh] overflow-y-auto overscroll-contain touch-auto
                    shadow-[0_-20px_50px_-12px_rgba(0,0,0,.85)] ${classeFoglio}`}
        style={{ ...stileFoglio, ...(copre ? { maxHeight: `calc(92dvh - ${copre}px)` } : {}) }}>

        <button type="button" aria-label="Chiudi" {...maniglia}
          className="w-full pt-3 pb-2.5 -mx-4 px-4 flex justify-center shrink-0 touch-none cursor-grab active:cursor-grabbing group">
          <span aria-hidden="true" className="w-10 h-1 rounded-full bg-white/20 group-hover:bg-white/35 group-active:bg-white/45 transition-colors" />
        </button>

        <div className="flex items-center gap-3 pb-4 shrink-0">
          <span aria-hidden="true" className={`w-11 h-11 rounded-[14px] flex items-center justify-center shrink-0 ${accento.pieno}`}>
            <ScanText size={21} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[16px] font-extrabold tracking-[-.015em] text-white">Da un'immagine</p>
            <p className="mt-[2px] text-[12.5px] font-medium text-muted">
              Leggo il workout e lo divido in {corsa ? 'fasi' : 'blocchi'}
            </p>
          </div>
        </div>

        <input ref={inputAltra} type="file" accept="image/*" className="hidden" onChange={daAltra}
          aria-label="Un'altra immagine" />

        {stato === 'leggo' && (
          <p role="status" className={`${CARD} px-4 py-6 text-center text-white text-[15px] font-extrabold shrink-0`}>
            Leggo l'immagine…
          </p>
        )}

        {stato?.errore && (
          <div className="shrink-0">
            <p role="alert" className="text-[13px] text-orange-400 leading-snug px-1 pb-3">{stato.errore}</p>
          </div>
        )}

        {stato !== 'leggo' && letto.righe.length > 0 && (
          <div className="shrink-0">
            <div className="flex items-baseline justify-between gap-2 px-1 pb-2">
              <span className={`${LABEL} shrink-0`}>Cosa ho capito</span>
              <span className="text-[12px] font-semibold text-gray-400 text-right" role="status">{riepilogo}</span>
            </div>
            <ul className={`${CARD} px-3.5 py-3 flex flex-col gap-1.5`}>
              {letto.righe.map((r, i) => <RigaLetta key={i} riga={r} accento={accento} />)}
            </ul>
            <p className="text-[12px] text-muted leading-snug px-1 pt-2.5">
              {corsa
                ? 'I numeri che non hai scritto restano da mettere: li vedi nella fase.'
                : 'I numeri che non hai scritto restano da mettere: li vedi nel blocco.'}
              {nelleNote > 0 && ' Le righe che non capisco finiscono nelle note, non si perdono.'}
            </p>

            {/* Il testo letto, chiuso: si apre solo per correggere un errore dell'OCR. */}
            <button type="button" onClick={() => setCorreggi(c => !c)} aria-expanded={correggi}
              className="mt-3 w-full flex items-center justify-between px-1 py-1.5 text-[13px] font-bold text-gray-300 hover:text-white transition">
              Correggi il testo letto
              <ChevronDown size={16} aria-hidden="true" className={`transition-transform ${correggi ? 'rotate-180' : ''}`} />
            </button>
            {correggi && (
              <div className={`${CARD} p-3.5 mt-1`}>
                <textarea
                  ref={campoTesto}
                  aria-label="Il testo letto"
                  className="w-full bg-transparent text-white focus:outline-none resize-none text-[15px] leading-relaxed min-h-[140px]"
                  rows={6}
                  value={testo}
                  onChange={e => setTesto(e.target.value)}
                />
              </div>
            )}
          </div>
        )}

        {stato !== 'leggo' && (
          <button type="button" onClick={() => inputAltra.current?.click()}
            className={`mt-3 w-full min-h-12 rounded-2xl ${VETRO} flex items-center justify-center gap-2.5 text-white
                        text-[14.5px] font-extrabold hover:border-white/25 transition active:scale-[.995] shrink-0`}>
            <ImagePlus size={18} className={accento.testo} aria-hidden="true" />
            {testo.trim() ? 'Aggiungi un\'altra immagine' : 'Scegli un\'altra immagine'}
          </button>
        )}

        <div className="pt-3.5 flex flex-col gap-2.5 shrink-0">
          <button type="button" onClick={() => usa(false)} disabled={pezzi.length === 0 || stato === 'leggo'}
            className={`w-full min-h-[52px] rounded-2xl text-[16.5px] font-black tracking-[-.01em]
                        flex items-center justify-center gap-2.5 transition hover:brightness-110 active:scale-[.99]
                        disabled:opacity-40 ${accento.pieno}`}>
            {haGia ? 'Aggiungi in coda' : corsa ? 'Usa queste fasi' : 'Usa questi blocchi'} <ArrowRight size={19} aria-hidden="true" />
          </button>
          {haGia && pezzi.length > 0 && stato !== 'leggo' && (
            <button type="button" onClick={() => usa(true)}
              className={`w-full min-h-12 rounded-2xl ${VETRO} text-white text-[14.5px] font-extrabold
                          hover:border-white/25 transition active:scale-[.995]`}>
              Sostituisci {corsa ? 'le fasi' : 'i blocchi'} che ci sono
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
