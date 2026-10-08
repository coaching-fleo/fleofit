import { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useIndietro } from '../useIndietro'
import { Plus, Trash2, Save, X, ChevronRight, Timer, Dumbbell, ChevronUp, ChevronDown, AlertTriangle, BicepsFlexed, Copy, ChevronLeft, Wand2, Mic, Square, FileText, ArrowRight, Dices } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { CustomAlert, CustomConfirm } from '../components/CustomModals'
import { Capacitor } from '@capacitor/core'
import { VoiceRecorder } from '@independo/capacitor-voice-recorder'
import CustomDatePicker from '../components/CustomDatePicker'
import { useTouchDrag } from '../useTouchDrag'
import { blockHint } from '../lib/blockHints'
import { format, parseISO, isValid } from 'date-fns'
import { it } from 'date-fns/locale'
import { generaTitolo, titoliDelGiorno } from '../lib/workoutTitle'
import { codiceWorkout, separaCodice, unisciCodice } from '../lib/codiceWorkout'
import { candidatiNome, nuovoSeme, scegliNome, nomeLibero, eNomeGenerato, nomiGiaUsati } from '../lib/nomeCasuale'
import { ERGOMETERS } from '../lib/constants'
import { mostraErrore } from '../lib/alert'
import { battito, vibraPresa, vibraScelta, vibraSuccesso } from '../lib/aptica'
import { TYPE_COLORS } from '../lib/blockColors'
import { conVelo, coloreDaClasse, BRAND, RUNNING, CUSTOM, IA } from '../lib/colori'
import { BOLLA_MODALE, BOTTONE_BRAND, BOTTONE_PERICOLO, BOTTONE_QUIETO, CARD, CARTA_MODALE,
         LABEL, TESTO_MODALE, TITOLO_MODALE, TONO_BOLLA, VETRO } from '../lib/stiliCard'
import { durataBlocco, mmss, BLOCCHI_DI_LAVORO } from '../lib/stimaWorkout'
import { caricoPrevisto, collocazioneCarico } from '../lib/previsione'
import {
  TestataCrea, CardCategoria, RigaCampo, RiepilogoWorkout, SpinaBlocco, DurataBlocco,
  NumeroEsercizio, CardIA, BottoneGhost, BarraAzioni, CtaPrimaria, BottoneQuadrato,
  RigaUltimaVolta, RigaTesto,
} from '../components/CreaWorkoutUI'
import { chiudiTastieraSuInvio, useTastieraAperta } from '../useTastiera'
import { useBottomSheet } from '../useBottomSheet'
import AudioVisualizer from '../components/AudioVisualizer'
import { ThinkingOrb } from 'thinking-orbs'
import { BorderBeam } from 'border-beam'
import { scriviJson } from '../lib/offlineQueue'
import { FoglioMisure, FoglioParametri } from '../components/FoglioMisure'
import { SCALE, grandezza, testoMisura } from '../lib/scaleMisura'


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

// ─── COSTANTI RUNNING ─────────────────────────────────────────
const RUN_PACE_OPTIONS = [
  'Libero', 'Camminata', 'Z1', 'Z2', 'Z3', 'Z4', 'Z5', 'All out', 'Gara',
  ...Array.from({ length: 96 }, (_, i) => {
    const s = 120 + i * 5;
    return `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')} /km`;
  })
]

const ERGO_PACE_OPTIONS = [
  '-', 'Libero', 'Gara Singola', 'Gara Doppia', 'Z1', 'Z2', 'Z3', 'Z4', 'Z5', 'All out',
  ...Array.from({ length: 61 }, (_, i) => {
    const s = 90 + i * 5;
    return `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')} /500m`;
  }),
  ...Array.from({ length: 17 }, (_, i) => `${40 + i * 5} RPM`)
]

// ─── LE SCORCIATOIE DI RIPIEGO ────────────────────────────────────────────
// Sotto il righello il foglio misure mostra i valori che il coach ha usato
// davvero per QUELL'esercizio (lo storico, vedi `rapidiDi`). Queste servono
// solo quando lo storico non dice niente — un esercizio mai programmato, un
// parametro di blocco. Quattro e non cinque: è quante pillole stanno su una
// riga a 375px senza andare a capo.
// ⚠️ Niente pesi qui: i 6/9/14/20 kg erano i pesi della Wall Ball, proposti
// anche sullo Squat. Senza storico, sul peso non si propone niente.
const RAPIDI_REPS = ['10', '15', '20', '30']
const RAPIDI_METRI = ['100m', '250m', '500m', '1000m']
const RAPIDI_DURATA = ['1:00', '2:00', '3:00', '5:00']
const RAPIDI_REST = ['0:30', '1:00', '1:30', '2:00']
const RAPIDI_LAVORO = ['0:20', '0:30', '0:40', '1:00']
const RAPIDI_INTERVALLO = ['0:30', '1:00', '1:30', '2:00']
const RAPIDI_AMRAP = ['8:00', '10:00', '12:00', '20:00']
const RAPIDI_ROUNDS = ['3', '5', '8', '10']

// ─── IL PASSO CHE NON È UNA SCALA ─────────────────────────────────────────
// «Z3», «All out», «Gara Singola» non stanno su un righello: sono poche voci da
// vedere tutte insieme, e il foglio misure le mostra come pillole. I ritmi e
// le cadenze invece sì, e quelli vivono in src/lib/scaleMisura.js.
//
// ⚠️ Derivate dalle costanti con un `filter`, non ricopiate: i valori ammessi
// restano quelli delle liste, e sono le stringhe che la web app sa leggere.
const SENSAZIONI_ERGO = ERGO_PACE_OPTIONS
  .filter(v => v !== '-' && !v.includes('/500m') && !v.endsWith('RPM'))
  .map(v => ({ valore: v, etichetta: v }))
const SENSAZIONI_CORSA = RUN_PACE_OPTIONS
  .filter(v => !v.includes('/km'))
  .map(v => ({ valore: v, etichetta: v }))

/**
 * Il modo del passo di un esercizio già scritto: ritmo, cadenza, velocità o
 * «a sensazione» (che per la corsa si chiama zona). Senza passo, ritmo.
 */
const modoDelPasso = (ex) => {
  if (ex?.speed && ex.speed !== '-') return 'velocita'
  const v = ex?.ergoPace
  if (!v || v === '-') return 'ritmo'
  if (v.includes('/km') || v.includes('/500m')) return 'ritmo'
  if (v.endsWith('RPM')) return 'cadenza'
  return ex?.name === 'Run' ? 'zona' : 'sensazione'
}

/** «Senza peso» ha avuto due nomi nel tempo: "-" e "Nessun peso". */
const senzaPeso = (kg) => !kg || kg === '-' || kg === 'Nessun peso'

/** I campi di un esercizio di cui si contano i valori per le scorciatoie. */
const CAMPI_RAPIDI = ['reps', 'meters', 'kg', 'exTime', 'ergoPace', 'speed']

/**
 * Un valore dello storico nella forma del foglio misure, o `null` se non è
 * una misura. Il peso è salvato nudo ("9", "2x24") e il foglio lo tiene con
 * l'unità ("9 kg"), come lo teneva lo Stepper.
 */
const valoreRapido = (campoEx, v) => {
  const s = String(v ?? '').trim()
  if (!s || s === '-' || s === 'Max' || s === 'Nessun peso' || s === 'Libero') return null
  if (campoEx === 'kg') return /kg$/i.test(s) ? s : `${s} kg`
  return s
}

const RAPIDI_METRI_CORTI = ['20m', '50m', '100m', '200m']

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

