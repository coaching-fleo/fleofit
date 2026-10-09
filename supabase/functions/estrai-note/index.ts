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
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"
import { ADMIN_EMAILS } from "../_shared/admin.ts"
import { MODELLO_GROQ_PREDEFINITO, chatGroq } from "../_shared/groq.ts"
import {
  GRUPPO, MAX_GRUPPI, VERSIONE, daCancellare, daEstrarre, eserciziDelWorkout, impronta,
  richiestaGroq, rispostaDaGroq, testoPulito, validaEstrazione,
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

async function chiamanteAdmin(req: Request): Promise<boolean> {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return false;
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!);
    const { data, error } = await supabase.auth.getUser(token);
    const email = data?.user?.email?.trim().toLowerCase();
    if (error || !email) return false;
    return ADMIN_EMAILS.includes(email);
  } catch {
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  if (!(await chiamanteAdmin(req))) {
    console.warn('estrai-note: chiamata non autorizzata rifiutata');
    return risposta({ error: 'Non autorizzato' }, 403);
  }

  let athleteId = '';
  try { athleteId = String((await req.json())?.athlete_id || ''); } catch { /* sotto */ }
  if (!athleteId) return risposta({ error: 'athlete_id mancante.' }, 400);

  const chiave = Deno.env.get('GROQ_API_KEY');
  if (!chiave) return risposta({ estratte: 0, restano: null, cancellate: 0, sospesa: true, errore: 'Nessuna chiave IA configurata.' });

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

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
    if (!mappa) {
      // Mai il testo delle note nei log: solo stato e risposta del fornitore.
      console.error('estrai-note: Groq', stato, ok ? 'risposta illeggibile' : JSON.stringify(dati).slice(0, 500));
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
