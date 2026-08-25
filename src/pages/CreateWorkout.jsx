import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Trash2, Save, X, Check, ChevronRight, Timer, Dumbbell, Flag, FlagOff, ChevronUp, ChevronDown, AlertTriangle, BicepsFlexed, Copy, ChevronLeft, Wand2, Mic, Square } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { CustomAlert, CustomConfirm } from '../components/CustomModals'
import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { VoiceRecorder } from 'capacitor-voice-recorder'
import CustomDatePicker from '../components/CustomDatePicker'
import { useTouchDrag } from '../useTouchDrag'
import { blockHint } from '../lib/blockHints'
import { format } from 'date-fns'
import { generaTitolo, titoloOppureGenerato, titoliDelGiorno } from '../lib/workoutTitle'
import { ERGOMETERS } from '../lib/constants'
import { mostraErrore } from '../lib/alert'


// ─── COSTANTI ────────────────────────────────────────────────
const HYROX_EXERCISES = [
  'Assault Bike', 'Atlas Stone Load', 'Axle Bar Clean', 'Axle Bar Deadlift',
  'Back Lunge', 'Back Squat', 'Bar Muscle-up', 'Bar Pullover', 'Battle Ropes', 'Bear Crawl', 'Box Jump', 'Burpees', 'Burpees Broad Jumps', 'Burpees Jump',
  'Chest-to-Bar', 'Clean', 'Cluster', 'Crossover Double Unders', 'Curve Treadmill',
  'D-Ball Clean', 'Deadlift', 'Deficit Deadlift', 'Deficit Handstand Push-up', 'Devil Press', 'Double Unders', 'Dragon Flag', 'Dual Dumbbell Clean and Jerk', 'Dual Dumbbell Snatch', 'Dumbbell Box Step-Over', 'Dumbbell Snatch', 'Dumbbell Step-Up',
  'Echo Bike',
  'Farmers Carry', 'Farmers Walk', 'Freestanding Handstand Push-up', 'Front Lunge', 'Front Squat',
  'GHD Back Extension', 'GHD Hip Extension', 'GHD Sit-up', 'Good Morning',
  'Handstand Push-up', 'Handstand Walk', 'Hang Power Clean', 'Hang Power Snatch', 'Hang Squat Clean', 'Hang Squat Snatch', 'Hollow Body Hold', 'Hollow Rock',
  'Jumping Jack', 'Jumping Muscle-up',
  'Kettlebell Clean and Press', 'Kettlebell Goblet Squat', 'Kettlebell Snatch', 'Kettlebell Swing',
  'L-Sit', 'Log Press',
  'Man Maker', 'Military Press', 'Muscle Clean', 'Muscle Snatch',
  'Overhead Squat', 'Overhead Walking Lunge',
  'Pegboard Ascent', 'Pistol Squat', 'Plank', 'Power Clean', 'Power Snatch', 'Prowler Push', 'Pull-up', 'Push Jerk', 'Push Press', 'Push Up',
  'Rest', 'Ring Dips', 'Ring Muscle-up', 'Romanian Deadlift', 'Rope Climb', 'Rowing', 'Run',
  'Sandbag Bear Hug Squat', 'Sandbag Carry', 'Sandbag Lunges', 'Sandbag Over Shoulder', 'Shuttle Run', 'SkiErg', 'Skin the Cat', 'Sled Drag', 'Sled Pull', 'Sled Push', 'Snatch Balance', 'Sots Press', 'Split Jerk', 'Squat', 'Squat Clean', 'Squat Jack', 'Squat Snatch', 'Strict Handstand Push-up', 'Strict Muscle-up', 'Strict Press', 'Strict Pull-up', 'Suitcase Carry', 'Suitcase Deadlift', 'Sumo Deadlift', 'Sumo Deadlift High Pull', 'Superman Rock', 'Swim',
  'Thruster', 'Tire Flip', 'Toes-to-Bar', 'Triple Unders', 'TrueForm Runner', 'Turkish Get-Up',
  'V-Up',
  "Waiter's Walk", 'Wall Balls', 'Wall Walk', 'Weighted Pull-up',
  'Yoke Carry',
  'Zercher Squat'
]

const isErgo = (name) => ERGOMETERS.includes(name)

const SLED_EXERCISES = ['Sled Push', 'Sled Pull', 'Prowler Push', 'Sled Drag']
const isSled = (name) => SLED_EXERCISES.includes(name)
const CARRY_EXERCISES = ['Farmers Carry', 'Farmers Walk', 'Suitcase Carry', 'Sandbag Carry', 'Yoke Carry', "Waiter's Walk", 'Handstand Walk', 'Bear Crawl']
const isCarry = (name) => CARRY_EXERCISES.includes(name)
const DISTANCE_EXERCISES = [
  'Farmers Carry', 'Farmers Walk', 'Suitcase Carry', 'Sandbag Carry', 'Yoke Carry', 
  "Waiter's Walk", 'Handstand Walk', 'Run', 'Bear Crawl', 'Shuttle Run', 'Swim'
]

const HYBRID_EXERCISES = ['Sandbag Lunges', 'Burpees Broad Jumps']
const isHybrid = (name) => HYBRID_EXERCISES.includes(name)

const isDistance = (name) => isErgo(name) || isSled(name) || DISTANCE_EXERCISES.includes(name)

const METERS_OPTIONS = [
   '-', 'Max','50m','100m','150m','200m','250m','300m','400m','500m',
  '600m','750m','1000m','1500m','2000m'
]
const HYBRID_METERS_OPTIONS = ['-', 'Max', ...Array.from({ length: 50 }, (_, i) => `${(i + 1) * 10}m`)]
const SLED_METERS_OPTIONS = ['-', 'Max', ...Array.from({ length: 30 }, (_, i) => `${(i + 1) * 10}m`)]
const CARRY_METERS_OPTIONS = ['-', 'Max', ...Array.from({ length: 50 }, (_, i) => `${(i + 1) * 10}m`)]
const REPS_OPTIONS = ['-', 'Max', ...Array.from({ length: 100 }, (_, i) => `${i + 1}`)]
const MINUTES_OPTIONS = Array.from({ length: 60 }, (_, i) => `${i + 1} min`)
const TIME_OPTIONS = [
  '-',
  ...Array.from({ length: 120 }, (_, i) => { // Fino a 10:00 in scatti da 5 sec
    const s = (i + 1) * 5;
    return `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;
  }),
  ...Array.from({ length: 220 }, (_, i) => { // Da 10:30 a 120:00 in scatti da 30 sec
    const s = 600 + (i + 1) * 30;
    return `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;
  })
]

const REST_TIME_OPTIONS = [
  '-',
  ...Array.from({ length: 90 }, (_, i) => { // Fino a 15:00 in scatti da 10 sec
    const s = (i + 1) * 10;
    return `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;
  })
]

const ROUNDS_OPTIONS = Array.from({ length: 40 }, (_, i) => `${i + 1}`)
const KG_OPTIONS = [
  '-',
  'Nessun peso',
  ...Array.from({ length: 300 }, (_, i) => `${i + 1} kg`),
  ...[4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32].map(w => `2x${w} kg`)
]

// ─── COSTANTI RUNNING ─────────────────────────────────────────
const RUN_TIME_OPTIONS = [
  ...Array.from({ length: 60 }, (_, i) => `${i + 1} min`),
  ...Array.from({ length: 12 }, (_, i) => `${(i + 1) * 5} sec`)
]

const RUN_DISTANCE_OPTIONS = [
  ...Array.from({ length: 10 }, (_, i) => `${(i + 1) * 10}m`),
  '150m', '200m', '250m', '300m', '400m', '500m', '600m', '800m', '1 km', '1.5 km', '2 km', '3 km', '4 km', '5 km', '10 km', '15 km', '21 km', '42 km'
]
const RUN_PACE_OPTIONS = [
  'Libero', 'Camminata', 'Z1', 'Z2', 'Z3', 'Z4', 'Z5', 'All out', 'Gara',
  ...Array.from({ length: 96 }, (_, i) => {
    const s = 120 + i * 5;
    return `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')} /km`;
  })
]

const SPEED_OPTIONS = ['-', ...Array.from({ length: 41 }, (_, i) => `${(5 + i * 0.5).toFixed(1)} km/h`)]

const ERGO_PACE_OPTIONS = [
  '-', 'Libero', 'Gara Singola', 'Gara Doppia', 'Z1', 'Z2', 'Z3', 'Z4', 'Z5', 'All out',
  ...Array.from({ length: 61 }, (_, i) => {
    const s = 90 + i * 5;
    return `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')} /500m`;
  }),
  ...Array.from({ length: 17 }, (_, i) => `${40 + i * 5} RPM`)
]

const MAX_PACE_OPTIONS = ['-', ...RUN_PACE_OPTIONS]

const RUN_REPEAT_ROUNDS_OPTIONS = Array.from({ length: 30 }, (_, i) => `${i + 1}`)

export const getIntensityColor = (val) => {
  const num = parseInt(val, 10);
  if (isNaN(num)) return 'text-gray-500';
  if (num <= 4) return 'text-gray-400';
  if (num <= 7) return 'text-gray-300';
  if (num <= 9) return 'text-white';
  return 'text-[#f1ba17]';
}

const timeToSeconds = (timeStr) => {
  if (!timeStr) return 0;
  if (timeStr.includes(' min')) return parseInt(timeStr) * 60;
  const parts = timeStr.split(':')
  if (parts.length === 2) return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10)
  return 0
}
const formatTime = (totalSeconds) => {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  if (s === 0) return `${m} min`
  return `${m}:${s.toString().padStart(2, '0')} min`
}

const TYPE_COLORS = {
  'WarmUp': { text: 'text-gray-400', bg: 'bg-[#2a2a2a]', border: 'border-[#383838]', hex: '#9ca3af' },
  'Rest': { text: 'text-gray-500', bg: 'bg-[#1e1e1e]', border: 'border-[#2a2a2a]', hex: '#6b7280' },
  'Cash In': { text: 'text-gray-300', bg: 'bg-[#222]', border: 'border-[#444]', hex: '#d1d5db' },
  'Cash Out': { text: 'text-gray-300', bg: 'bg-[#222]', border: 'border-[#444]', hex: '#d1d5db' },
  'ON/OFF': { text: 'text-gray-200', bg: 'bg-[#222]', border: 'border-[#444]', hex: '#e5e5e5' },
  'EMOM': { text: 'text-gray-200', bg: 'bg-[#222]', border: 'border-[#444]', hex: '#e5e5e5' },
  'AMRAP': { text: 'text-gray-200', bg: 'bg-[#222]', border: 'border-[#444]', hex: '#e5e5e5' },
  'For Time': { text: 'text-gray-200', bg: 'bg-[#222]', border: 'border-[#444]', hex: '#e5e5e5' },
    'Interval': { text: 'text-gray-200', bg: 'bg-[#222]', border: 'border-[#444]', hex: '#e5e5e5' },

  'Running': { text: 'text-[#0094C6]', bg: 'bg-[#0094C6]/10', border: 'border-[#0094C6]/30', hex: '#0094C6' }
}

// ─── HELPER REORDER ───────────────────────────────────────────
const moveElement = (list, from, to) => {
  if (from < 0 || from >= list.length || to < 0 || to >= list.length) return list
  const copy = [...list]
  const [moved] = copy.splice(from, 1)
  copy.splice(to, 0, moved)
  return copy
}

// ─── SCROLL PICKER ────────────────────────────────────────────
function ScrollPicker({ options = [], value, onChange, label, type, isRun }) {
  const displayOptions = type === 'time' && (!options || options.length === 0) ? TIME_OPTIONS : options || []
  const containerRef = useRef(null)
  const [isScrolling, setIsScrolling] = useState(false)
  const scrollTimeout = useRef(null)
  const activeTextColor = isRun ? 'text-[#0094C6]' : 'text-[#f1ba17]'
  const activeBorderColor = isRun ? 'border-[#0094C6]/25' : 'border-[#f1ba17]/25'

  useEffect(() => {
    const index = displayOptions.findIndex(opt => String(opt) === String(value))
    if (index !== -1 && containerRef.current && !isScrolling) {
       containerRef.current.scrollTop = index * 40
    }
  }, [value, isScrolling, displayOptions])

  const handleScroll = () => {
    setIsScrolling(true)
    clearTimeout(scrollTimeout.current)
    
    const el = containerRef.current
    if (!el) return
    
    const index = Math.round(el.scrollTop / 40)
    if (displayOptions[index] !== undefined && String(displayOptions[index]) !== String(value)) {
      onChange(displayOptions[index])
      try {
        if (Capacitor.isNativePlatform()) {
          Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
        } else if (navigator.vibrate) {
          navigator.vibrate(10);
        }
      } catch (e) {}
    }

    scrollTimeout.current = setTimeout(() => {
      setIsScrolling(false)
    }, 150)
  }

  return (
    <div className="flex flex-col gap-1">
      {label && <p className="text-gray-400 text-xs">{label}</p>}
      <div 
        ref={containerRef}
        onScroll={handleScroll}
        className="relative h-36 overflow-y-scroll snap-y snap-mandatory bg-[#0B0B0B] rounded-xl border border-[#383838] hide-scrollbar"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        <div className="py-[52px]">
          {displayOptions.map(opt => (
            <div key={opt} onClick={() => onChange(opt)}
              className={`snap-center h-10 flex items-center justify-center text-sm cursor-pointer select-none transition-colors
                ${String(value) === String(opt) ? `${activeTextColor} font-bold text-base` : 'text-gray-400 hover:text-gray-400'}`}>
              {opt}
            </div>
          ))}
        </div>
        <div className={`pointer-events-none absolute inset-x-4 top-[52px] h-10 border-y ${activeBorderColor} rounded`} />
      </div>
    </div>
  )
}

