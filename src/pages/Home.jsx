import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, Users, Dumbbell, Plus, FolderArchive, Settings, CheckCircle2, Flame, CalendarX2, ChevronRight, User, Circle, Sun, Check, Timer, X, Edit, Trash2, AlertTriangle, Bell, BellRing } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../App'
import { startOfWeek, format, parseISO, differenceInDays, startOfDay } from 'date-fns'
import { it } from 'date-fns/locale'
import { getDailyMotivation } from './motivations'
import CustomDatePicker from '../components/CustomDatePicker'
import { CustomAlert, CustomConfirm } from '../components/CustomModals'
import { createPortal } from 'react-dom'
import { App as CapacitorApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { Badge } from '@capawesome/capacitor-badge'

const parseNotesAndRpe = (fullNote) => {
  if (!fullNote) return { rpe: '5', text: '' };
  const match = fullNote.match(/^\[RPE:\s*(\d+)\/10\]\n?([\s\S]*)$/);
  if (match) {
    return { rpe: match[1], text: match[2] };
  }
  return { rpe: '5', text: fullNote };
}
const formatNotesWithRpe = (rpe, text) => {
  const cleanText = text.trim();
  if (!cleanText && rpe === '5') return '';
  return `[RPE: ${rpe}/10]\n${cleanText}`;
}

export default function Home() {
  const navigate = useNavigate()
  const [stats, setStats] = useState({ workouts: 0, athletes: 0 })
  const { role, user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [loadingRecent, setLoadingRecent] = useState(true)
  
  const [todayWorkouts, setTodayWorkouts] = useState([])
  const [upcomingWorkouts, setUpcomingWorkouts] = useState([])
  const [nextEventHome, setNextEventHome] = useState(null)
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

  const [autonomousModalOpen, setAutonomousModalOpen] = useState(false)
  const [autonomousForm, setAutonomousForm] = useState({ title: '', date: format(new Date(), 'yyyy-MM-dd'), notes: '', id: null, awId: null })
  const [savingAutonomous, setSavingAutonomous] = useState(false)
  const [workoutToRemove, setWorkoutToRemove] = useState(null)
  const [dbName, setDbName] = useState('')
  const [alertInfo, setAlertInfo] = useState(null)
  const [confirmInfo, setConfirmInfo] = useState(null)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotifications, setShowNotifications] = useState(false)
  const [isClosingNotifications, setIsClosingNotifications] = useState(false)
  const [isOpeningNotifications, setIsOpeningNotifications] = useState(false)
  const [startY, setStartY] = useState(null)
  const [currentY, setCurrentY] = useState(null)
  
  const [showRpeModal, setShowRpeModal] = useState(false)
  const [workoutToComplete, setWorkoutToComplete] = useState(null)
  const [rpeScore, setRpeScore] = useState('5')
  const [rpeNotes, setRpeNotes] = useState('')
  const [savingRpe, setSavingRpe] = useState(false)

  const meta = user?.user_metadata || {}
  const fallbackName = localStorage.getItem(`fleofit_name_${user?.id}`) || meta.first_name || meta.full_name?.split(' ')[0] || user?.email?.split('@')[0] || ''
  const userName = dbName || fallbackName

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

      const fetchNotifications = async () => {
        if (!user?.id) return;
        const { data } = await supabase.from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(30);
        if (data) {
          setNotifications(data);
          const unread = data.filter(n => !n.is_read).length;
          setUnreadCount(unread);
          if (Capacitor.isNativePlatform()) {
            try {
              if (unread === 0) await Badge.clear();
              else await Badge.set({ count: unread });
              await supabase.from('push_subscriptions').update({ badge_count: unread }).eq('user_id', user.id).eq('auth', 'capacitor_ios');
            } catch (e) {}
          }
        }
      };

      if (user?.id) {
        promises.push(
          (async () => {
            await supabase.from('athletes').update({ deleted_at: null }).eq('id', user.id)
            const { data } = await supabase.from('athletes').select('name').eq('id', user.id).single()
            if (data?.name) setDbName(data.name)
          })()
        )
        promises.push(fetchNotifications())

      }

      if (role === 'admin' || role === 'coach') {
        promises.push(
          Promise.all([
            supabase.from('workouts').select('*', { count: 'exact', head: true }),
            supabase.from('athletes').select('*', { count: 'exact', head: true }).is('deleted_at', null),
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

              const events = data.filter(w => (w.workouts?.sections?.category === 'Event') && w.completed_date >= todayStr).sort((a, b) => a.completed_date.localeCompare(b.completed_date))
              setNextEventHome(events[0] || null)

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

    // Rende le notifiche in Home in "Tempo Reale"
    let notifSub;
        let stateListener;

    if (user?.id) {
      notifSub = supabase.channel('public:notifications')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, (payload) => {
setNotifications(prev => {
            if (prev.find(n => n.id === payload.new.id)) return prev;
            return [payload.new, ...prev].slice(0, 30);
          });
          setUnreadCount(prev => {
            const newCount = prev + 1;
            if (Capacitor.isNativePlatform()) {
              Badge.set({ count: newCount }).catch(()=>{});
              supabase.from('push_subscriptions').update({ badge_count: newCount }).eq('user_id', user.id).eq('auth', 'capacitor_ios').then();
            }
            return newCount;
          });
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, (payload) => {
          setNotifications(prev => {
            const updated = prev.map(n => n.id === payload.new.id ? payload.new : n);
            const unread = updated.filter(n => !n.is_read).length;
            setUnreadCount(unread);
            if (Capacitor.isNativePlatform()) {
              if (unread === 0) Badge.clear().catch(()=>{});
              else Badge.set({ count: unread }).catch(()=>{});
              supabase.from('push_subscriptions').update({ badge_count: unread }).eq('user_id', user.id).eq('auth', 'capacitor_ios').then();
            }
            return updated;
          });
        })
        .subscribe();
        if (Capacitor.isNativePlatform()) {
        CapacitorApp.addListener('appStateChange', ({ isActive }) => {
          if (isActive) fetchNotifications();
        }).then(l => stateListener = l);
      }
    }
    return () => {
      if (notifSub) supabase.removeChannel(notifSub);
            if (stateListener) stateListener.remove();

    }
  }, [role, user])

  useEffect(() => {
    if (showNotifications) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'auto'
    }
    return () => { document.body.style.overflow = 'auto' }
  }, [showNotifications])

  const openNotifications = () => {
    setIsOpeningNotifications(true)
    setShowNotifications(true)
    setTimeout(() => {
      setIsOpeningNotifications(false)
    }, 10) // 10ms permettono al browser di preparare l'elemento prima di scivolare
  }

  const closeNotifications = () => {
    setIsClosingNotifications(true)
    setTimeout(() => {
      setShowNotifications(false)
      setIsClosingNotifications(false)
      setStartY(null)
      setCurrentY(null)
    }, 300)
  }

  const handleTouchStart = (e) => setStartY(e.touches[0].clientY)
  const handleTouchMove = (e) => {
    if (startY === null) return
    const y = e.touches[0].clientY
    if (y > startY) setCurrentY(y)
  }
  const handleTouchEnd = () => {
    if (startY !== null && currentY !== null) {
      if (currentY - startY > 100) {
        closeNotifications()
      } else {
        setStartY(null)
        setCurrentY(null)
      }
    } else {
      setStartY(null)
      setCurrentY(null)
    }
  }
  const swipeOffset = startY !== null && currentY !== null && currentY > startY ? currentY - startY : 0;

  let countdownDays = null
  if (nextEventHome) {
    countdownDays = differenceInDays(parseISO(nextEventHome.completed_date), startOfDay(new Date()))
  }

  const updateWorkoutNote = async (workoutId, notes, workoutTitle) => {
    const { error } = await supabase.from('athlete_workouts').update({ notes }).eq('id', workoutId)
    if (!error && role === 'athlete') {
      supabase.functions.invoke('send-reminders', {
        body: { mode: 'coach_notification', action: 'note', athleteName: userName, workoutTitle: workoutTitle || 'Workout', noteText: notes, route: `/workout/${workoutId}?athlete_id=${user.id}` }
      }).catch(console.error)
    }
    return { error }
  }

  const toggleTodayWorkout = async (e, workout) => {
    e.stopPropagation()

    if (workout.status === 'completed') {
      const newStatus = 'pending'
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
      return
    }

    setWorkoutToComplete(workout)
    const parsed = parseNotesAndRpe(workout.notes)
    setRpeNotes(parsed.text)
    setRpeScore(parsed.rpe)
    setShowRpeModal(true)
  }

  const handleRpeSubmitHome = async () => {
    setSavingRpe(true)
    const newStatus = 'completed'
    const finalNote = formatNotesWithRpe(rpeScore, rpeNotes)
    
    const { error } = await supabase.from('athlete_workouts').update({ 
      status: newStatus,
      notes: finalNote
    }).eq('id', workoutToComplete.id)

    setSavingRpe(false)

    if (error) {
      setAlertInfo({ title: 'Errore', message: error.message, type: 'error' })
      return
    }

    setTodayWorkouts(prev => prev.map(w => w.id === workoutToComplete.id ? { ...w, status: newStatus, notes: finalNote } : w))
    setWeeklyStatus(prev => prev.map(d => {
      if (d.isToday) {
        return { ...d, workouts: d.workouts.map(dw => dw.id === workoutToComplete.id ? { ...dw, status: newStatus } : dw) }
      }
      return d
    }))

    setShowRpeModal(false)
    
    if (role === 'athlete') {
      supabase.functions.invoke('send-reminders', {
        body: { mode: 'coach_notification', action: 'completed', athleteName: userName, workoutTitle: workoutToComplete.workouts?.title || workoutToComplete.title, route: `/workout/${workoutToComplete.workouts?.id || workoutToComplete.id}?athlete_id=${user.id}` }
      }).catch(console.error)
    }
    setWorkoutToComplete(null)
  }

  const todayStrRender = format(new Date(), 'yyyy-MM-dd')

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
        const { error: wError } = await supabase.from('workouts').update({
          title: autonomousForm.title,
          date: autonomousForm.date
        }).eq('id', autonomousForm.id)
        if (wError) throw wError

        const { error: awError } = await supabase.from('athlete_workouts').update({
          completed_date: autonomousForm.date,
          notes: autonomousForm.notes
        }).eq('id', autonomousForm.awId)
        if (awError) throw awError
      } else {
        const { data: newW, error: wError } = await supabase.from('workouts').insert({
          title: autonomousForm.title,
          date: autonomousForm.date,
          sections: { category: 'Custom', isAutonomous: true }
        }).select().single()

        if (wError) throw wError

        const { error: awError } = await supabase.from('athlete_workouts').insert({
          athlete_id: user.id,
          workout_id: newW.id,
          completed_date: autonomousForm.date,
          status: 'completed',
          notes: autonomousForm.notes
        })
        if (awError) throw awError
      
        if (role === 'athlete') {
          supabase.functions.invoke('send-reminders', {
            body: { mode: 'coach_notification', action: 'custom_workout', athleteName: userName, workoutTitle: autonomousForm.title, route: `/workout/${newW.id}?athlete_id=${user.id}` }
          }).catch(console.error)
        }
      }

      setAutonomousModalOpen(false)
      setAutonomousForm({ title: '', date: format(new Date(), 'yyyy-MM-dd'), notes: '', id: null, awId: null })
      window.location.reload()
    } catch (err) {
      alert("Errore: " + err.message)
    }
    setSavingAutonomous(false)
  }

  const confirmRemoveWorkout = async () => {
    if (!workoutToRemove) return
    try {
      const { error } = await supabase.from('athlete_workouts').delete().eq('id', workoutToRemove)
      if (error) throw error
      setWorkoutToRemove(null)
      window.location.reload()
    } catch (err) {
      alert("Errore: " + err.message)
    }
  }

  return (
    <div className="px-4 max-w-2xl mx-auto pb-24 pt-[calc(env(safe-area-inset-top)+1rem)] page-transition">
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
        <div className="flex items-center gap-2">
          <button onClick={openNotifications} className="relative w-11 h-11 rounded-full bg-[#1e1e1e] border border-[#333] flex items-center justify-center text-gray-400 hover:text-white hover:border-[#f1ba17] transition shadow-sm shrink-0" title="Centro Notifiche">
            <Bell size={20} />
            {unreadCount > 0 && <span className="absolute -top-1 -right-1 flex items-center justify-center w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full border-2 border-[#1e1e1e]">{unreadCount > 9 ? '9+' : unreadCount}</span>}
          </button>
          <button onClick={() => navigate('/settings')} className="w-11 h-11 rounded-full bg-[#1e1e1e] border border-[#333] flex items-center justify-center text-gray-400 hover:text-white hover:border-[#f1ba17] transition shadow-sm shrink-0">
            <Settings size={22} />
          </button>
        </div>
      </div>

      {/* BANNER PROSSIMO EVENTO */}
      {(role === 'athlete' || role === 'admin') && nextEventHome && (
        <div 
          onClick={() => navigate(`/workout/${nextEventHome.workouts.id}?athlete_id=${user.id}`)}
          className="bg-gradient-to-r from-[#2a2a2a] to-[#111] border border-[#f1ba17]/30 rounded-3xl p-5 mb-6 flex items-center justify-between shadow-lg shadow-[#f1ba17]/10 cursor-pointer hover:border-[#f1ba17]/60 transition group"
        >
           <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#f1ba17]/10 rounded-full flex items-center justify-center text-[#f1ba17] shrink-0 shadow-inner group-hover:scale-110 transition-transform">
                 <CalendarDays size={24} />
              </div>
              <div>
                 <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-0.5">Prossimo Obiettivo</p>
                 <p className="text-white font-black text-xl leading-tight group-hover:text-[#f1ba17] transition-colors">{nextEventHome.workouts.title}</p>
                 <p className="text-[#f1ba17]/80 text-sm mt-0.5 font-medium">{format(parseISO(nextEventHome.completed_date), 'EEEE d MMMM yyyy', { locale: it })}</p>
              </div>
           </div>
           <div className="flex flex-col items-center justify-center bg-gradient-to-br from-[#f1ba17] to-yellow-600 rounded-2xl px-5 py-2.5 shadow-xl min-w-[80px]">
              <span className="text-3xl font-black text-black leading-none">{countdownDays}</span>
              <span className="text-black/80 text-[10px] font-bold uppercase tracking-wider mt-1">{countdownDays === 1 ? 'giorno' : 'giorni'}</span>
           </div>
        </div>
      )}

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
                        const isCustom = w.category === 'Custom' || w.category === 'Autonomo'
                        const isEvent = w.category === 'Event'
                        let circleClass = ''
                        let icon = null
                        
                        if (w.status === 'completed') {
                           circleClass = 'bg-green-500 border-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]'
                           icon = <CheckCircle2 size={14} className="text-black" />
                        } else {
                           if (day.isToday) {
                             circleClass = isEvent ? 'bg-white border-white shadow-[0_0_8px_rgba(255,255,255,0.4)]' : isRun ? 'bg-[#0094C6] border-[#0094C6] shadow-[0_0_8px_rgba(0,148,198,0.4)]' : isCustom ? 'bg-[#D11149] border-[#D11149] shadow-[0_0_8px_rgba(209,17,73,0.4)]' : 'bg-[#f1ba17] border-[#f1ba17] shadow-[0_0_8px_rgba(241,186,23,0.4)]'
                             icon = isEvent ? <CalendarDays size={14} className="text-black" /> : isRun ? <Timer size={14} className="text-white" /> : isCustom ? <Dumbbell size={14} className="text-white" /> : <Dumbbell size={14} className="text-black" />
                           } else {
                             circleClass = isEvent ? 'bg-transparent border-white' : isRun ? 'bg-transparent border-[#0094C6]' : isCustom ? 'bg-transparent border-[#D11149]' : 'bg-transparent border-[#f1ba17]'
                             icon = isEvent ? <CalendarDays size={14} className="text-white" /> : isRun ? <Timer size={14} className="text-[#0094C6]" /> : isCustom ? <Dumbbell size={14} className="text-[#D11149]" /> : <Dumbbell size={14} className="text-[#f1ba17]" />
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
                const rawCat = a.workouts?.sections?.category || (a.workouts?.sections?.steps ? 'Running' : 'Hyrox');
                const isCustom = rawCat === 'Custom' || rawCat === 'Autonomo';
                const isEvent = rawCat === 'Event';
                const category = isEvent ? 'Event' : isCustom ? 'Custom' : rawCat;
                const isRun = category === 'Running';
                return (
                <div key={a.id} onClick={() => navigate(`/athletes/${a.athletes?.id}`)} className={`bg-[#1e1e1e] border border-[#2a2a2a] rounded-2xl p-4 cursor-pointer transition ${isEvent ? 'hover:border-white' : isRun ? 'hover:border-[#0094C6]' : isCustom ? 'hover:border-[#D11149]' : 'hover:border-[#f1ba17]'}`}>
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
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${isEvent ? 'bg-white text-black border-white' : isRun ? 'bg-[#0094C6]/10 text-[#0094C6] border-[#0094C6]/30' : isCustom ? 'bg-[#D11149]/10 text-[#D11149] border-[#D11149]/30' : 'bg-[#f1ba17]/10 text-[#f1ba17] border-[#f1ba17]/30'}`}>
                            {isEvent ? 'Evento' : category}
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
                const rawCat = todayWorkout.workouts?.sections?.category || (todayWorkout.workouts?.sections?.steps ? 'Running' : 'Hyrox');
                const todayIsEvent = rawCat === 'Event';
                const todayIsCustom = rawCat === 'Custom' || rawCat === 'Autonomo';
                const category = todayIsEvent ? 'Event' : todayIsCustom ? 'Custom' : rawCat;
                const todayIsRun = category === 'Running';
                
                return (
                  <div 
                    key={todayWorkout.id}
                    onClick={() => navigate(`/workout/${todayWorkout.workouts.id}?athlete_id=${user.id}`)}
                    className={`rounded-3xl p-6 cursor-pointer transition border relative overflow-hidden group ${
                      todayWorkout.status === 'completed'
                        ? 'bg-green-500/10 border-green-500/30 hover:border-green-500'
                        : (todayIsEvent ? 'bg-gradient-to-br from-[#2a2a2a] to-[#1e1e1e] border-white/50 hover:border-white' : todayIsRun ? 'bg-gradient-to-br from-[#2a2a2a] to-[#1e1e1e] border-[#0094C6]/50 hover:border-[#0094C6]' : todayIsCustom ? 'bg-gradient-to-br from-[#2a2a2a] to-[#1e1e1e] border-[#D11149]/50 hover:border-[#D11149]' : 'bg-gradient-to-br from-[#2a2a2a] to-[#1e1e1e] border-[#f1ba17]/50 hover:border-[#f1ba17]')
                    }`}
                  >
                    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition">
                      {todayWorkout.status === 'completed' ? <CheckCircle2 size={80} className="text-green-500 -rotate-12" /> : (todayIsEvent ? <CalendarDays size={80} className="text-white/30 -rotate-12" /> : todayIsRun ? <Timer size={80} className="text-[#0094C6] -rotate-12" /> : todayIsCustom ? <Dumbbell size={80} className="text-[#D11149] -rotate-12" /> : <Flame size={80} className="text-[#f1ba17] -rotate-12" />)}
                    </div>
                    <div className="relative z-10">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 shadow-lg shrink-0 ${
                        todayWorkout.status === 'completed' ? 'bg-green-500 text-black shadow-green-500/20' : (todayIsEvent ? 'bg-white text-black shadow-white/20' : todayIsRun ? 'bg-[#0094C6] text-white shadow-[#0094C6]/20' : todayIsCustom ? 'bg-[#D11149] text-white shadow-[#D11149]/20' : 'bg-[#f1ba17] text-black shadow-[#f1ba17]/20')
                      }`}>
                        {todayWorkout.status === 'completed' ? <CheckCircle2 size={24} /> : (todayIsEvent ? <CalendarDays size={24} /> : todayIsRun ? <Timer size={24} /> : <Dumbbell size={24} />)}
                      </div>
                      <h3 className="text-white font-bold text-xl mb-1 truncate pr-8">{todayWorkout.workouts.title}</h3>
                      <p className={`text-sm font-medium ${todayWorkout.status === 'completed' ? 'text-green-400' : (todayIsEvent ? 'text-gray-300' : todayIsRun ? 'text-[#0094C6]' : todayIsCustom ? 'text-[#D11149]' : 'text-[#f1ba17]')}`}>
                        {todayWorkout.status === 'completed' ? 'Ottimo lavoro, completato! 🎉' : (todayIsEvent ? 'Oggi è il grande giorno! 🏁' : 'Da completare oggi 🔥')}
                      </p>
                      <div className="mt-4">
                        <button 
                          onClick={(e) => toggleTodayWorkout(e, todayWorkout)}
                          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold transition border ${
                            todayWorkout.status === 'completed' 
                              ? 'bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30' 
                              : (todayIsEvent ? 'bg-[#111] border-[#333] text-white hover:border-white hover:text-white' : todayIsRun ? 'bg-[#111] border-[#333] text-gray-300 hover:border-[#0094C6] hover:text-[#0094C6]' : todayIsCustom ? 'bg-[#111] border-[#333] text-gray-300 hover:border-[#D11149] hover:text-[#D11149]' : 'bg-[#111] border-[#333] text-gray-300 hover:border-[#f1ba17] hover:text-[#f1ba17]')
                          }`}
                        >
                          {todayWorkout.status === 'completed' ? <CheckCircle2 size={16} /> : <Circle size={16} />} 
                          {todayWorkout.status === 'completed' ? 'Fatto' : 'Segna come completato'}
                        </button>
                        {todayIsCustom && role === 'athlete' && (
                          <div className="flex items-center gap-2">
                             <button onClick={(e) => { e.stopPropagation(); openEditAutonomous(todayWorkout); }} className="p-2 text-gray-400 hover:text-[#f1ba17] transition bg-[#111] rounded-full border border-[#333]" title="Modifica"><Edit size={16}/></button>
                             <button onClick={(e) => { e.stopPropagation(); setWorkoutToRemove(todayWorkout.id); }} className="p-2 text-gray-400 hover:text-red-500 transition bg-[#111] rounded-full border border-[#333]" title="Elimina"><Trash2 size={16}/></button>
                          </div>
                        )}
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

      {/* Bottone Aggiungi Allenamento Libero */}
      {role === 'athlete' && (
        <div className="mb-6">
          <button 
            onClick={() => setAutonomousModalOpen(true)} 
            className="w-full flex items-center justify-center gap-2 bg-[#2a2a2a] border border-[#383838] text-white font-semibold py-3 rounded-2xl hover:border-[#f1ba17] hover:text-[#f1ba17] transition shadow-sm"
          >
            <Plus size={18} className="text-[#f1ba17]" /> Aggiungi allenamento libero
          </button>
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
              {upcomingWorkouts.map(w => {
                const isCustom = w.workouts?.sections?.category === 'Custom' || w.workouts?.sections?.category === 'Autonomo' || w.workouts?.sections?.isAutonomous;
                return (
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
                    <div className="flex items-center gap-2">
                      {role === 'athlete' && isCustom && (
                        <>
                          <button onClick={(e) => { e.stopPropagation(); openEditAutonomous(w); }} className="p-1.5 text-gray-500 hover:text-[#f1ba17] transition" title="Modifica"><Edit size={18}/></button>
                          <button onClick={(e) => { e.stopPropagation(); setWorkoutToRemove(w.id); }} className="p-1.5 text-gray-500 hover:text-red-500 transition" title="Elimina"><Trash2 size={18}/></button>
                        </>
                      )}
                      <div className="w-8 h-8 rounded-full bg-[#2a2a2a] flex items-center justify-center text-gray-400 ml-1">
                        <ChevronRight size={18} className="ml-0.5" />
                      </div>
                    </div>
                  </div>
              )})}
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
        Archivio Workout
      </button>

      {/* MODAL CENTRO NOTIFICHE */}
      {showNotifications && createPortal(
        <div 
          className={`fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4 transition-colors duration-300 ${isClosingNotifications || isOpeningNotifications ? 'bg-black/0' : 'bg-black/85'}`}
          onClick={closeNotifications}
        >
          <div 
            className={`bg-[#1e1e1e] w-full sm:max-w-sm sm:rounded-3xl rounded-t-3xl h-[80vh] sm:h-[60vh] flex flex-col border border-[#333] shadow-2xl transition-all duration-300 ease-out ${isClosingNotifications || isOpeningNotifications ? 'translate-y-full sm:scale-95 sm:opacity-0' : (swipeOffset > 0 ? 'transition-none' : 'translate-y-0 sm:scale-100 sm:opacity-100')}`}
            style={{ transform: swipeOffset > 0 ? `translateY(${swipeOffset}px)` : undefined }}
            onClick={e => e.stopPropagation()}
          >
            <div className="w-full flex justify-center pt-3 pb-2 touch-none cursor-grab active:cursor-grabbing sm:hidden" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
              <div className="w-12 h-1.5 bg-[#333] rounded-full"></div>
            </div>
            <div className="flex items-center justify-between px-5 pb-4 sm:pt-5 border-b border-[#2a2a2a]">
              <div className="flex items-center gap-2">
                <p className="text-white font-bold text-lg">Notifiche</p>
                {unreadCount > 0 && <span className="bg-[#f1ba17] text-black text-xs font-bold px-2 py-0.5 rounded-full">{unreadCount} nuove</span>}
              </div>
              <div className="flex items-center gap-3">
                {unreadCount > 0 && (
                  <button onClick={async () => {
                    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
                    setUnreadCount(0)
                    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false)
                    if (Capacitor.isNativePlatform()) {
                      try {
                        await Badge.clear();
                        await supabase.from('push_subscriptions').update({ badge_count: 0 }).eq('user_id', user.id).eq('auth', 'capacitor_ios');
                      } catch (e) {}
                    }
                  }} className="text-[11px] font-semibold text-[#f1ba17] hover:underline whitespace-nowrap">
                    Segna come lette
                  </button>
                )}
                           <div className="w-px h-4 bg-[#333] ml-1 mr-0.5"></div>

                <button onClick={closeNotifications} className="text-gray-500 hover:text-white"><X size={20} /></button>
              </div>
            </div>
            <div className="overflow-y-auto p-4 flex flex-col gap-2 flex-1 hide-scrollbar">
              {notifications.length > 0 ? (
                                <>
                  {notifications.map(notif => (
                    <div key={notif.id} onClick={async () => {
                      if (!notif.is_read) {
                        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n))
                      const newCount = Math.max(0, unreadCount - 1)
                      setUnreadCount(newCount)
                      await supabase.from('notifications').update({ is_read: true }).eq('id', notif.id)
                      if (Capacitor.isNativePlatform()) {
                        try {
                          if (newCount === 0) {
                            await Badge.clear();
                          } else {
                            await Badge.set({ count: newCount });
                          }
                          await supabase.from('push_subscriptions').update({ badge_count: newCount }).eq('user_id', user.id).eq('auth', 'capacitor_ios');
                        } catch (e) {}
                      }
                    }
                    closeNotifications()
                    if (notif.route) setTimeout(() => navigate(notif.route), 300)
                  }} className={`p-4 rounded-2xl cursor-pointer transition border ${notif.is_read ? 'bg-[#111] border-[#333] opacity-70' : 'bg-[#2a2a2a] border-[#f1ba17]/30 hover:border-[#f1ba17]'}`}>
                    <div className="flex justify-between items-start gap-2 mb-1">
                      <p className={`font-bold text-base ${notif.is_read ? 'text-gray-300' : 'text-white'}`}>{notif.title}</p>
                      <p className="text-[10px] text-gray-500 whitespace-nowrap pt-1">{format(parseISO(notif.created_at), 'd MMM HH:mm', { locale: it })}</p>
                    </div>
                    <p className={`text-sm leading-snug line-clamp-2 break-words ${notif.is_read ? 'text-gray-400' : 'text-gray-200'}`}>{notif.message}</p>
 </div>
                  ))}
                  <div className="mt-2 mb-2 flex justify-center">
                    <button onClick={() => {
                      setConfirmInfo({
                        title: "Svuota Notifiche",
                        message: "Vuoi eliminare definitivamente tutto lo storico delle notifiche?",
                        onConfirm: async () => {
                          setNotifications([])
                          setUnreadCount(0)
                          await supabase.from('notifications').delete().eq('user_id', user.id)
                          if (Capacitor.isNativePlatform()) {
                            try {
                              await Badge.clear();
                              await supabase.from('push_subscriptions').update({ badge_count: 0 }).eq('user_id', user.id).eq('auth', 'capacitor_ios');
                            } catch (e) {}
                          }
                          setConfirmInfo(null)
                        }
                      })
                    }} className="text-xs font-semibold text-gray-500 hover:text-red-400 transition flex items-center gap-1.5 px-4 py-2 rounded-full border border-transparent hover:border-red-500/30 hover:bg-red-900/20">
                      <Trash2 size={14} /> Svuota cronologia
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center p-6 opacity-50">
                  <BellRing size={48} className="text-gray-500 mb-4" />
                  <p className="text-gray-400 font-medium">Nessuna notifica</p>
                  <p className="text-gray-500 text-xs mt-1">Quando ci saranno novità, le vedrai qui.</p>
                </div>
              )}
            </div>
          </div>
        </div>,
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
                  className="bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#f1ba17] w-full text-base"
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
                  className="bg-[#111] border border-[#333] rounded-xl px-4 py-3 hover:border-[#f1ba17] w-full text-base"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs pl-1 mb-1 block">Descrizione / Note</label>
                <textarea 
                  className="bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#f1ba17] w-full text-base resize-none"
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

      {createPortal(
        <>
          {alertInfo && <CustomAlert info={alertInfo} onClose={() => setAlertInfo(null)} />}
          {confirmInfo && <CustomConfirm info={confirmInfo} onClose={() => setConfirmInfo(null)} />}
        </>,
        document.body
      )}
      {showRpeModal && createPortal(
        <RpeModal 
          score={rpeScore} 
          onScoreChange={setRpeScore} 
          notes={rpeNotes} 
          onNotesChange={setRpeNotes} 
          onSave={handleRpeSubmitHome} 
          onCancel={() => { setShowRpeModal(false); setWorkoutToComplete(null); }} 
          saving={savingRpe} 
        />,
        document.body
      )}
    </div>
  )
}

