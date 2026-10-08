// segnalazione — «Segnala un problema» dall'app, come email al coach.
//
// Perché una funzione NUOVA e non una modalità di `send-reminders`:
// quella è condivisa con la web app in produzione e ogni suo deploy la tocca
// (CLAUDE.md §1.1). Questa non la usa nessun altro: pubblicarla non cambia
// niente per chi non apre il foglio.
//
// Perché una mail e non una riga nel database: lo schema è congelato (regola
// 0-bis), e la policy di `notifications` (`auth.uid() = user_id`) non lascia
// scrivere a un atleta una riga destinata al coach.
//
// Secret richiesto:  RESEND_API_KEY
// Facoltativi:       SEGNALAZIONI_MITTENTE     (predefinito FLEOFIT <onboarding@resend.dev>)
//                    SEGNALAZIONI_DESTINATARIO (predefinito coaching@federicoleo.it)
// ⚠️ Con il mittente `onboarding@resend.dev` Resend consegna SOLO all'indirizzo
// con cui è stato creato l'account: va bene finché il destinatario è quello.
// Per un mittente @federicoleo.it serve verificare il dominio su Resend.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"
import {
  type Corpo, htmlSegnalazione, limitatore, oggettoSegnalazione, testoSegnalazione, validaCorpo,
} from "./regole.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MITTENTE = Deno.env.get('SEGNALAZIONI_MITTENTE') || 'FLEOFIT <onboarding@resend.dev>';
const DESTINATARIO = Deno.env.get('SEGNALAZIONI_DESTINATARIO') || 'coaching@federicoleo.it';

// Vive quanto l'istanza: vedi il commento su `limitatore` in regole.ts.
const limite = limitatore(5, 3_600_000);

const risposta = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return risposta({ error: 'Metodo non ammesso' }, 405);

  // L'identità la ricava il SERVER, verificando il token con Supabase Auth: non
  // basta leggere i claim del JWT (chiunque può scriverne uno), e l'app non
  // dichiara chi è chi scrive. Così nessuno firma una segnalazione a nome d'altri.
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return risposta({ error: 'Accedi per inviare una segnalazione' }, 401);
  const anonimo = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!);
  const { data: auth, error: authErr } = await anonimo.auth.getUser(token);
  const utente = auth?.user;
  if (authErr || !utente?.email) return risposta({ error: 'Accedi per inviare una segnalazione' }, 401);

  let corpo: unknown;
  try { corpo = await req.json(); } catch { return risposta({ error: 'Richiesta non valida' }, 400); }
  const errore = validaCorpo(corpo);
  if (errore) return risposta({ error: errore }, 400);
  const c = corpo as Corpo;

  if (!limite.consenti(utente.id)) {
    console.warn(`segnalazione: limite orario raggiunto da ${utente.email}`);
    return risposta({ error: "Troppe segnalazioni, riprova fra un'ora" }, 429);
  }

  const chiave = Deno.env.get('RESEND_API_KEY');
  if (!chiave) {
    console.error('segnalazione: RESEND_API_KEY non impostata — la mail non può partire');
    return risposta({ error: 'Invio non riuscito. Riprova tra poco.' }, 500);
  }

  // Il nome come lo conosce il coach (rubrica atleti); se manca, l'email.
  let nome = utente.email;
  try {
    const servizio = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data } = await servizio.from('athletes').select('name, surname').eq('id', utente.id).maybeSingle();
    const completo = [data?.name, data?.surname].filter(Boolean).join(' ').trim();
    if (completo) nome = completo;
  } catch (e) {
    console.error('segnalazione: nome non letto, uso l\'email:', e);
  }

  const invio = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${chiave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: MITTENTE,
      to: [DESTINATARIO],
      reply_to: utente.email,
      subject: oggettoSegnalazione(c.tipo, nome),
      text: testoSegnalazione(c, nome, utente.email),
      html: htmlSegnalazione(c, nome, utente.email),
      attachments: (c.immagini ?? []).map(i => ({ filename: i.nome, content: i.base64 })),
    }),
  });

  if (!invio.ok) {
    console.error(`segnalazione: Resend ha risposto ${invio.status}:`, await invio.text().catch(() => ''));
    return risposta({ error: 'Invio non riuscito. Riprova tra poco.' }, 502);
  }

  console.log(`segnalazione: inviata (${c.tipo}) da ${utente.email}`);
  return risposta({ ok: true });
});
