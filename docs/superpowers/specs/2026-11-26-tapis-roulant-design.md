# Corsa: versione «Tapis roulant» — design (26/11/2026)

## Perché
Molti atleti fanno la corsa del coach sul tapis roulant. Il coach la scrive in min/km,
come sempre; l'atleta ha bisogno dei **km/h da impostare sulla macchina**, senza fare
conti e senza che il coach debba scrivere una seconda versione.

## Cosa
1. **Interruttore `Outdoor | Tapis roulant`** nella scheda di un workout di categoria
   **Running** (solo lì: l'Hyrox ha già «Passo | Velocità» sul Run). Parte da Outdoor ogni
   volta: nessun ricordo della scelta (deciso dal committente, «Solo A»).
2. Su **Tapis roulant** ogni ritmo `m:ss /km` diventa una velocità: `km/h = 60 / minuti al km`,
   arrotondata a **0,1** (passo dei tapis roulant). Un intervallo si scrive dal più lento al
   più veloce: `5:00 – 5:30 /km` → `10,9 – 12,0 km/h`. Vale per passi semplici e ripetute
   (anche le `parti`, lette con `partiRipetuta`).
3. **Non si convertono** `Libero`, `Camminata`, `Da fermo`, `Z1`–`Z5`, `All out`, `Gara`:
   restano scritti come sono. Distanze, tempi, round, note: invariati.
4. La versione scelta vale anche per il **timer guidato** aperto da quella scheda.
5. **Riconoscimento da Garmin**: sull'orologio non cambia nulla (lo stesso allenamento si
   avvia col profilo Tapis roulant). Quando l'attività abbinata arriva con tipo
   `TREADMILL_RUNNING` — che oggi completa già la Corsa — sul workout completato compare
   **«Su tapis roulant»**, visibile ad atleta e coach (nella card «Da Garmin» della scheda,
   vicino alla fonte).

## Non-obiettivi
- Il coach non scrive nulla di nuovo, nessuna opzione nel builder.
- Nessun secondo workout mandato all'orologio, nessuna modifica a `garmin-training`,
  `garmin-webhook` o ad altre Edge Function.
- Nessuna pendenza suggerita, nessuna conversione delle zone.
- Nessun segno «tapis roulant» per chi completa a mano senza Garmin.

## Anti-obiettivi
- Cambiare il formato di `workouts.sections`: le app già sugli Store devono leggere tutto
  come oggi.
- Mostrare una velocità inventata dove il ritmo non è un numero.

## Vincoli
- **Nessuna migrazione** (§0-bis): la scelta è solo nello stato della pagina, il tipo
  dell'attività è già in `garmin_attivita.tipo`.
- Logica pura in un file nuovo di `src/lib/` (nome a scelta, es. `tapisRoulant.js`) con
  test, verificati rompendo apposta il codice.
- Stessa resa su web, iOS, Android; niente plugin nativi.

## Approcci considerati
- **A (scelto)**: interruttore nella scheda + conversione automatica + segno «Su tapis
  roulant» dal tipo Garmin. Minimo, niente database, niente orologio.
- B: in più un secondo workout sull'orologio con le velocità. Scartato: l'orologio mostra
  già il passo sul tapis roulant e l'atleta avrebbe due allenamenti uguali.
- C: A + ricordo dell'ultima scelta sul dispositivo. Scartato dal committente.

## Lasciato a chi costruisce
- Dove esattamente sta l'interruttore nella scheda e come si chiama in `WorkoutDetailUI`
  (stile dei toggle segmentati del §6, colore Running).
- Se la **TV** segue la scelta: sì se riceve i passi già scritti dalla scheda; se servisse
  toccare `tv_sessions` o il protocollo della TV, resta Outdoor e lo si annota.
- Il formato della velocità (virgola) coerente con come la scheda scrive oggi `speed`.
