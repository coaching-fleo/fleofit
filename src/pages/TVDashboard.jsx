import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import { Capacitor } from '@capacitor/core'
import { KeepAwake } from '@capacitor-community/keep-awake'
import { coloreCategoria, BRAND } from '../lib/colori'
import { mmss, riepilogoWorkout } from '../lib/stimaWorkout'
import { minutiGym } from '../lib/gym'
import { bloccoAScaglioni } from '../lib/personeTV'
import QRCode from 'qrcode'
import { contenutoQR } from '../lib/codiceTV'
import { buildTimerSequence, getNormalizedBlocks, haTimerGuidato } from '../lib/timerSequence'
import { statoTV, beepTV } from '../lib/avanzaTimer'
import { vociLocandina, voceBlocco, statoCarosello, nomeFase, ACCENTO_TEMA } from '../lib/schermoTV'
import useAdattaTesto from '../useAdattaTesto'
import {
  AttesaTV, CaricamentoTV, ErroreTV, LocandinaTV, InCorsoTV,
} from '../components/TVDashboardUI'

// --- AUDIO GENERATOR HELPER ---
const writeString = (view, offset, string) => {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
};

const createBeepURI = (freq, durationMs) => {
  const sampleRate = 44100;
  const numSamples = Math.floor(sampleRate * (durationMs / 1000));
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);
  
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); 
  view.setUint16(20, 1, true); 
  view.setUint16(22, 1, true); 
  view.setUint32(24, sampleRate, true); 
  view.setUint32(28, sampleRate * 2, true); 
  view.setUint16(32, 2, true); 
  view.setUint16(34, 16, true); 
  writeString(view, 36, 'data');
  view.setUint32(40, numSamples * 2, true); 
  
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * freq * t);
    let envelope = 1;
    if (i < 1000) envelope = i / 1000;
    else if (i > numSamples - 1000) envelope = (numSamples - i) / 1000;
    view.setInt16(44 + i * 2, sample * 32767 * envelope, true);
  }
  
  const blob = new Blob([buffer], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
};

let shortBeepURI = null;
let longBeepURI = null;
let longerBeepURI = null;
if (typeof window !== 'undefined') {
  shortBeepURI = createBeepURI(600, 200);
  longBeepURI = createBeepURI(1200, 1000);
  longerBeepURI = createBeepURI(1200, 1500);
}

const getIntensityColor = (val) => {
  const num = parseInt(val, 10);
  if (isNaN(num)) return 'text-muted';
  if (num <= 3) return 'text-green-400';
  if (num <= 6) return 'text-yellow-400';
  if (num <= 8) return 'text-orange-500';
  return 'text-red-500';
}

