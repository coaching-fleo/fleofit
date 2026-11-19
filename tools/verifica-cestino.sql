-- ═══════════════════════════════════════════════════════════════════════════
-- Verifica del CESTINO DEI WORKOUT (supabase/schema/cestino_workout_2026-11-19.sql).
-- Eseguire nell'SQL editor di Supabase DOPO aver applicato la migrazione.
--
-- NON LASCIA TRACCE: ogni caso crea i suoi dati di prova, li prova come un
-- utente vero (ruolo `authenticated` + JWT finto) e poi annulla tutto con
-- un'eccezione «sentinella». Non c'è un database di prova (CLAUDE.md §4).
--
-- Esito: alla fine compare `TUTTI I CONTROLLI DEL CESTINO SONO PASSATI`.
-- Un caso sbagliato si ferma con `FALLITO: <caso>`.
--
-- Servono, fra i dati veri: due coach (ruolo 'coach' in staff, non il demo),
-- il primo con almeno DUE atleti in coach_atleti; un admin (non il demo);
-- un atleta che NON è del primo coach.
-- ═══════════════════════════════════════════════════════════════════════════

-- Diventa l'utente `uid` fino alla fine della (sotto)transazione.
create or replace function pg_temp.come(uid uuid, email text) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'email', email, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

-- Torna superutente (per preparare i dati dentro un caso).
create or replace function pg_temp.io() returns void
language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

-- Esegue `istruzione` e si aspetta un ERRORE che contenga `atteso`.
create or replace function pg_temp.deve_fallire(istruzione text, atteso text, caso text) returns void
language plpgsql as $$
begin
  begin
    execute istruzione;
  exception when others then
    if atteso is null or position(atteso in sqlerrm) > 0 then return; end if;
    raise exception 'FALLITO: % (errore inatteso: %)', caso, sqlerrm;
  end;
  raise exception 'FALLITO: % (è riuscita, doveva fallire)', caso;
end $$;

-- Esegue `istruzione` (update/delete) e restituisce le righe toccate.
create or replace function pg_temp.righe(istruzione text) returns int
language plpgsql as $$
declare n int;
begin
  execute istruzione;
  get diagnostics n = row_count;
  return n;
end $$;

-- Un workout del coach `c`, assegnato a `atleti`. Restituisce il suo id.
create or replace function pg_temp.workout(c uuid, atleti uuid[]) returns uuid
language plpgsql as $$
declare w uuid; a uuid;
begin
  insert into public.workouts (title, date, sections, coach_notes, creato_da)
    values ('verifica cestino', current_date, '{"category":"Hyrox","blocks":[]}'::jsonb, '', c)
    returning id into w;
  foreach a in array coalesce(atleti, '{}') loop
    insert into public.athlete_workouts (athlete_id, workout_id, status, notes, voice_note_url)
      values (a, w, 'completed', 'ok [RPE: 7/10]', 'https://esempio/voice-notes/x.m4a');
  end loop;
  return w;
end $$;

do $$
declare
  c_id uuid; c_email text;          -- il coach
  b_id uuid; b_email text;          -- un altro coach
  adm uuid; adm_email text;         -- un admin
  a1 uuid; a2 uuid;                 -- due atleti del coach
  fuori uuid;                        -- un atleta non suo
  w uuid; cid uuid; aw1 uuid; aw2 uuid; t uuid; s uuid;
  n int; v jsonb;
