# Dev log — prossimo aggiornamento su App Store

Le modifiche fatte dopo la versione approvata il **29/09/2026** (build `1.1.0 (6)`, commit `8d9a398` del 21/09/2026).

---

## Allenamento e recap
- Dopo aver segnato un allenamento come fatto si apre un **recap in stile storie**: l'allenamento appena svolto, la settimana, l'andamento delle ultime otto settimane e il prossimo passo.
- Nuova domanda **«Ti è piaciuto?»** con 👍 / 👎 dopo ogni allenamento; il coach vede le risposte sulla scheda del workout.
- Corretti i **minuti della settimana** in Home: le ripetute in metri venivano contate come minuti.
- Corretto l'**RPE medio della settimana**: non conta più gli allenamenti in cui l'RPE non è stato segnato.

## Creazione dei workout (coach)
- Nuovo **righello** per inserire ripetizioni, metri, chili e ritmi.
- Il **nome del workout è facoltativo**: se manca, ne viene proposto uno in gergo Hyrox/running, sempre diverso; il dado ne propone un altro.
- Ogni titolo porta un **codice** con struttura, durata e intensità del workout.
- **«Duplica» non sovrascrive più l'originale**; il bottone principale è «Salva come nuovo» e «Sovrascrivi» dice quanti atleti riguarda.
- Sovrascrivendo dalla scheda di un atleta non cambia più la data del workout per tutti.
- Tornando indietro dal secondo passo l'app chiede conferma se ci sono già blocchi.
- La barra in basso resta premibile con la tastiera aperta.
- Con la **generazione IA** ogni esercizio ha un'intensità, dettata o stimata.
- Un workout già svolto da un atleta **non si può più modificare**: si può duplicare.

## Archivio e atleti (coach)
- **Nuovi filtri per tipo di blocco** nell'archivio: ON/OFF, EMOM, AMRAP, For Time, Interval.
- Tornando da un workout l'archivio **riprende dove l'avevi lasciato**; lo stesso vale per la lista atleti tornando da un atleta.

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
