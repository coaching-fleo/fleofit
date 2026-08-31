import { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Trash2, Save, X, ChevronRight, Timer, Dumbbell, ChevronUp, ChevronDown, AlertTriangle, BicepsFlexed, Copy, ChevronLeft, Wand2, Mic, Square, FileText, ArrowRight } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { CustomAlert, CustomConfirm } from '../components/CustomModals'
import { Capacitor } from '@capacitor/core'
import { VoiceRecorder } from 'capacitor-voice-recorder'
import CustomDatePicker from '../components/CustomDatePicker'
import { useTouchDrag } from '../useTouchDrag'
import { blockHint } from '../lib/blockHints'
import { format, parseISO, isValid } from 'date-fns'
import { it } from 'date-fns/locale'
import { generaTitolo, titoloOppureGenerato, titoliDelGiorno } from '../lib/workoutTitle'
import { ERGOMETERS } from '../lib/constants'
import { mostraErrore } from '../lib/alert'
import { battito } from '../lib/aptica'
import { TYPE_COLORS } from '../lib/blockColors'
import { conVelo, coloreDaClasse, BRAND, RUNNING, CUSTOM, IA } from '../lib/colori'
import { CARD, LABEL, VETRO } from '../lib/stiliCard'
import { riepilogoWorkout, durataBlocco, mmss, BLOCCHI_DI_LAVORO } from '../lib/stimaWorkout'
import {
  TestataCrea, CardCategoria, RigaCampo, RiepilogoWorkout, SpinaBlocco, DurataBlocco,
  NumeroEsercizio, CardIA, BottoneGhost, BarraAzioni, CtaPrimaria, BottoneQuadrato,
  Stepper, RigaUltimaVolta, RuotaValori, RigaTesto,
} from '../components/CreaWorkoutUI'
import { chiudiTastieraSuInvio } from '../useTastiera'
import { useBottomSheet } from '../useBottomSheet'
import AudioVisualizer from '../components/AudioVisualizer'


// ─── COSTANTI ────────────────────────────────────────────────
const HYROX_EXERCISES = [
  'Assault Bike', 'Atlas Stone Load', 'Axle Bar Clean', 'Axle Bar Deadlift',
  'Back Lunge', 'Back Squat', 'Bar Muscle-up', 'Bar Pullover', 'Battle Ropes', 'Bear Crawl', 'Box Jump', 'Burpees', 'Burpees Broad Jumps', 'Burpees Jump',
  'Chest-to-Bar', 'Clean', 'Cluster', 'Crossover Double Unders', 'Curve Treadmill',
  'D-Ball Clean', 'Deadlift', 'Deficit Deadlift', 'Deficit Handstand Push-up', 'Devil Press', 'Double Unders', 'Dragon Flag', 'Dual Dumbbell Clean and Jerk', 'Dual Dumbbell Snatch', 'Dumbbell Box Step-Over', 'Dumbbell Snatch', 'Dumbbell Step-Up',
  'Echo Bike',
  'Farmers Carry', 'Farmers Walk', 'Freestanding Handstand Push-up', 'Front Lunge', 'Front Squat',
  'GHD Back Extension', 'GHD Hip Extension', 'GHD Sit-up', 'Good Morning',
  'Handstand Push-up', 'Handstand Walk', 'Hang Power Clean', 'Hang Power Snatch', 'Hang Squat Clean', 'Hang Squat Snatch', 'Hollow Body Hold', 'Hollow Rock',
  'Jumping Jack', 'Jumping Muscle-up',
  'Kettlebell Clean and Press', 'Kettlebell Goblet Squat', 'Kettlebell Snatch', 'Kettlebell Swing',
  'L-Sit', 'Log Press',
  'Man Maker', 'Military Press', 'Muscle Clean', 'Muscle Snatch',
  'Overhead Squat', 'Overhead Walking Lunge',
  'Pegboard Ascent', 'Pistol Squat', 'Plank', 'Power Clean', 'Power Snatch', 'Prowler Push', 'Pull-up', 'Push Jerk', 'Push Press', 'Push Up',
  'Rest', 'Ring Dips', 'Ring Muscle-up', 'Romanian Deadlift', 'Rope Climb', 'Rowing', 'Run',
  'Sandbag Bear Hug Squat', 'Sandbag Carry', 'Sandbag Lunges', 'Sandbag Over Shoulder', 'Shuttle Run', 'SkiErg', 'Skin the Cat', 'Sled Drag', 'Sled Pull', 'Sled Push', 'Snatch Balance', 'Sots Press', 'Split Jerk', 'Squat', 'Squat Clean', 'Squat Jack', 'Squat Snatch', 'Strict Handstand Push-up', 'Strict Muscle-up', 'Strict Press', 'Strict Pull-up', 'Suitcase Carry', 'Suitcase Deadlift', 'Sumo Deadlift', 'Sumo Deadlift High Pull', 'Superman Rock', 'Swim',
  'Thruster', 'Tire Flip', 'Toes-to-Bar', 'Triple Unders', 'TrueForm Runner', 'Turkish Get-Up',
  'V-Up',
  "Waiter's Walk", 'Wall Balls', 'Wall Walk', 'Weighted Pull-up',
  'Yoke Carry',
  'Zercher Squat'
]

const isErgo = (name) => ERGOMETERS.includes(name)

const SLED_EXERCISES = ['Sled Push', 'Sled Pull', 'Prowler Push', 'Sled Drag']
const isSled = (name) => SLED_EXERCISES.includes(name)
const CARRY_EXERCISES = ['Farmers Carry', 'Farmers Walk', 'Suitcase Carry', 'Sandbag Carry', 'Yoke Carry', "Waiter's Walk", 'Handstand Walk', 'Bear Crawl']
const isCarry = (name) => CARRY_EXERCISES.includes(name)
const DISTANCE_EXERCISES = [
  'Farmers Carry', 'Farmers Walk', 'Suitcase Carry', 'Sandbag Carry', 'Yoke Carry', 
  "Waiter's Walk", 'Handstand Walk', 'Run', 'Bear Crawl', 'Shuttle Run', 'Swim'
]

const HYBRID_EXERCISES = ['Sandbag Lunges', 'Burpees Broad Jumps']
const isHybrid = (name) => HYBRID_EXERCISES.includes(name)

const isDistance = (name) => isErgo(name) || isSled(name) || DISTANCE_EXERCISES.includes(name)

const METERS_OPTIONS = [
   '-', 'Max','50m','100m','150m','200m','250m','300m','400m','500m',
  '600m','750m','1000m','1500m','2000m'
]
const HYBRID_METERS_OPTIONS = ['-', 'Max', ...Array.from({ length: 50 }, (_, i) => `${(i + 1) * 10}m`)]
const SLED_METERS_OPTIONS = ['-', 'Max', ...Array.from({ length: 30 }, (_, i) => `${(i + 1) * 10}m`)]
const CARRY_METERS_OPTIONS = ['-', 'Max', ...Array.from({ length: 50 }, (_, i) => `${(i + 1) * 10}m`)]
const REPS_OPTIONS = ['-', 'Max', ...Array.from({ length: 100 }, (_, i) => `${i + 1}`)]
const TIME_OPTIONS = [
  '-',
  ...Array.from({ length: 120 }, (_, i) => { // Fino a 10:00 in scatti da 5 sec
    const s = (i + 1) * 5;
    return `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;
  }),
  ...Array.from({ length: 220 }, (_, i) => { // Da 10:30 a 120:00 in scatti da 30 sec
    const s = 600 + (i + 1) * 30;
    return `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;
  })
]

const REST_TIME_OPTIONS = [
  '-',
  ...Array.from({ length: 90 }, (_, i) => { // Fino a 15:00 in scatti da 10 sec
    const s = (i + 1) * 10;
    return `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;
  })
]

const ROUNDS_OPTIONS = Array.from({ length: 40 }, (_, i) => `${i + 1}`)
const KG_OPTIONS = [
  '-',
  'Nessun peso',
  ...Array.from({ length: 300 }, (_, i) => `${i + 1} kg`),
  ...[4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32].map(w => `2x${w} kg`)
]

// ─── COSTANTI RUNNING ─────────────────────────────────────────
const RUN_TIME_OPTIONS = [
  ...Array.from({ length: 60 }, (_, i) => `${i + 1} min`),
  ...Array.from({ length: 12 }, (_, i) => `${(i + 1) * 5} sec`)
]

const RUN_DISTANCE_OPTIONS = [
  ...Array.from({ length: 10 }, (_, i) => `${(i + 1) * 10}m`),
  '150m', '200m', '250m', '300m', '400m', '500m', '600m', '800m', '1 km', '1.5 km', '2 km', '3 km', '4 km', '5 km', '10 km', '15 km', '21 km', '42 km'
]
const RUN_PACE_OPTIONS = [
  'Libero', 'Camminata', 'Z1', 'Z2', 'Z3', 'Z4', 'Z5', 'All out', 'Gara',
  ...Array.from({ length: 96 }, (_, i) => {
    const s = 120 + i * 5;
    return `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')} /km`;
  })
]

const SPEED_OPTIONS = ['-', ...Array.from({ length: 41 }, (_, i) => `${(5 + i * 0.5).toFixed(1)} km/h`)]

const ERGO_PACE_OPTIONS = [
  '-', 'Libero', 'Gara Singola', 'Gara Doppia', 'Z1', 'Z2', 'Z3', 'Z4', 'Z5', 'All out',
  ...Array.from({ length: 61 }, (_, i) => {
    const s = 90 + i * 5;
    return `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')} /500m`;
  }),
  ...Array.from({ length: 17 }, (_, i) => `${40 + i * 5} RPM`)
]

const MAX_PACE_OPTIONS = ['-', ...RUN_PACE_OPTIONS]

const RUN_REPEAT_ROUNDS_OPTIONS = Array.from({ length: 30 }, (_, i) => `${i + 1}`)

// ─── VALORI A PORTATA DI POLLICE ──────────────────────────────────────────
// I «quick value» degli Stepper (§3d del redesign): non sono un sottoinsieme
// casuale delle liste complete, sono i valori che il coach usa davvero. Le liste
// intere restano — servono al passo del meno/più e alla digitazione — ma non si
// scorrono più alla cieca.
const RAPIDI_REPS = ['10', '15', '20', '30', '50']
const RAPIDI_KG = ['-', '6 kg', '9 kg', '14 kg', '20 kg']
const RAPIDI_METRI = ['-', '100m', '250m', '500m', '1000m']
const RAPIDI_DURATA = ['1:00', '2:00', '3:00', '5:00', '10:00']
const RAPIDI_REST = ['0:30', '1:00', '1:30', '2:00', '3:00']
const RAPIDI_LAVORO = ['0:20', '0:30', '0:40', '1:00', '1:30']
const RAPIDI_INTERVALLO = ['0:30', '1:00', '1:30', '2:00', '3:00']
const RAPIDI_AMRAP = ['5:00', '8:00', '10:00', '12:00', '20:00']
const RAPIDI_ROUNDS = ['3', '5', '8', '10', '20']

// ─── I GENERI DEL PASSO ───────────────────────────────────────────────────
// La scelta del passo ha DUE domande, non una: di che tipo di passo si parla, e
// poi quale valore. Il primo è un elenco corto da vedere tutto insieme, il
// secondo una scala fitta su cui si aggiusta per gradi — e sono due controlli
// diversi (vedi la nota lunga su `RuotaValori`).
//
// ⚠️ I generi sono DERIVATI dalle costanti con dei `filter`, non ricopiati:
// i valori ammessi restano quelli delle liste, e aggiungerne uno lo fa comparire
// qui da solo. L'etichetta perde il suffisso perché lo dice già l'intestazione
// del genere, ma il valore scelto resta INTERO: è quello che finisce in
// `workouts.sections`, su un database condiviso con la web app.
const voce = (v, etichetta) => ({ valore: v, etichetta: etichetta ?? v })
const senza = (suffisso) => (v) => voce(v, v.replace(suffisso, '').trim())
const NIENTE = voce('-', '—')

const GENERI_PASSO_ERGO = [
  { id: 'sensazione', titolo: 'A sensazione', opzioni: [NIENTE, ...ERGO_PACE_OPTIONS.filter(v => v !== '-' && !v.includes('/500m') && !v.endsWith('RPM')).map(v => voce(v))] },
  { id: 'ritmo', titolo: 'Ritmo', unita: '/500m', opzioni: [NIENTE, ...ERGO_PACE_OPTIONS.filter(v => v.includes('/500m')).map(senza('/500m'))] },
  { id: 'cadenza', titolo: 'Cadenza', unita: 'RPM', opzioni: [NIENTE, ...ERGO_PACE_OPTIONS.filter(v => v.endsWith('RPM')).map(senza('RPM'))] },
]

const GENERI_PASSO_CORSA = [
  { id: 'sensazione', titolo: 'A sensazione', opzioni: [NIENTE, ...RUN_PACE_OPTIONS.filter(v => !v.includes('/km')).map(v => voce(v))] },
  { id: 'ritmo', titolo: 'Ritmo', unita: '/km', opzioni: [NIENTE, ...RUN_PACE_OPTIONS.filter(v => v.includes('/km')).map(senza('/km'))] },
]

const GENERI_VELOCITA = [
  { id: 'velocita', titolo: 'Velocità', unita: 'km/h', opzioni: [NIENTE, ...SPEED_OPTIONS.filter(v => v !== '-').map(senza('km/h'))] },
]

const RAPIDI_METRI_CORTI = ['-', '20m', '50m', '100m', '200m']

/** Quanti workout recenti si scandagliano per la riga «ultima volta». */
const STORICO_WORKOUT = 40

// ─── LE TRE CATEGORIE ─────────────────────────────────────────────────────
// Erano tre segmenti dentro un toggle, cioè una scelta presentata come un
// dettaglio di configurazione. È invece LA domanda del primo schermo, e ognuna
// porta una riga che dice cosa aspettarsi: chi non conosce il gergo non deve
// scegliere alla cieca fra «Hyrox» e «Custom».
//
// ⚠️ `id` è il valore salvato in `workouts.sections.category` e NON si tocca:
// il database è condiviso con la web app in produzione. L'etichetta è un'altra
// cosa — «Running» si legge «Corsa».
const CATEGORIE = [
  { id: 'Hyrox',   nome: 'Hyrox',  descrizione: 'Blocchi, esercizi, EMOM e AMRAP', colore: BRAND,   testoSuColore: '#000' },
  { id: 'Running', nome: 'Corsa',  descrizione: 'Fasi, passo e ripetute',          colore: RUNNING, testoSuColore: '#fff' },
  { id: 'Custom',  nome: 'Custom', descrizione: 'Solo una descrizione scritta',    colore: CUSTOM,  testoSuColore: '#fff' },
]
const ICONA_CATEGORIA = { Hyrox: Dumbbell, Running: Timer, Custom: FileText }
const categoriaCorrente = (id) => CATEGORIE.find(c => c.id === id) || CATEGORIE[0]

/**
 * Il meno e il più si muovono DENTRO la lista completa, non su un numero.
 *
 * È la ragione per cui un solo componente basta a reps, kg, tempi e passi:
 * i passi ("2:00" → "2:05", "9 kg" → "10 kg", "Z2" → "Z3") sono già codificati
 * nell'ordine delle liste esistenti, che restano la fonte dei valori ammessi.
 * Un `value + 1` avrebbe funzionato solo sui numeri interi.
 */
const passoInLista = (lista, valore, direzione) => {
  if (!lista || lista.length === 0) return valore
  const i = lista.findIndex(o => String(o) === String(valore))
  if (i === -1) return lista[0]
  const prossimo = i + direzione
  if (prossimo < 0 || prossimo >= lista.length) return valore
  return lista[prossimo]
}

/**
 * Il dettaglio di un esercizio in una riga ("500m @ 1:52 · 9kg").
 *
 * Era ricalcolato in tre punti di questo file con tre varianti leggermente
 * diverse (CLAUDE.md §9 punto 1). Una sola copia, e la riga «ultima volta» la
 * riusa senza inventarsi un quarto formato.
 */
const dettaglioEsercizio = (ex) => {
  if (!ex) return ''
  const misura = ex.exTime && ex.exTime !== '-'
    ? ex.exTime
    : ((ex.meters && ex.meters !== '-') ? ex.meters : (ex.reps && ex.reps !== '-' ? `${ex.reps} reps` : ''))
  const passo = (isErgo(ex.name) || ex.name === 'Run') && ex.ergoPace && ex.ergoPace !== '-' && ex.ergoPace !== 'Libero' ? `@ ${ex.ergoPace}` : ''
  const velocita = ex.name === 'Run' && ex.speed && ex.speed !== '-' ? `@ ${ex.speed}` : ''
  const peso = ex.kg ? `${ex.kg}kg` : ''
  return [misura, passo, velocita, peso].filter(Boolean).join(' ')
}

