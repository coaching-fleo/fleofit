// Le funzioni delle gare che non sanno nulla di HYROX: date, testo e
// raggruppamenti. Le usano sia le gare HYROX (`gareHyrox.js`) sia le gare di
// corsa, che arrivano dopo. Niente rete, niente cache.

import { format, parseISO, differenceInCalendarDays } from 'date-fns'
import { it } from 'date-fns/locale'

/** «São Paulo» e «sao paulo» devono trovarsi a vicenda. */
export function normalizza(testo) {
  return String(testo || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

/** Le gare non ancora FINITE: una gara di quattro giorni iniziata ieri si può ancora scegliere. */
export function gareFuture(gare, oggi) {
  return (gare || []).filter(g => g.al >= oggi)
}

/** Ogni giorno della gara, da `dal` ad `al` compresi, come yyyy-MM-dd. */
export function giorniGara(gara) {
  if (!gara?.dal) return []
  const giorni = []
  const [a, m, g] = gara.dal.split('-').map(Number)
  const d = new Date(Date.UTC(a, m - 1, g))
  const fine = gara.al && gara.al >= gara.dal ? gara.al : gara.dal
  // Il tetto evita un ciclo lungo su un dato sbagliato: nessuna gara dura un mese.
  for (let i = 0; i < 31; i++) {
    const giorno = d.toISOString().slice(0, 10)
    giorni.push(giorno)
    if (giorno >= fine) break
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return giorni
}

/**
 * Il periodo di una gara in una riga: «17 ott 2026», «15–18 ott 2026»,
 * «28 ott – 1 nov 2026». L'anno compare una volta sola, alla fine.
 */
export function periodoGara(gara) {
  if (!gara?.dal) return ''
  const dal = parseISO(gara.dal)
  const al = parseISO(gara.al && gara.al > gara.dal ? gara.al : gara.dal)
  const f = (d, schema) => format(d, schema, { locale: it })
  if (gara.al <= gara.dal || !gara.al) return f(dal, 'd MMM yyyy')
  if (f(dal, 'yyyy-MM') === f(al, 'yyyy-MM')) return `${f(dal, 'd')}–${f(al, 'd MMM yyyy')}`
  if (f(dal, 'yyyy') === f(al, 'yyyy')) return `${f(dal, 'd MMM')} – ${f(al, 'd MMM yyyy')}`
  return `${f(dal, 'd MMM yyyy')} – ${f(al, 'd MMM yyyy')}`
}

/**
 * I giorni della gara come li mostra il riquadro della data: «15–18» sopra,
 * «ott» sotto. A cavallo di due mesi il numero si accorcia a «28→1» e il mese
 * resta quello d'inizio: il periodo esatto è nella riga sotto la città.
 */
export function blocchettoData(gara) {
  if (!gara?.dal) return { giorni: '', mese: '' }
  const dal = parseISO(gara.dal)
  const al = parseISO(gara.al && gara.al > gara.dal ? gara.al : gara.dal)
  const mese = format(dal, 'MMM', { locale: it })
  if (gara.al <= gara.dal || !gara.al) return { giorni: format(dal, 'd'), mese }
  const sep = format(dal, 'M') === format(al, 'M') ? '–' : '→'
  return { giorni: `${format(dal, 'd')}${sep}${format(al, 'd')}`, mese }
}

/** «In corso», «Oggi», «Domani», «Tra 12 giorni»: quanto manca, rispetto a `oggi`. */
export function quandoGara(gara, oggi) {
  if (!gara?.dal || !oggi) return ''
  const mancano = differenceInCalendarDays(parseISO(gara.dal), parseISO(oggi))
  if (mancano < 0) return gara.al >= oggi ? 'In corso' : ''
  if (mancano === 0) return 'Oggi'
  if (mancano === 1) return 'Domani'
  return `Tra ${mancano} giorni`
}

/**
 * Le gare divise per mese d'inizio, nell'ordine in cui arrivano:
 * `[{ chiave: '2026-10', titolo: 'Ottobre 2026', gare: [...] }]`.
 */
export function perMese(gare) {
  const gruppi = []
  for (const g of gare || []) {
    const chiave = (g.dal || '').slice(0, 7)
    let gruppo = gruppi.find(x => x.chiave === chiave)
    if (!gruppo) {
      const titolo = chiave ? format(parseISO(`${chiave}-01`), 'LLLL yyyy', { locale: it }) : ''
      gruppo = { chiave, titolo: titolo.charAt(0).toUpperCase() + titolo.slice(1), gare: [] }
      gruppi.push(gruppo)
    }
    gruppo.gare.push(g)
  }
  return gruppi
}

/**
 * Il giorno proposto per una gara appena scelta: quello selezionato nel
 * calendario se cade dentro la gara (chi ha toccato il 17 e poi sceglie
 * Valencia 15–18 intende il 17), altrimenti il primo giorno.
 */
export function giornoProposto(gara, selezionato) {
  const giorni = giorniGara(gara)
  return giorni.includes(selezionato) ? selezionato : giorni[0] || selezionato
}
