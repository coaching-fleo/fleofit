// Il report settimanale del coach — BACKLOG #27 («Coach Copilot»).
//
// Perché esiste: l'app dice al coach cosa succede OGGI (la Home) e com'è andato
// UN atleta (la scheda). Non dice mai com'è andata la SETTIMANA della squadra,
// che è la domanda su cui si programma quella dopo. Le tre cose che un coach
// decide il lunedì — chi richiamare, chi scaricare, chi caricare — oggi si
// ricavano aprendo una scheda alla volta e tenendo a mente i numeri.
//
// Sono funzioni PURE su array già caricati, come `statisticheCoach.js`:
// nessun fetch, nessuna data implicita. Chi calcola qui non disegna, chi
// disegna in `ReportUI.jsx` non calcola.
//
// 🔴 LE TRE REGOLE CHE TENGONO ONESTI QUESTI NUMERI, e che sono l'unica ragione
// per cui questo file non è quattro righe dentro la pagina:
//
// 1. **L'aderenza si misura sulla parte TRASCORSA della settimana.** È la
//    trappola già documentata in `rigaAtleta.js`: gli assegnati comprendono i
//    giorni ancora da venire, quindi il lunedì mattina sono tutti a 0/5. Un
//    verdetto «aderenza bassa» legato alla frazione piena accenderebbe un
//    allarme su tutta la squadra ogni lunedì — cioè quando non è successo
//    ancora niente. Ciò che resta in programma si dichiara a parte (`daVenire`).
//
// 2. **Il carico esclude le sessioni senza RPE dichiarato, e lo DICE.**
//    `parseNotesAndRpe` torna 5 dove il marcatore manca, e quel 5 entrerebbe
//    nel prodotto minuti × RPE come se fosse una misura (CLAUDE.md §9-octies).
//    Qui si somma solo ciò che l'atleta ha davvero segnato e si porta
//    `parziale`, che a schermo diventa il `≈` del calendario: un totale
//    incompleto che si presenta come completo è peggio di un totale mancante.
//
// 3. **Nessun numero si inventa per riempire una cella.** ACWR e scarto RPE
//    tornano `null` quando i dati sotto non bastano, ed è il chiamante a
//    scrivere «—». È la stessa lezione di `rpeAtteso` e di `rpeDichiarato`.

import { format, startOfWeek, endOfWeek, addWeeks, getISOWeek, parseISO,
         differenceInCalendarDays, startOfDay, isValid } from 'date-fns'
import { it } from 'date-fns/locale'
import { durataWorkout, rpeAtteso } from './statistiche'
import { rpeDichiarato, testoNota } from './rpe'
import { categoriaDi, CORSIA } from './categorie'
import { inPausa, parseNotePausa } from './pausa'
import { isVoiceNoteValid } from './notaVocale'
import { GIORNI_FERMO, atletiSeguiti } from './statisticheCoach'
import { SOGLIA_STABILE } from './andamento'

/**
 * Su quante settimane si misura il carico "cronico" con cui si confronta
 * quello della settimana.
 *
 * Quattro è lo standard dell'acute:chronic workload ratio (Gabbett): meno
 * settimane rendono il riferimento un singolo periodo buono o storto, di più
 * lo rendono insensibile a un cambio di programmazione.
 */
export const SETTIMANE_CRONICO = 4
export const GIORNI_CRONICO = SETTIMANE_CRONICO * 7

/**
 * Quante sessioni con RPE dichiarato servono, nelle quattro settimane, perché
 * il rapporto abbia senso.
 *
 * ⚠️ Sotto questa soglia il rapporto esiste comunque ed è puro rumore: con due
 * sole sessioni misurate, saltarne una dimezza il "cronico" e raddoppia il
 * numero. Un rapporto di 2,1 costruito su due dati manda il coach a scaricare
 * un atleta che sta benissimo.
 */
export const MINIMO_SESSIONI_CARICO = 4

/** Quante delle quattro settimane devono avere carico perché la media sia una media. */
export const MINIMO_SETTIMANE_CARICO = 2

/**
 * Le due soglie del rapporto acuto/cronico.
 *
 * Sopra 1.5 la settimana è molto più pesante di ciò a cui l'atleta è abituato:
 * è la zona in cui la letteratura sul carico colloca l'aumento del rischio di
 * infortunio. Sotto 0.8 sta scaricando — che è un problema solo se non era
 * voluto, e infatti da solo non produce nessun allarme: alza «puoi caricare»
 * unicamente per chi la settimana l'ha comunque seguita.
 */
