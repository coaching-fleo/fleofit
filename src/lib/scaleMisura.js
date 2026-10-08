// scaleMisura.js — le scale del righello del builder.
//
// Una SCALA è l'elenco ordinato dei valori che un righello può prendere, con
// gli scatti che hanno senso per quella misura: le ripetizioni vanno di uno,
// il peso di mezzo chilo fin dove contano i manubri e poi di 2,5, il tempo di
// cinque secondi sotto il minuto e di quindici fino a dieci minuti. È la
// ragione per cui il righello non chiede ottanta tocchi per arrivare a 80 kg,
// che era il difetto del meno/più dentro le liste complete.
//
// 🔴 `valore` è la stringa che finisce in `workouts.sections`, ed è LA STESSA
// di prima ("15", "9 kg", "250m", "1:30", "3:50 /km", "45 min", "1.5 km"):
// il database è condiviso con la web app in produzione (CLAUDE.md §1.1), che
// legge quelle stringhe così come sono. Una scala nuova cambia il gesto, mai
// il formato. `__tests__/scaleMisura.test.js` lo verifica contro le liste che
// il builder usava prima e contro i lettori della durata.
//
// `etichetta` è quello che il righello mostra grande (senza unità, con la
// virgola italiana); `tacca` è il numero scritto sotto le tacche maggiori, e
// c'è solo dove serve a orientarsi — una tacca ogni quattro o cinque.

const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
const virgola = (n) => String(n).replace('.', ',')

/** I numeri da `da` ad `a` compresi, a passi di `passo`, senza errori di virgola. */
const intervallo = (da, a, passo) => {
  const fuori = []
  const n = Math.round((a - da) / passo)
  for (let i = 0; i <= n; i++) fuori.push(Math.round((da + i * passo) * 100) / 100)
  return fuori
}

const voce = (valore, etichetta, tacca = null) => ({ valore, etichetta, tacca })

// ── Le scale ──────────────────────────────────────────────────────────────

const RIPETIZIONI = intervallo(1, 100, 1)
  .map(n => voce(String(n), String(n), n % 5 === 0 ? String(n) : null))

const ROUND = intervallo(1, 40, 1)
  .map(n => voce(String(n), String(n), n === 1 || n % 5 === 0 ? String(n) : null))

const RIPETUTE = intervallo(1, 30, 1)
  .map(n => voce(String(n), String(n), n === 1 || n % 5 === 0 ? String(n) : null))

// Mezzo chilo fino a 20 (manubri, kettlebell, wall ball), poi 2,5 come i dischi.
const PESO = [...intervallo(0.5, 20, 0.5), ...intervallo(22.5, 300, 2.5)]
  .map(n => voce(`${n} kg`, virgola(n), (n <= 20 ? n % 2 === 0 : n % 10 === 0) ? virgola(n) : null))

// «2x24 kg»: due attrezzi uguali. Un chilo alla volta, come le coppie di
// kettlebell e manubri che esistono davvero.
const PESO_DOPPIO = intervallo(1, 50, 1)
  .map(n => voce(`2x${n} kg`, `2×${n}`, n % 5 === 0 ? String(n) : null))

// Dieci metri dove si misurano slitta, carry e affondi; poi cinquanta fino al
// chilometro; poi cento fino ai due chilometri di remoergometro; poi cinquecento.
const METRI = [...intervallo(10, 300, 10), ...intervallo(350, 1000, 50), ...intervallo(1100, 2000, 100), ...intervallo(2500, 5000, 500)]
  .map(n => voce(`${n}m`, String(n), (n <= 300 ? n % 50 === 0 : n <= 1000 ? n % 250 === 0 : n <= 2000 ? n % 500 === 0 : n % 1000 === 0) ? String(n) : null))

const tempi = (tratti) => {
  const secondi = []
  for (const [da, a, passo] of tratti) {
    for (const s of intervallo(da, a, passo)) if (!secondi.includes(s)) secondi.push(s)
  }
  return secondi
}

// Cinque secondi sotto il minuto, quindici fino a dieci minuti, trenta fino a
// mezz'ora, un minuto fino a due ore: lo scatto cresce con la durata, come la
// precisione che serve a un coach.
const TEMPO = tempi([[5, 60, 5], [75, 600, 15], [630, 1800, 30], [1860, 7200, 60]])
  .map(s => voce(mmss(s), mmss(s),
    (s <= 60 ? s % 15 === 0 : s <= 600 ? s % 60 === 0 : s <= 1800 ? s % 150 === 0 : s % 300 === 0) ? mmss(s) : null))

