# I branch: main, app e i superati

> Spostato da `CLAUDE.md` il 07/10/2026, **senza cambiare il testo**. I rimandi
> «§9-…» puntano a sezioni che ora stanno in altri file di questa cartella:
> si trovano con `grep -rn '^## 9-<nome>' docs/memoria`. L'indice è in `CLAUDE.md`.

## 1.1 I due branch — LEGGERE PRIMA DI TOCCARE main

> 🧩 **Aggiornamento 02/10/2026.** Il branch nativo si chiama ora **`app`** e contiene iOS e
> Android insieme. È nato da `android-version` (che a sua volta partiva dall'ultimo commit di
> `ios-version`), **senza** il commit che toglieva `ios/`. Tutto ciò che sotto si dice di
> `ios-version` — non è un branch di rilascio, diverge da `main`, il database è condiviso —
> vale oggi per `app`. `ios-version` e `android-version` restano su GitHub e non si toccano.
> Il database e le Edge Function servono ora **tre** app: web, iOS e Android.

Il progetto vive su **due branch con due prodotti diversi**, entrambi attivi:

| Branch | Cos'è | Dove finisce | Ultimo commit |
|---|---|---|---|
| **`main`** (default) | **Web app in produzione**, quella che gli atleti usano oggi | **collegato a Vercel** → `https://fleofit.vercel.app`. LIVE, non rompere | `c2ed65d` — 25 ago 2026 |
| **`app`** | Le app native **iOS e Android** sullo stesso codice (§A), quella caricata sull'App Store (§9-ter) | **collegato a NIENTE**: è solo il backup su GitHub del lavoro locale. Le app arrivano agli Store da Xcode e da Gradle, non da un deploy | **5 ott 2026** (`git log -1`) |
| ~~`ios-version`~~ · ~~`android-version`~~ | superati dal 02/10/2026: storia, non ci si lavora più | — | `ios-version` 23 set 2026 |

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
`git rev-list --left-right --count origin/main...origin/app` → **`49 119`**
(rimisurata il 05/10/2026 dopo il primo push di `app`: `main` è fermo al 25/08, `app`
continua a muoversi; fino al 23/09 si misurava su `ios-version`, `49 108`). ⚠️ **Questo numero invecchia di uno a ogni commit, questa riga
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
