// garmin-webhook · le attività del Push: si salvano in garmin_attivita e, se le
// regole lo permettono (`scegliAbbinamento`, abbinaGarmin.ts), completano il
// workout assegnato quel giorno e avvisano coach e atleta.
// Piano: docs/superpowers/plans/2026-10-28-garmin-fase-1-attivita.md (Task 5).
//
// Ogni attività ha il suo try/catch: una che fallisce non ferma le altre.
// 🔒 Nei log solo id e conteggi: mai tipo, durate, numeri o corpi di Garmin.

import type { AttivitaGarmin } from "../_shared/attivitaGarmin.ts"
import { scegliAbbinamento, diventaLibero, titoloLibero, minutiMinimi, GIORNI_MASSIMI, type Candidato } from "../_shared/abbinaGarmin.ts"
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
async function gestisci(admin: Admin, a: AttivitaGarmin): Promise<'salvata' | 'completata' | 'creata' | 'saltata'> {
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
  return await decidi(admin, coll, atleta, a.garmin_id, a.inizio);
}

/**
 * Dopo il salvataggio: completa un workout assegnato, o crea l'allenamento
 * libero, o lascia la voce grigia. La usa il Push e `rivalutaSalvate` (il
 * recupero dall'app), quindi legge tutto dalla riga salvata.
 */
