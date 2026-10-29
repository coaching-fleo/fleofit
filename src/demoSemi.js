// I dati dell'ambiente di prova (src/supabaseDemo.js).
//
// 🔴 I tre elenchi sono FUNZIONI, non array, e non è uno stile: come costanti
// venivano costruiti a livello di modulo chiamando `A()`, `W()` e `AW()`, e
// Rollup non può dimostrare che una chiamata sia pura — quindi li teneva, e
// **gli atleti finti finivano nel bundle spedito ad Apple**. Verificato il
// 09/09/2026 sull'`.ipa` in preparazione: `Sara Villa`, `Andrea Conti` e i
// titoli dei workout di prova erano lì dentro, mentre `invitation_codes` e
// `personal_records` — scritti come letterali puri — erano già stati buttati.
// È la stessa metà di verità del controllo documentato in §9-quinvicies, che
// cerca «AMBIENTE DI PROVA» e quindi vedeva solo `supabaseDemo.js`.
// Dentro una funzione non resta nessuna chiamata a livello di modulo, e
// l'albero intero sparisce quando `semi` non ha chiamanti.
//
// ⚠️ Le date sono RELATIVE a oggi, non fisse: un seme con date scritte a mano
// invecchia, e dopo una settimana «questa settimana» è vuota e metà delle
// schermate non ha più niente da mostrare.
//
// Ogni atleta è costruito per far scattare un ramo diverso del modello del
// carico (CLAUDE.md §9-quatervicies). Il commento accanto al nome dice quale:
// se un giorno un ramo smette di comparire, si parte da lì.

import {
  VERSIONE as VERSIONE_ESTRAZIONE, impronta, testoPulito, eserciziDelWorkout, validaEstrazione,
} from '../supabase/functions/estrai-note/regole.ts'

export const VERSIONE_SEME = 16

const COACH = '0118e43f-8791-4fd6-8032-bee028334c99'

const giorno = (scarto) => {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() + scarto)
  return d.toISOString().slice(0, 10)
}

/** Lo scarto in giorni dal lunedì di questa settimana (lunedì = 0). */
const lunedi = () => {
  const d = new Date()
  const g = (d.getDay() + 6) % 7
  return -g
}
/** Giorno `n` (0=lun) della settimana spostata di `settimane`. */
const nellaSettimana = (settimane, n) => giorno(lunedi() + settimane * 7 + n)

// ── il vocabolario dei workout ──────────────────────────────────────────────

const emom = (minuti, intensita) => ({
  category: 'Hyrox', intensity: String(intensita),
  blocks: [
    { id: 1.1, type: 'WarmUp', params: { duration: '6:00' }, exercises: [] },
    { id: 1.2, type: 'EMOM', params: { interval: '1:00', rounds: String(minuti) },
      exercises: [
        { id: 2.1, name: 'Wall Balls', reps: '20', kg: '9', intensity: String(intensita) },
        { id: 2.2, name: 'Burpees Broad Jump', reps: '10', intensity: String(intensita) },
      ] },
  ],
})

const hyroxCompleto = (intensita) => ({
  category: 'Hyrox', intensity: String(intensita),
  blocks: [
    { id: 3.1, type: 'WarmUp', params: { duration: '8:00' }, exercises: [] },
    { id: 3.2, type: 'Cash In', params: { rounds: '1' }, exercises: [
      { id: 4.1, name: 'SkiErg', meters: '1000m', intensity: String(intensita - 1) },
      { id: 4.2, name: 'Sled Push', meters: '50m', kg: '125', intensity: String(intensita) },
    ] },
    { id: 3.3, type: 'For Time', params: { rounds: '3' }, exercises: [
      { id: 5.1, name: 'Wall Balls', reps: '25', kg: '9', intensity: String(intensita) },
      { id: 5.2, name: 'Farmers Carry', meters: '100m', kg: '24', intensity: String(intensita) },
      { id: 5.3, name: 'Rowing', meters: '500m', intensity: String(intensita) },
    ] },
  ],
})

const corsa = (intensita) => ({
  category: 'Running', intensity: String(intensita),
  steps: [
    { id: 6.1, type: 'warmup', duration: '10 min', pace: 'Z1', intensity: '3' },
    { id: 6.2, type: 'repeat', rounds: '6', runDuration: '800m', runPace: '4:00 /km',
      runIntensity: String(intensita), recDuration: '2 min', recPace: 'Camminata', recIntensity: '2' },
    { id: 6.3, type: 'cooldown', duration: '8 min', pace: 'Z1', intensity: '2' },
  ],
})

