# Modelli di blocco: il coach salva un blocco e lo riusa

> Progetto del 16/10/2026. Decisioni del committente prese in sessione lo stesso giorno,
> una domanda alla volta, e il design approvato in chat (approccio 1).
>
> 🔒 **Richiede una tabella nuova.** Il **sì esplicito** alla migrazione additiva di
> `modelli_blocco` è arrivato in sessione il 16/10/2026 («do il sì esplicito alla
> migrazione additiva della tabella modelli_blocco»): è la **quinta eccezione** al
> congelamento (CLAUDE.md §0, regola 0-bis). Vale per questa tabella e basta.

## Perché

Il coach riscrive spesso gli stessi pezzi: lo stesso riscaldamento, lo stesso EMOM di
Wall Balls e Burpees, le stesse ripetute da 400, la stessa superserie di panca e rematore.
Oggi l'unica scorciatoia è duplicare un workout intero e cancellare quello che non serve.
Vuole salvare **un blocco** come modello e rimetterlo in un workout nuovo con un tocco.

## Decisioni del committente

1. **I modelli stanno nel database**, in una tabella nuova: si vedono da telefono e da
   computer e non si perdono cambiando dispositivo. Scartato «solo sul dispositivo».
2. **Ogni coach vede solo i suoi.** Non c'è una libreria condivisa dello staff.
3. **Hyrox, Corsa e Gym.** Ogni categoria con blocchi ha i suoi modelli; Custom non ha
   blocchi e non ne ha. Le categorie future li avranno nello stesso lavoro in cui nascono,
   come «Genera con IA» (regola 5-bis).
4. **Il modello salva il blocco com'è, numeri compresi.** Si cambiano dopo, da dentro
   (regola 5-ter).
5. **Si usa dal foglio «Aggiungi»** del builder, non da un bottone separato.
6. **La sezione dedicata è una pagina `/modelli`**, raggiungibile da Crea Workout.
7. **Per creare e modificare un modello si usa il builder stesso**, in «modalità modello»
   (approccio 1). Scartato un editor proprio dentro `/modelli`: sarebbe un secondo editor
   da tenere allineato, e si porterebbe dietro i componenti del builder.

### Perché non «workout nascosti»
Si poteva evitare la migrazione salvando i modelli come workout con un segno nelle
`sections`. Scartato: `workouts` è letto in decine di punti (archivio, calendario, TV,
report, previsione del carico, export), e ognuno avrebbe dovuto imparare a ignorarli. Il
primo dimenticato mostrerebbe un modello come un allenamento vero.

## Cosa si chiama «blocco» in ogni categoria

| Categoria | Il blocco è | Dove vive nel workout | Dove si inserisce un modello |
|---|---|---|---|
| Hyrox | un blocco (`EMOM`, `AMRAP`, `For Time`…) con i suoi esercizi | `sections.blocks[]` | foglio «Aggiungi Blocco» (`BlockPickerModal`) |
| Corsa | una fase (`warmup`, `run`, `repeat`…) | `sections.steps[]` | foglio della fase (`RunningStepPicker`) |
| Gym | un gruppo: un esercizio, o una superserie/circuito | `sections.gym[]` | picker degli esercizi (`PickerGym`), nella fase da cui lo si apre |

Il formato di ognuno è quello di CLAUDE.md §5: il modello non inventa un formato suo.

## 1. Dati e permessi

```sql
create table public.modelli_blocco (
  id uuid primary key default gen_random_uuid(),
  coach uuid not null references auth.users (id) on delete cascade default auth.uid(),
  categoria text not null check (categoria in ('Hyrox', 'Running', 'Gym')),
  nome text not null check (char_length(btrim(nome)) between 1 and 80),
  contenuto jsonb not null,
  creato_at timestamptz not null default now(),
  modificato_at timestamptz
);
create index modelli_blocco_coach on public.modelli_blocco (coach, categoria);
alter table public.modelli_blocco enable row level security;

create policy "modelli_blocco del coach" on public.modelli_blocco
  as permissive for all to authenticated
  using      (coach = auth.uid() and public.e_staff())
  with check (coach = auth.uid() and public.e_staff());
```

