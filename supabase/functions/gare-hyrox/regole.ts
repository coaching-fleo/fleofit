// Regole pure di `gare-hyrox`: niente import Deno, così i test le provano da
// vitest (src/lib/__tests__/gareHyroxServer.test.js) su una copia vera della
// pagina, salvata in src/lib/__tests__/fixtures/find-my-race.html.
//
// ⚠️ Non esiste un'interfaccia ufficiale: si legge la pagina pubblica
// https://hyrox.com/find-my-race/. L'API JSON di WordPress del sito espone
// gli eventi ma SENZA date (i campi ACF sono vuoti), quindi non basta.
// Se HYROX cambia il tema della pagina, `leggiGare` torna una lista vuota e
// l'app ripiega sul campo libero: nessuna schermata rotta.

export const URL_GARE = 'https://hyrox.com/find-my-race/'

export type Gara = {
  id: string          // il data-id di WordPress: stabile, sopravvive a un cambio di nome
  nome: string
  codice: string      // tre lettere della città (VLC, BUD…), quando c'è
  dal: string         // yyyy-MM-dd
  al: string          // yyyy-MM-dd, uguale a `dal` per una gara di un giorno
  url: string
  continente: string  // 'europe', 'north-america'… dalla classe del riquadro
  citta: string       // il nome senza sponsor e senza «HYROX»: «Valencia», «Hamburg»
  immagine: string    // la foto del riquadro su hyrox.com, '' se manca
  paese: string       // ISO 3166 a due lettere ('ES'), '' se sconosciuto
  paeseNome: string   // l'etichetta inglese del sito ('Spain'), per i paesi senza codice
}

export type Paese = { slug: string, nome: string }

/**
 * Lo slug del filtro «Region/Country» del sito → codice ISO, per bandiera e
 * nome in italiano nel telefono. Un paese che il sito aggiunge e qui manca
 * non rompe niente: arriva senza bandiera, con il nome inglese.
 */
export const ISO_PAESI: Record<string, string> = {
  'argentina': 'AR', 'australia': 'AU', 'austria': 'AT', 'bahrain': 'BH', 'belgium': 'BE',
  'brazil': 'BR', 'bulgaria': 'BG', 'canada': 'CA', 'chile': 'CL', 'china': 'CN',
  'colombia': 'CO', 'costa-rica': 'CR', 'croatia': 'HR', 'czech-republic': 'CZ', 'czechia': 'CZ',
  'denmark': 'DK', 'egypt': 'EG', 'estonia': 'EE', 'finland': 'FI', 'france': 'FR',
  'germany': 'DE', 'greece': 'GR', 'hong-kong': 'HK', 'hungary': 'HU', 'iceland': 'IS',
  'india': 'IN', 'indonesia': 'ID', 'ireland': 'IE', 'israel': 'IL', 'italy': 'IT',
  'japan': 'JP', 'kuwait': 'KW', 'latvia': 'LV', 'lithuania': 'LT', 'luxembourg': 'LU',
  'malaysia': 'MY', 'mexico': 'MX', 'morocco': 'MA', 'netherlands': 'NL', 'new-zealand': 'NZ',
  'norway': 'NO', 'oman': 'OM', 'peru': 'PE', 'philippines': 'PH', 'poland': 'PL',
  'portugal': 'PT', 'qatar': 'QA', 'romania': 'RO', 'rza-south-africa': 'ZA', 'saudi-arabia': 'SA',
  'serbia': 'RS', 'singapore': 'SG', 'slovakia': 'SK', 'slovenia': 'SI', 'south-africa': 'ZA',
  'south-korea': 'KR', 'spain': 'ES', 'sweden': 'SE', 'switzerland': 'CH', 'taiwan': 'TW',
  'thailand': 'TH', 'turkey': 'TR', 'uae': 'AE', 'united-arab-emirates': 'AE', 'united-kingdom': 'GB',
  'uk': 'GB', 'uruguay': 'UY', 'usa': 'US', 'united-states': 'US', 'vietnam': 'VN',
}

const MESI: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
}

/** «17. Oct. 2026» → «2026-10-17». `null` se il formato non è quello atteso. */
export function leggiData(testo: string): string | null {
  const m = /(\d{1,2})\.?\s+([A-Za-z]{3})[a-z]*\.?\s+(\d{4})/.exec(testo || '')
  if (!m) return null
  const mese = MESI[m[2].toLowerCase()]
  if (!mese) return null
  return `${m[3]}-${mese}-${m[1].padStart(2, '0')}`
}

