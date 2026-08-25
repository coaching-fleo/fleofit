# CLAUDE.md — Memoria globale progetto FLEOFIT

> Documento di memoria persistente per Claude. Leggere **sempre** questo file prima di
> toccare il codice o proporre modifiche grafiche.
> Ultimo aggiornamento: **24 agosto 2026**.
> **Due branch attivi e DIVERGENTI**: `main` = web app in produzione · `ios-version` = app per
> l'App Store (§1.1 — rifare sempre `git fetch` prima di parlare dei due branch).
> Sessione corrente su `ios-version`, ultimo commit `5c02b81`, allineato con `origin/ios-version`.
> Build **1.1.0 (3)** caricata su App Store Connect il 24/08/2026 dopo un rifiuto: stato e
> correzioni in §9-ter.

---

## 0. Regole operative per Claude

0. **Esistono DUE branch vivi con due destinazioni diverse** (`main` = web app in produzione,
   `ios-version` = app per l'App Store). Prima di proporre un merge, un deploy o una modifica
   condivisa (DB, Edge Function), leggere il §1.1: non sono intercambiabili.
0-bis. 🔒 **LO SCHEMA DEL DATABASE È CONGELATO** fino all'approvazione su App Store (decisione del
   committente, 24/08/2026). Niente migrazioni, niente tabelle nuove, nessuna modifica alle policy
   RLS: l'unico database serve anche la web app in produzione e non c'è staging. **Le letture sono
   permesse** (verifica policy, conteggi, export). Se una funzione richiede una migrazione, va
   proposta e messa in attesa, non implementata. Vedi PRODUCT.md → Capabilities and Constraints.
1. **Il nome "FLEOFIT" è provvisorio.** Potrà cambiare in futuro. Quando scrivi codice nuovo, evita
   di hardcodare il brand ovunque: preferisci costanti/variabili riutilizzabili. Il nome è comunque
   attualmente presente in decine di punti (logo JSX, PDF, story IG, TV, `appId`, `Info.plist`,
   chiavi localStorage `fleofit_*`, deep link `fleofit://`) — se si cambia nome serve un refactor
   coordinato, non un semplice find&replace.
2. **La grafica attuale è la baseline, non un vincolo eterno.** Modifiche di layout/UI sono attese
   e benvenute.
3. **I COLORI SONO CORRETTI E VANNO MANTENUTI COME DEFAULT.** Non proporre palette alternative se
   non esplicitamente richiesto. La palette è definita al §6.
4. Lingua dell'interfaccia e dei commenti: **italiano**. Nomi di variabili/funzioni: inglese misto
   a italiano (convenzione già esistente, mantenerla coerente per file).
5. Prima di modificare un file grande (`WorkoutDetail.jsx` 3060 righe, `AthleteDetail.jsx` 2716,
   `CreateWorkout.jsx` 2248, `Home.jsx` 1847) leggere le sezioni rilevanti: c'è molta logica
   duplicata tra i file (vedi §9 Debito tecnico).

---

## 1. Cos'è il progetto

**FLEOFIT** è l'app di coaching personale di **Federico Leo**, specializzata su **Hyrox** e
**Running**. Serve a seguire gli atleti passo per passo: il coach crea e assegna workout, l'atleta
li esegue con un timer guidato, li segna come completati con RPE e note, e il coach vede tutto in
tempo reale.

- **Repo**: `https://github.com/coaching-fleo/fleofit`
- **Cartella locale**: `~/Desktop/FLEOFIT/fleofit ios-version`
- **App bundle iOS**: `it.federicoleo.fleofit` — display name `FLEOFIT`
- **Deploy web**: Vercel (`https://fleofit.vercel.app`), SPA rewrite in `vercel.json`
- **Deep link scheme**: `fleofit://` (usato per OAuth callback e reset password su iOS)

---

## 1.1 I due branch — LEGGERE PRIMA DI TOCCARE main

Il progetto vive su **due branch con due prodotti diversi**, entrambi attivi:

| Branch | Cos'è | Dove finisce | Ultimo commit |
|---|---|---|---|
| **`main`** (default) | **Web app in produzione**, quella che gli atleti usano oggi | **collegato a Vercel** → `https://fleofit.vercel.app`. LIVE, non rompere | `8919bfd` — 8 giu 2026 |
| **`ios-version`** | Versione nativa iOS/Capacitor, quella caricata sull'App Store (§9-ter) | **collegato a NIENTE**: è solo il backup su GitHub del lavoro locale. L'app arriva sull'App Store da Xcode, non da un deploy | `848648f` — 24 ago 2026 |

### ⚠️ `ios-version` NON è un branch di rilascio (confermato dal committente il 24/08/2026)
Non esiste nessuna pipeline collegata a `ios-version`. Pushare lì **non pubblica niente**: serve
solo a non perdere il lavoro. La build per l'App Store nasce da Xcode sulla cartella locale.
Conseguenze pratiche, tutte controintuitive:
- **Un push su `ios-version` non è un rilascio.** Il codice spedito ad Apple è quello archiviato da
  Xcode in quel momento, che può essere più avanti o più indietro del branch (§9-ter: è già
  successo con il build number).
- **Un fix che deve andare in produzione web NON basta metterlo su `ios-version`.** Deve arrivare
  su `main`, o non esiste per gli atleti che usano l'app oggi.
- **Gli scheduled workflow di GitHub girano solo dal branch di default.** Un workflow corretto su
  `ios-version` è un file inerte (§4 e §9 punto 9).
- ⚠️ **Da verificare su Vercel**: se il progetto Vercel è collegato al repo GitHub, per impostazione
  predefinita Vercel costruisce una **preview deployment per ogni branch pushato**, `ios-version`
  incluso, su un URL pubblico. Controllare in Vercel → Settings → Git → *Ignored Build Step* /
  *Production Branch* che le preview siano disattivate o protette da password.

