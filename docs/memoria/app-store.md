# App Store: rifiuti, correzioni, controlli prima di un archive

> Spostato da `CLAUDE.md` il 07/10/2026, **senza cambiare il testo**. I rimandi
> «§9-…» puntano a sezioni che ora stanno in altri file di questa cartella:
> si trovano con `grep -rn '^## 9-<nome>' docs/memoria`. L'indice è in `CLAUDE.md`.

## 9-ter. App Store — rifiuto del 1.1.0 (2) e ri-sottomissione del 1.1.0 (3)

### Cronologia
- **22 mag 2026** — caricata `1.1.0 (2)`. **Respinta** con **2.3.1(a) Hidden features** e
  **3.2.1(viii) Financial Services**.
- **24 ago 2026** — correzioni applicate nel commit `fc81404`, caricata `1.1.0 (3)`.
- **02 set 2026** — 🔴 **respinta di nuovo, ma per un'altra cosa**: linea guida **4.8
  Login Services**, cioè Google senza un'alternativa che permetta di nascondere la
  propria email. Non è una ricaduta del 2.3.1(a). Chiuso il 03/09 con Sign in with
  Apple (§9-sexvicies), **senza togliere Google**.
- **20 set 2026** — 🔴 **respinta una terza volta, con TRE rilievi insieme** sulla
  build `1.0 (5)`: **2.5.1** (HealthKit linkato senza una funzione primaria che lo
  giustifichi), **5.1.2(i)** (le etichette privacy dichiarano *tracking* su email e
  nome, e l'app non chiede l'ATT) e **2.3.6** (l'age rating dichiara *In-App
  Controls* inesistenti). Solo il primo è codice, ed è chiuso il 21/09; gli altri
  due si correggono su App Store Connect. Tutto in §9-quatertricies.
- **21 set 2026** — ✅ **build `1.1.0 (6)` archiviata, esportata e verificata.**
  `xcodebuild archive` con `-derivedDataPath` su una cartella nuova (il *Clean
  Build Folder* fatto in modo da non toccare la DerivedData di Xcode), poi
  `-exportArchive` e `tools/verifica-ipa.sh`: **11 controlli su 11 verdi**,
  compresi i due nuovi — nessuna traccia di HealthKit e nessuna di Bluetooth,
  verificate con `otool -L` sul binario. ⚠️ Il `pbxproj` dichiarava
  `CURRENT_PROJECT_VERSION = 3` e l'ipa è uscito **6**: è la rinumerazione
  automatica descritta qui sotto, che ha funzionato per la terza volta.
  Commit `8d9a398`, 21/09/2026 alle 10:58: è il punto da cui contare le novità.
- **29 set 2026** — ✅✅ **APPROVATA.** La build in vendita è la `1.1.0 (6)`. Quello che
  è stato fatto dopo `8d9a398` (UIScene e Capacitor 8.5.2 del pomeriggio del 21/09
  compresi, e con loro la build 7, esportata ma che nei commit non risulta caricata) arriva con il prossimo
  aggiornamento: l'elenco per la scheda «Novità» è in `DEVLOG.md`, alla radice.
- **26 ago 2026** — ✅ **la causa del rifiuto è chiusa e verificata dai due lati.**
  Punti 1 e 2 sul binario spedito (`tools/verifica-ipa.sh`), punto 3 provato dall'app:
  `demo@fleofit.it` **assegna un workout**. Era esattamente ciò che a maggio non
  funzionava, e che nessuno aveva provato.

