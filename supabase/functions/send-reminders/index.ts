import "@supabase/functions-js/edge-runtime.d.ts"
import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"
import webpush from "npm:web-push@3.6.7"
import { ADMIN_EMAILS } from "../_shared/admin.ts"

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);


// Identifica chi sta chiamando LEGGENDO I CLAIM DEL JWT, non con auth.getUser().
//
// Con verify_jwt = true la piattaforma Supabase ha GIÀ verificato la firma del
// token prima di eseguire questo codice: a questo punto il payload è autentico e
// si può leggere direttamente. La versione precedente chiamava getUser() e, se
// quella chiamata falliva per qualsiasi motivo, il chiamante risultava "anonimo"
// e un coach legittimo veniva bloccato. È successo in produzione.
//
// Il token della anon key ha role='anon' e nessuna email; quello di un utente
// loggato ha role='authenticated' e l'email. Nei log si vede la differenza.
function leggiClaim(token: string): Record<string, any> | null {
  try {
    const parte = token.split('.')[1];
    if (!parte) return null;
    const b64 = parte.replace(/-/g, '+').replace(/_/g, '/');
    const pieno = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const byte = Uint8Array.from(atob(pieno), (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(byte));
  } catch {
    return null;
  }
}

async function identificaChiamante(req: Request): Promise<{ admin: boolean; email: string | null; ruolo: string | null; servizio: boolean }> {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return { admin: false, email: null, ruolo: null, servizio: false };
  if (token === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) return { admin: true, email: null, ruolo: 'service_role', servizio: true };

  const claim = leggiClaim(token);
  const ruolo = claim?.role ?? null;
  if (ruolo === 'service_role') return { admin: true, email: null, ruolo, servizio: true };
  const email = typeof claim?.email === 'string' ? claim.email.trim().toLowerCase() : null;
  return { admin: !!email && ADMIN_EMAILS.includes(email), email, ruolo, servizio: false };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

webpush.setVapidDetails(
  'mailto:coaching@federicoleo.it', // Inserisci la tua email qui
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!
);

// --- FUNZIONE DI SUPPORTO PER GENERARE TOKEN GOOGLE OAUTH2 ---
// Usa le Web Crypto API native di Deno, aggirando completamente
// i bug di incompatibilità tra Deno e i pacchetti NPM come google-auth-library.
async function getGoogleAccessToken(clientEmail: string, privateKey: string): Promise<string> {
  const arrayBufferToBase64Url = (buffer: ArrayBuffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  };

  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const unsignedToken = `${arrayBufferToBase64Url(new TextEncoder().encode(JSON.stringify(header)).buffer)}.${arrayBufferToBase64Url(new TextEncoder().encode(JSON.stringify(payload)).buffer)}`;

  const pemContents = privateKey.replace(/-----BEGIN PRIVATE KEY-----/, '').replace(/-----END PRIVATE KEY-----/, '').replace(/\s/g, '');
  const binaryDerString = atob(pemContents);
  const binaryDer = new Uint8Array(binaryDerString.length);
  for (let i = 0; i < binaryDerString.length; i++) {
    binaryDer[i] = binaryDerString.charCodeAt(i);
  }

  const cryptoKey = await crypto.subtle.importKey('pkcs8', binaryDer.buffer, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(unsignedToken));
  const signedJwt = `${unsignedToken}.${arrayBufferToBase64Url(signature)}`;

  // Utilizza URLSearchParams per assicurare la corretta formattazione URL-encoded (i "due punti" in urn:ietf vanno convertiti)
  const bodyParams = new URLSearchParams();
  bodyParams.append('grant_type', 'urn:ietf:params:oauth:grant-type:jwt-bearer');
  bodyParams.append('assertion', signedJwt);

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: bodyParams.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`FCM Token Generation Failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  if (!data.access_token) {
    throw new Error(`Google Auth response missing access_token: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

// Inizializzazione Firebase Admin per le notifiche native iOS/Android
const firebaseServiceAccountStr = Deno.env.get('FIREBASE_SERVICE_ACCOUNT') || '{}';
const firebaseServiceAccount = JSON.parse(firebaseServiceAccountStr);

if (firebaseServiceAccount.private_key) {
  // Corregge le andate a capo della chiave privata che spesso si corrompono nei Secret
  firebaseServiceAccount.private_key = firebaseServiceAccount.private_key.replace(/\\n/g, '\n');
}

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

    // ── Controllo di autorizzazione, per modalità ────────────────────────────
    // Prima bastava un JWT valido qualsiasi: un atleta poteva far partire una
    // push a TUTTI gli iscritti, o falsificare una notifica con un record_id
    // altrui.
    //
    // 'coach_notification' resta aperta agli autenticati: è il client
    // DELL'ATLETA a invocarla quando completa un workout o lascia una nota.
    //
    // 'morning' e 'evening' sono in OSSERVAZIONE, non bloccate: il cron è
    // configurato dentro Supabase e non sappiamo con quale identità invochi.
    // Bloccarle alla cieca spegnerebbe i promemoria di tutti gli atleti.
    // Controllare i log della funzione: se le esecuzioni pianificate risultano
    // 'servizio' o admin, mettere APPLICA_CONTROLLO_CRON = true.
    // ⚠️ 25/08/2026 — TUTTO IN OSSERVAZIONE, NIENTE VIENE BLOCCATO.
    // Subito dopo il primo deploy con il controllo attivo è stato segnalato che
    // l'assegnazione di un workout non faceva più arrivare la push. Non sappiamo
    // ancora se la causa sia questo controllo o altro: fino a prova contraria il
    // servizio viene prima. La funzione logga l'esito che AVREBBE avuto, così i
    // log dicono se era lei senza che nessun atleta resti senza notifiche.
    const APPLICA_CONTROLLO_CRON = true;
    const APPLICA_CONTROLLO_ADMIN = true;
    const chiamante = await identificaChiamante(req);
    const soloAdmin = ['immediate', 'voice_note'];
    const modiCron = ['morning', 'evening'];

    console.log(`send-reminders: mode='${mode}' ruolo=${chiamante.ruolo ?? 'nessuno'} email=${chiamante.email ?? 'nessuna'} admin=${chiamante.admin}`);

    if (soloAdmin.includes(mode) && !chiamante.admin) {
      console.warn(`send-reminders: '${mode}' NON autorizzata per ${chiamante.email ?? 'anonimo'} (blocco attivo: ${APPLICA_CONTROLLO_ADMIN})`);
      if (APPLICA_CONTROLLO_ADMIN) {
        return new Response(JSON.stringify({ error: 'Non autorizzato' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (modiCron.includes(mode)) {
      // Terza via oltre all'admin e al token di servizio: un segreto condiviso.
      // Serve quando il cron invoca con la anon key — in quel caso l'identità nel
      // JWT non basta, perché quella chiave ce l'ha chiunque abbia il bundle JS.
      // Si imposta con: supabase secrets set CRON_SECRET=<valore lungo e casuale>
      // e si aggiunge alla chiamata del cron l'header x-cron-secret.
      // Se CRON_SECRET non è impostato, questa via è semplicemente disattivata.
      const segretoAtteso = Deno.env.get('CRON_SECRET');
      const segretoRicevuto = req.headers.get('x-cron-secret');
      const daCron = !!segretoAtteso && segretoRicevuto === segretoAtteso;

      const origine = daCron ? 'segreto cron'
        : chiamante.servizio ? 'token di servizio'
        : (chiamante.email ?? 'anonimo');
      console.log(`send-reminders: '${mode}' invocata da ${origine} (admin=${chiamante.admin}, segreto=${daCron})`);

      if (APPLICA_CONTROLLO_CRON && !chiamante.admin && !daCron) {
        return new Response(JSON.stringify({ error: 'Non autorizzato' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }


// Helper per inviare la notifica in base al tipo di token (con ID notifica nascosto)
    const sendPush = async (sub: any, title: string, bodyMsg: string, route: string = '/', notifId?: string) => {
      try {
        if (sub.auth === 'capacitor_ios') {
          if (firebaseServiceAccount.client_email && firebaseServiceAccount.private_key) {
            const accessToken = await getGoogleAccessToken(firebaseServiceAccount.client_email, firebaseServiceAccount.private_key);

            // Calcola il nuovo contatore per il badge e aggiorna il DB in background
            const newBadgeCount = (sub.badge_count || 0) + 1;
            supabase.from('push_subscriptions').update({ badge_count: newBadgeCount }).eq('id', sub.id).then();

            const res = await fetch(
              `https://fcm.googleapis.com/v1/projects/${firebaseServiceAccount.project_id.trim()}/messages:send`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${accessToken.trim()}`
                },
                body: JSON.stringify({
                  message: {
                    token: sub.endpoint,
                    notification: { title: title, body: bodyMsg },
                    data: { route: route, notif_id: notifId || '' },
                    apns: {
                      payload: {
                        aps: {
                          badge: newBadgeCount,
                          sound: "default"
                        }
                      }
                    }
                  },
                }),
              }
            );
            if (!res.ok) {
              const errorText = await res.text();
              // Si cancella il token SOLO quando FCM dice che è morto.
              // Prima si cancellava anche su INVALID_ARGUMENT, che invece
              // significa quasi sempre richiesta malformata o token registrato
              // in un ambiente APNs diverso da quello configurato su Firebase
              // (tipico delle build lanciate da Xcode, che usano il sandbox).
              // Così un problema di CONFIGURAZIONE disiscriveva l'utente dalle
              // push per sempre, in silenzio.
              const tokenMorto = res.status === 404
                || errorText.includes('UNREGISTERED')
                || errorText.includes('NOT_FOUND');
              if (tokenMorto) {
                console.warn(`FCM: token morto, rimosso (sub ${sub.id}): ${errorText}`);
                await supabase.from('push_subscriptions').delete().eq('id', sub.id);
              } else {
                console.error(`FCM ${res.status} per sub ${sub.id} — token CONSERVATO: ${errorText}`);
              }
            }
          } else console.error("Firebase Service Account mancante o non valido.");
        } else {
          const pushSubscription = { endpoint: sub.endpoint, keys: { auth: sub.auth, p256dh: sub.p256dh } };
          const payload = JSON.stringify({ title, body: bodyMsg, url: route });
          await webpush.sendNotification(pushSubscription, payload);
        }
      } catch (error: any) {
        console.error('Errore invio notifica a', sub.endpoint, error);
        if (error.statusCode === 404 || error.statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id);
        }
      }
    };

    // ==========================================
    // MODALITÀ VOICE NOTE (Nuova nota vocale)
    // ==========================================
    if (mode === 'voice_note' && body.record_id) {
      console.log(`Notifica per nuova voice note (AW ID: ${body.record_id})`);
      
      const { data: assignment, error: awError } = await supabase
        .from('athlete_workouts')
        .select(`athlete_id, workout_id, workouts(title, sections)`)
        .eq('id', body.record_id)
        .maybeSingle();

      // maybeSingle e non single: con single() una riga sparita (assegnazione
      // eliminata fra la creazione e la notifica) fa lanciare la funzione e
      // restituire 500. Qui non c'è niente da notificare, non c'è un errore.
      if (awError) throw awError;
      if (!assignment) {
        console.warn(`Assegnazione ${body.record_id} non trovata: niente da notificare.`);
        return new Response(JSON.stringify({ skipped: 'assegnazione non trovata' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: subscriptions, error: subError } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', assignment.athlete_id);

      if (subError) throw subError;

      const title = "Nuova Nota Vocale! 🎙️";
      const bodyMsg = `Il coach ti ha lasciato un messaggio vocale per l'allenamento: ${(assignment.workouts as any).title}. Ascoltalo subito!`;
      const route = `/workout/${assignment.workout_id}?athlete_id=${assignment.athlete_id}`;

      const { data: dbNotifs, error: dbErr } = await supabase.from('notifications').insert({
        user_id: assignment.athlete_id,
        title,
        message: bodyMsg,
        route
            }).select();

      if (dbErr) console.error("Errore DB (voice_note):", dbErr);
            const notifId = dbNotifs && dbNotifs.length > 0 ? dbNotifs[0].id : undefined;


      const notifications = [];
      for (const sub of subscriptions) {
        notifications.push(sendPush(sub, title, bodyMsg, route, notifId));
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
        .select(`athlete_id, workout_id, workouts(title)`)
        .eq('id', body.record_id)
        .maybeSingle();

      if (awError) throw awError;
      if (!assignment) {
        console.warn(`Nota vocale: assegnazione ${body.record_id} non trovata, niente da notificare.`);
        return new Response(JSON.stringify({ skipped: 'assegnazione non trovata' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: subscriptions, error: subError } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', assignment.athlete_id);

      if (subError) throw subError;

      // Una gara in calendario non è un allenamento assegnato: il testo lo dice.
      const w = assignment.workouts as any;
      const isEvento = w?.sections?.isEvent === true || w?.sections?.category === 'Event';
      const title = isEvento ? "Nuovo Obiettivo in Calendario 🏁" : "Nuovo Allenamento! 🏋️‍♂️";
      const bodyMsg = isEvento
        ? `Il coach ha aggiunto al tuo calendario: ${w.title}. Preparati!`
        : `Il coach ti ha appena assegnato: ${w.title}. Dai un'occhiata!`;
      const route = `/workout/${assignment.workout_id}?athlete_id=${assignment.athlete_id}`;

            const { data: dbNotifs, error: dbErr } = await supabase.from('notifications').insert({

        user_id: assignment.athlete_id,
        title,
        message: bodyMsg,
        route
      }).select();
      if (dbErr) console.error("Errore DB (immediate):", dbErr);
      const notifId = dbNotifs && dbNotifs.length > 0 ? dbNotifs[0].id : undefined;


      const notifications = [];
      for (const sub of subscriptions) {
        notifications.push(sendPush(sub, title, bodyMsg, route, notifId));
      }
      await Promise.all(notifications);
      return new Response(JSON.stringify({ success: true, sent: notifications.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ==========================================
    // MODALITÀ COACH NOTIFICATION
    // ==========================================
    if (mode === 'coach_notification') {
      console.log(`Notifica al coach da ${body.athleteName} per ${body.action}`);
      
      // Recupera gli ID degli admin scorrendo la lista utenti di Supabase in modo sicuro
      // Deve restare allineata a ADMIN_EMAILS in src/App.jsx.
      // 'demo@fleofit.it' è l'account fornito ad App Review.
      const adminEmails = ADMIN_EMAILS;
      const adminUserIds: string[] = [];
      let page = 1;
      while (true) {
        const { data: authData, error: authErr } = await supabase.auth.admin.listUsers({ page, perPage: 50 });
        if (authErr) {
          console.error('Errore in listUsers:', authErr);
          throw authErr;
        }
        const users = authData?.users || [];
        if (users.length === 0) break;
        const foundIds = users
          .filter((u: any) => u.email && adminEmails.includes(u.email.trim().toLowerCase()))
          .map((u: any) => u.id);
        adminUserIds.push(...foundIds);
        if (users.length < 50) break;
        page++;
      }

      console.log('Trovati ID Admin:', adminUserIds);
      
      if (adminUserIds.length === 0) {
         return new Response(JSON.stringify({ success: true, message: 'Nessun admin trovato o iscritto alle notifiche' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Recupera direttamente dal database solo le iscrizioni push degli admin
      const { data: adminSubscriptions, error: subError } = await supabase
        .from('push_subscriptions')
        .select('*')
        .in('user_id', adminUserIds);

      if (subError) throw subError;

      console.log(`Trovate ${adminSubscriptions?.length || 0} iscrizioni push per gli Admin.`);

      if (!adminSubscriptions || adminSubscriptions.length === 0) {
         console.log('Attenzione: Nessun dispositivo admin ha le notifiche attive nel database.');
         return new Response(JSON.stringify({ success: true, message: 'Nessun dispositivo admin iscritto' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Un'action non riconosciuta produceva una notifica con titolo generico e
      // corpo VUOTO, spedita a tutti gli admin. Meglio rifiutare: una push senza
      // testo non serve a nessuno e non deve poter nascere da un typo.
      const azioniValide = ['note', 'completed', 'custom_workout'];
      if (!azioniValide.includes(body.action)) {
        console.warn(`coach_notification: action '${body.action}' non riconosciuta, ignorata.`);
        return new Response(JSON.stringify({ error: `action non valida: ${body.action}` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      let title = "Aggiornamento Atleta";
      let bodyMsg = "";
      const route = body.route || "/";

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

      const notifInserts = adminUserIds.map(adminId => ({
        user_id: adminId,
        title,
        message: bodyMsg,
        route
      }));
            let insertedNotifs: any[] = [];

      if (notifInserts.length > 0) {
        const { data: dbNotifs, error: dbErr } = await supabase.from('notifications').insert(notifInserts).select();
        if (dbErr) console.error("Errore DB (coach_notification):", dbErr);
                if (dbNotifs) insertedNotifs = dbNotifs;

      }

      const notifications = [];
      for (const sub of adminSubscriptions) {
        const adminNotif = insertedNotifs.find(n => n.user_id === sub.user_id);
        notifications.push(sendPush(sub, title, bodyMsg, route, adminNotif?.id));
      }
      console.log(`Sto per inviare ${notifications.length} notifiche ai coach...`);
      await Promise.all(notifications);
      console.log('Notifiche inviate con successo ai coach.');
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
    const notifInserts = [];
    const seenUsers = new Set();
        const pushTasksData = [];


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

      pushTasksData.push({ sub, title, bodyMsg, route: '/' });


      if (!seenUsers.has(sub.user_id)) {
        seenUsers.add(sub.user_id);
        notifInserts.push({
          user_id: sub.user_id,
          title,
          message: bodyMsg,
          route: '/'
        });
      }
      }
          let insertedNotifs: any[] = [];
    if (notifInserts.length > 0) {
      const { data: dbNotifs, error: dbErr } = await supabase.from('notifications').insert(notifInserts).select();
      if (dbErr) console.error("Errore DB (promemoria):", dbErr);
      if (dbNotifs) insertedNotifs = dbNotifs;
    }
    
for (const task of pushTasksData) {
      const userNotif = insertedNotifs.find(n => n.user_id === task.sub.user_id);
      notifications.push(sendPush(task.sub, task.title, task.bodyMsg, task.route, userNotif?.id));
    }
    
    await Promise.all(notifications);
    console.log(`Notifiche inviate: ${notifications.length}`);
    return new Response(JSON.stringify({ success: true, sent: notifications.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('Errore globale:', error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});