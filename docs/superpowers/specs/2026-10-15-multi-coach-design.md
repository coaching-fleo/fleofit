# Più coach — design

Data: 15/10/2026 · stato: **in revisione dal committente**
Piano: `docs/superpowers/plans/2026-10-15-multi-coach.md` · SQL: `supabase/schema/multi_coach_2026-10-15.sql`
(piano e SQL sono una prima bozza: vanno riallineati a questa spec dopo l'approvazione).

## 1. Obiettivo

Più coach nella stessa app. Ogni coach vede e raggiunge **solo i suoi atleti**; gli
admin vedono e fanno tutto. La separazione la fa il **database** (RLS): deve reggere
anche contro un'app vecchia o una chiamata diretta con la anon key.

**Riuscito quando:** un coach nuovo, con zero atleti, entra e non vede nulla di nessuno —
né nell'app né interrogando il database direttamente.

## 2. Decisioni del committente (15/10/2026)

| # | Decisione |
|---|---|
| D1 | Admin: `coaching@federicoleo.it`, `alessandro.patrone@hotmail.it`, `federico.leo88@gmail.com`, `demo@fleofit.it`. Coach: `federico_leo@hotmail.it` |
| D2 | Gli admin vedono **tutti** gli atleti di tutti i coach e possono tutto |
| D3 | Oggi un atleta ha **un** coach, ma il modello ne regge più d'uno |
| D4 | Un atleta diventa di un coach **dal codice invito** (automatico); l'admin può sempre assegnare/spostare a mano |
| D5 | I 16 atleti di oggi → `federico_leo@hotmail.it` |
| D6 | Libreria workout **privata per coach**; i 214 workout di oggi → `federico_leo@hotmail.it` |
| D7 | Notifiche al coach (completato, vocale, commento) → **solo al coach dell'atleta** |
| D8 | «Messaggio a tutti»: il coach → i suoi atleti; l'admin **sceglie** «I miei atleti» o «Tutti gli atleti» |
| D9 | Solo admin: gestione coach, Backup/Ripristino, «Simula atleta», codici invito di tutti. **TV Dashboard: tutti** (coach compresi) |
| D10 | Approccio: regole nel database con tabelle `staff` + `coach_atleti` (non una colonna su `athletes`, non filtri solo in app) |

## 3. Dati

**`staff`** — `email` (chiave, minuscolo), `ruolo` (`admin`|`coach`), `creato_at`.
Chiave email: un coach si aggiunge prima che crei l'account. Diventa la **sola** lista
dello staff: sostituisce `ADMIN_EMAILS` nell'app (che resta solo come riserva), in
`_shared/admin.ts` e nelle ~10 policy che ripetono le email.
`demo@fleofit.it` è admin ma non scrive messaggi agli atleti (come oggi).

**`coach_atleti`** — `athlete_id` → `athletes`, `coach_id` → `auth.users`, `creato_at`;
chiave **(athlete_id, coach_id)**, quindi più coach per atleta senza rifare la tabella.
Scrivono solo gli admin e il trigger di assegnazione: l'atleta non può cambiarsi coach.

**`workouts.creato_da`** — uuid, default `auth.uid()`: le app vecchie la riempiono senza saperlo.

**`messaggi_coach.destinatari`** — `'miei'` (default) | `'tutti'`; `'tutti'` solo se l'autore è admin.

**Partenza:** staff come D1; tutti gli atleti che non sono account dello staff →
`federico_leo@hotmail.it`; `creato_da` dei workout esistenti → lui.

**Assegnazione automatica** (trigger dopo l'insert in `athletes`):
- l'atleta crea la propria riga (registrazione) → coach = `created_by` del codice che ha usato, se è dello staff (anche un admin);
- un coach crea un atleta a mano → coach = lui;
- un admin crea un atleta a mano → nessun coach, finché non lo assegna.

## 4. Chi vede cosa

Regola unica: **l'atleta il suo, il coach quello dei suoi atleti, l'admin tutto.**
Si scrive solo dove si legge. Le policy richiamano funzioni `security definer`
(`e_admin`, `e_staff`, `mio_atleta(uuid)`, `vedo_workout(uuid)`…), così la regola è
scritta una volta e non c'è ricorsione fra policy.

| Cosa | Atleta | Coach | Admin |
|---|---|---|---|
| `athletes`, `athlete_workouts`, `personal_records`, `come_stai` | i suoi | dei suoi atleti | tutti |
| `note_estratte` | ❌ | dei suoi atleti | tutte |
| `workouts` | assegnati a lui + i suoi liberi | creati da lui + assegnati ai suoi atleti | tutti |
| `messaggi_coach` | del suo coach + `tutti` degli admin | i suoi | tutti |
| `invitation_codes` | solo validare/riscattare (come oggi) | i suoi | tutti |
| `staff`, `coach_atleti` | la propria riga / il suo coach | sé / i suoi atleti | tutto, e scrive |
| vocali (storage) | — | carica/modifica | carica/modifica |
| TV senza login | solo il workout in onda | | |

Vincoli in scrittura: un coach non assegna un workout che non vede; un messaggio
si scrive solo a nome proprio. Il workout appena creato deve tornare a chi l'ha
inserito (`insert(...).select()`): «l'ho creato io» sta nella policy, non nella
funzione `stable` (che non vedrebbe la riga nuova).

Si chiudono insieme due buchi: la TV leggeva tutti i workout; `personal_records`
era aperta a ogni autenticato. **Fuori, nel BACKLOG:** `push_subscriptions` aperta,
`storage.objects` modificabile da chiunque, `tv_sessions` sovrascrivibile.

## 5. Edge Function

Usano la chiave di servizio, quindi filtrano da sé leggendo `staff` / `coach_atleti`.
- `ai-workout`, `ricerca-coach`: ammessi admin e coach.
- `estrai-note`: un coach solo sui suoi atleti, altrimenti 403.
- `send-reminders`:
  - notifiche al coach → tutti i coach dell'atleta; nessun coach → gli admin;
  - promemoria mattina/sera → escluso tutto lo staff;
  - broadcast: coach → suoi atleti; admin → suoi o tutti, da `destinatari`; coach senza atleti → «nessun destinatario», non errore; «Prova su di me» invariata; `demo@fleofit.it` mai.

Ordine di pubblicazione: database → funzioni. Il deploy colpisce web, iOS e Android.

## 6. App

- Ruolo letto da `staff`; riserva `ADMIN_EMAILS` se la tabella non risponde.
- Coach = l'interfaccia da admin di oggi **meno** le voci di D9.
- Impostazioni → «Coach» (solo admin): elenco, aggiungi per email, togli (bloccato se ha atleti).
- Scheda atleta → riga «Coach» (solo admin): assegna/cambia.
- «Messaggio a tutti» per l'admin: scelta «I miei atleti» / «Tutti gli atleti».
- Ambiente di prova: un coach finto con una parte degli atleti finti.
- App già sugli Store (1.2.0, 1.2.1): funzionano; `federico_leo@hotmail.it` vede i bottoni da admin ma riceve solo i suoi dati. Il pannello «Coach» arriva con la 1.2.2.

## 7. Verifica

1. Test automatici: ruoli, destinatari del broadcast, assegnazione coach.
2. Nel database, impersonando tre utenti in una transazione annullata: coach nuovo → 0 atleti/allenamenti/record/messaggi; `federico_leo@hotmail.it` → i suoi 16; atleta → solo sé stesso.
3. Prove sul telefono: le fa il committente, su una lista preparata.

## 8. Vincoli

- 🔒 Schema congelato (CLAUDE.md §0, 0-bis): la migrazione si applica **solo** dopo un sì esplicito, ed è la prima **non additiva** (riscrive policy esistenti). Prima: backup.
- Un database per web, iOS, Android e versioni pubblicate; niente staging.
- Colori, lingua e convenzioni del progetto invariati.