// Il recupero fra un esercizio e l'altro: più fitto, e si ferma a quindici minuti.
const RECUPERO = tempi([[5, 60, 5], [75, 300, 15], [330, 900, 30]])
  .map(s => voce(mmss(s), mmss(s), (s <= 60 ? s % 15 === 0 : s <= 300 ? s % 60 === 0 : s % 150 === 0) ? mmss(s) : null))

// Il passo: un'unica scala fitta, cinque secondi alla volta.
const passo = (da, a, unita) => intervallo(da, a, 5)
  .map(s => voce(`${mmss(s)} ${unita}`, mmss(s), s % 30 === 0 ? mmss(s) : null))

// Fino a 9:55 e non 10:00: è dove si fermava la lista di prima.
const PASSO_CORSA = passo(120, 595, '/km')
const PASSO_ERGO = passo(90, 390, '/500m')

const CADENZA = intervallo(40, 120, 5)
  .map(n => voce(`${n} RPM`, String(n), n % 20 === 0 ? String(n) : null))

const VELOCITA = intervallo(5, 25, 0.5)
  .map(n => voce(`${n.toFixed(1)} km/h`, virgola(n.toFixed(1)), Number.isInteger(n) && n % 2 === 0 ? String(n) : null))

// La durata di una fase di corsa si scrive «30 sec» o «45 min»: è il formato
// che le fasi hanno sempre avuto, e `parseDuration` lo legge.
const DURATA_CORSA = [
  ...intervallo(5, 55, 5).map(s => voce(`${s} sec`, `${s}″`, s % 15 === 0 ? `${s}″` : null)),
  ...intervallo(1, 180, 1).map(m => voce(`${m} min`, `${m}′`, m === 1 || m % 5 === 0 ? `${m}′` : null)),
]

// La distanza di una fase: metri fino al chilometro, poi chilometri. «1 km» e
// non «1000m» perché è la voce che la lista di prima usava per il chilometro.
const km = (n) => voce(`${n} km`, virgola(n), Number.isInteger(n) && (n <= 10 || n % 5 === 0) ? virgola(n) : null)
const DISTANZA_CORSA = [
  ...[10, 20, 30, 40, ...intervallo(50, 950, 50)].map(n => voce(`${n}m`, String(n), n % 200 === 0 ? String(n) : null)),
  ...intervallo(1, 10, 0.5).map(km),
  ...intervallo(11, 42, 1).map(km),
]

/**
 * Le scale per nome. `unita` è la parola piccola accanto al numero grande;
 * `tastiera` dice che tastiera aprire quando si tocca il numero per scriverlo.
 */
export const SCALE = {
  ripetizioni: { voci: RIPETIZIONI, unita: 'reps', tastiera: 'numeric', partenza: '10' },
  round: { voci: ROUND, unita: 'round', tastiera: 'numeric', partenza: '5' },
  ripetute: { voci: RIPETUTE, unita: 'volte', tastiera: 'numeric', partenza: '8' },
  peso: { voci: PESO, unita: 'kg', tastiera: 'decimal', partenza: '10 kg' },
  pesoDoppio: { voci: PESO_DOPPIO, unita: 'kg', tastiera: 'numeric', partenza: '2x16 kg' },
  metri: { voci: METRI, unita: 'm', tastiera: 'numeric', partenza: '100m' },
  tempo: { voci: TEMPO, unita: '', tastiera: 'tempo', partenza: '1:00' },
  recupero: { voci: RECUPERO, unita: '', tastiera: 'tempo', partenza: '1:00' },
  passoCorsa: { voci: PASSO_CORSA, unita: '/km', tastiera: 'tempo', partenza: '5:00 /km' },
  passoErgo: { voci: PASSO_ERGO, unita: '/500m', tastiera: 'tempo', partenza: '2:00 /500m' },
  cadenza: { voci: CADENZA, unita: 'RPM', tastiera: 'numeric', partenza: '60 RPM' },
  velocita: { voci: VELOCITA, unita: 'km/h', tastiera: 'decimal', partenza: '10.0 km/h' },
  durataCorsa: { voci: DURATA_CORSA, unita: '', tastiera: 'numeric', partenza: '10 min' },
  distanzaCorsa: { voci: DISTANZA_CORSA, unita: '', tastiera: 'decimal', partenza: '1 km' },
}

