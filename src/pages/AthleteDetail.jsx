import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { ArrowLeft, User, Upload, BookOpen, Trash2, AlertTriangle, Plus, Edit, X } from 'lucide-react'
import { format, parseISO, differenceInYears, isBefore, startOfDay } from 'date-fns'
import { it } from 'date-fns/locale'

// Helper per calcolare l'età
const calculateAge = (dob) => {
  if (!dob) return 'N/A'
  return differenceInYears(new Date(), parseISO(dob))
}

export default function AthleteDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [athlete, setAthlete] = useState(null)
  const [workouts, setWorkouts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [workoutToRemove, setWorkoutToRemove] = useState(null)
  const [showEditModal, setShowEditModal] = useState(false)

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
      alert('Errore durante il caricamento della foto: ' + uploadError.message + '\n\nControlla le Policy di Storage su Supabase!')
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
      alert("Errore nell'aggiornamento del profilo: " + updateError.message)
      return
    }

    // Aggiorniamo la UI
    setAthlete({ ...athlete, photo_url: newPhotoUrl })
    setUploading(false)
  }

  const handleDeleteAthlete = async () => {
    const { error } = await supabase.from('athletes').delete().eq('id', id)
    if (error) {
      alert("Errore durante l'eliminazione: " + error.message)
      return
    }
    navigate('/athletes')
  }

  const toggleWorkoutStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed'
    const { error } = await supabase
      .from('athlete_workouts')
      .update({ status: newStatus })
      .eq('id', id)
    
    if (!error) {
      // Aggiorna lo stato localmente per vedere subito il cambio colore
      setWorkouts(workouts.map(w => w.id === id ? { ...w, status: newStatus } : w))
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
      alert("Errore durante il salvataggio della nota: " + error.message)
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
      alert("Errore durante la rimozione: " + error.message)
    }
    setWorkoutToRemove(null)
  }

  if (loading) return <div className="p-6 text-gray-500">Caricamento scheda atleta...</div>
  if (!athlete) return <div className="p-6 text-red-400">Atleta non trovato.</div>

  return (
    <div className="p-4 max-w-2xl mx-auto pb-24">
      <button onClick={() => navigate('/athletes')} className="flex items-center gap-2 text-gray-500 hover:text-white mb-5 transition">
        <ArrowLeft size={18} /> Tutti gli atleti
      </button>

      {/* Header Atleta */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-5">
          <div className="relative">
            {athlete.photo_url ? (
              <img src={athlete.photo_url} alt={`${athlete.name}`} className="w-24 h-24 rounded-full object-cover border-2 border-[#333]" />
            ) : (
              <div className="w-24 h-24 rounded-full bg-[#2a2a2a] flex items-center justify-center border-2 border-[#333]">
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
            <p className="text-gray-400">@{athlete.username || 'N/A'}</p>
          </div>
        </div>
        <button 
          onClick={() => setShowEditModal(true)} 
          className="p-2 bg-[#2a2a2a] rounded-xl text-gray-400 hover:text-white transition"
          title="Modifica profilo atleta"
        >
          <Edit size={20} />
        </button>
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
          <button 
            onClick={() => navigate(`/create?athlete_id=${id}`)}
            className="flex items-center gap-1 text-[#f1ba17] text-sm font-medium hover:brightness-110 bg-[#f1ba17]/10 px-3 py-1.5 rounded-full transition"
          >
            <Plus size={16} /> Nuovo Workout
          </button>
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
            />
          ))
        ) : (
          <div className="bg-[#1e1e1e] border border-dashed border-[#2a2a2a] rounded-2xl p-6 text-center">
            <p className="text-gray-600 text-sm">Nessun workout registrato per questo atleta.</p>
          </div>
        )}
      </div>

      {/* Sezione Eliminazione Atleta */}
      <div className="mt-12 flex justify-center">
        {!showDeleteConfirm ? (
          <button onClick={() => setShowDeleteConfirm(true)} className="flex items-center gap-2 text-red-500 text-sm font-medium hover:underline">
            <Trash2 size={16} /> Elimina profilo atleta
          </button>
        ) : (
          <div className="bg-red-900/20 border border-red-900/50 rounded-xl p-4 text-center w-full max-w-sm">
            <p className="text-red-400 text-sm font-semibold mb-3">Sei sicuro? Questa azione eliminerà l'atleta e non può essere annullata.</p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 bg-[#2a2a2a] text-white rounded-lg text-sm transition hover:bg-[#333]">Annulla</button>
              <button onClick={handleDeleteAthlete} className="px-4 py-2 bg-red-600/80 hover:bg-red-600 text-white rounded-lg text-sm font-bold transition">Sì, elimina</button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL CONFERMA RIMOZIONE WORKOUT */}
      {workoutToRemove && (
        <div className="fixed inset-0 bg-black/85 z-[100] flex items-center justify-center p-4">
          <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-3xl w-full max-w-sm p-6 flex flex-col gap-4 text-center shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-red-900/30 text-red-500 flex items-center justify-center mx-auto mb-2">
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
        </div>
      )}

      {/* MODAL MODIFICA ATLETA */}
      {showEditModal && (
        <EditAthleteModal 
          athlete={athlete}
          onClose={() => setShowEditModal(false)}
          onSaved={() => {
            setShowEditModal(false)
            fetchAthleteData()
          }}
        />
      )}
    </div>
  )
}

