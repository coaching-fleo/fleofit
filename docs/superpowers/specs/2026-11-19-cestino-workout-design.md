# Cestino dei workout — progetto

*19/11/2026. Richiesta del committente dopo che il revisore di App Store (account
`demo@fleofit.it`, admin) ha eliminato il 18/11 un workout vero, «SkiErg Tempo», con le
sue cinque assegnazioni: si è recuperato solo dal backup notturno.*

## Perché

Eliminare un workout oggi è definitivo e si porta via tutto quello che gli è attaccato.
Basta un tocco sbagliato — del coach, di un altro admin, del revisore — e l'unica strada
è frugare nei backup. Il committente vuole una rete: il workout eliminato resta
recuperabile per 14 giorni dal coach che l'ha creato, con tutto quello che aveva.

## Cosa si costruisce

1. **Quando un workout viene eliminato**, da qualunque app e da chiunque, il database ne
   salva una copia completa in un cestino, poi lo elimina come oggi.
2. **Il cestino lo vede il coach che ha creato il workout** (`workouts.creato_da`).
3. **Il ripristino chiede cosa riportare indietro**: il workout torna sempre; sotto, la
   lista di quello che aveva attaccato, con «Seleziona tutto» e una spunta per voce. Così
   non si riassegna per sbaglio un workout a qualcuno.
4. **Dopo 14 giorni** la copia si cancella davvero, da sola.

```
Ripristina «SkiErg Tempo · FT+FT 155′ @6»
  [✓] Seleziona tutto
  [✓] Vittoria — da fare
  [✓] Federica — da fare
  [ ] Lorenzo — da fare
  [✓] Lara — completato, RPE 7, nota vocale
                         [Annulla]  [Ripristina]
```

## Obiettivi, non obiettivi, anti-obiettivi

- **Obiettivo:** nessun workout perso per errore, con qualunque app (la 1.2.4 sugli Store,
  il sito, la 1.2.5 in revisione) e chiunque elimini.
- **Non obiettivi** (deciso dal committente): non vanno nel cestino gli **allenamenti
  liberi** dell'atleta, né **l'atleta tolto da un workout** («Rimuovi assegnazione»). Restano
  come oggi.
- **Anti-obiettivi:**
  - il resto dell'app non deve accorgersi di niente: un workout nel cestino non compare in
    archivio, calendario, home, report, TV, push;
  - il ripristino non deve mai riassegnare qualcosa che il coach non ha spuntato;
  - non si riscrivono le policy delle tabelle esistenti.

## Vincoli

- **Schema congelato** (CLAUDE.md §0, 0-bis): serve un **sì esplicito** del committente alla
  migrazione, che va scritta in `supabase/schema/cestino_workout_2026-11-19.sql` e applicata
  a mano. Sarebbe la quattordicesima eccezione. La migrazione è **additiva**: una tabella, due
  funzioni, un trigger, un cron. Non tocca le policy esistenti.
- **Un database solo**, condiviso da web, iOS, Android, senza staging.
- **App vecchie**: eliminano con `supabase.from('workouts').delete()`. Il cestino deve
  funzionare con loro senza aggiornamenti → sta nel database, non nel client.
- **Il backup notturno** (`db-backup.yml`, `TABLES`) deve salvare anche il cestino.

## Le strade considerate

1. **Copia nel database al momento dell'eliminazione** — *scelta dal committente.* Un trigger
   `before delete` su `workouts` copia la riga e tutto ciò che le è attaccato in una tabella
   cestino, poi lascia procedere la cancellazione. Copre ogni app e ogni persona; il resto
   dell'app non cambia.
2. **Il workout si nasconde invece di cancellarsi** (colonna «eliminato il»). Scartata: le
   assegnazioni resterebbero vive, e nasconderle vorrebbe dire riscrivere le policy di molte
   tabelle — il rischio della migrazione multi-coach, di nuovo. Il ripristino con le spunte
   diventerebbe più complicato.
3. **Solo nel codice dell'app.** Scartata: non protegge le app vecchie né il sito; il caso del
   18/11 non l'avrebbe fermato.

## Il disegno

