# CLAUDE.md — Memoria globale progetto FLEOFIT · app iOS + Android

> Documento di memoria persistente per Claude. Leggere **sempre** questo file prima di
> toccare il codice o proporre modifiche grafiche.
> Ultimo aggiornamento: **9 ottobre 2026**.

> 📚 **Dal 07/10/2026 questo file tiene solo ciò che serve in OGNI sessione.** La storia —
> perché ogni schermata è fatta così, le trappole trovate, i rifiuti di App Store, le
> misure — sta in **`docs/memoria/`**, un file per argomento, spostata parola per parola.
> **Prima di toccare una parte, si legge il suo file**: l'indice è al §11, ed è legato ai
> nomi dei file del codice. Non è facoltativo: lì dentro ci sono gli errori già fatti.
>
> ✍️ **Le note nuove vanno nel file dell'argomento, MAI qui.** Qui si scrive solo quando
> cambia una regola che vale ovunque (§0, §9). Senza questa regola il file torna a 400 KB
> in due mesi: era a 436 KB, cioè oltre centomila unità di contesto lette a ogni avvio.

### Stato, in dieci righe
- **Due prodotti**: `main` = web app in produzione (Vercel) · `app` = app native iOS **e**
  Android sullo stesso codice React, cartella `C:\Users\FEDE\Desktop\FLEOFIT`
  (§1.1). L'ultimo commit si legge con `git log -1`, **mai scritto qui** (è stato sbagliato
  tre volte).
- **Schema del database congelato** (§0, regola 0-bis): l'approvazione è arrivata, ma lo
  sblocco resta una decisione del committente. **Un'eccezione**, il 09/10/2026: la tabella
  `note_estratte` («Dalle note», `docs/memoria/scheda-atleta.md`).
- **App Store**: ✅ **APPROVATA il 29/09/2026** — build `1.1.0 (6)`, commit `8d9a398` del
  21/09/2026. Tutto ciò che è venuto dopo quel commit **non è nell'app sullo Store**: le
  modifiche da annunciare nel prossimo aggiornamento stanno in [DEVLOG.md](DEVLOG.md)
  (`docs/memoria/app-store.md`).
- **Android**: funziona sull'emulatore; restano tastiera, push con app chiusa, icona delle
  notifiche e tutta la pubblicazione sul Play Store (`docs/memoria/android.md` §A.4).
- Test e lint al 09/10/2026: `npm test` → **1521 test**; `npx eslint src` → **27 problemi** (nessuno nei file di «Dalle note») (il lint del progetto intero oggi si ferma su una cartella di build Android senza permessi; l'ultimo conteggio completo era 42).
- Le cose da fare stanno in **[BACKLOG.md](BACKLOG.md)**.

---

## 0. Regole operative per Claude

> 📋 **Le cose da fare stanno in [BACKLOG.md](BACKLOG.md)**, non qui. Questo file spiega
> *com'è fatto* il progetto; il backlog elenca *cosa manca*, con il perché di ognuna e
> cosa la blocca. Aggiornare il backlog quando una voce si chiude.

0. **Esistono DUE branch vivi con due destinazioni diverse** (`main` = web app in produzione,
   `app` = app native iOS **e** Android). Prima di proporre un merge, un deploy o una modifica
   condivisa (DB, Edge Function), leggere il §1.1: non sono intercambiabili.
   ⚠️ Su `app` una modifica al codice React vale per **due piattaforme**: chi tocca qualcosa di
   nativo (un plugin, un permesso, un gesto di sistema) deve sapere su quale esiste, e provarlo
   su quella (§A.2 per Android). Un plugin che su una piattaforma non c'è va chiamato con un
   `.catch`, o si porta via il codice che lo segue (§A.3 punto 7).
0-bis. 🔒 **LO SCHEMA DEL DATABASE È CONGELATO** fino all'approvazione su App Store (decisione del
   committente, 24/08/2026). ⚠️ L'app è stata **approvata il 29/09/2026**, ma PRODUCT.md lega lo
   sblocco anche al passaggio definitivo alla sola app: **il congelamento resta finché il
   committente non dice esplicitamente che è tolto**. Niente migrazioni, niente tabelle nuove, nessuna modifica alle policy
   RLS: l'unico database serve anche la web app in produzione e non c'è staging. **Le letture sono
   permesse** (verifica policy, conteggi, export). Se una funzione richiede una migrazione, va
   proposta e messa in attesa, non implementata. Vedi PRODUCT.md → Capabilities and Constraints.
   ✅ **Unica eccezione autorizzata finora** (09/10/2026, sì esplicito in sessione): la tabella
   `note_estratte`, migrazione **additiva** applicata a mano dal SQL editor
   (`supabase/schema/note_estratte_2026-10-09.sql`). Non è uno sblocco generale: **ogni
   migrazione successiva richiede un nuovo sì esplicito**.
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
6. Prima di modificare un file grande (`WorkoutDetail.jsx` 2.938 righe, `AthleteDetail.jsx` 2.553,
   `CreateWorkout.jsx` 2.348, `Home.jsx` 2.010 — contate il 26/08/2026) leggere le sezioni
   rilevanti: c'è molta logica duplicata tra i file (vedi `docs/memoria/qualita-e-test.md`, §9 Debito tecnico).
   > I primi tre si sono alleggeriti fra il 25 e il 26/08 estraendo la logica pura in
   > `src/lib/` (`offlineQueue`, `timerSequence`, `statistiche`, `badge`): è la direzione,
   > non un'eccezione. `CreateWorkout` invece è **cresciuto**, per i `useCallback` che la
   > memoizzazione richiede (§9-quinquies).