- `categoria` usa gli `id` di `CATEGORIE` (`Running`, non «Corsa»), come
  `workouts.sections.category`.
- `contenuto` è **un** blocco, una fase o un gruppo, senza `id` (vedi §2).
- **Una policy sola, uguale in `USING` e `WITH CHECK`.** Anche un admin vede solo i suoi:
  è la decisione 2, e un admin che vedesse quelli degli altri se li troverebbe mescolati
  nel foglio «Aggiungi».
- L'account demo del revisore App Store è staff e può creare modelli: restano suoi e non
  arrivano a nessun atleta, quindi non serve escluderlo (a differenza di `messaggi_coach`).
- `on delete cascade` su `coach`: un coach rimosso porta via i suoi modelli, che non
  servono a nessun altro.
- **Migrazione additiva**: `main` non conosce la tabella e non cambia niente per lui.
  File: `supabase/schema/modelli_blocco_2026-10-16.sql`, con in coda la query di verifica
  (una policy, `ALL`) e il rollback (`drop table`). Si applica come le precedenti, con
  `supabase db query --linked -f`, e la si annota in CLAUDE.md §0 e §4 e in
  `docs/memoria/database.md`.
- **Backup**: `modelli_blocco` si aggiunge a `TABLES` in `.github/workflows/db-backup.yml`
  (ha la colonna `id`, nessuna chiave speciale). Diventa attivo al prossimo `app:main`.

## 2. Logica pura: `src/lib/modelliBlocco.js`

Tutto quello che non è schermo sta qui, coperto da test:

- `CATEGORIE_MODELLI = ['Hyrox', 'Running', 'Gym']`.
- `contenutoDaBlocco(categoria, blocco)` → la copia da salvare: **tolti tutti gli `id`**
  (del blocco, degli esercizi, delle righe di `dettaglio`), profonda, senza riferimenti
  all'oggetto del builder. Per Gym toglie anche `fase`: la decide il posto in cui lo si
  inserisce.
- `bloccoDaModello(modello, { fase } = {})` → il blocco pronto per il builder: **`id`
  nuovi ovunque** (`Math.random()`, come il resto del builder), e per Gym la `fase` del
  picker da cui lo si è inserito. È la trappola di «Salva una copia che cambiava
  l'originale» (`crea-workout.md`, 9-quaterquadragies): due inserimenti dello stesso
  modello non devono condividere un `id` né un oggetto.
- `nomeProposto(categoria, blocco)` → il nome che compare già scritto quando si salva, da
  correggere se si vuole. Hyrox: tipo e numeri principali più i primi esercizi
  («EMOM 10′ · Wall Balls, Burpees»). Corsa: la fase come la scrive la scheda
  («8 × 400m · rec 1 min»). Gym: gli esercizi del gruppo («Panca piana + Rematore»).
  Tagliato a 80 caratteri. Riusa le funzioni di riga che la scheda già ha, se esistono,
  invece di riscriverle.
- `anteprimaModello(modello)` → la riga breve sotto il nome, in elenco e nel foglio.
- `valido(modello)` → `false` se la categoria non è fra le tre o il contenuto non ha la
  forma della sua categoria: un modello rotto non si offre, invece di rompere il builder.

Un test (sul modello di `iaCategorie.test.js`) fallisce se in `CATEGORIE` di
`CreateWorkout.jsx` c'è una categoria con blocchi che non è in `CATEGORIE_MODELLI`: la
regola della decisione 3 la tiene il codice, non la memoria.

## 3. Lettura e scrittura: `src/lib/modelliBloccoDb.js` (o un hook `useModelliBlocco`)

- `elencoModelli(categoria?)`, `salvaModello({ categoria, nome, contenuto })`,
  `aggiornaModello(id, campi)` (scrive `modificato_at`), `eliminaModello(id)`.
- Il filtro per coach lo fa la RLS: l'app chiede `select *` e riceve solo i propri.
- **Senza rete non si salva.** Niente coda offline: un modello non è un dato dell'atleta
  e non vale la complessità. L'errore arriva con `CustomAlert` («Serve la connessione
  per salvare un modello»), e il blocco nel builder resta com'era.