### Cosa si salva (tutto, al momento dell'eliminazione)

Elenco ricavato dalle chiavi esterne del database al 19/11/2026:

| Cosa | Da dove | Comportamento oggi alla cancellazione |
|---|---|---|
| il workout | `workouts` (tutta la riga, `id` compreso) | — |
| le assegnazioni, con stato, data, note (RPE, gradimento), nota vocale | `athlete_workouts` | cascade |
| i dati «Dalle note» | `note_estratte` (per `athlete_workout_id`) | cascade |
| la scarpa usata | `scarpe_uso` (per `athlete_workout_id`) | cascade |
| le sfide dei team su quel workout, con i risultati | `team_sfide`, `team_risultati` | cascade |
| il team che punta a quel workout | `team.evento_id` | messo a null |
| l'attività Garmin abbinata | `garmin_attivita.athlete_workout_id` | messo a null |
| i log legacy | `workout_logs` | cascade |

`tv_sessions` **non** si salva: è effimera.

Le note vocali sono **file** nel bucket `voice-notes`. Eliminare un workout oggi non tocca i
file (solo `delete_expired_voice_notes` li cancella, e solo per le righe segnate
`#deleted=`): restano lì, orfani. Quindi durante i 14 giorni l'audio c'è ancora.

### La tabella

`cestino_workout`: una riga per workout eliminato. Colonne essenziali: `id` del cestino,
`workout_id`, `titolo`, `data_workout`, `creato_da` (copiato dal workout), `eliminato_da`
(`auth.uid()` di chi ha eliminato, null se dal SQL editor o da un servizio),
`eliminato_il`, e `copia` jsonb con tutte le righe della tabella sopra, ognuna con le sue
colonne così com'erano.

**Quali workout entrano nel cestino** (*scelta di Claude, da confermare leggendo*). Nel
database un allenamento libero non ha un segno suo: `isAutonomous: true` ce l'hanno anche i
Custom creati dal coach e gli Eventi del calendario. Quello che li distingue è l'autore:
- `creato_da` è **staff** (admin o coach) → entra nel cestino: Hyrox, Corsa, Gym, Custom ed
  Eventi del coach;
- `creato_da` è un **atleta** → non entra: sono gli allenamenti liberi, compresi quelli che
  arrivano da Garmin (`garmin-webhook/attivita.ts` li crea e, se un passo fallisce, li
  cancella da sé: non devono finire nel cestino);
- `creato_da` **null** → entra. Sono 138 workout su 283, tutti Custom o Eventi autonomi
  creati prima del 16/10/2026 (il backfill dei più coach ha dato un autore a tutti gli altri):
  non si sa se li abbia scritti il coach o l'atleta, e uno in più nel cestino costa meno di
  uno perso.

**Policy** (solo lettura dal client; scrivono le funzioni):
- vede la riga chi è `creato_da`, se è ancora staff;
- le righe con `creato_da` null, o il cui autore non è più staff (un coach tolto), le vedono
  gli **admin**. Altrimenti nessuno le vedrebbe per 14 giorni.

### Il trigger

`before delete on workouts for each row`, `security definer`: se il workout entra nel
cestino (regola sopra: autore staff o null), compone la copia dalle tabelle sopra e la
inserisce nel cestino; in ogni caso `return old`. Se la copia fallisce, **fallisce anche
l'eliminazione**: meglio un errore a schermo che un workout perso senza rete.

### Il ripristino

Funzione `ripristina_workout(cestino_id, assegnazioni uuid[], sfide uuid[])`, `security definer`:
- controlla che chi chiama possa vedere quella riga del cestino (stessa regola della policy);
- reinserisce il workout **con lo stesso `id`**, così i link delle notifiche già inviate
  (`/workout/<id>?athlete_id=…`) tornano a funzionare;
- reinserisce solo le assegnazioni spuntate, ognuna con le sue `note_estratte`, la sua
  `scarpe_uso` e il ricollegamento Garmin (se l'attività esiste ancora e non è stata
  abbinata ad altro nel frattempo);
