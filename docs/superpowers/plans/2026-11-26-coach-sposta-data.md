# Il coach sposta la data — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** il coach sposta un allenamento a un altro giorno in un tocco, per un atleta solo o per tutti, dalla scheda workout e dalla scheda atleta.

**Architecture:** si estende il foglio dell'atleta (`FoglioSposta`) con un `modo="coach"` e una scelta di portata; la logica (chi si sposta, scrittura con rollback, push) sta in `src/lib/spostaAllenamento.js`; le pagine passano solo i callback. Un modo nuovo `athlete_moved` in `send-reminders` avvisa gli atleti.

**Tech Stack:** React 19, Vitest + Testing Library, Supabase JS, Edge Function Deno.

**Spec:** `docs/superpowers/specs/2026-11-26-coach-sposta-data-design.md`

## Global Constraints

- Nessuna migrazione (CLAUDE.md §0-bis). Si scrivono solo `athlete_workouts.completed_date` e `workouts.date`.
- «Solo un atleta» **non tocca mai** `workouts.date`.
- «Tutti» sposta solo le assegnazioni non completate con `completed_date === workouts.date`.
- Il modo atleta di `FoglioSposta` resta identico: i test esistenti in `FoglioSposta.test.jsx` passano senza modifiche.
- Testi in italiano; date brevi con `dataBreve` / `giornoBreve` di `spostaAllenamento.js`.
- Aptica solo da `src/lib/aptica.js` (`vibraSuccesso` a spostamento riuscito).
- Modali: `createPortal`, X con `aria-label="Chiudi"` e bottone «Annulla».
- Errori con `setAlertInfo`, mai `alert()`.
- Lavoro e commit su `app`; file aggiunti per nome, mai `git add -A`.
- Ogni test nuovo si vede fallire rompendo apposta il codice (CLAUDE.md §9).

## Review Focus

1. **Workout con assegnazioni «spostate da sé»**: «Tutti» non le tocca, e il foglio le conta in «restano». → test in Task 1 (`chiSiSposta`) e Task 2 (riga «restano»).
2. **Seconda scrittura che fallisce** con «Tutti»: `workouts.date` torna com'era e il foglio resta aperto. → test in Task 1 (`spostaPerTutti` rollback).
3. **Data nel passato**: il coach la conferma, l'atleta no; e la push **non** parte. → test in Task 2 e Task 1 (`daAvvisare`).
4. **Workout con una sola assegnazione**: niente toggle di portata. → test in Task 2.
5. **Atleta che guarda la propria scheda**: la data in testa **non** è un bottone. → test in Task 4.

---

## File toccati

| File | Cosa |
|---|---|
| `src/lib/spostaAllenamento.js` | `chiSiSposta`, `spostaPerTutti`, `daAvvisare`, `avvisaAtletiSpostamento` |
| `src/components/FoglioSposta.jsx` | `modo`, `nomeAtleta`, `assegnazioni`, `dataWorkout`; `onConferma(data, portata)` |
| `supabase/functions/send-reminders/testi.ts` · `index.ts` | testo e modo `athlete_moved` |
| `src/components/WorkoutDetailUI.jsx` | `TitoloScheda` con `onData` |
| `src/pages/WorkoutDetail.jsx` | data toccabile, voce menu, «Sposta» su `RigaAssegnazione` |
| `src/components/SchedaAtletaUI.jsx` | `RigaProssimo` con `onSposta` |
| `src/components/CalendarioAtleta.jsx` | prop `onSposta` verso `RigaSessione` |
| `src/pages/AthleteDetail.jsx` | foglio in modo coach, collegamenti |
| `docs/memoria/calendario.md` (+ rimandi) | sezione «9-sposta-coach» |

---

### Task 1: Logica pura in `spostaAllenamento.js`

**Files:**
- Modify: `src/lib/spostaAllenamento.js`
- Test: `src/lib/__tests__/spostaAllenamento.test.js`