export const ACWR_ALTO = 1.5
export const ACWR_BASSO = 0.8

/**
 * Di quanto l'RPE dichiarato deve discostarsi da quello atteso perché conti.
 *
 * Un punto e mezzo su dieci: sotto, è la differenza fra due persone che
 * compilano lo stesso cursore in giorni diversi.
 */
export const SCARTO_RPE = 1.5
/** Sotto due sessioni con entrambi i valori, lo scarto è quel giorno, non una tendenza. */
export const MINIMO_SESSIONI_SCARTO = 2

/** Sotto questa aderenza sulla parte trascorsa, la settimana è saltata. */
export const ADERENZA_BASSA = 50
/** Da questa aderenza in su, l'atleta ha fatto la sua parte e si può caricare. */
export const ADERENZA_ALTA = 80

/** Quante citazioni di feedback entrano nel report prima del «+N altri». */
export const FEEDBACK_IN_REPORT = 4

const iso = (d) => format(d, 'yyyy-MM-dd')

/** Il nome composto, con ripiego: è l'etichetta della riga, non può mancare. */
const nomeAtleta = (a) => [a?.name, a?.surname].filter(Boolean).join(' ').trim() || 'Atleta'

/** «31 ago – 6 set», con il mese scritto una volta sola quando è lo stesso. */
const intervalloBreve = (inizio, fine) => {
  const stessoMese = inizio.getMonth() === fine.getMonth()
  const sinistra = stessoMese ? format(inizio, 'd') : format(inizio, 'd MMM', { locale: it })
  return `${sinistra} – ${format(fine, 'd MMM', { locale: it })}`
}

/**
 * La settimana del report, lunedì→domenica, spostata di `scarto` settimane.
 *
 * ⚠️ Lunedì, come ovunque nell'app (`rigaAtleta.settimanaDi`): è la settimana
 * con cui il coach programma. Con il default di `date-fns` — domenica — il
 * report e la rubrica direbbero due «3 su 5» diversi per gli stessi giorni.
 *
 * `fino` è il punto in cui la settimana si ferma per il conteggio
 * dell'aderenza: oggi se la settimana è in corso, la domenica se è passata,
 * `null` se non è ancora cominciata. È la regola 1 in testa al file.
 */
export function settimanaReport(oggi = new Date(), scarto = 0) {
  const base = addWeeks(startOfDay(oggi), scarto)
  const inizio = startOfWeek(base, { weekStartsOn: 1 })
  const fine = endOfWeek(base, { weekStartsOn: 1 })
  const da = iso(inizio)
  const a = iso(fine)
  const oggiStr = iso(oggi)

  const corrente = oggiStr >= da && oggiStr <= a
  const futura = da > oggiStr
  const fino = corrente ? oggiStr : futura ? null : a

  return {
    da,
    a,
    inizio,
    fine,
    fino,
    oggi: oggiStr,
    corrente,
    futura,
    numero: getISOWeek(inizio),
    etichetta: intervalloBreve(inizio, fine),
    // Quanti dei sette giorni sono già passati: è ciò che rende leggibile un
    // «2 su 5» al martedì, che senza contesto sembra un disastro.
    trascorsi: corrente ? differenceInCalendarDays(startOfDay(oggi), inizio) + 1 : futura ? 0 : 7,
  }
}

/**
 * La parte TRASCORSA della settimana: le assegnazioni su cui ha senso misurare
 * l'aderenza (regola 1 in testa al file).
 *
 * 🔴 L'eccezione su OGGI è la metà della regola che non si vede leggendo il
 * codice, ed è la stessa che governa `serieGiorni` in `statistiche.js`: **la
 * giornata non è finita.** Un allenamento programmato per oggi e non ancora
 * fatto non è saltato — alle otto di mattina non è saltato niente — e contarlo
 * come tale metterebbe tutta la squadra ad «aderenza bassa» ogni mattina fino
 * al primo allenamento.
 *
 * ⚠️ Ma vale solo per i PENDENTI. Un allenamento **chiuso oggi** conta eccome:
 * escludere il giorno intero vorrebbe dire che una seduta fatta stamattina non
 * entra né nel volume né nel carico né nell'RPE — cioè il report ignora
 * l'ultima cosa successa, che è la peggiore delle due bugie possibili.
 */
