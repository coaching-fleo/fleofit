// Messaggi.jsx — la bacheca «Dal coach» (15/10/2026).
// Atleta: sola lettura. Coach: «Messaggio a tutti» (il foglio, con la push) e il
// menu di ogni messaggio — Fissa, Modifica, Elimina, ottimistici con rollback.
// Il foglio e il menu stanno in FoglioMessaggio.jsx; qui la lista e chi la cambia.
// `?scrivi=1` apre il foglio all'arrivo (le entrate in Home e sul desktop).
import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Megaphone } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { supabase } from '../supabaseClient'
import { useAuth } from '../App'
import { ListaMessaggi } from '../components/MessaggiUI'
import FoglioMessaggio, { MenuMessaggio } from '../components/FoglioMessaggio'
import { CustomConfirm } from '../components/CustomModals'
import { visibiliPer, ordina, CHIAVE_VISTO, puoInviareBroadcast } from '../lib/messaggiCoach'
import { COACHING_ID } from '../lib/constants'
import { mostraErrore } from '../lib/alert'
import { sincronizzaBadge } from '../lib/badge'
import { scriviJson } from '../lib/offlineQueue'

const DURATA_EVIDENZA_MS = 2000

export default function Messaggi() {
  const { user, role } = useAuth()
  const coach = role !== 'athlete'
  const [params, setParams] = useSearchParams()
  const idRichiesto = params.get('m')
  const [messaggi, setMessaggi] = useState([])
  const [caricato, setCaricato] = useState(false)
  const [erroreCaricamento, setErroreCaricamento] = useState(false)
  const [evidenzaSpentaPer, setEvidenzaSpentaPer] = useState(null)
  // Il foglio: chiuso, aperto per un messaggio nuovo (`{}`), o per correggerne uno.
  const [foglio, setFoglio] = useState(() => (coach && params.get('scrivi') === '1' ? {} : null))
  const [menu, setMenu] = useState(null)
  const [conferma, setConferma] = useState(null)
  const [numeroAtleti, setNumeroAtleti] = useState(null)

  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        const { data, error } = await supabase.from('messaggi_coach')
          .select('*').order('creato_at', { ascending: false })
        if (error) throw error
        if (vivo) setMessaggi(data || [])
      } catch (e) {
        console.warn('Messaggi del coach non caricati:', e)
        if (vivo) setErroreCaricamento(true)
      } finally {
        if (vivo) setCaricato(true)
      }
    })()
    return () => { vivo = false }
  }, [])

  // «Arriverà a N atleti»: le stesse esclusioni di `send-reminders` — attivi,
  // compresi quelli in pausa, senza l'account nascosto e senza il mittente.
  useEffect(() => {
    if (!coach) return
    let vivo = true
    ;(async () => {
      try {
        const { data, error } = await supabase.from('athletes').select('id, deleted_at').is('deleted_at', null)
        if (error) throw error
        const n = (data || []).filter(a => a.deleted_at == null && a.id !== COACHING_ID && a.id !== user?.id).length
        if (vivo) setNumeroAtleti(n)
      } catch (e) {
        console.warn('Atleti non contati:', e)
      }
    })()
    return () => { vivo = false }
  }, [coach, user?.id])

  /** Sostituisce (o aggiunge in testa) una riga: lo usano l'invio, la modifica e i rollback. */
  const metti = (riga) => setMessaggi(prima => (prima.some(m => m.id === riga.id)
    ? prima.map(m => (m.id === riga.id ? riga : m))
    : [riga, ...prima]))

  const fissa = async (m) => {
    metti({ ...m, fissato: !m.fissato })
    try {
      const { error } = await supabase.from('messaggi_coach').update({ fissato: !m.fissato }).eq('id', m.id)
      if (error) throw error
    } catch (e) {
      console.warn('Messaggio non fissato:', e)
      metti(m)
      mostraErrore('Non sono riuscito a salvare. Controlla la connessione e riprova.')
    }
  }

  const elimina = async (m) => {
    setMessaggi(prima => prima.filter(x => x.id !== m.id))
    try {
      const { error } = await supabase.from('messaggi_coach').delete().eq('id', m.id)
      if (error) throw error
    } catch (e) {
      console.warn('Messaggio non eliminato:', e)
      metti(m)
      mostraErrore('Non sono riuscito a eliminarlo. Controlla la connessione e riprova.')
    }
  }

  const dopoMenu = (scelta) => {
    const m = menu
    setMenu(null)
    if (!m) return
    if (scelta === 'fissa') fissa(m)
    if (scelta === 'modifica') setFoglio({ iniziale: m })
    if (scelta === 'elimina') setConferma({
      title: 'Eliminare il messaggio?',
      message: 'Sparirà dalla bacheca; chi ha già ricevuto la notifica la vede ancora.',
      confirmLabel: 'Elimina',
      onConfirm: () => elimina(m),
    })
  }

  const chiudiFoglio = () => {
    setFoglio(null)
    if (params.get('scrivi')) setParams(p => { p.delete('scrivi'); return p }, { replace: true })
  }

  const visibili = useMemo(
    () => ordina(visibiliPer(messaggi, { iscrittoIl: user?.created_at ?? null, coach })),
    [messaggi, user?.created_at, coach]
  )

  // Notifiche dei messaggi: lette all'apertura, poi il badge si riallinea.
  useEffect(() => {
    if (!user?.id) return
    ;(async () => {
      try {
        await supabase.from('notifications').update({ is_read: true })
          .eq('user_id', user.id).eq('is_read', false).like('route', '/messaggi%')
        if (Capacitor.isNativePlatform()) {
          const { count } = await supabase.from('notifications')
            .select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_read', false)
          if (count !== null) await sincronizzaBadge(count, user.id, supabase)
        }
      } catch (e) {
        console.warn('Notifiche dei messaggi non marcate come lette:', e)
      }
    })()
  }, [user?.id])

  // «Visto fino a»: il più recente fra quelli che l'utente ha davanti.
  useEffect(() => {
    if (!caricato || coach || !visibili.length) return
    const piuRecente = visibili.reduce((a, m) => (new Date(m.creato_at) > new Date(a) ? m.creato_at : a), visibili[0].creato_at)
    scriviJson(CHIAVE_VISTO, piuRecente)
  }, [caricato, coach, visibili])

  // Deep link ?m=<id>: scorre alla riga e la evidenzia per due secondi.
  // L'evidenza è derivata: esiste finché il timer non la spegne.
  const trovato = !!idRichiesto && visibili.some(m => m.id === idRichiesto)
  const evidenziatoId = trovato && evidenzaSpentaPer !== idRichiesto ? idRichiesto : null
  useEffect(() => {
    if (!trovato) return
    document.getElementById('messaggio-' + idRichiesto)?.scrollIntoView?.({ block: 'center' })
    const t = setTimeout(() => setEvidenzaSpentaPer(idRichiesto), DURATA_EVIDENZA_MS)
    return () => clearTimeout(t)
  }, [trovato, idRichiesto])

  return (
    <div className="min-h-screen bg-[#0B0B0B] text-white px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-[var(--fondo-pagina)]">
      <div className="cascata max-w-2xl mx-auto">
        <h1 className="text-3xl font-black tracking-tight mb-6">Dal coach</h1>
        {coach && (
          <button type="button" onClick={() => setFoglio({})}
            className="w-full mb-4 min-h-[52px] rounded-xl bg-brand text-black font-bold flex items-center justify-center gap-2 hover:brightness-110 transition">
            <Megaphone size={18} aria-hidden="true" />Messaggio a tutti
          </button>
        )}
        {caricato && (erroreCaricamento
          ? <p role="alert" className="text-sm text-red-500">Non riesco a caricare i messaggi.</p>
          : <ListaMessaggi messaggi={visibili} evidenziatoId={evidenziatoId} coach={coach} onMenu={setMenu} />)}
      </div>
      {coach && (
        <>
          <FoglioMessaggio aperto={!!foglio} onChiudi={chiudiFoglio} numeroAtleti={numeroAtleti}
            demo={!puoInviareBroadcast(user?.email ?? null)} iniziale={foglio?.iniziale ?? null} onInviato={metti} />
          {menu && <MenuMessaggio messaggio={menu} onChiudi={dopoMenu} />}
          {createPortal(<CustomConfirm info={conferma} onClose={() => setConferma(null)} />, document.body)}
        </>
      )}
    </div>
  )
}
