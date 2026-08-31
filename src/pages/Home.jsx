import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Settings, CheckCircle2, X, Edit, Trash2, AlertTriangle, Bell, BellRing, Heart, WifiOff, RefreshCw } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../App'
import { startOfWeek, format, parseISO, differenceInDays, startOfDay, getISOWeek } from 'date-fns'
import { it } from 'date-fns/locale'
import { getDailyMotivation } from './motivations'
import CustomDatePicker from '../components/CustomDatePicker'
import { CustomAlert, CustomConfirm } from '../components/CustomModals'
import { createPortal } from 'react-dom'
import { App as CapacitorApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { BluetoothService } from './bluetooth'
import { Network } from '@capacitor/network'
import { generaTitolo, titoloOppureGenerato, titoliDelGiorno } from '../lib/workoutTitle'
import { parseNotesAndRpe, formatNotesWithRpe } from '../lib/rpe'
import { leggiJson, scriviJson, leggiCoda, accodaSuStorage, chiaveCacheWorkout, CHIAVE_CODA } from '../lib/offlineQueue'
import { mostraErrore } from '../lib/alert'
import { sincronizzaBadge } from '../lib/badge'
import RpeModal from '../components/RpeModal'
import VoiceRecorder from '../components/VoiceRecorder'
import { durataWorkout, numeroBlocchi, rpeAtteso, mediaRpeCategoria, serieGiorni, barreUltimiGiorni } from '../lib/statistiche'
import { HeaderHome, BottoneVetro, HeroOggi, HeroRest, AnelloSettimana, CellaSerie, CellaVolume, BannerObiettivo, ListaInArrivo } from '../components/HomeAtletaUI'
import { HeaderCoach, BannerLive, HeroFeedback, HeroNessunFeedback, SquadraOggi, SezioneAttenzione,
         TuttiAttivi, BarraCopertura, CtaCreaWorkout, RigaDestinazione, TitoloSezione, RigaAttivita,
         AzioneApri } from '../components/HomeCoachUI'
import { atletiFermi, allenamentiScaduti, copertura, feedbackNuovi, squadraDelGiorno,
         atletiSeguiti, contaInPausa, FINESTRA_STORICO, FINESTRA_FEEDBACK,
         GIORNI_COPERTURA, GIORNI_FERMO } from '../lib/statisticheCoach'
import { COACHING_ID } from '../lib/constants'

/**
 * Quanti giorni di storico la Home carica insieme alla settimana corrente.
 *
 * 60 è il compromesso fra due esigenze opposte: l'RPE medio di categoria vuole
 * abbastanza precedenti per dire qualcosa (serve almeno una manciata di
 * allenamenti per categoria), la Home vuole aprirsi in fretta. Una riga di
 * athlete_workouts è piccola — è il join su `workouts.sections` a pesare — e a
 * 60 giorni restiamo sotto il centinaio di righe per un atleta normale.
 */
const GIORNI_STORICO = 60
/** Quante barre ha lo sparkline della cella "Serie". */
const BARRE_SPARKLINE = 6

/**
 * Le assegnazioni che il coach ha già lette.
 *
 * ⚠️ Sta in localStorage e non nel database perché lo schema è congelato fino
 * all'approvazione su App Store (CLAUDE.md regola 0-bis) e `athlete_workouts`
 * non ha nemmeno un `created_at` su cui appoggiarsi. Conseguenza da conoscere:
 * il "letto" è per dispositivo, non per account.
 */
const chiaveFeedbackVisti = (uid) => `fleofit_feedback_visti_${uid}`

/**
 * Quanti atleti fermi entrano nell'eroe.
 *
 * Non è un limite estetico: oltre quattro nomi l'eroe smette di essere una
 * chiamata all'azione e diventa una lista, e una lista di persone da chiamare
 * non si chiama. Chi ne ha di più li trova tutti in Atleti.
 */
const MASSIMO_FERMI_IN_HOME = 4
/**
 * Quante citazioni di feedback stanno nell'eroe prima del «+N altri».
 *
 * Tre è il punto in cui la card resta leggibile in un colpo d'occhio: alla
 * quarta l'eroe supera la piega e smette di essere un eroe.
 */
const FEEDBACK_IN_HOME = 3

/**
 * «scaduto mercoledì» finché il giorno della settimana è ancora univoco, poi
 * la data. Oltre la settimana il nome del giorno indica sette date diverse.
 */
const quandoScaduto = (s) => s.giorni <= 6
  ? format(parseISO(s.data), 'EEEE', { locale: it })
  : format(parseISO(s.data), 'd MMMM', { locale: it })

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
  // Le righe grezze su cui la Home coach calcola TUTTO: atleti fermi,
  // allenamenti scaduti, copertura, feedback e attività recente. Una query
  // sola invece di cinque — la tabella intera sono poche centinaia di righe, e
  // cinque `select` sullo stesso intervallo sarebbero cinque round trip per
  // gli stessi dati.
  const [assegnazioniCoach, setAssegnazioniCoach] = useState([])
  const [atletiCoach, setAtletiCoach] = useState([])
  // Quanti feedback l'eroe mostra prima di chiedere «+N altri».
  const [feedbackEspanso, setFeedbackEspanso] = useState(false)
  // La card della squadra guarda oggi (0) o ieri (-1). Ieri è consultazione:
  // la domanda della mattina è su oggi, e il valore torna lì a ogni ricarica.
  const [scartoSquadra, setScartoSquadra] = useState(0)
  const [weeklyStats, setWeeklyStats] = useState({ distance: '0 m', time: 0, reps: 0, completed: 0, avgRpe: '-' })
  // Le stesse righe che alimentano la settimana, tenute intere: la serie di
  // giorni, lo sparkline e l'RPE medio guardano indietro, non solo alla settimana.
  const [storicoAtleta, setStoricoAtleta] = useState([])

  const [autonomousModalOpen, setAutonomousModalOpen] = useState(false)
  const [autonomousForm, setAutonomousForm] = useState({ title: '', date: format(new Date(), 'yyyy-MM-dd'), notes: '', id: null, awId: null })
  const [savingAutonomous, setSavingAutonomous] = useState(false)
  const [workoutToRemove, setWorkoutToRemove] = useState(null)
  const [dbName, setDbName] = useState('')
  const [alertInfo, setAlertInfo] = useState(null)
  const [confirmInfo, setConfirmInfo] = useState(null)
  const [notifications, setNotifications] = useState([])
  // ⚠️ unreadCount NON è uno stato: è derivato da `notifications`.
  //
  // Prima era uno stato separato tenuto allineato a mano in sei punti, e
  // bastava dimenticarne uno perché il numero mostrato e le notifiche divergessero.
  // Un caso lo faceva già: l'INSERT realtime deduplicava le notifiche ma
  // incrementava comunque il contatore, quindi un evento consegnato due volte
  // gonfiava il badge.
  const unreadCount = useMemo(
    () => notifications.filter(n => !n.is_read).length,
    [notifications]
  )
  // Segna che le notifiche sono state caricate almeno una volta: senza, l'effetto
  // sul badge scriverebbe badge_count = 0 al montaggio, prima di sapere quante ce
  // ne sono davvero.
  const notificheCaricate = useRef(false)

  // L'UNICO punto in cui si scrive il badge. Prima erano cinque in questo file,
  // sette contando App.jsx e WorkoutDetail.jsx, tutti da tenere allineati a mano.
  // Ora chi cambia le notifiche cambia solo `notifications`: il badge segue.
  useEffect(() => {
    if (!notificheCaricate.current) return
    sincronizzaBadge(unreadCount, user?.id, supabase)
  }, [unreadCount, user?.id])
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
      notificheCaricate.current = true;
      // Il badge lo allinea l'effetto su unreadCount, più sotto: un punto solo.
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

  // Deduplica e tolleranza ai valori corrotti stanno in src/lib/offlineQueue.js,
  // dove sono coperte da test: qui è l'unico punto dell'app in cui un guasto
  // costa dati veri (un workout completato senza rete vive solo in localStorage).
  const accodaOffline = (payload) => accodaSuStorage(payload)

  const processOfflineQueue = async () => {
    // leggiCoda si ripara da sola: un valore illeggibile viene rimosso invece di
    // restare a far fallire ogni sincronizzazione successiva, per sempre.
    const queue = leggiCoda()
    if (queue.length === 0) return

    setSyncingQueue(true)
    const remaining = []
    try {
      for (const action of queue) {
        // Una voce malformata è JSON valido, quindi leggiCoda la lascia passare:
        // bastava un `null` nell'array perché `action.type` lanciasse. E siccome
        // niente lo intercettava, il ciclo moriva lì — la coda non si svuotava
        // più, il workout valido che seguiva non partiva mai, e il banner
        // "Sincronizzazione in corso..." restava a girare per sempre.
        // Una voce irrecuperabile si SCARTA (riprovarla fallirebbe uguale);
        // una voce valida che il server rifiuta si TIENE, per riprovare dopo.
        if (action?.type !== 'UPDATE_WORKOUT' || !action.payload?.id) {
          console.warn('Azione offline illeggibile, la scarto:', action)
          continue
        }
        const { id, status, notes } = action.payload
        try {
          const { error } = await supabase.from('athlete_workouts').update({ status, notes }).eq('id', id)
          if (error) remaining.push(action)
        } catch (e) {
          // Errore inatteso su un'azione valida: si conserva. Perderla
          // significherebbe perdere un allenamento completato.
          console.warn('Sincronizzazione fallita, riproverò:', e)
          remaining.push(action)
        }
      }
    } finally {
      // Nel finally perché il banner deve spegnersi comunque: se resta acceso
      // l'atleta vede "Sincronizzazione in corso..." all'infinito.
      scriviJson(CHIAVE_CODA, remaining)
      setSyncingQueue(false)
    }
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
      const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
      const weekStartStr = format(weekStart, 'yyyy-MM-dd')
      // ⚠️ La query dell'atleta partiva dal lunedì di questa settimana, e per la
      // Home vecchia bastava. La serie di giorni, lo sparkline e l'RPE medio di
      // categoria guardano invece INDIETRO: con la vecchia finestra la serie
      // avrebbe letto zero ogni lunedì mattina, che si legge come un guasto.
      const storicoStr = format(new Date(Date.now() - GIORNI_STORICO * 86400000), 'yyyy-MM-dd')

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
        // La finestra della Home coach: indietro fino a FINESTRA_STORICO per
        // sapere da quanto un atleta è fermo, avanti di GIORNI_COPERTURA per
        // sapere chi è già programmato. Attività di oggi e ieri, allenamenti
        // scaduti e feedback stanno tutti dentro questo intervallo.
        const coachDaStr = format(new Date(Date.now() - FINESTRA_STORICO * 86400000), 'yyyy-MM-dd')
        const coachAStr = format(new Date(Date.now() + (GIORNI_COPERTURA - 1) * 86400000), 'yyyy-MM-dd')
        promises.push(
          Promise.all([
            supabase.from('workouts').select('*', { count: 'exact', head: true }),
            // `notes` serve alla pausa: lo stato «in pausa» vive dentro la nota che
            // il coach scrive per l'atleta, perché lo schema è congelato (§9-decies).
            supabase.from('athletes').select('id, name, surname, photo_url, notes').is('deleted_at', null),
            supabase.from('athlete_workouts')
              .select('id, athlete_id, completed_date, status, notes, voice_note_url, athletes(id, name, surname, photo_url), workouts(id, title, sections)')
              .gte('completed_date', coachDaStr)
              .lte('completed_date', coachAStr)
              .order('completed_date', { ascending: false })
              .limit(1000)
          ]).then(([wRes, aRes, awRes]) => {
            wCountCoach = wRes.count || 0
            // ⚠️ L'account del coach è una riga di `athletes` come le altre, ma
            // non è un atleta che si segue: se resta dentro, compare fra
            // "richiedono attenzione" ogni volta che il coach non si allena, e
            // falsa sia il totale sia la copertura. Stesso filtro di Athletes.jsx.
            const atleti = (aRes.data || []).filter(a => a.id !== COACHING_ID)
            aCountCoach = atleti.length
            setAtletiCoach(atleti)
            setAssegnazioniCoach(awRes.data || [])
            setLoadingRecent(false)
          })
        )
      } else {
        setLoadingRecent(false)
      }

      // Solo l'atleta: dal 28/08/2026 la Home coach non mostra più il proprio
      // storico (§9-nonies), quindi queste due query non alimentano niente.
      if (role === 'athlete') {
        promises.push(
          Promise.all([
            supabase.from('athlete_workouts').select('*', { count: 'exact', head: true }).eq('athlete_id', user.id),
            supabase.from('athlete_workouts')
              .select('id, completed_date, status, notes, workouts (id, title, sections)')
              .eq('athlete_id', user.id)
              .gte('completed_date', storicoStr)
              .order('completed_date', { ascending: true })
              .limit(400)
          ]).then(([wRes, dataRes]) => {
            wCountAthlete = wRes.count || 0
            let data = dataRes.data
            if (dataRes.error || !data) {
              data = leggiJson(chiaveCacheWorkout(user.id), data)
            } else {
              scriviJson(chiaveCacheWorkout(user.id), data)
            }

            if (data) {
              setStoricoAtleta(data)

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

        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, (payload) => {
          // ⚠️ Qui dentro c'erano setUnreadCount e due scritture di rete: effetti
          // collaterali dentro un updater di stato, che React può rieseguire.
          // Ora l'updater calcola e basta.
          setNotifications(prev => prev.map(n => n.id === payload.new.id ? payload.new : n));
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

  // Le due celle piccole del bento. Sono derivate, non stato: un useEffect che
  // le ricalcolasse con setState aggiungerebbe un render e potrebbe restare
  // indietro rispetto ai dati — è il difetto corretto in Calendar e
  // AthleteDetail il 26/08 (CLAUDE.md §9-septies).
  const serie = useMemo(() => serieGiorni(storicoAtleta), [storicoAtleta])
  const sparkline = useMemo(() => barreUltimiGiorni(storicoAtleta, BARRE_SPARKLINE), [storicoAtleta])

  // ── I numeri della Home coach ───────────────────────────────────────────
  // Tutti derivati dalle stesse due liste con useMemo, per la stessa ragione
  // di sopra: uno stato ricalcolato da un effetto è un render in più e un dato
  // che può restare indietro.
  // Chi il coach sta davvero seguendo: la rubrica meno chi è in pausa. È il
  // denominatore onesto dell'eroe — «2 di 7» quando due dei nove si sono fermati.
  const seguiti = useMemo(() => atletiSeguiti(atletiCoach), [atletiCoach])
  const inPausa = useMemo(() => contaInPausa(atletiCoach), [atletiCoach])
  const fermi = useMemo(() => atletiFermi(atletiCoach, assegnazioniCoach), [atletiCoach, assegnazioniCoach])
  const scaduti = useMemo(() => allenamentiScaduti(atletiCoach, assegnazioniCoach), [atletiCoach, assegnazioniCoach])
  const coperturaTre = useMemo(() => copertura(atletiCoach, assegnazioniCoach), [atletiCoach, assegnazioniCoach])
  // ⚠️ L'elenco dei già letti si legge QUI e non in un useEffect con setState.
  // Non è pigrizia: un effetto che scrive stato al montaggio è un render in più
  // (`react-hooks/set-state-in-effect`), e soprattutto avrebbe l'effetto
  // collaterale sbagliato — scrivendo i letti la lista aperta sparirebbe sotto
  // le dita del coach. Così il valore si rilegge solo quando cambiano i dati,
  // cioè al prossimo caricamento della Home, che è quando il contatore deve
  // scendere. `leggiJson` non lancia mai e ripara da sé un valore corrotto (§9-quater).
  const uid = user?.id
  const feedback = useMemo(
    () => feedbackNuovi(assegnazioniCoach, uid ? (leggiJson(chiaveFeedbackVisti(uid), []) || []) : []),
    [assegnazioniCoach, uid]
  )
  /**
   * Chi si sta allenando ADESSO, in `athlete_id`.
   *
   * La presenza Realtime della Live Coach Cam è indicizzata per
   * `athleteWorkoutId` (è la chiave con cui WorkoutDetail fa `track`), quindi
   * l'atleta si ricava dall'assegnazione già caricata. È l'unica fonte che
   * distingua «non ha ancora finito» da «lo sta facendo in questo momento»:
   * senza, i due casi collassano su «da fare».
   */
  const inCorsoOra = useMemo(() => {
    const perId = new Map(assegnazioniCoach.map(a => [a.id, a.athlete_id]))
    return liveAthletes.map(la => perId.get(la.athleteWorkoutId)).filter(Boolean)
  }, [liveAthletes, assegnazioniCoach])

  const squadra = useMemo(
    () => squadraDelGiorno(atletiCoach, assegnazioniCoach, { scarto: scartoSquadra, inCorso: inCorsoOra }),
    [atletiCoach, assegnazioniCoach, scartoSquadra, inCorsoOra]
  )

  /**
   * Apre UN feedback, e nello stesso gesto lo segna come letto.
   *
   * Un contatore che non scende non è un'inbox, è un ornamento. Prima il gesto
   * era «apro la lista, li leggo tutti», perché la lista era chiusa e il
   * numero era l'unica cosa visibile. Ora le citazioni sono in pagina e la
   * lettura vera è aprire la scheda: segnare tutto letto al primo tocco
   * cancellerebbe tre feedback che il coach non ha ancora guardato.
   */
  const apriFeedback = (f) => {
    if (user?.id) {
      // Si tengono solo gli id ancora dentro la finestra caricata: gli altri non
      // verranno mai più contati, e senza questa potatura la lista cresce per sempre.
      const nellaFinestra = new Set(assegnazioniCoach.map(a => a.id))
      const precedenti = (leggiJson(chiaveFeedbackVisti(user.id), []) || []).filter(id => nellaFinestra.has(id))
      scriviJson(chiaveFeedbackVisti(user.id), Array.from(new Set([...precedenti, f.id])))
    }
    navigate(`/workout/${f.workoutId}?athlete_id=${f.atletaId}`)
  }

  /**
   * I tre metadati dell'eroe: durata, blocchi, RPE atteso.
   *
   * L'RPE ha due fonti in ordine di onestà: la media che QUESTO atleta ha
   * davvero segnato su questa categoria, e solo se i precedenti non bastano la
   * stima ricavata dall'intensità dichiarata dal coach o dai tipi di blocco.
   * Se non c'è nulla su cui basarsi la voce sparisce: meglio due riquadri che
   * un numero inventato.
   */
  const metaEroe = (sections, categoria) => {
    const voci = [
      { etichetta: 'Durata', valore: durataWorkout(sections), unita: '′' },
      { etichetta: 'Blocchi', valore: numeroBlocchi(sections) },
    ]
    const rpe = mediaRpeCategoria(storicoAtleta, categoria) ?? rpeAtteso(sections)
    if (rpe != null) voci.push({ etichetta: 'RPE', valore: rpe, evidenza: true })
    return voci
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
      const cache = leggiJson(chiaveCacheWorkout(user.id), [])
      scriviJson(chiaveCacheWorkout(user.id),
        cache.map(w => w.id === workout.id ? { ...w, status: 'pending' } : w))
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
      
      // ⚠️ Qui prima c'era un JSON.parse nudo. Con la cache corrotta lanciava
      // DOPO setSavingRpe(true) e prima di setSavingRpe(false): la modale RPE
      // restava a girare per sempre e il completamento appena inserito spariva.
      const cached = leggiJson(chiaveCacheWorkout(user.id), [])
      scriviJson(chiaveCacheWorkout(user.id),
        cached.map(w => w.id === workoutToComplete.id ? { ...w, status: newStatus, notes: finalNote } : w))
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

  return (
    <div className="px-4 max-w-2xl mx-auto pb-[var(--fondo-pagina)] pt-[calc(env(safe-area-inset-top)+1rem)] page-transition
                    min-h-screen bg-[radial-gradient(120%_60%_at_50%_0%,#17160f_0%,#0B0B0B_58%)]">
      {/* Header */}
      {(() => {
        // Le due azioni sono identiche nei due rami: si scrivono una volta.
        // Il conteggio delle non lette vive nell'aria-label perché il badge è
        // un pallino: senza, chi usa VoiceOver non saprebbe che ce ne sono.
        const azioni = (
          <>
            {hrConnected && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/30 text-red-500 rounded-full text-xs font-bold shrink-0">
                <Heart size={14} className={heartRate ? "animate-pulse" : ""} fill="currentColor" /> {heartRate ? `${heartRate} bpm` : 'BLE'}
              </div>
            )}
            <BottoneVetro
              label={unreadCount > 0 ? `Apri il centro notifiche, ${unreadCount} da leggere` : 'Apri il centro notifiche'}
              title="Centro Notifiche" onClick={openNotifications} badge={unreadCount > 0}>
              <Bell size={18} />
            </BottoneVetro>
            <BottoneVetro label="Apri le impostazioni" onClick={() => navigate('/settings')}>
              <Settings size={18} />
            </BottoneVetro>
          </>
        )

        // ⚠️ Il ruolo che esiste davvero è `admin`: l'onboarding di `coach` è
        // disattivato in App.jsx. Fino al 28/08/2026 questo ramo guardava
        // `role === 'athlete' || role === 'admin'`, quindi il coach vedeva la
        // TESTATA DELL'ATLETA — «Buongiorno, Federico», la settimana ISO e la
        // frase motivazionale del giorno — sopra una pagina che parla di
        // dodici persone. `HeaderCoach` esisteva già, ed era codice
        // irraggiungibile. Ora la regola è una sola, la stessa del corpo
        // (§9-nonies): atleta di qua, tutti gli altri di là.
        // Chi vuole la vista dell'atleta passa da Impostazioni → «Anteprima
        // come atleta», che mette `adminRoleOverride` e rende `role` 'athlete'
        // per l'intera pagina, testata compresa.
        if (role === 'athlete') {
          return (
            <div className="mb-3.5">
              <HeaderHome
                saluto={getGreeting()} nome={userName} motivazione={randomMotiv}
                dataOggi={format(new Date(), 'EEE d MMMM', { locale: it })}
                settimana={getISOWeek(new Date())}
                azioni={azioni}
              />
            </div>
          )
        }

        return (
          <div className="mb-3.5">
            {/* `atletiCoach` è già senza COACHING_ID (il filtro sta nel fetch):
                il totale qui è quello della rubrica, non uno più grande. Gli
                atleti in pausa restano nel totale e si dichiarano a parte —
                «9 atleti · 2 in pausa» — altrimenti i numeri delle sezioni
                sotto, che la pausa la escludono, sembrerebbero sbagliati. */}
            <HeaderCoach
              dataOggi={format(new Date(), 'EEE d MMMM', { locale: it })}
              atleti={atletiCoach.length}
              inPausa={inPausa}
              azioni={azioni}
            />
          </div>
        )
      })()}

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

      {/* ── HOME COACH ─────────────────────────────────────────────────
          L'eroe è chi richiede attenzione: gli atleti che stanno sparendo.
          Prima questa pagina non conteneva un solo dato — era un menù (logo,
          CTA, lista di ieri, due card verso destinazioni già in navbar), e
          l'unica informazione presente, chi ha fatto cosa ieri, è la meno utile
          la mattina perché guarda indietro. */}
      {role !== 'athlete' && (
        <div className="flex flex-col gap-3.5 mb-6">

          {/* La Live Coach Cam dura quanto un allenamento: è una barra, non una
              sezione con un titolo che per 23 ore al giorno sta sopra il vuoto. */}
          {liveAthletes.map(la => (
            <BannerLive key={la.athleteWorkoutId}
              nome={la.athleteName} dettaglio={la.workoutTitle}
              onGuarda={() => setSpectatingAthlete(la)} />
          ))}

          {/* L'eroe: l'unica voce IN ENTRATA della pagina. Se resta lì,
              l'atleta ha parlato e nessuno ha risposto. */}
          {loadingRecent ? (
            <div className="rounded-[26px] border border-white/[.07] bg-[#1a1a1c] h-52 animate-pulse" />
          ) : (
            <div className="hero-transition">
              {feedback.elementi.length > 0
                ? <HeroFeedback righe={feedback.elementi} mostrate={FEEDBACK_IN_HOME}
                    espanso={feedbackEspanso} onEspandi={() => setFeedbackEspanso(true)}
                    finestraGiorni={FINESTRA_FEEDBACK} onApri={apriFeedback} />
                : <HeroNessunFeedback />}
            </div>
          )}

          {/* La squadra della giornata: cinque su sette, e quali due mancano.
              Prima era una lista di eventi «oggi e ieri», che elencava senza
              far vedere l'insieme. */}
          {loadingRecent ? (
            <div className="rounded-[22px] border border-white/[.07] bg-[#1a1a1c] h-44 animate-pulse" />
          ) : (
            <SquadraOggi righe={squadra.righe} completati={squadra.completati} assegnati={squadra.assegnati}
              inCorso={squadra.inCorso} rpeMedio={squadra.rpeMedio}
              giorno={scartoSquadra === 0 ? 'oggi' : 'ieri'}
              onCambiaGiorno={() => setScartoSquadra(g => (g === 0 ? -1 : 0))}
              onApriAtleta={(a) => navigate(`/athletes/${a.id}`)} />
          )}

          {/* L'unica superficie gialla piena della pagina: Regola del Tratto Unico. */}
          <CtaCreaWorkout onClick={() => navigate('/create')} />

          <RigaDestinazione titolo="Archivio workout"
            sottotitolo={`${stats.workouts} allenamenti · riusa e duplica`}
            label="Apri l'archivio dei workout"
            onClick={() => navigate('/archive')} />

          {/* Chi sta sparendo. Non è più l'eroe: chi è fermo da nove giorni lo è
              ancora fra un'ora, un feedback non letto no. Ma resta in pagina,
              con lo stesso dato — i giorni di fermo e l'azione a un tocco. */}
          {!loadingRecent && (
            fermi.length > 0
              ? <SezioneAttenzione righe={fermi.slice(0, MASSIMO_FERMI_IN_HOME)} soglia={GIORNI_FERMO}
                  onApriAtleta={(a) => navigate(`/athletes/${a.id}`)} />
              : <TuttiAttivi totale={seguiti.length} />
          )}

          {/* L'unico numero della Home che dice «devi programmare adesso». */}
          <BarraCopertura coperti={coperturaTre.coperti} totale={coperturaTre.totale}
            senza={coperturaTre.senza} giorni={GIORNI_COPERTURA} />

          {/* Lavoro da smaltire, non un allarme: in fondo e in forma di lista.
              Accanto all'atleta fermo si mescolerebbero due problemi di segno
              diverso — una persona che si allontana e una casella da chiudere. */}
          {scaduti.length > 0 && (<>
            <TitoloSezione meta={`${scaduti.length} apert${scaduti.length === 1 ? 'o' : 'i'}`}>Allenamenti scaduti</TitoloSezione>
            <div className="flex flex-col gap-2.5">
              {scaduti.map(s => (
                <RigaAttivita key={s.id} categoria={s.categoria} titolo={s.nome}
                  sottotitolo={`${s.titolo} · scaduto ${quandoScaduto(s)}`}
                  coda={<AzioneApri />}
                  ariaLabel={`Apri l'allenamento scaduto di ${s.nome}`}
                  onClick={() => navigate(`/workout/${s.workoutId}?athlete_id=${s.atletaId}`)} />
              ))}
            </div>
          </>)}
        </div>
      )}

      {/* ── HOME ATLETA ───────────────────────────────────────────────────
          Un solo eroe sopra la piega, poi una griglia bento dove la dimensione
          della cella dichiara l'importanza. L'ordine risponde alle tre domande
          nell'ordine in cui l'atleta se le fa: cosa devo fare oggi, come sta
          andando la settimana, cosa arriva dopo.
          Prima erano otto sezioni dello stesso peso e l'allenamento di oggi —
          l'unica ragione per cui l'app si apre — arrivava dopo due schermate. */}
      {role === 'athlete' && (
        <div className="flex flex-col gap-3.5">

          {loading ? (
            <div className="rounded-[26px] border border-white/[.07] bg-[#1a1a1c] h-60 animate-pulse" />
          ) : todayWorkouts.length > 0 ? (
            todayWorkouts.map((todayWorkout) => {
              const sections = todayWorkout.workouts?.sections
              const rawCat = sections?.category || (sections?.steps ? 'Running' : 'Hyrox')
              const todayIsAuto = sections?.isAutonomous === true || rawCat === 'Autonomo'
              const category = rawCat === 'Event' ? 'Event' : (rawCat === 'Custom' || todayIsAuto) ? 'Custom' : rawCat
              const completato = todayWorkout.status === 'completed'
              const scorrevole = !completato

              return (
                <div key={todayWorkout.id} className="relative overflow-hidden rounded-[26px] hero-transition">
                  {/* Pannello rivelato sotto la card mentre si scorre. Senza,
                      il movimento non dice cosa sta per succedere. Nascosto ai
                      lettori di schermo: il bottone visibile è la via ufficiale. */}
                  {scorrevole && (
                    <div data-swipe-panel aria-hidden="true" style={{ opacity: 0 }}
                      className="absolute inset-0 rounded-[26px] bg-green-500 flex items-center pl-7 pointer-events-none">
                      <div className="flex items-center gap-2.5 text-black font-black origin-left"
                        style={{ transform: 'scale(0.72)' }}>
                        <CheckCircle2 size={30} />
                        <span className="text-base">Completato</span>
                      </div>
                    </div>
                  )}
                  <HeroOggi
                    titolo={todayWorkout.workouts.title}
                    categoria={category}
                    completato={completato}
                    stato={completato ? 'Completato oggi' : category === 'Event' ? 'Oggi è il grande giorno' : 'Allenamento di oggi'}
                    meta={metaEroe(sections, category)}
                    onOpen={() => navigate(`/workout/${todayWorkout.workouts.id}?athlete_id=${user.id}`)}
                    onToggle={(e) => toggleTodayWorkout(e, todayWorkout)}
                    azioni={todayIsAuto && role === 'athlete' ? (
                      <>
                        <button aria-label="Modifica l'allenamento libero" title="Modifica"
                          onClick={(e) => { e.stopPropagation(); openEditAutonomous(todayWorkout); }}
                          className="p-2.5 text-gray-400 hover:text-brand transition bg-black/40 rounded-full border border-white/[.07]"><Edit size={16} /></button>
                        <button aria-label="Elimina l'allenamento" title="Elimina"
                          onClick={(e) => { e.stopPropagation(); setWorkoutToRemove(todayWorkout.id); }}
                          className="p-2.5 text-gray-400 hover:text-red-500 transition bg-black/40 rounded-full border border-white/[.07]"><Trash2 size={16} /></button>
                      </>
                    ) : null}
                    swipe={scorrevole ? {
                      onTouchStart: swipeInizio,
                      onTouchMove: swipeMuovi,
                      onTouchEnd: () => swipeFine(todayWorkout),
                      onTouchCancel: () => swipeFine(todayWorkout),
                      style: { willChange: 'transform' },
                    } : {}}
                  />
                </div>
              )
            })
          ) : (
            <HeroRest />
          )}

          {/* Il bento. La settimana non è più nascosta dietro uno swipe non
              segnalato: l'anello dice quanto manca, i sette punti sotto sono
              la traccia, non il contenuto. */}
          {weeklyStatus.length > 0 && (
            <div className="grid grid-cols-[1.05fr_1fr] gap-3.5">
              <AnelloSettimana weeklyStatus={weeklyStatus}
                onGiorno={(w) => navigate(`/workout/${w.workoutId}?athlete_id=${user.id}`)} />
              <div className="flex flex-col gap-3.5">
                <CellaSerie giorni={serie} ultime={sparkline} />
                <CellaVolume minuti={weeklyStats.time} rpe={weeklyStats.avgRpe} />
              </div>
            </div>
          )}

          {/* Scende sotto il bento: è importante, non urgente. L'urgente è oggi. */}
          {nextEventHome && (
            <BannerObiettivo evento={nextEventHome} giorni={countdownDays}
              onOpen={() => navigate(`/workout/${nextEventHome.workouts.id}?athlete_id=${user.id}`)} />
          )}

          {loading ? (
            <div className="flex flex-col gap-2.5">
              <div className="rounded-[18px] bg-white/[.035] border border-white/[.06] h-16 animate-pulse" />
              <div className="rounded-[18px] bg-white/[.035] border border-white/[.06] h-16 animate-pulse" />
            </div>
          ) : (
            <ListaInArrivo
              items={upcomingWorkouts}
              onOpen={(w) => navigate(`/workout/${w.workouts.id}?athlete_id=${user.id}`)}
              onAggiungiLibero={role === 'athlete' ? () => setAutonomousModalOpen(true) : null}
              azioniRiga={(w) => {
                const isAuto = w.workouts?.sections?.isAutonomous === true || w.workouts?.sections?.category === 'Autonomo'
                if (!isAuto || role !== 'athlete') return null
                return (
                  <>
                    <button aria-label="Modifica l'allenamento libero" title="Modifica"
                      onClick={(e) => { e.stopPropagation(); openEditAutonomous(w); }}
                      className="p-1.5 text-muted hover:text-brand transition"><Edit size={18} /></button>
                    <button aria-label="Elimina l'allenamento" title="Elimina"
                      onClick={(e) => { e.stopPropagation(); setWorkoutToRemove(w.id); }}
                      className="p-1.5 text-muted hover:text-red-500 transition"><Trash2 size={18} /></button>
                  </>
                )
              }}
            />
          )}
        </div>
      )}

      {/* ⚠️ Qui c'erano le card «Calendario» e «Atleti» più la barra «Archivio
          Workout». Le prime due sono uscite il 27/08/2026: erano già due voci
          della navbar coach, e il corollario della Regola dell'Eroe Unico dice
          che a una destinazione già in navbar non si dedica anche una card.
          L'archivio non è sparito — è la riga sotto la CTA, dove è materiale di
          lavoro invece che una destinazione. Per l'atleta erano state nascoste
          il 26/08 per la stessa ragione.
          ⚠️ 28/08/2026 — e qui NON deve tornare il ramo atleta. L'admin lo
          vedeva in fondo alla propria Home (`role === 'athlete' || role ===
          'admin'`): allenamento di oggi o «Giorno di Rest», l'anello della
          settimana, serie e volume/RPE. Sono i numeri di UNA persona in una
          pagina che parla di dodici, e per il coach dicevano sempre rest,
          perché il suo account è escluso da chi si segue (COACHING_ID). Chi
          vuole quella vista passa da Impostazioni → «Anteprima come atleta»,
          che mette `adminRoleOverride` e rende la Home atleta intera.
          Insieme è uscita la riga «Profilo»: /profile resta raggiungibile
          dalla stessa anteprima, dove la navbar ne ha la voce. */}

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
                {unreadCount > 0 && <span className="bg-brand text-black text-xs font-bold px-2 py-0.5 rounded-full">{unreadCount} nuove</span>}
              </div>
              <div className="flex items-center gap-3">
                {unreadCount > 0 && (
                  <button onClick={async () => {
                    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
                    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false)
                  }} className="text-[11px] font-semibold text-brand hover:underline whitespace-nowrap">
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
                      await supabase.from('notifications').update({ is_read: true }).eq('id', notif.id)
                    }
                    closeNotifications()
                    if (notif.route) setTimeout(() => navigate(notif.route), 300)
                  }} className={`p-4 rounded-2xl cursor-pointer transition border ${notif.is_read ? 'bg-[#111] border-[#333] opacity-70' : 'bg-[#2a2a2a] border-brand/30 hover:border-brand'}`}>
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
                          await supabase.from('notifications').delete().eq('user_id', user.id)
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
                  className="bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand w-full text-base"
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
                  className="bg-[#111] border border-[#333] rounded-xl px-4 py-3 hover:border-brand w-full text-base"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs pl-1 mb-1 block">Descrizione / Note</label>
                <textarea 
                  className="bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand w-full text-base resize-none"
                  rows={3}
                  value={autonomousForm.notes}
                  onChange={(e) => setAutonomousForm({ ...autonomousForm, notes: e.target.value })}
                  placeholder="Com'è andata?"
                />
              </div>
              <button 
                onClick={handleSaveAutonomous}
                disabled={savingAutonomous}
                className="w-full mt-2 py-3 bg-brand text-black font-bold rounded-xl hover:brightness-110 transition disabled:opacity-50"
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

