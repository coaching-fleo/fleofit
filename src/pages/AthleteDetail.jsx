import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { ArrowLeft, User, Upload, BookOpen, Trash2 } from 'lucide-react'
import { format, parseISO, differenceInYears } from 'date-fns'
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

  if (loading) return <div className="p-6 text-gray-500">Caricamento scheda atleta...</div>
  if (!athlete) return <div className="p-6 text-red-400">Atleta non trovato.</div>

  return (
    <div className="p-4 max-w-2xl mx-auto pb-24">
      <button onClick={() => navigate('/athletes')} className="flex items-center gap-2 text-gray-500 hover:text-white mb-5 transition">
        <ArrowLeft size={18} /> Tutti gli atleti
      </button>

      {/* Header Atleta */}
      <div className="flex items-center gap-5 mb-6">
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

      {/* Statistiche */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <StatCard label="Età" value={calculateAge(athlete.birth_date)} />
        <StatCard label="Altezza" value={athlete.height ? `${athlete.height} cm` : 'N/A'} />
        <StatCard label="Peso" value={athlete.weight ? `${athlete.weight} kg` : 'N/A'} />
        <StatCard label="Workouts" value={workouts.length} />
      </div>

      {/* Diario Workout */}
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <BookOpen size={20} className="text-[#f1ba17]" />
          Diario Workout
        </h2>
        {workouts.length > 0 ? (
          workouts.map(entry => (
            <div key={entry.id} className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-2xl p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold text-white">{entry.workouts.title}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {format(parseISO(entry.completed_date), 'EEEE d MMMM yyyy', { locale: it })}
                  </p>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${entry.status === 'completed' ? 'bg-green-900/60 text-green-300' : 'bg-red-900/60 text-red-300'}`}>
                  {entry.status === 'completed' ? 'Completato' : 'Saltato'}
                </span>
              </div>
              <div className="mt-3 pt-3 border-t border-[#2a2a2a]">
                <textarea
                  className="w-full bg-[#2a2a2a] border border-[#383838] rounded-xl px-3 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-[#f1ba17] resize-none text-sm"
                  rows={3}
                  placeholder="Copia qui le note dell'atleta su questo workout..."
                  defaultValue={entry.notes || ''}
                  // onBlur={(e) => updateWorkoutNote(entry.id, e.target.value)} // Qui andrà la logica per salvare la nota
                />
              </div>
            </div>
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