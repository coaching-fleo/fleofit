// Il report settimanale del SINGOLO atleta — la pagina su cui si decide cosa
// scrivere nel suo prossimo allenamento.
//
// Perché esiste accanto a `reportSettimanale.js`: quello risponde a «com'è
// andata la squadra», che è una domanda di triage — chi guardare per primo.
// Questa risponde a «cosa gli faccio fare adesso», che è un'altra domanda e
// vuole altro materiale: le sedute una per una, i movimenti che ha davvero
// fatto e con che carichi, e le quattro settimane precedenti come metro di
// paragone.
//
// ⚠️ NON ridefinisce una sola soglia. Finestra, carico, rapporto acuto/cronico,
// scarto RPE e verdetti vengono da `reportSettimanale.js`, che a sua volta
// prende `GIORNI_FERMO` da `statisticheCoach.js` e `SOGLIA_STABILE` da
// `andamento.js`. Due soglie per lo stesso concetto darebbero due numeri
// diversi in due schermate della stessa app, e **nessuno dei due sarebbe
// sbagliato da solo** — il difetto impossibile da notare.
//
// 🔴 E vale anche qui la regola che tiene onesto tutto il report: nessun numero
// si inventa per riempire una cella. Un movimento senza kg dichiarati non ha un
// carico, una seduta senza RPE non ha uno sforzo, e una proposta senza un
// numero dietro non si scrive.

import { format, parseISO, differenceInCalendarDays, getISOWeek } from 'date-fns'
import { it } from 'date-fns/locale'
import { durataWorkout, rpeAtteso, numeroBlocchi } from './statistiche'
import { rpeDichiarato, testoNota } from './rpe'
import { categoriaDi } from './categorie'
import { isVoiceNoteValid } from './notaVocale'
import { getNormalizedBlocks } from './timerSequence'
import { giriBlocco, metriDi } from './stimaWorkout'
import { GIORNI_FERMO } from './statisticheCoach'
import {
  settimanaReport, caricoDi, rapportoCarico, scartoRpeDi, verdettoAtleta, parteTrascorsa,
  SETTIMANE_CRONICO, ACWR_ALTO, ACWR_BASSO, SCARTO_RPE,
  ADERENZA_BASSA, ADERENZA_ALTA, decimale,
} from './reportSettimanale'

/** Quante settimane mostra il grafico di confronto: quella scelta più le quattro prima. */
export const SETTIMANE_CONFRONTO = 5

/**
 * Da quanti giorni un movimento si considera «trascurato».
 *
 * Tre settimane e non due: un mesociclo tiene fuori un movimento anche per due
 * settimane di fila senza che sia una dimenticanza. A tre, o è una scelta che
 * il coach ricorda, o è una scelta che non ha fatto.
 */
export const GIORNI_TRASCURATO = 21

/** Quanti movimenti stanno in pagina prima del «+N altri». */
export const MOVIMENTI_IN_PAGINA = 8

/**
 * Quanto si può alzare il volume in una settimana, comunque vada il calcolo.
 *
 * ⚠️ Serve un tetto perché il rapporto acuto/cronico, riportato a 1, può
 * suggerire salti assurdi: un atleta a 0,29× della sua media «dovrebbe»
 * riprendere con il 245% in più. La progressione settimanale prudente sta
 * intorno al 10%; 15 è il margine che si concede a chi ha scaricato di
 * proposito.
 */
export const AUMENTO_MASSIMO = 15

/** Sotto questa quota di sedute senza RPE, il buco non merita una proposta. */
const QUOTA_SENZA_RPE = 0.5

const giornoBreve = (data) => format(parseISO(data), 'EEE d', { locale: it })

/**
 * Le sedute della settimana, una per una — il diario.
 *
 * Tre stati e non due: «saltato» e «in programma» sono la stessa riga nei dati
 * (`status !== 'completed'`) e due cose opposte per chi legge. Distinguerli
 * costa una data e vale l'intera lettura della settimana: senza, il venerdì
 * ancora da fare compare come un buco già scavato.
 */
