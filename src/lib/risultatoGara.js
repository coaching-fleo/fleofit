// Il tempo di una gara HYROX già corsa, fase 2 delle gare HYROX
// (docs/memoria/calendario.md). La Edge Function `risultato-hyrox` lo cerca su
// results.hyrox.com; qui c'è tutto il resto: quando chiederlo, come scriverlo,
// dove salvarlo. Puro e provato in src/lib/__tests__/risultatoGara.test.js,
// tranne `cercaRisultato` e `salvaRisultato`, che parlano con Supabase.
//
// 🔴 DOVE SI SALVA, E PERCHÉ NON IN `workouts.sections`. Le policy RLS lasciano
// modificare `workouts` solo agli admin: l'atleta non potrebbe scriverci il
// proprio tempo. Lo schema è congelato (regola 0-bis), quindi niente colonne
// nuove. Il tempo va in due posti che l'atleta può già scrivere:
//  · un **record personale** (`personal_records`): «HYROX Valencia 2026» →
//    «1:12:38», con la data della gara. È la statistica, e compare nella
//    scheda atleta accanto agli altri record;
//  · una **riga leggibile in testa alla nota** dell'assegnazione, che passa a
//    «completato»: «🏁 Tempo HYROX: 1:12:38 · Pro · 79° assoluto». Testo
//    normale e non un marcatore: la legge anche la web app su `main`, e se
//    l'atleta riscrive la nota non sparisce niente di nascosto.

import { leggiJson, scriviJson } from './offlineQueue'

export const PREFISSO_RIGA = '🏁 Tempo HYROX:'
// La seconda riga: il link al risultato ufficiale. Dal 13/10/2026 la scheda
// della gara lo rilegge (`riferimentoDallaNota`) per mostrare posizioni e
// split, che non si salvano da nessuna parte (schema congelato). Un link e
// non un marcatore: dalla web app si apre, e se l'atleta lo cancella si
// perdono solo gli split, non il tempo.
export const PREFISSO_LINK = '🔗 Risultato ufficiale:'
export const CHIAVE_IGNORATE = 'fleofit_gare_senza_risultato'

// Dopo due mesi la domanda «com'è andata?» non ha più senso.
const GIORNI_PER_CHIEDERE = 60

/** «01:12:38» → «1:12:38»; «00:58:10» → «58:10». */
export function tempoCorto(tempo) {
  const m = /^(\d{1,2}):(\d{2}):(\d{2})$/.exec(String(tempo || '').trim())
  if (!m) return String(tempo || '').trim()
  const ore = Number(m[1])
  return ore > 0 ? `${ore}:${m[2]}:${m[3]}` : `${Number(m[2])}:${m[3]}`
}

/**
 * Un tempo scritto a mano, se è un tempo: «1:12:38», «72:38», «1.12.38».
 * Torna la forma corta, o `null`.
 */
export function leggiTempoScritto(testo) {
  const s = String(testo || '').trim().replace(/[.,]/g, ':')
  let m = /^(\d{1,2}):([0-5]\d):([0-5]\d)$/.exec(s)
  if (m) return tempoCorto(`${m[1].padStart(2, '0')}:${m[2]}:${m[3]}`)
  m = /^(\d{1,3}):([0-5]\d)$/.exec(s)
  if (m) {
    const min = Number(m[1])
    return tempoCorto(`${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}:${m[2]}`)
  }
  return null
}

/** «HYROX PRO DOUBLES - Saturday» → «Pro Doubles»; «HYROX - Sunday» → «Open». */
export function divisioneCorta(divisione) {
  const d = String(divisione || '').replace(/\s*-\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday|overall)\s*$/i, '')
  const resto = d.replace(/^HYROX\s*/i, '').trim()
  if (!resto) return d ? 'Open' : ''
  return resto.toLowerCase().replace(/team relay/, 'relay').replace(/\b\w/g, c => c.toUpperCase())
}

/**
 * La città della gara, per il nome del record. Dal 13/10/2026 sta in
 * `sections.hyrox.citta`; per gli eventi salvati prima si ricava dal titolo
 * («HYROX Valencia» → «Valencia») o, se il titolo è stato cambiato, dal link
 * della gara su hyrox.com.
 */
