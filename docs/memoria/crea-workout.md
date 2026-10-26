# Crea Workout (il builder) e il foglio «Genera con IA»

> Spostato da `CLAUDE.md` il 07/10/2026, **senza cambiare il testo**. I rimandi
> «§9-…» puntano a sezioni che ora stanno in altri file di questa cartella:
> si trovano con `grep -rn '^## 9-<nome>' docs/memoria`. L'indice è in `CLAUDE.md`.

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
5. ⚠️ *Superato dal righello il 07/10/2026 (§9-sexquadragies, in fondo a questo
   file): Stepper, ruota del passo e rotelle della corsa non esistono più.*
   **Le rotelle dei numeri sono sparite** dal flusso Hyrox: al loro posto il
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
> *Dal 07/10/2026 la ruota è il righello (§9-sexquadragies), ma la lezione qui
> sotto resta tutta: il modo è una pillola, il valore una scala.*
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
rimasto indietro (fino al 23/09 la dettatura importava `capacitor-voice-recorder`,
che però sotto chiamava lo stesso nativo di `@independo/…` — §9 punto 4), e la contesa su `AVAudioSession` è la stessa — e la forma
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
finto `@independo/capacitor-voice-recorder`, come fa `LoginApple.test.jsx`.
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

## 9-terquadragies. Il nome generato e il codice nel titolo (05/10/2026)

> ⚠️ **Il nome dagli esercizi non c'è più dal 07/10/2026**: Hyrox e Corsa senza
> nome prendono un nome CASUALE (§9-quinquadragies, sotto). I punti 3 e 5 qui
> sotto valgono solo per la storia; il codice e i punti 1, 2 e 4 restano veri.

Richiesta del committente: non essere obbligato a dare un nome al workout, e
leggere a colpo d'occhio cosa contiene. Tutto in `src/lib/codiceWorkout.js`.

    Wall Balls & Burpees · EM+FT 55′ @8
    Ripetute 8×400m      · RIP 50′ @9
    Lungo 18 km          · CL 18K @5

- **Il nome è facoltativo per Hyrox e Corsa** (prima solo per Custom). Se manca nasce
  dal contenuto: Hyrox → i due esercizi che pesano di più nei blocchi di lavoro, giri
  compresi; Corsa → «Ripetute 8×400m», «Lungo 18 km», «Corsa Z2», «Progressivo».
  Custom resta «Allenamento libero · lun 5 ott», senza codice.
- **Il codice** è COSA · QUANTO DURA · QUANTO È DURO. Sigle a due lettere dei soli
  blocchi di lavoro (EM, AM, FT, OO, IN; oltre tre «+N»), per la corsa CL/RIP/PR.
  Minuti esatti sotto i 10 e arrotondati a 5 sopra — quindi possono differire di un
  paio di minuti dal riepilogo, che è voluto. Una corsa tutta a distanza dice i km
  (`18K`), non minuti dedotti da un passo che nessuno ha scritto.
- **Si aggiorna dal vivo** sotto il nome nella testata del passo 2 (`data-codice`).

### ⚠️ Le cinque cose da sapere prima di rimetterci mano
1. 🔴 **Il codice si SALVA dentro `workouts.title`** (decisione del committente): così
   compare in archivio, PDF, storia, TV, push e web app senza toccarle, e la ricerca
   dell'archivio lo trova. Il prezzo: chi modifica i blocchi dalla web app lascia il
   codice vecchio finché non risalva dall'app.
2. 🔴 **La forma è un contratto con `separaCodice`**, che lo riconosce in coda per
   toglierlo prima di rigenerarlo. Senza, ogni salvataggio accoderebbe un secondo
   codice. Chi cambia sigle o separatore cambia anche `CODICE_IN_CODA`.
   ⚠️ Riconosce solo forme di codice vere: «Allenamento libero · lun 25 ago» e
   «Hyrox forte · EMOM 40» NON vengono toccati. Un titolo che finisce con
   « · 10K» scritto a mano invece sì: è il limite accettato di un codice testuale.
3. 🔴 **Un nome generato, riaperto, torna VUOTO nel campo** (si confronta con quello che
   il contenuto genererebbe): così continua a seguire i blocchi invece di diventare
   testo fisso alla prima modifica.
4. 🔴 **L'intensità è l'RPE ATTESO** (il riepilogo del builder, dagli esercizi), e solo
   se manca quella dichiarata. Non il contrario: il cursore dichiarato nasce a 5, e
   messo davanti scriverebbe «@5» su ogni workout in cui il coach non l'ha toccato.
   Senza nessuna delle due la parte `@` non c'è. Sulla corsa vale la fase più dura.
5. **La numerazione dei doppioni va sul NOME**, prima del codice («Sled (2) · EM 24′»):
   accodata al titolo intero romperebbe il punto 2. Un nome scritto non si numera.

I vecchi workout non hanno il codice finché non si risalvano: BACKLOG #57.
Test: `src/lib/__tests__/codiceWorkout.test.js` (25), `CodiceTitolo.test.jsx` (2),
tre in `CreaWorkoutBuilder.test.jsx`. Tre mutazioni provate, tre prese.

---

## 9-quaterquadragies. «Salva una copia» che cambiava l'originale (05/10/2026)

Segnalazione: salvando una copia di un workout a volte cambiava quello vero, quindi
anche agli atleti a cui era assegnato. **Verificato: `performSave(true)` non ha mai
sovrascritto niente** — inserisce sempre. Le strade per arrivarci erano tre, tutte in
`CreateWorkout.jsx`, e sono chiuse:

1. 🔴 **La bozza non sapeva se era una copia o una modifica.** Era legata al solo id di
   partenza, e si scriveva appena il workout era caricato. Aperto «Duplica» e chiusa
   l'app, aprendo poi «Modifica» dello stesso workout compariva «Bozza Trovata»:
   ripristinarla caricava la copia — titolo «(Copia)» compreso — su una schermata che
   salva SOPRA l'originale. Ora la bozza porta `modo` (`nuovo`/`copia`/`modifica`) e si
   propone solo nello stesso modo; una bozza senza `modo` è di prima e si scarta.
   ⚠️ E si scrive solo dopo un cambiamento VERO: il riferimento è il primo stato
   completo dopo il caricamento (`caricato` + `bozzaDiPartenza`). Tornati com'era, la
   bozza si cancella.
2. **Nella scelta il giallo era «Sovrascrivi».** Ora il bottone pieno è «Salva come
   nuovo», e sotto «Sovrascrivi esistente» c'è a quanti atleti (distinti) cambia.
   Se quella lettura fallisce la riga non compare e la scelta resta possibile.
3. 🔴 **Sovrascrivendo da un atleta (`aw_id`) la SUA data finiva su `workouts.date`**,
   cioè spostava il workout per tutti. Ora in quel caso l'update di `workouts` non
   porta `date`; la data dell'atleta va sulla sua assegnazione, come prima.
   ⚠️ «Salva come nuovo» da un atleta sposta la SUA assegnazione sulla copia — è
   voluto — e la finestra ora lo dice con il nome dell'atleta.
   ⛔ **Superato il 12/10/2026** (9-quinquagies): la copia non sposta più niente.

Test: `src/pages/__tests__/SalvataggioModifica.test.jsx` (9). Cinque mutazioni, cinque prese.

---

---

## 9-quinquadragies. Il nome generato dai blocchi, in gergo Hyrox/running (07/10/2026)

Richiesta del committente: il nome dagli esercizi («Wall Balls & Burpees») si
ripeteva identico ogni volta che si ricreava un workout con gli stessi esercizi.
Scartati un numero progressivo, la data, settimana + numero, esercizi + data e un
nome scritto da Gemini. Un primo generatore di parole casuali («Falco
Implacabile», «Diamante Elettrico») è stato **bocciato lo stesso giorno**: mai
ripetuto, ma scollegato dall'allenamento. 🔴 **Il nome deve dire che allenamento
è**: niente parole evocative senza legame con il contenuto.

La soluzione, in `src/lib/nomeCasuale.js`: dal contenuto si ricava un **elenco di
nomi pertinenti** (`candidatiNome`), in gergo inglese da box e da gruppo di corsa
(scelta del committente fra italiano, gergo e misto), e un **seme casuale** sceglie
quale usare.

    Wall Ball Burner · Leg Crusher · Metcon EMOM     (EMOM Wall Balls + Burpees @8)
    Compromised Sled Push · Sled Push & Run           (Sled + corsa For Time @9)
    Easy SkiErg · Z2 Engine · SkiErg Flow             (erg AMRAP @5)
    Hyrox Sim · Race Rehearsal                        (stazioni di gara + corsa)
    VO2max 400s · 8×400 Repeats · Track Session       (8×400 @9)
    Threshold 2K · Cruise Intervals                   (5×2 km @7)
    Long Run Easy · Long 18K · Zone 2 Long            (18 km @5)
    Zone 2 Run · Easy 45′ · Tempo Run · Progression Run

- **Hyrox**: l'esercizio che pesa di più nei blocchi di lavoro (tempo stimato × giri),
  il «focus» della sua famiglia (Leg, Engine, Grip, Metcon, Full Body con tre famiglie
  o più), l'intensità da `rpeAtteso` (≥8 Burner/Grinder/Crusher/Redline/Blast, 6-7
  Builder/Tempo/Threshold/Session, ≤5 Easy/Z2/Aerobic/Flow) e la struttura del blocco
  principale (EMOM, AMRAP, Chipper/For Time, Intervals).
- **Corsa**: ripetute per distanza o tempo della frazione (≤400 m velocità, fino a
  1200 m VO2max, oltre soglia; frazione a intensità ≤6 → Tempo/Aerobic), progressivo,
  lungo (≥15 km o ≥75′), poi per intensità massima: ≥8 Race Pace, 6-7 Tempo, sotto Easy.
- Custom resta «Allenamento libero · lun 5 ott». Il codice in coda non cambia:
  `descriviWorkout` è diventata `codiceWorkout` e torna solo il codice.
