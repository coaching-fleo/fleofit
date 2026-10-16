import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "npm:@supabase/supabase-js@2.39.3"
import { ruoloStaff } from "../_shared/staff.ts"
import { MODELLO_GROQ_PREDEFINITO, chatGroq, trascriviConWhisper } from "../_shared/groq.ts"
import { CATEGORIE_IA, categoriaIA, daRipiegare, istruzioniModifica, messaggioErrore, promptCategoria, richiestaGroq, risultatoDaTesto } from "./regole.ts"

// Riserva su Groq quando Gemini è senza quota (09/10/2026): il piano gratuito
// di Gemini 2.5 Flash dà 20 richieste al giorno, e finite quelle il builder
// restava senza «Genera con IA» fino al giorno dopo. Senza GROQ_API_KEY la
// funzione si comporta come prima.
const MODELLO_GROQ = Deno.env.get('GROQ_MODELLO') || MODELLO_GROQ_PREDEFINITO

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};


// Senza questo controllo l'endpoint è un proxy Gemini aperto a Internet: l'URL
// del progetto è in chiaro nel bundle JS pubblico, quindi chiunque potrebbe
// bruciare GEMINI_API_KEY e usare la trascrizione audio gratis.
async function chiamanteAdmin(req: Request): Promise<boolean> {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return false;
  if (token === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) return true;
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
    );
    const { data, error } = await supabase.auth.getUser(token);
    const email = data?.user?.email?.trim().toLowerCase();
    if (error || !email) return false;
    // Staff = admin o coach (tabella `staff`, riserva ADMIN_EMAILS).
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    return (await ruoloStaff(db, email)) !== null;
  } catch {
    return false;
  }
}

