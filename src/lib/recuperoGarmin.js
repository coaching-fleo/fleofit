// Garmin · Recupero (29/10/2026): i segnali e le serie a 28 giorni, dalle righe
// di `garmin_giornate` (docs/memoria/garmin.md). Logica pura + due letture.
//
// 🔴 Il riferimento è PERSONALE: la media dei 28 giorni PRIMA della fila di
// giorni sotto esame (così il calo non abbassa la sua stessa media), e conta
// solo se ha almeno 14 valori. Il sonno sotto 6 ore è una soglia fissa, non
// ha bisogno del riferimento. Tutte le date sono giorni di calendario in Italia.

export const GIORNI_RIFERIMENTO = 28
export const MINIMO_GIORNI = 14
export const GIORNI_DI_FILA = 3
export const SCARTO_HRV = 0.10
export const SCARTO_FC = 5
export const ORE_SONNO = 6
const FILA_MASSIMA = 14

export const METRICHE = [
  { chiave: 'sonno', etichetta: 'Sonno', unita: 'h', leggi: r => r.sonno?.ore },
  { chiave: 'hrv', etichetta: 'HRV notturna', unita: 'ms', leggi: r => r.hrv?.media_notte },
  { chiave: 'fc', etichetta: 'FC a riposo', unita: 'bpm', leggi: r => r.giornata?.fc_riposo },
]

const numero = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/** Il giorno di oggi in Italia, `yyyy-MM-dd`. */
export function oggiItalia(adesso = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(adesso)
}

/** Somma giorni di calendario a un `yyyy-MM-dd` (in UTC: niente ora legale di mezzo). */
function aggiungiGiorni(giorno, n) {
  const [a, m, g] = giorno.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, g + n)).toISOString().slice(0, 10)
}

const mediaDi = (valori) => valori.reduce((x, y) => x + y, 0) / valori.length

/** `Map giorno → valore` di una metrica (se un giorno ha più righe vale l'ultima con un dato). */
function valoriPer(righe, metrica) {
  const m = new Map()
  for (const r of righe || []) {
    const v = numero(metrica.leggi(r))
    if (v != null && r.giorno) m.set(r.giorno, v)
  }
  return m
}

const metrica = (chiave) => METRICHE.find(m => m.chiave === chiave)

/** I 28 giorni che finiscono oggi, per ogni metrica, e la media se i valori sono almeno 14. */
export function serieRecupero(righe, oggi = new Date()) {
  const fine = oggiItalia(oggi)
  const giorni = Array.from({ length: GIORNI_RIFERIMENTO }, (_, i) => aggiungiGiorni(fine, i - (GIORNI_RIFERIMENTO - 1)))
  const out = {}
  for (const m of METRICHE) {
    const v = valoriPer(righe, m)
    const punti = giorni.map(giorno => ({ giorno, valore: v.has(giorno) ? v.get(giorno) : null }))
    const presenti = punti.map(p => p.valore).filter(x => x != null)
    out[m.chiave] = { punti, media: presenti.length >= MINIMO_GIORNI ? mediaDi(presenti) : null }
  }
  return out
}

/**
 * La fila più lunga (da 3 a 14 giorni) che finisce nell'ultimo giorno con un
 * dato, se quel giorno è oggi o ieri. `riferimento(inizioFila)` torna la
 * media da usare, o `null` se non c'è: allora quella fila non vale.
 * `soglia(valore, media)` dice se un giorno è «storto».
 */
function filaFinoAdOggi(valori, fine, soglia, riferimento) {
  if (!valori.size) return 0
  const ultimo = [...valori.keys()].filter(g => g <= fine).sort().pop()
  if (!ultimo || ultimo < aggiungiGiorni(fine, -1)) return 0
  for (let k = FILA_MASSIMA; k >= GIORNI_DI_FILA; k--) {
    const inizio = aggiungiGiorni(ultimo, -(k - 1))
    const ref = riferimento(inizio)
    if (ref === undefined) continue
    let tutti = true
    for (let i = 0; i < k && tutti; i++) {
      const v = valori.get(aggiungiGiorni(inizio, i))
      tutti = v != null && soglia(v, ref)
    }
    if (tutti) return k
  }
  return 0
}

