-- Controlli sull'account che diamo ad Apple (demo@fleofit.it).
-- Solo letture: nessuna modifica di schema, compatibile col congelamento
-- (CLAUDE.md regola 0-bis). Eseguire nell'SQL Editor di Supabase.

-- ─────────────────────────────────────────────────────────────────────────
-- A. PRIMA di provare: l'account esiste ed è pronto?
--    Se `riga_athletes` è false il revisore finisce in onboarding invece che
--    nella dashboard coach, e non vede niente di quello che deve valutare.
-- ─────────────────────────────────────────────────────────────────────────
select
  u.email,
  u.id                                        as user_id,
  u.email_confirmed_at is not null            as email_confermata,
  u.last_sign_in_at,
  exists (select 1 from public.athletes a where a.id = u.id) as riga_athletes
from auth.users u
where lower(u.email) = 'demo@fleofit.it';

-- ─────────────────────────────────────────────────────────────────────────
-- B. La dashboard coach non deve aprirsi vuota.
--    Un revisore che vede tre schermate vuote non riesce a valutare la
--    funzionalità, ed è di nuovo un 2.3.1(a).
-- ─────────────────────────────────────────────────────────────────────────
select
  (select count(*) from public.athletes         where deleted_at is null) as atleti_visibili,
  (select count(*) from public.workouts)                                  as workout_totali,
  (select count(*) from public.athlete_workouts)                          as assegnazioni,
  (select count(*) from public.invitation_codes where is_active)          as codici_attivi;

-- ─────────────────────────────────────────────────────────────────────────
-- C. DOPO aver provato ad assegnare dall'app: l'assegnazione è arrivata?
--    Deve comparire una riga creata negli ultimi minuti.
-- ─────────────────────────────────────────────────────────────────────────
select aw.id, aw.athlete_id, aw.workout_id, aw.completed_date, aw.status,
       w.title
from public.athlete_workouts aw
left join public.workouts w on w.id = aw.workout_id
order by aw.id desc
limit 5;

-- ─────────────────────────────────────────────────────────────────────────
-- D. Le tre porte che l'assegnazione attraversa, con demo@fleofit.it.
--    INSERT su athlete_workouts → with_check
--    .select('id') sulle righe inserite → qual
--    invoke send-reminders mode 'immediate' → _shared/admin.ts (non è RLS)
--    Tutte e tre devono dire true, o l'assegnazione fallisce a metà.
-- ─────────────────────────────────────────────────────────────────────────
select tablename, policyname, cmd,
       qual::text       like '%demo@fleofit.it%' as using_ok,
       with_check::text like '%demo@fleofit.it%' as check_ok
from pg_policies
where schemaname = 'public'
  and tablename in ('athletes', 'athlete_workouts', 'workouts')
order by tablename, policyname;
