import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { ChevronLeft, ChevronUp, User, Upload, BookOpen, Trash2, AlertTriangle, Plus, Edit, X, Download, Dumbbell, Search, CheckCircle2, Circle, Trophy, Timer, Flame, FolderArchive, ChevronRight, Copy, Activity, CalendarDays, LayoutList, Mic, Play, Pause, Send, Square, Check, Eye, LineChart, Target, PieChart, BarChart2 } from 'lucide-react'
import { format, parseISO, differenceInYears, isBefore, startOfDay, isValid, eachDayOfInterval, startOfMonth, endOfMonth, isSameDay, isToday, differenceInDays, startOfWeek } from 'date-fns'
import { it } from 'date-fns/locale'
import { CustomAlert, CustomConfirm } from '../components/CustomModals'
import CustomDatePicker from '../components/CustomDatePicker'
import { useAuth } from '../App'
import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { VoiceRecorder as NativeVoiceRecorder } from '@independo/capacitor-voice-recorder'
import { generaTitolo, titoloOppureGenerato, titoliDelGiorno } from '../lib/workoutTitle'
import { parseNotesAndRpe, formatNotesWithRpe } from '../lib/rpe'
import { mostraErrore } from '../lib/alert'

const getRpeColorText = (val) => {
  if (val <= 3) return 'text-green-500';
  if (val <= 6) return 'text-yellow-400';
  if (val <= 8) return 'text-orange-500';
  return 'text-red-500';
}

