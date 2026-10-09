# Database: modello dati, cron, backup, Edge Function, RLS

> Spostato da `CLAUDE.md` il 07/10/2026, **senza cambiare il testo**. I rimandi
> «§9-…» puntano a sezioni che ora stanno in altri file di questa cartella:
> si trovano con `grep -rn '^## 9-<nome>' docs/memoria`. L'indice è in `CLAUDE.md`.

## 4. Modello dati (Supabase)

Progetto Supabase: `riyqtcssllupakjtoehj`.

### Tabelle

**`athletes`** — profilo atleta, `id` = `auth.users.id`
`id, name, surname, birth_date, weight, height, photo_url, notes, instagram_url, strava_url, deleted_at`
- Soft delete via `deleted_at` (le query filtrano `.is('deleted_at', null)`).
- `notes` = la nota che il coach scrive **per** l'atleta.
  ⚠️ **NON è privata, ed è voluto** (confermato dal committente il 27/08/2026): `AthleteDetail`
  è anche `/profile` e la rende senza guardia di ruolo, quindi l'atleta la legge — e la può
  modificare — sulla propria scheda. Versioni precedenti di questo documento la chiamavano
  "nota privata del coach": era sbagliato, non è un difetto da correggere.
  ⚠️ **Dal 27/08/2026 codifica anche lo stato «in pausa»** nel prefisso `[PAUSA: yyyy-MM-dd]`,
  con lo stesso meccanismo dell'RPE dentro `athlete_workouts.notes`: chi legge o scrive questo
  campo passa da `src/lib/pausa.js` (`parseNotePausa` / `formatNotePausa`), mai dal valore
  grezzo. Un `.update({ notes })` diretto **cancella la pausa in silenzio** (§9-decies).
- `instagram_url` contiene solo lo **username** (validato `^[a-zA-Z0-9._]{1,30}$`), `strava_url` una URL completa.

**`workouts`** — il "template" del workout
`id, title, date, sections (jsonb), coach_notes`
- `sections` è il cuore del sistema, vedi §5.
- `date` è la data "nominale" del workout; la data reale per l'atleta sta su `athlete_workouts.completed_date`.

**`athlete_workouts`** — assegnazione atleta↔workout (tabella pivot, è **qui** che sta lo stato)
`id, athlete_id, workout_id, completed_date, status ('pending'|'completed'), notes, voice_note_url`
- `notes` codifica l'RPE nel testo: `[RPE: 7/10]\ntesto libero`
  → helper `parseNotesAndRpe()` / `formatNotesWithRpe()` (⚠️ **duplicati in 3 file**).
- `voice_note_url`: la "cancellazione" è **soft** — si appende `#deleted=<timestamp>` all'URL;
  `isVoiceNoteValid()` filtra quelli marcati.

**`personal_records`** — `id, athlete_id, exercise, value, date`

**`note_estratte`** — ⚠️ **IN ATTESA: scritta il 09/10/2026, NON applicata** (serve lo sblocco del committente, regola 0-bis)
`athlete_workout_id (PK, FK → athlete_workouts ON DELETE CASCADE), athlete_id (FK → athletes ON DELETE CASCADE), data, impronta, versione, estrazione jsonb, creato_at`
- I dati ricavati dalle note degli atleti (scheda-atleta.md §9-dalle-note). La scrive SOLO la Edge Function `estrai-note` con la chiave di servizio; la leggono SOLO gli admin (una policy `ALL`, `USING` e `WITH CHECK` con le 5 email). L'atleta non legge i propri estratti.
- File: `supabase/schema/note_estratte_2026-10-09.sql`. Finché non è applicata, `leggiEstratti` fallisce e la sezione dice «Non è stato possibile leggere i dati delle note»: la scheda resta intera.

**`notifications`** — `id, user_id, title, message, route, is_read, created_at`
- Realtime attivo su INSERT/UPDATE in Home (`supabase.channel('public:notifications')`).

**`push_subscriptions`** — `id, user_id, endpoint, auth, p256dh, badge_count`
- `auth === 'capacitor_ios'` distingue i token FCM nativi dalle subscription Web Push.
- `endpoint` è la chiave di upsert (`onConflict: 'endpoint'`).

