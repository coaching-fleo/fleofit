# Più coach — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** più coach nella stessa app; ogni coach vede e raggiunge solo i suoi atleti, gli admin vedono e fanno tutto.

**Architecture:** la separazione la fa il database: tabelle `staff` e `coach_atleti`, colonne `workouts.creato_da` e `messaggi_coach.destinatari`, funzioni `security definer` richiamate da tutte le policy — tutto in `supabase/schema/multi_coach_2026-10-15.sql`. L'app legge il ruolo da `staff`; le Edge Function, che usano la chiave di servizio, applicano a mano la stessa regola tramite `_shared/admin.ts`.

**Tech Stack:** Supabase Postgres + RLS, Edge Function Deno, React 19, vitest.

**Spec:** `docs/superpowers/specs/2026-10-15-multi-coach-design.md` (decisioni D1–D10).

## Global Constraints

- 🔒 Schema congelato (CLAUDE.md §0, 0-bis): il Task 1 parte **solo** dopo un sì esplicito alla migrazione, che è la prima **non additiva**. Prima: backup.
- Un database per web, iOS, Android e per le versioni già sugli Store (1.2.0, 1.2.1): tutto deve funzionare con l'app vecchia, che decide il ruolo da `ADMIN_EMAILS`.
- Ordine di pubblicazione: database (Task 1) → Edge Function (Task 3–4) → app.
- `demo@fleofit.it` è admin ma **non** scrive messaggi agli atleti (`EMAIL_DEMO` in `broadcast.ts`).
- Ruoli: `'admin' | 'coach'` dalla tabella; chi non c'è è `'athlete'`.
- Solo admin (D9): gestione coach, Backup/Ripristino, «Simula atleta», codici invito di tutti. TV Dashboard: tutti.
- Italiano in interfaccia e commenti; colori invariati; modali con `createPortal` e X con `aria-label="Chiudi"`.
- Ogni test nuovo si vede fallire prima di vederlo passare.

## Review Focus

1. **Coach senza atleti** apre Home, Atleti, Calendario, Archivio, Report, Messaggi: stati vuoti, nessun errore → test in Task 2, Step 6.
2. **App vecchia con `federico_leo@hotmail.it`**: bottoni da admin, ma il database dà solo i suoi dati; Backup/Ripristino non deve sovrascrivere atleti altrui → verifica in Task 1, Step 5.
3. **Workout appena creato** (`insert(...).select().single()` in `CreateWorkout.jsx`) torna al builder anche per un coach → verifica SQL in Task 1, Step 4.
4. **Atleta con due coach** (futuro, D3): riceve messaggi e notifiche di entrambi, nessuno dei due vede gli atleti dell'altro → test in Task 3, Step 1.
5. **Admin declassato a coach** dopo aver scritto un messaggio `tutti`: il messaggio sparisce dalla bacheca degli atleti degli altri (`utente_admin(autore)` nella policy) → verifica SQL in Task 1, Step 4.

---

### Task 1: Migrazione del database

**Files:**
- Apply: `supabase/schema/multi_coach_2026-10-15.sql` (pronto, **non applicato**)
- Modify: `supabase/schema/README.md`, `docs/memoria/database.md`, `CLAUDE.md` (§0-bis quarta eccezione, §1.2 ruoli, §4 tabelle), `BACKLOG.md` (i tre buchi fuori: push_subscriptions, storage.objects, tv_sessions)

**Produces:** `staff(email, ruolo)`, `coach_atleti(athlete_id, coach_id)` con chiave sulla coppia, `workouts.creato_da`, `messaggi_coach.destinatari ('miei'|'tutti')`; funzioni `e_admin()`, `e_staff()`, `puo_scrivere_messaggi()`, `mio_atleta(uuid)`, `e_mio_coach(uuid)`, `utente_admin(uuid)`, `vedo_workout(uuid)`; trigger `athletes_assegna_coach`.

