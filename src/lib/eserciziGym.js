/**
 * La libreria degli esercizi della categoria Gym (13/10/2026).
 *
 * Richiesta del committente: «gli esercizi più famosi e i macchinari, non
 * brandizzati, generici». Quindi «Chest press» e non il nome di un produttore,
 * «Leg press 45°» e non il modello. I nomi sono quelli delle schede italiane:
 * italiano dove la palestra parla italiano («Panca piana», «Alzate laterali»),
 * inglese dove in sala si dice in inglese («Lat machine», «Leg extension»,
 * «Hip thrust»).
 *
 * Ogni voce dice tre cose:
 * - `muscolo`: il gruppo, uno di `MUSCOLI` — è il filtro del picker e il modo
 *   in cui il nome automatico capisce che seduta è («Push», «Leg day»);
 * - `misura`: `'reps'` (il default) o `'tempo'` — plank, cardio e mobilità si
 *   misurano in secondi o minuti, non in ripetizioni;
 * - `carico`: `false` per gli esercizi a corpo libero, così il builder non
 *   propone un peso a chi fa un plank.
 *
 * ⚠️ Il nome è il dato che finisce in `workouts.sections.gym`, e l'IA lo deve
 * scrivere uguale: `trovaEsercizioGym` riporta alla voce di qui le varianti
 * (maiuscole, nomi inglesi da app americana). Rinominare una voce rende
 * «custom» gli esercizi già salvati con il nome di prima.
 */

export const MUSCOLI = [
  'Petto', 'Dorso', 'Spalle', 'Bicipiti', 'Tricipiti', 'Quadricipiti',
  'Femorali e glutei', 'Polpacci', 'Addome', 'Cardio', 'Mobilità',
]

const v = (muscolo, nome, extra = {}) => ({ nome, muscolo, misura: 'reps', carico: true, ...extra })
const libero = { carico: false }
const aTempo = { misura: 'tempo', carico: false }

