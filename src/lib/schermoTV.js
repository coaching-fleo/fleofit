// Cosa mostra la TV (/tv) dal 26/11/2026: la LOCANDINA prima del via e il
// CAROSELLO quando il telefono fa partire il timer (prototipo in
// tools/design-tv/proposta-d.html, scelto dal committente).
//
// È SOLA LETTURA, come esercizioInCorso.js: legge il workout e lo step che il
// telefono manda nel `timer_state`, non tocca il timer e non conta il tempo.
// Tutto ciò che qui si decide — su quale carta siamo, quale riga è «adesso» e
// quale «poi», chi sta dove — sta qui e non nel componente, così si prova
// senza montare la pagina.

import { ERGOMETERS } from './constants'
import { etichetteStazioni } from './stazioniEmom'
import { haIncremento, testoAumento, giriForTime } from './incremento'
import { durataBlocco, mmss, BLOCCHI_DI_LAVORO } from './stimaWorkout'
import { specificheEsercizio } from './rigaBlocco'
import { blockHint } from './blockHints'
import { partiRipetuta, etichettaParte } from './ripetute'
import { gruppiInOrdine, tipoGruppo, NOME_TIPO_GRUPPO, serieDi, riassuntoEsercizio, FASI_GYM, faseDi } from './gym'
import { pausePrima } from './timerSequence'
import { esercizioInCorso, esercizioInArrivo } from './esercizioInCorso'
import { bloccoAScaglioni, personePerEsercizio } from './personeTV'

import { BRAND, RUNNING, CUSTOM } from './colori'

/** Il verde del riposo e della pausa sulla TV (lo stesso `text-green-400` del telefono). */
export const VERDE_TV = '#4ade80'

const isErgo = (name) => ERGOMETERS.includes(name)
const pieno = (v) => v != null && v !== '' && v !== '-'
const intero = (v, ripiego) => {
  const n = parseInt(v, 10)
  return Number.isFinite(n) && n > 0 ? n : ripiego
}

// ── I giri: la linguetta «4x» della cartellina ───────────────────────────

/**
 * Quanti giri ha un blocco, se più di uno: è il numero della linguetta.
 * L'EMOM no: i suoi minuti sono già le righe numerate.
 */
export const giriTV = (block) => {
  const p = block?.params || {}
  let n
  switch (block?.type) {
    case 'ON/OFF': n = intero(p.rounds, 10); break
    case 'Interval':
    case 'Cash In':
    case 'Cash Out': n = intero(p.rounds, 1); break
    case 'For Time': n = pieno(p.timecap) ? giriForTime(block) : intero(p.rounds, 1); break
    default: n = null
  }
  return n > 1 ? n : null
}

/**
 * Il giro in corso, letto dall'id dello step (`blk-<blocco>-<giro>…`), solo
 * dove l'id lo porta: ON/OFF, Interval e i For Time vecchi a round. Altrove
 * (Cash In/Out sono un cronometro solo, il For Time a time cap una fase sola)
 * la linguetta resta «4x».
 */
export const giroInCorso = (block, stepId) => {
  if (!block || typeof stepId !== 'string') return null
  const tipo = block.type
  const aRound = tipo === 'ON/OFF' || tipo === 'Interval' || (tipo === 'For Time' && !pieno(block.params?.timecap))
  if (!aRound) return null
  const parti = stepId.split('-')
  if (parti[0] !== 'blk') return null
  const g = parseInt(parti[2], 10)
  return Number.isFinite(g) && g > 0 ? g : null
}

// ── La locandina: il workout intero, prima del via ───────────────────────

