// Il solo punto in cui l'app parla con gli estratti delle note (09/10/2026).
//
// La lettura va diretta sulla tabella `note_estratte`: la policy la consegna
// solo agli admin. L'estrazione passa dalla Edge Function `estrai-note`, che
// legge le note da sola e scrive con la chiave di servizio.
//
// ⚠️ Nessuna delle due deve rompere la scheda atleta: una lettura fallita
// torna `errore: true`, un'estrazione fallita torna `sospesa: true`, e la
// sezione lo dice invece di mostrare grafici vuoti come se fossero veri.

import { supabase } from '../supabaseClient'

export async function leggiEstratti(athleteId) {
  const { data, error } = await supabase
    .from('note_estratte')
    .select('athlete_workout_id, data, impronta, versione, estrazione')
    .eq('athlete_id', athleteId)
  // Tabella che non esiste ancora (la migrazione è in attesa, BACKLOG #66):
  // non è un errore da mostrare a ogni coach, è una funzione non ancora
  // accesa. Stessi due codici dei PR in AthleteDetail.
  if (error && (error.code === '42P01' || error.code === 'PGRST205')) return { dati: [], errore: false, assente: true }
  return error ? { dati: [], errore: true, assente: false } : { dati: data ?? [], errore: false, assente: false }
}

const SOSPESA = { estratte: 0, restano: null, sospesa: true }

export async function estraiMancanti(athleteId) {
  try {
    const { data, error } = await supabase.functions.invoke('estrai-note', { body: { athlete_id: athleteId } })
    if (error || !data) return SOSPESA
    return { estratte: data.estratte ?? 0, restano: data.restano ?? null, sospesa: Boolean(data.sospesa) }
  } catch {
    return SOSPESA
  }
}