export const ESERCIZI_GYM = [
  // ── Petto ───────────────────────────────────────────────────────────────
  v('Petto', 'Panca piana con bilanciere'),
  v('Petto', 'Panca piana con manubri'),
  v('Petto', 'Panca inclinata con bilanciere'),
  v('Petto', 'Panca inclinata con manubri'),
  v('Petto', 'Panca declinata con bilanciere'),
  v('Petto', 'Panca declinata con manubri'),
  v('Petto', 'Panca piana al multipower'),
  v('Petto', 'Panca inclinata al multipower'),
  v('Petto', 'Chest press'),
  v('Petto', 'Chest press inclinata'),
  v('Petto', 'Croci con manubri'),
  v('Petto', 'Croci su panca inclinata'),
  v('Petto', 'Croci ai cavi alti'),
  v('Petto', 'Croci ai cavi bassi'),
  v('Petto', 'Croci ai cavi'),
  v('Petto', 'Pectoral machine'),
  v('Petto', 'Pullover con manubrio'),
  v('Petto', 'Dip alle parallele', libero),
  v('Petto', 'Piegamenti', libero),
  v('Petto', 'Piegamenti inclinati', libero),
  v('Petto', 'Piegamenti declinati', libero),

  // ── Dorso ───────────────────────────────────────────────────────────────
  v('Dorso', 'Trazioni alla sbarra', libero),
  v('Dorso', 'Trazioni presa inversa', libero),
  v('Dorso', 'Trazioni zavorrate'),
  v('Dorso', 'Trazioni assistite'),
  v('Dorso', 'Lat machine avanti'),
  v('Dorso', 'Lat machine presa stretta'),
  v('Dorso', 'Lat machine presa inversa'),
  v('Dorso', 'Lat machine monolaterale'),
  v('Dorso', 'Pulley basso'),
  v('Dorso', 'Pulley presa larga'),
  v('Dorso', 'Pulley monolaterale'),
  v('Dorso', 'Rematore con bilanciere'),
  v('Dorso', 'Rematore con manubrio'),
  v('Dorso', 'Rematore su panca inclinata'),
  v('Dorso', 'T-bar row'),
  v('Dorso', 'Row machine'),
  v('Dorso', 'Low row machine'),
  v('Dorso', 'Pull down a braccia tese'),
  v('Dorso', 'Rematore inverso', libero),
  v('Dorso', 'Stacco da terra'),
  v('Dorso', 'Hyperextension'),
  v('Dorso', 'Scrollate con bilanciere'),
  v('Dorso', 'Scrollate con manubri'),

  // ── Spalle ──────────────────────────────────────────────────────────────
  v('Spalle', 'Military press'),
  v('Spalle', 'Lento avanti con manubri'),
  v('Spalle', 'Lento avanti al multipower'),
  v('Spalle', 'Shoulder press'),
  v('Spalle', 'Arnold press'),
  v('Spalle', 'Landmine press'),
  v('Spalle', 'Alzate laterali con manubri'),
  v('Spalle', 'Alzate laterali ai cavi'),
  v('Spalle', 'Alzate laterali alla macchina'),
  v('Spalle', 'Alzate frontali'),
  v('Spalle', 'Alzate posteriori a busto flesso'),
  v('Spalle', 'Croci inverse alla macchina'),
  v('Spalle', 'Face pull'),
  v('Spalle', 'Tirate al mento'),
  v('Spalle', 'Extrarotazioni ai cavi'),

  // ── Bicipiti ────────────────────────────────────────────────────────────
  v('Bicipiti', 'Curl con bilanciere'),
  v('Bicipiti', 'Curl con bilanciere EZ'),
  v('Bicipiti', 'Curl con manubri'),
  v('Bicipiti', 'Curl alternato'),
  v('Bicipiti', 'Curl a martello'),
  v('Bicipiti', 'Curl su panca inclinata'),
  v('Bicipiti', 'Curl alla panca Scott'),
  v('Bicipiti', 'Curl concentrato'),
  v('Bicipiti', 'Curl ai cavi'),
  v('Bicipiti', 'Curl con corda ai cavi'),
  v('Bicipiti', 'Curl alla macchina'),
  v('Bicipiti', 'Curl inverso'),

  // ── Tricipiti ───────────────────────────────────────────────────────────
  v('Tricipiti', 'French press con bilanciere EZ'),
  v('Tricipiti', 'French press con manubri'),
  v('Tricipiti', 'Push down ai cavi'),
  v('Tricipiti', 'Push down con corda'),
  v('Tricipiti', 'Estensioni sopra la testa con manubrio'),
  v('Tricipiti', 'Estensioni sopra la testa ai cavi'),
  v('Tricipiti', 'Kickback con manubrio'),
  v('Tricipiti', 'Panca presa stretta'),
  v('Tricipiti', 'Dip tra due panche', libero),
  v('Tricipiti', 'Dip machine'),
  v('Tricipiti', 'Tricipiti alla macchina'),

  // ── Quadricipiti ────────────────────────────────────────────────────────
  v('Quadricipiti', 'Squat con bilanciere'),
  v('Quadricipiti', 'Front squat'),
  v('Quadricipiti', 'Squat al multipower'),
  v('Quadricipiti', 'Goblet squat'),
  v('Quadricipiti', 'Hack squat'),
  v('Quadricipiti', 'Pendulum squat'),
  v('Quadricipiti', 'Belt squat'),
  v('Quadricipiti', 'Leg press'),
  v('Quadricipiti', 'Leg press 45°'),
  v('Quadricipiti', 'Leg extension'),
  v('Quadricipiti', 'Affondi con manubri'),
  v('Quadricipiti', 'Affondi camminati'),
  v('Quadricipiti', 'Affondi indietro'),
  v('Quadricipiti', 'Affondi al multipower'),
  v('Quadricipiti', 'Squat bulgaro'),
  v('Quadricipiti', 'Step up su panca'),
  v('Quadricipiti', 'Sissy squat', libero),
  v('Quadricipiti', 'Squat a corpo libero', libero),
  v('Quadricipiti', 'Wall sit', aTempo),

  // ── Femorali e glutei ───────────────────────────────────────────────────
  v('Femorali e glutei', 'Stacco rumeno'),
  v('Femorali e glutei', 'Stacco rumeno con manubri'),
  v('Femorali e glutei', 'Stacco a gambe tese'),
  v('Femorali e glutei', 'Stacco sumo'),
  v('Femorali e glutei', 'Good morning'),
  v('Femorali e glutei', 'Leg curl sdraiato'),
  v('Femorali e glutei', 'Leg curl seduto'),
  v('Femorali e glutei', 'Leg curl in piedi'),
  v('Femorali e glutei', 'Nordic curl', libero),
  v('Femorali e glutei', 'Hip thrust con bilanciere'),
  v('Femorali e glutei', 'Hip thrust alla macchina'),
  v('Femorali e glutei', 'Glute bridge'),
  v('Femorali e glutei', 'Slanci ai cavi'),
  v('Femorali e glutei', 'Slanci alla macchina'),
  v('Femorali e glutei', 'Abductor machine'),
  v('Femorali e glutei', 'Adductor machine'),
  v('Femorali e glutei', 'Abduzioni ai cavi'),
  v('Femorali e glutei', 'Pull through ai cavi'),
  v('Femorali e glutei', 'Kettlebell swing'),

  // ── Polpacci ────────────────────────────────────────────────────────────
  v('Polpacci', 'Calf raise in piedi'),
  v('Polpacci', 'Calf raise seduto'),
  v('Polpacci', 'Calf alla leg press'),
  v('Polpacci', 'Calf al multipower'),
  v('Polpacci', 'Calf raise monopodalico'),

  // ── Addome ──────────────────────────────────────────────────────────────
  v('Addome', 'Crunch', libero),
  v('Addome', 'Crunch inverso', libero),
  v('Addome', 'Crunch ai cavi'),
  v('Addome', 'Crunch alla macchina'),
  v('Addome', 'Bicycle crunch', libero),
  v('Addome', 'Sit up', libero),
  v('Addome', 'Plank', aTempo),
  v('Addome', 'Plank laterale', aTempo),
  v('Addome', 'Hollow hold', aTempo),
  v('Addome', 'Sollevamento gambe alla sbarra', libero),
  v('Addome', 'Sollevamento gambe a terra', libero),
  v('Addome', 'Russian twist'),
  v('Addome', 'Rotella addominale', libero),
  v('Addome', 'Dead bug', libero),
  v('Addome', 'Bird dog', libero),
  v('Addome', 'Pallof press'),
  v('Addome', 'Woodchopper ai cavi'),
  v('Addome', 'Mountain climber', libero),

  // ── Cardio ──────────────────────────────────────────────────────────────
  v('Cardio', 'Tapis roulant', aTempo),
  v('Cardio', 'Camminata in pendenza', aTempo),
  v('Cardio', 'Cyclette', aTempo),
  v('Cardio', 'Ellittica', aTempo),
  v('Cardio', 'Vogatore', aTempo),
  v('Cardio', 'Stair climber', aTempo),
  v('Cardio', 'Salto della corda', aTempo),
  v('Cardio', 'Air bike', aTempo),

  // ── Mobilità ────────────────────────────────────────────────────────────
  v('Mobilità', 'Mobilità articolare', aTempo),
  v('Mobilità', 'Stretching', aTempo),
  v('Mobilità', 'Foam roller', aTempo),
  v('Mobilità', 'Rotazioni delle anche', libero),
  v('Mobilità', 'Cat-cow', libero),
  v('Mobilità', "World's greatest stretch", libero),
  v('Mobilità', 'Dislocazioni con elastico', libero),
  v('Mobilità', 'Attivazione glutei con elastico', libero),
]

