# Promemoria notifiche — piano di lavoro

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** a chi usa l'app iPhone/Android senza notifiche, un foglio dal basso che le propone nel momento giusto (atleta: Home con un workout assegnato; coach: subito dopo aver assegnato), con pause crescenti.

**Architecture:** la cadenza è logica pura in `src/lib/promemoriaNotifiche.js`, stato su `localStorage`. Il permesso nativo sta in `src/lib/permessoNotifiche.js`, che riusa `rinfrescaTokenPush` (salva il token) e `apriImpostazioni` di `lettoreQR.js`. Un solo componente `InvitoNotifiche`, montato una volta in `ProtectedRoute`, ascolta l'evento `pushfit:momento-notifiche` che Home e i punti di assegnazione lanciano con `segnalaMomentoNotifiche(ruolo)`.

**Tech Stack:** React 19, Capacitor 8 (`@capacitor/push-notifications`, `@capacitor/app`), Vitest + jsdom.

**Spec:** `docs/superpowers/specs/2026-11-19-promemoria-notifiche-design.md`

## Global Constraints
- Solo app nativa: con `Capacitor.isNativePlatform() === false` non compare mai niente.
- Nessuna scrittura nel database oltre a quella che `rinfrescaTokenPush` fa già (schema congelato).
- Chiave del dispositivo: `pushfit_promemoria_notifiche`, solo con `leggiJson`/`scriviJson` di `src/lib/offlineQueue.js`.
- Pause dopo ogni «Non ora»: `[3, 7, 14, 30, 60]` giorni; al sesto «Non ora» non si chiede più.
- «Non chiedermelo più» compare dalla seconda volta (cioè con almeno un «Non ora» alle spalle).
- Al massimo una volta per apertura dell'app.
- Ogni chiamata a un plugin con `.catch`; mai far fallire la pagina per il permesso.
- Testi (proposta, confermabile dal committente):
  - atleta — titolo «Non perderti un allenamento», testo «Ti avviso quando il coach ti carica un allenamento, e la sera prima se domani ne hai uno.»
  - coach — titolo «Sappi quando si allenano», testo «Ti avviso quando un atleta completa un allenamento o ti lascia una nota.»
  - con permesso negato, il bottone dice «Apri Impostazioni» invece di «Attiva», e sotto: «Le notifiche sono spente nelle impostazioni del telefono.»
- La X del foglio ha `aria-label="Chiudi"` e vale come «Non ora» (tasto indietro Android, `indietroAndroid.js`).

## Review Focus
- Il permesso viene concesso fuori dall'app (Impostazioni del telefono) mentre lo stato dice 6 rifiuti: al ritorno, se le notifiche sono attive, lo stato si azzera e il foglio non compare più → test in Task 3.
- Data dell'ultimo rifiuto nel futuro (orologio del telefono spostato): `deveChiedere` non deve bloccarsi per sempre né chiedere ogni giorno; trattare giorni negativi come 0 (non chiedere) finché non passa la pausa dalla data vera → test in Task 1.
- `localStorage` con un valore rotto (stringa, numero, `rifiuti` non numerico): si riparte dallo stato iniziale → test in Task 1.
- Due eventi ravvicinati (assegnazione multipla, Home che si rimonta): un solo foglio → test in Task 3.
- Plugin assente (app vecchia senza `LettoreQR`): «Apri Impostazioni» non lancia errori → test in Task 2.

---

### Task 1: la cadenza

**Files:**
- Create: `src/lib/promemoriaNotifiche.js`
- Test: `src/lib/__tests__/promemoriaNotifiche.test.js`

**Interfaces:**
- Produces:
  - `CHIAVE_PROMEMORIA_NOTIFICHE = 'pushfit_promemoria_notifiche'`
  - `PAUSE_GIORNI = [3, 7, 14, 30, 60]`
  - `STATO_INIZIALE = { rifiuti: 0, ultimo: null, mai: false }` (`ultimo` = `'yyyy-MM-dd'`)
  - `normalizza(valore) -> Stato` (valori rotti → `STATO_INIZIALE`)
  - `deveChiedere(stato, oggi: Date) -> boolean`
  - `mostraMai(stato) -> boolean` (`rifiuti >= 1`)
  - `dopoNonOra(stato, oggi: Date) -> Stato` (`rifiuti + 1`, `ultimo = oggi`)
  - `dopoMai(stato) -> Stato` (`mai: true`)
  - `leggiStato(storage?) -> Stato`, `scriviStato(stato, storage?)`, `azzera(storage?)`

- [ ] **Step 1: test che falliscono** — casi:
  - `deveChiedere(STATO_INIZIALE, oggi)` → `true`
  - `{rifiuti:1, ultimo:'2026-11-19'}`: il 21/11 `false`, il 22/11 `true`
  - `{rifiuti:5, ultimo:'2026-01-01'}`: dopo 59 giorni `false`, dopo 60 `true`
  - `{rifiuti:6, …}` → `false` sempre; `{mai:true}` → `false` sempre
  - `ultimo` nel futuro (`'2026-12-31'`, oggi 19/11) → `false`
  - `normalizza('x')`, `normalizza({rifiuti:'a'})`, `normalizza(null)` → `STATO_INIZIALE`
  - `mostraMai(STATO_INIZIALE)` `false`, `mostraMai({rifiuti:1,…})` `true`
  - `leggiStato` su storage con JSON rotto → `STATO_INIZIALE`; `scriviStato` + `leggiStato` andata e ritorno
