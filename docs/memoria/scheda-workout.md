# La scheda del workout e la grafica da storia

> Spostato da `CLAUDE.md` il 07/10/2026, **senza cambiare il testo**. I rimandi
> «§9-…» puntano a sezioni che ora stanno in altri file di questa cartella:
> si trovano con `grep -rn '^## 9-<nome>' docs/memoria`. L'indice è in `CLAUDE.md`.

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

---

## 9-quinquadragies. «Modifica» bloccata su un workout già svolto (07/10/2026)

Richiesta del committente: se almeno un atleta ha già completato il workout, il
coach non lo può più modificare. «Modifica» nel menu delle tre puntine apre
«Non si può modificare» con «Un atleta l'ha già svolto» — ⚠️ **volutamente
senza nomi**, l'ha chiesto il committente — e due bottoni: **Annulla** e **Duplica** (`/create?duplicate=<id>`, la stessa
strada della voce «Duplica»).

- Il perché: `workouts` è UNA riga per tutti gli assegnati. Cambiarla dopo
  riscriverebbe a posteriori un allenamento fatto — recap, storia e statistiche
  leggerebbero blocchi mai eseguiti.
- Il controllo sta in `apriModifica` di `WorkoutDetail.jsx` e legge
  `assignments`, che porta **tutte** le assegnazioni anche quando si guarda la
  scheda di un singolo atleta. È l'unico ingresso a `/create?edit=` dell'app;
  chi aggiunge un secondo ingresso deve rifare lo stesso controllo.
- `CustomConfirm` ora accetta `confirmLabel` (default «Conferma»).
- ⚠️ Gli allenamenti autonomi (`isAuto`) non passano di qui: hanno la loro modale.
- Offline il controllo legge la cache `fleofit_cache_all_aw_<id>`, che può essere
  vecchia: un completamento arrivato dopo l'ultima apertura non si vede.

Test: `src/pages/__tests__/WorkoutDetailModificaSvolto.test.jsx` (3). Mutazione
(controllo sempre falso) presa da due test su tre.

## 9-undequinquagies. La nota dell'atleta si salva solo col completamento (12/10/2026)
Richiesta del committente: alcuni atleti scrivevano la nota sul workout senza
segnarlo come fatto, e il coach si ritrovava un allenamento «da fare» con dentro
il racconto di com'era andato. La regola ora: **su un allenamento non completato
la nota non si salva da sola**.

- «Conferma note» (`salvaNoteAtleta` di `WorkoutDetail.jsx`), se `workoutStatus
  !== 'completed'`, non scrive niente e chiede **«Hai completato l'allenamento?»**
  con «Sì, l'ho fatto» / «No» — «No» e non «Non ancora», perché il tasto indietro di Android chiude solo i bottoni che si chiamano esattamente così (`indietroAndroid.js`).
- Il **sì** chiama `toggleStatus`, cioè il completamento di sempre: avviso della
  data futura → modale RPE con la nota già dentro (`setRpeNotes(editingNote)`) →
  `handleRpeSubmit`, che salva nota e stato in UNA scrittura (o nella coda offline)
  → recap. Nessuna seconda strada per completare.
- Il **«No»** non salva niente e lascia il testo nel riquadro.
- Su un allenamento già completato la nota si salva subito, come prima (serve a
  correggerla), e solo lì parte la notifica «nota» al coach: sul completamento
  parte già quella «completed».
- ⚠️ `onConfirm` lancia `toggleStatus` con un `setTimeout(…, 0)`: `CustomConfirm`
  chiama `onClose` subito dopo `onConfirm`, e chiuderebbe nello stesso istante
  l'avviso «data futura» che `toggleStatus` apre. Un test lo copre.
