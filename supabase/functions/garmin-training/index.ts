// garmin-training — manda la Corsa all'orologio dell'atleta (Garmin Training API):
// crea il workout, lo programma nel giorno dell'assegnazione, lo rifà se cambia,
// lo sposta se cambia il giorno, lo toglie se non va più mandato.
// Piano: docs/superpowers/plans/2026-10-28-garmin-fase-3-corsa.md (Task 4).
//
// Tre ingressi:
//  · POST con header x-garmin-interno — i trigger `garmin_invii_assegnazioni`
//    (athlete_workouts) e `garmin_invii_workout` (workouts). Corpo
//    `{ type, table, record, old_record }` con SOLO gli id: le righe si rileggono qui.
//  · POST {azione:'riprova', athlete_workout_id} con il JWT dell'utente — la
//    «Riprova» della scheda (atleta o suo coach: lo decide la RLS).
//  · POST {azione:'invia_workout', acceso} con il JWT dell'atleta — l'interruttore
//    «Manda i workout all'orologio».
//
// Che cosa fare lo decide `decidiInvio` (garminTraining.ts, coperto dai test);
// qui ci sono solo il database e la rete.
//
// `verify_jwt = false` (config.toml): i trigger arrivano senza JWT, col segreto
// x-garmin-interno; le azioni dell'utente verificano il JWT a mano con auth.getUser.
//
// Ai trigger risponde SEMPRE 200: nessuno riprova, e un errore resta scritto
// nella riga di garmin_invii (la scheda mostra «Non inviato · Riprova»).
// 🔒 Nei log solo l'id dell'assegnazione, l'azione decisa e lo status HTTP:
// mai token, corpi di risposta di Garmin o il contenuto del workout.
//
// Secret: GARMIN_CLIENT_ID, GARMIN_CLIENT_SECRET, GARMIN_TOKEN_KEY, GARMIN_INTERNO_TOKEN.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"
import { stessoSegreto } from "../_shared/garminRegole.ts"
import {
  ErroreGarmin, accessValido, cancellaWorkoutGarmin, creaWorkoutGarmin, programmaGarmin, spostaProgrammaGarmin,
} from "../_shared/garmin.ts"
import { type DecisioneInvio, decidiInvio, firmaWorkout, invioInCorso, oggiItalia } from "../_shared/garminTraining.ts"
import { type GarminWorkout, corsaVersoGarmin } from "../_shared/workoutGarmin.ts"
import { ruoloStaff } from "../_shared/staff.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const risposta = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

const servizio = () => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

// deno-lint-ignore no-explicit-any
type Db = any;

type Invio = {
  athlete_workout_id: string
  athlete_id: string
  garmin_workout_id: string | null
  garmin_schedule_id: string | null
  data: string
  stato: string
  firma: string | null
  aggiornato_at: string
}

type Esito = { azione: DecisioneInvio, ok: boolean, errore?: string }

const COLONNE_INVIO = 'athlete_workout_id, athlete_id, garmin_workout_id, garmin_schedule_id, data, stato, firma, aggiornato_at';

/** Il testo da salvare in `garmin_invii.errore`: lo status di Garmin, mai un messaggio con dati. */
const testoErrore = (e: unknown) => e instanceof ErroreGarmin ? `HTTP ${e.status}` : 'non riuscito';

// ── sincronizza: una assegnazione, allineata con l'orologio ────────────────
/**
 * Rilegge assegnazione, collegamento e invio, decide (`decidiInvio`) e lo fa.
 * Non lancia per un errore di Garmin: lo scrive nella riga e risponde `ok: false`.
 * Lancia solo se il database non risponde.
 */
