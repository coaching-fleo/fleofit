// La sfida interna di un team (spec docs/superpowers/specs/2026-11-06-team-design.md §7).
// Tutto puro: nessun import, nessuna rete. Lo usano le pagine del team e il
// foglio RPE, sempre caricato PIGRO (Home sta nel chunk d'ingresso).
//
// Regole:
//   · il verso segue la metrica: tempo minore vince, il resto maggiore;
//   · pari valore = pari posto (1, 1, 3), senza spareggi inventati;
//   · chi non ha inserito il risultato non vale zero: sta in coda, posto null,
//     e si scrive «—»;
//   · un risultato di chi non è più fra i membri (uscito) resta in classifica:
//     chi mostra la riga lo chiama «Ex membro».

export const METRICHE = ['tempo', 'ripetizioni', 'kg', 'distanza']
export const GIORNI_REINVITO = 3
// Gli stessi tetti del trigger team_risultati_regole (supabase/schema/team_2026-11-06.sql).
export const TETTI = { tempo: 86400, ripetizioni: 10000, kg: 100000, distanza: 1000000 }

export const versoDi = (metrica) => (metrica === 'tempo' ? 'minore' : 'maggiore')

const dentroTetto = (n, metrica) => Number.isFinite(n) && n > 0 && n <= TETTI[metrica]

/** Il testo scritto dall'atleta → numero (secondi per il tempo), o null se non vale. */
export function leggiValore(testo, metrica) {
  const t = String(testo ?? '').trim().replace(',', '.')
  if (!t) return null
  let n
  if (metrica === 'tempo') {
    if (/^\d+$/.test(t)) n = Number(t)
    else {
      const parti = t.split(':')
      if (parti.length < 2 || parti.length > 3 || !parti.every(p => /^\d+$/.test(p))) return null
      const num = parti.map(Number)
      // Minuti e secondi dopo il primo campo stanno sotto i 60.
      if (num.slice(1).some(x => x >= 60)) return null
      n = num.reduce((tot, x) => tot * 60 + x, 0)
    }
  } else if (metrica === 'ripetizioni') {
    if (!/^\d+$/.test(t)) return null
    n = Number(t)
  } else {
    if (!/^\d+(\.\d+)?$/.test(t)) return null
    n = Number(t)
  }
  return dentroTetto(n, metrica) ? n : null
}

const due = (x) => String(x).padStart(2, '0')

/** Il numero da mostrare; null → «—», mai uno zero. */
export function scriviValore(valore, metrica) {
  if (valore == null || !Number.isFinite(Number(valore))) return '—'
  const v = Number(valore)
  if (metrica === 'tempo') {
    const s = Math.round(v)
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    return h ? `${h}:${due(m)}:${due(s % 60)}` : `${m}:${due(s % 60)}`
  }
  if (metrica === 'distanza') {
    return v >= 1000
      ? `${(v / 1000).toLocaleString('it-IT', { maximumFractionDigits: 1 })} km`
      : `${Math.round(v)} m`
  }
  const testo = migliaia(v)
  return metrica === 'kg' ? `${testo} kg` : testo
}

// Il locale italiano non separa le migliaia sotto i 10.000 («1250»): qui sì,
// «1.250», così kg e ripetizioni si leggono uguali a ogni grandezza.
function migliaia(v) {
  const arrotondato = Math.round(v * 10) / 10
  const [intero, decimali] = String(arrotondato).split('.')
  const conPunti = intero.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return decimali ? `${conPunti},${decimali}` : conPunti
}

/**
 * L'ordine di una seduta. `membri` sono gli id che devono comparire anche senza
 * risultato; i risultati di chi non è fra i membri restano.
 */
export function ordinaSfida(risultati, membri, metrica) {
  const minore = versoDi(metrica) === 'minore'
  const conValore = (risultati || [])
    .filter(r => Number.isFinite(Number(r?.valore)))
    .map(r => ({ atleta_id: r.atleta_id, valore: Number(r.valore) }))
    .sort((a, b) => (minore ? a.valore - b.valore : b.valore - a.valore))
  const migliore = conValore[0]?.valore
  // Il posto è quello del primo con lo stesso valore: pari valore, pari posto.
  const ordinati = conValore.map((r, _, tutti) => ({
    ...r, posto: tutti.findIndex(x => x.valore === r.valore) + 1, distacco: Math.abs(r.valore - migliore),
  }))
  const presenti = new Set(ordinati.map(r => r.atleta_id))
  const senza = (membri || []).filter(id => !presenti.has(id))
    .map(atleta_id => ({ atleta_id, valore: null, posto: null, distacco: null }))
  return [...ordinati, ...senza]
}

/** Le vittorie di ognuno nelle sfide chiuse: ogni primo posto vale 1. */
export function vittorie(sfideChiuse) {
  const conteggio = new Map()
  for (const s of sfideChiuse || []) {
    for (const r of ordinaSfida(s.risultati, [], s.metrica)) {
      if (r.posto === 1) conteggio.set(r.atleta_id, (conteggio.get(r.atleta_id) || 0) + 1)
    }
  }
  return conteggio
}

/** Il testa a testa fra due atleti: vittorie e seduta per seduta. */
export function testaATesta(sfideChiuse, a, b) {
  let va = 0
  let vb = 0
  const sedute = (sfideChiuse || []).map((s) => {
    const ra = s.risultati?.find(r => r.atleta_id === a)
    const rb = s.risultati?.find(r => r.atleta_id === b)
    if (!ra || !rb || Number(ra.valore) === Number(rb.valore)) {
      return { data: s.data, vincitore: null, distacco: ra && rb ? 0 : null }
    }
    const minore = versoDi(s.metrica) === 'minore'
    const vinceA = minore ? Number(ra.valore) < Number(rb.valore) : Number(ra.valore) > Number(rb.valore)
    if (vinceA) va++
    else vb++
    return { data: s.data, vincitore: vinceA ? a : b, distacco: Math.abs(Number(ra.valore) - Number(rb.valore)) }
  })
  return { a: va, b: vb, sedute }
}

/** Il coach può reinvitare chi ha rifiutato o è uscito? Dopo GIORNI_REINVITO. */
export function puoReinvitare(rispostoIl, adesso = new Date()) {
  if (!rispostoIl) return true
  return adesso.getTime() - new Date(rispostoIl).getTime() >= GIORNI_REINVITO * 86400000
}
