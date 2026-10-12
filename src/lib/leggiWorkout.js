/**
 * Un workout SCRITTO — nelle Note del telefono, in un messaggio, su una
 * lavagna trascritta — trasformato nei blocchi del builder. Senza IA: sono
 * regole, una riga alla volta (12/10/2026, fase 1 di «Da foto o testo»).
 *
 * Il principio è lo stesso di tutta l'app: 🔴 NESSUN NUMERO INVENTATO.
 * - Un parametro che il testo non dice resta vuoto: il builder mostra il suo
 *   valore di ripiego e il coach lo vede da correggere.
 * - Una riga che non si capisce NON si butta: finisce nelle note del blocco in
 *   cui stava (o nelle note generali, se viene prima di ogni blocco), e
 *   l'anteprima la segna come «non riconosciuta».
 *
 * L'uscita ha la forma di `sections.blocks` / `sections.steps` senza gli `id`:
 * li rimette `preparaBlocchiIA`, come per i blocchi dell'IA.
 *
 * Le regole sono state scritte sul gergo Hyrox/running generico. ⚠️ Quando
 * arrivano esempi veri del coach, vanno in `__tests__/leggiWorkout.test.js`
 * PRIMA di toccare le regole: è lì che si vede cosa una regola nuova rompe.
 */

import { HYROX_EXERCISES, isDistance, isHybrid } from './esercizi'
import { ERGOMETERS } from './constants'
import { mmss } from './stimaWorkout'

// ── Il testo, pulito ──────────────────────────────────────────────────────

/**
 * Una riga resa confrontabile: apici e virgolette tipografiche ridotti a `'`
 * e `"`, `×` a `x`, punti elenco e numerazioni tolti. Le maiuscole restano:
 * servono a scrivere il nome di un esercizio sconosciuto come l'ha scritto
 * il coach.
 */
