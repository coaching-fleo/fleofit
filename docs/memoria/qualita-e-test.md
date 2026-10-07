# Debito tecnico, test e le lezioni sul come si verifica

> Spostato da `CLAUDE.md` il 07/10/2026, **senza cambiare il testo**. I rimandi
> «§9-…» puntano a sezioni che ora stanno in altri file di questa cartella:
> si trovano con `grep -rn '^## 9-<nome>' docs/memoria`. L'indice è in `CLAUDE.md`.

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
4. ~~Due librerie di registrazione audio~~ → **chiuso il 23/09/2026.** 🔴 `capacitor-voice-recorder`
   (tchvu3, 7.0.6) **non era mai compilato su iOS**: non ha un `Package.swift`, e `npx cap sync`
   lo scartava con «does not have a Package.swift». Funzionava per caso: registra il plugin col
   nome `'VoiceRecorder'`, lo stesso di `@independo/…`, quindi il suo JS chiamava il nativo
   dell'altra libreria. Stessa API (`recordDataBase64`, `msDuration`, `mimeType`): CreateWorkout
   ora importa `@independo/capacitor-voice-recorder` e l'altra è disinstallata (17 plugin → 16).
   ⚠️ Non reinstallarla: due `registerPlugin` con lo stesso nome sono un'ambiguità, non un ripiego.
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
11. ~~Nessun test automatico~~ → **1025 test al 23/09/2026** (`npm test`, vitest), tutti
    verificati per mutazione: se si rompe di proposito il codice che coprono, falliscono.
    Non sono decorativi, ed è l'unico criterio che conta — vedi §9-sexies.

    **571 sulla logica pura di `src/lib/`**

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
| `recapAllenamento` | 27 | il recap post-allenamento: il verdetto che resta muto sulle SETTE settimane chiuse del grafico e parla sulle otto — senza quel test la fascia non sarebbe mai comparsa, e `null` è anche la risposta giusta a un atleta nuovo — la settimana in corso tenuta fuori dal confronto, l'RPE medio che torna `null` invece di 5, la gara che NON è il prossimo allenamento, e `recapMinimo` che a una lettura fallita non annuncia «il primo è fatto» a chi ne ha cento. ⚠️ Il test sull'ordinale è nato incapace di cadere: passava anche ignorando del tutto `totaleCompletati`, perché l'ordinale lo legge direttamente. Il caso che prende la mutazione è **chi rientra dopo mesi** — una seduta nella finestra, cinquanta nella storia |
| `codiceInvito` | 8 | il codice invito: che `normalizzaCodice` riconosca il **LINK** del coach e non ne legga l'indirizzo — senza, chi incolla `https://…/?invite=7KQ2M4XB` ottiene `HTTPSFLE`, otto caratteri come quelli giusti e un errore che non spiega niente — e che a codice pieno nessuna casella resti «attiva», o la nona (che non esiste) si prenderebbe il cursore mentre la verifica sta già partendo |
| `rigaImpostazioni` | 12 | le tre righe di Impostazioni che sono diventate numeri: i codici che tornano `null` finché non sono arrivati invece di «0 attivi», il conteggio mancante che SPARISCE invece di diventare zero — «0 atleti» accanto a «Esporta database» si legge come «non c'è niente da salvare» — e la pillola che in anteprima non dice «Atleta», che sarebbe vero e fuorviante |
| `appleLogin` | 8 | Sign in with Apple: che il nonce dato al plugin sia lo **SHA-256** di quello dato a Supabase e non lo stesso valore — uno scambio lì non rompe nient'altro e in produzione dà un 400 che sembra un problema di configurazione su Apple — che senza `crypto.subtle` si torni `null` invece di lanciare (o su quella WebView non entra più nessuno), che il nome vuoto degli accessi successivi NON si scriva sopra quello salvato la prima volta, e che l'annullamento del foglio di sistema (1001) non passi per un guasto mentre 1004 sì |
| `statistiche-vuoti` | 16 | gli stati senza storico: `senzaStorico` che è **falso** con un assegnato fuori dalla settimana — il caso che manderebbe il benvenuto del giorno 1 a chi ha già un programma — la settimana di CALENDARIO che esclude la domenica precedente (una finestra mobile la conterebbe dentro, e lo scarto non corrisponderebbe più al totale accanto), i `pending` che non sono volume, e lo scarto che torna `null` invece di `+214` con la settimana precedente vuota — anche quando quella settimana ha solo allenamenti **saltati** |
| `blockColors` · `rpe` · `workoutTitle` | 6+6+6 | codifica colore, round-trip dell'RPE, titolo generato dalla data |

    **454 su componenti, pagine e hook**

    | file | test | cosa protegge |
    |---|---|---|
    | `HyroxBlock` | 22 | il **contratto padre-figlio**, riepiloghi dei blocchi, didascalie (rilievo 3.2.1viii) |
    | `RunningStepRow` | 16 | idem per le fasi di corsa |
    | `HomeOffline` | 14 | il percorso offline completo su `Home` montata: completare, scompletare, coda, cache che si ripara, modale RPE che non si blocca |
    | `CreateWorkoutMemo` | 5 | la memoizzazione **dal lato del chiamante** (§9-quinquies) |
    | `RunningStepRowMemo` · `HyroxBlockMemo` | 4+2 | che `React.memo` serva ancora a qualcosa |
    | `HomeCoach` | 28 | il cablaggio del ramo coach su `Home` montata: l'eroe porta le citazioni e il numero dell'arretrato (non delle righe stampate), aprire un feedback segna letto **solo quello**, la squadra cambia giorno, l'account del coach resta fuori, e le card «Calendario»/«Atleti» restano fuori dalla pagina. ⚠️ Gli ultimi quattro montano con `role: 'admin'`, non `'coach'`: è il ruolo che esiste davvero, ed è l'unico a cui la Home mostrava anche il ramo atleta (§9-nonies, 28/08) |
    | `CreaWorkoutBuilder` | 30 | il builder ridisegnato su `CreateWorkout` montata: il riepilogo che segue i blocchi, il ritorno al passo 1 (unico posto dove nome e data si modificano), gli Stepper che scrivono il vocabolario di prima, «ultima volta», la ricerca esercizi che NON ruba il fuoco, lo scorrimento al blocco nuovo, la ruota del passo (generi separati, valore intero, `—` in ogni genere), la barra che NON è più `sticky` (§9-tertricies) e la modale della bozza — velo che sfuma, keyframe che ESISTE, carta sollevata condivisa (§9-undequadragies) |
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
| `HomeVolume` | 4 | i minuti della settimana nella Home: che su una corsa a **ripetute misurate in metri** dicano minuti e non ore (la Home diceva 4876 dove il recap diceva 105), e che siano **identici** a `durataWorkout` — non solo dello stesso ordine di grandezza. ⚠️ I due test sono due apposta: il primo fissa la scala, il secondo l'identità, e una terza formula sbagliata di cinque minuti su sessanta passerebbe il primo e cadrebbe sul secondo. Più l'RPE medio che non conta il 5 di ripiego e scrive «-» quando nessuno l'ha dichiarato. ⚠️ Servono TRE completati nella settimana, o la Home mostra la cella bloccata della prima settimana al posto del volume e il test verifica un'altra schermata |
| `RecapFoglio` | 8 | la cornice del recap, l'unico pezzo dell'app che si muove DA SOLO: il tempo che scade e porta la scheda successiva, il segmento che si riempie man mano, la **tenuta che lo ferma** — e che alzando il dito non fa saltare una scheda — e l'**ultima che non si chiude da sola**, perché porta «Apri la scheda». ⚠️ I quattro test sull'avanzamento devono **accendere il movimento a mano**: `src/test/setup.js` dichiara `prefers-reduced-motion: reduce` per tutta la suite, e con quello l'orologio non parte — un test scritto senza quella riga verificherebbe il caso opposto di quello che dice di verificare. ⚠️ E si avanza **una scheda per chiamata** di `advanceTimersByTime`: fra una e l'altra React deve riconciliare, e l'effetto che rimette l'orologio parte solo dopo quel commit |
| `HomeRecap` · `SchedaAtletaRecap` · `WorkoutDetailRecap` | 5+2+1 | il cablaggio del recap sulle tre pagine da cui un atleta chiude un allenamento: che si apra, che porti l'RPE **dichiarato adesso** e non l'intensità del coach (5 contro 7, sotto l'etichetta «RPE»), che una lettura fallita si fermi alla prima scheda, e che **al coach non si apra**. ⚠️ Quest'ultimo vive solo in `SchedaAtletaRecap`: è l'unica superficie in cui il coach può chiudere l'allenamento di qualcun altro — nella Home il ramo atleta non esiste per lui, nella scheda del workout il comando è di `eAtleta`. ⚠️ E il caso della lettura fallita non si prova dalla Home: `erroreSu` vale per la TABELLA, quindi farebbe fallire anche l'UPDATE e il recap non si aprirebbe affatto |
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
    ⚠️ Vanno tenute le esclusioni: `ios/App/App/public` (e il gemello Android
    `android/app/src/main/assets/public`) è la copia del bundle **minificato** che
    `npx cap sync` deposita nel progetto nativo, e analizzarla produceva 4.600 falsi problemi
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
6. 🔴 **Il lato ATLETA non è guardabile senza `VITE_DEMO_ATLETA`** (22/09/2026).
   «Anteprima come atleta» mette `adminRoleOverride`, ma la **sessione resta
   quella del coach** — e il coach è escluso da chi si segue (`COACHING_ID`),
   quindi non ha storico e la sua Home atleta è **sempre il giorno 1**. Ci si è
   arrivati provando il recap post-allenamento (§9-quadragies), che senza un
   atleta vero non aveva niente da mostrare. `VITE_DEMO_ATLETA` cambia l'**id**
   della sessione e non l'email, che deve restare una di `ADMIN_EMAILS` o metà
   delle schermate coach smette di esistere. Si usa con
   `DEMO_ATLETA=at-sara npm run demo:atleta`, più l'anteprima attiva.
7. **Il nastro giallo si ritira dopo quattro secondi.** A schermo intero copre la
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