- [ ] **Step 1:** sì esplicito del committente alla migrazione (le decisioni sono già nella spec).
- [ ] **Step 2:** backup: `gh workflow run db-backup.yml` e attendere il verde.
- [ ] **Step 3:** `supabase db query --linked -f supabase/schema/multi_coach_2026-10-15.sql` → nessun errore (è tutta in `begin/commit`).
- [ ] **Step 4:** sezione 6 del file, più due casi: (a) come `federico_leo@hotmail.it`, `insert into workouts (title, date, sections) values ('prova', current_date, '{}') returning id` torna una riga; (b) un messaggio `tutti` di un admin è visibile a un atleta di `federico_leo`, e dopo `update staff set ruolo='coach'` su quell'admin non lo è più. Tutto dentro `begin … rollback`.
- [ ] **Step 5:** con l'app **già installata** (1.2.x), il committente prova da admin e da `federico_leo@hotmail.it`: Home, scheda atleta, crea e assegna workout, un atleta completa un workout. Annotare l'esito nel commit.
- [ ] **Step 6:** documentazione, poi commit di `supabase/schema/`, `docs/memoria/database.md`, `CLAUDE.md`, `BACKLOG.md`.

### Task 2: Il ruolo dal database nell'app

**Files:**
- Create: `src/lib/ruoli.js`, `src/lib/__tests__/ruoli.test.js`
- Modify: `src/App.jsx` (`ProtectedRoute`: i due `ADMIN_EMAILS.includes`), `src/pages/Settings.jsx`, `Home.jsx`, `AthleteDetail.jsx`, `WorkoutDetail.jsx`, `src/components/CustomAudioPlayer.jsx`, `src/demoSemi.js`, `src/supabaseDemo.js`

**Interfaces — Produces:**
- `leggiRuolo(supabase, email: string): Promise<'admin'|'coach'|null>` — `from('staff').select('ruolo').eq('email', email.trim().toLowerCase()).maybeSingle()`; se torna `error`, `ADMIN_EMAILS.includes(email)` → `'admin'`, altrimenti `null`.
- `eStaff(role: string): boolean` — `'admin'` o `'coach'`.
- `eAdmin(role: string): boolean` — solo `'admin'`.

- [ ] **Step 1: test** in `ruoli.test.js`: `eStaff('coach')` true, `eStaff('athlete')` false, `eAdmin('coach')` false, `eAdmin('admin')` true; `leggiRuolo` con finto supabase `{data:{ruolo:'coach'}}` → `'coach'`; con `{error:{}}` e `'Coaching@FedericoLeo.it '` → `'admin'`; con `{data:null}` e un'email qualunque → `null`.
- [ ] **Step 2:** `npx vitest run src/lib/__tests__/ruoli.test.js` → FAIL (modulo mancante).
- [ ] **Step 3:** implementare `ruoli.js`; in `App.jsx` il ruolo diventa `(await leggiRuolo(supabase, email)) ?? 'athlete'`, con `isAdmin = eStaff(ruolo)` dove oggi decide se saltare l'onboarding atleta.
- [ ] **Step 4:** ogni `role === 'admin'` / `role !== 'admin'` diventa `eStaff(role)` / `!eStaff(role)`, **tranne** in `Settings.jsx` i blocchi Backup/Ripristino, «Simula atleta» (`isAdminEmail`) e il caricamento dei codici, che diventano `eAdmin(role)`. Per un coach la sezione codici resta visibile: carica solo i suoi (lo fa la RLS). A fine step `grep -rn "role === 'admin'\|role !== 'admin'\|isAdminEmail" src --include='*.jsx' | grep -v __tests__` stampa niente.
- [ ] **Step 5:** demo: `demoSemi.js` aggiunge `staff` (le email di D1 + `coach.demo@fleofit.it` coach) e `coach_atleti` (il coach demo con 3 atleti finti); `supabaseDemo.js` legge `DEMO_RUOLO=coach` per entrare come lui. Il filtro RLS **non** esiste nel finto database: il coach demo serve a vedere l'interfaccia, non la sicurezza.
- [ ] **Step 6: test** in `src/pages/__tests__/` (con `montaPagina.jsx`): Home, Atleti e Messaggi montate con `role='coach'` e liste vuote non lanciano errori e mostrano lo stato vuoto.
- [ ] **Step 7:** `npm test` tutto verde; `npx eslint src` non oltre i 26 problemi attuali. Commit.

