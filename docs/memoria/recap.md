# Il recap post-allenamento e il gradimento

> Spostato da `CLAUDE.md` il 07/10/2026, **senza cambiare il testo**. I rimandi
> «§9-…» puntano a sezioni che ora stanno in altri file di questa cartella:
> si trovano con `grep -rn '^## 9-<nome>' docs/memoria`. L'indice è in `CLAUDE.md`.

## 9-quadragies. Il recap post-allenamento (22/09/2026)

Richiesta del committente, con Runna come riferimento: «quando concludo un
allenamento e segno come completato mi compare una schermata molto figa in
stile storie di Instagram che mi dà un recap e mi fa vedere schermate molto
belle graficamente. Voglio qualcosa del genere che magari mi faccia vedere un
grafico e mi stimoli al prossimo allenamento. Se non è ancora programmato non
fa nulla, inventa altro. Magari mostra anche un andamento totale degli
allenamenti. Crea anche il caso se non ancora fatti altri allenamenti.»

### Il problema, in una riga
Chiudere un allenamento era un **niente**: si premeva «Fatto! 🎉», la modale RPE
si chiudeva, e si tornava alla stessa Home con un pallino verde in più. Il
momento in cui l'atleta ha appena finito — l'unico della giornata in cui è
disposto a guardare i propri numeri — era l'unico in cui l'app non gliene
mostrava nessuno.

### Cosa c'è ora, nell'ordine in cui si scorre
Una superficie a tutto schermo che arriva **dopo** la modale RPE, con la barra
segmentata delle storie in cima. Quattro schede, e le ultime tre cambiano forma
a seconda di quanto storico c'è:

1. **Fatto** — la spunta nel colore della corsia, «Running · il tuo 14°
   allenamento», il titolo, il giorno e le tre celle grandi.
2. **Questa settimana** — l'anello fatti/assegnati, il volume con lo scarto
   sulla settimana scorsa, la serie di giorni e i sette pallini.
3. **Come stai andando** — il grafico a barre delle ultime **otto settimane**,
   il verdetto sul volume, e i totali della finestra (sedute, ore, RPE medio).
4. **Il prossimo** — l'allenamento già in programma, con «Apri la scheda» come
   primaria; oppure il conto alla rovescia di una gara; oppure, se non c'è
   niente, la serie da difendere e l'invito a registrare un libero.

### 🔴 LE QUATTRO REGOLE CHE TENGONO ONESTA QUESTA SCHERMATA
Stanno in testa a `src/lib/recapAllenamento.js` e sono la ragione per cui quel
file esiste invece di essere trenta righe dentro un componente.

1. **Nessuna cella mostra uno zero.** È la regola della Home (§9-duodetricies),
   e qui pesa il doppio: è una schermata di festeggiamento, e un «0 min» dentro
   un coriandolo si legge come una presa in giro. Le schede si **tolgono**
   invece di riempirsi di zeri, e ognuna che sparisce ha un rimpiazzo che dice
   cosa la accenderà — «il grafico si accende dopo 3 allenamenti · 1/3».
2. **Il primo allenamento di sempre ha una scheda sua.** Con un solo completato
   la settimana e l'andamento lasciano il posto a «Da qui in poi c'è una storia
   da raccontare»: la serie appena nata, i minuti di quella seduta, e la soglia
   dell'andamento con il suo progresso. Fra due e `MINIMO_ANDAMENTO`
   allenamenti resta la settimana e l'andamento diventa la cella che dice
   quanto manca.
3. **Le soglie non si riscrivono qui.** `MINIMO_ANDAMENTO` **è**
   `MINIMO_PRECEDENTI` di `statistiche.js` — la stessa con cui la Home decide
   se accendere «Media RPE» — e `SOGLIA_STABILE` viene da `andamento.js`. Due
   numeri scritti a mano in due punti direbbero all'atleta «si accende dopo 3
   allenamenti» e lo accenderebbero al quarto, senza dare nessun errore.
4. **Le tre celle della prima scheda vengono da `celleStoria`**, la stessa
   funzione della grafica da storia (§9-unetvicies): il `≈` sulla durata, l'RPE
   **dichiarato** che non ripiega su 5 ma sull'intensità del coach, la corsa
   mista che non dichiara nessun totale. Riscriverle qui vorrebbe dire due
   recap dello stesso allenamento con due numeri diversi — uno nell'app e uno
   nell'immagine che finisce sotto gli occhi di tutti.

### ⚠️ Le nove cose da sapere prima di rimetterci mano