function RpeModal({ score, onScoreChange, notes, onNotesChange, onSave, onCancel, saving }) {
  const getRpeColor = (val) => {
    if (val <= 3) return 'bg-green-500';
    if (val <= 6) return 'bg-yellow-400';
    if (val <= 8) return 'bg-orange-500';
    return 'bg-red-500';
  }
  const getRpeLabel = (val) => {
    if (val <= 3) return 'Molto leggero 🟢';
    if (val <= 6) return 'Moderato 🟡';
    if (val <= 8) return 'Impegnativo 🟠';
    return 'Massimale 🔴';
  }
  return (
    <div className="fixed inset-0 bg-black/85 z-[150] flex items-center justify-center p-4">
      <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-3xl w-full max-w-sm p-6 flex flex-col shadow-2xl animate-in fade-in zoom-in-[0.96] duration-300 ease-out">
        <h2 className="text-2xl font-black text-white mb-2 tracking-tight">Com'è andata?</h2>
        <p className="text-gray-400 text-sm mb-6">Valuta lo sforzo percepito (RPE) e aggiungi eventuali note per il coach.</p>
        <div className="flex flex-col gap-2 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-white font-bold">Sforzo: {score}/10</span>
            <span className={`text-xs font-bold px-2 py-1 rounded-md text-black ${getRpeColor(parseInt(score))}`}>
              {getRpeLabel(parseInt(score))}
            </span>
          </div>
          <div className="flex items-center gap-1 w-full">
            {Array.from({ length: 10 }, (_, i) => i + 1).map(s => {
              const isActive = s <= parseInt(score);
              let color = 'bg-[#333]';
              if (isActive) color = getRpeColor(parseInt(score));
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => onScoreChange(String(s))}
                  className={`flex-1 h-10 rounded-md transition-all duration-150 ${color} ${isActive ? 'shadow-md scale-105' : 'hover:bg-[#444]'}`}
                />
              )
            })}
          </div>
          <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-gray-500 mt-1">
            <span>Leggero</span>
            <span>Estremo</span>
          </div>
        </div>
        <div className="mb-6">
          <label className="text-white font-bold mb-2 block text-sm">Note sull'allenamento</label>
          <textarea
            className="w-full bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-[#f1ba17] resize-none text-base transition-colors"
            rows={3}
            placeholder="Sensazioni, pesi usati, dolori..."
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
          />
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={saving} className="flex-1 py-3.5 bg-[#2a2a2a] text-white font-semibold rounded-xl hover:bg-[#333] transition disabled:opacity-50">Annulla</button>
          <button onClick={onSave} disabled={saving} className="flex-1 py-3.5 bg-[#f1ba17] text-black font-black rounded-xl hover:brightness-110 transition disabled:opacity-50 shadow-lg shadow-[#f1ba17]/20">{saving ? '...' : 'Fatto! 🎉'}</button>
        </div>
      </div>
    </div>
  )
}