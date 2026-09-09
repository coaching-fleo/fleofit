// Il modello predittivo del carico — quanto pesa un allenamento, prima di
// darlo a qualcuno.
//
// Perché esiste: il workout si crea PRIMA e si assegna DOPO, quindi al momento
// in cui si compone non si sa a chi andrà. Il modello è perciò diviso in due
// metà che devono parlare la stessa unità di misura:
//
//   carico = minuti × RPE
//
//   · lato workout (non si sa chi lo farà): minuti stimati × RPE atteso
//   · lato atleta  (storico):               minuti × RPE DICHIARATO → `caricoDi`
//
// È questa coincidenza — e non un'idea nuova — a rendere possibile il warning
// all'assegnazione senza toccare il database: si somma il carico previsto a
// quello già fatto nella settimana e si guarda cosa succede al rapporto
// acuto/cronico che il report mostra già.
//
// ⚠️ NON è machine learning, e non deve fingere di esserlo. Nessun modello
// addestrato, nessun punteggio opaco: sono funzioni pure e deterministiche, e
// ogni numero che finisce a schermo porta con sé il dato da cui esce. Un
// consiglio che non si può verificare non si discute, si subisce — e la prima
// volta che sbaglia si smette di leggerlo (`proposteDi`, reportAtleta.js).
//
// ⚠️ NON ridefinisce una sola soglia. `ACWR_ALTO`/`ACWR_BASSO`,
// `MINIMO_SESSIONI_CARICO`, `SCARTO_RPE`, `ADERENZA_BASSA`/`ADERENZA_ALTA`
// vengono da `reportSettimanale.js`, `GIORNI_FERMO` da `statisticheCoach.js`.
// Due soglie per lo stesso concetto darebbero due numeri diversi in due
// schermate della stessa app, e nessuno dei due sarebbe sbagliato da solo.
//
// 🔴 LE DUE SCALE DI CARICO, che è la cosa da sapere prima di tutto.
//
// Nel progetto convivono DUE stimatori di durata, e non è un dettaglio: su un
// blocco «For Time» da 5 round differiscono dell'**89%** (misurato il
// 02/09/2026 — `durataWorkout` addebita 15 minuti fissi a round, `durataBlocco`
// somma gli esercizi, 75 minuti contro 8). Quindi:
//
//   · `caricoPrevisto` (il builder, FASE 1) misura con `stimaWorkout`, cioè con
//     lo STESSO stimatore delle due celle che gli stanno accanto nel
//     riepilogo. La quarta cella è il prodotto delle prime due, e un coach che
//     moltiplica a mente ritrova il numero. Il suo termine di paragone — la
//     media delle sedute passate del coach — è misurato allo stesso modo.
//
//   · `caricoAssegnazione` (il warning, FASE 2) misura con `durataWorkout` e
//     con l'`rpeAtteso` di `statistiche.js`, cioè con gli STESSI due strumenti
//     con cui `caricoDi` ha misurato lo storico dell'atleta e con cui
//     `scartoRpeDi` misura il suo scarto. Un numeratore e un denominatore
//     costruiti con stimatori diversi darebbero un rapporto sbagliato del loro
//     rapporto, e sbagliato **nella direzione pericolosa**: un workout pieno di
//     For Time si proietterebbe quasi senza peso contro uno storico gonfiato
//     dallo stesso tipo di blocco, cioè direbbe «tranquillo» proprio dove non
//     lo è.
//
// Le due scale non compaiono MAI accanto: il builder mostra un carico assoluto
// e non un rapporto, il foglio di assegnazione mostra un rapporto e non un
// carico assoluto. Unificare i due stimatori è la correzione vera, ed è in
// BACKLOG: tocca numeri già visibili nel report e nel calendario, quindi non è
// una modifica che si fa di passaggio.