- Solo su `app`: la web app su `main` salva ancora la nota senza chiedere.
- 🔴 **Le strade per scrivere la nota sono DUE**, non una: anche le card del
  profilo dell'atleta (`/profile` = `AthleteDetail.jsx`, card di oggi e dei
  prossimi giorni) hanno un campo nota con il proprio «Conferma». Il primo
  commit copriva solo la scheda del workout, e il committente l'ha provata
  proprio dal profilo: la nota si è salvata senza domande. Dal 12/10/2026 la
  stessa regola sta in `updateWorkoutNote` di `AthleteDetail.jsx` (solo per
  `role === 'athlete'`: il coach che corregge la nota dalla scheda dell'atleta
  salva come prima), e `toggleWorkoutStatus` accetta il testo appena scritto
  come quarto argomento, per metterlo nella modale RPE.
  Test: `src/pages/__tests__/AthleteDetailNotaCompletamento.test.jsx` (5);
  mutazione (domanda tolta) → 4 su 5 rossi.

Test: `src/pages/__tests__/WorkoutDetailNotaCompletamento.test.jsx` (5).
Mutazioni: domanda tolta → 4 test su 5 rossi; `setTimeout` tolto → il test della
data futura rosso. Provato anche nell'ambiente di prova (`demo-atleta` in
`.claude/launch.json`, con `adminRoleOverride = 'athlete'`).

## 9-scheda-desktop. La scheda workout sul desktop (13/10/2026)

Solo coach su web ≥ 1024px (`useDesktop`). Due colonne: a sinistra titolo, esito,
riepilogo, avviso, blocchi e note del coach; a destra (ferma mentre la pagina scorre, con
uno scorrimento suo) le azioni, il vocale, le note dell'atleta e le assegnazioni.
- I pezzi sono costanti JSX (`pTitolo`, `pContenuto`, `pAssegnazioni`…) scritte una volta
  prima del `return`. ⚠️ Una sezione nuova va messa in ENTRAMBE le disposizioni.
- La barra in fondo diventa un riquadro in cima alla colonna destra: è `BarraAzioni` con
  `ancorata={false}`, la variante in flusso che esisteva già.
- Il menu delle tre puntine resta un foglio dal fondo: sul desktop la regola di
  `html.desktop` in `index.css` lo fa diventare una finestra centrata.
- Test: «Scheda workout — versione desktop» in `WorkoutDetailScheda.test.jsx`.

## 9-come-stai. «Come stai oggi» (13/10/2026)

Quattro domande da 1 a 5 che l'atleta riceve prima di allenarsi, una volta al giorno:
sonno, energia, dolori muscolari, stress. Tabella `come_stai` (seconda eccezione al
congelamento dello schema, sì del committente il 13/10). Logica e rete in
`src/lib/comeStai.js`, foglio in `src/components/FoglioComeStai.jsx`.

Dove compare:
- **Atleta**, nella scheda di un allenamento non ancora fatto: un invito «Come stai oggi?
  Rispondi» sotto il titolo, e il foglio che si apre da solo premendo **«Segna come
  completato»**, prima del «Com'è andata?» (RPE). Rispondere o saltare apre l'RPE lo stesso:
  **la domanda non blocca mai**.
  🔴 **Mai all'avvio del timer né del telecomando TV** (richiesta del committente, 27/10/2026:
  fino ad allora si apriva premendo «Avvia allenamento» / «Avvia telecomando TV»).
- **Coach**, nella scheda dell'atleta su quel workout: «Come stava» quel giorno, con la media
  e le quattro risposte. In **Analisi**: la colonna «Come sta» (media del periodo) e il
  grafico settimana per settimana.

⚠️ Le cose da sapere:
1. 🔴 **Tutte le scale vanno nello stesso verso, 5 = la cosa buona** (dolori 5 = nessuno,
   stress 5 = basso). È ciò che permette la media senza girare niente. Una domanda nuova si
   scrive nello stesso verso, o la media mente.
   🔴 **Ma il numero non si MOSTRA mai** (14/10/2026, richiesta del committente): «Dolori 5»
   si legge «tanti dolori». I bottoni del foglio dicono una parola (`scelte` in `DOMANDE`,
   la buona sempre a destra, colore dal rosso al verde) e il coach in «Come stava» legge la
   stessa parola (`parolaRisposta`). Il numero resta solo nel dato e nella media /5.
   Il riepilogo del coach è **una riga per domanda** (nome · cinque tacche · parola), non
   la griglia a due colonne di prima, dove «Sonno Pessimo Energia Poca» non si capiva cosa
   andava con cosa. Le tacche usano `TONI_RISPOSTA`, gli stessi colori dei bottoni.
