# Il QR della TV dalla fotocamera: scegliere il workout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Il link `fleofit://tv/<codice>` letto dalla fotocamera di sistema apre una pagina che fa scegliere il workout (atleta: quello di oggi; admin/coach: un foglio corto) e poi la scheda si collega da sola alla TV.

**Architecture:** Logica pura della scelta in `src/lib/sceltaTV.js`; pagina privata `CollegaTV` su `/collega-tv/:codice` (lazy); `WorkoutDetail` si collega da solo con `?tv=<codice>`; `DeeplinkHandler` porta il link alla pagina con `rottaDaLinkTV`; l'archivio con `?tv=` diventa scelta.

**Tech Stack:** React 19, React Router 7, Vitest + jsdom (`src/test/fintoSupabase.js`, `montaPagina.jsx`), date-fns.

**Spec:** `docs/superpowers/specs/2026-11-02-tv-qr-scelta-workout-design.md`
**Per tornare indietro:** `docs/superpowers/plans/2026-11-02-tv-qr-scelta-workout-ritorno.md`

## Global Constraints

- Nessun commit durante il lavoro (salva il committente con «Salva e pubblica»); mai `git add -A`.
- 🔴 Altre sessioni hanno modifiche NON salvate in `src/App.jsx`, `src/pages/Login.jsx`, `src/components/LoginUI.jsx`, `src/index.css`: in `App.jsx` si toccano solo il ramo `eLinkDellaTV` di `DeeplinkHandler`, l'import lazy e la `<Route>`; mai annullare righe altrui.
- Nessuna modifica al database: solo letture di `workouts` e `athlete_workouts`.
- `CollegaTV` caricata con `lazy`; il chunk `index` non cresce oltre qualche centinaio di byte.
- La rotta è `/collega-tv/:codice`, mai `/tv` (pagina pubblica della TV).
- Fogli: `createPortal`, `sheet-in`/`velo-in`, `bg-[#1e1e1e] rounded-t-3xl`, maniglia, X con `aria-label="Chiudi"`; colori di categoria da `src/lib/colori.js`; aptica solo da `src/lib/aptica.js`.
- Titoli mostrati senza il codice in coda: `separaCodice` (`src/lib/codiceWorkout.js`).
- La settimana e le date: `yyyy-MM-dd` locale, come `workouts.date`.
- Testi esatti: «Vuoi aprire questo?», «Vuoi mandare in TV questo?», «Sì», «No, un altro», «Oggi non hai workout assegnati», «Cerca nell'archivio», «Scegli il workout da mandare in TV», «Codice TV non trovato o scaduto.», «Riprova».

## Review Focus

- `?tv=` letto due volte (StrictMode, ri-render dopo il caricamento): una sola `collegaTV` — test in Task 2.
- Codice scaduto dal link: foglio aperto con il messaggio, nessun alert, nessun timer — test in Task 2.
- Atleta con eventi (`category: 'Event'`) oggi: non contano come workout di oggi — test in Task 1.
- Link senza codice (`fleofit://tv`, `fleofit://tv/12`): nessuna navigazione — test in Task 4.
- «No, un altro» dopo la proposta: mostra la lista e non ripropone lo stesso workout come unica scelta — test in Task 1 (`forzaLista`) e Task 3.

---

### Task 1: `sceltaTV`

**Files:**
- Create: `src/lib/sceltaTV.js`, `src/lib/__tests__/sceltaTV.test.js`

**Interfaces:**
- Produces: `sceltaTV({ ruolo: 'athlete'|'coach'|'admin', oggi: 'yyyy-MM-dd', workouts: Array<{ id, title, date, sections }>, aperto?: { id, title, date, sections } | null, forzaLista?: boolean }) => { tipo: 'conferma', workout } | { tipo: 'lista', oggi: W[], recenti: W[] } | { tipo: 'vuoto', recenti: W[] }`. `recenti` = date nei 7 giorni prima di `oggi` (esclusa oggi), dalla più recente, al massimo 20. Gli eventi (`sections.category === 'Event'`) sono sempre esclusi.

