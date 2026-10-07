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
