/**
 * Verifica e riscatto del codice invito.
 *
 * Dall'11/11/2026 passano da due funzioni del database
 * (`supabase/schema/codici_invito_2026-11-11.sql`, tempo 1), che rispondono
 * sì/no senza mostrare la tabella. Finché la migrazione non è applicata le
 * funzioni non esistono: si torna al percorso di prima, che legge e scrive
 * `invitation_codes` direttamente. Così l'app si può pubblicare PRIMA della
 * migrazione, e il tempo 2 (che toglie le policy aperte) le toglie sotto
 * un'app che non ne ha più bisogno.
 *
 * ⚠️ Il ripiego scatta anche quando la risposta non è un booleano: è il caso
 * dell'ambiente di prova e dei test, che alle RPC sconosciute rispondono
 * `null` o `[]`. Una funzione vera risponde sempre `true` o `false`.
 */

// PostgREST: «funzione non trovata». 42883: lo stesso, detto da Postgres.
const FUNZIONE_ASSENTE = ['PGRST202', '42883']

const senzaFunzione = ({ data, error }) =>
  error ? FUNZIONE_ASSENTE.includes(error.code) : typeof data !== 'boolean'

/** @returns {Promise<'valido'|'rifiutato'|'offline'>} */
export async function verificaCodiceInvito(supabase, codice) {
  const risposta = await supabase.rpc('codice_invito_valido', { p_codice: codice })
  if (!senzaFunzione(risposta)) {
    if (risposta.error) return 'offline'
    return risposta.data ? 'valido' : 'rifiutato'
  }

  // ⚠️ `maybeSingle()` e non `single()`: con `single()` «nessuna riga» torna
  // come errore, indistinguibile da un guasto di rete.
  const { data, error } = await supabase
    .from('invitation_codes')
    .select('code')
    .eq('code', codice)
    .eq('is_active', true)
    .is('used_by', null)
    .maybeSingle()
  if (error) return 'offline'
  return data ? 'valido' : 'rifiutato'
}

/**
 * Vero se il codice è dell'utente: appena riscattato, o già suo da prima.
 * @param {{ id: string, email?: string }} utente
 */
export async function riscattaCodiceInvito(supabase, codice, utente) {
  const risposta = await supabase.rpc('riscatta_codice_invito', { p_codice: codice })
  if (!senzaFunzione(risposta)) return risposta.data === true

  const { data } = await supabase.from('invitation_codes').update({
    used_by: utente.id,
    used_at: new Date().toISOString(),
    is_active: false,
    used_by_email: utente.email,
  })
    .eq('code', codice)
    .is('used_by', null)
    .select()
  if (data && data.length > 0) return true

  const { data: giaMio } = await supabase.from('invitation_codes')
    .select('id').eq('code', codice).eq('used_by', utente.id).maybeSingle()
  return !!giaMio
}
