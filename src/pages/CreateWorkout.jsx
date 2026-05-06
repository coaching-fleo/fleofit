import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Trash2, Save, X, Check, ChevronRight, Timer, Dumbbell, Flag, FlagOff, ChevronUp, ChevronDown, AlertTriangle, BicepsFlexed } from 'lucide-react'
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
const TIME_OPTIONS = Array.from({ length: 120 }, (_, i) => {
  const s = (i + 1) * 5;
  return `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;
})
const ROUNDS_OPTIONS = Array.from({ length: 40 }, (_, i) => `${i + 1}`)
const KG_OPTIONS = [
  'Nessun peso',
  ...Array.from({ length: 300 }, (_, i) => `${i + 1} kg`),
  ...[4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32].map(w => `2x${w} kg`)
]

// ─── COSTANTI RUNNING ─────────────────────────────────────────
const RUN_DURATION_OPTIONS = [
  ...Array.from({ length: 60 }, (_, i) => `${i + 1} min`),
  ...Array.from({ length: 12 }, (_, i) => `${(i + 1) * 5} sec`),
  '50m', '100m', '200m', '300m', '400m', '500m', '600m', '800m', '1 km', '1.5 km', '2 km', '3 km', '4 km', '5 km', '10 km', '15 km', '21 km', '42 km'
]

const RUN_PACE_OPTIONS = [
  'Libero', 'Camminata', 'Z1', 'Z2', 'Z3', 'Z4', 'Z5', 'All out', 'Gara',
  ...Array.from({ length: 96 }, (_, i) => {
    const s = 120 + i * 5;
    return `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')} /km`;
  })
]

const ERGO_PACE_OPTIONS = [
  'Z1', 'Z2', 'Z3', 'Z4', 'Z5', 'All out',
  ...Array.from({ length: 61 }, (_, i) => {
    const s = 90 + i * 5;
    return `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')} /500m`;
  }),
  ...Array.from({ length: 17 }, (_, i) => `${40 + i * 5} RPM`)
]

const MAX_PACE_OPTIONS = ['-', ...RUN_PACE_OPTIONS]

const RUN_REPEAT_ROUNDS_OPTIONS = Array.from({ length: 30 }, (_, i) => `${i + 1}`)

