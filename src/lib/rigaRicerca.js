// Le parole del foglio «Cerca con l'IA» (src/components/RicercaCoach.jsx):
// stanno qui e non nel componente perché un file di componenti deve esportare
// solo componenti (react-refresh), e perché sono testabili da sole.

/** Le domande d'esempio: dicono cosa si può chiedere meglio di una spiegazione. */
export const ESEMPI = [
  'Chi non si allena da 5 giorni?',
  'Workout di questa settimana non completati',
  'Chi ha dato RPE 8 o più negli ultimi 7 giorni?',
  'Chi ha una gara nel prossimo mese?',
  'Chi ha scritto di dolori nelle note questo mese?',
  'EMOM con wall balls degli ultimi due mesi',
  'Chi non ha niente in programma nei prossimi 3 giorni?',
]

/** La riga di dettaglio di un atleta trovato: dice PERCHÉ è nella lista. */
export function dettaglioAtleta(r) {
  const pezzi = []
  if (r.giorniFermo != null) pezzi.push(`fermo da ${r.giorniFermo} giorni`)
  if (r.nessunCompletatoNellAnno) pezzi.push('nessun allenamento completato nell\'ultimo anno')
  if (r.gara) pezzi.push(`${r.gara} ${r.fraGiorni === 0 ? 'oggi' : r.fraGiorni === 1 ? 'domani' : `fra ${r.fraGiorni} giorni`}`)
  if (r.senzaProgrammaGiorni != null) pezzi.push(`niente in programma nei prossimi ${r.senzaProgrammaGiorni} giorni`)
  if (r.rpeMassimo != null) pezzi.push(`RPE ${r.rpeMassimo}`)
  if (r.inPausa) pezzi.push('in pausa')
  return pezzi.join(' · ')
}

const STATI_LEGGIBILI = { completato: 'completati', da_fare: 'da fare', scaduto: 'scaduti', non_assegnato: 'mai assegnati' }

const periodo = (a) => (a.dal || a.al) ? `dal ${a.dal || '…'} al ${a.al || '…'}` : null

/**
 * Il filtro che l'IA ha DAVVERO usato, in italiano, da mostrare sotto la
 * risposta.
 *
 * Esiste per il 09/10/2026: alla domanda «chi non si allena da 7 giorni?» il
 * modello di riserva ha chiamato `senza_programma_giorni: 7` — «a chi non hai
 * programmato niente» — e ha risposto «non si allenano» con sicurezza. Senza
 * vedere il filtro, la risposta sbagliata e quella giusta sono identiche.
 * Torna `null` per gli strumenti che non filtrano una lista (apri).
 */
export function descriviFiltro(strumento, args = {}) {
  const a = args || {}
  const pezzi = []
  if (strumento === 'cercaAtleti') {
    if (a.inattivi_da_giorni != null) pezzi.push(`fermi da almeno ${a.inattivi_da_giorni} giorni`)
    if (a.senza_programma_giorni != null) pezzi.push(`niente in programma nei prossimi ${a.senza_programma_giorni} giorni`)
    if (a.gara_entro_giorni != null) pezzi.push(`gara entro ${a.gara_entro_giorni} giorni`)
    if (a.rpe_minimo != null) pezzi.push(`RPE ${a.rpe_minimo} o più negli ultimi ${a.rpe_ultimi_giorni || 7} giorni`)
    if (a.in_pausa === true) pezzi.push('in pausa')
    if (a.in_pausa === false) pezzi.push('esclusi quelli in pausa')
    return pezzi.length ? pezzi.join(' · ') : 'tutti gli atleti'
  }
  if (strumento === 'cercaWorkout') {
    if (a.atleta) pezzi.push(a.atleta)
    if (a.stato) pezzi.push(STATI_LEGGIBILI[a.stato] || a.stato)
    if (a.categoria) pezzi.push(a.categoria)
    if (a.tipo_blocco) pezzi.push(a.tipo_blocco)
    const es = [].concat(a.esercizio || []).filter(Boolean)
    if (es.length) pezzi.push(es.join(' o '))
    const t = [].concat(a.testo || []).filter(Boolean)
    if (t.length) pezzi.push(`«${t.join('» o «')}»`)
    if (a.durata_min != null || a.durata_max != null) pezzi.push(`${a.durata_min ?? 0}–${a.durata_max ?? '…'} min`)
    if (periodo(a)) pezzi.push(periodo(a))
    return pezzi.length ? pezzi.join(' · ') : 'tutti i workout'
  }
  if (strumento === 'cercaNelleNote') {
    const p = [].concat(a.parole || a.testo || []).filter(Boolean)
    pezzi.push(`note con «${p.join('» o «')}»`)
    if (a.atleta) pezzi.push(a.atleta)
    if (periodo(a)) pezzi.push(periodo(a))
    return pezzi.join(' · ')
  }
  if (strumento === 'statisticheAtleta') {
    pezzi.push(a.atleta || 'atleta')
    pezzi.push(periodo(a) || 'ultimi 30 giorni')
    return pezzi.join(' · ')
  }
  return null
}

const LIMITE = /\b429\b|quota|exceeded|rate.?limit|RESOURCE_EXHAUSTED|limite di richieste/i

/**
 * Se mostrare la riga tecnica sotto un errore.
 *
 * NO quando l'errore è un limite di richieste (decisione del committente,
 * 09/10/2026): il messaggio «Limite di richieste raggiunto, aspetta un minuto»
 * dice già tutto, e la riga sotto era il testo inglese di Google o di Groq
 * («… exceeded your current quota …»), cioè rumore. Resta per tutti gli altri
 * errori, dove è l'unica cosa che permette di capire cosa si è rotto.
 */
export function mostraDettaglio(messaggio, dettaglio) {
  if (!dettaglio) return false
  return !LIMITE.test(`${messaggio || ''} ${dettaglio}`)
}
