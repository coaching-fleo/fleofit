# Da FLEOFIT a PUSHFIT — piano di rinomina

> **Per chi esegue:** sotto-skill richiesta: superpowers:subagent-driven-development (consigliata) oppure superpowers:executing-plans, un task alla volta. I passi usano le caselle (`- [ ]`).

**Obiettivo:** l'app si chiama PUSHFIT ovunque la vede una persona (icona, schermate, App Store, Play Store, sito, mail, PDF), senza perdere un utente, un dato o un aggiornamento.

**Architettura:** il nome diventa **una costante sola** (`src/lib/marchio.js`) e il logo **un componente solo** (`<Marchio />`), come è già successo con i colori (`colori.js` + il suo test). Tutto ciò che *identifica* l'app per i sistemi (bundle id, schema `fleofit://`, chiavi `fleofit_*`, account demo, progetto Supabase) **resta com'è**: cambiarlo romperebbe gli aggiornamenti e i dati degli utenti, e nessuno lo vede.

**Stack:** React 19 + Vite, Capacitor 8 (iOS + Android), Supabase, Vercel.

**Spec:** la richiesta del committente del 17/11/2026 («cambiare il nome in PUSHFIT, grafica e soprattutto App Store») + CLAUDE.md §0 punto 1 («serve un refactor coordinato, non un find&replace»).

## Global Constraints

- Nome visibile: `PUSHFIT` (maiuscolo, come oggi FLEOFIT). Logo: `PUSH` bianco + `FIT` giallo `#f1ba17` — la stessa divisione di oggi, così cambia solo la prima metà.
- **Colori invariati** (CLAUDE.md §0 punto 3).
- **Bundle id `it.federicoleo.fleofit` e `applicationId` Android invariati.** Cambiarli = un'app nuova sugli Store: gli utenti non riceverebbero più aggiornamenti.
- Si lavora su `app`; il sito cambia nome solo con `app:main`, su richiesta.
- Schema del database congelato: questo lavoro **non** richiede migrazioni.

## Decisioni da prendere PRIMA del task 1 (sono del committente)

1. **Il nome è libero?** Su App Store il nome dev'essere unico (max 30 caratteri): se «PUSHFIT» è già preso, App Store Connect lo rifiuta al salvataggio. Controllare anche Play Store e una ricerca marchi (UIBM / EUIPO) per «PUSHFIT»: esistono prodotti con nomi simili (es. raccordi idraulici «Pushfit»), da far valutare a chi si occupa di marchi.
2. ✅ **Il dominio è `pushfit.it`** (acquistato il 17/11/2026). Oggi tutto punta a `fleofit.vercel.app`. ⚠️ La 1.2.5 porta gli universal link e il dominio è scritto dentro la build: in `App.entitlements` vanno **tutti e due**, `applinks:pushfit.it` e `applinks:fleofit.vercel.app`. Prima di archiviare, `pushfit.it` dev'essere collegato a Vercel e servire già `/.well-known/apple-app-site-association`. Il link d'invito (`linkInvito.js`) e l'URL della privacy (`https://pushfit.it/privacy`) passano al dominio nuovo.
3. **La mail.** Il mittente (Resend), il contatto in policy e quello su App Store. Con il nome deciso si sblocca anche la mail dei cambi di policy, in stand-by dal 14/10 proprio per questo.
4. **Grafia sugli Store:** solo «PUSHFIT» o «PUSHFIT – Coaching Hyrox e Running» (il sottotitolo App Store è un campo a parte, 30 caratteri).

## Cosa NON si cambia, e perché

| Cosa | Perché resta |
|---|---|
| `it.federicoleo.fleofit` (iOS, Android, `capacitor.config.ts`), `.dev`, `.FleoTimer` | identità per gli Store: cambiarla = app nuova, utenti persi |
| `demo@fleofit.it` e le mail di prova | è l'account del revisore Apple; è un indirizzo, non un nome mostrato |
| nome del target `FleoTimer`, cartella, repo, progetto Supabase | interni, nessuno li vede |

---

### Task 1: il nome e il logo in un posto solo

**Files:**
- Create: `src/lib/marchio.js`, `src/components/Marchio.jsx`
- Test: `src/lib/__tests__/marchio.test.js`

