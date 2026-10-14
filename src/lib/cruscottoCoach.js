// Il cruscotto della Home coach (14/10/2026): i numeri e i segnali che la
// Home mostra al coach la mattina, telefono e desktop.
//
// Perché esiste: la Home di prima guardava solo INDIETRO — feedback, chi è
// fermo, cosa è scaduto, le ultime sedute. Erano tutte cose già successe. Qui
// stanno le domande che vengono prima, nell'ordine in cui il coach se le fa:
// chi si allena oggi e in che stato arriva, cosa nel programma va rivisto,
// cosa resta da programmare, quando sono le gare.
//
// Funzioni PURE su righe già caricate da Home.jsx, `oggi` sempre passato
// (altrimenti i test dipendono dal calendario di chi li esegue). Chi disegna
// sta in CruscottoCoachUI.jsx e non calcola niente.
//
// 🔴 Nessun numero inventato (CLAUDE.md §9): ogni funzione torna `null` dove
// il dato non c'è ancora, e chi disegna mette «—». Una media fatta su un dato
// solo non è una media, e non si mostra.

import { addDays, differenceInCalendarDays, format, parseISO, startOfDay } from 'date-fns'
import { it } from 'date-fns/locale'
import { rpeDichiarato } from './rpe'
import { durataWorkout, rpeAtteso } from './statistiche'
import { categoriaDi } from './categorie'
import { separaCodice } from './codiceWorkout'
import { DOMANDE, punteggio, fasciaComeStai, parolaRisposta } from './comeStai'
import { atletiSeguiti, GIORNI_SEGNALI, GIORNI_GARE } from './statisticheCoach'

export { GIORNI_SEGNALI, GIORNI_GARE }
import { estrattiValidi, modificheFrequenti } from './dalleNote'
import { grigliaTeam } from './calendarioTeam'

/** Da quale intensità prevista (1–10) un allenamento è «duro». */
export const SOGLIA_DURO = 8
/** Una risposta a «Come stai» da qui in giù (1–5) è una risposta bassa. */
export const RISPOSTA_STORTA = 2
/** Di quanto l'RPE dichiarato deve superare, in media, l'intensità prevista. */
export const SCARTO_PIU_DURO = 1.5
/** E di quanto deve restarle sotto per dire «RPE sotto l'intensità programmata». */
export const SCARTO_PIU_FACILE = 2
/** Quante sedute confrontabili servono prima di dire qualcosa. */
export const MINIMO_SEDUTE = 3
/** Di quanto (%) il carico della settimana deve superare la media perché sia un segnale. */
export const SOGLIA_CARICO = 30
/** Quante volte un esercizio saltato o ridotto diventa un segnale. */
export const MINIMO_MODIFICHE = 2

const giorno = (d) => format(d, 'yyyy-MM-dd')
const spostato = (oggi, n) => giorno(addDays(startOfDay(oggi), n))
const nomeCompleto = (a) => [a?.name, a?.surname].filter(Boolean).join(' ').trim() || 'Atleta'
const nomeBreve = (a) => (a?.name || '').trim() || nomeCompleto(a)
const unDecimale = (n) => Math.round(n * 10) / 10
const media = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
const eGara = (ass) => categoriaDi(ass?.workouts?.sections) === 'Event'

/** Le assegnazioni dei soli atleti seguiti (né in pausa, né il coach). */
const diSeguiti = (atleti, assegnazioni) => {
  const ids = new Set(atletiSeguiti(atleti).map(a => a?.id).filter(Boolean))
  return assegnazioni.filter(a => a?.athlete_id && ids.has(a.athlete_id))
}

// ── Il polso del team ──────────────────────────────────────────────────────

/**
 * Quanti allenamenti assegnati sono stati fatti negli ultimi `giorni` giorni.
 *
 * ⚠️ OGGI È FUORI dalla finestra, ed è la scelta che tiene in piedi il numero:
 * alle otto di mattina nessuno ha ancora fatto l'allenamento di oggi, e
 * contarlo farebbe scendere l'aderenza del team ogni mattina per poi farla
 * risalire la sera. Le gare non contano: non sono un allenamento da fare.
 */
