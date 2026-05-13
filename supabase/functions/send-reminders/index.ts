import "@supabase/functions-js/edge-runtime.d.ts"
import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"
import webpush from "npm:web-push@3.6.7"

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

webpush.setVapidDetails(
  'mailto:coaching@federicoleo.it', // Inserisci la tua email qui
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!
);

serve(async (req) => {
  // Gestione della richiesta preflight CORS (inviata dal browser prima della vera richiesta)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Decodifica il body della richiesta per capire se è mattina o sera
    let mode = 'morning'; // 'morning' o 'evening'
    let body: any = {};

    if (req.method === 'POST') {
      body = await req.json().catch(() => ({}));
      if (body.mode) mode = body.mode;
    }

    // ==========================================
    // MODALITÀ VOICE NOTE (Nuova nota vocale)
    // ==========================================
    if (mode === 'voice_note' && body.record_id) {
      console.log(`Notifica per nuova voice note (AW ID: ${body.record_id})`);
      
      const { data: assignment, error: awError } = await supabase
        .from('athlete_workouts')
        .select(`athlete_id, workouts(title)`)
        .eq('id', body.record_id)
        .single();

      if (awError || !assignment) throw awError || new Error("Assegnazione non trovata");

      const { data: subscriptions, error: subError } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', assignment.athlete_id);

      if (subError) throw subError;

      const notifications = [];
      for (const sub of subscriptions) {
        const title = "Nuova Nota Vocale! 🎙️";
        const bodyMsg = `Il coach ti ha lasciato un messaggio vocale per l'allenamento: ${(assignment.workouts as any).title}. Ascoltalo subito!`;
        const pushSubscription = { endpoint: sub.endpoint, keys: { auth: sub.auth, p256dh: sub.p256dh } };
        const payload = JSON.stringify({ title, body: bodyMsg, url: '/' });
        notifications.push(webpush.sendNotification(pushSubscription, payload).catch(async (error: any) => {
          if (error.statusCode === 404 || error.statusCode === 410) await supabase.from('push_subscriptions').delete().eq('id', sub.id);
        }));
      }
      await Promise.all(notifications);
      return new Response(JSON.stringify({ success: true, sent: notifications.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ==========================================
    // MODALITÀ IMMEDIATA (Nuovo workout assegnato)
    // ==========================================
    if (mode === 'immediate' && body.record_id) {
      console.log(`Controllo per nuovo workout assegnato (ID: ${body.record_id})`);
      
      const { data: assignment, error: awError } = await supabase
        .from('athlete_workouts')
        .select(`athlete_id, workouts(title)`)
        .eq('id', body.record_id)
        .single();

      if (awError || !assignment) throw awError || new Error("Assegnazione non trovata");

      const { data: subscriptions, error: subError } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', assignment.athlete_id);

      if (subError) throw subError;

      const notifications = [];
      for (const sub of subscriptions) {
        const title = "Nuovo Allenamento! 🏋️‍♂️";
        const bodyMsg = `Il coach ti ha appena assegnato: ${(assignment.workouts as any).title}. Dai un'occhiata!`;
        const pushSubscription = { endpoint: sub.endpoint, keys: { auth: sub.auth, p256dh: sub.p256dh } };
        const payload = JSON.stringify({ title, body: bodyMsg, url: '/' });
        notifications.push(webpush.sendNotification(pushSubscription, payload).catch(async (error: any) => {
          if (error.statusCode === 404 || error.statusCode === 410) await supabase.from('push_subscriptions').delete().eq('id', sub.id);
        }));
      }
      await Promise.all(notifications);
      return new Response(JSON.stringify({ success: true, sent: notifications.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ==========================================
    // MODALITÀ COACH NOTIFICATION
    // ==========================================
    if (mode === 'coach_notification') {
      console.log(`Notifica al coach da ${body.athleteName} per ${body.action}`);
      
      const adminEmails = ['coaching@federicoleo.it', 'alessandro.patrone@hotmail.it', 'federico_leo@hotmail.it', 'federico.leo88@gmail.com'];
      const { data: authData, error: authErr } = await supabase.auth.admin.listUsers();

      if (authErr) {
        console.error('Errore in listUsers:', authErr);
        throw authErr;
      }

      const adminUserIds = authData?.users
        ?.filter((u: any) => u.email && adminEmails.includes(u.email.toLowerCase()))
        .map((u: any) => u.id) || [];
        
      console.log('Trovati ID Admin:', adminUserIds);
      
      if (adminUserIds.length === 0) {
         return new Response(JSON.stringify({ success: true, message: 'Nessun admin trovato nel database' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const { data: subscriptions, error: subError } = await supabase
        .from('push_subscriptions')
        .select('*')
        .in('user_id', adminUserIds);

      if (subError) throw subError;

      let title = "Aggiornamento Atleta";
      let bodyMsg = "";

      if (body.action === 'note') {
        title = `📝 Nota da ${body.athleteName}`;
        bodyMsg = `${body.workoutTitle}: "${body.noteText}"`;
      } else if (body.action === 'completed') {
        title = `✅ Workout completato!`;
        bodyMsg = `${body.athleteName} ha completato: ${body.workoutTitle}`;
      } else if (body.action === 'custom_workout') {
        title = `🏃‍♂️ Nuovo allenamento libero`;
        bodyMsg = `${body.athleteName} ha aggiunto: ${body.workoutTitle}`;
      }

      const notifications = [];
      for (const sub of subscriptions) {
        const pushSubscription = { endpoint: sub.endpoint, keys: { auth: sub.auth, p256dh: sub.p256dh } };
        const payload = JSON.stringify({ title, body: bodyMsg, url: '/' });
        notifications.push(
          webpush.sendNotification(pushSubscription, payload).catch(async (error: any) => {
            if (error.statusCode === 404 || error.statusCode === 410) await supabase.from('push_subscriptions').delete().eq('id', sub.id);
          })
        );
      }
      await Promise.all(notifications);
      return new Response(JSON.stringify({ success: true, sent: notifications.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Se arriviamo fin qui e la modalità non è morning o evening, fermiamo tutto per sicurezza
    if (mode !== 'morning' && mode !== 'evening') {
      return new Response(JSON.stringify({ success: false, message: 'Modalità ignorata' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Calcola le date: "oggi" per la mattina, "domani" per la sera
    const targetDate = new Date();
    if (mode === 'evening') {
      targetDate.setDate(targetDate.getDate() + 1);
    }
    const dateStr = targetDate.toISOString().split('T')[0];

    console.log(`Controllo per la data: ${dateStr} (Modalità: ${mode})`);

    // 1. Recupera TUTTI i dispositivi iscritti alle notifiche
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*');

    if (subError) throw subError;

    console.log(`Trovati ${subscriptions?.length || 0} dispositivi registrati.`);

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ message: 'Nessun dispositivo a cui inviare notifiche.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 2. Trova tutti i workout assegnati per la data target non ancora completati
    const userIds = [...new Set(subscriptions.map(s => s.user_id))];
    const { data: assignments, error: awError } = await supabase
      .from('athlete_workouts')
      .select(`athlete_id, workouts(title)`)
      .eq('completed_date', dateStr)
      .neq('status', 'completed')
      .in('athlete_id', userIds);

    if (awError) throw awError;

    // 2.5 Recupera i nomi degli atleti per personalizzare il messaggio
    const { data: athletes } = await supabase
      .from('athletes')
      .select('id, name')
      .in('id', userIds);

    // 3. Prepara e invia le notifiche
    const notifications = [];
    for (const sub of subscriptions) {
      const assignment = assignments?.find(a => a.athlete_id === sub.user_id);
      const athleteName = athletes?.find(a => a.id === sub.user_id)?.name || 'Campione';
      
      let title = '';
      let bodyMsg = '';

      if (assignment) {
        title = mode === 'morning' ? `Buongiorno, ${athleteName}! ☀️` : "Preparati per domani! 🌙";
        bodyMsg = mode === 'morning' 
          ? `Oggi ti aspetta: ${(assignment.workouts as any).title}. Dai il massimo!`
          : `Domani in programma: ${(assignment.workouts as any).title}. Riposa bene!`;
      } else {
        title = mode === 'morning' ? "Giorno di Rest 🛋️" : "Domani Giorno di Rest 🛋️";
        bodyMsg = mode === 'morning'
          ? "Oggi non hai allenamenti in programma. Recupera le energie!"
          : "Domani non hai allenamenti in programma. Goditi il riposo!";
      }

      const pushSubscription = { endpoint: sub.endpoint, keys: { auth: sub.auth, p256dh: sub.p256dh } };
      const payload = JSON.stringify({ title, body: bodyMsg, url: '/' });

      notifications.push(
        webpush.sendNotification(pushSubscription, payload).catch(async (error: any) => {
          console.error('Errore invio notifica a', sub.endpoint, error);
          if (error.statusCode === 404 || error.statusCode === 410) await supabase.from('push_subscriptions').delete().eq('id', sub.id);
        })
      );
    }
    await Promise.all(notifications);
    console.log(`Notifiche inviate: ${notifications.length}`);
    return new Response(JSON.stringify({ success: true, sent: notifications.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('Errore globale:', error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});