// ricerca-coach — la ricerca del coach con l'IA, voce o testo.
//
// È un PASSACARTE fra l'app e Gemini, e non legge il database. Il giro è:
//   1. l'app manda la domanda, gli strumenti che sa eseguire e il contesto;
//   2. Gemini risponde con «chiama questo strumento con questi parametri»;
//   3. l'app lo esegue sui dati che il coach può già vedere (RLS) e rimanda
//      qui il risultato; si ripete finché Gemini non scrive la risposta.
// Istruzioni e strumenti stanno nel client (src/lib/dialogoRicerca.js), così
// cambiarli non richiede un deploy. Qui stanno solo le regole fisse.
//
// Perché una funzione NUOVA e non una modalità di `ai-workout`: un deploy di
// questa non tocca nient'altro, e la web app su `main` non la chiama.
//
// Secret:  GROQ_API_KEY   — la prima IA (vedi «GROQ PRIMA» più sotto).
//          GEMINI_API_KEY — la riserva; è la stessa chiave di ai-workout, e la
//                           sua quota gratuita è del builder, non della ricerca.
//          GROQ_MODELLO / GEMINI_MODELLI (facoltativi) cambiano i modelli.
//
// ⚠️ Solo admin, come ai-workout: l'URL del progetto è nel bundle pubblico, e
// senza controllo sarebbe un proxy Gemini aperto a chiunque.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"
import { ADMIN_EMAILS } from "../_shared/admin.ts"
import {
  daOpenAI, dettaglioErrore, estraiContenuto, inOpenAI, messaggioErrore, richiestaGemini,
  richiestaTrascrizione, validaCorpo,
} from "./regole.ts"
import { MODELLO_GROQ_PREDEFINITO, MODELLO_WHISPER, chatGroq, trascriviConWhisper } from "../_shared/groq.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// I modelli Gemini da provare, in ordine. Il secret GEMINI_MODELLI (separati da
// virgola) li cambia senza toccare il codice.
// ⚠️ 09/10/2026: `gemini-2.5-flash-lite` rispondeva 404 «no longer available to
// new users», e il 404 non faceva scattare Groq: la ricerca si fermava lì. Il
// successore indicato da Google è della famiglia Gemini 3, che tratta le firme
// del ragionamento in modo diverso (obbligatorie nelle chiamate a strumento):
// non lo si aggiunge senza provarlo. Il ripiego vero è Groq, più sotto.
const MODELLI = (Deno.env.get('GEMINI_MODELLI') || 'gemini-2.5-flash')
  .split(',').map(m => m.trim()).filter(Boolean)

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

// Un tentativo per modello: il coach sta aspettando con il telefono in mano,
// e ripetere sullo stesso modello un 429 non serve (la quota è al minuto).
/**
 * Vero se un fallimento merita il modello successivo: quota (429), server
 * pieno (5xx) o modello ritirato/inesistente (404). Un 400 no: è la richiesta
 * a essere sbagliata, e un altro modello la rifiuterebbe uguale.
 */
const daRipiegare = (stato: number) => stato === 429 || stato === 404 || stato >= 500;