export function aderenzaTeam(atleti = [], assegnazioni = [], { giorni = 7, oggi = new Date() } = {}) {
  const righe = diSeguiti(atleti, assegnazioni).filter(a => !eGara(a))
  const conta = (da, a) => {
    const dentro = righe.filter(r => r.completed_date >= da && r.completed_date <= a)
    const fatti = dentro.filter(r => r.status === 'completed').length
    return { fatti, assegnati: dentro.length, percentuale: dentro.length ? Math.round((fatti / dentro.length) * 100) : null }
  }
  const corrente = conta(spostato(oggi, -giorni), spostato(oggi, -1))
  const precedente = conta(spostato(oggi, -2 * giorni), spostato(oggi, -giorni - 1))
  const barre = Array.from({ length: giorni }, (_, i) => {
    const d = spostato(oggi, i - giorni)
    return conta(d, d).percentuale
  })
  return {
    ...corrente,
    // In PUNTI, non in percentuale di una percentuale: «+6 punti» si legge,
    // «+8%» di un 76% va prima ricalcolato a mente.
    delta: corrente.percentuale != null && precedente.percentuale != null
      ? corrente.percentuale - precedente.percentuale : null,
    barre,
  }
}

/**
 * L'RPE medio della settimana (oggi compreso) accanto all'intensità che il
 * coach aveva programmato per gli STESSI allenamenti.
 *
 * Il confronto è il punto: un 7 da solo non dice niente, un 7 dove avevi
 * programmato un 5 dice che il team fa più fatica di quanto pensi.
 * 🔴 `rpeDichiarato`, mai `parseNotesAndRpe`: il secondo inventa un 5.
 */
export function rpeTeam(atleti = [], assegnazioni = [], { giorni = 7, oggi = new Date() } = {}) {
  const righe = diSeguiti(atleti, assegnazioni).filter(a => !eGara(a) && a.status === 'completed')
  const misura = (da, a) => {
    const rpe = []
    const previste = []
    for (const r of righe) {
      if (r.completed_date < da || r.completed_date > a) continue
      const v = rpeDichiarato(r.notes)
      if (v == null) continue
      rpe.push(v)
      const p = rpeAtteso(r.workouts?.sections)
      if (p != null) previste.push(p)
    }
    return {
      medio: rpe.length >= 2 ? unDecimale(media(rpe)) : null,
      prevista: previste.length >= 2 ? unDecimale(media(previste)) : null,
      quanti: rpe.length,
    }
  }
  const corrente = misura(spostato(oggi, -(giorni - 1)), spostato(oggi, 0))
  const precedente = misura(spostato(oggi, -(2 * giorni - 1)), spostato(oggi, -giorni))
  return {
    ...corrente,
    delta: corrente.medio != null && precedente.medio != null ? unDecimale(corrente.medio - precedente.medio) : null,
  }
}

/** Le quattro risposte di una riga di `come_stai`, a parole. `null` se la riga non c'è. */
export function risposteDi(riga) {
  if (!riga) return null
  return DOMANDE.map(d => ({
    chiave: d.chiave,
    titolo: d.titolo,
    valore: Number.isInteger(riga[d.chiave]) ? riga[d.chiave] : null,
    parola: parolaRisposta(d, riga[d.chiave]),
  }))
}

/** Le risposte storte di una riga: quelle da `RISPOSTA_STORTA` in giù. */
const storte = (risposte) => (risposte || []).filter(r => r.valore != null && r.valore <= RISPOSTA_STORTA)

/**
 * Come sta il team stamattina, da «Come stai oggi».
 *
 * `senzaRisposta` conta solo chi ha un allenamento OGGI: chi è a riposo non
 * deve rispondere, e contarlo trasformerebbe ogni domenica in un allarme.
 */
