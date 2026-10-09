# Dati dalle note — piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trasformare una volta sola le note scritte degli atleti in dati secondo lo standard v1, salvarli nella tabella `note_estratte` e mostrarli in tre grafici («Dalle note») nella scheda atleta, solo coach.

**Architecture:** Una Edge Function `estrai-note` (solo admin, solo Groq) legge le note dal DB con la chiave di servizio, le manda anonime all'IA a gruppi, **valida tutto in `regole.ts`** (puro, testato da vitest) e fa upsert in `note_estratte`. L'app legge la tabella direttamente (RLS solo admin), calcola i grafici con funzioni pure in `src/lib/dalleNote.js` e li disegna in `DalleNoteUI.jsx` (SVG a mano, caricato pigro).

**Tech Stack:** React 19, Vite 8, Tailwind 4, Supabase (Postgres + Edge Functions Deno), Groq `openai/gpt-oss-120b`, vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-09-dati-dalle-note-design.md`

## Global Constraints

- Branch `app`. Niente su `main`. La web app non chiama `estrai-note` né legge `note_estratte`.
- 🔒 **La migrazione si scrive ma NON si applica** finché il committente non sblocca esplicitamente lo schema (CLAUDE.md regola 0-bis). Tutto si sviluppa e si prova con `npm run demo`.
- Standard v1: fattori `stanchezza | motivazione | viaggio | lavoro`; misure `tempo | kg | reps | round | distanza | passo`; unità `s | kg | reps | round | m | s/km`; difficoltà `troppo_facile | giusta | troppo_dura`; modifiche `saltato | ridotto | sostituito | aggiunto`. **Niente dolori, sonno, stress, malattia, ciclo, alimentazione.**
- `versione` = `1`. Gruppi da **15** note, al massimo **3** gruppi per chiamata.
- Solo Groq, **nessuna riserva Gemini**. All'IA vanno solo testo ripulito ed esercizi: niente nome, id, data.
- Ogni voce estratta ha una `citazione` presente nella nota; `valore` lo calcola la funzione da `grezzo`, e `grezzo` deve stare nella citazione.
- Palette invariata (CLAUDE.md §6). Nessuna libreria di grafici. Nessuno zero in pagina: «—» o una frase.
- Lingua dell'interfaccia e dei commenti: italiano. Commenti con la densità e il tono dei file vicini (un blocco «perché» in testa).
- Ogni test nuovo si vede fallire rompendo apposta il codice che copre (CLAUDE.md §9).
- Commit con file aggiunti **per nome**, mai `git add -A`. Messaggi in italiano, chiusi da `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Pesi dei chunk (CLAUDE.md §2): `index` ~594 KB, `WorkoutDetail` ~79 KB, `CreaWorkoutUI` ~18 KB non devono muoversi; `DalleNoteUI` sta in un chunk suo.

## Review Focus

1. **Nota con solo RPE/gradimento** (`[RPE: 7/10]\n[GRADIMENTO: si]`): testo ripulito vuoto → non va all'IA, non conta nella copertura, nessuna riga salvata. → Task 2 (`testoPulito`) e Task 4 (`copertura`).
2. **Nota modificata dopo l'estrazione**: l'impronta cambia → rianalisi; l'estratto vecchio non deve restare visibile come se fosse attuale. → Task 2 (`daEstrarre`) e Task 4 (`estrattiValidi` scarta impronte vecchie).
3. **Assegnazione tornata a «da fare» o nota svuotata**: l'estratto va cancellato, non lasciato orfano. → Task 2 (`daCancellare`).
4. **Numeri all'italiana**: «1,2 km», «9,5kg», «4'55"», «5k», «45 sec» si leggono; «circa sei minuti» no (niente numeri inventati). → Task 2 (`valoreDaGrezzo`).
5. **Groq giù o quota finita a metà**: i gruppi già validati restano salvati, la scheda mostra «analisi sospesa» e non un errore a tutta pagina. → Task 3 (risposta parziale) e Task 6 (stato `sospesa`).

