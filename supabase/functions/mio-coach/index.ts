// mio-coach — il nome del coach di chi chiama, per «Mario Rossi ti segue da oggi»
// nella Home dell'atleta al giorno 1 (11/11/2026).
//
// Perché una funzione e non una lettura dal client: l'atleta legge la sua riga
// di `coach_atleti` (quindi l'id del coach), ma NON la riga `athletes` del
// coach, dove sta il nome (policy «athletes proprio, del coach, admin»). Una
// funzione del database (security definer) lo farebbe, ma è una migrazione e
// lo schema è congelato (CLAUDE.md §0, 0-bis). Questa legge col service role e
// restituisce SOLO il nome del coach di chi chiama: nient'altro, di nessun altro.
//
// Funzione nuova e non una modalità di `send-reminders`: quella è condivisa con
// la web app in produzione. Questa la usa solo l'app nuova.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"
import { nomeDi, primoCoachDi } from "../_shared/staff.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const risposta = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // L'identità la verifica Supabase Auth, come in `segnalazione`: chi chiama
  // può chiedere solo il proprio coach, mai quello di un altro.
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return risposta({ error: 'Non autenticato' }, 401);
  const anonimo = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!);
  const { data: auth, error: authErr } = await anonimo.auth.getUser(token);
  const utente = auth?.user;
  if (authErr || !utente) return risposta({ error: 'Non autenticato' }, 401);

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  try {
    const coach = await primoCoachDi(db, utente.id);
    const nome = coach ? await nomeDi(db, coach) : null;
    return risposta({ nome });
  } catch (e) {
    console.error('mio-coach:', e);
    return risposta({ nome: null });
  }
});
