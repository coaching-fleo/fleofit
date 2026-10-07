# La rubrica atleti

> Spostato da `CLAUDE.md` il 07/10/2026, **senza cambiare il testo**. I rimandi
> «§9-…» puntano a sezioni che ora stanno in altri file di questa cartella:
> si trovano con `grep -rn '^## 9-<nome>' docs/memoria`. L'indice è in `CLAUDE.md`.

## 9-septdecies. Il rework della rubrica atleti (31/08/2026)

Stesso progetto Claude Design degli altri sei schermi
(`4a238081-a3ee-4f59-ae34-100f29d55601`), artboard `Atleti.dc.html`, opzione
**1b**. Come per gli altri: **nessun campo di Supabase cambia forma**. Cambia il
JSX, cambia l'ordine, e la pagina fa **una lettura in più** — una sola — per
poter dire un numero.

### Il problema, in una riga
Era una rubrica, non uno strumento di lavoro. Ogni riga mostrava nome, peso,
altezza ed età: dati anagrafici, che si consultano una volta al mese. Il coach
apre questa schermata per sapere **chi sta seguendo il piano e chi si è
fermato**, e quella informazione non c'era — bisognava entrare in ogni scheda,
una per una. Chi era in pausa restava mescolato agli attivi, distinto da un chip
arancione, e la lista non era divisibile: con venti atleti si scorreva tutto per
trovare i tre fermi. Il cestino era un accordion in fondo alla pagina, con il
conteggio fra parentesi nel testo del bottone.

### Cosa c'è ora, nell'ordine in cui sta in pagina
1. **La testata appiccicata**, con «Atleti», la scala in monospazio
   («14 attivi · 2 in pausa») e la CTA «Nuovo». Sotto di essa la ricerca e i
   **chip di stato** — Attivi · In pausa · Eliminati, con il conteggio dentro —
   che restano fermi mentre la lista scorre. Niente «indietro»: è una voce
   della navbar, non una pagina in cui si è entrati.
2. **La fascia «Da richiamare»**, l'unico blocco con bordo colorato della
   pagina. Porta alla lista già filtrata, e un secondo tocco la richiude.
3. **«Settimana in corso»**, con le righe degli attivi: avatar, nome, meta
   anagrafico compresso in monospazio, e a destra **completati / assegnati**
   della settimana più una tacca per allenamento previsto — piena se fatto,
   vuota se manca.
4. **«In pausa»**, in fondo e senza peso visivo.

### ⚠️ Le sette cose da sapere prima di rimetterci mano

1. 🔴 **Gli atleti fermi NON si calcolano qui.** Li dà `atletiFermi` di
   `statisticheCoach.js`, la stessa funzione con la stessa `GIORNI_FERMO` che
   alimenta «Richiedono attenzione» nella Home coach — e anche il testo della
   fascia si compone da quella costante, invece di scrivere «7 giorni» a mano
   come faceva l'artboard. Due soglie darebbero due numeri diversi per lo stesso
   concetto in due schermate della stessa app, e **nessuno dei due sarebbe
   sbagliato da solo**: è il difetto impossibile da notare.
2. 🔴 **L'allarme della riga viene da `atletiFermi`, non dalla frazione.** Gli
   assegnati comprendono i giorni **ancora da venire** della settimana — il
   martedì, il workout di venerdì è già programmato e fa parte del piano —
   quindi il lunedì mattina sono tutti a 0/N. Legare il colore alla frazione
   dipingerebbe di arancione l'intera rubrica ogni lunedì: un allarme che si
   accende quando non è successo ancora niente.
   ⚠️ L'allarme sta anche nell'`aria-label` («· da richiamare»), non solo nel
   colore: chi legge con VoiceOver non ha modo di sapere che la frazione è
   arancione, ed è l'unica informazione della riga che chiede un'azione.
3. 🔴 **Chi non ha niente in programma scrive «—», non «0/0».** Un atleta senza
   assegnazioni non è a zero di aderenza: non c'è ancora niente da misurare, e
   «0/0» con la barra vuota si legge come un fallimento — cioè un allarme per
   qualcuno a cui il coach semplicemente non ha ancora dato niente. È la stessa
   regola di `DurataBlocco` («—» invece di «0:00») e di `rpeAtteso` (`null`
   invece di 5).