begin
  -- ── i dati veri da cui partire ─────────────────────────────────────────
  select u.id, s2.email into c_id, c_email
    from public.staff s2 join auth.users u on lower(u.email) = s2.email
   where s2.ruolo = 'coach' and s2.email <> 'demo@fleofit.it'
     and (select count(*) from public.coach_atleti ca where ca.coach_id = u.id) >= 2
   limit 1;
  select u.id, s2.email into b_id, b_email
    from public.staff s2 join auth.users u on lower(u.email) = s2.email
   where s2.ruolo = 'coach' and s2.email <> 'demo@fleofit.it' and u.id <> c_id
   limit 1;
  select u.id, s2.email into adm, adm_email
    from public.staff s2 join auth.users u on lower(u.email) = s2.email
   where s2.ruolo = 'admin' and s2.email <> 'demo@fleofit.it'
   limit 1;
  if c_id is null or b_id is null or adm is null then
    raise exception 'Dati mancanti: servono due coach (il primo con due atleti) e un admin';
  end if;
  select ca.athlete_id into a1 from public.coach_atleti ca
   where ca.coach_id = c_id order by ca.athlete_id limit 1;
  select ca.athlete_id into a2 from public.coach_atleti ca
   where ca.coach_id = c_id and ca.athlete_id <> a1 order by ca.athlete_id limit 1;
  select a.id into fuori from public.athletes a
   where a.deleted_at is null and a.id <> c_id
     and not exists (select 1 from public.coach_atleti ca where ca.athlete_id = a.id and ca.coach_id = c_id)
   limit 1;
  if fuori is null then raise exception 'Dati mancanti: un atleta non del coach'; end if;

  -- ── 1. delete diretto: il workout finisce nel cestino con le assegnazioni
  begin
    w := pg_temp.workout(c_id, array[a1, a2]);
    perform pg_temp.come(c_id, c_email);
    if pg_temp.righe(format('delete from public.workouts where id = %L', w)) <> 1 then
      raise exception 'FALLITO: 1. il coach non riesce a eliminare il suo workout';
    end if;
    perform pg_temp.io();
    if exists (select 1 from public.workouts where id = w) then
      raise exception 'FALLITO: 1. il workout c''è ancora';
    end if;
    select jsonb_array_length(copia -> 'assegnazioni') into n from public.cestino_workout where workout_id = w;
    if n is distinct from 2 then
      raise exception 'FALLITO: 1. delete diretto (assegnazioni nel cestino: %)', n;
    end if;
    if (select eliminato_da from public.cestino_workout where workout_id = w) is distinct from c_id then
      raise exception 'FALLITO: 1. eliminato_da non è il coach';
    end if;
    raise exception 'SENTINELLA';
  exception when others then if sqlerrm <> 'SENTINELLA' then raise; end if;
  end;

  -- ── 2. allenamento libero dell'atleta: fuori dal cestino ───────────────
  begin
    w := pg_temp.workout(a1, array[a1]);
    delete from public.workouts where id = w;
    if exists (select 1 from public.cestino_workout where workout_id = w) then
      raise exception 'FALLITO: 2. libero fuori (è finito nel cestino)';
    end if;
    raise exception 'SENTINELLA';
  exception when others then if sqlerrm <> 'SENTINELLA' then raise; end if;
  end;

  -- ── 3. senza autore: lo vede un admin, non un coach ────────────────────
  begin
    w := pg_temp.workout(null, array[a1]);
    delete from public.workouts where id = w;
    perform pg_temp.come(adm, adm_email);
    select count(*) into n from public.cestino_workout where workout_id = w;
    if n <> 1 then raise exception 'FALLITO: 3. senza autore agli admin (l''admin non lo vede)'; end if;
    perform pg_temp.come(c_id, c_email);
    select count(*) into n from public.cestino_workout where workout_id = w;
    if n <> 0 then raise exception 'FALLITO: 3. senza autore agli admin (lo vede un coach)'; end if;
    raise exception 'SENTINELLA';
  exception when others then if sqlerrm <> 'SENTINELLA' then raise; end if;
  end;

  -- ── 4. un altro coach non ripristina il cestino del primo ──────────────
  begin
    w := pg_temp.workout(c_id, array[a1]);
    delete from public.workouts where id = w;
    select id into cid from public.cestino_workout where workout_id = w;
    perform pg_temp.come(b_id, b_email);
    perform pg_temp.deve_fallire(format(
      'select public.ripristina_workout(%L, ''{}'', ''{}'')', cid), 'cestino: non trovato', '4. altro coach');
    raise exception 'SENTINELLA';
  exception when others then if sqlerrm <> 'SENTINELLA' then raise; end if;
  end;

  -- ── 5. solo workout: niente assegnazioni, niente notifiche ─────────────
  begin
    w := pg_temp.workout(c_id, array[a1, a2]);
    delete from public.workouts where id = w;
    select id into cid from public.cestino_workout where workout_id = w;
    select count(*) into n from public.notifications;
    perform pg_temp.come(c_id, c_email);
    if public.ripristina_workout(cid, '{}', '{}') is distinct from w then
      raise exception 'FALLITO: 5. solo workout (id diverso)';
    end if;
    perform pg_temp.io();
    if not exists (select 1 from public.workouts where id = w) then raise exception 'FALLITO: 5. il workout non è tornato'; end if;
    if exists (select 1 from public.athlete_workouts where workout_id = w) then raise exception 'FALLITO: 5. sono tornate assegnazioni non spuntate'; end if;
    if (select count(*) from public.notifications) <> n then raise exception 'FALLITO: 5. il ripristino ha creato notifiche'; end if;
    if exists (select 1 from public.cestino_workout where id = cid) then raise exception 'FALLITO: 5. la riga è ancora nel cestino'; end if;
    raise exception 'SENTINELLA';
  exception when others then if sqlerrm <> 'SENTINELLA' then raise; end if;
  end;

  -- ── 6. a spunte: torna solo l'assegnazione scelta, uguale a prima ──────
  begin
    w := pg_temp.workout(c_id, array[a1, a2]);
    select id into aw1 from public.athlete_workouts where workout_id = w and athlete_id = a1;
    select id into aw2 from public.athlete_workouts where workout_id = w and athlete_id = a2;
    delete from public.workouts where id = w;
    select id into cid from public.cestino_workout where workout_id = w;
    perform pg_temp.come(c_id, c_email);
    perform public.ripristina_workout(cid, array[aw1], '{}');
    perform pg_temp.io();
    if not exists (select 1 from public.athlete_workouts where id = aw1
                     and notes = 'ok [RPE: 7/10]' and voice_note_url = 'https://esempio/voice-notes/x.m4a') then
      raise exception 'FALLITO: 6. a spunte (l''assegnazione scelta non è tornata uguale)';
    end if;
    if exists (select 1 from public.athlete_workouts where id = aw2) then
      raise exception 'FALLITO: 6. a spunte (è tornata quella non scelta)';
    end if;
    raise exception 'SENTINELLA';
  exception when others then if sqlerrm <> 'SENTINELLA' then raise; end if;
  end;

  -- ── 7. due volte: la seconda trova la riga già tolta ───────────────────
  begin
    w := pg_temp.workout(c_id, array[a1]);
    delete from public.workouts where id = w;
    select id into cid from public.cestino_workout where workout_id = w;
    perform pg_temp.come(c_id, c_email);
    perform public.ripristina_workout(cid, '{}', '{}');
    perform pg_temp.deve_fallire(format(
      'select public.ripristina_workout(%L, ''{}'', ''{}'')', cid), 'cestino: non trovato', '7. due volte');
    raise exception 'SENTINELLA';
  exception when others then if sqlerrm <> 'SENTINELLA' then raise; end if;
  end;

  -- ── 8. atleta di un altro: spento in cestino_voci, saltato nel ripristino
  begin
    w := pg_temp.workout(c_id, array[a1, fuori]);
    select id into aw2 from public.athlete_workouts where workout_id = w and athlete_id = fuori;
    delete from public.workouts where id = w;
    select id into cid from public.cestino_workout where workout_id = w;
    perform pg_temp.come(c_id, c_email);
    select x into v from jsonb_array_elements(public.cestino_voci(cid)) x where x ->> 'id' = aw2::text;
    if (v ->> 'ripristinabile')::boolean is distinct from false
       or v ->> 'motivo' is distinct from 'non è più tra i tuoi atleti' then
      raise exception 'FALLITO: 8. atleta di un altro (voce: %)', v;
    end if;
    perform public.ripristina_workout(cid, array[aw2], '{}');
    perform pg_temp.io();
    if exists (select 1 from public.athlete_workouts where id = aw2) then
      raise exception 'FALLITO: 8. atleta di un altro (riassegnato lo stesso)';
    end if;
    raise exception 'SENTINELLA';
  exception when others then if sqlerrm <> 'SENTINELLA' then raise; end if;
  end;

  -- ── 9. sfida chiusa: torna chiusa, con i due risultati ─────────────────
  begin
    w := pg_temp.workout(c_id, array[a1, a2]);
    insert into public.team (nome, coach_id, evento_id) values ('verifica cestino', c_id, w) returning id into t;
    insert into public.team_sfide (team_id, workout_id, metrica, verso, data)
      values (t, w, 'tempo', 'minore', current_date) returning id into s;
    insert into public.team_risultati (sfida_id, atleta_id, valore, fonte) values (s, a1, 600, 'manuale'), (s, a2, 700, 'manuale');
    update public.team_sfide set chiusa_il = now() where id = s;
    delete from public.workouts where id = w;
    if (select evento_id from public.team where id = t) is not null then
      raise exception 'FALLITO: 9. evento_id non è stato messo a null';
    end if;
    select id into cid from public.cestino_workout where workout_id = w;
    perform pg_temp.come(c_id, c_email);
    perform public.ripristina_workout(cid, '{}', array[s]);
    perform pg_temp.io();
    if (select chiusa_il from public.team_sfide where id = s) is null then
      raise exception 'FALLITO: 9. sfida chiusa (è tornata aperta o non è tornata)';
    end if;
    if (select count(*) from public.team_risultati where sfida_id = s) <> 2 then
      raise exception 'FALLITO: 9. sfida chiusa (risultati mancanti)';
    end if;
    if (select evento_id from public.team where id = t) is distinct from w then
      raise exception 'FALLITO: 9. il team non punta di nuovo al workout';
    end if;
    raise exception 'SENTINELLA';
  exception when others then if sqlerrm <> 'SENTINELLA' then raise; end if;
  end;

  -- ── 10. nessuno svuota il cestino dal client ───────────────────────────
  begin
    w := pg_temp.workout(c_id, array[a1]);
    delete from public.workouts where id = w;
    perform pg_temp.come(c_id, c_email);
    if pg_temp.righe(format('delete from public.cestino_workout where workout_id = %L', w)) <> 0 then
      raise exception 'FALLITO: 10. nessun delete dal client (il coach ha svuotato il cestino)';
    end if;
    raise exception 'SENTINELLA';
  exception when others then if sqlerrm <> 'SENTINELLA' then raise; end if;
  end;

  raise notice 'TUTTI I CONTROLLI DEL CESTINO SONO PASSATI';
end $$;

select 'TUTTI I CONTROLLI DEL CESTINO SONO PASSATI' as esito;
