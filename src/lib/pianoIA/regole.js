// Le regole del metodo che il CODICE controlla sullo scheletro di un piano
// (spec 2026-11-27-pushfit-ai-design.md §5.1 e §5.4). L'IA può proporre
// minuti e fasi; se non rispettano queste regole, non passano.
//
// I parametri di una regola del team (`regole_metodo.parametri`, fase 1)
// sovrascrivono quelli predefiniti.

export const REGOLE_PREDEFINITE = {
  progressioneMax: 0.10,
  scaricoOgni: 4,
  scaricoRiduzione: 0.30,
  taperingGiorni: 10,
  maiDuriConsecutivi: true,
}

// Tolleranza sui confronti fra numeri decimali (200 × 1,1 = 220,00000000000003).
const EPS = 1e-9

export function verificaScheletro(scheletro, regole = REGOLE_PREDEFINITE) {
  const r = { ...REGOLE_PREDEFINITE, ...regole }
  const errori = []
  const righe = Array.isArray(scheletro) ? scheletro : []
  let riferimento = null // l'ultima settimana di carico, per la progressione
  let caricoDiFila = 0

  righe.forEach((s, i) => {
    const prima = righe[i - 1]
    if (s.fase === 'scarico') {
      caricoDiFila = 0
      if (prima && s.minuti > prima.minuti * (1 - r.scaricoRiduzione) + EPS) {
        errori.push({ settimana: s.n, regola: 'scarico', messaggio: `lo scarico deve togliere almeno il ${Math.round(r.scaricoRiduzione * 100)}%` })
      }
      return
    }
    if (s.fase === 'gara') {
      if (prima && s.minuti >= prima.minuti) {
        errori.push({ settimana: s.n, regola: 'tapering', messaggio: 'la settimana della gara deve essere più leggera della precedente' })
      }
      return
    }
    caricoDiFila += 1
    if (caricoDiFila > r.scaricoOgni) {
      errori.push({ settimana: s.n, regola: 'scarico', messaggio: `manca uno scarico dopo ${r.scaricoOgni} settimane di carico` })
    }
    if (riferimento && s.minuti > riferimento.minuti * (1 + r.progressioneMax) + EPS) {
      errori.push({ settimana: s.n, regola: 'progressione', messaggio: `più del ${Math.round(r.progressioneMax * 100)}% rispetto alla settimana ${riferimento.n}` })
    }
    riferimento = s
  })
  return errori
}

/** Due sedute dure in giorni consecutivi (domenica → lunedì compreso). */
export function verificaSettimana(sedute, regole = REGOLE_PREDEFINITE) {
  const r = { ...REGOLE_PREDEFINITE, ...regole }
  if (!r.maiDuriConsecutivi) return []
  const dure = new Set((sedute || []).filter(s => s.dura).map(s => s.giorno))
  const errori = []
  for (const g of [...dure].sort((a, b) => a - b)) {
    const dopo = g === 7 ? 1 : g + 1
    if (dure.has(dopo)) errori.push(`sedute dure di fila: giorno ${g} e giorno ${dopo}`)
  }
  return errori
}
