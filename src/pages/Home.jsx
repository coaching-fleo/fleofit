import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, Users, Dumbbell, Plus, FolderArchive, Settings, CheckCircle2, Flame, CalendarX2, ChevronRight, User, Circle, Sun, Check, Timer } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../App'
import { startOfWeek, format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import { getDailyMotivation } from './motivations'

export default function Home() {
  const navigate = useNavigate()
  const [stats, setStats] = useState({ workouts: 0, athletes: 0 })
  const { role, user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [loadingRecent, setLoadingRecent] = useState(true)
  
  const [todayWorkouts, setTodayWorkouts] = useState([])
  const [upcomingWorkouts, setUpcomingWorkouts] = useState([])
  const [weeklyStatus, setWeeklyStatus] = useState(() => {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
    const week = []
    const todayStr = format(new Date(), 'yyyy-MM-dd')
    for(let i=0; i<7; i++) {
      const d = new Date(weekStart)
      d.setDate(d.getDate() + i)
      week.push({
        date: d,
        dayName: format(d, 'EEEEE', { locale: it }).toUpperCase(),
        fullDayName: format(d, 'EEEE', { locale: it }),
        isToday: format(d, 'yyyy-MM-dd') === todayStr,
        workouts: []
      })
    }
    return week
  })
  const [recentAssignments, setRecentAssignments] = useState([])

  const meta = user?.user_metadata || {}
  const userName = meta.first_name || meta.full_name?.split(' ')[0] || user?.email?.split('@')[0] || ''

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Buongiorno'
    if (hour < 18) return 'Buon pomeriggio'
    return 'Buonasera'
  }

  const randomMotiv = useMemo(() => {
    return getDailyMotivation()
  }, [])

  useEffect(() => {
    if (!role || !user) return

    const fetchData = async () => {
      setLoading(true)
      setLoadingRecent(true)

      let wCountCoach = 0
      let aCountCoach = 0
      let wCountAthlete = 0

      const todayStr = format(new Date(), 'yyyy-MM-dd')
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = format(yesterday, 'yyyy-MM-dd')
      const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
      const weekStartStr = format(weekStart, 'yyyy-MM-dd')

      const promises = []

      if (role === 'admin' || role === 'coach') {
        promises.push(
          Promise.all([
            supabase.from('workouts').select('*', { count: 'exact', head: true }),
            supabase.from('athletes').select('*', { count: 'exact', head: true }),
            supabase.from('athlete_workouts')
              .select('id, completed_date, status, athletes(id, name, surname, photo_url), workouts(id, title, sections)')
              .in('completed_date', [todayStr, yesterdayStr])
              .order('completed_date', { ascending: false })
          ]).then(([wRes, aRes, recentAwRes]) => {
            wCountCoach = wRes.count || 0
            aCountCoach = aRes.count || 0
            if (recentAwRes.data) setRecentAssignments(recentAwRes.data)
            setLoadingRecent(false)
          })
        )
      } else {
        setLoadingRecent(false)
      }

      if (role === 'athlete' || role === 'admin') {
        promises.push(
          Promise.all([
            supabase.from('athlete_workouts').select('*', { count: 'exact', head: true }).eq('athlete_id', user.id),
            supabase.from('athlete_workouts')
              .select('id, completed_date, status, workouts (id, title, sections)')
              .eq('athlete_id', user.id)
              .gte('completed_date', weekStartStr)
              .order('completed_date', { ascending: true })
              .limit(30)
          ]).then(([wRes, dataRes]) => {
            wCountAthlete = wRes.count || 0
            const data = dataRes.data
            if (data) {
              const todayWs = data.filter(w => w.completed_date === todayStr)
              setTodayWorkouts(todayWs)

              const upcoming = data.filter(w => w.completed_date > todayStr && w.status !== 'completed').slice(0, 3)
              setUpcomingWorkouts(upcoming)

              const week = []
              for(let i=0; i<7; i++) {
                const d = new Date(weekStart)
                d.setDate(d.getDate() + i)
                const dStr = format(d, 'yyyy-MM-dd')
                
                const dayWorkouts = data.filter(w => w.completed_date === dStr)
                
                week.push({
                  date: d,
                  dayName: format(d, 'EEEEE', { locale: it }).toUpperCase(),
                  fullDayName: format(d, 'EEEE', { locale: it }),
                  isToday: dStr === todayStr,
                  workouts: dayWorkouts.map(w => ({
                    id: w.id,
                    workoutId: w.workouts?.id,
                    title: w.workouts?.title,
                    status: w.status,
                    category: w.workouts?.sections?.category || (w.workouts?.sections?.steps ? 'Running' : 'Hyrox')
                  }))
                })
              }
              setWeeklyStatus(week)
            }
          })
        )
      }

      await Promise.all(promises)

      if (role === 'athlete') {
        setStats({ workouts: wCountAthlete, athletes: 0 })
      } else {
        setStats({ workouts: wCountCoach, athletes: aCountCoach })
      }
      setLoading(false)
    }

    fetchData()
  }, [role, user])

  const toggleTodayWorkout = async (e, workout) => {
    e.stopPropagation()
    const newStatus = workout.status === 'completed' ? 'pending' : 'completed'
    
    setTodayWorkouts(prev => prev.map(w => w.id === workout.id ? { ...w, status: newStatus } : w))
    setWeeklyStatus(prev => prev.map(d => {
      if (d.isToday) {
        return { ...d, workouts: d.workouts.map(dw => dw.id === workout.id ? { ...dw, status: newStatus } : dw) }
      }
      return d
    }))

    const { error } = await supabase.from('athlete_workouts').update({ status: newStatus }).eq('id', workout.id)
    if (error) {
       setTodayWorkouts(prev => prev.map(w => w.id === workout.id ? { ...w, status: workout.status } : w))
       setWeeklyStatus(prev => prev.map(d => {
         if (d.isToday) {
           return { ...d, workouts: d.workouts.map(dw => dw.id === workout.id ? { ...dw, status: workout.status } : dw) }
         }
         return d
       }))
    }
  }

  const todayStrRender = format(new Date(), 'yyyy-MM-dd')

  return (
    <div className="p-4 max-w-2xl mx-auto pb-24 page-transition">
      {/* Header */}
      <div className="mb-6 mt-4 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-3xl font-black text-white tracking-tight">FLEO<span className="text-[#f1ba17]">FIT</span></h1>
          </div>
          {role === 'athlete' || role === 'admin' ? (
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
      {(role === 'athlete' || role === 'admin') && weeklyStatus.length > 0 && (
        <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-3xl p-6 mb-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-white font-bold text-sm">La tua settimana</h3>
            <span className="text-xs text-[#f1ba17] bg-[#f1ba17]/10 border border-[#f1ba17]/20 px-3 py-1 rounded-full font-bold">
              {weeklyStatus.reduce((acc, d) => acc + d.workouts.filter(w => w.status === 'completed').length, 0)} / {weeklyStatus.reduce((acc, d) => acc + d.workouts.length, 0)} completati
            </span>
          </div>
          <div className="flex justify-between items-start w-full">
            {weeklyStatus.map((day, i) => {
              return (
                <div key={i} className="flex flex-col items-center gap-1.5 flex-1">
                  <span className={`text-[11px] font-bold ${day.isToday ? 'text-white' : 'text-gray-400'}`}>
                    {day.dayName.charAt(0)}
                  </span>
                  <span className={`text-xs font-bold mb-1 ${day.isToday ? 'text-[#f1ba17]' : 'text-gray-500'}`}>
                    {format(day.date, 'd')}
                  </span>
                  
                  {day.workouts.length > 0 ? (
                    <div className="flex flex-col gap-1.5">
                      {day.workouts.map((w, wIdx) => {
                        const isRun = w.category === 'Running'
                        let circleClass = ''
                        let icon = null
                        
                        if (w.status === 'completed') {
                           circleClass = 'bg-green-500 border-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]'
                           icon = <CheckCircle2 size={14} className="text-black" />
                        } else {
                           if (day.isToday) {
                             circleClass = isRun ? 'bg-[#0094C6] border-[#0094C6] shadow-[0_0_8px_rgba(0,148,198,0.4)]' : 'bg-[#f1ba17] border-[#f1ba17] shadow-[0_0_8px_rgba(241,186,23,0.4)]'
                             icon = isRun ? <Timer size={14} className="text-white" /> : <Dumbbell size={14} className="text-black" />
                           } else {
                             circleClass = isRun ? 'bg-transparent border-[#0094C6]' : 'bg-transparent border-[#f1ba17]'
                             icon = isRun ? <Timer size={14} className="text-[#0094C6]" /> : <Dumbbell size={14} className="text-[#f1ba17]" />
                           }
                        }

                        return (
                          <div 
                            key={wIdx}
                            className={`w-7 h-7 rounded-full border-[2px] flex items-center justify-center cursor-pointer hover:scale-110 transition-transform ${circleClass}`}
                            onClick={() => navigate(`/workout/${w.workoutId}?athlete_id=${user.id}`)}
                            title={w.title}
                          >
                            {icon}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className={`w-7 h-7 rounded-full border-[2px] flex items-center justify-center ${day.isToday ? 'bg-[#333] border-[#333]' : 'bg-transparent border-[#333]'}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-[#444]"></span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Main CTA */}
      {role !== 'athlete' && (
        <div onClick={() => navigate('/create')} className="bg-gradient-to-br from-[#2a2a2a] to-[#1e1e1e] border border-[#f1ba17]/50 rounded-3xl p-6 cursor-pointer hover:border-[#f1ba17] transition relative overflow-hidden group mb-6">
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

      {/* RECENT ASSIGNMENTS FOR COACH */}
      {role !== 'athlete' && (
        <div className="mb-6">
          <h2 className="text-lg font-bold text-white mb-3">Attività Atleti (Oggi e Ieri)</h2>
          {loadingRecent ? (
            <div className="flex flex-col gap-3">
              <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-2xl p-4 h-20 animate-pulse"></div>
              <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-2xl p-4 h-20 animate-pulse"></div>
            </div>
          ) : recentAssignments.length > 0 ? (
            <div className="flex flex-col gap-3">
              {recentAssignments.map(a => {
                const category = a.workouts?.sections?.category || (a.workouts?.sections?.steps ? 'Running' : 'Hyrox');
                const isRun = category === 'Running';
                return (
                <div key={a.id} onClick={() => navigate(`/athletes/${a.athletes?.id}`)} className={`bg-[#1e1e1e] border border-[#2a2a2a] rounded-2xl p-4 cursor-pointer transition ${isRun ? 'hover:border-[#0094C6]' : 'hover:border-[#f1ba17]'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <div className="w-10 h-10 rounded-full bg-[#2a2a2a] flex items-center justify-center overflow-hidden shrink-0 border border-[#333]">
                        {a.athletes?.photo_url ? (
                          <img src={a.athletes.photo_url} alt={a.athletes?.name} className="w-full h-full object-cover" onError={(e) => e.target.style.opacity = 0} />
                        ) : (
                          <User size={18} className="text-gray-500" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-white font-semibold text-sm truncate">{a.athletes?.name} {a.athletes?.surname}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${isRun ? 'bg-[#0094C6]/10 text-[#0094C6] border-[#0094C6]/30' : 'bg-[#f1ba17]/10 text-[#f1ba17] border-[#f1ba17]/30'}`}>
                            {category}
                          </span>
                          <p className="text-gray-500 text-xs truncate">{a.workouts?.title}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">
                        {a.completed_date === todayStrRender ? 'Oggi' : 'Ieri'}
                      </p>
                      <div className={`px-2 py-1 rounded-md border text-[10px] font-bold ${a.status === 'completed' ? 'bg-green-500/10 text-green-500 border-green-500/30' : 'bg-[#111] text-gray-500 border-[#333]'}`}>
                        {a.status === 'completed' ? 'Fatto' : 'Da fare'}
                      </div>
                    </div>
                  </div>
                </div>
              )})}
            </div>
          ) : (
            <div className="bg-[#1e1e1e] border border-[#2a2a2a] border-dashed rounded-2xl p-6 text-center">
              <p className="text-gray-500 text-sm">Nessuna attività registrata tra oggi e ieri.</p>
            </div>
          )}
        </div>
      )}

      {/* Today's Workout for Athlete */}
      {(role === 'athlete' || role === 'admin') && (
        <div className="mb-6">
          <h2 className="text-lg font-bold text-white mb-3">Oggi</h2>
          {loading ? (
             <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-3xl p-6 h-32 animate-pulse"></div>
          ) : todayWorkouts.length > 0 ? (
            <div className="flex flex-col gap-3">
              {todayWorkouts.map((todayWorkout) => {
                const todayIsRun = todayWorkout.workouts?.sections?.category === 'Running' || todayWorkout.workouts?.sections?.steps ? true : false;
                
                return (
                  <div 
                    key={todayWorkout.id}
                    onClick={() => navigate(`/workout/${todayWorkout.workouts.id}?athlete_id=${user.id}`)}
                    className={`rounded-3xl p-6 cursor-pointer transition border relative overflow-hidden group ${
                      todayWorkout.status === 'completed'
                        ? 'bg-green-500/10 border-green-500/30 hover:border-green-500'
                        : (todayIsRun ? 'bg-gradient-to-br from-[#2a2a2a] to-[#1e1e1e] border-[#0094C6]/50 hover:border-[#0094C6]' : 'bg-gradient-to-br from-[#2a2a2a] to-[#1e1e1e] border-[#f1ba17]/50 hover:border-[#f1ba17]')
                    }`}
                  >
                    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition">
                      {todayWorkout.status === 'completed' ? <CheckCircle2 size={80} className="text-green-500 -rotate-12" /> : (todayIsRun ? <Timer size={80} className="text-[#0094C6] -rotate-12" /> : <Flame size={80} className="text-[#f1ba17] -rotate-12" />)}
                    </div>
                    <div className="relative z-10">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 shadow-lg shrink-0 ${
                        todayWorkout.status === 'completed' ? 'bg-green-500 text-black shadow-green-500/20' : (todayIsRun ? 'bg-[#0094C6] text-white shadow-[#0094C6]/20' : 'bg-[#f1ba17] text-black shadow-[#f1ba17]/20')
                      }`}>
                        {todayWorkout.status === 'completed' ? <CheckCircle2 size={24} /> : (todayIsRun ? <Timer size={24} /> : <Dumbbell size={24} />)}
                      </div>
                      <h3 className="text-white font-bold text-xl mb-1 truncate pr-8">{todayWorkout.workouts.title}</h3>
                      <p className={`text-sm font-medium ${todayWorkout.status === 'completed' ? 'text-green-400' : (todayIsRun ? 'text-[#0094C6]' : 'text-[#f1ba17]')}`}>
                        {todayWorkout.status === 'completed' ? 'Ottimo lavoro, completato! 🎉' : 'Da completare oggi 🔥'}
                      </p>
                      <div className="mt-4">
                        <button 
                          onClick={(e) => toggleTodayWorkout(e, todayWorkout)}
                          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold transition border ${
                            todayWorkout.status === 'completed' 
                              ? 'bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30' 
                              : (todayIsRun ? 'bg-[#111] border-[#333] text-gray-300 hover:border-[#0094C6] hover:text-[#0094C6]' : 'bg-[#111] border-[#333] text-gray-300 hover:border-[#f1ba17] hover:text-[#f1ba17]')
                          }`}
                        >
                          {todayWorkout.status === 'completed' ? <CheckCircle2 size={16} /> : <Circle size={16} />} 
                          {todayWorkout.status === 'completed' ? 'Fatto' : 'Segna come completato'}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
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
      {(role === 'athlete' || role === 'admin') && (loading || upcomingWorkouts.length > 0) && (
        <div className="mb-8">
          <h2 className="text-lg font-bold text-white mb-3">I prossimi allenamenti</h2>
          {loading ? (
            <div className="flex flex-col gap-3">
              <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-2xl p-4 h-16 animate-pulse"></div>
              <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-2xl p-4 h-16 animate-pulse"></div>
            </div>
          ) : (
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
          )}
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

        {role !== 'athlete' && (
          <div onClick={() => navigate('/athletes')} className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-3xl p-5 cursor-pointer hover:border-[#f1ba17] transition flex flex-col gap-3">
            <div className="w-10 h-10 rounded-full bg-[#2a2a2a] flex items-center justify-center text-gray-300 shrink-0">
              <Users size={20} />
            </div>
            <div>
              <h3 className="text-white font-bold text-lg">Atleti</h3>
              <p className="text-gray-500 text-xs mt-1">{stats.athletes} atleti totali</p>
            </div>
          </div>
        )}
        {(role === 'athlete' || role === 'admin') && (
          <div onClick={() => navigate('/profile')} className={`bg-[#1e1e1e] border border-[#2a2a2a] rounded-3xl p-5 cursor-pointer hover:border-[#f1ba17] transition flex flex-col gap-3 ${role === 'admin' ? 'col-span-2' : ''}`}>
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