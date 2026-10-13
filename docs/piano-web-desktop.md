# Piano — web app aggiornata e versione desktop

> Scritto il 13/10/2026. Stato: **proposta, niente è ancora stato toccato.**
> Misure prese dopo `git fetch` il 13/10/2026.

## 1. La situazione, misurata

- `main` (web, Vercel) è fermo al 09/10/2026 (`d7d53cd`); `app` è a `be3379d` (13/10).
  Divergono di **50 commit solo su `main` e 173 solo su `app`**, a partire da un antenato
  comune del 13 **maggio**. Hanno toccato gli stessi file grandi (`CreateWorkout`,
  `WorkoutDetail`, `TVDashboard`).
- I 50 commit di `main` sono quasi tutti cose **già riportate su `app`** (TV, cestino,
  backup, titolo facoltativo, notifiche di assegnazione, EMOM su più minuti) o fix di maggio
  su file che `app` ha poi riscritto.
- File che esistono solo su `main`: `App.css`, `pages/Invite.jsx`, `pages/patch.js`,
  `pages/useTouchDrag.js`. Nessuno è collegato a una rotta: sono residui.
- Rotte: `app` ha tutte quelle di `main` più `/report` e `/report/:id`.

### Il codice di `app` gira già nel browser
Provato oggi: `npm run demo` a 1440×900, Home coach e builder si aprono, **zero errori in
console**. Il motivo è che `app` è stato scritto con il ramo web sempre presente (i test
girano proprio sul ramo web, `src/test/setup.js`). Punto per punto:

