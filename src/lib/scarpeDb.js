// «Scarpe da corsa»: lettura e scrittura di `scarpe_catalogo`, `scarpe_atleta`
// e `scarpe_uso` (docs/superpowers/specs/2026-11-02-scarpe-design.md §3-§4).
//
// Perché esiste: tiene in un posto solo ciò che l'app chiede al database per le
// scarpe, così le schermate non conoscono i nomi delle colonne. Regole:
//   · i km NON stanno nel database: si calcolano qui (km_iniziali + usi, con
//     `kmScarpa`/`kmAllenamento` di kmScarpe.js);
//   · tabelle assenti (migrazione non applicata: 42P01/PGRST205) = «funzione non
//     disponibile», mai un errore: la lettura torna `{ disponibile: false }`;
//   · ogni numero scritto dall'utente passa da `numeroKm`, e una soglia ≤ 0 si
//     rifiuta PRIMA dell'update (`statoScarpa` non la guarda);
//   · il titolo degli allenamenti torna com'è salvato: la pulizia (separaCodice)
//     la fa l'interfaccia.

import { supabase } from '../supabaseClient'
import { kmAllenamento, kmScarpa, statoScarpa, SOGLIA_PREDEFINITA, numeroKm } from './kmScarpe'

// `numeroKm` vive in kmScarpe.js (senza il client Supabase); da qui resta con lo stesso nome.
export { numeroKm }

const CATALOGO = 'scarpe_catalogo'
const SCARPE = 'scarpe_atleta'
const USI = 'scarpe_uso'
const ALLENAMENTI = 'athlete_workouts'
const ATTIVITA = 'garmin_attivita'

/** La tabella non c'è (migrazione non applicata): non è un errore da mostrare. */
export const tabelleAssenti = (error) =>
  !!error && (error.code === '42P01' || error.code === 'PGRST205')

// ── Catalogo ────────────────────────────────────────────────────────────────

/** Il catalogo, per marca poi modello. */
export async function elencoCatalogo() {
  const { data, error } = await supabase
    .from(CATALOGO)
    .select('*')
    .order('marca', { ascending: true })
    .order('modello', { ascending: true })
  if (error) throw error
  return data || []
}

