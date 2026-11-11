// riepilogoCoach.js — i conti della Home coach «Riepilogo» (10/11/2026).
//
// La Riepilogo mostra NUMERI e lascia le persone dietro ogni numero, così la
// Home ha la stessa lunghezza con 11 o con 500 atleti
// (docs/superpowers/specs/2026-11-10-home-coach-riepilogo-design.md).
// Funzioni pure sopra ciò che il cruscotto calcola già: `oggiConComeSta` e
// `pianoGiorni` di cruscottoCoach.js. Chi è in pausa è già fuori da lì.

/** L'ordine fisso delle categorie nella barra di oggi. Le gare non ci sono: non sono allenamenti. */
export const CATEGORIE_RIEPILOGO = ['Hyrox', 'Running', 'Gym', 'Custom']

/** Quanti da fare, in corso e fatti fra le righe di oggi. */
export function oggiPerStato(righe = []) {
  let daFare = 0, inCorso = 0, fatti = 0
  for (const r of righe) {
    if (r.stato === 'completato') fatti++
    else if (r.stato === 'in corso') inCorso++
    else daFare++
  }
  return { daFare, inCorso, fatti, totale: righe.length }
}

/** [categoria, quanti] nell'ordine di CATEGORIE_RIEPILOGO, solo quelle presenti. */
export function oggiPerCategoria(righe = []) {
  return CATEGORIE_RIEPILOGO
    .map(c => [c, righe.filter(r => r.categoria === c).length])
    .filter(([, n]) => n > 0)
}

const RANGO = { 'in corso': 1, 'da fare': 2, completato: 3 }

/** L'ordine della fila di oggi: chi sta male, in corso, da fare, fatti; poi per nome. */
export function ordinaOggi(righe = []) {
  const rango = (r) => (r.allarme ? 0 : RANGO[r.stato] ?? 2)
  return [...righe].sort((a, b) => rango(a) - rango(b) || (a.nome || '').localeCompare(b.nome || ''))
}

/**
 * Per ogni giorno del piano: chi ha già qualcosa (anche solo una gara) e chi è
 * da programmare. Da programmare vale solo per i giorni FUTURI: oggi è «chi si
 * allena», il passato era riposo.
 */
export function giorniDaProgrammare(piano) {
  if (!piano) return []
  return piano.giorni.map((g, i) => {
    const programmati = [], daProgrammare = []
    const conti = new Map()
    for (const r of piano.righe) {
      const c = r.celle[i]
      if (!c) continue
      if (c.chips.length > 0) {
        programmati.push(r)
        for (const ch of c.chips) conti.set(ch.categoria, (conti.get(ch.categoria) || 0) + 1)
      } else if (c.quando === 'futuro') daProgrammare.push(r)
    }
    const ordine = [...CATEGORIE_RIEPILOGO, 'Event']
    const perCategoria = [...conti.entries()].sort((a, b) => ordine.indexOf(a[0]) - ordine.indexOf(b[0]))
    return { ...g, programmati, daProgrammare, perCategoria }
  })
}

/**
 * Gli atleti con almeno un giorno vuoto fra domani e i `giorni` dopo, con il
 * primo giorno scoperto (dove porta «Programma»).
 */
export function scopertiTreGiorni(piano, { giorni = 3 } = {}) {
  if (!piano) return []
  const risultato = []
  for (const r of piano.righe) {
    const scoperti = r.celle.slice(1, giorni + 1)
      .filter(c => c.quando === 'futuro' && c.chips.length === 0)
      .map(c => c.data)
    if (scoperti.length) risultato.push({ ...r, primoScoperto: scoperti[0], scoperti })
  }
  return risultato
}

const semplice = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

/** La ricerca del foglio: senza accenti e senza maiuscole. Testo vuoto = tutti. */
export function filtraPerNome(persone = [], testo = '') {
  const t = semplice(testo)
  if (!t) return persone
  return persone.filter(p => semplice(p.nome).includes(t))
}

/** Oltre quante righe il calendario della Home si taglia (11/11/2026). */
export const MASSIMO_CALENDARIO = 20

/**
 * Le righe del calendario della Home. Fino a `massimo` atleti tutte, nell'ordine
 * del piano. Oltre: prima chi ha un giorno vuoto fra domani e i `giorni` dopo
 * (quelli da programmare adesso), poi gli altri, e solo le prime `massimo`.
 * `nascoste` è quante ne restano fuori: le mostra «Mostra tutti».
 */
export function righeCalendario(piano, { massimo = MASSIMO_CALENDARIO, giorni = 3 } = {}) {
  const tutte = piano?.righe || []
  if (tutte.length <= massimo) return { righe: tutte, nascoste: 0 }
  return { righe: primaGliScoperti(tutte, { giorni }).slice(0, massimo), nascoste: tutte.length - massimo }
}

/** Prima chi ha un giorno vuoto fra domani e i `giorni` dopo, poi gli altri; nell'ordine di prima dentro ciascun gruppo. */
export function primaGliScoperti(righe = [], { giorni = 3 } = {}) {
  const scoperto = (r) => r.celle.slice(1, giorni + 1).some(c => c.quando === 'futuro' && c.chips.length === 0)
  return [...righe.filter(scoperto), ...righe.filter(r => !scoperto(r))]
}
