// I dati dell'ambiente di prova (src/supabaseDemo.js).
//
// ⚠️ Le date sono RELATIVE a oggi, non fisse: un seme con date scritte a mano
// invecchia, e dopo una settimana «questa settimana» è vuota e metà delle
// schermate non ha più niente da mostrare.
//
// Ogni atleta è costruito per far scattare un ramo diverso del modello del
// carico (CLAUDE.md §9-quatervicies). Il commento accanto al nome dice quale:
// se un giorno un ramo smette di comparire, si parte da lì.

export const VERSIONE_SEME = 4

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

const W = (id, title, giorniFa, sections) => ({
  id, title, date: giorno(-giorniFa), sections, coach_notes: '',
  created_at: new Date(Date.now() - giorniFa * 86400000).toISOString(),
})

const workouts = [
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
  W('w-gara', 'Hyrox Milano', -30, { category: 'Event', isEvent: true, isAutonomous: true }),
]

// ── gli atleti ──────────────────────────────────────────────────────────────

const A = (id, name, surname, extra = {}) => ({
  id, name, surname, birth_date: '1995-04-12', weight: '74', height: '178',
  photo_url: null, notes: '', instagram_url: null, strava_url: null, deleted_at: null,
  ...extra,
})

const atleti = [
  A(COACH, 'Federico', 'Leo'),                               // il coach, nascosto dalla rubrica
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

const assegnazioni = [
  // Marco: leggero e costante. Un workout massimale gli fa saltare il carico.
  ...regolare('at-marco', 'w-leggero', 4),
  AW('at-marco', 'w-leggero', nellaSettimana(0, 0), 'completed', 4, 'Tutto liscio'),

  // Luca: pesante e costante, settimana seguita. Ha una seduta dura ieri.
  ...regolare('at-luca', 'w-forte', 8),
  AW('at-luca', 'w-forte', nellaSettimana(0, 0), 'completed', 8),
  AW('at-luca', 'w-completo', giorno(-1), 'completed', 8, 'Sled pesantissimo'),

  // Giulia: il coach prevede 6, lei segna 8. È il bias.
  ...regolare('at-giulia', 'w-medio', 8, 2),
  AW('at-giulia', 'w-medio', nellaSettimana(0, 0), 'completed', 8, 'Più dura di quanto sembrava'),

  // Andrea: due assegnati questa settimana, nessuno chiuso → aderenza bassa.
  // ⚠️ La seduta di domenica scorsa serve a NON farlo risultare «fermo»: il
  // rientro precede l'aderenza nell'ordine degli avvisi, e senza di essa la
  // riga direbbe un'altra cosa.
  ...regolare('at-andrea', 'w-medio', 6, 2),
  AW('at-andrea', 'w-medio', nellaSettimana(-1, 6), 'completed', 6),
  AW('at-andrea', 'w-medio', nellaSettimana(0, 0), 'pending'),
  AW('at-andrea', 'w-medio', nellaSettimana(0, 1), 'pending'),

  // Sara: ha già qualcosa OGGI.
  ...regolare('at-sara', 'w-forte', 8),
  AW('at-sara', 'w-forte', nellaSettimana(0, 0), 'completed', 8),
  AW('at-sara', 'w-corsa', giorno(0), 'pending'),

  // Paolo: due sole sedute, tutte nella stessa settimana.
  AW('at-paolo', 'w-medio', giorno(-4), 'completed', 7),
  AW('at-paolo', 'w-medio', giorno(-3), 'completed', 7, 'Bene il ritmo'),

  // Chiara: in pausa, con lo storico di prima.
  ...regolare('at-chiara', 'w-leggero', 5, 2, [-4, -3]),

  // Elena: tutto in ordine. Non deve comparire nessun avviso.
  ...regolare('at-elena', 'w-lungo', 8),
  AW('at-elena', 'w-lungo', nellaSettimana(0, 0), 'completed', 8),

  // Davide: fermo da nove giorni.
  ...regolare('at-davide', 'w-forte', 7, 3, [-4, -3]),
  AW('at-davide', 'w-forte', giorno(-9), 'completed', 7, 'Poi mi sono fermato'),
  AW('at-davide', 'w-medio', giorno(-2), 'pending'),

  // Sofia: appena arrivata, niente storico. Un assegnato la settimana prossima.
  AW('at-sofia', 'w-leggero', nellaSettimana(1, 1), 'pending'),

  // Qualcosa già programmato per la settimana prossima, così «copertura» vive.
  AW('at-marco', 'w-medio', nellaSettimana(1, 1), 'pending'),
  AW('at-luca', 'w-lungo', nellaSettimana(1, 2), 'pending'),

  // La gara in calendario.
  AW('at-marco', 'w-gara', giorno(30), 'pending'),
]

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

/** Il database iniziale. Chiamata a ogni azzeramento, così le date si rifanno. */
export function semi() {
  return {
    __versione: VERSIONE_SEME,
    athletes: atleti.map(a => ({ ...a })),
    workouts: workouts.map(w => ({ ...w })),
    athlete_workouts: assegnazioni.map(a => ({ ...a })),
    notifications: notifications.map(n => ({ ...n })),
    invitation_codes: invitation_codes.map(c => ({ ...c })),
    personal_records: personal_records.map(p => ({ ...p })),
    push_subscriptions: [],
    tv_sessions: [],
  }
}