**Interfaces:**
- Produces:
  - `chiSiSposta(assegnazioni: {id, status, completed_date}[], dataWorkout: string) → { siSpostano: string[] /* id */, restano: { svolti: number, spostatiDaSe: number } }`
  - `spostaPerTutti(supabase, { workoutId: string, dataOriginale: string, ids: string[], nuovaData: string }) → Promise<{ error }>` — prima `workouts.date`, poi `athlete_workouts.completed_date` con `.in('id', ids)`; se la seconda fallisce rimette `workouts.date = dataOriginale` e torna l'errore.
  - `daAvvisare({ nuovaData: string, oggi?: Date }) → boolean` — falso se `eNelPassato(nuovaData, oggi)`.
  - `avvisaAtletiSpostamento(supabase, { awIds: string[], data: string }) → Promise` — `functions.invoke('send-reminders', { body: { mode: 'athlete_moved', record_ids: awIds, newDate: dataBreve(data) } })` con `.catch(console.error)`; non chiama niente se `awIds` è vuoto.

- [ ] **Step 1: Test che falliscono**

```js
describe('chiSiSposta', () => {
  const ass = [
    { id: 'a', status: 'pending',   completed_date: '2026-12-02' },
    { id: 'b', status: 'completed', completed_date: '2026-12-02' },
    { id: 'c', status: 'pending',   completed_date: '2026-12-03' },
    { id: 'd', status: 'pending',   completed_date: '2026-12-02' },
  ]
  it('sposta solo i non svolti rimasti sulla data del workout', () => {
    expect(chiSiSposta(ass, '2026-12-02')).toEqual({ siSpostano: ['a', 'd'], restano: { svolti: 1, spostatiDaSe: 1 } })
  })
  it('lista vuota', () => {
    expect(chiSiSposta([], '2026-12-02')).toEqual({ siSpostano: [], restano: { svolti: 0, spostatiDaSe: 0 } })
  })
})

describe('spostaPerTutti', () => {
  it('scrive workout poi assegnazioni', async () => { /* finto: registra le chiamate; expect ordine workouts→athlete_workouts, ids ['a','d'] */ })
  it('se le assegnazioni falliscono rimette la data del workout', async () => {
    // finto: update su athlete_workouts → { error: { message: 'x' } }
    // expect: secondo update su workouts con { date: '2026-12-02' }; risultato.error truthy
  })
})

describe('daAvvisare', () => {
  it('niente push per una data passata', () => {
    expect(daAvvisare({ nuovaData: '2026-11-20', oggi: new Date('2026-11-26') })).toBe(false)
    expect(daAvvisare({ nuovaData: '2026-11-27', oggi: new Date('2026-11-26') })).toBe(true)
  })
})
```

Il finto Supabase per `spostaPerTutti` si scrive nel test: un oggetto `from(tabella)` che restituisce `update(v) → { eq/in → Promise<{error}> }` e registra `[tabella, v]`.

- [ ] **Step 2:** `npx vitest run src/lib/__tests__/spostaAllenamento.test.js` → FAIL (funzioni non esportate).
- [ ] **Step 3:** implementare le quattro funzioni con le firme sopra.
- [ ] **Step 4:** stesso comando → PASS; rompere apposta il filtro `status !== 'completed'` e vedere il primo test fallire, poi rimetterlo.
- [ ] **Step 5: Commit** — `git add src/lib/spostaAllenamento.js src/lib/__tests__/spostaAllenamento.test.js` · «Sposta del coach: chi si sposta, scrittura per tutti con rollback».

---

### Task 2: `FoglioSposta` in modo coach

**Files:**
- Modify: `src/components/FoglioSposta.jsx`
- Test: `src/components/__tests__/FoglioSposta.test.jsx`

