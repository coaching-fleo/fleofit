// FoglioDaTesto — «Da un testo scritto»: il workout incollato dalle Note, da un
// messaggio, da una lavagna trascritta, diviso nei blocchi del builder.
//
// Senza IA (12/10/2026, fase 1): le regole stanno in src/lib/leggiWorkout.js,
// e qui si mostra soltanto quello che hanno capito, riga per riga, mentre si
// scrive. Il coach vede PRIMA di confermare cosa diventa blocco, cosa
// esercizio e cosa finisce nelle note — niente sparisce in silenzio.
//
// Si carica in modo pigro da `CreateWorkout`: il lettore non deve pesare sul
// chunk della pagina per chi non lo apre mai.
//
// Dalla fase 2 (12/10/2026) anche da una FOTO: l'OCR del telefono
// (src/lib/lettoreTesto.js, Apple Vision) scrive il testo nel campo, e da lì
// è lo stesso percorso. Il testo letto resta modificabile: l'OCR sbaglia, e
// correggere una parola qui costa meno che sistemare un blocco dopo.
//
// ⚠️ Il tasto indietro di Android trova la maniglia: è un bottone con
// `aria-label="Chiudi"` (src/lib/indietroAndroid.js).

import { useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ScanText, ArrowRight, StickyNote, CirclePlus, Check, Camera, Images } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { useBottomSheet } from '../useBottomSheet'
import { leggiHyrox, leggiCorsa } from '../lib/leggiWorkout'
import { CARD, LABEL, VETRO } from '../lib/stiliCard'
import { vibraSuccesso, vibraErrore } from '../lib/aptica'
import { fotoDisponibile, leggiFoto } from '../lib/lettoreTesto'
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

const ESEMPIO = {
  Hyrox: "Es:\nWarm up 10'\n500m row\nEMOM 12'\nmin 1: 15 cal ski\nmin 2: 12 burpees\n4 RFT\n1000m ski\n20 wall balls 9kg",
  Running: "Es:\nRiscaldamento 15' Z1\n6x400m @3:45 rec 1'\ndefaticamento 10'",
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
    : riga.esito === 'nuovo'
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
        {riga.esito !== 'nota' && <span className="block text-[11.5px] text-muted truncate">{riga.testo}</span>}
      </span>
    </li>
  )
}

/**
 * @param categoria  'Hyrox' | 'Running'
 * @param haGia      ci sono già blocchi/fasi nel builder: si sceglie se
 *                   aggiungere in coda o sostituire
 * @param onUsa      ({ blocchi | fasi, note, sostituisci }) — a foglio sceso
 */
