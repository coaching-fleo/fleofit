import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { Capacitor } from '@capacitor/core'
import { KeepAwake } from '@capacitor-community/keep-awake'
import { blockHint } from '../lib/blockHints'
import { ERGOMETERS } from '../lib/constants'
import { etichetteStazioni } from '../lib/stazioniEmom'
import { haIncremento, testoAumento } from '../lib/incremento'
import { coloreCategoria } from '../lib/colori'
import { durataBlocco, mmss, BLOCCHI_DI_LAVORO } from '../lib/stimaWorkout'
import { sottotitoloBlocco, specificheEsercizio } from '../lib/rigaBlocco'
import { esercizioInCorso } from '../lib/esercizioInCorso'
import {
  AttesaTV, CaricamentoTV, ErroreTV, TestataTV, TimerTV, BloccoTV, EsercizioTV,
  NotaBloccoTV, CorsaTV, CartaCorsaTV, NotaCoachTV,
} from '../components/TVDashboardUI'

// --- AUDIO GENERATOR HELPER ---
const writeString = (view, offset, string) => {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
};

const createBeepURI = (freq, durationMs) => {
  const sampleRate = 44100;
  const numSamples = Math.floor(sampleRate * (durationMs / 1000));
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);
  
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); 
  view.setUint16(20, 1, true); 
  view.setUint16(22, 1, true); 
  view.setUint32(24, sampleRate, true); 
  view.setUint32(28, sampleRate * 2, true); 
  view.setUint16(32, 2, true); 
  view.setUint16(34, 16, true); 
  writeString(view, 36, 'data');
  view.setUint32(40, numSamples * 2, true); 
  
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * freq * t);
    let envelope = 1;
    if (i < 1000) envelope = i / 1000;
    else if (i > numSamples - 1000) envelope = (numSamples - i) / 1000;
    view.setInt16(44 + i * 2, sample * 32767 * envelope, true);
  }
  
  const blob = new Blob([buffer], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
};

let shortBeepURI = null;
let longBeepURI = null;
let longerBeepURI = null;
if (typeof window !== 'undefined') {
  shortBeepURI = createBeepURI(600, 200);
  longBeepURI = createBeepURI(1200, 1000);
  longerBeepURI = createBeepURI(1200, 1500);
}

const isErgo = (name) => ERGOMETERS.includes(name)


const getIntensityColor = (val) => {
  const num = parseInt(val, 10);
  if (isNaN(num)) return 'text-muted';
  if (num <= 3) return 'text-green-400';
  if (num <= 6) return 'text-yellow-400';
  if (num <= 8) return 'text-orange-500';
  return 'text-red-500';
}

