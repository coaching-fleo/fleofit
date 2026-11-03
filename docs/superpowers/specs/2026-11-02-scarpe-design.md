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
per scarpa oltre ai km, voce nella tab bar. (Le foto dei **modelli**, caricate dal coach,
sono entrate il 03/11/2026: §9.)

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

## 9. Estensione del 03/11/2026 — banner in Home, scheda del modello, foto

### Decisioni prese con il committente
| Domanda | Scelta |
|---|---|
| Ingresso alla pagina | Un **banner in Home**, nello stile della card promozionale dello screenshot del committente (card a colore pieno, titolo grande, pulsante a pillola, soggetto scontornato che esce dal bordo) |
| Chi vede il banner | **Atleta e coach** |
| Foto | Le **foto ufficiali** dei marchi, **provvisorie**: «le sostituiremo in futuro» |
| Per quali modelli foto e caratteristiche ora | Solo i **12 modelli dell'ambiente di prova**; gli altri restano con l'illustrazione del tipo |
| Dove stanno le caratteristiche | **Colonne fisse** di `scarpe_catalogo` (strada A), uguali per tutte le scarpe |
| Dove stanno le foto | **Sul server** (bucket Supabase), non dentro l'app: un modello nuovo o una foto nuova si vede **senza aggiornare l'app** |
| Scontorno | Le foto arrivano **già scontornate** (le prepara chi le carica); il telefono le mostra soltanto. Niente codice nativo |

⚠️ **Le foto ufficiali sono dei marchi** e sono state scelte come provvisorie dal committente:
vanno sostituite prima di mandare ad App Store la versione che le mostra (voce nel BACKLOG).

### Banner in Home — `BannerScarpe`
- Card `bg-brand`, `rounded-3xl`, alta ~150 px. A sinistra titolo nero `font-black` su 2–3
  righe e sotto un pulsante a pillola **nero, testo bianco**. A destra la foto scontornata,
  leggermente ruotata, che **esce dal bordo superiore** della card. Al tocco si abbassa appena
  (`vibraScelta`).