**`invitation_codes`** — `id, code, is_active, created_by, used_by, used_by_email, used_at, created_at`

**`tv_sessions`** — `code (4 cifre), workout_id, athlete_id, updated_at`

### Storage buckets
- `athlete-photos` — foto profilo (pubbliche)
- `voice-notes` — note vocali coach↔atleta; gli audio "live walkie-talkie" si **auto-eliminano dopo 60s**

### Edge Functions
- **`estrai-note`** (09/10/2026, **non ancora pubblicata**) — `POST { athlete_id }`, solo admin. Legge le note dell'atleta, manda le mancanti a **Groq soltanto** (niente riserva Gemini: le note sono parole degli atleti) e salva in `note_estratte`. La web app non la chiama. Secret: `GROQ_API_KEY`, `GROQ_MODELLO` facoltativo.
- **`send-reminders`** — 5 modalità via `body.mode`:
  - `morning` / `evening` (cron): promemoria agli **atleti**, personalizzato per nome, con fallback "Giorno di Rest".
    ⚠️ **Gli account in `ADMIN_EMAILS` sono esclusi** (28/08/2026): questa modalità parla a chi si
    allena («Oggi ti aspetta…»), e il coach riceveva due push al giorno su allenamenti suoi che non
    esistono. L'esclusione toglie anche la riga in `notifications` e il badge, non solo la push.
    Se `listUsers` fallisce si invia **senza** filtro (con un `console.error`): meglio una push di
    troppo al coach che tutti gli atleti senza promemoria. `coach_notification` non è toccata.
  - `immediate` (`record_id`): "Nuovo Allenamento!" all'atleta appena assegnato
  - `voice_note` (`record_id`): "Nuova Nota Vocale!" all'atleta
  - `coach_notification` (`action: 'note' | 'completed' | 'custom_workout'`): notifica agli **admin**
    (lista admin ricavata da `supabase.auth.admin.listUsers()` paginato)
  - Gestisce badge iOS incrementale e cancella le subscription morte (404/410/UNREGISTERED)
- **`ai-workout`** — riceve `{ prompt, audioBase64?, mimeType? }`; se c'è audio lo trascrive con
  Gemini 2.5 Flash, poi genera un array JSON di blocchi Hyrox. `fetchWithRetry` con backoff
  esponenziale su 429/5xx. Ritorna sempre status 200 (errori in `{ error }`).
  Secret: `GEMINI_API_KEY`.
- **`cloud-sync`** — invocata da `CloudSyncService` (Strava/Garmin), **non presente nel repo** → probabilmente non ancora implementata.

### 🔴 Cancellazione atleti: cosa distrugge davvero, e cosa era rotto
`delete_expired_athletes()` (cron `0 0 * * *`) fa un **DELETE fisico** degli atleti con
`deleted_at` più vecchio di 7 giorni. `deleted_at` è un **bigint in millisecondi** (il client
scrive `Date.now()`), non un timestamp.

**Le chiavi esterne verso `athletes` sono quasi tutte in CASCADE** (verificato il 25/08/2026):
`athlete_workouts`, `personal_records`, `workout_logs`, `athlete_photos`, `tv_sessions`.
Quindi cancellare un atleta **distrugge tutta la sua storia**, record personali inclusi.
Fa eccezione `workouts_athlete_id_fkey`, che è `NO ACTION`: `workouts.athlete_id` è però una
colonna legacy che il client non scrive mai, quindi in pratica non blocca nulla.

🔴 **E il backup gira DOPO**: backup alle 22:30 UTC, pulizia alle 00:00: la copia ora PRECEDE la cancellazione. Un atleta cancellato a
mezzanotte non è nel backup di quella notte né in nessuno dei successivi. **Spostare il backup
alle 23:00 UTC** risolve, ma il file sta su `main`.