---

## 1. Cos'è il progetto

**FLEOFIT** è l'app di coaching personale di **Federico Leo**, specializzata su **Hyrox** e
**Running**. Serve a seguire gli atleti passo per passo: il coach crea e assegna workout, l'atleta
li esegue con un timer guidato, li segna come completati con RPE e note, e il coach vede tutto in
tempo reale.

- **Repo**: `https://github.com/coaching-fleo/fleofit`
- **Cartella locale**: `C:\Users\FEDE\Desktop\FLEOFIT` (Windows, Android) — ⚠️ mai su un
  disco di rete: fino all'08/10/2026 stava su `Z:`, e lì la suite di test non partiva
  (worker in timeout dopo 10 minuti; in locale gira in poco più di un minuto) —
  sul Mac la copia per Xcode
- **App bundle iOS**: `it.federicoleo.fleofit` — display name `FLEOFIT`
- **Deploy web**: Vercel (`https://fleofit.vercel.app`), SPA rewrite in `vercel.json`
- **Deep link scheme**: `fleofit://` (usato per OAuth callback e reset password su iOS)

---

## 1.1 I branch — LEGGERE PRIMA DI TOCCARE main

| Branch | Cos'è | Dove finisce |
|---|---|---|
| **`main`** (default) | **Web app in produzione**, quella che gli atleti usano oggi | collegato a **Vercel** → `https://fleofit.vercel.app`. LIVE, non rompere |
| **`app`** | Le app native **iOS e Android** (§A) | collegato a **niente**: un push è un backup, non un rilascio. Le app arrivano agli Store da Xcode e da Gradle |
| ~~`ios-version`~~ · ~~`android-version`~~ | superati dal 02/10/2026: storia, non ci si lavora più | — |

- 🔴 **`git fetch` prima di qualunque affermazione sui due branch**, e prima di dire che
  qualcosa «manca su main» verificarlo con `git show origin/main:<file>`. Questo documento
  ha già sbagliato due volte su questo punto.
- **Sono divergenti ed entrambi si muovono**, e hanno toccato gli stessi file grandi: un
  merge è un merge vero, con conflitti reali.
- 🔴 **Database ed Edge Function sono CONDIVISI** da web, iOS e Android, senza staging: una
  migrazione o un deploy di `send-reminders` colpiscono subito la web app in produzione.
- **Un fix che serve alla web app va portato su `main`**: metterlo su `app` non basta.
- **I cron di GitHub girano solo dal branch di default** (`main`): un workflow corretto su
  `app` è un file inerte.
- ⚠️ **`main` non conosce l'RPE**: il prefisso `[RPE: n/10]` in `athlete_workouts.notes` lì
  appare come testo, e se l'atleta riscrive la nota dalla web app l'RPE si perde.

Tutto il resto — cosa c'è solo su `app`, la storia della divergenza, Vercel — in
`docs/memoria/branch.md`.

---

## A. ANDROID — leggere prima di toccare qualcosa di nativo

- **Costruire**: `npm run android` (build + `npx cap sync android`), poi
  `cd android && ./gradlew installDebug`. 🔴 `npm run build` **non basta**: Gradle
  impacchetta la copia in `android/app/src/main/assets/public`, e senza sync l'app
  installata ha il codice della volta prima. JDK e variabili: `docs/memoria/android.md` §A.1.
- **Le differenze fra piattaforme stanno nel codice**, dietro `Capacitor.getPlatform()`,
  mai in due copie dello stesso file.
- 🔴 **Un plugin che su una piattaforma non c'è va chiamato con un `.catch`**, o si porta via
  il codice che lo segue (è successo con `Keyboard.setAccessoryBarVisible`).
