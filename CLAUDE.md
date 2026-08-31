# CLAUDE.md — Memoria globale progetto FLEOFIT

> Documento di memoria persistente per Claude. Leggere **sempre** questo file prima di
> toccare il codice o proporre modifiche grafiche.
> Ultimo aggiornamento: **31 agosto 2026**.
> **Due branch attivi e DIVERGENTI, ENTRAMBI MANUTENUTI**: `main` = web app in produzione ·
> `ios-version` = app per l'App Store (§1.1 — rifare sempre `git fetch` prima di parlare dei due).
> Ultimo commit `098a59e` su `ios-version`, allineato con `origin/ios-version`.
> `npm test` → **617 test**, `npm run lint` → **41 problemi** (erano 164 la mattina del 25/08).
> Nove schermate rifatte su design di Claude Design: **Home atleta** il 26/08 (§9-octies),
> **Home coach** il 27/08 (§9-nonies) con la **pausa atleta** (§9-decies), **Crea Workout**
> il 27/08 (§9-undecies), la **scheda del workout** (§9-duodecies) e la **scheda atleta**
> (§9-terdecies) il 28/08, l'**archivio** (§9-sedecies), la **rubrica atleti**
> (§9-septdecies) e il **calendario** (§9-octodecies) il 31/08. Il 28/08 anche il
> foglio **«Genera con IA»** (§9-quindecies),
> che è dove l'entrata mancante di BACKLOG #34 si è vista per la seconda volta.
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
6. Prima di modificare un file grande (`WorkoutDetail.jsx` 2.938 righe, `AthleteDetail.jsx` 2.553,
   `CreateWorkout.jsx` 2.348, `Home.jsx` 2.010 — contate il 26/08/2026) leggere le sezioni
   rilevanti: c'è molta logica duplicata tra i file (vedi §9 Debito tecnico).
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
| **`ios-version`** | Versione nativa iOS/Capacitor, quella caricata sull'App Store (§9-ter) | **collegato a NIENTE**: è solo il backup su GitHub del lavoro locale. L'app arriva sull'App Store da Xcode, non da un deploy | `098a59e` — 31 ago 2026 |

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
`git rev-list --left-right --count origin/main...origin/ios-version` → **`49 81`**
(rimisurata il 31/08/2026 dopo un `git fetch`: `main` è fermo al 25/08, `ios-version`
continua a muoversi — il divario cresce di uno a ogni commit di qui).
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
Aggiunti il 25-26/08 e ancora solo qui: **tutta l'infrastruttura di test**
(`vitest.config.js`, `src/test/`, i `__tests__`), e quasi tutto `src/lib/` —
`offlineQueue.js`, `rpe.js`, `blockColors.js`, `alert.js`, `pushToken.js`,
`constants.js`, `timerSequence.js`, `statistiche.js`, `badge.js` — più
`supabase/functions/_shared/admin.ts` e `tools/` (verifica dell'ipa e query sul revisore).
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
npm run ios      # build + cap sync — USARE QUESTO prima di compilare da Xcode
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
├─ useTastiera.js              # la tastiera di sistema è aperta? (barre ancorate in basso)
├─ useBottomSheet.js           # ⚠️ l'UNICO bottom sheet fatto bene: entrata, maniglia, scroll bloccato (§9-duodecies)
├─ lib/                        # logica pura, l'unica parte con test
│  ├─ alert.js                 # mostraAlert/mostraErrore: alert applicativo senza passare props
│  ├─ andamento.js             # aderenza, carico, volume e sforzo della scheda atleta — TUTTI
│  │                           #   sulla stessa finestra di 30 giorni (§9-terdecies)
│  ├─ aptica.js                # battito(): il colpetto dei picker, era in due copie
│  ├─ badge.js                 # ⚠️ l'UNICO punto che scrive il badge iOS (§8)
│  ├─ blockColors.js           # TYPE_COLORS, unificata dalle 5 copie sparse
│  ├─ blockHints.js            # BLOCK_HINT: didascalie in chiaro dei tipi di blocco (§9-ter)
│  ├─ categorie.js             # CORSIA/corsia/categoriaDi: la Regola della Corsia in un punto solo
│  ├─ notaVocale.js            # isVoiceNoteValid: il soft delete `#deleted=` si filtra sempre
│  ├─ pausa.js                 # ⚠️ «atleta in pausa» dentro athletes.notes — NON è una colonna (§9-decies)
│  ├─ rigaAtleta.js            # ⚠️ l'aderenza settimanale della rubrica — la settimana comincia di
│  │                           #   LUNEDÌ, e chi non ha niente in programma NON è a zero (§9-septdecies)
│  ├─ rigaArchivio.js          # ⚠️ meta, gruppi per mese e chip dell'archivio — l'ordine è per DATA, non
│  │                           #   per creazione, o lo stesso mese ricompare nello scroll (§9-sedecies)
│  ├─ rigaBlocco.js            # le didascalie del blocco nella scheda: parametri e specifiche (§9-duodecies)
│  ├─ rigaCalendario.js       # ⚠️ griglia, segno del giorno e i tre numeri del mese — il volume
│  │                           #   dice «≈» quando ha dovuto lasciare fuori qualcosa (§9-octodecies)
│  ├─ stiliCard.js             # CARD/LABEL/RIGA/VETRO/CARTA_RIGA(_BASE) — costanti, NON componenti
│  │                           #   (§9-octies punto 3). ⚠️ Il bordo si DICHIARA, non si sovrascrive (§9-octodecies)
│  ├─ constants.js             # ERGOMETERS e affini
│  ├─ offlineQueue.js          # ⚠️ coda offline + leggiJson/scriviJson — vedi §9 regola 0-bis
│  ├─ pushToken.js             # rinfresco del token FCM
│  ├─ rpe.js                   # parseNotesAndRpe / formatNotesWithRpe
│  ├─ statistiche.js           # carico settimanale, completamento, distribuzione RPE
│  ├─ statisticheCoach.js      # i numeri della Home coach: feedback, squadra del giorno, fermi, scaduti, copertura
│  ├─ stimaWorkout.js         # ⚠️ durata STIMATA e RPE atteso del builder — non è un dato vero
│  │                           #   (§9-undecies). L'RPE è una media di POTENZA, non aritmetica.
│  │                           #   ⚠️ Esiste un SECONDO `rpeAtteso` in statistiche.js, che è un
│  │                           #   calcolo diverso per le stesse parole: la Home parte da
│  │                           #   `sections.intensity` e ripiega su una tabella per tipo di
│  │                           #   blocco. Lo stesso workout può quindi dire due numeri diversi
│  │                           #   in due schermate — non è stato unificato, sta in BACKLOG
│  ├─ timerSequence.js         # buildTimerSequence + getNormalizedBlocks (§5 legacy)
│  ├─ workoutTitle.js          # titolo generato dalla data (c'è anche su main)
│  └─ __tests__/               # 230 test — il grosso della copertura (§9 punto 11)
├─ test/
│  ├─ setup.js                 # jsdom, localStorage in memoria, finto Capacitor (§9-sexies)
│  ├─ fintoSupabase.js         # catena fluente via Proxy — riutilizzabile per ogni pagina
│  └─ montaPagina.jsx          # router e AuthContext VERI, non finti
├─ components/
│  ├─ HomeAtletaUI.jsx         # i pezzi visivi della Home atleta (§9-octies) — sola presentazione
│  ├─ HomeCoachUI.jsx          # i pezzi visivi della Home coach (§9-nonies) — sola presentazione
│  ├─ CreaWorkoutUI.jsx        # i pezzi visivi del builder (§9-undecies) — RiepilogoWorkout e BarraAzioni
│  │                           #   servono ANCHE la scheda: stesso codice in scrittura e in lettura
│  ├─ AudioVisualizer.jsx      # ⚠️ l'UNICA forma d'onda: note vocali E dettatura IA (§9-quindecies)
│  ├─ WorkoutDetailUI.jsx      # i pezzi visivi della scheda workout (§9-duodecies) — sola presentazione
│  ├─ SchedaAtletaUI.jsx       # i pezzi visivi della scheda atleta (§9-terdecies) — sola presentazione
│  ├─ ArchivioUI.jsx           # i pezzi visivi dell'archivio (§9-sedecies) — sola presentazione.
│  │                           #   ⚠️ CampoRicerca e IntestazioneSezione servono ANCHE la rubrica atleti
│  ├─ AtletiUI.jsx             # i pezzi visivi della rubrica atleti (§9-septdecies) — sola presentazione
│  ├─ CalendarioUI.jsx         # i pezzi visivi del calendario (§9-octodecies) — sola presentazione
│  ├─ Navbar.jsx               # bottom nav in vetro, voce attiva in pillola, voci variabili per ruolo
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
   └─ __tests__/               # 138 test su componenti e pagine montate (§9 punto 11)
tools/                            # non entra nell'app: serve alle verifiche pre-submission
   ├─ ExportOptions-AppStore.plist # esporta un .ipa in locale, NON carica niente
   ├─ verifica-ipa.sh              # 6 controlli sul binario vero (§9-ter)
   └─ verifica-revisore.sql        # solo letture: account demo, dati, policy (§9-ter)
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

> ℹ️ Restano installate **due** librerie audio (§9 punto 4). Ora però non sono equivalenti:
> `@independo/capacitor-voice-recorder` è solo il ripiego, `capacitor-voice-recorder` serve
> alla dettatura IA in CreateWorkout.

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
- **Transizione pagina**: classe `.page-transition` — slide-up 15px + fade, 0.3s `cubic-bezier(0.16,1,0.3,1)`.
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
- **Gestione atleti**: rubrica, scheda con storico, nota per l'atleta, PR, statistiche (carico
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
- **Timer guidato** (⚠️ **non per gli allenamenti di corsa**, dal 26/08/2026 — decisione del
  committente: le fasi si seguono con l'orologio. La regola sta in `haTimerGuidato()`, un punto
  solo, e vale anche per gli Eventi/gare. Conseguenze volute: la Live Coach Cam non vede gli
  atleti che corrono, perché la presenza è tracciata dentro `WorkoutTimer`; il cast su TV mostra
  il piano statico): `buildTimerSequence()` linearizza il workout in una sequenza di step
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
- **Badge iOS**: si scrive **solo** con `sincronizzaBadge()` di `src/lib/badge.js`. Aggiorna
  insieme il badge nativo e `push_subscriptions.badge_count`, che non sono equivalenti: il primo
  è cosmetico, il secondo viene **riletto da `send-reminders`** per calcolare il badge della push
  successiva, quindi se salta ogni notifica futura porta il numero sbagliato.
  In `Home` non si chiama nemmeno a mano: c'è **un solo effetto** su `unreadCount`, che a sua
  volta è **derivato** da `notifications` con `useMemo`. Chi cambia le notifiche non deve pensare
  al badge — ed è il motivo per cui non possono più divergere (erano 7 punti da allineare a mano).

---

## 9. Debito tecnico noto (contesto, non da sistemare senza richiesta)

0-bis. ⚠️ **localStorage si legge SOLO con `leggiJson`/`scriviJson` di `src/lib/offlineQueue.js`.**
   Un `JSON.parse(localStorage.getItem(...))` nudo ha già prodotto due guasti silenziosi
   (§9-quater punti 1 e 4). Le chiavi sono elencate al §8.
1. ~~Codice duplicato pesante~~ → **in gran parte chiuso il 25-26/08/2026.**
   In `src/lib/`: `rpe`, `blockColors`, `constants`, `offlineQueue`, `timerSequence`,
   `statistiche`, `badge`, `colori`, e dal 27/08 `notaVocale`, `categorie`, `stiliCard`.
   In `src/components/`: `VoiceRecorder`, `AudioVisualizer`, `RpeModal`, `CustomAudioPlayer`.
   Dal 28/08 `RiepilogoWorkout`, `BarraAzioni`, `CtaPrimaria`, `BottoneQuadrato`,
   `SpinaBlocco` e `DurataBlocco` di `CreaWorkoutUI` servono **anche la scheda**: il
   coach ritrova in lettura la stessa cosa che ha visto in scrittura, e due copie
   divergerebbero al primo ritocco (§9-duodecies). `VETRO` è salito in
   `lib/stiliCard.js` per la stessa ragione. Nella scheda sono spariti `Section` ed
   `ExList`, sostituiti da `BloccoScheda` e `RigaEsercizio`.
   > `isVoiceNoteValid` era in due copie e la Home coach ne sarebbe stata la **terza**:
   > il soft delete `#deleted=` è una regola di dominio, e una terza copia è il modo in
   > cui una correzione ne raggiunge due su tre. Stessa ragione per `CARD`/`LABEL` e per
   > la tabella delle corsie, che erano dentro `HomeAtletaUI.jsx`: stanno in `lib/` e non
   > esportate da un file di componenti perché un modulo che esporta anche una costante
   > perde il Fast Refresh per intero (§9-octies punto 3).
   > 🔴 **Perché contava, detto dai fatti.** `VoiceRecorder` era in TRE copie, e il
   > 25/08 un guasto è stato corretto in **due su tre**. Confrontandole il 26/08 erano
   > già diverse: Home aveva il messaggio all'utente quando il MediaRecorder fallisce,
   > WorkoutDetail il log dell'errore nativo, e **nessuna delle due aveva entrambe**.
   > Il componente unico prende il meglio delle due linee separate.
   > Le tre pagine perdono 1.360 righe, i componenti condivisi ne aggiungono 537.
   **Restano duplicati** i beep WAV (WorkoutDetail e TVDashboard) e le cinque funzioni
   di colore per intensità/RPE sparse in quattro file (§9 punto 3, BACKLOG #16-bis).
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
11. ~~Nessun test automatico~~ → **617 test al 31/08/2026** (`npm test`, vitest), tutti
    verificati per mutazione: se si rompe di proposito il codice che coprono, falliscono.
    Non sono decorativi, ed è l'unico criterio che conta — vedi §9-sexies.

    **367 sulla logica pura di `src/lib/`**

    | file | test | cosa protegge |
    |---|---|---|
    | `timerSequence` | 32 | espansione dei round, rotazione degli esercizi, `nextTask`, formato legacy (§5), e il fatto che la corsa NON abbia il timer |
    | `statistiche` | 23 | carico settimanale, completamento a 30 giorni, distribuzione RPE, e le distanze contate come stima invece che come minuti |
    | `andamento` | 20 | i numeri dell'eroe della scheda atleta: l'RPE **non** dichiarato che resta fuori dalla media invece di entrarci come 5, la finestra dei 30 giorni che è davvero 30, e lo scarto che torna `null` invece di `Infinity` |
    | `statistiche-home` | 24 | i numeri della Home atleta: serie di giorni, sparkline, blocchi, RPE atteso, RPE medio di categoria |
    | `colori` | 23 | che i token CSS e le costanti JS dei colori di marchio non divergano |
    | `offlineQueue` | 20 | deduplica per allenamento, valori corrotti, quota piena, localStorage negato da Safari |
    | `badge` | 8 | badge nativo e `badge_count` aggiornati **insieme**, e mai in modo che possano lanciare |
    | `statisticheCoach` | 42 | i numeri della Home coach: atleti fermi (compreso «mai, in tutta la finestra»), scaduti, copertura, feedback non letto, squadra della giornata |
    | `pausa` | 12 | il marcatore `[PAUSA]` dentro la nota: vale solo in testa, non si duplica al secondo salvataggio, non si mangia il testo |
    | `stimaWorkout` | 32 | la durata stimata del builder: il Rest che tiene la durata in `meters`, il rest di Cash In contato round − 1 volte, e l'RPE atteso che torna `null` invece di 5. **Sei** tengono in piedi la media di potenza (§9-undecies punto 3): che su un workout uniforme torni *esattamente* quel valore, che un Cash In leggero non spenga la seduta, che trenta secondi a 10 non la rendano massimale, che il peso segua la durata **anche dentro** il blocco, e che un blocco stimato a zero non sparisca. ⚠️ I due test sui limiti hanno **due** asserzioni ciascuno — la cifra e il contratto (sopra la media aritmetica, sotto il massimo dichiarato): la cifra da sola cadrebbe a ogni ritocco dell'esponente senza dire quale delle due proprietà si è persa |
    | `rigaBlocco` | 15 | le didascalie del blocco nella scheda: i ripieghi identici a quelli del builder, il rest di Cash In che su un round solo non si nomina, e le specifiche che saltano i «-» invece di stamparli |
    | `rigaArchivio` | 30 | l'archivio: l'ordine per DATA con `created_at` come spareggio, il mese che non ricompare due volte, la corsa mista che NON dichiara un totale, e i chip che non nascono su una corsia vuota |
    | `rigaAtleta` | 33 | la rubrica: la settimana che comincia di LUNEDÌ anche quando la si chiede di domenica, chi non ha niente in programma che scrive `—` invece di `0/0`, le tacche che oltre la soglia diventano una barra, la pausa che dice da quando e mai un rientro che nei dati non c'è, e la ricerca che trova «rossi marco» |
    | `rigaCalendario` | 35 | il mese: la settimana che comincia di LUNEDÌ anche quando il mese apre di domenica, il velo verde che pretende `every` e non `some`, la corsa a DISTANZA che torna `null` invece di 0 minuti — o il volume la conterebbe come un'ora di niente — e il `≈` che compare solo quando la somma ha lasciato fuori qualcosa |
| `blockColors` · `rpe` · `workoutTitle` | 6+6+6 | codifica colore, round-trip dell'RPE, titolo generato dalla data |

    **250 su componenti, pagine e hook**

    | file | test | cosa protegge |
    |---|---|---|
    | `HyroxBlock` | 22 | il **contratto padre-figlio**, riepiloghi dei blocchi, didascalie (rilievo 3.2.1viii) |
    | `RunningStepRow` | 16 | idem per le fasi di corsa |
    | `HomeOffline` | 14 | il percorso offline completo su `Home` montata: completare, scompletare, coda, cache che si ripara, modale RPE che non si blocca |
    | `CreateWorkoutMemo` | 5 | la memoizzazione **dal lato del chiamante** (§9-quinquies) |
    | `RunningStepRowMemo` · `HyroxBlockMemo` | 4+2 | che `React.memo` serva ancora a qualcosa |
    | `HomeCoach` | 28 | il cablaggio del ramo coach su `Home` montata: l'eroe porta le citazioni e il numero dell'arretrato (non delle righe stampate), aprire un feedback segna letto **solo quello**, la squadra cambia giorno, l'account del coach resta fuori, e le card «Calendario»/«Atleti» restano fuori dalla pagina. ⚠️ Gli ultimi quattro montano con `role: 'admin'`, non `'coach'`: è il ruolo che esiste davvero, ed è l'unico a cui la Home mostrava anche il ramo atleta (§9-nonies, 28/08) |
    | `CreaWorkoutBuilder` | 20 | il builder ridisegnato su `CreateWorkout` montata: il riepilogo che segue i blocchi, il ritorno al passo 1 (unico posto dove nome e data si modificano), gli Stepper che scrivono il vocabolario di prima, «ultima volta», la ricerca esercizi che NON ruba il fuoco, lo scorrimento al blocco nuovo, e la ruota del passo (generi separati, valore intero, `—` in ogni genere) |
    | `CreaWorkoutIA` | 10 | il foglio «Genera con IA»: l'entrata che **esiste** (`sheet-in`, non `animate-in`, che genera zero CSS), il campo che NON prende il fuoco, la maniglia che è un bottone, la forma d'onda alimentata da `getUserMedia` — che senza microfono **non si finge** ma non lascia lo schermo muto — l'attesa che occupa il foglio con la CTA che sparisce, e il foglio che durante la generazione **non si chiude**. E **tre** test sull'avviso «non arriva nessun suono», che sono tre perché il difetto stava nel confine: microfono morto → l'avviso c'è; voce normale → non c'è; **voce piana** → non c'è lo stesso, ed è quello che prende la soglia unica (§9-quindecies). ⚠️ Il finto analizzatore suona su **quattro bande su ventiquattro**, come una voce vera: uno che riempie lo spettro ha la media alta e passa anche con la logica sbagliata |
| `ArchivioWorkout` | 21 | l'archivio ridisegnato su `WorkoutsArchive` montata: i gruppi per mese che restano nell'ordine giusto anche se la query torna per creazione, i chip derivati dai dati (mai «Libero», che la query del coach non fa arrivare), la ricerca che trova un ESERCIZIO e non solo il titolo, il titolo `null` che non porta via la pagina, e il contatore degli assegnati che all'atleta non si mostra — perché la sua query non lo carica nemmeno |
| `AtletiLista` | 21 | la rubrica ridisegnata su `Athletes` montata: la frazione che viene dalla settimana e non dai workout in pagina, l'atleta in pausa che RESTA nella lista (è l'unico posto in cui il coach si accorge di averne dimenticato uno), il marcatore `[PAUSA]` che non si vede mai come testo, il cestino che non è più un accordion, e una sola `select` su `athlete_workouts` per venti atleti. ⚠️ Il test che conta di più è quello sull'allarme della riga, e ci sono voluti due tentativi: «zero questa settimana» e «fermo da cinque giorni» quasi sempre coincidono, e un atleta qualsiasi passa con entrambe le logiche — serve chi ha chiuso **sabato**, cioè quattro giorni fa ma nella settimana scorsa |
| `CalendarioMese` | 21 | il calendario ridisegnato su `Calendar` montata: la coppia della fascia che misura lo STESSO insieme (le ore dei completati, non di tutto il programmato), il «Completati» che al coach non si mostra — la sua query non ha nessuno stato da leggere — l'RPE che c'è solo se dichiarato davvero, la cella che nell'`aria-label` dice il numero VERO oltre il tetto dei segmenti, e «Oggi» che compare solo fuori dal mese corrente. ⚠️ La fascia e la legenda sono due `role="group"` nominati apposta: dicono le stesse parole delle righe («Gara», «Running», «Fatto») e i loro numeri coincidono con i giorni della griglia, quindi un `getByText('2')` non scoped prende il 2 agosto e il test verifica un'altra cosa |
| `useTastiera` | 3 | il ramo **nativo**, che il resto della suite non tocca: la barra che sparisce quando la tastiera sale, e l'invio che toglie il fuoco |
    | `useBottomSheet` | 12 | il foglio del menu scheda: che l'entrata sia un'animazione **che esiste**, che il keyframe lasci il comando al dito, la maniglia trascinata oltre soglia (e sotto soglia, che NON deve chiudere), lo scorrimento della pagina bloccato con `position: fixed` e **ripristinato dov'era** |
    | `AthleteDetailPausa` | 7 | il bottone di pausa: conferma solo per spegnere l'allarme, marcatore mai visibile come testo, pillola invisibile all'atleta, e la modale di modifica che non cancella la pausa — **da nessuno dei due ruoli** |
    | `VoiceRecorder` · `VoiceRecorderNativo` | 3+4 | che la registrazione non sparisca in silenzio quando il plugin nativo fallisce (§9-quater punto 2) |
    | `WorkoutDetailTimer` | 3 | che il bottone del timer non compaia sugli allenamenti di corsa |
    | `SchedaAtleta` | 14 | la scheda atleta ridisegnata su `AthleteDetail` montata: il denominatore dell'anello (gli assegnati dei 30 giorni, non i workout in pagina), le tre tab che non ci sono più, lo storico che nasce chiuso dicendo quanti ne contiene, il menu che tiene Esporta/Modifica/Pausa fuori dalla pagina, la barra fissa che NON esiste sul proprio profilo, e «Prossimi allenamenti» che il redesign non toglie. ⚠️ Il coach si monta sulla rotta `/athletes/:id`: senza il parametro la pagina si crede sul proprio profilo e il test verifica un'altra pagina |
    | `WorkoutDetailScheda` | 20 | la scheda ridisegnata su `WorkoutDetail` montata: la terza cella del riepilogo, che su un allenamento chiuso è l'RPE **dichiarato** e non quello atteso — e scrive `—`, non 5; la didascalia di BLOCK_HINT (rilievo 3.2.1viii); i blocchi aperti senza toccare niente; il menu che tiene i comandi fuori dalla pagina; la barra che non fa due gialli; l'elenco delle assegnazioni; la grafica IG che resta **renderizzata** fuori schermo, e il testo INTERO dell'avviso sul riscaldamento |

    ⚠️ **I due contratti sono asimmetrici e devono restarlo**: `HyroxBlock` passa `block.id`,
    `RunningStepRow` passa l'**indice**. "Uniformarli" romperebbe il riordino delle fasi di
    corsa (§9-quinquies).

    **Cosa resta scoperto**: l'**interfaccia** di `WorkoutDetail` e `AthleteDetail` — PDF,
    story IG, note vocali, Live Coach Cam, cast su TV, gestione PR. La loro *logica* è
    coperta, perché estratta in `src/lib/`.
    Nessun TypeScript effettivo nel `src/` (tutto `.jsx`) anche se il build esegue `tsc -b`.
12. 🔴 **ESLint non ha mai analizzato il codice dell'applicazione** (scoperto il 25/08/2026).
    `eslint.config.js` aveva `files: ['**/*.{ts,tsx}']`, ma `src/` è tutto `.jsx`: i "15 problemi"
    che `npm run lint` riportava erano **solo** nelle due Edge Function, gli unici `.ts` del
    progetto. Circa 13.000 righe di applicazione non erano mai state controllate
    (12.527 al 26/08, dopo le estrazioni in `src/lib/`).
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

### 5. La coda offline si bloccava su una voce malformata (corretto il 26/08/2026)
Trovato scrivendo i test su `processOfflineQueue`, l'ultimo pezzo scoperto del percorso.
`leggiCoda` garantisce che la coda sia un **array**, non che le voci dentro siano sane:
bastava un `null` — JSON perfettamente valido — perché `action.type` lanciasse. Il ciclo
moriva lì, e con lui tre cose: la coda non si svuotava più, **il workout valido che seguiva
non arrivava mai al server**, e `setSyncingQueue(false)` non veniva eseguito, quindi il banner
«Sincronizzazione in corso…» restava a girare per sempre.

La correzione distingue due casi che prima erano uno solo: una voce **irrecuperabile** si
scarta (riprovarla fallirebbe uguale), una voce **valida rifiutata dal server** si tiene per
riprovare. Lo spegnimento del banner e la riscrittura della coda stanno in un `finally`.

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

## 9-septies. Le segnalazioni `react-hooks`: cosa vale e cosa no (26/08/2026)

Erano 26 e il backlog le chiamava «un refactor vero». **Esaminandole una a una, 3 erano
difetti e 23 sono il pattern voluto.** Questa sezione esiste perché non vengano riaperte
come se fossero 26 cose da fare.

### Le tre corrette
| dove | cos'era |
|---|---|
| `Calendar.jsx` | `dayWorkouts` era uno **stato** riscritto da un effetto a ogni cambio di giorno: un render in più e uno stato che poteva restare indietro. Ora è un `useMemo`. |
| `AthleteDetail.jsx` | `weeklyStats` idem — e dentro l'effetto c'era una **terza copia** del calcolo della durata, con il difetto delle distanze (§BACKLOG #30). Ora usa `src/lib/statistiche.js`. |
| `Athletes.jsx` | `Date.now()` chiamato **durante il render** per il conto alla rovescia del cestino: due render consecutivi davano numeri diversi. Ora l'istante si fissa quando i dati arrivano — che è anche più corretto nel merito. |

### Perché le altre restano
- **`immutability` (9)** — il messaggio dice «Cannot access variable before it is declared»,
  ma vuol dire solo che un effetto chiama una funzione dichiarata più sotto. In JS funziona;
  è il linter che non può verificarlo.
- **`exhaustive-deps` (9)** — quasi tutte sono `useEffect(() => { fetchX() }, [])`, cioè
  «carica una volta al montaggio», che **è l'intenzione**. Provato su `WorkoutsArchive`:
  aggiungere la dipendenza richiede un `useCallback`, e il `setLoading(true)` dentro il fetch
  fa **comparire un `set-state-in-effect`** al suo posto. Si scambia un avviso con un altro,
  con in più il rischio di un ciclo infinito se una dipendenza è instabile.
- **`set-state-in-effect` (5)** — sono casi difendibili: stato inizializzato da una prop e poi
  modificabile dall'utente (le note, in due copie), lettura dell'hash dell'URL al montaggio
  (`Login`), reset di un'animazione, memoria dell'ultimo stato non nullo ricevuto dalla TV.

> **La regola che ne esce**: queste segnalazioni si leggono, non si azzerano. Un conteggio che
> scende non è di per sé un miglioramento, e in due casi su tre qui il conteggio sarebbe sceso
> spostando il problema.

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

## 9-octies. Il rework della Home atleta (26/08/2026)

Nasce da un design di **Claude Design** (progetto `4a238081-a3ee-4f59-ae34-100f29d55601`,
artboard `Home Atleta.dc.html`, opzione **1b**). La logica di `Home.jsx` — fetch, swipe di
completamento, modale RPE, coda offline, notifiche realtime — **non è stata toccata**: è
cambiato il JSX del ramo atleta e il modo in cui i dati vengono presentati.

### Cosa cambia, e perché
- **Un solo eroe.** L'allenamento di oggi occupa il primo schermo da solo: titolo a 29px, tre
  metadati, CTA piena. Prima arrivava dopo due schermate, con lo stesso peso visivo della card
  «Calendario» — ed è l'unica informazione per cui l'atleta apre l'app.
- **Lo slider a due slide è sparito.** Nascondeva le statistiche settimanali dietro un gesto
  che niente segnalava. Ora sono celle del bento: anello 3/5 + serie di giorni + volume/RPE.
- **Profondità vera.** Ombra proiettata neutra + hairline interna chiara. Vedi *La Regola
  della Carta Sollevata* in DESIGN.md: limita, senza contraddirla, la regola «piatto + glow».
- **Tre destinazioni tolte dalla Home dell'atleta** (Calendario, Profilo, Archivio): le prime
  due sono voci della navbar, la terza si apre dal Calendario. **Per il coach restano**: sono
  la sua unica via verso Atleti e archivio.
- **Il badge delle notifiche è un pallino, non un numero.** Il conteggio esatto lo dà il
  centro notifiche — ma vive anche nell'`aria-label` del bottone, altrimenti sparirebbe per
  chi usa VoiceOver. Il test lo verifica lì.
- **La frase motivazionale è rimasta**, come terza riga piccola dell'header: il design non la
  prevedeva, ma `getDailyMotivation` con anti-ripetizione è una funzione vera e cancellarla
  non era nello scopo del rework. Se si vuole toglierla, è una decisione di prodotto.

### ⚠️ Le tre trappole di questo codice
1. **`HeroOggi` non può avere animazioni CSS sul nodo radice.** È l'elemento su cui lo swipe
   scrive `style.transform` a ogni movimento del dito, e un'animazione con `fill: both`
   **vince sullo stile inline**: la card resterebbe ferma sotto il dito. L'entrata
   `hero-transition` sta sul contenitore, che non viene mai trasformato.
2. **La struttura del wrapper dello swipe è un contratto.** `swipeInizio` cerca il pannello
   verde con `el.parentElement.querySelector('[data-swipe-panel]')`: il pannello e la card
   devono restare fratelli dentro lo stesso `relative overflow-hidden`.
3. **`CARD`, `LABEL` e `corsia` NON sono esportate** da `HomeAtletaUI.jsx`, di proposito:
   esportare qualcosa che non è un componente fa perdere il Fast Refresh all'intero file
   (`react-refresh/only-export-components`).

### La query dell'atleta è stata allargata a 60 giorni
Partiva dal lunedì di questa settimana (`gte weekStartStr`, `limit 30`). Serie di giorni,
sparkline e RPE medio guardano **indietro**: con la vecchia finestra la serie avrebbe letto
zero ogni lunedì mattina. Ora `GIORNI_STORICO = 60` e `limit(400)`. I filtri esistenti
(oggi, prossimi, evento, settimana) sono tutti per data, quindi non cambiano.

### 🔴 Due difetti trovati SCRIVENDO i test, non leggendo il codice
Gli helper di `src/lib/statistiche.js` esistevano già ma non erano coperti. Entrambi
producevano un numero plausibile e sbagliato, cioè il caso peggiore.

1. **La serie non si spezzava mai.** La regola «un giorno di rest programmato non spezza la
   serie» era senza tetto: un atleta che si è allenato **una volta quaranta giorni fa** e mai
   più leggeva «Serie: 1 giorno», perché i trentanove giorni vuoti erano tutti rest
   programmato. Ora si attraversano al massimo `MASSIMO_REST_CONSECUTIVI = 3` giorni di fila.
2. **`mediaRpeCategoria` contava un 5 inventato.** `parseNotesAndRpe` torna `{ rpe: 5 }`
   quando il marcatore `[RPE: n/10]` non c'è — è il valore giusto per il cursore della
   modale, ma è un ripiego travestito da misura. Il guardiano `Number.isFinite(rpe)` non
   proteggeva da niente: 5 è finito. Chi non compila mai l'RPE vedeva «5» presentato come la
   propria media storica. Ora esiste **`rpeDichiarato()`** in `src/lib/rpe.js`, che torna
   `null` quando il dato non c'è.
   ⚠️ **`calcolaStatistiche` ha ancora lo stesso guardiano inerte** (`load` e
   `distribuzioneRpe`): non è stato toccato perché cambierebbe i numeri che il coach vede
   oggi, ed è una decisione di prodotto, non una correzione. Vedi BACKLOG.

## 9-nonies. Il rework della Home coach (27/08/2026)

Nasce dallo stesso progetto Claude Design della Home atleta
(`4a238081-a3ee-4f59-ae34-100f29d55601`), artboard `Home Coach.dc.html`, opzione **2b**.
Come per l'atleta, la logica di `Home.jsx` non è stata riscritta: sono cambiati il JSX del
ramo coach, la query che lo alimenta, e i numeri che quel ramo mostra.

### Il problema, in una riga
La Home coach non conteneva **un solo dato**: era un menù. Logo, CTA «Crea Workout», lista
delle attività di oggi e ieri, due card verso destinazioni che sono **già nella navbar**,
bottone archivio. L'unica informazione presente — chi ha fatto cosa ieri — è la meno utile
la mattina, perché guarda indietro. Quello che il coach non vedeva è **chi sta per sparire**.

### ⚠️ L'eroe è cambiato in corsa, ed è la cosa da sapere prima di tutto
La prima stesura del 27/08 metteva in cima **«richiedono attenzione»**. La revisione dello
stesso giorno dell'artboard `2b` lo ha sostituito con i **feedback**, e la ragione non è
estetica: chi è fermo da nove giorni **lo è ancora fra un'ora**, mentre una nota non letta è
l'unica cosa in pagina che ha già **un mittente in attesa**. Chi è fermo non è sparito — è
sceso sotto la CTA, con lo stesso dato di prima. Se questo documento e il codice dovessero mai
contraddirsi su quale sia l'eroe, la fonte è `src/pages/Home.jsx`, ramo `role !== 'athlete'`.

### Cosa c'è ora, nell'ordine in cui sta in pagina
1. **L'eroe: «feedback nuovi»** — le note (con RPE) e le note vocali che il coach non ha
   ancora aperto. Ogni riga porta **la citazione**, non solo il nome: un contatore senza il
   testo obbliga ad aprire quattro schermate per sapere se una delle quattro era urgente.
   Tre citazioni in pagina (`FEEDBACK_IN_HOME`), il resto dietro un «+N altri».
   ⚠️ Il numero grande è `elementi.length` (le cose da leggere), **non** `totale`
   (che somma vocali e note, e per una riga con entrambe vale due).
2. **La squadra della giornata** — «5/7 completati», la barra a segmenti, i volti con
   l'anello colorato e l'RPE sotto. Sostituisce la lista «Attività oggi e ieri», che
   elencava gli eventi uno per uno senza mai far vedere l'insieme. Il giorno si cambia in
   fondo alla card: ieri è consultazione, la domanda della mattina è su oggi.
3. **La CTA «Crea workout»**, unica superficie gialla piena della pagina.
4. **Archivio** (e **Profilo** solo per `admin`), in forma di riga.
5. **«Richiedono attenzione»** — nessun allenamento *completato* da 5 giorni o più. Una
   condizione sola, di proposito: è l'unica a cui la risposta è sempre la stessa, una
   telefonata. Massimo quattro nomi (`MASSIMO_FERMI_IN_HOME`): oltre, smette di essere una
   chiamata all'azione e diventa una lista, e una lista non si chiama.
6. **Copertura 3 giorni** — quanti atleti hanno almeno un allenamento assegnato da oggi a
   fra due giorni. Non è vanità: è l'unico numero della Home che dice «devi programmare adesso».
7. **Allenamenti scaduti** — in fondo, in forma di lista: è lavoro da smaltire, non un
   allarme. Accanto all'atleta fermo si mescolavano due problemi di segno opposto.

**La Live Coach Cam** resta una barra sopra l'eroe, non una sezione con un titolo: dura
quanto un allenamento, e per 23 ore al giorno quel titolo stava sopra il vuoto.

### 🔴 «Manda promemoria» NON è stato implementato, ed è una scelta obbligata
L'artboard mette un bottone «Manda promemoria» nella card degli atleti fermi. **Non c'è
nessun modo di farlo funzionare dal client**, e vale la pena scriverlo perché sembra una
dimenticanza:
- la policy RLS di `notifications` è `auth.uid() = user_id`, quindi il coach **non può
  inserire una notifica per un altro utente** (§4-bis: è una delle policy scritte bene);
- `send-reminders` non ha una modalità «promemoria a QUESTO atleta»: `immediate` manda
  «Nuovo Allenamento!», che è un altro messaggio. Aggiungerla è un **deploy** di una
  funzione **condivisa con la web app in produzione** (§1.1), non una modifica di UI.

Al suo posto la **riga intera è il bersaglio** e apre la scheda dell'atleta. È anche più
corretto del design: con più nomi elencati, un «Apri» in fondo alla card non dice quale
atleta apre. La voce sta in BACKLOG.

### ⚠️ Il ramo atleta NON si vede più dalla Home coach (28/08/2026)
Fino al 28/08 il ramo atleta era renderizzato per `role === 'athlete' || role === 'admin'`:
in fondo alla Home coach comparivano quindi l'**allenamento di oggi** (o «Giorno di rest»),
l'**anello della settimana**, **Serie** e **Volume · RPE**. Erano i numeri di *una* persona
in una pagina che parla di dodici, e per il coach dicevano sempre rest — il suo account è
escluso da chi si segue (`COACHING_ID`), quindi non ha allenamenti propri. Il bento
compariva **sempre**, anche senza un dato: `weeklyStatus` nasce già con sette giorni, quindi
`weeklyStatus.length > 0` era vero al primo render.
Ora il ramo atleta è `role === 'athlete'` e basta, **e con esso non parte più la query sullo
storico personale** (due `select` in meno a ogni apertura della Home coach). Chi vuole quella
vista passa da **Impostazioni → «Anteprima come atleta»**, che mette `adminRoleOverride` e
rende la Home atleta intera.
Insieme è uscita la riga **«Profilo»**: era l'unico collegamento a `/profile` per l'admin, e
resta raggiungibile dalla stessa anteprima, dove la navbar ne ha la voce.
✅ **E dal 28/08/2026 nemmeno la testata** (chiuso il giorno stesso). Il corpo era stato
separato, il ramo della **testata** no: guardava anch'esso `role === 'athlete' || role ===
'admin'`, quindi sopra una pagina che parla di dodici persone il coach leggeva il saluto
dell'atleta — «Buongiorno, Federico», la settimana ISO e la frase motivazionale del giorno.
`HeaderCoach` («ven 28 agosto · 9 atleti · 2 in pausa» + «FLEOFIT Coach») **esisteva già ed
era codice irraggiungibile**: l'unico ruolo che lo apriva era `'coach'`, che l'onboarding non
assegna (`App.jsx`). Ora la regola della testata è la stessa del corpo — `role === 'athlete'`
di qua, tutti gli altri di là — ed è la testata dell'artboard `Home Coach.dc.html` 2b.
⚠️ È anche la ragione per cui i **test storici** di questa sezione montano `'coach'` e non si
erano accorti di niente: i tre test nuovi montano `'admin'`, l'unico ruolo che esiste davvero.
Il numero di atleti è `atletiCoach.length`, che **esclude già `COACHING_ID`** (il filtro sta
nel fetch): è quello della rubrica, non uno più grande. Chi è in pausa **resta nel totale** e
si dichiara a parte, altrimenti i numeri delle sezioni sotto — che la pausa la escludono —
sembrerebbero sbagliati.

### Cosa è uscito
Le card **«Calendario»** e **«Atleti»**: sono già due voci della navbar coach (verificato in
`Navbar.jsx`), e vale il corollario della Regola dell'Eroe Unico applicato all'atleta il 26/08.
L'**archivio resta**, come riga sotto la CTA: è materiale di lavoro del coach, non una
destinazione duplicata. Il **Profilo** resta anch'esso come riga, ma **solo per `admin`**:
è l'unico ruolo che non ha quella voce in navbar. Resta una sola superficie gialla piena in
pagina, «Crea workout», come da Regola del Tratto Unico.

### Una query sola al posto di cinque
`Home.jsx` carica ora `athletes` (righe, non solo il conteggio) e **un unico** `athlete_workouts`
sulla finestra `[oggi − 45 giorni, oggi + 2]`, con i join su `athletes` e `workouts`. Fermi,
scaduti, copertura, feedback e squadra della giornata sono tutti `useMemo` su quelle due liste:
cinque `select` sullo stesso intervallo sarebbero stati cinque round trip per gli stessi dati.

### ⚠️ Le cinque trappole di questo codice
1. **`athlete_workouts` non ha `created_at`.** Quindi «feedback nuovo» **non può** voler dire
   «arrivato dopo il tuo ultimo accesso»: vuol dire «che non hai ancora aperto», e l'elenco
   degli id già letti sta in `localStorage.fleofit_feedback_visti_<uid>`. Conseguenza da
   conoscere prima di dire che è un bug: **il "letto" è per dispositivo, non per account**.
   L'alternativa richiederebbe una colonna, e lo schema è congelato (regola 0-bis).
2. **L'elenco dei già letti si legge in un `useMemo`, non in un `useEffect` con `setState`.**
   Non è stile: con l'effetto, scrivere i letti farebbe sparire la lista **sotto le dita del
   coach** nello stesso istante in cui la apre. Così il valore si rilegge solo quando cambiano
   i dati, cioè al prossimo caricamento — che è quando il contatore deve scendere.
3. **`voice_note_url` è UNA colonna per una comunicazione bidirezionale** (CLAUDE.md §4): non
   esiste modo di sapere se l'ha registrata l'atleta o il coach. Si contano perciò solo le
   assegnazioni **completate**, dove la nota accompagna il completamento. È un'approssimazione
   voluta, non una svista.
4. **Aprire un feedback segna letto SOLO quello.** Fino alla revisione il gesto era «apro la
   lista, li leggo tutti», perché la lista era chiusa e il numero era l'unica cosa visibile.
   Ora le citazioni sono in pagina: azzerare l'arretrato al primo tocco cancellerebbe tre
   feedback che il coach non ha ancora guardato. C'è un test che lo prende.
5. **«In corso» viene dalla presenza Realtime, non dal database.** `athlete_workouts` non ha
   uno stato «iniziato»: l'unica fonte che distingua «non ha ancora finito» da «lo sta facendo
   adesso» è il canale `global_live_workouts` della Live Coach Cam. La presenza è indicizzata
   per `athleteWorkoutId` (è la chiave con cui `WorkoutDetail` fa `track`), quindi l'`athlete_id`
   si ricava dall'assegnazione già caricata — nessuna query in più, nessuna modifica a
   `WorkoutDetail`. Conseguenza voluta: **gli atleti che corrono non compaiono mai «in corso»**,
   perché la corsa non ha il timer guidato e quindi non traccia presenza (§7).

### 🔴 Il difetto che il filtro dell'account coach nascondeva
`stats.athletes` contava `athletes` **senza escludere `COACHING_ID`**, mentre `Athletes.jsx` lo
esclude da sempre: la vecchia card «Atleti» diceva quindi un numero diverso da quello della
rubrica. Innocuo finché era solo un'etichetta; con l'eroe non lo è più — il coach sarebbe
comparso **fra i propri atleti fermi** ogni volta che non si allena, e avrebbe falsato anche la
copertura. Ora il filtro è nella Home, ed è coperto da un test.

### Il codice morto che il rework ha lasciato indietro, e che è stato rimosso
`attivitaRecente` (in `statisticheCoach.js`) e i componenti `CellaFeedback`, `CellaCopertura`,
`EsitoAttivita`, `VuotoSezione` (in `HomeCoachUI.jsx`) non avevano più chiamanti dopo la
revisione: sono stati cancellati insieme ai loro test, invece di restare come terza copia di
qualcosa che nessuno chiama (§9 punto 2). `HeroAttenzione`/`HeroTuttiAttivi` sono diventati
`SezioneAttenzione`/`TuttiAttivi`: **il nome dice il rango**, e chiamare «Hero» qualcosa che
sta sotto la CTA è il modo in cui il prossimo lettore rimette l'ordine sbagliato.

---

## 9-decies. «Atleta in pausa» (27/08/2026)

Richiesta del committente: un atleta che avvisa di volersi fermare non deve più comparire fra
quelli che **richiedono attenzione** nella Home coach, ma deve restare nella rubrica con tutto
il suo storico.

### 🔴 Perché NON è una colonna, e cosa comporta
`athletes.is_paused` sarebbe una migrazione, e **lo schema è congelato** fino all'approvazione
su App Store (regola 0-bis): il database è uno solo e serve anche la web app in produzione,
senza staging. Lo stato vive quindi dentro `athletes.notes` — la nota che il coach scrive
per l'atleta — nel
prefisso `[PAUSA: yyyy-MM-dd]`, con **lo stesso meccanismo già usato per l'RPE** dentro
`athlete_workouts.notes` (§4). Tutto passa da `src/lib/pausa.js`.

Le tre conseguenze da conoscere **prima** di dire che è un bug:
1. **La web app su `main` non conosce il marcatore.** Se il coach modifica la nota da
   lì, il prefisso può sparire e l'atleta torna fra quelli da chiamare. È lo stesso rischio
   dell'RPE (§1.1), ma si comporta meglio: il guasto è **visibile** — l'atleta ricompare — e si
   ripara con un tocco. Non perde dati.
2. **Chiunque scriva `athletes.notes` deve passare da `formatNotePausa`.** La modale «Modifica
   profilo» faceva `.update({ notes: form.notes })` con il testo grezzo: senza il round-trip,
   ogni «Salva» avrebbe cancellato la pausa **in silenzio**. C'è un test che lo prende.
3. **Il marcatore vale SOLO in testa alla nota.** Altrimenti bastava che il coach scrivesse
   «ne parliamo, magari [PAUSA] a settembre» perché un atleta sparisse dagli allarmi senza che
   nessuno l'avesse deciso.

### Dove la pausa ha effetto, e dove no
| Superficie | Effetto | Perché |
|---|---|---|
| Home → **Richiedono attenzione** | esce | è la richiesta |
| Home → **denominatore dell'eroe** e **Copertura 3 gg** | esce dal totale | «2 di 7» quando due dei nove si sono fermati. Contarlo fra i «senza allenamento» vorrebbe dire chiedere al coach di programmare per chi ha chiesto di fermarsi |
| Home → **Allenamenti scaduti** | esce | uno scaduto di chi è in pausa non è lavoro da smaltire: è la conseguenza attesa. Resta visibile nella sua scheda |
| Home → **header** | «9 atleti · 2 in pausa» | senza, i numeri sotto contraddicono la rubrica e sembrano sbagliati |
| Home → **Attività oggi e ieri** | **resta** | è consultazione di ciò che è successo davvero. Se un atleta in pausa si allena, il coach deve vederlo — ed è il segnale per riattivarlo |
| **Atleti** (rubrica) | resta, con la pillola «In pausa» | è la lista in cui deve restare, ed è l'unico posto dove il coach si accorge di averne messo in pausa uno e dimenticato |

`atletiFermi`, `allenamentiScaduti` e `copertura` applicano il filtro **da sé** invece di
aspettarsi una lista già ripulita dal chiamante: sono le funzioni che producono un allarme e un
totale, e chi si dimentica il filtro non ottiene un errore — ottiene una telefonata a chi aveva
chiesto di non essere chiamato.

### ⚠️ Due dettagli di interfaccia che non sono estetica
- **La conferma c'è solo per METTERE in pausa, non per toglierla.** Mettere in pausa spegne un
  allarme, e uno spegnimento per errore non si nota. Toglierla riaccende, e un allarme di troppo
  si vede da solo.
- **La pillola «In pausa» è nascosta all'atleta.** `AthleteDetail` è anche `/profile`, cioè la
  scheda che l'atleta vede di sé: la pausa è uno stato interno della programmazione del coach, e
  mostrarla lì vorrebbe dire comunicare «ti ho messo in disparte» con una pillola arancione
  invece che parlandoci.

> ⚠️ **`athletes.notes` è VISIBILE all'atleta, ed è giusto così.** Confermato dal committente il
> 27/08/2026: è una nota che il coach scrive *per* l'atleta, non su di lui, e `AthleteDetail` la
> rende senza guardia di ruolo di proposito. Chi legge «note private» in una vecchia versione di
> questo documento non lo prenda per un difetto da correggere.
> Due conseguenze per la pausa, entrambe già gestite:
> - il marcatore **non si vede mai** — né nella scheda né nel campo della modale di modifica —
>   perché ovunque si mostra `parseNotePausa(...).testo` e mai il valore grezzo;
> - **anche l'atleta può salvare quella nota** (il bottone «Modifica» su `/profile` non è
>   riservato al coach), e il round-trip di `formatNotePausa` nella modale vale per entrambi i
>   ruoli: salvare il proprio profilo **non** annulla la pausa. C'è un test.
>
> Resta vero che il valore grezzo è raggiungibile dall'atleta per altre vie (l'export JSON, una
> chiamata all'API): il marcatore nasconde lo stato dall'interfaccia, non lo cifra.

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

## 9-undecies. Il rework di «Crea Workout» (27/08/2026)

Nasce dallo stesso progetto Claude Design delle due Home
(`4a238081-a3ee-4f59-ae34-100f29d55601`), artboard `Crea Workout.dc.html`.
Come per le Home, la logica di `CreateWorkout.jsx` non è stata riscritta: sono
cambiati il JSX dei due passi, il modo di inserire i numeri, e i dati che il
builder mostra di sé.

### Il problema, in una riga
Il builder funzionava ma era **cieco**: si aggiungevano blocchi senza sapere
quanto dura l'allenamento, quanti blocchi sono, quanto pesano. La lista era
piatta — riscaldamento, lavoro centrale e chiusura avevano lo stesso peso visivo
— e «Salva» stava in fondo a uno scroll che **cresce con il workout**, quindi si
allontanava man mano che il coach lavorava.

### Cosa c'è ora
1. **Lo step 1 fa una domanda sola.** La categoria è tre card con nome, colore di
   corsia e una riga che dice cosa aspettarsi, non tre segmenti stretti. Nome e
   data scendono **sotto** la scelta: si compilano una volta e si dimenticano.
2. **Il riepilogo in cima allo step 2** — durata stimata, numero di blocchi, RPE
   atteso — e sotto una barra proporzionale che mostra come la durata è
   distribuita, con il blocco di lavoro in ambra.
3. **I blocchi** prendono una spina verticale a sinistra (colori di `TYPE_COLORS`,
   gerarchia fatta dallo spessore) e la durata in testa alla riga. Il blocco
   aperto è l'unico con bordo e spina in ambra.
4. **«Salva» è una barra fissa in basso**, la stessa per i due passi e per le tre
   categorie. Sopra, **«Genera con IA»** è una card piena a tutta larghezza e
   «Aggiungi blocco» il gesto tranquillo sotto di essa.
5. **Le rotelle dei numeri sono sparite** dal flusso Hyrox: al loro posto il
   valore grande, meno e più ai lati, i valori d'uso comune a portata di pollice
   e «Digita» per il valore esatto. In più la riga **«ultima volta»**, che
   ripropone i valori dell'ultima assegnazione dello stesso esercizio.

### ⚠️ Le sette trappole di questo codice
1. **La durata è una STIMA, e deve dirlo.** `src/lib/stimaWorkout.js` sa
   esattamente quanto dura un EMOM o un ON/OFF, ma «For Time», «Interval»,
   «Cash In» e «Cash Out» **non hanno una durata**: sono cronometri liberi, il
   tempo lo fa l'atleta. Lì si stima dagli esercizi con tre costanti dichiarate
   in cima al file. Nessun'altra superficie deve trattare quel numero come un
   dato vero.
2. **Un blocco stimabile a zero mostra «—», non «0:00».** Un Cash In senza
   esercizi non dura zero: semplicemente non si può ancora stimare, e «0:00» è
   una bugia con l'aria di un dato.
3. **`rpeAtteso` torna `null`, non 5.** È la stessa lezione di `rpeDichiarato()`
   in `src/lib/rpe.js` (§9-octies): un ripiego travestito da misura è peggio di
   un trattino, perché il coach lo legge come un dato. Ed è **pesato sulla
   durata**, non sul numero di esercizi — venti minuti a 9 e due a 3 non fanno 6.
   Il peso vale su **due livelli**: la durata stimata del blocco, distribuita fra
   i suoi esercizi in proporzione a quanto durano. Mille metri di ski sono quattro
   minuti e dieci burpees mezzo: con il peso piatto quel blocco leggerebbe 7,5,
   che è il valore di un lavoro che lì dentro nessuno fa.
   🔴 **E NON è una media aritmetica, dal 31/08/2026.** Segnalato dal committente
   guardando la scheda: una media sottostima *sempre* uno sforzo variabile, e
   quasi ogni workout apre con un Cash In a bassa intensità. Quindici minuti a 3
   davanti a dieci minuti a 10 davano **5,8** — e in quel workout non esiste un
   solo minuto a 5,8. La scheda dichiarava un allenamento più leggero di quello
   che sarebbe stato, che è il difetto peggiore possibile per un numero che il
   coach usa per dosare il carico.
   Ora è una **media di potenza** di ordine `ESPONENTE_SFORZO = 3`:

       RPE = ( Σ dᵢ·rᵢ³ / Σ dᵢ ) ^ (1/3)

   cioè lo stesso rimedio per cui nel ciclismo esiste la *Normalized Power* al
   posto della potenza media. Sul caso sopra torna 7,5.
   **Le tre proprietà da non perdere** se un giorno la si tocca, ognuna con il
   suo test:
   - **non è mai sotto la media aritmetica né sopra il massimo dichiarato**, e su
     un workout a intensità uniforme torna *esattamente* quel valore — i workout
     già corretti non cambiano di un decimo, e trenta secondi a 10 in fondo a un
     quarto d'ora tranquillo alzano il numero da 3,2 a 3,9, non a 10 (è la
     ragione per cui non si usa il massimo);
   - **non richiede di sapere quali tipi di blocco «contano»**. Escludere Cash In
     per etichetta era l'altra strada, ed è sbagliata: in Hyrox un Cash In fatto
     duro esiste, e a decidere dev'essere l'intensità che il coach ha dichiarato.
     WarmUp e Rest, del resto, *già* non pesano — non hanno esercizi con
     un'intensità dichiarata, e il ciclo li salta;
   - **è continua e monotona**: nessuna soglia che fa saltare il numero quando si
     sposta un round.
   ⚠️ **3 e non il 4 di Coggan**: quello è calibrato sui **watt**, una grandezza
   fisica. L'RPE è già una scala percettiva compressa, quindi 4 sovracorregge —
   una seduta con metà lavoro davvero facile si leggerebbe quasi massimale.
   ⚠️ Resta vero che è una **stima** (punto 1), e che l'etichetta «RPE atteso»
   non ha mai promesso una media: non serve cambiarla.
4. **L'«Intensità dichiarata» NON è l'«RPE atteso»**, e l'artboard non la mostra.
   È rimasta lo stesso: finisce in `workouts.sections.intensity`, e la scheda, il
   PDF e la story la leggono. Toglierla dall'interfaccia vorrebbe dire perdere un
   campo che il coach controlla e che tre superfici mostrano.
5. **Nome e data vivono SOLO nello step 1.** Il ritorno è la testata dello step 2,
   che è un bottone (`aria-label="Modifica nome e data"`). Senza quel ritorno un
   workout aperto in modifica — che parte già al passo 2 — non sarebbe più
   rinominabile. C'è un test che lo prende.
6. **La didascalia del blocco sta sulla SECONDA riga.** Su 393px, accanto al nome,
   alla durata e a quattro azioni, «Blocco di apertura» finiva troncata a «Blocco
   di apert…» — ed è la risposta al rilievo **3.2.1(viii)** di Apple (§9-ter), non
   un ornamento. Sulla seconda riga ci sta intera, ed è la prima cosa scritta,
   quindi l'ultima a cedere se la riga trabocca.
7. **La barra fissa ha un offset, non `bottom-0`.** La navbar è `fixed` a z-50: con
   `bottom-0` la barra finirebbe **sotto** di essa. ⚠️ Dal 28/08 l'offset non è più un
   numero scritto lì: è `bottom-[var(--altezza-navbar)]`, e il numero vive in
   `src/index.css` (§6). Chi cambia la forma della navbar cambia quello, non i
   chiamanti.
8. **La barra sparisce mentre si scrive**, e non è una scelta estetica.
   `Keyboard.resize` vale `'native'` (capacitor.config.ts), quindi con la
   tastiera aperta **la webview si rimpicciolisce**: qualunque cosa ancorata in
   basso si ritrova incollata sopra la tastiera, e a schermo sembra «salita in
   cima» — è il fondo che si è alzato. Non c'è modo di tenerla ferma dov'era,
   quel punto dello schermo mentre si digita non esiste. La navbar fa lo stesso
   da sempre, e dal 27/08 le due condividono `src/useTastiera.js`.
9. **Aggiungere un blocco CHIUDE quello aperto prima**, quindi la pagina si
   accorcia di colpo e il blocco nuovo — che sta in fondo alla lista — esce
   dallo schermo: il coach lo crea e non lo vede. Lo risolve `bloccoDaMostrare`,
   un **ref** (non uno stato: non è mai letto durante il render) letto da un
   effetto su `blocks`. ⚠️ Lo scorrimento passa da `requestAnimationFrame`, che
   **non scatta in una scheda non visibile**: nei test va atteso con due frame,
   o un `expect(...).not.toHaveBeenCalled()` passa senza verificare niente.
10. **«Genera con IA» sta SOPRA la lista dei blocchi**, non sotto come
   nell'artboard. Alla prova sul dispositivo, con cinque blocchi aperti, non la
   trovava più nessuno: è il modo di *partire* da zero, quindi cresce di
   distanza proprio mentre diventa inutile. «Aggiungi blocco» resta sotto.
11. **Il campo di ricerca degli esercizi NON prende il fuoco all'apertura.**
   L'`autoFocus` faceva salire la tastiera su una lista di centotrenta voci,
   coprendo proprio quello che si era venuti a guardare. Chi vuole scrivere
   tocca il campo.

### ⚠️ Il passo NON usa lo Stepper, e ci sono voluti tre tentativi
Lo Stepper funziona su ripetizioni, chili, metri e tempi perché lì il «più uno»
vuol dire qualcosa. Sul **passo** no. I due tentativi caduti, con la loro ragione:

1. **Stepper con cinque valori rapidi.** `ERGO_PACE_OPTIONS` mette in fila `Z3`,
   `All out` e `2:05 /500m`, che non stanno sulla stessa retta: cinque valori su
   ottantacinque nascondevano gli altri ottanta, e il più/meno attraversava
   categorie senza rapporto fra loro.
2. **Un elenco intero a schermo pieno.** Mostrava tutto, ma per spostare un passo
   di cinque secondi chiedeva di aprire una schermata, cercare in una griglia di
   sessantuno pillole e tornare indietro. Corretto e faticoso.

**La lezione**: la scelta ha **due** domande, non una. Prima *di che tipo* di
passo si parla — a sensazione, ritmo, cadenza — e lì le voci sono poche e vanno
viste tutte insieme. Poi *quale valore*, e lì è una scala fitta e ordinata su cui
si aggiusta per gradi rispetto a quello che c'è già.

Quindi (27/08/2026, su indicazione del committente): un **segmento** per il
genere, e per il valore una **ruota orizzontale** — precedente a sinistra,
successivo a destra, scelto grande al centro. Dentro un genere la rotella è lo
strumento giusto; è quando le si chiede di attraversare una tassonomia che
diventa cieca, ed è tutta la differenza con lo `ScrollPicker` che ha sostituito.

Dettagli di `RuotaValori` che non sono rifinitura:
- **Ogni voce è anche un bottone.** Senza, il valore sarebbe raggiungibile solo
  trascinando: né da tastiera né da VoiceOver. `role="option"` +
  `aria-selected` dicono qual è la scelta a chi non vede la dimensione.
- **La misura viene dal genere, non dalla voce.** «2:15» sta in settantotto punti
  a venticinque, «Gara Singola» no. Se la dimensione la decidesse la singola
  voce, le voci ballerebbero mentre si scorre.
- **La sfumatura ai bordi.** Le voci a distanza 2 sono tagliate a metà cifra, e
  una cifra tranciata si legge come un difetto invece che come «la scala
  continua».
- **`—` sta in testa a OGNI genere.** Il passo è facoltativo: se il modo di non
  indicarlo vivesse in un genere solo, chi guarda «Ritmo» dovrebbe cambiare
  scheda per cancellarlo.
- ⚠️ **La barra di posizione non è decorativa** su una ruota da sessantuno voci:
  senza, non si sa se si è all'inizio o alla fine della scala.
- ⚠️ I generi sono **derivati** dalle costanti con dei `filter`, non ricopiati.
  L'etichetta perde il suffisso perché lo dice l'intestazione del genere, ma il
  valore scelto resta **intero** (`2:00 /500m`). C'è un test che lo prende:
  scrivere l'etichetta accorciata in `workouts.sections` non darebbe **nessun**
  errore, darebbe una scheda che la web app legge storta.

### Il vocabolario dei dati NON è cambiato
Gli Stepper scrivono le stesse identiche stringhe delle rotelle — `"20"`,
`"9 kg"`, `"500m"`, `"1:00"`, `"Z2"` — perché il meno e il più si muovono
**dentro le liste esistenti** (`REPS_OPTIONS`, `KG_OPTIONS`, `TIME_OPTIONS`…),
non su un numero. È `passoInLista()`, e la ragione è che quei valori finiscono
in `workouts.sections` su un database **condiviso con la web app in produzione**
(§1.1): un formato nuovo lì dentro non darebbe alcun errore, darebbe una scheda
che l'altra app legge storta. C'è un test che monta il builder vero e verifica la
stringa che finisce nel blocco.

### Cosa NON è stato ridisegnato, e perché
L'artboard copre lo **step 1** (tutte e tre le categorie) e lo **step 2 Hyrox**.
Il corpo dello step 2 **Corsa** e quello **Custom** hanno preso la cornice
condivisa — testata, card, barra fissa — ma non il modo di comporre le fasi:
`RunningStepPicker` usa ancora `ScrollPicker`, e quello schermo è esplicitamente
il prossimo pezzo di design («fammi vedere lo step 2 della corsa», in fondo
all'artboard). `ScrollPicker` resta quindi vivo e usato, non è codice morto.

### «Ultima volta»: una lettura, e nessuna colonna
`athlete_workouts` e `workouts` non hanno un indice per esercizio, e **lo schema è
congelato** (regola 0-bis). La riga si costruisce con una sola `select` sugli
ultimi `STORICO_WORKOUT = 40` workout per data, scandagliando il jsonb lato
client al montaggio di `ExercisePicker`. Se fallisce non succede niente: la riga
non compare, e l'errore finisce nei log invece che in un `catch` muto (§9-quater).

---

## 9-duodecies. Il rework della scheda del workout (28/08/2026)

Stesso progetto Claude Design delle Home e del builder
(`4a238081-a3ee-4f59-ae34-100f29d55601`), artboard `Workout Detail.dc.html`,
opzioni **4b** (coach) e **4c** (atleta, allenamento fatto). Come per gli altri
tre schermi la logica di `WorkoutDetail.jsx` non è stata riscritta: sono
cambiati il JSX della pagina, l'ordine in cui le cose stanno, e ciò che la
scheda dice di sé. Nessun campo di Supabase cambia forma.

### Il problema, in una riga
La pagina apriva con il logo FLEOFIT, poi il titolo, poi **cinque bottoncini in
fila** (TV, Cardio, Duplica, Modifica, Elimina) e un avviso arancione alto
quanto una card: l'azione che conta — avviare l'allenamento — arrivava dopo
tutto questo. Non si è mai saputo quanto dura un workout né quanti blocchi
sono. In fondo, quattro bottoni dello stesso peso e uno **schermo intero** di
anteprima dello sticker Instagram.

### Cosa c'è ora, nell'ordine in cui sta in pagina
1. **La testata** con due sole icone, e sono due **stati**: TV e cardio si
   accendono e si spengono *durante* l'allenamento. Tutto il resto — Duplica,
   Modifica, i tre export, Elimina — è nel menu delle tre puntine, che è un
   bottom sheet come il centro notifiche.
2. **Il titolo**, con la corsia di categoria, la data e l'intensità dichiarata
   come sovrascritta. Il logo è sparito: in una pagina di dettaglio non dice niente.
3. **L'esito**, solo per l'atleta che ha già finito. È la risposta alla domanda
   per cui si riapre la scheda di ieri, e prima era un bottone verde — cioè uno
   stato travestito da comando.
4. **Il riepilogo**: durata, blocchi, RPE. È **lo stesso componente** dello step 2
   del builder (`RiepilogoWorkout` di `CreaWorkoutUI`), barra proporzionale compresa.
5. **L'avviso sul riscaldamento**, con il testo **intero** (vedi sotto).
6. **I blocchi**, con la spina verticale di `TYPE_COLORS` e la durata in testa alla
   riga, come nel builder. Gli esercizi sono righe con nome, specifiche in
   monospazio e intensità in coda, non più testo che scorre.
7. Note del coach, vocale, note dell'atleta.
8. **L'elenco delle assegnazioni** (coach), che erano N card con N ombre.
9. **La barra fissa in basso**, che non dipende più da quanto è lunga la lista.

### ⚠️ Le sette cose da sapere prima di rimetterci mano
1. **La grafica Instagram deve restare RENDERIZZATA.** Esce dalla pagina, ma non
   si spegne: `html-to-image` clona un nodo vero, e con `display:none` o
   `opacity:0` l'export produce un'immagine **vuota**, senza un errore da nessuna
   parte. Si porta fuori schermo (`position:fixed; left:-10000px`), che è l'unico
   modo di nasconderla senza spegnerla. C'è un test che usa `toBeVisible`, ed è
   l'unica asserzione che cade su quella mutazione.
2. **La terza cella del riepilogo cambia significato.** Nel builder è l'**RPE
   atteso** — la stima del coach. Su un allenamento chiuso è l'**RPE dichiarato**
   dall'atleta. Sono due misure diverse, e sotto la stessa etichetta sarebbero la
   bugia peggiore della pagina: per questo `RiepilogoWorkout` ha `terzaCella`, che
   non è un'opzione di stile.
3. **Quel valore viene da `rpeDichiarato`, non da `parseNotesAndRpe`.**
   `parseNotesAndRpe` torna **5** quando il marcatore manca: è il valore giusto per
   il cursore della modale ed è un numero inventato per chiunque lo mostri come un
   dato. `athleteNote.dichiarato` porta il valore vero, o `null` → «—».
   È la stessa lezione di §9-octies.
4. **Il riepilogo non compare su Corsa, Custom ed Evento**, che non hanno blocchi
   da stimare: «0 min · 0 blocchi» sarebbe una bugia con l'aria di un dato — la
   stessa ragione per cui `DurataBlocco` scrive «—» invece di «0:00».
5. **I blocchi nascono APERTI**, e si tiene l'elenco dei *chiusi*. La scheda si
   legge mentre ci si allena: un esercizio dietro un tocco è un esercizio che si
   salta. WarmUp e Rest non si aprono affatto — non hanno niente dentro.
6. **La barra fissa ha l'offset della navbar**, non `bottom-0`: è `BarraAzioni` di
   `CreaWorkoutUI`, quindi vale la stessa nota di §9-undecies punto 7, e sparisce
   con la tastiera aperta per la stessa ragione (punto 8).
7. **`voice_note_url` è UNA colonna per una comunicazione bidirezionale**
   (§9-nonies punto 3): il verso lo dà il **ruolo di chi guarda**, non il dato.
   Il coach legge «Vocale per Marco», l'atleta «Vocale del coach».

### La riga sotto il nome del blocco è cambiata di forma, non di contenuto
`getBlockTitle` impacchettava nome, parametri e durata in una stringa sola
(«EMOM · 1:00 min x 24 rounds · 24 min») che a 393px andava a capo due volte.
Ora: il nome in testa, la didascalia di `BLOCK_HINT` accanto, la **durata a
destra** (da `durataBlocco` di `stimaWorkout`, la stessa del builder) e i soli
parametri nella seconda riga, in `src/lib/rigaBlocco.js`.
⚠️ I ripieghi di `sottotitoloBlocco` sono **gli stessi** di `durataBlocco` e di
`BlockPickerModal`: se qui si scrivesse «10 round» dove il timer ne conta 3, la
scheda mentirebbe senza dare nessun errore. C'è un test per ognuno.
`getBlockTitle` **resta**: la usano ancora il PDF e la story Instagram.

### 🔴 L'avviso sul riscaldamento: il TESTO non si tocca, la forma sì
La prima stesura del redesign lo aveva ridotto a una riga — «5-10 min di
mobilità prima di partire. Mai a freddo.» — con la logica che una card si salta
e una riga si legge. **Il committente lo ha rimesso per intero lo stesso
giorno**, e ha ragione: è l'unico avviso di sicurezza dell'app, e il riassunto
buttava via proprio la parte che spiega il *perché* (la gradualità, la
prevenzione degli infortuni). Il testo è quello, parola per parola, e c'è un
test che lo verifica intero.

Quello che è cambiato è la forma. Non più un rettangolo arancione piatto largo
quanto un blocco di lavoro, ma una carta sollevata con la sua luce, il titolo in
ambra calda e il corpo in grigio: il peso visivo di una **nota**, non di un
allarme. Un avviso che urla quanto il contenuto è un avviso che si impara a
saltare — ed era il difetto vero, non la lunghezza.

⚠️ Resta nascosto su **Evento** e **Custom**, com'era prima del redesign: la
regola è `type !== 'Event' && type !== 'Custom'` in `WorkoutDetail`, non dentro
il componente. Se un giorno lo si vuole ovunque, si cambia lì.

### 🔴 Il menu delle tre puntine: tre difetti che nessun errore segnalava
Segnalati dal committente il 28/08 provandolo sul telefono. Valgono per
**qualunque** bottom sheet futuro, e per questo il meccanismo sta in
`src/useBottomSheet.js` invece che dentro il componente.

1. **Non si apriva con un'animazione**, perché la classe che avrebbe dovuto
   farlo — `animate-in slide-in-from-bottom` — viene da **tw-animate-css, che
   non è installato**: genera zero CSS. È la trappola già annotata in
   `src/index.css` per l'eroe della Home, e si era ripresentata identica.
   Ora è il keyframe `.sheet-in`.
   ⚠️ **Non è un caso isolato**: quelle classi compaiono in **54 punti su 14
   file**, cioè quasi ogni modale del progetto crede di avere un'entrata e non
   ce l'ha. Verifica: `grep -c "animate-in" dist/assets/*.css` → **0**.
   Vedi BACKLOG #34 per le due strade possibili.
2. **La maniglia non faceva niente.** Era uno `span` decorativo. È il gesto che
   chiunque prova per primo su un foglio iOS. Ora è un `<button>` che si
   trascina (oltre `SOGLIA_CHIUSURA = 100` px chiude, sotto torna su) e che
   chiude anche a tocco secco.
3. **La pagina sotto continuava a scorrere.** ⚠️ Il blocco è
   `position: fixed` sul body, **non** `overflow: hidden`: su iOS il secondo
   non ferma il WKWebView. Il prezzo è che `position: fixed` azzera lo
   scorrimento, quindi la posizione va memorizzata e rimessa alla chiusura — o
   chiudendo il menu si torna in cima alla scheda. C'è un test per quello.

> ⚠️ **`.sheet-in` non ha `fill`, ed è deliberato.** Un'animazione con
> `fill: both` **vince sullo stile inline**: il foglio resterebbe fermo sotto il
> dito mentre lo si trascina — è lo stesso difetto documentato in §9-octies
> punto 1 sullo swipe della Home. E la classe va **tolta al primo contatto**:
> l'hook tiene uno stato `toccato` apposta. Senza, un trascinamento annullato
> riportava l'offset a 0, la classe tornava sull'elemento e **il foglio rifaceva
> l'animazione di apertura** invece di risalire al suo posto. Trovato scrivendo
> il test, non leggendo il codice.

### La data nell'elenco delle assegnazioni si stampa solo se diversa
Non è brevità. Su 393px, accanto al nome, alla pillola di stato e al cestino,
una data che ripete il titolo della pagina troncava proprio «RPE 8 · nota», che
è l'unica cosa per cui il coach guarda quella lista. Quando invece l'atleta è
programmato in un altro giorno, quello è il dato che conta — e non c'è nessun
altro posto che lo dica.

### Il codice morto che il rework ha lasciato indietro, ed è stato rimosso
`Section` ed `ExList` (in `WorkoutDetail.jsx`) non avevano più chiamanti:
cancellati invece di restare come la terza copia di qualcosa che nessuno chiama
(§9 punto 2). Nella stessa passata i due punti che scrivevano la coda offline con
un `JSON.parse(localStorage.getItem(...))` nudo sono passati ad
`accodaSuStorage`, che si ripara da sola e deduplica per allenamento (regola 0-bis).

### ⚠️ Un test che era verde per il motivo sbagliato
«L'elenco delle assegnazioni non si vede per l'atleta» **non falliva** rompendo
il codice: la guardia sul ruolo esiste in **due** punti — il fetch e il render —
e toglierne uno solo non cambia niente a schermo. Riscritto per verificare il
fetch (`chiamateA('athlete_workouts', 'select')` deve essere **una** sola),
che è anche la cosa che conta davvero: la scheda dell'atleta non deve scaricare
le assegnazioni di tutti gli altri. §9-sexies, di nuovo.

### Cosa NON è stato ridisegnato
Il corpo **Corsa** (`RunningList`), **Custom** ed **Evento** hanno preso la
cornice condivisa — testata, riepilogo saltato, barra fissa — ma non un nuovo
modo di elencare le fasi: l'artboard non li copre, e il `dv-next` dell'artboard
li dà per il prossimo pezzo di design. Non sono stati toccati nemmeno il
**timer** (`WorkoutTimer`), le modali di assegnazione, TV, eliminazione e RPE,
il **PDF** e la **story Instagram**: la scheda è la cornice, quelli sono i
contenuti, e cambiarli era un'altra decisione.

---

## 9-terdecies. Il rework della scheda atleta (28/08/2026)

Stesso progetto Claude Design degli altri quattro schermi
(`4a238081-a3ee-4f59-ae34-100f29d55601`), artboard `Scheda Atleta.dc.html`,
opzioni **5b** (coach) e **5c** (atleta, storico aperto). Come per gli altri
la logica non è stata riscritta: **nessun campo di Supabase cambia forma**,
gli stessi calcoli, le stesse note, lo stesso completamento con RPE. Cambia il
JSX e cambia l'ordine.

### Il problema, in una riga
La pagina apriva con il logo, poi una foto da 96px con quattro celle di
anagrafica, poi tre celle di settimana, poi tre tab — e il dato per cui il
coach entra qui, *sta seguendo il programma e con quanto carico*, era nella
**terza** tab, dietro due tocchi e quattro grafici che non si parlavano.

### Cosa c'è ora, nell'ordine in cui sta in pagina
1. **La testata**, con il solo menu delle tre puntine. ⚠️ Niente «indietro» sul
   proprio profilo: `/profile` è una voce della navbar, non una pagina in cui
   si è entrati da qualche parte. `TestataScheda` accetta perciò un
   `onIndietro` mancante — non è una svista del chiamante.
2. **L'identità**: foto a 56px, nome, i due social come icone da 15px accanto
   al nome, e l'anagrafica in **una riga** («29 anni · 178 cm · 74 kg · 96
   workout»). I campi vuoti spariscono invece di stampare «N/A»: una cella che
   dice «non lo so» occupava lo stesso spazio di una che dice qualcosa.
3. **L'eroe «come sta andando · 30 giorni»**: aderenza nell'anello, carico
   delle ultime quattro settimane accanto, e sotto **una frase** che dice a
   parole cosa dicono i due numeri insieme. È la frase su cui si decide se
   caricare o scaricare, ed è l'unica ragione per cui i due grafici stanno
   nella stessa card invece che uno sotto l'altro.
4. **Il bento**: Volume (minuti della settimana, scarto sulla precedente,
   sparkline a 4 settimane) e Sforzo (RPE medio, distribuzione sulle quattro
   fasce, quanti da 7 in su).
5. **Prossimo obiettivo**, che era un banner alto quanto una card, in una riga.
6. **Oggi**, **Prossimi allenamenti**, poi **Storico** e **Personal record**
   come righe che si aprono in pagina.
7. **La barra fissa** con Assegna e Crea — solo per il coach.

### ⚠️ Le sei cose da sapere prima di rimetterci mano

1. 🔴 **La finestra è la ragione per cui `src/lib/andamento.js` esiste.**
   `calcolaStatistiche` misura le settimane sulle ultime quattro e la
   distribuzione RPE su **tutto lo storico**: due orizzonti diversi sotto
   un'intestazione sola («30 giorni») sarebbero la bugia peggiore della pagina,
   perché **nessuno dei due numeri è sbagliato preso da solo**. `andamento.js`
   ricalcola lo sforzo sulla finestra dichiarata, e c'è un test che lo prende.
2. 🔴 **L'RPE medio viene da `rpeDichiarato`, non da `parseNotesAndRpe`.**
   Il secondo torna **5** quando il marcatore manca — giusto per il cursore
   della modale, un numero inventato per chiunque lo mostri come un dato. Un
   atleta che non compila mai l'RPE leggerebbe «5,0» come la propria media. È
   la stessa lezione di §9-octies e di §9-undecies punto 3.
3. **Il denominatore dell'anello sono gli ASSEGNATI dei 30 giorni**, non i
   workout in pagina. Contare anche quello programmato per dopodomani farebbe
   scendere l'aderenza di ogni atleta ogni volta che il coach gli programma
   qualcosa: un numero che peggiora quando si lavora meglio.
4. **Lo scarto del carico torna `null` quando la settimana prima è vuota.**
   `(5-0)/0` è la strada più breve per stampare «+Infinity%» in pagina, e una
   card che dice Infinity si legge come un guasto dell'app.
5. **«Prossimi allenamenti» NON è nell'artboard, e resta lo stesso.**
   L'artboard disegna una giornata e si ferma a «Oggi». Toglierli vorrebbe dire
   che il coach non vede più cos'ha assegnato senza aprire il calendario, e che
   l'atleta non sa cosa lo aspetta domani. C'è un test.
6. **La pillola «In pausa» resta nascosta all'atleta**, e il marcatore non si
   vede mai come testo: valgono parola per parola le regole di §9-decies. La
   pagina è ancora `/profile`.

### Cosa è uscito, e cosa NON è stato ridisegnato
Le **tre tab** («Diario», «Personal Record», «Statistiche») e le quattro celle
di anagrafica. Nessun dato è andato perso: i quattro grafici della tab
Statistiche sono l'anello, le barre del carico, lo sparkline del volume e la
barra delle fasce RPE. Il **calendario** (solo coach) è dentro «Storico
allenamenti», con il toggle Elenco/Calendario dov'era.

**Non** sono stati ridisegnati `WorkoutEntryCard` e `TodayAthleteWorkoutCard`:
l'artboard disegna righe compatte, ma quelle card portano la modifica della
nota, la nota vocale, l'eliminazione e il completamento con RPE. Sono il
prossimo pezzo di design, non un dettaglio di questo. Idem per le modali
(assegnazione, PR, modifica profilo, allenamento libero).

### Il codice morto che il rework ha lasciato indietro, ed è stato rimosso
`AthleteStatsTab`, `RpeBar` e `StatCard` in `AthleteDetail.jsx`, e
**`statisticheSettimana` in `src/lib/statistiche.js`** con i suoi test: la riga
di tre numeri che alimentava non esiste più, e `settimane.at(-1).time` è
esattamente lo stesso calcolo. Due sorgenti per un numero solo sono il modo in
cui i due si mettono a divergere (§9 punto 1). Il caso che valeva davvero — le
distanze contate come stima e non come minuti — è stato riscritto contro
`calcolaStatistiche`, non buttato.

### ⚠️ `montaPagina` ora accetta una rotta, e serviva
`montaPagina(elemento, { percorso, rotta })`. Senza, `useParams()` torna vuoto,
`AthleteDetail` ricade sull'id dell'utente loggato e **si crede sul proprio
profilo anche montata come coach**: niente barra fissa, niente «Come sta
andando» in terza persona. Un test così passa lo stesso, e verifica un'altra
pagina — §9-sexies, per l'ennesima volta.

---

## 9-quaterdecies. La tab bar dell'artboard 2b (28/08/2026)

### 🔴 I due artboard si contraddicono, e il navbar giusto è quello di 2b
`Home Coach.dc.html` (opzione **2b**) disegna una **capsula galleggiante**.
`Scheda Atleta.dc.html` (5b e 5c) disegna ancora la **barra piena** attaccata al
fondo, perché quell'artboard riusa il navbar precedente come sfondo di scena.
**Vale 2b**: è quello che il committente ha indicato, ed è l'unico dei due
disegnato *come* navbar invece che *sotto* una pagina.

⚠️ Chi apre `Scheda Atleta.dc.html` e confronta il codice con quel navbar
conclude che «corrisponde» ed è già successo: è il motivo per cui questa
sezione dice quale dei due comanda.

| | prima (fino al 28/08) | ora, artboard 2b |
|---|---|---|
| forma | barra piena a `bottom-0`, tutta larghezza | capsula `rounded-full`, `10px 12px 16px` d'aria intorno |
| fondo | `#0f0f11/70`, blur | `rgba(30,30,34,.88)`, blur **22** + saturate **170%**, ombra proiettata |
| voce attiva | pillola dietro icona **ed** etichetta | **cerchio** da 36px dietro la **sola** icona |
| «Workout» | icona `+` | **manubrio** |
| altezza | 64px + safe area | **99px** + safe area |

### 🔴 L'altezza della navbar era in SETTE punti scritti a mano
Ed è la vera conseguenza del cambio di forma, non la forma stessa. Erano:
`pb-16` in `App.jsx`, `pb-[calc(6rem+…)]` in `Home`, `Calendar`, `Athletes`,
`WorkoutsArchive`, `Settings`, e `bottom-[calc(4rem+…)]` in `BarraAzioni`.
Hanno coinciso **per caso** finché la barra è stata alta 4rem. Passando a 99px
sarebbero servite sette modifiche coordinate, e la prima dimenticata avrebbe
nascosto del contenuto sotto la barra **senza dare nessun errore a schermo** —
il difetto che si nota solo quando un utente non riesce a premere l'ultimo
bottone di una pagina.

Ora c'è `--altezza-navbar` in `src/index.css`, più `--fondo-pagina` che le
aggiunge il respiro. **Chi cambia la forma della navbar cambia quel numero, e
basta.** Le tre pagine con la barra fissa (`CreateWorkout`, `WorkoutDetail`,
`AthleteDetail`) usano `pb-[var(--altezza-navbar)]`, le altre cinque
`pb-[var(--fondo-pagina)]`.

⚠️ **Il numero è misurato, non calcolato.** Il primo tentativo diceva 94px
contando l'etichetta come 13px invece della sua riga di testo; misurata, la
barra è 98,75px. Si rimisura con la navbar a schermo:
```js
document.querySelector('nav').parentElement.getBoundingClientRect().height
```

### ⚠️ Tre dettagli che non sono rifinitura
1. **`pointer-events-none` sul contenitore, `auto` sulla capsula.** Il
   contenitore è largo quanto lo schermo, la capsula no: senza, i pixel ai lati
   intercetterebbero i tocchi diretti alla pagina sotto.
2. **Il cerchio dietro l'icona esiste sempre, anche spento.** Se comparisse solo
   sull'attiva, le voci si sposterebbero di 36px a ogni cambio di scheda.
3. **Il manubrio è un SVG locale, non `Dumbbell` di lucide.** Quello di lucide è
   diagonale con i dischi esagonali, e accanto a `Home`, `Calendar` e `Users` —
   tutte forme diritte e sottili — è l'unica icona che non sta sull'orizzontale.
   È la stessa eccezione già fatta per `InstagramIcon`: lucide è la convenzione,
   non un vincolo.

### Cosa NON è stato implementato, e perché
Il **badge numerico** sulla voce «Atleti» (nell'artboard: un `3` giallo). Il
numero non esiste: `Navbar` è renderizzata da `App.jsx` fuori da ogni pagina e
non ha accesso ai dati, e l'unico candidato sensato — gli atleti che richiedono
attenzione — richiederebbe una query su **ogni** pagina dell'app per una
decorazione. Metterci un numero che non significa niente è peggio che non
metterlo: è la stessa regola del `rpeAtteso` che torna `null` invece di 5.
Voce in BACKLOG.

---

## 9-quindecies. Il foglio «Genera con IA» (28/08/2026)

Richiesta del committente, provando il builder sul telefono: la modale dell'IA
era rimasta l'unica superficie di «Crea Workout» con il vocabolario di prima —
card centrata, bordo `#333`, bottone pieno in fondo — in una pagina dove tutto
il resto è carta sollevata, vetro e barra ancorata. Con la grafica sono venuti
fuori altri due difetti, ed **entrambi erano già documentati altrove**.

### Cosa c'è ora
Un **bottom sheet**, lo stesso di `MenuScheda` e del centro notifiche: sale dal
basso, si trascina per la maniglia, e la pagina sotto non scorre. Dentro, la
testata ripete l'icona e la riga della `CardIA` che ha aperto il foglio, poi il
campo di testo, il microfono come **riga intera** e la CTA viola.

### ⚠️ Le tre cose che non sono estetica
1. 🔴 **L'entrata non esisteva.** La classe era `animate-in fade-in
   zoom-in-[0.96] duration-300`, cioè `tw-animate-css`, che **non è
   installato**: zero CSS generato. È la seconda volta che lo stesso difetto si
   presenta — la prima era il menu della scheda (§9-duodecies) — ed è la ragione
   per cui BACKLOG #34 non è una voce cosmetica: ogni modale del progetto crede
   di avere un'entrata e non ce l'ha. Ora è `useBottomSheet`, quindi il keyframe
   `.sheet-in` di `src/index.css`.
2. **La tastiera non sale più da sola.** L'`autoFocus` sul textarea la apriva su
   una superficie il cui gesto principale è il **microfono**: si arrivava qui
   per dettare e si trovava mezzo schermo occupato. Con l'autoFocus se n'è
   andato anche `-translate-y-36`, che era il rimedio a un problema che non
   esiste più: il foglio è ancorato in basso e con `Keyboard.resize: 'native'`
   la webview si rimpicciolisce, quindi resta sopra la tastiera da sé.
3. 🔴 **L'alone del microfono era `Math.random()`.** `1 + Math.random() * 0.4`
   ogni 150ms: pulsava identico a microfono muto, permesso negato o telefono in
   tasca — cioè diceva «ti sento» **proprio quando non era vero**. Ora i livelli
   arrivano dal microfono, con lo stesso `AudioVisualizer` delle note vocali.

### 🔴 La forma d'onda si muoveva in un angolo, e nessuno l'aveva mai misurato
Segnalato dal committente il 28/08 («voglio il waveform o qualcosa che mi faccia
capire che la voce viene letta»), e la causa era in `AudioVisualizer`, cioè
**anche nelle note vocali**, da sempre. Due difetti sovrapposti:

1. **Un terzo delle bande finiva fuori dal canvas.** Il passo era
   `(larghezza / bande) * 1.5`: con 32 bande su 200px la `x` arrivava a 300, e
   le ultime undici non si vedevano. Nessun errore: l'onda sembrava corta.
2. **La voce occupava il primo sesto dello spettro.** L'analizzatore copre metà
   della frequenza di campionamento — con 48 kHz sono **24 kHz** — divisi in
   parti uguali fra le bande. Con `fftSize 64` ogni banda vale 750 Hz, e il
   parlato (80 Hz – 4 kHz) stava tutto nelle **prime quattro barre**: le altre
   ventotto erano piatte comunque si parlasse. Ora `fftSize 256` (bande da
   ~187 Hz) e si disegnano le prime `BANDE_VOCE = 24`, distribuite su **tutta**
   la larghezza. La media per `onLivello` si calcola sulle stesse: mediata su
   24 kHz di silenzio non si sarebbe mossa nemmeno gridando.

3. **Era disegnata a un terzo della densità dello schermo.** Il canvas aveva
   `width` fisso a 200 e veniva stirato dal CSS: su un iPhone 3x è un upscale
   da 200 a oltre 1000 pixel fisici. Ora la risoluzione segue la misura reale
   del box per `devicePixelRatio`, e si rimisura al `resize`.

⚠️ Tutte e tre valgono anche per la forma d'onda **gialla** delle note vocali,
che aveva esattamente lo stesso comportamento. Non è un effetto collaterale: è
lo stesso componente, ed è la ragione per cui è uno solo (§9 punto 1).

### La forma: speculare dal centro, non da sinistra a destra
Terzo giro di rifiniture, sempre del 28/08 («il waveform possiamo farlo
graficamente più carino»). Il punto non era la palette: **l'energia di una voce
decresce con la frequenza, sempre**, quindi disegnata in ordine dà una scala
discendente identica a ogni parola — informativa, ma sembra un grafico. Ora le
prime `BANDE_DISEGNO = 13` bande sono **rispecchiate** attorno alla più bassa
(25 barre), che è la sagoma che si legge come «qualcuno sta parlando» e che si
gonfia e sgonfia con le sillabe. Con lei: barre a pillola con i capi tondi e
minimo un pallino invece di una scheggia da 2px, `smoothingTimeConstant` per
togliere il tremolio, una curva sotto 1 sull'ampiezza (l'orecchio sente in
logaritmico), e un gradiente pieno al centro e sfumato ai bordi.

⚠️ `COMPENSO` alza le bande alte, che sono naturalmente più deboli: senza, le
barre esterne non si muovono mai e la sagoma è una gobba immobile. **Va tenuto
basso**: al primo tentativo era `0.16` e saturava tutto — venticinque barre
tutte al massimo, cioè di nuovo nessuna informazione.

### 🔴 «Non arriva nessun suono»: la riga che distingue funziona da morto
Un'onda ferma si legge come «sto zitto io», **mai** come «il microfono non
riceve». Dopo `SECONDI_MUTO` senza che il livello abbia mai superato la soglia,
il foglio lo dice e indica dove guardare (vicinanza al microfono, permesso iOS).
Senza, ci si accorge del microfono spento **dal workout generato a caso**.
`haSentito` non si azzera durante la dettatura, di proposito: serve a separare
«ora sto zitto» da «non ha mai funzionato», che a schermo sono la stessa
immagine.

#### 🔴 E alla prima prova accusava il microfono mentre lo sentiva
Segnalato dal committente lo stesso giorno. Due cause che si sommavano, ed
**entrambe stanno in come si misura il livello**, non nella soglia:

1. **Era la MEDIA su 24 bande.** Una voce non riempie lo spettro: sta nelle
   prime bande e lascia a zero tutte le altre, che trascinano giù la media.
   Con 70 su 4 bande — una voce normale — la media vale 0,046, cioè **sotto**
   la soglia di 0,05, mentre il picco vale 0,27. Ora si riporta il **picco**.
2. **Era il campione dell'ISTANTE**, preso ogni 100ms: poteva cadere fra due
   sillabe. Ora è il picco **della finestra**, azzerato a ogni avviso.

E le soglie sono diventate **due**, che è la parte che conta di più:
`SOGLIA_VOCE` accende l'etichetta «Ti sento» e deve seguire il parlato;
`SOGLIA_SEGNALE`, molto più bassa, decide soltanto se il microfono è vivo. Un
avviso che **accusa** il microfono deve avere l'asticella dove la mette un
guasto vero, non dove la mette chi parla piano — ed è esattamente il caso che
il terzo test copre. `SECONDI_MUTO` è salito a 6 per la stessa ragione: un
falso allarme costa più del silenzio che previene, perché chi legge «non ti
sento» mentre lo si sente smette di credere all'avviso.

⚠️ E quando l'analizzatore non c'è affatto, la forma d'onda **non si finge** —
ma il foglio non resta muto: barre che pulsano da sole (che non dichiarano un
livello) più il **cronometro**, che è l'unica cosa vera rimasta. La prima
stesura scriveva solo «senza forma d'onda», che è un vicolo cieco.

### 🔴 Fermata la registrazione, non si capiva di dover aspettare
Secondo rilievo del committente, lo stesso giorno. Fermato il microfono, Gemini
deve prima **ascoltare** e poi scrivere: sono secondi in cui a schermo non
succede niente. Il foglio tornava al campo di testo — **vuoto**, perché sul
nativo la trascrizione non esiste ancora — e l'unico segnale era la CTA
disabilitata al 40%. Si leggeva come «non ha funzionato», e il gesto che ne
seguiva era premere di nuovo il microfono, cioè buttare la registrazione appena
spedita.

Ora la generazione **occupa il foglio intero**: rotella, «Sto scrivendo
l'allenamento», una riga che dice cosa sta succedendo e «Non chiudere».
Tre dettagli che non sono decorazione:
- **La CTA sparisce, non si spegne.** Un bottone spento accanto a un'attesa è il
  modo in cui l'attesa sembra un errore.
- **Il foglio non si chiude**: velo inerte e maniglia disabilitata. Chiudere lì
  butterebbe via una registrazione già spedita, in silenzio.
- **Dopo `MS_ATTESA_LUNGA` (9s) il testo cambia** in «Ci sta mettendo più del
  solito…». Toglie l'unica domanda che resta, cioè se si sia bloccato.
- ⚠️ **La riga sotto il titolo dipende da dove arriva l'attesa**: dalla voce
  («ascolto la registrazione») o dal testo («leggo la descrizione»). Sono due
  lavori diversi, e dirlo storto fa sembrare rotta un'attesa che sta andando
  bene.

### 🔴 Su iOS l'audio della dettatura lo registra MediaRecorder, non il plugin
È la stessa lezione delle note vocali (§4), applicata a un percorso che era
rimasto indietro: `capacitor-voice-recorder` è un plugin diverso da
`@independo/…`, ma la contesa su `AVAudioSession` è la stessa — e la forma
d'onda ha bisogno di `getUserMedia`, che è esattamente ciò che il plugin non
sopporta. Quindi: si apre sempre lo stream, e se `MediaRecorder` sa produrre un
formato che Gemini legge, registra lui.

⚠️ **`FORMATI_AUDIO` non è un elenco di preferenze, è un vincolo.**
`ai-workout` gira l'audio a Gemini come `inlineData`, e Gemini **non legge
`audio/webm`** — che è ciò che MediaRecorder produce su Chrome desktop. Su iOS
`audio/mp4` è supportato ed è quello che si usa; sul web si continua a passare
per il riconoscimento del browser, che riempie il campo di testo. Se un giorno
si volesse spedire l'audio anche dal web, il pezzo che manca è una conversione,
non una riga in più in quell'elenco.

⚠️ **Nel ripiego col plugin lo stream si CHIUDE prima di partire.** Tenerlo
aperto è la condizione precisa che nel 2026 ha prodotto per due mesi un M4A di
557 byte senza un errore da nessuna parte (§4).

### I dieci test, e i tre che erano verdi per il motivo sbagliato
`src/pages/__tests__/CreaWorkoutIA.test.jsx` monta `CreateWorkout` **vera**.
Tutti e dieci verificati per mutazione, e **tre** sono stati riscritti o aggiunti
perché la mutazione li superava:
- «il foglio non si chiude durante la generazione» passava anche con la maniglia
  attiva: l'uscita è un'animazione, e il test guardava se il foglio fosse
  sparito all'**istante zero** — cioè niente. Ora aspetta 450ms.
- «se non arriva nessun suono lo dice» passava anche rompendo del tutto il
  riconoscimento del livello: quel test è già in silenzio, quindi non poteva
  accorgersene. Serviva il **complemento** — con un analizzatore finto SONORO
  (`mockVolume`), l'avviso non deve comparire e si deve leggere «Ti sento».
- e nemmeno quello bastava: con un finto microfono **forte**, anche una soglia
  sola passa. Serviva il terzo caso, la **voce piana** — sopra `SOGLIA_SEGNALE`
  e sotto `SOGLIA_VOCE` — che è il difetto vero e l'unico che prende la
  mutazione «una soglia sola».

È la terza volta che succede in questo progetto (§9-sexies): un test verde non
dice niente finché non lo si è visto fallire.

⚠️ In jsdom `AudioContext` e il contesto 2D del canvas non esistono, e il
disegno gira dentro un `requestAnimationFrame`: senza i due finti in testa al
file, l'errore esce **fuori** dallo stack del test e sembra un guasto d'altro.

### AudioVisualizer ha quattro parametri nuovi, e nessuna copia in più
`colore`, `altezza`, `larghezza` e `onLivello`, tutti facoltativi:
la dettatura è viola e più alta delle note vocali, e l'alone ha bisogno del
livello **in React**, non solo sul canvas. Una seconda copia viola sarebbe stata
il modo in cui le due si mettono a divergere (§9 punto 1).
⚠️ `onLivello` avvisa al massimo ogni 100ms: a 60fps sarebbe un render ogni
16ms per un alone.
⚠️ `larghezza` è la **risoluzione** del canvas, non la sua misura a schermo —
quella la decide la classe. Era fissa a 200 e su una card larga il disegno
veniva stirato, visibile appena la forma d'onda supera i 32px d'altezza.

---

## 9-sedecies. Il rework dell'archivio (31/08/2026)

Stesso progetto Claude Design degli altri cinque schermi
(`4a238081-a3ee-4f59-ae34-100f29d55601`), artboard `Archivio Workout.dc.html`,
opzione **1b**. Come per gli altri: **nessun campo di Supabase cambia forma**,
le due query restano quelle di prima. Cambia il JSX, cambia l'ordine, e per la
prima volta la pagina dice dei numeri.

### Il problema, in una riga
Era una lista piatta di card identiche ordinate per data di **creazione**, senza
raggruppamenti e senza scala: con dieci workout funziona, con i 171 in
produzione è uno scroll cieco. L'unico strumento di riduzione era un campo di
testo — se non ricordavi il titolo esatto, non avevi una strada.

### Cosa c'è ora
1. **Una testata sola.** Erano due `h1` (il logo FLEOFIT e «Archivio Workout»)
   più un sottotitolo che ripeteva il titolo: tre righe prima di vedere un
   workout, su una schermata che si raggiunge da un link chiamato «Archivio».
   Ora è «Archivio» più una riga in monospazio che dice la scala — «128 workout
   · 3 corsie» — e che **sotto filtro cambia domanda**: «12 di 128 workout», che
   è l'unica cosa che resta da sapere quando la lista si accorcia sotto le dita.
2. **La ricerca è diventata un filtro.** Una fila di chip per corsia con il
   conteggio dentro: si riduce con un tocco, senza digitare.
3. **Il tempo dà la struttura.** I workout si raggruppano per mese, con
   l'intestazione in monospazio e il conteggio a destra.
4. **Righe dense.** 60px: spina di corsia, titolo, meta compresso e a destra il
   numero degli assegnati come **cifra**. La categoria è la spina, non un chip.

### ⚠️ Le sette cose da sapere prima di rimetterci mano

1. 🔴 **L'ordine è cambiato, ed è il raggruppamento a pretenderlo.** La query
   torna per `created_at`, ma la data **mostrata** è un'altra (`workouts.date`
   per il coach, `completed_date` per l'atleta). Finché la lista era piatta la
   differenza non si vedeva; i gruppi per mese pretendono che le date siano
   monotone, o lo stesso mese ricompare in tre punti dello scroll. `ordinaPerData`
   ordina per la data mostrata e tiene `created_at` come **spareggio**.
   ⚠️ La `Map` di `raggruppaPerMese` deduplica le chiavi da sé, quindi un test
   scritto con l'elemento più recente in testa **passa anche senza ordinare**:
   il caso che prende la mutazione ha il workout di luglio per primo (§9-sexies,
   di nuovo — è successo scrivendo questi test).
2. 🔴 **I chip si DERIVANO dai dati, non si scrivono a mano.** La query del
   coach esclude Custom ed Evento (`fetchWorkouts`), quindi un chip «Libero»
   fisso sarebbe sempre a zero — un filtro che non filtra niente e che, premuto,
   svuota la pagina. `conteggiPerCorsia` produce solo le corsie che hanno
   qualcosa dietro, e sotto le due corsie i chip non compaiono affatto.
3. 🔴 **Su una corsa mista non si dichiara nessun totale.** «400m di corsa e
   1 min di recupero» ha **due** totali veri e nessuno dei due è la lunghezza
   dell'allenamento: sommarli darebbe un numero plausibile e inventato, che è il
   caso peggiore. Lì la riga dice solo «8 fasi». Il totale compare quando tutte
   le fasi parlano la stessa unità.
   ⚠️ E `riepilogoCorsa` **non usa `parseDuration`**: quella toglie le lettere e
   legge il numero come minuti, quindi «400m» diventa 6h40m (BACKLOG #29). Su
   una scheda si nota; in una riga larga 200px diventa un «400′» che nessuno
   mette in dubbio.
4. **Le durate vengono da `stimaWorkout`**, la stessa funzione del riepilogo del
   builder e di quello della scheda. Se l'archivio dicesse «52′» dove la scheda
   dice «48′», nessuno dei due numeri sarebbe sbagliato da solo e non ci sarebbe
   modo di accorgersene.
5. **Custom ed Evento dicono solo il giorno.** Non hanno blocchi da contare né
   una durata da stimare, e «0 blocchi · 0′» sarebbe una bugia con l'aria di un
   dato — la stessa regola di `DurataBlocco` (§9-undecies punto 2).
6. **La colonna di destra è la stessa e le domande sono due.** Il coach vede a
   quante persone ha dato quel workout, l'atleta se l'ha fatto: a decidere è il
   ruolo di chi guarda, come il verso della nota vocale (§9-duodecies punto 7).
   ⚠️ Non è solo nascosto: la query dell'atleta **non carica** `athlete_workouts(id)`,
   quindi mostrare il contatore vorrebbe dire stampare `0` a tutti.
7. **L'intestazione del mese NON è appiccicata**, e non è una dimenticanza.
   Sarebbe dovuta stare a `top-<altezza della testata>`, ma quell'altezza cambia
   — il sottotitolo può mancare, i chip essere due o cinque — e un `top`
   sbagliato non dà errore: incolla l'intestazione a metà dei filtri. La testata
   **sì**, perché su una schermata di sola lista i filtri sono l'unico comando
   che c'è: se scorrono via, per cambiare corsia si deve risalire tutto lo
   scroll appena fatto, cioè proprio quando la lista è lunga.
   ⚠️ La safe area la porta la testata, non la pagina: un `pt` sul contenitore
   lascerebbe scorrere il contenuto sotto la barra di stato.

### 🔴 Il difetto latente che il rework ha chiuso
Il filtro faceva `w.title.toLowerCase()` **nudo**. `workouts.title` può essere
`null` sui workout anteriori al titolo automatico del 24/08/2026 (§5), e un
`null` lì dentro non svuotava la ricerca: si portava via la pagina intera.
Ora il testo cercabile si costruisce con `filter(Boolean)`, e la riga senza
titolo si chiama «Senza titolo».

### La ricerca ora mantiene quello che il placeholder promette
Il campo diceva «Cerca per nome o categoria» e cercava esattamente quelli. Il
placeholder dell'artboard dice «Cerca titolo, blocco, esercizio», e
`testoCercabile` è la ragione per cui non è una promessa a vuoto: scandaglia
tipi di blocco, nomi degli esercizi, note e ritmi.
⚠️ L'indice si costruisce **una volta per lista** in un `useMemo`, non a ogni
tasto premuto: sono 171 workout da scandagliare nel jsonb.

### Cosa NON è stato implementato, e perché
- **Il pannello «filtri avanzati»** dell'icona in alto a destra. L'artboard la
  disegna e il suo stesso `dv-next` la dà per il prossimo pezzo di design: il
  pannello non esiste. Un bottone che non fa niente **accanto a filtri che
  funzionano** è peggio che non averlo — è la stessa regola del badge numerico
  sulla navbar (§9-quaterdecies) e del `rpeAtteso` che torna `null` invece di 5.
- **La voce «Archivio» nella tab bar.** L'artboard 1b la disegna, ma è lo stesso
  caso di `Scheda Atleta.dc.html`: il navbar dell'artboard è **sfondo di scena**,
  non un pezzo di design. La navbar vera non ha quella voce (§9-quaterdecies),
  e l'archivio si raggiunge dalla Home.

### I file nuovi
`src/lib/rigaArchivio.js` (logica pura, 30 test) e
`src/components/ArchivioUI.jsx` (sola presentazione), più `CARTA_RIGA` in
`lib/stiliCard.js`: la carta sollevata in formato riga, raggio e ombra
proporzionati a 60px invece che a una card intera.
⚠️ È una **costante nuova** e non `CARD` con il raggio sovrascritto:
`rounded-2xl` e `rounded-[22px]` hanno la stessa specificità, e a decidere è
l'ordine nel foglio di stile, non l'ordine nella stringa di classi.

---

## 9-septdecies. Il rework della rubrica atleti (31/08/2026)

Stesso progetto Claude Design degli altri sei schermi
(`4a238081-a3ee-4f59-ae34-100f29d55601`), artboard `Atleti.dc.html`, opzione
**1b**. Come per gli altri: **nessun campo di Supabase cambia forma**. Cambia il
JSX, cambia l'ordine, e la pagina fa **una lettura in più** — una sola — per
poter dire un numero.

### Il problema, in una riga
Era una rubrica, non uno strumento di lavoro. Ogni riga mostrava nome, peso,
altezza ed età: dati anagrafici, che si consultano una volta al mese. Il coach
apre questa schermata per sapere **chi sta seguendo il piano e chi si è
fermato**, e quella informazione non c'era — bisognava entrare in ogni scheda,
una per una. Chi era in pausa restava mescolato agli attivi, distinto da un chip
arancione, e la lista non era divisibile: con venti atleti si scorreva tutto per
trovare i tre fermi. Il cestino era un accordion in fondo alla pagina, con il
conteggio fra parentesi nel testo del bottone.

### Cosa c'è ora, nell'ordine in cui sta in pagina
1. **La testata appiccicata**, con «Atleti», la scala in monospazio
   («14 attivi · 2 in pausa») e la CTA «Nuovo». Sotto di essa la ricerca e i
   **chip di stato** — Attivi · In pausa · Eliminati, con il conteggio dentro —
   che restano fermi mentre la lista scorre. Niente «indietro»: è una voce
   della navbar, non una pagina in cui si è entrati.
2. **La fascia «Da richiamare»**, l'unico blocco con bordo colorato della
   pagina. Porta alla lista già filtrata, e un secondo tocco la richiude.
3. **«Settimana in corso»**, con le righe degli attivi: avatar, nome, meta
   anagrafico compresso in monospazio, e a destra **completati / assegnati**
   della settimana più una tacca per allenamento previsto — piena se fatto,
   vuota se manca.
4. **«In pausa»**, in fondo e senza peso visivo.

### ⚠️ Le sette cose da sapere prima di rimetterci mano

1. 🔴 **Gli atleti fermi NON si calcolano qui.** Li dà `atletiFermi` di
   `statisticheCoach.js`, la stessa funzione con la stessa `GIORNI_FERMO` che
   alimenta «Richiedono attenzione» nella Home coach — e anche il testo della
   fascia si compone da quella costante, invece di scrivere «7 giorni» a mano
   come faceva l'artboard. Due soglie darebbero due numeri diversi per lo stesso
   concetto in due schermate della stessa app, e **nessuno dei due sarebbe
   sbagliato da solo**: è il difetto impossibile da notare.
2. 🔴 **L'allarme della riga viene da `atletiFermi`, non dalla frazione.** Gli
   assegnati comprendono i giorni **ancora da venire** della settimana — il
   martedì, il workout di venerdì è già programmato e fa parte del piano —
   quindi il lunedì mattina sono tutti a 0/N. Legare il colore alla frazione
   dipingerebbe di arancione l'intera rubrica ogni lunedì: un allarme che si
   accende quando non è successo ancora niente.
   ⚠️ L'allarme sta anche nell'`aria-label` («· da richiamare»), non solo nel
   colore: chi legge con VoiceOver non ha modo di sapere che la frazione è
   arancione, ed è l'unica informazione della riga che chiede un'azione.
3. 🔴 **Chi non ha niente in programma scrive «—», non «0/0».** Un atleta senza
   assegnazioni non è a zero di aderenza: non c'è ancora niente da misurare, e
   «0/0» con la barra vuota si legge come un fallimento — cioè un allarme per
   qualcuno a cui il coach semplicemente non ha ancora dato niente. È la stessa
   regola di `DurataBlocco` («—» invece di «0:00») e di `rpeAtteso` (`null`
   invece di 5).
4. 🔴 **La settimana comincia di LUNEDÌ** (`weekStartsOn: 1`). Con il default di
   `date-fns` la **domenica** cadrebbe nella settimana successiva, e l'atleta si
   vedrebbe azzerare la frazione la sera della domenica — l'unico momento in cui
   il piano della settimana è finalmente completo. È anche la settimana con cui
   il coach programma e quella su cui la Home atleta disegna l'anello: due
   settimane diverse darebbero due «3 su 5» che non coincidono.
5. **Gli atleti in pausa RESTANO nella lista principale**, in una sezione loro
   sotto gli attivi. Non è una svista dei chip: CLAUDE.md §9-decies dice che la
   rubrica è **l'unico posto** in cui il coach si accorge di averne messo in
   pausa uno e dimenticato. Sparisce dagli allarmi, non dalla lista. Il chip
   «In pausa» serve a vedere solo loro.
6. **La riga in pausa dice DA QUANDO, mai «rientro previsto».** `[PAUSA: …]`
   registra il giorno in cui la pausa è cominciata; una data di rientro non
   esiste da nessuna parte nei dati, e l'artboard la disegna. Stamparla sarebbe
   un dato plausibile e inventato. Quando la data manca, `etichettaPausa` torna
   `null` e la seconda riga sparisce: la pillola accanto dice già «Pausa».
7. **Il conto alla rovescia del cestino è corto di proposito.** «Cancellazione
   fra 5 giorni», accanto al bottone Ripristina su 393px, finiva troncato in
   «Cancellazione fra 5…» — e il numero tagliato è l'unica cosa per cui si apre
   quella vista: «fra 1…» e «fra 10…» diventavano la stessa riga. Ora è
   «Fra 5 giorni» / «Stanotte», e cosa sia il conto lo dice l'intestazione
   della sezione. **Trovato guardando la pagina a 393px, non leggendo il
   codice**: nessun test lo avrebbe preso.

### Una query in meno, non una in più
La pagina faceva **due** `select` su `athletes` — una con `deleted_at is null`,
una con il filtro complementare — cioè due round trip per una lista di dodici
righe che si divide in due con un `filter`. Ora è una sola, più **una** su
`athlete_workouts` sulla finestra `[oggi − 45, fine settimana]`, senza join sui
`workouts`: qui non serve nemmeno un titolo, e `sections` è la colonna più
pesante del database. Quella finestra serve due domande insieme — chi è fermo
guarda indietro, l'aderenza guarda la settimana in corso, che finisce nel futuro.

⚠️ `caricatoIl` si fissa **quando i dati arrivano**, e da lì dipendono l'età,
la settimana in corso, chi è fermo e il conto alla rovescia del cestino: cioè
quasi tutta la pagina. `Date.now()` durante il render darebbe conteggi diversi a
due render consecutivi. Era già la correzione fatta il 26/08 sul solo cestino
(§9-septies); ora vale per tutto.

### Cosa NON è stato ridisegnato, e perché
La modale **«Nuovo Atleta»** è rimasta com'era: l'artboard non la copre, e il
suo `dv-next` la dà fra i prossimi pezzi di design. Vale la stessa scelta fatta
per le modali della scheda atleta e della scheda workout — la pagina è la
cornice, quelle sono i contenuti.
Non è stato implementato il **pannello dei filtri avanzati** né alcun bottone
che non faccia niente: stessa regola del badge numerico sulla navbar
(§9-quaterdecies).

### I file nuovi, e i due riusati
`src/lib/rigaAtleta.js` (logica pura, 33 test) e `src/components/AtletiUI.jsx`
(sola presentazione). Da `ArchivioUI` arrivano **`CampoRicerca`** — reso
parametrico su placeholder ed etichetta, con i default dell'archivio, così il
suo chiamante non cambia — e **`IntestazioneSezione`**, che si chiamava
`IntestazioneMese`: nell'archivio raggruppa per mese, nella rubrica per stato,
ed è la stessa riga in entrambi i casi. Una seconda copia sarebbe stata il modo
in cui le due cominciano a divergere di un raggio (§9 punto 1).

---

## 9-octodecies. Il rework del calendario (31/08/2026)

Stesso progetto Claude Design degli altri sette schermi
(`4a238081-a3ee-4f59-ae34-100f29d55601`), artboard `Calendario.dc.html`,
opzione **1b**. Come per gli altri: **nessun campo di Supabase cambia forma**.
Cambia il JSX, cambia l'ordine, e per la prima volta la pagina dice dei numeri
— con la cautela che quei numeri richiedono.

### Il problema, in una riga
La griglia occupava metà schermo e trasmetteva **un solo bit per giorno**: ci
sono pallini o non ce ne sono. Non distingueva il fatto dal programmato, non
diceva il carico, e i tre pallini da 6px si perdevano. Sopra di essa c'erano
due titoli (il logo `FLEOFIT` e il mese) e **cinque bottoni tutti uguali** —
precedente, Oggi, successivo, cerca, aggiungi — di cui l'unico irreversibile
era l'unico giallo, ma in fila con gli altri come se pesasse uguale. E le card
del giorno riempivano lo spazio con i **nomi degli esercizi** («Air Squat»,
«4 blocchi»), cioè con il contenuto — che è la ragione per cui si apre una
scheda, non quella per cui si decide di aprirla.

### Cosa c'è ora, nell'ordine in cui sta in pagina
1. **La testata**: l'anno nell'occhiello in mono, il mese in grande, e due soli
   comandi — cerca e aggiungi. Il logo è sparito: in una pagina raggiunta da
   una voce di navbar chiamata «Calendario» non dice niente.
2. **La carta del mese**, che tiene insieme navigazione, legenda, griglia e
   sintesi: prima erano quattro blocchi slegati sulla pagina nuda.
3. **Celle a due livelli**: il numero e, sotto, una barra-corsia colorata per
   categoria e verde se l'allenamento è chiuso. Il mese si legge come un
   pattern di carico invece che come puntini.
4. **La fascia di sintesi**: tre numeri che dicono com'è andato il mese prima
   di doverlo leggere giorno per giorno.
5. **Il giorno scelto**: la data, quante sessioni e quanti minuti, e le righe —
   con i dati della decisione (durata, blocchi, stato, RPE) invece dei nomi
   degli esercizi.

### ⚠️ Le sette cose da sapere prima di rimetterci mano

1. 🔴 **Le prime due celle della fascia misurano lo STESSO insieme.** Per
   l'atleta la coppia dice «14 di 18 fatti, 11 ore di lavoro» — e le ore sono
   quelle dei 14. Per il coach **non esiste nessun «fatto» nei suoi dati**: la
   sua query legge `workouts`, che non ha una colonna di stato, quindi un
   «Completati» per lui leggerebbe 0 su 18 per sempre. La sua coppia dice
   «18 programmati» e le ore di quei 18. `soloCompletati` è il parametro che
   tiene i due orizzonti allineati: due orizzonti sotto un'intestazione sola
   sarebbero la bugia peggiore della fascia, perché **nessuno dei due numeri
   sarebbe sbagliato preso da solo** (è la lezione di `andamento.js`,
   §9-terdecies punto 1).
2. 🔴 **Il volume dice `≈` quando ha dovuto lasciare fuori qualcosa, e `—`
   quando non c'è niente da misurare.** `minutiWorkout` torna **`null`, non
   zero**, su Custom, Evento e sulle corse misurate in **distanza**: «18 km»
   non ha minuti finché non si assume un passo, e assumerlo vorrebbe dire
   inventarlo. Se tornasse zero, quella corsa sparirebbe dentro un «11 h» che
   ha tutta l'aria di essere completo. Il `≈` è un glifo solo, ed è l'unico
   modo di dire «questo totale è parziale» in una cella larga quanto un numero.
3. 🔴 **«Oggi» e «selezionato» sono due stati distinti e devono restarlo.** Nel
   calendario di prima erano quasi lo stesso — un riempimento pieno contro un
   grigio appena più chiaro — e all'apertura il giorno corrente spariva sotto
   la selezione. Ora oggi è un **anello**, il selezionato il riempimento giallo
   con l'ombra: coesistono sulla stessa cella senza annullarsi.
   ⚠️ L'anello non è un colore di categoria, ed è deliberato: il **bianco è già
   la corsia «Gara»**, e usarlo come riempimento della barra renderebbe
   indistinguibili «oggi» e «oggi c'è una gara».
4. 🔴 **Il bordo ambra di una riga vuol dire «DA FARE», non «riga».** Legato al
   semplice «non è chiuso», la lista del coach diventava tutta ambra — un
   allenamento di corsa incorniciato di giallo, contro la Regola della Corsia —
   e con essa spariva l'unica cosa che quel bordo doveva distinguere. Dove
   nessuno stato esiste, nessuna riga si distingue: è la risposta giusta, non
   l'assenza di una risposta.
5. **La barra si ferma a `MASSIMO_SEGMENTI = 3`, il conteggio no.** Tre
   segmenti in una cella da 43px sono già schegge, ma il numero vero finisce
   nell'`aria-label`: senza, un giorno da cinque e uno da tre sarebbero la
   stessa cella anche per chi la barra non la vede affatto.
6. **Il velo verde vale per il giorno intero, quindi pretende `every`.** Con
   una sessione su due chiusa il giorno **non** è andato, e tingerlo di verde
   direbbe il contrario. Il singolo segmento resta verde da sé.
7. **La legenda si deriva dai dati**, come i chip dell'archivio (§9-sedecies
   punto 2): una voce «Gara» in un mese senza gare è la chiave di lettura di un
   colore che non compare in nessuna cella. Sotto le due voci non compare
   affatto — con un colore solo non c'è niente da distinguere. La regola è sui
   **dati e non sul ruolo**: un `isAtleta &&` in più sulla voce «Fatto» sarebbe
   ridondante, e un guardiano che nessun caso può giustificare è il modo in cui
   la regola vera smette di essere leggibile (§9-quinquies, sul controllo di
   bordo tolto da `faseMoveUp`).

### 🔴 `border-brand/20` accanto a `CARTA_RIGA` NON fa niente — e vale ovunque
Il difetto peggiore della sessione, e **lo screenshot non lo mostrava**.
`CARTA_RIGA` porta già `border border-white/[.07]`; affiancargli
`border-brand/20` non sovrascrive nulla, perché sono **due utility della stessa
specificità** e a decidere è l'ordine nel foglio di stile. La riga «da fare»
credeva di avere il contorno ambra e aveva quello neutro.

È esattamente la trappola che `stiliCard.js` annotava già **per il raggio**
(`rounded-2xl` contro `rounded-[22px]`, §9-sedecies), ripresentata identica su
un'altra proprietà. Da qui **`CARTA_RIGA_BASE`**: l'impasto — gradiente,
hairline chiara, ombra — **senza** il bordo, così il contorno lo dichiara il
chiamante una volta sola invece di provare a sovrascriverlo.
`CARTA_RIGA = CARTA_RIGA_BASE + border-white/[.07]`, quindi nessun chiamante
esistente cambia.

> ⚠️ **E il primo test era verde per il motivo sbagliato**, per la terza volta
> in questo progetto (§9-sexies). Verificava `toHaveClass('border-brand/25')`,
> che era vero — la classe c'era, semplicemente non vinceva. Il caso che prende
> il difetto è l'**assenza** del bordo neutro, non la presenza di quello ambra.
> Trovato leggendo lo stile **calcolato** nel browser, non il DOM e non il
> codice.

### Una lettura in più, e nessuna colonna
La query dell'atleta aggiunge **`notes`**: è lì che sta il marcatore
`[RPE: n/10]`, sull'assegnazione e non sul workout. Senza, la riga di un
allenamento chiuso non può dire com'è andato — e non lo direbbe nessun errore,
si limiterebbe a non mostrarlo mai.
⚠️ L'RPE si legge con **`rpeDichiarato`**, non con `parseNotesAndRpe`: il
secondo torna **5** quando il marcatore manca, ed è il valore giusto per il
cursore della modale ma un numero inventato per chiunque lo mostri come un
dato. È la stessa lezione di §9-octies, §9-undecies punto 3 e §9-terdecies
punto 2.

### `metaWorkout` ha un'opzione, e non una seconda copia
`metaWorkout(w, { giorno: false })`. Ogni riga del calendario sta già sotto
l'intestazione della propria data: ripeterla lì dentro toglierebbe larghezza —
su 393px — proprio ai blocchi e ai minuti, che sono l'unica cosa per cui si
guarda quella riga. È un'opzione e non una funzione nuova perché «come un
workout descrive sé stesso» deve restare un punto solo (§9 punto 1).

### Cosa NON è stato implementato, e perché
- **Il foglio del giorno come bottom sheet trascinabile.** L'analisi
  dell'artboard lo descrive come «un pannello che sale dal bordo inferiore», ma
  il render di 1b lo disegna come una sezione sotto la carta, e il `dv-next`
  dello stesso artboard lo dà fra i **prossimi** pezzi di design. Implementato
  com'è disegnato, non com'è raccontato.
- **La vista settimana con le ore**, per la stessa ragione: è il primo
  suggerimento del `dv-next`.
- La modale **«Nuovo Evento / Gara»** è rimasta com'era, come le modali della
  scheda atleta e della scheda workout: la pagina è la cornice, quelle sono i
  contenuti. ⚠️ Una cosa è cambiata: la data parte da quella **selezionata** e
  non da oggi — si apre quella modale dopo aver scelto un giorno, e ripartire
  da oggi obbligava a rifare la scelta appena fatta.

### Cosa è tornato, contro l'artboard
Il bottone **«Oggi»**, che l'artboard toglie insieme agli altri quattro.
Toglierlo del tutto è una regressione: da tre mesi avanti si torna al giorno
corrente in tre tocchi invece che in uno. Qui compare **solo quando il mese
mostrato non è quello corrente** — cioè esattamente quando serve, e senza
occupare posto nell'unico caso in cui non servirebbe a niente.

### I file nuovi
`src/lib/rigaCalendario.js` (logica pura, 35 test) e
`src/components/CalendarioUI.jsx` (sola presentazione), più `CARTA_RIGA_BASE`
in `lib/stiliCard.js`. Il vecchio `COLORI_PALLINI` — una tabella di colori
locale a `Calendar.jsx` che mescolava tipi di blocco e categorie — è sparito:
il colore di una sessione è quello della sua **corsia**, e viene da
`coloreCategoria` come ovunque (§9 punto 1).

---

## 10. Idee/direzioni note per il futuro

- Possibile **rebranding** (nome diverso da FLEOFIT) mantenendo la palette.
- Modifiche grafiche/UI attese, palette invariata.
- Integrazione **Strava/Garmin** via `cloud-sync` già predisposta lato client (`CloudSyncService`).
- Ruolo `coach` separato da `admin`, già abbozzato ma disattivato.