// Una scheda Gym (13/10/2026): due gruppi, la forma di CLAUDE.md §5.
const gym = (intensita) => ({
  category: 'Gym', intensity: String(intensita),
  gym: [
    { id: 7.1, fase: 'principale', serie: '4', recupero: '2:00', note: '', esercizi: [
      { id: 7.2, name: 'Squat con bilanciere', reps: '6', kg: '80 kg', rir: '2', cadenza: '', notes: '' },
    ] },
    { id: 7.3, fase: 'principale', serie: '3', recupero: '1:30', note: '', esercizi: [
      { id: 7.4, name: 'Panca piana con bilanciere', reps: '8', kg: '60 kg', rir: '2', cadenza: '', notes: '' },
      { id: 7.5, name: 'Trazioni alla sbarra', reps: 'Max', kg: '', rir: '1', cadenza: '', notes: '' },
    ] },
  ],
})

const W = (id, title, giorniFa, sections) => ({
  id, title, date: giorno(-giorniFa), sections, coach_notes: '',
  created_at: new Date(Date.now() - giorniFa * 86400000).toISOString(),
})

const workouts = () => [
  W('w-scarico', 'Scarico rigenerante', 1, emom(15, 3)),
  W('w-leggero', 'Hyrox leggero · richiamo', 3, emom(20, 4)),
  W('w-medio', 'Hyrox medio · soglia', 5, emom(30, 6)),
  W('w-forte', 'Hyrox forte · EMOM 40', 8, emom(40, 8)),
  W('w-lungo', 'Hyrox lungo · endurance', 11, emom(50, 8)),
  W('w-massimale', 'Hyrox massimale · test', 2, emom(60, 9)),
  W('w-completo', 'Hyrox completo · simulazione gara', 6, hyroxCompleto(9)),
  W('w-completo2', 'Hyrox completo · sled e carry', 14, hyroxCompleto(7)),
  W('w-corsa', 'Ripetute 6×800', 4, corsa(8)),
  W('w-corsa2', 'Fondo lento 12 km', 9, corsa(5)),
  W('w-libero', 'Allenamento libero · mobilità', 7, { category: 'Custom', isAutonomous: true }),
  W('w-gym', 'Forza · gambe e spinta', 2, gym(7)),
  W('w-gara-mezza', 'Mezza maratona di Firenze', -46, { category: 'Event', isEvent: true, isAutonomous: true }),
  W('w-gara', 'Hyrox Milano', -30, { category: 'Event', isEvent: true, isAutonomous: true }),
  // Una gara HYROX già corsa e senza tempo: la Home di Sara chiede «com'è
  // andata?» e la scheda trova il tempo finto di `risultatoFinto` (supabaseDemo.js).
  W('w-gara-torino', 'HYROX Turin', 3, {
    category: 'Event', isEvent: true, isAutonomous: true,
    hyrox: { id: 'd9', codice: 'TRN', url: 'https://hyrox.com/find-my-race/', dal: giorno(-3), al: giorno(-3), citta: 'Turin', paese: 'IT', immagine: '' },
  }),
]

// ── gli atleti ──────────────────────────────────────────────────────────────

const A = (id, name, surname, extra = {}) => ({
  id, name, surname, birth_date: '1995-04-12', weight: '74', height: '178',
  photo_url: null, notes: '', instagram_url: null, strava_url: null, deleted_at: null,
  ...extra,
})

const atleti = () => [
  A(COACH, 'Federico', 'Leo'),                               // il coach, nascosto dalla rubrica
  A('coach-demo', 'Coach', 'Demo'),                          // il coach finto (VITE_DEMO_RUOLO=coach): fuori dalle rubriche, ma ProtectedRoute vuole la riga
  A('at-marco', 'Marco', 'Rossi'),                           // → salto di carico su un workout pesante
  A('at-luca', 'Luca', 'Bianchi'),                           // → seduta dura il giorno prima/dopo
  A('at-giulia', 'Giulia', 'Neri'),                          // → bias: segna 8 dove il coach prevede 6
  A('at-andrea', 'Andrea', 'Conti'),                         // → aderenza bassa
  A('at-sara', 'Sara', 'Villa'),                             // → ha già un allenamento oggi
  A('at-paolo', 'Paolo', 'Ferri'),                           // → storico insufficiente
  A('at-chiara', 'Chiara', 'Fabbri',
    { notes: `[PAUSA: ${giorno(-13)}]\nCi risentiamo dopo le vacanze` }), // → in pausa
  A('at-elena', 'Elena', 'Moretti'),                         // → nessun avviso (il silenzio)
  A('at-davide', 'Davide', 'Ricci'),                         // → rientro dopo 9 giorni
  A('at-sofia', 'Sofia', 'Greco'),                           // → atleta nuova, nessuna seduta
]

// ── le assegnazioni ─────────────────────────────────────────────────────────

