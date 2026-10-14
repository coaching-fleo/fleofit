// La pagina Analisi della versione desktop (docs/superpowers/plans/
// 2026-10-13-desktop-analisi-e-confronto.md): come sta andando la squadra su
// un periodo di settimane, invece della sola settimana del report.
//
// Funzioni PURE su array già caricati, come `reportSettimanale.js`: nessun
// fetch, nessuna data implicita. Chi calcola qui non disegna.
//
// 🔴 Un numero che compare anche nel Report deve essere LO STESSO numero. Per
// questo qui non si ricalcola niente che esista già: la settimana viene da
// `settimanaReport`, la parte trascorsa da `parteTrascorsa`, il carico da
// `caricoDi`, l'ACWR da `rapportoCarico` + `storicoCronico`. Una seconda copia
// di una di queste formule darebbe due numeri diversi per la stessa settimana,
// e nessuno dei due sarebbe sbagliato preso da solo.
//
// ⚠️ Le tre regole del report valgono anche qui: aderenza sulla parte
// trascorsa, RPE solo dichiarato, nessun numero inventato (`null` → «—»).
// In più, due stati che il report non conosce perché guarda una settimana sola:
//  · `prima` — le settimane prima della prima assegnazione di un atleta. Senza,
//    chi è arrivato a metà periodo avrebbe settimane «vuote» che sembrano
//    settimane saltate;
//  · `pausa` — le settimane dal giorno della pausa in poi. Il marcatore dice
//    solo QUANDO è cominciata la pausa in corso: le pause già finite non
//    lasciano traccia nel dato, quindi non si possono escludere.

import { subWeeks } from 'date-fns'
import { durataWorkout } from './statistiche'
import { categoriaDi } from './categorie'
import { parseNotePausa } from './pausa'
import { gradimentoDi } from './gradimento'
import { scarto } from './andamento'
import { ultimoAllenamento } from './tabellaAtleti'
import {
  settimanaReport, parteTrascorsa, caricoDi, rapportoCarico, storicoCronico, scartoRpeDi,
} from './reportSettimanale'

/** I periodi che la pagina offre, in settimane. */
export const PERIODI = [4, 8, 12, 26]
export const PERIODO_PREDEFINITO = 8

/** Le categorie che si possono filtrare. «Event» non è un allenamento. */
export const CATEGORIE_ANALISI = ['Hyrox', 'Running', 'Gym', 'Custom']

const nomeAtleta = (a) => [a?.name, a?.surname].filter(Boolean).join(' ').trim() || 'Atleta'

/**
 * Le `quante` settimane che finiscono con quella in corso, lunedì→domenica.
 * Ognuna è un `settimanaReport` con in più `chiave` (il lunedì, 'yyyy-MM-dd').
 */
export function settimaneDelPeriodo(quante = PERIODO_PREDEFINITO, oggi = new Date()) {
  const settimane = []
  for (let i = quante - 1; i >= 0; i--) {
    const s = settimanaReport(oggi, -i)
    settimane.push({ ...s, chiave: s.da })
  }
  return settimane
}

/**
 * Il periodo precedente della stessa lunghezza, che finisce lo STESSO giorno
 * della settimana di oggi. ⚠️ È ciò che rende onesto il confronto: con un
 * periodo che finisce di mercoledì, anche quello di prima si ferma a un
 * mercoledì — altrimenti tre giorni si confronterebbero con sette.
 */
export const periodoPrecedente = (quante = PERIODO_PREDEFINITO, oggi = new Date()) =>
  settimaneDelPeriodo(quante, subWeeks(oggi, quante))

/**
 * Le righe di un atleta e/o di una categoria. Senza filtri, tutte.
 *
 * ⚠️ `atleti` tiene solo le righe di chi si segue: la lettura porta anche le
 * sedute del coach e degli atleti cancellati (che restano fino al cron di
 * mezzanotte). I numeri che passano dalla griglia le scartano da soli, ma
 * minuti e gradimento leggono le righe dirette: senza questo filtro le barre
 * dei minuti sommerebbero più delle ore scritte sopra.
 */
export function filtraRighe(righe = [], { atletaId, categoria, atleti } = {}) {
  const seguiti = atleti ? new Set(atleti.map(a => a?.id)) : null
  return righe.filter(r =>
    (!seguiti || seguiti.has(r?.athlete_id)) &&
    (!atletaId || r?.athlete_id === atletaId) &&
    (!categoria || categoriaDi(r?.workouts?.sections) === categoria))
}