async function sincronizza(admin: Db, awId: string): Promise<Esito> {
  const adesso = new Date();
  const oggi = oggiItalia(adesso);

  const { data: aw, error: errAw } = await admin.from('athlete_workouts')
    .select('id, athlete_id, status, completed_date, workouts(title, sections)')
    .eq('id', awId).maybeSingle();
  if (errAw) throw new Error(`assegnazione non letta: ${errAw.message}`);

  const { data: invio, error: errInvio } = await admin.from('garmin_invii')
    .select(COLONNE_INVIO).eq('athlete_workout_id', awId).maybeSingle() as { data: Invio | null, error: { message: string } | null };
  if (errInvio) throw new Error(`invio non letto: ${errInvio.message}`);

  const athleteId: string | null = aw?.athlete_id ?? invio?.athlete_id ?? null;
  if (!athleteId) return fine(awId, { azione: 'niente', ok: true });

  const { data: coll, error: errColl } = await admin.from('garmin_collegamenti')
    .select('athlete_id, stato, access_cifrato, refresh_cifrato, access_scade_at, permessi, invia_workout')
    .eq('athlete_id', athleteId).maybeSingle();
  if (errColl) throw new Error(`collegamento non letto: ${errColl.message}`);
  // Né collegato né mai inviato: il caso di quasi tutte le assegnazioni.
  if (!coll && !invio) return fine(awId, { azione: 'niente', ok: true });

  // Il join a molti-a-uno arriva come oggetto; per sicurezza anche come lista.
  const w = Array.isArray(aw?.workouts) ? aw.workouts[0] : aw?.workouts;
  const workout = w ? corsaVersoGarmin({ title: w.title ?? '', sections: w.sections }) : null;
  const firma = workout ? await firmaWorkout(workout) : null;
  const assegnazione = aw
    ? { data: String(aw.completed_date ?? '').slice(0, 10), completata: aw.status === 'completed' }
    : null;

  const azione = decidiInvio({
    assegnazione,
    workout,
    collegamento: coll
      ? { stato: coll.stato, invia_workout: !!coll.invia_workout, permessi: coll.permessi ?? [] }
      : null,
    invio: invio
      ? { data: invio.data, stato: invio.stato, firma: invio.firma, inCorso: invioInCorso(invio, adesso) }
      : null,
    firma,
    oggi,
  });
  if (azione === 'niente') return fine(awId, { azione, ok: true });

  // Da qui in poi c'è un invio (rifai, sposta, cancella) o un workout da creare.
  if (azione === 'cancella' && !coll) {
    // Collegamento già tolto: presso Garmin non si arriva più, resta solo la riga.
    await togliRiga(admin, awId);
    return fine(awId, { azione, ok: true });
  }

  const ora = () => new Date().toISOString();
  const aggiorna = async (campi: Record<string, unknown>) => {
    const { data, error } = await admin.from('garmin_invii')
      .update({ ...campi, aggiornato_at: ora() }).eq('athlete_workout_id', awId).select('athlete_workout_id');
    if (error) throw new Error(`invio non aggiornato: ${error.message}`);
    return (data?.length ?? 0) > 0;
  };

  // Il token PRIMA di prendere la riga: senza, la riga resta com'è (con i suoi
  // id presso Garmin) e porta solo «da ricollegare».
  const access = await accessValido(admin, coll);
  if (!access) {
    if (invio) await aggiorna({ stato: 'da_rifare', errore: 'da ricollegare' });
    return fine(awId, { azione, ok: false, errore: 'da ricollegare' });
  }

  if (azione === 'crea') {
    // La riga si prende PRIMA di andare da Garmin (on conflict do nothing): se
    // due avvisi arrivano insieme, uno solo la trova libera (Review Focus 1).
    const { data: presa, error } = await admin.from('garmin_invii').upsert({
      athlete_workout_id: awId,
      athlete_id: athleteId,
      data: assegnazione!.data,
      stato: 'da_rifare',
      errore: null,
      aggiornato_at: ora(),
    }, { onConflict: 'athlete_workout_id', ignoreDuplicates: true }).select('athlete_workout_id');
    if (error) throw new Error(`invio non creato: ${error.message}`);
    if (!presa?.length) return fine(awId, { azione: 'niente', ok: true });
  }

  if (azione === 'rifai') {
    // Si prende la riga solo se nessuno l'ha toccata dopo la nostra lettura; gli
    // id si svuotano così chi arriva dopo la vede «in corso» (invioInCorso).
    const { data: presa, error } = await admin.from('garmin_invii').update({
      stato: 'da_rifare', garmin_workout_id: null, garmin_schedule_id: null, errore: null, aggiornato_at: ora(),
    }).eq('athlete_workout_id', awId).eq('aggiornato_at', invio!.aggiornato_at).select('athlete_workout_id');
    if (error) throw new Error(`invio non preso: ${error.message}`);
    if (!presa?.length) return fine(awId, { azione: 'niente', ok: true });
  }

  // Gli id presso Garmin che in caso d'errore vanno ricordati nella riga
  // (un workout creato ma non programmato si toglie al prossimo «rifai»).
  let workoutId: string | null = invio?.garmin_workout_id ?? null;
  let scheduleId: string | null = invio?.garmin_schedule_id ?? null;
  try {
    if (azione === 'cancella') {
      if (workoutId) await cancellaWorkoutGarmin(access, workoutId);
      await togliRiga(admin, awId);
      return fine(awId, { azione, ok: true });
    }

    if (azione === 'sposta') {
      if (scheduleId && workoutId) await spostaProgrammaGarmin(access, scheduleId, workoutId, assegnazione!.data);
      else if (workoutId) scheduleId = await programmaGarmin(access, workoutId, assegnazione!.data);
      await aggiorna({ data: assegnazione!.data, garmin_schedule_id: scheduleId, errore: null });
      return fine(awId, { azione, ok: true });
    }

    // crea, rifai
    if (azione === 'rifai' && workoutId) {
      await cancellaWorkoutGarmin(access, workoutId);
      workoutId = null;
      scheduleId = null;
    }
    workoutId = await creaWorkoutGarmin(access, workout as GarminWorkout);
    scheduleId = await programmaGarmin(access, workoutId, assegnazione!.data);
    const salvata = await aggiorna({
      stato: 'inviato', garmin_workout_id: workoutId, garmin_schedule_id: scheduleId,
      data: assegnazione!.data, firma, errore: null,
    });
    if (!salvata) {
      // La riga è sparita mentre si creava (un «cancella» arrivato in mezzo):
      // il workout appena creato non lo ricorderebbe nessuno, quindi si toglie.
      await cancellaWorkoutGarmin(access, workoutId);
    }
    return fine(awId, { azione, ok: true });
  } catch (e) {
    const errore = testoErrore(e);
    console.error(`garmin-training: ${azione} per ${awId} fallito (${errore}):`, (e as Error).message);
    try {
      await aggiorna({ stato: 'errore', errore, garmin_workout_id: workoutId, garmin_schedule_id: scheduleId });
    } catch (e2) {
      console.error(`garmin-training: errore non salvato per ${awId}:`, (e2 as Error).message);
    }
    return { azione, ok: false, errore };
  }
}