> ⚠️ **Bug corretto il 25/08/2026.** `Home.jsx` eseguiva `update({ deleted_at: null })` sul
> proprio id **a ogni caricamento**, senza condizioni. Un atleta eliminato dal coach si
> ripristinava da solo aprendo l'app: tornava nella rubrica e i 7 giorni ripartivano da zero.
> La cancellazione definitiva poteva avvenire solo per chi non apriva l'app per 7 giorni di fila.
> Ora il ripristino è un gesto esplicito del coach: **Atleti → "Eliminati di recente"**, con i
> giorni rimasti e un bottone Ripristina.
> ⚠️ **La stessa riga è ancora su `main`** (`src/pages/Home.jsx`), quindi sulla web app gli
> atleti continuano ad auto-ripristinarsi.

### 🟠 Note vocali: i file non vengono cancellati davvero
`delete_expired_voice_notes()` (cron ogni ora) fa `DELETE FROM storage.objects`. Questo rimuove
**solo la riga di metadati**: l'URL pubblico smette di funzionare (404), ma i byte restano nello
storage per sempre. Non compaiono in nessun elenco, non finiscono nel backup, e non sono
cancellati — cosa che conta se un atleta chiede la cancellazione dei propri dati.
Il modo corretto è l'API Storage (`supabase.storage.from('voice-notes').remove([...])`).

⚠️ Il gestore `EXCEPTION WHEN OTHERS THEN` della funzione è **vuoto**: ogni errore su una riga
viene inghiottito in silenzio, senza log né conteggio. Gira ogni ora da mesi e non esiste un
indizio su quante righe abbia saltato.

### 🟠 Entrambi i bucket Storage sono PUBBLICI
Verificato il 25/08/2026: `athlete-photos` e `voice-notes` hanno `public = true`. Le note vocali
sono comunicazioni private fra coach e atleta: chiunque abbia l'URL può scaricarle, per sempre,
senza autenticazione. Gli URL non trapelano dall'API (la RLS su `athlete_workouts` è corretta), ma
un bucket pubblico non ha alcuna autorizzazione sul file in sé. La forma giusta è un bucket
privato con URL firmati a scadenza. Cambiarlo richiede di rigenerare gli URL già salvati in
`athlete_workouts.voice_note_url` → **soggetto al congelamento**.

### ⏰ I quattro cron di pg_cron (scoperti il 25/08/2026, prima non documentati)
Il cron **non** è su GitHub: è `pg_cron` dentro Supabase, che chiama le funzioni via `net.http_post`.
Si ispeziona con `select jobid, jobname, schedule, active, command from cron.job;`

| jobname | schedule (UTC) | cosa fa |
|---|---|---|
| `reminder-mattina` | `0 6 * * *` | `send-reminders` con `{"mode":"morning"}` |
| `reminder-sera` | `0 20 * * *` | `send-reminders` con `{"mode":"evening"}` |
| `cleanup-voice-notes` | `0 * * * *` (ogni ora) | `delete_expired_voice_notes()` |
| `cleanup-expired-athletes` | `0 0 * * *` | `delete_expired_athletes()` |

I due `cleanup` chiamano funzioni SQL che **non sono nel repository** e che nessuno aveva
registrato: `supabase/schema/` non le contiene perché la fotografia copre solo le policy RLS.
⚠️ **Vanno lette e documentate**: `delete_expired_athletes()` **cancella righe**, e non sappiamo
con quale criterio.

### 🔴 Il backup gira DOPO la cancellazione degli atleti
`cleanup-expired-athletes` gira alle **00:00 UTC**, il backup del database alle **22:30 UTC**.
Un atleta cancellato definitivamente a mezzanotte **non è più nel backup di quella notte**, e
neanche in quelli successivi: la cancellazione precede sempre la copia. Se il criterio di
`delete_expired_athletes()` fosse sbagliato, non ci sarebbe modo di accorgersene né di rimediare.
✅ **Risolto il 25/08/2026**: il backup è stato spostato a `30 22 * * *`, un'ora e mezza prima della pulizia.

### ⚠️ La service role key è in chiaro dentro `cron.job`
I due `reminder-*` portano la chiave `service_role` scritta a mano nell'header `Authorization`
del comando. Non è esposta via API REST (lo schema `cron` non è fra quelli pubblicati), ma è un
punto di duplicazione che nessuno pensa a ruotare. Se la chiave venisse rigenerata, va aggiornata
in: `cron.job` (2 job), i secret GitHub del backup, e ovunque sia stata incollata.

