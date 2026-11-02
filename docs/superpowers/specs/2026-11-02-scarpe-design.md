# Scarpe da corsa — design

> Data: 02/11/2026 · Stato: **design approvato in sessione**, spec da rivedere.
> 🔒 Richiede una **migrazione** (tre tabelle nuove, additive): per CLAUDE.md §0-bis
> serve un **sì esplicito** prima di applicarla. Sarebbe la nona eccezione.

## 1. Cosa vogliamo

Una pagina con un **catalogo di scarpe da running**, curato dai coach, e le **scarpe
di ogni atleta**, con il conteggio dei chilometri fatti su ciascuna in base agli
allenamenti completati. Lo scopo è sapere **quando una scarpa è da cambiare**.

### Decisioni prese con il committente
| Domanda | Scelta |
|---|---|
| Come si riempie il catalogo | Elenco curato iniziale (~100 modelli attuali, marche principali) + aggiunte e correzioni a mano dall'app |
| Da dove vengono i km | **Dall'orologio** se il workout è abbinato a un'attività Garmin con distanza, **altrimenti stimati** dal programma |
| Come si lega un allenamento a una scarpa | **Scarpa principale** in automatico + cambio nel foglio di completamento (e dopo, dalla scheda) |
| Dove stanno i dati | **Strada A**: tre tabelle, km **calcolati al momento** (mai salvati) |

### Ipotesi (non confermate: correggerle qui se sbagliate)
- Contano anche le **Run dei workout Hyrox**; gli ergometri no.
- Il **coach vede** le scarpe dei suoi atleti nella scheda atleta, in sola lettura.
- Soglia di cambio di base: **700 km**, modificabile per scarpa.

### Fuori da questo lavoro
Foto caricate dall'atleta, prezzi e link ai negozi, consigli automatici, statistiche
per scarpa oltre ai km, voce nella tab bar.

## 2. Pagine e flusso

### `/scarpe` (rotta nuova, dentro `ProtectedRoute`)
- **Atleta**
  - «Le mie scarpe»: card per scarpa attiva con marca e modello, `412 / 700 km`, barra
    (neutra → **giallo brand** da 80% → **rosso** oltre la soglia), bollino «Principale».
    Le ritirate in fondo, chiuse in «Ritirate (n)».
  - Catalogo filtrabile per **marca** e **tipo**, con «Ce l'ho» su ogni modello
    (apre un foglio: km di partenza, «rendila principale»).
  - «Non la trovi? Scrivila tu»: marca, modello, km di partenza.
- **Coach / admin**
  - Lo stesso catalogo, con «Aggiungi modello», modifica ed elimina (`CustomConfirm`).
  - «Scritte dagli atleti»: le scarpe con marca/modello a mano, raggruppate, con
    «Aggiungi al catalogo» (crea la riga di catalogo; le scarpe degli atleti restano
    come sono).
- Ingressi: card «Le mie scarpe» nel profilo atleta (`/profile`); voce in Impostazioni
  per lo staff. Niente voce in tab bar.