/** I parametri di un blocco senza i giri (stanno sulla linguetta). */
const parametriTV = (b) => {
  const p = b.params || {}
  switch (b.type) {
    case 'EMOM': return `ogni ${p.interval || '1:00'} × ${intero(p.rounds, 10)}`
    case 'ON/OFF': return `${p.on || '1:00'} lavoro · ${p.off || '1:00'} riposo`
    case 'AMRAP': return haIncremento(b) ? 'con incremento' : ''
    case 'For Time': return pieno(p.timecap) ? `time cap ${p.timecap}${haIncremento(b) ? ' · con incremento' : ''}` : ''
    case 'Cash In':
    case 'Cash Out': return intero(p.rounds, 1) > 1 && pieno(p.rest) ? `${p.rest} di riposo fra i giri` : ''
    default: return ''
  }
}

const durataTesto = (secondi) => {
  const d = mmss(secondi)
  return d !== '0:00' ? d : null
}

/** Le righe di un blocco Hyrox: numero (minuto dell'EMOM, posto dell'ON/OFF), nome, specifiche, intensità. */
export const righeBlocco = (b) => {
  const esercizi = b?.exercises || []
  const numerato = b?.type === 'EMOM' || b?.type === 'ON/OFF'
  const etichette = numerato ? etichetteStazioni(esercizi, b.type) : []
  return esercizi.map((ex, i) => ({
    id: ex.id ?? i,
    numero: numerato ? etichette[i] : null,
    nome: ex.name || 'Esercizio',
    specifiche: [specificheEsercizio(ex, isErgo), haIncremento(b) ? testoAumento(ex) : ''].filter(Boolean).join(' · '),
    intensita: pieno(ex.intensity) ? ex.intensity : null,
  }))
}

/** Un blocco Hyrox come voce della locandina e come carta del carosello. */
export const voceBlocco = (b, k) => ({
  id: b.id ?? k,
  numero: k + 1,
  titolo: b.type,
  hint: parametriTV(b) || blockHint(b.type),
  giri: giriTV(b),
  durata: durataTesto(durataBlocco(b)),
  lavoro: BLOCCHI_DI_LAVORO.has(b.type),
  righe: righeBlocco(b),
  nota: (b.type === 'WarmUp' || b.type === 'Rest') && pieno(b.notes) ? b.notes : null,
})

const PASSI_CORSA = {
  warmup: 'Riscaldamento', run: 'Corsa', recover: 'Recupero', cooldown: 'Defaticamento', repeat: 'Ripetute',
}

/** Un passo di corsa come voce: le ripetute con la linguetta «6x» e le loro parti come righe. */
const voceCorsa = (step, k) => {
  const ripetuta = step.type === 'repeat'
  return {
    id: step.id ?? k,
    numero: k + 1,
    titolo: PASSI_CORSA[step.type] || 'Corsa',
    hint: '',
    giri: ripetuta && intero(step.rounds, 1) > 1 ? intero(step.rounds, 1) : null,
    durata: null,
    lavoro: step.type === 'run' || ripetuta,
    righe: ripetuta
      ? partiRipetuta(step).map(p => ({
          id: p.id, numero: null, nome: `${etichettaParte(p)} ${p.duration || ''}`.trim(),
          specifiche: pieno(p.pace) ? `@${p.pace}` : '', intensita: pieno(p.intensity) ? p.intensity : null,
        }))
      : [{ id: 'unico', numero: null, nome: step.duration || '', specifiche: pieno(step.pace) ? `@${step.pace}` : '', intensita: pieno(step.intensity) ? step.intensity : null }],
    nota: pieno(step.notes) ? step.notes : null,
  }
}

const NOMI_FASI_GYM = Object.fromEntries(FASI_GYM.map(f => [f.id, f.nome || f.etichetta || f.id]))

/** Un gruppo Gym come voce: superserie e circuiti con la linguetta dei giri. */
const voceGym = (g, k) => {
  const singolo = tipoGruppo(g) === 'singolo'
  const giri = serieDi(g)
  return {
    id: g.id ?? k,
    numero: k + 1,
    titolo: singolo ? (g.esercizi?.[0]?.name || 'Esercizio') : NOME_TIPO_GRUPPO[tipoGruppo(g)],
    hint: NOMI_FASI_GYM[faseDi(g)] || '',
    giri: !singolo && giri > 1 ? giri : null,
    durata: null,
    lavoro: true,
    righe: (singolo ? (g.esercizi || []).slice(0, 1) : g.esercizi || []).map((ex, j) => ({
      id: ex.id ?? j, numero: null, nome: singolo ? riassuntoEsercizio(g, ex) : (ex.name || 'Esercizio'),
      specifiche: singolo ? '' : riassuntoEsercizio(g, ex), intensita: null,
    })),
    nota: null,
  }
}