async function togliRiga(admin: Db, awId: string): Promise<void> {
  const { error } = await admin.from('garmin_invii').delete().eq('athlete_workout_id', awId);
  if (error) throw new Error(`invio non tolto: ${error.message}`);
}

/** Il log di una esecuzione andata a buon fine (o fermata da «da ricollegare»). */
function fine(awId: string, esito: Esito): Esito {
  console.log(`garmin-training: ${esito.azione} per ${awId}${esito.errore ? ` (${esito.errore})` : ''}`);
  return esito;
}

/** `sincronizza` su più assegnazioni, una dopo l'altra: una che fallisce non ferma le altre. */
async function sincronizzaTutte(admin: Db, ids: string[]): Promise<void> {
  for (const id of ids) {
    try {
      await sincronizza(admin, id);
    } catch (e) {
      console.error(`garmin-training: ${id} non sincronizzato:`, (e as Error).message);
    }
  }
}

// ── I trigger del database ─────────────────────────────────────────────────
const idDi = (r: unknown): string | null => {
  const id = r && typeof r === 'object' ? (r as Record<string, unknown>).id : null;
  return typeof id === 'string' && id ? id : null;
};

/** Le assegnazioni future di un workout cambiato, di atleti collegati o con un invio. */
async function assegnazioniDaRivedere(admin: Db, workoutId: string): Promise<string[]> {
  const { data: aws, error } = await admin.from('athlete_workouts')
    .select('id, athlete_id').eq('workout_id', workoutId).gte('completed_date', oggiItalia(new Date()));
  if (error) throw new Error(`assegnazioni non lette: ${error.message}`);
  if (!aws?.length) return [];
  const atleti = [...new Set((aws as { athlete_id: string }[]).map(a => a.athlete_id))];

  const [coll, inv] = await Promise.all([
    admin.from('garmin_collegamenti').select('athlete_id').in('athlete_id', atleti),
    admin.from('garmin_invii').select('athlete_id').in('athlete_id', atleti),
  ]);
  if (coll.error) throw new Error(`collegamenti non letti: ${coll.error.message}`);
  if (inv.error) throw new Error(`invii non letti: ${inv.error.message}`);
  const conGarmin = new Set([...(coll.data ?? []), ...(inv.data ?? [])].map((r: { athlete_id: string }) => r.athlete_id));
  return (aws as { id: string, athlete_id: string }[]).filter(a => conGarmin.has(a.athlete_id)).map(a => a.id);
}