> 🔴 **«1.0» e «1.1.0 (3)» sono DUE numeri diversi, e la lettera di Apple li mescola.**
> Su App Store Connect il record della versione dice **`1.0`** — è il numero metadati, quello
> che gli utenti vedranno sullo Store. Il **build** dice **`1.1.0 (3)`**, cioè
> `CFBundleShortVersionString` + `CFBundleVersion`, che vengono da `MARKETING_VERSION` e
> `CURRENT_PROJECT_VERSION` nel `pbxproj`. La lettera del 02/09/2026 scriveva «Version
> reviewed: 1.0 (3)», cioè la versione del record accanto al numero di build — e a chi legge
> solo quella sembra che il progetto dichiari la versione sbagliata. **Non è così, e
> `MARKETING_VERSION` non va riportato a 1.0**: il build precedente portava 1.1.0 e si è
> agganciato al record 1.0 senza problemi. Verificato il 09/09/2026 sul pannello.
> ⚠️ Conseguenza cosmetica da conoscere: ad approvazione avvenuta lo Store dirà **1.0** e
> Impostazioni dirà **1.1.0**, perché quella riga viene da `App.getInfo()`, cioè dal build
> (§9-duoetvicies punto 6). Si allinea dopo, scegliendo quale dei due è il numero vero.
>
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

> **Controlli obbligatori prima di ogni archive.** Il primo è quello che è mancato a maggio;
> il secondo è stato aggiunto il 09/09/2026, dopo che il seme dell'ambiente di prova è
> arrivato fino a una build in preparazione senza che niente lo segnalasse (§9-quinvicies);
> il terzo il 21/09/2026, dopo il rilievo **2.5.1** (§9-quatertricies).
> ```bash
> grep -l "demo@fleofit.it" dist/assets/*.js                                  # DEVE stampare un file
> grep -l "AMBIENTE DI PROVA\|at-sara\|fleofit_demo_db" ios/App/App/public/assets/*.js   # NON deve stampare niente
> grep -rl "Apple Health\|NSHealth\|capacitor-health\|developer.healthkit" ios/App/App/public/assets/ ios/App/App/*.plist ios/App/App/App.entitlements ios/App/CapApp-SPM/Package.swift   # NON deve stampare niente
> ```
> ⚠️ Il terzo cerca i **marcatori**, non la parola «health»: `@supabase/realtime-js`
> porta nel bundle un `primaryPassedHealthCheck` che con un grep generico fa scattare
> l'allarme a ogni build — e un controllo che grida sempre è un controllo che si smette
> di leggere. ⚠️ Ed è solo un'anticipazione: HealthKit entra nel binario anche da un
> plugin che nessuno chiama, e lì lo vede solo `otool -L` sull'`.ipa` esportato — è il
> controllo **10** di `tools/verifica-ipa.sh`.
> ⚠️ Il secondo si fa su `ios/App/App/public`, non su `dist`: è quella la copia che Xcode
> compila, e le due divergono ogni volta che si salta `npx cap sync ios` (§2).
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

## 9-quatertricies. Il rifiuto del 20/09/2026: HealthKit, ATT e il rating (21/09/2026)

Terza bocciatura della stessa versione — build **1.0 (5)** — e per la prima
volta con **tre rilievi insieme**. La cosa da sapere prima di aprire un file:
**uno solo è codice.**

| rilievo | cosa dice | dove si corregge |
|---|---|---|
| **2.5.1** | il binario contiene riferimenti a HealthKit e l'app non ha una funzione primaria che li giustifichi | **codice** |
| **5.1.2(i)** | le etichette privacy dichiarano *tracking* su Email e Nome, e l'app non chiede il permesso ATT | **App Store Connect** |
| **2.3.6** | l'age rating dichiara *In-App Controls* che nell'app non si trovano | **App Store Connect** |

⚠️ La lettera scrive «Version reviewed: 1.0 (5)»: è il **record** 1.0 con il
**build** 5, non un declassamento, e `MARKETING_VERSION` non va riportato a 1.0.
È la stessa confusione già annotata in §9-ter, alla seconda comparsa.