- Nel foglio «Aggiungi» l'elenco si legge all'apertura; se non arriva, la sezione «I miei
  modelli» semplicemente non c'è e il foglio resta quello di oggi.
- **Ambiente di prova**: `src/supabaseDemo.js` deve rispondere anche a `modelli_blocco`,
  e `src/demoSemi.js` porta due o tre modelli per categoria, così `npm run demo` mostra la
  funzione piena.

## 4. Nel builder: «Salva come modello» e «I miei modelli»

### Salvare dal workout
- **Hyrox**: nella fila delle azioni di `HyroxBlock`, accanto a «Duplica» e «Cambia tipo
  di blocco», una voce «Salva come modello».
- **Corsa**: in `RunningStepRow`, accanto a «Duplica la fase».
- **Gym**: in `CardGruppo` di `CreaGym.jsx`, accanto a «Duplica».

Toccarla apre un piccolo foglio con il campo **Nome** già riempito da `nomeProposto` e il
bottone «Salva modello». Alla riuscita: `vibraSuccesso()` e un avviso breve «Modello
salvato». Il blocco nel workout non cambia.

### Inserire nel workout
- **Hyrox**: `BlockPickerModal` (solo quando aggiunge, non nel «Cambia tipo di blocco»)
  mostra sotto la griglia dei tipi la sezione **«I miei modelli»**, con i modelli Hyrox:
  nome e anteprima. Toccarne uno chiama `aggiungiBlocco(bloccoDaModello(m))`: il blocco
  entra in fondo, aperto e sotto gli occhi, come uno nuovo.
  ⚠️ Un blocco da modello **non** passa dalla richiesta dei numeri di
  «9-blocco-confermato»: i numeri ce li ha già.
- **Corsa**: `RunningStepPicker` (solo in aggiunta, non in modifica) mostra «I miei
  modelli» Corsa; toccarne uno aggiunge la fase in fondo.
- **Gym**: `PickerGym`, quando aggiunge a una fase (non dentro una superserie e non in
  «Cambia»), mostra «I miei modelli» Gym; toccarne uno aggiunge il gruppo in quella fase.
- Senza modelli in quella categoria la sezione non compare: nessuno stato vuoto dentro un
  foglio che serve ad altro. L'invito a crearne sta in `/modelli`.
- In fondo alla sezione un collegamento «Gestisci i modelli» porta a `/modelli`. Se il
  workout ha modifiche non salvate, la bozza di oggi le conserva già.

## 5. La pagina `/modelli`

- **Rotta** `/modelli` dentro `ProtectedRoute`, **solo staff**: chi non lo è torna a `/`,
  come `/report`.
- **Si arriva** da un'icona nella testata di Crea Workout (telefono e desktop), dal
  collegamento nei fogli «Aggiungi», e da una voce «Modelli» in `BarraLaterale` su
  desktop.
- **Schede** Hyrox / Corsa / Gym, con il colore della categoria (toggle segmentato del
  design system §6). Ricorda l'ultima scheda aperta solo per la sessione.