### Rapporto tra i due: SONO DIVERGENTI
Verificato il 24/08/2026 **dopo un `git fetch`**:
`git rev-list --left-right --count origin/main...origin/ios-version` → **`41 22`**.
`main` ha 41 commit che `ios-version` non ha, `ios-version` ne ha 22 che `main` non ha.
Il divario **cresce a ogni sessione di lavoro su `ios-version`**: più si aspetta, più il merge costa.
**Un merge non è un fast-forward**: è un merge vero.

> ⚠️ Fino al 24/08/2026 questo documento affermava `0 18` e "non sono divergenti". Era **falso**:
> il riferimento locale a `origin/main` era fermo a maggio e nessuno aveva fatto fetch. `main` non
> è affatto abbandonato, è arrivato all'**8 giugno 2026**.
> **Regola**: fare `git fetch` prima di qualunque affermazione sul rapporto fra i due branch.

Peggio del conteggio: i due branch hanno lavorato **in parallelo sugli stessi file**. Fra il 15 e
il 21 maggio `main` ha ricevuto una propria linea di sviluppo su `TVDashboard.jsx`,
`CreateWorkout.jsx` e `WorkoutDetail.jsx` (TV, opzioni ergometri, distanze di corsa, fix PDF/story
IG, beep del timer), cioè proprio i file più grandi del progetto, che `ios-version` ha modificato
per conto suo. Un merge produrrà conflitti reali lì dentro, non banali da risolvere.

### Cosa c'è davvero solo su `ios-version` (verificato su `origin/main` il 24/08/2026)
Assenti da `main`: tutta la cartella `ios/`, `capacitor.config.ts`, `privacy-policy.html`,
`src/pages/bluetooth.js` (fascia cardio BLE), `src/pages/health.js` (Apple Health),
`supabase/functions/ai-workout/` (generazione IA), `src/lib/blockHints.js`, l'**RPE**, la
**Live Coach Cam**, la **modalità Offline** (ex "Bunker"), push FCM native, centro notifiche + badge.

Due correzioni rispetto a quanto scritto qui in passato:
- ⚠️ **`TVDashboard.jsx` esiste anche su `main`.** La TV Dashboard non è esclusiva di `ios-version`:
  esistono due implementazioni diverse, sviluppate in parallelo a maggio.
- `main` **conosce** `Interval`, `Custom`, `Event` e `isAutonomous` (l'8 giugno ha ricevuto
  "Coach can create custom workout"). Quel pezzo di incompatibilità non c'è più — resta solo l'RPE.

### ⚠️ Il database e le Edge Function sono CONDIVISI
Entrambi i branch puntano allo **stesso progetto Supabase** (`riyqtcssllupakjtoehj`) e alle **stesse
Edge Function deployate**. Non esiste un ambiente di staging. Conseguenze concrete:
- Una **migrazione di schema** fatta per iOS colpisce subito la web app in produzione.
- `send-reminders` è **una sola funzione deployata**: 443 righe su `ios-version` contro 247 su
  `main`, cioè 196 in più (misurate il 24/08/2026). Qualunque versione sia deployata, serve
  entrambe le app. La lista `adminEmails` al suo interno va tenuta allineata a `ADMIN_EMAILS`
  di `src/App.jsx` (§9 punto 7).
- Il fix del backup (`db-backup.yml`) deve stare su `main` perché i cron di GitHub girano solo dal
  branch di default → **portare solo quel file**, non l'intero branch:
  `git checkout main && git checkout ios-version -- .github/workflows/db-backup.yml`

### ⚠️ Incompatibilità dati nota: l'RPE
`main` **non conosce l'RPE**: `parseNotesAndRpe`/`formatNotesWithRpe` non esistono su quel branch
(0 occorrenze di "RPE" in `src/`). Quindi:
- Un workout completato da iOS scrive `[RPE: 7/10]\ntesto` in `athlete_workouts.notes`;
  sulla **web app quel prefisso appare come testo grezzo** dentro la nota.
- Se l'atleta **modifica la nota dalla web app**, il valore viene riscritto verbatim
  (`.update({ notes })`, `AthleteDetail.jsx:177`, `Home.jsx:199`, `WorkoutDetail.jsx:886`):
  se cancella il prefisso, **l'RPE è perso** e le statistiche iOS (RPE medio, carico settimanale)
  ricadono silenziosamente sul default 5.
Se si vuole tenere le due app in convivenza a lungo, il minimo sindacale è **retroportare
`parseNotesAndRpe` su `main`** (anche solo in lettura, per non distruggere il dato).

---

## 1.2 Ruoli
| Ruolo | Come si ottiene | Cosa vede |
|---|---|---|
| `admin` (coach) | email in `ADMIN_EMAILS` (`src/App.jsx:29`) | Tutto: crea workout, gestisce atleti, codici invito, backup, Live Coach Cam |
| `athlete` | registrazione con codice invito valido | Home personale, calendario, profilo, archivio |
| `coach` | ruolo previsto nel codice ma **onboarding disattivato** (commentato in `App.jsx:109-112`) | come admin |

- Gli admin possono **simulare l'atleta**: `localStorage.adminRoleOverride = 'athlete'` (toggle in Settings).
- L'account `coaching@federicoleo.it` ha ID `0118e43f-8791-4fd6-8032-bee028334c99` ed è **nascosto**
  dalla lista atleti (filtro hardcodato in `Athletes.jsx` e `WorkoutDetail.jsx`).
- **Registrazione chiusa**: senza `invitation_code` valido il `ProtectedRoute` fa signOut e
  rimanda a `/login?error=unauthorized`.

---

## 2. Stack tecnologico

