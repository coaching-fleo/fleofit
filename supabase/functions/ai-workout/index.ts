import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"
import { ADMIN_EMAILS } from "../_shared/admin.ts"

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
    return ADMIN_EMAILS.includes(email);
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
    // Se la richiesta va a buon fine o è un errore client (es. 400), usciamo dal loop
    if (res.status !== 429 && res.status < 500) {
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

        const geminiData = await geminiRes.json();
        if (!geminiData.candidates || geminiData.candidates.length === 0) {
          throw new Error("Errore trascrizione Gemini: " + JSON.stringify(geminiData));
        }
        transcription = geminiData.candidates[0].content.parts[0].text.trim();
        
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

    const systemPrompt = `
Traduci questo workout dettato a voce in un array JSON compatibile con l'app di fitness.
Tipi di blocco ammessi: "WarmUp", "Cash In", "ON/OFF", "EMOM", "AMRAP", "For Time", "Interval", "Rest", "Cash Out".
Devi restituire ESCLUSIVAMENTE la struttura JSON.

Esempio di struttura richiesta:
[
  {
    "type": "EMOM",
    "params": { "interval": "1:00", "rounds": "12" },
    "exercises": [
      { "name": "Burpees", "reps": "15" },
      { "name": "Wall Balls", "reps": "10", "kg": "9" },
      { "name": "Rowing", "meters": "250m" }
    ]
  }
]

Testo dettato dall'utente: "${prompt}"
`;

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

    const data = await response.json();
    if (!data.candidates) throw new Error(JSON.stringify(data));
    
    // Estraiamo il JSON dal testo dell'IA e lo processiamo
    let jsonString = data.candidates[0].content.parts[0].text;
    jsonString = jsonString.replace(/```json/gi, '').replace(/```/g, '').trim();
    
    const blocks = JSON.parse(jsonString);

    return new Response(JSON.stringify({ blocks }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
