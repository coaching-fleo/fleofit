# La scheda atleta

> Spostato da `CLAUDE.md` il 07/10/2026, **senza cambiare il testo**. I rimandi
> «§9-…» puntano a sezioni che ora stanno in altri file di questa cartella:
> si trovano con `grep -rn '^## 9-<nome>' docs/memoria`. L'indice è in `CLAUDE.md`.

## 9-terdecies. Il rework della scheda atleta (28/08/2026)

Stesso progetto Claude Design degli altri quattro schermi
(`4a238081-a3ee-4f59-ae34-100f29d55601`), artboard `Scheda Atleta.dc.html`,
opzioni **5b** (coach) e **5c** (atleta, storico aperto). Come per gli altri
la logica non è stata riscritta: **nessun campo di Supabase cambia forma**,
gli stessi calcoli, le stesse note, lo stesso completamento con RPE. Cambia il
JSX e cambia l'ordine.

### Il problema, in una riga
La pagina apriva con il logo, poi una foto da 96px con quattro celle di
anagrafica, poi tre celle di settimana, poi tre tab — e il dato per cui il
coach entra qui, *sta seguendo il programma e con quanto carico*, era nella
**terza** tab, dietro due tocchi e quattro grafici che non si parlavano.

### Cosa c'è ora, nell'ordine in cui sta in pagina
1. **La testata**, con il solo menu delle tre puntine. ⚠️ Niente «indietro» sul
   proprio profilo: `/profile` è una voce della navbar, non una pagina in cui
   si è entrati da qualche parte. `TestataScheda` accetta perciò un
   `onIndietro` mancante — non è una svista del chiamante.
2. **L'identità**: foto a 56px, nome, i due social come icone da 15px accanto
   al nome, e l'anagrafica in **una riga** («29 anni · 178 cm · 74 kg · 96
   workout»). I campi vuoti spariscono invece di stampare «N/A»: una cella che
   dice «non lo so» occupava lo stesso spazio di una che dice qualcosa.
3. **L'eroe «come sta andando · 30 giorni»**: aderenza nell'anello, carico
   delle ultime quattro settimane accanto, e sotto **una frase** che dice a
   parole cosa dicono i due numeri insieme. È la frase su cui si decide se
   caricare o scaricare, ed è l'unica ragione per cui i due grafici stanno
   nella stessa card invece che uno sotto l'altro.
4. **Il bento**: Volume (minuti della settimana, scarto sulla precedente,
   sparkline a 4 settimane) e Sforzo (RPE medio, distribuzione sulle quattro
   fasce, quanti da 7 in su).
5. **Prossimo obiettivo**, che era un banner alto quanto una card, in una riga.
6. **Oggi**, **Prossimi allenamenti**, poi **Storico** e **Personal record**
   come righe che si aprono in pagina.
7. **La barra fissa** con Assegna e Crea — solo per il coach.

### ⚠️ Le sei cose da sapere prima di rimetterci mano

1. 🔴 **La finestra è la ragione per cui `src/lib/andamento.js` esiste.**
   `calcolaStatistiche` misura le settimane sulle ultime quattro e la
   distribuzione RPE su **tutto lo storico**: due orizzonti diversi sotto
   un'intestazione sola («30 giorni») sarebbero la bugia peggiore della pagina,
   perché **nessuno dei due numeri è sbagliato preso da solo**. `andamento.js`
   ricalcola lo sforzo sulla finestra dichiarata, e c'è un test che lo prende.
2. 🔴 **L'RPE medio viene da `rpeDichiarato`, non da `parseNotesAndRpe`.**
   Il secondo torna **5** quando il marcatore manca — giusto per il cursore
   della modale, un numero inventato per chiunque lo mostri come un dato. Un
   atleta che non compila mai l'RPE leggerebbe «5,0» come la propria media. È
   la stessa lezione di §9-octies e di §9-undecies punto 3.
3. **Il denominatore dell'anello sono gli ASSEGNATI dei 30 giorni**, non i
   workout in pagina. Contare anche quello programmato per dopodomani farebbe
   scendere l'aderenza di ogni atleta ogni volta che il coach gli programma
   qualcosa: un numero che peggiora quando si lavora meglio.
4. **Lo scarto del carico torna `null` quando la settimana prima è vuota.**
   `(5-0)/0` è la strada più breve per stampare «+Infinity%» in pagina, e una
   card che dice Infinity si legge come un guasto dell'app.