4. 🔴 **La settimana comincia di LUNEDÌ** (`weekStartsOn: 1`). Con il default di
   `date-fns` la **domenica** cadrebbe nella settimana successiva, e l'atleta si
   vedrebbe azzerare la frazione la sera della domenica — l'unico momento in cui
   il piano della settimana è finalmente completo. È anche la settimana con cui
   il coach programma e quella su cui la Home atleta disegna l'anello: due
   settimane diverse darebbero due «3 su 5» che non coincidono.
5. **Gli atleti in pausa RESTANO nella lista principale**, in una sezione loro
   sotto gli attivi. Non è una svista dei chip: CLAUDE.md §9-decies dice che la
   rubrica è **l'unico posto** in cui il coach si accorge di averne messo in
   pausa uno e dimenticato. Sparisce dagli allarmi, non dalla lista. Il chip
   «In pausa» serve a vedere solo loro.
6. **La riga in pausa dice DA QUANDO, mai «rientro previsto».** `[PAUSA: …]`
   registra il giorno in cui la pausa è cominciata; una data di rientro non
   esiste da nessuna parte nei dati, e l'artboard la disegna. Stamparla sarebbe
   un dato plausibile e inventato. Quando la data manca, `etichettaPausa` torna
   `null` e la seconda riga sparisce: la pillola accanto dice già «Pausa».
7. **Il conto alla rovescia del cestino è corto di proposito.** «Cancellazione
   fra 5 giorni», accanto al bottone Ripristina su 393px, finiva troncato in
   «Cancellazione fra 5…» — e il numero tagliato è l'unica cosa per cui si apre
   quella vista: «fra 1…» e «fra 10…» diventavano la stessa riga. Ora è
   «Fra 5 giorni» / «Stanotte», e cosa sia il conto lo dice l'intestazione
   della sezione. **Trovato guardando la pagina a 393px, non leggendo il
   codice**: nessun test lo avrebbe preso.

### Una query in meno, non una in più
La pagina faceva **due** `select` su `athletes` — una con `deleted_at is null`,
una con il filtro complementare — cioè due round trip per una lista di dodici
righe che si divide in due con un `filter`. Ora è una sola, più **una** su
`athlete_workouts` sulla finestra `[oggi − 45, fine settimana]`, senza join sui
`workouts`: qui non serve nemmeno un titolo, e `sections` è la colonna più
pesante del database. Quella finestra serve due domande insieme — chi è fermo
guarda indietro, l'aderenza guarda la settimana in corso, che finisce nel futuro.

⚠️ `caricatoIl` si fissa **quando i dati arrivano**, e da lì dipendono l'età,
la settimana in corso, chi è fermo e il conto alla rovescia del cestino: cioè
quasi tutta la pagina. `Date.now()` durante il render darebbe conteggi diversi a
due render consecutivi. Era già la correzione fatta il 26/08 sul solo cestino
(§9-septies); ora vale per tutto.

### Cosa NON è stato ridisegnato, e perché
La modale **«Nuovo Atleta»** è rimasta com'era: l'artboard non la copre, e il
suo `dv-next` la dà fra i prossimi pezzi di design. Vale la stessa scelta fatta
per le modali della scheda atleta e della scheda workout — la pagina è la
cornice, quelle sono i contenuti.
Non è stato implementato il **pannello dei filtri avanzati** né alcun bottone
che non faccia niente: stessa regola del badge numerico sulla navbar
(§9-quaterdecies).

### I file nuovi, e i due riusati
`src/lib/rigaAtleta.js` (logica pura, 33 test) e `src/components/AtletiUI.jsx`
(sola presentazione). Da `ArchivioUI` arrivano **`CampoRicerca`** — reso
parametrico su placeholder ed etichetta, con i default dell'archivio, così il
suo chiamante non cambia — e **`IntestazioneSezione`**, che si chiamava
`IntestazioneMese`: nell'archivio raggruppa per mese, nella rubrica per stato,
ed è la stessa riga in entrambi i casi. Una seconda copia sarebbe stata il modo
in cui le due cominciano a divergere di un raggio (§9 punto 1).

---