// Funzione helper per riprovare le chiamate API in caso di server sovraccarico (503) o rate limit (429)
async function fetchWithRetry(url: string, options: any, maxRetries = 3) {
  let lastResponse: Response | null = null;
  for (let i = 0; i < maxRetries; i++) {
    const res = await fetch(url, options);
    lastResponse = res;
    // Si ritenta SOLO su 5xx (server pieno, passa in pochi secondi). Un 429 sul
    // piano gratuito è la quota del GIORNO: ritentarlo bruciava altre
    // richieste e sette secondi d'attesa prima di dire comunque di no.
    if (res.status < 500) {
      return res;
    }
    // Se siamo all'ultimo tentativo, non aspettare e interrompi
    if (i === maxRetries - 1) break;
    
    // Exponential backoff: aspetta 1s, poi 2s, poi 4s... più un po' di "jitter" (ritardo casuale)
    const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
    console.log(`Errore API ${res.status}. Ritento tra ${Math.round(delay)}ms... (Tentativo ${i + 1} di ${maxRetries})`);
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  return lastResponse!;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (!(await chiamanteAdmin(req))) {
    console.warn('ai-workout: chiamata non autorizzata rifiutata');
    return new Response(JSON.stringify({ error: 'Non autorizzato' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();

    let prompt = body.prompt || "";

    // ==========================================
    // 1. TRASCRIZIONE AUDIO (Se riceviamo l'audio)
    // ==========================================
    if (body.audioBase64) {
      let transcription = "";
      const geminiKey = Deno.env.get('GEMINI_API_KEY');
      const mimeType = body.mimeType || 'audio/aac'; // Fallback per sicurezza
      // Fallback sicuro per formati nativi iOS diretti a Gemini
      const geminiMimeType = mimeType.includes('m4a') ? 'audio/mp4' : mimeType;

      if (geminiKey) {
        // --- GEMINI 2.5 FLASH ---
        const geminiRes = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: "Trascrivi esattamente questo audio in italiano, parola per parola. Rispondi ESCLUSIVAMENTE con il testo trascritto, senza aggiungere virgolette, formattazioni o introduzioni." },
                {
                  inlineData: {
                    mimeType: geminiMimeType,
                    data: body.audioBase64
                  }
                }
              ]
            }]
          })
        });

        const geminiData = await geminiRes.json().catch(() => ({}));
        const chiaveGroq = Deno.env.get('GROQ_API_KEY');
        if (!geminiData.candidates || geminiData.candidates.length === 0) {
          console.error('ai-workout: trascrizione Gemini', geminiRes.status, JSON.stringify(geminiData).slice(0, 500));
          if (!chiaveGroq || !daRipiegare(geminiRes.status)) throw new Error(messaggioErrore(geminiRes.status));
          const w = await trascriviConWhisper(body.audioBase64, geminiMimeType, chiaveGroq);
          if (w.testo == null) {
            console.error('ai-workout: Whisper', w.stato, JSON.stringify(w.dati).slice(0, 500));
            throw new Error(messaggioErrore(w.stato));
          }
          transcription = w.testo;
        } else {
          transcription = geminiData.candidates[0].content.parts[0].text.trim();
        }
        
      } else {
        throw new Error("Nessuna chiave API configurata in Supabase per la trascrizione (GEMINI).");
      }

      // Uniamo il testo eventualmente scritto a mano con la trascrizione vocale
      prompt = prompt ? `${prompt} ${transcription}` : transcription;
    }

    // ==========================================
    // 2. GENERAZIONE SCHEDA (Se riceviamo il testo)
    // ==========================================
    if (!prompt) throw new Error("Nessun prompt testuale fornito.");

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error("Chiave API GEMINI_API_KEY non trovata per generare l'allenamento.");
    }

    // La categoria del builder (12/10/2026): Hyrox scrive blocchi, Corsa
    // fasi, Custom una descrizione. Senza `categoria` è Hyrox, come chiedeva
    // l'app fino ad allora (regole.ts, CATEGORIE_IA).
    const categoria = categoriaIA(body.categoria);
    if (!categoria) throw new Error("Questa categoria non ha ancora la generazione con IA.");
    const { chiave } = CATEGORIE_IA[categoria];

    // Con l'allenamento già nel builder la richiesta è una MODIFICA: l'IA
    // restituisce l'allenamento intero e il client sostituisce (12/10/2026).
    // Senza, si genera come prima e il client aggiunge in coda.
    // `blocchiAttuali` è il nome che mandava l'app prima delle categorie.
    const attuali = body.attuali ?? body.blocchiAttuali;
    const modifica = istruzioniModifica(attuali, categoria);
    const systemPrompt = promptCategoria(categoria, prompt, attuali);

    // Chiamata gratuita all'API del modello Gemini 2.5 Flash
    const response = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: systemPrompt }] }],
        // Forza l'IA a rispondere con un JSON puro e valido!
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    const data = await response.json().catch(() => ({}));
    let risultato: unknown[] | string | null = null;
    if (data.candidates) {
      risultato = risultatoDaTesto(data.candidates[0].content.parts[0].text, categoria);
      if (!risultato) throw new Error("L'IA ha risposto in un formato illeggibile: riprova.");
    } else {
      console.error('ai-workout: Gemini', response.status, JSON.stringify(data).slice(0, 500));
      const chiaveGroq = Deno.env.get('GROQ_API_KEY');
      if (!chiaveGroq || !daRipiegare(response.status)) throw new Error(messaggioErrore(response.status));
      // La riserva: stesso prompt, a Groq.
      const g = await chatGroq(richiestaGroq(systemPrompt, MODELLO_GROQ, categoria), chiaveGroq);
      if (!g.ok) {
        console.error('ai-workout: Groq', g.stato, JSON.stringify(g.dati).slice(0, 500));
        throw new Error(messaggioErrore(g.stato));
      }
      risultato = risultatoDaTesto(g.dati?.choices?.[0]?.message?.content, categoria);
      if (!risultato) throw new Error("L'IA di riserva ha risposto in un formato illeggibile: riprova.");
    }

    // `modifica` dice al client se SOSTITUIRE o aggiungere: un client vecchio
    // non lo legge e aggiunge, come ha sempre fatto. Il risultato sta sotto la
    // sua chiave (`blocks`, `steps`, `testo`), e `categoria` dice al client che
    // la funzione conosce le categorie: una versione vecchia non la manda.
    return new Response(JSON.stringify({ categoria, [chiave]: risultato, modifica: !!modifica }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
