// Regole pure di `risultato-hyrox`: niente import Deno, così i test le provano
// da vitest (src/lib/__tests__/risultatoHyroxServer.test.js) su copie vere
// delle pagine di results.hyrox.com, in src/lib/__tests__/fixtures/risultati-*.
//
// ⚠️ Non esiste un'interfaccia ufficiale. results.hyrox.com è un sito
// mika:timing dietro Cloudflare: si leggono le sue pagine pubbliche. Come
// funziona, verificato il 12/10/2026:
//  · `/` porta all'ultima stagione (`/season-9/`); ogni stagione ha un menu
//    `event_main_group` con le gare: «2026 Valencia», «2026 Sao Paulo»… Una
//    gara compare quando è vicina o già corsa, non mesi prima;
//  · la ricerca per nome funziona UNA CATEGORIA ALLA VOLTA (`event=H_…`,
//    `HPRO_…`, `HD_…`, una per giorno): senza `event` cerca solo nella prima.
//    Quindi si cerca in tutte, tranne le «Overall» (doppioni dei giorni) e
//    le Youngstars;
//  · la pagina di dettaglio ha categoria, posizioni, tempo e gli split, ognuno
//    con una classe sua (`f-time_finish_netto`, `f-place_all`, `f-time_01`…).

export const BASE = 'https://results.hyrox.com'

export type Stagione = { numero: number, etichetta: string }   // 9, «Season 26/27»
export type Categoria = { codice: string, nome: string }        // H_LR3…, «HYROX - Saturday»
export type Riga = { idp: string, evento: string, nome: string, nazione: string, categoriaEta: string, tempo: string }
export type Split = { nome: string, tempo: string, posizione: string }
export type Dettaglio = {
  nome: string, divisione: string, categoriaEta: string, tempo: string,
  posizione: string, posizioneCategoria: string,
  run: Split[], stazioni: Split[], roxzone: string, totaleCorsa: string,
}