function EditAthleteModal({ athlete, onClose, onSaved }) {
  const [form, setForm] = useState({ 
    name: athlete.name || '', 
    surname: athlete.surname || '', 
    birth_date: athlete.birth_date || '', 
    weight: athlete.weight || '', 
    height: athlete.height || '', 
    notes: athlete.notes || '' 
  })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!form.name || !form.surname) return alert('Nome e cognome obbligatori!')
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
    if (error) { alert('Errore: ' + error.message); return }
    onSaved()
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
        <div className="p-5 border-t border-[#2a2a2a]">
          <button onClick={handleSave} disabled={saving} className="w-full bg-[#f1ba17] text-black font-bold py-4 rounded-xl hover:brightness-110 transition disabled:opacity-50">{saving ? 'Salvataggio...' : 'Salva Modifiche'}</button>
        </div>
      </div>
    </div>
  )
}

function WorkoutEntryCard({ entry, onToggleStatus, onUpdateNote, onRemove, navigate, athleteId }) {
  const [note, setNote] = useState(entry.notes || '')
  const [saving, setSaving] = useState(false)
  
  const hasChanges = note !== (entry.notes || '')

  const scheduledDate = startOfDay(parseISO(entry.completed_date))
  const today = startOfDay(new Date())

  let statusText = 'Pending'
  let statusClass = 'bg-[#2a2a2a] text-gray-400 border border-[#333]'

  if (entry.status === 'completed') {
    statusText = 'Fatto'
    statusClass = 'bg-[#f1ba17]/10 text-[#f1ba17] border border-[#f1ba17]/30'
  } else if (isBefore(scheduledDate, today)) {
    statusText = 'Saltato'
    statusClass = 'bg-[#111] text-gray-600 border border-[#222]'
  }

  const handleSaveNote = async () => {
    setSaving(true)
    await onUpdateNote(entry.id, note)
    setSaving(false)
  }

  return (
    <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-2xl p-4">
      <div className="flex justify-between items-start">
        <div 
          className="cursor-pointer group"
          onClick={() => navigate(`/workout/${entry.workouts.id}?athlete_id=${athleteId}`)}
        >
          <p className="font-semibold text-white group-hover:text-[#f1ba17] transition underline decoration-[#f1ba17]/50 underline-offset-4">
            {entry.workouts.title}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {format(parseISO(entry.completed_date), 'EEEE d MMMM yyyy', { locale: it })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => onToggleStatus(entry.id, entry.status)}
            className={`text-xs font-bold px-2 py-0.5 rounded-full cursor-pointer hover:brightness-125 transition ${statusClass}`}
          >
            {statusText}
          </button>
          <button 
            onClick={() => onRemove(entry.id)}
            className="text-gray-500 hover:text-red-500 transition p-1"
            title="Rimuovi assegnazione"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
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

function StatCard({ label, value }) {
  return (
    <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-white font-bold text-lg">{value}</p>
    </div>
  )
}