/** Vero se la settimana cade (anche in parte) nella pausa in corso dell'atleta. */
function settimanaInPausa(atleta, settimana) {
  const { inPausa, dal } = parseNotePausa(atleta?.notes)
  if (!inPausa) return false
  // Senza data la pausa non ha un inizio: vale per tutto il periodo, come nel
  // report, che esclude chi è in pausa e basta.
  return !dal || settimana.a >= dal
}

/** Le righe indicizzate per atleta, in una passata sola. */
function perAtleta(righe) {
  const mappa = new Map()
  for (const r of righe) {
    if (!r?.athlete_id || !r.completed_date) continue
    const lista = mappa.get(r.athlete_id)
    if (lista) lista.push(r)
    else mappa.set(r.athlete_id, [r])
  }
  return mappa
}

const nellaSettimana = (righe, s) => righe.filter(r => r.completed_date >= s.da && r.completed_date <= s.a)

/**
 * La settimana di un atleta: assegnate trascorse, completate, stato della cella.
 * È il mattone di tutte le funzioni qui sotto.
 */
function cellaDi(atleta, sue, settimana, primaData) {
  const trascorse = parteTrascorsa(nellaSettimana(sue, settimana), settimana)
  const chiuse = trascorse.filter(r => r.status === 'completed')
  let stato = 'ok'
  if (settimanaInPausa(atleta, settimana)) stato = 'pausa'
  else if (!primaData || settimana.a < primaData) stato = 'prima'
  else if (trascorse.length === 0) stato = 'vuota'
  const valore = stato === 'ok' ? Math.round((chiuse.length / trascorse.length) * 100) : null
  return { chiave: settimana.chiave, valore, stato, trascorse: trascorse.length, chiuse }
}

/** Tutte le celle di tutti gli atleti: la griglia da cui leggono le altre funzioni. */
function griglia(atleti, righe, settimane) {
  const indice = perAtleta(righe)
  return atleti.filter(a => a?.id).map(atleta => {
    const sue = indice.get(atleta.id) || []
    const primaData = sue.reduce((min, r) => (!min || r.completed_date < min ? r.completed_date : min), null)
    return { atleta, sue, celle: settimane.map(s => cellaDi(atleta, sue, s, primaData)) }
  })
}

/** Aderenza aggregata: completate / trascorse, contando solo le celle `ok`. */
function aderenzaDi(celle) {
  let trascorse = 0, chiuse = 0
  for (const c of celle) {
    if (c.stato !== 'ok') continue
    trascorse += c.trascorse
    chiuse += c.chiuse.length
  }
  return trascorse > 0 ? Math.round((chiuse / trascorse) * 100) : null
}

/** Le sedute completate di un insieme di celle, pausa compresa: sono state fatte. */
const completateDi = (celle) => celle.flatMap(c => c.chiuse)

/** Ore con un decimale, `null` se non c'è niente da sommare. */
const oreDi = (carico) => (carico.sessioni > 0 ? Math.round((carico.minuti / 60) * 10) / 10 : null)

/**
 * I cinque numeri in testa alla pagina.
 *
 * `attivi` = atleti con almeno una seduta chiusa nel periodo. ⚠️ Al posto degli
 * «atleti fermi» del piano: «fermo» è una fotografia di OGGI (la Home la dà
 * già), e su un periodo di otto settimane non ha un valore confrontabile con
 * quello del periodo prima.
 */
export function numeriPeriodo(atleti = [], righe = [], settimane = []) {
  const g = griglia(atleti, righe, settimane)
  const celle = g.flatMap(r => r.celle)
  const carico = caricoDi(completateDi(celle))
  return {
    sedute: carico.sessioni,
    aderenza: aderenzaDi(celle),
    ore: oreDi(carico),
    rpeMedio: carico.rpeMedio,
    attivi: g.filter(r => r.celle.some(c => c.chiuse.length > 0)).length,
    seguiti: g.length,
  }
}

/** Quali campi si confrontano in punti (differenza) invece che in percentuale. */
const IN_PUNTI = new Set(['aderenza', 'rpeMedio'])

/**
 * Ogni numero del periodo con lo scarto dal precedente.
 * `scarto` è `null` quando non si può dire (precedente vuoto o mancante):
 * «+∞%» non è un'informazione.
 */