import { format, parseISO, startOfWeek, differenceInCalendarDays, startOfDay, isValid } from 'date-fns'
import { it } from 'date-fns/locale'
import { riepilogoWorkout, minutiStimati } from './stimaWorkout'
import { durataWorkout, rpeAtteso as rpeAttesoSections } from './statistiche'
import { getNormalizedBlocks } from './timerSequence'
import { categoriaDi } from './categorie'
import { parseNotePausa } from './pausa'
import { atletiFermi } from './statisticheCoach'
import {
  settimanaReport, parteTrascorsa, caricoDi, rapportoCarico, scartoRpeDi, storicoCronico,
  ACWR_ALTO, ACWR_BASSO, SCARTO_RPE, ADERENZA_BASSA, ADERENZA_ALTA, decimale,
} from './reportSettimanale'

/**
 * Quanti giorni di storico servono al modello.
 *
 * Le quattro settimane del "cronico" più un margine: `storicoCronico` misura a
 * partire dal lunedì della settimana bersaglio, che può essere la prossima.
 */
export const FINESTRA_PREVISIONE = 42

/**
 * Su quante sedute chiuse si misura il termine di correzione dell'atleta.
 *
 * Dieci e non tutte: il bias di chi compila l'RPE cambia — con la confidenza,
 * con la stagione, con il tipo di lavoro. Una media su tutta la storia
 * inseguirebbe per mesi un periodo che non c'è più.
 */
export const SEDUTE_BIAS = 10

/**
 * Di quanto la correzione può spostare, al massimo, l'RPE atteso.
 *
 * ⚠️ Serve un tetto per la stessa ragione di `AUMENTO_MASSIMO` in
 * `reportAtleta.js`: uno scarto enorme costruito su poche sedute — due
 * allenamenti andati storti — trasformerebbe ogni workout successivo in un
 * allarme rosso, e un allarme che si accende sempre smette di essere letto.
 */
export const BIAS_MASSIMO = 2

/**
 * Quante sedute passate del coach servono perché «sopra la tua media» sia una
 * media e non l'ultima volta.
 *
 * Tre, come `MINIMO_PRECEDENTI` di `mediaRpeCategoria`: con due, la "media"
 * è quei due giorni, buoni o storti che siano.
 */
export const MINIMO_PRECEDENTI = 3

/**
 * Da quanto sopra la propria media una seduta è «più dura del solito».
 *
 * Il 15% è la stessa grandezza di `SOGLIA_STABILE` (10%) maggiorata: sotto,
 * si sta chiamando "più dura" la differenza fra due stime della stessa cosa.
 */
export const SOGLIA_COLLOCAZIONE = 15

const iso = (d) => format(d, 'yyyy-MM-dd')
const conSegno = (n) => `${n > 0 ? '+' : ''}${decimale(n)}`
const percento = (n) => `${n > 0 ? '+' : ''}${n}%`

// ── FASE 1 — DURANTE: quanto pesa questo workout ──────────────────────────

/**
 * Il carico previsto di un workout in costruzione, sulla scala del builder.
 *
 * ⚠️ `carico` è `null`, non 0, quando nessun esercizio dichiara un'intensità:
 * `rpeAtteso` torna già `null` in quel caso, e moltiplicarlo per i minuti
 * darebbe zero — cioè «questa seduta non pesa niente», che è falso e ha
 * l'aria di un dato. È la regola di `rpeAtteso`, `rpeDichiarato`,
 * `riassuntoCodici` e `minutiWorkout` alla sua sesta comparsa.
 */
export function caricoPrevisto(blocks = []) {
  const r = riepilogoWorkout(blocks)
  const minuti = minutiStimati(r.secondi)
  return {
    minuti,
    blocchi: r.blocchi,
    rpe: r.rpe,
    segmenti: r.segmenti,
    secondi: r.secondi,
    carico: r.rpe == null ? null : Math.round(minuti * r.rpe),
  }
}

/** Il carico di un workout già salvato, sulla stessa scala del builder. */
export const caricoPrevistoDi = (workout) =>
  caricoPrevisto(getNormalizedBlocks(workout || {}))

