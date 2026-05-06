import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Trash2, Save, X, Check, ChevronRight, Timer, Dumbbell, Flag, FlagOff, ChevronUp, ChevronDown } from 'lucide-react'
import { supabase } from '../supabaseClient'

// ─── COSTANTI ────────────────────────────────────────────────
const ERGOMETERS = ['SkiErg', 'Rowing', 'Assault Bike']
const HYROX_EXERCISES = [
  'SkiErg', 'Rowing', 'Assault Bike',
  'Sled Push', 'Sled Pull', 'Burpee Broad Jump',
  'Farmers Carry', 'Sandbag Lunges', 'Wall Balls',
  'Kettlebell Swing', 'Box Jump', 'Run',
  'Battle Ropes', 'Pull Up', 'Push Up', 'Thruster',
  'Clean', 'Deadlift', 'Squat', 'Plank',
  'Hollow Body Hold', 'Toes to Bar', 'Double Under',
  'Bear Crawl', 'Shuttle Run', 'Front Lunge'
]

const isErgo = (name) => ERGOMETERS.includes(name)

const SLED_EXERCISES = ['Sled Push', 'Sled Pull']
const isSled = (name) => SLED_EXERCISES.includes(name)
const isDistance = (name) => isErgo(name) || isSled(name) || name === 'Farmers Carry'

const METERS_OPTIONS = [
  '50m','100m','150m','200m','250m','300m','400m','500m',
  '600m','750m','1000m','1500m','2000m'
]
const REPS_OPTIONS = Array.from({ length: 50 }, (_, i) => `${i + 1}`)
const MINUTES_OPTIONS = Array.from({ length: 60 }, (_, i) => `${i + 1} min`)
const TIME_OPTIONS = [
  '0:15','0:20','0:30','0:40','0:45',
  ...Array.from({ length: 30 }, (_, i) => `${i + 1}:00`)
]
const ROUNDS_OPTIONS = Array.from({ length: 40 }, (_, i) => `${i + 1}`)
const KG_OPTIONS = [
  'Nessun peso',
  ...Array.from({ length: 300 }, (_, i) => `${i + 1} kg`),
  ...[4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32].map(w => `2x${w} kg`)
]

// ─── HELPER REORDER ───────────────────────────────────────────
const moveElement = (list, from, to) => {
  if (from < 0 || from >= list.length || to < 0 || to >= list.length) return list
  const copy = [...list]
  const [moved] = copy.splice(from, 1)
  copy.splice(to, 0, moved)
  return copy
}

// ─── SCROLL PICKER ────────────────────────────────────────────
function ScrollPicker({ options, value, onChange, label }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <p className="text-gray-400 text-xs">{label}</p>}
      <div className="relative h-36 overflow-y-scroll snap-y snap-mandatory bg-[#1a1a1a] rounded-xl border border-[#383838]"
        style={{ scrollbarWidth: 'none' }}>
        <div className="py-[56px]">
          {options.map(opt => (
            <div key={opt} onClick={() => onChange(opt)}
              className={`snap-center h-10 flex items-center justify-center text-sm cursor-pointer select-none
                ${value === opt ? 'text-[#f1ba17] font-bold text-base' : 'text-gray-600 hover:text-gray-400'}`}>
              {opt}
            </div>
          ))}
        </div>
        <div className="pointer-events-none absolute inset-x-4 top-[52px] h-10 border-y border-[#f1ba17]/25 rounded" />
      </div>
    </div>
  )
}

