import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { ChevronLeft, ChevronUp, Download, Share2, Timer, Flag, FlagOff, Dumbbell, Users, X, User, Send, Edit, Trash2, AlertTriangle, Check, BicepsFlexed, Copy, CheckCircle2, Circle, CalendarDays, Mic, Square, Play, Pause, MonitorUp, StepForward, StepBack, Volume2, VolumeX, ChevronDown, Activity, Heart, WifiOff } from 'lucide-react'
import { format, parseISO, isValid, isBefore, startOfDay } from 'date-fns'
import { it } from 'date-fns/locale'
import jsPDF from 'jspdf'
import { toBlob, toPng } from 'html-to-image'
import { CustomAlert, CustomConfirm } from '../components/CustomModals'
import CustomDatePicker from '../components/CustomDatePicker'
import { useAuth } from '../App'
import { Capacitor } from '@capacitor/core'
import { Badge } from '@capawesome/capacitor-badge'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { Media } from '@capacitor-community/media'
import { VoiceRecorder as NativeVoiceRecorder } from '@independo/capacitor-voice-recorder'
import { KeepAwake } from '@capacitor-community/keep-awake'
import { BluetoothService } from './bluetooth'
import { Network } from '@capacitor/network'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { blockHint } from '../lib/blockHints'
import { generaTitolo, titoloOppureGenerato, titoliDelGiorno } from '../lib/workoutTitle'

const TYPE_COLORS = {
  'WarmUp': { text: 'text-gray-400', bg: 'bg-[#2a2a2a]', border: 'border-[#383838]', hex: '#9ca3af' },
  'Rest': { text: 'text-gray-500', bg: 'bg-[#1e1e1e]', border: 'border-[#2a2a2a]', hex: '#6b7280' },
  'Cash In': { text: 'text-gray-300', bg: 'bg-[#222]', border: 'border-[#444]', hex: '#d1d5db' },
  'Cash Out': { text: 'text-gray-300', bg: 'bg-[#222]', border: 'border-[#444]', hex: '#d1d5db' },
  'ON/OFF': { text: 'text-gray-200', bg: 'bg-[#222]', border: 'border-[#333]', hex: '#e5e5e5' },
  EMOM: { text: 'text-gray-200', bg: 'bg-[#222]', border: 'border-[#333]', hex: '#e5e5e5' },
  AMRAP: { text: 'text-gray-200', bg: 'bg-[#222]', border: 'border-[#333]', hex: '#e5e5e5' },
  'For Time': { text: 'text-gray-200', bg: 'bg-[#222]', border: 'border-[#333]', hex: '#e5e5e5' },
    'Interval': { text: 'text-gray-200', bg: 'bg-[#222]', border: 'border-[#333]', hex: '#e5e5e5' },

   'Running': { text: 'text-[#0094C6]', bg: 'bg-[#0094C6]/10', border: 'border-[#0094C6]/30', hex: '#0094C6' },
  'Custom': { text: 'text-[#D11149]', bg: 'bg-[#D11149]/10', border: 'border-[#D11149]/30', hex: '#D11149' },
  'Event': { text: 'text-white', bg: 'bg-white/10', border: 'border-white/30', hex: '#ffffff' }
}
const getIntensityColor = (val) => {
  const num = parseInt(val, 10);
  if (isNaN(num)) return 'text-gray-500';
  if (num <= 3) return 'text-green-400';
  if (num <= 6) return 'text-yellow-400';
  if (num <= 8) return 'text-orange-500';
  return 'text-red-500';
}