// ── Dal valore alla tacca ─────────────────────────────────────────────────

/**
 * Un numero «confrontabile» per una stringa del vocabolario, nella stessa
 * unità delle voci della sua scala: secondi per tempi e passi, metri per le
 * distanze, il numero nudo per il resto. `null` se non è un valore di misura
 * ("-", "Max", "Z2", testo libero).
 */
export const grandezza = (valore) => {
  const s = String(valore ?? '').trim().toLowerCase()
  if (!s || s === '-') return null
  let m = s.match(/^(\d+):(\d{1,2})(?:\s*\/(?:km|500m))?$/)
  if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
  m = s.match(/^(\d+)\s*sec$/)
  if (m) return parseInt(m[1], 10)
  m = s.match(/^(\d+)\s*min$/)
  if (m) return parseInt(m[1], 10) * 60
  m = s.match(/^(\d+(?:[.,]\d+)?)\s*km$/)
  if (m) return parseFloat(m[1].replace(',', '.')) * 1000
  m = s.match(/^2x(\d+(?:[.,]\d+)?)\s*(?:kg)?$/)
  if (m) return parseFloat(m[1].replace(',', '.'))
  m = s.match(/^(\d+(?:[.,]\d+)?)\s*(?:kg|m|rpm|km\/h|reps)?$/)
  if (m) return parseFloat(m[1].replace(',', '.'))
  return null
}

/**
 * La tacca su cui posare il righello per un valore. Se il valore è proprio
 * una voce, è quella; se non lo è — un «1:37» scritto a mano, un vecchio
 * «45 kg» su una scala che va di 2,5 — è la voce più vicina. Il valore NON
 * viene cambiato: il righello si posa vicino, il dato resta quello scritto
 * finché il coach non lo tocca.
 *
 * Se il valore non è una misura ("-", "Max") torna l'indice della voce di
 * partenza della scala, così il righello apre in un punto sensato.
 */
export const indiceVicino = (scala, valore) => {
  const { voci } = scala
  const esatto = voci.findIndex(v => v.valore === valore)
  if (esatto !== -1) return esatto
  const g = grandezza(valore)
  if (g == null) return Math.max(0, voci.findIndex(v => v.valore === scala.partenza))
  let migliore = 0
  let distanza = Infinity
  voci.forEach((v, i) => {
    const d = Math.abs(grandezza(v.valore) - g)
    if (d < distanza) { distanza = d; migliore = i }
  })
  return migliore
}

/** Il valore è esattamente una voce della scala? */
export const eVoce = (scala, valore) => scala.voci.some(v => v.valore === valore)

// ── Dal testo scritto al valore ───────────────────────────────────────────

/**
 * «130» → «1:30», «1.30» → «1:30», «90» sul passo → «1:30 /500m»… solo per
 * le scale di tempo. Regola: con due punti, è già m:ss; senza, le ultime due
 * cifre sono i secondi quando ce ne sono tre o più, altrimenti sono minuti.
 * È il modo in cui si scrive un tempo sul forno a microonde, ed è quello che
 * le dita fanno da sole.
 */
const secondiDaTesto = (testo) => {
  const t = String(testo).trim().replace(/[.,]/g, ':').replace(/\s+/g, '')
  let m = t.match(/^(\d{1,3}):(\d{1,2})$/)
  if (m) {
    const sec = parseInt(m[2], 10)
    return sec < 60 ? parseInt(m[1], 10) * 60 + sec : null
  }
  m = t.match(/^\d{1,5}$/)
  if (!m) return null
  if (t.length >= 3) {
    const sec = parseInt(t.slice(-2), 10)
    return sec < 60 ? parseInt(t.slice(0, -2), 10) * 60 + sec : null
  }
  return parseInt(t, 10) * 60
}