- **Tasto indietro di sistema**: `src/lib/indietroAndroid.js`. Una modale nuova si chiude
  col tasto indietro **solo** se ha una X con `aria-label="Chiudi"` o un bottone che dice
  esattamente «Annulla», «Chiudi», «Indietro» o «No».
- **Galleria**: sempre `salvaInGalleria` di `src/lib/galleria.js`, mai `Media.savePhoto`.
- **Permessi** (microfono, notifiche, deep link `fleofit://`) stanno in
  `android/app/src/main/AndroidManifest.xml`.
- **Icone e splash**: `python tools/icone-android.py`, **mai** `npx capacitor-assets generate`.
- ⚠️ Una correzione al codice condiviso che tocca anche iOS va **riprovata sul simulatore**.

Come si verifica senza telefono (vibrazione, microfono, console, tasto indietro) e le dieci
differenze da iOS una per una: `docs/memoria/android.md`.

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
| Mobile | **Capacitor 8.5.2** → target **iOS** (`ios/App`) **e Android** (`android/`, Gradle, `minSdk 24`/`targetSdk 36`, §A). ⚠️ Ciclo di vita a **UIScene** dal 21/09/2026 (§9-sextricies) |
| Export | `jspdf` (PDF scheda), `html-to-image` (`toPng`/`toBlob`) per la story Instagram |
| Superficie IA | `thinking-orbs` — l'orb dell'attesa (§9-untricies) · `border-beam` — il fascio su card e foglio (§9-duetricies). ⚠️ Entrambe MIT e senza dipendenze, ed **entrambe si importano solo da `CreateWorkout.jsx`**: mai da un file condiviso |
| Push | FCM (iOS nativo, via `@capacitor-community/fcm` + Firebase Admin lato Edge Function) + Web Push VAPID (browser) |
| IA | Google **Gemini 2.5 Flash** (generazione workout + trascrizione audio) · **Groq** (`openai/gpt-oss-120b`): riserva di `ai-workout`, prima scelta di `ricerca-coach`, **unica** IA di `estrai-note` (le note degli atleti non vanno a Gemini gratuito, che può usarle) |

### Plugin Capacitor in uso
`@capacitor/app`, `browser`, `filesystem`, `haptics`, `keyboard`, `network`,
`push-notifications`, `screen-orientation`, `share`, `status-bar`,
`keep-awake` (TV), `media` (salva in galleria),
`apple-sign-in` (Sign in with Apple, §9-sexvicies),
`fcm`, `@capawesome/capacitor-badge` (badge icona),
`@independo/capacitor-voice-recorder` (note vocali **e** dettatura IA — una sola libreria audio
dal 23/09/2026, §9 punto 4).

### Comandi
```bash
npm run dev      # vite --host (porta 5173, host 0.0.0.0)
npm run build    # tsc -b && vite build
npm run lint     # eslint .
npm test         # vitest run
npm run demo     # AMBIENTE DI PROVA: l'app su dati finti in memoria (§9-quinvicies)
npm run demo:atleta  # lo stesso, ma la sessione È un atleta finto — l'unico modo di
                 #   vedere il LATO ATLETA con dei dati dentro (§9-quinvicies).
                 #   DEMO_ATLETA=at-sofia npm run demo:atleta per cambiarlo
npm run ios      # build + cap sync — USARE QUESTO prima di compilare da Xcode
npm run android  # build + cap sync android — prima di ogni installazione Android (§A.1)
npx cap sync ios # solo la sincronizzazione, se il build è già fatto
```

