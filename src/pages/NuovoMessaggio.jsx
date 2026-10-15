// NuovoMessaggio.jsx — «Messaggio a tutti»: la pagina in cui il coach scrive,
// invia, prova su di sé o corregge un messaggio (15/10/2026). Era un foglio dal
// basso: su iPhone arrivava in ritardo rispetto alla tastiera, e «Fissa in cima»
// chiudeva la tastiera al primo tocco senza cambiare. Ora è una pagina intera.
//
// Layout: `fixed inset-0` sopra la tab bar. Con `Keyboard.resize` 'native' la
// webview si accorcia quando sale la tastiera, quindi la barra in fondo (Prova ·
// Invia) resta incollata sopra la tastiera senza animazioni da rincorrere.
//
// Il viaggio di un invio (spec, «Il viaggio»):
//   1. `insert` in `messaggi_coach` — da qui il messaggio è in bacheca;
//   2. `send-reminders` con `{ mode: 'broadcast', record_id }`, che manda le push.
// Se il passo 2 fallisce la pagina mostra «Riprova», che rifà SOLO il passo 2
// con lo stesso id: la funzione salta chi l'ha già ricevuta. Riuscito, si torna
// alla bacheca con il messaggio evidenziato (`/messaggi?m=<id>`).
//
// ⚠️ Mentre una chiamata è in volo i bottoni sono spenti, e il ref lo garantisce
// anche per due tocchi nello stesso fotogramma: due chiamate parallele
// passerebbero entrambe il controllo dei doppioni lato server.
// ⚠️ Si salva `testo.trim()`: il check del database è su `btrim`.
// ⚠️ In modifica (`?modifica=<id>`) niente push e niente bozza: la bozza è di chi
// scrive un messaggio NUOVO, e una correzione non deve sovrascriverla.
// ⚠️ «Fissato in cima» e i bottoni della barra fermano il `pointerdown`: così il
// campo non perde il fuoco, la tastiera resta su e il tocco non va a vuoto.
// ⚠️ «Prova su di me» (`broadcast_prova`): la push solo ai dispositivi di chi la
// manda, senza insert. Nessun atleta vede niente.

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Pin, Send } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../App'
import { CustomConfirm } from '../components/CustomModals'
import { leggiJson, scriviJson } from '../lib/offlineQueue'
import { vibraScelta, vibraSuccesso, vibraErrore } from '../lib/aptica'
import { testoValido, MAX_CARATTERI, CHIAVE_BOZZA, puoInviareBroadcast } from '../lib/messaggiCoach'
import { COACHING_ID } from '../lib/constants'
import { useIndietro } from '../useIndietro'

const atleti = (n) => `${n} ${n === 1 ? 'atleta' : 'atleti'}`

function bozzaIniziale() {
  const b = leggiJson(CHIAVE_BOZZA, null)
  return {
    testo: typeof b?.testo === 'string' ? b.testo : '',
    fissato: b?.fissato === true,
  }
}

/** Non c'è un «rimuovi» in offlineQueue: `null` vale «nessuna bozza» (bozzaIniziale). */
const cancellaBozza = () => scriviJson(CHIAVE_BOZZA, null)

/** Il tocco non toglie il fuoco al campo: la tastiera resta aperta. */
const tieniTastiera = (e) => e.preventDefault()

