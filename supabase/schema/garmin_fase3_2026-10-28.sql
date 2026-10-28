-- ═══════════════════════════════════════════════════════════════════════════
-- garmin fase 3 — la Corsa all'orologio: colonna `firma`, via la cascata, trigger accesi
-- Scritta il 28/10/2026 · ⏳ NON APPLICATA.
-- Piano: docs/superpowers/specs/2026-10-27-garmin-design.md (fase dei workout).
--
-- 🔒 CLAUDE.md §0, regola 0-bis: lo schema è congelato. Questo file si scrive e
-- NON si applica: serve il sì ESPLICITO del committente, in sessione, su QUESTO
-- file, prima di incollarlo nel SQL editor. Claude non lo esegue.
--
-- ⚠️ PRIMA: la Edge Function `garmin-training` deve essere già pubblicata (i
-- trigger accesi la chiamano a ogni modifica di un'assegnazione o di un workout).
-- `garmin-training` legge GIÀ la colonna `firma`, ma tra il deploy e questo file
-- non si rompe niente: l'interruttore funziona, e «Riprova» non compare perché
-- righe in garmin_invii non ce ne sono ancora (i trigger sono spenti). L'ordine
-- deploy → questo file è sicuro.
-- ⚠️ PRIMA ancora: verificare il nome del vincolo con la query di controllo in
-- fondo («Prima, per verificare»). Se non è `garmin_invii_athlete_workout_id_fkey`, correggere
-- la riga della sezione 2 prima di lanciarla.
--
-- Cosa fa, in breve:
--  1. `firma` su garmin_invii: l'impronta del workout come è andato all'orologio,
--     per capire se un cambio lo riguarda davvero (colonna additiva, nullable).
--  2. Toglie la chiave esterna garmin_invii → athlete_workouts. NON additivo.
--  3. Accende i due trigger degli invii, nati spenti.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. La firma dell'invio ─────────────────────────────────────────────────
begin;

alter table public.garmin_invii add column if not exists firma text;

-- ── 2. Via la cascata ──────────────────────────────────────────────────────
-- Con `on delete cascade` la riga di garmin_invii sparisce NELLO STESSO istante
-- in cui si cancella l'assegnazione, cioè PRIMA che `garmin-training` riceva
-- l'avviso del DELETE: non sapremmo più quale workout togliere dall'orologio
-- (garmin_workout_id e garmin_schedule_id stavano in quella riga) e l'allenamento
-- resterebbe sull'orologio dell'atleta. Senza vincolo la riga resta, la funzione
-- legge gli id, cancella presso Garmin e poi toglie la riga da sé.
-- Conseguenza accettata: se la funzione fallisce, la riga resta in 'errore' e il
-- workout resta sull'orologio (l'assegnazione non c'è più, quindi nessuna scheda e
-- «Riprova» risponde 403). Si pulisce solo se l'atleta spegne «Manda i workout
-- all'orologio» (quel percorso sincronizza le righe per athlete_id e dà `cancella`);
-- altrimenti si toglie a mano.
-- Il `drop constraint` è SENZA `if exists` di proposito: se il nome è sbagliato
-- deve fallire forte e, dentro la transazione, impedire che i trigger si accendano.
alter table public.garmin_invii drop constraint garmin_invii_athlete_workout_id_fkey;

-- ── 3. Si accende l'invio ──────────────────────────────────────────────────
alter table public.athlete_workouts enable trigger garmin_invii_assegnazioni;
alter table public.workouts enable trigger garmin_invii_workout;

commit;

-- ── Prima, per verificare il nome del vincolo (deve stampare una riga) ─────
--   select conname from pg_constraint
--    where conrelid = 'public.garmin_invii'::regclass and contype = 'f'
--      and conname = 'garmin_invii_athlete_workout_id_fkey';
--   -- atteso: una sola riga, garmin_invii_athlete_workout_id_fkey

-- ── Dopo, per verificare ───────────────────────────────────────────────────
-- Tutti e tre i trigger `garmin_%` attivi (tgenabled = 'O' per ciascuno):
--   select tgname, tgenabled from pg_trigger where tgname like 'garmin_%';
-- La colonna firma esiste (deve stampare una riga):
--   select column_name from information_schema.columns
--    where table_schema = 'public' and table_name = 'garmin_invii' and column_name = 'firma';
-- Il vincolo non c'è più (deve stampare 0):
--   select count(*) from pg_constraint
--    where conname = 'garmin_invii_athlete_workout_id_fkey';

-- ── Rollback ───────────────────────────────────────────────────────────────
-- alter table public.workouts disable trigger garmin_invii_workout;
-- alter table public.athlete_workouts disable trigger garmin_invii_assegnazioni;
-- (prima di rimettere la chiave si tolgono le righe orfane, o l'add constraint fallisce:)
-- delete from public.garmin_invii where athlete_workout_id not in (select id from public.athlete_workouts);
-- alter table public.garmin_invii add constraint garmin_invii_athlete_workout_id_fkey
--   foreign key (athlete_workout_id) references public.athlete_workouts (id) on delete cascade;
-- alter table public.garmin_invii drop column firma;