### 🔴 2.5.1 — Apple Health è uscito del tutto, e non è una perdita
Il rilievo è letterale, e aveva ragione. Apple Health era **un bottoncino da
11px dentro la modale RPE**: premuto, leggeva l'ultimo allenamento della
giornata da Salute e **appendeva una riga di testo alle note**
(`🍏 [Apple Health] Durata: … | Calorie: … | Battiti Medi: …`). Nient'altro
nell'app lo leggeva: non le statistiche, non il carico, non il report. Quella
riga finiva in `athlete_workouts.notes` come testo libero accanto al marcatore
`[RPE: n/10]`, e da lì non tornava mai indietro.

Cioè: il permesso più delicato che iOS conceda, chiesto per scrivere una frase.

Non è stato disattivato, è stato **rimosso da tutte e cinque le porte** da cui
HealthKit entra in un'app Capacitor. Servono tutte e cinque, perché Apple guarda
il **binario** e ne basta una aperta:
1. `src/pages/health.js` (`HealthService`) — cancellato;
2. il bottone «🍏 Apple Health» e `handleHealthSync` in `RpeModal.jsx` (con
   loro se n'è andato l'import di `mostraErrore`, che serviva solo a quello);
3. `NSHealthShareUsageDescription` e `NSHealthUpdateUsageDescription` in
   `ios/App/App/Info.plist`;
4. `com.apple.developer.healthkit` in `ios/App/App/App.entitlements`;
5. il plugin **`@capgo/capacitor-health`** — `npm uninstall`, poi
   `npx cap sync ios` riscrive `CapApp-SPM/Package.swift` da sé: **19 plugin
   → 18**.

🔴 **Il punto 5 è quello che si dimentica, ed è l'unico che da solo fa respingere
la build.** Senza codice, senza entitlement e senza chiavi d'uso, un plugin
ancora elencato in `Package.swift` **linka comunque `HealthKit.framework`** al
binario, e `otool -L` lo dichiara. Il rilievo parla di *riferimenti nel binario*,
non di codice raggiungibile: un `if (false)` non salva nessuno.
⚠️ **`Package.swift` non si modifica a mano** — porta scritto «DO NOT MODIFY —
managed by Capacitor CLI». Si toglie il pacchetto npm e si sincronizza, o la
prossima `cap sync` lo rimette.

**Cosa NON è stato toccato da QUESTO rilievo, e per buone ragioni:**
- la **fascia cardio BLE** (`src/pages/bluetooth.js`) è **Core Bluetooth**, non
  HealthKit: legge i battiti dal dispositivo in tempo reale, non dall'archivio
  Salute, quindi il 2.5.1 non la riguardava. ⚠️ È uscita **lo stesso giorno**,
  per decisione del committente e non per un rilievo: §9-quintricies;
- `LSApplicationCategoryType = public.app-category.healthcare-fitness` nel
  `pbxproj` resta: è la **categoria dello Store** di un'app di allenamento, non
  un riferimento a HealthKit. Toglierla non risponde a niente e sposta l'app
  in uno scaffale sbagliato.

**Il controllo 10 di `tools/verifica-ipa.sh`** guarda ora **quattro** tracce
sull'`.ipa` esportato — entitlement, chiavi `NSHealth*`, `otool -L` e la scritta
«Apple Health» nel bundle web — perché escono in momenti diversi e ognuna da
sola è mezza verità. È la stessa lezione del seme dell'ambiente di prova
(§9-quinvicies), che il controllo di allora lasciava passare proprio così.

### 🔴 5.1.2(i) — l'app NON traccia: a mentire sono le etichette
Il rilievo si legge male, e la lettura sbagliata costa una funzione inutile:
sembra chiedere di **aggiungere** l'App Tracking Transparency. Non è così. Apple
confronta due cose — cosa dichiari su App Store Connect e cosa fa il binario — e
qui a essere sbagliata è la **dichiarazione**: qualcuno ha spuntato
*Used for Tracking* su **Email Address** e **Name**.