async function chiamaGemini(corpo: unknown, chiave: string) {
  let ultima: Response | null = null;
  let usato = MODELLI[0];
  for (const modello of MODELLI) {
    usato = modello;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modello}:generateContent?key=${chiave}`;
    ultima = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
    });
    if (!daRipiegare(ultima.status)) break;
    console.warn(`ricerca-coach: ${modello} ha risposto ${ultima.status}, provo il successivo`);
  }
  return { res: ultima!, modello: usato };
}

// ── Il terzo livello: Groq ─────────────────────────────────────────────────
// Piano gratuito, API compatibile con OpenAI, e — da condizioni — non addestra
// sui dati: conta, perché qui passano estratti delle note degli atleti.
const MODELLO_GROQ = Deno.env.get('GROQ_MODELLO') || MODELLO_GROQ_PREDEFINITO;

async function domandaGroq(corpo: any, chiaveGroq: string) {
  const { stato, ok, dati } = await chatGroq(inOpenAI(corpo, MODELLO_GROQ), chiaveGroq);
  if (!ok) {
    console.error('ricerca-coach: Groq', stato, JSON.stringify(dati).slice(0, 500));
    return { error: messaggioErrore(stato), dettaglio: dettaglioErrore(`groq ${MODELLO_GROQ}`, stato, dati), stato };
  }
  const { contenuto, errore } = daOpenAI(dati);
  if (!contenuto) return { error: errore, dettaglio: dettaglioErrore(`groq ${MODELLO_GROQ}`, stato, dati) };
  return { contenuto, modello: `groq ${MODELLO_GROQ}` };
}

async function trascriviGroq(corpo: any, chiaveGroq: string) {
  const { stato, testo, dati } = await trascriviConWhisper(corpo.audioBase64, corpo.mimeType, chiaveGroq);
  if (testo == null) {
    console.error('ricerca-coach: Whisper', stato, JSON.stringify(dati).slice(0, 500));
    return { error: messaggioErrore(stato), dettaglio: dettaglioErrore(`groq ${MODELLO_WHISPER}`, stato, dati), stato };
  }
  return { testo };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  if (!(await chiamanteAdmin(req))) {
    console.warn('ricerca-coach: chiamata non autorizzata rifiutata');
    return risposta({ error: 'Non autorizzato' }, 401);
  }

  const chiave = Deno.env.get('GEMINI_API_KEY');
  const chiaveGroq = Deno.env.get('GROQ_API_KEY');
  if (!chiave && !chiaveGroq) return risposta({ error: 'Nessuna chiave IA configurata.' });

  let grezzo: unknown;
  try { grezzo = await req.json(); } catch { return risposta({ error: 'Richiesta illeggibile.' }); }
  const { corpo, errore } = validaCorpo(grezzo);
  if (!corpo) return risposta({ error: errore });

  // 🔴 GROQ PRIMA, Gemini dopo (09/10/2026). Il piano gratuito di Gemini 2.5
  // Flash dà 20 richieste AL GIORNO, e sono le stesse di «Genera con IA» nel
  // builder (stessa chiave): un pomeriggio di prove della ricerca, a due o tre
  // chiamate per domanda, le ha finite e ha lasciato il builder senza IA per
  // undici ore. La ricerca parte quindi da Groq (~1.000 al giorno) e tocca la
  // quota di Gemini solo se Groq è pieno, senza quota o irraggiungibile.
  if (chiaveGroq) {
    try {
      const g: any = corpo.tipo === 'trascrivi' ? await trascriviGroq(corpo, chiaveGroq) : await domandaGroq(corpo, chiaveGroq);
      if (!g.error || !chiave || !daRipiegare(g.stato)) return risposta(g);
      console.warn('ricerca-coach: Groq', g.stato, '→ ripiego su Gemini');
    } catch (e: any) {
      console.error('ricerca-coach: Groq irraggiungibile', e?.message || e);
      if (!chiave) return risposta({ error: "L'IA non ha risposto.", dettaglio: String(e?.message || e).slice(0, 160) });
    }
  }

  try {
    if (corpo.tipo === 'trascrivi') {
      const { res, modello } = await chiamaGemini(richiestaTrascrizione(corpo), chiave!);
      const dati = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error('ricerca-coach: trascrizione', res.status, JSON.stringify(dati).slice(0, 500));
        return risposta({ error: messaggioErrore(res.status), dettaglio: dettaglioErrore(modello, res.status, dati) });
      }
      const { contenuto, errore: e } = estraiContenuto(dati);
      if (!contenuto) return risposta({ error: e, dettaglio: dettaglioErrore(modello, res.status, dati) });
      const testo = (contenuto.parts as any[]).map(p => p?.text || '').join('').trim();
      return risposta({ testo });
    }

    const { res, modello } = await chiamaGemini(richiestaGemini(corpo), chiave!);
    const dati = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error('ricerca-coach: Gemini', res.status, JSON.stringify(dati).slice(0, 500));
      return risposta({ error: messaggioErrore(res.status), dettaglio: dettaglioErrore(modello, res.status, dati) });
    }
    const { contenuto, errore: e } = estraiContenuto(dati);
    if (!contenuto) {
      console.error('ricerca-coach: risposta vuota', JSON.stringify(dati).slice(0, 500));
      return risposta({ error: e, dettaglio: dettaglioErrore(modello, res.status, dati) });
    }
    return risposta({ contenuto, modello });
  } catch (e: any) {
    console.error('ricerca-coach:', e?.message || e);
    return risposta({ error: "L'IA non ha risposto.", dettaglio: String(e?.message || e).slice(0, 160) });
  }
});
