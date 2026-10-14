// «Come stai oggi» (13/10/2026): quattro risposte da 1 a 5 che l'atleta dà
// prima di allenarsi, una volta al giorno. Tabella `come_stai`
// (supabase/schema/come_stai_2026-10-13.sql).
//
// 🔴 Tutte e quattro le scale vanno nello STESSO verso: 5 è sempre la cosa
// buona (dormito bene, tanta energia, nessun dolore, poco stress). È ciò che
// permette di farne una media — «Come sta», da 1 a 5 — senza girare niente.
// Chi aggiunge una domanda la scrive nello stesso verso, o la media mente.
//
// ⚠️ Una risposta saltata è `null`, non zero, e non entra nella media. Una
// settimana senza risposte è `null` («—»), non «male» (CLAUDE.md §9).

import { supabase } from '../supabaseClient'
import { leggiJson, scriviJson } from './offlineQueue'

// 🔴 Le risposte si mostrano a PAROLE, mai col numero (14/10/2026, richiesta
// del committente): «Dolori 5» si legge «tanti dolori», mentre qui vuol dire
// nessuno. Il numero resta solo nel dato salvato e nella media. `scelte[0]`
// vale 1, `scelte[4]` vale 5 — la cosa buona, sempre a destra.
export const DOMANDE = [
  { chiave: 'sonno', titolo: 'Sonno', scelte: ['Pessimo', 'Scarso', 'Così così', 'Buono', 'Ottimo'] },
  { chiave: 'energia', titolo: 'Energia', scelte: ['A terra', 'Poca', 'Normale', 'Tanta', 'Al top'] },
  { chiave: 'dolori', titolo: 'Dolori muscolari', scelte: ['Molti', 'Parecchi', 'Qualcuno', 'Pochi', 'Nessuno'] },
  { chiave: 'stress', titolo: 'Stress', scelte: ['Molto alto', 'Alto', 'Normale', 'Basso', 'Nessuno'] },
]

/**
 * Il colore di una risposta, dal rosso (1) al verde (5): lo stesso nel foglio
 * dell'atleta e nel riepilogo del coach, così una tacca rossa vuol dire la
 * stessa cosa in tutti e due. Classi intere, perché Tailwind le trovi.
 */
export const TONI_RISPOSTA = [
  { sfondo: 'bg-red-500', testo: 'text-white' },
  { sfondo: 'bg-orange-500', testo: 'text-black' },
  { sfondo: 'bg-brand', testo: 'text-black' },
  { sfondo: 'bg-lime-400', testo: 'text-black' },
  { sfondo: 'bg-green-500', testo: 'text-black' },
]

/** La parola di una risposta (1–5), o `null` se manca. */
export const parolaRisposta = (domanda, valore) =>
  (Number.isInteger(valore) && valore >= 1 && valore <= 5 ? domanda.scelte[valore - 1] : null)

const arrotonda = (n) => Math.round(n * 10) / 10

/** La media delle risposte date, con un decimale. `null` se non ce n'è nessuna. */
export function punteggio(riga) {
  if (!riga) return null
  const date = DOMANDE.map(d => riga[d.chiave]).filter(v => typeof v === 'number')
  return date.length ? arrotonda(date.reduce((a, b) => a + b, 0) / date.length) : null
}

/** Tre fasce per leggerlo a colpo d'occhio. Il colore lo sceglie chi disegna. */
export function fasciaComeStai(valore) {
  if (valore == null) return null
  if (valore >= 4) return { chiave: 'bene', etichetta: 'Bene' }
  if (valore >= 3) return { chiave: 'cosi', etichetta: 'Così così' }
  return { chiave: 'male', etichetta: 'Non bene' }
}

const media = (valori) => (valori.length ? arrotonda(valori.reduce((a, b) => a + b, 0) / valori.length) : null)

/** La media della squadra (o delle righe passate) settimana per settimana. */
export function comeStaiPerSettimana(righe = [], settimane = []) {
  return settimane.map(s => ({
    chiave: s.chiave,
    valore: media(righe
      .filter(r => r?.giorno >= s.da && r.giorno <= s.a)
      .map(punteggio).filter(v => v != null)),
  }))
}