«Tracking», per Apple, ha una definizione stretta: collegare i dati dell'app con
dati di **terze parti** a fini pubblicitari, oppure cederli a un **data broker**.
Verificato in questa sessione, ed è no su tutta la linea:
- **nessun SDK pubblicitario o di attribuzione** fra le dipendenze;
- **nessun IDFA**: zero occorrenze di `ASIdentifierManager` / `AdSupport` /
  `advertisingIdentifier` nei plugin nativi, e nessun
  `NSUserTrackingUsageDescription` in `Info.plist` — l'app non ha mai avuto
  nemmeno il modo di chiedere quel permesso;
- **Firebase c'è solo come `FirebaseMessaging`**, e lo dichiara il
  `Package.swift` del plugin `@capacitor-community/fcm` (un solo `.product`).
  `GoogleService-Info.plist` ha `IS_ANALYTICS_ENABLED = false` e
  `IS_ADS_ENABLED = false`.

Email e nome servono a far entrare l'atleta e a chiamarlo per nome. Sono
**Linked to You** — vero, e va dichiarato — ma **non** *Used for Tracking*.

**Il gesto**, con le diciture lette sul pannello vero il 21/09/2026 — che è **in
italiano**, mentre la guida Apple esiste solo in inglese, quindi le sue stringhe
a schermo non si trovano. Barra laterale → **Privacy dell'app** → sezione
**Tipologia di dati** → **Modifica** sulla riga del dato. Il flusso ha cinque
passi e conta l'ultimo: *«Tu o i tuoi partner di terze parti utilizzate i nomi a
scopo di monitoraggio?»* → **«No, non utilizziamo i nomi a scopo di
monitoraggio»**. 🔴 Il bottone finale si chiama **«Pubblica»**, non «Salva»: va
sulla scheda pubblica all'istante. Poi rispondere nel **Resolution Center** che
l'app non traccia su nessuna piattaforma — Apple lo chiede esplicitamente nella
seconda delle tre vie d'uscita che elenca.

**Lo stato trovato il 21/09/2026.** Nove tipologie dichiarate, tutte con utilizzo
«Funzionalità dell'app» e tutte collegate all'identità; **solo Nome e Indirizzo
email** portano «*Si utilizzano a scopo di monitoraggio*», cioè esattamente i due
della lettera e nessun altro. Le altre sette: Salute, Fitness, Informazioni
sensibili, Email o messaggi, Foto o video, Dati audio, ID utente.

🔴 **«Salute» NON si toglie, anche se HealthKit è uscito**, ed è il contrario
di quello che sembra. ⚠️ **La ragione è cambiata lo stesso giorno**: la mattina
era la **fascia cardio BLE**, che metteva `heartRate` nel payload Realtime del
timer verso la TV e la Live Coach Cam — un dato sanitario che lasciava il
dispositivo. Il pomeriggio il BLE è uscito del tutto (§9-quintricies), e
«Salute» resta per `athletes.weight`, `height` e `birth_date`, che nella
tassonomia di Apple ricadono sotto *«any other user provided health or medical
data»*. In entrambi i casi vale la stessa regola: togliere una dichiarazione è il
verso che produce un 5.1.2 per **sotto**-dichiarazione.
⚠️ «**Informazioni sensibili**» sembra invece dichiarata di troppo — per Apple
significa origine etnica, orientamento sessuale, convinzioni religiose, dati
biometrici o genetici — ma non è nel rilievo, e non si tocca mentre si risponde
a un rifiuto.

⚠️ **Aggiungere l'ATT sarebbe la correzione sbagliata**, e va detto perché è la
prima che viene in mente: chiedere un permesso che non serve a niente è a sua
volta un rilievo, e regala all'utente una schermata di sistema che non ha nessun
effetto su nessun comportamento dell'app.

### 🔴 2.3.6 — «In-App Controls» spuntato per sbaglio
Stessa forma del precedente: una casella del **nuovo age rating** dichiara che
l'app offre controlli parentali o un meccanismo di verifica dell'età. Non ne ha —
niente PIN, niente limite di tempo, niente age gate. `athletes.birth_date` serve
a scrivere «29 anni» nella scheda, non a sbarrare l'accesso a qualcosa.