**Interfaces:**
- Consumes: `chiSiSposta` (Task 1).
- Produces: `<FoglioSposta titolo dataAttuale onChiudi onConferma modo? nomeAtleta? assegnazioni? dataWorkout? portataIniziale? />`
  - `modo: 'atleta' | 'coach'` (default `'atleta'`).
  - `assegnazioni`: tutte le assegnazioni del workout (`{id,status,completed_date}`), `dataWorkout`: `workouts.date`.
  - `portataIniziale: 'solo' | 'tutti'` (default `'solo'` se c'è `nomeAtleta`, altrimenti `'tutti'`).
  - `onConferma(data: string, portata: 'solo' | 'tutti') → Promise<boolean>`. In modo atleta `portata` è sempre `'solo'` (i chiamanti esistenti la ignorano).

Comportamento in modo coach:
- `valida` = `scelta && scelta !== dataAttuale` (il passato **è** ammesso; niente messaggio rosso).
- Toggle segmentato «Solo {nomeAtleta} · Tutti ({n})» solo se `nomeAtleta` e `assegnazioni.length > 1`; `n = assegnazioni.length`. Ruolo `radiogroup`, bottoni `role="radio"` con `aria-checked`.
- Con portata `tutti` e `restano.svolti + restano.spostatiDaSe > 0`: riga grigia «{k} restano dove sono: {svolti} già svolt{o|i}, {spostatiDaSe} spostat{o|i} da sé» (si omette la parte a zero).
- Testo: con `solo` e `nomeAtleta` → «**{nomeAtleta}** ha **{titolo}** in programma {data}. In che giorno lo sposti?»; altrimenti «**{titolo}** è in programma {data}. In che giorno lo sposti?».
- Bottone: `Sposta a {giornoBreve}` / `Sposta tutti a {giornoBreve}`.

- [ ] **Step 1: Test che falliscono**

```js
describe('FoglioSposta · coach', () => {
  const ass = [
    { id: 'a', status: 'pending', completed_date: '2026-12-02' },
    { id: 'b', status: 'completed', completed_date: '2026-12-02' },
    { id: 'c', status: 'pending', completed_date: '2026-12-02' },
  ]
  it('il coach conferma anche una data passata', async () => { /* sceglie dal CustomDatePicker una data di ieri; expect onConferma(ieri, 'solo') */ })
  it('toggle portata e «Sposta tutti a …»', async () => {
    // render modo="coach" nomeAtleta="Marco" assegnazioni={ass} dataWorkout="2026-12-02"
    // expect radio «Solo Marco» checked; click «Tutti (3)»; scegli dopodomani
    // expect bottone `Sposta tutti a ${giornoBreve(dopodomani)}`; click → onConferma(dopodomani, 'tutti')
    // expect testo '1 restano dove sono: 1 già svolto'
  })
  it('con una sola assegnazione niente toggle', () => {
    // assegnazioni={[ass[0]]} → queryByRole('radiogroup') null
  })
})
```

- [ ] **Step 2:** `npx vitest run src/components/__tests__/FoglioSposta.test.jsx` → i nuovi FAIL, i vecchi PASS.
- [ ] **Step 3:** implementare le props sopra.
- [ ] **Step 4:** stesso comando → tutto PASS.
- [ ] **Step 5: Commit** — «FoglioSposta: modo coach con Solo / Tutti».

---

### Task 3: Push all'atleta — `athlete_moved` in `send-reminders`

**Files:**
- Modify: `supabase/functions/send-reminders/testi.ts`, `supabase/functions/send-reminders/index.ts`
- Test: `src/lib/__tests__/testiNotifiche.test.js`

**Interfaces:**
- Produces in `testi.ts`: `testoSpostatoDalCoach({ workoutTitle: string, newDate: string }) → { title: '📅 Allenamento spostato', bodyMsg: \`${titolo} ora è ${newDate}\` }` (titolo senza codice in coda: si toglie con la stessa regola che usano gli altri testi del file; se non ce n'è una, si passa il titolo così com'è).
- Body della chiamata: `{ mode: 'athlete_moved', record_ids: string[], newDate: string }`.

Comportamento in `index.ts`:
- `'athlete_moved'` va in `soloAdmin` (= chiunque sia staff, `chiamante.admin`).
- Un coach (`chiamante.ruoloStaff === 'coach'`) avvisa solo i suoi: si filtrano le assegnazioni con `atletiDi(supabase, chiamante.id)`. Un admin le avvisa tutte.
- Per ogni assegnazione `status !== 'completed'`: riga in `notifications` (route `/workout/<workout_id>?athlete_id=<athlete_id>`) e `sendPush` su ogni `push_subscriptions` dell'atleta — come il modo `immediate`.

- [ ] **Step 1:** test in `testiNotifiche.test.js`: `testoSpostatoDalCoach({ workoutTitle: 'Sled', newDate: 'gio 4 dic' })` → `{ title: '📅 Allenamento spostato', bodyMsg: 'Sled ora è gio 4 dic' }`.
- [ ] **Step 2:** `npx vitest run src/lib/__tests__/testiNotifiche.test.js` → FAIL.
- [ ] **Step 3:** implementare `testoSpostatoDalCoach` e il ramo `athlete_moved`.
- [ ] **Step 4:** test → PASS; `deno check supabase/functions/send-reminders/index.ts` senza errori (se `deno` non c'è, dirlo nel rapporto).
- [ ] **Step 5: Commit** — «send-reminders: athlete_moved, l'atleta sa che il coach l'ha spostato». ⚠️ **Non** fare il deploy: lo decide il committente (tocca anche il sito). Finché non è pubblicata la chiamata fallisce in silenzio e lo spostamento resta.

---

### Task 4: Scheda workout

**Files:**
- Modify: `src/components/WorkoutDetailUI.jsx` (`TitoloScheda`), `src/pages/WorkoutDetail.jsx`
- Test: `src/pages/__tests__/WorkoutDetailSposta.test.jsx` (nuovo, sul modello di `WorkoutDetailAssegnati.test.jsx`)

**Interfaces:**
- Consumes: `FoglioSposta` (Task 2), `spostaAssegnazione`, `spostaPerTutti`, `chiSiSposta`, `daAvvisare`, `avvisaAtletiSpostamento` (Task 1).
- Produces: `TitoloScheda` accetta `onData?: () => void`; con `onData` la data è un `<button aria-label="Cambia data">` con l'icona `CalendarDays` (14px) dopo il testo; senza, resta testo.

Comportamento:
- `onData` solo se `puoAssegnare` (stessi permessi di Modifica).
- Voce di menu «Sposta a un altro giorno» anche per lo staff (`puoAssegnare && !isAuto`), accanto alla voce dell'atleta che resta com'è.
- `RigaAssegnazione`: `azione` diventa due bottoni — prima «Sposta» (`CalendarClock` 16px, `aria-label="Sposta la data di {nome}"`), poi il cestino esistente. Apre il foglio con `portataIniziale="solo"` e il toggle nascosto (si passa `assegnazioni` di una sola riga).
- Stato `spostaCoach: null | { aw: assegnazione | null }`. Dalla data o dal menu: `aw` = assegnazione dell'atleta aperto (`queryAthleteId`) se c'è, altrimenti `null` (portata `tutti`).
- Conferma: `solo` → `spostaAssegnazione(aw.id, data)`; `tutti` → `chiSiSposta(assignments, dataWorkoutOriginale)` + `spostaPerTutti`. ⚠️ `workout.date`, con un atleta aperto, è già il **suo** giorno (lo riscrive il fetch): la data originale del workout va tenuta a parte nel fetch (`dataWorkoutOriginale`).
- Riuscito: `vibraSuccesso()`, chiude, `fetchWorkout()`; se `daAvvisare` → `avvisaAtletiSpostamento` con gli id spostati e non svolti. Fallito: `setAlertInfo` come in `spostaQui` e `false`.

- [ ] **Step 1: Test che falliscono**
  - `la data in testa apre il foglio per il coach` → click `Cambia data` → dialog «Sposta l'allenamento».
  - `per l'atleta la data non è un bottone` → `queryByRole('button', { name: 'Cambia data' })` null.
  - `«Tutti» scrive il workout e solo le assegnazioni rimaste sulla data` → con il finto Supabase: update `workouts` con la data nuova, update `athlete_workouts` con `in` sugli id attesi.
  - `«Sposta» su una riga non tocca workouts.date` → nessun update su `workouts`.
- [ ] **Step 2:** `npx vitest run src/pages/__tests__/WorkoutDetailSposta.test.jsx` → FAIL.
- [ ] **Step 3:** implementare.
- [ ] **Step 4:** test → PASS; `npx vitest run src/pages/__tests__/WorkoutDetail*` → PASS.
- [ ] **Step 5: Commit** — «Scheda workout: il coach tocca la data e la sposta».

---

### Task 5: Scheda atleta

**Files:**
- Modify: `src/components/SchedaAtletaUI.jsx` (`RigaProssimo`), `src/components/CalendarioAtleta.jsx`, `src/pages/AthleteDetail.jsx`
- Test: `src/pages/__tests__/AthleteDetailSposta.test.jsx` (nuovo, sul modello di `SchedaAtleta.test.jsx`)

**Interfaces:**
- Consumes: Task 1, Task 2.
- Produces: `RigaProssimo` accetta `onSposta?: () => void` → bottone `CalendarClock` (`aria-label="Sposta l'allenamento"`) prima del cestino. `CalendarioAtleta` accetta `onSposta?: (w) => void`, passato a `RigaSessione` come `onSposta={() => onSposta(w)}` su tutte le righe, gare comprese (in modo coach si spostano anche quelle, spec §2). E `giornoDaMostrare?: string` (`yyyy-MM-dd`): quando cambia, il calendario porta `mese` e `giornoScelto` a quel giorno, così dopo lo spostamento si vede dove è finito (come `Calendar.jsx`).

Comportamento in `AthleteDetail`:
- Solo staff e non sul proprio profilo (`role !== 'athlete' && !isOwnProfile`).
- `TodayAthleteWorkoutCard` (Oggi): stessa azione, tramite una prop `onSposta`.
- All'apertura del foglio: una lettura `athlete_workouts` `select('id, status, completed_date').eq('workout_id', w)` e `workouts.date` per avere `assegnazioni` e `dataWorkout`; mentre legge, il foglio parte con la sola assegnazione dell'atleta (niente toggle) e si aggiorna. Lettura fallita = solo «Solo {nome}».
- Riuscito: `vibraSuccesso()`, rilettura della lista, push come in Task 4.

- [ ] **Step 1: Test che falliscono**
  - `«Sposta» su un prossimo allenamento apre il foglio con il nome dell'atleta`.
  - `«Solo» scrive solo la sua assegnazione`.
  - `con due assegnazioni compare «Tutti (2)»`.
  - in `CalendarioAtleta.test.jsx`: `giornoDaMostrare in un altro mese porta il calendario lì`.
- [ ] **Step 2:** `npx vitest run src/pages/__tests__/AthleteDetailSposta.test.jsx` → FAIL.
- [ ] **Step 3:** implementare.
- [ ] **Step 4:** test → PASS; `npx vitest run src/components/__tests__/CalendarioAtleta.test.jsx src/pages/__tests__/SchedaAtleta*` → PASS.
- [ ] **Step 5: Commit** — «Scheda atleta: Sposta sulle righe e nel calendario».

---

### Task 6: Verifica generale e memoria

**Files:**
- Modify: `docs/memoria/calendario.md`, `docs/memoria/scheda-workout.md`, `docs/memoria/scheda-atleta.md`, `DEVLOG.md`

- [ ] **Step 1:** `npm test` → tutto verde (il numero di test sale rispetto a prima: scriverlo nel rapporto). `npx eslint src/lib/spostaAllenamento.js src/components/FoglioSposta.jsx src/pages/WorkoutDetail.jsx src/pages/AthleteDetail.jsx` → nessun problema nuovo.
- [ ] **Step 2:** `npm run build`: `WorkoutDetail` non deve crescere oltre qualche KB (§2); `index` non deve crescere.
- [ ] **Step 3:** prova in `npm run demo` (coach) nel browser: data in testa → foglio → «Tutti» → la lista «Assegnato a» mostra le date nuove; scheda atleta → «Sposta» → il calendario va al giorno nuovo. Screenshot nel rapporto. Le prove sul telefono le fa il committente.
- [ ] **Step 4:** in `calendario.md` la sezione «## 9-sposta-coach — Il coach sposta la data (26/11/2026)» con: le due portate, le regole di «Tutti», il passato ammesso, le gare, la push `athlete_moved` (**da pubblicare**), il rollback. Una riga di rimando negli altri due file; una voce in `DEVLOG.md`.
- [ ] **Step 5: Commit** — file per nome · «Memoria: il coach sposta la data».
