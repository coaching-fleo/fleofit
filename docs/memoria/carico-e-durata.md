# Il modello del carico e lo stimatore di durata

> Spostato da `CLAUDE.md` il 07/10/2026, **senza cambiare il testo**. I rimandi
> «§9-…» puntano a sezioni che ora stanno in altri file di questa cartella:
> si trovano con `grep -rn '^## 9-<nome>' docs/memoria`. L'indice è in `CLAUDE.md`.

## 9-quatervicies. Il modello predittivo del carico (02/09/2026)

Richiesta del committente: sapere **quanto pesa un allenamento** prima di darlo a
qualcuno. Il vincolo che dà forma a tutto: il workout **si crea prima e si assegna
dopo**, quindi mentre lo si compone non si sa a chi andrà. Il modello è perciò
diviso in due metà — `src/lib/previsione.js`, funzioni pure, 38 test.

### Il problema, in una riga
Il coach assegnava a memoria. La scheda diceva quanto dura un allenamento e con
che RPE, mai **quanto costa a quella persona in quella settimana**: chi stava
reggendo il carico e chi no si ricavava aprendo una scheda alla volta.

### Cosa c'è ora
1. **DURANTE** — nel builder, una quarta cella «Carico ≈269» e sotto una riga che
   la colloca: «Sopra la media delle tue sedute Hyrox (≈120)».
2. **ALL'ASSEGNAZIONE** — ogni riga del foglio può portare **un** avviso con il
   numero da cui esce («Carico +81% sulla sua media»), e al passo 2 la frase
   intera. Vale nei due fogli, che sono l'uno il rovescio dell'altro: la scheda
   del workout ha un workout e dodici atleti, la scheda dell'atleta ha un atleta
   e cento workout.

### ✅ LE DUE SCALE DI CARICO NON CI SONO PIÙ (dal 09/09/2026)
🔴 **Questa sezione descrive un problema CHIUSO, e va letta al passato**: dal
09/09/2026 lo stimatore è **uno solo** — `durataWorkout` somma `durataBlocco`
per i blocchi Hyrox (BACKLOG #40, §9-undetricies). Resta qui perché spiega
perché `caricoPrevisto` e `caricoAssegnazione` sono ancora **due funzioni**: la
seconda usa l'`rpeAtteso` di `statistiche.js`, che è un calcolo diverso dal
`rpeAtteso` di `stimaWorkout.js` — quella duplicazione **non** è stata chiusa.

Com'era, e perché il difetto era impossibile da notare: convivevano **due
stimatori di durata**, e su un blocco «For Time» da 5 round differivano
dell'**89%** (`durataWorkout` addebitava 15 minuti fissi a round, `durataBlocco`
sommava gli esercizi: 75 minuti contro 8). Il carico si misurava perciò in due
modi, e ognuno andava confrontato **solo** con un paragone costruito allo stesso
modo:

- **`caricoPrevisto`** (il builder) misura con `stimaWorkout`, cioè con gli stessi
  strumenti delle due celle che gli stanno accanto: la quarta cella è il
  **prodotto** delle prime due, e un coach che moltiplica a mente ritrova il
  numero. Anche la media delle sue sedute passate è misurata così.
- **`caricoAssegnazione`** (il warning) misura con `durataWorkout` e con
  l'`rpeAtteso` di `statistiche.js`, cioè con gli **stessi due strumenti con cui
  `caricoDi` ha misurato lo storico** e con cui `scartoRpeDi` misura lo scarto.
  Un numeratore e un denominatore costruiti con stimatori diversi darebbero un
  rapporto sbagliato, e sbagliato **nella direzione pericolosa**: un workout
  pieno di For Time si proietterebbe quasi senza peso contro uno storico gonfiato
  dallo stesso tipo di blocco — direbbe «tranquillo» proprio dove non lo è.

