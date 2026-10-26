// «Modelli di blocco»: lettura e scrittura della tabella `modelli_blocco`.
//
// Perché esiste: tiene in un posto solo ciò che l'app chiede al database per i
// modelli, così le schermate non conoscono i nomi delle colonne. Due regole:
//   · tutto ciò che si legge passa da `modelloValido` (una riga con contenuto
//     rotto si scarta, non rompe la lista);
//   · il nome si valida e si trimma PRIMA di scrivere, uguale al `check` SQL.
// `coach` si passa sempre esplicito: l'ambiente di prova non applica auth.uid().

import { supabase } from '../supabaseClient'
import { modelloValido, nomeValido } from './modelliBlocco'

export const MESSAGGIO_SENZA_RETE = 'Serve la connessione per salvare un modello.'

const TABELLA = 'modelli_blocco'

const quando = (m) => Date.parse(m.modificato_at ?? m.creato_at) || 0

/** I modelli validi, dal più recente (`modificato_at ?? creato_at`). */
export async function elencoModelli(categoria) {
  let q = supabase.from(TABELLA).select('*')
  if (categoria) q = q.eq('categoria', categoria)
  const { data, error } = await q
  if (error) throw error
  return (data || []).filter(modelloValido).sort((a, b) => quando(b) - quando(a))
}

export async function salvaModello({ coach, categoria, nome, contenuto }) {
  if (!nomeValido(nome)) throw new Error('Il nome del modello non è valido.')
  const { data, error } = await supabase
    .from(TABELLA)
    .insert({ coach, categoria, nome: String(nome).trim(), contenuto })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function aggiornaModello(id, { nome, contenuto } = {}) {
  const dati = { modificato_at: new Date().toISOString() }
  if (nome !== undefined) {
    if (!nomeValido(nome)) throw new Error('Il nome del modello non è valido.')
    dati.nome = String(nome).trim()
  }
  if (contenuto !== undefined) dati.contenuto = contenuto
  const { data, error } = await supabase.from(TABELLA).update(dati).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function eliminaModello(id) {
  const { error } = await supabase.from(TABELLA).delete().eq('id', id)
  if (error) throw error
}

/** Un modello per id, `null` se non c'è o non è valido. */
export async function leggiModello(id) {
  const { data, error } = await supabase.from(TABELLA).select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return modelloValido(data) ? data : null
}