### 🔐 Autorizzazione delle Edge Function (deployata il 25/08/2026)
Prima erano entrambe aperte. Ora:
- **`ai-workout`**: `verify_jwt = true` + controllo che il chiamante sia in `ADMIN_EMAILS`
  (o il token di servizio). Verificato in produzione: senza auth → 401, con la anon key
  del bundle pubblico → 401 `{"error":"Non autorizzato"}`. Prima entrambe le chiamate
  bruciavano `GEMINI_API_KEY`.
- **`send-reminders`**: controllo **per modalità**, perché i chiamanti sono diversi.
  - `immediate`, `voice_note` → solo admin. Verificato: anon key → 403.
  - `coach_notification` → aperta agli autenticati: la invoca il client **dell'atleta**
    quando completa un workout o lascia una nota. Non stringere qui senza rifare il giro.
  - `morning`, `evening` → **PROTETTE dal 25/08/2026** (`APPLICA_CONTROLLO_CRON = true`).
    Verificato che `pg_cron` invoca con un token `role: service_role`, che la funzione riconosce
    per due vie indipendenti (confronto con `SUPABASE_SERVICE_ROLE_KEY` e claim `role`).
    Esiste anche una terza via, il segreto condiviso `CRON_SECRET` più l'header `x-cron-secret`,
    disattivata perché non serve: si attiva da sola se un giorno il secret viene impostato.
    Verificato dopo il deploy: `morning`, `evening`, `immediate` e `voice_note` con la anon key
    danno tutte 403.
    ~~IN OSSERVAZIONE~~ (`APPLICA_CONTROLLO_CRON = false`).
    Il cron è configurato dentro Supabase, nessun workflow GitHub lo chiama, e il default
    della funzione senza body è `morning`: bloccarlo alla cieca spegnerebbe i promemoria di
    tutti gli atleti. La funzione ora **logga l'origine di ogni esecuzione**.
    ✅ **Fatto il 25/08/2026**: letto `cron.job`, il cron invoca con `role: service_role`.
    `APPLICA_CONTROLLO_CRON = true` deployato e verificato.

⚠️ Il deploy di `send-reminders` colpisce **anche la web app in produzione**: è una sola
funzione per due app.

### 🔴 Su iOS le note vocali si registrano con `MediaRecorder`, non col plugin nativo
Accertato il 26/08/2026, con i log dal dispositivo. Il plugin
`@independo/capacitor-voice-recorder` dichiarava successo e restituiva il nulla:

```
hasAudioRecordingPermission → {"value":true}
startRecording              → {"value":true}
stopRecording               → {"msDuration":0,"uri":"", ...}
```

Il file caricato era un contenitore M4A di **557 byte** — intestazione e zero campioni —
contro gli 1-1,9 MB delle note di giugno e luglio. L'atleta vedeva la forma d'onda muoversi
e non sentiva niente.

**Causa**: WebView e recorder nativo si contendono `AVAudioSession`. Non esiste un ordine che
vada bene a entrambi — togliendo `getUserMedia` dal ramo nativo il plugin **non parte affatto**
(«Impossibile accedere al microfono»), tenendolo registra vuoto.

**Soluzione**: `getUserMedia` funziona, e `MediaRecorder` è disponibile nel WKWebView da
iOS 14.5. Su iOS si registra con quello; il plugin nativo resta come ripiego per WebView
vecchi. La scelta è ricordata in un `ref`, perché allo stop non si può rifare guardando
`isNative`: dipende anche da `MediaRecorder` e dallo stream, che a quel punto potrebbero
non esserci più.

> ⚠️ **La lezione generale**: un plugin nativo che risponde `{"value":true}` non sta dicendo
> che ha funzionato. Qui il difetto è sopravvissuto due mesi perché non c'era nessun errore
> da nessuna parte — solo un file muto. Da qui la guardia su `msDuration === 0`, che rifiuta
> di caricare invece di tacere.

> ℹ️ Dal 23/09/2026 la libreria audio è **una sola** (§9 punto 4), e su iOS è solo il ripiego
> di `MediaRecorder` — sia per le note vocali sia per la dettatura IA in CreateWorkout.