export function cittaGara(sections, titolo) {
  const h = sections?.hyrox
  if (h?.citta) return h.citta
  const daTitolo = /HYROX\s+(.+)$/i.exec(titolo || '')?.[1]?.trim()
  if (daTitolo) return daTitolo
  const slug = /\/event\/([^/]+)\/?$/.exec(h?.url || '')?.[1] || ''
  const dopo = slug.split('hyrox-').pop().replace(/-s\d\d-\d\d$/, '').replace(/-\d+$/, '')
  return dopo.split('-').filter(Boolean).map(p => p[0].toUpperCase() + p.slice(1)).join(' ')
}

/** Il nome del record personale: «HYROX Valencia 2026». */
export function nomeRecord(citta, giorno) {
  return `HYROX ${citta} ${String(giorno || '').slice(0, 4)}`.trim()
}

/** La riga che va in testa alla nota. */
export function rigaRisultato({ tempo, divisione, posizione, posizioneCategoria, categoriaEta }) {
  const parti = [tempoCorto(tempo)]
  const div = divisioneCorta(divisione)
  if (div) parti.push(div)
  if (posizione) parti.push(`${posizione}° assoluto`)
  if (posizioneCategoria) parti.push(`${posizioneCategoria}° di categoria${categoriaEta ? ` (${categoriaEta})` : ''}`)
  return `${PREFISSO_RIGA} ${parti.join(' · ')}`
}

/** C'è già un tempo nella nota? */
export function haRisultato(note) {
  return String(note || '').includes(PREFISSO_RIGA)
}

// I marcatori dell'app stanno in testa alla nota ([RPE: 7/10], [GRADIMENTO: si]):
// la riga del tempo va DOPO di loro, mai prima — `rpeDichiarato` legge
// `^\[RPE:` ancorato all'inizio (gradimento.js).
const MARCATORI_IN_TESTA = /^(?:\[[A-ZÀ-Ü ]+:[^\]\n]*\]\s*\n?)*/

/**
 * La nota con la riga del tempo in testa, e sotto il link al risultato
 * ufficiale se c'è (sostituiscono quelle vecchie, se c'erano).
 */
export function conRisultato(note, riga, url = '') {
  const s = String(note || '')
  const testa = s.match(MARCATORI_IN_TESTA)[0]
  const corpo = s.slice(testa.length)
    .split('\n').filter(l => !l.startsWith(PREFISSO_RIGA) && !l.startsWith(PREFISSO_LINK)).join('\n').replace(/^\s+/, '')
  const righe = url ? `${riga}\n${PREFISSO_LINK} ${url}` : riga
  return `${testa}${righe}${corpo ? `\n${corpo}` : ''}`
}

const rigaDelRisultato = (l) => l.startsWith(PREFISSO_RIGA) || l.startsWith(PREFISSO_LINK)

/**
 * La nota come la legge e la scrive l'atleta: senza la riga del tempo e senza
 * il link. 13/10/2026: «rimuovi le note, c'è già il tasto risultato ufficiale
 * in fondo» — tempo e link li mostra la card della gara, e nel riquadro delle
 * note restano solo le parole dell'atleta. Nel database le due righe restano:
 * sono l'unico posto dove il risultato è salvato (schema congelato).
 */
export function senzaRisultato(note) {
  return String(note || '').split('\n').filter(l => !rigaDelRisultato(l)).join('\n').replace(/^\s+/, '')
}

/**
 * Il testo che l'atleta ha scritto, con davanti la riga del tempo e il link
 * presi dalla nota di prima: salvare le note non deve cancellare il risultato
 * che il riquadro non mostra.
 */
export function conRisultatoDi(notaPrima, testo) {
  const righe = String(notaPrima || '').split('\n').filter(rigaDelRisultato)
  const corpo = senzaRisultato(testo)
  return [...righe, corpo].filter(Boolean).join('\n')
}

/**
 * Da quale risultato viene il tempo della nota: `{ stagione, idp, evento }`
 * letti dal link ufficiale, o `null` (tempo scritto a mano, o salvato prima
 * del 13/10/2026).
 */
export function riferimentoDallaNota(note) {
  const riga = String(note || '').split('\n').find(l => l.startsWith(PREFISSO_LINK))
  if (!riga) return null
  const m = /season-(\d+)\/\?(\S+)/.exec(riga)
  if (!m) return null
  const p = new URLSearchParams(m[2])
  const idp = p.get('idp')
  const evento = p.get('event')
  if (!idp || !evento || !/^[A-Za-z0-9_]+$/.test(idp + evento)) return null
  return { stagione: Number(m[1]), idp, evento }
}

/** Il giorno di oggi meno il giorno di gara, in giorni di calendario. */
function giorniDopo(giorno, oggi) {
  return Math.round((Date.parse(`${oggi}T00:00:00Z`) - Date.parse(`${giorno}T00:00:00Z`)) / 86_400_000)
}

