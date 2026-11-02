import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, MonitorUp, ScanLine, Keyboard, Settings } from 'lucide-react'
import { codiceDaQR } from '../lib/codiceTV'
import { qrDisponibile, leggiQR, apriImpostazioni } from '../lib/lettoreQR'
import { vibraSuccesso } from '../lib/aptica'

// Il foglio «Trasmetti in TV» della scheda workout (30/10/2026, spec
// docs/superpowers/specs/2026-10-30-tv-qr-design.md §1).
//
// Prende il posto della finestra centrata che saliva di 128px col fuoco del
// campo: chiusa la tastiera riscendeva, e il tocco su «Trasmetti ora» cadeva
// dove il bottone non c'era più («a volte non parte»). Qui non c'è bottone da
// toccare: alla quarta cifra si collega da solo. E niente traslazione al fuoco:
// il foglio sta in basso, la tastiera lo spinge su.
//
// Stati: `scelta` (solo app nativa: QR o codice) · `codice` · `qr-errore` (un QR
// che non è della TV) · `permesso` (fotocamera negata). Sul web si parte da
// `codice`, perché il lettore QR non c'è.
//
// `erroreIniziale`: il messaggio con cui il foglio si apre (dal link con `?tv=`).
// `sopraIlTimer`: z-[250] invece di z-[100], per aprirsi sopra il timer a tutto
// schermo (z-[200]) — il «Sì» di FoglioChiediTV a timer aperto.
//
// `onCollega(codice)` → `{ ok: true }` | `{ errore }`. A collegamento riuscito
// il foglio lo chiude chi lo monta (e apre il telecomando).

const MSG_QR_ESTRANEO = 'Questo non è il codice della TV FLEOFIT'
const MSG_SENZA_FOTOCAMERA = 'La fotocamera non si è aperta: scrivi il codice che vedi sulla TV.'