> 🔴 **`npm run build` NON basta per vedere una modifica in Xcode.**
> Xcode compila `ios/App/App/public`, che è una **copia** del bundle depositata da
> `npx cap sync ios`. Senza sync, Xcode costruisce con il codice della sincronizzazione
> precedente e la modifica sembra non aver funzionato.
> Successo il 26/08/2026: la copia in Xcode era ferma al giorno prima, e una funzione
> appena rimossa continuava a comparire nell'app. Non è un passo solo pre-archive:
> serve **a ogni** compilazione da Xcode. Per questo esiste `npm run ios`.
>
> ⚠️ Il build stampa anche il peso dei chunk: `CreateWorkout` sta a **178 KB**
> (erano 76 fino al 15/09: **+15** di `thinking-orbs`, che porta tutti e nove i
> modi anche usandone due — §9-untricies — **+64** di `border-beam`,
> §9-duetricies, e **+22** del righello il 07/10, §9-sexquadragies).
> `CreaWorkoutUI` deve restare intorno ai **18 KB** (24 fino al 07/10, quando ne
> sono usciti Stepper e ruota del passo): è un chunk
> **condiviso con `WorkoutDetail`**, e una libreria di effetti importata lì
> dentro la fa scaricare a ogni apertura di una scheda. E `WorkoutDetail` deve
> restare intorno ai **79 KB** — 83 fino al 22/09, quando il chunk del recap si è
> portato via un po' di logica condivisa (erano 68 fino al 01/09, poi 82 con `StoriaUI` + `recapStoria`
> §9-unetvicies, e 84 dal 02/09 con `previsione` + `PrevisioneUI` §9-quatervicies). Se risale sopra i 400, qualcuno ha rimesso `jspdf` o `html-to-image`
> fra gli import in testa (§9-noviesdecies).
>
> ⚠️ E `index` deve restare intorno ai **594 KB**: è il chunk d'ingresso, quello
> che gatekeepa il primo fotogramma. Se sale di colpo di qualche decina di KB,
> qualcuno ha importato in modo NON pigro un pezzo montato da più pagine — è
> esattamente quello che il recap avrebbe fatto (§9-quadragies punto 6).
>
> Come si verifica se la copia è vecchia:
> ```bash
> diff -q dist/assets/index-*.js ios/App/App/public/assets/index-*.js
> ```

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

> Versione corta. Quella con la nota su ogni file: `docs/memoria/struttura.md`.

```
vite.config.ts · vitest.config.js   # ⚠️ MAI creare un vite.config.js (§9)
src/
├─ main.jsx · index.css             # @theme con i token, animazioni globali
├─ App.jsx                          # routing, AuthContext, ProtectedRoute (route di LAYOUT),
│                                   #   DeeplinkHandler, ⚠️ ADMIN_EMAILS
├─ supabaseClient.js                # ⚠️ con VITE_DEMO usa supabaseDemo.js + demoSemi.js
├─ use*.js                          # hook: useTouchDrag, useTastiera, useBottomSheet,
│                                   #   useIndietro, useNumeroCheSale, useRipresa
├─ lib/                             # logica PURA, coperta da test: statistiche, stimaWorkout,
│                                   #   previsione, rpe, gradimento, pausa, offlineQueue, badge,
│                                   #   aptica, colori, stiliCard, riga*.js, report*, recap*,
│                                   #   codiceWorkout, galleria, indietroAndroid, …
├─ components/                      # *UI.jsx = sola presentazione di una schermata;
│                                   #   CustomModals, Navbar, Apertura, AudioVisualizer, Recap*
├─ pages/                           # Home, Login, Calendar, CreateWorkout, WorkoutDetail,
│                                   #   Athletes, AthleteDetail, WorkoutsArchive, WeeklyReport,
│                                   #   AthleteReport, Settings, TVDashboard
└─ test/                            # setup.js, fintoSupabase.js, montaPagina.jsx
tools/                              # icone-android.py, verifica-ipa.sh, verifica-revisore.sql,
                                    #   prova-estrai-note/ (istruzioni IA su note INVENTATE, prima del deploy)
ios/ · android/                     # progetti nativi: a mano solo Info.plist, entitlements,
                                    #   AndroidManifest.xml, styles.xml
supabase/functions/                 # send-reminders, ai-workout, ricerca-coach, estrai-note,
                                    #   segnalazione, _shared/admin.ts + groq.ts
supabase/schema/                    # fotografia delle policy RLS — NON una migrazione
docs/memoria/                       # la storia, un file per argomento (§11)
```

---

## 4. Modello dati (Supabase) — l'essenziale

> Policy RLS, cron, backup, bucket, Edge Function e push in dettaglio:
> `docs/memoria/database.md`. **Leggerlo prima di toccare uno di questi.**

Progetto `riyqtcssllupakjtoehj`: **uno solo**, condiviso da web, iOS e Android, nessuno
staging, **schema congelato** (§0, 0-bis).