export function parteTrascorsa(righe = [], settimana) {
  if (!settimana?.fino) return []
  return righe.filter(r => r?.completed_date <= settimana.fino
    && !(r.completed_date === settimana.oggi && r.status !== 'completed'))
}

/** Le assegnazioni di una finestra di date, già filtrate per stato completato. */
const completatiFra = (righe, da, a) =>
  righe.filter(r => r?.status === 'completed' && r.completed_date >= da && r.completed_date <= a)

/**
 * Minuti, carico e RPE medio di un insieme di sessioni completate.
 *
 * ⚠️ `punti` somma solo le sessioni con RPE DICHIARATO (regola 2). `parziale`
 * dice se qualcosa è rimasto fuori, ed è l'unica cosa che impedisce a un
 * numero incompleto di presentarsi come completo.
 */
export function caricoDi(righe = []) {
  let minuti = 0, punti = 0, sessioni = 0, misurate = 0, sommaRpe = 0
  for (const r of righe) {
    const m = durataWorkout(r.workouts?.sections)
    minuti += m
    sessioni++
    const rpe = rpeDichiarato(r.notes)
    if (rpe == null) continue
    punti += m * rpe
    sommaRpe += rpe
    misurate++
  }
  return {
    minuti: Math.round(minuti),
    punti: Math.round(punti),
    sessioni,
    misurate,
    senzaRpe: sessioni - misurate,
    parziale: sessioni > 0 && misurate < sessioni,
    // `null` e non 5: chi non dichiara niente non ha una media (§9-octies).
    rpeMedio: misurate > 0 ? Math.round((sommaRpe / misurate) * 10) / 10 : null,
  }
}

/**
 * Il rapporto fra il carico della settimana e la media delle ultime
 * `SETTIMANE_CRONICO` (acute:chronic workload ratio, forma «coupled»: la
 * settimana in esame è dentro la media, come nella formulazione originale).
 *
 * Torna `null` invece di 1 quando i dati non bastano: un rapporto neutro
 * inventato si legge come «tutto a posto», che è esattamente ciò che non si sa.
 */
export function rapportoCarico(acuto, storico = []) {
  const settimaneAttive = storico.filter(s => s.punti > 0).length
  const misurate = storico.reduce((somma, s) => somma + s.misurate, 0)
  if (misurate < MINIMO_SESSIONI_CARICO || settimaneAttive < MINIMO_SETTIMANE_CARICO) return null
  const cronico = storico.reduce((somma, s) => somma + s.punti, 0) / SETTIMANE_CRONICO
  if (cronico <= 0) return null
  return Math.round((acuto / cronico) * 100) / 100
}

/**
 * Di quanto l'atleta ha percepito la settimana più dura (o più facile) di
 * come il coach l'aveva pensata.
 *
 * È il confronto fra `sections.intensity` — l'intensità che il coach ha
 * dichiarato scrivendo il workout — e l'RPE che l'atleta ha segnato dopo
 * averlo fatto. Nessun'altra schermata mette i due numeri uno accanto
 * all'altro, ed è l'unico segnale che dice se la programmazione sta chiedendo
 * più di quello che voleva chiedere.
 *
 * ⚠️ Serve che ESISTANO entrambi: `rpeAtteso` torna `null` su un workout senza
 * intensità dichiarata e senza blocchi riconoscibili, `rpeDichiarato` torna
 * `null` su un completamento senza marcatore. Le sessioni in cui manca uno dei
 * due non entrano nella media, e `sessioni` dice su quante è calcolata.
 */
export function scartoRpeDi(righe = []) {
  let somma = 0, quante = 0
  for (const r of righe) {
    const atteso = rpeAtteso(r.workouts?.sections)
    const dichiarato = rpeDichiarato(r.notes)
    if (atteso == null || dichiarato == null) continue
    somma += dichiarato - atteso
    quante++
  }
  if (quante < MINIMO_SESSIONI_SCARTO) return { valore: null, sessioni: quante }
  return { valore: Math.round((somma / quante) * 10) / 10, sessioni: quante }
}

