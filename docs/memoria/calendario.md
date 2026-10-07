# Il calendario

> Spostato da `CLAUDE.md` il 07/10/2026, **senza cambiare il testo**. I rimandi
> «§9-…» puntano a sezioni che ora stanno in altri file di questa cartella:
> si trovano con `grep -rn '^## 9-<nome>' docs/memoria`. L'indice è in `CLAUDE.md`.

## 9-octodecies. Il rework del calendario (31/08/2026)

Stesso progetto Claude Design degli altri sette schermi
(`4a238081-a3ee-4f59-ae34-100f29d55601`), artboard `Calendario.dc.html`,
opzione **1b**. Come per gli altri: **nessun campo di Supabase cambia forma**.
Cambia il JSX, cambia l'ordine, e per la prima volta la pagina dice dei numeri
— con la cautela che quei numeri richiedono.

### Il problema, in una riga
La griglia occupava metà schermo e trasmetteva **un solo bit per giorno**: ci
sono pallini o non ce ne sono. Non distingueva il fatto dal programmato, non
diceva il carico, e i tre pallini da 6px si perdevano. Sopra di essa c'erano
due titoli (il logo `FLEOFIT` e il mese) e **cinque bottoni tutti uguali** —
precedente, Oggi, successivo, cerca, aggiungi — di cui l'unico irreversibile
era l'unico giallo, ma in fila con gli altri come se pesasse uguale. E le card
del giorno riempivano lo spazio con i **nomi degli esercizi** («Air Squat»,
«4 blocchi»), cioè con il contenuto — che è la ragione per cui si apre una
scheda, non quella per cui si decide di aprirla.

### Cosa c'è ora, nell'ordine in cui sta in pagina
1. **La testata**: l'anno nell'occhiello in mono, il mese in grande, e due soli
   comandi — cerca e aggiungi. Il logo è sparito: in una pagina raggiunta da
   una voce di navbar chiamata «Calendario» non dice niente.
2. **La carta del mese**, che tiene insieme navigazione, legenda, griglia e
   sintesi: prima erano quattro blocchi slegati sulla pagina nuda.
3. **Celle a due livelli**: il numero e, sotto, una barra-corsia colorata per
   categoria e verde se l'allenamento è chiuso. Il mese si legge come un
   pattern di carico invece che come puntini.
4. **La fascia di sintesi**: tre numeri che dicono com'è andato il mese prima
   di doverlo leggere giorno per giorno.
5. **Il giorno scelto**: la data, quante sessioni e quanti minuti, e le righe —
   con i dati della decisione (durata, blocchi, stato, RPE) invece dei nomi
   degli esercizi.

### ⚠️ Le sette cose da sapere prima di rimetterci mano

1. 🔴 **Le prime due celle della fascia misurano lo STESSO insieme.** Per
   l'atleta la coppia dice «14 di 18 fatti, 11 ore di lavoro» — e le ore sono
   quelle dei 14. Per il coach **non esiste nessun «fatto» nei suoi dati**: la
   sua query legge `workouts`, che non ha una colonna di stato, quindi un
   «Completati» per lui leggerebbe 0 su 18 per sempre. La sua coppia dice
   «18 programmati» e le ore di quei 18. `soloCompletati` è il parametro che
   tiene i due orizzonti allineati: due orizzonti sotto un'intestazione sola
   sarebbero la bugia peggiore della fascia, perché **nessuno dei due numeri
   sarebbe sbagliato preso da solo** (è la lezione di `andamento.js`,
   §9-terdecies punto 1).
2. 🔴 **Il volume dice `≈` quando ha dovuto lasciare fuori qualcosa, e `—`
   quando non c'è niente da misurare.** `minutiWorkout` torna **`null`, non
   zero**, su Custom, Evento e sulle corse misurate in **distanza**: «18 km»
   non ha minuti finché non si assume un passo, e assumerlo vorrebbe dire
   inventarlo. Se tornasse zero, quella corsa sparirebbe dentro un «11 h» che
   ha tutta l'aria di essere completo. Il `≈` è un glifo solo, ed è l'unico
   modo di dire «questo totale è parziale» in una cella larga quanto un numero.
3. 🔴 **«Oggi» e «selezionato» sono due stati distinti e devono restarlo.** Nel
   calendario di prima erano quasi lo stesso — un riempimento pieno contro un
   grigio appena più chiaro — e all'apertura il giorno corrente spariva sotto
   la selezione. Ora oggi è un **anello**, il selezionato il riempimento giallo
   con l'ombra: coesistono sulla stessa cella senza annullarsi.
   ⚠️ L'anello non è un colore di categoria, ed è deliberato: il **bianco è già
   la corsia «Gara»**, e usarlo come riempimento della barra renderebbe
   indistinguibili «oggi» e «oggi c'è una gara».
4. 🔴 **Il bordo ambra di una riga vuol dire «DA FARE», non «riga».** Legato al
   semplice «non è chiuso», la lista del coach diventava tutta ambra — un
   allenamento di corsa incorniciato di giallo, contro la Regola della Corsia —
   e con essa spariva l'unica cosa che quel bordo doveva distinguere. Dove
   nessuno stato esiste, nessuna riga si distingue: è la risposta giusta, non
   l'assenza di una risposta.
5. **La barra si ferma a `MASSIMO_SEGMENTI = 3`, il conteggio no.** Tre
   segmenti in una cella da 43px sono già schegge, ma il numero vero finisce
   nell'`aria-label`: senza, un giorno da cinque e uno da tre sarebbero la
   stessa cella anche per chi la barra non la vede affatto.