export const getIntensityColor = (val) => {
  const num = parseInt(val, 10);
  if (isNaN(num)) return 'text-muted';
  if (num <= 4) return 'text-gray-400';
  if (num <= 7) return 'text-gray-300';
  if (num <= 9) return 'text-white';
  return 'text-brand';
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
function ScrollPicker({ options = [], value, onChange, label, type, isRun }) {
  const displayOptions = type === 'time' && (!options || options.length === 0) ? TIME_OPTIONS : options || []
  const containerRef = useRef(null)
  const [isScrolling, setIsScrolling] = useState(false)
  const scrollTimeout = useRef(null)
  const activeTextColor = isRun ? 'text-running' : 'text-brand'
  const activeBorderColor = isRun ? 'border-running/25' : 'border-brand/25'

  useEffect(() => {
    const index = displayOptions.findIndex(opt => String(opt) === String(value))
    if (index !== -1 && containerRef.current && !isScrolling) {
       containerRef.current.scrollTop = index * 40
    }
  }, [value, isScrolling, displayOptions])

  const handleScroll = () => {
    setIsScrolling(true)
    clearTimeout(scrollTimeout.current)
    
    const el = containerRef.current
    if (!el) return
    
    const index = Math.round(el.scrollTop / 40)
    if (displayOptions[index] !== undefined && String(displayOptions[index]) !== String(value)) {
      onChange(displayOptions[index])
      battito()
    }

    scrollTimeout.current = setTimeout(() => {
      setIsScrolling(false)
    }, 150)
  }

  return (
    <div className="flex flex-col gap-1">
      {label && <p className="text-gray-400 text-xs">{label}</p>}
      <div 
        ref={containerRef}
        onScroll={handleScroll}
        className="relative h-36 overflow-y-scroll snap-y snap-mandatory bg-[#0B0B0B] rounded-xl border border-[#383838] hide-scrollbar"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        <div className="py-[52px]">
          {displayOptions.map(opt => (
            <div key={opt} onClick={() => onChange(opt)}
              className={`snap-center h-10 flex items-center justify-center text-sm cursor-pointer select-none transition-colors
                ${String(value) === String(opt) ? `${activeTextColor} font-bold text-base` : 'text-gray-400 hover:text-gray-400'}`}>
              {opt}
            </div>
          ))}
        </div>
        <div className={`pointer-events-none absolute inset-x-4 top-[52px] h-10 border-y ${activeBorderColor} rounded`} />
      </div>
    </div>
  )
}

function BlockPickerModal({ onAdd, onClose }) {
    const blockTypes = ['WarmUp', 'Cash In', 'ON/OFF', 'EMOM', 'AMRAP', 'For Time', 'Interval', 'Rest', 'Cash Out']

  return createPortal(
    <div className="fixed inset-0 bg-black/85 z-[60] flex items-center justify-center p-4">
      <div className="bg-[#1e1e1e] rounded-3xl w-full max-w-sm p-5 border border-[#333] animate-in fade-in zoom-in-[0.96] duration-300 ease-out">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-white font-bold text-lg">Aggiungi Blocco</h3>
          <button aria-label="Chiudi" onClick={onClose} className="text-muted hover:text-white"><X size={20}/></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {blockTypes.map(t => (
            <button key={t} onClick={() => onAdd(t)} className="bg-[#2a2a2a] border border-[#383838] text-white font-medium py-3 px-2 rounded-xl hover:border-brand hover:text-brand transition text-sm flex flex-col items-center gap-0.5 group">
              <span>{t}</span>
              <span className="text-[11px] font-normal text-muted group-hover:text-brand/70 leading-tight text-center">{blockHint(t)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  )
}

function IntensityPicker({ value, onChange, activeColor = 'bg-brand' }) {
  const segments = Array.from({ length: 10 }, (_, i) => i + 1);
  const containerRef = useRef(null);
  const isDragging = useRef(false);

  const calculateValue = (clientX) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    let x = clientX - rect.left;
    if (x < 0) x = 0;
    if (x > rect.width) x = rect.width;
    
    let newValue = Math.ceil((x / rect.width) * 10);
    if (newValue < 1) newValue = 1;
    if (newValue > 10) newValue = 10;
    
    if (String(newValue) !== String(value)) {
      onChange(String(newValue));
      battito()
    }
  };

  const handlePointerDown = (e) => {
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
    };
  }, []);

  return (
    <div 
      ref={containerRef}
      className="flex items-center gap-1.5 w-full pt-1 cursor-pointer touch-none select-none"
      onMouseDown={handlePointerDown}
      onMouseMove={handlePointerMove}
      onTouchStart={handlePointerDown}
      onTouchMove={handlePointerMove}
    >
      {segments.map(s => (
        <div
          key={s}
          className={`flex-1 h-8 rounded-lg transition-all duration-75 ${
            s <= parseInt(value)
              ? `${activeColor} shadow-lg`
              : 'bg-[#333]'
          }`}
          style={{
            boxShadow: s <= parseInt(value) ? `0 4px 15px ${conVelo(coloreDaClasse(activeColor), 0.3)}` : 'none',
            pointerEvents: 'none'
          }}
        />
      ))}
    </div>
  );
}

// ─── «GENERA CON IA» ──────────────────────────────────────────
//
// Rifatta il 28/08/2026 sulla cornice del builder. Era l'ultima superficie
// della pagina rimasta al vocabolario di prima — card centrata, bordo #333,
// bottone pieno in fondo — in uno schermo dove tutto il resto è carta
// sollevata, vetro e foglio che sale dal basso.
//
// Le tre cose che NON sono estetica:
//
// 1. 🔴 **L'entrata non esisteva.** La classe era `animate-in fade-in
//    zoom-in-[0.96]`, cioè tw-animate-css, che NON è installato: genera zero
//    CSS (CLAUDE.md §9-duodecies punto 1, la stessa trappola del menu della
//    scheda). La modale compariva di scatto. Ora è un bottom sheet vero, con
//    `useBottomSheet`: entrata, maniglia che si trascina, pagina sotto ferma.
// 2. **La tastiera non sale più da sola.** L'`autoFocus` sul textarea la
//    apriva su una superficie il cui gesto principale è il MICROFONO: si
//    arrivava qui per dettare e si trovava mezzo schermo occupato. Con
//    l'autoFocus se n'è andato anche `-translate-y-36`, che era il rimedio a
//    un problema che non esiste più: il foglio è ancorato in basso, e con
//    `Keyboard.resize: 'native'` la webview si rimpicciolisce, quindi resta
//    sopra la tastiera da sé.
// 3. **La forma d'onda è VERA.** Prima l'alone pulsava su
//    `1 + Math.random() * 0.4` ogni 150ms: si muoveva identico a microfono
//    muto, permesso negato o telefono in tasca — cioè diceva «ti sento»
//    proprio quando non era vero. Ora i livelli arrivano dal microfono
//    (`AudioVisualizer`, lo stesso delle note vocali), quindi il silenzio si
//    vede.

/**
 * I formati che `ai-workout` può girare a Gemini come `inlineData`.
 *
 * ⚠️ `audio/webm` NON è fra questi, ed è la ragione per cui sul web si
 * continua a usare il riconoscimento del browser invece di spedire l'audio:
 * su desktop MediaRecorder produce webm/opus, che Gemini rifiuta. Su iOS
 * `audio/mp4` è supportato, ed è quello che si usa.
 */
const FORMATI_AUDIO = ['audio/mp4', 'audio/aac', 'audio/mpeg', 'audio/wav']

const formatoRegistrabile = () => {
  if (!window.MediaRecorder || !window.MediaRecorder.isTypeSupported) return null
  return FORMATI_AUDIO.find(t => window.MediaRecorder.isTypeSupported(t)) || null
}

/**
 * Le due soglie sul livello del microfono, e sono DUE di proposito.
 *
 * `AudioVisualizer` riporta il **picco** della finestra, non la media (vedi la
 * nota lì dentro: la media su 24 bande resta bassa anche mentre si parla).
 *
 * - `SOGLIA_VOCE` accende «Ti sento»: è un'etichetta, deve seguire il parlato.
 * - `SOGLIA_SEGNALE` è molto più bassa, e serve SOLO a decidere se il microfono
 *   è vivo. 🔴 Le due erano una sola, ed è il motivo per cui «non arriva nessun
 *   suono» compariva mentre il suono arrivava eccome: un avviso che accusa il
 *   microfono deve avere l'asticella dove la mette un guasto vero, non dove la
 *   mette una voce tranquilla.
 */
const SOGLIA_VOCE = 0.22
const SOGLIA_SEGNALE = 0.07

/**
 * Dopo quanti secondi senza MAI un segnale si avvisa.
 *
 * ⚠️ È l'unica cosa in pagina che distingue «funziona» da «morto». Una forma
 * d'onda piatta la si legge come «sto zitto io», non come «il microfono non
 * riceve». Ma un falso allarme costa più del silenzio che previene — chi legge
 * «non ti sento» mentre lo si sente smette di credere all'avviso — quindi la
 * finestra è lunga e l'asticella è bassa.
 */
const SECONDI_MUTO = 6

/** Dopo quanto la generazione smette di essere «pochi secondi». */
const MS_ATTESA_LUNGA = 9000

const mmssSecondi = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

function AiGenerationModal({ onClose, onGenerate }) {
  const { chiudi, maniglia, stileFoglio, stileVelo, classeFoglio, classeVelo } = useBottomSheet(onClose)

  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)

  const [isListening, setIsListening] = useState(false)
  const [interimResult, setInterimResult] = useState('')
  const [mediaStream, setMediaStream] = useState(null)
  const [livello, setLivello] = useState(0)
  const [secondi, setSecondi] = useState(0)
  // Se il microfono ha prodotto ALMENO una volta un suono. Non si azzera
  // durante la dettatura: serve a distinguere «ora sto zitto» da «non ha mai
  // funzionato», che a forma d'onda ferma sono la stessa immagine.
  const [haSentito, setHaSentito] = useState(false)
  const [attesaLunga, setAttesaLunga] = useState(false)
  // Da dove arriva l'attesa: dalla voce o dal testo scritto. Sono due lavori
  // diversi — nel primo Gemini deve prima ASCOLTARE — e dirlo storto è il modo
  // di far sembrare rotta un'attesa che sta andando bene.
  const [attesaDaVoce, setAttesaDaVoce] = useState(false)

  const recognitionRef = useRef(null)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)
  const orologio = useRef(null)
  const orologioAttesa = useRef(null)
  // Quale dei due registratori è in uso ADESSO. Non si può ridecidere allo stop
  // guardando `isNativePlatform`: dipende anche da MediaRecorder e dallo stream,
  // che a quel punto potrebbero non esserci più (stessa nota di VoiceRecorder).
  const conPluginNativo = useRef(false)
  // Il foglio si è chiuso mentre il microfono era acceso: `onstop` arriva dopo,
  // e non deve generare niente.
  const annullato = useRef(false)
  // Il testo al momento dello stop, non quello catturato all'avvio: `onstop`
  // nasce quando la registrazione parte, e lì il campo poteva essere vuoto.
  const testoRef = useRef('')
  useEffect(() => { testoRef.current = text })

  const isNative = Capacitor.isNativePlatform()

  // ── Il riconoscimento del browser, per quando si prova l'app dal PC ──────
  useEffect(() => {
    if (isNative) return
    const WebSpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!WebSpeechRecognition) return

    const recognition = new WebSpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'it-IT'

    recognition.onresult = (event) => {
      let finalTrans = ''
      let interimTrans = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) finalTrans += transcript + ' '
        else interimTrans += transcript
      }
      if (finalTrans) setText(prev => (prev + ' ' + finalTrans).trim())
      setInterimResult(interimTrans)
    }
    recognition.onerror = (event) => {
      console.error('Speech recognition error', event.error)
      setIsListening(false)
    }
    recognition.onend = () => {
      setIsListening(false)
      setInterimResult('')
    }
    recognitionRef.current = recognition
  }, [isNative])

  // ── L'attesa ────────────────────────────────────────────────────────────
  // Fermata la registrazione, Gemini deve prima ASCOLTARE e poi scrivere: sono
  // secondi in cui non succede niente a schermo. Prima il foglio tornava al
  // campo di testo — vuoto, perché sul nativo la trascrizione non c'è ancora —
  // e l'unico segnale era la CTA disabilitata al 40%: si leggeva come «non ha
  // funzionato», e il gesto naturale era premere di nuovo il microfono.
  const iniziaAttesa = useCallback((daVoce = false) => {
    setLoading(true)
    setAttesaDaVoce(daVoce)
    setAttesaLunga(false)
    clearTimeout(orologioAttesa.current)
    orologioAttesa.current = setTimeout(() => setAttesaLunga(true), MS_ATTESA_LUNGA)
  }, [])

  const fineAttesa = useCallback(() => {
    clearTimeout(orologioAttesa.current)
    setLoading(false)
    setAttesaLunga(false)
  }, [])

  /** Il livello del microfono, da `AudioVisualizer`. Stabile: entra in un ref. */
  const suLivello = useCallback((v) => {
    setLivello(v)
    if (v > SOGLIA_SEGNALE) setHaSentito(true)
  }, [])

  /** Spegne tutto quello che tiene aperto il microfono. */
  const spegniMicrofono = useCallback(() => {
    clearInterval(orologio.current)
    setLivello(0)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setMediaStream(null)
  }, [])

  useEffect(() => () => {
    // Si sta chiudendo: qualunque cosa il microfono avesse in canna va buttata.
    annullato.current = true
    clearInterval(orologio.current)
    clearTimeout(orologioAttesa.current)
    try { recognitionRef.current?.stop() } catch { /* già ferma */ }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try { recorderRef.current.stop() } catch { /* già ferma */ }
    }
    if (conPluginNativo.current) VoiceRecorder.stopRecording().catch(() => {})
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
  }, [])

  // ── La chiamata a Gemini, una sola per i due percorsi ────────────────────
  const chiamaIA = useCallback(async (body) => {
    iniziaAttesa(!!body.audioBase64)
    try {
      const { data, error } = await supabase.functions.invoke('ai-workout', { body })
      if (error) {
        let errorMsg = error.message
        if (error.context && typeof error.context.json === 'function') {
          // Se il corpo dell'errore non è JSON leggibile resta errorMsg = error.message,
          // che è già il messaggio giusto da mostrare: nessun altro rimedio possibile.
          try { const errBody = await error.context.json(); if (errBody && errBody.error) errorMsg = errBody.error } catch { /* si tiene error.message */ }
        }
        throw new Error(errorMsg)
      }
      if (data?.error) throw new Error(data.error)
      onGenerate(data?.blocks || [])
      chiudi()
    } catch (e) {
      let msg = e.message
      if (msg.includes('503') || msg.toLowerCase().includes('high demand') || msg.toLowerCase().includes('overloaded')) {
        msg = "I server dell'Intelligenza Artificiale sono attualmente sovraccarichi. Riprova tra qualche istante."
      }
      mostraErrore('Errore generazione IA: ' + msg)
    } finally {
      fineAttesa()
    }
  }, [onGenerate, chiudi, iniziaAttesa, fineAttesa])

  const inviaAudio = useCallback(async (blob, mimeType) => {
    try {
      const base64 = await new Promise((risolvi, rifiuta) => {
        const lettore = new FileReader()
        lettore.onerror = () => rifiuta(new Error('Audio illeggibile'))
        lettore.onload = () => risolvi(String(lettore.result).split(',')[1] || '')
        lettore.readAsDataURL(blob)
      })
      if (!base64) throw new Error('Registrazione vuota')
      await chiamaIA({ prompt: testoRef.current.trim(), audioBase64: base64, mimeType })
    } catch (e) {
      console.error('Errore elaborazione audio:', e)
      mostraErrore('Errore elaborazione audio: ' + e.message)
      fineAttesa()
    }
  }, [chiamaIA, fineAttesa])

  // ── Avvio ────────────────────────────────────────────────────────────────
  const avviaAscolto = async () => {
    if (isNative) {
      try {
        const perm = await VoiceRecorder.requestAudioRecordingPermission()
        if (!perm.value) {
          return mostraErrore('Devi concedere i permessi per il microfono nelle impostazioni di iOS.')
        }
      } catch (e) {
        // Il permesso vero lo richiede comunque getUserMedia qui sotto: se il
        // plugin non risponde non è una ragione per non provare.
        console.error('Errore permessi microfono:', e)
      }
    }

    // Il microfono si apre SEMPRE da qui: senza stream non c'è forma d'onda, e
    // senza forma d'onda non si distingue «ti sento» da «non ti sento».
    let stream = null
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      }
    } catch (err) {
      console.warn('Microfono non accessibile, nessuna forma d\'onda:', err)
    }

    const formato = stream ? formatoRegistrabile() : null

    if (isNative) {
      // 🔴 Su iOS si registra con MediaRecorder, non col plugin nativo: è la
      // stessa lezione delle note vocali (CLAUDE.md §4). Il plugin dichiarava
      // successo e restituiva un M4A di sola intestazione, perché WebView e
      // recorder nativo si contendono AVAudioSession.
      conPluginNativo.current = !(formato && stream)

      if (!conPluginNativo.current) {
        try {
          const recorder = new MediaRecorder(stream, { mimeType: formato })
          chunksRef.current = []
          recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
          recorder.onstop = () => {
            const tipo = (recorder.mimeType || formato).split(';')[0]
            const blob = new Blob(chunksRef.current, { type: tipo })
            // Prima il controllo, poi lo stato: se il foglio si è già chiuso,
            // `spegniMicrofono` scriverebbe su un componente smontato — e il
            // microfono l'ha già spento la pulizia dell'effetto.
            if (annullato.current) return
            spegniMicrofono()
            if (blob.size === 0) {
              // Un contenitore senza campioni: caricarlo vorrebbe dire far
              // aspettare il coach per una trascrizione di niente.
              console.error('Registrazione vuota:', tipo)
              return mostraErrore('La registrazione è risultata vuota: riprova.')
            }
            inviaAudio(blob, tipo)
          }
          recorder.start()
          recorderRef.current = recorder
        } catch (e) {
          console.error('Errore avvio MediaRecorder:', e)
          spegniMicrofono()
          return mostraErrore('Impossibile avviare la registrazione.')
        }
      } else {
        // Ripiego. ⚠️ Lo stream si CHIUDE prima: tenerlo aperto mentre parte il
        // plugin è esattamente la condizione che produce il file vuoto.
        if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null }
        try {
          await VoiceRecorder.startRecording()
        } catch (e) {
          console.error('Errore avvio registrazione nativa:', e)
          return mostraErrore("Errore nell'avvio della registrazione: " + e.message)
        }
      }
    } else {
      if (!recognitionRef.current) {
        if (stream) stream.getTracks().forEach(t => t.stop())
        return mostraErrore('Il riconoscimento vocale non è supportato su questo browser. Usa la dettatura della tastiera.')
      }
      try {
        recognitionRef.current.start()
      } catch (e) {
        console.error('Errore avvio riconoscimento vocale:', e)
      }
    }

    streamRef.current = stream
    setMediaStream(stream)
    setInterimResult('')
    setSecondi(0)
    setLivello(0)
    setHaSentito(false)
    setIsListening(true)
    // Il cronometro sta qui e non in un effetto su `isListening`: un effetto che
    // azzera lo stato al primo render è un giro di render in più per un numero
    // che si sa già (react-hooks/set-state-in-effect).
    clearInterval(orologio.current)
    orologio.current = setInterval(() => setSecondi(s => s + 1), 1000)
    battito()
  }

  // ── Stop ─────────────────────────────────────────────────────────────────
  const fermaAscolto = async () => {
    setIsListening(false)
    clearInterval(orologio.current)
    battito()

    if (!isNative) {
      // Sul web la dettatura ha già riempito il campo: si torna a scrivere, e
      // «Genera» resta un gesto separato.
      try { recognitionRef.current?.stop() } catch { /* già ferma */ }
      spegniMicrofono()
      return
    }

    if (!conPluginNativo.current) {
      // L'attesa parte SUBITO, non quando il blob è pronto: fra lo stop e
      // `onstop` c'è un vuoto in cui il foglio non direbbe niente.
      iniziaAttesa(true)
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        try {
          recorderRef.current.stop()
        } catch (e) {
          console.error('Errore stop MediaRecorder:', e)
          fineAttesa()
          spegniMicrofono()
          mostraErrore('Registrazione non salvata: riprova.')
        }
      } else {
        fineAttesa()
        spegniMicrofono()
      }
      return
    }

    spegniMicrofono()
    iniziaAttesa(true)
    try {
      const result = await VoiceRecorder.stopRecording()
      // ⚠️ Il plugin può tornare un file VUOTO dicendo che è andato tutto bene.
      if (result.value && result.value.msDuration === 0) {
        console.error('Registrazione nativa vuota:', result.value)
        fineAttesa()
        return mostraErrore('La registrazione è risultata vuota: riprova.')
      }
      if (result.value && result.value.recordDataBase64) {
        await chiamaIA({
          prompt: testoRef.current.trim(),
          audioBase64: result.value.recordDataBase64,
          mimeType: result.value.mimeType || 'audio/aac',
        })
      } else {
        fineAttesa()
      }
    } catch (e) {
      console.error('Errore stop nativo:', e)
      fineAttesa()
      mostraErrore('Errore elaborazione audio: ' + e.message)
    }
  }

  const handleGenerate = () => {
    if (!text.trim() || loading) return
    chiamaIA({ prompt: text.trim() })
  }

  const parla = livello > SOGLIA_VOCE

  return createPortal(
    // ⚠️ `touch-action: none` sta sul velo e non sul foglio: impedisce che il
    // dito, muovendosi sullo sfondo, faccia scorrere la pagina sotto.
    // ⚠️ Durante la generazione il velo NON chiude: chiudere qui butterebbe
    // via una registrazione già spedita, senza dire niente a nessuno.
    <div className={`fixed inset-0 z-[60] flex flex-col justify-end bg-black/85 touch-none ${classeVelo}`}
      style={stileVelo} onClick={loading ? undefined : chiudi}>
      <div role="dialog" aria-label="Genera con IA" onClick={(e) => e.stopPropagation()}
        style={stileFoglio}
        className={`bg-[#141416] border-t border-ia/20 rounded-t-3xl px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]
                    flex flex-col max-h-[88dvh] overflow-y-auto overscroll-contain
                    shadow-[0_-20px_50px_-12px_rgba(0,0,0,.85)] ${classeFoglio}`}>

        <button type="button" aria-label={loading ? 'Generazione in corso' : 'Chiudi'}
          {...(loading ? {} : maniglia)} disabled={loading}
          className="w-full pt-3 pb-2.5 -mx-4 px-4 flex justify-center shrink-0 touch-none
                     cursor-grab active:cursor-grabbing disabled:cursor-default group">
          <span aria-hidden="true"
            className={`w-10 h-1 rounded-full transition-colors ${loading
              ? 'bg-white/10'
              : 'bg-white/20 group-hover:bg-white/35 group-active:bg-white/45'}`} />
        </button>

        {/* La testata è la stessa della card viola che ha aperto il foglio:
            chi tocca «Genera con IA» ritrova l'icona e la riga che ha letto. */}
        <div className="flex items-center gap-3 pb-4 shrink-0">
          <span aria-hidden="true"
            className="w-11 h-11 rounded-[14px] bg-ia text-white flex items-center justify-center shrink-0
                       shadow-[0_10px_20px_-8px_rgba(168,85,247,.6)]">
            <Wand2 size={21} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[16px] font-extrabold tracking-[-.015em] text-white">Genera con IA</p>
            <p className="mt-[2px] text-[12.5px] font-medium text-[#c4a6e8]">Descrivi l'obiettivo, ti scrivo i blocchi</p>
          </div>
        </div>

        {loading ? (
          // ── L'attesa ────────────────────────────────────────────────────
          // 🔴 Prima qui non c'era NIENTE: fermata la registrazione il foglio
          // tornava al campo di testo, vuoto (sul nativo la trascrizione non
          // esiste ancora), e l'unico segnale era la CTA disabilitata al 40%.
          // Si leggeva come «non ha funzionato», e il gesto che ne seguiva era
          // premere di nuovo il microfono — cioè buttare la registrazione
          // appena spedita. La generazione occupa il foglio INTERO finché non
          // ha finito.
          <div className={`${CARD} px-4 py-7 flex flex-col items-center text-center gap-3.5 shrink-0`}>
            <span aria-hidden="true"
              className="w-12 h-12 rounded-full border-[3px] border-ia/25 border-t-ia animate-spin" />
            <div>
              <p className="text-white text-[16px] font-extrabold tracking-[-.015em]" role="status">
                {attesaLunga ? 'Ci sta mettendo più del solito…' : 'Sto scrivendo l\'allenamento'}
              </p>
              <p className="mt-1.5 text-[13px] text-muted leading-snug max-w-[16rem] mx-auto">
                {attesaLunga
                  ? 'Ancora un momento: se non arriva, il messaggio di errore te lo dice.'
                  : attesaDaVoce
                    ? 'Ascolto la registrazione e la traduco in blocchi. Ci vogliono pochi secondi.'
                    : 'Leggo la descrizione e scrivo i blocchi. Ci vogliono pochi secondi.'}
              </p>
            </div>
            <p className={`${LABEL} pt-1`}>Non chiudere</p>
          </div>
        ) : isListening ? (
          // ── In ascolto ──────────────────────────────────────────────────
          <div className={`${CARD} px-4 py-4 flex flex-col gap-3.5 shrink-0`}>
            <div className="flex items-center gap-4">
              {/* L'alone segue il livello VERO del microfono: fermo, vuol dire
                  che il microfono non sta ricevendo niente. */}
              <div className="relative w-[72px] h-[72px] flex items-center justify-center shrink-0">
                <span aria-hidden="true"
                  className="absolute inset-0 rounded-full bg-ia/25"
                  style={{ transform: `scale(${1 + Math.min(livello, 1) * 0.3})`, transition: 'transform 140ms ease-out' }} />
                <span aria-hidden="true"
                  className="relative w-14 h-14 rounded-full bg-ia flex items-center justify-center text-white
                             shadow-[0_10px_24px_-8px_rgba(168,85,247,.75)]">
                  <Mic size={24} />
                </span>
              </div>

              <div className="flex-1 min-w-0 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className={`${LABEL} ${parla ? 'text-ia' : ''}`}>
                    {parla ? 'Ti sento' : 'Parla pure…'}
                  </span>
                  <span className="font-mono text-[12px] font-extrabold text-gray-300 ml-auto">
                    {mmssSecondi(secondi)}
                  </span>
                </div>

                <div className="h-11 flex items-center">
                  {mediaStream ? (
                    <AudioVisualizer stream={mediaStream} colore={IA} altezza={44} classe="w-full h-11"
                      onLivello={suLivello} />
                  ) : (
                    // ⚠️ Senza analizzatore NON si finge un livello: queste barre
                    // pulsano da sole e non dicono «ti sento», lo dice il
                    // cronometro qui sopra, che è l'unica cosa vera che resta.
                    <div className="flex items-end gap-[3px] h-full w-full" aria-hidden="true">
                      {[...Array(18)].map((_, i) => (
                        <span key={i} className="flex-1 bg-ia/45 rounded-full animate-pulse"
                          style={{ height: `${30 + (i % 5) * 16}%`, animationDelay: `${i * 70}ms` }} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 🔴 Una forma d'onda piatta si legge come «sto zitto io», mai come
                «il microfono non riceve»: senza questa riga si parlerebbe a un
                microfono spento fino a leggere il workout generato a caso. */}
            {!haSentito && secondi >= SECONDI_MUTO && (
              <p className="text-[13px] text-orange-400 leading-snug border-t border-white/[.07] pt-3">
                Non arriva nessun suono. Parla più vicino al microfono, o controlla che
                l'app abbia il permesso nelle impostazioni di iOS.
              </p>
            )}

            {interimResult && (
              <p className="text-white text-[14.5px] leading-snug border-t border-white/[.07] pt-3">{interimResult}</p>
            )}

            <button type="button" onClick={fermaAscolto}
              className="min-h-[52px] rounded-2xl bg-ia text-white text-[15.5px] font-black tracking-[-.01em]
                         flex items-center justify-center gap-2.5 transition hover:brightness-110 active:scale-[.99]
                         shadow-[0_14px_26px_-10px_rgba(168,85,247,.6)]">
              <Square size={17} fill="currentColor" aria-hidden="true" />
              {isNative ? 'Ho finito, genera' : 'Ferma la dettatura'}
            </button>
          </div>
        ) : (
          // ── A riposo ────────────────────────────────────────────────────
          <>
            <div className={`${CARD} p-3.5 flex flex-col gap-3 shrink-0`}>
              <textarea
                className="w-full bg-transparent text-white placeholder-gray-600 focus:outline-none resize-none
                           text-[15px] leading-relaxed min-h-[104px]"
                rows={4}
                placeholder="Es: EMOM da 12 minuti, 15 burpees e 10 box jump a minuti alterni…"
                value={text}
                onChange={e => setText(e.target.value)}
              />

              {/* Il microfono è il gesto principale di questa superficie, non
                  un'icona dentro l'angolo del campo: è la ragione per cui la
                  tastiera non si apre più da sola all'ingresso. */}
              <button type="button" onClick={avviaAscolto}
                className={`min-h-12 rounded-2xl ${VETRO} flex items-center justify-center gap-2.5 text-white
                            text-[14.5px] font-extrabold hover:border-ia/50 transition active:scale-[.995]`}>
                <Mic size={18} className="text-ia" aria-hidden="true" />
                {isNative ? 'Detta l\'allenamento' : 'Detta con la voce'}
              </button>
            </div>

            <p className="text-[12px] text-muted leading-snug px-1 pt-3 shrink-0">
              I blocchi generati si aggiungono a quelli che hai già: puoi correggerli uno per uno.
            </p>
          </>
        )}

        {/* La CTA sparisce durante la generazione: il foglio dice già cosa sta
            succedendo, e un bottone spento accanto a un'attesa è il modo in cui
            l'attesa sembra un errore. */}
        {!loading && (
          <div className="pt-3.5 shrink-0">
            <button type="button" onClick={handleGenerate} disabled={!text.trim() || isListening}
              className="w-full min-h-[52px] rounded-2xl bg-ia text-white text-[16.5px] font-black tracking-[-.01em]
                         flex items-center justify-center gap-2.5 transition hover:brightness-110 active:scale-[.99]
                         disabled:opacity-40 shadow-[0_14px_26px_-10px_rgba(168,85,247,.5)]">
              Genera workout <ArrowRight size={19} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

// ─── EXERCISE PICKER MODAL ────────────────────────────────────
function ExercisePicker({ onAdd, onClose, existingNames = [], workoutType, initialExercise }) {
  const [search, setSearch] = useState(initialExercise?.name || '')
  const [selected, setSelected] = useState(initialExercise?.name || null)
  const [hybridMode, setHybridMode] = useState(initialExercise?.meters && initialExercise.meters !== '-' ? 'distance' : 'reps')
  const [runPaceMode, setRunPaceMode] = useState(initialExercise?.speed && initialExercise.speed !== '-' ? 'speed' : 'pace')
  const [meters, setMeters] = useState(initialExercise?.meters || '-')
  const [ergoPace, setErgoPace] = useState(initialExercise?.ergoPace || '-')
  const [speed, setSpeed] = useState(initialExercise?.speed || '-')
  const [reps, setReps] = useState(initialExercise?.reps || '-')
    const [exTime, setExTime] = useState(initialExercise?.exTime || '-')

  const [kg, setKg] = useState(initialExercise?.kg ? `${initialExercise.kg} kg` : '-')
  const [intensity, setIntensity] = useState(initialExercise?.intensity || '5')
  const [notes, setNotes] = useState(initialExercise?.notes || '')

  // Quale parametro è aperto sulla tastiera. Uno solo alla volta: due campi in
  // digitazione insieme vorrebbero dire due autoFocus che si contendono il fuoco.
  const [digitando, setDigitando] = useState(null)

  // ── «Ultima volta» ────────────────────────────────────────────────────────
  // I valori dell'ultima volta che questo esercizio è stato programmato. È il
  // dato che il coach andava a cercare in un'altra scheda prima di scegliere un
  // peso — e la ragione per cui una rotella da 300 opzioni sembrava necessaria:
  // senza un riferimento, ogni numero è cieco.
  //
  // Una lettura sola al montaggio, sugli ultimi workout per data: lo schema è
  // congelato (CLAUDE.md regola 0-bis), quindi niente colonna e niente indice —
  // la scansione del jsonb si fa qui, su un numero di righe deliberatamente
  // piccolo. Se fallisce non succede niente: la riga semplicemente non compare.
  const [ultimi, setUltimi] = useState({})
  useEffect(() => {
    let vivo = true
    const carica = async () => {
      try {
        const { data, error } = await supabase
          .from('workouts')
          .select('date, sections')
          .order('date', { ascending: false })
          .limit(STORICO_WORKOUT)
        if (!vivo || error || !Array.isArray(data)) return
        const mappa = {}
        for (const w of data) {
          for (const b of (w?.sections?.blocks || [])) {
            for (const ex of (b?.exercises || [])) {
              if (ex?.name && !mappa[ex.name]) mappa[ex.name] = ex
            }
          }
        }
        setUltimi(mappa)
      } catch (e) {
        // Un catch muto qui ha già prodotto due guasti invisibili in questo
        // progetto (CLAUDE.md §9-quater): la riga è facoltativa, il log no.
        console.warn('Storico esercizi non disponibile:', e)
      }
    }
    carica()
    return () => { vivo = false }
  }, [])

  const ultimaVolta = selected ? ultimi[selected] : null
  const testoUltimaVolta = dettaglioEsercizio(ultimaVolta)
  const riusaUltimaVolta = () => {
    if (!ultimaVolta) return
    if (ultimaVolta.reps) setReps(ultimaVolta.reps)
    if (ultimaVolta.meters) setMeters(ultimaVolta.meters)
    if (ultimaVolta.exTime) setExTime(ultimaVolta.exTime)
    if (ultimaVolta.ergoPace) setErgoPace(ultimaVolta.ergoPace)
    if (ultimaVolta.speed) setSpeed(ultimaVolta.speed)
    setKg(ultimaVolta.kg ? `${ultimaVolta.kg} kg` : '-')
    if (ultimaVolta.intensity) setIntensity(ultimaVolta.intensity)
  }

  /**
   * Un parametro che è una TASSONOMIA e non una scala — passo, velocità.
   * La riga mostra il valore, il tocco apre l'elenco intero raggruppato.
   */
  const scelta = (chiave, { etichetta, generi, valore, set }) => (
    <RuotaValori key={chiave} etichetta={etichetta} valore={valore} generi={generi} onChange={set} />
  )

  /**
   * Un parametro. Non è un componente ma una funzione che compone JSX: definire
   * un componente dentro un altro lo rimonterebbe a ogni render, e con lui il
   * campo di testo aperto sulla tastiera.
   */
  const campo = (chiave, { etichetta, lista, rapidi, valore, set, unita }) => (
    <Stepper
      etichetta={etichetta}
      valore={valore}
      unitaPredefinita={unita}
      opzioni={rapidi}
      onChange={set}
      onPasso={(direzione) => set(passoInLista(lista, valore, direzione))}
      inDigitazione={digitando === chiave}
      onDigita={() => setDigitando(digitando === chiave ? null : chiave)}
    />
  )

  // Rifiltrare 120 esercizi a ogni carattere non è il costo vero, ma renderizzarli
  // sì: la lista non aveva alcun limite, quindi ogni tasto premuto ridisegnava
  // fino a 120 bottoni. Il memo evita il ricalcolo, il limite evita il disegno.
  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return HYROX_EXERCISES.filter(ex =>
      ex.toLowerCase().includes(q) && (!existingNames.includes(ex) || ex === initialExercise?.name)
    )
  }, [search, existingNames, initialExercise?.name])

  const LIMITE_LISTA = 40
  const visibili = filtered.slice(0, LIMITE_LISTA)
  const nascosti = filtered.length - visibili.length
  const isCustom = search && !HYROX_EXERCISES.find(e => e.toLowerCase() === search.toLowerCase())

  const handleSelect = (name) => setSelected(name)

  const handleConfirm = () => {
    if (!selected) return
    const isDist = isDistance(selected)
    const isHyb = isHybrid(selected)
    
    let finalMeters = (isDist || (isHyb && hybridMode === 'distance') || selected === 'Rest') ? meters : ''
    let finalReps = (!isDist && !isHyb && selected !== 'Rest') || (isHyb && hybridMode === 'reps') ? reps : ''
    
    onAdd({
      id: initialExercise ? initialExercise.id : Math.random(),
      name: selected,
      meters: workoutType === 'Interval' ? '' : finalMeters,
      reps: workoutType === 'Interval' ? '' : finalReps,
      exTime: workoutType === 'Interval' ? exTime : undefined,
      ergoPace: isErgo(selected) || (selected === 'Run' && runPaceMode === 'pace') ? ergoPace : undefined,
      speed: selected === 'Run' && runPaceMode === 'speed' ? speed : undefined,
      kg: kg === 'Nessun peso' || kg === '-' || isErgo(selected) || selected === 'Run' || selected === 'Rest' ? '' : kg.replace(' kg', ''),
      intensity: selected === 'Rest' ? undefined : intensity,
      notes
    })
    onClose()
  }

  // Sheet a schermo intero anziché card centrata: la lista mostrava tre esercizi
  // su centotrenta, e con la tastiera aperta il bottone di conferma finiva fuori
  // dallo schermo. Due passi con intestazione, come prescrive l'HIG per un
  // sotto-compito immersivo.
  return createPortal(
    <div className="fixed inset-0 z-[60] bg-[#0B0B0B] flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out">
      <div className="shrink-0 flex items-center gap-2 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] border-b border-[#2a2a2a]">
        {selected && (
          <button aria-label="Torna alla lista degli esercizi" onClick={() => setSelected(null)}
            className="w-11 h-11 -ml-2 flex items-center justify-center text-muted hover:text-white shrink-0">
            <ChevronLeft size={22} />
          </button>
        )}
        <p className="text-white font-bold text-lg flex-1 truncate">{selected || 'Scegli esercizio'}</p>
        <button aria-label="Chiudi" onClick={onClose}
          className="w-11 h-11 -mr-2 flex items-center justify-center text-muted hover:text-white shrink-0">
          <X size={22} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
          {!selected && <input
            className="bg-[#2a2a2a] border border-[#383838] rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-brand text-base"
            placeholder="Cerca o scrivi esercizio custom..."
            value={search}
            onChange={e => { setSearch(e.target.value); setSelected(null) }}
            enterKeyHint="search"
            onKeyDown={chiudiTastieraSuInvio}
          />}

          {!selected ? (
            <div className="flex flex-col gap-1">
              {isCustom && (
                <button onClick={() => handleSelect(search)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-brand/10 border border-brand/30 text-brand text-sm font-medium">
                  <Plus size={16} /> Aggiungi "{search}" (custom)
                </button>
              )}
              {visibili.map(ex => (
                <button aria-label={`Scegli ${ex}`} key={ex} onClick={() => handleSelect(ex)}
                  className="flex items-center justify-between px-4 py-3 rounded-xl bg-[#2a2a2a] hover:bg-[#333] text-white text-sm transition">
                  <span>{ex}</span>
                  {isErgo(ex) && <span className="text-xs text-blue-400 bg-blue-900/40 px-2 py-0.5 rounded-full">ergometro</span>}
                  <ChevronRight size={16} className="text-muted" />
                </button>
              ))}
              {nascosti > 0 && (
                <p className="text-muted text-xs text-center py-3">
                  Altri {nascosti} esercizi. Continua a scrivere per restringere.
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {isHybrid(selected) && (
                <div className="relative flex bg-[#111] p-1.5 rounded-2xl border border-[#333] mb-1">
                  <div 
                    className={`absolute top-1.5 bottom-1.5 left-1.5 w-[calc(50%-0.375rem)] bg-[#2a2a2a] rounded-xl shadow-md transition-transform duration-300 ease-out ${
                      hybridMode === 'reps' ? 'translate-x-0' : 'translate-x-full'
                    }`}
                  />
                  <button 
                    type="button"
                    onClick={() => { setHybridMode('reps'); setMeters('-'); }}
                    className={`relative z-10 flex-1 py-2.5 text-xs uppercase font-bold transition-colors duration-300 ${hybridMode === 'reps' ? 'text-brand' : 'text-muted hover:text-gray-300'}`}
                  >
                    🔁 Reps
                  </button>
                  <button 
                    type="button"
                    onClick={() => { setHybridMode('distance'); setReps('-'); }}
                    className={`relative z-10 flex-1 py-2.5 text-xs uppercase font-bold transition-colors duration-300 ${hybridMode === 'distance' ? 'text-brand' : 'text-muted hover:text-gray-300'}`}
                  >
                    📏 Distanza
                  </button>
                </div>
              )}

              {selected === 'Run' && (
                <div className="relative flex bg-[#111] p-1.5 rounded-2xl border border-[#333] mb-1">
                  <div 
                    className={`absolute top-1.5 bottom-1.5 left-1.5 w-[calc(50%-0.375rem)] bg-[#2a2a2a] rounded-xl shadow-md transition-transform duration-300 ease-out ${
                      runPaceMode === 'pace' ? 'translate-x-0' : 'translate-x-full'
                    }`}
                  />
                  <button 
                    type="button"
                    onClick={() => { setRunPaceMode('pace'); setSpeed('-'); }}
                    className={`relative z-10 flex-1 py-2.5 text-xs uppercase font-bold transition-colors duration-300 ${runPaceMode === 'pace' ? 'text-brand' : 'text-muted hover:text-gray-300'}`}
                  >
                    ⏱ Passo
                  </button>
                  <button 
                    type="button"
                    onClick={() => { setRunPaceMode('speed'); setErgoPace('-'); }}
                    className={`relative z-10 flex-1 py-2.5 text-xs uppercase font-bold transition-colors duration-300 ${runPaceMode === 'speed' ? 'text-brand' : 'text-muted hover:text-gray-300'}`}
                  >
                    ⚡ Velocità
                  </button>
                </div>
              )}

              {testoUltimaVolta && (
                <RigaUltimaVolta testo={testoUltimaVolta} onRiusa={riusaUltimaVolta} />
              )}

              <div className="flex flex-col gap-3 animate-in fade-in duration-300" key={`${selected}-${hybridMode}-${runPaceMode}`}>
                {workoutType === 'Interval' ? (
                  <>
                    {campo('exTime', { etichetta: 'Durata', lista: TIME_OPTIONS, rapidi: RAPIDI_DURATA, valore: exTime, set: setExTime })}
                    {isErgo(selected)
                      ? scelta('ergoPace', { etichetta: 'Passo (opzionale)', generi: GENERI_PASSO_ERGO, valore: ergoPace, set: setErgoPace })
                      : selected === 'Run'
                        ? (runPaceMode === 'pace'
                            ? scelta('ergoPace', { etichetta: 'Passo (opzionale)', generi: GENERI_PASSO_CORSA, valore: ergoPace, set: setErgoPace })
                            : scelta('speed', { etichetta: 'Velocità', generi: GENERI_VELOCITA, valore: speed, set: setSpeed }))
                        : campo('kg', { etichetta: 'Peso', lista: KG_OPTIONS, rapidi: RAPIDI_KG, valore: kg, set: setKg, unita: 'kg' })}
                  </>
                ) : isErgo(selected) ? (
                  <>
                    {campo('meters', { etichetta: 'Distanza / Cal', lista: METERS_OPTIONS, rapidi: RAPIDI_METRI, valore: meters, set: setMeters })}
                    {scelta('ergoPace', { etichetta: 'Passo (opzionale)', generi: GENERI_PASSO_ERGO, valore: ergoPace, set: setErgoPace })}
                  </>
                ) : selected === 'Run' ? (
                  <>
                    {campo('meters', { etichetta: 'Distanza', lista: METERS_OPTIONS, rapidi: RAPIDI_METRI, valore: meters, set: setMeters })}
                    {runPaceMode === 'pace'
                      ? scelta('ergoPace', { etichetta: 'Passo (opzionale)', generi: GENERI_PASSO_CORSA, valore: ergoPace, set: setErgoPace })
                      : scelta('speed', { etichetta: 'Velocità', generi: GENERI_VELOCITA, valore: speed, set: setSpeed })}
                  </>
                ) : selected === 'Rest' ? (
                  campo('meters', { etichetta: 'Durata', lista: REST_TIME_OPTIONS, rapidi: RAPIDI_REST, valore: meters, set: setMeters })
                ) : isHybrid(selected) ? (
                  <>
                    {hybridMode === 'distance'
                      ? campo('meters', { etichetta: 'Distanza', lista: HYBRID_METERS_OPTIONS, rapidi: RAPIDI_METRI_CORTI, valore: meters, set: setMeters })
                      : campo('reps', { etichetta: 'Ripetizioni', lista: REPS_OPTIONS, rapidi: RAPIDI_REPS, valore: reps, set: setReps, unita: 'reps' })}
                    {campo('kg', { etichetta: 'Peso', lista: KG_OPTIONS, rapidi: RAPIDI_KG, valore: kg, set: setKg, unita: 'kg' })}
                  </>
                ) : isSled(selected) ? (
                  <>
                    {campo('meters', { etichetta: 'Distanza', lista: SLED_METERS_OPTIONS, rapidi: RAPIDI_METRI_CORTI, valore: meters, set: setMeters })}
                    {campo('kg', { etichetta: 'Peso', lista: KG_OPTIONS, rapidi: RAPIDI_KG, valore: kg, set: setKg, unita: 'kg' })}
                  </>
                ) : isCarry(selected) ? (
                  <>
                    {campo('meters', { etichetta: 'Distanza', lista: CARRY_METERS_OPTIONS, rapidi: RAPIDI_METRI_CORTI, valore: meters, set: setMeters })}
                    {campo('kg', { etichetta: 'Peso', lista: KG_OPTIONS, rapidi: RAPIDI_KG, valore: kg, set: setKg, unita: 'kg' })}
                  </>
                ) : isDistance(selected) ? (
                  <>
                    {campo('meters', { etichetta: 'Distanza', lista: METERS_OPTIONS, rapidi: RAPIDI_METRI, valore: meters, set: setMeters })}
                    {campo('kg', { etichetta: 'Peso', lista: KG_OPTIONS, rapidi: RAPIDI_KG, valore: kg, set: setKg, unita: 'kg' })}
                  </>
                ) : (
                  <>
                    {campo('reps', { etichetta: 'Ripetizioni', lista: REPS_OPTIONS, rapidi: RAPIDI_REPS, valore: reps, set: setReps, unita: 'reps' })}
                    {campo('kg', { etichetta: 'Peso', lista: KG_OPTIONS, rapidi: RAPIDI_KG, valore: kg, set: setKg, unita: 'kg' })}
                  </>
                )}
              </div>

              {selected !== 'Rest' && (
                <div className={`${CARD} px-4 py-[15px] flex flex-col gap-3`}>
                  <div className="flex items-center justify-between">
                    <span className={LABEL}>Intensità</span>
                    <div className="flex items-center gap-1.5">
                      <span className={`font-mono text-sm font-extrabold ${getIntensityColor(intensity)}`}>{intensity}/10</span>
                      <BicepsFlexed size={17} className={getIntensityColor(intensity)} />
                    </div>
                  </div>
                  <IntensityPicker value={intensity} onChange={setIntensity} />
                </div>
              )}

              <RigaTesto
                icona={FileText}
                etichetta="Note dell'esercizio"
                placeholder="Note (es. vai a cedimento…)"
                valore={notes}
                onChange={setNotes}
              />

            </div>
          )}
      </div>

      {/* Piede fisso: la conferma resta raggiungibile anche con la tastiera aperta */}
      {selected && (
        <div className="shrink-0 px-4 pt-3 pb-[calc(13px+env(safe-area-inset-bottom))] border-t border-white/[.07] bg-[#0B0B0B]/[.9] backdrop-blur-xl flex">
          <CtaPrimaria onClick={handleConfirm} icona={initialExercise ? Save : Plus}>
            {initialExercise ? 'Salva modifiche' : 'Aggiungi esercizio'}
          </CtaPrimaria>
        </div>
      )}
    </div>,
    document.body
  )
}

// ─── BLOCCO ESERCIZIO ─────────────────────────────────────────
function ExerciseRow({ ex, index, total, onRemove, onMoveUp, onMoveDown, onDragStartIndex, onDragEnterIndex, onDragEndIndex, onEdit, touchHandlers, onDuplicate }) {

  // Il numero c'è sempre, non solo su EMOM e ON/OFF: lì è il minuto, altrove è
  // l'ordine — e l'ordine di un blocco è un'informazione, non un dettaglio.
  const dettaglio = dettaglioEsercizio(ex)

  return (
    <div
          {...(touchHandlers ? touchHandlers(index) : {})}
      draggable
      onDragStart={(e) => {
        e.stopPropagation()
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', index.toString())
        setTimeout(() => {
          if (e.target && e.target.classList) {
            e.target.classList.add('opacity-30', 'scale-[0.98]', 'shadow-lg')
          }
        }, 0)
        onDragStartIndex?.(index)
      }}
      onDragEnter={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onDragEnterIndex?.(index)
      }}
   onDragOver={(e) => {
        e.preventDefault()
        e.stopPropagation()
        e.dataTransfer.dropEffect = 'move'
      }}
      onDragEnd={(e) => {
        e.stopPropagation()
        if (e.target && e.target.classList) {
          e.target.classList.remove('opacity-30', 'scale-[0.98]', 'shadow-lg')
        }
        onDragEndIndex?.()
      }}
      data-drag-item
      className="drag-item flex items-center gap-[11px] rounded-[14px] px-[11px] py-[9px] bg-black/40 border border-white/[.06]
                 cursor-move hover:border-white/15 transition-all duration-200"
    >
      <NumeroEsercizio n={index + 1} />

      <div className="flex-1 min-w-0 cursor-pointer group self-stretch flex flex-col justify-center" onClick={() => onEdit && onEdit(ex)}>
        <p className="text-sm font-bold text-white truncate group-hover:text-brand transition">{ex.name}</p>
        <p className="mt-0.5 font-mono text-[11.5px] font-semibold tracking-[.02em] text-muted truncate">
          {[dettaglio, ex.notes].filter(Boolean).join(' · ') || '—'}
        </p>
      </div>

      {ex.intensity && (
        <span className={`shrink-0 font-mono text-xs font-extrabold ${getIntensityColor(ex.intensity)}`}
          onClick={() => onEdit && onEdit(ex)}>{ex.intensity}/10</span>
      )}

      <div className="flex items-center shrink-0 -mr-1.5">
        <button aria-label="Sposta l'esercizio su" type="button" onClick={() => onMoveUp && onMoveUp(index)} disabled={index === 0} className="text-[#4a4f5c] hover:text-brand disabled:opacity-0 p-1"><ChevronUp size={15}/></button>
        <button aria-label="Sposta l'esercizio giù" type="button" onClick={() => onMoveDown && onMoveDown(index)} disabled={index === (total || 1) - 1} className="text-[#4a4f5c] hover:text-brand disabled:opacity-0 p-1"><ChevronDown size={15}/></button>
        <button aria-label="Duplica l'esercizio" type="button" onClick={() => onDuplicate && onDuplicate(ex)} className="text-[#4a4f5c] hover:text-brand transition p-1" title="Duplica esercizio">
          <Copy size={15} />
        </button>
        <button aria-label="Rimuovi l'esercizio" type="button" onClick={() => onRemove(ex.id)} className="text-[#4a4f5c] hover:text-red-400 transition p-1">
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  )
}

// ─── BLOCCO HYROX ───────────────────────────────────────
// ⚠️ Memoizzato (BACKLOG #15). Ogni blocco aperto contiene scroll picker da 102
// opzioni: senza memo, un carattere digitato nel titolo ne ridisegna migliaia.
//
// memo confronta le props per RIFERIMENTO, quindi funziona solo finché il padre
// passa gestori stabili. Per questo il contratto è cambiato: i gestori ricevono
// `block.id` e non si appoggiano più alla posizione, così il padre può
// dichiararli con useCallback([]) senza catturare `blocks` né `idx`.
// Se rimetti un'arrow inline al call site, memo smette di servire in silenzio:
// lo cattura src/pages/__tests__/HyroxBlockMemo.test.jsx.
//
// `onUpdate` fa eccezione e riceve il blocco intero: l'id è già lì dentro.
export const HyroxBlock = memo(function HyroxBlock({ block, index, total, isOpen, onToggle, onUpdate, onRemove, onMoveUp, onMoveDown, onDragStartIndex, onDragEnterIndex, onDragEndIndex, onDuplicate, touchHandlers, onDuplicateExerciseRequest }) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [editingExercise, setEditingExercise] = useState(null)
  const [draggedExIdx, setDraggedExIdx] = useState(null)

  // Hook touch per riordinare gli ESERCIZI dentro questo blocco
  const { getTouchHandlers: getExTouchHandlers } = useTouchDrag({
    onReorder: (from, to) => {
      onUpdate({ ...block, exercises: moveElement(block.exercises, from, to) })
    }
  })


  const updateParam = (k, v) => onUpdate({ ...block, params: { ...block.params, [k]: v } })
  const updateNotes = (notes) => onUpdate({ ...block, notes })

  // Quale parametro è aperto sulla tastiera, come in ExercisePicker.
  const [digitando, setDigitando] = useState(null)

  /** Un parametro del blocco. Vedi la nota gemella in ExercisePicker. */
  const parametro = (chiave, { etichetta, lista, rapidi, ripiego }) => {
    const valore = block.params?.[chiave] ?? ripiego
    return (
      <Stepper
        etichetta={etichetta}
        valore={valore}
        opzioni={rapidi}
        onChange={(v) => updateParam(chiave, v)}
        onPasso={(direzione) => updateParam(chiave, passoInLista(lista, valore, direzione))}
        inDigitazione={digitando === chiave}
        onDigita={() => setDigitando(digitando === chiave ? null : chiave)}
      />
    )
  }

  const c = TYPE_COLORS[block.type] || { text: 'text-gray-200', border: 'border-[#444]', bg: 'bg-[#222]' }
  const lavoro = BLOCCHI_DI_LAVORO.has(block.type)
  const conEsercizi = !['WarmUp', 'Rest'].includes(block.type)
  const quantiEsercizi = (block.exercises || []).length

  // ⚠️ Per WarmUp, Rest e AMRAP il riepilogo È la durata, e la durata sta già
  // in testa alla riga: ripeterla a sinistra vorrebbe dire scrivere due volte
  // lo stesso numero a otto centimetri di distanza.
  const riepilogoRipeteLaDurata = ['WarmUp', 'Rest', 'AMRAP'].includes(block.type)

  const getBlockRecap = () => {
    if (['WarmUp', 'Rest'].includes(block.type)) {
      return block.params?.duration ? `${block.params.duration}` : '3:00'
    } else if (block.type === 'ON/OFF') {
      return `${block.params?.on || '1:00'} ON / ${block.params?.off || '1:00'} OFF · ${block.params?.rounds || '10'} rounds`
    } else if (block.type === 'EMOM') {
      return `Ogni ${block.params?.interval || '1:00'} x ${block.params?.rounds || '10'} rounds`
    } else if (block.type === 'AMRAP') {
      return `${block.params?.duration || '10:00'}`
    } else if (block.type === 'For Time') {
      return `${block.params?.rounds || '3'} rounds`
       } else if (block.type === 'Interval') {
      return `${block.params?.rounds || '1'} rounds`
    } else if (['Cash In', 'Cash Out'].includes(block.type)) {
      const rounds = block.params?.rounds || '1';
      const rest = (parseInt(rounds, 10) > 1 && block.params?.rest && block.params.rest !== '-') ? ` · ${block.params.rest} rest` : '';
      return rounds !== '1' ? `${rounds} rounds${rest}` : '1 round';
    }
    return ''
  }

  return (
    <div
      {...(touchHandlers ? touchHandlers(index) : {})}
      draggable
      onDragStart={(e) => {
        e.stopPropagation()
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', index.toString())
        setTimeout(() => {
          if (e.target && e.target.classList) {
            e.target.classList.add('opacity-30', 'scale-[0.98]', 'shadow-lg')
          }
        }, 0)
        onDragStartIndex?.(index)
      }}
       onDragEnter={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onDragEnterIndex?.(index)
      }}
      onDragOver={(e) => {
        e.preventDefault()
        e.stopPropagation()
        e.dataTransfer.dropEffect = 'move'
      }}
      onDragEnd={(e) => {
        e.stopPropagation()
        if (e.target && e.target.classList) {
          e.target.classList.remove('opacity-30', 'scale-[0.98]', 'shadow-lg')
        }
        onDragEndIndex?.()
      }}
      data-drag-item
      data-blocco-id={block.id}
      className={`drag-item scroll-mt-4 relative overflow-hidden rounded-[20px] border cursor-move transition-all duration-200
        shadow-[0_16px_30px_-18px_rgba(0,0,0,.85),inset_0_1px_0_rgba(255,255,255,.05)] ${
        isOpen
          ? 'border-brand/[.26] bg-gradient-to-b from-[#211f18] to-[#191919]'
          : 'border-white/[.07] bg-gradient-to-b from-[#1c1c1f] to-[#171719] hover:border-white/15'
      }`}
    >
      <SpinaBlocco tipo={block.type} aperto={isOpen} lavoro={lavoro} />

      {/* Due righe e non una: la didascalia in chiaro («Blocco di apertura») è la
          risposta al rilievo 3.2.1(viii) di Apple, e su 393px accanto al nome,
          alla durata e a quattro azioni finiva troncata a «Blocco di apert…».
          Sulla seconda riga, che occupa tutta la card, ci sta intera — ed è la
          prima cosa scritta, quindi è l'ultima a cedere se la riga trabocca. */}
      <div className="pl-4 pr-2.5 py-3 cursor-pointer" onClick={() => onToggle(block.id)}>
        <div className="flex items-center gap-2.5">
          <span data-tipo-blocco className={`flex-1 min-w-0 truncate text-[15.5px] font-extrabold tracking-[-.015em] ${isOpen ? 'text-white' : c.text}`}>
            {block.type}
          </span>

          <DurataBlocco testo={mmss(durataBlocco(block))} acceso={isOpen} />

          <div className="flex items-center shrink-0 -mr-1" onClick={e => e.stopPropagation()}>
            <button aria-label="Duplica il blocco" type="button" onClick={() => onDuplicate(block.id)} className="text-[#5b6070] hover:text-brand transition p-1" title="Duplica">
              <Copy size={15}/>
            </button>
            <button aria-label="Sposta il blocco su" type="button" onClick={() => onMoveUp(block.id)} disabled={index===0} className="text-[#5b6070] hover:text-white disabled:opacity-25 p-1"><ChevronUp size={15}/></button>
            <button aria-label="Sposta il blocco giù" type="button" onClick={() => onMoveDown(block.id)} disabled={index===total-1} className="text-[#5b6070] hover:text-white disabled:opacity-25 p-1"><ChevronDown size={15}/></button>
            <button aria-label="Elimina il blocco" type="button" onClick={() => onRemove(block.id)} className="text-[#5b6070] hover:text-red-400 transition p-1"><Trash2 size={15}/></button>
          </div>
        </div>

        <p className="mt-[3px] font-mono text-[11.5px] font-bold tracking-[.03em] text-muted truncate">
          {[
            blockHint(block.type),
            conEsercizi ? `${quantiEsercizi} eserciz${quantiEsercizi === 1 ? 'io' : 'i'}` : null,
            riepilogoRipeteLaDurata ? null : getBlockRecap(),
            !conEsercizi ? block.notes : null,
          ].filter(Boolean).map((pezzo, i, tutti) => (
            <span key={i}>{pezzo}{i < tutti.length - 1 ? ' · ' : ''}</span>
          ))}
        </p>
      </div>

      {isOpen && (
        <div className="px-3.5 pb-[13px] flex flex-col gap-3 animate-in fade-in duration-200">
          {['WarmUp', 'Rest'].includes(block.type) && (
            <>
              {parametro('duration', { etichetta: 'Durata', lista: TIME_OPTIONS, rapidi: RAPIDI_DURATA, ripiego: '3:00' })}
              <RigaTesto
                icona={FileText}
                etichetta="Note del blocco"
                placeholder="Note (opzionale)…"
                valore={block.notes || ''}
                onChange={updateNotes}
              />
            </>
          )}

          {block.type === 'ON/OFF' && (
            <>
              {parametro('on', { etichetta: 'ON — lavoro', lista: TIME_OPTIONS, rapidi: RAPIDI_LAVORO, ripiego: '1:00' })}
              {parametro('off', { etichetta: 'OFF — recupero', lista: TIME_OPTIONS, rapidi: RAPIDI_LAVORO, ripiego: '1:00' })}
              {parametro('rounds', { etichetta: 'Rounds', lista: ROUNDS_OPTIONS, rapidi: RAPIDI_ROUNDS, ripiego: '10' })}
            </>
          )}

          {block.type === 'EMOM' && (
            <>
              {parametro('interval', { etichetta: 'Intervallo', lista: TIME_OPTIONS, rapidi: RAPIDI_INTERVALLO, ripiego: '1:00' })}
              {parametro('rounds', { etichetta: 'Rounds', lista: ROUNDS_OPTIONS, rapidi: RAPIDI_ROUNDS, ripiego: '10' })}
            </>
          )}

          {block.type === 'AMRAP' &&
            parametro('duration', { etichetta: 'Durata', lista: TIME_OPTIONS, rapidi: RAPIDI_AMRAP, ripiego: '10:00' })}

          {['For Time', 'Interval'].includes(block.type) &&
            parametro('rounds', { etichetta: 'Rounds', lista: ROUNDS_OPTIONS, rapidi: RAPIDI_ROUNDS, ripiego: block.type === 'For Time' ? '3' : '1' })}

          {['Cash In', 'Cash Out'].includes(block.type) && (
            <>
              {parametro('rounds', { etichetta: 'Rounds', lista: ROUNDS_OPTIONS, rapidi: RAPIDI_ROUNDS, ripiego: '1' })}
              {/* Il rest esiste solo fra i round: con un round solo, il campo non
                  ha nulla da dire e sparisce invece di restare a zero. */}
              {parseInt(block.params?.rounds, 10) > 1 &&
                parametro('rest', { etichetta: 'Rest fra i rounds', lista: REST_TIME_OPTIONS, rapidi: RAPIDI_REST, ripiego: '1:00' })}
            </>
          )}

          {/* Exercises */}
          {!['WarmUp', 'Rest'].includes(block.type) && (
            <>
              <div className="flex flex-col gap-2" data-drag-container>
                {(block.exercises || []).map((ex, i) => (
                  <ExerciseRow 
                    key={ex.id} ex={ex} index={i} total={block.exercises.length}
                    onRemove={(id) => onUpdate({ ...block, exercises: block.exercises.filter(e => e.id !== id) })}
                    onMoveUp={(idx) => onUpdate({ ...block, exercises: moveElement(block.exercises, idx, idx - 1) })}
                    onMoveDown={(idx) => onUpdate({ ...block, exercises: moveElement(block.exercises, idx, idx + 1) })}
                    onDragStartIndex={(idx) => setDraggedExIdx(idx)} // Passa al componente ExerciseRow
                    onDragEnterIndex={(idx) => { // Gestisce il riordino in tempo reale
                      if (draggedExIdx !== null && draggedExIdx !== idx) {
                        onUpdate({ ...block, exercises: moveElement(block.exercises, draggedExIdx, idx) })
                        setDraggedExIdx(idx) // Aggiorna l'indice dell'elemento trascinato
                      }
                    }}
                    onDragEndIndex={() => setDraggedExIdx(null)} // Resetta l'indice al termine del drag
                    onEdit={(exToEdit) => {
                      setEditingExercise(exToEdit)
                      setPickerOpen(true)
                    }}
                    onDuplicate={(ex) => onDuplicateExerciseRequest(block.id, ex)}
                    touchHandlers={getExTouchHandlers}
                  />
                ))}
              </div>
              <button type="button" onClick={() => setPickerOpen(true)}
                className="min-h-11 rounded-[14px] border border-dashed border-brand/[.34] text-brand text-[13.5px] font-extrabold
                           flex items-center justify-center gap-2 hover:bg-brand/10 transition">
                <Plus size={16} aria-hidden="true" /> Esercizio
              </button>
            </>
          )}

          {pickerOpen && (
            <ExercisePicker 
              workoutType={block.type}
              existingNames={(block.exercises || []).map(e => e.name)}
              initialExercise={editingExercise}
              onClose={() => { setPickerOpen(false); setEditingExercise(null); }}
              onAdd={ex => {
                if (editingExercise) {
                  onUpdate({ ...block, exercises: block.exercises.map(e => e.id === ex.id ? ex : e) })
                } else {
                  onUpdate({ ...block, exercises: [...(block.exercises || []), ex] })
                }
              }}
            />
          )}
        </div>
      )}
    </div>
  )
})

// ─── COMPONENTI RUNNING BUILDER ────────────────────────────────
function ModeToggle({ mode, onModeChange, value, onChange }) {
  return (
    <div className="relative flex bg-[#111] p-1.5 rounded-2xl border border-[#333] mb-3">
      <div 
        className={`absolute top-1.5 bottom-1.5 left-1.5 w-[calc(50%-0.375rem)] bg-[#2a2a2a] rounded-xl shadow-md transition-transform duration-300 ease-out ${
          mode === 'time' ? 'translate-x-0' : 'translate-x-full'
        }`}
      />
      <button 
        type="button"
        onClick={() => {
           onModeChange('time');
           if (!RUN_TIME_OPTIONS.includes(value)) onChange('1 min');
        }}
        className={`relative z-10 flex-1 py-2.5 text-xs uppercase font-bold transition-colors duration-300 ${mode === 'time' ? 'text-running' : 'text-muted hover:text-gray-300'}`}
      >
        ⏱ Tempo
      </button>
      <button 
        type="button"
        onClick={() => {
           onModeChange('distance');
           if (!RUN_DISTANCE_OPTIONS.includes(value)) onChange('100m');
        }}
        className={`relative z-10 flex-1 py-2.5 text-xs uppercase font-bold transition-colors duration-300 ${mode === 'distance' ? 'text-running' : 'text-muted hover:text-gray-300'}`}
      >
        📏 Distanza
      </button>
    </div>
  )
}

function RunningStepPicker({ onAdd, onClose, initialStep }) {
  const parseMin = (p) => p ? (p.includes(' - ') ? p.split(' - ')[0] + (p.includes('/km') ? ' /km' : '') : p) : 'Libero'
  const parseMax = (p) => p ? (p.includes(' - ') ? p.split(' - ')[1] : '-') : '-'

  const [type, setType] = useState(initialStep?.type || 'run')
  const [duration, setDuration] = useState(initialStep?.duration || '10 min')
  const [durationMode, setDurationMode] = useState(!initialStep ? 'time' : ((initialStep.duration || '').includes('min') || (initialStep.duration || '').includes('sec') ? 'time' : 'distance'))
  const [pace, setPace] = useState(initialStep?.paceMin || parseMin(initialStep?.pace))
  const [paceMax, setPaceMax] = useState(initialStep?.paceMax || parseMax(initialStep?.pace))
  const [intensity, setIntensity] = useState(initialStep?.intensity || '5')
  const [notes, setNotes] = useState(initialStep?.notes || '')
  const [rounds, setRounds] = useState(initialStep?.rounds || '8')
  const [runDuration, setRunDuration] = useState(initialStep?.runDuration || '1 min')
  const [runDurationMode, setRunDurationMode] = useState(!initialStep ? 'time' : ((initialStep.runDuration || '').includes('min') || (initialStep.runDuration || '').includes('sec') ? 'time' : 'distance'))
  const [runPace, setRunPace] = useState(initialStep?.runPaceMin || parseMin(initialStep?.runPace))
  const [runPaceMax, setRunPaceMax] = useState(initialStep?.runPaceMax || parseMax(initialStep?.runPace))
  const [runIntensity, setRunIntensity] = useState(initialStep?.runIntensity || '8')
  const [recDuration, setRecDuration] = useState(initialStep?.recDuration || '1 min')
  const [recDurationMode, setRecDurationMode] = useState(!initialStep ? 'time' : ((initialStep.recDuration || '').includes('min') || (initialStep.recDuration || '').includes('sec') ? 'time' : 'distance'))
  const [recPace, setRecPace] = useState(initialStep?.recPaceMin || parseMin(initialStep?.recPace))
  const [recPaceMax, setRecPaceMax] = useState(initialStep?.recPaceMax || parseMax(initialStep?.recPace))
  const [recIntensity, setRecIntensity] = useState(initialStep?.recIntensity || '3')

  const formatPace = (p, pMax) => {
    if (!pMax || pMax === '-') return p
    if (p.includes(' /km') && pMax.includes(' /km')) {
      return `${p.replace(' /km', '')} - ${pMax}`
    }
    return `${p} - ${pMax}`
  }

  const handleAdd = () => {
    onAdd({
      id: initialStep ? initialStep.id : Math.random(), 
      type, 
      duration, pace: formatPace(pace, paceMax), paceMin: pace, paceMax, intensity, notes,
      rounds, runDuration, runPace: formatPace(runPace, runPaceMax), runPaceMin: runPace, runPaceMax, runIntensity,
      recDuration, recPace: formatPace(recPace, recPaceMax), recPaceMin: recPace, recPaceMax, recIntensity
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

  return createPortal(
    <div className="fixed inset-0 bg-black/85 z-[60] flex items-center justify-center p-4">
      <div className="bg-[#1e1e1e] rounded-3xl w-full max-w-md flex flex-col animate-in fade-in zoom-in-[0.96] duration-300 ease-out" style={{ maxHeight: 'calc(100vh - 100px)' }}>
        <div className="flex items-center justify-between p-5 border-b border-[#2a2a2a]">
          <p className="text-white font-bold">{initialStep ? 'Modifica Fase Corsa' : 'Aggiungi Fase Corsa'}</p>
          <button aria-label="Chiudi" onClick={onClose} className="text-muted hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-4 flex flex-col gap-4 overflow-y-auto flex-1">
          <div className="flex flex-wrap gap-2 mb-1">
            {['warmup', 'run', 'recover', 'cooldown', 'repeat'].map(t => (
              <button key={t} onClick={() => setType(t)}
                className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition ${
                  type === t ? 'bg-running/20 border-running text-running' : 'bg-[#2a2a2a] border-[#383838] text-gray-400 hover:text-white'
                }`}>
                {getTypeLabel(t)}
              </button>
            ))}
          </div>
          
          <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300 ease-out" key={type}>
            {type === 'repeat' ? (
              <>
              <ScrollPicker isRun options={RUN_REPEAT_ROUNDS_OPTIONS} value={rounds} onChange={setRounds} label="Numero di ripetizioni" />
              <div className="p-3 bg-[#222] border border-[#333] rounded-xl flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <p className="text-running text-sm font-semibold">Fase Attiva (Corsa)</p>
                  <div className="flex items-center gap-1">
                    <span className={`text-xs font-bold ${getIntensityColor(runIntensity)}`}>{runIntensity}/10</span>
                    <BicepsFlexed size={14} className={getIntensityColor(runIntensity)} />
                  </div>
                </div>
                <ModeToggle mode={runDurationMode} onModeChange={setRunDurationMode} value={runDuration} onChange={setRunDuration} />
                <div className="grid grid-cols-3 gap-2 animate-in fade-in duration-300" key={runDurationMode}>
                  <ScrollPicker isRun options={runDurationMode === 'time' ? RUN_TIME_OPTIONS : RUN_DISTANCE_OPTIONS} value={runDuration} onChange={setRunDuration} label={runDurationMode === 'time' ? 'Durata' : 'Distanza'} />
                  <ScrollPicker isRun options={RUN_PACE_OPTIONS} value={runPace} onChange={setRunPace} label="Da" />
                  <ScrollPicker isRun options={MAX_PACE_OPTIONS} value={runPaceMax} onChange={setRunPaceMax} label="A (Opz.)" />
                </div>
                <IntensityPicker value={runIntensity} onChange={setRunIntensity} activeColor="bg-running" />
              </div>
              <div className="p-3 bg-[#222] border border-[#333] rounded-xl flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <p className="text-green-400 text-sm font-semibold">Fase Recupero</p>
                  <div className="flex items-center gap-1">
                    <span className={`text-xs font-bold ${getIntensityColor(recIntensity)}`}>{recIntensity}/10</span>
                    <BicepsFlexed size={14} className={getIntensityColor(recIntensity)} />
                  </div>
                </div>
                <ModeToggle mode={recDurationMode} onModeChange={setRecDurationMode} value={recDuration} onChange={setRecDuration} />
                <div className="grid grid-cols-3 gap-2 animate-in fade-in duration-300" key={recDurationMode}>
                  <ScrollPicker isRun options={recDurationMode === 'time' ? RUN_TIME_OPTIONS : RUN_DISTANCE_OPTIONS} value={recDuration} onChange={setRecDuration} label={recDurationMode === 'time' ? 'Durata' : 'Distanza'} />
                  <ScrollPicker isRun options={RUN_PACE_OPTIONS} value={recPace} onChange={setRecPace} label="Da" />
                  <ScrollPicker isRun options={MAX_PACE_OPTIONS} value={recPaceMax} onChange={setRecPaceMax} label="A (Opz.)" />
                </div>
                <IntensityPicker value={recIntensity} onChange={setRecIntensity} activeColor="bg-running" />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Note</label>
                <input value={notes} onChange={e => setNotes(e.target.value)} className="w-full bg-[#2a2a2a] border border-[#383838] rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-running text-base" placeholder="Es: mantieni la zona 2 costante..." />
              </div>
              </>
            ) : (
              <>
              <ModeToggle mode={durationMode} onModeChange={setDurationMode} value={duration} onChange={setDuration} />
              <div className="grid grid-cols-3 gap-2 animate-in fade-in duration-300" key={durationMode}>
                <ScrollPicker isRun options={durationMode === 'time' ? RUN_TIME_OPTIONS : RUN_DISTANCE_OPTIONS} value={duration} onChange={setDuration} label={durationMode === 'time' ? 'Durata' : 'Distanza'} />
                <ScrollPicker isRun options={RUN_PACE_OPTIONS} value={pace} onChange={setPace} label="Da" />
                <ScrollPicker isRun options={MAX_PACE_OPTIONS} value={paceMax} onChange={setPaceMax} label="A (Opz.)" />
              </div>
              <div className="bg-[#222] border border-[#333] rounded-xl p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-xs">💪 Intensità</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${getIntensityColor(intensity)}`}>{intensity}/10</span>
                    <BicepsFlexed size={16} className={getIntensityColor(intensity)} />
                  </div>
                </div>
                <IntensityPicker value={intensity} onChange={setIntensity} activeColor="bg-running" />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Note</label>
                <input value={notes} onChange={e => setNotes(e.target.value)} className="w-full bg-[#2a2a2a] border border-[#383838] rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-running text-base" placeholder="Es: corsa leggera, focus tecnica..." />
              </div>
              </>
            )}
          </div>
          <button onClick={handleAdd} className="w-full mt-2 py-3 bg-running text-white font-bold rounded-xl hover:brightness-110 transition">
            {initialStep ? 'Salva Modifiche' : 'Aggiungi Fase'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ⚠️ Memoizzato (BACKLOG #15-bis). Guadagno minore di HyroxBlock — le fasi non
// hanno scroll picker da 102 opzioni — ma la dinamica è identica: senza memo,
// ogni carattere digitato nel titolo le ridisegna tutte.
//
// ⚠️ A differenza di HyroxBlock, qui il CONTRATTO NON È CAMBIATO: passava già
// tutto ciò che serve al padre (l'indice a onMoveUp/onMoveDown, step.id a
// onRemove, lo step intero a onEdit/onDuplicate), quindi bastava stabilizzare
// i gestori. L'asimmetria fra i due componenti è quindi VOLUTA e va mantenuta:
// uniformarli romperebbe il riordino delle fasi. Vedi CLAUDE.md §9-quinquies.
export const RunningStepRow = memo(function RunningStepRow({ step, index, total, onRemove, onMoveUp, onMoveDown, onDragStartIndex, onDragEnterIndex, onDragEndIndex, touchHandlers, onEdit, onDuplicate }) {

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
      case 'run': return 'text-running bg-running/10 border-running/30'
      case 'recover': return 'text-muted bg-[#1e1e1e] border-[#2a2a2a]'
      case 'cooldown': return 'text-gray-400 bg-[#111] border-[#222]'
      case 'repeat': return 'text-purple-400 bg-purple-400/10 border-purple-400/30'
      default: return 'text-white bg-[#222] border-[#333]'
    }
  }

  return (
    <div 
      {...(touchHandlers ? touchHandlers(index) : {})}
      draggable
      onDragStart={(e) => {
        e.stopPropagation()
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', index.toString())
        setTimeout(() => {
          if (e.target && e.target.classList) {
            e.target.classList.add('opacity-30', 'scale-[0.98]', 'shadow-lg')
          }
        }, 0)
        onDragStartIndex?.(index)
      }}
      onDragEnter={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onDragEnterIndex?.(index)
      }}
      onDragOver={(e) => {
        e.preventDefault()
        e.stopPropagation()
        e.dataTransfer.dropEffect = 'move'
      }}
      onDragEnd={(e) => {
        e.stopPropagation()
        if (e.target && e.target.classList) {
          e.target.classList.remove('opacity-30', 'scale-[0.98]', 'shadow-lg')
        }
        onDragEndIndex?.()
      }}
      data-drag-item
      className="drag-item flex items-start gap-3 bg-[#222] border border-[#2e2e2e] rounded-2xl px-4 py-3 hover:border-[#444] transition-all duration-200 cursor-move"
    >
      <div className="flex flex-col items-center justify-center shrink-0 mt-1">
        <button aria-label="Sposta la fase su" type="button" onClick={() => onMoveUp && onMoveUp(index)} disabled={index === 0} className={`text-muted hover:text-running disabled:opacity-0 p-0.5`}><ChevronUp size={16}/></button>
        <button aria-label="Sposta la fase giù" type="button" onClick={() => onMoveDown && onMoveDown(index)} disabled={index === (total || 1) - 1} className={`text-muted hover:text-running disabled:opacity-0 p-0.5`}><ChevronDown size={16}/></button>
      </div>
      <div className="flex-1 cursor-pointer group self-stretch flex flex-col justify-center py-2 -my-2" onClick={() => onEdit && onEdit(step)}>
        <div className="flex items-center gap-2 mb-1 group-hover:opacity-80 transition">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-lg border ${getTypeColor(step.type)}`}>
            {getTypeLabel(step.type)}
          </span>
          {step.type === 'repeat' && <span className="text-white text-sm font-bold bg-[#0B0B0B] px-2 py-0.5 rounded-full border border-[#333]">x{step.rounds}</span>}
        </div>
        {step.type === 'repeat' ? (
          <div className="text-sm mt-2 flex flex-col gap-1.5 ml-1 border-l-2 border-[#333] pl-3">
            <div>
              <span className="text-gray-300 font-medium">Corsa:</span> <span className="text-white">{step.runDuration}</span>
              {step.runPace && <span className="text-muted text-xs ml-1">@{step.runPace}</span>}
            </div>
            <div>
              <span className="text-muted font-medium">Recupero:</span> <span className="text-gray-400">{step.recDuration}</span>
              {step.recPace && <span className="text-muted text-xs ml-1">@{step.recPace}</span>}
            </div>
            {step.intensity && (
              <div className="flex items-center gap-1">
                <span className={`text-xs font-bold ${getIntensityColor(step.intensity)}`}>{step.intensity}/10</span><BicepsFlexed size={14} className={getIntensityColor(step.intensity)} />
              </div>
            )}
            {step.notes && <p className="text-muted text-xs mt-0.5">{step.notes}</p>}
          </div>
        ) : (
          <div className="text-sm mt-1 text-gray-300">
            {step.duration && <span className="font-semibold text-white">{step.duration}</span>}
            {step.pace && <span className="ml-2 text-muted">@{step.pace}</span>}
            {step.notes && <p className="text-muted text-xs mt-0.5">{step.notes}</p>}
          </div>
        )}
      </div>
      <div className="flex items-center shrink-0 mt-1">
        <button aria-label="Duplica la fase" type="button" onClick={() => onDuplicate && onDuplicate(step)} className="text-muted hover:text-running transition shrink-0 p-2" title="Duplica fase">
          <Copy size={15} />
        </button>
        <button aria-label="Elimina la fase" type="button" onClick={() => onRemove(step.id)} className="text-gray-700 hover:text-red-400 transition shrink-0 p-2">
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  )
})

// ─── MAIN ─────────────────────────────────────────────────────
// ─── DUE CARD CONDIVISE DAI TRE PASSI 2 ───────────────────────────────────
// Stanno qui e non in CreaWorkoutUI.jsx perché hanno bisogno di IntensityPicker
// e getIntensityColor, che vivono in questo file: importarle di là creerebbe un
// ciclo fra i due moduli per risparmiare venti righe.

/**
 * L'intensità dichiarata dal coach.
 *
 * ⚠️ NON è il «RPE atteso» del riepilogo, che è calcolato dagli esercizi e ha i
 * decimali. Questa è una dichiarazione, finisce in `workouts.sections.intensity`
 * e viene riletta dalla scheda, dal PDF e dalla story: l'artboard non la mostra,
 * ma toglierla vorrebbe dire perdere un campo che il coach controlla e che tre
 * altre superfici leggono.
 */
function CardIntensita({ valore, onChange, classeColore }) {
  return (
    <div className={`${CARD} px-4 py-[15px] flex flex-col gap-3`}>
      <div className="flex items-center justify-between">
        <span className={LABEL}>Intensità dichiarata</span>
        <div className="flex items-center gap-1.5">
          <span className={`font-mono text-sm font-extrabold ${getIntensityColor(valore)}`}>{valore}/10</span>
          <BicepsFlexed size={17} className={getIntensityColor(valore)} />
        </div>
      </div>
      <IntensityPicker value={valore} onChange={onChange} activeColor={classeColore} />
    </div>
  )
}

/** Le note del coach, nello stesso linguaggio delle altre card. */
function NoteCoach({ valore, onChange, etichetta, nota, placeholder, righe = 3 }) {
  return (
    <div className={`${CARD} px-4 py-[14px]`}>
      <div className="flex items-center justify-between gap-2.5">
        <span className={LABEL}>{etichetta}</span>
        {nota && <span className="text-[11px] font-bold text-[#5b6070]">{nota}</span>}
      </div>
      <textarea
        aria-label={etichetta}
        rows={righe}
        className="w-full mt-2 bg-transparent text-sm font-medium leading-relaxed text-white
                   placeholder-[#5b6070] focus:outline-none resize-none"
        placeholder={placeholder}
        value={valore}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  )
}

export default function CreateWorkout() {
  const [searchParams] = useSearchParams()
  const editId = searchParams.get('edit')
  const duplicateId = searchParams.get('duplicate')
  const awId = searchParams.get('aw_id')
  const athleteId = searchParams.get('athlete_id')
  const sourceId = editId || duplicateId
  const defaultDate = searchParams.get('date')

  const [step, setStep] = useState(1) // 1=tipo, 2=build
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(defaultDate || format(new Date(), 'yyyy-MM-dd'))
  const [workoutIntensity, setWorkoutIntensity] = useState('5')
  const [category, setCategory] = useState('Hyrox')
  const [blocks, setBlocks] = useState([])
  const [blockPickerOpen, setBlockPickerOpen] = useState(false)
  const [aiModalOpen, setAiModalOpen] = useState(false)
  const [openBlockId, setOpenBlockId] = useState(null)
  const draggedBlockIdx = useRef(null)

  // ⚠️ Aggiungere un blocco CHIUDE quello aperto prima, quindi la pagina si
  // accorcia di colpo e il blocco nuovo — che sta in fondo alla lista — finisce
  // fuori schermo: il coach lo crea e non lo vede. Qui si segna quale mostrare,
  // e un effetto lo porta sotto gli occhi dopo che il layout si è assestato.
  // Un ref e non uno stato: non è mai letto durante il render, ed evita il giro
  // in più (stessa ragione di `draggedBlockIdx`).
  const bloccoDaMostrare = useRef(null)
  
  // Running
  const [runningSteps, setRunningSteps] = useState([])
  const [runningPickerOpen, setRunningPickerOpen] = useState(false)
  const [editingStep, setEditingStep] = useState(null)
  const draggedStepIdx = useRef(null)

  // Note + pause
  const [coachNotes, setCoachNotes] = useState('')

  // Modal Salvataggio
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [isSavingAsNew, setIsSavingAsNew] = useState(false)
  const [newWorkoutName, setNewWorkoutName] = useState('')

  const navigate = useNavigate()

  // Hook touch per riordinare i BLOCCHI HYROX
  // ⚠️ useTouchDrag memoizza getTouchHandlers su onReorder: con un'arrow inline
  // qui, touchHandlers cambierebbe identità a ogni render e annullerebbe memo.
  const riordinaBlocchi = useCallback((from, to) => setBlocks(prev => moveElement(prev, from, to)), [])
  const { getTouchHandlers: getBlockTouchHandlers } = useTouchDrag({ onReorder: riordinaBlocchi })

  // ── Gestori di HyroxBlock, tutti stabili (BACKLOG #15) ──────────────────
  // Nessuno cattura `blocks` o `idx`: lavorano per id dentro un aggiornamento
  // funzionale. Se qui torna un'arrow inline, React.memo sul figlio smette di
  // servire senza che niente lo segnali — tranne HyroxBlockMemo.test.jsx.
  const bloccoToggle = useCallback((id) => {
    setOpenBlockId(prev => (prev === id ? null : id))
  }, [])

  // onUpdate riceve il blocco intero: l'id è già dentro, niente da passare.
  const bloccoUpdate = useCallback((nuovo) => {
    setBlocks(prev => prev.map(b => (b.id === nuovo.id ? nuovo : b)))
  }, [])

  const bloccoRemove = useCallback((id) => {
    setBlocks(prev => prev.filter(b => b.id !== id))
  }, [])

  const bloccoMoveUp = useCallback((id) => {
    setBlocks(prev => {
      const i = prev.findIndex(b => b.id === id)
      return i > 0 ? moveElement(prev, i, i - 1) : prev
    })
  }, [])

  const bloccoMoveDown = useCallback((id) => {
    setBlocks(prev => {
      const i = prev.findIndex(b => b.id === id)
      return i >= 0 && i < prev.length - 1 ? moveElement(prev, i, i + 1) : prev
    })
  }, [])

  const bloccoDuplicate = useCallback((id) => {
    setBlocks(prev => {
      const i = prev.findIndex(b => b.id === id)
      if (i === -1) return prev
      const copia = JSON.parse(JSON.stringify(prev[i]))
      copia.id = Math.random()
      if (copia.exercises) copia.exercises = copia.exercises.map(ex => ({ ...ex, id: Math.random() }))
      const nuovi = [...prev]
      nuovi.splice(i + 1, 0, copia)
      return nuovi
    })
  }, [])

  const bloccoDuplicaEsercizio = useCallback((id, esercizio) => {
    setBlocks(prev => prev.map(b => (b.id === id
      ? { ...b, exercises: [...(b.exercises || []), { ...esercizio, id: Math.random() }] }
      : b)))
  }, [])

  const bloccoDragStart = useCallback((i) => { draggedBlockIdx.current = i }, [])
  const bloccoDragEnter = useCallback((i) => {
    const da = draggedBlockIdx.current
    if (da !== null && da !== i) {
      setBlocks(prev => moveElement(prev, da, i))
      draggedBlockIdx.current = i
    }
  }, [])
  const bloccoDragEnd = useCallback(() => { draggedBlockIdx.current = null }, [])

  useEffect(() => {
    const id = bloccoDaMostrare.current
    if (id === null) return
    bloccoDaMostrare.current = null
    // Un frame di attesa: il blocco appena aperto sta ancora montando il suo
    // corpo, e senza questo si scorre verso una posizione che cambia subito dopo.
    requestAnimationFrame(() => {
      // La chiamata è opzionale anche sul metodo: un TypeError dentro un rAF
      // non fa fallire niente, sparisce e basta — che è il modo peggiore di
      // scoprire che un ambiente non implementa scrollIntoView.
      document.querySelector(`[data-blocco-id="${id}"]`)
        ?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
    })
  }, [blocks])

  // Hook touch per riordinare le FASI RUNNING
  // Come per i blocchi: getTouchHandlers è memoizzato su onReorder, quindi
  // un'arrow inline qui renderebbe instabile la prop touchHandlers.
  const riordinaFasi = useCallback((from, to) => setRunningSteps(prev => moveElement(prev, from, to)), [])
  const { getTouchHandlers: getStepTouchHandlers } = useTouchDrag({ onReorder: riordinaFasi })

  // ── Gestori di RunningStepRow, tutti stabili (BACKLOG #15-bis) ─────────
  // Il contratto era già adatto: ricevono indice o id, quindi non serviva
  // cambiarlo. Bastava non richiudersi su `runningSteps`.
  const faseRemove = useCallback((id) => {
    setRunningSteps(prev => prev.filter(s => s.id !== id))
  }, [])

  // moveElement ignora già gli indici fuori intervallo: nessun controllo qui,
  // o sarebbe una protezione che non protegge (verificato il 26/08/2026).
  const faseMoveUp = useCallback((i) => {
    setRunningSteps(prev => moveElement(prev, i, i - 1))
  }, [])

  const faseMoveDown = useCallback((i) => {
    setRunningSteps(prev => moveElement(prev, i, i + 1))
  }, [])

  const faseEdit = useCallback((fase) => {
    setEditingStep(fase)
    setRunningPickerOpen(true)
  }, [])

  const faseDuplicate = useCallback((fase) => {
    setRunningSteps(prev => [...prev, { ...fase, id: Math.random() }])
  }, [])

  const faseDragStart = useCallback((i) => { draggedStepIdx.current = i }, [])
  const faseDragEnter = useCallback((i) => {
    const da = draggedStepIdx.current
    if (da !== null && da !== i) {
      setRunningSteps(prev => moveElement(prev, da, i))
      draggedStepIdx.current = i
    }
  }, [])
  const faseDragEnd = useCallback(() => { draggedStepIdx.current = null }, [])


  // Se editId o duplicateId sono presenti, carichiamo i dati del workout
  useEffect(() => {
    const fetchWorkoutToEdit = async () => {
      if (!sourceId) return
      const { data, error } = await supabase.from('workouts').select('*').eq('id', sourceId).single()
      if (error || !data) return

      setTitle(duplicateId ? `${data.title} (Copia)` : data.title)
      setCoachNotes(data.coach_notes || '')
      
      let loadedDate = data.date
      if (awId && !duplicateId) {
        const { data: awData } = await supabase.from('athlete_workouts').select('completed_date').eq('id', awId).single()
        if (awData) loadedDate = awData.completed_date
      }
      if (!duplicateId) setDate(loadedDate)
      
      const s = data.sections || {}
      if (s.blocks || s.steps || s.category) {
        setBlocks(s.blocks || [])
        setRunningSteps(s.steps || [])
        setWorkoutIntensity(s.intensity || '5')
        setCategory(s.category || (s.steps ? 'Running' : 'Hyrox'))
        if (s.blocks && s.blocks.length > 0) {
          setOpenBlockId(s.blocks[s.blocks.length - 1].id)
        }
      } else {
        const migratedBlocks = []
        if (s.warmup) migratedBlocks.push({ id: Math.random(), type: 'WarmUp', params: { duration: s.warmup.duration }, notes: s.warmup.notes })
        if (s.cashIn && s.cashIn.length > 0) migratedBlocks.push({ id: Math.random(), type: 'Cash In', exercises: s.cashIn })
        if (s.main) {
          if (s.main.type === 'Running') {
             setCategory('Running')
             setRunningSteps(s.main.steps || [])
          } else {
             setCategory('Hyrox')
             migratedBlocks.push({
               id: Math.random(),
               type: s.main.type === 'EMOM' && s.main.params?.on ? 'ON/OFF' : s.main.type,
               params: s.main.params || {},
               exercises: s.main.exercises || []
             })
          }
        }
        if (s.cashOut && s.cashOut.length > 0) migratedBlocks.push({ id: Math.random(), type: 'Cash Out', exercises: s.cashOut })
        
        setBlocks(migratedBlocks)
        setWorkoutIntensity(s.intensity || '5')
        if (migratedBlocks.length > 0) {
          setOpenBlockId(migratedBlocks[migratedBlocks.length - 1].id)
        }
      }
      setStep(2)
    }

    const draftStr = localStorage.getItem('fleofit_workout_draft')
    if (draftStr) {
      try {
        const draft = JSON.parse(draftStr)
        if ((draft.sourceId || null) === (sourceId || null)) {
          setConfirmInfo({
            title: 'Bozza Trovata',
            message: 'Hai un allenamento non salvato! Vuoi ripristinarlo da dove eri rimasto?',
            onConfirm: () => {
              setTitle(draft.title || '')
              setDate(draft.date || format(new Date(), 'yyyy-MM-dd'))
              setWorkoutIntensity(draft.workoutIntensity || '5')
              setCategory(draft.category || 'Hyrox')
              setBlocks(draft.blocks || [])
              setRunningSteps(draft.runningSteps || [])
              setCoachNotes(draft.coachNotes || '')
              if (draft.title) setStep(2)
              setConfirmInfo(null)
            },
            onCancel: () => {
              localStorage.removeItem('fleofit_workout_draft')
              setConfirmInfo(null)
              fetchWorkoutToEdit()
            }
          })
          return
        } else {
          localStorage.removeItem('fleofit_workout_draft')
        }
      } catch {
        localStorage.removeItem('fleofit_workout_draft')
      }
    }
    fetchWorkoutToEdit()
  }, [sourceId, duplicateId])

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [pendingPath, setPendingPath] = useState(null)
  const [alertInfo, setAlertInfo] = useState(null)
  const [confirmInfo, setConfirmInfo] = useState(null)

  const hasUnsavedChanges = title.trim() !== '' || blocks.length > 0 || runningSteps.length > 0

  // 0. Salvataggio automatico bozza in locale
  useEffect(() => {
    if (hasUnsavedChanges && !saved) {
      const draft = { sourceId: sourceId || null, title, date, workoutIntensity, category, blocks, runningSteps, coachNotes }
      localStorage.setItem('fleofit_workout_draft', JSON.stringify(draft))
    }
  }, [title, date, workoutIntensity, category, blocks, runningSteps, coachNotes, sourceId, hasUnsavedChanges, saved])

  useEffect(() => {
    if (saved) localStorage.removeItem('fleofit_workout_draft')
  }, [saved])

  useEffect(() => {
    // 1. Intercetta chiusura/aggiornamento del tab del browser
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges && !saved) {
        e.preventDefault()
        // I browser moderni (specialmente iOS Safari) ignorano i messaggi personalizzati
        // e richiedono esplicitamente il ritorno di una stringa vuota per attivare il popup nativo
        e.returnValue = ''
        return ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    // Fix specifico per forzare l'avviso su iOS Safari
    window.onbeforeunload = handleBeforeUnload

    // Blocca fisicamente il "Pull to Refresh" (trascinamento verso il basso) su mobile
    if (hasUnsavedChanges && !saved) {
      document.body.style.overscrollBehavior = 'none'
      document.documentElement.style.overscrollBehavior = 'none'
    } else {
      document.body.style.overscrollBehavior = 'auto'
      document.documentElement.style.overscrollBehavior = 'auto'
    }

    // Blocca fisicamente il "Pull to Refresh" tramite Javascript per Safari iOS
    let touchStartY = 0
    const handleTouchStart = (e) => {
      if (e.touches && e.touches.length > 0) touchStartY = e.touches[0].clientY
    }
    const handleTouchMove = (e) => {
      // Se stiamo scorrendo verso il basso partendo dalla cima della pagina
      if (hasUnsavedChanges && !saved && window.scrollY <= 0) {
        if (e.touches && e.touches.length > 0 && e.touches[0].clientY > touchStartY) {
          e.preventDefault() // Annulla il ricaricamento manuale
        }
      }
    }
    document.addEventListener('touchstart', handleTouchStart, { passive: false })
    document.addEventListener('touchmove', handleTouchMove, { passive: false })

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
      window.onbeforeunload = null
      document.removeEventListener('click', handleLinkClick, { capture: true })
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchmove', handleTouchMove)
      document.body.style.overscrollBehavior = 'auto'
      document.documentElement.style.overscrollBehavior = 'auto'
    }
  }, [hasUnsavedChanges, saved])

  const handleBack = () => {
    if (step === 2 && !sourceId) {
      setStep(1)
    } else {
      if (hasUnsavedChanges && !saved) {
        setPendingPath(-1)
        setShowExitConfirm(true)
      } else {
        localStorage.removeItem('fleofit_workout_draft')
        navigate(-1)
      }
    }
  }

  const isStep1Valid = title.trim() !== '' || category === 'Custom'

  // I tre numeri in cima allo step 2 e i segmenti della barra. Un useMemo e non
  // uno stato aggiornato da un effetto: sono una funzione dei blocchi, e uno
  // stato derivato può restare indietro di un render (CLAUDE.md §9-septies).
  const riepilogo = useMemo(() => riepilogoWorkout(blocks), [blocks])

  const sottotitoloWorkout = useMemo(() => {
    const d = date && isValid(parseISO(date)) ? format(parseISO(date), 'EEE d MMM', { locale: it }) : ''
    return [d, categoriaCorrente(category).nome].filter(Boolean).join(' · ')
  }, [date, category])


  const handleSave = async () => {
    if (!title && category !== 'Custom') return setAlertInfo({ title: 'Dati mancanti', message: 'Inserisci il titolo del workout!', type: 'error' })
    if (category === 'Hyrox' && blocks.length === 0) return setAlertInfo({ title: 'Dati mancanti', message: 'Aggiungi almeno un blocco!', type: 'error' })
    if (category === 'Running' && runningSteps.length === 0) return setAlertInfo({ title: 'Dati mancanti', message: 'Aggiungi almeno una fase di corsa!', type: 'error' })
    if (category === 'Custom' && !coachNotes.trim()) return setAlertInfo({ title: 'Dati mancanti', message: 'Inserisci una descrizione per l\'allenamento!', type: 'error' })
    
    if (editId) {
      setNewWorkoutName(title)
      setIsSavingAsNew(false)
      setShowSaveModal(true)
    } else {
      performSave(false)
    }
  }

  const performSave = async (saveAsNew) => {
    setShowSaveModal(false)
    setSaving(true)
    const finalTitle = titoloOppureGenerato(
      saveAsNew ? newWorkoutName : title,
      date,
      await titoliDelGiorno(supabase, date)
    )

    const sections = {
      intensity: workoutIntensity,
      category: category,
      blocks: category === 'Hyrox' ? blocks : undefined,
      steps: category === 'Running' ? runningSteps : undefined
    }

    const payload = { title: finalTitle, date, sections, coach_notes: coachNotes }
    let targetId = saveAsNew ? null : editId

    if (targetId) {
      const { error } = await supabase.from('workouts').update(payload).eq('id', editId)
      if (awId) {
        await supabase.from('athlete_workouts').update({ completed_date: date }).eq('id', awId)
      }
      setSaving(false)
      if (error) { setAlertInfo({ title: 'Errore', message: error.message, type: 'error' }); return }
    } else {
      const { data: newWorkout, error } = await supabase.from('workouts').insert(payload).select().single()
      if (error) { 
        setSaving(false)
        setAlertInfo({ title: 'Errore', message: error.message, type: 'error' })
        return 
      }
      targetId = newWorkout.id

      if (saveAsNew && awId) {
        const { error: awError } = await supabase.from('athlete_workouts').update({
          workout_id: targetId,
          completed_date: date
        }).eq('id', awId)
        if (awError) console.error("Errore aggiornamento assegnazione:", awError)
      } else if (athleteId) {
        const { data: newAssignment, error: awError } = await supabase.from('athlete_workouts').insert({
          athlete_id: athleteId,
          workout_id: targetId,
          completed_date: date,
          status: 'pending'
        }).select('id').single()
        if (awError) {
          console.error("Errore assegnazione:", awError)
        } else if (newAssignment) {
          supabase.functions.invoke('send-reminders', {
            body: { mode: 'immediate', record_id: newAssignment.id }
          }).catch(console.error)
        }
      }
      setSaving(false)
    }

    setSaved(true)
    navigate(`/workout/${targetId}${athleteId ? `?athlete_id=${athleteId}` : ''}`, { replace: true })
  }

  return (
    <div className="px-4 max-w-2xl mx-auto min-h-[100dvh] flex flex-col gap-[18px]
                    pt-[calc(env(safe-area-inset-top)+1rem)] pb-[var(--altezza-navbar)] page-transition">
      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .drag-item {
          -webkit-touch-callout: none;
          -webkit-user-select: none;
          user-select: none;
          -webkit-user-drag: element;
        }
        .drag-item input, .drag-item textarea, .drag-item select, .drag-item button {
          -webkit-user-select: auto;
          user-select: auto;
          -webkit-user-drag: auto;
        }
      `}</style>
      <TestataCrea
        passo={step}
        onIndietro={handleBack}
        titolo={step === 2 ? (title.trim() || generaTitolo(date)) : null}
        sottotitolo={step === 2 ? sottotitoloWorkout : null}
        onTitolo={step === 2 ? () => setStep(1) : null}
      />

      {/* ── STEP 1: LA CATEGORIA COME DOMANDA ────────────────────── */}
      {step === 1 && (
        <div className="flex flex-col gap-[18px]">
          <div>
            <p className={`${LABEL} text-brand mb-[5px] tracking-[.11em]`}>{editId ? 'Modifica workout' : 'Nuovo workout'}</p>
            <h1 className="text-[29px] font-black tracking-[-.035em] leading-[1.1] text-white">
              Che tipo di<br />allenamento è?
            </h1>
          </div>

          <div className="flex flex-col gap-[11px]">
            {CATEGORIE.map(c => (
              <CardCategoria
                key={c.id}
                attiva={category === c.id}
                colore={c.colore}
                testoSuColore={c.testoSuColore}
                icona={ICONA_CATEGORIA[c.id]}
                nome={c.nome}
                descrizione={c.descrizione}
                onClick={() => setCategory(c.id)}
              />
            ))}
          </div>

          <div className="h-px bg-white/[.07]" />

          {/* Nome e data scendono SOTTO la scelta: si compilano una volta e si
              dimenticano, e in cima resta la domanda che conta. */}
          <div className="flex flex-col gap-2.5">
            <RigaCampo etichetta="Nome">
              <input
                aria-label="Nome del workout"
                enterKeyHint="done"
                onKeyDown={chiudiTastieraSuInvio}
                className="w-full bg-transparent text-[15.5px] font-bold text-white placeholder-[#5b6070] focus:outline-none"
                placeholder={category === 'Custom' ? generaTitolo(date) : 'Es. Hyrox Strength #1'}
                value={title}
                onChange={e => setTitle(e.target.value)}
              />
            </RigaCampo>
            <RigaCampo etichetta="Data">
              <CustomDatePicker
                date={date}
                onChange={setDate}
                placeholder="Scegli la data"
                className="text-[15.5px] font-bold"
              />
            </RigaCampo>
          </div>

          {!isStep1Valid && (
            <p className="text-center text-xs font-semibold text-muted animate-in fade-in duration-300">
              Serve un nome per proseguire.
            </p>
          )}
        </div>
      )}

      {/* ── STEP 2: IL BUILDER CON IL RIEPILOGO ──────────────────── */}
      {step === 2 && category === 'Hyrox' && (
        <div className="flex flex-col gap-3.5">

          {/* Il builder era cieco: si aggiungevano blocchi senza sapere quanto
              dura la seduta. La barra sotto i tre numeri dice COME la durata è
              distribuita — un riscaldamento che si mangia metà seduta si vede a
              occhio, senza leggere un solo tempo. */}
          <RiepilogoWorkout {...riepilogo} />

          <CardIntensita
            valore={workoutIntensity}
            onChange={setWorkoutIntensity}
            classeColore="bg-brand"
          />

          {/* ⚠️ Sta QUI, sopra i blocchi, e non sotto: è il modo di PARTIRE da
              zero, quindi deve essere visibile quando la lista è vuota o corta —
              non scendere in fondo insieme alla lista man mano che cresce.
              L'artboard la disegnava sotto; alla prova sul dispositivo, con
              cinque blocchi aperti, non la trovava più nessuno. */}
          <CardIA onClick={() => setAiModalOpen(true)} />

          <div className="flex flex-col gap-[11px]" data-drag-container>
            {blocks.map((block, idx) => (
              <HyroxBlock
                key={block.id} block={block} index={idx} total={blocks.length}
                isOpen={openBlockId === block.id}
                onToggle={bloccoToggle}
                onUpdate={bloccoUpdate}
                onRemove={bloccoRemove}
                onMoveUp={bloccoMoveUp}
                onMoveDown={bloccoMoveDown}
                onDragStartIndex={bloccoDragStart}
                onDragEnterIndex={bloccoDragEnter}
                onDragEndIndex={bloccoDragEnd}
                onDuplicate={bloccoDuplicate}
                onDuplicateExerciseRequest={bloccoDuplicaEsercizio}
                touchHandlers={getBlockTouchHandlers}
              />
            ))}
          </div>

          <BottoneGhost onClick={() => setBlockPickerOpen(true)}>Aggiungi blocco</BottoneGhost>

          <NoteCoach
            valore={coachNotes}
            onChange={setCoachNotes}
            etichetta="Note coach"
            nota="Nel PDF"
            placeholder="Es: vai a cedimento sull'ultimo esercizio, tieni il ritmo sul row…"
          />
        </div>
      )}

      {blockPickerOpen && (
        <BlockPickerModal 
          onClose={() => setBlockPickerOpen(false)}
          onAdd={(type) => {
            const newBlock = { id: Math.random(), type, params: {}, exercises: [] }
            if (type === 'WarmUp' || type === 'Rest') newBlock.params.duration = '3:00'
            if (type === 'ON/OFF') { newBlock.params.on = '1:00'; newBlock.params.off = '1:00'; newBlock.params.rounds = '10' }
            if (type === 'EMOM') { newBlock.params.interval = '1:00'; newBlock.params.rounds = '10' }
            if (type === 'AMRAP') { newBlock.params.duration = '10:00' }
            if (type === 'For Time') { newBlock.params.rounds = '3' }
                        if (type === 'Interval') { newBlock.params.rounds = '1' }

            if (type === 'Cash In' || type === 'Cash Out') { newBlock.params.rounds = '1' }
            setBlocks([...blocks, newBlock])
            setOpenBlockId(newBlock.id)
            bloccoDaMostrare.current = newBlock.id
            setBlockPickerOpen(false)
          }}
        />
      )}

      {aiModalOpen && (
        <AiGenerationModal 
          onClose={() => setAiModalOpen(false)}
          onGenerate={(newBlocks) => {
            const formattedBlocks = newBlocks.map(b => ({
              ...b,
              id: Math.random(),
              exercises: (b.exercises || []).map(ex => ({
                ...ex,
                id: Math.random()
              }))
            }))
            setBlocks([...blocks, ...formattedBlocks])
            if (formattedBlocks.length > 0) {
              setOpenBlockId(formattedBlocks[formattedBlocks.length - 1].id)
              // Il primo dei blocchi generati, non l'ultimo: l'IA ne scrive
              // parecchi in un colpo, e il coach deve vedere da dove comincia.
              bloccoDaMostrare.current = formattedBlocks[0].id
            }
          }}
        />
      )}

      {/* ── STEP 2: LE FASI DI CORSA ─────────────────────────────── */}
      {/* ⚠️ Il corpo di questa schermata NON è stato ridisegnato: l'artboard
          «Crea Workout» copre lo step 1 (tutte e tre le categorie) e lo step 2
          Hyrox. Qui cambiano la cornice condivisa — testata, card, barra fissa —
          e non il modo di comporre le fasi, che resta quello di prima. */}
      {step === 2 && category === 'Running' && (
        <div className="flex flex-col gap-3.5">
          <CardIntensita
            valore={workoutIntensity}
            onChange={setWorkoutIntensity}
            classeColore="bg-running"
          />

          <div className={`${CARD} px-4 py-[15px] flex flex-col gap-3`}>
            <div className="flex items-center justify-between">
              <span className={LABEL}>Fasi dell'allenamento</span>
              <button aria-label="Aggiungi una fase di corsa" type="button" onClick={() => { setEditingStep(null); setRunningPickerOpen(true) }}
                className="text-running hover:brightness-125 transition p-1 -m-1">
                <Plus size={18} />
              </button>
            </div>

            {runningSteps.length === 0 ? (
              <button type="button" onClick={() => { setEditingStep(null); setRunningPickerOpen(true) }}
                className="min-h-12 rounded-[14px] border border-dashed border-running/40 text-running text-[13.5px] font-extrabold
                           flex items-center justify-center gap-2 hover:bg-running/10 transition">
                <Plus size={16} aria-hidden="true" /> Aggiungi la prima fase
              </button>
            ) : (
              <div className="flex flex-col gap-2" data-drag-container>
                {runningSteps.map((step, i) => (
                  <RunningStepRow
                    key={step.id}
                    step={step}
                    index={i}
                    total={runningSteps.length}
                    onRemove={faseRemove}
                    onMoveUp={faseMoveUp}
                    onMoveDown={faseMoveDown}
                    onDragStartIndex={faseDragStart}
                    onDragEnterIndex={faseDragEnter}
                    onDragEndIndex={faseDragEnd}
                    onEdit={faseEdit}
                    onDuplicate={faseDuplicate}
                    touchHandlers={getStepTouchHandlers}
                  />
                ))}
                <button type="button" onClick={() => { setEditingStep(null); setRunningPickerOpen(true) }}
                  className="min-h-11 rounded-[14px] border border-dashed border-running/40 text-running text-[13.5px] font-extrabold
                             flex items-center justify-center gap-2 hover:bg-running/10 transition mt-1">
                  <Plus size={16} aria-hidden="true" /> Aggiungi fase
                </button>
              </div>
            )}
          </div>

          <NoteCoach
            valore={coachNotes}
            onChange={setCoachNotes}
            etichetta="Note coach"
            nota="Nel PDF"
            placeholder="Es: parti tranquillo, chiudi progressivo…"
          />
        </div>
      )}

      {/* ── STEP 2: L'ALLENAMENTO DESCRITTO A PAROLE ─────────────── */}
      {step === 2 && category === 'Custom' && (
        <div className="flex flex-col gap-3.5">
          <CardIntensita
            valore={workoutIntensity}
            onChange={setWorkoutIntensity}
            classeColore="bg-custom"
          />

          <NoteCoach
            valore={coachNotes}
            onChange={setCoachNotes}
            etichetta="Descrizione per l'atleta"
            nota="Obbligatoria"
            righe={10}
            placeholder="Descrivi l'allenamento in dettaglio. Questa descrizione apparirà a tutti gli atleti a cui assegnerai questo workout."
          />
        </div>
      )}

      {/* Salva stava in fondo a uno scroll che cresce con il workout: più il
          coach costruiva, più il salvataggio si allontanava. Ora è ancorato, e
          la stessa barra serve i tre passi 2 e il passo 1. */}
      <div className="mt-auto" />
      <BarraAzioni>
        {step === 1 ? (
          <CtaPrimaria onClick={() => setStep(2)} disabled={!isStep1Valid} iconaCoda={ArrowRight}>
            Costruisci l'allenamento
          </CtaPrimaria>
        ) : (
          <>
            {editId && (
              <BottoneQuadrato
                etichetta="Salva come nuovo allenamento"
                onClick={() => { setNewWorkoutName(title); setIsSavingAsNew(true); setShowSaveModal(true) }}
              />
            )}
            <CtaPrimaria onClick={handleSave} disabled={saving} icona={Save}>
              {saving ? 'Salvo…' : saved ? 'Salvato!' : 'Salva workout'}
            </CtaPrimaria>
          </>
        )}
      </BarraAzioni>

      {/* RUNNING STEP PICKER MODAL */}
      {runningPickerOpen && (
        <RunningStepPicker
          initialStep={editingStep}
          onAdd={step => {
            if (editingStep) {
              setRunningSteps(runningSteps.map(s => s.id === step.id ? step : s))
            } else {
              setRunningSteps([...runningSteps, step])
            }
          }}
          onClose={() => setRunningPickerOpen(false)}
        />
      )}

      {/* SAVE MODAL */}
      {showSaveModal && createPortal(
        <div className="fixed inset-0 bg-black/85 z-[100] flex items-center justify-center p-4">
          <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-3xl w-full max-w-sm p-6 flex flex-col gap-4 shadow-2xl animate-in fade-in zoom-in-[0.96] duration-300 ease-out">
            <div className="flex justify-between items-center mb-2">
               <h2 className="text-xl font-bold text-white">Salvataggio</h2>
               <button aria-label="Chiudi" onClick={() => setShowSaveModal(false)} className="text-muted hover:text-white"><X size={20} /></button>
            </div>
            
            {!isSavingAsNew ? (
              <>
                <p className="text-gray-400 text-sm">Vuoi sovrascrivere questo allenamento o salvarlo come nuovo?</p>
                <div className="flex flex-col gap-3 mt-2">
                  <button 
                    onClick={() => performSave(false)}
                    className="w-full py-3 bg-brand text-black font-bold rounded-xl hover:brightness-110 transition"
                  >
                    Sovrascrivi esistente
                  </button>
                  <button 
                    onClick={() => setIsSavingAsNew(true)}
                    className="w-full py-3 bg-[#2a2a2a] border border-[#383838] text-white font-bold rounded-xl hover:border-brand hover:text-brand transition"
                  >
                    Salva come nuovo
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-gray-400 text-sm">Inserisci il nome per il nuovo allenamento:</p>
                <input 
                  autoFocus
                  className="bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-brand w-full mt-1 text-base"
                  value={newWorkoutName}
                  onChange={(e) => setNewWorkoutName(e.target.value)}
                  placeholder="Nome del workout..."
                />
                <div className="flex gap-3 mt-4">
                  <button 
                    onClick={() => setIsSavingAsNew(false)}
                    className="flex-1 py-3 bg-[#2a2a2a] text-white font-semibold rounded-xl hover:bg-[#333] transition text-sm"
                  >
                    Indietro
                  </button>
                  <button 
                    onClick={() => performSave(true)}
                    disabled={!newWorkoutName.trim() || saving}
                    className="flex-1 py-3 bg-brand text-black font-bold rounded-xl hover:brightness-110 transition disabled:opacity-50 text-sm"
                  >
                    {saving ? 'Salvataggio...' : 'Conferma'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* EXIT CONFIRM MODAL */}
      {showExitConfirm && createPortal(
        <div className="fixed inset-0 bg-black/85 z-[100] flex items-center justify-center p-4">
          <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-3xl w-full max-w-sm p-6 flex flex-col gap-4 text-center shadow-2xl animate-in fade-in zoom-in-[0.96] duration-300 ease-out">
            <div className="w-16 h-16 rounded-full bg-red-900/30 text-red-500 flex items-center justify-center mx-auto mb-2 shrink-0">
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
                onClick={() => {
                  localStorage.removeItem('fleofit_workout_draft')
                  navigate(pendingPath)
                }}
                className="flex-1 py-3 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-500 transition"
              >
                Sì, esci
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      
      {createPortal(
        <>
          <CustomAlert info={alertInfo} onClose={() => setAlertInfo(null)} />
          <CustomConfirm info={confirmInfo} onClose={() => {
            if (confirmInfo?.onCancel) confirmInfo.onCancel()
            else setConfirmInfo(null)
          }} />
        </>,
        document.body
      )}
    </div>
  )
}