### Task 3: Edge Function — chi chiama, su chi agisce, a chi notificare

**Files:**
- Modify: `supabase/functions/_shared/admin.ts`, `ai-workout/index.ts`, `ricerca-coach/index.ts`, `estrai-note/index.ts`, `send-reminders/index.ts`
- Create: `supabase/functions/_shared/staff.ts` (parte pura, importabile da vitest come `broadcast.ts`), `supabase/functions/_shared/__tests__/staff.test.ts`

**Interfaces — Produces** (`_shared/staff.ts`; `ADMIN_EMAILS` resta in `admin.ts` solo come riserva):
- `ruoloStaff(db, email: string | null): Promise<'admin'|'coach'|null>`
- `atletiDi(db, coachId: string): Promise<string[]>` — `athlete_id` da `coach_atleti` per quel coach.
- `coachDi(db, athleteId: string): Promise<string[]>` — tutti i `coach_id` dell'atleta.
- `destinatariNotificaCoach(coachIds: string[], adminIds: string[]): string[]` — `coachIds` se non vuoto, altrimenti `adminIds` (D7).
- `idStaff(db): Promise<{ tutti: string[], admin: string[] }>` — id di `auth.users` dei membri di `staff` (sostituisce `trovaIdAdmin`).

- [ ] **Step 1: test** in `staff.test.ts` con finto client: `ruoloStaff` → `'coach'`/`'admin'`/`null`; `coachDi` di un atleta con due righe → due id; `destinatariNotificaCoach(['c1','c2'], ['a1'])` → `['c1','c2']`; `destinatariNotificaCoach([], ['a1'])` → `['a1']`.
- [ ] **Step 2:** FAIL, poi implementare `staff.ts`.
- [ ] **Step 3:** `ai-workout`, `ricerca-coach`: l'accesso passa da `ADMIN_EMAILS.includes` a `(await ruoloStaff(db, email)) !== null`.
- [ ] **Step 4:** `estrai-note`: se il chiamante è `'coach'` e `athleteId` non è in `atletiDi(db, idChiamante)` → risposta 403 `{ error: 'Atleta non tuo' }`, prima di qualunque lettura.
- [ ] **Step 5:** `send-reminders/index.ts`: `identificaChiamante` usa `ruoloStaff` (`admin: true` anche per i coach, con `ruoloStaff` restituito a parte); `trovaIdAdmin` → `idStaff`; promemoria mattina/sera escludono `idStaff().tutti`; `coach_notification` va a `destinatariNotificaCoach(await coachDi(db, athleteId), (await idStaff(db)).admin)`.
- [ ] **Step 6:** `npm test` verde. Commit. Deploy delle funzioni **dopo** il Task 1: `supabase functions deploy ai-workout ricerca-coach estrai-note send-reminders`.

### Task 4: Messaggio a tutti — solo ai propri atleti, o a tutti se admin

**Files:**
- Modify: `supabase/functions/send-reminders/broadcast.ts` (`puoInviareBroadcast`, `destinatariBroadcast`), il ramo `broadcast` di `send-reminders/index.ts`, `src/pages/NuovoMessaggio.jsx`, `src/components/FoglioMessaggio.jsx` (o dove sta il bottone Invia), il test esistente di `broadcast.ts`

**Interfaces:**
- Consumes: `ruoloStaff`, `atletiDi` (Task 3); `eAdmin` (Task 2).
- Produces: `destinatariBroadcast(..., ammessi: string[] | 'tutti')` — il nuovo parametro filtra gli `user_id` delle iscrizioni; `puoInviareBroadcast(email, ruolo: 'admin'|'coach'|null): boolean`.

