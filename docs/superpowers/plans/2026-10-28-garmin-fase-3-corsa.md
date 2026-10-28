# Garmin Fase 3 · Corsa all'orologio — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** un workout di **Corsa** assegnato a un atleta collegato a Garmin finisce da solo nel calendario del suo orologio, e ne segue le modifiche (contenuto, data, cancellazione). Hyrox e Gym restano fuori: arrivano in un piano successivo, sulla stessa base.

**Architecture:** i due trigger già creati (e spenti) su `athlete_workouts` e `workouts` chiamano una Edge Function nuova, `garmin-training`. La funzione legge l'assegnazione, decide con una regola pura cosa fare (`decidiInvio`), traduce la Corsa nel formato Training API (`corsaVersoGarmin`) e chiama Garmin. Lo stato di ogni invio sta in `garmin_invii`, con una **firma** del workout tradotto per capire se è cambiato davvero. L'atleta ha l'interruttore «Manda i workout all'orologio»; atleta e coach vedono nella scheda «Sull'orologio · 28 ott» o «Non inviato · Riprova».

**Tech Stack:** Supabase Edge Function (Deno, TypeScript), regole pure in `supabase/functions/_shared/*.ts` provate da Vitest, React 19 per le due righe d'interfaccia.

**Spec:** `docs/superpowers/specs/2026-10-27-garmin-design.md` §5 (Fase 3), §7 (dati), §9 (errori). Fase 0 già attiva: `docs/memoria/garmin.md`.

## Global Constraints

- 🔒 Schema congelato (CLAUDE.md §0-bis): il file SQL della Task 5 **si scrive e non si applica**. Lo applica il committente dopo un **sì esplicito** su quel file.
- Claude **non esegue comandi `supabase`** sul progetto remoto: deploy e SQL li fa il committente.
- Solo la Corsa (`sections.category === 'Running'`, passi in `sections.steps`). Hyrox, Gym, Custom ed Event **non si mandano**.
- Si manda solo da **oggi in avanti** (`completed_date >= oggi`, giorno italiano `Europe/Rome`) e solo se l'assegnazione **non è completata**.
- Si manda solo se il collegamento è `attivo`, `invia_workout` è vero e fra i permessi c'è `WORKOUT_IMPORT`.
- Le ripetute si leggono **solo** con `partiRipetuta` (Task 1 ne fa la copia lato server).
- Il giorno in calendario di un'assegnazione è `athlete_workouts.completed_date`.
- Il nome sull'orologio è `workouts.title` così com'è (porta già il codice in coda). `workoutProvider` e `workoutSourceId` = `'FLEOFIT'`.
- 🔒 Nessun token, nessun corpo di risposta di Garmin e nessun contenuto del workout nei log: solo id, status HTTP e azione decisa.
- Ogni URL e unità della Training API non documentata nel portale porta il commento `// ⚠️ DA VERIFICARE alla prima prova (28/10/2026)`.
- Interfaccia e commenti in italiano; colori solo dai token (CLAUDE.md §6); modali con `createPortal`; aptica solo da `src/lib/aptica.js`.

## Review Focus

