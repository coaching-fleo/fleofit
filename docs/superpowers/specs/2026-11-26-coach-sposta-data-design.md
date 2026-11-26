# Il coach sposta la data di un allenamento — design

> 26/11/2026 · approccio scelto dal committente: **A, la data diventa il comando**.

## Perché

Oggi cambiare la data di un allenamento a un atleta, per il coach, è un percorso
nascosto: scheda → ⋯ → **Modifica** → tutto il builder → campo data → salva
(`CreateWorkout.jsx`, ramo `awId` del salvataggio). Se un atleta l'ha già svolto,
«Modifica» è bloccato e propone «Duplica». Dalla scheda atleta non c'è nessuna
strada diretta. L'atleta invece ha già «Sposta a un altro giorno» (`FoglioSposta`,
`src/lib/spostaAllenamento.js`, `docs/memoria/calendario.md` §9-sposta).

Il committente sposta **in tutti e due i modi**: per un atleta solo («Marco
martedì non può») e per tutta la seduta (tutti gli atleti a cui è assegnata).

## Obiettivi

- Il coach sposta un allenamento in **un tocco più la scelta del giorno**, dalla
  scheda del workout e dalla scheda dell'atleta.
- Due portate: **solo un atleta** o **tutti** quelli che hanno quella seduta.
- L'atleta spostato dal coach lo viene a sapere con una push.

## Non obiettivi

- Trascinare nel calendario (approccio C): eventualmente più avanti, solo desktop.
- Spostare più workout diversi insieme (una settimana intera): c'è già «Copia
  settimana» nel calendario, è un'altra cosa.
- Cambiare il foglio «Sposta» dell'atleta: per lui resta tutto com'è.

## Anti-obiettivi (sarebbe un fallimento anche se funziona)

- Uno spostamento «per tutti» che riscrive la data di chi l'ha **già svolto** o di
  chi l'aveva **spostato da sé**: la storia dell'atleta cambierebbe senza che
  nessuno se ne accorga.
- Toccare `workouts.date` quando si sposta un atleta solo (sposterebbe gli altri:
  è la trappola già scritta in `CreateWorkout.jsx`).
- Un comando che c'è ma non si vede: la data toccabile deve **sembrare** toccabile.

## Vincoli

- **Schema congelato** (CLAUDE.md §0-bis): niente migrazioni. Non servono —
  `athlete_workouts.completed_date` e `workouts.date` il coach li scrive già
  (la RLS lo permette, lo fa oggi «Modifica»).
- Codice condiviso web/iOS/Android: nessun plugin nuovo.
- Garmin: i trigger `garmin_invii_assegnazioni` e `garmin_invii_workout` reagiscono
  già a ogni modifica di assegnazione e workout — lo spostamento riallinea
  l'orologio da solo, come già fa il «Sposta» dell'atleta. Nessun lavoro in più,
  ma va verificato nei test d'integrazione esistenti che non si rompa niente.
- Modali: `createPortal`, X `aria-label="Chiudi"` e «Annulla» (tasto indietro
  Android). Aptica solo da `aptica.js`.
- `send-reminders` è condivisa col sito: il deploy tocca anche la web app.

## Approcci considerati

| | Cosa | Pro | Contro |
|---|---|---|---|
| **A (scelto)** | La data in testa alla scheda e nelle righe è toccabile e apre il foglio «Sposta», con la scelta «Solo X · Tutti (n)». Bottone «Sposta» sulle righe della scheda atleta. Voce anche nel menu ⋯. | Il coach tocca la cosa che vuole cambiare: il gesto più naturale. Riusa foglio e logica dell'atleta. | Serve un segno che la data è toccabile. |
| B | Solo voci di menu e bottoni «Sposta» | Meno lavoro | Il comando resta in un menu: è il problema di oggi |
| C | Trascina nel calendario | Il più intuitivo su desktop | Sul telefono si scontra con lo swipe del mese; il più costoso |

## Il design

### 1. Il foglio: `FoglioSposta` con una modalità coach

Un foglio solo, quello dell'atleta, con props in più. Senza le props nuove si
comporta esattamente come oggi.

- `modo: 'atleta' | 'coach'` (default `'atleta'`).
- In modo coach:
  - **Le date passate si possono scegliere** (correggere un giorno registrato
    male). I sette giorni proposti restano da oggi in avanti; il passato si
    raggiunge dal calendario (`CustomDatePicker`) che il foglio ha già.
  - Testo: «**Marco** ha *Titolo* in programma mar 2 dic. In che giorno lo
    sposti?» (atleta solo) / «*Titolo* è in programma mar 2 dic. In che giorno
    lo sposti?» (tutti).
- **Scelta di portata** (solo se il workout ha più di un'assegnazione e si
  arriva con un atleta in mano): un toggle segmentato in cima al foglio, nello
  stile dei toggle dell'app (`bg-[#111] p-1.5 rounded-2xl`), **«Solo Marco ·
  Tutti (5)»**. Default: «Solo Marco» se si arriva da un atleta, «Tutti» se si
  arriva dal workout senza atleta.
- Con «Tutti», sotto i giorni una riga grigia dice chi **non** si muove:
  «2 restano dove sono: 1 già svolto, 1 spostato da sé». Niente riga se
  si muovono tutti.
- Bottone: «Sposta a gio 4» / «Sposta tutti a gio 4».

### 2. Le regole (logica pura in `src/lib/spostaAllenamento.js`)