1. 🔴 **Il verdetto legge una serie PIÙ LUNGA di quella disegnata, e senza
   questo non compariva mai.** Confronta quattro settimane chiuse con le
   quattro precedenti, cioè **otto chiuse**; il grafico ne ha otto in tutto, di
   cui l'ultima è quella in corso — quindi sette. Con la stessa serie per le
   due cose la fascia sarebbe stata `null` **sempre**, e nessun test lo avrebbe
   segnalato, perché `null` è anche la risposta giusta a un atleta nuovo. Da
   qui `SETTIMANE_VERDETTO = SETTIMANE_ANDAMENTO + 1`. **Trovato guardando la
   schermata, non leggendo il codice.**
2. 🔴 **La settimana in corso resta fuori dal confronto.** È parziale per
   definizione — il lunedì vale un settimo di sé stessa — e infilarla nella
   media farebbe dichiarare un crollo ogni lunedì mattina. È la correzione che
   l'aderenza del report ha già ricevuto (§9-vicies).
3. 🔴 **Una lettura fallita NON diventa uno storico vuoto**, ed è la ragione per
   cui esiste `recapMinimo`. La strada comoda era chiamare `costruisciRecap`
   con `storico: []`, e lì il conteggio vale zero: a un atleta con cento
   allenamenti alle spalle il recap avrebbe annunciato «il primo è fatto». Un
   guasto travestito da dato, sulla schermata che esiste per dirgli una cosa
   vera (§9-quater). Offline la scheda «fatto» si vede lo stesso: è costruita
   con quello che la pagina ha già in mano.
4. 🔴 **L'ordinale («il tuo 47°») è quello di SEMPRE, e per questo le letture
   sono due.** La prima porta `sections` — la colonna più pesante del database
   — ed è limitata a `GIORNI_RECAP = 90`; la seconda chiede i soli `id` dei
   completati, senza finestra. Contare le righe della finestra direbbe «il tuo
   4° allenamento» a chi ne ha fatti quarantasette, e manderebbe **il
   benvenuto del giorno 1 a chi rientra dopo tre mesi**. C'è un test per
   ognuno dei due casi.
5. 🔴 **Il recap è di chi si è allenato, non di chi guarda.** La guardia è
   `role === 'athlete'` in tutte e tre le pagine. Serve davvero in **una** sola:
   la **scheda atleta**, dove il bottone «Cambia lo stato dell'allenamento» non
   guarda il ruolo e il coach chiude per conto di un altro. Nella Home il ramo
   atleta non esiste per lui, e nella scheda del workout il comando è riservato
   a `eAtleta`. Il test che conta sta perciò in `SchedaAtletaRecap.test.jsx`.
6. 🔴 **Il confine pigro non è un vezzo, ed è misurato.** Il recap lo montano
   tre pagine, quindi Rollup lo raccoglie nel chunk condiviso — che qui è
   quello di **ingresso**. Importato direttamente portava `index` da **593 a
   626 KB**: 32 KB di parsing davanti a ogni apertura dell'app per una
   schermata che si vede qualche volta a settimana. Ora
   `RecapAllenamento.jsx` è solo `lazy()` + `Suspense`, il lavoro sta in
   `RecapDati.jsx`, e il chunk `RecapDati` (22 KB) arriva al primo
   completamento. ⚠️ Il confine sta **lì e non nelle tre pagine**: tre `lazy()`
   da tenere allineati sono tre occasioni di riportarlo dentro.
   ⚠️ E vale la regola di §9-duetricies: **nessun `html-to-image` né `jspdf`**
   in questo albero. La grafica da condividere esiste già e sta nel menu della
   scheda.
