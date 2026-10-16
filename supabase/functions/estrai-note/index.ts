// estrai-note — trasforma le note scritte di un atleta in dati, una volta sola.
//
// Il giro, per un atleta (POST { athlete_id }):
//   1. legge da sola, con la chiave di servizio, le sue assegnazioni e gli
//      estratti che ha già. Il testo NON arriva dal telefono: nessuno può far
//      salvare all'IA una nota che non esiste;
//   2. cancella gli estratti rimasti orfani (nota svuotata, assegnazione
//      tornata «da fare»);
//   3. manda all'IA le note mancanti, a gruppi, e valida OGNI voce con
//      `regole.ts` prima di salvarla in `note_estratte`.
// La lettura degli estratti la fa l'app direttamente sulla tabella (policy
// solo admin): qui si scrive e basta.
//
// Secret:  GROQ_API_KEY  — l'unica IA. GROQ_MODELLO (facoltativo) cambia il modello.
//
// 🔴 SOLO GROQ, NESSUNA RISERVA GEMINI. Qui l'IA riceve per scelta le parole
// degli atleti, e il piano gratuito di Gemini può usarle per i prodotti di
// Google (spec §7.2, BACKLOG #62). Se Groq non risponde, le note restano «in
// analisi» e si riprova alla prossima apertura della scheda: meglio un grafico
// in ritardo che una nota in giro.
//
// ⚠️ Solo admin, come ai-workout e ricerca-coach: l'URL è nel bundle pubblico.
// La web app su `main` non la chiama: un deploy non tocca la produzione web.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "npm:@supabase/supabase-js@2.39.3"
import { atletiDi, ruoloStaff } from "../_shared/staff.ts"
import { MODELLO_GROQ_PREDEFINITO, chatGroq } from "../_shared/groq.ts"
import {
  GRUPPO, MAX_GRUPPI, VERSIONE, daCancellare, daEstrarre, eserciziDelWorkout, impronta,
  richiestaGroq, rigaLogErrore, rispostaDaGroq, rispostaUtile, testoPulito, validaEstrazione,
} from "./regole.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MODELLO = Deno.env.get('GROQ_MODELLO') || MODELLO_GROQ_PREDEFINITO;

const risposta = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

// Chi chiama: il ruolo (admin / coach) e il suo id, o null se non è staff.
async function chiamanteStaff(req: Request): Promise<{ ruolo: "admin" | "coach"; id: string } | null> {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!);
    const { data, error } = await supabase.auth.getUser(token);
    const email = data?.user?.email?.trim().toLowerCase();
    if (error || !email || !data.user) return null;
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const ruolo = await ruoloStaff(db, email);
    return ruolo ? { ruolo, id: data.user.id } : null;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const chiamante = await chiamanteStaff(req);
  if (!chiamante) {
    console.warn('estrai-note: chiamata non autorizzata rifiutata');
    return risposta({ error: 'Non autorizzato' }, 403);
  }

  let athleteId = '';
  try { athleteId = String((await req.json())?.athlete_id || ''); } catch { /* sotto */ }
  if (!athleteId) return risposta({ error: 'athlete_id mancante.' }, 400);

  const chiave = Deno.env.get('GROQ_API_KEY');
  if (!chiave) return risposta({ estratte: 0, restano: null, cancellate: 0, sospesa: true, errore: 'Nessuna chiave IA configurata.' });

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // Un coach legge le note solo dei SUOI atleti, e prima di qualunque lettura.
  // Se coach_atleti non si legge si rifiuta lo stesso: nel dubbio, niente note.
  if (chiamante.ruolo === 'coach') {
    let suoi: string[];
    try {
      suoi = await atletiDi(db, chiamante.id);
    } catch (e) {
      console.error('estrai-note: atleti del coach non leggibili, rifiutato', e);
      return risposta({ error: 'Atleti del coach non leggibili' }, 503);
    }
    if (!suoi.includes(athleteId)) {
      console.warn('estrai-note: coach su un atleta non suo, rifiutato');
      return risposta({ error: 'Atleta non tuo' }, 403);
    }
  }

  const [{ data: righe, error: e1 }, { data: esistenti, error: e2 }] = await Promise.all([
    db.from('athlete_workouts').select('id, athlete_id, completed_date, status, notes, workouts(sections)').eq('athlete_id', athleteId),
    db.from('note_estratte').select('athlete_workout_id, impronta, versione').eq('athlete_id', athleteId),
  ]);
  if (e1 || e2) {
    console.error('estrai-note: lettura', e1?.message || e2?.message);
    return risposta({ error: 'Lettura non riuscita.' }, 500);
  }

  const orfani = daCancellare(righe ?? [], esistenti ?? []);
  if (orfani.length) {
    const { error } = await db.from('note_estratte').delete().in('athlete_workout_id', orfani);
    if (error) console.error('estrai-note: cancellazione', error.message);
  }

  const mancanti = daEstrarre(righe ?? [], esistenti ?? []);
  let estratte = 0;
  let sospesa = false;

  for (let g = 0; g < MAX_GRUPPI && g * GRUPPO < mancanti.length; g++) {
    const gruppo = mancanti.slice(g * GRUPPO, (g + 1) * GRUPPO).map((r: any, i: number) => ({
      riga: r, i, testo: testoPulito(r.notes), esercizi: eserciziDelWorkout(r.workouts?.sections),
    }));

    // All'IA solo indice locale, testo ed esercizi: niente id, nome o data.
    const { ok, stato, dati } = await chatGroq(richiestaGroq(gruppo, MODELLO), chiave).catch(() => ({ ok: false, stato: 0, dati: null }));
    const mappa = ok ? rispostaDaGroq(String(dati?.choices?.[0]?.message?.content ?? '')) : null;
    if (!mappa || !rispostaUtile(mappa, gruppo.length)) {
      // Mai il testo delle note nei log, nemmeno dentro la risposta d'errore
      // del fornitore: solo stato, codice e tipo (`rigaLogErrore`).
      console.error(ok ? `estrai-note: Groq ${stato} · risposta senza note utili` : rigaLogErrore(stato, dati));
      sospesa = true;
      break;
    }

    // Una nota assente da una risposta VALIDA è una nota senza niente da
    // dire: si salva vuota, così non torna all'IA a ogni apertura.
    const salvare = gruppo.map(n => ({
      athlete_workout_id: n.riga.id,
      athlete_id: athleteId,
      data: n.riga.completed_date,
      impronta: impronta(n.testo),
      versione: VERSIONE,
      estrazione: validaEstrazione(mappa.get(n.i), n.testo, n.esercizi),
    }));
    const { error } = await db.from('note_estratte').upsert(salvare, { onConflict: 'athlete_workout_id' });
    if (error) {
      console.error('estrai-note: salvataggio', error.message);
      sospesa = true;
      break;
    }
    estratte += salvare.length;
  }

  return risposta({ estratte, restano: mancanti.length - estratte, cancellate: orfani.length, sospesa });
});
