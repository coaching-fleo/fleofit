# Movimento, apertura, dialoghi, tab bar e aptica

> Spostato da `CLAUDE.md` il 07/10/2026, **senza cambiare il testo**. I rimandi
> «§9-…» puntano a sezioni che ora stanno in altri file di questa cartella:
> si trovano con `grep -rn '^## 9-<nome>' docs/memoria`. L'indice è in `CLAUDE.md`.

## 9-quaterdecies. La tab bar dell'artboard 2b (28/08/2026)

### 🔴 I due artboard si contraddicono, e il navbar giusto è quello di 2b
`Home Coach.dc.html` (opzione **2b**) disegna una **capsula galleggiante**.
`Scheda Atleta.dc.html` (5b e 5c) disegna ancora la **barra piena** attaccata al
fondo, perché quell'artboard riusa il navbar precedente come sfondo di scena.
**Vale 2b**: è quello che il committente ha indicato, ed è l'unico dei due
disegnato *come* navbar invece che *sotto* una pagina.

⚠️ Chi apre `Scheda Atleta.dc.html` e confronta il codice con quel navbar
conclude che «corrisponde» ed è già successo: è il motivo per cui questa
sezione dice quale dei due comanda.

| | prima (fino al 28/08) | ora, artboard 2b |
|---|---|---|
| forma | barra piena a `bottom-0`, tutta larghezza | capsula `rounded-full`, `10px 12px 16px` d'aria intorno |
| fondo | `#0f0f11/70`, blur | `rgba(30,30,34,.88)`, blur **22** + saturate **170%**, ombra proiettata |
| voce attiva | pillola dietro icona **ed** etichetta | **cerchio** da 36px dietro la **sola** icona |
| «Workout» | icona `+` | **manubrio** |
| altezza | 64px + safe area | **99px** + safe area |

### 🔴 L'altezza della navbar era in SETTE punti scritti a mano
Ed è la vera conseguenza del cambio di forma, non la forma stessa. Erano:
`pb-16` in `App.jsx`, `pb-[calc(6rem+…)]` in `Home`, `Calendar`, `Athletes`,
`WorkoutsArchive`, `Settings`, e `bottom-[calc(4rem+…)]` in `BarraAzioni`.
Hanno coinciso **per caso** finché la barra è stata alta 4rem. Passando a 99px
sarebbero servite sette modifiche coordinate, e la prima dimenticata avrebbe
nascosto del contenuto sotto la barra **senza dare nessun errore a schermo** —
il difetto che si nota solo quando un utente non riesce a premere l'ultimo
bottone di una pagina.

Ora c'è `--altezza-navbar` in `src/index.css`, più `--fondo-pagina` che le
aggiunge il respiro. **Chi cambia la forma della navbar cambia quel numero, e
basta.** Le tre pagine con la barra fissa (`CreateWorkout`, `WorkoutDetail`,
`AthleteDetail`) usano `pb-[var(--altezza-navbar)]`, le altre cinque
`pb-[var(--fondo-pagina)]`.

⚠️ **Il numero è misurato, non calcolato.** Il primo tentativo diceva 94px
contando l'etichetta come 13px invece della sua riga di testo; misurata, la
barra è 98,75px. Si rimisura con la navbar a schermo:
```js
document.querySelector('nav').parentElement.getBoundingClientRect().height
```

### ⚠️ Tre dettagli che non sono rifinitura
1. **`pointer-events-none` sul contenitore, `auto` sulla capsula.** Il
   contenitore è largo quanto lo schermo, la capsula no: senza, i pixel ai lati
   intercetterebbero i tocchi diretti alla pagina sotto.
2. **Il cerchio dietro l'icona esiste sempre, anche spento.** Se comparisse solo
   sull'attiva, le voci si sposterebbero di 36px a ogni cambio di scheda.
3. **Il manubrio è un SVG locale, non `Dumbbell` di lucide.** Quello di lucide è
   diagonale con i dischi esagonali, e accanto a `Home`, `Calendar` e `Users` —
   tutte forme diritte e sottili — è l'unica icona che non sta sull'orizzontale.
   È la stessa eccezione già fatta per `InstagramIcon`: lucide è la convenzione,
   non un vincolo.

