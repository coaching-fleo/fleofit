# FLEOFIT — Cose da fare

> Stato al **25 agosto 2026**, fine giornata. `npm test` → 75 · `npm run lint` → 46.
> Ultimo commit `6a28841` su `ios-version`. Aggiornare questo file quando una voce si chiude o
> se ne apre una nuova. Ogni voce dice *cosa*, *perché conta* e *cosa la blocca*:
> senza il perché, fra sei mesi nessuno saprà se vale ancora la pena.
>
> Contesto tecnico completo: [CLAUDE.md](CLAUDE.md) · Verità di prodotto:
> [PRODUCT.md](PRODUCT.md) · Design system: [DESIGN.md](DESIGN.md)

---

## 🔴 Prima della submission App Store

| # | Cosa | Perché |
|---|---|---|
| ~~1~~ | ✅ **CHIUSO il 25/08/2026.** `aps-environment = production`, `get-task-allow` assente, bundle id senza il suffisso `.dev`. Verificato sull'`.ipa` esportato con `tools/verifica-ipa.sh`, non sul sorgente | L'archivio dichiara `development` ed è **normale**: è firmato col profilo di sviluppo del team, ed è l'*export* che rifirma con quello di distribuzione. Guardare l'archivio non risponde alla domanda |
| ~~2~~ | ✅ **CHIUSO il 25/08/2026.** Tutte e cinque le email di `ADMIN_EMAILS` sono nel binario spedito, `demo@fleofit.it` compresa | È il controllo che è mancato a maggio e che ha causato il rifiuto 2.3.1(a). ⚠️ In un'app Capacitor il bundle sta in `App.app/public/assets`, **non** nella radice del `.app`: cercare nel posto sbagliato dà un falso negativo, ed è successo |
| 3 | `demo@fleofit.it` deve riuscire ad **assegnare** un workout — **è l'unico rimasto** | Le tre porte che l'assegnazione attraversa sono verificate sul database vivo il 25/08: INSERT su `athlete_workouts` (`with_check` ✅), il `.select('id')` sulle righe inserite (`qual` ✅) e `send-reminders` mode `immediate` (`_shared/admin.ts` ✅). Ma **il gesto non è mai stato provato**. Vedi `tools/verifica-revisore.sql` |
| 4 | `npx cap sync ios` prima dell'archive | Altrimenti il progetto Xcode resta indietro rispetto a `dist/` |

**Come si rifà tutto**, quando ci sarà una build nuova. L'export scrive su disco e
**non carica niente** (`destination = export`):
```bash
xcodebuild -exportArchive -archivePath <archivio.xcarchive> -exportOptionsPlist tools/ExportOptions-AppStore.plist -exportPath /tmp/fleofit-export -allowProvisioningUpdates && ./tools/verifica-ipa.sh /tmp/fleofit-export
```

> ℹ️ **Il build number nel `pbxproj` non è quello spedito, e va bene così.**
> Con `method: app-store-connect`, `manageAppVersionAndBuildNumber` vale YES per
> impostazione predefinita: Xcode alza da solo il numero oltre l'ultimo presente su
> App Store Connect. Misurato il 25/08/2026: `pbxproj` = 3, archivio = 2, ipa = **4**.
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
| 15 | `React.memo` su `HyroxBlock` e `RunningStepRow` | ~mezza giornata | **Il guadagno maggiore rimasto.** Ogni blocco contiene scroll picker da 102 opzioni: con 8 blocchi sono migliaia di nodi ridisegnati a ogni carattere nel titolo. Ma i nove gestori passati sono arrow inline che catturano `blocks` e `idx`: `React.memo` non farebbe nulla finché non si cambia il contratto padre-figlio (passare `block.id`, gestori funzionali stabilizzati con `useCallback`). ✅ **La rete di sicurezza c'è dal 25/08**: 37 test fissano il contratto dei due componenti, verificati con 13 mutazioni. Resta da fare dopo la submission |
| 16 | 47 problemi di lint (erano 164) | mezza giornata | Restano 15 `no-explicit-any` nelle due Edge Function (le uniche `.ts`: tipizzarle davvero richiede i tipi Deno) e 4 `react-refresh/only-export-components`, che chiedono di spezzare `App.jsx` e `CreateWorkout.jsx` per separare context e costanti dai componenti. Gli altri 28 sono la voce 17 |
| 17 | 28 segnalazioni `react-hooks` | grande | `set-state-in-effect`, `immutability`, `exhaustive-deps`. Sono le regole v7 orientate al React Compiler: segnalano il pattern "fetch nell'effetto che aggiorna lo stato" su cui è costruita tutta l'app. Un refactor vero, non una pulizia |
| 18 | **1.423 valori hex letterali** contro i token di `@theme` | 2-3 giorni | Il rebranding che PRODUCT.md indica come possibile sarebbe un find&replace su 1.423 punti |
| 19 | Test sulle pagine: 2 componenti su ~30 (13.032 righe di JSX) | grande | ✅ Infrastruttura montata il 25/08 (jsdom + testing-library, `vitest.config.js`), 37 test su `HyroxBlock` e `RunningStepRow` (i due che la voce 15 vuole toccare) e 20 sulla coda offline, estratta in `src/lib/offlineQueue.js`. **Restano scoperte le pagine intere**: Home, WorkoutDetail, AthleteDetail e CreateWorkout non si montano senza finti `supabase`, router e AuthContext. Candidato successivo: il timer guidato di WorkoutDetail (`buildTimerSequence`), che è logica pura dentro un file da 3.000 righe |
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
| 21-bis | La coda offline è estratta e testata, ma **`processOfflineQueue` resta in `Home.jsx`** | 2 ore | Il ciclo che riprova gli UPDATE su Supabase non è coperto: serve un finto `supabase`. È anche il punto della voce 14 (last-write-wins) |
| 22 | **Zero occorrenze di `parseNotesAndRpe`** (riverificato il 25/08) | Se un atleta modifica una nota dalla web app, **l'RPE scritto dall'app iOS viene distrutto** e le statistiche ricadono in silenzio sul default 5. È l'unica voce di questo elenco che perde dati, e l'unica che si potrebbe chiudere in mezz'ora: basta retroportare `src/lib/rpe.js`, anche solo in lettura |
| 23 | Inter dichiarato e mai caricato (riverificato il 25/08: `src/index.css` di `main` dice ancora `font-family: 'Inter', sans-serif`) | La web app rende con un fallback di sistema arbitrario. Qui è già risolto: font di sistema espliciti |
| 24 | 172 `text-gray-500` a 3.45:1 (riverificato il 25/08: 172 su `main`, **0** qui) | Sotto il minimo AA per il testo |

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
