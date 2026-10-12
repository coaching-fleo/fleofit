# Android: costruire, verificare, le differenze da iOS

> Spostato da `CLAUDE.md` il 07/10/2026, **senza cambiare il testo**. I rimandi
> «§9-…» puntano a sezioni che ora stanno in altri file di questa cartella:
> si trovano con `grep -rn '^## 9-<nome>' docs/memoria`. L'indice è in `CLAUDE.md`.

## A. ANDROID — leggere prima di toccare qualcosa di nativo

Tutto quello che segue è stato **trovato provando l'app sull'emulatore** il 02/10/2026, e quasi
niente si sarebbe visto leggendo il codice: la base era l'app iOS, e le differenze stanno nella
WebView, nei plugin e nel manifest. ⚠️ **Su `app` queste correzioni stanno nel codice
condiviso**: quelle che toccano anche iOS (punti 2 e 6) vanno riprovate sul simulatore.

### A.1 Come si costruisce e si installa

```bash
npm run android                       # build web + npx cap sync android
```
```bash
cd android && ./gradlew installDebug  # compila e installa sull'emulatore/telefono collegato
```

- **Java**: serve il **JDK 21**, non è nel PATH. ⚠️ Il JBR di Android Studio è passato a
  **Java 25**, che Gradle 8.14.3 non supporta («Unsupported class file major version 69»).
  In Git Bash: `export JAVA_HOME=~/.gradle/jdks/eclipse_adoptium-21-amd64-windows.2`.
  Dentro Android Studio vale `android/.gradle/config.properties` (`java.home`, file locale e
  ignorato da git), che dal 12/10/2026 punta allo stesso JDK 21: se Studio propone «Apply
  compatible Gradle JDK configuration», è perché quel file è tornato sul JBR.
- **adb**: `"$LOCALAPPDATA/Android/Sdk/platform-tools/adb.exe"`. In Git Bash i percorsi che
  cominciano con `/sdcard` vengono riscritti in percorsi Windows: serve `export MSYS_NO_PATHCONV=1`.
- 🔴 **`npm run build` non basta**: Gradle impacchetta `android/app/src/main/assets/public`, che
  è una **copia** del bundle depositata da `npx cap sync android`. Senza sync, l'app installata
  ha il codice della volta prima e la modifica «non funziona». Per questo esiste `npm run android`.
  ⚠️ Quella copia è in `android/.gitignore`, come le build: non va nel repository.
- **`google-services.json`** sta in `android/app/` ed è versionato, come su iOS il
  `GoogleService-Info.plist`. Non contiene segreti veri. Il `build.gradle` attiva Firebase
  **solo se il file c'è**: senza, scrive nel log che le push non funzioneranno e prosegue.
- `minSdk 24`, `targetSdk 36` (`android/variables.gradle`).

#### ⚠️ La cartella di rete (07/10/2026)
`Z:` è una cartella di rete (`\192.168.100.2leo88`). Con Android Studio aperto
`npx cap sync android` si ferma a metà (EPERM / ENOTEMPTY) e lascia **mezze vuote**
due cartelle: `android/capacitor-cordova-android-plugins` (resta solo `build/`, e
Gradle dice «cordova.variables.gradle does not exist») e
`android/app/src/main/assets/public` (resta solo `cordova.js`). Anche *Clean Project*
si blocca, e `app/build` resta piena di cartelle in cancellazione che Gradle non
riesce più a leggere (AccessDeniedException su `mergeDebugResources`).

Cosa funziona:
1. chiudere Android Studio;
2. cancellare a mano la cartella mezza vuota e rifare i pezzi separati:
   `npx cap update android` (plugin) e `npx cap copy android` (codice web);
3. verificare la copia con `diff -q dist/assets/index-*.js android/app/src/main/assets/public/assets/index-*.js`;
4. le cartelle `build/` stanno **sul disco locale** grazie a
   `~/.gradle/init.d/fleofit-build-locale.gradle` (fuori dal progetto, solo su questo
   PC): Gradle lo applica da solo a ogni build, **anche da Android Studio**, e agisce
   solo sui progetti con «fleofit» nel percorso. L'APK finisce in
   `%LOCALAPPDATA%leofit-gradle-build\_app\outputspk\debug`. La cartella
   `android/app/build` su Z: non si usa più (restano cartelle vuote non cancellabili:
   ignorarle). Dopo averlo aggiunto è servito cancellare `android/.gradle`, dove Gradle
   ricordava le uscite vecchie e provava a ripulirle («Failed to clean up output files»).

La soluzione stabile è una copia di lavoro su un disco locale.

