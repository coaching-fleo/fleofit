# Promemoria per chi non ha le notifiche — progetto breve

19/11/2026 · deciso con il committente in sessione.

## Perché
Oggi le notifiche si accendono solo dall'interruttore in Impostazioni: l'app non le chiede mai.
Chi non ci va non riceve niente, per sempre, e nessuno se ne accorge. L'atleta perde i workout
assegnati, il coach non sa quando un atleta ha completato.

## Cosa
Un **foglio dal basso** (scelta A) che invita ad attivare le notifiche, nel momento in cui servono,
a **atleti e coach**, con pause crescenti per non essere invadente.

- **Atleta** — compare quando apre la Home e ha almeno un workout assegnato.
  Testo (proposta): «Ti avviso quando il coach ti carica un allenamento, e la sera prima se domani
  ne hai uno».
- **Coach** — compare subito dopo aver assegnato un workout.
  Testo (proposta): «Ti avviso quando un atleta completa un allenamento o ti lascia una nota».
- Bottoni: **«Attiva»** e **«Non ora»**; dalla seconda volta anche **«Non chiedermelo più»**.

## Cadenza
- Pause dopo ogni «Non ora»: **3, 7, 14, 30, 60 giorni**, poi non si chiede più.
- «Non chiedermelo più» = mai più su quel telefono.
- Al massimo **una volta per apertura dell'app**; mai durante il timer, mai al primo accesso
  (consenso, invito).
- Se le notifiche risultano attive, il conteggio si azzera e il foglio non compare.

## Come si comporta «Attiva»
- Permesso mai chiesto → parte la richiesta del sistema (stesso percorso dell'interruttore in
  Impostazioni, `toggleNotifiche`, che salva anche il token).
- Permesso già negato → apre le Impostazioni del telefono con `LettoreQR.impostazioni()`, che esiste
  già su iOS e Android. Chiamata con `.catch`: un'app vecchia senza il plugin non deve rompersi.
  Al ritorno nell'app si ricontrolla il permesso e, se concesso, si registra il token.

## Vincoli
- **Solo app iPhone e Android**, non il sito (scelta di Claude: le notifiche del browser funzionano
  male, e su iPhone richiedono l'app sulla schermata Home).
- **Nessun dato nel database** (schema congelato): lo stato del promemoria sta sul telefono, in una
  chiave `pushfit_promemoria_notifiche` letta con `leggiJson`/`scriviJson`. Va aggiunta al §8 di
  CLAUDE.md.
- Codice nativo nuovo: nessuno. Arriva comunque agli Store solo con il prossimo aggiornamento.

## Approcci considerati
- **A. Foglio dal basso al momento giusto** — scelto: si vede poche volte e sempre quando ha senso.
- B. Card fissa in cima alla Home — scartata: dopo due giorni nessuno la guarda, e la Home coach è piena.
- C. Foglio + card — scartato: il doppio da tenere coerente e rischia di sembrare insistente.

## Lasciato a chi costruisce
- La logica della cadenza in un file puro (`src/lib/promemoriaNotifiche.js`) coperto da test.
- La forma del foglio segue i fogli esistenti (`useBottomSheet`, tasto indietro Android con «Non ora»
  che vale come chiusura: va verificato che `indietroAndroid.js` lo riconosca, altrimenti una X con
  `aria-label="Chiudi"`).
- I testi definitivi vanno confermati dal committente.