/**
 * Dove sta questa seduta rispetto a quelle che il coach scrive di solito.
 *
 * Non è un giudizio assoluto — «340 punti» non vuol dire niente da solo — ma
 * un confronto con la sua stessa produzione nella stessa corsia: un Hyrox si
 * confronta con gli Hyrox, non con le uscite di corsa.
 *
 * ⚠️ Torna `null` sotto `MINIMO_PRECEDENTI` workout confrontabili. La riga
 * sparisce invece di dichiarare una media che non è una media, e senza
 * ripiegare su una soglia assoluta inventata.
 */
export function collocazioneCarico(carico, precedenti = [], categoria = 'Hyrox') {
  if (carico == null) return null

  const carichi = []
  for (const w of precedenti) {
    if (categoriaDi(w?.sections) !== categoria) continue
    const c = caricoPrevistoDi(w).carico
    if (c != null && c > 0) carichi.push(c)
  }
  if (carichi.length < MINIMO_PRECEDENTI) return null

  const media = Math.round(carichi.reduce((a, b) => a + b, 0) / carichi.length)
  if (media <= 0) return null

  const delta = Math.round(((carico - media) / media) * 100)
  const dove = delta >= SOGLIA_COLLOCAZIONE ? 'sopra'
    : delta <= -SOGLIA_COLLOCAZIONE ? 'sotto' : 'linea'

  return {
    media,
    delta,
    dove,
    quante: carichi.length,
    testo: dove === 'linea'
      ? `In linea con le tue sedute ${categoria} (≈${media})`
      : `${dove === 'sopra' ? 'Sopra' : 'Sotto'} la media delle tue sedute ${categoria} (≈${media})`,
  }
}

// ── FASE 2 — ALL'ASSEGNAZIONE: cosa succede al carico di chi lo riceve ─────

/**
 * Il carico previsto di un workout salvato, sulla scala dello STORICO.
 *
 * ⚠️ `durataWorkout` e `rpeAttesoSections`, non gli stimatori del builder: è
 * il numero che verrà sommato a `caricoDi` e diviso per una media costruita
 * con gli stessi due strumenti. Vedi il cappello del file — usare qui la scala
 * del builder farebbe sbagliare il rapporto, e nella direzione pericolosa.
 */
export function caricoAssegnazione(sections) {
  const rpe = rpeAttesoSections(sections)
  const minuti = durataWorkout(sections)
  return { minuti, rpe, carico: rpe == null ? null : Math.round(minuti * rpe) }
}

/**
 * Il termine di correzione dell'atleta: di quanto, storicamente, segna più (o
 * meno) di quello che il workout prevedeva.
 *
 * È l'unica forma di «apprendimento» possibile senza toccare lo schema, ed è
 * onesta perché è ispezionabile: il coach legge in chiaro su quante sedute è
 * calcolata. ⚠️ Saturata a `BIAS_MASSIMO`, e `null` sotto il minimo di sedute
 * misurate (`MINIMO_SESSIONI_SCARTO`, dentro `scartoRpeDi`).
 */
export function biasAtleta(righe = []) {
  const chiuse = (righe || [])
    .filter(r => r?.status === 'completed' && r.completed_date)
    .sort((a, b) => b.completed_date.localeCompare(a.completed_date))
    .slice(0, SEDUTE_BIAS)

  const { valore, sessioni } = scartoRpeDi(chiuse)
  if (valore == null) return { valore: null, sessioni, saturato: false }

  const limitato = Math.max(-BIAS_MASSIMO, Math.min(BIAS_MASSIMO, valore))
  return { valore: limitato, sessioni, saturato: limitato !== valore }
}

/** La settimana in cui cade la data scelta, con il `fino` giusto rispetto a oggi. */
export function settimanaBersaglio(data, oggi = new Date()) {
  const scelta = parseISO(data)
  const base = isValid(scelta) ? scelta : startOfDay(oggi)
  const lunediScelto = startOfWeek(base, { weekStartsOn: 1 })
  const lunediOggi = startOfWeek(startOfDay(oggi), { weekStartsOn: 1 })
  const scarto = Math.round(differenceInCalendarDays(lunediScelto, lunediOggi) / 7)
  return settimanaReport(oggi, scarto)
}

