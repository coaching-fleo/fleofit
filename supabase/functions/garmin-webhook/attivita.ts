// garmin-webhook · le attività del Push: si salvano in garmin_attivita e, se le
// regole lo permettono (`scegliAbbinamento`, abbinaGarmin.ts), completano il
// workout assegnato quel giorno e avvisano coach e atleta.
// Piano: docs/superpowers/plans/2026-10-28-garmin-fase-1-attivita.md (Task 5).
//
// Ogni attività ha il suo try/catch: una che fallisce non ferma le altre.
// 🔒 Nei log solo id e conteggi: mai tipo, durate, numeri o corpi di Garmin.

import type { AttivitaGarmin } from "../_shared/attivitaGarmin.ts"
import { scegliAbbinamento, minutiMinimi, type Candidato } from "../_shared/abbinaGarmin.ts"
import { scollegaAtleta } from "../_shared/garmin.ts"

// deno-lint-ignore no-explicit-any
type Admin = any;

type Atleta = { athleteId: string; collegatoAt: string | null; stato: string };

/** Dal garmin_user_id al collegamento; null se non lo conosciamo. */
async function collegamentoDi(admin: Admin, garminUserId: string): Promise<Atleta | null> {
  const { data, error } = await admin.from('garmin_collegamenti')
    .select('athlete_id, collegato_at, stato').eq('garmin_user_id', garminUserId).maybeSingle();
  if (error) throw new Error(`ricerca atleta: ${error.message}`);
  return data ? { athleteId: data.athlete_id, collegatoAt: data.collegato_at ?? null, stato: data.stato } : null;
}

/** I minuti stimati del workout (`sections.durataStimata`, scritto dal builder); null sui workout vecchi. */
const durataStimata = (sections: Record<string, unknown> | null | undefined): number | null => {
  const v = sections?.durataStimata;
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;
};

/** Chiama send-reminders con la service role; un errore si logga e basta (non annulla il completamento). */
async function avvisa(corpo: Record<string, unknown>, cosa: string, id: string): Promise<void> {
  try {
    const r = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-reminders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(corpo),
    });
    await r.body?.cancel().catch(() => {});
    if (!r.ok) console.error(`garmin-webhook: notifica ${cosa} per ${id} non mandata (HTTP ${r.status})`);
  } catch (e) {
    console.error(`garmin-webhook: notifica ${cosa} per ${id} non mandata:`, (e as Error).message);
  }
}

/**
 * Salva l'attività senza MAI toccare `athlete_workout_id` e `abbinamento` di una
 * riga che esiste già (Review Focus 1 e 3): prima un insert che non fa niente
 * se c'è, poi l'update delle sole colonne che vengono da Garmin.
 */
async function salva(admin: Admin, athleteId: string, a: AttivitaGarmin): Promise<void> {
  const daGarmin = {
    inizio: a.inizio,
    giorno: a.giorno,
    tipo: a.tipo,
    durata_s: a.durata_s == null ? null : Math.round(a.durata_s), // la colonna è integer
    distanza_m: a.distanza_m,
    dati: a.dati,
    ricevuto_at: new Date().toISOString(),
  };
  const { error: e1 } = await admin.from('garmin_attivita')
    .upsert([{ garmin_id: a.garmin_id, athlete_id: athleteId, ...daGarmin }], { onConflict: 'garmin_id', ignoreDuplicates: true });
  if (e1) throw new Error(`insert: ${e1.message}`);
  const { error: e2 } = await admin.from('garmin_attivita').update(daGarmin).eq('garmin_id', a.garmin_id).eq('athlete_id', athleteId); // un vecchio account Garmin passato ad altri non tocca le righe del primo
  if (e2) throw new Error(`update: ${e2.message}`);
}

