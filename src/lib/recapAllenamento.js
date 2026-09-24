// Il recap che si apre quando un atleta chiude un allenamento (22/09/2026).
//
// È la schermata in stile "storie" che arriva DOPO la modale RPE: una sequenza
// di schede a tutto schermo che dicono cos'è appena successo, come sta andando
// la settimana, che forma ha l'andamento, e — la sola che guarda avanti —
// qual è il prossimo passo.
//
// 🔴 PERCHÉ LA DECISIONE DI QUALI SCHEDE MOSTRARE STA QUI, E NON NEL COMPONENTE.
// Il recap si apre in tre punti diversi dell'app (Home, scheda workout, scheda
// atleta), e in tutti e tre deve decidere la stessa cosa sugli stessi dati: se
// questo è il primo allenamento di sempre, se l'andamento ha abbastanza punti
// per essere disegnato, se esiste un prossimo assegnato. Tre copie di quella
// decisione sarebbero tre recap diversi per lo stesso atleta — e nessuno dei
// tre darebbe un errore.
//
// 🔴 LA REGOLA CHE GOVERNA OGNI CELLA È QUELLA DELLA HOME (CLAUDE.md
// §9-duodetricies): *nessuna cella mostra uno zero — al posto di un dato che
// non esiste ancora va la cosa che lo farà esistere.* Qui pesa il doppio: è una
// schermata di festeggiamento, e un «0 min» dentro un coriandolo si legge come
// una presa in giro. Da cui: le schede si TOLGONO invece di riempirsi di zeri,
// e ognuna che sparisce ha un rimpiazzo che dice cosa la accenderà.

import { startOfWeek, format, differenceInDays, parseISO, getISOWeek } from 'date-fns'
import { it } from 'date-fns/locale'
import { categoriaDi } from './categorie'
import { rpeDichiarato } from './rpe'
import { celleStoria } from './recapStoria'
import { SOGLIA_STABILE } from './andamento'
import {
  durataWorkout, numeroBlocchi, serieGiorni, minutiSettimana,
  scartoMinutiSettimana, MINIMO_PRECEDENTI,
} from './statistiche'

/**
 * La finestra su cui si disegnano i grafici del recap.
 *
 * 90 giorni e non 60 come la Home: qui il grafico è l'andamento per SETTIMANE,
 * e con 60 giorni le barre sarebbero otto — di cui una parziale — su un periodo
 * troppo corto per dire se qualcosa sta salendo o scendendo. È anche il motivo
 * per cui il recap fa una lettura propria invece di riusare lo storico della
 * Home: gli servono più giorni, e li chiede una volta sola, al momento in cui
 * si apre.
 */
export const GIORNI_RECAP = 90

/** Quante barre ha il grafico dell'andamento. */
export const SETTIMANE_ANDAMENTO = 8

/**
 * Quante settimane servono al VERDETTO, che sono una in più di quelle
 * disegnate.
 *
 * 🔴 Il verdetto confronta quattro settimane chiuse con le quattro precedenti,
 * cioè otto CHIUSE — e la serie del grafico ne ha otto in tutto, di cui
 * l'ultima è quella in corso. Con la stessa serie per le due cose il verdetto
 * sarebbe quindi `null` **sempre**: la fascia non sarebbe mai comparsa, e
 * nessun test l'avrebbe segnalato perché `null` è anche la risposta giusta a
 * un atleta nuovo. Trovato guardando la schermata, non leggendo il codice.
 * Le barre restano otto perché nove, su 375px, sono schegge.
 */
export const SETTIMANE_VERDETTO = SETTIMANE_ANDAMENTO + 1

/**
 * Sotto questo numero di allenamenti chiusi l'andamento non si disegna.
 *
 * ⚠️ È `MINIMO_PRECEDENTI` di `statistiche.js`, non un 3 riscritto qui: è la
 * stessa soglia con cui la Home decide se accendere «Media RPE» o mostrare la
 * cella che dichiara quanto manca. Due numeri scritti a mano in due punti
 * direbbero all'atleta «si accende dopo 3 allenamenti» e poi lo accenderebbero
 * al quarto, senza dare nessun errore.
 */
