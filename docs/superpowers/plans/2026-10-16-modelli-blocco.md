# Modelli di blocco — piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** il coach salva un blocco Hyrox, una fase Corsa o un gruppo Gym come modello, lo
reinserisce dal foglio «Aggiungi» del builder, e gestisce i modelli in una pagina `/modelli`
che per crearli e modificarli apre il builder in «modalità modello».

**Architecture:** una tabella additiva `modelli_blocco` con la RLS «solo i miei, se sono
staff». La logica pura (via gli `id`, `id` nuovi, nome proposto, anteprima, validità) sta in
`src/lib/modelliBlocco.js`. La lettura e la scrittura stanno in `src/lib/modelliBloccoDb.js`
più un hook `useModelliBlocco`. L'interfaccia nuova sta in due file piccoli
(`FoglioModello.jsx`, `ModelliUI.jsx`) e in una pagina `Modelli.jsx`. Il builder riceve tre
agganci: il menu dei blocchi, i picker e la modalità modello.

**Tech Stack:** React 19, React Router 7, Supabase, Vitest + Testing Library, Tailwind 4.

**Spec:** `docs/superpowers/specs/2026-10-16-modelli-blocco-design.md` (approvata il
16/10/2026, compresa la correzione: niente «Genera con IA» né «Da un testo scritto» nella
modalità modello).

## Global Constraints

- Si lavora e si fa commit su `app`. Mai `main`, mai `git push origin app:main`. I file si
  aggiungono per nome, mai con `git add -A` né `git add .`.
- Lo schema resta congelato tranne questa tabella (il sì è del 16/10/2026). Nessun'altra
  tabella o policy cambia.
- Categorie dei modelli: esattamente `['Hyrox', 'Running', 'Gym']`, cioè gli `id` di
  `CATEGORIE`, mai le etichette.
- `nome`: da 1 a 80 caratteri dopo il trim, uguale nel `check` SQL e nell'app.
- Il `contenuto` salvato non ha nessun `id`, a nessun livello. Il blocco inserito ha `id`
  nuovi (`Math.random()`) a ogni livello.
- Interfaccia e commenti in italiano. Colori solo dai token (`brand`, `running`, `gym`).
  Modali con `createPortal(…, document.body)`. Avvisi con `mostraErrore` e
  `mostraSuccesso` di `src/lib/alert.js`, conferme con `CustomConfirm`. Aptica solo da
  `src/lib/aptica.js`.
- Ogni modale nuova ha una X con `aria-label="Chiudi"` (tasto indietro di Android).
- Nessuna libreria in testa a `CreaWorkoutUI.jsx`: deve restare intorno ai 18 KB.
  `index` resta intorno ai 594 KB e `Modelli` si carica pigra.
- Ogni test nuovo si vede prima fallire (rompendo apposta il codice che copre), poi
  passare.

## Review Focus

1. **Un modello inserito due volte nello stesso workout**: i due blocchi devono essere
   indipendenti. Cambiare un esercizio del primo non deve toccare il secondo né il
   modello. Il test va al Task 2.
2. **Un modello Gym salvato dal riscaldamento e inserito nella fase principale**: deve
   finire nella fase da cui è stato aperto il picker, e i suoi esercizi devono avere la
   fase giusta. Il test va al Task 2.
3. **Il builder aperto in modalità modello con un workout lasciato a metà nella bozza**:
   la bozza `fleofit_workout_draft` non deve essere letta, sovrascritta né cancellata. Il
   test va al Task 7.
4. **Un modello con `contenuto` rotto** (scritto a mano o di una versione futura): non
   compare nei fogli né rompe la pagina. Il test va ai Task 2 e 5.
5. **`/modelli?…` e `/create?modello=<id>` aperti da un atleta, o con l'`id` di un modello
   che non c'è più**: l'atleta torna a `/`, l'`id` mancante dà un avviso e il ritorno a
   `/modelli`. Il test va ai Task 6 e 7.

---

### Task 1: La tabella, il backup e l'ambiente di prova

**Files:**
- Create: `supabase/schema/modelli_blocco_2026-10-16.sql`
- Modify: `.github/workflows/db-backup.yml` (`TABLES` e il commento sopra)
- Modify: `src/supabaseDemo.js` (i default in `esegui()`, accanto a `messaggi_coach`)
- Modify: `src/demoSemi.js` (`modelli_blocco()`, `VERSIONE_SEME` 13 → 14, la chiave in `semi()`)

