# CLAUDE.md — Memoria globale progetto FLEOFIT

> Documento di memoria persistente per Claude. Leggere **sempre** questo file prima di
> toccare il codice o proporre modifiche grafiche.
> Ultimo aggiornamento: **26 agosto 2026**.
> **Due branch attivi e DIVERGENTI, ENTRAMBI MANUTENUTI**: `main` = web app in produzione ·
> `ios-version` = app per l'App Store (§1.1 — rifare sempre `git fetch` prima di parlare dei due).
> Ultimo commit `6a28841` su `ios-version`, allineato con `origin/ios-version`.
> `npm test` → **125 test**, `npm run lint` → **46 problemi** (erano 164 la mattina del 25/08).
> Build **1.1.0 (3)** in revisione su App Store Connect dal 24/08/2026, dopo il rifiuto di
> maggio. ✅ **Il 26/08 la causa di quel rifiuto è stata chiusa e verificata dai due lati**:
> `aps-environment = production` e le 5 email admin nell'`.ipa` spedito, e `demo@fleofit.it`
> che assegna davvero un workout dall'app. Dettagli in §9-ter.

---

## 0. Regole operative per Claude

> 📋 **Le cose da fare stanno in [BACKLOG.md](BACKLOG.md)**, non qui. Questo file spiega
> *com'è fatto* il progetto; il backlog elenca *cosa manca*, con il perché di ognuna e
> cosa la blocca. Aggiornare il backlog quando una voce si chiude.

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
5. ⚠️ **I numeri di riga scadono in fretta, i nomi no.** Quando citi un punto del codice —
   qui, in un commit o parlando con il committente — nomina la funzione o la costante, non la
   riga. Il 25/08/2026 tutti e cinque i riferimenti `file:riga` presenti in questo documento
   puntavano a righe scorrelate.
6. Prima di modificare un file grande (`WorkoutDetail.jsx` 3.052 righe, `AthleteDetail.jsx` 2.727,
   `CreateWorkout.jsx` 2.263, `Home.jsx` 2.028 — contate il 25/08/2026) leggere le sezioni rilevanti: c'è molta logica
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
| **`main`** (default) | **Web app in produzione**, quella che gli atleti usano oggi | **collegato a Vercel** → `https://fleofit.vercel.app`. LIVE, non rompere | `c2ed65d` — 25 ago 2026 |
| **`ios-version`** | Versione nativa iOS/Capacitor, quella caricata sull'App Store (§9-ter) | **collegato a NIENTE**: è solo il backup su GitHub del lavoro locale. L'app arriva sull'App Store da Xcode, non da un deploy | `6a28841` — 25 ago 2026 |

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

### Rapporto tra i due: SONO DIVERGENTI, ED ENTRAMBI SI MUOVONO
Verificato il 25/08/2026 **dopo un `git fetch`**:
`git rev-list --left-right --count origin/main...origin/ios-version` → **`49 55`**.
Il divario **cresce a ogni sessione di lavoro su `ios-version`**: più si aspetta, più il merge costa.
**Un merge non è un fast-forward**: è un merge vero.

> 🔴 **`main` NON è fermo, e questo documento ha già sbagliato due volte su questo punto.**
> Prima diceva `0 18` e "non divergenti" (falso: nessuno aveva fatto fetch). Poi diceva
> "`8919bfd` — 8 giu 2026" (falso al 25/08: **`main` ha ricevuto 8 commit fra il 24 e il 25
> agosto**). Le correzioni fatte su `ios-version` vengono **riportate a mano su `main`**, una
> a una: backup del database e dei bucket, titolo facoltativo, accessibilità, notifiche di
> assegnazione, cestino degli atleti.
> **Regola, senza eccezioni**: `git fetch` **prima** di qualunque affermazione sui due branch,
> e prima di dire che qualcosa "manca su main" verificarlo con
> `git show origin/main:<file>` o `git grep <cosa> origin/main -- src/`.

Peggio del conteggio: i due branch hanno lavorato **in parallelo sugli stessi file**. Fra il 15 e
il 21 maggio `main` ha ricevuto una propria linea di sviluppo su `TVDashboard.jsx`,
`CreateWorkout.jsx` e `WorkoutDetail.jsx` (TV, opzioni ergometri, distanze di corsa, fix PDF/story
IG, beep del timer), cioè proprio i file più grandi del progetto, che `ios-version` ha modificato
per conto suo. Un merge produrrà conflitti reali lì dentro, non banali da risolvere.

