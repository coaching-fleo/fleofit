-- ═══════════════════════════════════════════════════════════════════════════
-- cestino_workout — il cestino dei workout eliminati, 14 giorni per ripristinarli
-- Scritta il 19/11/2026 · sì ESPLICITO del committente in sessione richiesto
-- PRIMA di applicarla: quattordicesima eccezione alla regola 0-bis di
-- CLAUDE.md §0. Va applicata A MANO (SQL editor, oppure
-- `supabase db query --linked -f` come per come_stai).
--
-- Perché: il 18/11/2026 il revisore di App Store (demo@fleofit.it, admin) ha
-- eliminato un workout vero con le sue cinque assegnazioni, recuperato solo
-- dal backup notturno. Progetto: docs/superpowers/specs/2026-11-19-cestino-workout-design.md
--
-- Migrazione ADDITIVA: una tabella nuova, funzioni nuove (tutte `cestino_*` e
-- `ripristina_workout`), un trigger nuovo su `workouts`, un cron nuovo.
-- Nessuna tabella, policy o funzione esistente cambia.
--
-- Come funziona:
--   · prima che un workout venga cancellato (da qualunque app, anche le vecchie
--     sugli Store e il sito), il trigger ne copia la riga e tutto ciò che gli
--     è attaccato in `cestino_workout.copia`, poi lascia procedere la delete;
--   · entrano i workout con autore staff o senza autore (i vecchi Custom ed
--     Eventi); restano fuori gli allenamenti liberi (autore = un atleta,
--     compresi quelli che crea e cancella da sé garmin-webhook);
--   · se la copia fallisce, fallisce anche la delete: meglio un errore a
--     schermo che un workout perso senza rete;
--   · `ripristina_workout` rimette il workout con lo STESSO id e solo le voci
--     spuntate; non scrive notifiche. Reinserire un'assegnazione la rimanda
--     all'orologio Garmin (trigger esistente): voluto;
--   · nessuno svuota a mano: il client può solo leggere. Il cron
--     `svuota-cestino-workout` cancella dopo 14 giorni.
--
-- ⚠️ Le note vocali sono file nel bucket voice-notes: non si toccano. Restano
-- orfane come succede già oggi a ogni workout eliminato (BACKLOG).
--
-- Per tornare indietro:
--   select cron.unschedule('svuota-cestino-workout');
--   drop trigger cestino_workout_copia on public.workouts;
--   drop function public.ripristina_workout(uuid, uuid[], uuid[]), public.cestino_voci(uuid),
--     public.cestino_riga(uuid), public.cestino_motivo_atleta(uuid), public.cestino_copia(), public.cestino_mio(uuid),
--     public.cestino_staff(uuid);
--   drop table public.cestino_workout;
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. la tabella ─────────────────────────────────────────────────────────
create table public.cestino_workout (
  id                uuid primary key default gen_random_uuid(),
  workout_id        uuid not null unique,
  titolo            text not null,
  data_workout      date,
  creato_da         uuid,
  eliminato_da      uuid default auth.uid(),
  eliminato_da_nome text,
  eliminato_il      timestamptz not null default now(),
  copia             jsonb not null
);
create index cestino_workout_creato_da on public.cestino_workout (creato_da);
create index cestino_workout_eliminato_il on public.cestino_workout (eliminato_il);

-- ── 2. chi vede cosa ──────────────────────────────────────────────────────
-- L'utente `u` è staff (admin o coach)? Come utente_admin, per ruolo qualsiasi.
create function public.cestino_staff(u uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from auth.users x
                 join public.staff s on s.email = lower(x.email)
                 where x.id = u)
$$;