export const MINIMO_ANDAMENTO = MINIMO_PRECEDENTI

const ISO = (d) => format(d, 'yyyy-MM-dd')
const completati = (storico) => (storico || []).filter(w => w?.status === 'completed')

/** Il lunedì della settimana che contiene `giorno`. */
const lunediDi = (giorno) => startOfWeek(giorno, { weekStartsOn: 1 })

/**
 * Le barre del grafico: minuti completati, settimana per settimana.
 *
 * 🔴 Settimana di CALENDARIO che comincia di LUNEDÌ, come la rubrica, l'anello
 * della Home e il report (CLAUDE.md §9-septdecies punto 4). Una finestra mobile
 * di sette giorni darebbe barre che non coincidono con il «3 su 5» che l'atleta
 * ha appena letto nella scheda accanto, e nessuno dei due numeri sarebbe
 * sbagliato preso da solo.
 *
 * ⚠️ L'ultima barra è la settimana in corso, quindi è PARZIALE per definizione.
 * Il campo `corrente` esiste perché la scheda lo dica invece di lasciar leggere
 * un calo che è solo mercoledì.
 */
export function settimaneAndamento(storico = [], oggi = new Date(), quante = SETTIMANE_ANDAMENTO) {
  const fatti = completati(storico)
  const barre = []

  for (let i = quante - 1; i >= 0; i--) {
    const inizio = lunediDi(new Date(oggi.getTime() - i * 7 * 86400000))
    const fine = new Date(inizio)
    fine.setDate(inizio.getDate() + 6)
    const dal = ISO(inizio)
    const al = ISO(fine)

    let minuti = 0
    let sedute = 0
    for (const w of fatti) {
      if (!w.completed_date || w.completed_date < dal || w.completed_date > al) continue
      minuti += durataWorkout(w.workouts?.sections)
      sedute++
    }

    barre.push({
      chiave: dal,
      breve: `S${getISOWeek(inizio)}`,
      minuti: Math.round(minuti),
      sedute,
      corrente: i === 0,
    })
  }

  const massimo = Math.max(...barre.map(b => b.minuti), 0)
  // `quota` è l'altezza in percentuale. Con tutte le settimane a zero resta a
  // zero invece di dividere per zero — è il caso dell'atleta nuovo, e un NaN
  // lì dentro si traduce in una barra che non si disegna affatto.
  return barre.map(b => ({ ...b, quota: massimo > 0 ? Math.round((b.minuti / massimo) * 100) : 0 }))
}

/**
 * Dove sta andando il volume: le ultime quattro settimane CHIUSE contro le
 * quattro precedenti.
 *
 * 🔴 La settimana in corso resta FUORI dal confronto. È parziale — il lunedì
 * vale un settimo di sé stessa — e infilarla nella media farebbe dichiarare un
 * crollo ogni lunedì mattina. È la stessa correzione che l'aderenza del report
 * ha già ricevuto (CLAUDE.md §9-vicies).
 *
 * Torna `null` quando le due metà non esistono entrambe: un andamento
 * costruito su una metà vuota è una percentuale enorme e priva di significato.
 */
export function verdettoAndamento(barre = []) {
  const chiuse = barre.filter(b => !b.corrente)
  if (chiuse.length < 8) return null

  const media = (v) => v.reduce((a, b) => a + b.minuti, 0) / v.length
  const recenti = media(chiuse.slice(-4))
  const prima = media(chiuse.slice(-8, -4))
  if (prima <= 0) return null

  const delta = Math.round(((recenti - prima) / prima) * 100)
  if (delta >= SOGLIA_STABILE) return { testo: 'Volume in crescita', delta, tono: 'buono' }
  if (delta <= -SOGLIA_STABILE) return { testo: 'Volume in calo', delta, tono: 'attenzione' }
  return { testo: 'Volume stabile', delta, tono: 'attenzione' }
}