/**
 * Tutto ciò che si sa dell'atleta, indipendentemente dal workout: la settimana
 * che sta facendo, il suo carico cronico, il suo bias, se è fermo, se è in
 * pausa, e cosa ha già in programma intorno alla data scelta.
 *
 * Sta separato da `avvisoAssegnazione` perché i due fogli lo consumano al
 * contrario: la scheda del workout ha un workout e dodici atleti, la scheda
 * dell'atleta ha un atleta e cento workout. Calcolarlo dentro l'avviso
 * vorrebbe dire rifarlo cento volte per la stessa persona.
 */
export function statoAtleta(atleta, righe = [], { data, oggi = new Date() } = {}) {
  const settimana = settimanaBersaglio(data, oggi)
  const sue = (righe || []).filter(r => r?.completed_date)

  const nellaSettimana = sue.filter(r => r.completed_date >= settimana.da && r.completed_date <= settimana.a)
  const trascorse = parteTrascorsa(nellaSettimana, settimana)
  const chiuse = trascorse.filter(r => r.status === 'completed')

  const acuto = caricoDi(chiuse)
  const storico = storicoCronico(sue, settimana.inizio)

  const { inPausa, dal } = parseNotePausa(atleta?.notes)
  // ⚠️ `atletiFermi` e non un conteggio locale: è la stessa funzione che
  // alimenta «Richiedono attenzione» nella Home e la fascia della rubrica, con
  // la stessa `GIORNI_FERMO`. Esclude già chi è in pausa, che è esattamente il
  // comportamento voluto — chi ha chiesto di fermarsi non è sparito.
  const fermo = atletiFermi(atleta ? [atleta] : [], sue, { oggi })[0] || null

  // Cosa ha già quel giorno, e nei due giorni intorno.
  const vicini = []
  if (data) {
    for (const r of sue) {
      const distanza = Math.abs(differenceInCalendarDays(parseISO(r.completed_date), parseISO(data)))
      if (distanza > 1) continue
      vicini.push({
        stesso: r.completed_date === data,
        rpe: rpeAttesoSections(r.workouts?.sections),
        titolo: r.workouts?.title || 'Allenamento',
      })
    }
  }

  return {
    id: atleta?.id ?? null,
    settimana,
    inPausa,
    dalPausa: dal,
    fermo,
    vicini,
    bias: biasAtleta(sue),
    aderenza: {
      assegnati: trascorse.length,
      completati: chiuse.length,
      percentuale: trascorse.length > 0 ? Math.round((chiuse.length / trascorse.length) * 100) : 0,
    },
    carico: {
      acuto: acuto.punti,
      storico,
      // ⚠️ Il rapporto ATTUALE, misurato solo sullo storico vero. È lui a
      // decidere se il modello ha abbastanza dati per parlare: se è `null`,
      // nessuna proiezione viene calcolata. Un ACWR costruito su due sedute
      // manda a scaricare un atleta che sta benissimo.
      acwr: rapportoCarico(acuto.punti, storico),
    },
  }
}

/**
 * Il rapporto acuto/cronico che l'atleta avrebbe SE ricevesse questo carico.
 *
 * ⚠️ Il carico previsto entra sia nel numeratore sia nell'ultima settimana del
 * cronico: la forma «coupled» del rapporto tiene la settimana in esame dentro
 * la propria media (è la formulazione originale, ed è quella che `rapportoCarico`
 * implementa). Sommarlo al solo numeratore gonfierebbe il salto.
 *
 * 🔴 A tenere fuori i dati inventati è la PRIMA riga, non l'aritmetica sotto:
 * se `stato.carico.acwr` è `null` — cioè se lo storico VERO non basta — qui non
 * si calcola niente. È deliberato che il cancello stia sullo storico e non sul
 * proiettato: quella seduta non è ancora stata fatta, e lasciarle allentare la
 * soglia dei dati sufficienti vorrebbe dire inventare il dato proprio dove
 * serve sapere che manca. Per la stessa ragione `misurate` resta com'è.
 * ⚠️ Chi togliesse quel primo controllo non romperebbe l'aritmetica: farebbe
 * comparire un rapporto per gli atleti nuovi, che è il caso peggiore.
 */
