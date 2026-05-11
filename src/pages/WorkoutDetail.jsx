import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
// TOGLI Share2, metti Share2
import { ChevronLeft, Download, Share2, Timer, Flag, FlagOff, Dumbbell, Users, X, User, Send, Edit, Trash2, AlertTriangle, Check, BicepsFlexed, Copy, CheckCircle2, Circle } from 'lucide-react'
import { format, parseISO, isValid, isBefore, startOfDay } from 'date-fns'
import { it } from 'date-fns/locale'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { CustomAlert, CustomConfirm } from '../components/CustomModals'
import CustomDatePicker from '../components/CustomDatePicker'
import { useAuth } from '../App'

const TYPE_COLORS = {
  'WarmUp': { text: 'text-gray-400', bg: 'bg-[#2a2a2a]', border: 'border-[#383838]', hex: '#9ca3af' },
  'Rest': { text: 'text-gray-500', bg: 'bg-[#1e1e1e]', border: 'border-[#2a2a2a]', hex: '#6b7280' },
  'Cash In': { text: 'text-gray-300', bg: 'bg-[#222]', border: 'border-[#444]', hex: '#d1d5db' },
  'Cash Out': { text: 'text-gray-300', bg: 'bg-[#222]', border: 'border-[#444]', hex: '#d1d5db' },
  'ON/OFF': { text: 'text-gray-200', bg: 'bg-[#222]', border: 'border-[#333]', hex: '#e5e5e5' },
  EMOM: { text: 'text-gray-200', bg: 'bg-[#222]', border: 'border-[#333]', hex: '#e5e5e5' },
  AMRAP: { text: 'text-gray-200', bg: 'bg-[#222]', border: 'border-[#333]', hex: '#e5e5e5' },
  'For Time': { text: 'text-gray-200', bg: 'bg-[#222]', border: 'border-[#333]', hex: '#e5e5e5' },
   'Running': { text: 'text-[#0094C6]', bg: 'bg-[#0094C6]/10', border: 'border-[#0094C6]/30', hex: '#0094C6' },
  'Custom': { text: 'text-[#D11149]', bg: 'bg-[#D11149]/10', border: 'border-[#D11149]/30', hex: '#D11149' }

}
const getIntensityColor = (val) => {
  const num = parseInt(val, 10);
  if (isNaN(num)) return 'text-gray-500';
  if (num <= 3) return 'text-green-400';
  if (num <= 6) return 'text-yellow-400';
  if (num <= 8) return 'text-orange-500';
  return 'text-red-500';
}

const getPdfIntensityColor = (val) => {
  const num = parseInt(val, 10);
  if (isNaN(num)) return [156, 163, 175];
  if (num <= 3) return [74, 222, 128];
  if (num <= 6) return [250, 204, 21];
  if (num <= 8) return [249, 115, 22];
  return [239, 68, 68];
}

const timeToSeconds = (timeStr) => {
  if (!timeStr) return 0;
  const str = String(timeStr);
  const parts = str.split(':')
  if (parts.length === 2) return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10)
  return 0
}
const formatTime = (totalSeconds) => {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  if (s === 0) return `${m} min`
  return `${m}:${s.toString().padStart(2, '0')} min`
}

const getNormalizedBlocks = (workout) => {
  const s = workout.sections || {}
  if (s.blocks) return s.blocks
  
  const blocks = []
  if (s.warmup) blocks.push({ id: 'w', type: 'WarmUp', params: { duration: s.warmup.duration }, notes: s.warmup.notes })
  if (s.cashIn?.length > 0) blocks.push({ id: 'ci', type: 'Cash In', exercises: s.cashIn })
  if (s.main && s.main.type !== 'Running') {
    blocks.push({
      id: 'm',
      type: s.main.type === 'EMOM' && s.main.params?.on ? 'ON/OFF' : s.main.type,
      params: s.main.params || {},
      exercises: s.main.exercises || []
    })
  }
  if (s.cashOut?.length > 0) blocks.push({ id: 'co', type: 'Cash Out', exercises: s.cashOut })
  return blocks
}

const getBlockTitle = (block) => {
  const formatVal = v => (v && !v.includes('min') && !v.includes('sec')) ? `${v} min` : (v || '1:00 min')

  if (['WarmUp', 'Rest'].includes(block.type)) return block.type
  if (block.type === 'ON/OFF') {
    const onSec = timeToSeconds(block.params?.on || '1:00') || 60
    const offSec = timeToSeconds(block.params?.off || '1:00') || 60
    let rounds = parseInt(block.params?.rounds, 10)
    if (isNaN(rounds) && block.params?.total) {
      rounds = Math.ceil(timeToSeconds(block.params.total) / (onSec + offSec))
    }
    rounds = rounds || 10
    return `ON/OFF · ${formatVal(block.params?.on)} ON / ${formatVal(block.params?.off)} OFF · ${rounds} rounds · ${formatTime((onSec + offSec) * rounds)}`
  }
  if (block.type === 'EMOM') {
    const intervalSec = timeToSeconds(block.params?.interval || '1:00') || 60
    const rounds = parseInt(block.params?.rounds || '10', 10) || 10
    return `EMOM · ${formatVal(block.params?.interval)} x ${rounds} rounds · ${formatTime(intervalSec * rounds)}`
  }
  if (block.type === 'AMRAP') {
     const dur = block.params?.duration || '10:00'
     return dur.includes('min') ? `AMRAP · ${dur}` : `AMRAP · ${dur} min`
  }
  if (block.type === 'For Time') return `For Time · ${block.params?.rounds || '3'} rounds`
  if (['Cash In', 'Cash Out'].includes(block.type)) {
    const rounds = block.params?.rounds || '1'
    return rounds !== '1' ? `${block.type} · ${rounds} rounds` : block.type
  }
  return block.type
}

const getEmojiDataURL = (emoji) => {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, 64, 64)
  ctx.font = '48px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(emoji, 32, 36)
  return canvas.toDataURL('image/png')
}


const ERGOMETERS = ['SkiErg', 'Rowing', 'Assault Bike', 'Echo Bike', 'TrueForm Runner', 'Curve Treadmill']
const isErgo = (name) => ERGOMETERS.includes(name)