/**
 * I totali della finestra: quante sedute, quante ore, che RPE medio.
 *
 * ⚠️ L'RPE medio passa da `rpeDichiarato`, non da `parseNotesAndRpe`: il
 * secondo torna **5** quando il marcatore manca, e quel 5 entrerebbe nella
 * media come se fosse una misura. Chi non compila mai l'RPE si vedrebbe
 * restituire «5,0» come il proprio sforzo medio — un numero inventato, su una
 * schermata che esiste per dirgli una cosa vera. Senza abbastanza RPE segnati
 * la cella torna `null` e sparisce.
 */
export function totaliFinestra(storico = [], oggi = new Date(), giorni = GIORNI_RECAP) {
  const dal = ISO(new Date(oggi.getTime() - giorni * 86400000))
  const al = ISO(oggi)

  let sedute = 0, minuti = 0, sommaRpe = 0, quantiRpe = 0
  for (const w of completati(storico)) {
    if (!w.completed_date || w.completed_date < dal || w.completed_date > al) continue
    sedute++
    minuti += durataWorkout(w.workouts?.sections)
    const rpe = rpeDichiarato(w.notes)
    if (rpe != null) { sommaRpe += rpe; quantiRpe++ }
  }

  return {
    sedute,
    minuti: Math.round(minuti),
    ore: Math.round(minuti / 60),
    rpeMedio: quantiRpe > 0 ? Math.round((sommaRpe / quantiRpe) * 10) / 10 : null,
  }
}

/** I sette giorni della settimana in corso, con il loro stato. */
export function giorniSettimana(storico = [], oggi = new Date()) {
  const inizio = lunediDi(oggi)
  const oggiStr = ISO(oggi)
  const giorni = []

  for (let i = 0; i < 7; i++) {
    const d = new Date(inizio)
    d.setDate(inizio.getDate() + i)
    const dStr = ISO(d)
    const righe = (storico || []).filter(w => w?.completed_date === dStr)
    giorni.push({
      chiave: dStr,
      lettera: format(d, 'EEEEE', { locale: it }).toUpperCase(),
      oggi: dStr === oggiStr,
      assegnati: righe.length,
      fatti: righe.filter(w => w.status === 'completed').length,
      categoria: righe[0] ? categoriaDi(righe[0].workouts?.sections) : null,
    })
  }
  return giorni
}

/** «Domani», «Fra 3 giorni»: il tempo che manca, detto come lo direbbe uno. */
const quando = (giorni) => {
  if (giorni <= 0) return 'Oggi'
  if (giorni === 1) return 'Domani'
  if (giorni < 7) return `Fra ${giorni} giorni`
  if (giorni < 14) return 'Fra una settimana'
  return `Fra ${Math.round(giorni / 7)} settimane`
}

/**
 * La scheda che guarda avanti, ed è l'unica ragione per cui questo recap non è
 * un riassunto ma uno stimolo.
 *
 * Tre forme, in ordine di quanto sono concrete:
 * 1. **assegnato** — c'è già un allenamento in programma. È il caso normale.
 * 2. **evento** — niente in programma, ma una gara in calendario: il conto alla
 *    rovescia è comunque una ragione per tornare.
 * 3. **libero** — non c'è niente. ⚠️ Qui NON si scrive «il coach sta
 *    preparando il prossimo»: è una promessa che facciamo a nome di qualcun
 *    altro e che nessun dato sostiene. Si offre invece l'unica cosa che
 *    l'atleta può fare da solo — registrare un allenamento libero — e si dice
 *    la serie, che è il dato vero che ha in mano.
 */