let seq = 0
const AW = (athlete_id, workout_id, completed_date, stato, rpe, testo) => ({
  id: `aw-${++seq}`, athlete_id, workout_id, completed_date,
  status: stato,
  notes: stato === 'completed' && rpe != null
    ? `[RPE: ${rpe}/10]\n${testo || ''}`
    : (testo || ''),
  voice_note_url: null,
})

/** Tre sedute a settimana, per le quattro settimane prima di questa. */
const regolare = (atleta, workout, rpe, quante = 3, settimane = [-4, -3, -2, -1]) => {
  const fuori = []
  const giorni = [0, 2, 4].slice(0, quante)
  for (const s of settimane) for (const g of giorni)
    fuori.push(AW(atleta, workout, nellaSettimana(s, g), 'completed', rpe))
  return fuori
}

// ── Le note che diventano dati («Dalle note», 09/10/2026) ───────────────────
// Qui non c'è un'IA: le «risposte» sono scritte a mano (PROPOSTE_DEMO) e poi
// passano da `validaEstrazione`, la stessa regola del server. Così la demo non
// mostra niente che la funzione vera scarterebbe, e un test lo verifica
// (src/__tests__/demoNoteEstratte.test.js).
const ELENA_1 = 'Wall balls da 9kg chiuse in 0:58 ogni minuto, bella seduta'
const ELENA_2 = 'Wall balls in 0:54, meglio di due settimane fa'
const ELENA_3 = 'Wall balls in 0:50! Burpees broad jump ridotti a 8 per il fiato'
const GIULIA_1 = 'Troppo dura, saltati gli ultimi burpees broad jump'
const GIULIA_2 = 'Giusta oggi, tutto fatto'
const GIULIA_3 = 'Burpees broad jump saltati di nuovo, settimana pesante al lavoro'
const LUCA_1 = 'Stanco morto, ma chiusa'
const LUCA_2 = 'Motivazione alta oggi'
const LUCA_3 = 'Gambe a pezzi dopo il viaggio di ieri'

export const PROPOSTE_DEMO = {
  [ELENA_1]: {
    risultati: [
      { esercizio: 'Wall Balls', misura: 'tempo', grezzo: '0:58', citazione: 'Wall balls da 9kg chiuse in 0:58' },
      { esercizio: 'Wall Balls', misura: 'kg', grezzo: '9kg', citazione: 'Wall balls da 9kg' },
    ],
    sensazioni: { seduta: { difficolta: 'giusta', citazioni: ['bella seduta'] } },
  },
  [ELENA_2]: { risultati: [{ esercizio: 'Wall Balls', misura: 'tempo', grezzo: '0:54', citazione: 'Wall balls in 0:54' }] },
  [ELENA_3]: {
    risultati: [{ esercizio: 'Wall Balls', misura: 'tempo', grezzo: '0:50', citazione: 'Wall balls in 0:50' }],
    sensazioni: { modifiche: [{ tipo: 'ridotto', esercizio: 'Burpees Broad Jump', citazione: 'Burpees broad jump ridotti a 8' }] },
  },
  [GIULIA_1]: {
    sensazioni: { seduta: { difficolta: 'troppo_dura', citazioni: ['Troppo dura'] },
      modifiche: [{ tipo: 'saltato', esercizio: 'Burpees Broad Jump', citazione: 'saltati gli ultimi burpees broad jump' }] },
  },
  [GIULIA_2]: { sensazioni: { seduta: { difficolta: 'giusta', citazioni: ['Giusta oggi'] } } },
  [GIULIA_3]: {
    stato: [{ fattore: 'lavoro', segno: -1, citazione: 'settimana pesante al lavoro' }],
    sensazioni: { modifiche: [{ tipo: 'saltato', esercizio: 'Burpees Broad Jump', citazione: 'Burpees broad jump saltati di nuovo' }] },
  },
  'Più dura di quanto sembrava': { sensazioni: { seduta: { difficolta: 'troppo_dura', citazioni: ['Più dura di quanto sembrava'] } } },
  [LUCA_1]: { stato: [{ fattore: 'stanchezza', segno: -1, citazione: 'Stanco morto' }] },
  [LUCA_2]: { stato: [{ fattore: 'motivazione', segno: 1, citazione: 'Motivazione alta' }] },
  [LUCA_3]: { stato: [
    { fattore: 'stanchezza', segno: -1, citazione: 'Gambe a pezzi' },
    { fattore: 'viaggio', segno: -1, citazione: 'dopo il viaggio di ieri' },
  ] },
  // Un giudizio su UN pezzo, non sulla seduta (sensazioni su due livelli, VERSIONE 3).
  'Sled pesantissimo': { sensazioni: { parti: [{ parte: 'sled', difficolta: 'troppo_dura', citazione: 'Sled pesantissimo' }] } },
  // Note che non dicono niente da estrarre: diventano estratti VUOTI, come
  // farebbe la funzione, e la copertura le conta come analizzate.
  'Tutto liscio': {},
  'Bene il ritmo': {},
  'Poi mi sono fermato': {},
}

