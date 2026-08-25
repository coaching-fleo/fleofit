import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { ChevronLeft, Calendar as CalendarIcon, Search } from 'lucide-react'
import { format, parseISO, isValid } from 'date-fns'
import { it } from 'date-fns/locale'
import { useAuth } from '../App'

export default function WorkoutsArchive() {
  const [workouts, setWorkouts] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const navigate = useNavigate()
  const { role, user } = useAuth()

  useEffect(() => {
    fetchWorkouts()
  }, [])

  const fetchWorkouts = async () => {
    setLoading(true)
    if (role === 'athlete') {
      const { data, error } = await supabase
        .from('athlete_workouts')
        .select('id, completed_date, status, created_at, workouts (id, title, date, sections)')
        .eq('athlete_id', user.id)
        .order('created_at', { ascending: false })
      if (!error && data) {
         const mapped = data.filter(aw => {
           if (!aw.workouts) return false
           const s = aw.workouts.sections || {}
           const cat = s.category
           if (cat === 'Event' || s.isEvent || s.isAutonomous) return false
           if (cat === 'Event' || s.isEvent || s.isAutonomous) return false
           return true
         }).map(aw => ({
           ...aw.workouts,
           aw_id: aw.id,
           date: aw.completed_date
         }))
         setWorkouts(mapped)
      }
    } else {
      const { data, error } = await supabase
        .from('workouts')
        .select('id, title, date, created_at, sections, athlete_workouts(id)')
        .order('created_at', { ascending: false })
      if (!error) {
        const filtered = (data || []).filter(w => {
           const s = w.sections || {}
           const cat = s.category
           if (cat === 'Event' || s.isEvent || cat === 'Custom' || cat === 'Autonomo' || s.isAutonomous) return false
           return true
        })
        setWorkouts(filtered)
      }
    }
    setLoading(false)
  }

  const filteredWorkouts = workouts.filter(w => 
    w.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (w.sections?.category || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="px-4 max-w-2xl mx-auto pb-[calc(6rem+env(safe-area-inset-bottom))] pt-[calc(env(safe-area-inset-top)+1rem)] page-transition">
      <div className="mb-6 mt-4 flex items-center gap-3">
        <button aria-label="Torna indietro" onClick={() => navigate(-1)} className="w-11 h-11 bg-[#1e1e1e] border border-[#333] rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:border-[#f1ba17] transition shadow-sm shrink-0">
          <ChevronLeft size={22} className="-ml-0.5" />
        </button>
        <h1 className="text-3xl font-black text-white tracking-tight">FLEO<span className="text-[#f1ba17]">FIT</span></h1>
      </div>

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Archivio Workout</h1>
          <p className="text-gray-400 text-sm mt-1">Tutti i tuoi allenamenti creati</p>
        </div>
      </div>

      <div className="mb-6 relative">
        <input 
          type="text"
          placeholder="Cerca per nome o categoria..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full bg-[#1e1e1e] border border-[#333] text-white px-4 py-3 pl-10 rounded-xl focus:outline-none focus:border-[#f1ba17] text-base"
        />
        <Search size={18} className="absolute left-3 top-3.5 text-muted" />
      </div>

      {loading ? (
        <p className="text-muted">Caricamento in corso...</p>
      ) : filteredWorkouts.length === 0 ? (
        <div className="text-center p-6 bg-[#1e1e1e] border border-[#2a2a2a] rounded-2xl">
          <p className="text-gray-400">Nessun workout trovato.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredWorkouts.map(w => {
            const rawCat = w.sections?.category || (w.sections?.steps ? 'Running' : 'Hyrox')
            const isEvent = rawCat === 'Event' || w.sections?.isEvent === true
            const isAuto = w.sections?.isAutonomous === true || rawCat === 'Autonomo'
            const isCustom = rawCat === 'Custom' || isAuto
            const category = isEvent ? 'Event' : (isCustom ? 'Custom' : rawCat)
            return (
              <div 
                key={w.aw_id || w.id} 
                onClick={() => navigate(`/workout/${w.id}`)}
                className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-2xl p-4 cursor-pointer hover:border-[#f1ba17]/50 transition flex items-center justify-between"
              >
                <div>
                  <h3 className="text-white font-bold text-base mb-1">{w.title}</h3>
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <CalendarIcon size={14} />
                    <span>{w.date && isValid(parseISO(w.date)) ? format(parseISO(w.date), 'EEEE d MMMM yyyy', { locale: it }) : 'Data sconosciuta'}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`text-xs font-bold px-3 py-1.5 rounded-xl ${isEvent ? 'bg-white text-black border-white' : category === 'Running' ? 'bg-[#0094C6]/10 text-[#0094C6] border-[#0094C6]/30' : (category === 'Custom' ? 'bg-[#D11149]/10 text-[#D11149] border-[#D11149]/30' : 'bg-[#f1ba17]/10 text-[#f1ba17] border-[#f1ba17]/30')}`}>
                    {isEvent ? 'Evento' : category}
                  </span>
                  {role !== 'athlete' && w.athlete_workouts && (
                    <span className="text-[11px] text-muted font-medium">Assegnato: {w.athlete_workouts.length}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}