**Il gesto**, in italiano: **Informazioni sull'App** → sezione **Età consigliata**
→ **Classificazioni per età dell'app** → **Modifica** → **Parte 1:
caratteristiche** → blocco **Controlli in-app**, due righe con interruttori
**NO / SÌ**: *Controlli parentali* (già su NO il 21/09) e **«Verifica
dell'età»** — che è il nome italiano di *Age Assurance*, ed era su **SÌ**. Va
messa su **NO**, poi **Avanti** fino in fondo e **Salva**.

⚠️ **Sotto, nel blocco «Capacità», altre due voci erano su SÌ e quasi certamente
sono la ragione del 16+** (17+ sui sistemi precedenti alla 26): *Accesso al web
senza limitazioni* — l'app apre solo i link Instagram/Strava del profilo — e
*Contenuti generati dagli utenti*, la cui definizione Apple richiede l'«**ampia
distribuzione**» di contenuti, mentre qui note e vocali restano fra il coach e
quel solo atleta. *Messaggistica e chat* = SÌ è invece corretto: sono le note
vocali. 🔴 **Non si cambiano nella stessa passata**: dichiarare UGC = NO su
un'app con comunicazione fra utenti è il genere di risposta che Apple guarda da
vicino (la **1.2** chiede moderazione, segnalazione e blocco a chi dichiara UGC),
e qui si sta rispondendo a un rifiuto. Il 16+ si sistema dopo l'approvazione,
quando sbagliare costa un ciclo di revisione e non una quarta bocciatura.

### ⚠️ Due cose che stanno fuori dal repository e vanno controllate
1. ✅ **La descrizione sullo Store è già pulita**, verificato sul pannello il
   21/09/2026: né la descrizione, né le parole chiave, né il testo promozionale
   citano «Apple Health» o «Salute». Andava controllato perché il 2.5.1 dice
   *«as well as any references … from the app or its metadata»*, e una descrizione
   che promette una funzione che non c'è è per giunta un **2.3.1**. Restano da
   guardare a occhio i **4 screenshot**.
2. **L'App ID su Apple Developer** ha ancora la capability *HealthKit* spuntata.
   Non basta a far respingere la build — l'entitlement lo chiede il progetto, e
   non lo chiede più — ma toglierla è l'unico modo di essere certi che non
   rientri da una rigenerazione del provisioning profile. ⚠️ Toglierla invalida i
   profili esistenti: con la firma automatica Xcode li rigenera, e serve comunque
   un **Product → Clean Build Folder**, esattamente come per Sign in with Apple
   (§9-sexvicies).

### Cosa cambia per l'atleta, e cosa succederebbe rimettendolo
Una riga in meno nella modale RPE, e nient'altro: le note già scritte che
contengono `🍏 [Apple Health] …` restano testo e continuano a leggersi ovunque.

Se un giorno quei numeri dovranno tornare, **la forma che Apple accetta non è il
bottoncino**. Il 2.5.1 chiede una funzione *primaria*: scrivere l'allenamento
**dentro** Salute a fine sessione — cioè `HKWorkout` con durata, calorie e
battiti, che è la ragione per cui esiste `NSHealthUpdateUsageDescription`, quella
che l'app dichiarava e non usava — e rileggerne i battiti per il report. È un
pezzo di prodotto, non una scorciatoia dentro una modale. Voce in BACKLOG.

---

## 9-quintricies. La fascia cardio è uscita (21/09/2026)

Decisione del committente, il giorno dopo il terzo rifiuto: *«disabilitiamo la
funzione della fascia cardio — intanto era una funzionalità in fase di test.
Facciamo contenti i revisori Apple.»* È la stessa aritmetica di HealthKit
(§9-quatertricies): una funzione in prova che costa **due permessi di sistema**
davanti a un'app con tre rifiuti alle spalle è tutto costo e nessun beneficio.