| Tabella | Da sapere |
|---|---|
| `athletes` | `id` = `auth.users.id`. Soft delete con `deleted_at` (**bigint in ms**). `notes` è la nota del coach **per** l'atleta (l'atleta la vede, ed è voluto) e porta il marcatore `[PAUSA: yyyy-MM-dd]`: si legge e scrive **solo** con `src/lib/pausa.js` |
| `workouts` | `title` (mai vuoto, con il codice in coda), `date`, `sections` jsonb (§5), `coach_notes` |
| `athlete_workouts` | qui sta lo **stato** (`status`, `completed_date`). `notes` porta `[RPE: n/10]` e `[GRADIMENTO: …]`: solo con `src/lib/rpe.js` e `gradimento.js`. `voice_note_url` si cancella con `#deleted=`. **Nessun `created_at`** |
| `note_estratte` | ✅ **applicata il 09/10/2026**: i dati ricavati dalle note degli atleti (standard `VERSIONE` in `estrai-note/regole.ts`). Policy **solo admin** (`USING` e `WITH CHECK`), l'atleta non la legge. La scrive solo `estrai-note`. `main` non la conosce |
| `personal_records` · `notifications` · `push_subscriptions` · `invitation_codes` · `tv_sessions` | `push_subscriptions.badge_count` è riletto da `send-reminders`: il badge si scrive solo con `sincronizzaBadge` (§8) |

- 🔴 **Gli admin sono TRE liste da tenere allineate**: `ADMIN_EMAILS` in `src/App.jsx`,
  `supabase/functions/_shared/admin.ts` e le **policy RLS** — in queste ultime sia `USING`
  sia `WITH CHECK`. Una lista disallineata è la causa del rifiuto App Store 2.3.1(a).
- 🔴 **Cancellare un atleta distrugge tutta la sua storia** (chiavi in CASCADE), col cron
  delle 00:00 UTC; il backup gira prima, alle 22:30.
- **Edge Function**: `send-reminders` (5 modalità), `ai-workout` (Gemini, riserva Groq), `ricerca-coach` (Groq, riserva Gemini: la ricerca del coach) ed `estrai-note` (**solo Groq**, con Zero Data Retention: le note degli atleti diventano dati, `docs/memoria/scheda-atleta.md`). ⚠️ Gemini gratuito = **20 richieste al giorno**, condivise da tutte le funzioni con la stessa chiave. `main` chiama solo `send-reminders`. Un deploy
  colpisce anche la web app. Più `segnalazione` (la mail «Segnala un problema» via Resend):
  la usa solo l'app, quindi pubblicarla non tocca la web app.
- Entrambi i bucket (`athlete-photos`, `voice-notes`) sono **pubblici**.

---

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
    "intensity": "8", "notes": "…",
    "intervals": "2"               // solo EMOM: stazione continua su 2 intervalli (dal 09/10/2026,
                                   //   src/lib/stazioniEmom.js, uguale su app e main)
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

> ⚠️ **Dal 05/10/2026 il titolo porta anche un CODICE in coda** e il nome è facoltativo
> per **tutte** le categorie, non più solo per Custom: §9-terquadragies. Dal 07/10/2026
> Hyrox e Corsa senza nome prendono un nome **dai blocchi, in gergo Hyrox/running**,
> scelto a caso fra quelli pertinenti e mai ripetuto (`src/lib/nomeCasuale.js`, §9-quinquadragies).

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