export function confrontoPeriodi(corrente = {}, precedente = {}) {
  const esito = {}
  for (const [campo, valore] of Object.entries(corrente)) {
    const prima = precedente?.[campo]
    if (IN_PUNTI.has(campo)) {
      esito[campo] = {
        valore,
        scarto: valore == null || prima == null ? null : Math.round((valore - prima) * 10) / 10,
        unita: 'punti',
      }
    } else {
      esito[campo] = { valore, scarto: valore == null || prima == null ? null : scarto(valore, prima), unita: '%' }
    }
  }
  return esito
}

/** L'aderenza della squadra settimana per settimana. */
export function aderenzaPerSettimana(atleti = [], righe = [], settimane = []) {
  const g = griglia(atleti, righe, settimane)
  return settimane.map((s, i) => ({ chiave: s.chiave, valore: aderenzaDi(g.map(r => r.celle[i])) }))
}

/** La mappa atleti × settimane. */
export function mappaAderenza(atleti = [], righe = [], settimane = []) {
  return griglia(atleti, righe, settimane).map(({ atleta, celle }) => ({
    atleta: { id: atleta.id, nome: nomeAtleta(atleta) },
    celle: celle.map(({ chiave, valore, stato }) => ({ chiave, valore, stato })),
  }))
}

/**
 * I minuti completati per categoria, settimana per settimana.
 * ⚠️ Minuti e non carico (minuti × RPE): il carico esclude le sedute senza RPE
 * dichiarato, e una categoria in cui l'RPE si segna poco sembrerebbe vuota.
 */
export function caricoPerCategoria(righe = [], settimane = []) {
  return settimane.map(s => {
    const voce = { chiave: s.chiave, Hyrox: 0, Running: 0, Gym: 0, Custom: 0 }
    for (const r of nellaSettimana(righe, s)) {
      if (r.status !== 'completed' || (s.fino && r.completed_date > s.fino)) continue
      const cat = categoriaDi(r.workouts?.sections)
      if (cat in voce) voce[cat] += durataWorkout(r.workouts?.sections)
    }
    return voce
  })
}

/**
 * La quota di «mi è piaciuto» fra chi ha risposto, settimana per settimana.
 * «Nessuna preferenza» è una risposta e conta nel denominatore; chi non è mai
 * stato interpellato no (vedi `gradimento.js`).
 */
export function gradimentoPerSettimana(righe = [], settimane = []) {
  return settimane.map(s => {
    let si = 0, risposte = 0
    for (const r of nellaSettimana(righe, s)) {
      if (r.status !== 'completed' || (s.fino && r.completed_date > s.fino)) continue
      const g = gradimentoDi(r.notes)
      if (!g) continue
      risposte++
      if (g === 'si') si++
    }
    return { chiave: s.chiave, valore: risposte > 0 ? Math.round((si / risposte) * 100) : null }
  })
}

/**
 * Una riga per atleta, per la tabella ordinabile.
 *
 * 🔴 `acwr` è quello della settimana IN CORSO (l'ultima del periodo), calcolato
 * esattamente come in `reportSettimanale`: stesse sedute, stessa finestra
 * cronica. Un test lo confronta col report.
 */
export function tabellaAnalisi(atleti = [], righe = [], settimane = []) {
  const ultime = ultimoAllenamento(righe)
  const ultima = settimane[settimane.length - 1]
  return griglia(atleti, righe, settimane).map(({ atleta, sue, celle }) => {
    const completate = completateDi(celle)
    const carico = caricoDi(completate)
    let acwr = null
    if (ultima) {
      const chiuse = parteTrascorsa(nellaSettimana(sue, ultima), ultima).filter(r => r.status === 'completed')
      acwr = rapportoCarico(caricoDi(chiuse).punti, storicoCronico(sue, ultima.inizio))
    }
    return {
      id: atleta.id,
      nome: nomeAtleta(atleta),
      foto: atleta.photo_url || null,
      pausa: parseNotePausa(atleta.notes).inPausa,
      sedute: carico.sessioni,
      aderenza: aderenzaDi(celle),
      ore: oreDi(carico),
      rpeMedio: carico.rpeMedio,
      scartoRpe: scartoRpeDi(completate).valore,
      acwr,
      ultima: ultime.get(atleta.id) || null,
    }
  })
}
