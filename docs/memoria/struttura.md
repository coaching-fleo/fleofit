# La struttura dei file, con le note su ognuno

> Spostato da `CLAUDE.md` il 07/10/2026, **senza cambiare il testo**. I rimandi
> «§9-…» puntano a sezioni che ora stanno in altri file di questa cartella:
> si trovano con `grep -rn '^## 9-<nome>' docs/memoria`. L'indice è in `CLAUDE.md`.

## 3. Struttura dei file

> Struttura del branch `ios-version`. Su `main` mancano `ios/`, `capacitor.config.ts`,
> `privacy-policy.html`, `src/lib/` e la Edge Function `ai-workout`.
> ⚠️ `TVDashboard.jsx` **c'è anche su `main`**, in una versione diversa (§1.1).

```
vite.config.ts                 # costruisce l'app
vitest.config.js               # la testa (jsdom) — ⚠️ MAI creare un vite.config.js: Vite risolve
                               #   .js prima di .ts e maschererebbe quello vero, in silenzio
src/
├─ main.jsx                    # entry, importa index.css
├─ supabaseDemo.js            # ⚠️ Supabase finto in memoria — `npm run demo` (§9-quinvicies).
│                              #   NON entra nel bundle: il flag è sostituito a build time
├─ demoSemi.js                # i dati di prova: date RELATIVE, un atleta per ogni ramo
├─ DemoBadge.jsx              # il nastro «ambiente di prova», solo con VITE_DEMO=1
├─ App.jsx                     # routing, AuthContext, Onboarding, ProtectedRoute, DeeplinkHandler
│                              #   ⚠️ qui vive ADMIN_EMAILS (§9 punto 7)
│                              #   ⚠️ ProtectedRoute è UNA route di layout, non un involucro
│                              #   per rotta: non riavvolgere le pagine (§9-noviesdecies)
├─ __tests__/                  # 2 test su App.jsx montata: navigazione e tab bar (§9-noviesdecies)
├─ index.css                   # Tailwind @theme + animazioni globali (page-transition, modal-transition)
├─ supabaseClient.js           # createClient con URL + anon key hardcodati
├─ useTouchDrag.js             # hook drag&drop touch nativo (usato da CreateWorkout)
├─ useTastiera.js              # la tastiera di sistema è aperta? (barre ancorate in basso)
├─ useBottomSheet.js           # ⚠️ l'UNICO bottom sheet fatto bene: entrata, maniglia, scroll bloccato (§9-duodecies)
├─ useIndietro.js              # ⚠️ il tasto «indietro», uno per tutta l'app: NON è `navigate(-1)`
│                              #   e NON è una destinazione fissa — sono i due modi sbagliati (§9-tervicies)
├─ useNumeroCheSale.js        # ⚠️ il numero che sale (§9-septtricies). La curva è ESPONENZIALE
│                              #   e l'ultimo passo è ESATTO: 2^(-10) è 1/1024, quindi senza il
│                              #   salto finale un carico di 22.000 resta a 21.978 per sempre
├─ lib/                        # logica pura, l'unica parte con test
│  ├─ alert.js                 # mostraAlert/mostraErrore: alert applicativo senza passare props
│  ├─ andamento.js             # aderenza, carico, volume e sforzo della scheda atleta — TUTTI
│  │                           #   sulla stessa finestra di 30 giorni (§9-terdecies)
│  ├─ appleLogin.js            # ⚠️ Sign in with Apple: il nonce va HASHATO per il plugin e
│  │                           #   in chiaro per Supabase, e il nome di Apple arriva UNA
│  │                           #   volta sola (§9-sexvicies)
│  ├─ aptica.js                # battito(): il colpetto dei picker, era in due copie
│  ├─ badge.js                 # ⚠️ l'UNICO punto che scrive il badge iOS (§8)
│  ├─ blockColors.js           # TYPE_COLORS, unificata dalle 5 copie sparse
│  ├─ blockHints.js            # BLOCK_HINT: didascalie in chiaro dei tipi di blocco (§9-ter)
│  ├─ galleria.js              # ⚠️ salvaInGalleria: su Android il plugin vuole un ALBUM (§A.3)
│  ├─ indietroAndroid.js       # ⚠️ il tasto indietro di sistema Android: chiude prima la modale (§A.3)
│  ├─ cascata.js               # ⚠️ SOLO per le liste ANNIDATE (archivio, rubrica): `nth-child`
│  │                           #   riparte a ogni gruppo, quindi serve un indice che scorre.
│  │                           #   `MASSIMO_CASCATA` deve coincidere col tetto in index.css
│  ├─ categorie.js             # CORSIA/corsia/categoriaDi: la Regola della Corsia in un punto solo
│  ├─ coach.js                 # ⚠️ COACH: il nome del coach è una COSTANTE, non una query —
│  │                            #   dal lato atleta non è interrogabile (§9-duodetricies)
│  ├─ codiceInvito.js          # ⚠️ il codice invito: normalizza anche il LINK del coach, e
│  │                           #   dice perché «non esiste» e «già usato» sono lo stesso
│  │                           #   messaggio — la RLS non li distingue (§9-septvicies)
│  ├─ notaVocale.js            # isVoiceNoteValid: il soft delete `#deleted=` si filtra sempre
│  ├─ pausa.js                 # ⚠️ «atleta in pausa» dentro athletes.notes — NON è una colonna (§9-decies)
│  ├─ rigaAtleta.js            # ⚠️ l'aderenza settimanale della rubrica — la settimana comincia di
│  │                           #   LUNEDÌ, e chi non ha niente in programma NON è a zero (§9-septdecies)
│  ├─ rigaArchivio.js          # ⚠️ meta, gruppi per mese e chip dell'archivio — l'ordine è per DATA, non
│  │                           #   per creazione, o lo stesso mese ricompare nello scroll (§9-sedecies)
│  ├─ rigaBlocco.js            # le didascalie del blocco: parametri e specifiche (§9-duodecies).
│  │                           #   ⚠️ `parametriBlocco` è dove vivono i RIPIEGHI dei giri e degli
│  │                           #   intervalli, gli stessi di `durataBlocco` (§9-unetvicies)
│  ├─ rigaImpostazioni.js     # ⚠️ i numeri delle righe di Impostazioni: `null` finché i codici
│  │                           #   non sono arrivati, e un conteggio mancante SPARISCE invece di
│  │                           #   diventare 0 (§9-duoetvicies)
│  ├─ previsione.js           # ⚠️ il modello predittivo del carico (§9-quatervicies).
│  │                           #   ⚠️ Le due SCALE di durata non ci sono più (§9-undetricies),
│  │                           #   ma restano due `rpeAtteso` diversi: `caricoPrevisto` usa
│  │                           #   quello del builder, `caricoAssegnazione` quello dello STORICO
│  ├─ reportAtleta.js          # ⚠️ il report del singolo: diario, movimenti con i carichi
│  │                           #   (giri del blocco compresi), cinque settimane e le
│  │                           #   PROPOSTE per la successiva (§9-vicies-bis)
│  ├─ reportSettimanale.js     # ⚠️ i numeri del report coach: aderenza sulla parte TRASCORSA
│  │                           #   della settimana, carico che esclude chi non ha segnato l'RPE,
│  │                           #   rapporto acuto/cronico e verdetti (§9-vicies)
│  ├─ recapStoria.js           # ⚠️ l'elenco e i numeri della grafica da storia — la durata
│  │                           #   è una STIMA e lo deve dire, l'RPE è quello DICHIARATO o
│  │                           #   la cella non esiste, e su un libero si legge la nota del
│  │                           #   COACH mai quella dell'atleta (§9-unetvicies)
│  ├─ rigaCalendario.js       # ⚠️ griglia, segno del giorno e i tre numeri del mese — il volume
│  │                           #   dice «≈» quando ha dovuto lasciare fuori qualcosa (§9-octodecies)
│  ├─ stiliCard.js             # CARD/LABEL/RIGA/VETRO/CARTA_RIGA(_BASE) — costanti, NON componenti
│  │                           #   (§9-octies punto 3). ⚠️ Il bordo si DICHIARA, non si sovrascrive (§9-octodecies)
│  ├─ constants.js             # ERGOMETERS e affini
│  ├─ offlineQueue.js          # ⚠️ coda offline + leggiJson/scriviJson — vedi §9 regola 0-bis
│  ├─ pushToken.js             # rinfresco del token FCM
│  ├─ rpe.js                   # parseNotesAndRpe / formatNotesWithRpe
│  ├─ statistiche.js           # carico settimanale, completamento, distribuzione RPE.
│  │                            #   ⚠️ `minutiSettimana` misura la settimana di CALENDARIO
│  │                            #   (lunedì), non sette giorni a ritroso (§9-duodetricies)
│  ├─ statisticheCoach.js      # i numeri della Home coach: feedback, squadra del giorno, fermi, scaduti, copertura
│  ├─ stimaWorkout.js         # ⚠️ L'UNICO stimatore di durata dei blocchi Hyrox: dal 09/09
│  │                           #   `durataWorkout` lo somma invece di rifare il conto (§9-undetricies)
│  │                           #   ⚠️ durata STIMATA e RPE atteso del builder — non è un dato vero
│  │                           #   (§9-undecies). L'RPE è una media di POTENZA, non aritmetica.
│  │                           #   ⚠️ Esiste un SECONDO `rpeAtteso` in statistiche.js, che è un
│  │                           #   calcolo diverso per le stesse parole: la Home parte da
│  │                           #   `sections.intensity` e ripiega su una tabella per tipo di
│  │                           #   blocco. Lo stesso workout può quindi dire due numeri diversi
│  │                           #   in due schermate — non è stato unificato, sta in BACKLOG
│  ├─ timerSequence.js         # buildTimerSequence + getNormalizedBlocks (§5 legacy)
│  ├─ workoutTitle.js          # titolo generato dalla data (c'è anche su main)
│  └─ __tests__/               # 246 test — il grosso della copertura (§9 punto 11)
├─ test/
│  ├─ setup.js                 # jsdom, localStorage in memoria, finto Capacitor (§9-sexies)
│  ├─ fintoSupabase.js         # catena fluente via Proxy — riutilizzabile per ogni pagina
│  └─ montaPagina.jsx          # router e AuthContext VERI, non finti
├─ components/
│  ├─ HomeAtletaUI.jsx         # i pezzi visivi della Home atleta (§9-octies) — sola presentazione
│  ├─ HomeAtletaVuotiUI.jsx    # ⚠️ gli stati SENZA STORICO della Home atleta (§9-duodetricies):
│  │                            #   giorno 1, prima settimana, riposo. Nessuna cella mostra
│  │                            #   uno zero — è la regola, non una preferenza
│  ├─ HomeCoachUI.jsx          # i pezzi visivi della Home coach (§9-nonies) — sola presentazione
│  ├─ CreaWorkoutUI.jsx        # i pezzi visivi del builder (§9-undecies) — RiepilogoWorkout e BarraAzioni
│  │                           #   servono ANCHE la scheda: stesso codice in scrittura e in lettura
│  ├─ Apertura.jsx             # ⚠️ l'apertura dell'app (§9-duodequadragies): l'arco che
│  │                           #   risale e scopre la Home. Il PRIMO fotogramma sta in
│  │                           #   index.html, non qui — e il marchio NON ha un'entrata
│  ├─ AudioVisualizer.jsx      # ⚠️ l'UNICA forma d'onda: note vocali E dettatura IA (§9-quindecies)
│  ├─ RecapAllenamento.jsx     # ⚠️ SEI RIGHE: `lazy()` + `Suspense`. Il confine sta QUI e non
│  │                           #   nelle tre pagine, o il recap torna nel chunk d'ingresso
│  ├─ RecapDati.jsx            # le due letture del recap: la finestra di 90 giorni e il
│  │                           #   conteggio di SEMPRE. ⚠️ Fallita, si ferma a `recapMinimo`
│  ├─ RecapUI.jsx              # i pezzi visivi del recap (§9-quadragies) — sola presentazione.
│  │                           #   ⚠️ Le schede avanzano DA SOLE: la barra è un orologio,
│  │                           #   la tenuta lo ferma, e l'ultima non si chiude mai
│  ├─ Puntini.jsx              # ⚠️ i tre puntini della CTA contratta. Sta in un file SUO perché
│  │                           #   lo usa RpeModal, montata dalla Home: importarlo da
│  │                           #   CreaWorkoutUI trascinerebbe 24 KB di builder lì dentro
│  ├─ WorkoutDetailUI.jsx      # i pezzi visivi della scheda workout (§9-duodecies) — sola presentazione
│  ├─ StoriaUI.jsx             # ⚠️ la grafica da mettere SOPRA una storia + il foglio da cui
│  │                           #   si esporta. Sfondo `transparent` di proposito (§9-unetvicies)
│  ├─ SchedaAtletaUI.jsx       # i pezzi visivi della scheda atleta (§9-terdecies) — sola presentazione
│  ├─ ArchivioUI.jsx           # i pezzi visivi dell'archivio (§9-sedecies) — sola presentazione.
│  │                           #   ⚠️ CampoRicerca e IntestazioneSezione servono ANCHE la rubrica atleti
│  ├─ AtletiUI.jsx             # i pezzi visivi della rubrica atleti (§9-septdecies) — sola presentazione
│  ├─ CalendarioUI.jsx         # i pezzi visivi del calendario (§9-octodecies) — sola presentazione
│  ├─ ImpostazioniUI.jsx       # i pezzi visivi delle impostazioni (§9-duoetvicies) — sola
│  │                           #   presentazione. ⚠️ `FoglioCodici` sta qui, non in una rotta nuova
│  ├─ LoginUI.jsx              # i pezzi visivi dell'accesso (§9-septvicies) — sola presentazione.
│  │                           #   ⚠️ Le otto caselle sono UN campo solo disegnato in otto
│  ├─ PrevisioneUI.jsx         # il semaforo del foglio di assegnazione (§9-quatervicies) —
│  │                           #   ⚠️ NON ha il verde: chi non ha niente da dire non ha riga
│  ├─ ReportAtletaUI.jsx       # i pezzi visivi del report del singolo (§9-vicies-bis)
│  ├─ ReportUI.jsx             # i pezzi visivi del report settimanale (§9-vicies) — sola presentazione.
│  │                           #   ⚠️ UNA sola cornice colorata in pagina: la fascia «Da fare adesso»
│  ├─ Navbar.jsx               # bottom nav in vetro, voce attiva in pillola, voci variabili per ruolo
│  ├─ CustomModals.jsx         # CustomAlert + CustomConfirm + AlertHost
│  └─ CustomDatePicker.jsx     # date picker custom dark
└─ pages/
   ├─ Home.jsx                 # dashboard atleta + coach + centro notifiche + Live Coach Cam
   ├─ Login.jsx                # benvenuto → email (passo 1) → codice invito (passo 2) → recupero.
   │                           #   ⚠️ Il vicolo cieco che chiudeva era in App.jsx, non qui (§9-septvicies)
   ├─ Calendar.jsx             # calendario mensile, creazione "Evento/Gara"
   ├─ CreateWorkout.jsx        # workout builder (Hyrox / Running / Custom) + generazione IA
   ├─ WorkoutDetail.jsx        # scheda workout, timer guidato, PDF, story IG, note vocali, TV
   ├─ Athletes.jsx             # rubrica atleti + cestino "Eliminati di recente" (admin)
   ├─ AthleteDetail.jsx        # scheda atleta: workout, PR, statistiche (è anche /profile)
   ├─ WorkoutsArchive.jsx      # archivio storico workout
   ├─ AthleteReport.jsx        # /report/:id — il report del singolo atleta (§9-vicies-bis).
   │                           #   🔒 Solo coach, come /report
   ├─ WeeklyReport.jsx         # /report — il report settimanale del coach (§9-vicies).
   │                           #   🔒 L'UNICA pagina senza una versione atleta: rimanda alla Home
   ├─ Settings.jsx             # notifiche, backup/restore JSON, codici invito, BLE, password
   ├─ TVDashboard.jsx          # /tv — dashboard fullscreen per TV/Chromecast, codice a 4 cifre
   ├─ motivations.js           # 15 frasi motivazionali + getDailyMotivation() con anti-ripetizione
   └─ __tests__/               # 157 test su componenti e pagine montate (§9 punto 11)