const PER_NOME = new Map(ESERCIZI_GYM.map(e => [e.nome.toLowerCase(), e]))

/**
 * I nomi che un'IA, o un coach abituato a un'app americana, scrive al posto
 * dei nostri. Le chiavi sono già minuscole e senza trattini.
 */
const SINONIMI = {
  'bench press': 'Panca piana con bilanciere',
  'panca piana': 'Panca piana con bilanciere',
  'dumbbell bench press': 'Panca piana con manubri',
  'incline bench press': 'Panca inclinata con bilanciere',
  'panca inclinata': 'Panca inclinata con bilanciere',
  'incline dumbbell press': 'Panca inclinata con manubri',
  'decline bench press': 'Panca declinata con bilanciere',
  'dumbbell fly': 'Croci con manubri',
  'dumbbell flyes': 'Croci con manubri',
  'cable crossover': 'Croci ai cavi',
  'cable fly': 'Croci ai cavi',
  'pec deck': 'Pectoral machine',
  'push up': 'Piegamenti',
  'pushup': 'Piegamenti',
  'push ups': 'Piegamenti',
  'flessioni': 'Piegamenti',
  'dips': 'Dip alle parallele',
  'dip': 'Dip alle parallele',
  'pull up': 'Trazioni alla sbarra',
  'pull ups': 'Trazioni alla sbarra',
  'trazioni': 'Trazioni alla sbarra',
  'chin up': 'Trazioni presa inversa',
  'chin ups': 'Trazioni presa inversa',
  'lat pulldown': 'Lat machine avanti',
  'lat machine': 'Lat machine avanti',
  'seated cable row': 'Pulley basso',
  'cable row': 'Pulley basso',
  'pulley': 'Pulley basso',
  'barbell row': 'Rematore con bilanciere',
  'bent over row': 'Rematore con bilanciere',
  'dumbbell row': 'Rematore con manubrio',
  'rematore': 'Rematore con bilanciere',
  'straight arm pulldown': 'Pull down a braccia tese',
  'inverted row': 'Rematore inverso',
  'deadlift': 'Stacco da terra',
  'stacco': 'Stacco da terra',
  'back extension': 'Hyperextension',
  'shrug': 'Scrollate con manubri',
  'shrugs': 'Scrollate con manubri',
  'overhead press': 'Military press',
  'shoulder press machine': 'Shoulder press',
  'dumbbell shoulder press': 'Lento avanti con manubri',
  'lento avanti': 'Military press',
  'lateral raise': 'Alzate laterali con manubri',
  'lateral raises': 'Alzate laterali con manubri',
  'alzate laterali': 'Alzate laterali con manubri',
  'front raise': 'Alzate frontali',
  'rear delt fly': 'Alzate posteriori a busto flesso',
  'reverse pec deck': 'Croci inverse alla macchina',
  'upright row': 'Tirate al mento',
  'barbell curl': 'Curl con bilanciere',
  'ez bar curl': 'Curl con bilanciere EZ',
  'dumbbell curl': 'Curl con manubri',
  'hammer curl': 'Curl a martello',
  'preacher curl': 'Curl alla panca Scott',
  'concentration curl': 'Curl concentrato',
  'cable curl': 'Curl ai cavi',
  'skull crusher': 'French press con bilanciere EZ',
  'french press': 'French press con bilanciere EZ',
  'tricep pushdown': 'Push down ai cavi',
  'triceps pushdown': 'Push down ai cavi',
  'push down': 'Push down ai cavi',
  'pushdown': 'Push down ai cavi',
  'rope pushdown': 'Push down con corda',
  'overhead tricep extension': 'Estensioni sopra la testa con manubrio',
  'tricep kickback': 'Kickback con manubrio',
  'close grip bench press': 'Panca presa stretta',
  'squat': 'Squat con bilanciere',
  'back squat': 'Squat con bilanciere',
  'smith machine squat': 'Squat al multipower',
  'leg press 45': 'Leg press 45°',
  'lunges': 'Affondi con manubri',
  'lunge': 'Affondi con manubri',
  'affondi': 'Affondi con manubri',
  'walking lunges': 'Affondi camminati',
  'reverse lunge': 'Affondi indietro',
  'bulgarian split squat': 'Squat bulgaro',
  'step up': 'Step up su panca',
  'romanian deadlift': 'Stacco rumeno',
  'rdl': 'Stacco rumeno',
  'stiff leg deadlift': 'Stacco a gambe tese',
  'sumo deadlift': 'Stacco sumo',
  'lying leg curl': 'Leg curl sdraiato',
  'seated leg curl': 'Leg curl seduto',
  'leg curl': 'Leg curl sdraiato',
  'hip thrust': 'Hip thrust con bilanciere',
  'glute kickback': 'Slanci ai cavi',
  'cable kickback': 'Slanci ai cavi',
  'hip abduction': 'Abductor machine',
  'hip adduction': 'Adductor machine',
  'calf raise': 'Calf raise in piedi',
  'standing calf raise': 'Calf raise in piedi',
  'seated calf raise': 'Calf raise seduto',
  'calf': 'Calf raise in piedi',
  'cable crunch': 'Crunch ai cavi',
  'reverse crunch': 'Crunch inverso',
  'side plank': 'Plank laterale',
  'hanging leg raise': 'Sollevamento gambe alla sbarra',
  'leg raise': 'Sollevamento gambe a terra',
  'ab wheel': 'Rotella addominale',
  'ab rollout': 'Rotella addominale',
  'treadmill': 'Tapis roulant',
  'tapis': 'Tapis roulant',
  'exercise bike': 'Cyclette',
  'bike': 'Cyclette',
  'elliptical': 'Ellittica',
  'rowing': 'Vogatore',
  'rower': 'Vogatore',
  'row erg': 'Vogatore',
  'stairmaster': 'Stair climber',
  'jump rope': 'Salto della corda',
  'corda': 'Salto della corda',
  'assault bike': 'Air bike',
  'stretch': 'Stretching',
}

