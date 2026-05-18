import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { MonitorUp, Timer, Flag, FlagOff, Dumbbell, BicepsFlexed, RotateCw } from 'lucide-react'

const ERGOMETERS = ['SkiErg', 'Rowing', 'Assault Bike', 'Echo Bike', 'TrueForm Runner', 'Curve Treadmill']
const isErgo = (name) => ERGOMETERS.includes(name)

const SCHEMES = {
  prep:  { bg: 'bg-[#f1ba17]', text: 'text-black', sub: 'text-black/70', card: 'bg-black/10 border-black/20 text-black', cardLabel: 'text-black/60', icon: 'text-black', btnBg: 'bg-black text-[#f1ba17]' },
  run:   { bg: 'bg-[#0094C6]', text: 'text-white', sub: 'text-white/80', card: 'bg-black/20 border-white/10 text-white', cardLabel: 'text-white/60', icon: 'text-white', btnBg: 'bg-white text-[#0094C6]' },
  rest:  { bg: 'bg-[#1e1e1e]', text: 'text-green-400', sub: 'text-green-500/80', card: 'bg-[#111] border-green-500/20 text-green-400', cardLabel: 'text-green-500/60', icon: 'text-gray-400', btnBg: 'bg-green-500 text-black' },
  hyrox: { bg: 'bg-[#D11149]', text: 'text-white', sub: 'text-white/80', card: 'bg-black/20 border-white/10 text-white', cardLabel: 'text-white/60', icon: 'text-white', btnBg: 'bg-white text-[#D11149]' },
  emom:  { bg: 'bg-[#111]', text: 'text-[#f1ba17]', sub: 'text-[#f1ba17]/80', card: 'bg-[#1e1e1e] border-[#f1ba17]/20 text-[#f1ba17]', cardLabel: 'text-[#f1ba17]/60', icon: 'text-gray-400', btnBg: 'bg-[#f1ba17] text-black' },
  base:  { bg: 'bg-[#0B0B0B]', text: 'text-white', sub: 'text-gray-400', card: 'bg-[#1e1e1e] border-[#333] text-white', cardLabel: 'text-gray-500', icon: 'text-gray-400', btnBg: 'bg-[#f1ba17] text-black' },
  done:  { bg: 'bg-green-500', text: 'text-black', sub: 'text-black/80', card: 'bg-black/10 border-black/20 text-black', cardLabel: 'text-black/60', icon: 'text-black', btnBg: 'bg-black text-green-500' }
}

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

function Section({ icon, label, color, stepNumber, className = "", isActive, children }) {
  return (
    <div className={`bg-[#1e1e1e] border-4 ${isActive ? 'border-[#f1ba17] shadow-[0_0_40px_rgba(241,186,23,0.3)] scale-[1.02]' : color} rounded-[2rem] p-6 flex flex-col gap-4 shadow-2xl relative transition-all duration-500 ${className}`}>
      {stepNumber && (
        <div className="absolute top-4 right-6 w-14 h-14 bg-[#111] border-4 border-[#333] text-[#f1ba17] font-black text-2xl flex items-center justify-center rounded-full z-10 shadow-lg">
          {stepNumber}
        </div>
      )}
      <div className="flex items-start gap-4 border-b-2 border-[#333] pb-4 shrink-0 pr-16">
        <div className="mt-1 shrink-0">{icon}</div>
        <span className="text-white font-black text-3xl uppercase tracking-wider leading-tight">{label}</span>
      </div>
      <div className="flex-1 flex flex-col justify-center gap-4">
        {children}
      </div>
    </div>
  )
}