/** Aggiunge un testo alla nota della seduta `indice` di una serie `regolare`. */
const conNote = (lista, testi) => {
  for (const [indice, testo] of Object.entries(testi)) lista[indice] = { ...lista[indice], notes: lista[indice].notes + testo }
  return lista
}

/** Gli estratti di tutte le note scritte, come li salverebbe `estrai-note`. */
const noteEstratte = (aws, ws) => aws
  .filter(a => a.status === 'completed' && testoPulito(a.notes))
  .map(a => {
    const testo = testoPulito(a.notes)
    const w = ws.find(x => x.id === a.workout_id)
    return {
      athlete_workout_id: a.id, athlete_id: a.athlete_id, data: a.completed_date,
      impronta: impronta(testo), versione: VERSIONE_ESTRAZIONE,
      estrazione: validaEstrazione(PROPOSTE_DEMO[testo] ?? {}, testo, eserciziDelWorkout(w?.sections)),
      creato_at: new Date().toISOString(),
    }
  })

const assegnazioni = () => conSettimanaPiena([
  // Marco: leggero e costante. Un workout massimale gli fa saltare il carico.
  ...regolare('at-marco', 'w-leggero', 4),
  AW('at-marco', 'w-leggero', nellaSettimana(0, 0), 'completed', 4, 'Tutto liscio'),

  // Luca: pesante e costante, settimana seguita. Ha una seduta dura ieri.
  // Le note di Luca: stanco due volte, una motivato (sezione «Dalle note»).
  ...conNote(regolare('at-luca', 'w-forte', 8), { 3: LUCA_2, 9: LUCA_1 }),
  AW('at-luca', 'w-forte', nellaSettimana(0, 0), 'completed', 8, LUCA_3),
  AW('at-luca', 'w-completo', giorno(-1), 'completed', 8, 'Sled pesantissimo'),

  // Giulia: il coach prevede 6, lei segna 8. È il bias.
  // Le note di Giulia: troppo dura, e i burpees saltati due volte.
  ...conNote(regolare('at-giulia', 'w-medio', 8, 2), { 0: GIULIA_1, 2: GIULIA_2, 4: GIULIA_3 }),
  AW('at-giulia', 'w-medio', nellaSettimana(0, 0), 'completed', 8, 'Più dura di quanto sembrava'),

  // Andrea: due assegnati questa settimana, nessuno chiuso → aderenza bassa.
  // ⚠️ La seduta di domenica scorsa serve a NON farlo risultare «fermo»: il
  // rientro precede l'aderenza nell'ordine degli avvisi, e senza di essa la
  // riga direbbe un'altra cosa.
  ...regolare('at-andrea', 'w-medio', 6, 2),
  AW('at-andrea', 'w-medio', nellaSettimana(-1, 6), 'completed', 6),
  AW('at-andrea', 'w-medio', nellaSettimana(0, 0), 'pending'),
  AW('at-andrea', 'w-medio', nellaSettimana(0, 1), 'pending'),

  // Sara: ha già qualcosa OGGI, e qualcosa DOPO.
  // ⚠️ Il pending fra due giorni serve al recap post-allenamento: è l'unico
  // atleta su cui si vede la scheda «il prossimo» nella forma «assegnato».
  // Senza, chiudendo l'allenamento di oggi il recap cadrebbe sempre sul
  // ripiego «lo decidi tu», e quel ramo non sarebbe mai provato.
  ...regolare('at-sara', 'w-forte', 8),
  AW('at-sara', 'w-forte', nellaSettimana(0, 0), 'completed', 8),
  AW('at-sara', 'w-corsa', giorno(0), 'pending'),
  // Una corsa di ieri, già chiusa: l'attività Garmin di `attivitaGarmin` le si abbina.
  AW('at-sara', 'w-corsa', giorno(-1), 'completed', null),
  AW('at-sara', 'w-medio', giorno(2), 'pending'),
  AW('at-sara', 'w-gara-torino', giorno(-3), 'pending'),

  // Paolo: due sole sedute, tutte nella stessa settimana.
  AW('at-paolo', 'w-medio', giorno(-4), 'completed', 7),
  AW('at-paolo', 'w-medio', giorno(-3), 'completed', 7, 'Bene il ritmo'),

  // Chiara: in pausa, con lo storico di prima.
  ...regolare('at-chiara', 'w-leggero', 5, 2, [-4, -3]),

  // Elena: tutto in ordine. Non deve comparire nessun avviso.
  // Le note di Elena: tre tempi sulle wall balls, sempre meglio.
  ...conNote(regolare('at-elena', 'w-lungo', 8), { 0: ELENA_1, 6: ELENA_2 }),
  AW('at-elena', 'w-lungo', nellaSettimana(0, 0), 'completed', 8, ELENA_3),

  // Davide: fermo da nove giorni.
  ...regolare('at-davide', 'w-forte', 7, 3, [-4, -3]),
  AW('at-davide', 'w-forte', giorno(-9), 'completed', 7, 'Poi mi sono fermato'),
  AW('at-davide', 'w-medio', giorno(-2), 'pending'),

  // Sofia: appena arrivata, niente storico. Un assegnato la settimana prossima.
  // ⚠️ E uno OGGI: è l'unico modo di provare il ramo «primo allenamento di
  // sempre» del recap, che è anche quello che un utente nuovo vede per primo.
  AW('at-sofia', 'w-leggero', giorno(0), 'pending'),
  AW('at-sofia', 'w-leggero', nellaSettimana(1, 1), 'pending'),

  // Qualcosa già programmato per la settimana prossima, così «copertura» vive.
  AW('at-marco', 'w-medio', nellaSettimana(1, 1), 'pending'),
  AW('at-luca', 'w-lungo', nellaSettimana(1, 2), 'pending'),

  // La gara in calendario: quattro atleti sulla stessa gara, e una seconda.
  AW('at-marco', 'w-gara', giorno(30), 'pending'),
  AW('at-luca', 'w-gara', giorno(30), 'pending'),
  AW('at-giulia', 'w-gara', giorno(30), 'pending'),
  AW('at-sara', 'w-gara', giorno(30), 'pending'),
  AW('at-andrea', 'w-gara-mezza', giorno(46), 'pending'),

])