export default function FoglioDaTesto({ categoria = 'Hyrox', haGia = false, onUsa, onClose }) {
  const [testo, setTesto] = useState('')
  // La foto: `null` a riposo, 'leggo' durante l'OCR, `{ errore }` o `{ letta }` dopo.
  const [foto, setFoto] = useState(null)
  const conFoto = useMemo(() => fotoDisponibile(), [])
  const inputFoto = useRef(null)
  const inputScatto = useRef(null)
  // ⚠️ Su Android la webview non offre la scelta «scatta o galleria» che iOS
  // mostra da sé: senza `capture` apre SOLO la galleria, con `capture` SOLO la
  // fotocamera (BridgeWebChromeClient di Capacitor). Quindi lì due bottoni.
  const dueBottoni = useMemo(() => Capacitor.getPlatform() === 'android', [])
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

  const daFoto = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setFoto('leggo')
    try {
      const { base64 } = await riduciImmagine(file, FOTO_OCR)
      const letto = await leggiFoto(base64)
      if (!letto.trim()) {
        vibraErrore()
        setFoto({ errore: 'Nella foto non ho trovato testo. Riprova più vicino, con più luce e il foglio dritto.' })
        return
      }
      // Si aggiunge in coda a quello che c'è: si può fotografare una lavagna
      // in due scatti, o completare a mano una foto letta a metà.
      setTesto(prima => (prima.trim() ? `${prima.trimEnd()}\n${letto}` : letto))
      setFoto({ letta: true })
    } catch (err) {
      console.error('Lettura foto:', err?.message)
      vibraErrore()
      setFoto({ errore: 'Non sono riuscito a leggere la foto. Riprova, o incolla il testo.' })
    }
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
      style={stileVelo} onClick={chiudi}>
      <div role="dialog" aria-label="Da un testo scritto" onClick={(e) => e.stopPropagation()}
        className={`bg-[#141416] border-t border-white/10 rounded-t-3xl px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]
                    flex flex-col max-h-[92dvh] overflow-y-auto overscroll-contain touch-auto
                    shadow-[0_-20px_50px_-12px_rgba(0,0,0,.85)] ${classeFoglio}`}
        style={stileFoglio}>

        <button type="button" aria-label="Chiudi" {...maniglia}
          className="w-full pt-3 pb-2.5 -mx-4 px-4 flex justify-center shrink-0 touch-none cursor-grab active:cursor-grabbing group">
          <span aria-hidden="true" className="w-10 h-1 rounded-full bg-white/20 group-hover:bg-white/35 group-active:bg-white/45 transition-colors" />
        </button>

        <div className="flex items-center gap-3 pb-4 shrink-0">
          <span aria-hidden="true" className={`w-11 h-11 rounded-[14px] flex items-center justify-center shrink-0 ${accento.pieno}`}>
            <ScanText size={21} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[16px] font-extrabold tracking-[-.015em] text-white">Da un testo scritto</p>
            <p className="mt-[2px] text-[12.5px] font-medium text-muted">
              {conFoto ? 'Fotografa il workout o incollalo' : 'Incolla il workout dalle Note o da un messaggio'}: lo divido in {corsa ? 'fasi' : 'blocchi'}
            </p>
          </div>
        </div>

        {conFoto && (
          <div className="pb-3 shrink-0">
            <input ref={inputFoto} type="file" accept="image/*" className="hidden" onChange={daFoto}
              aria-label="Foto del workout" />
            {dueBottoni && (
              <input ref={inputScatto} type="file" accept="image/*" capture="environment" className="hidden"
                onChange={daFoto} aria-label="Scatto del workout" />
            )}
            {foto === 'leggo' ? (
              <p role="status" className={`min-h-12 rounded-2xl ${VETRO} flex items-center justify-center text-white text-[14.5px] font-extrabold opacity-60`}>
                Leggo la foto…
              </p>
            ) : dueBottoni ? (
              <div className="grid grid-cols-2 gap-2.5">
                <button type="button" onClick={() => inputScatto.current?.click()}
                  className={`min-h-12 rounded-2xl ${VETRO} flex items-center justify-center gap-2 text-white
                              text-[14.5px] font-extrabold hover:border-white/25 transition active:scale-[.995]`}>
                  <Camera size={18} className={accento.testo} aria-hidden="true" /> Scatta una foto
                </button>
                <button type="button" onClick={() => inputFoto.current?.click()}
                  className={`min-h-12 rounded-2xl ${VETRO} flex items-center justify-center gap-2 text-white
                              text-[14.5px] font-extrabold hover:border-white/25 transition active:scale-[.995]`}>
                  <Images size={18} className={accento.testo} aria-hidden="true" /> Dalla galleria
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => inputFoto.current?.click()}
                className={`w-full min-h-12 rounded-2xl ${VETRO} flex items-center justify-center gap-2.5 text-white
                            text-[14.5px] font-extrabold hover:border-white/25 transition active:scale-[.995]`}>
                <Camera size={18} className={accento.testo} aria-hidden="true" /> Fotografa o scegli una foto
              </button>
            )}
            {foto?.errore && (
              <p role="alert" className="text-[12.5px] text-orange-400 leading-snug px-1 pt-2">{foto.errore}</p>
            )}
            {foto?.letta && (
              <p role="status" className="text-[12.5px] text-gray-400 leading-snug px-1 pt-2">
                Ho scritto qui sotto quello che ho letto: controlla e correggi prima di usarlo.
              </p>
            )}
          </div>
        )}

        <div className={`${CARD} p-3.5 shrink-0`}>
          <textarea
            aria-label="Il workout scritto"
            className="w-full bg-transparent text-white placeholder-gray-600 focus:outline-none resize-none
                       text-[15px] leading-relaxed min-h-[140px]"
            rows={6}
            placeholder={ESEMPIO[corsa ? 'Running' : 'Hyrox']}
            value={testo}
            onChange={e => setTesto(e.target.value)}
          />
        </div>

        {letto.righe.length > 0 && (
          <div className="pt-4 shrink-0">
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
          </div>
        )}

        <div className="pt-3.5 flex flex-col gap-2.5 shrink-0">
          <button type="button" onClick={() => usa(false)} disabled={pezzi.length === 0}
            className={`w-full min-h-[52px] rounded-2xl text-[16.5px] font-black tracking-[-.01em]
                        flex items-center justify-center gap-2.5 transition hover:brightness-110 active:scale-[.99]
                        disabled:opacity-40 ${accento.pieno}`}>
            {haGia ? 'Aggiungi in coda' : corsa ? 'Usa queste fasi' : 'Usa questi blocchi'} <ArrowRight size={19} aria-hidden="true" />
          </button>
          {haGia && pezzi.length > 0 && (
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
