// FoglioSegnalazione — «Segnala un problema», in tre passi a schermo intero.
//
// Stesso patto degli altri *UI: qui non entra né `supabase` né un permesso
// push. La schermata raccoglie e mostra; chi spedisce è `onInvia`, che arriva
// da `Settings`. Cosa si chiede e cosa parte lo decide `src/lib/segnalazione.js`.
//
// Dal 08/10/2026 è a SCHERMO INTERO e non più un foglio dal basso (decisione
// del committente): niente maniglia, niente velo che chiude al tocco. Si esce
// solo da «Annulla», che chiede sempre conferma, o da «Chiudi» dopo l'invio.
//
// ⚠️ Il tasto indietro di Android (src/lib/indietroAndroid.js) cerca nel TESTO
// dei bottoni le parole «Indietro», «Annulla», «Chiudi», «No», nell'ordine in
// cui stanno in pagina. Per questo «Indietro» porta la parola scritta (non solo
// un'icona con aria-label) e sta PRIMA di «Annulla»: ai passi 2-3 il tasto
// torna di un passo, al passo 1 apre la conferma. E la conferma vive nel SUO
// portale, sopra questo: se stesse dentro, il tasto troverebbe prima il nostro
// «Indietro» di quello della conferma.

import { useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  Bug, Snail, BellOff, Timer, KeyRound, Lightbulb, ChevronLeft, ChevronRight, X, ImagePlus, Send, Check,
} from 'lucide-react'
import { useScorrimentoBloccato } from '../useBottomSheet'
import { CustomConfirm } from './CustomModals'
import { vibraScelta, vibraSuccesso, vibraErrore } from '../lib/aptica'
import { leggiJson, scriviJson } from '../lib/offlineQueue'
import { LABEL, VETRO } from '../lib/stiliCard'
import {
  CHIAVE_BOZZA, LIMITI, TIPI, bozzaVuota, corpoRichiesta, domandePer, validaSegnalazione,
} from '../lib/segnalazione'
import { riduciImmagine } from '../lib/immagineRidotta'

const ICONE = { Bug, Snail, BellOff, Timer, KeyRound, Lightbulb }

/** Una bozza letta da localStorage può essere qualunque cosa: si tiene solo ciò che ha la forma giusta. */
function bozzaIniziale() {
  const letta = leggiJson(CHIAVE_BOZZA, null)
  const vuota = bozzaVuota()
  if (!letta || typeof letta !== 'object') return vuota
  return {
    tipo: TIPI.some(t => t.id === letta.tipo) ? letta.tipo : null,
    risposte: letta.risposte && typeof letta.risposte === 'object' ? letta.risposte : {},
    descrizione: typeof letta.descrizione === 'string' ? letta.descrizione : '',
  }
}

function cancellaBozza() {
  try { localStorage.removeItem(CHIAVE_BOZZA) } catch { /* niente da fare */ }
}

/** Online/offline, ascoltato: la rete può tornare mentre il foglio è aperto. */
function useInLinea() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false))
  useEffect(() => {
    const su = () => setOnline(true)
    const giu = () => setOnline(false)
    window.addEventListener('online', su)
    window.addEventListener('offline', giu)
    return () => { window.removeEventListener('online', su); window.removeEventListener('offline', giu) }
  }, [])
  return online
}

