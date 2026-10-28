# Garmin · Fase 1 (Attività) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** le attività registrate dall'orologio arrivano in FLEOFIT, completano da sole il workout giusto (con regole strette e un modo di annullare) e si vedono nella scheda, nel calendario e nella scheda atleta.

**Architecture:** Garmin spinge i riepiloghi delle attività a `garmin-webhook` (Push). Il webhook le salva in `garmin_attivita` (tabella già applicata il 28/10) e, in sottofondo, prova l'abbinamento con `abbinaGarmin.ts` (regole pure in `_shared`, provate da Vitest come `garminRegole.ts`). Un abbinamento completa `athlete_workouts` e avvisa coach e atleta con `send-reminders`. L'app legge `garmin_attivita` (RLS già pronta) per la card «Da Garmin», le voci grigie e «Abbina a…».

**Tech Stack:** Supabase Edge Functions (Deno, supabase-js 2.39.3), React 19, Vitest, date-fns locale `it`.

**Spec:** `docs/superpowers/specs/2026-10-27-garmin-design.md` §3 (Fase 1), §1, §6, §9, §10. Memoria: `docs/memoria/garmin.md` (limiti della Fase 0 da chiudere qui).

## Global Constraints

- 🔒 **Nessuna migrazione**: `garmin_attivita` e le sue policy esistono già (`garmin_2026-10-27.sql`, applicato). Nuovi campi solo dentro jsonb (`garmin_attivita.dati`, `workouts.sections`).
- Le Edge Function **non importano da `src/`**: la logica pura condivisa sta in `supabase/functions/_shared/*.ts` ed è provata da Vitest (`src/lib/__tests__/`), come `garminRegole.ts`.
- Il webhook risponde **sempre 200, in fretta**: il lavoro va in sottofondo con `EdgeRuntime.waitUntil` (stesso schema di `inSottofondo` in `garmin-training`).
- 🔒 Nei log solo id e conteggi: mai token, mai contenuto delle attività (FC, passi, distanza), mai il corpo di Garmin.
- Ogni indirizzo o nome di campo Garmin si prende dalla documentazione del portale e si annota con la data; quelli non verificati portano `⚠️ DA VERIFICARE`.
- L'RPE resta **vuoto** dopo un completamento automatico (`rpeDichiarato` → `null`, CLAUDE.md §9). `completed_date` **non si tocca**: è il giorno programmato.
- Testi italiani; nessun colore nuovo, le voci Garmin sono **grigie**; modali con `createPortal` e X `aria-label="Chiudi"`; mai `alert()`; aptica solo da `src/lib/aptica.js`.
- Commit con i file per nome, mai `git add -A`. Nessun push. Nessun comando `supabase` verso il remoto: i deploy li fa il committente.
- Attribuzione: dove si mostrano dati Garmin c'è la scritta «Garmin» (e il dispositivo, se arriva).

## Review Focus