export function comeStaTeam(atleti = [], assegnazioni = [], risposte = [], { oggi = new Date() } = {}) {
  const oggiStr = giorno(oggi)
  const seguiti = atletiSeguiti(atleti)
  const perAtleta = new Map(risposte.filter(r => r?.giorno === oggiStr).map(r => [r.athlete_id, r]))
  const conAllenamento = new Set(diSeguiti(atleti, assegnazioni)
    .filter(a => a.completed_date === oggiStr && !eGara(a)).map(a => a.athlete_id))

  const punteggi = []
  let giornateStorte = 0
  for (const a of seguiti) {
    const riga = perAtleta.get(a.id)
    const p = punteggio(riga)
    if (p == null) continue
    punteggi.push(p)
    if (storte(risposteDi(riga)).length > 0) giornateStorte++
  }
  const medio = punteggi.length ? unDecimale(media(punteggi)) : null
  return {
    medio,
    fascia: fasciaComeStai(medio),
    risposte: punteggi.length,
    giornateStorte,
    senzaRisposta: [...conAllenamento].filter(id => !perAtleta.has(id)).length,
    // Una tacca per chi ha risposto, dal peggiore al migliore.
    tacche: punteggi.slice().sort((a, b) => a - b),
  }
}

/**
 * Le gare dei prossimi `giorni` giorni, una per workout (la stessa gara
 * assegnata a quattro atleti è UNA gara con quattro nomi).
 */
export function gareInArrivo(atleti = [], assegnazioni = [], { giorni = GIORNI_GARE, oggi = new Date() } = {}) {
  const da = giorno(oggi)
  const a = spostato(oggi, giorni)
  const rubrica = new Map(atletiSeguiti(atleti).map(x => [x.id, x]))
  const perGara = new Map()
  for (const ass of assegnazioni) {
    if (!eGara(ass) || !ass.completed_date || ass.completed_date < da || ass.completed_date > a) continue
    const atleta = rubrica.get(ass.athlete_id)
    if (!atleta) continue
    const chiave = `${ass.workouts?.id || ass.workouts?.title}|${ass.completed_date}`
    if (!perGara.has(chiave)) {
      const titolo = ass.workouts?.title || 'Gara'
      perGara.set(chiave, {
        chiave,
        workoutId: ass.workouts?.id,
        nome: separaCodice(titolo).nome || titolo,
        data: ass.completed_date,
        giorno: format(parseISO(ass.completed_date), 'd'),
        mese: format(parseISO(ass.completed_date), 'MMM', { locale: it }).toUpperCase(),
        giorni: differenceInCalendarDays(parseISO(ass.completed_date), startOfDay(oggi)),
        atleti: [],
      })
    }
    const g = perGara.get(chiave)
    if (!g.atleti.some(x => x.id === atleta.id)) g.atleti.push({ id: atleta.id, nome: nomeBreve(atleta) })
  }
  return [...perGara.values()].sort((x, y) => x.data.localeCompare(y.data) || x.nome.localeCompare(y.nome))
}

// ── Oggi ───────────────────────────────────────────────────────────────────

/**
 * La squadra di oggi con lo stato in cui arriva ciascuno.
 *
 * Un `allarme` è la coppia che il coach deve vedere prima dell'allenamento:
 * un allenamento DURO (intensità prevista ≥ SOGLIA_DURO) per chi stamattina ha
 * risposto male ad almeno una domanda. Una risposta storta con un allenamento
 * leggero è solo un `avviso`: da tenere d'occhio, non da cambiare.
 * A cose fatte non c'è più niente da decidere: un completato non suona mai.
 *
 * @param righe le righe di `squadraDelGiorno` (con `intensita`)
 */
export function oggiConComeSta(righe = [], risposte = [], { oggi = new Date() } = {}) {
  const oggiStr = giorno(oggi)
  const perAtleta = new Map(risposte.filter(r => r?.giorno === oggiStr).map(r => [r.athlete_id, r]))
  const conStato = righe.map(r => {
    const comeSta = risposteDi(perAtleta.get(r.id))
    const male = storte(comeSta)
    const aperto = r.stato !== 'completato'
    const duro = r.intensita != null && r.intensita >= SOGLIA_DURO
    return {
      ...r,
      comeSta,
      allarme: aperto && duro && male.length > 0,
      avviso: aperto && !duro && male.length > 0,
      motivi: male.map(m => `${m.titolo}: ${(m.parola || '').toLowerCase()}`),
    }
  })
  const rango = (r) => (r.allarme ? 0 : r.stato === 'in corso' ? 1 : r.avviso ? 2 : 3)
  return conStato.sort((a, b) => rango(a) - rango(b))
}