/**
 * Si chiede il tempo? Solo per un evento nato da una gara HYROX
 * (`sections.hyrox`), dal giorno DOPO quello di gara (i risultati escono la
 * sera stessa), per due mesi, se un tempo non c'è già e se l'atleta non ha
 * detto «non ho partecipato».
 */
export function daChiedere({ sections, giorno, note, awId }, oggi, ignorate = []) {
  if (!sections?.hyrox || !giorno || !oggi) return false
  if (haRisultato(note)) return false
  if (awId && ignorate.includes(awId)) return false
  const dopo = giorniDopo(giorno, oggi)
  return dopo >= 1 && dopo <= GIORNI_PER_CHIEDERE
}

/**
 * Cognome e nome dal profilo. Si cerca SOLO il cognome (12/10/2026: «legga
 * solo il cognome, mi dà la lista e seleziono io»): il nome serve all'ordine
 * della lista. `null` se il cognome manca.
 */
export function nomeDaCercare(atleta) {
  const cognome = String(atleta?.surname || '').trim()
  const nome = String(atleta?.name || '').trim()
  return cognome ? { cognome, nome } : null
}

/** Il dettaglio (tempo, posizioni, split) della riga che l'atleta ha scelto. */
export async function dettaglioRisultato(supabase, { stagione, idp, evento }) {
  try {
    const { data, error } = await supabase.functions.invoke('risultato-hyrox', {
      body: { azione: 'dettaglio', stagione, idp, evento },
    })
    if (error || !data?.dettaglio) throw error || new Error('dettaglio vuoto')
    return data.dettaglio
  } catch (e) {
    console.warn('Dettaglio del risultato non disponibile:', e)
    return null
  }
}

// ── «Non ho partecipato» ────────────────────────────────────────────────────
// Una memoria del dispositivo, non un dato: chi cambia telefono si vede rifare
// la domanda, e non è un danno (CLAUDE.md §8, come `fleofit_ultimo_export`).

export function leggiIgnorate(storage = globalThis.localStorage) {
  const v = leggiJson(CHIAVE_IGNORATE, [], storage)
  return Array.isArray(v) ? v : []
}

export function ignora(awId, storage = globalThis.localStorage) {
  const v = leggiIgnorate(storage)
  if (!v.includes(awId)) scriviJson(CHIAVE_IGNORATE, [...v, awId].slice(-50), storage)
}

// ── Rete ────────────────────────────────────────────────────────────────────

/** Chiede alla Edge Function. Torna la sua risposta, o `{ stato: 'errore', messaggio }`. */
export async function cercaRisultato(supabase, { citta, giorno, cognome, nome }) {
  try {
    const { data, error } = await supabase.functions.invoke('risultato-hyrox', {
      body: { citta, data: giorno, cognome, nome },
    })
    if (error || !data?.stato) throw error || new Error('risposta vuota')
    return data
  } catch (e) {
    console.warn('risultato-hyrox non disponibile:', e)
    return { stato: 'errore', messaggio: 'I risultati HYROX non rispondono in questo momento.' }
  }
}

/**
 * Salva il tempo: la riga in testa alla nota (rilette dal database un attimo
 * prima, per non sovrascrivere una nota cambiata nel frattempo), lo stato
 * «completato» e il record personale (aggiornato se esiste già).
 */
export async function salvaRisultato(supabase, { awId, athleteId, citta, giorno, risultato }) {
  const { data: aw, error: e1 } = await supabase.from('athlete_workouts').select('notes').eq('id', awId).single()
  if (e1) throw e1
  const { error: e2 } = await supabase.from('athlete_workouts')
    .update({ notes: conRisultato(aw?.notes, rigaRisultato(risultato), risultato.url), status: 'completed' })
    .eq('id', awId)
  if (e2) throw e2

  await salvaRecord(supabase, { athleteId, exercise: nomeRecord(citta, giorno), value: tempoCorto(risultato.tempo), giorno })
}

/** Il record personale della gara: aggiornato se c'è già, mai duplicato. */
async function salvaRecord(supabase, { athleteId, exercise, value, giorno }) {
  const { data: esistenti } = await supabase.from('personal_records')
    .select('id').eq('athlete_id', athleteId).eq('exercise', exercise)
  const esistente = Array.isArray(esistenti) ? esistenti[0] : null
  const { error } = esistente
    ? await supabase.from('personal_records').update({ value, date: giorno }).eq('id', esistente.id)
    : await supabase.from('personal_records').insert({ athlete_id: athleteId, exercise, value, date: giorno })
  if (error) throw error
}

