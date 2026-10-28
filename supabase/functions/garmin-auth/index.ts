// garmin-auth — collegamento di un atleta a Garmin Connect (OAuth 2.0 con PKCE),
// ritorno da Garmin e scollegamento.
// Spec: docs/superpowers/specs/2026-10-27-garmin-design.md (§2, §9).
//
// Quattro ingressi:
//  · POST {azione:'inizia', consenso:1, ritorno} con il JWT dell'atleta → { url }
//  · GET ?code&state | ?error&state — il callback di Garmin (dal browser, SENZA JWT)
//  · POST {azione:'scollega'} con il JWT dell'atleta → { ok: true }
//  · POST con header x-garmin-interno — il trigger `garmin_atleta_eliminato`
//
// `verify_jwt = false` (config.toml) perché il callback e il trigger arrivano
// senza JWT: l'identità dell'atleta si verifica qui a mano con `auth.getUser`,
// come in `segnalazione`.
//
// Secret: GARMIN_CLIENT_ID, GARMIN_CLIENT_SECRET, GARMIN_TOKEN_KEY,
// GARMIN_INTERNO_TOKEN. Facoltativo: GARMIN_ORIGINI_EXTRA (origini web in più
// ammesse come ritorno, separate da virgola).

import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"
import {
  atletaEliminato, cifra, esitoCallback, generaPkce, generaState, ritornoValido, stessoSegreto,
  urlAutorizzazione, urlRitorno,
} from "../_shared/garminRegole.ts"
import {
  REDIRECT_URI, leggiPermessi, leggiUtenteId, scambiaCodice, scollegaAtleta, scriviConsensoGarmin,
} from "../_shared/garmin.ts"
import { ruoloStaff } from "../_shared/staff.ts"

/** La versione del consenso Garmin che l'app mostra (VERSIONE_CONSENSO_GARMIN lato app). */
const VERSIONE_CONSENSO_GARMIN = 1

/** Dove si torna quando non si sa da dove si veniva: mai verso un indirizzo non validato. */
const RITORNO_DI_RISERVA = 'https://fleofit.vercel.app'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const risposta = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

const vaiA = (url: string) => new Response(null, { status: 302, headers: { Location: url } });

const originiExtra = () => (Deno.env.get('GARMIN_ORIGINI_EXTRA') || '')
  .split(',').map(s => s.trim()).filter(Boolean);

const servizio = () => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

