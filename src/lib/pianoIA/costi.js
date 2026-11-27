// Quanto costano le chiamate all'IA (spec §8.1 e §9).
//
// Prezzi in $ per MILIONE di token, di listino. `in` = ingresso fuori cache,
// `cache` = ingresso letto dalla cache, `out` = uscita (il ragionamento del
// modello si paga come uscita). Batch = −50% su tutto.
// ⚠️ I prezzi cambiano: si aggiornano qui, e il test della spec dice se il
// costo per utente è uscito dalla forbice prevista.

export const PREZZI = {
  // Anthropic, listino novembre 2026.
  'claude-haiku-5-5': { in: 0.10, out: 0.50, cache: 0.10 },
  'claude-sonnet-5-5': { in: 2, out: 10, cache: 0.10 },
  'claude-opus-5-5': { in: 4, out: 20, cache: 0.20 },
  // Groq, da siti di confronto (27/11/2026), da riverificare sul listino ufficiale.
  'openai/gpt-oss-120b': { in: 0.15, out: 0.60, cache: 0.15 },
}

const MILIONE = 1_000_000

export function costoChiamata({ modello, tokenIn, tokenInCache = 0, tokenOut, batch = false }) {
  const p = PREZZI[modello]
  if (!p) throw new Error(`Prezzo sconosciuto per il modello ${modello}`)
  const costo = (tokenIn * p.in + tokenInCache * p.cache + tokenOut * p.out) / MILIONE
  return batch ? costo / 2 : costo
}

/** Le ipotesi della spec §9.1, per un abbonato con 4 sedute a settimana. */
export const IPOTESI_SPEC = {
  modelli: { forte: 'claude-sonnet-5-5', leggero: 'claude-haiku-5-5' },
  seduteMese: 17,
  settimaneMese: 4.3,
  quotaRete: 0.2,
  // La rete di sicurezza costa 2,5 volte la revisione: 1,5 in più.
  extraRete: 1.5,
  rifacimenti: 0.2,
  mesiFraPiani: 2,
  adattamento: { in: 10_000, cache: 20_000, out: 12_000 },
  revisione: { in: 10_000, cache: 15_000, out: 8_000 },
  analisi: { in: 6_000, out: 1_500 },
}

export function costoMensileUtente(i) {
  const chiamata = (modello, t, batch = false) =>
    costoChiamata({ modello, tokenIn: t.in, tokenInCache: t.cache || 0, tokenOut: t.out, batch })
  const adattamento = chiamata(i.modelli.forte, i.adattamento) / i.mesiFraPiani
  const revisione = chiamata(i.modelli.forte, i.revisione, true) * i.settimaneMese * (1 + i.rifacimenti)
  const rete = revisione * i.extraRete * i.quotaRete
  const analisi = chiamata(i.modelli.leggero, i.analisi) * i.seduteMese
  const voci = { adattamento, revisione, rete, analisi }
  return { voci, totale: adattamento + revisione + rete + analisi }
}
