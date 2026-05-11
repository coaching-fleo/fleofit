import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { ChevronLeft, User, Upload, BookOpen, Trash2, AlertTriangle, Plus, Edit, X, Download, Dumbbell, Search, CheckCircle2, Circle, Trophy, Timer, Flame, FolderArchive, ChevronRight, Copy, Activity, CalendarDays, LayoutList } from 'lucide-react'
import { format, parseISO, differenceInYears, isBefore, startOfDay, isValid, eachDayOfInterval, startOfMonth, endOfMonth, isSameDay, isToday, differenceInDays } from 'date-fns'
import { it } from 'date-fns/locale'
import { CustomAlert, CustomConfirm } from '../components/CustomModals'
import CustomDatePicker from '../components/CustomDatePicker'
import { useAuth } from '../App'

const InstagramIcon = ({ size = 24, className = "" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5"></rect>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"></line>
  </svg>
)

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
  const [tab, setTab] = useState('workouts') // 'workouts' | 'prs'
  const [workoutView, setWorkoutView] = useState('list') // 'list' | 'calendar'
  const [showHistory, setShowHistory] = useState(false)
  const [loading, setLoading] = useState(true)
  const [workoutToRemove, setWorkoutToRemove] = useState(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [socialModalType, setSocialModalType] = useState(null)
  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [prModalOpen, setPrModalOpen] = useState(false)
  const [editingPr, setEditingPr] = useState(null)
  const [showCelebration, setShowCelebration] = useState(false)
  const [alertInfo, setAlertInfo] = useState(null)
  const [confirmInfo, setConfirmInfo] = useState(null)

  const [autonomousModalOpen, setAutonomousModalOpen] = useState(false)
  const [autonomousForm, setAutonomousForm] = useState({ title: '', date: format(new Date(), 'yyyy-MM-dd'), notes: '', id: null, awId: null })
  const [savingAutonomous, setSavingAutonomous] = useState(false)

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
      supabase.from('athlete_workouts').select(`id, completed_date, notes, status, workouts (id, title, sections)`).eq('athlete_id', id).order('completed_date', { ascending: false }),
      supabase.from('personal_records').select('*').eq('athlete_id', id).order('date', { ascending: false })
    ])

    if (athleteError) {
      console.error("Errore nel caricare l'atleta:", athleteError)
      if (!silent) setLoading(false)
      return
    }
    setAthlete(athleteData)

    if (historyError) console.error("Errore nel caricare lo storico workout:", historyError)
    else setWorkouts(workoutHistory || [])

    if (prsError && prsError.code !== '42P01' && prsError.code !== 'PGRST205') console.error("Errore PR:", prsError)
    else setPrs(prsData || [])

    if (!silent) setLoading(false)
  }

  const toggleWorkoutStatus = async (id, currentStatus, scheduledDateStr) => {
    const doToggle = async () => {
      const newStatus = currentStatus === 'completed' ? 'pending' : 'completed'
      const { error } = await supabase
        .from('athlete_workouts')
        .update({ status: newStatus })
        .eq('id', id)
      
      if (!error) {
        setWorkouts(prev => prev.map(w => w.id === id ? { ...w, status: newStatus } : w))
      }
    }

    const scheduledDate = startOfDay(parseISO(scheduledDateStr))
    const today = startOfDay(new Date())
    if (currentStatus !== 'completed' && isBefore(today, scheduledDate)) {
      setConfirmInfo({
        title: 'Attenzione',
        message: 'Questo allenamento è programmato per una data futura. Vuoi davvero segnarlo come completato oggi?',
        onConfirm: () => { doToggle(); setConfirmInfo(null); }
      })
    } else {
      doToggle()
    }
  }

  const updateWorkoutNote = async (workoutId, notes) => {
    const { error } = await supabase
      .from('athlete_workouts')
      .update({ notes })
      .eq('id', workoutId)
    
    if (!error) {
      setWorkouts(workouts.map(w => w.id === workoutId ? { ...w, notes } : w))
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
    try {
      if (autonomousForm.id) {
        const { error: wError } = await supabase.from('workouts').update({ title: autonomousForm.title, date: autonomousForm.date }).eq('id', autonomousForm.id)
        if (wError) throw wError

        const { error: awError } = await supabase.from('athlete_workouts').update({ completed_date: autonomousForm.date, notes: autonomousForm.notes }).eq('id', autonomousForm.awId)
        if (awError) throw awError
      } else {
        const { data: newW, error: wError } = await supabase.from('workouts').insert({
          title: autonomousForm.title,
          date: autonomousForm.date,
          sections: { category: 'Custom', isAutonomous: true }
        }).select().single()
        if (wError) throw wError

        const { error: awError } = await supabase.from('athlete_workouts').insert({ athlete_id: id, workout_id: newW.id, completed_date: autonomousForm.date, status: 'completed', notes: autonomousForm.notes })
        if (awError) throw awError
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

  const handleExportData = () => {
    const exportData = {
      athlete: athlete,
      workouts: workouts
    }
    const dataStr = JSON.stringify(exportData, null, 2)
    const blob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const linkElement = document.createElement('a')
    linkElement.setAttribute('href', url)
    linkElement.setAttribute('download', `${athlete.name}_${athlete.surname}_backup_${format(new Date(), 'yyyy-MM-dd_HH-mm-ss')}.json`.replace(/ /g, '_'))
    linkElement.click()
    URL.revokeObjectURL(url)
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

  if (loading) return <div className="p-6 text-gray-500">Caricamento scheda atleta...</div>
  if (!athlete) return <div className="p-6 text-red-400">Atleta non trovato.</div>

  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const todayWorkoutsList = workouts.filter(w => w.completed_date === todayStr)
  const upcomingWorkoutsList = workouts.filter(w => w.completed_date > todayStr).reverse()
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
    <div className="p-4 max-w-2xl mx-auto pb-24 page-transition">
      {role !== 'athlete' && !isOwnProfile ? (
        <div className="mb-6 mt-4 flex items-center gap-3">
          <button onClick={() => navigate('/athletes')} className="w-10 h-10 bg-[#1e1e1e] border border-[#333] rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:border-[#f1ba17] transition shadow-sm shrink-0">
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
                <User size={48} className="text-gray-500" />
              </div>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{athlete.name} {athlete.surname}</h1>
            {athlete.username && <p className="text-gray-400">@{athlete.username}</p>}
            {athlete.notes && <p className="text-gray-500 text-sm mt-1 max-w-sm whitespace-pre-wrap">{athlete.notes}</p>}
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {athlete.instagram_url ? (
                <a href={athlete.instagram_url.startsWith('http') ? athlete.instagram_url : `https://instagram.com/${athlete.instagram_url.replace(/^@/, '')}`} target="_blank" rel="noopener noreferrer" title="Instagram" className="flex items-center justify-center w-8 h-8 bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 text-white rounded-full hover:opacity-80 transition shadow-md shadow-pink-500/20"><InstagramIcon size={16} /></a>
              ) : (
                <button onClick={() => setSocialModalType('instagram')} title="Aggiungi Instagram" className="flex items-center justify-center w-8 h-8 bg-[#2a2a2a] text-gray-600 rounded-full hover:text-pink-500 hover:border-pink-500/50 transition border border-[#383838]"><InstagramIcon size={16} /></button>
              )}
              {athlete.strava_url ? (
                <a href={athlete.strava_url} target="_blank" rel="noopener noreferrer" title="Strava" className="flex items-center justify-center w-8 h-8 bg-[#fc4c02] text-white rounded-full hover:opacity-80 transition shadow-md shadow-[#fc4c02]/20"><Activity size={16} /></a>
              ) : (
                <button onClick={() => setSocialModalType('strava')} title="Aggiungi Strava" className="flex items-center justify-center w-8 h-8 bg-[#2a2a2a] text-gray-600 rounded-full hover:text-[#fc4c02] hover:border-[#fc4c02]/50 transition border border-[#383838]"><Activity size={16} /></button>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {role !== 'athlete' && (
            <button onClick={handleExportData} className="p-2 bg-[#2a2a2a] border border-[#383838] rounded-xl text-gray-400 hover:text-white hover:border-[#f1ba17] transition" title="Esporta Backup Atleta">
              <Download size={20} />
            </button>
          )}
          <button onClick={() => setShowEditModal(true)} className="p-2 bg-[#2a2a2a] border border-[#383838] rounded-xl text-gray-400 hover:text-white hover:border-[#f1ba17] transition" title="Modifica profilo atleta">
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
              <span className="text-black/80 text-[10px] font-bold uppercase tracking-wider mt-1">{countdownDays === 1 ? 'giorno' : 'giorni'}</span>
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

      {/* TABS */}
      <div className="flex gap-6 mb-6 border-b border-[#2a2a2a] overflow-x-auto hide-scrollbar">
        <button onClick={() => { setTab('workouts'); setShowHistory(false); }} className={`pb-3 border-b-2 font-semibold text-sm transition ${tab === 'workouts' ? 'border-[#f1ba17] text-[#f1ba17]' : 'border-transparent text-gray-500 hover:text-white'}`}>
          Diario Allenamenti
        </button>
        <button onClick={() => { setTab('prs'); setShowHistory(false); }} className={`pb-3 border-b-2 font-semibold text-sm transition ${tab === 'prs' ? 'border-[#f1ba17] text-[#f1ba17]' : 'border-transparent text-gray-500 hover:text-white'}`}>
          Personal Record (PR)
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
                className={`relative z-10 flex-1 flex justify-center items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors duration-300 ${workoutView === 'list' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
              >
                <LayoutList size={18} /> Elenco
              </button>
              <button 
                onClick={() => setWorkoutView('calendar')}
                className={`relative z-10 flex-1 flex justify-center items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors duration-300 ${workoutView === 'calendar' ? 'text-[#f1ba17]' : 'text-gray-500 hover:text-gray-300'}`}
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
                  <button onClick={prevMonth} className="p-2 rounded-xl bg-[#222] hover:bg-[#2a2a2a] text-gray-400 hover:text-white transition">
                    <ChevronLeft size={18} />
                  </button>
                  <button onClick={() => { setCurrentMonth(new Date()); setSelectedDay(new Date()); }} className="px-3 py-1.5 rounded-xl bg-[#222] hover:bg-[#2a2a2a] text-gray-400 hover:text-white text-sm transition">
                    Oggi
                  </button>
                  <button onClick={nextMonth} className="p-2 rounded-xl bg-[#222] hover:bg-[#2a2a2a] text-gray-400 hover:text-white transition">
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 mb-2">
                {['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((d, i) => (
                  <div key={i} className="text-center text-gray-600 text-xs font-medium py-1">{d}</div>
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
                            const isCustom = cat === 'Custom' || cat === 'Autonomo'
                              const isEvent = cat === 'Event'
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
                     <p className="text-gray-600 text-sm">Nessun workout in questa data.</p>
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
                      <p className="text-gray-500 text-sm mt-0.5">{pastWorkoutsList.length} workout completati o passati</p>
                    </div>
                  </div>
                  <ChevronRight size={20} className="text-gray-500 group-hover:text-white transition" />
                </button>
              )}
            </div>
          ) : (
              <div className="bg-[#1e1e1e] border border-dashed border-[#2a2a2a] rounded-2xl p-6 text-center">
              <p className="text-gray-600 text-sm">Nessun workout registrato per questo atleta.</p>
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
                       <p className="text-gray-500 text-xs mt-1">{format(parseISO(pr.date), 'd MMMM yyyy', { locale: it })}</p>
                     </div>
                  </div>
               ))}
             </div>
           ) : (
             <div className="bg-[#1e1e1e] border border-dashed border-[#2a2a2a] rounded-2xl p-6 text-center">
               <p className="text-gray-600 text-sm mb-2">Nessun Personal Record registrato.</p>
               <p className="text-gray-500 text-xs">Aggiungi i tuoi massimali di forza o i tuoi migliori tempi di corsa per tenerne traccia nel tempo!</p>
             </div>
           )}
        </div>
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
            if (isNew) setShowCelebration(true); 
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
      
      {showCelebration && createPortal(
        <CelebrationOverlay onClose={() => setShowCelebration(false)} />,
        document.body
      )}

      {/* MODAL ALLENAMENTO AUTONOMO */}
      {autonomousModalOpen && createPortal(
        <div className="fixed inset-0 bg-black/85 z-[100] flex items-center justify-center p-4">
          <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-3xl w-full max-w-sm p-6 flex flex-col gap-4 shadow-2xl animate-in fade-in zoom-in-[0.96] duration-300 ease-out">
            <div className="flex justify-between items-center mb-2">
               <h2 className="text-xl font-bold text-white">{autonomousForm.id ? 'Modifica Allenamento' : 'Allenamento Libero'}</h2>
               <button onClick={() => setAutonomousModalOpen(false)} className="text-gray-500 hover:text-white"><X size={20} /></button>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-gray-400 text-xs pl-1 mb-1 block">Titolo</label>
                <input 
                  className="bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#f1ba17] w-full text-sm"
                  value={autonomousForm.title}
                  onChange={(e) => setAutonomousForm({ ...autonomousForm, title: e.target.value })}
                  placeholder="Es. Corsa 5km, Calcetto..."
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs pl-1 mb-1 block">Data</label>
                <CustomDatePicker
                  date={autonomousForm.date}
                  onChange={(d) => setAutonomousForm({ ...autonomousForm, date: d })}
                  className="bg-[#111] border border-[#333] rounded-xl px-4 py-3 hover:border-[#f1ba17] w-full"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs pl-1 mb-1 block">Descrizione / Note</label>
                <textarea 
                  className="bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#f1ba17] w-full text-sm resize-none"
                  rows={3}
                  value={autonomousForm.notes}
                  onChange={(e) => setAutonomousForm({ ...autonomousForm, notes: e.target.value })}
                  placeholder="Com'è andata?"
                />
              </div>
              <button 
                onClick={handleSaveAutonomous}
                disabled={!autonomousForm.title || savingAutonomous}
                className="w-full mt-2 py-3 bg-[#f1ba17] text-black font-bold rounded-xl hover:brightness-110 transition disabled:opacity-50"
              >
                {savingAutonomous ? 'Salvataggio...' : 'Conferma'}
              </button>
            </div>
          </div>
        </div>,
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
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-gray-400 text-xs pl-1 block mb-1">
              {isInsta ? 'Username o link profilo' : 'Link profilo Strava'}
            </label>
            {isInsta ? (
               <div className="flex items-center bg-[#111] border border-[#333] rounded-xl overflow-hidden focus-within:border-pink-500 transition">
                  <div className="pl-4 pr-3 py-3 text-gray-500 flex items-center justify-center border-r border-[#333]">
                     <InstagramIcon size={18} className="text-pink-500" />
                  </div>
                  <div className="pl-3 text-gray-400 text-sm font-semibold">@</div>
                  <input autoFocus className="w-full bg-transparent pr-3 py-3 text-white placeholder-gray-500 focus:outline-none text-sm" placeholder="Nome utente" value={url} onChange={e => setUrl(e.target.value)} />
               </div>
            ) : (
               <div className="flex items-center bg-[#111] border border-[#333] rounded-xl overflow-hidden focus-within:border-[#fc4c02] transition">
                  <div className="pl-4 pr-3 py-3 text-gray-500 flex items-center justify-center border-r border-[#333]">
                     <Activity size={18} className="text-[#fc4c02]" />
                  </div>
                  <input autoFocus className="w-full bg-transparent px-3 py-3 text-white placeholder-gray-500 focus:outline-none text-sm" placeholder="Link profilo..." value={url} onChange={e => setUrl(e.target.value)} />
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

function CelebrationOverlay({ onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3500)
    return () => clearTimeout(timer)
  }, [onClose])
  
  return (
    <div className="fixed inset-0 z-[200] pointer-events-none flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-500"></div>
      <div className="relative z-10 flex flex-col items-center animate-in zoom-in-50 duration-500 slide-in-from-bottom-10">
        <div className="text-9xl mb-4 animate-bounce" style={{ animationDuration: '1s' }}>🏆</div>
        <h2 className="text-5xl font-black text-white text-center drop-shadow-2xl italic tracking-wider">NUOVO PR!</h2>
        <p className="text-[#f1ba17] font-bold text-2xl mt-3 drop-shadow-lg">Ottimo lavoro!</p>
      </div>
      {Array.from({ length: 100 }).map((_, i) => (
        <div 
          key={i}
          className="absolute w-3 h-3 rounded-sm animate-confetti"
          style={{
            left: `${Math.random() * 100}%`,
            top: `-5%`,
            backgroundColor: ['#f1ba17', '#0094C6', '#22c55e', '#ef4444', '#a855f7', '#ffffff'][Math.floor(Math.random() * 6)],
            animationDelay: `${Math.random() * 2}s`,
            animationDuration: `${1.5 + Math.random() * 2}s`
          }}
        />
      ))}
      <style>{`
        @keyframes confetti {
          0% { transform: translateY(0) rotate(0deg) scale(1); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg) scale(0.5); opacity: 0; }
        }
        .animate-confetti {
          animation: confetti linear forwards;
        }
      `}</style>
    </div>
  )
}

function TodayAthleteWorkoutCard({ entry, onToggleStatus, onUpdateNote, onRemove, navigate, athleteId, role, onEditAutonomous }) {
  const [note, setNote] = useState(entry.notes || '')
  const [saving, setSaving] = useState(false)
  
  const hasChanges = note !== (entry.notes || '')

  const rawCat = entry.workouts?.sections?.category || (entry.workouts?.sections?.steps ? 'Running' : 'Hyrox')
  const isAuto = rawCat === 'Custom' || rawCat === 'Autonomo'
  const isEvent = rawCat === 'Event'
  const category = isEvent ? 'Event' : (isAuto ? 'Custom' : rawCat)
  const isRun = category === 'Running'

  const handleSaveNote = async () => {
    setSaving(true)
    await onUpdateNote(entry.id, note)
    setSaving(false)
  }

  return (
    <div 
      className={`rounded-3xl p-5 transition border relative overflow-hidden group ${
        entry.status === 'completed'
          ? 'bg-green-500/10 border-green-500/30'
          : (isEvent ? 'bg-gradient-to-br from-[#2a2a2a] to-[#1e1e1e] border-white/50' : isRun ? 'bg-gradient-to-br from-[#2a2a2a] to-[#1e1e1e] border-[#0094C6]/50' : isAuto ? 'bg-gradient-to-br from-[#2a2a2a] to-[#1e1e1e] border-[#D11149]/50' : 'bg-gradient-to-br from-[#2a2a2a] to-[#1e1e1e] border-[#f1ba17]/50')
      }`}
    >
      <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
        {entry.status === 'completed' ? <CheckCircle2 size={80} className="text-green-500 -rotate-12" /> : (isEvent ? <CalendarDays size={80} className="text-white/30 -rotate-12" /> : isRun ? <Timer size={80} className="text-[#0094C6] -rotate-12" /> : isAuto ? <Dumbbell size={80} className="text-[#D11149] -rotate-12" /> : <Flame size={80} className="text-[#f1ba17] -rotate-12" />)}
      </div>
      <div className="relative z-10 flex flex-col gap-4">
        <div className="flex justify-between items-start gap-2">
           <div className="flex items-center gap-4 cursor-pointer flex-1 min-w-0" onClick={() => navigate(`/workout/${entry.workouts.id}?athlete_id=${athleteId}`)}>
             <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg shrink-0 ${
               entry.status === 'completed' ? 'bg-green-500 text-black shadow-green-500/20' : (isEvent ? 'bg-white text-black shadow-white/20' : isRun ? 'bg-[#0094C6] text-white shadow-[#0094C6]/20' : isAuto ? 'bg-[#D11149] text-white shadow-[#D11149]/20' : 'bg-[#f1ba17] text-black shadow-[#f1ba17]/20')
             }`}>
               {entry.status === 'completed' ? <CheckCircle2 size={24} /> : (isEvent ? <CalendarDays size={24} /> : isRun ? <Timer size={24} /> : <Dumbbell size={24} />)}
             </div>
             <div className="min-w-0">
               <h3 className="text-white font-bold text-xl leading-tight group-hover:underline underline-offset-4 truncate">{entry.workouts.title}</h3>
               <p className={`text-sm font-medium mt-1 ${entry.status === 'completed' ? 'text-green-400' : (isEvent ? 'text-gray-300' : isRun ? 'text-[#0094C6]' : isAuto ? 'text-[#D11149]' : 'text-[#f1ba17]')}`}>
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
                     : `border-[#333] text-gray-300 ${isEvent ? 'hover:border-white hover:text-white' : isRun ? 'hover:border-[#0094C6] hover:text-[#0094C6]' : isAuto ? 'hover:border-[#D11149] hover:text-[#D11149]' : 'hover:border-[#f1ba17] hover:text-[#f1ba17]'}`
               }`}
             >
               {entry.status === 'completed' ? <CheckCircle2 size={14} /> : <Circle size={14} />} {entry.status === 'completed' ? 'Fatto' : 'Segna fatto'}
             </button>
             
             {(role !== 'athlete' || isAuto) && (
               <div className="flex items-center gap-1 mt-1">
                 {role === 'athlete' && isAuto && onEditAutonomous && (
                   <button 
                     onClick={(e) => { e.stopPropagation(); onEditAutonomous(entry); }}
                     className="text-gray-500 hover:text-[#f1ba17] transition p-1"
                     title="Modifica allenamento libero"
                   >
                     <Edit size={16} />
                   </button>
                 )}
                 <button 
                   onClick={(e) => { e.stopPropagation(); onRemove(entry.id); }}
                   className="text-gray-500 hover:text-red-500 transition p-1"
                   title={isAuto ? "Elimina allenamento libero" : "Rimuovi assegnazione"}
                 >
                   <Trash2 size={16} />
                 </button>
               </div>
             )}
           </div>
        </div>

        <div className="pt-2 border-t border-white/5">
          <textarea
            className={`w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-gray-500 focus:outline-none resize-none text-sm transition-colors ${isEvent ? 'focus:border-white' : isRun ? 'focus:border-[#0094C6]' : isAuto ? 'focus:border-[#D11149]' : 'focus:border-[#f1ba17]'}`}
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
                className={`font-bold px-4 py-1.5 rounded-xl text-sm hover:brightness-110 transition disabled:opacity-50 ${isEvent ? 'bg-white text-black' : isRun ? 'bg-[#0094C6] text-white' : isAuto ? 'bg-[#D11149] text-white' : 'bg-[#f1ba17] text-black'}`}
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
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <div>
            <label className="text-gray-400 text-xs pl-1 mb-1 block">Esercizio o Distanza *</label>
            <input type="text" placeholder="Es. Back Squat, 5km Run" value={exercise} onChange={e => setExercise(e.target.value)} className="w-full bg-[#111] border border-[#333] text-white px-4 py-3 rounded-xl focus:outline-none focus:border-[#f1ba17] text-sm" />
          </div>
          <div>
            <label className="text-gray-400 text-xs pl-1 mb-1 block">Risultato / Record *</label>
            <input type="text" placeholder="Es. 120 kg, 22:30 min" value={value} onChange={e => setValue(e.target.value)} className="w-full bg-[#111] border border-[#333] text-white px-4 py-3 rounded-xl focus:outline-none focus:border-[#f1ba17] text-sm" />
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
    onSaved()
  }

  const handleDeleteAthlete = async () => {
    const { error } = await supabase.from('athletes').delete().eq('id', athlete.id)
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
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={20} /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-5 flex flex-col gap-4">
          <div className="flex justify-center">
            <label className="cursor-pointer relative">
              <div className="w-20 h-20 rounded-full bg-[#2a2a2a] border-2 border-dashed border-[#444] flex items-center justify-center overflow-hidden hover:border-[#f1ba17] transition">
                {photoPreview
                  ? <img src={photoPreview} className="w-full h-full object-cover" onError={() => setPhotoPreview(null)} />
                  : <User size={28} className="text-gray-500" />
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
              <input className="bg-[#2a2a2a] border border-[#383838] rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#f1ba17]" placeholder="Mario" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-gray-400 text-xs pl-1">Cognome *</label>
              <input className="bg-[#2a2a2a] border border-[#383838] rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#f1ba17]" placeholder="Rossi" value={form.surname} onChange={e => setForm({ ...form, surname: e.target.value })} />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-gray-400 text-xs pl-1">Data di nascita</label>
            <input type="date" className="bg-[#2a2a2a] border border-[#383838] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#f1ba17]" value={form.birth_date} onChange={e => setForm({ ...form, birth_date: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-gray-400 text-xs pl-1">Peso (kg)</label>
              <input className="bg-[#2a2a2a] border border-[#383838] rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#f1ba17]" placeholder="Es. 75" type="number" value={form.weight} onChange={e => setForm({ ...form, weight: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-gray-400 text-xs pl-1">Altezza (cm)</label>
              <input className="bg-[#2a2a2a] border border-[#383838] rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#f1ba17]" placeholder="Es. 180" type="number" value={form.height} onChange={e => setForm({ ...form, height: e.target.value })} />
            </div>
          </div>
          <textarea className="bg-[#2a2a2a] border border-[#383838] rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#f1ba17] resize-none" rows={3} placeholder="Note biografiche (facoltativo)" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          
          <div className="flex flex-col gap-3">
             <div className="flex items-center bg-[#2a2a2a] border border-[#383838] rounded-xl overflow-hidden focus-within:border-pink-500 transition">
                <div className="pl-4 pr-3 py-3 text-gray-500 flex items-center justify-center bg-[#1e1e1e] border-r border-[#383838]">
                   <InstagramIcon size={18} className="text-pink-500" />
                </div>
                <div className="pl-3 text-gray-400 text-sm font-semibold">@</div>
                <input className="w-full bg-transparent pr-3 py-3 text-white placeholder-gray-500 focus:outline-none text-sm" placeholder="Nome utente" value={form.instagram_url?.replace(/^@/, '')} onChange={e => {
                   let val = e.target.value.replace(/^@/, '').trim();
                   if (val.includes('instagram.com/')) {
                     val = val.split('instagram.com/')[1].split('/')[0].split('?')[0];
                   }
                   setForm({ ...form, instagram_url: val })
                }} />
             </div>
             <div className="flex items-center bg-[#2a2a2a] border border-[#383838] rounded-xl overflow-hidden focus-within:border-[#fc4c02] transition">
                <div className="pl-4 pr-3 py-3 text-gray-500 flex items-center justify-center bg-[#1e1e1e] border-r border-[#383838]">
                   <Activity size={18} className="text-[#fc4c02]" />
                </div>
                <input className="w-full bg-transparent px-3 py-3 text-white placeholder-gray-500 focus:outline-none text-sm" placeholder="Link profilo Strava..." value={form.strava_url} onChange={e => setForm({ ...form, strava_url: e.target.value })} />
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
                <p className="text-red-400 text-sm font-semibold mb-3">Sei sicuro? Questa azione eliminerà {role === 'athlete' ? 'il tuo account' : 'l\'atleta'} e non può essere annullata.</p>
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

function WorkoutEntryCard({ entry, onToggleStatus, onUpdateNote, onRemove, navigate, athleteId, role, onEditAutonomous }) {
  const [note, setNote] = useState(entry.notes || '')
  const [saving, setSaving] = useState(false)
  
  const hasChanges = note !== (entry.notes || '')

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
  const isAuto = rawCat === 'Custom' || rawCat === 'Autonomo'
  const isEvent = rawCat === 'Event'
  const category = isEvent ? 'Event' : (isAuto ? 'Custom' : rawCat)
  const isRun = category === 'Running'

  const handleSaveNote = async () => {
    setSaving(true)
    await onUpdateNote(entry.id, note)
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
            <p className={`font-semibold text-white transition underline underline-offset-4 leading-tight ${isEvent ? 'group-hover:text-white decoration-white/50' : isRun ? 'group-hover:text-[#0094C6] decoration-[#0094C6]/50' : isAuto ? 'group-hover:text-[#D11149] decoration-[#D11149]/50' : 'group-hover:text-[#f1ba17] decoration-[#f1ba17]/50'}`}>
              {entry.workouts.title}
            </p>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0 ${isEvent ? 'bg-white text-black border-white' : isRun ? 'bg-[#0094C6]/10 text-[#0094C6] border-[#0094C6]/30' : isAuto ? 'bg-[#D11149]/10 text-[#D11149] border-[#D11149]/30' : 'bg-[#f1ba17]/10 text-[#f1ba17] border-[#f1ba17]/30'}`}>
              {isEvent ? 'Evento / Gara' : category}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1.5">
            {format(parseISO(entry.completed_date), 'EEEE d MMMM yyyy', { locale: it })}
          </p>
        </div>
        {(role !== 'athlete' || isAuto) && (
          <div className="flex items-center gap-1 shrink-0 ml-2">
            {role === 'athlete' && isAuto && onEditAutonomous && (
              <button 
                onClick={(e) => { e.stopPropagation(); onEditAutonomous(entry); }}
                className="text-gray-500 hover:text-[#f1ba17] transition p-1"
                title="Modifica allenamento libero"
              >
                <Edit size={18} />
              </button>
            )}
            <button 
              onClick={(e) => { e.stopPropagation(); onRemove(entry.id); }}
              className="text-gray-500 hover:text-red-500 transition p-1"
              title={isAuto ? "Elimina allenamento libero" : "Rimuovi assegnazione"}
            >
              <Trash2 size={18} />
            </button>
          </div>
        )}
      </div>

      <button 
        onClick={() => onToggleStatus(entry.id, entry.status, entry.completed_date)}
        className={`w-full py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition border ${
          entry.status === 'completed' 
            ? 'bg-green-500/10 border-green-500/30 text-green-500 hover:bg-green-500/20' 
            : isBefore(scheduledDate, today)
              ? `bg-[#111] border-[#333] text-gray-500 ${isEvent ? 'hover:border-white hover:text-white' : isRun ? 'hover:border-[#0094C6] hover:text-[#0094C6]' : isAuto ? 'hover:border-[#D11149] hover:text-[#D11149]' : 'hover:border-[#f1ba17] hover:text-[#f1ba17]'}`
              : `bg-[#2a2a2a] border-[#383838] text-gray-300 ${isEvent ? 'hover:border-white hover:text-white' : isRun ? 'hover:border-[#0094C6] hover:text-[#0094C6]' : isAuto ? 'hover:border-[#D11149] hover:text-[#D11149]' : 'hover:border-[#f1ba17] hover:text-[#f1ba17]'}`
        }`}
      >
        <Icon size={18} /> {statusText}
      </button>

      <div className="mt-3 pt-3 border-t border-[#2a2a2a]">
        <textarea
          className={`w-full bg-[#2a2a2a] border border-[#383838] rounded-xl px-3 py-2 text-white placeholder-gray-600 focus:outline-none resize-none text-sm transition-colors ${isEvent ? 'focus:border-white' : isRun ? 'focus:border-[#0094C6]' : isAuto ? 'focus:border-[#D11149]' : 'focus:border-[#f1ba17]'}`}
          rows={3}
          placeholder="Copia qui le note dell'atleta su questo workout..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className={`transition-all duration-300 ease-out overflow-hidden ${hasChanges ? 'max-h-16 opacity-100 mt-2' : 'max-h-0 opacity-0 mt-0'}`}>
          <div className="flex justify-end">
            <button
              onClick={handleSaveNote}
              disabled={saving}
              className={`font-bold px-4 py-1.5 rounded-xl text-sm hover:brightness-110 transition disabled:opacity-50 ${isEvent ? 'bg-white text-black' : isRun ? 'bg-[#0094C6] text-white' : isAuto ? 'bg-[#D11149] text-white' : 'bg-[#f1ba17] text-black'}`}
            >
              {saving ? 'Salvataggio...' : 'Conferma'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function AssignWorkoutModal({ athleteId, onClose, onAssigned }) {
  const [workouts, setWorkouts] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [assigning, setAssigning] = useState(null)
  const [alertInfo, setAlertInfo] = useState(null)
  const [assignDate, setAssignDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [selectedWorkout, setSelectedWorkout] = useState(null)
  const [previewWorkout, setPreviewWorkout] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    async function fetchW() {
      const { data } = await supabase.from('workouts').select('id, title, date, sections').order('date', { ascending: false })
      setWorkouts(data || [])
      setLoading(false)
    }
    fetchW()
  }, [])

  const handleAssign = async () => {
   if (!assignDate) {
      setAlertInfo({ title: 'Errore', message: 'Seleziona una data per l\'assegnazione', type: 'error' })
      return
    }
    setAssigning(selectedWorkout.id)
    const { error } = await supabase.from('athlete_workouts').insert({
      athlete_id: athleteId,
      workout_id: selectedWorkout.id,
      completed_date: assignDate,
      status: 'pending'
    })
    if (error) {
      setAlertInfo({ title: 'Errore', message: error.message, type: 'error' })
      setAssigning(null)
    } else {
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
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={20} /></button>
        </div>
        {!selectedWorkout ? (
          <>
            <div className="p-4 border-b border-[#2a2a2a]">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-3.5 text-gray-500" />
                <input type="text" placeholder="Cerca workout..." value={search} onChange={e => setSearch(e.target.value)} className="w-full bg-[#111] border border-[#333] text-white px-4 py-2.5 pl-9 rounded-xl focus:outline-none focus:border-[#f1ba17] text-sm" />
              </div>
            </div>
            <div className="overflow-y-auto flex-1 p-4 flex flex-col gap-2">
              {loading ? (
                <p className="text-gray-500 text-sm text-center py-4">Caricamento...</p>
              ) : filtered.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">Nessun workout trovato.</p>
              ) : (
                filtered.map(w => (
                  <div key={w.id} className="flex items-center justify-between bg-[#2a2a2a] border border-[#333] p-3 rounded-xl hover:border-[#f1ba17] transition group">
                    <div 
                      className="flex-1 min-w-0 pr-3 text-left cursor-pointer"
                      onClick={() => setPreviewWorkout(w)}
                    >
                      <p className="text-white font-semibold text-sm truncate group-hover:text-[#f1ba17] transition">{w.title}</p>
                      <p className="text-gray-500 text-xs mt-0.5">{w.date && isValid(parseISO(w.date)) ? format(parseISO(w.date), 'dd/MM/yyyy') : 'Data sconosciuta'} • {w.sections?.category || 'Generico'}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button 
                        onClick={(e) => { e.stopPropagation(); navigate(`/create?duplicate=${w.id}&athlete_id=${athleteId}`); }} 
                        className="p-1.5 bg-[#111] border border-[#333] rounded-lg text-gray-400 hover:text-white hover:border-[#f1ba17] transition"
                        title="Duplica e Modifica"
                      >
                        <Copy size={16} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setSelectedWorkout(w); }} className="bg-[#f1ba17]/10 text-[#f1ba17] font-semibold px-3 py-1.5 rounded-lg text-xs hover:bg-[#f1ba17] hover:text-black transition">
                        Assegna
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <div className="p-5 flex flex-col gap-4">
            <div>
              <p className="text-gray-400 text-sm mb-1">Stai assegnando:</p>
              <p className="text-white font-bold">{selectedWorkout.title}</p>
            </div>
            <div>
              <label className="text-gray-400 text-sm mb-2 block">Seleziona la data dell'allenamento</label>
              <CustomDatePicker
                date={assignDate}
                onChange={setAssignDate}
                className="bg-[#111] border border-[#333] rounded-xl px-4 py-3 hover:border-[#f1ba17]"
              />
            </div>
            <div className="flex gap-3 mt-2">
              <button onClick={() => setSelectedWorkout(null)} className="flex-1 py-3 bg-[#2a2a2a] text-white font-semibold rounded-xl hover:bg-[#333] transition disabled:opacity-50">
                Indietro
              </button>
              <button onClick={handleAssign} disabled={assigning === selectedWorkout.id} className="flex-1 py-3 bg-[#f1ba17] text-black font-bold rounded-xl hover:brightness-110 transition disabled:opacity-50">
                {assigning === selectedWorkout.id ? 'Assegno...' : 'Conferma'}
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
              <button onClick={() => setPreviewWorkout(null)} className="text-gray-500 hover:text-white shrink-0"><X size={20} /></button>
            </div>
            <div className="overflow-y-auto p-5 flex flex-col gap-3">
              {(() => {
                const s = previewWorkout.sections || {};
                const isRun = s.category === 'Running' || s.steps;
                const blocks = s.blocks || [];
                const steps = s.steps || s.main?.steps || [];
                
                if (isRun) {
                  if (steps.length === 0) return <p className="text-gray-500 text-sm">Nessun dettaglio disponibile.</p>;
                  return steps.map((step, i) => (
                    <div key={i} className="bg-[#2a2a2a] p-3 rounded-xl border border-[#383838]">
                      <p className="text-[#0094C6] font-bold text-xs uppercase mb-1">{step.type === 'repeat' ? `Ripetute (${step.rounds}x)` : step.type}</p>
                      {step.type === 'repeat' ? (
                        <div className="text-sm text-white flex flex-col gap-1">
                          <p><span className="text-gray-400">Corsa:</span> {step.runDuration} {step.runPace ? <span className="text-gray-500 text-xs">@{step.runPace}</span> : ''}</p>
                          <p><span className="text-gray-400">Recupero:</span> {step.recDuration} {step.recPace ? <span className="text-gray-500 text-xs">@{step.recPace}</span> : ''}</p>
                        </div>
                      ) : (
                        <p className="text-sm text-white">{step.duration} {step.pace ? <span className="text-gray-500 text-xs ml-1">@{step.pace}</span> : ''}</p>
                      )}
                      {step.notes && <p className="text-gray-400 text-xs mt-1.5 italic">"{step.notes}"</p>}
                    </div>
                  ));
                } else {
                  if (blocks.length === 0) return <p className="text-gray-500 text-sm">Nessun dettaglio disponibile.</p>;
                  return blocks.map((b, i) => {
                    let shortTitle = b.type;
                    if (b.type === 'EMOM') shortTitle = `EMOM ${b.params?.rounds ? b.params.rounds + 'x' : ''}`;
                    else if (b.type === 'AMRAP') shortTitle = `AMRAP ${b.params?.duration || ''}`;
                    else if (b.type === 'ON/OFF') shortTitle = `ON/OFF ${b.params?.rounds ? b.params.rounds + 'x ' : ''}• ${b.params?.on || ''}/${b.params?.off || ''}`;
                    else if (b.type === 'For Time') shortTitle = `FOR TIME ${b.params?.rounds ? b.params.rounds + 'x' : ''}`;
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
                              const detail = (ex.meters && ex.meters !== '-') ? ex.meters : (ex.reps && ex.reps !== '-' ? `${ex.reps} reps` : '');
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
                  setSelectedWorkout(previewWorkout);
                  setPreviewWorkout(null);
                }}
                className="w-full py-3 bg-[#f1ba17] text-black font-bold rounded-xl hover:brightness-110 transition shadow-lg shadow-[#f1ba17]/20"
              >
                Assegna questo Workout
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

function StatCard({ label, value }) {
  return (
    <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-white font-bold text-lg">{value}</p>
    </div>
  )
}