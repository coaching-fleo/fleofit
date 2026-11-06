-- ═══════════════════════════════════════════════════════════════════════════
-- Verifica dei permessi del TEAM (supabase/schema/team_2026-11-06.sql).
-- Eseguire nell'SQL editor di Supabase DOPO aver applicato la migrazione.
--
-- NON LASCIA TRACCE: ogni caso crea i suoi dati di prova, li prova come un
-- utente vero (ruolo `authenticated` + JWT finto) e poi annulla tutto con
-- un'eccezione «sentinella». Non c'è un database di prova (CLAUDE.md §4):
-- per questo niente resta scritto.
--
-- Esito: alla fine compare `TUTTI I CONTROLLI DEL TEAM SONO PASSATI`.
-- Un caso sbagliato si ferma con `FALLITO: <caso>`.
--
-- Servono, fra i dati veri: un coach (ruolo 'coach' in staff, non il demo)
-- con almeno DUE atleti in coach_atleti, un atleta che non è suo, un workout.
-- ═══════════════════════════════════════════════════════════════════════════

-- Diventa l'utente `uid` fino alla fine della (sotto)transazione.
create or replace function pg_temp.come(uid uuid, email text) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'email', email, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

-- Esegue `istruzione` e si aspetta un ERRORE. Se riesce: FALLITO.
create or replace function pg_temp.deve_fallire(istruzione text, caso text) returns void
language plpgsql as $$
begin
  begin
    execute istruzione;
  exception when others then
    return;  -- è fallita: giusto
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

-- Conta le righe che la select vede.
create or replace function pg_temp.conta(sel text) returns int
language plpgsql as $$
declare n int;
begin
  execute 'select count(*) from (' || sel || ') x' into n;
  return n;
end $$;

do $$
declare
  c_id uuid; c_email text;          -- il coach
  a1 uuid; a1_email text;           -- un suo atleta
  a2 uuid; a2_email text;           -- un altro suo atleta
  fuori uuid;                        -- un atleta non suo
  demo_id uuid;
  w uuid;                            -- un workout qualsiasi
  t uuid; s uuid;