**Interfaces:**
- Produces: `NOME_APP = 'PUSHFIT'`, `MARCHIO_PRIMA = 'PUSH'`, `MARCHIO_SECONDA = 'FIT'` da `marchio.js`; `<Marchio className? />` che rende `PUSH` + `<span class="text-brand">FIT</span>`.

- [ ] **Step 1: test che fallisce** — `marchio.test.js`: `NOME_APP === MARCHIO_PRIMA + MARCHIO_SECONDA`, e una scansione dei file in `src/` (esclusi `__tests__`, `supabaseDemo.js`, `demoSemi.js`) che fallisce se trova la stringa `FLEOFIT` o `>FLEO<` in testi visibili. Come `colori.test.js`: è l'unica cosa che impedisce al vecchio nome di tornare.
- [ ] **Step 2:** `npx vitest run src/lib/__tests__/marchio.test.js` → FAIL (elenca i ~44 punti).
- [ ] **Step 3:** creare `marchio.js` e `Marchio.jsx`.
- [ ] **Step 4: commit** `git add src/lib/marchio.js src/components/Marchio.jsx src/lib/__tests__/marchio.test.js`

### Task 1-bis: le chiavi `fleofit_*` diventano `pushfit_*`, con il trasloco

Le 38 chiavi vivono **solo** nel localStorage della web view (nessun codice nativo, service worker o Edge Function le legge: verificato il 17/11/2026). La sessione di Supabase sta in `sb-<progetto>-auth-token`, non in una chiave `fleofit_`: il login non si perde. Si possono quindi rinominare, a patto di **traslocarle all'avvio, prima che qualunque codice le legga**.

**Files:**
- Create: `src/lib/chiaviLocali.js`, test `src/lib/__tests__/chiaviLocali.test.js`
- Modify: `src/main.jsx` (il trasloco gira prima di `createRoot`), i 27 file che scrivono `'fleofit_…'` o `` `fleofit_${…}` `` a mano (35 accessi diretti più quelli via `leggiJson`/`scriviJson`), CLAUDE.md §8.

**Interfaces:**
- Produces: `PREFISSO = 'pushfit_'`, `PREFISSO_VECCHIO = 'fleofit_'`, `chiave(nome: string): string` (→ `'pushfit_' + nome`), `traslocaChiavi(storage = localStorage): number` (quante ne ha spostate).

- [ ] **Step 1: test che fallisce** — `traslocaChiavi` su uno storage finto con `fleofit_name_u1 = 'Sara'` e `fleofit_offline_queue = '[…]'`: dopo, esistono `pushfit_name_u1` e `pushfit_offline_queue` con gli stessi valori e le vecchie non ci sono più. Altri tre casi: (a) se `pushfit_x` esiste già **vince il nuovo** e il vecchio si cancella; (b) chiamarla due volte non cambia niente (ritorna 0); (c) `adminRoleOverride` e `sb-…-auth-token` non si toccano. (d) Uno storage che lancia eccezioni (navigazione privata) non blocca l'avvio.
- [ ] **Step 2:** `npx vitest run src/lib/__tests__/chiaviLocali.test.js` → FAIL.
- [ ] **Step 3:** implementare; chiamarla in `main.jsx` dentro un `try`.
- [ ] **Step 4:** sostituire tutte le chiavi scritte a mano con `chiave('…')`. Estendere il test di `marchio.test.js`: fallisce se trova `'fleofit_` o `` `fleofit_ `` in `src/` fuori da `chiaviLocali.js`.
- [ ] **Step 5:** `npm test` verde; poi sul telefono: installare la **nuova sopra la vecchia**, con una bozza aperta e un allenamento in coda offline, e controllare che siano ancora lì.
- [ ] **Step 6: commit.**

⚠️ `fleofit_demo_db` (ambiente di prova) e i controlli di CLAUDE.md §9 prima dell'archive che lo cercano vanno aggiornati insieme.

### Task 1-ter: lo schema `fleofit://` diventa `pushfit://`, in tre tempi

Lo schema non si può spegnere di colpo: un QR della TV, un link d'invito, il ritorno da Google o da Garmin che dice `fleofit://` deve trovare un'app che lo apre, e le app vecchie conoscono solo `fleofit://`. Per questo si fa in tre tempi.

**Tempo 1 — con la 1.2.5: l'app ascolta tutti e due, usa ancora il vecchio.**

