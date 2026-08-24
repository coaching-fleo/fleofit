// Titolo automatico per i workout senza nome.
//
// Il titolo NON può mai finire vuoto nel database: `workouts.title` è letto in
// decine di punti (scheda, archivio, PDF, story Instagram, TV, testo delle push)
// e lo stesso database serve sia la web app sia l'app iOS. Perciò quando l'utente
// non scrive niente, il titolo viene GENERATO e SALVATO come stringa normale.
import { format, parseISO, isValid } from 'date-fns'
import { it } from 'date-fns/locale'

export const ETICHETTA_AUTOMATICA = 'Allenamento libero'

/** "Allenamento libero · lun 25 ago" — con suffisso (2), (3)… se il giorno ne ha già uno uguale. */
export function generaTitolo(date, esistenti = [], etichetta = ETICHETTA_AUTOMATICA) {
  const d = typeof date === 'string' ? parseISO(date) : date
  const giorno = d && isValid(d) ? format(d, 'EEE d MMM', { locale: it }) : ''
  const base = giorno ? `${etichetta} · ${giorno}` : etichetta

  let titolo = base
  let n = 2
  while (esistenti.includes(titolo)) titolo = `${base} (${n++})`
  return titolo
}

/** Il titolo scritto dall'utente, oppure quello generato se il campo è vuoto. */
export function titoloOppureGenerato(titolo, date, esistenti = [], etichetta) {
  const scritto = (titolo || '').trim()
  return scritto || generaTitolo(date, esistenti, etichetta)
}

/** Titoli già presenti in quella data, per non generarne due identici. Non blocca il salvataggio. */
export async function titoliDelGiorno(supabase, date) {
  try {
    const { data } = await supabase.from('workouts').select('title').eq('date', date)
    return (data || []).map(w => w.title).filter(Boolean)
  } catch {
    return []
  }
}
