import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { MonitorUp } from 'lucide-react'

// Funzioni di utility ereditate per la formattazione
const getBlockTitle = (block) => {
  const formatVal = v => (v && !v.includes('min') && !v.includes('sec')) ? `${v} min` : (v || '1:00 min')

  if (['WarmUp', 'Rest'].includes(block.type)) return block.type
  if (block.type === 'ON/OFF') {
    const rounds = parseInt(block.params?.rounds, 10) || 10
    return `ON/OFF · ${formatVal(block.params?.on)} ON / ${formatVal(block.params?.off)} OFF · ${rounds} rounds`
  }
  if (block.type === 'EMOM') {
    const rounds = parseInt(block.params?.rounds || '10', 10) || 10
    return `EMOM · ${formatVal(block.params?.interval)} x ${rounds} rounds`
  }
  if (block.type === 'AMRAP') {
     const dur = block.params?.duration || '10:00'
     return dur.includes('min') ? `AMRAP · ${dur}` : `AMRAP · ${dur} min`
  }
  if (block.type === 'For Time') return `For Time · ${block.params?.rounds || '3'} rounds`
  if (block.type === 'Interval') return `Interval · ${block.params?.rounds || '1'} rounds`

  if (['Cash In', 'Cash Out'].includes(block.type)) {
    const rounds = block.params?.rounds || '1';
    const rest = (parseInt(rounds, 10) > 1 && block.params?.rest && block.params.rest !== '-') ? ` · ${block.params.rest} rest` : '';
    return rounds !== '1' ? `${block.type} · ${rounds} rounds${rest}` : block.type;
  }
  return block.type
}

const TYPE_COLORS = {
  'WarmUp': { text: 'text-gray-400', border: 'border-[#383838]' },
  'Rest': { text: 'text-gray-500', border: 'border-[#2a2a2a]' },
  'Cash In': { text: 'text-gray-300', border: 'border-[#444]' },
  'Cash Out': { text: 'text-gray-300', border: 'border-[#444]' },
  'ON/OFF': { text: 'text-[#f1ba17]', border: 'border-[#f1ba17]/50' },
  'EMOM': { text: 'text-[#f1ba17]', border: 'border-[#f1ba17]/50' },
  'AMRAP': { text: 'text-[#f1ba17]', border: 'border-[#f1ba17]/50' },
  'For Time': { text: 'text-[#f1ba17]', border: 'border-[#f1ba17]/50' },
  'Interval': { text: 'text-[#f1ba17]', border: 'border-[#f1ba17]/50' },
  'Running': { text: 'text-[#0094C6]', border: 'border-[#0094C6]/50' }
}

