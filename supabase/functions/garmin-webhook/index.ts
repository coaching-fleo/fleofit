// garmin-webhook — le notifiche che Garmin ci spinge: deregistrazioni (l'atleta
// ha tolto FLEOFIT da Garmin Connect) e cambi di permessi.
// Spec: docs/superpowers/specs/2026-10-27-garmin-design.md.
//
// Indirizzo da registrare nel portale Garmin:
//   https://riyqtcssllupakjtoehj.supabase.co/functions/v1/garmin-webhook?t=<GARMIN_WEBHOOK_TOKEN>
//
// `verify_jwt = false` (config.toml): Garmin chiama senza JWT Supabase. La
// protezione è il token `t` nell'indirizzo, confrontato in tempo costante.
// Le Fasi 1–2 aggiungono qui gli altri tipi di notifica.
//
// Risponde SEMPRE 200 a vuoto: Garmin non deve ritentare, e le voci sono
// indipendenti (una che fallisce non ferma le altre). Con `t` sbagliato non
// si tocca niente. Il token e l'indirizzo con la query non si loggano mai.
//
// Secret: GARMIN_WEBHOOK_TOKEN.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"
import { leggiNotifiche, stessoSegreto } from "../_shared/garminRegole.ts"
import { scollegaAtleta } from "../_shared/garmin.ts"

const ok = () => new Response(null, { status: 200 });

serve(async (req) => {
  try {
    if (req.method !== 'POST') return ok();

    const token = new URL(req.url).searchParams.get('t');
    if (!stessoSegreto(token, Deno.env.get('GARMIN_WEBHOOK_TOKEN'))) {
      console.warn('garmin-webhook: chiamata con token sbagliato, ignorata');
      return ok();
    }

    let corpo: unknown = null;
    try { corpo = await req.json(); } catch { /* corpo non JSON: leggiNotifiche non trova niente */ }
    const { revoche, permessi } = leggiNotifiche(corpo);
    if (!revoche.length && !permessi.length) return ok();

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Dal garmin_user_id all'atleta; null se non lo conosciamo.
    const atletaDi = async (garminUserId: string): Promise<string | null> => {
      const { data, error } = await admin.from('garmin_collegamenti')
        .select('athlete_id').eq('garmin_user_id', garminUserId).maybeSingle();
      if (error) throw new Error(`ricerca atleta: ${error.message}`);
      return data?.athlete_id ?? null;
    };

    for (const garminUserId of revoche) {
      try {
        const athleteId = await atletaDi(garminUserId);
        if (!athleteId) { console.warn('garmin-webhook: revoca per un utente Garmin sconosciuto, saltata'); continue; }
        await scollegaAtleta(admin, athleteId, 'garmin');
      } catch (e) {
        console.error('garmin-webhook: revoca non completata:', (e as Error).message);
      }
    }

    for (const { garminUserId, permessi: nuovi } of permessi) {
      try {
        const athleteId = await atletaDi(garminUserId);
        if (!athleteId) { console.warn('garmin-webhook: permessi per un utente Garmin sconosciuto, saltati'); continue; }
        const { error } = await admin.from('garmin_collegamenti')
          .update({ permessi: nuovi, aggiornato_at: new Date().toISOString() })
          .eq('athlete_id', athleteId);
        if (error) throw new Error(error.message);
        console.log(`garmin-webhook: permessi di ${athleteId} aggiornati (${nuovi.join(',') || 'nessuno'})`);
      } catch (e) {
        console.error('garmin-webhook: permessi non aggiornati:', (e as Error).message);
      }
    }
    return ok();
  } catch (e) {
    console.error('garmin-webhook: errore inatteso:', (e as Error).message);
    return ok();
  }
});