const getPdfIntensityColor = (val) => {
  const num = parseInt(val, 10);
  if (isNaN(num)) return [156, 163, 175];
  if (num <= 3) return [74, 222, 128];
  if (num <= 6) return [250, 204, 21];
  if (num <= 8) return [249, 115, 22];
  return [239, 68, 68];
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

const getNormalizedBlocks = (workout) => {
  const s = workout.sections || {}
  if (s.blocks) return s.blocks
  
  const blocks = []
  if (s.warmup) blocks.push({ id: 'w', type: 'WarmUp', params: { duration: s.warmup.duration }, notes: s.warmup.notes })
  if (s.cashIn?.length > 0) blocks.push({ id: 'ci', type: 'Cash In', exercises: s.cashIn })
  if (s.main && s.main.type !== 'Running') {
    blocks.push({
      id: 'm',
      type: s.main.type === 'EMOM' && s.main.params?.on ? 'ON/OFF' : s.main.type,
      params: s.main.params || {},
      exercises: s.main.exercises || []
    })
  }
  if (s.cashOut?.length > 0) blocks.push({ id: 'co', type: 'Cash Out', exercises: s.cashOut })
  return blocks
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

const parseDuration = (val) => {
  if (!val) return 0;
  const str = String(val).toLowerCase().replace(/[^0-9:\.]/g, '').trim();
  if (String(val).toLowerCase().includes('sec')) return parseInt(str, 10) || 0;
  const parts = str.split(':');
  if (parts.length === 2) return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  if (parts.length === 3) return parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseInt(parts[2], 10);
  return Math.round((parseFloat(str) || 0) * 60); 
}

const parseNotesAndRpe = (fullNote) => {
  if (!fullNote) return { rpe: '5', text: '' };
  const match = fullNote.match(/^\[RPE:\s*(\d+)\/10\]\n?([\s\S]*)$/);
  if (match) {
    return { rpe: match[1], text: match[2] };
  }
  return { rpe: '5', text: fullNote };
}
const formatNotesWithRpe = (rpe, text) => {
  const cleanText = text.trim();
  if (!cleanText && rpe === '5') return '';
  return `[RPE: ${rpe}/10]\n${cleanText}`;
}
const getRpeColorText = (val) => {
  if (val <= 3) return 'text-green-500';
  if (val <= 6) return 'text-yellow-400';
  if (val <= 8) return 'text-orange-500';
  return 'text-red-500';
}

const ERGOMETERS = ['SkiErg', 'Rowing', 'Assault Bike', 'Echo Bike', 'TrueForm Runner', 'Curve Treadmill']
const isErgo = (name) => ERGOMETERS.includes(name)

const SLED_EXERCISES = ['Sled Push', 'Sled Pull', 'Prowler Push', 'Sled Drag']
const isSled = (name) => SLED_EXERCISES.includes(name)
const DISTANCE_EXERCISES = [
  'Farmers Carry', 'Farmers Walk', 'Suitcase Carry', 'Sandbag Carry', 'Yoke Carry', 
  "Waiter's Walk", 'Handstand Walk', 'Run', 'Bear Crawl', 'Shuttle Run', 'Swim'
]
const isDistance = (name) => isErgo(name) || isSled(name) || DISTANCE_EXERCISES.includes(name)

const buildTimerSequence = (workout) => {
  const seq = [];
  seq.push({ id: 'prep', title: 'Preparazione', subtitle: 'Il workout sta per iniziare', duration: 10, theme: 'prep', type: 'prep', task: 'Preparati!' });

  const s = workout.sections || {};
  const rawCat = s?.category || (s?.main?.type === 'Running' || s?.steps ? 'Running' : 'Hyrox');
  const isAuto = s?.isAutonomous === true || rawCat === 'Autonomo';
  const isCustom = rawCat === 'Custom' || isAuto;
  const isRunning = rawCat === 'Running';

  if (isCustom) {
    seq.push({ id: 'custom-blk', title: 'ALLENAMENTO', subtitle: 'Cronometro libero', duration: 0, theme: 'custom', type: 'stopwatch', task: workout.title || 'Workout Custom' });
  } else if (isRunning) {
    const steps = s?.steps || s?.main?.steps || [];
    steps.forEach((step, i) => {
      if (step.type === 'repeat') {
        const rounds = parseInt(step.rounds, 10) || 1;
        const runSec = parseDuration(step.runDuration);
        const recSec = parseDuration(step.recDuration);
        for(let r=1; r<=rounds; r++) {
          if (runSec > 0) seq.push({ id: `run-${i}-${r}-work`, title: 'Corsa', subtitle: `Ripetuta ${r}/${rounds}`, duration: runSec, theme: 'run', type: 'work', task: `Corsa ${step.runPace ? '@ '+step.runPace : ''}`.trim() });
          if (recSec > 0) seq.push({ id: `run-${i}-${r}-rest`, title: 'Recupero', subtitle: `Ripetuta ${r}/${rounds}`, duration: recSec, theme: 'rest', type: 'rest', task: `Recupero ${step.recPace ? '@ '+step.recPace : ''}`.trim() });
        }
      } else {
        const sec = parseDuration(step.duration);
        let title = 'Corsa'; let theme = 'run';
        if (step.type === 'warmup') { title = 'Riscaldamento'; theme = 'base'; }
        if (step.type === 'recover') { title = 'Recupero'; theme = 'rest'; }
        if (step.type === 'cooldown') { title = 'Defaticamento'; theme = 'base'; }
        seq.push({ id: `step-${i}`, title, subtitle: step.notes || '', duration: sec, theme, type: step.type === 'recover' ? 'rest' : 'work', task: `${title} ${step.pace ? '@ '+step.pace : ''}`.trim() });
      }
    });
  } else {
    const blocks = getNormalizedBlocks(workout);
    blocks.forEach((b, i) => {
      const exNames = (b.exercises || []).map(e => e.name).join(' • ');
      
      const getTaskForRound = (r) => {
        if (!b.exercises || b.exercises.length === 0) return null;
        const ex = b.exercises[(r - 1) % b.exercises.length];
        const detail = ex.exTime && ex.exTime !== '-' ? ex.exTime : ((ex.meters && ex.meters !== '-') ? ex.meters : (ex.reps && ex.reps !== '-' ? `${ex.reps} reps` : ''));
        const paceStr = isErgo(ex.name) && ex.ergoPace && ex.ergoPace !== '-' && ex.ergoPace !== 'Libero' ? `@ ${ex.ergoPace}` : '';
        const kgStr = ex.kg ? `${ex.kg}kg` : '';
        return [ex.name, detail, paceStr, kgStr].filter(Boolean).join(' · ');
      };
      
      if (b.type === 'WarmUp' || b.type === 'Rest') {
        const sec = parseDuration(b.params?.duration);
        seq.push({ id: `blk-${i}`, title: b.type, subtitle: b.notes || '', duration: sec, theme: b.type==='Rest' ? 'rest' : 'base', type: b.type==='Rest' ? 'rest' : 'work', task: b.type === 'WarmUp' ? 'Riscaldamento' : 'Riposo' });
      } else if (b.type === 'ON/OFF') {
        const rounds = parseInt(b.params?.rounds, 10) || 10;
        const onSec = parseDuration(b.params?.on || '1:00');
        const offSec = parseDuration(b.params?.off || '1:00');
        for(let r=1; r<=rounds; r++) {
           seq.push({ id: `blk-${i}-${r}-on`, title: 'WORK (ON)', subtitle: `Round ${r}/${rounds}`, duration: onSec, theme: 'hyrox', type: 'work', task: getTaskForRound(r) || 'Lavoro' });
           seq.push({ id: `blk-${i}-${r}-off`, title: 'REST (OFF)', subtitle: `Round ${r}/${rounds}`, duration: offSec, theme: 'rest', type: 'rest', task: 'Riposo' });
        }
      } else if (b.type === 'EMOM') {
        const rounds = parseInt(b.params?.rounds, 10) || 10;
        const intSec = parseDuration(b.params?.interval || '1:00');
        for(let r=1; r<=rounds; r++) {
           seq.push({ id: `blk-${i}-${r}`, title: 'EMOM', subtitle: `Round ${r}/${rounds}`, duration: intSec, theme: 'emom', type: 'work', task: getTaskForRound(r) || 'EMOM' });
        }
      } else if (b.type === 'AMRAP') {
        const sec = parseDuration(b.params?.duration || '10:00');
        seq.push({ id: `blk-${i}`, title: 'AMRAP', subtitle: '', duration: sec, theme: 'emom', type: 'work', task: exNames || 'AMRAP' });
      } else if (b.type === 'For Time' || b.type === 'Interval') {
        const rounds = parseInt(b.params?.rounds, 10) || 1;
        const sec = parseDuration(b.params?.timecap || '0'); 
        for(let r=1; r<=rounds; r++) {
           seq.push({ id: `blk-${i}-${r}`, title: b.type.toUpperCase(), subtitle: `Round ${r}/${rounds}`, duration: sec, theme: 'base', type: sec > 0 ? 'work' : 'stopwatch', task: exNames || b.type.toUpperCase() });
        }
      } else {
        seq.push({ id: `blk-${i}`, title: b.type.toUpperCase(), subtitle: '', duration: 0, theme: 'base', type: 'stopwatch', task: exNames || b.type.toUpperCase() });
      }
    });
  }

  seq.push({ id: 'done', title: 'Completato!', subtitle: 'Ottimo lavoro', duration: 0, theme: 'done', type: 'done', task: 'Workout terminato 🎉' });
  
  // Assegna il nextTask a ogni step
  for(let i=0; i<seq.length-1; i++) {
    seq[i].nextTask = seq[i+1].task;
  }

  return seq;
}

const isVoiceNoteValid = (url) => {
  if (!url) return false
  if (url.includes('#deleted=')) return false
  return true
}

const getEmojiDataURL = (emoji) => {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, 64, 64)
  ctx.font = '48px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(emoji, 32, 36)
  return canvas.toDataURL('image/png')
}



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

export default function WorkoutDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const queryAthleteId = searchParams.get('athlete_id')
  const { role, user } = useAuth()
  const isOwnProfile = queryAthleteId === user?.id

  const [workout, setWorkout] = useState(null)
  const [loading, setLoading] = useState(true)
  const igRef = useRef(null)

  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [athletes, setAthletes] = useState([])
  const [assigning, setAssigning] = useState(false)
  const [athleteNote, setAthleteNote] = useState(null)
  const [editingNote, setEditingNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [alertInfo, setAlertInfo] = useState(null)
  const [confirmInfo, setConfirmInfo] = useState(null)
  const [assignDate, setAssignDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [athleteWorkoutId, setAthleteWorkoutId] = useState(null)
  const [workoutStatus, setWorkoutStatus] = useState('pending')
const [selectedAthletes, setSelectedAthletes] = useState([])
  const [assignStep, setAssignStep] = useState(1)
  const [assignments, setAssignments] = useState([])
  const [currentAthleteName, setCurrentAthleteName] = useState('')

  // TV Sync
  const [tvModalOpen, setTvModalOpen] = useState(false)
  const [tvCode, setTvCode] = useState('')
  const [tvConnecting, setTvConnecting] = useState(false)
  const [isTvInputFocused, setIsTvInputFocused] = useState(false)
  const [connectedTvCode, setConnectedTvCode] = useState(() => localStorage.getItem('fleofit_tv_code') || null)

  // Voice Notes
  const [voiceNoteUrl, setVoiceNoteUrl] = useState(null)
  const noteRef = useRef(null)

  // Heart Rate (BLE)
  const [heartRate, setHeartRate] = useState(null)
  const [hrConnected, setHrConnected] = useState(false)
  const [isOffline, setIsOffline] = useState(false)

  const [autonomousModalOpen, setAutonomousModalOpen] = useState(false)
  const [autonomousForm, setAutonomousForm] = useState({ title: '', date: format(new Date(), 'yyyy-MM-dd'), notes: '', id: null, awId: null })
  const [savingAutonomous, setSavingAutonomous] = useState(false)

  const [showRpeModal, setShowRpeModal] = useState(false)
  const [rpeScore, setRpeScore] = useState('5')
  const [rpeNotes, setRpeNotes] = useState('')

  // Timer
  const [timerOpen, setTimerOpen] = useState(false)
  const [timerMinimized, setTimerMinimized] = useState(false)
  const [timerSequence, setTimerSequence] = useState([])

  useEffect(() => { fetchWorkout() }, [id, queryAthleteId])

  useEffect(() => {
    const initNetwork = async () => {
      const status = await Network.getStatus()
      setIsOffline(!status.connected)
    }
    initNetwork()
    const listener = Network.addListener('networkStatusChange', status => setIsOffline(!status.connected))
    return () => { listener.then(l => l.remove()) }
  }, [])

  useEffect(() => {
    return BluetoothService.subscribe((connected, hr) => {
      setHrConnected(connected)
      setHeartRate(hr)
    })
  }, [])

  const toggleHeartRate = async () => {
    try {
      if (hrConnected) {
        await BluetoothService.disconnect()
      } else {
        await BluetoothService.connect()
      }
    } catch (error) {
      console.error("BLE Error:", error);
      const msg = error?.message || String(error);
      if (!msg.includes('cancelled') && !msg.includes('User cancelled')) {
        setAlertInfo({ title: 'Errore BLE', message: msg, type: 'error' })
      }
    }
  }

  // Quando entri nel workout, se c'è una notifica pendente ad esso collegata, segnala come letta
  useEffect(() => {
    if (user?.id && id) {
      const routePath = `/workout/${id}?athlete_id=${queryAthleteId || user.id}`;
      const clearNotif = async () => {
        try {
          const { data: notifs } = await supabase.from('notifications')
            .select('id')
            .eq('user_id', user.id)
            .eq('route', routePath)
            .eq('is_read', false);
            
          if (notifs && notifs.length > 0) {
            await supabase.from('notifications').update({ is_read: true }).in('id', notifs.map(n => n.id));
            if (Capacitor.isNativePlatform()) {
              const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_read', false);
              if (count !== null) {
                if (count === 0) await Badge.clear().catch(()=>{});
                else await Badge.set({ count }).catch(()=>{});
                await supabase.from('push_subscriptions').update({ badge_count: count }).eq('user_id', user.id).eq('auth', 'capacitor_ios');
              }
            }
          }
        } catch (e) {}
      };
      clearNotif();
    }
  }, [id, queryAthleteId, user]);

  useEffect(() => {
    if (noteRef.current) {
      noteRef.current.style.height = 'auto'
      noteRef.current.style.height = `${noteRef.current.scrollHeight}px`
    }
  }, [editingNote])

  // Carica la lista atleti solo quando si apre il modal per la prima volta
  useEffect(() => {
    if (assignModalOpen && athletes.length === 0) {
      fetchAthletes()
    }
  }, [assignModalOpen])

  const fetchWorkout = async () => {
    const status = await Network.getStatus()
    let data, awData, allAwData;

    if (status.connected) {
      const wRes = await supabase.from('workouts').select('*').eq('id', id).single()
      data = wRes.data
      if (data) localStorage.setItem(`fleofit_cache_w_${id}`, JSON.stringify(data))

      if (queryAthleteId && data) {
        const awRes = await supabase.from('athlete_workouts')
          .select('id, notes, voice_note_url, status, completed_date, athletes(name, surname)')
          .eq('workout_id', data.id)
          .eq('athlete_id', queryAthleteId)
          .order('completed_date', { ascending: false })
          .limit(1)
        awData = awRes.data
        if (awData) localStorage.setItem(`fleofit_cache_aw_${id}_${queryAthleteId}`, JSON.stringify(awData))
      }
      
      if (role !== 'athlete' && data) {
        const allRes = await supabase.from('athlete_workouts')
          .select('id, completed_date, status, notes, voice_note_url, athletes(id, name, surname, photo_url)')
          .eq('workout_id', data.id)
          .order('completed_date', { ascending: false })
        allAwData = allRes.data
        if (allAwData) localStorage.setItem(`fleofit_cache_all_aw_${id}`, JSON.stringify(allAwData))
      }
    } else {
      data = JSON.parse(localStorage.getItem(`fleofit_cache_w_${id}`) || 'null')
      if (queryAthleteId) {
        awData = JSON.parse(localStorage.getItem(`fleofit_cache_aw_${id}_${queryAthleteId}`) || 'null')
      }
      if (role !== 'athlete') {
        allAwData = JSON.parse(localStorage.getItem(`fleofit_cache_all_aw_${id}`) || 'null')
      }
    }

    let finalWorkout = { ...data }

    if (queryAthleteId && awData && awData.length > 0) {
        setAthleteWorkoutId(awData[0].id)
        setWorkoutStatus(awData[0].status)
        setVoiceNoteUrl(isVoiceNoteValid(awData[0].voice_note_url) ? awData[0].voice_note_url : null)
        setCurrentAthleteName(`${awData[0].athletes?.name || ''} ${awData[0].athletes?.surname || ''}`.trim())
        if (awData[0].notes) {
          const parsed = parseNotesAndRpe(awData[0].notes);
          setAthleteNote({ text: parsed.text, rpe: parsed.rpe, athleteName: `${awData[0].athletes?.name || ''} ${awData[0].athletes?.surname || ''}`.trim() })
          setEditingNote(parsed.text)
          setRpeScore(parsed.rpe)
        } else {
          setAthleteNote(null)
          setEditingNote('')
          setRpeScore('5')
        }
        finalWorkout.date = awData[0].completed_date
    } else if (queryAthleteId && data) {
        setAthleteWorkoutId(null)
        setVoiceNoteUrl(null)
        setWorkoutStatus('pending')
        setAthleteNote(null)
        setEditingNote('')
        setCurrentAthleteName('')
    } else {
      setAthleteWorkoutId(null)
      setVoiceNoteUrl(null)
      setWorkoutStatus('pending')
      setAthleteNote(null)
      setEditingNote('')
      setCurrentAthleteName('')
    }

    if (role !== 'athlete' && allAwData) {
        setAssignments(allAwData.map(aw => ({
          ...aw,
          voice_note_url: isVoiceNoteValid(aw.voice_note_url) ? aw.voice_note_url : null
        })))
    }

    setWorkout(finalWorkout)
    setLoading(false)
  }

  const toggleStatus = async () => {
    if (!athleteWorkoutId) return
    
    if (workoutStatus === 'completed') {
      const newStatus = 'pending'
      setWorkoutStatus(newStatus)
      const { error } = await supabase.from('athlete_workouts').update({ status: newStatus }).eq('id', athleteWorkoutId)
      if (error) {
        setAlertInfo({ title: 'Errore', message: "Impossibile aggiornare lo stato", type: 'error' })
        setWorkoutStatus('completed')
      }
      return
    }

    if (workoutStatus !== 'completed' && workout?.date) {
      const scheduledDate = startOfDay(parseISO(workout.date))
      const today = startOfDay(new Date())
      if (isBefore(today, scheduledDate)) {
        setConfirmInfo({
          title: 'Attenzione',
          message: 'Questo allenamento è programmato per una data futura. Vuoi davvero segnarlo come completato oggi?',
          onConfirm: () => { 
            setConfirmInfo(null);
            setRpeNotes(editingNote);
            setShowRpeModal(true); 
          }
        })
        return
      }
    }
    
    setRpeNotes(editingNote);
    setShowRpeModal(true);
  }

  const handleRpeSubmit = async () => {
    setSavingNote(true)
    const newStatus = 'completed'
    const finalNote = formatNotesWithRpe(rpeScore, rpeNotes)

    const status = await Network.getStatus()
    let hasError = false;
    let errorMessage = '';

    if (!status.connected) {
      const queue = JSON.parse(localStorage.getItem('fleofit_offline_queue') || '[]')
      queue.push({ type: 'UPDATE_WORKOUT', payload: { id: athleteWorkoutId, status: newStatus, notes: finalNote } })
      localStorage.setItem('fleofit_offline_queue', JSON.stringify(queue))
    } else {
      const { error } = await supabase.from('athlete_workouts').update({ status: newStatus, notes: finalNote }).eq('id', athleteWorkoutId)
      if (error) {
        hasError = true;
        errorMessage = error.message;
      }
    }

    setSavingNote(false)

    if (hasError) {
      setAlertInfo({ title: 'Errore', message: "Impossibile salvare: " + errorMessage, type: 'error' })
    } else {
      setWorkoutStatus(newStatus)
      setEditingNote(rpeNotes)
      setAthleteNote({ text: rpeNotes, rpe: rpeScore, athleteName: athleteNote?.athleteName || '' })
      setShowRpeModal(false)

      if (role === 'athlete' && status.connected) {
        supabase.functions.invoke('send-reminders', {
          body: { mode: 'coach_notification', action: 'completed', athleteName: currentAthleteName || user?.user_metadata?.first_name || 'Atleta', workoutTitle: workout.title, route: `/workout/${id}?athlete_id=${queryAthleteId || user.id}` }
        }).catch(console.error)
      }
    }
  }

  const fetchAthletes = async () => {
    const { data } = await supabase.from('athletes').select('id, name, surname, photo_url').is('deleted_at', null).order('name')
    const COACHING_ID = '0118e43f-8791-4fd6-8032-bee028334c99'
    setAthletes((data || []).filter(a => a.id !== COACHING_ID))
  }

  const handleAssignMultiple = async () => {
    if (!assignDate) {
      setAlertInfo({ title: 'Errore', message: 'Inserisci la data di assegnazione.', type: 'error' })
      return
    }
        if (selectedAthletes.length === 0) return

    setAssigning(true)
 const assignmentsToInsert = selectedAthletes.map(ath => ({
      athlete_id: ath.id,
      workout_id: workout.id,
      completed_date: assignDate,
      status: 'pending'
    }))
    const { data: newAssignments, error } = await supabase.from('athlete_workouts').insert(assignmentsToInsert).select('id')

    
    setAssigning(false)
    if (error) {
      setAlertInfo({ title: 'Errore', message: "Errore durante l'assegnazione: " + error.message, type: 'error' })
    } else {
      if (newAssignments && newAssignments.length > 0) {
        newAssignments.forEach(na => {
          supabase.functions.invoke('send-reminders', {
            body: { mode: 'immediate', record_id: na.id }
          }).catch(console.error)
        })
      }
      setAssignModalOpen(false)
            setSelectedAthletes([])
      setAssignStep(1)
      setShowSuccessModal(true)
      fetchWorkout()
    }
  }

  const handleDeleteWorkout = async () => {
    setDeleting(true)
    if (role === 'athlete' && athleteWorkoutId) {
      const { error } = await supabase.from('athlete_workouts').delete().eq('id', athleteWorkoutId)
      setDeleting(false)
      if (error) setAlertInfo({ title: 'Errore', message: error.message, type: 'error' })
      else navigate(-1)
    } else {
      const { error } = await supabase.from('workouts').delete().eq('id', id)
      setDeleting(false)
      if (error) {
        setAlertInfo({ title: 'Errore', message: "Errore durante l'eliminazione: " + error.message, type: 'error' })
      } else {
        navigate(-1)
      }
    }
  }

  const handleRemoveAssignment = (assignmentId) => {
    setConfirmInfo({
      title: 'Rimuovi Assegnazione',
      message: "Sei sicuro di voler rimuovere questo allenamento per l'atleta?",
      onConfirm: async () => {
        setConfirmInfo(null)
        const { error } = await supabase.from('athlete_workouts').delete().eq('id', assignmentId)
        if (error) {
          setAlertInfo({ title: 'Errore', message: error.message, type: 'error' })
        } else {
          if (queryAthleteId && assignmentId === athleteWorkoutId) {
             navigate(`/workout/${id}`)
          } else {
             fetchWorkout()
          }
        }
      }
    })
  }

  const openEditAutonomous = () => {
    setAutonomousForm({
      title: workout.title || '',
      date: workout.date || format(new Date(), 'yyyy-MM-dd'),
      notes: athleteNote?.text || '',
      id: workout.id,
      awId: athleteWorkoutId
    })
    setAutonomousModalOpen(true)
  }

  const handleSaveAutonomous = async () => {
    setSavingAutonomous(true)
    const titoloFinale = titoloOppureGenerato(
      autonomousForm.title,
      autonomousForm.date,
      await titoliDelGiorno(supabase, autonomousForm.date)
    )
    try {
      if (autonomousForm.id) {
        const { error: wError } = await supabase.from('workouts').update({ title: titoloFinale, date: autonomousForm.date }).eq('id', autonomousForm.id)
        if (wError) throw wError

        if (autonomousForm.awId) {
          const { error: awError } = await supabase.from('athlete_workouts').update({ completed_date: autonomousForm.date, notes: autonomousForm.notes }).eq('id', autonomousForm.awId)
          if (awError) throw awError
        }
      }
      setAutonomousModalOpen(false)
      fetchWorkout()
    } catch (err) {
      setAlertInfo({ title: 'Errore', message: err.message, type: 'error' })
    }
    setSavingAutonomous(false)
  }

  const uploadVoiceNote = async (audioBlob, ext) => {
    setSavingNote(true)
    const fileName = `voice_${athleteWorkoutId}_${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage.from('voice-notes').upload(fileName, audioBlob, { contentType: audioBlob.type })
    
    if (uploadError) {
      setAlertInfo({ title: 'Errore', message: 'Caricamento della nota vocale fallito: ' + uploadError.message, type: 'error' })
      setSavingNote(false)
      return
    }
    
    const { data: urlData } = supabase.storage.from('voice-notes').getPublicUrl(fileName)
    const { error } = await supabase.from('athlete_workouts').update({ voice_note_url: urlData.publicUrl }).eq('id', athleteWorkoutId)
    setSavingNote(false)
    
    if (!error) {
      setVoiceNoteUrl(urlData.publicUrl)
      if (role === 'admin') {
        supabase.functions.invoke('send-reminders', {
          body: { mode: 'voice_note', record_id: athleteWorkoutId }
        }).catch(console.error)
      }
    } else {
      setAlertInfo({ title: 'Errore', message: error.message, type: 'error' })
    }
  }

  const deleteVoiceNote = async () => {
    setConfirmInfo({
      title: "Elimina nota vocale",
      message: "La nota verrà nascosta dall'app, ma per sicurezza rimarrà nel database per 24 ore prima di essere eliminata definitivamente.",
      onConfirm: async () => {
        setConfirmInfo(null)
        if (voiceNoteUrl) {
          const deletedUrl = voiceNoteUrl + '#deleted=' + Date.now()
          const { error } = await supabase.from('athlete_workouts').update({ voice_note_url: deletedUrl }).eq('id', athleteWorkoutId)
          if (error) {
            setAlertInfo({ title: 'Errore', message: error.message, type: 'error' })
          } else {
            setVoiceNoteUrl(null)
          }
        }
      }
    })
  }

  const handleConnectTV = async () => {
    if (!tvCode || tvCode.length !== 4) {
      setAlertInfo({ title: 'Errore', message: 'Inserisci un codice valido a 4 cifre', type: 'error' })
      return
    }
    setTvConnecting(true)
    const { data, error: fetchErr } = await supabase.from('tv_sessions').select('*').eq('code', tvCode).single()
    
    if (fetchErr || !data) {
      setTvConnecting(false)
      setAlertInfo({ title: 'Errore', message: 'Codice TV non trovato o scaduto.', type: 'error' })
      return
    }

    const { error } = await supabase.from('tv_sessions').update({ 
      workout_id: id, 
      athlete_id: queryAthleteId || user?.id,
      updated_at: new Date().toISOString()
    }).eq('code', tvCode)

    setTvConnecting(false)
    if (error) {
      setAlertInfo({ title: 'Errore', message: error.message, type: 'error' })
    } else {
      setConnectedTvCode(tvCode)
      localStorage.setItem('fleofit_tv_code', tvCode)
      setTvModalOpen(false)
      setTvCode('')
      setAlertInfo({ title: 'Connesso!', message: 'Il workout è ora visibile sulla tua TV.', type: 'success' })
    }
  }

  const handleDisconnectTV = async () => {
    if (!connectedTvCode) return
    setTvConnecting(true)
    const { error } = await supabase.from('tv_sessions').update({ 
      workout_id: null, 
      athlete_id: null,
      updated_at: new Date().toISOString()
    }).eq('code', connectedTvCode)
    
    setTvConnecting(false)
    if (error) {
      setAlertInfo({ title: 'Errore', message: error.message, type: 'error' })
    } else {
      setConnectedTvCode(null)
      localStorage.removeItem('fleofit_tv_code')
      setAlertInfo({ title: 'Scollegato', message: 'La TV è tornata alla schermata iniziale.', type: 'success' })
      setTimerOpen(false)
      setTimerMinimized(false)
    }
  }

  const buildPDFDoc = async () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const s = workout.sections
    const rawCat = s?.category || (s?.main?.type === 'Running' || s?.steps ? 'Running' : 'Hyrox')
    const category = (rawCat === 'Autonomo' || rawCat === 'Custom') ? 'Custom' : (rawCat === 'Event' ? 'Event' : rawCat)
    const isRunning = category === 'Running'
    const type = category === 'Custom' ? 'Custom' : (category === 'Event' ? 'Event' : (isRunning ? 'Running' : 'Hyrox'))
    let y = 20

    // Header
    doc.setFillColor(23, 23, 23)
    doc.rect(0, 0, 210, 297, 'F')
    
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(255, 255, 255)
    doc.text('FLEO', 20, y)
    const fleoWidth = doc.getTextWidth('FLEO')
    doc.setTextColor(241, 186, 23)
    doc.text('FIT', 20 + fleoWidth, y)
    
    const fitWidth = doc.getTextWidth('FIT')
    doc.setTextColor(150, 150, 150)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'normal')
    doc.text(' - Coach Federico Leo', 20 + fleoWidth + fitWidth, y)

    y += 8
    doc.setTextColor(200, 200, 200)
    doc.setFontSize(14)
    doc.text(workout.title, 20, y)
    y += 6
    doc.setFontSize(10)
    doc.setTextColor(120, 120, 120)
    doc.text(workout.date && isValid(parseISO(workout.date)) ? format(parseISO(workout.date), 'EEEE d MMMM yyyy', { locale: it }) : 'Data sconosciuta', 20, y)
    y += 10

    // Tipo badge
    doc.setFontSize(11)
    if (type === 'Running') {
      doc.setTextColor(0, 148, 198)
    } else if (type === 'Custom') {
      doc.setTextColor(209, 17, 73)
    } else if (type === 'Event') {
      doc.setTextColor(255, 255, 255)
    } else {
      doc.setTextColor(241, 186, 23)
    }
    doc.setFont('helvetica', 'bold')
    doc.text(`[ ${type.toUpperCase()} ]`, 20, y)
    
    y += 6

    if (s?.intensity) {
      if (type === 'Running') {
        doc.setTextColor(0, 148, 198)
      } else if (type === 'Custom') {
        doc.setTextColor(209, 17, 73)
      } else if (type === 'Event') {
        doc.setTextColor(255, 255, 255)
      } else {
        doc.setTextColor(241, 186, 23)
      }
      doc.setFont('helvetica', 'bold')
      doc.text('INTENSITA\': ', 20, y)
      doc.setTextColor(...getPdfIntensityColor(s.intensity))
      doc.setFont('helvetica', 'normal')
      const intTxt = `${s.intensity} / 10 `
      doc.text(intTxt, 45, y)
      doc.addImage(getEmojiDataURL('💪'), 'PNG', 45 + doc.getTextWidth(intTxt), y - 3.2, 4, 4)
      y += 6
    }
    
    y += 2

    // Divider
    doc.setDrawColor(60, 60, 60)
    doc.line(20, y, 190, y)
    y += 8

    
    if (type === 'Custom') {
      doc.setTextColor(200, 200, 200)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      const textToPrint = workout.coach_notes || athleteNote?.text || 'Allenamento Custom'
      const lines = doc.splitTextToSize(textToPrint, 170)
      doc.text(lines, 20, y)
      y += lines.length * 5 + 6
    } else if (type === 'Running') {
           doc.setTextColor(150, 150, 150)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.text('ALLENAMENTO CORSA', 20, y)
      y += 6
      
      const steps = s?.steps || s?.main?.steps || []
      steps.forEach((step, i) => {
        doc.setTextColor(180, 180, 180)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        
        const typeLabels = { warmup: 'Riscaldamento', run: 'Corsa', recover: 'Recupero', cooldown: 'Defaticamento', repeat: 'Ripetute' }
        doc.text(`· ${typeLabels[step.type] || ''}${step.type === 'repeat' ? ` x${step.rounds}` : ''}`, 25, y)
        y += 5
        
        doc.setFont('helvetica', 'normal')
        if (step.type === 'repeat') {
           doc.setTextColor(200, 200, 200)
           let cx = 30
           let r1 = `  Corsa: ${step.runDuration} ${step.runPace ? '@'+step.runPace : ''}`
           doc.text(r1, cx, y)
           cx += doc.getTextWidth(r1)
           if (step.runIntensity) {
             let itxt = `   [Int: ${step.runIntensity}/10 `
             doc.setTextColor(...getPdfIntensityColor(step.runIntensity))
             doc.text(itxt, cx, y)
             cx += doc.getTextWidth(itxt)
             doc.addImage(getEmojiDataURL('💪'), 'PNG', cx, y - 3.2, 4, 4)
             cx += 4.5
             doc.text(']', cx, y)
             doc.setTextColor(200, 200, 200)
           }
           y += 5
           
           cx = 30
           let r2 = `  Recupero: ${step.recDuration} ${step.recPace ? '@'+step.recPace : ''}`
           doc.text(r2, cx, y)
           cx += doc.getTextWidth(r2)
           if (step.recIntensity) {
             let itxt = `   [Int: ${step.recIntensity}/10 `
             doc.setTextColor(...getPdfIntensityColor(step.recIntensity))
             doc.text(itxt, cx, y)
             cx += doc.getTextWidth(itxt)
             doc.addImage(getEmojiDataURL('💪'), 'PNG', cx, y - 3.2, 4, 4)
             cx += 4.5
             doc.text(']', cx, y)
             doc.setTextColor(200, 200, 200)
           }
           y += 5

           if (step.notes) {
             doc.setTextColor(180, 180, 180)
             doc.setFont('helvetica', 'normal')
             doc.setFontSize(9)
             doc.text(`  Note: ${step.notes}`, 30, y)
             y += 5
           }
        } else {
           doc.setTextColor(200, 200, 200)
           let cx = 30
           let r1 = `  ${step.duration || ''} ${step.pace ? '@'+step.pace : ''}`
           doc.text(r1, cx, y)
           cx += doc.getTextWidth(r1)
           
           if (step.intensity) {
             let itxt = `   [Int: ${step.intensity}/10 `
             doc.setTextColor(...getPdfIntensityColor(step.intensity))
             doc.text(itxt, cx, y)
             cx += doc.getTextWidth(itxt)
             doc.addImage(getEmojiDataURL('💪'), 'PNG', cx, y - 3.2, 4, 4)
             cx += 4.5
             doc.text(']', cx, y)
             cx += doc.getTextWidth(']')
             doc.setTextColor(200, 200, 200)
           }
           if (step.notes) {
             doc.text(`  (${step.notes})`, cx, y)
           }
           y += 5
        }
        y += 2
        if (y > 260) { doc.addPage(); y = 20 }
      })
    } else {
      const blocks = getNormalizedBlocks(workout)
      blocks.forEach(block => {
        doc.setTextColor(150, 150, 150)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(11)
        const blkHint = blockHint(block.type)
        doc.text(blkHint ? `${getBlockTitle(block)}  (${blkHint})` : getBlockTitle(block), 20, y)
        y += 6

        if (['WarmUp', 'Rest'].includes(block.type)) {
           doc.setTextColor(120, 120, 120)
           doc.setFont('helvetica', 'normal')
           doc.setFontSize(10)
           doc.text(`  ${block.params?.duration || ''}${block.notes ? ' · ' + block.notes : ''}`, 20, y)
           y += 8
        } else {
           (block.exercises || []).forEach((ex, i) => {
             doc.setTextColor(200, 200, 200)
             doc.setFont('helvetica', 'normal')
             doc.setFontSize(10)
             const prefix = (block.type === 'EMOM' || block.type === 'ON/OFF') ? `Min.${i + 1}  ` : `· `
             const detail = ex.exTime && ex.exTime !== '-' ? ex.exTime : ((ex.meters && ex.meters !== '-') ? ex.meters : (ex.reps && ex.reps !== '-' ? `${ex.reps} reps` : ''))
             const paceStr = isErgo(ex.name) && ex.ergoPace && ex.ergoPace !== '-' && ex.ergoPace !== 'Libero' ? ` @ ${ex.ergoPace}` : ''
             const kgStr = ex.kg ? ` @ ${ex.kg}kg` : ''
             
             let cx = 25
             let baseStr = `${prefix}${ex.name}  ${detail}${paceStr}${kgStr}`
             doc.text(baseStr, cx, y)
             cx += doc.getTextWidth(baseStr)

             if (ex.intensity) {
               let itxt = `   [Int: ${ex.intensity}/10 `
               doc.setTextColor(...getPdfIntensityColor(ex.intensity))
               doc.text(itxt, cx, y)
               cx += doc.getTextWidth(itxt)
               doc.addImage(getEmojiDataURL('💪'), 'PNG', cx, y - 3.2, 4, 4)
               cx += 4.5
               doc.text(']', cx, y)
               cx += doc.getTextWidth(']')
               doc.setTextColor(200, 200, 200)
             }
             if (ex.notes) {
               doc.text(`  (${ex.notes})`, cx, y)
             }
             y += 6
             if (y > 260) { doc.addPage(); y = 20 }
           })
           y += 2
        }
      })
    }

    // Note coach
    if (workout.coach_notes) {
      doc.setDrawColor(60, 60, 60)
      doc.line(20, y, 190, y)
      y += 6
      doc.setTextColor(241, 186, 23)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.text('NOTE COACH', 20, y)
      y += 6
      doc.setTextColor(200, 200, 200)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      const lines = doc.splitTextToSize(workout.coach_notes, 165)
      doc.text(lines, 20, y)
      y += lines.length * 5 + 6
    }

    // Glossario fisso in fondo
    const glossaryY = 240
    doc.setDrawColor(60, 60, 60)
    doc.line(20, glossaryY, 190, glossaryY)
    doc.setTextColor(100, 100, 100)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text('GLOSSARIO', 20, glossaryY + 6)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text('EMOM (Every Minute On the Minute): All\'inizio di ogni minuto devi eseguire le ripetizioni indicate. Il tempo che ti avanza prima dello scoccare del minuto successivo è il tuo recupero.', 20, glossaryY + 12, { maxWidth: 170 })
    doc.text('AMRAP (As Many Rounds/Reps As Possible): Esegui il maggior numero di giri (o ripetizioni) possibili del circuito nel tempo prestabilito. L\'obiettivo è mantenere un ritmo costante.', 20, glossaryY + 18, { maxWidth: 170 })
    doc.text('ON / OFF (Lavoro / Recupero): Allenamento a intervalli. Indica i secondi di lavoro attivo seguiti da quelli di riposo. Esempio: "40 ON / 20 OFF" significa che devi eseguire l\'esercizio per 40 sec e riposare per 20.', 20, glossaryY + 24, { maxWidth: 170 })
    doc.text('FOR TIME: Completa tutto il circuito o l\'allenamento prescritto nel minor tempo possibile. Il cronometro è il tuo avversario, ma ricordati di mantenere sempre un\'esecuzione tecnica corretta!', 20, glossaryY + 32, { maxWidth: 170 })
  
    return doc
  }

  const exportPDF = async () => {
    const doc = await buildPDFDoc()
    const fileName = `${workout.title.replace(/ /g, '_')}.pdf`
    
    if (Capacitor.isNativePlatform()) {
      try {
        const dataUri = doc.output('datauristring')
        const base64Data = dataUri.split(',')[1]
        const result = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Cache
        })
        await Share.share({ title: workout.title, url: result.uri })
      } catch (e) {
        console.error("Errore esportazione PDF", e)
      }
    } else {
      doc.save(fileName)
    }
  }

  const exportShare2 = async () => {
    if (!igRef.current) return
    try {
      const fileName = `${workout.title.replace(/ /g, '_')}_IG.png`
      if (Capacitor.isNativePlatform()) {
        const dataUrl = await toPng(igRef.current, { pixelRatio: 2, cacheBust: true })
        const base64Data = dataUrl.split(',')[1]
        const result = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Cache
        })
        
        try {
          await Media.savePhoto({ path: result.uri })
          setAlertInfo({ title: 'Salvato!', message: 'La grafica IG è stata salvata direttamente nella tua galleria fotografica.', type: 'success' })
        } catch (mediaErr) {
          setAlertInfo({ title: 'Errore', message: 'Permesso negato o errore durante il salvataggio in galleria.', type: 'error' })
        }
      } else {
        const blob = await toBlob(igRef.current, { pixelRatio: 2, cacheBust: true })
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = fileName;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error(err)
      setAlertInfo({ title: 'Errore', message: 'Impossibile generare la grafica.', type: 'error' })
    }
  }

  const shareWorkoutFiles = async () => {
    if (!igRef.current) return
    try {
      const safeTitle = workout.title.replace(/ /g, '_')
      const isEventWorkout = workout?.sections?.category === 'Event' || workout?.sections?.isEvent

      if (Capacitor.isNativePlatform()) {
        const filesArray = []
        
        if (!isEventWorkout) {
          const doc = await buildPDFDoc()
          const pdfDataUri = doc.output('datauristring')
          const pdfResult = await Filesystem.writeFile({
            path: `${safeTitle}.pdf`,
            data: pdfDataUri.split(',')[1],
            directory: Directory.Cache
          })
          filesArray.push(pdfResult.uri)
        }

        const pngDataUrl = await toPng(igRef.current, { pixelRatio: 3, cacheBust: true })
        const pngResult = await Filesystem.writeFile({
          path: `${safeTitle}.png`,
          data: pngDataUrl.split(',')[1],
          directory: Directory.Cache
        })
        filesArray.push(pngResult.uri)

        await Share.share({
          title: workout.title,
          text: `Ecco il tuo workout: ${workout.title}`,
          files: filesArray
        })
      } else {
        const filesArray = []
        if (!isEventWorkout) {
          const doc = await buildPDFDoc()
          const pdfBlob = doc.output('blob')
          filesArray.push(new File([pdfBlob], `${safeTitle}.pdf`, { type: 'application/pdf' }))
        }

        const blob = await toBlob(igRef.current, { pixelRatio: 3, cacheBust: true })
        filesArray.push(new File([blob], `${safeTitle}.png`, { type: 'image/png' }))

        if (navigator.canShare && navigator.canShare({ files: filesArray })) {
          await navigator.share({
            files: filesArray,
            title: workout.title,
            text: `Ecco il tuo workout: ${workout.title}`
          })
        } else {
          setAlertInfo({ title: 'Non supportato', message: 'Il tuo dispositivo o browser non supporta la condivisione diretta di più file. Usa i tasti di esportazione classici.', type: 'error' })
        }
      }
    } catch (error) {
      console.error('Errore durante la condivisione:', error)
    }
  }

  if (loading) return <div className="p-6 text-gray-500">Caricamento...</div>
  if (!workout) return <div className="p-6 text-red-400">Workout non trovato</div>

  const s = workout.sections || {}
  const rawCat = s?.category || (s?.main?.type === 'Running' || s?.steps ? 'Running' : 'Hyrox')
  const isAuto = s?.isAutonomous === true || rawCat === 'Autonomo'
  const isEvent = rawCat === 'Event' || s?.isEvent === true
  const isCustom = rawCat === 'Custom' || isAuto
  const category = isEvent ? 'Event' : (isCustom ? 'Custom' : rawCat)
  const isRunning = category === 'Running'
  const blocks = getNormalizedBlocks(workout)
  const mainBlock = blocks.find(b => ['EMOM', 'ON/OFF', 'AMRAP', 'For Time'].includes(b.type)) || blocks[0] || { type: 'Hyrox' }
  const type = isEvent ? 'Event' : (isCustom ? 'Custom' : (isRunning ? 'Running' : mainBlock.type))
  const c = TYPE_COLORS[type] || TYPE_COLORS['Hyrox'] || { text: 'text-gray-200', bg: 'bg-[#222]', border: 'border-[#333]', hex: '#e5e5e5' }

  const getIconForType = (t) => {
    if (t === 'WarmUp' || t === 'Rest') return <Timer size={16} className={TYPE_COLORS[t]?.text} />
    if (t === 'Cash In') return <Flag size={16} className={TYPE_COLORS[t]?.text} />
    if (t === 'Cash Out') return <FlagOff size={16} className={TYPE_COLORS[t]?.text} />
    return <Dumbbell size={16} className={TYPE_COLORS[t]?.text} />
  }

  return (
    <div className="px-4 max-w-2xl mx-auto pb-[calc(6rem+env(safe-area-inset-bottom))] pt-[calc(env(safe-area-inset-top)+1rem)] page-transition">
      <div className="mb-6 mt-4 flex items-center gap-3">
        <button aria-label="Torna indietro" onClick={() => navigate(-1)} className="w-10 h-10 bg-[#1e1e1e] border border-[#333] rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:border-[#f1ba17] transition shadow-sm shrink-0">
          <ChevronLeft size={22} className="-ml-0.5" />
        </button>
        <h1 className="text-3xl font-black text-white tracking-tight">FLEO<span className="text-[#f1ba17]">FIT</span></h1>
      </div>

      {/* OFFLINE BANNER */}
      {isOffline && (
        <div className="mb-4 bg-orange-500/10 border border-orange-500/30 rounded-2xl p-4 flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-3">
            <WifiOff size={24} className="text-orange-500" />
            <div>
              <p className="text-orange-500 text-xs font-bold uppercase tracking-wider">Modalità Offline</p>
              <p className="text-orange-500/80 text-[11px] font-medium leading-tight">Puoi allenarti e salvare. Sincronizzeremo tutto appena torna la linea.</p>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="mb-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold text-white break-words">{workout.title}</h1>
              <p className="text-gray-500 text-sm mt-1 capitalize truncate">
                {workout.date && isValid(parseISO(workout.date)) ? format(parseISO(workout.date), 'EEEE d MMMM yyyy', { locale: it }) : 'Data sconosciuta'}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
              {workout.sections?.intensity && (
                <div className="flex items-center gap-1 bg-[#2a2a2a] border border-[#383838] px-2 py-1.5 rounded-lg shrink-0">
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
          <div className="flex flex-wrap items-center gap-2">
            {connectedTvCode ? (
              <button onClick={handleDisconnectTV} disabled={tvConnecting} className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1.5 transition bg-[#2a2a2a] border border-red-900/50 px-3 py-2 rounded-xl" title="Scollega TV">
                <MonitorUp size={14} /> Scollega
              </button>
            ) : (
              <button onClick={() => setTvModalOpen(true)} className="text-gray-400 hover:text-[#f1ba17] text-xs flex items-center gap-1.5 transition bg-[#2a2a2a] border border-[#383838] px-3 py-2 rounded-xl" title="Trasmetti alla TV">
                <MonitorUp size={14} /> TV
              </button>
            )}
            {(role === 'athlete' || isOwnProfile) && (
              <button onClick={toggleHeartRate} className={`text-xs flex items-center gap-1.5 transition border px-3 py-2 rounded-xl ${hrConnected ? 'bg-red-500/20 border-red-500/50 text-red-500' : 'bg-[#2a2a2a] border-[#383838] text-gray-400 hover:text-red-400'}`} title="Connetti Fascia Cardio">
                <Heart size={14} className={hrConnected && heartRate ? 'animate-pulse' : ''} /> {hrConnected ? (heartRate ? `${heartRate} bpm` : 'Connesso') : 'Cardio'}
              </button>
            )}
            {role !== 'athlete' && (
              <button onClick={() => navigate(`/create?duplicate=${id}`)} className="text-gray-400 hover:text-white text-xs flex items-center gap-1.5 transition bg-[#2a2a2a] border border-[#383838] px-3 py-2 rounded-xl" title="Duplica Workout">
                <Copy size={14} /> Duplica
              </button>
            )}
            {role !== 'athlete' && !isAuto && (
              <button onClick={() => navigate(`/create?edit=${id}${athleteWorkoutId ? `&aw_id=${athleteWorkoutId}` : ''}${queryAthleteId ? `&athlete_id=${queryAthleteId}` : ''}`)} className="text-gray-400 hover:text-white text-xs flex items-center gap-1.5 transition bg-[#2a2a2a] border border-[#383838] px-3 py-2 rounded-xl">
                <Edit size={14} /> Modifica
              </button>
            )}
            {isAuto && (
              <button onClick={openEditAutonomous} className="text-gray-400 hover:text-[#f1ba17] text-xs flex items-center gap-1.5 transition bg-[#2a2a2a] border border-[#383838] px-3 py-2 rounded-xl">
                <Edit size={14} /> Modifica
              </button>
            )}
            {(role !== 'athlete' || isAuto) && (
              <button aria-label="Elimina il workout" onClick={() => setShowDeleteConfirm(true)} className="text-gray-400 hover:text-red-400 text-xs flex items-center gap-1.5 transition bg-[#2a2a2a] border border-[#383838] px-3 py-2 rounded-xl" title="Elimina">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
        {(role === 'athlete' || isOwnProfile) && athleteWorkoutId && (
      
          <button
            onClick={toggleStatus}
            className={`w-full mt-5 py-3.5 rounded-2xl flex items-center justify-center gap-2 text-base font-bold transition border shadow-lg ${
              workoutStatus === 'completed' 
                ? 'bg-green-500 text-black border-green-500 hover:brightness-110 shadow-green-500/20' 
                : 'bg-[#2a2a2a] border-[#383838] text-white hover:border-[#f1ba17] hover:text-[#f1ba17]'
            }`}
          >
            {workoutStatus === 'completed' ? <CheckCircle2 size={20} /> : <Circle size={20} />} 
            {workoutStatus === 'completed' ? 'Allenamento Completato!' : 'Segna come completato'}
          </button>
        )}
      </div>

      {/* TIMER BUTTON SPOSTATO IN CIMA */}
      {type !== 'Event' && (
        <div className="mb-8">
          <button onClick={() => { 
          if (timerOpen && !timerMinimized) {
                setTimerMinimized(true);
              } else if (timerOpen && timerMinimized) {                setTimerMinimized(false);
              } else {
                setTimerSequence(buildTimerSequence(workout)); 
                setTimerOpen(true); 
                setTimerMinimized(false);
              }
            }}
            className={`w-full flex items-center justify-center gap-2 font-black py-4 rounded-3xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl text-lg uppercase tracking-wide ${
              timerOpen && !timerMinimized 
                ? 'bg-gradient-to-r from-gray-600 to-gray-500 text-white shadow-gray-500/20' 
                : connectedTvCode 
                  ? 'bg-gradient-to-r from-blue-500 to-cyan-400 text-white shadow-blue-500/20' 
                  : type === 'Custom' 
                    ? 'bg-gradient-to-r from-[#D11149] to-red-600 text-white shadow-[#D11149]/20' 
                    : type === 'Running' 
                      ? 'bg-gradient-to-r from-[#0094C6] to-cyan-500 text-white shadow-[#0094C6]/20' 
                      : 'bg-gradient-to-r from-[#f1ba17] to-yellow-500 text-black shadow-[#f1ba17]/20'
            }`}>
            {timerOpen && !timerMinimized ? (
              <><ChevronDown size={24} className="stroke-[2.5]" /> Minimizza {connectedTvCode ? 'Telecomando' : 'Timer'}</>
            ) : timerOpen && timerMinimized ? (
              <><ChevronUp size={24} className="stroke-[2.5]" /> Apri {connectedTvCode ? 'Telecomando' : 'Timer'}</>
            ) : connectedTvCode ? (
              <><MonitorUp size={24} className="stroke-[2.5]" /> Avvia Telecomando TV</>
            ) : (
              <><Timer size={24} className="stroke-[2.5]" /> Avvia Allenamento</>
            )}
          </button>
        </div>
      )}

      {/* AVVISO SICUREZZA E RISCALDAMENTO AUTOMATICO */}
      {type !== 'Event' && type !== 'Custom' && (
        <div className="mb-4 bg-orange-500/10 border border-orange-500/30 rounded-2xl p-4 flex items-start gap-3 animate-in fade-in duration-500">
          <div className="text-orange-400 mt-0.5"><Activity size={20} /></div>
          <div>
            <h3 className="text-orange-400 font-bold text-sm mb-1">Prima di iniziare</h3>
            <p className="text-gray-300 text-xs leading-relaxed">
              Esegui sempre 5-10 minuti di mobilità articolare. Approccia l'allenamento in modo graduale per preparare il corpo allo sforzo e prevenire infortuni. Non partire mai a freddo!
            </p>
          </div>
        </div>
      )}

      {/* BLOCKS */}
      {!isRunning && type !== 'Custom' && type !== 'Event' ? (
        blocks.map((block, idx) => (
          <Section key={block.id || idx} icon={getIconForType(block.type)} label={getBlockTitle(block)} hint={blockHint(block.type)} color={TYPE_COLORS[block.type]?.border}>
             {['WarmUp', 'Rest'].includes(block.type) ? (
               <p className="text-gray-300 text-sm">{block.params?.duration} {block.notes ? ` · ${block.notes}` : ''}</p>
             ) : (
               <ExList exercises={block.exercises || []} showMinute={block.type === 'EMOM' || block.type === 'ON/OFF'} typeColor={TYPE_COLORS[block.type]?.text} />
             )}
          </Section>
        ))
      ) : type === 'Event' ? (
         <div className="bg-gradient-to-r from-[#2a2a2a] to-[#111] border border-[#f1ba17]/30 rounded-3xl p-8 text-center mb-6 shadow-lg shadow-[#f1ba17]/5">
           <div className="w-20 h-20 bg-gradient-to-br from-[#f1ba17] to-yellow-600 text-black rounded-full flex items-center justify-center mx-auto mb-4 shadow-xl">
             <CalendarDays size={36} />
           </div>
           <h2 className="text-2xl font-black text-white mb-2 tracking-tight">Evento / Gara</h2>
           <p className="text-[#f1ba17] font-medium text-sm">Questo è il giorno dedicato al tuo obiettivo.</p>
           <p className="text-gray-400 text-sm mt-1">Vai e spacca tutto! 🚀</p>
         </div>
      ) : type === 'Custom' ? (
         <Section icon={<Dumbbell size={16} className={c.text} />} label="Allenamento Custom" color={c.border}>
           <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{workout.coach_notes || athleteNote?.text || 'Dettagli non specificati.'}</p>
         </Section>
      ) : isRunning ? (
         <Section icon={<Timer size={16} className={c.text} />} label="Allenamento Corsa" color={c.border}>
           <RunningList steps={s?.steps || s?.main?.steps || []} />
         </Section>
      ) : null}

      {/* NOTE COACH */}
      {type !== 'Custom' && workout.coach_notes && (
        <Section icon={<span className="text-[#f1ba17] text-sm">📋</span>} label="Note Coach" color="border-[#f1ba17]/40">
          <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{workout.coach_notes}</p>
        </Section>
      )}

      {/* NOTE VOCALE COACH */}
      {athleteWorkoutId && (role === 'admin' || voiceNoteUrl) && (
        <Section icon={<Mic size={16} className="text-[#f1ba17]" />} label={voiceNoteUrl ? `Messaggio dal Coach a ${currentAthleteName || 'Atleta'}` : `Invia vocale a ${currentAthleteName || 'Atleta'}`} color="border-[#f1ba17]/40">
           {voiceNoteUrl ? (
             <CustomAudioPlayer src={voiceNoteUrl} onDelete={deleteVoiceNote} role={role} />
           ) : role === 'admin' ? (
             <VoiceRecorder onSave={uploadVoiceNote} />
           ) : null}
        </Section>
      )}

      {/* NOTE ATLETA */}
      {(role === 'athlete' || isOwnProfile) && athleteWorkoutId ? (
        <Section icon={<User size={16} className="text-[#3b82f6]" />} label={`Le tue note su questo ${type === 'Event' ? 'evento' : 'allenamento'}`} color="border-[#3b82f6]/40">
          <textarea
            ref={noteRef}
            className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-gray-500 focus:outline-none resize-none text-base transition-all duration-200 overflow-hidden focus:border-[#3b82f6]"
            rows={3}
            placeholder="Com'è andata? Segna qui i tuoi pesi, i tempi o come ti sei sentito..."
            value={editingNote}
            onChange={(e) => setEditingNote(e.target.value)}
          />
          <div className={`transition-all duration-300 ease-out overflow-hidden ${editingNote !== (athleteNote?.text || '') ? 'max-h-16 opacity-100 mt-2' : 'max-h-0 opacity-0 mt-0'}`}>
            <div className="flex justify-end">
              <button
                onClick={async () => {
                  setSavingNote(true)
                  const finalNote = formatNotesWithRpe(rpeScore, editingNote)
                  
                  const status = await Network.getStatus()
                  let success = true;
                  
                  if (!status.connected) {
                    const queue = JSON.parse(localStorage.getItem('fleofit_offline_queue') || '[]')
                    queue.push({ type: 'UPDATE_WORKOUT', payload: { id: athleteWorkoutId, status: workoutStatus, notes: finalNote } })
                    localStorage.setItem('fleofit_offline_queue', JSON.stringify(queue))
                  } else {
                    const { error } = await supabase.from('athlete_workouts').update({ notes: finalNote }).eq('id', athleteWorkoutId)
                    if (error) { success = false; setAlertInfo({ title: 'Errore', message: error.message, type: 'error' }) }
                  }
                  
                  setSavingNote(false)
                  if (success) {
                     setAthleteNote({ text: editingNote, rpe: rpeScore, athleteName: athleteNote?.athleteName || '' })
                 if (role === 'athlete' && status.connected) {
                   supabase.functions.invoke('send-reminders', {
                     body: { mode: 'coach_notification', action: 'note', athleteName: athleteNote?.athleteName || user?.user_metadata?.first_name || user?.user_metadata?.full_name || user?.email || 'Un atleta', workoutTitle: workout.title, noteText: editingNote, route: `/workout/${id}?athlete_id=${queryAthleteId || user.id}` }
                   }).catch(console.error)
                 }
                  }
                }}
                disabled={savingNote}
                className="font-bold px-4 py-1.5 rounded-xl text-sm hover:brightness-110 transition disabled:opacity-50 bg-[#3b82f6] text-white"
              >
                {savingNote ? 'Salvataggio...' : 'Conferma note'}
              </button>
            </div>
          </div>
        </Section>
      ) : athleteNote ? (
        <Section icon={<User size={16} className="text-[#3b82f6]" />} label={`Note Atleta (${athleteNote.athleteName})`} color="border-[#3b82f6]/40">
          {athleteNote.rpe && athleteNote.rpe !== '5' && (
            <div className="mb-2 inline-flex items-center gap-1.5 bg-[#111] px-2 py-1 rounded border border-[#333]">
              <span className="text-gray-500 text-[11px] font-bold uppercase tracking-wider">Sforzo percepito:</span>
              <span className={`text-xs font-bold ${getRpeColorText(parseInt(athleteNote.rpe))}`}>{athleteNote.rpe}/10</span>
            </div>
          )}
          <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{athleteNote.text}</p>
        </Section>
      ) : null}

      {/* ASSEGNAZIONI ATLETI (SOLO COACH) */}
      {role !== 'athlete' && assignments.length > 0 && (
        <div className="mb-6 mt-2">
          <h2 className="text-white font-bold text-lg mb-3 flex items-center gap-2">
            <Users size={20} className="text-[#f1ba17]" />
            Assegnato a {assignments.length} atleti
          </h2>
          <div className="flex flex-col gap-3">
            {assignments.map(a => {
              const isSelected = queryAthleteId === a.athletes?.id;
              return (
              <div key={a.id} onClick={() => navigate(`/workout/${id}?athlete_id=${a.athletes?.id}`)} className={`bg-[#1e1e1e] border ${isSelected ? 'border-[#f1ba17]' : 'border-[#2a2a2a] hover:border-[#f1ba17]/50'} rounded-2xl p-4 cursor-pointer transition`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-10 h-10 rounded-full bg-[#2a2a2a] flex items-center justify-center overflow-hidden shrink-0 border border-[#333] hover:border-[#f1ba17] transition"
                      title="Vai al profilo dell'atleta"
                      onClick={(e) => { e.stopPropagation(); navigate(`/athletes/${a.athletes?.id}`); }}
                    >
                      {a.athletes?.photo_url ? (
                        <img src={a.athletes.photo_url} alt={a.athletes?.name} className="w-full h-full object-cover" onError={(e) => e.target.style.opacity = 0} />
                      ) : (
                        <User size={18} className="text-gray-500" />
                      )}
                    </div>
                    <div>
                      <p className={`font-semibold text-sm transition ${isSelected ? 'text-[#f1ba17]' : 'text-white'}`}>{a.athletes?.name} {a.athletes?.surname}</p>
                      <p className="text-gray-500 text-xs capitalize">{format(parseISO(a.completed_date), 'EEEE d MMMM yyyy', { locale: it })}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className={`px-2 py-1 rounded-md border text-xs font-bold ${a.status === 'completed' ? 'bg-green-500/10 text-green-500 border-green-500/30' : 'bg-[#111] text-gray-500 border-[#333]'}`}>
                      {a.status === 'completed' ? 'Fatto' : 'Da fare'}
                    </div>
                    {role === 'admin' && (
                      <button aria-label="Rimuovi l'assegnazione" 
                        onClick={(e) => { e.stopPropagation(); handleRemoveAssignment(a.id); }}
                        className="p-1.5 text-gray-500 hover:text-red-500 transition rounded-lg hover:bg-[#111]"
                        title="Rimuovi assegnazione"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )})}
          </div>
        </div>
      )}

      {/* EXPORT BUTTONS */}
      <div className="flex flex-col sm:flex-row gap-3 mt-6">
        {type !== 'Event' && (
          <button onClick={exportPDF}
            className="flex-1 flex items-center justify-center gap-2 bg-[#222] border border-[#333] text-white font-semibold py-4 rounded-2xl hover:border-[#f1ba17] hover:text-[#f1ba17] transition">
            <Download size={18} /> Esporta PDF
          </button>
        )}
        <button onClick={exportShare2}
          className="flex-1 flex items-center justify-center gap-2 bg-[#222] border border-[#333] text-white font-semibold py-4 rounded-2xl hover:border-pink-500 hover:text-pink-400 transition">
          <Download size={18} /> Salva Grafica IG
        </button>
      </div>

      <div className="mt-3">
        <button onClick={shareWorkoutFiles}
          className="w-full flex items-center justify-center gap-2 bg-[#25D366]/10 border border-[#25D366]/30 text-[#25D366] font-semibold py-4 rounded-2xl hover:bg-[#25D366]/20 transition">
          <Send size={18} /> Condividi {type !== 'Event' ? '(PDF + Social)' : 'Grafica'}
        </button>
      </div>

      {role !== 'athlete' && (
        <div className="mt-3">
          <button onClick={() => { setAssignModalOpen(true); setSelectedAthletes([]); setAssignStep(1); }}
            className="w-full flex items-center justify-center gap-2 bg-[#2a2a2a] border border-[#383838] text-white font-semibold py-4 rounded-2xl hover:border-[#f1ba17] hover:text-[#f1ba17] transition">
            <Users size={18} /> Assegna ad Atleta
          </button>
        </div>
      )}

      {/* Share2 CARD (nascosta, usata per screenshot) */}
      <div className="mt-12">
        <p className="text-gray-400 text-xs mb-4 font-medium text-center uppercase tracking-wider">Anteprima Sticker per Instagram</p>
        <div className="flex justify-center pb-8">
          <div ref={igRef} style={{
            width: '420px',
            background: 'linear-gradient(145deg, #0B0B0B 0%, #171717 100%)',
            borderRadius: '32px',
            fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
            overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.05)',
            boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
            padding: '32px'
          }}>

            {/* HEADER: FLEOFIT LOGO & DATE */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div>
                <div style={{ fontSize: '32px', fontWeight: 900, letterSpacing: '0.5px', lineHeight: 1 }}>
                  <span style={{ color: '#fff' }}>FLEO</span>
                  <span style={{ color: '#f1ba17' }}>FIT</span>
                </div>
                <div style={{ color: '#888', fontSize: '16px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginTop: '6px' }}>
                  {workout.date && isValid(parseISO(workout.date)) ? format(parseISO(workout.date), 'dd MMM yyyy', { locale: it }) : ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: type === 'Running' ? 'rgba(0, 148, 198, 0.2)' : (type === 'Event' ? '#fff' : (type === 'Custom' ? 'rgba(209, 17, 73, 0.2)' : 'rgba(241, 186, 23, 0.2)')), color: type === 'Running' ? '#0094C6' : (type === 'Event' ? '#000' : (type === 'Custom' ? '#D11149' : '#f1ba17')), padding: '6px 12px', borderRadius: '8px', fontSize: '14px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>
                  {type}
                </div>
                {workout.sections?.intensity && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#222', color: '#fff', padding: '6px 12px', borderRadius: '8px', fontSize: '14px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>
                    INT: {workout.sections.intensity}/10
                  </div>
                )}
              </div>
            </div>

            {/* TITLE */}
            <div style={{ marginBottom: '32px' }}>
              <div style={{ color: '#fff', fontSize: '36px', fontWeight: 900, lineHeight: 1.1, letterSpacing: '-1px', wordWrap: 'break-word' }}>
                {workout.title}
              </div>
            </div>

            {/* WORKOUT RECAP */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '36px' }}>
              {type === 'Event' ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', background: 'rgba(255,255,255,0.05)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <div style={{ fontSize: '60px', marginBottom: '16px' }}>🚀</div>
                  <div style={{ color: '#fff', fontSize: '24px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '8px', textAlign: 'center' }}>Giorno di Gara</div>
                  <div style={{ color: '#aaa', fontSize: '18px', fontWeight: 500, textAlign: 'center' }}>Oggi è il momento di dare tutto. Spacca!</div>
                </div>
              ) : type === 'Custom' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px', background: 'rgba(209,17,73,0.05)', borderRadius: '16px', border: '1px solid rgba(209,17,73,0.1)' }}>
                  <div style={{ fontSize: '17px', fontWeight: 500, color: '#fff', lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>{workout.coach_notes || athleteNote?.text || 'Allenamento Custom'}</div>
                </div>
              ) : !isRunning ? blocks.map((b, i) => {
                let shortTitle = b.type;
                if (b.type === 'EMOM') shortTitle = `EMOM ${b.params?.rounds ? b.params.rounds + 'x' : ''}`;
                else if (b.type === 'AMRAP') shortTitle = `AMRAP ${b.params?.duration || ''}`;
                else if (b.type === 'ON/OFF') shortTitle = `ON/OFF ${b.params?.rounds ? b.params.rounds + 'x ' : ''}• ${b.params?.on || ''}/${b.params?.off || ''}`;
                else if (b.type === 'For Time') shortTitle = `FOR TIME ${b.params?.rounds ? b.params.rounds + 'x' : ''}`;
                                else if (b.type === 'Interval') shortTitle = `INTERVAL ${b.params?.rounds ? b.params.rounds + 'x' : ''}`;

                else if (b.type === 'WarmUp') shortTitle = `WARM UP ${b.params?.duration ? '• ' + b.params.duration : ''}`;
                else if (b.type === 'Rest') shortTitle = `REST ${b.params?.duration ? '• ' + b.params.duration : ''}`;
                else if (b.type === 'Cash In' || b.type === 'Cash Out') {
                    const rounds = b.params?.rounds || '1';
                    const rest = (parseInt(rounds, 10) > 1 && b.params?.rest && b.params.rest !== '-') ? ` · ${b.params.rest} REST` : '';
                    shortTitle = rounds !== '1' ? `${b.type.toUpperCase()} · ${rounds} ROUNDS${rest}` : b.type.toUpperCase();
                }

                return (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px', background: 'rgba(255,255,255,0.04)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                     <div style={{ fontSize: '15px', fontWeight: 900, color: '#f1ba17', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{shortTitle}</div>
                     {!['WarmUp', 'Rest'].includes(b.type) && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                           {(b.exercises || []).map((ex, j) => {
                              const detail = ex.exTime && ex.exTime !== '-' ? ex.exTime : ((ex.meters && ex.meters !== '-') ? ex.meters : (ex.reps && ex.reps !== '-' ? `${ex.reps} reps` : ''));
                              const isErgo = ['SkiErg', 'Rowing', 'Assault Bike', 'Echo Bike', 'TrueForm Runner', 'Curve Treadmill'].includes(ex.name);
                              const paceStr = isErgo && ex.ergoPace && ex.ergoPace !== '-' && ex.ergoPace !== 'Libero' ? `@ ${ex.ergoPace}` : '';
                              const kgStr = ex.kg ? `${ex.kg}kg` : '';
                              const specs = [detail, paceStr, kgStr].filter(Boolean).join(' · ');
                              return (
                                <div key={j} style={{ display: 'flex', flexDirection: 'column' }}>
                                   <span style={{ fontSize: '18px', fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>{ex.name}</span>
                                   {specs && <span style={{ fontSize: '15px', fontWeight: 600, color: '#888', marginTop: '2px' }}>{specs}</span>}
                                </div>
                              )
                           })}
                        </div>
                     )}
                  </div>
                )
              }) : (s?.steps || s?.main?.steps || []).map((step, i) => {
                let title = '';
                let desc = '';
                if (step.type === 'warmup') { title = `WARM UP ${step.duration ? '• ' + step.duration : ''}`; desc = step.pace ? `@ ${step.pace}` : ''; }
                else if (step.type === 'run') { title = `RUN ${step.duration ? '• ' + step.duration : ''}`; desc = step.pace ? `@ ${step.pace}` : ''; }
                else if (step.type === 'recover') { title = `RECOVERY ${step.duration ? '• ' + step.duration : ''}`; desc = step.pace ? `@ ${step.pace}` : ''; }
                else if (step.type === 'cooldown') { title = `COOL DOWN ${step.duration ? '• ' + step.duration : ''}`; desc = step.pace ? `@ ${step.pace}` : ''; }
                else if (step.type === 'repeat') { 
                  title = `REPEAT • ${step.rounds}x`; 
                  desc = `${step.runDuration} ON / ${step.recDuration} OFF`; 
                }

                return (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px', background: 'rgba(0,148,198,0.05)', borderRadius: '16px', border: '1px solid rgba(0,148,198,0.1)' }}>
                     <div style={{ fontSize: '15px', fontWeight: 900, color: '#0094C6', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</div>
                     {step.type === 'repeat' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                           <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '17px', fontWeight: 700, color: '#fff' }}>Run: {step.runDuration}</span>
                              {step.runPace && <span style={{ fontSize: '15px', fontWeight: 600, color: '#888' }}>@ {step.runPace}</span>}
                           </div>
                           <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '17px', fontWeight: 700, color: '#ccc' }}>Recover: {step.recDuration}</span>
                              {step.recPace && <span style={{ fontSize: '15px', fontWeight: 600, color: '#888' }}>@ {step.recPace}</span>}
                           </div>
                        </div>
                     ) : (
                       desc && <div style={{ fontSize: '17px', fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>{desc}</div>
                     )}
                  </div>
                )
              })}
            </div>

            {/* FOOTER */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '20px' }}>
              <div style={{ color: '#aaa', fontSize: '16px', fontWeight: 600 }}>
                Coach Federico Leo
              </div>
              <div style={{ color: '#fff', fontSize: '16px', fontWeight: 800, letterSpacing: '0.5px' }}>
                @FLEOFIT
              </div>
            </div>

          </div>
        </div>
      </div>
      {/* MODAL: ASSEGNA AD ATLETA */}
      {assignModalOpen && createPortal(
        <div className="fixed inset-0 bg-black/85 z-[60] flex items-center justify-center p-4">
          <div className="bg-[#1e1e1e] rounded-3xl w-full max-w-md flex flex-col animate-in fade-in zoom-in-[0.96] duration-300 ease-out" style={{ maxHeight: 'calc(100vh - 100px)' }}>
            <div className="flex items-center justify-between p-5 border-b border-[#2a2a2a]">
              <p className="text-white font-bold text-lg">Assegna Workout</p>
              <button aria-label="Chiudi" onClick={() => { setAssignModalOpen(false); setSelectedAthletes([]); setAssignStep(1); }} className="text-gray-500 hover:text-white"><X size={20} /></button>
             </div>
            
            {assignStep === 1 ? (
              <div className="overflow-y-auto flex-1 p-5 flex flex-col gap-3">
                {athletes.length === 0 ? (
                  <p className="text-gray-500 text-center py-4 text-sm">Nessun atleta trovato.</p>
                ) : (
                  <>
                    <div className="flex justify-between items-center mb-2 px-1">
                      <span className="text-gray-400 text-sm">Seleziona atleti:</span>
                      <button 
                        onClick={() => setSelectedAthletes(selectedAthletes.length === athletes.length ? [] : [...athletes])}
                        className="text-[#f1ba17] text-xs font-semibold hover:underline"
                      >
                        {selectedAthletes.length === athletes.length ? 'Deseleziona tutti' : 'Seleziona tutti'}
                      </button>
                    </div>
                    {athletes.map(a => {
                      const isSelected = selectedAthletes.some(sa => sa.id === a.id);
                      return (
                        <button key={a.id} onClick={() => {
                          if (isSelected) {
                            setSelectedAthletes(selectedAthletes.filter(sa => sa.id !== a.id));
                          } else {
                            setSelectedAthletes([...selectedAthletes, a]);
                          }
                        }}
                          className={`flex items-center justify-between bg-[#2a2a2a] border rounded-2xl p-3 hover:border-[#f1ba17] transition text-left ${isSelected ? 'border-[#f1ba17]' : 'border-[#333]'}`}>
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-[#1e1e1e] border border-[#444] flex items-center justify-center overflow-hidden shrink-0">
                              {a.photo_url
                                ? <img src={a.photo_url} alt={a.name} className="w-full h-full object-cover" onError={() => setAthletes(athletes.map(ath => ath.id === a.id ? { ...ath, photo_url: null } : ath))} />
                                : <User size={18} className="text-gray-500" />
                              }
                            </div>
                            <div>
                              <p className="text-white font-semibold">{a.name} {a.surname}</p>
                            </div>
                          </div>
                          <div className={`w-6 h-6 rounded-full border flex items-center justify-center ${isSelected ? 'bg-[#f1ba17] border-[#f1ba17]' : 'border-[#555] bg-[#111]'}`}>
                            {isSelected && <Check size={14} className="text-black" />}
                          </div>
                        </button>
                      )
                    })}
                  </>
                )}
                {selectedAthletes.length > 0 && (
                  <button onClick={() => setAssignStep(2)} className="w-full mt-3 py-3.5 bg-[#f1ba17] text-black font-bold rounded-xl hover:brightness-110 transition sticky bottom-0 shadow-lg">
                    Procedi ({selectedAthletes.length})
                  </button>
                )}
              </div>
            ) : (
              <div className="p-5 flex flex-col gap-4">
                <div>
                  <p className="text-gray-400 text-sm mb-1">Stai assegnando a:</p>
                  <p className="text-white font-bold">{selectedAthletes.length === 1 ? `${selectedAthletes[0].name} ${selectedAthletes[0].surname}` : `${selectedAthletes.length} atleti selezionati`}</p>
                </div>
                <div>
                  <label className="text-gray-400 text-sm mb-2 block">Seleziona la data dell'allenamento</label>
                  <CustomDatePicker
                    date={assignDate}
                    onChange={setAssignDate}
                    className="bg-[#111] border border-[#333] rounded-xl px-4 py-3 hover:border-[#f1ba17] text-base w-full"
                  />
                </div>
                <div className="flex gap-3 mt-2">
                  <button onClick={() => setAssignStep(1)} className="flex-1 py-3 bg-[#2a2a2a] text-white font-semibold rounded-xl hover:bg-[#333] transition disabled:opacity-50">
                    Indietro
                  </button>
                  <button onClick={handleAssignMultiple} disabled={assigning} className="flex-1 py-3 bg-[#f1ba17] text-black font-bold rounded-xl hover:brightness-110 transition disabled:opacity-50">
                    {assigning ? 'Assegno...' : 'Conferma'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* MODAL ALLENAMENTO AUTONOMO */}
      {autonomousModalOpen && createPortal(
        <div className="fixed inset-0 bg-black/85 z-[100] flex items-center justify-center p-4">
          <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-3xl w-full max-w-sm p-6 flex flex-col gap-4 shadow-2xl animate-in fade-in zoom-in-[0.96] duration-300 ease-out">
            <div className="flex justify-between items-center mb-2">
               <h2 className="text-xl font-bold text-white">Modifica Allenamento Libero</h2>
               <button aria-label="Chiudi" onClick={() => setAutonomousModalOpen(false)} className="text-gray-500 hover:text-white"><X size={20} /></button>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-gray-400 text-xs pl-1 mb-1 block">Titolo <span className="text-gray-500 font-normal">(facoltativo)</span></label>
                <input 
                  className="bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#f1ba17] w-full text-base"
                  value={autonomousForm.title}
                  onChange={(e) => setAutonomousForm({ ...autonomousForm, title: e.target.value })}
                  placeholder={generaTitolo(autonomousForm.date)}
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs pl-1 mb-1 block">Data</label>
                <CustomDatePicker
                  date={autonomousForm.date}
                  onChange={(d) => setAutonomousForm({ ...autonomousForm, date: d })}
                  className="bg-[#111] border border-[#333] rounded-xl px-4 py-3 hover:border-[#f1ba17] w-full text-base"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs pl-1 mb-1 block">Descrizione / Note</label>
                <textarea 
                  className="bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#f1ba17] w-full text-base resize-none"
                  rows={3}
                  value={autonomousForm.notes}
                  onChange={(e) => setAutonomousForm({ ...autonomousForm, notes: e.target.value })}
                  placeholder="Com'è andata?"
                />
              </div>
              <button 
                onClick={handleSaveAutonomous}
                disabled={savingAutonomous}
                className="w-full mt-2 py-3 bg-[#f1ba17] text-black font-bold rounded-xl hover:brightness-110 transition disabled:opacity-50"
              >
                {savingAutonomous ? 'Salvataggio...' : 'Conferma'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL: CONFERMA ELIMINAZIONE WORKOUT */}
      {showDeleteConfirm && createPortal(
        <div className="fixed inset-0 bg-black/85 z-[100] flex items-center justify-center p-4">
          <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-3xl w-full max-w-sm p-6 flex flex-col gap-4 text-center shadow-2xl animate-in fade-in zoom-in-[0.96] duration-300 ease-out">
            <div className="w-16 h-16 rounded-full bg-red-900/30 text-red-500 flex items-center justify-center mx-auto mb-2 shrink-0">
              <AlertTriangle size={32} />
            </div>
            <h2 className="text-xl font-bold text-white">Sei sicuro?</h2>
            <p className="text-gray-400 text-sm">
              Questa azione eliminerà definitivamente il workout dal calendario e non può essere annullata.
            </p>
            <div className="flex gap-3 mt-4">
              <button 
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="flex-1 py-3 bg-[#2a2a2a] text-white font-semibold rounded-xl hover:bg-[#333] transition disabled:opacity-50"
              >
                Annulla
              </button>
              <button 
                onClick={handleDeleteWorkout}
                disabled={deleting}
                className="flex-1 py-3 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-500 transition disabled:opacity-50"
              >
                {deleting ? 'Eliminazione...' : 'Elimina'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL: SUCCESSO ASSEGNAZIONE */}
      {showSuccessModal && createPortal(
        <div className="fixed inset-0 bg-black/85 z-[100] flex items-center justify-center p-4">
          <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-3xl w-full max-w-sm p-6 flex flex-col gap-4 text-center shadow-2xl animate-in fade-in zoom-in-[0.96] duration-300 ease-out">
            <div className="w-16 h-16 rounded-full bg-green-900/30 text-green-500 flex items-center justify-center mx-auto mb-2 shrink-0">
              <Check size={32} />
            </div>
            <h2 className="text-xl font-bold text-white">Workout Assegnato!</h2>
            <p className="text-gray-400 text-sm">
              L'allenamento è stato assegnato all'atleta con successo.
            </p>
            <button 
              onClick={() => setShowSuccessModal(false)}
              className="mt-4 w-full py-3 bg-[#2a2a2a] text-white font-semibold rounded-xl hover:bg-[#333] transition"
            >
              Chiudi
            </button>
          </div>
        </div>,
        document.body
      )}

       {/* MODAL: TV SYNC */}
      {tvModalOpen && createPortal(
        <div className="fixed inset-0 bg-black/85 z-[100] flex items-center justify-center p-4">
          <div className={`bg-[#1e1e1e] border border-[#2a2a2a] rounded-3xl w-full max-w-sm p-6 flex flex-col gap-4 text-center shadow-2xl animate-in fade-in zoom-in-[0.96] duration-300 ease-out transition-transform ${isTvInputFocused ? '-translate-y-32' : ''}`}>
            <div className="flex justify-between items-center mb-2">
               <h2 className="text-xl font-bold text-white flex items-center gap-2"><MonitorUp size={24} className="text-[#f1ba17]" /> Trasmetti in TV</h2>
               <button aria-label="Chiudi" onClick={() => setTvModalOpen(false)} className="text-gray-500 hover:text-white"><X size={20} /></button>
            </div>
            <p className="text-gray-400 text-sm text-left">
              Apri il browser della tua Fire Stick o Smart TV, vai su <strong className="text-white">fleofit.vercel.app/tv</strong> e inserisci qui sotto il codice che vedi a schermo.
            </p>
            <input 
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              className="bg-[#111] border border-[#333] rounded-xl px-4 py-4 text-white text-center text-3xl font-black tracking-[0.5em] focus:outline-none focus:border-[#f1ba17] w-full"
              value={tvCode}
              onChange={(e) => setTvCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
              onFocus={() => setIsTvInputFocused(true)}
              onBlur={() => setIsTvInputFocused(false)}
              placeholder="1234"
            />
            <button 
              onClick={handleConnectTV}
              disabled={tvConnecting || tvCode.length !== 4}
              className="w-full mt-2 py-4 bg-[#f1ba17] text-black font-bold rounded-xl hover:brightness-110 transition disabled:opacity-50 text-lg"
            >
              {tvConnecting ? 'Connessione...' : 'Trasmetti ora'}
            </button>
          </div>
        </div>,
        document.body
      )}

      {timerOpen && timerSequence.length > 0 && (
        <WorkoutTimer 
         sequence={timerSequence}
          onClose={() => {
            setTimerOpen(false);
            setTimerMinimized(false);
          }}
          tvCode={connectedTvCode}
          isMinimized={timerMinimized}
          onMinimize={() => setTimerMinimized(true)}
          onMaximize={() => setTimerMinimized(false)}
          athleteWorkoutId={athleteWorkoutId}
          athleteName={currentAthleteName || user?.user_metadata?.first_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Atleta'}
          workoutTitle={workout.title}
          heartRate={heartRate}
        />
      )}
      {showRpeModal && createPortal(
        <RpeModal 
          score={rpeScore} 
          onScoreChange={setRpeScore} 
          notes={rpeNotes} 
          onNotesChange={setRpeNotes} 
          onSave={handleRpeSubmit} 
          onCancel={() => setShowRpeModal(false)} 
          saving={savingNote} 
        />,
        document.body
      )}
      {createPortal(
        <>
          <CustomAlert info={alertInfo} onClose={() => setAlertInfo(null)} />
          <CustomConfirm info={confirmInfo} onClose={() => setConfirmInfo(null)} />
        </>,
        document.body
      )}
    </div>
  )
}

const SCHEMES = {
  prep:  { bg: 'bg-[#f1ba17]', text: 'text-black', sub: 'text-black/70', card: 'bg-black/10 border-black/20 text-black', cardLabel: 'text-black/60', icon: 'text-black', btnBg: 'bg-black text-[#f1ba17]' },
  run:   { bg: 'bg-[#0094C6]', text: 'text-white', sub: 'text-white/80', card: 'bg-black/20 border-white/10 text-white', cardLabel: 'text-white/60', icon: 'text-white', btnBg: 'bg-white text-[#0094C6]' },
  rest:  { bg: 'bg-[#1e1e1e]', text: 'text-green-400', sub: 'text-green-500/80', card: 'bg-[#111] border-green-500/20 text-green-400', cardLabel: 'text-green-500/60', icon: 'text-gray-400', btnBg: 'bg-green-500 text-black' },
  hyrox: { bg: 'bg-[#D11149]', text: 'text-white', sub: 'text-white/80', card: 'bg-black/20 border-white/10 text-white', cardLabel: 'text-white/60', icon: 'text-white', btnBg: 'bg-white text-[#D11149]' },
  emom:  { bg: 'bg-[#111]', text: 'text-[#f1ba17]', sub: 'text-[#f1ba17]/80', card: 'bg-[#1e1e1e] border-[#f1ba17]/20 text-[#f1ba17]', cardLabel: 'text-[#f1ba17]/60', icon: 'text-gray-400', btnBg: 'bg-[#f1ba17] text-black' },
  base:  { bg: 'bg-[#0B0B0B]', text: 'text-white', sub: 'text-gray-400', card: 'bg-[#1e1e1e] border-[#333] text-white', cardLabel: 'text-gray-500', icon: 'text-gray-400', btnBg: 'bg-[#f1ba17] text-black' },
  done:  { bg: 'bg-green-500', text: 'text-black', sub: 'text-black/80', card: 'bg-black/10 border-black/20 text-black', cardLabel: 'text-black/60', icon: 'text-black', btnBg: 'bg-black text-green-500' },
  custom: { bg: 'bg-[#0B0B0B]', text: 'text-[#D11149]', sub: 'text-[#D11149]/80', card: 'bg-[#1e1e1e] border-[#D11149]/20 text-[#D11149]', cardLabel: 'text-[#D11149]/60', icon: 'text-gray-400', btnBg: 'bg-[#D11149] text-white' }
}

function WorkoutTimer({ sequence, onClose, tvCode, isMinimized, onMinimize, onMaximize, athleteWorkoutId, athleteName, workoutTitle, heartRate }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(sequence[0]?.duration || 0);
  const [isRunning, setIsRunning] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isOpening, setIsOpening] = useState(true);
  const timerRef = useRef(null);
  const shortBeepAudio = useRef(null);
  const longBeepAudio = useRef(null);
  const longerBeepAudio = useRef(null);
  const silentAudioRef = useRef(null);
  const tvChannelRef = useRef(null);
  const tvJoinedRef = useRef(false);
  const [tvJoined, setTvJoined] = useState(false);
  const [reaction, setReaction] = useState(null);
  const [reactionType, setReactionType] = useState(null);
  const [reactionVisible, setReactionVisible] = useState(false);
  const reactionTimeoutRef = useRef(null);
  const liveChannelRef = useRef(null);

  // Touch Handlers per minimizzare con lo swipe
  const [startY, setStartY] = useState(null);
  const [currentY, setCurrentY] = useState(null);
  const handleTouchStart = (e) => setStartY(e.touches[0].clientY);
  const handleTouchMove = (e) => {
    if (startY === null) return;
    const y = e.touches[0].clientY;
    if (y > startY) setCurrentY(y);
  };
  const handleTouchEnd = () => {
    if (startY !== null && currentY !== null && currentY - startY > 100) onMinimize();
    setStartY(null);
    setCurrentY(null);
  };
  const swipeOffset = startY !== null && currentY !== null && currentY > startY ? currentY - startY : 0;

  useEffect(() => {
    if (tvCode) {
      const channel = supabase.channel(`tv_${tvCode}`, {
        config: { broadcast: { ack: false } }
      });
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          tvJoinedRef.current = true;
          setTvJoined(true);
        }
      });
      tvChannelRef.current = channel;
      return () => {
        if (tvJoinedRef.current) {
          channel.send({ type: 'broadcast', event: 'timer_close', payload: {} }).catch(()=>{});
        }
        supabase.removeChannel(channel);
        tvJoinedRef.current = false;
        setTvJoined(false);
      };
    }
  }, [tvCode]);

  // Live Coach Cam - Presence & Broadcasting
  useEffect(() => {
    if (!athleteWorkoutId) return;
    
    const presenceChannel = supabase.channel('global_live_workouts', {
      config: { presence: { key: athleteWorkoutId } }
    });

    const coachChannel = supabase.channel(`live_coach_${athleteWorkoutId}`);
    coachChannel.on('broadcast', { event: 'reaction' }, (payload) => {
      if (reactionTimeoutRef.current) clearTimeout(reactionTimeoutRef.current);
      setReaction(payload.payload.emoji);
      setReactionType('emoji');
      setReactionVisible(true);
      try { if (navigator.vibrate) navigator.vibrate([100, 50, 100]); } catch(e) {}
      reactionTimeoutRef.current = setTimeout(() => {
        setReactionVisible(false);
        reactionTimeoutRef.current = setTimeout(() => setReaction(null), 500);
      }, 3000);
    }).on('broadcast', { event: 'live_audio' }, (payload) => {
      const audioUrl = payload.payload.url;
      if (audioUrl) {
        if (reactionTimeoutRef.current) clearTimeout(reactionTimeoutRef.current);
        setReaction('🎙️');
        setReactionType('voice');
        setReactionVisible(true);
        try { if (navigator.vibrate) navigator.vibrate([100, 50, 100]); } catch(e) {}
        const audio = new Audio(audioUrl);
        const closeVoice = () => {
           setReactionVisible(false);
           reactionTimeoutRef.current = setTimeout(() => setReaction(null), 500);
        };
        audio.onended = closeVoice;
        audio.onerror = closeVoice;
        audio.play().catch(e => {
          console.error("Error playing live audio:", e);
          closeVoice();
        });
      }
    }).subscribe();

    liveChannelRef.current = coachChannel;

    presenceChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await presenceChannel.track({
          athleteWorkoutId, athleteName, workoutTitle, startedAt: new Date().toISOString()
        });
      }
    });

    return () => {
      supabase.removeChannel(presenceChannel);
      supabase.removeChannel(coachChannel);
    };
  }, [athleteWorkoutId, athleteName, workoutTitle]);

  useEffect(() => {
    if (tvJoined && tvChannelRef.current) {
      tvChannelRef.current.send({
        type: 'broadcast',
        event: 'timer_state',
        payload: { currentIdx, timeLeft, isRunning, step: sequence[currentIdx], heartRate }
      }).catch(()=>{});
    }
    if (liveChannelRef.current) {
      liveChannelRef.current.send({
        type: 'broadcast',
        event: 'timer_state',
        payload: { currentIdx, timeLeft, isRunning, step: sequence[currentIdx], heartRate }
      }).catch(()=>{});
    }
  }, [currentIdx, timeLeft, isRunning, sequence, tvJoined, athleteWorkoutId, heartRate]);
  
  useEffect(() => {
    shortBeepAudio.current = new Audio(shortBeepURI);
    longBeepAudio.current = new Audio(longBeepURI);
    longerBeepAudio.current = new Audio(longerBeepURI);
    
    // Avvia l'animazione di entrata "Slide-Up" 10 millisecondi dopo il rendering
    const t = setTimeout(() => setIsOpening(false), 10);
    return () => clearTimeout(t);
  }, []);

  const playBeep = useCallback(async (freq, type, duration, isEnd) => {
    if (isMuted) return;

    // Vibrazione (più forte alla fine del round)
    try {
      if (Capacitor.isNativePlatform()) {
        await Haptics.impact({ style: isEnd ? ImpactStyle.Heavy : ImpactStyle.Light });
      } else if (navigator.vibrate) {
        navigator.vibrate(isEnd ? 400 : 100);
      }
    } catch (e) {}

    try {
      let audio;
      if (duration <= 0.2) audio = shortBeepAudio.current;
      else if (duration <= 1.0) audio = longBeepAudio.current;
      else audio = longerBeepAudio.current;

      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      }
    } catch (e) {}
  }, [isMuted]);

  // Inizializza l'audio in modo sicuro al primo tocco
  const initAudioAndPlay = () => {

    // HACK iOS: Riprodurre un audio HTML5 invisibile in loop forza WKWebView a ignorare il tasto Silenzioso
    if (!silentAudioRef.current) {
      silentAudioRef.current = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA');
      silentAudioRef.current.loop = true;
      
      // Sblocca i suoni
      [shortBeepAudio.current, longBeepAudio.current, longerBeepAudio.current].forEach(a => {
        if (a) {
          a.volume = 0;
          a.play().then(() => {
            a.pause();
            a.currentTime = 0;
            a.volume = 1;
          }).catch(()=>{});
        }
      });
    }

    if (!isRunning) {
      silentAudioRef.current.play().catch(()=>{});
    } else {
      silentAudioRef.current.pause();
    }

    setIsRunning(!isRunning);
  };

  // MANTIENI LO SCHERMO ACCESO
  useEffect(() => {
    let wakeLock = null;
    const keepScreenAwake = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          await KeepAwake.keepAwake();
        } catch (e) {}
      } else if ('wakeLock' in navigator) {
        try {
          wakeLock = await navigator.wakeLock.request('screen');
        } catch (err) {}
      }
    };

    const allowScreenSleep = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          await KeepAwake.allowSleep();
        } catch (e) {}
      } else if (wakeLock !== null) {
        try {
          await wakeLock.release();
          wakeLock = null;
        } catch (err) {}
      }
    };

    keepScreenAwake();
    return () => { allowScreenSleep(); };
  }, []);

  useEffect(() => {
    if (!isRunning) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      return;
    }

    const currentStep = sequence[currentIdx];
    const isStopwatch = currentStep.type === 'stopwatch' || currentStep.type === 'done';

    if (isStopwatch) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => prev + 1);
      }, 1000);
    } else {
      let expected = performance.now() + 1000;

      const tick = () => {
        const drift = performance.now() - expected;
        
        setTimeLeft(prev => {
          if (isStopwatch) return prev + 1;
          
          const newTime = prev - 1;

          if (newTime < 0) {
            // Transizione al prossimo step
            if (currentIdx < sequence.length - 1) {
              const nextStep = sequence[currentIdx + 1];
              setCurrentIdx(currentIdx + 1);
              
              // Beep lungo di transizione o beep finale
              if (nextStep.type === 'done') {
                setIsRunning(false);
                if (silentAudioRef.current) silentAudioRef.current.pause();
              }
             
              return nextStep.duration || 0;
            } else {
              // Fine del workout
              setIsRunning(false);
              if (silentAudioRef.current) silentAudioRef.current.pause();
              return 0;
            }
          } else {
            // Beep del conto alla rovescia per 4, 3, 2, 1 secondi rimanenti
            if (prev <= 4 && prev > 1) {
              playBeep(600, 'sine', 0.2, false);
            } else if (prev === 1) { // Beep di transizione quando manca 1 secondo (quindi a 0)
              const nextStep = sequence[currentIdx + 1];
              if (nextStep?.type === 'done') {
                playBeep(1200, 'sine', 1.5, true);
              } else {
                playBeep(1200, 'sine', 1.0, true);
              }
            }
          }
          return newTime;
        });

        expected += 1000;
        timerRef.current = setTimeout(tick, Math.max(0, 1000 - drift));
      };
      timerRef.current = setTimeout(tick, 1000);
    }

    return () => { if (timerRef.current) isStopwatch ? clearInterval(timerRef.current) : clearTimeout(timerRef.current) };
  }, [isRunning, currentIdx, sequence, playBeep]);

  const handleNext = () => {
    if (currentIdx < sequence.length - 1) {
      const nextStep = sequence[currentIdx + 1];
      if (nextStep.type === 'done') {
        playBeep(1200, 'sine', 1.5, true);
      } else {
        playBeep(1200, 'sine', 1.0, true);
      }
      setCurrentIdx(currentIdx + 1);
      setTimeLeft(nextStep.duration || 0);
    }
  };

  const handlePrev = () => {
    if (currentIdx > 0) {
      const prevStep = sequence[currentIdx - 1];
      setCurrentIdx(currentIdx - 1);
      setTimeLeft(prevStep.duration || 0);
    }
  };

  const handleClose = () => {
    if (silentAudioRef.current) {
      silentAudioRef.current.pause();
    }
    setIsClosing(true);
    setTimeout(onClose, 500); // Aspetta che finisca l'animazione
  };

  const currentStep = sequence[currentIdx];
  const isDone = currentStep?.type === 'done';
  const formatT = (totalSeconds) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const currentTheme = SCHEMES[currentStep?.theme || 'base'] || SCHEMES.base;

