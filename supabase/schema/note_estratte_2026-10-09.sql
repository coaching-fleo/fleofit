-- ═══════════════════════════════════════════════════════════════════════════
-- note_estratte — i dati ricavati dalle note degli atleti (standard v1)
-- Scritta il 09/10/2026 · spec: docs/superpowers/specs/2026-10-09-dati-dalle-note-design.md
--
-- ⚠️ NON APPLICARE senza lo sblocco ESPLICITO del committente (CLAUDE.md §0,
-- regola 0-bis): lo schema è congelato, il database è uno solo e serve anche la
-- web app in produzione. Questa è una migrazione ADDITIVA — una tabella nuova
-- che `main` non conosce — ma resta una decisione sua, non di chi scrive codice.
--
-- Perché una tabella e non un file in un bucket: una riga per nota si aggiorna
-- e si cancella da sola, sparisce in cascata con la storia dell'atleta, e il
-- database regge due scritture contemporanee. Il confronto completo è nel §7.1
-- della spec.
--
-- Chi la scrive: SOLO la Edge Function `estrai-note`, con la chiave di servizio.
-- Chi la legge: SOLO gli admin, dall'app. L'atleta NON legge i propri estratti:
-- sono letture del coach SU di lui, non un dato suo.
-- ═══════════════════════════════════════════════════════════════════════════

-- 0. Prima di applicare: i tipi delle chiavi. Atteso `uuid` per entrambe.
--    (Il 09/10 non si è potuto leggere senza la chiave di servizio. Se fossero
--    diversi, la `references` qui sotto fallisce con un errore: nessun danno
--    silenzioso, si corregge il tipo e si rilancia.)
-- select table_name, column_name, data_type from information_schema.columns
--  where table_schema = 'public' and table_name in ('athlete_workouts', 'athletes')
--    and column_name = 'id';

create table public.note_estratte (
  athlete_workout_id uuid primary key
    references public.athlete_workouts (id) on delete cascade,
  athlete_id uuid not null
    references public.athletes (id) on delete cascade,
  data date,                         -- completed_date dell'assegnazione
  impronta text not null,            -- FNV-1a del testo ripulito: se cambia, si rianalizza
  versione smallint not null,        -- versione dello standard (3 dal 09/10/2026)
  estrazione jsonb not null,         -- { stato, risultati, sensazioni }, anche vuoti
  creato_at timestamptz not null default now()
);

create index note_estratte_atleta on public.note_estratte (athlete_id, data);

alter table public.note_estratte enable row level security;

-- La lista admin è la stessa di supabase/functions/_shared/admin.ts e di
-- ADMIN_EMAILS in src/App.jsx, nello stesso ordine. USING e WITH CHECK
-- allineati: una lista disallineata è la causa del rifiuto App Store 2.3.1(a).
create policy "note_estratte solo admin" on public.note_estratte
  for all
  using      ((auth.jwt() ->> 'email') = any (array['coaching@federicoleo.it','alessandro.patrone@hotmail.it','federico_leo@hotmail.it','federico.leo88@gmail.com','demo@fleofit.it']))
  with check ((auth.jwt() ->> 'email') = any (array['coaching@federicoleo.it','alessandro.patrone@hotmail.it','federico_leo@hotmail.it','federico.leo88@gmail.com','demo@fleofit.it']));

-- Dopo: una policy sola, comando ALL.
-- select policyname, cmd from pg_policies where tablename = 'note_estratte';

-- Rollback (cancella anche tutti gli estratti; si rifanno rilanciando l'IA):
-- drop table public.note_estratte;