/**
 * Le `SETTIMANE_CRONICO` settimane che finiscono con quella che comincia il
 * `inizio` passato — il materiale con cui `rapportoCarico` costruisce la media.
 *
 * ⚠️ Esportata il 02/09/2026 per `src/lib/previsione.js`, che proietta il
 * carico di un workout ancora da assegnare sulla stessa media: una seconda
 * copia di questo ciclo vorrebbe dire che il rapporto mostrato prima di
 * assegnare e quello mostrato nel report sono costruiti su finestre diverse, e
 * **nessuno dei due sarebbe sbagliato preso da solo**.
 */
export function storicoCronico(righe = [], inizio) {
  const storico = []
  for (let i = SETTIMANE_CRONICO - 1; i >= 0; i--) {
    const da = iso(new Date(inizio.getTime() - i * 7 * 86400000))
    const a = iso(new Date(inizio.getTime() - (i * 7 - 6) * 86400000))
    storico.push(caricoDi(completatiFra(righe, da, a)))
  }
  return storico
}

/** Da quanti giorni un atleta non chiude un allenamento, alla data di riferimento. */
function fermoAl(righe = [], riferimento) {
  let ultimo = null
  for (const r of righe) {
    if (r?.status !== 'completed' || !r.completed_date) continue
    if (r.completed_date > riferimento) continue
    if (!ultimo || r.completed_date > ultimo) ultimo = r.completed_date
  }
  if (!ultimo) return { giorni: null, oltre: true, ultimo: null }
  return {
    giorni: differenceInCalendarDays(parseISO(riferimento), parseISO(ultimo)),
    oltre: false,
    ultimo,
  }
}

/**
 * Le etichette di verdetto, con il tono che le distingue a schermo e l'ordine
 * in cui il coach ci lavora sopra.
 *
 * ⚠️ `attesa` e `vuoto` sono due cose diverse e devono restarlo: chi ha quattro
 * allenamenti in programma da giovedì non è «senza programma» — lo sarebbe
 * letto ogni lunedì mattina da tutta la squadra, ed è l'etichetta che poi non
 * si crede più quando è vera.
 */
export const VERDETTI = {
  fermo: { etichetta: 'Da richiamare', tono: 'allarme', ordine: 0 },
  scarica: { etichetta: 'Da scaricare', tono: 'allarme', ordine: 1 },
  aderenza: { etichetta: 'Aderenza bassa', tono: 'attenzione', ordine: 2 },
  vuoto: { etichetta: 'Senza programma', tono: 'attenzione', ordine: 3 },
  carica: { etichetta: 'Puoi caricare', tono: 'buono', ordine: 4 },
  attesa: { etichetta: 'Da iniziare', tono: 'neutro', ordine: 5 },
  linea: { etichetta: 'In linea', tono: 'neutro', ordine: 6 },
}

/** Il numero con la virgola, come si scrive in italiano. */
export const decimale = (n) => String(n).replace('.', ',')

const conSegno = (n) => `${n > 0 ? '+' : ''}${decimale(n)}`

/**
 * Cosa dovrebbe fare il coach con questo atleta, e perché.
 *
 * L'ordine delle condizioni È la regola, non un dettaglio: chi è sparito si
 * richiama prima di scaricarlo, e un carico in salita conta più di un'aderenza
 * bassa — perché il primo è un rischio, la seconda una conversazione.
 *
 * ⚠️ L'aderenza guarda `assegnati`, che sono già i soli giorni TRASCORSI
 * (regola 1). Legarla alla frazione piena accenderebbe l'allarme su tutta la
 * squadra ogni lunedì.
 */