export function sessioniDi(righe = [], settimana) {
  const dentro = righe.filter(r => r?.completed_date >= settimana.da && r.completed_date <= settimana.a)

  return dentro.map(r => {
    const sections = r.workouts?.sections
    const completato = r.status === 'completed'
    // ⚠️ Anche qui la giornata non è finita: un allenamento di OGGI non ancora
    // chiuso è «da fare», non «saltato». A schermo sono due parole opposte, e
    // quella sbagliata compare tutte le mattine.
    const futuro = !settimana.fino || r.completed_date > settimana.fino
      || (r.completed_date === settimana.oggi && !completato)
    const atteso = rpeAtteso(sections)
    // ⚠️ `rpeDichiarato` e non `parseNotesAndRpe`: il secondo torna 5 quando il
    // marcatore manca, e in una riga di diario quel 5 si legge come una seduta
    // media invece che come una seduta senza dato.
    const dichiarato = completato ? rpeDichiarato(r.notes) : null
    const testo = testoNota(r.notes)

    return {
      id: r.id,
      workoutId: r.workouts?.id,
      data: r.completed_date,
      giorno: giornoBreve(r.completed_date),
      titolo: r.workouts?.title || 'Allenamento',
      categoria: categoriaDi(sections),
      stato: completato ? 'completato' : futuro ? 'in programma' : 'saltato',
      minuti: durataWorkout(sections),
      blocchi: numeroBlocchi(sections),
      atteso,
      dichiarato,
      // Lo scarto esiste solo se esistono entrambi: è il confronto fra ciò che
      // il coach aveva previsto e ciò che l'atleta ha sentito, e con uno dei due
      // mancante non è un confronto, è metà di un confronto.
      scarto: atteso != null && dichiarato != null ? dichiarato - atteso : null,
      testo: completato ? testo : '',
      haVocale: completato && isVoiceNoteValid(r.voice_note_url),
    }
  }).sort((a, b) => a.data.localeCompare(b.data))
}