### A.2 Come si verifica (senza un telefono vero)

L'emulatore usato è un **Pixel con Google Play Services** (`sdk_gphone…`): riceve le push.

| Cosa | Come |
|---|---|
| **Avvio, animazioni** | `adb shell screenrecord --size 720x1280 /sdcard/x.mp4`, poi `adb pull` e i fotogrammi con `ffmpeg -fps_mode passthrough`. ⚠️ Il video è a frequenza **variabile**: `-ss` su un file così sbaglia il punto, si estraggono tutti i fotogrammi e si guardano quelli |
| **Console, rete, DOM** | `chrome://inspect` in Chrome sul PC → la WebView di FLEOFIT → *inspect* |
| **Comandare la WebView da script** | `adb forward tcp:9333 localabstract:webview_devtools_remote_<pid>` (il nome si legge da `/proc/net/unix`), poi il protocollo DevTools (`/json` → WebSocket → `Runtime.evaluate`). È così che sono stati provati tasto indietro e galleria |
| **Tasto indietro vero** | `adb shell input keyevent KEYCODE_BACK` |
| **Vibrazione** | `adb shell dumpsys vibrator_manager` → «Recent vibrations»: ogni chiamata dell'app con durata e intensità. Si vede che è partita, non come si sente |
| **Microfono** | Emulatore → ⋯ → Microphone → «Virtual microphone uses host audio input». ⚠️ Si spegne a ogni riavvio dell'emulatore |
| **Chi ha il primo piano** | `adb shell dumpsys window \| grep mCurrentFocus` — è così che si è scoperto che il tasto indietro chiudeva l'app |
| **Galleria** | `adb shell content query --uri content://media/external/images/media` — se il file è lì, Google Foto lo vede |

⚠️ **La tastiera su schermo non compare sull'emulatore** se l'AVD ha `hw.keyboard=yes`: Android
crede che ci sia una tastiera fisica e mostra solo un pallino di Gboard. Non è l'app. Si accende con
`adb shell settings put secure show_ime_with_hard_keyboard 1`.

Resta da provare **su un telefono vero**: come si sente la vibrazione (Android traduce tutto in
impulsi fissi, «leggero» e «successo» si distinguono meno che su iPhone), la qualità del microfono,
e le push con l'app chiusa da giorni.

### A.3 Le differenze da iOS, una per una

1. **Icona e schermo di lancio.** Erano quelli di Capacitor (la X azzurra su bianco).
   `python tools/icone-android.py` li rigenera da `assets/icon.png`: ritaglia la **sola scritta**
   e la mette dentro la zona sicura dell'icona adattiva (il cerchio da 66dp su 108), con il fondo
   `#0B0B0B` come colore a parte. ⚠️ `npx capacitor-assets generate` **non va usato**: scala
   l'icona intera e la maschera circolare taglia «FLEOFIT» ai lati.
   Da Android 12 lo splash lo disegna il **sistema** da `styles.xml`
   (`windowSplashScreenBackground` + `windowSplashScreenAnimatedIcon`): senza quelle righe si
   vedeva l'icona di Capacitor su fondo chiaro prima dell'apertura scura.
   ⚠️ L'icona piccola delle **notifiche** è ancora quella di default: Android la vuole
   monocromatica, e il simbolo non è stato scelto (BACKLOG).
2. 🔴 **L'apertura: un riquadro non veniva dipinto.** Registrando l'avvio, un rettangolo
   `#0B0B0B` copriva «FIT» e arrivava all'angolo in basso a destra; durante l'uscita lasciava
   vedere la Home sotto. Causa: un `clip-path` su una superficie a schermo intero che contiene
   un figlio con un suo livello GPU (il marchio che anima). La WebView di Android sbaglia quel
   ritaglio; Safari no. Due correzioni, e **servono entrambe** (provate una alla volta):
   ritaglio e `drop-shadow` stanno solo su `.apertura-esce` (da ferma la superficie copre lo
   schermo comunque), e in `Apertura.jsx` il marchio è **fratello** del fondo ritagliato, non
   suo figlio. Togliere solo il `drop-shadow` **non** bastava.
3. **Galleria** — `src/lib/galleria.js`. Su Android `@capacitor-community/media` **rifiuta**
   `savePhoto` senza `albumIdentifier` («Album identifier required»); su iOS quel parametro non
   esiste. L'album `FLEOFIT` sta nella memoria multimediale dell'app (`getAlbumsPath()`): Android
   lo indicizza, la foto compare in Google Foto, e **non serve nessun permesso**.
   ⚠️ `createAlbum` rifiuta se l'album esiste già, cioè dalla seconda volta in poi: l'errore si
   ignora. Mai chiamare `Media.savePhoto` diretto: si passa da `salvaInGalleria`.