export function verdettoAtleta(m) {
  if (m.fermo) {
    const g = m.fermo.oltre ? null : m.fermo.giorni
    return {
      verdetto: 'fermo',
      motivo: g == null
        ? 'Nessun allenamento chiuso, in tutto il periodo caricato'
        : `Nessun allenamento chiuso da ${g} giorni`,
    }
  }

  if (m.acwr != null && m.acwr > ACWR_ALTO) {
    return {
      verdetto: 'scarica',
      motivo: `Carico ${conSegno(Math.round((m.acwr - 1) * 100))}% sulla media di ${SETTIMANE_CRONICO} settimane`,
    }
  }

  if (m.scartoRpe != null && m.scartoRpe >= SCARTO_RPE) {
    return {
      verdetto: 'scarica',
      motivo: `Sforzo percepito ${conSegno(m.scartoRpe)} rispetto a quello che avevi previsto`,
    }
  }

  if (m.assegnati === 0) {
    return m.daVenire > 0
      ? {
        verdetto: 'attesa',
        motivo: `${m.daVenire} ${m.daVenire === 1 ? 'allenamento' : 'allenamenti'} in programma nei giorni che restano`,
      }
      : { verdetto: 'vuoto', motivo: 'Nessun allenamento assegnato in questa settimana' }
  }

  if (m.assegnati >= 2 && m.percentuale < ADERENZA_BASSA) {
    return {
      verdetto: 'aderenza',
      motivo: `${m.completati} di ${m.assegnati} allenamenti chiusi`,
    }
  }

  if (m.percentuale >= ADERENZA_ALTA) {
    if (m.acwr != null && m.acwr < ACWR_BASSO) {
      return { verdetto: 'carica', motivo: `Settimana seguita con carico sotto la sua media` }
    }
    if (m.scartoRpe != null && m.scartoRpe <= -SCARTO_RPE) {
      return { verdetto: 'carica', motivo: `Sforzo percepito ${conSegno(m.scartoRpe)} rispetto al previsto` }
    }
  }

  return { verdetto: 'linea', motivo: `${m.completati} di ${m.assegnati} allenamenti chiusi` }
}

/** Le sessioni per corsia, per dire di che cosa era fatta la settimana. */
function corsieDi(righe = []) {
  const conteggi = new Map()
  for (const r of righe) {
    const cat = categoriaDi(r.workouts?.sections)
    conteggi.set(cat, (conteggi.get(cat) || 0) + 1)
  }
  return Object.keys(CORSIA)
    .filter(c => conteggi.has(c))
    .map(categoria => ({ categoria, etichetta: CORSIA[categoria].etichetta, sessioni: conteggi.get(categoria) }))
}

/**
 * Le note e le note vocali arrivate nella settimana.
 *
 * ⚠️ Non è l'eroe della Home: lì contano i feedback NON LETTI, qui tutti quelli
 * della settimana — un report che salta le note già aperte racconterebbe una
 * settimana diversa da quella che è stata. Vale lo stesso limite dei dati:
 * `voice_note_url` è una colonna sola per una comunicazione bidirezionale, e si
 * contano perciò le sole assegnazioni completate (CLAUDE.md §9-nonies).
 */
function feedbackDi(righe = [], nomi) {
  const elementi = []
  for (const r of righe) {
    const haVocale = isVoiceNoteValid(r.voice_note_url)
    const rpe = rpeDichiarato(r.notes)
    const testo = testoNota(r.notes)
    if (!haVocale && !testo) continue
    elementi.push({
      id: r.id,
      workoutId: r.workouts?.id,
      atletaId: r.athlete_id,
      nome: nomi.get(r.athlete_id) || 'Atleta',
      titolo: r.workouts?.title || 'Allenamento',
      data: r.completed_date,
      giorno: format(parseISO(r.completed_date), 'EEE d', { locale: it }),
      haVocale,
      rpe,
      testo,
    })
  }
  return elementi.sort((a, b) => b.data.localeCompare(a.data))
}

/** La frase che riassume la settimana, quella su cui si decide se rifare o cambiare. */
export function fraseSettimana({ squadra, gruppi, prossima, settimana }) {
  if (squadra.assegnati === 0 && squadra.daVenire === 0) {
    return {
      testo: settimana.corrente
        ? 'Nessun allenamento assegnato questa settimana.'
        : 'Nessun allenamento assegnato in questa settimana.',
      dettaglio: null,
    }
  }

  const parti = []
  parti.push(squadra.assegnati > 0
    ? `Aderenza ${squadra.percentuale}%`
    : `${squadra.daVenire} allenamenti in programma`)

  if (squadra.delta?.carico != null) {
    const d = squadra.delta.carico
    if (d >= SOGLIA_STABILE) parti.push('carico in salita')
    else if (d <= -SOGLIA_STABILE) parti.push('carico in calo')
    else parti.push('carico stabile')
  }

  const azioni = []
  if (gruppi.fermo.length) azioni.push(`${gruppi.fermo.length} da richiamare`)
  if (gruppi.scarica.length) azioni.push(`${gruppi.scarica.length} da scaricare`)
  if (prossima.senza > 0) azioni.push(`${prossima.senza} senza programma la prossima settimana`)

  return {
    testo: `${parti.join(', ')}.`,
    // Senza il seguito, «aderenza 62%» non dice cosa farne. Con niente da
    // fare si dichiara lo stato buono, invece di lasciare la riga vuota.
    dettaglio: azioni.length ? `${azioni.join(' · ')}.` : 'Nessun atleta richiede attenzione.',
  }
}