2. Una risposta saltata è `null` e non entra nella media; un giorno senza risposte non esiste.
   La media del periodo è la media dei GIORNI, non delle singole risposte.
3. `leggiComeStai` torna `undefined` quando non può sapere (tabella assente, rete giù): in quel
   caso **non si chiede**. Un foglio a sproposito davanti al timer è peggio di una risposta persa.
4. «Salta» si ricorda per il giorno in `fleofit_come_stai_saltato` (memoria del dispositivo).
   🔴 «Fatto» chiude e apre l'RPE SUBITO (fino al 27/10 era il timer), e salva dopo, in sottofondo: con il
   segnale scarso un upsert senza risposta terrebbe fermo il timer (trovato dalla revisione
   del 13/10). Se il salvataggio fallisce, il giorno si segna come saltato: chi ha risposto
   non deve rispondere due volte.
5. Si chiede per il giorno di OGGI, non per la data della seduta: è com'è l'atleta quando si
   allena. Il coach invece legge la risposta del giorno della seduta (`workout.date`).
6. La X del foglio ha `aria-label="Chiudi"`: è ciò che fa funzionare il tasto indietro di
   Android. ⚠️ Chiudere NON è saltare: niente RPE, niente «saltato oggi», l'invito resta.
   Chi preme indietro vuole annullare, non partire.
8. La risposta letta si tiene insieme alla sua chiave (atleta + giorno) e vale solo finché la
   chiave è quella: una lettura vecchia non decide se chiedere oggi.
9. In Analisi le risposte si leggono A PAGINE (`leggiComeStaiFra`): il server ne restituisce al
   massimo mille senza dirlo.
7. Nella demo l'upsert con chiave composta (`athlete_id,giorno`) sovrascriveva la prima riga:
   corretto in `supabaseDemo.js`, test in `src/__tests__/demoUpsert.test.js`.

Backup: `come_stai` è nell'esportazione in-app e nel backup notturno (vedi `database.md`).
Non fatto (da decidere): nessun avviso al coach quando qualcuno sta male.

---

## 9-tv-grafica. La TV in linea con il resto dell'app (15/10/2026)

`/tv` era l'ultima schermata di prima del redesign: bordi da 4px, `#1e1e1e` piatto, il logo
due volte, il giallo ovunque. Rifatta **solo la grafica**, su richiesta esplicita del
committente: «non toccare il codice per il timer».

- 🔴 **La grafica sta in `src/components/TVDashboardUI.jsx`**, sola presentazione (stesso patto
  degli altri `*UI.jsx`). In `pages/TVDashboard.jsx` restano, **identici byte per byte**, i beep
  WAV, il wake lock, lo sblocco dell'audio, il canale realtime (`tv_sessions`, `timer_state`,
  `timer_close`), la scala del canvas 1920×1080 e la griglia `cols`/`rows`. Verificato col
  diff contro `1d800ac`. Chi rimette mano alla TV per la grafica tocca solo il file UI.
- Il linguaggio è quello della scheda: `CARTA_TV` (la carta sollevata in scala TV), la spina
  colorata del blocco da `TYPE_COLORS`, la sovrascritta con il pallino della corsia
  (`coloreCategoria`), il vetro per audio e rotazione. Il blocco in corso è l'**unica cosa
  ambra della griglia**.
- I dati dei blocchi vengono dalle stesse funzioni della scheda: `sottotitoloBlocco`,
  `specificheEsercizio`, `durataBlocco` + `mmss`. È sparita la `getBlockTitle` della TV, che
  era una copia (le altre stanno ancora in `WorkoutDetail`, BACKLOG del debito).