/** La media dei 28 giorni prima di `inizio`; `undefined` se i valori sono meno di 14. */
function riferimentoPrima(valori, inizio) {
  const v = []
  for (let i = 1; i <= GIORNI_RIFERIMENTO; i++) {
    const x = valori.get(aggiungiGiorni(inizio, -i))
    if (x != null) v.push(x)
  }
  return v.length >= MINIMO_GIORNI ? mediaDi(v) : undefined
}

/** I segnali di UN atleta: HRV bassa, FC a riposo alta, poco sonno, da almeno 3 giorni di fila. */
export function segnaliRecupero(righe, oggi = new Date()) {
  const fine = oggiItalia(oggi)
  const segnali = []

  const hrv = valoriPer(righe, metrica('hrv'))
  const nHrv = filaFinoAdOggi(hrv, fine, (v, media) => v < media * (1 - SCARTO_HRV), (i) => riferimentoPrima(hrv, i))
  if (nHrv) segnali.push({ tipo: 'hrv', giorni: nHrv, testo: `HRV sotto la sua media da ${nHrv} notti` })

  const fc = valoriPer(righe, metrica('fc'))
  const nFc = filaFinoAdOggi(fc, fine, (v, media) => v > media + SCARTO_FC, (i) => riferimentoPrima(fc, i))
  if (nFc) segnali.push({ tipo: 'fc', giorni: nFc, testo: `FC a riposo sopra la sua media da ${nFc} giorni` })

  const sonno = valoriPer(righe, metrica('sonno'))
  const nSonno = filaFinoAdOggi(sonno, fine, (v) => v < ORE_SONNO, () => null)
  if (nSonno) segnali.push({ tipo: 'sonno', giorni: nSonno, testo: `Dorme meno di ${ORE_SONNO} ore da ${nSonno} notti` })

  return segnali
}

const nomeAtleta = (a) => a?.nome || [a?.name, a?.surname].filter(Boolean).join(' ').trim() || 'Atleta'

/** Gli atleti (come li passa la Home del coach) con almeno un segnale. Le righe sono di tutti. */
export function segnaliTeam(atleti, righe, oggi = new Date()) {
  const perAtleta = new Map()
  for (const r of righe || []) {
    if (!perAtleta.has(r.athlete_id)) perAtleta.set(r.athlete_id, [])
    perAtleta.get(r.athlete_id).push(r)
  }
  const out = []
  for (const a of atleti || []) {
    const segnali = segnaliRecupero(perAtleta.get(a.id) || [], oggi)
    if (segnali.length) out.push({ id: a.id, nome: nomeAtleta(a), foto: a.photo_url || a.foto || null, segnali })
  }
  return out
}

// ── Rete ───────────────────────────────────────────────────────────────────

const PAGINA = 1000
const COLONNE = 'athlete_id, giorno, giornata, sonno, hrv'
const tabellaAssente = (error) => error && (error.code === '42P01' || error.code === 'PGRST205')

async function leggiAPagine(costruisci) {
  const tutte = []
  for (let pagina = 0; ; pagina++) {
    const { data, error } = await costruisci()
      .order('giorno', { ascending: true })
      .order('athlete_id', { ascending: true })
      .range(pagina * PAGINA, pagina * PAGINA + PAGINA - 1)
    if (error) {
      if (!tabellaAssente(error)) console.error('Garmin, lettura giornate fallita:', error)
      return []
    }
    tutte.push(...(data || []))
    if (!data || data.length < PAGINA) return tutte
  }
}

/** Le giornate di un atleta fra due giorni. `[]` se la tabella non c'è o la lettura fallisce. */
export const leggiGiornate = (supabase, athleteId, da, a) =>
  leggiAPagine(() => supabase.from('garmin_giornate').select(COLONNE)
    .eq('athlete_id', athleteId).gte('giorno', da).lte('giorno', a))

/** Le giornate di tutti gli atleti visibili fra due giorni (la RLS filtra per coach). */
export const leggiGiornateFra = (supabase, da, a) =>
  leggiAPagine(() => supabase.from('garmin_giornate').select(COLONNE)
    .gte('giorno', da).lte('giorno', a))