return createPortal(
  <>
    <div 
      className={`fixed bottom-24 left-4 right-4 z-[150] bg-[#1e1e1e]/95 backdrop-blur-xl border border-[#333] rounded-3xl p-4 flex items-center justify-between shadow-2xl transition-all duration-500 ease-out ${
        isMinimized && !isClosing ? 'translate-y-0 opacity-100 pointer-events-auto' : 'translate-y-32 opacity-0 pointer-events-none'
      }`}
    >
      <div className="flex-1 min-w-0 pr-4 cursor-pointer" onClick={onMaximize}>
        <div className="flex items-center gap-2 mb-1">
          <span className={`w-2 h-2 rounded-full ${currentTheme.bg.replace('bg-', 'bg-')}`}></span>
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest truncate">{currentStep?.title}</p>
        </div>
        <div className="flex items-center gap-3 mb-1">
          <p className="text-3xl font-black text-white tabular-nums leading-none">{formatT(timeLeft)}</p>
          {heartRate && (
            <div className="flex items-center gap-1 text-red-500 font-bold bg-red-500/10 border border-red-500/30 px-2 py-0.5 rounded-lg">
              <Heart size={14} className="animate-pulse" fill="currentColor" /> {heartRate}
            </div>
          )}
        </div>
        <p className="text-sm font-medium text-gray-400 truncate">{currentStep?.task || 'Workout'}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button aria-label="Passaggio precedente" onClick={handlePrev} className="p-3 text-gray-400 hover:text-white transition"><StepBack size={20}/></button>
        <button aria-label={isRunning ? 'Metti in pausa il timer' : 'Avvia il timer'} onClick={(e) => { e.stopPropagation(); initAudioAndPlay(); }} className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95 ${currentTheme.btnBg}`}>
          {isRunning ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1" />}
        </button>
        <button aria-label="Passaggio successivo" onClick={handleNext} className="p-3 text-gray-400 hover:text-white transition"><StepForward size={20}/></button>
        <div className="w-px h-8 bg-[#333] mx-1"></div>
        <button aria-label="Chiudi il timer" onClick={handleClose} className="p-3 text-red-500 hover:text-red-400 transition"><X size={20}/></button>
      </div>
    </div>

    <div className={`fixed inset-0 z-[200] flex flex-col justify-end transition-all duration-500 ${!isMinimized && !isClosing ? 'pointer-events-auto' : 'pointer-events-none'}`}>
      <div 
        className={`absolute inset-0 bg-black transition-opacity duration-500 ease-out ${!isMinimized && !isClosing && !isOpening ? 'opacity-60' : 'opacity-0'}`}
        onClick={onMinimize} 
      />
      <div
        className={`relative ${currentTheme.bg} flex flex-col rounded-t-3xl shadow-2xl ease-out ${swipeOffset > 0 ? 'transition-none' : 'transition-transform duration-500'}`}
        style={{  
          height: 'calc(100% - env(safe-area-inset-top) - 10px)', 
          transform: !isMinimized && !isClosing && !isOpening ? (swipeOffset > 0 ? `translateY(${swipeOffset}px)` : 'translateY(0)') : 'translateY(100%)'
        }}
      >
        <div 
          className="w-full flex flex-col touch-none cursor-grab active:cursor-grabbing"
          onTouchStart={handleTouchStart} 
          onTouchMove={handleTouchMove} 
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-full flex justify-center pt-5 pb-6">
            <div className="w-12 h-1.5 bg-black/20 rounded-full"></div>
          </div>
          <div className="flex justify-between items-center px-6 pb-4">
            <button aria-label="Riduci il timer a icona" 
              onClick={onMinimize}
              onTouchStart={e => e.stopPropagation()} 
              onTouchMove={e => e.stopPropagation()} 
              className={`w-12 h-12 bg-black/20 rounded-full flex items-center justify-center backdrop-blur-md transition hover:scale-105 relative z-10 ${currentTheme.icon}`}
            >
              <ChevronDown size={28} />
            </button>
            {heartRate && (
              <div className="flex items-center gap-2 px-5 py-2 bg-black/30 border border-red-500/30 backdrop-blur-md rounded-full text-red-500 font-bold shadow-lg">
                <Heart size={20} className="animate-pulse" fill="currentColor" />
                <span className="text-xl tabular-nums">{heartRate} bpm</span>
              </div>
            )}
            <button aria-label={isMuted ? 'Riattiva i suoni' : 'Disattiva i suoni'} 
              onClick={() => setIsMuted(!isMuted)}
              onTouchStart={e => e.stopPropagation()} 
              onTouchMove={e => e.stopPropagation()} 
              className={`w-12 h-12 bg-black/20 rounded-full flex items-center justify-center backdrop-blur-md relative z-10 ${currentTheme.icon}`}
            >
              {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
            </button>
          </div>
        </div>

        {tvCode && (
          <div className="absolute top-10 left-1/2 -translate-x-1/2 bg-blue-500 text-white px-4 py-1.5 rounded-full font-bold text-xs shadow-xl animate-pulse flex items-center gap-2 pointer-events-none">
            <MonitorUp size={14} /> Telecomando TV Attivo
          </div>
        )}

        <div className="flex-1 flex flex-col items-center justify-between p-6 text-center w-full max-w-md mx-auto overflow-y-auto">
          <div className="w-full">
            <h2 className={`text-4xl font-black tracking-widest uppercase mb-1 drop-shadow-md ${currentTheme.text}`}>{currentStep?.title}</h2>
            <p className={`text-xl font-bold h-7 ${currentTheme.sub}`}>{currentStep?.subtitle || ''}</p>
          </div>

          <div className="flex flex-col items-center my-4">
            <div className={`backdrop-blur-md rounded-2xl p-4 mb-6 w-full shadow-lg ${currentTheme.card}`}>
              <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${currentTheme.cardLabel}`}>Esercizio</p>
              <p className="font-bold text-2xl leading-tight min-h-[60px] flex items-center justify-center">{currentStep?.task || 'Workout'}</p>
            </div>
            <div className={`text-[120px] font-black tracking-tighter leading-none drop-shadow-2xl tabular-nums ${currentTheme.text}`}>{formatT(timeLeft)}</div>
          </div>

          <div className="w-full min-h-[70px] flex flex-col items-center justify-center">
            <p className={`font-medium text-sm px-4 h-5 mb-2 ${currentTheme.sub}`}>{currentStep?.type === 'stopwatch' ? 'Cronometro libero. Usa le frecce in basso per cambiare blocco.' : ''}</p>
            {currentStep?.nextTask && (
              <div className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full backdrop-blur-md max-w-full ${currentTheme.card}`}>
                <span className={`font-semibold text-sm truncate ${currentTheme.cardLabel}`}>Next: <span className={currentTheme.text}>{currentStep.nextTask}</span></span>
              </div>
            )}
          </div>
        </div>

        <div className="p-8 pb-16 flex items-center justify-center gap-6 shrink-0">
          <button aria-label="Passaggio precedente" onClick={handlePrev} disabled={currentIdx === 0} className={`w-16 h-16 bg-black/20 rounded-full flex items-center justify-center backdrop-blur-md disabled:opacity-30 ${currentTheme.icon}`}><StepBack size={28} /></button>
          {!isDone && (
            <button aria-label={isRunning ? 'Metti in pausa il timer' : 'Avvia il timer'} onClick={initAudioAndPlay} className={`w-24 h-24 rounded-full flex items-center justify-center shadow-2xl hover:scale-105 transition-transform ${currentTheme.btnBg}`}>
              {isRunning ? <Pause size={40} fill="currentColor" /> : <Play size={40} fill="currentColor" className="ml-2" />}
            </button>
          )}
          <button aria-label="Passaggio successivo" onClick={handleNext} disabled={isDone} className={`w-16 h-16 bg-black/20 rounded-full flex items-center justify-center backdrop-blur-md disabled:opacity-30 ${currentTheme.icon}`}><StepForward size={28} /></button>
        </div>

      </div> {/* ← chiude: relative ${currentTheme.bg} flex flex-col rounded-t-3xl */}
    </div> {/* ← chiude: fixed inset-0 z-[200] */}

    {reaction && (
      <div className={`fixed inset-0 z-[300] flex items-center justify-center pointer-events-none transition-all duration-500 ease-out ${reactionVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
        {reactionType === 'emoji' && (
          <span className="text-[200px] drop-shadow-[0_0_60px_rgba(255,255,255,0.4)] animate-bounce" style={{ animationDuration: '0.6s' }}>{reaction}</span>
        )}
        {reactionType === 'voice' && (
          <div className="bg-[#111]/90 backdrop-blur-md border-2 border-[#f1ba17]/50 rounded-[2rem] px-8 py-6 flex items-center gap-5 shadow-[0_0_50px_rgba(241,186,23,0.3)]">
            <div className="w-16 h-16 rounded-full bg-[#f1ba17] flex items-center justify-center animate-pulse shrink-0 shadow-lg shadow-[#f1ba17]/40">
               <Mic size={32} className="text-black" />
            </div>
            <div className="flex flex-col">
              <span className="text-[#f1ba17] font-black text-xs uppercase tracking-widest mb-0.5">Walkie-Talkie</span>
              <span className="text-white font-bold text-xl leading-tight">Messaggio dal Coach</span>
            </div>
            <div className="flex items-center gap-1.5 ml-4 h-8 shrink-0">
               {[...Array(4)].map((_, i) => (
                  <div key={i} className="w-1.5 bg-[#f1ba17] rounded-full animate-bounce" style={{ height: '100%', animationDelay: `${i * 0.15}s`, animationDuration: '0.8s' }}></div>
               ))}
            </div>
          </div>
        )}
      </div>
    )}
  </>,
  document.body
);
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

