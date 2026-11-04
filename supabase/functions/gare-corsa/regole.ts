// Regole pure di `gare-corsa`: niente import Deno, così i test le provano da
// vitest (src/lib/__tests__/gareCorsaServer.test.js) su due copie vere della
// pagina, salvate in src/lib/__tests__/fixtures/fidal-cod.html e fidal-reg.html.
//
// ⚠️ Non esiste un'interfaccia ufficiale: si legge la pagina pubblica
// https://www.fidal.it/calendario.php (una per mese e livello, con un
// User-Agent da browser). Se FIDAL cambia la tabella, `leggiGareCorsa` torna
// una lista vuota e l'app ripiega sul campo libero: nessuna schermata rotta.
// Le funzioni Deno non condividono file fuori da `_shared`: `decodifica` è
// copiata da gare-hyrox/regole.ts, non importata.

export const URL_CALENDARIO = 'https://www.fidal.it/calendario.php'

export type Distanza = 'maratona' | 'mezza' | '10k' | '5k' | 'trail' | 'altre'

export type GaraCorsa = {
  id: string          // il codice FIDAL dal link (COD14771, REG45287): stabile
  nome: string        // senza numero d'edizione e senza «Annullata»
  dal: string         // yyyy-MM-dd
  al: string          // yyyy-MM-dd, uguale a `dal` per una gara di un giorno
  tipo: 'strada' | 'trail'
  citta: string
  provincia: string   // la sigla: 'PA'
  regione: string     // slug da PROVINCE, '' se la sigla è sconosciuta
  distanza: Distanza
  livello: 'nazionale' | 'regionale'
  url: string
}

/** Sigla di provincia → slug della regione. Sigla che manca → gara senza regione, non persa. */
export const PROVINCE: Record<string, string> = {}
const REGIONI: Record<string, string> = {
  'piemonte': 'AL AT BI CN NO TO VB VC',
  'valle-d-aosta': 'AO',
  'lombardia': 'BG BS CO CR LC LO MN MI MB PV SO VA',
  'trentino-alto-adige': 'BZ TN',
  'veneto': 'BL PD RO TV VE VR VI',
  'friuli-venezia-giulia': 'GO PN TS UD',
  'liguria': 'GE IM SP SV',
  'emilia-romagna': 'BO FE FC FO MO PR PC RA RE RN',
  'toscana': 'AR FI GR LI LU MS PI PT PO SI',
  'umbria': 'PG TR',
  'marche': 'AN AP FM MC PU',
  'lazio': 'FR LT RI RM VT',
  'abruzzo': 'AQ CH PE TE',
  'molise': 'CB IS',
  'campania': 'AV BN CE NA SA',
  'puglia': 'BA BT BR FG LE TA',
  'basilicata': 'MT PZ',
  'calabria': 'CZ CS KR RC VV',
  'sicilia': 'AG CL CT EN ME PA RG SR TP',
  // SU è la provincia di oggi; VS CI OT OG sono le sigle sarde di prima, che FIDAL può ancora usare.
  'sardegna': 'CA NU OR SS SU VS CI OT OG',
}
for (const [regione, sigle] of Object.entries(REGIONI)) {
  for (const s of sigle.split(' ')) PROVINCE[s] = regione
}

const ENTITA: Record<string, string> = {
  amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ',
  agrave: 'à', egrave: 'è', eacute: 'é', igrave: 'ì', ograve: 'ò', ugrave: 'ù',
}

/** Le entità HTML di una cella («&amp;», «&agrave;», «&#8217;»), spazi ripuliti. */
export function decodifica(testo: string): string {
  return testo
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (t, n) => ENTITA[n.toLowerCase()] ?? t)
    .replace(/\s+/g, ' ')
    .trim()
}

const senzaTag = (html: string) => decodifica(html.replace(/<[^>]*>/g, ' '))

export function urlMese(anno: number, mese: number, livello: 'COD' | 'REG'): string {
  return `${URL_CALENDARIO}?anno=${anno}&mese=${mese}&livello=${livello}&submit=Invia`
}

/** Il mese di `oggi` (yyyy-MM-dd) e i 6 successivi, a cavallo d'anno. */
export function mesiDaLeggere(oggi: string): { anno: number, mese: number }[] {
  const [a, m] = oggi.split('-').map(Number)
  return Array.from({ length: 7 }, (_, i) => {
    const n = (m - 1) + i
    return { anno: a + Math.floor(n / 12), mese: (n % 12) + 1 }
  })
}

/** «Crema (CR)», «Roma RM», «Dakar --» → città e sigla; fuori Italia la sigla è ''. */
export function luogo(testo: string): { citta: string, provincia: string } {
  const t = (testo || '').trim()
  const m = /^(.*?)\s*\(([A-Za-z]{2})\)\s*$/.exec(t) || /^(.*\S)\s+([A-Z]{2})$/.exec(t)
  if (m) return { citta: m[1].trim(), provincia: m[2].toUpperCase() }
  return { citta: t.replace(/\s*--\s*$/, '').trim(), provincia: '' }
}

