// Messaggi.jsx — la bacheca «Dal coach» (15/10/2026).
// Atleta: sola lettura. Il ramo coach (scrivere, fissare, modificare) lo
// aggiunge il Task 6 qui dentro: per ora chi non è atleta vede la lista intera.
import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { supabase } from '../supabaseClient'
import { useAuth } from '../App'
import { ListaMessaggi } from '../components/MessaggiUI'
import { visibiliPer, ordina, CHIAVE_VISTO } from '../lib/messaggiCoach'
import { sincronizzaBadge } from '../lib/badge'
import { scriviJson } from '../lib/offlineQueue'

const DURATA_EVIDENZA_MS = 2000

export default function Messaggi() {
  const { user, role } = useAuth()
  const coach = role !== 'athlete'
  const [params] = useSearchParams()
  const idRichiesto = params.get('m')
  const [messaggi, setMessaggi] = useState([])
  const [caricato, setCaricato] = useState(false)
  const [evidenzaSpentaPer, setEvidenzaSpentaPer] = useState(null)

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
      } finally {
        if (vivo) setCaricato(true)
      }
    })()
    return () => { vivo = false }
  }, [])

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
        {caricato && <ListaMessaggi messaggi={visibili} evidenziatoId={evidenziatoId} coach={false} />}
      </div>
    </div>
  )
}