### Cosa c'è davvero solo su `ios-version` (verificato su `origin/main` il 25/08/2026)
Assenti da `main`: tutta la cartella `ios/`, `capacitor.config.ts`, `privacy-policy.html`,
`src/pages/bluetooth.js` (fascia cardio BLE), `src/pages/health.js` (Apple Health),
`supabase/functions/ai-workout/` (generazione IA), `src/lib/blockHints.js`, l'**RPE**, la
**Live Coach Cam**, la **modalità Offline** (ex "Bunker"), push FCM native, centro notifiche + badge.
Aggiunti il 25/08 e ancora solo qui: **tutta l'infrastruttura di test** (`vitest.config.js`,
`src/test/`, i `__tests__`), `src/lib/offlineQueue.js`, `src/lib/rpe.js`, `src/lib/blockColors.js`,
`src/lib/alert.js`, `src/lib/pushToken.js`, `src/lib/constants.js` e
`supabase/functions/_shared/admin.ts`.
⚠️ `src/lib/workoutTitle.js` invece **c'è anche su `main`**: è stato riportato lì il 24/08.

Due correzioni rispetto a quanto scritto qui in passato:
- ⚠️ **`TVDashboard.jsx` esiste anche su `main`.** La TV Dashboard non è esclusiva di `ios-version`:
  esistono due implementazioni diverse, sviluppate in parallelo a maggio.
- `main` **conosce** `Interval`, `Custom`, `Event` e `isAutonomous` (l'8 giugno ha ricevuto
  "Coach can create custom workout"). Quel pezzo di incompatibilità non c'è più — resta solo l'RPE.

### ⚠️ Il database e le Edge Function sono CONDIVISI
Entrambi i branch puntano allo **stesso progetto Supabase** (`riyqtcssllupakjtoehj`) e alle **stesse
Edge Function deployate**. Non esiste un ambiente di staging. Conseguenze concrete:
- Una **migrazione di schema** fatta per iOS colpisce subito la web app in produzione.
- `send-reminders` è **una sola funzione deployata**: 583 righe su `ios-version` contro 247 su
  `main`, cioè 336 in più (rimisurate il 25/08/2026). Qualunque versione sia deployata, serve
  entrambe le app. La lista admin non è più duplicata al suo interno: dal 25/08 importa
  `supabase/functions/_shared/admin.ts`, che va tenuta allineata a `ADMIN_EMAILS` di
  `src/App.jsx` e alle policy RLS (§9 punto 7).
- ✅ Il fix del backup (`db-backup.yml`) **è su `main` dal 25/08/2026** (`e5d11c5`, `30c597b`,
  `c2ed65d`) ed è **byte-identico** a quello di `ios-version`: verificato con
  `diff <(git show origin/main:.github/workflows/db-backup.yml) .github/workflows/db-backup.yml`.
  Conta perché i cron di GitHub girano **solo dal branch di default**: finché il file non era lì,
  il backup notturno era quello rotto. Ora non lo è più.
  Se in futuro tocchi quel workflow, il modo di riportarlo è **solo quel file**, non l'intero branch:
  `git checkout main && git checkout ios-version -- .github/workflows/db-backup.yml`

### ⚠️ Incompatibilità dati nota: l'RPE
`main` **non conosce l'RPE**: `parseNotesAndRpe`/`formatNotesWithRpe` non esistono su quel branch
(0 occorrenze di "RPE" in `src/`). Quindi:
- Un workout completato da iOS scrive `[RPE: 7/10]\ntesto` in `athlete_workouts.notes`;
  sulla **web app quel prefisso appare come testo grezzo** dentro la nota.
- Se l'atleta **modifica la nota dalla web app**, il valore viene riscritto verbatim
  (`.update({ notes })` in `AthleteDetail.jsx` e `.update({ notes: finalNote })` in
  `WorkoutDetail.jsx`; in `Home.jsx` il punto è sparito col codice morto rimosso il 25/08):
  se cancella il prefisso, **l'RPE è perso** e le statistiche iOS (RPE medio, carico settimanale)
  ricadono silenziosamente sul default 5.
Se si vuole tenere le due app in convivenza a lungo, il minimo sindacale è **retroportare
`parseNotesAndRpe` su `main`** (anche solo in lettura, per non distruggere il dato).

---

