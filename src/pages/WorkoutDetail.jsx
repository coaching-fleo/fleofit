import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
// TOGLI Share2, metti Share2
import { ArrowLeft, Download, Share2, Timer, Flag, FlagOff, Dumbbell, Users, X, User, Send, Edit, Trash2, AlertTriangle, Check, BicepsFlexed } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

const TYPE_COLORS = {
  'ON/OFF': { text: 'text-blue-300', bg: 'bg-blue-900/40', border: 'border-blue-700', hex: '#3b82f6' },
  EMOM: { text: 'text-cyan-300', bg: 'bg-cyan-900/40', border: 'border-cyan-700', hex: '#06b6d4' },
  AMRAP: { text: 'text-green-300', bg: 'bg-green-900/40', border: 'border-green-700', hex: '#22c55e' },
  'For Time': { text: 'text-purple-300', bg: 'bg-purple-900/40', border: 'border-purple-700', hex: '#a855f7' },
  Running: { text: 'text-blue-400', bg: 'bg-blue-900/30', border: 'border-blue-600', hex: '#60a5fa' }
}

const getIntensityColor = (val) => {
  const num = parseInt(val, 10);
  if (isNaN(num)) return 'text-gray-500';
  if (num <= 3) return 'text-green-400';
  if (num <= 6) return 'text-yellow-400';
  if (num <= 8) return 'text-orange-500';
  return 'text-red-500';
}

const timeToSeconds = (timeStr) => {
  if (!timeStr) return 0;
  if (timeStr.includes(' min')) return parseInt(timeStr) * 60;
  const parts = timeStr.split(':')
  if (parts.length === 2) return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10)
  return 0
}
const formatTime = (totalSeconds) => {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  if (s === 0) return `${m} min`
  return `${m}:${s.toString().padStart(2, '0')} min`
}

const ERGOMETERS = ['SkiErg', 'Rowing', 'Assault Bike']
const isErgo = (name) => ERGOMETERS.includes(name)

const SLED_EXERCISES = ['Sled Push', 'Sled Pull']
const isSled = (name) => SLED_EXERCISES.includes(name)
const isDistance = (name) => isErgo(name) || isSled(name) || name === 'Farmers Carry'