export function prossimoPasso(storico = [], oggi = new Date()) {
  const oggiStr = ISO(oggi)
  const futuri = (storico || [])
    .filter(w => w?.completed_date > oggiStr && w.status !== 'completed')
    .sort((a, b) => a.completed_date.localeCompare(b.completed_date))

  const eventi = futuri.filter(w => categoriaDi(w.workouts?.sections) === 'Event')
  const allenamenti = futuri.filter(w => categoriaDi(w.workouts?.sections) !== 'Event')

  const gara = eventi[0]
    ? {
        titolo: (eventi[0].workouts?.title || '').trim() || 'Gara',
        giorni: differenceInDays(parseISO(eventi[0].completed_date), parseISO(oggiStr)),
      }
    : null

  const serie = serieGiorni(storico, oggi)

  const prossimo = allenamenti[0]
  if (prossimo) {
    const sezioni = prossimo.workouts?.sections
    const categoria = categoriaDi(sezioni)
    const giorni = differenceInDays(parseISO(prossimo.completed_date), parseISO(oggiStr))
    // ⚠️ Durata e blocchi solo dove esistono: un allenamento libero non ha
    // blocchi da contare, e `durataWorkout` su di lui torna il ripiego di 45
    // minuti — corretto per una media, una bugia stampata in grande.
    const stimabile = categoria !== 'Custom' && categoria !== 'Event'
    return {
      tipo: 'assegnato',
      id: prossimo.id,
      workoutId: prossimo.workouts?.id,
      titolo: (prossimo.workouts?.title || '').trim() || 'Senza titolo',
      categoria,
      giorni,
      quando: quando(giorni),
      data: format(parseISO(prossimo.completed_date), 'EEE d MMM', { locale: it }),
      minuti: stimabile ? durataWorkout(sezioni) : null,
      blocchi: stimabile ? numeroBlocchi(sezioni) : null,
      gara,
      serie,
    }
  }

  if (gara) return { tipo: 'evento', gara, serie }
  return { tipo: 'libero', gara: null, serie }
}

/**
 * Tutto il recap, in un oggetto solo.
 *
 * @param aw                la riga appena completata, con `workouts` incluso
 * @param storico           le righe dell'atleta nella finestra (futuri compresi)
 * @param totaleCompletati  quanti ne ha chiusi in TUTTA la sua storia, se lo
 *                          sappiamo. `null` quando la lettura non è arrivata:
 *                          l'ordinale sparisce invece di dire un numero che
 *                          vale solo per la finestra.
 */
