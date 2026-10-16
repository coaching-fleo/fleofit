// NuovoMessaggio.jsx — «Messaggio a tutti»: la pagina in cui il coach scrive,
// invia, prova su di sé o corregge un messaggio (15/10/2026). Era un foglio dal
// basso: su iPhone arrivava in ritardo rispetto alla tastiera, e «Fissa in cima»
// chiudeva la tastiera al primo tocco senza cambiare. Ora è una pagina intera.
//
// Layout: `fixed inset-0` sopra la tab bar. La barra in fondo (Prova · Invia) sale
// INSIEME alla tastiera: su iOS la pagina ferma il ridimensionamento della webview
// e usa l'altezza di `keyboardWillShow` (useTastieraIOS) — con 'native' la barra
// restava giù e poi «si teletrasportava» sopra (15/10/2026); su Android usa
// quanta tastiera copre la pagina (useTastieraCheCopre).
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
// manda, senza insert. Nessun atleta vede niente. ⏳ Finché il committente la
// verifica, la prova compare nella bacheca di questo telefono (CHIAVE_PROVE).

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Pin, Send } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../App'
import { eAdmin } from '../lib/ruoli'
import { CustomConfirm } from '../components/CustomModals'
import { leggiJson, scriviJson } from '../lib/offlineQueue'
import { vibraScelta, vibraSuccesso, vibraErrore } from '../lib/aptica'
import { testoValido, MAX_CARATTERI, CHIAVE_BOZZA, puoInviareBroadcast, esitoProva as leggiEsitoProva, CHIAVE_PROVE, nuovaProva, proveValide } from '../lib/messaggiCoach'
import { mostraErrore, mostraSuccesso } from '../lib/alert'
import { COACHING_ID } from '../lib/constants'
import { useIndietro } from '../useIndietro'
import { useTastieraIOS, useTastieraCheCopre } from '../useTastiera'

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
  const demo = !puoInviareBroadcast(user?.email ?? null, role)

  const [iniziale, setIniziale] = useState(null) // il messaggio da correggere, letto dal database
  const [testo, setTesto] = useState(() => (modifica ? '' : bozzaIniziale().testo))
  const [fissato, setFissato] = useState(() => (modifica ? false : bozzaIniziale().fissato))
  // Solo l'admin sceglie: il coach scrive sempre ai suoi atleti.
  const [aTutti, setATutti] = useState(false)
  const [conteggi, setConteggi] = useState(null) // { tutti, miei }
  const [conferma, setConferma] = useState(null)
  const [inVolo, setInVolo] = useState(false)
  const [errore, setErrore] = useState(null)
  const [esitoProva, setEsitoProva] = useState(null) // { testo, errore }
  const [daRiprovare, setDaRiprovare] = useState(null) // id del messaggio già in bacheca
  const inVoloRef = useRef(false)
  const tastieraIOS = useTastieraIOS()
  const tastieraAndroid = useTastieraCheCopre()
  const sottoTastiera = tastieraIOS || tastieraAndroid

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
  // «Miei» = gli atleti di `coach_atleti` per questo coach, fra quelli attivi. Se la
  // tabella non c'è (migrazione non applicata) o non risponde: nessun numero, mai uno sbagliato.
  useEffect(() => {
    if (modifica) return
    let vivo = true
    ;(async () => {
      const { data, error } = await supabase.from('athletes').select('id, deleted_at').is('deleted_at', null)
      if (error) throw error
      const attivi = (data || []).filter(a => a.deleted_at == null && a.id !== COACHING_ID && a.id !== user?.id)
      let miei = null
      try {
        const r = await supabase.from('coach_atleti').select('athlete_id').eq('coach_id', user?.id)
        if (!r.error) {
          const suoi = new Set((r.data || []).map(x => x.athlete_id))
          miei = attivi.filter(a => suoi.has(a.id)).length
        }
      } catch { miei = null }
      if (vivo) setConteggi({ tutti: attivi.length, miei })
    })().catch(e => console.warn('Atleti non contati:', e))
    return () => { vivo = false }
  }, [modifica, user?.id])
  const destinaTutti = eAdmin(role) && aTutti
  const numeroAtleti = conteggi ? (destinaTutti ? conteggi.tutti : conteggi.miei) : null

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
      // `destinatari` parte SOLO per 'tutti': il default 'miei' lo mette il database
      // (e così l'insert non dipende dalla colonna finché si scrive ai propri atleti).
      .insert({ testo: testo.trim(), fissato, ...(eAdmin(role) && aTutti ? { destinatari: 'tutti' } : null) }).select().single()
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

  // «Prova su di me» → si torna alla bacheca, come dopo un invio vero, con la
  // bozza svuotata (premendo «Nuovo» si riparte da zero) e l'esito in un avviso.
  // ⏳ TEMPORANEO: la prova entra nella bacheca di QUESTO telefono (CHIAVE_PROVE),
  // con il suo fissato, e la notifica punta lì. Solo se la chiamata non è
  // partita affatto si resta qui, col testo, a riprovare.
  const provaSuDiMe = () => inEsclusiva(async () => {
    if (!valido || demo) return
    setEsitoProva(null)
    const prova = nuovaProva({ testo, fissato })
    let risposta
    try {
      const { data, error } = await supabase.functions.invoke('send-reminders', { body: { mode: 'broadcast_prova', testo: prova.testo, prova_id: prova.id } })
      risposta = error || data?.success === false ? null : data
    } catch {
      risposta = null
    }
    const esito = leggiEsitoProva(risposta)
    if (!risposta) { vibraErrore(); setEsitoProva(esito); return }
    scriviJson(CHIAVE_PROVE, [prova, ...proveValide(leggiJson(CHIAVE_PROVE, []))])
    cancellaBozza()
    if (esito.errore) { vibraErrore(); mostraErrore(esito.testo, 'Push non arrivata') }
    else { vibraSuccesso(); mostraSuccesso(esito.testo, 'Prova mandata') }
    navigate(`/messaggi?m=${prova.id}`, { replace: true })
  })

  const chiediConferma = () => {
    if (!valido || demo || inVolo) return
    setConferma({
      title: numeroAtleti == null ? (destinaTutti ? 'Mandarlo a tutti gli atleti?' : 'Mandarlo ai tuoi atleti?') : (destinaTutti ? `Mandare a tutti i ${atleti(numeroAtleti)}?` : `Mandare ai tuoi ${atleti(numeroAtleti)}?`),
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
            placeholder={destinaTutti ? 'Scrivi a tutti gli atleti…' : 'Scrivi ai tuoi atleti…'}
            className="flex-1 min-h-0 w-full bg-transparent px-5 pt-3 text-[19px] leading-[1.45] font-medium text-white
                       placeholder:text-gray-600 resize-none focus:outline-none"
          />

          {eAdmin(role) && !modifica && (
            <div role="radiogroup" aria-label="Destinatari"
              className="shrink-0 mx-4 mb-2 grid grid-cols-2 bg-[#111] p-1.5 rounded-2xl border border-[#333] relative">
              <span aria-hidden="true"
                className={`absolute top-1.5 bottom-1.5 left-1.5 w-[calc(50%-0.375rem)] rounded-xl bg-brand transition-transform duration-300 ease-out ${aTutti ? 'translate-x-full' : ''}`} />
              {[['I miei atleti', false], ['Tutti gli atleti', true]].map(([etichetta, valore]) => (
                <button key={etichetta} type="button" role="radio" aria-checked={aTutti === valore}
                  onPointerDown={tieniTastiera} onMouseDown={tieniTastiera}
                  onClick={() => { vibraScelta(); setATutti(valore) }}
                  className={`relative z-10 min-h-[36px] rounded-xl text-[13px] font-bold ${aTutti === valore ? 'text-black' : 'text-gray-300'}`}>
                  {etichetta}
                </button>
              ))}
            </div>
          )}

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

          <footer className="shrink-0 flex gap-2 px-4 pt-2.5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] border-t border-[#222] bg-[#141414]"
            style={{
              ...(sottoTastiera ? { paddingBottom: sottoTastiera + 12 } : null),
              // La curva e la durata della tastiera di iOS: la barra sale con lei, non dopo.
              transition: 'padding-bottom 250ms cubic-bezier(0.17, 0.59, 0.4, 0.77)',
            }}>
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
