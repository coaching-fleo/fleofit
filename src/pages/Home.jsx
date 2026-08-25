import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, Users, Dumbbell, Plus, FolderArchive, Settings, CheckCircle2, Flame, CalendarX2, ChevronRight, User, Circle, Sun, Check, Timer, X, Edit, Trash2, AlertTriangle, Bell, BellRing, Activity, Mic, Square, Heart, WifiOff, RefreshCw } from 'lucide-react'
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
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { VoiceRecorder as NativeVoiceRecorder } from '@independo/capacitor-voice-recorder'
import { Badge } from '@capawesome/capacitor-badge'
import { BluetoothService } from './bluetooth'
import { Network } from '@capacitor/network'
import { generaTitolo, titoloOppureGenerato, titoliDelGiorno } from '../lib/workoutTitle'
import { parseNotesAndRpe, formatNotesWithRpe } from '../lib/rpe'
import { mostraErrore } from '../lib/alert'


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
  const [weeklyStats, setWeeklyStats] = useState({ distance: '0 m', time: 0, reps: 0, completed: 0, avgRpe: '-' })

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
  // Rilancia il fetch dei dati senza ricaricare l'intera app (vedi confirmRemoveWorkout)
  const [refreshTick, setRefreshTick] = useState(0)
  // Swipe verso destra sulla card di oggi per completare. È un ACCELERATORE:
  // il bottone visibile resta la via principale, quindi nessuna funzione dipende
  // da un gesto che non si vede. Serve anche a evitare la mira su un bersaglio
  // piccolo quando si ha fretta.
  // Swipe verso destra per completare, con il comportamento di iOS.
  //
  // Il gesto NON passa dallo stato React: la prima versione faceva setState a
  // ogni touchmove e ridisegnava l'intera Home a ogni frame del dito — da lì
  // lo scatto. Qui si scrive direttamente sul nodo, così il movimento resta
  // sul compositor e il dito comanda i pixel a 1:1.
  //
  // Sotto la card c'è un pannello verde che si rivela man mano: senza, il
  // movimento non dice cosa sta per succedere.
  const SOGLIA_SWIPE = 120
  const swipeRef = useRef(null)

  // Definita a livello di componente: la usa sia il caricamento iniziale sia il
  // listener appStateChange al ritorno in primo piano. Prima viveva dentro
  // fetchData, quindi al risveglio dell'app lanciava ReferenceError e le
  // notifiche non si aggiornavano mai.
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

  const swipeInizio = (e) => {
    const el = e.currentTarget
    const t = e.touches[0]
    swipeRef.current = {
      el,
      pannello: el.parentElement?.querySelector('[data-swipe-panel]') || null,
      x0: t.clientX, y0: t.clientY, attivo: false, oltre: false,
    }
    el.style.transition = 'none'
  }

  const swipeMuovi = (e) => {
    const s = swipeRef.current
    if (!s || !s.el) return
    const t = e.touches[0]
    const dx = t.clientX - s.x0
    const dy = t.clientY - s.y0

    if (!s.attivo) {
      // Se il dito va in verticale è uno scroll di pagina: molliamo il gesto.
      if (Math.abs(dy) > 10 && Math.abs(dy) >= Math.abs(dx)) { s.el = null; return }
      if (dx > 12 && dx > Math.abs(dy) * 1.5) s.attivo = true
      else return
    }

    // Oltre la soglia la card cede sempre meno: è la resistenza che fa capire
    // al dito di aver superato il punto di conferma.
    const grezzo = Math.max(0, dx)
    const x = grezzo <= SOGLIA_SWIPE ? grezzo : SOGLIA_SWIPE + (grezzo - SOGLIA_SWIPE) * 0.28
    s.el.style.transform = `translate3d(${x}px,0,0)`

    const avanzamento = Math.min(1, grezzo / SOGLIA_SWIPE)
    if (s.pannello) {
      s.pannello.style.opacity = String(Math.min(1, avanzamento * 1.6))
      const contenuto = s.pannello.firstElementChild
      if (contenuto) contenuto.style.transform = `scale(${0.72 + avanzamento * 0.28})`
    }

    const oltre = grezzo >= SOGLIA_SWIPE
    if (oltre !== s.oltre) {
      s.oltre = oltre
      // Un colpetto quando si attraversa la soglia: lo senti prima di lasciare.
      if (oltre && Capacitor.isNativePlatform()) Haptics.impact({ style: ImpactStyle.Light }).catch(() => {})
    }
  }

  const swipeFine = (workout) => {
    const s = swipeRef.current
    swipeRef.current = null
    if (!s || !s.el) return
    const el = s.el
    const pannello = s.pannello

    if (!s.oltre) {
      // Sotto la soglia: ritorno elastico, non succede nulla.
      el.style.transition = 'transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)'
      el.style.transform = 'translate3d(0,0,0)'
      if (pannello) {
        pannello.style.transition = 'opacity 0.3s ease-out'
        pannello.style.opacity = '0'
      }
      setTimeout(() => { el.style.transition = ''; el.style.transform = '' }, 500)
      return
    }

    // Oltre la soglia: l'animazione VA FINO IN FONDO. La card esce di scena e il
    // pannello verde riempie tutto lo spazio; solo a movimento concluso si apre
    // la richiesta dell'RPE. Aprirla subito interrompeva il gesto a metà.
    if (Capacitor.isNativePlatform()) Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {})
    if (pannello) { pannello.style.transition = 'opacity 0.12s ease-out'; pannello.style.opacity = '1' }
    el.style.transition = 'transform 0.34s cubic-bezier(0.32, 0.72, 0, 1)'
    el.style.transform = `translate3d(${el.offsetWidth}px,0,0)`

    setTimeout(() => {
      toggleTodayWorkout({ stopPropagation: () => {} }, workout)
      // La card torna al suo posto senza animazione, nascosta dal pannello ancora
      // pieno; poi il verde svanisce e la scopre nel suo nuovo stato.
      el.style.transition = 'none'
      el.style.transform = ''
      requestAnimationFrame(() => {
        el.style.transition = ''
        if (pannello) {
          pannello.style.transition = 'opacity 0.35s ease-out'
          pannello.style.opacity = '0'
        }
      })
    }, 340)
  }
  const [activeSlide, setActiveSlide] = useState(0)
  const [workoutToComplete, setWorkoutToComplete] = useState(null)
  const [rpeScore, setRpeScore] = useState('5')
  const [rpeNotes, setRpeNotes] = useState('')
  const [savingRpe, setSavingRpe] = useState(false)
  const [liveAthletes, setLiveAthletes] = useState([])
  const [spectatingAthlete, setSpectatingAthlete] = useState(null)

  const [hrConnected, setHrConnected] = useState(false)
  const [heartRate, setHeartRate] = useState(null)
  const [isOffline, setIsOffline] = useState(false)
  const [syncingQueue, setSyncingQueue] = useState(false)

  const meta = user?.user_metadata || {}
  const fallbackName = localStorage.getItem(`fleofit_name_${user?.id}`) || meta.first_name || meta.full_name?.split(' ')[0] || user?.email?.split('@')[0] || ''
  const userName = dbName || fallbackName

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Buongiorno'
    if (hour < 18) return 'Buon pomeriggio'
    return 'Buonasera'
  }

  useEffect(() => {
    const initNetwork = async () => {
      const status = await Network.getStatus()
      setIsOffline(!status.connected)
      if (status.connected) processOfflineQueue()
    }
    initNetwork()

    // Anche all'avvio: se la rete è tornata mentre l'app era chiusa o l'utente era
    // su un'altra schermata, la coda restava ferma fino al rientro in Home.
    Network.getStatus().then(s => { if (s.connected) processOfflineQueue() }).catch(() => {})

    const listener = Network.addListener('networkStatusChange', status => {
      setIsOffline(!status.connected)
      if (status.connected) {
        processOfflineQueue()
      }
    })

    return () => { listener.then(l => l.remove()) }
  }, [])

  // Una sola azione in coda per allenamento: senza, toccando due volte lo stesso
  // workout offline si accodavano due UPDATE che si sovrascrivevano al ritorno
  // della rete. L'ultima vince, che è l'intenzione dell'utente.
  const accodaOffline = (payload) => {
    let coda = []
    try { coda = JSON.parse(localStorage.getItem('fleofit_offline_queue') || '[]') } catch { coda = [] }
    coda = coda.filter(a => !(a.type === 'UPDATE_WORKOUT' && a.payload?.id === payload.id))
    coda.push({ type: 'UPDATE_WORKOUT', payload, ts: Date.now() })
    localStorage.setItem('fleofit_offline_queue', JSON.stringify(coda))
  }

  const processOfflineQueue = async () => {
    const queueStr = localStorage.getItem('fleofit_offline_queue')
    if (!queueStr) return
    let queue = []
    try { queue = JSON.parse(queueStr) } catch (e) { return }
    if (queue.length === 0) return

    setSyncingQueue(true)
    const remaining = []
    for (const action of queue) {
      if (action.type === 'UPDATE_WORKOUT') {
        const { id, status, notes } = action.payload
        const { error } = await supabase.from('athlete_workouts').update({ status, notes }).eq('id', id)
        if (error) remaining.push(action)
      }
    }
    localStorage.setItem('fleofit_offline_queue', JSON.stringify(remaining))
    setSyncingQueue(false)
  }

  useEffect(() => {
    return BluetoothService.subscribe((connected, hr) => {
      setHrConnected(connected)
      setHeartRate(hr)
    })
  }, [])

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


      if (user?.id) {
        promises.push(
          (async () => {
            // ⚠️ Qui c'era un update({ deleted_at: null }) senza condizioni, eseguito
            // a OGNI caricamento della Home. Effetto: un atleta eliminato dal coach
            // si ripristinava da solo semplicemente aprendo l'app, tornava nella
            // rubrica e il conto alla rovescia dei 7 giorni ripartiva da zero.
            // Il ripristino ora è un gesto esplicito del coach, in Atleti →
            // "Eliminati di recente".
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
              .select('id, completed_date, status, notes, workouts (id, title, sections)')
              .eq('athlete_id', user.id)
              .gte('completed_date', weekStartStr)
              .order('completed_date', { ascending: true })
              .limit(30)
          ]).then(([wRes, dataRes]) => {
            wCountAthlete = wRes.count || 0
            let data = dataRes.data
            if (dataRes.error || !data) {
              const cached = localStorage.getItem(`fleofit_cache_workouts_${user.id}`)
              if (cached) {
                try { data = JSON.parse(cached) } catch(e){}
              }
            } else {
              localStorage.setItem(`fleofit_cache_workouts_${user.id}`, JSON.stringify(data))
            }

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

              // Calcolo Statistiche Settimanali
              const weekEnd = new Date(weekStart)
              weekEnd.setDate(weekStart.getDate() + 6)
              const weekEndStr = format(weekEnd, 'yyyy-MM-dd')

              const weekData = data.filter(w => w.completed_date >= weekStartStr && w.completed_date <= weekEndStr)

              let distance = 0
              let time = 0
              let reps = 0
              let completed = 0
              let rpeSum = 0
              let rpeCount = 0

              const parseTime = (val) => {
                 if (!val || val === '-') return 0
                 const s = String(val).toLowerCase()
                 if (s.includes('sec')) return (parseInt(s) || 0) / 60
                 if (s.includes('min')) {
                    const parts = s.replace('min', '').trim().split(':')
                    if (parts.length === 2) return parseInt(parts[0]) + parseInt(parts[1])/60
                    return parseInt(s) || 0
                 }
                 const parts = s.split(':')
                 if (parts.length === 2) return parseInt(parts[0]) + parseInt(parts[1])/60
                 return parseInt(s) || 0
              }

              const parseDist = (val) => {
                 if (!val || val === '-') return 0
                 const s = String(val).toLowerCase()
                 if (s.includes('km')) return parseFloat(s) * 1000
                 if (s.includes('m') && !s.includes('min')) return parseInt(s) || 0
                 return 0
              }

              weekData.forEach(w => {
                if (w.status === 'completed') {
                  completed++
                  
                  const parsed = parseNotesAndRpe(w.notes)
                  const rpeVal = parseInt(parsed.rpe)
                  if (!isNaN(rpeVal)) {
                      rpeSum += rpeVal
                      rpeCount++
                  }

                  const s = w.workouts?.sections || {}
                  const cat = s.category || (s.steps ? 'Running' : 'Hyrox')
                  let workoutTime = 0;

                  if (cat === 'Running') {
                    const steps = s.steps || s.main?.steps || []
                    steps.forEach(step => {
                      if (step.type === 'repeat') {
                         const rounds = parseInt(step.rounds) || 1
                         distance += parseDist(step.runDuration) * rounds
                         distance += parseDist(step.recDuration) * rounds
                         workoutTime += parseTime(step.runDuration) * rounds
                         workoutTime += parseTime(step.recDuration) * rounds
                      } else {
                         distance += parseDist(step.duration)
                         let stepTime = parseTime(step.duration)
                         if (stepTime === 0 && step.duration) {
                           const ds = String(step.duration).toLowerCase()
                           if (ds.includes('km')) stepTime = parseFloat(ds) * 6
                           else if (ds.includes('m')) stepTime = (parseInt(ds) || 0) / 1000 * 6
                         }
                         workoutTime += stepTime
                      }
                    })
                  } else {
                    let blocks = s.blocks || []
                    if (blocks.length === 0) {
                      if (s.warmup) blocks.push({type: 'WarmUp', params: { duration: s.warmup.duration }})
                      if (s.cashIn && s.cashIn.length > 0) blocks.push({type: 'Cash In', exercises: s.cashIn})
                      if (s.main) blocks.push({type: s.main.type === 'EMOM' && s.main.params?.on ? 'ON/OFF' : s.main.type, params: s.main.params || {}, exercises: s.main.exercises || []})
                      if (s.cashOut && s.cashOut.length > 0) blocks.push({type: 'Cash Out', exercises: s.cashOut})
                    }

                    blocks.forEach(b => {
                       let blockRounds = parseInt(b.params?.rounds) || 1
                       if (b.type === 'ON/OFF') {
                           workoutTime += (parseTime(b.params?.on) + parseTime(b.params?.off)) * blockRounds
                       } else if (b.type === 'EMOM') {
                           workoutTime += parseTime(b.params?.interval) * blockRounds
                       } else if (b.type === 'AMRAP' || b.type === 'WarmUp' || b.type === 'Rest') {
                           workoutTime += parseTime(b.params?.duration)
                       } else if (b.type === 'For Time') {
                           workoutTime += 15 * blockRounds
                       } else if (b.type === 'Cash In' || b.type === 'Cash Out') {
                           workoutTime += 5 * blockRounds
                       }

                       (b.exercises || []).forEach(ex => {
                          distance += parseDist(ex.meters) * blockRounds
                          const r = ex.reps || ''
                          if (r && r !== '-' && r.toLowerCase() !== 'max') {
                             reps += (parseInt(r) || 0) * blockRounds
                          }
                          if (b.type === 'Interval') {
                              workoutTime += parseTime(ex.exTime) * blockRounds
                          }
                       })
                    })
                  }
                  if (workoutTime === 0) workoutTime = 45;
                  time += workoutTime;
                }
              })
              
              setWeeklyStats({ 
                 distance: distance >= 1000 ? (distance / 1000).toFixed(2).replace(/\.00$/, '') + ' km' : distance + ' m', 
                 time: Math.round(time), 
                 reps, 
                 completed,
                 avgRpe: rpeCount > 0 ? (rpeSum / rpeCount).toFixed(1) : '-'
              })
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

       // Rende visibili gli atleti LIVE nella dashboard
    let presenceRoom;
    if (role === 'admin' || role === 'coach') {
      presenceRoom = supabase.channel('global_live_workouts', {
        config: {
          presence: {
            key: user.id,
          },
        },
      });
      presenceRoom.on('presence', { event: 'sync' }, () => {
        const state = presenceRoom.presenceState();
        const active = [];
        for (const id in state) {
          if (state[id][0].athleteWorkoutId) {
            active.push(state[id][0]);
          }
        }
        setLiveAthletes(active);
      }).subscribe();
    }
    return () => {
      if (notifSub) supabase.removeChannel(notifSub);
            if (stateListener) stateListener.remove();

      if (presenceRoom) supabase.removeChannel(presenceRoom);
    }
  }, [role, user, refreshTick])

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

  // Riporta un allenamento a "da fare". Prima era un tap singolo, silenzioso e
  // irreversibile: un tocco storto lo scompletava senza chiedere niente. E il
  // ramo offline non esisteva, quindi senza rete falliva e faceva rollback senza
  // spiegazione — al contrario del completamento, che invece era già in coda.
  const annullaCompletamento = async (workout) => {
    const applica = (stato) => {
      setTodayWorkouts(prev => prev.map(w => w.id === workout.id ? { ...w, status: stato } : w))
      setWeeklyStatus(prev => prev.map(d => d.isToday
        ? { ...d, workouts: d.workouts.map(dw => dw.id === workout.id ? { ...dw, status: stato } : dw) }
        : d))
    }
    applica('pending')

    const rete = await Network.getStatus()
    if (!rete.connected) {
      accodaOffline({ id: workout.id, status: 'pending', notes: workout.notes })
      const cache = JSON.parse(localStorage.getItem(`fleofit_cache_workouts_${user.id}`) || '[]')
      localStorage.setItem(`fleofit_cache_workouts_${user.id}`,
        JSON.stringify(cache.map(w => w.id === workout.id ? { ...w, status: 'pending' } : w)))
      return
    }

    const { error } = await supabase.from('athlete_workouts').update({ status: 'pending' }).eq('id', workout.id)
    if (error) {
      applica(workout.status)
      mostraErrore(error.message)
    }
  }

  const toggleTodayWorkout = async (e, workout) => {
    e.stopPropagation()

    if (workout.status === 'completed') {
      setConfirmInfo({
        title: 'Segnarlo come da fare?',
        message: "L'allenamento torna fra quelli da completare. L'RPE e le note che hai scritto restano salvati.",
        onConfirm: () => annullaCompletamento(workout)
      })
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
    
    const status = await Network.getStatus()
    if (!status.connected) {
      accodaOffline({ id: workoutToComplete.id, status: newStatus, notes: finalNote })
      
      const cached = JSON.parse(localStorage.getItem(`fleofit_cache_workouts_${user.id}`) || '[]')
      const updatedCache = cached.map(w => w.id === workoutToComplete.id ? { ...w, status: newStatus, notes: finalNote } : w)
      localStorage.setItem(`fleofit_cache_workouts_${user.id}`, JSON.stringify(updatedCache))
    } else {
      const { error } = await supabase.from('athlete_workouts').update({ 
        status: newStatus,
        notes: finalNote
      }).eq('id', workoutToComplete.id)

      if (error) {
        setAlertInfo({ title: 'Errore', message: error.message, type: 'error' })
        setSavingRpe(false)
        return
      }
    }

    setSavingRpe(false)

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
    const titoloFinale = titoloOppureGenerato(
      autonomousForm.title,
      autonomousForm.date,
      await titoliDelGiorno(supabase, autonomousForm.date)
    )
    try {
      if (autonomousForm.id) {
        const { error: wError } = await supabase.from('workouts').update({
          title: titoloFinale,
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
          title: titoloFinale,
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
            body: { mode: 'coach_notification', action: 'custom_workout', athleteName: userName, workoutTitle: titoloFinale, route: `/workout/${newW.id}?athlete_id=${user.id}` }
          }).catch(console.error)
        }
      }

      setAutonomousModalOpen(false)
      setAutonomousForm({ title: '', date: format(new Date(), 'yyyy-MM-dd'), notes: '', id: null, awId: null })
      setRefreshTick(t => t + 1)
    } catch (err) {
      mostraErrore("Errore: " + err.message)
    }
    setSavingAutonomous(false)
  }

  const confirmRemoveWorkout = async () => {
    if (!workoutToRemove) return
    try {
      const { error } = await supabase.from('athlete_workouts').delete().eq('id', workoutToRemove)
      if (error) throw error
      setWorkoutToRemove(null)
      setRefreshTick(t => t + 1)
    } catch (err) {
      mostraErrore("Errore: " + err.message)
    }
  }

  const handleSliderScroll = (e) => {
    const scrollLeft = e.target.scrollLeft;
    const width = e.target.clientWidth;
    const index = Math.round(scrollLeft / width);
    if (activeSlide !== index) {
      setActiveSlide(index);
    }
  };

  return (
    <div className="px-4 max-w-2xl mx-auto pb-[calc(6rem+env(safe-area-inset-bottom))] pt-[calc(env(safe-area-inset-top)+1rem)] page-transition">
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
          {hrConnected && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/30 text-red-500 rounded-full text-xs font-bold shrink-0">
              <Heart size={14} className={heartRate ? "animate-pulse" : ""} fill="currentColor" /> {heartRate ? `${heartRate} bpm` : 'BLE'}
            </div>
          )}
          <button onClick={openNotifications} className="relative w-11 h-11 rounded-full bg-[#1e1e1e] border border-[#333] flex items-center justify-center text-gray-400 hover:text-white hover:border-[#f1ba17] transition shadow-sm shrink-0" title="Centro Notifiche">
            <Bell size={20} />
            {unreadCount > 0 && <span className="absolute -top-1 -right-1 flex items-center justify-center w-5 h-5 bg-red-500 text-white text-[11px] font-bold rounded-full border-2 border-[#1e1e1e]">{unreadCount > 9 ? '9+' : unreadCount}</span>}
          </button>
          <button aria-label="Apri le impostazioni" onClick={() => navigate('/settings')} className="w-11 h-11 rounded-full bg-[#1e1e1e] border border-[#333] flex items-center justify-center text-gray-400 hover:text-white hover:border-[#f1ba17] transition shadow-sm shrink-0">
            <Settings size={22} />
          </button>
        </div>
      </div>

      {/* OFFLINE BANNER */}
      {isOffline && (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-4 mb-6 flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-3">
            <WifiOff size={24} className="text-orange-500" />
            <div>
              <p className="text-orange-500 text-xs font-bold uppercase tracking-wider">Modalità Offline</p>
              <p className="text-orange-500/80 text-[11px] font-medium leading-tight">Puoi allenarti e salvare. Sincronizzeremo tutto appena torna la linea.</p>
            </div>
          </div>
        </div>
      )}
      {syncingQueue && (
         <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-3 mb-6 flex items-center justify-center gap-2">
           <RefreshCw size={16} className="text-green-500 animate-spin" />
           <p className="text-green-500 text-xs font-bold uppercase tracking-wider">Sincronizzazione in corso...</p>
         </div>
      )}

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
              <span className="text-black/80 text-[11px] font-bold uppercase tracking-wider mt-1">{countdownDays === 1 ? 'giorno' : 'giorni'}</span>
           </div>
        </div>
      )}

      {/* SLIDER: SETTIMANA E STATISTICHE */}
      {(role === 'athlete' || role === 'admin') && weeklyStatus.length > 0 && (
        <div className="mb-6 -mx-4">
          <div 
            className="flex w-full overflow-x-auto snap-x snap-mandatory hide-scrollbar" 
            style={{ scrollbarWidth: 'none' }}
            onScroll={handleSliderScroll}
          >
            {/* SLIDE 1: CALENDARIO SETTIMANALE */}
            <div className="w-full shrink-0 snap-center px-4">
              <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-3xl p-6 h-full flex flex-col">
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
                        <span className={`text-xs font-bold mb-1 ${day.isToday ? 'text-[#f1ba17]' : 'text-muted'}`}>
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
            </div>

            {/* SLIDE 2: STATISTICHE DELLA SETTIMANA */}
            <div className="w-full shrink-0 snap-center px-4">
              <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-3xl p-6 h-full flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white font-bold text-sm">Statistiche della settimana</h3>
                  <Activity size={16} className="text-[#f1ba17]" />
                </div>
                <div className="flex-1 grid grid-cols-3 gap-3">
                  <div className="bg-[#111] border border-[#2a2a2a] rounded-2xl p-4 flex flex-col gap-1 justify-center items-center text-center h-full">
                    <p className="text-muted text-[11px] font-bold uppercase tracking-wider">Tempo</p>
                    <p className="text-white font-black text-2xl">{weeklyStats.time}<span className="text-sm font-medium text-muted ml-0.5">m</span></p>
                  </div>
                  <div className="bg-[#111] border border-[#2a2a2a] rounded-2xl p-4 flex flex-col gap-1 justify-center items-center text-center h-full">
                    <p className="text-muted text-[11px] font-bold uppercase tracking-wider">Workout Completati</p>
                    <p className="text-[#f1ba17] font-black text-2xl">{weeklyStats.completed}</p>
                  </div>
                  <div className="bg-[#111] border border-[#2a2a2a] rounded-2xl p-4 flex flex-col gap-1 justify-center items-center text-center h-full">
                    <p className="text-muted text-[11px] font-bold uppercase tracking-wider">RPE</p>
                    <p className="text-white font-black text-2xl">{weeklyStats.avgRpe}<span className="text-sm font-medium text-muted ml-0.5">/10</span></p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Paginazione */}
          <div className="flex justify-center items-center gap-2 mt-4">
            <div className={`h-1.5 rounded-full transition-all duration-300 ${activeSlide === 0 ? 'bg-[#f1ba17] w-5' : 'bg-[#444] w-1.5'}`}></div>
            <div className={`h-1.5 rounded-full transition-all duration-300 ${activeSlide === 1 ? 'bg-[#f1ba17] w-5' : 'bg-[#444] w-1.5'}`}></div>
          </div>
        </div>
      )}

      {/* LIVE COACH CAM */}
      {role !== 'athlete' && (
        <div 
          className={`transition-all duration-700 ease-in-out overflow-hidden ${liveAthletes.length > 0 ? 'max-h-[1000px] opacity-100 mb-6' : 'max-h-0 opacity-0 mb-0'}`}
        >
          <div className="pt-2 pb-1">
            <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.8)]"></div>
              Live Coach Cam
            </h2>
            <div className="flex flex-col gap-3">
              {liveAthletes.map(la => (
                <div key={la.athleteWorkoutId} onClick={() => setSpectatingAthlete(la)} className="bg-gradient-to-r from-red-600/20 to-red-900/10 border border-red-500/30 rounded-3xl p-4 flex items-center justify-between cursor-pointer hover:border-red-500/60 transition-all duration-300 shadow-lg shadow-red-500/5 group animate-in fade-in zoom-in-[0.95] slide-in-from-top-2">
                  <div className="flex items-center gap-3 flex-1 min-w-0 pr-3">
                    <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center text-red-500 shrink-0 group-hover:scale-110 transition-transform">
                      <Activity size={24} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-white font-bold text-base truncate drop-shadow-md">{la.athleteName} è in allenamento!</p>
                      <p className="text-red-400 text-xs font-medium truncate">{la.workoutTitle}</p>
                    </div>
                  </div>
                  <button className="px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-xl hover:bg-red-500 shadow-md shrink-0">
                    Guarda
                  </button>
                </div>
              ))}
            </div>
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
                          <User size={18} className="text-muted" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-white font-semibold text-sm truncate">{a.athletes?.name} {a.athletes?.surname}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${isEvent ? 'bg-white text-black border-white' : isRun ? 'bg-[#0094C6]/10 text-[#0094C6] border-[#0094C6]/30' : isCustom ? 'bg-[#D11149]/10 text-[#D11149] border-[#D11149]/30' : 'bg-[#f1ba17]/10 text-[#f1ba17] border-[#f1ba17]/30'}`}>
                            {isEvent ? 'Evento' : category}
                          </span>
                          <p className="text-muted text-xs truncate">{a.workouts?.title}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <p className="text-[11px] text-muted font-medium uppercase tracking-wider">
                        {a.completed_date === todayStrRender ? 'Oggi' : 'Ieri'}
                      </p>
                      <div className={`px-2 py-1 rounded-lg border text-[11px] font-bold ${a.status === 'completed' ? 'bg-green-500/10 text-green-500 border-green-500/30' : 'bg-[#111] text-muted border-[#333]'}`}>
                        {a.status === 'completed' ? 'Fatto' : 'Da fare'}
                      </div>
                    </div>
                  </div>
                </div>
              )})}
            </div>
          ) : (
            <div className="bg-[#1e1e1e] border border-[#2a2a2a] border-dashed rounded-2xl p-6 text-center">
              <p className="text-muted text-sm">Nessuna attività registrata tra oggi e ieri.</p>
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
                const todayIsAuto = todayWorkout.workouts?.sections?.isAutonomous === true || rawCat === 'Autonomo';
                const todayIsCustom = rawCat === 'Custom' || todayIsAuto;
                const category = todayIsEvent ? 'Event' : todayIsCustom ? 'Custom' : rawCat;
                const todayIsRun = category === 'Running';
                
                const scorrevole = todayWorkout.status !== 'completed'
                return (
                  <div key={todayWorkout.id} className="relative overflow-hidden rounded-3xl">
                    {/* Pannello rivelato sotto la card mentre si scorre. Senza,
                        il movimento non dice cosa sta per succedere. Nascosto ai
                        lettori di schermo: il bottone visibile è la via ufficiale. */}
                    {scorrevole && (
                      <div data-swipe-panel aria-hidden="true" style={{ opacity: 0 }}
                        className="absolute inset-0 rounded-3xl bg-green-500 flex items-center pl-7 pointer-events-none">
                        <div className="flex items-center gap-2.5 text-black font-black origin-left"
                          style={{ transform: 'scale(0.72)' }}>
                          <CheckCircle2 size={30} />
                          <span className="text-base">Completato</span>
                        </div>
                      </div>
                    )}
                  <div
                    onTouchStart={scorrevole ? swipeInizio : undefined}
                    onTouchMove={scorrevole ? swipeMuovi : undefined}
                    onTouchEnd={scorrevole ? () => swipeFine(todayWorkout) : undefined}
                    onTouchCancel={scorrevole ? () => swipeFine(todayWorkout) : undefined}
                    style={{ willChange: scorrevole ? 'transform' : undefined }}
                    className={`rounded-3xl p-6 transition-colors border relative overflow-hidden group ${
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
                      <button
                        onClick={() => navigate(`/workout/${todayWorkout.workouts.id}?athlete_id=${user.id}`)}
                        aria-label={`Apri ${todayWorkout.workouts.title}`}
                        className="block w-full text-left min-h-11 rounded-xl -mx-1 px-1 hover:opacity-80 transition-opacity">
                        <h3 className="text-white font-bold text-xl mb-1 truncate pr-8">{todayWorkout.workouts.title}</h3>
                      </button>
                      <p className={`text-sm font-medium ${todayWorkout.status === 'completed' ? 'text-green-400' : (todayIsEvent ? 'text-gray-300' : todayIsRun ? 'text-[#0094C6]' : todayIsCustom ? 'text-[#D11149]' : 'text-[#f1ba17]')}`}>
                        {todayWorkout.status === 'completed' ? 'Ottimo lavoro, completato! 🎉' : (todayIsEvent ? 'Oggi è il grande giorno! 🏁' : 'Da completare oggi 🔥')}
                      </p>
                      <div className="mt-4">
                        <button 
                          onClick={(e) => toggleTodayWorkout(e, todayWorkout)}
                          className={`inline-flex items-center justify-center gap-1.5 px-5 min-h-11 rounded-full text-sm font-bold transition border ${
                            todayWorkout.status === 'completed' 
                              ? 'bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30' 
                              : (todayIsEvent ? 'bg-[#111] border-[#333] text-white hover:border-white hover:text-white' : todayIsRun ? 'bg-[#111] border-[#333] text-gray-300 hover:border-[#0094C6] hover:text-[#0094C6]' : todayIsCustom ? 'bg-[#111] border-[#333] text-gray-300 hover:border-[#D11149] hover:text-[#D11149]' : 'bg-[#111] border-[#333] text-gray-300 hover:border-[#f1ba17] hover:text-[#f1ba17]')
                          }`}
                        >
                          {todayWorkout.status === 'completed' ? <CheckCircle2 size={16} /> : <Circle size={16} />} 
                          {todayWorkout.status === 'completed' ? 'Fatto' : 'Segna come completato'}
                        </button>
                        {todayIsAuto && role === 'athlete' && (
                          <div className="flex items-center gap-2">
                             <button aria-label="Modifica l'allenamento libero" onClick={(e) => { e.stopPropagation(); openEditAutonomous(todayWorkout); }} className="p-2 text-gray-400 hover:text-[#f1ba17] transition bg-[#111] rounded-full border border-[#333]" title="Modifica"><Edit size={16}/></button>
                             <button aria-label="Elimina l'allenamento" onClick={(e) => { e.stopPropagation(); setWorkoutToRemove(todayWorkout.id); }} className="p-2 text-gray-400 hover:text-red-500 transition bg-[#111] rounded-full border border-[#333]" title="Elimina"><Trash2 size={16}/></button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="bg-[#1e1e1e] border border-[#2a2a2a] border-dashed rounded-3xl p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-[#2a2a2a] flex items-center justify-center text-muted shrink-0">
                <CalendarX2 size={24} />
              </div>
              <div>
                <h3 className="text-white font-bold">Giorno di rest</h3>
                <p className="text-muted text-sm">Recupera le energie per il prossimo allenamento. 🛋️</p>
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
                const isAuto = w.workouts?.sections?.isAutonomous === true || w.workouts?.sections?.category === 'Autonomo';
                return (
                  <div 
                    key={w.id}
                    onClick={() => navigate(`/workout/${w.workouts.id}?athlete_id=${user.id}`)}
                    className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:border-[#383838] transition"
                  >
                    <div>
                      <p className="text-white font-semibold">{w.workouts.title}</p>
                      <p className="text-muted text-xs mt-0.5 capitalize font-medium">
                        {format(parseISO(w.completed_date), 'EEEE d MMMM', { locale: it })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {role === 'athlete' && isAuto && (
                        <>
                          <button aria-label="Modifica l'allenamento libero" onClick={(e) => { e.stopPropagation(); openEditAutonomous(w); }} className="p-1.5 text-muted hover:text-[#f1ba17] transition" title="Modifica"><Edit size={18}/></button>
                          <button aria-label="Elimina l'allenamento" onClick={(e) => { e.stopPropagation(); setWorkoutToRemove(w.id); }} className="p-1.5 text-muted hover:text-red-500 transition" title="Elimina"><Trash2 size={18}/></button>
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
            <p className="text-muted text-xs mt-1">{stats.workouts} workout {role === 'athlete' ? 'assegnati' : 'creati'}</p>
          </div>
        </div>

        {role !== 'athlete' && (
          <div onClick={() => navigate('/athletes')} className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-3xl p-5 cursor-pointer hover:border-[#f1ba17] transition flex flex-col gap-3">
            <div className="w-10 h-10 rounded-full bg-[#2a2a2a] flex items-center justify-center text-gray-300 shrink-0">
              <Users size={20} />
            </div>
            <div>
              <h3 className="text-white font-bold text-lg">Atleti</h3>
              <p className="text-muted text-xs mt-1">{stats.athletes} atleti totali</p>
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
              <p className="text-muted text-xs mt-1">Dati personali</p>
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

                <button aria-label="Chiudi le notifiche" onClick={closeNotifications} className="text-muted hover:text-white"><X size={20} /></button>
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
                      <p className="text-[11px] text-muted whitespace-nowrap pt-1">{format(parseISO(notif.created_at), 'd MMM HH:mm', { locale: it })}</p>
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
                    }} className="text-xs font-semibold text-muted hover:text-red-400 transition flex items-center gap-1.5 px-4 py-2 rounded-full border border-transparent hover:border-red-500/30 hover:bg-red-900/20">
                      <Trash2 size={14} /> Svuota cronologia
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center p-6 opacity-50">
                  <BellRing size={48} className="text-muted mb-4" />
                  <p className="text-gray-400 font-medium">Nessuna notifica</p>
                  <p className="text-muted text-xs mt-1">Quando ci saranno novità, le vedrai qui.</p>
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
               <button aria-label="Chiudi" onClick={() => setAutonomousModalOpen(false)} className="text-muted hover:text-white"><X size={20} /></button>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-gray-400 text-xs pl-1 mb-1 block">Titolo <span className="text-muted font-normal">(facoltativo)</span></label>
                <input 
                  className="bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#f1ba17] w-full text-base"
                  value={autonomousForm.title}
                  onChange={(e) => setAutonomousForm({ ...autonomousForm, title: e.target.value })}
                  placeholder={generaTitolo(autonomousForm.date)}
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
                disabled={savingAutonomous}
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
      
      {/* MODAL SPETTATORE LIVE COACH */}
      {spectatingAthlete && createPortal(
        <LiveSpectatorModal 
          athlete={spectatingAthlete} 
          onClose={() => setSpectatingAthlete(null)} 
        />, document.body
      )}
    </div>
  )
}

function RpeModal({ score, onScoreChange, notes, onNotesChange, onSave, onCancel, saving }) {
  const [isFocused, setIsFocused] = useState(false);
  const containerRef = useRef(null);
  const isDragging = useRef(false);
  const blurTimeoutRef = useRef(null);
  const [syncingHealth, setSyncingHealth] = useState(false);

  const handleHealthSync = async () => {
    try {
      setSyncingHealth(true);
      const { HealthService } = await import('./health');
      const data = await HealthService.syncLatestWorkout();
      const textToAppend = `\n\n🍏 [Apple Health] Durata: ${data.duration || '--'} min | Calorie: ${data.calories || '--'} kcal | Battiti Medi: ${data.avgHeartRate || '--'} bpm`;
      onNotesChange(notes ? notes + textToAppend : textToAppend.trim());
    } catch (e) {
      mostraErrore(e.message);
    } finally {
      setSyncingHealth(false);
    }
  };

  const calculateValue = (clientX) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    let x = clientX - rect.left;
    if (x < 0) x = 0;
    if (x > rect.width) x = rect.width;
    
    let newValue = Math.ceil((x / rect.width) * 10);
    if (newValue < 1) newValue = 1;
    if (newValue > 10) newValue = 10;
    
    if (String(newValue) !== String(score)) {
      onScoreChange(String(newValue));
    }
  };

  const handlePointerDown = (e) => {
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }
    isDragging.current = true;
    const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
    calculateValue(clientX);
  };

  const handlePointerMove = (e) => {
    if (!isDragging.current) return;
    const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
    calculateValue(clientX);
  };

  useEffect(() => {
    const handlePointerUp = () => { isDragging.current = false; };
    document.addEventListener('mouseup', handlePointerUp);
    document.addEventListener('touchend', handlePointerUp);
    return () => {
      document.removeEventListener('mouseup', handlePointerUp);
      document.removeEventListener('touchend', handlePointerUp);
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    };
  }, []);

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
      <div className={`bg-[#1e1e1e] border border-[#2a2a2a] rounded-3xl w-full max-w-sm p-6 flex flex-col shadow-2xl animate-in fade-in zoom-in-[0.96] duration-300 ease-out transition-transform ${isFocused ? '-translate-y-36' : ''}`}>
        <h2 className="text-2xl font-black text-white mb-2 tracking-tight">Com'è andata?</h2>
        <p className="text-gray-400 text-sm mb-6">Valuta lo sforzo percepito (RPE) e aggiungi eventuali note per il coach.</p>
        <div className="flex flex-col gap-2 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-white font-bold">Sforzo: {score}/10</span>
            <span className={`text-xs font-bold px-2 py-1 rounded-lg text-black ${getRpeColor(parseInt(score))}`}>
              {getRpeLabel(parseInt(score))}
            </span>
          </div>
          <div 
            ref={containerRef}
            className="flex items-center gap-1 w-full cursor-pointer touch-none select-none"
            onMouseDown={handlePointerDown}
            onMouseMove={handlePointerMove}
            onTouchStart={handlePointerDown}
            onTouchMove={handlePointerMove}
          >
            {Array.from({ length: 10 }, (_, i) => i + 1).map(s => {
              const isActive = s <= parseInt(score);
              let color = 'bg-[#333]';
              if (isActive) color = getRpeColor(parseInt(score));
              return (
                <div
                  key={s}
                  className={`flex-1 h-10 rounded-lg transition-all duration-75 ${color} ${isActive ? 'shadow-md scale-105' : ''}`}
                  style={{ pointerEvents: 'none' }}
                />
              )
            })}
          </div>
          <div className="flex justify-between items-center text-[11px] font-bold uppercase tracking-wider text-muted mt-1">
            <span>Leggero</span>
            <span>Estremo</span>
          </div>
        </div>
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <label className="text-white font-bold text-sm">Note sull'allenamento</label>
            <button 
              onClick={handleHealthSync} 
              disabled={syncingHealth}
              className="text-[11px] flex items-center gap-1 bg-[#2a2a2a] hover:bg-[#333] text-gray-300 px-2 py-1 rounded-lg border border-[#444] transition disabled:opacity-50"
            >
              {syncingHealth ? 'Sincro in corso...' : '🍏 Apple Health'}
            </button>
          </div>
          <textarea
            className="w-full bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-[#f1ba17] resize-none text-base transition-colors"
            rows={3}
            placeholder="Sensazioni, pesi usati, dolori..."
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            onFocus={() => {
              if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
              setIsFocused(true);
            }}
            onBlur={() => {
              blurTimeoutRef.current = setTimeout(() => {
                setIsFocused(false);
              }, 250);
            }}
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

function LiveSpectatorModal({ athlete, onClose }) {
  const [timerState, setTimerState] = useState(null);
  const [isSendingAudio, setIsSendingAudio] = useState(false);
  const channelRef = useRef(null);

  useEffect(() => {
    const channel = supabase.channel(`live_coach_${athlete.athleteWorkoutId}`);
    channel.on('broadcast', { event: 'timer_state' }, (payload) => {
      setTimerState(payload.payload);
    }).subscribe();
    channelRef.current = channel;
    return () => supabase.removeChannel(channel);
  }, [athlete]);

  const sendReaction = (emoji) => {
    if (channelRef.current) {
      channelRef.current.send({ type: 'broadcast', event: 'reaction', payload: { emoji } });
    }
  };

  const formatT = (totalSeconds) => {
    if (isNaN(totalSeconds)) return '0:00';
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-[150] flex items-center justify-center p-4">
      <div className="bg-[#1e1e1e] border border-red-500/30 rounded-3xl w-full max-w-sm flex flex-col overflow-hidden shadow-2xl shadow-red-500/10 animate-in fade-in zoom-in-[0.96] duration-300">
        <div className="bg-red-600 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-white animate-pulse"></div><p className="text-white font-bold">LIVE: {athlete.athleteName}</p></div>
          <button aria-label="Chiudi" onClick={onClose} className="text-white/80 hover:text-white"><X size={20}/></button>
        </div>
        <div className="p-6 flex flex-col items-center justify-center min-h-[220px] relative">
          {timerState?.heartRate && (
            <div className="absolute top-2 right-4 flex items-center gap-1.5 bg-red-500/10 border border-red-500/30 text-red-500 px-3 py-1 rounded-full text-xs font-bold">
              <Heart size={14} className="animate-pulse" fill="currentColor" /> {timerState.heartRate} bpm
            </div>
          )}
          {timerState ? (<><p className="text-red-400 font-bold text-sm uppercase tracking-widest mb-1 text-center">{timerState.step?.title || 'Workout'}</p><p className="text-white font-black text-[5rem] tabular-nums tracking-tighter mb-4 leading-none">{formatT(timerState.timeLeft)}</p><div className="bg-[#111] border border-[#333] px-4 py-3 rounded-xl text-center w-full"><p className="text-gray-400 text-xs mb-1 uppercase font-bold tracking-wider">In Esecuzione</p><p className="text-white font-semibold truncate text-lg">{timerState.step?.task || 'Workout libero'}</p></div></>) : (<p className="text-muted font-medium animate-pulse text-center px-4">Connessione al telefono dell'atleta in corso...</p>)}
        </div>
        <div className="bg-[#111] p-5 border-t border-[#333]">
          <p className="text-muted text-xs font-bold text-center uppercase tracking-wider mb-4">Invia Reazione all'Atleta</p>
          <div className="flex justify-center gap-5 mb-6">
            {['🔥', '💪', '🚀', '👏', '💀'].map(emoji => (
              <button key={emoji} onClick={() => sendReaction(emoji)} className="text-4xl hover:scale-125 active:scale-90 hover:-translate-y-2 transition-all">{emoji}</button>
            ))}
          </div>
          <p className="text-muted text-xs font-bold text-center uppercase tracking-wider mb-2">
            {isSendingAudio ? 'Invio in corso...' : 'Walkie Talkie (Audio Live)'}
          </p>
          <VoiceRecorder onSave={async (blob, ext) => {
            setIsSendingAudio(true);
            const fileName = `live_audio_${athlete.athleteWorkoutId}_${Date.now()}.${ext}`;
            const { error } = await supabase.storage.from('voice-notes').upload(fileName, blob, { contentType: blob.type });
            if (!error) {
              const { data } = supabase.storage.from('voice-notes').getPublicUrl(fileName);
              if (channelRef.current) {
                channelRef.current.send({ type: 'broadcast', event: 'live_audio', payload: { url: data.publicUrl } });
              }
              // Auto-distruzione del file da Supabase dopo 60 secondi per non occupare spazio
              setTimeout(() => {
                supabase.storage.from('voice-notes').remove([fileName]).catch(() => {});
              }, 60000);
            }
            setIsSendingAudio(false);
          }} />
        </div>
      </div>
    </div>
  );
}

function AudioVisualizer({ stream }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!stream) return
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {})
    }
    const analyser = audioCtx.createAnalyser()
    const source = audioCtx.createMediaStreamSource(stream)
    source.connect(analyser)
    analyser.fftSize = 64
    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    const canvas = canvasRef.current
    const canvasCtx = canvas.getContext('2d')
    let animationId

    const draw = () => {
      animationId = requestAnimationFrame(draw)
      analyser.getByteFrequencyData(dataArray)
      canvasCtx.clearRect(0, 0, canvas.width, canvas.height)
      
      const barWidth = (canvas.width / bufferLength) * 1.5
      let x = 0

      for (let i = 0; i < bufferLength; i++) {
        let barHeight = dataArray[i] / 8
        if (barHeight < 2) barHeight = 2
        
        canvasCtx.fillStyle = '#f1ba17'
        const y = (canvas.height - barHeight) / 2
        
        canvasCtx.beginPath()
        canvasCtx.roundRect ? canvasCtx.roundRect(x, y, barWidth - 2, barHeight, 4) : canvasCtx.rect(x, y, barWidth - 2, barHeight)
        canvasCtx.fill()
        
        x += barWidth
      }
    }
    draw()

    return () => {
      cancelAnimationFrame(animationId)
      if (audioCtx.state !== 'closed') audioCtx.close()
    }
  }, [stream])

  return <canvas ref={canvasRef} className="w-full h-8" width={200} height={32} />
}

function VoiceRecorder({ onSave, onCancel }) {
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [mediaStream, setMediaStream] = useState(null)
  const isNative = Capacitor.isNativePlatform()
  
  const mediaRecorder = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const isCancelledRef = useRef(false)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (mediaStream) mediaStream.getTracks().forEach(t => t.stop())
    }
  }, [mediaStream])

  const toggleRecording = () => {
    if (isRecording) {
      stopRecordingAndSave()
    } else {
      startRecording()
    }
  }

  const startRecording = async () => {
    let stream = null;
    if (isNative) {
      try {
        let hasPerm = await NativeVoiceRecorder.hasAudioRecordingPermission()
        if (!hasPerm.value) {
          hasPerm = await NativeVoiceRecorder.requestAudioRecordingPermission()
          if (!hasPerm.value) return mostraErrore('Devi abilitare il microfono dalle impostazioni di iOS.')
        }
      } catch (e) {
        console.error("Errore permessi nativi:", e)
      }
    }
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        setMediaStream(stream)
      } catch (err) {}
    }
    if (isNative) {
      try {
        await NativeVoiceRecorder.startRecording()
        isCancelledRef.current = false
        setIsRecording(true)
        setRecordingTime(0)
        timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000)
      } catch (e) {
        mostraErrore('Impossibile accedere al microfono.')
      }
    } else {
      if (!window.MediaRecorder || !stream) {
        return mostraErrore('Il tuo browser non supporta la registrazione vocale.')
      }
      try {
        const recorder = new MediaRecorder(stream)
        chunksRef.current = []
        isCancelledRef.current = false
        
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data)
        }
        
        recorder.onstop = () => {
          const mimeType = recorder.mimeType || 'audio/webm'
          const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('aac') ? 'aac' : 'webm'
          const audioBlob = new Blob(chunksRef.current, { type: mimeType })
          if (stream) stream.getTracks().forEach(track => track.stop())
          setMediaStream(null)
          if (!isCancelledRef.current) {
            onSave(audioBlob, ext)
          } else if (onCancel) {
            onCancel()
          }
        }
        
        recorder.start()
        mediaRecorder.current = recorder
        setIsRecording(true)
        setRecordingTime(0)
        timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000)
      } catch (err) {}
    }
  }

  const cancelRecording = async () => {
    isCancelledRef.current = true
    setIsRecording(false)
    clearInterval(timerRef.current)
    if (!isNative && mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop()
      return
    }
    if (isNative) {
      if (mediaStream) {
        mediaStream.getTracks().forEach(t => t.stop())
        setMediaStream(null)
      }
      try { await NativeVoiceRecorder.stopRecording() } catch(e) {}
      if (onCancel) onCancel()
    }
  }

  const stopRecordingAndSave = async () => {
    isCancelledRef.current = false
    setIsRecording(false)
    clearInterval(timerRef.current)
    if (!isNative && mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop()
      return
    }
    if (isNative) {
      if (mediaStream) {
        mediaStream.getTracks().forEach(t => t.stop())
        setMediaStream(null)
      }
      try {
        const result = await NativeVoiceRecorder.stopRecording()
        if (result.value && result.value.recordDataBase64) {
          const mimeType = result.value.mimeType || 'audio/aac'
          const ext = mimeType.includes('mp4') ? 'mp4' : 'aac'
          const response = await fetch(`data:${mimeType};base64,${result.value.recordDataBase64}`)
          const audioBlob = await response.blob()
          onSave(audioBlob, ext)
        } else if (onCancel) onCancel()
      } catch(e) {}
    }
  }

  return (
    <div className="relative w-full">
      <div className="flex items-center gap-2 bg-[#111] border border-[#333] p-1.5 rounded-full h-12 w-full">
        {!isRecording ? (
          <button 
            onClick={toggleRecording}
            className="w-full h-full rounded-full flex items-center justify-center gap-2 text-gray-400 hover:text-white transition-all"
          >
            <Mic size={18} className="text-[#f1ba17]" /> Tocca per registrare...
          </button>
        ) : (
          <div className="flex items-center justify-between w-full px-2 gap-2">
            <div className="flex items-center gap-1 text-red-500 font-semibold animate-pulse w-12 shrink-0 select-none text-xs">
              <div className="w-2 h-2 rounded-full bg-red-500"></div>
              {Math.floor(recordingTime/60)}:{(recordingTime%60).toString().padStart(2,'0')}
            </div>
            
            <div className="flex-1 mx-2 overflow-hidden h-6 flex items-center justify-center gap-1">
              {mediaStream ? (
                <AudioVisualizer stream={mediaStream} />
              ) : (
                <div className="flex items-center gap-1 h-full py-1">
                  {[...Array(12)].map((_, i) => (
                    <div key={i} className="w-1.5 bg-[#f1ba17] rounded-full animate-bounce" style={{ height: '100%', animationDelay: `${i * 0.1}s`, animationDuration: '0.8s' }}></div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button aria-label="Annulla la registrazione" onClick={cancelRecording} className="text-gray-400 hover:text-red-500 transition p-1" title="Annulla">
                <Trash2 size={16} />
              </button>
              <button aria-label="Ferma e salva la registrazione" onClick={stopRecordingAndSave} className="w-11 h-11 flex items-center justify-center bg-[#f1ba17] text-black rounded-full hover:brightness-110 transition" title="Interrompi e Salva">
                <Square size={14} fill="currentColor" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}