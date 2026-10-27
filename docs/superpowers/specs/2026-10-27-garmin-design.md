# Garmin Connect: collegamento, attività, recupero, workout all'orologio

> Progetto del 27/10/2026. Il committente ha l'accesso al **Garmin Connect Developer
> Program**, con **Health API, Activity API e Training API** abilitate sulla sua chiave.
> Decisioni prese in sessione lo stesso giorno, una domanda alla volta; il design di ogni
> fase approvato in chat prima di passare alla successiva.
>
> 🔒 **Richiede una migrazione.** Il committente ha dato il **sì di principio** alle quattro
> tabelle Garmin («do il sì di principio alle quattro tabelle Garmin», 27/10/2026). La
> migrazione porta però anche una funzione di stato e tre webhook di database (§7): il
> **sì esplicito** si chiede sul file SQL finito, prima che lo applichi lui dal SQL editor,
> come le eccezioni precedenti (CLAUDE.md §0, regola 0-bis).

## Perché

Gli atleti di Federico si allenano con un Garmin al polso. Oggi FLEOFIT non sa niente di
quello che l'orologio registra: il workout si segna completato a mano, la durata nel recap è
una stima (`≈`, BACKLOG 29-ter), e il coach non vede come dormono e recuperano. E il workout
che il coach scrive va ricopiato a mano sull'orologio, o seguito a memoria.

La policy pubblicata a `/privacy` (sezione 3) promette già il collegamento: questa è la
funzione che la rende vera.

## Decisioni del committente

1. **Tutte e tre le API**, divise in quattro fasi, ognuna con il suo piano:
   **0** collegamento · **1** attività · **2** recupero · **3** workout all'orologio.
2. **Architettura a Push** (approvata): Garmin manda i dati a un nostro webhook appena
   l'orologio sincronizza. Scartati il Ping/Pull (un passaggio in più per niente) e gli
   aggregatori esterni (un fornitore in più da mettere nella policy).
3. **Un'attività completa il workout in automatico** (scartate «proposta all'atleta» e «solo
   mostrata»), con regole strette e un modo di annullare (§3).
4. **L'atleta vede del suo recupero gli stessi andamenti del coach**, nel suo profilo; il
   foglio «Come stai» resta senza numeri Garmin, per non influenzare le risposte.
5. **I workout vanno all'orologio da soli**, con un interruttore dell'atleta acceso di
   partenza (scartati «solo su richiesta dell'atleta» e «lo decide il coach»).

## 1. Architettura comune

```
App (Impostazioni) ──► garmin-auth ──► Garmin OAuth 2.0 (PKCE) ──► garmin-auth (callback)
                                                                     │ salva token
Orologio ─► Garmin Connect ─► PUSH ─► garmin-webhook ──► garmin_attivita / garmin_giornate
                                                     └─► completa athlete_workouts (§3)
athlete_workouts / workouts ─► webhook di database ─► garmin-training ─► Training API (§5)
```

### Edge Function (tre, tutte nuove, usate solo dall'app: `main` non le chiama)

| Funzione | Fa | Autenticazione |
|---|---|---|
| `garmin-auth` | azioni `inizia`, `callback`, `scollega`, `impostazioni` | JWT dell'atleta; `callback` arriva da Garmin e si fida solo dello `state` salvato |
| `garmin-webhook` | riceve attività, dailies, sonno, HRV, stress, revoca e cancellazione utente | token segreto nell'indirizzo registrato nel portale Garmin |
| `garmin-training` | traduce e pubblica, aggiorna, sposta, cancella i workout sul calendario Garmin | chiamata solo dai webhook di database, con la service role |

- **Segreti** nei secret di Supabase: `GARMIN_CLIENT_ID`, `GARMIN_CLIENT_SECRET`,
  `GARMIN_WEBHOOK_TOKEN`. Mai nel bundle dell'app.
- **Codice condiviso** fra app e funzioni: la logica pura sta in `src/lib/` (`abbinaGarmin.js`,
  `recuperoGarmin.js`, `workoutGarmin.js`) e le funzioni la importano, come `estrai-note` fa
  con le sue regole. Le chiamate HTTP a Garmin stanno in `supabase/functions/_shared/garmin.ts`.
- **Niente plugin nativi né SDK Garmin**: è tutto OAuth via web, identico su web, iOS e
  Android. L'unica parte nativa è il deep link di ritorno `fleofit://garmin`, che lo schema
  `fleofit://` già copre su tutte e due le piattaforme (gestito in `DeeplinkHandler`).
- ⚠️ Gli indirizzi esatti delle API Garmin (autorizzazione, token, id utente, permessi,
  cancellazione registrazione, backfill, Training API e calendario) si prendono dalla
  documentazione del portale sviluppatori **al momento di scrivere `_shared/garmin.ts`**, e lì
  si annotano con la data: non da memoria.

### Garmin: valutazione e produzione
La chiave di valutazione vale per pochi utenti. Per tutti gli atleti serve la revisione di
Garmin, che controlla revoca, cancellazione dei dati, policy e attribuzione del marchio: per
questo la Fase 0 le fa tutte per prime. Ovunque si mostrino dati Garmin si mette
l'attribuzione richiesta dalle linee guida del marchio («Garmin» e, se c'è, il nome del
dispositivo).