export default function TVDashboard() {
  const [code, setCode] = useState(null)
  const [qr, setQr] = useState(null)
  const [workout, setWorkout] = useState(null)
  const [status, setStatus] = useState('waiting') // 'waiting', 'loading', 'active'
  const [error, setError] = useState(null)

  // Il QR del codice: si rifà quando il codice cambia; se fallisce resta solo il codice.
  // Senza margine (lo dà la carta bianca di AttesaTV, 4 moduli) e a 400px: il
  // link è sempre un QR da 25 moduli, quindi 16px a modulo, il doppio esatto
  // dei 200px a cui si mostra (TVDashboardQR.test.jsx).
  useEffect(() => {
    if (!code) return
    let attivo = true
    QRCode.toDataURL(contenutoQR(code), { margin: 0, width: 400, color: { dark: '#0b0b0b', light: '#ffffff' } })
      .then(url => { if (attivo) setQr(url) })
      .catch(() => { if (attivo) setQr(null) })
    return () => { attivo = false }
  }, [code])
  const [timerState, setTimerState] = useState(null)
  const [lastTimerState, setLastTimerState] = useState(null)
  
  // Audio Sync System
  const [audioUnlocked, setAudioUnlocked] = useState(false)
  const audioUnlockedRef = useRef(false)
  const shortBeepAudio = useRef(null)
  const longBeepAudio = useRef(null)
  const longerBeepAudio = useRef(null)
  const prevTimerStateRef = useRef(null)
  const containerRef = useRef(null)

  // MANTIENI LO SCHERMO ACCESO SULLA TV
  useEffect(() => {
    let wakeLock = null;
    const keepScreenAwake = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          await KeepAwake.keepAwake();
        } catch { /* KeepAwake: se non riesce lo schermo si spegne, non è un errore bloccante */ }
      } else if ('wakeLock' in navigator) {
        try {
          wakeLock = await navigator.wakeLock.request('screen');
        } catch { /* Wake Lock API: se non riesce lo schermo si spegne, non è un errore bloccante */ }
      }
    };

    const allowScreenSleep = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          await KeepAwake.allowSleep();
        } catch { /* KeepAwake.allowSleep: se non riesce lo schermo si spegne, non è un errore bloccante */ }
      } else if (wakeLock !== null) {
        try {
          await wakeLock.release();
          wakeLock = null;
        } catch { /* rilascio del wake lock: se non riesce lo schermo si spegne, non è un errore bloccante */ }
      }
    };

    keepScreenAwake();
    return () => { allowScreenSleep(); };
  }, []);

  const unlockAudio = useCallback(() => {
    if (!audioUnlockedRef.current) {
       audioUnlockedRef.current = true;
       setAudioUnlocked(true);
       [shortBeepAudio.current, longBeepAudio.current, longerBeepAudio.current].forEach(a => {
          if (a) {
            a.volume = 0;
            const p = a.play();
            if (p !== undefined) {
              p.then(() => {
                a.pause();
                a.currentTime = 0;
                a.volume = 1;
              }).catch(()=>{});
            }
          }
        });
    }
  }, []);

  useEffect(() => {
    shortBeepAudio.current = new Audio(shortBeepURI);
    longBeepAudio.current = new Audio(longBeepURI);
    longerBeepAudio.current = new Audio(longerBeepURI);

    const handleFirstInteraction = () => {
      unlockAudio();
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };
    
    window.addEventListener('click', handleFirstInteraction);
    window.addEventListener('keydown', handleFirstInteraction);
    
    return () => {
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    }
  }, [unlockAudio]);

  const playBeep = useCallback((freq, duration) => {
    try {
      let audio;
      if (duration <= 0.2) audio = shortBeepAudio.current;
      else if (duration <= 1.0) audio = longBeepAudio.current;
      else audio = longerBeepAudio.current;

      if (audio) {
        audio.currentTime = 0;
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {});
        }
      }
    } catch { /* beep: WebAudio resta bloccato finché non c'è stato un tocco */ }
  }, []);

  // La TV conta da sola fra un messaggio del telefono e l'altro: col telefono
  // bloccato i messaggi smettono di arrivare, e fino al 29/10/2026 il timer qui
  // si fermava sull'ultimo numero (src/lib/avanzaTimer.js).
  // Le pause dopo il Cash In e prima del Cash Out (26/11/2026) solo se il
  // telefono dice di averle: un'app vecchia sugli Store non le ha, e con la
  // sequenza diversa la TV non saprebbe più andare avanti da sola.
  const pauseDalTelefono = timerState?.pause === true
  const sequenza = useMemo(
    () => (workout ? buildTimerSequence(workout, { pause: pauseDalTelefono }) : []),
    [workout, pauseDalTelefono],
  )
  const [adesso, setAdesso] = useState(() => Date.now())
  useEffect(() => {
    if (!timerState?.isRunning) return
    const id = setInterval(() => setAdesso(Date.now()), 250)
    return () => clearInterval(id)
  }, [timerState])
  const statoMostrato = useMemo(
    () => statoTV(timerState, sequenza, Math.max(adesso, timerState?.ricevuto ?? 0)),
    [timerState, sequenza, adesso],
  )

  useEffect(() => {
    if (audioUnlocked) {
      const beep = beepTV(prevTimerStateRef.current, statoMostrato);
      if (beep === 'corto') playBeep(600, 0.2);
      else if (beep === 'lungo') playBeep(1200, 1.0);
      else if (beep === 'finale') playBeep(1200, 1.5);
    }
    prevTimerStateRef.current = statoMostrato;
  }, [statoMostrato, audioUnlocked, playBeep]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.focus();
    }
  }, [status]);

  useEffect(() => {
    if (statoMostrato) {
      setLastTimerState(statoMostrato)
    }
  }, [statoMostrato])

  useEffect(() => {
    const updateScale = () => {
      const container = document.getElementById('tv-canvas-container');
      const inner = document.getElementById('tv-inner-content');
      if (container && inner) {
        // Solo orizzontale dal 26/11/2026: la TV ruotata avrà un disegno suo.
        const screenW = window.innerWidth;
        const screenH = window.innerHeight;
        const requiredVisualHeight = Math.max(1080, inner.scrollHeight);
        const finalScale = Math.min(screenW / 1920, screenH / requiredVisualHeight);
        container.style.transform = `scale(${finalScale})`;
      }
    };
    updateScale();

    const resizeObserver = new ResizeObserver(() => {
      updateScale();
    });
    const inner = document.getElementById('tv-inner-content');
    if (inner) resizeObserver.observe(inner);

    window.addEventListener('resize', updateScale);
    
    let channel;
    // Il codice di QUESTA esecuzione: lo state `code` qui dentro resta quello
    // della prima esecuzione (null), e la riga non si cancellava mai (04/11/2026).
    let codice = null
    let spenta = false
    
    const initTV = async () => {
      // Genera un codice casuale di 4 cifre
      const newCode = Math.floor(1000 + Math.random() * 9000).toString()
      codice = newCode
      setCode(newCode)

      const { error: insertErr } = await supabase.from('tv_sessions').upsert({
        code: newCode,
        updated_at: new Date().toISOString()
      }, { onConflict: 'code' })

      // Chiusa mentre la riga si scriveva: la si toglie, e niente canale.
      if (spenta) {
        if (!insertErr) supabase.from('tv_sessions').delete().eq('code', newCode).then()
        return
      }

      if (insertErr) {
        setError("Errore connessione. Ricarica la pagina.")
        return
      }

      // Resta in ascolto degli aggiornamenti in "Tempo Reale" via Supabase
      channel = supabase.channel(`tv_${newCode}`, {
        config: { broadcast: { ack: false } }
      })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tv_sessions', filter: `code=eq.${newCode}` }, async (payload) => {
          if (payload.eventType === 'DELETE') {
            setStatus('waiting')
            setWorkout(null)
            setError(null)
            setTimerState(null)
            return
          }
          
          const newWorkoutId = payload.new?.workout_id
          if (newWorkoutId) {
            setStatus('loading')
            const { data: wData } = await supabase.from('workouts').select('*').eq('id', newWorkoutId).maybeSingle()
            if (wData) {
              setWorkout(wData)
              setStatus('active')
              setError(null)
            } else {
              setError("Workout non trovato.")
            }
          } else {
            setStatus('waiting')
            setWorkout(null)
            setError(null)
            setTimerState(null)
          }
        })
        .on('broadcast', { event: 'timer_state' }, (payload) => {
          // L'ora della TV in cui è arrivato: da lì conta da sola.
          setTimerState({ ...payload.payload, ricevuto: Date.now() })
        })
        .on('broadcast', { event: 'timer_close' }, () => {
          setTimerState(null)
        })
        .subscribe()
    }

    initTV()

    return () => {
      spenta = true
      if (channel) {
        supabase.removeChannel(channel)
        supabase.from('tv_sessions').delete().eq('code', codice).then()
      }
      window.removeEventListener('resize', updateScale);
      if (inner) resizeObserver.unobserve(inner);
    }
  }, [])

  // ── Cosa mostrare: la locandina prima del via, il carosello col timer ──
  // Calcolato qui in cima (e non dentro renderContent) perché useAdattaTesto è
  // un hook: va chiamato sempre, anche sullo schermo del codice.
  const schermo = useMemo(() => {
    if (!workout) return null
    const s = workout.sections || {}
    const rawCat = s?.category || (s?.main?.type === 'Running' || s?.steps ? 'Running' : 'Hyrox')
    const isAuto = rawCat === 'Custom' || rawCat === 'Autonomo' || s?.isAutonomous
    const category = rawCat === 'Event' ? 'Event' : (isAuto ? 'Custom' : rawCat)
    const blocks = category === 'Hyrox' ? getNormalizedBlocks(workout) : []
    const voci = vociLocandina({ categoria: category, blocks, sections: s })
    const secondi = category === 'Hyrox' ? riepilogoWorkout(blocks).secondi
      : category === 'Gym' ? minutiGym(s.gym || []) * 60 : 0
    const minuti = Math.round(secondi / 60)
    const durata = secondi <= 0 ? null
      : secondi < 600 ? { etichetta: 'Durata', valore: mmss(secondi) }
      : { etichetta: 'Circa', valore: minuti >= 60 ? `${Math.floor(minuti / 60)} h ${String(minuti % 60).padStart(2, '0')}` : `${minuti} min` }
    return {
      category, blocks, voci, durata,
      conTimer: haTimerGuidato(workout),
      vociBlocchi: blocks.map((b, k) => voceBlocco(b, k)),
      etichetta: category === 'Event' ? 'Gara / Evento'
        : category === 'Custom' ? 'Allenamento libero'
        : category === 'Running' ? 'Allenamento di corsa'
        : category === 'Gym' ? 'Allenamento Gym'
        : 'Allenamento Hyrox',
    }
  }, [workout])

  // «Avviato» non è «timer aperto»: collegando la TV il telefono apre il timer
  // in pausa sulla preparazione, e la locandina deve restare finché non si preme
  // Avvia. Partito = sta andando, o è già andato avanti almeno di un secondo.
  const avviato = !!schermo?.conTimer && !!timerState && (
    timerState.isRunning || timerState.currentIdx > 0 || timerState.timeLeft < (timerState.step?.duration ?? 0))
  // Più persone sfasate sullo stesso timer: arrivano dal telefono insieme al
  // `timer_state` (src/lib/personeTV.js).
  const persone = timerState && Array.isArray(timerState.persone) && timerState.persone.length > 0
    ? timerState.persone : null
  const passo = lastTimerState?.step
  const carosello = useMemo(() => (schermo && avviato
    ? statoCarosello({ blocks: schermo.blocks, sequenza, step: passo, persone })
    : null), [schermo, avviato, sequenza, passo, persone])

  const chiavePersone = persone ? persone.map(p => `${p.nome}${p.partenza}`).join() : ''
  const refLista = useAdattaTesto([schermo, avviato])
  const refCarosello = useAdattaTesto([schermo, avviato, chiavePersone, carosello?.corrente, passo?.type, passo?.id === 'prep'])

  const renderContent = () => {
    if (error) {
      return <ErroreTV messaggio={error} />
    }

    if (status === 'waiting') {
      return <AttesaTV codice={code} qr={qr} audioAttivo={audioUnlocked} />
    }

    if (status === 'loading' || !schermo) {
      return <CaricamentoTV />
    }

    const formatT = (totalSeconds) => {
      if (isNaN(totalSeconds)) return '0:00';
      const m = Math.floor(totalSeconds / 60);
      const s = totalSeconds % 60;
      return `${m}:${s.toString().padStart(2, '0')}`;
    };

    // Solo lettura dello stato che arriva dal telefono: nessun conto sul tempo,
    // solo come mostrarlo. Gli step a cronometro (duration 0) non hanno una fine,
    // quindi niente barra.
    const fine = passo?.type === 'done'
    const avanzamento = fine ? 1 : passo?.duration > 0 && lastTimerState
      ? (passo.duration - lastTimerState.timeLeft) / passo.duration
      : null
    // Con più persone il compito del timer («Wall Balls») vale per una sola:
    // nel blocco a scaglioni il timer rimanda ai colori delle righe.
    const inGruppo = !!carosello?.inGruppo
    const accento = ACCENTO_TEMA[passo?.theme] || BRAND
    const fase = [nomeFase(passo), /^Round/.test(passo?.subtitle || '') || passo?.pausa ? passo.subtitle : '']
      .filter(Boolean).join(' · ')

    // Il piede della carta di pausa: chi parte da dove, o come aggiungere le persone.
    const piedePausa = (b) => !bloccoAScaglioni(b)
      ? 'Si parte tutti insieme.'
      : persone
        ? <>Ognuno parte dal suo colore. Per cambiare: <b className="font-semibold text-gray-200">Persone sulla TV</b>, sul telefono.</>
        : <>Siete in più? Aggiungi le persone dal telefono, in <b className="font-semibold text-gray-200">Persone sulla TV</b>: ognuno parte da un esercizio diverso.</>

    const carte = carosello
      ? carosello.tappe.map((tappa, j) => ({
          chiave: `${tappa.tipo}-${tappa.k ?? ''}`,
          tappa,
          voce: tappa.k != null ? schermo.vociBlocchi[tappa.k] : null,
          stato: carosello.carte[j],
          piede: tappa.tipo === 'pausa' ? piedePausa(schermo.blocks[tappa.k]) : null,
        }))
      : []

    return (
      <>
        <LocandinaTV
          visibile={!avviato}
          etichettaCategoria={schermo.etichetta}
          coloreCategoria={coloreCategoria(schermo.category)}
          titolo={workout.title}
          intensita={workout.sections?.intensity}
          classeIntensita={getIntensityColor(workout.sections?.intensity)}
          durata={schermo.durata}
          quantiBlocchi={schermo.category === 'Hyrox' ? schermo.blocks.length : 0}
          nota={workout.coach_notes}
          voci={schermo.voci}
          conTimer={schermo.conTimer}
          audioAttivo={audioUnlocked}
          refLista={refLista}
        />
        {schermo.conTimer && (
          <InCorsoTV
            visibile={avviato}
            titolo={workout.title}
            audioAttivo={audioUnlocked}
            timer={{
              fase,
              colore: accento,
              compito: inGruppo ? (passo?.type === 'rest' ? 'Riposo · poi al tuo colore' : 'Ognuno al suo colore') : passo?.task,
              poi: inGruppo ? null : passo?.nextTask,
              tempo: fine || !lastTimerState ? null : formatT(lastTimerState.timeLeft),
              inPausa: !!lastTimerState && !lastTimerState.isRunning && !fine,
              avanzamento,
              coloreCifre: passo?.theme === 'rest' ? ACCENTO_TEMA.rest : '#ffffff',
            }}
            carte={carte}
            corrente={carosello?.corrente ?? 0}
            classeIntensita={getIntensityColor}
            notaLibera={workout.coach_notes}
            refCarosello={refCarosello}
          />
        )}
      </>
    )
  }

  return (
    <div 
      ref={containerRef}
      tabIndex={0}
      className="fixed inset-0 flex items-center justify-center overflow-hidden outline-none cursor-pointer"
      onClick={unlockAudio}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.code === 'Enter' || e.keyCode === 13) {
          unlockAudio();
        }
      }}
    >
      <div
        id="tv-canvas-container"
        style={{
          width: '1920px',
          height: '1080px',
          transformOrigin: 'center',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0b0b0b'
        }}
      >
        <div 
          id="tv-inner-content"
          className="bg-[#0B0B0B] text-white relative flex flex-col overflow-hidden"
          // Locandina e carosello sono disegnati su 1920×1080 esatti; lo schermo
          // del codice è più alto e si rimpicciolisce con la scala, come prima.
          style={{ width: '1920px', minHeight: '1080px', height: status === 'active' && schermo ? '1080px' : 'max-content' }}
        >
          {renderContent()}
        </div>
      </div>
    </div>
  )
}