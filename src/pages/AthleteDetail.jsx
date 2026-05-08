import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { ChevronLeft, User, Upload, BookOpen, Trash2, AlertTriangle, Plus, Edit, X, Download, Dumbbell, Search, CheckCircle2, Circle } from 'lucide-react'
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
  const [athlete, setAthlete] = useState(null)
  const [workouts, setWorkouts] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [workoutToRemove, setWorkoutToRemove] = useState(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [alertInfo, setAlertInfo] = useState(null)
  const [confirmInfo, setConfirmInfo] = useState(null)

  useEffect(() => {
    fetchAthleteData()
  }, [id])

  async function fetchAthleteData() {
    setLoading(true)
    const { data: athleteData, error: athleteError } = await supabase
      .from('athletes')
      .select('*')
      .eq('id', id)
      .single()

    if (athleteError) {
      console.error("Errore nel caricare l'atleta:", athleteError)
      setLoading(false)
      return
    }
    setAthlete(athleteData)

    const { data: workoutHistory, error: historyError } = await supabase
      .from('athlete_workouts')
      .select(`id, completed_date, notes, status, workouts (id, title)`)
      .eq('athlete_id', id)
      .order('completed_date', { ascending: false })

    if (historyError) console.error("Errore nel caricare lo storico workout:", historyError)
    else setWorkouts(workoutHistory || [])

    setLoading(false)
  }

  const handlePhotoUpload = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    setUploading(true)
    const ext = file.name.split('.').pop()
    const fileName = `${Date.now()}.${ext}`
    
    const { error: uploadError } = await supabase.storage
      .from('athlete-photos')
      .upload(fileName, file, { contentType: file.type })

    if (uploadError) {
      setUploading(false)
      setAlertInfo({ title: 'Errore', message: 'Errore durante il caricamento della foto: ' + uploadError.message + '\n\nControlla le Policy di Storage su Supabase!', type: 'error' })
      return
    }

    const { data: urlData } = supabase.storage.from('athlete-photos').getPublicUrl(fileName)
    const newPhotoUrl = urlData.publicUrl

    const { error: updateError } = await supabase
      .from('athletes')
      .update({ photo_url: newPhotoUrl })
      .eq('id', id)

    if (updateError) {
      setUploading(false)
      setAlertInfo({ title: 'Errore', message: "Errore nell'aggiornamento del profilo: " + updateError.message, type: 'error' })
      return
    }

    // Aggiorniamo la UI
    setAthlete({ ...athlete, photo_url: newPhotoUrl })
    setUploading(false)
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

  if (loading) return <div className="p-6 text-gray-500">Caricamento scheda atleta...</div>
  if (!athlete) return <div className="p-6 text-red-400">Atleta non trovato.</div>

  return (
    <div className="p-4 max-w-2xl mx-auto pb-24 page-transition">
      {role !== 'athlete' ? (
        <button onClick={() => navigate('/athletes')} className="flex items-center text-[#f1ba17] hover:brightness-110 mb-6 transition-all active:scale-95 active:opacity-70 font-semibold text-[17px]">
          <ChevronLeft size={26} strokeWidth={2.5} className="-ml-2 mr-0.5" /> Tutti gli atleti
        </button>
      ) : (
        <div className="mt-8 mb-4"></div>
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
            {uploading && (
              <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                <span className="text-white text-xs">...</span>
              </div>
            )}
            <label htmlFor="photo-upload" className="absolute bottom-0 right-0 bg-[#f1ba17] p-1.5 rounded-full cursor-pointer hover:brightness-110">
              <Upload size={14} className="text-black" />
              <input id="photo-upload" type="file" className="hidden" onChange={handlePhotoUpload} accept="image/*" disabled={uploading} />
            </label>
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

      {/* Diario Workout */}
      <div className="flex flex-col gap-4">
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
          workouts.map(entry => (
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
          ))
        ) : (
          <div className="bg-[#1e1e1e] border border-dashed border-[#2a2a2a] rounded-2xl p-6 text-center">
            <p className="text-gray-600 text-sm">Nessun workout registrato per questo atleta.</p>
          </div>
        )}
      </div>

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
            fetchAthleteData()
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
            fetchAthleteData()
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

function EditAthleteModal({ athlete, onClose, onSaved, onDelete, role }) {
  const [form, setForm] = useState({ 
    name: athlete.name || '', 
    surname: athlete.surname || '', 
    birth_date: athlete.birth_date || '', 
    weight: athlete.weight || '', 
    height: athlete.height || '', 
    notes: athlete.notes || '' 
  })
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [alertInfo, setAlertInfo] = useState(null)

  const handleSave = async () => {
    if (!form.name || !form.surname) return setAlertInfo({ title: 'Attenzione', message: 'Nome e cognome obbligatori!', type: 'error' })
    setSaving(true)

    const { error } = await supabase.from('athletes').update({
      name: form.name,
      surname: form.surname,
      birth_date: form.birth_date || null,
      weight: form.weight ? parseFloat(form.weight) : null,
      height: form.height ? parseFloat(form.height) : null,
      notes: form.notes
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
          <p className="font-semibold text-white group-hover:text-[#f1ba17] transition underline decoration-[#f1ba17]/50 underline-offset-4 leading-tight">
            {entry.workouts.title}
          </p>
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
              ? 'bg-[#111] border-[#333] text-gray-500 hover:border-[#f1ba17] hover:text-[#f1ba17]'
              : 'bg-[#2a2a2a] border-[#383838] text-gray-300 hover:border-[#f1ba17] hover:text-[#f1ba17]'
        }`}
      >
        <Icon size={18} /> {statusText}
      </button>

      <div className="mt-3 pt-3 border-t border-[#2a2a2a]">
        <textarea
          className="w-full bg-[#2a2a2a] border border-[#383838] rounded-xl px-3 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-[#f1ba17] resize-none text-sm"
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
              className="bg-[#f1ba17] text-black font-bold px-4 py-1.5 rounded-xl text-sm hover:brightness-110 transition disabled:opacity-50"
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