5. **«Prossimi allenamenti» NON è nell'artboard, e resta lo stesso.**
   L'artboard disegna una giornata e si ferma a «Oggi». Toglierli vorrebbe dire
   che il coach non vede più cos'ha assegnato senza aprire il calendario, e che
   l'atleta non sa cosa lo aspetta domani. C'è un test.
6. **La pillola «In pausa» resta nascosta all'atleta**, e il marcatore non si
   vede mai come testo: valgono parola per parola le regole di §9-decies. La
   pagina è ancora `/profile`.

### Cosa è uscito, e cosa NON è stato ridisegnato
Le **tre tab** («Diario», «Personal Record», «Statistiche») e le quattro celle
di anagrafica. Nessun dato è andato perso: i quattro grafici della tab
Statistiche sono l'anello, le barre del carico, lo sparkline del volume e la
barra delle fasce RPE. Il **calendario** (solo coach) è dentro «Storico
allenamenti», con il toggle Elenco/Calendario dov'era.

**Non** sono stati ridisegnati `WorkoutEntryCard` e `TodayAthleteWorkoutCard`:
l'artboard disegna righe compatte, ma quelle card portano la modifica della
nota, la nota vocale, l'eliminazione e il completamento con RPE. Sono il
prossimo pezzo di design, non un dettaglio di questo. Idem per le modali
(assegnazione, PR, modifica profilo, allenamento libero).

### Il codice morto che il rework ha lasciato indietro, ed è stato rimosso
`AthleteStatsTab`, `RpeBar` e `StatCard` in `AthleteDetail.jsx`, e
**`statisticheSettimana` in `src/lib/statistiche.js`** con i suoi test: la riga
di tre numeri che alimentava non esiste più, e `settimane.at(-1).time` è
esattamente lo stesso calcolo. Due sorgenti per un numero solo sono il modo in
cui i due si mettono a divergere (§9 punto 1). Il caso che valeva davvero — le
distanze contate come stima e non come minuti — è stato riscritto contro
`calcolaStatistiche`, non buttato.

### ⚠️ `montaPagina` ora accetta una rotta, e serviva
`montaPagina(elemento, { percorso, rotta })`. Senza, `useParams()` torna vuoto,
`AthleteDetail` ricade sull'id dell'utente loggato e **si crede sul proprio
profilo anche montata come coach**: niente barra fissa, niente «Come sta
andando» in terza persona. Un test così passa lo stesso, e verifica un'altra
pagina — §9-sexies, per l'ennesima volta.

---


## 9-dalle-note. «Dalle note»: le note dell'atleta diventano dati (09/10/2026)

Spec: `docs/superpowers/specs/2026-10-09-dati-dalle-note-design.md` · piano:
`docs/superpowers/plans/2026-10-09-dati-dalle-note.md`.

### Il problema, in una riga
Il coach decideva su fatto/non fatto e RPE. Tempi, carichi, «troppo dura»,
«burpees saltati», «settimana pesante al lavoro» stavano nel testo libero delle
note, e per saperli bisognava rileggerle una per una.

### Cosa c'è ora
Sotto il bento, **solo per il coach**, la sezione «Dalle note» con la finestra
30/90/365 giorni (di partenza 90), una riga di copertura («38 note analizzate su
41 · 3 in analisi») e tre card: **Risultati** (una linea per esercizio + misura,
solo da 2 valori), **Sensazioni** (difficoltà per settimana e «Modificati più
spesso», con le citazioni che aprono il workout), **Stato** (stanchezza,
motivazione, viaggio, lavoro, con una tacca sui giorni a RPE ≥ 8).

| Pezzo | Dove |
|---|---|
| Le regole (cosa è un dato e cosa no) | `supabase/functions/estrai-note/regole.ts` |
| L'estrazione, solo admin e solo Groq | Edge Function `estrai-note` |
| Dove si salvano | tabella `note_estratte` — ⚠️ **scritta e NON applicata** (`supabase/schema/note_estratte_2026-10-09.sql`) |
| La lettura e la chiamata | `src/lib/noteEstratte.js` |
| I conti dei grafici | `src/lib/dalleNote.js` |
| La grafica | `src/components/DalleNoteUI.jsx`, caricata pigra da `AthleteDetail` |