## 2. Fase 0 — Collegamento

### Chi
Solo l'**atleta**. Lo staff non collega niente; un admin in «Simula atleta» non vede la riga
(nessuno collega il proprio Garmin a un atleta per sbaglio). Il coach, nella scheda atleta,
vede «Garmin collegato dal 3 nov» o niente.

### Il percorso
1. Impostazioni → riga **Garmin Connect** → foglio con due righe su cosa riceviamo e il
   **consenso separato**, una casella: «Acconsento che FLEOFIT riceva i dati del mio account
   Garmin e li usi, anche con l'IA, come descritto nell'informativa», con il link
   (`apriInformativa()`). «Collega» resta spento finché la casella è vuota.
2. L'app chiama `garmin-auth` / `inizia`: genera verifier e `state`, li salva in una riga
   `in_attesa` di `garmin_collegamenti`, restituisce l'indirizzo di autorizzazione Garmin.
   Sul nativo si apre col Browser in-app, sul web nella stessa scheda.
3. L'atleta accede a Garmin e sceglie i permessi. Garmin rimanda a `garmin-auth` /
   `callback`, che scambia il codice (col segreto, lato server), legge **id utente Garmin** e
   **permessi concessi**, salva, e rimanda a `fleofit://garmin?esito=ok|errore` (nativo) o
   `https://fleofit.vercel.app/settings?garmin=ok|errore` (web).
4. Subito dopo: richiesta di **backfill degli ultimi 30 giorni** (attività e dati
   giornalieri), che serve al riferimento personale della Fase 2.