/** Aggiunge la settimana piena senza raddoppiare un giorno già assegnato. */
const conSettimanaPiena = (base) => {
  const presi = new Set(base.map(a => `${a.athlete_id}|${a.completed_date}`))
  return [...base, ...settimanaPiena()
    .filter(x => !presi.has(`${x.atleta}|${x.data}`))
    .map(x => AW(x.atleta, x.workout, x.data, 'pending'))]
}

/**
 * La settimana piena (14/10/2026, Home coach): da OGGI ai sei giorni dopo,
 * un programma vero per ogni atleta seguito — così la griglia della Home e del
 * calendario team non è fatta di «+». Solo sedute DA FARE: il passato resta
 * quello scritto sopra, che regge gli scenari delle altre schermate (Davide
 * fermo, Andrea con aderenza bassa, Paolo con poco storico).
 * Il piano è per giorno della settimana (0 = lunedì); `null` è riposo, e un
 * giorno già assegnato sopra non si raddoppia. Chiara è in pausa: niente.
 */
const PIANO = {
  'at-marco': ['w-leggero', 'w-corsa2', 'w-medio', null, 'w-gym', 'w-completo2', null],
  'at-luca': ['w-forte', 'w-corsa', 'w-gym', 'w-completo', null, 'w-lungo', null],
  'at-giulia': ['w-medio', null, 'w-corsa2', 'w-medio', 'w-gym', null, 'w-corsa2'],
  'at-andrea': ['w-medio', 'w-medio', 'w-corsa', null, 'w-corsa2', null, 'w-corsa2'],
  'at-sara': ['w-forte', 'w-corsa', 'w-medio', 'w-gym', null, 'w-completo', null],
  'at-paolo': [null, 'w-medio', null, 'w-gym', null, 'w-leggero', null],
  'at-elena': ['w-lungo', 'w-gym', 'w-corsa2', null, 'w-medio', 'w-libero', null],
  'at-davide': ['w-forte', null, 'w-leggero', 'w-corsa2', null, 'w-gym', null],
  'at-sofia': ['w-leggero', null, 'w-leggero', 'w-libero', null, 'w-corsa2', null],
}
const settimanaPiena = () => {
  const fuori = []
  for (let scarto = 0; scarto < 7; scarto++) {
    const data = giorno(scarto)
    const settimana = (new Date(`${data}T12:00:00`).getDay() + 6) % 7
    for (const [atleta, piano] of Object.entries(PIANO)) {
      const workout = piano[settimana]
      if (workout) fuori.push({ atleta, workout, data })
    }
  }
  return fuori
}

// ── il resto ────────────────────────────────────────────────────────────────