✅ **Unificare i due stimatori era la correzione vera, ed è stata fatta il
09/09/2026** (§9-undetricies). ⚠️ Conseguenza da conoscere prima di leggere un
numero del modello: **i carichi sono saliti**, perché la durata è salita. Sullo
stesso Hyrox di prova `caricoPrevisto` passa da **≈211 a ≈516**. Le soglie del
modello (`rapportoCarico`, `acwrProiettato`) sono **rapporti**, quindi non si
spostano — numeratore e denominatore salgono insieme — ma il numero assoluto in
cima al builder sì, e va ritarato sull'occhio del coach.

### ⚠️ Le sette cose da sapere prima di rimetterci mano

1. 🔴 **L'ordine degli avvisi È la regola, e la PAUSA viene prima di tutto.**
   Chi ha chiesto di fermarsi ha la settimana vuota per definizione, quindi
   qualunque allenamento gli produce un salto di carico enorme: con il carico
   davanti gli si rimetterebbe addosso proprio l'allarme che la pausa esiste per
   togliere (§9-decies). **Trovato da un test, non leggendo il codice**: la prima
   stesura mostrava «Carico +112%» a un atleta in pausa. Poi il carico, il
   rientro, l'aderenza, l'accumulo sul giorno, il bias, l'occasione.
2. 🔴 **Il verde non si dichiara.** Chi non ha niente da segnalare non riceve
   nessuna riga: con dodici nomi in elenco, un «tutto ok» accanto a undici rende
   invisibile l'unico ambra. E **un solo motivo per riga**, il più grave
   (§9-vicies punto 4).
3. 🔴 **Dati insufficienti ≠ tutto bene.** Un atleta nuovo e un workout senza
   intensità dichiarata producono una riga **grigia** che dice *perché* il
   modello tace, mai un silenzio — che si leggerebbe come verde. È la sesta
   comparsa della regola di `rpeAtteso` (`null`, non 5).
4. 🔴 **Il cancello sta sullo storico VERO.** `acwrProiettato` non calcola niente
   se `stato.carico.acwr` è `null`. Non è ridondante rispetto a
   `rapportoCarico`: il carico proiettato renderebbe «attiva» anche la settimana
   bersaglio, e un atleta con quattro sedute in **una sola** settimana si
   vedrebbe assegnare un rapporto nato da un allenamento non ancora fatto. C'è un
   test che è l'unico a prenderlo.
5. **L'avviso NON blocca mai.** «Conferma» resta premibile. Un avviso che
   impedisce un gesto è un avviso che si impara a disattivare — e questo è
   costruito su una stima.
6. **La lettura in più è UNA e parte all'APERTURA DEL FOGLIO**, non della pagina:
   la scheda è la pagina più aperta dell'app e questi dati servono a un gesto che
   quasi sempre non si fa. Se fallisce, i semafori **non compaiono** e
   l'assegnazione funziona esattamente come prima — con una riga che lo dice.
   ⚠️ In `AthleteDetail` **non c'è nessuna lettura in più**: la pagina ha già lo
   storico per l'eroe «come sta andando», e lo passa al foglio come prop.
7. ⚠️ **`fetchAthletes` ora chiede anche `notes`**, che è dove vive la pausa
   (§9-decies). Toglierlo non darebbe nessun errore: la pausa smetterebbe
   semplicemente di vedersi. Il test lo verifica sulle **colonne chieste**,
   perché il finto Supabase non filtra le colonne e l'asserzione a schermo
   passerebbe lo stesso.

### 🔴 Le frasi degli avvisi NON hanno genere
Trovato guardando la pagina di anteprima, non leggendo il codice: la prima
stesura scriveva «**Fermo** da 10 giorni» e «**Per lui** un 9 vale ≈10» — e sul
dispositivo quelle righe stavano accanto ad Arianna e a Giulia. Metà degli
atleti sono donne, e questi avvisi compaiono sempre affiancati a un nome. Ora si
dice **che cosa è successo** e non chi l'ha fatto: «Nessun allenamento da 10
giorni», «Un 9 previsto vale ≈10», «Assegnare un allenamento è legittimo».
⚠️ Il test `nessun avviso è declinato al maschile` scandaglia **ogni ramo** con
una sola espressione regolare. Ci sono voluti due giri: la prima versione non
comprendeva il caso del **bias** nell'elenco, ed è proprio lì che era rimasto un
«lui lo sentirà intorno a 10».

