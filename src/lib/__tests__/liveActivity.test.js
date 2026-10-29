import { describe, it, expect } from 'vitest'

import { statoLiveActivity, programmaLiveActivity, preferenzaLiveActivity, salvaPreferenzaLiveActivity, CHIAVE_LIVE_ACTIVITY } from '../liveActivity'

// Perché questi test esistono
// ────────────────────────────
// La Live Activity (blocco schermo e Dynamic Island) non può chiedere niente
// all'app mentre il telefono è bloccato: tutto quello che mostra, compresi i
// momenti in cui il passo finisce, deve arrivarle già scritto in date assolute.
// Una data sbagliata qui è un conto alla rovescia sbagliato sul blocco schermo,
// che nessun test nativo vede.

const seq = [
  { id: 'prep', title: 'Preparazione', subtitle: 'Il workout sta per iniziare', duration: 10, type: 'prep', task: 'Preparati!' },
  { id: 'a', title: 'WORK (ON)', subtitle: 'Round 1/8', duration: 40, type: 'work', task: 'Wall Balls · 20 reps · 9kg' },
  { id: 'b', title: 'REST (OFF)', subtitle: 'Round 1/8', duration: 20, type: 'rest', task: 'Riposo' },
  { id: 'done', title: 'Completato!', subtitle: 'Ottimo lavoro', duration: 0, type: 'done', task: 'Workout terminato 🎉' },
]
const adesso = 1_000_000

describe('statoLiveActivity — cosa riceve la Live Activity', () => {
  it('un passo in corso: fine e inizio in date assolute, il giro dal sottotitolo', () => {
    const s = statoLiveActivity({ sequence: seq, idx: 1, timeLeft: 30, isRunning: true, colore: '#f1ba17', adesso })
    expect(s).toMatchObject({
      fase: 'work', etichetta: 'ON', compito: 'Wall Balls · 20 reps · 9kg',
      giro: 1, giri: 8, colore: '#f1ba17', restante: 30, inPausa: false, cronometro: false,
      fine: adesso + 30_000, inizio: adesso - 10_000, frazione: 0.75,
    })
    expect(s.poi).toBe('Poi: Riposo · 0:20')
  })

  it('il riposo è verde, la preparazione bianca, «Completato» verde pieno', () => {
    expect(statoLiveActivity({ sequence: seq, idx: 2, timeLeft: 20, isRunning: true, colore: '#f1ba17', adesso }).colore).toBe('#4ade80')
    expect(statoLiveActivity({ sequence: seq, idx: 0, timeLeft: 10, isRunning: true, colore: '#f1ba17', adesso }).colore).toBe('#ffffff')
    expect(statoLiveActivity({ sequence: seq, idx: 3, timeLeft: 0, isRunning: false, colore: '#f1ba17', adesso }).colore).toBe('#22c55e')
  })

  it('in pausa non ci sono date: il numero resta fermo', () => {
    const s = statoLiveActivity({ sequence: seq, idx: 1, timeLeft: 30, isRunning: false, colore: '#f1ba17', adesso })
    expect(s).toMatchObject({ inPausa: true, fine: null, inizio: null, restante: 30 })
  })

  it('l\'allenamento intero: dove si è e quando finisce', () => {
    const s = statoLiveActivity({ sequence: seq, idx: 1, timeLeft: 30, isRunning: true, colore: '#f1ba17', adesso })
    // fatti 10 + 10 = 20 s su 70, mancano 30 + 20 = 50
    expect(s.inizioAllenamento).toBe(adesso - 20_000)
    expect(s.fineAllenamento).toBe(adesso + 50_000)
    expect(s.totale).toBe(70)
    expect(s.avanzamento).toBeCloseTo(20 / 70)
  })

  it('un cronometro sale: l\'inizio è nel passato, la fine non c\'è', () => {
    const cron = [seq[0], { id: 'c', title: 'ALLENAMENTO', subtitle: 'Cronometro libero', duration: 0, type: 'stopwatch', task: 'Custom' }, seq[3]]
    const s = statoLiveActivity({ sequence: cron, idx: 1, timeLeft: 95, isRunning: true, colore: '#D11149', adesso })
    expect(s).toMatchObject({ fase: 'stopwatch', cronometro: true, inizio: adesso - 95_000, fine: null, fineAllenamento: null })
  })

  it('l\'ultimo passo prima della fine lo dice', () => {
    expect(statoLiveActivity({ sequence: seq, idx: 2, timeLeft: 20, isRunning: true, colore: '#f1ba17', adesso }).poi).toBe('Poi: fine allenamento')
  })

  it('senza giri (EMOM su più minuti compresi) il giro è zero o il primo', () => {
    expect(statoLiveActivity({ sequence: seq, idx: 0, timeLeft: 10, isRunning: true, colore: '#fff', adesso }).giro).toBe(0)
    const emom = [{ id: 'e', title: 'EMOM', subtitle: 'Round 3–4/10', duration: 120, type: 'work', task: 'Sled' }]
    expect(statoLiveActivity({ sequence: emom, idx: 0, timeLeft: 120, isRunning: true, colore: '#fff', adesso })).toMatchObject({ giro: 3, giri: 10, etichetta: 'EMOM' })
  })
})

