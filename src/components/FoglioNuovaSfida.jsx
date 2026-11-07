// FoglioNuovaSfida — un allenamento del team diventa una sfida (06/11/2026,
// spec §6). Si sceglie un workout fra quelli del coach, il giorno e cosa si
// misura. Il bottone dice a quanti va: solo chi è DENTRO adesso.
// ⚠️ X «Chiudi» e «Annulla»: il tasto indietro di Android li trova.
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { separaCodice } from '../lib/codiceWorkout'
import { METRICHE } from '../lib/sfidaTeam'
import { ETICHETTE_METRICA } from '../lib/membriTeam'
import { BOTTONE_BRAND, BOTTONE_QUIETO, LABEL } from '../lib/stiliCard'
import { useBottomSheet } from '../useBottomSheet'
import { Foglio } from './FoglioMessaggio'
import { CAMPO_TEAM, CampoTeam, Pillola } from './TeamUI'

const oggi = () => new Date().toISOString().slice(0, 10)

export default function FoglioNuovaSfida({ dentro, onCrea, onChiudi }) {
  const sheet = useBottomSheet(onChiudi)
  const navigate = useNavigate()
  const [workouts, setWorkouts] = useState(null)
  const [cerca, setCerca] = useState('')
  const [scelto, setScelto] = useState(null)
  const [data, setData] = useState(oggi())
  const [metrica, setMetrica] = useState(null)
  const [invio, setInvio] = useState(false)

  useEffect(() => {
    let vivo = true
    supabase.from('workouts').select('id, title, date, sections').order('date', { ascending: false }).limit(80)
      .then(({ data: righe, error }) => {
        if (!vivo) return
        if (error) { console.warn('Workout non caricati:', error); setWorkouts([]); return }
        // Una gara non è un allenamento da confrontare.
        setWorkouts((righe || []).filter(w => w.sections?.category !== 'Event' && !w.sections?.isEvent))
      })
    return () => { vivo = false }
  }, [])

  const filtrati = useMemo(() => {
    const q = cerca.trim().toLowerCase()
    return (workouts || []).filter(w => !q || String(w.title || '').toLowerCase().includes(q)).slice(0, 30)
  }, [workouts, cerca])

  const pronto = !!scelto && !!metrica && !!data && dentro > 0 && !invio
  const testo = dentro === 1 ? 'Assegna a 1 atleta' : `Assegna a ${dentro} atleti`

  const crea = async () => {
    if (!pronto) return
    setInvio(true)
    const ok = await onCrea({ workoutId: scelto, metrica, data })
    if (ok) sheet.chiudi()
    else setInvio(false)
  }

  return (
    <Foglio titolo="Nuova sfida" {...sheet}>
      <div className="flex flex-col gap-3.5 pb-1">
        <CampoTeam etichetta="Cerca un allenamento" valore={cerca} onChange={setCerca} placeholder="Nome del workout" />
        <ul className="flex flex-col gap-1.5 max-h-[30dvh] overflow-y-auto">
          {filtrati.map(w => (
            <li key={w.id}>
              <button type="button" aria-pressed={scelto === w.id} onClick={() => setScelto(w.id)}
                className={`w-full text-left rounded-xl px-3 py-2.5 border transition ${
                  scelto === w.id ? 'border-brand bg-brand/10' : 'border-white/[.08] bg-white/[.03] hover:border-white/20'}`}>
                <span className="block text-[14.5px] font-bold text-white truncate">{separaCodice(w.title || '').nome || w.title}</span>
                <span className="block text-[12px] text-muted">{w.sections?.category || ''}</span>
              </button>
            </li>
          ))}
          {workouts && filtrati.length === 0 && (
            <li className="text-[14px] text-gray-400 py-3 text-center">Nessun allenamento trovato.</li>
          )}
        </ul>
        <button type="button" onClick={() => navigate('/create')}
          className="self-start text-[13.5px] font-bold text-muted hover:text-white">
          Crea un allenamento nuovo
        </button>
        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>Giorno</span>
          <input type="date" aria-label="Giorno" value={data} onChange={e => setData(e.target.value)} className={CAMPO_TEAM} />
        </label>
        <div className="flex flex-col gap-1.5">
          <span className={LABEL}>Cosa si misura</span>
          <div role="group" aria-label="Cosa si misura" className="flex flex-wrap gap-2">
            {METRICHE.map(m => (
              <Pillola key={m} attivo={metrica === m} onClick={() => setMetrica(m)}>{ETICHETTE_METRICA[m]}</Pillola>
            ))}
          </div>
          {metrica && (
            <p className="text-[12.5px] text-muted">
              {metrica === 'tempo' ? 'Vince il tempo più basso.' : 'Vince il numero più alto.'}
            </p>
          )}
        </div>
        {dentro === 0 && (
          <p className="text-[13px] text-gray-400">Nessuno è ancora dentro il team: la sfida non andrebbe a nessuno.</p>
        )}
        <div className="flex gap-3 mt-1">
          <button type="button" onClick={sheet.chiudi} className={BOTTONE_QUIETO}>Annulla</button>
          <button type="button" onClick={crea} disabled={!pronto} className={BOTTONE_BRAND}>{testo}</button>
        </div>
      </div>
    </Foglio>
  )
}
