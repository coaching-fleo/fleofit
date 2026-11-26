# Crea workout · primo schermo «Tocca e parti» — piano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Al passo 1 di Crea workout il tocco su una categoria porta subito al builder; nome e data si cambiano da un foglio aperto dalla testata del passo 2.

**Architecture:** Solo interfaccia, telefono. `CreateWorkout.jsx` perde Nome/Data/bottone al passo 1; `CardCategoria` diventa una card-freccia; un componente nuovo `FoglioNomeData` (sopra `Foglio` di `FoglioMessaggio.jsx` + `useBottomSheet`) tiene i due campi; una funzione pura `etichettaData` scrive la pillola della data.

**Tech Stack:** React 19, Tailwind 4, date-fns (`it`), Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-26-crea-workout-primo-schermo-design.md` · lavagna `tools/design-crea-workout/` (versione A)

## Global Constraints
- Nessun cambio a stato salvato, bozza, `workouts.date`, titolo generato, data dell'atleta (`awId`): la data iniziale resta `?date=` o oggi.
- Desktop (`useDesktop`, `CreaWorkoutDesktop`) e modalità modello invariati.
- Colori solo dai token/costanti esistenti (`BRAND`, `RUNNING`, `GYM`, `CUSTOM`); modali via `createPortal` (lo fa già `Foglio`).
- Aptica solo da `src/lib/aptica.js`: `vibraScelta` solo quando la categoria cambia.
- Il foglio ha la X `aria-label="Chiudi"` (tasto indietro Android, `indietroAndroid.js`).
- Testi esatti: riga sotto il titolo «Tocca per iniziare. Nome e data li cambi dopo, se servono.»; titolo del foglio «Nome e data»; bottone «Fatto».

## Review Focus
- Workout aperto in modifica (parte al passo 2): la testata deve aprire il foglio e rinominare davvero → test in Task 4.
- Tornare al passo 1 con blocchi e ritoccare la stessa card: i blocchi restano → test esistente «confermando torna al passo 1» adattato in Task 3.
- Tastiera aperta nel foglio (campo Nome): «Fatto» deve funzionare al primo tocco, senza che la tastiera si mangi il tocco → `onMouseDown={e => e.preventDefault()}` sul bottone, come `BarraAzioni`; verifica a mano in Task 5.
- Data del Calendario (`?date=2026-12-01`): la pillola dice «Lun 1 dic», non «Oggi» → test in Task 1 + Task 4.
- Custom senza nome: la testata mostra il titolo generato dalla data, e cambia se cambia la data nel foglio → test in Task 4.

---

### Task 1: `etichettaData`

**Files:**
- Create: `src/lib/etichettaData.js`
- Test: `src/lib/__tests__/etichettaData.test.js`

**Interfaces:**
- Produces: `etichettaData(iso: string, oggi?: Date) => string` — `'yyyy-MM-dd'` → «Oggi, gio 26 nov» / «Domani, ven 27 nov» / «Ieri, mer 25 nov» / «Lun 1 dic»; data vuota o non valida → «Scegli la data».

- [ ] **Step 1: test** — con `oggi = new Date(2026, 10, 26)`:
  `etichettaData('2026-11-26', oggi) === 'Oggi, gio 26 nov'`, `('2026-11-27') === 'Domani, ven 27 nov'`, `('2026-11-25') === 'Ieri, mer 25 nov'`, `('2026-12-01') === 'Lun 1 dic'`, `('') === 'Scegli la data'`, `('ciao') === 'Scegli la data'`.
- [ ] **Step 2:** `npx vitest run src/lib/__tests__/etichettaData.test.js` → FAIL (modulo mancante).
- [ ] **Step 3:** implementare con `parseISO`, `isValid`, `differenceInCalendarDays`, `format(d, 'EEE d MMM', { locale: it })`; prima lettera maiuscola solo quando non c'è il prefisso.
- [ ] **Step 4:** stesso comando → PASS. Rompere apposta il caso «Domani» e vederlo fallire, poi rimetterlo.
- [ ] **Step 5:** commit `git add src/lib/etichettaData.js src/lib/__tests__/etichettaData.test.js` — «Crea workout: l'etichetta della data per la pillola».

### Task 2: `CardCategoria` diventa una card-freccia

**Files:**
- Modify: `src/components/CreaWorkoutUI.jsx` (`CardCategoria`)
- Test: `src/__tests__/apticaPunti.test.jsx` (esistente, deve restare verde)

**Interfaces:**
- Produces: `CardCategoria({ attiva, colore, testoSuColore, icona, nome, descrizione, onClick })` — stessa firma, `aria-pressed={attiva}` resta.

- [ ] **Step 1:** via il pallino radio; a destra `ChevronRight size={19}` in `#5b6070` (in `colore` se attiva). Icona: da non attiva `background: ${colore}1f`, `color: colore`, `border: 1px solid ${colore}40`; da attiva come oggi (pieno). Sfondo/bordo/alone dell'attiva invariati.
- [ ] **Step 2:** `npx vitest run src/__tests__/apticaPunti.test.jsx` → PASS.
- [ ] **Step 3:** commit (con Task 3, stesso schermo).