const ENTITA: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', ndash: '–' }
function decodifica(testo: string): string {
  return String(testo || '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (t, n) => ENTITA[n.toLowerCase()] ?? t)
    .replace(/\s+/g, ' ')
    .trim()
}

/** Minuscolo, senza accenti né punteggiatura: «São Paulo» = «Sao Paulo». */
export function normalizza(testo: string): string {
  return String(testo || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

/** Le stagioni dai link della pagina: `[{ numero: 9, etichetta: 'Season 26/27' }, …]`. */
export function leggiStagioni(html: string): Stagione[] {
  const viste = new Map<number, string>()
  for (const m of (html || '').matchAll(/href="\/season-(\d+)\/?"[^>]*>([^<]*)</g)) {
    const n = Number(m[1])
    const etichetta = decodifica(m[2])
    if (!viste.has(n) || /season/i.test(etichetta)) viste.set(n, etichetta)
  }
  return [...viste].map(([numero, etichetta]) => ({ numero, etichetta })).sort((a, b) => b.numero - a.numero)
}

/** Le opzioni di un `<select name="…">`: `[[valore, testo], …]`. */
function opzioni(html: string, nome: string): [string, string][] {
  const sel = new RegExp(`<select[^>]*name="${nome}"[^>]*>([\\s\\S]*?)</select>`).exec(html || '')
  if (!sel) return []
  return [...sel[1].matchAll(/<option[^>]*value="([^"]*)"[^>]*>([^<]*)/g)].map(m => [decodifica(m[1]), decodifica(m[2])])
}

/** Le gare di una stagione, come le scrive il sito: «2026 Valencia». */
export function leggiGruppi(html: string): string[] {
  return opzioni(html, 'event_main_group').map(([v]) => v).filter(Boolean)
}

/**
 * La stagione HYROX di una data: comincia ad agosto. Il 15/10/2026 è la
 * «26/27», il 20/03/2026 la «25/26». Serve solo a decidere DA DOVE cercare:
 * se la gara non c'è, si prova la stagione accanto.
 */
export function etichettaStagione(data: string): string {
  const anno = Number(data.slice(0, 4))
  const mese = Number(data.slice(5, 7))
  const inizio = mese >= 8 ? anno : anno - 1
  const yy = (n: number) => String(n % 100).padStart(2, '0')
  return `${yy(inizio)}/${yy(inizio + 1)}`
}

/** Le stagioni nell'ordine in cui cercare la gara: prima quella della data, poi le vicine. */
export function ordineStagioni(stagioni: Stagione[], data: string): Stagione[] {
  const giusta = stagioni.find(s => s.etichetta.includes(etichettaStagione(data)))
  if (!giusta) return stagioni.slice(0, 2)
  return [...stagioni].sort((a, b) => Math.abs(a.numero - giusta.numero) - Math.abs(b.numero - giusta.numero)).slice(0, 2)
}

/**
 * Il gruppo dei risultati di una gara: «2026 Valencia» per Valencia del 2026.
 * Le Youngstars restano fuori. La città si confronta senza accenti, e basta
 * che uno dei due nomi contenga l'altro («Washington DC» / «Washington»).
 */
export function trovaGruppo(gruppi: string[], citta: string, anno: string): string | null {
  const c = normalizza(citta)
  if (!c) return null
  const candidati = gruppi.filter(g => !/youngstars/i.test(g) && normalizza(g).startsWith(`${anno} `))
  const nome = (g: string) => normalizza(g).slice(anno.length + 1)
  return candidati.find(g => nome(g) === c)
    ?? candidati.find(g => nome(g).includes(c) || c.includes(nome(g)))
    ?? null
}

/** Le categorie in cui cercare: tutte tranne le «Overall» (doppioni) e le Youngstars. */
export function leggiCategorie(html: string): Categoria[] {
  return opzioni(html, 'event')
    .filter(([codice, nome]) => codice && !/overall/i.test(codice + nome) && !/youngstars/i.test(nome))
    .map(([codice, nome]) => ({ codice, nome }))
}

/** L'URL di una ricerca per nome in una categoria. */
export function urlRicerca(stagione: number, gruppo: string, categoria: string, cognome: string, nome = ''): string {
  // ⚠️ `search_event` oltre a `event`: senza, nei Doubles e nelle staffette la
  // ricerca non trova i componenti della squadra (verificato il 12/10/2026,
  // «Remonato» in HYROX DOUBLES a Torino: 0 righe senza, la coppia con).
  // Il nome è facoltativo: con il solo cognome si trova anche chi, in coppia,
  // è iscritto con un nome scritto diversamente.
  const p = new URLSearchParams({
    pid: 'search', pidp: 'start', event_main_group: gruppo, event: categoria, search_event: categoria,
    'search[name]': cognome,
  })
  if (nome) p.set('search[firstname]', nome)
  return `${BASE}/season-${stagione}/?${p}`
}

/** L'URL della pagina di un risultato. */
export function urlDettaglio(stagione: number, idp: string, evento: string): string {
  const p = new URLSearchParams({ content: 'detail', idp, event: evento, lang: 'EN_CAP' })
  return `${BASE}/season-${stagione}/?${p}`
}

/**
 * Il nome di una squadra senza le ripetizioni del sito: «Anna Bianchi, Anna
 * Bianchi, Luca Rossi, Luca Rossi» → «Anna Bianchi, Luca Rossi». Un nome
 * individuale («Rossi, Alessandro (ITA)») non ha ripetizioni e resta com'è.
 */
export function nomeSquadra(nome: string): string {
  const parti = nome.split(/\s*,\s*/)
  const uniche = parti.filter((p, i) => parti.indexOf(p) === i)
  return uniche.length < parti.length ? uniche.join(', ') : nome
}

/** Il testo di un campo `type-…` di una riga, senza l'etichetta mobile che lo precede. */
function campoRiga(riga: string, tipo: string): string {
  const m = new RegExp(`list-field type-${tipo}[^"]*"[^>]*>(?:<div[^>]*>[^<]*</div>)?([^<]*)`).exec(riga)
  return m ? decodifica(m[1]) : ''
}

/** Le righe di una ricerca. Il sito ripete la riga attiva: si tiene una per `idp`. */
export function leggiRicerca(html: string): Riga[] {
  const righe: Riga[] = []
  for (const m of (html || '').matchAll(/<li class="[^"]*list-group-item row[^"]*">([\s\S]*?)<\/li>/g)) {
    const r = m[1]
    // `type-fullname` per gli individuali, `type-relay_member` per Doubles e
    // staffette: lì il «nome» è la squadra, «Anna Bianchi, Anna Bianchi,
    // Luca Rossi, Luca Rossi» (ogni componente ripetuto due volte).
    const link = /type-(?:fullname|relay_member)"><a href="([^"]*)">([^<]*)</.exec(r)
    if (!link) continue
    const href = decodifica(link[1])
    const idp = /[?&]idp=([^&]+)/.exec(href)?.[1]
    const evento = /[?&]event=([^&]+)/.exec(href)?.[1]
    if (!idp || !evento || righe.some(x => x.idp === idp)) continue
    righe.push({
      idp, evento,
      nome: nomeSquadra(decodifica(link[2])),
      nazione: /class="nation__abbr">([^<]*)</.exec(r)?.[1]?.trim() || '',
      categoriaEta: campoRiga(r, 'age_class'),
      tempo: campoRiga(r, 'time'),
    })
  }
  return righe
}

/** Una cella `<td class="f-<campo> …">` della pagina di dettaglio. */
function cella(html: string, campo: string): string {
  const m = new RegExp(`<td class="f-${campo}[^"]*">([\\s\\S]*?)</td>`).exec(html)
  if (!m) return ''
  const v = decodifica(m[1].replace(/<[^>]+>/g, ''))
  return v === '–' ? '' : v
}

/** Una riga della tabella degli split: etichetta, tempo, posizione. */
function rigaSplit(html: string, campo: string): Split | null {
  const m = new RegExp(`<tr class="[^"]*f-${campo}"[^>]*>\\s*<th[^>]*>([^<]*)</th>\\s*<td[^>]*>([^<]*)</td>\\s*<td[^>]*>([\\s\\S]*?)</td>`).exec(html)
  if (!m) return null
  const posizione = decodifica(m[3].replace(/<[^>]+>/g, ''))
  return { nome: decodifica(m[1]), tempo: decodifica(m[2]), posizione: posizione === '–' ? '' : posizione }
}

/**
 * La pagina di un risultato. I run sono `f-time_01`…`08`, le stazioni
 * `f-time_11`…`18` (verificato su una gara da 8+8), Roxzone `f-time_60`,
 * totale corsa `f-time_49`.
 */
export function leggiDettaglio(html: string): Dettaglio | null {
  const tempo = cella(html, 'time_finish_netto')
  if (!tempo) return null
  const run: Split[] = []
  const stazioni: Split[] = []
  for (let i = 1; i <= 8; i++) {
    const r = rigaSplit(html, `time_0${i}`)
    if (r) run.push(r)
    const s = rigaSplit(html, `time_1${i}`)
    if (s) stazioni.push(s)
  }
  return {
    nome: cella(html, '__fullname'),
    divisione: cella(html, '__event'),
    categoriaEta: cella(html, '_type_age_class'),
    tempo,
    posizione: cella(html, 'place_all'),
    posizioneCategoria: cella(html, 'place_age'),
    run, stazioni,
    roxzone: rigaSplit(html, 'time_60')?.tempo || '',
    totaleCorsa: rigaSplit(html, 'time_49')?.tempo || '',
  }
}

/**
 * Il controllo sul corpo della richiesta. Basta il cognome (12/10/2026): il
 * telefono mostra la lista e l'atleta sceglie chi è. Il nome, se c'è, serve
 * solo all'ordine.
 */
export function validaRichiesta(corpo: unknown): string | null {
  const c = corpo as Record<string, unknown> | null
  if (!c || typeof c !== 'object') return 'Richiesta non valida'
  for (const k of ['citta', 'data', 'cognome']) {
    if (typeof c[k] !== 'string' || !(c[k] as string).trim()) return `Manca ${k}`
    if ((c[k] as string).length > 80) return `${k} troppo lungo`
  }
  if (c.nome != null && (typeof c.nome !== 'string' || c.nome.length > 80)) return 'Nome non valido'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.data as string)) return 'Data non valida'
  return null
}

/**
 * Quanto una riga corrisponde all'atleta: 2 = cognome e nome, 1 = solo il
 * cognome, 0 = solo l'inizio (il sito cerca per prefisso: «Rossi» trova anche
 * «Rossin»). Serve solo all'ORDINE della lista: dal 12/10/2026 è l'atleta a
 * scegliere chi è, non l'app.
 * Due forme di nome: «Rossi, Alessandro (ITA)» per gli individuali, «Anna
 * Bianchi, Luca Rossi» per Doubles e staffette (nome e cognome, per componente).
 */
export function corrispondenza(riga: { nome: string }, cognome: string, nome: string): number {
  const c = normalizza(cognome)
  const n = normalizza(nome)
  const individuale = /^([^,]+),\s*([^(]+)\(/.exec(riga.nome || '')
  if (individuale) {
    const okC = normalizza(individuale[1]) === c
    const okN = !!n && normalizza(individuale[2]) === n
    return okC && okN ? 2 : okC ? 1 : 0
  }
  let migliore = 0
  for (const membro of String(riga.nome || '').split(/\s*,\s*/)) {
    const parole = normalizza(membro).split(' ')
    const okC = c.split(' ').every(p => parole.includes(p))
    const okN = !!n && n.split(' ').every(p => parole.includes(p))
    migliore = Math.max(migliore, okC && okN ? 2 : okC ? 1 : 0)
  }
  return migliore
}

export function ordinaCandidati<T extends { nome: string }>(righe: T[], cognome: string, nome: string): (T & { corrispondenza: number })[] {
  return righe
    .map(r => ({ ...r, corrispondenza: corrispondenza(r, cognome, nome) }))
    .sort((a, b) => b.corrispondenza - a.corrispondenza)
}

export type GaraPassata = { gruppo: string, stagione: number, etichetta: string, anno: string, citta: string }

/**
 * Le gare di una stagione per l'elenco delle «gare passate»: «2026 Turin» →
 * `{ anno: '2026', citta: 'Turin' }`. Le Youngstars restano fuori. L'ordine è
 * quello del sito, che le elenca dalla più recente.
 * ⚠️ Il sito NON dà la data di una gara, né qui né nel dettaglio: solo l'anno
 * nel nome e il giorno della settimana nella categoria («HYROX - Saturday»).
 */
export function garePassate(gruppi: string[], stagione: Stagione): GaraPassata[] {
  return gruppi
    .filter(g => !/youngstars/i.test(g))
    .map(g => {
      const m = /^(\d{4})\s+(.+)$/.exec(g.trim())
      return m ? { gruppo: g, stagione: stagione.numero, etichetta: stagione.etichetta.replace(/^season\s*/i, ''), anno: m[1], citta: m[2] } : null
    })
    .filter((g): g is GaraPassata => g !== null)
}

/** Il corpo di una ricerca su una gara già scelta dall'elenco (gare passate). */
export function validaRicercaDiretta(corpo: unknown): string | null {
  const c = corpo as Record<string, unknown> | null
  if (!c || typeof c !== 'object') return 'Richiesta non valida'
  if (typeof c.gruppo !== 'string' || !c.gruppo.trim() || c.gruppo.length > 80) return 'Manca gruppo'
  if (!Number.isInteger(c.stagione) || (c.stagione as number) < 1 || (c.stagione as number) > 99) return 'Stagione non valida'
  if (typeof c.cognome !== 'string' || !c.cognome.trim()) return 'Manca cognome'
  if (c.cognome.length > 80) return 'cognome troppo lungo'
  if (c.nome != null && (typeof c.nome !== 'string' || c.nome.length > 80)) return 'Nome non valido'
  return null
}

/** Il corpo di una richiesta di dettaglio: gli id li ha dati il sito nella lista. */
export function validaDettaglio(corpo: unknown): string | null {
  const c = corpo as Record<string, unknown> | null
  if (!c || typeof c !== 'object') return 'Richiesta non valida'
  if (!Number.isInteger(c.stagione) || (c.stagione as number) < 1 || (c.stagione as number) > 99) return 'Stagione non valida'
  for (const k of ['idp', 'evento']) {
    if (typeof c[k] !== 'string' || !/^[A-Za-z0-9_]{1,40}$/.test(c[k] as string)) return `${k} non valido`
  }
  return null
}