4. 🔴 **Il tasto indietro di sistema** — `src/lib/indietroAndroid.js`, agganciato in
   `DeeplinkHandler` (`App.jsx`) solo su Android.
   - Senza ascoltatore Capacitor fa `history.back()`: con una modale aperta **cambiava pagina** e
     lasciava la modale appesa sopra quella precedente.
   - Ora: se in cima allo schermo c'è qualcosa **fuori da `#root`**, c'è una modale (sono tutte
     `createPortal` su `body`, §8), e il tasto cerca **dentro di lei** il suo modo di chiudersi:
     prima il velo **se React gli ha dato un `onClick`** (lo legge dalla chiave `__reactProps$`),
     poi la X (`aria-label` che comincia con «Chiudi», o un bottone con la sola icona
     `lucide-x`), poi un bottone con scritto **esattamente** «Annulla», «Chiudi», «Indietro» o
     «No». Se non trova niente non fa niente — e **non cambia pagina**.
   - 🔴 La prima stesura toccava solo il velo, ed era sbagliata: **delle quaranta modali UNA sola
     si chiude dal velo** (il menu delle tre puntine). «Assegna workout» no.
   - ⚠️ **Una modale nuova si chiude col tasto indietro solo se ha una X con `aria-label="Chiudi"`
     o un «Annulla».** È la convenzione da rispettare; una parola diversa («Lascia stare»)
     non viene riconosciuta.
   - 🔴 **Il `canGoBack` di Capacitor mente**: con tre pagine nella cronologia diceva `false`, e
     il tasto chiudeva l'app. Si legge la cronologia di **React Router** (`history.state.idx`,
     `puoTornareIndietro`), la stessa di `useIndietro` (§9-tervicies). Dalla prima pagina l'app
     va in **secondo piano** (`minimizeApp`), come le app di sistema da Android 12.
5. **Manifest** (`android/app/src/main/AndroidManifest.xml`) — tutte righe che su iOS stanno in
   `Info.plist` e che il progetto Capacitor generato non aveva:
   - `RECORD_AUDIO` + `MODIFY_AUDIO_SETTINGS`: senza, `getUserMedia` dà `NotAllowedError` e il
     plugin `VoiceRecorder` `MISSING_PERMISSION`. Note vocali e dettatura IA erano morte.
   - `POST_NOTIFICATIONS`: da Android 13 senza questa riga `requestPermissions()` torna «negato»
     **senza mostrare nessun dialogo**.
   - L'`intent-filter` per **`fleofit://`**: senza, il login Google finiva nel browser e non
     tornava più nell'app (stesso per il link di recupero password).
   - `VIBRATE` la porta già `@capacitor/haptics`.
6. 🔴 **Gli ascoltatori nativi si registravano a OGNI cambio di pagina** — e questo **vale anche
   per iOS**. L'effetto di `DeeplinkHandler` dipendeva da `navigate`, che con `BrowserRouter`
   cambia identità a ogni navigazione, e non aveva cleanup: deep link, tocco su una notifica e
   tasto indietro venivano gestiti tante volte quante pagine si erano aperte (un tasto indietro
   tornava di **due** pagine), e il token push si rinfrescava a ogni navigazione. Ora `navigate`
   passa da un ref, l'effetto ha `[]` e un cleanup che toglie gli handle (`addListener` torna una
   **promessa** di handle). ⚠️ Non ha un test: i test girano sul ramo web.
7. **API solo iOS che su Android lanciano.** `Keyboard.setAccessoryBarVisible` rifiutava e
   saltava il resto dell'avvio nativo in `App.jsx` (compresa la pulizia delle notifiche al
   ritorno nell'app): ora ha il suo `.catch`. Chi aggiunge una chiamata a un plugin deve sapere
   **su quale piattaforma esiste**, o darle un `.catch` che non porti via il resto.
8. **Sign in with Apple** non c'è: `Login.jsx` mostra il bottone solo su `getPlatform() === 'ios'`.
   Il plugin `@capacitor-community/apple-sign-in` resta fra le dipendenze perché `Login.jsx` lo
   importa, ma su Android non ha implementazione. La linea guida 4.8 di Apple qui non vale.
9. **Il microfono**: la WebView di Android sa registrare `audio/mp4` (verificato sull'emulatore,
   Chrome 149), quindi la dettatura IA prende la strada di `MediaRecorder` come su iOS e l'audio
   arriva in un formato che Gemini legge (§9-quindecies). ⚠️ Se una WebView più vecchia sapesse
   solo `audio/webm`, `formatoRegistrabile()` torna `null` e si ripiega sul plugin.
