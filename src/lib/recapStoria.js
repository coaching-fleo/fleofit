// recapStoria.js — che cosa dice di sé un allenamento fatto, quando l'atleta
// lo mette sopra una storia.
//
// La forma è quella di Strava: qualcosa di grande e riconoscibile in cima, e
// sotto pochi numeri molto grandi. Dove Strava disegna il percorso, qui c'è
// **l'elenco di quello che si è fatto** — i blocchi con dentro i loro
// esercizi. È una decisione del committente, presa guardando la prima
// versione: quella disegnava un profilo di sforzo (un tratto per esercizio,
// alto quanto duro), era gradevole e **non si leggeva**. Una sagoma dice «è
// stata dura verso la fine»; l'elenco dice *che cosa hai fatto*, ed è la sola
// cosa che qualcuno voglia davvero sapere guardando la storia di qualcun altro.
//
// ⚠️ Il vincolo che governa ogni scelta qui dentro: **l'immagine verrà guardata
// piccola.** Quindi poche righe e corpo grande, non tutte le righe e corpo
// piccolo. Da qui `MASSIMO_RIGHE` e il «+N esercizi» che chiude l'elenco
// quando non ci sta: una lista troncata che lo dichiara è leggibile, una lista
// intera in corpo 9 non lo è.
//
// 🔴 La regola che governa i numeri: **niente valori inventati.**
// La durata è una STIMA (src/lib/stimaWorkout.js) e lo deve dire; l'RPE è
// quello che l'atleta ha DICHIARATO e se non l'ha dichiarato la cella non
// esiste. Una grafica esce dall'app e finisce sotto gli occhi di terzi: è
// l'ultimo posto in cui un ripiego travestito da misura può passare
// inosservato.
//
// Questo file è LOGICA PURA. Colori, dimensioni e font stanno in
// src/components/StoriaUI.jsx: qui non si decide come appare niente.

import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { categoriaDi, corsia } from './categorie'
import { dataValida, riepilogoCorsa } from './rigaArchivio'
import { getNormalizedBlocks } from './timerSequence'
import { parametriBlocco, specificheEsercizio } from './rigaBlocco'
import { ERGOMETERS } from './constants'
import { riepilogoWorkout, minutiStimati, decimale } from './stimaWorkout'

/**
 * Quante righe l'elenco può occupare prima di dover dire «e altri N».
 *
 * ⚠️ È una misura, non un gusto: è quanto entra sopra le celle dei numeri
 * mantenendo il corpo a cui un esercizio si legge ancora quando la storia è
 * vista in piccolo. Alzarlo senza rimpicciolire il testo fa uscire l'elenco
 * dal riquadro; alzarlo rimpicciolendo il testo disfa il motivo per cui
 * l'elenco esiste.
 */
export const MASSIMO_RIGHE = 12

/** Quante righe di note stanno in un allenamento libero, che non ha esercizi. */
export const MASSIMO_RIGHE_NOTA = 5

const isErgo = (nome) => ERGOMETERS.includes(nome)

/** Un valore assente o azzerato dal picker: «-» è il modo in cui si cancella. */
const pieno = (v) => v != null && String(v).trim() !== '' && v !== '-'

const ETICHETTA_FASE = {
  warmup: 'Riscaldamento',
  run: 'Corsa',
  recover: 'Recupero',
  cooldown: 'Defaticamento',
}

/**
 * Blocchi ed esercizi in gruppi, prima di sapere quanti ce ne stanno.
 *
 * ⚠️ Il dettaglio dell'intestazione viene da `parametriBlocco`, non da una
 * formula scritta qui: i ripieghi di un blocco mai aperto (10 giri per un
 * EMOM, 3 per un For Time) vivono in un punto solo, insieme a quelli con cui
 * `durataBlocco` stima la durata che finisce nella cella accanto.
 */
const gruppiBlocchi = (blocchi = []) => blocchi.map(b => ({
  intestazione: {
    genere: 'blocco',
    // Il tipo si scrive come lo scrive la scheda («Cash In», «WarmUp»): un
    // secondo vocabolario per le stesse cose è il modo in cui l'atleta non
    // riconosce più quello che ha appena letto nell'app.
    titolo: b?.type || 'Blocco',
    dettaglio: parametriBlocco(b) || '',
  },
  esercizi: (b?.exercises || []).map(ex => ({
    genere: 'esercizio',
    nome: pieno(ex?.name) ? ex.name : 'Esercizio',
    specifiche: specificheEsercizio(ex, isErgo),
  })),
}))