/**
 * Gli split nell'ordine in cui si corrono: Run 1, SkiErg, Run 2, Sled Push…
 * Il sito li dà in due tabelle separate (run e stazioni).
 */
export function splitInOrdine({ run = [], stazioni = [] } = {}) {
  const out = []
  for (let i = 0; i < Math.max(run.length, stazioni.length); i++) {
    if (run[i]) out.push({ ...run[i], nome: `Run ${i + 1}`, corsa: true, tempo: tempoCorto(run[i].tempo) })
    if (stazioni[i]) out.push({ ...stazioni[i], corsa: false, tempo: tempoCorto(stazioni[i].tempo) })
  }
  return out
}

/** Il tempo scritto nella riga della nota, per mostrarlo grande: «1:12:38». */
export function tempoDallaNota(note) {
  const riga = String(note || '').split('\n').find(l => l.startsWith(PREFISSO_RIGA))
  if (!riga) return null
  const [tempo, ...resto] = riga.slice(PREFISSO_RIGA.length).trim().split(' · ')
  return { tempo, dettagli: resto.join(' · ') }
}

// ── Le gare passate ─────────────────────────────────────────────────────────
// «Vorrei mettere anche i tempi dei miei vecchi HYROX» (12/10/2026). Il sito
// ufficiale cerca un nome UNA GARA ALLA VOLTA, quindi l'atleta sceglie la gara
// da un elenco (tutte le stagioni, ~355 gare) e l'app cerca lì. ⚠️ Il sito non
// dà le date: il giorno lo sceglie l'atleta, aiutato dal giorno della
// settimana che a volte è nella categoria («HYROX PRO - Saturday»).

export const CHIAVE_CACHE_PASSATE = 'fleofit_cache_gare_passate'
const DURATA_CACHE_PASSATE = 12 * 3_600_000

/** L'elenco delle gare di tutte le stagioni: dalla copia se fresca, altrimenti dal server. */
export async function elencoGarePassate(supabase, { adesso = Date.now(), storage = globalThis.localStorage } = {}) {
  const copia = leggiJson(CHIAVE_CACHE_PASSATE, null, storage)
  const valida = Array.isArray(copia?.gare) && copia.gare.length > 0
  if (valida && adesso - (copia.salvate || 0) < DURATA_CACHE_PASSATE) return { gare: copia.gare, errore: null }
  try {
    const { data, error } = await supabase.functions.invoke('risultato-hyrox', { body: { azione: 'gare' } })
    if (error || !Array.isArray(data?.gare) || data.gare.length === 0) throw error || new Error('elenco vuoto')
    scriviJson(CHIAVE_CACHE_PASSATE, { salvate: adesso, gare: data.gare }, storage)
    return { gare: data.gare, errore: null }
  } catch (e) {
    console.warn('Elenco delle gare passate non disponibile:', e)
    if (valida) return { gare: copia.gare, errore: null }
    return { gare: [], errore: "L'elenco delle gare HYROX non è disponibile in questo momento." }
  }
}

/** Le gare che contengono tutte le parole cercate, nella città o nell'anno. */
export function cercaGarePassate(gare, testo) {
  const norm = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const parole = norm(testo).split(/\s+/).filter(Boolean)
  if (parole.length === 0) return gare || []
  return (gare || []).filter(g => parole.every(p => norm(`${g.citta} ${g.anno}`).includes(p)))
}

/** Le gare divise per stagione, dalla più recente: `[{ etichetta: '25/26', gare }]`. */
export function perStagione(gare) {
  const gruppi = []
  for (const g of gare || []) {
    let gr = gruppi.find(x => x.stagione === g.stagione)
    if (!gr) { gr = { stagione: g.stagione, etichetta: g.etichetta, gare: [] }; gruppi.push(gr) }
    gr.gare.push(g)
  }
  return gruppi.sort((a, b) => b.stagione - a.stagione)
}

/** Cerca il nome in una gara già scelta. Stessa risposta di `cercaRisultato`. */
export async function cercaInGara(supabase, { gruppo, stagione, cognome, nome }) {
  try {
    const { data, error } = await supabase.functions.invoke('risultato-hyrox', { body: { gruppo, stagione, cognome, nome } })
    if (error || !data?.stato) throw error || new Error('risposta vuota')
    return data
  } catch (e) {
    console.warn('risultato-hyrox non disponibile:', e)
    return { stato: 'errore', messaggio: 'I risultati HYROX non rispondono in questo momento.' }
  }
}

