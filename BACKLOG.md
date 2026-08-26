# FLEOFIT — Cose da fare

> Stato al **26 agosto 2026**, mattina. `npm test` → 75 · `npm run lint` → 46.
> Ultimo commit `6a28841` su `ios-version`. Aggiornare questo file quando una voce si chiude o
> se ne apre una nuova. Ogni voce dice *cosa*, *perché conta* e *cosa la blocca*:
> senza il perché, fra sei mesi nessuno saprà se vale ancora la pena.
>
> Contesto tecnico completo: [CLAUDE.md](CLAUDE.md) · Verità di prodotto:
> [PRODUCT.md](PRODUCT.md) · Design system: [DESIGN.md](DESIGN.md)

---

## ✅ Prima della submission App Store — i tre controlli sono chiusi

> Chiusi il 26/08/2026. Restano qui, barrati, perché **vanno rifatti a ogni build
> nuova**: sono controlli sul binario, non sul sorgente, e il sorgente giusto non
> garantisce il binario giusto. Il comando per rifarli tutti è più sotto.

| # | Cosa | Perché |
|---|---|---|
| ~~1~~ | ✅ **CHIUSO il 26/08/2026.** `aps-environment = production`, `get-task-allow` assente, bundle id senza il suffisso `.dev`. Verificato sull'`.ipa` esportato con `tools/verifica-ipa.sh`, non sul sorgente | L'archivio dichiara `development` ed è **normale**: è firmato col profilo di sviluppo del team, ed è l'*export* che rifirma con quello di distribuzione. Guardare l'archivio non risponde alla domanda |
| ~~2~~ | ✅ **CHIUSO il 26/08/2026.** Tutte e cinque le email di `ADMIN_EMAILS` sono nel binario spedito, `demo@fleofit.it` compresa | È il controllo che è mancato a maggio e che ha causato il rifiuto 2.3.1(a). ⚠️ In un'app Capacitor il bundle sta in `App.app/public/assets`, **non** nella radice del `.app`: cercare nel posto sbagliato dà un falso negativo, ed è successo |
| ~~3~~ | ✅ **CHIUSO il 26/08/2026.** `demo@fleofit.it` assegna un workout, provato dall'app. È il rilievo che ha causato il rifiuto **2.3.1(a)** di maggio: l'account dato ad Apple era inerte | Il gesto attraversa **tre porte distinte**, tutte verificate anche sul database vivo: INSERT su `athlete_workouts` (`with_check`), il `.select('id')` sulle righe inserite (`qual`) e `send-reminders` mode `immediate` (`_shared/admin.ts`). Falliscono in modi diversi: errore a schermo → l'INSERT; workout assegnato ma nessuna push → `send-reminders`; nessun errore ma niente in tabella → il `.select`. Query in `tools/verifica-revisore.sql` |
| 4 | **`npm run ios`** (build + sync) prima di **qualunque** compilazione da Xcode, non solo prima dell'archive | Xcode compila `ios/App/App/public`, che è una copia del bundle: senza sync costruisce con il codice della sincronizzazione precedente. Successo il 26/08/2026 — una funzione appena rimossa continuava a comparire nell'app, e sembrava che la modifica non avesse funzionato. Lo script `npm run ios` esiste per questo |
| 5 | ⚠️ **Generare un codice invito attivo** (Impostazioni → Codici invito) | Rilevato `codici_attivi = 0` il 26/08. La registrazione è chiusa per scelta: senza codice valido il `ProtectedRoute` fa signOut verso `/login?error=unauthorized`. Un revisore che provasse a registrarsi come atleta verrebbe espulso senza spiegazione, e "flusso che non funziona" è il genere di rilievo che ha prodotto il 2.3.1(a). Costa un minuto |

**Come si rifà tutto**, quando ci sarà una build nuova. L'export scrive su disco e
**non carica niente** (`destination = export`):
```bash
xcodebuild -exportArchive -archivePath <archivio.xcarchive> -exportOptionsPlist tools/ExportOptions-AppStore.plist -exportPath /tmp/fleofit-export -allowProvisioningUpdates && ./tools/verifica-ipa.sh /tmp/fleofit-export
```