/**
 * Le fasi di una corsa, con la stessa struttura dei blocchi.
 *
 * Una fase semplice è una riga sola e non ha bisogno di un'intestazione: il
 * suo nome («Riscaldamento») è già la riga. Una ripetuta invece è un gruppo —
 * l'intestazione dice quanti giri, sotto ci sono corsa e recupero — ed è
 * l'unico punto della corsa in cui c'è davvero una gerarchia.
 */
const gruppiCorsa = (steps = []) => steps.map(step => {
  const misura = (durata, passo) => [durata, pieno(passo) && passo !== 'Libero' ? passo : '']
    .filter(pieno).join(' · ')

  if (step?.type === 'repeat') {
    const giri = parseInt(step?.rounds, 10)
    const volte = Number.isFinite(giri) && giri > 0 ? giri : 1
    return {
      intestazione: { genere: 'blocco', titolo: 'Ripetute', dettaglio: `${volte}×` },
      esercizi: [
        { genere: 'esercizio', nome: 'Corsa', specifiche: misura(step?.runDuration, step?.runPace) },
        { genere: 'esercizio', nome: 'Recupero', specifiche: misura(step?.recDuration, step?.recPace) },
      ],
    }
  }
  return {
    intestazione: null,
    esercizi: [{
      genere: 'esercizio',
      nome: ETICHETTA_FASE[step?.type] || 'Corsa',
      specifiche: misura(step?.duration, step?.pace),
    }],
  }
})

/**
 * I gruppi appiattiti in righe, entro il budget.
 *
 * ⚠️ Un'intestazione **orfana** non deve mai chiudere l'elenco: «EMOM · ogni
 * 1:00 × 24» seguito da niente promette un contenuto che è stato tagliato, ed
 * è peggio che non nominare affatto quel blocco.
 *
 * ⚠️ Il «+N» conta gli **esercizi** rimasti fuori, non le righe: le
 * intestazioni non sono cose che si fanno, e sommarle darebbe un numero che
 * non corrisponde a niente di contabile nella scheda.
 */
const impagina = (gruppi, massimo = MASSIMO_RIGHE) => {
  const tutte = []
  for (const g of gruppi) {
    if (g.intestazione) tutte.push(g.intestazione)
    tutte.push(...g.esercizi)
  }
  if (tutte.length <= massimo) return tutte

  const totale = tutte.filter(r => r.genere === 'esercizio').length
  const tenute = tutte.slice(0, massimo - 1)
  while (tenute.length > 0 && tenute[tenute.length - 1].genere === 'blocco') tenute.pop()

  const esclusi = totale - tenute.filter(r => r.genere === 'esercizio').length
  if (esclusi <= 0) return tenute
  return [...tenute, {
    genere: 'altri',
    testo: `+${esclusi} ${esclusi === 1 ? 'esercizio' : 'esercizi'}`,
  }]
}

/** Le prime righe di un testo libero, senza righe vuote in mezzo. */
const righeNota = (testo) => String(testo || '')
  .split('\n').map(r => r.trim()).filter(Boolean)
  .slice(0, MASSIMO_RIGHE_NOTA)
  .map(r => ({ genere: 'testo', testo: r }))

/**
 * Che cosa si è fatto, riga per riga.
 *
 * Torna un array **vuoto** quando non c'è niente da elencare (una gara, un
 * allenamento libero senza note): il chiamante deve poter togliere l'intero
 * blocco invece di disegnare una cornice attorno al nulla.
 *
 * ⚠️ Su un allenamento libero si legge **`coach_notes`, mai la nota
 * dell'atleta**. La prima è il contenuto dell'allenamento; la seconda è il
 * riscontro che l'atleta ha lasciato al coach, e può contenere qualunque cosa:
 * pubblicarla su una storia — magari esportata dal coach, dalla scheda di
 * qualcun altro — non è una decisione che spetta a questa funzione.
 */
export const righeAllenamento = (workout) => {
  const sections = workout?.sections || {}
  const categoria = categoriaDi(sections)

  if (categoria === 'Event') return []
  if (categoria === 'Custom') return righeNota(workout?.coach_notes)
  if (categoria === 'Running') return impagina(gruppiCorsa(sections.steps || []))
  return impagina(gruppiBlocchi(getNormalizedBlocks(workout || {})))
}

// I chilometri come si scrivono in italiano, senza l'unità: la cella la mostra
// a parte, più piccola.
const chilometri = (metri) => {
  const km = metri / 1000
  return decimale(km >= 10 ? Math.round(km) : Math.round(km * 10) / 10)
}