// ── Da rivedere nel programma ──────────────────────────────────────────────

const GRAVITA = { 'piu-duro': 3, carico: 2, note: 2, 'piu-facile': 1 }
// 🔴 Le frasi della Home sono SEMPLICI e parlano degli allenamenti, non della
// persona (richiesta del committente, 14/10/2026). «Lo sente più duro» o
// «salta i Wall Balls» suonano come un giudizio a chi legge con malizia;
// «RPE sopra l'intensità programmata» è giusto ma troppo tecnico per la Home —
// quello va nei report e nelle analisi. Qui: «allenamenti più faticosi del
// previsto», «ha saltato … 2 volte».
const VERBO = { saltato: 'ha saltato', ridotto: 'ha ridotto', sostituito: 'ha sostituito' }

/** Il tono di una barretta: quanto lo scarto si allontana dal previsto. */
const tonoScarto = (s) => (s >= 2 ? 'alto' : s >= 1 ? 'medio' : s <= -2 ? 'basso' : 'neutro')

/**
 * I segnali che chiedono di cambiare qualcosa nel programma, e che si vedono
 * solo guardando più sedute insieme: la singola seduta dura non è un segnale,
 * quattro di fila sì.
 *
 * Tre fonti, tutte già nei dati:
 * - **RPE contro intensità**: l'atleta dichiara stabilmente più (o meno)
 *   fatica di quella che il coach aveva programmato;
 * - **carico** (minuti × RPE) della settimana contro la media delle quattro
 *   precedenti: la stessa misura della scheda atleta (`andamento.js`);
 * - **Dalle note**: esercizi che l'atleta salta, riduce o cambia più volte
 *   (`note_estratte`, solo admin). Un estratto vale finché la nota è quella
 *   analizzata (`estrattiValidi`).
 */
