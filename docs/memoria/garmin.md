# Garmin · Fase 0 (collegamento)

> Scritto il 28/10/2026. Piano: `docs/superpowers/plans/2026-10-27-garmin-fase-0-collegamento.md`,
> spec: `docs/superpowers/specs/2026-10-27-garmin-design.md`. Le Fasi 1–3 (dati, abbinamento,
> invio dei workout all'orologio) **non esistono ancora**: oggi l'atleta collega e scollega, e
> il coach vede chi è collegato. Nessun dato Garmin viene usato.

## 🔴 Stato: scritto, NON attivo
- La migrazione **non è applicata** (serve il sì esplicito del committente, CLAUDE.md §0-bis).
- Le Edge Function **non sono pubblicate** e nessun comando `supabase` è mai stato eseguito:
  deploy e secret li fa il committente.
- 🔴 **Tutti gli URL di Garmin, i nomi dei campi della risposta dei token e quelli del webhook
  sono NON VERIFICATI**: scritti da conoscenza generale, segnati `⚠️ DA VERIFICARE nel portale
  Garmin` in `_shared/garminRegole.ts` e `_shared/garmin.ts`. Verificarli è il **passo 0**.
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

0. **Verificare nel portale Garmin** URL di autorizzazione, di scambio dei token e di
   scollegamento, nomi dei campi della risposta dei token e dei campi del webhook: correggere
   i punti `⚠️ DA VERIFICARE` in `garminRegole.ts` e `garmin.ts` **prima di tutto il resto**.
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
5. **Sì esplicito sul file `supabase/schema/garmin_2026-10-27.sql`**, poi applicarlo dal SQL
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
- ⚠️ **Il token del webhook viaggia nella query dell'URL** e può comparire nei log delle Edge
  Function di Supabase: se quei log si condividono, **ruotarlo** (`GARMIN_WEBHOOK_TOKEN` e
  l'indirizzo nel portale Garmin).
- ⚠️ **Ricollegarsi con un ALTRO account Garmin lascia orfana la registrazione vecchia**
  presso Garmin (non viene cancellata). Da sistemare prima della Fase 1.
- Il trigger manda solo identificatori (`{ id }`, più `athlete_id` per `athlete_workouts`),
  mai la riga intera: la Fase 3 rileggerà le righe lato server.

La policy (`public/privacy-policy.html`, sezione 3, versione del 28/10/2026) ha già: tolti
peso e composizione corporea, aggiunta la voce «Cosa mandiamo a Garmin», in italiano e inglese.