export default function TVDashboard() {
  const [code, setCode] = useState(null)
  const [workout, setWorkout] = useState(null)
  const [status, setStatus] = useState('waiting') // 'waiting', 'loading', 'active'
  const [error, setError] = useState(null)
  const [rotated, setRotated] = useState(false)
  const [timerState, setTimerState] = useState(null)
  const [lastTimerState, setLastTimerState] = useState(null)
  
  // Audio Sync System
  const [audioUnlocked, setAudioUnlocked] = useState(false)
  const audioUnlockedRef = useRef(false)
  const shortBeepAudio = useRef(null)
  const longBeepAudio = useRef(null)
  const longerBeepAudio = useRef(null)
  const prevTimerStateRef = useRef(null)
  const containerRef = useRef(null)

  // MANTIENI LO SCHERMO ACCESO SULLA TV
  useEffect(() => {
    let wakeLock = null;
    const keepScreenAwake = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          await KeepAwake.keepAwake();
        } catch { /* KeepAwake: se non riesce lo schermo si spegne, non è un errore bloccante */ }
      } else if ('wakeLock' in navigator) {
        try {
          wakeLock = await navigator.wakeLock.request('screen');
        } catch { /* Wake Lock API: se non riesce lo schermo si spegne, non è un errore bloccante */ }
      }
    };

    const allowScreenSleep = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          await KeepAwake.allowSleep();
        } catch { /* KeepAwake.allowSleep: se non riesce lo schermo si spegne, non è un errore bloccante */ }
      } else if (wakeLock !== null) {
        try {
          await wakeLock.release();
          wakeLock = null;
        } catch { /* rilascio del wake lock: se non riesce lo schermo si spegne, non è un errore bloccante */ }
      }
    };

    keepScreenAwake();
    return () => { allowScreenSleep(); };
  }, []);

  const unlockAudio = useCallback(() => {
    if (!audioUnlockedRef.current) {
       audioUnlockedRef.current = true;
       setAudioUnlocked(true);
       [shortBeepAudio.current, longBeepAudio.current, longerBeepAudio.current].forEach(a => {
          if (a) {
            a.volume = 0;
            const p = a.play();
            if (p !== undefined) {
              p.then(() => {
                a.pause();
                a.currentTime = 0;
                a.volume = 1;
              }).catch(()=>{});
            }
          }
        });
    }
  }, []);

  useEffect(() => {
    shortBeepAudio.current = new Audio(shortBeepURI);
    longBeepAudio.current = new Audio(longBeepURI);
    longerBeepAudio.current = new Audio(longerBeepURI);

    const handleFirstInteraction = () => {
      unlockAudio();
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };
    
    window.addEventListener('click', handleFirstInteraction);
    window.addEventListener('keydown', handleFirstInteraction);
    
    return () => {
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    }
  }, [unlockAudio]);

  const playBeep = useCallback((freq, duration) => {
    try {
      let audio;
      if (duration <= 0.2) audio = shortBeepAudio.current;
      else if (duration <= 1.0) audio = longBeepAudio.current;
      else audio = longerBeepAudio.current;

      if (audio) {
        audio.currentTime = 0;
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {});
        }
      }
    } catch { /* beep: WebAudio resta bloccato finché non c'è stato un tocco */ }
  }, []);

  useEffect(() => {
    if (timerState && timerState.isRunning && audioUnlocked) {
      const pt = prevTimerStateRef.current;
      const currentStep = timerState.step;
      const tl = timerState.timeLeft;
      
      if (pt && pt.isRunning && tl !== pt.timeLeft) {
        const stepType = currentStep?.type;
        if (stepType !== 'stopwatch' && stepType !== 'done') {
          if (tl === 0) {
            if (currentStep?.nextTask === 'Workout terminato 🎉') {
              playBeep(1200, 1.5);
            } else {
              playBeep(1200, 1.0);
            }
          } else if (tl <= 3 && tl > 0) {
            playBeep(600, 0.2);
          }
        }
      }
    }
    prevTimerStateRef.current = timerState;
  }, [timerState, audioUnlocked, playBeep]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.focus();
    }
  }, [status]);

  useEffect(() => {
    if (timerState) {
      setLastTimerState(timerState)
    }
  }, [timerState])

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
      return <ErroreTV messaggio={error} />
    }

    if (status === 'waiting') {
      return <AttesaTV codice={code} audioAttivo={audioUnlocked} ruotato={rotated} onRuota={() => setRotated(!rotated)} />
    }

    if (status === 'loading') {
      return <CaricamentoTV />
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

    // Solo lettura dello stato che arriva dal telefono: nessun conto sul tempo,
    // solo come mostrarlo. Gli step a cronometro (duration 0) non hanno una fine,
    // quindi niente barra.
    const passo = lastTimerState?.step
    const avanzamento = passo?.duration > 0 && lastTimerState
      ? (passo.duration - lastTimerState.timeLeft) / passo.duration
      : null
    const etichettaCategoria = category === 'Event' ? 'Gara / Evento'
      : category === 'Custom' ? 'Allenamento libero'
      : isRunning ? 'Allenamento di corsa'
      : category === 'Gym' ? 'Allenamento Gym'
      : 'Allenamento Hyrox'

    return (
      <div className={`w-full min-h-full flex flex-col relative ${rotated ? 'px-10 pt-10 pb-10 gap-7' : 'px-14 pt-12 pb-14 gap-10'}`}>
        <TestataTV
          coloreCategoria={coloreCategoria(category)}
          etichettaCategoria={etichettaCategoria}
          titolo={workout.title}
          intensita={workout.sections?.intensity}
          classeIntensita={getIntensityColor(workout.sections?.intensity)}
          audioAttivo={audioUnlocked}
          onRuota={() => setRotated(!rotated)}
          stretto={rotated}
        />

        <div className={`grid transition-[grid-template-rows] duration-500 ease-in-out ${timerState ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
          <div className="overflow-hidden">
            <div className={`transition-all duration-500 pb-2 ${timerState ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-8'}`}>
              <TimerTV
                titolo={passo?.title}
                sottotitolo={passo?.subtitle}
                compito={passo?.task}
                poi={passo?.nextTask}
                tempo={lastTimerState ? formatT(lastTimerState.timeLeft) : '0:00'}
                avanzamento={avanzamento}
                tema={passo?.theme}
                inPausa={!!lastTimerState && !lastTimerState.isRunning && passo?.type !== 'done'}
                stretto={rotated}
              />
            </div>
          </div>
        </div>

        {/* Blocks */}
        <div className="w-full flex-1 min-h-0">
           <div 
             className={rotated ? "flex flex-col gap-8 w-full h-full" : "grid gap-8 w-full h-full"}
             style={!rotated ? {
               gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
               gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`
             } : undefined}
           >
             {!isRunning && type !== 'Custom' && type !== 'Event' ? (
                blocks.map((block, idx) => {
                  const esercizi = block.exercises || []
                  const riposo = ['WarmUp', 'Rest'].includes(block.type)
                  const numerato = block.type === 'EMOM' || block.type === 'ON/OFF'
                  // In un EMOM il numero sono i minuti, anche «2–3» (src/lib/stazioniEmom.js).
                  const etichette = etichetteStazioni(esercizi, block.type)
                  const durata = mmss(durataBlocco(block))
                  // EMOM e ON/OFF: l'esercizio che sta girando, letto dall'id dello step.
                  const corrente = timerState ? esercizioInCorso(block, idx, timerState.step?.id) : null
                  return (
                    <BloccoTV key={block.id || idx}
                      tipo={block.type}
                      hint={blockHint(block.type)}
                      sottotitolo={sottotitoloBlocco(block)}
                      durata={durata !== '0:00' ? durata : null}
                      lavoro={BLOCCHI_DI_LAVORO.has(block.type)}
                      numero={blocks.length > 1 ? idx + 1 : null}
                      attivo={idx === activeIdx}>
                      {riposo ? (
                        block.notes ? <NotaBloccoTV>{block.notes}</NotaBloccoTV> : null
                      ) : esercizi.map((ex, i) => (
                        <EsercizioTV key={ex.id || i}
                          numero={numerato ? etichette[i] : null}
                          nome={ex.name}
                          specifiche={[specificheEsercizio(ex, isErgo), haIncremento(block) ? testoAumento(ex) : ''].filter(Boolean).join(' · ')}
                          note={ex.notes}
                          intensita={ex.intensity}
                          classeIntensita={getIntensityColor(ex.intensity)}
                          attivo={i === corrente} />
                      ))}
                    </BloccoTV>
                  )
                })
              ) : isRunning ? (
                  <CartaCorsaTV>
                    <CorsaTV passi={s?.steps || s?.main?.steps || []} attivo={activeIdx} classeIntensita={getIntensityColor} />
                  </CartaCorsaTV>
              ) : null}

              {/* Note Coach */}
              {workout.coach_notes && <NotaCoachTV>{workout.coach_notes}</NotaCoachTV>}
           </div>
        </div>
      </div>
    )
  }

  return (
    <div 
      ref={containerRef}
      tabIndex={0}
      className="fixed inset-0 flex items-center justify-center overflow-hidden outline-none cursor-pointer"
      onClick={unlockAudio}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.code === 'Enter' || e.keyCode === 13) {
          unlockAudio();
        }
      }}
    >
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