> ℹ️ **Il build number nel `pbxproj` non è quello spedito, e va bene così.**
> Con `method: app-store-connect`, `manageAppVersionAndBuildNumber` vale YES per
> impostazione predefinita: Xcode alza da solo il numero oltre l'ultimo presente su
> App Store Connect. Misurato il 26/08/2026: `pbxproj` = 3, archivio = 2, ipa = **4**.
> È la spiegazione dell'incremento "misterioso" del 24/08 annotato in CLAUDE.md §9-ter.

---

## 🧊 Congelati fino all'approvazione App Store

> Regola 0-bis di [CLAUDE.md](CLAUDE.md): lo schema del database non si tocca finché
> l'app non è approvata. Il DB è uno solo e serve anche la web app in produzione,
> senza staging. **Le letture restano permesse.**

| # | Cosa | Gravità | Perché è congelato |
|---|---|---|---|
| 5 | `personal_records` è `ALL / authenticated / true`: qualunque utente loggato legge, modifica e **cancella i PR di tutti** | 🔴 | Restringere una policy è non additivo |
| 6 | `invitation_codes`: un anonimo con la anon key **enumera i codici validi** e si registra. La registrazione chiusa non è chiusa | 🔴 | Serve una funzione `security definer` che risponda sì/no senza esporre la tabella |
| 7 | `push_subscriptions`: la policy `Enable all operations` annulla in OR le due scritte correttamente. Ogni atleta legge **tutti i token push** | 🟠 | Rimuoverla è restrittivo |
| 8 | `workouts`: `SELECT` pubblica. Chiunque abbia la anon key scarica **l'intera programmazione** | 🟠 | Serve alla TV, che gira senza login: va limitata al workout di una `tv_sessions` attiva |
| 9 | `tv_sessions`: `ALL / public / true`. Chiunque può sovrascrivere una sessione e **dirottare un cast** | 🟡 | Restrittivo |
| 10 | I bucket `athlete-photos` e `voice-notes` sono **pubblici** | 🟠 | Passare a privato + URL firmati richiede di rigenerare gli URL già salvati in `athlete_workouts.voice_note_url` |
| 11 | `delete_expired_voice_notes()` fa `DELETE FROM storage.objects`: rimuove i metadati ma **non i byte**. I file restano orfani per sempre | 🟠 | Va riscritta usando l'API Storage. Conta se un atleta chiede la cancellazione dei propri dati |
| 12 | Il gestore `EXCEPTION WHEN OTHERS` della stessa funzione è **vuoto**: ogni errore sparisce in silenzio | 🟠 | Stessa funzione del punto 11 |
| 13 | Le liste admin sono **tre** (`src/App.jsx`, `supabase/functions/_shared/admin.ts`, policy RLS). Aggiungere un admin richiede tre modifiche coordinate | 🔴 | Il fix è `public.is_admin()` richiamata da tutte le policy: cambia le policy, quindi è congelato. **È il meccanismo che ha causato il rifiuto di maggio** |
| 14 | Coda offline **last-write-wins**: un'azione accodata ieri sovrascrive un valore aggiornato oggi dalla web app | 🟡 | Risolverlo richiede un confronto lato server, quindi una migrazione |

---

## 🟠 Debito tecnico

