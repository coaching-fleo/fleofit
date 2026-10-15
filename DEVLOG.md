# Dev log — prossimo aggiornamento su App Store

Le modifiche fatte dopo la versione **1.2.0**, in vendita sullo Store: build `1.2.0 (3)`, archiviata il
09/10/2026 alle 10:40 dal commit `799b119`. Il prossimo aggiornamento è la **1.2.1**.

> ⚠️ Fino al 14/10/2026 questo file contava dalla 1.1.0 e credeva la 1.2.0 mai caricata: era
> stata caricata e approvata. Le voci già uscite con la 1.2.0 stanno in fondo, per storia.

---

## Allenamento
- Nuovo **«Come stai oggi?»**: prima di allenarsi, una volta al giorno, quattro risposte da 1 a 5 (sonno, energia, dolori, stress). Si può saltare e non blocca mai il timer; il coach vede le risposte sulla scheda dell'allenamento e nella pagina Analisi.
- Scrivendo la **nota** su un allenamento non ancora segnato come fatto, l'app chiede se l'hai completato: la nota si salva insieme al completamento.

## Creazione dei workout (coach)
- **Duplicando o salvando come nuovo**, la copia non è più assegnata agli atleti dell'originale e parte senza le note del coach.
- **«Genera con IA» ora modifica anche**: se ci sono già blocchi (fatti a mano o dall'IA) basta chiedere la modifica — «porta l'EMOM a 16 minuti», «togli il Cash Out» — e l'IA riscrive l'allenamento cambiando solo quello; la modifica si può annullare.
- I blocchi scritti dall'IA arrivano **tutti aperti**, pronti da rileggere.
- **«Genera con IA» anche sulla Corsa e su Custom**: sulla corsa l'IA scrive le fasi (riscaldamento, ripetute con recupero, passi e zone), su Custom la descrizione per l'atleta. Anche qui, se c'è già qualcosa, la richiesta diventa una modifica annullabile.
- Nuovo **«Da un'immagine»** (iPhone e Android): si sceglie la foto di una lavagna, di un foglio o uno screenshot delle Note, e l'app legge il workout da sola, sul telefono e senza IA, e lo divide in blocchi o fasi di corsa. Prima di confermare mostra cosa ha capito riga per riga; il testo letto si può correggere, e quello che non capisce finisce nelle note. Su iPhone si può anche scattare la foto al momento (l'app chiede il permesso della fotocamera la prima volta).
- Da uno **screenshot** legge solo il workout: tastiera, orario e icone del telefono vengono ignorati. Una riga con la sola distanza («300m») prende l'esercizio di prima, e l'anteprima lo segnala.
- Un **blocco nuovo chiede subito i suoi numeri** (tempo, round…) e si aggiunge con un tasto di conferma.
- Un workout già svolto da un atleta **non si può più modificare**: si può duplicare.
- **Tutto si cambia da dentro**: esercizio, tipo di blocco, tipo di fase della corsa e fase della Gym si cambiano aprendoli, senza eliminare e rifare.
- Negli **EMOM** un esercizio può durare **più minuti di fila** come stazione continua («minuti 2–3: vogatore»): il timer non riparte a metà.
- Nuova categoria **Gym** per le schede da palestra: oltre 170 esercizi e macchinari generici divisi per gruppo muscolare, serie × ripetizioni × carico × recupero, intervalli di ripetizioni («8–12»), RIR e cadenza, superserie e circuiti, riscaldamento e defaticamento, e se serve le serie una per una (piramidale, riscaldamento, drop set, cedimento). Anche qui c'è «Genera con IA». L'atleta spunta le serie e a ogni spunta parte il **timer di recupero**.

## Archivio (coach)
- **Filtri per esercizio Ski e Row** nell'archivio, anche in negativo: un tocco mostra i workout **con** lo ski, il secondo quelli **senza**, il terzo toglie il filtro.

## Cerca con l'IA (coach)
- Nuova **ricerca con l'IA** in Home, a voce o scritta: atleti fermi, allenamenti non completati, RPE alti, gare in arrivo, note degli atleti, numeri di un atleta, workout da riusare. Sotto la risposta c'è l'elenco dei risultati, e ogni riga apre la sua scheda.
- Si può anche chiedere di **aprire una schermata** o di **creare un workout** per un atleta in una data.

## Calendario e gare
- **«Nuovo evento» sceglie la gara dal calendario HYROX ufficiale**: a tutto schermo, una card per gara con foto, città, bandiera e paese; si cerca per città o paese e si filtra per regione del mondo. Toccata la gara, nome e giorni si compilano da soli; per le gare di più giorni si sceglie il proprio. «Altro evento» resta il campo libero di prima.
- **Dopo una gara HYROX l'app trova da sola il tuo tempo ufficiale**: dal giorno dopo, la Home chiede «Com'è andata?» e la scheda della gara mostra tempo, categoria, posizioni, corsa, Roxzone e split. Scelta la propria riga e confermato, si salva fra i record personali e la gara risulta fatta. Il tempo si può anche scrivere a mano.
- **I tempi delle gare HYROX già corse**: dal calendario, «Nuovo evento» → «Già corsa», si sceglie una gara da tutte le stagioni dal 2018 e, indicato il giorno, la gara entra nel calendario e nei record.
- **La scheda della gara mostra le statistiche**: tempo, posizioni, corsa, stazioni, Roxzone, la stazione migliore e quella dove hai perso di più, e tutti gli split. Per le gare salvate prima, «Aggiungi le statistiche della gara».
- Corretto: aprendo un allenamento dal **calendario** o dall'archivio l'atleta non vedeva le sue note, l'RPE né il tempo di gara.
- Sulla scheda della gara non compare più «Allenamento completato · RPE non indicato», e le note mostrano solo quello che scrive l'atleta: tempo e link al risultato ufficiale stanno nella card della gara.
- Nel calendario **la gara resta bianca** anche quando è segnata come fatta.
- Tornando indietro da un allenamento, **il calendario resta sul mese e sul giorno** da cui lo si era aperto.
- La ricerca del tempo usa **solo il cognome** e mostra la lista di chi l'ha, **coppie dei Doubles comprese**: tocchi la tua riga, vedi tempo e split, e confermi.
- Dalla Home, **«Hai una gara in programma?»** apre la stessa scelta della gara: prima apriva l'allenamento libero, e la gara non compariva né nel calendario né nel conto alla rovescia.

## Accesso
- Chi è entrato con **Apple** può scegliere una password da **Impostazioni → «Password per il sito»**, senza che gli si chieda quella attuale (che non ha): così entra anche dal sito, dove Apple non c'è, con l'indirizzo mostrato nel foglio.

---

## Messaggio a tutti (1.2.2)
- Nuova bacheca **«Dal coach»**: il coach scrive un messaggio a tutti gli atleti (con notifica), può fissarlo, correggerlo ed eliminarlo. L'atleta lo trova in Home, anche al primo giorno, e in una pagina Messaggi; toccando la notifica si apre il messaggio evidenziato.
- Chi si iscrive vede i messaggi fissati e quelli scritti da quando è iscritto.
- Il coach può rimandare la notifica di un messaggio dal suo menu («Manda la notifica»): chi l'ha già ricevuta non la riceve due volte. Gli altri account coach non ricevono il messaggio a tutti.
- Chi ha ancora la 1.2.1 riceve la notifica ma, nel centro notifiche, legge solo le prime due righe del messaggio.
- ⏳ Serve prima il sì alla nuova tabella e la pubblicazione di `send-reminders` (BACKLOG): **prima di allora niente `app:main` e niente archive della 1.2.2**.

## Testo per App Store Connect — «Novità di questa versione» (1.2.1)

> Scritto il 14/10/2026: solo ciò che non era nella 1.2.0. Limite di Apple: 4000 caratteri.

```
• Nuova categoria Gym per le schede da palestra.
• «Come stai oggi?» prima di ogni allenamento.
• Gare HYROX dal calendario ufficiale, con il tuo tempo e gli split dopo la gara.
• Per il coach: «Genera con IA» su ogni categoria e workout da una foto.
• Correzioni e miglioramenti.
```

---

## Già uscite con la 1.2.0 (09/10/2026)

- Dopo aver segnato un allenamento come fatto si apre un **recap in stile storie**: l'allenamento appena svolto, la settimana, l'andamento delle ultime otto settimane e il prossimo passo.
- Nuova domanda **«Ti è piaciuto?»** con 👍 / 👎 dopo ogni allenamento; il coach vede le risposte sulla scheda del workout.
- Corretti i **minuti della settimana** in Home: le ripetute in metri venivano contate come minuti.
- Corretto l'**RPE medio della settimana**: non conta più gli allenamenti in cui l'RPE non è stato segnato.
- Nuovo **righello** per inserire ripetizioni, metri, chili e ritmi.
- Il **nome del workout è facoltativo**: se manca, ne viene proposto uno in gergo Hyrox/running, sempre diverso; il dado ne propone un altro.
- Ogni titolo porta un **codice** con struttura, durata e intensità del workout.
- **«Duplica» non sovrascrive più l'originale**; il bottone principale è «Salva come nuovo» e «Sovrascrivi» dice quanti atleti riguarda.
- Sovrascrivendo dalla scheda di un atleta non cambia più la data del workout per tutti.
- Tornando indietro dal secondo passo l'app chiede conferma se ci sono già blocchi.
- La barra in basso resta premibile con la tastiera aperta.
- Con la **generazione IA** ogni esercizio ha un'intensità, dettata o stimata.
- **Nuovi filtri per tipo di blocco** nell'archivio: ON/OFF, EMOM, AMRAP, For Time, Interval.
- Tornando da un workout l'archivio **riprende dove l'avevi lasciato**; lo stesso vale per la lista atleti tornando da un atleta.
- Nuova voce **«Segnala un problema»** in Impostazioni: un modulo guidato con screenshot allegabili e bozza salvata, che arriva per email.
- **Nuova animazione d'apertura** dell'app, senza più il lampo bianco all'avvio.
- Le schermate compaiono **a cascata**, i numeri importanti **salgono** fino al valore, i bottoni di salvataggio mostrano l'attesa.
- Tutte le **finestre di dialogo** hanno un'animazione d'entrata e la stessa grafica del resto dell'app.
- Nuovo carattere per date, codici e numeri.
- **Vibrazioni** su scelte, salvataggi, completamenti ed errori, e quando il coach ti richiama durante il timer.
- App pronta per **iOS 27**.
- Corretti link, notifiche e note vocali in alcuni casi in cui potevano comportarsi in modo anomalo.