export default function FoglioCollegaTV({ onCollega, onChiudi, erroreIniziale = null, sopraIlTimer = false }) {
  // Se lo scanner non parte (plugin presente ma guasto) la strada del QR sparisce.
  const [conQR, setConQR] = useState(qrDisponibile)
  // Con `erroreIniziale` (il link con `?tv=` portava un codice che non va) si
  // apre sul campo del codice, con il messaggio sotto.
  const [stato, setStato] = useState(conQR && !erroreIniziale ? 'scelta' : 'codice')
  const [codice, setCodice] = useState('')
  const [errore, setErrore] = useState(erroreIniziale)
  const [attesa, setAttesa] = useState(false)
  const [leggendo, setLeggendo] = useState(false)
  // La guardia contro la doppia chiamata: l'incolla e il tasto Invio (o un
  // secondo evento della tastiera) arrivano prima che lo stato si aggiorni, e
  // ognuno farebbe partire il suo collegamento — due update su `tv_sessions`.
  const inCorso = useRef(false)

  const collega = async (c) => {
    if (inCorso.current) return
    inCorso.current = true
    setAttesa(true)
    setErrore(null)
    let esito
    try {
      esito = await onCollega(c)
    } catch {
      esito = { errore: 'Collegamento non riuscito. Riprova.' }
    }
    // Riuscito: il foglio lo smonta chi lo ha aperto. La guardia resta alzata,
    // così niente può ripartire nel frattempo.
    if (esito?.ok) return
    inCorso.current = false
    setAttesa(false)
    setCodice('')
    setStato('codice')
    setErrore(esito?.errore || 'Collegamento non riuscito. Riprova.')
  }

  const scrivi = (valore) => {
    const pulito = valore.replace(/[^0-9]/g, '').slice(0, 4)
    setCodice(pulito)
    if (pulito.length > 0) setErrore(null)
    if (pulito.length === 4) collega(pulito)
  }

  const inquadra = async () => {
    if (leggendo) return
    setLeggendo(true)
    setErrore(null)
    try {
      const letto = await leggiQR()
      if (letto?.annullato) { setStato('scelta'); return }
      const trovato = codiceDaQR(letto?.valore)
      if (!trovato) { setStato('qr-errore'); return }
      vibraSuccesso()
      await collega(trovato)
    } catch (e) {
      if (e?.code === 'permesso') setStato('permesso')
      else { setConQR(false); setStato('codice'); setErrore(MSG_SENZA_FOTOCAMERA) }
    } finally {
      setLeggendo(false)
    }
  }

  const passaAlCodice = () => { setErrore(null); setStato('codice') }

  const bottoneGrande = 'w-full min-h-[60px] flex items-center justify-center gap-2.5 rounded-2xl font-bold text-[16px] transition active:scale-[.98] disabled:opacity-50'

  return createPortal(
    <div className={`fixed inset-0 ${sopraIlTimer ? 'z-[250]' : 'z-[100]'} flex flex-col justify-end`}>
      <div className="absolute inset-0 bg-black/70 velo-in" onClick={onChiudi} />
      <div role="dialog" aria-modal="true" aria-labelledby="foglio-tv-titolo"
        className="relative bg-[#1e1e1e] border-t border-[#2a2a2a] rounded-t-3xl px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] max-h-[85dvh] overflow-y-auto sheet-in">
        <div className="w-10 h-1 rounded-full bg-[#383838] mx-auto mb-4" aria-hidden="true" />

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 id="foglio-tv-titolo" className="text-xl font-black tracking-tight text-white flex items-center gap-2">
              <MonitorUp size={22} className="text-brand shrink-0" aria-hidden="true" /> Trasmetti in TV
            </h3>
            <p className="mt-1 text-sm text-muted text-pretty">
              Sul browser della TV apri <strong className="text-white">fleofit.vercel.app/tv</strong>
              {stato === 'codice' ? ' e scrivi qui il codice che vedi.' : ': compare un codice con il suo QR.'}
            </p>
          </div>
          <button aria-label="Chiudi" onClick={onChiudi}
            className="shrink-0 w-11 h-11 -mr-1 rounded-full bg-[#2a2a2a] flex items-center justify-center text-gray-300 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {(stato === 'scelta' || stato === 'qr-errore') && (
          <div className="mt-5 flex flex-col gap-3">
            {stato === 'qr-errore' && (
              <p role="alert" className="text-sm font-semibold text-red-400 text-center">{MSG_QR_ESTRANEO}</p>
            )}
            <button onClick={inquadra} disabled={leggendo || attesa}
              className={`${bottoneGrande} bg-brand text-black hover:brightness-110`}>
              <ScanLine size={20} aria-hidden="true" /> {attesa ? 'Collegamento…' : 'Inquadra il QR'}
            </button>
            <button onClick={passaAlCodice} disabled={leggendo || attesa}
              className={`${bottoneGrande} bg-[#2a2a2a] text-white hover:bg-[#333]`}>
              <Keyboard size={20} aria-hidden="true" /> Inserisci il codice
            </button>
          </div>
        )}

        {stato === 'permesso' && (
          <div className="mt-5 flex flex-col gap-3">
            <p role="alert" className="text-sm text-gray-300 text-pretty">
              FLEOFIT non ha il permesso di usare la fotocamera. Puoi darglielo dalle Impostazioni, oppure scrivere il codice.
            </p>
            <button onClick={() => apriImpostazioni().catch(() => {})}
              className={`${bottoneGrande} bg-brand text-black hover:brightness-110`}>
              <Settings size={20} aria-hidden="true" /> Apri Impostazioni
            </button>
            <button onClick={passaAlCodice}
              className={`${bottoneGrande} bg-[#2a2a2a] text-white hover:bg-[#333]`}>
              <Keyboard size={20} aria-hidden="true" /> Inserisci il codice
            </button>
          </div>
        )}

        {stato === 'codice' && (
          <form className="mt-5" onSubmit={(e) => { e.preventDefault(); if (codice.length === 4) collega(codice) }}>
            {/* readOnly e non disabled durante l'attesa: un campo disabilitato
                perde il fuoco e su iPhone chiude la tastiera, e il foglio
                salterebbe giù — proprio il difetto che questo foglio toglie. */}
            <input
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              autoFocus
              aria-label="Codice della TV"
              aria-busy={attesa}
              aria-describedby="foglio-tv-stato"
              readOnly={attesa}
              value={codice}
              onChange={(e) => scrivi(e.target.value)}
              placeholder="1234"
              className={`w-full bg-[#111] border rounded-xl px-4 py-4 text-white text-center text-3xl font-black tracking-[0.5em] focus:outline-none focus:border-brand ${errore ? 'border-red-500/60' : 'border-[#333]'} ${attesa ? 'opacity-60' : ''}`}
            />
            <div id="foglio-tv-stato" className="min-h-[2.5rem] pt-2.5 text-center text-sm">
              {attesa
                ? <span className="text-muted">Collegamento…</span>
                : errore
                  ? <span role="alert" className="font-semibold text-red-400">{errore}</span>
                  : <span className="text-muted">Si collega da solo alla quarta cifra.</span>}
            </div>
            {conQR && (
              <button type="button" onClick={inquadra} disabled={leggendo || attesa}
                className="w-full h-11 flex items-center justify-center gap-2 text-sm font-semibold text-muted hover:text-white disabled:opacity-50">
                <ScanLine size={16} aria-hidden="true" /> Inquadra il QR
              </button>
            )}
          </form>
        )}
      </div>
    </div>,
    document.body
  )
}
