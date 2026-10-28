// L'«Incremento a ogni giro» di un For Time o di un AMRAP (15/10/2026).
//
// Richiesta del committente: un For Time con time cap (o un AMRAP) in cui si
// fa il giro — 200 m di ski, 20 wall ball, 200 m di row, 20 affondi — e,
// finito, si ricomincia dal primo esercizio con le quantità AUMENTATE
// (300, 30, 300, 30…), e così via fino allo scadere del tempo. Ogni esercizio
// ha il suo aumento (+100 m qui, +10 ripetizioni là, niente sullo sled).
//
// 🔴 NON è un numero di giri: il blocco dura il suo tempo (time cap del For
// Time, durata dell'AMRAP) e i giri sono quanti l'atleta riesce a farne. Una
// prima versione dello stesso giorno scriveva 3–12 giri per intero: scartata
// dal committente («non è una questione di giri»).
//
// Il dato:
//   - `block.incremento = true` — l'interruttore è acceso;
//   - `exercise.aumento = "100"` — di quanto sale a ogni giro, nell'unità
//     dell'esercizio (metri se è in `meters`, ripetizioni se è in `reps`);
//     vuoto o assente = resta uguale;
//   - il tempo è quello del blocco: `params.timecap` del For Time (che dal
//     15/10/2026 è SEMPRE a time cap), `duration` dell'AMRAP.
//   ⚠️ Dal 28/10/2026 un For Time SENZA incremento può avere anche i giri
//     (`params.rounds`, «4 giri entro 20:00»): con l'incremento no, lì i giri
//     li decide il tempo (`giriForTime`).
// `exercises` resta il PRIMO giro: le versioni 1.2.0 e 1.2.1 lo mostrano
// com'è, senza sapere dell'aumento.

/** I blocchi che hanno l'incremento. */
export const TIPI_CON_INCREMENTO = ['For Time', 'AMRAP']

/** Il time cap di un For Time appena acceso. */
export const TIME_CAP_PREDEFINITO = '20:00'

const pieno = (v) => v != null && v !== '' && v !== '-'

/** L'incremento è acceso su questo blocco? */
export const haIncremento = (block) =>
  block?.incremento === true && TIPI_CON_INCREMENTO.includes(block.type)

/**
 * Il campo che sale: i metri se l'esercizio è a distanza («200m»), altrimenti
 * le ripetizioni («20»). `null` quando non c'è un numero da far salire:
 * «Max», un tempo, un campo vuoto.
 */
export const campoIncremento = (ex) => {
  if (pieno(ex?.meters) && /^\d+\s*m$/.test(String(ex.meters).trim())) return 'meters'
  if (pieno(ex?.reps) && /^\d+$/.test(String(ex.reps).trim())) return 'reps'
  return null
}

/** L'aumento di un esercizio a ogni giro, come intero (0 se manca). */
export const aumentoDi = (ex) => {
  const n = parseInt(String(ex?.aumento ?? '').replace(/\s/g, ''), 10)
  return Number.isFinite(n) ? n : 0
}

/** «+100m ogni giro», «−5 ogni giro», o `''` se l'esercizio resta uguale. */
export const testoAumento = (ex) => {
  const n = aumentoDi(ex)
  const campo = campoIncremento(ex)
  if (!n || !campo) return ''
  return `${n > 0 ? '+' : '−'}${Math.abs(n)}${campo === 'meters' ? 'm' : ''} ogni giro`
}

/**
 * Un esercizio al giro `giro` (in base 1). La quantità non scende mai sotto
 * 1: un aumento negativo può arrivare a zero, e «0 reps» non è un esercizio.
 */
export const esercizioAlGiro = (ex, giro) => {
  const campo = campoIncremento(ex)
  const n = aumentoDi(ex)
  if (!campo || !n || giro <= 1) return ex
  const valore = Math.max(1, parseInt(ex[campo], 10) + n * (giro - 1))
  return { ...ex, [campo]: campo === 'meters' ? `${valore}m` : String(valore) }
}

/**
 * I primi giri, per far VEDERE l'incremento (anteprima nel builder, scheda):
 * `[{ giro, esercizi }]`. Non è il numero dei giri da fare: quelli li decide
 * il tempo. `null` se il blocco non ha l'incremento o nessun aumento.
 */
export const giriDiEsempio = (block, quanti = 3) => {
  if (!haIncremento(block)) return null
  const esercizi = block.exercises || []
  if (!esercizi.some(ex => aumentoDi(ex) && campoIncremento(ex))) return null
  return Array.from({ length: quanti }, (_, g) => ({
    giro: g + 1,
    esercizi: esercizi.map(ex => esercizioAlGiro(ex, g + 1)),
  }))
}

/** Una copia dell'oggetto senza il campo `chiave`. */
const senzaCampo = (oggetto, chiave) => {
  const copia = { ...oggetto }
  delete copia[chiave]
  return copia
}

/**
 * Accende l'incremento. Un For Time perde i giri, perché li decide il tempo, e
 * se è uno vecchio, ancora a round, prende il time cap.
 */
export const attivaIncremento = (block) => {
  const params = block.type === 'For Time'
    ? { ...senzaCampo(block.params || {}, 'rounds'), timecap: pieno(block.params?.timecap) ? block.params.timecap : TIME_CAP_PREDEFINITO }
    : block.params
  return { ...block, incremento: true, params }
}

/**
 * Spegne l'incremento: via la spia, ma gli AUMENTI RESTANO sugli esercizi.
 * Richiesta del committente: chi spegne per sbaglio e riaccende non deve
 * riscriverli tutti. Spenti non contano niente — scheda, timer, PDF e IA li
 * leggono solo con `haIncremento` — e le versioni vecchie non li conoscono.
 */
export const disattivaIncremento = (block) => senzaCampo(block, 'incremento')

/** «time cap 20:00», per i riepiloghi del For Time. */
export const testoTimeCap = (block) => `time cap ${block?.params?.timecap || TIME_CAP_PREDEFINITO}`

/**
 * Quante volte un For Time a time cap ripete i suoi esercizi (28/10/2026):
 * «4 giri entro 20:00». Richiesta del committente: il For Time resta a time
 * cap, ma il coach vuole poter dire quante volte si fa la lista. `null` quando
 * non c'è niente da dire: un giro solo, un For Time vecchio senza time cap
 * (lì `rounds` era tutto il blocco, e lo dice il riepilogo di sempre), o con
 * l'incremento, dove i giri li decide il tempo.
 */
export const giriForTime = (block) => {
  if (block?.type !== 'For Time' || haIncremento(block) || !pieno(block.params?.timecap)) return null
  const n = parseInt(block.params?.rounds, 10)
  return Number.isFinite(n) && n > 1 ? n : null
}

/** «4 giri · time cap 20:00», o solo «time cap 20:00» con un giro. */
export const testoForTime = (block) => {
  const giri = giriForTime(block)
  return giri ? `${giri} giri · ${testoTimeCap(block)}` : testoTimeCap(block)
}
