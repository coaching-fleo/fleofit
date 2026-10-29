// garmin-webhook · sonno, HRV e dati della giornata del Push: si salvano in
// garmin_giornate, una colonna per invio.
// Piano: docs/superpowers/plans/2026-10-29-garmin-fase-2-recupero.md (Task 2).
//
// Garmin rimanda lo stesso giorno più volte e in ordine qualunque: ogni invio
// scrive SOLO la sua colonna (jsonb) e il resto della riga non si tocca; per
// quella colonna vince l'ultimo arrivato.
// Ogni voce ha il suo try/catch: una che fallisce non ferma le altre.
// 🔒 Nei log solo id e conteggi: mai valori, giorni o corpi di Garmin.

import type { VoceGiornata } from "../_shared/giornateGarmin.ts"
import { scollegaAtleta } from "../_shared/garmin.ts"

// deno-lint-ignore no-explicit-any
type Admin = any;

/** Il permesso Garmin che copre sonno, HRV e giornata. */
const PERMESSO_SALUTE = 'HEALTH_EXPORT';

/** Dal garmin_user_id al collegamento; null se non lo conosciamo. */
async function collegamentoDi(admin: Admin, garminUserId: string) {
  const { data, error } = await admin.from('garmin_collegamenti')
    .select('athlete_id, stato, permessi').eq('garmin_user_id', garminUserId).maybeSingle();
  if (error) throw new Error(`ricerca atleta: ${error.message}`);
  return data ? { athleteId: data.athlete_id as string, stato: data.stato as string, permessi: data.permessi as unknown } : null;
}

/** Una sola voce. Lancia: chi chiama logga. */
async function gestisci(admin: Admin, v: VoceGiornata): Promise<'salvata' | 'saltata'> {
  const coll = await collegamentoDi(admin, v.garmin_user_id);
  if (!coll) { console.warn('garmin-webhook: giornata di un utente Garmin sconosciuto, saltata'); return 'saltata'; }

  const { data: atleta, error: eAt } = await admin.from('athletes')
    .select('deleted_at').eq('id', coll.athleteId).maybeSingle();
  if (eAt) throw new Error(`atleta non letto: ${eAt.message}`);

  // Atleta eliminato (o sparito): niente si salva e il collegamento si chiude.
  if (!atleta || atleta.deleted_at != null) {
    console.warn(`garmin-webhook: giornata di un atleta eliminato (${coll.athleteId}), scollego`);
    await scollegaAtleta(admin, coll.athleteId, 'eliminato');
    return 'saltata';
  }
  if (coll.stato !== 'attivo') {
    console.warn(`garmin-webhook: giornata di ${coll.athleteId} con collegamento non attivo, saltata`);
    return 'saltata';
  }
  // L'atleta può aver tolto i dati di salute su Garmin Connect: allora non si salva.
  if (!Array.isArray(coll.permessi) || !coll.permessi.includes(PERMESSO_SALUTE)) {
    console.warn(`garmin-webhook: giornata di ${coll.athleteId} senza il permesso salute, saltata`);
    return 'saltata';
  }

  // Solo la colonna di questo invio: le altre della riga restano com'erano.
  const { error } = await admin.from('garmin_giornate').upsert(
    [{ athlete_id: coll.athleteId, giorno: v.giorno, [v.colonna]: v.valore, aggiornato_at: new Date().toISOString() }],
    { onConflict: 'athlete_id,giorno' },
  );
  if (error) throw new Error(`salvataggio: ${error.message}`);
  return 'salvata';
}

/** Tutte le voci di un Push, una alla volta. Non lancia mai. */
export async function gestisciGiornate(admin: Admin, voci: VoceGiornata[]): Promise<void> {
  const conti = { salvata: 0, saltata: 0, errore: 0 };
  for (const v of voci) {
    try {
      conti[await gestisci(admin, v)]++;
    } catch (e) {
      conti.errore++;
      console.error(`garmin-webhook: voce di recupero (${v.colonna}) non gestita:`, (e as Error).message);
    }
  }
  console.log(`garmin-webhook: recupero ${conti.salvata} salvate, ${conti.saltata} saltate, ${conti.errore} in errore`);
}