10. **Badge sull'icona**: su Android dipende dal launcher, spesso è un pallino o niente. Non è un
    errore. `sincronizzaBadge` (§8) resta l'unico punto che lo scrive.
11. **La foto in «Da un testo scritto»** (12/10/2026): il plugin `LettoreTesto` qui è
    `android/app/src/main/java/it/federicoleo/fleofit/LettoreTestoPlugin.java`, con **ML Kit**
    (`com.google.mlkit:text-recognition`, modello **dentro** l'app: niente download al primo uso).
    Stesso nome, stesso metodo `leggi({ base64, parole })` e stesse coordinate del gemello iOS
    (frazioni, origine in ALTO a sinistra), quindi il JS non cambia. Tre differenze:
    - 🔴 **È un plugin dell'app**: lo registra `MainActivity.onCreate` con `registerPlugin(…)`,
      **prima** di `super.onCreate`. Dopo, la pagina non lo vede e il bottone non compare.
    - **Due bottoni invece di uno.** La webview di Android non offre «scatta o galleria»: senza
      `capture` apre solo la galleria, con `capture` solo la fotocamera (`BridgeWebChromeClient`
      di Capacitor). `FoglioDaTesto` mette «Scatta una foto» e «Dalla galleria» quando
      `getPlatform() === 'android'`. La fotocamera è quella di sistema: il manifest **non**
      dichiara `CAMERA`, e così Capacitor non deve chiederla (se un giorno la si dichiara per
      altro, Capacitor la chiederà prima di aprire la fotocamera).
    - `parole` (il gergo da proteggere) si ignora: ML Kit non ha un vocabolario personalizzato
      e non corregge in base alla lingua.

    ⚠️ **Scritto sul Mac e MAI compilato** (sul Mac non c'è il JDK): va provato sul PC, vedi A.4.

### A.4 Cosa resta da provare o da fare su Android
- 🔴 **La foto in «Da un testo scritto» (A.3 punto 11), mai compilata.** Sul PC:
  1. `npm run android`, poi `cd android && ./gradlew installDebug`. Al primo build Gradle scarica
     ML Kit; se si ferma su `LettoreTestoPlugin.java`, l'errore è lì e nient'altro è cambiato.
  2. Mettere la foto di prova nella galleria dell'emulatore:
     `adb push tools/prova-foto/lavagna-due-colonne.jpg /sdcard/Pictures/` e poi
     `adb shell am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d file:///sdcard/Pictures/lavagna-due-colonne.jpg`
     (con `export MSYS_NO_PATHCONV=1` in Git Bash, A.1).
  3. Crea Workout → Hyrox → «Da un testo scritto» → **«Dalla galleria»** → la lavagna.
     Atteso, come su iOS: il titolo «HYROX SATURDAY» in cima, poi **tutta** la colonna di
     sinistra e poi **tutta** quella di destra; nell'anteprima 4 blocchi (WarmUp, EMOM, For Time,
     Rest) e 2 righe nelle note. Se le colonne escono mescolate riga per riga, ML Kit ha dato
     coordinate diverse da Vision: guardarle da `chrome://inspect` (A.2) prima di toccare
     `testoDaFoto.js`.
  4. **«Scatta una foto»**: deve aprire la fotocamera (sull'emulatore, la scena virtuale).
  5. ⚠️ Non salvare il workout: l'emulatore parla con il database di produzione (§1.1).
- **La tastiera.** `Keyboard.resize: 'native'` in `capacitor.config.ts` è un'opzione **solo iOS**
  (§9-undecies punto 8): su Android il ridimensionamento lo decide `windowSoftInputMode` nel
  manifest, che non è dichiarato. Da verificare che i campi nelle modali restino sopra la tastiera
  e che le barre ancorate in basso spariscano mentre si scrive (`useTastiera`).
- **Le push**: `google-services.json` c'è; resta da provare l'arrivo con l'app chiusa e il tocco
  che porta al workout (`route`).
- **L'icona monocromatica delle notifiche** (vedi A.3 punto 1).
- Margini di sicurezza (`env(safe-area-inset-*)`) sui fogli dal basso: le pagine viste vanno, i
  fogli vanno guardati uno per uno.
- **Pubblicazione sul Play Store**: firma di rilascio, `versionCode`, scheda dello Store, modulo
  sulla sicurezza dei dati — niente di questo esiste ancora.

---