### 🔴 Il difetto che solo la pagina a 393px ha mostrato
Con **quattro** celle ogni colonna scende a ~74px e «RPE ATTESO» va a capo,
mentre «DURATA» e «CARICO» no: i quattro numeri finiscono su due basi diverse e
la carta si legge come rotta. ⚠️ Accorciare l'etichetta a «RPE» è la soluzione
sbagliata — è proprio «atteso» a distinguerla da «Il tuo RPE» dichiarato
dall'atleta (§9-duodecies punto 2). Si riserva lo spazio di **due righe** a tutte
le etichette, e solo quando le celle sono quattro. È lo stesso genere di difetto
del conto alla rovescia del cestino (§9-septdecies punto 7): nessun test lo
avrebbe preso.

### Le mutazioni, che è il modo in cui questi test sono stati scritti
**24 mutazioni provate, 24 prese** — ma non al primo giro: cinque erano sfuggite,
e tutte e cinque per lo stesso motivo di sempre (§9-sexies). Le due che vale la
pena ricordare: «la collocazione confronta tutte le corsie» era invisibile perché
l'intruso era una **corsa**, che non ha blocchi e quindi nessun carico da
scartare; e «il giorno accanto si segnala sempre» chiedeva un allenamento
**morbido** accanto a uno duro, perché la guardia sta sul workout in arrivo e non
sul vicino.

### Cosa NON è stato fatto
Le **fasi 3 e 4** (previsto contro realizzato nel report, e il brief in cima al
builder) sono il pezzo successivo. Il **generatore dei blocchi** resta bloccato
dal #25: senza il *risultato* di una seduta produrrebbe programmazione plausibile
e cieca, che è ciò che il report esiste per evitare. I due fogli di assegnazione
**non sono stati ridisegnati**: il semaforo si innesta nelle righe che ci sono.

---

## 9-undetricies. Uno stimatore di durata solo (09/09/2026) — BACKLOG #40

Segnalazione del committente, guardando due screenshot del simulatore uno
accanto all'altro: lo **stesso** allenamento diceva **58 minuti** nella Home e
**24** nella scheda, a due tocchi di distanza. «Sistema la durata, deve dire 58
anche nella scheda.»

### Perché era invisibile
Non era un arrotondamento: erano **due formule diverse**, e nessuna delle due
era sbagliata presa da sola.

| | `durataWorkout` (statistiche.js) | `durataBlocco` (stimaWorkout.js) |
|---|---|---|
| chi la leggeva | Home, report, calendario (volume), `caricoAssegnazione` | scheda, builder, archivio, grafica da storia, `caricoPrevisto` |
| «For Time» | **15 min fissi × giri** | somma degli esercizi × giri |
| «Cash In/Out» | **5 min fissi × giri** | somma degli esercizi × giri + rest |
| su `hyroxCompleto` | 8 + 5 + 45 = **58** | 8:00 + 4:23 + 11:15 = **24** |

Il difetto si vedeva solo mettendo due schermate affiancate, ed è saltato fuori
esattamente così: preparando gli screenshot per l'App Store.

### 🔴 La direzione l'ha scelta il committente, ed è l'OPPOSTA di quella che il backlog proponeva
BACKLOG #40 proponeva «far leggere a `durataWorkout` la stima per esercizio e
tenere i 15 minuti come ripiego», cioè far vincere il **24**. È stata scartata,
e la ragione non è di codice: **sommare gli esercizi misura il tempo in cui
l'atleta si sta muovendo**, a ritmo di gara e con zero transizioni — non quello
che passa nel box. Su un «For Time» quel divario è di tre volte. Chi sa quanto
durano davvero le sedute è il coach, e il numero è 58.

