# Cestino dei workout

> Progetto: `docs/superpowers/specs/2026-11-19-cestino-workout-design.md` · piano:
> `docs/superpowers/plans/2026-11-19-cestino-workout.md` · migrazione:
> `supabase/schema/cestino_workout_2026-11-19.sql` · verifica: `tools/verifica-cestino.sql`.

## Perché esiste (19/11/2026)

Il 18/11/2026 alle 17:29 il revisore di App Store (account `demo@fleofit.it`, che è **admin**)
ha eliminato un workout vero, «SkiErg Tempo», con le sue cinque assegnazioni. Lo hanno detto i
log delle richieste di Supabase (rete Apple, iPhone, sessione del demo). Si è recuperato solo
dal backup notturno. Il committente ha chiesto una rete: un workout eliminato resta
recuperabile per 14 giorni dal coach che l'ha creato.

## Stato

✅ Applicata a mano dal committente il 19/11/2026: tabella, trigger acceso, cron
`svuota-cestino-workout` = job 6, SELECT di `authenticated` sulle sole 8 colonne della lista.
Verifica: i 12 casi passati lo stesso giorno (dopo aver corretto il caso 11: come «ex coach»
sceglieva una persona dello staff con riga atleta).
✅ `cestino_admin_2026-11-19.sql` (l'admin vede tutto): applicata lo stesso giorno, verifica con
i 13 casi passata.

## Come funziona

- **La copia la fa il database**, non l'app: trigger `cestino_workout_copia`
  (`before delete on workouts`) → funzione `cestino_copia()`. Così copre anche la 1.2.4 sugli
  Store e il sito, che eliminano con un `delete()` diretto.
- **Chi entra**: tutti i workout tranne l'**allenamento libero**: autore non staff **e**
  `sections.isAutonomous = true` (compresi quelli che `garmin-webhook/attivita.ts` crea e
  cancella da sé). Entrano quindi anche i workout senza autore (i 138 Custom ed Eventi di prima
  del 16/10/2026) e quelli di un **ex coach** (autore non più staff): li vedono gli admin.
  Al 19/11/2026 i 31 workout con autore non staff erano tutti autonomi.
- **Chi vede**: un coach vede solo i suoi. Un admin vede e ripristina **tutto**, il cestino di
  ogni coach compreso (`cestino_mio`). ⚠️ Fino al 19/11/2026 l'admin vedeva solo i suoi, quelli
  senza autore e quelli di un ex coach: lo ha cambiato `cestino_admin_2026-11-19.sql`, chiesto
  dal committente perché nel calendario l'admin vede già i workout di tutti. Anche
  `demo@fleofit.it` è admin: il revisore di App Store vede il cestino di tutti (rischio accettato).
- **Cosa si salva** in `copia` (jsonb): il workout; le assegnazioni con le loro `note_estratte`,
  la `scarpe_uso`, gli id delle `garmin_attivita` abbinate e il nome dell'atleta; le sfide dei
  team con i risultati e il nome del team; gli id dei `team` con `evento_id` sul workout; i
  `workout_logs`. **Non** `tv_sessions` (effimera) né `garmin_invii` (si rigenera).
- **Il ripristino** (`ripristina_workout(c, assegnazioni[], sfide[])`): il workout torna con lo
  **stesso id**, così i link delle notifiche già inviate funzionano. Tornano solo le voci
  spuntate; **nessuna notifica**. Le voci le dà `cestino_voci(c)`, con `ripristinabile` e
  `motivo` («atleta eliminato», «non è più tra i tuoi atleti», «team sciolto»).
- **La `copia` non si legge dal client**: `authenticated` ha il SELECT solo sulle colonne della
  lista. Le voci passano da `cestino_voci`, che per un atleta non più del coach non mostra note
  né nota vocale.
- **Nessuno svuota a mano**: niente policy di delete. Il cron `svuota-cestino-workout`
  (`10 0 * * *` UTC) cancella dopo 14 giorni.
- **App**: voce **Cestino** nella Libreria (solo se la tabella c'è, con «N workout» o «Vuoto»),
  pagina `/cestino` (`Cestino.jsx`, `CestinoUI.jsx`), foglio `FoglioRipristino.jsx`, logica in
  `src/lib/cestino.js` e `cestinoDb.js`. La conferma di eliminazione nella scheda dice «Il
  workout andrà nel cestino per 14 giorni…», tranne per l'allenamento libero
  (`finisceNelCestino`, che deve dire lo stesso del trigger).

## Quanto manca

`giorniRimasti` conta i giorni di **calendario** fino all'ultimo giorno in cui la riga è ancora
lì (giorno dell'eliminazione + 14); il cron delle 00:10 UTC la toglie la notte dopo. Appena
eliminato: «si cancella tra 14 giorni»; il giorno prima: «resta fino a domani»; l'ultimo: «si
cancella stanotte». Fino al 19/11/2026 contava le 24 ore intere e appena eliminato diceva 13.

## Trappole

- Se la copia fallisce, **fallisce anche la delete**: meglio un errore a schermo che un workout
  perso senza rete. Un errore «cestino…» all'eliminazione viene da qui.
- La colonna del team è `team.evento_id`, non `workout_id`.
- `team_risultati_regole` rifiuta i risultati su una sfida chiusa e riscrive `inserito_il`: il
  ripristino rimette la sfida aperta, poi i risultati, poi richiude. `inserito_il` diventa l'ora
  del ripristino (accettato).
- Garmin: eliminare toglie il workout dall'orologio, ripristinare un'assegnazione lo rimanda
  (trigger `garmin_invii_assegnazioni`). Voluto.
- Le **note vocali** sono file nel bucket `voice-notes`: non si toccano né all'eliminazione né
  dopo 14 giorni. Restano orfane, come succedeva già prima (BACKLOG).
- Il backup notturno salva `cestino_workout` solo dopo il prossimo `app:main` (il workflow
  gira da `main`).

## Nella demo (`npm run demo`)

Dal 19/11/2026 `src/demoCestino.js` fa nel database finto quello che fanno il trigger e le
cascate: all'eliminazione di un workout copia nel cestino e toglie assegnazioni, sfide e log;
risponde alle RPC `cestino_voci` e `ripristina_workout`. È uno specchio **semplificato**: niente
note estratte, scarpe, Garmin; tutti vedono tutto il cestino. Prima mancava, e il cestino in
demo restava vuoto (il database finto risponde con una lista vuota a ogni tabella che non ha).
⚠️ Chi cambia la copia o il ripristino nel SQL cambia anche questo file
(`src/__tests__/demoCestino.test.js`).

## Come si verifica

Dopo l'applicazione, incollare `tools/verifica-cestino.sql` nel SQL editor: tredici casi (il 13 solo dopo `cestino_admin_2026-11-19.sql`), nessuna
traccia lasciata. Atteso `TUTTI I CONTROLLI DEL CESTINO SONO PASSATI`.