> ✅ **Dal 26/08/2026 i colori di marchio passano dai token.** `bg-[#f1ba17]` è diventato
> `bg-brand`, e così azzurro (`running`), magenta (`custom`) e viola (`ia`): 584 occorrenze
> ridotte a 8 righe, i token di `src/index.css` più le costanti di `src/lib/colori.js`.
> **I VALORI NON SONO CAMBIATI** — la regola 3 vale sempre.
>
> Perché due elenchi e non uno: classi Tailwind e valori JS vivono in due mondi, e dove il
> colore finisce in un canvas, in un SVG o in uno `style` inline rasterizzato da
> html-to-image, una variabile CSS non viene risolta. `src/lib/__tests__/colori.test.js`
> verifica che i due elenchi coincidano — è l'unica ragione per cui averne due è accettabile.
>
> ⚠️ I grigi delle superfici sono ancora valori arbitrari (~870 occorrenze). Non è una
> dimenticanza: in un rebranding non cambiano (BACKLOG #18-bis).
>
> 🔴 **Trappola trovata il 26/08**: Tailwind cerca le classi in TUTTO il progetto, file `.md`
> compresi. `CLAUDE.md` e `DESIGN.md` contengono `bg-[#f1ba17]` come esempi, e Tailwind ci
> generava sopra regole vere che finivano nel CSS di produzione — tenendo in vita il vecchio
> giallo anche dopo la migrazione. Per questo `src/index.css` ora usa
> `@import "tailwindcss" source(none)` e dichiara `@source "../src"`: senza, la
> documentazione influenza il prodotto.

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
- **Bottom sheet**: `rounded-t-3xl`, maniglia grigia, **swipe-down > 100px per chiudere**.
  Il meccanismo sta in `src/useBottomSheet.js` (entrata, trascinamento, uscita, blocco dello
  scorrimento sotto) e lo usa il menu della scheda workout. ⚠️ Il centro notifiche in `Home`
  ha ancora la **propria copia**, scritta a mano: BACKLOG #33.
- **Entrata di una pagina**: **`.cascata` sul contenitore**, non `.page-transition` sulla
  radice (§9-septtricies). I figli entrano sfasati di 75ms invece che tutti insieme; i
  quattro parametri sono variabili su `:root` in `src/index.css` e valgono per tutta l'app.
  ⚠️ **Una testata `sticky` è CORNICE e non entra**; una testata che scorre via è contenuto
  e entra (`.cascata-voce`).
- `.page-transition` **resta** per le schermate fuori dalle nove del rework (login, TV):
  slide-up 15px + fade, 0.3s `cubic-bezier(0.16,1,0.3,1)`. ⚠️ Non va rimesso *insieme* a
  una cascata: la pagina che sale mentre i figli salgono è movimento doppio.
- **Scrollbar sempre nascoste** (regola globale in `index.css` + classe `.hide-scrollbar`).
- **Safe area iOS**: ogni pagina apre con `pt-[calc(env(safe-area-inset-top)+1rem)]` e
  chiude con `pb-[var(--fondo-pagina)]` (o `pb-[var(--altezza-navbar)]` dove finisce
  con una barra fissa) per non finire sotto la tab bar.
  🔴 **L'altezza della navbar si scrive in UN posto solo**: `--altezza-navbar` in
  `src/index.css`. Era `pb-16` in `App.jsx` più `pb-[calc(6rem+…)]` in cinque pagine
  più l'offset di `BarraAzioni` — **sette copie a mano**, che hanno coinciso per caso
  finché la barra è stata alta 4rem. Il 28/08, diventata la capsula galleggiante
  dell'artboard 2b (99px + safe area), sarebbero servite sette modifiche coordinate e
  la prima dimenticata avrebbe nascosto contenuto sotto la barra **senza dare errore**.
- **Tab bar**: non è una barra piena attaccata al fondo, è una **capsula galleggiante**
  (`rounded-full`, `rgba(30,30,34,.88)`, blur 22 + saturate 170%, ombra proiettata) con
  10px d'aria sopra e 16px sotto. La voce attiva prende un **cerchio** da 36px dietro la
  sola icona, non una pillola dietro icona ed etichetta (§9-quaterdecies).
- **Feedback aptico**: si passa SOLO dai sei verbi di `src/lib/aptica.js` (`battito`,
  `vibraScelta`, `vibraPresa`, `vibraSuccesso`, `vibraErrore`, `vibraRichiamo`), mai da
  `Haptics` o `navigator.vibrate` diretti — il secondo su iPhone non esiste. Dove vibrare e
  dove NO: §9-duoquadragies. Il timer guidato resta a parte (`Heavy` a fine round).
- **Testo non selezionabile** globalmente tranne input/textarea (regola inline in `App.jsx`).

---

## 8. Convenzioni da rispettare

- **Chiavi localStorage** (tutte con prefisso `fleofit_`, tranne `adminRoleOverride`):
  `fleofit_name_<uid>`, `fleofit_invite_code`, `fleofit_motivation`, `fleofit_workout_draft`,
  `fleofit_offline_queue`, `fleofit_cache_workouts_<uid>`, `fleofit_cache_w_<id>`,
  `fleofit_cache_aw_<id>_<athleteId>`, `fleofit_cache_all_aw_<id>`, `fleofit_tv_code`,
  `fleofit_ultimo_export`, `fleofit_invito_atteso`, `fleofit_segnalazione_bozza`, `adminRoleOverride`.
  ⚠️ `fleofit_ultimo_export` è una memoria **del dispositivo**, non un registro dei backup:
  dice «l'hai esportato da qui», e su un telefono nuovo semplicemente non c'è (§9-duoetvicies).
  ⚠️ `fleofit_invito_atteso` è un passaggio di consegne fra due caricamenti della pagina —
  `ProtectedRoute` lo scrive prima del `signOut()`, il passo 2 del login lo legge e lo
  **cancella subito** (§9-septvicies). Non è una preferenza: lasciarlo lì vorrebbe dire
  mostrare l'indirizzo di qualcun altro in testa alla schermata dell'invito.
- **Mai `alert()` / `confirm()` nativi** nella UI: usare `CustomAlert` / `CustomConfirm` via
  `setAlertInfo({ title, message, type: 'error'|'success' })` / `setConfirmInfo({ title, message, onConfirm })`.
  (Restano alcune `alert()` legacy in Home e CreateWorkout — quando le tocchi, convertile.)
- **Ogni modale** va renderizzata con `createPortal(…, document.body)`.
- **Parametri di `/login`**: `?invite=<codice>` (il link del coach, salta le caselle),
  `?serve=invito` (ci manda `ProtectedRoute` a chi è autenticato senza profilo) e
  `?error=unauthorized` (la vecchia uscita, che nessuno produce più — §9-septvicies).
- **Rotte**: `/`, `/login`, `/tv` (pubblica), `/calendar`, `/create`, `/athletes`, `/athletes/:id`,
  `/profile`, `/workout/:id`, `/archive`, `/report` e `/report/:id` (**solo coach**, §9-vicies e §9-vicies-bis), `/settings`. Deep link workout:
  `/workout/<workoutId>?athlete_id=<uid>` — è il formato usato anche in `notifications.route`.
- **Aggiornamenti ottimistici**: si aggiorna lo state prima della chiamata Supabase e si fa rollback
  in caso di errore (pattern in `toggleTodayWorkout`, `toggleStatus`).
- **Native check**: sempre `Capacitor.isNativePlatform()` prima di usare un plugin, con
  `.catch(() => {})` sui plugin non critici.
- **Badge iOS**: si scrive **solo** con `sincronizzaBadge()` di `src/lib/badge.js`. Aggiorna
  insieme il badge nativo e `push_subscriptions.badge_count`, che non sono equivalenti: il primo
  è cosmetico, il secondo viene **riletto da `send-reminders`** per calcolare il badge della push
  successiva, quindi se salta ogni notifica futura porta il numero sbagliato.
  In `Home` non si chiama nemmeno a mano: c'è **un solo effetto** su `unreadCount`, che a sua
  volta è **derivato** da `notifications` con `useMemo`. Chi cambia le notifiche non deve pensare
  al badge — ed è il motivo per cui non possono più divergere (erano 7 punti da allineare a mano).

---

## 9. Trappole che valgono ovunque

Ognuna è già costata almeno una volta; la storia di ciascuna è nel file indicato.

- 🔴 **`npm run build` non basta** per vedere una modifica in Xcode o sull'emulatore: serve
  `npm run ios` / `npm run android`, che sincronizzano la copia del bundle (§2, §A).
- 🔴 **Mai creare un `vite.config.js`**: Vite lo preferisce al `.ts` e lo maschera in silenzio.
- 🔴 **`animate-in`, `fade-in`, `zoom-in`, `slide-in-from-*` generano ZERO CSS**:
  tw-animate-css non è installato. Le entrate vere sono i keyframe di `src/index.css`
  (`.modal-transition`, `.sheet-in`, `velo-in`, `.cascata`) — `movimento-e-aptica.md`.
- 🔴 **L'RPE si legge con `rpeDichiarato`, mai con `parseNotesAndRpe`**: il secondo torna 5
  quando il dato manca, e quel 5 diventa una media falsa.
- 🔴 **Nessuna cella mostra uno zero, e nessun numero si inventa**: al posto di un dato che
  non esiste ancora va «—», `null`, o la cosa che lo farà esistere — `home-atleta.md`.
- **localStorage solo con `leggiJson`/`scriviJson`** di `src/lib/offlineQueue.js`.
- 🔴 **Due utility Tailwind della stessa proprietà non si sovrascrivono** (bordo, raggio,
  peso del carattere): vince l'ordine nel foglio di stile. Chi vuole un bordo suo parte da
  `CARD_BASE` / `CARTA_RIGA_BASE` e lo dichiara — `calendario.md`.
- **La settimana comincia di LUNEDÌ** (`weekStartsOn: 1`), ovunque.
- 🔴 **Mai `jspdf`, `html-to-image` o una libreria di effetti in testa a un file condiviso**:
  finiscono nel chunk di chi passa di lì. I pesi da tenere d'occhio sono al §2.
- **html-to-image clona un nodo VERO**: per nasconderlo si porta fuori schermo, mai
  `display:none` (l'immagine esce vuota senza errori).
- **Un plugin nativo che risponde `{"value":true}` non dice che ha funzionato** (note
  vocali da 557 byte per due mesi) — `database.md`.
- **Aptica solo dai sei verbi di `src/lib/aptica.js`**; `navigator.vibrate` su iPhone non esiste.
- **Durata dei blocchi: uno stimatore solo** (`durataBlocco` di `stimaWorkout.js`) —
  `carico-e-durata.md`.
- **Il titolo del workout porta un codice in coda**: si separa con `separaCodice` —
  `crea-workout.md`.
- 🔴 **Un test verde non dice niente finché non lo si è visto fallire**: ogni test nuovo si
  verifica rompendo apposta il codice che copre — `qualita-e-test.md`.

### Controlli obbligatori prima di ogni archive per App Store
Il primo è quello mancato a maggio; storia e motivi in `docs/memoria/app-store.md`.
```bash
grep -l "demo@fleofit.it" dist/assets/*.js                                  # DEVE stampare un file
grep -l "AMBIENTE DI PROVA\|at-sara\|fleofit_demo_db" ios/App/App/public/assets/*.js   # NON deve stampare niente
grep -rl "Apple Health\|NSHealth\|capacitor-health\|developer.healthkit" ios/App/App/public/assets/ ios/App/App/*.plist ios/App/App/App.entitlements ios/App/CapApp-SPM/Package.swift   # NON deve stampare niente
```
Poi `tools/verifica-ipa.sh` sull'`.ipa` esportato.

---

## 10. Idee/direzioni note per il futuro

- Possibile **rebranding** (nome diverso da FLEOFIT) mantenendo la palette.
- Modifiche grafiche/UI attese, palette invariata.
- Integrazione **Strava/Garmin** via `cloud-sync` già predisposta lato client (`CloudSyncService`).
- Ruolo `coach` separato da `admin`, già abbozzato ma disattivato.

---

## 11. Dove leggere prima di toccare cosa

> I rimandi «§9-…» nei file portano il nome della sezione originale:
> `grep -rn '^## 9-<nome>' docs/memoria` dice in quale file sta.

| Prima di toccare… | Leggi `docs/memoria/…` |
|---|---|
| `Home.jsx` (ramo atleta), `HomeAtletaUI`, `HomeAtletaVuotiUI`, `statistiche.js` | `home-atleta.md` |
| `Home.jsx` (ramo coach), `HomeCoachUI`, `statisticheCoach.js`, `pausa.js` | `home-coach.md` |
| `CreateWorkout.jsx`, `CreaWorkoutUI`, `HyroxBlock`, `RunningStepRow`, `Righello`, `FoglioMisure`, `scaleMisura.js`, foglio IA, `codiceWorkout.js`, `nomeCasuale.js`, `stazioniEmom.js`, salvataggio e bozza | `crea-workout.md` |
| `WorkoutDetail.jsx`, `WorkoutDetailUI`, `rigaBlocco.js`, `StoriaUI`, `recapStoria.js`, timer, PDF | `scheda-workout.md` |
| `AthleteDetail.jsx`, `SchedaAtletaUI`, `andamento.js`, `DalleNoteUI`, `dalleNote.js`, `noteEstratte.js`, Edge Function `estrai-note` | `scheda-atleta.md` |
| `WorkoutsArchive.jsx`, `ArchivioUI`, `rigaArchivio.js`, `useRipresa` | `archivio.md` |
| `Athletes.jsx`, `AtletiUI`, `rigaAtleta.js` | `atleti.md` |
| `Calendar.jsx`, `CalendarioUI`, `rigaCalendario.js` | `calendario.md` |
| `WeeklyReport.jsx`, `AthleteReport.jsx`, `report*.js` | `report.md` |
| `Settings.jsx`, `ImpostazioniUI`, `rigaImpostazioni.js`, `FoglioSegnalazione`, `segnalazione.js`, Edge Function `segnalazione` | `impostazioni.md` |
| `Login.jsx`, `LoginUI`, `codiceInvito.js`, `appleLogin.js`, `ProtectedRoute` | `accesso.md` |
| `RicercaCoach.jsx`, `ricercaCoach.js`, `dialogoRicerca.js`, `useDettatura.js`, Edge Function `ricerca-coach` | `ricerca.md` |
| `previsione.js`, `stimaWorkout.js`, ogni durata o carico | `carico-e-durata.md` |
| `Recap*.jsx`, `recapAllenamento.js`, `gradimento.js` | `recap.md` |
| animazioni, `index.css`, `Apertura.jsx`, modali, `Navbar.jsx`, `aptica.js` | `movimento-e-aptica.md` |
| policy, cron, backup, bucket, Edge Function, push, note vocali | `database.md` |
| `android/`, plugin nativi, emulatore | `android.md` |
| un archive o una risposta ad App Store, `ios/`, `Info.plist`, entitlements | `app-store.md` |
| test, lint, `src/test/`, ambiente di prova, navigazione e tasto indietro | `qualita-e-test.md` |
| merge, `main`, Vercel | `branch.md` |
| dove sta un file e a cosa serve | `struttura.md` |
| le funzionalità per sommi capi | `funzionalita.md` |
| le novità che aprivano questo file fino al 07/10/2026 | `novita.md` |