export async function salvaModelloCatalogo({ marca, modello, tipo, drop_mm }) {
  const m = String(marca ?? '').trim()
  const mod = String(modello ?? '').trim()
  if (!m || !mod) throw new Error('Marca e modello sono obbligatori.')
  const drop = drop_mm === undefined || drop_mm === null || drop_mm === '' ? null : numeroKm(drop_mm)
  const { data, error } = await supabase
    .from(CATALOGO)
    .insert({ marca: m, modello: mod, tipo: tipo || null, drop_mm: drop })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function aggiornaModelloCatalogo(id, campi = {}) {
  const { data, error } = await supabase.from(CATALOGO).update(campi).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function eliminaModelloCatalogo(id) {
  const { error } = await supabase.from(CATALOGO).delete().eq('id', id)
  if (error) throw error
}

// ── Scarpe dell'atleta ──────────────────────────────────────────────────────

/**
 * Le scarpe di un atleta con i km e gli allenamenti fatti. Esattamente quattro
 * letture (scarpe, usi, allenamenti, attività dell'orologio). Con le tabelle
 * assenti torna `{ disponibile: false, scarpe: [] }`; ogni altro errore lancia.
 */
export async function leggiScarpeAtleta(athleteId) {
  const { data: righe, error } = await supabase
    .from(SCARPE).select('*').eq('athlete_id', athleteId).order('creato_at', { ascending: true })
  if (error) {
    if (tabelleAssenti(error)) return { disponibile: false, scarpe: [] }
    throw error
  }
  const scarpe = righe || []
  if (!scarpe.length) return { disponibile: true, scarpe: [] }

  const { data: usi, error: erroreUsi } = await supabase
    .from(USI).select('athlete_workout_id, scarpa_id').in('scarpa_id', scarpe.map(s => s.id))
  if (erroreUsi) {
    if (tabelleAssenti(erroreUsi)) return { disponibile: false, scarpe: [] }
    throw erroreUsi
  }
  const idAw = (usi || []).map(u => u.athlete_workout_id)

  let allenamenti = []
  let attivita = []
  if (idAw.length) {
    const { data: aw, error: erroreAw } = await supabase
      .from(ALLENAMENTI).select('id, status, completed_date, workouts(title, sections)').in('id', idAw)
    if (erroreAw) throw erroreAw
    allenamenti = aw || []
    const { data: att, error: erroreAtt } = await supabase
      .from(ATTIVITA).select('athlete_workout_id, distanza_m').in('athlete_workout_id', idAw)
    if (erroreAtt) {
      if (!tabelleAssenti(erroreAtt)) throw erroreAtt
    } else attivita = att || []
  }
  // Solo gli allenamenti COMPLETATI: un uso rimasto su uno tornato «da fare»
  // (annulla offline, il coach che lo riapre, una togliScarpa fallita) non
  // compare e non conta nei km.
  const perAw = Object.fromEntries(allenamenti.filter(a => a.status === 'completed').map(a => [a.id, a]))
  const perAtt = Object.fromEntries(attivita.map(a => [a.athlete_workout_id, a]))

  return {
    disponibile: true,
    scarpe: scarpe.map((s) => {
      const suoi = (usi || [])
        .filter(u => u.scarpa_id === s.id && perAw[u.athlete_workout_id])
        .map((u) => {
          const aw = perAw[u.athlete_workout_id]
          const k = kmAllenamento(aw?.workouts?.sections, perAtt[u.athlete_workout_id])
          return {
            athlete_workout_id: u.athlete_workout_id,
            data: aw?.completed_date ?? null,
            titolo: aw?.workouts?.title ?? '',
            km: k ? k.km : null,
            fonte: k ? k.fonte : null,
          }
        })
      const km = kmScarpa(s, suoi.map(u => u.km))
      return { ...s, km, stato: statoScarpa(km, s.soglia_km), usi: suoi }
    }),
  }
}

/**
 * Aggiunge una scarpa: dal catalogo (marca/modello si COPIANO, così sopravvive
 * al modello tolto) oppure scritta a mano. Km di partenza non validi: rifiuta
 * prima di ogni insert.
 */
export async function aggiungiScarpa({ athleteId, catalogo, marca, modello, kmIniziali, principale }) {
  const km = numeroKm(kmIniziali)
  if (km === null) throw new Error('I km di partenza non sono validi.')
  const m = String(catalogo?.marca ?? marca ?? '').trim()
  const mod = String(catalogo?.modello ?? modello ?? '').trim()
  if (!m || !mod) throw new Error('Marca e modello sono obbligatori.')
  const { data, error } = await supabase
    .from(SCARPE)
    .insert({
      athlete_id: athleteId,
      catalogo_id: catalogo?.id ?? null,
      marca: m,
      modello: mod,
      km_iniziali: km,
      soglia_km: SOGLIA_PREDEFINITA,
      principale: false,
    })
    .select()
    .single()
  if (error) throw error
  if (principale) await rendiPrincipale(athleteId, data.id)
  return data
}

/** Cambia soglia e/o km di partenza; valori non validi (soglia ≤ 0) si rifiutano. */
export async function aggiornaScarpa(id, { soglia_km, km_iniziali } = {}) {
  const dati = {}
  if (soglia_km !== undefined) {
    const s = numeroKm(soglia_km)
    if (!(s > 0)) throw new Error('La soglia deve essere maggiore di zero.')
    dati.soglia_km = s
  }
  if (km_iniziali !== undefined) {
    const k = numeroKm(km_iniziali)
    if (k === null) throw new Error('I km di partenza non sono validi.')
    dati.km_iniziali = k
  }
  const { data, error } = await supabase.from(SCARPE).update(dati).eq('id', id).select().single()
  if (error) throw error
  return data
}

/** Ritira la scarpa e, se era la principale, le toglie il ruolo. */
export async function ritiraScarpa(id) {
  const { error } = await supabase
    .from(SCARPE).update({ ritirata_at: new Date().toISOString(), principale: false }).eq('id', id)
  if (error) throw error
}

/**
 * Una sola principale attiva (indice unico): prima si toglie la vecchia, poi si
 * mette la nuova. Se la seconda scrittura fallisce si prova a rimettere la
 * vecchia (senza garanzie: è la stessa rete che ha appena fallito), poi si lancia.
 */
export async function rendiPrincipale(athleteId, id) {
  const { data: vecchie, error: e1 } = await supabase
    .from(SCARPE).update({ principale: false }).eq('athlete_id', athleteId).eq('principale', true).select('id')
  if (e1) throw e1
  const { error: e2 } = await supabase.from(SCARPE).update({ principale: true }).eq('id', id)
  if (e2) {
    const vecchia = (vecchie || []).find(v => v.id !== id)?.id
    if (vecchia) {
      const { error: e3 } = await supabase.from(SCARPE).update({ principale: true }).eq('id', vecchia)
      if (e3) console.warn('Principale di prima non rimessa:', e3)
    }
    throw e2
  }
}

// ── Uso per allenamento ─────────────────────────────────────────────────────

export async function assegnaScarpa(athleteWorkoutId, scarpaId) {
  const { error } = await supabase
    .from(USI)
    .upsert({ athlete_workout_id: athleteWorkoutId, scarpa_id: scarpaId }, { onConflict: 'athlete_workout_id' })
  if (error) throw error
}

export async function togliScarpa(athleteWorkoutId) {
  const { error } = await supabase.from(USI).delete().eq('athlete_workout_id', athleteWorkoutId)
  if (error) throw error
}

// ── Per i coach: cosa scrivono gli atleti a mano ────────────────────────────

const chiave = (t) => String(t ?? '').trim().replace(/\s+/g, ' ').toLowerCase()

/**
 * Le scarpe scritte a mano dagli atleti (senza `catalogo_id`), raggruppate senza
 * badare a maiuscole e spazi: serve al coach per decidere cosa aggiungere al catalogo.
 */
export async function scritteDagliAtleti() {
  const { data, error } = await supabase.from(SCARPE).select('marca, modello').is('catalogo_id', null)
  if (error) throw error
  const gruppi = new Map()
  for (const r of data || []) {
    if (!chiave(r.marca) || !chiave(r.modello)) continue
    const k = `${chiave(r.marca)}|${chiave(r.modello)}`
    const g = gruppi.get(k)
    if (g) g.quante += 1
    else gruppi.set(k, {
      marca: String(r.marca).trim().replace(/\s+/g, ' '),
      modello: String(r.modello).trim().replace(/\s+/g, ' '),
      quante: 1,
    })
  }
  return [...gruppi.values()].sort((a, b) => b.quante - a.quante)
}
