# Dev log — prossimo aggiornamento su App Store

Le modifiche fatte dopo la versione approvata il **29/09/2026** (build `1.1.0 (6)`, commit `8d9a398` del 21/09/2026).

---

## Allenamento e recap
- Dopo aver segnato un allenamento come fatto si apre un **recap in stile storie**: l'allenamento appena svolto, la settimana, l'andamento delle ultime otto settimane e il prossimo passo.
- Nuova domanda **«Ti è piaciuto?»** con 👍 / 👎 dopo ogni allenamento; il coach vede le risposte sulla scheda del workout.
- Corretti i **minuti della settimana** in Home: le ripetute in metri venivano contate come minuti.
- Corretto l'**RPE medio della settimana**: non conta più gli allenamenti in cui l'RPE non è stato segnato.
- Scrivendo la **nota** su un allenamento non ancora segnato come fatto, l'app chiede se l'hai completato: la nota si salva insieme al completamento.

## Creazione dei workout (coach)
- Nuovo **righello** per inserire ripetizioni, metri, chili e ritmi.
- Il **nome del workout è facoltativo**: se manca, ne viene proposto uno in gergo Hyrox/running, sempre diverso; il dado ne propone un altro.
- Ogni titolo porta un **codice** con struttura, durata e intensità del workout.
- **«Duplica» non sovrascrive più l'originale**; il bottone principale è «Salva come nuovo» e «Sovrascrivi» dice quanti atleti riguarda.
- Sovrascrivendo dalla scheda di un atleta non cambia più la data del workout per tutti.
- **Duplicando o salvando come nuovo**, la copia non è più assegnata agli atleti dell'originale e parte senza le note del coach.
- Tornando indietro dal secondo passo l'app chiede conferma se ci sono già blocchi.
- La barra in basso resta premibile con la tastiera aperta.
- Con la **generazione IA** ogni esercizio ha un'intensità, dettata o stimata.
- **«Genera con IA» ora modifica anche**: se ci sono già blocchi (fatti a mano o dall'IA) basta chiedere la modifica — «porta l'EMOM a 16 minuti», «togli il Cash Out» — e l'IA riscrive l'allenamento cambiando solo quello; la modifica si può annullare.
- I blocchi scritti dall'IA arrivano **tutti aperti**, pronti da rileggere.
- Nuovo **«Da un'immagine»** (iPhone e Android): si sceglie la foto di una lavagna, di un foglio o uno screenshot delle Note, e l'app legge il workout da sola, sul telefono e senza IA, e lo divide in blocchi o fasi di corsa. Prima di confermare mostra cosa ha capito riga per riga; il testo letto si può correggere, e quello che non capisce finisce nelle note. Su iPhone si può anche scattare la foto al momento (l'app chiede il permesso della fotocamera la prima volta).
- Da uno **screenshot** legge solo il workout: tastiera, orario e icone del telefono vengono ignorati. Una riga con la sola distanza («300m») prende l'esercizio di prima, e l'anteprima lo segnala.
- Un **blocco nuovo chiede subito i suoi numeri** (tempo, round…) e si aggiunge con un tasto di conferma.
- Un workout già svolto da un atleta **non si può più modificare**: si può duplicare.
- Negli **EMOM** un esercizio può durare **più minuti di fila** come stazione continua («minuti 2–3: vogatore»): il timer non riparte a metà.

## Archivio e atleti (coach)
- **Nuovi filtri per tipo di blocco** nell'archivio: ON/OFF, EMOM, AMRAP, For Time, Interval.
- **Filtri per esercizio Ski e Row** nell'archivio, anche in negativo: un tocco mostra i workout **con** lo ski, il secondo quelli **senza**, il terzo toglie il filtro.
- Tornando da un workout l'archivio **riprende dove l'avevi lasciato**; lo stesso vale per la lista atleti tornando da un atleta.

## Cerca con l'IA (coach)
- Nuova **ricerca con l'IA** in Home, a voce o scritta: atleti fermi, allenamenti non completati, RPE alti, gare in arrivo, note degli atleti, numeri di un atleta, workout da riusare. Sotto la risposta c'è l'elenco dei risultati, e ogni riga apre la sua scheda.
- Si può anche chiedere di **aprire una schermata** o di **creare un workout** per un atleta in una data.

## Calendario e gare
- **«Nuovo evento» sceglie la gara dal calendario HYROX ufficiale**: si cerca per città, si tocca la gara e nome e giorni si compilano da soli; per le gare di più giorni si sceglie il proprio. «Altro evento» resta il campo libero di prima.
- Dalla Home, **«Hai una gara in programma?»** apre la stessa scelta della gara: prima apriva l'allenamento libero, e la gara non compariva né nel calendario né nel conto alla rovescia.

## Segnala un problema
- Nuova voce **«Segnala un problema»** in Impostazioni: un modulo guidato con screenshot allegabili e bozza salvata, che arriva per email.

## Grafica e animazioni
- **Nuova animazione d'apertura** dell'app, senza più il lampo bianco all'avvio.
- Le schermate compaiono **a cascata**, i numeri importanti **salgono** fino al valore, i bottoni di salvataggio mostrano l'attesa.
- Tutte le **finestre di dialogo** hanno un'animazione d'entrata e la stessa grafica del resto dell'app.
- Nuovo carattere per date, codici e numeri.
- **Vibrazioni** su scelte, salvataggi, completamenti ed errori, e quando il coach ti richiama durante il timer.

## Stabilità
- App pronta per **iOS 27**.
- Corretti link, notifiche e note vocali in alcuni casi in cui potevano comportarsi in modo anomalo.

---

## Testo per App Store Connect — «Novità di questa versione» (1.2.0)

> Preparato il 09/10/2026 dall'elenco qui sopra, riscritto per chi legge lo Store.
> Limite di Apple: 4000 caratteri.

```
ALLENAMENTO
• Dopo ogni allenamento completato si apre un recap in stile storie: l'allenamento appena svolto, la tua settimana, l'andamento delle ultime otto settimane e il prossimo passo.
• Nuova domanda «Ti è piaciuto?» dopo ogni allenamento, per dare un riscontro al coach.
• Minuti e RPE medio della settimana ora sono calcolati correttamente.

PER IL COACH
• Nuovo righello per inserire ripetizioni, metri, chili e ritmi.
• Il nome del workout è facoltativo: ne viene proposto uno, e il dado ne suggerisce un altro. Ogni titolo porta un codice con struttura, durata e intensità.
• «Duplica» crea sempre una copia nuova e «Sovrascrivi» indica quanti atleti riguarda; un workout già svolto non si modifica più, si duplica.
• Con la generazione IA ogni esercizio ha la sua intensità.
• Archivio con filtri per tipo di blocco (ON/OFF, EMOM, AMRAP, For Time, Interval); archivio e lista atleti riprendono da dove li avevi lasciati.

SEGNALA UN PROBLEMA
• Nuova voce in Impostazioni per inviare una segnalazione o un'idea, anche con screenshot.

GRAFICA
• Nuova animazione d'apertura, schermate che compaiono a cascata, finestre di dialogo rinnovate e un nuovo carattere per date e numeri.
• Vibrazioni su scelte, salvataggi e completamenti.

STABILITÀ
• Pronta per iOS 27, e correzioni a link, notifiche e note vocali.
```
