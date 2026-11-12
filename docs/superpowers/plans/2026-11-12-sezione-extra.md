# Sezione Extra — piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un posto unico per le funzioni «extra» (prima le Scarpe): voce Extra
nella barra dell'atleta, «Libreria» con *Workout · Extra* per il coach, voce Extra
nella barra laterale desktop, una sola card «Dagli Extra» in Home.

**Architecture:** Un registro (`src/lib/extra.js`) elenca gli extra con interruttore,
rotta, ruoli e due funzioni pigre (`stato`, `avviso`). `useExtra()` filtra quelli accesi
per chi guarda; `useAvvisiExtra()` raccoglie gli avvisi. Barra, Libreria, barra
laterale, pagina e card in Home leggono solo questi due hook: un extra nuovo = una
voce del registro, una rotta, una riga in `funzioni_app`.

**Tech Stack:** React 19, React Router 7, Tailwind 4, Vitest + Testing Library, `lucide-react`.

**Spec:** `docs/superpowers/specs/2026-11-12-sezione-extra-design.md`

## Global Constraints

- Nessuna migrazione: accendere un extra = una riga in `funzioni_app`.
- Nessun colore nuovo; accento `brand` per pallino e selettore (CLAUDE.md §6, regola 3).
- Il registro non importa pagine né logica degli extra: solo `import()` pigri. `index`
  oggi ≈616 KB su 620 di soglia: non deve crescere oltre il rumore (misurare prima e dopo).
- localStorage solo con `leggiJson`/`scriviJson`; chiave nuova `fleofit_extra_visti`.
- Testi in italiano; ogni modale con `createPortal`; aptica solo da `src/lib/aptica.js`.
- `/archive` e `?tv=` non cambiano; `/storico` dell'atleta non prende il selettore.
- Ogni rotta di un extra avvolta in `SoloSeAccesa` con lo stesso `interruttore`.
- Si lavora su `app`; commit con i file per nome.

## Review Focus

1. **Interruttore sconosciuto mentre si carica** (`useFunzione` torna `null`): barra e
   Libreria non devono mostrare la voce Extra e poi toglierla, né il contrario a vuoto.
   → Task 2, test «finché non si sa, nessun extra».
2. **Avviso che lancia o rete giù**: un extra che fallisce non deve togliere gli avvisi
   degli altri né rompere la Home. → Task 3, test «un avviso che lancia è ignorato».
3. **Admin che simula l'atleta**: vede gli extra come un atleta (con `admin` = niente).
   → Task 2, test su `role: 'athlete'` con stato `admin`.
4. **Ritorno da un extra aperto dalla Libreria**: il tasto indietro riporta a
   *Extra*, non a *Workout*. → Task 6, test su `?vista=extra`.
5. **Tutti gli extra spenti**: barra atleta a quattro voci, Libreria senza selettore,
   niente card in Home, niente voce desktop. → test in Task 4, 5, 6, 7.

---

### Task 1: Registro degli extra e test di coerenza

**Files:**
- Create: `src/lib/extra.js`
- Create: `src/lib/extra/scarpe.js`
- Test: `src/lib/__tests__/extra.test.js`

**Interfaces:**
- Produces:
  - `EXTRA: Array<{ id, nome, icona, interruttore, rotta, ruoli: ('athlete'|'coach')[], descrizione: { athlete?: string, coach?: string }, stato?: () => Promise<(uid, ruolo) => Promise<string|null>>, avviso?: () => Promise<(uid, ruolo) => Promise<Avviso|null>> }>`
  - `Avviso = { chiave: string, testo: string, priorita: 'alta' | 'normale' }`
  - `ruoloExtra(role): 'athlete' | 'coach'` — `admin` e `coach` → `'coach'`.
  - `src/lib/extra/scarpe.js`: `stato(uid, ruolo)` e `avviso(uid, ruolo)`.

- [ ] **Step 1: Write the failing tests**

`extra.test.js`, sul modello di `iaCategorie.test.js` (sorgenti importati con `?raw`):
- `it.each(EXTRA)('%s ha la rotta in App.jsx dentro SoloSeAccesa')`: `App.jsx?raw` contiene
  `path="${rotta}" element={<SoloSeAccesa nome="${interruttore}">`.
