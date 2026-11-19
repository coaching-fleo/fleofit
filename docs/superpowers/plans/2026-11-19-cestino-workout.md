# Cestino dei workout — piano di lavoro

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** un workout eliminato (da qualunque app e da chiunque) finisce in un cestino per 14 giorni. Lì il coach che l'ha creato lo vede e lo ripristina, scegliendo a spunte cosa riportare indietro.

**Architecture:** il lavoro lo fa il database. Un trigger `before delete` su `workouts` copia in `cestino_workout` (jsonb) il workout e tutto ciò che gli è attaccato. Due RPC `security definer` (`cestino_voci`, `ripristina_workout`) leggono e rimettono. Un cron svuota il cestino dopo 14 giorni. L'app aggiunge la pagina `/cestino`, la voce nella Libreria e il foglio a spunte. Le app vecchie non cambiano e sono protette lo stesso.

**Tech Stack:** Postgres/Supabase (plpgsql, RLS, pg_cron), React 19, Vitest, `src/test/fintoSupabase.js`.

**Spec:** `docs/superpowers/specs/2026-11-19-cestino-workout-design.md` (approvato dal committente il 19/11/2026).

## Global Constraints

- **Schema congelato** (CLAUDE.md §0, 0-bis). La migrazione si **scrive** nel Task 1. Si **applica** solo dopo un «sì» esplicito del committente in sessione (Task 2): è la quattordicesima eccezione.
- La migrazione è **additiva**: una tabella, funzioni nuove, un trigger, un cron. **Nessuna** policy o funzione esistente cambia, `garmin_avvisa` compresa.
- Entrano nel cestino i workout con `creato_da` **staff** oppure **null**. Non ci entrano quelli con `creato_da` di un non-staff (gli allenamenti liberi, compresi quelli di Garmin).
- Durata: **14 giorni** da `eliminato_il`. Cron giornaliero `svuota-cestino-workout` alle **00:10 UTC**.
- **Nessuno svuota a mano**: niente «Elimina definitivamente», nessuna policy di delete per il client.
- Il ripristino **non invia notifiche**. Rimette il workout **con lo stesso `id`**. Il reinvio a Garmin dal trigger esistente è voluto.
- La riga del cestino la vede chi è `creato_da`, se è ancora staff. Se `creato_da` è null o non è più staff, la vedono gli admin.
- Interfaccia in italiano. Modali con `createPortal`. Aptica solo da `src/lib/aptica.js`. Nessun `alert()`.
- La voce Cestino e la pagina si nascondono, senza errori, se la tabella non c'è (`42P01`, `PGRST205`).
- Le note vocali non si cancellano: restano orfane come oggi (voce in BACKLOG).

## Review Focus

1. **Eliminazione da un'app vecchia** (1.2.4, sito): passa da `workouts.delete()` e deve finire nel cestino comunque. Lo verifica `tools/verifica-cestino.sql`, caso «delete diretto».
2. **Allenamento libero dell'atleta eliminato**: non deve comparire nel cestino di nessuno. Caso SQL «libero fuori» più il test di `finisceNelCestino`.
3. **Un coach prova a ripristinare il cestino di un altro coach** chiamando la RPC a mano: deve fallire. Caso SQL «altro coach».
4. **Doppio tocco su «Ripristina»**: la seconda chiamata trova la riga già tolta. Deve dare un errore leggibile, non un 500 muto né un doppione. Caso SQL «due volte» più il test del foglio (bottone disattivato mentre lavora).
5. **Niente spuntato**: torna il workout solo, senza assegnazioni e senza notifiche. Caso SQL «solo workout» più il test della pagina.

---

### Task 1: La migrazione e la sua verifica (scritte, NON applicate)

**Files:**
- Create: `supabase/schema/cestino_workout_2026-11-19.sql`
- Create: `tools/verifica-cestino.sql`

