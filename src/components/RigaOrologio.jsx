import { useState, useEffect, useRef, useCallback } from 'react'
import { Watch } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { rigaOrologio } from '../lib/rigaOrologio'

// «Sull'orologio»: dice se la corsa di questa assegnazione è sul Garmin
// dell'atleta, e se non lo è offre «Riprova». Una lettura che fallisce
// (tabella assente, 42P01, o niente permesso) vale nessuna riga.
export default function RigaOrologio({ awId }) {
  const [invio, setInvio] = useState(null)
  const [inCorso, setInCorso] = useState(false)
  const guardia = useRef(false)

  const leggi = useCallback(async () => {
    const { data, error } = await supabase.from('garmin_invii')
      .select('stato, data').eq('athlete_workout_id', awId).maybeSingle()
    return error ? null : data
  }, [awId])

  useEffect(() => {
    let vivo = true
    leggi().then(d => { if (vivo) setInvio(d) })
    return () => { vivo = false }
  }, [leggi])

  const riprova = async () => {
    if (guardia.current) return
    guardia.current = true
    setInCorso(true)
    try {
      const { error } = await supabase.functions.invoke('garmin-training', {
        body: { azione: 'riprova', athlete_workout_id: awId },
      })
      if (error) console.error('garmin-training riprova:', error.message)
      setInvio(await leggi())
    } catch (e) {
      console.error('garmin-training riprova:', e?.message)
    } finally {
      guardia.current = false
      setInCorso(false)
    }
  }

  const riga = rigaOrologio(invio)
  if (!riga) return null
  return (
    <div className="flex items-center gap-2 px-1 text-gray-400 text-xs">
      <Watch size={14} aria-hidden="true" />
      <span>{riga.testo}</span>
      {riga.riprova && (
        <button type="button" onClick={riprova} disabled={inCorso}
          className="font-bold text-brand disabled:opacity-50">
          {inCorso ? 'Invio…' : 'Riprova'}
        </button>
      )}
    </div>
  )
}