/** Lo scarto percentuale fra due totali, `null` se il precedente è zero (§andamento). */
const scartoPercentuale = (corrente, precedente) =>
  precedente > 0 ? Math.round(((corrente - precedente) / precedente) * 100) : null

/**
 * Il report di una settimana, da una lista sola di assegnazioni.
 *
 * @param atleti        righe `athletes` (l'account del coach è già fuori)
 * @param assegnazioni  righe `athlete_workouts` con `workouts.sections`, su una
 *                      finestra che copra almeno [lunedì − 28 giorni, domenica + 7]
 * @param oggi          iniettabile, così i test non dipendono dal calendario
 * @param scarto        0 = questa settimana, −1 = la scorsa
 */
export function reportSettimanale(atleti = [], assegnazioni = [], { oggi = new Date(), scarto = 0 } = {}) {
  const settimana = settimanaReport(oggi, scarto)
  const seguiti = atletiSeguiti(atleti).filter(a => a?.id)
  const fermi = atleti.filter(a => a?.id && inPausa(a))

  const nomi = new Map(atleti.map(a => [a?.id, nomeAtleta(a)]))

  // Le assegnazioni indicizzate per atleta: una passata sola invece di una
  // scansione per ognuno dei dodici.
  const perAtleta = new Map()
  for (const ass of assegnazioni) {
    if (!ass?.athlete_id || !ass.completed_date) continue
    const lista = perAtleta.get(ass.athlete_id)
    if (lista) lista.push(ass)
    else perAtleta.set(ass.athlete_id, [ass])
  }

  const precedenteDa = iso(new Date(settimana.inizio.getTime() - 7 * 86400000))
  const precedenteA = iso(new Date(settimana.inizio.getTime() - 86400000))
  const prossimaDa = iso(new Date(settimana.fine.getTime() + 86400000))
  const prossimaA = iso(new Date(settimana.fine.getTime() + 7 * 86400000))

  const righe = []
  const completatiSettimana = []
  const assegnatiSettimana = []
  const copertiProssima = []
  const senzaProssima = []

  for (const atleta of seguiti) {
    const sue = perAtleta.get(atleta.id) || []
    const nellaSettimana = sue.filter(r => r.completed_date >= settimana.da && r.completed_date <= settimana.a)
    assegnatiSettimana.push(...nellaSettimana)

    // Regola 1: gli assegnati che contano sono quelli dei giorni già passati,
    // e oggi non è ancora passato per ciò che non è stato fatto.
    const trascorse = parteTrascorsa(nellaSettimana, settimana)
    const daVenire = nellaSettimana.length - trascorse.length
    const chiuse = trascorse.filter(r => r.status === 'completed')
    completatiSettimana.push(...chiuse)

    const carico = caricoDi(chiuse)
    const percentuale = trascorse.length > 0 ? Math.round((chiuse.length / trascorse.length) * 100) : 0

    // Le quattro settimane su cui si misura il "cronico", la corrente inclusa.
    const storico = storicoCronico(sue, settimana.inizio)

    const scartoRpe = scartoRpeDi(chiuse)
    const fermo = fermoAl(sue, settimana.fino || settimana.da)

    const misure = {
      assegnati: trascorse.length,
      completati: chiuse.length,
      daVenire,
      percentuale,
      acwr: rapportoCarico(carico.punti, storico),
      scartoRpe: scartoRpe.valore,
      fermo: (fermo.oltre || fermo.giorni >= GIORNI_FERMO) ? fermo : null,
    }

    const { verdetto, motivo } = verdettoAtleta(misure)

    const prossime = sue.filter(r => r.completed_date >= prossimaDa && r.completed_date <= prossimaA)
    if (prossime.length > 0) copertiProssima.push(atleta.id)
    else senzaProssima.push({ id: atleta.id, nome: nomeAtleta(atleta), foto: atleta.photo_url || null })

    righe.push({
      id: atleta.id,
      nome: nomeAtleta(atleta),
      foto: atleta.photo_url || null,
      ...misure,
      minuti: carico.minuti,
      carico: carico.punti,
      caricoParziale: carico.parziale,
      rpeMedio: carico.rpeMedio,
      senzaRpe: carico.senzaRpe,
      sessioniScarto: scartoRpe.sessioni,
      prossimaSettimana: prossime.length,
      verdetto,
      motivo,
    })
  }

  // Il più urgente per primo, e a parità il più fermo: è l'ordine in cui il
  // coach lavora sulla lista, non l'ordine alfabetico di una rubrica.
  righe.sort((a, b) =>
    VERDETTI[a.verdetto].ordine - VERDETTI[b.verdetto].ordine ||
    (b.fermo?.giorni || 0) - (a.fermo?.giorni || 0) ||
    a.nome.localeCompare(b.nome))

  const gruppi = { fermo: [], scarica: [], aderenza: [], vuoto: [], carica: [], attesa: [], linea: [] }
  for (const r of righe) gruppi[r.verdetto].push(r)

  const caricoSquadra = caricoDi(completatiSettimana)
  const trascorsiSquadra = parteTrascorsa(assegnatiSettimana, settimana)

  // La settimana precedente, per il confronto. Si misura su TUTTI i suoi sette
  // giorni: è finita, quindi la parte trascorsa è tutta.
  const precedenti = []
  for (const atleta of seguiti) {
    precedenti.push(...completatiFra(perAtleta.get(atleta.id) || [], precedenteDa, precedenteA))
  }
  const caricoPrecedente = caricoDi(precedenti)

  const squadra = {
    atleti: seguiti.length,
    inPausa: fermi.length,
    assegnati: trascorsiSquadra.length,
    completati: caricoSquadra.sessioni,
    daVenire: assegnatiSettimana.length - trascorsiSquadra.length,
    percentuale: trascorsiSquadra.length > 0
      ? Math.round((caricoSquadra.sessioni / trascorsiSquadra.length) * 100) : 0,
    minuti: caricoSquadra.minuti,
    carico: caricoSquadra.punti,
    caricoParziale: caricoSquadra.parziale,
    senzaRpe: caricoSquadra.senzaRpe,
    rpeMedio: caricoSquadra.rpeMedio,
    // ⚠️ Il confronto è con la settimana INTERA precedente. Su una settimana in
    // corso confronta tre giorni con sette, e per questo la pagina lo mostra
    // solo a settimana finita: un «−58%» al mercoledì è aritmetica giusta e
    // informazione falsa.
    delta: {
      minuti: scartoPercentuale(caricoSquadra.minuti, caricoPrecedente.minuti),
      carico: scartoPercentuale(caricoSquadra.punti, caricoPrecedente.punti),
      confrontabile: !settimana.corrente && !settimana.futura && caricoPrecedente.sessioni > 0,
    },
    precedente: { minuti: caricoPrecedente.minuti, carico: caricoPrecedente.punti },
  }

  const prossima = {
    da: prossimaDa,
    a: prossimaA,
    etichetta: intervalloBreve(parseISO(prossimaDa), parseISO(prossimaA)),
    coperti: copertiProssima.length,
    totale: seguiti.length,
    senza: senzaProssima.length,
    righe: senzaProssima,
    // Programmare una settimana già passata non è un'azione: la sezione
    // sparisce invece di chiedere al coach di fare qualcosa di impossibile.
    utile: prossimaA >= iso(oggi),
  }

  return {
    settimana,
    squadra,
    righe,
    gruppi,
    corsie: corsieDi(assegnatiSettimana),
    feedback: feedbackDi(completatiSettimana, nomi),
    prossima,
    inPausa: fermi.map(a => {
      const { dal } = parseNotePausa(a.notes)
      const d = dal ? parseISO(dal) : null
      return {
        id: a.id,
        nome: nomeAtleta(a),
        foto: a.photo_url || null,
        dal: d && isValid(d) ? format(d, 'd MMM', { locale: it }) : null,
      }
    }),
    frase: fraseSettimana({ squadra, gruppi, prossima, settimana }),
  }
}

/**
 * I minuti in ore e minuti: «11h 20», «48 min».
 *
 * ⚠️ Sotto l'ora si scrive in minuti e non «0h 48»: un totale che apre con uno
 * zero si legge come un dato mancante.
 */
export function oreMinuti(minuti = 0) {
  const m = Math.max(0, Math.round(minuti))
  if (m < 60) return `${m} min`
  const ore = Math.floor(m / 60)
  const resto = m % 60
  return resto === 0 ? `${ore}h` : `${ore}h ${String(resto).padStart(2, '0')}`
}