const notifications = [
  { id: 'n1', user_id: COACH, title: 'Allenamento completato',
    message: 'Giulia Neri ha completato «Hyrox medio · soglia»', route: '/athletes/at-giulia',
    is_read: false, created_at: new Date(Date.now() - 3600000).toISOString() },
  { id: 'n2', user_id: COACH, title: 'Nuova nota',
    message: 'Marco Rossi ha lasciato una nota', route: '/athletes/at-marco',
    is_read: false, created_at: new Date(Date.now() - 7200000).toISOString() },
  { id: 'n3', user_id: COACH, title: 'Allenamento completato',
    message: 'Elena Moretti ha completato «Hyrox lungo · endurance»', route: '/athletes/at-elena',
    is_read: true, created_at: new Date(Date.now() - 86400000).toISOString() },
]

const invitation_codes = [
  { id: 'i1', code: 'FLEO-2026-AAA', is_active: true, created_by: COACH,
    used_by: null, used_by_email: null, used_at: null, created_at: new Date().toISOString() },
  { id: 'i2', code: 'FLEO-2026-BBB', is_active: true, created_by: COACH,
    used_by: null, used_by_email: null, used_at: null, created_at: new Date().toISOString() },
  { id: 'i3', code: 'FLEO-2026-CCC', is_active: false, created_by: COACH,
    used_by: 'at-sofia', used_by_email: 'sofia@esempio.invalid',
    used_at: giorno(-20), created_at: new Date(Date.now() - 30 * 86400000).toISOString() },
]

const personal_records = [
  { id: 'p1', athlete_id: 'at-marco', exercise: '1 km', value: '3:42', date: giorno(-20) },
  { id: 'p2', athlete_id: 'at-marco', exercise: 'Sled Push 50m', value: '38"', date: giorno(-40) },
  { id: 'p3', athlete_id: 'at-luca', exercise: '5 km', value: '19:10', date: giorno(-12) },
]

// «Come stai oggi» (13/10/2026): cinque settimane di risposte, un giorno sì e
// uno no. Luca peggiora (dorme poco, stress che sale) — è il caso che il coach
// deve vedere in Analisi. Sara non ha risposto oggi: in `demo:atleta` la
// domanda compare prima di «Avvia allenamento».
const come_stai = () => {
  const profili = {
    'at-marco': (i) => ({ sonno: 4, energia: 4 + (i % 2), dolori: 3 + (i % 3 === 0 ? 1 : 0), stress: 4 }),
    'at-luca': (i) => ({ sonno: Math.max(1, 4 - Math.floor(i / 5)), energia: Math.max(2, 4 - Math.floor(i / 6)), dolori: 3, stress: Math.max(1, 4 - Math.floor(i / 4)) }),
    'at-giulia': (i) => ({ sonno: 3 + (i % 2), energia: 4, dolori: 2 + (i % 2), stress: 3 }),
    'at-elena': () => ({ sonno: 5, energia: 4, dolori: 4, stress: 5 }),
  }
  const righe = []
  for (const [athlete_id, valori] of Object.entries(profili)) {
    for (let i = 0; i < 18; i++) {
      // i = 0 è la risposta più vecchia: Luca peggiora andando verso oggi.
      righe.push({ id: `cs-${athlete_id}-${i}`, athlete_id, giorno: giorno(-(35 - i * 2)), ...valori(i) })
    }
  }
  // Oggi (14/10/2026, Home coach): Sara arriva alle ripetute dopo una notte
  // pessima — è il riquadro rosso di «Oggi» — e Sofia sta bene.
  righe.push({ id: 'cs-oggi-sara', athlete_id: 'at-sara', giorno: giorno(0), sonno: 1, energia: 2, dolori: 3, stress: 3 })
  righe.push({ id: 'cs-oggi-sofia', athlete_id: 'at-sofia', giorno: giorno(0), sonno: 4, energia: 4, dolori: 5, stress: 4 })
  // Settimana piena: quasi tutti rispondono. Giulia ha dormito poco ma oggi ha
  // un allenamento leggero — è l'avviso arancione, non il riquadro rosso.
  righe.push({ id: 'cs-oggi-marco', athlete_id: 'at-marco', giorno: giorno(0), sonno: 4, energia: 5, dolori: 4, stress: 4 })
  righe.push({ id: 'cs-oggi-luca', athlete_id: 'at-luca', giorno: giorno(0), sonno: 3, energia: 3, dolori: 3, stress: 3 })
  righe.push({ id: 'cs-oggi-giulia', athlete_id: 'at-giulia', giorno: giorno(0), sonno: 2, energia: 3, dolori: 4, stress: 3 })
  righe.push({ id: 'cs-oggi-elena', athlete_id: 'at-elena', giorno: giorno(0), sonno: 5, energia: 5, dolori: 4, stress: 5 })
  righe.push({ id: 'cs-oggi-paolo', athlete_id: 'at-paolo', giorno: giorno(0), sonno: 4, energia: 4, dolori: 4, stress: 3 })
  return righe
}