/** I km scritti nel testo: «10km», «10 km», «10K», «KM 10,700», «Egnazia 9.5». Un intero nudo non conta. */
function kmDichiarati(testo: string): number | null {
  const m = /(\d+(?:[.,]\d+)?)\s*k(?:m)?\b/i.exec(testo)
    || /\bkm\.?\s*(\d+(?:[.,]\d+)?)/i.exec(testo)
    || /(?<![\d.,])(\d+[.,]\d+)(?![\d.,])/.exec(testo)
  return m ? Number(m[1].replace(',', '.')) : null
}

/**
 * La distanza di una gara. Un numero di km esplicito decide per primo; solo
 * senza numero parlano le parole (in quest'ordine: ultra, «metà mezza»,
 * mezza/half/maratonina, maratona/marathon, «ten»). Il tipo trail vince su tutto.
 */
export function distanzaDa(testo: string, tipo: string): Distanza {
  if (/trail/i.test(tipo)) return 'trail'
  const km = kmDichiarati(testo || '')
  if (km !== null) {
    if (km >= 42 && km <= 42.3) return 'maratona'
    if (km >= 21 && km <= 21.2) return 'mezza'
    if (km >= 9.5 && km <= 10.9) return '10k'
    if (km >= 4.5 && km <= 5.9) return '5k'
    return 'altre'
  }
  const t = (testo || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (t.includes('ultra')) return 'altre'
  if (t.includes('meta mezza')) return 'altre'
  if (/mezza|half|maratonina/.test(t)) return 'mezza'
  if (/marathon|maratona/.test(t)) return 'maratona'
  if (/\bten\b/.test(t)) return '10k'
  return 'altre'
}

const RAGAZZI = /\b(kids|giovan|esordient|ragazz|cadett|baby)/i

/** «08/11», «21-22/11», «30/12-02/01» → [dal, al] nell'anno della pagina (la fine può passare al successivo). */
function leggiDate(testo: string, anno: number): [string, string] | null {
  const due = (n: string) => n.padStart(2, '0')
  let g1: string, m1: string, g2: string, m2: string
  let m = /^(\d{1,2})\/(\d{1,2})\s*-\s*(\d{1,2})\/(\d{1,2})$/.exec(testo)
  if (m) [, g1, m1, g2, m2] = m
  else if ((m = /^(\d{1,2})\s*-\s*(\d{1,2})\/(\d{1,2})$/.exec(testo))) { [, g1, g2, m1] = m; m2 = m1 }
  else if ((m = /^(\d{1,2})\/(\d{1,2})$/.exec(testo))) { [, g1, m1] = m; g2 = g1; m2 = m1 }
  else return null
  const dal = `${anno}-${due(m1)}-${due(g1)}`
  let al = `${anno}-${due(m2)}-${due(g2)}`
  if (al < dal) al = `${anno + 1}-${due(m2)}-${due(g2)}`
  return [dal, al]
}

/**
 * Le gare di corsa su strada e trail della pagina (`anno` = quello richiesto:
 * la pagina scrive solo gg/mm). Restano fuori: annullate, cross/pista/indoor/
 * montagna e ogni altro tipo, gare per ragazzi, gare fuori Italia (senza provincia).
 */
export function leggiGareCorsa(html: string, anno: number): GaraCorsa[] {
  const righe = (html || '').match(/<tr>(?:(?!<\/tr>)[\s\S])*?<\/tr>/g) || []
  const gare: GaraCorsa[] = []
  for (const r of righe) {
    const link = /<a href="([^"]*\/calendario\/[^"]*\/((COD|REG)\d+))"[^>]*>([\s\S]*?)<\/a>/.exec(r)
    if (!link) continue
    const celle = [...r.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(c => c[1])
    if (celle.length < 6) continue
    const date = leggiDate(senzaTag(celle[1]), anno)
    const tipoPagina = senzaTag(celle[4]).toUpperCase()
    const tipo = tipoPagina === 'STRADA' ? 'strada' : (tipoPagina === 'TRAIL' || tipoPagina === 'MONTAGNA/TRAIL') ? 'trail' : null
    if (!date || !tipo) continue
    const nomeGrezzo = senzaTag(link[4])
    const sotto = senzaTag(/<font[^>]*>([\s\S]*?)<\/font>/.exec(celle[3])?.[1] || '')
    if (/^annullata\b/i.test(nomeGrezzo) || RAGAZZI.test(`${nomeGrezzo} ${sotto}`)) continue
    const { citta, provincia } = luogo(senzaTag(celle[5]))
    if (!provincia) continue
    const nome = nomeGrezzo.replace(/^[IVXLCDM]+\^?\s+/, '')
    gare.push({
      id: link[2], nome, dal: date[0], al: date[1], tipo, citta, provincia,
      regione: PROVINCE[provincia] || '',
      distanza: distanzaDa(`${nome} ${sotto}`, tipo),
      livello: link[3] === 'COD' ? 'nazionale' : 'regionale',
      url: link[1],
    })
  }
  return gare
}

/** Unisce le liste di più pagine: un id una volta sola, per data poi per nome. */
export function unisci(liste: GaraCorsa[][]): GaraCorsa[] {
  const viste = new Map<string, GaraCorsa>()
  for (const g of liste.flat()) if (!viste.has(g.id)) viste.set(g.id, g)
  return [...viste.values()].sort((a, b) => a.dal.localeCompare(b.dal) || a.nome.localeCompare(b.nome, 'it'))
}