5. La riga diventa «Collegato · dal 3 nov», con cosa arriva secondo i permessi concessi
   (attività, recupero, workout all'orologio) e cosa manca se l'atleta ne ha tolto uno.
   Sotto: l'interruttore **«Manda i workout all'orologio»** (Fase 3) e «Scollega».

### Il consenso
In due posti: nei metadati utente (`consenso_garmin: { versione, il }`, come
`datiConsenso` di `consenso.js`) e nella riga del collegamento. Ritirarlo = scollegare.

### Scollegare
- **Dall'app**: `garmin-auth` / `scollega` cancella la registrazione presso Garmin, poi
  cancella **subito** collegamento, attività, giornate e invii dell'atleta (i workout già
  sull'orologio si tolgono prima, finché il token vale).
- **Da Garmin Connect**: arriva al webhook la notifica di revoca/cancellazione, e succede la
  stessa cancellazione.
- La policy promette «entro 30 giorni»: subito la mantiene nel modo più semplice. I backup
  notturni scadono da sé (policy, sezione 11).
- I workout completati in automatico **restano completati**: il completamento è un dato di
  FLEOFIT, non di Garmin. Sparisce la card «Da Garmin» con i numeri.
- Un cambio di permessi su Garmin arriva al webhook e aggiorna i permessi salvati.

### Token
Il Push non li usa. Servono alla Fase 3 e allo scollegamento: si rinnovano col refresh token
**quando servono**, mai con un cron. Un refresh fallito (token revocato) segna il
collegamento come `da_ricollegare`, e la riga in Impostazioni lo dice.

## 3. Fase 1 — Attività

### Cosa si salva
Il **riepilogo** di ogni attività (anche quelle inserite a mano su Garmin Connect), in
`garmin_attivita`. Un aggiornamento con lo stesso id Garmin sovrascrive. Niente tracce GPS,
niente file FIT, niente campioni: le **zone di intensità** restano fuori per ora (richiedono i
campioni), e potranno entrare nel jsonb `dati` senza un'altra migrazione.

Il **giorno locale** si calcola con lo scostamento orario che manda Garmin, non col fuso del
server: una corsa alle 23:30 italiane è di quel giorno.

### Completamento automatico — `src/lib/abbinaGarmin.js`
Un'attività completa un `athlete_workout` dell'atleta solo se **tutte** sono vere:

1. stesso **giorno locale**, e il workout non è già completato;
2. **tipo compatibile**:

   | Categoria FLEOFIT | Tipi Garmin che la completano |
   |---|---|
   | Running | corsa, trail, tapis roulant, pista |
   | Hyrox | corsa, cardio indoor, HIIT, forza, vogatore, «altro» |
   | Gym | forza, cardio indoor, HIIT |
   | Custom, Event | **mai** in automatico |

3. durata ≥ **metà della durata stimata** (`stimaWorkout`) e comunque ≥ **10 minuti**;
4. c'è **un solo** workout candidato quel giorno. Con due candidati non si indovina;
5. l'attività è iniziata **dopo il collegamento** (il backfill si mostra ma non completa).

Un'attività già abbinata non ne completa un secondo. Le regole sono tabelle in testa al file,
coperte da test caso per caso.

### Quando completa
- `athlete_workouts.status = 'completed'`, come fa l'app; l'RPE resta **vuoto**
  (`rpeDichiarato` torna `null`: niente media falsa, CLAUDE.md §9).
- Il coach riceve la notifica di sempre (`coach_notification` / `completed`), con «· da
  Garmin» nel testo.
- L'atleta riceve «Registrato da Garmin: com'è andata?», che apre la scheda sul foglio RPE.

### Annullare e abbinare a mano
Sulla card Garmin della scheda, per atleta e coach:
- **«Non era questo allenamento»**: il workout torna da fare (solo se l'aveva completato
  Garmin), l'attività resta libera.
- **«Abbina a…»**: per un'attività libera, sceglie un workout di quel giorno o dei due
  vicini e lo completa (abbinamento `atleta`).

### Dove si vede
- **Scheda workout**: card **«Da Garmin»** con durata reale, distanza, passo, FC media e
  massima, dislivello, calorie, accanto alla stima. Il recap usa la **durata vera** al posto
  del `≈` dove c'è (chiude BACKLOG 29-ter senza toccare `athlete_workouts`).
- **Calendario e scheda atleta**: le attività non abbinate come voci grigie
  «Garmin · Corsa 42′»; toccandole, il dettaglio con «Abbina a…».
- Il coach vede quelle dei suoi atleti (RLS, §7).

Fuori per ora: creare un allenamento libero da un'attività non abbinata.

## 4. Fase 2 — Recupero

### Principio
Garmin **affianca** «Come stai oggi», non lo sostituisce: le quattro domande restano. Il
valore per il coach sta proprio nella differenza fra come si sente l'atleta e cosa misura
l'orologio.

### Cosa si salva
In `garmin_giornate`, una riga per atleta per giorno di calendario Garmin, un jsonb per ogni
tipo di dato (Garmin li manda separati, e rimanda lo stesso giorno più volte: ogni invio
sovrascrive solo la sua colonna):
- `giornata` — passi, calorie, minuti intensi, FC a riposo, stress medio, Body Battery;
- `sonno` — durata, fasi, punteggio;
- `hrv` — media notturna, stato secondo Garmin.

⚠️ **Peso e composizione corporea non si ricevono**: «niente peso né misure per ora» è una
regola del committente. Il webhook non si iscrive a quel tipo di dato, e la policy (che oggi
li nomina) si corregge nello stesso lavoro (§8).

### Segnali — `src/lib/recuperoGarmin.js`
- Riferimento: **media personale degli ultimi 28 giorni**. Mai soglie assolute: non sono
  giudizi medici.
- Con meno di **14 giorni** di dati non c'è riferimento: nessun segnale, «—» al posto del
  numero.
- Tre segnali, ognuno solo se dura **3 giorni di fila**:
  - HRV notturna oltre il **10%** sotto la sua media;
  - FC a riposo oltre **5 battiti** sopra la sua media;
  - sonno sotto le **6 ore**.

### Dove si vede
- **Coach, cruscotto / «Da guardare»** (`cosaGuardare.js`): «HRV sotto la sua media da 3
  notti», accanto ai «Come stai» bassi. Nessuna push: è da leggere, non un allarme.
- **Coach, scheda atleta**: andamento di 4 settimane di sonno, HRV e FC a riposo con la linea
  della sua media, vicino a quello di «Come stai» (`andamento.js`).
- **Atleta, profilo**: la **stessa card** di andamento. Il foglio «Come stai» no.
- La **programmazione IA** (spec del 26/10) userà gli stessi segnali, solo come numeri
  riassunti (policy, sezione 3).

## 5. Fase 3 — Workout all'orologio

### Traduzione — `src/lib/workoutGarmin.js`
Pura e coperta da test; legge i workout **solo** dalle letture esistenti
(`getNormalizedBlocks`, `partiRipetuta`, `serieDi`), mai dai campi a mano.

**Corsa → sport `RUNNING`** (traduzione fedele)
- `warmup`/`run`/`recover`/`cooldown` → passi di riscaldamento, attivo, recupero, defaticamento.
- `repeat` → gruppo di ripetizione con **tutte** le `parti`.
- «10 min» → passo a tempo; «400m», «5 km» → passo a distanza.
- «5:00 – 5:30 /km» → obiettivo di **passo** con quell'intervallo.
- Z1–Z5 → obiettivo di **zona cardiaca** 1–5 (le zone dell'atleta su Garmin).
- Libero, Gara, All out, Camminata, Da fermo → passo senza obiettivo, col testo nel nome.

**Hyrox → sport `CARDIO_TRAINING`** (utile, non perfetta: Hyrox non esiste come sport)
- Ogni blocco → passi con **nome e descrizione** («EMOM 10′ · 15 Wall Balls 9 kg»).
- EMOM, ON/OFF → ripetizioni di passi a tempo (lavoro/pausa): l'orologio scandisce i minuti.
- For Time, AMRAP → un passo a tempo pari al time cap / durata.
- Run dentro un blocco → passo a distanza. WarmUp, Rest → passi a tempo.
- L'orologio fa da cronometro guidato e dice cosa fare; non conta le ripetizioni.

**Gym → sport `STRENGTH_TRAINING`**
- Ogni esercizio → passo a **ripetizioni** (o a tempo, per quelli a tempo), carico nella
  descrizione; serie → ripetizioni; recupero → passo di pausa.
- Superserie/circuito → gruppo di ripetizione che alterna gli esercizi.
- Una tabella abbina i nomi di `eserciziGym.js` alle **categorie esercizio Garmin**, così
  l'orologio mostra l'esercizio giusto; quelli senza corrispondenza escono generici col
  nome nostro. Un test controlla che ogni voce della tabella esista nella libreria.

**Custom ed Event**: non si mandano.

Ogni workout porta il **titolo FLEOFIT** (col codice, `separaCodice` per mostrarlo pulito).

### Ciclo di vita
`garmin_invii` ricorda: assegnazione FLEOFIT ↔ id workout Garmin + data in calendario +
stato (`inviato` / `da_rifare` / `errore`).

| Succede | Su Garmin |
|---|---|
| workout assegnato a un atleta collegato, con l'interruttore acceso, da oggi in avanti | si crea e si mette in calendario |
| il coach modifica il workout | si cancella il vecchio, si manda il nuovo |
| cambia la data (coach o atleta) | si sposta solo in calendario |
| assegnazione tolta o workout cancellato | si cancella |
| l'atleta spegne l'interruttore | si cancellano quelli futuri non ancora fatti |

Se Garmin non risponde, l'invio resta `da_rifare`: si riprova al cambiamento successivo, e
nella scheda c'è «Riprova».

### Cosa lo fa partire
Un **webhook di database** su `athlete_workouts` e `workouts` (§7) chiama
`garmin-training`. Così funziona uguale da web, iOS, Android e **anche dalle versioni vecchie
dell'app sugli Store**, che non sanno niente di Garmin. La funzione esce subito se l'atleta
non è collegato: il costo per chi non usa Garmin è una chiamata che non fa niente.

### Dove si vede
Nella scheda workout, una riga discreta: «Sull'orologio · 28 ott», o «Non inviato · Riprova».

## 6. Interfaccia

- **Impostazioni (atleta)**: riga «Garmin Connect» (non collegato → foglio del consenso;
  collegato → stato, permessi, interruttore, Scollega). Esito del ritorno da Garmin con
  `CustomAlert`, mai `alert()`.
- **Scheda workout**: card «Da Garmin» (Fase 1), riga «Sull'orologio» (Fase 3).
- **Calendario / scheda atleta**: voci delle attività libere (Fase 1), andamento recupero
  (Fase 2), «Garmin collegato dal…».
- **Cruscotto coach**: segnali di recupero in «Da guardare» (Fase 2).
- **Profilo atleta**: andamento recupero (Fase 2).
- Le schermate desktop del coach (`docs/piano-web-desktop.md`) prendono gli stessi pezzi.
- Colori: nessuno nuovo. Le voci Garmin sono grigie (sono dati, non una categoria).
- Le modali nuove con `createPortal` e una X `aria-label="Chiudi"` (tasto indietro Android).

## 7. Dati e permessi (la migrazione)

File: `supabase/schema/garmin_2026-10-27.sql`, **additivo**, applicato a mano dal SQL editor.

| Tabella | Contenuto | Chi legge | Chi scrive |
|---|---|---|---|
| `garmin_collegamenti` | atleta (pk), id utente Garmin (unico), token, scadenze, permessi, stato (`in_attesa`/`attivo`/`da_ricollegare`), verifier e `state` PKCE temporanei, `invia_workout` (bool, default true), consenso (versione, data), collegato_at | **nessuno dall'app**: RLS attiva e nessuna policy | solo le Edge Function (service role) |
| `garmin_attivita` | id Garmin (unico), atleta, inizio, giorno, tipo, durata, distanza, `dati` jsonb, `athlete_workout_id` (set null alla cancellazione), abbinamento (`auto`/`atleta`) | l'atleta le sue; lo staff con `mio_atleta()`; admin tutte | Edge Function; l'atleta e il suo coach solo `athlete_workout_id` e abbinamento (Annulla / Abbina a…) |
| `garmin_giornate` | atleta + giorno (pk), `giornata`, `sonno`, `hrv` jsonb | come sopra | solo Edge Function |
| `garmin_invii` | `athlete_workout_id` (pk), id workout Garmin, data, stato, errore | come sopra | solo Edge Function |

Più:
- **`stato_garmin(atleta uuid)`**, funzione `security definer`: restituisce solo i campi non
  segreti (collegato, dal, permessi, `invia_workout`, stato) a chi è l'atleta stesso, il suo
  coach o un admin. È così che l'app legge lo stato senza mai poter leggere i token.
- **Webhook di database** (`athlete_workouts` insert/update/delete, `workouts` update/
  delete) verso `garmin-training`.
- Chiavi esterne verso `athletes` in **CASCADE**, come il resto: cancellare un atleta
  cancella i suoi dati Garmin. Ma `delete_expired_athletes()` è SQL e non può avvisare
  Garmin: per questo un **terzo webhook di database** su `athletes`, quando `deleted_at`
  passa da vuoto a pieno (atleta che elimina l'account, o coach che lo toglie), chiama
  `garmin-auth` / `scollega` con la service role. Lo scollegamento avviene quindi alla
  cancellazione, non sette giorni dopo; un atleta ripristinato entro i sette giorni
  ricollega Garmin da sé.
- Le tre tabelle di dati entrano nel **backup notturno** (`backup.js` e `db-backup.yml`);
  `garmin_collegamenti` **no**: i token non vanno nei backup.

## 8. Policy, App Store, Garmin

- **Policy** (`public/privacy-policy.html`, sezione 3): togliere peso e composizione
  corporea; aggiungere che **mandiamo a Garmin** i workout programmati, se l'interruttore è
  acceso. Va su `main` prima che l'integrazione sia aperta agli atleti.
- **App Store**: aggiornare le etichette privacy (dati di salute e fitness raccolti) nella
  versione che porta Garmin; il revisore (`demo@fleofit.it`, admin) **non** vede la riga, e
  le note di revisione lo spiegano. Rifare i controlli pre-archive (CLAUDE.md §9).
- **Garmin**: indirizzi del webhook e di ritorno registrati nel portale; revisione per la
  produzione dopo la Fase 0 funzionante.

## 9. Errori

- Webhook: risponde **sempre 200** in fretta (Garmin ritenta altrimenti); un id utente
  sconosciuto o un token d'indirizzo sbagliato si ignorano col log. Un dato malformato si
  scarta col log, senza toccare il resto del lotto.
- OAuth: ogni errore torna all'app come `esito=errore` con un motivo leggibile
  (annullato dall'atleta, permessi negati, Garmin non raggiungibile).
- Training: ogni fallimento lascia `da_rifare` con l'errore; mai un'eccezione che blocchi il
  salvataggio del coach (il webhook di database è asincrono).
- Nessun numero inventato: dato mancante = «—» o `null`.

## 10. Test

- `abbinaGarmin.test.js`: ogni riga della tabella dei tipi, la soglia di durata, due
  candidati, il backfill, l'attività già abbinata, il giorno locale a cavallo di mezzanotte.
- `recuperoGarmin.test.js`: riferimento con 13 e 14 giorni, segnale a 2 e 3 giorni di fila,
  dati mancanti in mezzo.
- `workoutGarmin.test.js`: una ripetuta a tre parti, ritmi e zone, ogni tipo di blocco Hyrox,
  superserie Gym, formato legacy, Custom ed Event esclusi; la tabella esercizi Gym ↔ Garmin
  copre solo nomi esistenti.
- Pagine: Impostazioni (consenso spento/acceso, stati del collegamento, staff senza riga),
  scheda workout (card, Annulla, Abbina a…), con `fintoSupabase`.
- Edge Function: le funzioni pure di `_shared/garmin.ts` (lettura dei payload Push) con
  payload di esempio presi dalla documentazione Garmin.
- Ogni test nuovo si vede fallire rompendo il codice che copre (CLAUDE.md §9).
- Ambiente di prova (`npm run demo`): dati Garmin finti in `demoSemi.js`, così le schermate
  si vedono senza un orologio.
- Le prove con un Garmin vero le fa il committente sul suo telefono (niente simulatore).

## 11. Ordine e piani

Quattro piani, in quest'ordine, ognuno chiuso e provato prima del successivo:
1. **Fase 0** — migrazione completa (tutte le tabelle, la funzione, i webhook spenti finché
   la Fase 3 non c'è), `garmin-auth`, `garmin-webhook` con revoca/cancellazione/permessi,
   riga in Impostazioni, policy.
2. **Fase 1** — attività: webhook, `abbinaGarmin.js`, card, calendario.
3. **Fase 2** — recupero: webhook, `recuperoGarmin.js`, andamenti, «Da guardare».
4. **Fase 3** — `workoutGarmin.js`, `garmin-training`, webhook di database accesi.

Memoria: una sezione nuova `docs/memoria/garmin.md` e la riga nel §11 di CLAUDE.md.