const ENTITA: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' }

/** Le entità HTML di un titolo WordPress («&#8211;», «&amp;»). */
export function decodifica(testo: string): string {
  return testo
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (t, n) => ENTITA[n.toLowerCase()] ?? t)
    .replace(/\s+/g, ' ')
    .trim()
}

/** Il valore del campo personalizzato `classe` dentro un riquadro. */
function campo(riquadro: string, classe: string): string | null {
  const re = new RegExp(`${classe}[^"]*"[^>]*>(?:<span class="w-post-elm-before">[^<]*</span>)?<span class="w-post-elm-value">([^<]*)<`)
  return re.exec(riquadro)?.[1] ?? null
}

/**
 * Le gare ADULTE della pagina, nell'ordine in cui il sito le mostra
 * (cronologico). Restano fuori:
 *  · le Youngstars (gare per ragazzi: l'app segue atleti adulti);
 *  · i riquadri senza data (es. «HYROX New York» annunciata senza giorno):
 *    una gara senza data non si può mettere in calendario;
 *  · i riquadri dei partner, che stanno nella stessa griglia.
 */
export function leggiGare(html: string): Gara[] {
  const riquadri = (html || '').match(/<article class="w-grid-item[^"]*"[^>]*>[\s\S]*?<\/article>/g) || []
  const gare: Gara[] = []
  const visti = new Set<string>()
  for (const r of riquadri) {
    const classi = /class="([^"]*)"/.exec(r)?.[1] || ''
    if (!/\btype-event\b/.test(classi) || !/\btype-adults\b/.test(classi)) continue
    const id = /data-id="(\d+)"/.exec(r)?.[1]
    const titolo = /post_title[^>]*>\s*<a href="([^"]+)">([^<]+)<\/a>/.exec(r)
    const dal = leggiData(campo(r, 'event_date_1') || '')
    if (!id || !titolo || !dal || visti.has(id)) continue
    const al = leggiData(campo(r, 'event_date_3') || '')
    visti.add(id)
    const nome = decodifica(titolo[2])
    gare.push({
      id,
      nome,
      codice: decodifica(campo(r, 'event_city_letter_code') || ''),
      dal,
      // Una fine PRIMA dell'inizio è un refuso del sito: meglio un giorno solo.
      al: al && al >= dal ? al : dal,
      url: titolo[1],
      continente: /\bcontinent-([a-z-]+)/.exec(classi)?.[1] || '',
      citta: citta(nome),
      immagine: /<img[^>]*\ssrc="(https:\/\/[^"]+)"/.exec(r)?.[1] || '',
      paese: '',
      paeseNome: '',
    })
  }
  return gare
}

/**
 * «INTERSPORT HYROX Hamburg» → «Hamburg»: quello che viene dopo l'ultimo
 * «HYROX», cioè senza lo sponsor davanti. Un nome senza «HYROX» resta com'è.
 */
export function citta(nome: string): string {
  const m = /HYROX\s+(.+)$/i.exec(nome || '')
  return (m ? m[1] : nome || '').trim()
}

/** I paesi del filtro «Region/Country» della pagina, con l'etichetta del sito. */
export function leggiPaesi(html: string): Paese[] {
  const re = /<input type="checkbox" value="([a-z0-9-]+)" name="filter_region"><span class="w-filter-item-value-label">([^<]*)</g
  const paesi: Paese[] = []
  for (const m of (html || '').matchAll(re)) {
    if (!paesi.some(p => p.slug === m[1])) paesi.push({ slug: m[1], nome: decodifica(m[2]) })
  }
  return paesi
}

/** Gli id delle gare su una pagina filtrata per paese (`?filter_region=<slug>`). */
export function idDellaPagina(html: string): string[] {
  return leggiGare(html).map(g => g.id)
}

/**
 * Mette il paese su ogni gara, a partire dalle pagine filtrate: `perPaese` è
 * `{ slug: [id…] }`. Una gara che nessuna pagina ha nominato (una richiesta
 * fallita) resta senza paese: niente bandiera, ma c'è.
 */
export function assegnaPaesi(gare: Gara[], paesi: Paese[], perPaese: Record<string, string[]>): Gara[] {
  const diChi = new Map<string, Paese>()
  for (const p of paesi) for (const id of perPaese[p.slug] || []) if (!diChi.has(id)) diChi.set(id, p)
  return gare.map(g => {
    const p = diChi.get(g.id)
    return p ? { ...g, paese: ISO_PAESI[p.slug] || '', paeseNome: p.nome } : g
  })
}
