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
-- ⚠️ PRIMA ancora: verificare il nome del vincolo con la query di controllo in
-- fondo (punto 1). Se non è `garmin_invii_athlete_workout_id_fkey`, correggere
-- la riga del punto 3 prima di lanciarla.
--
-- Cosa fa, in breve:
--  1. `firma` su garmin_invii: l'impronta del workout come è andato all'orologio,
--     per capire se un cambio lo riguarda davvero (colonna additiva, nullable).
--  2. Toglie la chiave esterna garmin_invii → athlete_workouts. NON additivo.
--  3. Accende i due trigger degli invii, nati spenti.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. La firma dell'invio ─────────────────────────────────────────────────
alter table public.garmin_invii add column firma text;

-- ── 2. Via la cascata ──────────────────────────────────────────────────────
-- Con `on delete cascade` la riga di garmin_invii sparisce NELLO STESSO istante
-- in cui si cancella l'assegnazione, cioè PRIMA che `garmin-training` riceva
-- l'avviso del DELETE: non sapremmo più quale workout togliere dall'orologio
-- (garmin_workout_id e garmin_schedule_id stavano in quella riga) e l'allenamento
-- resterebbe sull'orologio dell'atleta. Senza vincolo la riga resta, la funzione
-- legge gli id, cancella presso Garmin e poi toglie la riga da sé.
-- Conseguenza accettata: una riga può restare orfana se la funzione non gira
-- (la scheda la mostra «Non inviato · Riprova»); non c'è più la pulizia automatica.
alter table public.garmin_invii drop constraint garmin_invii_athlete_workout_id_fkey;

-- ── 3. Si accende l'invio ──────────────────────────────────────────────────
alter table public.athlete_workouts enable trigger garmin_invii_assegnazioni;
alter table public.workouts enable trigger garmin_invii_workout;

-- ── Prima, per verificare il nome del vincolo (deve stampare una riga) ─────
--   select conname from pg_constraint
--    where conrelid = 'public.garmin_invii'::regclass and contype = 'f';
--   -- atteso: garmin_invii_athlete_workout_id_fkey (e garmin_invii_athlete_id_fkey, che resta)

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