| Livello | Tecnologia |
|---|---|
| Frontend | React **19**, Vite **8**, React Router **7** (`BrowserRouter`) |
| Styling | **Tailwind CSS 4** via `@tailwindcss/vite` (niente `tailwind.config.js`: i token stanno in `@theme` dentro `src/index.css`) |
| Icone | `lucide-react` |
| Date | `date-fns` + locale `it` |
| Backend | **Supabase** (Postgres + Auth + Storage + Realtime + Edge Functions) |
| Mobile | **Capacitor 8** → target **iOS** (`ios/App`), niente cartella Android |
| Export | `jspdf` (PDF scheda), `html-to-image` (`toPng`/`toBlob`) per la story Instagram |
| Push | FCM (iOS nativo, via `@capacitor-community/fcm` + Firebase Admin lato Edge Function) + Web Push VAPID (browser) |
| IA | Google **Gemini 2.5 Flash** (generazione workout + trascrizione audio) |

### Plugin Capacitor in uso
`@capacitor/app`, `browser`, `filesystem`, `haptics`, `keyboard`, `network`,
`push-notifications`, `screen-orientation`, `share`, `status-bar`,
`@capacitor-community/bluetooth-le` (fascia cardio), `keep-awake` (TV), `media` (salva in galleria),
`fcm`, `@capawesome/capacitor-badge` (badge icona), `@capgo/capacitor-health` (Apple Health),
`@independo/capacitor-voice-recorder` + `capacitor-voice-recorder` (⚠️ **due librerie audio diverse**,
vedi §9).

### Comandi
```bash
npm run dev      # vite --host (porta 5173, host 0.0.0.0)
npm run build    # tsc -b && vite build
npm run lint     # eslint .
npx cap sync ios # dopo il build, per aggiornare il progetto Xcode
```
Per testare su iPhone in dev live: scommentare `server.url` in `capacitor.config.ts` con l'IP locale.

---

## 3. Struttura dei file

> Struttura del branch `ios-version`. Su `main` mancano `ios/`, `capacitor.config.ts`,
> `privacy-policy.html`, `bluetooth.js`, `health.js`, `src/lib/` e la Edge Function `ai-workout`.
> ⚠️ `TVDashboard.jsx` **c'è anche su `main`**, in una versione diversa (§1.1).

```
src/
├─ main.jsx                    # entry, importa index.css
├─ App.jsx                     # routing, AuthContext, Onboarding, ProtectedRoute, DeeplinkHandler
├─ index.css                   # Tailwind @theme + animazioni globali (page-transition, modal-transition)
├─ App.css                     # ⚠️ boilerplate Vite residuo, NON usato — eliminabile
├─ supabaseClient.js           # createClient con URL + anon key hardcodati
├─ useTouchDrag.js             # hook drag&drop touch nativo (usato da CreateWorkout)
├─ lib/
│  └─ blockHints.js            # BLOCK_HINT: didascalie in chiaro dei tipi di blocco (§9-ter)
├─ components/
│  ├─ Navbar.jsx               # bottom nav fissa, voci variabili per ruolo
│  ├─ CustomModals.jsx         # CustomAlert + CustomConfirm (sostituiscono alert/confirm nativi)
│  └─ CustomDatePicker.jsx     # date picker custom dark
└─ pages/
   ├─ Home.jsx                 # dashboard atleta + dashboard coach + centro notifiche + Live Coach Cam
   ├─ Login.jsx                # welcome / login / signup / codice invito / recupero password
   ├─ Calendar.jsx             # calendario mensile, creazione "Evento/Gara"
   ├─ CreateWorkout.jsx        # workout builder (Hyrox / Running / Custom) + generazione IA
   ├─ WorkoutDetail.jsx        # scheda workout, timer guidato, PDF, story IG, note vocali, TV
   ├─ Athletes.jsx             # rubrica atleti (admin)
   ├─ AthleteDetail.jsx        # scheda atleta: workout, PR, statistiche (è anche /profile)
   ├─ WorkoutsArchive.jsx      # archivio storico workout
   ├─ Settings.jsx             # notifiche, backup/restore JSON, codici invito, BLE, password
   ├─ TVDashboard.jsx          # /tv — dashboard fullscreen per TV/Chromecast, codice a 4 cifre
   ├─ Invite.jsx               # ⚠️ NON collegato a nessuna rotta: la validazione invito vive in Login.jsx
   ├─ bluetooth.js             # BluetoothService — singleton BLE fascia cardio
   ├─ health.js                # HealthService (Apple Health) + CloudSyncService (Strava/Garmin, WIP)
   ├─ motivations.js           # 15 frasi motivazionali + getDailyMotivation() con anti-ripetizione
   ├─ patch.js                 # ⚠️ file morto: nessun import lo referenzia
   └─ useTouchDrag.js          # ⚠️ DUPLICATO morto — l'unico import attivo è `../useTouchDrag` (src/)
supabase/functions/
   ├─ send-reminders/index.ts  # notifiche push (5 modalità)
   └─ ai-workout/index.ts      # Gemini: trascrizione audio + generazione blocchi JSON
index.ts (root)                # ⚠️ copia vecchia di send-reminders, non deployata
```

---

## 4. Modello dati (Supabase)

Progetto Supabase: `riyqtcssllupakjtoehj`.

### Tabelle