describe('preferenza — si chiede una volta sola', () => {
  const finto = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) } }

  it('mai scelta è null: è il segnale per fare la domanda', () => {
    expect(preferenzaLiveActivity(finto())).toBeNull()
  })

  it('una scelta resta, sia sì sia no', () => {
    const st = finto()
    salvaPreferenzaLiveActivity(false, st)
    expect(preferenzaLiveActivity(st)).toBe(false)
    salvaPreferenzaLiveActivity(true, st)
    expect(preferenzaLiveActivity(st)).toBe(true)
    expect(st.getItem(CHIAVE_LIVE_ACTIVITY)).toBe('true')
  })
})

describe('programmaLiveActivity — i passi che il blocco schermo fa da solo', () => {
  it('ogni passo comincia un secondo dopo lo zero del precedente, come il timer dell\'app', () => {
    const p = programmaLiveActivity({ sequence: seq, idx: 0, timeLeft: 10, isRunning: true, colore: '#f1ba17', adesso })
    expect(p.map(x => x.quando)).toEqual([adesso, adesso + 11_000, adesso + 52_000, adesso + 73_000])
    expect(p.map(x => x.stato.fase)).toEqual(['prep', 'work', 'rest', 'done'])
    // Il passo programmato finisce dove comincia il successivo, meno lo zero.
    expect(p[1].stato.fine).toBe(adesso + 51_000)
    expect(p[1].stato.compito).toBe('Wall Balls · 20 reps · 9kg')
  })

  it('coincide con avanzaSequenza: dove il programma dice un passo, l\'app è lì', async () => {
    const { avanzaSequenza } = await import('../avanzaTimer')
    const p = programmaLiveActivity({ sequence: seq, idx: 0, timeLeft: 10, isRunning: true, colore: '#f1ba17', adesso })
    for (const { quando, stato } of p.slice(1)) {
      const secondi = (quando - adesso) / 1000
      const qui = avanzaSequenza(seq, 0, 10, secondi)
      expect(seq[qui.idx].title).toBe(stato.titolo)
      expect(qui.timeLeft).toBe(seq[qui.idx].duration)
      // Un secondo prima l'app è ancora sullo zero del passo precedente.
      const prima = avanzaSequenza(seq, 0, 10, secondi - 1)
      expect(prima.idx).toBe(qui.idx - 1)
      expect(prima.timeLeft).toBe(0)
    }
  })

  it('parte dal tempo che resta, non dalla durata piena', () => {
    const p = programmaLiveActivity({ sequence: seq, idx: 1, timeLeft: 5, isRunning: true, colore: '#f1ba17', adesso })
    expect(p[1].quando).toBe(adesso + 6_000)
  })

  it('in pausa e a cronometro non prevede niente', () => {
    expect(programmaLiveActivity({ sequence: seq, idx: 1, timeLeft: 5, isRunning: false, colore: '#f1ba17', adesso })).toHaveLength(1)
    const cron = [seq[0], { id: 's', title: 'For Time', subtitle: '', duration: 0, type: 'stopwatch', task: 'Vai' }, seq[3]]
    const p = programmaLiveActivity({ sequence: cron, idx: 0, timeLeft: 10, isRunning: true, colore: '#f1ba17', adesso })
    expect(p.map(x => x.stato.fase)).toEqual(['prep', 'stopwatch'])
  })
})