function ExList({ exercises, showMinute, typeColor }) {
  return (
    <div className="flex flex-col w-full gap-3">
      {exercises.map((ex, i) => {
        const detail = ex.exTime && ex.exTime !== '-' ? ex.exTime : ((ex.meters && ex.meters !== '-') ? ex.meters : (ex.reps && ex.reps !== '-' ? `${ex.reps} reps` : ''))
        const paceStr = isErgo(ex.name) && ex.ergoPace && ex.ergoPace !== '-' && ex.ergoPace !== 'Libero' ? `@ ${ex.ergoPace}` : ''

        return (
        <div key={ex.id || i} className="flex items-start gap-4 bg-[#111] px-5 py-4 rounded-2xl border-2 border-[#333]">
          {showMinute && (
            <div className="w-10 h-10 rounded-full bg-[#222] border-2 border-[#333] flex items-center justify-center shrink-0 mt-1">
              <span className={`text-lg font-black ${typeColor}`}>{i + 1}</span>
            </div>
          )}
          <div className="flex-1 flex flex-col justify-center">
            <span className="text-white text-3xl font-black leading-tight break-words">{ex.name}</span>
            <span className="text-gray-400 text-2xl font-bold mt-1 break-words">
              {[detail, paceStr, ex.kg ? `${ex.kg}kg` : ''].filter(Boolean).join(' · ')}
              {ex.notes && <span className="text-gray-500 font-medium ml-2">· {ex.notes}</span>}
            </span>
          </div>
          {ex.intensity && (
            <div className="flex items-center gap-2 shrink-0 bg-[#222] px-4 py-2 rounded-2xl border-2 border-[#444] mt-1">
               <span className={`text-xl font-black ${getIntensityColor(ex.intensity)}`}>{ex.intensity}/10</span>
               <BicepsFlexed size={28} className={getIntensityColor(ex.intensity)} />
            </div>
          )}
        </div>
      )})}
    </div>
  )
}