async function interno(req: Request): Promise<Response> {
  if (!stessoSegreto(req.headers.get('x-garmin-interno'), Deno.env.get('GARMIN_INTERNO_TOKEN'))) {
    console.warn('garmin-training: chiamata interna con segreto sbagliato');
    return risposta({ error: 'Non autorizzato' }, 401);
  }
  try {
    let corpo: Record<string, unknown> | null = null;
    try { corpo = await req.json(); } catch { /* corpo non JSON: si ignora */ }
    const tabella = corpo?.table;
    const admin = servizio();

    if (tabella === 'athlete_workouts') {
      const id = idDi(corpo?.record) ?? idDi(corpo?.old_record);
      if (id) await sincronizzaTutte(admin, [id]);
    } else if (tabella === 'workouts' && corpo?.type === 'UPDATE') {
      // DELETE no: le assegnazioni cancellate in cascata arrivano col loro trigger.
      const id = idDi(corpo?.record);
      if (id) await sincronizzaTutte(admin, await assegnazioniDaRivedere(admin, id));
    }
  } catch (e) {
    console.error('garmin-training: avviso non gestito:', (e as Error).message);
  }
  return risposta({ ok: true });
}

// ── Le azioni dell'utente (POST con JWT) ──────────────────────────────────
async function azioneUtente(req: Request): Promise<Response> {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return risposta({ error: 'Accedi per continuare' }, 401);
  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const anonimo = createClient(url, anonKey);
  const { data: auth, error: authErr } = await anonimo.auth.getUser(token);
  const utente = auth?.user;
  if (authErr || !utente) return risposta({ error: 'Accedi per continuare' }, 401);

  let corpo: Record<string, unknown>;
  try {
    const c = await req.json();
    if (!c || typeof c !== 'object') throw new Error();
    corpo = c as Record<string, unknown>;
  } catch { return risposta({ error: 'Richiesta non valida' }, 400); }

  const admin = servizio();

  if (corpo.azione === 'riprova') {
    const awId = corpo.athlete_workout_id;
    if (typeof awId !== 'string' || !awId) return risposta({ error: 'Richiesta non valida' }, 400);
    // L'assegnazione si legge come l'UTENTE: se la RLS non gliela fa vedere
    // (né sua né di un suo atleta), non può nemmeno farla rimandare.
    const comeUtente = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: vista, error } = await comeUtente.from('athlete_workouts').select('id').eq('id', awId).maybeSingle();
    if (error) {
      console.error(`garmin-training: riprova, assegnazione ${awId} non letta:`, error.message);
      return risposta({ error: 'Non riuscito. Riprova tra poco.' }, 500);
    }
    if (!vista) return risposta({ error: 'Non autorizzato' }, 403);
    try {
      const esito = await sincronizza(admin, awId);
      return risposta({ ok: esito.ok, azione: esito.azione, errore: esito.errore ?? null });
    } catch (e) {
      console.error(`garmin-training: riprova di ${awId} non riuscita:`, (e as Error).message);
      return risposta({ error: 'Non riuscito. Riprova tra poco.' }, 500);
    }
  }

  if (corpo.azione === 'invia_workout') {
    if (typeof corpo.acceso !== 'boolean') return risposta({ error: 'Richiesta non valida' }, 400);
    // L'interruttore è dell'atleta: lo staff (anche in «Simula atleta») non lo tocca.
    if (await ruoloStaff(admin, utente.email ?? null)) {
      return risposta({ error: 'Garmin si gestisce solo da un account atleta' }, 403);
    }
    const { data: righe, error } = await admin.from('garmin_collegamenti')
      .update({ invia_workout: corpo.acceso, aggiornato_at: new Date().toISOString() })
      .eq('athlete_id', utente.id).select('athlete_id');
    if (error) {
      console.error(`garmin-training: invia_workout non salvato per ${utente.id}:`, error.message);
      return risposta({ error: 'Non riuscito. Riprova tra poco.' }, 500);
    }
    if (!righe?.length) return risposta({ error: 'Garmin non è collegato' }, 404);

    if (!corpo.acceso) {
      // Spento: i workout di oggi in avanti si tolgono dall'orologio (la regola dà «cancella»).
      const { data: invii, error: errInvii } = await admin.from('garmin_invii')
        .select('athlete_workout_id').eq('athlete_id', utente.id).gte('data', oggiItalia(new Date()));
      if (errInvii) {
        console.error(`garmin-training: invii di ${utente.id} non letti:`, errInvii.message);
      } else {
        await sincronizzaTutte(admin, (invii ?? []).map((r: { athlete_workout_id: string }) => r.athlete_workout_id));
      }
    }
    return risposta({ ok: true, invia_workout: corpo.acceso });
  }

  return risposta({ error: 'Azione sconosciuta' }, 400);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    if (req.method !== 'POST') return risposta({ error: 'Metodo non ammesso' }, 405);
    if (req.headers.has('x-garmin-interno')) return await interno(req);
    return await azioneUtente(req);
  } catch (e) {
    console.error('garmin-training: errore inatteso:', (e as Error).message);
    return risposta({ error: 'Errore inatteso' }, 500);
  }
});