- `it.each(EXTRA)('%s ha la riga nel seme della demo')`: `demoSemi.js?raw` contiene
  `{ nome: '${interruttore}', stato: 'tutti'`.
- `it.each(EXTRA)('%s ha una descrizione per ogni ruolo in cui compare')`.
- `ruoloExtra`: `'admin'`→`'coach'`, `'coach'`→`'coach'`, `'athlete'`→`'athlete'`.
- Scarpe `avviso` (con `scarpeDb` mockato):
  - atleta con una scarpa `stato: 'oltre'` id `s1`, modello «Pegasus» →
    `{ chiave: 'cambia:s1', testo: 'Pegasus è da cambiare', priorita: 'alta' }`;
  - atleta senza scarpe attive → `{ chiave: 'aggiungi', testo: 'Tieni il conto dei km delle tue scarpe', priorita: 'normale' }`;
  - atleta con scarpe e nessuna «oltre» → `null`;
  - coach → `null`; `disponibile: false` → `null`.
- Scarpe `stato`:
  - atleta, 3 attive di cui 1 oltre → `'3 scarpe · una da cambiare'`; 1 attiva, nessuna oltre → `'1 scarpa'`; nessuna → `null`;
  - coach, catalogo di 12 → `'12 modelli'`; vuoto → `null`.

- [ ] **Step 2: Run** `npx vitest run src/lib/__tests__/extra.test.js` — Expected: FAIL (modulo assente).

- [ ] **Step 3: Implement** `src/lib/extra.js` con la sola voce `scarpe` (valori della
  spec §2: nome «Scarpe da corsa», icona `Footprints`, rotta `/scarpe`, ruoli entrambi,
  descrizioni «I km delle tue scarpe» / «Il catalogo dei modelli»), e `src/lib/extra/scarpe.js`
  sopra `leggiScarpeAtleta`/`elencoCatalogo` di `scarpeDb.js`. Gli errori di `scarpeDb`
  (anche `tabelleAssenti`) → `null`, mai un'eccezione.

- [ ] **Step 4: Run** lo stesso comando — Expected: PASS. Rompere apposta la rotta in
  una copia locale del test (nome sbagliato) e vederlo fallire, poi ripristinare.

- [ ] **Step 5: Commit** `src/lib/extra.js src/lib/extra/scarpe.js src/lib/__tests__/extra.test.js` — «Registro degli extra».

### Task 2: `useExtra()`

**Files:**
- Create: `src/useExtra.js`
- Test: `src/lib/__tests__/useExtra.test.jsx`

**Interfaces:**
- Consumes: `EXTRA`, `ruoloExtra` (Task 1); `statoFunzione`, `funzioneVisibile` (`src/lib/funzioniApp.js`); `useAuth` (`src/App`).
- Produces: `useExtra(): Extra[] | null` — `null` finché almeno un interruttore non è
  letto; poi gli extra del registro accesi per il `role` corrente e con `ruoloExtra(role)`
  in `ruoli`, nell'ordine del registro.

- [ ] **Step 1: Write the failing tests** (`renderHook` dentro `AuthContext.Provider`;
  `statoFunzione` sostituito per test con `vi.mocked`):
  - «finché non si sa, nessun extra»: prima lettura pendente → `null`;
  - stato `tutti`, `role: 'athlete'` → `[scarpe]`;
  - stato `admin`, `role: 'admin'` → `[scarpe]`; `role: 'athlete'` (admin che simula) → `[]`;
  - `globalThis.funzioniSpente = ['scarpe']` → `[]`.
- [ ] **Step 2: Run** `npx vitest run src/lib/__tests__/useExtra.test.jsx` — FAIL.
- [ ] **Step 3: Implement** `useExtra` (stesso schema «vivo» di `useFunzione`: legge tutti gli interruttori del registro in parallelo).
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `src/useExtra.js src/lib/__tests__/useExtra.test.jsx` — «useExtra».

### Task 3: Avvisi e «già visti»

**Files:**
- Create: `src/lib/avvisiExtra.js` (puro)
- Create: `src/useAvvisiExtra.js`
- Test: `src/lib/__tests__/avvisiExtra.test.js`

