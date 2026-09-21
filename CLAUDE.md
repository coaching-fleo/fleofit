# CLAUDE.md — Memoria globale progetto FLEOFIT

> Documento di memoria persistente per Claude. Leggere **sempre** questo file prima di
> toccare il codice o proporre modifiche grafiche.
> Ultimo aggiornamento: **21 settembre 2026**.
> **Due branch attivi e DIVERGENTI, ENTRAMBI MANUTENUTI**: `main` = web app in produzione ·
> `ios-version` = app per l'App Store (§1.1 — rifare sempre `git fetch` prima di parlare dei due).
> Ultimo commit su `ios-version`: **9 set 2026**, che porta gli **stati senza storico** della
> Home atleta (§9-duodetricies) e lo **stimatore di durata unificato** (§9-undetricies,
> BACKLOG #40 chiuso); il commit precedente dello stesso giorno portava tutto il lavoro dal
> 01/09 in poi (§9-vicies → §9-septvicies, cancellazione account compresa). ⚠️ **L'hash non si scrive più qui dentro**: era
> autoreferenziale — la riga descrive il commit che la contiene — e in questo file è già stato
> sbagliato **tre volte**, con due commit esistenti solo per correggerlo. Si legge con
> `git log -1`, che non può mentire.
> `npm test` → **935 test**, `npm run lint` → **41 problemi** (erano 164 la mattina del 25/08).
> 🔴 **Il 20/09 App Store ha respinto la 1.0 (5) con TRE rilievi insieme** (§9-quatertricies),
> e **uno solo è codice**: la **2.5.1** — HealthKit linkato al binario senza una funzione
> che lo giustifichi — chiusa il 21/09 togliendo Apple Health da tutte e cinque le porte
> da cui entra (codice, bottone, `Info.plist`, entitlement, **plugin npm**). Gli altri due
> sono caselle sbagliate su **App Store Connect** e nel repository non c'è niente da
> correggere: la **5.1.2(i)** — le etichette privacy dichiarano *tracking* su email e nome,
> e l'app **non traccia** (verificato: nessun SDK pubblicitario, nessun IDFA, Firebase solo
> come Messaging) — e la **2.3.6** — l'age rating dichiara *In-App Controls* che non
> esistono. ⚠️ Aggiungere l'ATT sarebbe la correzione **sbagliata**.
> ⭐ **Il 09/09 gli stimatori di durata sono diventati UNO** (§9-undetricies, BACKLOG #40
> chiuso): lo stesso allenamento diceva **58 minuti nella Home e 24 nella scheda**, e il
> difetto è saltato fuori mettendo due screenshot del simulatore uno accanto all'altro.
> Vince il **58**, per decisione del committente: sommare gli esercizi misura il tempo in
> cui l'atleta si sta muovendo, non quello che passa nel box. ⚠️ Con la durata sono saliti
> i **carichi** del modello predittivo (≈211 → ≈516 sullo stesso workout): i rapporti non
> si spostano, il numero assoluto sì.
> ⭐ **Il 15/09 «Salva workout» è sceso in fondo alla pagina** (§9-tertricies):
> la barra era `sticky`, quindi occupava una riga di schermo per tutto il tempo in
> cui si compone il workout — proprio mentre servono i blocchi — e il suo bordo
> disegnava uno stacco netto sopra la capsula della tab bar. ⚠️ `BarraAzioni`
> serve **tre** pagine: la prop `ancorata` resta `true` dove l'azione è la
> RAGIONE per cui si è aperta la pagina (scheda workout, scheda atleta), e
> diventa `false` dove è la CONCLUSIONE di un lavoro (il builder). Con la stessa
> passata, **aprire un blocco ne tiene il titolo davanti**: chiudeva quello aperto
> prima, la pagina si accorciava sopra la testa e il blocco toccato scivolava
> fuori schermo verso l'alto — misurato, da **−351 px a +12**.
> ⭐ **Il 09/09 la Home atleta ha guadagnato GLI STATI SENZA STORICO** (§9-duodetricies):
> giorno 1, prima settimana e giorno di riposo. La regola che ne esce vale per tutta
> l'app ed è entrata in DESIGN.md: **nessuna cella mostra uno zero — al posto di un dato
> che non esiste ancora va la cosa che lo farà esistere.** Chi installava l'app apriva su
> quattro zeri perfettamente corretti (anello 0/0, «Serie: 0 giorni», «0 min», «In arrivo»
> vuoto), cioè quattro numeri veri che gli dicevano di essere già indietro. ⚠️ Il
> `{weeklyStatus.length > 0 && …}` che sembrava proteggere il bento **non proteggeva da
> niente**: `weeklyStatus` nasce già con sette giorni — è lo stesso difetto della Home
> coach del 28/08, sullo stesso identico stato.
> 🔴 **Il 02/09 App Store ha respinto la 1.1.0 (3) sulla linea guida 4.8 — Login Services**,
> e il 03/09 è nato **Sign in with Apple** (§9-sexvicies). Non è il rifiuto di maggio che
> torna: quello (2.3.1(a)) resta chiuso. La 4.8 **non vieta Google**, che infatti resta
> dov'era — chiede che accanto ci sia un accesso che permetta di **tenere nascosta la
> propria email**, cosa che né Google né email+password fanno. ⚠️ Sul **nativo** non
> servono né Services ID né chiave `.p8`, quindi nemmeno il client secret che scade ogni
> 6 mesi: è la mezza giornata che quasi tutte le guide fanno perdere.
> ⭐ **Il 01/09 la scheda ha guadagnato la GRAFICA DA STORIA** (§9-unetvicies): un PNG
> **trasparente** con l'elenco degli esercizi e tre numeri grandi, da appoggiare sopra
> la propria storia come fa Strava con il percorso. È la prima cosa dell'app che finisce
> sotto gli occhi di chi non ce l'ha — e la prima stesura ci aveva messo un grafico,
> tolto dal committente lo stesso giorno perché era carino e non si leggeva.
> ⭐ **Il 01/09 è nato il primo schermo riservato al coach: il REPORT SETTIMANALE**
> (§9-vicies, BACKLOG #27), e lo stesso giorno il **report del SINGOLO ATLETA**
> (`/report/:id`, §9-vicies-bis), che è quello su cui si scrive l'allenamento
> successivo: le sedute una per una, i **movimenti con i carichi usati** — che
> nell'app non esistevano da nessuna parte — e indicazioni su cosa fare, ognuna
> con accanto il numero da cui esce. Tutto su tabelle esistenti, senza una
> colonna nuova.
> ⭐ **Il 02/09 è nato anche l'AMBIENTE DI PROVA** (§9-quinvicies): `npm run demo`
> fa girare l'app intera su un Supabase finto in memoria. È la prima volta che si
> può usare FLEOFIT senza toccare il database di produzione.
> ⭐ **Il 02/09 è nato il MODELLO PREDITTIVO DEL CARICO** (§9-quatervicies,
> `src/lib/previsione.js`): il builder dice quanto **pesa** la seduta che si sta
> scrivendo, e il foglio di assegnazione dice — atleta per atleta — cosa succede al
> suo carico se gliela si dà. 🔴 Ci convivono **due scale**, ed è la prima cosa da
> leggere: i due stimatori di durata del progetto differiscono dell'**89%** su un
> «For Time», quindi ogni carico va confrontato solo con un paragone misurato allo
> stesso modo.
> ⭐ **Il 02/09 il tasto «indietro» è diventato uno solo** (§9-tervicies, `src/useIndietro.js`):
> tre pagine avevano una **destinazione fissa** che ignorava da dove si veniva — si apriva un
> atleta dai feedback della Home coach e si finiva nella rubrica — e i `navigate(-1)` non
> facevano niente quando la pagina era la prima della sessione (notifica push, deep link).
> Insieme: la **tab bar non impila più** (`replace`) e la scheda che navigava a sé stessa
> cambiando `athlete_id` non lascia più una voce di history a ogni atleta guardato.
> ⭐ **Il 01/09 anche le IMPOSTAZIONI sono state rifatte** (§9-duoetvicies): l'eroe è
> l'account con lo stato del dispositivo, gli acceso/spento sono interruttori con
> `aria-checked`, i codici invito scendono a una riga con il numero, e il banner giallo
> «Operazione in corso» lascia il posto allo stato dentro la riga che l'ha causato.
> ⭐ **Il 04/09 è stato rifatto l'ACCESSO** (§9-septvicies, artboard `Login.dc.html` 1b): il
> bivio «Accedi / Nuovo Utente» è sparito — chiedeva all'utente una cosa che l'utente non sa —
> e al suo posto c'è una colonna sola di modi per entrare. Il codice invito non è più una porta
> davanti alla casa: è la domanda del passo 2, e la si fa solo a chi serve. 🔴 Il vicolo cieco
> vero stava in `App.jsx`: chi entrava con Apple o Google senza profilo — il caso NORMALE di un
> nuovo invitato — riceveva «Accesso Negato» e il codice non gli veniva mai chiesto.
> > Dieci schermate rifatte su design di Claude Design (la **Home atleta** due volte: il
> 26/08 la pagina, il 09/09 i suoi stati vuoti): **Home atleta** il 26/08 (§9-octies),
> **Home coach** il 27/08 (§9-nonies) con la **pausa atleta** (§9-decies), **Crea Workout**
> il 27/08 (§9-undecies), la **scheda del workout** (§9-duodecies) e la **scheda atleta**
> (§9-terdecies) il 28/08, l'**archivio** (§9-sedecies), la **rubrica atleti**
> (§9-septdecies) e il **calendario** (§9-octodecies) il 31/08, le **impostazioni**
> (§9-duoetvicies) il 01/09. Il 28/08 anche il
> foglio **«Genera con IA»** (§9-quindecies),
> che è dove l'entrata mancante di BACKLOG #34 si è vista per la seconda volta.
> Il 31/08 anche l'**attesa fra una pagina e l'altra** (§9-noviesdecies): la scheda
> workout scende da 480 a **68 KB** (**82 KB** dal 01/09 con la grafica da storia), e lì
> sta la spiegazione del perché fra due pagine NON lampeggia niente — la pagina vecchia
> resta immobile — che leggendo il codice si sbaglia in due modi diversi.
> Build **1.1.0 (3)** in revisione su App Store Connect dal 24/08/2026, dopo il rifiuto di
> maggio. ✅ **Il 26/08 la causa di quel rifiuto è stata chiusa e verificata dai due lati**:
> `aps-environment = production` e le 5 email admin nell'`.ipa` spedito, e `demo@fleofit.it`
> che assegna davvero un workout dall'app. Dettagli in §9-ter.

---

## 0. Regole operative per Claude

> 📋 **Le cose da fare stanno in [BACKLOG.md](BACKLOG.md)**, non qui. Questo file spiega
> *com'è fatto* il progetto; il backlog elenca *cosa manca*, con il perché di ognuna e
> cosa la blocca. Aggiornare il backlog quando una voce si chiude.

0. **Esistono DUE branch vivi con due destinazioni diverse** (`main` = web app in produzione,
   `ios-version` = app per l'App Store). Prima di proporre un merge, un deploy o una modifica
   condivisa (DB, Edge Function), leggere il §1.1: non sono intercambiabili.
0-bis. 🔒 **LO SCHEMA DEL DATABASE È CONGELATO** fino all'approvazione su App Store (decisione del
   committente, 24/08/2026). Niente migrazioni, niente tabelle nuove, nessuna modifica alle policy
   RLS: l'unico database serve anche la web app in produzione e non c'è staging. **Le letture sono
   permesse** (verifica policy, conteggi, export). Se una funzione richiede una migrazione, va
   proposta e messa in attesa, non implementata. Vedi PRODUCT.md → Capabilities and Constraints.
1. **Il nome "FLEOFIT" è provvisorio.** Potrà cambiare in futuro. Quando scrivi codice nuovo, evita
   di hardcodare il brand ovunque: preferisci costanti/variabili riutilizzabili. Il nome è comunque
   attualmente presente in decine di punti (logo JSX, PDF, story IG, TV, `appId`, `Info.plist`,
   chiavi localStorage `fleofit_*`, deep link `fleofit://`) — se si cambia nome serve un refactor
   coordinato, non un semplice find&replace.
2. **La grafica attuale è la baseline, non un vincolo eterno.** Modifiche di layout/UI sono attese
   e benvenute.
3. **I COLORI SONO CORRETTI E VANNO MANTENUTI COME DEFAULT.** Non proporre palette alternative se
   non esplicitamente richiesto. La palette è definita al §6.
4. Lingua dell'interfaccia e dei commenti: **italiano**. Nomi di variabili/funzioni: inglese misto
   a italiano (convenzione già esistente, mantenerla coerente per file).
5. ⚠️ **I numeri di riga scadono in fretta, i nomi no.** Quando citi un punto del codice —
   qui, in un commit o parlando con il committente — nomina la funzione o la costante, non la
   riga. Il 25/08/2026 tutti e cinque i riferimenti `file:riga` presenti in questo documento
   puntavano a righe scorrelate.
6. Prima di modificare un file grande (`WorkoutDetail.jsx` 2.938 righe, `AthleteDetail.jsx` 2.553,
   `CreateWorkout.jsx` 2.348, `Home.jsx` 2.010 — contate il 26/08/2026) leggere le sezioni
   rilevanti: c'è molta logica duplicata tra i file (vedi §9 Debito tecnico).
   > I primi tre si sono alleggeriti fra il 25 e il 26/08 estraendo la logica pura in
   > `src/lib/` (`offlineQueue`, `timerSequence`, `statistiche`, `badge`): è la direzione,
   > non un'eccezione. `CreateWorkout` invece è **cresciuto**, per i `useCallback` che la
   > memoizzazione richiede (§9-quinquies).

---

## 1. Cos'è il progetto

**FLEOFIT** è l'app di coaching personale di **Federico Leo**, specializzata su **Hyrox** e
**Running**. Serve a seguire gli atleti passo per passo: il coach crea e assegna workout, l'atleta
li esegue con un timer guidato, li segna come completati con RPE e note, e il coach vede tutto in
tempo reale.

- **Repo**: `https://github.com/coaching-fleo/fleofit`
- **Cartella locale**: `~/Desktop/FLEOFIT/fleofit ios-version`
- **App bundle iOS**: `it.federicoleo.fleofit` — display name `FLEOFIT`
- **Deploy web**: Vercel (`https://fleofit.vercel.app`), SPA rewrite in `vercel.json`
- **Deep link scheme**: `fleofit://` (usato per OAuth callback e reset password su iOS)

---

## 1.1 I due branch — LEGGERE PRIMA DI TOCCARE main

Il progetto vive su **due branch con due prodotti diversi**, entrambi attivi:

| Branch | Cos'è | Dove finisce | Ultimo commit |
|---|---|---|---|
| **`main`** (default) | **Web app in produzione**, quella che gli atleti usano oggi | **collegato a Vercel** → `https://fleofit.vercel.app`. LIVE, non rompere | `c2ed65d` — 25 ago 2026 |
| **`ios-version`** | Versione nativa iOS/Capacitor, quella caricata sull'App Store (§9-ter) | **collegato a NIENTE**: è solo il backup su GitHub del lavoro locale. L'app arriva sull'App Store da Xcode, non da un deploy | **9 set 2026** (`git log -1`) |

### ⚠️ `ios-version` NON è un branch di rilascio (confermato dal committente il 24/08/2026)
Non esiste nessuna pipeline collegata a `ios-version`. Pushare lì **non pubblica niente**: serve
solo a non perdere il lavoro. La build per l'App Store nasce da Xcode sulla cartella locale.
Conseguenze pratiche, tutte controintuitive:
- **Un push su `ios-version` non è un rilascio.** Il codice spedito ad Apple è quello archiviato da
  Xcode in quel momento, che può essere più avanti o più indietro del branch (§9-ter: è già
  successo con il build number).
- **Un fix che deve andare in produzione web NON basta metterlo su `ios-version`.** Deve arrivare
  su `main`, o non esiste per gli atleti che usano l'app oggi.
- **Gli scheduled workflow di GitHub girano solo dal branch di default.** Un workflow corretto su
  `ios-version` è un file inerte (§4 e §9 punto 9).
- ⚠️ **Da verificare su Vercel**: se il progetto Vercel è collegato al repo GitHub, per impostazione
  predefinita Vercel costruisce una **preview deployment per ogni branch pushato**, `ios-version`
  incluso, su un URL pubblico. Controllare in Vercel → Settings → Git → *Ignored Build Step* /
  *Production Branch* che le preview siano disattivate o protette da password.

### Rapporto tra i due: SONO DIVERGENTI, ED ENTRAMBI SI MUOVONO
Verificato il 25/08/2026 **dopo un `git fetch`**:
`git rev-list --left-right --count origin/main...origin/ios-version` → **`49 86`**
(misurata il 09/09/2026 subito dopo il push: `main` è fermo al 25/08, `ios-version`
continua a muoversi). ⚠️ **Questo numero invecchia di uno a ogni commit, questa riga
compresa**: vale come ordine di grandezza — il divario è grande e cresce — non come
cifra da fidarsi. Per il valore vero si rilancia il comando dopo un `git fetch`, che è
la regola di questa sezione.
Il divario **cresce a ogni sessione di lavoro su `ios-version`**: più si aspetta, più il merge costa.
**Un merge non è un fast-forward**: è un merge vero.

> 🔴 **`main` NON è fermo, e questo documento ha già sbagliato due volte su questo punto.**
> Prima diceva `0 18` e "non divergenti" (falso: nessuno aveva fatto fetch). Poi diceva
> "`8919bfd` — 8 giu 2026" (falso al 25/08: **`main` ha ricevuto 8 commit fra il 24 e il 25
> agosto**). Le correzioni fatte su `ios-version` vengono **riportate a mano su `main`**, una
> a una: backup del database e dei bucket, titolo facoltativo, accessibilità, notifiche di
> assegnazione, cestino degli atleti.
> **Regola, senza eccezioni**: `git fetch` **prima** di qualunque affermazione sui due branch,
> e prima di dire che qualcosa "manca su main" verificarlo con
> `git show origin/main:<file>` o `git grep <cosa> origin/main -- src/`.

Peggio del conteggio: i due branch hanno lavorato **in parallelo sugli stessi file**. Fra il 15 e
il 21 maggio `main` ha ricevuto una propria linea di sviluppo su `TVDashboard.jsx`,
`CreateWorkout.jsx` e `WorkoutDetail.jsx` (TV, opzioni ergometri, distanze di corsa, fix PDF/story
IG, beep del timer), cioè proprio i file più grandi del progetto, che `ios-version` ha modificato
per conto suo. Un merge produrrà conflitti reali lì dentro, non banali da risolvere.

### Cosa c'è davvero solo su `ios-version` (verificato su `origin/main` il 25/08/2026)
Assenti da `main`: tutta la cartella `ios/`, `capacitor.config.ts`, `privacy-policy.html`,
`src/pages/bluetooth.js` (fascia cardio BLE),
`supabase/functions/ai-workout/` (generazione IA), `src/lib/blockHints.js`, l'**RPE**, la
**Live Coach Cam**, la **modalità Offline** (ex "Bunker"), push FCM native, centro notifiche + badge.
Aggiunti il 25-26/08 e ancora solo qui: **tutta l'infrastruttura di test**
(`vitest.config.js`, `src/test/`, i `__tests__`), e quasi tutto `src/lib/` —
`offlineQueue.js`, `rpe.js`, `blockColors.js`, `alert.js`, `pushToken.js`,
`constants.js`, `timerSequence.js`, `statistiche.js`, `badge.js` — più
`supabase/functions/_shared/admin.ts` e `tools/` (verifica dell'ipa e query sul revisore).
⚠️ `src/lib/workoutTitle.js` invece **c'è anche su `main`**: è stato riportato lì il 24/08.

Due correzioni rispetto a quanto scritto qui in passato:
- ⚠️ **`TVDashboard.jsx` esiste anche su `main`.** La TV Dashboard non è esclusiva di `ios-version`:
  esistono due implementazioni diverse, sviluppate in parallelo a maggio.
- `main` **conosce** `Interval`, `Custom`, `Event` e `isAutonomous` (l'8 giugno ha ricevuto
  "Coach can create custom workout"). Quel pezzo di incompatibilità non c'è più — resta solo l'RPE.

### ⚠️ Il database e le Edge Function sono CONDIVISI
Entrambi i branch puntano allo **stesso progetto Supabase** (`riyqtcssllupakjtoehj`) e alle **stesse
Edge Function deployate**. Non esiste un ambiente di staging. Conseguenze concrete:
- Una **migrazione di schema** fatta per iOS colpisce subito la web app in produzione.
- `send-reminders` è **una sola funzione deployata**: 583 righe su `ios-version` contro 247 su
  `main`, cioè 336 in più (rimisurate il 25/08/2026). Qualunque versione sia deployata, serve
  entrambe le app. La lista admin non è più duplicata al suo interno: dal 25/08 importa
  `supabase/functions/_shared/admin.ts`, che va tenuta allineata a `ADMIN_EMAILS` di
  `src/App.jsx` e alle policy RLS (§9 punto 7).
- ✅ Il fix del backup (`db-backup.yml`) **è su `main` dal 25/08/2026** (`e5d11c5`, `30c597b`,
  `c2ed65d`) ed è **byte-identico** a quello di `ios-version`: verificato con
  `diff <(git show origin/main:.github/workflows/db-backup.yml) .github/workflows/db-backup.yml`.
  Conta perché i cron di GitHub girano **solo dal branch di default**: finché il file non era lì,
  il backup notturno era quello rotto. Ora non lo è più.
  Se in futuro tocchi quel workflow, il modo di riportarlo è **solo quel file**, non l'intero branch:
  `git checkout main && git checkout ios-version -- .github/workflows/db-backup.yml`

### ⚠️ Incompatibilità dati nota: l'RPE
`main` **non conosce l'RPE**: `parseNotesAndRpe`/`formatNotesWithRpe` non esistono su quel branch
(0 occorrenze di "RPE" in `src/`). Quindi:
- Un workout completato da iOS scrive `[RPE: 7/10]\ntesto` in `athlete_workouts.notes`;
  sulla **web app quel prefisso appare come testo grezzo** dentro la nota.
- Se l'atleta **modifica la nota dalla web app**, il valore viene riscritto verbatim
  (`.update({ notes })` in `AthleteDetail.jsx` e `.update({ notes: finalNote })` in
  `WorkoutDetail.jsx`; in `Home.jsx` il punto è sparito col codice morto rimosso il 25/08):
  se cancella il prefisso, **l'RPE è perso** e le statistiche iOS (RPE medio, carico settimanale)
  ricadono silenziosamente sul default 5.
Se si vuole tenere le due app in convivenza a lungo, il minimo sindacale è **retroportare
`parseNotesAndRpe` su `main`** (anche solo in lettura, per non distruggere il dato).

---

## 1.2 Ruoli
| Ruolo | Come si ottiene | Cosa vede |
|---|---|---|
| `admin` (coach) | email in `ADMIN_EMAILS` (`src/App.jsx`, in cima al file) | Tutto: crea workout, gestisce atleti, codici invito, backup, Live Coach Cam |
| `athlete` | registrazione con codice invito valido | Home personale, calendario, profilo, archivio |
| `coach` | ruolo previsto nel codice ma **onboarding disattivato** (commentato in `App.jsx:109-112`) | come admin |

- Gli admin possono **simulare l'atleta**: `localStorage.adminRoleOverride = 'athlete'` (toggle in Settings).
- L'account `coaching@federicoleo.it` ha ID `0118e43f-8791-4fd6-8032-bee028334c99` ed è **nascosto**
  dalla lista atleti (filtro hardcodato in `Athletes.jsx` e `WorkoutDetail.jsx`).
- **Registrazione chiusa**: senza `invitation_code` valido il `ProtectedRoute` fa signOut e
  rimanda a `/login?error=unauthorized`.

---

## 2. Stack tecnologico

| Livello | Tecnologia |
|---|---|
| Frontend | React **19**, Vite **8**, React Router **7** (`BrowserRouter`) |
| Styling | **Tailwind CSS 4** via `@tailwindcss/vite` (niente `tailwind.config.js`: i token stanno in `@theme` dentro `src/index.css`) |
| Icone | `lucide-react` |
| Date | `date-fns` + locale `it` |
| Backend | **Supabase** (Postgres + Auth + Storage + Realtime + Edge Functions) |
| Mobile | **Capacitor 8** → target **iOS** (`ios/App`), niente cartella Android |
| Export | `jspdf` (PDF scheda), `html-to-image` (`toPng`/`toBlob`) per la story Instagram |
| Superficie IA | `thinking-orbs` — l'orb dell'attesa (§9-untricies) · `border-beam` — il fascio su card e foglio (§9-duetricies). ⚠️ Entrambe MIT e senza dipendenze, ed **entrambe si importano solo da `CreateWorkout.jsx`**: mai da un file condiviso |
| Push | FCM (iOS nativo, via `@capacitor-community/fcm` + Firebase Admin lato Edge Function) + Web Push VAPID (browser) |
| IA | Google **Gemini 2.5 Flash** (generazione workout + trascrizione audio) |

### Plugin Capacitor in uso
`@capacitor/app`, `browser`, `filesystem`, `haptics`, `keyboard`, `network`,
`push-notifications`, `screen-orientation`, `share`, `status-bar`,
`@capacitor-community/bluetooth-le` (fascia cardio), `keep-awake` (TV), `media` (salva in galleria),
`apple-sign-in` (Sign in with Apple, §9-sexvicies),
`fcm`, `@capawesome/capacitor-badge` (badge icona),
`@independo/capacitor-voice-recorder` + `capacitor-voice-recorder` (⚠️ **due librerie audio diverse**,
vedi §9).

### Comandi
```bash
npm run dev      # vite --host (porta 5173, host 0.0.0.0)
npm run build    # tsc -b && vite build
npm run lint     # eslint .
npm test         # vitest run
npm run demo     # AMBIENTE DI PROVA: l'app su dati finti in memoria (§9-quinvicies)
npm run ios      # build + cap sync — USARE QUESTO prima di compilare da Xcode
npx cap sync ios # solo la sincronizzazione, se il build è già fatto
```

> 🔴 **`npm run build` NON basta per vedere una modifica in Xcode.**
> Xcode compila `ios/App/App/public`, che è una **copia** del bundle depositata da
> `npx cap sync ios`. Senza sync, Xcode costruisce con il codice della sincronizzazione
> precedente e la modifica sembra non aver funzionato.
> Successo il 26/08/2026: la copia in Xcode era ferma al giorno prima, e una funzione
> appena rimossa continuava a comparire nell'app. Non è un passo solo pre-archive:
> serve **a ogni** compilazione da Xcode. Per questo esiste `npm run ios`.
>
> ⚠️ Il build stampa anche il peso dei chunk: `CreateWorkout` sta a **156 KB**
> (erano 76 fino al 15/09: **+15** di `thinking-orbs`, che porta tutti e nove i
> modi anche usandone due — §9-untricies — e **+64** di `border-beam`,
> §9-duetricies). `CreaWorkoutUI` deve restare intorno ai **24 KB**: è un chunk
> **condiviso con `WorkoutDetail`**, e una libreria di effetti importata lì
> dentro la fa scaricare a ogni apertura di una scheda. E `WorkoutDetail` deve
> restare intorno agli **84 KB** (erano 68 fino al 01/09, poi 82 con `StoriaUI` + `recapStoria`
> §9-unetvicies, e 84 dal 02/09 con `previsione` + `PrevisioneUI` §9-quatervicies). Se risale sopra i 400, qualcuno ha rimesso `jspdf` o `html-to-image`
> fra gli import in testa (§9-noviesdecies).
>
> Come si verifica se la copia è vecchia:
> ```bash
> diff -q dist/assets/index-*.js ios/App/App/public/assets/index-*.js
> ```

### Due configurazioni, non una
`vite.config.ts` costruisce l'app · `vitest.config.js` la testa (jsdom,
`src/test/setup.js`, che finge `Capacitor.isNativePlatform() === false` così i test
prendono sempre il ramo web). Tenerle separate evita che il build di produzione carichi jsdom.
> ⚠️ `src/test/setup.js` sostituisce anche `localStorage` con uno in memoria: **jsdom, in
> questa versione di Node, ne espone uno rotto** (`getItem is not a function`, è l'origine del
> warning `--localstorage-file`). Senza quel rimpiazzo nessuna pagina si monta, perché quasi
> tutte leggono localStorage in un effetto. Era il vero ostacolo ai test sulle pagine.
> ⚠️ **Non creare mai un `vite.config.js`**: Vite risolve `.js` prima di `.ts` e
> maschererebbe `vite.config.ts` senza dire niente. È già successo il 25/08/2026.
Per testare su iPhone in dev live: scommentare `server.url` in `capacitor.config.ts` con l'IP locale.

---

## 3. Struttura dei file

> Struttura del branch `ios-version`. Su `main` mancano `ios/`, `capacitor.config.ts`,
> `privacy-policy.html`, `bluetooth.js`, `src/lib/` e la Edge Function `ai-workout`.
> ⚠️ `TVDashboard.jsx` **c'è anche su `main`**, in una versione diversa (§1.1).

```
vite.config.ts                 # costruisce l'app
vitest.config.js               # la testa (jsdom) — ⚠️ MAI creare un vite.config.js: Vite risolve
                               #   .js prima di .ts e maschererebbe quello vero, in silenzio
src/
├─ main.jsx                    # entry, importa index.css
├─ supabaseDemo.js            # ⚠️ Supabase finto in memoria — `npm run demo` (§9-quinvicies).
│                              #   NON entra nel bundle: il flag è sostituito a build time
├─ demoSemi.js                # i dati di prova: date RELATIVE, un atleta per ogni ramo
├─ DemoBadge.jsx              # il nastro «ambiente di prova», solo con VITE_DEMO=1
├─ App.jsx                     # routing, AuthContext, Onboarding, ProtectedRoute, DeeplinkHandler
│                              #   ⚠️ qui vive ADMIN_EMAILS (§9 punto 7)
│                              #   ⚠️ ProtectedRoute è UNA route di layout, non un involucro
│                              #   per rotta: non riavvolgere le pagine (§9-noviesdecies)
├─ __tests__/                  # 2 test su App.jsx montata: navigazione e tab bar (§9-noviesdecies)
├─ index.css                   # Tailwind @theme + animazioni globali (page-transition, modal-transition)
├─ supabaseClient.js           # createClient con URL + anon key hardcodati
├─ useTouchDrag.js             # hook drag&drop touch nativo (usato da CreateWorkout)
├─ useTastiera.js              # la tastiera di sistema è aperta? (barre ancorate in basso)
├─ useBottomSheet.js           # ⚠️ l'UNICO bottom sheet fatto bene: entrata, maniglia, scroll bloccato (§9-duodecies)
├─ useIndietro.js              # ⚠️ il tasto «indietro», uno per tutta l'app: NON è `navigate(-1)`
│                              #   e NON è una destinazione fissa — sono i due modi sbagliati (§9-tervicies)
├─ lib/                        # logica pura, l'unica parte con test
│  ├─ alert.js                 # mostraAlert/mostraErrore: alert applicativo senza passare props
│  ├─ andamento.js             # aderenza, carico, volume e sforzo della scheda atleta — TUTTI
│  │                           #   sulla stessa finestra di 30 giorni (§9-terdecies)
│  ├─ appleLogin.js            # ⚠️ Sign in with Apple: il nonce va HASHATO per il plugin e
│  │                           #   in chiaro per Supabase, e il nome di Apple arriva UNA
│  │                           #   volta sola (§9-sexvicies)
│  ├─ aptica.js                # battito(): il colpetto dei picker, era in due copie
│  ├─ badge.js                 # ⚠️ l'UNICO punto che scrive il badge iOS (§8)
│  ├─ blockColors.js           # TYPE_COLORS, unificata dalle 5 copie sparse
│  ├─ blockHints.js            # BLOCK_HINT: didascalie in chiaro dei tipi di blocco (§9-ter)
│  ├─ categorie.js             # CORSIA/corsia/categoriaDi: la Regola della Corsia in un punto solo
│  ├─ coach.js                 # ⚠️ COACH: il nome del coach è una COSTANTE, non una query —
│  │                            #   dal lato atleta non è interrogabile (§9-duodetricies)
│  ├─ codiceInvito.js          # ⚠️ il codice invito: normalizza anche il LINK del coach, e
│  │                           #   dice perché «non esiste» e «già usato» sono lo stesso
│  │                           #   messaggio — la RLS non li distingue (§9-septvicies)
│  ├─ notaVocale.js            # isVoiceNoteValid: il soft delete `#deleted=` si filtra sempre
│  ├─ pausa.js                 # ⚠️ «atleta in pausa» dentro athletes.notes — NON è una colonna (§9-decies)
│  ├─ rigaAtleta.js            # ⚠️ l'aderenza settimanale della rubrica — la settimana comincia di
│  │                           #   LUNEDÌ, e chi non ha niente in programma NON è a zero (§9-septdecies)
│  ├─ rigaArchivio.js          # ⚠️ meta, gruppi per mese e chip dell'archivio — l'ordine è per DATA, non
│  │                           #   per creazione, o lo stesso mese ricompare nello scroll (§9-sedecies)
│  ├─ rigaBlocco.js            # le didascalie del blocco: parametri e specifiche (§9-duodecies).
│  │                           #   ⚠️ `parametriBlocco` è dove vivono i RIPIEGHI dei giri e degli
│  │                           #   intervalli, gli stessi di `durataBlocco` (§9-unetvicies)
│  ├─ rigaImpostazioni.js     # ⚠️ i numeri delle righe di Impostazioni: `null` finché i codici
│  │                           #   non sono arrivati, e un conteggio mancante SPARISCE invece di
│  │                           #   diventare 0 (§9-duoetvicies)
│  ├─ previsione.js           # ⚠️ il modello predittivo del carico (§9-quatervicies).
│  │                           #   ⚠️ Le due SCALE di durata non ci sono più (§9-undetricies),
│  │                           #   ma restano due `rpeAtteso` diversi: `caricoPrevisto` usa
│  │                           #   quello del builder, `caricoAssegnazione` quello dello STORICO
│  ├─ reportAtleta.js          # ⚠️ il report del singolo: diario, movimenti con i carichi
│  │                           #   (giri del blocco compresi), cinque settimane e le
│  │                           #   PROPOSTE per la successiva (§9-vicies-bis)
│  ├─ reportSettimanale.js     # ⚠️ i numeri del report coach: aderenza sulla parte TRASCORSA
│  │                           #   della settimana, carico che esclude chi non ha segnato l'RPE,
│  │                           #   rapporto acuto/cronico e verdetti (§9-vicies)
│  ├─ recapStoria.js           # ⚠️ l'elenco e i numeri della grafica da storia — la durata
│  │                           #   è una STIMA e lo deve dire, l'RPE è quello DICHIARATO o
│  │                           #   la cella non esiste, e su un libero si legge la nota del
│  │                           #   COACH mai quella dell'atleta (§9-unetvicies)
│  ├─ rigaCalendario.js       # ⚠️ griglia, segno del giorno e i tre numeri del mese — il volume
│  │                           #   dice «≈» quando ha dovuto lasciare fuori qualcosa (§9-octodecies)
│  ├─ stiliCard.js             # CARD/LABEL/RIGA/VETRO/CARTA_RIGA(_BASE) — costanti, NON componenti
│  │                           #   (§9-octies punto 3). ⚠️ Il bordo si DICHIARA, non si sovrascrive (§9-octodecies)
│  ├─ constants.js             # ERGOMETERS e affini
│  ├─ offlineQueue.js          # ⚠️ coda offline + leggiJson/scriviJson — vedi §9 regola 0-bis
│  ├─ pushToken.js             # rinfresco del token FCM
│  ├─ rpe.js                   # parseNotesAndRpe / formatNotesWithRpe
│  ├─ statistiche.js           # carico settimanale, completamento, distribuzione RPE.
│  │                            #   ⚠️ `minutiSettimana` misura la settimana di CALENDARIO
│  │                            #   (lunedì), non sette giorni a ritroso (§9-duodetricies)
│  ├─ statisticheCoach.js      # i numeri della Home coach: feedback, squadra del giorno, fermi, scaduti, copertura
│  ├─ stimaWorkout.js         # ⚠️ L'UNICO stimatore di durata dei blocchi Hyrox: dal 09/09
│  │                           #   `durataWorkout` lo somma invece di rifare il conto (§9-undetricies)
│  │                           #   ⚠️ durata STIMATA e RPE atteso del builder — non è un dato vero
│  │                           #   (§9-undecies). L'RPE è una media di POTENZA, non aritmetica.
│  │                           #   ⚠️ Esiste un SECONDO `rpeAtteso` in statistiche.js, che è un
│  │                           #   calcolo diverso per le stesse parole: la Home parte da
│  │                           #   `sections.intensity` e ripiega su una tabella per tipo di
│  │                           #   blocco. Lo stesso workout può quindi dire due numeri diversi
│  │                           #   in due schermate — non è stato unificato, sta in BACKLOG
│  ├─ timerSequence.js         # buildTimerSequence + getNormalizedBlocks (§5 legacy)
│  ├─ workoutTitle.js          # titolo generato dalla data (c'è anche su main)
│  └─ __tests__/               # 246 test — il grosso della copertura (§9 punto 11)
├─ test/
│  ├─ setup.js                 # jsdom, localStorage in memoria, finto Capacitor (§9-sexies)
│  ├─ fintoSupabase.js         # catena fluente via Proxy — riutilizzabile per ogni pagina
│  └─ montaPagina.jsx          # router e AuthContext VERI, non finti
├─ components/
│  ├─ HomeAtletaUI.jsx         # i pezzi visivi della Home atleta (§9-octies) — sola presentazione
│  ├─ HomeAtletaVuotiUI.jsx    # ⚠️ gli stati SENZA STORICO della Home atleta (§9-duodetricies):
│  │                            #   giorno 1, prima settimana, riposo. Nessuna cella mostra
│  │                            #   uno zero — è la regola, non una preferenza
│  ├─ HomeCoachUI.jsx          # i pezzi visivi della Home coach (§9-nonies) — sola presentazione
│  ├─ CreaWorkoutUI.jsx        # i pezzi visivi del builder (§9-undecies) — RiepilogoWorkout e BarraAzioni
│  │                           #   servono ANCHE la scheda: stesso codice in scrittura e in lettura
│  ├─ AudioVisualizer.jsx      # ⚠️ l'UNICA forma d'onda: note vocali E dettatura IA (§9-quindecies)
│  ├─ WorkoutDetailUI.jsx      # i pezzi visivi della scheda workout (§9-duodecies) — sola presentazione
│  ├─ StoriaUI.jsx             # ⚠️ la grafica da mettere SOPRA una storia + il foglio da cui
│  │                           #   si esporta. Sfondo `transparent` di proposito (§9-unetvicies)
│  ├─ SchedaAtletaUI.jsx       # i pezzi visivi della scheda atleta (§9-terdecies) — sola presentazione
│  ├─ ArchivioUI.jsx           # i pezzi visivi dell'archivio (§9-sedecies) — sola presentazione.
│  │                           #   ⚠️ CampoRicerca e IntestazioneSezione servono ANCHE la rubrica atleti
│  ├─ AtletiUI.jsx             # i pezzi visivi della rubrica atleti (§9-septdecies) — sola presentazione
│  ├─ CalendarioUI.jsx         # i pezzi visivi del calendario (§9-octodecies) — sola presentazione
│  ├─ ImpostazioniUI.jsx       # i pezzi visivi delle impostazioni (§9-duoetvicies) — sola
│  │                           #   presentazione. ⚠️ `FoglioCodici` sta qui, non in una rotta nuova
│  ├─ LoginUI.jsx              # i pezzi visivi dell'accesso (§9-septvicies) — sola presentazione.
│  │                           #   ⚠️ Le otto caselle sono UN campo solo disegnato in otto
│  ├─ PrevisioneUI.jsx         # il semaforo del foglio di assegnazione (§9-quatervicies) —
│  │                           #   ⚠️ NON ha il verde: chi non ha niente da dire non ha riga
│  ├─ ReportAtletaUI.jsx       # i pezzi visivi del report del singolo (§9-vicies-bis)
│  ├─ ReportUI.jsx             # i pezzi visivi del report settimanale (§9-vicies) — sola presentazione.
│  │                           #   ⚠️ UNA sola cornice colorata in pagina: la fascia «Da fare adesso»
│  ├─ Navbar.jsx               # bottom nav in vetro, voce attiva in pillola, voci variabili per ruolo
│  ├─ CustomModals.jsx         # CustomAlert + CustomConfirm + AlertHost
│  └─ CustomDatePicker.jsx     # date picker custom dark
└─ pages/
   ├─ Home.jsx                 # dashboard atleta + coach + centro notifiche + Live Coach Cam
   ├─ Login.jsx                # benvenuto → email (passo 1) → codice invito (passo 2) → recupero.
   │                           #   ⚠️ Il vicolo cieco che chiudeva era in App.jsx, non qui (§9-septvicies)
   ├─ Calendar.jsx             # calendario mensile, creazione "Evento/Gara"
   ├─ CreateWorkout.jsx        # workout builder (Hyrox / Running / Custom) + generazione IA
   ├─ WorkoutDetail.jsx        # scheda workout, timer guidato, PDF, story IG, note vocali, TV
   ├─ Athletes.jsx             # rubrica atleti + cestino "Eliminati di recente" (admin)
   ├─ AthleteDetail.jsx        # scheda atleta: workout, PR, statistiche (è anche /profile)
   ├─ WorkoutsArchive.jsx      # archivio storico workout
   ├─ AthleteReport.jsx        # /report/:id — il report del singolo atleta (§9-vicies-bis).
   │                           #   🔒 Solo coach, come /report
   ├─ WeeklyReport.jsx         # /report — il report settimanale del coach (§9-vicies).
   │                           #   🔒 L'UNICA pagina senza una versione atleta: rimanda alla Home
   ├─ Settings.jsx             # notifiche, backup/restore JSON, codici invito, BLE, password
   ├─ TVDashboard.jsx          # /tv — dashboard fullscreen per TV/Chromecast, codice a 4 cifre
   ├─ bluetooth.js             # BluetoothService — singleton BLE fascia cardio
   ├─ motivations.js           # 15 frasi motivazionali + getDailyMotivation() con anti-ripetizione
   └─ __tests__/               # 157 test su componenti e pagine montate (§9 punto 11)
tools/                            # non entra nell'app: serve alle verifiche pre-submission
   ├─ ExportOptions-AppStore.plist # esporta un .ipa in locale, NON carica niente
   ├─ verifica-ipa.sh              # 6 controlli sul binario vero (§9-ter)
   └─ verifica-revisore.sql        # solo letture: account demo, dati, policy (§9-ter)
supabase/
   ├─ functions/_shared/admin.ts   # ADMIN_EMAILS condivisa dalle due Edge Function (§9 punto 7)
   ├─ functions/send-reminders/    # notifiche push (5 modalità)
   ├─ functions/ai-workout/        # Gemini: trascrizione audio + generazione blocchi JSON
   └─ schema/                      # fotografia delle policy RLS — NON è una migrazione (§4-bis)
```
> I file morti che questa sezione elencava (`App.css`, `pages/patch.js`, `pages/Invite.jsx`,
> `pages/useTouchDrag.js`, `index.ts` in root) **non esistono più**: rimossi il 24-25/08/2026.

---

## 4. Modello dati (Supabase)

Progetto Supabase: `riyqtcssllupakjtoehj`.

### Tabelle

**`athletes`** — profilo atleta, `id` = `auth.users.id`
`id, name, surname, birth_date, weight, height, photo_url, notes, instagram_url, strava_url, deleted_at`
- Soft delete via `deleted_at` (le query filtrano `.is('deleted_at', null)`).
- `notes` = la nota che il coach scrive **per** l'atleta.
  ⚠️ **NON è privata, ed è voluto** (confermato dal committente il 27/08/2026): `AthleteDetail`
  è anche `/profile` e la rende senza guardia di ruolo, quindi l'atleta la legge — e la può
  modificare — sulla propria scheda. Versioni precedenti di questo documento la chiamavano
  "nota privata del coach": era sbagliato, non è un difetto da correggere.
  ⚠️ **Dal 27/08/2026 codifica anche lo stato «in pausa»** nel prefisso `[PAUSA: yyyy-MM-dd]`,
  con lo stesso meccanismo dell'RPE dentro `athlete_workouts.notes`: chi legge o scrive questo
  campo passa da `src/lib/pausa.js` (`parseNotePausa` / `formatNotePausa`), mai dal valore
  grezzo. Un `.update({ notes })` diretto **cancella la pausa in silenzio** (§9-decies).
- `instagram_url` contiene solo lo **username** (validato `^[a-zA-Z0-9._]{1,30}$`), `strava_url` una URL completa.

**`workouts`** — il "template" del workout
`id, title, date, sections (jsonb), coach_notes`
- `sections` è il cuore del sistema, vedi §5.
- `date` è la data "nominale" del workout; la data reale per l'atleta sta su `athlete_workouts.completed_date`.

**`athlete_workouts`** — assegnazione atleta↔workout (tabella pivot, è **qui** che sta lo stato)
`id, athlete_id, workout_id, completed_date, status ('pending'|'completed'), notes, voice_note_url`
- `notes` codifica l'RPE nel testo: `[RPE: 7/10]\ntesto libero`
  → helper `parseNotesAndRpe()` / `formatNotesWithRpe()` (⚠️ **duplicati in 3 file**).
- `voice_note_url`: la "cancellazione" è **soft** — si appende `#deleted=<timestamp>` all'URL;
  `isVoiceNoteValid()` filtra quelli marcati.

**`personal_records`** — `id, athlete_id, exercise, value, date`

**`notifications`** — `id, user_id, title, message, route, is_read, created_at`
- Realtime attivo su INSERT/UPDATE in Home (`supabase.channel('public:notifications')`).

**`push_subscriptions`** — `id, user_id, endpoint, auth, p256dh, badge_count`
- `auth === 'capacitor_ios'` distingue i token FCM nativi dalle subscription Web Push.
- `endpoint` è la chiave di upsert (`onConflict: 'endpoint'`).

**`invitation_codes`** — `id, code, is_active, created_by, used_by, used_by_email, used_at, created_at`

**`tv_sessions`** — `code (4 cifre), workout_id, athlete_id, updated_at`

### Storage buckets
- `athlete-photos` — foto profilo (pubbliche)
- `voice-notes` — note vocali coach↔atleta; gli audio "live walkie-talkie" si **auto-eliminano dopo 60s**

### Edge Functions
- **`send-reminders`** — 5 modalità via `body.mode`:
  - `morning` / `evening` (cron): promemoria agli **atleti**, personalizzato per nome, con fallback "Giorno di Rest".
    ⚠️ **Gli account in `ADMIN_EMAILS` sono esclusi** (28/08/2026): questa modalità parla a chi si
    allena («Oggi ti aspetta…»), e il coach riceveva due push al giorno su allenamenti suoi che non
    esistono. L'esclusione toglie anche la riga in `notifications` e il badge, non solo la push.
    Se `listUsers` fallisce si invia **senza** filtro (con un `console.error`): meglio una push di
    troppo al coach che tutti gli atleti senza promemoria. `coach_notification` non è toccata.
  - `immediate` (`record_id`): "Nuovo Allenamento!" all'atleta appena assegnato
  - `voice_note` (`record_id`): "Nuova Nota Vocale!" all'atleta
  - `coach_notification` (`action: 'note' | 'completed' | 'custom_workout'`): notifica agli **admin**
    (lista admin ricavata da `supabase.auth.admin.listUsers()` paginato)
  - Gestisce badge iOS incrementale e cancella le subscription morte (404/410/UNREGISTERED)
- **`ai-workout`** — riceve `{ prompt, audioBase64?, mimeType? }`; se c'è audio lo trascrive con
  Gemini 2.5 Flash, poi genera un array JSON di blocchi Hyrox. `fetchWithRetry` con backoff
  esponenziale su 429/5xx. Ritorna sempre status 200 (errori in `{ error }`).
  Secret: `GEMINI_API_KEY`.
- **`cloud-sync`** — invocata da `CloudSyncService` (Strava/Garmin), **non presente nel repo** → probabilmente non ancora implementata.

### 🔴 Cancellazione atleti: cosa distrugge davvero, e cosa era rotto
`delete_expired_athletes()` (cron `0 0 * * *`) fa un **DELETE fisico** degli atleti con
`deleted_at` più vecchio di 7 giorni. `deleted_at` è un **bigint in millisecondi** (il client
scrive `Date.now()`), non un timestamp.

**Le chiavi esterne verso `athletes` sono quasi tutte in CASCADE** (verificato il 25/08/2026):
`athlete_workouts`, `personal_records`, `workout_logs`, `athlete_photos`, `tv_sessions`.
Quindi cancellare un atleta **distrugge tutta la sua storia**, record personali inclusi.
Fa eccezione `workouts_athlete_id_fkey`, che è `NO ACTION`: `workouts.athlete_id` è però una
colonna legacy che il client non scrive mai, quindi in pratica non blocca nulla.

🔴 **E il backup gira DOPO**: backup alle 22:30 UTC, pulizia alle 00:00: la copia ora PRECEDE la cancellazione. Un atleta cancellato a
mezzanotte non è nel backup di quella notte né in nessuno dei successivi. **Spostare il backup
alle 23:00 UTC** risolve, ma il file sta su `main`.

> ⚠️ **Bug corretto il 25/08/2026.** `Home.jsx` eseguiva `update({ deleted_at: null })` sul
> proprio id **a ogni caricamento**, senza condizioni. Un atleta eliminato dal coach si
> ripristinava da solo aprendo l'app: tornava nella rubrica e i 7 giorni ripartivano da zero.
> La cancellazione definitiva poteva avvenire solo per chi non apriva l'app per 7 giorni di fila.
> Ora il ripristino è un gesto esplicito del coach: **Atleti → "Eliminati di recente"**, con i
> giorni rimasti e un bottone Ripristina.
> ⚠️ **La stessa riga è ancora su `main`** (`src/pages/Home.jsx`), quindi sulla web app gli
> atleti continuano ad auto-ripristinarsi.

### 🟠 Note vocali: i file non vengono cancellati davvero
`delete_expired_voice_notes()` (cron ogni ora) fa `DELETE FROM storage.objects`. Questo rimuove
**solo la riga di metadati**: l'URL pubblico smette di funzionare (404), ma i byte restano nello
storage per sempre. Non compaiono in nessun elenco, non finiscono nel backup, e non sono
cancellati — cosa che conta se un atleta chiede la cancellazione dei propri dati.
Il modo corretto è l'API Storage (`supabase.storage.from('voice-notes').remove([...])`).

⚠️ Il gestore `EXCEPTION WHEN OTHERS THEN` della funzione è **vuoto**: ogni errore su una riga
viene inghiottito in silenzio, senza log né conteggio. Gira ogni ora da mesi e non esiste un
indizio su quante righe abbia saltato.

### 🟠 Entrambi i bucket Storage sono PUBBLICI
Verificato il 25/08/2026: `athlete-photos` e `voice-notes` hanno `public = true`. Le note vocali
sono comunicazioni private fra coach e atleta: chiunque abbia l'URL può scaricarle, per sempre,
senza autenticazione. Gli URL non trapelano dall'API (la RLS su `athlete_workouts` è corretta), ma
un bucket pubblico non ha alcuna autorizzazione sul file in sé. La forma giusta è un bucket
privato con URL firmati a scadenza. Cambiarlo richiede di rigenerare gli URL già salvati in
`athlete_workouts.voice_note_url` → **soggetto al congelamento**.

### ⏰ I quattro cron di pg_cron (scoperti il 25/08/2026, prima non documentati)
Il cron **non** è su GitHub: è `pg_cron` dentro Supabase, che chiama le funzioni via `net.http_post`.
Si ispeziona con `select jobid, jobname, schedule, active, command from cron.job;`

| jobname | schedule (UTC) | cosa fa |
|---|---|---|
| `reminder-mattina` | `0 6 * * *` | `send-reminders` con `{"mode":"morning"}` |
| `reminder-sera` | `0 20 * * *` | `send-reminders` con `{"mode":"evening"}` |
| `cleanup-voice-notes` | `0 * * * *` (ogni ora) | `delete_expired_voice_notes()` |
| `cleanup-expired-athletes` | `0 0 * * *` | `delete_expired_athletes()` |

I due `cleanup` chiamano funzioni SQL che **non sono nel repository** e che nessuno aveva
registrato: `supabase/schema/` non le contiene perché la fotografia copre solo le policy RLS.
⚠️ **Vanno lette e documentate**: `delete_expired_athletes()` **cancella righe**, e non sappiamo
con quale criterio.

### 🔴 Il backup gira DOPO la cancellazione degli atleti
`cleanup-expired-athletes` gira alle **00:00 UTC**, il backup del database alle **22:30 UTC**.
Un atleta cancellato definitivamente a mezzanotte **non è più nel backup di quella notte**, e
neanche in quelli successivi: la cancellazione precede sempre la copia. Se il criterio di
`delete_expired_athletes()` fosse sbagliato, non ci sarebbe modo di accorgersene né di rimediare.
✅ **Risolto il 25/08/2026**: il backup è stato spostato a `30 22 * * *`, un'ora e mezza prima della pulizia.

### ⚠️ La service role key è in chiaro dentro `cron.job`
I due `reminder-*` portano la chiave `service_role` scritta a mano nell'header `Authorization`
del comando. Non è esposta via API REST (lo schema `cron` non è fra quelli pubblicati), ma è un
punto di duplicazione che nessuno pensa a ruotare. Se la chiave venisse rigenerata, va aggiornata
in: `cron.job` (2 job), i secret GitHub del backup, e ovunque sia stata incollata.

### 🔐 Autorizzazione delle Edge Function (deployata il 25/08/2026)
Prima erano entrambe aperte. Ora:
- **`ai-workout`**: `verify_jwt = true` + controllo che il chiamante sia in `ADMIN_EMAILS`
  (o il token di servizio). Verificato in produzione: senza auth → 401, con la anon key
  del bundle pubblico → 401 `{"error":"Non autorizzato"}`. Prima entrambe le chiamate
  bruciavano `GEMINI_API_KEY`.
- **`send-reminders`**: controllo **per modalità**, perché i chiamanti sono diversi.
  - `immediate`, `voice_note` → solo admin. Verificato: anon key → 403.
  - `coach_notification` → aperta agli autenticati: la invoca il client **dell'atleta**
    quando completa un workout o lascia una nota. Non stringere qui senza rifare il giro.
  - `morning`, `evening` → **PROTETTE dal 25/08/2026** (`APPLICA_CONTROLLO_CRON = true`).
    Verificato che `pg_cron` invoca con un token `role: service_role`, che la funzione riconosce
    per due vie indipendenti (confronto con `SUPABASE_SERVICE_ROLE_KEY` e claim `role`).
    Esiste anche una terza via, il segreto condiviso `CRON_SECRET` più l'header `x-cron-secret`,
    disattivata perché non serve: si attiva da sola se un giorno il secret viene impostato.
    Verificato dopo il deploy: `morning`, `evening`, `immediate` e `voice_note` con la anon key
    danno tutte 403.
    ~~IN OSSERVAZIONE~~ (`APPLICA_CONTROLLO_CRON = false`).
    Il cron è configurato dentro Supabase, nessun workflow GitHub lo chiama, e il default
    della funzione senza body è `morning`: bloccarlo alla cieca spegnerebbe i promemoria di
    tutti gli atleti. La funzione ora **logga l'origine di ogni esecuzione**.
    ✅ **Fatto il 25/08/2026**: letto `cron.job`, il cron invoca con `role: service_role`.
    `APPLICA_CONTROLLO_CRON = true` deployato e verificato.

⚠️ Il deploy di `send-reminders` colpisce **anche la web app in produzione**: è una sola
funzione per due app.

### 🔴 Su iOS le note vocali si registrano con `MediaRecorder`, non col plugin nativo
Accertato il 26/08/2026, con i log dal dispositivo. Il plugin
`@independo/capacitor-voice-recorder` dichiarava successo e restituiva il nulla:

```
hasAudioRecordingPermission → {"value":true}
startRecording              → {"value":true}
stopRecording               → {"msDuration":0,"uri":"", ...}
```

Il file caricato era un contenitore M4A di **557 byte** — intestazione e zero campioni —
contro gli 1-1,9 MB delle note di giugno e luglio. L'atleta vedeva la forma d'onda muoversi
e non sentiva niente.

**Causa**: WebView e recorder nativo si contendono `AVAudioSession`. Non esiste un ordine che
vada bene a entrambi — togliendo `getUserMedia` dal ramo nativo il plugin **non parte affatto**
(«Impossibile accedere al microfono»), tenendolo registra vuoto.

**Soluzione**: `getUserMedia` funziona, e `MediaRecorder` è disponibile nel WKWebView da
iOS 14.5. Su iOS si registra con quello; il plugin nativo resta come ripiego per WebView
vecchi. La scelta è ricordata in un `ref`, perché allo stop non si può rifare guardando
`isNative`: dipende anche da `MediaRecorder` e dallo stream, che a quel punto potrebbero
non esserci più.

> ⚠️ **La lezione generale**: un plugin nativo che risponde `{"value":true}` non sta dicendo
> che ha funzionato. Qui il difetto è sopravvissuto due mesi perché non c'era nessun errore
> da nessuna parte — solo un file muto. Da qui la guardia su `msDuration === 0`, che rifiuta
> di caricare invece di tacere.

> ℹ️ Restano installate **due** librerie audio (§9 punto 4). Ora però non sono equivalenti:
> `@independo/capacitor-voice-recorder` è solo il ripiego, `capacitor-voice-recorder` serve
> alla dettatura IA in CreateWorkout.

### 🔴 Le push NON funzionano su una build Debug lanciata da Xcode
Accertato il 25/08/2026. Il progetto ha due bundle id:
- **Debug** → `it.federicoleo.fleofit.dev` (serve a far convivere le due app sullo stesso telefono)
- **Release/archive** → `it.federicoleo.fleofit`

`GoogleService-Info.plist` è registrato su `it.federicoleo.fleofit`, e le credenziali APNs su
Firebase valgono **per un bundle id specifico**. Quindi una build Debug produce un token APNs di
un'app che Firebase non conosce, e FCM risponde:
`401 "Invalid APNs credential." · THIRD_PARTY_AUTH_ERROR`.

**Non è un bug: è la conseguenza del suffisso `.dev`.** Sintomo caratteristico: la notifica
**in-app arriva** (è solo una riga in `notifications`) ma **la push no**.

Per testare le push: o si toglie temporaneamente il `.dev` dal bundle id in Debug (disinstallando
prima l'app dal telefono), o si registra su Firebase una seconda app iOS `…​.dev` con il proprio
`GoogleService-Info.plist` usato solo in Debug.

⚠️ **Da verificare comunque prima di pubblicare**: `THIRD_PARTY_AUTH_ERROR` nasce anche da una
credenziale APNs mancante o scaduta. Su Firebase Console → Cloud Messaging deve esserci una
**APNs Authentication Key `.p8`** (copre sandbox e produzione, non scade) e non un certificato
`.p12`. Se manca, le push non funzionano **per nessuno**, neanche dall'App Store.

✅ **Verificato il 26/08/2026 sul binario spedito**: `aps-environment = production`.
`App.entitlements` dichiara `development` ed è usato in entrambe le configurazioni, ma questo
**non è un problema**: l'archivio è firmato col profilo di sviluppo del team
("iOS Team Provisioning Profile", `get-task-allow = true`) ed è l'**export** che rifirma con il
profilo di distribuzione sostituendo `production`. Quindi **ispezionare l'archivio non risponde
alla domanda**: serve l'`.ipa` esportato.
Si rifà così, senza caricare niente (`destination = export` nel plist):
```bash
xcodebuild -exportArchive -archivePath <archivio.xcarchive> \
  -exportOptionsPlist tools/ExportOptions-AppStore.plist \
  -exportPath /tmp/fleofit-export -allowProvisioningUpdates
./tools/verifica-ipa.sh /tmp/fleofit-export
```

### Secrets attesi (Supabase)
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
`FIREBASE_SERVICE_ACCOUNT` (JSON), `GEMINI_API_KEY`.
VAPID public key duplicata client-side in `Settings.jsx` (costante `publicVapidKey`).

### Backup
GitHub Action `.github/workflows/db-backup.yml` — cron `30 22 * * *` (22:30 UTC, **prima** della pulizia di mezzanotte), export REST in zip
caricato come artifact (retention 90 giorni). **Riscritto il 24/08/2026**: tabelle corrette,
paginazione a 1000 righe, validazione della risposta, fallimento esplicito se una tabella critica
(`athletes`, `workouts`, `athlete_workouts`) è vuota o mancante, manifest con i conteggi e riepilogo
nella pagina del run. Le tabelle da salvare stanno in `env.TABLES`: **se aggiungi una tabella al DB,
aggiungila anche lì.**
- ✅ **COSA SALVA DAVVERO IL BACKUP DI STANOTTE** (riletto su `origin/main` il 25/08/2026, è il
  file che il cron esegue):
  `TABLES='athletes workouts athlete_workouts personal_records invitation_codes notifications'`.
  **`personal_records` è dentro**: era il dato meno ricostruibile del sistema e non era mai stato
  salvato — aggravato dal fatto che ha una policy RLS `ALL/{authenticated}/true`, cioè è
  cancellabile da qualunque utente loggato (§4-bis).
  Restano fuori di proposito: `push_subscriptions` e `tv_sessions` (effimere, si rigenerano) e
  `workout_logs`/`athlete_photos` (legacy, 0 occorrenze nel client).
  `REQUIRED_TABLES='athletes workouts athlete_workouts'`: se una di queste è vuota, il job fallisce
  invece di caricare un backup inutile.
  ⚠️ Correzione del 24/08/2026: una versione precedente di questa nota affermava che
  `athlete_photos` e `workout_logs` "non esistono". **È falso**: `pg_tables` le elenca entrambe nello
  schema `public`. Sono tabelle **legacy mai referenziate dal client** (0 occorrenze in `src/` e
  `supabase/`), quindi il backup attivo spende due delle cinque voci su tabelle morte.
- ✅ **Il file corretto è su `main` dal 25/08/2026 ed è identico a questo** (verificato con
  `diff`). Conta perché gli scheduled workflow girano **solo dal branch di default**: fino ad
  allora il cron notturno eseguiva la versione rotta. Se rimetti mano al workflow, riporta
  **solo quel file**: `git checkout main && git checkout ios-version -- .github/workflows/db-backup.yml`
- Il backup copre l'unico database, che è **condiviso** fra web app e app iOS (§1.1).
- ✅ **I bucket Storage sono nel backup dal 25/08/2026** (`athlete-photos`, `voice-notes`):
  inventario sempre, file scaricati se `STORAGE_SCARICA = si` e finché si resta sotto
  `STORAGE_MAX_MB` (1 GB). ⚠️ **Privacy**: le note vocali sono comunicazioni private fra coach e
  atleta e finiscono in un artifact GitHub. Se il repository diventa pubblico, mettere
  `STORAGE_SCARICA` a `no` e conservare solo l'inventario.
  ⚠️ Come per le tabelle, **vale solo quando il file è su `main`**: i cron girano dal branch di default.
In-app: Settings ha export/import JSON completo e per singolo atleta.

---

---

## 4-bis. Stato reale della RLS (verificato sul DB il 24/08/2026)

> 📄 **Le policy sono ora sotto controllo di versione**: `supabase/schema/rls_snapshot_2026-08-25.sql`
> (fotografia leggibile, **non** una migrazione: non applicarla). Prima il database non aveva
> nessuna rappresentazione nel repository, quindi le policy non erano né revisionabili né
> ricostruibili. Il `README.md` accanto spiega come sostituirla con un dump vero quando hai la
> password del database. Aggiornala ogni volta che cambi una policy.

RLS **attiva su tutte e 10 le tabelle**. Ma le policy hanno buchi verificati, elencati per gravità.
Fonte: `pg_policies` interrogata dal committente. ⚠️ Manca ancora l'ispezione di `with_check`
(le policy INSERT mostrano `qual = null`): finché non è letta, non si conosce il controllo su
`Admins can create invitation codes` né su `Permetti creazione workout autonomi`.

### 🔴 `demo@fleofit.it` NON è nelle policy RLS — TERZA lista di admin
Le policy di `athletes`, `athlete_workouts`, `workout_logs`, `invitation_codes`, `push_subscriptions`
e `workouts` controllano l'admin contro un array di **4 email** che **non contiene
`demo@fleofit.it`**, mentre il bundle spedito ad Apple e `send-reminders` la contengono.
Conseguenza: **l'account del revisore ha `isAdmin = true` nel client e `admin = false` nel
database** → rubrica atleti vuota, workout assegnati vuoti, codici invito vuoti, modifica workout
negata. È di nuovo la condizione che ha prodotto il rifiuto **2.3.1(a)** di maggio.

> ⚠️ **Correzione a §9 punto 7 e a §9-ter.** Le liste di admin hardcodate non sono due, sono **TRE**:
> `src/App.jsx`, `supabase/functions/_shared/admin.ts` (condivisa dalle due Edge Function dal
> 25/08, prima erano due copie separate) e **le policy RLS**.
> Il corollario di §9-ter ("conta solo l'elenco compilato dentro il bundle") è **incompleto**:
> contano entrambi gli elenchi, e quello nel database è quello che decide cosa il revisore vede.

Il fix è `ALTER POLICY` con l'email aggiunta all'array: **puramente additivo**, non toglie accesso a
nessuno, non può rompere la web app. È l'unica eccezione raccomandata al congelamento (regola 0-bis).

> ⚠️ **TRAPPOLA VERIFICATA IL 24/08/2026 — `USING` e `WITH CHECK` sono due clausole distinte.**
> Su una policy `ALL`: `USING` governa SELECT/UPDATE/DELETE (cosa vedi e cosa tocchi),
> `WITH CHECK` governa INSERT e le righe risultanti di UPDATE (cosa scrivi).
> **`ALTER POLICY ... USING (...)` NON modifica `WITH CHECK`**: resta quello di prima, in silenzio.
> È successo davvero: dopo il primo giro di `ALTER POLICY` sul solo `USING`, `demo@fleofit.it`
> vedeva la rubrica atleti piena ma **non poteva creare un atleta né assegnare un workout**, perché
> `athletes.with_check` e `athlete_workouts.with_check` contenevano ancora 4 email.
> **Regola**: quando allinei una lista admin, scrivi sempre entrambe le clausole nella stessa
> `ALTER POLICY`, e verifica con:
> ```sql
> select tablename, policyname, cmd,
>        qual::text like '%demo@fleofit.it%'       as using_ok,
>        with_check::text like '%demo@fleofit.it%' as check_ok
> from pg_policies where schemaname = 'public'
>   and (qual::text like '%federico.leo88%' or with_check::text like '%federico.leo88%');
> ```
> `check_ok = null` è accettabile: quella policy non ha `WITH CHECK` ed eredita `USING`
> (è il caso di `workouts` → "Solo gli admin possono modificare i workout").
>
> **Il fix strutturale**, da fare dopo l'approvazione App Store: sostituire i 6 array copiati con
> un'unica funzione `public.is_admin()` richiamata da tutte le policy, così la lista vive in un posto
> solo invece che in tre (§9 punto 7). È un cambiamento di policy non additivo → soggetto al
> congelamento (regola 0-bis).

### 🔴 `personal_records`: `ALL | {authenticated} | true` — sia `qual` sia `with_check`
Qualunque utente loggato legge, modifica, inserisce e **cancella i PR di tutti gli atleti**. Ed è la
tabella che il backup non salva (§4). Combinazione peggiore del sistema: scrittura libera + nessuna
copia di sicurezza.

### 🔴 `invitation_codes`: la registrazione chiusa non è chiusa
`Anonymous users can validate a code | SELECT | {anon} | (is_active AND used_by IS NULL)`:
un anonimo con la anon key (in chiaro nel bundle) **enumera tutti i codici validi**, poi si registra.
Il `signOut()` di `App.jsx` (ramo `/login?error=unauthorized`) è cosmetico. Forma corretta: funzione `security definer` che
risponde sì/no senza esporre la tabella. **Non additivo → dopo l'approvazione App Store.**

### 🟠 `push_subscriptions`: `Enable all operations for authenticated users | ALL | true`
Le policy si sommano in OR: questa annulla le due scritte correttamente accanto a lei. Qualunque
atleta legge **tutti i token push**. Rimuoverla è restrittivo → dopo l'approvazione.

### 🟠 `workouts`: `Permetti alla TV di leggere i workout | SELECT | {public} | true`
Chiunque abbia la anon key scarica **l'intera programmazione**. Serve alla TV, ma dovrebbe essere
limitata al workout referenziato da una `tv_sessions` attiva.

### 🟡 `tv_sessions`: `ALL | {public} | true` — chiunque può sovrascrivere una sessione e dirottare un cast.
### 🟡 `athlete_photos`: `ALL | {authenticated} | true` — tabella legacy non usata dal client.

### ✅ Scritte bene
`athletes`, `athlete_workouts`, `workout_logs` (`auth.uid()` + admin) e `notifications`
(`auth.uid() = user_id`). Due `with_check` particolarmente ben fatte, da non toccare:
`workouts → Permetti creazione workout autonomi` limita l'INSERT libero a
`(sections->>'isAutonomous')::boolean = true` (un utente non può inserirsi programmazione
arbitraria), e `invitation_codes → Admins can create invitation codes` lega `created_by = auth.uid()`
(nessuno può falsificare l'autore di un codice).

## 5. Il formato `workouts.sections` (jsonb) — struttura chiave

Tre categorie principali + due implicite.

### Comune
```jsonc
{ "intensity": "7", "category": "Hyrox" | "Running" | "Custom" | "Event", "isAutonomous": true? }
```

### Hyrox → `sections.blocks[]`
```jsonc
{
  "id": 0.123,                     // Math.random(), solo client-side
  "type": "WarmUp"|"Cash In"|"ON/OFF"|"EMOM"|"AMRAP"|"For Time"|"Interval"|"Rest"|"Cash Out",
  "params": {                      // dipende dal type
    "duration": "3:00",            // WarmUp, Rest, AMRAP
    "on": "1:00", "off": "1:00",   // ON/OFF
    "interval": "1:00",            // EMOM
    "rounds": "10",                // ON/OFF, EMOM, For Time, Interval, Cash In/Out
    "rest": "1:00"                 // Cash In/Out con rounds > 1
  },
  "notes": "…",
  "exercises": [{
    "id": 0.456, "name": "Wall Balls",
    "reps": "15" | "Max" | "-",    // esercizi a ripetizioni
    "meters": "500m" | "Max" | "-",// ergometri, sled, carry, run
    "exTime": "1:30",              // solo blocchi Interval
    "ergoPace": "2:00 /500m" | "Z2" | "45 RPM",
    "speed": "12.0 km/h",          // solo Run in modalità velocità
    "kg": "9",                     // stringa senza unità
    "intensity": "8", "notes": "…"
  }]
}
```
Tassonomie esercizi in `CreateWorkout.jsx:16-55`: `ERGOMETERS`, `SLED_EXERCISES`, `CARRY_EXERCISES`,
`DISTANCE_EXERCISES`, `HYBRID_EXERCISES` (reps **o** distanza) + `HYROX_EXERCISES` (~130 esercizi,
ordinati alfabeticamente). Si possono aggiungere esercizi **custom** scrivendoli a mano nel picker.

### Running → `sections.steps[]`
```jsonc
{
  "id": 0.789,
  "type": "warmup"|"run"|"recover"|"cooldown"|"repeat",
  // step semplice:
  "duration": "10 min" | "5 km", "pace": "5:00 - 5:30 /km", "paceMin": "…", "paceMax": "…",
  "intensity": "6", "notes": "…",
  // step "repeat" (ripetute):
  "rounds": "8",
  "runDuration": "400m", "runPace": "…", "runPaceMin/Max": "…", "runIntensity": "8",
  "recDuration": "1 min", "recPace": "…", "recPaceMin/Max": "…", "recIntensity": "3"
}
```
Ritmi ammessi: `Libero`, `Camminata`, `Z1`–`Z5`, `All out`, `Gara`, oppure `m:ss /km` da 2:00 a 10:00.

### Custom / Autonomo
`{ "category": "Custom", "isAutonomous": true }` — nessun blocco, il contenuto vive in
`workouts.coach_notes` (creato dal coach) o in `athlete_workouts.notes` (allenamento libero
inserito dall'atleta). L'atleta lo crea dal bottone "Aggiungi allenamento libero" in Home.

### ⚠️ Titolo automatico (dal 24/08/2026, su ENTRAMBI i branch)
`workouts.title` **non può mai essere vuoto**: è letto in 57 punti su `main` e 66 su `ios-version`
(scheda, archivio, PDF, story IG, TV, testo delle push) e il DB è condiviso. Quando l'utente non
scrive un titolo, `src/lib/workoutTitle.js` ne **genera e salva** uno nel formato
`Allenamento libero · mar 25 ago`, con suffisso `(2)`, `(3)`… se quel giorno ne esiste già uno uguale.
- Il campo Titolo è **facoltativo** solo nel flusso Custom/autonomo (modale "Allenamento Libero" in
  Home/AthleteDetail/WorkoutDetail) e nel builder **quando `category === 'Custom'`**. Per Hyrox e
  Running resta obbligatorio: un titolo generato dalla data non direbbe nulla di una programmazione.
- Il placeholder del campo mostra in anticipo il titolo che verrà salvato, così l'utente sa cosa ottiene.
- Nessuna modifica di schema: `title` resta una stringa normale, quindi le due app restano compatibili.

### Event (gara)
`{ "category": "Event", "isEvent": true, "isAutonomous": true }` — creato dal Calendario.
Genera il banner countdown "Prossimo Obiettivo" in Home e in AthleteDetail.

### ⚠️ Formato legacy
Esistono workout vecchi con `sections.warmup / cashIn / main / cashOut` invece di `blocks`.
La migrazione **runtime** avviene in `getNormalizedBlocks()` (ora in `src/lib/timerSequence.js`)
e nel `useEffect` di edit di CreateWorkout. **Non rimuovere questa logica di fallback.**
✅ Dal 26/08/2026 è coperta da test, inclusa la conversione storica «EMOM con parametro `on`
era in realtà un ON/OFF»: perderla trasformerebbe l'allenamento senza errori a schermo.

---

## 6. Design system — COLORI DA MANTENERE

### Palette (fonte di verità: `src/index.css` `@theme` + costanti nei file)

| Token | Hex | Uso |
|---|---|---|
| **Brand / giallo FLEOFIT** | `#f1ba17` | accento primario, categoria **Hyrox**, CTA principali, stato attivo navbar, logo "FIT" |
| **Background** | `#0B0B0B` | sfondo pagina |
| **Surface card** | `#1e1e1e` | card, modali, header |
| **Surface alt** | `#222222` | navbar, input, blocchi builder |
| **Surface 2** | `#2a2a2a` | bottoni secondari, avatar placeholder |
| **Input / pozzetto** | `#111111` | campi input dentro le card, scroll picker |
| **Bordi** | `#2a2a2a` / `#333` / `#383838` / `#444` | in scala crescente di contrasto |
| **Running** | `#0094C6` (azzurro) | categoria Running, picker corsa |
| **Custom / Autonomo** | `#D11149` (rosso magenta) | categoria Custom |
| **Event / Gara** | `#ffffff` | categoria Evento |
| **IA / voce** | `#a855f7` (viola) | modale "Genera con IA" |
| **Successo** | `green-500` Tailwind | workout completato |
| **Live / errore** | `red-500/600` | Live Coach Cam, cardio BLE, eliminazioni |
| **Offline** | `orange-500` | banner "Modalità Offline" |
| Testi | `white` → `gray-300` → `gray-400` → `gray-500` → `gray-600` | gerarchia discendente |

> ✅ **Dal 26/08/2026 i colori di marchio passano dai token.** `bg-[#f1ba17]` è diventato
> `bg-brand`, e così azzurro (`running`), magenta (`custom`) e viola (`ia`): 584 occorrenze
> ridotte a 8 righe, i token di `src/index.css` più le costanti di `src/lib/colori.js`.
> **I VALORI NON SONO CAMBIATI** — la regola 3 vale sempre.
>
> Perché due elenchi e non uno: classi Tailwind e valori JS vivono in due mondi, e dove il
> colore finisce in un canvas, in un SVG o in uno `style` inline rasterizzato da
> html-to-image, una variabile CSS non viene risolta. `src/lib/__tests__/colori.test.js`
> verifica che i due elenchi coincidano — è l'unica ragione per cui averne due è accettabile.
>
> ⚠️ I grigi delle superfici sono ancora valori arbitrari (~870 occorrenze). Non è una
> dimenticanza: in un rebranding non cambiano (BACKLOG #18-bis).
>
> 🔴 **Trappola trovata il 26/08**: Tailwind cerca le classi in TUTTO il progetto, file `.md`
> compresi. `CLAUDE.md` e `DESIGN.md` contengono `bg-[#f1ba17]` come esempi, e Tailwind ci
> generava sopra regole vere che finivano nel CSS di produzione — tenendo in vita il vecchio
> giallo anche dopo la migrazione. Per questo `src/index.css` ora usa
> `@import "tailwindcss" source(none)` e dichiara `@source "../src"`: senza, la
> documentazione influenza il prodotto.

### Codifica colore per intensità/RPE
- Slider **intensità** in CreateWorkout (`getIntensityColor`): grigi → bianco → giallo brand a 10.
- **RPE** in WorkoutDetail/Home (`getRpeColor`): ≤3 verde · ≤6 giallo · ≤8 arancione · >8 rosso.
  (⚠️ due scale diverse per lo stesso concetto, vedi §9.)

### Linguaggio visivo
- **Dark mode only.** Nessun tema chiaro previsto.
- Font: **Inter**, `sans-serif` di sistema come fallback. Titoli in `font-black` (900) con
  `tracking-tight`. Logo sempre `FLEO` bianco + `FIT` giallo.
- **Raggi**: `rounded-3xl` (24px) per card e modali · `rounded-2xl` (16px) per card interne e
  bottoni larghi · `rounded-xl` (12px) per input e bottoni piccoli · `rounded-full` per icon-button
  (11×11 o 10×10) e pillole di stato.
- **Pattern card**: `bg-[#1e1e1e] border border-[#2a2a2a] rounded-3xl p-5/p-6`, hover
  `hover:border-[#f1ba17]` (o il colore della categoria).
- **Badge/pillole**: `bg-<colore>/10 text-<colore> border border-<colore>/30 rounded-full text-xs font-bold`.
- **CTA primaria**: `bg-[#f1ba17] text-black font-bold rounded-xl hover:brightness-110`.
- **Icona grande in filigrana**: molte card hanno un'icona lucide `size={64-80}` in
  `absolute top-0 right-0 opacity-10 -rotate-12`, che va a `opacity-20` in hover.
- **Empty state**: bordo `border-dashed`, icona in cerchio grigio, testo grigio + emoji.
- **Skeleton loading**: `bg-[#1e1e1e] border border-[#2a2a2a] rounded-2xl h-N animate-pulse`.
- **Toggle segmentati**: contenitore `bg-[#111] p-1.5 rounded-2xl border border-[#333]` con
  indicatore assoluto che trasla (`translate-x-full`) in 300ms `ease-out`.
- **Modali**: overlay `bg-black/85`, contenuto via `createPortal(…, document.body)`,
  z-index `[60]` builder · `[100]` Home · `[150]` alert/RPE. Animazione
  `animate-in fade-in zoom-in-[0.96] duration-300 ease-out` (o la classe `.modal-transition`).
- **Bottom sheet**: `rounded-t-3xl`, maniglia grigia, **swipe-down > 100px per chiudere**.
  Il meccanismo sta in `src/useBottomSheet.js` (entrata, trascinamento, uscita, blocco dello
  scorrimento sotto) e lo usa il menu della scheda workout. ⚠️ Il centro notifiche in `Home`
  ha ancora la **propria copia**, scritta a mano: BACKLOG #33.
- **Transizione pagina**: classe `.page-transition` — slide-up 15px + fade, 0.3s `cubic-bezier(0.16,1,0.3,1)`.
- **Scrollbar sempre nascoste** (regola globale in `index.css` + classe `.hide-scrollbar`).
- **Safe area iOS**: ogni pagina apre con `pt-[calc(env(safe-area-inset-top)+1rem)]` e
  chiude con `pb-[var(--fondo-pagina)]` (o `pb-[var(--altezza-navbar)]` dove finisce
  con una barra fissa) per non finire sotto la tab bar.
  🔴 **L'altezza della navbar si scrive in UN posto solo**: `--altezza-navbar` in
  `src/index.css`. Era `pb-16` in `App.jsx` più `pb-[calc(6rem+…)]` in cinque pagine
  più l'offset di `BarraAzioni` — **sette copie a mano**, che hanno coinciso per caso
  finché la barra è stata alta 4rem. Il 28/08, diventata la capsula galleggiante
  dell'artboard 2b (99px + safe area), sarebbero servite sette modifiche coordinate e
  la prima dimenticata avrebbe nascosto contenuto sotto la barra **senza dare errore**.
- **Tab bar**: non è una barra piena attaccata al fondo, è una **capsula galleggiante**
  (`rounded-full`, `rgba(30,30,34,.88)`, blur 22 + saturate 170%, ombra proiettata) con
  10px d'aria sopra e 16px sotto. La voce attiva prende un **cerchio** da 36px dietro la
  sola icona, non una pillola dietro icona ed etichetta (§9-quaterdecies).
- **Feedback aptico**: `Haptics.impact({ style: ImpactStyle.Light })` sugli scroll-picker e sugli
  slider, `Heavy` a fine round del timer; fallback `navigator.vibrate()` su web.
- **Testo non selezionabile** globalmente tranne input/textarea (regola inline in `App.jsx`).

---

## 7. Funzionalità principali (mappa per orientarsi)

### Atleta
- **Home**: saluto orario + frase motivazionale del giorno (persistita in localStorage con
  anti-ripetizione sulle ultime 10), banner countdown prossimo evento, **slider a 2 pagine**
  (settimana a pallini colorati per categoria/stato ↔ statistiche settimanali: tempo, completati,
  RPE medio), workout di oggi, prossimi allenamenti, scorciatoie, archivio.
- **Completamento workout** → apre la **modale RPE**: slider 1-10 draggabile + note.
  ⚠️ Il pulsante **🍏 Apple Health** è sparito il 21/09/2026 con tutto HealthKit: era il
  rilievo **2.5.1** di Apple, e rimetterlo respinge la build (§9-quatertricies).
- **Allenamento libero**: l'atleta crea un workout Custom autonomo con titolo, data e note.
- **Modalità Offline**: `@capacitor/network` rileva l'assenza di rete → banner arancione,
  le azioni finiscono in `localStorage.fleofit_offline_queue` e vengono sincronizzate al ritorno
  della linea. Cache read in `fleofit_cache_workouts_<uid>`, `fleofit_cache_w_<id>`, ecc.
- **Profilo** (`/profile` → `AthleteDetail`): tab Workout / PR / Statistiche, vista lista o
  calendario, link Instagram/Strava.

### Coach (admin)
- **Workout Builder** (`/create`), 2 step: (1) titolo+data+categoria → (2) composizione.
  - Blocchi Hyrox riordinabili con **drag&drop desktop + `useTouchDrag` su mobile**, duplicabili,
    con scroll-picker in stile iOS per tempi/rounds/kg/metri.
  - Builder Running con fasi warmup/run/recover/cooldown/**repeat** e range di passo "da–a".
  - **Genera con IA**: dettatura vocale o testo → Gemini → blocchi precompilati.
  - **Autosalvataggio bozza** in `localStorage.fleofit_workout_draft` + intercettazione
    dell'uscita di pagina (beforeunload, click sui link, blocco pull-to-refresh).
  - Salvando un workout esistente si può scegliere "sovrascrivi" o "salva come nuovo".
- **Gestione atleti**: rubrica, scheda con storico, nota per l'atleta, PR, statistiche (carico
  settimanale = tempo × RPE su 4 settimane, tasso di completamento a 30 giorni, distribuzione RPE).
- **Assegnazione**: multi-atleta con data, dall'archivio o dalla scheda workout → notifica push immediata.
- **Live Coach Cam**: Supabase **Presence** sul canale `global_live_workouts`; quando un atleta
  avvia il timer il coach lo vede in Home, può aprire lo spettatore (timer live via broadcast),
  mandare **reazioni emoji** (🔥💪🚀👏💀) e messaggi audio **walkie-talkie** (upload su
  `voice-notes`, broadcast dell'URL, auto-delete dopo 60s).
- **Settings**: notifiche push, backup/restore JSON, generazione codici invito + link
  `?invite=CODICE`, connessione fascia cardio BLE, cambio password, simula atleta.

### Workout Detail (il file più denso)
- Rendering della scheda per categoria, note atleta con RPE, note vocali bidirezionali
  (registrazione nativa iOS + web MediaRecorder, player custom con waveform).
- **Timer guidato** (⚠️ **non per gli allenamenti di corsa**, dal 26/08/2026 — decisione del
  committente: le fasi si seguono con l'orologio. La regola sta in `haTimerGuidato()`, un punto
  solo, e vale anche per gli Eventi/gare. Conseguenze volute: la Live Coach Cam non vede gli
  atleti che corrono, perché la presenza è tracciata dentro `WorkoutTimer`; il cast su TV mostra
  il piano statico): `buildTimerSequence()` linearizza il workout in una sequenza di step
  (`prep` → step → `done`) con beep WAV generati in-memory (600Hz corto / 1200Hz lungo),
  vibrazione, mute, minimizzabile, `KeepAwake`.
- **Export PDF** (jsPDF, sfondo scuro, logo, intensità colorata con emoji 💪).
- **Story Instagram**: card 420px renderizzata con `html-to-image` → salvataggio in galleria
  (`@capacitor-community/media`) o `Share`.
- **Cast su TV**: codice a 4 cifre generato da `/tv`; il telefono aggiorna `tv_sessions` e
  trasmette lo stato del timer via broadcast Realtime sul canale `tv_<code>`.

---

## 8. Convenzioni da rispettare

- **Chiavi localStorage** (tutte con prefisso `fleofit_`, tranne `adminRoleOverride`):
  `fleofit_name_<uid>`, `fleofit_invite_code`, `fleofit_motivation`, `fleofit_workout_draft`,
  `fleofit_offline_queue`, `fleofit_cache_workouts_<uid>`, `fleofit_cache_w_<id>`,
  `fleofit_cache_aw_<id>_<athleteId>`, `fleofit_cache_all_aw_<id>`, `fleofit_tv_code`,
  `fleofit_ultimo_export`, `fleofit_invito_atteso`, `adminRoleOverride`.
  ⚠️ `fleofit_ultimo_export` è una memoria **del dispositivo**, non un registro dei backup:
  dice «l'hai esportato da qui», e su un telefono nuovo semplicemente non c'è (§9-duoetvicies).
  ⚠️ `fleofit_invito_atteso` è un passaggio di consegne fra due caricamenti della pagina —
  `ProtectedRoute` lo scrive prima del `signOut()`, il passo 2 del login lo legge e lo
  **cancella subito** (§9-septvicies). Non è una preferenza: lasciarlo lì vorrebbe dire
  mostrare l'indirizzo di qualcun altro in testa alla schermata dell'invito.
- **Mai `alert()` / `confirm()` nativi** nella UI: usare `CustomAlert` / `CustomConfirm` via
  `setAlertInfo({ title, message, type: 'error'|'success' })` / `setConfirmInfo({ title, message, onConfirm })`.
  (Restano alcune `alert()` legacy in Home e CreateWorkout — quando le tocchi, convertile.)
- **Ogni modale** va renderizzata con `createPortal(…, document.body)`.
- **Parametri di `/login`**: `?invite=<codice>` (il link del coach, salta le caselle),
  `?serve=invito` (ci manda `ProtectedRoute` a chi è autenticato senza profilo) e
  `?error=unauthorized` (la vecchia uscita, che nessuno produce più — §9-septvicies).
- **Rotte**: `/`, `/login`, `/tv` (pubblica), `/calendar`, `/create`, `/athletes`, `/athletes/:id`,
  `/profile`, `/workout/:id`, `/archive`, `/report` e `/report/:id` (**solo coach**, §9-vicies e §9-vicies-bis), `/settings`. Deep link workout:
  `/workout/<workoutId>?athlete_id=<uid>` — è il formato usato anche in `notifications.route`.
- **Aggiornamenti ottimistici**: si aggiorna lo state prima della chiamata Supabase e si fa rollback
  in caso di errore (pattern in `toggleTodayWorkout`, `toggleStatus`).
- **Native check**: sempre `Capacitor.isNativePlatform()` prima di usare un plugin, con
  `.catch(() => {})` sui plugin non critici.
- **Badge iOS**: si scrive **solo** con `sincronizzaBadge()` di `src/lib/badge.js`. Aggiorna
  insieme il badge nativo e `push_subscriptions.badge_count`, che non sono equivalenti: il primo
  è cosmetico, il secondo viene **riletto da `send-reminders`** per calcolare il badge della push
  successiva, quindi se salta ogni notifica futura porta il numero sbagliato.
  In `Home` non si chiama nemmeno a mano: c'è **un solo effetto** su `unreadCount`, che a sua
  volta è **derivato** da `notifications` con `useMemo`. Chi cambia le notifiche non deve pensare
  al badge — ed è il motivo per cui non possono più divergere (erano 7 punti da allineare a mano).

---

## 9. Debito tecnico noto (contesto, non da sistemare senza richiesta)

0-bis. ⚠️ **localStorage si legge SOLO con `leggiJson`/`scriviJson` di `src/lib/offlineQueue.js`.**
   Un `JSON.parse(localStorage.getItem(...))` nudo ha già prodotto due guasti silenziosi
   (§9-quater punti 1 e 4). Le chiavi sono elencate al §8.
1. ~~Codice duplicato pesante~~ → **in gran parte chiuso il 25-26/08/2026.**
   In `src/lib/`: `rpe`, `blockColors`, `constants`, `offlineQueue`, `timerSequence`,
   `statistiche`, `badge`, `colori`, e dal 27/08 `notaVocale`, `categorie`, `stiliCard`.
   In `src/components/`: `VoiceRecorder`, `AudioVisualizer`, `RpeModal`, `CustomAudioPlayer`.
   Dal 28/08 `RiepilogoWorkout`, `BarraAzioni`, `CtaPrimaria`, `BottoneQuadrato`,
   `SpinaBlocco` e `DurataBlocco` di `CreaWorkoutUI` servono **anche la scheda**: il
   coach ritrova in lettura la stessa cosa che ha visto in scrittura, e due copie
   divergerebbero al primo ritocco (§9-duodecies). `VETRO` è salito in
   `lib/stiliCard.js` per la stessa ragione. Nella scheda sono spariti `Section` ed
   `ExList`, sostituiti da `BloccoScheda` e `RigaEsercizio`.
   > `isVoiceNoteValid` era in due copie e la Home coach ne sarebbe stata la **terza**:
   > il soft delete `#deleted=` è una regola di dominio, e una terza copia è il modo in
   > cui una correzione ne raggiunge due su tre. Stessa ragione per `CARD`/`LABEL` e per
   > la tabella delle corsie, che erano dentro `HomeAtletaUI.jsx`: stanno in `lib/` e non
   > esportate da un file di componenti perché un modulo che esporta anche una costante
   > perde il Fast Refresh per intero (§9-octies punto 3).
   > 🔴 **Perché contava, detto dai fatti.** `VoiceRecorder` era in TRE copie, e il
   > 25/08 un guasto è stato corretto in **due su tre**. Confrontandole il 26/08 erano
   > già diverse: Home aveva il messaggio all'utente quando il MediaRecorder fallisce,
   > WorkoutDetail il log dell'errore nativo, e **nessuna delle due aveva entrambe**.
   > Il componente unico prende il meglio delle due linee separate.
   > Le tre pagine perdono 1.360 righe, i componenti condivisi ne aggiungono 537.
   **Restano duplicati** i beep WAV (WorkoutDetail e TVDashboard) e le cinque funzioni
   di colore per intensità/RPE sparse in quattro file (§9 punto 3, BACKLOG #16-bis).
2. ~~File morti~~ → **rimossi tutti e cinque** (`src/pages/useTouchDrag.js`, `src/pages/patch.js`,
   `src/pages/Invite.jsx`, `src/App.css`, `index.ts` in root). Verificato il 25/08: nessuno
   esiste più sul disco. ⚠️ `src/pages/Invite.jsx` **esiste ancora su `main`**.
   Il 25/08 ne è stato tolto altro: `updateWorkoutNote` (Home), `SCHEMES` (TVDashboard),
   `isDistance` con la sua tassonomia e `MINUTES_OPTIONS`/`timeToSeconds`/`formatTime`
   (CreateWorkout), più 10 import inutilizzati.
3. **Due scale colore RPE/intensità** diverse (§6) per lo stesso range 1-10.
4. **Due librerie di registrazione audio** installate insieme (`capacitor-voice-recorder` usata in
   CreateWorkout, `@independo/capacitor-voice-recorder` in Home/WorkoutDetail).
5. **`window.location.reload()`** usato dopo alcuni salvataggi in Home invece di rifare il fetch.
6. **Segreti nel repo**: `supabaseClient.js` contiene URL + anon key in chiaro (accettabile per una
   anon key **se** l'RLS è configurata correttamente — verificare le policy prima di aprire l'app);
   `Settings.jsx` contiene la VAPID public key hardcodata; `GoogleService-Info.plist` è versionato.
7. **`ADMIN_EMAILS` hardcodata in due posti + le policy RLS.** Le Edge Function non hanno più
   una copia propria: dal 25/08 importano entrambe `supabase/functions/_shared/admin.ts`.
   Restano quindi **`src/App.jsx` + `_shared/admin.ts` + le policy RLS** = tre copie in tutto.
   ✅ Verificate allineate il 25/08 (stesse 5 email, e `pg_policies` coincide con la fotografia
   in `supabase/schema/`). **È il meccanismo che ha causato il rifiuto 2.3.1(a) di maggio:
   ricontrollarlo prima di ogni submission**, vedi §9-ter.
8. **`COACHING_ID` hardcodato** (`0118e43f-…`) in due file.
9. ~~Backup GitHub Action con lista tabelle obsoleta~~ → **CHIUSO il 25/08/2026.** Riscritto il
   24/08 (`79d146a`, vedi §4) e **portato su `main`** il 25/08, dove i cron girano davvero.
   Verificato identico sui due branch con `diff`.
9-bis. **Due app sullo stesso database senza staging** e la web app (`main`) che non capisce l'RPE:
   è il debito architetturale più serio del progetto. Dettagli e conseguenze in §1.1.
10. ~~**`cloud-sync`** invocata dal client (`health.js`) ma assente dal repo~~ → `CloudSyncService`
    **eliminato il 24/08/2026** (`fc81404`): era codice dormiente che chiamava una Edge Function
    inesistente, e rinforzava il rilievo 2.3.1(a). La sincronizzazione Strava/Garmin resta un'idea
    non implementata (§10), ora senza codice morto a suggerire il contrario.
11. ~~Nessun test automatico~~ → **927 test al 09/09/2026** (`npm test`, vitest), tutti
    verificati per mutazione: se si rompe di proposito il codice che coprono, falliscono.
    Non sono decorativi, ed è l'unico criterio che conta — vedi §9-sexies.

    **544 sulla logica pura di `src/lib/`**

    | file | test | cosa protegge |
    |---|---|---|
    | `timerSequence` | 32 | espansione dei round, rotazione degli esercizi, `nextTask`, formato legacy (§5), e il fatto che la corsa NON abbia il timer |
    | `statistiche` | 23 | carico settimanale, completamento a 30 giorni, distribuzione RPE, e le distanze contate come stima invece che come minuti |
    | `andamento` | 20 | i numeri dell'eroe della scheda atleta: l'RPE **non** dichiarato che resta fuori dalla media invece di entrarci come 5, la finestra dei 30 giorni che è davvero 30, e lo scarto che torna `null` invece di `Infinity` |
    | `statistiche-home` | 24 | i numeri della Home atleta: serie di giorni, sparkline, blocchi, RPE atteso, RPE medio di categoria |
    | `colori` | 23 | che i token CSS e le costanti JS dei colori di marchio non divergano |
    | `offlineQueue` | 20 | deduplica per allenamento, valori corrotti, quota piena, localStorage negato da Safari |
    | `badge` | 8 | badge nativo e `badge_count` aggiornati **insieme**, e mai in modo che possano lanciare |
    | `statisticheCoach` | 42 | i numeri della Home coach: atleti fermi (compreso «mai, in tutta la finestra»), scaduti, copertura, feedback non letto, squadra della giornata |
    | `pausa` | 12 | il marcatore `[PAUSA]` dentro la nota: vale solo in testa, non si duplica al secondo salvataggio, non si mangia il testo |
    | `stimaWorkout` | 32 | la durata stimata del builder: il Rest che tiene la durata in `meters`, il rest di Cash In contato round − 1 volte, e l'RPE atteso che torna `null` invece di 5. **Sei** tengono in piedi la media di potenza (§9-undecies punto 3): che su un workout uniforme torni *esattamente* quel valore, che un Cash In leggero non spenga la seduta, che trenta secondi a 10 non la rendano massimale, che il peso segua la durata **anche dentro** il blocco, e che un blocco stimato a zero non sparisca. ⚠️ I due test sui limiti hanno **due** asserzioni ciascuno — la cifra e il contratto (sopra la media aritmetica, sotto il massimo dichiarato): la cifra da sola cadrebbe a ogni ritocco dell'esponente senza dire quale delle due proprietà si è persa |
    | `rigaBlocco` | 15 | le didascalie del blocco nella scheda: i ripieghi identici a quelli del builder, il rest di Cash In che su un round solo non si nomina, e le specifiche che saltano i «-» invece di stamparli |
    | `rigaArchivio` | 30 | l'archivio: l'ordine per DATA con `created_at` come spareggio, il mese che non ricompare due volte, la corsa mista che NON dichiara un totale, e i chip che non nascono su una corsia vuota |
    | `rigaAtleta` | 33 | la rubrica: la settimana che comincia di LUNEDÌ anche quando la si chiede di domenica, chi non ha niente in programma che scrive `—` invece di `0/0`, le tacche che oltre la soglia diventano una barra, la pausa che dice da quando e mai un rientro che nei dati non c'è, e la ricerca che trova «rossi marco» |
    | `recapStoria` | 20 | la grafica da condividere: l'elenco che si ferma a `MASSIMO_RIGHE` dicendo quanti esercizi restano fuori, l'intestazione che non chiude mai l'elenco da orfana, il «+N» che conta gli **esercizi** e non le righe, le note del **coach** e mai quelle dell'atleta, e l'RPE che senza dichiarazione non diventa 5. ⚠️ Il test sull'orfana asserisce `MASSIMO_RIGHE % 2 === 0`: con blocchi tutti uguali il taglio cade sempre su un esercizio e la potatura non viene esercitata — verificato, la mutazione non cadeva |
    | `rigaCalendario` | 35 | il mese: la settimana che comincia di LUNEDÌ anche quando il mese apre di domenica, il velo verde che pretende `every` e non `some`, la corsa a DISTANZA che torna `null` invece di 0 minuti — o il volume la conterebbe come un'ora di niente — e il `≈` che compare solo quando la somma ha lasciato fuori qualcosa |
| `reportAtleta` | 40 | il report del singolo: i giri del blocco moltiplicati sui movimenti (dieci burpees in un For Time da cinque round sono cinquanta, e contarli dieci fa sembrare leggera la seduta più dura), «Rest» che non è un movimento ed è l'unico a tenere la durata dentro `meters`, «saltato» contro «da fare» — che nei dati sono la stessa riga — il tetto all'aumento di volume (senza, a chi ha scaricato si propone +245%), e «fermo» che su una settimana passata è la fotografia di allora. ⚠️ Sette mutazioni provate, tutte prese |
| `reportSettimanale` | 40 | i numeri del report coach: la settimana che comincia di LUNEDÌ anche la domenica sera, l'aderenza misurata sulla parte TRASCORSA (senza, il lunedì mattina è tutta la squadra in allarme), il carico che NON conta il 5 di ripiego, il rapporto acuto/cronico che torna `null` sotto quattro sessioni misurate invece di un 1,0 che si legge come «tutto a posto», e «Da iniziare» che non è «Senza programma». ⚠️ Cinque mutazioni provate, tutte prese |
| `previsione` | 39 | il modello predittivo: il carico che è `null` e non 0 senza intensità dichiarata, il rapporto acuto/cronico che NON si calcola sotto lo storico minimo — nemmeno proiettando un carico enorme — il bias saturato a `BIAS_MASSIMO`, e l'ordine degli avvisi, dove la **pausa precede il carico**. ⚠️ Tre test valgono più degli altri e sono nati sbagliati: quello sulle corsie chiedeva un intruso **con blocchi** (una corsa non ne ha, quindi la mutazione era invisibile), quello sul giorno adiacente un allenamento **morbido** accanto a uno duro, e quello sul cancello dello storico quattro sedute in **una sola** settimana — l'unico caso in cui `rapportoCarico` da solo non basta |
| `codiceInvito` | 8 | il codice invito: che `normalizzaCodice` riconosca il **LINK** del coach e non ne legga l'indirizzo — senza, chi incolla `https://…/?invite=7KQ2M4XB` ottiene `HTTPSFLE`, otto caratteri come quelli giusti e un errore che non spiega niente — e che a codice pieno nessuna casella resti «attiva», o la nona (che non esiste) si prenderebbe il cursore mentre la verifica sta già partendo |
| `rigaImpostazioni` | 12 | le tre righe di Impostazioni che sono diventate numeri: i codici che tornano `null` finché non sono arrivati invece di «0 attivi», il conteggio mancante che SPARISCE invece di diventare zero — «0 atleti» accanto a «Esporta database» si legge come «non c'è niente da salvare» — e la pillola che in anteprima non dice «Atleta», che sarebbe vero e fuorviante |
| `appleLogin` | 8 | Sign in with Apple: che il nonce dato al plugin sia lo **SHA-256** di quello dato a Supabase e non lo stesso valore — uno scambio lì non rompe nient'altro e in produzione dà un 400 che sembra un problema di configurazione su Apple — che senza `crypto.subtle` si torni `null` invece di lanciare (o su quella WebView non entra più nessuno), che il nome vuoto degli accessi successivi NON si scriva sopra quello salvato la prima volta, e che l'annullamento del foglio di sistema (1001) non passi per un guasto mentre 1004 sì |
| `statistiche-vuoti` | 16 | gli stati senza storico: `senzaStorico` che è **falso** con un assegnato fuori dalla settimana — il caso che manderebbe il benvenuto del giorno 1 a chi ha già un programma — la settimana di CALENDARIO che esclude la domenica precedente (una finestra mobile la conterebbe dentro, e lo scarto non corrisponderebbe più al totale accanto), i `pending` che non sono volume, e lo scarto che torna `null` invece di `+214` con la settimana precedente vuota — anche quando quella settimana ha solo allenamenti **saltati** |
| `blockColors` · `rpe` · `workoutTitle` | 6+6+6 | codifica colore, round-trip dell'RPE, titolo generato dalla data |

    **383 su componenti, pagine e hook**

    | file | test | cosa protegge |
    |---|---|---|
    | `HyroxBlock` | 22 | il **contratto padre-figlio**, riepiloghi dei blocchi, didascalie (rilievo 3.2.1viii) |
    | `RunningStepRow` | 16 | idem per le fasi di corsa |
    | `HomeOffline` | 14 | il percorso offline completo su `Home` montata: completare, scompletare, coda, cache che si ripara, modale RPE che non si blocca |
    | `CreateWorkoutMemo` | 5 | la memoizzazione **dal lato del chiamante** (§9-quinquies) |
    | `RunningStepRowMemo` · `HyroxBlockMemo` | 4+2 | che `React.memo` serva ancora a qualcosa |
    | `HomeCoach` | 28 | il cablaggio del ramo coach su `Home` montata: l'eroe porta le citazioni e il numero dell'arretrato (non delle righe stampate), aprire un feedback segna letto **solo quello**, la squadra cambia giorno, l'account del coach resta fuori, e le card «Calendario»/«Atleti» restano fuori dalla pagina. ⚠️ Gli ultimi quattro montano con `role: 'admin'`, non `'coach'`: è il ruolo che esiste davvero, ed è l'unico a cui la Home mostrava anche il ramo atleta (§9-nonies, 28/08) |
    | `CreaWorkoutBuilder` | 20 | il builder ridisegnato su `CreateWorkout` montata: il riepilogo che segue i blocchi, il ritorno al passo 1 (unico posto dove nome e data si modificano), gli Stepper che scrivono il vocabolario di prima, «ultima volta», la ricerca esercizi che NON ruba il fuoco, lo scorrimento al blocco nuovo, e la ruota del passo (generi separati, valore intero, `—` in ogni genere) |
    | `CreaWorkoutIA` | 10 | il foglio «Genera con IA»: l'entrata che **esiste** (`sheet-in`, non `animate-in`, che genera zero CSS), il campo che NON prende il fuoco, la maniglia che è un bottone, la forma d'onda alimentata da `getUserMedia` — che senza microfono **non si finge** ma non lascia lo schermo muto — l'attesa che occupa il foglio con la CTA che sparisce, e il foglio che durante la generazione **non si chiude**. E **tre** test sull'avviso «non arriva nessun suono», che sono tre perché il difetto stava nel confine: microfono morto → l'avviso c'è; voce normale → non c'è; **voce piana** → non c'è lo stesso, ed è quello che prende la soglia unica (§9-quindecies). ⚠️ Il finto analizzatore suona su **quattro bande su ventiquattro**, come una voce vera: uno che riempie lo spettro ha la media alta e passa anche con la logica sbagliata |
| `ArchivioWorkout` | 21 | l'archivio ridisegnato su `WorkoutsArchive` montata: i gruppi per mese che restano nell'ordine giusto anche se la query torna per creazione, i chip derivati dai dati (mai «Libero», che la query del coach non fa arrivare), la ricerca che trova un ESERCIZIO e non solo il titolo, il titolo `null` che non porta via la pagina, e il contatore degli assegnati che all'atleta non si mostra — perché la sua query non lo carica nemmeno |
| `AtletiLista` | 21 | la rubrica ridisegnata su `Athletes` montata: la frazione che viene dalla settimana e non dai workout in pagina, l'atleta in pausa che RESTA nella lista (è l'unico posto in cui il coach si accorge di averne dimenticato uno), il marcatore `[PAUSA]` che non si vede mai come testo, il cestino che non è più un accordion, e una sola `select` su `athlete_workouts` per venti atleti. ⚠️ Il test che conta di più è quello sull'allarme della riga, e ci sono voluti due tentativi: «zero questa settimana» e «fermo da cinque giorni» quasi sempre coincidono, e un atleta qualsiasi passa con entrambe le logiche — serve chi ha chiuso **sabato**, cioè quattro giorni fa ma nella settimana scorsa |
| `CalendarioMese` | 21 | il calendario ridisegnato su `Calendar` montata: la coppia della fascia che misura lo STESSO insieme (le ore dei completati, non di tutto il programmato), il «Completati» che al coach non si mostra — la sua query non ha nessuno stato da leggere — l'RPE che c'è solo se dichiarato davvero, la cella che nell'`aria-label` dice il numero VERO oltre il tetto dei segmenti, e «Oggi» che compare solo fuori dal mese corrente. ⚠️ La fascia e la legenda sono due `role="group"` nominati apposta: dicono le stesse parole delle righe («Gara», «Running», «Fatto») e i loro numeri coincidono con i giorni della griglia, quindi un `getByText('2')` non scoped prende il 2 agosto e il test verifica un'altra cosa |
| `useIndietro` | 3 | il tasto indietro: che senza una pagina dietro vada al ripiego invece di non fare niente (è il caso della notifica push, l'unico in cui quel tasto è indispensabile), che **con** una pagina dietro torni a QUELLA e non al ripiego, e che il ripiego non lasci nella pila la pagina da cui si è usciti — o un secondo «indietro» ci riporta dentro. ⚠️ Sono tre e non uno perché le due forme sbagliate (destinazione fissa, `navigate(-1)` nudo) falliscono ognuna nel caso che l'altra copre |
| `LoginInvito` | 14 | l'accesso rifatto su `Login` montata: il bivio «Accedi / Nuovo Utente» che NON c'è più, la verifica che parte da sola all'ottavo carattere (senza bottone da cercare), il link del coach che salta le caselle, il codice rifiutato che non apre il profilo e non finisce in localStorage, e — quello che conta di più — la **rete caduta che non accusa il codice**: sono due rimedi opposti, ed è la ragione per cui la query usa `maybeSingle()`. ⚠️ Sette mutazioni provate, sette prese; quella sulla verifica automatica ne fa cadere sei |
| `LoginApple` | 8 | Sign in with Apple su `Login` montata: l'hash al plugin e il chiaro a Supabase (**il test di tutta l'integrazione**), il token che arriva come identità `apple`, il nome della prima autorizzazione salvato subito, l'annullamento che non mostra un allarme rosso a chi ha appena scelto di non entrare, il bottone **sopra** quello Google — la 4.8 chiede che non sia «meno in vista» — e il bottone che sul web non esiste. ⚠️ Il ramo nativo lo tocca solo questo file e `useTastiera`: `src/test/setup.js` finge sempre «web», quindi va acceso a mano con `window.Capacitor` |
| `useTastiera` | 3 | il ramo **nativo**, che il resto della suite non tocca: la barra che sparisce quando la tastiera sale, e l'invio che toglie il fuoco |
    | `useBottomSheet` | 12 | il foglio del menu scheda: che l'entrata sia un'animazione **che esiste**, che il keyframe lasci il comando al dito, la maniglia trascinata oltre soglia (e sotto soglia, che NON deve chiudere), lo scorrimento della pagina bloccato con `position: fixed` e **ripristinato dov'era** |
    | `AthleteDetailPausa` | 7 | il bottone di pausa: conferma solo per spegnere l'allarme, marcatore mai visibile come testo, pillola invisibile all'atleta, e la modale di modifica che non cancella la pausa — **da nessuno dei due ruoli** |
    | `VoiceRecorder` · `VoiceRecorderNativo` | 3+4 | che la registrazione non sparisca in silenzio quando il plugin nativo fallisce (§9-quater punto 2) |
    | `WorkoutDetailTimer` | 3 | che il bottone del timer non compaia sugli allenamenti di corsa |
    | `SchedaAtleta` | 16 | la scheda atleta ridisegnata su `AthleteDetail` montata: il denominatore dell'anello (gli assegnati dei 30 giorni, non i workout in pagina), le tre tab che non ci sono più, lo storico che nasce chiuso dicendo quanti ne contiene, il menu che tiene Esporta/Modifica/Pausa fuori dalla pagina, la barra fissa che NON esiste sul proprio profilo, e «Prossimi allenamenti» che il redesign non toglie. ⚠️ Il coach si monta sulla rotta `/athletes/:id`: senza il parametro la pagina si crede sul proprio profilo e il test verifica un'altra pagina |
    | `NavigazioneApp` | 6 | il primo test che monta **`App.jsx` vera**: la sessione risolta UNA volta per tutta l'app, la pagina precedente che resta **visibile** mentre arriva il chunk della nuova, la riga di `athletes` letta **una volta sola** in tutto l'avvio (era tre, due delle quali in fila), e dal 01/09 che ogni pagina nuova si apra **dall'inizio** — ma non tornando indietro, dove la posizione va conservata. ⚠️ I primi due sono nati verdi con il codice di prima, ed è così che è saltata fuori la diagnosi sbagliata (§9-noviesdecies) |
| `HomeCache` | 3 | che la Home si dipinga dalla **cache** prima della rete, che la cache di un **altro** atleta non si veda mai, e che senza cache si parta dallo scheletro come prima. ⚠️ Il primo non aspetta niente di proposito: la cache si legge prima del primo `await`, e sulla mutazione il titolo non compare *affatto* |
| `WorkoutDetailChunk` | 1 | che aprire la scheda non carichi `jspdf` e `html-to-image`: rimetterli in testa non dà nessun errore e non fa cadere nessun altro test, cambia solo ~700 KB davanti a ogni apertura |
| `ReportAtleta` | 16 | il report del singolo su `AthleteReport` montata: 🔒 l'atleta rimandato alla Home che non legge niente, la `select` filtrata su QUEL solo atleta (senza, i numeri di dodici persone sotto il nome di una), le indicazioni che portano il numero da cui escono, il carico dell'ULTIMA volta e non il massimo storico — ⚠️ il primo tentativo di quel test usava 9 e 6 in quest'ordine e passava anche mostrando il massimo, serve l'ultimo più basso del massimo — e la lettura fallita, che qui non mostra solo il vuoto: proporrebbe di telefonare a chi si allena regolarmente |
| `ReportSettimanale` | 14 | il report su `WeeklyReport` montata: 🔒 l'atleta rimandato alla Home che **non legge nemmeno** le assegnazioni della squadra (la guardia sta in due punti, e verificarne uno solo lascia passare una versione che scarica tutto e poi nasconde), il lunedì che non accusa nessuno di aderenza bassa, il `≈` del carico parziale, l'RPE medio che scrive `—` e non «5,0», la fascia che filtra la lista, e la lettura fallita che NON si legge come una settimana vuota |
| `WorkoutDetailStoria` | 14 | la grafica da mettere sopra una storia: gli **esercizi** che ci sono davvero (è la sostanza, e una regressione lascerebbe una grafica impaginata benissimo che non dice più niente), l'RPE dichiarato, il `≈` sulla durata, il nodo rasterizzato che è la copia a misura vera e non l'anteprima riscalata, l'altezza **misurata sul nodo** invece di un 9:16 dato per scontato, la carta che resta semitrasparente e con gli angoli tondi, e — l'unico che conta più di tutti — **nessun `backgroundColor` passato a html-to-image**, che è ciò che tiene il PNG trasparente |
| `PrevisioneBuilder` · `PrevisioneAssegnazione` | 4+6 | il modello nelle due pagine vere: la quarta cella che è il **prodotto** delle due accanto, la cella che sparisce (e non mostra zero) senza intensità dichiarata, il semaforo che porta la percentuale, l'atleta senza niente da segnalare che **non** riceve un «tutto ok», la pausa che resta in lista, l'avviso che NON blocca «Conferma», e la lettura fallita che spegne i semafori lasciando l'assegnazione intatta. ⚠️ L'ultimo è quello che conta di più: un di più non deve poter togliere il gesto che c'era. ⚠️ E la pausa si verifica **sulle colonne chieste** (`notes` nella `select`), perché il finto Supabase non filtra le colonne e l'asserzione a schermo passerebbe anche togliendola |
| `Impostazioni` | 23 | la pagina ridisegnata su `Settings` montata: l'interruttore con `aria-checked` al posto del bottone che diceva dove sarebbe andato, il banner giallo «Operazione in corso» che non esiste più — ⚠️ con l'attesa tenuta aperta a mano, o il test passa anche rimettendolo — le 90 parole sul Garmin che ci sono TUTTE ma sotto una riga che si apre, i codici invito che l'atleta **non legge nemmeno**, e i test mattina/sera chiusi in fondo invece che fra le impostazioni. Dal 09/09 anche **«Elimina il mio account»**: che ci sia (e sopra «Esci»), che si mostri **anche al coach** — nasconderla a chi è in `ADMIN_EMAILS` vorrebbe dire nasconderla a `demo@fleofit.it`, cioè al revisore — che chieda conferma prima di toccare qualunque cosa, che marchi il **proprio** id e non quello di un altro, e che il messaggio **non** prometta che riaccedendo si annulla, perché è falso |
| `HomeVuoti` | 19 | i tre stati senza storico su `Home` montata: il giorno 1 che **chiude la pagina** (niente anello 0/0, niente serie, niente volume, niente «In arrivo» sotto di esso — ed è la mutazione che conta, perché una card di benvenuto messa *sopra* l'albero esistente lascia il difetto intero con un cappello); «Primo dato» che porta i minuti di QUELL'allenamento e non `weeklyStats.time`; la prima settimana contata sui **completati** e non sulle righe (cinque assegnati e nessuno fatto sono ancora la prima settimana); «Domani» che diventa «In arrivo» quando il prossimo non è domani; e lo scarto che sparisce senza una settimana con cui confrontarsi. ⚠️ Il test sul «primo dato» usa **due** completati: con uno solo `[0]` e `.at(-1)` sono lo stesso oggetto, e l'ordine di `storicoAtleta` non sarebbe coperto da niente |
| `WorkoutDetailScheda` | 20 | la scheda ridisegnata su `WorkoutDetail` montata: la terza cella del riepilogo, che su un allenamento chiuso è l'RPE **dichiarato** e non quello atteso — e scrive `—`, non 5; la didascalia di BLOCK_HINT (rilievo 3.2.1viii); i blocchi aperti senza toccare niente; il menu che tiene i comandi fuori dalla pagina; la barra che non fa due gialli; l'elenco delle assegnazioni; la grafica IG che resta **renderizzata** fuori schermo, e il testo INTERO dell'avviso sul riscaldamento |

    ⚠️ **I due contratti sono asimmetrici e devono restarlo**: `HyroxBlock` passa `block.id`,
    `RunningStepRow` passa l'**indice**. "Uniformarli" romperebbe il riordino delle fasi di
    corsa (§9-quinquies).

    **Cosa resta scoperto**: l'**interfaccia** di `WorkoutDetail` e `AthleteDetail` — PDF,
    story IG, note vocali, Live Coach Cam, cast su TV, gestione PR. La loro *logica* è
    coperta, perché estratta in `src/lib/`.
    Nessun TypeScript effettivo nel `src/` (tutto `.jsx`) anche se il build esegue `tsc -b`.
12. 🔴 **ESLint non ha mai analizzato il codice dell'applicazione** (scoperto il 25/08/2026).
    `eslint.config.js` aveva `files: ['**/*.{ts,tsx}']`, ma `src/` è tutto `.jsx`: i "15 problemi"
    che `npm run lint` riportava erano **solo** nelle due Edge Function, gli unici `.ts` del
    progetto. Circa 13.000 righe di applicazione non erano mai state controllate
    (12.527 al 26/08, dopo le estrazioni in `src/lib/`).
    Estendendo il pattern a `.js/.jsx` sono emersi **quattro `no-undef`**, cioè quattro
    `ReferenceError` latenti già in produzione, ognuno dei quali rompeva una funzione in silenzio
    (vedi il commit del 25/08). Sono stati corretti.
    ⚠️ Vanno tenute le esclusioni: `ios/App/App/public` è la copia del bundle **minificato** che
    `npx cap sync ios` deposita nel progetto Xcode, e analizzarla produceva 4.600 falsi problemi
    che nascondevano quelli veri.
    ⚠️ Va tenuta anche l'esclusione di `.agents`, aggiunta il 25/08: le skill vendorizzate
    portavano 5 problemi che non sono codice del progetto.
    ✅ **Scesi da 164 a 47 il 25/08/2026.** Tutti i 34 `no-empty` sono chiusi, e con loro sono
    spariti 34 binding `catch (e)` mai letti. Non era solo pulizia: ~19 erano davvero
    deliberati (aptica, wake lock, beep, `stopRecording` durante un annullamento) e ora lo
    **dicono** in un commento, ma tre nascondevano guasti reali, elencati al §9-quater.
    I 47 rimasti sono 28 `react-hooks` (un refactor, non una pulizia), 15 `no-explicit-any`
    nelle due Edge Function e 4 `react-refresh/only-export-components`.

---

## 9-quater. I tre guasti che i catch vuoti nascondevano (corretti il 25/08/2026)

Erano tutti `catch {}` senza corpo, quindi invisibili sia all'utente sia nei log.

1. **Cache e coda offline corrotte non si riparavano più.** `Home.jsx` faceva
   `try { JSON.parse(cached) } catch {}` sulla cache dei workout e
   `catch (e) { return }` su `fleofit_offline_queue`. Un valore illeggibile in
   localStorage restava lì per sempre: la modalità offline non ripartiva e le azioni
   accodate **non venivano più sincronizzate**, a ogni tentativo, senza un solo indizio.
   Ora il valore corrotto viene rimosso e l'evento loggato.
2. **La nota vocale poteva sparire senza dirlo.** In `stopRecordingAndSave`, se
   `NativeVoiceRecorder.stopRecording()` falliva, non veniva chiamato né `onSave` né
   `onCancel`: la registrazione era persa e la modale restava ad aspettare un callback
   che non sarebbe mai arrivato. Stessa cosa all'avvio su web (`new MediaRecorder`):
   l'utente premeva registra e non succedeva niente, senza messaggio. Corretto nelle tre
   copie (Home, WorkoutDetail, AthleteDetail — §9 punto 1: sono ancora duplicate).
3. **`FCM.getToken()` poteva fallire in silenzio** (`Settings.jsx`). Il codice ripiega sul
   token APNs grezzo, che però viene salvato con `auth: 'capacitor_ios'` e quindi trattato da
   `send-reminders` come se fosse FCM: **la push non arriva mai**. È lo stesso sintomo
   descritto nella sezione sulle push in Debug, ma con una causa diversa. Ora si vede nei log.

Loggate anche, senza cambiare comportamento, le scritture di `badge_count` su
`push_subscriptions` (5 punti fra Home e WorkoutDetail): se falliscono, il contatore che
`send-reminders` rilegge per incrementare il badge resta disallineato per sempre.

### 5. La coda offline si bloccava su una voce malformata (corretto il 26/08/2026)
Trovato scrivendo i test su `processOfflineQueue`, l'ultimo pezzo scoperto del percorso.
`leggiCoda` garantisce che la coda sia un **array**, non che le voci dentro siano sane:
bastava un `null` — JSON perfettamente valido — perché `action.type` lanciasse. Il ciclo
moriva lì, e con lui tre cose: la coda non si svuotava più, **il workout valido che seguiva
non arrivava mai al server**, e `setSyncingQueue(false)` non veniva eseguito, quindi il banner
«Sincronizzazione in corso…» restava a girare per sempre.

La correzione distingue due casi che prima erano uno solo: una voce **irrecuperabile** si
scarta (riprovarla fallirebbe uguale), una voce **valida rifiutata dal server** si tiene per
riprovare. Lo spegnimento del banner e la riscrittura della coda stanno in un `finally`.

### 4. La modale RPE poteva restare bloccata a girare (corretto il 25/08/2026)
Trovato cercando gli altri chiamanti della coda. `handleRpeSubmitHome` e
`annullaCompletamento` facevano `JSON.parse(localStorage.getItem(...) || '[]')` **nudo**,
senza try/catch e senza `finally`. Con la cache corrotta l'eccezione partiva **dopo**
`setSavingRpe(true)` e **prima** di `setSavingRpe(false)`: la modale restava a girare per
sempre e il completamento con RPE appena inserito spariva. Sul ramo offline, cioè proprio
quando l'atleta non ha modo di capire cos'è successo.

**La regola che ne è uscita**, ora implementata in `src/lib/offlineQueue.js` e coperta da
20 test: *una lettura di localStorage che fallisce si ripara da sola*. `leggiJson` non
lancia mai, rimuove il valore illeggibile e torna un fallback; `scriviJson` torna `false`
invece di lanciare su quota piena. Meglio ripartire da zero che restare bloccati per sempre
su un valore rotto.

---

## 9-septies. Le segnalazioni `react-hooks`: cosa vale e cosa no (26/08/2026)

Erano 26 e il backlog le chiamava «un refactor vero». **Esaminandole una a una, 3 erano
difetti e 23 sono il pattern voluto.** Questa sezione esiste perché non vengano riaperte
come se fossero 26 cose da fare.

### Le tre corrette
| dove | cos'era |
|---|---|
| `Calendar.jsx` | `dayWorkouts` era uno **stato** riscritto da un effetto a ogni cambio di giorno: un render in più e uno stato che poteva restare indietro. Ora è un `useMemo`. |
| `AthleteDetail.jsx` | `weeklyStats` idem — e dentro l'effetto c'era una **terza copia** del calcolo della durata, con il difetto delle distanze (§BACKLOG #30). Ora usa `src/lib/statistiche.js`. |
| `Athletes.jsx` | `Date.now()` chiamato **durante il render** per il conto alla rovescia del cestino: due render consecutivi davano numeri diversi. Ora l'istante si fissa quando i dati arrivano — che è anche più corretto nel merito. |

### Perché le altre restano
- **`immutability` (9)** — il messaggio dice «Cannot access variable before it is declared»,
  ma vuol dire solo che un effetto chiama una funzione dichiarata più sotto. In JS funziona;
  è il linter che non può verificarlo.
- **`exhaustive-deps` (9)** — quasi tutte sono `useEffect(() => { fetchX() }, [])`, cioè
  «carica una volta al montaggio», che **è l'intenzione**. Provato su `WorkoutsArchive`:
  aggiungere la dipendenza richiede un `useCallback`, e il `setLoading(true)` dentro il fetch
  fa **comparire un `set-state-in-effect`** al suo posto. Si scambia un avviso con un altro,
  con in più il rischio di un ciclo infinito se una dipendenza è instabile.
- **`set-state-in-effect` (5)** — sono casi difendibili: stato inizializzato da una prop e poi
  modificabile dall'utente (le note, in due copie), lettura dell'hash dell'URL al montaggio
  (`Login`), reset di un'animazione, memoria dell'ultimo stato non nullo ricevuto dalla TV.

> **La regola che ne esce**: queste segnalazioni si leggono, non si azzerano. Un conteggio che
> scende non è di per sé un miglioramento, e in due casi su tre qui il conteggio sarebbe sceso
> spostando il problema.

---

## 9-sexies. Come si testa una pagina (26/08/2026)

Per un anno "le pagine non si possono testare" è stata una convinzione, non un fatto.
Quando finalmente ci si è provati, gli ostacoli erano **due righe di infrastruttura**:

1. **jsdom espone un `localStorage` rotto** in questa versione di Node
   (`getItem is not a function`, è l'origine del warning `--localstorage-file`). Ogni
   pagina lo legge in un effetto, quindi nessuna si montava. Rimpiazzato con uno in
   memoria in `src/test/setup.js`.
2. **`registerPlugin` mancava** nel finto `@capacitor/core`: ogni plugin lo invoca al
   caricamento del modulo, quindi bastava importarne uno per far fallire tutto.

Gli strumenti che ne sono usciti, riutilizzabili per le pagine che mancano:
- `src/test/fintoSupabase.js` — riproduce la catena fluente con un **Proxy**: qualunque
  metodo torna la catena, e la catena è *thenable*, così `await` funziona ovunque la si
  chiuda (`.limit()`, `.single()`, `await` diretto). Non serve conoscere l'API.
  `risposte` e `erroreSu` accettano **funzioni**, valutate a ogni query: è l'unico modo
  di far fallire il fetch a metà test.
- `src/test/montaPagina.jsx` — router e **AuthContext veri**, non finti.

> 🔴 **La lezione più importante, e vale per qualunque test futuro.**
> I primi test su `Home` **passavano tutti, e non coprivano niente**: verificato per
> mutazione, due dei più importanti non si accorgevano del bug che dicevano di
> proteggere. Il motivo era nella preparazione dello scenario — se il fetch RIESCE,
> `scriviJson` sovrascrive subito la cache corrotta con dati validi, quindi al momento
> del clic il valore illeggibile non esiste più. Il test esercitava un percorso pulito
> credendo di esercitarne uno rotto.
> **Un test verde non dice niente finché non lo si è visto fallire.**

---

## 9-quinquies. Memoizzazione di HyroxBlock (26/08/2026) — come non disfarla

`HyroxBlock` è avvolto in `React.memo`. Il guadagno misurato: digitare 8 caratteri nel titolo
faceva **8 render sprecati per ogni blocco**, e ogni blocco aperto contiene scroll picker da
102 opzioni. Ora sono zero.

`memo` confronta le props **per riferimento**, quindi il beneficio sparisce in silenzio se il
padre torna a passare qualcosa di instabile. Le regole che lo tengono in piedi:

1. **I gestori del call site devono restare riferimenti stabili** (`bloccoToggle`,
   `bloccoUpdate`, `bloccoRemove`, `bloccoMoveUp`, `bloccoMoveDown`, `bloccoDuplicate`,
   `bloccoDuplicaEsercizio`, `bloccoDragStart`, `bloccoDragEnter`, `bloccoDragEnd`).
   Nessuna arrow inline dentro `<HyroxBlock .../>`.
2. **Nessun `useCallback` deve dipendere da `blocks`.** Con `[blocks]` l'identità cambia
   appena si modifica un blocco, e si ridisegnano tutti. Si lavora per `block.id` dentro un
   aggiornamento funzionale `setBlocks(prev => ...)`.
3. **`draggedBlockIdx` è un `useRef`, non uno stato.** Non è mai letto durante il render, e
   come stato entrerebbe nelle dipendenze dei gestori del drag.
4. ⚠️ **Il decimo gestore che nessuno conta**: `onReorder` passato a `useTouchDrag`.
   `getTouchHandlers` è memoizzato su di lui, quindi un'arrow inline lì rende instabile la
   prop `touchHandlers` e annulla tutto. Sta in `riordinaBlocchi`.

⚠️ **Il contratto è cambiato**: `onToggle`, `onRemove`, `onMoveUp`, `onMoveDown` e
`onDuplicate` ricevono `block.id`; `onDuplicateExerciseRequest` riceve `(block.id, esercizio)`.
Fa eccezione `onUpdate`, che riceve il blocco intero perché l'id è già dentro.
**Resta asimmetrico rispetto a `RunningStepRow`, che passa l'INDICE**: uniformarli romperebbe
il riordino delle fasi di corsa (§9 punto 11).

I test che se ne accorgono sono **due file diversi, e servono entrambi**:
- `HyroxBlockMemo.test.jsx` — prende la rimozione di `memo` dal figlio.
- `CreateWorkoutMemo.test.jsx` — monta `CreateWorkout` **vero** e prende le regressioni del
  *chiamante*. Verificato il 26/08: con un padre finto quelle mutazioni **non venivano rilevate**.

### `RunningStepRow` — stesso trattamento, contratto invariato
Memoizzato lo stesso giorno. Guadagno misurato: 7 caratteri nel titolo = 7 render sprecati per
fase, ora 0. Valgono le stesse quattro regole, con `riordinaFasi` al posto di `riordinaBlocchi`
e `draggedStepIdx` come ref.

⚠️ **Qui il contratto NON è cambiato**, e la differenza è istruttiva: `RunningStepRow` passava
già l'indice a `onMoveUp`/`onMoveDown` e `step.id` a `onRemove`, cioè tutto ciò che serve al
padre. Bastava non richiudere i gestori su `runningSteps`. I 16 test sul contratto sono
rimasti verdi senza una riga di modifica — la prova che **l'asimmetria fra i due componenti è
voluta e va mantenuta**.

Il contatore dei render è `RunningStepRowMemo.test.jsx`, che conta l'icona `Copy`: nel flusso
Running è renderizzata solo da `RunningStepRow`. Ogni componente ha bisogno di un contatore
interno diverso — un componente-spia esterno non funziona (non è memoizzato, quindi conta
anche i render che il figlio ha saltato).

> ℹ️ Una mutazione non viene rilevata di proposito: togliere il controllo di bordo da
> `faseMoveUp`. Non è un buco nei test — **`moveElement` ignora già gli indici fuori
> intervallo**, quindi quel controllo era ridondante ed è stato rimosso.

---

## 9-octies. Il rework della Home atleta (26/08/2026)

Nasce da un design di **Claude Design** (progetto `4a238081-a3ee-4f59-ae34-100f29d55601`,
artboard `Home Atleta.dc.html`, opzione **1b**). La logica di `Home.jsx` — fetch, swipe di
completamento, modale RPE, coda offline, notifiche realtime — **non è stata toccata**: è
cambiato il JSX del ramo atleta e il modo in cui i dati vengono presentati.

### Cosa cambia, e perché
- **Un solo eroe.** L'allenamento di oggi occupa il primo schermo da solo: titolo a 29px, tre
  metadati, CTA piena. Prima arrivava dopo due schermate, con lo stesso peso visivo della card
  «Calendario» — ed è l'unica informazione per cui l'atleta apre l'app.
- **Lo slider a due slide è sparito.** Nascondeva le statistiche settimanali dietro un gesto
  che niente segnalava. Ora sono celle del bento: anello 3/5 + serie di giorni + volume/RPE.
- **Profondità vera.** Ombra proiettata neutra + hairline interna chiara. Vedi *La Regola
  della Carta Sollevata* in DESIGN.md: limita, senza contraddirla, la regola «piatto + glow».
- **Tre destinazioni tolte dalla Home dell'atleta** (Calendario, Profilo, Archivio): le prime
  due sono voci della navbar, la terza si apre dal Calendario. **Per il coach restano**: sono
  la sua unica via verso Atleti e archivio.
- **Il badge delle notifiche è un pallino, non un numero.** Il conteggio esatto lo dà il
  centro notifiche — ma vive anche nell'`aria-label` del bottone, altrimenti sparirebbe per
  chi usa VoiceOver. Il test lo verifica lì.
- **La frase motivazionale è rimasta**, come terza riga piccola dell'header: il design non la
  prevedeva, ma `getDailyMotivation` con anti-ripetizione è una funzione vera e cancellarla
  non era nello scopo del rework. Se si vuole toglierla, è una decisione di prodotto.

### ⚠️ Le tre trappole di questo codice
1. **`HeroOggi` non può avere animazioni CSS sul nodo radice.** È l'elemento su cui lo swipe
   scrive `style.transform` a ogni movimento del dito, e un'animazione con `fill: both`
   **vince sullo stile inline**: la card resterebbe ferma sotto il dito. L'entrata
   `hero-transition` sta sul contenitore, che non viene mai trasformato.
2. **La struttura del wrapper dello swipe è un contratto.** `swipeInizio` cerca il pannello
   verde con `el.parentElement.querySelector('[data-swipe-panel]')`: il pannello e la card
   devono restare fratelli dentro lo stesso `relative overflow-hidden`.
3. **`CARD`, `LABEL` e `corsia` NON sono esportate** da `HomeAtletaUI.jsx`, di proposito:
   esportare qualcosa che non è un componente fa perdere il Fast Refresh all'intero file
   (`react-refresh/only-export-components`).

### La query dell'atleta è stata allargata a 60 giorni
Partiva dal lunedì di questa settimana (`gte weekStartStr`, `limit 30`). Serie di giorni,
sparkline e RPE medio guardano **indietro**: con la vecchia finestra la serie avrebbe letto
zero ogni lunedì mattina. Ora `GIORNI_STORICO = 60` e `limit(400)`. I filtri esistenti
(oggi, prossimi, evento, settimana) sono tutti per data, quindi non cambiano.

### 🔴 Due difetti trovati SCRIVENDO i test, non leggendo il codice
Gli helper di `src/lib/statistiche.js` esistevano già ma non erano coperti. Entrambi
producevano un numero plausibile e sbagliato, cioè il caso peggiore.

1. **La serie non si spezzava mai.** La regola «un giorno di rest programmato non spezza la
   serie» era senza tetto: un atleta che si è allenato **una volta quaranta giorni fa** e mai
   più leggeva «Serie: 1 giorno», perché i trentanove giorni vuoti erano tutti rest
   programmato. Ora si attraversano al massimo `MASSIMO_REST_CONSECUTIVI = 3` giorni di fila.
2. **`mediaRpeCategoria` contava un 5 inventato.** `parseNotesAndRpe` torna `{ rpe: 5 }`
   quando il marcatore `[RPE: n/10]` non c'è — è il valore giusto per il cursore della
   modale, ma è un ripiego travestito da misura. Il guardiano `Number.isFinite(rpe)` non
   proteggeva da niente: 5 è finito. Chi non compila mai l'RPE vedeva «5» presentato come la
   propria media storica. Ora esiste **`rpeDichiarato()`** in `src/lib/rpe.js`, che torna
   `null` quando il dato non c'è.
   ⚠️ **`calcolaStatistiche` ha ancora lo stesso guardiano inerte** (`load` e
   `distribuzioneRpe`): non è stato toccato perché cambierebbe i numeri che il coach vede
   oggi, ed è una decisione di prodotto, non una correzione. Vedi BACKLOG.

## 9-nonies. Il rework della Home coach (27/08/2026)

Nasce dallo stesso progetto Claude Design della Home atleta
(`4a238081-a3ee-4f59-ae34-100f29d55601`), artboard `Home Coach.dc.html`, opzione **2b**.
Come per l'atleta, la logica di `Home.jsx` non è stata riscritta: sono cambiati il JSX del
ramo coach, la query che lo alimenta, e i numeri che quel ramo mostra.

### Il problema, in una riga
La Home coach non conteneva **un solo dato**: era un menù. Logo, CTA «Crea Workout», lista
delle attività di oggi e ieri, due card verso destinazioni che sono **già nella navbar**,
bottone archivio. L'unica informazione presente — chi ha fatto cosa ieri — è la meno utile
la mattina, perché guarda indietro. Quello che il coach non vedeva è **chi sta per sparire**.

### ⚠️ L'eroe è cambiato in corsa, ed è la cosa da sapere prima di tutto
La prima stesura del 27/08 metteva in cima **«richiedono attenzione»**. La revisione dello
stesso giorno dell'artboard `2b` lo ha sostituito con i **feedback**, e la ragione non è
estetica: chi è fermo da nove giorni **lo è ancora fra un'ora**, mentre una nota non letta è
l'unica cosa in pagina che ha già **un mittente in attesa**. Chi è fermo non è sparito — è
sceso sotto la CTA, con lo stesso dato di prima. Se questo documento e il codice dovessero mai
contraddirsi su quale sia l'eroe, la fonte è `src/pages/Home.jsx`, ramo `role !== 'athlete'`.

### Cosa c'è ora, nell'ordine in cui sta in pagina
1. **L'eroe: «feedback nuovi»** — le note (con RPE) e le note vocali che il coach non ha
   ancora aperto. Ogni riga porta **la citazione**, non solo il nome: un contatore senza il
   testo obbliga ad aprire quattro schermate per sapere se una delle quattro era urgente.
   Tre citazioni in pagina (`FEEDBACK_IN_HOME`), il resto dietro un «+N altri».
   ⚠️ Il numero grande è `elementi.length` (le cose da leggere), **non** `totale`
   (che somma vocali e note, e per una riga con entrambe vale due).
2. **La squadra della giornata** — «5/7 completati», la barra a segmenti, i volti con
   l'anello colorato e l'RPE sotto. Sostituisce la lista «Attività oggi e ieri», che
   elencava gli eventi uno per uno senza mai far vedere l'insieme. Il giorno si cambia in
   fondo alla card: ieri è consultazione, la domanda della mattina è su oggi.
3. **La CTA «Crea workout»**, unica superficie gialla piena della pagina.
4. **Archivio** (e **Profilo** solo per `admin`), in forma di riga.
5. **«Richiedono attenzione»** — nessun allenamento *completato* da 5 giorni o più. Una
   condizione sola, di proposito: è l'unica a cui la risposta è sempre la stessa, una
   telefonata. Massimo quattro nomi (`MASSIMO_FERMI_IN_HOME`): oltre, smette di essere una
   chiamata all'azione e diventa una lista, e una lista non si chiama.
6. **Copertura 3 giorni** — quanti atleti hanno almeno un allenamento assegnato da oggi a
   fra due giorni. Non è vanità: è l'unico numero della Home che dice «devi programmare adesso».
7. **Allenamenti scaduti** — in fondo, in forma di lista: è lavoro da smaltire, non un
   allarme. Accanto all'atleta fermo si mescolavano due problemi di segno opposto.

**La Live Coach Cam** resta una barra sopra l'eroe, non una sezione con un titolo: dura
quanto un allenamento, e per 23 ore al giorno quel titolo stava sopra il vuoto.

### 🔴 «Manda promemoria» NON è stato implementato, ed è una scelta obbligata
L'artboard mette un bottone «Manda promemoria» nella card degli atleti fermi. **Non c'è
nessun modo di farlo funzionare dal client**, e vale la pena scriverlo perché sembra una
dimenticanza:
- la policy RLS di `notifications` è `auth.uid() = user_id`, quindi il coach **non può
  inserire una notifica per un altro utente** (§4-bis: è una delle policy scritte bene);
- `send-reminders` non ha una modalità «promemoria a QUESTO atleta»: `immediate` manda
  «Nuovo Allenamento!», che è un altro messaggio. Aggiungerla è un **deploy** di una
  funzione **condivisa con la web app in produzione** (§1.1), non una modifica di UI.

Al suo posto la **riga intera è il bersaglio** e apre la scheda dell'atleta. È anche più
corretto del design: con più nomi elencati, un «Apri» in fondo alla card non dice quale
atleta apre. La voce sta in BACKLOG.

### ⚠️ Il ramo atleta NON si vede più dalla Home coach (28/08/2026)
Fino al 28/08 il ramo atleta era renderizzato per `role === 'athlete' || role === 'admin'`:
in fondo alla Home coach comparivano quindi l'**allenamento di oggi** (o «Giorno di rest»),
l'**anello della settimana**, **Serie** e **Volume · RPE**. Erano i numeri di *una* persona
in una pagina che parla di dodici, e per il coach dicevano sempre rest — il suo account è
escluso da chi si segue (`COACHING_ID`), quindi non ha allenamenti propri. Il bento
compariva **sempre**, anche senza un dato: `weeklyStatus` nasce già con sette giorni, quindi
`weeklyStatus.length > 0` era vero al primo render.
Ora il ramo atleta è `role === 'athlete'` e basta, **e con esso non parte più la query sullo
storico personale** (due `select` in meno a ogni apertura della Home coach). Chi vuole quella
vista passa da **Impostazioni → «Anteprima come atleta»**, che mette `adminRoleOverride` e
rende la Home atleta intera.
Insieme è uscita la riga **«Profilo»**: era l'unico collegamento a `/profile` per l'admin, e
resta raggiungibile dalla stessa anteprima, dove la navbar ne ha la voce.
✅ **E dal 28/08/2026 nemmeno la testata** (chiuso il giorno stesso). Il corpo era stato
separato, il ramo della **testata** no: guardava anch'esso `role === 'athlete' || role ===
'admin'`, quindi sopra una pagina che parla di dodici persone il coach leggeva il saluto
dell'atleta — «Buongiorno, Federico», la settimana ISO e la frase motivazionale del giorno.
`HeaderCoach` («ven 28 agosto · 9 atleti · 2 in pausa» + «FLEOFIT Coach») **esisteva già ed
era codice irraggiungibile**: l'unico ruolo che lo apriva era `'coach'`, che l'onboarding non
assegna (`App.jsx`). Ora la regola della testata è la stessa del corpo — `role === 'athlete'`
di qua, tutti gli altri di là — ed è la testata dell'artboard `Home Coach.dc.html` 2b.
⚠️ È anche la ragione per cui i **test storici** di questa sezione montano `'coach'` e non si
erano accorti di niente: i tre test nuovi montano `'admin'`, l'unico ruolo che esiste davvero.
Il numero di atleti è `atletiCoach.length`, che **esclude già `COACHING_ID`** (il filtro sta
nel fetch): è quello della rubrica, non uno più grande. Chi è in pausa **resta nel totale** e
si dichiara a parte, altrimenti i numeri delle sezioni sotto — che la pausa la escludono —
sembrerebbero sbagliati.

### Cosa è uscito
Le card **«Calendario»** e **«Atleti»**: sono già due voci della navbar coach (verificato in
`Navbar.jsx`), e vale il corollario della Regola dell'Eroe Unico applicato all'atleta il 26/08.
L'**archivio resta**, come riga sotto la CTA: è materiale di lavoro del coach, non una
destinazione duplicata. Il **Profilo** resta anch'esso come riga, ma **solo per `admin`**:
è l'unico ruolo che non ha quella voce in navbar. Resta una sola superficie gialla piena in
pagina, «Crea workout», come da Regola del Tratto Unico.

### Una query sola al posto di cinque
`Home.jsx` carica ora `athletes` (righe, non solo il conteggio) e **un unico** `athlete_workouts`
sulla finestra `[oggi − 45 giorni, oggi + 2]`, con i join su `athletes` e `workouts`. Fermi,
scaduti, copertura, feedback e squadra della giornata sono tutti `useMemo` su quelle due liste:
cinque `select` sullo stesso intervallo sarebbero stati cinque round trip per gli stessi dati.

### ⚠️ Le cinque trappole di questo codice
1. **`athlete_workouts` non ha `created_at`.** Quindi «feedback nuovo» **non può** voler dire
   «arrivato dopo il tuo ultimo accesso»: vuol dire «che non hai ancora aperto», e l'elenco
   degli id già letti sta in `localStorage.fleofit_feedback_visti_<uid>`. Conseguenza da
   conoscere prima di dire che è un bug: **il "letto" è per dispositivo, non per account**.
   L'alternativa richiederebbe una colonna, e lo schema è congelato (regola 0-bis).
2. **L'elenco dei già letti si legge in un `useMemo`, non in un `useEffect` con `setState`.**
   Non è stile: con l'effetto, scrivere i letti farebbe sparire la lista **sotto le dita del
   coach** nello stesso istante in cui la apre. Così il valore si rilegge solo quando cambiano
   i dati, cioè al prossimo caricamento — che è quando il contatore deve scendere.
3. **`voice_note_url` è UNA colonna per una comunicazione bidirezionale** (CLAUDE.md §4): non
   esiste modo di sapere se l'ha registrata l'atleta o il coach. Si contano perciò solo le
   assegnazioni **completate**, dove la nota accompagna il completamento. È un'approssimazione
   voluta, non una svista.
4. **Aprire un feedback segna letto SOLO quello.** Fino alla revisione il gesto era «apro la
   lista, li leggo tutti», perché la lista era chiusa e il numero era l'unica cosa visibile.
   Ora le citazioni sono in pagina: azzerare l'arretrato al primo tocco cancellerebbe tre
   feedback che il coach non ha ancora guardato. C'è un test che lo prende.
5. **«In corso» viene dalla presenza Realtime, non dal database.** `athlete_workouts` non ha
   uno stato «iniziato»: l'unica fonte che distingua «non ha ancora finito» da «lo sta facendo
   adesso» è il canale `global_live_workouts` della Live Coach Cam. La presenza è indicizzata
   per `athleteWorkoutId` (è la chiave con cui `WorkoutDetail` fa `track`), quindi l'`athlete_id`
   si ricava dall'assegnazione già caricata — nessuna query in più, nessuna modifica a
   `WorkoutDetail`. Conseguenza voluta: **gli atleti che corrono non compaiono mai «in corso»**,
   perché la corsa non ha il timer guidato e quindi non traccia presenza (§7).

### 🔴 Il difetto che il filtro dell'account coach nascondeva
`stats.athletes` contava `athletes` **senza escludere `COACHING_ID`**, mentre `Athletes.jsx` lo
esclude da sempre: la vecchia card «Atleti» diceva quindi un numero diverso da quello della
rubrica. Innocuo finché era solo un'etichetta; con l'eroe non lo è più — il coach sarebbe
comparso **fra i propri atleti fermi** ogni volta che non si allena, e avrebbe falsato anche la
copertura. Ora il filtro è nella Home, ed è coperto da un test.

### Il codice morto che il rework ha lasciato indietro, e che è stato rimosso
`attivitaRecente` (in `statisticheCoach.js`) e i componenti `CellaFeedback`, `CellaCopertura`,
`EsitoAttivita`, `VuotoSezione` (in `HomeCoachUI.jsx`) non avevano più chiamanti dopo la
revisione: sono stati cancellati insieme ai loro test, invece di restare come terza copia di
qualcosa che nessuno chiama (§9 punto 2). `HeroAttenzione`/`HeroTuttiAttivi` sono diventati
`SezioneAttenzione`/`TuttiAttivi`: **il nome dice il rango**, e chiamare «Hero» qualcosa che
sta sotto la CTA è il modo in cui il prossimo lettore rimette l'ordine sbagliato.

---

## 9-decies. «Atleta in pausa» (27/08/2026)

Richiesta del committente: un atleta che avvisa di volersi fermare non deve più comparire fra
quelli che **richiedono attenzione** nella Home coach, ma deve restare nella rubrica con tutto
il suo storico.

### 🔴 Perché NON è una colonna, e cosa comporta
`athletes.is_paused` sarebbe una migrazione, e **lo schema è congelato** fino all'approvazione
su App Store (regola 0-bis): il database è uno solo e serve anche la web app in produzione,
senza staging. Lo stato vive quindi dentro `athletes.notes` — la nota che il coach scrive
per l'atleta — nel
prefisso `[PAUSA: yyyy-MM-dd]`, con **lo stesso meccanismo già usato per l'RPE** dentro
`athlete_workouts.notes` (§4). Tutto passa da `src/lib/pausa.js`.

Le tre conseguenze da conoscere **prima** di dire che è un bug:
1. **La web app su `main` non conosce il marcatore.** Se il coach modifica la nota da
   lì, il prefisso può sparire e l'atleta torna fra quelli da chiamare. È lo stesso rischio
   dell'RPE (§1.1), ma si comporta meglio: il guasto è **visibile** — l'atleta ricompare — e si
   ripara con un tocco. Non perde dati.
2. **Chiunque scriva `athletes.notes` deve passare da `formatNotePausa`.** La modale «Modifica
   profilo» faceva `.update({ notes: form.notes })` con il testo grezzo: senza il round-trip,
   ogni «Salva» avrebbe cancellato la pausa **in silenzio**. C'è un test che lo prende.
3. **Il marcatore vale SOLO in testa alla nota.** Altrimenti bastava che il coach scrivesse
   «ne parliamo, magari [PAUSA] a settembre» perché un atleta sparisse dagli allarmi senza che
   nessuno l'avesse deciso.

### Dove la pausa ha effetto, e dove no
| Superficie | Effetto | Perché |
|---|---|---|
| Home → **Richiedono attenzione** | esce | è la richiesta |
| Home → **denominatore dell'eroe** e **Copertura 3 gg** | esce dal totale | «2 di 7» quando due dei nove si sono fermati. Contarlo fra i «senza allenamento» vorrebbe dire chiedere al coach di programmare per chi ha chiesto di fermarsi |
| Home → **Allenamenti scaduti** | esce | uno scaduto di chi è in pausa non è lavoro da smaltire: è la conseguenza attesa. Resta visibile nella sua scheda |
| Home → **header** | «9 atleti · 2 in pausa» | senza, i numeri sotto contraddicono la rubrica e sembrano sbagliati |
| Home → **Attività oggi e ieri** | **resta** | è consultazione di ciò che è successo davvero. Se un atleta in pausa si allena, il coach deve vederlo — ed è il segnale per riattivarlo |
| **Atleti** (rubrica) | resta, con la pillola «In pausa» | è la lista in cui deve restare, ed è l'unico posto dove il coach si accorge di averne messo in pausa uno e dimenticato |

`atletiFermi`, `allenamentiScaduti` e `copertura` applicano il filtro **da sé** invece di
aspettarsi una lista già ripulita dal chiamante: sono le funzioni che producono un allarme e un
totale, e chi si dimentica il filtro non ottiene un errore — ottiene una telefonata a chi aveva
chiesto di non essere chiamato.

### ⚠️ Due dettagli di interfaccia che non sono estetica
- **La conferma c'è solo per METTERE in pausa, non per toglierla.** Mettere in pausa spegne un
  allarme, e uno spegnimento per errore non si nota. Toglierla riaccende, e un allarme di troppo
  si vede da solo.
- **La pillola «In pausa» è nascosta all'atleta.** `AthleteDetail` è anche `/profile`, cioè la
  scheda che l'atleta vede di sé: la pausa è uno stato interno della programmazione del coach, e
  mostrarla lì vorrebbe dire comunicare «ti ho messo in disparte» con una pillola arancione
  invece che parlandoci.

> ⚠️ **`athletes.notes` è VISIBILE all'atleta, ed è giusto così.** Confermato dal committente il
> 27/08/2026: è una nota che il coach scrive *per* l'atleta, non su di lui, e `AthleteDetail` la
> rende senza guardia di ruolo di proposito. Chi legge «note private» in una vecchia versione di
> questo documento non lo prenda per un difetto da correggere.
> Due conseguenze per la pausa, entrambe già gestite:
> - il marcatore **non si vede mai** — né nella scheda né nel campo della modale di modifica —
>   perché ovunque si mostra `parseNotePausa(...).testo` e mai il valore grezzo;
> - **anche l'atleta può salvare quella nota** (il bottone «Modifica» su `/profile` non è
>   riservato al coach), e il round-trip di `formatNotePausa` nella modale vale per entrambi i
>   ruoli: salvare il proprio profilo **non** annulla la pausa. C'è un test.
>
> Resta vero che il valore grezzo è raggiungibile dall'atleta per altre vie (l'export JSON, una
> chiamata all'API): il marcatore nasconde lo stato dall'interfaccia, non lo cifra.

---

## 9-ter. App Store — rifiuto del 1.1.0 (2) e ri-sottomissione del 1.1.0 (3)

### Cronologia
- **22 mag 2026** — caricata `1.1.0 (2)`. **Respinta** con **2.3.1(a) Hidden features** e
  **3.2.1(viii) Financial Services**.
- **24 ago 2026** — correzioni applicate nel commit `fc81404`, caricata `1.1.0 (3)`.
- **02 set 2026** — 🔴 **respinta di nuovo, ma per un'altra cosa**: linea guida **4.8
  Login Services**, cioè Google senza un'alternativa che permetta di nascondere la
  propria email. Non è una ricaduta del 2.3.1(a). Chiuso il 03/09 con Sign in with
  Apple (§9-sexvicies), **senza togliere Google**.
- **20 set 2026** — 🔴 **respinta una terza volta, con TRE rilievi insieme** sulla
  build `1.0 (5)`: **2.5.1** (HealthKit linkato senza una funzione primaria che lo
  giustifichi), **5.1.2(i)** (le etichette privacy dichiarano *tracking* su email e
  nome, e l'app non chiede l'ATT) e **2.3.6** (l'age rating dichiara *In-App
  Controls* inesistenti). Solo il primo è codice, ed è chiuso il 21/09; gli altri
  due si correggono su App Store Connect. Tutto in §9-quatertricies.
- **26 ago 2026** — ✅ **la causa del rifiuto è chiusa e verificata dai due lati.**
  Punti 1 e 2 sul binario spedito (`tools/verifica-ipa.sh`), punto 3 provato dall'app:
  `demo@fleofit.it` **assegna un workout**. Era esattamente ciò che a maggio non
  funzionava, e che nessuno aveva provato.

> 🔴 **«1.0» e «1.1.0 (3)» sono DUE numeri diversi, e la lettera di Apple li mescola.**
> Su App Store Connect il record della versione dice **`1.0`** — è il numero metadati, quello
> che gli utenti vedranno sullo Store. Il **build** dice **`1.1.0 (3)`**, cioè
> `CFBundleShortVersionString` + `CFBundleVersion`, che vengono da `MARKETING_VERSION` e
> `CURRENT_PROJECT_VERSION` nel `pbxproj`. La lettera del 02/09/2026 scriveva «Version
> reviewed: 1.0 (3)», cioè la versione del record accanto al numero di build — e a chi legge
> solo quella sembra che il progetto dichiari la versione sbagliata. **Non è così, e
> `MARKETING_VERSION` non va riportato a 1.0**: il build precedente portava 1.1.0 e si è
> agganciato al record 1.0 senza problemi. Verificato il 09/09/2026 sul pannello.
> ⚠️ Conseguenza cosmetica da conoscere: ad approvazione avvenuta lo Store dirà **1.0** e
> Impostazioni dirà **1.1.0**, perché quella riga viene da `App.getInfo()`, cioè dal build
> (§9-duoetvicies punto 6). Si allinea dopo, scegliendo quale dei due è il numero vero.
>
> ℹ️ **Il build number del `pbxproj` NON è quello spedito, ed è normale.** Con
> `method: app-store-connect`, `manageAppVersionAndBuildNumber` vale YES per impostazione
> predefinita: Xcode alza da solo il numero oltre l'ultimo presente su App Store Connect.
> Misurato il 26/08/2026 sullo stesso archivio: `pbxproj` = 3, archivio = **2**, ipa esportato
> = **4**. È la spiegazione dell'incremento "misterioso" del 24/08, che questo documento
> attribuiva a una svista. Non serve riallineare il pbxproj a mano.

> 🔴 **AGGIORNAMENTO 24/08/2026 — la causa del rifiuto NON è stata rimossa del tutto.**
> `demo@fleofit.it` è stata aggiunta al bundle e a `send-reminders`, ma **non alle policy RLS**
> (§4-bis). Nel database il revisore non è admin: vede l'interfaccia coach completamente vuota.
> La build 1.1.0 (3) attualmente in revisione è quindi esposta a un **secondo rifiuto 2.3.1(a)**.
> Il fix è un `ALTER POLICY` additivo su 5 policy, senza rischio per la web app.

### 2.3.1(a) — causa accertata: l'account admin dato ad Apple era inerte
Il ruolo coach non viene dal DB ma da `ADMIN_EMAILS` **hardcoded nel JS compilato**; nel bundle
spedito a maggio c'erano solo le 4 email personali. Al login del revisore `isAdmin` era `false` →
o vedeva solo il lato atleta, o veniva espulso da `signOut()` a `/login?error=unauthorized`
(`App.jsx:185-223`). **Il ruolo coach in sé non è una violazione**: gli accessi per ruolo sono
leciti, devono solo essere raggiungibili.

> ⚠️ Corollario da ricordare: **che l'account esista su Supabase non significa nulla.** Può avere
> tutti i permessi del mondo sul DB ed essere comunque `isAdmin = false`. E vale anche il
> contrario: può essere `isAdmin = true` nel bundle e non poter fare niente, perché le policy
> RLS hanno una **terza** lista di admin (§4-bis). Servono tutti e tre gli allineamenti.
>
> ✅ **Verificati tutti e tre il 26/08/2026**, e non per lettura ma per prova:
> `src/App.jsx` e `_shared/admin.ts` hanno le stesse 5 email; `pg_policies` sul database vivo
> coincide riga per riga con `supabase/schema/`; le 5 email sono nell'`.ipa` esportato; e
> `demo@fleofit.it` **ha davvero assegnato un workout dall'app**.
> È il primo giro in cui il percorso del revisore è stato percorso invece che dedotto.

### 3.2.1(viii) — falso positivo su "Cash In" / "Cash Out"
46 occorrenze letterali nel bundle. Sono termini Hyrox (blocco di apertura e di chiusura), ma per
lo scanner sono movimenti di denaro; il segnale è rinforzato da `push_subscriptions` e
`invitation_codes`.
**DECISIONE DEL COMMITTENTE (24/08/2026): la terminologia NON si tocca.** Strategia scelta:
**non rinominare, disambiguare**. `block.type` resta `'Cash In'` ovunque.
⚠️ **Mai fare find&replace**: sono valori persistiti in `workouts.sections.blocks[].type` (jsonb) e,
nel legacy, chiavi `sections.cashIn`/`cashOut`; il DB è condiviso con la web app in produzione.

### Correzioni applicate (commit `fc81404`)
- `demo@fleofit.it` aggiunta a `ADMIN_EMAILS` (`src/App.jsx`) **e** alla lista gemella in
  `send-reminders/index.ts` (§9 punto 7: sono due liste).
- Nuovo `src/lib/blockHints.js` (`BLOCK_HINT`), didascalie affiancate al termine nel picker blocchi
  e nell'intestazione blocco (`CreateWorkout.jsx`), nella scheda workout e nel PDF
  (`WorkoutDetail.jsx`), e sulla TV (`TVDashboard.jsx`).
- Rimossi: `NSSpeechRecognitionUsageDescription` (funzione inesistente su iOS), `CloudSyncService`
  (codice dormiente), blocco `server`/`cleartext` da `capacitor.config.ts`, blocchi commentati
  "OPZIONE COACH DISATTIVATA" (`App.jsx`, `Login.jsx`).
- `UIRequiredDeviceCapabilities` da `armv7` ad `arm64`.
- Toggle Settings → "Anteprima come atleta"; "Modalità Bunker" → "Modalità Offline".

### Verifiche fatte sul binario spedito (24/08/2026)
Fatte **dentro `App.app` dell'archivio caricato**, non sul sorgente: `demo@fleofit.it` presente nel
bundle JS, didascalie presenti, zero occorrenze di `cloud-sync` e "Modalità Bunker", zero
`cleartext` in `capacitor.config.json`, `arm64`, bundle id `it.federicoleo.fleofit` (non il `.dev`
della configurazione Debug).

> **Controlli obbligatori prima di ogni archive.** Il primo è quello che è mancato a maggio;
> il secondo è stato aggiunto il 09/09/2026, dopo che il seme dell'ambiente di prova è
> arrivato fino a una build in preparazione senza che niente lo segnalasse (§9-quinvicies);
> il terzo il 21/09/2026, dopo il rilievo **2.5.1** (§9-quatertricies).
> ```bash
> grep -l "demo@fleofit.it" dist/assets/*.js                                  # DEVE stampare un file
> grep -l "AMBIENTE DI PROVA\|at-sara\|fleofit_demo_db" ios/App/App/public/assets/*.js   # NON deve stampare niente
> grep -rl "Apple Health\|NSHealth\|capacitor-health\|developer.healthkit" ios/App/App/public/assets/ ios/App/App/*.plist ios/App/App/App.entitlements ios/App/CapApp-SPM/Package.swift   # NON deve stampare niente
> ```
> ⚠️ Il terzo cerca i **marcatori**, non la parola «health»: `@supabase/realtime-js`
> porta nel bundle un `primaryPassedHealthCheck` che con un grep generico fa scattare
> l'allarme a ogni build — e un controllo che grida sempre è un controllo che si smette
> di leggere. ⚠️ Ed è solo un'anticipazione: HealthKit entra nel binario anche da un
> plugin che nessuno chiama, e lì lo vede solo `otool -L` sull'`.ipa` esportato — è il
> controllo **10** di `tools/verifica-ipa.sh`.
> ⚠️ Il secondo si fa su `ios/App/App/public`, non su `dist`: è quella la copia che Xcode
> compila, e le due divergono ogni volta che si salta `npx cap sync ios` (§2).
> Attenzione a `grep -c` su più file: stampa una riga per file (quasi tutte `:0`) ed esce con
> codice 1 quando non trova nulla — si legge come un fallimento e non lo è.

### Cosa non sta nel repo e va fatto a mano
Account `demo@fleofit.it` su Supabase Auth **con riga `athletes` pre-creata** (senza, il revisore
finisce in onboarding), dati demo perché la dashboard coach non si apra vuota, secondo account
atleta, redeploy di `send-reminders`, note per il revisore, risposta nel **Resolution Center**.

✅ **Stato al 26/08/2026** (query in `tools/verifica-revisore.sql`): l'account esiste, ha l'email
confermata e la riga `athletes`; la dashboard coach non è vuota (12 atleti, 171 workout, 180
assegnazioni).
⚠️ **Aperto**: `codici_attivi = 0`. La registrazione è chiusa per scelta, ma con zero codici un
revisore che provasse a registrarsi come atleta verrebbe espulso senza spiegazione. Generarne uno
da Impostazioni → Codici invito.
⚠️ Nota sulle verifiche: `athlete_workouts` **non ha `created_at`** e `id` è un UUID casuale,
quindi non esiste modo di ordinarla per "più recente". Per controllare che un'assegnazione sia
arrivata: contare le righe prima e dopo, oppure cercare per atleta e `completed_date`.

### Verificato non problematico
`hidden`/`unlock` sono classi Tailwind e `unlockAudio`; i file morti non vengono bundlati (Vite li
esclude); nessuna eccezione ATS; nessun codice di pagamento/IAP; `ITSAppUsesNonExemptEncryption`
già a `false`.

### Se il rifiuto su 3.2.1(viii) si ripete
**Non ricaricare una terza build in silenzio** — rispondere in Resolution Center e chiedere una
chiamata con App Review.

Documento operativo completo (reperti, note revisore, checklist):
artifact "Riammissione FLEOFIT" — https://claude.ai/code/artifact/b2b8e586-a617-4172-98dc-f06e2b34ce6a

---

## 9-undecies. Il rework di «Crea Workout» (27/08/2026)

Nasce dallo stesso progetto Claude Design delle due Home
(`4a238081-a3ee-4f59-ae34-100f29d55601`), artboard `Crea Workout.dc.html`.
Come per le Home, la logica di `CreateWorkout.jsx` non è stata riscritta: sono
cambiati il JSX dei due passi, il modo di inserire i numeri, e i dati che il
builder mostra di sé.

### Il problema, in una riga
Il builder funzionava ma era **cieco**: si aggiungevano blocchi senza sapere
quanto dura l'allenamento, quanti blocchi sono, quanto pesano. La lista era
piatta — riscaldamento, lavoro centrale e chiusura avevano lo stesso peso visivo
— e «Salva» stava in fondo a uno scroll che **cresce con il workout**, quindi si
allontanava man mano che il coach lavorava.

### Cosa c'è ora
1. **Lo step 1 fa una domanda sola.** La categoria è tre card con nome, colore di
   corsia e una riga che dice cosa aspettarsi, non tre segmenti stretti. Nome e
   data scendono **sotto** la scelta: si compilano una volta e si dimenticano.
2. **Il riepilogo in cima allo step 2** — durata stimata, numero di blocchi, RPE
   atteso — e sotto una barra proporzionale che mostra come la durata è
   distribuita, con il blocco di lavoro in ambra.
3. **I blocchi** prendono una spina verticale a sinistra (colori di `TYPE_COLORS`,
   gerarchia fatta dallo spessore) e la durata in testa alla riga. Il blocco
   aperto è l'unico con bordo e spina in ambra.
4. **«Salva» è una barra fissa in basso**, la stessa per i due passi e per le tre
   categorie. Sopra, **«Genera con IA»** è una card piena a tutta larghezza e
   «Aggiungi blocco» il gesto tranquillo sotto di essa.
5. **Le rotelle dei numeri sono sparite** dal flusso Hyrox: al loro posto il
   valore grande, meno e più ai lati, i valori d'uso comune a portata di pollice
   e «Digita» per il valore esatto. In più la riga **«ultima volta»**, che
   ripropone i valori dell'ultima assegnazione dello stesso esercizio.

### ⚠️ Le sette trappole di questo codice
1. **La durata è una STIMA, e deve dirlo.** `src/lib/stimaWorkout.js` sa
   esattamente quanto dura un EMOM o un ON/OFF, ma «For Time», «Interval»,
   «Cash In» e «Cash Out» **non hanno una durata**: sono cronometri liberi, il
   tempo lo fa l'atleta. Lì si stima dagli esercizi con tre costanti dichiarate
   in cima al file. Nessun'altra superficie deve trattare quel numero come un
   dato vero.
2. **Un blocco stimabile a zero mostra «—», non «0:00».** Un Cash In senza
   esercizi non dura zero: semplicemente non si può ancora stimare, e «0:00» è
   una bugia con l'aria di un dato.
3. **`rpeAtteso` torna `null`, non 5.** È la stessa lezione di `rpeDichiarato()`
   in `src/lib/rpe.js` (§9-octies): un ripiego travestito da misura è peggio di
   un trattino, perché il coach lo legge come un dato. Ed è **pesato sulla
   durata**, non sul numero di esercizi — venti minuti a 9 e due a 3 non fanno 6.
   Il peso vale su **due livelli**: la durata stimata del blocco, distribuita fra
   i suoi esercizi in proporzione a quanto durano. Mille metri di ski sono quattro
   minuti e dieci burpees mezzo: con il peso piatto quel blocco leggerebbe 7,5,
   che è il valore di un lavoro che lì dentro nessuno fa.
   🔴 **E NON è una media aritmetica, dal 31/08/2026.** Segnalato dal committente
   guardando la scheda: una media sottostima *sempre* uno sforzo variabile, e
   quasi ogni workout apre con un Cash In a bassa intensità. Quindici minuti a 3
   davanti a dieci minuti a 10 davano **5,8** — e in quel workout non esiste un
   solo minuto a 5,8. La scheda dichiarava un allenamento più leggero di quello
   che sarebbe stato, che è il difetto peggiore possibile per un numero che il
   coach usa per dosare il carico.
   Ora è una **media di potenza** di ordine `ESPONENTE_SFORZO = 3`:

       RPE = ( Σ dᵢ·rᵢ³ / Σ dᵢ ) ^ (1/3)

   cioè lo stesso rimedio per cui nel ciclismo esiste la *Normalized Power* al
   posto della potenza media. Sul caso sopra torna 7,5.
   **Le tre proprietà da non perdere** se un giorno la si tocca, ognuna con il
   suo test:
   - **non è mai sotto la media aritmetica né sopra il massimo dichiarato**, e su
     un workout a intensità uniforme torna *esattamente* quel valore — i workout
     già corretti non cambiano di un decimo, e trenta secondi a 10 in fondo a un
     quarto d'ora tranquillo alzano il numero da 3,2 a 3,9, non a 10 (è la
     ragione per cui non si usa il massimo);
   - **non richiede di sapere quali tipi di blocco «contano»**. Escludere Cash In
     per etichetta era l'altra strada, ed è sbagliata: in Hyrox un Cash In fatto
     duro esiste, e a decidere dev'essere l'intensità che il coach ha dichiarato.
     WarmUp e Rest, del resto, *già* non pesano — non hanno esercizi con
     un'intensità dichiarata, e il ciclo li salta;
   - **è continua e monotona**: nessuna soglia che fa saltare il numero quando si
     sposta un round.
   ⚠️ **3 e non il 4 di Coggan**: quello è calibrato sui **watt**, una grandezza
   fisica. L'RPE è già una scala percettiva compressa, quindi 4 sovracorregge —
   una seduta con metà lavoro davvero facile si leggerebbe quasi massimale.
   ⚠️ Resta vero che è una **stima** (punto 1), e che l'etichetta «RPE atteso»
   non ha mai promesso una media: non serve cambiarla.
4. **L'«Intensità dichiarata» NON è l'«RPE atteso»**, e l'artboard non la mostra.
   È rimasta lo stesso: finisce in `workouts.sections.intensity`, e la scheda, il
   PDF e la story la leggono. Toglierla dall'interfaccia vorrebbe dire perdere un
   campo che il coach controlla e che tre superfici mostrano.
5. **Nome e data vivono SOLO nello step 1.** Il ritorno è la testata dello step 2,
   che è un bottone (`aria-label="Modifica nome e data"`). Senza quel ritorno un
   workout aperto in modifica — che parte già al passo 2 — non sarebbe più
   rinominabile. C'è un test che lo prende.
6. **La didascalia del blocco sta sulla SECONDA riga.** Su 393px, accanto al nome,
   alla durata e a quattro azioni, «Blocco di apertura» finiva troncata a «Blocco
   di apert…» — ed è la risposta al rilievo **3.2.1(viii)** di Apple (§9-ter), non
   un ornamento. Sulla seconda riga ci sta intera, ed è la prima cosa scritta,
   quindi l'ultima a cedere se la riga trabocca.
7. **La barra fissa ha un offset, non `bottom-0`.** La navbar è `fixed` a z-50: con
   `bottom-0` la barra finirebbe **sotto** di essa. ⚠️ Dal 28/08 l'offset non è più un
   numero scritto lì: è `bottom-[var(--altezza-navbar)]`, e il numero vive in
   `src/index.css` (§6). Chi cambia la forma della navbar cambia quello, non i
   chiamanti.
8. **La barra sparisce mentre si scrive**, e non è una scelta estetica.
   `Keyboard.resize` vale `'native'` (capacitor.config.ts), quindi con la
   tastiera aperta **la webview si rimpicciolisce**: qualunque cosa ancorata in
   basso si ritrova incollata sopra la tastiera, e a schermo sembra «salita in
   cima» — è il fondo che si è alzato. Non c'è modo di tenerla ferma dov'era,
   quel punto dello schermo mentre si digita non esiste. La navbar fa lo stesso
   da sempre, e dal 27/08 le due condividono `src/useTastiera.js`.
9. **Aggiungere un blocco CHIUDE quello aperto prima**, quindi la pagina si
   accorcia di colpo e il blocco nuovo — che sta in fondo alla lista — esce
   dallo schermo: il coach lo crea e non lo vede. Lo risolve `bloccoDaMostrare`,
   un **ref** (non uno stato: non è mai letto durante il render) letto da un
   effetto su `blocks`. ⚠️ Lo scorrimento passa da `requestAnimationFrame`, che
   **non scatta in una scheda non visibile**: nei test va atteso con due frame,
   o un `expect(...).not.toHaveBeenCalled()` passa senza verificare niente.
10. **«Genera con IA» sta SOPRA la lista dei blocchi**, non sotto come
   nell'artboard. Alla prova sul dispositivo, con cinque blocchi aperti, non la
   trovava più nessuno: è il modo di *partire* da zero, quindi cresce di
   distanza proprio mentre diventa inutile. «Aggiungi blocco» resta sotto.
11. **Il campo di ricerca degli esercizi NON prende il fuoco all'apertura.**
   L'`autoFocus` faceva salire la tastiera su una lista di centotrenta voci,
   coprendo proprio quello che si era venuti a guardare. Chi vuole scrivere
   tocca il campo.

### ⚠️ Il passo NON usa lo Stepper, e ci sono voluti tre tentativi
Lo Stepper funziona su ripetizioni, chili, metri e tempi perché lì il «più uno»
vuol dire qualcosa. Sul **passo** no. I due tentativi caduti, con la loro ragione:

1. **Stepper con cinque valori rapidi.** `ERGO_PACE_OPTIONS` mette in fila `Z3`,
   `All out` e `2:05 /500m`, che non stanno sulla stessa retta: cinque valori su
   ottantacinque nascondevano gli altri ottanta, e il più/meno attraversava
   categorie senza rapporto fra loro.
2. **Un elenco intero a schermo pieno.** Mostrava tutto, ma per spostare un passo
   di cinque secondi chiedeva di aprire una schermata, cercare in una griglia di
   sessantuno pillole e tornare indietro. Corretto e faticoso.

**La lezione**: la scelta ha **due** domande, non una. Prima *di che tipo* di
passo si parla — a sensazione, ritmo, cadenza — e lì le voci sono poche e vanno
viste tutte insieme. Poi *quale valore*, e lì è una scala fitta e ordinata su cui
si aggiusta per gradi rispetto a quello che c'è già.

Quindi (27/08/2026, su indicazione del committente): un **segmento** per il
genere, e per il valore una **ruota orizzontale** — precedente a sinistra,
successivo a destra, scelto grande al centro. Dentro un genere la rotella è lo
strumento giusto; è quando le si chiede di attraversare una tassonomia che
diventa cieca, ed è tutta la differenza con lo `ScrollPicker` che ha sostituito.

Dettagli di `RuotaValori` che non sono rifinitura:
- **Ogni voce è anche un bottone.** Senza, il valore sarebbe raggiungibile solo
  trascinando: né da tastiera né da VoiceOver. `role="option"` +
  `aria-selected` dicono qual è la scelta a chi non vede la dimensione.
- **La misura viene dal genere, non dalla voce.** «2:15» sta in settantotto punti
  a venticinque, «Gara Singola» no. Se la dimensione la decidesse la singola
  voce, le voci ballerebbero mentre si scorre.
- **La sfumatura ai bordi.** Le voci a distanza 2 sono tagliate a metà cifra, e
  una cifra tranciata si legge come un difetto invece che come «la scala
  continua».
- **`—` sta in testa a OGNI genere.** Il passo è facoltativo: se il modo di non
  indicarlo vivesse in un genere solo, chi guarda «Ritmo» dovrebbe cambiare
  scheda per cancellarlo.
- ⚠️ **La barra di posizione non è decorativa** su una ruota da sessantuno voci:
  senza, non si sa se si è all'inizio o alla fine della scala.
- ⚠️ I generi sono **derivati** dalle costanti con dei `filter`, non ricopiati.
  L'etichetta perde il suffisso perché lo dice l'intestazione del genere, ma il
  valore scelto resta **intero** (`2:00 /500m`). C'è un test che lo prende:
  scrivere l'etichetta accorciata in `workouts.sections` non darebbe **nessun**
  errore, darebbe una scheda che la web app legge storta.

### Il vocabolario dei dati NON è cambiato
Gli Stepper scrivono le stesse identiche stringhe delle rotelle — `"20"`,
`"9 kg"`, `"500m"`, `"1:00"`, `"Z2"` — perché il meno e il più si muovono
**dentro le liste esistenti** (`REPS_OPTIONS`, `KG_OPTIONS`, `TIME_OPTIONS`…),
non su un numero. È `passoInLista()`, e la ragione è che quei valori finiscono
in `workouts.sections` su un database **condiviso con la web app in produzione**
(§1.1): un formato nuovo lì dentro non darebbe alcun errore, darebbe una scheda
che l'altra app legge storta. C'è un test che monta il builder vero e verifica la
stringa che finisce nel blocco.

### Cosa NON è stato ridisegnato, e perché
L'artboard copre lo **step 1** (tutte e tre le categorie) e lo **step 2 Hyrox**.
Il corpo dello step 2 **Corsa** e quello **Custom** hanno preso la cornice
condivisa — testata, card, barra fissa — ma non il modo di comporre le fasi:
`RunningStepPicker` usa ancora `ScrollPicker`, e quello schermo è esplicitamente
il prossimo pezzo di design («fammi vedere lo step 2 della corsa», in fondo
all'artboard). `ScrollPicker` resta quindi vivo e usato, non è codice morto.

### «Ultima volta»: una lettura, e nessuna colonna
`athlete_workouts` e `workouts` non hanno un indice per esercizio, e **lo schema è
congelato** (regola 0-bis). La riga si costruisce con una sola `select` sugli
ultimi `STORICO_WORKOUT = 40` workout per data, scandagliando il jsonb lato
client al montaggio di `ExercisePicker`. Se fallisce non succede niente: la riga
non compare, e l'errore finisce nei log invece che in un `catch` muto (§9-quater).

---

## 9-duodecies. Il rework della scheda del workout (28/08/2026)

Stesso progetto Claude Design delle Home e del builder
(`4a238081-a3ee-4f59-ae34-100f29d55601`), artboard `Workout Detail.dc.html`,
opzioni **4b** (coach) e **4c** (atleta, allenamento fatto). Come per gli altri
tre schermi la logica di `WorkoutDetail.jsx` non è stata riscritta: sono
cambiati il JSX della pagina, l'ordine in cui le cose stanno, e ciò che la
scheda dice di sé. Nessun campo di Supabase cambia forma.

### Il problema, in una riga
La pagina apriva con il logo FLEOFIT, poi il titolo, poi **cinque bottoncini in
fila** (TV, Cardio, Duplica, Modifica, Elimina) e un avviso arancione alto
quanto una card: l'azione che conta — avviare l'allenamento — arrivava dopo
tutto questo. Non si è mai saputo quanto dura un workout né quanti blocchi
sono. In fondo, quattro bottoni dello stesso peso e uno **schermo intero** di
anteprima dello sticker Instagram.

### Cosa c'è ora, nell'ordine in cui sta in pagina
1. **La testata** con due sole icone, e sono due **stati**: TV e cardio si
   accendono e si spengono *durante* l'allenamento. Tutto il resto — Duplica,
   Modifica, i tre export, Elimina — è nel menu delle tre puntine, che è un
   bottom sheet come il centro notifiche.
2. **Il titolo**, con la corsia di categoria, la data e l'intensità dichiarata
   come sovrascritta. Il logo è sparito: in una pagina di dettaglio non dice niente.
3. **L'esito**, solo per l'atleta che ha già finito. È la risposta alla domanda
   per cui si riapre la scheda di ieri, e prima era un bottone verde — cioè uno
   stato travestito da comando.
4. **Il riepilogo**: durata, blocchi, RPE. È **lo stesso componente** dello step 2
   del builder (`RiepilogoWorkout` di `CreaWorkoutUI`), barra proporzionale compresa.
5. **L'avviso sul riscaldamento**, con il testo **intero** (vedi sotto).
6. **I blocchi**, con la spina verticale di `TYPE_COLORS` e la durata in testa alla
   riga, come nel builder. Gli esercizi sono righe con nome, specifiche in
   monospazio e intensità in coda, non più testo che scorre.
7. Note del coach, vocale, note dell'atleta.
8. **L'elenco delle assegnazioni** (coach), che erano N card con N ombre.
9. **La barra fissa in basso**, che non dipende più da quanto è lunga la lista.

### ⚠️ Le sette cose da sapere prima di rimetterci mano
1. **La grafica Instagram deve restare RENDERIZZATA.** Esce dalla pagina, ma non
   si spegne: `html-to-image` clona un nodo vero, e con `display:none` o
   `opacity:0` l'export produce un'immagine **vuota**, senza un errore da nessuna
   parte. Si porta fuori schermo (`position:fixed; left:-10000px`), che è l'unico
   modo di nasconderla senza spegnerla. C'è un test che usa `toBeVisible`, ed è
   l'unica asserzione che cade su quella mutazione.
2. **La terza cella del riepilogo cambia significato.** Nel builder è l'**RPE
   atteso** — la stima del coach. Su un allenamento chiuso è l'**RPE dichiarato**
   dall'atleta. Sono due misure diverse, e sotto la stessa etichetta sarebbero la
   bugia peggiore della pagina: per questo `RiepilogoWorkout` ha `terzaCella`, che
   non è un'opzione di stile.
3. **Quel valore viene da `rpeDichiarato`, non da `parseNotesAndRpe`.**
   `parseNotesAndRpe` torna **5** quando il marcatore manca: è il valore giusto per
   il cursore della modale ed è un numero inventato per chiunque lo mostri come un
   dato. `athleteNote.dichiarato` porta il valore vero, o `null` → «—».
   È la stessa lezione di §9-octies.
4. **Il riepilogo non compare su Corsa, Custom ed Evento**, che non hanno blocchi
   da stimare: «0 min · 0 blocchi» sarebbe una bugia con l'aria di un dato — la
   stessa ragione per cui `DurataBlocco` scrive «—» invece di «0:00».
5. **I blocchi nascono APERTI**, e si tiene l'elenco dei *chiusi*. La scheda si
   legge mentre ci si allena: un esercizio dietro un tocco è un esercizio che si
   salta. WarmUp e Rest non si aprono affatto — non hanno niente dentro.
6. **La barra fissa ha l'offset della navbar**, non `bottom-0`: è `BarraAzioni` di
   `CreaWorkoutUI`, quindi vale la stessa nota di §9-undecies punto 7, e sparisce
   con la tastiera aperta per la stessa ragione (punto 8).
7. **`voice_note_url` è UNA colonna per una comunicazione bidirezionale**
   (§9-nonies punto 3): il verso lo dà il **ruolo di chi guarda**, non il dato.
   Il coach legge «Vocale per Marco», l'atleta «Vocale del coach».

### La riga sotto il nome del blocco è cambiata di forma, non di contenuto
`getBlockTitle` impacchettava nome, parametri e durata in una stringa sola
(«EMOM · 1:00 min x 24 rounds · 24 min») che a 393px andava a capo due volte.
Ora: il nome in testa, la didascalia di `BLOCK_HINT` accanto, la **durata a
destra** (da `durataBlocco` di `stimaWorkout`, la stessa del builder) e i soli
parametri nella seconda riga, in `src/lib/rigaBlocco.js`.
⚠️ I ripieghi di `sottotitoloBlocco` sono **gli stessi** di `durataBlocco` e di
`BlockPickerModal`: se qui si scrivesse «10 round» dove il timer ne conta 3, la
scheda mentirebbe senza dare nessun errore. C'è un test per ognuno.
`getBlockTitle` **resta**: la usano ancora il PDF e la story Instagram.

### 🔴 L'avviso sul riscaldamento: il TESTO non si tocca, la forma sì
La prima stesura del redesign lo aveva ridotto a una riga — «5-10 min di
mobilità prima di partire. Mai a freddo.» — con la logica che una card si salta
e una riga si legge. **Il committente lo ha rimesso per intero lo stesso
giorno**, e ha ragione: è l'unico avviso di sicurezza dell'app, e il riassunto
buttava via proprio la parte che spiega il *perché* (la gradualità, la
prevenzione degli infortuni). Il testo è quello, parola per parola, e c'è un
test che lo verifica intero.

Quello che è cambiato è la forma. Non più un rettangolo arancione piatto largo
quanto un blocco di lavoro, ma una carta sollevata con la sua luce, il titolo in
ambra calda e il corpo in grigio: il peso visivo di una **nota**, non di un
allarme. Un avviso che urla quanto il contenuto è un avviso che si impara a
saltare — ed era il difetto vero, non la lunghezza.

⚠️ Resta nascosto su **Evento** e **Custom**, com'era prima del redesign: la
regola è `type !== 'Event' && type !== 'Custom'` in `WorkoutDetail`, non dentro
il componente. Se un giorno lo si vuole ovunque, si cambia lì.

### 🔴 Il menu delle tre puntine: tre difetti che nessun errore segnalava
Segnalati dal committente il 28/08 provandolo sul telefono. Valgono per
**qualunque** bottom sheet futuro, e per questo il meccanismo sta in
`src/useBottomSheet.js` invece che dentro il componente.

1. **Non si apriva con un'animazione**, perché la classe che avrebbe dovuto
   farlo — `animate-in slide-in-from-bottom` — viene da **tw-animate-css, che
   non è installato**: genera zero CSS. È la trappola già annotata in
   `src/index.css` per l'eroe della Home, e si era ripresentata identica.
   Ora è il keyframe `.sheet-in`.
   ⚠️ **Non è un caso isolato**: quelle classi compaiono in **54 punti su 14
   file**, cioè quasi ogni modale del progetto crede di avere un'entrata e non
   ce l'ha. Verifica: `grep -c "animate-in" dist/assets/*.css` → **0**.
   Vedi BACKLOG #34 per le due strade possibili.
2. **La maniglia non faceva niente.** Era uno `span` decorativo. È il gesto che
   chiunque prova per primo su un foglio iOS. Ora è un `<button>` che si
   trascina (oltre `SOGLIA_CHIUSURA = 100` px chiude, sotto torna su) e che
   chiude anche a tocco secco.
3. **La pagina sotto continuava a scorrere.** ⚠️ Il blocco è
   `position: fixed` sul body, **non** `overflow: hidden`: su iOS il secondo
   non ferma il WKWebView. Il prezzo è che `position: fixed` azzera lo
   scorrimento, quindi la posizione va memorizzata e rimessa alla chiusura — o
   chiudendo il menu si torna in cima alla scheda. C'è un test per quello.

> ⚠️ **`.sheet-in` non ha `fill`, ed è deliberato.** Un'animazione con
> `fill: both` **vince sullo stile inline**: il foglio resterebbe fermo sotto il
> dito mentre lo si trascina — è lo stesso difetto documentato in §9-octies
> punto 1 sullo swipe della Home. E la classe va **tolta al primo contatto**:
> l'hook tiene uno stato `toccato` apposta. Senza, un trascinamento annullato
> riportava l'offset a 0, la classe tornava sull'elemento e **il foglio rifaceva
> l'animazione di apertura** invece di risalire al suo posto. Trovato scrivendo
> il test, non leggendo il codice.

### La data nell'elenco delle assegnazioni si stampa solo se diversa
Non è brevità. Su 393px, accanto al nome, alla pillola di stato e al cestino,
una data che ripete il titolo della pagina troncava proprio «RPE 8 · nota», che
è l'unica cosa per cui il coach guarda quella lista. Quando invece l'atleta è
programmato in un altro giorno, quello è il dato che conta — e non c'è nessun
altro posto che lo dica.

### Il codice morto che il rework ha lasciato indietro, ed è stato rimosso
`Section` ed `ExList` (in `WorkoutDetail.jsx`) non avevano più chiamanti:
cancellati invece di restare come la terza copia di qualcosa che nessuno chiama
(§9 punto 2). Nella stessa passata i due punti che scrivevano la coda offline con
un `JSON.parse(localStorage.getItem(...))` nudo sono passati ad
`accodaSuStorage`, che si ripara da sola e deduplica per allenamento (regola 0-bis).

### ⚠️ Un test che era verde per il motivo sbagliato
«L'elenco delle assegnazioni non si vede per l'atleta» **non falliva** rompendo
il codice: la guardia sul ruolo esiste in **due** punti — il fetch e il render —
e toglierne uno solo non cambia niente a schermo. Riscritto per verificare il
fetch (`chiamateA('athlete_workouts', 'select')` deve essere **una** sola),
che è anche la cosa che conta davvero: la scheda dell'atleta non deve scaricare
le assegnazioni di tutti gli altri. §9-sexies, di nuovo.

### Cosa NON è stato ridisegnato
Il corpo **Corsa** (`RunningList`), **Custom** ed **Evento** hanno preso la
cornice condivisa — testata, riepilogo saltato, barra fissa — ma non un nuovo
modo di elencare le fasi: l'artboard non li copre, e il `dv-next` dell'artboard
li dà per il prossimo pezzo di design. Non sono stati toccati nemmeno il
**timer** (`WorkoutTimer`), le modali di assegnazione, TV, eliminazione e RPE,
il **PDF** e la **story Instagram**: la scheda è la cornice, quelli sono i
contenuti, e cambiarli era un'altra decisione.

---

## 9-terdecies. Il rework della scheda atleta (28/08/2026)

Stesso progetto Claude Design degli altri quattro schermi
(`4a238081-a3ee-4f59-ae34-100f29d55601`), artboard `Scheda Atleta.dc.html`,
opzioni **5b** (coach) e **5c** (atleta, storico aperto). Come per gli altri
la logica non è stata riscritta: **nessun campo di Supabase cambia forma**,
gli stessi calcoli, le stesse note, lo stesso completamento con RPE. Cambia il
JSX e cambia l'ordine.

### Il problema, in una riga
La pagina apriva con il logo, poi una foto da 96px con quattro celle di
anagrafica, poi tre celle di settimana, poi tre tab — e il dato per cui il
coach entra qui, *sta seguendo il programma e con quanto carico*, era nella
**terza** tab, dietro due tocchi e quattro grafici che non si parlavano.

### Cosa c'è ora, nell'ordine in cui sta in pagina
1. **La testata**, con il solo menu delle tre puntine. ⚠️ Niente «indietro» sul
   proprio profilo: `/profile` è una voce della navbar, non una pagina in cui
   si è entrati da qualche parte. `TestataScheda` accetta perciò un
   `onIndietro` mancante — non è una svista del chiamante.
2. **L'identità**: foto a 56px, nome, i due social come icone da 15px accanto
   al nome, e l'anagrafica in **una riga** («29 anni · 178 cm · 74 kg · 96
   workout»). I campi vuoti spariscono invece di stampare «N/A»: una cella che
   dice «non lo so» occupava lo stesso spazio di una che dice qualcosa.
3. **L'eroe «come sta andando · 30 giorni»**: aderenza nell'anello, carico
   delle ultime quattro settimane accanto, e sotto **una frase** che dice a
   parole cosa dicono i due numeri insieme. È la frase su cui si decide se
   caricare o scaricare, ed è l'unica ragione per cui i due grafici stanno
   nella stessa card invece che uno sotto l'altro.
4. **Il bento**: Volume (minuti della settimana, scarto sulla precedente,
   sparkline a 4 settimane) e Sforzo (RPE medio, distribuzione sulle quattro
   fasce, quanti da 7 in su).
5. **Prossimo obiettivo**, che era un banner alto quanto una card, in una riga.
6. **Oggi**, **Prossimi allenamenti**, poi **Storico** e **Personal record**
   come righe che si aprono in pagina.
7. **La barra fissa** con Assegna e Crea — solo per il coach.

### ⚠️ Le sei cose da sapere prima di rimetterci mano

1. 🔴 **La finestra è la ragione per cui `src/lib/andamento.js` esiste.**
   `calcolaStatistiche` misura le settimane sulle ultime quattro e la
   distribuzione RPE su **tutto lo storico**: due orizzonti diversi sotto
   un'intestazione sola («30 giorni») sarebbero la bugia peggiore della pagina,
   perché **nessuno dei due numeri è sbagliato preso da solo**. `andamento.js`
   ricalcola lo sforzo sulla finestra dichiarata, e c'è un test che lo prende.
2. 🔴 **L'RPE medio viene da `rpeDichiarato`, non da `parseNotesAndRpe`.**
   Il secondo torna **5** quando il marcatore manca — giusto per il cursore
   della modale, un numero inventato per chiunque lo mostri come un dato. Un
   atleta che non compila mai l'RPE leggerebbe «5,0» come la propria media. È
   la stessa lezione di §9-octies e di §9-undecies punto 3.
3. **Il denominatore dell'anello sono gli ASSEGNATI dei 30 giorni**, non i
   workout in pagina. Contare anche quello programmato per dopodomani farebbe
   scendere l'aderenza di ogni atleta ogni volta che il coach gli programma
   qualcosa: un numero che peggiora quando si lavora meglio.
4. **Lo scarto del carico torna `null` quando la settimana prima è vuota.**
   `(5-0)/0` è la strada più breve per stampare «+Infinity%» in pagina, e una
   card che dice Infinity si legge come un guasto dell'app.
5. **«Prossimi allenamenti» NON è nell'artboard, e resta lo stesso.**
   L'artboard disegna una giornata e si ferma a «Oggi». Toglierli vorrebbe dire
   che il coach non vede più cos'ha assegnato senza aprire il calendario, e che
   l'atleta non sa cosa lo aspetta domani. C'è un test.
6. **La pillola «In pausa» resta nascosta all'atleta**, e il marcatore non si
   vede mai come testo: valgono parola per parola le regole di §9-decies. La
   pagina è ancora `/profile`.

### Cosa è uscito, e cosa NON è stato ridisegnato
Le **tre tab** («Diario», «Personal Record», «Statistiche») e le quattro celle
di anagrafica. Nessun dato è andato perso: i quattro grafici della tab
Statistiche sono l'anello, le barre del carico, lo sparkline del volume e la
barra delle fasce RPE. Il **calendario** (solo coach) è dentro «Storico
allenamenti», con il toggle Elenco/Calendario dov'era.

**Non** sono stati ridisegnati `WorkoutEntryCard` e `TodayAthleteWorkoutCard`:
l'artboard disegna righe compatte, ma quelle card portano la modifica della
nota, la nota vocale, l'eliminazione e il completamento con RPE. Sono il
prossimo pezzo di design, non un dettaglio di questo. Idem per le modali
(assegnazione, PR, modifica profilo, allenamento libero).

### Il codice morto che il rework ha lasciato indietro, ed è stato rimosso
`AthleteStatsTab`, `RpeBar` e `StatCard` in `AthleteDetail.jsx`, e
**`statisticheSettimana` in `src/lib/statistiche.js`** con i suoi test: la riga
di tre numeri che alimentava non esiste più, e `settimane.at(-1).time` è
esattamente lo stesso calcolo. Due sorgenti per un numero solo sono il modo in
cui i due si mettono a divergere (§9 punto 1). Il caso che valeva davvero — le
distanze contate come stima e non come minuti — è stato riscritto contro
`calcolaStatistiche`, non buttato.

### ⚠️ `montaPagina` ora accetta una rotta, e serviva
`montaPagina(elemento, { percorso, rotta })`. Senza, `useParams()` torna vuoto,
`AthleteDetail` ricade sull'id dell'utente loggato e **si crede sul proprio
profilo anche montata come coach**: niente barra fissa, niente «Come sta
andando» in terza persona. Un test così passa lo stesso, e verifica un'altra
pagina — §9-sexies, per l'ennesima volta.

---

## 9-quaterdecies. La tab bar dell'artboard 2b (28/08/2026)

### 🔴 I due artboard si contraddicono, e il navbar giusto è quello di 2b
`Home Coach.dc.html` (opzione **2b**) disegna una **capsula galleggiante**.
`Scheda Atleta.dc.html` (5b e 5c) disegna ancora la **barra piena** attaccata al
fondo, perché quell'artboard riusa il navbar precedente come sfondo di scena.
**Vale 2b**: è quello che il committente ha indicato, ed è l'unico dei due
disegnato *come* navbar invece che *sotto* una pagina.

⚠️ Chi apre `Scheda Atleta.dc.html` e confronta il codice con quel navbar
conclude che «corrisponde» ed è già successo: è il motivo per cui questa
sezione dice quale dei due comanda.

| | prima (fino al 28/08) | ora, artboard 2b |
|---|---|---|
| forma | barra piena a `bottom-0`, tutta larghezza | capsula `rounded-full`, `10px 12px 16px` d'aria intorno |
| fondo | `#0f0f11/70`, blur | `rgba(30,30,34,.88)`, blur **22** + saturate **170%**, ombra proiettata |
| voce attiva | pillola dietro icona **ed** etichetta | **cerchio** da 36px dietro la **sola** icona |
| «Workout» | icona `+` | **manubrio** |
| altezza | 64px + safe area | **99px** + safe area |

### 🔴 L'altezza della navbar era in SETTE punti scritti a mano
Ed è la vera conseguenza del cambio di forma, non la forma stessa. Erano:
`pb-16` in `App.jsx`, `pb-[calc(6rem+…)]` in `Home`, `Calendar`, `Athletes`,
`WorkoutsArchive`, `Settings`, e `bottom-[calc(4rem+…)]` in `BarraAzioni`.
Hanno coinciso **per caso** finché la barra è stata alta 4rem. Passando a 99px
sarebbero servite sette modifiche coordinate, e la prima dimenticata avrebbe
nascosto del contenuto sotto la barra **senza dare nessun errore a schermo** —
il difetto che si nota solo quando un utente non riesce a premere l'ultimo
bottone di una pagina.

Ora c'è `--altezza-navbar` in `src/index.css`, più `--fondo-pagina` che le
aggiunge il respiro. **Chi cambia la forma della navbar cambia quel numero, e
basta.** Le tre pagine con la barra fissa (`CreateWorkout`, `WorkoutDetail`,
`AthleteDetail`) usano `pb-[var(--altezza-navbar)]`, le altre cinque
`pb-[var(--fondo-pagina)]`.

⚠️ **Il numero è misurato, non calcolato.** Il primo tentativo diceva 94px
contando l'etichetta come 13px invece della sua riga di testo; misurata, la
barra è 98,75px. Si rimisura con la navbar a schermo:
```js
document.querySelector('nav').parentElement.getBoundingClientRect().height
```

### ⚠️ Tre dettagli che non sono rifinitura
1. **`pointer-events-none` sul contenitore, `auto` sulla capsula.** Il
   contenitore è largo quanto lo schermo, la capsula no: senza, i pixel ai lati
   intercetterebbero i tocchi diretti alla pagina sotto.
2. **Il cerchio dietro l'icona esiste sempre, anche spento.** Se comparisse solo
   sull'attiva, le voci si sposterebbero di 36px a ogni cambio di scheda.
3. **Il manubrio è un SVG locale, non `Dumbbell` di lucide.** Quello di lucide è
   diagonale con i dischi esagonali, e accanto a `Home`, `Calendar` e `Users` —
   tutte forme diritte e sottili — è l'unica icona che non sta sull'orizzontale.
   È la stessa eccezione già fatta per `InstagramIcon`: lucide è la convenzione,
   non un vincolo.

### Cosa NON è stato implementato, e perché
Il **badge numerico** sulla voce «Atleti» (nell'artboard: un `3` giallo). Il
numero non esiste: `Navbar` è renderizzata da `App.jsx` fuori da ogni pagina e
non ha accesso ai dati, e l'unico candidato sensato — gli atleti che richiedono
attenzione — richiederebbe una query su **ogni** pagina dell'app per una
decorazione. Metterci un numero che non significa niente è peggio che non
metterlo: è la stessa regola del `rpeAtteso` che torna `null` invece di 5.
Voce in BACKLOG.

---

## 9-quindecies. Il foglio «Genera con IA» (28/08/2026)

Richiesta del committente, provando il builder sul telefono: la modale dell'IA
era rimasta l'unica superficie di «Crea Workout» con il vocabolario di prima —
card centrata, bordo `#333`, bottone pieno in fondo — in una pagina dove tutto
il resto è carta sollevata, vetro e barra ancorata. Con la grafica sono venuti
fuori altri due difetti, ed **entrambi erano già documentati altrove**.

### Cosa c'è ora
Un **bottom sheet**, lo stesso di `MenuScheda` e del centro notifiche: sale dal
basso, si trascina per la maniglia, e la pagina sotto non scorre. Dentro, la
testata ripete l'icona e la riga della `CardIA` che ha aperto il foglio, poi il
campo di testo, il microfono come **riga intera** e la CTA viola.

### ⚠️ Le tre cose che non sono estetica
1. 🔴 **L'entrata non esisteva.** La classe era `animate-in fade-in
   zoom-in-[0.96] duration-300`, cioè `tw-animate-css`, che **non è
   installato**: zero CSS generato. È la seconda volta che lo stesso difetto si
   presenta — la prima era il menu della scheda (§9-duodecies) — ed è la ragione
   per cui BACKLOG #34 non è una voce cosmetica: ogni modale del progetto crede
   di avere un'entrata e non ce l'ha. Ora è `useBottomSheet`, quindi il keyframe
   `.sheet-in` di `src/index.css`.
2. **La tastiera non sale più da sola.** L'`autoFocus` sul textarea la apriva su
   una superficie il cui gesto principale è il **microfono**: si arrivava qui
   per dettare e si trovava mezzo schermo occupato. Con l'autoFocus se n'è
   andato anche `-translate-y-36`, che era il rimedio a un problema che non
   esiste più: il foglio è ancorato in basso e con `Keyboard.resize: 'native'`
   la webview si rimpicciolisce, quindi resta sopra la tastiera da sé.
3. 🔴 **L'alone del microfono era `Math.random()`.** `1 + Math.random() * 0.4`
   ogni 150ms: pulsava identico a microfono muto, permesso negato o telefono in
   tasca — cioè diceva «ti sento» **proprio quando non era vero**. Ora i livelli
   arrivano dal microfono, con lo stesso `AudioVisualizer` delle note vocali.

### 🔴 La forma d'onda si muoveva in un angolo, e nessuno l'aveva mai misurato
Segnalato dal committente il 28/08 («voglio il waveform o qualcosa che mi faccia
capire che la voce viene letta»), e la causa era in `AudioVisualizer`, cioè
**anche nelle note vocali**, da sempre. Due difetti sovrapposti:

1. **Un terzo delle bande finiva fuori dal canvas.** Il passo era
   `(larghezza / bande) * 1.5`: con 32 bande su 200px la `x` arrivava a 300, e
   le ultime undici non si vedevano. Nessun errore: l'onda sembrava corta.
2. **La voce occupava il primo sesto dello spettro.** L'analizzatore copre metà
   della frequenza di campionamento — con 48 kHz sono **24 kHz** — divisi in
   parti uguali fra le bande. Con `fftSize 64` ogni banda vale 750 Hz, e il
   parlato (80 Hz – 4 kHz) stava tutto nelle **prime quattro barre**: le altre
   ventotto erano piatte comunque si parlasse. Ora `fftSize 256` (bande da
   ~187 Hz) e si disegnano le prime `BANDE_VOCE = 24`, distribuite su **tutta**
   la larghezza. La media per `onLivello` si calcola sulle stesse: mediata su
   24 kHz di silenzio non si sarebbe mossa nemmeno gridando.

3. **Era disegnata a un terzo della densità dello schermo.** Il canvas aveva
   `width` fisso a 200 e veniva stirato dal CSS: su un iPhone 3x è un upscale
   da 200 a oltre 1000 pixel fisici. Ora la risoluzione segue la misura reale
   del box per `devicePixelRatio`, e si rimisura al `resize`.

⚠️ Tutte e tre valgono anche per la forma d'onda **gialla** delle note vocali,
che aveva esattamente lo stesso comportamento. Non è un effetto collaterale: è
lo stesso componente, ed è la ragione per cui è uno solo (§9 punto 1).

### La forma: speculare dal centro, non da sinistra a destra
Terzo giro di rifiniture, sempre del 28/08 («il waveform possiamo farlo
graficamente più carino»). Il punto non era la palette: **l'energia di una voce
decresce con la frequenza, sempre**, quindi disegnata in ordine dà una scala
discendente identica a ogni parola — informativa, ma sembra un grafico. Ora le
prime `BANDE_DISEGNO = 13` bande sono **rispecchiate** attorno alla più bassa
(25 barre), che è la sagoma che si legge come «qualcuno sta parlando» e che si
gonfia e sgonfia con le sillabe. Con lei: barre a pillola con i capi tondi e
minimo un pallino invece di una scheggia da 2px, `smoothingTimeConstant` per
togliere il tremolio, una curva sotto 1 sull'ampiezza (l'orecchio sente in
logaritmico), e un gradiente pieno al centro e sfumato ai bordi.

⚠️ `COMPENSO` alza le bande alte, che sono naturalmente più deboli: senza, le
barre esterne non si muovono mai e la sagoma è una gobba immobile. **Va tenuto
basso**: al primo tentativo era `0.16` e saturava tutto — venticinque barre
tutte al massimo, cioè di nuovo nessuna informazione.

### 🔴 «Non arriva nessun suono»: la riga che distingue funziona da morto
Un'onda ferma si legge come «sto zitto io», **mai** come «il microfono non
riceve». Dopo `SECONDI_MUTO` senza che il livello abbia mai superato la soglia,
il foglio lo dice e indica dove guardare (vicinanza al microfono, permesso iOS).
Senza, ci si accorge del microfono spento **dal workout generato a caso**.
`haSentito` non si azzera durante la dettatura, di proposito: serve a separare
«ora sto zitto» da «non ha mai funzionato», che a schermo sono la stessa
immagine.

#### 🔴 E alla prima prova accusava il microfono mentre lo sentiva
Segnalato dal committente lo stesso giorno. Due cause che si sommavano, ed
**entrambe stanno in come si misura il livello**, non nella soglia:

1. **Era la MEDIA su 24 bande.** Una voce non riempie lo spettro: sta nelle
   prime bande e lascia a zero tutte le altre, che trascinano giù la media.
   Con 70 su 4 bande — una voce normale — la media vale 0,046, cioè **sotto**
   la soglia di 0,05, mentre il picco vale 0,27. Ora si riporta il **picco**.
2. **Era il campione dell'ISTANTE**, preso ogni 100ms: poteva cadere fra due
   sillabe. Ora è il picco **della finestra**, azzerato a ogni avviso.

E le soglie sono diventate **due**, che è la parte che conta di più:
`SOGLIA_VOCE` accende l'etichetta «Ti sento» e deve seguire il parlato;
`SOGLIA_SEGNALE`, molto più bassa, decide soltanto se il microfono è vivo. Un
avviso che **accusa** il microfono deve avere l'asticella dove la mette un
guasto vero, non dove la mette chi parla piano — ed è esattamente il caso che
il terzo test copre. `SECONDI_MUTO` è salito a 6 per la stessa ragione: un
falso allarme costa più del silenzio che previene, perché chi legge «non ti
sento» mentre lo si sente smette di credere all'avviso.

⚠️ E quando l'analizzatore non c'è affatto, la forma d'onda **non si finge** —
ma il foglio non resta muto: barre che pulsano da sole (che non dichiarano un
livello) più il **cronometro**, che è l'unica cosa vera rimasta. La prima
stesura scriveva solo «senza forma d'onda», che è un vicolo cieco.

### 🔴 Fermata la registrazione, non si capiva di dover aspettare
Secondo rilievo del committente, lo stesso giorno. Fermato il microfono, Gemini
deve prima **ascoltare** e poi scrivere: sono secondi in cui a schermo non
succede niente. Il foglio tornava al campo di testo — **vuoto**, perché sul
nativo la trascrizione non esiste ancora — e l'unico segnale era la CTA
disabilitata al 40%. Si leggeva come «non ha funzionato», e il gesto che ne
seguiva era premere di nuovo il microfono, cioè buttare la registrazione appena
spedita.

Ora la generazione **occupa il foglio intero**: rotella, «Sto scrivendo
l'allenamento», una riga che dice cosa sta succedendo e «Non chiudere».
Tre dettagli che non sono decorazione:
- **La CTA sparisce, non si spegne.** Un bottone spento accanto a un'attesa è il
  modo in cui l'attesa sembra un errore.
- **Il foglio non si chiude**: velo inerte e maniglia disabilitata. Chiudere lì
  butterebbe via una registrazione già spedita, in silenzio.
- **Dopo `MS_ATTESA_LUNGA` (9s) il testo cambia** in «Ci sta mettendo più del
  solito…». Toglie l'unica domanda che resta, cioè se si sia bloccato.
- ⚠️ **La riga sotto il titolo dipende da dove arriva l'attesa**: dalla voce
  («ascolto la registrazione») o dal testo («leggo la descrizione»). Sono due
  lavori diversi, e dirlo storto fa sembrare rotta un'attesa che sta andando
  bene.

### 🔴 Su iOS l'audio della dettatura lo registra MediaRecorder, non il plugin
È la stessa lezione delle note vocali (§4), applicata a un percorso che era
rimasto indietro: `capacitor-voice-recorder` è un plugin diverso da
`@independo/…`, ma la contesa su `AVAudioSession` è la stessa — e la forma
d'onda ha bisogno di `getUserMedia`, che è esattamente ciò che il plugin non
sopporta. Quindi: si apre sempre lo stream, e se `MediaRecorder` sa produrre un
formato che Gemini legge, registra lui.

⚠️ **`FORMATI_AUDIO` non è un elenco di preferenze, è un vincolo.**
`ai-workout` gira l'audio a Gemini come `inlineData`, e Gemini **non legge
`audio/webm`** — che è ciò che MediaRecorder produce su Chrome desktop. Su iOS
`audio/mp4` è supportato ed è quello che si usa; sul web si continua a passare
per il riconoscimento del browser, che riempie il campo di testo. Se un giorno
si volesse spedire l'audio anche dal web, il pezzo che manca è una conversione,
non una riga in più in quell'elenco.

⚠️ **Nel ripiego col plugin lo stream si CHIUDE prima di partire.** Tenerlo
aperto è la condizione precisa che nel 2026 ha prodotto per due mesi un M4A di
557 byte senza un errore da nessuna parte (§4).

### I dieci test, e i tre che erano verdi per il motivo sbagliato
`src/pages/__tests__/CreaWorkoutIA.test.jsx` monta `CreateWorkout` **vera**.
Tutti e dieci verificati per mutazione, e **tre** sono stati riscritti o aggiunti
perché la mutazione li superava:
- «il foglio non si chiude durante la generazione» passava anche con la maniglia
  attiva: l'uscita è un'animazione, e il test guardava se il foglio fosse
  sparito all'**istante zero** — cioè niente. Ora aspetta 450ms.
- «se non arriva nessun suono lo dice» passava anche rompendo del tutto il
  riconoscimento del livello: quel test è già in silenzio, quindi non poteva
  accorgersene. Serviva il **complemento** — con un analizzatore finto SONORO
  (`mockVolume`), l'avviso non deve comparire e si deve leggere «Ti sento».
- e nemmeno quello bastava: con un finto microfono **forte**, anche una soglia
  sola passa. Serviva il terzo caso, la **voce piana** — sopra `SOGLIA_SEGNALE`
  e sotto `SOGLIA_VOCE` — che è il difetto vero e l'unico che prende la
  mutazione «una soglia sola».

È la terza volta che succede in questo progetto (§9-sexies): un test verde non
dice niente finché non lo si è visto fallire.

⚠️ In jsdom `AudioContext` e il contesto 2D del canvas non esistono, e il
disegno gira dentro un `requestAnimationFrame`: senza i due finti in testa al
file, l'errore esce **fuori** dallo stack del test e sembra un guasto d'altro.

### AudioVisualizer ha quattro parametri nuovi, e nessuna copia in più
`colore`, `altezza`, `larghezza` e `onLivello`, tutti facoltativi:
la dettatura è viola e più alta delle note vocali, e l'alone ha bisogno del
livello **in React**, non solo sul canvas. Una seconda copia viola sarebbe stata
il modo in cui le due si mettono a divergere (§9 punto 1).
⚠️ `onLivello` avvisa al massimo ogni 100ms: a 60fps sarebbe un render ogni
16ms per un alone.
⚠️ `larghezza` è la **risoluzione** del canvas, non la sua misura a schermo —
quella la decide la classe. Era fissa a 200 e su una card larga il disegno
veniva stirato, visibile appena la forma d'onda supera i 32px d'altezza.

---

## 9-sedecies. Il rework dell'archivio (31/08/2026)

Stesso progetto Claude Design degli altri cinque schermi
(`4a238081-a3ee-4f59-ae34-100f29d55601`), artboard `Archivio Workout.dc.html`,
opzione **1b**. Come per gli altri: **nessun campo di Supabase cambia forma**,
le due query restano quelle di prima. Cambia il JSX, cambia l'ordine, e per la
prima volta la pagina dice dei numeri.

### Il problema, in una riga
Era una lista piatta di card identiche ordinate per data di **creazione**, senza
raggruppamenti e senza scala: con dieci workout funziona, con i 171 in
produzione è uno scroll cieco. L'unico strumento di riduzione era un campo di
testo — se non ricordavi il titolo esatto, non avevi una strada.

### Cosa c'è ora
1. **Una testata sola.** Erano due `h1` (il logo FLEOFIT e «Archivio Workout»)
   più un sottotitolo che ripeteva il titolo: tre righe prima di vedere un
   workout, su una schermata che si raggiunge da un link chiamato «Archivio».
   Ora è «Archivio» più una riga in monospazio che dice la scala — «128 workout
   · 3 corsie» — e che **sotto filtro cambia domanda**: «12 di 128 workout», che
   è l'unica cosa che resta da sapere quando la lista si accorcia sotto le dita.
2. **La ricerca è diventata un filtro.** Una fila di chip per corsia con il
   conteggio dentro: si riduce con un tocco, senza digitare.
3. **Il tempo dà la struttura.** I workout si raggruppano per mese, con
   l'intestazione in monospazio e il conteggio a destra.
4. **Righe dense.** 60px: spina di corsia, titolo, meta compresso e a destra il
   numero degli assegnati come **cifra**. La categoria è la spina, non un chip.

### ⚠️ Le sette cose da sapere prima di rimetterci mano

1. 🔴 **L'ordine è cambiato, ed è il raggruppamento a pretenderlo.** La query
   torna per `created_at`, ma la data **mostrata** è un'altra (`workouts.date`
   per il coach, `completed_date` per l'atleta). Finché la lista era piatta la
   differenza non si vedeva; i gruppi per mese pretendono che le date siano
   monotone, o lo stesso mese ricompare in tre punti dello scroll. `ordinaPerData`
   ordina per la data mostrata e tiene `created_at` come **spareggio**.
   ⚠️ La `Map` di `raggruppaPerMese` deduplica le chiavi da sé, quindi un test
   scritto con l'elemento più recente in testa **passa anche senza ordinare**:
   il caso che prende la mutazione ha il workout di luglio per primo (§9-sexies,
   di nuovo — è successo scrivendo questi test).
2. 🔴 **I chip si DERIVANO dai dati, non si scrivono a mano.** La query del
   coach esclude Custom ed Evento (`fetchWorkouts`), quindi un chip «Libero»
   fisso sarebbe sempre a zero — un filtro che non filtra niente e che, premuto,
   svuota la pagina. `conteggiPerCorsia` produce solo le corsie che hanno
   qualcosa dietro, e sotto le due corsie i chip non compaiono affatto.
3. 🔴 **Su una corsa mista non si dichiara nessun totale.** «400m di corsa e
   1 min di recupero» ha **due** totali veri e nessuno dei due è la lunghezza
   dell'allenamento: sommarli darebbe un numero plausibile e inventato, che è il
   caso peggiore. Lì la riga dice solo «8 fasi». Il totale compare quando tutte
   le fasi parlano la stessa unità.
   ⚠️ E `riepilogoCorsa` **non usa `parseDuration`**: quella toglie le lettere e
   legge il numero come minuti, quindi «400m» diventa 6h40m (BACKLOG #29). Su
   una scheda si nota; in una riga larga 200px diventa un «400′» che nessuno
   mette in dubbio.
4. **Le durate vengono da `stimaWorkout`**, la stessa funzione del riepilogo del
   builder e di quello della scheda. Se l'archivio dicesse «52′» dove la scheda
   dice «48′», nessuno dei due numeri sarebbe sbagliato da solo e non ci sarebbe
   modo di accorgersene.
5. **Custom ed Evento dicono solo il giorno.** Non hanno blocchi da contare né
   una durata da stimare, e «0 blocchi · 0′» sarebbe una bugia con l'aria di un
   dato — la stessa regola di `DurataBlocco` (§9-undecies punto 2).
6. **La colonna di destra è la stessa e le domande sono due.** Il coach vede a
   quante persone ha dato quel workout, l'atleta se l'ha fatto: a decidere è il
   ruolo di chi guarda, come il verso della nota vocale (§9-duodecies punto 7).
   ⚠️ Non è solo nascosto: la query dell'atleta **non carica** `athlete_workouts(id)`,
   quindi mostrare il contatore vorrebbe dire stampare `0` a tutti.
7. **L'intestazione del mese NON è appiccicata**, e non è una dimenticanza.
   Sarebbe dovuta stare a `top-<altezza della testata>`, ma quell'altezza cambia
   — il sottotitolo può mancare, i chip essere due o cinque — e un `top`
   sbagliato non dà errore: incolla l'intestazione a metà dei filtri. La testata
   **sì**, perché su una schermata di sola lista i filtri sono l'unico comando
   che c'è: se scorrono via, per cambiare corsia si deve risalire tutto lo
   scroll appena fatto, cioè proprio quando la lista è lunga.
   ⚠️ La safe area la porta la testata, non la pagina: un `pt` sul contenitore
   lascerebbe scorrere il contenuto sotto la barra di stato.

### 🔴 Il difetto latente che il rework ha chiuso
Il filtro faceva `w.title.toLowerCase()` **nudo**. `workouts.title` può essere
`null` sui workout anteriori al titolo automatico del 24/08/2026 (§5), e un
`null` lì dentro non svuotava la ricerca: si portava via la pagina intera.
Ora il testo cercabile si costruisce con `filter(Boolean)`, e la riga senza
titolo si chiama «Senza titolo».

### La ricerca ora mantiene quello che il placeholder promette
Il campo diceva «Cerca per nome o categoria» e cercava esattamente quelli. Il
placeholder dell'artboard dice «Cerca titolo, blocco, esercizio», e
`testoCercabile` è la ragione per cui non è una promessa a vuoto: scandaglia
tipi di blocco, nomi degli esercizi, note e ritmi.
⚠️ L'indice si costruisce **una volta per lista** in un `useMemo`, non a ogni
tasto premuto: sono 171 workout da scandagliare nel jsonb.

### Cosa NON è stato implementato, e perché
- **Il pannello «filtri avanzati»** dell'icona in alto a destra. L'artboard la
  disegna e il suo stesso `dv-next` la dà per il prossimo pezzo di design: il
  pannello non esiste. Un bottone che non fa niente **accanto a filtri che
  funzionano** è peggio che non averlo — è la stessa regola del badge numerico
  sulla navbar (§9-quaterdecies) e del `rpeAtteso` che torna `null` invece di 5.
- **La voce «Archivio» nella tab bar.** L'artboard 1b la disegna, ma è lo stesso
  caso di `Scheda Atleta.dc.html`: il navbar dell'artboard è **sfondo di scena**,
  non un pezzo di design. La navbar vera non ha quella voce (§9-quaterdecies),
  e l'archivio si raggiunge dalla Home.

### I file nuovi
`src/lib/rigaArchivio.js` (logica pura, 30 test) e
`src/components/ArchivioUI.jsx` (sola presentazione), più `CARTA_RIGA` in
`lib/stiliCard.js`: la carta sollevata in formato riga, raggio e ombra
proporzionati a 60px invece che a una card intera.
⚠️ È una **costante nuova** e non `CARD` con il raggio sovrascritto:
`rounded-2xl` e `rounded-[22px]` hanno la stessa specificità, e a decidere è
l'ordine nel foglio di stile, non l'ordine nella stringa di classi.

---

## 9-septdecies. Il rework della rubrica atleti (31/08/2026)

Stesso progetto Claude Design degli altri sei schermi
(`4a238081-a3ee-4f59-ae34-100f29d55601`), artboard `Atleti.dc.html`, opzione
**1b**. Come per gli altri: **nessun campo di Supabase cambia forma**. Cambia il
JSX, cambia l'ordine, e la pagina fa **una lettura in più** — una sola — per
poter dire un numero.

### Il problema, in una riga
Era una rubrica, non uno strumento di lavoro. Ogni riga mostrava nome, peso,
altezza ed età: dati anagrafici, che si consultano una volta al mese. Il coach
apre questa schermata per sapere **chi sta seguendo il piano e chi si è
fermato**, e quella informazione non c'era — bisognava entrare in ogni scheda,
una per una. Chi era in pausa restava mescolato agli attivi, distinto da un chip
arancione, e la lista non era divisibile: con venti atleti si scorreva tutto per
trovare i tre fermi. Il cestino era un accordion in fondo alla pagina, con il
conteggio fra parentesi nel testo del bottone.

### Cosa c'è ora, nell'ordine in cui sta in pagina
1. **La testata appiccicata**, con «Atleti», la scala in monospazio
   («14 attivi · 2 in pausa») e la CTA «Nuovo». Sotto di essa la ricerca e i
   **chip di stato** — Attivi · In pausa · Eliminati, con il conteggio dentro —
   che restano fermi mentre la lista scorre. Niente «indietro»: è una voce
   della navbar, non una pagina in cui si è entrati.
2. **La fascia «Da richiamare»**, l'unico blocco con bordo colorato della
   pagina. Porta alla lista già filtrata, e un secondo tocco la richiude.
3. **«Settimana in corso»**, con le righe degli attivi: avatar, nome, meta
   anagrafico compresso in monospazio, e a destra **completati / assegnati**
   della settimana più una tacca per allenamento previsto — piena se fatto,
   vuota se manca.
4. **«In pausa»**, in fondo e senza peso visivo.

### ⚠️ Le sette cose da sapere prima di rimetterci mano

1. 🔴 **Gli atleti fermi NON si calcolano qui.** Li dà `atletiFermi` di
   `statisticheCoach.js`, la stessa funzione con la stessa `GIORNI_FERMO` che
   alimenta «Richiedono attenzione» nella Home coach — e anche il testo della
   fascia si compone da quella costante, invece di scrivere «7 giorni» a mano
   come faceva l'artboard. Due soglie darebbero due numeri diversi per lo stesso
   concetto in due schermate della stessa app, e **nessuno dei due sarebbe
   sbagliato da solo**: è il difetto impossibile da notare.
2. 🔴 **L'allarme della riga viene da `atletiFermi`, non dalla frazione.** Gli
   assegnati comprendono i giorni **ancora da venire** della settimana — il
   martedì, il workout di venerdì è già programmato e fa parte del piano —
   quindi il lunedì mattina sono tutti a 0/N. Legare il colore alla frazione
   dipingerebbe di arancione l'intera rubrica ogni lunedì: un allarme che si
   accende quando non è successo ancora niente.
   ⚠️ L'allarme sta anche nell'`aria-label` («· da richiamare»), non solo nel
   colore: chi legge con VoiceOver non ha modo di sapere che la frazione è
   arancione, ed è l'unica informazione della riga che chiede un'azione.
3. 🔴 **Chi non ha niente in programma scrive «—», non «0/0».** Un atleta senza
   assegnazioni non è a zero di aderenza: non c'è ancora niente da misurare, e
   «0/0» con la barra vuota si legge come un fallimento — cioè un allarme per
   qualcuno a cui il coach semplicemente non ha ancora dato niente. È la stessa
   regola di `DurataBlocco` («—» invece di «0:00») e di `rpeAtteso` (`null`
   invece di 5).
4. 🔴 **La settimana comincia di LUNEDÌ** (`weekStartsOn: 1`). Con il default di
   `date-fns` la **domenica** cadrebbe nella settimana successiva, e l'atleta si
   vedrebbe azzerare la frazione la sera della domenica — l'unico momento in cui
   il piano della settimana è finalmente completo. È anche la settimana con cui
   il coach programma e quella su cui la Home atleta disegna l'anello: due
   settimane diverse darebbero due «3 su 5» che non coincidono.
5. **Gli atleti in pausa RESTANO nella lista principale**, in una sezione loro
   sotto gli attivi. Non è una svista dei chip: CLAUDE.md §9-decies dice che la
   rubrica è **l'unico posto** in cui il coach si accorge di averne messo in
   pausa uno e dimenticato. Sparisce dagli allarmi, non dalla lista. Il chip
   «In pausa» serve a vedere solo loro.
6. **La riga in pausa dice DA QUANDO, mai «rientro previsto».** `[PAUSA: …]`
   registra il giorno in cui la pausa è cominciata; una data di rientro non
   esiste da nessuna parte nei dati, e l'artboard la disegna. Stamparla sarebbe
   un dato plausibile e inventato. Quando la data manca, `etichettaPausa` torna
   `null` e la seconda riga sparisce: la pillola accanto dice già «Pausa».
7. **Il conto alla rovescia del cestino è corto di proposito.** «Cancellazione
   fra 5 giorni», accanto al bottone Ripristina su 393px, finiva troncato in
   «Cancellazione fra 5…» — e il numero tagliato è l'unica cosa per cui si apre
   quella vista: «fra 1…» e «fra 10…» diventavano la stessa riga. Ora è
   «Fra 5 giorni» / «Stanotte», e cosa sia il conto lo dice l'intestazione
   della sezione. **Trovato guardando la pagina a 393px, non leggendo il
   codice**: nessun test lo avrebbe preso.

### Una query in meno, non una in più
La pagina faceva **due** `select` su `athletes` — una con `deleted_at is null`,
una con il filtro complementare — cioè due round trip per una lista di dodici
righe che si divide in due con un `filter`. Ora è una sola, più **una** su
`athlete_workouts` sulla finestra `[oggi − 45, fine settimana]`, senza join sui
`workouts`: qui non serve nemmeno un titolo, e `sections` è la colonna più
pesante del database. Quella finestra serve due domande insieme — chi è fermo
guarda indietro, l'aderenza guarda la settimana in corso, che finisce nel futuro.

⚠️ `caricatoIl` si fissa **quando i dati arrivano**, e da lì dipendono l'età,
la settimana in corso, chi è fermo e il conto alla rovescia del cestino: cioè
quasi tutta la pagina. `Date.now()` durante il render darebbe conteggi diversi a
due render consecutivi. Era già la correzione fatta il 26/08 sul solo cestino
(§9-septies); ora vale per tutto.

### Cosa NON è stato ridisegnato, e perché
La modale **«Nuovo Atleta»** è rimasta com'era: l'artboard non la copre, e il
suo `dv-next` la dà fra i prossimi pezzi di design. Vale la stessa scelta fatta
per le modali della scheda atleta e della scheda workout — la pagina è la
cornice, quelle sono i contenuti.
Non è stato implementato il **pannello dei filtri avanzati** né alcun bottone
che non faccia niente: stessa regola del badge numerico sulla navbar
(§9-quaterdecies).

### I file nuovi, e i due riusati
`src/lib/rigaAtleta.js` (logica pura, 33 test) e `src/components/AtletiUI.jsx`
(sola presentazione). Da `ArchivioUI` arrivano **`CampoRicerca`** — reso
parametrico su placeholder ed etichetta, con i default dell'archivio, così il
suo chiamante non cambia — e **`IntestazioneSezione`**, che si chiamava
`IntestazioneMese`: nell'archivio raggruppa per mese, nella rubrica per stato,
ed è la stessa riga in entrambi i casi. Una seconda copia sarebbe stata il modo
in cui le due cominciano a divergere di un raggio (§9 punto 1).

---

## 9-octodecies. Il rework del calendario (31/08/2026)

Stesso progetto Claude Design degli altri sette schermi
(`4a238081-a3ee-4f59-ae34-100f29d55601`), artboard `Calendario.dc.html`,
opzione **1b**. Come per gli altri: **nessun campo di Supabase cambia forma**.
Cambia il JSX, cambia l'ordine, e per la prima volta la pagina dice dei numeri
— con la cautela che quei numeri richiedono.

### Il problema, in una riga
La griglia occupava metà schermo e trasmetteva **un solo bit per giorno**: ci
sono pallini o non ce ne sono. Non distingueva il fatto dal programmato, non
diceva il carico, e i tre pallini da 6px si perdevano. Sopra di essa c'erano
due titoli (il logo `FLEOFIT` e il mese) e **cinque bottoni tutti uguali** —
precedente, Oggi, successivo, cerca, aggiungi — di cui l'unico irreversibile
era l'unico giallo, ma in fila con gli altri come se pesasse uguale. E le card
del giorno riempivano lo spazio con i **nomi degli esercizi** («Air Squat»,
«4 blocchi»), cioè con il contenuto — che è la ragione per cui si apre una
scheda, non quella per cui si decide di aprirla.

### Cosa c'è ora, nell'ordine in cui sta in pagina
1. **La testata**: l'anno nell'occhiello in mono, il mese in grande, e due soli
   comandi — cerca e aggiungi. Il logo è sparito: in una pagina raggiunta da
   una voce di navbar chiamata «Calendario» non dice niente.
2. **La carta del mese**, che tiene insieme navigazione, legenda, griglia e
   sintesi: prima erano quattro blocchi slegati sulla pagina nuda.
3. **Celle a due livelli**: il numero e, sotto, una barra-corsia colorata per
   categoria e verde se l'allenamento è chiuso. Il mese si legge come un
   pattern di carico invece che come puntini.
4. **La fascia di sintesi**: tre numeri che dicono com'è andato il mese prima
   di doverlo leggere giorno per giorno.
5. **Il giorno scelto**: la data, quante sessioni e quanti minuti, e le righe —
   con i dati della decisione (durata, blocchi, stato, RPE) invece dei nomi
   degli esercizi.

### ⚠️ Le sette cose da sapere prima di rimetterci mano

1. 🔴 **Le prime due celle della fascia misurano lo STESSO insieme.** Per
   l'atleta la coppia dice «14 di 18 fatti, 11 ore di lavoro» — e le ore sono
   quelle dei 14. Per il coach **non esiste nessun «fatto» nei suoi dati**: la
   sua query legge `workouts`, che non ha una colonna di stato, quindi un
   «Completati» per lui leggerebbe 0 su 18 per sempre. La sua coppia dice
   «18 programmati» e le ore di quei 18. `soloCompletati` è il parametro che
   tiene i due orizzonti allineati: due orizzonti sotto un'intestazione sola
   sarebbero la bugia peggiore della fascia, perché **nessuno dei due numeri
   sarebbe sbagliato preso da solo** (è la lezione di `andamento.js`,
   §9-terdecies punto 1).
2. 🔴 **Il volume dice `≈` quando ha dovuto lasciare fuori qualcosa, e `—`
   quando non c'è niente da misurare.** `minutiWorkout` torna **`null`, non
   zero**, su Custom, Evento e sulle corse misurate in **distanza**: «18 km»
   non ha minuti finché non si assume un passo, e assumerlo vorrebbe dire
   inventarlo. Se tornasse zero, quella corsa sparirebbe dentro un «11 h» che
   ha tutta l'aria di essere completo. Il `≈` è un glifo solo, ed è l'unico
   modo di dire «questo totale è parziale» in una cella larga quanto un numero.
3. 🔴 **«Oggi» e «selezionato» sono due stati distinti e devono restarlo.** Nel
   calendario di prima erano quasi lo stesso — un riempimento pieno contro un
   grigio appena più chiaro — e all'apertura il giorno corrente spariva sotto
   la selezione. Ora oggi è un **anello**, il selezionato il riempimento giallo
   con l'ombra: coesistono sulla stessa cella senza annullarsi.
   ⚠️ L'anello non è un colore di categoria, ed è deliberato: il **bianco è già
   la corsia «Gara»**, e usarlo come riempimento della barra renderebbe
   indistinguibili «oggi» e «oggi c'è una gara».
4. 🔴 **Il bordo ambra di una riga vuol dire «DA FARE», non «riga».** Legato al
   semplice «non è chiuso», la lista del coach diventava tutta ambra — un
   allenamento di corsa incorniciato di giallo, contro la Regola della Corsia —
   e con essa spariva l'unica cosa che quel bordo doveva distinguere. Dove
   nessuno stato esiste, nessuna riga si distingue: è la risposta giusta, non
   l'assenza di una risposta.
5. **La barra si ferma a `MASSIMO_SEGMENTI = 3`, il conteggio no.** Tre
   segmenti in una cella da 43px sono già schegge, ma il numero vero finisce
   nell'`aria-label`: senza, un giorno da cinque e uno da tre sarebbero la
   stessa cella anche per chi la barra non la vede affatto.
6. **Il velo verde vale per il giorno intero, quindi pretende `every`.** Con
   una sessione su due chiusa il giorno **non** è andato, e tingerlo di verde
   direbbe il contrario. Il singolo segmento resta verde da sé.
7. **La legenda si deriva dai dati**, come i chip dell'archivio (§9-sedecies
   punto 2): una voce «Gara» in un mese senza gare è la chiave di lettura di un
   colore che non compare in nessuna cella. Sotto le due voci non compare
   affatto — con un colore solo non c'è niente da distinguere. La regola è sui
   **dati e non sul ruolo**: un `isAtleta &&` in più sulla voce «Fatto» sarebbe
   ridondante, e un guardiano che nessun caso può giustificare è il modo in cui
   la regola vera smette di essere leggibile (§9-quinquies, sul controllo di
   bordo tolto da `faseMoveUp`).

### 🔴 `border-brand/20` accanto a `CARTA_RIGA` NON fa niente — e vale ovunque
Il difetto peggiore della sessione, e **lo screenshot non lo mostrava**.
`CARTA_RIGA` porta già `border border-white/[.07]`; affiancargli
`border-brand/20` non sovrascrive nulla, perché sono **due utility della stessa
specificità** e a decidere è l'ordine nel foglio di stile. La riga «da fare»
credeva di avere il contorno ambra e aveva quello neutro.

È esattamente la trappola che `stiliCard.js` annotava già **per il raggio**
(`rounded-2xl` contro `rounded-[22px]`, §9-sedecies), ripresentata identica su
un'altra proprietà. Da qui **`CARTA_RIGA_BASE`**: l'impasto — gradiente,
hairline chiara, ombra — **senza** il bordo, così il contorno lo dichiara il
chiamante una volta sola invece di provare a sovrascriverlo.
`CARTA_RIGA = CARTA_RIGA_BASE + border-white/[.07]`, quindi nessun chiamante
esistente cambia.

> ⚠️ **E il primo test era verde per il motivo sbagliato**, per la terza volta
> in questo progetto (§9-sexies). Verificava `toHaveClass('border-brand/25')`,
> che era vero — la classe c'era, semplicemente non vinceva. Il caso che prende
> il difetto è l'**assenza** del bordo neutro, non la presenza di quello ambra.
> Trovato leggendo lo stile **calcolato** nel browser, non il DOM e non il
> codice.

### Una lettura in più, e nessuna colonna
La query dell'atleta aggiunge **`notes`**: è lì che sta il marcatore
`[RPE: n/10]`, sull'assegnazione e non sul workout. Senza, la riga di un
allenamento chiuso non può dire com'è andato — e non lo direbbe nessun errore,
si limiterebbe a non mostrarlo mai.
⚠️ L'RPE si legge con **`rpeDichiarato`**, non con `parseNotesAndRpe`: il
secondo torna **5** quando il marcatore manca, ed è il valore giusto per il
cursore della modale ma un numero inventato per chiunque lo mostri come un
dato. È la stessa lezione di §9-octies, §9-undecies punto 3 e §9-terdecies
punto 2.

### `metaWorkout` ha un'opzione, e non una seconda copia
`metaWorkout(w, { giorno: false })`. Ogni riga del calendario sta già sotto
l'intestazione della propria data: ripeterla lì dentro toglierebbe larghezza —
su 393px — proprio ai blocchi e ai minuti, che sono l'unica cosa per cui si
guarda quella riga. È un'opzione e non una funzione nuova perché «come un
workout descrive sé stesso» deve restare un punto solo (§9 punto 1).

### Cosa NON è stato implementato, e perché
- **Il foglio del giorno come bottom sheet trascinabile.** L'analisi
  dell'artboard lo descrive come «un pannello che sale dal bordo inferiore», ma
  il render di 1b lo disegna come una sezione sotto la carta, e il `dv-next`
  dello stesso artboard lo dà fra i **prossimi** pezzi di design. Implementato
  com'è disegnato, non com'è raccontato.
- **La vista settimana con le ore**, per la stessa ragione: è il primo
  suggerimento del `dv-next`.
- La modale **«Nuovo Evento / Gara»** è rimasta com'era, come le modali della
  scheda atleta e della scheda workout: la pagina è la cornice, quelle sono i
  contenuti. ⚠️ Una cosa è cambiata: la data parte da quella **selezionata** e
  non da oggi — si apre quella modale dopo aver scelto un giorno, e ripartire
  da oggi obbligava a rifare la scelta appena fatta.

### Cosa è tornato, contro l'artboard
Il bottone **«Oggi»**, che l'artboard toglie insieme agli altri quattro.
Toglierlo del tutto è una regressione: da tre mesi avanti si torna al giorno
corrente in tre tocchi invece che in uno. Qui compare **solo quando il mese
mostrato non è quello corrente** — cioè esattamente quando serve, e senza
occupare posto nell'unico caso in cui non servirebbe a niente.

### I file nuovi
`src/lib/rigaCalendario.js` (logica pura, 35 test) e
`src/components/CalendarioUI.jsx` (sola presentazione), più `CARTA_RIGA_BASE`
in `lib/stiliCard.js`. Il vecchio `COLORI_PALLINI` — una tabella di colori
locale a `Calendar.jsx` che mescolava tipi di blocco e categorie — è sparito:
il colore di una sessione è quello della sua **corsia**, e viene da
`coloreCategoria` come ovunque (§9 punto 1).

---

## 9-noviesdecies. L'attesa fra una pagina e l'altra (31/08/2026)

Segnalazione del committente: «passando da una pagina all'altra c'è una breve
fase di caricamento che non fa sembrare premium l'applicazione». Questa sezione
esiste soprattutto per la **diagnosi sbagliata** che c'è stata prima di quella
giusta: leggendo il codice si arriva a due conclusioni che sembrano ovvie e sono
entrambe false, e senza provarle non c'è modo di accorgersene.

### 🔴 Le due cose che il codice suggerisce e che NON succedono
1. **Lo splash di avvio NON ricompariva fra le pagine.** `ProtectedRoute` era
   ripetuto su tutte e nove le `<Route>` private, e sembra evidente che cambiare
   pagina lo rimonti — rifacendo `getSession()`, la `select` su `athletes` e la
   schermata «FLEOFIT · Caricamento…». **Non accade**: React conserva lo stato di
   un componente dello **stesso tipo nella stessa posizione** dell'albero, e
   React Router rende l'elemento della rotta sempre in quella posizione. Misurato
   con il codice di prima: `getSession` resta a **uno** attraverso la
   navigazione, e il nodo `<nav>` è lo stesso oggetto di prima.
2. **Il fallback del `Suspense` NON si vede.** `BrowserRouter` avvolge ogni
   cambio di rotta in `React.startTransition` (`useTransitions` va passato a
   `false` per disattivarlo, e nessuno lo fa). Durante una transizione React
   **non scopre il fallback**: tiene a schermo l'albero precedente finché il
   nuovo non è pronto. Quindi il `<div className="min-h-screen bg-[#0B0B0B]" />`
   non lampeggia mai fra due pagine — si vede solo al primo caricamento di
   `/login` o `/tv`.

### Cosa succede davvero, ed è peggio di un lampeggio
La pagina **precedente resta a schermo immobile**, senza rotella, senza
scheletro, senza un segnale qualsiasi, per tutto il tempo che serve a scaricare
e soprattutto a **parsare** il chunk della pagina nuova. Poi la pagina nuova si
monta e mostra il *suo* scheletro mentre parte il *suo* fetch. Un lampeggio si
legge come «sta caricando»; un'interfaccia che non risponde al tocco si legge
come «l'app è bloccata», ed è la ragione per cui non sembra premium.

### Le due correzioni fatte
1. **`ProtectedRoute` è una route di LAYOUT** (`<Route element={<ProtectedRoute />}>`
   con `<Outlet />`), non più un involucro ripetuto nove volte. ⚠️ Non è un
   guadagno di velocità — vedi sopra, il rimontaggio non c'era: toglie una
   ripetizione e mette al riparo dal caso in cui avverrebbe davvero, cioè un
   secondo cancello annidato. Il `<Suspense>` sta **anche** dentro, attorno al
   solo `<Outlet />`: a sospendere è il confine più vicino, e con il solo
   confine esterno finirebbero sotto il fallback pure la tab bar e l'AuthContext.
2. **`jspdf` e `html-to-image` si caricano solo quando si esporta.** Erano
   `import` in testa a `WorkoutDetail`, quindi nel chunk della scheda: **480 KB**
   più html2canvas (200) e index.es (151). Aprire una scheda — il gesto più
   frequente dell'app — costava ~830 KB di parsing per due voci di menu che
   quasi nessuno tocca. Ora la scheda è **68 KB** (117 con i suoi chunk
   condivisi), e il resto arriva al primo export.

### 🔴 Il secondo giro: «i riquadri ci sono ma sono vuoti» (31/08/2026)
Segnalazione successiva del committente, sulla **Home all'apertura**. La domanda
era se fosse il database a essere lento. **Non lo è**: le letture erano in fila,
e la stessa riga di `athletes` veniva letta **tre volte** in un solo avvio.
Misurato mettendo 100 ms di latenza finta su ogni query e cronometrando fino al
primo dato in pagina:

```
PRIMA                                     DOPO (a freddo)        DOPO (con cache)
  120 ms  auth.getSession                   119  auth.getSession    103  auth.getSession
  222 ms  athletes.select(id)          ┐    221  athletes.select(   204  athletes.select(
  323 ms  athletes.select(id,name,sur) ┘ in fila     id,name,surname)     id,name,surname)
  469 ms  athletes.select(name)     ┐      358  notifications      → CONTENUTO A 241 ms
  469 ms  notifications             │ in   358  athlete_workouts×2    (la rete arriva dopo
  469 ms  athlete_workouts × 2      ┘ par. → CONTENUTO A 368 ms       e riscrive)
  → CONTENUTO A 474 ms
```

Le tre correzioni, in ordine di resa:
1. **Le due `select` di `ProtectedRoute` sono una sola.** Chiedevano la stessa
   riga per due domande — «esiste?» e «come si chiama?» — e la seconda partiva
   solo quando la prima era tornata. `select('id, name, surname')` risponde a
   entrambe: **un giro di rete in meno dalla catena**.
2. **Il nome passa dall'`AuthContext`**, che ce l'ha già. `Home` faceva una
   **terza** `select` su quella riga. Non accorciava la catena (era in
   parallelo) ma era una query per un dato già in mano.
3. **La Home si dipinge dalla cache PRIMA di chiedere alla rete.**
   `fleofit_cache_workouts_<uid>` era scritta a ogni fetch riuscito e riletta
   **solo se la rete falliva**: online i riquadri restavano vuoti ad aspettare
   anche avendo i dati dell'ultima volta sul telefono. È la correzione che si
   vede: dalla seconda apertura in poi la pagina nasce piena.

⚠️ **`applicaStoricoAtleta` esiste per questo.** Il calcolo che riempie la Home
— oggi, prossimi, evento, settimana, statistiche — era **dentro** il `.then` del
fetch, quindi l'unico modo di avere i riquadri pieni era aspettare la rete. Ora
è un `useCallback` chiamato **due volte**: con la cache e con la risposta.
⚠️ Ricalcola le tre date da sé invece di riceverle: venivano dallo scope del
fetch, e una Home lasciata aperta oltre la mezzanotte le avrebbe usate vecchie.
⚠️ **Con la cache in pagina `loading` NON torna a `true`**: rimettere lo
scheletro sopra dati già buoni è un passo indietro visibile a ogni apertura.

### ⚠️ Cosa resta aperto
L'attesa residua è **quasi tutta il cancello di autenticazione**: `getSession()`
più la lettura della riga atleta, che devono finire prima che una qualsiasi
pagina si monti. Restano da fare il prefetch del chunk su `touchstart` delle
voci di navbar e uno scheletro al posto delle due righe di testo di
`WorkoutDetail` e `AthleteDetail` (`if (loading) return <div>Caricamento...</div>`),
che sono le due pagine più aperte e le uniche due senza. La cache **c'è anche
per la scheda** (`fleofit_cache_w_<id>`) e lì si usa ancora solo offline: stesso
trattamento della Home. Voci in BACKLOG.

### I tre test, e perché due sono nati verdi per il motivo sbagliato
`src/__tests__/NavigazioneApp.test.jsx` è il primo test che monta **`App.jsx`
vera**: i 617 precedenti montano le pagine da sole con un AuthContext proprio
(`src/test/montaPagina.jsx`), quindi il cancello, il router e la tab bar — tutto
ciò che sta *fra* una pagina e l'altra — non erano coperti da niente.

I due test iniziali passavano **anche con il codice di prima**, ed è così che la
diagnosi sbagliata è venuta fuori: sono stati riscritti sulle proprietà vere —
la sessione risolta una volta sola (cade annidando un secondo `ProtectedRoute`)
e la pagina precedente che resta **visibile** durante il caricamento (cade con
`useTransitions={false}`).
⚠️ Il secondo usa **`toBeVisible`, non `toBeInTheDocument`**: quando un confine
Suspense scopre il fallback React **non smonta** ciò che era già montato — lo
nasconde con `display: none` e ne conserva lo stato. Sulla presenza la mutazione
non cade, sulla visibilità sì. È la stessa asimmetria della grafica Instagram
(§9-duodecies punto 1).
⚠️ E `BrowserRouter` legge la history **vera** del documento, che i test si
passano l'un l'altro: senza un `pushState('/')` in `beforeEach`, il secondo test
parte dalla rotta su cui l'ha lasciato il primo e verifica un'altra pagina.

`src/pages/__tests__/WorkoutDetailChunk.test.jsx` protegge la seconda
correzione, che altrimenti si perde al primo «ottimizziamo gli import»:
rimettere `jspdf` in testa **non dà nessun errore** e non fa cadere nessun altro
test — cambia solo mezzo megabyte davanti a ogni apertura. Il test sfrutta il
fatto che la factory di `vi.mock` scatta alla prima importazione del modulo.

`src/pages/__tests__/HomeCache.test.jsx` (3 test) protegge la pittura dalla
cache. ⚠️ Il primo **non aspetta niente**: la cache si legge prima del primo
`await` del fetch, quindi il titolo è già in pagina quando `render` torna — ed è
quella riga a cadere se la cache torna a leggersi solo sul ramo d'errore, perché
lì il titolo non compare *affatto*, non compare «dopo». Il secondo verifica che
la cache di un altro atleta non si veda **prima** che la rete risponda: dopo, il
server sovrascrive comunque e il test passerebbe anche leggendo la chiave
sbagliata.
⚠️ In `NavigazioneApp` il test sulla lettura unica azzera `finto.chiamate` in
`beforeEach`: è un registro di **modulo**, che `vi.clearAllMocks()` non tocca, e
senza azzerarlo conta anche gli avvii dei test precedenti.

### 🔴 Il terzo giro: la pagina nuova non si apriva dall'inizio (01/09/2026)

Segnalazione del committente sul report appena fatto («quando clicco su report
settimanale non mi riporta in cima la pagina»). **Non era un difetto delle
pagine nuove: mancava da sempre in tutta l'app.**

`BrowserRouter` non tocca lo scorrimento, e dal 31/08 le pagine sono figlie di
una route di **layout**: cambia soltanto ciò che sta dentro `<Outlet />`, mentre
la finestra resta esattamente dov'era. Finché le pagine di partenza erano corte
non si notava. Con la Home coach lunga si nota subito: si scorre fino in fondo,
si tocca «Report settimanale», e il report si apre a metà — e a schermo non
sembra una pagina aperta male, sembra **che il tocco non abbia funzionato**.

La correzione è `ScrollInCima` in `App.jsx`, dentro `BrowserRouter`.

⚠️ **Solo sulle navigazioni nuove (`PUSH`/`REPLACE`), mai su `POP`.** È la metà
della regola che si perde riscrivendola: il ritorno indietro deve riportare la
pagina **dov'era**. Chi scorre la Home fino agli allenamenti scaduti, ne apre
uno e torna, deve ritrovarsi lì. Azzerare anche lì scambia un difetto con uno
più fastidioso, perché indietro è il gesto che si ripete di più. Ci sono due
test, e cadono su due mutazioni diverse.

⚠️ Con `startTransition` l'effetto scatta al **commit** della pagina nuova, non
al tocco: la pagina precedente resta ferma finché il chunk arriva, invece di
fare un salto in cima prima di sparire. È lo stesso meccanismo descritto in
questa sezione, ed è la ragione per cui la correzione non introduce un lampeggio.

⚠️ **Cosa resta scoperto, e va detto perché sembra coperto**: la dipendenza è
`location.key` e non `pathname`, così che due deep link allo stesso workout con
`athlete_id` diversi contino come due pagine (§8). Quel caso **non è provocabile
montando `App`** — non esistono due comandi che portino allo stesso percorso con
query diverse senza una pagina in mezzo — e il test sul doppio tocco della voce
già attiva **passerebbe anche con `pathname`**, perché lì cambia il *tipo* di
navigazione (`PUSH` → `REPLACE`). Verificato per mutazione. Chi semplifica quella
dipendenza non romperà nessun test.

---

## 9-vicies. Il report settimanale del coach (01/09/2026)

Richiesta del committente: «favorire il più possibile la figura del coach», con un
report settimanale **visionabile unicamente dal coach**. È BACKLOG #27 («Coach
Copilot»), che l'analisi del 24/08 dava come l'unica delle tre idee di prodotto
senza blocchi — e infatti non richiede nessuna migrazione: **tutto il report esce
da due letture su tabelle esistenti**.

### Il problema, in una riga
L'app diceva al coach cosa succede **oggi** (la Home) e com'è andato **un** atleta
(la scheda). Non diceva mai com'è andata **la settimana della squadra**, che è la
domanda su cui si programma quella dopo: chi richiamare, chi scaricare, chi
caricare si ricavavano aprendo una scheda alla volta e tenendo a mente i numeri.

### Cosa c'è, nell'ordine in cui sta in pagina
1. **La testata** con il navigatore di settimana (indietro senza limiti, avanti
   fino a quella corrente e non oltre). ⚠️ La riga «Settimana 36 · 31 ago – 6 set»
   sta **sotto** i bottoni e non in mezzo: vedi le due trappole qui sotto.
2. **L'eroe**: l'aderenza della squadra, la barra, e **una frase** che dice cosa
   farne («Aderenza 63%, carico in salita. · 2 da richiamare · 2 da scaricare ·
   3 senza programma la prossima settimana»). È la sola cosa che si legge da
   lontano — Regola dell'Eroe Unico.
3. **Il bento dei tre numeri**: Volume, Carico, RPE medio, ognuno con lo scarto
   sulla settimana precedente **solo quando è confrontabile**.
4. **La fascia «Da fare adesso»**, l'unica cornice colorata della pagina, che
   filtra la lista con un tocco.
5. **Atleta per atleta**: verdetto, il perché, e i numeri su cui verificarlo.
6. **Mix della settimana** per corsia, derivato dai dati.
7. **Settimana prossima**: chi non ha ancora niente, con «Assegna» per riga e
   «Crea workout» — è l'unica sezione che guarda avanti.
8. **Cosa ti hanno detto** (note e vocali della settimana) e **In pausa**.

### 🔴 LE TRE REGOLE CHE TENGONO ONESTI QUESTI NUMERI
Sono in testa a `src/lib/reportSettimanale.js` e sono la ragione per cui quel file
esiste invece di essere quattro righe dentro la pagina.

1. **L'aderenza si misura sulla parte TRASCORSA della settimana.** È la trappola
   già documentata in `rigaAtleta.js`: gli assegnati comprendono i giorni ancora
   da venire, quindi **il lunedì mattina sono tutti a 0/5**. Un verdetto «aderenza
   bassa» legato alla frazione piena accenderebbe un allarme su tutta la squadra
   ogni lunedì, cioè quando non è successo ancora niente — e un allarme che si
   accende sempre smette di essere letto. Ciò che resta in programma si dichiara
   a parte (`daVenire`), e il verdetto di quel caso è **«Da iniziare»**, non
   «Senza programma»: quattro allenamenti da giovedì *sono* un programma.
2. **Il carico esclude le sessioni senza RPE dichiarato, e lo DICE.**
   `parseNotesAndRpe` torna 5 dove il marcatore manca, e quel 5 entrerebbe nel
   prodotto minuti × RPE come se fosse una misura (§9-octies). Si somma solo ciò
   che l'atleta ha davvero segnato, e il totale porta il **`≈`** — lo stesso
   glifo del volume nel calendario (§9-octodecies), per la stessa ragione.
3. **Nessun numero si inventa per riempire una cella.** Rapporto di carico e
   scarto RPE tornano `null` quando i dati sotto non bastano, ed è la pagina a
   scrivere «—». Stessa lezione di `rpeAtteso` e `rpeDichiarato`.

### I due numeri che l'app non aveva mai detto
- **Il rapporto acuto/cronico** (`carico 3,03×`): il carico della settimana
  diviso la media delle ultime quattro. Sopra 1,5 è un salto, sotto 0,8 uno
  scarico. ⚠️ Torna `null` sotto `MINIMO_SESSIONI_CARICO` sessioni **misurate** o
  con meno di due settimane attive: con due sole sessioni saltarne una dimezza il
  riferimento e raddoppia il numero, e un «2,1» costruito così manda a scaricare
  un atleta che sta benissimo. Un atleta appena arrivato ricadeva esattamente lì.
- **Lo scarto fra RPE atteso e dichiarato**: `sections.intensity` — l'intensità
  che il coach ha scritto — contro l'RPE che l'atleta ha segnato dopo. **Nessuna
  altra schermata mette i due numeri uno accanto all'altro**, ed è l'unico
  segnale che dica se la programmazione sta chiedendo più di quanto voleva.

### ⚠️ Le cose da sapere prima di rimetterci mano
1. 🔒 **La guardia sul ruolo sta in DUE punti**: il redirect e il `return` prima
   del fetch. Toglierne uno solo non cambia niente a schermo — e lascia passare
   una versione che rimanda alla Home **dopo** aver scaricato le assegnazioni di
   tutta la squadra sul dispositivo dell'atleta. C'è un test che conta le query.
   ⚠️ È una guardia **di interfaccia**, non di sicurezza: i dati sono già protetti
   dalle policy RLS, e un atleta che chiamasse l'API riceverebbe le sue righe.
2. **Le soglie NON si riscrivono qui.** `GIORNI_FERMO` viene da
   `statisticheCoach.js` (la stessa che alimenta «Richiedono attenzione» nella
   Home) e `SOGLIA_STABILE` da `andamento.js`. Due soglie per lo stesso concetto
   darebbero due numeri diversi in due schermate, e **nessuno dei due sarebbe
   sbagliato da solo**.
3. **Il confronto con la settimana precedente si mostra solo a settimana finita**
   (`delta.confrontabile`): su una in corso confronta tre giorni con sette, e un
   «−58%» al mercoledì è aritmetica giusta e informazione falsa.
4. **«Senza programma» non entra nella fascia delle azioni.** A quella condizione
   risponde la sezione «Settimana prossima», che dice anche come rimediare: due
   allarmi per lo stesso atleta con due risposte diverse sono il modo in cui un
   allarme smette di significare qualcosa.
5. **Una lettura fallita ha uno stato suo.** Senza, zero righe si leggono come
   «questa settimana non si è allenato nessuno»: un guasto travestito da dato, il
   difetto peggiore possibile per una pagina su cui si programma (§9-quater).
6. **Chi è in pausa esce da ogni numero e resta nell'elenco in fondo**, come
   nella rubrica: è l'unico posto in cui il coach si accorge di averne messo in
   pausa uno e dimenticato (§9-decies).

### 🔴 I due difetti che solo la pagina a 375px ha mostrato
Nessun test li avrebbe presi, ed è la stessa lezione del conto alla rovescia del
cestino (§9-septdecies punto 7).
1. **La riga della settimana era troncata**: fra quattro bottoni tondi le
   restavano centoquaranta pixel, e «31 ago – 6 set» diventava «31 ago – …» —
   spariva cioè la data, l'unica cosa che dice quale settimana si sta guardando.
   Ora sta su una riga sua, a tutta larghezza.
2. **La meta della riga troncava il moltiplicatore di carico**: «5/5 · 6h 15 ·
   RPE 9 · carico…», e quel numero è la ragione stessa per cui quella riga porta
   «Da scaricare» ed è in cima alla pagina. Ora va a capo invece di troncare.

### Cosa NON è stato fatto, e perché
- **Nessuna notifica push «è pronto il report»**: sarebbe una modalità nuova di
  `send-reminders`, cioè il **deploy di una Edge Function condivisa con la web
  app in produzione** (§1.1). Stessa ragione per cui «Manda promemoria» non
  esiste (§9-nonies). Voce in BACKLOG.
- **Nessun export PDF del report**: `jspdf` è appena uscito dal chunk della
  scheda (§9-noviesdecies) e rimetterlo qui in testa rifarebbe lo stesso danno su
  un'altra pagina. Se servirà, va importato su richiesta come là.
- **Nessuna generazione automatica della settimana successiva.** La sezione
  «Settimana prossima» dice **chi** e porta dove si assegna, ma non compone
  niente da sé: farlo richiede di sapere cosa un atleta ha già fatto in termini
  di *risultato*, non solo di *fatto/non fatto* — cioè BACKLOG #25, che è
  congelato perché serve una tabella. Un generatore che non guarda i risultati
  produrrebbe programmazione plausibile e cieca, che è esattamente ciò che questa
  pagina esiste per evitare.

---

## 9-unetvicies. La grafica da mettere sopra una storia (01/09/2026)

Richiesta del committente: «un tasto di condivisione che esporti una grafica con
il recap del workout eseguito, un po' come fa Strava — uno fa una storia e ci
mette sopra quest'immagine, come Strava fa vedere il percorso e i chilometri in
basso».

### 🔴 Lo sticker si RITAGLIA sul contenuto, la storia con sfondo no
Sono due misure diverse, non due sfondi dello stesso file, e la ragione è
misurabile: **Instagram scala l'immagine intera** per farla entrare dove la si
appoggia, quindi ogni pixel trasparente di margine rimpicciolisce il testo due
volte — una nel file e una nella storia. La prima stesura esportava sempre
9:16 con il contenuto in fondo, e su un allenamento corto metà sticker era
vuoto: il committente l'ha visto subito («sopra la data e sotto FLEOFIT c'è
tutto il riquadro che non è utilizzato»).

Conseguenze pratiche:
- lo **sticker** ha `width: 360` e altezza automatica. Chi esporta deve
  **leggere l'altezza dal nodo** (`offsetHeight`), non darla per scontata: un
  640 scritto a mano rimette esattamente il margine che il ritaglio esiste per
  togliere, e il file sembrerebbe corretto a chiunque lo aprisse.
- la **storia con lo sfondo** resta 360×640, perché si pubblica così com'è, e
  con essa restano `FONDO_SICURO` (la barra della risposta di Instagram) e
  l'alone della corsia.
- il ritaglio ha permesso di **ingrandire tutto il testo**, che era l'altra
  metà della richiesta.

### 🔴 Lo sticker è una CARTA, e ci sono voluti due tentativi
Il primo era un **alone ellittico** che si spegneva dentro il margine, per non
avere l'aria di una scatola. Non funziona su un ritaglio, e **si vede solo
guardandolo**: il testo arriva quasi ai bordi, quindi o l'ellisse smetteva di
coprirlo ai lati, oppure — allargandola — tagliava di netto sui fianchi,
disegnando sulla foto una fascia scura con due spigoli. Le due cose non possono
stare insieme: o si stringe il testo, o si dichiara la carta.

Ora è una carta semitrasparente con angoli tondi e una hairline chiara, cioè
la **Regola della Carta Sollevata** di DESIGN.md — lo sticker somiglia alla
schermata da cui esce. ⚠️ Il fondo **deve restare semitrasparente**: la foto
sotto si intravede, ed è ciò che lo fa leggere come appoggiato invece che
incollato. Un fondo opaco è lo stesso difetto del `backgroundColor` all'export,
commesso un livello più su. C'è un test per l'alfa e uno per il raggio.

### 🔴 La storia 9:16 si ADATTA invece di tagliare
Il riquadro è fisso e il contenuto no: un Hyrox da dodici righe supera i 640px,
e con il contenuto ancorato in basso a uscire dalla **cima** sono il titolo e
l'occhiello — le uniche due righe che dicono di che allenamento si tratta. È
successo appena il testo è stato ingrandito. `StoriaConSfondo` misura lo
`scrollHeight` del contenuto **non scalato** (il `transform` non tocca il
layout, quindi niente ciclo «scalo → rimisuro → riscalo») e lo rimpicciolisce
quanto basta, con l'origine in basso per non mangiare `FONDO_SICURO`.

### 🔴 Il punto è la TRASPARENZA, non la grafica
È la cosa che si perde per prima leggendo il codice. Questa immagine non si
pubblica *al posto* della propria foto: si appoggia *sopra*, con lo sticker
«foto» di Instagram, che conserva il canale alfa. Quindi:

- lo sfondo del nodo è `transparent`, e la modalità «con sfondo» è la **seconda**
  opzione, non la prima;
- **all'esportazione non si passa nessun `backgroundColor`**. html-to-image
  lascia trasparente ciò che il nodo non dipinge; un colore lì dentro — anche
  nero, anche «per sicurezza» — produrrebbe un file perfetto all'apparenza e
  inutile allo scopo, perché sopra la storia coprirebbe il video. C'è un test
  che cade **solo** su quella riga.

Non è la grafica IG che esisteva già: quella è la **scheda**, cioè il programma
blocco per blocco, e serve al coach per mandarla a un atleta *prima*. Questa è
il **recap**, e serve all'atleta *dopo*. Restano tutte e due, e dal 01/09 le
voci di menu lo dicono («Salva la scheda (PNG)», «Invia la scheda»).

### 🔴 Il contenuto sono gli ESERCIZI, e la prima versione sbagliava
La prima stesura, lo stesso giorno, disegnava al posto dell'elenco un **profilo
di sforzo**: un tratto per esercizio, largo quanto durava e alto quanto era
duro, in giallo, con l'idea che fosse l'equivalente del percorso GPS di Strava.
Era gradevole, era corretto, ed era **illeggibile**. Il committente l'ha tolto
guardandolo: «il grafico è carino, però sono più importanti gli esercizi».

La ragione, per chi fosse tentato di rimetterlo: una sagoma racconta
*l'andamento* di una seduta, cioè una cosa che interessa a chi l'ha fatta e che
chi l'ha fatta già sa. L'elenco dice *che cosa* si è fatto, ed è la sola cosa
che qualcuno voglia sapere guardando la storia di qualcun altro. Il profilo era
un grafico su una superficie che non è un cruscotto.

⚠️ **Il vincolo che governa ogni misura di questa grafica**: verrà guardata
**piccola**. Quindi poche righe in corpo grande, mai tutte le righe in corpo
piccolo. Da qui `MASSIMO_RIGHE` e il «+N esercizi» che chiude l'elenco quando
non ci sta: una lista troncata che lo dichiara si legge, una lista intera in
corpo 9 no.

### Com'è fatto l'elenco
Un'intestazione per blocco — il tipo come lo scrive la scheda («Cash In»,
«EMOM») più i suoi parametri — e sotto una riga per esercizio: il nome a
sinistra in corpo grande, le specifiche a destra in colonna. Per la corsa, ogni
fase è una riga; solo le ripetute sono un gruppo, perché sono l'unico punto in
cui c'è davvero una gerarchia.

⚠️ **I parametri dell'intestazione vengono da `parametriBlocco`**, estratta il
01/09 da `sottotitoloBlocco` in `src/lib/rigaBlocco.js`. È lì che vivono i
ripieghi di un blocco mai aperto (10 giri per un EMOM, 3 per un For Time), gli
stessi con cui `durataBlocco` stima la durata che finisce nella cella accanto:
un secondo elenco darebbe un'intestazione che contraddice quel numero, senza
alcun errore. `sottotitoloBlocco` ci aggiunge il conteggio degli esercizi, che
qui non serve perché gli esercizi sono elencati subito sotto.
⚠️ `parametriBlocco` torna **`null`** su un tipo sconosciuto e **`''`** su un
tipo noto senza parametri: chi chiama deve poter distinguere «non ha parametri»
da «non so che blocco sia», e le due cose portano a due righe diverse.

⚠️ **Le specifiche vengono da `specificheEsercizio`**, la stessa funzione della
scheda: l'atleta deve ritrovare sulla storia le parole che ha letto nell'app.

⚠️ **Su un allenamento libero si legge `coach_notes`, MAI la nota dell'atleta.**
La prima è il contenuto dell'allenamento; la seconda è il riscontro lasciato al
coach e può contenere qualunque cosa — e la grafica può essere esportata **dal
coach, dalla scheda di qualcun altro**. C'è un test.

### I numeri: tre celle, e mai una inventata
È l'ultimo posto dell'app in cui un ripiego travestito da misura può passare
inosservato, perché l'immagine **esce dall'app** e finisce sotto gli occhi di
gente che non ha modo di verificare niente. Perciò:

- **`≈` davanti alla durata.** È la stessa stima del builder e della scheda: il
  timer sa quanto dura un EMOM, ma «For Time» e «Cash In» sono cronometri liberi
  e lì il tempo lo fa l'atleta. Su una storia quel numero si legge come un
  cronometro, e il segno che dice «circa» è l'unica cosa che lo separa da una
  bugia.
- **L'RPE è quello DICHIARATO** (`rpeDichiarato`, mai `parseNotesAndRpe`, che
  torna 5 quando il marcatore manca). Se l'atleta non l'ha indicato, la cella
  **non ripiega su 5 né sull'RPE atteso**: passa all'**intensità** scritta dal
  coach, sotto la sua etichetta. Se manca anche quella, le celle diventano due.
  È la stessa lezione di §9-octies, §9-undecies punto 3 e §9-terdecies punto 2,
  alla sua quinta comparsa.
- **La corsa mista non dichiara nessun totale** (§9-sedecies punto 3). Custom ed
  Evento non hanno né durata né blocchi, e lì la grafica dice il titolo, il
  giorno e — sul libero — le note.

### ⚠️ Le sei cose da sapere prima di rimetterci mano
1. **Il nodo rasterizzato è una copia a misura vera, fuori schermo**, non
   l'anteprima. L'anteprima vive dentro un `transform: scale`, e `scale` su un
   antenato cambia il rettangolo che html-to-image misura: l'immagine uscirebbe
   della dimensione sbagliata senza dare alcun errore. `width` e `height` sono
   dichiarati nelle opzioni per la stessa ragione. C'è un test.
2. **Fuori schermo sì, `display:none` no.** Vale parola per parola la regola
   della grafica IG (§9-duodecies punto 1): html-to-image clona un nodo vero, e
   spento produce un'immagine vuota senza errori.
3. **Ogni formato ha UN meccanismo per stare dentro, e sono diversi**: lo
   sticker cresce (si ritaglia), la storia con sfondo si rimpicciolisce (si
   adatta). Non c'è più un tetto d'altezza sull'elenco: era la rete di quando
   entrambi erano incorniciati in 640px, e teneva in vita due meccanismi per lo
   stesso problema.
4. **Il testo ha un'ombra anche sopra la carta.** La carta è semitrasparente di
   proposito, e sotto una riga può capitare il punto più chiaro dello scatto.
   È l'unica difesa che non dipende da quanto è alto il contenuto.
5. **Il titolo si rimpicciolisce quando sotto c'è un elenco e cresce quando non
   c'è.** Su una gara il titolo è tutto il contenuto; su un Hyrox è l'etichetta
   di quello che si legge sotto. Sono due pagine diverse, non due gusti.
6. **`FONDO_SICURO` vale solo per la storia con sfondo**: Instagram copre la
   fascia bassa con la barra della risposta, e un numero che finisce lì sotto
   non si legge — cosa di cui ci si accorge dopo aver pubblicato. Sullo sticker
   non si applica, perché è l'atleta a decidere dove appoggiarlo.

### 🔴 html-to-image non si può provare da un browser incorporato
Verificato il 01/09: nella preview integrata `toPng` **resta appeso** anche su un
`div` da 40px — il suo `<img src="data:image/svg+xml…">` interno non emette mai
`load`, e la libreria non ha timeout. Non è un difetto del nostro codice (la
grafica IG usa lo stesso percorso da mesi), ma vuol dire che **la trasparenza
del file non è dimostrabile lì**: la composizione si verifica a schermo, la
proprietà del PNG si blocca con il test sulle opzioni. Chi vorrà una prova sul
file vero deve esportarlo dal dispositivo.

### I file nuovi
`src/lib/recapStoria.js` (logica pura, 20 test) e `src/components/StoriaUI.jsx`
(grafica + foglio di anteprima), più `parametriBlocco` estratta da
`rigaBlocco.js`. `src/pages/__tests__/WorkoutDetailStoria.test.jsx` porta 14
test, tutti verificati per mutazione.

⚠️ `recapStoria` si calcola **solo a foglio aperto**: scandaglia i blocchi
esercizio per esercizio, e la scheda è la pagina più aperta dell'app.

---

## 9-duoetvicies. Il rework delle Impostazioni (01/09/2026)

Stesso progetto Claude Design degli altri otto schermi
(`4a238081-a3ee-4f59-ae34-100f29d55601`), artboard `Impostazioni.dc.html`,
opzione **1b**. Come per gli altri: **nessun campo di Supabase cambia forma**,
e nessun percorso di quelli che funzionavano è stato riscritto — permessi
push, BLE, export/import, cambio password sono gli stessi. Cambia il JSX,
cambia l'ordine, e per la prima volta la pagina dice con quale account sei
dentro.

### Il problema, in una riga
Cinque card dello stesso peso in un ordine che non è quello dell'uso: la prima
schermata era occupata dai **codici invito**, cioè la cosa che il coach fa una
volta al mese. Ogni voce — anche un semplice acceso/spento — era un bottone
alto 76px con titolo e sottotitolo, quindi niente si leggeva come più
importante di altro. E la pagina non diceva mai la cosa che una schermata
Impostazioni deve dire per prima: **chi sei, e cosa è attivo su questo
telefono**.

### Cosa c'è ora, nell'ordine in cui sta in pagina
1. **L'eroe: account e stato del dispositivo.** Nome, email, la pillola del
   ruolo, e sotto «Su questo iPhone» i due interruttori che valgono solo qui —
   notifiche e fascia cardio. È l'unica parte della pagina che contiene
   **informazione** e non destinazioni.
2. **Account**: modifica password e anteprima come atleta.
3. **Solo coach**: codici invito, esporta database, importa backup atleta.
4. **Ripristina database totale**, fuori dal gruppo e rosso.
5. **Strumenti sviluppo**, chiuso.
6. **Esci dall'account**, e il piede con versione e email.

### ⚠️ Le sette cose da sapere prima di rimetterci mano

1. 🔴 **Un interruttore è un interruttore, e ha `aria-checked`.** Prima il
   testo del bottone cambiava da «Abilita Notifiche» a «Disabilita Notifiche»
   per dire dov'era: un comando travestito da stato, che si legge al contrario
   la metà delle volte. Senza `role="switch"` + `aria-checked`, chi usa
   VoiceOver sente «Notifiche push, pulsante» e non ha modo di sapere se le
   notifiche arrivano — che è **tutta** l'informazione della riga.
2. 🔴 **Il banner giallo «Operazione in corso, attendere prego...» è
   sparito, e non è pulizia.** Lo stato di caricamento vive nella riga che
   l'ha causato (`operazione` è una stringa, non un booleano): con nove
   comandi in pagina, una rotella in cima costringe a ricordarsi cosa si è
   appena premuto. ⚠️ Il test che lo protegge deve **tenere aperta l'attesa a
   mano** — con il finto Supabase l'export finisce dentro la stessa
   `userEvent.click`, e un `waitFor` dopo il clic troverebbe la riga già
   tornata a riposo, cioè passerebbe anche rimettendo il banner (§9-sexies,
   ancora).
3. 🔴 **Il testo sul Garmin è quello di prima, parola per parola.** È l'unica
   spiegazione dell'app su come si collega un orologio, e riassumerlo
   butterebbe via proprio la parte che dice cosa fare — è la stessa lezione
   dell'avviso sul riscaldamento (§9-duodecies). Quello che cambia è che non
   lo si rilegga a ogni apertura: sta sotto «Come si collega». Esce solo
   l'emoji 💡, che DESIGN.md dichiara anti-riferimento.
4. 🔴 **I numeri delle righe non si inventano mai.** `riassuntoCodici` torna
   `null` finché i codici non sono arrivati — «0 attivi · 0 usati» durante il
   caricamento è un dato, ed è falso — e `riassuntoBackup` fa **sparire** un
   conteggio mancante invece di scriverlo `0`: «0 atleti · 0 workout» accanto
   a «Esporta database» si legge come «non c'è niente da salvare», che è il
   messaggio peggiore possibile sulla riga di un backup. Quinta comparsa della
   regola di `rpeAtteso` (§9-octies, §9-undecies, §9-terdecies,
   §9-unetvicies).
   ⚠️ E i due conteggi sono quelli **grezzi** delle tabelle, non quelli della
   rubrica: descrivono il **file**, non la squadra. La rubrica filtra
   `deleted_at` e l'account del coach; prendere il suo numero farebbe
   promettere all'export un contenuto che non ha.
5. 🔴 **«Ultimo export» è una memoria LOCALE, non un registro dei backup.**
   `fleofit_ultimo_export` dice «l'hai esportato da questo iPhone», che è
   l'unica cosa che si possa sapere senza una colonna nuova (regola 0-bis).
   Chi cambia telefono non vede la data, e la riga non gli promette niente di
   falso — ma se un giorno si vuole «esiste un backup del 28 ago», quello è
   un'altra affermazione e richiede il database.
6. **La versione arriva da `App.getInfo()` di Capacitor, e sul web non
   compare.** `package.json` dice `0.0.0` e il numero vero vive nel `pbxproj`,
   che Xcode incrementa **da solo** a ogni archive (§9-ter): una costante
   scritta a mano qui sarebbe la quarta copia di un numero destinato a essere
   sbagliato.
7. **La fascia cardio resta di chi si allena.** L'artboard la disegna anche
   nella vista coach, ma il gate `role === 'athlete' || isSimulatingAthlete`
   è quello di prima ed è rimasto: il coach non ha allenamenti propri (il suo
   account è escluso da chi si segue), e un interruttore che non serve a
   niente è comunque un interruttore da leggere. Cambiarlo è una decisione di
   prodotto, non di design.

### I codici invito: una riga, e un foglio
Erano una card con **due accordion dentro** — un pozzetto dentro un pozzetto,
contro la Regola dei Gradini. Ora la pagina porta solo il numero («3 attivi ·
11 usati») e la lista si apre in un bottom sheet, con `src/useBottomSheet.js`
come il menu della scheda.

⚠️ **Un foglio e non una rotta nuova**: l'artboard descrive una schermata
dedicata, ma il suo `dv-next` la dà fra i **prossimi** pezzi di design. Vale la
stessa scelta del pannello filtri dell'archivio (§9-sedecies) e del foglio del
giorno del calendario (§9-octodecies): si implementa ciò che è disegnato, non
ciò che è annunciato.

⚠️ **I codici si leggono all'apertura della PAGINA, non del foglio**: il numero
della riga deve esserci prima che qualcuno la tocchi, o la riga non dice niente
più di quanto dicesse la card. La lettura è una sola per apertura, e per
l'atleta **non parte affatto** — c'è un test che conta le query, perché la
guardia sul ruolo sta in due punti e verificarne uno solo lascia passare una
versione che scarica gli inviti sul telefono di chi non deve vederli
(§9-vicies, stessa lezione).

⚠️ **`riassuntoCodici` dice «Nessun codice generato» solo sulla tabella
VUOTA**, non quando attivi e usati sono entrambi zero: un codice spento che
nessuno ha riscattato esiste, non compare in nessuna delle due liste del
foglio, e invitare a generarne uno nuovo sarebbe l'unica frase della riga che
si può smentire aprendola.

### Il codice morto che il rework ha lasciato indietro, ed è stato rimosso
`InviteCodeManager` (in `Settings.jsx`) è sparito: la sua metà visiva è
`FoglioCodici` in `ImpostazioniUI.jsx`, la sua metà di dati è salita in
`Settings` — dove serviva comunque, per il numero della riga. Nella stessa
passata i due `JSON.parse(localStorage.getItem(...))` non c'erano già più, ma
la scrittura di `fleofit_ultimo_export` passa da un `try/catch` che **non**
fa fallire l'export: il file a quel punto è già stato scritto.

### 🔴 La cancellazione dell'account è salita qui (09/09/2026)

Linea guida **5.1.1(v)**: un'app che permette di creare un account deve offrire
la cancellazione **dentro l'app**, e Apple chiede che sia «easy to find».
Esisteva già, funzionava, e nessuno l'avrebbe trovata: stava dentro la modale
«Modifica profilo» della scheda atleta, cioè dietro un menu, dentro un foglio di
modifica, in fondo a un modulo. Ora è una `RigaPericolo` **sopra «Esci
dall'account»**, che è dove la si cerca.

⚠️ **Si mostra a TUTTI i ruoli, coach compreso.** Non è una svista: nasconderla a
chi è in `ADMIN_EMAILS` vorrebbe dire nasconderla a `demo@fleofit.it`, cioè
esattamente all'account con cui entra il revisore di Apple. C'è un test.

⚠️ **Nella scheda atleta è rimasto SOLO il coach che elimina un atleta**
(`proprioProfilo` in `EditAthleteModal`), che è un gesto diverso e ha il suo
cestino in «Eliminati di recente». Due porte per lo stesso gesto sarebbero state
peggio di una sola nascosta: la seconda smette di essere aggiornata (§9 punto 1).

🔴 **Il messaggio NON promette che riaccedendo si annulla, perché è falso.**
`ProtectedRoute` non filtra `deleted_at`: si rientra e la riga resta comunque
marcata, e dopo 7 giorni `delete_expired_athletes()` la elimina in cascata con
tutto lo storico (§4). L'unica via indietro è **Atleti → «Eliminati di recente»**,
che ce l'ha il coach — ed è quello che il testo dichiara. C'è un test che cade se
qualcuno ci rimette la promessa comoda.

### ⚠️ Cosa questa cancellazione NON fa ancora
Due limiti da conoscere prima di dire che è chiusa del tutto:
1. **La riga in `auth.users` sopravvive.** Dal client non si può togliere: serve
   `supabase.auth.admin.deleteUser`, quindi la service role key, quindi una Edge
   Function nuova. Non è bloccata dalla regola 0-bis (non è schema) ma è un
   deploy, e va fatta con la stessa cautela di `send-reminders` (§1.1). Finché
   non c'è, l'identità con cui si accedeva resta viva: chi ha cancellato il
   profilo e rientra con Apple o Google finisce sul passo del codice invito.
   ⚠️ E `delete_expired_athletes()` **non è nel repository** (§4), quindi non è
   verificabile da qui se tocchi anche `auth.users`: si legge con
   `select prosrc from pg_proc where proname = 'delete_expired_athletes';`
2. **Per un indirizzo in `ADMIN_EMAILS` non cancella davvero l'accesso.** Il
   ruolo coach viene dall'elenco hardcodato, non dal database (§9-ter): un admin
   che si cancella viene disconnesso, ma rientrando è ancora coach perché
   `ProtectedRoute` per lui salta del tutto il controllo sulla riga `athletes`.
   È una proprietà dell'elenco hardcodato, non di questo gesto.

### I file nuovi
`src/lib/rigaImpostazioni.js` (logica pura, 12 test) e
`src/components/ImpostazioniUI.jsx` (sola presentazione).
`src/pages/__tests__/Impostazioni.test.jsx` porta 17 test, tutti verificati per
mutazione.

---

## 9-tervicies. Il tasto «indietro» (02/09/2026)

Segnalazione del committente: «spesso in tutta l'app quando premo il tasto per tornare
indietro mi riporta non alla schermata precedente ma un po' dove vuole lui».
Non era un difetto di una pagina: erano **quattro cause diverse** che producevano lo
stesso sintomo, e due di esse si annullavano a vicenda nei casi facili — che è la
ragione per cui il difetto sembrava capriccioso invece che sistematico.

### Le quattro cause, in ordine di quanto mordevano

1. 🔴 **Tre pagine avevano una destinazione FISSA che ignorava da dove si veniva.**
   `AthleteDetail` tornava sempre a `/athletes`, `AthleteReport` sempre a `/report`,
   `WeeklyReport` sempre a `/`. Ma alla scheda di un atleta si arriva dai **feedback**
   della Home coach, dagli **atleti fermi**, dalla **squadra della giornata**, dal
   **report settimanale** e dal **report del singolo**: in tutti quei casi il tasto
   portava nella rubrica, cioè in una schermata in cui non si era mai stati. È
   letteralmente «dove vuole lui», ed era il caso più frequente.
2. 🔴 **La scheda del workout navigava a SÉ STESSA.** Toccare un atleta nell'elenco
   «Assegnato a» va su `/workout/:id?athlete_id=X`, cioè la **stessa rotta** con una
   query diversa. Con la push, il tasto indietro riportava a una schermata che sembra
   identica a quella da cui si viene — si legge come un tocco che non ha funzionato — e
   cinque atleti guardati erano **cinque «indietro» per uscire**. Ora è un `replace`:
   si sta cambiando quale atleta si guarda, non si sta entrando in una pagina nuova.
3. 🔴 **La tab bar impilava.** `NavLink` senza `replace`: la history diventava il
   percorso di tutta la sessione — Home, Calendario, Atleti, Home, Calendario — e il
   tasto indietro di una pagina di dettaglio la ripercorreva a ritroso, portando in
   schermate che l'utente non ha mai «aperto» ma solo attraversato. Le voci della barra
   sono destinazioni di pari grado, non passi di un cammino: si sostituiscono, come su iOS.
4. 🔴 **`navigate(-1)` non fa NIENTE quando la pagina è la prima della sessione.**
   Aperta da una notifica push (`notifications.route`), da un deep link `fleofit://` o
   dopo una ricarica della webview, dietro non c'è nessuna pagina dell'app: sul web si
   esce dal sito, nella webview il tocco non produce niente. Ed è l'unico caso in cui
   quel tasto è **indispensabile**, perché non esiste nessun altro modo di uscire da lì.

### La forma: `src/useIndietro.js`, e vale per le sette pagine che hanno il tasto
Si torna alla pagina precedente **quando esiste**, e al ripiego dichiarato dalla pagina
quando non esiste — `useIndietro('/athletes')`, `useIndietro('/report')`, `useIndietro('/')`.
Il ripiego non è la destinazione: è la rete sotto il caso 4.

⚠️ **`location.key === 'default'` è il modo di sapere se c'è qualcosa dietro, e non ce
n'è un altro.** React Router marca così la prima voce della propria history, quella con
cui l'app si è avviata. `window.history.length` **non serve**: conta anche le pagine di
altri siti visitate prima nella stessa scheda, quindi direbbe «c'è qualcosa dietro»
proprio quando quel qualcosa non è nostro.

⚠️ **Il ripiego usa `replace`**, e senza il difetto è sottile: la pagina da cui si è
usciti resterebbe nella pila, quindi un secondo «indietro» ci riporterebbe **dentro**
invece che fuori — un tasto indietro che va avanti. C'è un test che cade solo su quello.

⚠️ In `CreateWorkout` la conferma «Sì, esci» serve **due** uscite diverse: `pendingPath`
porta o la rotta di un link intercettato (una stringa) o la sentinella `INDIETRO`, che
non è una rotta — passarla a `navigate` porterebbe su `/-1`.

### I test, e le tre mutazioni che prendono
`src/__tests__/useIndietro.test.jsx` ha tre test **perché le due forme sbagliate
falliscono ognuna nel caso che l'altra copre**: la destinazione fissa passa il test sul
ripiego e cade sul secondo, `navigate(-1)` nudo passa il secondo e cade sul primo.
Verificato per mutazione: ogni mutazione fa cadere esattamente un test.

⚠️ **Un test storico è caduto, ed è caduto per il motivo giusto.** «Tornando indietro
NON riporta in cima» (§9-noviesdecies) si appoggiava alla push della tab bar per creare
la voce di history su cui tornare: col `replace` quella voce non esiste più. È stato
riscritto su una navigazione **dentro** una pagina, che è anche il caso che descrive.

### Cosa NON è stato toccato
I `navigate(-1)` che seguono un'**eliminazione** (`handleDeleteWorkout`): lì non è un
tasto indietro, è «questa pagina non esiste più», e la pila è quella giusta.

---

## 9-quatervicies. Il modello predittivo del carico (02/09/2026)

Richiesta del committente: sapere **quanto pesa un allenamento** prima di darlo a
qualcuno. Il vincolo che dà forma a tutto: il workout **si crea prima e si assegna
dopo**, quindi mentre lo si compone non si sa a chi andrà. Il modello è perciò
diviso in due metà — `src/lib/previsione.js`, funzioni pure, 38 test.

### Il problema, in una riga
Il coach assegnava a memoria. La scheda diceva quanto dura un allenamento e con
che RPE, mai **quanto costa a quella persona in quella settimana**: chi stava
reggendo il carico e chi no si ricavava aprendo una scheda alla volta.

### Cosa c'è ora
1. **DURANTE** — nel builder, una quarta cella «Carico ≈269» e sotto una riga che
   la colloca: «Sopra la media delle tue sedute Hyrox (≈120)».
2. **ALL'ASSEGNAZIONE** — ogni riga del foglio può portare **un** avviso con il
   numero da cui esce («Carico +81% sulla sua media»), e al passo 2 la frase
   intera. Vale nei due fogli, che sono l'uno il rovescio dell'altro: la scheda
   del workout ha un workout e dodici atleti, la scheda dell'atleta ha un atleta
   e cento workout.

### ✅ LE DUE SCALE DI CARICO NON CI SONO PIÙ (dal 09/09/2026)
🔴 **Questa sezione descrive un problema CHIUSO, e va letta al passato**: dal
09/09/2026 lo stimatore è **uno solo** — `durataWorkout` somma `durataBlocco`
per i blocchi Hyrox (BACKLOG #40, §9-undetricies). Resta qui perché spiega
perché `caricoPrevisto` e `caricoAssegnazione` sono ancora **due funzioni**: la
seconda usa l'`rpeAtteso` di `statistiche.js`, che è un calcolo diverso dal
`rpeAtteso` di `stimaWorkout.js` — quella duplicazione **non** è stata chiusa.

Com'era, e perché il difetto era impossibile da notare: convivevano **due
stimatori di durata**, e su un blocco «For Time» da 5 round differivano
dell'**89%** (`durataWorkout` addebitava 15 minuti fissi a round, `durataBlocco`
sommava gli esercizi: 75 minuti contro 8). Il carico si misurava perciò in due
modi, e ognuno andava confrontato **solo** con un paragone costruito allo stesso
modo:

- **`caricoPrevisto`** (il builder) misura con `stimaWorkout`, cioè con gli stessi
  strumenti delle due celle che gli stanno accanto: la quarta cella è il
  **prodotto** delle prime due, e un coach che moltiplica a mente ritrova il
  numero. Anche la media delle sue sedute passate è misurata così.
- **`caricoAssegnazione`** (il warning) misura con `durataWorkout` e con
  l'`rpeAtteso` di `statistiche.js`, cioè con gli **stessi due strumenti con cui
  `caricoDi` ha misurato lo storico** e con cui `scartoRpeDi` misura lo scarto.
  Un numeratore e un denominatore costruiti con stimatori diversi darebbero un
  rapporto sbagliato, e sbagliato **nella direzione pericolosa**: un workout
  pieno di For Time si proietterebbe quasi senza peso contro uno storico gonfiato
  dallo stesso tipo di blocco — direbbe «tranquillo» proprio dove non lo è.

✅ **Unificare i due stimatori era la correzione vera, ed è stata fatta il
09/09/2026** (§9-undetricies). ⚠️ Conseguenza da conoscere prima di leggere un
numero del modello: **i carichi sono saliti**, perché la durata è salita. Sullo
stesso Hyrox di prova `caricoPrevisto` passa da **≈211 a ≈516**. Le soglie del
modello (`rapportoCarico`, `acwrProiettato`) sono **rapporti**, quindi non si
spostano — numeratore e denominatore salgono insieme — ma il numero assoluto in
cima al builder sì, e va ritarato sull'occhio del coach.

### ⚠️ Le sette cose da sapere prima di rimetterci mano

1. 🔴 **L'ordine degli avvisi È la regola, e la PAUSA viene prima di tutto.**
   Chi ha chiesto di fermarsi ha la settimana vuota per definizione, quindi
   qualunque allenamento gli produce un salto di carico enorme: con il carico
   davanti gli si rimetterebbe addosso proprio l'allarme che la pausa esiste per
   togliere (§9-decies). **Trovato da un test, non leggendo il codice**: la prima
   stesura mostrava «Carico +112%» a un atleta in pausa. Poi il carico, il
   rientro, l'aderenza, l'accumulo sul giorno, il bias, l'occasione.
2. 🔴 **Il verde non si dichiara.** Chi non ha niente da segnalare non riceve
   nessuna riga: con dodici nomi in elenco, un «tutto ok» accanto a undici rende
   invisibile l'unico ambra. E **un solo motivo per riga**, il più grave
   (§9-vicies punto 4).
3. 🔴 **Dati insufficienti ≠ tutto bene.** Un atleta nuovo e un workout senza
   intensità dichiarata producono una riga **grigia** che dice *perché* il
   modello tace, mai un silenzio — che si leggerebbe come verde. È la sesta
   comparsa della regola di `rpeAtteso` (`null`, non 5).
4. 🔴 **Il cancello sta sullo storico VERO.** `acwrProiettato` non calcola niente
   se `stato.carico.acwr` è `null`. Non è ridondante rispetto a
   `rapportoCarico`: il carico proiettato renderebbe «attiva» anche la settimana
   bersaglio, e un atleta con quattro sedute in **una sola** settimana si
   vedrebbe assegnare un rapporto nato da un allenamento non ancora fatto. C'è un
   test che è l'unico a prenderlo.
5. **L'avviso NON blocca mai.** «Conferma» resta premibile. Un avviso che
   impedisce un gesto è un avviso che si impara a disattivare — e questo è
   costruito su una stima.
6. **La lettura in più è UNA e parte all'APERTURA DEL FOGLIO**, non della pagina:
   la scheda è la pagina più aperta dell'app e questi dati servono a un gesto che
   quasi sempre non si fa. Se fallisce, i semafori **non compaiono** e
   l'assegnazione funziona esattamente come prima — con una riga che lo dice.
   ⚠️ In `AthleteDetail` **non c'è nessuna lettura in più**: la pagina ha già lo
   storico per l'eroe «come sta andando», e lo passa al foglio come prop.
7. ⚠️ **`fetchAthletes` ora chiede anche `notes`**, che è dove vive la pausa
   (§9-decies). Toglierlo non darebbe nessun errore: la pausa smetterebbe
   semplicemente di vedersi. Il test lo verifica sulle **colonne chieste**,
   perché il finto Supabase non filtra le colonne e l'asserzione a schermo
   passerebbe lo stesso.

### 🔴 Le frasi degli avvisi NON hanno genere
Trovato guardando la pagina di anteprima, non leggendo il codice: la prima
stesura scriveva «**Fermo** da 10 giorni» e «**Per lui** un 9 vale ≈10» — e sul
dispositivo quelle righe stavano accanto ad Arianna e a Giulia. Metà degli
atleti sono donne, e questi avvisi compaiono sempre affiancati a un nome. Ora si
dice **che cosa è successo** e non chi l'ha fatto: «Nessun allenamento da 10
giorni», «Un 9 previsto vale ≈10», «Assegnare un allenamento è legittimo».
⚠️ Il test `nessun avviso è declinato al maschile` scandaglia **ogni ramo** con
una sola espressione regolare. Ci sono voluti due giri: la prima versione non
comprendeva il caso del **bias** nell'elenco, ed è proprio lì che era rimasto un
«lui lo sentirà intorno a 10».

### 🔴 Il difetto che solo la pagina a 393px ha mostrato
Con **quattro** celle ogni colonna scende a ~74px e «RPE ATTESO» va a capo,
mentre «DURATA» e «CARICO» no: i quattro numeri finiscono su due basi diverse e
la carta si legge come rotta. ⚠️ Accorciare l'etichetta a «RPE» è la soluzione
sbagliata — è proprio «atteso» a distinguerla da «Il tuo RPE» dichiarato
dall'atleta (§9-duodecies punto 2). Si riserva lo spazio di **due righe** a tutte
le etichette, e solo quando le celle sono quattro. È lo stesso genere di difetto
del conto alla rovescia del cestino (§9-septdecies punto 7): nessun test lo
avrebbe preso.

### Le mutazioni, che è il modo in cui questi test sono stati scritti
**24 mutazioni provate, 24 prese** — ma non al primo giro: cinque erano sfuggite,
e tutte e cinque per lo stesso motivo di sempre (§9-sexies). Le due che vale la
pena ricordare: «la collocazione confronta tutte le corsie» era invisibile perché
l'intruso era una **corsa**, che non ha blocchi e quindi nessun carico da
scartare; e «il giorno accanto si segnala sempre» chiedeva un allenamento
**morbido** accanto a uno duro, perché la guardia sta sul workout in arrivo e non
sul vicino.

### Cosa NON è stato fatto
Le **fasi 3 e 4** (previsto contro realizzato nel report, e il brief in cima al
builder) sono il pezzo successivo. Il **generatore dei blocchi** resta bloccato
dal #25: senza il *risultato* di una seduta produrrebbe programmazione plausibile
e cieca, che è ciò che il report esiste per evitare. I due fogli di assegnazione
**non sono stati ridisegnati**: il semaforo si innesta nelle righe che ci sono.

---

## 9-quinvicies. L'ambiente di prova (02/09/2026)

Nasce da un problema che il progetto ha da sempre e che si è visto solo quando
c'è stato qualcosa da far provare: **non c'è modo di usare l'app senza usare i
dati veri**. `ios-version` parla con il database di **produzione**, condiviso
con la web app, e non esiste staging (§1.1). Provare il modello del carico
voleva dire o guardare una vetrina, o assegnare allenamenti ad atleti veri — e
un'assegnazione fa partire anche una push a una persona.

### Cosa c'è
`npm run demo` (cioè `VITE_DEMO=1 vite`). L'app **intera** gira su
`src/supabaseDemo.js`, un Supabase finto in memoria seminato da
`src/demoSemi.js`. Si clicca tutto: si crea un workout, lo si assegna, si
completa con l'RPE, si naviga il report. Niente esce dal browser.

### ⚠️ Le sei cose da sapere prima di rimetterci mano

1. 🔴 **Non entra nel bundle di produzione, ed è la condizione che lo rende
   accettabile.** `import.meta.env.VITE_DEMO` viene sostituito da Vite in fase
   di build, quindi in una build normale il ternario di `supabaseClient.js`
   diventa `false` e Rollup butta via il modulo. Se un giorno quel controllo
   diventasse una variabile a runtime, il finto client finirebbe nell'`.ipa`
   spedito ad Apple.

   🔴 **IL CONTROLLO SCRITTO QUI ERA UNA META' DI VERITA', E IL 09/09/2026 HA
   LASCIATO PASSARE IL SEME.** Diceva `grep -l "AMBIENTE DI PROVA"
   dist/assets/*.js` → nessun file, e infatti quel giorno **passava**: il finto
   client e il nastro erano davvero fuori. Ma `demoSemi.js` era **dentro** —
   `Sara Villa`, `Andrea Conti`, i titoli dei workout di prova e le loro
   assegnazioni erano nel bundle in preparazione per Apple, e nessun controllo
   li vedeva perché quella stringa sta solo in `supabaseDemo.js`.
   **Perché ci finivano**: i tre elenchi di `demoSemi.js` erano costanti a
   livello di modulo costruite chiamando `A()`, `W()` e `AW()`. Rollup non può
   dimostrare che una chiamata sia pura, quindi teneva gli inizializzatori —
   mentre `invitation_codes` e `personal_records`, scritti come **letterali
   puri**, li buttava. La differenza fra le due metà è tutta lì, ed è invisibile
   a chi legge il sorgente.
   Corretto rendendo i tre elenchi **funzioni**: a livello di modulo non resta
   nessuna chiamata, e l'albero sparisce quando `semi` non ha chiamanti.

   **La verifica giusta cerca il SEME, non il client** (il seme è l'ultimo a
   uscire, quindi se non c'è lui non c'è niente):
   ```bash
   grep -l "AMBIENTE DI PROVA\|at-sara\|fleofit_demo_db" ios/App/App/public/assets/*.js
   ```
   → **nessun file**. ⚠️ E si guarda `ios/App/App/public`, non `dist`: è quella
   la copia che Xcode compila (§2).
2. 🔴 **NON è un clone di Postgres.** Implementa i metodi che l'app usa davvero,
   censiti il 02/09/2026: 16 metodi di catena, 8 tabelle, **due sole relazioni**
   (`athlete_workouts → workouts` e `→ athletes`). Se una pagina comincia a
   usare `.or()` o una relazione nuova, il sintomo è **una lista vuota, non un
   errore**: va aggiunta qui.
3. **Le date del seme sono RELATIVE a oggi.** Un seme con date scritte a mano
   invecchia, e dopo una settimana «questa settimana» è vuota e metà delle
   schermate non ha più niente da mostrare.
4. **Ogni atleta finto esiste per far scattare UN ramo** del modello (§9-quatervicies),
   e il commento accanto al nome dice quale. Se un ramo smette di comparire, si
   parte da lì. ⚠️ Andrea Conti ha una seduta chiusa **domenica scorsa** apposta:
   senza, risulterebbe «fermo», e il rientro precede l'aderenza nell'ordine degli
   avvisi — la riga direbbe un'altra cosa.
5. **I feedback più vecchi di tre giorni nascono «già letti».** Non è cosmesi:
   una nota che contiene solo il marcatore RPE conta come feedback
   (`feedbackNuovi`), quindi quattro settimane di sedute misurate aprivano la
   Home con «35 da leggere» — comportamento corretto dell'app, ma non somiglia a
   nessun coach vero.
6. **Il nastro giallo si ritira dopo quattro secondi.** A schermo intero copre la
   prima riga dell'intestazione — data e conteggio atleti — e questo ambiente
   serve anche a *guardare* le schermate. Un nastro che nasconde ciò che si è
   venuti a vedere è un nastro che si finisce per togliere.

### Cosa NON copre
Le cose che non sono database: le **Edge Function** (`invoke` logga e basta,
quindi nessuna push parte), lo **storage** (le note vocali si caricano ma l'URL
è finto), il **Realtime** (la Live Coach Cam non vede nessuno). Sono
esattamente i pezzi che in prova non si possono provare — ed è bene che
falliscano in silenzio invece di rompere la pagina.

---

## 9-sexvicies. Sign in with Apple (03/09/2026)

Rifiuto di App Store del **02/09/2026** sulla build 1.1.0 (3), **linea guida 4.8 —
Design: Login Services**. ⚠️ Non è il rifiuto di maggio che torna: il 2.3.1(a)
resta chiuso (§9-ter). Questo è nuovo, e riguarda un pezzo che c'era da sempre.

### Il rilievo si capisce al contrario di come sembra
La 4.8 **non vieta i login di terze parti**. Dice che se ne offri uno devi offrire
*anche* un'alternativa che rispetti tre condizioni, di cui una sola morde: deve
permettere di **tenere nascosta la propria email a tutti**, te compreso. Google
non lo fa. E non lo fa nemmeno **email+password**, che è la ragione per cui «ma
c'è già l'accesso con email» non è una risposta valida: un account creato con il
proprio indirizzo non tiene quell'indirizzo privato da nessuno.

Quindi il lavoro è **additivo**. Google resta esattamente dov'era (decisione del
committente, 03/09/2026), e accanto è nato Sign in with Apple.

### 🔴 SUL NATIVO NON SERVONO NÉ UN SERVICES ID NÉ UNA CHIAVE `.p8`
È il contrario di quello che dicono quasi tutte le guide, e vale mezza giornata
più un carico di manutenzione permanente. Il Services ID e la chiave servono al
flusso **OAuth via browser**, cioè al web, dove Supabase scambia un authorization
code. Il flusso nativo non passa di lì: l'app riceve l'ID token **direttamente da
Apple** e lo consegna a Supabase, che ne verifica la firma con le chiavi pubbliche
di Apple e controlla che l'`aud` sia un bundle id autorizzato.
Con loro sparisce anche il **client secret che scade ogni 6 mesi** — che sarebbe
stato il costo peggiore dell'operazione, perché alla scadenza il login smette di
funzionare senza preavviso e senza un errore in app.

Resta quindi soltanto:
- Apple Developer → App ID → capability **Sign In with Apple**, ⚠️ su
  `it.federicoleo.fleofit` **e su `it.federicoleo.fleofit.dev`**: in Debug da
  Xcode l'app gira col secondo. È la stessa trappola dei due bundle id delle push
  (§4), ripresentata identica su un'altra funzione.
- Supabase → Authentication → Providers → Apple → **Client IDs** con **entrambi**
  i bundle id separati da virgola, e **Secret Key vuoto**. 🔴 Con il solo Services
  ID il login web funzionerebbe e quello sull'iPhone no: sul nativo il
  destinatario del token è il **bundle id**.
- `com.apple.developer.applesignin` in `ios/App/App/App.entitlements`, più la
  capability aggiunta in Xcode su Debug **e** Release (serve a rigenerare il
  provisioning profile).

### 🔴 IL PLUGIN È FERMO A CAPACITOR 7, E IL SINTOMO NON DICE NIENTE
Successo il 03/09/2026, sul dispositivo: **«SignInWithApple plugin is not
implemented on ios»**. Quel messaggio si legge come «manca il plugin» e porta a
reinstallarlo, a rifare `cap sync`, a ripulire Xcode. Non è niente di tutto ciò.

`@capacitor-community/apple-sign-in@7.1.0` — che è **l'ultima versione
pubblicata**, non una vecchia — dichiara `capacitor-swift-pm` con
`from: "7.0.0"`, che in SPM vuol dire `>= 7.0.0 < 8.0.0`. Ogni altro plugin del
progetto dichiara `from: "8.0.0"` e l'app blocca la versione a `exact: "8.3.4"`.
Il grafo dei pacchetti quindi **non si risolve affatto**:

```
xcodebuild: error: Could not resolve package dependencies:
  'apple-sign-in' depends on 'capacitor-swift-pm' 7.0.0..<8.0.0 and
  'capacitor-voice-recorder' depends on 'capacitor-swift-pm' 8.0.0..<9.0.0.
```

E qui sta la parte che inganna: **Xcode compila lo stesso**, riusando il grafo
precedente, e il build **riesce**. Il ponte JS del plugin arriva comunque, perché
lo porta `npx cap sync ios` insieme al bundle. Quindi in mano si ha un'app che
sembra costruita bene, con il bottone al suo posto, e un'implementazione nativa
che non è mai stata compilata.

Come si verifica, invece di dedurlo:
```bash
cd ios/App && xcodebuild -resolvePackageDependencies -project App.xcodeproj -scheme App
```

**La correzione** è una riga, ed è bloccata nel repo: `patches/` +
`patch-package` chiamato dal `postinstall` di `package.json`. Non è stata scelta
per pigrizia rispetto a vendorizzare i 60 righi di Swift dentro `ios/App/App/`:
quel progetto Xcode **non usa i gruppi sincronizzati col filesystem**, quindi un
file nuovo va aggiunto al target a mano — e sbagliare quel passo produce
**esattamente questo stesso errore**, in silenzio. La patch invece fallisce
rumorosamente: senza, il build non risolve e lo dice.
⚠️ Se un giorno esce una `7.1.1`, `patch-package` avvisa che la patch non si
applica più. È il comportamento giusto: quel controllo non va disattivato.

### 🔴 E UN BUILD NORMALE NON BASTA: SERVE IL CLEAN
Corretto il vincolo, `-resolvePackageDependencies` riesce e `Package.resolved`
elenca il pacchetto — ma **il build incrementale continua a non compilarlo**,
perché il grafo dei bersagli in `DerivedData/.../XCBuildData` è ancora quello di
prima. Il build riesce, e l'app dà lo stesso errore di runtime. Verificato: la
cartella `Build/Intermediates.noindex/CapacitorCommunityAppleSignIn.build` non
esisteva, mentre c'erano tutti gli altri diciotto plugin.
Serve **Product → Clean Build Folder** (o `xcodebuild clean build`). Dopo, si
controlla sul prodotto e non sul log:
```bash
strings <App.app>/App.debug.dylib | grep -c SignInWithApple   # 0 = non c'è
```

### 🔴 IL NONCE VA HASHATO DA UN LATO SOLO
È il punto in cui questa integrazione fallisce senza dire perché, ed è
verificabile leggendo le due metà:
- il plugin fa `request.nonce = call.getString("nonce")`: scrive nel token **la
  stringa che gli diamo**, non il suo hash;
- `@supabase/auth-js` documenta l'opposto — «If the ID token contains a `nonce`
  claim, then **the hash of this value** is compared to the value in the ID
  token».

Quindi **hash al plugin, valore in chiaro a Supabase**. Lo stesso valore ai due
lati dà un 400 che sembra un problema di configurazione su Apple Developer, e ci
si perdono ore a rifare una configurazione che era già giusta. Sta in
`src/lib/appleLogin.js`, e c'è un test che monta la pagina e verifica che uno sia
lo SHA-256 dell'altro.

⚠️ `generaNonce` torna **`null`** quando la WebView non espone `crypto.subtle`, e
non lancia: senza nonce il token non porta il claim, Supabase non ha niente da
confrontare, e il login entra lo stesso. Si perde la protezione dal riutilizzo di
un token già speso — il compromesso che accettano gli esempi nativi di Supabase —
e si guadagna che un contesto non sicuro non chiuda fuori tutti.

### 🔴 IL NOME ARRIVA UNA VOLTA SOLA, E POI MAI PIÙ
Apple manda `givenName`/`familyName` **solo alla primissima autorizzazione**, e
non sono nel token: da lì in poi tornano `null`. Se non si scrivono subito in
`user_metadata` sono persi per sempre, e il sintomo non è un errore — è
l'onboarding coi campi vuoti e la Home che saluta `email.split('@')[0]`, che con
«Nascondi la mia email» è una stringa di caratteri casuali.
⚠️ Per la stessa ragione `nomeDaApple` torna `null` invece di un oggetto con due
stringhe vuote: scriverlo cancellerebbe il nome salvato la prima volta.

### ⚠️ Le quattro conseguenze da conoscere prima di dire che è un bug
1. 🔴 **Chi si allena già NON deve entrare con Apple.** Supabase unisce due
   identità solo se l'email combacia, e con «Nascondi la mia email» l'indirizzo è
   un `@privaterelay.appleid.com` che non combacia mai. Quell'atleta ottiene un
   utente **nuovo**, senza riga `athletes` e senza codice invito, e
   `ProtectedRoute` lo caccia su `/login?error=unauthorized`. Sign in with Apple è
   di fatto la porta dei **nuovi inviti**, non un secondo ingresso per chi c'è già.
2. 🔴 **Un account con email nascosta non può essere coach.** Le tre liste admin
   sono per indirizzo (§4-bis), e un relay non è in nessuna delle tre. Il coach
   continua a entrare con `coaching@federicoleo.it` e password.
3. ⚠️ **Il recupero password non arriva a un indirizzo relay** se il dominio
   mittente non è registrato nel servizio di inoltro di Apple. Non blocca niente —
   chi entra con Apple non usa la password — ma non è un percorso da promettere.
4. **Il bottone è bianco e sta SOPRA quello Google**, e non è gusto: la 4.8 chiede
   che l'alternativa non sia «meno in vista» delle altre, ed è la prima cosa che
   il revisore guarda dopo un rilievo su quella linea guida. Su fondo scuro le
   linee guida di Apple prescrivono il bottone bianco, quindi un bottone nero su
   `#1e1e1e` sarebbe conforme al marchio e fuori norma rispetto alla 4.8.

### Il bottone si mostra solo sul NATIVO
Sul web servirebbe il Services ID che il progetto non ha — la web app è fuori da
questo lavoro, per decisione del committente. Un bottone che non può funzionare è
peggio che non averlo: stessa regola del badge sulla navbar (§9-quaterdecies) e
del pannello filtri dell'archivio (§9-sedecies). C'è un test che lo verifica dai
due lati. ⚠️ Quel ramo lo toccano **solo** questo file e `useTastiera`:
`src/test/setup.js` finge sempre «web», quindi va acceso a mano con
`window.Capacitor` — e `Login.jsx` legge il **globale**, non il modulo
`@capacitor/core`.

### I file nuovi
`src/lib/appleLogin.js` (logica pura, 8 test) e
`src/pages/__tests__/LoginApple.test.jsx` (8 test su `Login` montata). Sei
mutazioni provate sulla pagina, sei prese. Plugin
`@capacitor-community/apple-sign-in@7.1.0` (dichiara `@capacitor/core >= 7`, ed è
compatibile con SPM: `npx cap sync ios` lo elenca fra i 19).

---

## 9-septvicies. Il rework dell'accesso (04/09/2026)

Stesso progetto Claude Design degli altri nove schermi
(`4a238081-a3ee-4f59-ae34-100f29d55601`), artboard `Login.dc.html`, opzione
**1b**. È l'unico dei dieci che cambia anche il **flusso**, non solo il JSX:
la schermata di accesso è l'unico posto in cui la forma *è* il flusso.

### Il problema, in una riga
Il benvenuto chiedeva «Accedi» o «Nuovo Utente», cioè una cosa **che l'utente
non sa**: chi sbagliava il bivio finiva contro il muro del codice invito, che
non spiegava né cos'era il codice, né chi lo dà, né cosa fare senza. E la CTA
gialla — l'unico tratto forte della pagina — stava sul percorso che riguarda
una persona al mese, mentre chi torna ogni giorno prendeva il bottone grigio.

### Cosa c'è ora
1. **Il benvenuto** è una colonna sola di modi per entrare — Apple, Google,
   email — identica per chi ha un profilo e per chi non ce l'ha. Sotto, la nota
   ambra che dice **cos'è** il codice e **quando** verrà chiesto.
2. **Il passo 2** chiede il codice a chi serve: otto caselle, maiuscolo
   automatico, «Incolla dagli appunti», e la verifica che parte da sola
   all'ottavo carattere.
3. **L'invito accettato** è una card verde che resta a schermo finché il
   profilo non esiste, con dentro il codice: prima veniva messo da parte e non
   si vedeva più in nessuna schermata.
4. **«Non ho un codice»** è un foglio con tre risposte, dove prima c'era un
   vicolo cieco.

### 🔴 IL VICOLO CIECO ERA IN `App.jsx`, NON NEL LOGIN
È la parte che si perde leggendo solo la pagina. Chi entra con Apple o Google
**prima** di avere un profilo — cioè il caso normale di un nuovo invitato —
non passava mai dal login: passava da `ProtectedRoute`, che faceva `signOut()`
e mandava a `/login?error=unauthorized`, cioè a un alert «Accesso Negato»
senza nessuna via d'uscita se non chiudere l'app. Il codice non gli veniva
**mai** chiesto.

Ora quel ramo scrive `fleofit_invito_atteso` (email + provider) ed esce su
`/login?serve=invito`, che è il passo 2. Il `signOut()` resta: senza un
profilo non si entra, e quello è ancora il punto che lo decide — la RLS e il
riscatto del codice non sono stati toccati di una riga.

⚠️ Conseguenza voluta: dopo il codice, chi è entrato con Apple o Google deve
**ritoccare lo stesso bottone** (la card verde glielo ripropone). Non è un
passaggio dimenticato: il codice si riscatta con una sessione, e la sessione
l'abbiamo appena chiusa. Un tocco su un provider che ha già autorizzato è un
Face ID, contro un'app da chiudere e riaprire senza sapere perché.

### ⚠️ Le sei cose da sapere prima di rimetterci mano

1. 🔴 **Il nome del coach NON si può leggere, e l'artboard lo mette.**
   `invitation_codes.created_by` è un id di `auth.users`, e chi non è ancora
   dentro non ha nessuna query che lo risolva in un nome: `athletes` si legge
   solo per la propria riga o da admin. Servirebbe una policy nuova o una
   funzione `security definer`, cioè una migrazione, e lo schema è congelato
   (regola 0-bis). La card dice quindi «Il tuo coach ti ha invitato» e mostra
   **il codice**, che è vero — scrivere un nome a mano sarebbe un dato
   inventato sulla schermata che deve dimostrare di sapere chi sei.
2. 🔴 **«Non esiste» e «già usato» non sono distinguibili**, e nemmeno questo
   è una scelta di copy: la policy che serve chi non è dentro filtra
   `is_active = true and used_by is null`, quindi un codice riscattato torna
   come risposta **vuota** esattamente come uno mai esistito. Il messaggio
   porta perciò entrambi i rimedi in una frase sola. Indovinarne uno manda
   metà delle persone a rifare una cosa già fatta.
3. 🔴 **`maybeSingle()` e non `single()`.** Con `single()` «nessuna riga»
   arriva come **errore**, indistinguibile da un guasto di rete — e i due
   rimedi sono opposti («chiedine uno nuovo» contro «riprova fra un momento»).
   C'è un test che cade solo su quella confusione.
4. 🔴 **`normalizzaCodice` riconosce anche il LINK**, ed è il caso più
   frequente: Impostazioni offre «Copia codice» **e** «Copia link», e il link è
   quello che si manda su WhatsApp. Senza quel ramo, chi lo incolla ottiene
   otto caratteri presi dall'indirizzo — un codice sbagliato lungo come quello
   giusto, e un errore che non spiega niente.
5. **Le otto caselle sono UN campo solo**, disegnato in otto. Con otto input
   l'incolla riempirebbe la prima e basta, la correzione diventa un labirinto,
   e VoiceOver leggerebbe otto campi senza nome invece di uno chiamato «Codice
   invito».
6. **Il passo 1 email non indovina il ramo, e non può.** Supabase non dice se
   un account esiste (è la difesa contro l'enumerazione degli indirizzi):
   password sbagliata e profilo inesistente tornano lo stesso «Invalid login
   credentials». Quindi lì si offrono **le due uscite** — «Password
   dimenticata» e «Ho un codice invito» — invece di sceglierne una a caso. Con
   Apple e Google il ramo si sa davvero, ed è il motivo per cui quei due
   percorsi sono più corti.

### 🔴 Il difetto che solo la pagina a 393px ha mostrato
La riga «Non ho un codice» era ancorata in fondo, e a tastiera chiusa lasciava
**mezzo schermo di vuoto** fra sé e le caselle. L'artboard la disegna subito
sotto il bottone «Incolla», con la tastiera aperta a occupare il resto — che è
lo stato in cui questa schermata si guarda davvero. Nessun test lo avrebbe
preso: è lo stesso genere di difetto del conto alla rovescia del cestino
(§9-septdecies punto 7) e delle quattro celle del builder (§9-quatervicies).

### Cosa NON è stato fatto, e perché
- **Il passo 1 email non è ridisegnato.** L'artboard copre il benvenuto e il
  codice, e il suo `dv-next` dà il form email fra i prossimi pezzi di design:
  prende la cornice condivisa e niente di più. Stessa scelta dello step 2 della
  corsa nel builder (§9-undecies) e del pannello filtri dell'archivio.
- **«Termini» e «Privacy» sono testo, non collegamenti.** `privacy-policy.html`
  sta in radice, fuori da `public/`, e la riscrittura di `vercel.json` non lo
  serve: non esiste una URL che funzioni. Un link a un 404 sulla schermata di
  accesso è peggio di una riga che non promette una destinazione — voce in
  BACKLOG.
- **L'onboarding non è toccato.** Dopo il codice il percorso è quello di
  sempre: sessione → `ProtectedRoute` riscatta il codice → `Onboarding`.

### I file nuovi
`src/lib/codiceInvito.js` (logica pura, 8 test) e
`src/components/LoginUI.jsx` (sola presentazione).
`src/pages/__tests__/LoginInvito.test.jsx` porta 14 test, tutti verificati per
mutazione: sette mutazioni provate, sette prese.

---

## 9-duodetricies. Gli stati senza storico della Home atleta (09/09/2026)

Stesso progetto Claude Design degli altri dieci schermi
(`4a238081-a3ee-4f59-ae34-100f29d55601`), documento
`codice/ISTRUZIONI-STATI-VUOTI.md`, stati **2a** (giorno 1), **2b** (prima
settimana) e **2c** (giorno di riposo). Come per gli altri: **nessun campo di
Supabase cambia forma**, nessuna query nuova, nessuna dipendenza nuova. La
logica di `Home.jsx` — fetch, swipe di completamento, modale RPE, coda offline,
notifiche realtime — non è stata toccata.

### Il problema, in una riga
La Home era scritta per un atleta che ha già uno storico, e per chi non ce l'ha
mostrava **quattro zeri perfettamente corretti**: anello 0/0, «Serie: 0 giorni»,
«Volume · RPE 0 min», e «In arrivo» vuoto. Cioè quattro numeri veri che dicono a
chi ha appena installato l'app che è **già indietro**.

### 🔴 LA REGOLA, ED È UNA SOLA
*Nessuna cella mostra uno zero. Al posto di un dato che non esiste ancora va la
cosa che lo farà esistere.* È la stessa famiglia di `rpeAtteso` che torna `null`
invece di 5 (§9-octies), del `—` di `DurataBlocco` (§9-undecies punto 2) e del
`—` della rubrica (§9-septdecies punto 3) — ma applicata a **una schermata
intera** invece che a una cella.
**Corollario:** una cella che si sbloccherà dichiara la soglia e il progresso
(«Media RPE · si accende dopo 3 allenamenti · 1/3»), e la soglia si scrive solo
quando c'è un progresso da raccontare: `0/1` è di nuovo lo zero che la regola
toglie, ed è la ragione per cui `soglia` di `CellaBloccata` è **facoltativa**.

### Cosa c'è ora
- **2a · Giorno 1** — blocco giallo «*Federico Leo* ti segue da oggi» con la
  scorciatoia al profilo, la domanda sull'obiettivo, la card per registrare il
  primo allenamento, e le tre righe di «Come funziona».
- **2b · Prima settimana** — l'anello si chiama «Settimana 1 · **iniziata**»
  invece di «completati», e la colonna destra del bento porta «Primo dato»
  (minuti, giorno e RPE di quella seduta) più la cella bloccata della media RPE.
  Sotto, `BannerObiettivoVuoto` al posto del countdown.
- **2c · Riposo** — al posto del tratteggio «Recupera le energie»: la corsia
  Running, i minuti chiusi in settimana, la card del carico con lo scarto sulla
  precedente, cosa arriva dopo, e «Ho fatto qualcosa comunque».

### ⚠️ Le nove cose da sapere prima di rimetterci mano

1. 🔴 **Il ramo del giorno 1 CHIUDE la pagina, non è una card in più.** Se
   restasse sopra l'albero esistente, sotto di esso ci sarebbero ancora i
   quattro zeri — cioè il difetto intero, con un cappello sopra. C'è un test che
   cade solo su questa forma.
2. 🔴 **`{weeklyStatus.length > 0 && …}` non proteggeva da niente**, ed è la
   ragione per cui il difetto è sopravvissuto: `weeklyStatus` nasce **già con
   sette giorni** (`useState` con inizializzatore, in cima a `Home.jsx`), quindi
   quella condizione è sempre vera. È lo stesso difetto trovato sulla Home coach
   il 28/08 (§9-nonies) sullo stesso identico stato.
3. 🔴 **`primaSettimana` si conta sui COMPLETATI, mai su `storicoAtleta.length`.**
   Quelle righe comprendono gli assegnati ancora da fare: un atleta con cinque
   allenamenti in programma e nessuno fatto ha `length === 5`, quindi con quel
   criterio uscirebbe dalla prima settimana e leggerebbe «Serie: 0 giorni» e
   «0 min». È il caso che il conteggio delle righe lascia passare, e c'è un test.
4. 🔴 **`storicoAtleta` è in ordine ASCENDENTE** (`.order('completed_date',
   { ascending: true })` nel fetch), quindi «il primo dato» è `completati[0]`.
   Il documento di design lo dava per discendente e diceva di verificarlo: con
   un solo completato `[0]` e `.at(-1)` coincidono, quindi la mutazione si vede
   solo da due allenamenti in su — il test ne usa due apposta.
5. 🔴 **`CellaPrimoDato` porta i minuti di QUELL'allenamento, non
   `weeklyStats.time`.** Il primo completato può essere della settimana scorsa,
   e allora il totale settimanale vale 0: la cella scriverebbe «0 min» sotto una
   data e un RPE veri. Il test lo prende mettendo il primo completato **fuori**
   dalla settimana in corso — è l'unica configurazione in cui le due letture si
   separano.
6. 🔴 **`minutiSettimana` misura la settimana di CALENDARIO (lunedì-domenica),
   non una finestra mobile di sette giorni.** È la correzione fatta rispetto al
   documento di design: il numero accanto a cui vive — `weeklyStats.time` — è
   calcolato su `startOfWeek(…, { weekStartsOn: 1 })`, e una finestra mobile
   avrebbe prodotto uno scarto che non corrisponde al totale sopra di esso. È la
   regola del LUNEDÌ di §9-septdecies punto 4 e §9-vicies, per la quarta volta.
   Il caso che lo prende è la **domenica precedente**, che una finestra mobile
   conterebbe dentro la settimana in corso.
7. 🔴 **`scartoMinutiSettimana` torna `null`, non lo scarto**, quando la
   settimana precedente è vuota: «+214 min sulla scorsa» su una settimana in cui
   l'atleta non esisteva è un dato finto, e la card lo omette da sé. Vale anche
   quando la settimana scorsa ha solo assegnati **non fatti**: un allenamento
   saltato non è un termine di paragone.
8. ⚠️ **`CardDomani` mostra il PRIMO in arrivo, non «domani».** Se il prossimo
   assegnato è fra tre giorni, l'etichetta «Domani» è una riga che mente e
   nessun errore la segnala: il chiamante calcola `differenceInDays` e passa
   «In arrivo».
9. ⚠️ **Il riposo programmato e «il coach non ha assegnato niente» sono la
   stessa riga nei dati.** `todayWorkouts.length === 0` copre entrambi, e non
   esiste un campo che dica «oggi è rest». La frase «È parte del piano» è vera
   nel primo caso; è la versione onesta possibile finché quel campo non c'è, e
   chi non ha **niente in assoluto** lo intercetta prima il ramo del giorno 1.

### Il nome del coach è una costante, e non poteva essere altro
`src/lib/coach.js`. Dal lato atleta il nome del coach **non è interrogabile**:
lo schema non ha un `coach_id` — i coach sono un elenco di email dentro le
policy RLS (§4-bis), cioè uno studio con un coach solo — e `athletes` si legge
solo per la propria riga o da admin. È lo stesso muro contro cui sbatte già
`CardInvitoValido` in `LoginUI` (§9-septvicies punto 1), che per questo scrive
«Il tuo coach ti ha invitato» invece di un nome. Il giorno in cui esistono più
coach, quella è l'unica riga da sostituire con una lettura vera — e
`BenvenutoCoach` funziona anche senza: senza `coach` scrive «Il tuo coach ti
segue da oggi».

### 🔴 «Fissa l'obiettivo» apre il modale dell'allenamento libero, e va detto
Un obiettivo dell'atleta **non è una tabella**: gli eventi sono workout di
categoria `Event` che assegna il coach, e una colonna nuova su `athletes` è
vietata dal congelamento dello schema (regola 0-bis). `onFissa` punta perciò a
`setAutonomousModalOpen(true)`: la card non mente — chiede una data, e una data
la si può mettere. Farlo nascere direttamente come `Event`, così che compaia nel
calendario e nel `BannerObiettivo` esistente, è la strada a costo zero indicata
dal design ed è **in BACKLOG**, non implementata.

### ⚠️ Le classi dell'entrata sono state SOSTITUITE, non copiate
Il documento di design usa `animate-in fade-in slide-in-from-bottom-2`,
scrivendo che «arriva da tw-animate-css». **In questo progetto tw-animate-css
NON è installato** e quelle classi generano zero CSS (§9-duodecies punto 1 e
§9-quindecies punto 1, verificato sul bundle: `grep -c "animate-in"
dist/assets/*.css` → 0). Sarebbe stata la terza volta che lo stesso difetto
entra da una porta diversa. Qui l'entrata è `hero-transition`, il keyframe vero
di `src/index.css`, che è esattamente «sale di 8px mentre appare».

### 🔴 Il difetto che solo la pagina a 393px ha mostrato
`CardDomani` metteva `capitalize` sull'**intera** riga di meta, e
`text-transform: capitalize` non conosce le frasi: maiuscola **ogni parola**, e
si leggeva «Gio 10 · 2 **B**locchi · 56′». Nessun test lo avrebbe preso — nel
DOM il testo è già quello giusto, a cambiarlo è il foglio di stile. Ora
`capitalize` sta sul solo nome del giorno. È lo stesso genere di difetto del
conto alla rovescia del cestino (§9-septdecies punto 7), delle quattro celle del
builder (§9-quatervicies) e della riga «Non ho un codice» (§9-septvicies).

### Il codice morto che il rework ha lasciato indietro, ed è stato rimosso
**`HeroRest`** in `HomeAtletaUI.jsx` — il tratteggio «Giorno di rest · Recupera
le energie» — non ha più chiamanti: cancellato subito invece di restare
esportato «finché questa versione non è in produzione», che è il modo in cui una
correzione ne raggiunge due su tre (§9 punto 2). Con lui è uscito l'import di
`CalendarDays`, che era suo soltanto.

### I test, e le due mutazioni che erano nate invisibili
`src/lib/__tests__/statistiche-vuoti.test.js` (16) e
`src/pages/__tests__/HomeVuoti.test.jsx` (19), tutti verificati per mutazione:
**tredici mutazioni provate, tredici prese**. Due sono state riscritte perché la
mutazione le superava, ed è la stessa lezione di §9-sexies:
- «mostra il primo allenamento come dato» nasceva con **un solo** completato, e
  lì `completati[0]` e `.at(-1)` sono lo stesso oggetto: l'ordine di
  `storicoAtleta` non era coperto da niente. Ora ne usa due, e il secondo vale
  anche come totale della settimana — così la stessa asserzione prende sia
  l'ordine sia la lettura di `weeklyStats.time`.
- «con soli assegnati e nessun completato resta la prima settimana» non esisteva:
  con il conteggio delle righe il test sarebbe stato verde e l'atleta con cinque
  allenamenti in programma avrebbe letto quattro zeri.

⚠️ **Due test storici sono stati riscritti, e per il motivo giusto.** In
`NavigazioneApp.test.jsx` il marcatore «Giorno di rest» era la prova che la Home
fosse ancora a schermo: quel finto atleta ha `athlete_workouts: []`, quindi ora
vede il **giorno 1**. In `HomeCoach.test.jsx` l'assertion «l'admin non vede il
ramo atleta» sarebbe diventata **trivialmente vera** — quella stringa non esiste
più in tutta l'app — e ora guarda «ti segue da oggi», che è ciò che il coach
vedrebbe davvero rimettendo `role === 'admin'` accanto a `role === 'athlete'`:
il suo account è escluso da chi si segue (`COACHING_ID`), quindi non ha
storico, quindi per la Home è al giorno 1.

### I file nuovi
`src/lib/coach.js`, `src/lib/statistiche.js` (tre funzioni appese:
`senzaStorico`, `minutiSettimana`, `scartoMinutiSettimana`, più
`MINIMO_PRECEDENTI` che diventa esportata — è la stessa soglia con cui
`mediaRpeCategoria` già tace, e due «3» scritti a mano direbbero «si accende
dopo 3 allenamenti» accendendola al quarto) e
`src/components/HomeAtletaVuotiUI.jsx` (sola presentazione).
`AnelloSettimana` prende due prop facoltative, `etichetta` e `stato`: i valori
numerici non cambiano, cambia solo come si chiamano.

### Cosa NON è stato fatto, e perché
- **L'obiettivo non nasce come `Event`** (vedi sopra): è in BACKLOG.
- **`fattiSettimana`/`assegnatiSettimana` non sono passate ad `AnelloSettimana`**,
  che continua a ridurle al suo interno. Sono lo stesso `useMemo` e la stessa
  sorgente, quindi non possono divergere; cambiare il contratto di un componente
  già coperto da test per risparmiare una riduzione su sette elementi è un
  rischio senza guadagno.
- **La ridondanza fra `HeroRiposo` e `CardSettimanaChiusa` è rimasta.** Sul
  riposo della prima settimana lo schermo dice «82 minuti in 2 giorni», poi
  «82 min · 2 / 3», poi l'anello «2/3»: tre volte gli stessi due numeri. Il
  disegno chiede entrambi, e nessuno dei due è sbagliato — la frase è il perché,
  la card è il dato — ma è una decisione di prodotto, non di implementazione:
  voce in BACKLOG.

---

## 9-undetricies. Uno stimatore di durata solo (09/09/2026) — BACKLOG #40

Segnalazione del committente, guardando due screenshot del simulatore uno
accanto all'altro: lo **stesso** allenamento diceva **58 minuti** nella Home e
**24** nella scheda, a due tocchi di distanza. «Sistema la durata, deve dire 58
anche nella scheda.»

### Perché era invisibile
Non era un arrotondamento: erano **due formule diverse**, e nessuna delle due
era sbagliata presa da sola.

| | `durataWorkout` (statistiche.js) | `durataBlocco` (stimaWorkout.js) |
|---|---|---|
| chi la leggeva | Home, report, calendario (volume), `caricoAssegnazione` | scheda, builder, archivio, grafica da storia, `caricoPrevisto` |
| «For Time» | **15 min fissi × giri** | somma degli esercizi × giri |
| «Cash In/Out» | **5 min fissi × giri** | somma degli esercizi × giri + rest |
| su `hyroxCompleto` | 8 + 5 + 45 = **58** | 8:00 + 4:23 + 11:15 = **24** |

Il difetto si vedeva solo mettendo due schermate affiancate, ed è saltato fuori
esattamente così: preparando gli screenshot per l'App Store.

### 🔴 La direzione l'ha scelta il committente, ed è l'OPPOSTA di quella che il backlog proponeva
BACKLOG #40 proponeva «far leggere a `durataWorkout` la stima per esercizio e
tenere i 15 minuti come ripiego», cioè far vincere il **24**. È stata scartata,
e la ragione non è di codice: **sommare gli esercizi misura il tempo in cui
l'atleta si sta muovendo**, a ritmo di gara e con zero transizioni — non quello
che passa nel box. Su un «For Time» quel divario è di tre volte. Chi sa quanto
durano davvero le sedute è il coach, e il numero è 58.

### Com'è fatto adesso
- I due forfait vivono in **due costanti esportate** di `stimaWorkout.js`:
  `MINUTI_GIRO_FOR_TIME = 15` e `MINUTI_GIRO_CASH = 5`.
- `durataWorkout` **non ha più una formula propria** per i blocchi Hyrox: fa
  `for (const b of blocchiDi(s)) minuti += durataBlocco(b) / 60`.
- La **corsa resta in `statistiche.js`**: `stimaWorkout.js` conosce solo i
  blocchi Hyrox, e le fasi di corsa hanno un formato tutto loro.

La proprietà che si guadagna, e che con due formule era impossibile: **il totale
in cima alla scheda è la somma dei blocchi che la scheda stampa uno per uno**.
Un coach che li somma a mente ritrova il numero.

### ⚠️ Le quattro cose da sapere prima di rimetterci mano

1. 🔴 **Il forfait si applica solo a un blocco che CONTIENE qualcosa.** Un «For
   Time» ancora vuoto non dura 45 minuti: non è stimabile, e la scheda ci deve
   scrivere «—» invece di «0:00» (§9-undecies punto 2). **È una svista che ho
   commesso davvero**, e l'ha presa un test che esisteva già — «un blocco senza
   esercizi non inventa una durata»: con il forfait nudo, un Cash Out vuoto da
   due giri dichiarava 10 minuti.
2. 🔴 **Il prezzo è visibile in scheda, e va accettato consapevolmente:** un
   «For Time» dichiara 15 minuti a giro **qualunque cosa contenga**. Tre burpees
   e tre giri completi di Hyrox pesano uguale, e la barra proporzionale del
   riepilogo è quasi tutta sua (45 su 58). È il compromesso di una stima a
   forfait, ed è la ragione per cui l'interfaccia continua a scrivere «≈».
3. 🔴 **I carichi sono saliti con la durata.** `caricoPrevisto` è il prodotto
   durata × RPE: sullo stesso Hyrox passa da **≈211 a ≈516**. Le soglie del
   modello predittivo sono **rapporti** (`rapportoCarico`, `acwrProiettato`),
   quindi non si spostano — numeratore e denominatore salgono insieme — ma il
   numero assoluto del builder sì, e va ritarato sull'occhio del coach.
4. ⚠️ **`rpeAtteso` è ANCORA in due copie** (`statistiche.js` e
   `stimaWorkout.js`), e sono due calcoli diversi per le stesse parole: la Home
   parte da `sections.intensity` e ripiega su una tabella per tipo di blocco, il
   builder fa la media di potenza. Questa sessione ha unificato la **durata**,
   non l'RPE. Resta in BACKLOG.

### I test
Sette toccati, e due riscritti perché la regola che dichiaravano è cambiata:
- **«For Time moltiplica gli esercizi per i round»** → **«For Time è un forfait
  per giro, qualunque cosa contenga»**, con due asserzioni: la cifra, e il fatto
  che aggiungere 2000 m al blocco **non** la cambi. È la seconda a distinguere
  le due formule, ed è l'unica che cade su una mutazione «rimetti la somma».
- **«un blocco senza esercizi non inventa una durata»** → esteso al «For Time»,
  perché è il test che ha preso la svista del punto 1.
- Nuovo: **«il totale è la somma dei blocchi, non un secondo calcolo»**, che
  confronta `durataWorkout` con la somma di `durataBlocco` calcolata **nel
  test**. ⚠️ La mutazione che conta non è «ricopia le costanti» — quella dà gli
  stessi numeri e il test resta verde, correttamente — ma «ricopia le costanti
  **e poi cambiane una**», che è il modo reale in cui i due stimatori
  tornerebbero a divergere. Verificato: cade solo lì.
- Riallineati i numeri di `WorkoutDetailScheda` (34 → 37 min, carico 269 → 292):
  ⚠️ quel test protegge l'**invariante** — il carico è il prodotto delle due
  celle accanto — non la cifra.

---

## 9-untricies. L'orb dell'attesa IA (15/09/2026)

Richiesta del committente: portare gli **orb** di `thinking-orbs`
(https://libraries.dev/orbs) nella funzione IA di «Crea Workout». Installata
la libreria, la decisione è stata **un solo slot**: l'attesa della generazione.

### Dove NON va, e la ragione è già scritta altrove
🔴 **Mai sull'alone del microfono in ascolto.** L'orb `listening` si anima sul
proprio orologio, indifferente a quello che il microfono riceve: metterlo lì
sarebbe **letteralmente il difetto `Math.random()` di §9-quindecies**, rimesso
dentro dalla porta principale otto mesi dopo averlo tolto. Quell'alone deve
restare fermo quando il microfono è morto, e continua a seguire `livello`.
Scartati anche la card «Genera con IA» a riposo (animerebbe per sempre una
pagina che non sta pensando, con un rAF acceso in tutto il builder) e i
`Loader2` di export in `StoriaUI` (durano meno di un secondo, e porterebbero
la libreria anche nel chunk di `WorkoutDetail`).

### ⚠️ Le quattro cose da sapere prima di rimetterci mano

1. 🔴 **`theme` è PINNATO a `dark`, e non è pedanteria.** Con `auto` la
   libreria cerca un `data-theme`/`.dark` sugli antenati — che in questo
   progetto **non esiste**, l'app è scura e basta — e ricade su
   `prefers-color-scheme` **del telefono**: su un iPhone in modalità chiara
   disegnerebbe inchiostro scuro su `#1e1e1e`, cioè niente. Il sintomo sarebbe
   «l'orb non si vede su alcuni telefoni», che è il genere di segnalazione da
   cui non si risale.
2. 🔴 **Senza `aria-label` il canvas se ne mette uno INGLESE da solo**
   (`role="img" aria-label="Composing…"`), sopra una riga italiana che ha già
   `role="status"` — e VoiceOver leggerebbe prima quello. Si passa
   `aria-hidden="true"`, com'era l'anello CSS di prima, **e** l'etichetta
   italiana: se un giorno l'`aria-hidden` cade, almeno non ne esce inglese.
3. **L'orb è monocromatico e non si colora.** I punti sono dipinti
   `rgba(M,M,M,a)` in scala di grigi, non c'è nessuna prop colore e non c'è
   `currentColor`. Quindi è **bianco**, non viola — decisione del committente
   (15/09/2026): è l'inchiostro chiaro per cui i nove stati sono stati
   disegnati, e su `#1e1e1e` legge come il testo della stessa card. Il viola
   resta l'icona in testata e la CTA. Tingerlo con un `filter` CSS
   (sepia+hue-rotate) funzionerebbe ed è stato scartato: degrada la resa dei
   punti e aggiunge un filtro GPU su ogni fotogramma.
4. **`ORB_ATTESA` tiene `stato` ed `etichetta` nella STESSA riga**, ed è il
   punto della modifica: la generazione fa **due** lavori diversi — dalla voce
   Gemini deve prima ascoltare la registrazione, dal testo legge e basta — e
   la riga sotto l'orb lo diceva già a parole. Tenere stato ed etichetta in
   due tabelle è il modo in cui l'orb finisce a comporre mentre l'etichetta
   dice che sta ascoltando.

### Cosa si guadagna oltre alla grafica
`animate-spin` gira comunque; l'orb **rispetta `prefers-reduced-motion`** con
un fotogramma fermo, si **sospende** fuori viewport (`IntersectionObserver`) e
a scheda nascosta. Ed è robusto in jsdom: `if (!ctx) return`, quindi senza
contesto 2D non esplode.

### ⚠️ Il finto canvas dei test ora serve DUE disegni
Lo stub di `ambienteAudio()` in `CreaWorkoutIA.test.jsx` era tarato sulla forma
d'onda: l'orb aggiunge `setTransform`, `arc`, `moveTo`/`lineTo`/`stroke`. Il
suo primo fotogramma è **sincrono dentro l'effetto**, quindi un metodo mancante
lì non è un orb disegnato male — è un'eccezione che porta giù il foglio, con
due test che falliscono su «non trovo Sto scrivendo l'allenamento». È successo
davvero, ed è la stessa nota che il file portava già per `createLinearGradient`.

### Il costo
+15 KB sul chunk `CreateWorkout` (76 → **91 KB**). Il motore importa tutti e
nove i modi dal registry, quindi **non si tree-shaka** scegliendone due. Su iOS
il bundle è già sul dispositivo: è costo di parsing, non di rete, e resta un
altro ordine di grandezza rispetto agli 830 KB di `jspdf` di §9-noviesdecies.

### I test, e le tre mutazioni
Due nuovi in `CreaWorkoutIA.test.jsx` (930 test in tutto). ⚠️ Il secondo accende
il **ramo nativo** — `src/test/setup.js` finge sempre «web», e il percorso
«fermo la registrazione → Gemini ascolta» esiste solo lì: `mockNativo` più un
finto `capacitor-voice-recorder`, come fa `LoginApple.test.jsx`.
Tre mutazioni provate, tre prese, ognuna da un test diverso: l'orb che smette
di seguire il lavoro (cade il test sulla voce), l'`aria-hidden` tolto (cade
quello sul testo), l'anello CSS rimesso al posto dell'orb (cadono entrambi).
⚠️ Gli assert interrogano il **DOM** e non i ruoli, proprio perché
l'`aria-hidden` toglie il canvas dall'albero di accessibilità.

---

## 9-duetricies. Il fascio luminoso sulla superficie IA (15/09/2026)

Richiesta del committente: portare `border-beam`
(https://libraries.dev/beam) sulla funzione IA, **in due punti** — la card
«Genera con IA» dentro lo step 2 del builder, e il foglio che si apre
premendola. Installata la libreria (MIT, zero dipendenze, effetto tutto in CSS:
`conic-gradient` + keyframes + `filter`).

### 🔴 `colorVariant="ocean"`, e NON `colorful`
In questa app ogni colore significa già una categoria — giallo Hyrox, azzurro
Corsa, magenta Custom, bianco Gara (§6) — e un arcobaleno si legge come una
**quinta corsia che non esiste**, per giunta piazzata sull'unica superficie che
ha già un colore suo. `ocean` è blu-viola (`rgb(130,70,255)`,
`rgb(140,100,240)`), cioè il vicinato di `--color-ia` = `#a855f7`.

### 🔴 `staticColors`, o il bordo diventa VERDE
Trovato **guardando la pagina, non leggendo il codice**, e sarebbe passato
qualunque test. L'animazione di tinta è un
`filter: hue-rotate(calc(base ± 30deg))` — `± 40` sul bloom — e `hue-rotate` in
CSS è una matrice lineare che sui blu saturi **scavalca nel verde**. In questa
app il verde vuol dire **«allenamento completato»**, quindi il foglio dell'IA
lampeggiava periodicamente il colore di un'altra cosa. `staticColors` spegne
l'oscillazione e lascia i colori dove sono: è la prop che esiste apposta.

### 🔴 I due punti NON usano lo stesso preset, e non è una svista
- **La card**: `size="md"`, il fascio che gira intorno al bordo. È un bottone,
  e il giro si legge come un invito.
- **Il foglio**: `size="pulse-outside"`, il respiro che sborda verso l'alto.
  `md` lì dentro è stato provato ed è **quasi invisibile**, per una ragione
  geometrica: i lati e il fondo del foglio sono a filo con i bordi dello
  schermo, il contenitore di `md` ha `overflow: hidden`, e i segmenti del
  gradiente sono misurati in **pixel assoluti** — su un elemento largo 393 e
  alto 800 si diluiscono. L'unico bordo con spazio per vedersi è quello
  superiore, ed è esattamente quello che `pulse-outside` illumina.
  È anche il carattere giusto: su una superficie dove si legge e si scrive un
  respiro lento disturba meno di un fascio che gira.

### 🔴 `classeFoglio` e `stileFoglio` sono saliti SUL FASCIO
Sono l'entrata `.sheet-in` e il trascinamento della maniglia
(`src/useBottomSheet.js`). Lasciandoli sul foglio, il fascio sarebbe rimasto
**fermo mentre il foglio scende sotto il dito** — una cornice luminosa sospesa
nel vuoto. Lo spostamento è sicuro solo perché `useBottomSheet` non tiene
nessun ref sul nodo: restituisce classe e stile e basta (§9-duodecies).
⚠️ Con essi è salito anche lo **`stopPropagation`**, che arriva al fascio come
prop di passaggio: se una versione futura della libreria smettesse di inoltrare
le props HTML, toccare il campo di testo **chiuderebbe il foglio**. C'è un test.

### 🔴 Il fascio della card sta nel CHIAMANTE, non dentro `CardIA`
Ed è la scoperta che conta di più di questa sessione, uscita dal build e non
dal codice. `CreaWorkoutUI.jsx` è un chunk **condiviso con `WorkoutDetail`**,
che ne importa `RiepilogoWorkout` e `BarraAzioni` (§9 punto 1): un
`import 'border-beam'` lì dentro lo portava a **88 KB**, cioè ~64 KB di fascio
scaricati a ogni apertura di una scheda, dove di fasci non ce n'è nemmeno uno.
È lo stesso danno che §9-noviesdecies aveva appena finito di togliere con
`jspdf`. Spostato il wrapper sul call site in `CreateWorkout.jsx`,
`CreaWorkoutUI` è tornato a **24 KB** e `WorkoutDetail` non si è mosso di un
byte.
> **La regola che ne esce**: una libreria di effetti non si importa mai in
> `CreaWorkoutUI.jsx`, `stiliCard.js` o in qualunque altro pezzo condiviso. Il
> peso lo paga chi usa l'effetto, non chi passa di lì.

### ⚠️ Il raggio non si scrive a mano
La libreria legge il `borderTopLeftRadius` del **primo figlio** e ci adatta il
fascio. Quindi cambiando `rounded-[20px]` su `CardIA` il fascio segue da sé:
passare `borderRadius` sarebbe il modo in cui i due si mettono a divergere di
4px senza che nessuno se ne accorga.

### 🔴 `window.matchMedia` non esiste in jsdom, e le due librerie non si comportano uguale
`thinking-orbs` lo protegge (`typeof matchMedia > 'u'`), `border-beam` lo chiama
**nudo** dentro un inizializzatore di `useState` — anche con `theme="dark"`
passato esplicitamente, cioè anche quando la risposta non gli serve. Senza uno
shim il foglio dell'IA **non si monta affatto**: 29 test cadevano su un errore
che non c'entrava niente con quello che verificano. Lo shim sta ora in
`src/test/setup.js`, accanto a quello di localStorage, e risponde sempre
`matches: false`.

### Il costo
**+64 KB** sul chunk `CreateWorkout` (91 → **156 KB**). È il prezzo pieno di un
effetto decorativo, e va saputo: su iOS il bundle è già sul dispositivo, quindi
è parsing e non rete, e il chunk è caricato su richiesta. Se un giorno pesasse
troppo, la strada è l'import pigro come per `jspdf`, non togliere l'effetto a
metà.

### I test
Uno nuovo (931 in tutto, poi 935 col §9-tertricies) più uno riscritto:
- **«toccare DENTRO il foglio non lo chiude»**, che protegge lo
  `stopPropagation` diventato prop di passaggio;
- **«entra con un'animazione che ESISTE»** ora guarda il **genitore** del nodo
  `role="dialog"`. ⚠️ Non è una scorciatoia per farlo passare: è la condizione
  perché la cornice scenda insieme al foglio. La proprietà protetta è la stessa
  di prima — il keyframe vero, non `animate-in` che genera zero CSS.
Due mutazioni provate, due prese: tolto lo `stopPropagation` dal fascio, e
entrata e trascinamento rimessi sul foglio.

---

## 9-tertricies. «Salva workout» in fondo, e il blocco che si apre (15/09/2026)

Due segnalazioni del committente nello stesso messaggio, e la seconda è una
conseguenza della prima: «il salva workout deve essere in fondo e basta», e
«se scendo fino in fondo e premo su un blocco, il blocco si apre verso l'alto».

### 🔴 La barra NON è più ancorata QUI, ma lo resta nelle altre due pagine
`BarraAzioni` serve tre schermate (`CreateWorkout`, `WorkoutDetail`,
`AthleteDetail`), e cambiarla per tutte avrebbe toccato due pagine che nessuno
ha segnalato. Da qui la prop **`ancorata`**, che di default resta `true`.

La regola che decide quale valore usare, e non è un gusto: **ancorata dove
l'azione è la RAGIONE per cui si è aperta la pagina** — «Inizia allenamento»
nella scheda, «Assegna» nella scheda atleta: lì restare a schermo *è* il punto.
**In flusso dove l'azione è la CONCLUSIONE di un lavoro**: nel builder la barra
mangiava una riga di schermo per tutto il tempo in cui si compone il workout,
cioè proprio mentre si ha bisogno di vedere i blocchi.

Con l'ancoraggio se ne va anche il suo vestito — velo, `backdrop-blur`,
`border-t`. Servivano a separare la barra da ciò che le scorreva sotto; su una
barra che sta in fondo alla pagina diventano una riga netta sospesa sopra la
capsula della tab bar, ed è il secondo rilievo dello stesso messaggio.

⚠️ **La barra sparisce con la tastiera ANCHE non ancorata**, e non è un avanzo:
la pagina è `min-h-[100dvh]` con un `mt-auto` sopra la barra, quindi su un
passo corto sta comunque al fondo della viewport — che con
`Keyboard.resize: 'native'` si rimpicciolisce, incollandocela sopra esattamente
come prima (§9-undecies punto 8). `useTastiera.test.jsx` resta valido.

⚠️ **Il fondo pagina passa a `--fondo-pagina`**: senza una barra ancorata,
`CreateWorkout` ricade nella convenzione delle altre cinque pagine (§6).
ℹ️ Misurato: `App.jsx` riserva **già** `--altezza-navbar` per ogni pagina, e
ogni pagina ne aggiunge un'altra per conto suo — il doppio conteggio è
dell'app intera, non di questa modifica, e qui si limita a diventare visibile
come aria sotto la CTA invece che come spazio coperto dalla barra.

### 🔴 Aprire un blocco CHIUDE quello aperto prima, e la pagina si accorcia SOPRA LA TESTA
È tutto il secondo difetto. Se il blocco che si chiude stava più in **alto**
nella lista, il contenuto sopra sparisce e il blocco appena toccato scivola
fuori schermo verso l'alto. A schermo non sembra uno scorrimento: sembra che il
blocco si sia aperto al contrario.

Misurato nel browser prima e dopo, con cinque blocchi e lo scroll in fondo:
il titolo del primo blocco passa da **−351 px** (fuori schermo, sopra) a
**+12 px**, e ci resta.

Il meccanismo esisteva già — `bloccoDaMostrare` più l'effetto che scorre — ed
era cablato **solo** alla creazione di un blocco. Due righe:
1. `bloccoToggle` segna il blocco quando lo **apre** e azzera il segno quando
   lo **chiude**. ⚠️ La scrittura del ref sta **dentro** l'updater di
   `setOpenBlockId` perché `openBlockId` non può entrare nelle dipendenze del
   gestore: deve restare un riferimento stabile o `React.memo` su `HyroxBlock`
   smette di servire (§9-quinquies). È idempotente, quindi il doppio invio di
   StrictMode non cambia niente.
2. L'effetto dipende da **`[blocks, openBlockId]`** e non dalle sole `[blocks]`:
   aprire un blocco che c'era già non tocca la lista, quindi con le vecchie
   dipendenze non sarebbe mai scattato.

⚠️ **Richiudere un blocco NON deve scorrere**: chiudendo, il blocco toccato è
già in cima a ciò che sparisce e resta dov'è — uno scorrimento lì è la pagina
che si muove da sola sotto un dito che voleva solo fare spazio. C'è un test.
E resta valido quello storico: compilare i **parametri** di un blocco già
aperto non muove niente.

⚠️ **`scroll-mt-…` sulla radice del blocco porta la safe area**
(`calc(env(safe-area-inset-top)+0.75rem)`, era `scroll-mt-4`):
`scrollIntoView({ block: 'start' })` allinea al bordo della viewport, che su un
iPhone col notch sta **sotto** la barra di stato — il titolo arriverebbe in
cima e mezzo coperto proprio mentre lo si apre.

### 🔴 `requestAnimationFrame` non scatta in una pagina `visibilityState: hidden`
Vale per chiunque provi a verificare questa roba dal browser incorporato, e
costa mezz'ora di diagnosi sbagliata: col pannello non visibile la pagina non
disegna, quindi **il rAF non parte mai** e lo scorrimento non avviene — il
codice sembra rotto e non lo è. Anche `behavior: 'smooth'` non anima per la
stessa ragione, mentre `behavior: 'auto'` funziona. Per misurare la catena vera
si sostituisce `requestAnimationFrame` con un `setTimeout` e lo `smooth` con un
`auto`. È lo stesso genere di limite già annotato per `html-to-image`
(§9-unetvicies).

### I test, e le tre mutazioni
Quattro nuovi in `CreaWorkoutBuilder.test.jsx` (**935** in tutto). Tre mutazioni
provate, tre prese, ognuna da un test diverso: l'effetto rimesso su `[blocks]`,
il toggle che segna il blocco anche quando lo chiude, e `<BarraAzioni>` senza
`ancorata={false}`.
⚠️ I due test sulla barra verificano l'**assenza** di `sticky`, non la presenza
di qualcos'altro: è `sticky` a produrre il difetto, e una barra che guadagnasse
per sbaglio un secondo ancoraggio passerebbe qualunque asserzione sulle classi
nuove. Stessa lezione del bordo di `CARTA_RIGA` (§9-octodecies).
⚠️ Il test che conta di più apre il **PRIMO** blocco mentre è aperto l'ultimo:
aprendo l'ultimo la pagina cresce solo sotto e il titolo resta dov'era **anche
senza la correzione**, quindi quel caso non prende niente.

---

## 9-quatertricies. Il rifiuto del 20/09/2026: HealthKit, ATT e il rating (21/09/2026)

Terza bocciatura della stessa versione — build **1.0 (5)** — e per la prima
volta con **tre rilievi insieme**. La cosa da sapere prima di aprire un file:
**uno solo è codice.**

| rilievo | cosa dice | dove si corregge |
|---|---|---|
| **2.5.1** | il binario contiene riferimenti a HealthKit e l'app non ha una funzione primaria che li giustifichi | **codice** |
| **5.1.2(i)** | le etichette privacy dichiarano *tracking* su Email e Nome, e l'app non chiede il permesso ATT | **App Store Connect** |
| **2.3.6** | l'age rating dichiara *In-App Controls* che nell'app non si trovano | **App Store Connect** |

⚠️ La lettera scrive «Version reviewed: 1.0 (5)»: è il **record** 1.0 con il
**build** 5, non un declassamento, e `MARKETING_VERSION` non va riportato a 1.0.
È la stessa confusione già annotata in §9-ter, alla seconda comparsa.

### 🔴 2.5.1 — Apple Health è uscito del tutto, e non è una perdita
Il rilievo è letterale, e aveva ragione. Apple Health era **un bottoncino da
11px dentro la modale RPE**: premuto, leggeva l'ultimo allenamento della
giornata da Salute e **appendeva una riga di testo alle note**
(`🍏 [Apple Health] Durata: … | Calorie: … | Battiti Medi: …`). Nient'altro
nell'app lo leggeva: non le statistiche, non il carico, non il report. Quella
riga finiva in `athlete_workouts.notes` come testo libero accanto al marcatore
`[RPE: n/10]`, e da lì non tornava mai indietro.

Cioè: il permesso più delicato che iOS conceda, chiesto per scrivere una frase.

Non è stato disattivato, è stato **rimosso da tutte e cinque le porte** da cui
HealthKit entra in un'app Capacitor. Servono tutte e cinque, perché Apple guarda
il **binario** e ne basta una aperta:
1. `src/pages/health.js` (`HealthService`) — cancellato;
2. il bottone «🍏 Apple Health» e `handleHealthSync` in `RpeModal.jsx` (con
   loro se n'è andato l'import di `mostraErrore`, che serviva solo a quello);
3. `NSHealthShareUsageDescription` e `NSHealthUpdateUsageDescription` in
   `ios/App/App/Info.plist`;
4. `com.apple.developer.healthkit` in `ios/App/App/App.entitlements`;
5. il plugin **`@capgo/capacitor-health`** — `npm uninstall`, poi
   `npx cap sync ios` riscrive `CapApp-SPM/Package.swift` da sé: **19 plugin
   → 18**.

🔴 **Il punto 5 è quello che si dimentica, ed è l'unico che da solo fa respingere
la build.** Senza codice, senza entitlement e senza chiavi d'uso, un plugin
ancora elencato in `Package.swift` **linka comunque `HealthKit.framework`** al
binario, e `otool -L` lo dichiara. Il rilievo parla di *riferimenti nel binario*,
non di codice raggiungibile: un `if (false)` non salva nessuno.
⚠️ **`Package.swift` non si modifica a mano** — porta scritto «DO NOT MODIFY —
managed by Capacitor CLI». Si toglie il pacchetto npm e si sincronizza, o la
prossima `cap sync` lo rimette.

**Cosa NON è stato toccato, e per buone ragioni:**
- la **fascia cardio BLE** (`src/pages/bluetooth.js`) è **Core Bluetooth**, non
  HealthKit: legge i battiti dal dispositivo in tempo reale, non dall'archivio
  Salute, e resta dov'è;
- `LSApplicationCategoryType = public.app-category.healthcare-fitness` nel
  `pbxproj` resta: è la **categoria dello Store** di un'app di allenamento, non
  un riferimento a HealthKit. Toglierla non risponde a niente e sposta l'app
  in uno scaffale sbagliato.

**Il controllo 10 di `tools/verifica-ipa.sh`** guarda ora **quattro** tracce
sull'`.ipa` esportato — entitlement, chiavi `NSHealth*`, `otool -L` e la scritta
«Apple Health» nel bundle web — perché escono in momenti diversi e ognuna da
sola è mezza verità. È la stessa lezione del seme dell'ambiente di prova
(§9-quinvicies), che il controllo di allora lasciava passare proprio così.

### 🔴 5.1.2(i) — l'app NON traccia: a mentire sono le etichette
Il rilievo si legge male, e la lettura sbagliata costa una funzione inutile:
sembra chiedere di **aggiungere** l'App Tracking Transparency. Non è così. Apple
confronta due cose — cosa dichiari su App Store Connect e cosa fa il binario — e
qui a essere sbagliata è la **dichiarazione**: qualcuno ha spuntato
*Used for Tracking* su **Email Address** e **Name**.

«Tracking», per Apple, ha una definizione stretta: collegare i dati dell'app con
dati di **terze parti** a fini pubblicitari, oppure cederli a un **data broker**.
Verificato in questa sessione, ed è no su tutta la linea:
- **nessun SDK pubblicitario o di attribuzione** fra le dipendenze;
- **nessun IDFA**: zero occorrenze di `ASIdentifierManager` / `AdSupport` /
  `advertisingIdentifier` nei plugin nativi, e nessun
  `NSUserTrackingUsageDescription` in `Info.plist` — l'app non ha mai avuto
  nemmeno il modo di chiedere quel permesso;
- **Firebase c'è solo come `FirebaseMessaging`**, e lo dichiara il
  `Package.swift` del plugin `@capacitor-community/fcm` (un solo `.product`).
  `GoogleService-Info.plist` ha `IS_ANALYTICS_ENABLED = false` e
  `IS_ADS_ENABLED = false`.

Email e nome servono a far entrare l'atleta e a chiamarlo per nome. Sono
**Linked to You** — vero, e va dichiarato — ma **non** *Used for Tracking*.

**Il gesto** (serve il ruolo Account Holder o Admin): App Store Connect → l'app →
**App Privacy** → per **ogni** tipo di dato raccolto → *Used for Tracking* =
**No** → Salva. Poi rispondere nel **Resolution Center** che l'app non traccia su
nessuna piattaforma — Apple lo chiede esplicitamente nella seconda delle tre vie
d'uscita che elenca.

⚠️ **Aggiungere l'ATT sarebbe la correzione sbagliata**, e va detto perché è la
prima che viene in mente: chiedere un permesso che non serve a niente è a sua
volta un rilievo, e regala all'utente una schermata di sistema che non ha nessun
effetto su nessun comportamento dell'app.

### 🔴 2.3.6 — «In-App Controls» spuntato per sbaglio
Stessa forma del precedente: una casella del **nuovo age rating** dichiara che
l'app offre controlli parentali o un meccanismo di verifica dell'età. Non ne ha —
niente PIN, niente limite di tempo, niente age gate. `athletes.birth_date` serve
a scrivere «29 anni» nella scheda, non a sbarrare l'accesso a qualcosa.

**Il gesto**: App Store Connect → l'app → **App Information** → **Age Rating** →
Modifica → **Age Assurance / In-App Controls** = **None**.

### ⚠️ Due cose che stanno fuori dal repository e vanno controllate
1. **La descrizione sullo Store, le novità e gli screenshot.** Se citano «Apple
   Health» o «Salute», vanno ripuliti anche loro: il 2.5.1 dice esplicitamente
   *«as well as any references … from the app or its metadata»*, e una
   descrizione che promette una funzione che non c'è è per giunta un **2.3.1**.
2. **L'App ID su Apple Developer** ha ancora la capability *HealthKit* spuntata.
   Non basta a far respingere la build — l'entitlement lo chiede il progetto, e
   non lo chiede più — ma toglierla è l'unico modo di essere certi che non
   rientri da una rigenerazione del provisioning profile. ⚠️ Toglierla invalida i
   profili esistenti: con la firma automatica Xcode li rigenera, e serve comunque
   un **Product → Clean Build Folder**, esattamente come per Sign in with Apple
   (§9-sexvicies).

### Cosa cambia per l'atleta, e cosa succederebbe rimettendolo
Una riga in meno nella modale RPE, e nient'altro: le note già scritte che
contengono `🍏 [Apple Health] …` restano testo e continuano a leggersi ovunque.

Se un giorno quei numeri dovranno tornare, **la forma che Apple accetta non è il
bottoncino**. Il 2.5.1 chiede una funzione *primaria*: scrivere l'allenamento
**dentro** Salute a fine sessione — cioè `HKWorkout` con durata, calorie e
battiti, che è la ragione per cui esiste `NSHealthUpdateUsageDescription`, quella
che l'app dichiarava e non usava — e rileggerne i battiti per il report. È un
pezzo di prodotto, non una scorciatoia dentro una modale. Voce in BACKLOG.

---

## 10. Idee/direzioni note per il futuro

- Possibile **rebranding** (nome diverso da FLEOFIT) mantenendo la palette.
- Modifiche grafiche/UI attese, palette invariata.
- Integrazione **Strava/Garmin** via `cloud-sync` già predisposta lato client (`CloudSyncService`).
- Ruolo `coach` separato da `admin`, già abbozzato ma disattivato.