// «Dal coach» (15/10/2026): quattro messaggi con date relative a oggi. L'utente
// demo risulta iscritto 20 giorni fa (`created_at` in supabaseDemo.js): l'avviso
// di 30 giorni fa è PRECEDENTE all'iscrizione e non fissato, quindi la bacheca
// dell'atleta lo nasconde (il fissato resta visibile a tutti).
const fa = (giorni, ore = 0) => new Date(Date.now() - (giorni * 24 + ore) * 3600000).toISOString()
const messaggi_coach = () => [
  { id: 'mc-1', testo: 'Benvenuti nella bacheca «Dal coach»: qui trovate gli avvisi per tutti. Le gare del mese sono in calendario, controllate sempre l\'orario di ritrovo.', fissato: true, autore: COACH, creato_at: fa(28), modificato_at: null },
  { id: 'mc-2', testo: 'Avviso di una volta: la palestra resta chiusa per lavori fino a fine mese. Gli allenamenti si fanno all\'aperto.', fissato: false, autore: COACH, creato_at: fa(30), modificato_at: null },
  { id: 'mc-3', testo: 'Questa settimana si cambia: lunedì ripetute corte, giovedì lungo lento. Dormite, mangiate, e scrivetemi se qualcosa non torna.', fissato: false, autore: COACH, creato_at: fa(6), modificato_at: null },
  { id: 'mc-4', testo: 'Ottimo lavoro a tutti nella simulazione di sabato. Domani riposo vero: niente corsetta «per sicurezza».', fissato: false, autore: COACH, creato_at: fa(0, 5), modificato_at: fa(0, 2) },
]

// «Modelli di blocco» del coach: UN blocco, UNA fase o UN gruppo (CLAUDE.md §5),
// senza nessun `id` interno e i gruppi Gym senza `fase`.
const modelli_blocco = () => [
  { id: 'mb-1', coach: COACH, categoria: 'Hyrox', nome: 'EMOM 10′ Wall Balls e Burpees',
    contenuto: { type: 'EMOM', params: { interval: '1:00', rounds: '10' }, notes: '',
      exercises: [
        { name: 'Wall Balls', reps: '12', meters: '-', kg: '9', intensity: '7', notes: '' },
        { name: 'Burpees', reps: '8', meters: '-', kg: '', intensity: '8', notes: '' },
      ] },
    creato_at: fa(20), modificato_at: null },
  { id: 'mb-2', coach: COACH, categoria: 'Hyrox', nome: 'Riscaldamento 8 minuti',
    contenuto: { type: 'WarmUp', params: { duration: '8:00' }, notes: 'Progressivo, senza arrivare a fiato corto.', exercises: [] },
    creato_at: fa(18), modificato_at: null },
  { id: 'mb-3', coach: COACH, categoria: 'Running', nome: 'Ripetute 8 × 400m',
    contenuto: { type: 'repeat', rounds: '8', runDuration: '400m', runPace: 'Z4', runIntensity: '8',
      recDuration: '1 min', recPace: 'Camminata', recIntensity: '3', notes: '' },
    creato_at: fa(15), modificato_at: null },
  { id: 'mb-4', coach: COACH, categoria: 'Running', nome: 'Riscaldamento 15 min',
    contenuto: { type: 'warmup', duration: '15 min', pace: 'Z2', intensity: '4', notes: '' },
    creato_at: fa(15), modificato_at: null },
  { id: 'mb-5', coach: COACH, categoria: 'Gym', nome: 'Squat 4 × 8',
    contenuto: { serie: '4', recupero: '2:00', note: '',
      esercizi: [{ name: 'Squat con bilanciere', reps: '8', kg: '80 kg', rir: '2', notes: '' }] },
    creato_at: fa(10), modificato_at: null },
  { id: 'mb-6', coach: COACH, categoria: 'Gym', nome: 'Superserie panca e rematore',
    contenuto: { serie: '3', recupero: '1:30', note: '',
      esercizi: [
        { name: 'Panca piana con bilanciere', reps: '10', kg: '60 kg', notes: '' },
        { name: 'Rematore con bilanciere', reps: '10', kg: '50 kg', notes: '' },
      ] },
    creato_at: fa(9), modificato_at: null },
]

/** Chi è staff (D1 dello spec multi-coach) e il coach finto dell'ambiente di prova. */
export const COACH_DEMO = { id: 'coach-demo', email: 'coach.demo@fleofit.it' }
const staff = () => [
  { email: 'coaching@federicoleo.it', ruolo: 'admin' },
  { email: 'alessandro.patrone@hotmail.it', ruolo: 'admin' },
  { email: 'federico.leo88@gmail.com', ruolo: 'admin' },
  { email: 'demo@fleofit.it', ruolo: 'admin' },
  { email: 'federico_leo@hotmail.it', ruolo: 'coach' },
  { email: COACH_DEMO.email, ruolo: 'coach' },
]
// Al coach finto tre atleti. ⚠️ Il filtro RLS NON esiste nel finto database:
// serve a vedere l'interfaccia del coach, non la sicurezza.
const coach_atleti = () => ['at-sara', 'at-luca', 'at-giulia']
  .map(athlete_id => ({ athlete_id, coach_id: COACH_DEMO.id, creato_at: fa(60) }))

