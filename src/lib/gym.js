/**
 * La categoria Gym: la scheda da palestra classica (13/10/2026).
 *
 * Richiesta del committente: una categoria accanto a Hyrox, Corsa e Custom
 * per le schede da sala pesi — esercizi, serie, ripetizioni, carichi. Il
 * modello viene dalle app che lo fanno già (le app per coach come Trainerize,
 * TrueCoach ed Everfit, e i diari di allenamento come Hevy e Strong), con le
 * scelte del committente:
 * - la serie si scrive SEMPLICE («4 × 10 · 60 kg · rec 1:30») e, solo se
 *   serve, serie per serie (piramidale, riscaldamento, drop set, cedimento);
 * - la scheda ha tre FASI (riscaldamento, parte principale, defaticamento) e
 *   dentro le fasi esercizi singoli o raggruppati in superserie e circuiti;
 * - l'atleta la vede con un timer di recupero fra le serie.
 *
 * Il formato, in `workouts.sections.gym` (jsonb, nessuna migrazione):
 *
 *   { id, fase: 'riscaldamento'|'principale'|'defaticamento',
 *     serie: '4',          // serie, o giri di una superserie/circuito
 *     recupero: '1:30',    // dopo ogni serie (o giro), m:ss; '' = nessuno
 *     note: '',
 *     esercizi: [{ id, name,
 *       reps: '10' | '8-12' | 'Max',   // esercizi a ripetizioni
 *       durata: '0:30',                // esercizi a tempo (plank, cardio)
 *       kg: '60 kg' | '',              // '' = corpo libero
 *       rir: '' | '0'…'4',  cadenza: '3-1-1-0',  notes: '',
 *       dettaglio: [{ tipo, reps, kg }] // facoltativo, solo esercizi singoli
 *     }] }
 *
 * Un GRUPPO con un esercizio è un esercizio singolo; con due una superserie,
 * con tre una triserie, con quattro o più un circuito. Il tipo non si salva:
 * si legge dal numero di esercizi, così non può mai contraddirlo.
 *
 * 🔴 `serie` di un gruppo con `dettaglio` è IGNORATO: le serie sono le righe
 * del dettaglio. Chi legge il numero di serie passa da `serieDi`.
 */

import { trovaEsercizioGym, voceGym } from './eserciziGym'

// ── Le fasi ──────────────────────────────────────────────────────────────

export const FASI_GYM = [
  { id: 'riscaldamento', nome: 'Riscaldamento' },
  { id: 'principale', nome: 'Parte principale' },
  { id: 'defaticamento', nome: 'Defaticamento' },
]

const ID_FASI = FASI_GYM.map(f => f.id)

/** La fase di un gruppo, con la parte principale come ripiego. */
export const faseDi = (gruppo) => (ID_FASI.includes(gruppo?.fase) ? gruppo.fase : 'principale')

/**
 * Porta un gruppo in un'altra fase («Cambia fase» del foglio, 14/10/2026):
 * l'IA a volte mette nel riscaldamento quello che va nella parte principale.
 * Il gruppo resta com'è — esercizi, serie, recupero, note — e va in fondo
 * alla fase nuova: l'ordine dentro una fase è l'ordine dell'elenco.
 */
export const spostaInFase = (gruppi = [], id, fase) => {
  const g = (gruppi || []).find(x => x.id === id)
  if (!g || !ID_FASI.includes(fase) || faseDi(g) === fase) return gruppi
  return [...gruppi.filter(x => x.id !== id), { ...g, fase }]
}

/** I gruppi nell'ordine delle fasi, mantenendo l'ordine dentro ciascuna. */
export const gruppiInOrdine = (gruppi = []) =>
  FASI_GYM.flatMap(f => (gruppi || []).filter(g => faseDi(g) === f.id))

// ── I tipi di serie del dettaglio ─────────────────────────────────────────