function BlockPickerModal({ onAdd, onClose }) {
    const blockTypes = ['WarmUp', 'Cash In', 'ON/OFF', 'EMOM', 'AMRAP', 'For Time', 'Interval', 'Rest', 'Cash Out']

  return createPortal(
    <div className="fixed inset-0 bg-black/85 z-[60] flex items-center justify-center p-4">
      <div className="bg-[#1e1e1e] rounded-3xl w-full max-w-sm p-5 border border-[#333] animate-in fade-in zoom-in-[0.96] duration-300 ease-out">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-white font-bold text-lg">Aggiungi Blocco</h3>
          <button aria-label="Chiudi" onClick={onClose} className="text-gray-500 hover:text-white"><X size={20}/></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {blockTypes.map(t => (
            <button key={t} onClick={() => onAdd(t)} className="bg-[#2a2a2a] border border-[#383838] text-white font-medium py-3 px-2 rounded-xl hover:border-[#f1ba17] hover:text-[#f1ba17] transition text-sm flex flex-col items-center gap-0.5 group">
              <span>{t}</span>
              <span className="text-[11px] font-normal text-gray-500 group-hover:text-[#f1ba17]/70 leading-tight text-center">{blockHint(t)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  )
}

function IntensityPicker({ value, onChange, activeColor = 'bg-[#f1ba17]' }) {
  const segments = Array.from({ length: 10 }, (_, i) => i + 1);
  const containerRef = useRef(null);
  const isDragging = useRef(false);

  const calculateValue = (clientX) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    let x = clientX - rect.left;
    if (x < 0) x = 0;
    if (x > rect.width) x = rect.width;
    
    let newValue = Math.ceil((x / rect.width) * 10);
    if (newValue < 1) newValue = 1;
    if (newValue > 10) newValue = 10;
    
    if (String(newValue) !== String(value)) {
      onChange(String(newValue));
      try {
        if (Capacitor.isNativePlatform()) {
          Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
        } else if (navigator.vibrate) {
          navigator.vibrate(10);
        }
      } catch (e) {}
    }
  };

  const handlePointerDown = (e) => {
    isDragging.current = true;
    const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
    calculateValue(clientX);
  };

  const handlePointerMove = (e) => {
    if (!isDragging.current) return;
    const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
    calculateValue(clientX);
  };

  useEffect(() => {
    const handlePointerUp = () => { isDragging.current = false; };
    document.addEventListener('mouseup', handlePointerUp);
    document.addEventListener('touchend', handlePointerUp);
    return () => {
      document.removeEventListener('mouseup', handlePointerUp);
      document.removeEventListener('touchend', handlePointerUp);
    };
  }, []);

  return (
    <div 
      ref={containerRef}
      className="flex items-center gap-1.5 w-full pt-1 cursor-pointer touch-none select-none"
      onMouseDown={handlePointerDown}
      onMouseMove={handlePointerMove}
      onTouchStart={handlePointerDown}
      onTouchMove={handlePointerMove}
    >
      {segments.map(s => (
        <div
          key={s}
          className={`flex-1 h-8 rounded-lg transition-all duration-75 ${
            s <= parseInt(value)
              ? `${activeColor} shadow-lg`
              : 'bg-[#333]'
          }`}
          style={{
            boxShadow: s <= parseInt(value) ? `0 4px 15px ${activeColor.includes('f1ba17') ? 'rgba(241,186,23,0.3)' : activeColor.includes('0094C6') ? 'rgba(0,148,198,0.3)' : 'rgba(209,17,73,0.3)'}` : 'none',
            pointerEvents: 'none'
          }}
        />
      ))}
    </div>
  );
}

function AiGenerationModal({ onClose, onGenerate }) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [isFocused, setIsFocused] = useState(false);
  const blurTimeoutRef = useRef(null);

  const [isListening, setIsListening] = useState(false);
  const [interimResult, setInterimResult] = useState('');
  const recognitionRef = useRef(null);
  const [audioLevel, setAudioLevel] = useState(1);

  useEffect(() => {
    // Manteniamo il fallback Web per quando testi l'app dal browser su PC
    if (!Capacitor.isNativePlatform()) {
      const WebSpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (WebSpeechRecognition) {
        const recognition = new WebSpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'it-IT';

        recognition.onstart = () => setIsListening(true);
        
        recognition.onresult = (event) => {
          let finalTrans = '';
          let interimTrans = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTrans += transcript + ' ';
            } else {
              interimTrans += transcript;
            }
          }
          if (finalTrans) {
            setText(prev => (prev + ' ' + finalTrans).trim());
          }
          setInterimResult(interimTrans);
        };

        recognition.onerror = (event) => {
          console.error('Speech recognition error', event.error);
          setIsListening(false);
        };
        
        recognition.onend = () => {
          setIsListening(false);
          setInterimResult('');
        };

        recognitionRef.current = recognition;
      }
    }

    return () => {
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
      if (recognitionRef.current) recognitionRef.current.stop();
      if (Capacitor.isNativePlatform()) {
        VoiceRecorder.stopRecording().catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    let interval;
    if (isListening) {
      interval = setInterval(() => {
        setAudioLevel(1 + Math.random() * 0.4); // animazione tra 1 e 1.4
      }, 150);
    } else {
      setAudioLevel(1);
    }
    return () => clearInterval(interval);
  }, [isListening]);

  const toggleListen = async () => {
    if (isListening) {
      if (Capacitor.isNativePlatform()) {
        setIsListening(false);
        try {
          const result = await VoiceRecorder.stopRecording();
          if (result.value && result.value.recordDataBase64) {
            setLoading(true);
            const { data, error } = await supabase.functions.invoke('ai-workout', { 
              body: { 
                prompt: text,
                audioBase64: result.value.recordDataBase64,
                mimeType: result.value.mimeType || 'audio/aac' // Includiamo il mimeType, con un fallback
              } 
            });
            
            if (error) {
              let errorMsg = error.message;
              if (error.context && typeof error.context.json === 'function') {
                try { const errBody = await error.context.json(); if (errBody && errBody.error) errorMsg = errBody.error; } catch (_) {}
              }
              throw new Error(errorMsg);
            }
            if (data?.error) throw new Error(data.error);
            
            if (data.blocks) {
              onGenerate(data.blocks);
              onClose();
            }
          }
        } catch (e) {
          console.error(e);
          mostraErrore("Errore elaborazione audio: " + e.message);
        } finally {
          setLoading(false);
        }
      } else {
        recognitionRef.current?.stop();
      }
    } else {
      if (Capacitor.isNativePlatform()) {
        try {
          const perm = await VoiceRecorder.requestAudioRecordingPermission();
          if (!perm.value) {
            mostraErrore("Devi concedere i permessi per il microfono nelle impostazioni di iOS.");
            return;
          }
          await VoiceRecorder.startRecording();
          setIsListening(true);
          setInterimResult('Sto ascoltando... 🎙️');
        } catch (e) {
          console.error(e);
          setIsListening(false);
          mostraErrore("Errore nell'avvio della registrazione: " + e.message);
        }
      } else {
        if (recognitionRef.current) {
          try {
            recognitionRef.current.start();
          } catch (e) {
            console.error(e);
          }
        } else {
          mostraErrore("Il riconoscimento vocale nativo non è supportato su questo dispositivo. Usa la dettatura integrata della tastiera.");
        }
      }
    }
  };

  const handleGenerate = async () => {
    if (!text.trim()) return;
    const finalPrompt = text.trim();
    setLoading(true);
    if (isListening) {
      if (Capacitor.isNativePlatform()) VoiceRecorder.stopRecording().catch(()=>{});
      else recognitionRef.current?.stop();
      setIsListening(false);
    }
    try {
      const { data, error } = await supabase.functions.invoke('ai-workout', { body: { prompt: finalPrompt } });
      if (error) {
        let errorMsg = error.message;
        if (error.context && typeof error.context.json === 'function') {
          try { const errBody = await error.context.json(); if (errBody && errBody.error) errorMsg = errBody.error; } catch (_) {}
        }
        throw new Error(errorMsg);
      }
      if (data?.error) throw new Error(data.error);
      onGenerate(data.blocks || []);
      onClose();
    } catch (e) {
      let msg = e.message;
      if (msg.includes('503') || msg.toLowerCase().includes('high demand') || msg.toLowerCase().includes('overloaded')) {
        msg = "I server dell'Intelligenza Artificiale sono attualmente sovraccarichi. Riprova tra qualche istante.";
      }
      mostraErrore('Errore generazione IA: ' + msg);
    } finally {
      setLoading(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 bg-black/85 z-[60] flex items-center justify-center p-4">
      <div className={`bg-[#1e1e1e] rounded-3xl w-full max-w-sm p-6 border border-[#333] shadow-2xl animate-in fade-in zoom-in-[0.96] duration-300 ease-out transition-transform ${isFocused ? '-translate-y-36' : ''}`}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-white font-bold text-lg flex items-center gap-2"><Wand2 size={20} className="text-[#a855f7]" /> Genera con IA</h3>
          <button aria-label="Chiudi" onClick={onClose} className="text-gray-500 hover:text-white"><X size={20}/></button>
        </div>
        
        {isListening ? (
          <div className="flex flex-col items-center justify-center py-6">
            <div className="relative flex items-center justify-center w-32 h-32 mb-6">
              <div 
                className="absolute inset-0 bg-[#a855f7] rounded-full opacity-20 transition-transform duration-150 ease-out"
                style={{ transform: `scale(${audioLevel + 0.2})` }}
              ></div>
              <div 
                className="absolute inset-0 bg-[#a855f7] rounded-full opacity-40 transition-transform duration-150 ease-out"
                style={{ transform: `scale(${audioLevel})` }}
              ></div>
              <button aria-label="Ferma la dettatura" onClick={toggleListen} className="relative z-10 w-16 h-16 bg-[#a855f7] rounded-full flex items-center justify-center text-white shadow-lg shadow-[#a855f7]/50 hover:brightness-110 transition">
                <Square size={24} fill="currentColor" />
              </button>
            </div>
            <p className="text-white font-medium text-center min-h-[48px] px-4">
              {interimResult}
            </p>
          </div>
        ) : (
          <>
            <p className="text-gray-400 text-sm mb-4">Puoi usare il <strong className="text-white">microfono</strong> per dettare il tuo allenamento (es. "Fammi un EMOM di 12 minuti con 15 burpees e 10 box jump").</p>
            <div className="relative">
              <textarea 
                autoFocus 
                className="w-full bg-[#111] border border-[#333] rounded-xl px-4 py-3 pb-12 text-white placeholder-gray-600 focus:outline-none focus:border-[#a855f7] resize-none text-base transition-colors" 
                rows={4} 
                placeholder="Ditta o scrivi qui..." 
                value={text} 
                onChange={e => setText(e.target.value)} 
                onFocus={() => {
                  if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
                  setIsFocused(true);
                }}
                onBlur={() => {
                  blurTimeoutRef.current = setTimeout(() => {
                    setIsFocused(false);
                  }, 250);
                }}
              />
              <button aria-label="Avvia la dettatura" 
                onClick={toggleListen}
                className="absolute bottom-3 right-3 w-11 h-11 bg-[#2a2a2a] hover:bg-[#333] border border-[#444] rounded-full flex items-center justify-center text-[#a855f7] transition shadow-md"
                title="Dettatura vocale"
              >
                <Mic size={18} />
              </button>
            </div>
          </>
        )}

        <button onClick={handleGenerate} disabled={loading || !text.trim()} className="w-full mt-4 py-3.5 bg-[#a855f7] text-white font-bold rounded-xl hover:brightness-110 transition disabled:opacity-50 shadow-lg shadow-[#a855f7]/20">
          {loading ? 'Elaborazione in corso...' : 'Genera Workout'}
        </button>
      </div>
    </div>,
    document.body
  )
}

// ─── EXERCISE PICKER MODAL ────────────────────────────────────
function ExercisePicker({ onAdd, onClose, existingNames = [], workoutType, initialExercise }) {
  const [search, setSearch] = useState(initialExercise?.name || '')
  const [selected, setSelected] = useState(initialExercise?.name || null)
  const [hybridMode, setHybridMode] = useState(initialExercise?.meters && initialExercise.meters !== '-' ? 'distance' : 'reps')
  const [runPaceMode, setRunPaceMode] = useState(initialExercise?.speed && initialExercise.speed !== '-' ? 'speed' : 'pace')
  const [meters, setMeters] = useState(initialExercise?.meters || '-')
  const [ergoPace, setErgoPace] = useState(initialExercise?.ergoPace || '-')
  const [speed, setSpeed] = useState(initialExercise?.speed || '-')
  const [reps, setReps] = useState(initialExercise?.reps || '-')
    const [exTime, setExTime] = useState(initialExercise?.exTime || '-')

  const [kg, setKg] = useState(initialExercise?.kg ? `${initialExercise.kg} kg` : '-')
  const [intensity, setIntensity] = useState(initialExercise?.intensity || '5')
  const [notes, setNotes] = useState(initialExercise?.notes || '')

  const filtered = HYROX_EXERCISES.filter(ex =>
    ex.toLowerCase().includes(search.toLowerCase()) && (!existingNames.includes(ex) || ex === initialExercise?.name)
  )
  const isCustom = search && !HYROX_EXERCISES.find(e => e.toLowerCase() === search.toLowerCase())

  const handleSelect = (name) => setSelected(name)

  const handleConfirm = () => {
    if (!selected) return
    const isDist = isDistance(selected)
    const isHyb = isHybrid(selected)
    
    let finalMeters = (isDist || (isHyb && hybridMode === 'distance') || selected === 'Rest') ? meters : ''
    let finalReps = (!isDist && !isHyb && selected !== 'Rest') || (isHyb && hybridMode === 'reps') ? reps : ''
    
    onAdd({
      id: initialExercise ? initialExercise.id : Math.random(),
      name: selected,
      meters: workoutType === 'Interval' ? '' : finalMeters,
      reps: workoutType === 'Interval' ? '' : finalReps,
      exTime: workoutType === 'Interval' ? exTime : undefined,
      ergoPace: isErgo(selected) || (selected === 'Run' && runPaceMode === 'pace') ? ergoPace : undefined,
      speed: selected === 'Run' && runPaceMode === 'speed' ? speed : undefined,
      kg: kg === 'Nessun peso' || kg === '-' || isErgo(selected) || selected === 'Run' || selected === 'Rest' ? '' : kg.replace(' kg', ''),
      intensity: selected === 'Rest' ? undefined : intensity,
      notes
    })
    onClose()
  }

  return createPortal(
    <div className="fixed inset-0 bg-black/85 z-[60] flex items-center justify-center p-4">
      <div className="bg-[#1e1e1e] rounded-3xl w-full max-w-md flex flex-col animate-in fade-in zoom-in-[0.96] duration-300 ease-out" style={{ maxHeight: 'calc(100vh - 100px)' }}>
        <div className="flex items-center justify-between p-5 border-b border-[#2a2a2a]">
          <p className="text-white font-bold">Scegli esercizio</p>
          <button aria-label="Chiudi" onClick={onClose} className="text-gray-500 hover:text-white"><X size={20} /></button>
        </div>

        <div className="p-4 flex flex-col gap-3 overflow-y-auto flex-1">
          <input
            className="bg-[#2a2a2a] border border-[#383838] rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#f1ba17] text-base"
            placeholder="Cerca o scrivi esercizio custom..."
            value={search}
            onChange={e => { setSearch(e.target.value); setSelected(null) }}
            autoFocus={!initialExercise}
          />

          {!selected ? (
            <div className="flex flex-col gap-1">
              {isCustom && (
                <button onClick={() => handleSelect(search)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#f1ba17]/10 border border-[#f1ba17]/30 text-[#f1ba17] text-sm font-medium">
                  <Plus size={16} /> Aggiungi "{search}" (custom)
                </button>
              )}
              {filtered.map(ex => (
                <button aria-label="Scegli questo esercizio" key={ex} onClick={() => handleSelect(ex)}
                  className="flex items-center justify-between px-4 py-3 rounded-xl bg-[#2a2a2a] hover:bg-[#333] text-white text-sm transition">
                  <span>{ex}</span>
                  {isErgo(ex) && <span className="text-xs text-blue-400 bg-blue-900/40 px-2 py-0.5 rounded-full">ergometro</span>}
                  <ChevronRight size={16} className="text-gray-500" />
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-white text-sm">← Indietro</button>
                <span className="text-white font-semibold">{selected}</span>
              </div>

              {isHybrid(selected) && (
                <div className="relative flex bg-[#111] p-1.5 rounded-2xl border border-[#333] mb-1">
                  <div 
                    className={`absolute top-1.5 bottom-1.5 left-1.5 w-[calc(50%-0.375rem)] bg-[#2a2a2a] rounded-xl shadow-md transition-transform duration-300 ease-out ${
                      hybridMode === 'reps' ? 'translate-x-0' : 'translate-x-full'
                    }`}
                  />
                  <button 
                    type="button"
                    onClick={() => { setHybridMode('reps'); setMeters('-'); }}
                    className={`relative z-10 flex-1 py-2.5 text-xs uppercase font-bold transition-colors duration-300 ${hybridMode === 'reps' ? 'text-[#f1ba17]' : 'text-gray-500 hover:text-gray-300'}`}
                  >
                    🔁 Reps
                  </button>
                  <button 
                    type="button"
                    onClick={() => { setHybridMode('distance'); setReps('-'); }}
                    className={`relative z-10 flex-1 py-2.5 text-xs uppercase font-bold transition-colors duration-300 ${hybridMode === 'distance' ? 'text-[#f1ba17]' : 'text-gray-500 hover:text-gray-300'}`}
                  >
                    📏 Distanza
                  </button>
                </div>
              )}

              {selected === 'Run' && (
                <div className="relative flex bg-[#111] p-1.5 rounded-2xl border border-[#333] mb-1">
                  <div 
                    className={`absolute top-1.5 bottom-1.5 left-1.5 w-[calc(50%-0.375rem)] bg-[#2a2a2a] rounded-xl shadow-md transition-transform duration-300 ease-out ${
                      runPaceMode === 'pace' ? 'translate-x-0' : 'translate-x-full'
                    }`}
                  />
                  <button 
                    type="button"
                    onClick={() => { setRunPaceMode('pace'); setSpeed('-'); }}
                    className={`relative z-10 flex-1 py-2.5 text-xs uppercase font-bold transition-colors duration-300 ${runPaceMode === 'pace' ? 'text-[#f1ba17]' : 'text-gray-500 hover:text-gray-300'}`}
                  >
                    ⏱ Passo
                  </button>
                  <button 
                    type="button"
                    onClick={() => { setRunPaceMode('speed'); setErgoPace('-'); }}
                    className={`relative z-10 flex-1 py-2.5 text-xs uppercase font-bold transition-colors duration-300 ${runPaceMode === 'speed' ? 'text-[#f1ba17]' : 'text-gray-500 hover:text-gray-300'}`}
                  >
                    ⚡ Velocità
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 animate-in fade-in duration-300" key={`${selected}-${hybridMode}-${runPaceMode}`}>
 {workoutType === 'Interval' ? (
                  <>
                    <ScrollPicker options={TIME_OPTIONS} value={exTime} onChange={setExTime} label="⏱ Durata" />
                    {isErgo(selected) ? (
                      <ScrollPicker options={ERGO_PACE_OPTIONS} value={ergoPace} onChange={setErgoPace} label="⏱ Passo (Opz.)" />
                    ) : selected === 'Run' ? (
                      runPaceMode === 'pace' ? (
                        <ScrollPicker options={['-'].concat(RUN_PACE_OPTIONS)} value={ergoPace} onChange={setErgoPace} label="⏱ Passo (Opz.)" />
                      ) : (
                        <ScrollPicker options={SPEED_OPTIONS} value={speed} onChange={setSpeed} label="⚡ Velocità" />
                      )
                    ) : (
                      <ScrollPicker options={KG_OPTIONS} value={kg} onChange={setKg} label="⚖️ Peso" />
                    )}
                  </>
                ) : isErgo(selected) ? (                  <>
                    <ScrollPicker options={METERS_OPTIONS} value={meters} onChange={setMeters} label="📏 Distanza / Cal" />
                    <ScrollPicker options={ERGO_PACE_OPTIONS} value={ergoPace} onChange={setErgoPace} label="⏱ Passo (Opz.)" />
                  </>
                ) : selected === 'Run' ? (
                  <>
                    <ScrollPicker options={METERS_OPTIONS} value={meters} onChange={setMeters} label="📏 Distanza" />
                    {runPaceMode === 'pace' ? (
                      <ScrollPicker options={['-'].concat(RUN_PACE_OPTIONS)} value={ergoPace} onChange={setErgoPace} label="⏱ Passo (Opz.)" />
                    ) : (
                      <ScrollPicker options={SPEED_OPTIONS} value={speed} onChange={setSpeed} label="⚡ Velocità" />
                    )}
                  </>
                ) : selected === 'Rest' ? (
                  <div className="col-span-2">
                    <ScrollPicker options={REST_TIME_OPTIONS} value={meters} onChange={setMeters} label="⏱ Durata" />
                  </div>
                ) : isHybrid(selected) ? (
                  <>
                    {hybridMode === 'distance' ? (
                       <ScrollPicker options={HYBRID_METERS_OPTIONS} value={meters} onChange={setMeters} label="📏 Distanza" />
                    ) : (
                       <ScrollPicker options={REPS_OPTIONS} value={reps} onChange={setReps} label="🔁 Reps" />
                    )}
                    <ScrollPicker options={KG_OPTIONS} value={kg} onChange={setKg} label="⚖️ Peso" />
                  </>
                ) : isSled(selected) ? (
                  <>
                    <ScrollPicker options={SLED_METERS_OPTIONS} value={meters} onChange={setMeters} label="📏 Distanza" />
                    <ScrollPicker options={KG_OPTIONS} value={kg} onChange={setKg} label="⚖️ Peso" />
                  </>
                ) : isCarry(selected) ? (
                  <>
                    <ScrollPicker options={CARRY_METERS_OPTIONS} value={meters} onChange={setMeters} label="📏 Distanza" />
                    <ScrollPicker options={KG_OPTIONS} value={kg} onChange={setKg} label="⚖️ Peso" />
                  </>
                ) : isDistance(selected) ? (
                  <>
                    <ScrollPicker options={METERS_OPTIONS} value={meters} onChange={setMeters} label="📏 Distanza" />
                    <ScrollPicker options={KG_OPTIONS} value={kg} onChange={setKg} label="⚖️ Peso" />
                  </>
                ) : (
                  <>
                    <ScrollPicker options={REPS_OPTIONS} value={reps} onChange={setReps} label="🔁 Reps" />
                    <ScrollPicker options={KG_OPTIONS} value={kg} onChange={setKg} label="⚖️ Peso" />
                  </>
                )}
              </div>

              {selected !== 'Rest' && (
                <div className="bg-[#222] border border-[#333] rounded-xl p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-xs">💪 Intensità</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${getIntensityColor(intensity)}`}>{intensity}/10</span>
                    <BicepsFlexed size={16} className={getIntensityColor(intensity)} />
                  </div>
                </div>
                <IntensityPicker value={intensity} onChange={setIntensity} />
              </div>
              )}

              <input
                className="bg-[#2a2a2a] border border-[#383838] rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#f1ba17] text-base"
                placeholder="Note (es. vai a cedimento, body weight...)"
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />

              <button onClick={handleConfirm}
                className="w-full py-3 bg-[#f1ba17] text-black font-bold rounded-xl hover:brightness-110 transition">
                {initialExercise ? '✅ Salva modifiche' : '✅ Aggiungi esercizio'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

// ─── BLOCCO ESERCIZIO ─────────────────────────────────────────
function ExerciseRow({ ex, index, total, onRemove, onMoveUp, onMoveDown, onDragStartIndex, onDragEnterIndex, onDragEndIndex, showMinute, onEdit, touchHandlers, onDuplicate }) {

  const detail = ex.exTime && ex.exTime !== '-' ? ex.exTime : ((ex.meters && ex.meters !== '-') ? ex.meters : (ex.reps && ex.reps !== '-' ? `${ex.reps} reps` : ''))
  const paceStr = (isErgo(ex.name) || ex.name === 'Run') && ex.ergoPace && ex.ergoPace !== '-' && ex.ergoPace !== 'Libero' ? `@ ${ex.ergoPace}` : ''
  const speedStr = ex.name === 'Run' && ex.speed && ex.speed !== '-' ? `@ ${ex.speed}` : ''

  return (
    <div
          {...(touchHandlers ? touchHandlers(index) : {})}
      draggable
      onDragStart={(e) => {
        e.stopPropagation()
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', index.toString())
        setTimeout(() => {
          if (e.target && e.target.classList) {
            e.target.classList.add('opacity-30', 'scale-[0.98]', 'shadow-lg')
          }
        }, 0)
        onDragStartIndex?.(index)
      }}
      onDragEnter={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onDragEnterIndex?.(index)
      }}
   onDragOver={(e) => {
        e.preventDefault()
        e.stopPropagation()
        e.dataTransfer.dropEffect = 'move'
      }}
      onDragEnd={(e) => {
        e.stopPropagation()
        if (e.target && e.target.classList) {
          e.target.classList.remove('opacity-30', 'scale-[0.98]', 'shadow-lg')
        }
        onDragEndIndex?.()
      }}
      data-drag-item
      className="drag-item flex items-center gap-3 bg-[#222] border border-[#2e2e2e] rounded-2xl px-4 py-3 cursor-move hover:border-[#444] transition-all duration-200"
    >
      <div className="flex flex-col items-center justify-center shrink-0">
        <button aria-label="Sposta l'esercizio su" type="button" onClick={() => onMoveUp && onMoveUp(index)} disabled={index === 0} className={`text-gray-500 hover:text-[#f1ba17] disabled:opacity-0 p-0.5`}><ChevronUp size={16}/></button>
        <button aria-label="Sposta l'esercizio giù" type="button" onClick={() => onMoveDown && onMoveDown(index)} disabled={index === (total || 1) - 1} className={`text-gray-500 hover:text-[#f1ba17] disabled:opacity-0 p-0.5`}><ChevronDown size={16}/></button>
      </div>

      {showMinute && (
        <div className="w-8 h-8 rounded-full bg-[#f1ba17]/10 border border-[#f1ba17]/30 flex items-center justify-center shrink-0">
          <span className="text-[#f1ba17] text-xs font-bold">{index + 1}</span>
        </div>
      )}

      <div className="flex-1 cursor-pointer group self-stretch flex flex-col justify-center py-2 -my-2" onClick={() => onEdit && onEdit(ex)}>
        <p className="text-white text-sm font-medium group-hover:text-[#f1ba17] transition">{ex.name}</p>
        <p className="text-gray-500 text-xs mt-0.5 group-hover:text-gray-400 transition">
          {detail} {paceStr} {speedStr}
          {ex.kg ? ` · ${ex.kg}kg` : ''}
          {ex.notes ? ` · ${ex.notes}` : ''}
        </p>
      </div>
      {ex.intensity && (
        <div className="flex items-center gap-1 pr-2 shrink-0 cursor-pointer hover:opacity-80 transition" onClick={() => onEdit && onEdit(ex)}>
           <span className={`text-xs font-bold ${getIntensityColor(ex.intensity)}`}>{ex.intensity}/10</span>
           <BicepsFlexed size={16} className={getIntensityColor(ex.intensity)} />
        </div>
      )}
      <div className="flex items-center shrink-0">
        <button aria-label="Duplica l'esercizio" type="button" onClick={() => onDuplicate && onDuplicate(ex)} className="text-gray-500 hover:text-[#f1ba17] transition shrink-0 p-2" title="Duplica esercizio">
          <Copy size={15} />
        </button>
        <button aria-label="Rimuovi l'esercizio" type="button" onClick={() => onRemove(ex.id)} className="text-gray-700 hover:text-red-400 transition shrink-0 p-2">
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  )
}

// ─── BLOCCO HYROX ───────────────────────────────────────
function HyroxBlock({ block, index, total, isOpen, onToggle, onUpdate, onRemove, onMoveUp, onMoveDown, onDragStartIndex, onDragEnterIndex, onDragEndIndex, onDuplicate, touchHandlers, onDuplicateExerciseRequest }) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [editingExercise, setEditingExercise] = useState(null)
  const [draggedExIdx, setDraggedExIdx] = useState(null)

  // Hook touch per riordinare gli ESERCIZI dentro questo blocco
  const { getTouchHandlers: getExTouchHandlers } = useTouchDrag({
    onReorder: (from, to) => {
      onUpdate({ ...block, exercises: moveElement(block.exercises, from, to) })
    }
  })


  const updateParam = (k, v) => onUpdate({ ...block, params: { ...block.params, [k]: v } })
  const updateNotes = (notes) => onUpdate({ ...block, notes })

  const c = TYPE_COLORS[block.type] || { text: 'text-gray-200', border: 'border-[#444]', bg: 'bg-[#222]' }

  const getBlockRecap = () => {
    if (['WarmUp', 'Rest'].includes(block.type)) {
      return block.params?.duration ? `${block.params.duration}` : '3:00'
    } else if (block.type === 'ON/OFF') {
      return `${block.params?.on || '1:00'} ON / ${block.params?.off || '1:00'} OFF · ${block.params?.rounds || '10'} rounds`
    } else if (block.type === 'EMOM') {
      return `Ogni ${block.params?.interval || '1:00'} x ${block.params?.rounds || '10'} rounds`
    } else if (block.type === 'AMRAP') {
      return `${block.params?.duration || '10:00'}`
    } else if (block.type === 'For Time') {
      return `${block.params?.rounds || '3'} rounds`
       } else if (block.type === 'Interval') {
      return `${block.params?.rounds || '1'} rounds`
    } else if (['Cash In', 'Cash Out'].includes(block.type)) {
      const rounds = block.params?.rounds || '1';
      const rest = (parseInt(rounds, 10) > 1 && block.params?.rest && block.params.rest !== '-') ? ` · ${block.params.rest} rest` : '';
      return rounds !== '1' ? `${rounds} rounds${rest}` : '1 round';
    }
    return ''
  }

  return (
    <div
      {...(touchHandlers ? touchHandlers(index) : {})}
      draggable
      onDragStart={(e) => {
        e.stopPropagation()
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', index.toString())
        setTimeout(() => {
          if (e.target && e.target.classList) {
            e.target.classList.add('opacity-30', 'scale-[0.98]', 'shadow-lg')
          }
        }, 0)
        onDragStartIndex?.(index)
      }}
       onDragEnter={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onDragEnterIndex?.(index)
      }}
      onDragOver={(e) => {
        e.preventDefault()
        e.stopPropagation()
        e.dataTransfer.dropEffect = 'move'
      }}
      onDragEnd={(e) => {
        e.stopPropagation()
        if (e.target && e.target.classList) {
          e.target.classList.remove('opacity-30', 'scale-[0.98]', 'shadow-lg')
        }
        onDragEndIndex?.()
      }}
      data-drag-item
      className={`drag-item bg-[#1e1e1e] border ${isOpen ? c.border : 'border-[#333] hover:border-[#444]'} rounded-2xl p-4 flex flex-col gap-3 relative cursor-move transition-all duration-200`}
    >
      <div 
        className={`flex flex-col cursor-pointer ${isOpen ? 'border-b border-[#333] pb-2' : ''}`}
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <span className="flex items-baseline gap-2 min-w-0">
            <span className={`font-bold text-sm ${c.text}`}>{block.type}</span>
            <span className="text-[11px] text-gray-500 font-normal truncate">{blockHint(block.type)}</span>
          </span>
          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
            <button aria-label="Duplica il blocco" type="button" onClick={() => onDuplicate()} className="text-gray-500 hover:text-[#f1ba17] transition p-1" title="Duplica">
              <Copy size={16}/>
            </button>
            <button aria-label="Sposta il blocco su" type="button" onClick={() => onMoveUp()} disabled={index===0} className="text-gray-500 hover:text-white disabled:opacity-30 p-1"><ChevronUp size={16}/></button>
            <button aria-label="Sposta il blocco giù" type="button" onClick={() => onMoveDown()} disabled={index===total-1} className="text-gray-500 hover:text-white disabled:opacity-30 p-1"><ChevronDown size={16}/></button>
            <button aria-label="Elimina il blocco" type="button" onClick={onRemove} className="text-gray-500 hover:text-red-400 ml-1 p-1"><Trash2 size={16}/></button>
          </div>
        </div>

        {!isOpen && (
          <div className="mt-2 flex flex-col gap-2">
            {getBlockRecap() && <span className="text-xs text-gray-400 font-medium">{getBlockRecap()}</span>}
            
            {['WarmUp', 'Rest'].includes(block.type) && block.notes && (
              <span className="text-xs text-gray-500 truncate">{block.notes}</span>
            )}
            
            {!['WarmUp', 'Rest'].includes(block.type) && (
              block.exercises && block.exercises.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {block.exercises.map((ex, i) => {
                    const detail = ex.exTime && ex.exTime !== '-' ? ex.exTime : ((ex.meters && ex.meters !== '-') ? ex.meters : (ex.reps && ex.reps !== '-' ? `${ex.reps} reps` : ''))
                    const paceStr = (isErgo(ex.name) || ex.name === 'Run') && ex.ergoPace && ex.ergoPace !== '-' && ex.ergoPace !== 'Libero' ? `@ ${ex.ergoPace}` : ''
                    const speedStr = ex.name === 'Run' && ex.speed && ex.speed !== '-' ? `@ ${ex.speed}` : ''
                    const kgStr = ex.kg ? `${ex.kg}kg` : ''
                    const specs = [detail, paceStr, speedStr, kgStr].filter(Boolean).join(' ')
                    return (
                      <span key={i} className="text-xs bg-[#111] border border-[#333] text-gray-400 px-2 py-1.5 rounded-lg flex items-center gap-1">
                        <span className="text-gray-300 font-medium">{ex.name}</span>
                        {specs && <span className="text-gray-500 ml-0.5">{specs}</span>}
                      </span>
                    )
                  })}
                </div>
              ) : (
                <span className="text-xs text-gray-400 italic">Nessun esercizio aggiunto</span>
              )
            )}
          </div>
        )}
      </div>

      {isOpen && (
        <div className="flex flex-col gap-3 animate-in fade-in duration-200">
          {['WarmUp', 'Rest'].includes(block.type) && (
            <div className="grid grid-cols-2 gap-3">
              <ScrollPicker type="time" value={block.params?.duration} onChange={v => updateParam('duration', v)} label="Durata" />
              <div className="flex flex-col gap-1">
                <label className="text-gray-400 text-xs pl-1">Note</label>
                <input className="bg-[#2a2a2a] border border-[#383838] rounded-xl px-3 py-3 text-base text-white focus:border-[#f1ba17] focus:outline-none" value={block.notes || ''} onChange={e => updateNotes(e.target.value)} placeholder="Opzionale..." />
              </div>
            </div>
          )}

          {block.type === 'ON/OFF' && (
            <div className="grid grid-cols-3 gap-2">
              <ScrollPicker type="time" value={block.params?.on} onChange={v => updateParam('on', v)} label="ON" />
              <ScrollPicker type="time" value={block.params?.off} onChange={v => updateParam('off', v)} label="OFF" />
              <ScrollPicker options={ROUNDS_OPTIONS} value={block.params?.rounds} onChange={v => updateParam('rounds', v)} label="Rounds" />
            </div>
          )}

          {block.type === 'EMOM' && (
            <div className="grid grid-cols-2 gap-2">
              <ScrollPicker type="time" value={block.params?.interval} onChange={v => updateParam('interval', v)} label="Intervallo" />
              <ScrollPicker options={ROUNDS_OPTIONS} value={block.params?.rounds} onChange={v => updateParam('rounds', v)} label="Rounds" />
            </div>
          )}

          {block.type === 'AMRAP' && (
            <ScrollPicker type="time" value={block.params?.duration} onChange={v => updateParam('duration', v)} label="Durata" />
          )}

          {['For Time', 'Interval'].includes(block.type) && (
            <ScrollPicker options={ROUNDS_OPTIONS} value={block.params?.rounds} onChange={v => updateParam('rounds', v)} label="Rounds" />
          )}

          {['Cash In', 'Cash Out'].includes(block.type) && (
            <div className="flex w-full">
              <div 
                className="transition-all duration-400 ease-out" 
                style={{ 
                  width: parseInt(block.params?.rounds, 10) > 1 ? '50%' : '100%', 
                  paddingRight: parseInt(block.params?.rounds, 10) > 1 ? '6px' : '0px' 
                }}
              >
                <ScrollPicker options={ROUNDS_OPTIONS} value={block.params?.rounds || '1'} onChange={v => updateParam('rounds', v)} label="Rounds" />
              </div>
              <div 
                className={`transition-all duration-400 ease-out overflow-hidden ${
                  parseInt(block.params?.rounds, 10) > 1 ? 'w-1/2 opacity-100 pl-[6px]' : 'w-0 opacity-0 pl-0'
                }`}
              >
                <div className="w-full min-w-[130px]">
                  <ScrollPicker type="time" value={block.params?.rest} onChange={v => updateParam('rest', v)} label="Rest tra i rounds" />
                </div>
              </div>
            </div>
          )}

          {/* Exercises */}
          {!['WarmUp', 'Rest'].includes(block.type) && (
            <>
              <div className="flex flex-col gap-2 mt-2" data-drag-container>
                {(block.exercises || []).map((ex, i) => (
                  <ExerciseRow 
                    key={ex.id} ex={ex} index={i} total={block.exercises.length}
                    showMinute={block.type === 'EMOM' || block.type === 'ON/OFF'}
                    onRemove={(id) => onUpdate({ ...block, exercises: block.exercises.filter(e => e.id !== id) })}
                    onMoveUp={(idx) => onUpdate({ ...block, exercises: moveElement(block.exercises, idx, idx - 1) })}
                    onMoveDown={(idx) => onUpdate({ ...block, exercises: moveElement(block.exercises, idx, idx + 1) })}
                    onDragStartIndex={(idx) => setDraggedExIdx(idx)} // Passa al componente ExerciseRow
                    onDragEnterIndex={(idx) => { // Gestisce il riordino in tempo reale
                      if (draggedExIdx !== null && draggedExIdx !== idx) {
                        onUpdate({ ...block, exercises: moveElement(block.exercises, draggedExIdx, idx) })
                        setDraggedExIdx(idx) // Aggiorna l'indice dell'elemento trascinato
                      }
                    }}
                    onDragEndIndex={() => setDraggedExIdx(null)} // Resetta l'indice al termine del drag
                    onEdit={(exToEdit) => {
                      setEditingExercise(exToEdit)
                      setPickerOpen(true)
                    }}
                    onDuplicate={onDuplicateExerciseRequest}
                    touchHandlers={getExTouchHandlers}
                  />
                ))}
              </div>
              <button onClick={() => setPickerOpen(true)} className="py-3 border border-dashed border-[#383838] rounded-xl text-[#f1ba17] text-sm hover:bg-[#f1ba17]/10 transition mt-1">
                + Aggiungi Esercizio
              </button>
            </>
          )}

          {pickerOpen && (
            <ExercisePicker 
              workoutType={block.type}
              existingNames={(block.exercises || []).map(e => e.name)}
              initialExercise={editingExercise}
              onClose={() => { setPickerOpen(false); setEditingExercise(null); }}
              onAdd={ex => {
                if (editingExercise) {
                  onUpdate({ ...block, exercises: block.exercises.map(e => e.id === ex.id ? ex : e) })
                } else {
                  onUpdate({ ...block, exercises: [...(block.exercises || []), ex] })
                }
              }}
            />
          )}
        </div>
      )}
    </div>
  )
}

// ─── COMPONENTI RUNNING BUILDER ────────────────────────────────
function ModeToggle({ mode, onModeChange, value, onChange }) {
  return (
    <div className="relative flex bg-[#111] p-1.5 rounded-2xl border border-[#333] mb-3">
      <div 
        className={`absolute top-1.5 bottom-1.5 left-1.5 w-[calc(50%-0.375rem)] bg-[#2a2a2a] rounded-xl shadow-md transition-transform duration-300 ease-out ${
          mode === 'time' ? 'translate-x-0' : 'translate-x-full'
        }`}
      />
      <button 
        type="button"
        onClick={() => {
           onModeChange('time');
           if (!RUN_TIME_OPTIONS.includes(value)) onChange('1 min');
        }}
        className={`relative z-10 flex-1 py-2.5 text-xs uppercase font-bold transition-colors duration-300 ${mode === 'time' ? 'text-[#0094C6]' : 'text-gray-500 hover:text-gray-300'}`}
      >
        ⏱ Tempo
      </button>
      <button 
        type="button"
        onClick={() => {
           onModeChange('distance');
           if (!RUN_DISTANCE_OPTIONS.includes(value)) onChange('100m');
        }}
        className={`relative z-10 flex-1 py-2.5 text-xs uppercase font-bold transition-colors duration-300 ${mode === 'distance' ? 'text-[#0094C6]' : 'text-gray-500 hover:text-gray-300'}`}
      >
        📏 Distanza
      </button>
    </div>
  )
}

function RunningStepPicker({ onAdd, onClose, initialStep }) {
  const parseMin = (p) => p ? (p.includes(' - ') ? p.split(' - ')[0] + (p.includes('/km') ? ' /km' : '') : p) : 'Libero'
  const parseMax = (p) => p ? (p.includes(' - ') ? p.split(' - ')[1] : '-') : '-'

  const [type, setType] = useState(initialStep?.type || 'run')
  const [duration, setDuration] = useState(initialStep?.duration || '10 min')
  const [durationMode, setDurationMode] = useState(!initialStep ? 'time' : ((initialStep.duration || '').includes('min') || (initialStep.duration || '').includes('sec') ? 'time' : 'distance'))
  const [pace, setPace] = useState(initialStep?.paceMin || parseMin(initialStep?.pace))
  const [paceMax, setPaceMax] = useState(initialStep?.paceMax || parseMax(initialStep?.pace))
  const [intensity, setIntensity] = useState(initialStep?.intensity || '5')
  const [notes, setNotes] = useState(initialStep?.notes || '')
  const [rounds, setRounds] = useState(initialStep?.rounds || '8')
  const [runDuration, setRunDuration] = useState(initialStep?.runDuration || '1 min')
  const [runDurationMode, setRunDurationMode] = useState(!initialStep ? 'time' : ((initialStep.runDuration || '').includes('min') || (initialStep.runDuration || '').includes('sec') ? 'time' : 'distance'))
  const [runPace, setRunPace] = useState(initialStep?.runPaceMin || parseMin(initialStep?.runPace))
  const [runPaceMax, setRunPaceMax] = useState(initialStep?.runPaceMax || parseMax(initialStep?.runPace))
  const [runIntensity, setRunIntensity] = useState(initialStep?.runIntensity || '8')
  const [recDuration, setRecDuration] = useState(initialStep?.recDuration || '1 min')
  const [recDurationMode, setRecDurationMode] = useState(!initialStep ? 'time' : ((initialStep.recDuration || '').includes('min') || (initialStep.recDuration || '').includes('sec') ? 'time' : 'distance'))
  const [recPace, setRecPace] = useState(initialStep?.recPaceMin || parseMin(initialStep?.recPace))
  const [recPaceMax, setRecPaceMax] = useState(initialStep?.recPaceMax || parseMax(initialStep?.recPace))
  const [recIntensity, setRecIntensity] = useState(initialStep?.recIntensity || '3')

  const formatPace = (p, pMax) => {
    if (!pMax || pMax === '-') return p
    if (p.includes(' /km') && pMax.includes(' /km')) {
      return `${p.replace(' /km', '')} - ${pMax}`
    }
    return `${p} - ${pMax}`
  }

  const handleAdd = () => {
    onAdd({
      id: initialStep ? initialStep.id : Math.random(), 
      type, 
      duration, pace: formatPace(pace, paceMax), paceMin: pace, paceMax, intensity, notes,
      rounds, runDuration, runPace: formatPace(runPace, runPaceMax), runPaceMin: runPace, runPaceMax, runIntensity,
      recDuration, recPace: formatPace(recPace, recPaceMax), recPaceMin: recPace, recPaceMax, recIntensity
    })
    onClose()
  }

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

  return createPortal(
    <div className="fixed inset-0 bg-black/85 z-[60] flex items-center justify-center p-4">
      <div className="bg-[#1e1e1e] rounded-3xl w-full max-w-md flex flex-col animate-in fade-in zoom-in-[0.96] duration-300 ease-out" style={{ maxHeight: 'calc(100vh - 100px)' }}>
        <div className="flex items-center justify-between p-5 border-b border-[#2a2a2a]">
          <p className="text-white font-bold">{initialStep ? 'Modifica Fase Corsa' : 'Aggiungi Fase Corsa'}</p>
          <button aria-label="Chiudi" onClick={onClose} className="text-gray-500 hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-4 flex flex-col gap-4 overflow-y-auto flex-1">
          <div className="flex flex-wrap gap-2 mb-1">
            {['warmup', 'run', 'recover', 'cooldown', 'repeat'].map(t => (
              <button key={t} onClick={() => setType(t)}
                className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition ${
                  type === t ? 'bg-[#0094C6]/20 border-[#0094C6] text-[#0094C6]' : 'bg-[#2a2a2a] border-[#383838] text-gray-400 hover:text-white'
                }`}>
                {getTypeLabel(t)}
              </button>
            ))}
          </div>
          
          <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300 ease-out" key={type}>
            {type === 'repeat' ? (
              <>
              <ScrollPicker isRun options={RUN_REPEAT_ROUNDS_OPTIONS} value={rounds} onChange={setRounds} label="Numero di ripetizioni" />
              <div className="p-3 bg-[#222] border border-[#333] rounded-xl flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <p className="text-[#0094C6] text-sm font-semibold">Fase Attiva (Corsa)</p>
                  <div className="flex items-center gap-1">
                    <span className={`text-xs font-bold ${getIntensityColor(runIntensity)}`}>{runIntensity}/10</span>
                    <BicepsFlexed size={14} className={getIntensityColor(runIntensity)} />
                  </div>
                </div>
                <ModeToggle mode={runDurationMode} onModeChange={setRunDurationMode} value={runDuration} onChange={setRunDuration} />
                <div className="grid grid-cols-3 gap-2 animate-in fade-in duration-300" key={runDurationMode}>
                  <ScrollPicker isRun options={runDurationMode === 'time' ? RUN_TIME_OPTIONS : RUN_DISTANCE_OPTIONS} value={runDuration} onChange={setRunDuration} label={runDurationMode === 'time' ? 'Durata' : 'Distanza'} />
                  <ScrollPicker isRun options={RUN_PACE_OPTIONS} value={runPace} onChange={setRunPace} label="Da" />
                  <ScrollPicker isRun options={MAX_PACE_OPTIONS} value={runPaceMax} onChange={setRunPaceMax} label="A (Opz.)" />
                </div>
                <IntensityPicker value={runIntensity} onChange={setRunIntensity} activeColor="bg-[#0094C6]" />
              </div>
              <div className="p-3 bg-[#222] border border-[#333] rounded-xl flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <p className="text-green-400 text-sm font-semibold">Fase Recupero</p>
                  <div className="flex items-center gap-1">
                    <span className={`text-xs font-bold ${getIntensityColor(recIntensity)}`}>{recIntensity}/10</span>
                    <BicepsFlexed size={14} className={getIntensityColor(recIntensity)} />
                  </div>
                </div>
                <ModeToggle mode={recDurationMode} onModeChange={setRecDurationMode} value={recDuration} onChange={setRecDuration} />
                <div className="grid grid-cols-3 gap-2 animate-in fade-in duration-300" key={recDurationMode}>
                  <ScrollPicker isRun options={recDurationMode === 'time' ? RUN_TIME_OPTIONS : RUN_DISTANCE_OPTIONS} value={recDuration} onChange={setRecDuration} label={recDurationMode === 'time' ? 'Durata' : 'Distanza'} />
                  <ScrollPicker isRun options={RUN_PACE_OPTIONS} value={recPace} onChange={setRecPace} label="Da" />
                  <ScrollPicker isRun options={MAX_PACE_OPTIONS} value={recPaceMax} onChange={setRecPaceMax} label="A (Opz.)" />
                </div>
                <IntensityPicker value={recIntensity} onChange={setRecIntensity} activeColor="bg-[#0094C6]" />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Note</label>
                <input value={notes} onChange={e => setNotes(e.target.value)} className="w-full bg-[#2a2a2a] border border-[#383838] rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-[#0094C6] text-base" placeholder="Es: mantieni la zona 2 costante..." />
              </div>
              </>
            ) : (
              <>
              <ModeToggle mode={durationMode} onModeChange={setDurationMode} value={duration} onChange={setDuration} />
              <div className="grid grid-cols-3 gap-2 animate-in fade-in duration-300" key={durationMode}>
                <ScrollPicker isRun options={durationMode === 'time' ? RUN_TIME_OPTIONS : RUN_DISTANCE_OPTIONS} value={duration} onChange={setDuration} label={durationMode === 'time' ? 'Durata' : 'Distanza'} />
                <ScrollPicker isRun options={RUN_PACE_OPTIONS} value={pace} onChange={setPace} label="Da" />
                <ScrollPicker isRun options={MAX_PACE_OPTIONS} value={paceMax} onChange={setPaceMax} label="A (Opz.)" />
              </div>
              <div className="bg-[#222] border border-[#333] rounded-xl p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-xs">💪 Intensità</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${getIntensityColor(intensity)}`}>{intensity}/10</span>
                    <BicepsFlexed size={16} className={getIntensityColor(intensity)} />
                  </div>
                </div>
                <IntensityPicker value={intensity} onChange={setIntensity} activeColor="bg-[#0094C6]" />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Note</label>
                <input value={notes} onChange={e => setNotes(e.target.value)} className="w-full bg-[#2a2a2a] border border-[#383838] rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-[#0094C6] text-base" placeholder="Es: corsa leggera, focus tecnica..." />
              </div>
              </>
            )}
          </div>
          <button onClick={handleAdd} className="w-full mt-2 py-3 bg-[#0094C6] text-white font-bold rounded-xl hover:brightness-110 transition">
            {initialStep ? 'Salva Modifiche' : 'Aggiungi Fase'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

function RunningStepRow({ step, index, total, onRemove, onMoveUp, onMoveDown, onDragStartIndex, onDragEnterIndex, onDragEndIndex, touchHandlers, onEdit, onDuplicate }) {

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
      case 'warmup': return 'text-gray-400 bg-[#2a2a2a] border-[#383838]'
      case 'run': return 'text-[#0094C6] bg-[#0094C6]/10 border-[#0094C6]/30'
      case 'recover': return 'text-gray-500 bg-[#1e1e1e] border-[#2a2a2a]'
      case 'cooldown': return 'text-gray-400 bg-[#111] border-[#222]'
      case 'repeat': return 'text-purple-400 bg-purple-400/10 border-purple-400/30'
      default: return 'text-white bg-[#222] border-[#333]'
    }
  }

  return (
    <div 
      {...(touchHandlers ? touchHandlers(index) : {})}
      draggable
      onDragStart={(e) => {
        e.stopPropagation()
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', index.toString())
        setTimeout(() => {
          if (e.target && e.target.classList) {
            e.target.classList.add('opacity-30', 'scale-[0.98]', 'shadow-lg')
          }
        }, 0)
        onDragStartIndex?.(index)
      }}
      onDragEnter={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onDragEnterIndex?.(index)
      }}
      onDragOver={(e) => {
        e.preventDefault()
        e.stopPropagation()
        e.dataTransfer.dropEffect = 'move'
      }}
      onDragEnd={(e) => {
        e.stopPropagation()
        if (e.target && e.target.classList) {
          e.target.classList.remove('opacity-30', 'scale-[0.98]', 'shadow-lg')
        }
        onDragEndIndex?.()
      }}
      data-drag-item
      className="drag-item flex items-start gap-3 bg-[#222] border border-[#2e2e2e] rounded-2xl px-4 py-3 hover:border-[#444] transition-all duration-200 cursor-move"
    >
      <div className="flex flex-col items-center justify-center shrink-0 mt-1">
        <button aria-label="Sposta la fase su" type="button" onClick={() => onMoveUp && onMoveUp(index)} disabled={index === 0} className={`text-gray-500 hover:text-[#0094C6] disabled:opacity-0 p-0.5`}><ChevronUp size={16}/></button>
        <button aria-label="Sposta la fase giù" type="button" onClick={() => onMoveDown && onMoveDown(index)} disabled={index === (total || 1) - 1} className={`text-gray-500 hover:text-[#0094C6] disabled:opacity-0 p-0.5`}><ChevronDown size={16}/></button>
      </div>
      <div className="flex-1 cursor-pointer group self-stretch flex flex-col justify-center py-2 -my-2" onClick={() => onEdit && onEdit(step)}>
        <div className="flex items-center gap-2 mb-1 group-hover:opacity-80 transition">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${getTypeColor(step.type)}`}>
            {getTypeLabel(step.type)}
          </span>
          {step.type === 'repeat' && <span className="text-white text-sm font-bold bg-[#0B0B0B] px-2 py-0.5 rounded-full border border-[#333]">x{step.rounds}</span>}
        </div>
        {step.type === 'repeat' ? (
          <div className="text-sm mt-2 flex flex-col gap-1.5 ml-1 border-l-2 border-[#333] pl-3">
            <div>
              <span className="text-gray-300 font-medium">Corsa:</span> <span className="text-white">{step.runDuration}</span>
              {step.runPace && <span className="text-gray-500 text-xs ml-1">@{step.runPace}</span>}
            </div>
            <div>
              <span className="text-gray-500 font-medium">Recupero:</span> <span className="text-gray-400">{step.recDuration}</span>
              {step.recPace && <span className="text-gray-500 text-xs ml-1">@{step.recPace}</span>}
            </div>
            {step.intensity && (
              <div className="flex items-center gap-1">
                <span className={`text-xs font-bold ${getIntensityColor(step.intensity)}`}>{step.intensity}/10</span><BicepsFlexed size={14} className={getIntensityColor(step.intensity)} />
              </div>
            )}
            {step.notes && <p className="text-gray-500 text-xs mt-0.5">{step.notes}</p>}
          </div>
        ) : (
          <div className="text-sm mt-1 text-gray-300">
            {step.duration && <span className="font-semibold text-white">{step.duration}</span>}
            {step.pace && <span className="ml-2 text-gray-500">@{step.pace}</span>}
            {step.notes && <p className="text-gray-500 text-xs mt-0.5">{step.notes}</p>}
          </div>
        )}
      </div>
      <div className="flex items-center shrink-0 mt-1">
        <button aria-label="Duplica la fase" type="button" onClick={() => onDuplicate && onDuplicate(step)} className="text-gray-500 hover:text-[#0094C6] transition shrink-0 p-2" title="Duplica fase">
          <Copy size={15} />
        </button>
        <button aria-label="Elimina la fase" type="button" onClick={() => onRemove(step.id)} className="text-gray-700 hover:text-red-400 transition shrink-0 p-2">
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  )
}

// ─── MAIN ─────────────────────────────────────────────────────
export default function CreateWorkout() {
  const [searchParams] = useSearchParams()
  const editId = searchParams.get('edit')
  const duplicateId = searchParams.get('duplicate')
  const awId = searchParams.get('aw_id')
  const athleteId = searchParams.get('athlete_id')
  const sourceId = editId || duplicateId
  const defaultDate = searchParams.get('date')

  const [step, setStep] = useState(1) // 1=tipo, 2=build
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(defaultDate || format(new Date(), 'yyyy-MM-dd'))
  const [workoutIntensity, setWorkoutIntensity] = useState('5')
  const [category, setCategory] = useState('Hyrox')
  const [blocks, setBlocks] = useState([])
  const [blockPickerOpen, setBlockPickerOpen] = useState(false)
  const [aiModalOpen, setAiModalOpen] = useState(false)
  const [openBlockId, setOpenBlockId] = useState(null)
  const [draggedBlockIdx, setDraggedBlockIdx] = useState(null)
  
  // Running
  const [runningSteps, setRunningSteps] = useState([])
  const [runningPickerOpen, setRunningPickerOpen] = useState(false)
  const [editingStep, setEditingStep] = useState(null)
  const [draggedStepIdx, setDraggedStepIdx] = useState(null)

  // Note + pause
  const [coachNotes, setCoachNotes] = useState('')

  // Modal Salvataggio
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [isSavingAsNew, setIsSavingAsNew] = useState(false)
  const [newWorkoutName, setNewWorkoutName] = useState('')

  const navigate = useNavigate()

  // Hook touch per riordinare i BLOCCHI HYROX
  const { getTouchHandlers: getBlockTouchHandlers } = useTouchDrag({
    onReorder: (from, to) => setBlocks(prev => moveElement(prev, from, to))
  })

  // Hook touch per riordinare le FASI RUNNING
  const { getTouchHandlers: getStepTouchHandlers } = useTouchDrag({
    onReorder: (from, to) => setRunningSteps(prev => moveElement(prev, from, to))
  })


  // Se editId o duplicateId sono presenti, carichiamo i dati del workout
  useEffect(() => {
    const fetchWorkoutToEdit = async () => {
      if (!sourceId) return
      const { data, error } = await supabase.from('workouts').select('*').eq('id', sourceId).single()
      if (error || !data) return

      setTitle(duplicateId ? `${data.title} (Copia)` : data.title)
      setCoachNotes(data.coach_notes || '')
      
      let loadedDate = data.date
      if (awId && !duplicateId) {
        const { data: awData } = await supabase.from('athlete_workouts').select('completed_date').eq('id', awId).single()
        if (awData) loadedDate = awData.completed_date
      }
      if (!duplicateId) setDate(loadedDate)
      
      const s = data.sections || {}
      if (s.blocks || s.steps || s.category) {
        setBlocks(s.blocks || [])
        setRunningSteps(s.steps || [])
        setWorkoutIntensity(s.intensity || '5')
        setCategory(s.category || (s.steps ? 'Running' : 'Hyrox'))
        if (s.blocks && s.blocks.length > 0) {
          setOpenBlockId(s.blocks[s.blocks.length - 1].id)
        }
      } else {
        const migratedBlocks = []
        if (s.warmup) migratedBlocks.push({ id: Math.random(), type: 'WarmUp', params: { duration: s.warmup.duration }, notes: s.warmup.notes })
        if (s.cashIn && s.cashIn.length > 0) migratedBlocks.push({ id: Math.random(), type: 'Cash In', exercises: s.cashIn })
        if (s.main) {
          if (s.main.type === 'Running') {
             setCategory('Running')
             setRunningSteps(s.main.steps || [])
          } else {
             setCategory('Hyrox')
             migratedBlocks.push({
               id: Math.random(),
               type: s.main.type === 'EMOM' && s.main.params?.on ? 'ON/OFF' : s.main.type,
               params: s.main.params || {},
               exercises: s.main.exercises || []
             })
          }
        }
        if (s.cashOut && s.cashOut.length > 0) migratedBlocks.push({ id: Math.random(), type: 'Cash Out', exercises: s.cashOut })
        
        setBlocks(migratedBlocks)
        setWorkoutIntensity(s.intensity || '5')
        if (migratedBlocks.length > 0) {
          setOpenBlockId(migratedBlocks[migratedBlocks.length - 1].id)
        }
      }
      setStep(2)
    }

    const draftStr = localStorage.getItem('fleofit_workout_draft')
    if (draftStr) {
      try {
        const draft = JSON.parse(draftStr)
        if ((draft.sourceId || null) === (sourceId || null)) {
          setConfirmInfo({
            title: 'Bozza Trovata',
            message: 'Hai un allenamento non salvato! Vuoi ripristinarlo da dove eri rimasto?',
            onConfirm: () => {
              setTitle(draft.title || '')
              setDate(draft.date || format(new Date(), 'yyyy-MM-dd'))
              setWorkoutIntensity(draft.workoutIntensity || '5')
              setCategory(draft.category || 'Hyrox')
              setBlocks(draft.blocks || [])
              setRunningSteps(draft.runningSteps || [])
              setCoachNotes(draft.coachNotes || '')
              if (draft.title) setStep(2)
              setConfirmInfo(null)
            },
            onCancel: () => {
              localStorage.removeItem('fleofit_workout_draft')
              setConfirmInfo(null)
              fetchWorkoutToEdit()
            }
          })
          return
        } else {
          localStorage.removeItem('fleofit_workout_draft')
        }
      } catch (e) {
        localStorage.removeItem('fleofit_workout_draft')
      }
    }
    fetchWorkoutToEdit()
  }, [sourceId, duplicateId])

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [pendingPath, setPendingPath] = useState(null)
  const [alertInfo, setAlertInfo] = useState(null)
  const [confirmInfo, setConfirmInfo] = useState(null)

  const hasUnsavedChanges = title.trim() !== '' || blocks.length > 0 || runningSteps.length > 0

  // 0. Salvataggio automatico bozza in locale
  useEffect(() => {
    if (hasUnsavedChanges && !saved) {
      const draft = { sourceId: sourceId || null, title, date, workoutIntensity, category, blocks, runningSteps, coachNotes }
      localStorage.setItem('fleofit_workout_draft', JSON.stringify(draft))
    }
  }, [title, date, workoutIntensity, category, blocks, runningSteps, coachNotes, sourceId, hasUnsavedChanges, saved])

  useEffect(() => {
    if (saved) localStorage.removeItem('fleofit_workout_draft')
  }, [saved])

  useEffect(() => {
    // 1. Intercetta chiusura/aggiornamento del tab del browser
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges && !saved) {
        e.preventDefault()
        // I browser moderni (specialmente iOS Safari) ignorano i messaggi personalizzati
        // e richiedono esplicitamente il ritorno di una stringa vuota per attivare il popup nativo
        e.returnValue = ''
        return ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    // Fix specifico per forzare l'avviso su iOS Safari
    window.onbeforeunload = handleBeforeUnload

    // Blocca fisicamente il "Pull to Refresh" (trascinamento verso il basso) su mobile
    if (hasUnsavedChanges && !saved) {
      document.body.style.overscrollBehavior = 'none'
      document.documentElement.style.overscrollBehavior = 'none'
    } else {
      document.body.style.overscrollBehavior = 'auto'
      document.documentElement.style.overscrollBehavior = 'auto'
    }

    // Blocca fisicamente il "Pull to Refresh" tramite Javascript per Safari iOS
    let touchStartY = 0
    const handleTouchStart = (e) => {
      if (e.touches && e.touches.length > 0) touchStartY = e.touches[0].clientY
    }
    const handleTouchMove = (e) => {
      // Se stiamo scorrendo verso il basso partendo dalla cima della pagina
      if (hasUnsavedChanges && !saved && window.scrollY <= 0) {
        if (e.touches && e.touches.length > 0 && e.touches[0].clientY > touchStartY) {
          e.preventDefault() // Annulla il ricaricamento manuale
        }
      }
    }
    document.addEventListener('touchstart', handleTouchStart, { passive: false })
    document.addEventListener('touchmove', handleTouchMove, { passive: false })

    // 2. Intercetta i click sui link di navigazione interna (es. bottoni della Navbar)
    const handleLinkClick = (e) => {
      if (hasUnsavedChanges && !saved) {
        const link = e.target.closest('a')
        if (link && link.host === window.location.host && link.pathname !== window.location.pathname) {
          e.preventDefault()
          e.stopPropagation()
          setPendingPath(link.pathname + link.search)
          setShowExitConfirm(true)
        }
      }
    }
    // Usiamo 'capture: true' per bloccare l'evento prima che React Router faccia cambiare pagina
    document.addEventListener('click', handleLinkClick, { capture: true })

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.onbeforeunload = null
      document.removeEventListener('click', handleLinkClick, { capture: true })
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchmove', handleTouchMove)
      document.body.style.overscrollBehavior = 'auto'
      document.documentElement.style.overscrollBehavior = 'auto'
    }
  }, [hasUnsavedChanges, saved])

  const handleBack = () => {
    if (step === 2 && !sourceId) {
      setStep(1)
    } else {
      if (hasUnsavedChanges && !saved) {
        setPendingPath(-1)
        setShowExitConfirm(true)
      } else {
        localStorage.removeItem('fleofit_workout_draft')
        navigate(-1)
      }
    }
  }

  const isStep1Valid = title.trim() !== '' || category === 'Custom'


  const handleSave = async () => {
    if (!title && category !== 'Custom') return setAlertInfo({ title: 'Dati mancanti', message: 'Inserisci il titolo del workout!', type: 'error' })
    if (category === 'Hyrox' && blocks.length === 0) return setAlertInfo({ title: 'Dati mancanti', message: 'Aggiungi almeno un blocco!', type: 'error' })
    if (category === 'Running' && runningSteps.length === 0) return setAlertInfo({ title: 'Dati mancanti', message: 'Aggiungi almeno una fase di corsa!', type: 'error' })
    if (category === 'Custom' && !coachNotes.trim()) return setAlertInfo({ title: 'Dati mancanti', message: 'Inserisci una descrizione per l\'allenamento!', type: 'error' })
    
    if (editId) {
      setNewWorkoutName(title)
      setIsSavingAsNew(false)
      setShowSaveModal(true)
    } else {
      performSave(false)
    }
  }

  const performSave = async (saveAsNew) => {
    setShowSaveModal(false)
    setSaving(true)
    const finalTitle = titoloOppureGenerato(
      saveAsNew ? newWorkoutName : title,
      date,
      await titoliDelGiorno(supabase, date)
    )

    const sections = {
      intensity: workoutIntensity,
      category: category,
      blocks: category === 'Hyrox' ? blocks : undefined,
      steps: category === 'Running' ? runningSteps : undefined
    }

    const payload = { title: finalTitle, date, sections, coach_notes: coachNotes }
    let targetId = saveAsNew ? null : editId

    if (targetId) {
      const { error } = await supabase.from('workouts').update(payload).eq('id', editId)
      if (awId) {
        await supabase.from('athlete_workouts').update({ completed_date: date }).eq('id', awId)
      }
      setSaving(false)
      if (error) { setAlertInfo({ title: 'Errore', message: error.message, type: 'error' }); return }
    } else {
      const { data: newWorkout, error } = await supabase.from('workouts').insert(payload).select().single()
      if (error) { 
        setSaving(false)
        setAlertInfo({ title: 'Errore', message: error.message, type: 'error' })
        return 
      }
      targetId = newWorkout.id

      if (saveAsNew && awId) {
        const { error: awError } = await supabase.from('athlete_workouts').update({
          workout_id: targetId,
          completed_date: date
        }).eq('id', awId)
        if (awError) console.error("Errore aggiornamento assegnazione:", awError)
      } else if (athleteId) {
        const { data: newAssignment, error: awError } = await supabase.from('athlete_workouts').insert({
          athlete_id: athleteId,
          workout_id: targetId,
          completed_date: date,
          status: 'pending'
        }).select('id').single()
        if (awError) {
          console.error("Errore assegnazione:", awError)
        } else if (newAssignment) {
          supabase.functions.invoke('send-reminders', {
            body: { mode: 'immediate', record_id: newAssignment.id }
          }).catch(console.error)
        }
      }
      setSaving(false)
    }

    setSaved(true)
    navigate(`/workout/${targetId}${athleteId ? `?athlete_id=${athleteId}` : ''}`, { replace: true })
  }

  return (
    <div className="px-4 max-w-2xl mx-auto pb-[calc(6rem+env(safe-area-inset-bottom))] pt-[calc(env(safe-area-inset-top)+1rem)] page-transition">
      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .drag-item {
          -webkit-touch-callout: none;
          -webkit-user-select: none;
          user-select: none;
          -webkit-user-drag: element;
        }
        .drag-item input, .drag-item textarea, .drag-item select, .drag-item button {
          -webkit-user-select: auto;
          user-select: auto;
          -webkit-user-drag: auto;
        }
        .custom-slider {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 60px;
          margin: 0;
          background: transparent;
          touch-action: none;
        }
        .custom-slider:focus {
          outline: none;
        }
        .custom-slider::-webkit-slider-runnable-track {
          width: 100%;
          height: 100%;
          cursor: pointer;
          border-radius: 30px;
          background: transparent;
        }
        .custom-slider::-webkit-slider-thumb {
          height: 44px;
          width: 44px;
          border-radius: 50%;
          cursor: pointer;
          -webkit-appearance: none;
          appearance: none;
          margin-top: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.6);
          position: relative;
        }
        .custom-slider.slider-yellow {
          background: linear-gradient(to right, #f1ba17 var(--progress), #383838 var(--progress));
          background-size: 100% 10px;
          background-position: center;
          background-repeat: no-repeat;
        }
        .custom-slider.slider-yellow::-webkit-slider-thumb {
          background: #f1ba17;
        }
        .custom-slider.slider-blue {
          background: linear-gradient(to right, #0094C6 var(--progress), #383838 var(--progress));
          background-size: 100% 10px;
          background-position: center;
          background-repeat: no-repeat;
        }
        .custom-slider.slider-blue::-webkit-slider-thumb {
          background: #0094C6;
        }
      `}</style>
      <button aria-label="Torna indietro" onClick={handleBack} className="w-11 h-11 bg-[#1e1e1e] border border-[#333] rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:border-[#f1ba17] transition shadow-sm shrink-0 mb-6">
        <X size={22} />
      </button>
      <h1 className="text-2xl font-bold text-[#f1ba17] mb-4">{editId ? 'Modifica Workout' : 'Crea Workout'}</h1>

      <div className="flex flex-col gap-3 mb-6">
        <input
          className="bg-[#222] border border-[#333] rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#f1ba17] font-medium text-base"
          placeholder={category === 'Custom' ? generaTitolo(date) : 'Nome workout (es. Hyrox Strength #1)'}
          value={title}
          onChange={e => setTitle(e.target.value)}
        />
        <CustomDatePicker
          date={date}
          onChange={setDate}
          placeholder="Data dell'allenamento"
          className="bg-[#222] border border-[#333] rounded-xl px-4 py-3 text-base hover:border-[#f1ba17] w-full"
        />
      </div>

      {/* ── STEP 1: TIPO ─────────────────────────────────── */}
      {step === 1 && (
        <div className="flex flex-col gap-4">
          <p className="text-gray-400 text-sm font-medium">Seleziona Categoria:</p>
          <div className="relative flex bg-[#111] p-1.5 rounded-2xl border border-[#333] mb-2">
            <div 
              className={`absolute top-1.5 bottom-1.5 left-1.5 w-[calc(33.333%-0.25rem)] rounded-xl shadow-md transition-all duration-300 ease-out ${
                category === 'Hyrox' ? 'translate-x-0 bg-[#f1ba17]/10 border border-[#f1ba17]/50' : 
                category === 'Running' ? 'translate-x-full bg-[#0094C6]/10 border border-[#0094C6]/50' : 
                'translate-x-[200%] bg-[#D11149]/10 border border-[#D11149]/50'
              }`}
            />
            <button 
              onClick={() => setCategory('Hyrox')} 
              className={`relative z-10 flex-1 py-3.5 rounded-xl font-bold transition-colors duration-300 flex items-center justify-center gap-1.5 ${category === 'Hyrox' ? 'text-[#f1ba17]' : 'text-gray-500 hover:text-gray-300'}`}>
              <Dumbbell size={18} /> Hyrox
            </button>
            <button 
              onClick={() => setCategory('Running')} 
              className={`relative z-10 flex-1 py-3.5 rounded-xl font-bold transition-colors duration-300 flex items-center justify-center gap-1.5 ${category === 'Running' ? 'text-[#0094C6]' : 'text-gray-500 hover:text-gray-300'}`}>
              <Timer size={18} /> Running
            </button>
            <button 
              onClick={() => setCategory('Custom')} 
              className={`relative z-10 flex-1 py-3.5 rounded-xl font-bold transition-colors duration-300 flex items-center justify-center gap-1.5 ${category === 'Custom' ? 'text-[#D11149]' : 'text-gray-500 hover:text-gray-300'}`}>
              <Dumbbell size={18} /> Custom
            </button>
          </div>

          {!isStep1Valid && (
            <p className="text-yellow-500 text-xs text-center mb-2 animate-in fade-in duration-300">
              ↑ Completa nome e data per proseguire
            </p>
          )}

          <div key={category} className="animate-in fade-in zoom-in-[0.98] duration-300 ease-out">
            {category === 'Hyrox' ? (
              <button 
                onClick={() => setStep(2)} 
                disabled={!isStep1Valid}
                className={`w-full py-4 mt-2 rounded-2xl border border-[#f1ba17]/50 bg-[#f1ba17]/10 text-[#f1ba17] font-bold text-lg transition ${!isStep1Valid ? 'opacity-40 cursor-not-allowed' : 'hover:brightness-125'}`}
              >
                Crea Allenamento Hyrox →
              </button>
            ) : category === 'Running' ? (
              <button 
                onClick={() => setStep(2)} 
                disabled={!isStep1Valid}
                className={`w-full py-4 mt-2 rounded-2xl border border-[#0094C6]/50 bg-[#0094C6]/10 text-[#0094C6] font-bold text-lg transition ${!isStep1Valid ? 'opacity-40 cursor-not-allowed' : 'hover:brightness-125'}`}
              >
                Crea Allenamento Corsa →
              </button>
            ) : (
              <button 
                onClick={() => setStep(2)} 
                disabled={!isStep1Valid}
                className={`w-full py-4 mt-2 rounded-2xl border border-[#D11149]/50 bg-[#D11149]/10 text-[#D11149] font-bold text-lg transition ${!isStep1Valid ? 'opacity-40 cursor-not-allowed' : 'hover:brightness-125'}`}
              >
                Crea Allenamento Custom →
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── STEP 2: BUILD WORKOUT (HYROX) ────────────────────────── */}
      {step === 2 && category === 'Hyrox' && (
        <div className="flex flex-col gap-4">

          <div className="px-4 py-4 rounded-2xl border border-[#444] bg-[#222] flex flex-col gap-3">

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Dumbbell size={18} className="text-[#f1ba17]" />
                <span className="font-bold text-[#f1ba17]">Allenamento Hyrox</span>
              </div>
              <div className="flex items-center gap-1">
                 <span className={`text-sm font-bold ${getIntensityColor(workoutIntensity)}`}>{workoutIntensity}/10</span>
                 <BicepsFlexed size={18} className={getIntensityColor(workoutIntensity)} />
              </div>
            </div>
            <IntensityPicker value={workoutIntensity} onChange={setWorkoutIntensity} />
          </div>

          <div className="flex flex-col gap-4" data-drag-container>
            {blocks.map((block, idx) => (
              <HyroxBlock 
                key={block.id} block={block} index={idx} total={blocks.length}
                isOpen={openBlockId === block.id}
                onToggle={() => setOpenBlockId(openBlockId === block.id ? null : block.id)}
                onUpdate={newB => {
                  const nb = [...blocks]
                  nb[idx] = newB
                  setBlocks(nb)
                }}
                onRemove={() => setBlocks(blocks.filter(b => b.id !== block.id))}
                onMoveUp={() => setBlocks(moveElement(blocks, idx, idx - 1))}
                onMoveDown={() => setBlocks(moveElement(blocks, idx, idx + 1))}
                onDragStartIndex={(index) => setDraggedBlockIdx(index)}
                onDragEnterIndex={(index) => {
                  if (draggedBlockIdx !== null && draggedBlockIdx !== index) {
                    setBlocks(prev => moveElement(prev, draggedBlockIdx, index))
                    setDraggedBlockIdx(index)
                  }
                }}
                onDragEndIndex={() => setDraggedBlockIdx(null)}
                onDuplicate={() => {
                  const duplicatedBlock = JSON.parse(JSON.stringify(block))
                  duplicatedBlock.id = Math.random()
                  if (duplicatedBlock.exercises) {
                    duplicatedBlock.exercises = duplicatedBlock.exercises.map(ex => ({ ...ex, id: Math.random() }))
                  }
                  const newBlocks = [...blocks]
                  newBlocks.splice(idx + 1, 0, duplicatedBlock)
                  setBlocks(newBlocks)
                }}
                onDuplicateExerciseRequest={(exToDuplicate) => {
                  const nb = [...blocks]
                  const currentExercises = nb[idx].exercises || []
                  nb[idx] = { ...nb[idx], exercises: [...currentExercises, { ...exToDuplicate, id: Math.random() }] }
                  setBlocks(nb)
                }}
                touchHandlers={getBlockTouchHandlers}
              />
            ))}
          </div>

          <div className="flex gap-3">
            <button onClick={() => setBlockPickerOpen(true)} className="flex-1 py-4 border border-dashed border-[#383838] rounded-xl text-gray-400 text-sm hover:border-[#f1ba17] hover:text-[#f1ba17] transition font-medium">
              + Aggiungi Blocco
            </button>
            <button onClick={() => setAiModalOpen(true)} className="flex-1 py-4 border border-dashed border-[#a855f7]/30 bg-[#a855f7]/10 rounded-xl text-[#a855f7] text-sm hover:border-[#a855f7] hover:bg-[#a855f7]/20 transition font-medium flex items-center justify-center gap-2">
              <Wand2 size={18} /> Genera con IA
            </button>
          </div>

          {/* NOTE COACH */}
          <div className="mt-4">
            <label className="text-gray-400 text-sm mb-2 block">Note coach (appariranno nel PDF)</label>
            <textarea
              className="w-full bg-[#222] border border-[#333] rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#f1ba17] resize-none text-base"
              rows={3}
              placeholder="Es: vai a cedimento sull'ultimo esercizio, mantieni il ritmo..."
              value={coachNotes}
              onChange={e => setCoachNotes(e.target.value)}
            />
          </div>


          {/* BOTTONI */}
          <div className="flex gap-3">
            <button onClick={handleSave} disabled={saving}
              className="w-full justify-center px-6 py-3 rounded-xl bg-[#f1ba17] text-black font-bold hover:brightness-110 transition disabled:opacity-50 flex items-center gap-2">
              <Save size={18} />
              {saving ? 'Salvo...' : saved ? '✅ Salvato!' : 'Salva Workout'}
            </button>
          </div>
        </div>
      )}

      {blockPickerOpen && (
        <BlockPickerModal 
          onClose={() => setBlockPickerOpen(false)}
          onAdd={(type) => {
            const newBlock = { id: Math.random(), type, params: {}, exercises: [] }
            if (type === 'WarmUp' || type === 'Rest') newBlock.params.duration = '3:00'
            if (type === 'ON/OFF') { newBlock.params.on = '1:00'; newBlock.params.off = '1:00'; newBlock.params.rounds = '10' }
            if (type === 'EMOM') { newBlock.params.interval = '1:00'; newBlock.params.rounds = '10' }
            if (type === 'AMRAP') { newBlock.params.duration = '10:00' }
            if (type === 'For Time') { newBlock.params.rounds = '3' }
                        if (type === 'Interval') { newBlock.params.rounds = '1' }

            if (type === 'Cash In' || type === 'Cash Out') { newBlock.params.rounds = '1' }
            setBlocks([...blocks, newBlock])
            setOpenBlockId(newBlock.id)
            setBlockPickerOpen(false)
          }}
        />
      )}

      {aiModalOpen && (
        <AiGenerationModal 
          onClose={() => setAiModalOpen(false)}
          onGenerate={(newBlocks) => {
            const formattedBlocks = newBlocks.map(b => ({
              ...b,
              id: Math.random(),
              exercises: (b.exercises || []).map(ex => ({
                ...ex,
                id: Math.random()
              }))
            }))
            setBlocks([...blocks, ...formattedBlocks])
            if (formattedBlocks.length > 0) setOpenBlockId(formattedBlocks[formattedBlocks.length - 1].id)
          }}
        />
      )}

      {/* ── STEP 2: BUILD RUNNING WORKOUT ────────────────── */}
      {step === 2 && category === 'Running' && (
        <div className="flex flex-col gap-4">
          <div className="px-4 py-4 rounded-2xl border border-[#444] bg-[#222] flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Timer size={18} className="text-[#0094C6]" />
                <span className="font-bold text-[#0094C6]">Allenamento Corsa</span>
              </div>
              <div className="flex items-center gap-1">
                 <span className={`text-sm font-bold ${getIntensityColor(workoutIntensity)}`}>{workoutIntensity}/10</span>
                 <BicepsFlexed size={18} className={getIntensityColor(workoutIntensity)} />
              </div>
            </div>
            <input type="range" min="1" max="10" value={workoutIntensity} onChange={e => setWorkoutIntensity(e.target.value)} className="w-full accent-[#0094C6]" />
          </div>

          <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-white font-semibold text-sm">Fasi dell'allenamento</span>
              <button aria-label="Aggiungi una fase di corsa" onClick={() => setRunningPickerOpen(true)} className="text-[#0094C6] hover:brightness-110">
                <Plus size={18} />
              </button>
            </div>

            {runningSteps.length === 0 ? (
              <button onClick={() => setRunningPickerOpen(true)}
                className="w-full py-4 border border-dashed border-[#383838] rounded-xl text-gray-400 text-sm hover:border-[#0094C6] hover:text-[#0094C6] transition">
                + Aggiungi prima fase (es. Riscaldamento)
              </button>
            ) : (
              <div className="flex flex-col gap-2" data-drag-container>
                {runningSteps.map((step, i) => (
                  <RunningStepRow
                    key={step.id}
                    step={step}
                    index={i}
                    total={runningSteps.length}
                    onRemove={id => setRunningSteps(runningSteps.filter(s => s.id !== id))}
                    onMoveUp={idx => setRunningSteps(moveElement(runningSteps, idx, idx - 1))}
                    onMoveDown={idx => setRunningSteps(moveElement(runningSteps, idx, idx + 1))}
                    onDragStartIndex={(idx) => setDraggedStepIdx(idx)}
                    onDragEnterIndex={(idx) => {
                      if (draggedStepIdx !== null && draggedStepIdx !== idx) {
                        setRunningSteps(prev => moveElement(prev, draggedStepIdx, idx))
                        setDraggedStepIdx(idx)
                      }
                    }}
                    onDragEndIndex={() => setDraggedStepIdx(null)}
                    onEdit={stepToEdit => {
                      setEditingStep(stepToEdit)
                      setRunningPickerOpen(true)
                    }}
                    onDuplicate={(stepToDuplicate) => {
                      setRunningSteps(prev => [...prev, { ...stepToDuplicate, id: Math.random() }])
                    }}
                    touchHandlers={getStepTouchHandlers}
                  />
                ))}
                <button onClick={() => setRunningPickerOpen(true)}
                  className="flex items-center justify-center gap-2 border border-dashed border-[#383838] rounded-xl py-3 text-[#0094C6] text-sm font-medium mt-1 hover:border-[#0094C6] transition">
                  <Plus size={16} /> Aggiungi fase
                </button>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button onClick={handleSave} disabled={saving}
              className="w-full justify-center px-6 py-3 rounded-xl bg-[#f1ba17] text-black font-bold hover:brightness-110 transition disabled:opacity-50 flex items-center gap-2">
              <Save size={18} />
              {saving ? 'Salvo...' : saved ? '✅ Salvato!' : 'Salva Workout'}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: BUILD CUSTOM WORKOUT ────────────────── */}
      {step === 2 && category === 'Custom' && (
        <div className="flex flex-col gap-4">
          <div className="px-4 py-4 rounded-2xl border border-[#444] bg-[#222] flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Dumbbell size={18} className="text-[#D11149]" />
                <span className="font-bold text-[#D11149]">Allenamento Custom</span>
              </div>
              <div className="flex items-center gap-1">
                 <span className={`text-sm font-bold ${getIntensityColor(workoutIntensity)}`}>{workoutIntensity}/10</span>
                 <BicepsFlexed size={18} className={getIntensityColor(workoutIntensity)} />
              </div>
            </div>
            <IntensityPicker value={workoutIntensity} onChange={setWorkoutIntensity} activeColor="bg-[#D11149]" />
          </div>

          <div className="mt-2">
            <label className="text-gray-400 text-sm mb-2 block">Descrizione / Note per l'atleta</label>
            <textarea
              className="w-full bg-[#222] border border-[#333] rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#D11149] resize-none text-base"
              rows={8}
              placeholder="Descrivi l'allenamento in dettaglio. Questa descrizione apparirà a tutti gli atleti a cui assegnerai questo workout."
              value={coachNotes}
              onChange={e => setCoachNotes(e.target.value)}
            />
          </div>

          <div className="flex gap-3 mt-4">
            <button onClick={handleSave} disabled={saving}
              className="w-full justify-center px-6 py-3 rounded-xl bg-[#D11149] text-white font-bold hover:brightness-110 transition disabled:opacity-50 flex items-center gap-2">
              <Save size={18} />
              {saving ? 'Salvo...' : saved ? '✅ Salvato!' : 'Salva Workout'}
            </button>
          </div>
        </div>
      )}

      {/* RUNNING STEP PICKER MODAL */}
      {runningPickerOpen && (
        <RunningStepPicker
          initialStep={editingStep}
          onAdd={step => {
            if (editingStep) {
              setRunningSteps(runningSteps.map(s => s.id === step.id ? step : s))
            } else {
              setRunningSteps([...runningSteps, step])
            }
          }}
          onClose={() => setRunningPickerOpen(false)}
        />
      )}

      {/* SAVE MODAL */}
      {showSaveModal && createPortal(
        <div className="fixed inset-0 bg-black/85 z-[100] flex items-center justify-center p-4">
          <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-3xl w-full max-w-sm p-6 flex flex-col gap-4 shadow-2xl animate-in fade-in zoom-in-[0.96] duration-300 ease-out">
            <div className="flex justify-between items-center mb-2">
               <h2 className="text-xl font-bold text-white">Salvataggio</h2>
               <button aria-label="Chiudi" onClick={() => setShowSaveModal(false)} className="text-gray-500 hover:text-white"><X size={20} /></button>
            </div>
            
            {!isSavingAsNew ? (
              <>
                <p className="text-gray-400 text-sm">Vuoi sovrascrivere questo allenamento o salvarlo come nuovo?</p>
                <div className="flex flex-col gap-3 mt-2">
                  <button 
                    onClick={() => performSave(false)}
                    className="w-full py-3 bg-[#f1ba17] text-black font-bold rounded-xl hover:brightness-110 transition"
                  >
                    Sovrascrivi esistente
                  </button>
                  <button 
                    onClick={() => setIsSavingAsNew(true)}
                    className="w-full py-3 bg-[#2a2a2a] border border-[#383838] text-white font-bold rounded-xl hover:border-[#f1ba17] hover:text-[#f1ba17] transition"
                  >
                    Salva come nuovo
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-gray-400 text-sm">Inserisci il nome per il nuovo allenamento:</p>
                <input 
                  autoFocus
                  className="bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#f1ba17] w-full mt-1 text-base"
                  value={newWorkoutName}
                  onChange={(e) => setNewWorkoutName(e.target.value)}
                  placeholder="Nome del workout..."
                />
                <div className="flex gap-3 mt-4">
                  <button 
                    onClick={() => setIsSavingAsNew(false)}
                    className="flex-1 py-3 bg-[#2a2a2a] text-white font-semibold rounded-xl hover:bg-[#333] transition text-sm"
                  >
                    Indietro
                  </button>
                  <button 
                    onClick={() => performSave(true)}
                    disabled={!newWorkoutName.trim() || saving}
                    className="flex-1 py-3 bg-[#f1ba17] text-black font-bold rounded-xl hover:brightness-110 transition disabled:opacity-50 text-sm"
                  >
                    {saving ? 'Salvataggio...' : 'Conferma'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* EXIT CONFIRM MODAL */}
      {showExitConfirm && createPortal(
        <div className="fixed inset-0 bg-black/85 z-[100] flex items-center justify-center p-4">
          <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-3xl w-full max-w-sm p-6 flex flex-col gap-4 text-center shadow-2xl animate-in fade-in zoom-in-[0.96] duration-300 ease-out">
            <div className="w-16 h-16 rounded-full bg-red-900/30 text-red-500 flex items-center justify-center mx-auto mb-2 shrink-0">
              <AlertTriangle size={32} />
            </div>
            <h2 className="text-xl font-bold text-white">Sei sicuro?</h2>
            <p className="text-gray-400 text-sm">
              Hai delle modifiche non salvate. Se esci ora, i dati andranno persi.
            </p>
            <div className="flex gap-3 mt-4">
              <button 
                onClick={() => setShowExitConfirm(false)}
                className="flex-1 py-3 bg-[#2a2a2a] text-white font-semibold rounded-xl hover:bg-[#333] transition"
              >
                Annulla
              </button>
              <button 
                onClick={() => {
                  localStorage.removeItem('fleofit_workout_draft')
                  navigate(pendingPath)
                }}
                className="flex-1 py-3 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-500 transition"
              >
                Sì, esci
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      
      {createPortal(
        <>
          <CustomAlert info={alertInfo} onClose={() => setAlertInfo(null)} />
          <CustomConfirm info={confirmInfo} onClose={() => {
            if (confirmInfo?.onCancel) confirmInfo.onCancel()
            else setConfirmInfo(null)
          }} />
        </>,
        document.body
      )}
    </div>
  )
}