function RunningList({ steps, activeIdx }) {
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
    <div className="flex flex-col w-full gap-4">
      {steps.map((step, i) => (
        <div key={step.id || i} className={`flex flex-col justify-center border-l-[8px] ${i === activeIdx ? 'border-[#0094C6] bg-[#0094C6]/10 shadow-[inset_0_0_20px_rgba(0,148,198,0.2)] rounded-r-2xl py-4' : 'border-[#333] py-2'} pl-6 transition-all duration-500`}>
          <div className="flex items-center gap-4 mb-2">
            <span className={`text-3xl font-black uppercase tracking-wider ${getTypeColor(step.type)}`}>
              {getTypeLabel(step.type)}
            </span>
            {step.type === 'repeat' && <span className="text-3xl font-black bg-[#0B0B0B] px-5 py-1.5 rounded-full border-2 border-[#333]">x{step.rounds}</span>}
          </div>
          {step.type === 'repeat' ? (
            <div className="text-3xl font-bold flex flex-col gap-4 mt-2">
              <div className="flex items-start justify-between bg-[#111] px-6 py-5 rounded-3xl border-2 border-[#333]">
                <div className="flex-1 break-words pr-4"><span className="text-gray-500 mr-3">Corsa:</span> <span className="text-white">{step.runDuration}</span> {step.runPace && <span className="text-[#0094C6] ml-3 whitespace-nowrap">@{step.runPace}</span>}</div>
                {step.runIntensity && <div className="flex items-center gap-2 shrink-0 mt-1"><span className={`text-3xl font-black ${getIntensityColor(step.runIntensity)}`}>{step.runIntensity}/10</span><BicepsFlexed size={36} className={getIntensityColor(step.runIntensity)} /></div>}
              </div>
              <div className="flex items-start justify-between bg-[#111] px-6 py-5 rounded-3xl border-2 border-[#333]">
                <div className="flex-1 break-words pr-4"><span className="text-gray-500 mr-3">Recupero:</span> <span className="text-white">{step.recDuration}</span> {step.recPace && <span className="text-green-500 ml-3 whitespace-nowrap">@{step.recPace}</span>}</div>
                {step.recIntensity && <div className="flex items-center gap-2 shrink-0 mt-1"><span className={`text-3xl font-black ${getIntensityColor(step.recIntensity)}`}>{step.recIntensity}/10</span><BicepsFlexed size={36} className={getIntensityColor(step.recIntensity)} /></div>}
              </div>
              {step.notes && <p className="text-gray-500 text-2xl font-medium mt-1 break-words">"{step.notes}"</p>}
            </div>
          ) : (
            <div className="flex items-start justify-between text-4xl font-bold mt-2">
              <div className="flex-1 break-words pr-4">
                {step.duration && <span className="font-semibold text-white">{step.duration}</span>}
                {step.pace && <span className="ml-4 text-gray-400 whitespace-nowrap">@{step.pace}</span>}
                {step.notes && <p className="text-gray-500 text-2xl font-medium mt-3 break-words">"{step.notes}"</p>}
              </div>
              {step.intensity && <div className="flex items-center gap-2 shrink-0 bg-[#111] px-5 py-2.5 rounded-2xl border-2 border-[#333] mt-1"><span className={`text-3xl font-black ${getIntensityColor(step.intensity)}`}>{step.intensity}/10</span><BicepsFlexed size={36} className={getIntensityColor(step.intensity)} /></div>}
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
  const [timerState, setTimerState] = useState(null)

  useEffect(() => {
    const updateScale = () => {
      const container = document.getElementById('tv-canvas-container');
      const inner = document.getElementById('tv-inner-content');
      if (container && inner) {
        const screenW = window.innerWidth;
        const screenH = window.innerHeight;
        const isRotated = inner.style.transform.includes('rotate(90deg)');
        
        if (isRotated) {
           const requiredVisualWidth = inner.scrollHeight;
           let finalScale = Math.min(screenW / Math.max(1920, requiredVisualWidth), screenH / 1080);
           container.style.transform = `scale(${finalScale})`;
        } else {
           const requiredVisualHeight = Math.max(1080, inner.scrollHeight);
           let finalScale = Math.min(screenW / 1920, screenH / requiredVisualHeight);
           container.style.transform = `scale(${finalScale})`;
        }
      }
    };
    updateScale();

    const resizeObserver = new ResizeObserver(() => {
      updateScale();
    });
    const inner = document.getElementById('tv-inner-content');
    if (inner) resizeObserver.observe(inner);

    window.addEventListener('resize', updateScale);
    
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
      channel = supabase.channel(`tv_${newCode}`, {
        config: { broadcast: { ack: false } }
      })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tv_sessions', filter: `code=eq.${newCode}` }, async (payload) => {
          if (payload.eventType === 'DELETE') {
            setStatus('waiting')
            setWorkout(null)
            setError(null)
            setTimerState(null)
            return
          }
          
          const newWorkoutId = payload.new?.workout_id
          if (newWorkoutId) {
            setStatus('loading')
            const { data: wData } = await supabase.from('workouts').select('*').eq('id', newWorkoutId).maybeSingle()
            if (wData) {
              setWorkout(wData)
              setStatus('active')
              setError(null)
            } else {
              setError("Workout non trovato.")
            }
          } else {
            setStatus('waiting')
            setWorkout(null)
            setError(null)
            setTimerState(null)
          }
        })
        .on('broadcast', { event: 'timer_state' }, (payload) => {
          setTimerState(payload.payload)
        })
        .on('broadcast', { event: 'timer_close' }, () => {
          setTimerState(null)
        })
        .subscribe()
    }

    initTV()

    return () => {
      if (channel) supabase.removeChannel(channel)
      if (code) supabase.from('tv_sessions').delete().eq('code', code).then()
      window.removeEventListener('resize', updateScale);
      if (inner) resizeObserver.unobserve(inner);
    }
  }, [])

  const renderContent = () => {
    if (error) {
      return <div className="flex h-full items-center justify-center text-red-500 font-bold text-2xl p-10 text-center">{error}</div>
    }

    if (status === 'waiting') {
      return (
        <div className="flex flex-col items-center justify-center flex-1 h-full text-white p-10 relative w-full">
          <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none">
            <MonitorUp size={rotated ? 800 : 600} className="text-[#f1ba17]" />
          </div>
          <div className="absolute top-8 right-8 z-50">
            <button onClick={() => setRotated(!rotated)} className="p-4 bg-[#111] border-2 border-[#333] rounded-full text-gray-400 hover:text-white transition shadow-2xl">
              <RotateCw size={32} />
            </button>
          </div>
          <div className="relative z-10 flex flex-col items-center justify-center flex-1 animate-in fade-in zoom-in duration-500 text-center">
            <h1 className="text-[120px] font-black tracking-tight mb-8 leading-none">FLEO<span className="text-[#f1ba17]">FIT</span> TV</h1>
            <p className="text-5xl text-gray-400 mb-6">Apri l'app sul tuo telefono e clicca sull'icona della TV.</p>
            <p className="text-4xl text-gray-500 mb-12">Inserisci questo codice per avviare la trasmissione:</p>
            <div className="bg-[#1e1e1e] border-4 border-[#333] rounded-[3rem] px-32 py-16 shadow-2xl">
              <span className="text-[150px] font-black tracking-[0.3em] ml-[0.3em] text-[#f1ba17] drop-shadow-2xl leading-none">{code || '...'}</span>
            </div>
          </div>
        </div>
      )
    }

    if (status === 'loading') {
      return <div className="flex h-full items-center justify-center text-[#f1ba17] text-6xl font-bold animate-pulse">Trasmissione in corso...</div>
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

    let activeIdx = -1;
    if (timerState?.step?.id) {
      const parts = timerState.step.id.split('-');
      if (parts[0] === 'blk' || parts[0] === 'run' || parts[0] === 'step') {
        activeIdx = parseInt(parts[1], 10);
      }
    }

    const formatT = (totalSeconds) => {
      if (isNaN(totalSeconds)) return '0:00';
      const m = Math.floor(totalSeconds / 60);
      const s = totalSeconds % 60;
      return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const totalItems = (isRunning ? 1 : blocks.length) + (workout.coach_notes ? 1 : 0);
    
    let cols = 1;
    let rows = 1;
    if (!rotated) {
      if (totalItems === 1) { cols = 1; rows = 1; }
      else if (totalItems === 2) { cols = 2; rows = 1; }
      else if (totalItems === 3) { cols = 3; rows = 1; }
      else if (totalItems === 4) { cols = 2; rows = 2; }
      else if (totalItems === 5 || totalItems === 6) { cols = 3; rows = 2; }
      else if (totalItems === 7 || totalItems === 8) { cols = 4; rows = 2; }
      else { cols = Math.ceil(totalItems / 2); rows = 2; }
    }

    const getSectionClass = (t) => {
      return "";
    }

    const getIconForType = (t) => {
      const sz = 40;
      if (t === 'WarmUp' || t === 'Rest') return <Timer size={sz} className={TYPE_COLORS[t]?.text} />
      if (t === 'Cash In') return <Flag size={sz} className={TYPE_COLORS[t]?.text} />
      if (t === 'Cash Out') return <FlagOff size={sz} className={TYPE_COLORS[t]?.text} />
      return <Dumbbell size={sz} className={TYPE_COLORS[t]?.text} />
    }

    return (
      <div className="w-full min-h-full p-10 flex flex-col gap-8 relative">
        {/* Header */}
        <div className="flex items-center justify-between gap-6 shrink-0 bg-[#1e1e1e] p-8 rounded-[2.5rem] border-4 border-[#333] shadow-2xl">
          <div className="flex flex-col gap-4 flex-1">
            <h1 className="text-6xl font-black text-white tracking-tight leading-none break-words">{workout.title}</h1>
            <div className="flex items-center gap-4">
              <span className={`text-3xl font-black px-6 py-2.5 rounded-2xl uppercase tracking-wider ${type === 'Event' ? 'bg-white text-black border-white' : `${c.bg} ${c.text} border-2 ${c.border}`}`}>
                {type === 'Event' ? 'Gara / Evento' : (isRunning ? 'Allenamento Corsa' : 'Allenamento Hyrox')}
              </span>
              {workout.sections?.intensity && (
                <div className="flex items-center gap-3 bg-[#111] border-2 border-[#333] px-6 py-2.5 rounded-2xl">
                  <span className={`text-3xl font-black ${getIntensityColor(workout.sections.intensity)}`}>
                    Intensità {workout.sections.intensity}/10
                  </span>
                  <BicepsFlexed size={36} className={getIntensityColor(workout.sections.intensity)} />
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-4 mb-2">
              <button onClick={() => setRotated(!rotated)} className="p-4 bg-[#111] border-2 border-[#333] rounded-full text-gray-400 hover:text-white transition" title="Ruota Orientamento">
                <RotateCw size={36} />
              </button>
              <h1 className="text-6xl font-black text-white tracking-tight">FLEO<span className="text-[#f1ba17]">FIT</span> TV</h1>
            </div>
            <p className="text-3xl text-gray-500 font-bold">@FLEOFIT</p>
          </div>
        </div>

        {/* Blocks */}
        <div className="w-full flex-1">
           <div 
             className={rotated ? "flex flex-col gap-8 w-full" : "grid gap-8 w-full"}
             style={!rotated ? {
               gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`
             } : undefined}
           >
             {!isRunning && type !== 'Custom' && type !== 'Event' ? (
                blocks.map((block, idx) => (
                  <Section key={block.id || idx} icon={getIconForType(block.type)} label={getBlockTitle(block)} color={TYPE_COLORS[block.type]?.border} stepNumber={blocks.length > 1 ? idx + 1 : null} className={getSectionClass(block.type)} isActive={idx === activeIdx}>
                      {['WarmUp', 'Rest'].includes(block.type) ? (
                        <p className="text-gray-300 text-4xl font-bold">{block.params?.duration} {block.notes ? <span className="text-gray-500 text-3xl block mt-4">· {block.notes}</span> : ''}</p>
                      ) : (
                        <ExList exercises={block.exercises || []} showMinute={block.type === 'EMOM' || block.type === 'ON/OFF'} typeColor={TYPE_COLORS[block.type]?.text} />
                      )}
                  </Section>
                ))
              ) : isRunning ? (
                  <Section icon={<Timer size={40} className={c.text} />} label="Allenamento Corsa" color={c.border}>
                    <RunningList steps={s?.steps || s?.main?.steps || []} activeIdx={activeIdx} />
                  </Section>
              ) : null}

              {/* Note Coach */}
              {workout.coach_notes && (
                <Section icon={<span className="text-[#f1ba17] text-5xl">📋</span>} label="Note Coach" color="border-[#f1ba17]/40">
                  <p className="text-gray-300 text-4xl leading-relaxed font-semibold italic">"{workout.coach_notes}"</p>
                </Section>
              )}
           </div>
        </div>
        
        {/* TIMER FLOATING BAR NON INVASIVA */}
        {timerState && (
          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-[#111] border-4 border-[#333] rounded-[3rem] px-12 py-6 flex items-center justify-between min-w-[1000px] shadow-[0_30px_80px_rgba(0,0,0,0.9)] z-[100] animate-in slide-in-from-bottom-24 duration-500">
             <div className="flex flex-col flex-1 pr-8">
               <span className="text-[#f1ba17] font-bold text-3xl uppercase tracking-widest">{timerState.step?.title}</span>
               <span className="text-white font-medium text-5xl truncate mt-2">{timerState.step?.task}</span>
             </div>
             <div className="w-1 h-24 bg-[#333] rounded-full mx-8"></div>
             <span className="text-[120px] font-black text-white tabular-nums tracking-tighter leading-none shrink-0" style={{ fontVariantNumeric: 'tabular-nums' }}>
               {formatT(timerState.timeLeft)}
             </span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden">
      <div
        id="tv-canvas-container"
        style={{
          width: '1920px',
          height: '1080px',
          transformOrigin: 'center',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0b0b0b'
        }}
      >
        <div 
          id="tv-inner-content"
          className="bg-[#0B0B0B] text-white relative transition-all duration-500 ease-in-out flex flex-col"
          style={{
            width: rotated ? '1080px' : '1920px',
            minHeight: rotated ? '1920px' : '1080px',
            height: 'max-content',
            transform: rotated ? 'rotate(90deg)' : 'none',
            transformOrigin: 'center'
          }}
        >
          {renderContent()}
        </div>
      </div>
    </div>
  )
}