**Files:**
- Create: `src/lib/schema.js` — `SCHEMA = 'pushfit'`, `SCHEMI_ACCETTATI = ['pushfit', 'fleofit']`, `eNostroSchema(url: URL): boolean`, `linkApp(percorso: string): string`.
- Modify: `ios/App/App/Info.plist` (`CFBundleURLSchemes` con **due** voci, `fleofit` e `pushfit`), `android/app/src/main/AndroidManifest.xml` (un secondo `<data android:scheme="pushfit" />`), `src/App.jsx` (`DeeplinkHandler`: `url.protocol === 'fleofit:'` → `eNostroSchema(url)`), `src/lib/codiceTV.js`, `linkInvito.js`, `linkTimer.js`, `garmin.js`, `useIndietro.js`, `CollegaTV.jsx`, `Invito.jsx` (in **lettura** accettano tutti e due).
- Test: `src/lib/__tests__/schema.test.js` — `pushfit://tv/1234` e `fleofit://tv/1234` accettati; `pushfitx://tv/1234`, `fleofit.evil://…` e `https://fleofit.vercel.app.evil.com/…` rifiutati (oggi ci sono già i casi `fleofit://tvx` e `.evil.com`: vanno tenuti e duplicati per `pushfit`).

- [ ] Test che fallisce → implementazione → test verde → commit, come sopra.
- [ ] In **scrittura** (il QR della TV, il `redirectTo` di Login, il ritorno Garmin, il link del timer) si continua a produrre `fleofit://`: chi ha ancora la 1.2.4 deve poterlo aprire.

**Tempo 2 — quando quasi tutti hanno la 1.2.5 (lo dice App Store Connect → Analisi → versioni): l'app produce `pushfit://`.**

- [ ] Prima, a mano: **Supabase** → Auth → URL Configuration: aggiungere `pushfit://login-callback` (lasciare il vecchio). **Garmin** developer portal: aggiungere il redirect `pushfit://garmin` (lasciare il vecchio). `supabase/functions/_shared/garminRegole.ts`: accettare tutti e due, poi deploy.
- [ ] Poi in `linkApp` passare la scrittura a `pushfit://`. Esce con la versione successiva (1.2.6 o quella che è).
- [ ] ⚠️ La TV è una pagina web: il suo QR cambia appena si fa `app:main`, non con l'app. Fare `app:main` di questo passaggio **solo dopo** che la versione che produce `pushfit://` è sugli Store.

**Tempo 3 — facoltativo, mesi dopo: togliere `fleofit` da `SCHEMI_ACCETTATI`, da `Info.plist`, dal Manifest, da Supabase e da Garmin.** Tenerlo non costa niente; toglierlo rompe i QR stampati e i link vecchi rimasti nelle chat. Consiglio: non farlo.

### Task 2: i testi e i loghi dentro l'app

**Files (Modify):** le stringhe visibili — `LoginUI.jsx`, `FoglioCollegaTV.jsx`, `Consenso.jsx`, `TVDashboardUI.jsx`, `profiloAtleta.js`, `garmin.js` (testo del consenso Garmin), `galleria.js` (`ALBUM_ANDROID`), `Landing.jsx` (titolo SEO, FAQ, dati strutturati), `WorkoutDetail.jsx` (`@FLEOFIT` della story Instagram), `Login.jsx` (oggetto della mail), `Settings.jsx` (versione, nome del file di backup, testi del consenso e della Live Activity), `templatePdf.js`, `liveActivity.js`. I loghi `FLEO`+`FIT` scritti a mano in ~23 componenti (`Apertura`, `Navbar`/`BarraLaterale`, Home coach/atleta, `StoriaUI`, `TVDashboardUI`, `ImpostazioniUI`, `LandingApp`, …) → `<Marchio />`.

- [ ] **Step 1:** sostituire, file per file, con `NOME_APP` / `<Marchio />`.
- [ ] **Step 2:** `npx vitest run src/lib/__tests__/marchio.test.js` → PASS.
- [ ] **Step 3:** `npm test` → i test di pagina che cercano «FLEOFIT» (≈33 file in `pages/__tests__`, 16 in `lib/__tests__`) falliscono: aggiornarli a `NOME_APP`, **non** a `'PUSHFIT'` scritto a mano. Ripetere fino a verde.
- [ ] **Step 4:** controllo a occhio con `npm run demo` e `npm run demo:atleta`: login, apertura, Home, story Instagram, PDF, TV.
- [ ] **Step 5:** ⚠️ `ALBUM_ANDROID`: cambiandolo, le immagini nuove vanno in un album «PUSHFIT»; le vecchie restano in «FLEOFIT». Va bene, ma va detto nelle novità.
- [ ] **Step 6: commit** dei file toccati, per nome.