1. **Due avvisi ravvicinati** (il coach assegna, poi l'atleta sposta subito il giorno): due esecuzioni in parallelo non devono creare due workout su Garmin. Mitigazione: prima di creare, la funzione scrive la riga `garmin_invii` con `stato: 'da_rifare'` usando `insert … on conflict do nothing`, e chi la trova «in corso» non fa niente (regola 5-bis della Task 3, test lì; prova vera nella Task 8). Chi arriva secondo con un cambio vero lo perde: resta la «Riprova», limite accettato.
2. **L'atleta segna «fatto»**: l'UPDATE di `status` non deve rimandare né cancellare niente (test in Task 3: `completata → niente` anche con invio esistente).
3. **Il coach cambia la categoria da Corsa a Hyrox**: il workout vecchio va tolto dall'orologio (test in Task 3: `non_corsa + invio futuro → cancella`).
4. **Una durata che non si legge** (`""`, `"q.b."`): il passo diventa «fino al tasto giro» (`OPEN`), non un errore e non un passo da 0 secondi (test in Task 2).
5. **Garmin risponde 404/400 al primo invio vero**: l'invio resta `errore` con lo status nel campo `errore`, la scheda mostra «Non inviato · Riprova», e l'URL da correggere è uno solo (`GARMIN_TRAINING` in Task 3).

---

### Task 1: le ripetute lato server

**Files:**
- Create: `supabase/functions/_shared/ripetute.ts`
- Test: `src/lib/__tests__/ripetuteServer.test.js`

**Interfaces:**
- Produces: `partiRipetuta(step: unknown): Parte[]` con `Parte = { id, tipo: 'run'|'recover', duration, pace, paceMin, paceMax, intensity }` (stringhe), identica a `src/lib/ripetute.js`.

Ruling (registrato qui): le Edge Function non importano da `src/` (il deploy non lo garantisce). Si fa una **copia** di `partiRipetuta`, tenuta allineata da un test di parità, come per i colori (CLAUDE.md §6).

- [ ] **Step 1: test di parità che fallisce**

```js
import { partiRipetuta as app } from '../ripetute'
import { partiRipetuta as server } from '../../../supabase/functions/_shared/ripetute.ts'
const senzaId = (ps) => ps.map(({ id: _id, ...p }) => p)
const CASI = [
  { parti: [{ tipo: 'run', duration: '4 min', pace: 'Z3', paceMin: 'Z3', paceMax: '-', intensity: '7' },
            { tipo: 'recover', duration: '3 min', pace: 'Z2', paceMin: 'Z2', paceMax: '-' },
            { tipo: 'run', duration: '400m', pace: '4:00 /km', paceMin: '4:00 /km', paceMax: '-' }] },
  { runDuration: '400m', runPace: '3:45 - 4:00 /km', runPaceMin: '3:45 /km', runPaceMax: '4:00 /km', recDuration: '1 min', recPace: 'Camminata' },
  { runDuration: '400m', recDuration: '' },          // recupero senza durata: non è una parte
  { parti: [] , runDuration: '1 km' },               // parti vuote: formato vecchio
  null, {}, { parti: [null, 3, { tipo: 'x' }] },
]
it.each(CASI)('server e app leggono uguale %#', (c) => {
  expect(senzaId(server(c))).toEqual(senzaId(app(c)))
})
```

- [ ] **Step 2:** `npx vitest run src/lib/__tests__/ripetuteServer.test.js` → FAIL (modulo mancante).
- [ ] **Step 3:** scrivere `_shared/ripetute.ts` copiando `partiRipetuta` e `parte` da `src/lib/ripetute.js`, tipizzati, con in testa il commento che è una copia e che il test di parità la tiene allineata. Nient'altro dal file originale.
- [ ] **Step 4:** stesso comando → PASS. Verificare che fallisca cambiando apposta `'recover'` in `'rec'` nella copia, poi rimettere.
- [ ] **Step 5: commit** — `git add supabase/functions/_shared/ripetute.ts src/lib/__tests__/ripetuteServer.test.js` · «Garmin: le ripetute lette anche lato server».

---

### Task 2: la Corsa nel formato Garmin

**Files:**
- Create: `supabase/functions/_shared/workoutGarmin.ts`
- Test: `src/lib/__tests__/workoutGarmin.test.js`

**Interfaces:**
- Consumes: `partiRipetuta` (Task 1).
- Produces:
  - `durataGarmin(testo: string): { durationType: 'TIME'|'DISTANCE'|'OPEN', durationValue?: number, durationValueType?: 'METER' }`
  - `obiettivoGarmin(paceMin: string, paceMax: string): { targetType: 'PACE'|'HEART_RATE'|'OPEN', targetValue?: number, targetValueLow?: number, targetValueHigh?: number, testo: string }`
  - `corsaVersoGarmin(w: { title: string, sections: unknown }): GarminWorkout | null` — `null` se non è Corsa o non ha passi traducibili.

Regole (spec §5, valori esatti):
- Tipo → `intensity`: `warmup`→`WARMUP`, `run`→`ACTIVE`, `recover`→`RECOVERY`, `cooldown`→`COOLDOWN`. Parti di una ripetuta: `run`→`INTERVAL`, `recover`→`RECOVERY`.
- `repeat` → `{ type: 'WorkoutRepeatStep', repeatType: 'REPEAT_UNTIL_STEPS_CMPLT', repeatValue: <rounds, minimo 1>, skipLastRestStep: false, steps: [...] }` con **tutte** le parti.
- Ogni passo semplice: `{ type: 'WorkoutStep', stepOrder, intensity, description, ...durata, ...obiettivo senza testo }`. `stepOrder` cresce da 1 su **tutto** il workout, figli delle ripetute compresi, nell'ordine in cui compaiono.
- Durata: `"30 sec"`→TIME 30 · `"10 min"`→TIME 600 · `"12:30"`→TIME 750 · `"400m"`→DISTANCE 400 METER · `"5 km"`, `"1.5 km"`, `"1,5 km"`→DISTANCE 5000 / 1500 METER · altro o vuoto→`{ durationType: 'OPEN' }`.
- Obiettivo: due ritmi `m:ss /km` → `PACE` con `targetValueLow` = velocità del più lento e `targetValueHigh` = velocità del più veloce, in **m/s** arrotondati a 3 decimali (5:30 /km → 3.030, 5:00 /km → 3.333). Un ritmo solo (`paceMax` `'-'` o vuoto) → la stessa cosa con ±5 s/km. `Z1`–`Z5` → `HEART_RATE` con `targetValue` = numero della zona. `Libero`, `Gara`, `All out`, `Camminata`, `Da fermo` e ogni altro testo → `OPEN`. `testo` è sempre l'etichetta leggibile («5:00–5:30 /km», «Z3», «Gara»).
- `description` del passo: `testo` dell'obiettivo, più ` · ` e le `notes` del passo se ci sono, tagliata a **100** caratteri.
- Workout: `{ workoutName: title tagliato a 100, sport: 'RUNNING', workoutProvider: 'FLEOFIT', workoutSourceId: 'FLEOFIT', steps }`.
- ⚠️ DA VERIFICARE alla prima prova: unità m/s per `PACE`, zona come `targetValue` per `HEART_RATE`, limite di 100 caratteri.

- [ ] **Step 1: test che falliscono** (un `describe` per funzione), almeno:

```js
expect(durataGarmin('10 min')).toEqual({ durationType: 'TIME', durationValue: 600 })
expect(durataGarmin('30 sec')).toEqual({ durationType: 'TIME', durationValue: 30 })
expect(durataGarmin('400m')).toEqual({ durationType: 'DISTANCE', durationValue: 400, durationValueType: 'METER' })
expect(durataGarmin('1,5 km')).toEqual({ durationType: 'DISTANCE', durationValue: 1500, durationValueType: 'METER' })
expect(durataGarmin('')).toEqual({ durationType: 'OPEN' })
expect(durataGarmin('q.b.')).toEqual({ durationType: 'OPEN' })

expect(obiettivoGarmin('5:00 /km', '5:30 /km')).toMatchObject({ targetType: 'PACE', targetValueLow: 3.03, targetValueHigh: 3.333 })
expect(obiettivoGarmin('Z3', '-')).toMatchObject({ targetType: 'HEART_RATE', targetValue: 3, testo: 'Z3' })
expect(obiettivoGarmin('Gara', '-')).toMatchObject({ targetType: 'OPEN', testo: 'Gara' })

const w = corsaVersoGarmin({ title: 'Ripetute · AB12', sections: { category: 'Running', steps: [
  { type: 'warmup', duration: '10 min', paceMin: 'Z2', paceMax: '-' },
  { type: 'repeat', rounds: '3', parti: [
    { tipo: 'run', duration: '4 min', paceMin: 'Z4', paceMax: '-' },
    { tipo: 'recover', duration: '3 min', paceMin: 'Z2', paceMax: '-' }] },
  { type: 'cooldown', duration: '1 km', paceMin: 'Libero', paceMax: '-' }] } })
expect(w.sport).toBe('RUNNING')
expect(w.steps.map(s => s.type)).toEqual(['WorkoutStep', 'WorkoutRepeatStep', 'WorkoutStep'])
expect(w.steps[1]).toMatchObject({ repeatValue: 3, repeatType: 'REPEAT_UNTIL_STEPS_CMPLT' })
expect(w.steps[1].steps.map(s => s.intensity)).toEqual(['INTERVAL', 'RECOVERY'])
expect([w.steps[0], w.steps[1], ...w.steps[1].steps, w.steps[2]].map(s => s.stepOrder)).toEqual([1, 2, 3, 4, 5])
expect(corsaVersoGarmin({ title: 'x', sections: { category: 'Hyrox', blocks: [] } })).toBeNull()
expect(corsaVersoGarmin({ title: 'x', sections: { category: 'Running', steps: [] } })).toBeNull()
```

  Più: una ripetuta nel formato vecchio (`runDuration`/`recDuration`) dà due figli; `rounds` mancante o `"0"` → `repeatValue: 1`; un titolo di 150 caratteri esce di 100.
- [ ] **Step 2:** `npx vitest run src/lib/__tests__/workoutGarmin.test.js` → FAIL.
- [ ] **Step 3:** implementare le tre funzioni in `_shared/workoutGarmin.ts`, senza import Deno (solo `./ripetute.ts`).
- [ ] **Step 4:** stesso comando → PASS; romperne una (es. 3.333 → velocità non arrotondata) e vederla fallire.
- [ ] **Step 5: commit** — i due file per nome · «Garmin: la Corsa tradotta per l'orologio».

---

### Task 3: le regole dell'invio

**Files:**
- Create: `supabase/functions/_shared/garminTraining.ts`
- Test: `src/lib/__tests__/garminTraining.test.js`

**Interfaces:**
- Consumes: `GarminWorkout` (Task 2).
- Produces:
  - `GARMIN_TRAINING = { workout: 'https://apis.garmin.com/training-api/workout', schedule: 'https://apis.garmin.com/training-api/schedule' }` (entrambi `⚠️ DA VERIFICARE alla prima prova`: la documentazione del portale mostra come server `…/training-api/workout`).
  - `oggiItalia(adesso: Date): string` → `'YYYY-MM-DD'` nel fuso `Europe/Rome`.
  - `firmaWorkout(w: GarminWorkout): Promise<string>` → SHA-256 esadecimale di `JSON.stringify(w)`.
  - `decidiInvio(x: { assegnazione: { data: string, completata: boolean } | null, workout: GarminWorkout | null, collegamento: { stato: string, invia_workout: boolean, permessi: string[] } | null, invio: { data: string, stato: string, firma: string | null, inCorso: boolean } | null, firma: string | null, oggi: string }): 'crea' | 'rifai' | 'sposta' | 'cancella' | 'niente'` — `inCorso` lo calcola la funzione: `stato === 'da_rifare'`, nessun `garmin_workout_id` e `aggiornato_at` di meno di 2 minuti fa (un'altra esecuzione sta creando).
  - `idDaRisposta(j: unknown, campo: 'workoutId' | 'scheduleId'): string | null` — accetta un numero nudo, una stringa, o un oggetto con quel campo.

Tabella di `decidiInvio` (in quest'ordine):
1. `idoneo` = assegnazione presente **e** non completata **e** `data >= oggi` **e** `workout` non null **e** collegamento `attivo` con `invia_workout` e `WORKOUT_IMPORT`.
2. Non idoneo, nessun invio → `niente`.
3. Non idoneo, invio con `data < oggi` oppure assegnazione completata → `niente` (resta nello storico dell'orologio).
4. Non idoneo, altrimenti → `cancella`.
5. Idoneo, nessun invio → `crea`.
5-bis. Idoneo, `invio.inCorso` → `niente` (Review Focus 1: chi arriva secondo non crea un doppione).
6. Idoneo, `invio.stato !== 'inviato'` oppure `invio.firma !== firma` → `rifai`.
7. Idoneo, `invio.data !== assegnazione.data` → `sposta`.
8. Altrimenti → `niente`.

- [ ] **Step 1: test che falliscono**, uno per riga della tabella più questi:
  - `completata: true` con invio futuro identico → `niente` (Review Focus 2).
  - idoneo con `invio.inCorso: true` e firma diversa → `niente` (Review Focus 1).
  - `workout: null` (categoria diventata Hyrox) con invio futuro → `cancella` (Review Focus 3).
  - `assegnazione: null` (cancellata) con invio futuro → `cancella`.
  - `invia_workout: false` con invio futuro → `cancella`; senza `WORKOUT_IMPORT` → `cancella`.
  - `oggiItalia(new Date('2026-10-28T23:30:00Z'))` → `'2026-10-29'`.
  - `firmaWorkout` uguale per due oggetti uguali, diversa se cambia un `durationValue`.
  - `idDaRisposta(123, 'scheduleId')` → `'123'`; `idDaRisposta({ workoutId: 9 }, 'workoutId')` → `'9'`; `idDaRisposta({}, 'workoutId')` → `null`.
- [ ] **Step 2:** `npx vitest run src/lib/__tests__/garminTraining.test.js` → FAIL.
- [ ] **Step 3:** implementare in `_shared/garminTraining.ts` (puro: `crypto.subtle`, `Intl.DateTimeFormat`).
- [ ] **Step 4:** → PASS; invertire apposta le righe 3 e 4 della tabella e vedere fallire.
- [ ] **Step 5: commit** — i due file · «Garmin: quando un workout va mandato, rifatto, spostato o tolto».

---

### Task 4: la Edge Function `garmin-training`

**Files:**
- Create: `supabase/functions/garmin-training/index.ts`, `supabase/functions/garmin-training/deno.json` (uguale a quello di `garmin-webhook`)
- Modify: `supabase/functions/_shared/garmin.ts` (chiamate di rete della Training API), `supabase/config.toml` (blocco `[functions.garmin-training]` con `verify_jwt = false`, commentato come gli altri due)

**Interfaces:**
- Consumes: `corsaVersoGarmin` (Task 2); `GARMIN_TRAINING`, `decidiInvio`, `firmaWorkout`, `oggiItalia`, `idDaRisposta` (Task 3); da `_shared/garmin.ts` già esistenti: `accessValido(admin, riga)`, `chiama`, `autorizzato`; da `garminRegole.ts`: `stessoSegreto`.
- Produces, in `_shared/garmin.ts`:
  - `creaWorkoutGarmin(access, w): Promise<string>` (POST JSON → `workoutId`)
  - `cancellaWorkoutGarmin(access, id): Promise<void>` (DELETE `…/{id}`; 404 = già tolto, non è un errore)
  - `programmaGarmin(access, workoutId, data): Promise<string>` (POST `{ workoutId: Number(workoutId), date: data }` → `scheduleId`)
  - `spostaProgrammaGarmin(access, scheduleId, workoutId, data): Promise<void>` (PUT `…/{scheduleId}`)
- Produces, la funzione, tre ingressi:
  1. **Interno** (header `x-garmin-interno` == `GARMIN_INTERNO_TOKEN`, confronto con `stessoSegreto`): corpo dei trigger `{ type, table, record, old_record }`. `athlete_workouts` → `sincronizza(record?.id ?? old_record.id)`. `workouts` con `UPDATE` → `sincronizza` per ogni `athlete_workouts.id` di quel workout il cui atleta ha un `garmin_collegamenti` o una riga in `garmin_invii`. `workouts` con `DELETE` → niente (le assegnazioni cancellate in cascata arrivano da sole).
  2. **`{ azione: 'riprova', athlete_workout_id }`** con il JWT dell'utente: si legge l'assegnazione col client **dell'utente** (la RLS decide se può: atleta suo o coach suo); se non la vede → 403. Poi `sincronizza`.
  3. **`{ azione: 'invia_workout', acceso: boolean }`** con il JWT dell'atleta: aggiorna `garmin_collegamenti.invia_workout`; se spento, `sincronizza` per ogni sua riga di `garmin_invii` con `data >= oggi` (la regola le cancella).
- `sincronizza(awId)`: legge assegnazione (`completed_date`, `status`, `athlete_id`, `workouts(title, sections)`), collegamento, invio; calcola `workout = corsaVersoGarmin(…)`, `firma`, `azione = decidiInvio(…)`, poi:
  - `crea`: `insert` di `garmin_invii` con `stato: 'da_rifare'`, **`on conflict do nothing`**; se la riga c'era già, esce (Review Focus 1). Poi crea, programma, aggiorna la riga a `inviato` con id, data e firma.
  - `rifai`: cancella il vecchio workout (se c'è l'id), poi come `crea` aggiornando la riga.
  - `sposta`: `spostaProgrammaGarmin`, aggiorna `data`.
  - `cancella`: `cancellaWorkoutGarmin` (cancella anche il programma), poi `delete` della riga.
  - Errore di Garmin: riga a `errore` con `errore: 'HTTP <status>'`; `accessValido` → `null`: riga a `da_rifare`, `errore: 'da ricollegare'`.
- Risponde sempre 200 ai trigger; un log per esecuzione: `garmin-training: <azione> per <awId>` (o `errore HTTP n`).

- [ ] **Step 1:** scrivere le quattro funzioni di rete in `_shared/garmin.ts` con gli URL di `GARMIN_TRAINING`.
- [ ] **Step 2:** scrivere `garmin-training/index.ts`, `deno.json`, blocco in `config.toml`.
- [ ] **Step 3:** `deno check supabase/functions/garmin-training/index.ts` → nessun errore.
- [ ] **Step 4:** `npm test` → tutto verde (le regole sono già coperte da Task 2 e 3).
- [ ] **Step 5: commit** — i file per nome · «Garmin: la funzione che manda la Corsa all'orologio».

---

### Task 5: il SQL della Fase 3 (scritto, non applicato)

**Files:**
- Create: `supabase/schema/garmin_fase3_2026-10-28.sql`

Contenuto, con l'intestazione nello stile di `garmin_2026-10-27.sql` («NON APPLICATA», serve il sì esplicito):
- `alter table public.garmin_invii add column firma text;`
- `alter table public.garmin_invii drop constraint garmin_invii_athlete_workout_id_fkey;` — con il commento del perché: con la cascata la riga sparisce **prima** che `garmin-training` riceva l'avviso del DELETE, e non sapremmo più quale workout togliere dall'orologio. Il nome del vincolo va **verificato** con la query di controllo in fondo al file prima di lanciarlo.
- `alter table public.athlete_workouts enable trigger garmin_invii_assegnazioni;` e `alter table public.workouts enable trigger garmin_invii_workout;`
- In fondo, commentate: le query di verifica (`tgenabled` deve essere `O` per tutti e tre i trigger `garmin_%`; la colonna `firma` esiste; il vincolo non c'è più) e il rollback (`disable trigger` ×2, `add constraint … on delete cascade`, `drop column firma`).

- [ ] **Step 1:** scrivere il file.
- [ ] **Step 2: commit** — `git add supabase/schema/garmin_fase3_2026-10-28.sql` · «Garmin: il SQL che accende l'invio (da applicare)».

---

### Task 6: l'interruttore «Manda i workout all'orologio»

**Files:**
- Modify: `src/lib/garmin.js` (`leggiStatoGarmin` aggiunge `inviaWorkout: riga.invia_workout !== false`; `NON_DISPONIBILE` e il ramo «non collegato» con `inviaWorkout: false`), `src/components/FoglioGarmin.jsx`, `src/pages/Settings.jsx`
- Test: `src/lib/__tests__/garmin.test.js`, `src/pages/__tests__/ImpostazioniGarmin.test.jsx`

**Interfaces:**
- Consumes: ingresso `invia_workout` di `garmin-training` (Task 4).
- Produces: `FoglioGarmin` riceve `inviaWorkout: boolean` e `onInviaWorkout(acceso: boolean)`.

Testo (spec §2): sotto i permessi, solo da collegato, un interruttore «Manda i workout all'orologio» con la riga sotto «Le corse che ti assegna il coach compaiono nel calendario di Garmin». Spento: «Quelle già mandate per i prossimi giorni vengono tolte». Aggiornamento ottimistico con rollback e `CustomAlert` in caso di errore (CLAUDE.md §8). `vibraScelta` al cambio.

- [ ] **Step 1: test che falliscono**: `leggiStatoGarmin` torna `inviaWorkout: true` da una riga con `invia_workout: true` e `false` da `invia_workout: false`; nella pagina, da collegato, l'interruttore c'è e premendolo si chiama `functions.invoke('garmin-training', { body: { azione: 'invia_workout', acceso: false } })`; se l'invoke fallisce l'interruttore torna acceso.
- [ ] **Step 2:** `npx vitest run src/lib/__tests__/garmin.test.js src/pages/__tests__/ImpostazioniGarmin.test.jsx` → FAIL.
- [ ] **Step 3:** implementare.
- [ ] **Step 4:** → PASS; poi `npm test` tutto verde.
- [ ] **Step 5: commit** — i file per nome · «Garmin: l'atleta sceglie se mandare i workout all'orologio».

---

### Task 7: «Sull'orologio» nella scheda workout

**Files:**
- Create: `src/lib/rigaOrologio.js`, `src/components/RigaOrologio.jsx`
- Modify: `src/pages/WorkoutDetail.jsx` (dove si mostra lo stato dell'assegnazione dell'atleta)
- Test: `src/lib/__tests__/rigaOrologio.test.js`

**Interfaces:**
- Consumes: tabella `garmin_invii` (lettura permessa ad atleta e coach); ingresso `riprova` di `garmin-training` (Task 4).
- Produces: `rigaOrologio(invio: { stato, data } | null): { testo: string, riprova: boolean } | null`.

Regole: `null` → `null` (la riga non c'è). `inviato` → «Sull'orologio · 28 ott» (data con `date-fns` locale `it`, formato `d MMM`), `riprova: false`. `da_rifare` o `errore` → «Non inviato», `riprova: true`. `RigaOrologio` legge la riga con `supabase.from('garmin_invii').select('stato, data').eq('athlete_workout_id', id).maybeSingle()`; un errore di lettura (tabella assente, `42P01`) = nessuna riga. «Riprova» chiama `garmin-training` con `azione: 'riprova'` e rilegge. Stile: riga discreta, testo `text-gray-400 text-xs`, icona `Watch` di lucide. Import **pigro non serve**: niente librerie nuove (attenzione al peso di `WorkoutDetail`, CLAUDE.md §2).

- [ ] **Step 1: test che falliscono** per i tre casi di `rigaOrologio` (`{ stato: 'inviato', data: '2026-10-28' }` → `{ testo: 'Sull\'orologio · 28 ott', riprova: false }`).
- [ ] **Step 2:** `npx vitest run src/lib/__tests__/rigaOrologio.test.js` → FAIL.
- [ ] **Step 3:** implementare `rigaOrologio.js`, il componente, e montarlo in `WorkoutDetail.jsx` per le assegnazioni di Corsa.
- [ ] **Step 4:** → PASS; `npm test` verde; `npm run build` e controllare che il chunk `WorkoutDetail` resti intorno ai 79 KB.
- [ ] **Step 5: commit** — i file per nome · «Garmin: la scheda dice se la corsa è sull'orologio».

---

### Task 8: memoria e passi del committente

**Files:**
- Modify: `docs/memoria/garmin.md` (sezione «Fase 3 · Corsa»), `CLAUDE.md` §11 (riga `garmin.md`: aggiungere `workoutGarmin.ts`, `garminTraining.ts`, `garmin-training`, `rigaOrologio.js`, `RigaOrologio`)

In `garmin.md`: cosa c'è e dove; il ruling della copia di `partiRipetuta`; i punti `⚠️ DA VERIFICARE`; e i **passi del committente, in ordine**:
1. `supabase functions deploy garmin-training --no-verify-jwt`.
2. Sì esplicito su `garmin_fase3_2026-10-28.sql`, poi query del nome del vincolo, poi il file, poi le verifiche.
3. Prova con l'atleta di prova: assegnargli una Corsa per **oggi o domani** con riscaldamento, ripetute e defaticamento → controllare in Garmin Connect (Allenamenti e Calendario) e sull'orologio dopo la sincronizzazione. Poi: cambiare un ritmo (deve rifarlo), spostare il giorno (deve spostarlo), togliere l'assegnazione (deve sparire), assegnare e spostare subito il giorno (un solo workout su Garmin, Review Focus 1).
4. Se la prima prova risponde 404: correggere `GARMIN_TRAINING` (Review Focus 5) e ripubblicare.

- [ ] **Step 1:** scrivere le due modifiche.
- [ ] **Step 2: commit** — i due file per nome · «Garmin: memoria della Fase 3 (Corsa)».