- La fascia del timer **legge** il `timer_state` che il telefono già manda e non calcola
  niente: colore dal `theme` dello step (stessa mappa dei `SCHEMES` del telefono), «Poi» da
  `nextTask`, barra da `(duration − timeLeft) / duration` (nessuna barra sugli step a
  cronometro, `duration` 0), «In pausa» da `isRunning === false`.
- 🔴 **Sulla TV l'avviso «Prima di iniziare» NON c'è**, per scelta del committente
  (15/10/2026): prima carta della griglia, poi fascia sottile in fondo — «veramente
  invasivo» in entrambe le forme. Resta nella scheda workout (`AvvisoRiscaldamento`, testo
  intero). Non va rimesso sulla TV, né conta più in `totalItems`.
- Il bottone di rotazione **non è una freccia circolare** (sembrava «ricarica la pagina»): è
  `RotateCcwSquare`, il quadrato con la freccia curva di Foto su iOS, scelto dal committente.
  Una pillola con scritta «Verticale» è stata provata e scartata.
- **L'esercizio in corso si accende** dentro EMOM e ON/OFF (richiesta del committente,
  15/10/2026): `src/lib/esercizioInCorso.js` lo ricava dall'id dello step che il telefono
  manda (`blk-<blocco>-<round>` per l'EMOM, convertito con `fasiEmom`, la stessa funzione del
  timer; `blk-<blocco>-<giro>-<k>-on|off` per l'ON/OFF, acceso **solo nell'ON**). 🔴 Se cambia
  il formato degli id in `buildTimerSequence`, la riga accesa sbaglia senza errori:
  `esercizioInCorso.test.js` costruisce la sequenza vera e lo verifica.
- ⚠️ **TV ruotata**: il contenuto deve stare nei 1920px di altezza, o la cornice di scala lo
  sposta e lo taglia a sinistra (succedeva già prima, è la logica di scala, non toccata).
  Per questo con `stretto` testata e timer si compattano (il tempo va sopra il compito, il
  marchio sparisce). Un workout molto lungo può ancora superarli, come prima.
- Provato nell'ambiente di prova iniettando workout e `timer_state` finti nel browser
  (Hyrox con EMOM in corso, corsa in pausa, verticale). **Non provato su una TV vera.**
- Non fatto, come prima: la TV non mostra i gruppi Gym (`crea-workout.md`, 9-gym punto 8).

