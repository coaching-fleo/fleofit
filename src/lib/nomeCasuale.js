// Il nome che un workout Hyrox o Corsa prende quando il coach non ne scrive uno.
//
//     Wall Ball Burner  · EM 25′ @8
//     Compromised Sled  · FT 30′ @9
//     VO2max 400s       · RIP 50′ @9
//     Long Run Easy     · CL 18K @5
//
// Storia (07/10/2026). Fino al 05/10 il workout non aveva nome se non scritto;
// poi è nato dai due esercizi principali («Wall Balls & Burpees»), che si
// ripeteva identico a ogni workout ricreato con gli stessi esercizi; poi da
// parole casuali («Falco Implacabile»), mai ripetute ma scollegate
// dall'allenamento — bocciate dal committente. Ora le due cose insieme: dal
// contenuto si ricava un elenco di nomi PERTINENTI in gergo Hyrox/running
// (`candidatiNome`), e un seme casuale sceglie quale usare.
//
// ⚠️ L'elenco dipende dal contenuto, il seme no: toccando i blocchi il nome
// cambia e resta pertinente; a blocchi fermi resta fermo. Il dado cambia il seme.
// ⚠️ Un nome generato si riconosce perché sta fra i candidati del suo workout
// (`eNomeGenerato`): riaperto in modifica resta quello, in una copia se ne
// sceglie un altro. Chi cambia gli elenchi qui sotto rende «scritti a mano» i
// nomi già salvati che non vi compaiono più.

import { durataEsercizio, giriBlocco, durataBlocco, rpeAtteso, BLOCCHI_DI_LAVORO } from './stimaWorkout'
import { riepilogoCorsa } from './rigaArchivio'
import { ERGOMETERS } from './constants'
import { separaCodice } from './codiceWorkout'

// ── Hyrox: cosa si fa ───────────────────────────────────────────────────────

const SLED = ['Sled Push', 'Sled Pull', 'Prowler Push', 'Sled Drag']
const CARRY = ['Farmers Carry', 'Farmers Walk', 'Suitcase Carry', 'Sandbag Carry', 'Yoke Carry', "Waiter's Walk"]
const CORSA = ['Run', 'Shuttle Run', 'TrueForm Runner', 'Curve Treadmill']

/** La famiglia di un esercizio: decide il «focus» del nome. */
const famiglia = (nome) => {
  if (SLED.includes(nome)) return 'sled'
  if (CORSA.includes(nome)) return 'run'
  if (ERGOMETERS.includes(nome)) return 'erg'
  if (CARRY.includes(nome)) return 'carry'
  if (nome === 'Wall Balls') return 'wallball'
  if (/^Burpees/.test(nome)) return 'burpee'
  if (/Lunge/.test(nome)) return 'lunge'
  return 'altro'
}

/** Come un esercizio compare dentro un nome: corto, al singolare. */
const ETICHETTE = {
  'Wall Balls': 'Wall Ball', 'Burpees': 'Burpee', 'Burpees Broad Jumps': 'Broad Jump',
  'Burpees Jump': 'Burpee', 'Rowing': 'Row', 'Assault Bike': 'Bike', 'Echo Bike': 'Bike',
  'TrueForm Runner': 'Run', 'Curve Treadmill': 'Run', 'Shuttle Run': 'Shuttle',
  'Sandbag Lunges': 'Lunge', 'Farmers Walk': 'Farmers Carry', 'Prowler Push': 'Prowler',
  'Sled Drag': 'Sled', 'Box Jump': 'Box Jump',
}
const etichetta = (nome) => {
  if (ETICHETTE[nome]) return ETICHETTE[nome]
  // Oltre i 14 caratteri il nome diventa una frase: meglio il focus.
  return nome.length <= 14 ? nome : null
}

/** Le otto stazioni della gara: con quasi tutte più la corsa è una simulazione. */
const STAZIONI_GARA = [['SkiErg'], ['Sled Push'], ['Sled Pull'], ['Burpees Broad Jumps'],
  ['Rowing'], ['Farmers Carry', 'Farmers Walk'], ['Sandbag Lunges'], ['Wall Balls']]

// ── Hyrox: come lo si fa ────────────────────────────────────────────────────

const PER_INTENSITA = {
  dura: [x => `${x} Burner`, x => `${x} Grinder`, x => `${x} Crusher`, x => `${x} Redline`, x => `${x} Blast`],
  media: [x => `${x} Builder`, x => `${x} Tempo`, x => `Threshold ${x}`, x => `${x} Session`],
  facile: [x => `Easy ${x}`, x => `Z2 ${x}`, x => `Aerobic ${x}`, x => `${x} Flow`],
}

const PER_STRUTTURA = {
  'EMOM': ['EMOM'],
  'AMRAP': ['AMRAP'],
  'For Time': ['Chipper', 'For Time'],
  'Interval': ['Intervals', 'Repeats'],
  'ON/OFF': ['On/Off', 'Intervals'],
}