export default function NuovoMessaggio() {
  const { user, role } = useAuth()
  const navigate = useNavigate()
  const annulla = useIndietro('/messaggi')
  const [params] = useSearchParams()
  const idModifica = params.get('modifica')
  const modifica = !!idModifica
  const demo = !puoInviareBroadcast(user?.email ?? null)

  const [iniziale, setIniziale] = useState(null) // il messaggio da correggere, letto dal database
  const [testo, setTesto] = useState(() => (modifica ? '' : bozzaIniziale().testo))
  const [fissato, setFissato] = useState(() => (modifica ? false : bozzaIniziale().fissato))
  const [numeroAtleti, setNumeroAtleti] = useState(null)
  const [conferma, setConferma] = useState(null)
  const [inVolo, setInVolo] = useState(false)
  const [errore, setErrore] = useState(null)
  const [esitoProva, setEsitoProva] = useState(null) // { testo, errore }
  const [daRiprovare, setDaRiprovare] = useState(null) // id del messaggio già in bacheca
  const inVoloRef = useRef(false)

  // Solo il coach scrive: un atleta che arriva qui torna alla bacheca.
  useEffect(() => { if (role === 'athlete') navigate('/messaggi', { replace: true }) }, [role, navigate])

  // In modifica il testo arriva dal database, non dalla bozza.
  useEffect(() => {
    if (!idModifica) return
    let vivo = true
    supabase.from('messaggi_coach').select('*').eq('id', idModifica).maybeSingle()
      .then(({ data, error }) => {
        if (!vivo) return
        if (error || !data) { setErrore('Messaggio non trovato.'); return }
        setIniziale(data)
        setTesto(data.testo)
      })
    return () => { vivo = false }
  }, [idModifica])

  // «Arriverà a N atleti»: le stesse esclusioni di `send-reminders` — attivi,
  // compresi quelli in pausa, senza l'account nascosto e senza il mittente.
  // ⚠️ Può superare i destinatari veri: il server toglie anche gli altri account
  // admin che hanno una riga athletes, e qui la lista admin non si legge.
  useEffect(() => {
    if (modifica) return
    let vivo = true
    supabase.from('athletes').select('id, deleted_at').is('deleted_at', null)
      .then(({ data, error }) => {
        if (error) throw error
        const n = (data || []).filter(a => a.deleted_at == null && a.id !== COACHING_ID && a.id !== user?.id).length
        if (vivo) setNumeroAtleti(n)
      })
      .catch(e => console.warn('Atleti non contati:', e))
    return () => { vivo = false }
  }, [modifica, user?.id])

  const lunghezza = testo.trim().length
  const troppo = lunghezza > MAX_CARATTERI
  const valido = testoValido(testo)

  const salvaBozza = (b) => { if (!modifica) scriviJson(CHIAVE_BOZZA, b) }
  const cambiaTesto = (t) => { setTesto(t); setErrore(null); setEsitoProva(null); salvaBozza({ testo: t, fissato }) }
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
    navigate(`/messaggi?m=${id}`, { replace: true })
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
    await mandaPush(riga.id)
  })

  const riprova = () => inEsclusiva(() => mandaPush(daRiprovare))

  const salvaModifica = () => inEsclusiva(async () => {
    if (demo || !iniziale) return
    const nuovo = testo.trim()
    if (nuovo === iniziale.testo) { annulla(); return }
    setErrore(null)
    // ⚠️ `.select('id')`: una riga che la RLS non lascia toccare (il demo) torna
    // [] SENZA errore. Zero righe toccate è un fallimento, non un successo.
    const { data, error } = await supabase.from('messaggi_coach')
      .update({ testo: nuovo, modificato_at: new Date().toISOString() }).eq('id', iniziale.id).select('id')
    if (error || !data?.length) {
      vibraErrore()
      setErrore('Modifica non salvata. Controlla la connessione e riprova.')
      return
    }
    vibraSuccesso()
    navigate(`/messaggi?m=${iniziale.id}`, { replace: true })
  })

  const provaSuDiMe = () => inEsclusiva(async () => {
    if (!valido || demo) return
    setEsitoProva(null)
    let esito
    try {
      const { data, error } = await supabase.functions.invoke('send-reminders', { body: { mode: 'broadcast_prova', testo: testo.trim() } })
      esito = error || data?.success === false ? null : data
    } catch {
      esito = null
    }
    if (!esito) {
      vibraErrore()
      setEsitoProva({ errore: true, testo: 'La prova non è partita. Controlla la connessione e riprova.' })
    } else if (!esito.sent) {
      vibraErrore()
      setEsitoProva({ errore: true, testo: 'Nessun tuo dispositivo ha le notifiche attive' })
    } else {
      vibraSuccesso()
      setEsitoProva({ errore: false, testo: `Prova mandata ai tuoi dispositivi (${esito.sent})` })
    }
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

  const spento = !valido || demo || inVolo
  const titolo = modifica ? 'Modifica messaggio' : 'Nuovo messaggio'

  return (
    <div className="fixed inset-0 z-[60] bg-[#0B0B0B] text-white flex flex-col">
      <header className="shrink-0 px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <button type="button" onClick={annulla} className="justify-self-start min-h-[44px] text-[16px] text-gray-300 hover:text-white">
          Annulla
        </button>
        <h1 className="text-[17px] font-extrabold tracking-[-.015em]">{titolo}</h1>
        <span />
      </header>

      {daRiprovare ? (
        <div className="flex-1 flex flex-col justify-center gap-4 px-6 text-center">
          <p className="text-[17px] font-bold">Il messaggio è in bacheca, ma la notifica non è partita</p>
          <button type="button" onClick={riprova} disabled={inVolo}
            className="min-h-[52px] rounded-2xl bg-brand text-black font-black disabled:opacity-40">
            {inVolo ? 'Riprovo…' : 'Riprova'}
          </button>
          <button type="button" onClick={() => navigate(`/messaggi?m=${daRiprovare}`, { replace: true })}
            className="min-h-[44px] text-[15px] font-bold text-gray-400 hover:text-white">
            Vai alla bacheca
          </button>
        </div>
      ) : (
        <>
          <textarea
            aria-label="Testo del messaggio"
            value={testo}
            onChange={e => cambiaTesto(e.target.value)}
            autoFocus
            placeholder="Scrivi a tutti gli atleti…"
            className="flex-1 min-h-0 w-full bg-transparent px-5 pt-3 text-[19px] leading-[1.45] font-medium text-white
                       placeholder:text-gray-600 resize-none focus:outline-none"
          />

          <div className="shrink-0 px-4 pb-2 flex items-center justify-between gap-3">
            {!modifica ? (
              <button type="button" aria-pressed={fissato} onPointerDown={tieniTastiera} onMouseDown={tieniTastiera} onClick={cambiaFissato}
                className={`min-h-[36px] inline-flex items-center gap-1.5 rounded-full px-3.5 text-[13px] font-bold border transition-colors
                            ${fissato ? 'bg-brand/10 border-brand text-brand' : 'bg-[#1e1e1e] border-[#333] text-gray-300'}`}>
                <Pin size={15} aria-hidden="true" />{fissato ? 'Fissato in cima' : 'Fissa in cima'}
              </button>
            ) : <span />}
            <span className="text-xs text-gray-500 tabular-nums text-right">
              {!modifica && numeroAtleti != null && `${atleti(numeroAtleti)} · `}
              <span data-testid="contatore" data-errore={troppo ? 'true' : 'false'} className={troppo ? 'text-red-500 font-bold' : ''}>
                {lunghezza}/{MAX_CARATTERI}
              </span>
            </span>
          </div>

          {(demo || errore || esitoProva) && (
            <div className="shrink-0 px-4 pb-2 text-xs">
              {demo && <p className="text-gray-400">Nell'account di prova i messaggi non partono</p>}
              {errore && <p role="alert" className="text-red-500">{errore}</p>}
              {esitoProva && <p role="status" className={esitoProva.errore ? 'text-red-500' : 'text-gray-300'}>{esitoProva.testo}</p>}
            </div>
          )}

          <footer className="shrink-0 flex gap-2 px-4 pt-2.5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] border-t border-[#222] bg-[#141414]">
            {modifica ? (
              <button type="button" onPointerDown={tieniTastiera} onMouseDown={tieniTastiera} onClick={salvaModifica} disabled={spento || !iniziale}
                className="flex-1 min-h-[48px] rounded-2xl bg-brand text-black text-[15px] font-black disabled:opacity-40">
                {inVolo ? 'Salvo…' : 'Salva'}
              </button>
            ) : (
              <>
                <button type="button" onPointerDown={tieniTastiera} onMouseDown={tieniTastiera} onClick={provaSuDiMe} disabled={spento}
                  className="shrink-0 min-h-[48px] rounded-2xl bg-[#2a2a2a] border border-[#333] px-4 text-[14px] font-bold text-white disabled:opacity-40">
                  Prova su di me
                </button>
                <button type="button" onPointerDown={tieniTastiera} onMouseDown={tieniTastiera} onClick={chiediConferma} disabled={spento}
                  className="flex-1 min-h-[48px] rounded-2xl bg-brand text-black text-[15px] font-black inline-flex items-center justify-center gap-2 disabled:opacity-40">
                  <Send size={17} aria-hidden="true" />
                  {inVolo ? 'Invio…' : numeroAtleti == null ? 'Invia' : `Invia a ${numeroAtleti}`}
                </button>
              </>
            )}
          </footer>
        </>
      )}
      {createPortal(<CustomConfirm info={conferma} onClose={() => setConferma(null)} />, document.body)}
    </div>
  )
}