export const TIPI_SERIE = [
  { id: 'normale', sigla: '', nome: 'Normale' },
  { id: 'riscaldamento', sigla: 'R', nome: 'Riscaldamento' },
  { id: 'drop', sigla: 'D', nome: 'Drop set' },
  { id: 'cedimento', sigla: 'C', nome: 'A cedimento' },
]

export const tipoSerie = (id) => TIPI_SERIE.find(t => t.id === id) || TIPI_SERIE[0]

/** Il tipo dopo questo, in giro: è il gesto del tocco sulla sigla. */
export const tipoSerieDopo = (id) => {
  const i = TIPI_SERIE.findIndex(t => t.id === id)
  return TIPI_SERIE[(i + 1) % TIPI_SERIE.length].id
}

// ── Numeri e testi ───────────────────────────────────────────────────────

const pieno = (v) => v != null && String(v).trim() !== '' && v !== '-'

const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

/**
 * I secondi di un tempo scritto in uno dei modi in cui lo scrive un coach (o
 * un'IA): «1:30», «90"», «90 sec», «90s», «2 min», «2'». Un numero nudo sotto
 * i 10 sono minuti, da 10 in su secondi: nessuno programma 90 minuti di
 * recupero, né un recupero di 3 secondi. `null` se non si capisce.
 */