/** Il focus quando l'esercizio da solo non basta a dire la seduta. */
const FOCUS = {
  sled: ['Leg', 'Sled'], lunge: ['Leg'], wallball: ['Leg', 'Metcon'],
  erg: ['Engine', 'Erg'], run: ['Engine', 'Run'], carry: ['Grip', 'Carry'],
  burpee: ['Metcon'], altro: ['Metcon', 'Strength'],
}

const fasciaIntensita = (rpe) => {
  if (!Number.isFinite(rpe)) return 'media'
  if (rpe >= 8) return 'dura'
  if (rpe <= 5) return 'facile'
  return 'media'
}

const unici = (nomi) => [...new Set(nomi.filter(Boolean))]

const candidatiHyrox = (blocks = []) => {
  const lavoro = blocks.filter(b => BLOCCHI_DI_LAVORO.has(b?.type))
  const fonte = lavoro.length ? lavoro : blocks
  if (!fonte.length) return []

  // Quanto pesa ogni esercizio, per tempo stimato e giri compresi.
  const peso = new Map()
  for (const b of fonte) {
    const giri = giriBlocco(b)
    for (const ex of b?.exercises || []) {
      const nome = (ex?.name || '').trim()
      if (!nome || nome === 'Rest') continue
      peso.set(nome, (peso.get(nome) || 0) + Math.max(durataEsercizio(ex), 1) * giri)
    }
  }
  const ordinati = [...peso.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n)
  const pesoFamiglia = new Map()
  for (const [n, v] of peso) pesoFamiglia.set(famiglia(n), (pesoFamiglia.get(famiglia(n)) || 0) + v)
  const famiglie = [...pesoFamiglia.entries()].sort((a, b) => b[1] - a[1]).map(([f]) => f)

  const fascia = fasciaIntensita(rpeAtteso(blocks))
  const principale = [...lavoro].sort((a, b) => durataBlocco(b) - durataBlocco(a))[0]
  const strutture = PER_STRUTTURA[principale?.type] || []
  // ⚠️ Corsa più una stazione è «compromised running»: il nome parla della
  // STAZIONE, anche se in tempo stimato pesa meno dei chilometri di corsa.
  const compromised = pesoFamiglia.has('run') && famiglie.some(f => f !== 'run')
  const stazioni = ordinati.filter(n => !compromised || famiglia(n) !== 'run')
  const etichette = unici(stazioni.map(etichetta))
  const [primo, secondo] = etichette
  const famiglieFocus = famiglie.filter(f => !compromised || f !== 'run')
  const focus = famiglieFocus.length >= 3 ? ['Metcon', 'Full Body'] : (FOCUS[famiglieFocus[0]] || [])

  const nomi = []
  const gara = STAZIONI_GARA.filter(alt => alt.some(n => peso.has(n))).length
  // Quasi tutte le stazioni di gara più la corsa: è una simulazione, e basta.
  if (gara >= 6 && compromised) return ['Hyrox Sim', 'Race Sim', 'Full Hyrox Sim', 'Race Simulation', 'Race Rehearsal']
  if (compromised) nomi.push(...unici([primo && `Compromised ${primo}`, 'Compromised Run', primo && `${primo} & Run`]))
  for (const x of [primo, ...focus]) {
    if (!x) continue
    for (const f of PER_INTENSITA[fascia]) nomi.push(f(x))
    for (const s of strutture) nomi.push(`${x} ${s}`)
  }
  if (primo && secondo && !compromised) nomi.push(`${primo} & ${secondo}`)
  // Blocchi ancora vuoti: la sola struttura, finché non arrivano esercizi.
  if (!nomi.length) for (const s of strutture) for (const f of PER_INTENSITA[fascia]) nomi.push(f(s))
  return unici(nomi).filter(n => !/\b(\w+) \1\b/.test(n))
}

// ── Corsa ───────────────────────────────────────────────────────────────────

const intensitaValida = (v) => {
  const n = parseFloat(v)
  return Number.isFinite(n) && n >= 1 && n <= 10 ? n : null
}

const misura = (v) => {
  const m = String(v ?? '').trim().match(/^(\d+(?:[.,]\d+)?)\s*(km|m|min)$/i)
  if (!m) return null
  const n = parseFloat(m[1].replace(',', '.'))
  const u = m[2].toLowerCase()
  return u === 'km' ? { metri: n * 1000 } : u === 'm' ? { metri: n } : { minuti: n }
}

const km = (metri) => String(metri >= 10000 ? Math.round(metri / 1000) : Math.round(metri / 100) / 10)