1. **Garmin rimanda la stessa attività** (aggiornamento, o push doppio): l'upsert sovrascrive, ma il workout non si ricompleta e coach e atleta **non** ricevono una seconda notifica.
2. **Corsa alle 23:30 italiane, e cambio dell'ora**: il giorno è quello locale dell'atleta, calcolato con lo scostamento che manda Garmin, non quello del server.
3. **Il coach (o l'atleta) ha annullato** con «Non era questo allenamento», poi Garmin rimanda l'attività: **non** si riabbina da sola.
4. **L'atleta ha già segnato il workout a mano** prima che arrivi l'attività: niente sovrascritto, nessuna notifica; l'attività resta abbinabile a mano solo se l'atleta lo sceglie.
5. **Un atleta eliminato** (soft delete) a cui arrivano ancora attività: non si salvano, e il collegamento si chiude (limite della Fase 0).

---

### Task 1: il formato del Push delle attività, dal portale

Lo fa il **controller**, non un subagent: serve la sessione del committente nel portale Garmin (browser integrato, come per la Training API).

**Files:**
- Modify: `docs/memoria/garmin.md` (nuova sottosezione «Fase 1 · formato verificato»)
- Create: `src/lib/__tests__/fixtures/garminAttivita.json`

- [ ] **Step 1:** nel portale (Activity API, sezione Push / Activity Summaries) leggere: nome della chiave del lotto (atteso `activities`, più `manuallyUpdatedActivities`?), i campi di un riepilogo (attesi `userId`, `summaryId`, `activityId`, `activityType`, `startTimeInSeconds`, `startTimeOffsetInSeconds`, `durationInSeconds`, `distanceInMeters`, `averageHeartRateInBeatsPerMinute`, `maxHeartRateInBeatsPerMinute`, `averageSpeedInMetersPerSecond`, `totalElevationGainInMeters`, `activeKilocalories`, `deviceName`), l'elenco dei valori di `activityType`, e l'indirizzo e il corpo della richiesta di **backfill** delle attività.
- [ ] **Step 2:** scrivere quanto trovato in `garmin.md` con la data, e un payload di esempio **inventato** (nessun dato vero) nel fixture.
- [ ] **Step 3:** se un campo atteso non c'è, aggiornare questo piano (Task 2 e 3) prima di andare avanti, e annotarlo nel ledger.
- [ ] **Step 4: commit** — i due file · «Garmin: il formato delle attività, dal portale».

---

### Task 2: leggere le attività dal Push

**Files:**
- Create: `supabase/functions/_shared/attivitaGarmin.ts`
- Test: `src/lib/__tests__/attivitaGarmin.test.js`

**Interfaces:**
- Consumes: il fixture del Task 1.
- Produces:
  - `type AttivitaGarmin = { garminUserId: string, garmin_id: string, inizio: string /* ISO UTC */, giorno: string /* yyyy-MM-dd locale */, tipo: string, durata_s: number | null, distanza_m: number | null, dati: Record<string, unknown> }`
  - `leggiAttivita(corpo: unknown): AttivitaGarmin[]` — accetta le chiavi di lotto trovate al Task 1; scarta (senza lanciare) le voci senza `userId`, id o `startTimeInSeconds`.
  - `giornoLocale(inizioSec: number, offsetSec: number): string`.
  - `dati` contiene solo: `fc_media`, `fc_max`, `velocita_media_ms`, `dislivello_m`, `calorie`, `dispositivo` (assenti → chiave omessa).

- [ ] **Step 1: test che falliscono**: il fixture dà N attività con i campi giusti; `giornoLocale(<23:30 del 28/10 ora italiana in UTC>, 3600)` → `'2026-10-28'`; lo stesso istante con offset 0 → `'2026-10-28'` o `'2026-10-29'` secondo i conti (scrivere il caso che cambia giorno); una voce senza `userId` è scartata; un corpo non oggetto → `[]`; `dati` non porta campi sconosciuti.
- [ ] **Step 2:** `npx vitest run src/lib/__tests__/attivitaGarmin.test.js` → FAIL.
- [ ] **Step 3:** implementare (niente Deno né rete nel file).
- [ ] **Step 4:** → PASS.
- [ ] **Step 5: commit** · «Garmin: le attività lette dal Push».

---

### Task 3: le regole dell'abbinamento

**Files:**
- Create: `supabase/functions/_shared/abbinaGarmin.ts`
- Test: `src/lib/__tests__/abbinaGarmin.test.js`

**Interfaces:**
- Consumes: `AttivitaGarmin` (Task 2).
- Produces:
  - `TIPI_PER_CATEGORIA: Record<'Running'|'Hyrox'|'Gym', string[]>` con i valori `activityType` verificati al Task 1. Attesi: Running → `RUNNING`, `TRAIL_RUNNING`, `TREADMILL_RUNNING`, `TRACK_RUNNING`; Hyrox → quelli della corsa più `INDOOR_CARDIO`, `HIIT`, `STRENGTH_TRAINING`, `INDOOR_ROWING`, `OTHER`; Gym → `STRENGTH_TRAINING`, `INDOOR_CARDIO`, `HIIT`. Custom ed Event non ci sono.
  - `MINUTI_MINIMI = 10`, `FRAZIONE_STIMA = 0.5`.
  - `type Candidato = { id: string, giorno: string, categoria: string | null, completato: boolean, durataStimataMin: number | null }`
  - `scegliAbbinamento(x: { attivita: { giorno: string, tipo: string, durata_s: number | null, inizio: string, abbinamento: string | null, athlete_workout_id: string | null }, candidati: Candidato[], collegatoAt: string }): string | null` — l'id dell'assegnazione da completare, o `null`.

Regole, in ordine (spec §3):
1. attività già abbinata (`athlete_workout_id`) **o con `abbinamento` non nullo** → `null` (Review Focus 3: «Non era questo» lascia `abbinamento = 'atleta'` e id nullo);
2. `inizio < collegatoAt` → `null` (il backfill non completa);
3. candidati = stesso `giorno`, `completato === false`, tipo compatibile con la categoria;
4. durata: `durata_s ≥ MINUTI_MINIMI·60` **e**, se `durataStimataMin` c'è, `durata_s ≥ FRAZIONE_STIMA · durataStimataMin · 60`;
5. **esattamente un** candidato rimasto → il suo id; zero o più di uno → `null`.

- [ ] **Step 1: test che falliscono**: una riga per ogni tipo della tabella (compatibile e no); Custom ed Event mai; 9′59″ no e 10′ sì; stima 60′ con 29′ no e 30′ sì; stima assente con 12′ sì; due candidati → null; workout già completato escluso; attività prima del collegamento → null; attività con `abbinamento: 'atleta'` e id nullo → null; giorno diverso → null.
- [ ] **Step 2:** → FAIL. **Step 3:** implementare. **Step 4:** → PASS.
- [ ] **Step 5: commit** · «Garmin: quando un'attività completa un workout».

---

### Task 4: il builder salva la durata stimata

Decisione del committente (28/10/2026): per Hyrox e Gym il server non sa stimare la durata, quindi la scrive il builder dentro `sections` (jsonb, nessuna migrazione).

**Files:**
- Modify: `src/lib/statistiche.js` (nuova esportazione), `src/pages/CreateWorkout.jsx` (l'oggetto `sections` del salvataggio)
- Test: `src/lib/__tests__/statistiche.test.js`

**Interfaces:**
- Produces: `durataStimataReale(sections): number | null` in `statistiche.js` — come `durataWorkout`, ma `null` dove `durataWorkout` userebbe il ripiego `MINUTI_PREDEFINITI` (nessun tempo dichiarato), e `null` per Custom ed Event. `sections.durataStimata` (minuti interi) scritto al salvataggio per Running, Hyrox e Gym; omesso se `null`.
- Il webhook (Task 5) legge `sections.durataStimata`; se manca (workout vecchi o salvati da app vecchie) vale solo la regola dei 10 minuti.

- [ ] **Step 1: test che falliscono**: Hyrox con blocchi → stesso numero di `durataWorkout`; un workout senza tempi → `null` (dove `durataWorkout` dà 45); Custom → `null`.
- [ ] **Step 2:** → FAIL. **Step 3:** implementare e aggiungere `durataStimata` in `sections` nel salvataggio di `CreateWorkout` (leggere prima `docs/memoria/crea-workout.md`, salvataggio e bozza). **Step 4:** → PASS; `npm test` verde.
- [ ] **Step 5: commit** · «Il builder salva la durata stimata nel workout».

---

### Task 5: il webhook salva le attività e completa il workout

**Files:**
- Modify: `supabase/functions/garmin-webhook/index.ts`, `supabase/functions/_shared/garmin.ts` (eventuali letture condivise)

**Interfaces:**
- Consumes: `leggiAttivita` (Task 2), `scegliAbbinamento` (Task 3), `sections.durataStimata` (Task 4), `send-reminders` con `mode: 'coach_notification', action: 'completed', daGarmin: true, athleteId` e `mode: 'garmin_registrato', athlete_workout_id` (Task 6), chiamate con la service role come le altre funzioni server.
- Produces: righe in `garmin_attivita`; `athlete_workouts.status = 'completed'` sull'assegnazione scelta; `garmin_attivita.athlete_workout_id` + `abbinamento = 'auto'`.

Per ogni attività, in sottofondo, ognuna con il suo try/catch:
1. dall'`userId` all'atleta (`garmin_collegamenti`, `stato = 'attivo'`); sconosciuto → log e via;
2. **atleta eliminato** (`athletes.deleted_at` non nullo) → `scollegaAtleta(admin, id, 'garmin')`, niente salvato (Review Focus 5, limite della Fase 0);
3. upsert su `garmin_id` **senza toccare** `athlete_workout_id` e `abbinamento` di una riga che esiste già (Review Focus 1);
4. riletta la riga, `scegliAbbinamento` con i candidati del giorno (`athlete_workouts` dell'atleta con `completed_date = giorno`, categoria e `durataStimata` dai `workouts.sections`) e `collegato_at`;
5. se c'è un id: aggiornare `athlete_workouts` **solo se ancora non completato** (`.neq('status','completed')`, Review Focus 4) e, solo se l'update ha toccato una riga, scrivere l'abbinamento e mandare le due notifiche. Un update che non tocca niente = nessuna notifica.

Il messaggio non riconosciuto e il log «N revoche, M permessi» diventano «N attività, M revoche, K permessi».

- [ ] **Step 1:** implementare. **Step 2:** `deno check supabase/functions/garmin-webhook/index.ts` (poi `git checkout -- deno.lock`). **Step 3:** `npm test` verde.
- [ ] **Step 4: commit** · «Garmin: le attività arrivano e completano il workout».

---

### Task 6: le due notifiche in `send-reminders`

⚠️ `send-reminders` serve anche la web app: il deploy la tocca. Le modifiche sono **solo aggiunte**.

**Files:**
- Modify: `supabase/functions/send-reminders/index.ts`
- Test: quelli già esistenti per i testi delle notifiche, se ci sono (`grep -rn "coach_notification" src/lib/__tests__`); altrimenti un test sulla funzione pura del testo, estratta.

**Interfaces:**
- `coach_notification` + `action: 'completed'` + `daGarmin: true` → corpo «<atleta> ha completato: <titolo> · da Garmin».
- Nuovo `mode: 'garmin_registrato'` con `athlete_workout_id`: **solo il chiamante di servizio** (la service role); notifica + push all'atleta dell'assegnazione, titolo «Registrato da Garmin», corpo «<titolo>: com'è andata?», rotta `/workout/<workout_id>?athlete_id=<athlete_id>&rpe=1`.

- [ ] **Step 1: test che falliscono** sui testi. **Step 2:** → FAIL. **Step 3:** implementare (badge con il meccanismo che `send-reminders` usa già per le altre push all'atleta). **Step 4:** → PASS, `deno check`.
- [ ] **Step 5: commit** · «Notifiche: completato da Garmin, e "com'è andata?" all'atleta».

---

### Task 7: collegamento — backfill e cambio di account

**Files:**
- Modify: `supabase/functions/garmin-auth/index.ts`, `supabase/functions/_shared/garmin.ts`

**Interfaces:**
- Produces: `chiediBackfillAttivita(access: string, daSec: number, aSec: number): Promise<void>` in `_shared/garmin.ts`, indirizzo dal Task 1. Chiamata a collegamento riuscito per gli **ultimi 30 giorni** (spec §2 punto 4), in try/catch: un backfill che fallisce non rompe il collegamento. Le attività del backfill arrivano al webhook e non completano niente (regola 2 del Task 3).
- Limite della Fase 0: se al callback la riga aveva **già** un `garmin_user_id` diverso e un token valido, si cancella prima la registrazione vecchia presso Garmin (stessa chiamata di `scollegaAtleta`, senza cancellare i dati).

- [ ] **Step 1:** implementare. **Step 2:** `deno check` (poi `git checkout -- deno.lock`), `npm test` verde.
- [ ] **Step 3: commit** · «Garmin: al collegamento si chiedono gli ultimi 30 giorni».

---

### Task 8: «Da Garmin» nella scheda workout

**Files:**
- Create: `src/lib/attivitaGarmin.js`, `src/components/CardDaGarmin.jsx`
- Modify: `src/pages/WorkoutDetail.jsx` (dove sta `RigaOrologio`; e `?rpe=1` che apre `apriRpe` una volta)
- Test: `src/lib/__tests__/attivitaGarminApp.test.js`

**Interfaces:**
- Consumes: `garmin_attivita` (lettura: atleta e suo coach); update di `athlete_workout_id`/`abbinamento` (policy «abbinamento» già applicata).
- Produces:
  - `righeDaGarmin(attivita): { etichetta: string, valore: string }[]` — durata `42′` o `1 h 05′`, distanza `8,2 km`, passo `5:07 /km` (solo per i tipi di corsa), FC media e max, dislivello `120 m`, calorie; un dato assente non compare (mai «0»).
  - `annullaAbbinamento(supabase, attivita)` → attività `athlete_workout_id: null, abbinamento: 'atleta'`; e il workout torna da fare **solo se** `abbinamento` era `'auto'`.
  - `abbinaA(supabase, attivita, athleteWorkoutId)` → attività abbinata con `abbinamento: 'atleta'` e workout completato.
- Card grigia «Da Garmin» (attribuzione: «Garmin» e dispositivo) sotto la riga dell'orologio, con «Non era questo allenamento». Il recap usa la durata vera al posto del `≈` dove l'attività c'è (leggere prima `docs/memoria/recap.md`).

- [ ] **Step 1: test che falliscono** su `righeDaGarmin` (ogni campo, assenti omessi, passo solo per corsa) e su `annullaAbbinamento` (auto → workout da fare; atleta → workout resta) con `fintoSupabase`.
- [ ] **Step 2:** → FAIL. **Step 3:** implementare; leggere prima `docs/memoria/scheda-workout.md`. **Step 4:** → PASS; `npm run build`, `WorkoutDetail` resta intorno agli 89 KB (componente a import pigro se supera i +3 KB).
- [ ] **Step 5: commit** · «Garmin: la card "Da Garmin" nella scheda».

---

### Task 9: le attività libere nel calendario e nella scheda atleta

**Files:**
- Modify: `src/pages/Calendar.jsx` (o il suo `CalendarioUI`), `src/components/CalendarioAtleta*` della scheda atleta, `src/lib/attivitaGarmin.js`
- Create: `src/components/FoglioAttivitaGarmin.jsx`
- Test: `src/lib/__tests__/attivitaGarminApp.test.js` (aggiunte)

**Interfaces:**
- Produces: `vociLibere(attivita, giorno): { id, testo }[]` — testo «Garmin · Corsa 42′» (nome del tipo in italiano da una tabella in `attivitaGarmin.js`), solo attività con `athlete_workout_id` nullo. `candidatiAbbina(assegnazioni, giorno)`: le assegnazioni non completate di quel giorno e dei due vicini.
- Voce grigia nel giorno; toccandola, il foglio con le righe del Task 8 e «Abbina a…» (lista dei candidati → `abbinaA`).

- [ ] **Step 1: test che falliscono** su `vociLibere` e `candidatiAbbina` (giorno prima, dopo, fuori finestra, completati esclusi). **Step 2:** → FAIL. **Step 3:** implementare (leggere `docs/memoria/calendario.md` e `scheda-atleta.md`). **Step 4:** → PASS, `npm test` verde, build: `index` resta intorno ai 594 KB.
- [ ] **Step 5: commit** · «Garmin: le attività libere nel calendario».

---

### Task 10: ambiente di prova, memoria, passi del committente

**Files:**
- Modify: `src/demoSemi.js` (o dove stanno i semi: `grep -rn "demoSemi" src | head`), `docs/memoria/garmin.md`, `CLAUDE.md` §11 (riga `garmin.md`: `attivitaGarmin.ts`, `abbinaGarmin.ts`, `attivitaGarmin.js`, `CardDaGarmin`, `FoglioAttivitaGarmin`)

- Semi: per un atleta finto, un'attività abbinata (corsa) e una libera, così `npm run demo:atleta` le mostra.
- `garmin.md`, sezione «Fase 1 · Attività»: cosa c'è e dove; la deviazione (regole in `_shared/abbinaGarmin.ts` e non in `src/lib/abbinaGarmin.js`, perché le funzioni non vedono `src/`; durata stimata nei `sections`); i limiti della Fase 0 chiusi (atleta eliminato, cambio di account); i passi del committente:
  1. nel portale Garmin, endpoint **Activity Summaries** (e gli aggiornamenti manuali, se ci sono) con lo stesso indirizzo del webhook col token nel percorso;
  2. deploy `garmin-webhook`, `garmin-auth`, `send-reminders` (⚠️ quest'ultima serve anche la web app);
  3. prova con l'atleta di prova: una Corsa assegnata per oggi, la si corre con l'orologio → workout completato, notifica al coach «· da Garmin», push all'atleta che apre l'RPE, card «Da Garmin»; poi «Non era questo allenamento» → torna da fare e non si riabbina al prossimo aggiornamento; un'attività in un giorno senza workout → voce grigia nel calendario, «Abbina a…».
- [ ] **Step 1:** scrivere. **Step 2:** `npm test` verde.
- [ ] **Step 3: commit** · «Garmin: memoria della Fase 1 (attività)».