7. 🔴 **Le schede AVANZANO DA SOLE, e le barre in cima sono un orologio.**
   La prima stesura le lasciava ferme — la barra diceva solo a che punto si era
   — e il committente l'ha corretta lo stesso giorno: in una storia il segmento
   si riempie e passa oltre, ed è quello a dire che la schermata ha un séguito.
   `DURATA_SCHEDA` è **6 secondi**, non i 5 di una storia fotografica: la
   scheda più densa porta un grafico a otto barre e tre totali, e cinque
   secondi bastano a guardarla ma non a leggerla.
   Le due conseguenze senza cui la cosa non sarebbe praticabile:
   - 🔴 **Tenere premuto mette in pausa**, come su Instagram. Senza, chi vuole
     rileggere un numero non ha nessun modo di fermare la schermata — e il
     gesto che proverebbe per primo è proprio tenere il dito giù. ⚠️ La
     navigazione sta in `onClick` e NON in `onPointerUp`: le due metà sono
     bottoni veri, raggiungibili da tastiera, e un `Invio` non produce nessun
     evento di puntatore. I gestori del puntatore servono solo alla pausa e a
     distinguere il tocco dalla **tenuta**, che `onClick` legge e da cui si
     ferma — senza, alzare il dito dopo una pausa farebbe saltare una scheda.
   - 🔴 **L'ultima scheda NON si chiude da sola.** In una storia l'ultimo
     segmento pieno chiude tutto; qui l'ultima porta «Apri la scheda», che è
     l'unica azione per cui questo recap esiste, e chiuderla allo scadere
     vorrebbe dire portare via il bottone a chi lo stava per premere. Il
     segmento resta pieno e il tempo si ferma. ⚠️ Un **tocco** sulla metà
     destra lì chiude invece sì: è un gesto deliberato, ed è ciò che fa una
     storia.
   ⚠️ **Con `prefers-reduced-motion` l'avanzamento non parte affatto**, e il
   segmento corrente si disegna **pieno**, non fermo a metà: una barra immobile
   a metà si legge come un caricamento bloccato. Chi chiede meno movimento
   quasi sempre chiede anche più tempo. È la stessa scelta di
   `useNumeroCheSale` — e vuol dire che **un test sull'avanzamento deve
   accendere il movimento a mano**, perché `src/test/setup.js` dichiara
   `reduce` per tutta la suite.
   ⚠️ **L'azzeramento del tempo sta in `mostra()`, non nell'effetto
   dell'orologio**: lì sarebbe un `setState` sincrono dentro un effetto e
   soprattutto arriverebbe un fotogramma DOPO il cambio di scheda — quel
   fotogramma la barra nuova lo passa piena, ed è lo sfarfallio che si nota a
   ogni avanzamento.
   ⚠️ **L'orologio non parte finché la lettura è in corso**, e non è una
   cautela generica: durante il caricamento il recap ha **una** scheda, quindi
   il tempo scadrebbe sull'ultima e si fermerebbe lì — e quando le altre
   arrivano nessuno lo farebbe ripartire.
   ⚠️ Nessuna `transition` CSS sulla larghezza del segmento: la anima già il
   ciclo di fotogrammi, e una transizione sopra le due cose farebbe strisciare
   il segmento **oltre** il cambio di scheda.
   ⚠️ **I bottoni «Avanti» e «Salta» sono usciti**, e al loro posto il piede
   porta la riga che insegna il gesto: senza, il tocco a destra non lo scopre
   nessuno. Il piede c'è **sempre e alla stessa altezza** anche quando non ha
   un bottone, o le schede — che si centrano nello spazio che resta —
   salterebbero su e giù a ogni avanzamento.
   ⚠️ **Lo scorrimento orizzontale è stato tolto** con i due bottoni: con le
   due metà toccabili sarebbe un secondo modo di fare la stessa cosa, e sui
   bottoni rischiava di sommarsi al `click` che segue il `touchend`.

8. ⚠️ **`key={indice}` sulla scheda**, o la cascata entra solo la prima volta e
   le altre compaiono secche. E il contenuto si centra con `min-h-full` +
   `justify-center` su un wrapper **dentro** lo scorrevole: `justify-center`
   sul contenitore che scorre taglia la **cima** del contenuto, che qui è il
   titolo.
9. ⚠️ **L'alone dell'anello è inline, perché `.anello-progresso` ha un
   `drop-shadow` ambra scritto a mano in `index.css`.** Su un anello azzurro
   (Running) lo circonderebbe del colore di un'altra categoria — contro la
   Regola della Corsia. Stessa ragione per cui l'etichetta dentro l'anello non
   usa `LABEL`: il suo `tracking-[.1em]` porta «COMPLETATI» oltre i 104px del
   cerchio, e la parola esce dai due lati.

### 🔴 Quello che il recap NON promette
Sulla scheda «il prossimo», quando non c'è niente in programma, **non** si
scrive «il coach sta preparando il prossimo»: è una promessa fatta a nome di
qualcun altro che nessun dato sostiene. Si offre l'unica cosa che l'atleta può
fare da solo — registrare un allenamento libero — e si dice la **serie**, che è
un dato vero che ha in mano. È la stessa disciplina di `HomeAtletaVuotiUI`.