/** «HYROX PRO - Saturday» → 6 (come `Date.getDay()`); `null` se la categoria non dice il giorno. */
export function giornoSettimana(divisione) {
  const giorni = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const m = /-\s*(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\s*$/i.exec(divisione || '')
  return m ? giorni.indexOf(m[1].toLowerCase()) : null
}

/** La gara è già fra i record dell'atleta? (stesso nome del record: «HYROX Turin 2026») */
export async function giaImportata(supabase, { athleteId, gara }) {
  const { data } = await supabase.from('personal_records')
    .select('id, value').eq('athlete_id', athleteId).eq('exercise', nomeRecord(gara.citta, gara.anno))
  return Array.isArray(data) && data.length > 0 ? data[0] : null
}

/**
 * Salva una gara passata: un evento già chiuso nel calendario dell'atleta
 * (workout `Event` autonomo — l'unico tipo che un atleta può inserire, per
 * le policy — più l'assegnazione «completato» con la riga del tempo) e il
 * record personale.
 */
export async function salvaGaraPassata(supabase, { athleteId, gara, giorno, risultato }) {
  const { data: w, error: e1 } = await supabase.from('workouts').insert({
    title: `HYROX ${gara.citta}`,
    date: giorno,
    sections: {
      category: 'Event', isEvent: true, isAutonomous: true,
      hyrox: { citta: gara.citta, gruppo: gara.gruppo, stagione: gara.stagione, passata: true },
    },
  }).select().single()
  if (e1) throw e1
  const { error: e2 } = await supabase.from('athlete_workouts').insert({
    athlete_id: athleteId, workout_id: w.id, completed_date: giorno, status: 'completed',
    notes: conRisultato('', rigaRisultato(risultato), risultato.url),
  })
  if (e2) throw e2
  await salvaRecord(supabase, { athleteId, exercise: nomeRecord(gara.citta, gara.anno), value: tempoCorto(risultato.tempo), giorno })
}

// ── Le statistiche sulla scheda della gara ──────────────────────────────────

const chiaveDettaglio = (r) => `fleofit_cache_risultato_${r.stagione}_${r.idp}`

/**
 * Il dettaglio di un risultato già salvato. Un risultato ufficiale non cambia
 * più: la prima lettura resta nel telefono (`fleofit_cache_risultato_…`) e la
 * scheda si apre anche offline, senza chiedere di nuovo al sito.
 */
export async function statisticheSalvate(supabase, rif, storage = globalThis.localStorage) {
  if (!rif) return null
  const copia = leggiJson(chiaveDettaglio(rif), null, storage)
  if (copia?.tempo) return copia
  const d = await dettaglioRisultato(supabase, rif)
  if (d?.tempo) scriviJson(chiaveDettaglio(rif), d, storage)
  return d
}

const secondi = (t) => {
  const p = String(t || '').split(':').map(Number)
  if (p.some(Number.isNaN) || p.length < 2) return null
  return p.reduce((a, n) => a * 60 + n, 0)
}

/**
 * Le statistiche da mostrare, ricavate dal dettaglio: corsa, stazioni (la
 * somma delle otto), Roxzone, e la stazione più lenta e più veloce per
 * posizione — dove si è perso e dove si è guadagnato rispetto agli altri.
 */
export function riassuntoGara(d) {
  if (!d) return null
  const stazioni = (d.stazioni || []).map(s => ({ ...s, sec: secondi(s.tempo), pos: Number(s.posizione) || null }))
  const sommaStazioni = stazioni.every(s => s.sec != null) && stazioni.length
    ? stazioni.reduce((a, s) => a + s.sec, 0) : null
  const conPosizione = stazioni.filter(s => s.pos)
  const ordinate = [...conPosizione].sort((a, b) => a.pos - b.pos)
  return {
    corsa: d.totaleCorsa ? tempoCorto(d.totaleCorsa) : null,
    roxzone: d.roxzone ? tempoCorto(d.roxzone) : null,
    stazioni: sommaStazioni != null ? tempoCorto(`${String(Math.floor(sommaStazioni / 3600)).padStart(2, '0')}:${String(Math.floor(sommaStazioni / 60) % 60).padStart(2, '0')}:${String(sommaStazioni % 60).padStart(2, '0')}`) : null,
    migliore: ordinate.length > 1 ? ordinate[0] : null,
    peggiore: ordinate.length > 1 ? ordinate[ordinate.length - 1] : null,
  }
}