// ── Callback (GET da Garmin, nel browser dell'atleta) ─────────────────────
async function callback(url: URL): Promise<Response> {
  const state = url.searchParams.get('state');
  const codice = url.searchParams.get('code');
  const erroreGarmin = url.searchParams.get('error');
  const riserva = urlRitorno(RITORNO_DI_RISERVA, 'errore', 'scaduto');
  if (!state) return vaiA(riserva);

  const admin = servizio();
  const { data: riga, error } = await admin.from('garmin_collegamenti')
    .select('athlete_id, pkce_verifier, pkce_ritorno, pkce_at, collegato_at, consenso_versione, consenso_at')
    .eq('pkce_state', state).maybeSingle();
  if (error) console.error('garmin-auth: lettura per state fallita:', error.message);
  if (!riga) return vaiA(riserva);

  // Il ritorno salvato a `inizia` si RI-valida: le origini extra possono essere cambiate.
  const ritorno = ritornoValido(riga.pkce_ritorno, originiExtra()) ? riga.pkce_ritorno as string : RITORNO_DI_RISERVA;

  // Uso singolo: i pkce_* si svuotano PRIMA dello scambio, condizionati allo
  // state. Se due richieste arrivano con lo stesso state, una sola li trova.
  const { data: presa, error: errPresa } = await admin.from('garmin_collegamenti')
    .update({ pkce_state: null, pkce_verifier: null, pkce_ritorno: null, pkce_at: null, aggiornato_at: new Date().toISOString() })
    .eq('pkce_state', state).select('athlete_id');
  if (errPresa || !presa?.length) {
    if (errPresa) console.error('garmin-auth: pkce non svuotati:', errPresa.message);
    return vaiA(urlRitorno(ritorno, 'errore', 'scaduto'));
  }

  if (erroreGarmin || !codice) {
    console.log(`garmin-auth: collegamento annullato da ${riga.athlete_id}`);
    return vaiA(urlRitorno(ritorno, 'errore', 'annullato'));
  }

  try {
    const adesso = new Date();
    // Prima di andare in rete: uno state troppo vecchio non si scambia nemmeno.
    const prima = esitoCallback({ riga, adesso, garminUserIdGiaDi: null });
    if (!prima.ok) return vaiA(urlRitorno(ritorno, 'errore', prima.motivo));

    const token = await scambiaCodice({ codice, verifier: riga.pkce_verifier, redirectUri: REDIRECT_URI });
    const garminUserId = await leggiUtenteId(token.access);
    const { data: gia, error: errGia } = await admin.from('garmin_collegamenti')
      .select('athlete_id').eq('garmin_user_id', garminUserId).maybeSingle();
    if (errGia) throw new Error(`ricerca garmin_user_id: ${errGia.message}`);

    const esito = esitoCallback({ riga, adesso, garminUserIdGiaDi: gia?.athlete_id ?? null });
    if (!esito.ok) {
      // Niente cancellazione presso Garmin: quella registrazione è dell'altro atleta.
      console.warn(`garmin-auth: callback rifiutato per ${riga.athlete_id}: ${esito.motivo}`);
      return vaiA(urlRitorno(ritorno, 'errore', esito.motivo));
    }

    const permessi = await leggiPermessi(token.access);
    const chiave = Deno.env.get('GARMIN_TOKEN_KEY');
    if (!chiave) throw new Error('GARMIN_TOKEN_KEY non impostata');
    const { error: errSalva } = await admin.from('garmin_collegamenti').update({
      garmin_user_id: garminUserId,
      access_cifrato: await cifra(token.access, chiave),
      refresh_cifrato: await cifra(token.refresh, chiave),
      access_scade_at: token.accessScadeAt,
      refresh_scade_at: token.refreshScadeAt,
      permessi,
      stato: 'attivo',
      collegato_at: riga.collegato_at ?? adesso.toISOString(),
      aggiornato_at: adesso.toISOString(),
    }).eq('athlete_id', riga.athlete_id);
    if (errSalva) throw new Error(`collegamento non salvato: ${errSalva.message}`);

    // Il consenso anche nei metadati. Se non si scrive, il collegamento resta
    // valido (il consenso è già nella riga): si logga e basta.
    try {
      await scriviConsensoGarmin(admin, riga.athlete_id, {
        versione: riga.consenso_versione ?? VERSIONE_CONSENSO_GARMIN,
        il: riga.consenso_at ?? adesso.toISOString(),
      });
    } catch (e) {
      console.error(`garmin-auth: consenso_garmin non scritto per ${riga.athlete_id}:`, (e as Error).message);
    }

    console.log(`garmin-auth: ${riga.athlete_id} collegato (${permessi.join(',') || 'nessun permesso'})`);
    return vaiA(urlRitorno(ritorno, 'ok'));
  } catch (e) {
    console.error(`garmin-auth: callback fallito per ${riga.athlete_id}:`, (e as Error).message);
    return vaiA(urlRitorno(ritorno, 'errore', 'garmin'));
  }
}

// ── Il trigger «atleta eliminato» ──────────────────────────────────────────
async function interno(req: Request): Promise<Response> {
  if (!stessoSegreto(req.headers.get('x-garmin-interno'), Deno.env.get('GARMIN_INTERNO_TOKEN'))) {
    console.warn('garmin-auth: chiamata interna con segreto sbagliato');
    return risposta({ error: 'Non autorizzato' }, 401);
  }
  let corpo: unknown;
  try { corpo = await req.json(); } catch { return risposta({ error: 'Richiesta non valida' }, 400); }
  const athleteId = atletaEliminato(corpo);
  if (!athleteId) return risposta({ ok: true, ignorato: true });
  try {
    await scollegaAtleta(servizio(), athleteId, 'eliminato');
    return risposta({ ok: true });
  } catch (e) {
    console.error(`garmin-auth: scollegamento di ${athleteId} (eliminato) incompleto:`, (e as Error).message);
    return risposta({ error: 'Scollegamento incompleto' }, 500);
  }
}

