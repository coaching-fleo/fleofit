# Garmin · Fase 0 (collegamento) — piano di lavoro

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** l'atleta collega e scollega il suo account Garmin Connect dalle Impostazioni, con un consenso separato; Garmin può revocarlo dalla sua parte; il coach vede chi è collegato. Nessun dato Garmin viene ancora usato (Fasi 1–3).

**Architecture:** OAuth 2.0 con PKCE fatto **tutto lato server** in una Edge Function nuova `garmin-auth` (inizia → Garmin → callback → ritorno all'app con `fleofit://garmin` o `/settings?garmin=`). Una seconda funzione `garmin-webhook` riceve da Garmin le revoche e i cambi di permessi. L'app legge lo stato con la funzione SQL `stato_garmin` e non vede mai i token, che stanno cifrati in una tabella senza policy. La logica pura sta in file senza Deno, provati da Vitest come `segnalazione/regole.ts`.

**Tech Stack:** React 19, Vitest + jsdom, Supabase (Postgres, Edge Function Deno, Vault, `pg_net`), Capacitor `Browser` / `App`.

**Spec:** `docs/superpowers/specs/2026-10-27-garmin-design.md` (§1, §2, §7, §8, §9, §11 punto 1).

## Global Constraints

- 🔒 **Il file SQL si scrive ma NON si applica.** Lo applica il committente dal SQL editor dopo il suo **sì esplicito** sul file finito (CLAUDE.md §0, 0-bis). Il codice deve funzionare anche **prima** della migrazione: se `stato_garmin` non esiste, la riga Garmin semplicemente non c'è.
- Si lavora su `app`; nessun push su `main`. Commit con i file per nome, mai `git add -A`.
- Interfaccia e commenti in **italiano**; mai `alert()`/`confirm()` (`CustomAlert`/`CustomConfirm`); ogni modale con `createPortal` e una X `aria-label="Chiudi"`.
- Colori: nessuno nuovo. Testo consenso esatto: «Acconsento che FLEOFIT riceva i dati del mio account Garmin e li usi, anche con l'IA, come descritto nell'informativa».
- Segreti solo nei secret di Supabase / nel Vault: `GARMIN_CLIENT_ID`, `GARMIN_CLIENT_SECRET`, `GARMIN_WEBHOOK_TOKEN`, `GARMIN_TOKEN_KEY` (chiave AES-GCM, 32 byte base64), `GARMIN_INTERNO_TOKEN`. Mai nel bundle.
- Indirizzi di ritorno ammessi per il web: `https://fleofit.vercel.app` e `http://localhost:5173`, più quelli in `GARMIN_ORIGINI_EXTRA` (separati da virgola). Nativo: `fleofit://garmin`.
- La riga Garmin è **solo per l'atleta vero** (`role === 'athlete' && !isSimulatingAthlete`), come «Ritira il consenso».
- Ogni test nuovo si vede **fallire** rompendo il codice che copre, prima di dichiararlo buono (CLAUDE.md §9).
- `main` e la web app di produzione non chiamano niente di nuovo: le funzioni nuove sono solo dell'app.

## Deviazioni dalla spec (decise scrivendo il piano)

1. **Il backfill dei 30 giorni** non parte in Fase 0: i dati che porterebbe non hanno ancora dove finire. Lo chiedono le Fasi 1 e 2, anche per chi si è collegato prima.
2. **L'interruttore «Manda i workout all'orologio»**: la colonna `invia_workout` nasce qui, ma l'interruttore compare con la Fase 3. Un interruttore che non fa niente direbbe una cosa falsa.
3. **I webhook di database** chiamano le funzioni con `net.http_post` e un token interno letto dal **Vault**, non con la service role scritta nel trigger (lo stesso problema che `cron.job` ha già, `docs/memoria/database.md`). Quelli della Fase 3 nascono **disattivati**.

## Review Focus

1. **Un `fleofit://garmin?...` che finisce nel ramo login di `DeeplinkHandler`**: senza token nell'hash, oggi ogni `fleofit://` porta a `/login` con un errore. Il ritorno da Garmin deve arrivare in Impostazioni (test nel Task 5).
2. **Prima della migrazione** `stato_garmin` non esiste (`PGRST202`): Impostazioni e scheda atleta non devono mostrare errori né una riga rotta (test nei Task 5 e 6).
3. **Lo stesso account Garmin collegato a due atleti** (per esempio un genitore e un figlio): il secondo deve ricevere `esito=errore&motivo=altro_account`, senza rubare il collegamento al primo (test di `esitoCallback` nel Task 2).
4. **Un `state` vecchio o riusato** (doppio tocco, link riaperto dalla cronologia): deve dare `motivo=scaduto` e non scambiare il codice due volte (test nel Task 2).
5. **Garmin che non risponde allo scollegamento**: i dati locali vanno cancellati lo stesso, perché la promessa della policy è nostra (test di `pianoScollegamento` nel Task 2).

---

### Task 1: La migrazione (scritta, non applicata)

**Files:**
- Create: `supabase/schema/garmin_2026-10-27.sql`
- Modify: `.github/workflows/db-backup.yml` (la riga `TABLES` e un commento)

**Interfaces:**
- Produces (per i Task 3–6):
  - `public.garmin_collegamenti` — `athlete_id uuid pk → athletes on delete cascade`, `garmin_user_id text unique`, `stato text check in ('in_attesa','attivo','da_ricollegare') not null default 'in_attesa'`, `access_cifrato text`, `refresh_cifrato text`, `access_scade_at timestamptz`, `refresh_scade_at timestamptz`, `permessi text[] not null default '{}'`, `invia_workout boolean not null default true`, `consenso_versione smallint`, `consenso_at timestamptz`, `collegato_at timestamptz`, `pkce_state text unique`, `pkce_verifier text`, `pkce_ritorno text`, `pkce_at timestamptz`, `aggiornato_at timestamptz not null default now()`. RLS attiva, **nessuna policy**.
  - `public.garmin_attivita` — `garmin_id text pk`, `athlete_id uuid not null → athletes cascade`, `inizio timestamptz not null`, `giorno date not null`, `tipo text not null`, `durata_s integer`, `distanza_m numeric`, `dati jsonb not null default '{}'`, `athlete_workout_id uuid → athlete_workouts on delete set null`, `abbinamento text check in ('auto','atleta')`, `ricevuto_at timestamptz not null default now()`; indice `(athlete_id, giorno)`.
  - `public.garmin_giornate` — `athlete_id uuid → athletes cascade`, `giorno date`, `giornata jsonb`, `sonno jsonb`, `hrv jsonb`, `aggiornato_at timestamptz not null default now()`, pk `(athlete_id, giorno)`.
  - `public.garmin_invii` — `athlete_workout_id uuid pk → athlete_workouts cascade`, `athlete_id uuid not null → athletes cascade`, `garmin_workout_id text`, `garmin_schedule_id text`, `data date not null`, `stato text check in ('inviato','da_rifare','errore') not null`, `errore text`, `aggiornato_at timestamptz not null default now()`.
  - `public.stato_garmin(atleta uuid) returns table (stato text, collegato_at timestamptz, permessi text[], invia_workout boolean)` — `security definer`, `set search_path = ''`, righe solo se `atleta = auth.uid() or public.mio_atleta(atleta)`, e solo con `stato <> 'in_attesa'`.
  - `public.garmin_avvisa()` — funzione trigger: `net.http_post` a `https://riyqtcssllupakjtoehj.supabase.co/functions/v1/<TG_ARGV[0]>` con header `x-garmin-interno` = segreto Vault `garmin_interno` e corpo `{type: TG_OP, table: TG_TABLE_NAME, record: to_jsonb(new), old_record: to_jsonb(old)}`.
  - Trigger `garmin_atleta_eliminato` — `after update of deleted_at on athletes`, `when (old.deleted_at is null and new.deleted_at is not null)`, `execute function garmin_avvisa('garmin-auth')`. **Attivo**.
  - Trigger `garmin_invii_assegnazioni` (`athlete_workouts`, insert/update/delete) e `garmin_invii_workout` (`workouts`, update/delete) → `garmin_avvisa('garmin-training')`. Creati e subito `alter table … disable trigger …`.

- [ ] **Step 1: Scrivere il file SQL** con l'intestazione nello stile di `come_stai_2026-10-13.sql`: cosa fa, «sì di principio del 27/10, sì esplicito da chiedere su questo file», perché ogni scelta. Policy:
  - `garmin_attivita`, `garmin_giornate`, `garmin_invii`: una policy `select` per `authenticated` con `using (athlete_id = auth.uid() or public.mio_atleta(athlete_id))`.
  - `garmin_attivita` in più: `revoke update on public.garmin_attivita from authenticated; grant update (athlete_workout_id, abbinamento) on public.garmin_attivita to authenticated;` e una policy `update` con la stessa `using` e lo stesso `with check`.
  - Nessuna `insert`/`delete` per `authenticated`: scrivono le Edge Function con la service role.
  - In fondo, come gli altri file: le query di verifica (`select policyname, cmd from pg_policies where tablename like 'garmin_%'`; `select tgname, tgenabled from pg_trigger where tgname like 'garmin_%'`), il comando per creare il segreto del Vault (`select vault.create_secret('<GARMIN_INTERNO_TOKEN>', 'garmin_interno');`) **prima** del resto, e il rollback completo (drop trigger, funzioni e tabelle in ordine inverso).

- [ ] **Step 2: Controllare la sintassi senza applicarla.** Run: `supabase db lint --help >/dev/null && echo ok` per vedere se la CLI è collegata; se no, rileggere il file contro `multi_coach_2026-10-15.sql` (stessa forma per `security definer` e `search_path`). Expected: nessun riferimento a colonne o funzioni che non esistono (`mio_atleta`, `athletes.deleted_at`, `athlete_workouts.id`).

- [ ] **Step 3: Backup notturno.** In `db-backup.yml` aggiungere a `TABLES`: `garmin_attivita:garmin_id garmin_giornate:athlete_id.asc,giorno garmin_invii:athlete_workout_id`, con un commento come quelli di `come_stai`: finché la migrazione non è applicata la tabella manca, e il commento dice cosa fa lo script in quel caso (leggerlo nello script prima di scriverlo). **Non** `garmin_collegamenti`: i token non vanno nei backup.

- [ ] **Step 4: Commit**
```bash
git add supabase/schema/garmin_2026-10-27.sql .github/workflows/db-backup.yml
git commit -m "Garmin: la migrazione delle quattro tabelle (scritta, non applicata)"
```

---

### Task 2: Le regole pure del server

**Files:**
- Create: `supabase/functions/_shared/garminRegole.ts` (niente import Deno né rete)
- Test: `src/lib/__tests__/garminServer.test.js`

**Interfaces:**
- Produces:
  - `GARMIN` — costanti degli indirizzi: `autorizza`, `token`, `utenteId`, `permessi`, `registrazione`. Valori dalla documentazione del portale (Step 1).
  - `PERMESSI_NOTI = ['ACTIVITY_EXPORT', 'HEALTH_EXPORT', 'WORKOUT_IMPORT']`
  - `async generaPkce(): Promise<{ verifier: string, sfida: string }>` — verifier base64url di 64 caratteri, sfida = base64url(SHA-256(verifier)). Usa `crypto.subtle` (c'è in Deno e in Node 20).
  - `generaState(): string` — 32 byte casuali in base64url.
  - `urlAutorizzazione({ clientId, sfida, state, redirectUri }): string` — `response_type=code`, `code_challenge_method=S256`.
  - `ritornoValido(ritorno: string, extra: string[]): boolean` — `'app'` oppure un'origine esatta fra quelle ammesse (Global Constraints).
  - `MOTIVI_ERRORE = ['annullato', 'scaduto', 'altro_account', 'garmin']`
  - `urlRitorno(ritorno: string, esito: 'ok'|'errore', motivo?: string): string` — `'app'` → `fleofit://garmin?esito=…[&motivo=…]`; un'origine → `<origine>/settings?garmin=…[&motivo=…]`.
  - `esitoCallback({ riga, adesso, garminUserIdGiaDi }): { ok: true } | { ok: false, motivo: 'scaduto'|'altro_account' }` — `scaduto` se `riga` manca o `pkce_at` è più vecchio di **15 minuti**; `altro_account` se `garminUserIdGiaDi` è un atleta diverso da `riga.athlete_id`.
  - `async cifra(testo: string, chiaveB64: string): Promise<string>` / `async decifra(cifrato: string, chiaveB64: string): Promise<string>` — AES-GCM, IV casuale da 12 byte in testa, tutto in base64.
  - `leggiNotifiche(corpo: unknown): { revoche: string[], permessi: { garminUserId: string, permessi: string[] }[] }` — da `deregistrations[].userId` e `userPermissionsChange[].{userId, permissions}`; tutto il resto ignorato, mai un'eccezione.
  - `pianoScollegamento({ origine: 'app'|'garmin'|'eliminato' }): { avvisaGarmin: boolean, cancellaDati: true }` — `avvisaGarmin` è falso solo per `origine: 'garmin'` (Garmin lo sa già).
  - `scaduto(scadeAt: string|null, adesso: Date, margineS = 300): boolean`

- [ ] **Step 1: Prendere gli indirizzi dal portale.** Aprire la documentazione Garmin (OAuth2 PKCE, Health API «User Endpoints», «Push» e «Deregistration») nel portale del committente; scrivere i cinque indirizzi in `GARMIN` con un commento «letto il <data> da <pagina>». I nomi dei campi delle notifiche (`deregistrations`, `userPermissionsChange`) si verificano nella stessa pagina. Se il committente non è disponibile ad aprirla, fermarsi e chiedere: niente indirizzi a memoria.

- [ ] **Step 2: Scrivere i test**, nello stile di `segnalazioneServer.test.js` (blocco «Perché questi test esistono» in testa):
  - `generaPkce` → verifier di 64 caratteri `[A-Za-z0-9_-]`; la sfida del verifier di esempio di RFC 7636 (`dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk`) è `E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM`.
  - `urlAutorizzazione` contiene `code_challenge_method=S256`, il `state` e il `redirect_uri` codificato.
  - `ritornoValido`: `'app'` sì, `'https://fleofit.vercel.app'` sì, `'https://fleofit.vercel.app.evil.com'` no, `'https://fleofit.vercel.app/settings'` no (un'origine, non un indirizzo), un'origine in `extra` sì.
  - `urlRitorno('app','errore','annullato')` === `'fleofit://garmin?esito=errore&motivo=annullato'`; `urlRitorno('http://localhost:5173','ok')` === `'http://localhost:5173/settings?garmin=ok'`.
  - `esitoCallback`: riga mancante → `scaduto`; `pkce_at` di 16 minuti fa → `scaduto`; 14 minuti → ok; `garminUserIdGiaDi: 'altro-atleta'` → `altro_account`; uguale a `riga.athlete_id` → ok (ricollegamento dello stesso atleta).
  - `cifra`/`decifra`: andata e ritorno; due cifrature dello stesso testo sono diverse; con un'altra chiave `decifra` rifiuta.
  - `leggiNotifiche`: le due forme; `null`, una stringa, `{ activities: [...] }` → liste vuote senza eccezioni.
  - `pianoScollegamento` per le tre origini.
  - `scaduto`: `null` → true; fra 10 minuti → false; fra 4 minuti → true.

- [ ] **Step 3: Vederli fallire.** Run: `npx vitest run src/lib/__tests__/garminServer.test.js`. Expected: FAIL, il modulo non esiste.

- [ ] **Step 4: Implementare `garminRegole.ts`** con le firme sopra. Solo API web standard (`crypto`, `TextEncoder`, `URL`, `btoa`/`atob`).

- [ ] **Step 5: Vederli passare, poi rompere apposta** `esitoCallback` (togliere il controllo `altro_account`) e vedere fallire il suo test, e rimetterlo. Run: `npx vitest run src/lib/__tests__/garminServer.test.js`. Expected: PASS.

- [ ] **Step 6: Commit**
```bash
git add supabase/functions/_shared/garminRegole.ts src/lib/__tests__/garminServer.test.js
git commit -m "Garmin: le regole pure del collegamento (PKCE, ritorno, cifratura, notifiche)"
```

---

### Task 3: `garmin-auth`

**Files:**
- Create: `supabase/functions/_shared/garmin.ts` (chiamate HTTP a Garmin, Deno)
- Create: `supabase/functions/garmin-auth/index.ts`, `supabase/functions/garmin-auth/deno.json` (copia di quello di `estrai-note`)
- Modify: `supabase/config.toml` (sezione `[functions.garmin-auth]`, `verify_jwt = false`, col commento: il callback arriva dal browser senza JWT, quindi l'identità si verifica a mano come in `segnalazione`)

**Interfaces:**
- Consumes: tutto `garminRegole.ts` (Task 2); le tabelle del Task 1.
- Produces:
  - `_shared/garmin.ts`: `scambiaCodice({ codice, verifier, redirectUri })`, `rinnova(refreshToken)` → `{ access, refresh, accessScadeAt, refreshScadeAt }`; `leggiUtenteId(access): Promise<string>`; `leggiPermessi(access): Promise<string[]>`; `cancellaRegistrazione(access): Promise<boolean>`; `async accessValido(admin, riga): Promise<string|null>` — rinnova se `scaduto`, salva i token nuovi cifrati; se il rinnovo fallisce mette `stato='da_ricollegare'` e torna `null`; `async scollegaAtleta(admin, athleteId: string, origine: 'app'|'garmin'|'eliminato'): Promise<void>` (Step 4).
  - HTTP di `garmin-auth`:
    - `POST {azione:'inizia', consenso:1, ritorno:'app'|<origine>}` con JWT dell'atleta → `{ url }`. 400 se `consenso !== 1` o `ritorno` non valido; 403 se chi chiama è staff (`_shared/staff.ts`).
    - `GET ?code&state` oppure `?error&state` (callback da Garmin) → `302` verso `urlRitorno(...)`.
    - `POST {azione:'scollega'}` con JWT dell'atleta → `{ ok: true }`.
    - `POST` con header `x-garmin-interno` uguale a `GARMIN_INTERNO_TOKEN` e corpo del trigger `{type:'UPDATE', table:'athletes', record:{id}}` → scollega quell'atleta con origine `eliminato`.
  - Redirect URI registrato su Garmin: `https://riyqtcssllupakjtoehj.supabase.co/functions/v1/garmin-auth` (il GET è il callback).

- [ ] **Step 1: `_shared/garmin.ts`** con le firme sopra; ogni risposta non 2xx diventa un errore con lo status nel messaggio. Le chiavi arrivano da `Deno.env`.

- [ ] **Step 2: `inizia`.** Verifica il JWT con `auth.getUser` (come `segnalazione/index.ts`), rifiuta lo staff, genera PKCE e state, fa l'upsert su `garmin_collegamenti` dei soli campi `pkce_*`, `consenso_versione`, `consenso_at` (una riga `attivo` non torna `in_attesa`).

- [ ] **Step 3: callback.**
  1. Cerca la riga per `pkce_state`.
  2. Se c'è `error`, svuota i `pkce_*` e manda `motivo=annullato`.
  3. Altrimenti, nell'ordine: `scambiaCodice`, poi `leggiUtenteId`, poi cerca chi ha già quel `garmin_user_id`, poi `esitoCallback`.
  4. Se l'esito è ok: salva i token cifrati, `permessi`, `stato='attivo'`, `collegato_at` (solo se vuoto) e svuota i `pkce_*`. Poi scrive `consenso_garmin: { versione, il }` nei metadati con `auth.admin.updateUserById`, partendo dai metadati attuali **riletti** e riscritti tutti: un oggetto parziale potrebbe cancellare `consenso`.
  5. Qualunque eccezione → `motivo=garmin`, col log.
  6. Svuotare i `pkce_*` **prima** dello scambio rende inutilizzabile un `state` riusato (Review Focus 4).

- [ ] **Step 4: `scollega`** (atleta, interno, e la funzione `scollegaAtleta(admin, athleteId, origine)` che userà anche il webhook):
  1. Calcola `pianoScollegamento`.
  2. Se c'è da avvisare Garmin: `accessValido`, poi `cancellaRegistrazione`. Gli errori si registrano nel log e si va avanti.
  3. Cancella `garmin_invii`, `garmin_attivita`, `garmin_giornate` e `garmin_collegamenti` dell'atleta.
  4. Mette `consenso_garmin: null` nei metadati, con la stessa rilettura dello Step 3.
  - Esportare `scollegaAtleta` da `_shared/garmin.ts`, non da `index.ts`.

- [ ] **Step 5: Controllo dei tipi.** Run: `deno check supabase/functions/garmin-auth/index.ts`. Expected: nessun errore.

- [ ] **Step 6: Commit**
```bash
git add supabase/functions/_shared/garmin.ts supabase/functions/garmin-auth/index.ts supabase/functions/garmin-auth/deno.json supabase/config.toml
git commit -m "Garmin: garmin-auth, collegamento OAuth lato server e scollegamento"
```

---

### Task 4: `garmin-webhook` (revoche e permessi)

**Files:**
- Create: `supabase/functions/garmin-webhook/index.ts`, `supabase/functions/garmin-webhook/deno.json`
- Modify: `supabase/config.toml` (`[functions.garmin-webhook]`, `verify_jwt = false`)

**Interfaces:**
- Consumes: `leggiNotifiche`, `pianoScollegamento` (Task 2); `scollegaAtleta` (Task 3).
- Produces: indirizzo da registrare nel portale Garmin per **deregistrazioni** e **cambi di permessi**: `https://riyqtcssllupakjtoehj.supabase.co/functions/v1/garmin-webhook/<GARMIN_WEBHOOK_TOKEN>` (⚠️ corretto il 28/10/2026: Garmin toglie la query, il token va nel percorso). Le Fasi 1–2 aggiungono qui gli altri tipi.

- [ ] **Step 1: Implementare.**
  - Con `t` sbagliato → `200` vuoto e un log. Garmin non deve ritentare, ma niente viene toccato.
  - Con `t` giusto: `leggiNotifiche`.
    - Ogni revoca: trovare l'atleta dal `garmin_user_id` e chiamare `scollegaAtleta(..., 'garmin')`.
    - Ogni cambio di permessi: aggiornare `permessi` e `aggiornato_at`.
  - Un `garmin_user_id` che non conosciamo si salta con un log.
  - Risposta sempre `200`, anche se una voce fallisce: le voci sono indipendenti.
- [ ] **Step 2:** Run: `deno check supabase/functions/garmin-webhook/index.ts`. Expected: nessun errore.
- [ ] **Step 3: Commit**
```bash
git add supabase/functions/garmin-webhook/index.ts supabase/functions/garmin-webhook/deno.json supabase/config.toml
git commit -m "Garmin: garmin-webhook per revoche e cambi di permessi"
```

---

### Task 5: Il lato app: riga in Impostazioni, foglio del consenso, ritorno da Garmin

**Files:**
- Create: `src/lib/garmin.js`, `src/components/FoglioGarmin.jsx`
- Modify: `src/pages/Settings.jsx` (sezione «Privacy»: la riga va **sopra** «Informativa privacy», in una sezione nuova «Dispositivi» subito prima), `src/App.jsx` (`DeeplinkHandler`), `src/test/fintoSupabase.js` (aggiungere `rpc`), `src/supabaseDemo.js` (`stato_garmin` → `[]`)
- Test: `src/lib/__tests__/garmin.test.js`, `src/pages/__tests__/ImpostazioniGarmin.test.jsx`

**Interfaces:**
- Consumes: HTTP di `garmin-auth` (Task 3); `stato_garmin` (Task 1).
- Produces (`src/lib/garmin.js`), usati anche dal Task 6:
  - `VERSIONE_CONSENSO_GARMIN = 1`
  - `async leggiStatoGarmin(supabase, atletaId): Promise<{ disponibile: boolean, stato: null|'attivo'|'da_ricollegare', dal: string|null, permessi: string[] }>` — `disponibile: false` se la funzione SQL manca (`PGRST202`) o la lettura fallisce; `stato: null` = non collegato.
  - `etichettePermessi(permessi: string[]): string[]` — `ACTIVITY_EXPORT`→`'attività'`, `HEALTH_EXPORT`→`'salute e recupero'`, `WORKOUT_IMPORT`→`'workout all\'orologio'`, nell'ordine di `PERMESSI_NOTI`; sconosciuti ignorati.
  - `permessiMancanti(permessi: string[]): string[]` — le etichette dei noti assenti.
  - `ritornoGarmin(): 'app' | string` — `'app'` se `Capacitor.isNativePlatform()`, altrimenti `window.location.origin`.
  - `rottaDaDeepLinkGarmin(url: string): string|null` — `fleofit://garmin?esito=ok&motivo=x` → `'/settings?garmin=ok&motivo=x'`; qualunque altro url → `null`.
  - `MESSAGGI_ESITO` — `ok`: «Garmin collegato» / «I dati del tuo Garmin arriveranno a FLEOFIT dalla prossima sincronizzazione.»; motivi `annullato`, `scaduto` («Il collegamento è rimasto aperto troppo a lungo: riprova.»), `altro_account` («Questo account Garmin è già collegato a un altro atleta.»), `garmin` («Garmin non ha risposto: riprova fra qualche minuto.»), qualunque altro → messaggio generico.
  - `dataCollegamento(iso): string|null` — «3 nov 2026», come `dataConsenso`.

- [ ] **Step 1: Test di `garmin.js`.**
  - `leggiStatoGarmin`: `rpc` che risponde `{ error: { code: 'PGRST202' } }` → `disponibile:false`; `[]` → `{disponibile:true, stato:null}`; una riga → i campi.
  - `etichettePermessi(['WORKOUT_IMPORT','X','ACTIVITY_EXPORT'])` → `['attività','workout all\'orologio']`; `permessiMancanti(['ACTIVITY_EXPORT'])` → le altre due.
  - `rottaDaDeepLinkGarmin`: il caso ok; `fleofit://login-callback#access_token=…` → `null`; `https://x/garmin` → `null`.
  - `MESSAGGI_ESITO` ha un messaggio per ogni voce di `MOTIVI_ERRORE`, importato da `supabase/functions/_shared/garminRegole.ts` (Task 2): un motivo nuovo sul server senza messaggio nell'app fa fallire il test.
- [ ] **Step 2:** Run `npx vitest run src/lib/__tests__/garmin.test.js` → FAIL. Implementare. Run → PASS.

- [ ] **Step 3: `fintoSupabase`**: `rpc: vi.fn((nome) => …)` che legge la risposta da `risposte['rpc:' + nome]` (un array, o un oggetto `{ error }`); senza voce → `{ data: [], error: null }`. Documentarlo nel commento JSDoc come gli altri parametri. `supabaseDemo.js`: `stato_garmin` → `{ data: [], error: null }`.

- [ ] **Step 4: Test della pagina** (`ImpostazioniGarmin.test.jsx`, montata come in `Impostazioni.test.jsx`):
  1. `rpc:stato_garmin` con `PGRST202` → nessun testo «Garmin».
  2. Atleta non collegato → riga «Garmin Connect» con dettaglio «Non collegato»; toccandola si apre il foglio; «Collega» è `disabled` finché la casella col testo esatto del consenso non è spuntata; dopo, `functions.invoke('garmin-auth', { body: { azione:'inizia', consenso:1, ritorno: window.location.origin } })`.
  3. Collegato → «Collegato · dal 3 nov 2026» e «Hai autorizzato: attività, salute e recupero»; «Scollega» chiede conferma con `CustomConfirm` e poi chiama `invoke('garmin-auth', { body: { azione:'scollega' } })`.
  4. `da_ricollegare` → dettaglio «Da ricollegare» e il foglio offre «Collega di nuovo».
  5. Staff e admin in «Simula atleta» → nessuna riga Garmin.
  6. Montata su `/settings?garmin=errore&motivo=altro_account` → `CustomAlert` col messaggio di `altro_account`, e il parametro sparisce dall'indirizzo (`replace`).
- [ ] **Step 5:** Run → FAIL.

- [ ] **Step 6: `FoglioGarmin.jsx`**: bottom sheet con `useBottomSheet`, `createPortal`, X `aria-label="Chiudi"`.
  - **Non collegato**: due righe su cosa riceviamo, prese dalla policy sezione 3 (attività senza tracce GPS; sonno, HRV, FC a riposo, stress). Sotto, la casella del consenso, il link «Leggi l'informativa» con `apriInformativa()` e il bottone «Collega» (`bg-brand`).
  - **Collegato**: data, permessi, mancanti e «Scollega».
  - «Collega» chiama `inizia`. Sul nativo apre `url` con `Browser.open`, sul web `window.location.assign(url)`. Un errore va in `CustomAlert`.

- [ ] **Step 7: `Settings.jsx`**:
  - stato `garmin` letto con `leggiStatoGarmin(supabase, user.id)` solo se `atletaVero`;
  - sezione «Dispositivi» con un `RigaAzione` (icona `Watch` di lucide) solo se `disponibile`;
  - effetto all'apertura che legge `?garmin=` e `&motivo=`, mostra `CustomAlert`, rilegge lo stato e pulisce l'indirizzo con `navigate('/settings', { replace: true })`.
- [ ] **Step 8: `DeeplinkHandler`**: dentro `appUrlOpen`, **prima** di tutto il resto del ramo `fleofit:`, `const rotta = rottaDaDeepLinkGarmin(event.url); if (rotta) { Browser.close().catch(() => {}); return vaiA.current(rotta, { replace: true }) }` (Review Focus 1).
- [ ] **Step 9:** Run `npx vitest run src/lib/__tests__/garmin.test.js src/pages/__tests__/ImpostazioniGarmin.test.jsx src/pages/__tests__/Impostazioni.test.jsx` → PASS. Poi rompere apposta la condizione `disponibile` e vedere fallire il test 1.
- [ ] **Step 10: Commit**
```bash
git add src/lib/garmin.js src/components/FoglioGarmin.jsx src/pages/Settings.jsx src/App.jsx src/test/fintoSupabase.js src/supabaseDemo.js src/lib/__tests__/garmin.test.js src/pages/__tests__/ImpostazioniGarmin.test.jsx
git commit -m "Garmin: riga in Impostazioni, consenso separato e ritorno dal collegamento"
```

---

### Task 6: Il coach vede chi è collegato

**Files:**
- Modify: `src/pages/AthleteDetail.jsx` (la costante `anagrafica`)
- Test: `src/pages/__tests__/SchedaAtleta.test.jsx`

**Interfaces:**
- Consumes: `leggiStatoGarmin`, `dataCollegamento` (Task 5).

- [ ] **Step 1: Test.**
  - Staff con `rpc:stato_garmin` = una riga `attivo` del 3 nov 2026 → l'anagrafica contiene «Garmin dal 3 nov».
  - Con `[]` o `PGRST202` → nessun «Garmin».
  - L'atleta sul **suo** profilo non lo vede, perché ce l'ha in Impostazioni.
- [ ] **Step 2:** Run `npx vitest run src/pages/__tests__/SchedaAtleta.test.jsx` → FAIL.
- [ ] **Step 3: Implementare.**
  - Leggere lo stato solo se `role !== 'athlete'`, in un effetto proprio con `.catch`.
  - Aggiungere `'Garmin dal 3 nov'` in coda alla lista di `anagrafica`, col formato «d MMM» e l'anno solo se diverso, come la pausa. Con `da_ricollegare` scrivere «Garmin da ricollegare».
- [ ] **Step 4:** Run → PASS; rompere e rivedere fallire.
- [ ] **Step 5: Commit**
```bash
git add src/pages/AthleteDetail.jsx src/pages/__tests__/SchedaAtleta.test.jsx
git commit -m "Garmin: il coach vede nella scheda chi ha collegato Garmin"
```

---

### Task 7: Policy, memoria, istruzioni per il committente

**Files:**
- Modify: `public/privacy-policy.html` (sezione 3; meta `versione-policy` aggiornata secondo la regola scritta in testa al file)
- Create: `docs/memoria/garmin.md`
- Modify: `CLAUDE.md` (§11: una riga «`garmin.js`, `FoglioGarmin`, Edge Function `garmin-auth` e `garmin-webhook`, `_shared/garmin*.ts`» → `garmin.md`; §4: una riga per le quattro tabelle con «⏳ da applicare»), `BACKLOG.md` (voce Garmin con le Fasi 1–3 e i passi del committente)

- [ ] **Step 1: Policy, sezione 3.**
  - Togliere «peso e composizione corporea se li registri su Garmin».
  - Aggiungere una voce «Cosa mandiamo a Garmin»: i workout che il coach ti assegna, se lasci acceso «Manda i workout all'orologio», per mostrarli nel calendario Garmin e sul dispositivo.
  - Stesse due modifiche nella parte in inglese.
- [ ] **Step 2: `docs/memoria/garmin.md`.** Cosa c'è, dove, perché (le tre deviazioni del piano). Le trappole:
  - deep link prima del ramo login;
  - metadati riletti prima di riscriverli;
  - `pkce_*` svuotati prima dello scambio;
  - token mai nel backup.

  Poi i **passi del committente**, in ordine:
  1. sì esplicito sul file SQL;
  2. `vault.create_secret`;
  3. applicare il SQL;
  4. i cinque secret con `supabase secrets set`;
  5. `supabase functions deploy garmin-auth` e `garmin-webhook`;
  6. nel portale Garmin: redirect URI e indirizzo del webhook per deregistrazioni e permessi;
  7. prova con il suo account Garmin sul telefono (`npm run ios`);
  7-bis. nella versione App Store che porta Garmin agli atleti: etichette privacy (salute e fitness) e note per il revisore (`demo@fleofit.it` è staff e non vede la riga);
  8. `app:main` per la policy prima di aprire agli atleti.
- [ ] **Step 3: Suite intera e lint.**
  - Run: `npm test` → Expected: tutti verdi, **2274 + i nuovi**.
  - Run: `npx eslint src` → Expected: non più dei **26** problemi di oggi, nessuno nei file nuovi.
  - Run: `npm run build` → Expected: `index` intorno ai 594 KB (`garmin.js` è piccolo; `FoglioGarmin` si importa solo da `Settings`).
- [ ] **Step 4: Commit**
```bash
git add public/privacy-policy.html docs/memoria/garmin.md CLAUDE.md BACKLOG.md
git commit -m "Garmin: policy, memoria e passi per attivare il collegamento"
```