| Cosa | Sul web oggi in `app` |
|---|---|
| Accesso Google | ✅ redirect su `window.location.origin` invece di `fleofit://` |
| Sign in with Apple | ⚠️ **nascosto sul web** (manca Services ID + chiave .p8) — vedi rischio R1 |
| Dettatura IA, note vocali | ✅ `MediaRecorder` + `getUserMedia` |
| «Da un testo scritto» (foto→testo) | ⚠️ solo nativo: `fotoDisponibile()` nasconde il bottone |
| Export PDF, story, backup | ✅ ramo web con `link.download` / `navigator.share` |
| Push | ✅ Web Push VAPID + `sw.js` già in `Settings.jsx` (stessa `send-reminders`) |
| Tastiera, badge, status bar, aptica | ✅ già dietro `isNativePlatform()` (l'aptica sul web tace) |
| Rete (offline), KeepAwake TV | ✅ i plugin hanno implementazione web |
| Galleria | ✅ fuori da Android scarica il file |

### Cosa NON c'è: il desktop
In tutto `src/` ci sono **0** classi `md:`, `lg:`, `xl:` (12 `sm:`). A 1440 px l'app è la
colonna del telefono stirata, con la capsula della tab bar in fondo allo schermo.

## 2. La strategia: un codice solo, tre destinazioni

**Non** portare `app` dentro `main` commit per commit: 173 commit e conflitti reali sui file
più grandi, e il lavoro andrebbe rifatto a ogni sessione su `app`. Invece:

> **`app` diventa la sorgente anche della web app.** Vercel costruisce da `app`;
> `main` va in pensione (resta come tag `web-legacy-2026-10` per tornare indietro).

Effetti collaterali, tutti positivi: spariscono da soli i problemi di convivenza che oggi
stanno nel BACKLOG — RPE distrutto dalla web (#22), pausa cancellata (#14-ter), font Inter
mancante (#23), contrasto dei grigi (#24), divario fra branch (#20).

**Lo schema del database non si tocca**: niente di questo piano richiede migrazioni.

## 3. Le fasi

### Fase 0 — Preparazione (nessun effetto sugli utenti)
1. Vercel: controllare *Production Branch* e se le **preview** dei branch sono pubbliche.
2. Vercel: verificare che `VITE_DEMO` **non** sia impostata (sennò si pubblicano i dati finti).
3. Supabase → Auth → URL di redirect: confermare `https://fleofit.vercel.app/**`.
4. Confrontare `public/manifest.json` (diverso fra i branch) e decidere quale tenere.
5. Decidere dove vivono i cron di GitHub (`db-backup.yml` gira **solo dal branch di
   default**): o `app` diventa il default, o `main` resta default solo per i workflow.

#### ✅ Esito della fase 0 (13/10/2026, solo letture)

| Punto | Esito |
|---|---|
| 1. Vercel, branch di produzione | **`main`**: l'unico deploy *Production* di GitHub è `d7d53cd`. Vercel costruisce una *Preview* per ogni push di `app` (66 preview finora) |
| 1. Preview pubbliche? | **No, protette**: l'URL della preview di `be3379d` risponde 302 verso il login Vercel (SSO). Il rischio R4 è chiuso |
| 2. `VITE_DEMO` su Vercel | ⚠️ **Non verificabile da qui** (manca la CLI di Vercel). Da controllare a mano, vedi sotto. Dopo il primo build della fase 1 si verifica anche sul bundle: nessun «AMBIENTE DI PROVA» nei `.js` |
| 3. URL di redirect Supabase | ⚠️ **Non leggibile da qui** senza la chiave dell'API di gestione. Da controllare a mano, vedi sotto |
| 4. Manifest | Nessuno dei due `index.html` collega un manifest: **oggi il sito non ne usa nessuno**. `manifest.json` su `app` punta a `../icons/*.webp`, percorsi che sul web non esistono. In fase 1: collegare `site.webmanifest` (PNG giuste) e togliere `manifest.json` |
| 5. Cron di backup | `db-backup.yml` è **identico** sui due branch e il branch di default è `main`. Vedi la proposta sotto: `main` resta default e il cron non si sposta |
| R1. Account Apple | Fra gli atleti attivi: **2 entrano solo con Apple e non hanno password**, 1 ha Apple + Google (sul web userà Google). Gli altri 13 usano email (5) o Google (8) |
| In più | ⚠️ **GitHub Pages pubblica `ios-version`** su `coaching-fleo.github.io/fleofit/`, compresa `privacy-policy.html` (risponde 200): con buona probabilità è l'URL della privacy dichiarato ad App Store. **`ios-version` non va cancellato** finché quell'URL non è spostato |

**Proposta per i branch (risolve il punto 5 senza toccare impostazioni).** Al momento del
passaggio: su `app` un merge `-s ours` di `origin/main` (registra la storia di `main` ma
tiene il contenuto di `app`), poi `main` avanza a `app` in fast-forward. `main` resta il
branch di default e di produzione: Vercel, cron e Pages non cambiano. Da lì in poi `app`
resta il branch di lavoro e **`main` = ciò che è pubblicato sul web**: si porta avanti con
un fast-forward quando si vuole rilasciare.
⚠️ Prima del merge, in fase 1, si verifica che i 50 commit di `main` siano davvero già su
`app` **per funzione, non per righe** (`app` ha riscritto le schermate: il confronto riga
per riga dice poco). Quelli da controllare uno per uno sono i fix di maggio su TV, timer
(beep), opzioni di ergometri e distanze, export PDF/story.

**Due controlli che restano al committente (5 minuti):**
- Vercel → progetto `fleofit` → Settings → Environment Variables: **non** deve esserci
  `VITE_DEMO` (né `VITE_DEMO_ATLETA`) in nessun ambiente.
- Supabase → Authentication → URL Configuration: *Site URL* `https://fleofit.vercel.app`,
  e fra le *Redirect URLs* `https://fleofit.vercel.app/**` e `fleofit://login-callback`.
  Per provare l'accesso Google sulle preview servirebbe anche
  `https://*-coaching-4945s-projects.vercel.app/**`; altrimenti sulle preview si prova
  con email e password.

### Fase 1 — La web app prende il codice di `app` (aspetto mobile, invariato)
1. Deploy di `app` come **preview** Vercel, protetta.
2. Prova completa come coach e come atleta su: Chrome e Safari desktop, Safari iPhone,
   Chrome Android. Lista dei flussi: accesso (email, Google), invito, crea/assegna workout,
   completa con RPE, nota vocale, export PDF/story, push web, TV dashboard, offline.
3. Correggere i soli inciampi del web che emergono (dietro `isNativePlatform()`).
4. **Passaggio**: Vercel *Production Branch* → `app`. Tornare indietro = un clic su
   *Instant Rollback*.

#### Esito della fase 1, parte senza account veri (13/10/2026)
- **I 50 commit di `main` sono già su `app`, per funzione.** Controllati uno per uno quelli
  di maggio-giugno: TV (la versione di `app` è la stessa, rifattorizzata: wake lock, audio,
  telecomando), beep del timer più lunghi (`createBeepURI(1200, 1000)` e `1.5` ci sono),
  opzioni di ergometri, carry e distanze di corsa (ora nel righello, `scaleMisura.js`, fino
  a 42 km), export PDF/story (`app` ha un flusso suo, la story passa da `navigator.share`
  con il PNG), assegnazione di più workout insieme, `useTouchDrag`. I commit di agosto e
  ottobre erano già ritorni da `app` verso `main`. **Non c'è niente da riportare.**
- **Build di produzione**: passa, e nel bundle non c'è niente dell'ambiente di prova.
- **Nel browser** (ambiente di prova, coach, 1440 px e 375 px): Home, Calendario, Atleti,
  scheda atleta, scheda workout, Archivio, Report, Impostazioni, Crea workout si aprono
  **senza un errore in console**. Su schermo largo il contenuto è già una colonna centrata
  di 672 px.
- **Corretto**: il sito non collegava nessun manifest (ora `site.webmanifest`, con le PNG
  giuste e il fondo `#0B0B0B`); `manifest.json` puntava a file inesistenti ed è tolto; le
  notifiche web usavano `/vite.svg`, che non esiste, come icona.
- Test: **1751 verdi**.

#### Cosa resta (serve il committente)
1. **Pubblicare `app`** (la fascia «Salva e pubblica»): Vercel costruisce la preview
   protetta, e il link compare fra i deploy del commit su GitHub.
2. **Prova con account veri sulla preview**, coach e un atleta di prova, da Chrome e Safari
   sul Mac e da Safari su iPhone: accesso con email (Google funziona sulla preview solo se
   Supabase ammette quell'indirizzo, vedi fase 0), crea e assegna un workout, l'atleta lo
   completa con RPE e una nota vocale, il coach la ascolta, export PDF, attivazione delle
   notifiche web da Impostazioni, Modalità TV.
3. **Il passaggio**, solo dopo un sì esplicito — è il momento in cui il sito cambia per tutti:
   ```bash
   git fetch origin
   git tag web-legacy-2026-10 origin/main && git push origin web-legacy-2026-10
   git checkout app && git merge -s ours origin/main -m "Il sito prende il codice dell'app"
   git push origin app
   git checkout main && git merge --ff-only app && git push origin main
   ```
   Vercel pubblica `main` in produzione. Per tornare indietro: *Instant Rollback* su Vercel
   (immediato), poi `git push --force-with-lease origin web-legacy-2026-10:main` solo se
   serve davvero.
4. Dopo il passaggio: aggiornare CLAUDE.md §1.1 e `docs/memoria/branch.md` (`main` =
   ciò che è pubblicato sul web, `app` = branch di lavoro).

Risultato: chi apre il sito dal telefono vede subito l'app di oggi. Dal PC la vede ancora a
colonna stretta, ma centrata e corretta (fase 2).

### Fase 2 — L'impalcatura desktop
Regola d'oro: **sotto i 1024 px non cambia un pixel, e nelle app native non cambia niente.**

- Il layout desktop si accende solo con **web, larghezza ≥ 1024 px e ruolo coach**
  (un hook `useDesktop()` + una classe sul `<html>`, così il CSS usa `lg:` senza toccare
  iPad nell'app). Le app iOS/Android restano identiche anche su iPad. Un **atleta** che
  apre il sito dal PC vede l'app di oggi in una colonna centrata (decisione del
  committente, 13/10/2026). ⚠️ L'admin che simula l'atleta (`adminRoleOverride`) deve
  vedere la versione atleta: la condizione legge il ruolo **effettivo**.
- **Guscio**: barra laterale a sinistra al posto della capsula (Home, Calendario, Atleti,
  Crea, Report, Impostazioni), barra in alto con la ricerca IA già esistente
  (`RicercaCoach`) aperta da ⌘K, campanella delle notifiche.
- Le **modali e i bottom sheet** diventano pannelli laterali o finestre centrate; lo
  `useBottomSheet` resta per il mobile.
- I componenti desktop si caricano **pigri** (`lazy`): il chunk `index` (594 KB) e
  `CreaWorkoutUI` (18 KB) non devono crescere per chi usa il telefono (CLAUDE.md §2).
- Logica e dati restano nelle pagine; il desktop è un nuovo `*UI` accanto a quello mobile,
  come già si fa oggi.
- Controllo a ogni passo: screenshot a 390 px prima/dopo, che devono coincidere.

#### ✅ Stato al 13/10/2026: guscio e tre schermate fatti
- **Regola**: `src/useDesktop.js` — `eDesktop(schermoLargo, role)`: web + ≥ 1024px + ruolo
  diverso da `athlete`. Coperta da test (`src/__tests__/useDesktop.test.js`).
- **Guscio**: `App.jsx` monta `BarraLaterale` (pigra) al posto della `Navbar` e mette
  `html.desktop`, che in `src/index.css` azzera `--altezza-navbar` e trasforma i fogli dal
  fondo (`fixed … justify-end > .rounded-t-3xl`) in finestre centrate di 640px. ⌘K apre la
  ricerca da ogni pagina.
- **Home coach**: `HomeCoachDesktop.jsx` (pigra), lista unica «Da guardare»
  (`src/lib/cosaGuardare.js`, con test) + «Oggi» + copertura dei prossimi 3 giorni.
- **Calendario**: `src/pages/CalendarioTeam.jsx` (pigra) — settimana × atleti, libreria da
  trascinare (assegna + push `immediate`), sessioni da trascinare per cambiare giorno (solo
  stesso atleta, solo non completate), doppio clic per creare. Logica in
  `src/lib/calendarioTeam.js`, con test. «Mese» riporta al calendario di prima.
- **Crea workout**: niente passo 1; colonna destra `CreaWorkoutDesktop.jsx` con categoria,
  nome, data, riepilogo, intensità, tipi di blocco e salvataggio (⌘S). `DueColonne` in
  `CreateWorkout.jsx` non aggiunge nulla sul telefono.
- **Peso**: il pacchetto iniziale va da 617 a 619 KB. `index-*.js` sembra salito di 30 KB
  ma è il locale italiano di date-fns, che prima stava in un chunk a parte caricato
  comunque all'avvio.
- **Le altre pagine** (Atleti, scheda atleta, scheda workout, Report, Archivio,
  Impostazioni) dentro il guscio restano la loro colonna centrata: sono i punti 2, 5 e 6
  qui sotto.

#### ✅ Secondo giro, 13/10/2026 (richieste del committente)
- **Login**: `Guscio` di `LoginUI.jsx` su schermo largo (qui il ruolo non si conosce: conta
  solo `useSchermoLargo`) si divide in due, marchio a sinistra e accesso a destra. Test:
  `GuscioLogin.test.jsx`.
- **Calendario**: la griglia scorre nel suo riquadro, con la riga dei giorni `sticky top-0`
  e la colonna dei nomi `sticky left-0`: con tanti atleti la data resta visibile.
- **Atleti**: `AtletiDesktop.jsx` (pigra), tabella atleta · dati · settimana · ultimo ·
  stato; «ultimo» da `src/lib/tabellaAtleti.js` (con test).
- **Scheda atleta**: `AthleteDetail.jsx` scrive i pezzi una volta (`pTestata`, `pAndamento`…):
  il telefono li impila nell'ordine di sempre, il desktop li mette su due colonne con
  Assegna e Crea in alto; storico e record partono aperti.
- **Archivio**: `ArchivioDesktop.jsx` (pigra), filtri in colonna a sinistra (gli stessi
  componenti del telefono) e schede in griglia per mese.
- Restano col disegno del telefono dentro il guscio: scheda workout, Report, Impostazioni.

#### ✅ Terzo giro, 13/10/2026: la pagina Analisi
- **`/analisi`**, voce «Analisi» sotto «Report» nella barra laterale. Solo desktop
  coach: fuori dal desktop rimanda a `/report`. Accanto al Report, non al suo posto
  (decisione del committente): il Report dice cosa fare questa settimana, Analisi
  come sta andando su 4/8/12/26 settimane.
- Calcoli in `src/lib/analisi.js` (riusa `reportSettimanale`: l'ACWR è lo stesso
  numero, un test lo confronta), grafici SVG senza librerie in
  `src/components/grafici/`, presentazione in `AnalisiUI.jsx`.
- Filtri nell'URL (`?periodo=&atleta=&categoria=`). Lettura **a pagine** da 1000
  righe: una lettura sola si fermerebbe in silenzio.
- Piano e confronto coi concorrenti: `docs/superpowers/plans/2026-10-13-desktop-analisi-e-confronto.md`.

#### ✅ Quarto giro, 13/10/2026: fase 2 del piano Analisi
- **Analisi**: storico di un esercizio con un atleta scelto (`storicoEsercizio.js`,
  `StoricoEsercizio.jsx`), «Esporta CSV» e «Stampa».
- **Home coach**: «Ultime sedute chiuse» degli ultimi 7 giorni (`ultimeSedute.js`).
- **Calendario team**: «Copia settimana» (`copiaSettimana` in `calendarioTeam.js`).
- Piano: `docs/superpowers/plans/2026-10-13-desktop-fase-2.md`.

### Fase 3 — Le schermate desktop, coach per primo
Il coach è chi lavora alla scrivania; l'atleta usa il telefono. Ordine proposto:

1. **Calendario** — griglia settimana/mese vera, con **trascinamento** di un workout su un
   atleta o su un giorno. È la cosa che il desktop fa e il telefono no.
2. **Atleti + scheda atleta** — elenco a sinistra, scheda a destra (master-detail), senza
   cambiare pagina.
3. **Crea workout** — editor dei blocchi a sinistra, anteprima e stima di durata/carico a
   destra, «Genera con IA» e incolla da testo in un pannello.
4. **Home coach** — cruscotto a griglia: feedback da leggere, atleti fermi, settimana.
5. **Report** — tabelle e grafici larghi, esportabili.
6. Scheda workout, archivio, impostazioni.
7. ~~Lato atleta~~: **escluso** per decisione del committente (13/10/2026). L'atleta resta sulla colonna mobile centrata.

### Fase 4 — Rifinitura
Scorciatoie da tastiera, stati hover, tabelle ordinabili, stampa, test e aggiornamento di
CLAUDE.md §1.1 (i branch cambiano significato) e di `docs/memoria/branch.md`.

## 4. La grafica desktop
Palette **invariata** (CLAUDE.md §6). Dai servizi del mercato (CoachPlus, TrainHeroic,
TrueCoach/CoachWay, TrainingPeaks) si prende **la struttura** che il coach si aspetta —
barra laterale, calendario come centro del lavoro, master-detail sugli atleti — non
l'estetica da gestionale. L'estetica viene dall'app: superfici scure, card arrotondate,
numeri grandi, colori di categoria, movimento sobrio, più aria e meno righe di tabella.
Riferimenti di linguaggio: Linear, Whoop, Strava web.

**Prima di scrivere codice**: tre bozze navigabili (Home coach, Calendario, Crea workout)
da approvare. Le altre schermate seguono quelle regole.

## 5. Rischi

| # | Rischio | Cosa si fa |
|---|---|---|
| ~~R1~~ | Un atleta registrato **con Apple** su iPhone non può entrare dal browser | **Chiuso** (13/10/2026): il desktop è solo per i coach, e chi entra con Apple usa l'app iOS. Non è una regressione: anche oggi su `main` Apple non c'è. Si riapre se un giorno il desktop arriva agli atleti |
| R2 | Ogni modifica a `app` arriva anche nel prossimo build iOS/Android | Il desktop è dietro `web && ≥1024px`; controllo a 390 px a ogni passo; nessuna modifica a componenti mobili esistenti senza motivo |
| R3 | Il passaggio della fase 1 cambia l'app a tutti gli utenti web in un colpo | Preview prima, rollback istantaneo Vercel, avviso agli atleti |
| R4 | Preview Vercel pubbliche di `app` | Fase 0 punto 1 |
| R5 | Cron di backup che smette di girare se cambia il branch di default | Fase 0 punto 5, verificato con un'esecuzione a mano |
| R6 | Peso dei chunk per i telefoni | `lazy` sui componenti desktop, misura del build a ogni fase |
| R7 | «Feedback letto» e simili restano per dispositivo (BACKLOG #14-bis) | Limite noto, serve una migrazione: fuori da questo piano |

## 6. Decisioni del committente
1. Ok alla strategia «`app` sorgente unica, `main` in pensione»?
2. Quale branch è il default su GitHub dopo il passaggio?
3. ✅ **Solo per i coach** (13/10/2026).
4. ✅ Non serve: vedi R1.
5. ✅ Bozze approvate, con la Home semplificata (13/10/2026).