- **Elenco**: card con nome, anteprima e data dell'ultima modifica, ordinate dalla più
  recente. Menu della card: **Modifica**, **Rinomina**, **Elimina** (con `CustomConfirm`:
  «Il modello sparisce. I workout in cui l'hai già usato non cambiano.»).
- **Stato vuoto** della scheda (bordo tratteggiato, §6): «Nessun modello Hyrox. Salvane
  uno da un blocco di un workout, o creane uno qui.» con il bottone **Nuovo modello**.
- **Nuovo modello** e **Modifica** aprono il builder in modalità modello (§6).
- Entrata con `.cascata`; testata sticky fuori dalla cascata.
- La modale del menu si chiude col tasto indietro di Android (X con `aria-label="Chiudi"`).

## 6. Il builder in «modalità modello»

- **Rotte**: `/create?modello=nuovo&categoria=Hyrox` e `/create?modello=<id>`.
- Cosa **sparisce**: il passo della categoria (è fissata), titolo e codice, data,
  atleti e assegnazione, note del coach, previsione del carico, durata del workout,
  «Salva workout», «Genera con IA» e «Da un testo scritto».
- Cosa **resta**: l'editor di un solo blocco della categoria con tutto ciò che ha oggi:
  righello, misure, «Cambia tipo di blocco», «Cambia esercizio», «Fase» Gym,
  l'incremento, le stazioni EMOM.
- **Un blocco solo.** Con il modello vuoto, al posto della lista c'è «Scegli il blocco»
  (Hyrox), «Scegli la fase» (Corsa) o «Scegli gli esercizi» (Gym). Una volta messo, i
  bottoni di aggiunta spariscono. Per Gym si mostra solo la fase del gruppo.
- In cima: il campo **Nome del modello**, riempito da `nomeProposto` finché il coach non
  lo tocca (come il nome generato del workout).
- In fondo: **«Salva modello»**, poi ritorno a `/modelli` sulla scheda della categoria.
- **Non tocca la bozza del workout** (`fleofit_workout_draft`): aprire un modello non
  deve cancellare un workout lasciato a metà. Nessuna bozza propria: un modello è breve.
- Uscendo con modifiche non salvate, `CustomConfirm` come oggi.
- Un `id` che non esiste (cancellato, o di un altro coach) → avviso e ritorno a
  `/modelli`.

### Perché «Genera con IA» e «Da un testo scritto» non ci sono
Producono un workout intero, cioè più blocchi, e un modello è un blocco solo. Tenerli
avrebbe voluto dire scegliere quale blocco tenere e buttare gli altri. Chi vuole un blocco
generato lo genera in un workout e da lì fa «Salva come modello». ⚠️ In chat il design
diceva che c'erano anche questi due: è una correzione, segnalata al committente con la
spec.

## 7. Cosa NON fa

- Nessun modello di **workout intero**: per quello c'è già «Duplica».
- Nessuna condivisione fra coach, nessuna cartella o etichetta, nessuna ricerca: con
  qualche decina di modelli per categoria l'elenco basta.
- Un modello non è legato ai workout in cui è stato usato: cambiarlo non cambia quelli.
- Gli atleti non vedono niente di tutto questo.

## 8. Test

Ogni test si vede prima fallire, rompendo apposta il codice che copre (§9).

- `modelliBlocco.test.js`: `id` tolti al salvataggio e rigenerati all'inserimento, a ogni
  livello; due inserimenti dello stesso modello senza oggetti in comune; `fase` Gym presa
  dal picker; `nomeProposto` per le tre categorie e il taglio a 80; `valido` sui modelli
  rotti; la regola delle categorie (decisione 3).
- Pagine (con `montaPagina` e `fintoSupabase`): «Salva come modello» da un blocco Hyrox
  scrive la riga giusta; il foglio «Aggiungi Blocco» mostra solo i modelli Hyrox e
  l'inserimento aggiunge il blocco; la sezione non compare senza modelli; `/modelli`
  elenca, rinomina ed elimina; la modalità modello non scrive `fleofit_workout_draft`.
- Pesi dei chunk: `CreaWorkoutUI` resta intorno ai 18 KB e `index` intorno ai 594 KB.
  `/modelli` è caricata in modo pigro come le altre pagine.
- Prova sul telefono: la fa il committente (iOS e Android), compreso il tasto indietro.

## 9. Documentazione

- `docs/memoria/crea-workout.md`: una sezione «Modelli di blocco», con il perché delle
  scelte qui sopra. CLAUDE.md §11 aggiunge `modelliBlocco.js` e la pagina alla riga di
  `crea-workout.md`.
- CLAUDE.md §0 (quinta eccezione), §4 (riga della tabella), §8 se nasce una chiave
  localStorage, e una regola breve accanto a 5-bis: **ogni categoria con blocchi ha i
  modelli**.
- `DEVLOG.md` tra le novità della prossima versione, `BACKLOG.md` se resta qualcosa.
