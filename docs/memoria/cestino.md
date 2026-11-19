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

## Come funziona

- **La copia la fa il database**, non l'app: trigger `cestino_workout_copia`
  (`before delete on workouts`) → funzione `cestino_copia()`. Così copre anche la 1.2.4 sugli
  Store e il sito, che eliminano con un `delete()` diretto.
- **Chi entra**: workout con `creato_da` **staff** (admin o coach) o **null** (i 138 Custom ed
  Eventi di prima del 16/10/2026: non si sa chi li ha scritti). Restano fuori quelli con
  autore un atleta: gli allenamenti liberi, compresi quelli che `garmin-webhook/attivita.ts`
  crea e cancella da sé.
- **Chi vede**: l'autore, se è ancora staff. Se l'autore è null o non è più staff, gli admin
  (`cestino_mio`). ⚠️ Un admin **non** vede il cestino di un coach.
- **Cosa si salva** in `copia` (jsonb): il workout; le assegnazioni con le loro `note_estratte`,
  la `scarpe_uso`, gli id delle `garmin_attivita` abbinate e il nome dell'atleta; le sfide dei
  team con i risultati e il nome del team; gli id dei `team` con `evento_id` sul workout; i
  `workout_logs`. **Non** `tv_sessions` (effimera) né `garmin_invii` (si rigenera).
- **Il ripristino** (`ripristina_workout(c, assegnazioni[], sfide[])`): il workout torna con lo
  **stesso id**, così i link delle notifiche già inviate funzionano. Tornano solo le voci
  spuntate; **nessuna notifica**. Le voci le dà `cestino_voci(c)`, con `ripristinabile` e
  `motivo` («atleta eliminato», «non è più tra i tuoi atleti», «team sciolto»).
- **Nessuno svuota a mano**: niente policy di delete. Il cron `svuota-cestino-workout`
  (`10 0 * * *` UTC) cancella dopo 14 giorni.
- **App**: voce **Cestino** nella Libreria (solo se la tabella c'è, con «N workout» o «Vuoto»),
  pagina `/cestino` (`Cestino.jsx`, `CestinoUI.jsx`), foglio `FoglioRipristino.jsx`, logica in
  `src/lib/cestino.js` e `cestinoDb.js`. La conferma di eliminazione nella scheda dice «Il
  workout andrà nel cestino per 14 giorni…», tranne per l'allenamento libero
  (`finisceNelCestino`, che deve dire lo stesso del trigger).

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

## Come si verifica

Dopo l'applicazione, incollare `tools/verifica-cestino.sql` nel SQL editor: dieci casi, nessuna
traccia lasciata. Atteso `TUTTI I CONTROLLI DEL CESTINO SONO PASSATI`.
