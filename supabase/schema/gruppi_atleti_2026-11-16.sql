-- ═══════════════════════════════════════════════════════════════════════════
-- gruppi_atleti — i gruppi di comodo del coach, per assegnare in un tocco
-- Scritta il 16/11/2026 · sì ESPLICITO del committente in sessione, lo stesso
-- giorno («A, nel database»), dodicesima eccezione alla regola 0-bis di
-- CLAUDE.md §0. Va applicata A MANO dal SQL editor di Supabase.
--
-- Migrazione ADDITIVA: una tabella nuova che `main` (la web app di oggi) non
-- conosce e non legge. Nessuna tabella o policy esistente cambia.
--
-- Un gruppo è un nome e un elenco di id di atleti. L'atleta NON lo sa: nessuna
-- notifica, nessun consenso, nessuna lettura dal suo lato (i Team, con invito e
-- accettazione, sono un'altra cosa). `atleti` è un array e non una tabella di
-- collegamento: un atleta cancellato o passato a un altro coach resta nell'array,
-- ma l'app tiene solo quelli che il coach vede ancora (src/lib/gruppiAtleti.js).
--
-- Chi legge e scrive: solo il coach proprietario, e solo se è staff. Una policy
-- sola, uguale in USING e WITH CHECK: anche un admin vede solo i suoi.
-- Un coach rimosso porta via i suoi gruppi (on delete cascade).
-- ═══════════════════════════════════════════════════════════════════════════

begin;

create table public.gruppi_atleti (
  id uuid primary key default gen_random_uuid(),
  coach uuid not null references auth.users (id) on delete cascade default auth.uid(),
  nome text not null check (char_length(btrim(nome)) between 1 and 40),
  atleti uuid[] not null default '{}',
  creato_at timestamptz not null default now(),
  modificato_at timestamptz
);

create index gruppi_atleti_coach on public.gruppi_atleti (coach);

alter table public.gruppi_atleti enable row level security;

create policy "gruppi_atleti del coach" on public.gruppi_atleti
  as permissive for all to authenticated
  using      (coach = auth.uid() and public.e_staff())
  with check (coach = auth.uid() and public.e_staff());

commit;

-- Dopo, per verificare (deve stampare UNA riga: «gruppi_atleti del coach | ALL»):
-- select policyname, cmd from pg_policies where tablename = 'gruppi_atleti';

-- Rollback (cancella tutti i gruppi):
-- drop table public.gruppi_atleti;