### Task 3: il sito e la policy

**Files (Modify):** `index.html` (`<title>`, il logo di `#apertura-prima`), `public/site.webmanifest` (`name`, `short_name`), `public/favicon*`, `apple-touch-icon.png`, `web-app-manifest-*.png`, `public/privacy-policy.html` (≈20 menzioni, IT + EN; la data di aggiornamento in testa), `src/assets/landing/` se le schermate mostrano il logo (`tools/landing-schermate/` le rigenera).

- [ ] **Step 1:** testi e immagini.
- [ ] **Step 2:** `npm run build` e controllare il peso di `index` (deve restare ≈616 KB, CLAUDE.md §2).
- [ ] **Step 3: commit.** Il sito cambia solo al prossimo `app:main`, su richiesta.

### Task 4: iOS

**Files (Modify):** `capacitor.config.ts` (`appName`), `ios/App/App/Info.plist` (`CFBundleDisplayName` = il nome sotto l'icona, e le quattro frasi dei permessi: fotocamera, microfono, galleria ×2), `ios/App/FleoTimer/TimerLiveActivity.swift` («Apri FLEOFIT per il passo successivo», due volte), `ios/App/App/Assets.xcassets/AppIcon.appiconset` e `Splash.imageset`.

- [ ] **Step 1:** testi e icone (l'icona 1024×1024 senza trasparenza, come oggi).
- [ ] **Step 2:** `npm run ios`, poi i controlli di CLAUDE.md §9 prima dell'archive, poi `tools/verifica-ipa.sh`: in più controllare che nel `.ipa` il `CFBundleDisplayName` sia PUSHFIT e il bundle id sia **ancora** `it.federicoleo.fleofit`.
- [ ] **Step 3:** prova sul telefono (la fa il committente): nome sotto l'icona, testo dei permessi, Live Activity.
- [ ] **Step 4: commit.**

### Task 5: Android

**Files (Modify):** `android/app/src/main/res/values/strings.xml` (`app_name`, `title_activity_main`; **non** `package_name` né `custom_url_scheme`), icone e splash con `python tools/icone-android.py` (mai `capacitor-assets`).

- [ ] **Step 1:** testi, poi `npm run android` e `./gradlew installDebug`.
- [ ] **Step 2: commit.**

### Task 6: Edge Function

**Files (Modify):** `supabase/functions/send-reminders/index.ts` e `broadcast.ts` (titoli delle push), `segnalazione/index.ts` e `regole.ts` (oggetto e firma della mail), `gare-hyrox/index.ts`, `garmin-auth`, `garmin-webhook`, `_shared/workoutGarmin.ts` e `garminRegole.ts` (il nome che compare sull'orologio).

- [ ] **Step 1:** solo testi visibili; `_shared/admin.ts` contiene mail, non si tocca.
- [ ] **Step 2:** test delle funzioni, poi deploy. ⚠️ `send-reminders` serve anche il sito: le push col nome nuovo arrivano a tutti dal deploy, prima ancora dell'app nuova. Conviene farlo **lo stesso giorno** in cui esce la versione sugli Store.
- [ ] **Step 3: commit.**

### Task 7: i servizi esterni (a mano, dal committente)

- [ ] **Supabase** → Authentication → Email Templates: oggetto e testo delle mail (conferma, reset password). Authentication → URL Configuration: aggiungere il dominio nuovo e `pushfit://login-callback`, **lasciare** `fleofit://login-callback` (Task 1-ter).
- [ ] **Google Cloud** → OAuth consent screen: nome dell'app e logo (è il nome che si legge su «Accedi con Google»; il cambio di logo può richiedere una nuova verifica di Google).
- [ ] **Apple Developer** → Identifiers: la descrizione dell'App ID (solo estetica). Se il login Apple è attivo anche sul web, il Services ID ha un nome suo da aggiornare.
- [ ] **Garmin Connect Developer Program**: nome e logo dell'app (è ciò che l'atleta vede quando autorizza).
- [ ] **Resend**: nome del mittente (e il dominio, se cambia).
- [ ] **Vercel**: il dominio nuovo, se c'è, come alias; `fleofit.vercel.app` resta acceso (link vecchi, app già installate, file `apple-app-site-association`).

### Task 8: App Store Connect — il cambio di nome

Il nome sull'App Store **non cambia da solo** con la build: si cambia nei metadati, e si può modificare **solo mentre c'è una versione «Pronta per l'invio»**. Il nome nuovo diventa pubblico quando quella versione è approvata e rilasciata.

- [ ] **Step 1 — verificare che il nome sia libero:** App Store Connect → la tua app → crea la versione **1.2.5** → Informazioni app → Nome → scrivere «PUSHFIT» e salvare. Se è già usato da un'altra app, Apple lo rifiuta subito: fermarsi e tornare alle decisioni.
- [ ] **Step 2 — Informazioni app** (per ogni lingua, italiano e inglese se c'è): Nome, Sottotitolo (30 caratteri), URL della privacy (`/privacy`, sul dominio scelto).
- [ ] **Step 3 — pagina della versione 1.2.5:** screenshot nuovi (con il logo PUSHFIT; quelli vecchi mostrano FLEOFIT e sono motivo di rifiuto 2.3.8 / 2.3.7 se non corrispondono), Descrizione, Testo promozionale, Parole chiave (si può tenere «fleofit» fra le parole chiave per chi cerca il vecchio nome), URL di supporto e marketing, Copyright, Novità («FLEOFIT ora si chiama PUSHFIT: stessa app, stessi dati»).
- [ ] **Step 4 — Note per la revisione:** scrivere che è un cambio di nome dello stesso titolare, stessa app; l'account `demo@fleofit.it` resta valido (il dominio della mail è vecchio, va spiegato in una riga).
- [ ] **Step 5 — build:** caricare la build del Task 4. Il nome sotto l'icona (`CFBundleDisplayName`) deve corrispondere a quello dello Store (linea guida 2.3.8).
- [ ] **Step 6 —** prima di archiviare, i controlli di `docs/memoria/app-store.md` (stato della versione, universal link della 1.2.5, consenso privacy).

### Task 9: Google Play Console

- [ ] Scheda dello Store principale: Nome dell'app (max 30), descrizione breve e completa, icona 512×512, grafica in primo piano, screenshot. Il nome sul Play Store si cambia senza una release, ma va fatto insieme alla release con la build del Task 5, così icona e Store coincidono. (La pubblicazione Android è ancora da fare, `docs/memoria/android.md` §A.4: se non è ancora uscita, si parte direttamente col nome nuovo.)

### Task 10: la memoria del progetto

- [ ] `CLAUDE.md`: §0 punto 1 («il nome è PUSHFIT dal …; restano `fleofit` nelle chiavi, nello schema e nel bundle id, apposta»), §1, §6 (logo `PUSH` + `FIT`).
- [ ] `docs/memoria/app-store.md`: data del cambio, versione che l'ha portato, nota per la revisione usata.
- [ ] `BACKLOG.md`: chiudere la voce del nome; riaprire la mail dei cambi di policy, che aspettava il nome.

## Review Focus

- **Chi aggiorna dall'app vecchia** deve restare dentro, con bozze e coda offline: è il motivo per cui chiavi `fleofit_*`, bundle id e schema non cambiano. Provarlo sul telefono installando la nuova sopra la vecchia, non da zero.
- **Login Google e reset password** dopo il cambio: tornano con lo schema giusto per la versione installata (Task 1-ter, tempo 2, e Task 7).
- **Il trasloco delle chiavi a metà**: se l'app si chiude durante `traslocaChiavi`, al riavvio deve finire il lavoro senza perdere niente (copia prima, cancella dopo; il test (a) lo copre).
- **Il QR della TV e il link d'invito** generati prima del cambio devono ancora aprire l'app (`fleofit://tv`, `/invito/…` su `fleofit.vercel.app`).
- **Push con il nome nuovo su app ancora vecchie**: accettabile, ma il deploy delle Edge Function va allineato all'uscita (Task 6).
- **Testi nei test dimenticati**: il test del Task 1 è quello che impedisce a «FLEOFIT» di ricomparire in una schermata nuova.