const InstagramIcon = ({ size = 24, className = "" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5"></rect>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"></line>
  </svg>
)

const isVoiceNoteValid = (url) => {
  if (!url) return false
  if (url.includes('#deleted=')) return false
  return true
}

// Helper per calcolare l'età
const calculateAge = (dob) => {
  if (!dob) return 'N/A'
  return differenceInYears(new Date(), parseISO(dob))
}

export default function AthleteDetail() {
  const { id: paramId } = useParams()
  const { role, user } = useAuth()
  const id = paramId || user?.id
  const navigate = useNavigate()
  const isOwnProfile = id === user?.id
  const [athlete, setAthlete] = useState(null)
  const [workouts, setWorkouts] = useState([])
  const [prs, setPrs] = useState([])
  const [tab, setTab] = useState('workouts') // 'workouts' | 'prs' | 'stats'
  const [workoutView, setWorkoutView] = useState('list') // 'list' | 'calendar'
  const [showHistory, setShowHistory] = useState(false)
  const [loading, setLoading] = useState(true)
  const [workoutToRemove, setWorkoutToRemove] = useState(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [socialModalType, setSocialModalType] = useState(null)
  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [prModalOpen, setPrModalOpen] = useState(false)
  const [editingPr, setEditingPr] = useState(null)
  const [alertInfo, setAlertInfo] = useState(null)
  const [confirmInfo, setConfirmInfo] = useState(null)

  const [autonomousModalOpen, setAutonomousModalOpen] = useState(false)
  const [autonomousForm, setAutonomousForm] = useState({ title: '', date: format(new Date(), 'yyyy-MM-dd'), notes: '', id: null, awId: null })
  const [savingAutonomous, setSavingAutonomous] = useState(false)

  const [showRpeModal, setShowRpeModal] = useState(false)
  const [workoutToComplete, setWorkoutToComplete] = useState(null)
  const [rpeScore, setRpeScore] = useState('5')
  const [rpeNotes, setRpeNotes] = useState('')
  const [savingRpe, setSavingRpe] = useState(false)
  const [weeklyStats, setWeeklyStats] = useState({ time: 0, completed: 0, avgRpe: '-' })

  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState(new Date())

  useEffect(() => {
    if (role === 'athlete' && !isOwnProfile) {
      navigate('/')
      return
    }
    fetchAthleteData()
  }, [id, role, isOwnProfile, navigate])

  async function fetchAthleteData(silent = false) {
    if (!silent) setLoading(true)
    
    const [
      { data: athleteData, error: athleteError },
      { data: workoutHistory, error: historyError },
      { data: prsData, error: prsError }
    ] = await Promise.all([
      supabase.from('athletes').select('*').eq('id', id).single(),
      supabase.from('athlete_workouts').select(`id, completed_date, notes, voice_note_url, status, workouts (id, title, sections)`).eq('athlete_id', id).order('completed_date', { ascending: false }),
      supabase.from('personal_records').select('*').eq('athlete_id', id).order('date', { ascending: false })
    ])

    if (athleteError) {
      console.error("Errore nel caricare l'atleta:", athleteError)
      if (!silent) setLoading(false)
      return
    }
    setAthlete(athleteData)

    if (historyError) console.error("Errore nel caricare lo storico workout:", historyError)
    else {
      setWorkouts((workoutHistory || []).map(w => ({
        ...w,
        voice_note_url: isVoiceNoteValid(w.voice_note_url) ? w.voice_note_url : null
      })))
    }

    if (prsError && prsError.code !== '42P01' && prsError.code !== 'PGRST205') console.error("Errore PR:", prsError)
    else setPrs(prsData || [])

    if (!silent) setLoading(false)
  }

  useEffect(() => {
    if (!workouts || workouts.length === 0) return;
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
    const weekStartStr = format(weekStart, 'yyyy-MM-dd')
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)
    const weekEndStr = format(weekEnd, 'yyyy-MM-dd')

    const weekData = workouts.filter(w => w.completed_date >= weekStartStr && w.completed_date <= weekEndStr)

    let time = 0
    let completed = 0
    let rpeSum = 0
    let rpeCount = 0

    const parseTime = (val) => {
      if (!val || val === '-') return 0
      const s = String(val).toLowerCase()
      if (s.includes('sec')) return (parseInt(s) || 0) / 60
      if (s.includes('min')) {
        const parts = s.replace('min', '').trim().split(':')
        if (parts.length === 2) return parseInt(parts[0]) + parseInt(parts[1])/60
        return parseInt(s) || 0
      }
      const parts = s.split(':')
      if (parts.length === 2) return parseInt(parts[0]) + parseInt(parts[1])/60
      return parseInt(s) || 0
    }

    weekData.forEach(w => {
      if (w.status === 'completed') {
        completed++
        const parsed = parseNotesAndRpe(w.notes)
        const rpeVal = parseInt(parsed.rpe)
        if (!isNaN(rpeVal)) { rpeSum += rpeVal; rpeCount++ }

        const s = w.workouts?.sections || {}
        const cat = s.category || (s.steps ? 'Running' : 'Hyrox')
        let workoutTime = 0
        if (cat === 'Running') {
          const steps = s.steps || s.main?.steps || []
          steps.forEach(step => {
            if (step.type === 'repeat') {
              const rounds = parseInt(step.rounds) || 1
              workoutTime += parseTime(step.runDuration) * rounds
              workoutTime += parseTime(step.recDuration) * rounds
            } else {
              let stepTime = parseTime(step.duration)
              if (stepTime === 0 && step.duration) {
                const ds = String(step.duration).toLowerCase()
                if (ds.includes('km')) stepTime = parseFloat(ds) * 6
                else if (ds.includes('m')) stepTime = (parseInt(ds) || 0) / 1000 * 6
              }
              workoutTime += stepTime
            }
          })
        } else {
          let blocks = s.blocks || []
          if (blocks.length === 0) {
            if (s.warmup) blocks.push({type: 'WarmUp', params: { duration: s.warmup.duration }})
            if (s.cashIn && s.cashIn.length > 0) blocks.push({type: 'Cash In', exercises: s.cashIn})
            if (s.main) blocks.push({type: s.main.type === 'EMOM' && s.main.params?.on ? 'ON/OFF' : s.main.type, params: s.main.params || {}, exercises: s.main.exercises || []})
            if (s.cashOut && s.cashOut.length > 0) blocks.push({type: 'Cash Out', exercises: s.cashOut})
          }
          blocks.forEach(b => {
            let blockRounds = parseInt(b.params?.rounds) || 1
            if (b.type === 'ON/OFF') workoutTime += (parseTime(b.params?.on) + parseTime(b.params?.off)) * blockRounds
            else if (b.type === 'EMOM') workoutTime += parseTime(b.params?.interval) * blockRounds
            else if (b.type === 'AMRAP' || b.type === 'WarmUp' || b.type === 'Rest') workoutTime += parseTime(b.params?.duration)
            else if (b.type === 'For Time') workoutTime += 15 * blockRounds
            else if (b.type === 'Cash In' || b.type === 'Cash Out') workoutTime += 5 * blockRounds
            ;(b.exercises || []).forEach(ex => { if (b.type === 'Interval') workoutTime += parseTime(ex.exTime) * blockRounds })
          })
        }
        if (workoutTime === 0) workoutTime = 45;
        time += workoutTime
      }
    })
    setWeeklyStats({ time: Math.round(time), completed, avgRpe: rpeCount > 0 ? (rpeSum / rpeCount).toFixed(1) : '-' })
  }, [workouts])

  const uploadVoiceNote = async (athleteWorkoutId, audioBlob, ext) => {
    const fileName = `voice_${athleteWorkoutId}_${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage.from('voice-notes').upload(fileName, audioBlob, { contentType: audioBlob.type })
    if (uploadError) return setAlertInfo({ title: 'Errore', message: 'Caricamento fallito: ' + uploadError.message, type: 'error' })
    const { data: urlData } = supabase.storage.from('voice-notes').getPublicUrl(fileName)
    const { error } = await supabase.from('athlete_workouts').update({ voice_note_url: urlData.publicUrl }).eq('id', athleteWorkoutId)
    if (!error) {
      setWorkouts(workouts.map(w => w.id === athleteWorkoutId ? { ...w, voice_note_url: urlData.publicUrl } : w))
      if (role === 'admin') {
        supabase.functions.invoke('send-reminders', {
          body: { mode: 'voice_note', record_id: athleteWorkoutId }
        }).catch(console.error)
      }
    } else setAlertInfo({ title: 'Errore', message: error.message, type: 'error' })
  }

  const deleteVoiceNote = async (athleteWorkoutId) => {
    setConfirmInfo({
      title: "Elimina nota vocale",
      message: "La nota verrà nascosta dall'app, ma per sicurezza rimarrà nel database per 24 ore prima di essere eliminata definitivamente.",
      onConfirm: async () => {
        setConfirmInfo(null)
        const workout = workouts.find(w => w.id === athleteWorkoutId)
        if (workout?.voice_note_url) {
          const deletedUrl = workout.voice_note_url + '#deleted=' + Date.now()
          const { error } = await supabase.from('athlete_workouts').update({ voice_note_url: deletedUrl }).eq('id', athleteWorkoutId)
          if (error) {
            setAlertInfo({ title: 'Errore', message: error.message, type: 'error' })
          } else {
            setWorkouts(workouts.map(w => w.id === athleteWorkoutId ? { ...w, voice_note_url: null } : w))
          }
        }
      }
    })
  }

  const toggleWorkoutStatus = async (id, currentStatus, scheduledDateStr) => {
    const w = workouts.find(wo => wo.id === id)

    if (currentStatus === 'completed') {
      const { error } = await supabase.from('athlete_workouts').update({ status: 'pending' }).eq('id', id)
      if (!error) {
        setWorkouts(prev => prev.map(wk => wk.id === id ? { ...wk, status: 'pending' } : wk))
      }
      return
    }

    const scheduledDate = startOfDay(parseISO(scheduledDateStr))
    const today = startOfDay(new Date())
    if (isBefore(today, scheduledDate)) {
      setConfirmInfo({
        title: 'Attenzione',
        message: 'Questo allenamento è programmato per una data futura. Vuoi davvero segnarlo come completato oggi?',
        onConfirm: () => { 
          setConfirmInfo(null);
          setWorkoutToComplete(w);
          const parsed = parseNotesAndRpe(w.notes);
          setRpeNotes(parsed.text);
          setRpeScore(parsed.rpe);
          setShowRpeModal(true);
        }
      })
      return
    }

    setWorkoutToComplete(w);
    const parsed = parseNotesAndRpe(w.notes);
    setRpeNotes(parsed.text);
    setRpeScore(parsed.rpe);
    setShowRpeModal(true);
  }

  const handleRpeSubmitAthleteDetail = async () => {
    setSavingRpe(true)
    const newStatus = 'completed'
    const finalNote = formatNotesWithRpe(rpeScore, rpeNotes)

    const { error } = await supabase
      .from('athlete_workouts')
      .update({ status: newStatus, notes: finalNote })
      .eq('id', workoutToComplete.id)
    
    setSavingRpe(false)

    if (!error) {
      setWorkouts(prev => prev.map(w => w.id === workoutToComplete.id ? { ...w, status: newStatus, notes: finalNote } : w))
      setShowRpeModal(false)

      if (role === 'athlete') {
        supabase.functions.invoke('send-reminders', {
          body: { mode: 'coach_notification', action: 'completed', athleteName: `${athlete.name} ${athlete.surname}`, workoutTitle: workoutToComplete.workouts?.title || 'Workout', route: `/workout/${workoutToComplete.workouts?.id || workoutToComplete.id}?athlete_id=${athlete.id}` }
        }).catch(console.error)
      }
      setWorkoutToComplete(null)
    } else {
      setAlertInfo({ title: 'Errore', message: error.message, type: 'error' })
    }
  }

  const updateWorkoutNote = async (workoutId, notes, workoutTitle) => {
    const { error } = await supabase
      .from('athlete_workouts')
      .update({ notes })
      .eq('id', workoutId)
    
    if (!error) {
      setWorkouts(workouts.map(w => w.id === workoutId ? { ...w, notes } : w))
        if (role === 'athlete') {
          supabase.functions.invoke('send-reminders', {
            body: { mode: 'coach_notification', action: 'note', athleteName: `${athlete.name} ${athlete.surname}`, workoutTitle: workoutTitle || 'Workout', noteText: notes, route: `/workout/${workoutId}?athlete_id=${id}` }
          }).catch(console.error)
        }
    } else {
      setAlertInfo({ title: 'Errore', message: "Errore durante il salvataggio della nota: " + error.message, type: 'error' })
    }
  }

  const openEditAutonomous = (aw) => {
    setAutonomousForm({
      title: aw.workouts?.title || '',
      date: aw.completed_date,
      notes: aw.notes || '',
      id: aw.workouts?.id,
      awId: aw.id
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

        const { error: awError } = await supabase.from('athlete_workouts').update({ completed_date: autonomousForm.date, notes: autonomousForm.notes }).eq('id', autonomousForm.awId)
        if (awError) throw awError
      } else {
        const { data: newW, error: wError } = await supabase.from('workouts').insert({
          title: titoloFinale,
          date: autonomousForm.date,
          sections: { category: 'Custom', isAutonomous: true }
        }).select().single()
        if (wError) throw wError

        const { error: awError } = await supabase.from('athlete_workouts').insert({ athlete_id: id, workout_id: newW.id, completed_date: autonomousForm.date, status: 'completed', notes: autonomousForm.notes })
        if (awError) throw awError
      }
      
      if (role === 'athlete' && !autonomousForm.id) {
         supabase.functions.invoke('send-reminders', {
           body: { mode: 'coach_notification', action: 'custom_workout', athleteName: `${athlete.name} ${athlete.surname}`, workoutTitle: titoloFinale, route: `/workout/${newW.id}?athlete_id=${id}` }
         }).catch(console.error)
      }
      setAutonomousModalOpen(false)
      setAutonomousForm({ title: '', date: format(new Date(), 'yyyy-MM-dd'), notes: '', id: null, awId: null })
      fetchAthleteData(true)
    } catch (err) {
      setAlertInfo({ title: 'Errore', message: err.message, type: 'error' })
    }
    setSavingAutonomous(false)
  }

  const requestRemoveWorkout = (athleteWorkoutId) => {
    setWorkoutToRemove(athleteWorkoutId)
  }

  const confirmRemoveWorkout = async () => {
    if (!workoutToRemove) return
    
    const { error } = await supabase
      .from('athlete_workouts')
      .delete()
      .eq('id', workoutToRemove)
      
    if (!error) {
      setWorkouts(workouts.filter(w => w.id !== workoutToRemove))
    } else {
      setAlertInfo({ title: 'Errore', message: "Errore durante la rimozione: " + error.message, type: 'error' })
    }
    setWorkoutToRemove(null)
  }

  const handleExportData = async () => {
    const exportData = {
      athlete: athlete,
      workouts: workouts
    }
    const fileName = `Backup_${athlete.name}_${athlete.surname}.json`
    const dataStr = JSON.stringify(exportData, null, 2)
    if (Capacitor.isNativePlatform()) {
      try {
        const result = await Filesystem.writeFile({
          path: fileName,
          data: dataStr,
          directory: Directory.Cache,
          encoding: Encoding.UTF8
        })
        await Share.share({ title: `Backup ${athlete.name}`, files: [result.uri] })
      } catch (err) {
        setAlertInfo({ title: 'Errore', message: "Errore esportazione: " + err.message, type: 'error' })
      }
    } else {
      const blob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const linkElement = document.createElement('a')
      linkElement.setAttribute('href', url)
      linkElement.setAttribute('download', fileName)
      linkElement.click()
      URL.revokeObjectURL(url)
    }
  }

  const handleDeletePr = async (prId) => {
    const { error } = await supabase.from('personal_records').delete().eq('id', prId)
    if (!error) {
      setPrs(prs.filter(p => p.id !== prId))
      setAlertInfo({ title: 'Eliminato', message: 'Record personale rimosso.', type: 'success' })
    } else {
      setAlertInfo({ title: 'Errore', message: error.message, type: 'error' })
    }
  }

  if (loading) return <div className="p-6 text-muted">Caricamento scheda atleta...</div>
  if (!athlete) return <div className="p-6 text-red-400">Atleta non trovato.</div>

  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const todayWorkoutsList = workouts.filter(w => w.completed_date === todayStr)
  const upcomingWorkoutsList = workouts.filter(w => w.completed_date > todayStr && w.workouts?.sections?.category !== 'Event').reverse()
  const pastWorkoutsList = workouts.filter(w => w.completed_date < todayStr)

  const upcomingEvents = workouts.filter(w => w.workouts?.sections?.category === 'Event' && w.completed_date >= todayStr).sort((a, b) => a.completed_date.localeCompare(b.completed_date))
  const nextEvent = upcomingEvents[0]
  let countdownDays = null
  if (nextEvent) {
    countdownDays = differenceInDays(parseISO(nextEvent.completed_date), startOfDay(new Date()))
  }

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth)
  })
  const firstDayOfMonth = startOfMonth(currentMonth).getDay()
  const offset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1
  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))

  return (
    <div className="px-4 max-w-2xl mx-auto pb-[calc(6rem+env(safe-area-inset-bottom))] pt-[calc(env(safe-area-inset-top)+1rem)] page-transition">
      {role !== 'athlete' && !isOwnProfile ? (
        <div className="mb-6 mt-4 flex items-center gap-3">
          <button aria-label="Torna alla lista atleti" onClick={() => navigate('/athletes')} className="w-11 h-11 bg-[#1e1e1e] border border-[#333] rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:border-[#f1ba17] transition shadow-sm shrink-0">
            <ChevronLeft size={22} className="-ml-0.5" />
          </button>
          <h1 className="text-3xl font-black text-white tracking-tight">FLEO<span className="text-[#f1ba17]">FIT</span></h1>
        </div>
      ) : (
        <div className="mb-6 mt-4 flex items-center gap-3"><h1 className="text-3xl font-black text-white tracking-tight">FLEO<span className="text-[#f1ba17]">FIT</span></h1></div>
      )}

      {/* Header Atleta */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-5">
          <div className="relative shrink-0">
            {athlete.photo_url ? (
              <img src={athlete.photo_url} alt={`${athlete.name}`} className="w-24 h-24 rounded-full object-cover border-2 border-[#333] shrink-0" onError={() => setAthlete({ ...athlete, photo_url: null })} />
            ) : (
              <div className="w-24 h-24 rounded-full bg-[#2a2a2a] flex items-center justify-center border-2 border-[#333] shrink-0">
                <User size={48} className="text-muted" />
              </div>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{athlete.name} {athlete.surname}</h1>
            {athlete.username && <p className="text-gray-400">@{athlete.username}</p>}
            {athlete.notes && <p className="text-muted text-sm mt-1 max-w-sm whitespace-pre-wrap">{athlete.notes}</p>}
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {athlete.instagram_url ? (
                <a href={athlete.instagram_url.startsWith('http') ? athlete.instagram_url : `https://instagram.com/${athlete.instagram_url.replace(/^@/, '')}`} target="_blank" rel="noopener noreferrer" title="Instagram" className="flex items-center justify-center w-8 h-8 bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 text-white rounded-full hover:opacity-80 transition shadow-md shadow-pink-500/20"><InstagramIcon size={16} /></a>
              ) : (
                <button aria-label="Aggiungi il profilo Instagram" onClick={() => setSocialModalType('instagram')} title="Aggiungi Instagram" className="flex items-center justify-center w-11 h-11 bg-[#2a2a2a] text-gray-400 rounded-full hover:text-pink-500 hover:border-pink-500/50 transition border border-[#383838]"><InstagramIcon size={16} /></button>
              )}
              {athlete.strava_url ? (
                <a href={athlete.strava_url} target="_blank" rel="noopener noreferrer" title="Strava" className="flex items-center justify-center w-8 h-8 bg-[#fc4c02] text-white rounded-full hover:opacity-80 transition shadow-md shadow-[#fc4c02]/20"><Activity size={16} /></a>
              ) : (
                <button aria-label="Aggiungi il profilo Strava" onClick={() => setSocialModalType('strava')} title="Aggiungi Strava" className="flex items-center justify-center w-11 h-11 bg-[#2a2a2a] text-gray-400 rounded-full hover:text-[#fc4c02] hover:border-[#fc4c02]/50 transition border border-[#383838]"><Activity size={16} /></button>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {role !== 'athlete' && (
            <button aria-label="Esporta i dati dell'atleta" onClick={handleExportData} className="p-2 bg-[#2a2a2a] border border-[#383838] rounded-xl text-gray-400 hover:text-white hover:border-[#f1ba17] transition" title="Esporta Backup Atleta">
              <Download size={20} />
            </button>
          )}
          <button aria-label="Modifica la scheda atleta" onClick={() => setShowEditModal(true)} className="p-2 bg-[#2a2a2a] border border-[#383838] rounded-xl text-gray-400 hover:text-white hover:border-[#f1ba17] transition" title="Modifica profilo atleta">
            <Edit size={20} />
          </button>
        </div>
      </div>

      {/* BANNER PROSSIMO EVENTO/GARA */}
      {nextEvent && (
        <div 
          onClick={() => navigate(`/workout/${nextEvent.workouts.id}?athlete_id=${id}`)}
          className="bg-gradient-to-r from-[#2a2a2a] to-[#111] border border-[#f1ba17]/30 rounded-3xl p-5 mb-6 flex items-center justify-between shadow-lg shadow-[#f1ba17]/10 cursor-pointer hover:border-[#f1ba17]/60 transition group"
        >
           <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#f1ba17]/10 rounded-full flex items-center justify-center text-[#f1ba17] shrink-0 shadow-inner group-hover:scale-110 transition-transform">
                 <CalendarDays size={24} />
              </div>
              <div>
                 <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-0.5">Prossimo Obiettivo</p>
                 <p className="text-white font-black text-xl leading-tight group-hover:text-[#f1ba17] transition-colors">{nextEvent.workouts.title}</p>
                 <p className="text-[#f1ba17]/80 text-sm mt-0.5 font-medium">{format(parseISO(nextEvent.completed_date), 'EEEE d MMMM yyyy', { locale: it })}</p>
              </div>
           </div>
           <div className="flex flex-col items-center justify-center bg-gradient-to-br from-[#f1ba17] to-yellow-600 rounded-2xl px-5 py-2.5 shadow-xl min-w-[80px]">
              <span className="text-3xl font-black text-black leading-none">{countdownDays}</span>
              <span className="text-black/80 text-[11px] font-bold uppercase tracking-wider mt-1">{countdownDays === 1 ? 'giorno' : 'giorni'}</span>
           </div>
        </div>
      )}

      {/* Statistiche */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <StatCard label="Età" value={calculateAge(athlete.birth_date)} />
        <StatCard label="Altezza" value={athlete.height ? `${athlete.height} cm` : 'N/A'} />
        <StatCard label="Peso" value={athlete.weight ? `${athlete.weight} kg` : 'N/A'} />
        <StatCard label="Workouts" value={workouts.length} />
      </div>

      {/* Statistiche della Settimana */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-bold text-sm">Statistiche della settimana</h3>
          <Activity size={16} className="text-[#f1ba17]" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-2xl p-4 flex flex-col gap-1 justify-center items-center text-center">
            <p className="text-muted text-[11px] font-bold uppercase tracking-wider">Tempo</p>
            <p className="text-white font-black text-2xl">{weeklyStats.time}<span className="text-sm font-medium text-muted ml-0.5">m</span></p>
          </div>
          <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-2xl p-4 flex flex-col gap-1 justify-center items-center text-center">
            <p className="text-muted text-[11px] font-bold uppercase tracking-wider">Workout Completati</p>
            <p className="text-[#f1ba17] font-black text-2xl">{weeklyStats.completed}</p>
          </div>
          <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-2xl p-4 flex flex-col gap-1 justify-center items-center text-center">
            <p className="text-muted text-[11px] font-bold uppercase tracking-wider">RPE</p>
            <p className="text-white font-black text-2xl">{weeklyStats.avgRpe}<span className="text-sm font-medium text-muted ml-0.5">/10</span></p>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div className="flex gap-6 mb-6 border-b border-[#2a2a2a] overflow-x-auto hide-scrollbar">
        <button onClick={() => { setTab('workouts'); setShowHistory(false); }} className={`pb-3 border-b-2 font-semibold text-sm transition whitespace-nowrap ${tab === 'workouts' ? 'border-[#f1ba17] text-[#f1ba17]' : 'border-transparent text-muted hover:text-white'}`}>
          Diario
        </button>
        <button onClick={() => { setTab('prs'); setShowHistory(false); }} className={`pb-3 border-b-2 font-semibold text-sm transition whitespace-nowrap ${tab === 'prs' ? 'border-[#f1ba17] text-[#f1ba17]' : 'border-transparent text-muted hover:text-white'}`}>
          Personal Record
        </button>
        <button onClick={() => { setTab('stats'); setShowHistory(false); }} className={`pb-3 border-b-2 font-semibold text-sm transition whitespace-nowrap ${tab === 'stats' ? 'border-[#f1ba17] text-[#f1ba17]' : 'border-transparent text-muted hover:text-white'}`}>
          Statistiche
        </button>
      </div>

      {tab === 'workouts' ? (
        showHistory ? (
          <div className="flex flex-col gap-6 animate-in slide-in-from-right-4 duration-300">
            <div>
              <button onClick={() => setShowHistory(false)} className="flex items-center gap-1 text-[#f1ba17] hover:brightness-110 transition-all font-semibold text-sm mb-6 w-fit">
                <ChevronLeft size={20} className="-ml-1" /> Torna al Diario
              </button>
              <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
                <FolderArchive size={22} className="text-gray-400" />
                Storico Allenamenti
              </h2>
              <div className="flex flex-col gap-3">
                {pastWorkoutsList.map(entry => (
                  <WorkoutEntryCard 
                    key={entry.id} 
                    entry={entry} 
                    onToggleStatus={toggleWorkoutStatus} 
                    onUpdateNote={updateWorkoutNote} 
                    onRemove={requestRemoveWorkout}
                    navigate={navigate}
                    athleteId={id}
                    role={role}
                    onUploadVoiceNote={uploadVoiceNote}
                    onDeleteVoiceNote={deleteVoiceNote}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : (
        <div className="flex flex-col gap-6 animate-in fade-in duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <BookOpen size={22} className="text-[#f1ba17]" />
              Diario Workout
            </h2>
            {role !== 'athlete' && (
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setAssignModalOpen(true)}
                  className="flex flex-1 sm:flex-none items-center justify-center gap-1.5 text-black text-sm font-bold bg-[#f1ba17] px-4 py-2.5 rounded-xl transition hover:brightness-110 shadow-lg shadow-[#f1ba17]/20"
                >
                  <Dumbbell size={16} /> Assegna
                </button>
                <button 
                  onClick={() => navigate(`/create?athlete_id=${id}`)}
                  className="flex flex-1 sm:flex-none items-center justify-center gap-1.5 text-[#f1ba17] text-sm font-bold bg-[#f1ba17]/10 border border-[#f1ba17]/30 px-4 py-2.5 rounded-xl transition hover:brightness-110"
                >
                  <Plus size={16} /> Crea
                </button>
              </div>
            )}
          </div>
          
          {role !== 'athlete' && (
            <div className="relative flex bg-[#111] p-1.5 rounded-2xl border border-[#333]">
              <div 
                className={`absolute top-1.5 bottom-1.5 left-1.5 w-[calc(50%-0.375rem)] bg-[#2a2a2a] rounded-xl shadow-md transition-transform duration-300 ease-out ${
                  workoutView === 'list' ? 'translate-x-0' : 'translate-x-full'
                }`}
              />
              <button 
                onClick={() => setWorkoutView('list')}
                className={`relative z-10 flex-1 flex justify-center items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors duration-300 ${workoutView === 'list' ? 'text-white' : 'text-muted hover:text-gray-300'}`}
              >
                <LayoutList size={18} /> Elenco
              </button>
              <button 
                onClick={() => setWorkoutView('calendar')}
                className={`relative z-10 flex-1 flex justify-center items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors duration-300 ${workoutView === 'calendar' ? 'text-[#f1ba17]' : 'text-muted hover:text-gray-300'}`}
              >
                <CalendarDays size={18} /> Calendario
              </button>
            </div>
          )}
          
          <div key={workoutView} className={`animate-in fade-in zoom-in-[0.98] duration-300 ease-out fill-mode-both ${workoutView === 'list' ? 'slide-in-from-left-4' : 'slide-in-from-right-4'}`}>
            {role !== 'athlete' && workoutView === 'calendar' ? (
              <div className="flex flex-col bg-[#1e1e1e] border border-[#2a2a2a] rounded-3xl p-5 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white capitalize">
                  {format(currentMonth, 'MMMM yyyy', { locale: it })}
                </h2>
                <div className="flex items-center gap-2">
                  <button aria-label="Mese precedente" onClick={prevMonth} className="p-2 rounded-xl bg-[#222] hover:bg-[#2a2a2a] text-gray-400 hover:text-white transition">
                    <ChevronLeft size={18} />
                  </button>
                  <button onClick={() => { setCurrentMonth(new Date()); setSelectedDay(new Date()); }} className="px-3 py-1.5 rounded-xl bg-[#222] hover:bg-[#2a2a2a] text-gray-400 hover:text-white text-sm transition">
                    Oggi
                  </button>
                  <button aria-label="Mese successivo" onClick={nextMonth} className="p-2 rounded-xl bg-[#222] hover:bg-[#2a2a2a] text-gray-400 hover:text-white transition">
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 mb-2">
                {['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((d, i) => (
                  <div key={i} className="text-center text-gray-400 text-xs font-medium py-1">{d}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1 mb-6">
                {Array.from({ length: offset }).map((_, i) => <div key={`empty-${i}`} />)}
                {days.map(day => {
                  const dayStr = format(day, 'yyyy-MM-dd')
                  const dayWorkoutsList = workouts.filter(w => w.completed_date === dayStr)
                  const hasWorkout = dayWorkoutsList.length > 0
                  const selected = format(selectedDay, 'yyyy-MM-dd') === dayStr
                  const today = format(new Date(), 'yyyy-MM-dd') === dayStr

                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => setSelectedDay(day)}
                      className={`relative flex flex-col items-center justify-start pt-1.5 pb-1 rounded-xl aspect-square transition ${selected ? 'bg-[#f1ba17]' : today ? 'bg-[#2a2a2a]' : 'bg-[#111] hover:bg-[#2a2a2a] border border-[#222]'}`}
                    >
                      <span className={`text-sm font-medium leading-none ${selected ? 'text-black' : today ? 'text-[#f1ba17]' : 'text-white'}`}>
                        {format(day, 'd')}
                      </span>
                      {hasWorkout && (
                        <div className="flex gap-0.5 mt-1">
                          {dayWorkoutsList.slice(0, 3).map((w, i) => {
                            const cat = w.workouts?.sections?.category || 'Hyrox'
                            const isCustom = cat === 'Custom' || cat === 'Autonomo' || w.workouts?.sections?.isAutonomous === true
                            const isEvent = cat === 'Event' || w.workouts?.sections?.isEvent === true
                            const color = isEvent ? '#ffffff' : (cat === 'Running' ? '#0094C6' : (isCustom ? '#D11149' : '#f1ba17'))
                            return <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: selected ? '#000' : color }} />
                          })}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>

              <div className="pt-4 border-t border-[#2a2a2a]">
                <h3 className="text-white font-semibold mb-3">
                  {format(selectedDay, 'EEEE d MMMM', { locale: it })}
                </h3>
                {workouts.filter(w => w.completed_date === format(selectedDay, 'yyyy-MM-dd')).length === 0 ? (
                    <div className="bg-[#111] border border-[#2a2a2a] rounded-2xl p-6 text-center">
                     <p className="text-gray-400 text-sm">Nessun workout in questa data.</p>
                   </div>
                ) : (
                    <div className="flex flex-col gap-3">
                     {workouts.filter(w => w.completed_date === format(selectedDay, 'yyyy-MM-dd')).map(w => (
                       <WorkoutEntryCard key={w.id} entry={w} onToggleStatus={toggleWorkoutStatus} onUpdateNote={updateWorkoutNote} onRemove={requestRemoveWorkout} navigate={navigate} athleteId={id} role={role} onEditAutonomous={openEditAutonomous} />
                     ))}
                   </div>
                )}
              </div>
            </div>
          ) : workouts.length > 0 ? (
              <div className="flex flex-col gap-8">
              {todayWorkoutsList.length > 0 && (
                <div>
                  <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                     <span className="w-2 h-2 rounded-full bg-[#f1ba17]"></span> Oggi
                  </h3>
                  <div className="flex flex-col gap-3">
                    {todayWorkoutsList.map(entry => (
                      <TodayAthleteWorkoutCard 
                        key={entry.id} 
                        entry={entry} 
                        onToggleStatus={toggleWorkoutStatus} 
                        onUpdateNote={updateWorkoutNote}
                        onRemove={requestRemoveWorkout}
                        navigate={navigate}
                        athleteId={id}
                        role={role}
                        onUploadVoiceNote={uploadVoiceNote}
                        onDeleteVoiceNote={deleteVoiceNote}
                        onEditAutonomous={openEditAutonomous}
                      />
                    ))}
                  </div>
                </div>
              )}

              {upcomingWorkoutsList.length > 0 && (
                <div>
                  <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                     <span className="w-2 h-2 rounded-full bg-blue-500"></span> Prossimi allenamenti
                  </h3>
                  <div className="flex flex-col gap-3">
                    {upcomingWorkoutsList.map(entry => (
                      <WorkoutEntryCard 
                        key={entry.id} 
                        entry={entry} 
                        onToggleStatus={toggleWorkoutStatus} 
                        onUpdateNote={updateWorkoutNote} 
                        onRemove={requestRemoveWorkout}
                        navigate={navigate}
                        athleteId={id}
                        onUploadVoiceNote={uploadVoiceNote}
                        onDeleteVoiceNote={deleteVoiceNote}
                        role={role}
                      />
                    ))}
                  </div>
                </div>
              )}

              {pastWorkoutsList.length > 0 && (
                <button 
                  onClick={() => setShowHistory(true)}
                  className="w-full flex items-center justify-between p-4 bg-[#1e1e1e] border border-[#2a2a2a] rounded-2xl hover:border-[#444] transition group mt-2"
                >
                  <div className="flex items-center gap-3 text-left">
                    <div className="w-12 h-12 rounded-full bg-[#2a2a2a] flex items-center justify-center text-gray-400 group-hover:text-white transition shrink-0">
                      <FolderArchive size={24} />
                    </div>
                    <div>
                      <h3 className="text-white font-bold text-lg">Storico allenamenti</h3>
                      <p className="text-muted text-sm mt-0.5">{pastWorkoutsList.length} workout completati o passati</p>
                    </div>
                  </div>
                  <ChevronRight size={20} className="text-muted group-hover:text-white transition" />
                </button>
              )}
            </div>
          ) : (
              <div className="bg-[#1e1e1e] border border-dashed border-[#2a2a2a] rounded-2xl p-6 text-center">
              <p className="text-gray-400 text-sm">Nessun workout registrato per questo atleta.</p>
            </div>
          )}
          </div>
        </div>
        )
      ) : tab === 'prs' ? (
        <div className="flex flex-col gap-4 animate-in fade-in duration-300">
           <div className="flex items-center justify-between">
             <h2 className="text-lg font-semibold text-white flex items-center gap-2">
               <Trophy size={20} className="text-[#f1ba17]" />
               Traguardi e PR
             </h2>
             <button onClick={() => { setEditingPr(null); setPrModalOpen(true); }} className="flex items-center gap-1 text-black text-sm font-semibold bg-[#f1ba17] px-3 py-1.5 rounded-full transition hover:brightness-110 shadow-lg shadow-[#f1ba17]/20">
               <Plus size={16} /> Aggiungi PR
             </button>
           </div>
           {prs.length > 0 ? (
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
               {prs.map(pr => (
                  <div key={pr.id} onClick={() => { setEditingPr(pr); setPrModalOpen(true); }} className="bg-[#1e1e1e] border border-[#2a2a2a] p-4 rounded-2xl flex items-center justify-between group hover:border-[#f1ba17] transition cursor-pointer">
                     <div>
                       <p className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">{pr.exercise}</p>
                       <p className="text-white font-bold text-2xl">{pr.value}</p>
                       <p className="text-muted text-xs mt-1">{format(parseISO(pr.date), 'd MMMM yyyy', { locale: it })}</p>
                     </div>
                  </div>
               ))}
             </div>
           ) : (
             <div className="bg-[#1e1e1e] border border-dashed border-[#2a2a2a] rounded-2xl p-6 text-center">
               <p className="text-gray-400 text-sm mb-2">Nessun Personal Record registrato.</p>
               <p className="text-muted text-xs">Aggiungi i tuoi massimali di forza o i tuoi migliori tempi di corsa per tenerne traccia nel tempo!</p>
             </div>
           )}
        </div>
      ) : tab === 'stats' ? (
        <AthleteStatsTab workouts={workouts} />
      ) : null}

      {/* MODAL CONFERMA RIMOZIONE WORKOUT */}
      {workoutToRemove && createPortal(
        <div className="fixed inset-0 bg-black/85 z-[100] flex items-center justify-center p-4">
          <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-3xl w-full max-w-sm p-6 flex flex-col gap-4 text-center shadow-2xl animate-in fade-in zoom-in-[0.96] duration-300 ease-out">
            <div className="w-16 h-16 rounded-full bg-red-900/30 text-red-500 flex items-center justify-center mx-auto mb-2 shrink-0">
              <AlertTriangle size={32} />
            </div>
            <h2 className="text-xl font-bold text-white">Sei sicuro?</h2>
            <p className="text-gray-400 text-sm">
              Questa azione eliminerà l'allenamento e non può essere annullata.
            </p>
            <div className="flex gap-3 mt-4">
              <button 
                onClick={() => setWorkoutToRemove(null)}
                className="flex-1 py-3 bg-[#2a2a2a] text-white font-semibold rounded-xl hover:bg-[#333] transition"
              >
                Annulla
              </button>
              <button 
                onClick={confirmRemoveWorkout}
                className="flex-1 py-3 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-500 transition"
              >
                Elimina
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL ASSEGNA WORKOUT DA LISTA */}
      {assignModalOpen && createPortal(
        <AssignWorkoutModal 
          athleteId={id}
          onClose={() => setAssignModalOpen(false)}
          onAssigned={() => {
            setAssignModalOpen(false)
            fetchAthleteData(true)
          }}
        />,
        document.body
      )}

      {/* MODAL NUOVO PR */}
      {prModalOpen && createPortal(
        <PrModal 
          athleteId={id} 
          initialPr={editingPr}
          onClose={() => { setPrModalOpen(false); setEditingPr(null); }} 
          onSaved={(isNew) => { 
            setPrModalOpen(false); 
            setEditingPr(null);
            fetchAthleteData(true) 
          }} 
          onDelete={(prId) => {
            setPrModalOpen(false);
            setEditingPr(null);
            setConfirmInfo({ title: 'Elimina PR', message: 'Vuoi davvero eliminare questo record personale?', onConfirm: () => { handleDeletePr(prId); setConfirmInfo(null); } })
          }}
        />,
        document.body
      )}

      {/* MODAL MODIFICA ATLETA */}
      {showEditModal && createPortal(
        <EditAthleteModal 
          athlete={athlete}
          onClose={() => setShowEditModal(false)}
          onSaved={() => {
            setShowEditModal(false)
            fetchAthleteData(true)
          }}
          onDelete={() => {
            if (role === 'athlete') {
              navigate('/login')
            } else {
              navigate('/athletes')
            }
          }}
          role={role}
        />,
        document.body
      )}

      {/* MODAL SOCIAL LINK */}
      {socialModalType && createPortal(
        <SocialLinkModal 
          athlete={athlete}
          type={socialModalType}
          onClose={() => setSocialModalType(null)}
          onSaved={() => {
            setSocialModalType(null)
            fetchAthleteData(true)
          }}
        />,
        document.body
      )}

      {/* MODAL ALLENAMENTO AUTONOMO */}
      {autonomousModalOpen && createPortal(
        <div className="fixed inset-0 bg-black/85 z-[100] flex items-center justify-center p-4">
          <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-3xl w-full max-w-sm p-6 flex flex-col gap-4 shadow-2xl animate-in fade-in zoom-in-[0.96] duration-300 ease-out">
            <div className="flex justify-between items-center mb-2">
               <h2 className="text-xl font-bold text-white">{autonomousForm.id ? 'Modifica Allenamento' : 'Allenamento Libero'}</h2>
               <button aria-label="Chiudi" onClick={() => setAutonomousModalOpen(false)} className="text-muted hover:text-white"><X size={20} /></button>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-gray-400 text-xs pl-1 mb-1 block">Titolo <span className="text-muted font-normal">(facoltativo)</span></label>
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
      {showRpeModal && createPortal(
        <RpeModal 
          score={rpeScore} 
          onScoreChange={setRpeScore} 
          notes={rpeNotes} 
          onNotesChange={setRpeNotes} 
          onSave={handleRpeSubmitAthleteDetail} 
          onCancel={() => { setShowRpeModal(false); setWorkoutToComplete(null); }} 
          saving={savingRpe} 
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

function AthleteStatsTab({ workouts }) {
  const [weeks, setWeeks] = useState([])
  const [completion, setCompletion] = useState({ assigned: 0, done: 0 })
  const [rpeDist, setRpeDist] = useState({ light: 0, moderate: 0, hard: 0, extreme: 0, total: 0 })

  useEffect(() => {
    const parseTime = (val) => {
      if (!val || val === '-') return 0
      const s = String(val).toLowerCase()
      if (s.includes('sec')) return (parseInt(s) || 0) / 60
      if (s.includes('min')) {
        const parts = s.replace('min', '').trim().split(':')
        if (parts.length === 2) return parseInt(parts[0]) + parseInt(parts[1])/60
        return parseInt(s) || 0
      }
      const parts = s.split(':')
      if (parts.length === 2) return parseInt(parts[0]) + parseInt(parts[1])/60
      return parseInt(s) || 0
    }

    const today = new Date()
    const wks = []
    for (let i = 3; i >= 0; i--) {
       const start = startOfWeek(new Date(today.getTime() - i * 7 * 24 * 60 * 60 * 1000), { weekStartsOn: 1 })
       const end = new Date(start)
       end.setDate(start.getDate() + 6)
       wks.push({
         label: i === 0 ? 'Questa sett.' : `${format(start, 'd MMM')} - ${format(end, 'd MMM')}`,
         startStr: format(start, 'yyyy-MM-dd'),
         endStr: format(end, 'yyyy-MM-dd'),
         time: 0,
         load: 0
       })
    }

    let assigned30 = 0
    let done30 = 0
    let rpeLight = 0, rpeMod = 0, rpeHard = 0, rpeExt = 0, rpeTot = 0
    const thirtyDaysAgoStr = format(new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')

    workouts.forEach(w => {
      if (w.completed_date >= thirtyDaysAgoStr && w.completed_date <= format(today, 'yyyy-MM-dd')) {
        assigned30++
        if (w.status === 'completed') done30++
      }

      if (w.status === 'completed') {
        const parsed = parseNotesAndRpe(w.notes)
        
        const wk = wks.find(k => w.completed_date >= k.startStr && w.completed_date <= k.endStr)
        if (wk) {
          const s = w.workouts?.sections || {}
          let workoutTime = 0;
          const cat = s.category || (s.steps ? 'Running' : 'Hyrox')
          if (cat === 'Running') {
            const steps = s.steps || s.main?.steps || []
            steps.forEach(step => {
              if (step.type === 'repeat') {
                const rounds = parseInt(step.rounds) || 1
                workoutTime += parseTime(step.runDuration) * rounds
                workoutTime += parseTime(step.recDuration) * rounds
              } else {
                let stepTime = parseTime(step.duration)
                if (stepTime === 0 && step.duration) {
                  const ds = String(step.duration).toLowerCase()
                  if (ds.includes('km')) stepTime = parseFloat(ds) * 6
                  else if (ds.includes('m')) stepTime = (parseInt(ds) || 0) / 1000 * 6
                }
                workoutTime += stepTime
              }
            })
          } else {
            let blocks = s.blocks || []
            if (blocks.length === 0) {
              if (s.warmup) blocks.push({type: 'WarmUp', params: { duration: s.warmup.duration }})
              if (s.cashIn && s.cashIn.length > 0) blocks.push({type: 'Cash In', exercises: s.cashIn})
              if (s.main) blocks.push({type: s.main.type === 'EMOM' && s.main.params?.on ? 'ON/OFF' : s.main.type, params: s.main.params || {}, exercises: s.main.exercises || []})
              if (s.cashOut && s.cashOut.length > 0) blocks.push({type: 'Cash Out', exercises: s.cashOut})
            }
            blocks.forEach(b => {
              let blockRounds = parseInt(b.params?.rounds) || 1
              if (b.type === 'ON/OFF') workoutTime += (parseTime(b.params?.on) + parseTime(b.params?.off)) * blockRounds
              else if (b.type === 'EMOM') workoutTime += parseTime(b.params?.interval) * blockRounds
              else if (b.type === 'AMRAP' || b.type === 'WarmUp' || b.type === 'Rest') workoutTime += parseTime(b.params?.duration)
              else if (b.type === 'For Time') workoutTime += 15 * blockRounds
              else if (b.type === 'Cash In' || b.type === 'Cash Out') workoutTime += 5 * blockRounds
              ;(b.exercises || []).forEach(ex => { if (b.type === 'Interval') workoutTime += parseTime(ex.exTime) * blockRounds })
            })
          }
          if (workoutTime === 0) workoutTime = 45;
          wk.time += Math.round(workoutTime)

          let loadRpe = parseInt(parsed.rpe)
          if (isNaN(loadRpe)) loadRpe = 5;
          wk.load += Math.round(workoutTime) * loadRpe
        }

        const rpeVal = parseInt(parsed.rpe)
        if (!isNaN(rpeVal)) {
          rpeTot++
          if (rpeVal <= 4) rpeLight++
          else if (rpeVal <= 6) rpeMod++
          else if (rpeVal <= 8) rpeHard++
          else rpeExt++
        }
      }
    })

    setWeeks(wks)
    setCompletion({ assigned: assigned30, done: done30 })
    setRpeDist({ light: rpeLight, moderate: rpeMod, hard: rpeHard, extreme: rpeExt, total: rpeTot })

  }, [workouts])

  const maxTime = Math.max(...weeks.map(w => w.time), 60)
  const maxLoad = Math.max(...weeks.map(w => w.load), 100)
  const completionRate = completion.assigned > 0 ? Math.round((completion.done / completion.assigned) * 100) : 0

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
      
      {/* COMPLETION RATE */}
      <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-3xl p-5 shadow-lg flex items-center justify-between">
        <div>
           <h3 className="text-white font-bold text-lg flex items-center gap-2 mb-1">
             <Target size={20} className="text-[#f1ba17]" /> Completamento
           </h3>
           <p className="text-muted text-sm">Ultimi 30 giorni</p>
           <p className="text-gray-400 mt-2 text-sm">Workout completati: <strong className="text-white">{completion.done}</strong> su {completion.assigned}</p>
        </div>
        <div className="relative w-24 h-24 flex items-center justify-center">
          <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="40" fill="none" stroke="#333" strokeWidth="8" />
            <circle cx="50" cy="50" r="40" fill="none" stroke="#f1ba17" strokeWidth="8" strokeDasharray={`${completionRate * 2.51} 251`} strokeLinecap="round" className="transition-all duration-1000 ease-out" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center flex-col">
            <span className="text-xl font-black text-white">{completionRate}%</span>
          </div>
        </div>
      </div>

      {/* LINE CHART VOLUME */}
      <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-3xl p-5 shadow-lg">
         <h3 className="text-white font-bold text-lg flex items-center gap-2 mb-1">
           <LineChart size={20} className="text-[#0094C6]" /> Volume di Allenamento
         </h3>
         <p className="text-muted text-sm mb-6">Minuti stimati (Ultime 4 settimane)</p>
         
         <div className="relative h-32 mt-8 mb-2 ml-8 mr-4">
           {/* Y Axis Grid */}
           <div className="absolute inset-0 flex flex-col justify-between pointer-events-none z-0">
             <div className="relative w-full border-t border-[#333]/50">
               <span className="absolute -left-8 -top-2 text-[11px] font-bold text-muted">{maxTime}</span>
             </div>
             <div className="relative w-full border-t border-[#333]/50">
               <span className="absolute -left-8 -top-2 text-[11px] font-bold text-muted">{Math.round(maxTime / 2)}</span>
             </div>
             <div className="relative w-full border-t border-[#333]/50">
               <span className="absolute -left-8 -top-2 text-[11px] font-bold text-muted">0</span>
             </div>
           </div>

           {/* Area fill */}
           <svg className="absolute inset-0 w-full h-full overflow-visible z-10" preserveAspectRatio="none" viewBox="0 0 100 100">
             <defs>
               <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                 <stop offset="0%" stopColor="rgba(0, 148, 198, 0.4)" />
                 <stop offset="100%" stopColor="rgba(0, 148, 198, 0)" />
               </linearGradient>
             </defs>
             <polygon 
               points={`0,100 ${weeks.map((wk, i) => `${(i / (weeks.length - 1)) * 100},${100 - Math.max((wk.time / maxTime) * 100, 2)}`).join(' ')} 100,100`}
               fill="url(#lineGrad)"
             />
             <polyline 
               points={weeks.map((wk, i) => `${(i / (weeks.length - 1)) * 100},${100 - Math.max((wk.time / maxTime) * 100, 2)}`).join(' ')}
               fill="none" 
               stroke="#0094C6" 
               strokeWidth="3" 
               vectorEffect="non-scaling-stroke"
               strokeLinecap="round"
               strokeLinejoin="round"
             />
           </svg>

           {/* Points and Hover zones */}
           <div className="absolute inset-0 z-20">
             {weeks.map((wk, i) => {
               const heightPct = Math.max((wk.time / maxTime) * 100, 2)
               const leftPct = (i / (weeks.length - 1)) * 100
               return (
                 <div 
                   key={i} 
                   className="absolute h-full flex flex-col items-center group cursor-pointer"
                   style={{ left: `${leftPct}%`, width: '40px', transform: 'translateX(-50%)' }}
                 >
                   {/* Point */}
                   <div 
                     className="absolute w-3.5 h-3.5 bg-[#1e1e1e] rounded-full border-[3px] border-[#0094C6] transition-transform group-hover:scale-[1.5] z-10" 
                     style={{ bottom: `calc(${heightPct}% - 7px)` }}
                   />
                   {/* Tooltip */}
                   <div 
                     className="absolute text-white font-bold text-xs opacity-0 group-hover:opacity-100 transition-opacity bg-[#111] border border-[#333] px-2 py-1 rounded-lg z-20 pointer-events-none whitespace-nowrap shadow-lg" 
                     style={{ bottom: `calc(${heightPct}% + 12px)` }}
                   >
                     {wk.time} min
                   </div>
                 </div>
               )
             })}
           </div>
         </div>
         
         {/* X Axis Labels */}
         <div className="relative h-6 mt-2 ml-8 mr-4">
           {weeks.map((wk, i) => {
             const leftPct = (i / (weeks.length - 1)) * 100
             return (
               <div key={i} className="absolute text-[11px] text-muted font-bold whitespace-nowrap text-center" style={{ left: `${leftPct}%`, transform: 'translateX(-50%)' }}>
                 {wk.label}
               </div>
             )
           })}
         </div>
      </div>

      {/* BAR CHART TRAINING LOAD */}
      <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-3xl p-5 shadow-lg">
         <h3 className="text-white font-bold text-lg flex items-center gap-2 mb-1">
           <BarChart2 size={20} className="text-green-500" /> Carico di Allenamento
         </h3>
         <p className="text-muted text-sm mb-6">Punteggio di stress (Minuti x RPE)</p>
         
         <div className="relative mt-8 mb-2 ml-8 mr-2">
           {/* Y Axis Grid */}
           <div className="absolute inset-0 flex flex-col justify-between pointer-events-none z-0 pb-6 pt-5">
             <div className="relative w-full border-t border-[#333]/50">
               <span className="absolute -left-8 -top-2 text-[11px] font-bold text-muted">{maxLoad}</span>
             </div>
             <div className="relative w-full border-t border-[#333]/50">
               <span className="absolute -left-8 -top-2 text-[11px] font-bold text-muted">{Math.round(maxLoad / 2)}</span>
             </div>
             <div className="relative w-full border-t border-[#333]/50">
               <span className="absolute -left-8 -top-2 text-[11px] font-bold text-muted">0</span>
             </div>
           </div>

           <div className="relative flex items-end justify-between h-40 gap-2 z-10">
           {weeks.map((wk, i) => {
             const heightPct = Math.max((wk.load / maxLoad) * 100, 2)
             return (
               <div key={i} className="flex flex-col items-center flex-1 gap-2 group h-full">
                 <div className="text-gray-300 font-bold text-[11px] opacity-0 group-hover:opacity-100 transition-opacity bg-[#111] px-2 py-0.5 rounded border border-[#333] shadow-lg whitespace-nowrap">
                   {wk.load} pt
                 </div>
                 <div className="w-full bg-[#111] rounded-t-lg relative flex items-end justify-center flex-1">
                    <div 
                      className="w-full bg-green-500 rounded-t-lg transition-all duration-1000 ease-out" 
                      style={{ height: `${heightPct}%` }}
                    />
                 </div>
                 <span className="text-[11px] text-muted font-bold whitespace-nowrap">{wk.label}</span>
               </div>
             )
           })}
           </div>
         </div>
      </div>

      {/* RPE DISTRIBUTION */}
      <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-3xl p-5 shadow-lg">
         <h3 className="text-white font-bold text-lg flex items-center gap-2 mb-1">
           <PieChart size={20} className="text-purple-500" /> Sforzo Percepito (RPE)
         </h3>
         <p className="text-muted text-sm mb-6">Distribuzione dell'intensità</p>
         
         {rpeDist.total === 0 ? (
           <p className="text-muted text-sm text-center py-4">Nessun dato RPE disponibile.</p>
         ) : (
           <div className="flex flex-col gap-4">
             <RpeBar label="Leggero (1-4)" color="bg-green-500" count={rpeDist.light} total={rpeDist.total} />
             <RpeBar label="Moderato (5-6)" color="bg-yellow-400" count={rpeDist.moderate} total={rpeDist.total} />
             <RpeBar label="Impegnativo (7-8)" color="bg-orange-500" count={rpeDist.hard} total={rpeDist.total} />
             <RpeBar label="Massimale (9-10)" color="bg-red-500" count={rpeDist.extreme} total={rpeDist.total} />
           </div>
         )}
      </div>

    </div>
  )
}

function RpeBar({ label, color, count, total }) {
  const pct = total > 0 ? (count / total) * 100 : 0
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs font-bold text-gray-400">
        <span>{label}</span>
        <span>{count} workout ({Math.round(pct)}%)</span>
      </div>
      <div className="w-full h-2.5 bg-[#111] rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-1000 ease-out`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function SocialLinkModal({ athlete, type, onClose, onSaved }) {
  const [url, setUrl] = useState(athlete[`${type}_url`] || '')
  const [saving, setSaving] = useState(false)
  const [alertInfo, setAlertInfo] = useState(null)

  const handleSave = async () => {
    if (!url.trim()) return
    
    let finalUrl = url.trim()
    if (type === 'instagram') {
       let val = finalUrl.replace(/^@/, '')
       if (val.includes('instagram.com/')) {
         val = val.split('instagram.com/')[1].split('/')[0].split('?')[0]
       }
       const instaRegex = /^[a-zA-Z0-9._]{1,30}$/
       if (!instaRegex.test(val)) {
         return setAlertInfo({ title: 'Errore', message: 'Username Instagram non valido. Usa solo lettere, numeri, punti e underscore.', type: 'error' })
       }
       finalUrl = val
    } else if (type === 'strava') {
       if (!/^https?:\/\//i.test(finalUrl)) {
         finalUrl = 'https://' + finalUrl;
       }
       try {
         const parsedUrl = new URL(finalUrl)
         if (!parsedUrl.hostname.includes('strava.com') && !parsedUrl.hostname.includes('strava.app.link')) {
           return setAlertInfo({ title: 'Errore', message: 'Inserisci un link valido a un profilo Strava (es. https://strava.app.link/...).', type: 'error' })
         }
       } catch (e) {
         return setAlertInfo({ title: 'Errore', message: 'Inserisci un URL Strava valido.', type: 'error' })
       }
    }
    
    setSaving(true)
    const { error } = await supabase.from('athletes').update({
      [`${type}_url`]: finalUrl
    }).eq('id', athlete.id)

    setSaving(false)
    if (error) {
      setAlertInfo({ title: 'Errore', message: error.message, type: 'error' })
    } else {
      onSaved()
    }
  }

  const isInsta = type === 'instagram'

  return (
    <div className="fixed inset-0 bg-black/85 z-[100] flex items-center justify-center p-4">
      <div className="bg-[#1e1e1e] rounded-3xl w-full max-w-sm flex flex-col border border-[#333] shadow-2xl animate-in fade-in zoom-in-[0.96] duration-300 ease-out">
        <div className="flex items-center justify-between p-5 border-b border-[#2a2a2a]">
          <p className="text-white font-bold text-lg">Aggiungi {isInsta ? 'Instagram' : 'Strava'}</p>
          <button aria-label="Chiudi" onClick={onClose} className="text-muted hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-gray-400 text-xs pl-1 block mb-1">
              {isInsta ? 'Username o link profilo' : 'Link profilo Strava'}
            </label>
            {isInsta ? (
               <div className="flex items-center bg-[#111] border border-[#333] rounded-xl overflow-hidden focus-within:border-pink-500 transition">
                  <div className="pl-4 pr-3 py-3 text-muted flex items-center justify-center border-r border-[#333]">
                     <InstagramIcon size={18} className="text-pink-500" />
                  </div>
                  <div className="pl-3 text-gray-400 text-sm font-semibold">@</div>
                <input autoFocus className="w-full bg-transparent pr-3 py-3 text-white placeholder-gray-500 focus:outline-none text-base" placeholder="Nome utente" value={url} onChange={e => setUrl(e.target.value)} />
               </div>
            ) : (
               <div className="flex items-center bg-[#111] border border-[#333] rounded-xl overflow-hidden focus-within:border-[#fc4c02] transition">
                  <div className="pl-4 pr-3 py-3 text-muted flex items-center justify-center border-r border-[#333]">
                     <Activity size={18} className="text-[#fc4c02]" />
                  </div>
                  <input autoFocus className="w-full bg-transparent px-3 py-3 text-white placeholder-gray-500 focus:outline-none text-base" placeholder="Link profilo..." value={url} onChange={e => setUrl(e.target.value)} />
               </div>
            )}
          </div>
          <button onClick={handleSave} disabled={saving || !url.trim()} className="w-full mt-2 py-3.5 bg-[#f1ba17] text-black font-bold rounded-xl hover:brightness-110 transition disabled:opacity-50">
            {saving ? 'Salvataggio...' : 'Conferma'}
          </button>
        </div>
      </div>
      {alertInfo && <CustomAlert info={alertInfo} onClose={() => setAlertInfo(null)} />}
    </div>
  )
}

function TodayAthleteWorkoutCard({ entry, onToggleStatus, onUpdateNote, onRemove, navigate, athleteId, role, onEditAutonomous, onUploadVoiceNote, onDeleteVoiceNote }) {
  const parsed = parseNotesAndRpe(entry.notes)
  const [note, setNote] = useState(parsed.text)
  const [saving, setSaving] = useState(false)
  const noteRef = useRef(null)

  useEffect(() => {
    setNote(parseNotesAndRpe(entry.notes).text)
  }, [entry.notes])

  useEffect(() => {
    if (noteRef.current) {
      noteRef.current.style.height = 'auto'
      noteRef.current.style.height = `${noteRef.current.scrollHeight}px`
    }
  }, [note])
  
  const hasChanges = note !== parsed.text

  const rawCat = entry.workouts?.sections?.category || (entry.workouts?.sections?.steps ? 'Running' : 'Hyrox')
  const isAuto = entry.workouts?.sections?.isAutonomous === true || rawCat === 'Autonomo'
  const isEvent = rawCat === 'Event' || entry.workouts?.sections?.isEvent === true
  const isCustom = rawCat === 'Custom' || isAuto
  const category = isEvent ? 'Event' : (isCustom ? 'Custom' : rawCat)
  const isRun = category === 'Running'

  const handleSaveNote = async () => {
    setSaving(true)
    const finalNote = formatNotesWithRpe(parsed.rpe, note)
    await onUpdateNote(entry.id, finalNote, entry.workouts?.title)
    setSaving(false)
  }

  return (
    <div 
      className={`rounded-3xl p-5 transition border relative overflow-hidden group ${
        entry.status === 'completed'
          ? 'bg-green-500/10 border-green-500/30'
          : (isEvent ? 'bg-gradient-to-br from-[#2a2a2a] to-[#1e1e1e] border-white/50' : isRun ? 'bg-gradient-to-br from-[#2a2a2a] to-[#1e1e1e] border-[#0094C6]/50' : isCustom ? 'bg-gradient-to-br from-[#2a2a2a] to-[#1e1e1e] border-[#D11149]/50' : 'bg-gradient-to-br from-[#2a2a2a] to-[#1e1e1e] border-[#f1ba17]/50')
      }`}
    >
      <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
        {entry.status === 'completed' ? <CheckCircle2 size={80} className="text-green-500 -rotate-12" /> : (isEvent ? <CalendarDays size={80} className="text-white/30 -rotate-12" /> : isRun ? <Timer size={80} className="text-[#0094C6] -rotate-12" /> : isCustom ? <Dumbbell size={80} className="text-[#D11149] -rotate-12" /> : <Flame size={80} className="text-[#f1ba17] -rotate-12" />)}
      </div>
      <div className="relative z-10 flex flex-col gap-4">
        <div className="flex justify-between items-start gap-2">
           <div className="flex items-center gap-4 cursor-pointer flex-1 min-w-0" onClick={() => navigate(`/workout/${entry.workouts.id}?athlete_id=${athleteId}`)}>
             <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg shrink-0 ${
               entry.status === 'completed' ? 'bg-green-500 text-black shadow-green-500/20' : (isEvent ? 'bg-white text-black shadow-white/20' : isRun ? 'bg-[#0094C6] text-white shadow-[#0094C6]/20' : isCustom ? 'bg-[#D11149] text-white shadow-[#D11149]/20' : 'bg-[#f1ba17] text-black shadow-[#f1ba17]/20')
             }`}>
               {entry.status === 'completed' ? <CheckCircle2 size={24} /> : (isEvent ? <CalendarDays size={24} /> : isRun ? <Timer size={24} /> : <Dumbbell size={24} />)}
             </div>
             <div className="min-w-0">
               <h3 className="text-white font-bold text-xl leading-tight group-hover:underline underline-offset-4 truncate">{entry.workouts.title}</h3>
               <p className={`text-sm font-medium mt-1 ${entry.status === 'completed' ? 'text-green-400' : (isEvent ? 'text-gray-300' : isRun ? 'text-[#0094C6]' : isCustom ? 'text-[#D11149]' : 'text-[#f1ba17]')}`}>
                 {entry.status === 'completed' ? 'Completato! 🎉' : (isEvent ? 'In programma oggi 🏁' : 'Da fare oggi 🔥')}
               </p>
             </div>
           </div>
           
           <div className="flex flex-col items-end gap-2 shrink-0">
             <button 
               onClick={() => onToggleStatus(entry.id, entry.status, entry.completed_date)}
               className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition border bg-[#111]/50 backdrop-blur-md ${
                 entry.status === 'completed' 
                   ? 'border-green-500 text-green-500 hover:bg-green-500/20' 
                     : `border-[#333] text-gray-300 ${isEvent ? 'hover:border-white hover:text-white' : isRun ? 'hover:border-[#0094C6] hover:text-[#0094C6]' : isCustom ? 'hover:border-[#D11149] hover:text-[#D11149]' : 'hover:border-[#f1ba17] hover:text-[#f1ba17]'}`
               }`}
             >
               {entry.status === 'completed' ? <CheckCircle2 size={14} /> : <Circle size={14} />} {entry.status === 'completed' ? 'Fatto' : 'Segna fatto'}
             </button>
             
             {(role !== 'athlete' || isAuto) && (
               <div className="flex items-center gap-1 mt-1">
                 {role === 'athlete' && isAuto && onEditAutonomous && (
                   <button aria-label="Modifica l'allenamento libero" 
                     onClick={(e) => { e.stopPropagation(); onEditAutonomous(entry); }}
                     className="text-muted hover:text-[#f1ba17] transition p-1"
                     title="Modifica allenamento libero"
                   >
                     <Edit size={16} />
                   </button>
                 )}
                 <button aria-label="Elimina l'allenamento" 
                   onClick={(e) => { e.stopPropagation(); onRemove(entry.id); }}
                   className="text-muted hover:text-red-500 transition p-1"
                   title={isAuto ? "Elimina allenamento libero" : "Rimuovi assegnazione"}
                 >
                   <Trash2 size={16} />
                 </button>
               </div>
             )}
           </div>
        </div>

        <div className="pt-2 border-t border-white/5">
          {entry.voice_note_url ? (
            <div className="mb-3">
              <p className="text-[#f1ba17] text-xs font-bold mb-1.5 flex items-center gap-1"><Mic size={12}/> Nota Vocale del Coach</p>
              <CustomAudioPlayer src={entry.voice_note_url} onDelete={() => onDeleteVoiceNote(entry.id)} role={role} />
            </div>
          ) : role === 'admin' ? (
            <div className="mb-3">
              <p className="text-[#f1ba17] text-xs font-bold mb-1.5 flex items-center gap-1"><Mic size={12}/> Invia Nota Vocale</p>
              <VoiceRecorder onSave={(blob, ext) => onUploadVoiceNote(entry.id, blob, ext)} />
            </div>
          ) : null}
          {parsed.rpe !== '5' && entry.status === 'completed' && (
            <div className="mb-2 inline-flex items-center gap-1.5 bg-[#111] px-2 py-1 rounded border border-[#333]">
              <span className="text-muted text-[11px] font-bold uppercase tracking-wider">Sforzo:</span>
              <span className={`text-xs font-bold ${getRpeColorText(parseInt(parsed.rpe))}`}>{parsed.rpe}/10</span>
            </div>
          )}
          <textarea
          ref={noteRef}
          className={`w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-gray-500 focus:outline-none resize-none text-base transition-all duration-200 overflow-hidden ${isEvent ? 'focus:border-white' : isRun ? 'focus:border-[#0094C6]' : isCustom ? 'focus:border-[#D11149]' : 'focus:border-[#f1ba17]'}`}
            rows={2}
            placeholder="Note dell'atleta su questo workout..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        <div className={`transition-all duration-300 ease-out overflow-hidden ${hasChanges ? 'max-h-16 opacity-100 mt-2' : 'max-h-0 opacity-0 mt-0'}`}>
          <div className="flex justify-end">
              <button
                onClick={handleSaveNote}
                disabled={saving}
                className={`font-bold px-4 py-1.5 rounded-xl text-sm hover:brightness-110 transition disabled:opacity-50 ${isEvent ? 'bg-white text-black' : isRun ? 'bg-[#0094C6] text-white' : isCustom ? 'bg-[#D11149] text-white' : 'bg-[#f1ba17] text-black'}`}
              >
                {saving ? 'Salvataggio...' : 'Conferma note'}
              </button>
            </div>
        </div>
        </div>
      </div>
    </div>
  )
}

function PrModal({ athleteId, initialPr, onClose, onSaved, onDelete }) {
  const [exercise, setExercise] = useState(initialPr?.exercise || '')
  const [value, setValue] = useState(initialPr?.value || '')
  const [date, setDate] = useState(initialPr?.date || format(new Date(), 'yyyy-MM-dd'))
  const [saving, setSaving] = useState(false)
  const [alertInfo, setAlertInfo] = useState(null)

  const handleSave = async () => {
    if (!exercise || !value || !date) return setAlertInfo({ title: 'Dati mancanti', message: 'Tutti i campi sono obbligatori', type: 'error' })
    setSaving(true)
    
    if (initialPr) {
      const { error } = await supabase.from('personal_records').update({ exercise, value, date }).eq('id', initialPr.id)
      setSaving(false)
      if (error) return setAlertInfo({ title: 'Errore', message: "Impossibile aggiornare: " + error.message, type: 'error' })
      onSaved(false)
    } else {
      const { error } = await supabase.from('personal_records').insert({ athlete_id: athleteId, exercise, value, date })
      setSaving(false)
      if (error) return setAlertInfo({ title: 'Errore', message: "Impossibile salvare: " + error.message, type: 'error' })
      onSaved(true)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/85 z-[100] flex items-center justify-center p-4">
      <div className="bg-[#1e1e1e] rounded-3xl w-full max-w-sm flex flex-col border border-[#333] animate-in fade-in zoom-in-[0.96] duration-300 ease-out">
        <div className="flex items-center justify-between p-5 border-b border-[#2a2a2a]">
          <p className="text-white font-bold text-lg">{initialPr ? 'Modifica PR' : 'Aggiungi PR'}</p>
          <button aria-label="Chiudi" onClick={onClose} className="text-muted hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <div>
            <label className="text-gray-400 text-xs pl-1 mb-1 block">Esercizio o Distanza *</label>
            <input type="text" placeholder="Es. Back Squat, 5km Run" value={exercise} onChange={e => setExercise(e.target.value)} className="w-full bg-[#111] border border-[#333] text-white px-4 py-3 rounded-xl focus:outline-none focus:border-[#f1ba17] text-base" />
          </div>
          <div>
            <label className="text-gray-400 text-xs pl-1 mb-1 block">Risultato / Record *</label>
            <input type="text" placeholder="Es. 120 kg, 22:30 min" value={value} onChange={e => setValue(e.target.value)} className="w-full bg-[#111] border border-[#333] text-white px-4 py-3 rounded-xl focus:outline-none focus:border-[#f1ba17] text-base" />
          </div>
          <div>
            <label className="text-gray-400 text-xs pl-1 mb-1 block">Data del record *</label>
            <CustomDatePicker date={date} onChange={setDate} className="bg-[#111] border border-[#333] rounded-xl px-4 py-3 hover:border-[#f1ba17]" />
          </div>
          <div className="flex flex-col gap-2 mt-2">
            <button onClick={handleSave} disabled={saving} className="w-full py-3.5 bg-[#f1ba17] text-black font-bold rounded-xl hover:brightness-110 transition disabled:opacity-50">
              {saving ? 'Salvataggio...' : (initialPr ? 'Salva Modifiche' : 'Salva Record')}
            </button>
            {initialPr && (
              <button onClick={() => onDelete(initialPr.id)} className="w-full py-3.5 bg-[#2a2a2a] text-red-500 font-bold rounded-xl hover:bg-[#333] transition disabled:opacity-50">
                Elimina PR
              </button>
            )}
          </div>
        </div>
      </div>
      {alertInfo && <CustomAlert info={alertInfo} onClose={() => setAlertInfo(null)} />}
    </div>
  )
}

function EditAthleteModal({ athlete, onClose, onSaved, onDelete, role }) {
  const [form, setForm] = useState({ 
    name: athlete.name || '', 
    surname: athlete.surname || '', 
    birth_date: athlete.birth_date || '', 
    weight: athlete.weight || '', 
    height: athlete.height || '', 
    notes: athlete.notes || '',
    instagram_url: athlete.instagram_url || '',
    strava_url: athlete.strava_url || ''
  })
  const [photo, setPhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(athlete.photo_url || null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [alertInfo, setAlertInfo] = useState(null)

  const handlePhoto = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setPhoto(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const handleSave = async () => {
    if (!form.name || !form.surname) return setAlertInfo({ title: 'Attenzione', message: 'Nome e cognome obbligatori!', type: 'error' })
    
    let finalInstagram = form.instagram_url?.trim() || ''
    if (finalInstagram) {
      const instaRegex = /^[a-zA-Z0-9._]{1,30}$/
      if (!instaRegex.test(finalInstagram)) {
        return setAlertInfo({ title: 'Errore', message: 'Username Instagram non valido. Usa solo lettere, numeri, punti e underscore.', type: 'error' })
      }
    }

    let finalStrava = form.strava_url?.trim() || ''
    if (finalStrava) {
      if (!/^https?:\/\//i.test(finalStrava)) {
        finalStrava = 'https://' + finalStrava;
      }
      try {
         const parsedUrl = new URL(finalStrava)
         if (!parsedUrl.hostname.includes('strava.com') && !parsedUrl.hostname.includes('strava.app.link')) {
           return setAlertInfo({ title: 'Errore', message: 'Inserisci un link valido a un profilo Strava (es. https://strava.app.link/...).', type: 'error' })
         }
      } catch (e) {
         return setAlertInfo({ title: 'Errore', message: 'Inserisci un URL Strava valido.', type: 'error' })
      }
    }

    setSaving(true)

    let photo_url = athlete.photo_url
    if (photo) {
      const ext = photo.name.split('.').pop()
      const fileName = `${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('athlete-photos')
        .upload(fileName, photo, { contentType: photo.type })

      if (uploadError) {
        setSaving(false)
        setAlertInfo({ title: 'Errore', message: 'Errore durante il caricamento della foto: ' + uploadError.message, type: 'error' })
        return
      }
      const { data: urlData } = supabase.storage.from('athlete-photos').getPublicUrl(fileName)
      photo_url = urlData.publicUrl
    }

    const { error } = await supabase.from('athletes').update({
      name: form.name,
      surname: form.surname,
      birth_date: form.birth_date || null,
      weight: form.weight ? parseFloat(form.weight) : null,
      height: form.height ? parseFloat(form.height) : null,
      notes: form.notes,
      instagram_url: finalInstagram,
      strava_url: finalStrava,
      photo_url
    }).eq('id', athlete.id)

    setSaving(false)
    if (error) { setAlertInfo({ title: 'Errore', message: 'Errore: ' + error.message, type: 'error' }); return }
    
    localStorage.setItem(`fleofit_name_${athlete.id}`, form.name)
    supabase.auth.updateUser({ data: { first_name: form.name, last_name: form.surname, avatar_url: photo_url } }).catch(()=>{})

    onSaved()
  }

  const handleDeleteAthlete = async () => {
    const deletedAt = Date.now()
    const { error } = await supabase.from('athletes').update({ deleted_at: deletedAt }).eq('id', athlete.id)
    if (error) {
      setAlertInfo({ title: 'Errore', message: "Errore durante l'eliminazione: " + error.message, type: 'error' })
      return
    }
    if (role === 'athlete') {
      await supabase.auth.signOut()
    }
    onDelete()
  }

  return (
    <div className="fixed inset-0 bg-black/85 z-[100] flex items-center justify-center p-4">
      <div className="bg-[#1e1e1e] rounded-3xl w-full max-w-md flex flex-col animate-in fade-in zoom-in-[0.96] duration-300 ease-out" style={{ maxHeight: 'calc(100vh - 100px)' }}>
        <div className="flex items-center justify-between p-5 border-b border-[#2a2a2a]">
          <p className="text-white font-bold text-lg">Modifica Atleta</p>
          <button aria-label="Chiudi" onClick={onClose} className="text-muted hover:text-white"><X size={20} /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-5 flex flex-col gap-4">
          <div className="flex justify-center">
            <label className="cursor-pointer relative">
              <div className="w-20 h-20 rounded-full bg-[#2a2a2a] border-2 border-dashed border-[#444] flex items-center justify-center overflow-hidden hover:border-[#f1ba17] transition">
                {photoPreview
                  ? <img src={photoPreview} className="w-full h-full object-cover" onError={() => setPhotoPreview(null)} />
                  : <User size={28} className="text-muted" />
                }
              </div>
              <div className="absolute bottom-0 right-0 bg-[#f1ba17] p-1.5 rounded-full cursor-pointer shadow-lg">
                <Upload size={12} className="text-black" />
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-gray-400 text-xs pl-1">Nome *</label>
              <input className="bg-[#2a2a2a] border border-[#383838] rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#f1ba17] text-base" placeholder="Mario" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-gray-400 text-xs pl-1">Cognome *</label>
              <input className="bg-[#2a2a2a] border border-[#383838] rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#f1ba17] text-base" placeholder="Rossi" value={form.surname} onChange={e => setForm({ ...form, surname: e.target.value })} />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-gray-400 text-xs pl-1">Data di nascita</label>
            <input type="date" className="bg-[#2a2a2a] border border-[#383838] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#f1ba17] text-base" value={form.birth_date} onChange={e => setForm({ ...form, birth_date: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-gray-400 text-xs pl-1">Peso (kg)</label>
              <input className="bg-[#2a2a2a] border border-[#383838] rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#f1ba17] text-base" placeholder="Es. 75" type="number" value={form.weight} onChange={e => setForm({ ...form, weight: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-gray-400 text-xs pl-1">Altezza (cm)</label>
              <input className="bg-[#2a2a2a] border border-[#383838] rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#f1ba17] text-base" placeholder="Es. 180" type="number" value={form.height} onChange={e => setForm({ ...form, height: e.target.value })} />
            </div>
          </div>
          <textarea className="bg-[#2a2a2a] border border-[#383838] rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#f1ba17] resize-none text-base" rows={3} placeholder="Note biografiche (facoltativo)" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          
          <div className="flex flex-col gap-3">
             <div className="flex items-center bg-[#2a2a2a] border border-[#383838] rounded-xl overflow-hidden focus-within:border-pink-500 transition">
                <div className="pl-4 pr-3 py-3 text-muted flex items-center justify-center bg-[#1e1e1e] border-r border-[#383838]">
                   <InstagramIcon size={18} className="text-pink-500" />
                </div>
                <div className="pl-3 text-gray-400 text-sm font-semibold">@</div>
                <input className="w-full bg-transparent pr-3 py-3 text-white placeholder-gray-500 focus:outline-none text-base" placeholder="Nome utente" value={form.instagram_url?.replace(/^@/, '')} onChange={e => {
                   let val = e.target.value.replace(/^@/, '').trim();
                   if (val.includes('instagram.com/')) {
                     val = val.split('instagram.com/')[1].split('/')[0].split('?')[0];
                   }
                   setForm({ ...form, instagram_url: val })
                }} />
             </div>
             <div className="flex items-center bg-[#2a2a2a] border border-[#383838] rounded-xl overflow-hidden focus-within:border-[#fc4c02] transition">
                <div className="pl-4 pr-3 py-3 text-muted flex items-center justify-center bg-[#1e1e1e] border-r border-[#383838]">
                   <Activity size={18} className="text-[#fc4c02]" />
                </div>
                <input className="w-full bg-transparent px-3 py-3 text-white placeholder-gray-500 focus:outline-none text-base" placeholder="Link profilo Strava..." value={form.strava_url} onChange={e => setForm({ ...form, strava_url: e.target.value })} />
             </div>
          </div>
        </div>
        <div className="p-5 border-t border-[#2a2a2a] flex flex-col gap-4">
          <button onClick={handleSave} disabled={saving} className="w-full bg-[#f1ba17] text-black font-bold py-4 rounded-xl hover:brightness-110 transition disabled:opacity-50">{saving ? 'Salvataggio...' : 'Salva Modifiche'}</button>
          
          <div className="flex justify-center">
            {!showDeleteConfirm ? (
              <button onClick={() => setShowDeleteConfirm(true)} className="flex items-center gap-2 text-red-500 text-sm font-medium hover:underline">
                <Trash2 size={16} /> Elimina profilo{role !== 'athlete' ? ' atleta' : ''}
              </button>
            ) : (
              <div className="bg-red-900/20 border border-red-900/50 rounded-xl p-4 text-center w-full">
                <p className="text-red-400 text-sm font-semibold mb-3">Sei sicuro? Il profilo verrà nascosto e poi eliminato definitivamente tra 7 giorni.</p>
                <div className="flex justify-center gap-3">
                  <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 bg-[#2a2a2a] text-white rounded-lg text-sm transition hover:bg-[#333]">Annulla</button>
                  <button onClick={handleDeleteAthlete} className="px-4 py-2 bg-red-600/80 hover:bg-red-600 text-white rounded-lg text-sm font-bold transition">Sì, elimina</button>
                </div>
              </div>
            )}
          </div>
          <CustomAlert info={alertInfo} onClose={() => setAlertInfo(null)} />
        </div>
      </div>
    </div>
  )
}

function WorkoutEntryCard({ entry, onToggleStatus, onUpdateNote, onRemove, navigate, athleteId, role, onEditAutonomous, onUploadVoiceNote, onDeleteVoiceNote }) {
  const parsed = parseNotesAndRpe(entry.notes)
  const [note, setNote] = useState(parsed.text)
  const [saving, setSaving] = useState(false)
  const noteRef = useRef(null)

  useEffect(() => {
    setNote(parseNotesAndRpe(entry.notes).text)
  }, [entry.notes])

  useEffect(() => {
    if (noteRef.current) {
      noteRef.current.style.height = 'auto'
      noteRef.current.style.height = `${noteRef.current.scrollHeight}px`
    }
  }, [note])
  
  const hasChanges = note !== parsed.text

  const scheduledDate = startOfDay(parseISO(entry.completed_date))
  const today = startOfDay(new Date())

  let statusText = 'Da fare'
  let Icon = Circle

  if (entry.status === 'completed') {
    statusText = 'Fatto'
    Icon = CheckCircle2
  } else if (isBefore(scheduledDate, today)) {
    statusText = 'Saltato'
  }

  const rawCat = entry.workouts?.sections?.category || (entry.workouts?.sections?.steps ? 'Running' : 'Hyrox')
  const isAuto = entry.workouts?.sections?.isAutonomous === true || rawCat === 'Autonomo'
  const isEvent = rawCat === 'Event' || entry.workouts?.sections?.isEvent === true
  const isCustom = rawCat === 'Custom' || isAuto
  const category = isEvent ? 'Event' : (isCustom ? 'Custom' : rawCat)
  const isRun = category === 'Running'

  const handleSaveNote = async () => {
    setSaving(true)
    const finalNote = formatNotesWithRpe(parsed.rpe, note)
    await onUpdateNote(entry.id, finalNote, entry.workouts?.title)
    setSaving(false)
  }

  return (
    <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-2xl p-4">
      <div className="flex justify-between items-start mb-3">
        <div 
          className="cursor-pointer group flex-1 pr-4"
          onClick={() => navigate(`/workout/${entry.workouts.id}?athlete_id=${athleteId}`)}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <p className={`font-semibold text-white transition underline underline-offset-4 leading-tight ${isEvent ? 'group-hover:text-white decoration-white/50' : isRun ? 'group-hover:text-[#0094C6] decoration-[#0094C6]/50' : isCustom ? 'group-hover:text-[#D11149] decoration-[#D11149]/50' : 'group-hover:text-[#f1ba17] decoration-[#f1ba17]/50'}`}>
              {entry.workouts.title}
            </p>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg border shrink-0 ${isEvent ? 'bg-white text-black border-white' : isRun ? 'bg-[#0094C6]/10 text-[#0094C6] border-[#0094C6]/30' : isCustom ? 'bg-[#D11149]/10 text-[#D11149] border-[#D11149]/30' : 'bg-[#f1ba17]/10 text-[#f1ba17] border-[#f1ba17]/30'}`}>
              {isEvent ? 'Evento / Gara' : category}
            </span>
          </div>
          <p className="text-xs text-muted mt-1.5">
            {format(parseISO(entry.completed_date), 'EEEE d MMMM yyyy', { locale: it })}
          </p>
        </div>
        {(role !== 'athlete' || isAuto) && (
          <div className="flex items-center gap-1 shrink-0 ml-2">
            {role === 'athlete' && isAuto && onEditAutonomous && (
              <button aria-label="Modifica l'allenamento libero" 
                onClick={(e) => { e.stopPropagation(); onEditAutonomous(entry); }}
                className="text-muted hover:text-[#f1ba17] transition p-1"
                title="Modifica allenamento libero"
              >
                <Edit size={18} />
              </button>
            )}
            <button aria-label="Elimina l'allenamento" 
              onClick={(e) => { e.stopPropagation(); onRemove(entry.id); }}
              className="text-muted hover:text-red-500 transition p-1"
              title={isAuto ? "Elimina allenamento libero" : "Rimuovi assegnazione"}
            >
              <Trash2 size={18} />
            </button>
          </div>
        )}
      </div>

      <button aria-label="Cambia lo stato dell'allenamento" 
        onClick={() => onToggleStatus(entry.id, entry.status, entry.completed_date)}
        className={`w-full py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition border ${
          entry.status === 'completed' 
            ? 'bg-green-500/10 border-green-500/30 text-green-500 hover:bg-green-500/20' 
            : isBefore(scheduledDate, today)
              ? `bg-[#111] border-[#333] text-muted ${isEvent ? 'hover:border-white hover:text-white' : isRun ? 'hover:border-[#0094C6] hover:text-[#0094C6]' : isCustom ? 'hover:border-[#D11149] hover:text-[#D11149]' : 'hover:border-[#f1ba17] hover:text-[#f1ba17]'}`
              : `bg-[#2a2a2a] border-[#383838] text-gray-300 ${isEvent ? 'hover:border-white hover:text-white' : isRun ? 'hover:border-[#0094C6] hover:text-[#0094C6]' : isCustom ? 'hover:border-[#D11149] hover:text-[#D11149]' : 'hover:border-[#f1ba17] hover:text-[#f1ba17]'}`
        }`}
      >
        <Icon size={18} /> {statusText}
      </button>

      <div className="mt-3 pt-3 border-t border-[#2a2a2a]">
        {entry.voice_note_url ? (
          <div className="mb-3">
            <p className="text-[#f1ba17] text-xs font-bold mb-1.5 flex items-center gap-1"><Mic size={12}/> Nota Vocale del Coach</p>
            <CustomAudioPlayer src={entry.voice_note_url} onDelete={() => onDeleteVoiceNote(entry.id)} role={role} />
          </div>
        ) : role === 'admin' ? (
          <div className="mb-3">
            <p className="text-[#f1ba17] text-xs font-bold mb-1.5 flex items-center gap-1"><Mic size={12}/> Invia Nota Vocale</p>
            <VoiceRecorder onSave={(blob, ext) => onUploadVoiceNote(entry.id, blob, ext)} />
          </div>
        ) : null}
        {parsed.rpe !== '5' && entry.status === 'completed' && (
          <div className="mb-2 inline-flex items-center gap-1.5 bg-[#111] px-2 py-1 rounded border border-[#333]">
            <span className="text-muted text-[11px] font-bold uppercase tracking-wider">Sforzo:</span>
            <span className={`text-xs font-bold ${getRpeColorText(parseInt(parsed.rpe))}`}>{parsed.rpe}/10</span>
          </div>
        )}
        <textarea
          ref={noteRef}
          className={`w-full bg-[#2a2a2a] border border-[#383838] rounded-xl px-3 py-2 text-white placeholder-gray-600 focus:outline-none resize-none text-base transition-all duration-200 overflow-hidden ${isEvent ? 'focus:border-white' : isRun ? 'focus:border-[#0094C6]' : isAuto ? 'focus:border-[#D11149]' : 'focus:border-[#f1ba17]'}`}
          rows={3}
          placeholder="Inserisci o modifica le note dell'atleta su questo workout..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className={`transition-all duration-300 ease-out overflow-hidden ${hasChanges ? 'max-h-16 opacity-100 mt-2' : 'max-h-0 opacity-0 mt-0'}`}>
          <div className="flex justify-end">
            <button
              onClick={handleSaveNote}
              disabled={saving}
              className={`font-bold px-4 py-1.5 rounded-xl text-sm hover:brightness-110 transition disabled:opacity-50 ${isEvent ? 'bg-white text-black' : isRun ? 'bg-[#0094C6] text-white' : isCustom ? 'bg-[#D11149] text-white' : 'bg-[#f1ba17] text-black'}`}
            >
              {saving ? 'Salvataggio...' : 'Conferma'}
            </button>
          </div>
        </div>
      </div>
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
      <button aria-label={isPlaying ? 'Metti in pausa la nota vocale' : 'Riproduci la nota vocale'} onClick={togglePlay} className="w-11 h-11 rounded-full bg-[#f1ba17] flex items-center justify-center text-black shrink-0 hover:brightness-110 transition">
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
            <span className="text-[11px] text-muted font-medium">{currentTime}</span>
            <span className="text-[11px] text-muted font-medium">{duration}</span>
         </div>
      </div>
      {role === 'admin' && onDelete && (
        <button aria-label="Elimina la nota vocale" onClick={onDelete} className="w-11 h-11 flex items-center justify-center text-muted hover:text-red-500 transition shrink-0" title="Elimina vocale">
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
          if (!hasPerm.value) return mostraErrore('Devi abilitare il microfono dalle impostazioni di iOS.')
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
        mostraErrore('Impossibile accedere al microfono.')
      }
    } else {
      if (!window.MediaRecorder || !stream) {
        return mostraErrore('Il tuo browser non supporta la registrazione vocale.')
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
              <button aria-label="Ferma e salva la registrazione" onClick={stopRecordingAndSave} className="w-11 h-11 flex items-center justify-center bg-[#f1ba17] text-black rounded-full hover:brightness-110 transition" title="Interrompi e Salva">
                <Square size={14} fill="currentColor" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function AssignWorkoutModal({ athleteId, onClose, onAssigned }) {
  const [workouts, setWorkouts] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [assigning, setAssigning] = useState(false)
  const [alertInfo, setAlertInfo] = useState(null)
  const [assignDate, setAssignDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [selectedWorkouts, setSelectedWorkouts] = useState([])
  const [assignStep, setAssignStep] = useState(1)
  const [previewWorkout, setPreviewWorkout] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    async function fetchW() {
      const { data } = await supabase.from('workouts').select('id, title, date, sections, created_at').order('created_at', { ascending: false })
      const assignableWorkouts = (data || []).filter(w => {
        const cat = w.sections?.category;
        if (cat === 'Event' || w.sections?.isEvent) return false;
        if (w.sections?.isAutonomous) return false;
        return true;
      })
      setWorkouts(assignableWorkouts)
      setLoading(false)
    }
    fetchW()
  }, [])

  const handleAssign = async () => {
   if (!assignDate) {
      setAlertInfo({ title: 'Errore', message: 'Seleziona una data per l\'assegnazione', type: 'error' })
      return
    }
    if (selectedWorkouts.length === 0) return
    setAssigning(true)
    
    const assignmentsToInsert = selectedWorkouts.map(w => ({
      athlete_id: athleteId,
      workout_id: w.id,
      completed_date: assignDate,
      status: 'pending'
    }))

    const { data: newAssignments, error } = await supabase.from('athlete_workouts').insert(assignmentsToInsert).select('id')

    if (error) {
      setAlertInfo({ title: 'Errore', message: error.message, type: 'error' })
      setAssigning(false)
    } else {
      // Invia la notifica in background, senza bloccare l'interfaccia
      if (newAssignments && newAssignments.length > 0) {
        newAssignments.forEach(na => {
          supabase.functions.invoke('send-reminders', {
            body: { mode: 'immediate', record_id: na.id }
          }).catch(console.error)
        })
      }
      onAssigned()
    }
  }

  const filtered = workouts.filter(w => 
    w.title.toLowerCase().includes(search.toLowerCase()) || 
    (w.sections?.category || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="fixed inset-0 bg-black/85 z-[100] flex items-center justify-center p-4">
      <div className="bg-[#1e1e1e] rounded-3xl w-full max-w-md flex flex-col animate-in fade-in zoom-in-[0.96] duration-300 ease-out" style={{ maxHeight: 'calc(100vh - 100px)' }}>
        <div className="flex items-center justify-between p-5 border-b border-[#2a2a2a]">
          <p className="text-white font-bold text-lg">Assegna Workout</p>
          <button aria-label="Chiudi" onClick={() => { onClose(); setSelectedWorkouts([]); setAssignStep(1); }} className="text-muted hover:text-white"><X size={20} /></button>
        </div>
        {assignStep === 1 ? (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="p-4 border-b border-[#2a2a2a]">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-3.5 text-muted" />
                <input type="text" placeholder="Cerca workout..." value={search} onChange={e => setSearch(e.target.value)} className="w-full bg-[#111] border border-[#333] text-white px-4 py-2.5 pl-9 rounded-xl focus:outline-none focus:border-[#f1ba17] text-base" />
              </div>
            </div>
            <div className="overflow-y-auto flex-1 p-4 flex flex-col gap-2">
              {loading ? (
                <p className="text-muted text-sm text-center py-4">Caricamento...</p>
              ) : filtered.length === 0 ? (
                <p className="text-muted text-sm text-center py-4">Nessun workout trovato.</p>
              ) : (
                <>
                  <div className="flex justify-between items-center mb-1 px-1">
                    <span className="text-gray-400 text-sm">Seleziona workout:</span>
                    <button 
                      onClick={() => setSelectedWorkouts(selectedWorkouts.length === filtered.length ? [] : [...filtered])}
                      className="text-[#f1ba17] text-xs font-semibold hover:underline"
                    >
                      {selectedWorkouts.length === filtered.length ? 'Deseleziona tutti' : 'Seleziona tutti'}
                    </button>
                  </div>
                  {filtered.map(w => {
                    const isSelected = selectedWorkouts.some(sw => sw.id === w.id);
                    return (
                      <div key={w.id} 
                        onClick={() => {
                          if (isSelected) {
                            setSelectedWorkouts(selectedWorkouts.filter(sw => sw.id !== w.id));
                          } else {
                            setSelectedWorkouts([...selectedWorkouts, w]);
                          }
                        }}
                        className={`flex items-center justify-between bg-[#2a2a2a] border p-3 rounded-xl hover:border-[#f1ba17] transition cursor-pointer group ${isSelected ? 'border-[#f1ba17]' : 'border-[#333]'}`}
                      >
                        <div className="flex-1 min-w-0 pr-3 text-left">
                          <p className={`font-semibold text-sm truncate transition ${isSelected ? 'text-[#f1ba17]' : 'text-white group-hover:text-[#f1ba17]'}`}>{w.title}</p>
                          <p className="text-muted text-xs mt-0.5">{w.date && isValid(parseISO(w.date)) ? format(parseISO(w.date), 'dd/MM/yyyy') : 'Data sconosciuta'} • {w.sections?.category || 'Generico'}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button aria-label="Duplica il workout" 
                        onClick={(e) => { e.stopPropagation(); navigate(`/create?duplicate=${w.id}&athlete_id=${athleteId}`); }} 
                        className="p-1.5 bg-[#111] border border-[#333] rounded-lg text-gray-400 hover:text-white hover:border-[#f1ba17] transition"
                        title="Duplica e Modifica"
                      >
                        <Copy size={16} />
                      </button>
                      <button aria-label="Anteprima del workout" 
                            onClick={(e) => { e.stopPropagation(); setPreviewWorkout(w); }} 
                            className="p-1.5 bg-[#111] border border-[#333] rounded-lg text-gray-400 hover:text-white hover:border-[#f1ba17] transition"
                            title="Anteprima"
                          >
                            <Eye size={16} />
                      </button>
                      <div className={`w-6 h-6 rounded-full border flex items-center justify-center ml-1 ${isSelected ? 'bg-[#f1ba17] border-[#f1ba17]' : 'border-[#555] bg-[#111]'}`}>
                            {isSelected && <Check size={14} className="text-black" />}
                        </div>
                    </div>
                  </div>
                  )
                  })}
                </>
              )}
            </div>
            {selectedWorkouts.length > 0 && (
              <div className="p-4 border-t border-[#2a2a2a]">
                <button onClick={() => setAssignStep(2)} className="w-full py-3.5 bg-[#f1ba17] text-black font-bold rounded-xl hover:brightness-110 transition shadow-lg">
                  Procedi ({selectedWorkouts.length})
                </button>
              
            </div>
                        )}

        </div>

        ) : (
          <div className="p-5 flex flex-col gap-4">
            <div>
              <p className="text-gray-400 text-sm mb-1">Stai assegnando:</p>
              <p className="text-white font-bold">{selectedWorkouts.length === 1 ? selectedWorkouts[0].title : `${selectedWorkouts.length} workout selezionati`}</p>
            </div>
            <div>
              <label className="text-gray-400 text-sm mb-2 block">Seleziona la data dell'allenamento</label>
              <CustomDatePicker
                date={assignDate}
                onChange={setAssignDate}
                className="bg-[#111] border border-[#333] rounded-xl px-4 py-3 hover:border-[#f1ba17] w-full text-base"
              />
            </div>
            <div className="flex gap-3 mt-2">
              <button onClick={() => setAssignStep(1)} className="flex-1 py-3 bg-[#2a2a2a] text-white font-semibold rounded-xl hover:bg-[#333] transition disabled:opacity-50">
                Indietro
              </button>
                       <button onClick={handleAssign} disabled={assigning} className="flex-1 py-3 bg-[#f1ba17] text-black font-bold rounded-xl hover:brightness-110 transition disabled:opacity-50">
                {assigning ? 'Assegno...' : 'Conferma'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL ANTEPRIMA WORKOUT */}
      {previewWorkout && (
        <div className="fixed inset-0 bg-black/90 z-[110] flex items-center justify-center p-4">
          <div className="bg-[#1e1e1e] rounded-3xl w-full max-w-md flex flex-col border border-[#333] animate-in fade-in zoom-in-[0.96] duration-300 ease-out" style={{ maxHeight: 'calc(100vh - 40px)' }}>
            <div className="flex items-center justify-between p-5 border-b border-[#2a2a2a]">
              <p className="text-white font-bold text-lg truncate pr-4">{previewWorkout.title}</p>
              <button aria-label="Chiudi l'anteprima" onClick={() => setPreviewWorkout(null)} className="text-muted hover:text-white shrink-0"><X size={20} /></button>
            </div>
            <div className="overflow-y-auto p-5 flex flex-col gap-3">
              {(() => {
                const s = previewWorkout.sections || {};
                const isRun = s.category === 'Running' || s.steps;
                const blocks = s.blocks || [];
                const steps = s.steps || s.main?.steps || [];
                
                if (isRun) {
                  if (steps.length === 0) return <p className="text-muted text-sm">Nessun dettaglio disponibile.</p>;
                  return steps.map((step, i) => (
                    <div key={i} className="bg-[#2a2a2a] p-3 rounded-xl border border-[#383838]">
                      <p className="text-[#0094C6] font-bold text-xs uppercase mb-1">{step.type === 'repeat' ? `Ripetute (${step.rounds}x)` : step.type}</p>
                      {step.type === 'repeat' ? (
                        <div className="text-sm text-white flex flex-col gap-1">
                          <p><span className="text-gray-400">Corsa:</span> {step.runDuration} {step.runPace ? <span className="text-muted text-xs">@{step.runPace}</span> : ''}</p>
                          <p><span className="text-gray-400">Recupero:</span> {step.recDuration} {step.recPace ? <span className="text-muted text-xs">@{step.recPace}</span> : ''}</p>
                        </div>
                      ) : (
                        <p className="text-sm text-white">{step.duration} {step.pace ? <span className="text-muted text-xs ml-1">@{step.pace}</span> : ''}</p>
                      )}
                      {step.notes && <p className="text-gray-400 text-xs mt-1.5 italic">"{step.notes}"</p>}
                    </div>
                  ));
                } else {
                  if (blocks.length === 0) return <p className="text-muted text-sm">Nessun dettaglio disponibile.</p>;
                  return blocks.map((b, i) => {
                    let shortTitle = b.type;
                    if (b.type === 'EMOM') shortTitle = `EMOM ${b.params?.rounds ? b.params.rounds + 'x' : ''}`;
                    else if (b.type === 'AMRAP') shortTitle = `AMRAP ${b.params?.duration || ''}`;
                    else if (b.type === 'ON/OFF') shortTitle = `ON/OFF ${b.params?.rounds ? b.params.rounds + 'x ' : ''}• ${b.params?.on || ''}/${b.params?.off || ''}`;
                    else if (b.type === 'For Time') shortTitle = `FOR TIME ${b.params?.rounds ? b.params.rounds + 'x' : ''}`;
                                       else if (b.type === 'Interval') shortTitle = `INTERVAL ${b.params?.rounds ? b.params.rounds + 'x' : ''}`;

                    else if (b.type === 'WarmUp') shortTitle = `WARM UP ${b.params?.duration ? '• ' + b.params.duration : ''}`;
                    else if (b.type === 'Rest') shortTitle = `REST ${b.params?.duration ? '• ' + b.params.duration : ''}`;
                    else if (b.type === 'Cash In' || b.type === 'Cash Out') shortTitle = b.type.toUpperCase();

                    return (
                      <div key={i} className="bg-[#2a2a2a] p-3 rounded-xl border border-[#383838]">
                        <p className="text-[#f1ba17] font-bold text-xs uppercase mb-1.5">{shortTitle}</p>
                        {['WarmUp', 'Rest'].includes(b.type) ? (
                          b.notes && <p className="text-sm text-gray-300">{b.notes}</p>
                        ) : (
                          <div className="flex flex-col gap-1.5">
                            {(b.exercises || []).map((ex, j) => {
                              const detail = ex.exTime && ex.exTime !== '-' ? ex.exTime : ((ex.meters && ex.meters !== '-') ? ex.meters : (ex.reps && ex.reps !== '-' ? `${ex.reps} reps` : ''));
                              const pace = ex.ergoPace && ex.ergoPace !== '-' && ex.ergoPace !== 'Libero' ? `@ ${ex.ergoPace}` : '';
                              return (
                                <p key={j} className="text-sm text-white leading-tight">
                                  <span className="font-medium">{ex.name}</span>
                                  {(detail || pace || ex.kg) && (
                                    <span className="text-gray-400 text-xs ml-1">
                                      {detail} {pace} {ex.kg ? `· ${ex.kg}kg` : ''}
                                    </span>
                                  )}
                                </p>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  });
                }
              })()}
            </div>
            <div className="p-4 border-t border-[#2a2a2a] flex flex-col gap-2">
              <button 
                onClick={() => {
                  const isAlreadySelected = selectedWorkouts.some(sw => sw.id === previewWorkout.id);
                  if (!isAlreadySelected) setSelectedWorkouts([...selectedWorkouts, previewWorkout]);
                  setPreviewWorkout(null);
                }}
                className="w-full py-3 bg-[#f1ba17] text-black font-bold rounded-xl hover:brightness-110 transition shadow-lg shadow-[#f1ba17]/20"
              >
                Seleziona questo Workout
              </button>
              <button 
                onClick={() => {
                  navigate(`/create?duplicate=${previewWorkout.id}&athlete_id=${athleteId}`);
                  setPreviewWorkout(null);
                }}
                className="w-full py-3 bg-[#2a2a2a] border border-[#383838] text-white font-bold rounded-xl hover:border-[#f1ba17] hover:text-[#f1ba17] transition flex items-center justify-center gap-2"
              >
                <Copy size={18} /> Duplica e Modifica
              </button>
            </div>
          </div>
        </div>
      )}

      {alertInfo && <CustomAlert info={alertInfo} onClose={() => setAlertInfo(null)} />}
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
      mostraErrore(e.message);
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
            <span className={`text-xs font-bold px-2 py-1 rounded-lg text-black ${getRpeColor(parseInt(score))}`}>
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
                  className={`flex-1 h-10 rounded-lg transition-all duration-75 ${color} ${isActive ? 'shadow-md scale-105' : ''}`}
                  style={{ pointerEvents: 'none' }}
                />
              )
            })}
          </div>
          <div className="flex justify-between items-center text-[11px] font-bold uppercase tracking-wider text-muted mt-1">
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
              className="text-[11px] flex items-center gap-1 bg-[#2a2a2a] hover:bg-[#333] text-gray-300 px-2 py-1 rounded-lg border border-[#444] transition disabled:opacity-50"
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

function StatCard({ label, value }) {
  return (
    <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-white font-bold text-lg">{value}</p>
    </div>
  )
}