// ── HELPERS ─────────────────────────────────────────────────
function Section({ icon, label, hint, color, children }) {
  return (
    <div className={`bg-[#1e1e1e] border ${color} rounded-2xl p-4 mb-3`}>
      <div className="flex items-baseline gap-2 mb-3">
        {icon}
        <span className="text-white font-semibold text-sm">{label}</span>
        {hint && <span className="text-[11px] text-gray-500 font-normal">{hint}</span>}
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
            {ex.notes && <span className="text-gray-400 text-xs ml-2">· {ex.notes}</span>}
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

function CustomAudioPlayer({ src, onDelete, role }) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState('0:00')
  const [duration, setDuration] = useState('0:00')
  const audioRef = useRef(null)

  const formatAudioTime = (time) => {
    if (isNaN(time)) return '0:00'
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const togglePlay = () => {
    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
    setIsPlaying(!isPlaying)
  }

  const handleTimeUpdate = () => {
    const current = audioRef.current.currentTime
    const total = audioRef.current.duration
    if (!isNaN(total)) {
      setProgress((current / total) * 100)
      setCurrentTime(formatAudioTime(current))
    }
  }

  const handleLoadedMetadata = () => {
    setDuration(formatAudioTime(audioRef.current.duration))
  }

  const handleSeek = (e) => {
    const seekTime = (e.target.value / 100) * audioRef.current.duration
    audioRef.current.currentTime = seekTime
    setProgress(e.target.value)
  }

  return (
    <div className="flex items-center gap-3 bg-[#111] p-2 rounded-xl border border-[#333] w-full mb-2">
      <audio 
        ref={audioRef} 
        src={src} 
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => { setIsPlaying(false); setProgress(0); audioRef.current.currentTime = 0; setCurrentTime('0:00') }}
      />
      <button aria-label={isPlaying ? 'Metti in pausa la nota vocale' : 'Riproduci la nota vocale'} onClick={togglePlay} className="w-10 h-10 rounded-full bg-[#f1ba17] flex items-center justify-center text-black shrink-0 hover:brightness-110 transition">
        {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-1" />}
      </button>
      <div className="flex-1 flex flex-col justify-center px-1">
         <div className="flex items-center gap-2 h-4">
            <input 
              type="range" 
              min="0" max="100" 
              value={progress} 
              onChange={handleSeek}
              className="w-full h-1.5 bg-[#333] rounded-lg appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-[#f1ba17] [&::-webkit-slider-thumb]:rounded-full cursor-pointer"
              style={{ background: `linear-gradient(to right, #f1ba17 ${progress}%, #333 ${progress}%)` }}
            />
         </div>
         <div className="flex justify-between items-center mt-1">
            <span className="text-[11px] text-gray-500 font-medium">{currentTime}</span>
            <span className="text-[11px] text-gray-500 font-medium">{duration}</span>
         </div>
      </div>
      {role === 'admin' && onDelete && (
        <button aria-label="Elimina la nota vocale" onClick={onDelete} className="w-10 h-10 flex items-center justify-center text-gray-500 hover:text-red-500 transition shrink-0" title="Elimina vocale">
          <Trash2 size={18} />
        </button>
      )}
    </div>
  )
}

function AudioVisualizer({ stream }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!stream) return
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {})
    }
    const analyser = audioCtx.createAnalyser()
    const source = audioCtx.createMediaStreamSource(stream)
    source.connect(analyser)
    analyser.fftSize = 64
    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    const canvas = canvasRef.current
    const canvasCtx = canvas.getContext('2d')
    let animationId

    const draw = () => {
      animationId = requestAnimationFrame(draw)
      analyser.getByteFrequencyData(dataArray)
      canvasCtx.clearRect(0, 0, canvas.width, canvas.height)
      
      const barWidth = (canvas.width / bufferLength) * 1.5
      let x = 0

      for (let i = 0; i < bufferLength; i++) {
        let barHeight = dataArray[i] / 8
        if (barHeight < 2) barHeight = 2
        
        canvasCtx.fillStyle = '#f1ba17'
        const y = (canvas.height - barHeight) / 2
        
        canvasCtx.beginPath()
        canvasCtx.roundRect ? canvasCtx.roundRect(x, y, barWidth - 2, barHeight, 4) : canvasCtx.rect(x, y, barWidth - 2, barHeight)
        canvasCtx.fill()
        
        x += barWidth
      }
    }
    draw()

    return () => {
      cancelAnimationFrame(animationId)
      if (audioCtx.state !== 'closed') audioCtx.close()
    }
  }, [stream])

  return <canvas ref={canvasRef} className="w-full h-8" width={200} height={32} />
}