export default function FoglioSegnalazione({ onChiudi, onInvia, tecnici = [], notificheSpente = false, onAttivaNotifiche }) {
  useScorrimentoBloccato()
  const [conferma, setConferma] = useState(null)
  const [bozza, setBozza] = useState(bozzaIniziale)
  const [passo, setPassoGrezzo] = useState(() => (bozza.tipo ? 2 : 1))
  // Il verso dell'ultimo cambio di passo: decide da che parte entra il nuovo.
  // `null` all'apertura, perché lì entra già tutta la schermata dal basso.
  const [verso, setVerso] = useState(null)
  const [immagini, setImmagini] = useState([])
  const [inviando, setInviando] = useState(false)
  const [errore, setErrore] = useState(null)
  const [erroreImmagine, setErroreImmagine] = useState(null)
  const inviandoRef = useRef(false)
  const fileRef = useRef(null)
  const online = useInLinea()

  /** Ogni cambio di passo dice il suo verso: avanti entra da destra, indietro da sinistra. */
  const setPasso = (nuovo, versoNuovo = 'avanti') => {
    setVerso(versoNuovo)
    setPassoGrezzo(nuovo)
  }

  const tipo = TIPI.find(t => t.id === bozza.tipo)
  const domande = domandePer(bozza.tipo)
  const valida = validaSegnalazione({ ...bozza, immagini })
  const lunghezza = bozza.descrizione.trim().length

  /** Ogni modifica finisce subito nella bozza: chi chiude a metà ritrova il testo. */
  const aggiorna = (modifica) => {
    setBozza(prima => {
      const dopo = { ...prima, ...modifica }
      scriviJson(CHIAVE_BOZZA, dopo)
      return dopo
    })
  }

  const indietro = () => {
    setErrore(null)
    setPasso(passo - 1, 'indietro')
  }

  /** Si chiede SEMPRE (committente, 08/10/2026): confermare butta la bozza. */
  const chiediAnnulla = () => setConferma({
    title: 'Vuoi annullare la segnalazione?',
    message: 'Quello che hai scritto andrà perso.',
    cancelLabel: 'No',
    confirmLabel: 'Sì, annulla',
    onConfirm: () => { cancellaBozza(); onChiudi() },
  })

  const scegliTipo = (id) => {
    vibraScelta()
    // Cambiando tipo, le risposte del tipo di prima non valgono più.
    aggiorna(id === bozza.tipo ? {} : { tipo: id, risposte: {} })
    setPasso(2)
  }

  const scegliRisposta = (idDomanda, opzione) => {
    vibraScelta()
    aggiorna({ risposte: { ...bozza.risposte, [idDomanda]: opzione } })
  }

  const aggiungiImmagini = async (e) => {
    const file = [...(e.target.files || [])].slice(0, LIMITI.immaginiMax - immagini.length)
    e.target.value = ''
    setErroreImmagine(null)
    for (const f of file) {
      try {
        const ridotta = await riduciImmagine(f)
        setImmagini(prima => (prima.length >= LIMITI.immaginiMax ? prima : [...prima, ridotta]))
      } catch (err) {
        console.error('Screenshot non letto:', err)
        setErroreImmagine('Uno screenshot non si è potuto leggere')
      }
    }
  }

  const invia = async () => {
    // Il ref, non solo lo stato: due tocchi nello stesso fotogramma vedono
    // entrambi `inviando === false`, e partirebbero due mail.
    if (inviandoRef.current || !valida.ok) return
    inviandoRef.current = true
    setInviando(true)
    setErrore(null)
    try {
      await onInvia(corpoRichiesta({ ...bozza, tecnici, immagini }))
      vibraSuccesso()
      cancellaBozza()
      setPasso('fatto')
    } catch (err) {
      vibraErrore()
      setErrore(err?.message || 'Invio non riuscito. Riprova tra poco.')
    } finally {
      inviandoRef.current = false
      setInviando(false)
    }
  }

  const aMetà = passo === 2 || passo === 3
  const titolo = passo === 1 ? 'Segnala un problema'
    : passo === 2 ? tipo?.titolo
      : passo === 3 ? 'Controlla e invia' : null

  const comandoTesta = `h-10 px-3.5 rounded-full flex items-center gap-1 text-[14px] font-bold text-gray-200
                        hover:text-white transition shrink-0 ${VETRO}`

  return createPortal(
    <>
    <div role="dialog" aria-modal="true" aria-label="Segnala un problema"
      className="fixed inset-0 z-[100] bg-[#0B0B0B] flex flex-col sheet-in
                 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-[calc(env(safe-area-inset-bottom)+1rem)]">
      <div className="w-full max-w-2xl mx-auto px-4 flex flex-col flex-1 min-h-0">

        {/* La barra: «Indietro» a sinistra (passi 2-3), l'uscita a destra.
            ⚠️ «Indietro» PRIMA di «Annulla» nel DOM: vedi in testa al file. */}
        <div className="flex items-center justify-between gap-3 shrink-0 h-10">
          {aMetà ? (
            <button type="button" onClick={indietro} className={`${comandoTesta} pl-2.5`}>
              <ChevronLeft size={18} aria-hidden="true" />Indietro
            </button>
          ) : <span aria-hidden="true" />}
          {passo === 'fatto' ? (
            <button type="button" onClick={onChiudi} className={comandoTesta}>
              <X size={16} aria-hidden="true" />Chiudi
            </button>
          ) : (
            <button type="button" onClick={chiediAnnulla} className={comandoTesta}>Annulla</button>
          )}
        </div>

        {titolo && (
          <h2 className="shrink-0 mt-4 mb-3 text-[26px] leading-tight font-black tracking-[-.03em] text-white">{titolo}</h2>
        )}

        {/* ⚠️ `key={passo}`: il contenitore si rimonta a ogni passo, così
            l'animazione riparte e lo scorrimento torna in cima. Le due classi
            sono quelle del builder (src/index.css), già spente da «riduci
            movimento». Solo il passo che ENTRA si muove: quello che esce si
            smonta nello stesso fotogramma, come nel builder. */}
        <div key={passo} data-passo={passo}
          className={`flex-1 min-h-0 overflow-y-auto overscroll-contain hide-scrollbar flex flex-col gap-3 pb-2 ${
            verso === 'avanti' ? 'passo-entra' : verso === 'indietro' ? 'ritorno-entra' : ''}`}>
          {passo === 1 && (
            <>
              <p className="text-[13.5px] text-gray-400 leading-relaxed">
                Raccontaci cosa non va. Scegli di cosa si tratta: ti chiediamo solo quello che serve.
              </p>
              <div className="flex flex-col gap-2">
                {TIPI.map(t => {
                  const Icona = ICONE[t.icona]
                  return (
                    <button key={t.id} type="button" onClick={() => scegliTipo(t.id)}
                      className="w-full rounded-2xl bg-white/[.04] border border-white/[.08] px-3.5 py-3 flex items-center gap-3
                                 text-left transition hover:bg-white/[.07] active:scale-[.995]">
                      <span aria-hidden="true"
                        className="w-[34px] h-[34px] rounded-xl border bg-brand/[.13] border-brand/[.28] text-brand flex items-center justify-center shrink-0">
                        <Icona size={18} />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-[15px] font-bold text-white">{t.titolo}</span>
                        <span className="block mt-0.5 text-xs font-medium text-muted">{t.dettaglio}</span>
                      </span>
                      <ChevronRight size={17} className="text-[#5b6070] shrink-0" aria-hidden="true" />
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {passo === 2 && (
            <>
              {bozza.tipo === 'notifiche' && notificheSpente && (
                <div className="rounded-2xl bg-brand/[.08] border border-brand/[.25] p-3.5 flex items-center gap-3">
                  <p className="flex-1 text-[13px] text-gray-200 leading-snug">
                    Le notifiche su questo dispositivo sono spente. Spesso basta riattivarle.
                  </p>
                  <button type="button" onClick={onAttivaNotifiche}
                    className="shrink-0 bg-brand text-black text-sm font-bold px-3.5 py-2 rounded-full hover:brightness-110 transition">
                    Attivale
                  </button>
                </div>
              )}

              {domande.map(d => (
                <div key={d.id} role="radiogroup" aria-label={d.testo}>
                  <p className={`mb-2 ${LABEL}`}>{d.testo}</p>
                  <div className="flex flex-wrap gap-2">
                    {d.opzioni.map(o => {
                      const scelta = bozza.risposte[d.id] === o
                      return (
                        <button key={o} type="button" role="radio" aria-checked={scelta}
                          onClick={() => scegliRisposta(d.id, o)}
                          className={`px-3.5 py-2 rounded-full text-[13px] font-bold border transition ${
                            scelta ? 'bg-brand text-black border-brand' : 'bg-white/[.05] text-gray-200 border-white/[.1] hover:bg-white/[.09]'}`}>
                          {o}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}

              <label className="flex flex-col gap-2">
                <span className={LABEL}>{bozza.tipo === 'idea' ? 'Raccontala' : 'Cosa è successo'}</span>
                <textarea
                  aria-label={bozza.tipo === 'idea' ? 'Descrivi la tua idea' : 'Descrivi il problema'}
                  value={bozza.descrizione} maxLength={LIMITI.descrizioneMax} rows={5}
                  onChange={(e) => aggiorna({ descrizione: e.target.value })}
                  placeholder={bozza.tipo === 'idea' ? 'Cosa vorresti trovare nell\'app?' : 'Cosa stavi facendo, cosa ti aspettavi, cosa è successo invece'}
                  className="w-full rounded-xl bg-[#111] border border-[#333] px-3.5 py-3 text-[15px] text-white
                             placeholder:text-gray-600 focus:outline-none focus:border-brand/60 resize-none" />
              </label>
              <p className="-mt-1 text-[11.5px] font-medium text-muted flex justify-between">
                <span>{lunghezza > 0 && lunghezza < LIMITI.descrizioneMin ? `Almeno ${LIMITI.descrizioneMin} caratteri` : ''}</span>
                <span>{bozza.descrizione.length}/{LIMITI.descrizioneMax}</span>
              </p>

              {bozza.tipo !== 'idea' && (
                <div className="flex flex-col gap-2">
                  {immagini.length > 0 && (
                    <div className="flex gap-2">
                      {immagini.map((im, i) => (
                        <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden border border-white/[.1]">
                          <img src={`data:image/jpeg;base64,${im.base64}`} alt="" className="w-full h-full object-cover" />
                          <button type="button" aria-label="Rimuovi immagine"
                            onClick={() => setImmagini(prima => prima.filter((_, j) => j !== i))}
                            className="absolute top-0.5 right-0.5 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center">
                            <X size={13} aria-hidden="true" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {immagini.length < LIMITI.immaginiMax && (
                    <button type="button" onClick={() => fileRef.current?.click()}
                      className={`self-start flex items-center gap-2 px-3.5 py-2 rounded-full text-[13px] font-bold text-gray-200 ${VETRO}`}>
                      <ImagePlus size={16} aria-hidden="true" /> Aggiungi screenshot
                    </button>
                  )}
                  {erroreImmagine && <p className="text-xs text-red-500">{erroreImmagine}</p>}
                  <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={aggiungiImmagini} />
                </div>
              )}

              <button type="button" onClick={() => setPasso(3)} disabled={!valida.ok}
                className="mt-1 w-full py-3.5 rounded-2xl bg-brand text-black font-black hover:brightness-110 transition
                           disabled:opacity-40 disabled:hover:brightness-100">
                Continua
              </button>
            </>
          )}

          {passo === 3 && (
            <>
              <div className="rounded-2xl bg-white/[.04] border border-white/[.08] p-3.5 flex flex-col gap-2.5">
                <p className={LABEL}>{tipo?.titolo}</p>
                {domande.filter(d => bozza.risposte[d.id]).map(d => (
                  <p key={d.id} className="text-[13px] text-gray-300">
                    <span className="text-muted">{d.testo} </span>{bozza.risposte[d.id]}
                  </p>
                ))}
                <p className="text-[14px] text-white whitespace-pre-wrap break-words">{bozza.descrizione.trim()}</p>
                {immagini.length > 0 && (
                  <p className="text-[12px] text-muted">
                    {immagini.length === 1 ? '1 immagine allegata' : `${immagini.length} immagini allegate`}
                  </p>
                )}
              </div>

              {errore && <p role="alert" className="text-[13px] font-semibold text-red-500">{errore}</p>}

              <button type="button" onClick={invia} disabled={inviando || !online}
                className="w-full py-3.5 rounded-2xl bg-brand text-black font-black flex items-center justify-center gap-2
                           hover:brightness-110 transition disabled:opacity-40 disabled:hover:brightness-100">
                {!online ? 'Sei offline — la bozza resta qui'
                  : inviando ? 'Invio…'
                    : <><Send size={17} aria-hidden="true" />{errore ? 'Riprova' : 'Invia'}</>}
              </button>
            </>
          )}

          {passo === 'fatto' && (
            <div className="my-auto py-10 flex flex-col items-center text-center gap-3">
              <span aria-hidden="true"
                className="w-14 h-14 rounded-full bg-green-500/[.14] border border-green-500/30 text-green-500 flex items-center justify-center">
                <Check size={26} />
              </span>
              <p className="text-[19px] font-black tracking-tight text-white">Grazie per il feedback</p>
            </div>
          )}
        </div>
      </div>
    </div>
    {/* Nel SUO portale, sopra la schermata: vedi in testa al file. */}
    {createPortal(<CustomConfirm info={conferma} onClose={() => setConferma(null)} />, document.body)}
    </>,
    document.body
  )
}