/**
 * Le voci della locandina, per ogni categoria: i blocchi Hyrox (con `pausaPrima`
 * dove il timer mette la pausa), i passi della corsa, i gruppi Gym. Custom ed
 * Evento non ne hanno: il loro contenuto sono le note del coach.
 */
export const vociLocandina = ({ categoria, blocks = [], sections = {} }) => {
  if (categoria === 'Running') return (sections.steps || sections.main?.steps || []).map(voceCorsa)
  if (categoria === 'Gym') return gruppiInOrdine(sections.gym || []).map(voceGym)
  if (categoria === 'Custom' || categoria === 'Event') return []
  const pause = pausePrima(blocks)
  return blocks.map((b, k) => ({ ...voceBlocco(b, k), pausaPrima: pause.has(k) }))
}

// ── Il carosello: il blocco in corso al centro ───────────────────────────

/** Dove siamo, dall'id dello step: preparazione, un blocco, una pausa, la fine, il cronometro libero. */
export const doveSiamo = (stepId) => {
  if (typeof stepId !== 'string') return null
  if (stepId === 'prep') return { tipo: 'prep' }
  if (stepId === 'done') return { tipo: 'fine' }
  if (stepId === 'custom-blk') return { tipo: 'libero' }
  const parti = stepId.split('-')
  const k = parseInt(parti[1], 10)
  if (!Number.isFinite(k)) return null
  if (parti[0] === 'pausa') return { tipo: 'pausa', k }
  if (parti[0] === 'blk') return { tipo: 'blocco', k }
  return null
}

/**
 * Le tappe del carosello: i blocchi, con una carta di pausa davanti a quelli
 * che nella sequenza del timer ce l'hanno, e la carta finale. Le pause si
 * leggono dalla SEQUENZA (non da `pausePrima`): con un telefono che non le ha,
 * la TV non le disegna.
 */
export const tappeCarosello = (blocks = [], sequenza = []) => {
  if (sequenza.some(p => p.id === 'custom-blk')) return [{ tipo: 'libero' }, { tipo: 'fine' }]
  const conPausa = new Set(sequenza.filter(p => p.pausa).map(p => p.blocco))
  const tappe = []
  blocks.forEach((_, k) => {
    if (conPausa.has(k)) tappe.push({ tipo: 'pausa', k })
    tappe.push({ tipo: 'blocco', k })
  })
  tappe.push({ tipo: 'fine' })
  return tappe
}

/** L'indice della tappa in corso: la preparazione sta sulla prima carta. */
export const tappaCorrente = (tappe, dove) => {
  if (!dove || dove.tipo === 'prep' || dove.tipo === 'libero') return 0
  if (dove.tipo === 'fine') return tappe.length - 1
  const j = tappe.findIndex(t => t.tipo === dove.tipo && t.k === dove.k)
  return j >= 0 ? j : 0
}

/**
 * Il colore della fase segue il tema dello step: lavoro giallo, riposo e pausa
 * verdi, corsa azzurra. Solo il colore: lo sfondo resta il nero della TV.
 */
export const ACCENTO_TEMA = {
  prep: BRAND,
  run: RUNNING,
  rest: VERDE_TV,
  hyrox: BRAND,
  emom: BRAND,
  base: '#ffffff',
  done: VERDE_TV,
  custom: CUSTOM,
}