- **Solo un atleta**: si scrive solo `athlete_workouts.completed_date` di quella
  riga (`spostaAssegnazione`, esiste). Vale **anche se è già svolto** (il coach
  può correggere la data di un allenamento fatto) e anche per una data passata.
  Mai `workouts.date`.
- **Tutti**: funzione nuova, pura, `chiSiSposta(assegnazioni, dataWorkout)` →
  `{ siSpostano, restano: { svolti, spostatiDaSe } }`:
  - si spostano le assegnazioni **non completate** con `completed_date ===
    workouts.date` (la data originale);
  - restano le completate e quelle con una data diversa (spostate dall'atleta o
    dal coach una per una).
  - Scrittura: `workouts.date` = nuova data, poi `completed_date` = nuova data
    sulle righe di `siSpostano` (un update con `.in('id', ids)`).
  - Se fallisce l'update delle assegnazioni dopo quello del workout: si rimette
    `workouts.date` com'era e si mostra l'errore (rollback, come gli
    aggiornamenti ottimistici dell'app).
- **Gare** (`isEvent`): **si spostano** in modo coach (la data della gara è del
  coach, non dell'atleta); niente portata «Tutti» se la gara ha un solo atleta.
  ⚠️ Da confermare in revisione, vedi «Calls fatte da me».
- Funzione `puoSpostareCoach({ evento })` → sempre vero oggi; esiste per avere
  un posto solo se arriveranno eccezioni.

### 3. Dove si apre

**Scheda workout (`WorkoutDetail.jsx`, coach/admin):**
- La **data in testa** (`TitoloScheda`, prop `data`) diventa un bottone con una
  piccola icona `CalendarDays` accanto e `aria-label="Cambia data"`. Solo per
  lo staff e solo se `puoAssegnare`: stesse regole di Modifica ed Elimina. Per l'atleta resta testo, il suo «Sposta» è nel menu.
- **Menu ⋯**: voce «Sposta a un altro giorno» anche per il coach.
- **«Assegnato a»**: ogni riga porta la propria data come testo toccabile nel
  `dettaglio` (oggi la data compare solo se diversa: resta così, ma la riga
  prende un'azione «Sposta» accanto al cestino, icona `CalendarClock`,
  `aria-label="Sposta la data di Marco"`) → foglio con portata «Solo Marco»
  fissa.
- Dopo lo spostamento: ricarica `assignments` e `workout`, `vibraSuccesso()`.

**Scheda atleta (`AthleteDetail.jsx`):**
- Le righe di «Oggi» e «In programma» e le righe di `CalendarioAtleta` prendono
  il bottone «Sposta» che `RigaSessione` già offre (`onSposta`). Foglio in modo
  coach con portata scelta: «Solo [atleta]» di default, «Tutti (n)» se il
  workout ha altri atleti (serve leggere il numero di assegnazioni del workout
  all'apertura del foglio).
- Dopo lo spostamento: ricarica la lista dell'atleta; il calendario va al
  giorno nuovo (come fa già `Calendar.jsx`).

### 4. La push all'atleta

- Mai al coach stesso. Una push per ogni atleta spostato, testo:
  «📅 Allenamento spostato — *Titolo* ora è gio 4 dic».
- `send-reminders`: modo nuovo `athlete_moved` con `record_ids` (le
  assegnazioni spostate) e `newDate` già scritta. Il controllo chiamante: deve
  essere staff (`_shared/staff.ts`), e il coach solo verso i suoi atleti
  (`mio_atleta`). La push non blocca: se non parte lo spostamento resta.
- Niente push se la nuova data è nel passato (è una correzione, non un avviso)
  né se l'allenamento è già svolto.
- Notifica anche nel centro notifiche (`notifications`, route
  `/workout/<id>?athlete_id=<uid>`), come le altre push all'atleta.

### 5. Test

- `spostaAllenamento.test.js`: `chiSiSposta` (completati, spostati da sé, data
  originale), date passate ammesse in modo coach.
- `FoglioSposta.test.jsx`: modo coach (passato confermabile, toggle portata,
  riga «restano», etichetta del bottone); modo atleta invariato.
- Test di pagina (con `montaPagina`/`fintoSupabase`): la data in testa apre il
  foglio per il coach e non per l'atleta; «Tutti» scrive `workouts.date` e le
  sole righe giuste; «Solo» non tocca `workouts.date`.
- Ogni test nuovo si vede fallire rompendo apposta il codice (CLAUDE.md §9).

### 6. Memoria

- `docs/memoria/calendario.md`: nuova sezione «9-sposta-coach».
- `docs/memoria/scheda-workout.md` e `scheda-atleta.md`: una riga di rimando.

## Lasciato al costruttore

- Il segno visivo esatto della data toccabile (icona, sottolineatura, colore),
  purché si capisca senza istruzioni e resti nei colori del §6.
- Come leggere il numero di assegnazioni dalla scheda atleta (una query
  `count` all'apertura del foglio va bene).
- Il testo esatto delle push, nel tono di `send-reminders/testi.ts`.

## Calls fatte da me (da controllare)

1. Il coach può scegliere **date passate** e spostare allenamenti **già svolti**
   (solo uno alla volta).
2. «Tutti» lascia stare chi l'ha svolto o l'ha spostato da sé, e il foglio lo dice.
3. Le **gare** si spostano anche loro, in modo coach.
4. L'atleta riceve una **push** (serve un deploy di `send-reminders`).
5. La data toccabile segue gli stessi permessi di «Modifica» (`puoAssegnare`).