begin
  -- ── i dati veri da cui partire ─────────────────────────────────────────
  select u.id, s2.email into c_id, c_email
    from public.staff s2 join auth.users u on lower(u.email) = s2.email
   where s2.ruolo = 'coach' and s2.email <> 'demo@fleofit.it'
     and (select count(*) from public.coach_atleti ca where ca.coach_id = u.id) >= 2
   limit 1;
  if c_id is null then raise exception 'Dati mancanti: serve un coach con almeno due atleti'; end if;

  select ca.athlete_id, lower(u.email) into a1, a1_email
    from public.coach_atleti ca join auth.users u on u.id = ca.athlete_id
   where ca.coach_id = c_id order by ca.athlete_id limit 1;
  select ca.athlete_id, lower(u.email) into a2, a2_email
    from public.coach_atleti ca join auth.users u on u.id = ca.athlete_id
   where ca.coach_id = c_id and ca.athlete_id <> a1 order by ca.athlete_id limit 1;
  select a.id into fuori from public.athletes a
   where a.deleted_at is null
     and not exists (select 1 from public.coach_atleti ca where ca.athlete_id = a.id and ca.coach_id = c_id)
     and a.id <> c_id
   limit 1;
  select id into demo_id from auth.users where lower(email) = 'demo@fleofit.it';
  select id into w from public.workouts limit 1;
  if a2 is null or fuori is null or w is null then raise exception 'Dati mancanti: atleti o workout'; end if;

  -- ── 1. il coach non scrive mai «dentro» ────────────────────────────────
  begin
    insert into public.team (nome, coach_id) values ('verifica 1', c_id) returning id into t;
    perform pg_temp.come(c_id, c_email);
    perform pg_temp.deve_fallire(format(
      'insert into public.team_membri (team_id, atleta_id, stato) values (%L, %L, ''dentro'')', t, a1),
      '1. coach inserisce dentro');
    raise exception 'SENTINELLA';
  exception when others then if sqlerrm <> 'SENTINELLA' then raise; end if;
  end;

  -- ── 2. il coach non invita un atleta che non è suo ─────────────────────
  begin
    insert into public.team (nome, coach_id) values ('verifica 2', c_id) returning id into t;
    perform pg_temp.come(c_id, c_email);
    perform pg_temp.deve_fallire(format(
      'insert into public.team_membri (team_id, atleta_id, stato) values (%L, %L, ''invitato'')', t, fuori),
      '2. coach invita un atleta non suo');
    raise exception 'SENTINELLA';
  exception when others then if sqlerrm <> 'SENTINELLA' then raise; end if;
  end;

  -- ── 3 e 4. l'atleta accetta il proprio invito, non quello di un altro ──
  begin
    insert into public.team (nome, coach_id) values ('verifica 3', c_id) returning id into t;
    insert into public.team_membri (team_id, atleta_id, stato) values (t, a1, 'invitato'), (t, a2, 'invitato');
    perform pg_temp.come(a1, a1_email);
    if pg_temp.righe(format('update public.team_membri set stato = ''dentro'' where team_id = %L and atleta_id = %L', t, a1)) <> 1 then
      raise exception 'FALLITO: 3. l''atleta non riesce ad accettare';
    end if;
    if pg_temp.righe(format('update public.team_membri set stato = ''dentro'' where team_id = %L and atleta_id = %L', t, a2)) <> 0 then
      raise exception 'FALLITO: 4. l''atleta ha accettato per un altro';
    end if;
    raise exception 'SENTINELLA';
  exception when others then if sqlerrm <> 'SENTINELLA' then raise; end if;
  end;

  -- ── 5. reinvito: non prima di 3 giorni ─────────────────────────────────
  begin
    insert into public.team (nome, coach_id) values ('verifica 5', c_id) returning id into t;
    insert into public.team_membri (team_id, atleta_id, stato, risposto_il)
      values (t, a1, 'rifiutato', now() - interval '2 days'),
             (t, a2, 'rifiutato', now() - interval '3 days 1 minute');
    perform pg_temp.come(c_id, c_email);
    perform pg_temp.deve_fallire(format(
      'update public.team_membri set stato = ''invitato'' where team_id = %L and atleta_id = %L', t, a1),
      '5. reinvito dopo 2 giorni');
    if pg_temp.righe(format('update public.team_membri set stato = ''invitato'' where team_id = %L and atleta_id = %L', t, a2)) <> 1 then
      raise exception 'FALLITO: 5. reinvito dopo 3 giorni rifiutato';
    end if;
    raise exception 'SENTINELLA';
  exception when others then if sqlerrm <> 'SENTINELLA' then raise; end if;
  end;

  -- ── 6. risultati dei compagni solo con la classifica visibile ──────────
  begin
    insert into public.team (nome, coach_id, classifica_visibile) values ('verifica 6', c_id, false) returning id into t;
    insert into public.team_membri (team_id, atleta_id, stato) values (t, a1, 'dentro'), (t, a2, 'dentro');
    insert into public.team_sfide (team_id, workout_id, metrica, verso, data) values (t, w, 'tempo', 'minore', current_date) returning id into s;
    insert into public.team_risultati (sfida_id, atleta_id, valore) values (s, a2, 300);
    perform pg_temp.come(a1, a1_email);
    if pg_temp.conta(format('select 1 from public.team_risultati where sfida_id = %L and atleta_id = %L', s, a2)) <> 0 then
      raise exception 'FALLITO: 6. risultato del compagno visibile con la classifica spenta';
    end if;
    perform set_config('role', 'postgres', true);
    update public.team set classifica_visibile = true where id = t;
    perform pg_temp.come(a1, a1_email);
    if pg_temp.conta(format('select 1 from public.team_risultati where sfida_id = %L and atleta_id = %L', s, a2)) <> 1 then
      raise exception 'FALLITO: 6. risultato del compagno NON visibile con la classifica accesa';
    end if;
    raise exception 'SENTINELLA';
  exception when others then if sqlerrm <> 'SENTINELLA' then raise; end if;
  end;

  -- ── 7. chi è uscito non vede più le sfide ──────────────────────────────
  begin
    insert into public.team (nome, coach_id) values ('verifica 7', c_id) returning id into t;
    insert into public.team_membri (team_id, atleta_id, stato) values (t, a1, 'uscito');
    insert into public.team_sfide (team_id, workout_id, metrica, verso, data) values (t, w, 'kg', 'maggiore', current_date);
    perform pg_temp.come(a1, a1_email);
    if pg_temp.conta(format('select 1 from public.team_sfide where team_id = %L', t)) <> 0 then
      raise exception 'FALLITO: 7. l''atleta uscito vede le sfide';
    end if;
    raise exception 'SENTINELLA';
  exception when others then if sqlerrm <> 'SENTINELLA' then raise; end if;
  end;

  -- ── 8. niente risultato a sfida chiusa, niente valori fuori tetto ──────
  begin
    insert into public.team (nome, coach_id) values ('verifica 8', c_id) returning id into t;
    insert into public.team_membri (team_id, atleta_id, stato) values (t, a1, 'dentro');
    insert into public.team_sfide (team_id, workout_id, metrica, verso, data, chiusa_il)
      values (t, w, 'tempo', 'minore', current_date, now()) returning id into s;
    perform pg_temp.come(a1, a1_email);
    perform pg_temp.deve_fallire(format(
      'insert into public.team_risultati (sfida_id, atleta_id, valore) values (%L, %L, 300)', s, a1),
      '8. risultato a sfida chiusa');
    perform set_config('role', 'postgres', true);
    update public.team_sfide set chiusa_il = null where id = s;
    perform pg_temp.come(a1, a1_email);
    perform pg_temp.deve_fallire(format(
      'insert into public.team_risultati (sfida_id, atleta_id, valore) values (%L, %L, 86401)', s, a1),
      '8. tempo oltre le 24 ore');
    raise exception 'SENTINELLA';
  exception when others then if sqlerrm <> 'SENTINELLA' then raise; end if;
  end;

  -- ── 9. atleta spostato a un altro coach: l'invito sparisce ─────────────
  begin
    insert into public.team (nome, coach_id) values ('verifica 9', c_id) returning id into t;
    insert into public.team_membri (team_id, atleta_id, stato) values (t, a1, 'invitato');
    delete from public.coach_atleti where athlete_id = a1 and coach_id = c_id;
    perform pg_temp.come(a1, a1_email);
    if pg_temp.conta(format('select 1 from public.team where id = %L', t)) <> 0 then
      raise exception 'FALLITO: 9. il team del coach vecchio è ancora visibile';
    end if;
    perform pg_temp.deve_fallire(format(
      'update public.team_membri set stato = ''dentro'' where team_id = %L and atleta_id = %L', t, a1),
      '9. accetta l''invito del coach vecchio');
    raise exception 'SENTINELLA';
  exception when others then if sqlerrm <> 'SENTINELLA' then raise; end if;
  end;

  -- ── 10. il revisore Apple non crea team ────────────────────────────────
  if demo_id is not null then
    begin
      perform pg_temp.come(demo_id, 'demo@fleofit.it');
      perform pg_temp.deve_fallire(format(
        'insert into public.team (nome, coach_id) values (''verifica 10'', %L)', demo_id),
        '10. demo@fleofit.it crea un team');
      raise exception 'SENTINELLA';
    exception when others then if sqlerrm <> 'SENTINELLA' then raise; end if;
    end;
  end if;

  raise notice 'TUTTI I CONTROLLI DEL TEAM SONO PASSATI';
end $$;
