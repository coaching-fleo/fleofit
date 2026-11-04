# Scarpe da corsa

> Scritto il 03/11/2026. Spec: `docs/superpowers/specs/2026-11-02-scarpe-design.md`, piano:
> `docs/superpowers/plans/2026-11-02-scarpe.md`. Lavoro fatto nel branch `scarpe` (worktree), da `app` @ `12ec861`.

## Stato
- ⏳ **Migrazione scritta, NON applicata**: `supabase/schema/scarpe_2026-11-02.sql`. Servirebbe la
  **nona eccezione** al congelamento (CLAUDE.md §0-bis) e **non c'è il sì**. Applicarla è una
  decisione del committente, dal SQL editor.
- Il codice può stare su `app` prima del sì: senza tabelle, `tabelleAssenti(error)` di `scarpeDb.js`
  fa sparire card del profilo, riga nel foglio RPE e riga coach, e `/scarpe` mostra uno stato vuoto.
  **Mai un alert** per una tabella assente.
- Nessuna prova sul telefono: la fa il committente.

## Cosa c'è
| Cosa | Dove |
|---|---|
| Calcolo dei km (puro) | `src/lib/kmScarpe.js`: `kmAllenamento`, `haCorsa`, `kmScarpa`, `statoScarpa`, `testoKm`, `TIPI_SCARPA` |
| Lettura/scrittura Supabase | `src/lib/scarpeDb.js` (catalogo, scarpe dell'atleta, usi, `scritteDagliAtleti`) |
| Logica del completamento | `src/lib/scarpaCompletamento.js` (modulo **pigro**) + `src/useScarpaCompletamento.js` (solo stati) |
| Pagine | `src/pages/Scarpe.jsx` (`/scarpe`), `src/pages/DettaglioScarpa.jsx` (`/scarpe/:id`) |
| Presentazione | `src/components/ScarpeUI.jsx` (`BarraKm`, `CardScarpa`, …), `src/components/RigaScarpa.jsx` |
| Ingressi | card «Le mie scarpe» nel profilo atleta; voce in Impostazioni per lo staff; niente voce in tab bar |
| Riga coach | `RigaScarpeCoach` in `AthleteDetail.jsx`, sola lettura |
| Ambiente di prova | dati finti in `demoSemi.js` |
| Backup | le tre tabelle in `TABLES` di `.github/workflows/db-backup.yml` (attivo dopo il prossimo `app:main`) |

## Perché è fatto così
- **Tre tabelle** (`scarpe_catalogo`, `scarpe_atleta`, `scarpe_uso`): il catalogo è di tutti, la
  scarpa è dell'atleta, l'uso lega una scarpa a un allenamento (chiave `athlete_workout_id`: una
  scarpa per allenamento; `with check` esige scarpa e allenamento dello stesso atleta). Marca e
  modello si **copiano** dal catalogo alla scelta: la scarpa sopravvive se il modello viene tolto
  (`catalogo_id` va a null).
- 🔴 **I km si CALCOLANO, non si salvano.** Un totale salvato andrebbe riallineato a ogni
  completamento, annullamento, abbinamento Garmin tardivo, correzione della scheda: sarebbe il
  difetto dei badge (§8). Così il totale è sempre la somma di `km_iniziali` + gli usi attuali. Un
  uso senza km noti vale `null` e **non conta** (mai 0 inventato; la cella mostra «—»).
- **Garmin vs stima** (`kmAllenamento`): se l'attività abbinata ha `distanza_m` vince l'orologio
  (`fonte: 'orologio'`), altrimenti si stima dalla scheda (`'stima'`). Stima: distanze lette
  così come sono; a tempo, minuti ÷ ritmo (media di `paceMin`/`paceMax`, altrimenti `MINUTI_PER_KM`);
  ⚠️ a tempo **«Da fermo» vale 0 km** e **«Camminata» va a 12 min/km** (senza badare alle maiuscole,
  in `pace`/`paceMin`/`paceMax`: 8 × (400m + 1′ Da fermo) = 3,2 km, non 4,5 — decisione R11, 03/11);
  ripetute solo via `partiRipetuta`, blocchi Hyrox solo via `getNormalizedBlocks({ sections })`
  (prende un oggetto con `sections`, non le sections nude). Contano le **Run** (e Shuttle Run)
  dei workout Hyrox, gli ergometri no.
- **`drop_mm` tutti `null` nel seed** (114 modelli): la regola è «solo se certo» e nessuna fonte
  verificata era disponibile. Lo completano i coach dall'app. Da riempire (BACKLOG).
- **Catalogo scrivibile dallo staff meno `demo@fleofit.it`**: il revisore Apple non cambia il
  catalogo di tutti. La policy usa `public.email_corrente()` (minuscole e spazi tolti), non la mail
  grezza del JWT (R13, 03/11). Nell'app (`Scarpe.jsx`, `curaCatalogo`) quell'account non vede
  «Aggiungi modello», Modifica, Elimina né «Aggiungi al catalogo»; e un `42501` su una scrittura
  del catalogo dice «Il catalogo non si modifica da questo account.», non «controlla la connessione» (R12).
- **Soglia di base 700 km**, per scarpa; `statoScarpa`: `ok` sotto l'80%, `quasi` da lì, `oltre` dal 100%.
- **Il coach legge soltanto**: la RLS scrive solo `athlete_id = auth.uid()`. La riga coach mostra
  la principale; senza principale compare solo se c'è da avvisare («Scarpe: 2 attive · da cambiare»).
- **Contano solo le corse completate**: `leggiScarpeAtleta` legge anche `status` e scarta ogni uso
  il cui allenamento non è `completed` (né negli usi né nei km). Così un uso rimasto per un annullo
  offline, un coach che riapre la corsa o una `togliScarpa` fallita non pesa.
- **Offline = nessuna scarpa**: il completamento offline va in coda come prima e **non** lega la
  scarpa (la coda non porta l'uso). Si assegna dopo dalla scheda del workout.
- **Dati finti su `at-sara`** (default di `npm run demo:atleta`, ha corse completate) e non su
  `at-sofia` (nuova, senza completati). Sono state aggiunte 5 corse completate a Sara: si vedono
  anche nelle altre schermate della demo.
- **La riga al completamento**: nel foglio RPE solo se `haCorsa(sections)` (al completamento
  l'attività Garmin di solito non è ancora arrivata); nella scheda di un workout completato anche
  se c'è un'attività Garmin con distanza o esiste già un uso. Preselezione: la scarpa già legata,
  poi la principale, poi «Nessuna» (non scrive). Il foglio riaperto da `?rpe=1` non riscrive una
  scelta già fatta. Un errore di scrittura è un CustomAlert e il completamento resta salvato.
- **La scelta vale per il suo allenamento** (`scelta = { per, awId, id }`): un foglio chiuso senza
  salvare non la lascia alla corsa dopo. «Nessuna» scelta **apposta** su una corsa che aveva una
  scarpa la toglie; la «Nessuna» di partenza non scrive niente.
- **`annulla` cancella sempre** (una rilettura in ritardo non deve lasciare l'uso), ma l'avviso
  «resta legata» compare solo se una scarpa risultava legata.
- **`rendiPrincipale`**: toglie la vecchia (e se la fa tornare), mette la nuova; se la seconda
  scrittura fallisce prova a rimettere la vecchia, poi lancia. Il dettaglio rilegge la scarpa
  anche dopo l'errore.

## 🔴 Peso: il modulo pigro e il chunk `index`
`Home` sta nel chunk d'ingresso. Con `scarpeDb` e `kmScarpe` importati lì dentro `index` cresceva
di ~9,6 KB, con la sola logica del completamento di ~2,4. Per questo il hook
(`useScarpaCompletamento`) tiene **solo gli stati** e importa `scarpaCompletamento.js` con
`import()` pigro. Finché il modulo non è caricato il hook torna VUOTO: nessuna riga, scritture a
vuoto. Anche `AthleteDetail` carica `scarpeDb` pigro per la riga coach. **Mai importare
`scarpeDb`/`kmScarpe` in modo statico da `Home`.**
Misura 03/11/2026: `index` **616,18 KB** (era 605,6). Il grosso (≈ +9) è il locale `it` di date-fns,
che si è spostato da un chunk già caricato all'avvio dentro `index`: il carico reale all'avvio è
cresciuto di **0,48 KB** (misurato sui due build); il resto (~1,2 KB) è il hook pigro. Margine dal
`chunkSizeWarningLimit` (620): **~4 KB**. Chunk nuovi: `Scarpe` 8 KB, `ScarpeUI` 13,7, `DettaglioScarpa` 2,9, `scarpaCompletamento` 1,4.

## Cosa manca / difetti noti (rimandati, non bloccanti)
- Annullare un completamento **offline** lascia la riga in `scarpe_uso`, ma non conta più (si
  leggono solo le corse completate). Se la corsa torna completata, la scarpa ritorna con lei.
- Completare prima che il modulo pigro sia caricato: la scarpa non si registra (si assegna dalla scheda).
- Una scarpa legata e poi ritirata resta preselezionata.
- `.in()` con tutti gli id degli usi nella URL: limite a qualche centinaio di corse (cap 1000 righe).
- `Home` fa 2 import pigri + 1 query per ogni atleta anche senza scarpe; il coach legge a ogni visita.
- `drop_mm` senza limite superiore; `rendiPrincipale` fallito dopo un insert lascia la scarpa non principale.
- Test che mancano: navigazione di `CardScarpa`, offline/ordine delle chiamate.
- Il `carica()` nell'effetto di `Scarpe.jsx` e `DettaglioScarpa.jsx` ha un
  `eslint-disable-next-line react-hooks/set-state-in-effect` motivato (caricamento iniziale, come
  le altre pagine): `npx eslint` sui file delle scarpe non segnala niente.


## Banner, scheda del modello, caratteristiche e foto (03/11/2026)
Tutto nel catalogo e nelle stesse tabelle: **la migrazione resta non applicata** (le colonne e il bucket
sono nel `.sql` del 02/11, vedi sotto). Senza le tabelle il banner non compare.

### Il banner in Home (`bannerScarpe.js`, `BannerScarpe.jsx`, pigro)
- **Atleta**: sta **dopo `ListaInArrivo`**, non sotto «Prossimo obiettivo» come chiedeva la spec §9. Motivo: la
  card carica in ritardo e, sopra la lista, spingerebbe giù voci già tappabili; un segnaposto riservato
  collasserebbe quando le tabelle non ci sono. Costo: è meno in vista di quanto voluto.
- **Coach**: dopo «Gare» nel telefono, in fondo alla colonna principale nel desktop.
- Testi: atleta con una scarpa oltre soglia «`<modello>` è da cambiare» / «Scegli la nuova»; altrimenti la
  principale (o la prima attiva) «`<modello>` · `<km>` km» / «Le mie scarpe»; senza scarpe «Tieni il conto dei km
  delle tue scarpe» / «Aggiungi la tua». Coach: «Il catalogo scarpe · N modelli» / «Apri», **singolare** «1 modello».
- Foto del banner: quella della scarpa mostrata, altrimenti il primo modello del catalogo con foto; il disegno
  di ripiego prende `tono="scuro"` sul giallo.

### La scheda del modello (`/scarpe/modello/:id`, `ModelloScarpa.jsx`, `ModelloScarpaUI`)
Uguale per atleta e coach. **8 righe fisse, sempre nello stesso ordine** (`righeCaratteristiche`):
Ammortizzamento · Stabilità · Piastra · Drop · Peso · Altezza al tallone · Uso ideale · Vita stimata. Un dato mancante è
«—», mai 0 e mai riga nascosta (il drop 0 mm è un dato). Dopo «Ce l'ho» si va a `/scarpe`, dove c'è la scarpa
nuova. Il coach modifica da `FoglioModelloCatalogo` (file suo: **non** si riesporta da `ScarpeUI`, giro
circolare); `validaModello(campi, { parziale })` ignora le chiavi sconosciute e con `parziale` controlla
solo i campi presenti. Un valore fuori elenco è errore; solo `uso` filtra in silenzio.
La pagina ha anche «Carica foto» (oltre al foglio); per una foto con sfondo mostra un avviso. «Ce l'ho»
propone di renderla principale solo se l'atleta non ne ha già una, e resta spento finché la lettura delle sue
scarpe non risponde (altrimenti avrebbe sostituito la principale senza saperlo; tabelle assenti o errore = nessuna).
File orfani: nel bucket possono restare file vecchi (foto ricaricata con un'estensione diversa; eliminando un
modello la sua foto non si cancella).

### Colonne nuove di `scarpe_catalogo` (con i limiti)
`livello` (principiante/intermedio/avanzato), `ammortizzamento` (basso/medio/alto/massimo), `stabilita`
(neutra/sostegno), `piastra` (nessuna/nylon_tpu/carbonio), `peso_g` 100–500, `stack_mm` 10–60,
`uso` text[] ⊂ {lento, ritmo, ripetute, gara, trail}, `vita_km` 200–2000, `url_ufficiale` e `foto_url`
(entrambi `like 'https://%'`); `tipo` e `drop_mm` 0–16 c'erano già. Tutte facoltative.
**Bucket `scarpe`**, pubblico, con **4 policy** su `storage.objects` (lettura, insert, update, delete): scrive
solo lo staff, mai `demo@fleofit.it`.
⚠️ **Prima del sì**: le policy globali «consenti update a tutti» / «consenti delete a tutti» su `storage.objects`
(multi_coach §7), se esistono, annullano le restrizioni del bucket. Controllarle prima di caricare foto.

### La foto (`fotoScarpa.js`, `FotoScarpa.jsx`, `scarpeDb.js`)
- `foto_url` salvato = `<url pubblico>?v=<timestamp>` (così la cache non tiene la foto vecchia) e, se la foto
  **non è scontornata**, il frammento `#sfondo` (stessa idea di `#deleted=`). `riduciFoto` porta il lato
  lungo a 800 px, webp (png se il browser lo ignora); `angoliTrasparenti` guarda i 4 angoli (alpha < 16).
  `fotoConSfondo(url)` = finisce con `#sfondo` → `FotoScarpa` la mette in un riquadro bianco.
- Senza foto, o se non carica, `FotoScarpa` mostra il **disegno del tipo** (4 SVG in `src/assets/scarpe/`,
  tratto fisso `#9ca3af`: `currentColor` non passa dentro un `<img>`). Prop `tono`: `'chiaro'` (default) o
  `'scuro'` (`filter: brightness(0)`, solo sul disegno, per il banner giallo). Un url nuovo dopo un errore si riprova.

### Valutazione FLEOFIT (`tools/scarpe/LEGGIMI.md`)
- `ammortizzamento` da `stack_mm` (tallone): <30 basso, 30–35 medio, 36–40 alto, >40 massimo. Senza stack: tipo
  `ammortizzata` → alto, altrimenti `null`.
- `stabilita`: `sostegno` se il marchio la dichiara stabile/supportive, altrimenti `neutra`.
- `livello`: `avanzato` se piastra carbonio o tipo `gara`; `principiante` se `sostegno` o ammortizzamento
  massimo; altrimenti `intermedio`. Mai `null`.
- `uso`: gara → gara, ripetute; allenamento con piastra nylon/TPU → ritmo, ripetute; allenamento → lento, ritmo
  (anche con carbonio, come Puma); ammortizzata → lento; trail → trail.

### Dati e foto dei 12 modelli di prova (`tools/scarpe/`)
- `schede.json` (dati), `scontorna.swift` (Vision, toglie lo sfondo), `carica-foto.sh` (carica nel bucket,
  **solo dopo il sì** alla migrazione), `foto/<slug>.png`.
- **Solo 3 foto su 12** (Saucony, Puma, On): i siti dei marchi bloccano i download automatici (nessun
  aggiramento tentato). Le altre 9 hanno il disegno; si caricano da «Carica foto». Le foto sono © dei marchi e
  **provvisorie**: vanno sostituite prima della versione che le mostra (BACKLOG).
- I dati di **6 marchi** (Nike, Adidas, Asics, Hoka, Brooks, New Balance) vengono da estratti dei domini
  ufficiali, non dalle pagine: **da ricontrollare**. Puma, Saucony e On sono letti dalle pagine.
- 🔴 **Trappola, demo**: `foto_url` nei semi di `demoSemi.js` è un percorso a mano `/tools/scarpe/foto/<slug>.png`,
  buono solo con il server di sviluppo. Con `import.meta.glob` (in entrambe le varianti) i PNG finivano in `dist`.
  Solo i 3 modelli con PNG hanno `foto_url`; gli altri 9 `null`.
- Peso: `index` **616,77 KB** dopo il banner (+0,31 del banner, +0,28 della rotta pigra della scheda);
  il limite d'avviso è 620, margine ~3 KB.

## Test
- ⚠️ `demoGarmin.test.jsx` «una è libera, in un giorno senza allenamenti di Sara» **fallisce a
  seconda della data**, anche su `app` senza questi cambiamenti: non è dovuto alle scarpe.
- `CreaWorkoutBuilder.test.jsx` può andare in timeout sotto carico (la suite intera): da solo passa (79/79).
