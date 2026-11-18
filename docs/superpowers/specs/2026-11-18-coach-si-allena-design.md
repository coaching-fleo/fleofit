# Il coach si allena anche lui — disegno (18/11/2026)

## Perché
Il committente vuole che il coach usi PUSHFIT anche per i propri allenamenti: si assegna un
workout, lo trova subito, lo fa con il timer, lo segna come fatto, e collega il suo Garmin
come un atleta.

## Cosa c'è già (verificato il 18/11/2026)
- 6 account su 8 dello `staff` hanno una riga in `athletes`; `federico_leo@hotmail.it` ha già
  15 allenamenti assegnati a sé stesso.
- Le policy di `athlete_workouts`, `garmin_attivita`, `garmin_giornate`, `garmin_invii` e
  `stato_garmin` ammettono già `auth.uid() = athlete_id`. **Nessuna migrazione.**
- `escludiDallaRubrica` toglie solo `COACHING_ID`: il coach compare già nella rubrica e nel
  foglio «Assegna Workout».
- `WorkoutDetail` con `athlete_id` = sé stesso (`isOwnProfile`) mostra già timer e «Fatto».
- Garmin è bloccato apposta per lo staff: riga in Impostazioni solo con `atletaVero`,
  `garmin-auth` e `garmin-training` (azione `invia_workout`) rispondono 403 a `ruoloStaff`.

## Scelte del committente
- **Card «Il tuo allenamento» nella Home del coach** + **«Tu»** nelle liste (scelta fra card,
  voce in Libreria, niente di nuovo).
- **La card legge da sola** (strada 1): una lettura sua, non i conti del cruscotto. Scartata
  la strada 2 (riusare `piano` del cruscotto): pigro, 14 giorni, da fare due volte.

## Il disegno
1. **Card in Home coach** — in `Home.jsx`, sotto la testata, per tutte le Home del coach
   (Riepilogo e classica, telefono e desktop). Legge `athlete_workouts` con
   `athlete_id = user.id`: l'allenamento di oggi (anche fatto, con la spunta) altrimenti il
   prossimo non completato da oggi in avanti. Niente → la card non c'è. Tocco →
   `/workout/<id>?athlete_id=<me>`. Logica di scelta pura in `src/lib/mioAllenamento.js`, con test.
   Non compare per l'atleta né in «Simula atleta» (lì c'è già la Home atleta).
2. **«Tu»** — nella lista Atleti e nel foglio «Assegna Workout» chi guarda va in cima con
   l'etichetta «Tu» (funzione pura che ordina, testata).
3. **Scheda workout sua** — le cose personali che oggi vogliono `role === 'athlete'` valgono
   anche con `isOwnProfile`: scarpe del completamento, risultato della sfida team, attesa dei
   dati Garmin prima del recap. **Restano solo per l'atleta** gli avvisi al coach (completato,
   spostato, nota): arriverebbero a sé stesso.
4. **Garmin** — in Impostazioni la riga compare anche allo staff che ha la riga `athletes`
   (non in «Simula atleta»: sarebbe comunque il suo account, ma lì l'interruttore resta
   dell'atleta vero come oggi). In `garmin-auth` e `garmin-training` si toglie il rifiuto allo
   staff; resta il controllo che chi collega abbia una riga `athletes` (senza: 403 chiaro).
   Il deploy delle due funzioni si fa **solo dopo un sì del committente**.

## Fuori
- I due account dello staff senza riga `athletes` (non vedono card, «Tu» né Garmin).
- Nessuna modifica di schema o policy.
- Entra nella 1.2.5 solo se lo decide il committente (la parte di app vale dal prossimo
  aggiornamento; il web subito dopo `app:main`).

## Anti-obiettivi
- Nessuna regressione per gli atleti: i loro rami non cambiano.
- Il coach non deve ricevere notifiche «da sé stesso».

## Lasciato a chi costruisce
Aspetto della card (seguire `CARD` di `stiliCard.js` e il colore della categoria), testo
esatto, posizione precisa sul desktop.
