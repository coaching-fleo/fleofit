// gare-corsa — il calendario delle gare di corsa su strada italiane (FIDAL),
// per scegliere una gara da una lista invece di scriverla a mano
// (Calendario → «Nuovo evento»).
//
// Perché dal server e non dal telefono: dalla web app il browser bloccherebbe
// la richiesta al sito della FIDAL (CORS), e così le pagine si scaricano una
// volta ogni qualche ora per tutti invece che da ogni telefono.
// Perché una funzione NUOVA: `main` non la chiama, quindi pubblicarla non
// tocca la web app in produzione (CLAUDE.md §1.1). Nessuna tabella: la copia
// vive nella memoria dell'istanza (e nel telefono, lato app).
//
// Nessun secret richiesto.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { type GaraCorsa, leggiGareCorsa, mesiDaLeggere, unisci, urlMese } from "./regole.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const risposta = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

// Il calendario cambia poco: sei ore bastano.
const DURATA_COPIA = 6 * 3_600_000;
// Se qualche pagina non ha risposto la lista è incompleta: si tiene poco, per riprovare presto.
const DURATA_COPIA_PARZIALE = 15 * 60_000;
let copia: { gare: GaraCorsa[], aggiornate: string, scade: number, completa: boolean } | null = null;

const INTESTAZIONI = {
  // ⚠️ Senza un User-Agent da browser il sito può rispondere 403.
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36',
  'Accept': 'text/html',
  'Accept-Language': 'it',
};

async function pagina(url: string): Promise<string> {
  const r = await fetch(url, { headers: INTESTAZIONI, signal: AbortSignal.timeout(10_000) });
  if (!r.ok) throw new Error(`il sito ha risposto ${r.status} su ${url}`);
  return r.text();
}

/** «Oggi» come yyyy-MM-dd nel fuso italiano (il server gira in UTC). */
const oggiInItalia = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome' }).format(new Date());

/**
 * 7 mesi × 2 livelli (nazionale/internazionale `COD` e regionale `REG`) = 14
 * pagine, con 4 lavoratori in parallelo. Una pagina che non risponde lascia
 * fuori le sue gare, non butta via le altre: ogni pagina ha il suo anno.
 * Torna anche quante pagine sono riuscite, per distinguere «tutto fallito».
 */
async function scarica(): Promise<{ gare: GaraCorsa[], riuscite: number, totali: number }> {
  const lavori = mesiDaLeggere(oggiInItalia())
    .flatMap(({ anno, mese }) => (['COD', 'REG'] as const).map((livello) => ({ anno, mese, livello })));
  const liste: GaraCorsa[][] = [];
  let riuscite = 0;
  const coda = [...lavori];
  const lavoratore = async () => {
    for (let l = coda.shift(); l; l = coda.shift()) {
      try {
        liste.push(leggiGareCorsa(await pagina(urlMese(l.anno, l.mese, l.livello)), l.anno));
        riuscite++;
      } catch (e) {
        console.warn(`gare-corsa: ${l.anno}-${l.mese} ${l.livello} non letta:`, e);
      }
    }
  };
  await Promise.all(Array.from({ length: 4 }, lavoratore));
  return { gare: unisci(liste), riuscite, totali: lavori.length };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST' && req.method !== 'GET') return risposta({ errore: 'Metodo non ammesso' }, 405);

  if (copia && copia.scade > Date.now()) return risposta({ gare: copia.gare, aggiornate: copia.aggiornate, completa: copia.completa });

  try {
    const { gare, riuscite, totali } = await scarica();
    // Nessuna pagina letta, o pagine lette ma zero gare (il sito ha cambiato
    // forma): meglio la copia vecchia, se c'è, che una lista vuota spacciata
    // per vera.
    if (riuscite === 0 || gare.length === 0) {
      console.error(`gare-corsa: ${riuscite}/${totali} pagine lette, ${gare.length} gare — il sito è cambiato?`);
      if (copia) return risposta({ gare: copia.gare, aggiornate: copia.aggiornate, completa: copia.completa });
      return risposta({ errore: 'Calendario gare non raggiungibile' }, 502);
    }
    const completa = riuscite === totali;
    copia = {
      gare, aggiornate: new Date().toISOString(), completa,
      scade: Date.now() + (completa ? DURATA_COPIA : DURATA_COPIA_PARZIALE),
    };
    return risposta({ gare, aggiornate: copia.aggiornate, completa });
  } catch (e) {
    console.error('gare-corsa:', e);
    if (copia) return risposta({ gare: copia.gare, aggiornate: copia.aggiornate, completa: copia.completa });
    return risposta({ errore: 'Calendario gare non raggiungibile' }, 502);
  }
});
