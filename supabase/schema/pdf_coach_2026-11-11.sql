-- ═══════════════════════════════════════════════════════════════════════════
-- pdf_coach — il template del PDF della scheda: nome e note del coach
-- Scritta l'11/11/2026 · sì ESPLICITO del committente in sessione, lo stesso
-- giorno («Nel database (serve un tuo sì)»). Undicesima eccezione allo schema
-- congelato (CLAUDE.md §0, regola 0-bis). Da applicare A MANO dal SQL editor.
--
-- Migrazione ADDITIVA: una tabella nuova che `main` e le app già sugli Store
-- non conoscono e non leggono. Nessuna tabella esistente cambia.
--
-- Una riga per coach: `nome_firma` va in testa al PDF («FLEOFIT - Coach …»),
-- `note_finali` nel riquadro «NOTE AGGIUNTIVE» di tutti i suoi PDF. Il PDF
-- usa il template di chi ha CREATO il workout (`workouts.creato_da`), e se non
-- lo legge quello di chi esporta (spec:
-- docs/superpowers/specs/2026-11-11-template-pdf-design.md).
--
-- Chi legge: il coach stesso, lo staff, gli atleti di quel coach
-- (`e_mio_coach`) e gli atleti a cui quel coach ha scritto un workout. Il nome
-- e le note finiscono comunque sui PDF degli atleti.
--
-- ⚠️ Si esegue UNA volta: `create table` e `create policy` non hanno
-- `if not exists`, e una seconda esecuzione si ferma a metà con un errore.
--
-- Chi scrive: solo il coach sulla SUA riga, e solo se `puo_scrivere_messaggi()`
-- (lo staff MENO demo@fleofit.it: il revisore App Store non deve scrivere cose
-- che arrivano sui PDF degli atleti veri). USING e WITH CHECK uguali.
-- ═══════════════════════════════════════════════════════════════════════════

create table public.pdf_coach (
  coach_id      uuid primary key references auth.users (id) on delete cascade,
  nome_firma    text check (nome_firma is null or char_length(btrim(nome_firma)) between 1 and 60),
  note_finali   text check (note_finali is null or char_length(note_finali) <= 600),
  aggiornato_at timestamptz not null default now()
);

alter table public.pdf_coach enable row level security;

-- L'ultimo ramo: l'atleta legge anche il template di chi gli ha SCRITTO un
-- workout, pure se non è il suo coach in `coach_atleti` (un admin che scrive
-- per l'atleta di un altro coach). Senza, quel PDF uscirebbe col solo
-- «FLEOFIT» dove fino a ieri c'era un nome (revisione finale, 11/11/2026).
-- Le sottoquery passano dalla RLS di athlete_workouts e workouts, che l'atleta
-- legge per le sue righe: nessuna ricorsione, pdf_coach non è letta da loro.
create policy "pdf_coach lettura" on public.pdf_coach
  as permissive for select to authenticated
  using (
    coach_id = auth.uid()
    or public.e_staff()
    or public.e_mio_coach(coach_id)
    or exists (select 1 from public.athlete_workouts aw
               join public.workouts w on w.id = aw.workout_id
               where aw.athlete_id = auth.uid() and w.creato_da = pdf_coach.coach_id)
  );

create policy "pdf_coach scrittura" on public.pdf_coach
  as permissive for all to authenticated
  using      (coach_id = auth.uid() and public.puo_scrivere_messaggi())
  with check (coach_id = auth.uid() and public.puo_scrivere_messaggi());

-- Semina: ogni membro dello staff con un account parte col nome della sua riga
-- `athletes` (come `elenco_staff`). Così il PDF di chi c'è già non perde il
-- nome il giorno dopo la migrazione. Senza nome: nessuna firma, solo FLEOFIT.
insert into public.pdf_coach (coach_id, nome_firma)
select u.id, nullif(left(btrim(coalesce(a.name, '') || ' ' || coalesce(a.surname, '')), 60), '')
from public.staff s
join auth.users u on lower(u.email) = s.email
left join public.athletes a on a.id = u.id
on conflict (coach_id) do nothing;

-- Dopo, per verificare:
--   select policyname, cmd from pg_policies where tablename = 'pdf_coach';
--     → DUE righe: «pdf_coach lettura» SELECT e «pdf_coach scrittura» ALL
--   select p.nome_firma, s.email from public.pdf_coach p
--     join auth.users u on u.id = p.coach_id join public.staff s on s.email = lower(u.email);
--     → una riga per ogni membro dello staff con un account

-- Rollback (cancella i template di tutti i coach):
-- drop table public.pdf_coach;