-- La riga del cestino con autore `creato` è mia? Dell'autore, se è ancora
-- staff; altrimenti (autore null o non più staff) degli admin.
create function public.cestino_mio(creato uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when creato is not null and public.cestino_staff(creato)
      then creato = auth.uid() and public.e_staff()
    else public.e_admin()
  end
$$;

alter table public.cestino_workout enable row level security;

-- Solo lettura. Nessuna policy di insert, update o delete: scrivono le
-- funzioni qui sotto, e nessuno svuota il cestino a mano.
create policy "cestino_workout lettura" on public.cestino_workout
  as permissive for select to authenticated
  using (public.cestino_mio(creato_da));

revoke all on public.cestino_workout from anon;

-- ── 3. la copia, prima della delete ───────────────────────────────────────
create function public.cestino_copia() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  nome  text;
  copia jsonb;
begin
  -- Allenamento libero (autore = un atleta): fuori dal cestino.
  if old.creato_da is not null and not public.cestino_staff(old.creato_da) then
    return old;
  end if;

  select coalesce(nullif(btrim(concat_ws(' ', a.name, a.surname)), ''), split_part(u.email, '@', 1))
    into nome
    from auth.users u left join public.athletes a on a.id = u.id
   where u.id = auth.uid();

  copia := jsonb_build_object(
    'workout', to_jsonb(old),
    'assegnazioni', coalesce((
      select jsonb_agg(jsonb_build_object(
               'riga', to_jsonb(aw),
               'nome_atleta', (select nullif(btrim(concat_ws(' ', a.name, a.surname)), '')
                                 from public.athletes a where a.id = aw.athlete_id),
               'note_estratte', coalesce((select jsonb_agg(to_jsonb(ne)) from public.note_estratte ne
                                           where ne.athlete_workout_id = aw.id), '[]'::jsonb),
               'scarpe_uso', coalesce((select jsonb_agg(to_jsonb(su)) from public.scarpe_uso su
                                        where su.athlete_workout_id = aw.id), '[]'::jsonb),
               'garmin', coalesce((select jsonb_agg(ga.garmin_id) from public.garmin_attivita ga
                                    where ga.athlete_workout_id = aw.id), '[]'::jsonb)
             ) order by aw.created_at, aw.id)
        from public.athlete_workouts aw where aw.workout_id = old.id), '[]'::jsonb),
    'sfide', coalesce((
      select jsonb_agg(jsonb_build_object(
               'riga', to_jsonb(s),
               'nome_team', (select t.nome from public.team t where t.id = s.team_id),
               'risultati', coalesce((select jsonb_agg(to_jsonb(r)) from public.team_risultati r
                                       where r.sfida_id = s.id), '[]'::jsonb)
             ) order by s.data, s.id)
        from public.team_sfide s where s.workout_id = old.id), '[]'::jsonb),
    'team_evento', coalesce((select jsonb_agg(t.id) from public.team t where t.evento_id = old.id), '[]'::jsonb),
    'workout_logs', coalesce((select jsonb_agg(to_jsonb(l)) from public.workout_logs l
                               where l.workout_id = old.id), '[]'::jsonb)
  );

  -- Stesso id già nel cestino (eliminato, rimesso a mano, eliminato di nuovo):
  -- vale l'ultima copia.
  insert into public.cestino_workout
    (workout_id, titolo, data_workout, creato_da, eliminato_da, eliminato_da_nome, copia)
  values
    (old.id, coalesce(old.title, ''), old.date, old.creato_da, auth.uid(), nome, copia)
  on conflict (workout_id) do update
    set titolo = excluded.titolo, data_workout = excluded.data_workout,
        creato_da = excluded.creato_da, eliminato_da = excluded.eliminato_da,
        eliminato_da_nome = excluded.eliminato_da_nome, eliminato_il = now(),
        copia = excluded.copia;

  return old;
end $$;

create trigger cestino_workout_copia
  before delete on public.workouts
  for each row execute function public.cestino_copia();

-- ── 4. le voci del ripristino ─────────────────────────────────────────────
-- Perché un'assegnazione non si può ripristinare (null = si può).
create function public.cestino_motivo_atleta(atleta uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case
    when not exists (select 1 from public.athletes a where a.id = atleta and a.deleted_at is null)
      then 'atleta eliminato'
    when not public.mio_atleta(atleta)
      then 'non è più tra i tuoi atleti'
    else null
  end
$$;

-- La riga del cestino `c`, se è mia; altrimenti errore.
create function public.cestino_riga(c uuid) returns public.cestino_workout
language plpgsql stable security definer set search_path = '' as $$
declare r public.cestino_workout;
begin
  select * into r from public.cestino_workout where id = c;
  if not found or not public.cestino_mio(r.creato_da) then
    raise exception 'cestino: non trovato' using errcode = 'P0002';
  end if;
  return r;
end $$;

-- Le voci che il foglio di ripristino mostra a spunte.
create function public.cestino_voci(c uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r public.cestino_workout;
begin
  r := public.cestino_riga(c);
  return coalesce((
    select jsonb_agg(v order by ord)
      from (
        select 1 as ord, jsonb_build_object(
                 'tipo', 'assegnazione',
                 'id', a -> 'riga' ->> 'id',
                 'atleta', coalesce(a ->> 'nome_atleta', 'Atleta'),
                 'stato', a -> 'riga' ->> 'status',
                 'data', a -> 'riga' ->> 'completed_date',
                 'notes', a -> 'riga' ->> 'notes',
                 'nota_vocale', coalesce(a -> 'riga' ->> 'voice_note_url', '') <> ''
                                and position('#deleted=' in a -> 'riga' ->> 'voice_note_url') = 0,
                 'ripristinabile', public.cestino_motivo_atleta((a -> 'riga' ->> 'athlete_id')::uuid) is null,
                 'motivo', public.cestino_motivo_atleta((a -> 'riga' ->> 'athlete_id')::uuid)
               ) as v
          from jsonb_array_elements(r.copia -> 'assegnazioni') a
        union all
        select 2, jsonb_build_object(
                 'tipo', 'sfida',
                 'id', s -> 'riga' ->> 'id',
                 'team', coalesce(s ->> 'nome_team', 'Team'),
                 'metrica', s -> 'riga' ->> 'metrica',
                 'ripristinabile', exists (select 1 from public.team t where t.id = (s -> 'riga' ->> 'team_id')::uuid),
                 'motivo', case when exists (select 1 from public.team t where t.id = (s -> 'riga' ->> 'team_id')::uuid)
                                then null else 'team sciolto' end
               )
          from jsonb_array_elements(r.copia -> 'sfide') s
      ) x
  ), '[]'::jsonb);
end $$;

-- ── 5. il ripristino ──────────────────────────────────────────────────────
create function public.ripristina_workout(c uuid, assegnazioni uuid[], sfide uuid[])
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  r   public.cestino_workout;
  a   jsonb;
  s   jsonb;
  aw  uuid;
  ath uuid;
  sid uuid;
begin
  r := public.cestino_riga(c);
  -- Due tocchi insieme: il secondo aspetta il primo, poi non trova la riga.
  perform 1 from public.cestino_workout where id = c for update;
  if not found then raise exception 'cestino: non trovato' using errcode = 'P0002'; end if;

  if exists (select 1 from public.workouts w where w.id = r.workout_id) then
    raise exception 'cestino: id occupato';
  end if;

  insert into public.workouts
    select * from jsonb_populate_record(null::public.workouts, r.copia -> 'workout');

  for a in select * from jsonb_array_elements(r.copia -> 'assegnazioni') loop
    aw  := (a -> 'riga' ->> 'id')::uuid;
    ath := (a -> 'riga' ->> 'athlete_id')::uuid;
    continue when not (aw = any (coalesce(assegnazioni, '{}')));
    continue when public.cestino_motivo_atleta(ath) is not null;

    insert into public.athlete_workouts
      select * from jsonb_populate_record(null::public.athlete_workouts, a -> 'riga');
    insert into public.note_estratte
      select * from jsonb_populate_recordset(null::public.note_estratte, a -> 'note_estratte');
    insert into public.scarpe_uso
      select x.* from jsonb_populate_recordset(null::public.scarpe_uso, a -> 'scarpe_uso') x
       where exists (select 1 from public.scarpe_atleta sa where sa.id = x.scarpa_id);
    update public.garmin_attivita set athlete_workout_id = aw
     where athlete_workout_id is null
       and garmin_id in (select jsonb_array_elements_text(a -> 'garmin'));
    insert into public.workout_logs
      select x.* from jsonb_populate_recordset(null::public.workout_logs, r.copia -> 'workout_logs') x
       where x.athlete_id = ath;
  end loop;

  for s in select * from jsonb_array_elements(r.copia -> 'sfide') loop
    sid := (s -> 'riga' ->> 'id')::uuid;
    continue when not (sid = any (coalesce(sfide, '{}')));
    continue when not exists (select 1 from public.team t where t.id = (s -> 'riga' ->> 'team_id')::uuid);

    -- team_risultati_regole rifiuta i risultati su una sfida chiusa: prima la
    -- sfida aperta, poi i risultati, poi si richiude. inserito_il diventa ora.
    insert into public.team_sfide
      select * from jsonb_populate_record(null::public.team_sfide, (s -> 'riga') - 'chiusa_il');
    insert into public.team_risultati
      select x.* from jsonb_populate_recordset(null::public.team_risultati, s -> 'risultati') x
       where exists (select 1 from public.athletes at where at.id = x.atleta_id);
    update public.team_sfide set chiusa_il = (s -> 'riga' ->> 'chiusa_il')::timestamptz
     where id = sid and s -> 'riga' ->> 'chiusa_il' is not null;
  end loop;

  update public.team set evento_id = r.workout_id
   where evento_id is null
     and id in (select (jsonb_array_elements_text(r.copia -> 'team_evento'))::uuid);

  delete from public.cestino_workout where id = c;
  return r.workout_id;
end $$;

-- ── 6. chi può chiamare cosa ──────────────────────────────────────────────
revoke execute on function public.cestino_staff(uuid), public.cestino_mio(uuid),
  public.cestino_copia(), public.cestino_motivo_atleta(uuid), public.cestino_riga(uuid),
  public.cestino_voci(uuid), public.ripristina_workout(uuid, uuid[], uuid[])
  from public, anon;
-- cestino_mio serve alla policy, che gira come chi legge.
grant execute on function public.cestino_mio(uuid),
  public.cestino_voci(uuid), public.ripristina_workout(uuid, uuid[], uuid[])
  to authenticated;

-- ── 7. la pulizia dopo 14 giorni ──────────────────────────────────────────
-- 00:10 UTC: dopo il backup (22:30) e dopo cleanup-expired-athletes (00:00).
select cron.schedule(
  'svuota-cestino-workout',
  '10 0 * * *',
  $$delete from public.cestino_workout where eliminato_il < now() - interval '14 days'$$
);

commit;
