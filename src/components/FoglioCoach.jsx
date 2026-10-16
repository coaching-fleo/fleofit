// FoglioCoach.jsx — i due fogli della gestione dei coach (solo admin, 16/10/2026).
//
//  • FoglioCoach: dalla scheda di un atleta, «di chi è». Sceglie fra i membri
//    dello staff che hanno già un account (serve un id per `coach_atleti`).
//  • FoglioGestioneCoach: da Impostazioni, chi lavora nell'app: elenco con
//    ruolo e numero di atleti, aggiunta per email, «Togli».
//
// SOLA PRESENTAZIONE: le scritture (src/lib/coachAtleti.js) le fa la pagina.
// ⚠️ Il foglio ha una X con aria-label «Chiudi»: è così che il tasto indietro
// di Android lo trova (src/lib/indietroAndroid.js).

import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Check, UserPlus } from 'lucide-react'
import { useBottomSheet } from '../useBottomSheet'
import { VETRO, LABEL } from '../lib/stiliCard'

function Foglio({ titolo, chiudi, maniglia, stileFoglio, stileVelo, classeFoglio, classeVelo, children }) {
  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col justify-end">
      <div aria-hidden="true" onClick={chiudi} className={`absolute inset-0 bg-black/85 ${classeVelo}`} style={stileVelo} />
      <div role="dialog" aria-modal="true" aria-label={titolo}
        className={`relative w-full max-w-2xl mx-auto bg-[#1e1e1e] border-t border-[#2a2a2a] rounded-t-3xl px-4
                    pb-[calc(1rem+env(safe-area-inset-bottom))] max-h-[85dvh] flex flex-col
                    shadow-[0_-20px_50px_-12px_rgba(0,0,0,.85)] ${classeFoglio}`}
        style={stileFoglio}>
        <button type="button" aria-label="Trascina giù per chiudere" {...maniglia}
          className="w-full pt-3 pb-2.5 flex justify-center touch-none cursor-grab group shrink-0">
          <span aria-hidden="true" className="w-10 h-1 rounded-full bg-white/20 group-hover:bg-white/35" />
        </button>
        <div className="flex items-center gap-3 pb-3 shrink-0">
          <h2 className="flex-1 min-w-0 text-[17px] font-extrabold tracking-[-.015em] text-white truncate">{titolo}</h2>
          <button type="button" aria-label="Chiudi" onClick={chiudi}
            className={`shrink-0 w-10 h-10 rounded-full ${VETRO} flex items-center justify-center text-gray-200 hover:text-white transition`}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain hide-scrollbar flex flex-col gap-2">{children}</div>
      </div>
    </div>,
    document.body
  )
}

const nomeDi = (m) => m.nome || m.email

/**
 * La scelta del coach di un atleta.
 * @param membri   righe di `elenco_staff()` (email, ruolo, user_id, nome)
 * @param correnti id dei coach di oggi
 * @param onScegli(membro) a uscita finita; `onChiudi` se non si sceglie niente
 */
export default function FoglioCoach({ membri, correnti = [], onScegli, onChiudi }) {
  const conAccount = membri.filter(m => m.user_id)
  // Una ref e non uno stato: `onChiudi` arriva a uscita finita e deve leggere
  // la scelta di adesso, non quella del render in cui è partita l'uscita.
  const scelto = useRef(null)
  const sheet = useBottomSheet(() => (scelto.current ? onScegli(scelto.current) : onChiudi()))
  const scegli = (m) => {
    if (!correnti.includes(m.user_id)) scelto.current = m
    sheet.chiudi()
  }
  return (
    <Foglio titolo="Coach dell'atleta" {...sheet}>
      {conAccount.length === 0 && (
        <p className="text-sm text-gray-400 pb-2">Nessun coach ha ancora un account. Chi hai aggiunto compare qui dopo la registrazione.</p>
      )}
      {conAccount.map(m => {
        const attuale = correnti.includes(m.user_id)
        return (
          <button key={m.email} type="button" onClick={() => scegli(m)}
            className="w-full min-h-[52px] flex items-center gap-3 px-4 py-2 rounded-2xl bg-[#222] border border-[#333] text-left transition hover:border-[#444]">
            <span className="flex-1 min-w-0">
              <span className="block text-[15px] font-bold text-white truncate">{nomeDi(m)}</span>
              <span className="block text-xs text-gray-400 truncate">{m.email} · {m.ruolo === 'admin' ? 'Admin' : 'Coach'}</span>
            </span>
            {attuale && <Check size={18} className="text-brand shrink-0" aria-label="Coach attuale" />}
          </button>
        )
      })}
    </Foglio>
  )
}

/**
 * La gestione dello staff.
 * @param staff     righe di `elenco_staff()`, o null mentre carica
 * @param conteggi  { [user_id]: numero di atleti }
 * @param errore    testo se l'elenco non si legge (database non ancora aggiornato)
 */
export function FoglioGestioneCoach({ staff, conteggi = {}, errore, occupato, onAggiungi, onTogli, onChiudi }) {
  const sheet = useBottomSheet(onChiudi)
  const [email, setEmail] = useState('')
  const invia = (e) => {
    e.preventDefault()
    if (!email.trim() || occupato) return
    onAggiungi(email)
    setEmail('')
  }
  return (
    <Foglio titolo="Coach" {...sheet}>
      {errore && <p className="text-sm text-gray-400 pb-2">{errore}</p>}
      {!errore && staff === null && <p className="text-xs text-gray-400 py-2">Caricamento…</p>}
      {!errore && staff && (
        <>
          <p className={`${LABEL} pt-1`}>Staff · {staff.length}</p>
          {staff.map(m => {
            const n = m.user_id ? (conteggi[m.user_id] || 0) : null
            return (
              <div key={m.email} className="rounded-2xl bg-[#222] border border-[#333] px-4 py-2.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-bold text-white truncate">{nomeDi(m)}</p>
                  <p className="text-xs text-gray-400 truncate">
                    {m.ruolo === 'admin' ? 'Admin' : 'Coach'}
                    {m.user_id ? ` · ${n} ${n === 1 ? 'atleta' : 'atleti'}` : ' · non ha ancora un account'}
                    {m.nome ? ` · ${m.email}` : ''}
                  </p>
                </div>
                {m.ruolo === 'coach' && (
                  <button type="button" onClick={() => onTogli(m, n)} disabled={occupato}
                    aria-label={`Togli ${nomeDi(m)}`}
                    className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold text-red-400 border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 transition disabled:opacity-50">
                    Togli
                  </button>
                )}
              </div>
            )
          })}
          <form onSubmit={invia} className="pt-3 flex flex-col gap-2">
            <label htmlFor="nuovo-coach" className={LABEL}>Nuovo coach</label>
            <input id="nuovo-coach" type="email" inputMode="email" autoCapitalize="none" autoCorrect="off"
              value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@esempio.it"
              className="w-full px-4 py-3 rounded-xl bg-[#111] border border-[#333] text-white text-[15px] outline-none focus:border-brand" />
            <button type="submit" disabled={!email.trim() || occupato}
              className="flex items-center justify-center gap-2 py-3 rounded-xl bg-brand text-black font-bold hover:brightness-110 transition disabled:opacity-50">
              <UserPlus size={17} aria-hidden="true" /> Aggiungi coach
            </button>
            <p className="text-xs text-gray-400">Potrà registrarsi con questo indirizzo: i suoi atleti li assegni dalla loro scheda.</p>
          </form>
        </>
      )}
    </Foglio>
  )
}