### Cosa NON è stato implementato, e perché
Il **badge numerico** sulla voce «Atleti» (nell'artboard: un `3` giallo). Il
numero non esiste: `Navbar` è renderizzata da `App.jsx` fuori da ogni pagina e
non ha accesso ai dati, e l'unico candidato sensato — gli atleti che richiedono
attenzione — richiederebbe una query su **ogni** pagina dell'app per una
decorazione. Metterci un numero che non significa niente è peggio che non
metterlo: è la stessa regola del `rpeAtteso` che torna `null` invece di 5.
Voce in BACKLOG.

---

## 9-septtricies. Il linguaggio di movimento (21-22/09/2026)

Richiesta del committente: «ho visto questo video e mi piace molto questo stile di
animazioni molto clean, voglio riproporlo sulla mia app».

### 🔴 IL VIDEO NON ERA GUARDABILE, ED È LA COSA PIÙ IMPORTANTE DI QUESTA SEZIONE
Un `.mp4` non si legge. La prima stesura del lavoro è stata **quattro candidate
inventate a occhio**, e il committente le ha bocciate in una riga: «non sono
abbastanza smooth». Avevano ragione a cadere — erano gusti, non misure.

La strada giusta è: `ffmpeg` estrae i fotogrammi **alla frequenza nativa**, si
montano in contact sheet, e si contano. Tutti i numeri di questa sezione vengono
da lì, e nessuno è stato scelto. ⚠️ Vale per qualunque riferimento visivo futuro:
**si misura, non si assomiglia**. Gli strumenti ci sono già sulla macchina
(`ffmpeg`, `ffprobe`, `yt-dlp`), e lo stesso metodo serve a verificare il
risultato — `xcrun simctl io <udid> recordVideo` registra il simulatore, e
`signalstats` legge il colore di un rettangolo fotogramma per fotogramma.

### Le quattro animazioni, con le misure

| | cos'è | misurato |
|---|---|---|
| **la cascata** | i figli di un contenitore entrano uno dopo l'altro | 20px di salita, 220ms, 65ms di scarto |
| **il numero che sale** | da 0 al valore, rallentando | 1,27s; residuo a un quinto ogni 0,2s |
| **la CTA che si contrae** | il bottone diventa una pillola con tre puntini | 570ms, etichetta via nei primi 150 |
| **la tenda curva** | un foglio sale con un bordo che cambia forma | 400ms in entrata, 150 in uscita |

⚠️ **La tenda NON è stata implementata**, ed è l'unica delle quattro. Nel video
legge perché è **nero su crema**: un contrasto totale. In FLEOFIT tutto è
`#0B0B0B` su `#1e1e1e`, e una curva fra quei due colori è invisibile. Rimetterla
in programma richiede prima di risolvere quel problema, non di scrivere il
keyframe.

### 1 · LA CASCATA — `.cascata`, `.cascata-voce`, `--cascata-*`

Nove schermate: Home atleta, Home coach, archivio, rubrica, calendario, i due
report, scheda workout, impostazioni.

- **I quattro parametri stanno su `:root`** (`--cascata-salita`, `--durata`,
  `--scarto`, `--curva`). Ritoccare il ritmo di tutta l'app è una riga.
  ⚠️ I valori spediti (340ms / 75ms) sono **più lenti della misura** (220/65):
  allungati su richiesta del committente dopo averli provati sul dispositivo.
- **Il ritardo lo scrive `nth-child`**, quindi un contenitore diventa una cascata
  aggiungendo UNA classe e i figli non sanno di esserci dentro.
- **Il tetto a 12 voci non è una semplificazione**: l'archivio ha 171 workout, e
  senza tetto l'ultima riga entrerebbe dopo più di sette secondi — molto dopo che
  il dito ha già cominciato a scorrere.

🔴 **LA CURVA NON È QUELLA DEL RESTO DEL PROGETTO, ED È DELIBERATO.** Altrove si
usa `cubic-bezier(.16,1,.3,1)`, che è un ease-out **esponenziale**: copre il 90%
della distanza nel primo quarto del tempo e poi striscia. Su una transizione di
pagina è giusto — deve togliersi di mezzo. Su un elemento che deve sembrare
*morbido* legge come uno scatto seguito da un'attesa, ed è esattamente ciò che il
committente ha chiesto di togliere. La cascata usa un ease-out **cubico**
(`.33,1,.68,1`). ⚠️ **Allungare la durata senza cambiare la curva non rende
l'entrata più morbida — la rende più lenta a non muoversi.**

🔴 **UNA TESTATA `STICKY` È CORNICE E NON ENTRA.** È la regola che decide ogni
pagina futura. Nel riferimento il contenitore sta fermo e si muovono gli
elementi; una testata appiccicata è la cornice della pagina, e nell'archivio e
nella rubrica è anche **l'unico comando della schermata** (ricerca e filtri):
farla entrare in ritardo vorrebbe dire ritardare i comandi. Una testata che
scorre via con la pagina è invece contenuto, e la sua voce ce l'ha
(`.cascata-voce`, con `--cascata-da` sul contenitore per lasciarle il posto 0).

| entra | non entra |
|---|---|
| Home (atleta e coach), calendario, impostazioni, scheda | archivio, rubrica, report settimanale, report atleta |

⚠️ **`page-transition` è uscito dalle nove.** La pagina che sale *mentre* i figli
salgono è movimento doppio. Resta sulle schermate fuori dal rework.

⚠️ **`src/lib/cascata.js` serve a UN caso solo: le liste annidate.** Nell'archivio
le righe stanno dentro i mesi e nella rubrica dentro due sezioni, quindi
`nth-child` riparte da capo e agosto entrerebbe insieme a settembre. Lì l'indice
si passa inline (`voce(n++)`), che è l'unica ragione per cui l'escape esiste.
🔴 `MASSIMO_CASCATA` **deve coincidere** con `nth-child(n+12)` in `src/index.css`:
una regola CSS da JavaScript non è leggibile, ed è la stessa situazione dei colori
di marchio (§6).

### 2 · I NUMERI CHE SALGONO — `src/useNumeroCheSale.js`

Anello della settimana, serie, volume, arretrato dei feedback, volume e carico del
report, le quattro celle del riepilogo della scheda.

🔴 **La curva è esponenziale, e NON è quella della cascata.** Misurando il residuo
(3916 → 834 → 182 → 22 a intervalli regolari) ciò che manca si riduce a un quinto
ogni 0,2 secondi. È la ragione per cui il numero è leggibile quasi subito e poi si
assesta: un ease-out cubico passerebbe metà del tempo su cifre che cambiano ancora
troppo per essere lette.

🔴 **L'ULTIMO PASSO È ESATTO, NON CALCOLATO.** `2^(-10)` vale 1/1024, quindi a fine
corsa la formula si ferma allo 0,9990: un carico di 22.000 resterebbe a **21.978
per sempre**, e nessun errore lo segnalerebbe. È la riga più importante del file, e
c'è un test che cade solo su quella.

🔴 **IL BUILDER NON CONTA**, ed è una decisione. `RiepilogoWorkout` serve due
pagine: la scheda, dove i numeri arrivano una volta all'apertura, e il builder,
dove cambiano a **ogni blocco che si tocca**. Un conteggio da 1,3s a ogni modifica
vorrebbe dire un numero sempre in movimento e mai leggibile, proprio mentre il
coach lo usa per dosare la seduta. Prop `anima`, **falsa di default**, e due test
che fissano la scelta dai due lati. *Il conteggio va dove un numero ARRIVA, non
dove lo si sta scrivendo.*

⚠️ **Gli `aria-label` portano sempre il valore vero.** Chi usa VoiceOver
sull'anello sente «3 allenamenti completati su 5», mai un conteggio in corso.

⚠️ `null` resta `null`: una cella senza dato non conta fino a zero. È la regola di
`rpeAtteso` (§9-undecies punto 3), alla sua ennesima comparsa.

🔴 **`src/test/setup.js` DICHIARA ORA `prefers-reduced-motion: reduce`** per tutta
la suite, e chiunque scriva test su un numero deve saperlo. Senza, un
`getByText('516')` subito dopo il render troverebbe `0`, e l'esito dipenderebbe da
quanti fotogrammi jsdom fa passare prima dell'asserzione — cioè test che falliscono
a caso su una macchina lenta. Un test che voglia vedere il movimento lo accende a
mano, come `LoginApple` fa con il ramo nativo.

### 3 · LA CTA CHE SI CONTRAE

Da tutta larghezza a una pillola da 86px in 570ms, **da entrambi i lati verso il
centro**, con tre puntini dentro. Verificato nel browser: 361 → 277 → 182 → 126 →
97 → 86, con il centro fermo al centro dello schermo.

Acceso in **due punti soli**, dove l'attesa è vera: «Salva workout» e «Fatto! 🎉»
della modale RPE. ⚠️ `attesa` è **falsa di default**: le altre sei `CtaPrimaria`
aprono un modale, e contrarsi per 570ms lì vorrebbe dire solo ritardarlo.

🔴 **`max-width` NON INTERPOLA DA `none`.** Il default è `none`, e la transizione
semplicemente non avviene: il bottone **saltava** a 86px. Nessun errore, invisibile
in jsdom, trovato misurando il rettangolo a 150ms dall'inizio — dove la larghezza
era già quella finale. Il valore di partenza lo dichiara il chiamante
(`max-w-[100vw]`), e c'è un test che cade se sparisce.

⚠️ Il raggio arriva a **26px**, non a 9999: metà dell'altezza è già una pillola
perfetta, mentre interpolare fino a 9999 rende il bordo tondo nei primi fotogrammi
— il raggio finirebbe prima della larghezza e la contrazione si leggerebbe come due
animazioni scollegate.

⚠️ **`Puntini` sta in un file suo**, non in `CreaWorkoutUI`: lo usa `RpeModal`, che
è montata da Home, WorkoutDetail e AthleteDetail, e importarlo da lì farebbe
scaricare 24 KB di builder dentro la Home. Stesso danno del fascio luminoso
(§9-duetricies) e di `jspdf` in testa alla scheda (§9-noviesdecies).

🔴 **Perché non basta spegnere il bottone**: un bottone disabilitato accanto a
un'attesa si legge come «non ha funzionato», ed è la lezione del foglio IA
(§9-quindecies) — lì la CTA spenta faceva premere di nuovo il microfono, cioè
buttare la registrazione appena spedita. Qui il gesto sbagliato sarebbe premere
«Salva» una seconda volta, o accodare due volte lo stesso completamento.

### 4 · IL PASSO CHE ENTRA

Il cambio di passo del builder era **netto**: il passo 1 spariva e il 2 compariva
nello stesso fotogramma. Ora entra da destra in 380ms. ⚠️ **Orizzontale, non dal
basso**: è un passaggio dentro un flusso, non un elemento che arriva in una lista,
e usare la direzione della cascata confonderebbe le due cose.

🔴 **Entra e basta: non c'è un'uscita, ed è una rinuncia dichiarata.** Nel
riferimento il passo che esce scivola via *mentre* quello nuovo arriva, ma là le
due schermate coesistono per qualche fotogramma. Qui `{step === 1 && …}` smonta il
vecchio nell'istante in cui il nuovo monta: per farli convivere servirebbero due
alberi in pagina e una macchina a stati, su `CreateWorkout` — il file più grande del
progetto e quello dove si perde il lavoro non salvato.

### 🔴 L'ALONE: una sfocatura sotto un'animazione di opacità CAMBIA COLORE

Segnalato dal committente («al termine dell'animazione il gradiente cambia
leggermente colore») e misurato registrando il simulatore:

| zona | fine animazione | +17ms | scarto |
|---|---|---|---|
| **sopra l'alone sfocato** | Y 48,08 · V 119,07 | Y 52,31 · V 115,56 | **+4,2 · −3,5** |
| gradiente della card | Y 44,25 | Y 44,30 | 0,05 |

**Non era il gradiente della card**, e non si correggeva lì. WebKit promuove
l'elemento animato su un layer GPU e rende la `filter: blur()` con
l'approssimazione della GPU; finita l'animazione il layer viene liberato e la
stessa sfocatura è ridipinta dalla CPU. Due risultati diversi per lo stesso pixel,
e il salto avviene **dopo** che il movimento è già finito.

**La regola che ne esce: mai una sfocatura dentro un elemento che anima l'opacità.**
Al suo posto `.alone`, un `radial-gradient` — pittura pura, nessun filtro, nessun
layer, reso identico dentro e fuori da una composizione, e costa meno di una
sfocatura da 40px ridisegnata a ogni entrata.

⚠️ L'alternativa scartata era inchiodare l'elemento su un layer permanente
(`will-change: filter`): rende il colore costante, ma **costante sulla versione
GPU**, cioè quella più scura — l'alone perderebbe l'8% di luminosità. Fra due
colori costanti si sceglie quello giusto.

⚠️ Le misure di `.alone` sono quelle del disco **più** lo spegnimento della
sfocatura (un disco da 240px con `blur(40px)` si spegne intorno ai 400): un box
delle dimensioni originali taglierebbe l'alone di netto.

Sei aloni convertiti — tutti quelli che stanno sotto una cascata. Gli altri erano
`backdrop-blur` su testate che **non** animano, che è un'altra cosa e non ha il
difetto.

### Le trappole di questa sessione, e quante volte sono tornate

1. **`animate-in` genera zero CSS** (tw-animate-css non è installato). Quarta
   comparsa, dopo §9-duodecies, §9-quindecies e §9-duodetricies. Tutti i keyframe
   di questa sezione sono veri.
2. **Due animazioni sullo stesso nodo non si sommano**: hanno la stessa
   specificità e a decidere è l'ordine nel foglio di stile, in silenzio. È la
   trappola di `CARTA_RIGA` (§9-octodecies) applicata alle animazioni — per questo
   tre elementi hanno **perso** `hero-transition` diventando figli di una cascata.
3. **Un test verde non dice niente finché non lo si è visto fallire** (§9-sexies).
   26 mutazioni provate, 26 prese, ma **quattro solo dopo aver corretto lo
   scenario**: il test non renderizzava l'elemento che diceva di proteggere — una
   card di oggi che non c'era, un eroe dei feedback con la lista vuota, uno zero
   iniziale già sparito prima dell'asserzione.
4. ⚠️ **Verificare che un ripristino sia avvenuto.** Durante le mutazioni
   sull'archivio un file non è tornato indietro, e per un momento il rosso è
   sembrato un difetto del codice appena scritto. Da allora ogni giro di mutazioni
   ricontrolla lo stato del file dopo il ripristino.

### Cosa resta aperto
- **I blocchi della scheda entrano come gruppo**, non uno per uno: il loro
  contenitore è una sezione della pagina, e farli cascare anche dentro sarebbero
  due animazioni sovrapposte. Per farli singoli serve un indice che continui quello
  delle sezioni attraverso blocchi condizionali. C'è un test che fissa la scelta.
- **Il passo che esce** (vedi punto 4).
- **La tenda curva**, che ha bisogno prima di un problema di contrasto risolto.

---

## 9-duodequadragies. L'apertura dell'app (22/09/2026)

Richiesta del committente: «quando avvio l'app compare il logo FLEOFIT ma poi
sparisce e basta, voglio un'animazione smooth con qualche shape che si muove per
fare comparire la home».

### 🔴 REGISTRARE L'AVVIO HA TROVATO DUE DIFETTI CHE NON ERANO NELLA RICHIESTA
Prima di progettare qualcosa si è registrato l'avvio vero
(`xcrun simctl io <udid> recordVideo`) e se ne è letta la luminanza fotogramma
per fotogramma. La sequenza era:

    nero 0,52s  →  🔴 BIANCO 0,38s  →  «FLEOFIT / Caricamento…»  →  taglio netto

1. **380ms di bianco pieno.** Su un'app tutta scura è un flash in faccia, e non
   se n'era mai accorto nessuno. È la webview che dipinge il proprio fondo prima
   che il foglio di stile sia arrivato, quindi una regola in `src/index.css`
   **non basta** — quel file arriva dopo. Corretto da due lati: uno `<style>` in
   linea in `index.html` (già nel documento) e `ios.backgroundColor` in
   `capacitor.config.ts` (copre la webview).
2. 🔴 **Lo schermo di lancio nativo è NERO SENZA LOGO.** Il logo che si vedeva —
   e che la richiesta chiamava «il logo FLEOFIT» — è sempre stato quello **web**.
   ⚠️ Nella `Splash.imageset` la variante **dark** ha il logo **cinque volte più
   piccolo** della light (10% contro 48% della larghezza). Resta aperto: è
   un'immagine da rifare, non codice, ed è l'ultimo stacco dell'avvio.

### Il meccanismo: l'arco che risale
🔴 **Ci sono volute due stesure, e la prima era una scorciatoia.** Il riferimento
(§9-septtricies) rivela con una tenda chiara che sale su fondo nero: funziona
perché è **nero su crema**, contrasto totale. In FLEOFIT tutto è `#0B0B0B` su
`#1e1e1e`, e per questo la tenda era l'unica delle quattro animazioni lasciata
fuori dal rework. La prima stesura ha **aggirato** il problema con due aloni
`radial-gradient` che entravano e una dissolvenza in uscita — bocciata dal
committente in una riga: «quel gradiente è osceno, e la dissolvenza non mi
piace». Aveva ragione, e la seconda metà è il punto: **nel riferimento non c'è
nessuna dissolvenza**. Aggirare un problema è rispondere a un'altra domanda.

Riletto fotogramma per fotogramma, il meccanismo vero è: **l'area scura resta
ancorata in alto e il suo bordo inferiore — una curva il cui punto più basso sta
a circa un terzo da sinistra — RISALE**, scoprendo la pagina da sotto. Non è un
foglio che scorre via e non è un velo che si spegne.

⚠️ **`clip-path: ellipse()` INTERPOLA** fra due valori della stessa funzione:
l'arco si muove e si appiattisce da sé, senza JavaScript e senza un SVG animato
a mano. Cambiarlo in `path()` o in due funzioni diverse toglie l'interpolazione e
l'animazione diventa uno scatto, **senza dare errori**.

I numeri vengono dai fotogrammi: centro dell'ellisse al **30%** da sinistra,
raggio orizzontale **80%**, da cui segue che il bordo destro dell'arco sta al
**48,41%** della profondità del punto più basso — nel video è 0,48.

### 🔴 IL RAGGIO DI PARTENZA È 208%, E IL NUMERO È CALCOLATO
Con quella geometria lo schermo è coperto fino all'angolo in basso a destra solo
finché il raggio è **≥ 206,6%**: sopra, l'arco è **fuori schermo**. La prima
stesura partiva da 220% e buttava via il 6% del percorso in una zona invisibile —
che con un ease-out esponenziale è **un terzo del tempo**: il tratto visibile si
consumava in un centinaio di millisecondi, cioè uno scatto.

⚠️ Chi cambia `rx` o il centro **deve ricalcolare anche questo**, o l'animazione
torna a saltare. Ed è la stessa famiglia di difetto di `max-width` che non
interpola da `none` (§9-septtricies): l'animazione esiste, ma quasi tutta fuori
da dove si guarda.

⚠️ E la curva è **cubica**, non l'esponenziale storico del progetto. Il commento
diceva il contrario ed è stato corretto misurando: su un percorso quasi tutto
visibile, `cubic-bezier(.16,1,.3,1)` fa sparire l'arco in un lampo.

### I tre tempi, e il battito in mezzo
Marchio via (**260ms**) → **130ms di nero assoluto** → arco che risale (**430ms**).
⚠️ La pausa è **misurata sul riferimento**, non un ritardo inventato: è quella a
far leggere il passaggio come deliberato invece che come un caricamento, ed è la
prima cosa che verrà in mente di togliere. Le tre durate stanno sia in
`Apertura.jsx` sia in `src/index.css` e **devono coincidere**, o l'ultimo pezzo
di animazione viene tagliato quando la sovrapposizione si smonta.

### 🔴 LA SOVRAPPOSIZIONE STA SOPRA L'APP, NON AL POSTO SUO
C'era un `if (loading) return <schermata>` in `ProtectedRoute`: con quella forma,
nell'istante in cui i dati arrivano la schermata **smonta** e la Home **monta**
nello stesso fotogramma — che è letteralmente il «sparisce e basta» della
richiesta. Una sovrapposizione resta viva attraverso quel passaggio, e la sua
uscita scopre una Home già montata e **già in cascata**.
⚠️ Deve restare **lo stesso elemento** attraverso i rami di `ProtectedRoute`:
renderizzarla in due punti diversi la farebbe smontare e rimontare al cambio di
ramo, e l'entrata ripartirebbe a metà uscita.
⚠️ Minimo **900ms** a schermo: senza, un avvio veloce la mostra per due
fotogrammi e si legge come uno sfarfallio — peggio del taglio che sostituisce.

### Il pre-disegno in `index.html`, e quanto vale davvero
Il primo fotogramma dell'apertura è dipinto **dentro `index.html`**, così compare
appena l'HTML viene letto invece di aspettare bundle e montaggio.
⚠️ Sta **dentro `#root`** di proposito: `createRoot().render()` svuota il
contenitore al primo render, quindi il pre-disegno se ne va da solo. Fuori da
`#root` resterebbe in pagina per sempre, **sopra l'app**.

🔴 **È UNA COPIA, e la copia è inevitabile**: il foglio di stile e il bundle
arrivano dopo, quindi lì non si può usare né Tailwind né una classe. Quando le
due metà divergono il sintomo è uno **scalino di colore** nell'istante del
passaggio, che nessun errore segnala e che in jsdom non si vede.
`src/__tests__/aperturaPredisegno.test.js` legge i file **dal disco** e li
confronta. ⚠️ Uno dei tre era verde per il motivo sbagliato: usava
un'espressione regolare fra `<div id="root">` e `</div>`, e spostando il
pre-disegno **fuori** da `#root` la regex si allungava fino al `</div>`
successivo e continuava a trovarcelo dentro. Riscritto leggendo l'albero con
`DOMParser`.

🔴 **VALE MENO DI QUANTO SEMBRA, ed è stato misurato.** La previsione era che
togliesse «quasi tutti» gli 1,7 secondi di nero: **ne toglie 0,69**. Ipotesi
provata e **scartata**: che a bloccare fosse il `<link>` del foglio di stile
(124 KB, render-blocking). Reso non bloccante sulla sola copia costruita e
rimisurato — 2,24s invece di 2,22s, cioè niente. Il resto dell'attesa sta **sotto
il livello web** (schermo di lancio nativo, webview mostrata solo a pagina
caricata) e da `index.html` non si raggiunge.

### 🔴 IL MARCHIO NON HA UN'ENTRATA, E CI SONO VOLUTI DUE TENTATIVI SBAGLIATI
L'aveva (sfumava salendo di 10px), e produceva un **rimbalzo** segnalato dal
committente: il pre-disegno la giocava, e React la **rigiocava** montando a metà.
Confermato fotogramma per fotogramma — il logo arrivava a piena opacità, si
abbassava di dieci pixel e si sbiadiva, poi tornava.

| tentativo | perché è sbagliato |
|---|---|
| una **soglia** («se è passato più di 620ms, saltala») | copre solo il caso in cui React arriva TARDI; quando arriva a metà — il caso normale — l'entrata non veniva saltata ma **ricominciata** |
| un **`animation-delay` negativo** per riprenderla, leggendo il punto con `getAnimations()` | quel modulo è valutato **prima** che l'animazione del pre-disegno sia partita: non c'è ancora niente da leggere. Rimisurato, il calo era identico |

**La risposta non era un passaggio di consegne più furbo: era togliere la seconda
animazione.** Il marchio ora c'è e basta, identico prima e dopo, e non può
rimbalzare perché non gli succede niente. Misurato sulla sua fascia: prima due
cali di luminosità (46→41 e 69→46), ora **nessuno** — 78 costante.

> ⚠️ **La regola che ne esce, e vale oltre questa schermata**: *due superfici che
> disegnano lo stesso elemento non possono animarlo entrambe.* Quando succede,
> non si cerca un modo più furbo di sincronizzarle — se ne toglie una.

### Il gradiente, che NON è un ritorno agli aloni
Segnalato dal committente: «il fatto che sia tutto nero fa poco contrasto e non
si capisce bene che c'è un'animazione». Il fondo dell'apertura è un caldo ambra,
più chiaro **dove sta il marchio e dove l'arco si abbassa** — cioè proprio la
zona che se ne va. ⚠️ Gli aloni bocciati erano due cerchi sfumati che
**entravano in scena**; questo è il fondo della superficie e **sta fermo**.
⚠️ E il contrasto vero lo fa **il contenuto**: sotto c'è la Home già in cascata,
quindi quello che risale non è un bordo fra due neri — è la pagina che compare.
L'arco porta solo una luce ambra sottile, e serve al **primo fotogramma**, quando
sotto non c'è ancora niente.
⚠️ `drop-shadow` e non `box-shadow`: box-shadow segue il rettangolo e non la
forma ritagliata — disegnerebbe una luce dritta sotto una curva.

### Cosa resta aperto
- **Lo schermo di lancio nativo**, nero e senza logo (vedi sopra). È l'unico
  stacco rimasto nell'avvio e si chiude rifacendo l'immagine dark dell'asset.
- **Il marchio del pre-disegno e quello di React sono due markup diversi.** Il
  test confronta gradiente, corpo e posizione; il resto è disciplina.

---

## 9-undequadragies. I dialoghi centrati (22/09/2026)

Segnalazione del committente sulla modale **«Bozza Trovata»**, quella che apre
`CreateWorkout` quando in `localStorage` c'è un `fleofit_workout_draft`: «non è
graficamente coerente con il resto dell'app e compare secca senza animazione».

### Erano due difetti, non uno
1. 🔴 **Il velo arrivava a nero PIENO nel primo fotogramma.** La carta la sua
   entrata ce l'aveva (`.modal-transition`), ma `bg-black/85` si accendeva
   secco dietro di lei — e un nero che compare tutto insieme copre qualunque
   movimento ci sia sotto. Ora il velo sfuma con **`velo-in`**, che è lo stesso
   keyframe dei bottom sheet: il velo dell'app è uno.
2. 🔴 **E la curva della carta era quella sbagliata.** `modalZoomIn` era
   `scale(.95) → 1` in **0,2s** con `cubic-bezier(.16,1,.3,1)`, cioè l'ease-out
   **esponenziale**: copre il 90% della distanza nei primi 50ms. Non è
   un'entrata, è un lampo. È esattamente il rilievo da cui è nato il linguaggio
   di movimento del 21/09 (§9-septtricies), e allungare la durata senza
   cambiare la curva l'avrebbe resa solo **più lenta a non muoversi**. Ora è
   `modalIn` — 10px di salita **più** `scale(.96)`, 0,32s, `--cascata-curva`.
   ⚠️ Sale oltre a scalare perché una scala pura su una card centrata si legge
   come uno zoom, mentre tutto il resto dell'app entra salendo.
   Misurato nel browser: 40% a 52ms, 74% a 118ms, 92% a 185ms — visibilmente in
   movimento per tutta la durata.

### Il vocabolario: erano gli ultimi due dialoghi di prima del rework
`CustomAlert` e `CustomConfirm` portavano ancora
`bg-[#1e1e1e] border-[#2a2a2a] rounded-3xl shadow-2xl`, cioè il «Pattern card»
del §6 — e si aprivano sopra dieci schermate che da un mese sono fatte di
gradiente, hairline chiara e ombra proiettata. Ora usano **`CARD`**, la stessa
costante di ogni card del progetto, più `VETRO` sul secondario e l'ombra ambra
della CTA sul primario. La bolla dell'icona prende i toni di `TONO_VERDETTO`
(fondo tenue, bordo, testo) al posto del `bg-red-900/30` pieno.
Con essi è arrivato `role="dialog" aria-modal="true"` con il titolo come nome.

⚠️ **Il peso del carattere NON sta nella costante condivisa del bottone.**
`font-bold` e `font-black` sono due utility della **stessa specificità**: messe
insieme in una stringa di classi, a decidere è l'ordine nel foglio di stile e
non l'ordine in cui le si scrive. È la trappola del bordo di `CARTA_RIGA`
(§9-octodecies) e del raggio di `CARD` (§9-sedecies), e qui è stata evitata
facendo dichiarare il peso a ogni variante.

### La correzione arriva a tutta l'app, ed è voluto
`CustomAlert` e `CustomConfirm` sono montate in **otto pagine** più `AlertHost`
in `App.jsx`: una modale speciale per la sola bozza sarebbe stata una copia, e
la copia è il modo in cui una correzione ne raggiunge due su tre (§9 punto 1).
`.modal-transition` è anche del picker della data in `Calendar.jsx`.

### 🔴 E la modale «Sei sicuro?» dell'uscita non aveva NESSUNA animazione
Sta sulla stessa schermata, scritta a mano, e la sua entrata era
`animate-in fade-in zoom-in-[0.96] duration-300` — cioè **tw-animate-css, che
non è installato**: zero CSS generato, verificato sul bundle
(`grep -c "animate-in" dist/assets/*.css` → **0**). È la **quinta** comparsa
della stessa trappola (§9-duodecies, §9-quindecies, §9-duodetricies,
§9-septtricies). Ha preso velo, carta e keyframe delle altre due.
⚠️ **Resta scritta a mano e non diventa una `CustomConfirm`**: la sua conferma
è distruttiva e si chiama «Sì, esci», mentre quel componente ha due etichette
fisse e la primaria gialla.

### 🔴 Il secondo giro: `WorkoutDetail` e `AthleteDetail` avevano DODICI modali, non due
Chiesto dal committente subito dopo, sulla scorta della voce di BACKLOG che
diceva «due». **Il backlog contava le «Sei sicuro?», non le modali**: in quei
due file ci sono **dodici** dialoghi centrati (assegna, allenamento libero,
social, PR, modifica atleta, anteprima, TV, successo…) e **tutti e dodici**
avevano `animate-in` e il vocabolario di prima. Sono passati tutti al velo che
sfuma e alla carta sollevata; i tre che parlano all'utente — le due conferme
distruttive e il «Workout Assegnato!» — hanno preso anche bolla, tipografia e
bottoni. Dopo la passata: `grep -c "animate-in"` su quei due file → **0**.

### Il vestito è salito in `lib/stiliCard.js`, e la ragione non è l'ordine
`CARTA_MODALE`, `BOLLA_MODALE` + `TONO_BOLLA`, `TITOLO_MODALE`,
`TESTO_MODALE`, `BOTTONE_QUIETO` / `BOTTONE_BRAND` / `BOTTONE_PERICOLO`.
🔴 Stanno lì e non in `CustomModals.jsx` per **due** ragioni, e la seconda è
quella che conta. La prima: un file di componenti che esporta anche una
costante perde il Fast Refresh per intero (§9-octies punto 3). La seconda:
`CustomAlert`/`CustomConfirm` **non possono** coprire tutti i dialoghi del
progetto — quelli con una conferma distruttiva hanno etichette proprie
(«Sì, esci», «Elimina») e **restano aperti mentre il lavoro è in corso**, cosa
che il contratto di `CustomConfirm` non sa fare: chiude appena si conferma,
quindi il «Eliminazione…» di `WorkoutDetail` non si vedrebbe mai. Restano
perciò scritti a mano in tre pagine, ed erano **quattro copie** delle stesse
stringhe di classi: la quinta sarebbe stata quella che diverge.

### ⚠️ `backwards`, non `both` — e il caso che sembrava dimostrarlo NON lo dimostra
`forwards` (cioè metà di `both`) fa conservare all'elemento `transform` e
`opacity` dell'ultimo keyframe **per sempre**, all'origine animazione: sopra
qualunque utility o stile inline che li tocchi dopo. Qui non serve a niente —
l'ultimo keyframe è già lo stile di base — e può solo inchiodare una modale
che un giorno debba muoversi (è la famiglia di `.sheet-in` senza `fill`).
ℹ️ Il foglio «Trasmetti in TV», che si alza di 8rem con `-translate-y-32`,
sembrava la prova: **non lo è**. In Tailwind 4 quell'utility scrive la
proprietà **`translate`**, non `transform`, e le due si compongono. Misurato
nel browser: a fine animazione `transform: none` e `translate: 0px -128px`.
È annotato perché la spiegazione comoda era sbagliata, e una ragione falsa in
un commento è peggio di nessun commento.

### Il terzo giro: TUTTE le modali dell'app (BACKLOG #44, chiuso)
Chiuso lo stesso giorno: `Home` (allenamento libero, conferma rimozione,
spettatore LIVE), `CreateWorkout` (picker dei blocchi, picker della fase di
corsa, salvataggio), `Settings` (modifica password), `RpeModal`,
`CustomDatePicker`. **Nessuna modale centrata del progetto entra più con una
classe che non esiste.**

🔴 **Lo spettatore «LIVE» ha fatto nascere `CARD_BASE`.** Ha un bordo
`border-red-500/30` che è uno **stato**, non decorazione: affiancarlo a `CARD`
— che porta già `border-white/[.07]` — non avrebbe sovrascritto niente, perché
sono due utility della stessa specificità e a decidere è l'ordine nel foglio di
stile. È **esattamente** la trappola di `CARTA_RIGA_BASE` (§9-octodecies), alla
sua terza comparsa: chi ha un bordo di stato parte da `CARD_BASE` e lo dichiara.

⚠️ **`RpeModal` è la più usata dell'app e ha un cursore trascinabile**, quindi
era l'unica a poter rompersi davvero: il punteggio si calcola da un
`getBoundingClientRect()` della pista, e la carta ora si scala durante
l'entrata. **Non è un difetto, ed è utile sapere perché**: il rettangolo è
quello *visivo*, quindi il rapporto `(x - rect.left) / rect.width` resta
coerente con ciò che il dito vede — e l'unica altra trasformazione è su Y,
mentre il cursore legge X. Verificato nel browser, non dedotto: modale aperta,
tocco a tre quarti della pista, 5 → **8**.
⚠️ Il suo `-translate-y-36` con la tastiera aperta resta, e c'è un test che
tiene ferma la classe che lo trasporta.

⚠️ **Il picker degli esercizi a schermo intero ha preso `sheet-in`, non
`modal-transition`**: non è una carta centrata, è una schermata che copre il
builder, quindi sale dal basso. Anche la sua entrata di prima
(`animate-in slide-in-from-bottom-4`) generava zero CSS.

### Cosa NON è stato toccato
Gli `animate-in` che **non** sono modali: i contenitori interni che sfumano al
cambio di `key` in `CreateWorkout` (sette punti), l'onboarding in `App.jsx` e la
TV. Sono decorazioni morte, non entrate mancanti, e restano BACKLOG #34.

### I test
Cinque nuovi — due in `CreaWorkoutBuilder.test.jsx`, uno in
`WorkoutDetailScheda.test.jsx`, uno in `SchedaAtleta.test.jsx`, uno in
`HomeOffline.test.jsx` per la modale RPE (**978** in tutto). **Nove mutazioni
provate, nove prese**, ognuna da un test diverso: via `velo-in` (tre), ritorno
ad `animate-in` (quattro), ritorno al vecchio vocabolario, via
`transition-transform` dalla modale RPE.
⚠️ Tutti e quattro confrontano la classe con la **costante `CARTA_MODALE`
importata**, non con le classi riscritte a mano: è l'unico modo perché sei
dialoghi in quattro file non tornino a divergere di un raggio.
⚠️ E una verifica ha smentito una diagnosi: nel browser la carta sembrava
**trasparente** in uno screenshot. Non lo era — il pannello non dipinge mentre
è nascosto, quindi l'attesa non fa avanzare i fotogrammi e lo scatto cade a
metà animazione. È lo stesso limite già annotato per `requestAnimationFrame`
(§9-tertricies) e per `html-to-image` (§9-unetvicies): lo stile **calcolato**
ha detto opacità 1 e gradiente al suo posto.

---

## 9-duoquadragies. Il linguaggio aptico (24/09/2026)

Richiesta del committente: «aggiungi feedback aptico un po' in giro per tutta
l'applicazione, in base a quella che credi sia la migliore soluzione UX».

### Il criterio, prima dei punti
**Il dito sente ciò che l'occhio potrebbe perdersi, o ciò che non si può più
disfare.** Un gradino passato trascinando, una scelta cambiata, un esito, un
oggetto afferrato. ⚠️ **NON si vibra sulla navigazione** — la tab bar di iOS
non vibra — **né sull'apertura di un foglio o di una conferma**: un'app che
ronza a ogni tocco insegna a non badarci più, e allora non la si sente nemmeno
quando conta.

### Sei verbi, in `src/lib/aptica.js`
| verbo | generatore iOS | dove |
|---|---|---|
| `battito` | impatto Light | picker, slider RPE, ± dello Stepper, blocco scavalcato nel drag, soglia di un foglio o dello swipe, microfono che si ferma |
| `vibraScelta` | selezione | chip dei filtri, segmentati, interruttori, giorno del calendario, card di categoria, 👍/👎 del recap, icona TV |
| `vibraPresa` | impatto Medium | presa del drag&drop, microfono che parte (note vocali e dettatura IA), swipe di completamento compiuto |
| `vibraSuccesso` | notifica Success | allenamento completato (tre pagine), workout salvato, assegnato (due fogli), codice invito accettato, ogni `CustomAlert` di successo |
| `vibraErrore` | notifica Error | ogni `CustomAlert` d'errore, codice invito rifiutato o rete caduta |
| `vibraRichiamo` | notifica Warning | reazione o vocale del coach durante il timer (Live Coach Cam) |

### ⚠️ Le cinque cose da sapere prima di rimetterci mano
1. 🔴 **Sul plugin iOS `selectionChanged()` è MUTO senza un
   `selectionStart()` prima**: il generatore nasce lì. Nessun errore, nessuna
   vibrazione. `vibraScelta` lo prepara una volta per sessione, e c'è un test
   che verifica anche l'ordine delle due chiamate.
2. 🔴 **`navigator.vibrate` su iPhone NON ESISTE.** La presa del drag&drop e le
   reazioni della Live Coach Cam lo usavano come unica vibrazione: **su iOS non
   avevano mai vibrato**. Ora passano dal plugin; `navigator.vibrate` resta solo
   ripiego web.
3. 🔴 **Il prefisso `vibra` evita un difetto vero, non un gusto.** La prima
   stesura esportava `scelta`, `errore`, `successo`: in `RecapUI` la prop si
   chiama già `scelta`, in `CreateWorkout` c'è una funzione locale `scelta`, in
   `CustomAlert` una costante `errore`. L'import veniva ombreggiato in silenzio
   — il 👍 del recap avrebbe chiamato una stringa. L'ha trovato il linter
   (`no-unused-vars` sull'import), non i test.
4. **Gli esiti degli alert vibrano da `CustomAlert`**, che è l'unico punto da
   cui passano tutti — `mostraErrore`/`mostraSuccesso` e gli alert locali di
   otto pagine. ⚠️ Chi mostra un alert di successo **non** chiami anche
   `vibraSuccesso()`: due notifiche in fila per lo stesso esito si leggono come
   un errore. Chiamarla a mano serve solo dove l'esito NON passa da un alert
   (completamento, salvataggio, assegnazione, codice invito).
5. **Una scelta già attiva ritoccata non vibra**: non è cambiato niente. I
   controlli che si comportano da radio (segmenti, categoria, giorno,
   gradimento) guardano lo stato prima di vibrare; quelli che fanno toggle
   (chip, interruttori, fasce filtro) vibrano sempre, perché cambiano sempre.

Il timer guidato **non è stato toccato**: ha già il suo aptico (Light per il
beep corto, Heavy a fine round) legato ai suoni, ed è il posto in cui la
vibrazione è più utile di tutte. L'interruttore «Feedback aptico di sistema»
delle Impostazioni di iOS lo rispetta il sistema da solo: non serve una
preferenza nostra.

### I test
`src/lib/__tests__/aptica.test.js` (12: il vocabolario sul ramo nativo acceso a
mano), `src/__tests__/apticaPunti.test.jsx` (7: alert, soglia del foglio,
interruttore, scelta già attiva, slider RPE) e uno in `HomeRecap.test.jsx`
(completare vibra UNA volta). **Dodici mutazioni provate, dodici prese.**
⚠️ Si sente solo sul telefono: il Simulatore non ha il Taptic Engine.

---