const numeroDaTesto = (testo) => {
  const t = String(testo).trim().replace(',', '.')
  if (!/^\d+(?:\.\d+)?$/.test(t)) return null
  const n = parseFloat(t)
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * Il valore del vocabolario per quello che il coach ha scritto a mano, o
 * `null` se non si capisce. Il numero scritto resta ESATTO — non viene
 * agganciato alla tacca più vicina: chi scrive 83 kg vuole 83 kg.
 */
export const valoreDaTesto = (nome, testo) => {
  switch (nome) {
    case 'tempo':
    case 'recupero': {
      const s = secondiDaTesto(testo)
      return s ? mmss(s) : null
    }
    case 'passoCorsa':
    case 'passoErgo': {
      const s = secondiDaTesto(testo)
      return s ? `${mmss(s)} ${nome === 'passoCorsa' ? '/km' : '/500m'}` : null
    }
    case 'durataCorsa': {
      // Scritto a mano, un numero solo sono minuti: nessuno programma «8 sec».
      const n = numeroDaTesto(testo)
      return n && Number.isInteger(n) ? `${n} min` : null
    }
    case 'distanzaCorsa': {
      // Sotto il 100 è in chilometri («5», «21,1»), da lì in su in metri («400»).
      const n = numeroDaTesto(testo)
      if (!n) return null
      return n < 100 ? `${n} km` : `${Math.round(n)}m`
    }
    case 'peso': {
      const n = numeroDaTesto(testo)
      return n ? `${n} kg` : null
    }
    case 'pesoDoppio': {
      const n = numeroDaTesto(testo)
      return n ? `2x${n} kg` : null
    }
    case 'metri': {
      const n = numeroDaTesto(testo)
      return n && Number.isInteger(n) ? `${n}m` : null
    }
    case 'cadenza': {
      const n = numeroDaTesto(testo)
      return n && Number.isInteger(n) ? `${n} RPM` : null
    }
    case 'velocita': {
      const n = numeroDaTesto(testo)
      return n ? `${n.toFixed(1)} km/h` : null
    }
    default: {
      // ripetizioni, round, ripetute: interi.
      const n = numeroDaTesto(testo)
      return n && Number.isInteger(n) ? String(n) : null
    }
  }
}

/** Il testo da mettere nel campo quando si apre la digitazione su un valore. */
export const testoDaValore = (valore) => {
  const s = String(valore ?? '').trim()
  if (!s || s === '-' || s === 'Max') return ''
  return s.replace(/^2x/, '').replace(/\s*(kg|km\/h|rpm|\/km|\/500m|min|sec|km|m)$/i, '').replace('.', ',')
}

/**
 * L'etichetta grande di un valore che NON è una voce della scala (scritto a
 * mano, o di prima): stesso trattamento delle voci, così il numero al centro
 * non cambia faccia a seconda di come ci si è arrivati.
 */
export const etichettaDi = (scala, valore) => {
  const voce = scala.voci.find(v => v.valore === valore)
  if (voce) return voce.etichetta
  const s = String(valore ?? '').trim()
  if (!s || s === '-') return '—'
  if (/^2x/i.test(s)) return s.replace(/^2x/i, '2×').replace(/\s*kg$/i, '').replace('.', ',')
  if (/\d+\s*sec$/i.test(s)) return s.replace(/\s*sec$/i, '″')
  if (/\d+\s*min$/i.test(s)) return s.replace(/\s*min$/i, '′')
  return s.replace(/\s*(kg|km\/h|rpm|\/km|\/500m|km|m)$/i, '').replace('.', ',')
}

/**
 * L'unità piccola accanto al numero grande. Per corsa e distanza dipende dal
 * valore («400» m, «5» km), quindi la si legge da lì e non dalla scala.
 */
export const unitaDi = (nome, valore) => {
  const s = String(valore ?? '')
  if (nome === 'distanzaCorsa') return /km$/i.test(s) ? 'km' : 'm'
  if (nome === 'durataCorsa') return ''
  return SCALE[nome]?.unita ?? ''
}

/**
 * Il valore scritto per intero, con la sua unità: «82,5 kg», «1:30», «Max».
 * È quello che dicono le schede in alto e le scorciatoie, e quello che
 * VoiceOver legge sul righello. `vista` è una scheda di FoglioMisure.
 */
export const testoMisura = (vista, valore = vista.valore) => {
  if (valore === '-' || valore == null || valore === '') return '—'
  if (vista.scelte) return vista.scelte.find(s => s.valore === valore)?.etichetta ?? String(valore)
  if (!vista.scala || valore === 'Max') return String(valore)
  const unita = unitaDi(vista.scala, valore)
  const numero = etichettaDi(SCALE[vista.scala], valore)
  // Le unità «di ritmo» (/km, /500m) e i minuti si capiscono dalla forma del
  // numero («3:50», «1:30»), e reps/round/volte le dice già l'etichetta
  // accanto («Round 10»): scriverle sarebbe solo rumore.
  const ovvia = !unita || unita.startsWith('/') || ['min', 'reps', 'round', 'volte'].includes(unita)
  return ovvia ? numero : `${numero} ${unita}`
}
