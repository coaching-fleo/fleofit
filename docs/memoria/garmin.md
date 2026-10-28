# Garmin · Fase 0 (collegamento)

> Scritto il 28/10/2026. Piano: `docs/superpowers/plans/2026-10-27-garmin-fase-0-collegamento.md`,
> spec: `docs/superpowers/specs/2026-10-27-garmin-design.md`. Le Fasi 1–3 (dati, abbinamento,
> invio dei workout all'orologio) **non esistono ancora**: oggi l'atleta collega e scollega, e
> il coach vede chi è collegato. Nessun dato Garmin viene usato.

## 🟡 Stato: attivo in prova (28/10/2026)
- ✅ **Fase 3 (Corsa all'orologio) attiva in prova dal 28/10/2026**: `garmin-training` e
  `garmin-auth` pubblicate, `garmin_fase3_2026-10-28.sql` **applicato dal committente** (prima del
  SQL i due trigger erano `D` e la colonna `firma` mancava: la corsa assegnata non partiva).
  **Prima corsa arrivata sul Garmin del committente** con l'atleta di prova, spegnendo e
  riaccendendo l'interruttore. Ancora da provare: cambio di ritmo, spostamento del giorno,
  assegnazione tolta, «assegna e sposta subito», timeout in `net._http_response`.
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