export function acwrProiettato(stato, carico) {
  if (carico == null || stato?.carico?.acwr == null) return null
  const storico = stato.carico.storico
  const proiettato = storico.map((s, i) =>
    i === storico.length - 1 ? { ...s, punti: s.punti + carico } : s)
  return rapportoCarico(stato.carico.acuto + carico, proiettato)
}

/**
 * L'unico motivo da mostrare accanto a questo atleta, o `null` se non c'è
 * niente da dire.
 *
 * ⚠️ LE FRASI NON HANNO GENERE, e non è una finezza: metà degli atleti sono
 * donne, e queste righe compaiono accanto al loro nome. «Fermo da 10 giorni» e
 * «Per lui un 9 vale ≈10» erano sbagliate su Arianna e su Giulia — trovate
 * guardando la pagina di anteprima, non leggendo il codice. Chi aggiunge un
 * avviso qui scrive di che cosa è successo («Nessun allenamento da 10 giorni»),
 * non di chi l'ha fatto.
 *
 * 🔴 IL VERDE NON SI DICHIARA. Con dodici nomi in elenco, un «tutto ok»
 * accanto a undici di loro rende invisibile l'unico ambra. Chi non ha niente
 * da segnalare resta com'era.
 *
 * 🔴 UN SOLO MOTIVO, IL PIÙ GRAVE. Due allarmi per lo stesso atleta con due
 * risposte diverse sono il modo in cui un allarme smette di significare
 * qualcosa (§9-vicies punto 4). L'ordine delle condizioni È la regola:
 *
 *  1. la PAUSA, prima di tutto il resto. Chi ha chiesto di fermarsi ha una
 *     settimana vuota per definizione, quindi qualunque allenamento gli
 *     produce un salto di carico enorme: mettere il carico davanti gli
 *     rimetterebbe addosso esattamente l'allarme che la pausa esiste per
 *     togliere (§9-decies), e per giunta nascondendo l'unica cosa che il coach
 *     deve sapere lì — che quella persona aveva chiesto di stare ferma.
 *     ⚠️ Trovato da un test, non leggendo il codice: la prima stesura metteva
 *     il carico davanti e mostrava «Carico +112%» a un atleta in pausa.
 *  2. il salto di carico, che è l'unico rischio fisico;
 *  3. il rientro, 4. l'aderenza, 5. l'accumulo sul giorno, 6. il bias;
 *  7. l'occasione, che è l'unica voce non negativa e resta gated
 *     sull'aderenza alta: senza, mezza rubrica direbbe «puoi caricare» su ogni
 *     seduta leggera.
 *
 * 🔴 DATI INSUFFICIENTI ≠ TUTTO BENE, ed è la ragione delle ultime due voci.
 * Un atleta nuovo e un workout senza intensità dichiarata non producono un
 * semaforo verde: producono una riga grigia che dice **perché** il modello tace.
 */
