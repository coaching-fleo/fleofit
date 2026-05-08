import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, Users, Dumbbell, Plus, FolderArchive, Settings, CheckCircle2, Flame, CalendarX2, ChevronRight, User, Circle } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../App'
import { startOfWeek, format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'

export default function Home() {
  const navigate = useNavigate()
  const [stats, setStats] = useState({ workouts: 0, athletes: 0 })
  const { role, user } = useAuth()
  
  const [todayWorkout, setTodayWorkout] = useState(null)
  const [upcomingWorkouts, setUpcomingWorkouts] = useState([])
  const [weeklyStatus, setWeeklyStatus] = useState([])

  const meta = user?.user_metadata || {}
  const userName = meta.first_name || meta.full_name?.split(' ')[0] || user?.email?.split('@')[0] || ''

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Buongiorno'
    if (hour < 18) return 'Buon pomeriggio'
    return 'Buonasera'
  }

  const randomMotiv = useMemo(() => {
    const MOTIVATIONS = [
      "Pronto a spaccare oggi? ⚡",
      "La costanza batte il talento. 🔥",
      "Ogni giorno è un'opportunità per migliorare. 💪",
      "Fai in modo che oggi conti. 🎯",
      "Non fermarti quando sei stanco, fermati quando hai finito. 🏁",
    ]
    return MOTIVATIONS[Math.floor(Math.random() * MOTIVATIONS.length)]
  }, [])

  useEffect(() => {
    async function fetchStats() {
      if (!role || !user) return

      if (role === 'athlete') {
        const { count: wCount } = await supabase.from('athlete_workouts').select('*', { count: 'exact', head: true }).eq('athlete_id', user.id)
        setStats({ workouts: wCount || 0, athletes: 0 })

        const todayStr = format(new Date(), 'yyyy-MM-dd')
        const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
        const weekStartStr = format(weekStart, 'yyyy-MM-dd')

        const { data } = await supabase
          .from('athlete_workouts')
          .select('id, completed_date, status, workouts (id, title, sections)')
          .eq('athlete_id', user.id)
          .gte('completed_date', weekStartStr)
          .order('completed_date', { ascending: true })
          .limit(30)

        if (data) {
          const todayW = data.find(w => w.completed_date === todayStr)
          setTodayWorkout(todayW || null)

          const upcoming = data.filter(w => w.completed_date > todayStr && w.status !== 'completed').slice(0, 3)
          setUpcomingWorkouts(upcoming)

          const week = []
          for(let i=0; i<7; i++) {
            const d = new Date(weekStart)
            d.setDate(d.getDate() + i)
            const dStr = format(d, 'yyyy-MM-dd')
            
            const wForDay = data.find(w => w.completed_date === dStr)
            week.push({
              date: d,
              dayName: format(d, 'EEEEE', { locale: it }).toUpperCase(),
              hasWorkout: !!wForDay,
              completed: wForDay?.status === 'completed',
              isToday: dStr === todayStr
            })
          }
          setWeeklyStatus(week)
        }
      } else {
        const { count: wCount } = await supabase.from('workouts').select('*', { count: 'exact', head: true })
        const { count: aCount } = await supabase.from('athletes').select('*', { count: 'exact', head: true })
        setStats({ workouts: wCount || 0, athletes: aCount || 0 })
      }
    }
    fetchStats()
  }, [role, user])

  const toggleTodayWorkout = async (e) => {
    e.stopPropagation() // Evita di aprire la pagina dettaglio se clicchiamo solo il tasto
    if (!todayWorkout) return
    const newStatus = todayWorkout.status === 'completed' ? 'pending' : 'completed'
    setTodayWorkout({ ...todayWorkout, status: newStatus })
    setWeeklyStatus(prev => prev.map(d => d.isToday ? { ...d, completed: newStatus === 'completed' } : d))

    const { error } = await supabase.from('athlete_workouts').update({ status: newStatus }).eq('id', todayWorkout.id)
    if (error) {
       setTodayWorkout({ ...todayWorkout, status: todayWorkout.status }) // ripristina
    }
  }

  return (
    <div className="p-4 max-w-2xl mx-auto pb-24 page-transition">
      {/* Header */}
      <div className="mb-6 mt-4 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <img src="/favicon.svg" alt="Logo" className="h-10 object-contain" />
            <h1 className="text-3xl font-black text-white tracking-tight">FLEO<span className="text-[#f1ba17]">FIT</span></h1>
          </div>
          {role === 'athlete' ? (
             <div className="mt-2">
               <p className="text-white font-bold text-xl">{getGreeting()}, {userName}!</p>
               <p className="text-[#f1ba17] text-sm mt-0.5 font-medium">{randomMotiv}</p>
             </div>
          ) : (
            <p className="text-gray-400 mt-1">Dashboard Coach Federico Leo</p>
          )}
        </div>
        <button onClick={() => navigate('/settings')} className="w-11 h-11 rounded-full bg-[#1e1e1e] border border-[#333] flex items-center justify-center text-gray-400 hover:text-white hover:border-[#f1ba17] transition shadow-sm shrink-0">
          <Settings size={22} />
        </button>
      </div>

      {/* Settimana Atleta */}
      {role === 'athlete' && weeklyStatus.length > 0 && (
        <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-3xl p-5 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-white font-bold text-sm">La tua settimana</h3>
            <span className="text-xs text-gray-400 bg-[#2a2a2a] px-2 py-1 rounded-lg font-medium">{weeklyStatus.filter(d => d.completed).length} completati</span>
          </div>
          <div className="flex justify-between relative">
            <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-[#2a2a2a] -translate-y-1/2 z-0"></div>
            {weeklyStatus.map((day, i) => (
              <div key={i} className="flex flex-col items-center gap-2 relative z-10">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-[3px] transition-all bg-[#1e1e1e] ${
                  day.completed 
                    ? 'border-green-500 text-green-500' 
                    : day.hasWorkout
                      ? (day.isToday ? 'border-[#f1ba17] text-[#f1ba17]' : 'border-[#444]')
                      : 'border-[#2a2a2a] text-transparent'
                }`}>
                   {day.completed ? <CheckCircle2 size={16} strokeWidth={3} /> : (day.hasWorkout ? <div className="w-2 h-2 rounded-full bg-current" /> : <div className="w-1 h-1 rounded-full bg-[#333]" />)}
                </div>
                <span className={`text-[10px] font-bold ${day.isToday ? 'text-[#f1ba17]' : 'text-gray-500'}`}>{day.dayName}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Today's Workout for Athlete */}
      {role === 'athlete' && (
        <div className="mb-6">
          <h2 className="text-lg font-bold text-white mb-3">Oggi</h2>
          {todayWorkout ? (
            <div 
              onClick={() => navigate(`/workout/${todayWorkout.workouts.id}?athlete_id=${user.id}`)}
              className={`rounded-3xl p-6 cursor-pointer transition border relative overflow-hidden group ${
                todayWorkout.status === 'completed' 
                  ? 'bg-green-500/10 border-green-500/30 hover:border-green-500' 
                  : 'bg-gradient-to-br from-[#2a2a2a] to-[#1e1e1e] border-[#f1ba17]/50 hover:border-[#f1ba17]'
              }`}
            >
              <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition">
                {todayWorkout.status === 'completed' ? <CheckCircle2 size={80} className="text-green-500 -rotate-12" /> : <Flame size={80} className="text-[#f1ba17] -rotate-12" />}
              </div>
              <div className="relative z-10">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 shadow-lg shrink-0 ${
                  todayWorkout.status === 'completed' ? 'bg-green-500 text-black shadow-green-500/20' : 'bg-[#f1ba17] text-black shadow-[#f1ba17]/20'
                }`}>
                  {todayWorkout.status === 'completed' ? <CheckCircle2 size={24} /> : <Dumbbell size={24} />}
                </div>
                <h3 className="text-white font-bold text-xl mb-1 truncate pr-8">{todayWorkout.workouts.title}</h3>
                <p className={`text-sm font-medium ${todayWorkout.status === 'completed' ? 'text-green-400' : 'text-[#f1ba17]'}`}>
                  {todayWorkout.status === 'completed' ? 'Ottimo lavoro, completato! 🎉' : 'Da completare oggi 🔥'}
                </p>
                <div className="mt-4">
                  <button 
                    onClick={toggleTodayWorkout}
                    className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold transition border ${
                      todayWorkout.status === 'completed' 
                        ? 'bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30' 
                        : 'bg-[#111] border-[#333] text-gray-300 hover:border-[#f1ba17] hover:text-[#f1ba17]'
                    }`}
                  >
                    {todayWorkout.status === 'completed' ? <CheckCircle2 size={16} /> : <Circle size={16} />} 
                    {todayWorkout.status === 'completed' ? 'Fatto' : 'Segna come completato'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-[#1e1e1e] border border-[#2a2a2a] border-dashed rounded-3xl p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-[#2a2a2a] flex items-center justify-center text-gray-500 shrink-0">
                <CalendarX2 size={24} />
              </div>
              <div>
                <h3 className="text-white font-bold">Giorno di rest</h3>
                <p className="text-gray-500 text-sm">Recupera le energie per il prossimo allenamento. 🛋️</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Upcoming Workouts for Athlete */}
      {role === 'athlete' && upcomingWorkouts.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-bold text-white mb-3">I prossimi allenamenti</h2>
          <div className="flex flex-col gap-3">
            {upcomingWorkouts.map(w => (
              <div 
                key={w.id}
                onClick={() => navigate(`/workout/${w.workouts.id}?athlete_id=${user.id}`)}
                className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:border-[#383838] transition"
              >
                <div>
                  <p className="text-white font-semibold">{w.workouts.title}</p>
                  <p className="text-gray-500 text-xs mt-0.5 capitalize font-medium">
                    {format(parseISO(w.completed_date), 'EEEE d MMMM', { locale: it })}
                  </p>
                </div>
                <div className="w-8 h-8 rounded-full bg-[#2a2a2a] flex items-center justify-center text-gray-400">
                  <ChevronRight size={18} className="ml-0.5" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div onClick={() => navigate('/calendar')} className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-3xl p-5 cursor-pointer hover:border-[#f1ba17] transition flex flex-col gap-3">
          <div className="w-10 h-10 rounded-full bg-[#2a2a2a] flex items-center justify-center text-gray-300 shrink-0">
            <CalendarDays size={20} />
          </div>
          <div>
            <h3 className="text-white font-bold text-lg">Calendario</h3>
            <p className="text-gray-500 text-xs mt-1">{stats.workouts} workout {role === 'athlete' ? 'assegnati' : 'creati'}</p>
          </div>
        </div>

        {role !== 'athlete' ? (
          <div onClick={() => navigate('/athletes')} className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-3xl p-5 cursor-pointer hover:border-[#f1ba17] transition flex flex-col gap-3">
            <div className="w-10 h-10 rounded-full bg-[#2a2a2a] flex items-center justify-center text-gray-300 shrink-0">
              <Users size={20} />
            </div>
            <div>
              <h3 className="text-white font-bold text-lg">Atleti</h3>
              <p className="text-gray-500 text-xs mt-1">{stats.athletes} atleti totali</p>
            </div>
          </div>
        ) : (
          <div onClick={() => navigate('/profile')} className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-3xl p-5 cursor-pointer hover:border-[#f1ba17] transition flex flex-col gap-3">
            <div className="w-10 h-10 rounded-full bg-[#2a2a2a] flex items-center justify-center text-gray-300 shrink-0">
              <User size={20} />
            </div>
            <div>
              <h3 className="text-white font-bold text-lg">Profilo</h3>
              <p className="text-gray-500 text-xs mt-1">Dati personali</p>
            </div>
          </div>
        )}
      </div>

      {/* Main CTA */}
      {role !== 'athlete' && (
        <div onClick={() => navigate('/create')} className="bg-gradient-to-br from-[#2a2a2a] to-[#1e1e1e] border border-[#f1ba17]/50 rounded-3xl p-6 cursor-pointer hover:border-[#f1ba17] transition relative overflow-hidden group mb-4">
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition">
            <Dumbbell size={64} className="text-[#f1ba17] -rotate-12" />
          </div>
          <div className="relative z-10">
            <div className="w-12 h-12 rounded-full bg-[#f1ba17] flex items-center justify-center text-black mb-4 shadow-lg shadow-[#f1ba17]/20 shrink-0">
              <Plus size={24} />
            </div>
            <h2 className="text-white font-bold text-xl mb-1">Crea Workout</h2>
            <p className="text-gray-400 text-sm w-3/4">Componi un nuovo allenamento e assegnalo ai tuoi atleti.</p>
          </div>
        </div>
      )}

      <button 
        onClick={() => navigate('/archive')}
        className="w-full flex items-center justify-center gap-2 bg-[#2a2a2a] border border-[#383838] text-white font-semibold py-4 rounded-2xl hover:border-[#f1ba17] hover:text-[#f1ba17] transition"
      >
        <FolderArchive size={20} />
        Archivio Storico
      </button>
    </div>
  )
}