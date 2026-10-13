// Esportazione e ripristino del database dalle Impostazioni (solo coach).
//
// 🔴 Si legge A PAGINE. Prima ogni tabella si chiedeva con `.limit(10000)`,
// ma il server restituisce al massimo mille righe (`max_rows`) senza avvisare:
// un backup con più di mille assegnazioni usciva troncato, e lo si sarebbe
// scoperto solo al momento del ripristino. È la stessa trappola di Analisi.
//
// ⚠️ Una tabella che non esiste ancora (es. `come_stai` prima che la sua
// migrazione sia applicata) non è un errore: resta fuori dal file e il file lo
// dice in `tabelle_assenti`. Qualunque ALTRO errore ferma l'esportazione: un
// backup a metà che si presenta come completo è peggio di nessun backup.
//
// Il backup automatico notturno è un'altra cosa: `.github/workflows/db-backup.yml`,
// che gira dal branch `main`. Le due liste di tabelle vanno tenute allineate.

import { supabase } from '../supabaseClient'

/** Le tabelle del file, nell'ordine in cui si RIPRISTINANO: prima chi è puntato. */
export const TABELLE_BACKUP = ['athletes', 'workouts', 'athlete_workouts', 'come_stai']

const PAGINA = 1000
/** Righe per scrittura nel ripristino: una richiesta enorme può essere rifiutata. */
const BLOCCO_SCRITTURA = 500

const tabellaAssente = (error) => error && (error.code === '42P01' || error.code === 'PGRST205')

/**
 * Tutte le righe di una tabella, a pagine. `filtra` aggiunge condizioni alla
 * query (es. un atleta solo). Torna `{ righe }`, `{ assente: true }` se la
 * tabella non c'è, e lancia su ogni altro errore.
 */
export async function leggiTutta(tabella, filtra = (q) => q) {
  const righe = []
  for (let pagina = 0; ; pagina++) {
    const { data, error } = await filtra(supabase.from(tabella).select('*'))
      .order('id', { ascending: true })
      .range(pagina * PAGINA, pagina * PAGINA + PAGINA - 1)
    if (error) {
      if (tabellaAssente(error)) return { righe: [], assente: true }
      throw new Error(`${tabella}: ${error.message}`)
    }
    righe.push(...(data || []))
    if (!data || data.length < PAGINA) return { righe, assente: false }
  }
}

/** Il file del backup completo. */
export async function esportaTutto() {
  const backup = { version: 2, type: 'full_backup', timestamp: new Date().toISOString(), tabelle_assenti: [] }
  for (const tabella of TABELLE_BACKUP) {
    const { righe, assente } = await leggiTutta(tabella)
    if (assente) backup.tabelle_assenti.push(tabella)
    else backup[tabella] = righe
  }
  return backup
}

/** Scrive le righe a blocchi. Torna `false` se la tabella non esiste, lancia sugli altri errori. */
export async function scriviTutta(tabella, righe = []) {
  for (let i = 0; i < righe.length; i += BLOCCO_SCRITTURA) {
    const { error } = await supabase.from(tabella).upsert(righe.slice(i, i + BLOCCO_SCRITTURA), { onConflict: 'id' })
    if (error) {
      if (tabellaAssente(error)) return false
      throw new Error(`${tabella}: ${error.message}`)
    }
  }
  return true
}

/**
 * Ripristina un backup completo, tabella per tabella nell'ordine giusto.
 * Accetta anche i file di prima (version 1, senza `come_stai`).
 * Torna `{ saltate }`: le tabelle del file che nel database non esistono.
 */
export async function ripristinaTutto(dati) {
  if (dati?.type !== 'full_backup') throw new Error('File non valido per il ripristino totale.')
  const saltate = []
  for (const tabella of TABELLE_BACKUP) {
    if (!dati[tabella]?.length) continue
    if (!(await scriviTutta(tabella, dati[tabella]))) saltate.push(tabella)
  }
  return { saltate }
}
