import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { ChevronLeft, User, Upload, BookOpen, Trash2, AlertTriangle, Plus, Edit, X, Download, Dumbbell, Search, CheckCircle2, Circle, Trophy, Timer, Flame, FolderArchive, ChevronRight } from 'lucide-react'
import { format, parseISO, differenceInYears, isBefore, startOfDay, isValid } from 'date-fns'
import { it } from 'date-fns/locale'
import { CustomAlert, CustomConfirm } from '../components/CustomModals'
import CustomDatePicker from '../components/CustomDatePicker'
import { useAuth } from '../App'

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
  const [showHistory, setShowHistory] = useState(false)
  const [loading, setLoading] = useState(true)
  const [workoutToRemove, setWorkoutToRemove] = useState(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [prModalOpen, setPrModalOpen] = useState(false)
  const [editingPr, setEditingPr] = useState(null)
  const [showCelebration, setShowCelebration] = useState(false)
  const [alertInfo, setAlertInfo] = useState(null)
  const [confirmInfo, setConfirmInfo] = useState(null)

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

      {/* Statistiche */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <StatCard label="Età" value={calculateAge(athlete.birth_date)} />
        <StatCard label="Altezza" value={athlete.height ? `${athlete.height} cm` : 'N/A'} />
        <StatCard label="Peso" value={athlete.weight ? `${athlete.weight} kg` : 'N/A'} />
        <StatCard label="Workouts" value={workouts.length} />
      </div>

      {/* TABS */}
      <div className="flex gap-6 mb-6 border-b border-[#2a2a2a]">
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
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <BookOpen size={20} className="text-[#f1ba17]" />
              Diario Workout
            </h2>
            {role !== 'athlete' && (
              <div className="flex gap-2">
                <button 
                  onClick={() => setAssignModalOpen(true)}
                  className="flex items-center gap-1 text-black text-sm font-semibold bg-[#f1ba17] px-3 py-1.5 rounded-full transition hover:brightness-110 shadow-lg shadow-[#f1ba17]/20"
                >
                  <Dumbbell size={14} className="hidden sm:block" /> Assegna
                </button>
                <button 
                  onClick={() => navigate(`/create?athlete_id=${id}`)}
                  className="flex items-center gap-1 text-[#f1ba17] text-sm font-semibold bg-[#f1ba17]/10 border border-[#f1ba17]/30 px-3 py-1.5 rounded-full transition hover:brightness-110"
                >
                  <Plus size={16} /> Crea
                </button>
              </div>
            )}
          </div>
          {workouts.length > 0 ? (
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
        )
      ) : (
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
      )}

      {/* MODAL CONFERMA RIMOZIONE WORKOUT */}
      {workoutToRemove && createPortal(
        <div className="fixed inset-0 bg-black/85 z-[100] flex items-center justify-center p-4">
          <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-3xl w-full max-w-sm p-6 flex flex-col gap-4 text-center shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-red-900/30 text-red-500 flex items-center justify-center mx-auto mb-2 shrink-0">
              <AlertTriangle size={32} />
            </div>
            <h2 className="text-xl font-bold text-white">Sei sicuro?</h2>
            <p className="text-gray-400 text-sm">
              Questa azione rimuoverà l'allenamento assegnato a questo atleta.
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
                Rimuovi
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
      
      {showCelebration && createPortal(
        <CelebrationOverlay onClose={() => setShowCelebration(false)} />,
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

function TodayAthleteWorkoutCard({ entry, onToggleStatus, onUpdateNote, onRemove, navigate, athleteId, role }) {
  const [note, setNote] = useState(entry.notes || '')
  const [saving, setSaving] = useState(false)
  
  const hasChanges = note !== (entry.notes || '')

  const category = entry.workouts?.sections?.category || (entry.workouts?.sections?.steps ? 'Running' : 'Hyrox')
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
          : (isRun ? 'bg-gradient-to-br from-[#2a2a2a] to-[#1e1e1e] border-[#0094C6]/50' : 'bg-gradient-to-br from-[#2a2a2a] to-[#1e1e1e] border-[#f1ba17]/50')
      }`}
    >
      <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
        {entry.status === 'completed' ? <CheckCircle2 size={80} className="text-green-500 -rotate-12" /> : (isRun ? <Timer size={80} className="text-[#0094C6] -rotate-12" /> : <Flame size={80} className="text-[#f1ba17] -rotate-12" />)}
      </div>
      <div className="relative z-10 flex flex-col gap-4">
        <div className="flex justify-between items-start gap-2">
           <div className="flex items-center gap-4 cursor-pointer flex-1 min-w-0" onClick={() => navigate(`/workout/${entry.workouts.id}?athlete_id=${athleteId}`)}>
             <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg shrink-0 ${
               entry.status === 'completed' ? 'bg-green-500 text-black shadow-green-500/20' : (isRun ? 'bg-[#0094C6] text-white shadow-[#0094C6]/20' : 'bg-[#f1ba17] text-black shadow-[#f1ba17]/20')
             }`}>
               {entry.status === 'completed' ? <CheckCircle2 size={24} /> : (isRun ? <Timer size={24} /> : <Dumbbell size={24} />)}
             </div>
             <div className="min-w-0">
               <h3 className="text-white font-bold text-xl leading-tight group-hover:underline underline-offset-4 truncate">{entry.workouts.title}</h3>
               <p className={`text-sm font-medium mt-1 ${entry.status === 'completed' ? 'text-green-400' : (isRun ? 'text-[#0094C6]' : 'text-[#f1ba17]')}`}>
                 {entry.status === 'completed' ? 'Completato! 🎉' : 'Da fare oggi 🔥'}
               </p>
             </div>
           </div>
           
           <div className="flex flex-col items-end gap-2 shrink-0">
             <button 
               onClick={() => onToggleStatus(entry.id, entry.status, entry.completed_date)}
               className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition border bg-[#111]/50 backdrop-blur-md ${
                 entry.status === 'completed' 
                   ? 'border-green-500 text-green-500 hover:bg-green-500/20' 
                   : `border-[#333] text-gray-300 ${isRun ? 'hover:border-[#0094C6] hover:text-[#0094C6]' : 'hover:border-[#f1ba17] hover:text-[#f1ba17]'}`
               }`}
             >
               {entry.status === 'completed' ? <CheckCircle2 size={14} /> : <Circle size={14} />} {entry.status === 'completed' ? 'Fatto' : 'Segna fatto'}
             </button>
             
             {role !== 'athlete' && (
               <button 
                 onClick={(e) => { e.stopPropagation(); onRemove(entry.id); }}
                 className="text-gray-500 hover:text-red-500 transition p-1"
                 title="Rimuovi assegnazione"
               >
                 <Trash2 size={16} />
               </button>
             )}
           </div>
        </div>

        <div className="pt-2 border-t border-white/5">
          <textarea
            className={`w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-gray-500 focus:outline-none resize-none text-sm transition-colors ${isRun ? 'focus:border-[#0094C6]' : 'focus:border-[#f1ba17]'}`}
            rows={2}
            placeholder="Note dell'atleta su questo workout..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          {hasChanges && (
            <div className="mt-2 flex justify-end">
              <button
                onClick={handleSaveNote}
                disabled={saving}
                className={`font-bold px-4 py-1.5 rounded-xl text-sm hover:brightness-110 transition disabled:opacity-50 ${isRun ? 'bg-[#0094C6] text-white' : 'bg-[#f1ba17] text-black'}`}
              >
                {saving ? 'Salvataggio...' : 'Conferma note'}
              </button>
            </div>
          )}
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
      <div className="bg-[#1e1e1e] rounded-3xl w-full max-w-sm flex flex-col border border-[#333]">
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
    notes: athlete.notes || '' 
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
      <div className="bg-[#1e1e1e] rounded-3xl w-full max-w-md flex flex-col" style={{ maxHeight: 'calc(100vh - 100px)' }}>
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

function WorkoutEntryCard({ entry, onToggleStatus, onUpdateNote, onRemove, navigate, athleteId, role }) {
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

  const category = entry.workouts?.sections?.category || (entry.workouts?.sections?.steps ? 'Running' : 'Hyrox')
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
            <p className={`font-semibold text-white transition underline underline-offset-4 leading-tight ${isRun ? 'group-hover:text-[#0094C6] decoration-[#0094C6]/50' : 'group-hover:text-[#f1ba17] decoration-[#f1ba17]/50'}`}>
              {entry.workouts.title}
            </p>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0 ${isRun ? 'bg-[#0094C6]/10 text-[#0094C6] border-[#0094C6]/30' : 'bg-[#f1ba17]/10 text-[#f1ba17] border-[#f1ba17]/30'}`}>
              {category}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1.5">
            {format(parseISO(entry.completed_date), 'EEEE d MMMM yyyy', { locale: it })}
          </p>
        </div>
        {role !== 'athlete' && (
          <button 
            onClick={() => onRemove(entry.id)}
            className="text-gray-500 hover:text-red-500 transition p-1 shrink-0"
            title="Rimuovi assegnazione"
          >
            <Trash2 size={18} />
          </button>
        )}
      </div>

      <button 
        onClick={() => onToggleStatus(entry.id, entry.status, entry.completed_date)}
        className={`w-full py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition border ${
          entry.status === 'completed' 
            ? 'bg-green-500/10 border-green-500/30 text-green-500 hover:bg-green-500/20' 
            : isBefore(scheduledDate, today)
              ? `bg-[#111] border-[#333] text-gray-500 ${isRun ? 'hover:border-[#0094C6] hover:text-[#0094C6]' : 'hover:border-[#f1ba17] hover:text-[#f1ba17]'}`
              : `bg-[#2a2a2a] border-[#383838] text-gray-300 ${isRun ? 'hover:border-[#0094C6] hover:text-[#0094C6]' : 'hover:border-[#f1ba17] hover:text-[#f1ba17]'}`
        }`}
      >
        <Icon size={18} /> {statusText}
      </button>

      <div className="mt-3 pt-3 border-t border-[#2a2a2a]">
        <textarea
          className={`w-full bg-[#2a2a2a] border border-[#383838] rounded-xl px-3 py-2 text-white placeholder-gray-600 focus:outline-none resize-none text-sm transition-colors ${isRun ? 'focus:border-[#0094C6]' : 'focus:border-[#f1ba17]'}`}
          rows={3}
          placeholder="Copia qui le note dell'atleta su questo workout..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        {hasChanges && (
          <div className="mt-2 flex justify-end">
            <button
              onClick={handleSaveNote}
              disabled={saving}
              className={`font-bold px-4 py-1.5 rounded-xl text-sm hover:brightness-110 transition disabled:opacity-50 ${isRun ? 'bg-[#0094C6] text-white' : 'bg-[#f1ba17] text-black'}`}
            >
              {saving ? 'Salvataggio...' : 'Conferma'}
            </button>
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
  const [assigning, setAssigning] = useState(null)
  const [alertInfo, setAlertInfo] = useState(null)
  const [assignDate, setAssignDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [selectedWorkout, setSelectedWorkout] = useState(null)

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
      <div className="bg-[#1e1e1e] rounded-3xl w-full max-w-md flex flex-col" style={{ maxHeight: 'calc(100vh - 100px)' }}>
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
                  <div key={w.id} className="flex items-center justify-between bg-[#2a2a2a] border border-[#333] p-3 rounded-xl hover:border-[#f1ba17] transition">
                    <div className="flex-1 min-w-0 pr-3 text-left">
                      <p className="text-white font-semibold text-sm truncate">{w.title}</p>
                      <p className="text-gray-500 text-xs mt-0.5">{w.date && isValid(parseISO(w.date)) ? format(parseISO(w.date), 'dd/MM/yyyy') : 'Data sconosciuta'} • {w.sections?.category || 'Generico'}</p>
                    </div>
                    <button onClick={() => setSelectedWorkout(w)} className="shrink-0 bg-[#f1ba17]/10 text-[#f1ba17] font-semibold px-3 py-1.5 rounded-lg text-xs hover:bg-[#f1ba17] hover:text-black transition">
                      Assegna
                    </button>
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