### `/scarpe/:id` (dettaglio di una scarpa dell'atleta)
Totale km, km di partenza, soglia modificabile, «Rendi principale», «Ritirala»
(imposta `ritirata_at`, la storia resta). Elenco corse: data, titolo (senza codice,
con `separaCodice`), km e fonte («dall'orologio» / «stimato»). Un km sconosciuto
mostra «—», mai 0.

### Al completamento
Nel foglio RPE (`RpeModal`), **solo se** il workout ha corsa (`kmAllenamento` ≠ null
oppure Garmin abbinato) **e** l'atleta ha almeno una scarpa attiva: riga
«Scarpa: <modello> ›», preimpostata sulla principale; toccandola si sceglie fra le
attive. Stessa riga nella scheda di un workout completato, per correggere dopo.

### Vista coach
Nella scheda atleta (`AthleteDetail`, ramo coach): riga compatta
«Scarpe: Pegasus 41 · 412 km», con avviso se una scarpa attiva è `oltre`. Sola lettura.

### Se le tabelle non ci sono
Finché la migrazione non è applicata le query falliscono: card nel profilo, riga nel
foglio RPE e riga nella scheda atleta **non si mostrano**; `/scarpe` mostra uno stato
vuoto. Così il codice può stare su `app` prima del sì senza rompere niente.

## 3. Dati

File: `supabase/schema/scarpe_2026-11-02.sql`. **Additivo**, nessuna tabella
esistente toccata. Si applica a mano dal SQL editor, dopo il sì.

### `scarpe_catalogo`
`id uuid pk`, `marca text not null`, `modello text not null`,
`tipo text check in ('allenamento','gara','trail','ammortizzata')`,
`drop_mm numeric` (facoltativo), `creato_da uuid`, `creato_at timestamptz default now()`,
indice unico `(lower(marca), lower(modello))` (un'espressione: indice, non vincolo).
- **select**: `authenticated`.
- **insert/update/delete**: `e_staff()` **e** email diversa da `demo@fleofit.it`
  (come `messaggi_coach`: il revisore Apple non cambia il catalogo di tutti).
- Seed: ~100 `insert` nello stesso file. `drop_mm` solo dove certo, altrimenti null.

### `scarpe_atleta`
`id uuid pk`, `athlete_id uuid not null references athletes(id) on delete cascade`,
`catalogo_id uuid references scarpe_catalogo(id) on delete set null`,
`marca text`, `modello text` (copiati dal catalogo alla scelta, così una scarpa
sopravvive se il modello viene tolto dal catalogo),
`km_iniziali numeric not null default 0 check >= 0`,
`soglia_km numeric not null default 700 check > 0`,
`principale boolean not null default false`, `ritirata_at timestamptz`,
`creato_at timestamptz default now()`.
- Indice unico parziale: `(athlete_id) where principale and ritirata_at is null`.
- **select**: `athlete_id = auth.uid() or mio_atleta(athlete_id)`.
- **insert/update/delete**: solo `athlete_id = auth.uid()`.

### `scarpe_uso`
`athlete_workout_id uuid pk references athlete_workouts(id) on delete cascade`,
`scarpa_id uuid not null references scarpe_atleta(id) on delete cascade`.
- **select**: se si vede la scarpa (`exists` su `scarpe_atleta` con la policy sopra).
- **insert/update/delete**: l'atleta, con `with check` che scarpa **e** allenamento
  siano suoi (stesso schema dell'abbinamento in `garmin_attivita`).

### Backup
Le tre tabelle in `TABLES` di `.github/workflows/db-backup.yml`
(`scarpe_uso:athlete_workout_id`). Attivo solo dopo il prossimo `app:main`.

## 4. Calcolo dei km — `src/lib/kmScarpe.js` (logica pura)

- `kmAllenamento(sections, attivita)` → `{ km, fonte: 'orologio'|'stima' }` oppure `null`.
  1. `attivita?.distanza_m > 0` → `distanza_m / 1000`, `'orologio'`.
  2. **Running** (`sections.steps`): fasi a distanza (`"5 km"`, `"400m"`) sommate;
     fasi a tempo convertite col ritmo della fase se è `m:ss /km` (media di min/max se
     c'è un intervallo), altrimenti con `MINUTI_PER_KM` (oggi 6) **esportato** da
     `statistiche.js` (una costante sola). Ripetute **solo** via `partiRipetuta`,
     moltiplicate per `rounds`.
  3. **Hyrox** (`sections.blocks`, anche legacy via `getNormalizedBlocks`): metri degli
     esercizi `Run` e `Shuttle Run` × `rounds` del blocco (1 se assente). `"Max"`/`"-"`
     non contano. Ergometri esclusi.
  4. Nulla di misurabile → `null`, **mai 0**.
- `kmScarpa(scarpa, kmUsi[])` = `km_iniziali` + somma dei km noti.
- `statoScarpa(km, soglia)` → `'ok' | 'quasi' (≥ 80%) | 'oltre' (≥ 100%)`.
- `haCorsa(sections)`: decide se mostrare la riga nel foglio RPE.

### `src/lib/scarpeDb.js` (accesso ai dati)
`leggiScarpeAtleta(supabase, athleteId)` in **4 query** (scarpe, usi, `athlete_workouts`
con `workouts.sections`, `garmin_attivita` per quegli id), poi calcolo in memoria.
`assegnaScarpa`, `togliScarpa`, `salvaScarpa`, `ritiraScarpa`, `rendiPrincipale`
(prima toglie la vecchia principale, poi mette la nuova, per l'indice unico),
CRUD del catalogo.

## 5. Legame al completamento

Quando l'atleta completa un workout con corsa, si fa l'upsert di `scarpe_uso` con la
scarpa scelta (di base la principale): ottimistico come `toggleStatus`, e un errore
dà un `CustomAlert` **senza** annullare il completamento. Riportare il workout a
«da fare» cancella la riga. Offline: non entra nella coda (`offlineQueue`); la
scarpa si può assegnare dopo dalla scheda.

## 6. Ambiente di prova

Scarpe, catalogo e usi finti in `src/demoSemi.js` (anche per `at-sofia`), così
`npm run demo:atleta` mostra la pagina piena, con una scarpa `quasi` e una `oltre`.

## 7. Test

- `src/lib/__tests__/kmScarpe.test.js` (TDD, ogni test visto fallire): Running a km,
  a tempo con ritmo, a tempo con zona, ripetute nei due formati, Hyrox con round,
  Hyrox legacy, Garmin che vince sulla stima, `null` senza dati, soglie dello stato.
- `scarpeDb.test.js` con `fintoSupabase`: 4 query, cambio di principale.
- Pagina `/scarpe` (atleta e coach) e `RpeModal` (riga presente solo con scarpe + corsa).
- `npm test` e `npx eslint` sui file nuovi prima di chiudere.

## 8. Piattaforme e pesi

Nessun codice nativo: web, iOS e Android uguali. La pagina si importa **pigra** in
`App.jsx` (il chunk `index` non deve crescere, CLAUDE.md §2). Memoria del lavoro in
un file nuovo `docs/memoria/scarpe.md`, collegato dalla tabella del §11.
