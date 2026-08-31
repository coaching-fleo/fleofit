import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { ChevronLeft, User, Upload, Trash2, AlertTriangle, Plus, Edit, X, Download, Dumbbell, Search, CheckCircle2, Circle, Trophy, Timer, Flame, FolderArchive, ChevronRight, Copy, Activity, CalendarDays, LayoutList, Mic, Check, Eye, PauseCircle, PlayCircle } from 'lucide-react'
import { format, parseISO, differenceInYears, isBefore, startOfDay, isValid, eachDayOfInterval, startOfMonth, endOfMonth, differenceInDays } from 'date-fns'
import { it } from 'date-fns/locale'
import { CustomAlert, CustomConfirm } from '../components/CustomModals'
import CustomDatePicker from '../components/CustomDatePicker'
import { useAuth } from '../App'
import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { generaTitolo, titoloOppureGenerato, titoliDelGiorno } from '../lib/workoutTitle'
import { parseNotesAndRpe, formatNotesWithRpe } from '../lib/rpe'
import { isVoiceNoteValid } from '../lib/notaVocale'
import { parseNotePausa, formatNotePausa } from '../lib/pausa'
import { andamentoAtleta, GIORNI_ADERENZA } from '../lib/andamento'
import { coloreCategoria } from '../lib/colori'
import { CARD, RIGA } from '../lib/stiliCard'
import { TestataScheda, MenuScheda, IntestazioneSezione } from '../components/WorkoutDetailUI'
import { BarraAzioni, CtaPrimaria, BottoneQuadrato } from '../components/CreaWorkoutUI'
import {
  IdentitaAtleta, IconaSocial, CardAndamento, CellaBento, Sparkline,
  BarraFasce, RigaObiettivo, RigaApribile, RigaAzione, PillolaPausa,
} from '../components/SchedaAtletaUI'
import CustomAudioPlayer from '../components/CustomAudioPlayer'
import RpeModal from '../components/RpeModal'
import VoiceRecorder from '../components/VoiceRecorder'

const getRpeColorText = (val) => {
  if (val <= 3) return 'text-green-500';
  if (val <= 6) return 'text-yellow-400';
  if (val <= 8) return 'text-orange-500';
  return 'text-red-500';
}

