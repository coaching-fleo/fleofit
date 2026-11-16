// Gruppi di atleti: lettura e scrittura della tabella `gruppi_atleti` (16/11/2026,
// supabase/schema/gruppi_atleti_2026-11-16.sql). Due regole:
//   · tabella assente (migrazione non ancora applicata: 42P01, PGRST205) =
//     `disponibile: false`, e le schermate nascondono tutto senza alert;
//   · il nome si valida e si trimma PRIMA di scrivere, uguale al `check` SQL,
//     contro i gruppi che il chiamante ha già in mano (niente doppioni).
// `coach` si passa sempre esplicito: l'ambiente di prova non applica auth.uid().

import { supabase } from '../supabaseClient'
import { nomeGruppoValido } from './gruppiAtleti'

const TABELLA = 'gruppi_atleti'

export const assente = (error) => !!error && ['42P01', 'PGRST205'].includes(error.code)

const perNome = (a, b) => String(a.nome).localeCompare(String(b.nome), 'it', { sensitivity: 'base' })

/** I gruppi del coach, per nome. */
export async function elencoGruppi() {
  const { data, error } = await supabase.from(TABELLA).select('*')
  if (assente(error)) return { disponibile: false, gruppi: [] }
  if (error) throw error
  return { disponibile: true, gruppi: (data || []).filter(g => g?.id && g.nome).sort(perNome) }
}

function controlla(nome, gruppi, idEscluso) {
  const errore = nomeGruppoValido(nome, gruppi, idEscluso)
  if (errore) throw new Error(errore)
  return String(nome).trim()
}

export async function creaGruppo({ coach, nome, atleti = [] }, gruppi = []) {
  const pulito = controlla(nome, gruppi, null)
  const { data, error } = await supabase.from(TABELLA)
    .insert({ coach, nome: pulito, atleti: [...atleti] }).select().single()
  if (error) throw error
  return data
}

export async function aggiornaGruppo(id, { nome, atleti = [] }, gruppi = []) {
  const pulito = controlla(nome, gruppi, id)
  const { data, error } = await supabase.from(TABELLA)
    .update({ nome: pulito, atleti: [...atleti], modificato_at: new Date().toISOString() })
    .eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function eliminaGruppo(id) {
  const { error } = await supabase.from(TABELLA).delete().eq('id', id)
  if (error) throw error
}
