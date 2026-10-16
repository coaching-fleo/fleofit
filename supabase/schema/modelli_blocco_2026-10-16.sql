-- ═══════════════════════════════════════════════════════════════════════════
-- modelli_blocco — «Modelli di blocco», i blocchi salvati dal coach per riusarli
-- Scritta il 16/10/2026 · sì ESPLICITO del committente in sessione, lo stesso
-- giorno («do il sì esplicito alla migrazione additiva della tabella
-- modelli_blocco»), quinta eccezione alla regola 0-bis di CLAUDE.md §0.
-- Va applicata con `supabase db query --linked -f`.
--
-- Migrazione ADDITIVA: una tabella nuova che `main` (la web app di oggi) non
-- conosce e non legge. Nessuna tabella o policy esistente cambia.
--
-- Un modello è UN blocco (Hyrox), UNA fase (Running) o UN gruppo (Gym), nel
-- formato di CLAUDE.md §5 e SENZA nessun `id` interno: gli id si rigenerano a
-- ogni inserimento. `categoria` usa gli id di CATEGORIE ('Running', non «Corsa»).
--
-- Chi legge e scrive: solo il coach proprietario, e solo se è staff. Una
-- policy sola, uguale in USING e WITH CHECK: anche un admin vede solo i suoi.
-- Un coach rimosso porta via i suoi modelli (on delete cascade).
-- ═══════════════════════════════════════════════════════════════════════════

create table public.modelli_blocco (
  id uuid primary key default gen_random_uuid(),
  coach uuid not null references auth.users (id) on delete cascade default auth.uid(),
  categoria text not null check (categoria in ('Hyrox', 'Running', 'Gym')),
  nome text not null check (char_length(btrim(nome)) between 1 and 80),
  contenuto jsonb not null,
  creato_at timestamptz not null default now(),
  modificato_at timestamptz
);

create index modelli_blocco_coach on public.modelli_blocco (coach, categoria);

alter table public.modelli_blocco enable row level security;

create policy "modelli_blocco del coach" on public.modelli_blocco
  as permissive for all to authenticated
  using      (coach = auth.uid() and public.e_staff())
  with check (coach = auth.uid() and public.e_staff());

-- Dopo, per verificare (deve stampare UNA riga: «modelli_blocco del coach | ALL»):
-- select policyname, cmd from pg_policies where tablename = 'modelli_blocco';

-- Rollback (cancella tutti i modelli):
-- drop table public.modelli_blocco;