### Task 3: passo 1 senza Nome, Data e bottone

**Files:**
- Modify: `src/pages/CreateWorkout.jsx` (blocco `{passo === 1 && (`, `BarraAzioni` in fondo)
- Test: `src/pages/__tests__/CreaWorkoutBuilder.test.jsx`, `src/pages/__tests__/RunningStepRowMemo.test.jsx`

**Interfaces:**
- Consumes: `CardCategoria` (Task 2).

- [ ] **Step 1: test** — in `CreaWorkoutBuilder.test.jsx`, describe «lo step 1 fa una domanda sola»:
  - `it('non ha più nome, data né bottone')`: dopo `monta()`, `queryByLabelText('Nome del workout')` assente, `queryByRole('button', { name: /Costruisci l'allenamento/ })` assente, `getByText('Tocca per iniziare. Nome e data li cambi dopo, se servono.')` presente.
  - `it('il tocco su una card porta al passo 2 con quella categoria')`: click su `/Corsa/` → presente `getByRole('button', { name: /Aggiungi la prima fase/ })`.
  - Riscrivere `alPasso2(nome)`: `monta()`, click su `/Hyrox/`, poi se `nome` apre il foglio (Task 4) — **in questo task** `alPasso2` clicca solo la card e i test che passano un nome restano rossi fino al Task 4.
  - Sostituire ogni click su «Costruisci l'allenamento» con il click sulla card (`/Hyrox/`, o `/Custom/`, `/Corsa/`); il test «il nome è facoltativo anche per Hyrox» e «Custom non ha bisogno di un nome» diventano: il click sulla card porta al passo 2 senza errori. «Torna al passo 1» ora si verifica con `getByText('Tocca per iniziare…')` invece del campo Nome.
  - `RunningStepRowMemo.test.jsx`: togliere la digitazione del nome e il click su «Costruisci»; il click su `/Corsa/` basta.