export const pulisciRiga = (riga) => String(riga ?? '')
  .replace(/[’‘′`´]/g, "'")
  .replace(/[″“”]/g, '"')
  .replace(/''/g, '"')
  .replace(/[×✕]/g, 'x')
  .replace(/[–—]/g, '-')
  .replace(/\t/g, ' ')
  .replace(/^\s*(?:[-•*·>▪◦]+|[a-z]\)|\d{1,2}[).])\s+/i, '')
  .replace(/\s+/g, ' ')
  .trim()

/** Minuscole, senza accenti: per le regole, non per quello che si mostra. */
const basso = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

const numero = (s) => parseFloat(String(s).replace(',', '.'))

// ── I tempi ───────────────────────────────────────────────────────────────

/**
 * I modi di scrivere un tempo, dal più specifico al più generico. ⚠️ «m» da
 * sola NON è minuti: «400m» sono metri. E un «m:ss» seguito da «/km» o
 * «/500» è un passo, non una durata.
 */
const TEMPO = /(\d+)\s*'\s*(\d{1,2})\s*"?|(\d+)\s*'|(\d+)\s*"|(\d{1,2}):(\d{2})(?!\s*\/|\d)|(\d+(?:[.,]\d+)?)\s*(?:min|minuti|minuto|mins)\b|(\d+)\s*(?:sec|secondi|s)\b/

/** Il primo tempo della riga in secondi, con dove sta; `null` se non c'è. */
export const trovaTempo = (testo) => {
  const m = String(testo).match(TEMPO)
  if (!m) return null
  let secondi
  if (m[1] !== undefined) secondi = +m[1] * 60 + +m[2]
  else if (m[3] !== undefined) secondi = +m[3] * 60
  else if (m[4] !== undefined) secondi = +m[4]
  else if (m[5] !== undefined) secondi = +m[5] * 60 + +m[6]
  else if (m[7] !== undefined) secondi = Math.round(numero(m[7]) * 60)
  else secondi = +m[8]
  if (!secondi) return null
  return { secondi, inizio: m.index, fine: m.index + m[0].length }
}

/** Tutti i tempi della riga, in ordine. */
const tuttiITempi = (testo) => {
  const trovati = []
  let resto = String(testo)
  let spostamento = 0
  for (let t = trovaTempo(resto); t; t = trovaTempo(resto)) {
    trovati.push({ ...t, inizio: t.inizio + spostamento, fine: t.fine + spostamento })
    spostamento += t.fine
    resto = resto.slice(t.fine)
  }
  return trovati
}

const togli = (testo, da, a) => `${testo.slice(0, da)} ${testo.slice(a)}`

// ── Gli esercizi ──────────────────────────────────────────────────────────

/** Il nome ridotto all'osso: «Wall-Balls» e «wallball» sono la stessa chiave. */
const chiave = (s) => basso(s).replace(/[^a-z0-9]/g, '').replace(/(es|s)$/, '')

/**
 * Come si scrivono gli esercizi su una lavagna. Le chiavi passano da
 * `chiave()`, quindi niente spazi, accenti o plurali qui.
 */
const SINONIMI = {
  ski: 'SkiErg', skierg: 'SkiErg', sky: 'SkiErg', skyerg: 'SkiErg', skier: 'SkiErg',
  row: 'Rowing', rower: 'Rowing', rowerg: 'Rowing', vogatore: 'Rowing', remoergometro: 'Rowing', remo: 'Rowing',
  bike: 'Assault Bike', airbike: 'Assault Bike', assault: 'Assault Bike', ab: 'Assault Bike',
  echo: 'Echo Bike', echobike: 'Echo Bike',
  wb: 'Wall Balls', wallball: 'Wall Balls', wallballshot: 'Wall Balls',
  bbj: 'Burpees Broad Jumps', burpeebroadjump: 'Burpees Broad Jumps', burpeesbroadjump: 'Burpees Broad Jumps', burpeebj: 'Burpees Broad Jumps',
  burpee: 'Burpees',
  sledpush: 'Sled Push', push: 'Sled Push', spintaslitta: 'Sled Push', slittaspinta: 'Sled Push',
  sledpull: 'Sled Pull', pull: 'Sled Pull', tiraslitta: 'Sled Pull', slittatirata: 'Sled Pull',
  farmer: 'Farmers Carry', farmerscarry: 'Farmers Carry', farmercarry: 'Farmers Carry', fc: 'Farmers Carry',
  lunge: 'Sandbag Lunges', sandbaglunge: 'Sandbag Lunges', sblunge: 'Sandbag Lunges', affondi: 'Sandbag Lunges', affondo: 'Sandbag Lunges',
  run: 'Run', corsa: 'Run', running: 'Run',
  kb: 'Kettlebell Swing', kbs: 'Kettlebell Swing', swing: 'Kettlebell Swing', kbswing: 'Kettlebell Swing',
  du: 'Double Unders', doubleunder: 'Double Unders', dunder: 'Double Unders',
  t2b: 'Toes-to-Bar', ttb: 'Toes-to-Bar', toetobar: 'Toes-to-Bar', toestobar: 'Toes-to-Bar',
  c2b: 'Chest-to-Bar', ctb: 'Chest-to-Bar',
  hspu: 'Handstand Push-up',
  pullup: 'Pull-up', trazioni: 'Pull-up', trazione: 'Pull-up',
  pushup: 'Push Up', piegamenti: 'Push Up', piegamento: 'Push Up', flession: 'Push Up', flessioni: 'Push Up',
  boxjump: 'Box Jump', bj: 'Box Jump',
  dl: 'Deadlift', stacco: 'Deadlift', stacchi: 'Deadlift',
  rdl: 'Romanian Deadlift',
  goblet: 'Kettlebell Goblet Squat', gobletsquat: 'Kettlebell Goblet Squat',
  dbsnatch: 'Dumbbell Snatch',
  ohs: 'Overhead Squat',
  tgu: 'Turkish Get-Up',
  jj: 'Jumping Jack', jumpingjack: 'Jumping Jack',
  plank: 'Plank',
  ghd: 'GHD Sit-up',
}

const INDICE = new Map([...new Set([...HYROX_EXERCISES, ...ERGOMETERS])].map(n => [chiave(n), n]))

/** La distanza di modifica fra due chiavi, per gli errori di battitura. */
const distanza = (a, b) => {
  const riga = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prec = riga[0]
    riga[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = riga[j]
      riga[j] = Math.min(riga[j] + 1, riga[j - 1] + 1, prec + (a[i - 1] === b[j - 1] ? 0 : 1))
      prec = tmp
    }
  }
  return riga[b.length]
}

/**
 * Il nome canonico per quello che il coach ha scritto, o `null`. In ordine:
 * nome esatto, sinonimo, errore di battitura (uno ogni sei lettere circa).
 * ⚠️ Niente «contiene»: «wall» starebbe sia in Wall Balls sia in Wall Walk, e
 * indovinare fra i due è inventare.
 */
export const trovaEsercizio = (testo) => {
  const k = chiave(testo)
  if (k.length < 2) return null
  if (INDICE.has(k)) return INDICE.get(k)
  if (SINONIMI[k]) return SINONIMI[k]
  if (k.length < 5) return null
  const soglia = k.length <= 8 ? 1 : 2
  const candidati = [...INDICE.entries(), ...Object.entries(SINONIMI)]
    .map(([c, nome]) => ({ nome, d: distanza(k, c) }))
    .filter(c => c.d <= soglia)
  if (candidati.length === 0) return null
  const migliore = Math.min(...candidati.map(c => c.d))
  const nomi = new Set(candidati.filter(c => c.d === migliore).map(c => c.nome))
  return nomi.size === 1 ? [...nomi][0] : null
}

/** Un nome sconosciuto scritto come un nome: «mountain climber» → «Mountain Climber». */
const comeNome = (s) => s.trim().replace(/\s+/g, ' ')
  .replace(/(^|\s)(\p{L})/gu, (_, sp, l) => sp + l.toUpperCase())

/**
 * Una riga d'esercizio: «20 Wall Balls 6kg», «Row 500m @2:00/500»,
 * «4x25m sled push 150kg», «max burpees». Torna `null` se nella riga non c'è
 * né un esercizio conosciuto né un numero: allora non è un esercizio, è una nota.
 */
export const leggiEsercizio = (riga) => {
  let t = ` ${basso(pulisciRiga(riga))} `
  const note = []
  const ex = { name: '', reps: '', meters: '', kg: '' }

  // L'intensità: «@8/10», «RPE 8».
  let m = t.match(/(?:rpe|@)\s*(\d{1,2})\s*\/\s*10\b|\brpe\s*(\d{1,2})\b/)
  if (m) { ex.intensity = m[1] ?? m[2]; t = togli(t, m.index, m.index + m[0].length) }

  // Il passo: «2:00/500», «4:30/km», «Z2», «60 rpm».
  m = t.match(/(\d{1,2}):(\d{2})\s*\/\s*(500m?|km)\b/)
  if (m) {
    ex.ergoPace = `${+m[1]}:${m[2]} ${m[3].startsWith('500') ? '/500m' : '/km'}`
    t = togli(t, m.index, m.index + m[0].length)
  }
  m = t.match(/\bz([1-5])\b/)
  if (m) { ex.ergoPace = `Z${m[1]}`; t = togli(t, m.index, m.index + m[0].length) }
  m = t.match(/(\d+)\s*rpm\b/)
  if (m) { ex.ergoPace = `${m[1]} RPM`; t = togli(t, m.index, m.index + m[0].length) }

  // Il peso: «2x22,5kg», «24kg», «@ 24».
  m = t.match(/(\d)\s*x\s*(\d+(?:[.,]\d+)?)\s*kg\b/)
  if (m) { ex.kg = `${m[1]}x${numero(m[2])}`; t = togli(t, m.index, m.index + m[0].length) }
  m = !ex.kg && t.match(/(\d+(?:[.,]\d+)?)\s*kg\b/)
  if (m) { ex.kg = String(numero(m[1])); t = togli(t, m.index, m.index + m[0].length) }
  m = !ex.kg && t.match(/@\s*(\d+(?:[.,]\d+)?)(?![\d:/])/)
  if (m) { ex.kg = String(numero(m[1])); t = togli(t, m.index, m.index + m[0].length) }

  // Le calorie non hanno un campo: restano scritte nella nota.
  m = t.match(/(\d+)\s*(?:cal|kcal|calorie)\b/)
  if (m) { note.push(`${m[1]} cal`); t = togli(t, m.index, m.index + m[0].length) }

  // Serie per distanza, «4x25m»: la distanza è quella di UNA tratta.
  m = t.match(/(\d+)\s*x\s*(\d+(?:[.,]\d+)?)\s*(km|k|m|mt|metri)\b/)
  if (m) {
    const metri = Math.round(numero(m[2]) * (m[3].startsWith('k') ? 1000 : 1))
    ex.meters = `${metri}m`
    note.push(`${m[1]} × ${metri}m`)
    t = togli(t, m.index, m.index + m[0].length)
  }
  m = !ex.meters && t.match(/(\d+(?:[.,]\d+)?)\s*(km|k|m|mt|metri)\b/)
  if (m) {
    ex.meters = `${Math.round(numero(m[1]) * (m[2].startsWith('k') ? 1000 : 1))}m`
    t = togli(t, m.index, m.index + m[0].length)
  }

  // Un tempo sull'esercizio («30" plank»): il chiamante decide dove va.
  const tempo = trovaTempo(t)
  if (tempo) { ex.exTime = mmss(tempo.secondi); t = togli(t, tempo.inizio, tempo.fine) }

  // Serie per ripetizioni, «3x10»: le ripetizioni sono quelle di UNA serie.
  m = t.match(/(\d+)\s*x\s*(\d+)\b/)
  if (m) { ex.reps = m[2]; note.push(`${m[1]} × ${m[2]}`); t = togli(t, m.index, m.index + m[0].length) }
  m = !ex.reps && t.match(/\bmax\b/)
  if (m) { ex.reps = 'Max'; t = togli(t, m.index, m.index + m[0].length) }
  m = !ex.reps && t.match(/(\d+)\s*(?:reps?|rip|ripetizioni)\b/)
  if (m) { ex.reps = m[1]; t = togli(t, m.index, m.index + m[0].length) }
  m = !ex.reps && t.match(/(?:^|\s)x?\s*(\d+)\s*x?(?=\s|$)/)
  let numeroNudo = null
  if (m) { numeroNudo = m[1]; t = togli(t, m.index, m.index + m[0].length) }

  const testoNome = t.replace(/[^a-z0-9'\- ]/g, ' ').replace(/\b(di|de|con|the|of|x|a)\b/g, ' ').replace(/\s+/g, ' ').trim()
  const nome = testoNome ? trovaEsercizio(testoNome) : null
  const haNumeri = !!(ex.reps || ex.meters || ex.kg || ex.exTime || numeroNudo || ex.ergoPace || note.length)
  if (!nome && (!testoNome || !haNumeri)) return null

  ex.name = nome ?? comeNome(pulisciRiga(riga)
    .replace(/[^\p{L}' -]/gu, ' ')
    .replace(/\b(kg|km|k|m|mt|metri|max|reps?|rip|cal|rpe|x)\b/gi, ' '))
  if (!ex.name) return null
  ex.riconosciuto = !!nome

  // Un numero nudo è distanza sugli esercizi che si misurano in metri
  // («Row 500»), ripetizioni su tutti gli altri.
  if (numeroNudo) {
    if (isDistance(ex.name) && !ex.meters && +numeroNudo >= 50) ex.meters = `${numeroNudo}m`
    else if (!ex.reps) ex.reps = numeroNudo
  }
  // Una distanza scritta come ripetizioni su un ergometro non ha senso:
  // «row 15» resta 15 nelle note, non diventa 15 metri.
  if (isDistance(ex.name) && !isHybrid(ex.name) && ex.reps && ex.reps !== 'Max' && !ex.meters) {
    note.push(ex.reps)
    ex.reps = ''
  }
  if (note.length) ex.notes = note.join(' · ')
  return ex
}

// ── Le intestazioni di blocco ─────────────────────────────────────────────

/** I giri scritti nella riga: «x5», «5 round», «4 RFT», «3 giri». */
const trovaGiri = (t) => {
  const m = t.match(/(\d+)\s*(?:rft|rounds?|rnds?|giri|giro|serie|sets?)\b|\bx\s*(\d+)\b|\b(\d+)\s*x(?=\s|$|:)/)
  return m ? (m[1] ?? m[2] ?? m[3]) : null
}

/**
 * Se la riga apre un blocco, il blocco (senza esercizi) e quello che resta
 * della riga dopo i due punti — «EMOM 10': 12 burpees» porta anche il primo
 * esercizio. `null` se la riga non è un'intestazione.
 */
export const leggiIntestazione = (riga) => {
  const pulita = pulisciRiga(riga)
  const t = basso(pulita)
  // «EMOM 10': 12 burpees» — i due punti di «1:30» non contano.
  const due = t.match(/:(?!\d{2})\s*/)
  const testa = due ? t.slice(0, due.index) : t
  const coda = due ? pulita.slice(due.index + due[0].length).trim() : ''
  const tempi = tuttiITempi(testa)
  const primo = tempi[0]?.secondi
  const giri = trovaGiri(testa)
  const blocco = (type, params = {}, notes) => ({ blocco: { type, params, exercises: [], ...(notes ? { notes } : {}) }, coda })

  if (/\btabata\b/.test(testa)) {
    return blocco('ON/OFF', { on: '0:20', off: '0:10', rounds: giri ?? '8' })
  }

  let m = testa.match(/\be\s*(\d+)?\s*mom\b|\bemom\b|\b(?:every|ogni)\s+/)
  if (m && (/mom\b/.test(m[0]) || primo)) {
    let intervallo = 60
    if (m[1]) intervallo = +m[1] * 60
    else if (!/mom\b/.test(m[0]) && primo) intervallo = primo
    const params = { interval: mmss(intervallo) }
    if (giri) params.rounds = giri
    else {
      // «EMOM 12'»: il tempo dopo l'intestazione è la durata TOTALE.
      const totale = /mom\b/.test(m[0]) ? primo : tempi[1]?.secondi
      if (totale && totale >= intervallo && totale % intervallo === 0) params.rounds = String(totale / intervallo)
      else {
        // «AMRAP 20» senza apice: il numero da solo dopo EMOM sono minuti.
        const nudo = testa.slice(m.index + m[0].length).match(/^\s*(\d+)\s*$/)
        if (nudo && (+nudo[1] * 60) % intervallo === 0) params.rounds = String((+nudo[1] * 60) / intervallo)
      }
    }
    return blocco('EMOM', params)
  }

  if (/\bamrap\b/.test(testa)) {
    let durata = primo
    if (!durata) {
      const nudo = testa.match(/amrap\s*(\d+)\b/)
      if (nudo) durata = +nudo[1] * 60
    }
    return blocco('AMRAP', durata ? { duration: mmss(durata) } : {})
  }

  // ON/OFF: «40" on 20" off», «on 1' off 30"», «40/20 x8».
  m = testa.match(/(\d+\s*['"]?\d*\s*"?)\s*(?:on|lavoro|work)\b.*?(\d+\s*['"]?\d*\s*"?)\s*(?:off|rec|recupero|riposo|rest)\b/)
    || testa.match(/\b(?:on|lavoro|work)\s*(\d+\s*['"]?\d*\s*"?).*?\b(?:off|rec|recupero|riposo|rest)\s*(\d+\s*['"]?\d*\s*"?)/)
    || testa.match(/^\s*(\d{2})\s*\/\s*(\d{2})\b/)
  if (m) {
    // Senza apici sono secondi: nessuno scrive «40 on» intendendo 40 minuti.
    const secondi = (s) => trovaTempo(s)?.secondi ?? (+String(s).trim() || null)
    const on = secondi(m[1])
    const off = secondi(m[2])
    if (on && off) {
      return blocco('ON/OFF', { on: mmss(on), off: mmss(off), ...(giri ? { rounds: giri } : {}) })
    }
  }

  const cap = testa.match(/(?:time\s*)?cap\s*/)
  const notaCap = () => {
    if (!cap) return undefined
    const t2 = trovaTempo(testa.slice(cap.index))
    return t2 ? `Time cap ${mmss(t2.secondi)}` : undefined
  }

  if (/\bfor\s*time\b|\bft\b|\brft\b|\ba\s+tempo\b/.test(testa)) {
    return blocco('For Time', giri ? { rounds: giri } : {}, notaCap())
  }

  if (/^\s*(?:cash|buy)\s*-?\s*in\b/.test(testa)) return blocco('Cash In', giri ? { rounds: giri } : {})
  if (/^\s*(?:cash|buy)\s*-?\s*out\b/.test(testa)) return blocco('Cash Out', giri ? { rounds: giri } : {})

  if (/^\s*(?:warm\s*-?\s*up|riscaldamento|attivazione|wu)\b/.test(testa)) {
    return blocco('WarmUp', primo ? { duration: mmss(primo) } : {})
  }

  if (/^\s*intervals?\b/.test(testa)) return blocco('Interval', giri ? { rounds: giri } : {})

  // «Rest 2'» da solo: un blocco di recupero.
  if (/^\s*(?:rest|riposo|recupero|rec|pausa)\b/.test(testa) && primo
    && testa.replace(TEMPO, '').replace(/rest|riposo|recupero|rec|pausa|[^a-z0-9]/g, '').length === 0) {
    return blocco('Rest', { duration: mmss(primo) })
  }

  // «3 rounds:» / «4x» da solo su una riga: un circuito a giri.
  if (/^\s*(\d+)\s*(?:rounds?|rnds?|giri|x)\s*$/.test(testa) && !coda) {
    return blocco('For Time', { rounds: giri })
  }

  return null
}

// ── Il workout Hyrox intero ───────────────────────────────────────────────

/** I tipi in cui ogni esercizio è un minuto/intervallo: lì «rest» è un esercizio. */
const A_INTERVALLI = new Set(['EMOM', 'ON/OFF', 'Interval'])

/** Più esercizi sulla stessa riga: «10 burpees + 15 wb», «10 burpees, 15 wb». */
const spezzaEsercizi = (riga) => riga.split(/\s\+\s|,\s+|\s\/\s|;\s*/).map(s => s.trim()).filter(Boolean)

/** Toglie il prefisso di un minuto di EMOM: «min 1:», «1°», «minuto 2 -». */
const senzaMinuto = (riga) => riga.replace(/^\s*(?:min(?:uto)?\.?\s*\d+|\d+\s*°|\d+\s*\)|m\d+)\s*[:\-.]?\s*/i, '')

/**
 * Il workout Hyrox scritto, letto riga per riga.
 * Torna:
 * - `blocchi`: quelli da passare a `preparaBlocchiIA`;
 * - `note`: le righe venute prima di ogni blocco e non capite (vanno nelle
 *   note del coach);
 * - `righe`: una per riga non vuota, con `esito` — `blocco`, `esercizio`,
 *   `nuovo` (un esercizio che la lista non conosce: entra col nome scritto),
 *   `nota` (non capita: è finita nelle note) — per l'anteprima.
 */
export function leggiHyrox(testo) {
  const blocchi = []
  const note = []
  const righe = []
  let corrente = null

  const nuovoBlocco = (b) => { blocchi.push(b); corrente = b }
  // ⚠️ « · » e non un a capo: le note del blocco sono un campo su UNA riga
  // (`RigaTesto`, un <input>), e lì un a capo sparisce incollando le parole.
  // Le note del coach invece sono un'area di testo: lì resta l'a capo.
  const annota = (testoRiga) => {
    if (corrente) corrente.notes = corrente.notes ? `${corrente.notes} · ${testoRiga}` : testoRiga
    else note.push(testoRiga)
  }

  const aggiungiEsercizio = (ex) => {
    // Un esercizio senza blocco davanti — o dopo un Rest, che non ne ha —
    // apre un circuito senza giri: il numero lo mette il coach.
    if (!corrente || corrente.type === 'Rest') nuovoBlocco({ type: 'For Time', params: {}, exercises: [] })
    const { exTime, ...resto } = ex
    // `riconosciuto` serve all'anteprima, non al blocco.
    delete resto.riconosciuto
    // Il tempo di un esercizio ha un campo solo nei blocchi Interval; il Rest
    // lo tiene in `meters` (è così che `durataBlocco` lo legge). Altrove resta
    // scritto nella nota, non si perde.
    if (exTime) {
      if (resto.name === 'Rest') resto.meters = exTime
      else if (corrente.type === 'Interval') resto.exTime = exTime
      else resto.notes = resto.notes ? `${exTime} · ${resto.notes}` : exTime
    }
    corrente.exercises.push(resto)
  }

  for (const grezza of String(testo ?? '').split(/\r?\n/)) {
    const riga = pulisciRiga(grezza)
    if (!riga) continue

    const intestazione = leggiIntestazione(riga)
    if (intestazione) {
      nuovoBlocco(intestazione.blocco)
      righe.push({ testo: riga, esito: 'blocco', tipo: intestazione.blocco.type })
      if (!intestazione.coda) continue
    }
    const daLeggere = intestazione ? intestazione.coda : riga

    // 🔴 Il WarmUp NON ha esercizi nel builder (`conEsercizi` in HyroxBlock):
    // il riscaldamento si descrive nelle note del blocco. Un esercizio messo
    // lì dentro sparirebbe dalla scheda senza dire niente — quindi la riga va
    // nelle note, scritta com'è.
    if (corrente?.type === 'WarmUp') {
      annota(daLeggere)
      if (!intestazione) righe.push({ testo: riga, esito: 'nota' })
      continue
    }

    // «Rest» dentro un EMOM è il minuto di recupero, un esercizio.
    const bloccoAIntervalli = corrente && A_INTERVALLI.has(corrente.type)
    const sorgente = bloccoAIntervalli ? senzaMinuto(daLeggere) : daLeggere
    if (bloccoAIntervalli && /^\s*(?:rest|riposo|recupero|pausa)\b/i.test(sorgente)) {
      const t = trovaTempo(sorgente)
      aggiungiEsercizio({ name: 'Rest', reps: '', meters: t ? mmss(t.secondi) : '', kg: '' })
      if (!intestazione) righe.push({ testo: riga, esito: 'esercizio', nome: 'Rest' })
      continue
    }

    const pezzi = spezzaEsercizi(sorgente).map(p => ({ p, ex: leggiEsercizio(p) }))
    if (pezzi.length > 0 && pezzi.every(x => x.ex)) {
      pezzi.forEach(({ ex }) => aggiungiEsercizio(ex))
      if (!intestazione) {
        righe.push({
          testo: riga,
          esito: pezzi.every(x => x.ex.riconosciuto) ? 'esercizio' : 'nuovo',
          nome: pezzi.map(x => x.ex.name).join(' + '),
        })
      }
      continue
    }

    annota(daLeggere)
    if (!intestazione) righe.push({ testo: riga, esito: 'nota' })
  }

  return {
    blocchi,
    note: note.join('\n'),
    righe,
  }
}

// ── La corsa ──────────────────────────────────────────────────────────────

/** Una distanza di corsa nel formato del righello: «400m», «5 km», «1.5 km». */
const distanzaCorsa = (metri) => (metri < 1000 ? `${metri}m` : `${+(metri / 1000).toFixed(2)} km`)

/** Una durata di corsa: «10 min», «30 sec», o «1:30» se non è tonda. */
const durataCorsa = (secondi) => {
  if (secondi < 60) return `${secondi} sec`
  if (secondi % 60 === 0) return `${secondi / 60} min`
  return mmss(secondi)
}

/** Il «quanto» di un tratto: la prima distanza o, se non c'è, il primo tempo. */
const quantoCorsa = (t) => {
  const m = t.match(/(\d+(?:[.,]\d+)?)\s*(km|k|m|mt|metri)\b/)
  if (m) return distanzaCorsa(Math.round(numero(m[1]) * (m[2].startsWith('k') ? 1000 : 1)))
  const tempo = trovaTempo(t)
  return tempo ? durataCorsa(tempo.secondi) : null
}

/**
 * Il passo di un tratto, con min e max come li scrive `RunningStepPicker`.
 * Senza passo scritto: «Libero», che è anche quello da cui parte il picker.
 */
const passoCorsa = (t) => {
  let m = t.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/)
  if (m) {
    const min = `${+m[1]}:${m[2]} /km`
    const max = `${+m[3]}:${m[4]} /km`
    return { pace: `${+m[1]}:${m[2]} - ${max}`, paceMin: min, paceMax: max }
  }
  m = t.match(/(\d{1,2}):(\d{2})\s*(?:\/\s*km|min\/km)?/)
  if (m && +m[1] >= 2 && +m[1] <= 10) {
    const v = `${+m[1]}:${m[2]} /km`
    return { pace: v, paceMin: v, paceMax: '-' }
  }
  m = t.match(/\bz([1-5])\b/)
  const zona = m ? `Z${m[1]}`
    : /\ball\s*out\b|\bmax\b/.test(t) ? 'All out'
      : /\bgara\b|\brace\s*pace\b|\brp\b/.test(t) ? 'Gara'
        : /\bcammin|\bwalk\b/.test(t) ? 'Camminata'
          : 'Libero'
  return { pace: zona, paceMin: zona, paceMax: '-' }
}

/**
 * Il workout di corsa scritto: «riscaldamento 15'», «6x400m @3:45 rec 1'»,
 * «5 km Z2», «defaticamento 10'». Stessa uscita di `leggiHyrox`, con `fasi`
 * al posto dei blocchi.
 */
export function leggiCorsa(testo) {
  const fasi = []
  const note = []
  const righe = []

  for (const grezza of String(testo ?? '').split(/\r?\n/)) {
    const riga = pulisciRiga(grezza)
    if (!riga) continue

    for (const pezzo of riga.split(/\s\+\s|;\s*|,\s+(?=\D)/).map(s => s.trim()).filter(Boolean)) {
      const t = ` ${basso(pezzo)} `
      const intensita = t.match(/(?:rpe|@)\s*(\d{1,2})\s*\/\s*10\b/)?.[1]

      // Le ripetute: «6x400m», «8 x 1'», «5x1km rec 2'».
      const rip = t.match(/(\d+)\s*x\s*(\d+(?:[.,]\d+)?\s*(?:km|k|m|mt|metri)\b|\d+\s*['"](?:\s*\d{1,2}\s*"?)?|\d+\s*(?:min|sec)\b)/)
      if (rip) {
        const veloce = quantoCorsa(rip[2])
        const resto = t.slice(rip.index + rip[0].length)
        const recIdx = resto.search(/\b(?:rec|recupero|r|riposo|pausa)\b/)
        const parteVeloce = recIdx === -1 ? resto : resto.slice(0, recIdx)
        const parteRec = recIdx === -1 ? '' : resto.slice(recIdx)
        const pv = passoCorsa(parteVeloce)
        const pr = passoCorsa(parteRec)
        fasi.push({
          type: 'repeat', rounds: rip[1],
          runDuration: veloce, runPace: pv.pace, runPaceMin: pv.paceMin, runPaceMax: pv.paceMax,
          runIntensity: intensita ?? '8',
          // 🔴 Senza recupero scritto resta vuoto: inventare «1 min» cambierebbe
          // la seduta senza che il coach lo veda.
          recDuration: parteRec ? (quantoCorsa(parteRec) ?? '') : '',
          recPace: pr.pace, recPaceMin: pr.paceMin, recPaceMax: pr.paceMax, recIntensity: '3',
          notes: '',
        })
        righe.push({ testo: pezzo, esito: 'esercizio', nome: `${rip[1]} × ${veloce}` })
        continue
      }

      const tipo = /\b(?:riscald|warm\s*-?\s*up|wu\b|attivazione)/.test(t) ? 'warmup'
        : /\b(?:defat|cool\s*-?\s*down|cd\b|scarico)/.test(t) ? 'cooldown'
          : /^\s*(?:rec|recupero|riposo|pausa|cammin|walk)/.test(t) ? 'recover'
            : 'run'
      const quanto = quantoCorsa(t)
      if (!quanto) {
        if (fasi.length) {
          const ultima = fasi[fasi.length - 1]
          ultima.notes = ultima.notes ? `${ultima.notes} · ${pezzo}` : pezzo
        } else note.push(pezzo)
        righe.push({ testo: pezzo, esito: 'nota' })
        continue
      }
      const p = passoCorsa(t)
      fasi.push({ type: tipo, duration: quanto, ...p, intensity: intensita ?? '5', notes: '' })
      righe.push({ testo: pezzo, esito: 'esercizio', nome: quanto })
    }
  }

  return { fasi, note: note.join('\n'), righe }
}
