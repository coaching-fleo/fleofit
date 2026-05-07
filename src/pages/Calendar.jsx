import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { ChevronLeft, ChevronRight, Plus, BicepsFlexed } from 'lucide-react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import { useAuth } from '../App'

export default function Calendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [workouts, setWorkouts] = useState([])
  const [selectedDay, setSelectedDay] = useState(new Date())
  const [dayWorkouts, setDayWorkouts] = useState([])
  const navigate = useNavigate()
  const { role, user } = useAuth()

  useEffect(() => {
    fetchWorkouts()
  }, [currentMonth])

  useEffect(() => {
    const filtered = workouts.filter(w => isSameDay(parseISO(w.date), selectedDay))
    setDayWorkouts(filtered)
  }, [selectedDay, workouts])

  const fetchWorkouts = async () => {
    const from = format(startOfMonth(currentMonth), 'yyyy-MM-dd')
    const to = format(endOfMonth(currentMonth), 'yyyy-MM-dd')
    
    if (role === 'athlete') {
      const { data } = await supabase
        .from('athlete_workouts')
        .select('id, completed_date, status, workouts (id, title, date, sections)')
        .eq('athlete_id', user.id)
        .gte('completed_date', from)
        .lte('completed_date', to)
      const mapped = (data || []).filter(aw => aw.workouts).map(aw => ({
         ...aw.workouts,
         date: aw.completed_date
      }))
      setWorkouts(mapped)
    } else {
      const { data } = await supabase
        .from('workouts')
        .select('id, title, date, sections')
        .gte('date', from)
        .lte('date', to)
      setWorkouts(data || [])
    }
  }

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth)
  })

  const firstDayOfMonth = startOfMonth(currentMonth).getDay()
  const offset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1

  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))

  const TYPE_COLORS = {
    'WarmUp': '#9ca3af',
    'Rest': '#6b7280',
    'Cash In': '#d1d5db',
    'Cash Out': '#d1d5db',
    'ON/OFF': '#e5e5e5',
    'EMOM': '#e5e5e5',
    'AMRAP': '#e5e5e5',
    'For Time': '#e5e5e5',
    Running: '#f1ba17'
  }

  const getIntensityColor = (val) => {
    const num = parseInt(val, 10);
    if (isNaN(num)) return 'text-gray-500';
    if (num <= 4) return 'text-gray-400';
    if (num <= 7) return 'text-gray-300';
    if (num <= 9) return 'text-white';
    return 'text-[#f1ba17]';
  }

  const getWorkoutType = (w) => {
    const s = w.sections || {}
    if (s.category === 'Running' || s.main?.type === 'Running' || s.steps) return 'Running'
    if (s.blocks) {
      const mainBlock = s.blocks.find(b => ['EMOM', 'ON/OFF', 'AMRAP', 'For Time'].includes(b.type))
      return mainBlock ? mainBlock.type : 'Hyrox'
    }
    const oldT = s.main?.type || ''
    if (oldT === 'EMOM' && s.main?.params?.on) return 'ON/OFF'
    return oldT || 'Hyrox'
  }

  return (
    <div className="p-4 max-w-2xl mx-auto pb-24">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">
          {format(currentMonth, 'MMMM yyyy', { locale: it })}
        </h1>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-2 rounded-xl bg-[#222] hover:bg-[#2a2a2a] text-gray-400 hover:text-white transition">
            <ChevronLeft size={18} />
          </button>
          <button onClick={() => setCurrentMonth(new Date())} className="px-3 py-1.5 rounded-xl bg-[#222] hover:bg-[#2a2a2a] text-gray-400 hover:text-white text-sm transition">
            Oggi
          </button>
          <button onClick={nextMonth} className="p-2 rounded-xl bg-[#222] hover:bg-[#2a2a2a] text-gray-400 hover:text-white transition">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* GIORNI SETTIMANA */}
      <div className="grid grid-cols-7 mb-2">
        {['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((d, i) => (
          <div key={i} className="text-center text-gray-600 text-xs font-medium py-1">{d}</div>
        ))}
      </div>

      {/* GRIGLIA CALENDARIO */}
      <div className="grid grid-cols-7 gap-1 mb-6">
        {Array.from({ length: offset }).map((_, i) => <div key={`empty-${i}`} />)}
        {days.map(day => {
          const dayWorkoutList = workouts.filter(w => isSameDay(parseISO(w.date), day))
          const hasWorkout = dayWorkoutList.length > 0
          const selected = isSameDay(day, selectedDay)
          const today = isToday(day)

          return (
            <button
              key={day.toISOString()}
              onClick={() => setSelectedDay(day)}
              className={`relative flex flex-col items-center justify-start pt-1.5 pb-1 rounded-xl aspect-square transition
                ${selected ? 'bg-[#f1ba17]' : today ? 'bg-[#2a2a2a]' : 'hover:bg-[#1e1e1e]'}`}
            >
              <span className={`text-sm font-medium leading-none
                ${selected ? 'text-black' : today ? 'text-[#f1ba17]' : 'text-white'}`}>
                {format(day, 'd')}
              </span>
              {hasWorkout && (
                <div className="flex gap-0.5 mt-1">
                  {dayWorkoutList.slice(0, 3).map((w, i) => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: selected ? '#000' : TYPE_COLORS[getWorkoutType(w)] || '#f1ba17' }} />
                  ))}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* WORKOUT DEL GIORNO */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white font-semibold">
            {format(selectedDay, 'EEEE d MMMM', { locale: it })}
          </h2>
          {role !== 'athlete' && (
            <button
              onClick={() => navigate(`/create?date=${format(selectedDay, 'yyyy-MM-dd')}`)}
              className="flex items-center gap-1 text-[#f1ba17] text-sm font-medium hover:brightness-110"
            >
              <Plus size={16} /> Nuovo
            </button>
          )}
        </div>

        {dayWorkouts.length === 0 ? (
          <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-2xl p-6 text-center">
            <p className="text-gray-600 text-sm">Nessun workout programmato</p>
            {role !== 'athlete' && (
              <button onClick={() => navigate(`/create?date=${format(selectedDay, 'yyyy-MM-dd')}`)}
                className="mt-3 text-[#f1ba17] text-sm font-medium hover:brightness-110">
                + Crea workout per questo giorno
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {dayWorkouts.map(w => {
              const type = getWorkoutType(w)
              const color = TYPE_COLORS[type] || '#f1ba17'
              const exList = w.sections?.main?.exercises || []
              return (
                <div key={w.id}
                  onClick={() => navigate(`/workout/${w.id}`)}
                  className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-2xl p-4 cursor-pointer hover:border-[#383838] transition">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-1 h-10 rounded-full" style={{ backgroundColor: color }} />
                      <div>
                        <p className="text-white font-semibold">{w.title}</p>
                        <p className="text-xs mt-0.5" style={{ color }}>{type}</p>
                      </div>
                    </div>
                    {w.sections?.intensity && (
                      <div className="flex items-center gap-1 mt-1">
                        <span className={`text-xs font-bold ${getIntensityColor(w.sections.intensity)}`}>{w.sections.intensity}/10</span>
                        <BicepsFlexed size={16} className={getIntensityColor(w.sections.intensity)} />
                      </div>
                    )}
                  </div>
                  {w.sections?.blocks ? (
                    <div className="flex flex-wrap gap-1 mt-2 ml-4">
                      <span className="text-xs bg-[#2a2a2a] text-gray-400 px-2 py-0.5 rounded-full">
                        {w.sections.blocks.length} blocchi
                      </span>
                    </div>
                  ) : (
                    exList && exList.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2 ml-4">
                        {exList.slice(0, 4).map((ex, i) => (
                          <span key={i} className="text-xs bg-[#2a2a2a] text-gray-400 px-2 py-0.5 rounded-full">
                            {ex.name}
                          </span>
                        ))}
                        {exList.length > 4 && (
                          <span className="text-xs text-gray-600">+{exList.length - 4}</span>
                        )}
                      </div>
                    )
                  )}
                  {type === 'Running' && (w.sections?.main?.steps?.length > 0 || w.sections?.steps?.length > 0) && (
                    <div className="flex flex-wrap gap-1 mt-2 ml-4">
                      <span className="text-xs bg-[#2a2a2a] text-gray-400 px-2 py-0.5 rounded-full">
                        {w.sections?.steps?.length || w.sections?.main?.steps?.length || 0} fasi di corsa
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}