### 🔴 Rimossa, non disabilitata — e qui il motivo è più duro di quello di HealthKit
Con HealthKit un residuo era un **rilievo**. Qui è un **crash**: le chiavi
`NSBluetoothAlwaysUsageDescription` e `NSBluetoothPeripheralUsageDescription`
non ci sono più, e su iOS un accesso al Bluetooth senza la sua stringa d'uso non
dà un errore da gestire — il sistema **termina il processo**. Quindi un
`if (false)` attorno al codice BLE sarebbe la peggiore delle tre opzioni: lascia
il framework linkato *e* una mina sotto il primo ramo che qualcuno riattiva.

Le cinque porte, come per HealthKit:
1. `src/pages/bluetooth.js` (`BluetoothService`, il singleton) — cancellato;
2. i quattro chiamanti: l'interruttore e le 90 parole sul Garmin in `Settings`,
   l'icona di stato «Cardio» in `WorkoutDetail`, la pillola BPM nella testata
   della Home e nello spettatore della Live Coach Cam, il riquadro sulla TV;
3. le due chiavi `NSBluetooth*` in `Info.plist`;
4. il plugin `@capacitor-community/bluetooth-le` — `npm uninstall` più
   `npx cap sync ios`: **18 plugin → 17**;
5. il controllo **11** di `tools/verifica-ipa.sh`, che cerca le chiavi,
   `CoreBluetooth.framework` in `otool -L` e `BleClient` nel bundle web.

### 🔴 La conseguenza che non si vede: il battito non viaggia più
`heartRate` viaggiava nel payload Realtime del timer (dentro `WorkoutTimer`),
verso la TV **e** verso la Live Coach Cam. Era l'unico dato sanitario che
lasciasse il dispositivo, ed era la ragione per cui «**Salute**» doveva restare
sull'etichetta privacy la mattina dello stesso giorno (§9-quatertricies).
⚠️ **«Salute» non si toglie comunque, ma ora per un'altra ragione**: restano
`athletes.weight`, `height` e `birth_date`, che nella tassonomia di Apple
ricadono sotto *«any other user provided health or medical data»*. Togliere una
dichiarazione è il verso che produce un 5.1.2 per **sotto**-dichiarazione, e su
un'app con tre rifiuti non si scommette per guadagnare una riga in meno su una
scheda che già non mostra tracciamento.

### Cosa NON è stato toccato
Il **timer guidato**, la **Live Coach Cam** e il **cast su TV** restano interi:
perdono una pillola rossa, non una funzione. Resta anche `@capacitor/network`,
che col Bluetooth non c'entra.

### ⚠️ L'errore che ho commesso, perché è istruttivo
La prima passata su `Settings.jsx` ha tagliato per **indici** (`s.index(...)`
fino al blocco successivo) invece che per stringhe esatte, e si è portata via
anche `toggleNotifiche`, `generaCodice`, `copiaTesto` ed `eliminaCodice`, che
stavano in mezzo. Il file compilava; a cadere sono stati **tutti e venti** i test
della pagina, con un `toggleNotifiche is not defined` che non nominava niente di
BLE. ✅ In un file da 700 righe si cancella per **sostituzione esatta**, mai per
intervallo — e quando serve un intervallo, si rilegge il diff prima dei test.

### I test: da quattro a uno, e l'uno protegge l'ASSENZA
I quattro test sulla fascia cardio in `Impostazioni.test.jsx` sono diventati
**uno**, che verifica che l'interruttore, la riga «Come si collega» e le 90
parole sul Garmin **non ci siano**. ⚠️ Aspetta prima l'interruttore delle
notifiche: senza, le `queryBy` girerebbero su una pagina ancora vuota e
passerebbero anche con il cardio al suo posto (§9-sexies, ancora).
Verificato per mutazione, e **due volte**: la prima rimetteva un
`RigaInterruttore` senza `icona`, che fa crashare `Pastiglia` — cadevano tutti e
venti i test, cioè il test era rosso **per il motivo sbagliato**, che vale quanto
un verde per il motivo sbagliato. Con l'icona valida: **1 caduto su 20**.
932 test in tutto (erano 935: quattro tolti, uno aggiunto).