### Com'è fatto adesso
- I due forfait vivono in **due costanti esportate** di `stimaWorkout.js`:
  `MINUTI_GIRO_FOR_TIME = 15` e `MINUTI_GIRO_CASH = 5`.
- `durataWorkout` **non ha più una formula propria** per i blocchi Hyrox: fa
  `for (const b of blocchiDi(s)) minuti += durataBlocco(b) / 60`.
- La **corsa resta in `statistiche.js`**: `stimaWorkout.js` conosce solo i
  blocchi Hyrox, e le fasi di corsa hanno un formato tutto loro.

La proprietà che si guadagna, e che con due formule era impossibile: **il totale
in cima alla scheda è la somma dei blocchi che la scheda stampa uno per uno**.
Un coach che li somma a mente ritrova il numero.

### ⚠️ Le quattro cose da sapere prima di rimetterci mano

1. 🔴 **Il forfait si applica solo a un blocco che CONTIENE qualcosa.** Un «For
   Time» ancora vuoto non dura 45 minuti: non è stimabile, e la scheda ci deve
   scrivere «—» invece di «0:00» (§9-undecies punto 2). **È una svista che ho
   commesso davvero**, e l'ha presa un test che esisteva già — «un blocco senza
   esercizi non inventa una durata»: con il forfait nudo, un Cash Out vuoto da
   due giri dichiarava 10 minuti.
2. 🔴 **Il prezzo è visibile in scheda, e va accettato consapevolmente:** un
   «For Time» dichiara 15 minuti a giro **qualunque cosa contenga**. Tre burpees
   e tre giri completi di Hyrox pesano uguale, e la barra proporzionale del
   riepilogo è quasi tutta sua (45 su 58). È il compromesso di una stima a
   forfait, ed è la ragione per cui l'interfaccia continua a scrivere «≈».
3. 🔴 **I carichi sono saliti con la durata.** `caricoPrevisto` è il prodotto
   durata × RPE: sullo stesso Hyrox passa da **≈211 a ≈516**. Le soglie del
   modello predittivo sono **rapporti** (`rapportoCarico`, `acwrProiettato`),
   quindi non si spostano — numeratore e denominatore salgono insieme — ma il
   numero assoluto del builder sì, e va ritarato sull'occhio del coach.
4. ⚠️ **`rpeAtteso` è ANCORA in due copie** (`statistiche.js` e
   `stimaWorkout.js`), e sono due calcoli diversi per le stesse parole: la Home
   parte da `sections.intensity` e ripiega su una tabella per tipo di blocco, il
   builder fa la media di potenza. Questa sessione ha unificato la **durata**,
   non l'RPE. Resta in BACKLOG.

### I test
Sette toccati, e due riscritti perché la regola che dichiaravano è cambiata:
- **«For Time moltiplica gli esercizi per i round»** → **«For Time è un forfait
  per giro, qualunque cosa contenga»**, con due asserzioni: la cifra, e il fatto
  che aggiungere 2000 m al blocco **non** la cambi. È la seconda a distinguere
  le due formule, ed è l'unica che cade su una mutazione «rimetti la somma».
- **«un blocco senza esercizi non inventa una durata»** → esteso al «For Time»,
  perché è il test che ha preso la svista del punto 1.
- Nuovo: **«il totale è la somma dei blocchi, non un secondo calcolo»**, che
  confronta `durataWorkout` con la somma di `durataBlocco` calcolata **nel
  test**. ⚠️ La mutazione che conta non è «ricopia le costanti» — quella dà gli
  stessi numeri e il test resta verde, correttamente — ma «ricopia le costanti
  **e poi cambiane una**», che è il modo reale in cui i due stimatori
  tornerebbero a divergere. Verificato: cade solo lì.
- Riallineati i numeri di `WorkoutDetailScheda` (34 → 37 min, carico 269 → 292):
  ⚠️ quel test protegge l'**invariante** — il carico è il prodotto delle due
  celle accanto — non la cifra.

---
