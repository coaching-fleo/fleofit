# Product

<!-- impeccable:product-schema 1 -->

## Platform

ios

## Users

**Atleta seguito da Federico Leo** (utente primario per volume d'uso). Pratica Hyrox o
running. Apre l'app **prima dell'allenamento**, per leggere la scheda assegnata e capire
cosa deve fare, e **dopo**, per segnarla come completata con RPE ed eventuali note.
Il **timer guidato è opzionale**: viene usato solo da chi sceglie di farsi accompagnare
durante l'esecuzione. L'uso non è quindi principalmente "a metà workout, mani sudate":
la scena reale è consultazione a mente lucida prima, resoconto dopo.

**Coach (admin)** — oggi Federico Leo. Usa l'app soprattutto per **creare e assegnare
workout**, e per seguire lo storico e i progressi degli atleti. È la sessione più lunga e
più densa di input dell'intero prodotto.

**Ruolo `coach` di terzi** — previsto nel codice ma disattivato (`App.jsx:109-112`).
Vedi Capabilities and Constraints: l'apertura ad altri coach è una direzione confermata,
non ancora una funzionalità.

## Product Purpose

FLEOFIT è l'app di coaching personale di Federico Leo, specializzata su **Hyrox** e
**Running**. Chiude il ciclo coach↔atleta dentro un unico strumento: il coach compone il
workout, lo assegna a una data, l'atleta lo riceve (push), lo esegue, lo chiude con RPE e
note, e il coach vede il risultato in tempo reale.

Ha successo quando l'atleta non deve chiedere "cosa faccio oggi?" e il coach non deve
chiedere "come è andata?".

## Positioning

Non è un tracker generalista né un catalogo di schede: è il **canale di lavoro di un coach
specifico con i suoi atleti**, e conosce il vocabolario Hyrox in modo nativo. Il workout
builder ragiona in blocchi reali della disciplina (WarmUp, Cash In, ON/OFF, EMOM, AMRAP,
For Time, Interval, Rest, Cash Out) e in fasi di corsa con range di passo, non in
"serie × ripetizioni". Registrazione chiusa su codice di invito: l'accesso è una relazione
di coaching, non un sign-up.

## Operating Context

- **Atleta:** telefono, sessioni brevi. Consultazione prima della sessione, chiusura con
  RPE dopo. Il timer guidato (con beep, vibrazione, KeepAwake, minimizzabile) è un'opzione
  durante l'esecuzione, non il percorso principale.
- **Coach:** creazione workout, l'attività più lunga e articolata. Il builder ha
  drag&drop desktop **e** `useTouchDrag` per mobile: entrambi i contesti sono reali.
- **Superfici secondarie già esistenti:** TV Dashboard (`/tv`, cast con codice a 4 cifre,
  lettura a distanza), story Instagram, export PDF della scheda, Live Coach Cam
  (spettatore live del timer con reazioni e messaggi audio walkie-talkie).
- **Modalità Offline:** rete assente → banner e coda di azioni in localStorage,
  sincronizzata al ritorno della linea.
- Il coaching reale avviene anche fuori dall'app: notifiche push mattina/sera e note
  vocali bidirezionali coach↔atleta sono parte del rituale.

## Capabilities and Constraints

- **Ruoli:** `admin` (coach), `athlete`, `coach` previsto ma disattivato. Il ruolo admin è una
  **lista di email hardcodata in TRE posti indipendenti** che devono restare allineati:
  `src/App.jsx:35` (decide cosa la UI mostra), `supabase/functions/send-reminders/index.ts:261`
  (decide chi riceve le notifiche coach) e **le policy RLS di 6 tabelle** (decidono cosa il
  database consegna davvero). Verificato il 24/08/2026: la terza lista è **disallineata** e non
  contiene `demo@fleofit.it`, l'account del revisore Apple. Chi vede la UI da admin ma non è nella
  lista RLS ottiene un'interfaccia coach **vuota**. Vedi CLAUDE.md §4-bis.
- **Registrazione chiusa:** senza `invitation_code` valido il `ProtectedRoute` fa signOut.
- **Backend condiviso, senza staging:** un solo progetto Supabase e un solo set di Edge
  Function servono sia l'app iOS (`ios-version`) sia la web app in produzione (`main`).
  Una migrazione fatta per iOS colpisce subito la web app. Dettagli in CLAUDE.md §1.1.
- **Due branch divergenti e vivi, con destinazioni asimmetriche:** `main` è **collegato a Vercel**
  ed è la web app che gli atleti usano oggi; `ios-version` **non è collegato a nulla** — è il
  backup su GitHub del lavoro locale, e la build App Store nasce da Xcode, non da un deploy.
  Non sono intercambiabili, e pushare su `ios-version` non pubblica niente. Divergenza al
  24/08/2026: 41 commit solo su `main`, 22 solo su `ios-version`, in crescita.
- **Un fix destinato agli atleti di oggi deve arrivare su `main`**, altrimenti per loro non esiste.
  Vale in particolare per i workflow GitHub, che girano solo dal branch di default.
- **Incompatibilità dati nota:** `main` non conosce l'RPE; il prefisso `[RPE: x/10]`
  scritto da iOS in `athlete_workouts.notes` appare come testo grezzo sulla web app e può
  essere distrutto da una modifica lì.
- **Terminologia vincolante:** "Cash In"/"Cash Out" sono termini Hyrox e **non si
  rinominano** (decisione del committente, 24/08/2026). Sono valori persistiti in
  `workouts.sections.blocks[].type` (jsonb) su un DB condiviso: mai find&replace.
  Il rischio App Store 3.2.1(viii) si gestisce **disambiguando** (didascalie in chiaro via
  `src/lib/blockHints.js`), non rinominando.
- **Formato legacy da non rompere:** esistono workout con `sections.warmup/cashIn/main/
  cashOut` invece di `blocks`; la normalizzazione runtime va preservata.
- **Lingua:** interfaccia e commenti in italiano. Nessuna i18n prevista al momento.
- **Direzione confermata (non ancora implementata):** apertura ad **altri coach**. Il
  design futuro deve prevedere multi-tenancy e onboarding coach, e non aggravare gli
  hardcoding personali (`ADMIN_EMAILS`, `COACHING_ID`).
- 🔒 **CONGELAMENTO DELLO SCHEMA (decisione del committente, 24/08/2026).** Finché l'app non è
  approvata sull'App Store e il prodotto non passa definitivamente alla sola versione app, **il
  database non si tocca**: niente migrazioni, niente nuove tabelle, niente modifiche alle policy
  RLS. Il motivo è che l'unico database serve contemporaneamente la web app in produzione, e non
  esiste staging. Il congelamento riguarda **le modifiche**, non le letture: verificare policy,
  contare righe ed esportare dati resta permesso e a rischio zero. Ogni funzionalità che richieda
  una migrazione (per esempio il log strutturato dei risultati) è **rinviata a dopo l'approvazione**,
  non scartata.
- **Non deciso:** modello commerciale (nessun pricing, nessun IAP, nessun codice di
  pagamento nel bundle); rebranding; tempistica dell'apertura ai coach terzi.

## Brand Commitments

- **Nome "FLEOFIT" provvisorio.** Può cambiare. È già presente in decine di punti
  (logo JSX, PDF, story IG, TV, `appId`, `Info.plist`, chiavi `fleofit_*`, deep link
  `fleofit://`): un cambio nome è un refactor coordinato, non un find&replace.
- **Logo:** sempre `FLEO` bianco + `FIT` giallo brand.
- **Palette vincolante:** giallo `#f1ba17` (brand/Hyrox), fondo `#0B0B0B`, azzurro
  `#0094C6` (Running), rosso magenta `#D11149` (Custom), bianco (Evento).
  **I colori sono corretti e vanno mantenuti come default.**
- **Dark mode only.** Nessun tema chiaro previsto.
- **Font:** Inter, titoli `font-black` con `tracking-tight`.
- **Bundle iOS:** `it.federicoleo.fleofit`, display name FLEOFIT.
- **Voce:** italiano diretto, seconda persona singolare, tono da coach (saluto orario +
  frase motivazionale del giorno).

## Evidence on Hand

- **Codice in produzione su due fronti:** web app live su Vercel
  (`https://fleofit.vercel.app`) e build **1.1.0 (3)** caricata su App Store Connect il
  24/08/2026 dopo un rifiuto (2.3.1(a) + 3.2.1(viii)); storia e correzioni in CLAUDE.md §9-ter.
- **Asset di marca reali:** `assets/icon.png`, `assets/splash.png`, `icons/*.webp`,
  `public/` (favicon, manifest, apple-touch-icon), `src/assets/hero.png`.
- **Documenti reali:** `privacy-policy.html`, `README.md`, `CLAUDE.md` (memoria di
  progetto, la fonte più aggiornata sullo stato tecnico).
- **Dati reali:** atleti, workout e storico veri su Supabase (`riyqtcssllupakjtoehj`),
  usati quotidianamente. Backup notturno via GitHub Action.
- **Da non inventare:** non esistono testimonianze, recensioni, numeri di utenti,
  benchmark, listini, né partner o certificazioni. Non attribuirne al prodotto.

## Product Principles

1. **La relazione coach↔atleta è il prodotto.** Ogni superficie deve rendere più corto il
   tratto fra "il coach ha deciso" e "l'atleta ha capito ed eseguito".
2. **Prima e dopo, non solo durante.** Il valore quotidiano sta nella lettura della scheda
   e nel resoconto con RPE; il timer è un accompagnamento opzionale, non il centro.
3. **La creazione del workout è l'attività più impegnativa del prodotto.** Merita la
   densità, la precisione e la tolleranza all'errore di uno strumento professionale
   (bozza automatica, riordino, duplicazione, sovrascrivi-o-salva-come-nuovo).
4. **Il vocabolario Hyrox si rispetta e si spiega.** I termini della disciplina restano;
   quando sono opachi (per un revisore o per un atleta nuovo) si affiancano didascalie.
5. **Il dato dell'atleta non si perde.** RPE, note e note vocali sono resoconto reale su
   un database condiviso senza staging: ogni modifica va pensata come irreversibile.
6. **Progettare per l'apertura ad altri coach** senza rompere l'uso attuale a coach singolo.