// ─── EXERCISE PICKER MODAL ────────────────────────────────────
function ExercisePicker({ onAdd, onClose, existingNames = [] }) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [meters, setMeters] = useState('200m')
  const [reps, setReps] = useState('10')
  const [kg, setKg] = useState('Nessun peso')
  const [notes, setNotes] = useState('')

  const filtered = HYROX_EXERCISES.filter(ex =>
    ex.toLowerCase().includes(search.toLowerCase()) && !existingNames.includes(ex)
  )
  const isCustom = search && !HYROX_EXERCISES.find(e => e.toLowerCase() === search.toLowerCase())

  const handleSelect = (name) => setSelected(name)

  const handleConfirm = () => {
    if (!selected) return
    const isDist = isDistance(selected)
    onAdd({
      id: Math.random(),
      name: selected,
      meters: isDist ? meters : '',
      reps: !isDist ? reps : '',
      kg: kg === 'Nessun peso' ? '' : kg.replace(' kg', ''),
      notes
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/85 z-[60] flex items-center justify-center p-4">
      <div className="bg-[#1e1e1e] rounded-3xl w-full max-w-md flex flex-col" style={{ maxHeight: 'calc(100vh - 100px)' }}>
        <div className="flex items-center justify-between p-5 border-b border-[#2a2a2a]">
          <p className="text-white font-bold">Scegli esercizio</p>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={20} /></button>
        </div>

        <div className="p-4 flex flex-col gap-3 overflow-y-auto flex-1">
          <input
            className="bg-[#2a2a2a] border border-[#383838] rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#f1ba17] text-sm"
            placeholder="Cerca o scrivi esercizio custom..."
            value={search}
            onChange={e => { setSearch(e.target.value); setSelected(null) }}
            autoFocus
          />

          {!selected ? (
            <div className="flex flex-col gap-1">
              {isCustom && (
                <button onClick={() => handleSelect(search)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#f1ba17]/10 border border-[#f1ba17]/30 text-[#f1ba17] text-sm font-medium">
                  <Plus size={16} /> Aggiungi "{search}" (custom)
                </button>
              )}
              {filtered.map(ex => (
                <button key={ex} onClick={() => handleSelect(ex)}
                  className="flex items-center justify-between px-4 py-3 rounded-xl bg-[#2a2a2a] hover:bg-[#333] text-white text-sm transition">
                  <span>{ex}</span>
                  {isErgo(ex) && <span className="text-xs text-blue-400 bg-blue-900/40 px-2 py-0.5 rounded-full">ergometro</span>}
                  <ChevronRight size={16} className="text-gray-500" />
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-white text-sm">← Indietro</button>
                <span className="text-white font-semibold">{selected}</span>
              </div>

            {isErgo(selected) ? (
                <ScrollPicker options={METERS_OPTIONS} value={meters} onChange={setMeters} label="📏 Metri" />
              ) : (
              <div className="grid grid-cols-2 gap-3">
                {isDistance(selected) ? (
                  <ScrollPicker options={METERS_OPTIONS} value={meters} onChange={setMeters} label="📏 Metri" />
                ) : (
                  <ScrollPicker options={REPS_OPTIONS} value={reps} onChange={setReps} label="🔁 Reps" />
                )}
                <ScrollPicker options={KG_OPTIONS} value={kg} onChange={setKg} label="⚖️ Peso" />
              </div>
              )}

              <input
                className="bg-[#2a2a2a] border border-[#383838] rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#f1ba17] text-sm"
                placeholder="Note (es. vai a cedimento, body weight...)"
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />

              <button onClick={handleConfirm}
                className="w-full py-3 bg-[#f1ba17] text-black font-bold rounded-xl hover:brightness-110 transition">
                ✅ Aggiungi esercizio
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── BLOCCO ESERCIZIO ─────────────────────────────────────────
function ExerciseRow({ ex, index, total, onRemove, onMoveUp, onMoveDown, onDropIndex, showMinute }) {
  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData('text/plain', index)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10)
        if (!isNaN(fromIndex) && fromIndex !== index && onDropIndex) {
          onDropIndex(fromIndex, index)
        }
      }}
      className="flex items-center gap-3 bg-[#222] border border-[#2e2e2e] rounded-2xl px-4 py-3 cursor-move hover:border-[#444] transition"
    >
      <div className="flex flex-col items-center justify-center shrink-0">
        <button type="button" onClick={() => onMoveUp && onMoveUp(index)} disabled={index === 0} className={`text-gray-500 hover:text-[#f1ba17] disabled:opacity-0 p-0.5`}><ChevronUp size={16}/></button>
        <button type="button" onClick={() => onMoveDown && onMoveDown(index)} disabled={index === (total || 1) - 1} className={`text-gray-500 hover:text-[#f1ba17] disabled:opacity-0 p-0.5`}><ChevronDown size={16}/></button>
      </div>

      {showMinute && (
        <div className="w-8 h-8 rounded-full bg-[#f1ba17]/10 border border-[#f1ba17]/30 flex items-center justify-center shrink-0">
          <span className="text-[#f1ba17] text-xs font-bold">{index + 1}</span>
        </div>
      )}
      <div className="flex-1">
        <p className="text-white text-sm font-medium">{ex.name}</p>
        <p className="text-gray-500 text-xs mt-0.5">
          {isDistance(ex.name) ? ex.meters : `${ex.reps} reps`}
          {ex.kg ? ` · ${ex.kg}kg` : ''}
          {ex.notes ? ` · ${ex.notes}` : ''}
        </p>
      </div>
      <button type="button" onClick={() => onRemove(ex.id)} className="text-gray-700 hover:text-red-400 transition shrink-0 p-2">
        <Trash2 size={15} />
      </button>
    </div>
  )
}

// ─── BLOCCO CASH IN/OUT ───────────────────────────────────────
function CashBlock({ label, exercises, onAdd, onRemove, onMoveUp, onMoveDown, onDropIndex, icon }) {
  const [pickerOpen, setPickerOpen] = useState(false)
  return (
    <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-white font-semibold text-sm">{label}</span>
        </div>
        <button onClick={() => setPickerOpen(true)}
          className="text-[#f1ba17] hover:brightness-110 transition">
          <Plus size={18} />
        </button>
      </div>
      {exercises.length === 0 ? (
        <p className="text-gray-600 text-xs">Nessun esercizio — clicca + per aggiungere</p>
      ) : (
        <div className="flex flex-col gap-2">
          {exercises.map((ex, i) => (
            <ExerciseRow key={ex.id} ex={ex} index={i} total={exercises.length}
              onRemove={onRemove} onMoveUp={onMoveUp} onMoveDown={onMoveDown} onDropIndex={onDropIndex}
              showMinute={false} 
            />
          ))}
        </div>
      )}
      {pickerOpen && (
        <ExercisePicker
          onAdd={onAdd}
          onClose={() => setPickerOpen(false)}
          existingNames={exercises.map(e => e.name)}
        />
      )}
    </div>
  )
}

// ─── MAIN ─────────────────────────────────────────────────────
export default function CreateWorkout() {
  const [searchParams] = useSearchParams()
  const editId = searchParams.get('edit')

  const [step, setStep] = useState(1) // 1=tipo, 2=parametri, 3=build
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [workoutType, setWorkoutType] = useState(null)

  // Parametri per tipo
  const [emomOn, setEmomOn] = useState('1:00')
  const [emomOff, setEmomOff] = useState('1:00')
  const [emomTotal, setEmomTotal] = useState('21 min')
  const [amrapDuration, setAmrapDuration] = useState('10 min')
  const [forTimeRounds, setForTimeRounds] = useState('3')

  // Warmup
  const [warmupDuration, setWarmupDuration] = useState('10 min')
  const [warmupNotes, setWarmupNotes] = useState('')

  // Cash In/Out
  const [hasCashIn, setHasCashIn] = useState(false)
  const [hasCashOut, setHasCashOut] = useState(false)
  const [cashInExercises, setCashInExercises] = useState([])
  const [cashOutExercises, setCashOutExercises] = useState([])

  // Esercizi blocco principale
  const [exercises, setExercises] = useState([])
  const [pickerOpen, setPickerOpen] = useState(false)

  // Note + pause
  const [coachNotes, setCoachNotes] = useState('')

  const [athletes, setAthletes] = useState([])
  const [selectedAthlete, setSelectedAthlete] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    const fetchAthletes = async () => {
      const { data } = await supabase.from('athletes').select('id, name, surname').order('name')
      setAthletes(data || [])
    }
    fetchAthletes()
  }, [])

  // Se editId è presente, carichiamo i dati del workout per modificarli
  useEffect(() => {
    const fetchWorkoutToEdit = async () => {
      if (!editId) return
      const { data, error } = await supabase.from('workouts').select('*').eq('id', editId).single()
      if (error || !data) return

      setTitle(data.title)
      setDate(data.date)
      setCoachNotes(data.coach_notes || '')
      
      const s = data.sections || {}
      if (s.warmup) {
        setWarmupDuration(s.warmup.duration || '10 min')
        setWarmupNotes(s.warmup.notes || '')
      }
      if (s.cashIn && s.cashIn.length > 0) {
        setHasCashIn(true)
        setCashInExercises(s.cashIn)
      }
      if (s.cashOut && s.cashOut.length > 0) {
        setHasCashOut(true)
        setCashOutExercises(s.cashOut)
      }
      if (s.main) {
        setWorkoutType(s.main.type)
        setExercises(s.main.exercises || [])
        if (s.main.type === 'EMOM') { setEmomOn(s.main.params?.on || '1:00'); setEmomOff(s.main.params?.off || '1:00'); setEmomTotal(s.main.params?.total || '21 min') } 
        else if (s.main.type === 'AMRAP') { setAmrapDuration(s.main.params?.duration || '10 min') } 
        else if (s.main.type === 'For Time') { setForTimeRounds(s.main.params?.rounds || '3') }
      }
    }
    fetchWorkoutToEdit()
  }, [editId])

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const isStep1Valid = title.trim() !== '' && date !== ''

  const TYPE_INFO = {
    EMOM: { color: 'text-blue-300', border: 'border-blue-700', bg: 'bg-blue-900/40', desc: 'Every Minute On the Minute' },
    AMRAP: { color: 'text-green-300', border: 'border-green-700', bg: 'bg-green-900/40', desc: 'As Many Rounds As Possible' },
    'For Time': { color: 'text-purple-300', border: 'border-purple-700', bg: 'bg-purple-900/40', desc: 'Completa il più veloce possibile' }
  }

  const workoutSummary = () => {
    if (workoutType === 'EMOM') return `EMOM · ${emomOn} on / ${emomOff} off · ${emomTotal}`
    if (workoutType === 'AMRAP') return `AMRAP · ${amrapDuration}`
    if (workoutType === 'For Time') return `For Time · ${forTimeRounds} rounds`
    return ''
  }

  const handleSave = async () => {
    if (!title || !date) return alert('Inserisci titolo e data!')
    if (!workoutType) return alert('Scegli il tipo di workout!')
    if (exercises.length === 0) return alert('Aggiungi almeno un esercizio!')
    setSaving(true)
    const sections = {
      warmup: { duration: warmupDuration, notes: warmupNotes },
      cashIn: hasCashIn ? cashInExercises : null,
      main: {
        type: workoutType,
        params: workoutType === 'EMOM'
          ? { on: emomOn, off: emomOff, total: emomTotal }
          : workoutType === 'AMRAP'
            ? { duration: amrapDuration }
            : { rounds: forTimeRounds },
        exercises
      },
      cashOut: hasCashOut ? cashOutExercises : null
    }

    const payload = { title, date, sections, coach_notes: coachNotes }
    let targetId = editId

    if (editId) {
      const { error } = await supabase.from('workouts').update(payload).eq('id', editId)
      setSaving(false)
      if (error) { alert('Errore: ' + error.message); return }
    } else {
      const { data: newWorkout, error } = await supabase.from('workouts').insert(payload).select().single()
      setSaving(false)
      if (error) { alert('Errore: ' + error.message); return }
      targetId = newWorkout.id
    }

    if (selectedAthlete) {
      const { error: assignError } = await supabase.from('athlete_workouts').insert({
        athlete_id: selectedAthlete,
        workout_id: targetId,
        completed_date: date,
        status: 'pending'
      })
      if (assignError) alert("Workout salvato, ma errore nell'assegnazione: " + assignError.message)
    }

    navigate(`/workout/${targetId}`)
  }

  return (
    <div className="p-4 max-w-2xl mx-auto pb-24">
      <h1 className="text-2xl font-bold text-[#f1ba17] mb-6">{editId ? 'Modifica Workout' : 'Crea Workout'}</h1>

      {/* ── STEP 1: TIPO ─────────────────────────────────── */}
      {step === 1 && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 mb-2">
            <input
              className="bg-[#222] border border-[#333] rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#f1ba17]"
              placeholder="Nome workout (es. Hyrox Strength #1)"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
            <input
              type="date"
              className="bg-[#222] border border-[#333] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#f1ba17]"
              value={date}
              onChange={e => setDate(e.target.value)}
            />
          </div>

          <p className="text-gray-400 text-sm font-medium">Tipo di workout:</p>
          {!isStep1Valid && (
            <p className="text-yellow-500 text-xs text-center -mt-2 mb-2">
              ↑ Completa nome e data per proseguire
            </p>
          )}
          {Object.entries(TYPE_INFO).map(([type, info]) => (
            <button key={type} onClick={() => { setWorkoutType(type); setStep(2) }} disabled={!isStep1Valid}
              className={`flex items-center justify-between p-5 rounded-2xl border ${info.border} ${info.bg} transition ${!isStep1Valid ? 'opacity-40 cursor-not-allowed' : 'hover:brightness-125'}`}>
              <div className="text-left">
                <p className={`font-bold text-lg ${info.color}`}>{type}</p>
                <p className="text-gray-400 text-xs mt-1">{info.desc}</p>
              </div>
              <ChevronRight size={20} className={info.color} />
            </button>
          ))}
        </div>
      )}

      {/* ── STEP 2: PARAMETRI ────────────────────────────── */}
      {step === 2 && workoutType && (
        <div className="flex flex-col gap-5">
          <div className={`px-4 py-3 rounded-2xl border ${TYPE_INFO[workoutType].border} ${TYPE_INFO[workoutType].bg} flex items-center gap-3`}>
            <Timer size={18} className={TYPE_INFO[workoutType].color} />
            <span className={`font-bold ${TYPE_INFO[workoutType].color}`}>{workoutType}</span>
          </div>

          {workoutType === 'EMOM' && (
            <div className="grid grid-cols-3 gap-3">
              <ScrollPicker options={TIME_OPTIONS} value={emomOn} onChange={setEmomOn} label="⏱ Minuti ON" />
              <ScrollPicker options={TIME_OPTIONS} value={emomOff} onChange={setEmomOff} label="😮 Minuti OFF" />
              <ScrollPicker options={MINUTES_OPTIONS} value={emomTotal} onChange={setEmomTotal} label="🕐 Durata tot." />
            </div>
          )}

          {workoutType === 'AMRAP' && (
            <ScrollPicker options={MINUTES_OPTIONS} value={amrapDuration} onChange={setAmrapDuration} label="⏱ Durata totale" />
          )}

          {workoutType === 'For Time' && (
            <ScrollPicker options={ROUNDS_OPTIONS} value={forTimeRounds} onChange={setForTimeRounds} label="🔁 Numero rounds" />
          )}

          <div className="flex gap-3 mt-2">
            <button onClick={() => setStep(1)} className="flex-1 py-3 rounded-xl border border-[#444] text-gray-400 hover:text-white transition">← Indietro</button>
            <button onClick={() => setStep(3)} className="flex-1 py-3 rounded-xl bg-[#f1ba17] text-black font-bold hover:brightness-110 transition">Avanti →</button>
          </div>
        </div>
      )}

      {/* ── STEP 3: BUILD WORKOUT ────────────────────────── */}
      {step === 3 && (
        <div className="flex flex-col gap-4">

          {/* RIEPILOGO TIPO */}
          <div className={`px-4 py-3 rounded-2xl border ${TYPE_INFO[workoutType].border} ${TYPE_INFO[workoutType].bg}`}>
            <p className={`font-bold text-sm ${TYPE_INFO[workoutType].color}`}>{workoutSummary()}</p>
          </div>

          {/* WARM UP */}
          <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Timer size={16} className="text-orange-400" />
              <span className="text-white font-semibold text-sm">Warm Up</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <ScrollPicker options={MINUTES_OPTIONS} value={warmupDuration} onChange={setWarmupDuration} label="Durata" />
              <div className="flex flex-col gap-1">
                <p className="text-gray-400 text-xs">Note warm up</p>
                <textarea
                  className="flex-1 bg-[#2a2a2a] border border-[#383838] rounded-xl px-3 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-[#f1ba17] resize-none text-sm h-36"
                  placeholder="Es: corsa leggera, mobilità..."
                  value={warmupNotes}
                  onChange={e => setWarmupNotes(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* CASH IN */}
          {hasCashIn ? (
            <div>
              <CashBlock
                label="Cash In"
                icon={<Flag size={16} className="text-yellow-400" />}
                exercises={cashInExercises}
                onAdd={ex => setCashInExercises([...cashInExercises, ex])}
                onRemove={id => setCashInExercises(cashInExercises.filter(e => e.id !== id))}
                onMoveUp={idx => setCashInExercises(moveElement(cashInExercises, idx, idx - 1))}
                onMoveDown={idx => setCashInExercises(moveElement(cashInExercises, idx, idx + 1))}
                onDropIndex={(from, to) => setCashInExercises(moveElement(cashInExercises, from, to))}
              />
              <button onClick={() => { setHasCashIn(false); setCashInExercises([]) }}
                className="text-gray-600 hover:text-red-400 text-xs mt-1 ml-1">Rimuovi Cash In</button>
            </div>
          ) : (
            <button onClick={() => setHasCashIn(true)}
              className="flex items-center gap-2 text-gray-500 hover:text-[#f1ba17] text-sm transition border border-dashed border-[#333] rounded-xl px-4 py-3">
              <Plus size={16} /> Aggiungi Cash In (opzionale)
            </button>
          )}

          {/* BLOCCO PRINCIPALE */}
          <div className={`bg-[#1e1e1e] border ${TYPE_INFO[workoutType].border} rounded-2xl p-4`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Dumbbell size={16} className={TYPE_INFO[workoutType].color} />
                <span className={`font-bold text-sm ${TYPE_INFO[workoutType].color}`}>{workoutType}</span>
                <span className="text-gray-500 text-xs">· {workoutSummary().split('·').slice(1).join('·')}</span>
              </div>
              <button onClick={() => setPickerOpen(true)} className="text-[#f1ba17] hover:brightness-110">
                <Plus size={18} />
              </button>
            </div>

            {exercises.length === 0 ? (
              <button onClick={() => setPickerOpen(true)}
                className="w-full py-4 border border-dashed border-[#383838] rounded-xl text-gray-600 text-sm hover:border-[#f1ba17] hover:text-[#f1ba17] transition">
                + Aggiungi primo esercizio
              </button>
            ) : (
              <div className="flex flex-col gap-2">
                {exercises.map((ex, i) => (
                  <ExerciseRow
                    key={ex.id}
                    ex={ex}
                    index={i}
                    total={exercises.length}
                    showMinute={workoutType === 'EMOM'}
                    onRemove={id => setExercises(exercises.filter(e => e.id !== id))}
                    onMoveUp={idx => setExercises(moveElement(exercises, idx, idx - 1))}
                    onMoveDown={idx => setExercises(moveElement(exercises, idx, idx + 1))}
                    onDropIndex={(from, to) => setExercises(moveElement(exercises, from, to))}
                  />
                ))}
                <button onClick={() => setPickerOpen(true)}
                  className="flex items-center gap-2 text-[#f1ba17] text-sm font-medium mt-1 hover:brightness-110">
                  <Plus size={16} /> Aggiungi esercizio
                </button>
              </div>
            )}
          </div>

          {/* CASH OUT */}
          {hasCashOut ? (
            <div>
              <CashBlock
                label="Cash Out"
                icon={<FlagOff size={16} className="text-red-400" />}
                exercises={cashOutExercises}
                onAdd={ex => setCashOutExercises([...cashOutExercises, ex])}
                onRemove={id => setCashOutExercises(cashOutExercises.filter(e => e.id !== id))}
                onMoveUp={idx => setCashOutExercises(moveElement(cashOutExercises, idx, idx - 1))}
                onMoveDown={idx => setCashOutExercises(moveElement(cashOutExercises, idx, idx + 1))}
                onDropIndex={(from, to) => setCashOutExercises(moveElement(cashOutExercises, from, to))}
              />
              <button onClick={() => { setHasCashOut(false); setCashOutExercises([]) }}
                className="text-gray-600 hover:text-red-400 text-xs mt-1 ml-1">Rimuovi Cash Out</button>
            </div>
          ) : (
            <button onClick={() => setHasCashOut(true)}
              className="flex items-center gap-2 text-gray-500 hover:text-[#f1ba17] text-sm transition border border-dashed border-[#333] rounded-xl px-4 py-3">
              <Plus size={16} /> Aggiungi Cash Out (opzionale)
            </button>
          )}

          {/* NOTE COACH */}
          <div>
            <label className="text-gray-400 text-sm mb-2 block">Note coach (appariranno nel PDF)</label>
            <textarea
              className="w-full bg-[#222] border border-[#333] rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#f1ba17] resize-none text-sm"
              rows={3}
              placeholder="Es: vai a cedimento sull'ultimo esercizio, mantieni il ritmo..."
              value={coachNotes}
              onChange={e => setCoachNotes(e.target.value)}
            />
          </div>

          {/* ASSEGNA AD ATLETA (Solo in creazione) */}
          {!editId && (
            <div>
              <label className="text-gray-400 text-sm mb-2 block">Assegna ad Atleta (opzionale)</label>
              <div className="relative">
                <select
                  className="w-full bg-[#222] border border-[#333] rounded-xl px-4 py-3 text-white appearance-none focus:outline-none focus:border-[#f1ba17] text-sm"
                  value={selectedAthlete}
                  onChange={e => setSelectedAthlete(e.target.value)}
                >
                  <option value="">Nessuno (salva solo nel calendario)</option>
                  {athletes.map(a => (
                    <option key={a.id} value={a.id}>{a.name} {a.surname}</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                  <ChevronRight size={16} className="text-gray-500 rotate-90" />
                </div>
              </div>
            </div>
          )}

          {/* BOTTONI */}
          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className="flex-1 py-3 rounded-xl border border-[#444] text-gray-400 hover:text-white transition">← Parametri</button>
            <button onClick={handleSave} disabled={saving}
              className="flex-2 px-6 py-3 rounded-xl bg-[#f1ba17] text-black font-bold hover:brightness-110 transition disabled:opacity-50 flex items-center gap-2">
              <Save size={18} />
              {saving ? 'Salvo...' : saved ? '✅ Salvato!' : 'Salva Workout'}
            </button>
          </div>
        </div>
      )}

      {/* EXERCISE PICKER MODAL */}
      {pickerOpen && (
        <ExercisePicker
          onAdd={ex => setExercises([...exercises, ex])}
          onClose={() => setPickerOpen(false)}
          existingNames={exercises.map(e => e.name)}
        />
      )}
    </div>
  )
}