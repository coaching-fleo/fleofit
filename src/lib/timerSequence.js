// Logica pura del timer guidato, estratta da WorkoutDetail.jsx il 26/08/2026.
//
// Perché è qui e non là: WorkoutDetail è un file da 3.000 righe che importa
// jspdf, html-to-image e mezzo Capacitor. Finché queste funzioni vivevano
// dentro, testarle voleva dire caricare tutto quel peso — e ESLint segnalava
// (giustamente) che un file di componenti non dovrebbe esportare funzioni.
// Vedi CLAUDE.md §9 punto 1: src/lib è il posto di questa roba.

import { ERGOMETERS } from './constants'

const isErgo = (name) => ERGOMETERS.includes(name)

// Migrazione RUNTIME dei workout in formato legacy (sections.warmup/cashIn/
// main/cashOut invece di blocks). ⚠️ CLAUDE.md §5: NON rimuovere questa logica.
// Quei workout esistono ancora nel database, che è condiviso con la web app.
export const getNormalizedBlocks = (workout) => {
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

// Interpreta le durate scritte a mano dal coach: "3:00", "30 sec", "1:30:00",
// "5" (= 5 minuti).
//
// 🔴 DIFETTO NOTO (BACKLOG #29): le fasi di corsa si possono definire a
// DISTANZA, e qui le lettere vengono tolte e il numero letto come minuti.
// "400m" diventa 24.000 secondi, cioè 6h40m. La correzione richiede una
// decisione di prodotto, vedi il backlog.
export const parseDuration = (val) => {
  if (!val) return 0;
  const str = String(val).toLowerCase().replace(/[^0-9:.]/g, '').trim();
  if (String(val).toLowerCase().includes('sec')) return parseInt(str, 10) || 0;
  const parts = str.split(':');
  if (parts.length === 2) return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  if (parts.length === 3) return parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseInt(parts[2], 10);
  return Math.round((parseFloat(str) || 0) * 60); 
}

// Cuore del timer guidato: linearizza un workout in una sequenza di step
// (prep → … → done), espandendo round e ripetute.
/**
 * Quali workout hanno il timer guidato.
 *
 * Il **Running ne è escluso** per decisione del committente (26/08/2026): le
 * fasi di corsa si seguono con l'orologio o a sensazione, non con un conto alla
 * rovescia sul telefono. La scelta chiude anche il difetto delle distanze
 * (BACKLOG #29), che riguardava solo quelle fasi: `400m` finiva interpretato
 * come 400 minuti, cioè 6 ore e 40.
 *
 * Anche gli Eventi/gare ne sono esclusi: non sono allenamenti da eseguire.
 *
 * ⚠️ Sta qui e non in WorkoutDetail perché la stessa domanda serve in due punti
 * — se mostrare il bottone e cosa costruire — e due copie della regola
 * finirebbero per divergere.
 */
export const haTimerGuidato = (workout) => {
  const s = workout?.sections || {}
  const rawCat = s?.category || (s?.main?.type === 'Running' || s?.steps ? 'Running' : 'Hyrox')
  if (rawCat === 'Event' || s?.isEvent === true) return false
  return rawCat !== 'Running'
}

export const buildTimerSequence = (workout) => {
  // Senza questa guardia un workout di corsa cadrebbe nel ramo Hyrox e
  // produrrebbe una sequenza senza senso. Il chiamante controlla già
  // haTimerGuidato, ma la funzione non deve dipendere dalla sua correttezza.
  if (!haTimerGuidato(workout)) return [];

  const seq = [];
  seq.push({ id: 'prep', title: 'Preparazione', subtitle: 'Il workout sta per iniziare', duration: 10, theme: 'prep', type: 'prep', task: 'Preparati!' });

  const s = workout.sections || {};
  const rawCat = s?.category || (s?.main?.type === 'Running' || s?.steps ? 'Running' : 'Hyrox');
  const isAuto = s?.isAutonomous === true || rawCat === 'Autonomo';
  const isCustom = rawCat === 'Custom' || isAuto;

  if (isCustom) {
    seq.push({ id: 'custom-blk', title: 'ALLENAMENTO', subtitle: 'Cronometro libero', duration: 0, theme: 'custom', type: 'stopwatch', task: workout.title || 'Workout Custom' });
  } else {
    const blocks = getNormalizedBlocks(workout);
    blocks.forEach((b, i) => {
      const exNames = (b.exercises || []).map(e => e.name).join(' • ');
      
      const getTaskForRound = (r) => {
        if (!b.exercises || b.exercises.length === 0) return null;
        const ex = b.exercises[(r - 1) % b.exercises.length];
        const detail = ex.exTime && ex.exTime !== '-' ? ex.exTime : ((ex.meters && ex.meters !== '-') ? ex.meters : (ex.reps && ex.reps !== '-' ? `${ex.reps} reps` : ''));
        const paceStr = isErgo(ex.name) && ex.ergoPace && ex.ergoPace !== '-' && ex.ergoPace !== 'Libero' ? `@ ${ex.ergoPace}` : '';
        const kgStr = ex.kg ? `${ex.kg}kg` : '';
        return [ex.name, detail, paceStr, kgStr].filter(Boolean).join(' · ');
      };
      
      if (b.type === 'WarmUp' || b.type === 'Rest') {
        const sec = parseDuration(b.params?.duration);
        seq.push({ id: `blk-${i}`, title: b.type, subtitle: b.notes || '', duration: sec, theme: b.type==='Rest' ? 'rest' : 'base', type: b.type==='Rest' ? 'rest' : 'work', task: b.type === 'WarmUp' ? 'Riscaldamento' : 'Riposo' });
      } else if (b.type === 'ON/OFF') {
        const rounds = parseInt(b.params?.rounds, 10) || 10;
        const onSec = parseDuration(b.params?.on || '1:00');
        const offSec = parseDuration(b.params?.off || '1:00');
        for(let r=1; r<=rounds; r++) {
           seq.push({ id: `blk-${i}-${r}-on`, title: 'WORK (ON)', subtitle: `Round ${r}/${rounds}`, duration: onSec, theme: 'hyrox', type: 'work', task: getTaskForRound(r) || 'Lavoro' });
           seq.push({ id: `blk-${i}-${r}-off`, title: 'REST (OFF)', subtitle: `Round ${r}/${rounds}`, duration: offSec, theme: 'rest', type: 'rest', task: 'Riposo' });
        }
      } else if (b.type === 'EMOM') {
        const rounds = parseInt(b.params?.rounds, 10) || 10;
        const intSec = parseDuration(b.params?.interval || '1:00');
        for(let r=1; r<=rounds; r++) {
           seq.push({ id: `blk-${i}-${r}`, title: 'EMOM', subtitle: `Round ${r}/${rounds}`, duration: intSec, theme: 'emom', type: 'work', task: getTaskForRound(r) || 'EMOM' });
        }
      } else if (b.type === 'AMRAP') {
        const sec = parseDuration(b.params?.duration || '10:00');
        seq.push({ id: `blk-${i}`, title: 'AMRAP', subtitle: '', duration: sec, theme: 'emom', type: 'work', task: exNames || 'AMRAP' });
      } else if (b.type === 'For Time' || b.type === 'Interval') {
        const rounds = parseInt(b.params?.rounds, 10) || 1;
        const sec = parseDuration(b.params?.timecap || '0'); 
        for(let r=1; r<=rounds; r++) {
           seq.push({ id: `blk-${i}-${r}`, title: b.type.toUpperCase(), subtitle: `Round ${r}/${rounds}`, duration: sec, theme: 'base', type: sec > 0 ? 'work' : 'stopwatch', task: exNames || b.type.toUpperCase() });
        }
      } else {
        seq.push({ id: `blk-${i}`, title: b.type.toUpperCase(), subtitle: '', duration: 0, theme: 'base', type: 'stopwatch', task: exNames || b.type.toUpperCase() });
      }
    });
  }

  seq.push({ id: 'done', title: 'Completato!', subtitle: 'Ottimo lavoro', duration: 0, theme: 'done', type: 'done', task: 'Workout terminato 🎉' });
  
  // Assegna il nextTask a ogni step
  for(let i=0; i<seq.length-1; i++) {
    seq[i].nextTask = seq[i+1].task;
  }

  return seq;
}