| # | Cosa | Dimensione | Note |
|---|---|---|---|
| ~~15~~ | ✅ **`HyroxBlock` memoizzato il 26/08/2026** | I nove gestori erano arrow inline che catturavano `blocks` e `idx`, quindi `React.memo` da solo non avrebbe saltato nulla. Il contratto ora passa `block.id` e il padre usa `useCallback([])` con aggiornamenti funzionali. ⚠️ Il decimo gestore instabile non era nell'elenco: `onReorder` di `useTouchDrag`, da cui dipende `getTouchHandlers`. Misurato: digitare 8 caratteri nel titolo faceva 8 render sprecati per blocco, ora 0. Coperto da 5 test su `CreateWorkout` **vero**, con 5 mutazioni |
| ~~15-bis~~ | ✅ **`RunningStepRow` memoizzato il 26/08/2026** | Misurato: 7 caratteri nel titolo = 7 render sprecati per fase, ora 0. ⚠️ A differenza di `HyroxBlock` il **contratto non è cambiato**: passava già l'indice a `onMoveUp` e `step.id` a `onRemove`, quindi bastava stabilizzare i gestori. I 16 test sul contratto sono rimasti verdi senza una modifica, ed è la conferma che l'asimmetria fra i due componenti è voluta |
| 16 | 47 problemi di lint (erano 164) | mezza giornata | Restano 15 `no-explicit-any` nelle due Edge Function (le uniche `.ts`: tipizzarle davvero richiede i tipi Deno) e 4 `react-refresh/only-export-components`, che chiedono di spezzare `App.jsx` e `CreateWorkout.jsx` per separare context e costanti dai componenti. Gli altri 28 sono la voce 17 |
| 17 | 28 segnalazioni `react-hooks` | grande | `set-state-in-effect`, `immutability`, `exhaustive-deps`. Sono le regole v7 orientate al React Compiler: segnalano il pattern "fetch nell'effetto che aggiorna lo stato" su cui è costruita tutta l'app. Un refactor vero, non una pulizia |
| 18 | **1.423 valori hex letterali** contro i token di `@theme` | 2-3 giorni | Il rebranding che PRODUCT.md indica come possibile sarebbe un find&replace su 1.423 punti |
| 19 | Test sulle pagine: **CreateWorkout e Home** si montano | grande | ✅ Il blocco non erano i finti `supabase` e router: era un **`localStorage` rotto in jsdom** più `registerPlugin` mancante nel finto `@capacitor/core`. Risolti il 26/08 in `src/test/setup.js`. Ora ci sono `src/test/fintoSupabase.js` (catena fluente via Proxy, riutilizzabile) e `montaPagina.jsx` (router + AuthContext veri): 5 test su `CreateWorkout`, 8 su `Home`. **Restano `WorkoutDetail` (3.052 righe) e `AthleteDetail` (2.727)**, i due file più grandi |
| 20 | I due branch divergono di **49 / 55** | cresce ogni giorno | Ogni correzione fatta su un branch e non sull'altro allarga il divario — ma il travaso **sta avvenendo**: `main` ha ricevuto 8 commit il 24-25/08. Vedi CLAUDE.md §1.1 |
| 20-bis | **14 vulnerabilità npm high/critical**, tutte preesistenti | da valutare | Scoperte il 25/08 installando le librerie di test, che non ne hanno introdotta nessuna. Le porta `@capacitor/cli` (`tar`, critical), `@capacitor/assets` (`sharp`), `vite`, `postcss`, `ws`, `tmp`. **Una sola tocca l'app spedita**: `react-router`, che è una dipendenza di runtime; le altre stanno nella catena di build e non finiscono nel bundle. Da guardare prima di alzare le versioni, non durante una revisione App Store |
| 21 | Badge iOS: **9 punti di scrittura** in `Home.jsx` | 2 ore | Funziona; il rischio è che una modifica futura ne aggiorni otto su nove. Da centralizzare in un unico effetto su `unreadCount`, **con una push reale per provarlo** |

---

## 📋 Su `main` (web app in produzione)

> ⚠️ **`main` NON è congelato**: fra il 24 e il 25 agosto ha ricevuto **8 commit**, cioè le
> correzioni fatte qui e riportate lì a mano una a una (backup del database e dei bucket,
> titolo facoltativo, accessibilità, notifiche di assegnazione, cestino degli atleti).
> Le tre voci qui sotto sono quelle che **non** sono state riportate, verificate su
> `origin/main` il 25/08. Prima di dire che qualcosa manca su `main`, fare `git fetch` e
> controllare: questo documento ha già sbagliato due volte su questo punto (CLAUDE.md §1.1).

| # | Cosa | Conseguenza |
|---|---|---|
| ~~21-bis~~ | ✅ **`processOfflineQueue` coperta il 26/08/2026**, e la copertura ha trovato un guasto: bastava un `null` nella coda — JSON valido, quindi `leggiCoda` lo lasciava passare — perché `action.type` lanciasse. Il ciclo moriva lì: la coda non si svuotava più, il workout valido che seguiva non partiva mai, e il banner «Sincronizzazione in corso…» restava a girare per sempre. Corretto: una voce irrecuperabile si scarta, una valida rifiutata dal server si tiene, e lo spegnimento del banner sta in un `finally` | Resta aperta la voce 14 (last-write-wins), che è congelata |
| 22 | **Zero occorrenze di `parseNotesAndRpe`** (riverificato il 25/08) | Se un atleta modifica una nota dalla web app, **l'RPE scritto dall'app iOS viene distrutto** e le statistiche ricadono in silenzio sul default 5. È l'unica voce di questo elenco che perde dati, e l'unica che si potrebbe chiudere in mezz'ora: basta retroportare `src/lib/rpe.js`, anche solo in lettura |
| 23 | Inter dichiarato e mai caricato (riverificato il 25/08: `src/index.css` di `main` dice ancora `font-family: 'Inter', sans-serif`) | La web app rende con un fallback di sistema arbitrario. Qui è già risolto: font di sistema espliciti |
| 24 | 172 `text-gray-500` a 3.45:1 (riverificato il 25/08: 172 su `main`, **0** qui) | Sotto il minimo AA per il testo |

