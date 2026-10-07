# Il report settimanale del coach

> Spostato da `CLAUDE.md` il 07/10/2026, **senza cambiare il testo**. I rimandi
> «§9-…» puntano a sezioni che ora stanno in altri file di questa cartella:
> si trovano con `grep -rn '^## 9-<nome>' docs/memoria`. L'indice è in `CLAUDE.md`.

## 9-vicies. Il report settimanale del coach (01/09/2026)

Richiesta del committente: «favorire il più possibile la figura del coach», con un
report settimanale **visionabile unicamente dal coach**. È BACKLOG #27 («Coach
Copilot»), che l'analisi del 24/08 dava come l'unica delle tre idee di prodotto
senza blocchi — e infatti non richiede nessuna migrazione: **tutto il report esce
da due letture su tabelle esistenti**.

### Il problema, in una riga
L'app diceva al coach cosa succede **oggi** (la Home) e com'è andato **un** atleta
(la scheda). Non diceva mai com'è andata **la settimana della squadra**, che è la
domanda su cui si programma quella dopo: chi richiamare, chi scaricare, chi
caricare si ricavavano aprendo una scheda alla volta e tenendo a mente i numeri.

### Cosa c'è, nell'ordine in cui sta in pagina
1. **La testata** con il navigatore di settimana (indietro senza limiti, avanti
   fino a quella corrente e non oltre). ⚠️ La riga «Settimana 36 · 31 ago – 6 set»
   sta **sotto** i bottoni e non in mezzo: vedi le due trappole qui sotto.
2. **L'eroe**: l'aderenza della squadra, la barra, e **una frase** che dice cosa
   farne («Aderenza 63%, carico in salita. · 2 da richiamare · 2 da scaricare ·
   3 senza programma la prossima settimana»). È la sola cosa che si legge da
   lontano — Regola dell'Eroe Unico.
3. **Il bento dei tre numeri**: Volume, Carico, RPE medio, ognuno con lo scarto
   sulla settimana precedente **solo quando è confrontabile**.
4. **La fascia «Da fare adesso»**, l'unica cornice colorata della pagina, che
   filtra la lista con un tocco.
5. **Atleta per atleta**: verdetto, il perché, e i numeri su cui verificarlo.
6. **Mix della settimana** per corsia, derivato dai dati.
7. **Settimana prossima**: chi non ha ancora niente, con «Assegna» per riga e
   «Crea workout» — è l'unica sezione che guarda avanti.
8. **Cosa ti hanno detto** (note e vocali della settimana) e **In pausa**.

### 🔴 LE TRE REGOLE CHE TENGONO ONESTI QUESTI NUMERI
Sono in testa a `src/lib/reportSettimanale.js` e sono la ragione per cui quel file
esiste invece di essere quattro righe dentro la pagina.

1. **L'aderenza si misura sulla parte TRASCORSA della settimana.** È la trappola
   già documentata in `rigaAtleta.js`: gli assegnati comprendono i giorni ancora
   da venire, quindi **il lunedì mattina sono tutti a 0/5**. Un verdetto «aderenza
   bassa» legato alla frazione piena accenderebbe un allarme su tutta la squadra
   ogni lunedì, cioè quando non è successo ancora niente — e un allarme che si
   accende sempre smette di essere letto. Ciò che resta in programma si dichiara
   a parte (`daVenire`), e il verdetto di quel caso è **«Da iniziare»**, non
   «Senza programma»: quattro allenamenti da giovedì *sono* un programma.
2. **Il carico esclude le sessioni senza RPE dichiarato, e lo DICE.**
   `parseNotesAndRpe` torna 5 dove il marcatore manca, e quel 5 entrerebbe nel
   prodotto minuti × RPE come se fosse una misura (§9-octies). Si somma solo ciò
   che l'atleta ha davvero segnato, e il totale porta il **`≈`** — lo stesso
   glifo del volume nel calendario (§9-octodecies), per la stessa ragione.
3. **Nessun numero si inventa per riempire una cella.** Rapporto di carico e
   scarto RPE tornano `null` quando i dati sotto non bastano, ed è la pagina a
   scrivere «—». Stessa lezione di `rpeAtteso` e `rpeDichiarato`.

### I due numeri che l'app non aveva mai detto
- **Il rapporto acuto/cronico** (`carico 3,03×`): il carico della settimana
  diviso la media delle ultime quattro. Sopra 1,5 è un salto, sotto 0,8 uno
  scarico. ⚠️ Torna `null` sotto `MINIMO_SESSIONI_CARICO` sessioni **misurate** o
  con meno di due settimane attive: con due sole sessioni saltarne una dimezza il
  riferimento e raddoppia il numero, e un «2,1» costruito così manda a scaricare
  un atleta che sta benissimo. Un atleta appena arrivato ricadeva esattamente lì.