---

### Task 1: La tabella `note_estratte` (scritta, non applicata)

**Files:**
- Create: `supabase/schema/note_estratte_2026-10-09.sql`
- Modify: `supabase/schema/README.md` (una sezione «Migrazioni in attesa»)

**Interfaces:**
- Produces: tabella `public.note_estratte(athlete_workout_id PK, athlete_id, data date, impronta text, versione smallint, estrazione jsonb, creato_at timestamptz)`.

- [ ] **Step 1: Verificare i tipi delle chiavi** — lettura permessa dalla regola 0-bis, nel SQL editor:
  `select table_name, column_name, data_type from information_schema.columns where table_schema='public' and table_name in ('athlete_workouts','athletes') and column_name='id';`
  Atteso: il tipo di `athlete_workouts.id` e di `athletes.id` (presumibilmente `uuid`). Usare quei tipi nel file.

- [ ] **Step 2: Scrivere il file SQL**, in testa il blocco «⚠️ NON APPLICARE senza lo sblocco esplicito del committente» con data e motivo. Contenuto:
  - `create table public.note_estratte` con `athlete_workout_id` PK `references public.athlete_workouts(id) on delete cascade`, `athlete_id not null references public.athletes(id) on delete cascade`, `data date`, `impronta text not null`, `versione smallint not null`, `estrazione jsonb not null`, `creato_at timestamptz not null default now()`.
  - `create index note_estratte_atleta on public.note_estratte (athlete_id, data);`
  - `alter table public.note_estratte enable row level security;`
  - **Una policy `for all`** con `using` **e** `with check` = `(auth.jwt() ->> 'email') = any (array[…])`, con le **5 email** di `supabase/functions/_shared/admin.ts`, nello stesso ordine. Nessuna clausola `auth.uid() = athlete_id`: l'atleta non legge i propri estratti.
  - Il blocco di rollback commentato: `drop table public.note_estratte;`

- [ ] **Step 3: README** — aggiungere «Migrazioni in attesa» con il nome del file, cosa fa, perché la web app non ne è toccata, e chi la applica (committente, SQL editor).

- [ ] **Step 4: Commit**
```bash
git add supabase/schema/note_estratte_2026-10-09.sql supabase/schema/README.md
git commit -m "note_estratte: la migrazione scritta, in attesa dello sblocco"
```

---

### Task 2: Le regole pure di `estrai-note`

**Files:**
- Create: `supabase/functions/estrai-note/regole.ts` (nessun import Deno, come `segnalazione/regole.ts`)
- Test: `src/lib/__tests__/estraiNoteServer.test.js`