- Il seme si sceglie all'apertura del builder; **l'elenco segue i blocchi, il seme
  no**: toccando i blocchi il nome cambia e resta pertinente, a blocchi fermi resta
  fermo. Il dado 🎲 nel campo Nome (solo a campo vuoto e con dei blocchi) cambia il
  seme. Senza blocchi il campo dice «Facoltativo · lo scelgo dai blocchi».

### ⚠️ Le cinque cose da sapere prima di rimetterci mano
1. 🔴 **Corsa più una stazione è «compromised»**: il nome parla della STAZIONE anche
   se in tempo stimato i chilometri di corsa pesano di più. Senza, Sled + 4×1 km
   usciva «Run Burner». Con quasi tutte le stazioni di gara (≥6) più la corsa
   escono solo nomi da simulazione.
2. 🔴 **Unicità al salvataggio, contro TUTTI i workout** (`nomiGiaUsati`, una lettura
   di `workouts.title`): se il nome è preso si passa al candidato dopo
   (`nomeLibero`), e finiti i candidati si numera («Sled Grinder 2»). Se la lettura
   fallisce si salva lo stesso.
3. 🔴 **Un nome generato si riconosce perché sta fra i candidati del SUO workout**
   (`eNomeGenerato`). Riaperto in **modifica** resta quello (`nomeFissato`) finché i
   blocchi lo giustificano, e sovrascrivendo il workout non conta il proprio nome come
   «già usato» (`nomeDiPartenza`); in «Salva come nuovo» se ne prende un altro.
   ✏️ **Dal 26/10/2026 una copia («Duplica») parte SEMPRE senza nome** e al
   salvataggio ne prende uno nuovo dai blocchi, diverso dall'originale — anche se
   l'originale aveva un nome scritto a mano. **«(Copia)» non esiste più**
   (richiesta del committente). Il nome resta modificabile a mano prima di salvare.
4. I nomi salvati fra il 05 e il 07/10 (esercizi, o le parole casuali bocciate) non
   sono candidati: riaperti valgono come scritti a mano. Basta svuotare il campo.
5. `candidatiNome` torna i candidati **sempre nello stesso ordine**: è il seme a dare
   la varietà. Un ordine che cambiasse a ogni render farebbe saltare il nome.

Test: `src/lib/__tests__/nomeCasuale.test.js` (19), `CodiceTitolo.test.jsx` (5),
uno aggiornato in `CreaWorkoutBuilder.test.jsx`. Tre mutazioni provate
(esclusione del proprio nome, cambio di nome se preso, il compromised), tre prese.

---

## 9-sexquadragies. Il righello (07/10/2026)

Segnalato dal committente: «la scelta di metri, misure, distanze, numero blocchi
non è veramente intuitiva». Tre proposte mostrate (righello, tabella alla Hevy,
formati pronti); scelta del committente: **il righello**. Una prima proposta con
un tastierino numerico disegnato da noi e la frase a «gettoni» è stata **bocciata
senza appello** («oscena»): non riproporla.

### Cosa c'è ora
Un controllo solo per **ogni** numero del builder — ripetizioni, chili, metri,
tempi, round, passo, durate e distanze di corsa:
- **in alto le schede** delle misure di quella cosa, ognuna col suo valore scritto
  («Ripetizioni 15 · Peso 9 kg»): si legge tutto senza aprire niente;