export const secondiGym = (v) => {
  const s = String(v ?? '').trim().toLowerCase().replace(',', '.')
  if (!s || s === '-') return null
  let m = s.match(/^(\d{1,3}):(\d{1,2})$/)
  if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
  m = s.match(/^(\d+(?:\.\d+)?)\s*(?:min|minuti|minuto|m|'|′)$/)
  if (m) return Math.round(parseFloat(m[1]) * 60)
  m = s.match(/^(\d+)\s*(?:sec|secondi|secondo|s|"|″)$/)
  if (m) return parseInt(m[1], 10)
  m = s.match(/^(\d+(?:\.\d+)?)$/)
  if (m) {
    const n = parseFloat(m[1])
    return n < 10 ? Math.round(n * 60) : Math.round(n)
  }
  return null
}

/** Un tempo nel formato del builder («1:30»), o '' se non si capisce. */
export const tempoGym = (v) => {
  const s = secondiGym(v)
  return s ? mmss(s) : ''
}

/** «0:30» → «30″», «10:00» → «10′», «1:30» → «1:30». */
export const testoTempo = (v) => {
  const s = secondiGym(v)
  if (!s) return ''
  if (s < 60) return `${s}″`
  if (s % 60 === 0) return `${s / 60}′`
  return mmss(s)
}

/** «8-12» → «8–12», «Max» → «max». */
export const testoReps = (r) => {
  if (!pieno(r)) return ''
  const s = String(r).trim()
  if (/^max$/i.test(s)) return 'max'
  return s.replace(/\s*-\s*/, '–')
}

/** «60 kg» → «60 kg», «62.5 kg» → «62,5 kg», «60» → «60 kg», '' → ''. */
export const testoCarico = (kg) => {
  if (!pieno(kg)) return ''
  const s = String(kg).trim().replace('.', ',')
  return /kg$/i.test(s) ? s : `${s} kg`
}

/** Il carico nel formato del builder: «60» o «60kg» → «60 kg». */
export const caricoGym = (kg) => {
  if (!pieno(kg)) return ''
  const s = String(kg).trim().replace(',', '.').replace(/\s*kg$/i, '')
  const n = parseFloat(s)
  if (/^\d+(?:\.\d+)?$/.test(s) && n > 0) return `${n} kg`
  return String(kg).trim()
}

/** Le ripetizioni nel formato del builder: «8 - 12» → «8-12», «MAX» → «Max». */
export const repsGym = (r) => {
  if (!pieno(r)) return ''
  const s = String(r).trim()
  if (/^(max|cedimento|a cedimento)$/i.test(s)) return 'Max'
  const m = s.match(/^(\d+)\s*(?:-|–|a)\s*(\d+)$/)
  if (m) return `${m[1]}-${m[2]}`
  const n = s.match(/^(\d+)/)
  return n ? n[1] : s
}

// ── Gruppi ───────────────────────────────────────────────────────────────

export const esercizioATempo = (ex) => voceGym(ex?.name).misura === 'tempo'

/** Che cos'è un gruppo, dal numero dei suoi esercizi. */
export const tipoGruppo = (gruppo) => {
  const n = gruppo?.esercizi?.length || 0
  if (n <= 1) return 'singolo'
  if (n === 2) return 'superserie'
  if (n === 3) return 'triserie'
  return 'circuito'
}

export const NOME_TIPO_GRUPPO = { singolo: 'Esercizio', superserie: 'Superserie', triserie: 'Triserie', circuito: 'Circuito' }

/** Vero se il gruppo è un esercizio singolo con le serie scritte una per una. */
export const conDettaglio = (gruppo) =>
  tipoGruppo(gruppo) === 'singolo' && Array.isArray(gruppo?.esercizi?.[0]?.dettaglio) && gruppo.esercizi[0].dettaglio.length > 0

/** Quante serie (o giri) fa un gruppo. */
export const serieDi = (gruppo) => {
  if (conDettaglio(gruppo)) return gruppo.esercizi[0].dettaglio.length
  const n = parseInt(gruppo?.serie, 10)
  return Number.isFinite(n) && n > 0 ? n : 1
}

const nuovoId = () => Math.random()

/** Una copia dell'oggetto senza la chiave `k`. */
const senza = (o, k) => {
  const copia = { ...o }
  delete copia[k]
  return copia
}

/** Un esercizio nuovo con i valori di partenza della sua voce. */
export const nuovoEsercizioGym = (nome, fase = 'principale') => {
  const voce = voceGym(nome)
  const ex = { id: nuovoId(), name: voce.nome, kg: '', notes: '' }
  if (voce.misura === 'tempo') {
    ex.durata = voce.muscolo === 'Cardio' || voce.muscolo === 'Mobilità' ? (fase === 'principale' ? '20:00' : '10:00') : '0:30'
  } else {
    ex.reps = fase === 'principale' ? '10' : '12'
  }
  return ex
}

/**
 * Lo stesso esercizio con un altro nome: è il «Cambia» del foglio, per quando
 * l'IA (o la mano) ha messo il movimento sbagliato. Si tiene quello che il
 * coach ha già scritto — id, note, cadenza, RIR, serie per serie — finché ha
 * ancora senso: passare da ripetizioni a tempo (o viceversa) riparte dai
 * valori di un esercizio nuovo, perché «10» ripetizioni non sono 10 secondi.
 */
export const cambiaEsercizioGym = (esercizio, nome, fase = 'principale') => {
  const voce = voceGym(nome)
  const nuovo = nuovoEsercizioGym(nome, fase)
  const stessaMisura = voceGym(esercizio.name).misura === voce.misura
  const fuori = { ...esercizio, name: nuovo.name }
  if (!stessaMisura) {
    delete fuori.reps
    delete fuori.durata
    delete fuori.dettaglio
    delete fuori.rir
    delete fuori.cadenza
    Object.assign(fuori, voce.misura === 'tempo' ? { durata: nuovo.durata } : { reps: nuovo.reps })
    if (voce.carico === false) fuori.kg = ''
  }
  return fuori
}

/** Un gruppo nuovo con un esercizio. Riscaldamento e defaticamento partono da una serie, senza recupero. */
export const nuovoGruppoGym = (fase, nome) => {
  const principale = fase === 'principale'
  return {
    id: nuovoId(),
    fase: ID_FASI.includes(fase) ? fase : 'principale',
    serie: principale ? '3' : '1',
    recupero: principale ? '1:30' : '',
    note: '',
    esercizi: [nuovoEsercizioGym(nome, fase)],
  }
}

/** Il dettaglio serie per serie che parte dai valori semplici. */
export const dettaglioDaSemplice = (gruppo) => {
  const ex = gruppo.esercizi[0]
  const n = serieDi(gruppo)
  return Array.from({ length: n }, () => ({ tipo: 'normale', reps: ex.reps || '', kg: ex.kg || '' }))
}

/**
 * Torna ai valori semplici dal dettaglio: le serie sono quante righe c'erano,
 * ripetizioni e carico quelli dell'ultima serie normale (la serie «di lavoro»).
 */
export const sempliceDaDettaglio = (gruppo) => {
  const ex = gruppo.esercizi[0]
  const righe = ex.dettaglio || []
  const lavoro = [...righe].reverse().find(r => r.tipo === 'normale') || righe[righe.length - 1] || {}
  const resto = senza(ex, 'dettaglio')
  return {
    ...gruppo,
    serie: String(righe.length || serieDi(gruppo)),
    esercizi: [{ ...resto, reps: lavoro.reps || ex.reps || '', kg: lavoro.kg ?? ex.kg ?? '' }],
  }
}

// ── Le etichette A, B1, B2… ──────────────────────────────────────────────

/**
 * Le lettere delle schede da palestra: ogni gruppo una lettera, gli esercizi
 * di una superserie numerati dentro la lettera (A · B1 B2 · C). Contano su
 * tutta la scheda, fasi comprese, nell'ordine in cui la scheda si legge.
 * Torna una mappa id del gruppo → etichette dei suoi esercizi.
 */
export const etichetteGym = (gruppi = []) => {
  const mappa = new Map()
  gruppiInOrdine(gruppi).forEach((g, i) => {
    const lettera = i < 26 ? String.fromCharCode(65 + i) : String(i + 1)
    const n = g.esercizi?.length || 0
    mappa.set(g.id, n <= 1 ? [lettera] : g.esercizi.map((_, j) => `${lettera}${j + 1}`))
  })
  return mappa
}

// ── I riassunti ──────────────────────────────────────────────────────────

/** Quanto si fa in una serie: «10», «8–12», «30″», «max». */
export const quantoEsercizio = (ex) => (esercizioATempo(ex) ? testoTempo(ex?.durata) : testoReps(ex?.reps))

/**
 * La riga di un esercizio: «4 × 10 · 60 kg · RIR 2». In una superserie le
 * serie sono del gruppo (i giri), quindi la riga dice solo «10 · 40 kg».
 * Con il dettaglio dice quante serie e come cambiano: «4 serie · 12-10-8-6 · 60–80 kg».
 */
export const riassuntoEsercizio = (gruppo, ex) => {
  const parti = []
  const singolo = tipoGruppo(gruppo) === 'singolo'
  if (singolo && conDettaglio(gruppo)) {
    const righe = ex.dettaglio
    parti.push(`${righe.length} serie`)
    const reps = righe.map(r => testoReps(r.reps)).filter(Boolean)
    if (reps.length) parti.push(new Set(reps).size === 1 ? reps[0] : reps.join('-'))
    const kg = righe.map(r => parseFloat(String(r.kg).replace(',', '.'))).filter(n => Number.isFinite(n) && n > 0)
    if (kg.length) {
      const min = Math.min(...kg)
      const max = Math.max(...kg)
      parti.push(min === max ? testoCarico(String(min)) : `${String(min).replace('.', ',')}–${testoCarico(String(max))}`)
    }
  } else {
    const quanto = quantoEsercizio(ex)
    if (singolo) parti.push(quanto ? `${serieDi(gruppo)} × ${quanto}` : `${serieDi(gruppo)} serie`)
    else if (quanto) parti.push(quanto)
    const kg = testoCarico(ex?.kg)
    if (kg) parti.push(kg)
  }
  if (pieno(ex?.rir)) parti.push(`RIR ${ex.rir}`)
  if (pieno(ex?.cadenza)) parti.push(`cad. ${ex.cadenza}`)
  return parti.join(' · ')
}

/** La riga di un gruppo con più esercizi: «Superserie · 3 giri · rec 1:30». */
export const riassuntoGruppo = (gruppo) => {
  const giri = serieDi(gruppo)
  const parti = [NOME_TIPO_GRUPPO[tipoGruppo(gruppo)], `${giri} ${giri === 1 ? 'giro' : 'giri'}`]
  const rec = testoTempo(gruppo?.recupero)
  if (rec) parti.push(`rec ${rec}`)
  return parti.join(' · ')
}

// ── La durata stimata ────────────────────────────────────────────────────

/** Secondi per ripetizione: una serie da 10 dura una quarantina di secondi. */
export const SECONDI_PER_REP_GYM = 4
/** Le ripetizioni di una serie «Max» o senza numero. */
export const REPS_IGNOTE = 10
/** Il cambio di esercizio: carichi, posizione, macchina libera. */
export const SECONDI_CAMBIO = 60

const repsMedie = (r) => {
  const s = String(r ?? '').trim()
  const m = s.match(/^(\d+)\s*-\s*(\d+)$/)
  if (m) return (parseInt(m[1], 10) + parseInt(m[2], 10)) / 2
  const n = parseInt(s, 10)
  return Number.isFinite(n) && n > 0 ? n : REPS_IGNOTE
}

const lavoroEsercizio = (ex, reps = ex?.reps) => {
  if (esercizioATempo(ex)) return secondiGym(ex?.durata) || 30
  return repsMedie(reps) * SECONDI_PER_REP_GYM
}

/**
 * Quanto dura un gruppo, in secondi. È una STIMA, come quella dei blocchi
 * Hyrox: il tempo sotto carico lo fa l'atleta. Le serie sommano il lavoro,
 * i recuperi fra una serie e l'altra (non dopo l'ultima) e un cambio
 * d'esercizio.
 */
export const durataGruppoGym = (gruppo) => {
  const esercizi = gruppo?.esercizi || []
  if (!esercizi.length) return 0
  const recupero = secondiGym(gruppo?.recupero) || 0
  if (conDettaglio(gruppo)) {
    const ex = esercizi[0]
    const lavoro = ex.dettaglio.reduce((t, r) => t + lavoroEsercizio(ex, r.reps), 0)
    return Math.round(lavoro + (ex.dettaglio.length - 1) * recupero + SECONDI_CAMBIO)
  }
  const serie = serieDi(gruppo)
  const giro = esercizi.reduce((t, ex) => t + lavoroEsercizio(ex), 0)
  return Math.round(serie * giro + (serie - 1) * recupero + SECONDI_CAMBIO)
}

/** I tre numeri in cima: durata stimata, esercizi e serie totali. */
export const riepilogoGym = (gruppi = []) => {
  let secondi = 0
  let esercizi = 0
  let serie = 0
  for (const g of gruppi || []) {
    secondi += durataGruppoGym(g)
    esercizi += g.esercizi?.length || 0
    serie += serieDi(g) * (g.esercizi?.length || 0)
  }
  return { secondi, esercizi, serie }
}

/** I minuti stimati di una scheda, come li vuole `durataWorkout`. */
export const minutiGym = (gruppi = []) => Math.round(riepilogoGym(gruppi).secondi / 60)

// ── I muscoli e il nome automatico ───────────────────────────────────────

/** I gruppi muscolari della parte principale, dal più presente. */
export const muscoliGym = (gruppi = []) => {
  const conti = new Map()
  for (const g of gruppi || []) {
    if (faseDi(g) !== 'principale') continue
    for (const ex of g.esercizi || []) {
      const m = trovaEsercizioGym(ex?.name)?.muscolo
      if (m && m !== 'Cardio' && m !== 'Mobilità') conti.set(m, (conti.get(m) || 0) + 1)
    }
  }
  return [...conti.entries()].sort((a, b) => b[1] - a[1]).map(([m]) => m)
}

const SPINTA = new Set(['Petto', 'Spalle', 'Tricipiti'])
const TRAZIONE = new Set(['Dorso', 'Bicipiti'])
const GAMBE = new Set(['Quadricipiti', 'Femorali e glutei', 'Polpacci'])

/**
 * I nomi pertinenti a una scheda Gym, nel gergo della sala: «Push Day»,
 * «Petto e Tricipiti», «Leg Day», «Full Body». Vuoto finché non c'è un
 * esercizio riconosciuto. Stessa idea di `candidatiNome` per Hyrox e Corsa.
 */
export const candidatiNomeGym = (gruppi = []) => {
  const muscoli = muscoliGym(gruppi)
  if (!muscoli.length) return []
  const tutti = new Set(muscoli)
  const solo = (insieme) => muscoli.every(m => insieme.has(m) || m === 'Addome')
  const coppia = muscoli.filter(m => m !== 'Addome').slice(0, 2)
  const nomeCoppia = coppia.length === 2 ? `${coppia[0]} e ${coppia[1]}` : coppia[0]
  const nomi = []
  if (solo(SPINTA)) nomi.push('Push Day', 'Spinta')
  if (solo(TRAZIONE)) nomi.push('Pull Day', 'Trazione')
  if (solo(GAMBE)) nomi.push('Leg Day', 'Gambe', 'Lower Body')
  if (solo(new Set([...SPINTA, ...TRAZIONE])) && [...tutti].some(m => SPINTA.has(m)) && [...tutti].some(m => TRAZIONE.has(m))) {
    nomi.push('Upper Body', 'Parte alta')
  }
  const haGambe = muscoli.some(m => GAMBE.has(m))
  const haAlto = muscoli.some(m => SPINTA.has(m) || TRAZIONE.has(m))
  if (haGambe && haAlto) nomi.push('Full Body', 'Total Body')
  if (nomeCoppia) nomi.push(nomeCoppia)
  if (muscoli.length === 1 && muscoli[0] === 'Addome') nomi.push('Core', 'Addome')
  return [...new Set(nomi)]
}

/** Il codice in coda al titolo: «GYM 60′ @7». */
export const SIGLA_GYM = 'GYM'

// ── Per l'IA ─────────────────────────────────────────────────────────────

/** Quello che l'IA legge in una modifica: la scheda senza gli id. */
export const gymPerIA = (gruppi = []) => (gruppi || []).map(g => ({
  ...senza(g, 'id'),
  esercizi: (g.esercizi || []).map(ex => senza(ex, 'id')),
}))

const FASI_PER_NOME = {
  riscaldamento: 'riscaldamento', warmup: 'riscaldamento', 'warm up': 'riscaldamento', 'warm-up': 'riscaldamento',
  principale: 'principale', 'parte principale': 'principale', main: 'principale', centrale: 'principale', lavoro: 'principale',
  defaticamento: 'defaticamento', cooldown: 'defaticamento', 'cool down': 'defaticamento', 'cool-down': 'defaticamento', stretching: 'defaticamento',
}

const testo = (v) => (v == null ? '' : String(v).trim())

const preparaEsercizio = (ex, fase) => {
  const voce = trovaEsercizioGym(ex?.name)
  const nome = voce?.nome || testo(ex?.name) || 'Esercizio'
  const fuori = { id: nuovoId(), name: nome, kg: caricoGym(ex?.kg), notes: testo(ex?.notes) }
  const aTempo = voce ? voce.misura === 'tempo' : (!pieno(ex?.reps) && pieno(ex?.durata))
  if (aTempo) fuori.durata = tempoGym(ex?.durata) || nuovoEsercizioGym(nome, fase).durata
  else fuori.reps = repsGym(ex?.reps)
  if (pieno(ex?.rir)) fuori.rir = testo(ex.rir)
  if (pieno(ex?.cadenza)) fuori.cadenza = testo(ex.cadenza)
  if (Array.isArray(ex?.dettaglio) && ex.dettaglio.length > 0) {
    fuori.dettaglio = ex.dettaglio.map(r => ({
      tipo: TIPI_SERIE.some(t => t.id === r?.tipo) ? r.tipo : 'normale',
      reps: repsGym(r?.reps),
      kg: caricoGym(r?.kg),
    }))
  }
  return fuori
}

/**
 * La scheda scritta dall'IA, resa uguale a una fatta a mano: id nuovi, fasi
 * valide, nomi della libreria, numeri nel formato del builder. Un valore che
 * l'IA non ha detto resta vuoto: nessun numero inventato. Un esercizio
 * arrivato «nudo» (senza gruppo) diventa un gruppo di un esercizio.
 */
export const preparaGymIA = (risultato) => {
  if (!Array.isArray(risultato)) return []
  return risultato.filter(g => g && typeof g === 'object').map(g => {
    const grezzi = Array.isArray(g.esercizi) ? g.esercizi : (g.name ? [g] : [])
    const fase = FASI_PER_NOME[testo(g.fase).toLowerCase()] || 'principale'
    const esercizi = grezzi.filter(ex => ex && typeof ex === 'object').map(ex => preparaEsercizio(ex, fase))
    if (esercizi.length !== 1) esercizi.forEach(ex => { delete ex.dettaglio })
    const serie = parseInt(g.serie, 10)
    return {
      id: nuovoId(),
      fase,
      serie: Number.isFinite(serie) && serie > 0 ? String(serie) : (fase === 'principale' ? '3' : '1'),
      recupero: tempoGym(g.recupero),
      note: testo(g.note),
      esercizi,
    }
  }).filter(g => g.esercizi.length > 0)
}

// ── Per la storia, il PDF e il testo ─────────────────────────────────────

/** I gruppi nella forma di `recapStoria` (intestazione + righe). */
export const gruppiPerElenco = (gruppi = []) => {
  const etichette = etichetteGym(gruppi)
  return gruppiInOrdine(gruppi).map(g => {
    const lettere = etichette.get(g.id) || []
    const singolo = tipoGruppo(g) === 'singolo'
    return {
      intestazione: singolo ? null : { genere: 'blocco', titolo: NOME_TIPO_GRUPPO[tipoGruppo(g)], dettaglio: riassuntoGruppo(g).split(' · ').slice(1).join(' · ') },
      esercizi: (g.esercizi || []).map((ex, j) => ({
        genere: 'esercizio',
        nome: `${lettere[j] ? `${lettere[j]}. ` : ''}${ex?.name || 'Esercizio'}`,
        specifiche: [riassuntoEsercizio(g, ex), singolo && testoTempo(g.recupero) ? `rec ${testoTempo(g.recupero)}` : '']
          .filter(Boolean).join(' · '),
      })),
    }
  })
}

/**
 * La scheda come righe di testo, per il PDF: il nome della fase, poi un
 * gruppo per riga (o un'intestazione e le sue righe), con le note.
 */
export const righeTestoGym = (gruppi = []) => {
  const righe = []
  const etichette = etichetteGym(gruppi)
  for (const f of FASI_GYM) {
    const della = (gruppi || []).filter(g => faseDi(g) === f.id)
    if (!della.length) continue
    righe.push({ genere: 'fase', testo: f.nome })
    for (const g of della) {
      const lettere = etichette.get(g.id) || []
      const singolo = tipoGruppo(g) === 'singolo'
      if (!singolo) righe.push({ genere: 'gruppo', testo: riassuntoGruppo(g) })
      g.esercizi.forEach((ex, j) => {
        const rec = singolo && testoTempo(g.recupero) ? ` · rec ${testoTempo(g.recupero)}` : ''
        righe.push({ genere: 'esercizio', testo: `${lettere[j] || ''}. ${ex.name} — ${riassuntoEsercizio(g, ex)}${rec}`, rientro: !singolo })
        if (pieno(ex.notes)) righe.push({ genere: 'nota', testo: ex.notes, rientro: true })
      })
      if (pieno(g.note)) righe.push({ genere: 'nota', testo: g.note, rientro: true })
    }
  }
  return righe
}
