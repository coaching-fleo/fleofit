// gare-hyrox — il calendario delle gare HYROX, per scegliere un evento da una
// lista invece di scriverlo a mano (Calendario → «Nuovo evento»).
//
// Perché dal server e non dal telefono: dalla web app il browser bloccherebbe
// la richiesta a hyrox.com (CORS), e così la pagina si scarica una volta ogni
// qualche ora per tutti invece che da ogni telefono.
// Perché una funzione NUOVA: `main` non la chiama, quindi pubblicarla non
// tocca la web app in produzione (CLAUDE.md §1.1). Nessuna tabella: la copia
// vive nella memoria dell'istanza, e nel telefono (`fleofit_cache_gare_hyrox`).
//
// Nessun secret richiesto.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { type Gara, URL_GARE, leggiGare } from "./regole.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const risposta = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

// Il calendario HYROX cambia qualche volta a settimana: sei ore bastano.
const DURATA_COPIA = 6 * 3_600_000;
let copia: { gare: Gara[], aggiornate: string, scade: number } | null = null;

async function scarica(): Promise<Gara[]> {
  const r = await fetch(URL_GARE, {
    headers: {
      // ⚠️ Senza un User-Agent da browser il sito (dietro Cloudflare) può
      // rispondere 403.
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36',
      'Accept': 'text/html',
      'Accept-Language': 'en',
    },
  });
  if (!r.ok) throw new Error(`hyrox.com ha risposto ${r.status}`);
  return leggiGare(await r.text());
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST' && req.method !== 'GET') return risposta({ error: 'Metodo non ammesso' }, 405);

  if (copia && copia.scade > Date.now()) return risposta({ gare: copia.gare, aggiornate: copia.aggiornate });

  try {
    const gare = await scarica();
    // Una pagina letta ma senza gare vuol dire che il sito ha cambiato forma:
    // meglio la copia vecchia, se c'è, che una lista vuota presentata come vera.
    if (gare.length === 0) {
      console.error('gare-hyrox: pagina letta ma nessuna gara riconosciuta — il sito è cambiato?');
      if (copia) return risposta({ gare: copia.gare, aggiornate: copia.aggiornate });
      return risposta({ error: 'Calendario HYROX non leggibile' }, 502);
    }
    copia = { gare, aggiornate: new Date().toISOString(), scade: Date.now() + DURATA_COPIA };
    return risposta({ gare, aggiornate: copia.aggiornate });
  } catch (e) {
    console.error('gare-hyrox:', e);
    if (copia) return risposta({ gare: copia.gare, aggiornate: copia.aggiornate });
    return risposta({ error: 'Calendario HYROX non raggiungibile' }, 502);
  }
});
