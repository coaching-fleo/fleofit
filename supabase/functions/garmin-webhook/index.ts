// garmin-webhook — le notifiche che Garmin ci spinge: deregistrazioni (l'atleta
// ha tolto FLEOFIT da Garmin Connect), cambi di permessi e, dalla Fase 1, le
// attività dell'orologio (salvate e, se si può, abbinate al workout: attivita.ts)
// e, dalla Fase 2, sonno, HRV e giornata (giornate.ts).
// Spec: docs/superpowers/specs/2026-10-27-garmin-design.md.
//
// Indirizzo da registrare nel portale Garmin, col token NEL PERCORSO (Garmin
// toglie la query quando chiama: visto nei log il 28/10/2026):
//   https://riyqtcssllupakjtoehj.supabase.co/functions/v1/garmin-webhook/<GARMIN_WEBHOOK_TOKEN>
//
// `verify_jwt = false` (config.toml): Garmin chiama senza JWT Supabase. La
// protezione è il token nel percorso dell'indirizzo, confrontato in tempo costante.
//
// Risponde SEMPRE 200 a vuoto, e SUBITO: tutto il lavoro sul database gira in
// sottofondo (`inSottofondo`, come garmin-training). Garmin non deve ritentare, e le voci sono
// indipendenti (una che fallisce non ferma le altre). Con `t` sbagliato non
// si tocca niente. Il token e l'indirizzo completo non si loggano mai.
//
// Secret: GARMIN_WEBHOOK_TOKEN.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"
import { leggiNotifiche, stessoSegreto, tokenWebhook } from "../_shared/garminRegole.ts"
import { scollegaAtleta } from "../_shared/garmin.ts"
import { leggiAttivita } from "../_shared/attivitaGarmin.ts"
import { leggiGiornate } from "../_shared/giornateGarmin.ts"
import { gestisciAttivita } from "./attivita.ts"
import { gestisciGiornate } from "./giornate.ts"

const ok = () => new Response(null, { status: 200 });

/** Il lavoro continua dopo la risposta (EdgeRuntime.waitUntil); fuori dal runtime si aspetta. */
async function inSottofondo(lavoro: Promise<void>): Promise<void> {
  // deno-lint-ignore no-explicit-any
  const runtime = (globalThis as any).EdgeRuntime;
  if (typeof runtime?.waitUntil === 'function') runtime.waitUntil(lavoro);
  else await lavoro;
}

/** Le revoche e i cambi di permessi (Fase 0): ogni voce col suo try/catch. */
async function revocheEPermessi(
  // deno-lint-ignore no-explicit-any
  admin: any,
  revoche: string[],
  permessi: { garminUserId: string; permessi: string[] }[],
): Promise<void> {
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
}

serve(async (req) => {
  try {
    if (req.method !== 'POST') return ok();

    const token = tokenWebhook(req.url);
    if (!stessoSegreto(token, Deno.env.get('GARMIN_WEBHOOK_TOKEN'))) {
      // Solo presenza e lunghezze, mai il valore: bastano a distinguere un token
      // ricopiato male da un indirizzo a cui Garmin ha tolto la query.
      const atteso = Deno.env.get('GARMIN_WEBHOOK_TOKEN') ?? '';
      console.warn(`garmin-webhook: chiamata con token sbagliato, ignorata (t ${token === null ? 'assente' : `di ${token.length} caratteri`}, atteso di ${atteso.length})`);
      return ok();
    }

    let corpo: unknown = null;
    try { corpo = await req.json(); } catch { /* corpo non JSON: leggiNotifiche non trova niente */ }
    const { revoche, permessi } = leggiNotifiche(corpo);
    const attivita = leggiAttivita(corpo);
    const giornate = leggiGiornate(corpo);
    if (!attivita.length && !giornate.length && !revoche.length && !permessi.length) {
      // Solo i NOMI dei campi, mai i valori: dicono che cosa manda Garmin senza esporre dati.
      const chiavi = corpo && typeof corpo === 'object' ? Object.keys(corpo).join(',') : typeof corpo;
      console.warn(`garmin-webhook: nessuna voce riconosciuta (campi: ${chiavi || 'nessuno'})`);
      return ok();
    }
    console.log(`garmin-webhook: ${attivita.length} attività, ${giornate.length} di recupero, ${revoche.length} revoche, ${permessi.length} cambi di permessi`);

    // Una promessa sola, che non rifiuta MAI: ogni voce ha il suo try/catch.
    await inSottofondo((async () => {
      try {
        const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
        await revocheEPermessi(admin, revoche, permessi);
        if (attivita.length) await gestisciAttivita(admin, attivita);
        if (giornate.length) await gestisciGiornate(admin, giornate);
      } catch (e) {
        console.error('garmin-webhook: errore inatteso in sottofondo:', (e as Error).message);
      }
    })());
    return ok();
  } catch (e) {
    console.error('garmin-webhook: errore inatteso:', (e as Error).message);
    return ok();
  }
});