const InstagramIcon = ({ size = 24, className = "" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5"></rect>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"></line>
  </svg>
)

// Helper per calcolare l'età
const calculateAge = (dob) => {
  if (!dob) return 'N/A'
  return differenceInYears(new Date(), parseISO(dob))
}

export default function AthleteDetail() {
  const { id: paramId } = useParams()
  const { role, user } = useAuth()
  const id = paramId || user?.id
  const navigate = useNavigate()
  const isOwnProfile = id === user?.id
  const [athlete, setAthlete] = useState(null)
  const [workouts, setWorkouts] = useState([])
  const [prs, setPrs] = useState([])
  const [workoutView, setWorkoutView] = useState('list') // 'list' | 'calendar'
  // Le tre tab sono diventate due sezioni che si aprono in pagina, più un menu
  // per i comandi che erano tre bottoni in testata (CLAUDE.md §9-terdecies).
  const [menuAperto, setMenuAperto] = useState(false)
  const [storicoAperto, setStoricoAperto] = useState(false)
  const [prAperti, setPrAperti] = useState(false)
  const [loading, setLoading] = useState(true)
  const [workoutToRemove, setWorkoutToRemove] = useState(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [socialModalType, setSocialModalType] = useState(null)
  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [prModalOpen, setPrModalOpen] = useState(false)
  const [editingPr, setEditingPr] = useState(null)
  const [alertInfo, setAlertInfo] = useState(null)
  const [confirmInfo, setConfirmInfo] = useState(null)

  const [autonomousModalOpen, setAutonomousModalOpen] = useState(false)
  const [autonomousForm, setAutonomousForm] = useState({ title: '', date: format(new Date(), 'yyyy-MM-dd'), notes: '', id: null, awId: null })
  const [savingAutonomous, setSavingAutonomous] = useState(false)

  const [showRpeModal, setShowRpeModal] = useState(false)
  const [workoutToComplete, setWorkoutToComplete] = useState(null)
  const [rpeScore, setRpeScore] = useState('5')
  const [rpeNotes, setRpeNotes] = useState('')
  const [savingRpe, setSavingRpe] = useState(false)

  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState(new Date())

  useEffect(() => {
    if (role === 'athlete' && !isOwnProfile) {
      navigate('/')
      return
    }
    fetchAthleteData()
  }, [id, role, isOwnProfile, navigate])

  async function fetchAthleteData(silent = false) {
    if (!silent) setLoading(true)
    
    const [
      { data: athleteData, error: athleteError },
      { data: workoutHistory, error: historyError },
      { data: prsData, error: prsError }
    ] = await Promise.all([
      supabase.from('athletes').select('*').eq('id', id).single(),
      supabase.from('athlete_workouts').select(`id, completed_date, notes, voice_note_url, status, workouts (id, title, sections)`).eq('athlete_id', id).order('completed_date', { ascending: false }),
      supabase.from('personal_records').select('*').eq('athlete_id', id).order('date', { ascending: false })
    ])

    if (athleteError) {
      console.error("Errore nel caricare l'atleta:", athleteError)
      if (!silent) setLoading(false)
      return
    }
    setAthlete(athleteData)

    if (historyError) console.error("Errore nel caricare lo storico workout:", historyError)
    else {
      setWorkouts((workoutHistory || []).map(w => ({
        ...w,
        voice_note_url: isVoiceNoteValid(w.voice_note_url) ? w.voice_note_url : null
      })))
    }

    if (prsError && prsError.code !== '42P01' && prsError.code !== 'PGRST205') console.error("Errore PR:", prsError)
    else setPrs(prsData || [])

    if (!silent) setLoading(false)
  }

  // I numeri dell'eroe: aderenza, carico, volume, sforzo — tutti sulla stessa
  // finestra, che è l'unica ragione per cui si possono leggere insieme.
  // Valore DERIVATO, non stato: qui c'era un useEffect con setWeeklyStats e,
  // dentro, una TERZA copia del calcolo della durata, con il difetto delle
  // distanze (BACKLOG #30) — 400m contati come 400 minuti.
  const andamento = useMemo(() => andamentoAtleta(workouts), [workouts])

  const uploadVoiceNote = async (athleteWorkoutId, audioBlob, ext) => {
    const fileName = `voice_${athleteWorkoutId}_${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage.from('voice-notes').upload(fileName, audioBlob, { contentType: audioBlob.type })
    if (uploadError) return setAlertInfo({ title: 'Errore', message: 'Caricamento fallito: ' + uploadError.message, type: 'error' })
    const { data: urlData } = supabase.storage.from('voice-notes').getPublicUrl(fileName)
    const { error } = await supabase.from('athlete_workouts').update({ voice_note_url: urlData.publicUrl }).eq('id', athleteWorkoutId)
    if (!error) {
      setWorkouts(workouts.map(w => w.id === athleteWorkoutId ? { ...w, voice_note_url: urlData.publicUrl } : w))
      if (role === 'admin') {
        supabase.functions.invoke('send-reminders', {
          body: { mode: 'voice_note', record_id: athleteWorkoutId }
        }).catch(console.error)
      }
    } else setAlertInfo({ title: 'Errore', message: error.message, type: 'error' })
  }

  const deleteVoiceNote = async (athleteWorkoutId) => {
    setConfirmInfo({
      title: "Elimina nota vocale",
      message: "La nota verrà nascosta dall'app, ma per sicurezza rimarrà nel database per 24 ore prima di essere eliminata definitivamente.",
      onConfirm: async () => {
        setConfirmInfo(null)
        const workout = workouts.find(w => w.id === athleteWorkoutId)
        if (workout?.voice_note_url) {
          const deletedUrl = workout.voice_note_url + '#deleted=' + Date.now()
          const { error } = await supabase.from('athlete_workouts').update({ voice_note_url: deletedUrl }).eq('id', athleteWorkoutId)
          if (error) {
            setAlertInfo({ title: 'Errore', message: error.message, type: 'error' })
          } else {
            setWorkouts(workouts.map(w => w.id === athleteWorkoutId ? { ...w, voice_note_url: null } : w))
          }
        }
      }
    })
  }

  const toggleWorkoutStatus = async (id, currentStatus, scheduledDateStr) => {
    const w = workouts.find(wo => wo.id === id)

    if (currentStatus === 'completed') {
      const { error } = await supabase.from('athlete_workouts').update({ status: 'pending' }).eq('id', id)
      if (!error) {
        setWorkouts(prev => prev.map(wk => wk.id === id ? { ...wk, status: 'pending' } : wk))
      }
      return
    }

    const scheduledDate = startOfDay(parseISO(scheduledDateStr))
    const today = startOfDay(new Date())
    if (isBefore(today, scheduledDate)) {
      setConfirmInfo({
        title: 'Attenzione',
        message: 'Questo allenamento è programmato per una data futura. Vuoi davvero segnarlo come completato oggi?',
        onConfirm: () => { 
          setConfirmInfo(null);
          setWorkoutToComplete(w);
          const parsed = parseNotesAndRpe(w.notes);
          setRpeNotes(parsed.text);
          setRpeScore(parsed.rpe);
          setShowRpeModal(true);
        }
      })
      return
    }

    setWorkoutToComplete(w);
    const parsed = parseNotesAndRpe(w.notes);
    setRpeNotes(parsed.text);
    setRpeScore(parsed.rpe);
    setShowRpeModal(true);
  }

  const handleRpeSubmitAthleteDetail = async () => {
    setSavingRpe(true)
    const newStatus = 'completed'
    const finalNote = formatNotesWithRpe(rpeScore, rpeNotes)

    const { error } = await supabase
      .from('athlete_workouts')
      .update({ status: newStatus, notes: finalNote })
      .eq('id', workoutToComplete.id)
    
    setSavingRpe(false)

    if (!error) {
      setWorkouts(prev => prev.map(w => w.id === workoutToComplete.id ? { ...w, status: newStatus, notes: finalNote } : w))
      setShowRpeModal(false)

      if (role === 'athlete') {
        supabase.functions.invoke('send-reminders', {
          body: { mode: 'coach_notification', action: 'completed', athleteName: `${athlete.name} ${athlete.surname}`, workoutTitle: workoutToComplete.workouts?.title || 'Workout', route: `/workout/${workoutToComplete.workouts?.id || workoutToComplete.id}?athlete_id=${athlete.id}` }
        }).catch(console.error)
      }
      setWorkoutToComplete(null)
    } else {
      setAlertInfo({ title: 'Errore', message: error.message, type: 'error' })
    }
  }

  // Lo stato di pausa, letto dalla nota per l'atleta (src/lib/pausa.js).
  // `athlete` è null durante il caricamento: parseNotePausa regge il null.
  const pausaAtleta = parseNotePausa(athlete?.notes)

  /**
   * Mette o toglie la pausa a questo atleta.
   *
   * La pausa lo toglie dagli allarmi della Home coach senza toglierlo dalla
   * rubrica: è la richiesta del committente («mi hanno detto che vogliono
   * essere messi in pausa, ma voglio continuare a tenerli nella lista»).
   *
   * ⚠️ Si CHIEDE conferma solo per mettere in pausa, non per toglierla. Non è
   * simmetria mancata: mettere in pausa spegne un allarme, e uno spegnimento
   * per errore non si nota — è il difetto che il 26/08 ha reso il
   * "completa/scompleta" un gesto confermato invece che un tap silenzioso.
   * Toglierla riaccende, e un allarme di troppo si vede da solo.
   */
  const impostaPausa = async (attiva) => {
    const { testo } = parseNotePausa(athlete.notes)
    const nuoveNote = attiva ? formatNotePausa(format(new Date(), 'yyyy-MM-dd'), testo) : (testo || null)
    const precedenti = athlete.notes
    setAthlete(prev => ({ ...prev, notes: nuoveNote }))   // ottimistico, come toggleStatus
    const { error } = await supabase.from('athletes').update({ notes: nuoveNote }).eq('id', id)
    if (error) {
      setAthlete(prev => ({ ...prev, notes: precedenti }))
      return setAlertInfo({ title: 'Errore', message: error.message, type: 'error' })
    }
    setAlertInfo({
      title: attiva ? 'Atleta in pausa' : 'Pausa terminata',
      message: attiva
        ? `${athlete.name} resta nella tua lista atleti, ma non comparirà più fra quelli che richiedono attenzione in Home.`
        : `${athlete.name} torna fra gli atleti che la Home tiene d'occhio.`,
      type: 'success',
    })
  }

  const chiediPausa = () => {
    if (pausaAtleta.inPausa) return impostaPausa(false)
    setConfirmInfo({
      title: 'Mettere in pausa?',
      message: `${athlete.name} ${athlete.surname} resta fra i tuoi atleti e mantiene tutto lo storico, ma smetterà di comparire fra quelli che richiedono attenzione in Home. Puoi riattivarlo quando vuoi da qui.`,
      onConfirm: () => impostaPausa(true),
    })
  }

  const updateWorkoutNote = async (workoutId, notes, workoutTitle) => {
    const { error } = await supabase
      .from('athlete_workouts')
      .update({ notes })
      .eq('id', workoutId)
    
    if (!error) {
      setWorkouts(workouts.map(w => w.id === workoutId ? { ...w, notes } : w))
        if (role === 'athlete') {
          supabase.functions.invoke('send-reminders', {
            body: { mode: 'coach_notification', action: 'note', athleteName: `${athlete.name} ${athlete.surname}`, workoutTitle: workoutTitle || 'Workout', noteText: notes, route: `/workout/${workoutId}?athlete_id=${id}` }
          }).catch(console.error)
        }
    } else {
      setAlertInfo({ title: 'Errore', message: "Errore durante il salvataggio della nota: " + error.message, type: 'error' })
    }
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
      let workoutCreato = null
      if (autonomousForm.id) {
        const { error: wError } = await supabase.from('workouts').update({ title: titoloFinale, date: autonomousForm.date }).eq('id', autonomousForm.id)
        if (wError) throw wError

        const { error: awError } = await supabase.from('athlete_workouts').update({ completed_date: autonomousForm.date, notes: autonomousForm.notes }).eq('id', autonomousForm.awId)
        if (awError) throw awError
      } else {
        // Dichiarato fuori dal blocco: la notifica al coach più sotto lo usa, e
        // con const dentro l'else finiva fuori scope → ReferenceError.
        const { data: nuovoWorkout, error: wError } = await supabase.from('workouts').insert({
          title: titoloFinale,
          date: autonomousForm.date,
          sections: { category: 'Custom', isAutonomous: true }
        }).select().single()
        if (wError) throw wError
        workoutCreato = nuovoWorkout

        const { error: awError } = await supabase.from('athlete_workouts').insert({ athlete_id: id, workout_id: workoutCreato.id, completed_date: autonomousForm.date, status: 'completed', notes: autonomousForm.notes })
        if (awError) throw awError
      }
      
      if (role === 'athlete' && !autonomousForm.id) {
         supabase.functions.invoke('send-reminders', {
           body: { mode: 'coach_notification', action: 'custom_workout', athleteName: `${athlete.name} ${athlete.surname}`, workoutTitle: titoloFinale, route: `/workout/${workoutCreato.id}?athlete_id=${id}` }
         }).catch(console.error)
      }
      setAutonomousModalOpen(false)
      setAutonomousForm({ title: '', date: format(new Date(), 'yyyy-MM-dd'), notes: '', id: null, awId: null })
      fetchAthleteData(true)
    } catch (err) {
      setAlertInfo({ title: 'Errore', message: err.message, type: 'error' })
    }
    setSavingAutonomous(false)
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
      setAlertInfo({ title: 'Errore', message: "Errore durante la rimozione: " + error.message, type: 'error' })
    }
    setWorkoutToRemove(null)
  }

  const handleExportData = async () => {
    const exportData = {
      athlete: athlete,
      workouts: workouts
    }
    const fileName = `Backup_${athlete.name}_${athlete.surname}.json`
    const dataStr = JSON.stringify(exportData, null, 2)
    if (Capacitor.isNativePlatform()) {
      try {
        const result = await Filesystem.writeFile({
          path: fileName,
          data: dataStr,
          directory: Directory.Cache,
          encoding: Encoding.UTF8
        })
        await Share.share({ title: `Backup ${athlete.name}`, files: [result.uri] })
      } catch (err) {
        setAlertInfo({ title: 'Errore', message: "Errore esportazione: " + err.message, type: 'error' })
      }
    } else {
      const blob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const linkElement = document.createElement('a')
      linkElement.setAttribute('href', url)
      linkElement.setAttribute('download', fileName)
      linkElement.click()
      URL.revokeObjectURL(url)
    }
  }

  const handleDeletePr = async (prId) => {
    const { error } = await supabase.from('personal_records').delete().eq('id', prId)
    if (!error) {
      setPrs(prs.filter(p => p.id !== prId))
      setAlertInfo({ title: 'Eliminato', message: 'Record personale rimosso.', type: 'success' })
    } else {
      setAlertInfo({ title: 'Errore', message: error.message, type: 'error' })
    }
  }

  // Quattro scorrimenti della stessa lista a ogni render. Devono stare QUI, sopra
  // i return anticipati: useMemo dopo un return condizionale violerebbe le Rules
  // of Hooks, ed è il motivo per cui non erano memoizzate.
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const { todayWorkoutsList, upcomingWorkoutsList, pastWorkoutsList, upcomingEvents } = useMemo(() => ({
    todayWorkoutsList: workouts.filter(w => w.completed_date === todayStr),
    upcomingWorkoutsList: workouts.filter(w => w.completed_date > todayStr && w.workouts?.sections?.category !== 'Event').reverse(),
    pastWorkoutsList: workouts.filter(w => w.completed_date < todayStr),
    upcomingEvents: workouts.filter(w => w.workouts?.sections?.category === 'Event' && w.completed_date >= todayStr)
      .sort((a, b) => a.completed_date.localeCompare(b.completed_date)),
  }), [workouts, todayStr])

  if (loading) return <div className="p-6 text-muted">Caricamento scheda atleta...</div>
  if (!athlete) return <div className="p-6 text-red-400">Atleta non trovato.</div>

  const nextEvent = upcomingEvents[0]
  let countdownDays = null
  if (nextEvent) {
    countdownDays = differenceInDays(parseISO(nextEvent.completed_date), startOfDay(new Date()))
  }

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth)
  })
  const firstDayOfMonth = startOfMonth(currentMonth).getDay()
  const offset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1
  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))

  // L'anagrafica erano quattro celle da 22px — mezzo schermo per dati che si
  // inseriscono una volta e non si consultano. I campi vuoti spariscono invece
  // di stampare «N/A»: una cella che dice «non lo so» occupa lo stesso spazio
  // di una che dice qualcosa.
  const anagrafica = [
    athlete.birth_date && `${calculateAge(athlete.birth_date)} anni`,
    athlete.height && `${athlete.height} cm`,
    athlete.weight && `${athlete.weight} kg`,
    `${workouts.length} workout`,
  ].filter(Boolean).join(' · ')

  // Lo scarto del volume si dice in MINUTI e non in percentuale: «+50 min» si
  // confronta con la propria settimana, «+24%» va prima ritradotto in minuti.
  const delta = andamento.volume.delta
  const testoDelta = delta === 0 ? 'come la settimana prima'
    : `${delta > 0 ? '+' : '−'}${Math.abs(delta)} sulla settimana prima`
  const coloreDelta = delta === 0 ? 'text-muted' : delta > 0 ? 'text-green-500' : 'text-orange-400'

  // I tre bottoni che stavano in testata. Il nome dell'atleta è nell'etichetta
  // perché «Metti in pausa» da solo non dice chi si sta fermando, e questa è
  // l'unica azione della pagina che si nota solo quando è sbagliata.
  const vociMenu = [
    { etichetta: 'Modifica scheda', icona: Edit, onClick: () => setShowEditModal(true) },
    role !== 'athlete' && { etichetta: 'Esporta dati', icona: Download, onClick: handleExportData },
    role !== 'athlete' && {
      etichetta: pausaAtleta.inPausa ? `Riattiva ${athlete.name}` : `Metti ${athlete.name} in pausa`,
      icona: pausaAtleta.inPausa ? PlayCircle : PauseCircle,
      onClick: chiediPausa,
    },
  ]

  return (
    <div className="px-4 max-w-2xl mx-auto min-h-[100dvh] flex flex-col gap-[14px] page-transition
                    pt-[calc(env(safe-area-inset-top)+1rem)] pb-[var(--altezza-navbar)]
                    bg-[radial-gradient(120%_46%_at_50%_0%,#17160f_0%,#0B0B0B_54%)]">

      {/* La testata porta un menu e basta. Esporta, Modifica e Pausa erano tre
          bottoni dello stesso peso in cima alla pagina: tre comandi che si
          usano una volta, messi sopra il contenuto che si legge ogni volta.
          ⚠️ Nessun «indietro» sul proprio profilo: `/profile` è una voce della
          navbar, non una pagina in cui si è entrati da qualche parte. */}
      <TestataScheda
        onIndietro={role !== 'athlete' && !isOwnProfile ? () => navigate('/athletes') : null}
        onMenu={() => setMenuAperto(true)} />

      {/* 🔴 La pillola «In pausa» è nascosta all'atleta, e non è pudore: questa
          pagina è anche `/profile`. La pausa è uno stato interno della
          programmazione del coach, e dirla con una pillola arancione invece
          che parlandoci è il modo sbagliato (CLAUDE.md §9-decies). */}
      <IdentitaAtleta
        foto={athlete.photo_url}
        nome={`${athlete.name} ${athlete.surname || ''}`.trim()}
        onErroreFoto={() => setAthlete({ ...athlete, photo_url: null })}
        anagrafica={anagrafica}
        social={<>
          <IconaSocial
            etichetta={athlete.instagram_url ? 'Apri Instagram' : 'Aggiungi il profilo Instagram'}
            icona={InstagramIcon} colore={athlete.instagram_url ? '#e1306c' : null}
            href={athlete.instagram_url
              ? (athlete.instagram_url.startsWith('http') ? athlete.instagram_url : `https://instagram.com/${athlete.instagram_url.replace(/^@/, '')}`)
              : null}
            onClick={() => setSocialModalType('instagram')} />
          <IconaSocial
            etichetta={athlete.strava_url ? 'Apri Strava' : 'Aggiungi il profilo Strava'}
            icona={Activity} colore={athlete.strava_url ? '#fc4c02' : null}
            href={athlete.strava_url || null}
            onClick={() => setSocialModalType('strava')} />
        </>}
        pillola={pausaAtleta.inPausa && role !== 'athlete' ? (
          <PillolaPausa dal={pausaAtleta.dal
            ? format(parseISO(pausaAtleta.dal), parseISO(pausaAtleta.dal).getFullYear() === new Date().getFullYear() ? 'd MMM' : 'd MMM yyyy', { locale: it })
            : null} />
        ) : null}
        nota={pausaAtleta.testo} />

      {/* L'EROE — «come sta andando».
          Era la terza tab, dietro due tocchi, spezzata in quattro grafici che
          non si parlavano: aderenza, volume, carico, RPE. Sono la stessa
          domanda, e la risposta si legge solo mettendoli sulla stessa riga. */}
      <CardAndamento
        titolo={`${isOwnProfile ? 'Come stai andando' : 'Come sta andando'} · ${GIORNI_ADERENZA} giorni`}
        percentuale={andamento.aderenza.percentuale}
        fatti={andamento.aderenza.fatti}
        assegnati={andamento.aderenza.assegnati}
        settimane={andamento.settimane}
        delta={andamento.carico.delta}
        frase={andamento.frase.testo}
        dettaglio={andamento.frase.dettaglio} />

      <div className="grid grid-cols-[1.05fr_1fr] gap-3">
        <CellaBento
          etichetta="Volume" valore={andamento.volume.minuti} unita="min"
          nota={testoDelta} notaColore={coloreDelta} coda="4 settimane">
          <Sparkline valori={andamento.volume.barre} />
        </CellaBento>
        <CellaBento
          etichetta="Sforzo"
          valore={andamento.sforzo.medio != null ? String(andamento.sforzo.medio).replace('.', ',') : '—'}
          unita={andamento.sforzo.medio != null ? 'RPE' : null}
          nota={andamento.sforzo.medio != null
            ? `medio · ${andamento.sforzo.quanti} workout`
            : 'nessun RPE dichiarato'}
          coda={andamento.sforzo.quanti > 0
            ? `${andamento.sforzo.duri} su ${andamento.sforzo.quanti} da 7 in su`
            : null}>
          <BarraFasce distribuzione={andamento.sforzo.distribuzione} />
        </CellaBento>
      </div>

      {/* Il banner del prossimo obiettivo era alto quanto una card, con un
          numero da 30px: teneva il peso di un eroe per un dato che cambia una
          volta al giorno. È una riga, e resta cliccabile com'era. */}
      {nextEvent && (
        <RigaObiettivo
          titolo={`${nextEvent.workouts.title} · ${format(parseISO(nextEvent.completed_date), 'd MMM', { locale: it })}`}
          giorni={countdownDays}
          onClick={() => navigate(`/workout/${nextEvent.workouts.id}?athlete_id=${id}`)} />
      )}

      {todayWorkoutsList.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <IntestazioneSezione etichetta="Oggi" />
          {todayWorkoutsList.map(entry => (
            <TodayAthleteWorkoutCard
              key={entry.id}
              entry={entry}
              onToggleStatus={toggleWorkoutStatus}
              onUpdateNote={updateWorkoutNote}
              onRemove={requestRemoveWorkout}
              navigate={navigate}
              athleteId={id}
              role={role}
              onUploadVoiceNote={uploadVoiceNote}
              onDeleteVoiceNote={deleteVoiceNote}
              onEditAutonomous={openEditAutonomous}
            />
          ))}
        </div>
      )}

      {/* ⚠️ «Prossimi» NON è nell'artboard, e resta lo stesso. L'artboard
          disegna una giornata; togliere gli allenamenti già programmati
          vorrebbe dire che il coach non può più vedere cos'ha assegnato senza
          aprire il calendario, e l'atleta non sa cosa lo aspetta domani. */}
      {upcomingWorkoutsList.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <IntestazioneSezione etichetta="Prossimi allenamenti" dettaglio={`${upcomingWorkoutsList.length}`} />
          {upcomingWorkoutsList.map(entry => (
            <WorkoutEntryCard
              key={entry.id}
              entry={entry}
              onToggleStatus={toggleWorkoutStatus}
              onUpdateNote={updateWorkoutNote}
              onRemove={requestRemoveWorkout}
              navigate={navigate}
              athleteId={id}
              onUploadVoiceNote={uploadVoiceNote}
              onDeleteVoiceNote={deleteVoiceNote}
              role={role}
            />
          ))}
        </div>
      )}

      {/* Le due tab che restavano diventano due righe che si aprono in pagina.
          La differenza che conta non è estetica: una tab nasconde il contenuto
          E la sua esistenza, una riga dice quanto c'è dentro prima di aprirla. */}
      <div className="flex flex-col gap-2.5">
        <RigaApribile
          icona={FolderArchive} titolo="Storico allenamenti" conteggio={pastWorkoutsList.length}
          aperta={storicoAperto} onToggle={() => setStoricoAperto(v => !v)} />

        {storicoAperto && (
          <div className="flex flex-col gap-3 pb-1">
            {role !== 'athlete' && (
              <div className="relative flex bg-[#111] p-1.5 rounded-2xl border border-[#333]">
                <div
                  className={`absolute top-1.5 bottom-1.5 left-1.5 w-[calc(50%-0.375rem)] bg-[#2a2a2a] rounded-xl shadow-md transition-transform duration-300 ease-out ${
                    workoutView === 'list' ? 'translate-x-0' : 'translate-x-full'
                  }`}
                />
                <button
                  onClick={() => setWorkoutView('list')}
                  className={`relative z-10 flex-1 flex justify-center items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors duration-300 ${workoutView === 'list' ? 'text-white' : 'text-muted hover:text-gray-300'}`}
                >
                  <LayoutList size={18} /> Elenco
                </button>
                <button
                  onClick={() => setWorkoutView('calendar')}
                  className={`relative z-10 flex-1 flex justify-center items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors duration-300 ${workoutView === 'calendar' ? 'text-brand' : 'text-muted hover:text-gray-300'}`}
                >
                  <CalendarDays size={18} /> Calendario
                </button>
              </div>
            )}

            {role !== 'athlete' && workoutView === 'calendar' ? (
              <div className={`${CARD} flex flex-col p-5`}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-white capitalize">
                    {format(currentMonth, 'MMMM yyyy', { locale: it })}
                  </h2>
                  <div className="flex items-center gap-2">
                    <button aria-label="Mese precedente" onClick={prevMonth} className="p-2 rounded-xl bg-[#222] hover:bg-[#2a2a2a] text-gray-400 hover:text-white transition">
                      <ChevronLeft size={18} />
                    </button>
                    <button onClick={() => { setCurrentMonth(new Date()); setSelectedDay(new Date()); }} className="px-3 py-1.5 rounded-xl bg-[#222] hover:bg-[#2a2a2a] text-gray-400 hover:text-white text-sm transition">
                      Oggi
                    </button>
                    <button aria-label="Mese successivo" onClick={nextMonth} className="p-2 rounded-xl bg-[#222] hover:bg-[#2a2a2a] text-gray-400 hover:text-white transition">
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-7 mb-2">
                  {['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((d, i) => (
                    <div key={i} className="text-center text-gray-400 text-xs font-medium py-1">{d}</div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1 mb-6">
                  {Array.from({ length: offset }).map((_, i) => <div key={`empty-${i}`} />)}
                  {days.map(day => {
                    const dayStr = format(day, 'yyyy-MM-dd')
                    const dayWorkoutsList = workouts.filter(w => w.completed_date === dayStr)
                    const hasWorkout = dayWorkoutsList.length > 0
                    const selected = format(selectedDay, 'yyyy-MM-dd') === dayStr
                    const today = format(new Date(), 'yyyy-MM-dd') === dayStr

                    return (
                      <button
                        key={day.toISOString()}
                        onClick={() => setSelectedDay(day)}
                        className={`relative flex flex-col items-center justify-start pt-1.5 pb-1 rounded-xl aspect-square transition ${selected ? 'bg-brand' : today ? 'bg-[#2a2a2a]' : 'bg-[#111] hover:bg-[#2a2a2a] border border-[#222]'}`}
                      >
                        <span className={`text-sm font-medium leading-none ${selected ? 'text-black' : today ? 'text-brand' : 'text-white'}`}>
                          {format(day, 'd')}
                        </span>
                        {hasWorkout && (
                          <div className="flex gap-0.5 mt-1">
                            {dayWorkoutsList.slice(0, 3).map((w, i) => {
                              const cat = w.workouts?.sections?.category || 'Hyrox'
                              const isCustom = cat === 'Custom' || cat === 'Autonomo' || w.workouts?.sections?.isAutonomous === true
                              const isEvent = cat === 'Event' || w.workouts?.sections?.isEvent === true
                              const color = coloreCategoria(isEvent ? 'Event' : (cat === 'Running' ? 'Running' : (isCustom ? 'Custom' : 'Hyrox')))
                              return <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: selected ? '#000' : color }} />
                            })}
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>

                <div className="pt-4 border-t border-[#2a2a2a]">
                  <h3 className="text-white font-semibold mb-3">
                    {format(selectedDay, 'EEEE d MMMM', { locale: it })}
                  </h3>
                  {workouts.filter(w => w.completed_date === format(selectedDay, 'yyyy-MM-dd')).length === 0 ? (
                    <div className="bg-[#111] border border-[#2a2a2a] rounded-2xl p-6 text-center">
                      <p className="text-gray-400 text-sm">Nessun workout in questa data.</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {workouts.filter(w => w.completed_date === format(selectedDay, 'yyyy-MM-dd')).map(w => (
                        <WorkoutEntryCard key={w.id} entry={w} onToggleStatus={toggleWorkoutStatus} onUpdateNote={updateWorkoutNote} onRemove={requestRemoveWorkout} navigate={navigate} athleteId={id} role={role} onEditAutonomous={openEditAutonomous} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : pastWorkoutsList.length > 0 ? (
              pastWorkoutsList.map(entry => (
                <WorkoutEntryCard
                  key={entry.id}
                  entry={entry}
                  onToggleStatus={toggleWorkoutStatus}
                  onUpdateNote={updateWorkoutNote}
                  onRemove={requestRemoveWorkout}
                  navigate={navigate}
                  athleteId={id}
                  role={role}
                  onEditAutonomous={openEditAutonomous}
                  onUploadVoiceNote={uploadVoiceNote}
                  onDeleteVoiceNote={deleteVoiceNote}
                />
              ))
            ) : (
              <p className="px-1 text-sm text-muted">Nessun allenamento passato.</p>
            )}
          </div>
        )}

        <RigaApribile
          icona={Trophy} titolo="Personal record" conteggio={prs.length}
          aperta={prAperti} onToggle={() => setPrAperti(v => !v)} />

        {prAperti && (
          <div className="flex flex-col gap-3 pb-1">
            {prs.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {prs.map(pr => (
                  <button key={pr.id} type="button" onClick={() => { setEditingPr(pr); setPrModalOpen(true); }}
                    className={`${CARD} p-4 text-left hover:border-brand/40 transition`}>
                    <p className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">{pr.exercise}</p>
                    <p className="text-white font-bold text-2xl">{pr.value}</p>
                    <p className="text-muted text-xs mt-1">{format(parseISO(pr.date), 'd MMMM yyyy', { locale: it })}</p>
                  </button>
                ))}
              </div>
            ) : (
              <p className="px-1 text-sm text-muted text-pretty">
                Nessun record personale. Massimali di forza e migliori tempi di corsa si tengono qui.
              </p>
            )}
            <button onClick={() => { setEditingPr(null); setPrModalOpen(true); }}
              className={`${RIGA} w-full px-[15px] py-[13px] flex items-center gap-3 text-sm font-bold text-white hover:bg-white/[.055] transition`}>
              <Plus size={18} className="shrink-0 text-muted" aria-hidden="true" /> Aggiungi personal record
            </button>
          </div>
        )}

        {/* L'allenamento libero lo inserisce l'atleta: per il coach esiste il
            builder, che è nella barra qui sotto. */}
        {isOwnProfile && (
          <RigaAzione icona={Plus} titolo="Aggiungi allenamento libero"
            onClick={() => { setAutonomousForm({ title: '', date: format(new Date(), 'yyyy-MM-dd'), notes: '', id: null, awId: null }); setAutonomousModalOpen(true); }} />
        )}
      </div>

      {/* Assegna e Crea erano due bottoncini accanto al titolo «Diario
          Workout», cioè a metà pagina: sono le due azioni per cui il coach
          apre la scheda di un atleta, e non devono dipendere da quanto è
          lungo lo scroll. Nella vista atleta la barra non c'è. */}
      <div className="mt-auto" />
      {role !== 'athlete' && !isOwnProfile && (
        <BarraAzioni>
          <CtaPrimaria icona={Dumbbell} onClick={() => setAssignModalOpen(true)}>Assegna</CtaPrimaria>
          <BottoneQuadrato icona={Plus} etichetta="Crea un workout per questo atleta"
            onClick={() => navigate(`/create?athlete_id=${id}`)} />
        </BarraAzioni>
      )}

      {menuAperto && <MenuScheda etichetta="Azioni sull'atleta" onChiudi={() => setMenuAperto(false)} voci={vociMenu} />}


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

      {/* MODAL ASSEGNA WORKOUT DA LISTA */}
      {assignModalOpen && createPortal(
        <AssignWorkoutModal 
          athleteId={id}
          onClose={() => setAssignModalOpen(false)}
          onAssigned={() => {
            setAssignModalOpen(false)
            fetchAthleteData(true)
          }}
        />,
        document.body
      )}

      {/* MODAL NUOVO PR */}
      {prModalOpen && createPortal(
        <PrModal 
          athleteId={id} 
          initialPr={editingPr}
          onClose={() => { setPrModalOpen(false); setEditingPr(null); }} 
          onSaved={() => { 
            setPrModalOpen(false); 
            setEditingPr(null);
            fetchAthleteData(true) 
          }} 
          onDelete={(prId) => {
            setPrModalOpen(false);
            setEditingPr(null);
            setConfirmInfo({ title: 'Elimina PR', message: 'Vuoi davvero eliminare questo record personale?', onConfirm: () => { handleDeletePr(prId); setConfirmInfo(null); } })
          }}
        />,
        document.body
      )}

      {/* MODAL MODIFICA ATLETA */}
      {showEditModal && createPortal(
        <EditAthleteModal 
          athlete={athlete}
          onClose={() => setShowEditModal(false)}
          onSaved={() => {
            setShowEditModal(false)
            fetchAthleteData(true)
          }}
          onDelete={() => {
            if (role === 'athlete') {
              navigate('/login')
            } else {
              navigate('/athletes')
            }
          }}
          role={role}
        />,
        document.body
      )}

      {/* MODAL SOCIAL LINK */}
      {socialModalType && createPortal(
        <SocialLinkModal 
          athlete={athlete}
          type={socialModalType}
          onClose={() => setSocialModalType(null)}
          onSaved={() => {
            setSocialModalType(null)
            fetchAthleteData(true)
          }}
        />,
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
      {showRpeModal && createPortal(
        <RpeModal 
          score={rpeScore} 
          onScoreChange={setRpeScore} 
          notes={rpeNotes} 
          onNotesChange={setRpeNotes} 
          onSave={handleRpeSubmitAthleteDetail} 
          onCancel={() => { setShowRpeModal(false); setWorkoutToComplete(null); }} 
          saving={savingRpe} 
        />,
        document.body
      )}

      {createPortal(
        <>
          <CustomAlert info={alertInfo} onClose={() => setAlertInfo(null)} />
          <CustomConfirm info={confirmInfo} onClose={() => setConfirmInfo(null)} />
        </>,
        document.body
      )}
    </div>
  )
}

function SocialLinkModal({ athlete, type, onClose, onSaved }) {
  const [url, setUrl] = useState(athlete[`${type}_url`] || '')
  const [saving, setSaving] = useState(false)
  const [alertInfo, setAlertInfo] = useState(null)

  const handleSave = async () => {
    if (!url.trim()) return
    
    let finalUrl = url.trim()
    if (type === 'instagram') {
       let val = finalUrl.replace(/^@/, '')
       if (val.includes('instagram.com/')) {
         val = val.split('instagram.com/')[1].split('/')[0].split('?')[0]
       }
       const instaRegex = /^[a-zA-Z0-9._]{1,30}$/
       if (!instaRegex.test(val)) {
         return setAlertInfo({ title: 'Errore', message: 'Username Instagram non valido. Usa solo lettere, numeri, punti e underscore.', type: 'error' })
       }
       finalUrl = val
    } else if (type === 'strava') {
       if (!/^https?:\/\//i.test(finalUrl)) {
         finalUrl = 'https://' + finalUrl;
       }
       try {
         const parsedUrl = new URL(finalUrl)
         if (!parsedUrl.hostname.includes('strava.com') && !parsedUrl.hostname.includes('strava.app.link')) {
           return setAlertInfo({ title: 'Errore', message: 'Inserisci un link valido a un profilo Strava (es. https://strava.app.link/...).', type: 'error' })
         }
       } catch {
         return setAlertInfo({ title: 'Errore', message: 'Inserisci un URL Strava valido.', type: 'error' })
       }
    }
    
    setSaving(true)
    const { error } = await supabase.from('athletes').update({
      [`${type}_url`]: finalUrl
    }).eq('id', athlete.id)

    setSaving(false)
    if (error) {
      setAlertInfo({ title: 'Errore', message: error.message, type: 'error' })
    } else {
      onSaved()
    }
  }

  const isInsta = type === 'instagram'

  return (
    <div className="fixed inset-0 bg-black/85 z-[100] flex items-center justify-center p-4">
      <div className="bg-[#1e1e1e] rounded-3xl w-full max-w-sm flex flex-col border border-[#333] shadow-2xl animate-in fade-in zoom-in-[0.96] duration-300 ease-out">
        <div className="flex items-center justify-between p-5 border-b border-[#2a2a2a]">
          <p className="text-white font-bold text-lg">Aggiungi {isInsta ? 'Instagram' : 'Strava'}</p>
          <button aria-label="Chiudi" onClick={onClose} className="text-muted hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-gray-400 text-xs pl-1 block mb-1">
              {isInsta ? 'Username o link profilo' : 'Link profilo Strava'}
            </label>
            {isInsta ? (
               <div className="flex items-center bg-[#111] border border-[#333] rounded-xl overflow-hidden focus-within:border-pink-500 transition">
                  <div className="pl-4 pr-3 py-3 text-muted flex items-center justify-center border-r border-[#333]">
                     <InstagramIcon size={18} className="text-pink-500" />
                  </div>
                  <div className="pl-3 text-gray-400 text-sm font-semibold">@</div>
                <input autoFocus className="w-full bg-transparent pr-3 py-3 text-white placeholder-gray-500 focus:outline-none text-base" placeholder="Nome utente" value={url} onChange={e => setUrl(e.target.value)} />
               </div>
            ) : (
               <div className="flex items-center bg-[#111] border border-[#333] rounded-xl overflow-hidden focus-within:border-[#fc4c02] transition">
                  <div className="pl-4 pr-3 py-3 text-muted flex items-center justify-center border-r border-[#333]">
                     <Activity size={18} className="text-[#fc4c02]" />
                  </div>
                  <input autoFocus className="w-full bg-transparent px-3 py-3 text-white placeholder-gray-500 focus:outline-none text-base" placeholder="Link profilo..." value={url} onChange={e => setUrl(e.target.value)} />
               </div>
            )}
          </div>
          <button onClick={handleSave} disabled={saving || !url.trim()} className="w-full mt-2 py-3.5 bg-brand text-black font-bold rounded-xl hover:brightness-110 transition disabled:opacity-50">
            {saving ? 'Salvataggio...' : 'Conferma'}
          </button>
        </div>
      </div>
      {alertInfo && <CustomAlert info={alertInfo} onClose={() => setAlertInfo(null)} />}
    </div>
  )
}

function TodayAthleteWorkoutCard({ entry, onToggleStatus, onUpdateNote, onRemove, navigate, athleteId, role, onEditAutonomous, onUploadVoiceNote, onDeleteVoiceNote }) {
  const parsed = parseNotesAndRpe(entry.notes)
  const [note, setNote] = useState(parsed.text)
  const [saving, setSaving] = useState(false)
  const noteRef = useRef(null)

  useEffect(() => {
    setNote(parseNotesAndRpe(entry.notes).text)
  }, [entry.notes])

  useEffect(() => {
    if (noteRef.current) {
      noteRef.current.style.height = 'auto'
      noteRef.current.style.height = `${noteRef.current.scrollHeight}px`
    }
  }, [note])
  
  const hasChanges = note !== parsed.text

  const rawCat = entry.workouts?.sections?.category || (entry.workouts?.sections?.steps ? 'Running' : 'Hyrox')
  const isAuto = entry.workouts?.sections?.isAutonomous === true || rawCat === 'Autonomo'
  const isEvent = rawCat === 'Event' || entry.workouts?.sections?.isEvent === true
  const isCustom = rawCat === 'Custom' || isAuto
  const category = isEvent ? 'Event' : (isCustom ? 'Custom' : rawCat)
  const isRun = category === 'Running'

  const handleSaveNote = async () => {
    setSaving(true)
    const finalNote = formatNotesWithRpe(parsed.rpe, note)
    await onUpdateNote(entry.id, finalNote, entry.workouts?.title)
    setSaving(false)
  }

  return (
    <div 
      className={`rounded-3xl p-5 transition border relative overflow-hidden group ${
        entry.status === 'completed'
          ? 'bg-green-500/10 border-green-500/30'
          : (isEvent ? 'bg-gradient-to-br from-[#2a2a2a] to-[#1e1e1e] border-white/50' : isRun ? 'bg-gradient-to-br from-[#2a2a2a] to-[#1e1e1e] border-running/50' : isCustom ? 'bg-gradient-to-br from-[#2a2a2a] to-[#1e1e1e] border-custom/50' : 'bg-gradient-to-br from-[#2a2a2a] to-[#1e1e1e] border-brand/50')
      }`}
    >
      <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
        {entry.status === 'completed' ? <CheckCircle2 size={80} className="text-green-500 -rotate-12" /> : (isEvent ? <CalendarDays size={80} className="text-white/30 -rotate-12" /> : isRun ? <Timer size={80} className="text-running -rotate-12" /> : isCustom ? <Dumbbell size={80} className="text-custom -rotate-12" /> : <Flame size={80} className="text-brand -rotate-12" />)}
      </div>
      <div className="relative z-10 flex flex-col gap-4">
        <div className="flex justify-between items-start gap-2">
           <div className="flex items-center gap-4 cursor-pointer flex-1 min-w-0" onClick={() => navigate(`/workout/${entry.workouts.id}?athlete_id=${athleteId}`)}>
             <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg shrink-0 ${
               entry.status === 'completed' ? 'bg-green-500 text-black shadow-green-500/20' : (isEvent ? 'bg-white text-black shadow-white/20' : isRun ? 'bg-running text-white shadow-running/20' : isCustom ? 'bg-custom text-white shadow-custom/20' : 'bg-brand text-black shadow-brand/20')
             }`}>
               {entry.status === 'completed' ? <CheckCircle2 size={24} /> : (isEvent ? <CalendarDays size={24} /> : isRun ? <Timer size={24} /> : <Dumbbell size={24} />)}
             </div>
             <div className="min-w-0">
               <h3 className="text-white font-bold text-xl leading-tight group-hover:underline underline-offset-4 truncate">{entry.workouts.title}</h3>
               <p className={`text-sm font-medium mt-1 ${entry.status === 'completed' ? 'text-green-400' : (isEvent ? 'text-gray-300' : isRun ? 'text-running' : isCustom ? 'text-custom' : 'text-brand')}`}>
                 {entry.status === 'completed' ? 'Completato! 🎉' : (isEvent ? 'In programma oggi 🏁' : 'Da fare oggi 🔥')}
               </p>
             </div>
           </div>
           
           <div className="flex flex-col items-end gap-2 shrink-0">
             <button 
               onClick={() => onToggleStatus(entry.id, entry.status, entry.completed_date)}
               className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition border bg-[#111]/50 backdrop-blur-md ${
                 entry.status === 'completed' 
                   ? 'border-green-500 text-green-500 hover:bg-green-500/20' 
                     : `border-[#333] text-gray-300 ${isEvent ? 'hover:border-white hover:text-white' : isRun ? 'hover:border-running hover:text-running' : isCustom ? 'hover:border-custom hover:text-custom' : 'hover:border-brand hover:text-brand'}`
               }`}
             >
               {entry.status === 'completed' ? <CheckCircle2 size={14} /> : <Circle size={14} />} {entry.status === 'completed' ? 'Fatto' : 'Segna fatto'}
             </button>
             
             {(role !== 'athlete' || isAuto) && (
               <div className="flex items-center gap-1 mt-1">
                 {role === 'athlete' && isAuto && onEditAutonomous && (
                   <button aria-label="Modifica l'allenamento libero" 
                     onClick={(e) => { e.stopPropagation(); onEditAutonomous(entry); }}
                     className="text-muted hover:text-brand transition p-1"
                     title="Modifica allenamento libero"
                   >
                     <Edit size={16} />
                   </button>
                 )}
                 <button aria-label="Elimina l'allenamento" 
                   onClick={(e) => { e.stopPropagation(); onRemove(entry.id); }}
                   className="text-muted hover:text-red-500 transition p-1"
                   title={isAuto ? "Elimina allenamento libero" : "Rimuovi assegnazione"}
                 >
                   <Trash2 size={16} />
                 </button>
               </div>
             )}
           </div>
        </div>

        <div className="pt-2 border-t border-white/5">
          {entry.voice_note_url ? (
            <div className="mb-3">
              <p className="text-brand text-xs font-bold mb-1.5 flex items-center gap-1"><Mic size={12}/> Nota Vocale del Coach</p>
              <CustomAudioPlayer src={entry.voice_note_url} onDelete={() => onDeleteVoiceNote(entry.id)} role={role} />
            </div>
          ) : role === 'admin' ? (
            <div className="mb-3">
              <p className="text-brand text-xs font-bold mb-1.5 flex items-center gap-1"><Mic size={12}/> Invia Nota Vocale</p>
              <VoiceRecorder onSave={(blob, ext) => onUploadVoiceNote(entry.id, blob, ext)} />
            </div>
          ) : null}
          {parsed.rpe !== '5' && entry.status === 'completed' && (
            <div className="mb-2 inline-flex items-center gap-1.5 bg-[#111] px-2 py-1 rounded border border-[#333]">
              <span className="text-muted text-[11px] font-bold uppercase tracking-wider">Sforzo:</span>
              <span className={`text-xs font-bold ${getRpeColorText(parseInt(parsed.rpe))}`}>{parsed.rpe}/10</span>
            </div>
          )}
          <textarea
          ref={noteRef}
          className={`w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-gray-500 focus:outline-none resize-none text-base transition-all duration-200 overflow-hidden ${isEvent ? 'focus:border-white' : isRun ? 'focus:border-running' : isCustom ? 'focus:border-custom' : 'focus:border-brand'}`}
            rows={2}
            placeholder="Note dell'atleta su questo workout..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        <div className={`transition-all duration-300 ease-out overflow-hidden ${hasChanges ? 'max-h-16 opacity-100 mt-2' : 'max-h-0 opacity-0 mt-0'}`}>
          <div className="flex justify-end">
              <button
                onClick={handleSaveNote}
                disabled={saving}
                className={`font-bold px-4 py-1.5 rounded-xl text-sm hover:brightness-110 transition disabled:opacity-50 ${isEvent ? 'bg-white text-black' : isRun ? 'bg-running text-white' : isCustom ? 'bg-custom text-white' : 'bg-brand text-black'}`}
              >
                {saving ? 'Salvataggio...' : 'Conferma note'}
              </button>
            </div>
        </div>
        </div>
      </div>
    </div>
  )
}

function PrModal({ athleteId, initialPr, onClose, onSaved, onDelete }) {
  const [exercise, setExercise] = useState(initialPr?.exercise || '')
  const [value, setValue] = useState(initialPr?.value || '')
  const [date, setDate] = useState(initialPr?.date || format(new Date(), 'yyyy-MM-dd'))
  const [saving, setSaving] = useState(false)
  const [alertInfo, setAlertInfo] = useState(null)

  const handleSave = async () => {
    if (!exercise || !value || !date) return setAlertInfo({ title: 'Dati mancanti', message: 'Tutti i campi sono obbligatori', type: 'error' })
    setSaving(true)
    
    if (initialPr) {
      const { error } = await supabase.from('personal_records').update({ exercise, value, date }).eq('id', initialPr.id)
      setSaving(false)
      if (error) return setAlertInfo({ title: 'Errore', message: "Impossibile aggiornare: " + error.message, type: 'error' })
      onSaved(false)
    } else {
      const { error } = await supabase.from('personal_records').insert({ athlete_id: athleteId, exercise, value, date })
      setSaving(false)
      if (error) return setAlertInfo({ title: 'Errore', message: "Impossibile salvare: " + error.message, type: 'error' })
      onSaved(true)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/85 z-[100] flex items-center justify-center p-4">
      <div className="bg-[#1e1e1e] rounded-3xl w-full max-w-sm flex flex-col border border-[#333] animate-in fade-in zoom-in-[0.96] duration-300 ease-out">
        <div className="flex items-center justify-between p-5 border-b border-[#2a2a2a]">
          <p className="text-white font-bold text-lg">{initialPr ? 'Modifica PR' : 'Aggiungi PR'}</p>
          <button aria-label="Chiudi" onClick={onClose} className="text-muted hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <div>
            <label className="text-gray-400 text-xs pl-1 mb-1 block">Esercizio o Distanza *</label>
            <input type="text" placeholder="Es. Back Squat, 5km Run" value={exercise} onChange={e => setExercise(e.target.value)} className="w-full bg-[#111] border border-[#333] text-white px-4 py-3 rounded-xl focus:outline-none focus:border-brand text-base" />
          </div>
          <div>
            <label className="text-gray-400 text-xs pl-1 mb-1 block">Risultato / Record *</label>
            <input type="text" placeholder="Es. 120 kg, 22:30 min" value={value} onChange={e => setValue(e.target.value)} className="w-full bg-[#111] border border-[#333] text-white px-4 py-3 rounded-xl focus:outline-none focus:border-brand text-base" />
          </div>
          <div>
            <label className="text-gray-400 text-xs pl-1 mb-1 block">Data del record *</label>
            <CustomDatePicker date={date} onChange={setDate} className="bg-[#111] border border-[#333] rounded-xl px-4 py-3 hover:border-brand" />
          </div>
          <div className="flex flex-col gap-2 mt-2">
            <button onClick={handleSave} disabled={saving} className="w-full py-3.5 bg-brand text-black font-bold rounded-xl hover:brightness-110 transition disabled:opacity-50">
              {saving ? 'Salvataggio...' : (initialPr ? 'Salva Modifiche' : 'Salva Record')}
            </button>
            {initialPr && (
              <button onClick={() => onDelete(initialPr.id)} className="w-full py-3.5 bg-[#2a2a2a] text-red-500 font-bold rounded-xl hover:bg-[#333] transition disabled:opacity-50">
                Elimina PR
              </button>
            )}
          </div>
        </div>
      </div>
      {alertInfo && <CustomAlert info={alertInfo} onClose={() => setAlertInfo(null)} />}
    </div>
  )
}

function EditAthleteModal({ athlete, onClose, onSaved, onDelete, role }) {
  const [form, setForm] = useState({ 
    name: athlete.name || '', 
    surname: athlete.surname || '', 
    birth_date: athlete.birth_date || '', 
    weight: athlete.weight || '', 
    height: athlete.height || '', 
    // ⚠️ Il TESTO della nota, senza il marcatore di pausa: qui c'era
    // `athlete.notes` grezzo, e il salvataggio più sotto lo riscriveva
    // verbatim — cioè ogni «Salva» avrebbe cancellato la pausa, o mostrato
    // `[PAUSA: …]` come testo dentro il campo. Vedi src/lib/pausa.js.
    notes: parseNotePausa(athlete.notes).testo,
    instagram_url: athlete.instagram_url || '',
    strava_url: athlete.strava_url || ''
  })
  // Lo stato di pausa non si modifica da qui (si tocca con il bottone nella
  // scheda), ma va CONSERVATO: il salvataggio ricompone la nota intorno a lui.
  // ⚠️ Vale per ENTRAMBI i ruoli: questa modale si apre anche dall'atleta sul
  // proprio /profile, e senza il round-trip il suo «Salva» annullerebbe la
  // pausa decisa dal coach.
  const pausa = parseNotePausa(athlete.notes)
  const [photo, setPhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(athlete.photo_url || null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [alertInfo, setAlertInfo] = useState(null)

  const handlePhoto = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setPhoto(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const handleSave = async () => {
    if (!form.name || !form.surname) return setAlertInfo({ title: 'Attenzione', message: 'Nome e cognome obbligatori!', type: 'error' })
    
    let finalInstagram = form.instagram_url?.trim() || ''
    if (finalInstagram) {
      const instaRegex = /^[a-zA-Z0-9._]{1,30}$/
      if (!instaRegex.test(finalInstagram)) {
        return setAlertInfo({ title: 'Errore', message: 'Username Instagram non valido. Usa solo lettere, numeri, punti e underscore.', type: 'error' })
      }
    }

    let finalStrava = form.strava_url?.trim() || ''
    if (finalStrava) {
      if (!/^https?:\/\//i.test(finalStrava)) {
        finalStrava = 'https://' + finalStrava;
      }
      try {
         const parsedUrl = new URL(finalStrava)
         if (!parsedUrl.hostname.includes('strava.com') && !parsedUrl.hostname.includes('strava.app.link')) {
           return setAlertInfo({ title: 'Errore', message: 'Inserisci un link valido a un profilo Strava (es. https://strava.app.link/...).', type: 'error' })
         }
      } catch {
         return setAlertInfo({ title: 'Errore', message: 'Inserisci un URL Strava valido.', type: 'error' })
      }
    }

    setSaving(true)

    let photo_url = athlete.photo_url
    if (photo) {
      const ext = photo.name.split('.').pop()
      const fileName = `${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('athlete-photos')
        .upload(fileName, photo, { contentType: photo.type })

      if (uploadError) {
        setSaving(false)
        setAlertInfo({ title: 'Errore', message: 'Errore durante il caricamento della foto: ' + uploadError.message, type: 'error' })
        return
      }
      const { data: urlData } = supabase.storage.from('athlete-photos').getPublicUrl(fileName)
      photo_url = urlData.publicUrl
    }

    const { error } = await supabase.from('athletes').update({
      name: form.name,
      surname: form.surname,
      birth_date: form.birth_date || null,
      weight: form.weight ? parseFloat(form.weight) : null,
      height: form.height ? parseFloat(form.height) : null,
      notes: pausa.inPausa ? formatNotePausa(pausa.dal, form.notes) : form.notes,
      instagram_url: finalInstagram,
      strava_url: finalStrava,
      photo_url
    }).eq('id', athlete.id)

    setSaving(false)
    if (error) { setAlertInfo({ title: 'Errore', message: 'Errore: ' + error.message, type: 'error' }); return }
    
    localStorage.setItem(`fleofit_name_${athlete.id}`, form.name)
    supabase.auth.updateUser({ data: { first_name: form.name, last_name: form.surname, avatar_url: photo_url } }).catch(()=>{})

    onSaved()
  }

  const handleDeleteAthlete = async () => {
    const deletedAt = Date.now()
    const { error } = await supabase.from('athletes').update({ deleted_at: deletedAt }).eq('id', athlete.id)
    if (error) {
      setAlertInfo({ title: 'Errore', message: "Errore durante l'eliminazione: " + error.message, type: 'error' })
      return
    }
    if (role === 'athlete') {
      await supabase.auth.signOut()
    }
    onDelete()
  }

  return (
    <div className="fixed inset-0 bg-black/85 z-[100] flex items-center justify-center p-4">
      <div className="bg-[#1e1e1e] rounded-3xl w-full max-w-md flex flex-col animate-in fade-in zoom-in-[0.96] duration-300 ease-out" style={{ maxHeight: 'calc(100vh - 100px)' }}>
        <div className="flex items-center justify-between p-5 border-b border-[#2a2a2a]">
          <p className="text-white font-bold text-lg">Modifica Atleta</p>
          <button aria-label="Chiudi" onClick={onClose} className="text-muted hover:text-white"><X size={20} /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-5 flex flex-col gap-4">
          <div className="flex justify-center">
            <label className="cursor-pointer relative">
              <div className="w-20 h-20 rounded-full bg-[#2a2a2a] border-2 border-dashed border-[#444] flex items-center justify-center overflow-hidden hover:border-brand transition">
                {photoPreview
                  ? <img src={photoPreview} className="w-full h-full object-cover" onError={() => setPhotoPreview(null)} />
                  : <User size={28} className="text-muted" />
                }
              </div>
              <div className="absolute bottom-0 right-0 bg-brand p-1.5 rounded-full cursor-pointer shadow-lg">
                <Upload size={12} className="text-black" />
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-gray-400 text-xs pl-1">Nome *</label>
              <input className="bg-[#2a2a2a] border border-[#383838] rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-brand text-base" placeholder="Mario" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-gray-400 text-xs pl-1">Cognome *</label>
              <input className="bg-[#2a2a2a] border border-[#383838] rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-brand text-base" placeholder="Rossi" value={form.surname} onChange={e => setForm({ ...form, surname: e.target.value })} />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-gray-400 text-xs pl-1">Data di nascita</label>
            <input type="date" className="bg-[#2a2a2a] border border-[#383838] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand text-base" value={form.birth_date} onChange={e => setForm({ ...form, birth_date: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-gray-400 text-xs pl-1">Peso (kg)</label>
              <input className="bg-[#2a2a2a] border border-[#383838] rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-brand text-base" placeholder="Es. 75" type="number" value={form.weight} onChange={e => setForm({ ...form, weight: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-gray-400 text-xs pl-1">Altezza (cm)</label>
              <input className="bg-[#2a2a2a] border border-[#383838] rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-brand text-base" placeholder="Es. 180" type="number" value={form.height} onChange={e => setForm({ ...form, height: e.target.value })} />
            </div>
          </div>
          <textarea className="bg-[#2a2a2a] border border-[#383838] rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-brand resize-none text-base" rows={3} placeholder="Note biografiche (facoltativo)" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          
          <div className="flex flex-col gap-3">
             <div className="flex items-center bg-[#2a2a2a] border border-[#383838] rounded-xl overflow-hidden focus-within:border-pink-500 transition">
                <div className="pl-4 pr-3 py-3 text-muted flex items-center justify-center bg-[#1e1e1e] border-r border-[#383838]">
                   <InstagramIcon size={18} className="text-pink-500" />
                </div>
                <div className="pl-3 text-gray-400 text-sm font-semibold">@</div>
                <input className="w-full bg-transparent pr-3 py-3 text-white placeholder-gray-500 focus:outline-none text-base" placeholder="Nome utente" value={form.instagram_url?.replace(/^@/, '')} onChange={e => {
                   let val = e.target.value.replace(/^@/, '').trim();
                   if (val.includes('instagram.com/')) {
                     val = val.split('instagram.com/')[1].split('/')[0].split('?')[0];
                   }
                   setForm({ ...form, instagram_url: val })
                }} />
             </div>
             <div className="flex items-center bg-[#2a2a2a] border border-[#383838] rounded-xl overflow-hidden focus-within:border-[#fc4c02] transition">
                <div className="pl-4 pr-3 py-3 text-muted flex items-center justify-center bg-[#1e1e1e] border-r border-[#383838]">
                   <Activity size={18} className="text-[#fc4c02]" />
                </div>
                <input className="w-full bg-transparent px-3 py-3 text-white placeholder-gray-500 focus:outline-none text-base" placeholder="Link profilo Strava..." value={form.strava_url} onChange={e => setForm({ ...form, strava_url: e.target.value })} />
             </div>
          </div>
        </div>
        <div className="p-5 border-t border-[#2a2a2a] flex flex-col gap-4">
          <button onClick={handleSave} disabled={saving} className="w-full bg-brand text-black font-bold py-4 rounded-xl hover:brightness-110 transition disabled:opacity-50">{saving ? 'Salvataggio...' : 'Salva Modifiche'}</button>
          
          <div className="flex justify-center">
            {!showDeleteConfirm ? (
              <button onClick={() => setShowDeleteConfirm(true)} className="flex items-center gap-2 text-red-500 text-sm font-medium hover:underline">
                <Trash2 size={16} /> Elimina profilo{role !== 'athlete' ? ' atleta' : ''}
              </button>
            ) : (
              <div className="bg-red-900/20 border border-red-900/50 rounded-xl p-4 text-center w-full">
                <p className="text-red-400 text-sm font-semibold mb-3">Sei sicuro? Il profilo verrà nascosto e poi eliminato definitivamente tra 7 giorni.</p>
                <div className="flex justify-center gap-3">
                  <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 bg-[#2a2a2a] text-white rounded-lg text-sm transition hover:bg-[#333]">Annulla</button>
                  <button onClick={handleDeleteAthlete} className="px-4 py-2 bg-red-600/80 hover:bg-red-600 text-white rounded-lg text-sm font-bold transition">Sì, elimina</button>
                </div>
              </div>
            )}
          </div>
          <CustomAlert info={alertInfo} onClose={() => setAlertInfo(null)} />
        </div>
      </div>
    </div>
  )
}

function WorkoutEntryCard({ entry, onToggleStatus, onUpdateNote, onRemove, navigate, athleteId, role, onEditAutonomous, onUploadVoiceNote, onDeleteVoiceNote }) {
  const parsed = parseNotesAndRpe(entry.notes)
  const [note, setNote] = useState(parsed.text)
  const [saving, setSaving] = useState(false)
  const noteRef = useRef(null)

  useEffect(() => {
    setNote(parseNotesAndRpe(entry.notes).text)
  }, [entry.notes])

  useEffect(() => {
    if (noteRef.current) {
      noteRef.current.style.height = 'auto'
      noteRef.current.style.height = `${noteRef.current.scrollHeight}px`
    }
  }, [note])
  
  const hasChanges = note !== parsed.text

  const scheduledDate = startOfDay(parseISO(entry.completed_date))
  const today = startOfDay(new Date())

  let statusText = 'Da fare'
  let Icon = Circle

  if (entry.status === 'completed') {
    statusText = 'Fatto'
    Icon = CheckCircle2
  } else if (isBefore(scheduledDate, today)) {
    statusText = 'Saltato'
  }

  const rawCat = entry.workouts?.sections?.category || (entry.workouts?.sections?.steps ? 'Running' : 'Hyrox')
  const isAuto = entry.workouts?.sections?.isAutonomous === true || rawCat === 'Autonomo'
  const isEvent = rawCat === 'Event' || entry.workouts?.sections?.isEvent === true
  const isCustom = rawCat === 'Custom' || isAuto
  const category = isEvent ? 'Event' : (isCustom ? 'Custom' : rawCat)
  const isRun = category === 'Running'

  const handleSaveNote = async () => {
    setSaving(true)
    const finalNote = formatNotesWithRpe(parsed.rpe, note)
    await onUpdateNote(entry.id, finalNote, entry.workouts?.title)
    setSaving(false)
  }

  return (
    <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-2xl p-4">
      <div className="flex justify-between items-start mb-3">
        <div 
          className="cursor-pointer group flex-1 pr-4"
          onClick={() => navigate(`/workout/${entry.workouts.id}?athlete_id=${athleteId}`)}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <p className={`font-semibold text-white transition underline underline-offset-4 leading-tight ${isEvent ? 'group-hover:text-white decoration-white/50' : isRun ? 'group-hover:text-running decoration-running/50' : isCustom ? 'group-hover:text-custom decoration-custom/50' : 'group-hover:text-brand decoration-brand/50'}`}>
              {entry.workouts.title}
            </p>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg border shrink-0 ${isEvent ? 'bg-white text-black border-white' : isRun ? 'bg-running/10 text-running border-running/30' : isCustom ? 'bg-custom/10 text-custom border-custom/30' : 'bg-brand/10 text-brand border-brand/30'}`}>
              {isEvent ? 'Evento / Gara' : category}
            </span>
          </div>
          <p className="text-xs text-muted mt-1.5">
            {format(parseISO(entry.completed_date), 'EEEE d MMMM yyyy', { locale: it })}
          </p>
        </div>
        {(role !== 'athlete' || isAuto) && (
          <div className="flex items-center gap-1 shrink-0 ml-2">
            {role === 'athlete' && isAuto && onEditAutonomous && (
              <button aria-label="Modifica l'allenamento libero" 
                onClick={(e) => { e.stopPropagation(); onEditAutonomous(entry); }}
                className="text-muted hover:text-brand transition p-1"
                title="Modifica allenamento libero"
              >
                <Edit size={18} />
              </button>
            )}
            <button aria-label="Elimina l'allenamento" 
              onClick={(e) => { e.stopPropagation(); onRemove(entry.id); }}
              className="text-muted hover:text-red-500 transition p-1"
              title={isAuto ? "Elimina allenamento libero" : "Rimuovi assegnazione"}
            >
              <Trash2 size={18} />
            </button>
          </div>
        )}
      </div>

      <button aria-label="Cambia lo stato dell'allenamento" 
        onClick={() => onToggleStatus(entry.id, entry.status, entry.completed_date)}
        className={`w-full py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition border ${
          entry.status === 'completed' 
            ? 'bg-green-500/10 border-green-500/30 text-green-500 hover:bg-green-500/20' 
            : isBefore(scheduledDate, today)
              ? `bg-[#111] border-[#333] text-muted ${isEvent ? 'hover:border-white hover:text-white' : isRun ? 'hover:border-running hover:text-running' : isCustom ? 'hover:border-custom hover:text-custom' : 'hover:border-brand hover:text-brand'}`
              : `bg-[#2a2a2a] border-[#383838] text-gray-300 ${isEvent ? 'hover:border-white hover:text-white' : isRun ? 'hover:border-running hover:text-running' : isCustom ? 'hover:border-custom hover:text-custom' : 'hover:border-brand hover:text-brand'}`
        }`}
      >
        <Icon size={18} /> {statusText}
      </button>

      <div className="mt-3 pt-3 border-t border-[#2a2a2a]">
        {entry.voice_note_url ? (
          <div className="mb-3">
            <p className="text-brand text-xs font-bold mb-1.5 flex items-center gap-1"><Mic size={12}/> Nota Vocale del Coach</p>
            <CustomAudioPlayer src={entry.voice_note_url} onDelete={() => onDeleteVoiceNote(entry.id)} role={role} />
          </div>
        ) : role === 'admin' ? (
          <div className="mb-3">
            <p className="text-brand text-xs font-bold mb-1.5 flex items-center gap-1"><Mic size={12}/> Invia Nota Vocale</p>
            <VoiceRecorder onSave={(blob, ext) => onUploadVoiceNote(entry.id, blob, ext)} />
          </div>
        ) : null}
        {parsed.rpe !== '5' && entry.status === 'completed' && (
          <div className="mb-2 inline-flex items-center gap-1.5 bg-[#111] px-2 py-1 rounded border border-[#333]">
            <span className="text-muted text-[11px] font-bold uppercase tracking-wider">Sforzo:</span>
            <span className={`text-xs font-bold ${getRpeColorText(parseInt(parsed.rpe))}`}>{parsed.rpe}/10</span>
          </div>
        )}
        <textarea
          ref={noteRef}
          className={`w-full bg-[#2a2a2a] border border-[#383838] rounded-xl px-3 py-2 text-white placeholder-gray-600 focus:outline-none resize-none text-base transition-all duration-200 overflow-hidden ${isEvent ? 'focus:border-white' : isRun ? 'focus:border-running' : isAuto ? 'focus:border-custom' : 'focus:border-brand'}`}
          rows={3}
          placeholder="Inserisci o modifica le note dell'atleta su questo workout..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className={`transition-all duration-300 ease-out overflow-hidden ${hasChanges ? 'max-h-16 opacity-100 mt-2' : 'max-h-0 opacity-0 mt-0'}`}>
          <div className="flex justify-end">
            <button
              onClick={handleSaveNote}
              disabled={saving}
              className={`font-bold px-4 py-1.5 rounded-xl text-sm hover:brightness-110 transition disabled:opacity-50 ${isEvent ? 'bg-white text-black' : isRun ? 'bg-running text-white' : isCustom ? 'bg-custom text-white' : 'bg-brand text-black'}`}
            >
              {saving ? 'Salvataggio...' : 'Conferma'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}




function AssignWorkoutModal({ athleteId, onClose, onAssigned }) {
  const [workouts, setWorkouts] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [assigning, setAssigning] = useState(false)
  const [alertInfo, setAlertInfo] = useState(null)
  const [assignDate, setAssignDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [selectedWorkouts, setSelectedWorkouts] = useState([])
  const [assignStep, setAssignStep] = useState(1)
  const [previewWorkout, setPreviewWorkout] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    async function fetchW() {
      const { data } = await supabase.from('workouts').select('id, title, date, sections, created_at').order('created_at', { ascending: false })
      const assignableWorkouts = (data || []).filter(w => {
        const cat = w.sections?.category;
        if (cat === 'Event' || w.sections?.isEvent) return false;
        if (w.sections?.isAutonomous) return false;
        return true;
      })
      setWorkouts(assignableWorkouts)
      setLoading(false)
    }
    fetchW()
  }, [])

  const handleAssign = async () => {
   if (!assignDate) {
      setAlertInfo({ title: 'Errore', message: 'Seleziona una data per l\'assegnazione', type: 'error' })
      return
    }
    if (selectedWorkouts.length === 0) return
    setAssigning(true)
    
    const assignmentsToInsert = selectedWorkouts.map(w => ({
      athlete_id: athleteId,
      workout_id: w.id,
      completed_date: assignDate,
      status: 'pending'
    }))

    const { data: newAssignments, error } = await supabase.from('athlete_workouts').insert(assignmentsToInsert).select('id')

    if (error) {
      setAlertInfo({ title: 'Errore', message: error.message, type: 'error' })
      setAssigning(false)
    } else {
      // Invia la notifica in background, senza bloccare l'interfaccia
      if (newAssignments && newAssignments.length > 0) {
        newAssignments.forEach(na => {
          supabase.functions.invoke('send-reminders', {
            body: { mode: 'immediate', record_id: na.id }
          }).catch(console.error)
        })
      }
      onAssigned()
    }
  }

  const filtered = workouts.filter(w => 
    w.title.toLowerCase().includes(search.toLowerCase()) || 
    (w.sections?.category || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="fixed inset-0 bg-black/85 z-[100] flex items-center justify-center p-4">
      <div className="bg-[#1e1e1e] rounded-3xl w-full max-w-md flex flex-col animate-in fade-in zoom-in-[0.96] duration-300 ease-out" style={{ maxHeight: 'calc(100vh - 100px)' }}>
        <div className="flex items-center justify-between p-5 border-b border-[#2a2a2a]">
          <p className="text-white font-bold text-lg">Assegna Workout</p>
          <button aria-label="Chiudi" onClick={() => { onClose(); setSelectedWorkouts([]); setAssignStep(1); }} className="text-muted hover:text-white"><X size={20} /></button>
        </div>
        {assignStep === 1 ? (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="p-4 border-b border-[#2a2a2a]">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-3.5 text-muted" />
                <input type="text" placeholder="Cerca workout..." value={search} onChange={e => setSearch(e.target.value)} className="w-full bg-[#111] border border-[#333] text-white px-4 py-2.5 pl-9 rounded-xl focus:outline-none focus:border-brand text-base" />
              </div>
            </div>
            <div className="overflow-y-auto flex-1 p-4 flex flex-col gap-2">
              {loading ? (
                <p className="text-muted text-sm text-center py-4">Caricamento...</p>
              ) : filtered.length === 0 ? (
                <p className="text-muted text-sm text-center py-4">Nessun workout trovato.</p>
              ) : (
                <>
                  <div className="flex justify-between items-center mb-1 px-1">
                    <span className="text-gray-400 text-sm">Seleziona workout:</span>
                    <button 
                      onClick={() => setSelectedWorkouts(selectedWorkouts.length === filtered.length ? [] : [...filtered])}
                      className="text-brand text-xs font-semibold hover:underline"
                    >
                      {selectedWorkouts.length === filtered.length ? 'Deseleziona tutti' : 'Seleziona tutti'}
                    </button>
                  </div>
                  {filtered.map(w => {
                    const isSelected = selectedWorkouts.some(sw => sw.id === w.id);
                    return (
                      <div key={w.id} 
                        onClick={() => {
                          if (isSelected) {
                            setSelectedWorkouts(selectedWorkouts.filter(sw => sw.id !== w.id));
                          } else {
                            setSelectedWorkouts([...selectedWorkouts, w]);
                          }
                        }}
                        className={`flex items-center justify-between bg-[#2a2a2a] border p-3 rounded-xl hover:border-brand transition cursor-pointer group ${isSelected ? 'border-brand' : 'border-[#333]'}`}
                      >
                        <div className="flex-1 min-w-0 pr-3 text-left">
                          <p className={`font-semibold text-sm truncate transition ${isSelected ? 'text-brand' : 'text-white group-hover:text-brand'}`}>{w.title}</p>
                          <p className="text-muted text-xs mt-0.5">{w.date && isValid(parseISO(w.date)) ? format(parseISO(w.date), 'dd/MM/yyyy') : 'Data sconosciuta'} • {w.sections?.category || 'Generico'}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button aria-label="Duplica il workout" 
                        onClick={(e) => { e.stopPropagation(); navigate(`/create?duplicate=${w.id}&athlete_id=${athleteId}`); }} 
                        className="p-1.5 bg-[#111] border border-[#333] rounded-lg text-gray-400 hover:text-white hover:border-brand transition"
                        title="Duplica e Modifica"
                      >
                        <Copy size={16} />
                      </button>
                      <button aria-label="Anteprima del workout" 
                            onClick={(e) => { e.stopPropagation(); setPreviewWorkout(w); }} 
                            className="p-1.5 bg-[#111] border border-[#333] rounded-lg text-gray-400 hover:text-white hover:border-brand transition"
                            title="Anteprima"
                          >
                            <Eye size={16} />
                      </button>
                      <div className={`w-6 h-6 rounded-full border flex items-center justify-center ml-1 ${isSelected ? 'bg-brand border-brand' : 'border-[#555] bg-[#111]'}`}>
                            {isSelected && <Check size={14} className="text-black" />}
                        </div>
                    </div>
                  </div>
                  )
                  })}
                </>
              )}
            </div>
            {selectedWorkouts.length > 0 && (
              <div className="p-4 border-t border-[#2a2a2a]">
                <button onClick={() => setAssignStep(2)} className="w-full py-3.5 bg-brand text-black font-bold rounded-xl hover:brightness-110 transition shadow-lg">
                  Procedi ({selectedWorkouts.length})
                </button>
              
            </div>
                        )}

        </div>

        ) : (
          <div className="p-5 flex flex-col gap-4">
            <div>
              <p className="text-gray-400 text-sm mb-1">Stai assegnando:</p>
              <p className="text-white font-bold">{selectedWorkouts.length === 1 ? selectedWorkouts[0].title : `${selectedWorkouts.length} workout selezionati`}</p>
            </div>
            <div>
              <label className="text-gray-400 text-sm mb-2 block">Seleziona la data dell'allenamento</label>
              <CustomDatePicker
                date={assignDate}
                onChange={setAssignDate}
                className="bg-[#111] border border-[#333] rounded-xl px-4 py-3 hover:border-brand w-full text-base"
              />
            </div>
            <div className="flex gap-3 mt-2">
              <button onClick={() => setAssignStep(1)} className="flex-1 py-3 bg-[#2a2a2a] text-white font-semibold rounded-xl hover:bg-[#333] transition disabled:opacity-50">
                Indietro
              </button>
                       <button onClick={handleAssign} disabled={assigning} className="flex-1 py-3 bg-brand text-black font-bold rounded-xl hover:brightness-110 transition disabled:opacity-50">
                {assigning ? 'Assegno...' : 'Conferma'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL ANTEPRIMA WORKOUT */}
      {previewWorkout && (
        <div className="fixed inset-0 bg-black/90 z-[110] flex items-center justify-center p-4">
          <div className="bg-[#1e1e1e] rounded-3xl w-full max-w-md flex flex-col border border-[#333] animate-in fade-in zoom-in-[0.96] duration-300 ease-out" style={{ maxHeight: 'calc(100vh - 40px)' }}>
            <div className="flex items-center justify-between p-5 border-b border-[#2a2a2a]">
              <p className="text-white font-bold text-lg truncate pr-4">{previewWorkout.title}</p>
              <button aria-label="Chiudi l'anteprima" onClick={() => setPreviewWorkout(null)} className="text-muted hover:text-white shrink-0"><X size={20} /></button>
            </div>
            <div className="overflow-y-auto p-5 flex flex-col gap-3">
              {(() => {
                const s = previewWorkout.sections || {};
                const isRun = s.category === 'Running' || s.steps;
                const blocks = s.blocks || [];
                const steps = s.steps || s.main?.steps || [];
                
                if (isRun) {
                  if (steps.length === 0) return <p className="text-muted text-sm">Nessun dettaglio disponibile.</p>;
                  return steps.map((step, i) => (
                    <div key={i} className="bg-[#2a2a2a] p-3 rounded-xl border border-[#383838]">
                      <p className="text-running font-bold text-xs uppercase mb-1">{step.type === 'repeat' ? `Ripetute (${step.rounds}x)` : step.type}</p>
                      {step.type === 'repeat' ? (
                        <div className="text-sm text-white flex flex-col gap-1">
                          <p><span className="text-gray-400">Corsa:</span> {step.runDuration} {step.runPace ? <span className="text-muted text-xs">@{step.runPace}</span> : ''}</p>
                          <p><span className="text-gray-400">Recupero:</span> {step.recDuration} {step.recPace ? <span className="text-muted text-xs">@{step.recPace}</span> : ''}</p>
                        </div>
                      ) : (
                        <p className="text-sm text-white">{step.duration} {step.pace ? <span className="text-muted text-xs ml-1">@{step.pace}</span> : ''}</p>
                      )}
                      {step.notes && <p className="text-gray-400 text-xs mt-1.5 italic">"{step.notes}"</p>}
                    </div>
                  ));
                } else {
                  if (blocks.length === 0) return <p className="text-muted text-sm">Nessun dettaglio disponibile.</p>;
                  return blocks.map((b, i) => {
                    let shortTitle = b.type;
                    if (b.type === 'EMOM') shortTitle = `EMOM ${b.params?.rounds ? b.params.rounds + 'x' : ''}`;
                    else if (b.type === 'AMRAP') shortTitle = `AMRAP ${b.params?.duration || ''}`;
                    else if (b.type === 'ON/OFF') shortTitle = `ON/OFF ${b.params?.rounds ? b.params.rounds + 'x ' : ''}• ${b.params?.on || ''}/${b.params?.off || ''}`;
                    else if (b.type === 'For Time') shortTitle = `FOR TIME ${b.params?.rounds ? b.params.rounds + 'x' : ''}`;
                                       else if (b.type === 'Interval') shortTitle = `INTERVAL ${b.params?.rounds ? b.params.rounds + 'x' : ''}`;

                    else if (b.type === 'WarmUp') shortTitle = `WARM UP ${b.params?.duration ? '• ' + b.params.duration : ''}`;
                    else if (b.type === 'Rest') shortTitle = `REST ${b.params?.duration ? '• ' + b.params.duration : ''}`;
                    else if (b.type === 'Cash In' || b.type === 'Cash Out') shortTitle = b.type.toUpperCase();

                    return (
                      <div key={i} className="bg-[#2a2a2a] p-3 rounded-xl border border-[#383838]">
                        <p className="text-brand font-bold text-xs uppercase mb-1.5">{shortTitle}</p>
                        {['WarmUp', 'Rest'].includes(b.type) ? (
                          b.notes && <p className="text-sm text-gray-300">{b.notes}</p>
                        ) : (
                          <div className="flex flex-col gap-1.5">
                            {(b.exercises || []).map((ex, j) => {
                              const detail = ex.exTime && ex.exTime !== '-' ? ex.exTime : ((ex.meters && ex.meters !== '-') ? ex.meters : (ex.reps && ex.reps !== '-' ? `${ex.reps} reps` : ''));
                              const pace = ex.ergoPace && ex.ergoPace !== '-' && ex.ergoPace !== 'Libero' ? `@ ${ex.ergoPace}` : '';
                              return (
                                <p key={j} className="text-sm text-white leading-tight">
                                  <span className="font-medium">{ex.name}</span>
                                  {(detail || pace || ex.kg) && (
                                    <span className="text-gray-400 text-xs ml-1">
                                      {detail} {pace} {ex.kg ? `· ${ex.kg}kg` : ''}
                                    </span>
                                  )}
                                </p>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  });
                }
              })()}
            </div>
            <div className="p-4 border-t border-[#2a2a2a] flex flex-col gap-2">
              <button 
                onClick={() => {
                  const isAlreadySelected = selectedWorkouts.some(sw => sw.id === previewWorkout.id);
                  if (!isAlreadySelected) setSelectedWorkouts([...selectedWorkouts, previewWorkout]);
                  setPreviewWorkout(null);
                }}
                className="w-full py-3 bg-brand text-black font-bold rounded-xl hover:brightness-110 transition shadow-lg shadow-brand/20"
              >
                Seleziona questo Workout
              </button>
              <button 
                onClick={() => {
                  navigate(`/create?duplicate=${previewWorkout.id}&athlete_id=${athleteId}`);
                  setPreviewWorkout(null);
                }}
                className="w-full py-3 bg-[#2a2a2a] border border-[#383838] text-white font-bold rounded-xl hover:border-brand hover:text-brand transition flex items-center justify-center gap-2"
              >
                <Copy size={18} /> Duplica e Modifica
              </button>
            </div>
          </div>
        </div>
      )}

      {alertInfo && <CustomAlert info={alertInfo} onClose={() => setAlertInfo(null)} />}
    </div>
  )
}