- **il numero grande**, che toccato apre la tastiera numerica del telefono per il
  valore esatto (con «Fatto»: la tastiera numerica di iOS non ha l'invio);
- **il righello**, che si trascina col pollice con l'inerzia nativa e si aggancia
  alle tacche;
- **tre o quattro scorciatoie**: i valori più usati per QUELL'esercizio nello
  storico, e solo in mancanza un ripiego (mai sul peso);
- **le pillole** sopra il numero per i modi e i casi speciali: Max, Un peso / Due
  pesi / Senza peso, Ripetizioni / Distanza degli ibridi, Ritmo / Cadenza /
  Sensazione (ergometri), Ritmo / Zona / Velocità (Run), Tempo / Distanza (corsa).

Dove vive:
- `src/lib/scaleMisura.js` — le scale (quali valori esistono e con che scatto),
  `indiceVicino`, `valoreDaTesto` («130» → «1:30»), `testoMisura`. Logica pura.
- `src/components/Righello.jsx` — solo il gesto.
- `src/components/FoglioMisure.jsx` — schede, numero, righello, scorciatoie;
  più `FoglioParametri`, il foglio dal basso dei parametri dei blocchi.
- In `CreateWorkout.jsx`: `ExercisePicker` (le funzioni `vista*` descrivono le
  schede), `parametriDelBlocco` (i numeri di ogni tipo di blocco),
  `RunningStepPicker` (ora a schermo intero, `tratto()` per «quanto» e «passo»).

### ⚠️ Le sei cose da sapere prima di rimetterci mano
1. 🔴 **Il formato salvato NON è cambiato.** Le scale producono le stesse stringhe
   di prima («15», «9 kg» → `kg: "9"`, «250m», «1:30», «3:50 /km», «45 min»,
   «1.5 km», «12.0 km/h»): il database è condiviso con la web app in produzione.
   L'unica forma nuova è il **mezzo chilo** (`"82.5"`, col punto), che `numero()`
   dei report e `metriDi`/`parseDuration` leggono già. `scaleMisura.test.js`
   confronta le scale con le liste di prima **copiate lì apposta**: se una scala
   cambia forma, quel test è il primo a dirlo.
2. 🔴 **Il righello scrive solo quando lo muove il dito** (`dalDito` in
   `Righello.jsx`). Anche lo scorrimento fatto dal codice (posarsi sul valore,
   una scorciatoia) genera eventi di scroll: ascoltandoli, aprire un esercizio
   senza peso gli scriverebbe da solo il valore di partenza. ⚠️ jsdom non genera
   eventi di scroll, quindi **questo non è coperto da test**: va riprovato a mano
   sul telefono dopo ogni modifica al righello. ✅ Provato sull'emulatore Android il
   07/10/2026: aprendo e posandosi su una scorciatoia il valore non cambia.
3. **Un valore vuoto non si scrive «—» a 64px**: si mostra spento il valore sotto
   l'ago, e la scheda in alto dice «—». Il trattino gigante sembrava un difetto.
4. **I numeri delle tacche stanno SOTTO le tacche**: sopra, il puntino dell'ago
   copriva proprio il valore scelto.
5. **I parametri del blocco non stanno più nella card**: lì ci sono le pillole
   («Ogni 1:00 · Round 10»), e il righello sale dal basso (`FoglioParametri`,
   che usa `useBottomSheet`). Il sottotitolo del foglio dice la durata del blocco
   mentre la si cambia.
6. **Righello e FoglioMisure si importano solo da `CreateWorkout`**, mai da
   `CreaWorkoutUI.jsx` (chunk condiviso con la scheda workout, CLAUDE.md §2).
   Da `CreaWorkoutUI` sono usciti `Stepper` e `RuotaValori`.

### 🔴 Trovato sull'emulatore: il righello non si muoveva col dito
Tutti i test erano verdi, e nel foglio dei parametri il righello **non scorreva**.
Due cause, nessuna visibile in jsdom (ora ci sono tre test, «il dito sul righello»):
1. il blocco del «tira giù per ricaricare» in `CreateWorkout` (l'effetto con
   `handleTouchMove`) annullava ogni `touchmove` in cui il dito scendeva anche di
   mezzo pixel, se la pagina era in cima. Con un foglio aperto `useBottomSheet`
   blocca il body con `position: fixed`, quindi `scrollY` vale **sempre** 0: ogni
   trascinamento orizzontale moriva lì. Ora si annulla solo un tirare giù vero
   (più verticale che orizzontale) e non dentro una lista che può ancora salire —
   lo stesso difetto impediva di riscorrere verso l'alto le liste interne;
2. il tocco nato nel foglio (un **portale**) risaliva in React fino al blocco, che
   ha il trascina-per-riordinare: tenendo il dito fermo 250ms partiva il riordino,
   che blocca ogni scorrimento. `useTouchDrag` ora ignora i tocchi che non stanno
   nel DOM dell'elemento (`currentTarget.contains(target)`).
⚠️ La lezione: un gesto del dito si prova su un dispositivo (o con
`adb shell input swipe` sull'emulatore), non solo con le frecce in jsdom.

### Le scale, in breve
Ripetizioni 1–100 di 1 · peso 0,5–20 di 0,5 poi fino a 300 di 2,5 · doppio 2×1–2×50
· metri 10–300 di 10, poi 50 fino a 1000, 100 fino a 2000, 500 fino a 5000 · tempo
5″ fino a 1′, 15″ fino a 10′, 30″ fino a 30′, 1′ fino a 120′ · recupero fino a 15′ ·
passo corsa 2:00–9:55 di 5″ · passo ergo 1:30–6:30 di 5″ · cadenza 40–120 · velocità
5–25 km/h di 0,5 · durata corsa 5″–55″ poi 1′–180′ · distanza corsa 10 m–950 m,
poi 1–10 km di 0,5, poi fino a 42 km. Un valore vecchio che non cade su una tacca
(«1:37») resta com'è finché non lo si tocca: il righello si posa sulla più vicina.

### Non fatto, e perché
- **Le calorie sugli ergometri** («20 cal»): sarebbe una forma nuova nel database,
  e la web app su `main` e la stima della durata non la conoscono. Va deciso.
- **Pesi standard Hyrox** come scorciatoie: andrebbero confermati dal committente.

Test: `scaleMisura.test.js` (33), e in `CreaWorkoutBuilder.test.jsx` le sezioni
«il righello scrive il vocabolario di prima», «il passo: prima il modo, poi il
valore», «i numeri del blocco stanno in un foglio dal basso», «le fasi di corsa».
Mutazioni provate e prese: formato del peso e del tempo nelle scale (9 test rossi),
scorciatoie non dallo storico, scatti di 1 kg sopra i 20, intervallo di passo non
composto.

---

### Ritocchi del 13/10/2026 (richiesta del committente)
- **Metri fino a 10 km**: la scala `METRI` di `scaleMisura.js` si fermava a 5000m, poco per gli
  ergometri. Ora va avanti a passi di 500 fino a 10000m (vale anche per slitta, carry, Run: è la
  stessa scala). Il formato resta `"7500m"`.
- **«Scrivi» al posto dell'icona**: accanto al numero grande c'era solo una tastierina da 15px
  grigio scuro, e non si capiva che il numero si potesse scrivere a mano. Ora è una pillola
  con icona e parola «Scrivi» (`NumeroGrande` in `FoglioMisure.jsx`). Tutto il numero resta
  toccabile come prima.
- **Standard per esercizio** (`STANDARD_ESERCIZIO` in `CreateWorkout.jsx`): Wall Balls →
  4, 6, 9, 12, 15 kg; ogni esercizio con «Lunge» nel nome → 10, 20, 30 kg; slitta (Sled, Prowler
  Push/Pull/Drag) → 100, 150, 200 kg. Solo pesi: ripetizioni e metri restano dallo storico.
  Vengono **prima** dello storico di `rapidiDi`: sono i valori
  che il coach vuole sempre vedere. ⚠️ Cinque pillole e non quattro per la Wall Ball: a 375px
  stanno su una riga solo perché le etichette sono corte.

### Ritocchi del 14/10/2026 (richiesta del committente)
- **Righello meno sensibile**: `PASSO_TACCA` di `Righello.jsx` da 14 a **22px**. Con 14 bastavano
  7px di dito per cambiare tacca, e una correzione di un valore solo non riusciva. Il prezzo:
  per attraversare una scala lunga serve un trascinamento più ampio (l'inerzia nativa resta).
  ⚠️ Non provato sul telefono: è un gesto, jsdom non lo vede (punto 2 delle «sei cose»).
- **Il Rest apre su 1:00** (`handleSelect` in `ExercisePicker`): è l'unica eccezione a «aprire
  un esercizio non scrive niente da solo». Si scrive solo se `meters` non è già un tempo: un Rest
  riaperto tiene il suo valore, e i «500m» di un esercizio scelto prima non contano. Il blocco
  Rest invece nasce già a 3:00 da `aggiungiTipo`. Test: «il Rest apre già su un minuto».
- 🔴 **Bug: fermarsi col dito giù bloccava il righello.** Scorrendo, una pausa di un attimo e poi
  avanti e indietro: il valore restava fermo (il committente l'ha visto sugli 8′ dell'AMRAP, ma
  non dipendeva dalle scorciatoie). Causa: appena lo scorrimento nativo prende il gesto, il
  browser manda `pointercancel` **col dito ancora appoggiato**; il righello lo trattava come un
  dito staccato, e dopo 180ms senza scroll `dalDito` tornava falso. Ora il dito si segue solo con
  `touchstart`/`touchend`/`touchcancel`; gli eventi del puntatore valgono solo per il mouse.
  Test: `src/components/__tests__/Righello.test.jsx` (visto fallire prima della correzione).
- 🔴 **Il vero colpevole, trovato dopo la seconda segnalazione** («si blocca a caso, quando
  rallento, senza staccare il dito»): il blocco del «tira giù per ricaricare» in `CreateWorkout`
  misurava a ogni `touchmove` lo spostamento **dal punto di partenza**. Trascinando il righello
  lontano e tornando vicino a dove il dito si era posato, l'orizzontale totale si azzerava, e
  pochi pixel di discesa bastavano a sembrare un tirare giù: `preventDefault`, e su iPhone lo
  scorrimento si ferma a metà gesto. Ora la direzione si decide **una volta**, al primo movimento
  oltre 8px, e resta quella fino al dito staccato; il gesto sta in un ref (`gestoDito`), così una
  riregistrazione dell'effetto a metà gesto non riparte da zero. Test in «il dito sul righello»
  («lontano a sinistra e ritorno…», «un gesto nato orizzontale…»), visti fallire col codice di prima.
- 🔴 **Terza segnalazione: «lancio, interrompo l'animazione col dito, e il numero si blocca».**
  Rifatta la logica di `Righello.jsx`: non si cerca più di capire QUANDO c'è il dito
  (`dalDito`, touchstart/touchend e un timer di 180ms: tolti), si marca lo scorrimento del
  **codice** (`daCodice`, la x dove sta andando). Ogni altro scorrimento — dito, inerzia,
  rotella — scrive. Il tocco che ferma un'inerzia su iOS non sempre arriva alla pagina:
  col vecchio sistema il righello, credendo il dito sparito, ignorava tutto. Tre regole:
  1. il righello **non si riposiziona mai** su un indice che ha scelto lui (era il secondo
     scorrimento che si scontrava con l'inerzia);
  2. un dito/rotella a metà di uno scorrimento del codice lo libera subito;
  3. rete di sicurezza: senza eventi per 150ms (400 all'avvio) `daCodice` scade da solo,
     così il righello non resta mai sordo.
  Test: `Righello.test.jsx` (6; tre falliscono col codice di prima).

## 9-septquadragies. L'intensità degli esercizi generati dall'IA (08/10/2026)

Feedback del committente: con «Genera con IA» gli esercizi **non avevano
intensità** se non la si dettava, e la riga non mostrava niente. Causa: il prompt
di `ai-workout` non nominava mai `intensity` (l'esempio portava solo nome, reps,
kg, metri), e il builder accodava i blocchi così come arrivavano. Un esercizio
aggiunto a mano invece nasce sempre a 5 dal picker. Conseguenza meno visibile ma
peggiore: senza intensità quegli esercizi **non pesano nell'RPE atteso** (§ sopra,
il ciclo li salta), quindi un workout tutto generato non aveva RPE atteso.

Rimedio su due livelli:
1. **Il prompt** chiede `intensity` su ogni esercizio: quella dettata se c'è,
   altrimenti stimata dal contesto (riscaldamento/Cash In/Cash Out leggeri, lavoro
   centrale 6-8, all out 8-10), mai su «Rest». ⚠️ Vale solo dopo il deploy della
   Edge Function, che è condivisa con la web app (innocuo lì: un campo in più).
2. **`preparaBlocchiIA`** (`src/lib/blocchiIA.js`) è la rete sotto: normalizza
   quello che Gemini scrive (7, "7/10", "8.5" → stringa intera 1-10) e, se manca o
   è illeggibile, mette `INTENSITA_PREDEFINITA` = 5, lo stesso valore da cui parte
   il picker. Niente intensità sull'esercizio «Rest», come nel picker.

Test: `src/lib/__tests__/blocchiIA.test.js` (8). Mutazione provata e presa: il
ripiego a 5 tolto.

---

## 9-octoquadragies. Le stazioni EMOM su più minuti (09/10/2026)

Feedback del committente: in un EMOM serve poter scrivere «minuto 1 burpees,
**minuti 2 e 3** vogatore, minuto 4 wall balls», dove 2–3 è **una stazione
continua**, non lo stesso esercizio ripetuto due volte (quello si fa già con
«Duplica»). Prima ogni esercizio valeva esattamente un intervallo.

### Cosa c'è ora
- Nel foglio dell'esercizio, **solo dentro un EMOM**, la card «Durata della
  stazione»: cinque bottoni con il tempo già moltiplicato per l'intervallo del
  blocco (1:00 · 2:00 · … oppure 1:30 · 3:00 · … se il blocco è «ogni 1:30»).
- Il dato è **`intervals`** sull'esercizio, una stringa come gli altri campi
  (`"2"`); assente o 1 = il comportamento di sempre. Si scrive solo se > 1.
- Builder, scheda, PDF e TV numerano **«1 · 2–3 · 4»** (`etichetteStazioni`);
  il timer fa **una fase sola** da 2′ (`fasiEmom`), con «Round 2–3/10».
- Nell'RPE atteso una stazione da due intervalli pesa il doppio.
- Tutta la logica sta in `src/lib/stazioniEmom.js`.

### ⚠️ Le cose da sapere prima di rimetterci mano
1. **«Round» resta il numero di INTERVALLI totali**, come prima. Quindi
   `durataBlocco` non è cambiata, e un workout vecchio non cambia di un secondo.
   Se i round finiscono a metà stazione, l'ultima fase si accorcia (con
   1+2+1 minuti e 10 round l'ultimo vogatore dura un minuto): il coach che vuole
   giri interi mette un multiplo della sequenza (12).
2. ✅ **Portata anche su `main` il 09/10/2026** (commit `d7d53cd`, branch
   `emom-stazioni-web`): stessa `stazioniEmom.js`, numerazione «2–3» in builder,
   scheda, PDF e TV. Su `main` non c'è timer guidato. 🔴 Le due copie di
   `stazioniEmom.js` vanno tenute uguali: il database è condiviso.
3. Su ON/OFF e sugli altri blocchi il campo è **ignorato** anche se presente: c'è
   un test.
4. Prima di questa versione c'era un tentativo diverso, con righe duplicate e i
   gesti «Unisci» / «Separa», scartato dal committente per il campo «Minuti»: è
   rimasto in uno `git stash` («EMOM Unisci/Separa»), non va ripreso.
5. ⚠️ `reportAtleta.movimentiDi` moltiplica ripetizioni e metri per **tutti** i
   round del blocco anche in un EMOM, dove ogni esercizio si fa solo nei suoi
   minuti. È un difetto **precedente** a questa modifica, non toccato qui.

### L'IA (stesso giorno)
Alla prima prova il committente ha dettato «minuti 2-3 sled push» e Gemini ha
scritto due Sled Push separati: il prompt non conosceva il campo. Ora il prompt
di `ai-workout` spiega `intervals` (una riga sola, mai l'esercizio ripetuto) e
l'esempio lo usa; `preparaBlocchiIA` lo normalizza a stringa e lo toglie fuori
dagli EMOM o quando vale 1. ✅ **Deploy di `ai-workout` fatto il 09/10/2026**
(porta con sé anche l'intensità di §9-septquadragies). La funzione è condivisa
con la web app: lì il campo in più è innocuo, viene ignorato.
⚠️ NON si fondono lato app due righe uguali consecutive: il coach può volere
davvero lo stesso esercizio in due minuti separati.

Test: `stazioniEmom.test.js` (8), tre in `timerSequence.test.js`, uno in
`stimaWorkout.test.js`, due in `CreaWorkoutBuilder.test.jsx` («le stazioni EMOM
su più minuti»). Mutazioni provate e prese: fasi sempre da un intervallo (3
rossi), peso dell'RPE senza intervalli (1), campo non salvato dal picker (1).
Più due in `blocchiIA.test.js`; mutazione presa: campo scartato da `preparaBlocchiIA`.


## 9-ai-riserva. «Genera con IA» senza quota (09/10/2026)

Il piano gratuito di **Gemini 2.5 Flash dà 20 richieste al giorno**. Finite
quelle (il 09/10 le avevano consumate le prove della ricerca, che usava la
stessa chiave), il builder:
1. mostrava il **JSON d'errore di Google intero** — mille caratteri con link e
   «retry in 11h20m35.12s» — che usciva dall'avviso;
2. restava **senza IA per undici ore**.

Rimedi:
- `src/lib/erroreIA.js` traduce l'errore in una frase breve («Le richieste
  gratuite all'IA per oggi sono finite: si riprova fra circa 11 ore…») e taglia
  qualunque messaggio sconosciuto a 160 caratteri. `CustomAlert` e
  `CustomConfirm` hanno ora `break-words` e un tetto d'altezza con scorrimento:
  nessun avviso può più uscire dalla finestra, qualunque cosa gli si passi;
- `ai-workout` ha la **riserva su Groq** (`_shared/groq.ts`): su 429/404/5xx di
  Gemini rimanda lo stesso prompt a `gpt-oss-120b` in modalità JSON (che vuole
  un oggetto: i blocchi stanno in `{"blocks": [...]}`, e `blocchiDaTesto`
  accetta le due forme), e la voce a Whisper;
- `fetchWithRetry` non ritenta più i **429**: sul piano gratuito sono la quota
  del giorno, e ritentarli bruciava richieste e sette secondi prima del no;
- il server manda messaggi brevi, non il corpo di Google (che va nei log).
⚠️ `ai-workout` la chiama solo l'app: verificato che `main` usa soltanto
`send-reminders`, quindi il suo deploy non tocca la web app.

---

## 9-ai-modifica. «Genera con IA» modifica i blocchi che ci sono (12/10/2026)

Richiesta del committente: «se ci sono blocchi, anche creati a mano, se chiedo
una modifica me la deve fare». Prima ogni risposta dell'IA finiva **in coda**:
«togli il Cash Out» aggiungeva un blocco.

- Con almeno un blocco nel builder, `AiGenerationModal` manda anche
  `blocchiAttuali` (`blocchiPerIA` di `src/lib/blocchiIA.js`: gli stessi dati
  **senza gli `id`**, che si rimettono nuovi al ritorno con `preparaBlocchiIA`).
- `ai-workout` aggiunge al prompt `istruzioniModifica` (`regole.ts`): l'IA
  restituisce l'allenamento **INTERO**, identico dove la richiesta non tocca.
  Risponde con `modifica: true`, e solo allora il client **sostituisce** la lista.
- 🔴 **Il client sostituisce solo se il server dice `modifica: true`.** Una
  funzione non ancora pubblicata ignora i blocchi attuali e restituisce solo i
  nuovi: sostituire avrebbe cancellato tutto il resto. Senza deploy si torna
  semplicemente ad aggiungere.
- Una modifica che torna **zero blocchi** non svuota il builder: avviso e niente.
- **«Annulla»** nella fascia viola sotto la card: si vede finché `blocks` è
  *lo stesso riferimento* scritto dall'IA, quindi sparisce al primo ritocco a
  mano — annullare non butta via il lavoro fatto dopo.
- Oltre `LUNGHEZZA_MASSIMA_BLOCCHI` (30.000 caratteri di JSON) il server non
  manda i blocchi e torna a generare in coda.
- Il foglio cambia le parole in modifica (sottotitolo, segnaposto, «Modifica
  workout»), ma `aria-label` del dialogo resta «Genera con IA».

### I blocchi scritti dall'IA arrivano aperti (12/10/2026)
Richiesta del committente: dopo una generazione restava aperto solo l'ultimo
blocco, e li riapriva uno per uno per rileggerli. `openBlockId` (un id) è
diventato **`bloccoAperti`, un Set**:
- l'IA, sia generando sia modificando, apre **tutti** i blocchi che ha scritto;
- a mano resta la fisarmonica: **aprire** un blocco chiude gli altri,
  **chiudere** toglie solo quello (gli altri aperti dall'IA restano);
- ⚠️ ogni cambio è un **Set nuovo**: lo stesso riferimento non farebbe
  ripartire né il render né l'effetto che porta il blocco sotto gli occhi
  (`[blocks, bloccoAperti]`, ex `[blocks, openBlockId]` qui sopra).

---

## 9-blocco-confermato. Un blocco nuovo chiede i suoi numeri (12/10/2026)

Richiesta del committente: «tutti i blocchi, quando creati, chiedono le
informazioni del blocco stesso (tempo o round) e poi si conferma con un tasto».
Prima il blocco entrava nella lista con i valori di partenza, e i numeri si
cercavano dopo, toccando le pillole.

- Scelto il tipo in `BlockPickerModal`, il blocco va in **`bloccoInArrivo`**,
  NON in `blocks`: si apre `FoglioParametri` sul primo parametro di
  `parametriDelBlocco` (Durata, Ogni, ON, Round…).
- `FoglioParametri` ha due prop nuove, `conferma` (l'etichetta del bottone) e
  `onConferma`. ⚠️ Anche la conferma passa dall'**uscita animata**:
  `onConferma` arriva a foglio sceso, come `onChiudi`; un ref decide quale
  dei due chiamare. Ogni altra uscita (X, velo, maniglia, Esc, indietro di
  Android) **scarta** il blocco.
- Il blocco confermato entra con `aggiungiBlocco`: in fondo, aperto, sotto gli occhi.
- I blocchi dell'IA **non** passano da qui: arrivano già con i loro numeri.
- 🔴 I test che aggiungono blocchi col picker devono confermare: c'è
  `confermaBlocco()` in `CreaWorkoutBuilder.test.jsx` e `CreateWorkoutMemo.test.jsx`.
  ⚠️ Mentre il foglio è aperto ci sono DUE bottoni «Aggiungi blocco» (quello
  della pagina e la conferma): l'helper prende quello dentro il dialogo.

---

## 9-quinquagies. La copia parte pulita: niente atleti, niente note (12/10/2026)

Richiesta del committente: duplicando o modificando un workout, la copia non deve
portarsi dietro gli atleti dell'originale né le note.

- **«Salva come nuovo»** (da «Modifica»): prima, entrando da un atleta (`aw_id`),
  la SUA riga di `athlete_workouts` veniva spostata sulla copia — con stato, RPE e
  note scritte sull'originale. Ora `performSave` non tocca nessuna assegnazione, e
  `athlete_id` assegna solo quando **non** c'è `editId`: in modifica quell'atleta è
  «precedente». Dopo il salvataggio la scheda si apre senza `?athlete_id=`.
- **Note del coach**: «Duplica» apre con il campo vuoto; «Salva come nuovo» salva
  `coach_notes: ''` se il coach non le ha toccate (`noteDiPartenza`), altrimenti
  tiene quelle riscritte — sono della copia.
- ⚠️ **Custom è l'eccezione**: lì `coach_notes` È l'allenamento, svuotarle
  vorrebbe dire copiare un workout vuoto (e il salvataggio lo rifiuterebbe).
- **«Duplica» da un atleta** (`AthleteDetail`, `?duplicate=…&athlete_id=…`)
  assegna ancora la copia a quell'atleta: è quello per cui si sta programmando.
- La finestra di «Salva come nuovo» lo dice (`data-avviso-copia`).

Test: `SalvataggioModifica.test.jsx` (13), i quattro nuovi visti fallire sul codice di prima.

---

## 9-da-testo. «Da un testo scritto» (12/10/2026)

Richiesta del committente: «se qualcuno ha il workout scritto da qualche parte —
nelle note, su una lavagna, in uno screen — l'app lo legge e lo converte nei
blocchi», possibilmente **senza IA**. Il piano ha tre fasi; questa è la **1**:
il testo **incollato**. La foto (OCR del telefono) è BACKLOG #66.

### Com'è fatto
- `src/lib/leggiWorkout.js` — **logica pura, nessuna IA**: regole riga per riga.
  `leggiHyrox(testo)` → `{ blocchi, note, righe }`, `leggiCorsa(testo)` →
  `{ fasi, note, righe }`. `righe` dice cosa è diventata ogni riga (`blocco`,
  `esercizio`, `nuovo`, `nota`) ed è quello che l'anteprima mostra.
- `src/components/FoglioDaTesto.jsx` — il bottom sheet, **pigro** (chunk suo,
  ~18 KB): non pesa su `CreateWorkout` per chi non lo apre. Si apre dal bottone
  «Da un testo scritto» sotto la card IA (Hyrox) e sotto l'intensità (Corsa).
- `usaDaTesto` in `CreateWorkout` — i blocchi passano da `preparaBlocchiIA`
  (id nuovi, intensità di partenza) come quelli dell'IA. Con blocchi già nel
  builder si sceglie **«Aggiungi in coda»** o **«Sostituisci»**; la sostituzione
  riusa la fascia «Annulla» di `modificaIA` (con `daTesto: true`, grigia e non
  viola: non è IA). Le righe venute prima di ogni blocco vanno **in coda** alle
  note del coach.
- Le tassonomie (`HYROX_EXERCISES`, `isDistance`…) sono uscite da
  `CreateWorkout.jsx` in **`src/lib/esercizi.js`**: due copie divergerebbero.

### Cosa riconosce
- Intestazioni: Warm up / riscaldamento, EMOM / E2MOM / «ogni 3' x 4», AMRAP,
  For Time / RFT / «3 rounds», ON/OFF («40" on 20" off x8», «40/20»), Tabata,
  Cash In / Buy in, Cash Out, Interval, Rest. «EMOM 12'» = durata **totale**.
  Quello che segue i due punti («AMRAP 20: 10 burpees + 15 wb») è già esercizio.
- Esercizi: reps, `max`, `3x10`, metri/km, `4x25m`, kg, `2x24kg`, `@60`, passo
  `2:00/500`, `Z2`, rpm, `RPE 8` / `@8/10`, calorie (nella nota). Nomi esatti,
  plurali, **sinonimi** (`ski`, `wb`, `bbj`, `affondi`…) e un errore di battitura.
- Corsa: riscaldamento/defaticamento/recupero, `6x400m @3:45 rec 1'`, intervalli
  di passo `4:10-4:20`, zone, «all out», «gara», «camminata».

### 🔴 Le regole che non sono gusto
1. **Nessun numero inventato.** EMOM senza durata → niente `rounds`; ripetute
   senza recupero → `recDuration: ''`; «row 15» non diventa 15 metri (resta
   nella nota). Il builder mostra il ripiego e il coach vede cosa manca.
2. **Nessuna riga si perde.** Quello che non si capisce va nelle note del blocco
   in cui stava, o in quelle del coach se viene prima di ogni blocco.
3. **Il WarmUp NON ha esercizi nel builder** (`conEsercizi` in `HyroxBlock`):
   trovato provandolo nel browser — «500m row» dentro un riscaldamento spariva
   dalla scheda senza dire niente. Lì le righe vanno nelle **note del blocco**.
4. **Le note del blocco sono un campo su UNA riga** (`RigaTesto`, un `<input>`):
   un a capo lì incolla le parole («500m row20 jumping jack»). Si uniscono con
   « · ». Le note del coach sono un'area di testo e tengono l'a capo.
5. **Niente «contiene» sui nomi**: «wall» sta in Wall Balls e in Wall Walk.
   Un nome non riconosciuto con un numero entra **col nome scritto** (esercizio
   custom, segnato «esercizio nuovo» nell'anteprima).
6. Un esercizio senza intestazione davanti — o dopo un Rest — apre un For Time
   **senza giri**.

### ⚠️ Da sapere
- Le regole sono scritte sul gergo **generico**. Gli esempi veri del coach
  (BACKLOG #67) vanno nei test **prima** di toccare una regola.
- `ERGOMETERS` sta in `constants.js`, non in `esercizi.js`: `esercizi.js` lo
  importa ma non lo riesporta.

Test: `leggiWorkout.test.js` (29) e `CreaWorkoutDaTesto.test.jsx` (5); le regole
🔴 viste fallire rompendo apposta il codice.

### Fase 2: la foto (12/10/2026, solo iOS)
- `ios/App/App/LettoreTesto.swift` — plugin dell'app, **Apple Vision**
  (`VNRecognizeTextRequest`, `.accurate`, it-IT + en-US), tutto sul telefono:
  niente IA generativa, niente rete, niente quota. Restituisce i pezzi di testo
  con la **posizione** (frazioni, origine in alto a sinistra). La correzione
  linguistica è accesa, con le parole del gergo protette (`PAROLE_GERGO` in
  `src/lib/lettoreTesto.js`), o «SkiErg» diventerebbe una parola italiana.
- `src/lib/testoDaFoto.js` — rimette i pezzi in **ordine di lettura**. Una
  lavagna su due colonne letta dall'alto in basso mescolerebbe i due workout
  riga per riga.
  - Una colonna comincia dove **almeno tre** pezzi partono allineati a sinistra.
  - Due allineamenti sono colonne diverse solo se i loro pezzi stanno sulle
    **stesse righe**: un rientro (gli esercizi sotto «EMOM») ha righe sue.
  - 🔴 Un pezzo che **scavalca** l'inizio di una colonna è un titolo. Trovato
    sul simulatore: «HYROX SATURDAY» al centro della lavagna, stretto, copriva lo
    spazio fra le colonne e con la prima regola (intervalli che si toccano) le
    fondeva in una. I test non lo vedevano perché lì il titolo era largo.
- `FoglioDaTesto` — «Fotografa o scegli una foto», solo se
  `fotoDisponibile()`. La foto si riduce a **2400px, qualità 0.9**
  (`riduciImmagine` ha preso le opzioni `max` e `qualita`): a 1280 la scritta di
  una lavagna fotografata da lontano è troppo piccola. Il testo letto va **in
  coda** al campo (si può fotografare in due scatti) e resta modificabile.
- Fotocamera e radice nativa: docs/memoria/app-store.md §9-foto-ocr.
- Android: fase 3, qui sotto.

Test: `testoDaFoto.test.js` (9) e `FoglioDaTestoFoto.test.jsx` (5), visti
fallire rompendo le regole; il caso della lavagna usa le posizioni lette da
Vision sul simulatore.

### Fase 3: la foto su Android (12/10/2026)
- `android/app/src/main/java/it/federicoleo/fleofit/LettoreTestoPlugin.java` —
  **ML Kit**, modello dentro l'app, registrato in `MainActivity`. Stessa
  interfaccia del plugin iOS: il JavaScript non è cambiato, salvo i bottoni.
- Su Android il foglio ha **due bottoni**, «Scatta una foto» (`capture`) e
  «Dalla galleria»: la webview non offre la scelta da sé (android.md A.3 punto 11).
- ⚠️ **Mai compilato**: scritto sul Mac, dove non c'è il JDK. Istruzioni di
  prova in android.md A.4; la foto di prova è `tools/prova-foto/`.

Test: `FoglioDaTestoFoto.test.jsx` (7): i due nuovi dicono un bottone su iOS e
due su Android, con `capture` solo sullo scatto; visto fallire spegnendo la regola.

### Screenshot, tastiera e righe sottintese (12/10/2026)
Provato dal committente su Android («funziona»), con tre rilievi:

1. **La tastiera e l'orario finivano nel workout.** Su uno screenshot delle Note
   Vision legge anche la barra di stato («11:574»: la campanella diventa un 4),
   le icone («<», «•••»), la barra degli strumenti («Aa»), i suggerimenti
   («The», «I'm») e i tasti a gruppi («QWERT», «A S», «× C»).
   `senzaInterfaccia` in `testoDaFoto.js` li toglie **prima** di ordinare:
   - è tastiera una riga con almeno 4 gruppi di 1–5 maiuscole, **o** le cui
     lettere seguono l'ordine di una tastiera (QWERTY/QWERTZ/AZERTY): Vision
     legge a volte la prima riga in due soli pezzi;
   - cade tutto sotto la sua prima riga; nella fascia di 0,15 sopra cade solo
     ciò che **non ha cifre** (una riga di workout attaccata alla tastiera resta);
   - un orario nel 6% alto si porta via la sua riga; le icone senza lettere né
     cifre spariscono ovunque.
   Il caso vero è `fixtures/screenshot-note-ios.json`: le posizioni lette da
   Vision **sullo screenshot del committente**, con le impostazioni dell'app.
2. **«300m» da solo è lo ski di prima.** In «200m ski / 10 burpees / 300m /
   15 burpees / 400m…» la distanza nuda prende l'**ultimo esercizio misurato in
   metri** (`dedotto` in `leggiHyrox`), e l'anteprima la segna «dedotto dalle
   righe sopra». ⚠️ Solo le distanze: un «15» nudo può essere reps, giri o kg,
   e resta una nota. Senza un esercizio in metri prima, resta una nota.
3. **«Non mi ha chiesto i permessi.»** È corretto così, non è una dimenticanza:
   - la **galleria** passa dal selettore di sistema (iOS: PHPicker, che lo dice
     con «Accesso privato alle foto»; Android: il selettore di file/foto). L'app
     riceve solo la foto scelta e non legge la libreria: nessun permesso da
     chiedere, ed è il modo che Apple e Google raccomandano;
   - la **fotocamera** su iOS chiede il permesso al **primo** «Scatta foto»,
     con il testo di `NSCameraUsageDescription`; su Android si apre l'app
     fotocamera di sistema, che scatta lei: l'app non tocca la fotocamera e
     non deve chiederla (il manifest non dichiara `CAMERA`, android.md A.3 p. 11).
   ⚠️ Aggiungere un permesso «per sicurezza» sarebbe peggio: Apple respinge le
   app che chiedono accessi che non usano (5.1.1).

Test: `testoDaFoto.test.js` (15) e `leggiWorkout.test.js` (32), visti fallire
togliendo il filtro e la deduzione.

### Solo da un'immagine (12/10/2026)
Richiesta del committente: «lascia solo da immagine; quando premo mi chiede
direttamente l'immagine». Il bottone del builder è **«Da un'immagine»** e apre
subito il selettore; l'incolla-testo come ingresso non c'è più.
- 🔴 Il campo file sta in **`CreateWorkout`**, non nel foglio: il foglio è
  pigro, e un tocco può aprire il selettore solo su un campo che esiste già nel
  momento del tocco. Il foglio si monta con `file` e lo legge subito.
- Il bottone compare solo se `fotoDisponibile()`: sul web non c'è più niente.
- Il testo letto resta **correggibile**, ma chiuso sotto «Correggi il testo
  letto»; «Aggiungi un'altra immagine» lo allunga (lavagna in due scatti).
- Su Android il selettore è la sola galleria (android.md A.3 punto 11).
- La fascia «Annulla» dice «Blocchi sostituiti dall'immagine».
- `FoglioDaTesto.jsx` ha tenuto il nome del file: cambiano titolo e
  `aria-label` del dialogo («Da un'immagine»).

Test: `CreaWorkoutDaTesto.test.jsx` (8) — il primo verifica che il tocco apra il
selettore senza foglio, visto fallire staccando il clic — e `FoglioDaTestoFoto.test.jsx` (4).

### La tastiera sopra «Correggi il testo letto» (12/10/2026)
Segnalato dal committente: aprendo il campo, la tastiera lo copriva tutto; con
la prima correzione il foglio saliva **troppo** e si tagliava. Diagnosticato sul
simulatore con le misure a schermo:
- su iOS la webview si rimpicciolisce **da sé** (874 → 546 punti,
  `Keyboard.resize: 'native'`): sollevare il foglio lì lo solleva due volte.
  🔴 `useTastieraCheCopre` (src/useTastiera.js) torna **sempre 0 su iOS**; la
  prima versione misurava anche lì, ma `keyboardDidShow` arriva con
  `innerHeight` ancora intero e la misura vedeva tutta la tastiera;
- su Android a tutta altezza la webview non si rimpicciolisce: lì il foglio si
  solleva di quanto la tastiera copre (`paddingBottom` sul velo, `maxHeight`);
- 🔴 nella webview l'evento `resize` **non arriva** quando la webview cambia
  misura, e `scrollIntoView({ behavior: 'smooth' })` si interrompe a metà. Il
  campo si porta in vista scrivendo `scrollTop` del foglio (`portaInVista`),
  ricontrollando ogni 100 ms per 1,2 s dopo la salita della tastiera.
- ⚠️ Riguarda solo questo foglio. Su Android le altre modali hanno lo stesso
  rischio (android.md A.4, «La tastiera»): la correzione globale sarebbe
  `Keyboard.resizeOnFullScreen: true` in capacitor.config.ts, da provare.
- Test: `src/__tests__/useTastieraCheCopre.test.jsx` (3), visti fallire. Lo
  scorrimento è verificato sul simulatore, non da un test (jsdom non ha layout).
  Android da provare sul telefono.

---

## 9-ai-categorie. «Genera con IA» su TUTTE le categorie (12/10/2026)

> 🔴 **REGOLA DEL COMMITTENTE, vale anche per il futuro**: «anche sulle altre
> tipologie di workout voglio vedere la creazione tramite IA, quindi anche su
> corsa e su tutte le prossime categorie che aggiungerò». **Ogni categoria
> nuova del builder nasce con «Genera con IA»**: non è un'aggiunta da fare
> dopo, è parte del lavoro di creare la categoria.

Fino ad allora la card viola c'era solo su Hyrox. Ora c'è su Hyrox, Corsa e Custom.

**Dove sta ogni categoria** (tre posti, tutti obbligatori):
1. `IA_PER_CATEGORIA` in `src/lib/iaCategorie.js` — la chiave della risposta,
   come l'allenamento va all'IA (`perIA`) e come torna (`prepara`), e le parole
   del foglio («ti scrivo le fasi», segnaposto, attesa, fascia «Annulla»).
2. `CATEGORIE_IA` in `supabase/functions/ai-workout/regole.ts` — le istruzioni
   per il modello e la chiave (`blocks`, `steps`, `testo`), uguale a quella del punto 1.
3. In `CreateWorkout.jsx`: `contenutoIA` e `impostaContenutoIA` (quale stato è
   l'allenamento di quella categoria) e `{cardIA}` / `{fasciaIA}` nel suo passo 2.

**Il guardiano**: `src/lib/__tests__/iaCategorie.test.js` legge gli `id` di
`CATEGORIE` dal sorgente di CreateWorkout e fallisce se uno manca nei punti 1-3;
`CreaWorkoutIA.test.jsx` («in OGNI categoria») apre il passo 2 di ogni categoria
e cerca la card. Visti fallire tutti e due (categoria finta «Nuoto», card tolta da Custom).

**Come funziona**
- Il client manda `{ prompt, categoria, attuali? }`; il server risponde
  `{ categoria, <chiave>: risultato, modifica }`. Senza `categoria` il server fa
  Hyrox, come prima (un'app vecchia continua a ricevere blocchi), e legge ancora
  `blocchiAttuali` oltre ad `attuali`.
- 🔴 **Una funzione non ancora pubblicata non manda `categoria` e scrive SEMPRE
  blocchi Hyrox.** Per le categorie diverse da Hyrox il client controlla che la
  risposta riporti la categoria giusta, altrimenti avvisa «non è ancora attiva
  sul server» e non tocca niente. Senza questo controllo dei blocchi EMOM
  finirebbero dentro una seduta di corsa.
- **Corsa**: l'IA scrive fasi nella forma di `RunningStepPicker`;
  `preparaFasiIA` (`src/lib/blocchiIA.js`) le normalizza con le stesse letture
  di «Da un testo scritto» (`quantoCorsa`, `passoCorsa`, ora esportate da
  `leggiWorkout.js`). Una durata non detta resta vuota, un recupero non detto
  resta vuoto: nessun numero inventato.
- **Custom**: l'IA scrive la descrizione per l'atleta (testo semplice, niente
  markdown). Con una descrizione già scritta è una modifica: la sostituisce, e
  «Annulla» la rimette com'era.
- Modifica, «Annulla» e risposta vuota funzionano come per i blocchi
  (9-ai-modifica): la fascia vive in `modificaIA`, che ora porta anche la `categoria`.
- ⚠️ **Serve il deploy di `ai-workout`** perché Corsa e Custom funzionino:
  `supabase functions deploy ai-workout`. La usa solo l'app (`main` chiama solo
  `send-reminders`), quindi non tocca la web app.

## IA: i nomi degli esercizi riportati a quelli del picker (13/10/2026)

L'IA scriveva a volte «Ski Erg» invece di «SkiErg». Il builder riconosce un
ergometro solo dal nome **esatto** (`isErgo`, `ERGOMETERS`), quindi l'esercizio
diventava un custom e in modifica mancavano metri e passo /500m.

- `preparaBlocchiIA` (`src/lib/blocchiIA.js`) passa ogni nome da `trovaEsercizio`
  di `leggiWorkout.js` (la stessa lettura di «Da un testo scritto»): «Ski Erg»,
  «Row Erg», «Air Bike», «wall balls» → nome del picker. Un nome che non si
  riconosce resta com'è.
- `ISTRUZIONI_HYROX` in `ai-workout/regole.ts` elenca ora i nomi esatti degli
  ergometri e delle stazioni, con i campi da usare (`meters`, `ergoPace`, calorie
  nelle note). Vale solo dopo il deploy della funzione.
- I workout già salvati con «Ski Erg» non si correggono da soli: vanno riaperti e
  sistemati a mano.

## 9-gym. La categoria Gym, la scheda da palestra (13/10/2026)

Richiesta del committente: una quarta categoria accanto a Hyrox, Corsa e Custom,
«con tutti i blocchi e gli esercizi classici di un allenamento in palestra,
ripetizioni, serie», con gli esercizi e i macchinari più famosi **generici, non
brandizzati**, dopo aver guardato le app che lo fanno già.

**Cosa fanno le altre app** (da cui vengono le scelte): le app per coach
(Trainerize, TrueCoach, Everfit) organizzano la scheda in sezioni —
riscaldamento, parte principale, defaticamento — con esercizi singoli o
raggruppati in superserie e circuiti, ognuno con serie, ripetizioni, carico,
recupero, cadenza e RPE/RIR; i diari da palestra (Hevy, Strong) aggiungono i
tipi di serie (riscaldamento, drop set, cedimento), la selezione di più
esercizi alla volta dalla libreria e il timer di recupero che parte quando si
spunta una serie.

**Le quattro decisioni del committente** (domande fatte in sessione):
1. colore **verde acqua `#14B8A6`** (`--color-gym`, `GYM` in `colori.js`, il
   test dei colori controlla che coincidano);
2. serie **semplice** («4 × 10 · 60 kg · rec 1:30») con il **dettaglio serie per
   serie** solo se richiesto;
3. **fasi + superserie**;
4. lato atleta **scheda + timer di recupero**, il completamento resta quello di sempre.

**Dove sta**
- `src/lib/eserciziGym.js` — la libreria (~170 voci, `MUSCOLI`, `misura` reps/tempo,
  `carico`), `trovaEsercizioGym` con i sinonimi inglesi («bench press» → «Panca
  piana con bilanciere»).
- `src/lib/gym.js` — il formato (commento in testa), riassunti, lettere A/B1/B2,
  durata stimata, nome automatico dai muscoli («Push Day», «Leg Day», «Full
  Body»), `preparaGymIA`, righe per PDF e storia. Test: `gym.test.js`.
- `src/components/CreaGym.jsx` — il builder (pigro, lo importa solo CreateWorkout).
- `src/components/SchedaGymUI.jsx` — la scheda nella pagina del workout (pigra).
- Il codice nel titolo è `GYM 60′ @7` (`codiceGym`, `SIGLA_GYM` è fra le sigle
  di `CODICE_IN_CODA`).

### ⚠️ Le cose da sapere prima di rimetterci mano
1. **Il tipo di gruppo non si salva**: 1 esercizio = singolo, 2 = superserie,
   3 = triserie, 4+ = circuito (`tipoGruppo`). Così non può contraddire i dati.
2. **Con `dettaglio` il campo `serie` è ignorato**: le serie sono le righe.
   Si legge sempre `serieDi`. Il dettaglio esiste solo sugli esercizi singoli:
   unire in superserie lo toglie (`sempliceDaDettaglio`).
3. **Le spunte delle serie non si salvano** (schema congelato, niente
   localStorage): servono durante la seduta. Il timer conta sull'ora, non sui tick.
4. **Il timer guidato non c'è** per Gym (`haTimerGuidato`): ha il suo recupero.
5. **Il righello** usa la scala nuova `serie` (1–12) di `scaleMisura.js`; le
   ripetizioni a intervallo («8-12») passano dal `secondo` di `FoglioMisure`.
6. **IA**: `IA_PER_CATEGORIA.Gym` (chiave `gym`) e `CATEGORIE_IA.Gym` in
   `ai-workout/regole.ts`. 🔴 **Serve il deploy di `ai-workout`** perché funzioni
   (`supabase functions deploy ai-workout`); prima l'app avvisa «non è ancora
   attiva sul server» e non tocca niente.
7. 🔴 **L'app sullo Store (1.1.0) non conosce Gym**: un workout Gym assegnato a
   un atleta che ha ancora quella versione gli appare come un Hyrox vuoto. Va
   tenuto presente finché il prossimo aggiornamento non è pubblicato.
8. **Non fatto**: la TV (`TVDashboard`) non mostra i gruppi Gym; il desktop
   usa lo stesso builder del telefono nella colonna di sinistra.

## «Cambia esercizio» su un esercizio già messo (14/10/2026)

Richiesta del committente: dopo «Genera con IA» capita un movimento sbagliato,
e cambiarlo voleva dire eliminarlo, rifarlo e trascinarlo al suo posto.

- **Hyrox** (`ExercisePicker`): aprendo un esercizio esistente c'è in cima la
  riga «Cambia esercizio» (`tornaAllaLista`). Torna alla lista **svuotando la
  ricerca** — prima la freccia indietro c'era già, ma la ricerca conteneva il
  nome dell'esercizio e la lista mostrava solo quello, quindi la strada non si
  vedeva. Numeri, note, id e posizione restano; `handleConfirm` tiene solo i
  campi che il nuovo esercizio usa. Dopo il cambio la riga dice «era …».
- **Gym** (`FoglioEsercizioGym`): la riga «Cambia esercizio» apre `PickerGym`
  con `unico` (il primo tocco sceglie e chiude, con la chiusura animata passata
  da `onPronto` del `Foglio`). Il nome si cambia con `cambiaEsercizioGym` di
  `src/lib/gym.js`: stessa misura → tiene tutto; da ripetizioni a tempo (o
  viceversa) riparte dai valori di un esercizio nuovo e toglie reps/durata,
  serie per serie, RIR e cadenza — «10» ripetizioni non sono 10 secondi.
- **Corsa** (`RunningStepPicker`): le pillole del tipo c'erano già anche in
  modifica, ma passando fra fase singola e «Ripetute» i numeri ripartivano dai
  valori di partenza. Ora `cambiaTipo` porta il tratto singolo nel tratto
  veloce (durata/distanza, passo, intensità) e viceversa; fra due fasi singole
  (Corsa → Riscaldamento) i numeri restano già da soli. In modifica, sopra le
  pillole, c'è «Cambia tipo di fase» con «era …».
- **Blocchi Hyrox** (`HyroxBlock`): nel blocco aperto, in cima, «Cambia tipo
  di blocco» riapre `BlockPickerModal` con `blocco` (tipo attuale segnato). Il
  cambio passa da `cambiaTipoBlocco` di `src/lib/cambiaTipoBlocco.js`: stesso
  id, esercizi e note restano; dei parametri restano solo quelli che il tipo
  nuovo legge (la tabella `PARAMETRI` = le chiavi di `parametriDelBlocco`, da
  tenere allineate), gli altri si tolgono e il builder ripiega. Uscendo da un
  EMOM si toglie `intervals` agli esercizi. **WarmUp e Rest** non hanno
  esercizi nel builder: portandoci un blocco, gli esercizi diventano il testo
  del blocco (`rigaDaEsercizio`, «Wall Balls · 20 reps · 6 kg — nota»), e
  tornando a un blocco di lavoro il testo torna esercizi (`esercizioDaRiga`,
  col lettore di «Da un testo scritto»; una riga non riconosciuta diventa un
  esercizio col suo testo come nome). 🔴 Le righe si separano con «; », non
  con un a-capo: le note del blocco sono un `<input>`, che gli a-capo li
  toglie. (Fino al primo giro dello stesso giorno era vietato: WarmUp e Rest
  spenti con «Ha degli esercizi».) ⚠️ Un blocco portato a **Interval** tiene reps e
  metri degli esercizi: la durata (`exTime`) si mette aprendo l'esercizio.
- **Fasi Gym**: nel foglio dell'esercizio e in quello della superserie c'è
  «Fase» (Riscaldamento / Principale / Defaticamento, `SceltaFase`). Cambia
  fase con `spostaInFase` di `src/lib/gym.js`: il gruppo resta com'è (serie,
  recupero, esercizi — niente valori di partenza del riscaldamento) e va **in
  fondo** alla fase nuova, perché l'ordine dentro una fase è l'ordine
  dell'elenco. Una superserie si sposta intera.
- Test: `CreaWorkoutBuilder.test.jsx`, `Gym.test.jsx`, `gym.test.js`,
  `cambiaTipoBlocco.test.js`, visti fallire rompendo il codice.

## L'incremento a ogni giro di For Time e AMRAP (15/10/2026)

Richiesta del committente: un For Time **a time cap** (o un AMRAP) in cui si fa
il giro — 200 m di ski, 20 wall ball, 200 m di row, 20 affondi — e, finito, si
riparte dal primo esercizio con le quantità aumentate (300, 30…), fino allo
scadere. L'aumento cambia ogni volta (non sempre +100 m e +10).

🔴 **Non è un numero di giri.** La prima versione dello stesso giorno («Scala
crescente») chiedeva quanti giri e li scriveva tutti per intero: il committente
l'ha rifiutata — «non è una questione di giri, il for time è un time cap». I
giri sono quanti l'atleta riesce a farne nel tempo. Non rimettere un campo
«Giri» né liste espanse.

### Il For Time è SOLO a time cap (secondo giro dello stesso giorno)
Il committente: «il for time di base non devi scegliere i round, dici soltanto
quanti minuti bisogna lavorare». Da allora:
- `parametriDelBlocco` dà al For Time solo **«Time cap»** (`params.timecap`);
  un blocco nuovo nasce con 20:00 e **senza `rounds`**.
- `durataBlocco` = il time cap; il timer fa una fase sola a scendere.
- I For Time **vecchi** (solo `rounds`) restano leggibili: sottotitolo «3
  round», stima a forfait, cronometro. Nel builder la pillola dice «—» finché
  non si sceglie un time cap.
- `cambiaTipoBlocco`: AMRAP → For Time porta la durata nel time cap, For Time →
  AMRAP il contrario; da qualunque altro tipo il For Time prende 20:00.
- L'IA: «FOR TIME: è sempre a TEMPO», mai `rounds`; `preparaBlocchiIA` toglie
  `rounds` e mette un time cap. ✅ `ai-workout` versione 29.
- ⚠️ Le app 1.2.0/1.2.1 non leggono `timecap`: un For Time nuovo lì appare «1
  round» stimato a 15′. Non si rimedia senza scrivere `rounds`, che è proprio
  quello che il committente non vuole.
- ⚠️ `leggiWorkout` («Da un testo scritto») scrive ancora il For Time a round
  e il time cap nelle note: da allineare se il committente lo usa.

### Cosa c'è ora
- Nel blocco **For Time** o **AMRAP** aperto, sotto «Cambia tipo di blocco»,
  l'interruttore **«Incremento a ogni giro»**. Il tempo è quello del blocco.
- La lista è **il primo giro**. Sotto ogni esercizio c'è una pillola: «+
  Aumento a ogni giro» (tratteggiata) o «+10 ogni giro» (gialla). Toccandola si
  apre `FoglioAumento`, una carta con «Uguale», **+5/+10/+20** ripetizioni o
  **+50/+100/+200 m** e − / + per il resto (anche negativi, mai sotto 1). Il
  numero si può anche **scrivere a mano** (`CampoAumento`: «35», «+150», «-6»;
  lettere rifiutate; il testo è libero solo mentre si scrive, fuori segue il
  valore così i bottoni lo aggiornano; tastiera numerica, che su iPhone non ha
  il meno: per scendere c'è il −). La
  prima versione aveva la scelta solo dentro il foglio dell'esercizio, sotto il
  righello: il committente non l'ha vista. La card c'è ancora anche lì
  (`CardAumento`). Senza un numero da far salire («Max») la card lo dice e
  «Fatto» è spento.
- Sotto la lista **«Come sale»** (`AnteprimaIncremento`): i primi tre giri
  scritti per intero, «…e così via fino allo scadere del time cap (20:00)».
- Scheda e PDF: l'aumento accanto alle misure e una riga «Finito il giro,
  riparti dal primo esercizio…»; sottotitolo «time cap 20:00 · con incremento».
  TV: l'aumento accanto alle misure. Timer: For Time = **una fase sola** lunga il
  time cap (a scendere, non cronometro); AMRAP come prima. Il task elenca il
  primo giro con gli aumenti.
- `durataBlocco`: un For Time con `params.timecap` dura il suo time cap (prima
  era sempre il forfait da 15′ a giro). Vale per ogni For Time con time cap.

### Il dato
`block.incremento = true`, `exercise.aumento = "10"` (nell'unità del campo che
sale: metri se `meters` è «200m», sennò ripetizioni), nel For Time
`params.timecap`. Logica in `src/lib/incremento.js`. Niente migrazioni (jsonb).
⚠️ Le versioni 1.2.0 e 1.2.1 vedono il primo giro senza aumenti e il For Time
come «1 round»: il campo nuovo lo ignorano.

### ⚠️ Da sapere prima di rimetterci mano
1. `cambiaTipoBlocco` tiene l'incremento fra For Time e AMRAP; verso gli altri
   tipi toglie spia e aumenti.
2. Spegnere toglie **solo la spia**: aumenti e time cap restano sugli
   esercizi, così chi spegne per sbaglio e riaccende li ritrova (richiesta del
   committente). Spenti non contano: tutto li legge passando da `haIncremento`.
   Anche modificando un esercizio a incremento spento l'aumento resta
   (`handleConfirm` lo ricopia da `initialExercise`).
3. **IA** (`regole.ts`, «INCREMENTO A OGNI GIRO»): solo il primo giro, con
   `incremento: true` e `aumento`. `preparaBlocchiIA` scarta spia e aumenti
   fuori da For Time/AMRAP. ✅ Ripubblicata il 15/10/2026: versione 29 (la 27
   aveva le regole dei giri, la 28 il For Time ancora a round).
4. Non c'è in «Da un testo scritto» (`leggiWorkout`).
5. `reportAtleta.movimentiDi` conta il primo giro: non sa quanti giri sono
   stati fatti, e non lo può sapere.

Test: `incremento.test.js` (16), due test del builder in più («chiede solo il
time cap», «l aumento si sceglie dalla riga»: mutazioni prese, 2 rossi
ciascuna), più in `cambiaTipoBlocco`, `blocchiIA`,
`timerSequence`, `rigaBlocco`, `stimaWorkout` e `CreaWorkoutBuilder.test.jsx`
(«l incremento a ogni giro»). Mutazioni prese: aumento ignorato (3 rossi), For
Time senza round a 1 (1), time cap ignorato nella durata (1 — il primo test usava
15:00, uguale al forfait, e passava lo stesso: ora 25:00).

### Le distanze rapide dello SkiErg (15/10/2026)
Richiesta del committente: distanze pari. `STANDARD_ESERCIZIO` in
`CreateWorkout.jsx` dà allo SkiErg **200 · 400 · 500 · 1000 m** sotto il
righello, al posto dei valori più usati dallo storico (o del ripiego 100 /
250 / 500 / 1000). Gli altri ergometri non cambiano. Test: «lo SkiErg propone
distanze pari» (mutazione presa).

## Ripetute a tratti liberi e pausa «Da fermo» (26/10/2026)

Richiesta del committente: «3 × (4′ Z3 + 3′ Z2)» non si poteva scrivere, perché una
ripetuta era per forza tratto veloce + recupero; e la pausa da fermi non esisteva.

- **«Da fermo»** è una zona in più di `RUN_PACE_OPTIONS`: compare nel Passo di ogni fase e
  di ogni tratto. `passoCorsa` la riconosce nel testo («da fermo», «fermi», «standing»).
- **Le ripetute sono una lista di tratti** (`parti`, fino a `MAX_PARTI` = 6), ognuno con il
  suo tipo Corsa/Recupero, durata, passo e intensità. Nel foglio: «Volte», poi un blocco per
  tratto con il cestino, poi «Aggiungi tratto».
- 🔴 **Si leggono solo con `partiRipetuta`** (`src/lib/ripetute.js`): capisce anche il
  formato di prima. Lo usano riga del builder, scheda, PDF, story, TV, anteprima in
  AthleteDetail, `durataWorkout`, `rpeAtteso`, `riepilogoCorsa`, recap, ricerca.
- 🔴 **Chi salva scrive ANCHE `run*`/`rec*`** (`campiVecchiRipetuta`), dalle prime due parti
  per posizione: le app 1.2.0/1.2.1 leggono solo quelli. Una terza parte lì non si vede.
- `nomeCasuale` e `codiceWorkout` leggono ancora `runDuration`/`runIntensity`, cioè il primo
  tratto: è voluto, è il tratto che dà il nome alla seduta.
- **IA**: `regole.ts` chiede `parti` in più dei campi di prima (le app vecchie restano
  servite), `preparaFasiIA` le usa se ci sono. ✅ `ai-workout` pubblicata il 26/10/2026 (versione 31).

## Modelli di blocco (16/10/2026)

Il coach salva **un** blocco Hyrox, **una** fase Corsa o **un** gruppo Gym come modello e lo
rimette in un altro workout con un tocco. Spec: `docs/superpowers/specs/2026-10-16-modelli-blocco-design.md`,
piano: `docs/superpowers/plans/2026-10-16-modelli-blocco.md`. Costruito il 26/10/2026.

### Perché è fatto così
- **Nel database** (`modelli_blocco`, quinta eccezione al congelamento): si vedono da telefono e
  da computer. Scartati i «workout nascosti» con un segno nelle `sections`: `workouts` è letto in
  decine di punti (archivio, calendario, TV, report, previsione, export) e il primo che non
  imparava a ignorarli avrebbe mostrato un modello come un allenamento vero.
- **Ogni coach vede solo i suoi**, admin compresi: una policy sola, uguale in `USING` e
  `WITH CHECK`. Un admin con i modelli di tutti se li troverebbe mescolati nel foglio «Aggiungi».
- **Il builder stesso fa da editor** («modalità modello», `/create?modello=…`). Un editor proprio
  dentro `/modelli` sarebbe stato un secondo builder da tenere allineato.
- **Niente «Genera con IA» né «Da un'immagine» nella modalità modello**: producono un workout
  intero, cioè più blocchi, e un modello è un blocco solo.
- **Senza rete non si salva** (`MESSAGGIO_SENZA_RETE`): niente coda offline, un modello non è un
  dato dell'atleta.

### Dove sta ogni pezzo
- `src/lib/modelliBlocco.js` — la logica pura: `contenutoDaBlocco` (la copia da salvare, senza
  nessun `id` e per Gym senza `fase`), `bloccoDaModello` (il blocco per il builder, `id` nuovi a
  ogni livello e la fase del picker), `nomeProposto`, `anteprimaModello`, `modelloValido`,
  `CATEGORIE_MODELLI`, `MAX_NOME`.
- `src/lib/modelliBloccoDb.js` — `elencoModelli`, `leggiModello`, `salvaModello`,
  `aggiornaModello`, `eliminaModello`. Tutto ciò che si legge passa da `modelloValido`.
  `src/useModelliBlocco.js` — l'elenco di una categoria per i fogli.
- `src/components/FoglioModello.jsx` — `FoglioSalvaModello` («Salva come modello» dai blocchi)
  e `FoglioRinomina`.
- `src/components/ModelliUI.jsx` — `CardModello`, `SezioneModelli` («I miei modelli» nei fogli
  di aggiunta), `MenuModello`, `CampoNomeModello`.
- `src/pages/Modelli.jsx` — la pagina `/modelli`, solo staff.
- Nel builder: `bloccoSalvaModello`/`faseSalvaModello` (le callback stabili per i blocchi in
  `memo`), `onModello` di `BlockPickerModal`, `RunningStepPicker` e `PickerGym`,
  `salvaQuestoModello`, `bloccoModello`, `nomeDelModello`. In `CreaGym` la prop `modello`.

### Le trappole
- 🔴 **Gli `id`.** Un modello salvato con gli `id` del workout, inserito due volte, darebbe due
  blocchi con lo stesso `id`: il builder li tratta come uno (apertura, riordino, modifica).
  `contenutoDaBlocco` li toglie tutti, `bloccoDaModello` ne dà di nuovi a ogni livello.
- 🔴 **La bozza del workout.** In modalità modello `fleofit_workout_draft` non si legge, non si
  scrive e non si cancella: ogni effetto e ogni uscita del builder che la tocca ha una guardia
  `modello`. Senza, aprire un modello cancellava il workout lasciato a metà (o lo riproponeva
  dentro il modello). Il test è «la bozza del workout resta identica» in `CreaModello.test.jsx`.
- 🔴 **Stessa rotta, due builder.** `/create` e `/create?modello=…` montano lo stesso
  componente: passando dall'uno all'altro (la tab «Workout» dal builder di un modello) React lo
  teneva montato, con il blocco del modello in pagina come un workout, e il primo ritocco
  sovrascriveva la bozza. Il `CreateWorkout` esportato ora è un guscio che monta `Costruttore`
  con una `key` sul parametro `modello`: a ogni cambio la schermata riparte da capo. Trovato
  nella revisione finale del 26/10 (test «…la schermata riparte, e la bozza non si tocca»).
- **La fase Gym** non sta nel modello: la decide il punto da cui lo si inserisce (`picker.fase`).
  Dentro una superserie e nel «Cambia» la sezione dei modelli non c'è.
- **Un blocco solo.** Nella modalità modello spariscono anche Duplica, «Salva come modello» e
  «Scollega» (Gym): ognuno creerebbe un secondo blocco.
- **I fogli che servono ad altro restano identici** senza modelli, con la lettura in errore, in
  «Cambia tipo di blocco» e nella modifica di una fase: `SezioneModelli` torna `null`.
- **Un blocco da modello non chiede i numeri** (9-blocco-confermato): li ha già.

### Pesi (26/10/2026)
`CreateWorkout` 186,8 → 190,2 KB. `CreaWorkoutUI` 18,4 → 12,4 KB: Vite ha messo `previsione`
in un chunk suo (6,6 KB), che `WorkoutDetail` scarica come prima. `ModelliUI` 11 KB e
`FoglioMessaggio` 3,7 KB sono chunk nuovi, caricati da builder, `CreaGym` e `/modelli`. La
pagina `Modelli` 5,2 KB, pigra. `index` 587,8 → 588,1 KB.

### Prove
Test: `ModelliSalva.test.jsx`, `ModelliInserisci.test.jsx`, `Modelli.test.jsx`,
`CreaModello.test.jsx`, più `modelliBlocco.test.js` e `modelliBloccoDb.test.js`. Ognuno visto
fallire rompendo il codice che copre. Provato nell'ambiente di prova su schermo da telefono
(salvataggio da un blocco, inserimento dal foglio Hyrox, pagina, modifica di un modello Hyrox).
⏳ **Da provare sul telefono** (iPhone e Android): i tre fogli, la pagina, il tasto indietro di
Android su menu e fogli nuovi.