- **Lo scarto fra RPE atteso e dichiarato**: `sections.intensity` — l'intensità
  che il coach ha scritto — contro l'RPE che l'atleta ha segnato dopo. **Nessuna
  altra schermata mette i due numeri uno accanto all'altro**, ed è l'unico
  segnale che dica se la programmazione sta chiedendo più di quanto voleva.

### ⚠️ Le cose da sapere prima di rimetterci mano
1. 🔒 **La guardia sul ruolo sta in DUE punti**: il redirect e il `return` prima
   del fetch. Toglierne uno solo non cambia niente a schermo — e lascia passare
   una versione che rimanda alla Home **dopo** aver scaricato le assegnazioni di
   tutta la squadra sul dispositivo dell'atleta. C'è un test che conta le query.
   ⚠️ È una guardia **di interfaccia**, non di sicurezza: i dati sono già protetti
   dalle policy RLS, e un atleta che chiamasse l'API riceverebbe le sue righe.
2. **Le soglie NON si riscrivono qui.** `GIORNI_FERMO` viene da
   `statisticheCoach.js` (la stessa che alimenta «Richiedono attenzione» nella
   Home) e `SOGLIA_STABILE` da `andamento.js`. Due soglie per lo stesso concetto
   darebbero due numeri diversi in due schermate, e **nessuno dei due sarebbe
   sbagliato da solo**.
3. **Il confronto con la settimana precedente si mostra solo a settimana finita**
   (`delta.confrontabile`): su una in corso confronta tre giorni con sette, e un
   «−58%» al mercoledì è aritmetica giusta e informazione falsa.
4. **«Senza programma» non entra nella fascia delle azioni.** A quella condizione
   risponde la sezione «Settimana prossima», che dice anche come rimediare: due
   allarmi per lo stesso atleta con due risposte diverse sono il modo in cui un
   allarme smette di significare qualcosa.
5. **Una lettura fallita ha uno stato suo.** Senza, zero righe si leggono come
   «questa settimana non si è allenato nessuno»: un guasto travestito da dato, il
   difetto peggiore possibile per una pagina su cui si programma (§9-quater).
6. **Chi è in pausa esce da ogni numero e resta nell'elenco in fondo**, come
   nella rubrica: è l'unico posto in cui il coach si accorge di averne messo in
   pausa uno e dimenticato (§9-decies).

### 🔴 I due difetti che solo la pagina a 375px ha mostrato
Nessun test li avrebbe presi, ed è la stessa lezione del conto alla rovescia del
cestino (§9-septdecies punto 7).
1. **La riga della settimana era troncata**: fra quattro bottoni tondi le
   restavano centoquaranta pixel, e «31 ago – 6 set» diventava «31 ago – …» —
   spariva cioè la data, l'unica cosa che dice quale settimana si sta guardando.
   Ora sta su una riga sua, a tutta larghezza.
2. **La meta della riga troncava il moltiplicatore di carico**: «5/5 · 6h 15 ·
   RPE 9 · carico…», e quel numero è la ragione stessa per cui quella riga porta
   «Da scaricare» ed è in cima alla pagina. Ora va a capo invece di troncare.

### Cosa NON è stato fatto, e perché
- **Nessuna notifica push «è pronto il report»**: sarebbe una modalità nuova di
  `send-reminders`, cioè il **deploy di una Edge Function condivisa con la web
  app in produzione** (§1.1). Stessa ragione per cui «Manda promemoria» non
  esiste (§9-nonies). Voce in BACKLOG.
- **Nessun export PDF del report**: `jspdf` è appena uscito dal chunk della
  scheda (§9-noviesdecies) e rimetterlo qui in testa rifarebbe lo stesso danno su
  un'altra pagina. Se servirà, va importato su richiesta come là.
- **Nessuna generazione automatica della settimana successiva.** La sezione
  «Settimana prossima» dice **chi** e porta dove si assegna, ma non compone
  niente da sé: farlo richiede di sapere cosa un atleta ha già fatto in termini
  di *risultato*, non solo di *fatto/non fatto* — cioè BACKLOG #25, che è
  congelato perché serve una tabella. Un generatore che non guarda i risultati
  produrrebbe programmazione plausibile e cieca, che è esattamente ciò che questa
  pagina esiste per evitare.

---