**Interfaces:**
- Consumes: `useExtra` (Task 2), `leggiJson`/`scriviJson` (`src/lib/offlineQueue.js`).
- Produces:
  - `chiaveVisto(idExtra, chiave): string` → `` `${idExtra}:${chiave}` ``
  - `ordinaAvvisi(voci: {extra, avviso}[], visti: string[]): { primo: {extra, avviso} | null, altri: number }` — esclude i visti; `alta` prima di `normale`; a parità l'ordine di ingresso (= registro).
  - `useAvvisiExtra(): { primo, altri, aperti: Set<idExtra>, chiudi(idExtra, chiave) }` —
    gli avvisi si chiedono in un effetto (dopo il primo fotogramma); ogni `avviso()` che
    lancia o rifiuta è ignorato; `chiudi` scrive in `fleofit_extra_visti` (massimo 50 chiavi, le più vecchie escono) e aggiorna lo stato.

- [ ] **Step 1: Write the failing tests**:
  - `ordinaAvvisi`: `alta` di un extra dopo `normale` di un altro → `primo` è l'`alta`, `altri: 1`;
  - un avviso la cui `chiaveVisto` è in `visti` è escluso; tutti visti → `{ primo: null, altri: 0 }`;
  - `useAvvisiExtra`: un `avviso()` che lancia è ignorato e l'altro resta («un avviso che lancia è ignorato»);
  - `chiudi('scarpe','cambia:s1')` → `primo` diventa `null` e `leggiJson('fleofit_extra_visti')` contiene `'scarpe:cambia:s1'`;
  - con chiave nuova (`'cambia:s2'`) la card torna.
- [ ] **Step 2: Run** `npx vitest run src/lib/__tests__/avvisiExtra.test.js` — FAIL.
- [ ] **Step 3: Implement** i due file.
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** i tre file — «Avvisi degli extra».

### Task 4: Pagina Extra e rotta `/extra`

**Files:**
- Create: `src/components/ExtraUI.jsx` (presentazione: `GrigliaExtra`, `CardExtra`)
- Create: `src/pages/Extra.jsx`
- Modify: `src/App.jsx` (rotta `/extra`, import pigro come le altre pagine)
- Test: `src/pages/__tests__/Extra.test.jsx`

**Interfaces:**
- Consumes: `useExtra`, `useAvvisiExtra`, `ruoloExtra`.
- Produces: `export default function Extra({ incorporata = false })` — con `incorporata`
  niente testata né padding di pagina (la usa la Libreria, Task 6).
  `GrigliaExtra({ voci: {extra, riga, avviso: boolean}[], onApri(extra) })`.

- [ ] **Step 1: Write the failing tests** (`montaPagina`):
  - atleta, scarpe accese: una card «Scarpe da corsa» con la riga di `stato` (mock `'1 scarpa'`); senza `stato` → «I km delle tue scarpe»; coach → «Il catalogo dei modelli»;
  - il tocco naviga a `/scarpe`;
  - con un avviso aperto la card ha il pallino (`aria-label` contiene «novità»);
  - tutto spento su `/extra` → `Navigate` alla Home (la pagina stessa non ha senso vuota).
- [ ] **Step 2: Run** `npx vitest run src/pages/__tests__/Extra.test.jsx` — FAIL.
- [ ] **Step 3: Implement**. Griglia `grid grid-cols-2 gap-3` dentro `.cascata`; card
  `bg-[#1e1e1e] border border-[#2a2a2a] rounded-3xl p-4`, icona in cerchio `bg-[#2a2a2a]`,
  pallino `bg-brand` 8px in alto a destra; testata «Extra» con lo stile di `TestataArchivio`;
  `vibraScelta()` al tocco. `stato()` si chiede dopo il montaggio; errore → descrizione.
- [ ] **Step 4: Run** — PASS. Poi `npm test` intero — verde.
- [ ] **Step 5: Commit** i quattro file — «Pagina Extra».

### Task 5: Card «Dagli Extra» in Home al posto di `BannerScarpe`

