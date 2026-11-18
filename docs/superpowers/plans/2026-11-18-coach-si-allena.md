# Il coach si allena anche lui — piano

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use `- [ ]`.

**Goal:** il coach trova, fa e chiude i propri allenamenti dalla Home e collega il suo Garmin.

**Architecture:** nessuna migrazione: le policy ammettono già `auth.uid() = athlete_id`. Logica
pura in `src/lib/` (test vitest), UI sottile; due Edge Function perdono il rifiuto allo staff e
controllano invece che chi collega abbia una riga `athletes`.

**Tech Stack:** React 19, Vitest + jsdom, Supabase, Edge Function Deno (testate da vitest come
`garminServer.test.js`).

**Spec:** `docs/superpowers/specs/2026-11-18-coach-si-allena-design.md`

## Global Constraints
- Schema congelato: nessuna migrazione, nessuna policy.
- Rami dell'atleta invariati; avvisi «al coach» (completato, spostato, nota) solo con `role === 'athlete'`.
- Etichetta esatta: «Tu». Titolo card: «Il tuo allenamento» (oggi) / «Il tuo prossimo allenamento» (futuro).
- Solo test mirati (`npx vitest run <file>`), mai tutta la suite. Ogni test nuovo visto fallire.
- Deploy di `garmin-auth`/`garmin-training` solo dopo un sì del committente. Niente `npm run ios`.
- `git add` per nome, commit su `app`.

## Review Focus
1. Coach senza riga `athletes` (2 account): nessuna card, nessuna riga Garmin, 403 chiaro dal server.
2. Allenamento di oggi già completato e un altro domani: la card mostra quello di oggi con la spunta.
3. Due allenamenti oggi, uno fatto e uno no: mostra quello non fatto.
4. Admin in «Simula atleta»: Garmin resta nascosto come oggi; nessuna card coach (Home atleta).
5. Coach che completa il suo workout: nessuna `coach_notification` parte.

---

### Task 1: `scegliMioAllenamento`
**Files:** Create `src/lib/mioAllenamento.js`, Test `src/lib/__tests__/mioAllenamento.test.js`
**Produces:** `scegliMioAllenamento(righe, oggi: 'yyyy-MM-dd') -> { awId, workoutId, titolo, data, fatto, categoria, oggi: boolean } | null`.
`righe` = `athlete_workouts` con `id, completed_date, status, workouts(id, title, sections)`.

- [ ] Test: `[]`/`null` → `null`; riga di oggi `completed` + riga domani → quella di oggi, `fatto: true, oggi: true`;
  oggi una fatta e una no → la non fatta; nessuna oggi, futura non fatta → `oggi: false`; solo future
  completate → `null`; riga senza `workouts` ignorata; `categoria` = `sections.category` o `'Hyrox'`.
- [ ] Vederlo fallire; implementare; vederlo passare; commit.

### Task 2: card in Home coach
**Files:** Create `src/components/CartaMioAllenamento.jsx`; Modify `src/pages/Home.jsx`,
`src/components/HomeRiepilogoDesktop.jsx`, `src/components/HomeCoachDesktop.jsx`;
Test `src/pages/__tests__/` (nuovo `HomeMioAllenamento.test.jsx` con `montaPagina`/`fintoSupabase`).
**Consumes:** `scegliMioAllenamento`.
- `Home.jsx`: per `role !== 'athlete'`, una lettura `athlete_workouts …eq('athlete_id', user.id).gte('completed_date', oggi).order('completed_date').limit(20)` → `mioAllenamento`. Telefono: card in testa al contenitore `cascata` coach (prima dei banner Live). Desktop: prop `mio` (nodo) ai due corpi desktop, resa subito dopo `<header>`.
- Card: `CARD` di `stiliCard.js`, pallino del colore categoria, titolo (senza codice: `separaCodice`), data («Oggi» o `EEE d MMM`), spunta verde se `fatto`. Tocco → `/workout/<workoutId>?athlete_id=<user.id>`.
- [ ] Test: coach con un allenamento oggi → testo «Il tuo allenamento» e il titolo; tocco naviga all'URL giusto; nessuna riga → nessuna card. Vederlo fallire; implementare; passare; commit.

### Task 3: «Tu» in cima
**Files:** Modify `src/lib/rigaAtleta.js` (+ `src/lib/__tests__/rigaAtleta.test.js`), `src/pages/Athletes.jsx`,
`src/components/AtletiUI.jsx` (riga telefono), `src/components/AtletiDesktop.jsx`, `src/pages/WorkoutDetail.jsx` (foglio Assegna).
**Produces:** `primaIo(atleti, ioId) -> atleti` (chi guarda in testa, ordine degli altri invariato, input non mutato).
- Le righe ricevono `tu: boolean`; accanto al nome una pillola «Tu» (stile badge del §6, giallo brand).
- [ ] Test `primaIo` (in testa, ordine stabile, assente → identico, `ioId` nullo → identico). Fallire; implementare; passare; commit.

### Task 4: scheda workout propria
**Files:** Modify `src/pages/WorkoutDetail.jsx`.
- `useScarpaCompletamento`, `useSfidaCompletamento`, `mio` dell'effetto RPE da link: `role === 'athlete' && isOwnProfile` → `isOwnProfile`.
- Restano con `role === 'athlete'`: `coach_notification`, `avvisaCoachSpostamento`, la notifica della nota.
- [ ] Test in `WorkoutDetail` esistente (cercare il file che monta la pagina da coach): coach con `athlete_id = sé` che completa → nessuna invoke `send-reminders`. Fallire (se già verde, documentare che copre una regressione e romperlo apposta); commit.

### Task 5: Garmin per il coach
**Files:** Modify `src/lib/garmin.js` (+ test), `src/pages/Settings.jsx`, `supabase/functions/_shared/garminRegole.ts`
(+ `garminServer.test.js`), `supabase/functions/garmin-auth/index.ts`, `supabase/functions/garmin-training/index.ts`.
**Produces:** `puoCollegareGarmin({ role, simulando, haProfilo }) -> boolean` (atleta vero, oppure staff non in simulazione con profilo);
`haProfiloAtleta(client, id) -> Promise<boolean>` (riga `athletes` con `deleted_at` nullo).
- Settings: per lo staff legge `athletes.select('id').eq('id', user.id).is('deleted_at', null).maybeSingle()`; sostituisce `atletaVero` nelle tre condizioni Garmin con `puoCollegareGarmin(...)`. Il consenso privacy resta su `atletaVero`.
- Edge Function: `ruoloStaff` → `!(await haProfiloAtleta(admin, utente.id))` con 403 «Garmin si collega da un account con profilo atleta».
- [ ] Test delle due funzioni pure. Fallire; implementare; passare; commit. Deploy: chiedere.

### Task 6: memoria
- [ ] `docs/memoria/garmin.md`, `home-coach.md`, `atleti.md`: una sezione «Il coach si allena» (18/11/2026). Commit.