## 1.2 Ruoli
| Ruolo | Come si ottiene | Cosa vede |
|---|---|---|
| `admin` (coach) | email in `ADMIN_EMAILS` (`src/App.jsx`, in cima al file) | Tutto: crea workout, gestisce atleti, codici invito, backup, Live Coach Cam |
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
npm test         # vitest run
npx cap sync ios # dopo il build, per aggiornare il progetto Xcode
```

### Due configurazioni, non una
`vite.config.ts` costruisce l'app · `vitest.config.js` la testa (jsdom,
`src/test/setup.js`, che finge `Capacitor.isNativePlatform() === false` così i test
prendono sempre il ramo web). Tenerle separate evita che il build di produzione carichi jsdom.
> ⚠️ `src/test/setup.js` sostituisce anche `localStorage` con uno in memoria: **jsdom, in
> questa versione di Node, ne espone uno rotto** (`getItem is not a function`, è l'origine del
> warning `--localstorage-file`). Senza quel rimpiazzo nessuna pagina si monta, perché quasi
> tutte leggono localStorage in un effetto. Era il vero ostacolo ai test sulle pagine.
> ⚠️ **Non creare mai un `vite.config.js`**: Vite risolve `.js` prima di `.ts` e
> maschererebbe `vite.config.ts` senza dire niente. È già successo il 25/08/2026.
Per testare su iPhone in dev live: scommentare `server.url` in `capacitor.config.ts` con l'IP locale.

---

## 3. Struttura dei file

> Struttura del branch `ios-version`. Su `main` mancano `ios/`, `capacitor.config.ts`,
> `privacy-policy.html`, `bluetooth.js`, `health.js`, `src/lib/` e la Edge Function `ai-workout`.
> ⚠️ `TVDashboard.jsx` **c'è anche su `main`**, in una versione diversa (§1.1).

```
vite.config.ts                 # costruisce l'app
vitest.config.js               # la testa (jsdom) — ⚠️ MAI creare un vite.config.js: Vite risolve
                               #   .js prima di .ts e maschererebbe quello vero, in silenzio
src/
├─ main.jsx                    # entry, importa index.css
├─ App.jsx                     # routing, AuthContext, Onboarding, ProtectedRoute, DeeplinkHandler
│                              #   ⚠️ qui vive ADMIN_EMAILS (§9 punto 7)
├─ index.css                   # Tailwind @theme + animazioni globali (page-transition, modal-transition)
├─ supabaseClient.js           # createClient con URL + anon key hardcodati
├─ useTouchDrag.js             # hook drag&drop touch nativo (usato da CreateWorkout)
├─ lib/                        # logica pura, l'unica parte con test
│  ├─ alert.js                 # mostraAlert/mostraErrore: alert applicativo senza passare props
│  ├─ blockColors.js           # TYPE_COLORS, unificata dalle 5 copie sparse
│  ├─ blockHints.js            # BLOCK_HINT: didascalie in chiaro dei tipi di blocco (§9-ter)
│  ├─ constants.js             # ERGOMETERS e affini
│  ├─ offlineQueue.js          # ⚠️ coda offline + leggiJson/scriviJson — vedi §9 regola 0-bis
│  ├─ pushToken.js             # rinfresco del token FCM
│  ├─ rpe.js                   # parseNotesAndRpe / formatNotesWithRpe
│  ├─ timerSequence.js         # buildTimerSequence + getNormalizedBlocks (§5 legacy)
│  ├─ workoutTitle.js          # titolo generato dalla data (c'è anche su main)
│  └─ __tests__/               # 38 test: blockColors, offlineQueue, rpe, workoutTitle
├─ test/
│  └─ setup.js                 # jsdom + finto Capacitor.isNativePlatform() === false
├─ components/
│  ├─ Navbar.jsx               # bottom nav fissa, voci variabili per ruolo
│  ├─ CustomModals.jsx         # CustomAlert + CustomConfirm + AlertHost
│  └─ CustomDatePicker.jsx     # date picker custom dark
└─ pages/
   ├─ Home.jsx                 # dashboard atleta + coach + centro notifiche + Live Coach Cam
   ├─ Login.jsx                # welcome / login / signup / codice invito / recupero password
   ├─ Calendar.jsx             # calendario mensile, creazione "Evento/Gara"
   ├─ CreateWorkout.jsx        # workout builder (Hyrox / Running / Custom) + generazione IA
   ├─ WorkoutDetail.jsx        # scheda workout, timer guidato, PDF, story IG, note vocali, TV
   ├─ Athletes.jsx             # rubrica atleti + cestino "Eliminati di recente" (admin)
   ├─ AthleteDetail.jsx        # scheda atleta: workout, PR, statistiche (è anche /profile)
   ├─ WorkoutsArchive.jsx      # archivio storico workout
   ├─ Settings.jsx             # notifiche, backup/restore JSON, codici invito, BLE, password
   ├─ TVDashboard.jsx          # /tv — dashboard fullscreen per TV/Chromecast, codice a 4 cifre
   ├─ bluetooth.js             # BluetoothService — singleton BLE fascia cardio
   ├─ health.js                # HealthService (Apple Health)
   ├─ motivations.js           # 15 frasi motivazionali + getDailyMotivation() con anti-ripetizione
   └─ __tests__/               # 37 test su HyroxBlock e RunningStepRow (estratti da CreateWorkout)