function VoiceRecorder({ onSave, onCancel }) {
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [mediaStream, setMediaStream] = useState(null)
  const isNative = Capacitor.isNativePlatform()
  
  const mediaRecorder = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const isCancelledRef = useRef(false)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (mediaStream) mediaStream.getTracks().forEach(t => t.stop())
    }
  }, [mediaStream])

  const toggleRecording = () => {
    if (isRecording) {
      stopRecordingAndSave()
    } else {
      startRecording()
    }
  }

  const startRecording = async () => {
    let stream = null;

    if (isNative) {
      try {
        let hasPerm = await NativeVoiceRecorder.hasAudioRecordingPermission()
        if (!hasPerm.value) {
          hasPerm = await NativeVoiceRecorder.requestAudioRecordingPermission()
          if (!hasPerm.value) return alert('Devi abilitare il microfono dalle impostazioni di iOS.')
        }
      } catch (e) {
        console.error("Errore permessi nativi:", e)
      }
    }

    // Ottiene il microfono tramite Web API unicamente per il visualizzatore visivo (l'onda)
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        setMediaStream(stream)
      } catch (err) {
        console.error("Web API fallita (nessun problema, usiamo animazione fallback):", err)
      }
    }

    if (isNative) {
      try {
        await NativeVoiceRecorder.startRecording()
        isCancelledRef.current = false
        setIsRecording(true)
        setRecordingTime(0)
        timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000)
      } catch (e) {
        console.error("Errore avvio rec nativo:", e)
        alert('Impossibile accedere al microfono.')
      }
    } else {
      if (!window.MediaRecorder || !stream) {
        return alert('Il tuo browser non supporta la registrazione vocale.')
      }
      try {
        const recorder = new MediaRecorder(stream)
        chunksRef.current = []
        isCancelledRef.current = false
        
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data)
        }
        
        recorder.onstop = () => {
          const mimeType = recorder.mimeType || 'audio/webm'
          const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('aac') ? 'aac' : 'webm'
          const audioBlob = new Blob(chunksRef.current, { type: mimeType })
          if (stream) stream.getTracks().forEach(track => track.stop())
          setMediaStream(null)
          if (!isCancelledRef.current) {
            onSave(audioBlob, ext)
          } else if (onCancel) {
            onCancel()
          }
        }
        
        recorder.start()
        mediaRecorder.current = recorder
        setIsRecording(true)
        setRecordingTime(0)
        timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000)
      } catch (err) {
        console.error("Errore avvio MediaRecorder:", err)
      }
    }
  }

  const cancelRecording = async () => {
    isCancelledRef.current = true
    setIsRecording(false)
    clearInterval(timerRef.current)

    if (!isNative && mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop()
      return
    }

    if (isNative) {
      if (mediaStream) {
        mediaStream.getTracks().forEach(t => t.stop())
        setMediaStream(null)
      }
      try { await NativeVoiceRecorder.stopRecording() } catch(e) {}
      if (onCancel) onCancel()
    }
  }

  const stopRecordingAndSave = async () => {
    isCancelledRef.current = false
    setIsRecording(false)
    clearInterval(timerRef.current)

    if (!isNative && mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop()
      return
    }

    if (isNative) {
      if (mediaStream) {
        mediaStream.getTracks().forEach(t => t.stop())
        setMediaStream(null)
      }
      try {
        const result = await NativeVoiceRecorder.stopRecording()
        if (result.value && result.value.recordDataBase64) {
          const mimeType = result.value.mimeType || 'audio/aac'
          const ext = mimeType.includes('mp4') ? 'mp4' : 'aac'
          const response = await fetch(`data:${mimeType};base64,${result.value.recordDataBase64}`)
          const audioBlob = await response.blob()
          onSave(audioBlob, ext)
        } else if (onCancel) onCancel()
      } catch(e) {
        console.error("Errore stop nativo:", e)
      }
    }
  }

  return (
    <div className="relative w-full">
      <div className="flex items-center gap-2 bg-[#111] border border-[#333] p-1.5 rounded-full h-12 w-full">
        {!isRecording ? (
          <button 
            onClick={toggleRecording}
            className="w-full h-full rounded-full flex items-center justify-center gap-2 text-gray-400 hover:text-white transition-all"
          >
            <Mic size={18} className="text-[#f1ba17]" /> Tocca per registrare...
          </button>
        ) : (
          <div className="flex items-center justify-between w-full px-2 gap-2">
            <div className="flex items-center gap-1 text-red-500 font-semibold animate-pulse w-12 shrink-0 select-none text-xs">
              <div className="w-2 h-2 rounded-full bg-red-500"></div>
              {Math.floor(recordingTime/60)}:{(recordingTime%60).toString().padStart(2,'0')}
            </div>
            
            <div className="flex-1 mx-2 overflow-hidden h-6 flex items-center justify-center gap-1">
              {mediaStream ? (
                <AudioVisualizer stream={mediaStream} />
              ) : (
                <div className="flex items-center gap-1 h-full py-1">
                  {[...Array(12)].map((_, i) => (
                    <div key={i} className="w-1.5 bg-[#f1ba17] rounded-full animate-bounce" style={{ height: '100%', animationDelay: `${i * 0.1}s`, animationDuration: '0.8s' }}></div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button aria-label="Annulla la registrazione" onClick={cancelRecording} className="text-gray-400 hover:text-red-500 transition p-1" title="Annulla">
                <Trash2 size={16} />
              </button>
              <button aria-label="Ferma e salva la registrazione" onClick={stopRecordingAndSave} className="w-9 h-9 flex items-center justify-center bg-[#f1ba17] text-black rounded-full hover:brightness-110 transition" title="Interrompi e Salva">
                <Square size={14} fill="currentColor" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function RpeModal({ score, onScoreChange, notes, onNotesChange, onSave, onCancel, saving }) {
  const [isFocused, setIsFocused] = useState(false);
  const containerRef = useRef(null);
  const isDragging = useRef(false);
  const blurTimeoutRef = useRef(null);
  const [syncingHealth, setSyncingHealth] = useState(false);

  const handleHealthSync = async () => {
    try {
      setSyncingHealth(true);
      const { HealthService } = await import('./health');
      const data = await HealthService.syncLatestWorkout();
      const textToAppend = `\n\n🍏 [Apple Health] Durata: ${data.duration || '--'} min | Calorie: ${data.calories || '--'} kcal | Battiti Medi: ${data.avgHeartRate || '--'} bpm`;
      onNotesChange(notes ? notes + textToAppend : textToAppend.trim());
    } catch (e) {
      alert(e.message);
    } finally {
      setSyncingHealth(false);
    }
  };

  const calculateValue = (clientX) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    let x = clientX - rect.left;
    if (x < 0) x = 0;
    if (x > rect.width) x = rect.width;
    
    let newValue = Math.ceil((x / rect.width) * 10);
    if (newValue < 1) newValue = 1;
    if (newValue > 10) newValue = 10;
    
    if (String(newValue) !== String(score)) {
      onScoreChange(String(newValue));
    }
  };

  const handlePointerDown = (e) => {
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }
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
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    };
  }, []);

  const getRpeColor = (val) => {
    if (val <= 3) return 'bg-green-500';
    if (val <= 6) return 'bg-yellow-400';
    if (val <= 8) return 'bg-orange-500';
    return 'bg-red-500';
  }
  const getRpeLabel = (val) => {
    if (val <= 3) return 'Molto leggero 🟢';
    if (val <= 6) return 'Moderato 🟡';
    if (val <= 8) return 'Impegnativo 🟠';
    return 'Massimale 🔴';
  }
  return (
    <div className="fixed inset-0 bg-black/85 z-[150] flex items-center justify-center p-4">
      <div className={`bg-[#1e1e1e] border border-[#2a2a2a] rounded-3xl w-full max-w-sm p-6 flex flex-col shadow-2xl animate-in fade-in zoom-in-[0.96] duration-300 ease-out transition-transform ${isFocused ? '-translate-y-36' : ''}`}>
        <h2 className="text-2xl font-black text-white mb-2 tracking-tight">Com'è andata?</h2>
        <p className="text-gray-400 text-sm mb-6">Valuta lo sforzo percepito (RPE) e aggiungi eventuali note per il coach.</p>
        <div className="flex flex-col gap-2 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-white font-bold">Sforzo: {score}/10</span>
            <span className={`text-xs font-bold px-2 py-1 rounded-md text-black ${getRpeColor(parseInt(score))}`}>
              {getRpeLabel(parseInt(score))}
            </span>
          </div>
          <div 
            ref={containerRef}
            className="flex items-center gap-1 w-full cursor-pointer touch-none select-none"
            onMouseDown={handlePointerDown}
            onMouseMove={handlePointerMove}
            onTouchStart={handlePointerDown}
            onTouchMove={handlePointerMove}
          >
            {Array.from({ length: 10 }, (_, i) => i + 1).map(s => {
              const isActive = s <= parseInt(score);
              let color = 'bg-[#333]';
              if (isActive) color = getRpeColor(parseInt(score));
              return (
                <div
                  key={s}
                  className={`flex-1 h-10 rounded-md transition-all duration-75 ${color} ${isActive ? 'shadow-md scale-105' : ''}`}
                  style={{ pointerEvents: 'none' }}
                />
              )
            })}
          </div>
          <div className="flex justify-between items-center text-[11px] font-bold uppercase tracking-wider text-gray-500 mt-1">
            <span>Leggero</span>
            <span>Estremo</span>
          </div>
        </div>
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <label className="text-white font-bold text-sm">Note sull'allenamento</label>
            <button 
              onClick={handleHealthSync} 
              disabled={syncingHealth}
              className="text-[11px] flex items-center gap-1 bg-[#2a2a2a] hover:bg-[#333] text-gray-300 px-2 py-1 rounded-md border border-[#444] transition disabled:opacity-50"
            >
              {syncingHealth ? 'Sincro in corso...' : '🍏 Apple Health'}
            </button>
          </div>
          <textarea
            className="w-full bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-[#f1ba17] resize-none text-base transition-colors"
            rows={3}
            placeholder="Sensazioni, pesi usati, dolori..."
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
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
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={saving} className="flex-1 py-3.5 bg-[#2a2a2a] text-white font-semibold rounded-xl hover:bg-[#333] transition disabled:opacity-50">Annulla</button>
          <button onClick={onSave} disabled={saving} className="flex-1 py-3.5 bg-[#f1ba17] text-black font-black rounded-xl hover:brightness-110 transition disabled:opacity-50 shadow-lg shadow-[#f1ba17]/20">{saving ? '...' : 'Fatto! 🎉'}</button>
        </div>
      </div>
    </div>
  )
}