**Files:**
- Modify: `src/components/ExtraUI.jsx` (+ `CartaDagliExtra`)
- Create: `src/components/DagliExtra.jsx` (legge `useAvvisiExtra`, rende `CartaDagliExtra`)
- Modify: `src/pages/Home.jsx` (ramo atleta: dove oggi c'è `BannerScarpe`)
- Modify: `src/components/HomeRiepilogoTelefono.jsx`, `HomeRiepilogoDesktop.jsx` (in fondo, dopo l'ultima `section`)
- Modify: `src/components/HomeCoachTelefono.jsx`, `HomeCoachDesktop.jsx` (al posto di `BannerScarpe`)
- Delete: `src/components/BannerScarpe.jsx`, `src/components/__tests__/BannerScarpe.test.jsx`, `src/lib/bannerScarpe.js` e il suo test, se nessun altro li importa (`grep -rn bannerScarpe src`)
- Test: `src/components/__tests__/DagliExtra.test.jsx`

> ⚠️ Correzione alla spec §3, da riportare nella spec in questo task: la card va **in
> fondo** alla Home atleta, dove sta oggi `BannerScarpe`, non sotto l'allenamento di oggi.
> Arriva dopo una lettura: sopra la lista spingerebbe in basso gli allenamenti mentre
> l'atleta li sta per toccare (commento in `Home.jsx` sopra `BannerScarpe`).
> Nella Riepilogo coach, per lo stesso motivo, in fondo.

**Interfaces:**
- Consumes: `useAvvisiExtra` (Task 3).
- Produces: `DagliExtra()` senza props, pigro (`lazy`) dove montato. `CartaDagliExtra({ extra, avviso, altri, onApri, onChiudi, onApriTutti })`.

- [ ] **Step 1: Write the failing tests**:
  - due avvisi → si vede il testo dell'`alta` e «+1 negli Extra»; tocco su «+1» → `/extra` (atleta) o `/archive?vista=extra` (coach);
  - tocco sulla card → rotta dell'extra; X (`aria-label="Chiudi l'avviso"`) → card sparita;
  - nessun avviso o tutto spento → niente nel DOM.
- [ ] **Step 2: Run** `npx vitest run src/components/__tests__/DagliExtra.test.jsx` — FAIL.
- [ ] **Step 3: Implement**. Card neutra (`bg-[#1e1e1e]`, bordo `#2a2a2a`, `rounded-3xl`), icona dell'extra in cerchio `bg-brand/[.16] text-brand`, testo bianco, X grigia; ⚠️ la X **non** deve chiamarsi «Chiudi» (il tasto indietro Android chiuderebbe la Home, `indietroAndroid.js`). Sostituire i cinque montaggi.
- [ ] **Step 4: Run** `npm test` — verde (i test Home esistenti che cercavano il banner vanno aggiornati al nuovo testo, non tolti).
- [ ] **Step 5: Commit** i file toccati per nome, più la spec corretta — «Dagli Extra in Home al posto del banner Scarpe».

### Task 6: Barra — voce Extra per l'atleta, «Libreria» per il coach

**Files:**
- Modify: `src/components/Navbar.jsx`
- Test: `src/components/__tests__/Navbar.test.jsx` (nuovo)

**Interfaces:**
- Consumes: `useExtra`, `useAvvisiExtra`.

- [ ] **Step 1: Write the failing tests**:
  - atleta, tutto spento → quattro link (Home, Storico, Calendario, Profilo);
  - atleta, scarpe accese → cinque, «Extra» (`/extra`) prima di «Profilo»;
  - atleta con avviso aperto → la voce Extra ha il pallino (`aria-label="Extra, novità"`);
  - coach → la voce a `/archive` si chiama «Libreria», senza pallino anche con avvisi.
- [ ] **Step 2: Run** `npx vitest run src/components/__tests__/Navbar.test.jsx` — FAIL.
- [ ] **Step 3: Implement**. Icona `LayoutGrid`; con `useExtra() === null` la voce non c'è (niente comparsa e scomparsa). Pallino: `span` 7px `bg-brand` sul `Cerchio`, prop `pallino` di `Voce`. Icona «Libreria»: `Library` di lucide.
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** — «Barra: Extra per l'atleta, Libreria per il coach».

### Task 7: Libreria — selettore *Workout · Extra*

**Files:**
- Modify: `src/pages/WorkoutsArchive.jsx` (solo ramo telefono, solo coach, solo `!storico`)
- Modify: `src/components/ArchivioUI.jsx` (+ `SelettoreLibreria({ vista, onCambia, pallino })`)
- Test: `src/pages/__tests__/Libreria.test.jsx`

**Interfaces:**
- Consumes: `Extra` con `incorporata` (Task 4), `useExtra`, `useAvvisiExtra`.

- [ ] **Step 1: Write the failing tests** (`montaPagina`, `role: 'coach'`):
  - titolo «Libreria»; con scarpe accese il selettore c'è e parte su «Workout»;
  - `percorso: '/archive?vista=extra'` → la griglia Extra è visibile (Review Focus 4);
  - tocco su «Extra» → `searchParams.vista === 'extra'` con `replace` (non impila);
  - tutto spento → niente selettore, titolo «Libreria»;
  - atleta su `/storico` → niente selettore, titolo invariato;
  - `?tv=1234` continua a funzionare come in `ArchivioTV.test.jsx` (quel test resta verde).
- [ ] **Step 2: Run** `npx vitest run src/pages/__tests__/Libreria.test.jsx` — FAIL.
- [ ] **Step 3: Implement**. Toggle segmentato del §6 (`bg-[#111] p-1.5 rounded-2xl border border-[#333]`, indicatore che trasla in 300ms). Sotto la testata, prima di ricerca e filtri; con *Extra* attivo ricerca e filtri non si mostrano. `useRipresa` della lista non deve leggere né scrivere mentre si è su *Extra*.
- [ ] **Step 4: Run** `npm test` — verde.
- [ ] **Step 5: Commit** — «Libreria: Workout · Extra».

### Task 8: Desktop e Impostazioni — un solo ingresso

**Files:**
- Modify: `src/components/BarraLaterale.jsx` (voce «Scarpe» → «Extra» `/extra`, da `useExtra().length > 0`)
- Modify: `src/pages/Settings.jsx` (via la riga «Catalogo scarpe» e `scarpeAccese`)
- Test: aggiornare i test esistenti che cercano «Catalogo scarpe» o la voce «Scarpe» (`grep -rln "Catalogo scarpe\|etichetta=\"Scarpe\"" src`)

- [ ] **Step 1: Write the failing tests**: `BarraLaterale` mostra «Extra» con scarpe accese, niente con tutto spento; Impostazioni coach non ha più «Catalogo scarpe».
- [ ] **Step 2: Run** i due file di test — FAIL.
- [ ] **Step 3: Implement**.
- [ ] **Step 4: Run** `npm test` e `npx eslint src` — verde; lint non sopra i 26 problemi di riferimento.
- [ ] **Step 5: Commit** — «Un solo ingresso agli extra».

### Task 9: Pesi, demo, memoria

**Files:**
- Modify: `CLAUDE.md` §8 (chiave `fleofit_extra_visti`) e §11 (riga per `extra.js`, `useExtra`, `avvisiExtra.js`, `Extra.jsx`, `ExtraUI`, `DagliExtra` → `extra.md`)
- Create: `docs/memoria/extra.md` (come si aggiunge un extra, in cinque righe; le scelte della spec; la regola delle push: parte solo con l'interruttore acceso, controllato da `send-reminders`)
- Modify: `docs/memoria/scarpe.md` (gli ingressi ora sono la sezione Extra; `BannerScarpe` tolto)
- Modify: `BACKLOG.md` se ha voci sugli ingressi alle Scarpe

- [ ] **Step 1: Misura** `npm run build` e annotare `index` e il nuovo chunk `Extra`. Expected: `index` ≤ misura di partenza + 1 KB (misurare la partenza su `app` **prima** del Task 1 e scriverla qui).
- [ ] **Step 2: Demo** `npm run demo` e `npm run demo:atleta` nel browser: barra atleta a cinque voci, Libreria col selettore, griglia, card in Home, X che la chiude, ritorno da `/scarpe` su *Extra*. Screenshot al committente.
- [ ] **Step 3: Scrivere** i documenti sopra.
- [ ] **Step 4: Commit** — «Sezione Extra: memoria e pesi».

Le prove su iPhone e Android le fa il committente (barra a cinque voci, tasto indietro Android su *Extra*).
