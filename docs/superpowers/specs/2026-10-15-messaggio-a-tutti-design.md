# Messaggio a tutti: la bacheca del coach, con la push

> Progetto del 15/10/2026. Decisioni del committente prese in sessione lo stesso giorno,
> una domanda alla volta, e il design approvato in quattro parti.
>
> 🔒 **Richiede una tabella nuova**, quindi un **sì esplicito** del committente prima di
> applicarla (CLAUDE.md §0, regola 0-bis). L'approvazione del design **non** è quel sì.

## Perché

Il coach vuole mandare lo stesso messaggio a tutti i suoi atleti insieme. Oggi FLEOFIT ha
solo note e note vocali legate a un workout, e un atleta per volta. Gli atleti non
rispondono: è una funzione del coach. È la parte «broadcast» dell'idea registrata il
13/10/2026 (chat col singolo atleta + messaggio a tutti); la chat resta fuori.

I messaggi saranno **di due tipi, mescolati**: avvisi pratici con una scadenza («sabato la
palestra è chiusa») e contenuti che valgono nel tempo (regole del gruppo, consigli, come
usare l'app).

## Decisioni del committente

1. **Bacheca salvata più push**, non solo notifica. La push avvisa, la bacheca conserva.
2. **Un atleta nuovo vede i messaggi fissati più quelli inviati dalla sua iscrizione in
   poi.** Gli avvisi vecchi non li vede.
3. **Nessuna conferma di lettura**, per ora («mando il messaggio e basta»).
4. **L'account demo di App Store vede la funzione ma non può inviare.**

### Perché non «solo notifica»
Si poteva fare senza toccare il database, con la tabella `notifications` già esistente.
Scartata: l'atleta ne vede solo le ultime 30, «Svuota notifiche» le cancella **per
sempre**, un atleta nuovo non vede niente di prima, e non c'è modo di fissare un messaggio.
Non copre i contenuti che valgono nel tempo.

### Perché non un trigger sul database per la push
Sarebbe più robusto se l'app si chiude a metà invio, ma è un secondo intervento sullo
schema oltre alla tabella. Per un messaggio scritto a mano, ogni tanto, non vale il prezzo:
il caso dell'invio fallito lo copre il bottone Riprova (sotto).

## 1. Dati e permessi

### La tabella `messaggi_coach` (additiva)
`main` non la conosce oggi; nessuna tabella esistente cambia. File:
`supabase/schema/messaggi_coach_2026-10-15.sql`, applicato **a mano** dal SQL editor
dal committente, come `come_stai`.

| Colonna | Tipo | Note |
|---|---|---|
| `id` | `uuid` pk, `default gen_random_uuid()` | |
| `testo` | `text not null` | `check (char_length(btrim(testo)) between 1 and 2000)` |
| `fissato` | `boolean not null default false` | la puntina |
| `autore` | `uuid references auth.users (id) on delete set null`, `default auth.uid()` | il messaggio sopravvive all'account |
| `creato_at` | `timestamptz not null default now()` | |
| `modificato_at` | `timestamptz` | `null` finché non viene corretto |

Indice su `creato_at desc`. **Nessun titolo**: l'anteprima è l'inizio del testo.

### Le policy RLS
- **Lettura** (`select`, `to authenticated`): `using (true)`. Tutti gli utenti autenticati.
  La registrazione è chiusa (codice invito), quindi «autenticato» vuol dire atleta o coach.
- **Scrittura** (`insert`, `update`, `delete`, `to authenticated`): la lista admin **senza
  `demo@fleofit.it`**, in `USING` **e** `WITH CHECK`. Stessa lista, stesso ordine, di
  `ADMIN_EMAILS` (`src/App.jsx`) e `supabase/functions/_shared/admin.ts`, meno il demo.
  ⚠️ È l'unica tabella dove la lista di scrittura differisce dalle altre, e di proposito:
  va scritto in un commento nel file SQL, e in `docs/memoria/database.md`.

### La regola «fissati + dalla tua iscrizione»
Si applica **nell'app**, non nel database: un messaggio si mostra all'atleta se
`fissato || creato_at >= session.user.created_at`. È una regola di **ordine**, non di
**segretezza**: chi interrogasse il database a mano vedrebbe anche i vecchi avvisi, che il
coach aveva comunque mandato a tutti. Se un giorno i messaggi diventassero riservati, la
regola passa in una policy (con una funzione `security definer` che legge `auth.users`).
Il coach vede sempre tutto.

### Backup
`messaggi_coach` entra in `TABLES` di `.github/workflows/db-backup.yml` (ha `id`, quindi
nella forma semplice). Diventa attivo dopo il prossimo `app:main` (CLAUDE.md §1.1).
Non entra nell'esportazione dalle Impostazioni (`src/lib/backup.js`), che salva i dati
degli atleti.

## 2. Lato coach

### Dove si entra
- **Telefono**: un bottone «Messaggio a tutti» nella Home coach, accanto al cruscotto
  (`HomeCoachTelefono` / `CruscottoCoachUI`). Nessuna voce nuova nella tab bar.
- **Desktop**: la voce «Messaggi» in `BarraLaterale`.
- Entrambi portano a **`/messaggi`**, una rotta nuova dentro `ProtectedRoute`, la stessa
  per coach e atleta: per il coach ha in più la scrittura e la gestione.

### Scrivere e inviare
- Il bottone apre un **bottom sheet** (`src/useBottomSheet.js`) con:
  - il campo di testo e il contatore dei caratteri (max 2.000);
  - l'interruttore **«Fissa in cima»**;
  - la riga **«Arriverà a N atleti»**: gli atleti con `deleted_at` nullo, **compresi
    quelli in pausa** (un avviso pratico riguarda anche loro), escluso l'account nascosto
    `coaching@federicoleo.it` (`0118e43f-…`).
- La X ha `aria-label="Chiudi"` (tasto indietro su Android, `src/lib/indietroAndroid.js`).
- **Invia chiede conferma** con `CustomConfirm`: «Mandare a N atleti? Ognuno riceverà una
  notifica.» — una push partita non si ritira.
- **La bozza si salva sul dispositivo** in `fleofit_messaggio_bozza`, con
  `leggiJson`/`scriviJson`, come `fleofit_segnalazione_bozza`. Si cancella a invio
  riuscito. Va aggiunta all'elenco delle chiavi in CLAUDE.md §8.
- **Account demo**: il foglio si apre, ma Invia è disattivato con la scritta «Nell'account
  di prova i messaggi non partono». Il blocco vero sta nel database e nella funzione; questo
  è solo per non far premere un bottone che fallisce.

### Gestire i messaggi già mandati
In `/messaggi` ogni messaggio ha un menu:
- **Fissa** / **Togli dai fissati**;
- **Modifica**: corregge il testo, scrive `modificato_at`, **non** rimanda la push; il
  messaggio mostra «modificato»;
- **Elimina**, con `CustomConfirm`: sparisce dalla bacheca di tutti. Le righe già scritte
  in `notifications` restano (sono dell'atleta); toccate, aprono `/messaggi` senza il
  messaggio evidenziato. ⚠️ Siccome portano il **testo intero** (§3, per le versioni
  vecchie), il messaggio eliminato resta leggibile nel centro notifiche di chi l'ha
  ricevuto. Il foglio di conferma lo dice: «Sparirà dalla bacheca; chi ha già ricevuto la
  notifica la vede ancora». Cancellarle davvero vorrebbe dire scrivere sulle notifiche
  altrui con la service role: fuori da questo lavoro.

Ogni aggiornamento è **ottimistico** con rollback (convenzione di CLAUDE.md §8).

## 3. Lato atleta e viaggio del messaggio

### Cosa vede l'atleta
- **In Home**: una card «Dal coach» con l'inizio dell'ultimo messaggio visibile, finché non
  l'ha aperto. Poi sparisce e la Home torna com'è.
  - «Visto» = memoria **del dispositivo**: `fleofit_messaggi_visto_fino` con il
    `creato_at` dell'ultimo messaggio aperto. Su un telefono nuovo l'ultima card ricompare
    una volta, ed è innocuo. Nessuna tabella delle letture.
- **`/messaggi`** («Dal coach»): fissati in cima con la puntina, poi gli altri dal più
  recente. Sola lettura. Vuota: «Qui troverai i messaggi del coach». Entrata con `.cascata`
  (CLAUDE.md §6).

### Il viaggio
1. **Invia**: l'app fa `insert` in `messaggi_coach`. Da qui il messaggio è in bacheca,
   qualunque cosa succeda dopo.
2. L'app chiama `send-reminders` con `{ mode: 'broadcast', record_id: <id> }`. La funzione:
   - verifica che il chiamante sia admin (`isAdminEmail`) **e non** `demo@fleofit.it`,
     altrimenti 403; `broadcast` va nella lista `soloAdmin`;
   - legge il messaggio (se non esiste: 404);
   - prende gli atleti attivi, con le stesse esclusioni del conteggio sopra, e toglie il
     mittente;
   - **salta chi ha già** una notifica con `route = '/messaggi?m=<id>'` (così Riprova non
     manda doppioni);
   - scrive in `notifications` una riga per atleta: titolo «Messaggio dal coach»,
     `message` = **il testo intero** (vedi §4, le versioni vecchie), `route` =
     `/messaggi?m=<id>`;
   - manda le push con l'**inizio** del testo (circa 120 caratteri, tagliato su una
     parola), badge incrementale e pulizia delle subscription morte come gli altri modi;
   - risponde `{ success, sent, saltati }`.
3. **Se la chiamata fallisce**: il foglio mostra «Il messaggio è in bacheca, ma la
   notifica non è partita» con **Riprova**, che rifà il passo 2 con lo stesso `id`.
4. **Quando l'atleta apre `/messaggi`**: le sue notifiche con `route` che inizia per
   `/messaggi` passano a `is_read = true`, e il badge si riallinea con
   `sincronizzaBadge` (mai a mano, CLAUDE.md §8), come fa `WorkoutDetail`.

### Deep link
La notifica porta a `/messaggi?m=<id>`: la pagina scorre a quel messaggio e lo evidenzia
un attimo. Passa dallo stesso gestore delle notifiche di `App.jsx` che apre già i workout,
quindi vale per web, iOS e Android.

### Pubblicare `send-reminders`
La funzione è condivisa con il sito e con i cron del mattino e della sera. Il modo nuovo
si aggiunge e non tocca gli altri, ma il deploy colpisce tutti: si pubblica dopo i test,
e si controllano i log del primo promemoria del mattino successivo.

## 4. Piattaforme, versioni vecchie, App Store

- **Solo codice React condiviso**: nessun plugin, nessun permesso nuovo.
- **Ambiente di prova**: `src/demoSemi.js` riceve tre o quattro messaggi finti, uno
  fissato e uno più vecchio dell'iscrizione dell'atleta finto (per vedere la regola),
  così `npm run demo` e `demo:atleta` mostrano bacheca e card.
- **Atleti con l'app 1.2.1**: ricevono la push, ma `/messaggi` lì non esiste e la rotta
  `*` li porta in Home. Il **testo intero** va comunque nella riga di `notifications`, ma
  ⚠️ (correzione del 15/10/2026, revisione finale) il centro notifiche della 1.2.1 taglia
  ogni messaggio a **due righe** (`line-clamp-2` in `Home.jsx`): dalla versione vecchia si
  legge solo l'inizio di un messaggio lungo. L'uso vero comincia con la **1.2.2** nei
  negozi; sul web arriva al primo `app:main`, che non si fa prima di tabella e funzione
  pubblicate (`docs/memoria/messaggi.md`, «Cancello di rilascio»).
- **App Store**: nessuna dichiarazione cambia. «Messaggistica e chat» è già SÌ; un
  messaggio che scrive solo il coach non è contenuto generato dagli utenti (BACKLOG #51).
- **Privacy**: nessuna categoria di dati nuova; il testo è del coach.

## 5. Prove

- **Logica pura**, `src/lib/messaggiCoach.js` con `__tests__/messaggiCoach.test.js`:
  - `visibiliPer(messaggi, iscrittoIl)`: fissati più quelli dall'iscrizione; il coach
    tutto;
  - `ordina(messaggi)`: fissati prima, poi dal più recente;
  - `daMostrareInHome(messaggi, vistoFino)`: l'ultimo non visto, oppure `null`;
  - `anteprima(testo)`: taglio a circa 120 caratteri su una parola, con «…»;
  - `destinatari(atleti, mittenteId)`: esclusi cancellati, account nascosto e mittente;
    inclusi quelli in pausa.
- **Pagina**, con `src/test/fintoSupabase.js` e `montaPagina.jsx`: atleta (sola lettura,
  regola dell'iscrizione), coach (menu, foglio, conferma), demo (Invia disattivato),
  invio con push fallita (Riprova).
- **Funzione `broadcast`**: rifiuta non-admin e demo; seconda chiamata con lo stesso `id`
  non scrive doppioni.
- Ogni test nuovo **si vede fallire** rompendo apposta il codice che copre
  (CLAUDE.md §9).
- `npm test` e `npx eslint` sui file nuovi senza problemi nuovi.
- **Sul telefono** prova il committente: push vera, tocco sulla notifica, badge.

## Ordine dei lavori

1. `supabase/schema/messaggi_coach_2026-10-15.sql` e il **sì** del committente; lo applica
   lui. Verifica: `select policyname, cmd from pg_policies where tablename = 'messaggi_coach';`
2. `src/lib/messaggiCoach.js` e i suoi test.
3. Il modo `broadcast` in `send-reminders`, i suoi test, il deploy.
4. La pagina `/messaggi`, il foglio coach, la card in Home, la voce in `BarraLaterale`.
5. `demoSemi.js`, `db-backup.yml`, `docs/memoria/messaggi.md` (file nuovo, con la riga
   nell'indice di CLAUDE.md §11), la riga in CLAUDE.md §4 e la chiave in §8,
   `DEVLOG.md` per la 1.2.2, la voce chiusa in BACKLOG e la memoria `chat-e-broadcast`
   aggiornata (resta aperta la chat col singolo atleta).

## Fuori, di proposito

Conferma di lettura (decisione del committente, si aggiunge dopo con una seconda tabella),
risposte degli atleti, chat col singolo atleta, foto e allegati, dettatura vocale (c'è già
`useDettatura`, si aggiunge dopo), messaggi programmati, invio a un gruppo di atleti.