const SLED_EXERCISES = ['Sled Push', 'Sled Pull', 'Prowler Push', 'Sled Drag']
const isSled = (name) => SLED_EXERCISES.includes(name)
const DISTANCE_EXERCISES = [
  'Farmers Carry', 'Farmers Walk', 'Suitcase Carry', 'Sandbag Carry', 'Yoke Carry', 
  "Waiter's Walk", 'Handstand Walk', 'Run', 'Bear Crawl', 'Shuttle Run', 'Swim'
]
const isDistance = (name) => isErgo(name) || isSled(name) || DISTANCE_EXERCISES.includes(name)

export default function WorkoutDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const queryAthleteId = searchParams.get('athlete_id')
  const { role, user } = useAuth()
  const isOwnProfile = queryAthleteId === user?.id

  const [workout, setWorkout] = useState(null)
  const [loading, setLoading] = useState(true)
  const igRef = useRef(null)

  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [athletes, setAthletes] = useState([])
  const [assigning, setAssigning] = useState(false)
  const [athleteNote, setAthleteNote] = useState(null)
  const [editingNote, setEditingNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [alertInfo, setAlertInfo] = useState(null)
  const [confirmInfo, setConfirmInfo] = useState(null)
  const [assignDate, setAssignDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [athleteWorkoutId, setAthleteWorkoutId] = useState(null)
  const [workoutStatus, setWorkoutStatus] = useState('pending')
  const [selectedAthleteForAssign, setSelectedAthleteForAssign] = useState(null)
  const [assignments, setAssignments] = useState([])
  useEffect(() => { fetchWorkout() }, [id])

  // Carica la lista atleti solo quando si apre il modal per la prima volta
  useEffect(() => {
    if (assignModalOpen && athletes.length === 0) {
      fetchAthletes()
    }
  }, [assignModalOpen])

  const fetchWorkout = async () => {
    const { data, error } = await supabase.from('workouts').select('*').eq('id', id).single()
    if (error) console.error('ERRORE:', error)

    let finalWorkout = { ...data }

    if (queryAthleteId && data) {
      const { data: awData } = await supabase.from('athlete_workouts')
        .select('id, notes, status, completed_date, athletes(name, surname)')
        .eq('workout_id', data.id)
        .eq('athlete_id', queryAthleteId)
        .order('completed_date', { ascending: false })
        .limit(1)
        
      if (awData && awData.length > 0) {
        setAthleteWorkoutId(awData[0].id)
        setWorkoutStatus(awData[0].status)
        if (awData[0].notes) {
          setAthleteNote({ text: awData[0].notes, athleteName: `${awData[0].athletes.name} ${awData[0].athletes.surname}` })
        }
        setEditingNote(awData[0].notes || '')
        finalWorkout.date = awData[0].completed_date
      }
    }

    if (role !== 'athlete' && data) {
      const { data: allAwData } = await supabase.from('athlete_workouts')
        .select('id, completed_date, status, notes, athletes(id, name, surname, photo_url)')
        .eq('workout_id', data.id)
        .order('completed_date', { ascending: false })
      if (allAwData) setAssignments(allAwData)
    }

    setWorkout(finalWorkout)
    setLoading(false)
  }

  const toggleStatus = async () => {
    if (!athleteWorkoutId) return
    const doToggle = async () => {
      const newStatus = workoutStatus === 'completed' ? 'pending' : 'completed'
      setWorkoutStatus(newStatus)
      const { error } = await supabase.from('athlete_workouts').update({ status: newStatus }).eq('id', athleteWorkoutId)
      if (error) {
        setAlertInfo({ title: 'Errore', message: "Impossibile aggiornare lo stato", type: 'error' })
        setWorkoutStatus(workoutStatus) // ripristina in caso di errore
      }
    }

    if (workoutStatus !== 'completed' && workout?.date) {
      const scheduledDate = startOfDay(parseISO(workout.date))
      const today = startOfDay(new Date())
      if (isBefore(today, scheduledDate)) {
        setConfirmInfo({
          title: 'Attenzione',
          message: 'Questo allenamento è programmato per una data futura. Vuoi davvero segnarlo come completato oggi?',
          onConfirm: () => { doToggle(); setConfirmInfo(null); }
        })
        return
      }
    }
    doToggle()
  }

  const fetchAthletes = async () => {
    const { data } = await supabase.from('athletes').select('id, name, surname, photo_url').order('name')
    const COACHING_ID = '0118e43f-8791-4fd6-8032-bee028334c99'
    setAthletes((data || []).filter(a => a.id !== COACHING_ID))
  }

  const handleAssign = async (athleteId) => {
    if (!assignDate) {
      setAlertInfo({ title: 'Errore', message: 'Inserisci la data di assegnazione.', type: 'error' })
      return
    }
    setAssigning(true)
    const { error } = await supabase.from('athlete_workouts').insert({
      athlete_id: athleteId,
      workout_id: workout.id,
      completed_date: assignDate,
      status: 'pending'
    })
    
    setAssigning(false)
    if (error) {
      setAlertInfo({ title: 'Errore', message: "Errore durante l'assegnazione: " + error.message, type: 'error' })
    } else {
      setAssignModalOpen(false)
      setShowSuccessModal(true)
      fetchWorkout()
    }
  }

  const handleDeleteWorkout = async () => {
    setDeleting(true)
    const { error } = await supabase.from('workouts').delete().eq('id', id)
    setDeleting(false)
    if (error) {
      setAlertInfo({ title: 'Errore', message: "Errore durante l'eliminazione: " + error.message, type: 'error' })
    } else {
      navigate(-1)
    }
  }

  const buildPDFDoc = async () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const s = workout.sections
    const rawCat = s?.category || (s?.main?.type === 'Running' || s?.steps ? 'Running' : 'Hyrox')
    const category = (rawCat === 'Autonomo' || rawCat === 'Custom') ? 'Custom' : rawCat
    const isRunning = category === 'Running'
    const type = category === 'Custom' ? 'Custom' : (isRunning ? 'Running' : 'Hyrox')
    let y = 20

    // Header
    doc.setFillColor(23, 23, 23)
    doc.rect(0, 0, 210, 297, 'F')
    
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(255, 255, 255)
    doc.text('FLEO', 20, y)
    const fleoWidth = doc.getTextWidth('FLEO')
    doc.setTextColor(241, 186, 23)
    doc.text('FIT', 20 + fleoWidth, y)
    
    const fitWidth = doc.getTextWidth('FIT')
    doc.setTextColor(150, 150, 150)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'normal')
    doc.text(' - Coach Federico Leo', 20 + fleoWidth + fitWidth, y)

    y += 8
    doc.setTextColor(200, 200, 200)
    doc.setFontSize(14)
    doc.text(workout.title, 20, y)
    y += 6
    doc.setFontSize(10)
    doc.setTextColor(120, 120, 120)
    doc.text(workout.date && isValid(parseISO(workout.date)) ? format(parseISO(workout.date), 'EEEE d MMMM yyyy', { locale: it }) : 'Data sconosciuta', 20, y)
    y += 10

    // Tipo badge
    doc.setFontSize(11)
    if (type === 'Running') {
      doc.setTextColor(0, 148, 198)
    } else if (type === 'Custom') {
      doc.setTextColor(209, 17, 73)
    } else {
      doc.setTextColor(241, 186, 23)
    }
    doc.setFont('helvetica', 'bold')
    doc.text(`[ ${type.toUpperCase()} ]`, 20, y)
    
    y += 6

    if (s?.intensity) {
      if (type === 'Running') {
        doc.setTextColor(0, 148, 198)
      } else if (type === 'Custom') {
        doc.setTextColor(209, 17, 73)
      } else {
        doc.setTextColor(241, 186, 23)
      }
      doc.setFont('helvetica', 'bold')
      doc.text('INTENSITA\': ', 20, y)
      doc.setTextColor(...getPdfIntensityColor(s.intensity))
      doc.setFont('helvetica', 'normal')
      const intTxt = `${s.intensity} / 10 `
      doc.text(intTxt, 45, y)
      doc.addImage(getEmojiDataURL('💪'), 'PNG', 45 + doc.getTextWidth(intTxt), y - 3.2, 4, 4)
      y += 6
    }
    
    y += 2

    // Divider
    doc.setDrawColor(60, 60, 60)
    doc.line(20, y, 190, y)
    y += 8

    
    if (type === 'Running') {
           doc.setTextColor(150, 150, 150)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.text('ALLENAMENTO CORSA', 20, y)
      y += 6
      
      const steps = s?.steps || s?.main?.steps || []
      steps.forEach((step, i) => {
        doc.setTextColor(180, 180, 180)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        
        const typeLabels = { warmup: 'Riscaldamento', run: 'Corsa', recover: 'Recupero', cooldown: 'Defaticamento', repeat: 'Ripetute' }
        doc.text(`· ${typeLabels[step.type] || ''}${step.type === 'repeat' ? ` x${step.rounds}` : ''}`, 25, y)
        y += 5
        
        doc.setFont('helvetica', 'normal')
        if (step.type === 'repeat') {
           doc.setTextColor(200, 200, 200)
           let cx = 30
           let r1 = `  Corsa: ${step.runDuration} ${step.runPace ? '@'+step.runPace : ''}`
           doc.text(r1, cx, y)
           cx += doc.getTextWidth(r1)
           if (step.runIntensity) {
             let itxt = `   [Int: ${step.runIntensity}/10 `
             doc.setTextColor(...getPdfIntensityColor(step.runIntensity))
             doc.text(itxt, cx, y)
             cx += doc.getTextWidth(itxt)
             doc.addImage(getEmojiDataURL('💪'), 'PNG', cx, y - 3.2, 4, 4)
             cx += 4.5
             doc.text(']', cx, y)
             doc.setTextColor(200, 200, 200)
           }
           y += 5
           
           cx = 30
           let r2 = `  Recupero: ${step.recDuration} ${step.recPace ? '@'+step.recPace : ''}`
           doc.text(r2, cx, y)
           cx += doc.getTextWidth(r2)
           if (step.recIntensity) {
             let itxt = `   [Int: ${step.recIntensity}/10 `
             doc.setTextColor(...getPdfIntensityColor(step.recIntensity))
             doc.text(itxt, cx, y)
             cx += doc.getTextWidth(itxt)
             doc.addImage(getEmojiDataURL('💪'), 'PNG', cx, y - 3.2, 4, 4)
             cx += 4.5
             doc.text(']', cx, y)
             doc.setTextColor(200, 200, 200)
           }
           y += 5

           if (step.notes) {
             doc.setTextColor(180, 180, 180)
             doc.setFont('helvetica', 'normal')
             doc.setFontSize(9)
             doc.text(`  Note: ${step.notes}`, 30, y)
             y += 5
           }
        } else {
           doc.setTextColor(200, 200, 200)
           let cx = 30
           let r1 = `  ${step.duration || ''} ${step.pace ? '@'+step.pace : ''}`
           doc.text(r1, cx, y)
           cx += doc.getTextWidth(r1)
           
           if (step.intensity) {
             let itxt = `   [Int: ${step.intensity}/10 `
             doc.setTextColor(...getPdfIntensityColor(step.intensity))
             doc.text(itxt, cx, y)
             cx += doc.getTextWidth(itxt)
             doc.addImage(getEmojiDataURL('💪'), 'PNG', cx, y - 3.2, 4, 4)
             cx += 4.5
             doc.text(']', cx, y)
             cx += doc.getTextWidth(']')
             doc.setTextColor(200, 200, 200)
           }
           if (step.notes) {
             doc.text(`  (${step.notes})`, cx, y)
           }
           y += 5
        }
        y += 2
        if (y > 260) { doc.addPage(); y = 20 }
      })
    } else {
      const blocks = getNormalizedBlocks(workout)
      blocks.forEach(block => {
        doc.setTextColor(150, 150, 150)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(11)
        doc.text(getBlockTitle(block), 20, y)
        y += 6

        if (['WarmUp', 'Rest'].includes(block.type)) {
           doc.setTextColor(120, 120, 120)
           doc.setFont('helvetica', 'normal')
           doc.setFontSize(10)
           doc.text(`  ${block.params?.duration || ''}${block.notes ? ' · ' + block.notes : ''}`, 20, y)
           y += 8
        } else {
           (block.exercises || []).forEach((ex, i) => {
             doc.setTextColor(200, 200, 200)
             doc.setFont('helvetica', 'normal')
             doc.setFontSize(10)
             const prefix = (block.type === 'EMOM' || block.type === 'ON/OFF') ? `Min.${i + 1}  ` : `· `
             const detail = isDistance(ex.name) ? (ex.meters && ex.meters !== '-' ? ex.meters : '') : (ex.reps && ex.reps !== '-' ? `${ex.reps} reps` : '')
             const paceStr = isErgo(ex.name) && ex.ergoPace && ex.ergoPace !== '-' && ex.ergoPace !== 'Libero' ? ` @ ${ex.ergoPace}` : ''
             const kgStr = ex.kg ? ` @ ${ex.kg}kg` : ''
             
             let cx = 25
             let baseStr = `${prefix}${ex.name}  ${detail}${paceStr}${kgStr}`
             doc.text(baseStr, cx, y)
             cx += doc.getTextWidth(baseStr)

             if (ex.intensity) {
               let itxt = `   [Int: ${ex.intensity}/10 `
               doc.setTextColor(...getPdfIntensityColor(ex.intensity))
               doc.text(itxt, cx, y)
               cx += doc.getTextWidth(itxt)
               doc.addImage(getEmojiDataURL('💪'), 'PNG', cx, y - 3.2, 4, 4)
               cx += 4.5
               doc.text(']', cx, y)
               cx += doc.getTextWidth(']')
               doc.setTextColor(200, 200, 200)
             }
             if (ex.notes) {
               doc.text(`  (${ex.notes})`, cx, y)
             }
             y += 6
             if (y > 260) { doc.addPage(); y = 20 }
           })
           y += 2
        }
      })
    }

    // Note coach
    if (workout.coach_notes) {
      doc.setDrawColor(60, 60, 60)
      doc.line(20, y, 190, y)
      y += 6
      doc.setTextColor(241, 186, 23)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.text('NOTE COACH', 20, y)
      y += 6
      doc.setTextColor(200, 200, 200)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      const lines = doc.splitTextToSize(workout.coach_notes, 165)
      doc.text(lines, 20, y)
      y += lines.length * 5 + 6
    }

    // Glossario fisso in fondo
    const glossaryY = 240
    doc.setDrawColor(60, 60, 60)
    doc.line(20, glossaryY, 190, glossaryY)
    doc.setTextColor(100, 100, 100)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text('GLOSSARIO', 20, glossaryY + 6)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text('EMOM (Every Minute On the Minute): All\'inizio di ogni minuto devi eseguire le ripetizioni indicate. Il tempo che ti avanza prima dello scoccare del minuto successivo è il tuo recupero.', 20, glossaryY + 12, { maxWidth: 170 })
    doc.text('AMRAP (As Many Rounds/Reps As Possible): Esegui il maggior numero di giri (o ripetizioni) possibili del circuito nel tempo prestabilito. L\'obiettivo è mantenere un ritmo costante.', 20, glossaryY + 18, { maxWidth: 170 })
    doc.text('ON / OFF (Lavoro / Recupero): Allenamento a intervalli. Indica i secondi di lavoro attivo seguiti da quelli di riposo. Esempio: "40 ON / 20 OFF" significa che devi eseguire l\'esercizio per 40 sec e riposare per 20.', 20, glossaryY + 24, { maxWidth: 170 })
    doc.text('FOR TIME: Completa tutto il circuito o l\'allenamento prescritto nel minor tempo possibile. Il cronometro è il tuo avversario, ma ricordati di mantenere sempre un\'esecuzione tecnica corretta!', 20, glossaryY + 32, { maxWidth: 170 })
  
    return doc
  }

  const exportPDF = async () => {
    const doc = await buildPDFDoc()
    doc.save(`${workout.title.replace(/ /g, '_')}.pdf`)
  }

  const exportShare2 = async () => {
    if (!igRef.current) return
    const canvas = await html2canvas(igRef.current, {
      backgroundColor: 'transparent',
      scale: 3,
      useCORS: true
    })
    const link = document.createElement('a')
    link.download = `${workout.title.replace(/ /g, '_')}_Share2.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  const shareWorkoutFiles = async () => {
    if (!igRef.current) return
    try {
      // 1. Genera PDF in memoria
      const doc = await buildPDFDoc()
      const pdfBlob = doc.output('blob')
      const pdfFile = new File([pdfBlob], `${workout.title.replace(/ /g, '_')}.pdf`, { type: 'application/pdf' })

      // 2. Genera Immagine in memoria
      const canvas = await html2canvas(igRef.current, {
        backgroundColor: 'transparent',
        scale: 3,
        useCORS: true
      })
      const pngFile = await new Promise(resolve => {
        canvas.toBlob(blob => {
          resolve(new File([blob], `${workout.title.replace(/ /g, '_')}.png`, { type: 'image/png' }))
        }, 'image/png')
      })

      const filesArray = [pdfFile, pngFile]

      // 3. Usa lo Share nativo di iOS / Android
      if (navigator.canShare && navigator.canShare({ files: filesArray })) {
        await navigator.share({
          files: filesArray,
          title: workout.title,
          text: `Ecco il tuo workout: ${workout.title}`
        })
      } else {
        setAlertInfo({ title: 'Non supportato', message: 'Il tuo dispositivo o browser non supporta la condivisione diretta di più file. Usa i tasti di esportazione classici.', type: 'error' })
      }
    } catch (error) {
      console.error('Errore durante la condivisione:', error)
    }
  }

  if (loading) return <div className="p-6 text-gray-500">Caricamento...</div>
  if (!workout) return <div className="p-6 text-red-400">Workout non trovato</div>

  const s = workout.sections
  const rawCat = s?.category || (s?.main?.type === 'Running' || s?.steps ? 'Running' : 'Hyrox')
  const category = (rawCat === 'Autonomo' || rawCat === 'Custom') ? 'Custom' : rawCat
  const isRunning = category === 'Running'
  const blocks = getNormalizedBlocks(workout)
  const mainBlock = blocks.find(b => ['EMOM', 'ON/OFF', 'AMRAP', 'For Time'].includes(b.type)) || blocks[0] || { type: 'Hyrox' }
  const type = category === 'Custom' ? 'Custom' : (isRunning ? 'Running' : mainBlock.type)
  const c = TYPE_COLORS[type] || TYPE_COLORS['Hyrox'] || { text: 'text-gray-200', bg: 'bg-[#222]', border: 'border-[#333]', hex: '#e5e5e5' }

  const getIconForType = (t) => {
    if (t === 'WarmUp' || t === 'Rest') return <Timer size={16} className={TYPE_COLORS[t]?.text} />
    if (t === 'Cash In') return <Flag size={16} className={TYPE_COLORS[t]?.text} />
    if (t === 'Cash Out') return <FlagOff size={16} className={TYPE_COLORS[t]?.text} />
    return <Dumbbell size={16} className={TYPE_COLORS[t]?.text} />
  }

  return (
    <div className="p-4 max-w-2xl mx-auto pb-24 page-transition">
      <div className="mb-6 mt-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-10 h-10 bg-[#1e1e1e] border border-[#333] rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:border-[#f1ba17] transition shadow-sm shrink-0">
          <ChevronLeft size={22} className="-ml-0.5" />
        </button>
        <h1 className="text-3xl font-black text-white tracking-tight">FLEO<span className="text-[#f1ba17]">FIT</span></h1>
      </div>

      {/* HEADER */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">{workout.title}</h1>
            <p className="text-gray-500 text-sm mt-1 capitalize">
              {workout.date && isValid(parseISO(workout.date)) ? format(parseISO(workout.date), 'EEEE d MMMM yyyy', { locale: it }) : 'Data sconosciuta'}
            </p>
          </div>
          {role !== 'athlete' && (
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                {workout.sections?.intensity && (
                  <div className="flex items-center gap-1 bg-[#2a2a2a] border border-[#383838] px-2 py-1 rounded-lg">
                    <span className={`text-xs font-bold ${getIntensityColor(workout.sections.intensity)}`}>
                      {workout.sections.intensity}/10
                    </span>
                    <BicepsFlexed size={14} className={getIntensityColor(workout.sections.intensity)} />
                  </div>
                )}
                <span className={`text-xs font-bold px-3 py-1.5 rounded-xl shrink-0 ${c.bg} ${c.text} border ${c.border}`}>
                  {type}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => navigate(`/create?duplicate=${id}`)} className="text-gray-400 hover:text-white text-xs flex items-center gap-1 transition bg-[#2a2a2a] border border-[#383838] px-2 py-1 rounded-lg" title="Duplica Workout">
                  <Copy size={12} /> Duplica
                </button>
                <button onClick={() => navigate(`/create?edit=${id}${athleteWorkoutId ? `&aw_id=${athleteWorkoutId}` : ''}${queryAthleteId ? `&athlete_id=${queryAthleteId}` : ''}`)} className="text-gray-400 hover:text-white text-xs flex items-center gap-1 transition bg-[#2a2a2a] border border-[#383838] px-2 py-1 rounded-lg">
                  <Edit size={12} /> Modifica
                </button>
                <button onClick={() => setShowDeleteConfirm(true)} className="text-gray-400 hover:text-red-400 text-xs flex items-center gap-1 transition bg-[#2a2a2a] border border-[#383838] px-2 py-1 rounded-lg">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          )}
        </div>
        {(role === 'athlete' || isOwnProfile) && athleteWorkoutId && (
      
          <button
            onClick={toggleStatus}
            className={`w-full mt-5 py-3.5 rounded-2xl flex items-center justify-center gap-2 text-base font-bold transition border shadow-lg ${
              workoutStatus === 'completed' 
                ? 'bg-green-500 text-black border-green-500 hover:brightness-110 shadow-green-500/20' 
                : 'bg-[#2a2a2a] border-[#383838] text-white hover:border-[#f1ba17] hover:text-[#f1ba17]'
            }`}
          >
            {workoutStatus === 'completed' ? <CheckCircle2 size={20} /> : <Circle size={20} />} 
            {workoutStatus === 'completed' ? 'Allenamento Completato!' : 'Segna come completato'}
          </button>
        )}
      </div>

      {/* BLOCKS */}
      {!isRunning && type !== 'Custom' ? (
        blocks.map((block, idx) => (
          <Section key={block.id || idx} icon={getIconForType(block.type)} label={getBlockTitle(block)} color={TYPE_COLORS[block.type]?.border}>
             {['WarmUp', 'Rest'].includes(block.type) ? (
               <p className="text-gray-300 text-sm">{block.params?.duration} {block.notes ? ` · ${block.notes}` : ''}</p>
             ) : (
               <ExList exercises={block.exercises || []} showMinute={block.type === 'EMOM' || block.type === 'ON/OFF'} typeColor={TYPE_COLORS[block.type]?.text} />
             )}
          </Section>
        ))
      ) : isRunning ? (
         <Section icon={<Timer size={16} className={c.text} />} label="Allenamento Corsa" color={c.border}>
           <RunningList steps={s?.steps || s?.main?.steps || []} />
         </Section>
      ) : null}

      {/* NOTE COACH */}
      {workout.coach_notes && (
        <Section icon={<span className="text-[#f1ba17] text-sm">📋</span>} label="Note Coach" color="border-[#f1ba17]/40">
          <p className="text-gray-300 text-sm leading-relaxed">{workout.coach_notes}</p>
        </Section>
      )}

      {/* NOTE ATLETA */}
      {(role === 'athlete' || isOwnProfile) && athleteWorkoutId ? (
        <Section icon={<User size={16} className="text-[#3b82f6]" />} label={`Le tue note su questo allenamento`} color="border-[#3b82f6]/40">
          <textarea
            className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-gray-500 focus:outline-none resize-none text-sm transition-colors focus:border-[#3b82f6]"
            rows={3}
            placeholder="Com'è andata? Segna qui i tuoi pesi, i tempi o come ti sei sentito..."
            value={editingNote}
            onChange={(e) => setEditingNote(e.target.value)}
          />
          {editingNote !== (athleteNote?.text || '') && (
            <div className="mt-2 flex justify-end">
              <button
                onClick={async () => {
                  setSavingNote(true)
                  const { error } = await supabase.from('athlete_workouts').update({ notes: editingNote }).eq('id', athleteWorkoutId)
                  setSavingNote(false)
                  if (!error) {
                     setAthleteNote({ text: editingNote, athleteName: athleteNote?.athleteName || '' })
                  } else {
                     setAlertInfo({ title: 'Errore', message: error.message, type: 'error' })
                  }
                }}
                disabled={savingNote}
                className="font-bold px-4 py-1.5 rounded-xl text-sm hover:brightness-110 transition disabled:opacity-50 bg-[#3b82f6] text-white"
              >
                {savingNote ? 'Salvataggio...' : 'Conferma note'}
              </button>
            </div>
          )}
        </Section>
      ) : athleteNote ? (
        <Section icon={<User size={16} className="text-[#3b82f6]" />} label={`Note Atleta (${athleteNote.athleteName})`} color="border-[#3b82f6]/40">
          <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{athleteNote.text}</p>
        </Section>
      ) : null}

      {/* ASSEGNAZIONI ATLETI (SOLO COACH) */}
      {role !== 'athlete' && assignments.length > 0 && (
        <div className="mb-6 mt-2">
          <h2 className="text-white font-bold text-lg mb-3 flex items-center gap-2">
            <Users size={20} className="text-[#f1ba17]" />
            Assegnato a {assignments.length} atleti
          </h2>
          <div className="flex flex-col gap-3">
            {assignments.map(a => (
              <div key={a.id} onClick={() => navigate(`/athletes/${a.athletes?.id}`)} className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-2xl p-4 cursor-pointer hover:border-[#f1ba17] transition">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#2a2a2a] flex items-center justify-center overflow-hidden shrink-0 border border-[#333]">
                      {a.athletes?.photo_url ? (
                        <img src={a.athletes.photo_url} alt={a.athletes?.name} className="w-full h-full object-cover" onError={(e) => e.target.style.opacity = 0} />
                      ) : (
                        <User size={18} className="text-gray-500" />
                      )}
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm">{a.athletes?.name} {a.athletes?.surname}</p>
                      <p className="text-gray-500 text-xs capitalize">{format(parseISO(a.completed_date), 'EEEE d MMMM yyyy', { locale: it })}</p>
                    </div>
                  </div>
                  <div className={`px-2 py-1 rounded-md border text-xs font-bold ${a.status === 'completed' ? 'bg-green-500/10 text-green-500 border-green-500/30' : 'bg-[#111] text-gray-500 border-[#333]'}`}>
                    {a.status === 'completed' ? 'Fatto' : 'Da fare'}
                  </div>
                </div>
                {a.notes && (
                  <div className="mt-3 p-3 bg-[#111] rounded-xl border border-[#333]">
                    <p className="text-gray-400 text-sm italic">"{a.notes}"</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* EXPORT BUTTONS */}
      <div className="flex gap-3 mt-6">
        <button onClick={exportPDF}
          className="flex-1 flex items-center justify-center gap-2 bg-[#222] border border-[#333] text-white font-semibold py-4 rounded-2xl hover:border-[#f1ba17] hover:text-[#f1ba17] transition">
          <Download size={18} /> Esporta PDF
        </button>
        <button onClick={exportShare2}
          className="flex-1 flex items-center justify-center gap-2 bg-[#222] border border-[#333] text-white font-semibold py-4 rounded-2xl hover:border-pink-500 hover:text-pink-400 transition">
          <Share2 size={18} /> Grafica IG
        </button>
      </div>

      <div className="mt-3">
        <button onClick={shareWorkoutFiles}
          className="w-full flex items-center justify-center gap-2 bg-[#25D366]/10 border border-[#25D366]/30 text-[#25D366] font-semibold py-4 rounded-2xl hover:bg-[#25D366]/20 transition">
          <Send size={18} /> Condividi (PDF + Social)</button>
      </div>

      {role !== 'athlete' && (
        <div className="mt-3">
          <button onClick={() => setAssignModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 bg-[#2a2a2a] border border-[#383838] text-white font-semibold py-4 rounded-2xl hover:border-[#f1ba17] hover:text-[#f1ba17] transition">
            <Users size={18} /> Assegna ad Atleta
          </button>
        </div>
      )}

      {/* Share2 CARD (nascosta, usata per screenshot) */}
      <div className="mt-12">
        <p className="text-gray-600 text-xs mb-4 font-medium text-center uppercase tracking-wider">Anteprima Sticker per Instagram</p>
        <div className="flex justify-center pb-8">
          <div ref={igRef} style={{
            width: '380px',
            background: 'linear-gradient(145deg, #0B0B0B 0%, #171717 100%)',
            borderRadius: '32px',
            fontFamily: "-apple-system, 'SF Pro Display', system-ui, sans-serif",
            overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.05)',
            boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
            padding: '32px'
          }}>

            {/* HEADER: FLEOFIT LOGO & DATE */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div>
                <div style={{ fontSize: '28px', fontWeight: 900, letterSpacing: '0.5px', lineHeight: 1 }}>
                  <span style={{ color: '#fff' }}>FLEO</span>
                  <span style={{ color: '#f1ba17' }}>FIT</span>
                </div>
                <div style={{ color: '#888', fontSize: '14px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>
                  {workout.date && isValid(parseISO(workout.date)) ? format(parseISO(workout.date), 'dd MMM yyyy', { locale: it }) : ''}
                </div>
              </div>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: type === 'Running' ? '#0094C6' : (type === 'Custom' ? '#D11149' : '#f1ba17'), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '16px', fontWeight: 900, color: type === 'Running' || type === 'Custom' ? '#fff' : '#111' }}>FL</span>
              </div>
            </div>

            {/* TITLE */}
            <div style={{ marginBottom: '32px' }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                <span style={{ background: type === 'Running' ? 'rgba(0, 148, 198, 0.2)' : (type === 'Custom' ? 'rgba(209, 17, 73, 0.2)' : 'rgba(241, 186, 23, 0.2)'), color: type === 'Running' ? '#0094C6' : (type === 'Custom' ? '#D11149' : '#f1ba17'), padding: '6px 12px', borderRadius: '12px', fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>
                  {type}
                </span>
                {workout.sections?.intensity && (
                  <span style={{ background: '#222', color: '#fff', padding: '6px 12px', borderRadius: '12px', fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>
                    🔥 Int: {workout.sections.intensity}/10
                  </span>
                )}
              </div>
              <div style={{ color: '#fff', fontSize: '30px', fontWeight: 900, lineHeight: 1.1, letterSpacing: '-1px', wordWrap: 'break-word' }}>
                {workout.title}
              </div>
            </div>

            {/* WORKOUT RECAP */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '36px' }}>
              {!isRunning ? blocks.map((b, i) => {
                let shortTitle = b.type;
                if (b.type === 'EMOM') shortTitle = `EMOM ${b.params?.rounds ? b.params.rounds + 'x' : ''}`;
                else if (b.type === 'AMRAP') shortTitle = `AMRAP ${b.params?.duration || ''}`;
                else if (b.type === 'ON/OFF') shortTitle = `ON/OFF ${b.params?.rounds ? b.params.rounds + 'x ' : ''}• ${b.params?.on || ''}/${b.params?.off || ''}`;
                else if (b.type === 'For Time') shortTitle = `FOR TIME ${b.params?.rounds ? b.params.rounds + 'x' : ''}`;
                else if (b.type === 'WarmUp') shortTitle = `WARM UP ${b.params?.duration ? '• ' + b.params.duration : ''}`;
                else if (b.type === 'Rest') shortTitle = `REST ${b.params?.duration ? '• ' + b.params.duration : ''}`;
                else if (b.type === 'Cash In' || b.type === 'Cash Out') shortTitle = b.type.toUpperCase();

                let desc = '';
                if (['WarmUp', 'Rest'].includes(b.type)) {
                   desc = b.notes || '';
                } else {
                   desc = (b.exercises || []).map(e => e.name).join(' • ');
                }

                return (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                     <div style={{ fontSize: '16px', fontWeight: 900, color: '#f1ba17', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{shortTitle}</div>
                     {desc && <div style={{ fontSize: '22px', fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>{desc}</div>}
                  </div>
                )
              }) : (s?.steps || s?.main?.steps || []).map((step, i) => {
                let title = '';
                let desc = '';
                if (step.type === 'warmup') { title = `WARM UP ${step.duration ? '• ' + step.duration : ''}`; desc = step.pace ? `@ ${step.pace}` : ''; }
                else if (step.type === 'run') { title = `RUN ${step.duration ? '• ' + step.duration : ''}`; desc = step.pace ? `@ ${step.pace}` : ''; }
                else if (step.type === 'recover') { title = `RECOVERY ${step.duration ? '• ' + step.duration : ''}`; desc = step.pace ? `@ ${step.pace}` : ''; }
                else if (step.type === 'cooldown') { title = `COOL DOWN ${step.duration ? '• ' + step.duration : ''}`; desc = step.pace ? `@ ${step.pace}` : ''; }
                else if (step.type === 'repeat') { 
                  title = `REPEAT • ${step.rounds}x`; 
                  desc = `${step.runDuration} ON / ${step.recDuration} OFF`; 
                }

                if (step.notes && !desc) desc = step.notes;
                else if (step.notes && desc) desc += ` • ${step.notes}`;

                return (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                     <div style={{ fontSize: '16px', fontWeight: 900, color: '#0094C6', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</div>
                     {desc && <div style={{ fontSize: '22px', fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>{desc}</div>}
                  </div>
                )
              })}
            </div>

            {/* FOOTER */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '20px' }}>
              <div style={{ color: '#aaa', fontSize: '14px', fontWeight: 600 }}>
                Coach Federico Leo
              </div>
              <div style={{ color: '#fff', fontSize: '14px', fontWeight: 800, letterSpacing: '0.5px' }}>
                @FLEOFIT
              </div>
            </div>

          </div>
        </div>
      </div>
      {/* MODAL: ASSEGNA AD ATLETA */}
      {assignModalOpen && createPortal(
        <div className="fixed inset-0 bg-black/85 z-[60] flex items-center justify-center p-4">
          <div className="bg-[#1e1e1e] rounded-3xl w-full max-w-md flex flex-col" style={{ maxHeight: 'calc(100vh - 100px)' }}>
            <div className="flex items-center justify-between p-5 border-b border-[#2a2a2a]">
              <p className="text-white font-bold text-lg">Assegna Workout</p>
              <button onClick={() => { setAssignModalOpen(false); setSelectedAthleteForAssign(null); }} className="text-gray-500 hover:text-white"><X size={20} /></button>
             </div>
            
            {!selectedAthleteForAssign ? (

              <div className="overflow-y-auto flex-1 p-5 flex flex-col gap-3">
                {athletes.length === 0 ? (
                  <p className="text-gray-500 text-center py-4 text-sm">Nessun atleta trovato.</p>
                ) : (
                  athletes.map(a => (
                    <button key={a.id} onClick={() => setSelectedAthleteForAssign(a)}
                      className="flex items-center gap-4 bg-[#2a2a2a] border border-[#333] rounded-2xl p-3 hover:border-[#f1ba17] transition text-left">
                      <div className="w-10 h-10 rounded-full bg-[#1e1e1e] border border-[#444] flex items-center justify-center overflow-hidden shrink-0">
                        {a.photo_url
                          ? <img src={a.photo_url} alt={a.name} className="w-full h-full object-cover" onError={() => setAthletes(athletes.map(ath => ath.id === a.id ? { ...ath, photo_url: null } : ath))} />
                          : <User size={18} className="text-gray-500" />
                        }
                      </div>
                      <div>
                        <p className="text-white font-semibold">{a.name} {a.surname}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            ) : (
              <div className="p-5 flex flex-col gap-4">
                <div>
                  <p className="text-gray-400 text-sm mb-1">Stai assegnando a:</p>
                  <p className="text-white font-bold">{selectedAthleteForAssign.name} {selectedAthleteForAssign.surname}</p>
                </div>
                <div>
                  <label className="text-gray-400 text-sm mb-2 block">Seleziona la data dell'allenamento</label>
                  <CustomDatePicker
                    date={assignDate}
                    onChange={setAssignDate}
                    className="bg-[#111] border border-[#333] rounded-xl px-4 py-3 hover:border-[#f1ba17]"
                  />
                </div>
                <div className="flex gap-3 mt-2">
                  <button onClick={() => setSelectedAthleteForAssign(null)} className="flex-1 py-3 bg-[#2a2a2a] text-white font-semibold rounded-xl hover:bg-[#333] transition disabled:opacity-50">
                    Indietro
                  </button>
                  <button onClick={() => handleAssign(selectedAthleteForAssign.id)} disabled={assigning} className="flex-1 py-3 bg-[#f1ba17] text-black font-bold rounded-xl hover:brightness-110 transition disabled:opacity-50">
                    {assigning ? 'Assegno...' : 'Conferma'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* MODAL: CONFERMA ELIMINAZIONE WORKOUT */}
      {showDeleteConfirm && createPortal(
        <div className="fixed inset-0 bg-black/85 z-[100] flex items-center justify-center p-4">
          <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-3xl w-full max-w-sm p-6 flex flex-col gap-4 text-center shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-red-900/30 text-red-500 flex items-center justify-center mx-auto mb-2 shrink-0">
              <AlertTriangle size={32} />
            </div>
            <h2 className="text-xl font-bold text-white">Sei sicuro?</h2>
            <p className="text-gray-400 text-sm">
              Questa azione eliminerà definitivamente il workout dal calendario e non può essere annullata.
            </p>
            <div className="flex gap-3 mt-4">
              <button 
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="flex-1 py-3 bg-[#2a2a2a] text-white font-semibold rounded-xl hover:bg-[#333] transition disabled:opacity-50"
              >
                Annulla
              </button>
              <button 
                onClick={handleDeleteWorkout}
                disabled={deleting}
                className="flex-1 py-3 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-500 transition disabled:opacity-50"
              >
                {deleting ? 'Eliminazione...' : 'Elimina'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL: SUCCESSO ASSEGNAZIONE */}
      {showSuccessModal && createPortal(
        <div className="fixed inset-0 bg-black/85 z-[100] flex items-center justify-center p-4">
          <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-3xl w-full max-w-sm p-6 flex flex-col gap-4 text-center shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-green-900/30 text-green-500 flex items-center justify-center mx-auto mb-2 shrink-0">
              <Check size={32} />
            </div>
            <h2 className="text-xl font-bold text-white">Workout Assegnato!</h2>
            <p className="text-gray-400 text-sm">
              L'allenamento è stato assegnato all'atleta con successo.
            </p>
            <button 
              onClick={() => setShowSuccessModal(false)}
              className="mt-4 w-full py-3 bg-[#2a2a2a] text-white font-semibold rounded-xl hover:bg-[#333] transition"
            >
              Chiudi
            </button>
          </div>
        </div>,
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

function RunningList({ steps }) {
  const getTypeLabel = (t) => {
    switch(t) {
      case 'warmup': return 'Riscaldamento'
      case 'run': return 'Corsa'
      case 'recover': return 'Recupero'
      case 'cooldown': return 'Defaticamento'
      case 'repeat': return 'Ripetute'
      default: return ''
    }
  }

  const getTypeColor = (t) => {
    switch(t) {
      case 'warmup': return 'text-orange-400'
      case 'run': return 'text-[#0094C6]'
      case 'recover': return 'text-green-400'
      case 'cooldown': return 'text-gray-400'
      case 'repeat': return 'text-purple-400'
      default: return 'text-white'
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {steps.map((step, i) => (
        <div key={step.id || i} className="flex flex-col border-l-2 border-[#333] pl-3 py-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-bold ${getTypeColor(step.type)}`}>
              {getTypeLabel(step.type)}
            </span>
            {step.type === 'repeat' && <span className="text-white text-sm font-bold bg-[#0B0B0B] px-2 py-0.5 rounded-full border border-[#333]">x{step.rounds}</span>}
          </div>
          {step.type === 'repeat' ? (
            <div className="text-sm flex flex-col gap-1 mt-1">
              <div className="flex items-center justify-between pr-2">
                <div><span className="text-gray-400">Corsa:</span> <span className="text-white">{step.runDuration}</span> {step.runPace && <span className="text-gray-500 text-xs">@{step.runPace}</span>}</div>
                {step.runIntensity && <div className="flex items-center gap-1"><span className={`text-xs font-bold ${getIntensityColor(step.runIntensity)}`}>{step.runIntensity}/10</span><BicepsFlexed size={12} className={getIntensityColor(step.runIntensity)} /></div>}
              </div>
              <div className="flex items-center justify-between pr-2">
                <div><span className="text-gray-400">Recupero:</span> <span className="text-white">{step.recDuration}</span> {step.recPace && <span className="text-gray-500 text-xs">@{step.recPace}</span>}</div>
                {step.recIntensity && <div className="flex items-center gap-1"><span className={`text-xs font-bold ${getIntensityColor(step.recIntensity)}`}>{step.recIntensity}/10</span><BicepsFlexed size={12} className={getIntensityColor(step.recIntensity)} /></div>}
              </div>
              {step.notes && <p className="text-gray-500 text-xs mt-0.5">{step.notes}</p>}
            </div>
          ) : (
            <div className="text-sm flex items-center justify-between pr-2">
              <div>
                {step.duration && <span className="font-semibold text-white">{step.duration}</span>}
                {step.pace && <span className="ml-2 text-gray-400">@{step.pace}</span>}
                {step.notes && <p className="text-gray-500 text-xs mt-1">{step.notes}</p>}
              </div>
              {step.intensity && <div className="flex items-center gap-1"><span className={`text-xs font-bold ${getIntensityColor(step.intensity)}`}>{step.intensity}/10</span><BicepsFlexed size={12} className={getIntensityColor(step.intensity)} /></div>}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── HELPERS ─────────────────────────────────────────────────
function Section({ icon, label, color, children }) {
  return (
    <div className={`bg-[#1e1e1e] border ${color} rounded-2xl p-4 mb-3`}>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <span className="text-white font-semibold text-sm">{label}</span>
      </div>
      {children}
    </div>
  )
}

function ExList({ exercises, showMinute, typeColor }) {
  return (
    <div className="flex flex-col gap-2 mt-1">
      {exercises.map((ex, i) => {
        const detail = isDistance(ex.name) ? (ex.meters && ex.meters !== '-' ? ex.meters : '') : (ex.reps && ex.reps !== '-' ? `${ex.reps} reps` : '')
        const paceStr = isErgo(ex.name) && ex.ergoPace && ex.ergoPace !== '-' && ex.ergoPace !== 'Libero' ? `@ ${ex.ergoPace}` : ''

        return (
        <div key={ex.id || i} className="flex items-center gap-3">
          {showMinute && (
            <div className="w-7 h-7 rounded-full bg-[#222] border border-[#333] flex items-center justify-center shrink-0">
              <span className={`text-xs font-bold ${typeColor}`}>{i + 1}</span>
            </div>
          )}
          <div className="flex-1">
            <span className="text-white text-sm font-medium">{ex.name}</span>
            <span className="text-gray-500 text-xs ml-2">
              {detail} {paceStr}
            </span>
            {ex.kg && <span className="text-gray-400 text-xs ml-2 font-bold">{ex.kg}kg</span>}
            {ex.notes && <span className="text-gray-600 text-xs ml-2">· {ex.notes}</span>}
          </div>
          {ex.intensity && (
            <div className="flex items-center gap-1 pr-2 shrink-0">
               <span className={`text-xs font-bold ${getIntensityColor(ex.intensity)}`}>{ex.intensity}/10</span>
               <BicepsFlexed size={14} className={getIntensityColor(ex.intensity)} />
            </div>
          )}
        </div>
      )})}
    </div>
  )
}