## 9-tv-persone. Più persone sfasate sulla TV, ognuna col suo colore (30/10/2026)
Richiesta del committente: allenamenti in contemporanea a più persone, in un EMOM o in un
ON/OFF, fatte partire su esercizi diversi. Lo spostamento **lo sceglie il coach** (non lo
calcola l'app).
- **Telefono**: col telecomando TV attivo il timer mostra la pillola «Persone sulla TV»
  (solo se il workout ha un EMOM o un ON/OFF con più di un esercizio). Apre `FoglioPersoneTV`,
  in **due passi, prima le persone e poi la partenza** (terzo disegno, 30/10/2026, voluto così
  dal committente): l'elenco delle persone (pallino col colore e l'iniziale, nome, «Parte da
  SkiErg») con «Aggiungi persona» in fondo; toccando una persona — o appena aggiunta — si apre
  la sua scheda: nome, colore (otto, quelli già presi spenti), **«Parte da»** come elenco degli
  esercizi per nome (quelli dell'EMOM/ON-OFF più lungo, `bloccoPerPersone`) con chi altro parte
  da lì; in fondo «Togli» e **«Fatto»** (giallo: conferma e torna all'elenco — senza, una
  persona appena creata si chiudeva solo con «Indietro», segnalato dal committente). Ogni
  modifica vale subito sulla TV.
  Una persona nuova parte dal primo esercizio ancora libero e prende la lettera del suo posto,
  saltando quelle usate (con «Marco» già in lista la seconda è B, non A).
  🔴 **Due disegni scartati dal committente, non tornarci**: (1) lista di persone con «dal 2°» e
  −/+ e «Aggiungi persona» + «Fatto» (numeri al posto degli esercizi); (2) «tocca l'esercizio
  per metterci una persona» (partiva dagli esercizi, il coach pensa prima alle persone).
- **Memoria**: le persone restano **finché l'app è aperta**, workout per workout
  (`personeRicordate`/`ricordaPersone`, una `Map` in memoria in `personeTV.js`); chiusa l'app
  spariscono (richiesta del committente: un allenamento di gruppo non si ripete la settimana
  dopo con le stesse persone). Per questo **non** stanno in localStorage.
- **Viaggio**: dentro il `timer_state` che il telefono già manda (`persone`). Nessuna tabella,
  nessuna colonna.
- **Prima del via** (preparazione, riscaldamento) la TV mostra già, sul prossimo EMOM/ON-OFF,
  da dove parte ognuno: così il gruppo sa dove mettersi.
- **TV**: leggenda sotto la fascia del timer; nel blocco in corso ogni riga prende il colore
  di chi ci sta sopra (bordo, fondo, numero, pillole con i nomi), al posto dell'ambra. Chi è
  dove lo calcola `personePerEsercizio` di `src/lib/personeTV.js` partendo dall'esercizio che
  accende `esercizioInCorso`: a ogni minuto (EMOM) o a ogni ON tutti avanzano di uno, e il giro
  ricomincia. Nell'OFF nessuna riga è colorata.
- ⚠️ Lo spostamento è **in esercizi**, non in minuti: in un EMOM con stazioni su più minuti
  (`intervals`, 9-stazioni-emom) chi parte su una stazione da due minuti non resta allineato.
  Accettato: con stazioni di lunghezza diversa non si possono far ruotare tutti insieme.
- **Ambiente di prova**: `supabaseDemo.js` ora fa parlare due SCHEDE dello stesso browser
  (BroadcastChannel): `/tv` in una, la scheda workout nell'altra, e il telecomando funziona.
  `tv_sessions` si rilegge sempre da localStorage, perché la scrive l'altra scheda.
- Provato così nell'ambiente di prova (EMOM a 4 esercizi, A dal 1°, B dal 2°, C dal 4°: al
  minuto 2 A su SkiErg, B su Burpees, C torna al primo). **Non provato su una TV vera.**
- ⚠️ La TV gira da `main`: arriva con `app:main`; il bottone sul telefono con la prossima
  versione sugli Store (sul web subito con `app:main`).

## 9-sposta. «Sposta a un altro giorno» dal menu (26/10/2026)
L'atleta sposta la sua assegnazione da qui (voce del menu ⋯, solo da fare e non gara) o dal
calendario: stesso foglio `FoglioSposta`, stessa logica. `spostaQui` aggiorna `workout.date` sul
posto, perché per l'atleta è già il suo `completed_date`. Tutta la storia: `calendario.md`, 9-sposta.

## 9-tv-orologio. Musica che si fermava e TV ferma col telefono bloccato (29/10/2026)
Due difetti segnalati dal committente, corretti insieme.
1. **Spotify si fermava al primo beep** (anche su una cassa Bluetooth). Causa: l'audio muto in
   loop che `initAudioAndPlay` faceva partire per far ignorare a iOS il tasto Silenzioso. Un audio
   infinito si prende la sessione audio: su iPhone categoria «lettore multimediale», su Android il
   focus audio pieno. **Tolto**. In più, aprendo il timer, `suonaSopraLaMusica`
   (`src/lib/sessioneAudio.js`) chiede a WebKit `navigator.audioSession.type = 'ambient'`, e alla
   chiusura torna `auto`.
   ⚠️ Il prezzo, scelto: in «ambient» **iOS rispetta il tasto Silenzioso**, i beep col telefono in
   silenzioso non si sentono (la vibrazione resta). ⚠️ L'API c'è da iOS **16.4**: sotto, su iPhone
   i beep fermano ancora la musica. Se non bastasse, la strada è nativa: un plugin che metta
   `AVAudioSession` in `.playback` con `.mixWithOthers` (e così anche col Silenzioso si sente).
   **Non provato su un telefono vero** al momento della correzione.