export function segnaliProgramma(atleti = [], assegnazioni = [], estratti = [], { oggi = new Date() } = {}) {
  const da = spostato(oggi, -(GIORNI_SEGNALI - 1))
  const oggiStr = giorno(oggi)
  const validi = estrattiValidi(estratti, assegnazioni).filter(e => e.data >= da && e.data <= oggiStr)
  const segnali = []

  for (const atleta of atletiSeguiti(atleti)) {
    const nome = nomeCompleto(atleta)
    const base = { atletaId: atleta.id, nome, foto: atleta.photo_url || null }
    const sedute = assegnazioni
      .filter(a => a?.athlete_id === atleta.id && a.status === 'completed' && !eGara(a) && a.completed_date <= oggiStr)
      .sort((a, b) => a.completed_date.localeCompare(b.completed_date))

    // 1. RPE sopra (o sotto) l'intensità programmata.
    const scarti = sedute
      .filter(a => a.completed_date >= da)
      .map(a => {
        const rpe = rpeDichiarato(a.notes)
        const previsto = rpeAtteso(a.workouts?.sections)
        return rpe != null && previsto != null ? rpe - previsto : null
      })
      .filter(v => v != null)
      .slice(-4)
    if (scarti.length >= MINIMO_SEDUTE) {
      const m = media(scarti)
      const tipo = m >= SCARTO_PIU_DURO ? 'piu-duro' : m <= -SCARTO_PIU_FACILE ? 'piu-facile' : null
      if (tipo) {
        segnali.push({
          ...base, tipo, chiave: `${tipo}-${atleta.id}`,
          frase: `${nome}: allenamenti più ${tipo === 'piu-duro' ? 'faticosi' : 'leggeri'} del previsto`,
          prova: `Fatica segnata più ${tipo === 'piu-duro' ? 'alta' : 'bassa'} di quella prevista nelle ultime ${scarti.length} sedute`,
          barre: scarti.map(tonoScarto),
        })
      }
    }

    // 2. Il carico della settimana contro le quattro precedenti.
    const carico = (daG, aG) => sedute
      .filter(a => a.completed_date >= daG && a.completed_date <= aG)
      .reduce((s, a) => {
        const rpe = rpeDichiarato(a.notes)
        return rpe == null ? s : s + durataWorkout(a.workouts?.sections) * rpe
      }, 0)
    const corrente = carico(spostato(oggi, -6), oggiStr)
    const prima = [1, 2, 3, 4].map(k => carico(spostato(oggi, -7 * k - 6), spostato(oggi, -7 * k)))
    const conDati = prima.filter(v => v > 0)
    if (conDati.length >= 2 && corrente > 0) {
      const riferimento = media(prima)
      const delta = Math.round(((corrente - riferimento) / riferimento) * 100)
      if (delta >= SOGLIA_CARICO) {
        const massimo = Math.max(corrente, ...prima)
        segnali.push({
          ...base, tipo: 'carico', chiave: `carico-${atleta.id}`,
          frase: `${nome}: carico salito del ${delta}% in una settimana`,
          prova: 'Minuti × RPE, contro la media delle 4 settimane prima',
          // Dalla settimana più vecchia a questa: l'ultima è quella che sale.
          barre: [...prima].reverse().concat(corrente).map((v, i, xs) =>
            i === xs.length - 1 ? 'alto' : v >= massimo * 0.75 ? 'medio' : 'neutro'),
        })
      }
    }

    // 3. Dalle note: gli esercizi saltati, ridotti o cambiati più volte.
    for (const m of modificheFrequenti(validi.filter(e => e.athlete_id === atleta.id))) {
      if (!VERBO[m.tipo] || m.volte < MINIMO_MODIFICHE) continue
      const ultima = m.citazioni[m.citazioni.length - 1]
      segnali.push({
        ...base, tipo: 'note', chiave: `note-${atleta.id}-${m.esercizio}-${m.tipo}`,
        frase: `${nome} ${VERBO[m.tipo]} ${m.esercizio} ${m.volte} volte in 4 settimane`,
        prova: ultima?.testo ? `«${ultima.testo}»` : 'Dalle note dell\'atleta',
        barre: m.citazioni.map(() => 'medio'),
      })
    }
  }

  return segnali.sort((a, b) => GRAVITA[b.tipo] - GRAVITA[a.tipo] || a.nome.localeCompare(b.nome))
}

// ── La settimana ───────────────────────────────────────────────────────────

/**
 * La griglia atleti × giorni della Home, sui giorni passati: la settimana
 * intera sul desktop, i prossimi tre giorni sul telefono.
 *
 * Usa `grigliaTeam` del calendario desktop — la stessa sessione è la stessa
 * chip nelle due pagine — e aggiunge solo ciò che serve qui: per ogni cella,
 * se è un giorno passato, oggi o da venire. Un giorno FUTURO vuoto è da
 * programmare; uno passato vuoto era riposo, e non si colora. Chi è in pausa
 * non c'è: non è lavoro di programmazione.
 */
export function pianoGiorni(atleti = [], assegnazioni = [], giorni = [], { oggi = new Date() } = {}) {
  const oggiStr = giorno(oggi)
  const righe = grigliaTeam(atletiSeguiti(atleti), assegnazioni, giorni)
  return {
    giorni: giorni.map(d => {
      const k = giorno(d)
      return {
        data: k,
        etichetta: k === oggiStr ? 'oggi' : format(d, 'EEE d', { locale: it }),
        oggi: k === oggiStr,
      }
    }),
    righe: righe.map(r => ({
      ...r,
      celle: r.celle.map(c => ({
        ...c,
        quando: c.data < oggiStr ? 'passato' : c.data === oggiStr ? 'oggi' : 'futuro',
        chips: c.chips.map(ch => ({ ...ch, saltato: !ch.completato && c.data < oggiStr && ch.categoria !== 'Event' })),
      })),
    })),
  }
}

/** I prossimi `quanti` giorni, oggi compreso: la griglia del telefono. */
export const prossimiGiorni = (oggi = new Date(), quanti = 3) =>
  Array.from({ length: quanti }, (_, i) => addDays(startOfDay(oggi), i))
