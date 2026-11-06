// Dati DIMOSTRATIVI della landing /benvenuto. Non vengono dal database e non
// descrivono atleti veri: servono a far vedere i tipi di blocco, la corsa e la TV al lavoro.
// I nomi dei blocchi e il formato dei parametri sono quelli dell'app (CLAUDE.md §5).

export const COLORI = {
  hyrox: '#f1ba17',
  corsa: '#0094C6',
  gym: '#14B8A6',
  ia: '#a855f7',
  riposo: '#4ade80',
}

// I nove blocchi Hyrox del builder, con il loro parametro tipico e la forma
// nel tempo: ogni segmento è [durata relativa, 'lavoro' | 'riposo' | 'giro'].
export const TIPI_BLOCCO = [
  { tipo: 'WarmUp', param: 'Durata 5:00', spiega: 'Si scalda il motore, a ritmo libero.', forma: [[1, 'lavoro']] },
  { tipo: 'Cash In', param: '2 round · rec 1:00', spiega: 'Un pacchetto da chiudere prima del blocco centrale.', forma: [[3, 'lavoro'], [1, 'riposo'], [3, 'lavoro']] },
  { tipo: 'ON/OFF', param: '8 round · 0:40 / 0:20', spiega: 'Lavoro e pausa fissi, la stazione cambia a ogni round.', forma: Array.from({ length: 16 }, (_, i) => [i % 2 ? 1 : 2, i % 2 ? 'riposo' : 'lavoro']) },
  { tipo: 'EMOM', param: '12 min · ogni 1:00', spiega: 'Allo scoccare del minuto si riparte: quel che avanza è recupero.', forma: Array.from({ length: 24 }, (_, i) => [i % 2 ? 1 : 2, i % 2 ? 'riposo' : 'lavoro']) },
  { tipo: 'AMRAP', param: '15:00', spiega: 'Più giri possibile prima che scada il tempo.', forma: Array.from({ length: 6 }, () => [1, 'giro']) },
  { tipo: 'For Time', param: 'Time cap 12:00', spiega: 'Il prima possibile, entro il time cap.', forma: [[7, 'lavoro'], [2, 'cap']] },
  { tipo: 'Interval', param: '5 × 1:30 · rec 1:00', spiega: 'Ogni esercizio ha il suo tempo, poi si recupera.', forma: Array.from({ length: 10 }, (_, i) => [i % 2 ? 2 : 3, i % 2 ? 'riposo' : 'lavoro']) },
  { tipo: 'Rest', param: '2:00', spiega: 'Una pausa vera, dentro la scheda.', forma: [[1, 'riposo']] },
  { tipo: 'Cash Out', param: '1 round', spiega: 'L\'ultima cosa da chiudere, a fatica alta.', forma: [[4, 'lavoro']] },
]

// La ripetuta libera «3 × (4′ Z3 + 3′ Z2)» fra riscaldamento e defaticamento:
// [minuti, zona 1–5].
export const PROFILO_CORSA = [
  [12, 2], [4, 3], [3, 2], [4, 3], [3, 2], [4, 3], [3, 2], [6, 1],
]

// Il timer guidato del blocco ON/OFF: lavoro 40 s, pausa 20 s, otto round.
export const STAZIONI = [
  ['20 Wall Balls', '9 kg'],
  ['250 m SkiErg', '2:00 /500m'],
  ['10 Burpee broad jump', ''],
  ['25 m Sled push', '102 kg'],
]

export const ATLETI = ['Sara', 'Luca', 'Giulia']