const intensitaDichiarata = (v) => {
  const n = parseInt(v, 10)
  return Number.isFinite(n) && n >= 1 && n <= 10 ? n : null
}

/**
 * Le celle grandi sotto l'elenco: al massimo tre, e mai una vuota.
 *
 * 🔴 `≈` davanti alla durata non è un vezzo. È la stessa stima del riepilogo
 * del builder e della scheda: il timer sa quanto dura un EMOM, ma «For Time» e
 * «Cash In» sono cronometri liberi e lì il tempo lo fa l'atleta. Su una story
 * quel numero viene letto come un cronometro, quindi il segno che dice «circa»
 * è l'unica cosa che lo separa da una bugia.
 *
 * 🔴 L'RPE è quello DICHIARATO. Se manca, la cella non ripiega su 5 né sull'RPE
 * atteso: passa all'intensità che il coach ha scritto, che è comunque un valore
 * dichiarato da qualcuno, sotto la sua etichetta. Se manca anche quella, le
 * celle diventano due.
 */
export const celleStoria = (workout, { rpe = null } = {}) => {
  const sections = workout?.sections || {}
  const categoria = categoriaDi(sections)
  const celle = []

  if (categoria === 'Running') {
    const r = riepilogoCorsa(sections.steps || [])
    if (r.puroDistanza && r.metri > 0) {
      celle.push({ chiave: 'distanza', valore: chilometri(r.metri), unita: 'km', etichetta: 'Distanza' })
    } else if (r.puroTempo && r.minuti > 0) {
      celle.push({ chiave: 'durata', valore: String(Math.round(r.minuti)), unita: 'min', etichetta: 'Durata' })
    }
    if (r.fasi > 0) celle.push({ chiave: 'fasi', valore: String(r.fasi), etichetta: r.fasi === 1 ? 'Fase' : 'Fasi' })
  } else if (categoria !== 'Custom' && categoria !== 'Event') {
    const blocchi = getNormalizedBlocks(workout || {})
    if (blocchi.length > 0) {
      const minuti = minutiStimati(riepilogoWorkout(blocchi).secondi)
      if (minuti > 0) celle.push({ chiave: 'durata', valore: String(minuti), unita: 'min', circa: true, etichetta: 'Durata' })
      celle.push({ chiave: 'blocchi', valore: String(blocchi.length), etichetta: blocchi.length === 1 ? 'Blocco' : 'Blocchi' })
    }
  }

  const dichiarato = Number.isFinite(rpe) ? rpe : null
  const intensita = intensitaDichiarata(sections.intensity)
  if (dichiarato !== null) {
    celle.push({ chiave: 'rpe', valore: String(dichiarato), unita: '/10', etichetta: 'RPE' })
  } else if (intensita !== null) {
    celle.push({ chiave: 'intensita', valore: String(intensita), unita: '/10', etichetta: 'Intensità' })
  }

  return celle.slice(0, 3)
}

/**
 * Tutto quello che la grafica deve mostrare, in un oggetto solo.
 *
 * `data` arriva dal chiamante e non si legge da `workout.date` e basta: per
 * l'atleta la scheda porta già `completed_date` in quel campo, ma per il coach
 * che condivide la scheda di qualcun altro no — e la data di un recap è il
 * giorno in cui l'allenamento è stato FATTO, non quello in cui era in
 * programma.
 */
export const recapStoria = (workout, { rpe = null, fatto = false, data = null } = {}) => {
  const categoria = categoriaDi(workout?.sections)
  const giorno = dataValida(data) || dataValida(workout?.date)

  return {
    categoria,
    etichettaCategoria: corsia(categoria).etichetta,
    // ⚠️ `title` può essere `null` sui workout anteriori al titolo automatico
    // del 24/08/2026 (CLAUDE.md §5), e una grafica con un buco al posto del
    // titolo è peggio di una che dice che il titolo non c'è.
    titolo: (workout?.title || '').trim() || 'Senza titolo',
    data: giorno ? format(giorno, 'd MMMM yyyy', { locale: it }) : '',
    // ⚠️ Il giorno abbreviato: «domenica 30 ago» occupava mezza riga
    // dell'occhiello e rimandava a capo la corsia. Il giorno della settimana
    // serve a collocare l'allenamento, non a essere letto per intero.
    giornoBreve: giorno ? format(giorno, 'EEE d MMM', { locale: it }) : '',
    fatto: !!fatto,
    celle: celleStoria(workout, { rpe }),
    righe: righeAllenamento(workout),
  }
}