// «Da Garmin» (Fase 1, 28/10/2026): due attività INVENTATE per Sara, quella del
// `demo:atleta` di default. Una abbinata da sola alla corsa di ieri (card «Da
// Garmin» nella scheda) e una libera in un sabato senza allenamento (voce grigia
// nel calendario, con «Abbina a…»). Nessun dato vero.
const garmin_attivita = (aws) => {
  const corsaDiIeri = aws.find(a => a.athlete_id === 'at-sara' && a.workout_id === 'w-corsa' && a.completed_date === giorno(-1))
  const sabato = nellaSettimana(-1, 5)
  const base = { athlete_id: 'at-sara', creato_at: new Date().toISOString() }
  return [
    { ...base, id: 'ga-1', garmin_id: 'demo-1', giorno: giorno(-1), inizio: `${giorno(-1)}T07:10:00Z`,
      tipo: 'RUNNING', durata_s: 2700, distanza_m: 8400,
      dati: { dispositivo: 'Forerunner 265', fc_media: 158, fc_max: 176, velocita_media_ms: 3.11, dislivello_m: 42, calorie: 590, manuale: false },
      athlete_workout_id: corsaDiIeri?.id ?? null, abbinamento: 'auto' },
    { ...base, id: 'ga-2', garmin_id: 'demo-2', giorno: sabato, inizio: `${sabato}T08:30:00Z`,
      tipo: 'RUNNING', durata_s: 1800, distanza_m: 5000,
      dati: { dispositivo: 'Forerunner 265', fc_media: 142, fc_max: 158, velocita_media_ms: 2.78, calorie: 380, manuale: false },
      athlete_workout_id: null, abbinamento: null },
  ]
}

// «Recupero» (Fase 2, 29/10/2026): 35 giorni INVENTATI per Sara, normali, poi le
// ultime 3 notti storte (HRV -15%, sonno 5 h 30', FC a riposo +6) che finiscono
// IERI: così nella demo si vedono la card «Recupero» e i segnali in «Da guardare».
// Le date sono relative a oggi, quindi il segnale c'è a ogni azzeramento.
const garmin_giornate = () => {
  const righe = []
  for (let i = 38; i >= 1; i--) {
    const storta = i <= 3
    const v = (i * 7) % 5 - 2 // piccola variazione, senza caso
    righe.push({
      athlete_id: 'at-sara', giorno: giorno(-i), aggiornato_at: new Date().toISOString(),
      giornata: { passi: 8200 + v * 400, calorie: 520, minuti_intensi: 34, fc_riposo: storta ? 58 : 52 + (v > 0 ? 1 : 0), stress_medio: 31, body_battery_carica: 62, body_battery_scarica: 58 },
      sonno: { ore: storta ? 5.5 : 7.4 + v * 0.1, profondo_min: 70, leggero_min: 230, rem_min: 95, sveglio_min: 20, punteggio: storta ? 58 : 81, qualita: storta ? 'POOR' : 'GOOD' },
      hrv: { media_notte: storta ? 51 : 60 + v, picco_5min: storta ? 74 : 88 },
    })
  }
  return righe
}

/** Il database iniziale. Chiamata a ogni azzeramento, così le date si rifanno. */
export function semi() {
  // Una volta sola: gli id delle assegnazioni avanzano a ogni chiamata, e gli
  // estratti devono puntare a QUESTE.
  const aws = assegnazioni()
  const ws = workouts()
  return {
    __versione: VERSIONE_SEME,
    athletes: atleti().map(a => ({ ...a })),
    workouts: ws.map(w => ({ ...w })),
    athlete_workouts: aws.map(a => ({ ...a })),
    note_estratte: noteEstratte(aws, ws),
    notifications: notifications.map(n => ({ ...n })),
    invitation_codes: invitation_codes.map(c => ({ ...c })),
    personal_records: personal_records.map(p => ({ ...p })),
    come_stai: come_stai(),
    garmin_attivita: garmin_attivita(aws),
    garmin_giornate: garmin_giornate(),
    messaggi_coach: messaggi_coach(),
    modelli_blocco: modelli_blocco(),
    staff: staff(),
    coach_atleti: coach_atleti(),
    push_subscriptions: [],
    tv_sessions: [],
  }
}
