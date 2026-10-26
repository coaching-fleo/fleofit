-- Eccezione: federico_leo@hotmail.it (coach) vede TUTTI i workout, anche quelli
-- creati dagli altri coach. Resta coach per tutto il resto: i suoi atleti sono
-- quelli di coach_atleti, e modifica/cancella solo i workout che ha creato.
--
-- Solo LETTURA dei workout. Nessuna tabella toccata: si ridefinisce una funzione
-- già usata dalla policy "workouts lettura" (vedo_workout), da incollare a mano
-- nel SQL editor di Supabase. Richiede il sì esplicito del committente (CLAUDE.md §0, 0-bis).

create or replace function public.vedo_workout(w uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.e_admin()
      or public.email_corrente() = 'federico_leo@hotmail.it'
      or exists (select 1 from public.athlete_workouts aw
                 where aw.workout_id = w
                   and (aw.athlete_id = auth.uid() or public.mio_atleta(aw.athlete_id)))
$$;

-- Per tornare indietro: rieseguire la definizione di vedo_workout in
-- supabase/schema/multi_coach_2026-10-15.sql (senza la riga dell'email).