supabase/
   ├─ functions/_shared/admin.ts   # ADMIN_EMAILS condivisa dalle due Edge Function (§9 punto 7)
   ├─ functions/send-reminders/    # notifiche push (5 modalità)
   ├─ functions/ai-workout/        # Gemini: trascrizione audio + generazione blocchi JSON
   └─ schema/                      # fotografia delle policy RLS — NON è una migrazione (§4-bis)
```
> I file morti che questa sezione elencava (`App.css`, `pages/patch.js`, `pages/Invite.jsx`,
> `pages/useTouchDrag.js`, `index.ts` in root) **non esistono più**: rimossi il 24-25/08/2026.

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
La migrazione **runtime** avviene in `getNormalizedBlocks()` (ora in `src/lib/timerSequence.js`)
e nel `useEffect` di edit di CreateWorkout. **Non rimuovere questa logica di fallback.**
✅ Dal 26/08/2026 è coperta da test, inclusa la conversione storica «EMOM con parametro `on`
era in realtà un ON/OFF»: perderla trasformerebbe l'allenamento senza errori a schermo.

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

0-bis. ⚠️ **localStorage si legge SOLO con `leggiJson`/`scriviJson` di `src/lib/offlineQueue.js`.**
   Un `JSON.parse(localStorage.getItem(...))` nudo ha già prodotto due guasti silenziosi
   (§9-quater punti 1 e 4). Le chiavi sono elencate al §8.
1. **Codice duplicato pesante** — `parseNotesAndRpe`/`formatNotesWithRpe`, `RpeModal`,
   `VoiceRecorder`, `AudioVisualizer`, `CustomAudioPlayer`, `TYPE_COLORS`, `ERGOMETERS`,
   il calcolo del tempo/carico settimanale e i beep WAV sono **ricopiati** in Home, WorkoutDetail,
   AthleteDetail, CreateWorkout e TVDashboard. Candidati naturali a `src/lib/` + `src/components/`.
   `src/lib/` **esiste dal 24/08/2026** (`blockHints.js`): è il posto dove spostarli.
2. ~~File morti~~ → **rimossi tutti e cinque** (`src/pages/useTouchDrag.js`, `src/pages/patch.js`,
   `src/pages/Invite.jsx`, `src/App.css`, `index.ts` in root). Verificato il 25/08: nessuno
   esiste più sul disco. ⚠️ `src/pages/Invite.jsx` **esiste ancora su `main`**.
   Il 25/08 ne è stato tolto altro: `updateWorkoutNote` (Home), `SCHEMES` (TVDashboard),
   `isDistance` con la sua tassonomia e `MINUTES_OPTIONS`/`timeToSeconds`/`formatTime`
   (CreateWorkout), più 10 import inutilizzati.
3. **Due scale colore RPE/intensità** diverse (§6) per lo stesso range 1-10.
4. **Due librerie di registrazione audio** installate insieme (`capacitor-voice-recorder` usata in
   CreateWorkout, `@independo/capacitor-voice-recorder` in Home/WorkoutDetail).
5. **`window.location.reload()`** usato dopo alcuni salvataggi in Home invece di rifare il fetch.
6. **Segreti nel repo**: `supabaseClient.js` contiene URL + anon key in chiaro (accettabile per una
   anon key **se** l'RLS è configurata correttamente — verificare le policy prima di aprire l'app);
   `Settings.jsx` contiene la VAPID public key hardcodata; `GoogleService-Info.plist` è versionato.
7. **`ADMIN_EMAILS` hardcodata in due posti + le policy RLS.** Le Edge Function non hanno più
   una copia propria: dal 25/08 importano entrambe `supabase/functions/_shared/admin.ts`.
   Restano quindi **`src/App.jsx` + `_shared/admin.ts` + le policy RLS** = tre copie in tutto.
   ✅ Verificate allineate il 25/08 (stesse 5 email, e `pg_policies` coincide con la fotografia
   in `supabase/schema/`). **È il meccanismo che ha causato il rifiuto 2.3.1(a) di maggio:
   ricontrollarlo prima di ogni submission**, vedi §9-ter.
8. **`COACHING_ID` hardcodato** (`0118e43f-…`) in due file.
9. ~~Backup GitHub Action con lista tabelle obsoleta~~ → **CHIUSO il 25/08/2026.** Riscritto il
   24/08 (`79d146a`, vedi §4) e **portato su `main`** il 25/08, dove i cron girano davvero.
   Verificato identico sui due branch con `diff`.
9-bis. **Due app sullo stesso database senza staging** e la web app (`main`) che non capisce l'RPE:
   è il debito architetturale più serio del progetto. Dettagli e conseguenze in §1.1.
10. ~~**`cloud-sync`** invocata dal client (`health.js`) ma assente dal repo~~ → `CloudSyncService`
    **eliminato il 24/08/2026** (`fc81404`): era codice dormiente che chiamava una Edge Function
    inesistente, e rinforzava il rilievo 2.3.1(a). La sincronizzazione Strava/Garmin resta un'idea
    non implementata (§10), ora senza codice morto a suggerire il contrario.
11. ~~Nessun test automatico~~ → **55 test dal 25/08/2026** (`npm test`, vitest), tutti
    verificati per mutazione: se si rompe di proposito il codice che coprono, falliscono.
    Non sono decorativi.
    - **18 sulla logica pura di `src/lib/`**: titolo automatico, RPE, codifica colore.
    - **37 su due componenti di pagina** (`HyroxBlock` e `RunningStepRow` di
      `CreateWorkout.jsx`), che fissano il **contratto padre-figlio** — è quello che il
      refactor di memoizzazione (BACKLOG #15) deve cambiare, quindi serviva pinnarlo prima.
      ⚠️ I due contratti sono **asimmetrici e devono restarlo**: `HyroxBlock` chiama
      `onMoveUp()` senza argomenti e riceve `onRemove` diretto; `RunningStepRow` chiama
      `onMoveUp(index)`, `onRemove(step.id)`, `onDuplicate(step)`, `onEdit(step)`.
      "Uniformare" i due componenti romperebbe il riordino delle fasi di corsa.
    - **20 sulla coda offline** (`src/lib/offlineQueue.js`, estratta da `Home.jsx` il
      25/08): deduplica per allenamento, tolleranza ai valori corrotti, quota piena,
      localStorage negato da Safari in navigazione privata.
    - **5 su `CreateWorkout` montato per intero** (26/08), che coprono la memoizzazione
      dal lato del *chiamante*: sono gli unici che si accorgono se qualcuno rimette
      un'arrow inline al call site. Vedi §9-quinquies.
    - **8 su `Home` montata per intero** (26/08): il percorso offline completo —
      completare e scompletare un workout senza rete, l'RPE dentro `notes`, la cache
      che si ripara, la modale RPE che non resta bloccata. Vedi §9-sexies.
    - **30 sul timer guidato** (`src/lib/timerSequence.js`, estratto da `WorkoutDetail`
      il 26/08): espansione dei round, rotazione degli esercizi, `nextTask`, e la
      migrazione del formato legacy che §5 vieta di rimuovere. Scriverli ha fatto
      emergere il difetto delle distanze (BACKLOG #29).
    - Restano scoperte **le pagine intere**: non si montano senza finti `supabase`,
      `react-router` e AuthContext (BACKLOG #19). Anche `processOfflineQueue` resta
      dentro Home e non è coperto: il ciclo di retry vuole un finto `supabase`.
    Nessun TypeScript effettivo nel `src/` (tutto `.jsx`) anche se il build esegue `tsc -b`.
12. 🔴 **ESLint non ha mai analizzato il codice dell'applicazione** (scoperto il 25/08/2026).
    `eslint.config.js` aveva `files: ['**/*.{ts,tsx}']`, ma `src/` è tutto `.jsx`: i "15 problemi"
    che `npm run lint` riportava erano **solo** nelle due Edge Function, gli unici `.ts` del
    progetto. 13.000 righe di applicazione non erano mai state controllate.
    Estendendo il pattern a `.js/.jsx` sono emersi **quattro `no-undef`**, cioè quattro
    `ReferenceError` latenti già in produzione, ognuno dei quali rompeva una funzione in silenzio
    (vedi il commit del 25/08). Sono stati corretti.
    ⚠️ Vanno tenute le esclusioni: `ios/App/App/public` è la copia del bundle **minificato** che
    `npx cap sync ios` deposita nel progetto Xcode, e analizzarla produceva 4.600 falsi problemi
    che nascondevano quelli veri.
    ⚠️ Va tenuta anche l'esclusione di `.agents`, aggiunta il 25/08: le skill vendorizzate
    portavano 5 problemi che non sono codice del progetto.
    ✅ **Scesi da 164 a 47 il 25/08/2026.** Tutti i 34 `no-empty` sono chiusi, e con loro sono
    spariti 34 binding `catch (e)` mai letti. Non era solo pulizia: ~19 erano davvero
    deliberati (aptica, wake lock, beep, `stopRecording` durante un annullamento) e ora lo
    **dicono** in un commento, ma tre nascondevano guasti reali, elencati al §9-quater.
    I 47 rimasti sono 28 `react-hooks` (un refactor, non una pulizia), 15 `no-explicit-any`
    nelle due Edge Function e 4 `react-refresh/only-export-components`.

---

## 9-quater. I tre guasti che i catch vuoti nascondevano (corretti il 25/08/2026)

Erano tutti `catch {}` senza corpo, quindi invisibili sia all'utente sia nei log.

1. **Cache e coda offline corrotte non si riparavano più.** `Home.jsx` faceva
   `try { JSON.parse(cached) } catch {}` sulla cache dei workout e
   `catch (e) { return }` su `fleofit_offline_queue`. Un valore illeggibile in
   localStorage restava lì per sempre: la modalità offline non ripartiva e le azioni
   accodate **non venivano più sincronizzate**, a ogni tentativo, senza un solo indizio.
   Ora il valore corrotto viene rimosso e l'evento loggato.
2. **La nota vocale poteva sparire senza dirlo.** In `stopRecordingAndSave`, se
   `NativeVoiceRecorder.stopRecording()` falliva, non veniva chiamato né `onSave` né
   `onCancel`: la registrazione era persa e la modale restava ad aspettare un callback
   che non sarebbe mai arrivato. Stessa cosa all'avvio su web (`new MediaRecorder`):
   l'utente premeva registra e non succedeva niente, senza messaggio. Corretto nelle tre
   copie (Home, WorkoutDetail, AthleteDetail — §9 punto 1: sono ancora duplicate).
3. **`FCM.getToken()` poteva fallire in silenzio** (`Settings.jsx`). Il codice ripiega sul
   token APNs grezzo, che però viene salvato con `auth: 'capacitor_ios'` e quindi trattato da
   `send-reminders` come se fosse FCM: **la push non arriva mai**. È lo stesso sintomo
   descritto nella sezione sulle push in Debug, ma con una causa diversa. Ora si vede nei log.

Loggate anche, senza cambiare comportamento, le scritture di `badge_count` su
`push_subscriptions` (5 punti fra Home e WorkoutDetail): se falliscono, il contatore che
`send-reminders` rilegge per incrementare il badge resta disallineato per sempre.

### 4. La modale RPE poteva restare bloccata a girare (corretto il 25/08/2026)
Trovato cercando gli altri chiamanti della coda. `handleRpeSubmitHome` e
`annullaCompletamento` facevano `JSON.parse(localStorage.getItem(...) || '[]')` **nudo**,
senza try/catch e senza `finally`. Con la cache corrotta l'eccezione partiva **dopo**
`setSavingRpe(true)` e **prima** di `setSavingRpe(false)`: la modale restava a girare per
sempre e il completamento con RPE appena inserito spariva. Sul ramo offline, cioè proprio
quando l'atleta non ha modo di capire cos'è successo.

**La regola che ne è uscita**, ora implementata in `src/lib/offlineQueue.js` e coperta da
20 test: *una lettura di localStorage che fallisce si ripara da sola*. `leggiJson` non
lancia mai, rimuove il valore illeggibile e torna un fallback; `scriviJson` torna `false`
invece di lanciare su quota piena. Meglio ripartire da zero che restare bloccati per sempre
su un valore rotto.

---

## 9-sexies. Come si testa una pagina (26/08/2026)

Per un anno "le pagine non si possono testare" è stata una convinzione, non un fatto.
Quando finalmente ci si è provati, gli ostacoli erano **due righe di infrastruttura**:

1. **jsdom espone un `localStorage` rotto** in questa versione di Node
   (`getItem is not a function`, è l'origine del warning `--localstorage-file`). Ogni
   pagina lo legge in un effetto, quindi nessuna si montava. Rimpiazzato con uno in
   memoria in `src/test/setup.js`.
2. **`registerPlugin` mancava** nel finto `@capacitor/core`: ogni plugin lo invoca al
   caricamento del modulo, quindi bastava importarne uno per far fallire tutto.

Gli strumenti che ne sono usciti, riutilizzabili per le pagine che mancano:
- `src/test/fintoSupabase.js` — riproduce la catena fluente con un **Proxy**: qualunque
  metodo torna la catena, e la catena è *thenable*, così `await` funziona ovunque la si
  chiuda (`.limit()`, `.single()`, `await` diretto). Non serve conoscere l'API.
  `risposte` e `erroreSu` accettano **funzioni**, valutate a ogni query: è l'unico modo
  di far fallire il fetch a metà test.
- `src/test/montaPagina.jsx` — router e **AuthContext veri**, non finti.

> 🔴 **La lezione più importante, e vale per qualunque test futuro.**
> I primi test su `Home` **passavano tutti, e non coprivano niente**: verificato per
> mutazione, due dei più importanti non si accorgevano del bug che dicevano di
> proteggere. Il motivo era nella preparazione dello scenario — se il fetch RIESCE,
> `scriviJson` sovrascrive subito la cache corrotta con dati validi, quindi al momento
> del clic il valore illeggibile non esiste più. Il test esercitava un percorso pulito
> credendo di esercitarne uno rotto.
> **Un test verde non dice niente finché non lo si è visto fallire.**

---

## 9-quinquies. Memoizzazione di HyroxBlock (26/08/2026) — come non disfarla

`HyroxBlock` è avvolto in `React.memo`. Il guadagno misurato: digitare 8 caratteri nel titolo
faceva **8 render sprecati per ogni blocco**, e ogni blocco aperto contiene scroll picker da
102 opzioni. Ora sono zero.

`memo` confronta le props **per riferimento**, quindi il beneficio sparisce in silenzio se il
padre torna a passare qualcosa di instabile. Le regole che lo tengono in piedi:

1. **I gestori del call site devono restare riferimenti stabili** (`bloccoToggle`,
   `bloccoUpdate`, `bloccoRemove`, `bloccoMoveUp`, `bloccoMoveDown`, `bloccoDuplicate`,
   `bloccoDuplicaEsercizio`, `bloccoDragStart`, `bloccoDragEnter`, `bloccoDragEnd`).
   Nessuna arrow inline dentro `<HyroxBlock .../>`.
2. **Nessun `useCallback` deve dipendere da `blocks`.** Con `[blocks]` l'identità cambia
   appena si modifica un blocco, e si ridisegnano tutti. Si lavora per `block.id` dentro un
   aggiornamento funzionale `setBlocks(prev => ...)`.
3. **`draggedBlockIdx` è un `useRef`, non uno stato.** Non è mai letto durante il render, e
   come stato entrerebbe nelle dipendenze dei gestori del drag.
4. ⚠️ **Il decimo gestore che nessuno conta**: `onReorder` passato a `useTouchDrag`.
   `getTouchHandlers` è memoizzato su di lui, quindi un'arrow inline lì rende instabile la
   prop `touchHandlers` e annulla tutto. Sta in `riordinaBlocchi`.

⚠️ **Il contratto è cambiato**: `onToggle`, `onRemove`, `onMoveUp`, `onMoveDown` e
`onDuplicate` ricevono `block.id`; `onDuplicateExerciseRequest` riceve `(block.id, esercizio)`.
Fa eccezione `onUpdate`, che riceve il blocco intero perché l'id è già dentro.
**Resta asimmetrico rispetto a `RunningStepRow`, che passa l'INDICE**: uniformarli romperebbe
il riordino delle fasi di corsa (§9 punto 11).

I test che se ne accorgono sono **due file diversi, e servono entrambi**:
- `HyroxBlockMemo.test.jsx` — prende la rimozione di `memo` dal figlio.
- `CreateWorkoutMemo.test.jsx` — monta `CreateWorkout` **vero** e prende le regressioni del
  *chiamante*. Verificato il 26/08: con un padre finto quelle mutazioni **non venivano rilevate**.

### `RunningStepRow` — stesso trattamento, contratto invariato
Memoizzato lo stesso giorno. Guadagno misurato: 7 caratteri nel titolo = 7 render sprecati per
fase, ora 0. Valgono le stesse quattro regole, con `riordinaFasi` al posto di `riordinaBlocchi`
e `draggedStepIdx` come ref.

⚠️ **Qui il contratto NON è cambiato**, e la differenza è istruttiva: `RunningStepRow` passava
già l'indice a `onMoveUp`/`onMoveDown` e `step.id` a `onRemove`, cioè tutto ciò che serve al
padre. Bastava non richiudere i gestori su `runningSteps`. I 16 test sul contratto sono
rimasti verdi senza una riga di modifica — la prova che **l'asimmetria fra i due componenti è
voluta e va mantenuta**.

Il contatore dei render è `RunningStepRowMemo.test.jsx`, che conta l'icona `Copy`: nel flusso
Running è renderizzata solo da `RunningStepRow`. Ogni componente ha bisogno di un contatore
interno diverso — un componente-spia esterno non funziona (non è memoizzato, quindi conta
anche i render che il figlio ha saltato).

> ℹ️ Una mutazione non viene rilevata di proposito: togliere il controllo di bordo da
> `faseMoveUp`. Non è un buco nei test — **`moveElement` ignora già gli indici fuori
> intervallo**, quindi quel controllo era ridondante ed è stato rimosso.

---

## 9-ter. App Store — rifiuto del 1.1.0 (2) e ri-sottomissione del 1.1.0 (3)

### Cronologia
- **22 mag 2026** — caricata `1.1.0 (2)`. **Respinta** con **2.3.1(a) Hidden features** e
  **3.2.1(viii) Financial Services**.
- **24 ago 2026** — correzioni applicate nel commit `fc81404`, caricata `1.1.0 (3)`.
- **26 ago 2026** — ✅ **la causa del rifiuto è chiusa e verificata dai due lati.**
  Punti 1 e 2 sul binario spedito (`tools/verifica-ipa.sh`), punto 3 provato dall'app:
  `demo@fleofit.it` **assegna un workout**. Era esattamente ciò che a maggio non
  funzionava, e che nessuno aveva provato.

> ℹ️ **Il build number del `pbxproj` NON è quello spedito, ed è normale.** Con
> `method: app-store-connect`, `manageAppVersionAndBuildNumber` vale YES per impostazione
> predefinita: Xcode alza da solo il numero oltre l'ultimo presente su App Store Connect.
> Misurato il 26/08/2026 sullo stesso archivio: `pbxproj` = 3, archivio = **2**, ipa esportato
> = **4**. È la spiegazione dell'incremento "misterioso" del 24/08, che questo documento
> attribuiva a una svista. Non serve riallineare il pbxproj a mano.

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
> tutti i permessi del mondo sul DB ed essere comunque `isAdmin = false`. E vale anche il
> contrario: può essere `isAdmin = true` nel bundle e non poter fare niente, perché le policy
> RLS hanno una **terza** lista di admin (§4-bis). Servono tutti e tre gli allineamenti.
>
> ✅ **Verificati tutti e tre il 26/08/2026**, e non per lettura ma per prova:
> `src/App.jsx` e `_shared/admin.ts` hanno le stesse 5 email; `pg_policies` sul database vivo
> coincide riga per riga con `supabase/schema/`; le 5 email sono nell'`.ipa` esportato; e
> `demo@fleofit.it` **ha davvero assegnato un workout dall'app**.
> È il primo giro in cui il percorso del revisore è stato percorso invece che dedotto.

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

✅ **Stato al 26/08/2026** (query in `tools/verifica-revisore.sql`): l'account esiste, ha l'email
confermata e la riga `athletes`; la dashboard coach non è vuota (12 atleti, 171 workout, 180
assegnazioni).
⚠️ **Aperto**: `codici_attivi = 0`. La registrazione è chiusa per scelta, ma con zero codici un
revisore che provasse a registrarsi come atleta verrebbe espulso senza spiegazione. Generarne uno
da Impostazioni → Codici invito.
⚠️ Nota sulle verifiche: `athlete_workouts` **non ha `created_at`** e `id` è un UUID casuale,
quindi non esiste modo di ordinarla per "più recente". Per controllare che un'assegnazione sia
arrivata: contare le righe prima e dopo, oppure cercare per atleta e `completed_date`.

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
