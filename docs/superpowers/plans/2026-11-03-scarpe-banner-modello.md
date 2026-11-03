# Scarpe — banner in Home, scheda del modello, foto dal server · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un banner giallo in Home (atleta e coach) che porta alle scarpe, una scheda per ogni modello del catalogo con le stesse otto caratteristiche per tutti, e le foto dei modelli lette dal server, così un modello o una foto nuova si vedono senza aggiornare l'app.

**Architecture:** Le caratteristiche sono colonne nuove di `scarpe_catalogo` (aggiunte alla migrazione ancora NON applicata); la loro forma, i limiti e le etichette vivono in un modulo puro (`caratteristicheScarpa.js`) usato da foglio, scheda e test. Le foto stanno nel bucket pubblico `scarpe` e il loro indirizzo in `foto_url`; un componente `FotoScarpa` le mostra con ripiego su un'illustrazione per tipo. Il banner è un componente pigro che decide il testo con una funzione pura (`bannerScarpe.js`).

**Tech Stack:** React 19, Vite 8, Tailwind 4 (token `brand`), Supabase (Postgres + Storage), Vitest con `montaPagina`/`fintoSupabase`, Capacitor `@capacitor/browser`, Swift + Vision (solo strumento sul Mac, non nell'app).

**Spec:** `docs/superpowers/specs/2026-11-02-scarpe-design.md` §9 (estensione del 03/11/2026). Le regole del §1–§8 restano.

**Branch e cartella:** `scarpe`, worktree `/Users/alessandropatrone/Desktop/FLEOFIT/fleofit-app-scarpe`.

## Global Constraints

- 🔒 La migrazione **non si applica**: si modifica solo il file `supabase/schema/scarpe_2026-11-02.sql`. Nessuna scrittura sul database né sullo Storage di produzione, da nessun task.
- Tabelle assenti / colonne assenti / errore di lettura → il banner non compare, la scheda mostra «Modello non trovato»: mai un `CustomAlert` per la migrazione mancante (`tabelleAssenti` di `scarpeDb.js`).
- Ordine fisso delle caratteristiche: Ammortizzamento · Stabilità · Piastra · Drop · Peso · Altezza al tallone · Uso ideale · Vita stimata. Dato mancante = «—», mai 0, mai riga nascosta.
- Valori ammessi: `livello` principiante|intermedio|avanzato · `ammortizzamento` basso|medio|alto|massimo · `stabilita` neutra|sostegno · `piastra` nessuna|nylon_tpu|carbonio · `drop_mm` 0–16 · `peso_g` intero 100–500 · `stack_mm` 10–60 · `uso` ⊆ lento,ritmo,ripetute,gara,trail · `vita_km` intero 200–2000 · `url_ufficiale` e `foto_url` iniziano con `https://`.
- Colori del livello: principiante `green-500`, intermedio `brand`, avanzato `red-500`. Nessun colore nuovo: solo token e classi già in uso (CLAUDE.md §6).
- Banner: card `bg-brand rounded-3xl`, ~150 px, titolo nero `font-black`, pulsante a pillola nero con testo bianco, foto a destra ruotata che esce dal bordo superiore, `vibraScelta` al tocco (`src/lib/aptica.js`).
- Account `demo@fleofit.it`: niente «Modifica», niente «Carica foto» (stessa regola `curaCatalogo` di `Scarpe.jsx`).
- Chunk `index` ≤ **616,7 KB** dopo `npm run build` (riferimento 616,18). Banner e scheda del modello si importano con `lazy`.
- Foto del browser di sistema: `Browser.open` su nativo con `.catch(() => {})`, `window.open(url, '_blank', 'noopener')` sul web (come `src/lib/informativa.js`).
- Le foto ufficiali sono dei marchi e provvisorie: nota «Foto: © del marchio» sotto la foto; voce nel BACKLOG.
- Italiano in interfaccia e commenti; mai `alert()`/`confirm()`; modali con `createPortal`; commit con i file per nome.

## Review Focus

1. **Foto che non si carica** (indirizzo rotto, offline, bucket vuoto) → si vede l'illustrazione del tipo, mai un'immagine rotta o un riquadro vuoto (test in Task 4).
2. **Atleta con sole scarpe ritirate o scritte a mano** → il banner usa il messaggio «senza scarpe» per le ritirate, e l'illustrazione «allenamento» per quelle a mano senza catalogo (test in Task 6).
3. **Modello con `uso` vuoto o con valori sconosciuti** (dato curato a mano) → riga «Uso ideale: —» o solo i valori noti, mai crash (test in Task 2).
4. **Policy dello Storage**: una policy `storage.objects` già esistente permissiva su tutti i bucket renderebbe inutile la restrizione su `scarpe` → query di controllo in sola lettura nel Task 3, da far girare al committente prima del sì.
5. **`vita_km` assente** → la soglia proposta all'aggiunta resta 700 (test in Task 3).

---

### Task 1: Dati e foto ufficiali dei 12 modelli (strumenti, niente app)

**Files:**
- Create: `tools/scarpe/schede.json`
- Create: `tools/scarpe/scontorna.swift`
- Create: `tools/scarpe/foto/<slug>.png` (12 file)
- Create: `tools/scarpe/LEGGIMI.md`
- Test: `src/lib/__tests__/schedeScarpe.test.js` (scritto nel Task 2, che porta i limiti)

**Interfaces:**
- Produces: `schede.json` = array di 12 oggetti
  `{ marca, modello, slug, livello, ammortizzamento, stabilita, piastra, drop_mm, peso_g, stack_mm, uso, vita_km, url_ufficiale, fonte_foto, fonti: { <campo>: <url> } }`, con `null` dove la pagina ufficiale non dà il dato. `slug` = `marca-modello` minuscolo, spazi e `/` → `-` (es. `hoka-clifton-10`). I 12 modelli sono esattamente quelli di `scarpe_catalogo()` in `src/demoSemi.js`.

- [ ] **Step 1: Raccogliere i dati.** Per ogni modello aprire la pagina prodotto **ufficiale** del marchio (WebFetch). Prendere `peso_g` (uomo US 9; se la pagina dà solo un'altra taglia, quella, annotandolo in `fonti`), `drop_mm`, `stack_mm` (tallone), `piastra`, `vita_km` **solo** se scritti lì. Mai siti di recensioni. Pagina irraggiungibile → campi a `null`, `url_ufficiale` comunque.
- [ ] **Step 2: Compilare la valutazione FLEOFIT** con questo criterio (va anche in `LEGGIMI.md` e, nel Task 8, in `docs/memoria/scarpe.md`):
  - `ammortizzamento`: da `stack_mm` — <30 basso, 30–35 medio, 36–40 alto, >40 massimo; senza stack: tipo `ammortizzata` → alto, altrimenti `null`.
  - `stabilita`: `sostegno` se il marchio la dichiara stabile/supportive, altrimenti `neutra`.
  - `livello`: `avanzato` se piastra carbonio o tipo `gara`; `principiante` se `sostegno` o ammortizzamento massimo; altrimenti `intermedio`.
  - `uso`: gara → `["gara","ripetute"]`; allenamento con piastra nylon/TPU → `["ritmo","ripetute"]`; allenamento → `["lento","ritmo"]`; ammortizzata → `["lento"]`; trail → `["trail"]`.
- [ ] **Step 3: Scaricare la foto principale** (l'`og:image` o la prima immagine di galleria della pagina ufficiale) in una cartella nuova e vuota fuori dal progetto (scratchpad), e annotare l'URL in `fonte_foto`.
- [ ] **Step 4: Scrivere `tools/scarpe/scontorna.swift`**: `swift scontorna.swift <ingresso> <uscita.png>` → maschera con `VNGenerateForegroundInstanceMaskRequest`, ritaglio al soggetto, lato lungo 800 px, PNG con trasparenza. Uscita con codice ≠ 0 e messaggio se non trova un soggetto.
- [ ] **Step 5: Scontornare le 12 foto** in `tools/scarpe/foto/<slug>.png`. Verifica: `sips -g hasAlpha -g pixelWidth -g pixelHeight tools/scarpe/foto/*.png` → `hasAlpha: yes` e lato lungo 800 per tutte. Guardare ogni foto (Read) e rifare a mano quelle con pezzi mancanti.
- [ ] **Step 6: `LEGGIMI.md`**: a cosa servono i file, il criterio dello Step 2, che le foto sono © dei marchi e provvisorie, come si caricano (Task 3, `carica-foto.sh`) e che si caricano **solo dopo il sì** alla migrazione.
- [ ] **Step 7: Commit**

```bash
git add tools/scarpe/schede.json tools/scarpe/scontorna.swift tools/scarpe/LEGGIMI.md tools/scarpe/foto/*.png
git commit -m "Scarpe: schede e foto ufficiali dei 12 modelli di prova"
```

---

### Task 2: Le caratteristiche come modulo puro

**Files:**
- Create: `src/lib/caratteristicheScarpa.js`
- Test: `src/lib/__tests__/caratteristicheScarpa.test.js`, `src/lib/__tests__/schedeScarpe.test.js`

**Interfaces:**
- Produces:
  - `LIVELLI: { valore, etichetta, classe }[]` — `principiante`/«Principiante»/`text-green-500 border-green-500/30 bg-green-500/10`, `intermedio`/«Intermedio»/`text-brand border-brand/30 bg-brand/10`, `avanzato`/«Avanzato»/`text-red-500 border-red-500/30 bg-red-500/10`.
  - `OPZIONI: { ammortizzamento, stabilita, piastra, uso }` — ognuna `{ valore, etichetta }[]` (etichette: Basso, Medio, Alto, Massimo · Neutra, Sostegno · Nessuna, Nylon/TPU, Carbonio · Lento, Ritmo, Ripetute, Gara, Trail).
  - `LIMITI = { drop_mm: [0,16], peso_g: [100,500], stack_mm: [10,60], vita_km: [200,2000] }`.
  - `righeCaratteristiche(modello) → { chiave, etichetta, valore }[]` — sempre 8, nell'ordine dei Global Constraints; `valore` è testo pronto («8 mm», «245 g», «38 mm», «Lento · Ritmo», «700 km», «Nylon/TPU») o «—».
  - `validaModello(campi) → { dati, errori }` — `dati` normalizzato per l'insert/update (numeri da testo con `numeroKm`, vuoti → `null`, `uso` filtrato ai valori noti, `peso_g`/`vita_km` interi); `errori` = `{ <campo>: 'testo' }` per marca/modello vuoti, fuori limite, URL non `https://`.
  - `sogliaProposta(modello) → number` — `vita_km` se valido, altrimenti `SOGLIA_PREDEFINITA` (700).

- [ ] **Step 1: Test che falliscono** in `caratteristicheScarpa.test.js`:
  - `righeCaratteristiche({})` ha 8 righe, etichette nell'ordine esatto, tutti i valori `'—'`.
  - `righeCaratteristiche({ drop_mm: 8, peso_g: 245, stack_mm: 38, piastra: 'nylon_tpu', uso: ['lento','ritmo'], vita_km: 700 })` → «8 mm», «245 g», «38 mm», «Nylon/TPU», «Lento · Ritmo», «700 km»; `drop_mm: 0` → «0 mm» (zero è un dato).
  - `uso: ['lento','volo']` → «Lento»; `uso: []` e `uso: null` → «—».
  - `validaModello({ marca:'Hoka', modello:'Clifton 10', drop_mm:'17' }).errori.drop_mm` definito; `peso_g:'99'` e `'501'` errore, `'245'` ok → `dati.peso_g === 245`; `url_ufficiale:'http://x'` errore; vuoti → `null`, nessun errore.
  - `sogliaProposta({ vita_km: 900 }) === 900`; `sogliaProposta({})`, `({ vita_km: 50 })` → 700.
- [ ] **Step 2: Test su `schede.json`** in `schedeScarpe.test.js`: importa `tools/scarpe/schede.json`, per ognuna `validaModello(scheda).errori` vuoto, `livello` non nullo, 12 voci, i 12 `marca+modello` uguali a quelli dei semi demo (importare `scarpe_catalogo` se esportato; altrimenti lista scritta nel test).
- [ ] **Step 3:** `npx vitest run src/lib/__tests__/caratteristicheScarpa.test.js src/lib/__tests__/schedeScarpe.test.js` → FAIL (modulo assente).
- [ ] **Step 4: Implementare** `src/lib/caratteristicheScarpa.js`. Serve `numeroKm`, ma importarlo da `scarpeDb.js` porterebbe dentro il client Supabase: spostare `numeroKm` in `kmScarpe.js` e ri-esportarlo da `scarpeDb.js` con lo stesso nome, così chi lo usa oggi non cambia.
- [ ] **Step 5:** stessi test → PASS; `npx vitest run src/lib/__tests__/scarpeDb.test.js` → PASS. Rompere apposta `sogliaProposta` (tornare sempre 700) e vedere fallire il test, poi ripristinare.
- [ ] **Step 6: Commit** `src/lib/caratteristicheScarpa.js`, `src/lib/kmScarpe.js`, `src/lib/scarpeDb.js`, i due test — «Scarpe: le caratteristiche dei modelli, uguali per tutti».

---

### Task 3: Migrazione, accesso ai dati e caricamento della foto

**Files:**
- Modify: `supabase/schema/scarpe_2026-11-02.sql`
- Create: `tools/scarpe/carica-foto.sh`
- Modify: `src/lib/scarpeDb.js`
- Create: `src/lib/fotoScarpa.js`
- Test: `src/lib/__tests__/scarpeDb.test.js`, `src/lib/__tests__/fotoScarpa.test.js`

**Interfaces:**
- Consumes: `validaModello`, `sogliaProposta` (Task 2).
- Produces:
  - `leggiModello(id) → modello | null` (null anche con tabelle assenti).
  - `salvaModelloCatalogo(campi)` e `aggiornaModelloCatalogo(id, campi)` passano da `validaModello`: errori → `throw new Error(<primo testo>)` prima della chiamata.
  - `aggiungiScarpa(...)` scrive `soglia_km: sogliaProposta(catalogo)`.
  - `caricaFotoModello(id, { blob, est, trasparente }) → foto_url` — `upload` su bucket `scarpe` al percorso `<id>.<est>` con `upsert: true` e `contentType` giusto, `getPublicUrl`, poi `aggiornaModelloCatalogo(id, { foto_url })`. L'URL salvato porta `?v=<Date.now()>` (la cache non tiene la foto vecchia) e, se `!trasparente`, il frammento `#sfondo` (convenzione come `#deleted=` delle note vocali).
  - `fotoConSfondo(url) → boolean` (true se finisce con `#sfondo`).
  - In `fotoScarpa.js`: `angoliTrasparenti(dati: Uint8ClampedArray, larghezza, altezza) → boolean` (i 4 pixel d'angolo con alpha < 16) e `riduciFoto(file, lato = 800) → Promise<{ blob, est, trasparente }>` (canvas; `toBlob('image/webp')`, se torna null o tipo diverso → `image/png`).

- [ ] **Step 1: Migrazione.** Nel `create table public.scarpe_catalogo` aggiungere le colonne con i `check` dei Global Constraints (`uso text[] check (uso <@ array['lento','ritmo','ripetute','gara','trail'])`, `drop_mm` con `check (drop_mm between 0 and 16)`). Dopo le policy: `insert into storage.buckets (id, name, public) values ('scarpe','scarpe',true) on conflict (id) do nothing;` e tre policy su `storage.objects` (insert / update / delete) con `bucket_id = 'scarpe' and public.e_staff() and public.email_corrente() <> 'demo@fleofit.it'` (lettura: bucket pubblico). In fondo, prima del `commit`, un blocco di 12 `update public.scarpe_catalogo set … where lower(marca)=… and lower(modello)=…;` generato da `schede.json`, ognuno preceduto da `-- fonte: <url_ufficiale>`. Aggiornare i commenti di verifica: policy attese, e la query di sola lettura
  `select policyname, cmd, qual, with_check from pg_policies where schemaname='storage' and tablename='objects';` con la nota «nessuna policy permissiva deve valere per ogni bucket», e il rollback (`delete from storage.objects where bucket_id='scarpe'; delete from storage.buckets where id='scarpe';`).
- [ ] **Step 2: `carica-foto.sh`**: legge `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` **dall'ambiente** (mai scritti nel file), per ogni `tools/scarpe/foto/<slug>.png` trova l'id del modello via REST, carica su `storage/v1/object/scarpe/<id>.png` (`x-upsert: true`) e fa `PATCH` di `foto_url`. Senza le variabili: messaggio ed esce. In testa: «Lo lancia il committente, dopo il sì alla migrazione». Non va eseguito in questo lavoro.
- [ ] **Step 3: Test che falliscono** in `scarpeDb.test.js` (con `fintoSupabase`): `aggiungiScarpa` con `catalogo.vita_km = 900` inserisce `soglia_km: 900`, senza → 700; `salvaModelloCatalogo({ marca:'X', modello:'Y', peso_g:'50' })` rifiuta **senza** chiamare insert; `leggiModello` con errore `42P01` → `null`; `caricaFotoModello('m1', { blob, est:'webp', trasparente:false })` chiama `upload('m1.webp', blob, { upsert:true, contentType:'image/webp' })` e salva un `foto_url` che finisce con `#sfondo`. In `fotoScarpa.test.js`: `angoliTrasparenti` su una 2×2 tutta alpha 0 → true, con un angolo alpha 255 → false; `fotoConSfondo`.
- [ ] **Step 4:** `npx vitest run src/lib/__tests__/scarpeDb.test.js src/lib/__tests__/fotoScarpa.test.js` → FAIL.
- [ ] **Step 5: Implementare** in `scarpeDb.js` e `fotoScarpa.js` (`riduciFoto` non ha test in jsdom: niente canvas; si prova a mano nel Task 5).
- [ ] **Step 6:** stessi test → PASS; `npx vitest run src/lib src/pages` → PASS.
- [ ] **Step 7: Commit** i file del task per nome — «Scarpe: colonne delle caratteristiche, bucket delle foto, caricamento».

---

### Task 4: `FotoScarpa` con le illustrazioni di ripiego

**Files:**
- Create: `src/components/FotoScarpa.jsx`
- Create: `src/assets/scarpe/allenamento.svg`, `gara.svg`, `trail.svg`, `ammortizzata.svg`
- Test: `src/components/__tests__/FotoScarpa.test.jsx`

**Interfaces:**
- Consumes: `fotoConSfondo` (Task 3).
- Produces: `<FotoScarpa url tipo alt className />` — con `url` mostra `<img loading="lazy" decoding="async">`; `onError` o `url` vuoto → l'SVG del `tipo` (`allenamento` se tipo sconosciuto o nullo), con `alt` uguale; `fotoConSfondo(url)` → la foto dentro un riquadro chiaro `bg-white rounded-2xl p-2`, l'attributo `data-sfondo="si"`.
- SVG: profilo di scarpa monocromo, tratto `currentColor`, viewBox 200×100, sotto 2 KB ciascuno, distinti per tipo (gara bassa e affusolata, ammortizzata con suola alta, trail con tacchetti).

- [ ] **Step 1: Test che falliscono**: senza `url` c'è l'immagine dell'illustrazione `gara` quando `tipo='gara'`; con `url` e poi `fireEvent.error(img)` passa all'illustrazione; tipo `'boh'` → `allenamento`; url con `#sfondo` → `data-sfondo="si"`.
- [ ] **Step 2:** `npx vitest run src/components/__tests__/FotoScarpa.test.jsx` → FAIL.
- [ ] **Step 3: Implementare** componente e quattro SVG (importati come URL di asset).
- [ ] **Step 4:** test → PASS.
- [ ] **Step 5: Commit** — «Scarpe: la foto del modello e il disegno quando manca».

---

### Task 5: Scheda del modello e foglio del modello completo

**Files:**
- Create: `src/pages/ModelloScarpa.jsx`
- Create: `src/components/ModelloScarpaUI.jsx`
- Create: `src/components/FoglioModelloCatalogo.jsx` (spostato da `ScarpeUI.jsx`, che lo ri-esporta per non rompere gli import)
- Modify: `src/components/ScarpeUI.jsx` (`ListaCatalogo`: la riga apre la scheda; miniatura `FotoScarpa` 48 px a sinistra)
- Modify: `src/pages/Scarpe.jsx` (passa `onApri={(m) => navigate('/scarpe/modello/' + m.id)}`)
- Modify: `src/App.jsx` (rotta lazy `/scarpe/modello/:id` **prima** di `/scarpe/:id`)
- Test: `src/pages/__tests__/ModelloScarpa.test.jsx`, `src/pages/__tests__/Scarpe.test.jsx`

**Interfaces:**
- Consumes: `leggiModello`, `aggiornaModelloCatalogo`, `caricaFotoModello`, `aggiungiScarpa` (Task 3); `righeCaratteristiche`, `LIVELLI`, `OPZIONI`, `validaModello`, `sogliaProposta` (Task 2); `riduciFoto` (Task 3); `FotoScarpa` (Task 4); `FoglioScarpa` esistente.
- Produces: `SchedaModelloUI({ modello, staff, curaCatalogo, onCeLho, onModifica, onPaginaUfficiale })`; `FoglioModelloCatalogo({ iniziale, onSalva, onCaricaFoto, onChiudi })` — `onCaricaFoto` assente = niente bottone «Carica foto». `ListaCatalogo` riceve in più `onApri(modello)`.

- [ ] **Step 1: Test che falliscono** in `ModelloScarpa.test.jsx` (mock di `scarpeDb` come in `Scarpe.test.jsx`):
  - atleta, modello con solo `drop_mm: 8` → le 8 etichette presenti, «8 mm» e sette «—»; pillola «Intermedio» se `livello:'intermedio'`; c'è «Ce l'ho», non c'è «Modifica».
  - «Ce l'ho» apre il foglio e il salvataggio chiama `aggiungiScarpa` con `catalogo` = il modello (quindi la soglia arriva da `vita_km`, Task 3).
  - coach → «Modifica», nessun «Ce l'ho»; utente `demo@fleofit.it` → né «Modifica» né «Carica foto».
  - con `url_ufficiale` c'è «Pagina ufficiale», senza no; con `foto_url` c'è «Foto: © del marchio».
  - `leggiModello` → `null` → «Modello non trovato».
  - foglio: `peso_g` «600» mostra l'errore e «Salva» è disabilitato; i campi a scelta usano `Filtro`; `uso` a scelta multipla.
- [ ] **Step 2:** in `Scarpe.test.jsx`, toccare il nome di un modello naviga a `/scarpe/modello/<id>`; «Ce l'ho» resta un bottone a parte che non naviga.
- [ ] **Step 3:** `npx vitest run src/pages/__tests__/ModelloScarpa.test.jsx src/pages/__tests__/Scarpe.test.jsx` → FAIL.
- [ ] **Step 4: Implementare.** Layout della scheda: testata sticky con indietro (`useIndietro('/scarpe')`), poi in `.cascata`: foto grande (`FotoScarpa`, altezza 220, su `bg-[#1e1e1e] rounded-3xl`), marca (`text-muted`), modello (`font-black text-[28px]`), pillole tipo + livello (stile badge §6), griglia 2 colonne di card `bg-white/[.035] rounded-[16px]` con etichetta piccola e valore `font-extrabold`, poi i bottoni. «Carica foto»: `<input type="file" accept="image/png,image/webp,image/jpeg">` nascosto; dopo `riduciFoto`, se `!trasparente` il foglio mostra «Questa foto ha lo sfondo: si vedrà in un riquadro» e carica comunque; errore → `CustomAlert`.
- [ ] **Step 5:** test → PASS; `npx vitest run` → tutta la suite verde (tranne `demoGarmin`, che fallisce già su `app` a seconda della data: segnalarlo, non toccarlo).
- [ ] **Step 6: Prova a mano** in `npm run demo` (coach): «Carica foto» con un PNG scontornato di `tools/scarpe/foto/` e con un JPG → il secondo mostra l'avviso; nella demo l'URL è finto (`esempio.invalid`), quindi si vede il disegno: è il ripiego giusto.
- [ ] **Step 7: Commit** i file del task — «Scarpe: la scheda di ogni modello, uguale per tutti».

---

### Task 6: Il banner in Home

**Files:**
- Create: `src/lib/bannerScarpe.js`
- Create: `src/components/BannerScarpe.jsx`
- Modify: `src/pages/Home.jsx` (ramo atleta: dopo il blocco `BannerObiettivo`/`BannerObiettivoVuoto`; `lazy` + `Suspense fallback={null}`)
- Modify: `src/components/HomeCoachTelefono.jsx` (dopo `CardGare`), `src/components/HomeCoachDesktop.jsx` (in fondo alla colonna principale)
- Test: `src/lib/__tests__/bannerScarpe.test.js`, `src/components/__tests__/BannerScarpe.test.jsx`

**Interfaces:**
- Consumes: `leggiScarpeAtleta`, `elencoCatalogo`, `tabelleAssenti`; `testoKm`; `FotoScarpa`; `vibraScelta`.
- Produces:
  - `contenutoBanner({ ruolo: 'atleta'|'coach', scarpe, catalogo }) → { titolo, bottone, foto, tipo } | null`.
    - atleta, una scarpa attiva con `stato === 'oltre'` (la prima) → `titolo: '<modello> è da cambiare'`, `bottone: 'Scegli la nuova'`;
    - altrimenti la principale attiva, o la prima attiva → `'<modello> · <testoKm(km)> km'`, `'Le mie scarpe'`;
    - nessuna attiva → `'Tieni il conto dei km delle tue scarpe'`, `'Aggiungi la tua'`, foto del primo modello del catalogo con foto (alfabetico), tipo `allenamento`;
    - `foto`/`tipo` della scarpa scelta presi dal suo `catalogo_id`; scarpa a mano → `foto: null, tipo: 'allenamento'`.
    - coach → `'Il catalogo scarpe · <N> modelli'`, `'Apri'`, il primo modello con foto per `marca, modello`; catalogo vuoto → `null`.
  - `<BannerScarpe ruolo uid onApri />` — legge i dati da sé; errore o `tabelleAssenti` → `null` (niente a schermo); mentre carica → `null` (il banner compare, non sposta un segnaposto).

- [ ] **Step 1: Test che falliscono** in `bannerScarpe.test.js`: i tre casi atleta (con i titoli esatti sopra), «oltre» vince sulla principale, solo ritirate → «Tieni il conto…», scarpa a mano → `foto:null, tipo:'allenamento'`, coach con 114 modelli → «Il catalogo scarpe · 114 modelli», coach catalogo vuoto → `null`, la foto del coach è del primo con foto in ordine alfabetico anche se l'array arriva disordinato.
- [ ] **Step 2: Test che falliscono** in `BannerScarpe.test.jsx`: con `leggiScarpeAtleta` che lancia `{ code:'42P01' }` non rende niente; con dati → il titolo è un'intestazione, il pulsante «Le mie scarpe» chiama `onApri`; con foto rotta resta il disegno.
- [ ] **Step 3:** `npx vitest run src/lib/__tests__/bannerScarpe.test.js src/components/__tests__/BannerScarpe.test.jsx` → FAIL.
- [ ] **Step 4: Implementare.** Tutta la card è un `<button>` con `aria-label` = titolo; la pillola nera dentro è uno `<span>` con il testo del bottone (niente secondo bottone annidato). Foto: `absolute right-2 -top-6 w-[46%] -rotate-12 drop-shadow`, la card `relative overflow-visible mt-6`. Pressione: `active:scale-[.98] transition-transform duration-150`. In Home atleta `onApri={() => navigate('/scarpe')}`; nel coach lo stesso.
- [ ] **Step 5:** test → PASS; `npx vitest run src/pages` → PASS (le Home esistenti: il banner pigro non deve rompere i loro mock — se serve, mockare `BannerScarpe` nei test di Home).
- [ ] **Step 6: Peso.** `npm run build` → chunk `index` ≤ 616,7 KB. Se sfora: l'import di `BannerScarpe` non è pigro.
- [ ] **Step 7: Commit** i file del task — «Scarpe: il banner in Home, per l'atleta e per il coach».

---

### Task 7: Ambiente di prova

**Files:**
- Modify: `src/demoSemi.js` (`scarpe_catalogo()` con le caratteristiche da `schede.json` e `foto_url` dalle foto locali; `VERSIONE_SEME` 17 → 18)
- Test: `src/__tests__/demoSemiScarpe.test.js`

**Interfaces:**
- Consumes: `tools/scarpe/schede.json`, `tools/scarpe/foto/*.png` (Task 1), `validaModello` (Task 2).

- [ ] **Step 1: Test che fallisce**: i 12 modelli dei semi hanno `livello` non nullo, `validaModello(m).errori` vuoto, e `foto_url` non vuoto.
- [ ] **Step 2:** `npx vitest run src/__tests__/demoSemiScarpe.test.js` → FAIL.
- [ ] **Step 3: Implementare**: `import schede from '../tools/scarpe/schede.json'` e `import.meta.glob('../tools/scarpe/foto/*.png', { eager: true, query: '?url', import: 'default' })`, unite per `slug`. Nessun file in `public/`. ⚠️ `validaModello` vuole `https://`: nella demo `foto_url` è un URL locale, quindi il test controlla `foto_url` non vuoto e passa a `validaModello` il modello **senza** `foto_url`.
- [ ] **Step 4:** test → PASS.
- [ ] **Step 5: Le foto non devono finire nel build vero.** `npm run build` poi `ls dist/assets | grep -iE 'clifton|pegasus|hoka|nike' ; grep -c "AMBIENTE DI PROVA" dist/assets/*.js` → nessun file e tutti 0. Se le PNG compaiono: passare a `import.meta.glob` **non** eager dentro una funzione chiamata solo da `clientDemo`.
- [ ] **Step 6: Prova a mano** con il server `scarpe-atleta` (porta 5185, `localStorage.adminRoleOverride='athlete'`): Home di Sara con il banner «Clifton 10 · … km», tocco → `/scarpe`, tocco su un modello → la scheda con foto, otto righe, «Pagina ufficiale». Poi da coach: banner «Il catalogo scarpe · 12 modelli». Screenshot di entrambe a 375 px.
- [ ] **Step 7: Commit** `src/demoSemi.js` e il test — «Scarpe: la demo con foto e caratteristiche».

---

### Task 8: Memoria e backlog

**Files:**
- Modify: `docs/memoria/scarpe.md` (banner, scheda del modello, colonne, bucket, convenzione `#sfondo` e `?v=`, criterio della valutazione FLEOFIT, come si caricano le foto)
- Modify: `BACKLOG.md` (voce: «Sostituire le foto ufficiali dei marchi prima di mandare ad App Store la versione che le mostra» e «Caricare le 12 foto dopo il sì alla migrazione»)
- Modify: `CLAUDE.md` §4 riga `scarpe_*` (colonne nuove e bucket `scarpe`) e §11 (nuovi file: `caratteristicheScarpa.js`, `fotoScarpa.js`, `bannerScarpe.js`, `BannerScarpe`, `FotoScarpa`, `ModelloScarpa.jsx`, `ModelloScarpaUI`, `FoglioModelloCatalogo`, `tools/scarpe/`)

- [ ] **Step 1:** scrivere le tre modifiche.
- [ ] **Step 2:** `npm test` e `npx eslint src/lib/caratteristicheScarpa.js src/lib/fotoScarpa.js src/lib/bannerScarpe.js src/components/BannerScarpe.jsx src/components/FotoScarpa.jsx src/components/ModelloScarpaUI.jsx src/components/FoglioModelloCatalogo.jsx src/pages/ModelloScarpa.jsx src/demoSemi.js` → nessun errore nuovo; annotare il numero di test.
- [ ] **Step 3: Commit** `docs/memoria/scarpe.md BACKLOG.md CLAUDE.md` — «Scarpe: memoria del banner e delle schede».
