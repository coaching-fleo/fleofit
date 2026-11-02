# Il QR della TV dalla fotocamera: scegliere il workout — design

Data: 02/11/2026 · Approvato in sessione: approccio A (una pagina sua).
Segue `2026-10-30-tv-qr-design.md` (QR sulla TV, foglio «Collega TV», plugin `LettoreQR`).

> ⚠️ **Cambiato in revisione (02/11/2026):** `?aperto=` non esiste più. Se il QR arriva mentre è
> aperta una scheda, si resta sulla scheda (`/workout/:id?…&tv=<c>&chiedi=1`, navigazione con
> `replace`) e `FoglioChiediTV` chiede «Vuoi mandare in TV questo?» sopra la pagina e sopra il
> timer, che così non si azzera. «No, un altro» → `/collega-tv/<c>?altro=1`. Dove sotto si parla
> di `?aperto=`, vale questo. Il comportamento vero è in `docs/memoria/scheda-workout.md` (9-tv-qr).

## Cosa vuole il committente

Oggi, se si inquadra il QR della TV con la **fotocamera del telefono** (non dal foglio dell'app),
il link `fleofit://tv/<codice>` apre FLEOFIT e basta (`eLinkDellaTV` in `src/lib/linkTimer.js`).
Da ora l'app aiuta a scegliere **quale workout** mandare in TV, e poi si collega da sola:

- **atleta**: gli si propone il workout assegnato per oggi — «Vuoi aprire questo?» — e «Sì» lo apre;
- **admin e coach**: scelgono da un foglio corto di workout.

## Decisioni prese con il committente

- Atleta con **più workout oggi**: l'elenco di oggi. Con **nessuno**: «Oggi non hai workout
  assegnati» e sotto i suoi workout recenti per sceglierne uno.
- Admin/coach: **un foglio corto** (non l'archivio intero): i workout di oggi, poi quelli degli
  ultimi 7 giorni, e in fondo «Cerca nell'archivio», che apre l'archivio in modalità scelta.
- Se l'app era **già aperta su un workout**: prima si propone quello — «Vuoi mandare in TV
  questo?» — con «No, un altro» che porta alla scelta normale.
- Coach (non admin): come gli admin; vede solo i suoi workout perché lo impone la RLS.

## 1. L'arrivo: la rotta `/collega-tv/:codice`

- In `DeeplinkHandler` (`src/App.jsx`) il ramo `eLinkDellaTV` non fa più `return` e basta: estrae
  il codice con `codiceDaQR` (`src/lib/codiceTV.js`) e naviga a `/collega-tv/<codice>`. Se il
  link non ha un codice valido (es. `fleofit://tv`), resta com'è oggi: l'app torna davanti e basta.
- Se in quel momento la pagina aperta è `/workout/:id`, si aggiunge `?aperto=<id>` (e
  `&athlete_id=<uid>` se la pagina lo aveva).
- La rotta è privata (dentro l'unico `ProtectedRoute`) e la pagina `CollegaTV` è caricata con
  `lazy`, come le altre: il chunk `index` non deve crescere (CLAUDE.md §2). Senza accesso il
  `ProtectedRoute` manda al login; dopo il login non si ripropone niente.
- 🔴 Non è `/tv`: quella è la pagina pubblica della TV.
- Da verificare sul telefono: con l'app chiusa il link deve arrivare lo stesso (Capacitor
  conserva `appUrlOpen` finché qualcuno lo ascolta). Se non arriva, si legge `App.getLaunchUrl()`
  all'avvio.

## 2. La scelta: pagina `CollegaTV`

Logica pura in `src/lib/sceltaTV.js` (con test): dato il ruolo, i workout trovati e l'eventuale
workout aperto, dice cosa mostrare — `{ tipo: 'conferma', workout }` | `{ tipo: 'lista', oggi,
recenti }` | `{ tipo: 'vuoto', recenti }`. La pagina legge i dati e mostra un foglio dal basso
(stesso stile di `FoglioCollegaTV`: `sheet-in`, `velo-in`, `bg-[#1e1e1e] rounded-t-3xl`, X con
`aria-label="Chiudi"`). Chiudere = tornare alla Home.

- **Workout già aperto** (`?aperto=`): «Vuoi mandare in TV questo?», titolo (senza codice, con
  `separaCodice`), «Sì» e «No, un altro».
- **Atleta**: legge i suoi `athlete_workouts` con il `workouts` collegato (come fa la Home).
  - uno solo oggi → «Vuoi aprire questo?», «Sì» / «No, un altro» (che mostra i recenti);
  - più d'uno → elenco di oggi;
  - nessuno → «Oggi non hai workout assegnati» + gli ultimi 7 giorni.
  - Gli eventi (`category: 'Event'`) non si propongono.
- **Admin/coach**: `workouts` con `date` di oggi, poi gli ultimi 7 giorni (più recenti prima,
  al massimo ~20 righe), e «Cerca nell'archivio» → `/archive?tv=<codice>`.
- Ogni riga: titolo, categoria con il suo colore (`src/lib/colori.js`), data breve. Il tocco su
  una riga = scelta.
- Errore di lettura o offline: un messaggio e «Cerca nell'archivio» (admin) / «Riprova».

## 3. L'archivio in modalità scelta

- `/archive?tv=<codice>`: in alto la striscia «Scegli il workout da mandare in TV» con la X per
  uscire dalla modalità. Il tocco su un workout porta a `/workout/<id>?tv=<codice>` invece della
  scheda normale. Nient'altro cambia.

## 4. Il collegamento: `/workout/:id?tv=<codice>`

- `WorkoutDetail`, caricato il workout, se trova `?tv=` (4 cifre) chiama una volta la stessa
  `collegaTV(codice)` del foglio, toglie `tv` dall'indirizzo (`setSearchParams`, `replace`) e:
  - riuscito → come dal foglio: niente avviso; telecomando aperto solo se il workout ha il timer
    guidato (`timerDisponibile`);
  - codice non trovato o scaduto → si apre `FoglioCollegaTV` con «Codice TV non trovato o
    scaduto.» sotto il campo (il foglio accetta un messaggio iniziale).
- Se c'è già una TV collegata con un altro codice, si sostituisce (stessa funzione).
- La guardia contro la doppia chiamata vale anche qui (StrictMode, ri-render).

## Fuori da questo lavoro

- Web e app 1.2.2: niente cambia (il web non riceve `fleofit://`).
- Nessuna modifica al database: solo letture di `workouts` e `athlete_workouts`.
- Il foglio «Collega TV» aperto dal tasto TV resta com'è.

## Prove

- `sceltaTV.js`: atleta con 0/1/più workout oggi, eventi esclusi, admin, workout già aperto.
- Pagina `CollegaTV` montata (finto Supabase): atleta un workout → «Sì» porta a
  `/workout/<id>?tv=<codice>`; admin → lista e «Cerca nell'archivio».
- `DeeplinkHandler`: `fleofit://tv/1234` → `/collega-tv/1234`; da una scheda → `?aperto=`;
  `fleofit://tv` senza codice → nessuna navigazione.
- `WorkoutDetail` con `?tv=4321`: collegato, `tv` tolto dall'indirizzo, timer aperto; con `?tv=9999`:
  foglio aperto con il messaggio; una sola chiamata.
- Archivio con `?tv=`: striscia visibile, il tocco porta alla scheda con `?tv=`.
- Ambiente di prova: la pagina `/collega-tv/1234` da coach (`npm run demo`) e da atleta
  (`npm run demo:atleta`).
- 🔴 Sul telefono (lo fa il committente): inquadrare il QR con la fotocamera di sistema con l'app
  chiusa, in background e aperta su un workout; serve `npm run ios` / `npm run android`.

## Uscita

- Arriva solo con la prossima versione dell'app sugli Store (il link `fleofit://` esiste solo lì);
  sul sito non cambia niente di visibile, ma il codice è lo stesso branch.
- Memoria: `docs/memoria/scheda-workout.md` (sezione `9-tv-qr`, la parte del link), e la riga di
  `scheda-workout.md` nel §11 di CLAUDE.md con `sceltaTV.js` e `CollegaTV`.