- [ ] **Step 2:** `npx vitest run src/lib/__tests__/promemoriaNotifiche.test.js` → FAIL (modulo mancante)
- [ ] **Step 3:** implementare. I giorni con `differenceInCalendarDays` di date-fns; `ultimo` letto con `parseISO`.
- [ ] **Step 4:** stesso comando → PASS. Rompere apposta la soglia (`>` invece di `>=`) e vedere fallire il caso del 22/11, poi ripristinare.
- [ ] **Step 5:** commit `Promemoria notifiche: la cadenza` (file per nome).

### Task 2: il permesso e l'evento

**Files:**
- Create: `src/lib/permessoNotifiche.js`
- Test: `src/lib/__tests__/permessoNotifiche.test.js`

**Interfaces:**
- Consumes: `rinfrescaTokenPush(userId)` di `src/lib/pushToken.js`; `apriImpostazioni()` di `src/lib/lettoreQR.js`.
- Produces:
  - `statoPermesso() -> Promise<'attive' | 'da-chiedere' | 'negate' | 'non-disponibile'>` — non nativo → `'non-disponibile'`; `receive` `'granted'` → `'attive'`; `'prompt'` o `'prompt-with-rationale'` → `'da-chiedere'`; `'denied'` → `'negate'`; errore → `'non-disponibile'`.
  - `chiediPermesso(userId) -> Promise<boolean>` — `requestPermissions()`; se `granted` chiama `rinfrescaTokenPush(userId)` e torna `true`.
  - `apriImpostazioniTelefono() -> Promise<void>` — `apriImpostazioni()` con `.catch`.
  - `EVENTO_MOMENTO = 'pushfit:momento-notifiche'`
  - `segnalaMomentoNotifiche(ruolo: 'athlete' | 'coach')` — `window.dispatchEvent(new CustomEvent(EVENTO_MOMENTO, { detail: { ruolo } }))`. Admin = `'coach'` (lo decide chi chiama).

- [ ] **Step 1: test che falliscono** (con `vi.mock` di `@capacitor/core`, `@capacitor/push-notifications`, `../pushToken`, `../lettoreQR`):
  - le quattro risposte di `statoPermesso` sopra, più `checkPermissions` che rifiuta → `'non-disponibile'`
  - `chiediPermesso('u1')` con `granted` → `true` e `rinfrescaTokenPush` chiamato con `'u1'`; con `denied` → `false`, non chiamato
  - `apriImpostazioniTelefono()` con `apriImpostazioni` che rifiuta → risolve senza errore
  - `segnalaMomentoNotifiche('coach')` → un ascoltatore su `window` riceve `detail.ruolo === 'coach'`
- [ ] **Step 2:** `npx vitest run src/lib/__tests__/permessoNotifiche.test.js` → FAIL
- [ ] **Step 3:** implementare.
- [ ] **Step 4:** → PASS; rompere apposta la mappa `'denied'` e vederla fallire.
- [ ] **Step 5:** commit `Promemoria notifiche: permesso ed evento`.

### Task 3: il foglio e chi lo apre

**Files:**
- Create: `src/components/FoglioNotifiche.jsx`, `src/components/InvitoNotifiche.jsx`
- Modify: `src/App.jsx` (in `ProtectedRoute`, accanto a `{apertura}`: `<InvitoNotifiche />`)
- Test: `src/components/__tests__/InvitoNotifiche.test.jsx`

**Interfaces:**
- Consumes: Task 1 (tutto), Task 2 (tutto), `useAuth()` di `App.jsx` per `user.id`.
- Produces:
  - `FoglioNotifiche({ ruolo, negate, mostraMai, onAttiva, onNonOra, onMai })` — foglio dal basso come `FoglioComeStai` (portale, `.sheet-in`, maniglia, X `aria-label="Chiudi"` → `onNonOra`), testi dei Global Constraints, bottone «Non chiedermelo più» solo con `mostraMai`.
  - `InvitoNotifiche()` — ascolta `EVENTO_MOMENTO`; esporta anche `_azzeraApertura()` per i test (il flag «già chiesto in questa apertura» è una variabile di modulo).