/** La media di un atleta su tutto il periodo. */
export function mediaComeStaiPer(righe = [], atletaId, settimane = []) {
  if (!settimane.length) return null
  const da = settimane[0].da
  const a = settimane[settimane.length - 1].a
  return media(righe
    .filter(r => r?.athlete_id === atletaId && r.giorno >= da && r.giorno <= a)
    .map(punteggio).filter(v => v != null))
}

/**
 * Si chiede una volta al giorno: non se ha già risposto oggi, non se oggi ha
 * scelto «Salta». `risposta === undefined` vuol dire «non lo so ancora» (lettura
 * in corso, tabella assente, rete giù): in quel caso non si chiede, perché un
 * foglio che compare a sproposito davanti al timer è peggio di una domanda persa.
 */
export function daChiedereOggi({ risposta, saltato, oggi }) {
  if (risposta === undefined) return false
  if (risposta) return false
  return saltato !== oggi
}

// ── Il giorno saltato: una memoria del dispositivo ─────────────────────────

/** Chiave localStorage: il giorno in cui l'atleta ha scelto «Salta» (CLAUDE.md §8). */
export const CHIAVE_SALTATO = 'fleofit_come_stai_saltato'
export const leggiSaltato = () => leggiJson(CHIAVE_SALTATO, null)
export const segnaSaltato = (giorno) => scriviJson(CHIAVE_SALTATO, giorno)

// ── Rete ───────────────────────────────────────────────────────────────────

/** La tabella non c'è (migrazione non applicata): non è un errore da mostrare. */
const tabellaAssente = (error) => error && (error.code === '42P01' || error.code === 'PGRST205')

/**
 * La risposta di un atleta per un giorno.
 * Torna la riga, `null` se non ha risposto, `undefined` se non si può sapere
 * (tabella assente o lettura fallita): vedi `daChiedereOggi`.
 */
export async function leggiComeStai(athleteId, giorno) {
  const { data, error } = await supabase.from('come_stai')
    .select('id, athlete_id, giorno, sonno, energia, dolori, stress')
    .eq('athlete_id', athleteId).eq('giorno', giorno)
    .maybeSingle()
  if (error) {
    if (!tabellaAssente(error)) console.error('Come stai, lettura fallita:', error)
    return undefined
  }
  return data ?? null
}

/** Salva (o aggiorna) la risposta del giorno. Torna `true` se è andata. */
export async function salvaComeStai(athleteId, giorno, risposte) {
  const riga = { athlete_id: athleteId, giorno }
  for (const d of DOMANDE) riga[d.chiave] = risposte[d.chiave] ?? null
  if (punteggio(riga) == null) return false
  const { error } = await supabase.from('come_stai').upsert(riga, { onConflict: 'athlete_id,giorno' })
  if (error) console.error('Come stai, salvataggio fallito:', error)
  return !error
}

const PAGINA = 1000

/**
 * Tutte le risposte fra due giorni, per la pagina Analisi. `[]` se la tabella non c'è.
 * 🔴 A PAGINE, come `leggiAssegnazioni` in Analisi.jsx: il server restituisce al
 * massimo mille righe senza dirlo, e su 26 settimane tre atleti costanti le superano.
 */
export async function leggiComeStaiFra(da, a) {
  const tutte = []
  for (let pagina = 0; ; pagina++) {
    const { data, error } = await supabase.from('come_stai')
      .select('athlete_id, giorno, sonno, energia, dolori, stress')
      .gte('giorno', da).lte('giorno', a)
      .order('giorno', { ascending: true })
      .order('athlete_id', { ascending: true })
      .range(pagina * PAGINA, pagina * PAGINA + PAGINA - 1)
    if (error) {
      if (!tabellaAssente(error)) console.error('Come stai, lettura fallita:', error)
      return []
    }
    tutte.push(...(data || []))
    if (!data || data.length < PAGINA) return tutte
  }
}