---

## 9-sextricies. Il ciclo di vita a UIScene (21/09/2026)

Migrazione fatta il 21/09 dopo il caricamento della build 6, e Capacitor portato
da 8.3.4 a **8.5.2** (è la versione che porta `CAPSceneDelegateProxy`).

### 🔴 LA SCADENZA È iOS 27, NON iOS 26 — e questa riga esiste per un falso allarme
Testuale da Apple, *Transitioning to the UIKit scene-based life cycle*:

> «Adopting the scene-based life cycle is required. **Beginning in iOS 27**,
> iPadOS 27, Mac Catalyst 27, tvOS 27, and visionOS 27, apps built with the
> latest SDK **must adopt** the scene-based life cycle **or they fail to
> launch**.»

E su iOS 26 il sistema scrive soltanto nel log: «UIScene lifecycle will soon be
required. Failure to adopt will result in an assert in the future.»

⚠️ **Un `EXC_BREAKPOINT` su
`__UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption` non è il
crash di produzione**: è il *runtime issue breakpoint* di Xcode, che scatta solo
col debugger attaccato. Il 21/09/2026 quella lettura ha quasi fatto ritirare
dalla revisione una build sana — la **6**, che non ha la migrazione e su iOS 26
parte normalmente.

### Le quattro porte della migrazione
1. **`SceneDelegate.swift`** (nuovo) — template di Capacitor 8.5.x, più la
   sessione audio `AVAudioSession` che prima stava in `applicationDidBecomeActive`.
   🔴 Senza quello spostamento i **beep del timer guidato** non suonerebbero col
   silenzioso inserito, e nessun errore lo direbbe.
2. **`AppDelegate.swift`** — perde i metodi di ciclo di vita e
   `application(_:open:)`. ⚠️ I deep link `fleofit://` (callback OAuth, reset
   password) e gli universal link **non passano più di lì**: arrivano a
   `scene(_:openURLContexts:)` e `scene(_:continue:)`, che li girano a
   `SceneDelegateProxy`. Le **push restano** sull'AppDelegate, perché sono
   dell'applicazione e non di una scena. Rimettere i vecchi metodi non dà errore:
   semplicemente non li chiama più nessuno, in silenzio.
3. **`Info.plist`** — `UIApplicationSceneManifest` con
   `UISceneDelegateClassName = $(PRODUCT_MODULE_NAME).SceneDelegate`. Il nome
   deve coincidere con la classe, o la scena non si aggancia.
4. **`pbxproj`** — `SceneDelegate.swift` va referenziato a mano in **quattro**
   punti (PBXFileReference, PBXBuildFile, il gruppo, la fase Sources): quel
   progetto **non usa i gruppi sincronizzati col filesystem**, quindi un file
   nuovo che non si aggiunge al target non viene compilato affatto — è la stessa
   trappola di §9-sexvicies con Sign in with Apple.

### Come si verifica, sul binario e non sul sorgente
```bash
/usr/libexec/PlistBuddy -c 'Print :UIApplicationSceneManifest' <App.app>/Info.plist
strings <App.app>/App | grep -c '3App13SceneDelegate'   # 1 = la classe c'è
```
⚠️ `nm` su una build Release **non la trova**: i simboli sono strippati e il nome
sopravvive solo nei metadati di reflection di Swift. E `strings | grep
SceneDelegate` senza il modulo dà **19 occorrenze anche su una build NON
migrata**, perché sono quelle di `CAPSceneDelegateProxy` dentro Capacitor: il
mangled `3App13SceneDelegate` è l'unico che distingue la nostra classe.

---
