import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { MonitorUp, Timer, Flag, FlagOff, Dumbbell, BicepsFlexed, RotateCw } from 'lucide-react'

const ERGOMETERS = ['SkiErg', 'Rowing', 'Assault Bike', 'Echo Bike', 'TrueForm Runner', 'Curve Treadmill']
const isErgo = (name) => ERGOMETERS.includes(name)

const timeToSeconds = (timeStr) => {
  if (!timeStr) return 0;
  const str = String(timeStr);
  const parts = str.split(':')
  if (parts.length === 2) return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10)
  return 0
}

const formatTime = (totalSeconds) => {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  if (s === 0) return `${m} min`
  return `${m}:${s.toString().padStart(2, '0')} min`
}

const getBlockTitle = (block) => {
  const formatVal = v => (v && !v.includes('min') && !v.includes('sec')) ? `${v} min` : (v || '1:00 min')

  if (['WarmUp', 'Rest'].includes(block.type)) return block.type
  if (block.type === 'ON/OFF') {
    const onSec = timeToSeconds(block.params?.on || '1:00') || 60
    const offSec = timeToSeconds(block.params?.off || '1:00') || 60
    let rounds = parseInt(block.params?.rounds, 10)
    if (isNaN(rounds) && block.params?.total) {
      rounds = Math.ceil(timeToSeconds(block.params.total) / (onSec + offSec))
    }
    rounds = rounds || 10
    return `ON/OFF · ${formatVal(block.params?.on)} ON / ${formatVal(block.params?.off)} OFF · ${rounds} rounds · ${formatTime((onSec + offSec) * rounds)}`
  }
  if (block.type === 'EMOM') {
    const intervalSec = timeToSeconds(block.params?.interval || '1:00') || 60
    const rounds = parseInt(block.params?.rounds || '10', 10) || 10
    return `EMOM · ${formatVal(block.params?.interval)} x ${rounds} rounds · ${formatTime(intervalSec * rounds)}`
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
  'WarmUp': { text: 'text-gray-400', bg: 'bg-[#2a2a2a]', border: 'border-[#383838]' },
  'Rest': { text: 'text-gray-500', bg: 'bg-[#1e1e1e]', border: 'border-[#2a2a2a]' },
  'Cash In': { text: 'text-gray-300', bg: 'bg-[#222]', border: 'border-[#444]' },
  'Cash Out': { text: 'text-gray-300', bg: 'bg-[#222]', border: 'border-[#444]' },
  'ON/OFF': { text: 'text-gray-200', bg: 'bg-[#222]', border: 'border-[#333]' },
  'EMOM': { text: 'text-gray-200', bg: 'bg-[#222]', border: 'border-[#333]' },
  'AMRAP': { text: 'text-gray-200', bg: 'bg-[#222]', border: 'border-[#333]' },
  'For Time': { text: 'text-gray-200', bg: 'bg-[#222]', border: 'border-[#333]' },
  'Interval': { text: 'text-gray-200', bg: 'bg-[#222]', border: 'border-[#333]' },
  'Running': { text: 'text-[#0094C6]', bg: 'bg-[#0094C6]/10', border: 'border-[#0094C6]/30' },
  'Custom': { text: 'text-[#D11149]', bg: 'bg-[#D11149]/10', border: 'border-[#D11149]/30' },
  'Event': { text: 'text-white', bg: 'bg-white/10', border: 'border-white/30' }
}

const getIntensityColor = (val) => {
  const num = parseInt(val, 10);
  if (isNaN(num)) return 'text-gray-500';
  if (num <= 3) return 'text-green-400';
  if (num <= 6) return 'text-yellow-400';
  if (num <= 8) return 'text-orange-500';
  return 'text-red-500';
}

function Section({ icon, label, color, children }) {
  return (
    <div className={`bg-[#1e1e1e] border ${color} rounded-2xl p-4 mb-3`}>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <span className="text-white font-semibold text-sm">{label}</span>
      </div>
      {children}
    </div>
  )
}

function ExList({ exercises, showMinute, typeColor }) {
  return (
    <div className="flex flex-col gap-2 mt-1">
      {exercises.map((ex, i) => {
        const detail = ex.exTime && ex.exTime !== '-' ? ex.exTime : ((ex.meters && ex.meters !== '-') ? ex.meters : (ex.reps && ex.reps !== '-' ? `${ex.reps} reps` : ''))
        const paceStr = isErgo(ex.name) && ex.ergoPace && ex.ergoPace !== '-' && ex.ergoPace !== 'Libero' ? `@ ${ex.ergoPace}` : ''

        return (
        <div key={ex.id || i} className="flex items-center gap-3">
          {showMinute && (
            <div className="w-7 h-7 rounded-full bg-[#222] border border-[#333] flex items-center justify-center shrink-0">
              <span className={`text-xs font-bold ${typeColor}`}>{i + 1}</span>
            </div>
          )}
          <div className="flex-1">
            <span className="text-white text-sm font-medium">{ex.name}</span>
            <span className="text-gray-500 text-xs ml-2">
              {detail} {paceStr}
            </span>
            {ex.kg && <span className="text-gray-400 text-xs ml-2 font-bold">{ex.kg}kg</span>}
            {ex.notes && <span className="text-gray-600 text-xs ml-2">· {ex.notes}</span>}
          </div>
          {ex.intensity && (
            <div className="flex items-center gap-1 pr-2 shrink-0">
               <span className={`text-xs font-bold ${getIntensityColor(ex.intensity)}`}>{ex.intensity}/10</span>
               <BicepsFlexed size={14} className={getIntensityColor(ex.intensity)} />
            </div>
          )}
        </div>
      )})}
    </div>
  )
}

function RunningList({ steps }) {
  const getTypeLabel = (t) => {
    switch(t) {
      case 'warmup': return 'Riscaldamento'
      case 'run': return 'Corsa'
      case 'recover': return 'Recupero'
      case 'cooldown': return 'Defaticamento'
      case 'repeat': return 'Ripetute'
      default: return ''
    }
  }

  const getTypeColor = (t) => {
    switch(t) {
      case 'warmup': return 'text-orange-400'
      case 'run': return 'text-[#0094C6]'
      case 'recover': return 'text-green-400'
      case 'cooldown': return 'text-gray-400'
      case 'repeat': return 'text-purple-400'
      default: return 'text-white'
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {steps.map((step, i) => (
        <div key={step.id || i} className="flex flex-col border-l-2 border-[#333] pl-3 py-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-bold ${getTypeColor(step.type)}`}>
              {getTypeLabel(step.type)}
            </span>
            {step.type === 'repeat' && <span className="text-white text-sm font-bold bg-[#0B0B0B] px-2 py-0.5 rounded-full border border-[#333]">x{step.rounds}</span>}
          </div>
          {step.type === 'repeat' ? (
            <div className="text-sm flex flex-col gap-1 mt-1">
              <div className="flex items-center justify-between pr-2">
                <div><span className="text-gray-400">Corsa:</span> <span className="text-white">{step.runDuration}</span> {step.runPace && <span className="text-gray-500 text-xs">@{step.runPace}</span>}</div>
                {step.runIntensity && <div className="flex items-center gap-1"><span className={`text-xs font-bold ${getIntensityColor(step.runIntensity)}`}>{step.runIntensity}/10</span><BicepsFlexed size={12} className={getIntensityColor(step.runIntensity)} /></div>}
              </div>
              <div className="flex items-center justify-between pr-2">
                <div><span className="text-gray-400">Recupero:</span> <span className="text-white">{step.recDuration}</span> {step.recPace && <span className="text-gray-500 text-xs">@{step.recPace}</span>}</div>
                {step.recIntensity && <div className="flex items-center gap-1"><span className={`text-xs font-bold ${getIntensityColor(step.recIntensity)}`}>{step.recIntensity}/10</span><BicepsFlexed size={12} className={getIntensityColor(step.recIntensity)} /></div>}
              </div>
              {step.notes && <p className="text-gray-500 text-xs mt-0.5">{step.notes}</p>}
            </div>
          ) : (
            <div className="text-sm flex items-center justify-between pr-2">
              <div>
                {step.duration && <span className="font-semibold text-white">{step.duration}</span>}
                {step.pace && <span className="ml-2 text-gray-400">@{step.pace}</span>}
                {step.notes && <p className="text-gray-500 text-xs mt-1">{step.notes}</p>}
              </div>
              {step.intensity && <div className="flex items-center gap-1"><span className={`text-xs font-bold ${getIntensityColor(step.intensity)}`}>{step.intensity}/10</span><BicepsFlexed size={12} className={getIntensityColor(step.intensity)} /></div>}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default function TVDashboard() {
  const [code, setCode] = useState(null)
  const [workout, setWorkout] = useState(null)
  const [status, setStatus] = useState('waiting') // 'waiting', 'loading', 'active'
  const [error, setError] = useState(null)
  const [rotated, setRotated] = useState(false)

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
            const { data: wData } = await supabase.from('workouts').select('*').eq('id', newWorkoutId).maybeSingle()
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

  const renderContent = () => {
    if (error) {
      return <div className="flex h-full items-center justify-center text-red-500 font-bold text-2xl p-10 text-center">{error}</div>
    }

    if (status === 'waiting') {
      return (
        <div className="flex flex-col items-center justify-center h-full text-white p-10 relative">
          <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none">
            <MonitorUp size={400} className="text-[#f1ba17]" />
          </div>
          <div className="relative z-10 flex flex-col items-center animate-in fade-in zoom-in duration-500 text-center">
            <h1 className="text-5xl font-black tracking-tight mb-6">FLEO<span className="text-[#f1ba17]">FIT</span> TV</h1>
            <p className="text-xl text-gray-400 mb-4">Apri l'app sul tuo telefono e clicca sull'icona della TV.</p>
            <p className="text-lg text-gray-500 mb-8">Inserisci questo codice per avviare la trasmissione:</p>
            <div className="bg-[#1e1e1e] border-2 border-[#333] rounded-3xl px-12 py-6 shadow-2xl">
              <span className="text-7xl font-black tracking-[0.2em] ml-[0.2em] text-[#f1ba17] drop-shadow-lg">{code || '...'}</span>
            </div>
          </div>
        </div>
      )
    }

    if (status === 'loading') {
      return <div className="flex h-full items-center justify-center text-[#f1ba17] text-2xl font-bold animate-pulse">Trasmissione in corso...</div>
    }

    const s = workout?.sections || {}
    const rawCat = s?.category || (s?.main?.type === 'Running' || s?.steps ? 'Running' : 'Hyrox')
    const isAuto = rawCat === 'Custom' || rawCat === 'Autonomo' || s?.isAutonomous
    const isEvent = rawCat === 'Event'
    const category = isEvent ? 'Event' : (isAuto ? 'Custom' : rawCat)
    const isRunning = category === 'Running'
    
    let blocks = []
    if (s.blocks) blocks = s.blocks
    else {
      if (s.warmup) blocks.push({ id: 'w', type: 'WarmUp', params: { duration: s.warmup.duration }, notes: s.warmup.notes })
      if (s.cashIn?.length > 0) blocks.push({ id: 'ci', type: 'Cash In', exercises: s.cashIn })
      if (s.main && !isRunning) blocks.push({ id: 'm', type: s.main.type === 'EMOM' && s.main.params?.on ? 'ON/OFF' : s.main.type, params: s.main.params || {}, exercises: s.main.exercises || [] })
      if (s.cashOut?.length > 0) blocks.push({ id: 'co', type: 'Cash Out', exercises: s.cashOut })
    }

    const mainBlock = blocks.find(b => ['EMOM', 'ON/OFF', 'AMRAP', 'For Time'].includes(b.type)) || blocks[0] || { type: 'Hyrox' }
    const type = isEvent ? 'Event' : (isAuto ? 'Custom' : (isRunning ? 'Running' : mainBlock.type))
    const c = TYPE_COLORS[type] || TYPE_COLORS['Hyrox'] || { text: 'text-gray-200', bg: 'bg-[#222]', border: 'border-[#333]', hex: '#e5e5e5' }

    const getIconForType = (t) => {
      if (t === 'WarmUp' || t === 'Rest') return <Timer size={16} className={TYPE_COLORS[t]?.text} />
      if (t === 'Cash In') return <Flag size={16} className={TYPE_COLORS[t]?.text} />
      if (t === 'Cash Out') return <FlagOff size={16} className={TYPE_COLORS[t]?.text} />
      return <Dumbbell size={16} className={TYPE_COLORS[t]?.text} />
    }

    return (
      <div className="px-6 py-12 max-w-2xl mx-auto pb-24">
        {/* Header */}
        <div className="flex flex-col items-center justify-center mb-10 text-center">
          <h1 className="text-4xl font-black text-white tracking-tight mb-2">FLEO<span className="text-[#f1ba17]">FIT</span> TV</h1>
        </div>

        <div className="mb-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-white">{workout.title}</h1>
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <div className="flex items-center gap-2">
                {workout.sections?.intensity && (
                  <div className="flex items-center gap-1 bg-[#2a2a2a] border border-[#383838] px-2 py-1 rounded-lg">
                    <span className={`text-xs font-bold ${getIntensityColor(workout.sections.intensity)}`}>
                      {workout.sections.intensity}/10
                    </span>
                    <BicepsFlexed size={14} className={getIntensityColor(workout.sections.intensity)} />
                  </div>
                )}
                <span className={`text-xs font-bold px-3 py-1.5 rounded-xl shrink-0 ${type === 'Event' ? 'bg-white text-black border-white' : `${c.bg} ${c.text} border ${c.border}`}`}>
                  {type}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Blocks */}
        {!isRunning && type !== 'Custom' && type !== 'Event' ? (
          blocks.map((block, idx) => (
            <Section key={block.id || idx} icon={getIconForType(block.type)} label={getBlockTitle(block)} color={TYPE_COLORS[block.type]?.border}>
                {['WarmUp', 'Rest'].includes(block.type) ? (
                  <p className="text-gray-300 text-sm">{block.params?.duration} {block.notes ? ` · ${block.notes}` : ''}</p>
                ) : (
                  <ExList exercises={block.exercises || []} showMinute={block.type === 'EMOM' || block.type === 'ON/OFF'} typeColor={TYPE_COLORS[block.type]?.text} />
                )}
            </Section>
          ))
        ) : isRunning ? (
            <Section icon={<Timer size={16} className={c.text} />} label="Allenamento Corsa" color={c.border}>
              <RunningList steps={s?.steps || s?.main?.steps || []} />
            </Section>
        ) : null}

        {/* Note Coach */}
        {workout.coach_notes && (
          <Section icon={<span className="text-[#f1ba17] text-sm">📋</span>} label="Note Coach" color="border-[#f1ba17]/40">
            <p className="text-gray-300 text-sm leading-relaxed">{workout.coach_notes}</p>
          </Section>
        )}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center overflow-hidden">
      <div 
        className="bg-[#0B0B0B] text-white relative overflow-y-auto overflow-x-hidden hide-scrollbar transition-transform duration-500 ease-in-out"
        style={{
          width: rotated ? '100vh' : '100vw',
          height: rotated ? '100vw' : '100vh',
          transform: rotated ? 'rotate(90deg)' : 'none',
          transformOrigin: 'center',
        }}
      >
        <button 
          onClick={() => setRotated(!rotated)}
          className="fixed top-6 right-6 z-50 p-3 bg-[#1e1e1e] border border-[#333] rounded-full text-gray-400 hover:text-white transition shadow-xl"
          title="Ruota Orientamento"
        >
          <RotateCw size={24} />
        </button>

        {renderContent()}
      </div>
    </div>
  )
}