### 🔴 Le push NON funzionano su una build Debug lanciata da Xcode
Accertato il 25/08/2026. Il progetto ha due bundle id:
- **Debug** → `it.federicoleo.fleofit.dev` (serve a far convivere le due app sullo stesso telefono)
- **Release/archive** → `it.federicoleo.fleofit`

`GoogleService-Info.plist` è registrato su `it.federicoleo.fleofit`, e le credenziali APNs su
Firebase valgono **per un bundle id specifico**. Quindi una build Debug produce un token APNs di
un'app che Firebase non conosce, e FCM risponde:
`401 "Invalid APNs credential." · THIRD_PARTY_AUTH_ERROR`.

**Non è un bug: è la conseguenza del suffisso `.dev`.** Sintomo caratteristico: la notifica
**in-app arriva** (è solo una riga in `notifications`) ma **la push no**.

Per testare le push: o si toglie temporaneamente il `.dev` dal bundle id in Debug (disinstallando
prima l'app dal telefono), o si registra su Firebase una seconda app iOS `…​.dev` con il proprio
`GoogleService-Info.plist` usato solo in Debug.

⚠️ **Da verificare comunque prima di pubblicare**: `THIRD_PARTY_AUTH_ERROR` nasce anche da una
credenziale APNs mancante o scaduta. Su Firebase Console → Cloud Messaging deve esserci una
**APNs Authentication Key `.p8`** (copre sandbox e produzione, non scade) e non un certificato
`.p12`. Se manca, le push non funzionano **per nessuno**, neanche dall'App Store.

✅ **Verificato il 26/08/2026 sul binario spedito**: `aps-environment = production`.
`App.entitlements` dichiara `development` ed è usato in entrambe le configurazioni, ma questo
**non è un problema**: l'archivio è firmato col profilo di sviluppo del team
("iOS Team Provisioning Profile", `get-task-allow = true`) ed è l'**export** che rifirma con il
profilo di distribuzione sostituendo `production`. Quindi **ispezionare l'archivio non risponde
alla domanda**: serve l'`.ipa` esportato.
Si rifà così, senza caricare niente (`destination = export` nel plist):
```bash
xcodebuild -exportArchive -archivePath <archivio.xcarchive> \
  -exportOptionsPlist tools/ExportOptions-AppStore.plist \
  -exportPath /tmp/fleofit-export -allowProvisioningUpdates
./tools/verifica-ipa.sh /tmp/fleofit-export
```

### Secrets attesi (Supabase)
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
`FIREBASE_SERVICE_ACCOUNT` (JSON), `GEMINI_API_KEY`.
VAPID public key duplicata client-side in `Settings.jsx` (costante `publicVapidKey`).

### Backup
GitHub Action `.github/workflows/db-backup.yml` — cron `30 22 * * *` (22:30 UTC, **prima** della pulizia di mezzanotte), export REST in zip
caricato come artifact (retention 90 giorni). **Riscritto il 24/08/2026**: tabelle corrette,
paginazione a 1000 righe, validazione della risposta, fallimento esplicito se una tabella critica
(`athletes`, `workouts`, `athlete_workouts`) è vuota o mancante, manifest con i conteggi e riepilogo
nella pagina del run. Le tabelle da salvare stanno in `env.TABLES`: **se aggiungi una tabella al DB,
aggiungila anche lì.**
- ✅ **COSA SALVA DAVVERO IL BACKUP DI STANOTTE** (riletto su `origin/main` il 25/08/2026, è il
  file che il cron esegue):
  `TABLES='athletes workouts athlete_workouts personal_records invitation_codes notifications'`.
  **`personal_records` è dentro**: era il dato meno ricostruibile del sistema e non era mai stato
  salvato — aggravato dal fatto che ha una policy RLS `ALL/{authenticated}/true`, cioè è
  cancellabile da qualunque utente loggato (§4-bis).
  Restano fuori di proposito: `push_subscriptions` e `tv_sessions` (effimere, si rigenerano) e
  `workout_logs`/`athlete_photos` (legacy, 0 occorrenze nel client).
  `REQUIRED_TABLES='athletes workouts athlete_workouts'`: se una di queste è vuota, il job fallisce
  invece di caricare un backup inutile.
  ⚠️ Correzione del 24/08/2026: una versione precedente di questa nota affermava che
  `athlete_photos` e `workout_logs` "non esistono". **È falso**: `pg_tables` le elenca entrambe nello
  schema `public`. Sono tabelle **legacy mai referenziate dal client** (0 occorrenze in `src/` e
  `supabase/`), quindi il backup attivo spende due delle cinque voci su tabelle morte.
- ✅ **Il file corretto è su `main` dal 25/08/2026 ed è identico a questo** (verificato con
  `diff`). Conta perché gli scheduled workflow girano **solo dal branch di default**: fino ad
  allora il cron notturno eseguiva la versione rotta. Se rimetti mano al workflow, riporta
  **solo quel file**: `git checkout main && git checkout ios-version -- .github/workflows/db-backup.yml`
- Il backup copre l'unico database, che è **condiviso** fra web app e app iOS (§1.1).
- ✅ **I bucket Storage sono nel backup dal 25/08/2026** (`athlete-photos`, `voice-notes`):
  inventario sempre, file scaricati se `STORAGE_SCARICA = si` e finché si resta sotto
  `STORAGE_MAX_MB` (1 GB). ⚠️ **Privacy**: le note vocali sono comunicazioni private fra coach e
  atleta e finiscono in un artifact GitHub. Se il repository diventa pubblico, mettere
  `STORAGE_SCARICA` a `no` e conservare solo l'inventario.
  ⚠️ Come per le tabelle, **vale solo quando il file è su `main`**: i cron girano dal branch di default.
In-app: Settings ha export/import JSON completo e per singolo atleta.

---

---

## 4-bis. Stato reale della RLS (verificato sul DB il 24/08/2026)

> 📄 **Le policy sono ora sotto controllo di versione**: `supabase/schema/rls_snapshot_2026-08-25.sql`
> (fotografia leggibile, **non** una migrazione: non applicarla). Prima il database non aveva
> nessuna rappresentazione nel repository, quindi le policy non erano né revisionabili né
> ricostruibili. Il `README.md` accanto spiega come sostituirla con un dump vero quando hai la
> password del database. Aggiornala ogni volta che cambi una policy.

RLS **attiva su tutte e 10 le tabelle**. Ma le policy hanno buchi verificati, elencati per gravità.
Fonte: `pg_policies` interrogata dal committente. ⚠️ Manca ancora l'ispezione di `with_check`
(le policy INSERT mostrano `qual = null`): finché non è letta, non si conosce il controllo su
`Admins can create invitation codes` né su `Permetti creazione workout autonomi`.

### 🔴 `demo@fleofit.it` NON è nelle policy RLS — TERZA lista di admin
Le policy di `athletes`, `athlete_workouts`, `workout_logs`, `invitation_codes`, `push_subscriptions`
e `workouts` controllano l'admin contro un array di **4 email** che **non contiene
`demo@fleofit.it`**, mentre il bundle spedito ad Apple e `send-reminders` la contengono.
Conseguenza: **l'account del revisore ha `isAdmin = true` nel client e `admin = false` nel
database** → rubrica atleti vuota, workout assegnati vuoti, codici invito vuoti, modifica workout
negata. È di nuovo la condizione che ha prodotto il rifiuto **2.3.1(a)** di maggio.

> ⚠️ **Correzione a §9 punto 7 e a §9-ter.** Le liste di admin hardcodate non sono due, sono **TRE**:
> `src/App.jsx`, `supabase/functions/_shared/admin.ts` (condivisa dalle due Edge Function dal
> 25/08, prima erano due copie separate) e **le policy RLS**.
> Il corollario di §9-ter ("conta solo l'elenco compilato dentro il bundle") è **incompleto**:
> contano entrambi gli elenchi, e quello nel database è quello che decide cosa il revisore vede.

Il fix è `ALTER POLICY` con l'email aggiunta all'array: **puramente additivo**, non toglie accesso a
nessuno, non può rompere la web app. È l'unica eccezione raccomandata al congelamento (regola 0-bis).

> ⚠️ **TRAPPOLA VERIFICATA IL 24/08/2026 — `USING` e `WITH CHECK` sono due clausole distinte.**
> Su una policy `ALL`: `USING` governa SELECT/UPDATE/DELETE (cosa vedi e cosa tocchi),
> `WITH CHECK` governa INSERT e le righe risultanti di UPDATE (cosa scrivi).
> **`ALTER POLICY ... USING (...)` NON modifica `WITH CHECK`**: resta quello di prima, in silenzio.
> È successo davvero: dopo il primo giro di `ALTER POLICY` sul solo `USING`, `demo@fleofit.it`
> vedeva la rubrica atleti piena ma **non poteva creare un atleta né assegnare un workout**, perché
> `athletes.with_check` e `athlete_workouts.with_check` contenevano ancora 4 email.
> **Regola**: quando allinei una lista admin, scrivi sempre entrambe le clausole nella stessa
> `ALTER POLICY`, e verifica con:
> ```sql
> select tablename, policyname, cmd,
>        qual::text like '%demo@fleofit.it%'       as using_ok,
>        with_check::text like '%demo@fleofit.it%' as check_ok
> from pg_policies where schemaname = 'public'
>   and (qual::text like '%federico.leo88%' or with_check::text like '%federico.leo88%');
> ```
> `check_ok = null` è accettabile: quella policy non ha `WITH CHECK` ed eredita `USING`
> (è il caso di `workouts` → "Solo gli admin possono modificare i workout").
>
> **Il fix strutturale**, da fare dopo l'approvazione App Store: sostituire i 6 array copiati con
> un'unica funzione `public.is_admin()` richiamata da tutte le policy, così la lista vive in un posto
> solo invece che in tre (§9 punto 7). È un cambiamento di policy non additivo → soggetto al
> congelamento (regola 0-bis).

### 🔴 `personal_records`: `ALL | {authenticated} | true` — sia `qual` sia `with_check`
Qualunque utente loggato legge, modifica, inserisce e **cancella i PR di tutti gli atleti**. Ed è la
tabella che il backup non salva (§4). Combinazione peggiore del sistema: scrittura libera + nessuna
copia di sicurezza.

### 🔴 `invitation_codes`: la registrazione chiusa non è chiusa
`Anonymous users can validate a code | SELECT | {anon} | (is_active AND used_by IS NULL)`:
un anonimo con la anon key (in chiaro nel bundle) **enumera tutti i codici validi**, poi si registra.
Il `signOut()` di `App.jsx` (ramo `/login?error=unauthorized`) è cosmetico. Forma corretta: funzione `security definer` che
risponde sì/no senza esporre la tabella. **Non additivo → dopo l'approvazione App Store.**

### 🟠 `push_subscriptions`: `Enable all operations for authenticated users | ALL | true`
Le policy si sommano in OR: questa annulla le due scritte correttamente accanto a lei. Qualunque
atleta legge **tutti i token push**. Rimuoverla è restrittivo → dopo l'approvazione.

### 🟠 `workouts`: `Permetti alla TV di leggere i workout | SELECT | {public} | true`
Chiunque abbia la anon key scarica **l'intera programmazione**. Serve alla TV, ma dovrebbe essere
limitata al workout referenziato da una `tv_sessions` attiva.

### 🟡 `tv_sessions`: `ALL | {public} | true` — chiunque può sovrascrivere una sessione e dirottare un cast.
### 🟡 `athlete_photos`: `ALL | {authenticated} | true` — tabella legacy non usata dal client.

### ✅ Scritte bene
`athletes`, `athlete_workouts`, `workout_logs` (`auth.uid()` + admin) e `notifications`
(`auth.uid() = user_id`). Due `with_check` particolarmente ben fatte, da non toccare:
`workouts → Permetti creazione workout autonomi` limita l'INSERT libero a
`(sections->>'isAutonomous')::boolean = true` (un utente non può inserirsi programmazione
arbitraria), e `invitation_codes → Admins can create invitation codes` lega `created_by = auth.uid()`
(nessuno può falsificare l'autore di un codice).
