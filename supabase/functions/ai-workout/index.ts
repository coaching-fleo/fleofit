import { serve } from "https://deno.land/std@0.177.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  try {
    const { prompt } = await req.json();
    const apiKey = Deno.env.get('GEMINI_API_KEY');

    if (!apiKey) {
      throw new Error("Chiave API GEMINI_API_KEY non trovata. Esegui: npx supabase secrets set GEMINI_API_KEY=tua_chiave");
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

    // Chiamata gratuita all'API del nuovo modello Gemini 2.5 Flash
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
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
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