**`athletes`** — profilo atleta, `id` = `auth.users.id`
`id, name, surname, birth_date, weight, height, photo_url, notes, instagram_url, strava_url, deleted_at`
- Soft delete via `deleted_at` (le query filtrano `.is('deleted_at', null)`).
- `notes` = note private del coach sull'atleta.
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
- **`send-reminders`** — 5 modalità via `body.mode`:
  - `morning` / `evening` (cron): promemoria a tutti gli iscritti, personalizzato per nome, con fallback "Giorno di Rest"
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
`cleanup-expired-athletes` gira alle **00:00 UTC**, il backup del database alle **02:00 UTC**.
Un atleta cancellato definitivamente a mezzanotte **non è più nel backup di quella notte**, e
neanche in quelli successivi: la cancellazione precede sempre la copia. Se il criterio di
`delete_expired_athletes()` fosse sbagliato, non ci sarebbe modo di accorgersene né di rimediare.
Il rimedio è banale — spostare il backup **prima** della pulizia, per esempio alle 23:00 UTC —
ma il file del cron sta su `main` e va modificato lì.

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
    ⏳ **DA FARE**: leggere i log dopo un paio di cicli notturni (02:00 UTC), vedere con quale
    identità arriva il cron, poi mettere `APPLICA_CONTROLLO_CRON = true` e rideployare.
    Finché è `false`, un atleta autenticato può ancora far partire una push a tutti.

⚠️ Il deploy di `send-reminders` colpisce **anche la web app in produzione**: è una sola
funzione per due app.

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

⚠️ **Controllo pre-archive**: `App.entitlements` dichiara `aps-environment = development` ed è usato
sia in Debug sia in Release. Xcode dovrebbe sostituirlo con `production` archiviando con un profilo
App Store, ma va confermato sul binario esportato:
`codesign -d --entitlements - --xml Payload/App.app | plutil -p - | grep aps-environment`

### Secrets attesi (Supabase)
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
`FIREBASE_SERVICE_ACCOUNT` (JSON), `GEMINI_API_KEY`.
VAPID public key duplicata client-side in `Settings.jsx:274`.

### Backup
GitHub Action `.github/workflows/db-backup.yml` — cron `0 2 * * *` (02:00 UTC), export REST in zip
caricato come artifact (retention 90 giorni). **Riscritto il 24/08/2026**: tabelle corrette,
paginazione a 1000 righe, validazione della risposta, fallimento esplicito se una tabella critica
(`athletes`, `workouts`, `athlete_workouts`) è vuota o mancante, manifest con i conteggi e riepilogo
nella pagina del run. Le tabelle da salvare stanno in `env.TABLES`: **se aggiungi una tabella al DB,
aggiungila anche lì.**
- 🔴 **COSA SALVA DAVVERO IL BACKUP DI STANOTTE** (letto su `origin/main` il 24/08/2026, è il file
  che il cron esegue): `TABLES=("athletes" "athlete_photos" "athlete_workouts" "workouts" "workout_logs")`.
  **Mancano `personal_records`, `invitation_codes`, `notifications`, `push_subscriptions`,
  `tv_sessions`.** In particolare **i PR degli atleti non sono mai stati salvati**, ed è il dato meno
  ricostruibile del sistema — aggravato dal fatto che `personal_records` ha una policy RLS
  `ALL/{authenticated}/true`, cioè è cancellabile da qualunque utente loggato (§4-bis).
  ⚠️ Correzione del 24/08/2026: una versione precedente di questa nota affermava che
  `athlete_photos` e `workout_logs` "non esistono". **È falso**: `pg_tables` le elenca entrambe nello
  schema `public`. Sono tabelle **legacy mai referenziate dal client** (0 occorrenze in `src/` e
  `supabase/`), quindi il backup attivo spende due delle cinque voci su tabelle morte.
- ⚠️ Gli scheduled workflow girano **solo dal branch di default (`main`)**: finché il file corretto
  non è su `main`, il cron notturno usa ancora la versione rotta. Portare **solo quel file**, non
  l'intero branch (vedi §1.1): `git checkout main && git checkout ios-version -- .github/workflows/db-backup.yml`
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
> `src/App.jsx:35`, `supabase/functions/send-reminders/index.ts:261` e **le policy RLS**.
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
Il `signOut()` di `App.jsx:219` è cosmetico. Forma corretta: funzione `security definer` che
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

## 5. Il formato `workouts.sections` (jsonb) — struttura chiave

Tre categorie principali + due implicite.

### Comune
```jsonc
{ "intensity": "7", "category": "Hyrox" | "Running" | "Custom" | "Event", "isAutonomous": true? }
```

### Hyrox → `sections.blocks[]`
```jsonc
{
  "id": 0.123,                     // Math.random(), solo client-side
  "type": "WarmUp"|"Cash In"|"ON/OFF"|"EMOM"|"AMRAP"|"For Time"|"Interval"|"Rest"|"Cash Out",
  "params": {                      // dipende dal type
    "duration": "3:00",            // WarmUp, Rest, AMRAP
    "on": "1:00", "off": "1:00",   // ON/OFF
    "interval": "1:00",            // EMOM
    "rounds": "10",                // ON/OFF, EMOM, For Time, Interval, Cash In/Out
    "rest": "1:00"                 // Cash In/Out con rounds > 1
  },
  "notes": "…",
  "exercises": [{
    "id": 0.456, "name": "Wall Balls",
    "reps": "15" | "Max" | "-",    // esercizi a ripetizioni
    "meters": "500m" | "Max" | "-",// ergometri, sled, carry, run
    "exTime": "1:30",              // solo blocchi Interval
    "ergoPace": "2:00 /500m" | "Z2" | "45 RPM",
    "speed": "12.0 km/h",          // solo Run in modalità velocità
    "kg": "9",                     // stringa senza unità
    "intensity": "8", "notes": "…"
  }]
}
```
Tassonomie esercizi in `CreateWorkout.jsx:16-55`: `ERGOMETERS`, `SLED_EXERCISES`, `CARRY_EXERCISES`,
`DISTANCE_EXERCISES`, `HYBRID_EXERCISES` (reps **o** distanza) + `HYROX_EXERCISES` (~130 esercizi,
ordinati alfabeticamente). Si possono aggiungere esercizi **custom** scrivendoli a mano nel picker.