**Interfaces:**
- Produces: la tabella `public.modelli_blocco(id uuid, coach uuid, categoria text, nome text, contenuto jsonb, creato_at timestamptz, modificato_at timestamptz)`.

- [ ] **Step 1: Scrivi il file SQL** con il `create table`, l'indice, la RLS e la policy
  copiati dalla spec §1, preceduti da un'intestazione nello stile di
  `messaggi_coach_2026-10-15.sql`: quinta eccezione, sì del 16/10/2026, additiva, `main`
  non la conosce. In coda la query di verifica, che deve stampare una policy `ALL`:
  `select policyname, cmd from pg_policies where tablename = 'modelli_blocco';`. E il
  rollback commentato: `drop table public.modelli_blocco;`.
- [ ] **Step 2: Applica la migrazione**: `supabase db query --linked -f supabase/schema/modelli_blocco_2026-10-16.sql`,
  poi la query di verifica. Atteso: una riga, `modelli_blocco del coach | ALL`. Se la CLI
  non è collegata, fermati e chiedilo al committente: niente SQL editor a mano senza
  dirlo.
- [ ] **Step 3: Backup.** Aggiungi `modelli_blocco` in coda a `TABLES` (ha `id`, nessun
  suffisso), con una riga di commento come quella di `messaggi_coach`.
- [ ] **Step 4: Ambiente di prova.** In `supabaseDemo.js` i default per `modelli_blocco`
  sono `{ creato_at: now, modificato_at: null }`. In `demoSemi.js` aggiungi
  `modelli_blocco()` con sei modelli del coach `COACH`: due Hyrox (un EMOM 10′ di Wall
  Balls e Burpees, un WarmUp 8:00), due Running (un `repeat` 8 × 400m con rec 1 min, un
  `warmup` 15 min), due Gym (un singolo «Squat con bilanciere» 4 × 8, una superserie
  «Panca piana con bilanciere» + «Rematore con bilanciere»), tutti nel formato della
  spec §5, senza `id` interni. Alza `VERSIONE_SEME` a 14.
- [ ] **Step 5: Verifica** `npm test -- demo` (i test dell'ambiente di prova esistenti) →
  PASS.
- [ ] **Step 6: Commit** dei quattro file: «Modelli di blocco: la tabella, il backup e i semi di prova».

---

### Task 2: La logica pura

**Files:**
- Create: `src/lib/modelliBlocco.js`
- Test: `src/lib/__tests__/modelliBlocco.test.js`

**Interfaces:**
- Produces:
  - `CATEGORIE_MODELLI: string[]` = `['Hyrox', 'Running', 'Gym']`
  - `MAX_NOME = 80`
  - `contenutoDaBlocco(categoria: string, blocco: object): object`: una copia profonda
    senza `id` a nessun livello. Per Gym toglie anche `fase` dal gruppo e dagli esercizi.
  - `bloccoDaModello(modello: {categoria, contenuto}, opzioni?: { fase?: string }): object`:
    `id` nuovi ovunque. Per Gym `fase = opzioni.fase ?? 'principale'` sul gruppo, e gli
    esercizi passano dalla stessa regola di `nuovoEsercizioGym` per la fase, se ne ha una.
  - `nomeProposto(categoria: string, blocco: object): string`: al massimo `MAX_NOME`
    caratteri.
  - `anteprimaModello(modello): string`
  - `modelloValido(modello): boolean`
  - `nomeValido(nome: string): boolean` (da 1 a 80 caratteri dopo il trim)

- [ ] **Step 1: Scrivi i test che falliscono:**
  - `contenutoDaBlocco('Hyrox', blocco)`: nessuna chiave `id` in tutto l'oggetto (una
    visita ricorsiva). Il blocco originale non cambia: `expect(originale).toEqual(copiaPrima)`.
  - Lo stesso per Running (`repeat`) e per Gym con `dettaglio` (nessun `id` nelle righe
    di `dettaglio`, nessuna `fase`).
  - `bloccoDaModello` chiamato due volte sullo stesso modello: gli `id` dei due risultati
    sono tutti diversi, e cambiare `a.exercises[0].name` non cambia né `b` né
    `modello.contenuto` (Review Focus 1).
  - Gym: `bloccoDaModello(m, { fase: 'principale' })` su un gruppo salvato dal
    riscaldamento → `gruppo.fase === 'principale'` (Review Focus 2). Senza `fase`, vale
    `'principale'`.
  - `nomeProposto('Hyrox', { type: 'EMOM', params: { interval: '1:00', rounds: '10' }, exercises: [{name:'Wall Balls'},{name:'Burpees'},{name:'Row'}] })`
    contiene `'EMOM'`, `'Wall Balls'` e `'Burpees'`. Usa `parametriBlocco` di
    `rigaBlocco.js` per i numeri, al massimo due esercizi e poi «…».
  - `nomeProposto('Running', repeat 8 × 400m rec 1 min)` contiene `'8 × 400m'`.
    `nomeProposto('Gym', superserie)` contiene i due nomi uniti da `' + '`.
  - Un nome lungo esce di `MAX_NOME` caratteri esatti e finisce con `'…'`.
  - `modelloValido`: `false` per una categoria `'Custom'`, per un Hyrox senza `type`, per
    un Running senza `type`, per un Gym senza `esercizi` array, per `contenuto` null.
    `true` per i sei modelli dei semi di prova (importati da `demoSemi.js`) (Review Focus 4).
  - `nomeValido('  ')` è false, `nomeValido('x'.repeat(81))` è false,
    `nomeValido('Riscaldamento')` è true.
  - **La regola delle categorie**: legge `CATEGORIE` dal sorgente di `CreateWorkout.jsx?raw`
    come `iaCategorie.test.js`. Ogni categoria tranne `Custom` deve stare in
    `CATEGORIE_MODELLI`, con il messaggio «una categoria con blocchi ha i modelli (spec
    modelli di blocco, decisione 3)».
