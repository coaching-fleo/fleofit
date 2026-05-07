import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { ChevronLeft, Calendar as CalendarIcon, Search } from 'lucide-react'
import { format, parseISO, isValid } from 'date-fns'
import { it } from 'date-fns/locale'

export default function WorkoutsArchive() {
  const [workouts, setWorkouts] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    fetchWorkouts()
  }, [])

  const fetchWorkouts = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('workouts')
      .select('id, title, date, sections')
      .order('date', { ascending: false })
    
    if (error) {
      console.error(error)
    } else {
      setWorkouts(data || [])
    }
    setLoading(false)
  }

  const filteredWorkouts = workouts.filter(w => 
    w.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (w.sections?.category || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="p-4 max-w-2xl mx-auto pb-24 page-transition">
      <button onClick={() => navigate(-1)} className="flex items-center text-[#f1ba17] hover:brightness-110 mb-6 transition-all active:scale-95 active:opacity-70 font-semibold text-[17px]">
        <ChevronLeft size={26} strokeWidth={2.5} className="-ml-2 mr-0.5" /> Indietro
      </button>

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
          className="w-full bg-[#1e1e1e] border border-[#333] text-white px-4 py-3 pl-10 rounded-xl focus:outline-none focus:border-[#f1ba17]"
        />
        <Search size={18} className="absolute left-3 top-3.5 text-gray-500" />
      </div>

      {loading ? (
        <p className="text-gray-500">Caricamento in corso...</p>
      ) : filteredWorkouts.length === 0 ? (
        <div className="text-center p-6 bg-[#1e1e1e] border border-[#2a2a2a] rounded-2xl">
          <p className="text-gray-400">Nessun workout trovato.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredWorkouts.map(w => {
            const category = w.sections?.category || (w.sections?.steps ? 'Running' : 'Hyrox')
            return (
              <div 
                key={w.id} 
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
                <span className={`text-xs font-bold px-3 py-1.5 rounded-xl ${category === 'Running' ? 'bg-[#f1ba17]/10 text-[#f1ba17] border border-[#f1ba17]/30' : 'bg-[#222] text-gray-200 border border-[#333]'}`}>
                  {category}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}