function BlockPickerModal({ onAdd, onClose }) {
    const blockTypes = ['WarmUp', 'Cash In', 'ON/OFF', 'EMOM', 'AMRAP', 'For Time', 'Interval', 'Rest', 'Cash Out']

  return createPortal(
    <div className="fixed inset-0 bg-black/85 z-[60] flex items-center justify-center p-4 velo-in">
      <div className={`${CARD} w-full max-w-sm p-5 modal-transition`}>
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

/**
 * L'orb dell'attesa, uno per ognuno dei DUE lavori che la generazione può
 * fare — e sono due davvero: partendo dalla voce Gemini deve prima ascoltare
 * la registrazione, partendo dal testo legge e basta. La riga sotto l'orb già
 * lo distingue a parole; la figura lo distingue da lontano, che è tutto quello
 * che si guarda mentre si aspetta.
 *
 * ⚠️ `stato` ed `etichetta` stanno nella STESSA riga di proposito: sono due
 * modi di dire la stessa cosa, e tenerli in due tabelle è il modo in cui
 * l'orb finisce a comporre mentre l'etichetta dice che sta ascoltando.
 */
const ORB_ATTESA = {
  voce: { stato: 'listening', etichetta: 'Ascolto la registrazione' },
  testo: { stato: 'composing', etichetta: 'Scrivo i blocchi' },
}

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
    // Il microfono che si accende è una PRESA, non un gradino: si detta spesso
    // col telefono lontano dagli occhi, e questo è l'unico modo di saperlo partito.
    vibraPresa()
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
  const orbAttesa = ORB_ATTESA[attesaDaVoce ? 'voce' : 'testo']

  return createPortal(
    // ⚠️ `touch-action: none` sta sul velo e non sul foglio: impedisce che il
    // dito, muovendosi sullo sfondo, faccia scorrere la pagina sotto.
    // ⚠️ Durante la generazione il velo NON chiude: chiudere qui butterebbe
    // via una registrazione già spedita, senza dire niente a nessuno.
    <div className={`fixed inset-0 z-[60] flex flex-col justify-end bg-black/85 touch-none ${classeVelo}`}
      style={stileVelo} onClick={loading ? undefined : chiudi}>
      {/* ⚠️ `classeFoglio` e `stileFoglio` sono saliti SUL FASCIO, non sono
          rimasti sul foglio: sono l'entrata e il trascinamento della maniglia,
          e lasciandoli sotto il fascio sarebbe rimasto fermo mentre il foglio
          scende sotto il dito — una cornice luminosa sospesa nel vuoto.
          ⚠️ `useBottomSheet` non tiene ref sul nodo, passa solo classe e stile:
          è la ragione per cui questo spostamento è sicuro. */}
      <BorderBeam size="pulse-outside" colorVariant="ocean" theme="dark" strength={1} staticColors
        className={classeFoglio} style={stileFoglio} onClick={(e) => e.stopPropagation()}>
      <div role="dialog" aria-label="Genera con IA"
        className="bg-[#141416] border-t border-ia/20 rounded-t-3xl px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]
                   flex flex-col max-h-[88dvh] overflow-y-auto overscroll-contain
                   shadow-[0_-20px_50px_-12px_rgba(0,0,0,.85)]">

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
            {/* 🔴 `theme` è PINNATO a `dark`, non lasciato su `auto`. Con `auto`
                la libreria cerca un `data-theme`/`.dark` sugli antenati — che
                qui non esiste, l'app è scura e basta — e ricade su
                `prefers-color-scheme` DEL TELEFONO: su un iPhone in modalità
                chiara disegnerebbe inchiostro scuro su #1e1e1e, cioè niente.
                ⚠️ `aria-hidden` perché il paragrafo qui sotto ha già
                `role="status"` e dice la stessa cosa. L'etichetta si passa lo
                stesso: senza, il canvas se ne mette una INGLESE di sua
                iniziativa («Composing…») sopra una riga italiana. */}
            <ThinkingOrb state={orbAttesa.stato} size={64} theme="dark"
              aria-hidden="true" aria-label={orbAttesa.etichetta} />
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
                  <span className="text-[12px] font-extrabold text-gray-300 ml-auto">
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
      </BorderBeam>
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

  // Quale scheda del foglio misure è aperta. Se non c'è più (l'esercizio ibrido
  // è passato da ripetizioni a distanza) si torna alla prima.
  const [attiva, setAttiva] = useState(null)
  // Che tipo di passo si sta scrivendo. Si legge dal valore quando c'è; finché
  // il valore è "-" ricorda la pillola toccata — senza, scegliere «Cadenza» su
  // un passo vuoto non cambierebbe niente a schermo.
  const [modoPasso, setModoPasso] = useState(() => modoDelPasso(initialExercise))

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
  const [frequenti, setFrequenti] = useState({})
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
        const conteggi = {}
        for (const w of data) {
          for (const b of (w?.sections?.blocks || [])) {
            for (const ex of (b?.exercises || [])) {
              if (!ex?.name) continue
              if (!mappa[ex.name]) mappa[ex.name] = ex
              // Quante volte ogni valore è stato programmato: le scorciatoie
              // sotto il righello sono i valori che il coach USA per quel
              // movimento, non una lista uguale per tutti — i 6, 9 e 14 kg
              // della Wall Ball proposti anche sullo Squat erano il difetto.
              const c = (conteggi[ex.name] ||= {})
              for (const campoEx of CAMPI_RAPIDI) {
                const v = valoreRapido(campoEx, ex[campoEx])
                if (!v) continue
                const perCampo = (c[campoEx] ||= {})
                perCampo[v] = (perCampo[v] || 0) + 1
              }
            }
          }
        }
        setUltimi(mappa)
        setFrequenti(conteggi)
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
    // I modi seguono i valori, o il foglio mostrerebbe la scheda sbagliata:
    // un ibrido riusato «a distanza» resterebbe sulle ripetizioni vuote.
    if (ultimaVolta.meters && ultimaVolta.meters !== '-') setHybridMode('distance')
    else if (ultimaVolta.reps && ultimaVolta.reps !== '-') setHybridMode('reps')
    setRunPaceMode(ultimaVolta.speed && ultimaVolta.speed !== '-' ? 'speed' : 'pace')
    setModoPasso(modoDelPasso(ultimaVolta))
  }

  /** Le scorciatoie di un campo: i valori più usati per questo esercizio, o un ripiego. */
  const rapidiDi = (campoEx, ripiego = []) => {
    const conteggio = frequenti[selected]?.[campoEx]
    if (!conteggio) return ripiego
    return Object.entries(conteggio)
      .sort((x, y) => y[1] - x[1])
      .slice(0, 4)
      .map(([v]) => v)
      .sort((x, y) => (grandezza(x) ?? 0) - (grandezza(y) ?? 0))
  }

  // ── Le schede del foglio misure, una per campo ──────────────────────────
  // Ogni funzione descrive UNA scheda: quale scala, quali scorciatoie, quali
  // pillole. Quali schede ha un esercizio lo decide `misure` più sotto, con
  // le stesse regole del builder di prima (ergometro, slitta, ibrido…).
  const pillolaMax = (valore, set) =>
    ({ id: 'max', titolo: 'Max', attiva: valore === 'Max', onClick: () => set(valore === 'Max' ? '-' : 'Max') })

  // Un esercizio ibrido (Burpees Broad Jumps, affondi…) si misura a
  // ripetizioni O a distanza: due pillole sopra il numero, al posto del
  // segmento con le emoji. Cambiare modo svuota l'altro campo, come prima.
  const modiIbrido = () => isHybrid(selected) ? [
    { id: 'reps', titolo: 'Ripetizioni', attiva: hybridMode === 'reps', onClick: () => { setHybridMode('reps'); setMeters('-') } },
    { id: 'distanza', titolo: 'Distanza', attiva: hybridMode === 'distance', onClick: () => { setHybridMode('distance'); setReps('-') } },
  ] : []

  const vistaRipetizioni = () => ({
    chiave: 'reps', etichetta: 'Ripetizioni', scala: 'ripetizioni', valore: reps, onChange: setReps,
    rapidi: rapidiDi('reps', RAPIDI_REPS), pillole: [...modiIbrido(), pillolaMax(reps, setReps)],
  })

  const vistaMetri = (ripiego) => ({
    chiave: 'meters', etichetta: 'Distanza', scala: 'metri', valore: meters, onChange: setMeters,
    rapidi: rapidiDi('meters', ripiego), pillole: [...modiIbrido(), pillolaMax(meters, setMeters)],
  })

  const vistaPeso = () => {
    const doppio = /^2x/i.test(kg)
    const senza = senzaPeso(kg)
    const numero = parseFloat(String(kg).replace(/^2x/i, ''))
    return {
      chiave: 'kg', etichetta: 'Peso', valore: senza ? '-' : kg, onChange: setKg,
      scala: doppio ? 'pesoDoppio' : 'peso',
      rapidi: rapidiDi('kg').filter(v => /^2x/i.test(v) === doppio),
      // «Due pesi» è il «2x24 kg» di prima: due manubri o due kettlebell
      // uguali. Passando da uno a due si tiene il numero, quando ha senso.
      pillole: [
        { id: 'uno', titolo: 'Un peso', attiva: !senza && !doppio,
          onClick: () => setKg(doppio && Number.isFinite(numero) ? `${numero} kg` : SCALE.peso.partenza) },
        { id: 'due', titolo: 'Due pesi', attiva: doppio,
          onClick: () => setKg(!senza && Number.isInteger(numero) && numero <= 50 ? `2x${numero} kg` : SCALE.pesoDoppio.partenza) },
        { id: 'senza', titolo: 'Senza peso', attiva: senza, onClick: () => setKg('-') },
      ],
    }
  }

  const vistaDurata = () => ({
    chiave: 'exTime', etichetta: 'Durata', scala: 'tempo', valore: exTime, onChange: setExTime,
    rapidi: rapidiDi('exTime', RAPIDI_DURATA),
  })

  // Il Rest tiene la sua durata in `meters` (vedi la nota su `durataEsercizio`
  // in src/lib/stimaWorkout.js): la scheda si chiama Durata ma scrive lì.
  const vistaRecupero = () => ({
    chiave: 'meters', etichetta: 'Durata', scala: 'recupero', valore: meters, onChange: setMeters,
    rapidi: rapidiDi('meters', RAPIDI_REST),
  })

  /** Le pillole dei modi del passo. Cambiare modo svuota il valore: un «Z3» non è un ritmo. */
  const pillolaModo = (id, titolo, svuota) => ({
    id, titolo, attiva: modoPasso === id,
    onClick: () => { if (modoPasso !== id) { setModoPasso(id); svuota() } },
  })
  const pillolaTogli = (valore, set) => (valore && valore !== '-')
    ? [{ id: 'togli', titolo: 'Nessuno', attiva: false, onClick: () => set('-') }] : []

  const vistaPassoErgo = () => {
    const base = {
      chiave: 'ergoPace', etichetta: 'Passo', valore: ergoPace, onChange: setErgoPace,
      pillole: [
        pillolaModo('ritmo', 'Ritmo', () => setErgoPace('-')),
        pillolaModo('cadenza', 'Cadenza', () => setErgoPace('-')),
        pillolaModo('sensazione', 'Sensazione', () => setErgoPace('-')),
        ...pillolaTogli(ergoPace, setErgoPace),
      ],
    }
    if (modoPasso === 'cadenza') return { ...base, scala: 'cadenza', rapidi: rapidiDi('ergoPace').filter(v => /RPM$/.test(v)) }
    if (modoPasso === 'sensazione') return { ...base, scelte: SENSAZIONI_ERGO }
    return { ...base, scala: 'passoErgo', rapidi: rapidiDi('ergoPace').filter(v => v.includes('/500m')) }
  }

  // La corsa dentro un workout Hyrox: ritmo, zona o velocità. La velocità
  // scrive in `speed` e non in `ergoPace` — è il «Passo | Velocità» di prima.
  const vistaPassoCorsa = () => {
    const aPasso = () => { setRunPaceMode('pace'); setSpeed('-'); setErgoPace('-') }
    const pillole = [
      pillolaModo('ritmo', 'Ritmo', aPasso),
      pillolaModo('zona', 'Zona', aPasso),
      pillolaModo('velocita', 'Velocità', () => { setRunPaceMode('speed'); setErgoPace('-') }),
    ]
    if (modoPasso === 'velocita') {
      return { chiave: 'speed', etichetta: 'Velocità', scala: 'velocita', valore: speed, onChange: setSpeed,
        rapidi: rapidiDi('speed'), pillole: [...pillole, ...pillolaTogli(speed, setSpeed)] }
    }
    const base = { chiave: 'ergoPace', etichetta: 'Passo', valore: ergoPace, onChange: setErgoPace,
      pillole: [...pillole, ...pillolaTogli(ergoPace, setErgoPace)] }
    if (modoPasso === 'zona') return { ...base, scelte: SENSAZIONI_CORSA }
    return { ...base, scala: 'passoCorsa', rapidi: rapidiDi('ergoPace').filter(v => v.includes('/km')) }
  }

  // Le stesse regole del builder di prima, ramo per ramo: cambia il gesto,
  // non quali campi ha un esercizio né dove finiscono.
  const misure = !selected ? [] : workoutType === 'Interval'
    ? [vistaDurata(), isErgo(selected) ? vistaPassoErgo() : selected === 'Run' ? vistaPassoCorsa() : vistaPeso()]
    : isErgo(selected) ? [vistaMetri(RAPIDI_METRI), vistaPassoErgo()]
    : selected === 'Run' ? [vistaMetri(RAPIDI_METRI), vistaPassoCorsa()]
    : selected === 'Rest' ? [vistaRecupero()]
    : isHybrid(selected) ? [hybridMode === 'distance' ? vistaMetri(RAPIDI_METRI_CORTI) : vistaRipetizioni(), vistaPeso()]
    : (isSled(selected) || isCarry(selected)) ? [vistaMetri(RAPIDI_METRI_CORTI), vistaPeso()]
    : isDistance(selected) ? [vistaMetri(RAPIDI_METRI), vistaPeso()]
    : [vistaRipetizioni(), vistaPeso()]
  const schedaAttiva = misure.some(m => m.chiave === attiva) ? attiva : misure[0]?.chiave

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

  const handleSelect = (name) => { setSelected(name); setAttiva(null) }

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
  // ⚠️ `sheet-in` e non `modal-transition`: questa non è una carta centrata,
  // è una schermata intera che copre il builder — sale dal basso come i bottom
  // sheet. E anche qui l'entrata di prima (`animate-in slide-in-from-bottom-4`)
  // generava zero CSS.
  return createPortal(
    <div className="fixed inset-0 z-[60] bg-[#0B0B0B] flex flex-col sheet-in">
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
              {testoUltimaVolta && (
                <RigaUltimaVolta testo={testoUltimaVolta} onRiusa={riusaUltimaVolta} />
              )}

              <FoglioMisure misure={misure} attiva={schedaAttiva} onAttiva={setAttiva} />

              {selected !== 'Rest' && (
                <div className={`${CARD} px-4 py-[15px] flex flex-col gap-3`}>
                  <div className="flex items-center justify-between">
                    <span className={LABEL}>Intensità</span>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-sm font-extrabold ${getIntensityColor(intensity)}`}>{intensity}/10</span>
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
        <p className="mt-0.5 text-[11.5px] font-semibold tracking-[.02em] text-muted truncate">
          {[dettaglio, ex.notes].filter(Boolean).join(' · ') || '—'}
        </p>
      </div>

      {ex.intensity && (
        <span className={`shrink-0 text-xs font-extrabold ${getIntensityColor(ex.intensity)}`}
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
/**
 * I numeri di un blocco: quali sono, con che scala e che ripiego.
 *
 * ⚠️ I ripieghi sono quelli di BlockPickerModal e di `giriBlocco` in
 * src/lib/stimaWorkout.js: un blocco mai toccato deve mostrare in pillola
 * esattamente il numero su cui la durata è stimata.
 * ⚠️ Il rest dei Cash In/Out esiste solo FRA i round: con un round solo non
 * c'è, invece di restare lì a dire «1:00» di una pausa che non avverrà.
 */
const parametriDelBlocco = (block) => {
  const round = (ripiego) => ({ chiave: 'rounds', etichetta: 'Round', scala: 'round', rapidi: RAPIDI_ROUNDS, ripiego })
  switch (block.type) {
    case 'WarmUp':
    case 'Rest':
      return [{ chiave: 'duration', etichetta: 'Durata', scala: 'tempo', rapidi: RAPIDI_DURATA, ripiego: '3:00' }]
    case 'ON/OFF':
      return [
        { chiave: 'on', etichetta: 'ON', scala: 'tempo', rapidi: RAPIDI_LAVORO, ripiego: '1:00' },
        { chiave: 'off', etichetta: 'OFF', scala: 'tempo', rapidi: RAPIDI_LAVORO, ripiego: '1:00' },
        round('10'),
      ]
    case 'EMOM':
      return [{ chiave: 'interval', etichetta: 'Ogni', scala: 'tempo', rapidi: RAPIDI_INTERVALLO, ripiego: '1:00' }, round('10')]
    case 'AMRAP':
      return [{ chiave: 'duration', etichetta: 'Durata', scala: 'tempo', rapidi: RAPIDI_AMRAP, ripiego: '10:00' }]
    case 'For Time':
      return [round('3')]
    case 'Interval':
      return [round('1')]
    case 'Cash In':
    case 'Cash Out':
      return parseInt(block.params?.rounds, 10) > 1
        ? [round('1'), { chiave: 'rest', etichetta: 'Rest', scala: 'recupero', rapidi: RAPIDI_REST, ripiego: '1:00' }]
        : [round('1')]
    default:
      return []
  }
}

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

  // Quale parametro ha il foglio aperto, o `null`. I numeri del blocco non
  // stanno più nella card: lì c'è il loro riepilogo in pillole, e il righello
  // sale dal basso solo quando si tocca. Erano due Stepper da 170px sempre
  // aperti sopra gli esercizi, cioè sopra la cosa che si è venuti a comporre.
  const [foglio, setFoglio] = useState(null)

  const parametri = parametriDelBlocco(block).map(p => ({
    chiave: p.chiave, etichetta: p.etichetta, scala: p.scala, rapidi: p.rapidi,
    valore: block.params?.[p.chiave] ?? p.ripiego,
    onChange: (v) => updateParam(p.chiave, v),
  }))

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

  // ⚠️ `scroll-mt-…` sulla radice porta la safe area, e non è decorazione:
  // `scrollIntoView({ block: 'start' })` allinea il blocco al bordo della
  // viewport, che su un iPhone col notch sta SOTTO la barra di stato — il
  // titolo arriverebbe in cima e mezzo coperto proprio mentre lo si apre.
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
      className={`drag-item scroll-mt-[calc(env(safe-area-inset-top)+0.75rem)] relative overflow-hidden rounded-[20px] border cursor-move transition-all duration-200
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

        <p className="mt-[3px] text-[11.5px] font-bold tracking-[.03em] text-muted truncate">
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
          {parametri.length > 0 && (
            <div className="flex gap-2">
              {parametri.map(p => (
                <button key={p.chiave} type="button" onClick={() => setFoglio(p.chiave)}
                  aria-label={`${p.etichetta}: ${testoMisura(p)}`}
                  className={`flex-1 min-w-0 rounded-2xl px-3.5 py-2.5 text-left ${VETRO}
                              hover:border-white/25 transition active:scale-[.98]`}>
                  <span className={`${LABEL} block truncate`}>{p.etichetta}</span>
                  <span className="block mt-[3px] text-[17px] font-extrabold tracking-[-.01em] text-white tabular-nums truncate">
                    {testoMisura(p)}
                  </span>
                </button>
              ))}
            </div>
          )}

          {['WarmUp', 'Rest'].includes(block.type) && (
            <RigaTesto
              icona={FileText}
              etichetta="Note del blocco"
              placeholder="Note (opzionale)…"
              valore={block.notes || ''}
              onChange={updateNotes}
            />
          )}

          {foglio && (
            <FoglioParametri
              titolo={block.type}
              sottotitolo={`Il blocco dura ${durataBlocco(block) > 0 ? mmss(durataBlocco(block)) : '—'}`}
              misure={parametri}
              attiva={foglio}
              onAttiva={setFoglio}
              onChiudi={() => setFoglio(null)}
            />
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

const TIPI_FASE = [
  { id: 'warmup', nome: 'Riscaldamento' },
  { id: 'run', nome: 'Corsa' },
  { id: 'recover', nome: 'Recupero' },
  { id: 'cooldown', nome: 'Defaticamento' },
  { id: 'repeat', nome: 'Ripetute' },
]

/** Una durata di corsa è un tempo («10 min», «30 sec») o una distanza («400m», «5 km»)? */
const eTempoCorsa = (v) => /\b(min|sec)$/.test(String(v ?? ''))

/** «3:50 /km» è un ritmo; «Z2», «Libero», «Camminata» sono una zona. */
const eRitmoCorsa = (v) => String(v ?? '').includes('/km')

/**
 * Le schede «quanto» e «passo» di un tratto di corsa, per il foglio misure.
 *
 * Un tratto ha quattro valori — quanto (tempo O distanza), passo da, passo a —
 * e prima erano TRE rotelle verticali strette affiancate più un segmento con
 * le emoji, ripetute due volte per le ripetute: sei rotelle in una finestra.
 *
 * ⚠️ Il formato salvato NON cambia: «10 min», «400m», «1.5 km», e il passo come
 * prima — `paceMin` e `paceMax` separati, più `pace` già composto da
 * `formatPace` («3:50 - 4:00 /km»), che è quello che la scheda e la web app
 * leggono (src/lib/rigaBlocco.js, RunningStepRow).
 */
function tratto({ prefisso = '', etichettaQuanto, quanto, setQuanto, passo, setPasso, passoMax, setPassoMax }) {
  const aTempo = eTempoCorsa(quanto)
  const ritmo = eRitmoCorsa(passo)
  return [
    {
      chiave: `${prefisso}quanto`, etichetta: etichettaQuanto || (aTempo ? 'Durata' : 'Distanza'),
      scala: aTempo ? 'durataCorsa' : 'distanzaCorsa',
      valore: quanto, onChange: setQuanto,
      rapidi: aTempo ? ['5 min', '10 min', '20 min', '30 min'] : ['200m', '400m', '1 km', '5 km'],
      // Tempo o distanza: due pillole al posto del segmento con le emoji.
      // Cambiando modo si parte dal valore tipico di quel modo, perché «10 min»
      // non ha un corrispondente in metri.
      pillole: [
        { id: 'tempo', titolo: 'Tempo', attiva: aTempo, onClick: () => setQuanto(SCALE.durataCorsa.partenza) },
        { id: 'distanza', titolo: 'Distanza', attiva: !aTempo, onClick: () => setQuanto(SCALE.distanzaCorsa.partenza) },
      ],
    },
    {
      chiave: `${prefisso}passo`, etichetta: 'Passo',
      valore: passo, onChange: setPasso,
      ...(ritmo
        ? {
            scala: 'passoCorsa',
            rapidi: ['4:30 /km', '5:00 /km', '5:30 /km', '6:00 /km'],
            // Il secondo estremo è facoltativo: «3:50 – 4:00».
            secondo: { valore: passoMax, onChange: setPassoMax, etichetta: 'Passo fino a' },
          }
        : { scelte: SENSAZIONI_CORSA }),
      pillole: [
        { id: 'ritmo', titolo: 'Ritmo', attiva: ritmo, onClick: () => setPasso(SCALE.passoCorsa.partenza) },
        // Una zona non ha un secondo estremo: tornando alle zone si toglie.
        { id: 'zona', titolo: 'Zona', attiva: !ritmo, onClick: () => { setPasso('Libero'); setPassoMax('-') } },
      ],
    },
  ]
}

/** L'intensità di un tratto, nella stessa card del builder Hyrox ma azzurra. */
function IntensitaCorsa({ valore, onChange }) {
  return (
    <div className={`${CARD} px-4 py-[15px] flex flex-col gap-3`}>
      <div className="flex items-center justify-between">
        <span className={LABEL}>Intensità</span>
        <div className="flex items-center gap-1.5">
          <span className={`text-sm font-extrabold ${getIntensityColor(valore)}`}>{valore}/10</span>
          <BicepsFlexed size={17} className={getIntensityColor(valore)} />
        </div>
      </div>
      <IntensityPicker value={valore} onChange={onChange} activeColor="bg-running" />
    </div>
  )
}

/**
 * Una fase di corsa: schermata intera come la scelta dell'esercizio, non più
 * una finestrella con sei rotelle. Stessa testata, stesso foglio misure,
 * stessa conferma fissa in basso — in azzurro, il colore della corsa.
 */
function RunningStepPicker({ onAdd, onClose, initialStep }) {
  const parseMin = (p) => p ? (p.includes(' - ') ? p.split(' - ')[0] + (p.includes('/km') ? ' /km' : '') : p) : 'Libero'
  const parseMax = (p) => p ? (p.includes(' - ') ? p.split(' - ')[1] : '-') : '-'

  const [type, setType] = useState(initialStep?.type || 'run')
  const [duration, setDuration] = useState(initialStep?.duration || '10 min')
  const [pace, setPace] = useState(initialStep?.paceMin || parseMin(initialStep?.pace))
  const [paceMax, setPaceMax] = useState(initialStep?.paceMax || parseMax(initialStep?.pace))
  const [intensity, setIntensity] = useState(initialStep?.intensity || '5')
  const [notes, setNotes] = useState(initialStep?.notes || '')
  const [rounds, setRounds] = useState(initialStep?.rounds || '8')
  const [runDuration, setRunDuration] = useState(initialStep?.runDuration || '1 min')
  const [runPace, setRunPace] = useState(initialStep?.runPaceMin || parseMin(initialStep?.runPace))
  const [runPaceMax, setRunPaceMax] = useState(initialStep?.runPaceMax || parseMax(initialStep?.runPace))
  const [runIntensity, setRunIntensity] = useState(initialStep?.runIntensity || '8')
  const [recDuration, setRecDuration] = useState(initialStep?.recDuration || '1 min')
  const [recPace, setRecPace] = useState(initialStep?.recPaceMin || parseMin(initialStep?.recPace))
  const [recPaceMax, setRecPaceMax] = useState(initialStep?.recPaceMax || parseMax(initialStep?.recPace))
  const [recIntensity, setRecIntensity] = useState(initialStep?.recIntensity || '3')

  // Le schede aperte: una per il tratto singolo, due per le ripetute (il
  // tratto veloce e il recupero hanno ciascuno il proprio foglio).
  const [attiva, setAttiva] = useState(initialStep?.type === 'repeat' ? 'volte' : 'quanto')
  const [attivaRec, setAttivaRec] = useState('rec-quanto')

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

  const misureSingola = tratto({
    quanto: duration, setQuanto: setDuration,
    passo: pace, setPasso: setPace, passoMax: paceMax, setPassoMax: setPaceMax,
  })

  // Le ripetute: «Volte» sta nel foglio del tratto veloce, perché è la prima
  // cosa che si dice di una seduta di ripetute («8 per 400»).
  const misureVeloce = [
    { chiave: 'volte', etichetta: 'Volte', scala: 'ripetute', valore: rounds, onChange: setRounds, rapidi: ['4', '6', '8', '10'] },
    ...tratto({
      quanto: runDuration, setQuanto: setRunDuration,
      passo: runPace, setPasso: setRunPace, passoMax: runPaceMax, setPassoMax: setRunPaceMax,
    }),
  ]
  const misureRecupero = tratto({
    prefisso: 'rec-',
    quanto: recDuration, setQuanto: setRecDuration,
    passo: recPace, setPasso: setRecPace, passoMax: recPaceMax, setPassoMax: setRecPaceMax,
  })

  return createPortal(
    <div role="dialog" aria-label={initialStep ? 'Modifica fase' : 'Nuova fase'}
      className="fixed inset-0 z-[60] bg-[#0B0B0B] flex flex-col sheet-in">
      <div className="shrink-0 flex items-center gap-2 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] border-b border-[#2a2a2a]">
        <p className="text-white font-bold text-lg flex-1 truncate">{initialStep ? 'Modifica fase' : 'Nuova fase'}</p>
        <button aria-label="Chiudi" onClick={onClose}
          className="w-11 h-11 -mr-2 flex items-center justify-center text-muted hover:text-white shrink-0">
          <X size={22} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
        {/* Che fase è: cinque voci da vedere tutte insieme. */}
        <div className="flex flex-wrap gap-2" role="group" aria-label="Tipo di fase">
          {TIPI_FASE.map(t => {
            const on = type === t.id
            return (
              <button key={t.id} type="button" aria-pressed={on}
                // Le ripetute si aprono su «Volte»: è la prima cosa che se ne dice («8 per 400»).
                onClick={() => { if (!on) { vibraScelta(); setAttiva(t.id === 'repeat' ? 'volte' : 'quanto') } setType(t.id) }}
                className={`min-h-10 px-4 rounded-full text-[13px] font-extrabold border transition active:scale-95 ${
                  on ? 'bg-running/15 border-running/45 text-running' : 'bg-white/[.055] border-white/10 text-[#c9ccd4] hover:border-white/20'
                }`}>
                {t.nome}
              </button>
            )
          })}
        </div>

        <div className="flex flex-col gap-4 passo-entra" key={type === 'repeat' ? 'ripetute' : 'singola'}>
          {type === 'repeat' ? (
            <>
              <p className={`${LABEL} text-running -mb-1`}>Tratto veloce</p>
              <FoglioMisure misure={misureVeloce} attiva={misureVeloce.some(m => m.chiave === attiva) ? attiva : 'volte'}
                onAttiva={setAttiva} accento="running" />
              <IntensitaCorsa valore={runIntensity} onChange={setRunIntensity} />

              <p className={`${LABEL} text-green-400 -mb-1 mt-2`}>Recupero</p>
              <FoglioMisure misure={misureRecupero} attiva={attivaRec} onAttiva={setAttivaRec} accento="running" />
              <IntensitaCorsa valore={recIntensity} onChange={setRecIntensity} />
            </>
          ) : (
            <>
              <FoglioMisure misure={misureSingola} attiva={misureSingola.some(m => m.chiave === attiva) ? attiva : 'quanto'}
                onAttiva={setAttiva} accento="running" />
              <IntensitaCorsa valore={intensity} onChange={setIntensity} />
            </>
          )}

          <RigaTesto
            icona={FileText}
            etichetta="Note della fase"
            placeholder={type === 'repeat' ? 'Es: recupero da fermo, ultima tirata a tutta…' : 'Es: corsa leggera, focus tecnica…'}
            valore={notes}
            onChange={setNotes}
          />
        </div>
      </div>

      {/* Piede fisso, come nella scelta dell'esercizio: la conferma resta
          raggiungibile qualunque sia la lunghezza delle ripetute. */}
      <div className="shrink-0 px-4 pt-3 pb-[calc(13px+env(safe-area-inset-bottom))] border-t border-white/[.07] bg-[#0B0B0B]/[.9] backdrop-blur-xl flex">
        <button type="button" onClick={handleAdd}
          className="flex-1 min-h-[52px] rounded-2xl bg-running text-white text-[16.5px] font-black tracking-[-.01em]
                     flex items-center justify-center gap-2.5 hover:brightness-110 active:scale-[.99] transition
                     shadow-[0_14px_26px_-10px_rgba(0,148,198,.55),inset_0_1px_0_rgba(255,255,255,.3)]">
          {initialStep ? <Save size={19} aria-hidden="true" /> : <Plus size={19} aria-hidden="true" />}
          {initialStep ? 'Salva modifiche' : 'Aggiungi fase'}
        </button>
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
          <span className={`text-sm font-extrabold ${getIntensityColor(valore)}`}>{valore}/10</span>
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

/**
 * L'uscita chiesta dal tasto indietro, che non è una rotta: `pendingPath` porta
 * altrimenti il percorso di un link intercettato. Sono due uscite diverse e la
 * conferma «Sì, esci» le serve entrambe.
 */
const INDIETRO = Symbol('indietro')

export default function CreateWorkout() {
  const [searchParams] = useSearchParams()
  // Aperto dalla tab bar il builder è una destinazione, non una pagina in cui
  // si è entrati: al passo 1 niente tasto indietro, come Calendario e Atleti.
  const daBarra = useLocation().state?.daBarra === true
  const editId = searchParams.get('edit')
  const duplicateId = searchParams.get('duplicate')
  const awId = searchParams.get('aw_id')
  const athleteId = searchParams.get('athlete_id')
  const sourceId = editId || duplicateId
  // Da dove viene la bozza: una modifica salva SOPRA l'originale, una copia no.
  const modoBozza = editId ? 'modifica' : duplicateId ? 'copia' : 'nuovo'
  // Il workout è arrivato (o non c'era niente da caricare): da qui in poi un
  // cambiamento è del coach, non del caricamento.
  const [caricato, setCaricato] = useState(!sourceId)
  const bozzaDiPartenza = useRef(null)
  const defaultDate = searchParams.get('date')

  const [step, setStep] = useState(1) // 1=tipo, 2=build
  // Serve al fondo pagina: con la tastiera aperta la tab bar non c'è, e lo
  // spazio che le era riservato terrebbe la barra sospesa sopra un vuoto.
  const tastieraAperta = useTastieraAperta()
  const [title, setTitle] = useState('')
  // Il nome che il workout prende se il campo resta vuoto: i candidati vengono
  // dal contenuto (`src/lib/nomeCasuale.js`), il seme sceglie quale, e il dado
  // cambia il seme. Riaperto in modifica resta quello già salvato
  // (`nomeFissato`) finché i blocchi lo giustificano, e al salvataggio non
  // conta come «già usato» da un altro workout (`nomeDiPartenza`).
  const [semeNome, setSemeNome] = useState(() => nuovoSeme())
  const [nomeFissato, setNomeFissato] = useState(null)
  const nomeDiPartenza = useRef(null)
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
  // Chi riceve il workout se lo si sovrascrive, e l'atleta da cui si è entrati in
  // modifica. Servono alla finestra di salvataggio per dire cosa cambia a CHI:
  // «Sovrascrivi» e «Salva come nuovo» hanno conseguenze opposte sugli atleti, e
  // il coach le deve leggere prima di scegliere, non scoprirle dopo.
  const [atletiAssegnati, setAtletiAssegnati] = useState(null)
  const [nomeAtletaModifica, setNomeAtletaModifica] = useState('')

  const navigate = useNavigate()
  const indietro = useIndietro('/')

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
    setOpenBlockId(prev => {
      if (prev === id) { bloccoDaMostrare.current = null; return null }
      // ⚠️ Aprire un blocco CHIUDE quello aperto prima. Se quello stava più in
      // ALTO nella lista, la pagina si accorcia sopra la testa del coach e il
      // blocco appena toccato scivola fuori schermo verso l'alto: a schermo non
      // sembra uno scorrimento, sembra che il blocco si sia aperto al contrario.
      // Segnalato dal committente il 15/09/2026. Si segna quale riportare sotto
      // gli occhi; a portarcelo è l'effetto su [blocks, openBlockId].
      bloccoDaMostrare.current = id
      return id
    })
    // ⚠️ La scrittura del ref sta dentro l'updater perché `openBlockId` non può
    // entrare nelle dipendenze: questo gestore deve restare un riferimento
    // stabile o `React.memo` su HyroxBlock smette di servire (§9-quinquies).
    // È idempotente, quindi il doppio invio di StrictMode non cambia nulla.
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
    // ⚠️ `openBlockId` è nelle dipendenze quanto `blocks`: aprire un blocco che
    // c'era già non tocca la lista, quindi con le sole `[blocks]` l'effetto non
    // scatterebbe mai e il titolo resterebbe fuori schermo. Chi compila i
    // parametri di un blocco già aperto non cambia nessuna delle due, e infatti
    // la pagina non si muove — c'è un test che lo pretende.
  }, [blocks, openBlockId])

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
      if (error || !data) { setCaricato(true); return }

      // Il codice in coda al titolo non sta nel campo: si rigenera al
      // salvataggio. Un nome generato non sta nel campo nemmeno lui: in
      // modifica resta quello, in una copia se ne sceglie un altro.
      const { nome } = separaCodice(data.title)
      const sezioni = data.sections || {}
      const candidati = candidatiNome({
        category: sezioni.category || (sezioni.steps ? 'Running' : 'Hyrox'),
        blocks: sezioni.blocks || [], steps: sezioni.steps || [],
      })
      if (eNomeGenerato(nome, candidati)) {
        setTitle('')
        if (!duplicateId) { setNomeFissato(nome); nomeDiPartenza.current = nome }
      } else {
        setTitle(duplicateId && nome ? `${nome} (Copia)` : nome)
      }
      setCoachNotes(data.coach_notes || '')
      
      let loadedDate = data.date
      if (awId && !duplicateId) {
        const { data: awData } = await supabase.from('athlete_workouts')
          .select('completed_date, athletes(name, surname)').eq('id', awId).single()
        if (awData) {
          loadedDate = awData.completed_date
          setNomeAtletaModifica(awData.athletes?.name || '')
        }
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
      setCaricato(true)
    }

    const draftStr = localStorage.getItem('fleofit_workout_draft')
    if (draftStr) {
      try {
        const draft = JSON.parse(draftStr)
        // ⚠️ Si confronta anche il MODO, non solo il workout di partenza. Una
        // bozza nata da «Duplica» e riproposta dentro «Modifica» dello stesso
        // workout caricava la copia — titolo «(Copia)» compreso — su una
        // schermata che salva SOPRA l'originale, cioè sopra il workout di
        // tutti gli atleti a cui era assegnato. Una bozza senza modo è di
        // prima della correzione: non si sa da dove viene, e si scarta.
        if ((draft.sourceId || null) === (sourceId || null) && draft.modo === modoBozza) {
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
              if (draft.title || draft.blocks?.length || draft.runningSteps?.length) setStep(2)
              // La bozza ripristinata È già una modifica: non diventa il punto
              // di riferimento, o la si cancellerebbe al primo render.
              bozzaDiPartenza.current = ''
              setCaricato(true)
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
  //
  // ⚠️ La bozza si scrive solo quando il coach ha CAMBIATO qualcosa rispetto a
  // ciò che ha aperto. Prima si scriveva appena il workout era caricato, quindi
  // aprire «Duplica» o «Modifica» e richiudere l'app lasciava una bozza di un
  // lavoro che non esisteva — e la si ritrovava proposta la volta dopo.
  // Il riferimento è il primo stato completo dopo il caricamento.
  useEffect(() => {
    if (!caricato || saved) return
    const corpo = { title, date, workoutIntensity, category, blocks, runningSteps, coachNotes }
    const firma = JSON.stringify(corpo)
    if (bozzaDiPartenza.current === null) { bozzaDiPartenza.current = firma; return }
    if (firma === bozzaDiPartenza.current) {
      // Tornato com'era aperto: non c'è più niente da ripristinare.
      if (sourceId) localStorage.removeItem('fleofit_workout_draft')
      return
    }
    if (hasUnsavedChanges) {
      scriviJson('fleofit_workout_draft', { sourceId: sourceId || null, modo: modoBozza, ...corpo })
    }
  }, [title, date, workoutIntensity, category, blocks, runningSteps, coachNotes, sourceId, modoBozza, hasUnsavedChanges, saved, caricato])

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
    //
    // 🔴 Si annulla SOLO un vero «tirare giù»: più verticale che orizzontale, e
    // non dentro qualcosa che può ancora scorrere verso l'alto. Prima bastava
    // che il dito scendesse di mezzo pixel: con un foglio aperto la pagina è
    // bloccata (`position: fixed`, quindi `scrollY` vale sempre 0), e ogni
    // trascinamento orizzontale del righello veniva annullato — il righello non
    // si muoveva. Trovato sull'emulatore il 07/10/2026; jsdom non lo vede.
    let touchStartX = 0
    let touchStartY = 0
    const puoScorrereSu = (el) => {
      for (let n = el; n && n !== document.body; n = n.parentElement) {
        if (n.scrollTop > 0 && n.scrollHeight > n.clientHeight) return true
      }
      return false
    }
    const handleTouchStart = (e) => {
      if (e.touches && e.touches.length > 0) {
        touchStartX = e.touches[0].clientX
        touchStartY = e.touches[0].clientY
      }
    }
    const handleTouchMove = (e) => {
      if (!hasUnsavedChanges || saved || window.scrollY > 0) return
      if (!e.touches || e.touches.length === 0) return
      const giu = e.touches[0].clientY - touchStartY
      const lato = Math.abs(e.touches[0].clientX - touchStartX)
      if (giu <= 0 || lato >= giu) return          // non è un tirare giù
      if (puoScorrereSu(e.target)) return          // lo consuma una lista interna
      e.preventDefault() // Annulla il ricaricamento manuale
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
      // Con dei blocchi (o delle fasi) già composti la freccia chiede
      // conferma: si legge come «butto via tutto», anche se lo stato resta.
      // Il tocco sul titolo invece torna al passo 1 senza chiedere: è il
      // gesto deliberato di chi vuole cambiare nome o data.
      const composti = category === 'Running' ? runningSteps.length : category === 'Hyrox' ? blocks.length : 0
      if (composti > 0) {
        setConfirmInfo({
          title: 'Sei sicuro?',
          message: 'Torni alla scelta di nome, data e categoria. I blocchi restano, ma se cambi categoria non verranno salvati.',
          onConfirm: () => setStep(1),
        })
      } else {
        setStep(1)
      }
    } else {
      if (hasUnsavedChanges && !saved) {
        setPendingPath(INDIETRO)
        setShowExitConfirm(true)
      } else {
        localStorage.removeItem('fleofit_workout_draft')
        indietro()
      }
    }
  }

  // Il nome è facoltativo per tutte le categorie: Hyrox e Corsa ne prendono
  // uno dal contenuto (`src/lib/nomeCasuale.js`), Custom la data. Il codice segue
  // SEMPRE il nome, ricalcolato a ogni blocco toccato, così il coach vede il
  // titolo che verrà salvato mentre lo costruisce.
  const codice = useMemo(
    () => codiceWorkout({ category, blocks, steps: runningSteps, intensity: workoutIntensity }),
    [category, blocks, runningSteps, workoutIntensity])
  const conNomeCasuale = category === 'Hyrox' || category === 'Running'
  const candidati = useMemo(
    () => candidatiNome({ category, blocks, steps: runningSteps }),
    [category, blocks, runningSteps])
  const nomeCasuale = nomeFissato && eNomeGenerato(nomeFissato, candidati)
    ? nomeFissato
    : scegliNome(candidati, semeNome)
  const nomeAutomatico = conNomeCasuale ? nomeCasuale : generaTitolo(date)
  const nomeMostrato = title.trim() || nomeAutomatico || generaTitolo(date)

  // I tre numeri in cima allo step 2 e i segmenti della barra. Un useMemo e non
  // uno stato aggiornato da un effetto: sono una funzione dei blocchi, e uno
  // stato derivato può restare indietro di un render (CLAUDE.md §9-septies).
  const riepilogo = useMemo(() => caricoPrevisto(blocks), [blocks])

  // Dove sta questa seduta rispetto a quelle che il coach scrive di solito.
  // ⚠️ Il termine di paragone si legge UNA volta all'apertura della pagina, e
  // se la lettura fallisce la riga semplicemente non compare: un confronto è
  // un di più, e non deve poter togliere il riepilogo a chi sta lavorando.
  const [sedutePassate, setSedutePassate] = useState([])
  useEffect(() => {
    let vivo = true
    supabase.from('workouts').select('sections').order('date', { ascending: false })
      .limit(STORICO_WORKOUT)
      .then(({ data, error }) => {
        if (!vivo || error || !Array.isArray(data)) {
          if (error) console.error('Storico carichi non disponibile:', error)
          return
        }
        setSedutePassate(data)
      })
    return () => { vivo = false }
  }, [])

  const collocazione = useMemo(
    () => collocazioneCarico(riepilogo.carico, sedutePassate, category),
    [riepilogo.carico, sedutePassate, category])

  const sottotitoloWorkout = useMemo(() => {
    const d = date && isValid(parseISO(date)) ? format(parseISO(date), 'EEE d MMM', { locale: it }) : ''
    return [d, categoriaCorrente(category).nome].filter(Boolean).join(' · ')
  }, [date, category])


  const handleSave = async () => {
    if (category === 'Hyrox' && blocks.length === 0) return setAlertInfo({ title: 'Dati mancanti', message: 'Aggiungi almeno un blocco!', type: 'error' })
    if (category === 'Running' && runningSteps.length === 0) return setAlertInfo({ title: 'Dati mancanti', message: 'Aggiungi almeno una fase di corsa!', type: 'error' })
    if (category === 'Custom' && !coachNotes.trim()) return setAlertInfo({ title: 'Dati mancanti', message: 'Inserisci una descrizione per l\'allenamento!', type: 'error' })
    
    if (editId) {
      setNewWorkoutName(title)
      setIsSavingAsNew(false)
      setAtletiAssegnati(null)
      setShowSaveModal(true)
      // A quanti atleti cambia il workout se lo si sovrascrive. Se la lettura
      // fallisce la riga non compare: la scelta resta possibile.
      const { data: righe, error } = await supabase.from('athlete_workouts')
        .select('athlete_id').eq('workout_id', editId)
      if (!error && Array.isArray(righe)) setAtletiAssegnati(new Set(righe.map(r => r.athlete_id)).size)
    } else {
      performSave(false)
    }
  }

  const performSave = async (saveAsNew) => {
    setShowSaveModal(false)
    setSaving(true)
    // Un nome scritto resta com'è. Quello casuale si ricontrolla qui contro
    // TUTTI i workout salvati — chi sovrascrive non conta il proprio — e se è
    // già preso se ne sceglie un altro. Custom prende la data, numerata.
    const scritto = (saveAsNew ? newWorkoutName : title).trim()
    let finalTitle
    if (scritto) {
      finalTitle = unisciCodice(scritto, codice)
    } else if (conNomeCasuale) {
      const usati = await nomiGiaUsati(supabase)
      const proprio = !saveAsNew && editId ? usati.indexOf(nomeDiPartenza.current) : -1
      if (proprio >= 0) usati.splice(proprio, 1)
      const preso = usati.some(n => n.toLowerCase() === nomeCasuale?.toLowerCase())
      const nome = (preso ? nomeLibero(candidati, usati, semeNome) : nomeCasuale) || generaTitolo(date)
      finalTitle = unisciCodice(nome, codice)
    } else {
      finalTitle = generaTitolo(date, await titoliDelGiorno(supabase, date))
    }

    const sections = {
      intensity: workoutIntensity,
      category: category,
      blocks: category === 'Hyrox' ? blocks : undefined,
      steps: category === 'Running' ? runningSteps : undefined
    }

    const payload = { title: finalTitle, date, sections, coach_notes: coachNotes }
    let targetId = saveAsNew ? null : editId

    if (targetId) {
      // 🔴 Entrando da un atleta (`aw_id`) la data in pagina è la SUA, non quella
      // del workout: scriverla su `workouts.date` spostava il workout per tutti
      // gli altri. La data di quell'atleta si aggiorna sulla sua assegnazione.
      const aggiornamento = { ...payload }
      if (awId) delete aggiornamento.date
      const { error } = await supabase.from('workouts').update(aggiornamento).eq('id', editId)
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
    // Si esce dal builder senza nessun messaggio: la scheda che si apre è
    // l'esito, e la vibrazione è la conferma che il salvataggio è riuscito.
    vibraSuccesso()
    navigate(`/workout/${targetId}${athleteId ? `?athlete_id=${athleteId}` : ''}`, { replace: true })
  }

  return (
    // ⚠️ Con la tastiera aperta il fondo pagina si azzera, e non è cosmesi: quel
    //    padding riserva l'altezza della capsula della tab bar, che mentre si
    //    scrive è nascosta (Navbar). Tenendolo, la barra non ancorata resterebbe
    //    sospesa 115px sopra la tastiera, su un vuoto. Senza, cade dove la mette
    //    iOS: subito sopra i tasti.
    /* ⚠️ Niente `page-transition`, e qui è una correzione: la pagina che sale
       di 15px MENTRE il passo entra da destra è movimento doppio — lo stesso
       che è uscito dalle altre nove schermate il 21/09. Il passo si muove, la
       pagina no.
       ⚠️ E `TestataCrea` NON prende una voce di cascata, benché non sia
       `sticky`. In un flusso a passi la testata è la CORNICE: porta l'indietro
       e il titolo del workout, e i passi le scorrono dentro. Farla entrare
       insieme al passo vorrebbe dire due gesti in direzioni diverse nello
       stesso istante, su una schermata che ne ha già uno. */
    <div className={`px-4 max-w-2xl mx-auto min-h-[100dvh] flex flex-col gap-[18px]
                    pt-[calc(env(safe-area-inset-top)+1rem)]
                    ${tastieraAperta ? 'pb-3' : 'pb-[var(--fondo-pagina)]'}`}>
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
        onIndietro={step === 1 && daBarra && !sourceId ? null : handleBack}
        titolo={step === 2 ? nomeMostrato : null}
        codice={step === 2 ? codice : null}
        sottotitolo={step === 2 ? sottotitoloWorkout : null}
        onTitolo={step === 2 ? () => setStep(1) : null}
      />

      {/* ── STEP 1: LA CATEGORIA COME DOMANDA ────────────────────── */}
      {step === 1 && (
        /* ⚠️ `passo-entra` (src/index.css): il cambio di passo era netto.
            Entra da DESTRA, non dal basso: è un passaggio dentro un flusso,
            non un elemento che arriva in una lista. */
        <div className="flex flex-col gap-[18px] passo-entra">
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
              <div className="flex items-center gap-2">
                <input
                  aria-label="Nome del workout"
                  enterKeyHint="done"
                  onKeyDown={chiudiTastieraSuInvio}
                  className="w-full bg-transparent text-[15.5px] font-bold text-white placeholder-[#5b6070] focus:outline-none"
                  placeholder={nomeAutomatico || 'Facoltativo · lo scelgo dai blocchi'}
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                />
                {/* Il nome casuale non piace? Se ne pesca un altro. Solo a
                    campo vuoto: un nome scritto non si sostituisce. */}
                {conNomeCasuale && nomeCasuale && !title.trim() && (
                  <button
                    type="button"
                    aria-label="Un altro nome"
                    onClick={() => { vibraScelta(); setNomeFissato(null); setSemeNome(s => s + 1) }}
                    className="shrink-0 -my-1 p-1.5 rounded-full text-[#8a8f9c] hover:text-white active:scale-90 transition"
                  >
                    <Dices size={18} />
                  </button>
                )}
              </div>
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

        </div>
      )}

      {/* ── STEP 2: IL BUILDER CON IL RIEPILOGO ──────────────────── */}
      {step === 2 && category === 'Hyrox' && (
        <div className="flex flex-col gap-3.5 passo-entra">

          {/* Il builder era cieco: si aggiungevano blocchi senza sapere quanto
              dura la seduta. La barra sotto i tre numeri dice COME la durata è
              distribuita — un riscaldamento che si mangia metà seduta si vede a
              occhio, senza leggere un solo tempo. */}
          <RiepilogoWorkout {...riepilogo} collocazione={collocazione} />

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
          {/* ⚠️ `ocean` e non `colorful`: qui OGNI colore significa già una
              categoria (giallo Hyrox, azzurro Corsa, magenta Custom, bianco
              Gara), e un arcobaleno si leggerebbe come una quinta corsia che
              non esiste. `ocean` è blu-viola, il vicinato di `--color-ia`.
              ⚠️ `staticColors` spegne l'oscillazione di tinta: con essa accesa
              l'`hue-rotate(±30deg)` porta il bordo fino al VERDE — che in
              questa app vuol dire «completato» (§9-duetricies).
              ⚠️ Il raggio non si passa: la libreria lo legge dal primo figlio,
              quindi segue `rounded-[20px]` di `CardIA` da sé.
              🔴 Il fascio sta QUI e non dentro `CardIA` perché `CreaWorkoutUI`
              è un chunk condiviso con `WorkoutDetail`. */}
          <BorderBeam size="md" colorVariant="ocean" theme="dark" strength={0.6} staticColors>
            <CardIA onClick={() => setAiModalOpen(true)} />
          </BorderBeam>

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
        <div className="flex flex-col gap-3.5 passo-entra">
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
        <div className="flex flex-col gap-3.5 passo-entra">
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

      {/* La stessa barra serve i tre passi 2 e il passo 1, ma qui NON è
          ancorata: `mt-auto` la tiene al fondo della viewport finché il
          contenuto è corto, e da lì in poi la si raggiunge scorrendo. In un
          builder l'azione è la conclusione del lavoro, non la ragione per cui
          si è aperta la pagina — vedi la nota su `ancorata` in CreaWorkoutUI. */}
      <div className="mt-auto" />
      <BarraAzioni ancorata={false}>
        {step === 1 ? (
          <CtaPrimaria onClick={() => setStep(2)} iconaCoda={ArrowRight}>
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
            {/* ⚠️ `attesa` solo qui fra tutte le CtaPrimaria dell'app: le altre
                aprono un modale, e contrarsi per 570ms vorrebbe dire ritardarlo.
                L'etichetta «Salvo…» resta nel DOM anche se trasparente — è il
                nome accessibile del bottone mentre è una pillola. */}
            <CtaPrimaria onClick={handleSave} disabled={saving} attesa={saving} icona={Save}>
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
        <div className="fixed inset-0 bg-black/85 z-[100] flex items-center justify-center p-4 velo-in">
          <div className={`${CARD} w-full max-w-sm p-6 flex flex-col gap-4 modal-transition`}>
            <div className="flex justify-between items-center mb-2">
               <h2 className="text-xl font-bold text-white">Salvataggio</h2>
               <button aria-label="Chiudi" onClick={() => setShowSaveModal(false)} className="text-muted hover:text-white"><X size={20} /></button>
            </div>
            
            {!isSavingAsNew ? (
              <>
                <p className="text-gray-400 text-sm">Vuoi salvarlo come un allenamento nuovo o sovrascrivere quello esistente?</p>
                {/* ⚠️ «Salva come nuovo» è il bottone pieno e sta SOPRA: è la
                    scelta che non tocca nessun altro. Prima il giallo era
                    «Sovrascrivi», e chi confermava senza leggere cambiava il
                    workout a tutti gli atleti che l'avevano assegnato. */}
                <div className="flex flex-col gap-3 mt-2">
                  <button onClick={() => setIsSavingAsNew(true)} className={`w-full ${BOTTONE_BRAND}`}>
                    Salva come nuovo
                  </button>
                  <button onClick={() => performSave(false)} className={`w-full ${BOTTONE_QUIETO}`}>
                    Sovrascrivi esistente
                  </button>
                  {atletiAssegnati > 0 && (
                    <p data-avviso-sovrascrivi className="text-[12.5px] leading-snug text-amber-300/90 text-center -mt-1">
                      Sovrascrivendo cambia il workout per {atletiAssegnati === 1 ? '1 atleta' : `${atletiAssegnati} atleti`} a cui è assegnato.
                    </p>
                  )}
                </div>
              </>
            ) : (
              <>
                <p className="text-gray-400 text-sm">Nome del nuovo allenamento — se lo lasci vuoto ne scelgo uno io:</p>
                {/* Entrando da un atleta, la copia NON resta solo una copia:
                    la sua assegnazione passa alla versione nuova. Va detto. */}
                {awId && (
                  <p data-avviso-copia className="text-[12.5px] leading-snug text-amber-300/90">
                    {nomeAtletaModifica || "L'atleta da cui sei entrato"} riceverà questa versione; gli altri atleti tengono l'originale.
                  </p>
                )}
                <input 
                  autoFocus
                  className="bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-brand w-full mt-1 text-base"
                  value={newWorkoutName}
                  onChange={(e) => setNewWorkoutName(e.target.value)}
                  placeholder="Facoltativo"
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
                    disabled={saving}
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

      {/* EXIT CONFIRM MODAL
          ⚠️ Resta scritta a mano e NON diventa una `CustomConfirm`: la sua
          conferma è distruttiva e si chiama «Sì, esci», mentre quel componente
          ha due etichette fisse e la primaria gialla. Prende però lo stesso
          vocabolario — carta sollevata, velo che sfuma, `modal-transition` —
          o sulla stessa schermata convivrebbero due dialoghi di due epoche.
          🔴 L'entrata che aveva prima era `animate-in fade-in zoom-in-[.96]`,
          cioè tw-animate-css, che NON è installato: generava ZERO CSS. È la
          quinta comparsa della stessa trappola (§9-duodecies, §9-quindecies,
          §9-duodetricies, §9-septtricies). */}
      {showExitConfirm && createPortal(
        <div className="fixed inset-0 bg-black/85 z-[100] flex items-center justify-center p-4 velo-in">
          <div role="dialog" aria-modal="true" aria-label="Sei sicuro?" className={CARTA_MODALE}>
            <div className={`${BOLLA_MODALE} ${TONO_BOLLA.errore}`}>
              <AlertTriangle size={26} aria-hidden="true" />
            </div>
            <h2 className={TITOLO_MODALE}>Sei sicuro?</h2>
            <p className={TESTO_MODALE}>
              Hai delle modifiche non salvate. Se esci ora, i dati andranno persi.
            </p>
            <div className="flex gap-3 mt-2">
              <button 
                onClick={() => setShowExitConfirm(false)}
                className={BOTTONE_QUIETO}
              >
                Annulla
              </button>
              <button 
                onClick={() => {
                  localStorage.removeItem('fleofit_workout_draft')
                  // ⚠️ `pendingPath` è o una rotta intercettata (una stringa)
                  // o la sentinella del tasto indietro, che NON è una rotta:
                  // passarla a `navigate` porterebbe su `/-1`.
                  if (pendingPath === INDIETRO) indietro()
                  else navigate(pendingPath)
                }}
                className={BOTTONE_PERICOLO}
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