/** Un numero scritto a mano, `null` se non è un numero utile. */
const numero = (v) => {
  const n = parseFloat(String(v ?? '').replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * I movimenti che l'atleta ha davvero fatto, con i carichi.
 *
 * È il pezzo che serve a comporre il prossimo allenamento e che oggi non esiste
 * da nessuna parte nell'app: per sapere con che peso ha fatto i wall balls
 * l'ultima volta bisogna aprire la sua scheda, trovare la seduta, aprirla e
 * cercare la riga.
 *
 * ⚠️ Si contano solo le sedute **completate**: qui la domanda è cosa ha fatto,
 * non cosa gli era stato dato.
 * ⚠️ Le ripetizioni e i metri si moltiplicano per i giri del blocco
 * (`giriBlocco`, la stessa funzione che usa `durataBlocco`): dieci burpees in
 * un For Time da cinque round sono cinquanta, e contarli dieci è l'errore che
 * fa sembrare leggera la seduta più dura della settimana.
 * ⚠️ «Rest» non è un movimento, ed è l'unico esercizio che tiene la propria
 * durata dentro `meters`: contarlo darebbe un movimento con centinaia di metri
 * che nessuno ha percorso.
 */
export function movimentiDi(righe = [], { fino } = {}) {
  const mappa = new Map()
  const riferimento = fino ? parseISO(fino) : new Date()

  for (const r of righe) {
    if (r?.status !== 'completed' || !r.completed_date) continue
    const sections = r.workouts?.sections
    // La corsa non ha movimenti nominati: le sue fasi sono passo e distanza.
    if (categoriaDi(sections) === 'Running') continue

    const vistiQui = new Set()
    for (const blocco of getNormalizedBlocks({ sections })) {
      const giri = giriBlocco(blocco)
      for (const ex of blocco.exercises || []) {
        const nome = String(ex?.name || '').trim()
        if (!nome || nome === 'Rest') continue

        const voce = mappa.get(nome) || {
          nome, sedute: 0, reps: 0, metri: 0,
          kgUltimo: null, kgMassimo: null, ultima: null,
        }
        if (!vistiQui.has(nome)) { voce.sedute++; vistiQui.add(nome) }

        const reps = numero(ex.reps)
        if (reps) voce.reps += reps * giri
        const metri = metriDi(ex.meters)
        if (metri) voce.metri += metri * giri

        const kg = numero(ex.kg)
        if (kg) {
          voce.kgMassimo = voce.kgMassimo == null ? kg : Math.max(voce.kgMassimo, kg)
          // «Ultimo» è quello della seduta più recente, non l'ultimo incontrato
          // nel ciclo: le righe non arrivano in ordine di data.
          if (!voce.ultima || r.completed_date >= voce.ultima) voce.kgUltimo = kg
        }
        if (!voce.ultima || r.completed_date > voce.ultima) voce.ultima = r.completed_date

        mappa.set(nome, voce)
      }
    }
  }

  return [...mappa.values()]
    .map(v => ({
      ...v,
      reps: Math.round(v.reps),
      metri: Math.round(v.metri),
      giorniDa: differenceInCalendarDays(riferimento, parseISO(v.ultima)),
      ultimaEtichetta: format(parseISO(v.ultima), 'd MMM', { locale: it }),
    }))
    .sort((a, b) => b.sedute - a.sedute || a.giorniDa - b.giorniDa || a.nome.localeCompare(b.nome))
}

/** I movimenti che non tocca da `GIORNI_TRASCURATO` giorni o più. */
export const movimentiTrascurati = (movimenti = [], soglia = GIORNI_TRASCURATO) =>
  movimenti.filter(m => m.giorniDa >= soglia).sort((a, b) => b.giorniDa - a.giorniDa)

/**
 * Le `SETTIMANE_CONFRONTO` settimane che finiscono con quella scelta.
 *
 * ⚠️ L'aderenza di ogni settimana si misura sulla sua parte TRASCORSA, come nel
 * report squadra: senza, la settimana in corso comparirebbe sempre come la
 * peggiore delle cinque, e il grafico direbbe «in calo» ogni lunedì.
 */
export function settimaneConfronto(righe = [], settimana, oggi = new Date()) {
  const oggiStr = format(oggi, 'yyyy-MM-dd')
  const settimane = []

  for (let i = SETTIMANE_CONFRONTO - 1; i >= 0; i--) {
    const da = format(new Date(settimana.inizio.getTime() - i * 7 * 86400000), 'yyyy-MM-dd')
    const a = format(new Date(settimana.inizio.getTime() - (i * 7 - 6) * 86400000), 'yyyy-MM-dd')
    const fino = a <= oggiStr ? a : (da <= oggiStr ? oggiStr : null)

    const dentro = righe.filter(r => r?.completed_date >= da && r.completed_date <= a)
    const trascorse = parteTrascorsa(dentro, { fino, oggi: oggiStr })
    const chiuse = trascorse.filter(r => r.status === 'completed')
    const carico = caricoDi(chiuse)

    settimane.push({
      da,
      a,
      breve: `S${getISOWeek(parseISO(da))}`,
      corrente: i === 0,
      assegnati: trascorse.length,
      completati: chiuse.length,
      percentuale: trascorse.length ? Math.round((chiuse.length / trascorse.length) * 100) : 0,
      minuti: carico.minuti,
      // ⚠️ `punti` e `misurate` con questi nomi, non «carico»: sono i due campi
      // che `rapportoCarico` legge. Rinominarli non dà nessun errore — il
      // rapporto torna semplicemente `null` per sempre, cioè la colonna del
      // carico sparisce dalla pagina senza che niente lo segnali.
      punti: carico.punti,
      misurate: carico.misurate,
      caricoParziale: carico.parziale,
      rpeMedio: carico.rpeMedio,
    })
  }
  return settimane
}

/**
 * Quanto il volume andrebbe spostato per riportare il carico sulla sua media.
 *
 * Torna `null` quando non c'è un rapporto su cui basarsi: una percentuale
 * inventata è la cosa peggiore che questa pagina possa stampare, perché è
 * esattamente ciò su cui il coach agirebbe.
 */
export function correzioneVolume(acwr) {
  if (acwr == null || acwr <= 0) return null
  if (acwr > ACWR_ALTO) return -Math.round((1 - 1 / acwr) * 100)
  if (acwr < ACWR_BASSO) return Math.min(AUMENTO_MASSIMO, Math.round((1 / acwr - 1) * 100))
  return 0
}

const conSegno = (n) => `${n > 0 ? '+' : ''}${decimale(n)}`

/**
 * Cosa fare la settimana prossima, con accanto il numero da cui esce.
 *
 * 🔴 Ogni proposta porta il proprio motivo, e il motivo è sempre un dato della
 * pagina. È la condizione che rende una proposta rifiutabile: un consiglio che
 * non si può verificare non si discute, si subisce — e la prima volta che
 * sbaglia si smette di leggerlo. Per la stessa ragione una proposta senza
 * numero non si scrive affatto: dove il dato manca, la voce sparisce.
 */
export function proposteDi({ misure, carico, movimenti = [], settimana, prossimaVuota, senzaProgramma }) {
  const voci = []

  if (misure.fermo) {
    voci.push({
      chiave: 'fermo',
      titolo: 'Sentilo prima di programmare',
      motivo: misure.fermo.oltre
        ? 'Non chiude un allenamento da tutto il periodo caricato: una settimana nuova, senza una parola, resta lì com\'è.'
        : `Nessun allenamento chiuso da ${misure.fermo.giorni} giorni.`,
      tono: 'allarme',
    })
  }

  if (prossimaVuota) {
    voci.push({
      chiave: 'vuota',
      titolo: 'Non ha ancora niente per la settimana prossima',
      motivo: `Zero allenamenti assegnati dal ${senzaProgramma}.`,
      tono: 'allarme',
    })
  }

  const correzione = correzioneVolume(misure.acwr)
  if (correzione != null && correzione < 0) {
    voci.push({
      chiave: 'scarica',
      titolo: `Togli circa il ${Math.abs(correzione)}% di volume`,
      motivo: `Il carico è a ${decimale(misure.acwr)}× la sua media di ${SETTIMANE_CRONICO} settimane `
        + `(${carico.punti} punti contro ${Math.round(carico.punti / misure.acwr)}).`,
      tono: 'allarme',
    })
  } else if (correzione != null && correzione > 0 && misure.percentuale >= ADERENZA_ALTA) {
    voci.push({
      chiave: 'carica',
      titolo: `Puoi aggiungere fino al ${correzione}% di volume`,
      motivo: `Il carico è a ${decimale(misure.acwr)}× la sua media e la settimana l'ha seguita `
        + `(${misure.percentuale}%). Oltre il ${AUMENTO_MASSIMO}% in una settimana non si sale comunque.`,
      tono: 'buono',
    })
  }

  if (misure.scartoRpe != null && misure.scartoRpe >= SCARTO_RPE) {
    voci.push({
      chiave: 'piuLeggero',
      titolo: 'Scrivilo più leggero di quanto pensi',
      motivo: `Ha percepito ${conSegno(misure.scartoRpe)} rispetto all'intensità che avevi dichiarato, `
        + `su ${misure.sessioniScarto} sedute.`,
      tono: 'attenzione',
    })
  } else if (misure.scartoRpe != null && misure.scartoRpe <= -SCARTO_RPE) {
    voci.push({
      chiave: 'piuDuro',
      titolo: 'Puoi alzare l\'intensità',
      motivo: `Ha percepito ${conSegno(misure.scartoRpe)} rispetto al previsto su ${misure.sessioniScarto} sedute: `
        + 'quello che gli hai scritto gli sta risultando più facile.',
      tono: 'buono',
    })
  }

  if (misure.assegnati >= 2 && misure.percentuale < ADERENZA_BASSA) {
    voci.push({
      chiave: 'meno',
      titolo: 'Assegna meno sedute',
      motivo: `Ne ha chiuse ${misure.completati} su ${misure.assegnati}: una settimana da ${misure.assegnati} `
        + 'non la sta reggendo, e la prossima uguale non cambierà niente.',
      tono: 'attenzione',
    })
  }

  const trascurati = movimentiTrascurati(movimenti).slice(0, 3)
  if (trascurati.length > 0) {
    const nomi = trascurati.map(m => m.nome)
    voci.push({
      chiave: 'trascurati',
      titolo: `Rimetti ${nomi.slice(0, 2).join(' e ')}${nomi.length > 2 ? ` (e ${nomi.length - 2} altri)` : ''}`,
      motivo: `Ultima volta ${trascurati[0].ultimaEtichetta}: ${Math.floor(trascurati[0].giorniDa / 7)} settimane fa.`,
      tono: 'attenzione',
    })
  }

  // Senza RPE non esiste il carico, quindi non esiste nessuna delle proposte
  // sopra: è la prima cosa da rimettere a posto, non un dettaglio.
  if (carico.sessioni > 0 && carico.senzaRpe / carico.sessioni > QUOTA_SENZA_RPE) {
    voci.push({
      chiave: 'rpe',
      titolo: 'Chiedigli di segnare l\'RPE',
      motivo: `${carico.senzaRpe} sedute su ${carico.sessioni} chiuse senza: senza quel numero il carico `
        + 'non si può misurare, e questa pagina non ha di che ragionare.',
      tono: 'attenzione',
    })
  }

  if (voci.length === 0) {
    voci.push({
      chiave: 'ripeti',
      titolo: 'Ripeti la struttura di questa settimana',
      motivo: misure.acwr != null
        ? `Aderenza ${misure.percentuale}%, carico a ${decimale(misure.acwr)}× la sua media: è la settimana che funziona.`
        : `Aderenza ${misure.percentuale}%, nessuno scostamento da correggere.`,
      tono: 'buono',
    })
  }

  return { voci, settimana: settimana.etichetta }
}

/**
 * Tutto il report di un atleta, da una lista sola delle SUE assegnazioni.
 *
 * @param righe   righe di `athlete_workouts` del solo atleta, con `workouts.sections`
 * @param oggi    iniettabile, così i test non dipendono dal calendario
 * @param scarto  0 = questa settimana, −1 = la scorsa
 */
export function reportAtleta(righe = [], { oggi = new Date(), scarto = 0 } = {}) {
  const settimana = settimanaReport(oggi, scarto)
  const sue = righe.filter(r => r?.completed_date)

  const nellaSettimana = sue.filter(r => r.completed_date >= settimana.da && r.completed_date <= settimana.a)
  const trascorse = parteTrascorsa(nellaSettimana, settimana)
  const chiuse = trascorse.filter(r => r.status === 'completed')
  const carico = caricoDi(chiuse)

  const settimane = settimaneConfronto(sue, settimana, oggi)
  const acwr = rapportoCarico(carico.punti, settimane.slice(-SETTIMANE_CRONICO))
  const scartoRpe = scartoRpeDi(chiuse)

  // Da quanti giorni non chiude un allenamento, alla data di riferimento della
  // settimana che si sta guardando — non a oggi: su una settimana passata il
  // report deve essere la fotografia di allora, o non si può usare per capire
  // cos'era successo.
  const riferimento = settimana.fino || settimana.da
  let ultimo = null
  for (const r of sue) {
    if (r.status !== 'completed' || r.completed_date > riferimento) continue
    if (!ultimo || r.completed_date > ultimo) ultimo = r.completed_date
  }
  const giorniFermo = ultimo ? differenceInCalendarDays(parseISO(riferimento), parseISO(ultimo)) : null
  const fermo = (!ultimo || giorniFermo >= GIORNI_FERMO)
    ? { giorni: giorniFermo, oltre: !ultimo, ultimo }
    : null

  const misure = {
    assegnati: trascorse.length,
    completati: chiuse.length,
    daVenire: nellaSettimana.length - trascorse.length,
    percentuale: trascorse.length ? Math.round((chiuse.length / trascorse.length) * 100) : 0,
    acwr,
    scartoRpe: scartoRpe.valore,
    sessioniScarto: scartoRpe.sessioni,
    fermo,
  }
  const { verdetto, motivo } = verdettoAtleta(misure)

  const prossimaDa = format(new Date(settimana.fine.getTime() + 86400000), 'yyyy-MM-dd')
  const prossimaA = format(new Date(settimana.fine.getTime() + 7 * 86400000), 'yyyy-MM-dd')
  const prossima = sue.filter(r => r.completed_date >= prossimaDa && r.completed_date <= prossimaA)

  const movimenti = movimentiDi(sue, { fino: riferimento })
  const precedente = settimane.at(-2)

  return {
    settimana,
    verdetto,
    motivo,
    misure,
    carico: {
      ...carico,
      acwr,
      // In MINUTI e non in percentuale: «+50 min» si confronta con la propria
      // settimana, «+24%» va prima ritradotto in minuti per farci qualcosa.
      deltaMinuti: precedente ? carico.minuti - precedente.minuti : null,
    },
    settimane,
    sessioni: sessioniDi(sue, settimana),
    movimenti,
    trascurati: movimentiTrascurati(movimenti),
    // ⚠️ Quante sedute di corsa il conteggio dei movimenti ha dovuto saltare:
    // le fasi di corsa non hanno movimenti nominati, e un elenco che tace su
    // tre sedute su cinque si legge come «ha fatto poco».
    corseEscluse: chiuse.filter(r => categoriaDi(r.workouts?.sections) === 'Running').length,
    prossima: {
      da: prossimaDa,
      quante: prossima.length,
      // Programmare una settimana già passata non è un'azione.
      utile: prossimaA >= format(oggi, 'yyyy-MM-dd'),
    },
    proposte: proposteDi({
      misure,
      carico,
      movimenti,
      settimana,
      prossimaVuota: prossima.length === 0 && prossimaA >= format(oggi, 'yyyy-MM-dd'),
      senzaProgramma: format(parseISO(prossimaDa), 'd MMM', { locale: it }),
    }),
  }
}