### Running → `sections.steps[]`
```jsonc
{
  "id": 0.789,
  "type": "warmup"|"run"|"recover"|"cooldown"|"repeat",
  // step semplice:
  "duration": "10 min" | "5 km", "pace": "5:00 - 5:30 /km", "paceMin": "…", "paceMax": "…",
  "intensity": "6", "notes": "…",
  // step "repeat" (ripetute):
  "rounds": "8",
  "runDuration": "400m", "runPace": "…", "runPaceMin/Max": "…", "runIntensity": "8",
  "recDuration": "1 min", "recPace": "…", "recPaceMin/Max": "…", "recIntensity": "3"
}
```
Ritmi ammessi: `Libero`, `Camminata`, `Z1`–`Z5`, `All out`, `Gara`, oppure `m:ss /km` da 2:00 a 10:00.

### Custom / Autonomo
`{ "category": "Custom", "isAutonomous": true }` — nessun blocco, il contenuto vive in
`workouts.coach_notes` (creato dal coach) o in `athlete_workouts.notes` (allenamento libero
inserito dall'atleta). L'atleta lo crea dal bottone "Aggiungi allenamento libero" in Home.

### ⚠️ Titolo automatico (dal 24/08/2026, su ENTRAMBI i branch)
`workouts.title` **non può mai essere vuoto**: è letto in 57 punti su `main` e 66 su `ios-version`
(scheda, archivio, PDF, story IG, TV, testo delle push) e il DB è condiviso. Quando l'utente non
scrive un titolo, `src/lib/workoutTitle.js` ne **genera e salva** uno nel formato
`Allenamento libero · mar 25 ago`, con suffisso `(2)`, `(3)`… se quel giorno ne esiste già uno uguale.
- Il campo Titolo è **facoltativo** solo nel flusso Custom/autonomo (modale "Allenamento Libero" in
  Home/AthleteDetail/WorkoutDetail) e nel builder **quando `category === 'Custom'`**. Per Hyrox e
  Running resta obbligatorio: un titolo generato dalla data non direbbe nulla di una programmazione.
- Il placeholder del campo mostra in anticipo il titolo che verrà salvato, così l'utente sa cosa ottiene.
- Nessuna modifica di schema: `title` resta una stringa normale, quindi le due app restano compatibili.

### Event (gara)
`{ "category": "Event", "isEvent": true, "isAutonomous": true }` — creato dal Calendario.
Genera il banner countdown "Prossimo Obiettivo" in Home e in AthleteDetail.

### ⚠️ Formato legacy
Esistono workout vecchi con `sections.warmup / cashIn / main / cashOut` invece di `blocks`.
La migrazione **runtime** avviene in `getNormalizedBlocks()` (WorkoutDetail) e nel `useEffect` di
edit di CreateWorkout. **Non rimuovere questa logica di fallback.**

---

## 6. Design system — COLORI DA MANTENERE

### Palette (fonte di verità: `src/index.css` `@theme` + costanti nei file)

| Token | Hex | Uso |
|---|---|---|
| **Brand / giallo FLEOFIT** | `#f1ba17` | accento primario, categoria **Hyrox**, CTA principali, stato attivo navbar, logo "FIT" |
| **Background** | `#0B0B0B` | sfondo pagina |
| **Surface card** | `#1e1e1e` | card, modali, header |
| **Surface alt** | `#222222` | navbar, input, blocchi builder |
| **Surface 2** | `#2a2a2a` | bottoni secondari, avatar placeholder |
| **Input / pozzetto** | `#111111` | campi input dentro le card, scroll picker |
| **Bordi** | `#2a2a2a` / `#333` / `#383838` / `#444` | in scala crescente di contrasto |
| **Running** | `#0094C6` (azzurro) | categoria Running, picker corsa |
| **Custom / Autonomo** | `#D11149` (rosso magenta) | categoria Custom |
| **Event / Gara** | `#ffffff` | categoria Evento |
| **IA / voce** | `#a855f7` (viola) | modale "Genera con IA" |
| **Successo** | `green-500` Tailwind | workout completato |
| **Live / errore** | `red-500/600` | Live Coach Cam, cardio BLE, eliminazioni |
| **Offline** | `orange-500` | banner "Modalità Offline" |
| Testi | `white` → `gray-300` → `gray-400` → `gray-500` → `gray-600` | gerarchia discendente |

> ⚠️ In `src/index.css` sono definiti i token `--color-brand`, `--color-bg`, `--color-surface`,
> `--color-surface2`, ma **nel codice si usano quasi ovunque i valori arbitrari** (`bg-[#f1ba17]`).
> Se si fa refactor, migrare verso i token; i valori **non** devono cambiare.

### Codifica colore per intensità/RPE
- Slider **intensità** in CreateWorkout (`getIntensityColor`): grigi → bianco → giallo brand a 10.
- **RPE** in WorkoutDetail/Home (`getRpeColor`): ≤3 verde · ≤6 giallo · ≤8 arancione · >8 rosso.
  (⚠️ due scale diverse per lo stesso concetto, vedi §9.)

### Linguaggio visivo
- **Dark mode only.** Nessun tema chiaro previsto.
- Font: **Inter**, `sans-serif` di sistema come fallback. Titoli in `font-black` (900) con
  `tracking-tight`. Logo sempre `FLEO` bianco + `FIT` giallo.
- **Raggi**: `rounded-3xl` (24px) per card e modali · `rounded-2xl` (16px) per card interne e
  bottoni larghi · `rounded-xl` (12px) per input e bottoni piccoli · `rounded-full` per icon-button
  (11×11 o 10×10) e pillole di stato.
- **Pattern card**: `bg-[#1e1e1e] border border-[#2a2a2a] rounded-3xl p-5/p-6`, hover
  `hover:border-[#f1ba17]` (o il colore della categoria).
- **Badge/pillole**: `bg-<colore>/10 text-<colore> border border-<colore>/30 rounded-full text-xs font-bold`.
- **CTA primaria**: `bg-[#f1ba17] text-black font-bold rounded-xl hover:brightness-110`.
- **Icona grande in filigrana**: molte card hanno un'icona lucide `size={64-80}` in
  `absolute top-0 right-0 opacity-10 -rotate-12`, che va a `opacity-20` in hover.
- **Empty state**: bordo `border-dashed`, icona in cerchio grigio, testo grigio + emoji.
- **Skeleton loading**: `bg-[#1e1e1e] border border-[#2a2a2a] rounded-2xl h-N animate-pulse`.
- **Toggle segmentati**: contenitore `bg-[#111] p-1.5 rounded-2xl border border-[#333]` con
  indicatore assoluto che trasla (`translate-x-full`) in 300ms `ease-out`.
- **Modali**: overlay `bg-black/85`, contenuto via `createPortal(…, document.body)`,
  z-index `[60]` builder · `[100]` Home · `[150]` alert/RPE. Animazione
  `animate-in fade-in zoom-in-[0.96] duration-300 ease-out` (o la classe `.modal-transition`).
- **Bottom sheet** (centro notifiche): `rounded-t-3xl h-[80vh]`, maniglia grigia, **swipe-down > 100px per chiudere**.
- **Transizione pagina**: classe `.page-transition` — slide-up 15px + fade, 0.3s `cubic-bezier(0.16,1,0.3,1)`.
- **Scrollbar sempre nascoste** (regola globale in `index.css` + classe `.hide-scrollbar`).
- **Safe area iOS**: ogni pagina apre con `pt-[calc(env(safe-area-inset-top)+1rem)]` e
  `pb-24` per non finire sotto la navbar (`h-16` fissa in basso).
- **Feedback aptico**: `Haptics.impact({ style: ImpactStyle.Light })` sugli scroll-picker e sugli
  slider, `Heavy` a fine round del timer; fallback `navigator.vibrate()` su web.
- **Testo non selezionabile** globalmente tranne input/textarea (regola inline in `App.jsx`).

---

## 7. Funzionalità principali (mappa per orientarsi)

### Atleta
- **Home**: saluto orario + frase motivazionale del giorno (persistita in localStorage con
  anti-ripetizione sulle ultime 10), banner countdown prossimo evento, **slider a 2 pagine**
  (settimana a pallini colorati per categoria/stato ↔ statistiche settimanali: tempo, completati,
  RPE medio), workout di oggi, prossimi allenamenti, scorciatoie, archivio.
- **Completamento workout** → apre la **modale RPE**: slider 1-10 draggabile + note + pulsante
  **🍏 Apple Health** che appende durata/calorie/battiti medi alle note.
- **Allenamento libero**: l'atleta crea un workout Custom autonomo con titolo, data e note.
- **Modalità Offline**: `@capacitor/network` rileva l'assenza di rete → banner arancione,
  le azioni finiscono in `localStorage.fleofit_offline_queue` e vengono sincronizzate al ritorno
  della linea. Cache read in `fleofit_cache_workouts_<uid>`, `fleofit_cache_w_<id>`, ecc.
- **Profilo** (`/profile` → `AthleteDetail`): tab Workout / PR / Statistiche, vista lista o
  calendario, link Instagram/Strava.

### Coach (admin)
- **Workout Builder** (`/create`), 2 step: (1) titolo+data+categoria → (2) composizione.
  - Blocchi Hyrox riordinabili con **drag&drop desktop + `useTouchDrag` su mobile**, duplicabili,
    con scroll-picker in stile iOS per tempi/rounds/kg/metri.
  - Builder Running con fasi warmup/run/recover/cooldown/**repeat** e range di passo "da–a".
  - **Genera con IA**: dettatura vocale o testo → Gemini → blocchi precompilati.
  - **Autosalvataggio bozza** in `localStorage.fleofit_workout_draft` + intercettazione
    dell'uscita di pagina (beforeunload, click sui link, blocco pull-to-refresh).
  - Salvando un workout esistente si può scegliere "sovrascrivi" o "salva come nuovo".
- **Gestione atleti**: rubrica, scheda con storico, note private, PR, statistiche (carico
  settimanale = tempo × RPE su 4 settimane, tasso di completamento a 30 giorni, distribuzione RPE).
- **Assegnazione**: multi-atleta con data, dall'archivio o dalla scheda workout → notifica push immediata.
- **Live Coach Cam**: Supabase **Presence** sul canale `global_live_workouts`; quando un atleta
  avvia il timer il coach lo vede in Home, può aprire lo spettatore (timer live via broadcast),
  mandare **reazioni emoji** (🔥💪🚀👏💀) e messaggi audio **walkie-talkie** (upload su
  `voice-notes`, broadcast dell'URL, auto-delete dopo 60s).
- **Settings**: notifiche push, backup/restore JSON, generazione codici invito + link
  `?invite=CODICE`, connessione fascia cardio BLE, cambio password, simula atleta.

### Workout Detail (il file più denso)
- Rendering della scheda per categoria, note atleta con RPE, note vocali bidirezionali
  (registrazione nativa iOS + web MediaRecorder, player custom con waveform).
- **Timer guidato**: `buildTimerSequence()` linearizza il workout in una sequenza di step
  (`prep` → step → `done`) con beep WAV generati in-memory (600Hz corto / 1200Hz lungo),
  vibrazione, mute, minimizzabile, `KeepAwake`.
- **Export PDF** (jsPDF, sfondo scuro, logo, intensità colorata con emoji 💪).
- **Story Instagram**: card 420px renderizzata con `html-to-image` → salvataggio in galleria
  (`@capacitor-community/media`) o `Share`.
- **Cast su TV**: codice a 4 cifre generato da `/tv`; il telefono aggiorna `tv_sessions` e
  trasmette lo stato del timer via broadcast Realtime sul canale `tv_<code>`.

---

## 8. Convenzioni da rispettare

- **Chiavi localStorage** (tutte con prefisso `fleofit_`, tranne `adminRoleOverride`):
  `fleofit_name_<uid>`, `fleofit_invite_code`, `fleofit_motivation`, `fleofit_workout_draft`,
  `fleofit_offline_queue`, `fleofit_cache_workouts_<uid>`, `fleofit_cache_w_<id>`,
  `fleofit_cache_aw_<id>_<athleteId>`, `fleofit_cache_all_aw_<id>`, `fleofit_tv_code`,
  `adminRoleOverride`.
- **Mai `alert()` / `confirm()` nativi** nella UI: usare `CustomAlert` / `CustomConfirm` via
  `setAlertInfo({ title, message, type: 'error'|'success' })` / `setConfirmInfo({ title, message, onConfirm })`.
  (Restano alcune `alert()` legacy in Home e CreateWorkout — quando le tocchi, convertile.)
- **Ogni modale** va renderizzata con `createPortal(…, document.body)`.
- **Rotte**: `/`, `/login`, `/tv` (pubblica), `/calendar`, `/create`, `/athletes`, `/athletes/:id`,
  `/profile`, `/workout/:id`, `/archive`, `/settings`. Deep link workout:
  `/workout/<workoutId>?athlete_id=<uid>` — è il formato usato anche in `notifications.route`.
- **Aggiornamenti ottimistici**: si aggiorna lo state prima della chiamata Supabase e si fa rollback
  in caso di errore (pattern in `toggleTodayWorkout`, `toggleStatus`).
- **Native check**: sempre `Capacitor.isNativePlatform()` prima di usare un plugin, con
  `.catch(() => {})` sui plugin non critici.
- **Badge iOS**: ogni volta che cambia il numero di notifiche non lette bisogna aggiornare
  `Badge.set/clear` **e** `push_subscriptions.badge_count` (l'Edge Function legge quel campo per
  incrementarlo).

---

## 9. Debito tecnico noto (contesto, non da sistemare senza richiesta)

1. **Codice duplicato pesante** — `parseNotesAndRpe`/`formatNotesWithRpe`, `RpeModal`,
   `VoiceRecorder`, `AudioVisualizer`, `CustomAudioPlayer`, `TYPE_COLORS`, `ERGOMETERS`,
   il calcolo del tempo/carico settimanale e i beep WAV sono **ricopiati** in Home, WorkoutDetail,
   AthleteDetail, CreateWorkout e TVDashboard. Candidati naturali a `src/lib/` + `src/components/`.
   `src/lib/` **esiste dal 24/08/2026** (`blockHints.js`): è il posto dove spostarli.
2. **File morti verificati** (nessun import li referenzia): `src/pages/useTouchDrag.js`
   (duplicato di `src/useTouchDrag.js`, che è quello vero), `src/pages/patch.js`,
   `src/pages/Invite.jsx` (nessuna rotta), `src/App.css` (boilerplate Vite),
   `index.ts` in root (copia vecchia di `send-reminders`).
3. **Due scale colore RPE/intensità** diverse (§6) per lo stesso range 1-10.
4. **Due librerie di registrazione audio** installate insieme (`capacitor-voice-recorder` usata in
   CreateWorkout, `@independo/capacitor-voice-recorder` in Home/WorkoutDetail).
5. **`window.location.reload()`** usato dopo alcuni salvataggi in Home invece di rifare il fetch.
6. **Segreti nel repo**: `supabaseClient.js` contiene URL + anon key in chiaro (accettabile per una
   anon key **se** l'RLS è configurata correttamente — verificare le policy prima di aprire l'app);
   `Settings.jsx` contiene la VAPID public key hardcodata; `GoogleService-Info.plist` è versionato.
7. **`ADMIN_EMAILS` hardcodata** in `App.jsx` **e** ri-hardcodata nell'Edge Function `send-reminders`:
   se si aggiunge un admin va cambiata in **due** posti.
8. **`COACHING_ID` hardcodato** (`0118e43f-…`) in due file.
9. ~~Backup GitHub Action con lista tabelle obsoleta~~ → **riscritto il 24/08/2026** (vedi §4),
   committato in `79d146a` e pushato su `ios-version`.
   **Resta aperto**: il file non è ancora su `main`, e gli scheduled workflow girano solo dal branch
   di default → il cron notturno usa tuttora la versione rotta. Portare **solo quel file**:
   `git checkout main && git checkout ios-version -- .github/workflows/db-backup.yml`
9-bis. **Due app sullo stesso database senza staging** e la web app (`main`) che non capisce l'RPE:
   è il debito architetturale più serio del progetto. Dettagli e conseguenze in §1.1.
10. ~~**`cloud-sync`** invocata dal client (`health.js`) ma assente dal repo~~ → `CloudSyncService`
    **eliminato il 24/08/2026** (`fc81404`): era codice dormiente che chiamava una Edge Function
    inesistente, e rinforzava il rilievo 2.3.1(a). La sincronizzazione Strava/Garmin resta un'idea
    non implementata (§10), ora senza codice morto a suggerire il contrario.
11. Nessun test automatico, nessun TypeScript effettivo nel `src/` (tutto `.jsx`) anche se il build
    esegue `tsc -b`.

---

## 9-ter. App Store — rifiuto del 1.1.0 (2) e ri-sottomissione del 1.1.0 (3)

### Cronologia
- **22 mag 2026** — caricata `1.1.0 (2)`. **Respinta** con **2.3.1(a) Hidden features** e
  **3.2.1(viii) Financial Services**.
- **24 ago 2026** — correzioni applicate nel commit `fc81404`, caricata `1.1.0 (3)`.
  ⚠️ Il `pbxproj` era rimasto a `CURRENT_PROJECT_VERSION = 1` mentre su App Store Connect la (2)
  era già bruciata: Xcode ha incrementato da solo a 3 in fase di distribuzione. Il progetto è stato
  riallineato a 3 in `5c02b81`. **Prima di archiviare, controllare il build number reale su ASC**,
  non fidarsi del pbxproj.

> 🔴 **AGGIORNAMENTO 24/08/2026 — la causa del rifiuto NON è stata rimossa del tutto.**
> `demo@fleofit.it` è stata aggiunta al bundle e a `send-reminders`, ma **non alle policy RLS**
> (§4-bis). Nel database il revisore non è admin: vede l'interfaccia coach completamente vuota.
> La build 1.1.0 (3) attualmente in revisione è quindi esposta a un **secondo rifiuto 2.3.1(a)**.
> Il fix è un `ALTER POLICY` additivo su 5 policy, senza rischio per la web app.

### 2.3.1(a) — causa accertata: l'account admin dato ad Apple era inerte
Il ruolo coach non viene dal DB ma da `ADMIN_EMAILS` **hardcoded nel JS compilato**; nel bundle
spedito a maggio c'erano solo le 4 email personali. Al login del revisore `isAdmin` era `false` →
o vedeva solo il lato atleta, o veniva espulso da `signOut()` a `/login?error=unauthorized`
(`App.jsx:185-223`). **Il ruolo coach in sé non è una violazione**: gli accessi per ruolo sono
leciti, devono solo essere raggiungibili.

> ⚠️ Corollario da ricordare: **che l'account esista su Supabase non significa nulla.** Può avere
> tutti i permessi del mondo sul DB ed essere comunque `isAdmin = false`. Conta solo l'elenco
> compilato dentro il bundle.

### 3.2.1(viii) — falso positivo su "Cash In" / "Cash Out"
46 occorrenze letterali nel bundle. Sono termini Hyrox (blocco di apertura e di chiusura), ma per
lo scanner sono movimenti di denaro; il segnale è rinforzato da `push_subscriptions` e
`invitation_codes`.
**DECISIONE DEL COMMITTENTE (24/08/2026): la terminologia NON si tocca.** Strategia scelta:
**non rinominare, disambiguare**. `block.type` resta `'Cash In'` ovunque.
⚠️ **Mai fare find&replace**: sono valori persistiti in `workouts.sections.blocks[].type` (jsonb) e,
nel legacy, chiavi `sections.cashIn`/`cashOut`; il DB è condiviso con la web app in produzione.

### Correzioni applicate (commit `fc81404`)
- `demo@fleofit.it` aggiunta a `ADMIN_EMAILS` (`src/App.jsx`) **e** alla lista gemella in
  `send-reminders/index.ts` (§9 punto 7: sono due liste).
- Nuovo `src/lib/blockHints.js` (`BLOCK_HINT`), didascalie affiancate al termine nel picker blocchi
  e nell'intestazione blocco (`CreateWorkout.jsx`), nella scheda workout e nel PDF
  (`WorkoutDetail.jsx`), e sulla TV (`TVDashboard.jsx`).
- Rimossi: `NSSpeechRecognitionUsageDescription` (funzione inesistente su iOS), `CloudSyncService`
  (codice dormiente), blocco `server`/`cleartext` da `capacitor.config.ts`, blocchi commentati
  "OPZIONE COACH DISATTIVATA" (`App.jsx`, `Login.jsx`).
- `UIRequiredDeviceCapabilities` da `armv7` ad `arm64`.
- Toggle Settings → "Anteprima come atleta"; "Modalità Bunker" → "Modalità Offline".

### Verifiche fatte sul binario spedito (24/08/2026)
Fatte **dentro `App.app` dell'archivio caricato**, non sul sorgente: `demo@fleofit.it` presente nel
bundle JS, didascalie presenti, zero occorrenze di `cloud-sync` e "Modalità Bunker", zero
`cleartext` in `capacitor.config.json`, `arm64`, bundle id `it.federicoleo.fleofit` (non il `.dev`
della configurazione Debug).

> **Controllo obbligatorio prima di ogni archive**, è quello che è mancato a maggio:
> `grep -l "demo@fleofit.it" dist/assets/*.js` deve stampare un file.
> Attenzione a `grep -c` su più file: stampa una riga per file (quasi tutte `:0`) ed esce con
> codice 1 quando non trova nulla — si legge come un fallimento e non lo è.

### Cosa non sta nel repo e va fatto a mano
Account `demo@fleofit.it` su Supabase Auth **con riga `athletes` pre-creata** (senza, il revisore
finisce in onboarding), dati demo perché la dashboard coach non si apra vuota, secondo account
atleta, redeploy di `send-reminders`, note per il revisore, risposta nel **Resolution Center**.

### Verificato non problematico
`hidden`/`unlock` sono classi Tailwind e `unlockAudio`; i file morti non vengono bundlati (Vite li
esclude); nessuna eccezione ATS; nessun codice di pagamento/IAP; `ITSAppUsesNonExemptEncryption`
già a `false`.

### Se il rifiuto su 3.2.1(viii) si ripete
**Non ricaricare una terza build in silenzio** — rispondere in Resolution Center e chiedere una
chiamata con App Review.

Documento operativo completo (reperti, note revisore, checklist):
artifact "Riammissione FLEOFIT" — https://claude.ai/code/artifact/b2b8e586-a617-4172-98dc-f06e2b34ce6a

---

## 10. Idee/direzioni note per il futuro

- Possibile **rebranding** (nome diverso da FLEOFIT) mantenendo la palette.
- Modifiche grafiche/UI attese, palette invariata.
- Integrazione **Strava/Garmin** via `cloud-sync` già predisposta lato client (`CloudSyncService`).
- Ruolo `coach` separato da `admin`, già abbozzato ma disattivato.