- [ ] **Step 1: test** in quello di `broadcast.ts`: con `ammessi=['a1','a2']` e iscrizioni di `a1,a2,a3` → solo `a1,a2`; con `ammessi=[]` → `[]`; con `'tutti'` → `a1,a2,a3` (meno mittente, staff, già ricevuti, come oggi); `puoInviareBroadcast('x@y.it','coach')` true, `puoInviareBroadcast('demo@fleofit.it','admin')` false, `puoInviareBroadcast('x@y.it', null)` false.
- [ ] **Step 2:** FAIL, poi implementare. Nel ramo `broadcast`, `ammessi = (messaggio.destinatari === 'tutti' && ruolo === 'admin') ? 'tutti' : await atletiDi(db, idMittente)`. Con `ammessi` vuoto la funzione risponde `200 { inviati: 0, motivo: 'nessun destinatario' }`.
- [ ] **Step 3:** app: in `NuovoMessaggio.jsx`, solo se `eAdmin(role)`, un toggle segmentato (pattern §6) «I miei atleti» / «Tutti gli atleti», default «I miei atleti»; l'`insert` manda `destinatari: 'miei' | 'tutti'`. Il coach non vede il toggle e manda sempre `'miei'`. «Prova su di me» invariata.
- [ ] **Step 4: test** pagina: `NuovoMessaggio` con `role='coach'` non mostra il toggle; con `role='admin'` lo mostra e l'insert riceve `destinatari: 'tutti'` dopo il tocco su «Tutti gli atleti».
- [ ] **Step 5:** `npm test` verde, commit; `docs/memoria/messaggi.md` aggiornato.

### Task 5: Gestire i coach (solo admin)

**Files:**
- Create: `src/lib/coachAtleti.js`, `src/lib/__tests__/coachAtleti.test.js`, `src/components/FoglioCoach.jsx`
- Modify: `src/pages/Settings.jsx` + `src/components/ImpostazioniUI.jsx` (voce «Coach»), `src/pages/AthleteDetail.jsx` + `SchedaAtletaUI.jsx` (riga «Coach»)

**Interfaces — Produces:**
- `normalizzaEmail(s: string): string | null` — minuscolo, senza spazi; `null` se non contiene `@` e un punto dopo.
- `aggiungiCoach(supabase, email): Promise<{ error }>` — insert in `staff` con `ruolo: 'coach'`.
- `togliCoach(supabase, email, coachId): Promise<{ error }>` — rifiuta con `{ error: 'Ha ancora atleti' }` se `coach_atleti` ha righe per `coachId`, senza cancellare.
- `assegnaAtleta(supabase, athleteId, coachId, vecchioCoachId?): Promise<{ error }>` — insert su `coach_atleti`; se c'è `vecchioCoachId` cancella prima quella coppia (spostamento, D4).

- [ ] **Step 1: test** `coachAtleti.test.js`: `normalizzaEmail(' Mario@X.it ')` → `'mario@x.it'`; `normalizzaEmail('mario')` → `null` e `aggiungiCoach` non chiama il database; `togliCoach` con un atleta → `{ error: 'Ha ancora atleti' }` e nessun `delete`; `assegnaAtleta(s,'a1','c2','c1')` fa `delete` della coppia `a1/c1` poi `insert` di `a1/c2`.
- [ ] **Step 2:** FAIL, poi implementare.
- [ ] **Step 3:** Impostazioni → «Coach» (solo `eAdmin(role)`): elenco di `staff` con ruolo e numero di atleti, campo email + «Aggiungi coach», «Togli» con `CustomConfirm`. `FoglioCoach` è il bottom sheet della scelta in scheda atleta (`useBottomSheet`, `createPortal`).
- [ ] **Step 4:** scheda atleta → riga «Coach: <nome>» (solo `eAdmin`), che apre `FoglioCoach` con i membri di `staff` che hanno un account.
- [ ] **Step 5: test** pagina: `Settings` con `role='coach'` non mostra «Coach» né Backup; con `role='admin'` sì.
- [ ] **Step 6:** `npm test` verde, commit; `docs/memoria/impostazioni.md` e `scheda-atleta.md` aggiornati; elenco delle prove sul telefono per il committente in fondo al DEVLOG.