export default function WorkoutDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const queryAthleteId = searchParams.get('athlete_id')

  const [workout, setWorkout] = useState(null)
  const [loading, setLoading] = useState(true)
  const igRef = useRef(null)

  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [athletes, setAthletes] = useState([])
  const [assigning, setAssigning] = useState(false)
  const [athleteNote, setAthleteNote] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [deleting, setDeleting] = useState(false)

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
    setWorkout(data)

    if (queryAthleteId && data) {
      const { data: awData } = await supabase.from('athlete_workouts')
        .select('notes, athletes(name, surname)')
        .eq('workout_id', data.id)
        .eq('athlete_id', queryAthleteId)
        .order('completed_date', { ascending: false })
        .limit(1)
        
      if (awData && awData.length > 0 && awData[0].notes) {
        setAthleteNote({ text: awData[0].notes, athleteName: `${awData[0].athletes.name} ${awData[0].athletes.surname}` })
      }
    }

    setLoading(false)
  }

  const fetchAthletes = async () => {
    const { data } = await supabase.from('athletes').select('id, name, surname, photo_url').order('name')
    setAthletes(data || [])
  }

  const handleAssign = async (athleteId) => {
    setAssigning(true)
    const { error } = await supabase.from('athlete_workouts').insert({
      athlete_id: athleteId,
      workout_id: workout.id,
      completed_date: workout.date, // Registriamo la data originaria in cui il workout è pianificato
      status: 'pending' // Lo inseriamo come 'in sospeso' finché l'atleta non lo fa
    })
    
    setAssigning(false)
    if (error) {
      alert("Errore durante l'assegnazione: " + error.message)
    } else {
      setAssignModalOpen(false)
      setShowSuccessModal(true)
    }
  }

  const handleDeleteWorkout = async () => {
    setDeleting(true)
    const { error } = await supabase.from('workouts').delete().eq('id', id)
    setDeleting(false)
    if (error) {
      alert("Errore durante l'eliminazione: " + error.message)
    } else {
      navigate('/calendar')
    }
  }

  const buildPDFDoc = () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const s = workout.sections
    const main = s?.main
    const typeRaw = main?.type || ''
    const type = (typeRaw === 'EMOM' && main?.params?.on) ? 'ON/OFF' : typeRaw
    const c = TYPE_COLORS[type]
    let y = 20

    // Header
    doc.setFillColor(23, 23, 23)
    doc.rect(0, 0, 210, 297, 'F')
    doc.setTextColor(241, 186, 23)
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text('FLEOFIT - Coach Federico Leo', 20, y)
    y += 8
    doc.setTextColor(200, 200, 200)
    doc.setFontSize(14)
    doc.text(workout.title, 20, y)
    y += 6
    doc.setFontSize(10)
    doc.setTextColor(120, 120, 120)
    doc.text(format(parseISO(workout.date), 'EEEE d MMMM yyyy', { locale: it }), 20, y)
    y += 10

    // Tipo badge
    doc.setFontSize(11)
    doc.setTextColor(241, 186, 23)
    doc.setFont('helvetica', 'bold')
    doc.text(`[ ${type} ]`, 20, y)
    
    let currentX = 45;
    if (type === 'ON/OFF') {
      doc.setTextColor(180, 180, 180)
      doc.setFont('helvetica', 'normal')
      doc.text(`  ${main.params.on} ON / ${main.params.off} OFF · ${main.params.total}`, currentX, y)
      currentX += 60;
    } else if (type === 'EMOM') {
      doc.setTextColor(180, 180, 180)
      doc.setFont('helvetica', 'normal')
      const intervalSec = timeToSeconds(main.params.interval || '1:00')
      const rounds = parseInt(main.params.rounds || '10', 10)
      doc.text(`  ${main.params.interval} x ${rounds} rounds · ${formatTime(intervalSec * rounds)}`, currentX, y)
      currentX += 60;
    } else if (type === 'AMRAP') {
      doc.setTextColor(180, 180, 180)
      doc.setFont('helvetica', 'normal')
      doc.text(`  ${main.params.duration}`, currentX, y)
      currentX += 30;
    } else if (type === 'For Time') {
      doc.setTextColor(180, 180, 180)
      doc.setFont('helvetica', 'normal')
      doc.text(`  ${main.params.rounds} rounds`, 55, y)
      currentX = 55 + 30;
    } else if (type === 'Running') {
      currentX = 55;
    }
    y += 6

    if (s?.intensity) {
      doc.setTextColor(241, 186, 23)
      doc.setFont('helvetica', 'bold')
      doc.text('INTENSITA\': ', 20, y)
      doc.setTextColor(200, 200, 200)
      doc.setFont('helvetica', 'normal')
      doc.text(`${s.intensity} / 10`, 45, y)
      y += 6
    }
    
    y += 2

    // Divider
    doc.setDrawColor(60, 60, 60)
    doc.line(20, y, 190, y)
    y += 8

    // Warm Up
    if (s?.warmup) {
      doc.setTextColor(251, 146, 60)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.text('WARM UP', 20, y)
      doc.setTextColor(180, 180, 180)
      doc.setFont('helvetica', 'normal')
      doc.text(`  ${s.warmup.duration}${s.warmup.notes ? ' · ' + s.warmup.notes : ''}`, 52, y)
      y += 10
    }

    // Cash In
    if (s?.cashIn?.length > 0) {
      doc.setTextColor(241, 186, 23)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.text('CASH IN', 20, y)
      y += 6
      s.cashIn.forEach(ex => {
        doc.setTextColor(200, 200, 200)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        const detail = isDistance(ex.name) ? ex.meters : `${ex.reps} reps`
        const kgStr = ex.kg ? ` @ ${ex.kg}kg` : ''
        doc.text(`· ${ex.name}  ${detail}${kgStr}${ex.notes ? '  (' + ex.notes + ')' : ''}`, 25, y)
        y += 6
      })
      y += 2
    }

    // Main
    doc.setTextColor(241, 186, 23)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text(type === 'Running' ? 'ALLENAMENTO CORSA' : type.toUpperCase(), 20, y)
    y += 6
    if (type === 'Running') {
      main.steps?.forEach((step, i) => {
        doc.setTextColor(180, 180, 180)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        
        const typeLabels = { warmup: 'Riscaldamento', run: 'Corsa', recover: 'Recupero', cooldown: 'Defaticamento', repeat: 'Ripetute' }
        doc.text(`· ${typeLabels[step.type] || ''}${step.type === 'repeat' ? ` x${step.rounds}` : ''}`, 25, y)
        y += 5
        
        doc.setFont('helvetica', 'normal')
        if (step.type === 'repeat') {
           doc.setTextColor(200, 200, 200)
           doc.text(`  Corsa: ${step.runDuration} ${step.runPace ? '@'+step.runPace : ''} ${step.runIntensity ? '[Int: '+step.runIntensity+'/10]' : ''}`, 30, y); y += 5
           doc.text(`  Recupero: ${step.recDuration} ${step.recPace ? '@'+step.recPace : ''} ${step.recIntensity ? '[Int: '+step.recIntensity+'/10]' : ''}`, 30, y); y += 5
        } else {
           doc.setTextColor(200, 200, 200)
           const text = `${step.duration || ''} ${step.pace ? '@'+step.pace : ''} ${step.intensity ? '[Int: '+step.intensity+'/10]' : ''} ${step.notes ? '('+step.notes+')' : ''}`
           doc.text(`  ${text}`, 30, y)
           y += 5
        }
        y += 2
        if (y > 260) { doc.addPage(); y = 20 }
      })
    } else {
      main.exercises.forEach((ex, i) => {
        doc.setTextColor(200, 200, 200)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        const prefix = (type === 'EMOM' || type === 'ON/OFF') ? `Min.${i + 1}  ` : `· `
        const detail = isDistance(ex.name) ? ex.meters : `${ex.reps} reps`
        const kgStr = ex.kg ? ` @ ${ex.kg}kg` : ''
        const noteStr = ex.notes ? `  → ${ex.notes}` : ''
        const intStr = ex.intensity ? `  [Int: ${ex.intensity}/10]` : ''
        doc.text(`${prefix}${ex.name}  ${detail}${kgStr}${intStr}${noteStr}`, 25, y)
        y += 6
        if (y > 260) { doc.addPage(); y = 20 }
      })
    }
    y += 4

    // Cash Out
    if (s?.cashOut?.length > 0) {
      doc.setTextColor(239, 68, 68)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.text('CASH OUT', 20, y)
      y += 6
      s.cashOut.forEach(ex => {
        doc.setTextColor(200, 200, 200)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        const detail = isDistance(ex.name) ? ex.meters : `${ex.reps} reps`
        const kgStr = ex.kg ? ` @ ${ex.kg}kg` : ''
        doc.text(`· ${ex.name}  ${detail}${kgStr}${ex.notes ? `  (${ex.notes})` : ''}`, 25, y)
        y += 6
      })
      y += 2
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
    doc.text('EMOM (Every Minute On the Minute): bisogna seguire i tempi ON e OFF indicati dal workout.', 20, glossaryY + 12, { maxWidth: 170 })
    doc.text('AMRAP (As Many Rounds As Possible): completa più rounds possibili degli esercizi nel tempo indicato.', 20, glossaryY + 20, { maxWidth: 170 })
    doc.text('FOR TIME: completa tutti i rounds nel minor tempo possibile.', 20, glossaryY + 28, { maxWidth: 170 })

    return doc
  }

  const exportPDF = () => {
    buildPDFDoc().save(`${workout.title.replace(/ /g, '_')}.pdf`)
  }

  const exportShare2 = async () => {
    if (!igRef.current) return
    const canvas = await html2canvas(igRef.current, {
      backgroundColor: '#171717',
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
      const doc = buildPDFDoc()
      const pdfBlob = doc.output('blob')
      const pdfFile = new File([pdfBlob], `${workout.title.replace(/ /g, '_')}.pdf`, { type: 'application/pdf' })

      // 2. Genera Immagine in memoria
      const canvas = await html2canvas(igRef.current, {
        backgroundColor: '#171717',
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
        alert('Il tuo dispositivo o browser non supporta la condivisione diretta di più file. Usa i tasti di esportazione classici.')
      }
    } catch (error) {
      console.error('Errore durante la condivisione:', error)
    }
  }

  if (loading) return <div className="p-6 text-gray-500">Caricamento...</div>
  if (!workout) return <div className="p-6 text-red-400">Workout non trovato</div>

  const s = workout.sections
  const main = s?.main
  const typeRaw = main?.type || ''
  const type = (typeRaw === 'EMOM' && main?.params?.on) ? 'ON/OFF' : typeRaw
  const c = TYPE_COLORS[type] || TYPE_COLORS['Running']

  const paramSummary = () => {
    if (type === 'ON/OFF') return `${main.params.on} ON · ${main.params.off} OFF · ${main.params.total}`
    if (type === 'EMOM') {
      const intervalSec = timeToSeconds(main.params.interval || '1:00')
      const rounds = parseInt(main.params.rounds || '10', 10)
      return `${main.params.interval} x ${rounds} rounds · ${formatTime(intervalSec * rounds)}`
    }
    if (type === 'AMRAP') return main.params.duration
    if (type === 'For Time') return `${main.params.rounds} rounds`
    if (type === 'Running') return `${main.steps?.length || 0} fasi`
    return ''
  }

  return (
    <div className="p-4 max-w-2xl mx-auto pb-24">
      {/* BACK */}
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-500 hover:text-white mb-5 transition">
        <ArrowLeft size={18} /> Calendario
      </button>

      {/* HEADER */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">{workout.title}</h1>
            <p className="text-gray-500 text-sm mt-1">
              {format(parseISO(workout.date), 'EEEE d MMMM yyyy', { locale: it })}
            </p>
          </div>
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
              <button onClick={() => navigate(`/create?edit=${id}`)} className="text-gray-400 hover:text-white text-xs flex items-center gap-1 transition bg-[#2a2a2a] border border-[#383838] px-2 py-1 rounded-lg">
                <Edit size={12} /> Modifica
              </button>
              <button onClick={() => setShowDeleteConfirm(true)} className="text-gray-400 hover:text-red-400 text-xs flex items-center gap-1 transition bg-[#2a2a2a] border border-[#383838] px-2 py-1 rounded-lg">
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        </div>
        <div className={`mt-3 px-4 py-2 rounded-xl ${c.bg} border ${c.border}`}>
          <p className={`text-sm font-medium ${c.text}`}>{paramSummary()}</p>
        </div>
      </div>

      {/* WARM UP */}
      {s?.warmup && (
        <Section icon={<Timer size={16} className="text-orange-400" />} label="Warm Up" color="border-orange-800">
          <p className="text-gray-300 text-sm">{s.warmup.duration}{s.warmup.notes ? ` · ${s.warmup.notes}` : ''}</p>
        </Section>
      )}

      {/* CASH IN */}
      {s?.cashIn?.length > 0 && (
        <Section icon={<Flag size={16} className="text-yellow-400" />} label="Cash In" color="border-yellow-800">
          <ExList exercises={s.cashIn} showMinute={false} />
        </Section>
      )}

      {/* MAIN */}
      <Section icon={type === 'Running' ? <Timer size={16} className={c.text} /> : <Dumbbell size={16} className={c.text} />} label={type === 'Running' ? 'Allenamento Corsa' : type} color={c.border}>
        {type === 'Running' ? (
          <RunningList steps={main.steps || []} />
        ) : (
          <ExList exercises={main.exercises || []} showMinute={type === 'EMOM' || type === 'ON/OFF'} typeColor={c.text} />
        )}
      </Section>

      {/* CASH OUT */}
      {s?.cashOut?.length > 0 && (
        <Section icon={<FlagOff size={16} className="text-red-400" />} label="Cash Out" color="border-red-800">
          <ExList exercises={s.cashOut} showMinute={false} />
        </Section>
      )}

      {/* NOTE COACH */}
      {workout.coach_notes && (
        <Section icon={<span className="text-[#f1ba17] text-sm">📋</span>} label="Note Coach" color="border-[#f1ba17]/40">
          <p className="text-gray-300 text-sm leading-relaxed">{workout.coach_notes}</p>
        </Section>
      )}

      {/* NOTE ATLETA */}
      {athleteNote && (
        <Section icon={<User size={16} className="text-[#3b82f6]" />} label={`Note Atleta (${athleteNote.athleteName})`} color="border-[#3b82f6]/40">
          <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{athleteNote.text}</p>
        </Section>
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

      <div className="mt-3">
        <button onClick={() => setAssignModalOpen(true)}
          className="w-full flex items-center justify-center gap-2 bg-[#2a2a2a] border border-[#383838] text-white font-semibold py-4 rounded-2xl hover:border-[#f1ba17] hover:text-[#f1ba17] transition">
          <Users size={18} /> Assegna ad Atleta
        </button>
      </div>

      {/* Share2 CARD (nascosta, usata per screenshot) */}
      <div className="mt-8">
        <p className="text-gray-600 text-xs mb-2">Anteprima grafica Share2:</p>
        <div ref={igRef} style={{
          width: '400px',
          background: 'linear-gradient(135deg, #171717 0%, #1e1e1e 100%)',
          padding: '32px',
          borderRadius: '0px',
          fontFamily: 'system-ui, sans-serif',
          border: '1px solid #2a2a2a'
        }}>
          {/* IG Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
            <div>
              <div style={{ color: '#f1ba17', fontWeight: 900, fontSize: '20px', letterSpacing: '3px' }}>FLEO<span style={{ color: 'white' }}>FIT</span></div>
              <div style={{ color: '#555', fontSize: '11px', marginTop: '2px', letterSpacing: '1px' }}>BY COACH FEDERICO LEO</div>
            </div>
            <div style={{
              background: c.bg.includes('blue') ? '#1e3a5f' : c.bg.includes('green') ? '#14532d' : '#3b0764',
              color: c.hex || '#f1ba17',
              fontWeight: 800, fontSize: '13px',
              padding: '6px 14px', borderRadius: '20px',
              border: `1px solid ${c.hex || '#f1ba17'}40`
            }}>{type}</div>
          </div>

          {/* Titolo */}
          <div style={{ color: 'white', fontWeight: 800, fontSize: '22px', marginBottom: '4px', lineHeight: 1.2 }}>{workout.title}</div>
          <div style={{ color: '#555', fontSize: '12px', marginBottom: '20px' }}>
            {format(parseISO(workout.date), 'd MMMM yyyy', { locale: it })}
          </div>

          {/* Params */}
          <div style={{
            background: '#222', borderRadius: '10px', padding: '10px 14px',
            marginBottom: '20px', borderLeft: `3px solid ${c.hex || '#f1ba17'}`
          }}>
            <div style={{ color: c.hex || '#f1ba17', fontSize: '12px', fontWeight: 700 }}>{paramSummary()}</div>
          </div>

          {/* Esercizi */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px' }}>
            {type === 'Running' ? (
              main.steps?.map((step, i) => {
                const typeLabels = { warmup: 'Warm Up', run: 'Run', recover: 'Recover', cooldown: 'Cool Down', repeat: 'Repeat' }
                return (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px', borderLeft: '2px solid #444', paddingLeft: '10px' }}>
                    <div style={{ color: '#60a5fa', fontSize: '12px', fontWeight: 800 }}>
                      {typeLabels[step.type]?.toUpperCase()} {step.type === 'repeat' ? `x${step.rounds}` : ''}
                    </div>
                    {step.type === 'repeat' ? (
                      <>
                        <div style={{ color: '#e5e5e5', fontSize: '12px' }}>Run: {step.runDuration} {step.runPace ? `· ${step.runPace}` : ''}</div>
                        <div style={{ color: '#a3a3a3', fontSize: '12px' }}>Rec: {step.recDuration} {step.recPace ? `· ${step.recPace}` : ''}</div>
                      </>
                    ) : (
                      <div style={{ color: '#e5e5e5', fontSize: '12px' }}>
                        {step.duration} {step.pace ? `· ${step.pace}` : ''} {step.notes ? `(${step.notes})` : ''}
                      </div>
                    )}
                  </div>
                )
              })
            ) : (
              main.exercises?.map((ex, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {(type === 'EMOM' || type === 'ON/OFF') && (
                    <div style={{
                      width: '22px', height: '22px', borderRadius: '50%',
                      background: '#222', border: `1px solid ${c.hex}40`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: c.hex, fontSize: '10px', fontWeight: 700, flexShrink: 0
                    }}>{i + 1}</div>
                  )}
                  <div style={{ color: '#e5e5e5', fontSize: '13px', fontWeight: 600 }}>{ex.name}</div>
                  <div style={{ color: '#555', fontSize: '12px', marginLeft: 'auto' }}>
                    {isDistance(ex.name) ? ex.meters : `${ex.reps} reps`}
                    {ex.kg ? ` · ${ex.kg}kg` : ''}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div style={{ borderTop: '1px solid #2a2a2a', paddingTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ color: '#333', fontSize: '10px', letterSpacing: '1px' }}>HYROX TRAINING</div>
            <div style={{ color: '#f1ba17', fontSize: '10px', fontWeight: 700 }}>@fleofit</div>
          </div>
        </div>
      </div>

      {/* MODAL: ASSEGNA AD ATLETA */}
      {assignModalOpen && (
        <div className="fixed inset-0 bg-black/85 z-[60] flex items-center justify-center p-4">
          <div className="bg-[#1e1e1e] rounded-3xl w-full max-w-md flex flex-col" style={{ maxHeight: 'calc(100vh - 100px)' }}>
            <div className="flex items-center justify-between p-5 border-b border-[#2a2a2a]">
              <p className="text-white font-bold text-lg">Assegna Workout</p>
              <button onClick={() => setAssignModalOpen(false)} className="text-gray-500 hover:text-white"><X size={20} /></button>
            </div>
            <div className="overflow-y-auto flex-1 p-5 flex flex-col gap-3">
              {athletes.length === 0 ? (
                <p className="text-gray-500 text-center py-4 text-sm">Nessun atleta trovato.</p>
              ) : (
                athletes.map(a => (
                  <button key={a.id} onClick={() => handleAssign(a.id)} disabled={assigning}
                    className="flex items-center gap-4 bg-[#2a2a2a] border border-[#333] rounded-2xl p-3 hover:border-[#f1ba17] transition text-left disabled:opacity-50">
                    <div className="w-10 h-10 rounded-full bg-[#1e1e1e] border border-[#444] flex items-center justify-center overflow-hidden shrink-0">
                      {a.photo_url
                        ? <img src={a.photo_url} alt={a.name} className="w-full h-full object-cover" />
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
          </div>
        </div>
      )}

      {/* MODAL: CONFERMA ELIMINAZIONE WORKOUT */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/85 z-[100] flex items-center justify-center p-4">
          <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-3xl w-full max-w-sm p-6 flex flex-col gap-4 text-center shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-red-900/30 text-red-500 flex items-center justify-center mx-auto mb-2">
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
        </div>
      )}

      {/* MODAL: SUCCESSO ASSEGNAZIONE */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/85 z-[100] flex items-center justify-center p-4">
          <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-3xl w-full max-w-sm p-6 flex flex-col gap-4 text-center shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-green-900/30 text-green-500 flex items-center justify-center mx-auto mb-2">
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
        </div>
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
      case 'run': return 'text-blue-400'
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
            {step.type === 'repeat' && <span className="text-white text-sm font-bold bg-[#1a1a1a] px-2 py-0.5 rounded-full border border-[#333]">x{step.rounds}</span>}
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
    <div className="flex flex-col gap-2">
      {exercises.map((ex, i) => (
        <div key={ex.id || i} className="flex items-center gap-3">
          {showMinute && (
            <div className={`w-7 h-7 rounded-full bg-[#222] border border-[#333] flex items-center justify-center shrink-0`}>
              <span className={`text-xs font-bold ${typeColor}`}>{i + 1}</span>
            </div>
          )}
          <div className="flex-1">
            <span className="text-white text-sm font-medium">{ex.name}</span>
            <span className="text-gray-500 text-xs ml-2">
              {isDistance(ex.name) ? ex.meters : `${ex.reps} reps`}
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
      ))}
    </div>
  )
}