async function decidi(
  admin: Admin, coll: Atleta, atleta: { name?: string; surname?: string },
  garminId: string, inizio: string,
): Promise<'salvata' | 'completata' | 'creata'> {
  const a = { garmin_id: garminId };
  if (!coll.collegatoAt) return 'salvata';
  // Il backfill (prima del collegamento) non completa mai: si risparmiano due letture.
  // L'autorità resta scegliAbbinamento, che fa lo stesso controllo.
  if (Date.parse(inizio) < Date.parse(coll.collegatoAt)) return 'salvata';

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

  const regole = {
    attivita: riga, collegatoAt: coll.collegatoAt, adesso: new Date().toISOString(),
    // Solo per le prove: GARMIN_MINUTI_MINIMI abbassa i 10 minuti (abbinaGarmin.ts).
    minutiMinimi: minutiMinimi(Deno.env.get('GARMIN_MINUTI_MINIMI')),
  };
  const scelto = scegliAbbinamento({ ...regole, candidati });
  const athleteName = [atleta.name, atleta.surname].filter(Boolean).join(' ') || 'Atleta';
  if (!scelto) {
    // Le assegnazioni che hanno già la loro attività (la corsa del mattino non
    // ferma la bici della sera): una lettura sola, sugli id del giorno.
    const ids = assegnazioni.map((r) => r.id);
    let conAttivita = new Set<string>();
    if (ids.length) {
      const { data: legate, error: eLeg } = await admin.from('garmin_attivita')
        .select('athlete_workout_id').in('athlete_workout_id', ids);
      if (eLeg) throw new Error(`attività legate non lette: ${eLeg.message}`);
      conAttivita = new Set((legate ?? []).map((l: { athlete_workout_id: string }) => l.athlete_workout_id));
    }
    const conLegate = candidati.map((c) => ({ ...c, haAttivita: conAttivita.has(c.id) }));
    if (!diventaLibero({ ...regole, candidati: conLegate })) return 'salvata';
    const titoli = assegnazioni.map((r) => r.workouts?.title).filter(Boolean);
    return await creaLibero(admin, a.garmin_id, coll.athleteId, athleteName, riga, titoli);
  }

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

/**
 * L'allenamento libero da Garmin: un Custom completato, come l'«Aggiungi
 * allenamento libero» della Home, con `sections.daGarmin` (la scheda non offre
 * «Non era questo allenamento»: si cancella come ogni libero).
 * Prima si PRENDE l'attività (`abbinamento = 'auto'` solo se ancora libera):
 * due Push della stessa attività (orologio e Connect) non creano due allenamenti.
 * Se workout o assegnazione non nascono, si torna indietro e l'attività resta
 * voce grigia; il Push dopo ci riprova.
 */
async function creaLibero(
  admin: Admin, garminId: string, athleteId: string, athleteName: string,
  riga: { giorno: string; tipo: string }, titoli: string[],
): Promise<'creata' | 'salvata'> {
  const { data: presa, error: ePresa } = await admin.from('garmin_attivita')
    .update({ abbinamento: 'auto' })
    .eq('garmin_id', garminId).eq('athlete_id', athleteId)
    .is('athlete_workout_id', null).is('abbinamento', null)
    .select('garmin_id');
  if (ePresa) throw new Error(`attività non presa: ${ePresa.message}`);
  if (!presa?.length) return 'salvata';

  const title = titoloLibero(riga.tipo, riga.giorno, titoli);
  let workoutId: string | null = null;
  let awId: string | null = null;
  try {
    const { data: w, error: eW } = await admin.from('workouts').insert({
      title,
      date: riga.giorno,
      sections: { category: 'Custom', isAutonomous: true, daGarmin: true },
      creato_da: athleteId, // come se l'avesse aggiunto l'atleta: la policy di lettura passa da lì
    }).select('id').single();
    if (eW) throw new Error(`workout: ${eW.message}`);
    workoutId = w.id;
    const { data: aw, error: eAw } = await admin.from('athlete_workouts').insert({
      athlete_id: athleteId, workout_id: workoutId, completed_date: riga.giorno, status: 'completed', notes: '',
    }).select('id').single();
    if (eAw) throw new Error(`assegnazione: ${eAw.message}`);
    awId = aw.id;
    const { error: eLega } = await admin.from('garmin_attivita')
      .update({ athlete_workout_id: aw.id }).eq('garmin_id', garminId).eq('athlete_id', athleteId);
    if (eLega) throw new Error(`attività non legata: ${eLega.message}`);
    console.log(`garmin-webhook: attività ${garminId} diventata l'allenamento libero ${aw.id}`);

    await avvisa({
      mode: 'coach_notification',
      action: 'custom_workout',
      athleteId,
      athleteName,
      workoutTitle: title,
      route: `/workout/${workoutId}?athlete_id=${athleteId}`,
    }, 'al coach', aw.id);
    await avvisa({ mode: 'garmin_registrato', athlete_workout_id: aw.id }, "all'atleta", aw.id);
    return 'creata';
  } catch (e) {
    // Indietro: assegnazione, workout e la presa dell'attività.
    if (awId) await admin.from('athlete_workouts').delete().eq('id', awId);
    if (workoutId) await admin.from('workouts').delete().eq('id', workoutId);
    await admin.from('garmin_attivita').update({ abbinamento: null, athlete_workout_id: null })
      .eq('garmin_id', garminId).eq('athlete_id', athleteId);
    throw e;
  }
}

/**
 * Il recupero chiesto dall'app (`sincronizza` di garmin-auth): le attività già
 * SALVATE degli ultimi GIORNI_MASSIMI giorni, ancora libere e mai rifiutate,
 * ripassano da `decidi`. Serve per quelle arrivate prima di una regola nuova
 * (il 04/11/2026: le voci grigie salvate prima degli allenamenti liberi) o
 * quando Garmin non rimanda un periodo già chiesto. Non lancia mai.
 */
export async function rivalutaSalvate(admin: Admin, athleteId: string): Promise<number> {
  let fatte = 0;
  try {
    const { data: c, error: eC } = await admin.from('garmin_collegamenti')
      .select('athlete_id, collegato_at, stato').eq('athlete_id', athleteId).maybeSingle();
    if (eC || !c || c.stato !== 'attivo') return 0;
    const coll: Atleta = { athleteId, collegatoAt: c.collegato_at ?? null, stato: c.stato };
    const { data: atleta, error: eAt } = await admin.from('athletes')
      .select('name, surname, deleted_at').eq('id', athleteId).maybeSingle();
    if (eAt || !atleta || atleta.deleted_at != null) return 0;
    const da = new Date(Date.now() - GIORNI_MASSIMI * 86400_000).toISOString();
    const { data: righe, error } = await admin.from('garmin_attivita')
      .select('garmin_id, inizio').eq('athlete_id', athleteId)
      .is('athlete_workout_id', null).is('abbinamento', null).gte('inizio', da)
      .order('inizio');
    if (error) throw new Error(error.message);
    for (const r of righe ?? []) {
      try {
        if (await decidi(admin, coll, atleta, r.garmin_id, r.inizio) !== 'salvata') fatte++;
      } catch (e) {
        console.error(`garmin: rivalutazione di ${r.garmin_id} non riuscita:`, (e as Error).message);
      }
    }
  } catch (e) {
    console.error(`garmin: rivalutazione per ${athleteId} non riuscita:`, (e as Error).message);
  }
  console.log(`garmin: rivalutate le attività di ${athleteId}, ${fatte} diventano allenamenti`);
  return fatte;
}

/** Tutte le attività di un Push, una alla volta. Non lancia mai. */
export async function gestisciAttivita(admin: Admin, attivita: AttivitaGarmin[]): Promise<void> {
  const conti = { salvata: 0, completata: 0, creata: 0, saltata: 0, errore: 0 };
  for (const a of attivita) {
    try {
      conti[await gestisci(admin, a)]++;
    } catch (e) {
      conti.errore++;
      console.error(`garmin-webhook: attività ${a.garmin_id} non gestita:`, (e as Error).message);
    }
  }
  console.log(`garmin-webhook: attività ${conti.completata} completano un workout, ${conti.creata} diventano allenamenti liberi, ${conti.salvata} solo salvate, ${conti.saltata} saltate, ${conti.errore} in errore`);
}