- [ ] **Step 2:** `npx vitest run src/lib/__tests__/modelliBlocco.test.js` → FAIL (il modulo non esiste).
- [ ] **Step 3: Implementa** le funzioni dell'Interfaces. Per l'anteprima Hyrox riusa
  `sottotitoloBlocco`. Per Gym riusa `serieDi` e `quantoEsercizio` di `gym.js` («4 × 8»).
  Per Running riusa la funzione che la scheda usa già per scrivere una fase, se esiste;
  altrimenti `durata · passo`.
- [ ] **Step 4:** di nuovo il comando → PASS. Rompi apposta `bloccoDaModello` (togli la
  copia profonda) e guarda fallire il test d'indipendenza, poi rimettila.
- [ ] **Step 5: Commit**: «Modelli di blocco: la logica pura».

---

### Task 3: Leggere e scrivere i modelli

**Files:**
- Create: `src/lib/modelliBloccoDb.js`, `src/useModelliBlocco.js`
- Test: `src/lib/__tests__/modelliBloccoDb.test.js`

**Interfaces:**
- Consumes: `modelloValido`, `nomeValido` (Task 2)
- Produces:
  - `elencoModelli(categoria?: string): Promise<Modello[]>`: `select *` da
    `modelli_blocco`, filtrato con `modelloValido` e ordinato nell'app per
    `modificato_at ?? creato_at`, dal più recente (un modello mai modificato ha `modificato_at` null). Rifiuta se c'è un errore.
  - `salvaModello({ coach, categoria, nome, contenuto }): Promise<Modello>`: `insert` con
    `coach` passato esplicitamente (l'ambiente di prova non applica `auth.uid()`),
    `.select().single()`. Rifiuta se `!nomeValido(nome)`.
  - `aggiornaModello(id, { nome?, contenuto? }): Promise<Modello>`: scrive anche
    `modificato_at: new Date().toISOString()`.
  - `eliminaModello(id): Promise<void>`
  - `leggiModello(id): Promise<Modello | null>`: `maybeSingle`, `null` se non c'è o se
    non è valido.
  - `useModelliBlocco(categoria: string | null)` → `{ modelli: Modello[], caricato: boolean, errore: boolean }`:
    legge all'apertura, con `categoria === null` non legge niente.
  - `MESSAGGIO_SENZA_RETE = 'Serve la connessione per salvare un modello.'`

- [ ] **Step 1: Test che falliscono** con `fintoSupabase`: `elencoModelli('Gym')` chiama
  `eq('categoria','Gym')` e scarta una riga con `contenuto: null`; `salvaModello` manda
  `coach`, `categoria`, `nome` trimmato e `contenuto`; `salvaModello` con nome vuoto
  rifiuta **senza** chiamare `insert`; `aggiornaModello` scrive `modificato_at`;
  `elencoModelli` rifiuta con `erroreSu: ['modelli_blocco']`.
- [ ] **Step 2:** `npx vitest run src/lib/__tests__/modelliBloccoDb.test.js` → FAIL.
- [ ] **Step 3: Implementa** le due funzioni di file. L'hook non è testato a sé: lo
  coprono i Task 5 e 6.
- [ ] **Step 4:** → PASS.
- [ ] **Step 5: Commit**: «Modelli di blocco: lettura e scrittura».

---

### Task 4: «Salva come modello» dai blocchi del workout

**Files:**
- Create: `src/components/FoglioModello.jsx` (`FoglioSalvaModello`)
- Modify: `src/pages/CreateWorkout.jsx` (`HyroxBlock`, `RunningStepRow`, lo stato in `CreateWorkout`)
- Modify: `src/components/CreaGym.jsx` (`CardGruppo` e lo stato in `CreaGym`)
- Test: `src/pages/__tests__/ModelliSalva.test.jsx`

**Interfaces:**
- Consumes: `contenutoDaBlocco`, `nomeProposto`, `nomeValido`, `MAX_NOME` (Task 2), `salvaModello`, `MESSAGGIO_SENZA_RETE` (Task 3)
- Produces:
  - `FoglioSalvaModello({ categoria, blocco, onChiudi })`: un foglio in portale con il
    titolo «Salva come modello», il campo «Nome» pieno di `nomeProposto(categoria, blocco)`
    e `maxLength={MAX_NOME}`, e la `CtaPrimaria` «Salva modello», disabilitata se
    `!nomeValido`. Prende `user.id` da `useAuth()`. Se riesce: `vibraSuccesso()`,
    `mostraSuccesso('Lo trovi in «Aggiungi» e in Modelli.', 'Modello salvato')`,
    `onChiudi()`. Se non riesce: `vibraErrore()`,
    `mostraErrore(MESSAGGIO_SENZA_RETE)`, e il foglio resta aperto.
  - una nuova prop `onSalvaModello(blocco)` su `HyroxBlock` e su `RunningStepRow`, e
    `onSalvaModello` su `CardGruppo`.

- [ ] **Step 1: Test che falliscono** (con `vi.mock('../../supabaseClient')` come
  `CreaWorkoutBuilder.test.jsx`, intercettando `insert`):
  - in un workout Hyrox con un blocco EMOM aperto, il bottone
    `aria-label="Salva il blocco come modello"` apre il foglio con il nome proposto.
    «Salva modello» chiama `insert` con `categoria: 'Hyrox'` e un `contenuto` senza `id`;
  - lo stesso su una fase Corsa (`aria-label="Salva la fase come modello"`) e su un gruppo
    Gym (`aria-label="Salva come modello"` dentro `CardGruppo`);
  - con `insert` in errore il foglio resta aperto e compare il messaggio di
    `MESSAGGIO_SENZA_RETE`;
  - `HyroxBlockMemo.test.jsx` e `RunningStepRowMemo.test.jsx` restano verdi: la
    callback passata dal builder è stabile (`useCallback` con dipendenze vuote,
    `setDaSalvare({ categoria, blocco })`).
- [ ] **Step 2:** `npx vitest run src/pages/__tests__/ModelliSalva.test.jsx` → FAIL.
- [ ] **Step 3: Implementa.** In `HyroxBlock` il bottone va nella fila delle azioni
  accanto a «Duplica il blocco», con l'icona `BookmarkPlus` (lucide), e lo stesso in
  `RunningStepRow` accanto a «Duplica la fase». In `CardGruppo` va un'`Azione`
  «Salva come modello» accanto a «Duplica». `CreaGym` tiene da sé lo stato del foglio.
  `CreateWorkout` monta un solo `FoglioSalvaModello` per Hyrox e Corsa.
- [ ] **Step 4:** il test nuovo e i due test `*Memo` → PASS.
- [ ] **Step 5: Commit**: «Modelli di blocco: Salva come modello dai blocchi».

---

### Task 5: «I miei modelli» nei fogli di aggiunta

**Files:**
- Create: `src/components/ModelliUI.jsx`, con `SezioneModelli({ categoria, onScegli })` e `CardModello`
- Modify: `src/pages/CreateWorkout.jsx` (`BlockPickerModal`, `RunningStepPicker`, `aggiungiBlocco`)
- Modify: `src/components/CreaGym.jsx` (`PickerGym`, `aggiungi`)
- Test: `src/pages/__tests__/ModelliInserisci.test.jsx`

**Interfaces:**
- Consumes: `useModelliBlocco` (Task 3), `bloccoDaModello`, `anteprimaModello` (Task 2)
- Produces:
  - `SezioneModelli({ categoria, onScegli(modello) })`: il titolo «I miei modelli», una
    `CardModello` (nome più anteprima, colore della categoria; nella pagina anche la data dell'ultima modifica) per ogni modello, e in
    fondo un link «Gestisci i modelli» → `/modelli?categoria=<categoria>`. Non mostra
    **niente** (`null`) finché non ha caricato, se c'è un errore o se l'elenco è vuoto.
  - `CardModello({ modello, onClick, menu? })`, riusata dalla pagina del Task 6.

- [ ] **Step 1: Test che falliscono:**
  - Hyrox: con due modelli Hyrox e uno Running nel finto database, «Aggiungi Blocco»
    mostra i due Hyrox e non quello Running. Toccarne uno aggiunge un blocco del suo tipo
    in fondo, aperto, **senza** aprire `FoglioParametri`, e gli `id` del blocco aggiunto
    non sono quelli del modello;
  - il «Cambia tipo di blocco» (`BlockPickerModal` con `blocco`) **non** mostra la sezione;
  - Corsa: il foglio della fase in aggiunta mostra i modelli Running, e toccarne uno
    aggiunge la fase. In modifica di una fase esistente (`initialStep`) la sezione non c'è;
  - Gym: «Aggiungi esercizi» della fase principale mostra i modelli Gym, e toccarne uno
    aggiunge un gruppo con `fase: 'principale'`. Dentro una superserie
    («Aggiungi alla superserie») e nel «Cambia» a scelta singola la sezione non c'è;
  - senza modelli, e con `modelli_blocco` in errore, i fogli sono identici a oggi: nessun
    testo «I miei modelli»;
  - un modello con `contenuto: { exercises: [] }` senza `type` non compare (Review Focus 4).
- [ ] **Step 2:** → FAIL.
- [ ] **Step 3: Implementa.** `BlockPickerModal` riceve
  `onModello(modello)`, mostrato solo senza `blocco`. Nel builder diventa
  `m => { setBlockPickerOpen(false); aggiungiBlocco(bloccoDaModello(m)) }`.
  `RunningStepPicker` riceve `onModello` solo quando `!initialStep`, e aggiunge
  `bloccoDaModello(m)` in fondo a `runningSteps`. `PickerGym` riceve `onModello` da
  `CreaGym` solo quando `picker.fase` c'è, e aggiunge
  `bloccoDaModello(m, { fase: picker.fase })` in fondo a `gruppi`.
- [ ] **Step 4:** → PASS, più `CreaWorkoutBuilder.test.jsx` e `HyroxBlock.test.jsx` ancora verdi.
- [ ] **Step 5: Commit**: «Modelli di blocco: I miei modelli nei fogli di aggiunta».

---

### Task 6: La pagina `/modelli`

**Files:**
- Create: `src/pages/Modelli.jsx`
- Modify: `src/App.jsx` (`const Modelli = lazy(...)`, `<Route path="/modelli">` dentro `ProtectedRoute`)
- Modify: `src/components/BarraLaterale.jsx` (`VOCI`: `{ a: '/modelli', icona: LayoutTemplate, etichetta: 'Modelli' }` dopo «Crea workout»)
- Modify: `src/components/CreaWorkoutUI.jsx` (`TestataCrea`: una prop `onModelli`, l'icona `LayoutTemplate` a destra, solo un bottone)
- Modify: `src/pages/CreateWorkout.jsx` (passa `onModelli={() => navigate('/modelli')}` fuori dalla modalità modello)
- Test: `src/pages/__tests__/Modelli.test.jsx`

**Interfaces:**
- Consumes: `elencoModelli`, `aggiornaModello`, `eliminaModello` (Task 3), `CardModello`
  (Task 5), `CATEGORIE_MODELLI`, `nomeValido` (Task 2)
- Produces: la rotta `/modelli?categoria=Hyrox|Running|Gym` (di default `Hyrox`).
  «Nuovo modello» porta a `/create?modello=nuovo&categoria=<c>`, «Modifica» a
  `/create?modello=<id>`.

- [ ] **Step 1: Test che falliscono** (con `montaPagina`, `role: 'admin'`, e
  `fintoSupabase` con tre modelli Hyrox e uno Gym):
  - le schede «Hyrox», «Corsa» e «Gym» (etichette, non `id`). Su Hyrox ci sono tre card,
    dalla modifica più recente; toccando «Gym» ce n'è una;
  - `?categoria=Gym` apre già sulla scheda Gym;
  - una scheda senza modelli mostra «Nessun modello Corsa. Salvane uno da un blocco di un
    workout, o creane uno qui.» e il bottone «Nuovo modello», che porta a
    `/create?modello=nuovo&categoria=Running`;
  - nel menu di una card, «Rinomina» apre un foglio col nome. «Salva» chiama `update`
    con il nome nuovo e la card si aggiorna. Un nome vuoto non si salva;
  - «Elimina» chiede `CustomConfirm` con il testo della spec §5, e confermando chiama
    `delete` e la card sparisce. Con `delete` in errore la card torna e compare
    `mostraErrore` (ottimistico con rollback);
  - montata con `role: 'athlete'` porta a `/` (Review Focus 5).
- [ ] **Step 2:** → FAIL.
- [ ] **Step 3: Implementa** sullo schema di `Messaggi.jsx`: testata sticky con indietro
  (`useIndietro('/create')`) e «+ Nuovo», il toggle segmentato del §6 col colore della
  categoria, l'elenco in `.cascata`, il menu in un foglio (X «Chiudi»), lo stato vuoto
  tratteggiato. La scheda aperta sta nel parametro `categoria` dell'URL (con `replace`),
  così il ritorno dal builder ci riporta lì.
- [ ] **Step 4:** → PASS. `npm run build`: nella lista dei chunk compare `Modelli-*.js`,
  `index` resta intorno ai 594 KB e `CreaWorkoutUI` intorno ai 18 KB.
- [ ] **Step 5: Commit**: «Modelli di blocco: la pagina Modelli».

---

### Task 7: Il builder in modalità modello

**Files:**
- Modify: `src/pages/CreateWorkout.jsx`
- Modify: `src/components/ModelliUI.jsx` (`CampoNomeModello`)
- Test: `src/pages/__tests__/CreaModello.test.jsx`

**Interfaces:**
- Consumes: `leggiModello`, `salvaModello`, `aggiornaModello` (Task 3),
  `bloccoDaModello`, `contenutoDaBlocco`, `nomeProposto`, `nomeValido` (Task 2)
- Produces: `/create?modello=nuovo&categoria=<c>` e `/create?modello=<id>`.

Regole, tutte dalla spec §6:
- `const modello = searchParams.get('modello')`. Con `modello` impostato: `step` parte da
  2 e il passo 1 non si raggiunge (`onTitolo` è null). `category` è quella del parametro
  o del modello letto, e una categoria fuori da `CATEGORIE_MODELLI` porta a `/modelli`.
  Su desktop si usa il layout del telefono centrato (`desktop` vale false in questa
  modalità: niente `CreaWorkoutDesktop`).
- Spariscono: `RiepilogoWorkout`, `CardIntensita`, la previsione, `CardIA` e «Da un testo
  scritto», le note del coach, l'assegnazione, il codice, «Salva workout» e la
  `BarraAzioni` del workout.
- In testa: `CampoNomeModello`, pieno di `nomeProposto` finché il coach non lo scrive
  (lo stesso meccanismo di `nomeFissato`).
- Un solo blocco: con la lista vuota c'è un solo bottone, «Scegli il blocco»
  (Hyrox), «Scegli la fase» (Corsa) o «Scegli gli esercizi» (Gym), che apre il picker di
  oggi. Con un blocco presente i bottoni di aggiunta non si mostrano. Per Gym la scelta
  degli esercizi crea **un** gruppo: con più esercizi scelti diventa una superserie, come
  fa già `PickerGym` dentro un gruppo. In modalità modello i fogli «Aggiungi» non mostrano
  `SezioneModelli`.
- In fondo: `CtaPrimaria` «Salva modello», disabilitata senza blocco o con nome non
  valido. Con `nuovo` fa `salvaModello`, con un `id` fa `aggiornaModello`, poi
  `navigate('/modelli?categoria=<c>', { replace: true })`. Se non riesce compare
  `mostraErrore(MESSAGGIO_SENZA_RETE)` e si resta sulla pagina.
- Bozza: con `modello` impostato **tutti** gli effetti che leggono, scrivono o cancellano
  `fleofit_workout_draft` escono subito. Uscire con modifiche non salvate chiede
  `CustomConfirm` come oggi.
- `leggiModello(id)` torna `null` → `mostraErrore('Questo modello non c\'è più.')` e
  `navigate('/modelli', { replace: true })`.

- [ ] **Step 1: Test che falliscono:**
  - `/create?modello=nuovo&categoria=Hyrox`: non ci sono «Salva workout», la card IA, il
    riepilogo né il passo 1. C'è «Scegli il blocco». Dopo aver scelto un EMOM e
    confermato, «Scegli il blocco» sparisce e «Salva modello» chiama `insert` con
    `categoria: 'Hyrox'` e il nome proposto;
  - con `localStorage.fleofit_workout_draft` già scritto prima del montaggio, dopo aver
    aggiunto un blocco e salvato il modello la bozza è **identica** a prima (Review
    Focus 3);
  - `/create?modello=m1` con un modello Running nel finto database: la fase è caricata
    e il nome è quello salvato. «Salva modello» chiama `update` e non `insert`;
  - `/create?modello=sparito` → avviso «Questo modello non c'è più.» e ritorno a
    `/modelli` (Review Focus 5);
  - `/create?modello=nuovo&categoria=Custom` → ritorno a `/modelli`.
- [ ] **Step 2:** → FAIL.
- [ ] **Step 3: Implementa** con guardie `modello ?` mirate nei punti elencati sopra.
  Niente copia del builder: dove un pezzo sparisce si scrive
  `{!modello && …}`.
- [ ] **Step 4:** → PASS, e tutta la suite del builder ancora verde:
  `npx vitest run src/pages/__tests__/Crea* src/pages/__tests__/Salvataggio* src/pages/__tests__/CodiceTitolo*`.
- [ ] **Step 5: Commit**: «Modelli di blocco: il builder in modalità modello».

---

### Task 8: Documentazione e controlli finali

**Files:**
- Modify: `docs/memoria/crea-workout.md` (nuova sezione «Modelli di blocco (16/10/2026)»)
- Modify: `docs/memoria/database.md` (la tabella, la policy, il backup)
- Modify: `CLAUDE.md` (§0 la quinta eccezione, §4 la riga di `modelli_blocco`, §11
  `modelliBlocco.js`, `Modelli.jsx`, `ModelliUI`, `FoglioModello` nella riga di
  `crea-workout.md`, una regola 5-quater: «ogni categoria con blocchi ha i modelli»)
- Modify: `DEVLOG.md` (novità della 1.2.2), `BACKLOG.md` se resta qualcosa

- [ ] **Step 1:** scrivi la sezione di `crea-workout.md`: il perché delle decisioni
  della spec (database, solo i propri, builder in modalità modello, niente IA lì),
  le trappole (gli `id`, la bozza, la fase Gym), e dove sta ogni pezzo per nome di
  funzione, non per riga.
- [ ] **Step 2:** `npm test` → tutto verde. Annota il numero di test nuovo in CLAUDE.md
  («Stato, in dieci righe»).
- [ ] **Step 3:** `npx eslint src` → nessun problema nei file nuovi o toccati oltre ai 26
  di oggi.
- [ ] **Step 4:** `npm run build` → pesi di `index`, `CreaWorkoutUI`, `WorkoutDetail` e
  `CreateWorkout` nei limiti del §2, e annota se `CreateWorkout` è cresciuto.
- [ ] **Step 5:** `npm run demo`: apri `/modelli`, salva un blocco da un workout, inseriscilo
  da «Aggiungi», crea un modello Gym da zero. Fai uno screenshot di `/modelli`.
- [ ] **Step 6: Commit** dei file di documentazione: «Modelli di blocco: memoria e documentazione».
  Le prove su iPhone e Android le fa il committente (`npm run ios` / `npm run android`).