const pulisci = (nome) => String(nome ?? '').toLowerCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim()

/**
 * La voce della libreria per un nome scritto in qualunque modo, o `null`.
 * Una voce sconosciuta resta un esercizio «custom»: si salva com'è.
 */
export const trovaEsercizioGym = (nome) => {
  const chiave = pulisci(nome)
  if (!chiave) return null
  if (PER_NOME.has(chiave)) return PER_NOME.get(chiave)
  const sinonimo = SINONIMI[chiave] || SINONIMI[chiave.replace(/s$/, '')]
  return sinonimo ? PER_NOME.get(sinonimo.toLowerCase()) : null
}

/** La voce di un esercizio, o una voce «custom» che si misura a ripetizioni con il carico. */
export const voceGym = (nome) => trovaEsercizioGym(nome) || { nome: String(nome ?? '').trim(), muscolo: null, misura: 'reps', carico: true }

/** Gli esercizi che corrispondono a una ricerca e a un filtro di muscolo. */
export const cercaEserciziGym = (testo = '', muscolo = null) => {
  const parole = pulisci(testo).split(' ').filter(Boolean)
  return ESERCIZI_GYM.filter(e => (!muscolo || e.muscolo === muscolo)
    && parole.every(p => e.nome.toLowerCase().includes(p)))
}
