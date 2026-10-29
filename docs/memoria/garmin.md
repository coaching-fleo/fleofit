# Garmin · Fase 0 (collegamento)

> Scritto il 28/10/2026. Piano: `docs/superpowers/plans/2026-10-27-garmin-fase-0-collegamento.md`,
> spec: `docs/superpowers/specs/2026-10-27-garmin-design.md`. Le Fasi 1–3 (dati, abbinamento,
> invio dei workout all'orologio) **non esistono ancora**: oggi l'atleta collega e scollega, e
> il coach vede chi è collegato. Nessun dato Garmin viene usato.

## 🟡 Stato: attivo in prova (28/10/2026)
- ✍️ **Fase 2 (Recupero) scritta il 29/10/2026, in attesa di portale e deploy**: sonno, HRV e
  giornata dell'orologio in `garmin_giornate`, tre segnali per il coach in «Da guardare», card
  «Recupero» nella scheda atleta e nel profilo. Sezione «Fase 2 · Recupero» in fondo.
- ✅ **Fase 1 (Attività dall'orologio) attiva in prova dal 29/10/2026**: endpoint *ACTIVITY* nel
  portale, `garmin-webhook`, `garmin-auth` e `send-reminders` pubblicate. Provata dal committente con
  l'atleta di prova: una corsa da 1 minuto dall'orologio salvata e **non** abbinata (sotto i 10
  minuti, giusto); una corsa da 31 minuti inserita a mano su Connect arrivata in 37 s, abbinata
  `auto`, workout completato, card «Da Garmin» nella scheda, le due righe in `notifications`
  («· da Garmin» al coach, «Registrato da Garmin» all'atleta). La push sul telefono non era ancora
  arrivata, con l'app compilata da Xcode: da riguardare (consegna, non server).
  ⚠️ **Un'attività cancellata su Connect resta da noi** (il webhook non gestisce le cancellazioni).
  Sezione «Fase 1 · Attività» più sotto.
- ✅ **Fase 3 (Corsa all'orologio) attiva in prova dal 28/10/2026**: `garmin-training` e
  `garmin-auth` pubblicate, `garmin_fase3_2026-10-28.sql` **applicato dal committente** (prima del
  SQL i due trigger erano `D` e la colonna `firma` mancava: la corsa assegnata non partiva).
  **Prima corsa arrivata sul Garmin del committente** con l'atleta di prova, spegnendo e
  riaccendendo l'interruttore. ✅ Provati dal committente il 28/10, tutti a posto: cambio di
  ritmo, spostamento del giorno, assegnazione tolta, «assegna e sposta subito». `net._http_response` al 28/10: le ultime cinque
  chiamate dei trigger tutte `200`, nessun timeout (la risposta subito con `waitUntil` funziona).
  Sezione «Fase 3 · Corsa all'orologio» in fondo.
- ✅ La migrazione è **applicata il 28/10/2026** (sì esplicito in sessione, CLAUDE.md §0-bis):
  4 policy, 3 trigger (`garmin_atleta_eliminato` attivo, gli altri due spenti) e il segreto del
  Vault controllati con le query in fondo al file.
- Le Edge Function le ha pubblicate il committente; Claude non esegue comandi `supabase` sul
  progetto remoto.
- Si collega **solo** l'atleta di `GARMIN_ATLETI_PROVA`; gli altri atleti con una build che contiene
  questo codice vedono la riga «Dispositivi» con «Garmin in arrivo».
- ✅ **Passo 0 fatto il 28/10/2026** nel portale (`apis.garmin.com/tools`, app «FLEOFIT» creata
  lo stesso giorno, prodotto Starter, API Health + Activity + Training): i **cinque URL** e i
  parametri dell'autorizzazione (PKCE S256) coincidono; `user/id` risponde `{ userId }`.
  🔴 **Trovato un errore**: `user/permissions` risponde con un **oggetto** `{ userId, permissions }`,
  non con una lista — il codice avrebbe letto sempre zero permessi. Corretto con
  `permessiDaRisposta` (test in `garminServer.test.js`).
- ✅ **Primo collegamento vero riuscito il 28/10/2026** (atleta di prova, da `localhost:5173`):
  `stato_garmin` torna `attivo` con i tre permessi `ACTIVITY_EXPORT`, `HEALTH_EXPORT`,
  `WORKOUT_IMPORT` — quindi lo scambio del codice, `access_token`, `user/id` e la correzione dei
  permessi funzionano. L'atleta che legge `garmin_collegamenti` direttamente riceve 403 (42501),
  come voluto. Durante l'autorizzazione Garmin mostra **«unverified app»**: è normale finché
  l'app non ha l'approvazione di produzione (passo 7).
- ✅ **Revoca da Garmin Connect riuscita il 28/10/2026**, al secondo tentativo (il primo era
  fallito per la query tolta, vedi «Limiti»): log «1 revoche, 0 cambi di permessi», atleta
  scollegato e dati cancellati. Il campo `deregistrations[].userId` è quindi giusto.
  ⚠️ Non ancora visti all'opera: il **rinnovo** del token (`refresh_token`, `expires_in`) e la
  notifica **`userPermissionsChange`** (si prova togliendo un permesso da Garmin Connect).
- ⚠️ **Restano da vedere alla prima prova vera** (il portale non li documenta): i nomi dei campi
  della risposta dei token (`access_token`, `refresh_token`, `expires_in`,
  `refresh_token_expires_in`, segnati `⚠️ DA VERIFICARE` in `garmin.ts`) e quelli delle notifiche
  `deregistrations` / `userPermissionsChange` del webhook (in `garminRegole.ts`). Se il collegamento
  fallisce con «risposta senza access token», o una revoca da Garmin Connect non scollega
  l'atleta, si guarda qui per primo.
- ✅ **Passi 1–3 fatti il 28/10/2026** dal committente: secret e Vault, deploy di `garmin-auth` e
  `garmin-webhook` (rispondono 302 e 200), webhook di Deregistrations e User Permissions Change nel
  portale. `GARMIN_ATLETI_PROVA` = l'atleta di prova `015215b7-f93f-4bc0-a0d5-9e5db6c0c3f8`
  (account dedicato, non staff): da togliere quando Garmin approva.
- Nel portale, «Endpoint Configuration» (gli indirizzi delle notifiche) **non si compila ora**:
  è il passo 3, dopo il deploy.
- Il codice funziona anche prima della migrazione: senza `stato_garmin` (`PGRST202`) la riga
  Garmin non compare, senza errori.

## Cosa c'è, dove
| Cosa | Dove |
|---|---|
| Quattro tabelle (`garmin_collegamenti`, `garmin_attivita`, `garmin_giornate`, `garmin_invii`), funzione `stato_garmin(atleta)`, funzione `garmin_avvisa()` (`pg_net` + segreto Vault `garmin_interno`), trigger `garmin_atleta_eliminato` **attivo**, i due trigger della Fase 3 creati e **disattivati** | `supabase/schema/garmin_2026-10-27.sql` |
| Regole pure (niente Deno né rete), provate da Vitest | `supabase/functions/_shared/garminRegole.ts`, `src/lib/__tests__/garminServer.test.js` |
| HTTP verso Garmin, `accessValido`, `scollegaAtleta` | `supabase/functions/_shared/garmin.ts` |
| OAuth 2.0 + PKCE tutto lato server (inizia → Garmin → callback → ritorno all'app) | `supabase/functions/garmin-auth/index.ts` |
| Revoche e cambi di permessi che arrivano da Garmin | `supabase/functions/garmin-webhook/index.ts` |
| Entrambe senza JWT (le chiama Garmin o il database) | `supabase/config.toml`, `verify_jwt = false` |
| Lato app: client, foglio del consenso, riga «Dispositivi» (solo atleta vero), ritorno dal collegamento, «Garmin dal …» per lo staff | `src/lib/garmin.js`, `src/components/FoglioGarmin.jsx`, `Settings.jsx`, `App.jsx` (`DeeplinkHandler`), `AthleteDetail.jsx` |
| Backup notturno: le tre tabelle dei dati, **non** `garmin_collegamenti` | `.github/workflows/db-backup.yml` |

I token stanno cifrati (AES-GCM) in `garmin_collegamenti`, tabella con RLS attiva e **nessuna
policy**: l'app non li vede mai, legge solo `stato_garmin`.

## Deviazioni dalla spec (decise scrivendo il piano)
1. **Il backfill dei 30 giorni non parte in Fase 0**: i dati non avrebbero dove finire. Lo
   chiedono le Fasi 1 e 2, anche per chi si è collegato prima.
2. **L'interruttore «Manda i workout all'orologio» non c'è ancora**: la colonna `invia_workout`
   nasce ora, l'interruttore compare con la Fase 3 (oggi non farebbe niente). ⚠️ La policy
   però già lo nomina: vale dalla Fase 3.
3. **I webhook di database usano `net.http_post` con un token letto dal Vault**, non la service
   role scritta nel trigger (stesso problema di `cron.job`, `database.md`). I trigger della
   Fase 3 nascono **disattivati**.

## Trappole
- 🔴 **Il ramo `fleofit://garmin` di `DeeplinkHandler` va PRIMA del ramo login.** Senza token
  nell'hash, ogni `fleofit://` portava a `/login` con un errore: il ritorno da Garmin deve
  arrivare in Impostazioni.
- 🔴 **Il deep link si riconosce sulla stringa grezza, non su `URL.hostname`**: le WebView
  Android vecchie lo leggono con hostname vuoto.
- 🔴 **I metadati dell'utente si rileggono prima di riscriverli**: il consenso Garmin sta
  accanto agli altri; riscrivere da una copia vecchia cancella quelli messi nel frattempo.
- 🔴 **`pkce_*` si svuotano con un update condizionato PRIMA dello scambio del codice**: lo
  `state` è monouso. Un doppio tocco o un link riaperto dalla cronologia dà `motivo=scaduto` e
  non scambia il codice due volte.
- 🔴 **I token non vanno mai nel backup**: `garmin_collegamenti` non è in `TABLES`, e il
  backup finisce in un artifact.
- ⚠️ **Lo stesso account Garmin su due atleti** (genitore e figlio): il secondo riceve
  `esito=errore&motivo=altro_account`, senza rubare il collegamento al primo.
- ⚠️ **Garmin non risponde allo scollegamento**: i dati locali si cancellano lo stesso, perché
  la promessa della policy è nostra (`pianoScollegamento`).
- ⚠️ **Lo stato Garmin nella scheda atleta è legato all'id dell'atleta**: senza, cambiando
  scheda restava per un attimo la scritta dell'atleta di prima.
- ⚠️ **Prima della migrazione** `stato_garmin` non esiste: niente errori né riga rotta.

## Secret
`GARMIN_CLIENT_ID`, `GARMIN_CLIENT_SECRET`, `GARMIN_WEBHOOK_TOKEN`, `GARMIN_INTERNO_TOKEN`,
`GARMIN_TOKEN_KEY` (**base64 standard di 32 byte**, per AES-GCM), `GARMIN_ATLETI_PROVA` (id
degli atleti che possono collegarsi prima dell'approvazione di Garmin, separati da virgola;
**vuoto = tutti**, gli altri ricevono 403 `non_ancora` → «Garmin in arrivo») e, facoltativo,
`GARMIN_ORIGINI_EXTRA` (origini web ammesse oltre a `https://fleofit.vercel.app` e
`http://localhost:5173`, separate da virgola). Solo nei secret di Supabase e nel Vault, mai nel
bundle. Il ritorno nativo è `fleofit://garmin`.

## Passi del committente, in ordine
> Riscritti il 28/10/2026 dopo la revisione dell'intero ramo. L'ordine conta: **il SQL è
> l'interruttore** e viene quasi in fondo.

0. ✅ **Verifica nel portale fatta il 28/10/2026** (vedi «Stato»): restano solo i campi dei token
   e del webhook, da guardare alla prima prova.
1. **Segreto del Vault e secret delle Edge Function.**
   - Vault: `select vault.create_secret('<GARMIN_INTERNO_TOKEN>', 'garmin_interno');` (stesso
     valore del secret `GARMIN_INTERNO_TOKEN`, mai scritto in un file).
   - Secret delle Edge Function: `GARMIN_CLIENT_ID`, `GARMIN_CLIENT_SECRET`,
     `GARMIN_WEBHOOK_TOKEN`, `GARMIN_INTERNO_TOKEN`, `GARMIN_TOKEN_KEY` e
     **`GARMIN_ATLETI_PROVA` = l'id (UUID) dell'atleta di prova** (più di uno: separati da
     virgola). Facoltativo: `GARMIN_ORIGINI_EXTRA`.
2. **Pubblicare le funzioni**: `garmin-auth` e `garmin-webhook`.
3. **Portale Garmin**: redirect URI (la funzione `garmin-auth`) e indirizzo del webhook per
   deregistrazioni e cambi di permessi.
4. **Pubblicare la policy** con `git push origin app:main` — **solo su richiesta esplicita del
   committente** (CLAUDE.md §0, regola 0). Ricordare la mail dei cambi di policy, in stand-by
   nel BACKLOG.
5. ✅ (28/10/2026) **Sì esplicito sul file `supabase/schema/garmin_2026-10-27.sql`**, poi applicarlo dal SQL
   editor e lanciare le query di verifica in fondo al file.
   ⚠️ **Applicare il SQL è l'interruttore**: da quel momento ogni atleta con una build che
   contiene questo codice vede la riga «Dispositivi». Finché `GARMIN_ATLETI_PROVA` non si
   svuota, possono collegarsi davvero solo gli atleti elencati; gli altri ricevono
   «Garmin in arrivo» (403 `non_ancora` da `garmin-auth`).
6. **Prova sul telefono con un account ATLETA DEDICATO** — non staff, non `demo@fleofit.it`:
   lo staff non vede la riga e `garmin-auth` lo rifiuta con 403.
7. **Approvazione di Garmin in produzione** → svuotare `GARMIN_ATLETI_PROVA`: il collegamento
   si apre a tutti.
8. Nella versione App Store che porta Garmin agli atleti: etichette privacy (salute e
   fitness) e note per il revisore (`demo@fleofit.it` è staff e non vede la riga).

## Limiti accettati per la Fase 0 (da chiudere prima della Fase 1)
- ⚠️ **Le modifiche a `db-backup.yml` sono attive solo dopo `app:main`**: il backup notturno
  gira da `main` (CLAUDE.md §1.1).
- ⚠️ **Nessun nuovo tentativo se l'avviso del trigger di soft delete fallisce**: `pg_net` è
  fire-and-forget (timeout 5 s). Accettato per la Fase 0; **prima della Fase 1 serve un giro
  di recupero** (collegamenti di atleti eliminati ancora presenti).
- 🔴 **Il token del webhook sta nel PERCORSO dell'indirizzo, non nella query**:
  `…/functions/v1/garmin-webhook/<GARMIN_WEBHOOK_TOKEN>`. Il 28/10/2026 la prima revoca vera è
  stata ignorata col log «t assente»: **Garmin chiama togliendo la query**. Lo legge
  `tokenWebhook` di `garminRegole.ts` (il vecchio `?t=` resta accettato). Il percorso compare
  nei log delle Edge Function di Supabase: se quei log si condividono, **ruotarlo**
  (`GARMIN_WEBHOOK_TOKEN` e le due righe del portale).
- ⚠️ **Ricollegarsi con un ALTRO account Garmin lascia orfana la registrazione vecchia**
  presso Garmin (non viene cancellata). Da sistemare prima della Fase 1.
- Il trigger manda solo identificatori (`{ id }`, più `athlete_id` per `athlete_workouts`),
  mai la riga intera: la Fase 3 rileggerà le righe lato server.

La policy (`public/privacy-policy.html`, sezione 3, versione del 28/10/2026) ha già: tolti
peso e composizione corporea, aggiunta la voce «Cosa mandiamo a Garmin», in italiano e inglese.

---

## Fase 1 · formato verificato (28/10/2026)

Letto dalla documentazione Swagger del portale (`apis.garmin.com/tools/apiDocs`, Wellness API,
server `https://apis.garmin.com/wellness-api`), con la sessione del committente.

- **Riepilogo di un'attività** = schema `ClientActivity`. Campi che usiamo: `userId`,
  `summaryId` (stringa, è l'id che salviamo in `garmin_id`), `activityId`, `activityType`,
  `startTimeInSeconds` (epoch UTC), `startTimeOffsetInSeconds` (scostamento locale),
  `durationInSeconds`, `distanceInMeters`, `averageHeartRateInBeatsPerMinute`,
  `maxHeartRateInBeatsPerMinute`, `averageSpeedInMetersPerSecond`,
  `averagePaceInMinutesPerKilometer`, `totalElevationGainInMeters`, `activeKilocalories`,
  `deviceName`, `manual`. **Non** salviamo `startingLatitude/LongitudeInDegree` (posizione)
  né `activityName`/`activityDescription` (testo libero dell'atleta).
- **Due tipi di riepilogo**: `activities` (dall'orologio) e `manuallyUpdatedActivities`
  (create o modificate a mano su Connect, `manual = true`). Nel portale, *Endpoint
  Configuration*, ci sono «ACTIVITY - Activities» e «ACTIVITY - Manually Updated Activities».
  ⚠️ DA VERIFICARE al primo Push vero: che il corpo sia `{ "activities": [...] }` /
  `{ "manuallyUpdatedActivities": [...] }` (formato standard dei Push Garmin, non scritto nello
  Swagger).
- ⚠️ DA VERIFICARE: **l'elenco dei valori di `activityType`** non è nello Swagger (è una
  stringa senza enum). I valori della tabella di `abbinaGarmin.ts` sono quelli noti di Garmin
  (`RUNNING`, `TREADMILL_RUNNING`, `TRAIL_RUNNING`, `TRACK_RUNNING`, `INDOOR_CARDIO`, `HIIT`,
  `STRENGTH_TRAINING`, `INDOOR_ROWING`, `OTHER`): al primo test si legge `tipo` in
  `garmin_attivita` e si corregge la tabella. Lo strumento *Data Viewer* del portale mostra i
  riepiloghi arrivati; *Data Generator* e *Summary Resender* servono per le prove.
- **Backfill**: `GET /rest/backfill/activities?summaryStartTimeInSeconds=…&summaryEndTimeInSeconds=…`
  (epoch UTC, tutti e due obbligatori), risposta **202**: i dati arrivano poi col Push, non
  nella risposta. Esistono gli stessi backfill per `dailies`, `sleeps`, `hrv` (Fase 2).
- Payload di esempio **inventato** (nessun dato vero) per i test:
  `src/lib/__tests__/fixtures/garminAttivita.json`.

## Fase 1 · le attività libere nel calendario (28/10/2026)

- Un'attività con `athlete_workout_id` nullo è una **voce grigia** «Garmin · Corsa 42′»
  (`vociLibere` di `src/lib/attivitaGarmin.js`, `RigaGarmin` di `CalendarioUI.jsx`): nel
  giorno della pagina Calendario **solo per l'atleta** (quella del coach è la programmazione)
  e nel calendario della scheda atleta. Non compare nella griglia del mese, solo nella lista
  del giorno; e un giorno con la sola voce non dice più «Nessun allenamento».
- **Una lettura per mese**, `leggiAttivitaLibere`, insieme alle assegnazioni; un errore vale
  come nessuna attività. In `CalendarioAtleta` la lettura parte solo a calendario aperto, e
  la funzione arriva dalla scheda (`leggiLibere`, in `useCallback`: una funzione nuova a ogni
  render rileggerebbe a ogni render). È l'unica eccezione al suo «nessuna lettura propria».
- Toccando la voce, `FoglioAttivitaGarmin` (pigro: ~3,5 KB): le righe di `RigheGarmin` — le
  stesse della card «Da Garmin» — e **«Abbina a…»** con `candidatiAbbina`: le assegnazioni
  non completate del giorno e dei due vicini, quello stesso giorno per primo. Abbinando,
  `abbinaA` e poi la ricarica del mese (o dello storico, nella scheda).
- ⚠️ Nella pagina Calendario i candidati vengono dal mese caricato: un'attività del 1° non
  vede un allenamento del 31 del mese prima. Nella scheda atleta sì (lo storico è intero).

## Fase 1 · Attività
> Scritta il 28/10/2026. Piano: `docs/superpowers/plans/2026-10-28-garmin-fase-1-attivita.md`,
> spec: `docs/superpowers/specs/2026-10-27-garmin-design.md`. ✍️ **Codice scritto, in attesa del
> portale e del deploy.** Le attività dell'orologio arrivano al webhook, si salvano in
> `garmin_attivita` e, se c'è un solo allenamento compatibile quel giorno, lo completano da sole.
> Niente migrazioni: i campi nuovi stanno dentro `dati` (jsonb).

### Cosa c'è, dove
| Cosa | Dove |
|---|---|
| Lettura di un riepilogo Garmin (`leggiAttivita`): solo i campi che usiamo, mai posizione né nome/descrizione | `supabase/functions/_shared/attivitaGarmin.ts` |
| Regole dell'abbinamento (`scegliAbbinamento`, `TIPI_PER_CATEGORIA`, `GIORNI_MASSIMI`) | `supabase/functions/_shared/abbinaGarmin.ts` |
| Salvataggio, abbinamento, completamento, notifiche, backfill | `supabase/functions/garmin-webhook/attivita.ts` (chiamata da `index.ts`) |
| Testi delle notifiche («· da Garmin» al coach, la push all'atleta che apre l'RPE) | `supabase/functions/send-reminders/testi.ts` |
| Lato app: tipi in italiano, righe della card, `annullaAbbinamento`, `abbinaA`, `leggiAttivitaLibere`, `vociLibere`, `candidatiAbbina` | `src/lib/attivitaGarmin.js` |
| Card «Da Garmin» nella scheda, con «Non era questo allenamento» | `src/components/CardDaGarmin.jsx`, `WorkoutDetail.jsx` |
| Le righe (card e foglio) e il foglio della voce grigia con «Abbina a…» | `RigheGarmin.jsx`, `FoglioAttivitaGarmin.jsx`; la voce in `CalendarioUI.jsx` |
| Durata stimata del workout, scritta dal builder | `sections.durataStimata` (minuti), in `CreateWorkout.jsx` |
| Semi dell'ambiente di prova (due attività INVENTATE per Sara) | `src/demoSemi.js` (`garmin_attivita`), `src/__tests__/demoGarmin.test.jsx` |

### Decisioni e costi
- **Le regole stanno in `_shared/abbinaGarmin.ts`, non in `src/lib/`** (deviazione dal piano
  iniziale): le Edge Function non vedono `src/`. Vitest le prova lo stesso, come `garminRegole.ts`.
- **`sections.durataStimata` la scrive il builder** (decisione del committente, 28/10/2026): il
  server non ha lo stimatore (`durataBlocco` sta in `src/lib`). Costo: i workout vecchi non ce
  l'hanno e l'abbinamento li tratta come senza durata attesa.
- **Un solo candidato, contato dopo i filtri di tipo e durata**: una Corsa e una Gym lo stesso
  giorno, l'attività di corsa completa la Corsa. Due Corse compatibili → nessun abbinamento
  (voluto): si sceglie a mano con «Abbina a…».
- **`GIORNI_MASSIMI = 7`**: un'attività che arriva più di 7 giorni dopo il suo inizio non completa
  mai niente da sola. Perché: al **ricollegamento** `collegato_at` conserva la data vecchia, e il
  backfill di 30 giorni avrebbe completato allenamenti saltati da settimane, con notifiche.
  Costo: una sincronizzazione ritardata di oltre 7 giorni chiede «Abbina a…».
- **Dopo un completamento automatico l'RPE resta vuoto** e `athlete_workouts.completed_date` NON
  si tocca (è il giorno programmato). La push all'atleta apre l'RPE (`?rpe=1`, senza «Come stai
  oggi» prima).
- **La push all'atleta tiene il titolo intero, con il codice in coda**, come le altre push
  all'atleta: un solo contratto per la regex del codice. Costo: un suffisso nel testo.
- **`abbinaA` e `annullaAbbinamento` scrivono due volte** (prima l'attività, poi il workout) e
  non sono atomiche. Se la seconda scrittura fallisce:
  - annullamento: l'attività è staccata ma il workout non torna da fare, e l'app dice «L'attività
    è staccata, ma l'allenamento non è tornato da fare: riprova dal tasto dello stato»; se fallisce
    la prima, «Impossibile staccare l'attività di Garmin» e il workout non è toccato;
  - abbinamento: l'attività risulta abbinata ma il workout resta «da fare»; la pagina mostra
    l'errore e ricarica, quindi la voce grigia sparisce e il completamento va fatto a mano.
- **Un'attività che arriva mentre il collegamento non è `attivo` NON si salva** (voluto, privacy:
  un collegamento in pausa o revocato vuol dire che non vogliamo i dati). Il backfill di 30 giorni
  al ricollegamento li recupera, come attività precedenti al collegamento (non completano niente).
- **«Abbina a…» offre anche i workout già completati** senza un'attività (ruling 28/10/2026): l'atleta
  spunta «fatto» e l'orologio sincronizza dopo. Abbinare a uno completato non cambia lo stato.
  `abbinaA` prende solo un'attività ancora libera (`athlete_workout_id` nullo). Il webhook filtra
  per `athlete_id` quando aggiorna e rilegge una riga (un vecchio account Garmin passato ad un altro
  atleta non tocca le righe del primo). Il «da Garmin» della notifica al coach conta solo se il
  chiamante è di servizio.
- **«Non era questo allenamento»** libera l'attività con `abbinamento: 'atleta'`: il webhook non
  riabbina MAI una riga con `abbinamento` non nullo. Il workout torna da fare solo se l'aveva
  completato Garmin (`'auto'`).
- **Un «Segna come da fare» a mano NON stacca l'attività** (parcheggiato): la card resta su un
  workout da fare, e il suo tasto «Non era questo allenamento» copre il caso.
- **«Abbina a…» nella pagina Calendario è limitato al mese caricato**: un'attività del 1° non vede
  un allenamento del 31 del mese prima. Nella scheda atleta sì (lo storico è intero).
  Il calendario del team (desktop) non mostra le voci grigie.
- Un Event non è escluso dai candidati manuali (una gara si può abbinare a mano).
- **Limiti della Fase 0 chiusi**: un'attività di un atleta **eliminato** non si salva e chiude il
  collegamento (origine `'eliminato'`, deregistra anche presso Garmin); **ricollegandosi con un
  altro account Garmin** la registrazione vecchia viene cancellata presso Garmin
  (`togliRegistrazioneVecchia` in `garmin-auth`). Al collegamento parte un backfill di 30 giorni.

### Verificato alla prima prova (29/10/2026)
- ✅ `activityType` della corsa = `RUNNING`, sia dall'orologio sia inserita a mano. ⚠️ Restano da
  vedere gli altri valori di `TIPI_PER_CATEGORIA` (Hyrox, Gym) alla prima attività di quel tipo.
- ✅ Le chiavi del Push funzionano: arrivano sia l'attività dell'orologio sia quella manuale (`manual = true`).
- ✅ `athlete_workouts.completed_date` è un `date`.
- ✅ `send-reminders` accetta il webhook come «service»: la notifica «· da Garmin» è uscita.

### Passi del committente, in ordine
1. Nel portale Garmin, *Endpoint Configuration*: attivare **«ACTIVITY - Activities»** e
   **«ACTIVITY - Manually Updated Activities»**, con lo **stesso indirizzo** del webhook delle
   Deregistrations (token nel percorso).
2. Deploy, con `--no-verify-jwt` per `garmin-webhook` e `garmin-auth` e nulla di speciale per
   `send-reminders`:
   - `supabase functions deploy garmin-webhook --no-verify-jwt`
   - `supabase functions deploy garmin-auth --no-verify-jwt`
   - `supabase functions deploy send-reminders`

   ⚠️ `send-reminders` serve **anche la web app**: le modifiche sono solo additive (modi nuovi e
   testi nuovi), ma è un deploy che la tocca.
3. Controlli di sola lettura:
   - `select data_type from information_schema.columns where table_name='athlete_workouts' and column_name='completed_date';`
     deve dare `date` (o un testo `yyyy-MM-dd`);
   - dopo la prima push, nei log di `send-reminders` le chiamate del webhook risultano accettate
     come service.
4. Prova vera con l'atleta di prova (collegato, `attivo`). Usare *Data Generator* / *Summary
   Resender* del portale, o `curl` sull'indirizzo del webhook con un corpo `{ "activities": [ … ] }`
   costruito sul fixture `src/lib/__tests__/fixtures/garminAttivita.json`:
   1. **Completamento**: una Corsa assegnata per oggi, non completata; si corre con l'orologio (o
      si manda una `RUNNING` di 30 minuti con inizio dopo `collegato_at`). Atteso: riga in
      `garmin_attivita` con `abbinamento = 'auto'` e l'id dell'assegnazione; workout completato,
      note e RPE vuoti, `completed_date` invariato; notifica al coach «· da Garmin»; push
      all'atleta che apre l'RPE; card «Da Garmin» nella scheda.
   2. **Doppio Push**: rimandare la stessa attività (stesso `summaryId`, durata cambiata). Atteso:
      `durata_s` aggiornata, abbinamento invariato, nessuna seconda notifica.
   3. **Annullato**: sulla riga `athlete_workout_id = null`, `abbinamento` valorizzato, workout
      riportato a `pending`; rimandare. Atteso: non si riabbina.
   4. **Già segnato a mano**: segnare la Corsa completata dall'app, poi mandare un'attività nuova.
      Atteso: attività salvata senza abbinamento; RPE e note dell'atleta intatti; nessuna notifica.
   5. **Atleta eliminato**: su un atleta di prova soft-deleted con collegamento ancora presente,
      mandare un'attività. Atteso: niente in `garmin_attivita`, collegamento cancellato.
   6. **Revoche e permessi** ancora funzionanti: un corpo `{ "deregistrations": [...] }` scollega.
   7. **«Non era questo allenamento»** dalla card su un completamento automatico → l'attività si
      libera, il workout **torna da fare** e non si riabbina al prossimo aggiornamento. ⚠️ Il
      coach che lo preme scrive `athlete_workouts.status`: stessa RLS di «Segna come da fare»,
      da confermare nella prova.
   8. **Attività in un giorno senza workout** → voce grigia nel calendario (atleta e scheda
      atleta); toccandola, «Abbina a…» sceglie un allenamento non completato e lo completa.
   9. **Ricollegamento**: collegarsi con un altro account Garmin toglie la registrazione vecchia, e
      parte il backfill dei 30 giorni (le attività più vecchie di 7 giorni NON completano niente).
   10. In ogni caso il webhook risponde 200 subito; nei log solo id e conteggi.
5. Dopo la prima attività vera, leggere `tipo`:
   `select tipo, count(*) from garmin_attivita group by tipo;` e, se i nomi differiscono,
   correggere `TIPI_PER_CATEGORIA` in `abbinaGarmin.ts` e ripubblicare `garmin-webhook`.
6. Strumenti del portale per le prove: *Data Viewer* (i riepiloghi arrivati), *Data Generator*
   (ne crea di finti) e *Summary Resender* (rimanda quelli già arrivati).

## Fase 3 · Corsa all'orologio
> Scritta il 28/10/2026. Piano: `docs/superpowers/plans/2026-10-28-garmin-fase-3-corsa.md`,
> spec: `docs/superpowers/specs/2026-10-27-garmin-design.md` §5, §7, §9. ✍️ **Codice scritto, in
> attesa di deploy e SQL** (⏳ il file SQL NON è applicato). Si manda solo la Corsa
> (`sections.category === 'Running'`), da oggi in avanti (giorno `Europe/Rome`), se
> l'assegnazione non è completata e il collegamento è `attivo` con `invia_workout` vero e il
> permesso `WORKOUT_IMPORT`. Hyrox, Gym, Custom ed Event non si mandano.

### Cosa c'è, dove
| Cosa | Dove |
|---|---|
| Copia server di `partiRipetuta` (le ripetute si leggono solo da qui o dall'originale) | `supabase/functions/_shared/ripetute.ts`, con test di parità in `src/lib/__tests__/` |
| Traduzione di una Corsa nel workout Garmin (`corsaVersoGarmin`, tipo `GarminWorkout`) | `supabase/functions/_shared/workoutGarmin.ts` |
| Regole pure dell'invio: `decidiInvio`, `firmaWorkout`, `oggiItalia`, `idDaRisposta`, indirizzi `GARMIN_TRAINING` | `supabase/functions/_shared/garminTraining.ts` |
| Chiamate di rete: `creaWorkoutGarmin`, `programmaGarmin`, `spostaProgrammaGarmin`, `cancellaWorkoutGarmin` | `supabase/functions/_shared/garmin.ts` |
| Edge Function `garmin-training`, **tre ingressi**: (1) i trigger, con l'header `x-garmin-interno`; (2) `{azione:'riprova', athlete_workout_id}` col JWT di atleta o coach (la RLS decide); (3) `{azione:'invia_workout', acceso}` col JWT dell'atleta, l'interruttore | `supabase/functions/garmin-training/index.ts` |
| Colonna `firma`, via la chiave esterna di `garmin_invii`, trigger `garmin_invii_assegnazioni` e `garmin_invii_workout` accesi. ⏳ **NON applicato** | `supabase/schema/garmin_fase3_2026-10-28.sql` |
| Interruttore «Manda i workout all'orologio» | `Settings.jsx`, `FoglioGarmin.jsx` |
| Riga «Sull'orologio» nella scheda, con «Riprova» | `src/lib/rigaOrologio.js` (`rigaOrologio`), `src/components/RigaOrologio.jsx` |

### Decisioni e costi
- **`partiRipetuta` è copiata, non importata**: le Edge Function non vedono `src/`. Il test di
  parità fa fallire la copia se l'originale cambia. Costo: due file da tenere uguali; il test
  toglie gli `id` interni, quindi non copre gli id fissi `corsa`/`recupero` (nessun codice server
  li usa oggi).
- ✅ **Corse già assegnate** (decisione del committente, 28/10/2026: «Sì, mandale»): accendere
  l'interruttore, o collegarsi a Garmin, manda all'orologio le Corse assegnate **da oggi in
  avanti** (`futureDellAtleta` in `garmin-training`). Al collegamento è `garmin-auth`
  (`avvisaTraining`) a chiamare `garmin-training` con `{ tipo:'collegato', athlete_id }` e il
  segreto interno; il lavoro gira in sottofondo (`inSottofondo`), quindi né l'interruttore né il
  ritorno da Garmin aspettano. Se l'avviso non parte, il collegamento resta valido e le Corse
  arrivano al primo cambio o con «Riprova». ⚠️ Dopo il deploy di `garmin-training` va
  ripubblicata anche `garmin-auth`. Nella prova: assegnare una Corsa **prima** di collegare (o
  con l'interruttore spento), poi collegare o accendere, e controllare che arrivi.
- **Righe orfane in `errore`**: tolta un'assegnazione, la riga di `garmin_invii` resta (via la
  cascata, serve per sapere cosa cancellare su Garmin). Se la cancellazione su Garmin fallisce,
  la riga resta in `errore` e il workout resta sull'orologio; nessuna scheda la mostra e
  «Riprova» risponde 403. Si pulisce spegnendo l'interruttore, altrimenti a mano.
- **Finestra breve prima di `rifai`**: tra la prenotazione dell'invio e la cancellazione del
  vecchio workout un crash può lasciare un doppione sull'orologio. Raro, accettato (un workout
  creato ma non programmato si toglie al prossimo `rifai`).
- **Nessun feedback dopo un «Riprova» che non cambia nulla**: la riga resta com'è. Costo: tocchi
  senza capire. Parcheggiato.
- Un coach non può spegnere `invia_workout` per l'atleta: lo cambia solo l'atleta (lo staff
  riceve 403, come in `garmin-auth`).
- Regola 3 di `decidiInvio`: il workout si toglie se è passata la data dell'invio **o**
  quella dell'assegnazione. Un workout spostato indietro a ieri resta quindi sull'orologio.
- **Due cambi a 100 ms** (il builder salva workout e poi assegnazione; «assegna e sposta
  subito»): chi arriva secondo trova l'invio «in corso» e non fa niente. Per questo, dopo un
  `crea`/`rifai`/`sposta` riusciti, `sincronizza` ripassa **una** volta e si riallinea.
- **Ripristino di un backup**: i trigger accesi mandano una chiamata per riga ripristinata;
  tutte finiscono in `niente` (atleti senza Garmin, giorni passati), ma sono tante.
- Altri minori parcheggiati: unità come «min.»/«minuti» finiscono come obiettivo aperto;
  `.slice(0,100)` può spezzare una emoji; una ripetuta senza parti dà un figlio aperto.

### ⚠️ DA VERIFICARE alla prima prova (28/10/2026)
- Gli **URL della Training API** (`GARMIN_TRAINING.workout` e `.schedule` in `garminTraining.ts`).
- Il **corpo del PUT** di `spostaProgrammaGarmin` (qui `scheduleId`, `workoutId`, `date`).
- Unità `PACE` (m/s), zona e descrizione in `workoutGarmin.ts`; permessi in `garminRegole.ts` e
  `garmin.ts` (note già presenti dalla Fase 0).
Se la prima prova risponde 404: correggere `GARMIN_TRAINING` e ripubblicare.

### Passi del committente, in ordine
1. `supabase functions deploy garmin-training --no-verify-jwt`, poi `supabase functions deploy garmin-auth --no-verify-jwt` (al collegamento avvisa `garmin-training`).
   Tra il deploy e il SQL non si rompe niente: l'interruttore funziona (le Corse future non partono finché manca la colonna `firma`: solo un errore nei log), e «Riprova» non compare
   perché righe in `garmin_invii` non ce ne sono ancora (i trigger sono spenti). L'ordine
   deploy → SQL è sicuro.
2. **Sì esplicito** su `supabase/schema/garmin_fase3_2026-10-28.sql` (CLAUDE.md §0-bis), poi la
   query del nome del vincolo (in cima al file: deve stampare `garmin_invii_athlete_workout_id_fkey`),
   poi il file nel SQL editor, poi le tre verifiche in fondo (trigger attivi, colonna `firma`,
   vincolo assente).
3. Prova con l'atleta di prova: assegnargli una Corsa per **oggi o domani** con riscaldamento,
   ripetute e defaticamento, e controllare in Garmin Connect (Allenamenti e Calendario) e
   sull'orologio dopo la sincronizzazione. Poi: cambiare un ritmo (deve rifarlo); spostare il
   giorno (deve spostarlo); **togliere l'assegnazione** (deve sparire); **assegnare e spostare
   subito il giorno** (deve restare un solo workout su Garmin, e nel giorno NUOVO).
   Guardare anche `net._http_response` dopo aver cambiato un workout assegnato a più atleti:
   non devono esserci timeout (la funzione risponde subito e lavora in sottofondo).
4. Se la prima prova risponde 404: correggere `GARMIN_TRAINING` e ripubblicare.

## Fase 2 · Recupero
> Scritta il 29/10/2026. Piano: `docs/superpowers/plans/2026-10-29-garmin-fase-2-recupero.md`,
> spec: `docs/superpowers/specs/2026-10-27-garmin-design.md` §4. ✍️ **Codice scritto, in attesa del
> portale e del deploy.** Niente migrazioni: la tabella `garmin_giornate` c'era già.

### Cosa c'è, dove
| Cosa | Dove |
|---|---|
| Lettura dei Push `dailies` / `sleeps` / `hrv` (`leggiGiornate`, `CHIAVI_GIORNATE`): solo i campi che usiamo | `supabase/functions/_shared/giornateGarmin.ts` |
| Il webhook salva UNA colonna per invio (upsert su `athlete_id,giorno`) | `supabase/functions/garmin-webhook/giornate.ts` (`gestisciGiornate`, chiamata da `index.ts`) |
| Backfill di 30 giorni dei quattro tipi al collegamento | `chiediBackfillGarmin` in `_shared/garmin.ts`, `urlBackfill` e `TipoBackfill` in `_shared/garminRegole.ts`, `chiediBackfill` di `garmin-auth` |
| Segnali, serie a 28 giorni, letture | `src/lib/recuperoGarmin.js` |
| Card «Recupero» (pigra, con `lazy()`) | `src/components/CardRecupero.jsx` |
| I segnali in «Da guardare» | voce `recupero` di `cosaGuardare`; ⚠️ ogni `tipo` di voce vuole la sua pillola in `PILLOLA` di `CruscottoCoachUI` (senza, la Home coach andava in bianco: corretto il 29/10, ora c'è un ripiego neutro) |
| Il cablaggio nelle pagine | `Home.jsx` (`leggiGiornateFra` 31 giorni + `segnaliTeam`) · `AthleteDetail.jsx` (28 giorni, `pRecupero`; `giornate` si svuota al cambio di atleta) |
| Semi dell'ambiente di prova (38 giorni INVENTATI per Sara, ultime 3 notti storte fino a ieri) | `src/demoSemi.js` (`garmin_giornate`), `src/__tests__/demoGarmin.test.jsx` |

### Formato verificato (Swagger del portale, 29/10/2026)
- `ClientDaily`: `userId`, `summaryId`, `calendarDate` (`yyyy-MM-dd`), `steps`, `activeKilocalories`, `moderateIntensityDurationInSeconds`, `vigorousIntensityDurationInSeconds`, `restingHeartRateInBeatsPerMinute`, `averageStressLevel`, `bodyBatteryChargedValue`, `bodyBatteryDrainedValue`, `durationInSeconds`.
- `ClientSleep`: `userId`, `summaryId`, `calendarDate`, `durationInSeconds`, `deepSleepDurationInSeconds`, `lightSleepDurationInSeconds`, `remSleepInSeconds`, `awakeDurationInSeconds`, `overallSleepScore` (`{ value, qualifierKey }`), `validation`.
- `ClientHRVSummary`: `userId`, `summaryId`, `calendarDate`, `lastNightAvg`, `lastNight5MinHigh`. ⚠️ **Non c'è uno «stato HRV» di Garmin** (la spec lo nominava): non si salva.
- Il **livello** di Body Battery sta solo in `ClientStress` (endpoint *Stress*): non lo prendiamo. Della giornata salviamo `carica`/`scarica` di `ClientDaily`.
- Backfill: `GET /rest/backfill/dailies|sleeps|hrv?summaryStartTimeInSeconds=…&summaryEndTimeInSeconds=…`, risposta 202 (come `activities`).
- Portale, *Endpoint Configuration*: «HEALTH - Dailies», «HEALTH - Sleeps», «HEALTH - HRV Summary».

### Decisioni (rulings del piano)
- **Giorno** = `calendarDate` di Garmin, così com'è (è già il giorno locale dell'atleta; per il sonno è il giorno del risveglio).
- **Ore di sonno** = `deep + light + rem` (secondi → ore); se sono tutti assenti, `durationInSeconds`. Il sonno sveglio non conta.
- **Più invii dello stesso giorno**: vince l'ultimo arrivato per quella colonna (Garmin rimanda la giornata man mano che si riempie); ogni invio tocca solo la sua colonna.
- **Finestra del riferimento**: i 28 giorni **prima della fila** di giorni storti (il calo non abbassa la sua stessa media). Con meno di 14 valori: niente segnale e «—». ⚠️ La «media 4 sett.» della card è invece sui 28 giorni mostrati, notti storte comprese: è un po' più bassa del riferimento del segnale (1–2% per un calo di 3 giorni). In Home la lettura è di 31 giorni: per file lunghe il riferimento si accorcia (ne servono comunque 14).
- **Voce vuota**: un riepilogo senza nessun campo che teniamo (`{}`) non riscrive la colonna, è «saltata».
- **«Di fila»**: 3 giorni consecutivi che finiscono nell'ultimo giorno con un dato, e quell'ultimo giorno è **oggi o ieri**; un giorno senza dato rompe la fila. Se la fila è più lunga, il testo dice quanti giorni (fino a 14).
- **Soglie**: HRV oltre il 10% sotto la media; FC a riposo oltre 5 battiti sopra; sonno sotto 6 ore (soglia fissa, senza riferimento).
- **Si salva solo** con collegamento `attivo` e permesso `HEALTH_EXPORT`. Atleta eliminato → `scollegaAtleta`. Solo i campi elencati, nient'altro dal payload.
- 🔴 **Mai peso né composizione corporea** (regola del committente): nessun Push `bodyComps`, nessun backfill `bodyComps`.
- Nessuna push per i segnali: si leggono in «Da guardare». Il foglio «Come stai» non mostra numeri Garmin. Colori: nessuno nuovo, le voci Garmin sono grigie.

### Trappole
- 🔴 I test che importano file Deno usano un `import(/* @vite-ignore */ percorso)` con percorso **non letterale**, così `tsc -b` non li segue: una volta ha rotto `npm run build` (29/10/2026).
- Il chunk `index` è ora ~598 KB (+4 KB): `recuperoGarmin` è importato in modo statico in `Home`. Accettato; la card, invece, è pigra.

### ⚠️ DA VERIFICARE al primo Push vero
- Le **chiavi del corpo** `dailies`, `sleeps`, `hrv` (formato standard dei Push, non scritto nello Swagger). Se dopo il collegamento `garmin_giornate` resta vuota, guardare qui per prima cosa.

### Passi del committente, in ordine
1. Portale, *Endpoint Configuration*: attivare «HEALTH - Dailies», «HEALTH - Sleeps», «HEALTH - HRV Summary», stesso indirizzo del webhook.
2. `supabase functions deploy garmin-webhook --no-verify-jwt` e `supabase functions deploy garmin-auth --no-verify-jwt`.
3. Scollegare e ricollegare Garmin sull'atleta di prova (parte il backfill di 30 giorni), poi: `select giorno, giornata is not null as g, sonno is not null as s, hrv is not null as h from garmin_giornate order by giorno desc limit 10;`
4. Aprire la scheda dell'atleta di prova e il suo profilo: card «Recupero».
