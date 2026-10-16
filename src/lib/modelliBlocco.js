// «Modelli di blocco»: la logica pura che salva un blocco del builder come
// modello del coach e lo rimette in un workout.
//
// Perché esiste: un modello è UN blocco (Hyrox), UNA fase (Running) o UN gruppo
// (Gym) preso dal builder (CLAUDE.md §5) e riusato altrove. Tutto ciò che serve
// per farlo senza errori silenziosi sta qui, in funzioni pure e testate:
//   · il `contenuto` salvato non ha NESSUN `id` (gli id sono Math.random() del
//     client e non hanno senso fuori da quel workout);
//   · il blocco inserito ha id NUOVI a ogni livello e nessun riferimento in
//     comune con il modello o con un altro inserimento — altrimenti cambiare un
//     esercizio qui cambierebbe anche il modello e l'altro workout;
//   · i gruppi Gym non portano la `fase`: la sceglie chi inserisce.
// Custom non ha blocchi, quindi non ha modelli.

import { sottotitoloBlocco, parametriBlocco } from './rigaBlocco'
import { serieDi, quantoEsercizio } from './gym'

/** Gli `id` di CATEGORIE (CreateWorkout.jsx) che hanno blocchi, mai le etichette. */
export const CATEGORIE_MODELLI = ['Hyrox', 'Running', 'Gym']

/** Lunghezza massima del nome: la stessa del `check` SQL. */
export const MAX_NOME = 80

const copia = (o) => JSON.parse(JSON.stringify(o))

const nuovoId = () => Math.random()

/** Una copia senza `id` a nessun livello (e, se serve, senza `fase`). */
const ripulisci = (v, togli) => {
  if (Array.isArray(v)) return v.map(x => ripulisci(x, togli))
  if (v && typeof v === 'object') {
    const fuori = {}
    for (const [k, x] of Object.entries(v)) {
      if (!togli.includes(k)) fuori[k] = ripulisci(x, togli)
    }
    return fuori
  }
  return v
}

/**
 * Il contenuto da salvare: copia profonda del blocco senza `id`. Per Gym
 * toglie anche la `fase` del gruppo e degli esercizi.
 */
export const contenutoDaBlocco = (categoria, blocco) => {
  const g = categoria === 'Gym'
  const pulito = ripulisci(blocco, ['id'])
  if (!g) return pulito
  delete pulito.fase
  for (const ex of pulito.esercizi || []) delete ex.fase
  return pulito
}

/** Dà un id nuovo alla radice e a ogni oggetto dentro un array (esercizi, dettaglio). */
const conIdNuovi = (v, radice = false) => {
  if (Array.isArray(v)) return v.map(x => conIdNuovi(x, true))
  if (v && typeof v === 'object') {
    const fuori = {}
    for (const [k, x] of Object.entries(v)) fuori[k] = conIdNuovi(x)
    return radice ? { id: nuovoId(), ...fuori } : fuori
  }
  return v
}

/**
 * Il blocco da mettere nel workout: copia profonda con id nuovi ovunque. Per
 * Gym la fase è quella chiesta, altrimenti `principale`. ⚠️ Gli esercizi Gym
 * non hanno un campo fase (`nuovoEsercizioGym` ne usa solo i valori di
 * partenza): non se ne inventa uno.
 */
export const bloccoDaModello = (modello, opzioni = {}) => {
  const blocco = conIdNuovi(copia(modello.contenuto), true)
  if (modello.categoria === 'Gym') blocco.fase = opzioni.fase ?? 'principale'
  return blocco
}

export const nomeValido = (nome) => {
  const n = String(nome ?? '').trim()
  return n.length >= 1 && n.length <= MAX_NOME
}

const tronca = (s) => (s.length > MAX_NOME ? `${s.slice(0, MAX_NOME - 1).trimEnd()}…` : s)

const pieno = (v) => v != null && v !== '' && v !== '-'

const fase = (durata, passo) => [durata, pieno(passo) && passo !== 'Libero' ? passo : ''].filter(pieno).join(' · ')

const NOME_FASE = { warmup: 'Riscaldamento', run: 'Corsa', recover: 'Recupero', cooldown: 'Defaticamento' }

const testoCorsa = (step) => {
  if (step.type === 'repeat') {
    const rec = fase(step.recDuration, null)
    return `Ripetute ${step.rounds || 1} × ${step.runDuration || ''}`.trim() + (rec ? ` · rec ${rec}` : '')
  }
  return [NOME_FASE[step.type] || 'Fase', fase(step.duration, step.pace)].filter(Boolean).join(' ')
}

const testoGym = (gruppo) => {
  const nomi = (gruppo.esercizi || []).map(e => e.name).filter(Boolean).join(' + ')
  const quanto = quantoEsercizio(gruppo.esercizi?.[0])
  return `${nomi} ${serieDi(gruppo)} × ${quanto}`.trim()
}

const testoHyrox = (blocco, conEsercizi) => {
  const parti = [blocco.type, parametriBlocco(blocco)].filter(pieno).join(' ')
  if (!conEsercizi) return parti
  const nomi = (blocco.exercises || []).map(e => e.name).filter(Boolean)
  if (!nomi.length) return parti
  return `${parti} · ${nomi.slice(0, 2).join(', ')}${nomi.length > 2 ? '…' : ''}`
}

/** Il nome che l'app propone al coach quando salva: al massimo MAX_NOME caratteri. */
export const nomeProposto = (categoria, blocco) => {
  if (!blocco) return ''
  if (categoria === 'Running') return tronca(testoCorsa(blocco))
  if (categoria === 'Gym') return tronca(testoGym(blocco))
  return tronca(testoHyrox(blocco, true))
}

/** La riga sotto il nome del modello nella lista. */
export const anteprimaModello = (modello) => {
  const c = modello?.contenuto
  if (!c) return ''
  if (modello.categoria === 'Running') return testoCorsa(c)
  if (modello.categoria === 'Gym') return testoGym(c)
  return [c.type, sottotitoloBlocco(c)].filter(pieno).join(' · ')
}

/** Un modello letto dal database è usabile solo se ha la forma della sua categoria. */
export const modelloValido = (modello) => {
  const c = modello?.contenuto
  if (!modello || !CATEGORIE_MODELLI.includes(modello.categoria)) return false
  if (!c || typeof c !== 'object' || Array.isArray(c)) return false
  if (modello.categoria === 'Gym') return Array.isArray(c.esercizi)
  return typeof c.type === 'string' && c.type !== ''
}