tools/                            # non entra nell'app: serve alle verifiche pre-submission
   ├─ icone-android.py             # rigenera icone e splash Android dal marchio (§A.3)
   ├─ ExportOptions-AppStore.plist # esporta un .ipa in locale, NON carica niente
   ├─ verifica-ipa.sh              # 6 controlli sul binario vero (§9-ter)
   └─ verifica-revisore.sql        # solo letture: account demo, dati, policy (§9-ter)
android/                          # il progetto Gradle (Capacitor). A mano si toccano solo:
   ├─ app/src/main/AndroidManifest.xml   # permessi e deep link (§A.3 punto 5)
   ├─ app/src/main/res/values/styles.xml # splash di sistema (§A.3 punto 1)
   └─ app/google-services.json           # Firebase, versionato (§A.1)
supabase/
   ├─ functions/_shared/admin.ts   # ADMIN_EMAILS condivisa dalle due Edge Function (§9 punto 7)
   ├─ functions/send-reminders/    # notifiche push (5 modalità)
   ├─ functions/ai-workout/        # Gemini: trascrizione audio + generazione blocchi JSON
   └─ schema/                      # fotografia delle policy RLS — NON è una migrazione (§4-bis)
```
> I file morti che questa sezione elencava (`App.css`, `pages/patch.js`, `pages/Invite.jsx`,
> `pages/useTouchDrag.js`, `index.ts` in root) **non esistono più**: rimossi il 24-25/08/2026.

---
