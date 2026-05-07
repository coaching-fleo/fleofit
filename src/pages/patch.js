// ─────────────────────────────────────────────────────────────
// PATCH: Come integrare useTouchDrag in CreateWorkout.jsx
// Applica le modifiche indicate nei 4 punti qui sotto.
// ─────────────────────────────────────────────────────────────


// ── 1. IMPORT (in cima al file, insieme agli altri import) ────
import { useTouchDrag } from './useTouchDrag'   // adatta il path


// ── 2. ExerciseRow ───────────────────────────────────────────
// Sostituisci l'intera firma e il JSX del div esterno con:

function ExerciseRow({ ex, index, total, onRemove, onMoveUp, onMoveDown,
  onDragStartIndex, onDragEnterIndex, onDragEndIndex, showMinute, onEdit,
  touchHandlers // <-- aggiunto
}) {
  const detail = isDistance(ex.name)
    ? (ex.meters && ex.meters !== '-' ? ex.meters : '')
    : (ex.reps && ex.reps !== '-' ? `${ex.reps} reps` : '')
  const paceStr = isErgo(ex.name) && ex.ergoPace && ex.ergoPace !== '-' && ex.ergoPace !== 'Libero'
    ? `@ ${ex.ergoPace}` : ''

  return (
    <div
      {...(touchHandlers ? touchHandlers(index) : {})}   // touch iOS
      draggable
      onDragStart={(e) => {
        e.stopPropagation()
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', index.toString())
        setTimeout(() => e.target?.classList?.add('opacity-30', 'scale-[0.98]', 'shadow-lg'), 0)
        onDragStartIndex?.(index)
      }}
      onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); onDragEnterIndex?.(index) }}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move' }}
      onDragEnd={(e) => {
        e.stopPropagation()
        e.target?.classList?.remove('opacity-30', 'scale-[0.98]', 'shadow-lg')
        onDragEndIndex?.()
      }}
      data-drag-item   // <-- attributo per useTouchDrag
      className="drag-item flex items-center gap-3 bg-[#222] border border-[#2e2e2e] rounded-2xl px-4 py-3 cursor-move hover:border-[#444] transition-all duration-200"
    >
      {/* ...resto invariato... */}
    </div>
  )
}


// ── 3. HyroxBlock — blocco esercizi ──────────────────────────
// Dentro HyroxBlock, prima del return aggiungi:

function HyroxBlock({ block, index, total, isOpen, onToggle, onUpdate, onRemove,
  onMoveUp, onMoveDown, onDragStartIndex, onDragEnterIndex, onDragEndIndex, onDuplicate,
  touchHandlers // <-- aggiunto
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [editingExercise, setEditingExercise] = useState(null)
  const [draggedExIdx, setDraggedExIdx] = useState(null)

  // Hook touch per riordinare gli ESERCIZI dentro questo blocco
  const { getTouchHandlers: getExTouchHandlers } = useTouchDrag({
    onReorder: (from, to) => {
      onUpdate({ ...block, exercises: moveElement(block.exercises, from, to) })
    }
  })

  // ...updateParam, updateNotes, c, getBlockRecap invariati...

  return (
    <div
      {...(touchHandlers ? touchHandlers(index) : {})}   // touch iOS per i BLOCCHI
      draggable
      onDragStart={(e) => {
        e.stopPropagation()
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', index.toString())
        setTimeout(() => e.target?.classList?.add('opacity-30', 'scale-[0.98]', 'shadow-lg'), 0)
        onDragStartIndex?.(index)
      }}
      onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); onDragEnterIndex?.(index) }}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move' }}
      onDragEnd={(e) => {
        e.stopPropagation()
        e.target?.classList?.remove('opacity-30', 'scale-[0.98]', 'shadow-lg')
        onDragEndIndex?.()
      }}
      data-drag-item   // <-- attributo per useTouchDrag
      className={`drag-item bg-[#1e1e1e] border ${isOpen ? c.border : 'border-[#333] hover:border-[#444]'} rounded-2xl p-4 flex flex-col gap-3 relative cursor-move transition-all duration-200`}
    >
      {/* ...header invariato... */}

      {isOpen && (
        <div className="flex flex-col gap-3 animate-in fade-in duration-200">
          {/* ...pickers params invariati... */}

          {!['WarmUp', 'Rest'].includes(block.type) && (
            <>
              {/* Wrapper con data-drag-container per gli esercizi */}
              <div className="flex flex-col gap-2 mt-2" data-drag-container>
                {(block.exercises || []).map((ex, i) => (
                  <ExerciseRow
                    key={ex.id} ex={ex} index={i} total={block.exercises.length}
                    showMinute={block.type === 'EMOM' || block.type === 'ON/OFF'}
                    onRemove={(id) => onUpdate({ ...block, exercises: block.exercises.filter(e => e.id !== id) })}
                    onMoveUp={(idx) => onUpdate({ ...block, exercises: moveElement(block.exercises, idx, idx - 1) })}
                    onMoveDown={(idx) => onUpdate({ ...block, exercises: moveElement(block.exercises, idx, idx + 1) })}
                    onDragStartIndex={(idx) => setDraggedExIdx(idx)}
                    onDragEnterIndex={(idx) => {
                      if (draggedExIdx !== null && draggedExIdx !== idx) {
                        onUpdate({ ...block, exercises: moveElement(block.exercises, draggedExIdx, idx) })
                        setDraggedExIdx(idx)
                      }
                    }}
                    onDragEndIndex={() => setDraggedExIdx(null)}
                    onEdit={(exToEdit) => { setEditingExercise(exToEdit); setPickerOpen(true) }}
                    touchHandlers={getExTouchHandlers}   // <-- passa i touch handlers
                  />
                ))}
              </div>
              {/* ...bottone aggiungi esercizio invariato... */}
            </>
          )}
        </div>
      )}
    </div>
  )
}


// ── 4. CreateWorkout — lista blocchi e running steps ─────────
// Dentro CreateWorkout(), prima del return, aggiungi le due hook:

//   Hook touch per riordinare i BLOCCHI HYROX
const { getTouchHandlers: getBlockTouchHandlers } = useTouchDrag({
  onReorder: (from, to) => setBlocks(prev => moveElement(prev, from, to))
})

//   Hook touch per riordinare le FASI RUNNING
const { getTouchHandlers: getStepTouchHandlers } = useTouchDrag({
  onReorder: (from, to) => setRunningSteps(prev => moveElement(prev, from, to))
})

// Poi nel JSX, aggiungi data-drag-container al wrapper della lista blocchi:
//
//   <div className="flex flex-col gap-4" data-drag-container>
//     {blocks.map((block, idx) => (
//       <HyroxBlock
//         ...
//         touchHandlers={getBlockTouchHandlers}   // <-- aggiunto
//       />
//     ))}
//   </div>
//
// E al wrapper della lista running steps:
//
//   <div className="flex flex-col gap-2" data-drag-container>
//     {runningSteps.map((step, i) => (
//       <RunningStepRow
//         ...
//         touchHandlers={getStepTouchHandlers}   // <-- aggiunto
//       />
//     ))}
//   </div>


// ── 5. RunningStepRow ─────────────────────────────────────────
// Stessa modifica di ExerciseRow: aggiungi touchHandlers prop e spread sul div:
//
//   function RunningStepRow({ ..., touchHandlers }) {
//     return (
//       <div
//         {...(touchHandlers ? touchHandlers(index) : {})}
//         data-drag-item
//         draggable
//         ...
//       >


// ── 6. RIMUOVI il polyfill CDN da useEffect ───────────────────
// Elimina completamente questo blocco (non serve più):
//
//   useEffect(() => {
//     const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
//     if (isMobile && typeof window !== 'undefined' && !window.dndPolyfillInjected) {
//       window.dndPolyfillInjected = true
//       const script = document.createElement('script')
//       script.src = 'https://cdn.jsdelivr.net/npm/mobile-drag-drop@2.3.0/index.min.js'
//       ...
//     }
//   }, [])