/** Una sola attività, dal Push al completamento. Lancia: chi chiama logga. */
async function gestisci(admin: Admin, a: AttivitaGarmin): Promise<'salvata' | 'completata' | 'saltata'> {
  const coll = await collegamentoDi(admin, a.garminUserId);
  if (!coll) { console.warn('garmin-webhook: attività di un utente Garmin sconosciuto, saltata'); return 'saltata'; }

  const { data: atleta, error: eAt } = await admin.from('athletes')
    .select('name, surname, deleted_at').eq('id', coll.athleteId).maybeSingle();
  if (eAt) throw new Error(`atleta non letto: ${eAt.message}`);

  // Atleta eliminato (o sparito): niente si salva e il collegamento si chiude
  // (Review Focus 5, recupera l'avviso del trigger che si fosse perso in Fase 0).
  if (!atleta || atleta.deleted_at != null) {
    console.warn(`garmin-webhook: attività di un atleta eliminato (${coll.athleteId}), scollego`);
    await scollegaAtleta(admin, coll.athleteId, 'eliminato');
    return 'saltata';
  }
  if (coll.stato !== 'attivo') {
    console.warn(`garmin-webhook: attività di ${coll.athleteId} con collegamento non attivo, saltata`);
    return 'saltata';
  }

  await salva(admin, coll.athleteId, a);
  if (!coll.collegatoAt) return 'salvata';
  // Il backfill (prima del collegamento) non completa mai: si risparmiano due letture.
  // L'autorità resta scegliAbbinamento, che fa lo stesso controllo.
  if (Date.parse(a.inizio) < Date.parse(coll.collegatoAt)) return 'salvata';

  // Riletta: abbinamento e athlete_workout_id sono quelli veri della riga.
  const { data: riga, error: eRiga } = await admin.from('garmin_attivita')
    .select('giorno, tipo, durata_s, inizio, abbinamento, athlete_workout_id')
    .eq('garmin_id', a.garmin_id).eq('athlete_id', coll.athleteId).maybeSingle();
  if (eRiga || !riga) throw new Error(`riga non riletta: ${eRiga?.message ?? 'assente'}`);

  const { data: righe, error: eCand } = await admin.from('athlete_workouts')
    .select('id, status, completed_date, workout_id, workouts(title, sections)')
    .eq('athlete_id', coll.athleteId).eq('completed_date', riga.giorno);
  if (eCand) throw new Error(`candidati non letti: ${eCand.message}`);

  // deno-lint-ignore no-explicit-any
  const assegnazioni = (righe ?? []) as any[];
  const candidati: Candidato[] = assegnazioni.map((r) => ({
    id: r.id,
    giorno: r.completed_date,
    categoria: typeof r.workouts?.sections?.category === 'string' ? r.workouts.sections.category : null,
    completato: r.status === 'completed',
    durataStimataMin: durataStimata(r.workouts?.sections),
  }));

  const scelto = scegliAbbinamento({
    attivita: riga, candidati, collegatoAt: coll.collegatoAt, adesso: new Date().toISOString(),
    // Solo per le prove: GARMIN_MINUTI_MINIMI abbassa i 10 minuti (abbinaGarmin.ts).
    minutiMinimi: minutiMinimi(Deno.env.get('GARMIN_MINUTI_MINIMI')),
  });
  if (!scelto) return 'salvata';

  // Solo se ancora da fare (Review Focus 4): un update che non tocca niente =
  // l'atleta l'ha già segnato, o un altro Push è arrivato prima. Nessuna notifica.
  // Solo lo stato, come «Segna come completato» dell'app: RPE e note restano vuoti,
  // completed_date è il giorno programmato e non si tocca.
  const { data: toccate, error: eUp } = await admin.from('athlete_workouts')
    .update({ status: 'completed' }).eq('id', scelto).neq('status', 'completed').select('id');
  if (eUp) throw new Error(`completamento: ${eUp.message}`);
  if (!toccate?.length) return 'salvata';

  const { data: abbinate, error: eAbb } = await admin.from('garmin_attivita')
    .update({ athlete_workout_id: scelto, abbinamento: 'auto' })
    .eq('garmin_id', a.garmin_id).is('athlete_workout_id', null).is('abbinamento', null)
    .select('garmin_id');
  if (eAbb) console.error(`garmin-webhook: ${scelto} completato ma abbinamento non salvato:`, eAbb.message);
  else if (!abbinate?.length) console.warn(`garmin-webhook: attività ${a.garmin_id} già abbinata altrove, workout ${scelto} completato senza attività collegata`);
  console.log(`garmin-webhook: ${scelto} completato da un'attività Garmin`);

  const assegnazione = assegnazioni.find((r) => r.id === scelto);
  const athleteName = [atleta.name, atleta.surname].filter(Boolean).join(' ') || 'Atleta';
  await avvisa({
    mode: 'coach_notification',
    action: 'completed',
    daGarmin: true,
    athleteId: coll.athleteId,
    athleteName,
    workoutTitle: assegnazione?.workouts?.title || 'Workout',
    route: `/workout/${assegnazione?.workout_id}?athlete_id=${coll.athleteId}`,
  }, 'al coach', scelto);
  await avvisa({ mode: 'garmin_registrato', athlete_workout_id: scelto }, "all'atleta", scelto);
  return 'completata';
}

/** Tutte le attività di un Push, una alla volta. Non lancia mai. */
export async function gestisciAttivita(admin: Admin, attivita: AttivitaGarmin[]): Promise<void> {
  const conti = { salvata: 0, completata: 0, saltata: 0, errore: 0 };
  for (const a of attivita) {
    try {
      conti[await gestisci(admin, a)]++;
    } catch (e) {
      conti.errore++;
      console.error(`garmin-webhook: attività ${a.garmin_id} non gestita:`, (e as Error).message);
    }
  }
  console.log(`garmin-webhook: attività ${conti.completata} completano un workout, ${conti.salvata} solo salvate, ${conti.saltata} saltate, ${conti.errore} in errore`);
}