### ✅ Il difetto che il recap ha reso visibile — chiuso il 23/09/2026
Provandolo su Sara nell'ambiente di prova, la Home dichiarava **4876 minuti**
per la settimana e il recap **105**, a due tocchi di distanza. Non era una
divergenza del recap, che usa `durataWorkout` come tutte le altre schermate: era
una **quarta copia** dello stimatore, scritta inline dentro
`applicaStoricoAtleta`, il cui `parseTime` non riconosceva le distanze e leggeva
`800m` come 800 **minuti** per giro. Lo stesso difetto che
`src/lib/statistiche.js` aveva corretto il 26/08 (BACKLOG #30), rimasto qui.

Ora `weeklyStats.time` è `minutiSettimana(data, weekStart)` — la stessa funzione
su cui è costruito `scartoMinutiSettimana`, che stampa lo scarto **accanto** a
quel numero: due sorgenti diverse davano una differenza calcolata fra due scale,
cioè aritmetica giusta e informazione falsa. Verificato a schermo: 46 + 59 = 105,
e il recap dice 105.

🔴 **Con la copia sono uscite le due cose che la tenevano in vita.**
`weeklyStats.distance` e `weeklyStats.reps` **non li leggeva nessuno** — zero
occorrenze fuori dal calcolo che li produceva — ed erano l'unica ragione per cui
esistevano i due parser locali (`parseTime`, `parseDist`). Il blocco passa da 118
righe a 43. È la lezione di §9 punto 2: un calcolo morto non è inerte, tiene in
piedi il codice sbagliato che lo serve.

⚠️ **Nella stessa passata l'RPE medio della settimana è passato a
`rpeDichiarato`.** Contava il **5** di ripiego di `parseNotesAndRpe` come se
fosse una misura, quindi lo stesso atleta leggeva un RPE medio nella Home e un
altro nel recap e nella scheda — che `rpeDichiarato` lo usano già. È la regola di
§9-octies, ed è ciò che rende i due numeri uguali. Senza nessun RPE segnato la
cella scrive «-» invece di «5,0».
⚠️ **`calcolaStatistiche` ha ANCORA lo stesso guardiano inerte** (`load` e
`distribuzioneRpe`, cioè i numeri del **coach** nella scheda atleta): non è stato
toccato, resta la decisione di prodotto annotata in §9-octies.

⚠️ **Cosa resta, e non è questo difetto**: `weeklyStats` non si ricalcola al
completamento — `handleRpeSubmitHome` aggiorna `todayWorkouts` e `weeklyStatus`
in modo ottimistico ma non il volume, che si aggiorna al caricamento successivo.
Si vede chiudendo un allenamento e restando sulla Home: l'anello passa a 2/3 e i
minuti no. È comportamento di sempre, indipendente dallo stimatore.

### L'ambiente di prova ha guadagnato il lato atleta
`DEMO_ATLETA=at-sara npm run demo:atleta`. 🔴 Senza, il lato atleta **non era
guardabile con dei dati dentro**: «Anteprima come atleta» mette
`adminRoleOverride` ma la sessione resta quella del coach, e il coach è escluso
da chi si segue — quindi la sua Home atleta è sempre il giorno 1.
`VITE_DEMO_ATLETA` cambia l'**id** della sessione, non l'email (che deve restare
admin, o metà delle schermate coach non esiste). Con essa il seme ha preso due
righe: un pending **oggi** per Sofia — l'unico modo di provare il ramo «primo
allenamento di sempre» — e uno **fra due giorni** per Sara, senza il quale «il
prossimo» cadeva sempre sul ripiego «lo decidi tu».

### I file nuovi
`src/lib/recapAllenamento.js` (logica pura), `src/components/RecapUI.jsx` (sola
presentazione), `src/components/RecapDati.jsx` (le due letture) e
`src/components/RecapAllenamento.jsx` (il confine pigro, sei righe).

### I test, e le diciassette mutazioni
35 test nuovi: 27 in `src/lib/__tests__/recapAllenamento.test.js`, 5 in
`HomeRecap.test.jsx`, 2 in `SchedaAtletaRecap.test.jsx`, 1 in
`WorkoutDetailRecap.test.jsx`. **Diciassette mutazioni provate, diciassette
prese.**
⚠️ Due test sono nati incapaci di cadere, ed è la lezione di §9-sexies alla sua
ennesima comparsa:
- «l'ordinale è quello di sempre» passava anche **ignorando del tutto**
  `totaleCompletati`, perché l'ordinale lo legge direttamente mentre a usarlo
  come conteggio è un'altra riga. Il caso che prende la mutazione è **chi
  rientra dopo mesi**: una sola seduta nella finestra, cinquanta nella storia.
- il caso della lettura fallita **non si può provare dalla Home**: `erroreSu`
  del finto Supabase vale per la TABELLA, quindi farebbe fallire anche
  l'UPDATE del completamento — il recap non si aprirebbe affatto e il test
  verificherebbe un'altra cosa. Si monta `RecapAllenamento` da solo.
⚠️ E le query dei test di pagina si restringono al dialogo con `within`:
«RPE» e «7» esistono anche nella Home sotto di esso, e senza il confine il test
passerebbe pure con un recap vuoto.

---

## 9-unquadragies. Il gradimento nel recap (24/09/2026)

Richiesta del committente: una scheda del recap in cui l'atleta lascia
«mi piace» o «non mi piace» sull'allenamento appena chiuso, senza essere
forzato — sotto c'è «Salta» — e con il «nessuna preferenza» salvato anch'esso,
visibile **solo al coach**, per costruirci sopra grafici di gradimento.

### 🔴 Dove sta il dato: nella nota, dopo l'RPE
Lo schema è congelato (regola 0-bis), quindi è lo stesso meccanismo dell'RPE e
della pausa. `src/lib/gradimento.js`:

    [RPE: 7/10]
    [GRADIMENTO: si]
    testo dell'atleta

Quattro stati, e sono quattro risposte diverse: `si`, `no`, `nessuna` (ha visto
la domanda e ha saltato) e **`null`** (la domanda non gli è mai stata fatta —
recap chiuso prima, allenamenti di prima del 24/09, completamento dal coach).
⚠️ `nessuna` e `null` **non si fondono**: il primo l'ha chiesto il committente,
il secondo gonfierebbe gli indifferenti con chi non è stato interpellato.

### ⚠️ Le sei cose da sapere prima di rimetterci mano
1. 🔴 **Il marcatore sta DOPO l'RPE, mai prima.** `rpeDichiarato` legge
   `^\[RPE:` ancorato all'inizio: messo davanti, ogni RPE del progetto
   tornerebbe `null` senza un errore. C'è un test.
2. 🔴 **Il marcatore non si vede mai come testo.** `parseNotesAndRpe` lo toglie da
   `text` e lo riporta in `gradimento`; le tre copie del regex che citavano la
   nota nei feedback e nei report (`statisticheCoach`, `reportSettimanale`,
   `reportAtleta`) passano ora da **`testoNota`** in `rpe.js`. Senza, una nota
   con il solo parere diventava la citazione «[GRADIMENTO: si]» nella Home coach.
3. 🔴 **Chi riscrive la nota deve rimetterlo.** `formatNotesWithRpe(rpe, testo,
   gradimento)` ha un terzo argomento, e i sei punti che lo chiamano gli passano
   il parere di prima. È la trappola di `formatNotePausa` (§9-decies punto 2):
   correggere una virgola non deve cancellare un parere. Per la stessa ragione
   le tre pagine ricevono `onNote` dal recap e allineano il proprio stato.
4. 🔴 **La scheda NON avanza da sola.** Passarla allo scadere dei sei secondi
   vorrebbe dire rispondere «nessuna preferenza» al posto di chi stava leggendo.
   Lasciarla **in avanti** senza scegliere — «Salta», tocco a destra, un
   segmento più avanti, la X — vale «nessuna preferenza»; **tornare indietro no**,
   e chiudere il recap **prima** di arrivarci non registra niente.
5. **La domanda arriva sempre senza niente selezionato**, anche con un parere già dato: una scelta accesa è una risposta suggerita. E **«Salta» non ritira un parere già dato** (`gradimentoDopoSalta`): chi rifà un
   completamento e salta la domanda tiene il 👍 di prima.
6. **Il salvataggio non blocca e non allarma.** Un UPDATE fallito va nella coda
   offline, che tiene una voce per allenamento — se il completamento stesso era
   in coda, questa voce lo sostituisce portandosi dietro lo stato. Anche
   `recapMinimo` (lettura fallita) tiene la domanda: non legge niente.

### Chi lo vede
Il coach, sulla **scheda del workout**: `GradimentoWorkout` sopra l'elenco
«Assegnato a» (piaciuto / non piaciuto / senza parere, `null` e quindi assente
finché nessuno ha risposto) e `👍`/`👎`/«senza parere» nella riga di ogni atleta.
⚠️ **«Solo il coach» vale per l'interfaccia, non per il dato**: la riga è
dell'atleta e un atleta che chiamasse l'API la leggerebbe — il marcatore
nasconde, non cifra, come per la pausa. ⚠️ La web app su `main` lo mostra
come testo grezzo dentro la nota, come l'RPE (§1.1).
I grafici veri sono BACKLOG #56.

### I test
`src/lib/__tests__/gradimento.test.js` (12), più 4 in `RecapFoglio`, 5 in
`HomeRecap` (cosa finisce davvero nel database per ogni uscita) e 4 in
`WorkoutDetailScheda` (il coach lo vede, l'atleta no). Otto mutazioni provate,
otto prese.

---