const candidatiRipetute = (rip) => {
  const giri = parseInt(rip?.rounds, 10)
  const m = misura(rip?.runDuration)
  const facile = (intensitaValida(rip?.runIntensity) ?? 8) <= 6
  if (m?.metri) {
    const d = m.metri
    const serie = Number.isFinite(giri) && giri > 0 ? `${giri}×${d < 1000 ? d : `${km(d)}K`}` : null
    if (d < 1000) {
      const tipo = facile ? ['Aerobic', 'Tempo'] : d <= 400 ? ['VO2max', 'Speed', 'Track'] : ['VO2max', 'Interval']
      return unici([...tipo.map(t => `${t} ${d}s`), `${d}s Repeats`, serie && `${serie} Repeats`,
        d <= 400 ? 'Speed Session' : 'Interval Session', d <= 400 ? 'Track Session' : 'VO2max Session'])
    }
    const tipo = facile ? ['Tempo', 'Aerobic'] : d <= 1200 ? ['VO2max', 'Threshold'] : ['Threshold', 'Cruise']
    return unici([...tipo.map(t => `${t} ${km(d)}K`), `${km(d)}K Repeats`, serie && `${serie} Repeats`,
      d > 1200 ? 'Cruise Intervals' : 'Interval Session', d > 1200 ? 'Tempo Repeats' : 'VO2max Session'])
  }
  if (m?.minuti) {
    const min = m.minuti
    const tipo = facile ? 'Tempo' : min <= 2 ? 'Speed' : min <= 5 ? 'VO2max' : 'Threshold'
    return [`${min}′ Repeats`, `${tipo} Intervals`, `${tipo} ${min}′`, `${tipo} Session`]
  }
  return ['Interval Session', 'Repeats Session', 'Speed Session']
}

const candidatiCorsa = (steps = []) => {
  if (!steps.length) return []
  const rip = steps.find(s => s?.type === 'repeat')
  if (rip) return candidatiRipetute(rip)

  const corse = steps.filter(s => s?.type === 'run')
  const intensita = corse.map(s => intensitaValida(s.intensity))
  const r = riepilogoCorsa(steps)
  const K = r.puroDistanza && r.metri > 0 ? `${km(r.metri)}K` : null
  const M = r.puroTempo && r.minuti > 0 ? `${Math.round(r.minuti)}′` : null
  const misuraNome = K || M

  if (intensita.length >= 2 && intensita.every((v, i) => v !== null && (i === 0 || v > intensita[i - 1]))) {
    return unici(['Progression Run', 'Fast Finish', 'Negative Split', 'Build Run', misuraNome && `Progression ${misuraNome}`])
  }
  const lungo = (r.puroDistanza && r.metri >= 15000) || (r.puroTempo && r.minuti >= 75)
  const max = Math.max(...intensita.filter(v => v !== null), 0) || null
  const z2 = corse.some(s => String(s.pace || '').trim() === 'Z2')

  if (lungo) {
    return unici(['Long Run', 'Long Run Easy', 'Zone 2 Long', 'Sunday Long Run', 'Endurance Run', misuraNome && `Long ${misuraNome}`])
  }
  if (max >= 8) return unici(['Race Pace', 'Time Trial', 'Hard Run', misuraNome && `${misuraNome} Test`])
  if (max >= 6) return unici(['Tempo Run', 'Threshold Run', 'Steady State', misuraNome && `Tempo ${misuraNome}`])
  return unici([z2 && 'Zone 2 Run', 'Easy Run', 'Recovery Run', 'Aerobic Base', !z2 && 'Zone 2 Run', misuraNome && `Easy ${misuraNome}`])
}

// ── Scelta ──────────────────────────────────────────────────────────────────

/** I nomi pertinenti a un workout, sempre nello stesso ordine. Vuoto se non c'è ancora contenuto. */
export function candidatiNome({ category, blocks = [], steps = [] } = {}) {
  if (category === 'Hyrox') return candidatiHyrox(blocks)
  if (category === 'Running') return candidatiCorsa(steps)
  return []
}

/** Un seme nuovo: sceglie QUALE candidato usare. */
export const nuovoSeme = (rng = Math.random) => Math.floor(rng() * 1e6)

/** Il candidato che il seme indica, o null se non ce ne sono. */
export const scegliNome = (candidati, seme) =>
  candidati.length ? candidati[seme % candidati.length] : null

const chiave = (nome) => String(nome ?? '').trim().toLowerCase()
const senzaNumero = (nome) => String(nome ?? '').trim().replace(/ \d+$/, '')

/**
 * Il primo candidato, a partire dal seme, che nessun altro workout usa
 * (confronto senza maiuscole). Se sono tutti presi si numera.
 */
export function nomeLibero(candidati, usati = [], seme = 0) {
  if (!candidati.length) return null
  const presi = new Set(usati.map(chiave))
  for (let i = 0; i < candidati.length; i++) {
    const c = candidati[(seme + i) % candidati.length]
    if (!presi.has(chiave(c))) return c
  }
  const base = scegliNome(candidati, seme)
  let n = 2
  while (presi.has(chiave(`${base} ${n}`))) n++
  return `${base} ${n}`
}

/** Vero se il nome è uno dei candidati del workout (anche numerato: «Sled Grinder 2»). */
export const eNomeGenerato = (nome, candidati) =>
  !!nome && candidati.includes(senzaNumero(nome))

/**
 * I nomi di tutti i workout già salvati, senza codice in coda. Una lettura
 * sola, al salvataggio: se fallisce si torna un elenco vuoto e il salvataggio
 * prosegue — un nome ripetuto è un fastidio, un workout perso no.
 */
export async function nomiGiaUsati(supabase) {
  try {
    const { data } = await supabase.from('workouts').select('title')
    return (data || []).map(w => separaCodice(w.title).nome).filter(Boolean)
  } catch {
    return []
  }
}