export function avvisoAssegnazione(stato, previsto) {
  if (!stato) return null
  const carico = previsto?.carico ?? null
  const proiettato = acwrProiettato(stato, carico)

  if (stato.inPausa) {
    const quando = etichettaGiorno(stato.dalPausa)
    return {
      chiave: 'pausa',
      tono: 'attenzione',
      riga: quando ? `In pausa dal ${quando}` : 'In pausa',
      frase: `Ha chiesto di fermarsi${quando ? ` dal ${quando}` : ''}. Assegnare un allenamento è legittimo — è così che lo si riattiva — ma è una decisione, non un automatismo.`,
    }
  }

  if (proiettato != null && proiettato > ACWR_ALTO) {
    return {
      chiave: 'carico',
      tono: 'allarme',
      riga: `Carico ${percento(Math.round((proiettato - 1) * 100))} sulla sua media`,
      frase: `Con questo allenamento la settimana arriva a ${decimale(proiettato)}× la media delle ultime quattro. Sopra ${decimale(ACWR_ALTO)}× il salto di carico è la condizione in cui gli infortuni diventano più probabili.`,
    }
  }

  if (stato.fermo) {
    const g = stato.fermo.oltre ? null : stato.fermo.giorni
    return {
      chiave: 'rientro',
      tono: 'attenzione',
      riga: g == null ? 'Nessun allenamento chiuso' : `Nessun allenamento da ${g} giorni`,
      frase: g == null
        ? 'Non chiude un allenamento da tutto il periodo caricato. Una settimana nuova, senza una parola, resta lì com\'è.'
        : `Non chiude un allenamento da ${g} giorni. Al rientro la seduta pesa più di quanto dice il numero.`,
    }
  }

  if (stato.aderenza.assegnati >= 2 && stato.aderenza.percentuale < ADERENZA_BASSA) {
    const mancanti = stato.aderenza.assegnati - stato.aderenza.completati
    return {
      chiave: 'aderenza',
      tono: 'attenzione',
      riga: `Ne ha già ${mancanti} non ${mancanti === 1 ? 'fatto' : 'fatti'}`,
      frase: `Questa settimana ha chiuso ${stato.aderenza.completati} allenamenti su ${stato.aderenza.assegnati}. Aggiungerne uno non è la risposta al perché gli altri sono rimasti lì.`,
    }
  }

  const accumulo = accumuloSulGiorno(stato, previsto)
  if (accumulo) return accumulo

  if (stato.bias.valore != null && Math.abs(stato.bias.valore) >= SCARTO_RPE && previsto?.rpe != null) {
    const atteso = previsto.rpe
    const percepito = Math.max(1, Math.min(10, Math.round((atteso + stato.bias.valore) * 10) / 10))
    return {
      chiave: 'bias',
      tono: 'attenzione',
      riga: `Un ${decimale(atteso)} previsto vale ≈${decimale(percepito)}`,
      frase: `Su ${stato.bias.sessioni} sedute segna in media ${conSegno(stato.bias.valore)} rispetto a quanto era previsto. Questo allenamento è dato per ${decimale(atteso)}: lo sentirà intorno a ${decimale(percepito)}.`,
    }
  }

  if (proiettato != null && proiettato < ACWR_BASSO && stato.aderenza.percentuale >= ADERENZA_ALTA
      && stato.aderenza.assegnati > 0) {
    return {
      chiave: 'occasione',
      tono: 'buono',
      riga: 'Puoi caricare',
      frase: `Ha seguito la settimana e anche con questo allenamento resta a ${decimale(proiettato)}× la sua media. È lo spazio per chiedere di più.`,
    }
  }

  if (carico == null) {
    return {
      chiave: 'senzaCarico',
      tono: 'neutro',
      riga: 'Carico non stimabile',
      frase: 'Questo allenamento non dichiara un\'intensità, quindi non c\'è un carico da proiettare. Il semaforo tace: non vuol dire che sia leggero.',
    }
  }

  if (stato.carico.acwr == null) {
    return {
      chiave: 'storico',
      tono: 'neutro',
      riga: 'Storico insufficiente',
      frase: 'Non ci sono abbastanza sedute con RPE dichiarato per sapere qual è il suo carico abituale. Il modello tace invece di stimarlo su due dati.',
    }
  }

  return null
}

/**
 * Due sedute dure attaccate.
 *
 * ⚠️ Sullo STESSO giorno basta che ce ne sia un'altra: due allenamenti in una
 * giornata sono una scelta, e vale la pena che si veda. Sul giorno accanto no
 * — allenarsi due giorni di fila è la norma — e la riga compare solo se
 * entrambe le sedute sono dure, che è la condizione che il recupero non copre.
 */