export default function TVDashboard() {
  const [code, setCode] = useState(null)
  const [workout, setWorkout] = useState(null)
  const [status, setStatus] = useState('waiting') // 'waiting', 'loading', 'active'
  const [error, setError] = useState(null)

  useEffect(() => {
    let channel;
    
    const initTV = async () => {
      // Genera un codice casuale di 4 cifre
      const newCode = Math.floor(1000 + Math.random() * 9000).toString()
      setCode(newCode)

      const { error: insertErr } = await supabase.from('tv_sessions').upsert({
        code: newCode,
        updated_at: new Date().toISOString()
      }, { onConflict: 'code' })

      if (insertErr) {
        setError("Errore connessione. Ricarica la pagina.")
        return
      }

      // Resta in ascolto degli aggiornamenti in "Tempo Reale" via Supabase
      channel = supabase.channel(`tv_${newCode}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tv_sessions', filter: `code=eq.${newCode}` }, async (payload) => {
          const newWorkoutId = payload.new.workout_id
          if (newWorkoutId) {
            setStatus('loading')
            const { data: wData } = await supabase.from('workouts').select('*').eq('id', newWorkoutId).single()
            if (wData) {
              setWorkout(wData)
              setStatus('active')
            } else {
              setError("Workout non trovato.")
            }
          }
        })
        .subscribe()
    }

    initTV()

    return () => {
      if (channel) supabase.removeChannel(channel)
      if (code) supabase.from('tv_sessions').delete().eq('code', code).then()
    }
  }, [])

  if (error) return <div className="h-screen bg-black flex items-center justify-center text-red-500 font-bold text-2xl">{error}</div>

  if (status === 'waiting') {
    return (
      <div className="h-screen bg-black flex flex-col items-center justify-center text-white p-10 relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center opacity-[0.03]">
          <MonitorUp size={600} className="text-[#f1ba17]" />
        </div>
        <div className="relative z-10 flex flex-col items-center animate-in fade-in zoom-in duration-500">
          <h1 className="text-6xl font-black tracking-tight mb-8">FLEO<span className="text-[#f1ba17]">FIT</span> TV</h1>
          <p className="text-3xl text-gray-400 mb-5">Apri l'app sul tuo telefono e clicca sull'icona della TV.</p>
          <p className="text-2xl text-gray-500 mb-10">Inserisci questo codice per avviare la trasmissione:</p>
          <div className="bg-[#1e1e1e] border-2 border-[#333] rounded-3xl px-16 py-8 shadow-2xl">
            <span className="text-9xl font-black tracking-[0.2em] ml-[0.2em] text-[#f1ba17] drop-shadow-lg">{code || '...'}</span>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'loading') return <div className="h-screen bg-black flex items-center justify-center text-[#f1ba17] text-3xl font-bold animate-pulse">Trasmissione in corso...</div>

  const s = workout?.sections || {}
  const isRun = s.category === 'Running' || s.steps || s.main?.type === 'Running'
  
  let blocks = []
  if (s.blocks) blocks = s.blocks
  else {
    if (s.warmup) blocks.push({ id: 'w', type: 'WarmUp', params: { duration: s.warmup.duration }, notes: s.warmup.notes })
    if (s.cashIn?.length > 0) blocks.push({ id: 'ci', type: 'Cash In', exercises: s.cashIn })
    if (s.main && !isRun) blocks.push({ id: 'm', type: s.main.type === 'EMOM' && s.main.params?.on ? 'ON/OFF' : s.main.type, params: s.main.params || {}, exercises: s.main.exercises || [] })
    if (s.cashOut?.length > 0) blocks.push({ id: 'co', type: 'Cash Out', exercises: s.cashOut })
  }

  return (
    <div className="min-h-screen bg-[#0B0B0B] text-white p-12 relative overflow-auto">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex items-center justify-between mb-12 border-b-2 border-[#2a2a2a] pb-8">
          <div className="flex flex-col">
            <h1 className="text-6xl font-black text-white">{workout.title}</h1>
            <p className="text-2xl text-[#f1ba17] font-bold mt-3 uppercase tracking-widest">{isRun ? 'ALLENAMENTO CORSA' : 'ALLENAMENTO HYROX'}</p>
          </div>
          <h2 className="text-5xl font-black tracking-tight">FLEO<span className="text-[#f1ba17]">FIT</span></h2>
        </div>

        {/* Questo blocco supporta il Masonry layout se i blocchi sono di varie altezze */}
        <div className={isRun ? "flex flex-col gap-8" : "grid grid-cols-2 gap-10 items-start"}>
          {!isRun ? blocks.map((b, i) => {
            const color = TYPE_COLORS[b.type] || TYPE_COLORS['ON/OFF']
            return (
              <div key={i} className={`bg-[#1e1e1e] border-2 ${color.border} rounded-[32px] p-8 shadow-xl flex flex-col`}>
                <h3 className={`text-3xl font-black uppercase mb-6 ${color.text}`}>{getBlockTitle(b)}</h3>
                {['WarmUp', 'Rest'].includes(b.type) ? (
                  <p className="text-4xl text-gray-300 font-bold">{b.params?.duration} <span className="text-2xl text-gray-500 block mt-2 font-normal">{b.notes ? b.notes : ''}</span></p>
                ) : (
                  <div className="flex flex-col gap-4 mt-2">
                    {(b.exercises || []).map((ex, j) => {
                      const detail = (ex.duration && ex.duration !== '-') ? ex.duration : (ex.meters && ex.meters !== '-') ? ex.meters : (ex.reps && ex.reps !== '-' ? `${ex.reps} reps` : '')
                      const pace = ex.ergoPace && ex.ergoPace !== '-' && ex.ergoPace !== 'Libero' ? `@ ${ex.ergoPace}` : ''
                      const kg = ex.kg ? `${ex.kg}kg` : ''
                      return (
                        <div key={j} className="flex items-start gap-5 bg-[#111] p-5 rounded-2xl">
                          <span className={`text-3xl font-black ${color.text}`}>{j + 1}.</span>
                          <div className="flex flex-col">
                            <span className="text-3xl font-bold text-white leading-tight">{ex.name}</span>
                            <span className="text-2xl text-gray-400 font-semibold mt-2">
                              {[detail, pace, kg].filter(Boolean).join(' · ')}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          }) : (
            <div className="bg-[#1e1e1e] border-2 border-[#0094C6]/50 rounded-[32px] p-10 shadow-xl">
               <div className="flex flex-col gap-8">
                 {(s.steps || s.main?.steps || []).map((step, i) => (
                   <div key={i} className="flex flex-col border-l-[6px] border-[#333] pl-8 py-2">
                      <span className={`text-2xl font-black uppercase tracking-wider mb-3 ${step.type === 'run' ? 'text-[#0094C6]' : step.type === 'repeat' ? 'text-purple-400' : 'text-gray-400'}`}>
                        {step.type === 'repeat' ? `RIPETUTE (${step.rounds}x)` : step.type}
                      </span>
                      {step.type === 'repeat' ? (
                        <div className="flex flex-col gap-4 text-3xl font-bold mt-2">
                          <div className="bg-[#111] p-6 rounded-3xl border border-[#333]"><span className="text-gray-400">Corsa:</span> {step.runDuration} {step.runPace && <span className="text-[#0094C6] ml-3">@{step.runPace}</span>}</div>
                          <div className="bg-[#111] p-6 rounded-3xl border border-[#333]"><span className="text-gray-400">Recupero:</span> {step.recDuration} {step.recPace && <span className="text-green-500 ml-3">@{step.recPace}</span>}</div>
                        </div>
                      ) : (
                        <div className="text-4xl font-bold text-white mt-2">
                          {step.duration} {step.pace && <span className="text-gray-400 ml-4">@{step.pace}</span>}
                        </div>
                      )}
                      {step.notes && <p className="text-2xl text-gray-500 mt-4 italic">"{step.notes}"</p>}
                   </div>
                 ))}
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}