/** Il nome della fase, leggibile: «Lavoro», «Riposo», «Cash In» al posto di «WORK (ON)», «CASH IN». */
const SIGLE = new Set(['EMOM', 'AMRAP', 'ON/OFF'])
export const nomeFase = (step) => {
  if (!step) return ''
  const t = step.title || ''
  const fissi = { 'WORK (ON)': 'Lavoro', 'REST (OFF)': 'Riposo', 'Completato!': 'Finito', ALLENAMENTO: 'Allenamento', PAUSA: 'Pausa' }
  if (fissi[t]) return fissi[t]
  if (SIGLE.has(t) || t !== t.toUpperCase()) return t
  return t.toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase())
}

/**
 * Lo stato di ogni carta del carosello. Per ognuna:
 * - `ora` / `fatta`: in corso / già passata;
 * - `riposo`: l'OFF di un ON/OFF (o un Rest) sulla carta in corso;
 * - `prep`: la preparazione, sulla prima carta;
 * - `giro`: il giro in corso, per la linguetta «2/4»;
 * - `adesso` / `poi`: la riga in lavoro e quella che viene (nel riposo e
 *   prima del via), quando NON ci sono persone;
 * - `chi`, `inArrivo`: con più persone sfasate, per ogni riga chi ci sta
 *   (pieno) o ci andrà (tratteggiato). Stessa regola della TV di prima
 *   (9-tv-persone): le persone stanno sul blocco a scaglioni in corso o sul
 *   prossimo; nel riposo e prima del via dicono dove andrà ognuno.
 */
export const statoCarosello = ({ blocks = [], sequenza = [], step = null, persone = null }) => {
  const tappe = tappeCarosello(blocks, sequenza)
  const dove = doveSiamo(step?.id)
  const t = tappaCorrente(tappe, dove)
  const idStep = step?.id
  const gruppo = Array.isArray(persone) && persone.length > 0 ? persone : null

  const attivo = dove?.tipo === 'blocco' ? dove.k : -1
  const bAttivo = blocks[attivo]
  const attivoFinito = !!gruppo && !!bAttivo && bloccoAScaglioni(bAttivo)
    && esercizioInCorso(bAttivo, attivo, idStep) == null
    && esercizioInArrivo(bAttivo, attivo, idStep) == null
  const da = dove?.tipo === 'pausa' ? dove.k : attivoFinito ? attivo + 1 : attivo
  const bloccoPersone = gruppo && dove?.tipo !== 'fine'
    ? blocks.findIndex((b, i) => i >= da && bloccoAScaglioni(b)) : -1

  const carte = tappe.map((tappa, j) => {
    const ora = j === t
    const b = blocks[tappa.k]
    const base = { ora, fatta: j < t, riposo: false, prep: false, giro: null, adesso: null, poi: null, chi: null, inArrivo: false }
    if (tappa.tipo !== 'blocco' && tappa.tipo !== 'pausa') return base
    const n = (b?.exercises || []).length

    // Le persone: sulla carta del blocco a scaglioni e sulla pausa che lo precede.
    if (gruppo && tappa.k === bloccoPersone && n) {
      let pos = 0
      let inArrivo = true
      if (tappa.tipo === 'blocco' && tappa.k === attivo) {
        const corrente = esercizioInCorso(b, tappa.k, idStep)
        pos = corrente ?? esercizioInArrivo(b, tappa.k, idStep)
        inArrivo = corrente == null
      }
      if (pos != null) {
        base.chi = personePerEsercizio(pos, n, gruppo)
        base.inArrivo = inArrivo
      }
    }

    if (tappa.tipo === 'pausa' || !ora) return base
    base.prep = dove?.tipo === 'prep'
    base.riposo = step?.type === 'rest'
    base.giro = base.prep ? null : giroInCorso(b, idStep)
    if (!base.chi) {
      base.adesso = base.prep ? null : esercizioInCorso(b, tappa.k, idStep)
      base.poi = base.prep ? (n ? 0 : null) : base.riposo ? esercizioInArrivo(b, tappa.k, idStep) : null
    }
    return base
  })

  return { tappe, corrente: t, dove, carte, inGruppo: bloccoPersone >= 0 && bloccoPersone === attivo }
}