6. **Il velo verde vale per il giorno intero, quindi pretende `every`.** Con
   una sessione su due chiusa il giorno **non** è andato, e tingerlo di verde
   direbbe il contrario. Il singolo segmento resta verde da sé.
7. **La legenda si deriva dai dati**, come i chip dell'archivio (§9-sedecies
   punto 2): una voce «Gara» in un mese senza gare è la chiave di lettura di un
   colore che non compare in nessuna cella. Sotto le due voci non compare
   affatto — con un colore solo non c'è niente da distinguere. La regola è sui
   **dati e non sul ruolo**: un `isAtleta &&` in più sulla voce «Fatto» sarebbe
   ridondante, e un guardiano che nessun caso può giustificare è il modo in cui
   la regola vera smette di essere leggibile (§9-quinquies, sul controllo di
   bordo tolto da `faseMoveUp`).

### 🔴 `border-brand/20` accanto a `CARTA_RIGA` NON fa niente — e vale ovunque
Il difetto peggiore della sessione, e **lo screenshot non lo mostrava**.
`CARTA_RIGA` porta già `border border-white/[.07]`; affiancargli
`border-brand/20` non sovrascrive nulla, perché sono **due utility della stessa
specificità** e a decidere è l'ordine nel foglio di stile. La riga «da fare»
credeva di avere il contorno ambra e aveva quello neutro.

È esattamente la trappola che `stiliCard.js` annotava già **per il raggio**
(`rounded-2xl` contro `rounded-[22px]`, §9-sedecies), ripresentata identica su
un'altra proprietà. Da qui **`CARTA_RIGA_BASE`**: l'impasto — gradiente,
hairline chiara, ombra — **senza** il bordo, così il contorno lo dichiara il
chiamante una volta sola invece di provare a sovrascriverlo.
`CARTA_RIGA = CARTA_RIGA_BASE + border-white/[.07]`, quindi nessun chiamante
esistente cambia.

> ⚠️ **E il primo test era verde per il motivo sbagliato**, per la terza volta
> in questo progetto (§9-sexies). Verificava `toHaveClass('border-brand/25')`,
> che era vero — la classe c'era, semplicemente non vinceva. Il caso che prende
> il difetto è l'**assenza** del bordo neutro, non la presenza di quello ambra.
> Trovato leggendo lo stile **calcolato** nel browser, non il DOM e non il
> codice.

### Una lettura in più, e nessuna colonna
La query dell'atleta aggiunge **`notes`**: è lì che sta il marcatore
`[RPE: n/10]`, sull'assegnazione e non sul workout. Senza, la riga di un
allenamento chiuso non può dire com'è andato — e non lo direbbe nessun errore,
si limiterebbe a non mostrarlo mai.
⚠️ L'RPE si legge con **`rpeDichiarato`**, non con `parseNotesAndRpe`: il
secondo torna **5** quando il marcatore manca, ed è il valore giusto per il
cursore della modale ma un numero inventato per chiunque lo mostri come un
dato. È la stessa lezione di §9-octies, §9-undecies punto 3 e §9-terdecies
punto 2.

### `metaWorkout` ha un'opzione, e non una seconda copia
`metaWorkout(w, { giorno: false })`. Ogni riga del calendario sta già sotto
l'intestazione della propria data: ripeterla lì dentro toglierebbe larghezza —
su 393px — proprio ai blocchi e ai minuti, che sono l'unica cosa per cui si
guarda quella riga. È un'opzione e non una funzione nuova perché «come un
workout descrive sé stesso» deve restare un punto solo (§9 punto 1).

### Cosa NON è stato implementato, e perché
- **Il foglio del giorno come bottom sheet trascinabile.** L'analisi
  dell'artboard lo descrive come «un pannello che sale dal bordo inferiore», ma
  il render di 1b lo disegna come una sezione sotto la carta, e il `dv-next`
  dello stesso artboard lo dà fra i **prossimi** pezzi di design. Implementato
  com'è disegnato, non com'è raccontato.
- **La vista settimana con le ore**, per la stessa ragione: è il primo
  suggerimento del `dv-next`.
- La modale **«Nuovo Evento / Gara»** è rimasta com'era, come le modali della
  scheda atleta e della scheda workout: la pagina è la cornice, quelle sono i
  contenuti. ⚠️ Una cosa è cambiata: la data parte da quella **selezionata** e
  non da oggi — si apre quella modale dopo aver scelto un giorno, e ripartire
  da oggi obbligava a rifare la scelta appena fatta.

### Cosa è tornato, contro l'artboard
Il bottone **«Oggi»**, che l'artboard toglie insieme agli altri quattro.
Toglierlo del tutto è una regressione: da tre mesi avanti si torna al giorno
corrente in tre tocchi invece che in uno. Qui compare **solo quando il mese
mostrato non è quello corrente** — cioè esattamente quando serve, e senza
occupare posto nell'unico caso in cui non servirebbe a niente.

### I file nuovi
`src/lib/rigaCalendario.js` (logica pura, 35 test) e
`src/components/CalendarioUI.jsx` (sola presentazione), più `CARTA_RIGA_BASE`
in `lib/stiliCard.js`. Il vecchio `COLORI_PALLINI` — una tabella di colori
locale a `Calendar.jsx` che mescolava tipi di blocco e categorie — è sparito:
il colore di una sessione è quello della sua **corsia**, e viene da
`coloreCategoria` come ovunque (§9 punto 1).

---