**Interfaces:**
- Produces (SQL, schema `public`):
  - tabella `cestino_workout(id uuid pk default gen_random_uuid(), workout_id uuid not null unique, titolo text not null, data_workout date, creato_da uuid, eliminato_da uuid default auth.uid(), eliminato_da_nome text, eliminato_il timestamptz not null default now(), copia jsonb not null)`, indice su `creato_da`, RLS accesa;
  - `cestino_staff(u uuid) returns boolean`: `stable security definer set search_path = ''`, come `utente_admin` ma `ruolo in ('admin','coach')`;
  - `cestino_mio(creato uuid) returns boolean`: `creato = auth.uid() and e_staff()` quando `creato` non è null ed è `cestino_staff`, altrimenti `e_admin()`;
  - policy unica `select` per `authenticated`: `using (public.cestino_mio(creato_da))`. Nessuna policy di insert, update o delete;
  - trigger `cestino_workout_copia` `before delete on workouts for each row` → funzione `cestino_copia()`. Se `old.creato_da is null or cestino_staff(old.creato_da)` inserisce la riga; sempre `return old`. `eliminato_da_nome` = `athletes.name` di `auth.uid()`, se no la parte prima della `@` dell'email in `auth.users`, se no null (eliminazione dal SQL editor o da un servizio). Se l'insert fallisce, l'eccezione blocca la delete;
  - `copia` jsonb con le chiavi `workout` (la riga), `assegnazioni` (righe `athlete_workouts`, ognuna con le sue `note_estratte` e `scarpe_uso`, l'id della `garmin_attivita` abbinata e il `nome_atleta` letto da `athletes.name`), `sfide` (righe `team_sfide`, ognuna con i suoi `team_risultati` e il `nome_team`), `team_evento` (id dei `team` con `evento_id = old.id`), `workout_logs`;
  - `cestino_voci(c uuid) returns jsonb`: errore `P0002 'cestino: non trovato'` se la riga non c'è o `not cestino_mio(...)`. Restituisce un array di oggetti:
    - assegnazioni: `{tipo:'assegnazione', id, atleta, stato, data, notes, nota_vocale bool, ripristinabile bool, motivo text|null}`. Motivo `'atleta eliminato'` se l'atleta manca o ha `deleted_at`; `'non è più tra i tuoi atleti'` se `not (e_admin() or mio_atleta(athlete_id))`;
    - sfide: `{tipo:'sfida', id, team, metrica, ripristinabile, motivo}`. Motivo `'team sciolto'` se il team non c'è;
  - `ripristina_workout(c uuid, assegnazioni uuid[], sfide uuid[]) returns uuid` (l'id del workout), `security definer`:
    - stesso controllo di `cestino_voci`; `'cestino: id occupato'` se il workout esiste già;
    - inserisce il workout;
    - per ogni assegnazione spuntata **e** ripristinabile inserisce la riga (stesso id), le `note_estratte`, la `scarpe_uso` se la scarpa esiste ancora, i `workout_logs` di quell'atleta, e riaggancia `garmin_attivita.athlete_workout_id` dove è ancora null;
    - per ogni sfida spuntata con il team esistente: insert con `chiusa_il` null, poi i risultati degli atleti che esistono ancora, poi `update chiusa_il`;
    - riaggancia `team.evento_id` dove è null;
    - cancella la riga del cestino;
  - `revoke execute ... from public, anon; grant execute ... to authenticated` sulle tre funzioni chiamabili;
  - cron `svuota-cestino-workout`, `'10 0 * * *'`: `delete from public.cestino_workout where eliminato_il < now() - interval '14 days'`.

- [ ] **Step 1: Scrivere `tools/verifica-cestino.sql`** sul modello di `tools/verifica-team.sql` (utenti finti con `pg_temp.come`, eccezione sentinella che annulla tutto). Casi, ognuno con il suo `FALLITO: <caso>`:
  - «delete diretto»: il coach elimina un suo workout con due assegnazioni → una riga nel cestino, `jsonb_array_length(copia->'assegnazioni') = 2`, il workout non c'è più;
  - «libero fuori»: un workout con `creato_da` = un atleta, eliminato → nessuna riga nel cestino;
  - «senza autore agli admin»: `creato_da` null → la vede un admin, non la vede un coach;
  - «altro coach»: il coach B chiama `ripristina_workout` sulla riga del coach A → errore;
  - «solo workout»: `ripristina_workout(c, '{}', '{}')` → il workout torna con lo stesso id, zero `athlete_workouts`, zero righe nuove in `notifications`, la riga del cestino sparisce;
  - «a spunte»: si ripristina una sola delle due assegnazioni → torna solo quella, con `notes` e `voice_note_url` uguali a prima;
  - «due volte»: la seconda chiamata dà `cestino: non trovato`;
  - «atleta di un altro»: l'assegnazione di un atleta spostato in `coach_atleti` esce `ripristinabile = false` da `cestino_voci` e la `ripristina_workout` la salta;
  - «sfida chiusa»: una sfida con `chiusa_il` e due risultati torna chiusa con i due risultati;
  - «nessun delete dal client»: `delete from cestino_workout` come coach tocca 0 righe.
  Alla fine: `TUTTI I CONTROLLI DEL CESTINO SONO PASSATI`.
- [ ] **Step 2: Scrivere la migrazione** con l'intestazione nello stile di `gruppi_atleti_2026-11-16.sql`: data, «sì ESPLICITO del committente in sessione», quattordicesima eccezione, «additiva», applicazione a mano. Tutto dentro `begin; … commit;`, il cron compreso.
- [ ] **Step 3: Rileggere la migrazione riga per riga contro le Global Constraints.** Controllare in particolare che nessun `create or replace` tocchi una funzione esistente: `grep -n "create or replace function" supabase/schema/cestino_workout_2026-11-19.sql` deve elencare solo `cestino_*` e `ripristina_workout`.
- [ ] **Step 4: Commit**
```bash
git add supabase/schema/cestino_workout_2026-11-19.sql tools/verifica-cestino.sql
git commit -m "Cestino dei workout: migrazione e verifica (da applicare)"
```

### Task 2: Applicare la migrazione (solo con il sì del committente)

**Interfaces:** Consumes: i due file del Task 1.

- [ ] **Step 1: Chiedere il sì esplicito** al committente, dicendo cosa fa la migrazione in tre righe. Senza sì il task si ferma qui: l'app resta corretta, perché nasconde tutto quando la tabella non c'è.
- [ ] **Step 2: Applicare**: `supabase db query --linked -f supabase/schema/cestino_workout_2026-11-19.sql` (come per `come_stai`), oppure a mano dal SQL editor se il committente preferisce.
- [ ] **Step 3: Verificare**: incollare `tools/verifica-cestino.sql` nel SQL editor. Atteso: `TUTTI I CONTROLLI DEL CESTINO SONO PASSATI`. Poi `select jobname, schedule from cron.job where jobname = 'svuota-cestino-workout'` → una riga, `10 0 * * *`.
- [ ] **Step 4: Registrare** in CLAUDE.md §0 (0-bis) la quattordicesima eccezione con la data di applicazione. Commit.

### Task 3: Logica pura `src/lib/cestino.js`

**Files:**
- Create: `src/lib/cestino.js`
- Test: `src/lib/__tests__/cestino.test.js`

**Interfaces:**
- Produces:
  - `GIORNI_CESTINO = 14`;
  - `giorniRimasti(eliminatoIl: string, ora: Date = new Date()) -> number`: giorni interi prima della cancellazione, minimo 0;
  - `rigaCestino(riga, ora?) -> { titolo, dataWorkout: string|null, eliminato: string, scade: string }`. `eliminato` vale `'eliminato da <eliminato_da_nome> il <d MMM, HH:mm>'` (date-fns, locale `it`), oppure `'eliminato il <…>'` se il nome manca. `scade` vale `'si cancella oggi'`, `'si cancella domani'` o `'si cancella tra N giorni'`. Il titolo arriva pulito da `separaCodice`;
  - `etichettaVoce(voce) -> { titolo: string, dettaglio: string }`. Per un'assegnazione: titolo = nome dell'atleta, dettaglio = `'da fare'` o `'completato'`, più `', RPE n'` se `rpeDichiarato(voce.notes)` non è null e `', nota vocale'` se `voce.nota_vocale`. Per una sfida: titolo = `'Sfida · ' + team`, dettaglio = metrica;
  - `spunteIniziali(voci) -> Set<string>`: gli `id` delle voci ripristinabili;
  - `finisceNelCestino(workout, idAtletiAssegnati: string[]) -> boolean`: false se `workout.creato_da` è fra gli atleti assegnati (allenamento libero), true altrimenti, null compreso.

- [ ] **Step 1: Scrivere i test che falliscono**
```js
expect(giorniRimasti('2026-11-05T10:00:00Z', new Date('2026-11-19T09:00:00Z'))).toBe(0)
expect(giorniRimasti('2026-11-18T16:29:00Z', new Date('2026-11-19T11:00:00Z'))).toBe(13)
expect(rigaCestino({ titolo: 'SkiErg Tempo · FT+FT 155′ @6', eliminato_il: '2026-11-18T16:29:00Z', data_workout: '2026-11-16' }, new Date('2026-11-19T11:00:00Z')).scade).toBe('si cancella tra 13 giorni')
expect(etichettaVoce({ tipo: 'assegnazione', atleta: 'Lara', stato: 'completed', notes: 'ok [RPE: 7/10]', nota_vocale: true }))
  .toEqual({ titolo: 'Lara', dettaglio: 'completato, RPE 7, nota vocale' })
expect(etichettaVoce({ tipo: 'assegnazione', atleta: 'Vittoria', stato: 'pending', notes: null, nota_vocale: false }).dettaglio).toBe('da fare')
expect([...spunteIniziali([{ id: 'a', ripristinabile: true }, { id: 'b', ripristinabile: false }])]).toEqual(['a'])
expect(finisceNelCestino({ creato_da: 'at1' }, ['at1'])).toBe(false)
expect(finisceNelCestino({ creato_da: null }, ['at1'])).toBe(true)
expect(finisceNelCestino({ creato_da: 'coach' }, ['at1'])).toBe(true)
```
- [ ] **Step 2:** `npx vitest run src/lib/__tests__/cestino.test.js` → FAIL (modulo assente).
- [ ] **Step 3: Implementare** le funzioni in `src/lib/cestino.js`.
- [ ] **Step 4:** stesso comando → PASS. Poi **rompere apposta** `finisceNelCestino` (togliere il controllo) e vedere il test fallire. Rimettere.
- [ ] **Step 5: Commit** `src/lib/cestino.js` e il suo test.

### Task 4: Accesso ai dati `src/lib/cestinoDb.js`

**Files:**
- Create: `src/lib/cestinoDb.js`
- Test: `src/lib/__tests__/cestinoDb.test.js` (stile di `gruppiAtletiDb.test.js`, con `fintoSupabase`)

**Interfaces:**
- Consumes: le RPC e la tabella del Task 1.
- Produces:
  - `elencoCestino() -> Promise<{ disponibile: boolean, righe: object[] }>`: select `id, workout_id, titolo, data_workout, creato_da, eliminato_da, eliminato_da_nome, eliminato_il` (mai `copia`), ordinato da `eliminato_il` decrescente; tabella assente → `{ disponibile: false, righe: [] }`;
  - `vociCestino(id: string) -> Promise<object[]>`: `supabase.rpc('cestino_voci', { c: id })`;
  - `ripristinaWorkout(id: string, { assegnazioni: string[], sfide: string[] }) -> Promise<string>`: `supabase.rpc('ripristina_workout', { c: id, assegnazioni, sfide })`, restituisce l'id del workout. Un errore con messaggio `cestino: non trovato` diventa `Error('Questo workout è già stato ripristinato o non è più nel cestino.')`; `cestino: id occupato` diventa `Error('Esiste già un workout con questo identificativo.')`. Gli altri errori passano così come sono.

- [ ] **Step 1: Test che falliscono**: tabella assente (codice `PGRST205`) → `disponibile: false` senza throw; ordine per `eliminato_il` decrescente; la select non chiede `copia`; `ripristinaWorkout` passa gli array esattamente come ricevuti (anche vuoti); l'errore `cestino: non trovato` diventa il messaggio in italiano.
- [ ] **Step 2:** `npx vitest run src/lib/__tests__/cestinoDb.test.js` → FAIL.
- [ ] **Step 3: Implementare.**
- [ ] **Step 4:** → PASS. Rompere apposta la traduzione dell'errore, vedere fallire, rimettere.
- [ ] **Step 5: Commit.**

### Task 5: Pagina Cestino, foglio di ripristino, voce nella Libreria

**Files:**
- Create: `src/pages/Cestino.jsx` (dati e azioni), `src/components/CestinoUI.jsx` (lista, sola presentazione), `src/components/FoglioRipristino.jsx` (bottom sheet con `useBottomSheet`)
- Modify: `src/App.jsx` (`const Cestino = lazy(() => import('./pages/Cestino'))` e `<Route path="/cestino" …>` accanto a `/modelli`), `src/pages/Libreria.jsx` (voce Cestino)
- Test: `src/pages/__tests__/Cestino.test.jsx`, `src/pages/__tests__/Libreria.test.jsx` (estendere)

**Interfaces:**
- Consumes: Task 3 (`rigaCestino`, `etichettaVoce`, `spunteIniziali`), Task 4 (`elencoCestino`, `vociCestino`, `ripristinaWorkout`).
- Produces: rotta `/cestino` (atleta → `<Navigate to="/" replace />`, come `Libreria`). `FoglioRipristino` riceve `{ riga, voci, onChiudi, onRipristina(assegnazioni, sfide) }`.

Comportamento fissato dalla spec:
- la lista mostra, per ogni riga: titolo, data del workout, `eliminato` e `scade` (da `rigaCestino`). Lista vuota → stato vuoto tratteggiato «Il cestino è vuoto», con la riga «I workout eliminati restano qui 14 giorni»;
- il foglio ha il titolo `Ripristina «<titolo>»`, una casella «Seleziona tutto», una casella per voce, tutte spuntate all'apertura (`spunteIniziali`). Una voce non ripristinabile compare spenta, senza casella, con il `motivo`. Bottoni «Annulla» e «Ripristina»;
- «Seleziona tutto» spunta o toglie tutte le voci ripristinabili; si spunta da solo quando sono spuntate tutte;
- «Ripristina» è disattivato mentre lavora. Se va a buon fine: `vibraSuccesso()`, la riga sparisce dalla lista, si naviga a `/workout/<id>`. Se fallisce: `CustomAlert` con il messaggio di `ripristinaWorkout`;
- Libreria: voce fissa `{ id: 'cestino', nome: 'Cestino', icona: Trash2, rotta: '/cestino' }` dopo Modelli. Dettaglio `'N workout'`, oppure `'Vuoto'`. La voce compare **solo** se `elencoCestino()` risponde `disponibile: true`. La Libreria chiede l'elenco dopo il montaggio, come fa già per le righe degli extra, senza ritardare il primo disegno.

- [ ] **Step 1: Test che falliscono** (con `montaPagina` e `fintoSupabase`, `rpc:cestino_voci` e `rpc:ripristina_workout`):
  - `Cestino.test.jsx`:
    - mostra «SkiErg Tempo» e «si cancella tra 13 giorni»;
    - il tocco apre il foglio con Vittoria e Lara spuntate e «Lorenzo» spento con «non è più tra i tuoi atleti»;
    - togliere «Seleziona tutto» e premere Ripristina chiama `ripristina_workout` con `assegnazioni: []` e `sfide: []` (Review Focus 5);
    - con una sola voce tolta, gli array contengono solo le altre;
    - mentre la RPC è in corso il bottone è `disabled` (Review Focus 4);
    - errore `cestino: non trovato` → si vede il messaggio italiano;
    - tabella assente → la pagina mostra lo stato vuoto, senza alert.
  - `Libreria.test.jsx`:
    - con tabella presente e due righe compare «Cestino» con «2 workout»;
    - con `PGRST205` «Cestino» non compare.
- [ ] **Step 2:** `npx vitest run src/pages/__tests__/Cestino.test.jsx src/pages/__tests__/Libreria.test.jsx` → FAIL.
- [ ] **Step 3: Implementare** pagina, UI, foglio, rotta e voce. Stili da `src/lib/stiliCard.js` e dai fogli esistenti (`FoglioGruppi.jsx` come riferimento), entrata `.cascata`.
- [ ] **Step 4:** → PASS. Rompere apposta `disabled` del bottone e vedere fallire il test; rimettere. Poi `npm test` completo: tutto verde.
- [ ] **Step 5: Controllare i pesi**: `npm run build`. Il chunk `index` resta entro +1 KB dal valore di partenza (la pagina è pigra). `Cestino-*.js` è un chunk suo.
- [ ] **Step 6: Commit.**

### Task 6: Il testo della conferma di eliminazione

**Files:**
- Modify: `src/pages/WorkoutDetail.jsx` (il paragrafo della modale «Sei sicuro?» sotto `showDeleteConfirm`)
- Test: `src/pages/__tests__/WorkoutDetailElimina.test.jsx` (estendere)

**Interfaces:** Consumes: `finisceNelCestino` (Task 3), con gli `athlete_id` delle assegnazioni che la scheda ha già caricato.

- [ ] **Step 1: Test che falliscono**:
  - workout del coach → la modale dice esattamente «Il workout andrà nel cestino per 14 giorni: da lì potrai ripristinarlo.»;
  - allenamento libero (`creato_da` = l'atleta assegnato) → resta il testo di oggi, «Questa azione eliminerà definitivamente il workout dal calendario e non può essere annullata.»;
  - lato atleta (`role === 'athlete'`) il testo non cambia.
- [ ] **Step 2:** `npx vitest run src/pages/__tests__/WorkoutDetailElimina.test.jsx` → FAIL.
- [ ] **Step 3: Implementare** solo il testo; `handleDeleteWorkout` non cambia.
- [ ] **Step 4:** → PASS. Poi `npm run build`: `WorkoutDetail` non cresce di più di 1 KB.
- [ ] **Step 5: Commit.**

### Task 7: Backup, memoria, backlog

**Files:**
- Modify: `.github/workflows/db-backup.yml` (`TABLES`: aggiungere `cestino_workout`, con un commento nello stile degli altri)
- Create: `docs/memoria/cestino.md`
- Modify: `CLAUDE.md` (§4: una riga `cestino_workout`; §11: riga «`cestino.js`, `cestinoDb.js`, `Cestino.jsx`, `CestinoUI`, `FoglioRipristino`, trigger `cestino_copia`» → `cestino.md`), `BACKLOG.md` (audio orfani delle note vocali dei workout eliminati, insieme al limite noto di `delete_expired_voice_notes`), `docs/memoria/database.md` (nuovo trigger e cron)

- [ ] **Step 1:** Aggiornare `TABLES`. Controllo: `grep -o "cestino_workout" .github/workflows/db-backup.yml` stampa una riga. Il workflow diventa attivo solo dopo il prossimo `app:main`: scriverlo in `cestino.md`.
- [ ] **Step 2:** Scrivere `docs/memoria/cestino.md`:
  - perché esiste (il revisore, 18/11/2026);
  - la regola di chi entra e chi vede;
  - cosa si salva e cosa no;
  - le trappole: `team.evento_id`, l'ordine dei risultati sulle sfide chiuse, Garmin che rimanda, gli audio orfani, la delete che fallisce se la copia fallisce;
  - come si verifica (`tools/verifica-cestino.sql`).
- [ ] **Step 3:** Aggiornare CLAUDE.md §4 e §11, BACKLOG e `database.md`.
- [ ] **Step 4:** `npm test` → tutto verde; `npx eslint src/lib/cestino.js src/lib/cestinoDb.js src/pages/Cestino.jsx src/components/CestinoUI.jsx src/components/FoglioRipristino.jsx` → 0 problemi.
- [ ] **Step 5: Commit.**