- [ ] **Step 1: Test** — `aperto` presente e `forzaLista` falso → `conferma` con `aperto` (per ogni ruolo); atleta con un solo workout oggi → `conferma`; con due → `lista` (`oggi` ha 2); con zero oggi e due ieri → `vuoto` con 2 recenti; un Event oggi + un workout oggi → `conferma` con il workout; admin con un solo workout oggi → `lista` (mai `conferma` senza `aperto`); `forzaLista: true` con un solo workout oggi → `lista`; workout di 8 giorni fa escluso; 25 recenti → 20, il primo è il più recente; workout futuri esclusi.
- [ ] **Step 2:** `npx vitest run src/lib/__tests__/sceltaTV.test.js` → FAIL (modulo mancante).
- [ ] **Step 3:** implementa con `date-fns` (`subDays`, `format`), confronto di stringhe `yyyy-MM-dd`.
- [ ] **Step 4:** test → PASS; rompi apposta l'esclusione degli eventi e verifica che il test fallisca.

### Task 2: `WorkoutDetail` si collega da solo con `?tv=`

**Files:**
- Modify: `src/pages/WorkoutDetail.jsx` (dove c'è `collegaTV` e lo stato del foglio TV), `src/components/FoglioCollegaTV.jsx` (prop `erroreIniziale`)
- Test: `src/pages/__tests__/WorkoutDetailTV.test.jsx` (aggiungere i casi)

**Interfaces:**
- Consumes: `collegaTV(codice) => Promise<{ ok: true } | { errore: string }>` (già in `WorkoutDetail`); `FoglioCollegaTV`.
- Produces: `/workout/:id?tv=<4 cifre>` (con o senza `athlete_id`) collega da solo; `<FoglioCollegaTV erroreIniziale={string|null} … />` apre sul campo del codice con il messaggio sotto.

- [ ] **Step 1: Test** — montata con `?tv=4321` (sessione esistente nel finto `tv_sessions`): `tv_sessions` aggiornata con il `workout_id`, `tv` sparito da `location.search`, timer aperto per un Hyrox, nessun «Connesso!»; con `?tv=9999`: foglio visibile con «Codice TV non trovato o scaduto.», timer chiuso; con `?tv=4321` su un Running: collegato, nessun timer; `?tv=12a` ignorato (nessuna chiamata a `tv_sessions`); una sola chiamata di update anche con il componente montato in `StrictMode`.
- [ ] **Step 2:** test → FAIL.
- [ ] **Step 3:** effetto che parte quando il workout è caricato: guardia con un `useRef` (codice già tentato), `setSearchParams` togliendo solo `tv` (`replace: true`), poi stesso esito di `onCollega` del foglio (timer solo se `timerDisponibile`; il resto invariato). In caso di errore `setTvModalOpen(true)` con `erroreIniziale`. In `FoglioCollegaTV` con `erroreIniziale` lo stato iniziale è `'codice'` e `errore` è quel testo.
- [ ] **Step 4:** test → PASS; togli la guardia e verifica che il test StrictMode fallisca. `npx eslint` sui due file: nessun problema nuovo (oggi `WorkoutDetail.jsx` 4).

### Task 3: pagina `CollegaTV` e archivio in modalità scelta

**Files:**
- Create: `src/pages/CollegaTV.jsx`, `src/pages/__tests__/CollegaTV.test.jsx`, `src/pages/__tests__/ArchivioTV.test.jsx`
- Modify: `src/App.jsx` (solo `const CollegaTV = lazy(() => import('./pages/CollegaTV'))` e `<Route path="/collega-tv/:codice" element={<CollegaTV />} />` accanto a `/archive`, dentro il `ProtectedRoute`), `src/pages/WorkoutsArchive.jsx` (+ `src/components/ArchivioUI.jsx` se la striscia va lì)

**Interfaces:**
- Consumes: `sceltaTV` (Task 1); `codiceDaQR` / validazione 4 cifre (`src/lib/codiceTV.js`); `useAuth()` → `{ role, user }` da `src/App`.
- Produces: `/collega-tv/:codice?aperto=<id>&athlete_id=<uid>`; `/archive?tv=<codice>`. Destinazione della scelta: coach/admin `/workout/<id>?tv=<c>`, atleta `/workout/<id>?athlete_id=<user.id>&tv=<c>`, `aperto` mantiene il suo `athlete_id`.

- [ ] **Step 1: Test `CollegaTV`** — atleta con un workout oggi: «Vuoi aprire questo?» e il titolo senza codice; «Sì» → `/workout/<id>?athlete_id=<uid>&tv=1234`; «No, un altro» → lista; atleta senza workout oggi: «Oggi non hai workout assegnati» e i recenti; admin: righe di oggi e recenti, «Cerca nell'archivio» → `/archive?tv=1234`, tocco su una riga → `/workout/<id>?tv=1234`; `?aperto=w1`: «Vuoi mandare in TV questo?»; codice non valido (`/collega-tv/12`) → torna alla Home; X «Chiudi» → Home; errore di lettura → messaggio e «Riprova».
- [ ] **Step 2: Test archivio** — `/archive?tv=1234`: «Scegli il workout da mandare in TV» visibile; tocco su un workout → `/workout/<id>?tv=1234` (atleta: con `athlete_id`); la X della striscia toglie `tv`; senza `?tv=` nessuna striscia e navigazione invariata.
- [ ] **Step 3:** test → FAIL.
- [ ] **Step 4:** `CollegaTV`: letture come la Home (atleta: `athlete_workouts` con `workouts(*)` del proprio id; staff: `workouts` con `date` fra oggi−7 e oggi, ordinati per `date` decrescente) e come la scheda per `aperto`; foglio nello stile dei Global Constraints; righe con colore di categoria e data breve (`d MMM`, locale `it`). Archivio: legge `tv` con `useSearchParams` e cambia solo la destinazione di `onApri` e la striscia.
- [ ] **Step 5:** test → PASS; rompi la destinazione (senza `tv`) e verifica che fallisca. `npm run build`: chunk `CollegaTV-*.js` presente, `index` ≈ invariato (riportare i KB prima/dopo).

### Task 4: il link porta alla pagina

**Files:**
- Modify: `src/lib/linkTimer.js` (accanto a `eLinkDellaTV`), `src/App.jsx` (solo il ramo `if (eLinkDellaTV(event.url))` in `DeeplinkHandler`), `src/lib/__tests__/linkTimer.test.js`

**Interfaces:**
- Consumes: `codiceDaQR` — ⚠️ `linkTimer.js` sta nel chunk `index`: se importare `codiceTV.js` lo sposta lì, va bene (è minuscolo e senza import), ma si verifica col build.
- Produces: `rottaDaLinkTV(indirizzo: string, { pathname: string, search: string }) => string | null`.

- [ ] **Step 1: Test** — `('fleofit://tv/1234', { pathname: '/', search: '' })` → `'/collega-tv/1234'`; da `/workout/w1` con `?athlete_id=u1` → `'/collega-tv/1234?aperto=w1&athlete_id=u1'`; da `/workout/w1` senza query → `'/collega-tv/1234?aperto=w1'`; da `/collega-tv/5555` → `'/collega-tv/1234'`; `'fleofit://tv'`, `'fleofit://tv/12'`, `'fleofit://tv/abcd'`, `'fleofit://timer'` → `null`.
- [ ] **Step 2:** test → FAIL.
- [ ] **Step 3:** in `DeeplinkHandler` il ramo diventa: se `eLinkDellaTV` → calcola la rotta con la posizione corrente (leggere la posizione con un `ref` aggiornato come `vaiA`, perché il listener è registrato una volta sola) e, se non è `null`, `vaiA.current(rotta)`; in ogni caso `return`.
- [ ] **Step 4:** test → PASS. `npm test` completo una volta. `npx eslint src/App.jsx src/lib/linkTimer.js`: nessun problema nuovo.

### Task 5: memoria e controlli

**Files:**
- Modify: `docs/memoria/scheda-workout.md` (sezione `9-tv-qr`: la parte del link dalla fotocamera di sistema, la pagina, `?tv=`, cosa provare sul telefono), `CLAUDE.md` §11 riga di `scheda-workout.md` (+ `sceltaTV.js`, `CollegaTV`), §8 rotte (`/collega-tv/:codice`), `BACKLOG.md` (sezione «TV con il QR — da provare»: i tre casi del telefono).

- [ ] **Step 1:** `npm test` → verdi; `npm run build` → ok; `index` riportato.
- [ ] **Step 2:** ambiente di prova: `/collega-tv/1234` con `npm run demo` (coach) e `npm run demo:atleta` — lo fa il controller.
- [ ] **Step 3:** memoria scritta; nessun commit.