- **Atleta** — sotto «Prossimo obiettivo» (al suo posto se non c'è gara):
  - senza scarpe: «Tieni il conto dei km delle tue scarpe» · «Aggiungi la tua» → `/scarpe`;
  - con una principale: «<modello> · <km> km» · «Le mie scarpe» → `/scarpe`;
  - con una scarpa attiva `oltre`: «<modello> è da cambiare» · «Scegli la nuova» → `/scarpe`.
  - Foto: quella del modello della principale; senza, l'illustrazione del tipo.
- **Coach** — nella Home coach sotto il cruscotto: «Il catalogo scarpe · <N> modelli» ·
  «Apri» → `/scarpe`. Foto: il primo modello del catalogo con foto, in ordine alfabetico
  (stabile, mai a caso).
- Tabelle assenti o errore di lettura → **nessun banner**.
- Caricato **pigro** (`lazy`): il chunk `index` cresce al massimo di ~0,5 KB.

### Scheda del modello — `/scarpe/modello/:id`
- Si apre toccando un modello del catalogo; uguale per atleta e coach.
- In alto: foto grande su fondo scuro, marca, modello, pillole **tipo** e **livello**
  (principiante `green-500`, intermedio `brand`, avanzato `red-500`).
- Griglia delle caratteristiche, **sempre tutte e nello stesso ordine**, «—» se manca il dato:
  Ammortizzamento · Stabilità · Piastra · Drop · Peso · Altezza al tallone · Uso ideale ·
  Vita stimata.
- In fondo: «Pagina ufficiale ↗» (browser di sistema, `@capacitor/browser` su nativo);
  atleta → «Ce l'ho» (foglio esistente, con `vita_km` del modello come soglia proposta);
  coach → «Modifica» (foglio del modello con tutti i campi nuovi).
- Nota piccola: «Foto: © del marchio» quando c'è una foto.
- Modello inesistente → «Modello non trovato» con il tasto indietro.

### Dati — modifiche alla migrazione (non ancora applicata)
`scarpe_catalogo` riceve, tutte facoltative:
| Colonna | Tipo e controllo |
|---|---|
| `livello` | `text` in (`principiante`,`intermedio`,`avanzato`) |
| `ammortizzamento` | `text` in (`basso`,`medio`,`alto`,`massimo`) |
| `stabilita` | `text` in (`neutra`,`sostegno`) |
| `piastra` | `text` in (`nessuna`,`nylon_tpu`,`carbonio`) |
| `drop_mm` | già presente; check 0–16 |
| `peso_g` | `integer` 100–500 (taglia uomo US 9) |
| `stack_mm` | `numeric` 10–60 (altezza al tallone) |
| `uso` | `text[]`, ogni valore in (`lento`,`ritmo`,`ripetute`,`gara`,`trail`) |
| `vita_km` | `integer` 200–2000 |
| `url_ufficiale` | `text`, `like 'https://%'` |
| `foto_url` | `text`, `like 'https://%'` — l'indirizzo pubblico nel bucket `scarpe` |

- **Bucket `scarpe`** (Storage), **pubblico in lettura** come `athlete-photos`; scrittura,
  modifica e cancellazione solo `public.e_staff() and public.email_corrente() <> 'demo@fleofit.it'`.
- Il seed di 114 righe non cambia. In fondo al file, un blocco di `update` compila i **12
  modelli** con i valori raccolti, ognuno con la fonte in commento. `foto_url` lì resta vuoto:
  le foto si caricano dopo (sotto).
- Nessuna caratteristica cambia `scarpe_atleta`: la soglia proposta all'aggiunta è
  `vita_km` del modello se c'è, altrimenti 700.

### Raccolta dei dati per i 12 modelli
- Fonte **solo la pagina ufficiale** del modello; file di lavoro `tools/scarpe/schede.json`
  (valori + URL per riga).
- **Peso, drop, stack, piastra, vita**: solo se la pagina ufficiale li riporta; altrimenti
  vuoti. Mai da siti di recensioni.
- **Livello, ammortizzamento, uso**: sono una **valutazione FLEOFIT**, non un dato del marchio;
  criterio scritto in `docs/memoria/scarpe.md` (es. carbonio e peso basso → avanzato;
  sostegno o ammortizzamento massimo → principiante/intermedio). Il coach li corregge.

### Foto
- **Le carica il coach dall'app**, già scontornate (PNG/WebP con trasparenza), dal foglio
  «Aggiungi/Modifica modello» → «Carica foto». L'app la riduce a lato lungo 800 px (WebP se il
  browser lo sa codificare, altrimenti PNG, **conservando la trasparenza**), la mette in
  `scarpe/<id-modello>.<est>` e salva l'indirizzo pubblico in `foto_url`.
- Se gli angoli della foto non sono trasparenti, il foglio avvisa «Questa foto ha lo sfondo:
  si vedrà in un riquadro» e la scheda/il banner la mostrano dentro un riquadro chiaro
  arrotondato invece che scontornata.
- **Le 12 foto ufficiali** le preparo io già scontornate in `tools/scarpe/foto/` (script
  `tools/scarpe/scontorna.swift`, Vision di macOS, solo sul Mac). Si caricano **dopo il sì
  alla migrazione**, dal foglio «Modifica modello» o con `tools/scarpe/carica-foto.sh`
  lanciato dal committente. Io non scrivo sul server.
- Dentro l'app restano solo **4 illustrazioni per tipo** (SVG), il ripiego quando un modello
  non ha foto o la foto non si carica (`onError`): banner e catalogo non sono mai vuoti.
- Le foto si vedono anche senza rete dopo la prima volta (cache del browser/WebView).

### Ambiente di prova
I 12 modelli finti prendono le stesse caratteristiche; `foto_url` punta a copie locali
servite solo dalla demo (`public/demo-scarpe/`, mai nel build di produzione — controllo come
quello di `at-sara` al §9 di CLAUDE.md).

### Test
- `BannerScarpe`: i tre casi atleta, il coach, assente con tabelle mancanti; foto assente →
  illustrazione.
- Scheda del modello: tutte le righe sempre presenti, «—» per i dati mancanti, tasti giusti
  per ruolo, «Modello non trovato».
- Foglio modello: campi nuovi con i loro limiti; «Carica foto» riduce, conserva la
  trasparenza, avvisa se gli angoli non sono trasparenti; il demo non vede «Carica foto».
- `aggiungiScarpa` propone `vita_km` come soglia.
- Peso: `index` ≤ ~616,7 KB.