- reinserisce solo le sfide spuntate, con i loro risultati, e riaggancia `team.evento_id` se
  il team esiste ancora e non punta già a un altro workout. ⚠️ Il trigger
  `team_risultati_regole` rifiuta i risultati su una sfida chiusa e riscrive `inserito_il`:
  si inserisce la sfida aperta, poi i risultati, poi si rimette `chiusa_il`. `inserito_il`
  diventa l'ora del ripristino (*accettato, scelta di Claude*);
- toglie la riga dal cestino;
- **non invia notifiche**: ripristinare non è assegnare di nuovo.
- **Garmin** (*scelta di Claude*): eliminare il workout lo toglie già oggi dall'orologio
  (trigger `garmin_invii_assegnazioni`); reinserire un'assegnazione lo rimanda. Va bene così:
  il ripristino rimette le cose come stavano, orologio compreso. Non si tocca `garmin_avvisa`,
  e la migrazione resta additiva. `garmin_invii` non si salva: si rigenera.

Una voce non si può ripristinare se nel frattempo è cambiato ciò a cui si appoggia. Nella
lista compare spenta, con il motivo (*scelta di Claude*):
- atleta eliminato, anche solo in attesa di cancellazione (`deleted_at` valorizzato) →
  «atleta eliminato»;
- atleta che chi ripristina non segue più (`mio_atleta()` falso, es. passato a un altro coach)
  → «non è più tra i tuoi atleti». La funzione è `security definer` e scavalca la RLS: il
  controllo va fatto lì dentro;
- scarpa tolta o team sciolto → la parte collegata si salta, l'assegnazione torna lo stesso. Se l'`id` del workout fosse già occupato (non dovrebbe
succedere), il ripristino si ferma con un errore chiaro.

### La pulizia dopo 14 giorni

Un cron giornaliero `svuota-cestino-workout` alle 00:10 UTC (dopo il backup delle 22:30 e
dopo `cleanup-expired-athletes` delle 00:00) cancella le righe con `eliminato_il` più vecchio
di 14 giorni.

I file audio delle note vocali (*scelta di Claude*) restano orfani nel bucket, come succede
già oggi a ogni workout eliminato. Cancellarli davvero richiede l'API di Storage, non SQL:
un `DELETE` su `storage.objects` toglie solo i metadati e lascia i byte
(`docs/memoria/database.md`). Servirebbe una Edge Function nuova e un deploy in più: non vale
la pena per questo lavoro. Va in BACKLOG insieme al problema già noto di
`delete_expired_voice_notes`.

**Nessuno svuota il cestino a mano**: niente «Elimina definitivamente». Così un account con
troppi permessi (il revisore) non può cancellare anche la rete.

### Dove si vede

- **Libreria** (`/libreria`, il menù del coach): una voce fissa **Cestino** dopo Modelli, con
  il conteggio («3 workout»), su telefono e desktop.
- **Pagina `/cestino`** (solo staff): la lista dei workout eliminati, i più recenti in alto.
  Per ognuno titolo, data del workout, chi l'ha eliminato e quando, e «si cancella tra N
  giorni». Il tocco apre il foglio del ripristino con la lista a spunte (tutte spuntate in
  partenza, con «Seleziona tutto»).
- **La conferma di eliminazione** nella scheda workout cambia testo: «Andrà nel cestino per
  14 giorni, da cui potrai ripristinarlo». Solo dalla 1.2.5 in poi: le app vecchie mostrano
  il testo vecchio ma il cestino funziona lo stesso.
- Senza la tabella (migrazione non ancora applicata) la voce Cestino non compare.

## Lasciato al costruttore

- I nomi esatti delle funzioni e delle colonne, il formato interno di `copia`.
- Come presentare le sfide dei team nella lista a spunte (una voce per sfida).
- Il testo esatto dei messaggi e delle righe spente.
- Dove mettere la logica pura (es. `src/lib/cestino.js`, coperta da test) e le note in
  `docs/memoria/` (probabilmente un file `cestino.md` e una riga nella tabella del §11).
- L'aggiunta di `cestino_workout` a `TABLES` di `db-backup.yml` e a `tools/` per una query di
  verifica come `verifica-team.sql`.