2. **La TV si fermava col telefono bloccato.** La TV mostrava solo i numeri che arrivavano dal
   telefono, e iOS a schermo bloccato sospende la webview: niente più messaggi. Ora la TV
   **conta da sola** (`statoTV` di `src/lib/avanzaTimer.js`) dall'ora in cui ha ricevuto l'ultimo
   stato, sulla sequenza che costruisce con `buildTimerSequence` dallo stesso workout, e i suoi
   beep seguono il suo orologio (`beepTV`). Se il passo all'indice ricevuto non coincide (workout
   cambiato, app vecchia) non scavalca il passo: scende a zero e aspetta.
   Anche il **telefono** al risveglio saltava solo al passo successivo, ripartendo dalla durata
   piena: ora attraversa tutti i passi passati con `avanzaSequenza`, la stessa funzione della TV,
   così i due coincidono. 🔴 Il ritmo è quello del tick: lo zero resta a schermo un secondo.
   ⚠️ La TV gira da `main` (`fleofit.vercel.app/tv`): la correzione della TV arriva solo con
   `app:main`; quella del telefono con la prossima versione sugli Store.
   Il passo dopo — il timer sul blocca schermo e sulla Dynamic Island — è in BACKLOG, da valutare.

## 9-live-activity. Il timer sul blocco schermo e nella Dynamic Island (29/10/2026)
Design A «Anello», scelto dal committente fra tre (prototipi in `tools/design-dynamic-island/`,
`index.html` le tre variazioni, `design-a.html` blocco schermo + Home + widget). Solo iPhone.
- **Dove si accende**: switch «Live Activity» in Impostazioni, nella carta in cima (solo su iPhone
  con un'app che porta il plugin). La **prima volta** che si apre il timer o il telecomando TV
  compare `FoglioLiveActivity` («Attiva» / «Non ora»), poi il timer si apre comunque. Una volta
  sola: poi decide lo switch. Preferenza in `fleofit_live_activity` (memoria del dispositivo).
- **JS**: `src/lib/liveActivity.js`. `statoLiveActivity` traduce lo stato del timer in date
  ASSOLUTE in millisecondi (fine del passo, fine dell'allenamento). In `WorkoutTimer` parte al
  primo «Avvia», si aggiorna **solo** al cambio di passo e di pausa (non al secondo), si chiude
  alla chiusura del timer: «Completato» resta 15 minuti, un timer chiuso a metà sparisce subito.
- **Nativo**: plugin dell'app `LiveActivityPlugin.swift` (registrato in `FleoBridgeViewController`,
  in `LettoreTesto.swift`), struttura condivisa `AttivitaTimer.swift` (🔴 in DUE target: app ed
  estensione), estensione widget `ios/App/FleoTimer/` (`TimerLiveActivity.swift`: blocco schermo,
  compact, minimal, expanded). Target `FleoTimer` aggiunto a mano al `pbxproj` (iOS 16.2, bundle
  `…fleofit.FleoTimer` e `…fleofit.dev.FleoTimer`). L'app resta da iOS 15: ActivityKit è linkato
  debole (`-weak_framework ActivityKit`) e il plugin risponde «non disponibile» sotto la 16.2.
- 🔴 **Col telefono bloccato la webview è sospesa** e il JS non manda niente. Nella prima prova
  sul telefono (29/10) la Live Activity restava sullo zero di «Preparati» finché non si riapriva
  l'app. Ora il JS manda, a ogni avvio/cambio di passo/pausa, anche il **programma**
  (`programmaLiveActivity`): ogni passo che verrà con l'ora in cui comincia, al ritmo di
  `avanzaSequenza` (lo zero resta un secondo, il passo dopo comincia a fine + 1 s; un test
  verifica che i due coincidano). In `LiveActivityPlugin.swift` la classe `Regia` lo mette in
  onda con un orologio nativo da 0,2 s e suona i beep (corti a 3-2-1, lungo allo zero, come
  l'app). Per restare sveglia in background l'app ha `UIBackgroundModes` → `audio` e, solo
  mentre è in background con un programma in corso, una sessione `.playback` +
  `.mixWithOthers` con un silenzio in loop (la musica dell'atleta non si ferma). Tornata davanti,
  la sessione torna `ambient` e il timer lo guida di nuovo la webview; i beep della webview tacciono
  quando la pagina è nascosta, per non sentirli doppi. A cronometro, in pausa e a «Completato» il
  programma finisce e l'app torna a dormire. Toni generati in memoria (WAV), niente file.
  🔴 **Tornando davanti l'audio va RESTITUITO alla webview** (terza prova, 29/10): il primo
  `spegni()` chiedeva `ambient` + `mixWithOthers`, combinazione che iOS rifiuta in silenzio, e
  riaprendo l'app dalla Live Activity la musica dell'atleta si fermava. Ora `setActive(false,
  .notifyOthersOnDeactivation)` e `ambient` senza opzioni; la pagina del timer richiede di nuovo
  «ambient» a ogni `visibilitychange`. Righe `[FLEOFIT audio]` nella console di Xcode per la diagnosi.
  ⚠️ Se iOS chiude l'app comunque, la vista scade e dice «Apri FLEOFIT per il passo successivo».
- 🔴 **Chiudendo l'app dal multitasking la Live Activity restava** (quarta prova, 29/10): il JS non
  arriva a `termina`. `load()` del plugin ora le chiude su `willTerminate` (aspetta al massimo 2 s)
  e all'avvio (dopo un riavvio il timer non riparte mai da solo, quindi sono orfane). ⚠️ Limite:
  `willTerminate` arriva solo se l'app è sveglia, cioè col timer che scorre; chiusa mentre era in
  pausa o a cronometro (app già addormentata) la Live Activity resta fino alla prossima apertura.
- 🔴 **Il tempo ha una cornice di larghezza CALCOLATA** (`Tempo` in `TimerLiveActivity.swift`, 29/10):
  `Text(timerInterval:)` non sa misurarsi. Due tentativi falliti sul telefono: cornice fissa da
  46 pt + `minimumScaleFactor` (con Spotify accanto si leggeva «0:0»), poi modello `.hidden()` +
  `.overlay` + `.fixedSize()` (il tempo spariva del tutto). Ora un testo solo in una
  `frame(width:)` calcolata da cifre possibili × dimensione (cifra 0,6 em, due punti 0,3 em, misurati
  sul Mac) + 25%, senza scala.
  ⚠️ Con un'altra attività nell'isola (Spotify) la compatta finisce tutta a SINISTRA della
  fotocamera e al tempo restano ~30 pt dopo l'anello: tagliato sempre allo stesso punto, a cornice
  46 o 51. Per questo la compatta usa `ViewThatFits` fra 15, 13 e 11 pt, con l'anello a 20 pt.
- 🔴 **Il tocco apre l'app con `fleofit://timer`** (`LINK_TIMER` di `src/lib/linkTimer.js`), e
  `DeeplinkHandler` lo ignora: l'app torna davanti dov'era. Nella prima prova (29/10) il link era
  `fleofit://` e basta: preso per un login fallito, mandava a `/login`, che ricaricava tutto e
  chiudeva il timer. Ogni link nuovo verso l'app deve avere un indirizzo suo, per lo stesso motivo.
- Non fatto nella prima versione: i bottoni Pausa/Passo (App Intents, iOS 17), l'avviso che apre
  l'isola al cambio di passo (`AlertConfiguration` suonerebbe sopra i beep), il widget quadrato.
- Compilato per il simulatore generico il 29/10 senza errori né avvisi; **non provato su un
  iPhone** al momento della scrittura.