// ── Le azioni dell'atleta (POST con JWT) ───────────────────────────────────
async function azioneAtleta(req: Request): Promise<Response> {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return risposta({ error: 'Accedi per collegare Garmin' }, 401);
  const anonimo = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!);
  const { data: auth, error: authErr } = await anonimo.auth.getUser(token);
  const utente = auth?.user;
  if (authErr || !utente) return risposta({ error: 'Accedi per collegare Garmin' }, 401);

  let corpo: Record<string, unknown>;
  try {
    const c = await req.json();
    if (!c || typeof c !== 'object') throw new Error();
    corpo = c as Record<string, unknown>;
  } catch { return risposta({ error: 'Richiesta non valida' }, 400); }

  const admin = servizio();
  // Lo staff non collega niente: nemmeno un admin in «Simula atleta».
  if (await ruoloStaff(admin, utente.email ?? null)) {
    return risposta({ error: 'Garmin si collega solo da un account atleta' }, 403);
  }

  if (corpo.azione === 'inizia') {
    if (corpo.consenso !== VERSIONE_CONSENSO_GARMIN) return risposta({ error: 'Serve il consenso' }, 400);
    if (!ritornoValido(corpo.ritorno, originiExtra())) return risposta({ error: 'Ritorno non valido' }, 400);

    const clientId = Deno.env.get('GARMIN_CLIENT_ID');
    if (!clientId) {
      console.error('garmin-auth: GARMIN_CLIENT_ID non impostata');
      return risposta({ error: 'Garmin non è disponibile ora' }, 500);
    }
    const { verifier, sfida } = await generaPkce();
    const state = generaState();
    const adesso = new Date().toISOString();
    // Solo i campi pkce_* e del consenso: una riga già `attivo` resta `attivo`
    // (una riga nuova nasce `in_attesa` per default).
    const { error } = await admin.from('garmin_collegamenti').upsert({
      athlete_id: utente.id,
      pkce_state: state,
      pkce_verifier: verifier,
      pkce_ritorno: corpo.ritorno as string,
      pkce_at: adesso,
      consenso_versione: VERSIONE_CONSENSO_GARMIN,
      consenso_at: adesso,
      aggiornato_at: adesso,
    }, { onConflict: 'athlete_id' });
    if (error) {
      console.error(`garmin-auth: inizia non salvato per ${utente.id}:`, error.message);
      return risposta({ error: 'Garmin non è disponibile ora' }, 500);
    }
    return risposta({ url: urlAutorizzazione({ clientId, sfida, state, redirectUri: REDIRECT_URI }) });
  }

  if (corpo.azione === 'scollega') {
    try {
      await scollegaAtleta(admin, utente.id, 'app');
      return risposta({ ok: true });
    } catch (e) {
      console.error(`garmin-auth: scollegamento di ${utente.id} incompleto:`, (e as Error).message);
      return risposta({ error: 'Scollegamento non riuscito. Riprova tra poco.' }, 500);
    }
  }

  return risposta({ error: 'Azione sconosciuta' }, 400);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    if (req.method === 'GET') return await callback(new URL(req.url));
    if (req.method !== 'POST') return risposta({ error: 'Metodo non ammesso' }, 405);
    if (req.headers.has('x-garmin-interno')) return await interno(req);
    return await azioneAtleta(req);
  } catch (e) {
    console.error('garmin-auth: errore inatteso:', (e as Error).message);
    if (req.method === 'GET') return vaiA(urlRitorno(RITORNO_DI_RISERVA, 'errore', 'garmin'));
    return risposta({ error: 'Errore inatteso' }, 500);
  }
});