export const getIntensityColor = (val) => {
  const num = parseInt(val, 10);
  if (isNaN(num)) return 'text-gray-500';
  if (num <= 4) return 'text-gray-400';
  if (num <= 7) return 'text-gray-300';
  if (num <= 9) return 'text-white';
  return 'text-[#f1ba17]';
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
function ExercisePicker({ onAdd, onClose, existingNames = [], workoutType }) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [meters, setMeters] = useState('200m')
  const [ergoPace, setErgoPace] = useState('2:00 /500m')
  const [reps, setReps] = useState('10')
  const [kg, setKg] = useState('Nessun peso')
  const [intensity, setIntensity] = useState('5')
  const [notes, setNotes] = useState('')

  const filtered = HYROX_EXERCISES.filter(ex =>
    ex.toLowerCase().includes(search.toLowerCase()) && !existingNames.includes(ex)
  )
  const isCustom = search && !HYROX_EXERCISES.find(e => e.toLowerCase() === search.toLowerCase())

  const handleSelect = (name) => setSelected(name)

  const handleConfirm = () => {
    if (!selected) return
    const isDist = isDistance(selected)
    
    let finalMeters = isDist ? meters : ''
    let finalReps = !isDist ? reps : ''
    
    if (workoutType === 'EMOM' || workoutType === 'ON/OFF') {
      if (isErgo(selected)) {
        finalMeters = ergoPace
        finalReps = ''
      } else if (isDist) {
        finalMeters = ''
      }
    }

    onAdd({
      id: Math.random(),
      name: selected,
      meters: finalMeters,
      reps: finalReps,
      kg: kg === 'Nessun peso' ? '' : kg.replace(' kg', ''),
      intensity,
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

              {(workoutType === 'EMOM' || workoutType === 'ON/OFF') ? (
                <div className="grid grid-cols-2 gap-3">
                  {isErgo(selected) ? (
                    <ScrollPicker options={ERGO_PACE_OPTIONS} value={ergoPace} onChange={setErgoPace} label="⏱ Passo" />
                  ) : isDistance(selected) ? (
                    <div className="flex flex-col gap-1">
                      <p className="text-transparent text-xs select-none">.</p>
                      <div className="relative h-36 flex items-center justify-center bg-[#1a1a1a] rounded-xl border border-[#383838]">
                        <span className="text-gray-500 text-xs">Solo peso</span>
                      </div>
                    </div>
                  ) : (
                    <ScrollPicker options={REPS_OPTIONS} value={reps} onChange={setReps} label="🔁 Reps" />
                  )}
                  <ScrollPicker options={KG_OPTIONS} value={kg} onChange={setKg} label="⚖️ Peso" />
                </div>
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

              <div className="bg-[#222] border border-[#333] rounded-xl p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-xs">💪 Intensità</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${getIntensityColor(intensity)}`}>{intensity}/10</span>
                    <BicepsFlexed size={16} className={getIntensityColor(intensity)} />
                  </div>
                </div>
                <input type="range" min="1" max="10" value={intensity} onChange={e => setIntensity(e.target.value)} className="w-full accent-[#f1ba17]" />
              </div>

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
      {ex.intensity && (
        <div className="flex items-center gap-1 pr-2 shrink-0">
           <span className={`text-xs font-bold ${getIntensityColor(ex.intensity)}`}>{ex.intensity}/10</span>
           <BicepsFlexed size={16} className={getIntensityColor(ex.intensity)} />
        </div>
      )}
      <button type="button" onClick={() => onRemove(ex.id)} className="text-gray-700 hover:text-red-400 transition shrink-0 p-2">
        <Trash2 size={15} />
      </button>
    </div>
  )
}

// ─── BLOCCO CASH IN/OUT ───────────────────────────────────────
function CashBlock({ label, exercises, onAdd, onRemove, onMoveUp, onMoveDown, onDropIndex, icon, workoutType }) {
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
          workoutType={workoutType}
        />
      )}
    </div>
  )
}

// ─── COMPONENTI RUNNING BUILDER ────────────────────────────────
function RunningStepPicker({ onAdd, onClose }) {
  const [type, setType] = useState('run')
  const [duration, setDuration] = useState('10 min')
  const [pace, setPace] = useState('Libero')
  const [paceMax, setPaceMax] = useState('-')
  const [intensity, setIntensity] = useState('5')
  const [notes, setNotes] = useState('')
  const [rounds, setRounds] = useState('8')
  const [runDuration, setRunDuration] = useState('1 min')
  const [runPace, setRunPace] = useState('Libero')
  const [runPaceMax, setRunPaceMax] = useState('-')
  const [runIntensity, setRunIntensity] = useState('8')
  const [recDuration, setRecDuration] = useState('1 min')
  const [recPace, setRecPace] = useState('Libero')
  const [recPaceMax, setRecPaceMax] = useState('-')
  const [recIntensity, setRecIntensity] = useState('3')

  const formatPace = (p, pMax) => {
    if (!pMax || pMax === '-') return p
    if (p.includes(' /km') && pMax.includes(' /km')) {
      return `${p.replace(' /km', '')} - ${pMax}`
    }
    return `${p} - ${pMax}`
  }

  const handleAdd = () => {
    onAdd({
      id: Math.random(), type, 
      duration, pace: formatPace(pace, paceMax), intensity, notes,
      rounds, runDuration, runPace: formatPace(runPace, runPaceMax), runIntensity,
      recDuration, recPace: formatPace(recPace, recPaceMax), recIntensity
    })
    onClose()
  }

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

  return (
    <div className="fixed inset-0 bg-black/85 z-[60] flex items-center justify-center p-4">
      <div className="bg-[#1e1e1e] rounded-3xl w-full max-w-md flex flex-col" style={{ maxHeight: 'calc(100vh - 100px)' }}>
        <div className="flex items-center justify-between p-5 border-b border-[#2a2a2a]">
          <p className="text-white font-bold">Aggiungi Fase Corsa</p>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-4 flex flex-col gap-4 overflow-y-auto flex-1">
          <div className="flex flex-wrap gap-2">
            {['warmup', 'run', 'recover', 'cooldown', 'repeat'].map(t => (
              <button key={t} onClick={() => setType(t)}
                className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition ${
                  type === t ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-[#2a2a2a] border-[#383838] text-gray-400 hover:text-white'
                }`}>
                {getTypeLabel(t)}
              </button>
            ))}
          </div>
          {type === 'repeat' ? (
            <div className="flex flex-col gap-4 mt-2">
              <ScrollPicker options={RUN_REPEAT_ROUNDS_OPTIONS} value={rounds} onChange={setRounds} label="Numero di ripetizioni" />
              <div className="p-3 bg-[#222] border border-[#333] rounded-xl flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <p className="text-blue-300 text-sm font-semibold">Fase Attiva (Corsa)</p>
                  <div className="flex items-center gap-1">
                    <span className={`text-xs font-bold ${getIntensityColor(runIntensity)}`}>{runIntensity}/10</span>
                    <BicepsFlexed size={14} className={getIntensityColor(runIntensity)} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <ScrollPicker options={RUN_DURATION_OPTIONS} value={runDuration} onChange={setRunDuration} label="Durata" />
                  <ScrollPicker options={RUN_PACE_OPTIONS} value={runPace} onChange={setRunPace} label="Da" />
                  <ScrollPicker options={MAX_PACE_OPTIONS} value={runPaceMax} onChange={setRunPaceMax} label="A (Opz.)" />
                </div>
                <input type="range" min="1" max="10" value={runIntensity} onChange={e => setRunIntensity(e.target.value)} className="w-full accent-blue-500" />
              </div>
              <div className="p-3 bg-[#222] border border-[#333] rounded-xl flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <p className="text-green-400 text-sm font-semibold">Fase Recupero</p>
                  <div className="flex items-center gap-1">
                    <span className={`text-xs font-bold ${getIntensityColor(recIntensity)}`}>{recIntensity}/10</span>
                    <BicepsFlexed size={14} className={getIntensityColor(recIntensity)} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <ScrollPicker options={RUN_DURATION_OPTIONS} value={recDuration} onChange={setRecDuration} label="Durata" />
                  <ScrollPicker options={RUN_PACE_OPTIONS} value={recPace} onChange={setRecPace} label="Da" />
                  <ScrollPicker options={MAX_PACE_OPTIONS} value={recPaceMax} onChange={setRecPaceMax} label="A (Opz.)" />
                </div>
                <input type="range" min="1" max="10" value={recIntensity} onChange={e => setRecIntensity(e.target.value)} className="w-full accent-green-500" />
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 mt-2">
              <div className="grid grid-cols-3 gap-2">
                <ScrollPicker options={RUN_DURATION_OPTIONS} value={duration} onChange={setDuration} label="Durata / Distanza" />
                <ScrollPicker options={RUN_PACE_OPTIONS} value={pace} onChange={setPace} label="Da" />
                <ScrollPicker options={MAX_PACE_OPTIONS} value={paceMax} onChange={setPaceMax} label="A (Opz.)" />
              </div>
              <div className="bg-[#222] border border-[#333] rounded-xl p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-xs">💪 Intensità</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${getIntensityColor(intensity)}`}>{intensity}/10</span>
                    <BicepsFlexed size={16} className={getIntensityColor(intensity)} />
                  </div>
                </div>
                <input type="range" min="1" max="10" value={intensity} onChange={e => setIntensity(e.target.value)} className="w-full accent-blue-500" />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Note</label>
                <input value={notes} onChange={e => setNotes(e.target.value)} className="w-full bg-[#2a2a2a] border border-[#383838] rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 text-sm" placeholder="Es: corsa leggera, focus tecnica..." />
              </div>
            </div>
          )}
          <button onClick={handleAdd} className="w-full mt-2 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-500 transition">
            Aggiungi Fase
          </button>
        </div>
      </div>
    </div>
  )
}

function RunningStepRow({ step, index, total, onRemove, onMoveUp, onMoveDown }) {
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
      case 'warmup': return 'text-gray-400 bg-[#2a2a2a] border-[#383838]'
      case 'run': return 'text-white bg-[#333] border-[#444]'
      case 'recover': return 'text-gray-500 bg-[#1e1e1e] border-[#2a2a2a]'
      case 'cooldown': return 'text-gray-600 bg-[#111] border-[#222]'
      case 'repeat': return 'text-purple-400 bg-purple-400/10 border-purple-400/30'
      default: return 'text-white bg-[#222] border-[#333]'
    }
  }

  return (
    <div className="flex items-start gap-3 bg-[#222] border border-[#2e2e2e] rounded-2xl px-4 py-3 hover:border-[#444] transition">
      <div className="flex flex-col items-center justify-center shrink-0 mt-1">
        <button type="button" onClick={() => onMoveUp && onMoveUp(index)} disabled={index === 0} className={`text-gray-500 hover:text-blue-400 disabled:opacity-0 p-0.5`}><ChevronUp size={16}/></button>
        <button type="button" onClick={() => onMoveDown && onMoveDown(index)} disabled={index === (total || 1) - 1} className={`text-gray-500 hover:text-blue-400 disabled:opacity-0 p-0.5`}><ChevronDown size={16}/></button>
      </div>
      <div className="flex-1 mt-1">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${getTypeColor(step.type)}`}>
            {getTypeLabel(step.type)}
          </span>
          {step.type === 'repeat' && <span className="text-white text-sm font-bold bg-[#1a1a1a] px-2 py-0.5 rounded-full border border-[#333]">x{step.rounds}</span>}
        </div>
        {step.type === 'repeat' ? (
          <div className="text-sm mt-2 flex flex-col gap-1.5 ml-1 border-l-2 border-[#333] pl-3">
            <div>
              <span className="text-gray-300 font-medium">Corsa:</span> <span className="text-white">{step.runDuration}</span>
              {step.runPace && <span className="text-gray-500 text-xs ml-1">@{step.runPace}</span>}
            </div>
            <div>
              <span className="text-gray-500 font-medium">Recupero:</span> <span className="text-gray-400">{step.recDuration}</span>
              {step.recPace && <span className="text-gray-500 text-xs ml-1">@{step.recPace}</span>}
            </div>
            {step.intensity && (
              <div className="flex items-center gap-1">
                <span className={`text-xs font-bold ${getIntensityColor(step.intensity)}`}>{step.intensity}/10</span><BicepsFlexed size={14} className={getIntensityColor(step.intensity)} />
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm mt-1 text-gray-300">
            {step.duration && <span className="font-semibold text-white">{step.duration}</span>}
            {step.pace && <span className="ml-2 text-gray-500">@{step.pace}</span>}
            {step.notes && <p className="text-gray-500 text-xs mt-0.5">{step.notes}</p>}
          </div>
        )}
      </div>
      <button type="button" onClick={() => onRemove(step.id)} className="text-gray-700 hover:text-red-400 transition shrink-0 p-2 mt-1">
        <Trash2 size={15} />
      </button>
    </div>
  )
}

// ─── MAIN ─────────────────────────────────────────────────────
export default function CreateWorkout() {
  const [searchParams] = useSearchParams()
  const editId = searchParams.get('edit')
  const defaultDate = searchParams.get('date')
  const defaultAthleteId = searchParams.get('athlete_id')

  const [step, setStep] = useState(1) // 1=tipo, 2=parametri, 3=build
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(defaultDate || '')
  const [workoutType, setWorkoutType] = useState(null)
  const [workoutIntensity, setWorkoutIntensity] = useState('5')
  const [category, setCategory] = useState('Hyrox')

  // Parametri per tipo
  const [onOffOn, setOnOffOn] = useState('1:00')
  const [onOffOff, setOnOffOff] = useState('1:00')
  const [onOffTotal, setOnOffTotal] = useState('21 min')
  const [emomInterval, setEmomInterval] = useState('1:00')
  const [emomRounds, setEmomRounds] = useState('10')
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
  
  // Running
  const [runningSteps, setRunningSteps] = useState([])
  const [runningPickerOpen, setRunningPickerOpen] = useState(false)

  // Note + pause
  const [coachNotes, setCoachNotes] = useState('')

  const [athletes, setAthletes] = useState([])
  const [selectedAthlete, setSelectedAthlete] = useState(defaultAthleteId || '')
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
        if (s.main.type === 'Running') {
          setCategory('Running')
          setWorkoutType('Running')
          setRunningSteps(s.main.steps || [])
        } else {
          setCategory('Hyrox')
          if (s.main.type === 'EMOM' && s.main.params?.on) {
            setWorkoutType('ON/OFF')
            setExercises(s.main.exercises || [])
            setOnOffOn(s.main.params.on || '1:00')
            setOnOffOff(s.main.params.off || '1:00')
            setOnOffTotal(s.main.params.total || '21 min')
          } else {
            setWorkoutType(s.main.type)
            setExercises(s.main.exercises || [])
            if (s.main.type === 'ON/OFF') { setOnOffOn(s.main.params?.on || '1:00'); setOnOffOff(s.main.params?.off || '1:00'); setOnOffTotal(s.main.params?.total || '21 min') } 
            else if (s.main.type === 'EMOM') { setEmomInterval(s.main.params?.interval || '1:00'); setEmomRounds(s.main.params?.rounds || '10') } 
            else if (s.main.type === 'AMRAP') { setAmrapDuration(s.main.params?.duration || '10 min') } 
            else if (s.main.type === 'For Time') { setForTimeRounds(s.main.params?.rounds || '3') }
          }
        }
      }
    }
    fetchWorkoutToEdit()
  }, [editId])

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [pendingPath, setPendingPath] = useState(null)

  const hasUnsavedChanges = title.trim() !== '' || exercises.length > 0 || runningSteps.length > 0

  useEffect(() => {
    // 1. Intercetta chiusura/aggiornamento del tab del browser
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges && !saved) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)

    // 2. Intercetta i click sui link di navigazione interna (es. bottoni della Navbar)
    const handleLinkClick = (e) => {
      if (hasUnsavedChanges && !saved) {
        const link = e.target.closest('a')
        if (link && link.host === window.location.host && link.pathname !== window.location.pathname) {
          e.preventDefault()
          e.stopPropagation()
          setPendingPath(link.pathname + link.search)
          setShowExitConfirm(true)
        }
      }
    }
    // Usiamo 'capture: true' per bloccare l'evento prima che React Router faccia cambiare pagina
    document.addEventListener('click', handleLinkClick, { capture: true })

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('click', handleLinkClick, { capture: true })
    }
  }, [hasUnsavedChanges, saved])

  const isStep1Valid = title.trim() !== '' && date !== ''

  const TYPE_INFO = {
    'ON/OFF': { color: 'text-gray-200', border: 'border-[#444]', bg: 'bg-[#222]', desc: 'Work / Rest intervals' },
    EMOM: { color: 'text-gray-200', border: 'border-[#444]', bg: 'bg-[#222]', desc: 'Every Minute On the Minute' },
    AMRAP: { color: 'text-gray-200', border: 'border-[#444]', bg: 'bg-[#222]', desc: 'As Many Rounds As Possible' },
    'For Time': { color: 'text-gray-200', border: 'border-[#444]', bg: 'bg-[#222]', desc: 'Completa il più veloce possibile' }
  }

  const workoutSummary = () => {
    if (workoutType === 'ON/OFF') return `ON/OFF · ${onOffOn} on / ${onOffOff} off · ${onOffTotal}`
    if (workoutType === 'EMOM') {
      const intervalSec = timeToSeconds(emomInterval)
      const rounds = parseInt(emomRounds, 10) || 0
      return `EMOM · ${emomInterval} x ${emomRounds} rounds · ${formatTime(intervalSec * rounds)}`
    }
    if (workoutType === 'AMRAP') return `AMRAP · ${amrapDuration}`
    if (workoutType === 'For Time') return `For Time · ${forTimeRounds} rounds`
    return ''
  }

  const handleSave = async () => {
    if (!title || !date) return alert('Inserisci titolo e data!')
    if (!workoutType) return alert('Scegli il tipo di workout!')
    if (category === 'Hyrox' && exercises.length === 0) return alert('Aggiungi almeno un esercizio!')
    if (category === 'Running' && runningSteps.length === 0) return alert('Aggiungi almeno una fase di corsa!')
    
    setSaving(true)
    const sections = {
      intensity: workoutIntensity,
      warmup: category === 'Hyrox' ? { duration: warmupDuration, notes: warmupNotes } : null,
      cashIn: (category === 'Hyrox' && hasCashIn) ? cashInExercises : null,
      main: category === 'Hyrox' ? {
        type: workoutType,
        params: workoutType === 'ON/OFF'
          ? { on: onOffOn, off: onOffOff, total: onOffTotal }
          : workoutType === 'EMOM'
            ? { interval: emomInterval, rounds: emomRounds }
            : workoutType === 'AMRAP'
              ? { duration: amrapDuration }
              : { rounds: forTimeRounds },
        exercises
      } : {
        type: 'Running',
        steps: runningSteps
      },
      cashOut: (category === 'Hyrox' && hasCashOut) ? cashOutExercises : null
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

          <p className="text-gray-400 text-sm font-medium">Seleziona Categoria:</p>
          <div className="flex gap-2 mb-2">
            <button 
              onClick={() => setCategory('Hyrox')} 
              className={`flex-1 py-4 rounded-xl border font-bold transition flex items-center justify-center gap-2 ${category === 'Hyrox' ? 'bg-[#f1ba17]/10 border-[#f1ba17] text-[#f1ba17]' : 'bg-[#222] border-[#333] text-gray-500 hover:text-white'}`}>
              <Dumbbell size={20} /> Hyrox
            </button>
            <button 
              onClick={() => setCategory('Running')} 
              className={`flex-1 py-4 rounded-xl border font-bold transition flex items-center justify-center gap-2 ${category === 'Running' ? 'bg-[#f1ba17]/10 border-[#f1ba17] text-[#f1ba17]' : 'bg-[#222] border-[#333] text-gray-500 hover:text-white'}`}>
              <Timer size={20} /> Running
            </button>
          </div>

          {!isStep1Valid && (
            <p className="text-yellow-500 text-xs text-center mb-2">
              ↑ Completa nome e data per proseguire
            </p>
          )}

          {category === 'Hyrox' && (
            <>
              <p className="text-gray-400 text-sm font-medium mt-2">Tipo di workout:</p>
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
            </>
          )}

          {category === 'Running' && (
            <button 
              onClick={() => { setWorkoutType('Running'); setStep(3) }} 
              disabled={!isStep1Valid}
              className={`w-full py-4 mt-2 rounded-2xl border border-[#f1ba17]/50 bg-[#f1ba17]/10 text-[#f1ba17] font-bold text-lg transition ${!isStep1Valid ? 'opacity-40 cursor-not-allowed' : 'hover:brightness-125'}`}
            >
              Crea Allenamento Corsa →
            </button>
          )}
        </div>
      )}

      {/* ── STEP 2: PARAMETRI ────────────────────────────── */}
      {step === 2 && workoutType && (
        <div className="flex flex-col gap-5">
          <div className={`px-4 py-3 rounded-2xl border ${TYPE_INFO[workoutType].border} ${TYPE_INFO[workoutType].bg} flex items-center gap-3`}>
            <Timer size={18} className={TYPE_INFO[workoutType].color} />
            <span className={`font-bold ${TYPE_INFO[workoutType].color}`}>{workoutType}</span>
          </div>

          {workoutType === 'ON/OFF' && (
            <div className="grid grid-cols-3 gap-3">
              <ScrollPicker options={TIME_OPTIONS} value={onOffOn} onChange={setOnOffOn} label="⏱ Minuti ON" />
              <ScrollPicker options={TIME_OPTIONS} value={onOffOff} onChange={setOnOffOff} label="😮 Minuti OFF" />
              <ScrollPicker options={MINUTES_OPTIONS} value={onOffTotal} onChange={setOnOffTotal} label="🕐 Durata tot." />
            </div>
          )}

          {workoutType === 'EMOM' && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <ScrollPicker options={TIME_OPTIONS} value={emomInterval} onChange={setEmomInterval} label="⏱ Durata Intervallo" />
                <ScrollPicker options={ROUNDS_OPTIONS} value={emomRounds} onChange={setEmomRounds} label="🔁 Numero Intervalli" />
              </div>
              <div className="bg-[#222] border border-[#333] rounded-xl p-3 flex items-center justify-between">
                <span className="text-gray-400 text-sm">Durata totale calcolata:</span>
                <span className="text-white font-bold text-lg">
                  {formatTime(timeToSeconds(emomInterval) * (parseInt(emomRounds, 10) || 0))}
                </span>
              </div>
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
      {step === 3 && category === 'Hyrox' && (
        <div className="flex flex-col gap-4">

          {/* RIEPILOGO TIPO */}
          <div className={`px-4 py-4 rounded-2xl border ${TYPE_INFO[workoutType].border} ${TYPE_INFO[workoutType].bg} flex flex-col gap-3`}>
            <div className="flex items-center justify-between">
              <p className={`font-bold text-sm ${TYPE_INFO[workoutType].color}`}>{workoutSummary()}</p>
              <div className="flex items-center gap-1">
                 <span className={`text-sm font-bold ${getIntensityColor(workoutIntensity)}`}>{workoutIntensity}/10</span>
                 <BicepsFlexed size={18} className={getIntensityColor(workoutIntensity)} />
              </div>
            </div>
            <input type="range" min="1" max="10" value={workoutIntensity} onChange={e => setWorkoutIntensity(e.target.value)} className="w-full accent-[#f1ba17]" />
          </div>

          {/* WARM UP */}
          <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Timer size={16} className="text-gray-400" />
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
                icon={<Flag size={16} className="text-gray-400" />}
                exercises={cashInExercises}
                onAdd={ex => setCashInExercises([...cashInExercises, ex])}
                onRemove={id => setCashInExercises(cashInExercises.filter(e => e.id !== id))}
                onMoveUp={idx => setCashInExercises(moveElement(cashInExercises, idx, idx - 1))}
                onMoveDown={idx => setCashInExercises(moveElement(cashInExercises, idx, idx + 1))}
                onDropIndex={(from, to) => setCashInExercises(moveElement(cashInExercises, from, to))}
                workoutType={workoutType}
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
                    showMinute={workoutType === 'EMOM' || workoutType === 'ON/OFF'}
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
                icon={<FlagOff size={16} className="text-gray-400" />}
                exercises={cashOutExercises}
                onAdd={ex => setCashOutExercises([...cashOutExercises, ex])}
                onRemove={id => setCashOutExercises(cashOutExercises.filter(e => e.id !== id))}
                onMoveUp={idx => setCashOutExercises(moveElement(cashOutExercises, idx, idx - 1))}
                onMoveDown={idx => setCashOutExercises(moveElement(cashOutExercises, idx, idx + 1))}
                onDropIndex={(from, to) => setCashOutExercises(moveElement(cashOutExercises, from, to))}
                workoutType={workoutType}
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
            <button onClick={() => setStep(category === 'Running' ? 1 : 2)} className="flex-1 py-3 rounded-xl border border-[#444] text-gray-400 hover:text-white transition">← Indietro</button>
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

      {/* ── STEP 3: BUILD RUNNING WORKOUT ────────────────── */}
      {step === 3 && category === 'Running' && (
        <div className="flex flex-col gap-4">
          <div className="px-4 py-4 rounded-2xl border border-[#444] bg-[#222] flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Timer size={18} className="text-[#f1ba17]" />
                <span className="font-bold text-[#f1ba17]">Allenamento Corsa</span>
              </div>
              <div className="flex items-center gap-1">
                 <span className={`text-sm font-bold ${getIntensityColor(workoutIntensity)}`}>{workoutIntensity}/10</span>
                 <BicepsFlexed size={18} className={getIntensityColor(workoutIntensity)} />
              </div>
            </div>
            <input type="range" min="1" max="10" value={workoutIntensity} onChange={e => setWorkoutIntensity(e.target.value)} className="w-full accent-[#f1ba17]" />
          </div>

          <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-white font-semibold text-sm">Fasi dell'allenamento</span>
              <button onClick={() => setRunningPickerOpen(true)} className="text-blue-400 hover:brightness-110">
                <Plus size={18} />
              </button>
            </div>

            {runningSteps.length === 0 ? (
              <button onClick={() => setRunningPickerOpen(true)}
                className="w-full py-4 border border-dashed border-[#383838] rounded-xl text-gray-600 text-sm hover:border-[#f1ba17] hover:text-[#f1ba17] transition">
                + Aggiungi prima fase (es. Riscaldamento)
              </button>
            ) : (
              <div className="flex flex-col gap-2">
                {runningSteps.map((step, i) => (
                  <RunningStepRow
                    key={step.id}
                    step={step}
                    index={i}
                    total={runningSteps.length}
                    onRemove={id => setRunningSteps(runningSteps.filter(s => s.id !== id))}
                    onMoveUp={idx => setRunningSteps(moveElement(runningSteps, idx, idx - 1))}
                    onMoveDown={idx => setRunningSteps(moveElement(runningSteps, idx, idx + 1))}
                  />
                ))}
                <button onClick={() => setRunningPickerOpen(true)}
                  className="flex items-center justify-center gap-2 border border-dashed border-[#383838] rounded-xl py-3 text-[#f1ba17] text-sm font-medium mt-1 hover:border-[#f1ba17] transition">
                  <Plus size={16} /> Aggiungi fase
                </button>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="flex-1 py-3 rounded-xl border border-[#444] text-gray-400 hover:text-white transition">← Indietro</button>
            <button onClick={handleSave} disabled={saving}
              className="flex-2 px-6 py-3 rounded-xl bg-[#f1ba17] text-black font-bold hover:brightness-110 transition disabled:opacity-50 flex items-center gap-2">
              <Save size={18} />
              {saving ? 'Salvo...' : saved ? '✅ Salvato!' : 'Salva Workout'}
            </button>
          </div>
        </div>
      )}

      {/* RUNNING STEP PICKER MODAL */}
      {runningPickerOpen && (
        <RunningStepPicker
          onAdd={step => setRunningSteps([...runningSteps, step])}
          onClose={() => setRunningPickerOpen(false)}
        />
      )}

      {/* EXIT CONFIRM MODAL */}
      {showExitConfirm && (
        <div className="fixed inset-0 bg-black/85 z-[100] flex items-center justify-center p-4">
          <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-3xl w-full max-w-sm p-6 flex flex-col gap-4 text-center shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-red-900/30 text-red-500 flex items-center justify-center mx-auto mb-2">
              <AlertTriangle size={32} />
            </div>
            <h2 className="text-xl font-bold text-white">Sei sicuro?</h2>
            <p className="text-gray-400 text-sm">
              Hai delle modifiche non salvate. Se esci ora, i dati andranno persi.
            </p>
            <div className="flex gap-3 mt-4">
              <button 
                onClick={() => setShowExitConfirm(false)}
                className="flex-1 py-3 bg-[#2a2a2a] text-white font-semibold rounded-xl hover:bg-[#333] transition"
              >
                Annulla
              </button>
              <button 
                onClick={() => navigate(pendingPath)}
                className="flex-1 py-3 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-500 transition"
              >
                Sì, esci
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}