- [ ] **Step 2:** `npx vitest run src/pages/__tests__/CreaWorkoutBuilder.test.jsx src/pages/__tests__/RunningStepRowMemo.test.jsx` → i nuovi FAIL.
- [ ] **Step 3:** in `CreateWorkout.jsx`: la card fa `onClick={() => { setCategory(c.id); setStep(2) }}`; sotto `<h1>` il `<p className="text-[13.5px] font-medium text-muted mt-2">` con la frase; tolti separatore, `RigaCampo` Nome e Data. In `BarraAzioni`, `passo === 1` → `null` (tolta la `CtaPrimaria` «Costruisci l'allenamento»). Aggiornare il commento sopra il blocco (nome e data non vivono più qui).
- [ ] **Step 4:** stesso comando → verdi tutti tranne quelli che dipendono dal nome (Task 4).
- [ ] **Step 5:** commit `CreaWorkoutUI.jsx`, `CreateWorkout.jsx`, i due test — «Crea workout: il tocco sulla categoria apre il builder».

### Task 4: `FoglioNomeData` e le pillole del passo 2

**Files:**
- Create: `src/components/FoglioNomeData.jsx`
- Modify: `src/pages/CreateWorkout.jsx` (`TestataCrea` props `onTitolo`/`sottotitolo`, riga pillole subito sotto la testata quando `passo === 2 && !desktop && !modello && !inAttesaModello`)
- Test: `src/pages/__tests__/CreaWorkoutBuilder.test.jsx`

**Interfaces:**
- Consumes: `Foglio` da `./FoglioMessaggio`, `useBottomSheet` da `../useBottomSheet`, `RigaCampo` da `./CreaWorkoutUI`, `CustomDatePicker`, `chiudiTastieraSuInvio` da `../useTastiera`, `etichettaData` (Task 1).
- Produces: `FoglioNomeData({ nome, onNome, segnaposto, onAltroNome, data, onData, onChiudi })` — default export. `onAltroNome` null = niente dadi. Le modifiche sono **dal vivo** (scrivono subito nello stato della pagina); «Fatto» e la X chiudono soltanto.

- [ ] **Step 1: test** (describe «nome e data restano raggiungibili dal passo 2»):
  - `alPasso2(nome)`: click `/Hyrox/`; se `nome`, click «Modifica nome e data», `type` in `getByLabelText('Nome del workout')`, click «Fatto», `waitFor` che `queryByRole('dialog', { name: 'Nome e data' })` sparisca.
  - `it('la testata apre il foglio, e il nome scritto resta')`: `alPasso2('Hyrox Strength #1')`; testata ha il testo; riaperto il foglio, il campo ha valore `'Hyrox Strength #1'`; si è ancora al passo 2 (riepilogo `[data-riepilogo]` presente).
  - `it('la pillola della data dice oggi')`: `getByRole('button', { name: /^Oggi, / })` presente; click → dialog «Nome e data».
  - `it('dal calendario la pillola porta quel giorno')`: monta con `initialEntries={['/create?date=2026-12-01']}`, click `/Hyrox/` → `getByRole('button', { name: 'Lun 1 dic' })` (o il valore di `etichettaData('2026-12-01')` se il test gira lo stesso giorno — calcolarlo con la funzione).
  - `it('la pillola della categoria riporta al passo 1')`: click sul bottone `name: 'Cambia categoria: Hyrox'` → testo «Tocca per iniziare…».
  - `it('Custom senza nome: la testata segue la data')`: click `/Custom/`, testata contiene `generaTitolo(date)`; nel foglio cambiare data non è pilotabile facilmente da CustomDatePicker → limitarsi a verificare che il titolo mostrato sia quello di `generaTitolo` della data corrente.
- [ ] **Step 2:** `npx vitest run src/pages/__tests__/CreaWorkoutBuilder.test.jsx` → FAIL.
- [ ] **Step 3:** `FoglioNomeData`: `useBottomSheet(onChiudi)`, `<Foglio titolo="Nome e data" {...sheet}>`, dentro due `RigaCampo` (Nome: l'`input` con `aria-label="Nome del workout"` e i dadi `aria-label="Un altro nome"` spostati da `CreateWorkout.jsx`; Data: `CustomDatePicker`), poi `CtaPrimaria`-stile bottone brand «Fatto» (`onMouseDown={e => e.preventDefault()}`, `onClick={sheet.chiudi}`).
  In `CreateWorkout.jsx`: stato `const [foglioNomeData, setFoglioNomeData] = useState(false)`; `onTitolo={passo === 2 && !desktop && !modello ? () => setFoglioNomeData(true) : null}`; `sottotitolo` al passo 2 su telefono = `null` (lo dicono le pillole; sul desktop resta `sottotitoloWorkout`). Riga pillole `flex gap-2 flex-wrap`: pillola categoria (`aria-label={\`Cambia categoria: ${nome}\`}`, icona `ICONA_CATEGORIA`, colore della categoria su fondo `${colore}1f` e bordo `${colore}55`, `onClick={handleBack}` così con blocchi chiede conferma come la freccia) e pillola data (`VETRO`, icona `Calendar`, testo `etichettaData(date)`, apre il foglio). Pillole alte 30px, `rounded-full`, `text-[12.5px] font-bold`.
- [ ] **Step 4:** stesso comando → PASS; poi `npm test` intero → verde.
- [ ] **Step 5:** commit `FoglioNomeData.jsx`, `CreateWorkout.jsx`, il test — «Crea workout: nome e data in un foglio dalla testata».

### Task 5: verifica e memoria

**Files:**
- Modify: `docs/memoria/crea-workout.md` (punto 5 di §9-undecies + sezione nuova «Il primo schermo "Tocca e parti" (26/11/2026)»), `DEVLOG.md` (una riga)

- [ ] **Step 1:** `npx eslint src/pages/CreateWorkout.jsx src/components/CreaWorkoutUI.jsx src/components/FoglioNomeData.jsx src/lib/etichettaData.js` → nessun problema nuovo.
- [ ] **Step 2:** `npm run build` → ok; il chunk `CreaWorkoutUI` resta intorno ai 12 KB, `index` non sale.
- [ ] **Step 3:** preview `demo` (`.claude/launch.json`) a 393×852: `/create` → tocco su Corsa → builder; pillola data apre il foglio; nome scritto compare in testata; freccia indietro → categorie; screenshot.
- [ ] **Step 4:** scrivere la memoria: nome e data non vivono più al passo 1, la testata apre `FoglioNomeData`, perché (bottone in fondo, data quasi mai cambiata), la lavagna `tools/design-crea-workout/`.
- [ ] **Step 5:** commit dei documenti, della spec, del piano e della lavagna (`tools/design-crea-workout/index.html`, `.claude/launch.json`).