---

## ✅ Difetti chiusi

| # | Cosa | Come |
|---|---|---|
| ~~29~~ | **Il timer guidato sbagliava le fasi di corsa definite a distanza.** `parseDuration` toglie le lettere e legge il numero rimasto come minuti: `400m` → 24.000 secondi, cioè **6h40m**; una sessione di 6×400m produceva un timer che non avanzava mai. `5 km` faceva il danno opposto, 5 minuti | ✅ **Chiuso il 26/08/2026 rimuovendo il timer dagli allenamenti di corsa** (decisione del committente): le fasi si seguono con l'orologio, non con un conto alla rovescia. La regola sta in `haTimerGuidato()` — un punto solo, usato sia dal bottone sia dalla costruzione della sequenza. ⚠️ Due conseguenze volute: la **Live Coach Cam non vede più gli atleti che corrono** (la presenza è tracciata dentro `WorkoutTimer`), e il **cast su TV mostra il piano statico**, senza passo evidenziato |

---

## 💡 Idee di prodotto

> Dettagli e motivazioni nel report di analisi del 24/08/2026.

| # | Cosa | Blocco |
|---|---|---|
| 25 | **«Risultato», non solo «Fatto»** — capire quanto è stato fatto, non solo che è stato fatto: campi generati dalla struttura del workout, PR automatici, «l'ultima volta…». È la fondazione delle altre due | Richiede la tabella `workout_results` → congelato |
| 26 | **Hyrox Race Engine** — tempo di gara previsto e split obiettivo, dai risultati reali dell'atleta. Nessun competitor può copiarlo: nessuno ha insieme la programmazione del coach e il vocabolario Hyrox | Dipende dal 25 |
| 27 | **Coach Copilot** — digest settimanale sui dati che ci sono già: chi sta affogando, chi è pronto a caricare, chi sta sparendo. Ribalta l'IA da «scrive i workout» a «guarda gli atleti» | Nessuno, ma ha più valore dopo il 25 |
| 28 | **App per Apple Watch** | Progetto a sé, fuori da Capacitor |

---

## ✅ Chiuso il 24-25 agosto 2026

Backup del database (salvava 3 tabelle su 8, senza `personal_records`) · backup dei
bucket Storage · ordine backup/cancellazione invertito · `ai-workout` aperta a
Internet · autorizzazione per modalità su `send-reminders` · `demo@fleofit.it` nelle
policy RLS · safe area · tastiera · navbar · `lang="it"` · pinch-to-zoom · iPad ·
171 `aria-label` · contrasti sotto il 4.5:1 · pavimento tipografico a 11 px ·
16 touch target sotto i 44 pt · timer su orologio assoluto · font di sistema ·
`TYPE_COLORS` unificata · 23 `alert()` nativi · 5 file morti · code splitting
(1.312 → 548 kB) · titolo del workout facoltativo · notifiche mancanti su 3 dei 4
punti di assegnazione · atleti che si auto-ripristinavano · cestino con ripristino ·
**ESLint che non aveva mai analizzato l'app** e i 4 `ReferenceError` che nascondeva ·
18 test verificati per mutazione · liste admin da 4 a 3 · **i 34 catch vuoti**
che inghiottivano errori, e i tre guasti silenziosi che nascondevano (cache e coda
offline corrotte che non si riparavano più, registrazione vocale persa senza
messaggio) · codice morto: `updateWorkoutNote`, `SCHEMES`, `isDistance`,
`MINUTES_OPTIONS`, `timeToSeconds`/`formatTime` e 10 import inutilizzati
