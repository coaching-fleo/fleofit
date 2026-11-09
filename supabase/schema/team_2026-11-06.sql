-- ═══════════════════════════════════════════════════════════════════════════
-- Team di atleti e sfida interna
-- Scritta il 06/11/2026 · PROPOSTA: NON APPLICATA. Serve il sì ESPLICITO del
-- committente (CLAUDE.md §0, regola 0-bis: lo schema è congelato). Sarebbe la
-- DECIMA eccezione. Va applicata a mano dal SQL editor di Supabase, dopo il sì,
-- e subito dopo va eseguito tools/verifica-team.sql.
--
-- Migrazione ADDITIVA: quattro tabelle nuove che `main` (la web app di oggi)
-- non conosce e non legge. Nessuna tabella o policy esistente cambia.
-- Spec: docs/superpowers/specs/2026-11-06-team-design.md
--
--  · team           — il gruppo, di UN coach. `classifica_visibile`: gli atleti
--                     vedono i risultati dei compagni solo se è accesa.
--  · team_membri    — chi è nel team e in che stato: invitato · dentro ·
--                     rifiutato · uscito. 🔴 IL COACH NON SCRIVE MAI «dentro»:
--                     lo impone il trigger team_membri_regole, non l'interfaccia.
--                     Reinvito di chi ha rifiutato o è uscito: dopo 3 giorni.
--  · team_sfide     — un allenamento fatto dal team, con la metrica (tempo,
--                     ripetizioni, kg, distanza) e il verso (chi vince).
--  · team_risultati — il numero inserito dall'atleta (secondi per il tempo,
--                     metri per la distanza). `fonte`: 'manuale' oggi, 'garmin'
--                     quando l'orologio sarà attivo per tutti.
--  · team_scheda(t) — i nomi dei compagni: l'atleta legge solo la PROPRIA riga
--                     di `athletes`, quindi i nomi passano da qui.
--  · funzioni_app 'team' — parte SPENTA.
--
-- Per tornare indietro (in quest'ordine):
--   drop table public.team_risultati, public.team_sfide, public.team_membri, public.team;
--   drop function public.team_mio(uuid), public.membro_team(uuid, text[]),
--     public.team_di_sfida(uuid), public.classifica_aperta(uuid),
--     public.team_scheda(uuid), public.team_membri_regole(), public.team_risultati_regole();
--   delete from public.funzioni_app where nome = 'team';
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. le tabelle ─────────────────────────────────────────────────────────
create table public.team (
  id                  uuid primary key default gen_random_uuid(),
  nome                text not null check (char_length(btrim(nome)) between 1 and 60),
  coach_id            uuid not null references auth.users (id) on delete cascade,
  evento_id           uuid references public.workouts (id) on delete set null,
  classifica_visibile boolean not null default false,
  creato_il           timestamptz not null default now(),
  chiuso_il           timestamptz
);
-- Due team dello stesso coach non si chiamano uguale (le notifiche li nominano).
create unique index team_nome_per_coach on public.team (coach_id, lower(btrim(nome)));

create table public.team_membri (
  team_id     uuid not null references public.team (id) on delete cascade,
  atleta_id   uuid not null references public.athletes (id) on delete cascade,
  stato       text not null check (stato in ('invitato', 'dentro', 'rifiutato', 'uscito')),
  invitato_il timestamptz not null default now(),
  risposto_il timestamptz,
  primary key (team_id, atleta_id)
);
create index team_membri_atleta on public.team_membri (atleta_id);

create table public.team_sfide (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.team (id) on delete cascade,
  workout_id uuid not null references public.workouts (id) on delete cascade,
  metrica    text not null check (metrica in ('tempo', 'ripetizioni', 'kg', 'distanza')),
  verso      text not null check (verso in ('minore', 'maggiore')),
  data       date not null,
  chiusa_il  timestamptz,
  -- Il verso segue la metrica: tempo minore vince, il resto maggiore.
  check (verso = case when metrica = 'tempo' then 'minore' else 'maggiore' end)
);
create index team_sfide_team on public.team_sfide (team_id, data);
create index team_sfide_workout on public.team_sfide (workout_id);

create table public.team_risultati (
  sfida_id    uuid not null references public.team_sfide (id) on delete cascade,
  atleta_id   uuid not null references public.athletes (id) on delete cascade,
  valore      numeric not null check (valore > 0),
  fonte       text not null default 'manuale' check (fonte in ('manuale', 'garmin')),
  inserito_il timestamptz not null default now(),
  primary key (sfida_id, atleta_id)
);

-- ── 2. le funzioni delle policy ───────────────────────────────────────────
-- Stesso stile di multi_coach_2026-10-15.sql: security definer, search_path
-- vuoto, nomi qualificati. Evitano la ricorsione fra policy.

-- Il team è mio? Admin: sempre. Coach: se l'ha creato lui.
create or replace function public.team_mio(t uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.e_admin()
      or exists (select 1 from public.team x where x.id = t and x.coach_id = auth.uid())
$$;

-- Sono in questo team, in uno di questi stati, E il team è di un mio coach
-- (anche se il coach è un admin)? Se un admin sposta l'atleta a un altro coach, gli inviti
-- e i team del coach vecchio smettono di essere visibili.
create or replace function public.membro_team(t uuid, stati text[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.team_membri m join public.team x on x.id = m.team_id
     where m.team_id = t and m.atleta_id = auth.uid() and m.stato = any (stati)
       and public.e_mio_coach(x.coach_id))
$$;

-- L'atleta `a` segue il coach del team `t`? Vale anche per i team di un admin:
-- l'admin vede tutti gli atleti, ma nel team mette solo quelli che segue lui
-- (in coach_atleti). Revisione del 09/11/2026: con «o è un admin» un atleta
-- spostato a un altro coach restava nei team di Federico.
create or replace function public.atleta_del_coach_del_team(t uuid, a uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.team x join public.coach_atleti ca on ca.coach_id = x.coach_id
                  where x.id = t and ca.athlete_id = a)
$$;

create or replace function public.team_di_sfida(s uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select team_id from public.team_sfide where id = s
$$;

create or replace function public.classifica_aperta(t uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select classifica_visibile from public.team where id = t), false)
$$;

-- ── 3. le regole sugli stati (il consenso dell'atleta) ────────────────────
create or replace function public.team_membri_regole() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  t   public.team%rowtype;
begin
  -- SQL editor ed Edge Function (service role) non hanno un utente: fidati.
  if uid is null then return new; end if;

  if tg_op = 'UPDATE' and (new.team_id <> old.team_id or new.atleta_id <> old.atleta_id) then
    raise exception 'team_membri: non si sposta una riga';
  end if;

  select * into t from public.team where id = new.team_id;

  -- L'atleta risponde per sé.
  if uid = new.atleta_id and not public.team_mio(new.team_id) then
    if tg_op = 'INSERT' then
      raise exception 'team_membri: un atleta non si iscrive da solo';
    end if;
    if not ((old.stato = 'invitato' and new.stato in ('dentro', 'rifiutato'))
         or (old.stato = 'dentro'   and new.stato = 'uscito')) then
      raise exception 'team_membri: transizione non ammessa (% → %)', old.stato, new.stato;
    end if;
    if not public.e_mio_coach(t.coach_id) then
      raise exception 'team_membri: il team non è di un tuo coach';
    end if;
    if new.stato = 'dentro' and t.chiuso_il is not null then
      raise exception 'team_membri: il team è chiuso';
    end if;
    new.invitato_il := old.invitato_il;
    new.risposto_il := now();
    return new;
  end if;

  -- Il coach (o un admin) invita e reinvita. Mai «dentro».
  if t.chiuso_il is not null then
    raise exception 'team_membri: il team è chiuso';
  end if;
  if exists (select 1 from public.athletes a where a.id = new.atleta_id and a.deleted_at is not null) then
    raise exception 'team_membri: atleta eliminato';
  end if;
  if not public.atleta_del_coach_del_team(new.team_id, new.atleta_id) then
    raise exception 'team_membri: l''atleta non segue il coach del team';
  end if;
  if tg_op = 'INSERT' then
    if new.stato <> 'invitato' then
      raise exception 'team_membri: il coach può solo invitare';
    end if;
    new.invitato_il := now();
    new.risposto_il := null;
    return new;
  end if;
  if old.stato in ('rifiutato', 'uscito') and new.stato = 'invitato'
     and old.risposto_il <= now() - interval '3 days' then
    new.invitato_il := now();
    new.risposto_il := null;
    return new;
  end if;
  raise exception 'team_membri: transizione non ammessa (% → %)', old.stato, new.stato;
end $$;

create trigger team_membri_regole
  before insert or update on public.team_membri
  for each row execute function public.team_membri_regole();

-- Niente risultati a sfida chiusa; tetti per metrica (spec §12, piano).
create or replace function public.team_risultati_regole() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  sf public.team_sfide%rowtype;
begin
  if tg_op = 'UPDATE' and (new.sfida_id <> old.sfida_id or new.atleta_id <> old.atleta_id) then
    raise exception 'team_risultati: non si sposta una riga';
  end if;
  select * into sf from public.team_sfide where id = new.sfida_id;
  if sf.chiusa_il is not null then
    raise exception 'team_risultati: la sfida è chiusa';
  end if;
  if new.valore > case sf.metrica
       when 'tempo' then 86400 when 'ripetizioni' then 10000
       when 'kg' then 100000 else 1000000 end then
    raise exception 'team_risultati: valore fuori misura per %', sf.metrica;
  end if;
  new.inserito_il := now();
  return new;
end $$;

create trigger team_risultati_regole
  before insert or update on public.team_risultati
  for each row execute function public.team_risultati_regole();

-- ── 4. la scheda del team, con i nomi ─────────────────────────────────────
-- Al coach: tutti i membri con lo stato. All'atleta invitato o dentro: solo
-- chi è invitato o dentro (mai chi è uscito o ha rifiutato). A chiunque
-- altro: null.
create or replace function public.team_scheda(t uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  coach boolean := public.team_mio(t);
begin
  if not coach and not public.membro_team(t, array['invitato', 'dentro']) then
    return null;
  end if;
  return (
    select jsonb_build_object(
      'team', jsonb_build_object(
        'id', x.id, 'nome', x.nome, 'coach_id', x.coach_id, 'evento_id', x.evento_id,
        'classifica_visibile', x.classifica_visibile, 'chiuso_il', x.chiuso_il,
        'evento', (select jsonb_build_object('titolo', w.title, 'data', w.date)
                     from public.workouts w where w.id = x.evento_id)),
      'coach', jsonb_build_object('nome',
        coalesce((select btrim(coalesce(a.name, '') || ' ' || coalesce(a.surname, ''))
                    from public.athletes a where a.id = x.coach_id), 'Il tuo coach')),
      'membri', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'atleta_id', m.atleta_id, 'nome', a.name, 'cognome', a.surname,
                 'foto', a.photo_url, 'stato', m.stato,
                 'invitato_il', m.invitato_il, 'risposto_il', m.risposto_il)
               order by a.name)
          from public.team_membri m join public.athletes a on a.id = m.atleta_id
         where m.team_id = x.id
           and (coach or m.stato in ('invitato', 'dentro'))), '[]'::jsonb))
    from public.team x where x.id = t);
end $$;

-- ── 5. le policy ──────────────────────────────────────────────────────────
alter table public.team           enable row level security;
alter table public.team_membri    enable row level security;
alter table public.team_sfide     enable row level security;
alter table public.team_risultati enable row level security;

-- team: lo scrive il suo coach (staff MENO il revisore Apple); lo vede il
-- coach e chi è invitato o dentro.
create policy "team lettura" on public.team
  as permissive for select to authenticated
  using (public.team_mio(id) or public.membro_team(id, array['invitato', 'dentro']));
create policy "team creazione" on public.team
  as permissive for insert to authenticated
  with check (coach_id = auth.uid() and public.puo_scrivere_messaggi());
create policy "team modifica" on public.team
  as permissive for update to authenticated
  using      (public.team_mio(id) and public.puo_scrivere_messaggi())
  with check (public.team_mio(id) and public.puo_scrivere_messaggi());
create policy "team cancellazione" on public.team
  as permissive for delete to authenticated
  using (public.team_mio(id) and public.puo_scrivere_messaggi());

-- team_membri: il coach invita i SUOI atleti; l'atleta tocca solo la sua riga
-- (le transizioni ammesse le decide il trigger).
create policy "team_membri lettura" on public.team_membri
  as permissive for select to authenticated
  using (public.team_mio(team_id) or atleta_id = auth.uid());
create policy "team_membri invito" on public.team_membri
  as permissive for insert to authenticated
  with check (public.team_mio(team_id) and public.puo_scrivere_messaggi()
              and public.atleta_del_coach_del_team(team_id, atleta_id) and stato = 'invitato');
create policy "team_membri risposta" on public.team_membri
  as permissive for update to authenticated
  using      ((public.team_mio(team_id) and public.puo_scrivere_messaggi()) or atleta_id = auth.uid())
  with check ((public.team_mio(team_id) and public.puo_scrivere_messaggi()) or atleta_id = auth.uid());
create policy "team_membri annulla invito" on public.team_membri
  as permissive for delete to authenticated
  using (public.team_mio(team_id) and public.puo_scrivere_messaggi() and stato = 'invitato');

-- team_sfide: le crea il coach; le vede chi è dentro.
create policy "team_sfide lettura" on public.team_sfide
  as permissive for select to authenticated
  using (public.team_mio(team_id) or public.membro_team(team_id, array['dentro']));
create policy "team_sfide coach" on public.team_sfide
  as permissive for all to authenticated
  using      (public.team_mio(team_id) and public.puo_scrivere_messaggi())
  with check (public.team_mio(team_id) and public.puo_scrivere_messaggi());

-- team_risultati: ognuno scrive il proprio; i compagni li leggono solo con la
-- classifica visibile; il coach li legge sempre. Il coach NON li scrive.
create policy "team_risultati lettura" on public.team_risultati
  as permissive for select to authenticated
  using (atleta_id = auth.uid()
         or public.team_mio(public.team_di_sfida(sfida_id))
         or (public.membro_team(public.team_di_sfida(sfida_id), array['dentro'])
             and public.classifica_aperta(public.team_di_sfida(sfida_id))));
create policy "team_risultati inserimento" on public.team_risultati
  as permissive for insert to authenticated
  with check (atleta_id = auth.uid()
              and public.membro_team(public.team_di_sfida(sfida_id), array['dentro']));
create policy "team_risultati correzione" on public.team_risultati
  as permissive for update to authenticated
  using      (atleta_id = auth.uid())
  with check (atleta_id = auth.uid()
              and public.membro_team(public.team_di_sfida(sfida_id), array['dentro']));
-- La cancellazione chiesta da chi esce: sempre permessa sui propri.
create policy "team_risultati cancellazione" on public.team_risultati
  as permissive for delete to authenticated
  using (atleta_id = auth.uid());

-- ── 6. l'interruttore ─────────────────────────────────────────────────────
insert into public.funzioni_app (nome, stato) values ('team', 'spenta');

commit;

-- Dopo, per verificare (deve stampare QUATTORDICI policy: team 4, team_membri 4,
-- team_sfide 2, team_risultati 4):
--   select tablename, policyname, cmd from pg_policies
--    where tablename in ('team', 'team_membri', 'team_sfide', 'team_risultati')
--    order by tablename, policyname;
-- Poi eseguire tools/verifica-team.sql.