function accumuloSulGiorno(stato, previsto) {
  const rpe = previsto?.rpe
  const stesso = stato.vicini.find(v => v.stesso)
  if (stesso) {
    return {
      chiave: 'accumulo',
      tono: 'attenzione',
      riga: 'Ha già un allenamento quel giorno',
      frase: `Quel giorno ha già «${stesso.titolo}». Due sedute nella stessa giornata sono una scelta: qui si sta per farla.`,
    }
  }
  if (rpe == null || rpe < 7) return null
  const duro = stato.vicini.find(v => !v.stesso && v.rpe != null && v.rpe >= 7)
  if (!duro) return null
  return {
    chiave: 'accumulo',
    tono: 'attenzione',
    riga: 'Seduta dura il giorno prima o dopo',
    frase: `Ha «${duro.titolo}» nel giorno adiacente, anch'esso dato per duro. Due sedute pesanti di fila lasciano poco recupero in mezzo.`,
  }
}

/** «27 ago», o `null` se la data non c'è o non è leggibile. */
function etichettaGiorno(data) {
  if (!data) return null
  const d = parseISO(data)
  return isValid(d) ? format(d, 'd MMM', { locale: it }) : null
}

/**
 * Gli avvisi per una squadra intera davanti a UN workout — il caso della
 * scheda del workout.
 *
 * ⚠️ Le assegnazioni si indicizzano per atleta in una passata sola: una
 * scansione dell'intera lista per ognuno dei dodici sarebbe dodici passate
 * sugli stessi dati.
 */
export function previsioneSquadra(atleti = [], assegnazioni = [], { sections, data, oggi = new Date() } = {}) {
  const previsto = caricoAssegnazione(sections)

  const perAtleta = new Map()
  for (const a of assegnazioni) {
    if (!a?.athlete_id || !a.completed_date) continue
    const lista = perAtleta.get(a.athlete_id)
    if (lista) lista.push(a)
    else perAtleta.set(a.athlete_id, [a])
  }

  const avvisi = new Map()
  for (const atleta of atleti) {
    if (!atleta?.id) continue
    const stato = statoAtleta(atleta, perAtleta.get(atleta.id) || [], { data, oggi })
    avvisi.set(atleta.id, avvisoAssegnazione(stato, previsto))
  }
  return { previsto, avvisi }
}

/**
 * Gli avvisi per UN atleta davanti a molti workout — il caso della scheda
 * dell'atleta.
 *
 * Lo stato si calcola una volta sola: è la stessa persona in tutte le righe.
 */
export function previsioneWorkout(atleta, righe = [], workouts = [], { data, oggi = new Date() } = {}) {
  const stato = statoAtleta(atleta, righe, { data, oggi })
  const avvisi = new Map()
  for (const w of workouts) {
    if (!w?.id) continue
    avvisi.set(w.id, avvisoAssegnazione(stato, caricoAssegnazione(w.sections)))
  }
  return { stato, avvisi }
}

/**
 * La riga dell'avviso da appendere all'`aria-label` di chi lo contiene.
 *
 * ⚠️ Il colore non è un'informazione per tutti: chi legge con VoiceOver sente
 * il nome dell'atleta e nient'altro, e l'avviso è l'unica cosa della riga che
 * chiede un'azione (§9-septdecies punto 2). Sta qui e non in `PrevisioneUI`
 * perché un file di componenti che esporta una funzione perde il Fast Refresh
 * per intero (§9-octies punto 3).
 */
export const testoAvviso = (avviso) => (avviso ? ` · ${avviso.riga}` : '')

/** La finestra di storico da chiedere al database, in date ISO. */
export function finestraPrevisione(oggi = new Date(), giorni = FINESTRA_PREVISIONE) {
  const fine = new Date(startOfDay(oggi).getTime() + 14 * 86400000)
  return { da: iso(new Date(startOfDay(oggi).getTime() - giorni * 86400000)), a: iso(fine) }
}
