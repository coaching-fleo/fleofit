// Cestino dei workout: lettura della tabella `cestino_workout` e ripristino
// (19/11/2026, supabase/schema/cestino_workout_2026-11-19.sql, docs/memoria/cestino.md).
//   · tabella assente (migrazione non ancora applicata: 42P01, PGRST205) =
//     `disponibile: false`, e le schermate nascondono tutto senza alert;
//   · la colonna `copia` (jsonb, può essere grande) non si chiede mai nella
//     lista: le voci del ripristino arrivano da `cestino_voci`;
//   · chi vede cosa lo decide la policy, non l'app.

import { supabase } from '../supabaseClient'

const TABELLA = 'cestino_workout'
const COLONNE = 'id, workout_id, titolo, data_workout, creato_da, eliminato_da, eliminato_da_nome, eliminato_il'

export const assente = (error) => !!error && ['42P01', 'PGRST205'].includes(error.code)

/** I workout nel cestino che posso vedere, i più recenti in alto. */
export async function elencoCestino() {
  const { data, error } = await supabase.from(TABELLA).select(COLONNE).order('eliminato_il', { ascending: false })
  if (assente(error)) return { disponibile: false, righe: [] }
  if (error) throw error
  const righe = (data || []).filter(r => r?.id)
    .sort((a, b) => String(b.eliminato_il).localeCompare(String(a.eliminato_il)))
  return { disponibile: true, righe }
}

/**
 * C'è il cestino nel database? Serve alla conferma di eliminazione per non
 * promettere un cestino che non c'è. Ogni errore = false: meglio il vecchio
 * «definitivamente» che una promessa falsa.
 */
export async function cestinoDisponibile() {
  const { error } = await supabase.from(TABELLA).select('id').limit(1)
  return !error
}

/** Le voci a spunte del ripristino (assegnazioni e sfide). */
export async function vociCestino(id) {
  const { data, error } = await supabase.rpc('cestino_voci', { c: id })
  if (error) throw tradotto(error)
  return Array.isArray(data) ? data : []
}

/** Rimette il workout e le sole voci spuntate. Restituisce l'id del workout. */
export async function ripristinaWorkout(id, { assegnazioni = [], sfide = [] } = {}) {
  const { data, error } = await supabase.rpc('ripristina_workout', { c: id, assegnazioni, sfide })
  if (error) throw tradotto(error)
  return data
}

function tradotto(error) {
  const messaggio = String(error?.message ?? '')
  if (messaggio.includes('cestino: non trovato')) {
    return new Error('Questo workout è già stato ripristinato o non è più nel cestino.')
  }
  if (messaggio.includes('cestino: id occupato')) {
    return new Error('Esiste già un workout con questo identificativo.')
  }
  return error
}