Comportamento di `InvitoNotifiche` all'evento: se già mostrato in questa apertura → niente. Altrimenti `statoPermesso()`: `'attive'` → `azzera()` e niente; `'non-disponibile'` → niente; altrimenti se `deveChiedere(leggiStato(), new Date())` → apre il foglio e segna l'apertura.
- «Attiva» (`da-chiedere`) → `chiediPermesso(user.id)`; chiude. Se `true` → `azzera()`; se `false` → `dopoNonOra`.
- «Apri Impostazioni» (`negate`) → `apriImpostazioniTelefono()`, chiude, e al primo `App.addListener('appStateChange')` con `isActive` ricontrolla: `'attive'` → `rinfrescaTokenPush(user.id)` + `azzera()`; altrimenti `dopoNonOra`. Ascoltatore tolto subito dopo.
- «Non ora» / X → `dopoNonOra`; «Non chiedermelo più» → `dopoMai`.

- [ ] **Step 1: test che falliscono** (mock di `../../lib/permessoNotifiche` tranne `EVENTO_MOMENTO`/`segnalaMomentoNotifiche`, e di `@capacitor/app`):
  - evento `athlete` con `'da-chiedere'` e stato iniziale → compare «Non perderti un allenamento», niente «Non chiedermelo più»
  - evento `coach` → compare «Sappi quando si allenano»
  - `'attive'` → nessun foglio e la chiave in `localStorage` torna allo stato iniziale (anche partendo da `{rifiuti:6}`)
  - due eventi di fila → un solo dialog; e dopo «Non ora» un terzo evento nella stessa apertura non lo riapre
  - «Non ora» → stato salvato con `rifiuti: 1` e `ultimo` di oggi
  - `{rifiuti:1, ultimo: 5 giorni fa}` → compare con «Non chiedermelo più»; toccarlo salva `mai: true`
  - `'negate'` → il bottone dice «Apri Impostazioni»; toccarlo chiama `apriImpostazioniTelefono`; simulare `appStateChange {isActive:true}` con `statoPermesso` ora `'attive'` → stato azzerato
  - la X «Chiudi» si comporta come «Non ora»
- [ ] **Step 2:** `npx vitest run src/components/__tests__/InvitoNotifiche.test.jsx` → FAIL
- [ ] **Step 3:** implementare i due componenti e montare `InvitoNotifiche` in `ProtectedRoute`.
- [ ] **Step 4:** → PASS; rompere apposta il flag di apertura e vedere fallire «due eventi di fila».
- [ ] **Step 5:** commit `Promemoria notifiche: il foglio`.

### Task 4: i momenti

**Files:**
- Modify: `src/pages/Home.jsx` (ramo atleta), `src/pages/CreateWorkout.jsx`, `src/pages/WorkoutDetail.jsx`, `src/pages/AthleteDetail.jsx`, `src/pages/CalendarioTeam.jsx`
- Test: `src/lib/__tests__/momentiNotifiche.test.js` (statico, come gli altri test che leggono i sorgenti) **oppure** un caso in un test di pagina esistente; scegliere il più vicino a ciò che fanno già i test di quella pagina.

**Interfaces:**
- Consumes: `segnalaMomentoNotifiche(ruolo)` (Task 2).

- [ ] **Step 1:** test che falliscono: per l'atleta, la Home con almeno un workout assegnato non completato lancia `EVENTO_MOMENTO` con `ruolo 'athlete'`, con zero workout no; per il coach, dopo un `insert` riuscito su `athlete_workouts` in ognuno dei quattro punti si lancia con `'coach'`, dopo un errore no.
- [ ] **Step 2:** → FAIL
- [ ] **Step 3:** aggiungere le chiamate:
  - `Home.jsx`: un `useEffect` nel ramo atleta, quando i workout sono caricati e almeno uno è assegnato e non completato.
  - le assegnazioni del coach: subito dopo l'`insert` riuscito in `CreateWorkout` (assegnazione al salvataggio), `WorkoutDetail` e `AthleteDetail` («Assegna workout»), `CalendarioTeam`. **Non** in `NuovoEvento`, `risultatoGara`, nell'allenamento libero di Home/AthleteDetail (non sono assegnazioni) né nel ripristino di Settings.
- [ ] **Step 4:** → PASS; poi `npm test` intero → tutto verde (oggi oltre 3070 test).
- [ ] **Step 5:** commit `Promemoria notifiche: quando compare`.

### Task 5: memoria e controllo finale

**Files:**
- Modify: `CLAUDE.md` (§8, la chiave `pushfit_promemoria_notifiche`), `docs/memoria/impostazioni.md` (una sezione «Promemoria notifiche»: cadenza, momenti, perché solo app, perché niente database), `BACKLOG.md` (voce: prova sul telefono del committente, iOS e Android, con permesso mai chiesto e con permesso negato).

- [ ] **Step 1:** scrivere le tre note.
- [ ] **Step 2:** `npm run build` → nessun errore; peso di `index` annotato (deve restare sotto il limite di 620 KB; se sale di più di 2–3 KB, valutare `lazy` per `FoglioNotifiche`).
- [ ] **Step 3:** `npx eslint src/lib/promemoriaNotifiche.js src/lib/permessoNotifiche.js src/components/FoglioNotifiche.jsx src/components/InvitoNotifiche.jsx` → pulito.
- [ ] **Step 4:** commit `Promemoria notifiche: memoria`.
