# FLEOFIT — Cose da fare

> Stato al **25 agosto 2026**. Aggiornare questo file quando una voce si chiude o
> se ne apre una nuova. Ogni voce dice *cosa*, *perché conta* e *cosa la blocca*:
> senza il perché, fra sei mesi nessuno saprà se vale ancora la pena.
>
> Contesto tecnico completo: [CLAUDE.md](CLAUDE.md) · Verità di prodotto:
> [PRODUCT.md](PRODUCT.md) · Design system: [DESIGN.md](DESIGN.md)

---

## 🔴 Prima della submission App Store

| # | Cosa | Perché |
|---|---|---|
| 1 | `aps-environment` sul binario esportato deve dire `production` | Il file dichiara `development` ed è usato in **entrambe** le configurazioni. Xcode dovrebbe sostituirlo archiviando con un profilo App Store, ma se non lo facesse **nessun utente riceverebbe le push** e te ne accorgeresti solo dopo la pubblicazione |
| 2 | `grep -l "demo@fleofit.it" dist/assets/*.js` deve stampare un file | È il controllo che è mancato a maggio e che ha causato il rifiuto 2.3.1(a) |
| 3 | `demo@fleofit.it` deve riuscire ad **assegnare** un workout | Le policy sono verificate a livello di database (`check_ok = true`), ma il gesto non è mai stato provato da quell'account |
| 4 | `npx cap sync ios` prima dell'archive | Altrimenti il progetto Xcode resta indietro rispetto a `dist/` |

**Comando per il punto 1**, sull'`.ipa` esportato:
```bash
codesign -d --entitlements - --xml Payload/App.app 2>/dev/null | plutil -p - | grep aps-environment
```

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
| 15 | `React.memo` su `HyroxBlock` e `RunningStepRow` | ~mezza giornata | **Il guadagno maggiore rimasto.** Ogni blocco contiene scroll picker da 102 opzioni: con 8 blocchi sono migliaia di nodi ridisegnati a ogni carattere nel titolo. Ma i nove gestori passati sono arrow inline che catturano `blocks` e `idx`: `React.memo` non farebbe nulla finché non si cambia il contratto padre-figlio (passare `block.id`, gestori funzionali stabilizzati con `useCallback`). **Da fare dopo la submission, con test sulle pagine** |
| 16 | ~164 problemi di lint | 1-2 giorni | 67 `no-unused-vars`, 34 `no-empty` (catch vuoti che inghiottono errori), 15 `no-explicit-any`. Pulizia, non correttezza |
| 17 | 26 segnalazioni `react-hooks` | grande | `set-state-in-effect`, `immutability`, `exhaustive-deps`. Sono le regole v7 orientate al React Compiler: segnalano il pattern "fetch nell'effetto che aggiorna lo stato" su cui è costruita tutta l'app. Un refactor vero, non una pulizia |
| 18 | **1.423 valori hex letterali** contro i token di `@theme` | 2-3 giorni | Il rebranding che PRODUCT.md indica come possibile sarebbe un find&replace su 1.423 punti |
| 19 | Nessun test sulle **pagine** (12.800 righe di JSX) | grande | `src/lib` ha 18 test verificati per mutazione. Le pagine no |
| 20 | I due branch divergono di **49 / 51** | cresce ogni giorno | Ogni correzione fatta su un branch e non sull'altro allarga il divario. Vedi CLAUDE.md §1.1 |
| 21 | Badge iOS: **9 punti di scrittura** in `Home.jsx` | 2 ore | Funziona; il rischio è che una modifica futura ne aggiorni otto su nove. Da centralizzare in un unico effetto su `unreadCount`, **con una push reale per provarlo** |

---

## 📋 Su `main` (web app in produzione)

> Decisione del committente: `main` resta com'è. Queste voci sono registrate perché
> esistono, non perché siano in programma.

| # | Cosa | Conseguenza |
|---|---|---|
| 22 | **Zero occorrenze di `parseNotesAndRpe`** | Se un atleta modifica una nota dalla web app, **l'RPE scritto dall'app iOS viene distrutto** e le statistiche ricadono in silenzio sul default 5. È l'unica voce di questo elenco che perde dati |
| 23 | Inter dichiarato e mai caricato | La web app rende con un fallback di sistema arbitrario |
| 24 | 172 `text-gray-500` a 3.45:1 | Sotto il minimo AA per il testo |

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
18 test verificati per mutazione · liste admin da 4 a 3