### ⚠️ Le cose da sapere prima di rimetterci mano
1. 🔴 **L'IA non è una fonte.** Ogni voce passa da `validaEstrazione`: la
   citazione deve stare nella nota, il numero lo calcola la funzione da `grezzo`
   (come l'atleta l'ha scritto) e `grezzo` deve stare nella citazione. Il
   `valore` che manda l'IA si ignora.
2. 🔴 **Niente dati di salute nello standard v1**: dolori, sonno, stress,
   malattia, ciclo, alimentazione sono fuori per decisione del 09/10 (privacy
   Apple e IA). L'IA riceve comunque il testo intero: per questo `estrai-note`
   usa **solo Groq**, senza riserva Gemini, e all'IA arriva una nota anonima
   (testo ed esercizi, niente id, nome, data).
3. **Un estratto vale finché la nota è quella.** `estrattiValidi` confronta
   l'impronta (FNV-1a del testo ripulito) con la nota di adesso: una nota
   corretta dall'atleta torna «in analisi». `testoPulito` e `impronta` sono UNA
   copia, importata dall'app dal file del server.
4. **L'analisi parte all'apertura della scheda**, una volta, e solo se qualche
   nota aspetta: al massimo 3 gruppi da 15 note per apertura. L'effetto NON
   dipende da `workouts`, di proposito: completare un workout dalla scheda non
   deve far ripartire l'IA.
5. **Per tempo e passo l'asse del grafico è rovesciato**: un miglioramento sale
   sempre. Alla prima prova sul telefono la linea di Elena (0:58 → 0:50) scendeva
   e si leggeva «peggio».
6. 🔴 **Si analizza ogni nota con del testo, QUALUNQUE sia lo stato
   dell'assegnazione** (dal 09/10, sera). La prima versione leggeva solo i
   completati, e alla prima prova su dati veri un atleta con le note risultava
   «senza note in questo periodo»: tutte le sue note stavano su assegnazioni
   `pending`. Succede perché nella scheda workout l'atleta può salvare la nota
   senza chiudere l'allenamento (`salvaNoteAtleta`), e perché riportare un
   allenamento a «da fare» non cancella la nota. La regola è in due punti che
   devono restare uguali: `daAnalizzare` in `regole.ts` e `conTesto` in
   `dalleNote.js`.
7. 🔴 **Le sensazioni sono su DUE livelli** (dal 09/10, `VERSIONE = 3`): la
   **seduta** (il giudizio sull'allenamento intero, con TUTTE le citazioni che lo
   motivano) e le **parti** (il giudizio su un blocco o un esercizio: «cash out
   troppo facile»). Nasce da una nota vera — quasi-svenimento, dolore lombare,
   «finale molto facile il cash out» — che con un solo giudizio per nota era
   diventata «seduta troppo facile».
   - Prima correzione, sbagliata e tolta lo stesso giorno: un filtro a parole
     chiave che scartava ogni giudizio che nominava un blocco. Buttava via anche
     giudizi buoni («AMRAP durissimo» in un workout fatto solo di AMRAP). La
     lettura la fa l'IA, che pesa tutta la nota; il codice controlla solo che
     non inventi (citazioni presenti, parte nominata nella sua citazione).
   - **Decisione del 09/10 (scelta A)**: i segnali di salute possono motivare il
     giudizio sulla seduta ed essere CITATI («sentivo di svenire»), ma non
     diventano mai una categoria né un grafico (BACKLOG #67). La nota intera è
     già visibile al coach: la citazione non aggiunge esposizione.
   - La card mostra «Ultime sedute» (giudizio + citazioni) e «Per blocco»
     (`partiFrequenti`: «Cash out · troppo facile 2 su 3»).
   - **Prima di toccare le istruzioni all'IA**: `tools/prova-estrai-note/prova.mjs`
     le prova su 10 note inventate (`GROQ_API_KEY=... node tools/prova-estrai-note/prova.mjs`).
     Mai metterci note vere.
8. **Nell'ambiente di prova gli estratti nascono nei semi** (`PROPOSTE_DEMO` in
   `src/demoSemi.js`), passati dalla stessa `validaEstrazione`: Elena (tempi sulle
   wall balls), Giulia (sensazioni e burpees saltati), Luca (stanchezza). Una nota
   scritta durante la demo resta «in analisi»: lì non c'è IA.