**Interfaces:**
- Consumes: `testoNota` di `src/lib/rpe.js` (solo nel test, per l'equivalenza).
- Produces (tutto esportato da `regole.ts`):
  - costanti `VERSIONE = 1`, `GRUPPO = 15`, `MAX_GRUPPI = 3`, `FATTORI`, `MISURE`, `DIFFICOLTA`, `TIPI_MODIFICA` (liste del Global Constraints).
  - `testoPulito(note: string | null): string` — stesso risultato di `testoNota`.
  - `impronta(testo: string): string` — FNV-1a 32 bit, 8 caratteri esadecimali.
  - `eserciziDelWorkout(sections: any): string[]` — nomi unici da `sections.blocks[].exercises[].name` e dal formato legacy (`warmup`, `cashIn`, `main`, `cashOut`, se array con `exercises`); per `category === 'Running'` → `['Corsa']`.
  - `valoreDaGrezzo(misura: string, grezzo: string): { valore: number, unita: string } | null`
  - `validaEstrazione(grezza: unknown, testo: string, esercizi: string[]): Estrazione` dove `Estrazione = { stato: Stato[], risultati: Risultato[], sensazioni: { difficolta, citazione, modifiche: Modifica[] } }`, forme del §3 della spec.
  - `daEstrarre(righe: Riga[], esistenti: { athlete_workout_id, impronta, versione }[]): Riga[]` con `Riga = { id, athlete_id, completed_date, status, notes, workouts: { sections } }` — completate, testo pulito non vuoto, impronta o versione diversa.
  - `daCancellare(righe: Riga[], esistenti): string[]` — id degli estratti la cui assegnazione non è più completata con testo.
  - `richiestaGroq(note: { i: number, testo: string, esercizi: string[] }[], modello: string): object` — corpo OpenAI con `response_format: { type: 'json_object' }`, `temperature: 0`, istruzioni di sistema con lo standard v1 (le liste chiuse, «cita le parole esatte», «grezzo come scritto», «non inventare fattori non citati», niente categorie sanitarie).
  - `rispostaDaGroq(contenuto: string): Map<number, unknown> | null` — legge `{ "note": [{ "i": n, ... }] }`; `null` se il JSON è rotto.

- [ ] **Step 1: Scrivere i test che falliscono** (`describe` per funzione). Asserzioni minime:
```js
expect(testoPulito('[RPE: 7/10]\n[GRADIMENTO: si]')).toBe('')
for (const n of ['[RPE: 8/10]\nwall balls in 6:40', 'solo testo', null, '[RPE: 3/10]\n[GRADIMENTO: no]\nfacile'])
  expect(testoPulito(n)).toBe(testoNota(n))          // stessa regola del telefono
expect(impronta('abc')).toBe(impronta('abc')); expect(impronta('abc')).not.toBe(impronta('abd'))
expect(impronta('abc')).toMatch(/^[0-9a-f]{8}$/)
expect(valoreDaGrezzo('tempo', '6:40')).toEqual({ valore: 400, unita: 's' })
expect(valoreDaGrezzo('tempo', '1:02:30')).toEqual({ valore: 3750, unita: 's' })
expect(valoreDaGrezzo('tempo', '45 sec')).toEqual({ valore: 45, unita: 's' })
expect(valoreDaGrezzo('tempo', '6 min')).toEqual({ valore: 360, unita: 's' })
expect(valoreDaGrezzo('kg', '9,5kg')).toEqual({ valore: 9.5, unita: 'kg' })
expect(valoreDaGrezzo('distanza', '1,2 km')).toEqual({ valore: 1200, unita: 'm' })
expect(valoreDaGrezzo('distanza', '5k')).toEqual({ valore: 5000, unita: 'm' })
expect(valoreDaGrezzo('distanza', '400m')).toEqual({ valore: 400, unita: 'm' })
expect(valoreDaGrezzo('passo', '4:55/km')).toEqual({ valore: 295, unita: 's/km' })
expect(valoreDaGrezzo('passo', `4'55"`)).toEqual({ valore: 295, unita: 's/km' })
expect(valoreDaGrezzo('reps', '15')).toEqual({ valore: 15, unita: 'reps' })
expect(valoreDaGrezzo('tempo', 'circa sei minuti')).toBeNull()
```
  Per `validaEstrazione`, con `testo = 'Wall balls 9kg finite in 6:40, gambe distrutte. Burpees saltati.'` ed `esercizi = ['Wall Balls', 'Burpees']`:
  - un risultato `{ esercizio: 'wall balls', misura: 'tempo', grezzo: '6:40', citazione: 'Wall balls 9kg finite in 6:40' }` → tenuto, con `esercizio: 'Wall Balls'` (nome canonico) e `valore: 400`;
  - la stessa voce con `citazione: 'wall balls in 5:00'` → scartata (citazione assente);
  - `grezzo: '5:00'` con citazione vera → scartata (grezzo non nella citazione);
  - `esercizio: 'Thruster'` → tenuta con `esercizio: null`;
  - `valore: 999` mandato dall'IA → ignorato, resta 400;
  - stato `{ fattore: 'sonno', segno: -1, citazione: 'gambe distrutte' }` → scartato; `{ fattore: 'stanchezza', segno: -1, citazione: 'GAMBE  distrutte' }` → tenuto (confronto senza maiuscole e spazi doppi);
  - `segno: 2` → scartato;
  - modifica `{ tipo: 'saltato', esercizio: 'burpees', citazione: 'Burpees saltati' }` → tenuta con `'Burpees'`;
  - `difficolta: 'troppo_dura'` senza citazione valida → `difficolta: null`;
  - `grezza` non oggetto (`null`, `'x'`) → estrazione vuota `{ stato: [], risultati: [], sensazioni: { difficolta: null, citazione: null, modifiche: [] } }`.
  Per `eserciziDelWorkout`: un Hyrox con due blocchi e un nome ripetuto → nomi unici; un legacy con `main: [{ exercises: [{ name: 'Row' }] }]` → `['Row']`; Running → `['Corsa']`; `null` → `[]`.
  Per `daEstrarre` / `daCancellare`: completata con testo e nessun esistente → da estrarre; stessa impronta e versione → no; impronta diversa → sì; `versione: 0` → sì; `status: 'pending'` → no, e se aveva un estratto è in `daCancellare`; nota con solo RPE → no, e il suo estratto è in `daCancellare`.
  Per `rispostaDaGroq`: `'{"note":[{"i":0}]}'` → mappa con chiave 0; `'non json'` → `null`.
  Per `richiestaGroq`: il testo inviato contiene il testo delle note e gli esercizi, e **non** contiene nessun campo `athlete_id`, `id`, `completed_date` (serializzare il corpo e verificarlo con `not.toMatch`).

- [ ] **Step 2: Lanciare** `npx vitest run src/lib/__tests__/estraiNoteServer.test.js` — atteso: FAIL (modulo mancante).

- [ ] **Step 3: Implementare `regole.ts`.** Il confronto delle citazioni passa da una funzione interna `piana(s)`: minuscole, NFD senza diacritici, spazi compressi, trim; citazione valida se lunga almeno 3 caratteri e `piana(testo).includes(piana(citazione))`. `grezzo` valido se `piana(citazione).includes(piana(grezzo))`. Le regex di `testoPulito` sono le stesse di `rpe.js`/`gradimento.js` (copiate, con un commento che rimanda al test di equivalenza: Deno non può importare `src/lib`).

- [ ] **Step 4: Lanciare il test** — atteso: PASS. Poi rompere apposta `piana` (togliere il lowercase) e verificare che i test sulle citazioni falliscano; ripristinare.

- [ ] **Step 5: Commit**
```bash
git add supabase/functions/estrai-note/regole.ts src/lib/__tests__/estraiNoteServer.test.js
git commit -m "estrai-note: le regole che tengono onesta l'estrazione"
```

---

### Task 3: La Edge Function `estrai-note`

**Files:**
- Create: `supabase/functions/estrai-note/index.ts`, `supabase/functions/estrai-note/deno.json` (copiare la forma da `ricerca-coach/deno.json`)

**Interfaces:**
- Consumes: tutto il Task 2; `isAdminEmail` di `_shared/admin.ts`; `chatGroq`, `MODELLO_GROQ_PREDEFINITO` di `_shared/groq.ts`.
- Produces: `POST { athlete_id: string }` → `{ estratte: number, restano: number, cancellate: number, sospesa: boolean, errore?: string }`. Mai un 500 per un errore dell'IA: `sospesa: true` con 200.

- [ ] **Step 1: Scrivere `index.ts`**, sullo stampo di `ricerca-coach/index.ts` per CORS, utente dal JWT e controllo admin (403 se non admin). Il giro:
  1. client con `SUPABASE_SERVICE_ROLE_KEY`; leggi `athlete_workouts` (`id, athlete_id, completed_date, status, notes, workouts(sections)`) dell'atleta e `note_estratte` (`athlete_workout_id, impronta, versione`) dell'atleta;
  2. `daCancellare` → `delete ... in(...)`;
  3. `daEstrarre` → spezzare in gruppi da `GRUPPO`, al massimo `MAX_GRUPPI`;
  4. per ogni gruppo: `richiestaGroq` con indici locali 0..n, `chatGroq`; se `!ok` o `rispostaDaGroq` torna `null` → `sospesa = true`, **interrompere** (i gruppi già salvati restano);
  5. per ogni nota del gruppo: `validaEstrazione(mappa.get(i), testo, esercizi)`; una nota assente dalla risposta riceve l'estrazione vuota **solo se** la risposta era valida;
  6. `upsert` su `note_estratte` con `onConflict: 'athlete_workout_id'`, campi `athlete_workout_id, athlete_id, data: completed_date, impronta, versione: VERSIONE, estrazione`.
  - Senza `GROQ_API_KEY` → `{ sospesa: true, errore: 'Nessuna chiave IA configurata.' }`.
  - `restano` = da estrarre − estratte in questa chiamata.
  - Log degli errori Groq come `ricerca-coach` (stato e i primi 500 caratteri), **mai il testo delle note**.

- [ ] **Step 2: Controllo dei tipi** — `deno check supabase/functions/estrai-note/index.ts` (se Deno è installato; altrimenti annotarlo nel commit). Atteso: nessun errore.

- [ ] **Step 3: Commit**
```bash
git add supabase/functions/estrai-note/index.ts supabase/functions/estrai-note/deno.json
git commit -m "estrai-note: la Edge Function, solo admin e solo Groq"
```

---

### Task 4: Le funzioni dei grafici e la lettura dal client

**Files:**
- Create: `src/lib/dalleNote.js`, `src/lib/noteEstratte.js`
- Test: `src/lib/__tests__/dalleNote.test.js`, `src/lib/__tests__/noteEstratte.test.js`

**Interfaces:**
- Consumes: `testoNota`, `rpeDichiarato` di `src/lib/rpe.js`; `FATTORI`, `VERSIONE`, `impronta`, `testoPulito` importati da `supabase/functions/estrai-note/regole.ts` (come fa `segnalazione.js` con le sue regole: una sola copia della regola per telefono e server).
- Produces:
  - `noteEstratte.js`: `leggiEstratti(athleteId) → Promise<{ dati: Riga[], errore: boolean }>` (`supabase.from('note_estratte').select('athlete_workout_id, data, impronta, versione, estrazione').eq('athlete_id', id)`); `estraiMancanti(athleteId) → Promise<{ estratte, restano, sospesa }>` (`supabase.functions.invoke('estrai-note', { body: { athlete_id } })`; errore di rete → `{ estratte: 0, restano: null, sospesa: true }`).
  - `dalleNote.js`:
    - `FINESTRE = [30, 90, 365]`, `FINESTRA_INIZIALE = 90`
    - `estrattiValidi(estratti, workouts)` — tiene solo gli estratti la cui impronta coincide con quella della nota attuale (si importa `impronta` e `testoPulito` da `regole.ts`) e con `versione === VERSIONE`.
    - `copertura(workouts, estratti) → { totali, analizzate, inAttesa }` — totali = completate con `testoNota` non vuoto.
    - `nellaFinestra(estratti, giorni, oggi)` — per `data`, estremi inclusi.
    - `serieRisultati(estratti) → { chiave, esercizio, misura, unita, punti: { data, valore, citazione, awId }[], scarto: number | null, migliorato: boolean | null }[]` — raggruppati per `esercizio + misura` (esercizio `null` → etichetta della misura sola), punti in ordine di data, `scarto` = ultimo − penultimo, `migliorato` = scarto < 0 per `tempo`/`passo`, > 0 per le altre; con un solo punto `scarto` e `migliorato` sono `null`. Ordinate per numero di punti, poi per data dell'ultimo.
    - `settimaneSensazioni(estratti, giorni, oggi) → { settimana: 'yyyy-MM-dd' (lunedì), troppo_facile, giusta, troppo_dura }[]` — solo settimane con almeno una difficoltà; `weekStartsOn: 1`.
    - `modificheFrequenti(estratti) → { esercizio, tipo, volte, citazioni: { data, testo, awId }[] }[]` — esercizio `null` escluso, ordinate per `volte`.
    - `righeStato(estratti, workouts, giorni, oggi) → { fattore, giorni: { data, segno, citazione }[], durissime: string[] }[]` — solo fattori citati almeno una volta, nell'ordine di `FATTORI`; `durissime` = date nella finestra con `rpeDichiarato ≥ 8`.
    - `formattaValore(valore, unita) → string` — `400,'s'` → `'6:40'`; `3750,'s'` → `'1:02:30'`; `295,'s/km'` → `'4:55 /km'`; `1200,'m'` → `'1,2 km'`; `400,'m'` → `'400 m'`; `9.5,'kg'` → `'9,5 kg'`; `15,'reps'` → `'15'`.

- [ ] **Step 1: Scrivere i test che falliscono.** Oltre a un caso per ogni riga qui sopra:
  - `serieRisultati` con un solo punto → `scarto: null`, `migliorato: null` (niente linea da un punto);
  - tempo 420 → 400 → `migliorato: true`; kg 9 → 8 → `migliorato: false`;
  - `righeStato` senza voci → `[]` (nessun fattore a zero);
  - `copertura` con una nota solo-RPE → non conta nei totali;
  - `estrattiValidi` con nota modificata dopo l'estrazione → l'estratto sparisce;
  - `nellaFinestra(…, 30)` esclude un estratto di 31 giorni fa;
  - `noteEstratte`: con `functions.invoke` che risolve `{ error: {} }` → `sospesa: true`; con `select` che torna errore → `{ dati: [], errore: true }`.

- [ ] **Step 2: Lanciare** `npx vitest run src/lib/__tests__/dalleNote.test.js src/lib/__tests__/noteEstratte.test.js` — atteso: FAIL.

- [ ] **Step 3: Implementare** i due file. Date con `date-fns` (`parseISO`, `startOfWeek` con `weekStartsOn: 1`, `differenceInCalendarDays`).

- [ ] **Step 4: Lanciare i test** — atteso: PASS. Rompere apposta il verso di `migliorato` per `tempo` e vedere il test fallire; ripristinare.

- [ ] **Step 5: Commit**
```bash
git add src/lib/dalleNote.js src/lib/noteEstratte.js src/lib/__tests__/dalleNote.test.js src/lib/__tests__/noteEstratte.test.js
git commit -m "Dalle note: i calcoli dei grafici e la lettura degli estratti"
```

---

### Task 5: Il componente `DalleNoteUI`

**Files:**
- Create: `src/components/DalleNoteUI.jsx`
- Test: `src/components/__tests__/DalleNoteUI.test.jsx`

**Interfaces:**
- Consumes: Task 4.
- Produces: `export default function DalleNoteUI({ nome, workouts, estratti, stato, onApriWorkout })` con `stato: 'pronto' | 'in_analisi' | 'sospesa' | 'errore'` e `onApriWorkout(awId)`. Gestisce da sé la finestra (30/90/365, iniziale 90).

- [ ] **Step 1: Scrivere i test che falliscono:**
  - intestazione «Dalle note» e la finestra «90 giorni» selezionata;
  - copertura: con 41 note di cui 38 estratte → testo `38 note analizzate su 41 · 3 in analisi`; con `stato: 'sospesa'` → contiene `analisi sospesa`;
  - nessuna nota nel periodo → `Sofia non ha scritto note in questo periodo` e nessuna card;
  - risultati con un solo punto → `6:40 · 9 ott, unico dato` e nessun `polyline`;
  - risultati con due punti → un `svg` con `role="img"` e `aria-label` che contiene i due valori formattati;
  - card vuote → `Nessun risultato nelle note degli ultimi 90 giorni` (e analoghe per sensazioni e stato); nessun testo `0` isolato nella sezione;
  - cambio finestra a 30 → l'estratto di 60 giorni fa esce;
  - tocco su una modifica frequente → compaiono le citazioni con data; tocco su una citazione → `onApriWorkout` con l'`awId`.

- [ ] **Step 2: Lanciare** `npx vitest run src/components/__tests__/DalleNoteUI.test.jsx` — atteso: FAIL.

- [ ] **Step 3: Implementare.** Stampo visivo di `SchedaAtletaUI.jsx` (`CardAndamento`, `Sparkline`: card `bg-[#1e1e1e] border border-[#2a2a2a] rounded-3xl`, SVG a mano con `role="img"`). Ordine: copertura, **Risultati**, **Sensazioni** (barre impilate per settimana + «Modificati più spesso»), **Stato** (strisce per giorno, tacca sui giorni durissimi). Colori: verde/giallo/arancione/rosso della scala di `getRpeColor` in `src/components/RpeModal.jsx` per difficoltà (giusta = verde, troppo facile = giallo, troppo dura = rosso) e segno (+1 verde, 0 grigio `#444`, −1 arancione); accenti `brand`. Selettore finestra = toggle segmentato del §6 di CLAUDE.md. Nessun import pesante (niente `jspdf`, `html-to-image`, librerie).

- [ ] **Step 4: Lanciare i test** — atteso: PASS. Rompere apposta la soglia «almeno 2 punti» e vedere fallire il test del punto singolo; ripristinare.

- [ ] **Step 5: Commit**
```bash
git add src/components/DalleNoteUI.jsx src/components/__tests__/DalleNoteUI.test.jsx
git commit -m "Dalle note: le tre card della scheda atleta"
```

---

### Task 6: Nella scheda atleta, solo per il coach

**Files:**
- Modify: `src/pages/AthleteDetail.jsx` (fra il bento e `RigaObiettivo`)
- Test: `src/pages/__tests__/SchedaAtletaDalleNote.test.jsx`

**Interfaces:**
- Consumes: `leggiEstratti`, `estraiMancanti`, `estrattiValidi`, `copertura` (Task 4); `DalleNoteUI` (Task 5).

- [ ] **Step 1: Scrivere i test che falliscono** (stampo di `AthleteDetailPausa.test.jsx`, `fintoSupabase` con tabella `note_estratte`):
  - come coach → compare «Dalle note»;
  - come atleta su `/profile` → **non** compare, e `functions.invoke` non è chiamata con `'estrai-note'`, e `note_estratte` non è letta;
  - coach con note mancanti → `invoke('estrai-note', { body: { athlete_id } })` chiamata **una volta**, poi una seconda lettura della tabella;
  - coach senza note mancanti → `invoke` non chiamata;
  - `invoke` che risponde `{ sospesa: true }` → la scheda resta intera e la sezione mostra `analisi sospesa`.

- [ ] **Step 2: Lanciare** `npx vitest run src/pages/__tests__/SchedaAtletaDalleNote.test.jsx` — atteso: FAIL.

- [ ] **Step 3: Implementare.** `const DalleNoteUI = lazy(() => import('../components/DalleNoteUI'))` (come `RicercaCoach` in `Home.jsx`), dentro `<Suspense fallback={null}>`, montata solo se `role !== 'athlete'`. Un effetto sull'`id` dell'atleta: `leggiEstratti` → se `copertura(...).inAttesa > 0` allora `estraiMancanti` → nuova `leggiEstratti`; stato `'in_analisi'` durante, `'sospesa'` se la funzione lo dice, `'errore'` se la lettura fallisce; un flag di annullamento all'unmount. `onApriWorkout(awId)` naviga come le righe dello storico (`/workout/<workoutId>?athlete_id=<id>`).

- [ ] **Step 4: Lanciare i test** della pagina e le suite vicine: `npx vitest run src/pages/__tests__/SchedaAtleta*.test.jsx src/pages/__tests__/AthleteDetailPausa.test.jsx` — atteso: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/pages/AthleteDetail.jsx src/pages/__tests__/SchedaAtletaDalleNote.test.jsx
git commit -m "Scheda atleta: la sezione «Dalle note», solo per il coach"
```

---

### Task 7: Ambiente di prova, verifica a schermo, pesi, documentazione

**Files:**
- Modify: `src/demoSemi.js` (note ricche su 3 atleti + righe `note_estratte`; alzare `VERSIONE_SEME` a 6), `src/supabaseDemo.js` (`invoke('estrai-note')` → `{ estratte: 0, restano: 0, sospesa: false }`)
- Modify: `docs/memoria/scheda-atleta.md` (sezione nuova), `docs/memoria/database.md` (tabella, funzione), `CLAUDE.md` §4 (una riga nella tabella: `note_estratte`, in attesa) e §11 (i file nuovi → `scheda-atleta.md`), `BACKLOG.md` (voci aperte: applicare la migrazione, deploy, ZDR/DPA Groq, v2 con dolori, note vocali)

- [ ] **Step 1: Semi.** Gli estratti dei semi passano da `validaEstrazione` di `regole.ts` (costruiti con le citazioni vere delle note dei semi), così la demo non mostra niente che la funzione scarterebbe. Almeno: un atleta con una serie «Wall Balls · tempo» di 3 punti, uno con sensazioni su 4 settimane e due modifiche ripetute, uno con «stanchezza» su più giorni di cui uno a RPE ≥ 8.

- [ ] **Step 2: Verifica a schermo** — `npm run demo`, aprire la scheda dei tre atleti a 375px e su desktop: le tre card, la finestra, gli stati vuoti su un atleta senza note; poi `npm run demo:atleta` → la sezione non c'è. Screenshot come prova.

- [ ] **Step 3: Suite, lint, build e pesi**
  - `npm test` → tutto verde (oggi 1202 test più i nuovi);
  - `npx eslint src` → non più dei 26 problemi di oggi;
  - `npm run build` → `DalleNoteUI-*.js` in un chunk suo; `index` ~594 KB e `WorkoutDetail` ~79 KB invariati.

- [ ] **Step 4: Documentazione**, con le regole dei file esistenti (note nuove nel file dell'argomento, non in CLAUDE.md, salvo la riga del §4 e del §11).

- [ ] **Step 5: Commit**
```bash
git add src/demoSemi.js src/supabaseDemo.js docs/memoria/scheda-atleta.md docs/memoria/database.md CLAUDE.md BACKLOG.md
git commit -m "Dalle note: ambiente di prova e memoria"
```

---

### Task 8 (gated, lo fa il committente): rilascio

Non si esegue senza il via esplicito del committente. Ogni passo è suo o va confermato.

- [ ] **Step 1:** Sblocco esplicito dello schema per **questa** migrazione → annotarlo in `CLAUDE.md` §0 regola 0-bis con data.
- [ ] **Step 2:** GroqCloud → Data Controls → **Zero Data Retention**; lettura di Services Agreement e DPA (no training sui dati dei clienti). Annotare l'esito in `BACKLOG.md`.
- [ ] **Step 3:** Applicare `supabase/schema/note_estratte_2026-10-09.sql` nel SQL editor; verificare con `select policyname, cmd from pg_policies where tablename = 'note_estratte';` (una policy, `ALL`).
- [ ] **Step 4:** `supabase functions deploy estrai-note`.
- [ ] **Step 5:** Set di prova: ~25 note realistiche (abbreviazioni, refusi, frasi miste) con l'estrazione attesa scritta a mano, chiamando la funzione su un atleta di prova; annotare quante voci giuste, sbagliate, mancanti in `docs/memoria/scheda-atleta.md`. Non è un test della suite: la risposta dell'IA non è deterministica.
- [ ] **Step 6:** `npm run ios` / `npm run android` e prova su un atleta vero dal telefono del coach.