export function costruisciRecap({ aw, storico = [], totaleCompletati = null, oggi = new Date() } = {}) {
  const sezioni = aw?.workouts?.sections
  const categoria = categoriaDi(sezioni)
  const dichiarato = rpeDichiarato(aw?.notes)

  const fatto = {
    tipo: 'fatto',
    titolo: (aw?.workouts?.title || '').trim() || 'Senza titolo',
    categoria,
    data: aw?.completed_date
      ? format(parseISO(aw.completed_date), 'EEEE d MMMM', { locale: it })
      : format(oggi, 'EEEE d MMMM', { locale: it }),
    // ⚠️ Le tre celle vengono da `celleStoria`, la stessa funzione della
    // grafica da storia (CLAUDE.md §9-unetvicies): il `≈` sulla durata, l'RPE
    // dichiarato che non ripiega su 5, la corsa mista che non dichiara un
    // totale. Riscriverle qui vorrebbe dire due recap dello stesso allenamento
    // con due numeri diversi, uno nell'app e uno nell'immagine condivisa.
    celle: celleStoria(aw?.workouts, { rpe: dichiarato }),
    ordinale: Number.isFinite(totaleCompletati) && totaleCompletati > 0 ? totaleCompletati : null,
  }

  // Quanti ne ha chiusi in tutto. Il conteggio della finestra è il ripiego
  // quando la lettura del totale non è arrivata: sottostima, non sovrastima —
  // e sottostimare qui vuol dire al massimo mostrare una scheda in meno.
  const totali = totaliFinestra(storico, oggi)
  const quanti = Number.isFinite(totaleCompletati) ? totaleCompletati : totali.sedute
  const primoDiSempre = quanti <= 1

  const slide = [fatto]

  // Il parere sull'allenamento (src/lib/gradimento.js), subito dopo «fatto»:
  // è il momento in cui la seduta è ancora nelle gambe, e le schede che
  // seguono parlano d'altro — la settimana, le otto settimane, il prossimo.
  // ⚠️ Solo con un id da aggiornare: senza, la risposta non avrebbe dove
  // finire, e una domanda la cui risposta si butta è una domanda finta.
  if (aw?.id) slide.push({ tipo: 'gradimento' })

  if (primoDiSempre) {
    slide.push({
      tipo: 'primo',
      minuti: totali.minuti,
      soglia: MINIMO_ANDAMENTO,
      rpe: dichiarato,
    })
  } else {
    const giorni = giorniSettimana(storico, oggi)
    slide.push({
      tipo: 'settimana',
      giorni,
      fatti: giorni.reduce((a, g) => a + g.fatti, 0),
      totale: giorni.reduce((a, g) => a + g.assegnati, 0),
      minuti: Math.round(minutiSettimana(storico, oggi)),
      scarto: scartoMinutiSettimana(storico, oggi),
      serie: serieGiorni(storico, oggi),
    })

    if (quanti >= MINIMO_ANDAMENTO) {
      const barre = settimaneAndamento(storico, oggi)
      slide.push({
        tipo: 'andamento',
        barre,
        // ⚠️ Il verdetto legge una serie PIÙ LUNGA di quella disegnata: con le
        // sole barre del grafico le settimane chiuse sono sette, e sette non
        // bastano (vedi SETTIMANE_VERDETTO).
        verdetto: verdettoAndamento(settimaneAndamento(storico, oggi, SETTIMANE_VERDETTO)),
        totali,
        // Vero quando la finestra contiene TUTTA la sua storia: allora il
        // titolo può dire «da quando hai iniziato» invece di «ultimi 90
        // giorni», che è la stessa cifra ma non la stessa frase.
        daSempre: Number.isFinite(totaleCompletati) && totaleCompletati === totali.sedute,
      })
    } else {
      slide.push({
        tipo: 'inArrivo',
        etichetta: 'Andamento',
        testo: 'Il grafico delle settimane si accende quando ci sono abbastanza allenamenti da confrontare.',
        fatti: quanti,
        soglia: MINIMO_ANDAMENTO,
      })
    }
  }

  // ⚠️ `forma` e non `tipo`: `tipo` è già la chiave con cui la UI sceglie la
  // scheda, e sovrascriverla con 'assegnato' farebbe cercare un componente che
  // non esiste — senza errore, solo una scheda vuota in fondo al recap.
  const passo = prossimoPasso(storico, oggi)
  slide.push({ ...passo, tipo: 'prossimo', forma: passo.tipo })

  return { categoria, titolo: fatto.titolo, slide }
}

/**
 * Il recap ridotto alle schede che non leggono niente: «fatto» e il gradimento.
 *
 * 🔴 È la risposta a una lettura fallita — offline, o il server che non
 * risponde — e non un caso di ripiego cosmetico. Senza di lui la strada era
 * chiamare `costruisciRecap` con uno storico vuoto, e lì `quanti` vale zero:
 * a un atleta con cento allenamenti alle spalle il recap avrebbe annunciato
 * «il primo è fatto». Un guasto travestito da dato, sulla schermata che esiste
 * per dirgli una cosa vera (CLAUDE.md §9-quater).
 *
 * Serve anche al primo fotogramma: la scheda «fatto» non ha bisogno di
 * nessuna lettura, quindi si mostra subito e le altre si aggiungono quando
 * arrivano.
 */
export function recapMinimo({ aw, oggi = new Date() } = {}) {
  const { slide, categoria, titolo } = costruisciRecap({ aw, storico: [], totaleCompletati: null, oggi })
  // ⚠️ Anche il gradimento resta: non ha bisogno di nessuna lettura, e
  // offline la sua risposta finisce nella coda come il completamento.
  return { categoria, titolo, slide: slide.filter(s => s.tipo === 'fatto' || s.tipo === 'gradimento') }
}
